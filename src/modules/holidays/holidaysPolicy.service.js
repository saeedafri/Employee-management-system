// Holiday policy + optional-selection logic (Phase 7.2). Mirrors the FE reference store
// (ems-frontend/src/mocks/data/holiday-policy-store.ts) but persists to Postgres, tenant-scoped.
// Config-over-code: per-country behaviour is data (HolidayPolicy rows), never branches.
import { prisma } from '../../plugins/prisma.js';
import { resolveApplicableHolidays } from './utils/applicability.js';

const TENANT_DEFAULT_COUNTRY = 'IN';
const today = () => new Date().toISOString().slice(0, 10);

// Seed defaults — returned read-only when the tenant has no rows yet (FE-parity, never empty).
const SEED_POLICIES = [
  { countryCode: 'IN', restrictedLimit: 2, observedRule: 'NONE' },
  { countryCode: 'US', restrictedLimit: 0, observedRule: 'NEAREST_WORKING_DAY' },
];

export class HolidaySelectionError extends Error {
  constructor(code, message, statusCode = 422) {
    super(message);
    this.name = 'HolidaySelectionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const iso = (d) => (d ? new Date(d).toISOString() : null);
const mapPolicy = (p) => ({
  countryCode: p.countryCode,
  restrictedLimit: p.restrictedLimit,
  observedRule: p.observedRule,
  version: p.version ?? 'v1',
  effectiveFrom: iso(p.effectiveFrom),
  effectiveTo: iso(p.effectiveTo),
});

// ── Policy (§2.4 effective-dated / versioned) ──────────────────────────────────
// PURE: from rows ordered effectiveFrom DESC, pick the version whose [effectiveFrom, effectiveTo)
// contains refMs; if ref predates the earliest version, fall back to the earliest (covers history).
export function pickEffective(rows, refMs) {
  const covering = rows.find((r) => new Date(r.effectiveFrom).getTime() <= refMs
    && (r.effectiveTo == null || new Date(r.effectiveTo).getTime() > refMs));
  return covering ?? (rows.length ? rows[rows.length - 1] : null);
}

export async function getPolicies(tenantId) {
  const rows = await prisma.holidayPolicy.findMany({
    where: { tenantId }, orderBy: [{ countryCode: 'asc' }, { effectiveFrom: 'desc' }],
  });
  if (rows.length === 0) return SEED_POLICIES.map((p) => ({ ...p, version: 'seed', effectiveFrom: null, effectiveTo: null }));
  return rows.map(mapPolicy);
}

/** The effective policy for a country as of refDate (default: now). */
export async function getEffectivePolicy(tenantId, countryCode, refDate) {
  if (countryCode == null) return { countryCode: '', restrictedLimit: 0, observedRule: 'NONE', version: null, effectiveFrom: null, effectiveTo: null };
  const refMs = (refDate ? new Date(refDate) : new Date()).getTime();
  const rows = await prisma.holidayPolicy.findMany({
    where: { tenantId, countryCode }, orderBy: { effectiveFrom: 'desc' },
  });
  const row = rows.length ? pickEffective(rows, refMs) : null;
  if (row) return mapPolicy(row);
  const seed = SEED_POLICIES.find((p) => p.countryCode === countryCode);
  return seed
    ? { ...seed, version: 'seed', effectiveFrom: null, effectiveTo: null }
    : { countryCode, restrictedLimit: 0, observedRule: 'NONE', version: 'default', effectiveFrom: null, effectiveTo: null };
}

// Back-compat alias (LIMIT_REACHED check, etc.) — effective as of today.
export const getPolicy = (tenantId, countryCode) => getEffectivePolicy(tenantId, countryCode);

export async function upsertPolicy(tenantId, patch) {
  const open = await prisma.holidayPolicy.findFirst({
    where: { tenantId, countryCode: patch.countryCode }, orderBy: { effectiveFrom: 'desc' },
  });
  const base = open
    ? mapPolicy(open)
    : SEED_POLICIES.find((p) => p.countryCode === patch.countryCode)
      ?? { restrictedLimit: 0, observedRule: 'NONE', version: 'v0' };
  const data = {
    restrictedLimit: patch.restrictedLimit !== undefined ? patch.restrictedLimit : base.restrictedLimit,
    observedRule: patch.observedRule !== undefined ? patch.observedRule : base.observedRule,
  };

  if (patch.effectiveFrom) {
    // §2.4 versioning: close the current open version and create a NEW effective-dated version.
    const ef = new Date(patch.effectiveFrom);
    if (open && (open.effectiveTo == null) && new Date(open.effectiveFrom).getTime() < ef.getTime()) {
      await prisma.holidayPolicy.update({ where: { id: open.id }, data: { effectiveTo: ef } });
    }
    const nextVersion = `v${(parseInt(String(base.version).replace(/\D/g, ''), 10) || 0) + 1}`;
    await prisma.holidayPolicy.create({
      data: { tenantId, countryCode: patch.countryCode, ...data, version: patch.version ?? nextVersion, effectiveFrom: ef },
    });
  } else if (open) {
    // Back-compat: edit the latest version in place (no effective-date change).
    await prisma.holidayPolicy.update({ where: { id: open.id }, data });
  } else {
    // First-ever version for this country → cover all of history (epoch).
    await prisma.holidayPolicy.create({
      data: { tenantId, countryCode: patch.countryCode, ...data, version: 'v1', effectiveFrom: new Date('1970-01-01T00:00:00Z') },
    });
  }
  return getPolicies(tenantId);
}

// ── Optional selections ─────────────────────────────────────────────────────
export async function getSelectionIds(tenantId, employeeId, year) {
  const rows = await prisma.holidayOptionalSelection.findMany({
    where: { tenantId, employeeId, year },
    select: { holidayId: true },
  });
  return rows.map((r) => r.holidayId);
}

async function getHoliday(tenantId, holidayId) {
  const h = await prisma.holiday.findFirst({ where: { tenantId, id: holidayId } });
  if (!h) return null;
  return {
    id: h.id,
    name: h.name,
    holidayDate: new Date(h.holidayDate).toISOString(),
    location: h.location,
    isOptional: h.isOptional,
    createdAt: '',
    updatedAt: '',
  };
}

/** Add a restricted-holiday selection. Validation order: NOT_OPTIONAL → WRONG_COUNTRY →
 *  PAST_HOLIDAY → (idempotent) → LIMIT_REACHED. */
export async function addSelection(tenantId, employeeId, year, holidayId, countryCode = TENANT_DEFAULT_COUNTRY) {
  const holiday = await getHoliday(tenantId, holidayId);
  if (!holiday) throw new HolidaySelectionError('NOT_FOUND', 'Holiday not found.', 404);

  // 1. NOT_OPTIONAL
  if (!holiday.isOptional) {
    throw new HolidaySelectionError('NOT_OPTIONAL', 'This holiday is not marked as optional.');
  }
  // 2. WRONG_COUNTRY
  const applicable = resolveApplicableHolidays([holiday], countryCode);
  if (applicable.length === 0) {
    throw new HolidaySelectionError('WRONG_COUNTRY', 'This holiday is not applicable to the employee\'s country.');
  }
  // 3. PAST_HOLIDAY
  if (holiday.holidayDate.slice(0, 10) < today()) {
    throw new HolidaySelectionError('PAST_HOLIDAY', 'Cannot select a past holiday.');
  }
  // Idempotency
  const current = await getSelectionIds(tenantId, employeeId, year);
  if (current.includes(holidayId)) return current;
  // 4. LIMIT_REACHED (0 = no limit)
  const policy = await getPolicy(tenantId, countryCode);
  if (policy.restrictedLimit > 0 && current.length >= policy.restrictedLimit) {
    throw new HolidaySelectionError('LIMIT_REACHED', `Maximum of ${policy.restrictedLimit} optional holidays already selected.`);
  }
  await prisma.holidayOptionalSelection.create({ data: { tenantId, employeeId, holidayId, year } });
  return getSelectionIds(tenantId, employeeId, year);
}

/** Remove a selection. Throws PAST_HOLIDAY if the holiday is in the past. No-op if absent. */
export async function removeSelection(tenantId, employeeId, holidayId, year) {
  const holiday = await getHoliday(tenantId, holidayId);
  if (holiday && holiday.holidayDate.slice(0, 10) < today()) {
    throw new HolidaySelectionError('PAST_HOLIDAY', 'Cannot remove a past holiday selection.');
  }
  await prisma.holidayOptionalSelection.deleteMany({ where: { tenantId, employeeId, holidayId } });
  return getSelectionIds(tenantId, employeeId, year);
}
