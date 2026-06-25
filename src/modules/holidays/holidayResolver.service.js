// ── Shared Holiday Applicability Engine (HOLIDAY_ENGINE_BACKEND_CONTRACT) ────────────
// ONE resolution path consumed by the per-employee endpoint, leave (chargeable days),
// payroll (holiday count), and attendance (day classification) — so a holiday can never
// be a working day in one module and a day off in another (contract §3).
//
// Config-over-code (contract §4): country behaviour comes entirely from data — the
// employee's resolved country (salary→legalEntity), the per-country HolidayPolicy
// (observedRule / restrictedLimit) and the work-week. There is NO `if (country === …)`.
import { resolveApplicableHolidays } from './utils/applicability.js';
import { observedDate } from './utils/observedDates.js';
import { getEffectivePolicy } from './holidaysPolicy.service.js';
import { resolveWorkWeekDays } from '../../utils/workingDays.js';

const isoDay = (v) => new Date(v).toISOString().slice(0, 10); // UTC yyyy-mm-dd
const atMidnightUTC = (ymd) => `${ymd}T00:00:00.000Z`;

/**
 * PURE. Given raw Holiday rows + a resolved employee context, produce the fully-resolved
 * holiday set with the load-bearing metadata the FE renders (contract §1–§2):
 *   holidayDate = observed/effective date the employee is actually off
 *   actualDate  = original date (only when shifted), else null
 *   observed    = was this row shifted to a working day
 *   isOptional / selected = restricted-holiday picker state
 *   countryCode = source country (null = tenant-wide, applies everywhere)
 *
 * @param {Array} holidays  raw rows: { id, name, holidayDate, location, isOptional }
 * @param {object} ctx { countryCode, workWeekDays(JS dow 0-6), observedRule, selectedOptionalIds }
 */
export function buildResolvedHolidays(holidays, ctx = {}) {
  const {
    countryCode = null,
    workWeekDays = [1, 2, 3, 4, 5],
    observedRule = 'NONE',
    selectedOptionalIds = [],
  } = ctx;

  // §2 country scoping: tenant-wide rows (location null) apply to EVERY country. When the
  // employee's country is unresolved we return tenant-wide ONLY (contract §5/§6), never "all".
  const scoped = countryCode == null
    ? holidays.filter((h) => h.location == null)
    : resolveApplicableHolidays(holidays, countryCode); // keeps tenant-wide + country matches

  const selected = new Set(selectedOptionalIds);

  return scoped
    .map((h) => {
      const original = isoDay(h.holidayDate);
      const effective = observedDate(original, workWeekDays, observedRule); // §2 observed shift
      const shifted = effective !== original;
      const isOptional = !!h.isOptional;
      return {
        id: h.id,
        name: h.name,
        holidayDate: atMidnightUTC(effective),
        actualDate: shifted ? atMidnightUTC(original) : null,
        observed: shifted,
        isOptional,
        // mandatory rows always apply; optional rows apply only when the employee picked them.
        selected: isOptional ? selected.has(h.id) : true,
        countryCode: h.location == null ? null : countryCode,
        location: h.location ?? null,
      };
    })
    .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate));
}

/** PURE. Effective (observed) dates the employee is actually off — mandatory + selected optional.
 *  This is the single Set leave / payroll / attendance intersect against (contract §3). */
export function offDateSet(resolvedHolidays) {
  return new Set(resolvedHolidays.filter((h) => h.selected).map((h) => h.holidayDate.slice(0, 10)));
}

// ── DB-backed resolution ────────────────────────────────────────────────────────────

/** Resolve an employee's country + work-week + policy. Mirrors payroll's salary→legalEntity
 *  chain so holiday country == payroll country. Falls back to tenant work-week; country stays
 *  null (→ tenant-wide only) when it cannot be resolved. */
export async function resolveEmployeeHolidayContext(prisma, tenantId, employeeId, refDate) {
  let countryCode = null;
  let workWeekDays = null;
  let resolvedBy = 'TENANT_WIDE';
  // timezone + hoursPerDay are additive: BE-1 attendance calendar resolves "today" in the
  // employee's timezone and the full-day minutes basis from the same entity→tenant chain.
  let timezone = null;
  let hoursPerDay = null;

  if (employeeId) {
    const sal = await prisma.employeeSalary.findFirst({
      where: { tenantId, employeeId },
      orderBy: { effectiveFrom: 'desc' },
      select: { legalEntityId: true, country: true },
    });
    let le = null;
    if (sal?.legalEntityId) {
      le = await prisma.legalEntity.findFirst({
        where: { id: sal.legalEntityId, tenantId },
        select: {
          country: true, workWeekDays: true, workWeekPattern: true, timezone: true, hoursPerDay: true,
        },
      });
      if (le) resolvedBy = 'LEGAL_ENTITY';
    } else if (sal?.country) {
      le = await prisma.legalEntity.findFirst({
        where: { tenantId, country: sal.country, active: true },
        orderBy: { createdAt: 'asc' },
        select: {
          country: true, workWeekDays: true, workWeekPattern: true, timezone: true, hoursPerDay: true,
        },
      });
      resolvedBy = le ? 'LEGAL_ENTITY' : 'SALARY_COUNTRY';
    }
    if (le) {
      countryCode = le.country;
      workWeekDays = resolveWorkWeekDays(le.workWeekDays, le.workWeekPattern);
      timezone = le.timezone || null;
      hoursPerDay = le.hoursPerDay ?? null;
    } else if (sal?.country) {
      countryCode = sal.country;
    }
  }

  if (!workWeekDays || !timezone) {
    const tc = await prisma.tenantConfig.findUnique({
      where: { tenantId },
      select: { workWeekDays: true, workWeekPattern: true, timezone: true },
    });
    if (!workWeekDays) workWeekDays = resolveWorkWeekDays(tc?.workWeekDays, tc?.workWeekPattern);
    if (!timezone) timezone = tc?.timezone || 'UTC';
  }

  let observedRule = 'NONE';
  let restrictedLimit = 0;
  let policyVersion = null;
  if (countryCode) {
    // §2.4 — the policy VERSION effective at refDate (default now). Config-over-code.
    const pol = await getEffectivePolicy(tenantId, countryCode, refDate);
    observedRule = pol.observedRule;
    restrictedLimit = pol.restrictedLimit;
    policyVersion = pol.version;
  }

  return {
    countryCode, workWeekDays, observedRule, restrictedLimit, resolvedBy, policyVersion, timezone, hoursPerDay,
  };
}

async function rawHolidaysBetween(prisma, tenantId, startISO, endISO) {
  return prisma.holiday.findMany({
    where: { tenantId, holidayDate: { gte: new Date(startISO), lte: new Date(endISO) } },
    select: { id: true, name: true, holidayDate: true, location: true, isOptional: true },
    orderBy: { holidayDate: 'asc' },
  });
}

/** Fully-resolved per-employee holiday set for a calendar year (the engine endpoint). */
export async function resolveEmployeeHolidays(prisma, tenantId, { employeeId, year }) {
  const y = Number(year) || new Date().getUTCFullYear();
  // §2.4 — pick the policy version effective in the requested year.
  const ctx = await resolveEmployeeHolidayContext(prisma, tenantId, employeeId, `${y}-06-30`);
  const holidays = await rawHolidaysBetween(prisma, tenantId, `${y}-01-01`, `${y}-12-31`);
  const selections = employeeId
    ? await prisma.holidayOptionalSelection.findMany({
      where: { tenantId, employeeId, year: y }, select: { holidayId: true },
    })
    : [];
  const resolved = buildResolvedHolidays(holidays, {
    countryCode: ctx.countryCode,
    workWeekDays: ctx.workWeekDays,
    observedRule: ctx.observedRule,
    selectedOptionalIds: selections.map((s) => s.holidayId),
  });
  return { holidays: resolved, total: resolved.length, context: ctx };
}

/** The SHARED §3 primitive: effective holiday dates an employee is off within [from,to],
 *  plus the resolved work-week. Leave/payroll/attendance all call THIS. Observed shifting can
 *  move a date up to 14d, so we widen the raw query window then clip to [from,to]. */
export async function resolveHolidayDateSet(prisma, tenantId, { employeeId, from, to }) {
  const ctx = await resolveEmployeeHolidayContext(prisma, tenantId, employeeId, from);
  const fromISO = isoDay(from);
  const toISO = isoDay(to);
  const widen = (d, days) => { const x = new Date(`${d}T00:00:00.000Z`); x.setUTCDate(x.getUTCDate() + days); return x.toISOString().slice(0, 10); };
  const holidays = await rawHolidaysBetween(prisma, tenantId, widen(fromISO, -14), widen(toISO, 14));

  let selectedOptionalIds = [];
  if (employeeId) {
    const years = new Set([Number(fromISO.slice(0, 4)), Number(toISO.slice(0, 4))]);
    const sels = await prisma.holidayOptionalSelection.findMany({
      where: { tenantId, employeeId, year: { in: [...years] } }, select: { holidayId: true },
    });
    selectedOptionalIds = sels.map((s) => s.holidayId);
  }
  const resolved = buildResolvedHolidays(holidays, {
    countryCode: ctx.countryCode,
    workWeekDays: ctx.workWeekDays,
    observedRule: ctx.observedRule,
    selectedOptionalIds,
  });
  const inRange = resolved.filter((hh) => {
    const d = hh.holidayDate.slice(0, 10);
    return hh.selected && d >= fromISO && d <= toISO;
  });
  const clipped = new Set(inRange.map((hh) => hh.holidayDate.slice(0, 10)));
  return { dates: clipped, holidays: inRange, workWeekDays: ctx.workWeekDays, context: ctx };
}
