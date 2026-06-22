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

const mapPolicy = (p) => ({
  countryCode: p.countryCode,
  restrictedLimit: p.restrictedLimit,
  observedRule: p.observedRule,
});

// ── Policy ────────────────────────────────────────────────────────────────────
export async function getPolicies(tenantId) {
  const rows = await prisma.holidayPolicy.findMany({ where: { tenantId }, orderBy: { countryCode: 'asc' } });
  if (rows.length === 0) return SEED_POLICIES.map((p) => ({ ...p }));
  return rows.map(mapPolicy);
}

export async function getPolicy(tenantId, countryCode) {
  if (countryCode == null) return { countryCode: '', restrictedLimit: 0, observedRule: 'NONE' };
  const row = await prisma.holidayPolicy.findFirst({ where: { tenantId, countryCode } });
  if (row) return mapPolicy(row);
  const seed = SEED_POLICIES.find((p) => p.countryCode === countryCode);
  return seed ? { ...seed } : { countryCode, restrictedLimit: 0, observedRule: 'NONE' };
}

export async function upsertPolicy(tenantId, patch) {
  const existing = await prisma.holidayPolicy.findFirst({ where: { tenantId, countryCode: patch.countryCode } });
  const base = existing
    ? mapPolicy(existing)
    : SEED_POLICIES.find((p) => p.countryCode === patch.countryCode) ?? {
      countryCode: patch.countryCode,
      restrictedLimit: 0,
      observedRule: 'NONE',
    };
  const data = {
    restrictedLimit: patch.restrictedLimit !== undefined ? patch.restrictedLimit : base.restrictedLimit,
    observedRule: patch.observedRule !== undefined ? patch.observedRule : base.observedRule,
  };
  await prisma.holidayPolicy.upsert({
    where: { tenantId_countryCode: { tenantId, countryCode: patch.countryCode } },
    create: { tenantId, countryCode: patch.countryCode, ...data },
    update: data,
  });
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
