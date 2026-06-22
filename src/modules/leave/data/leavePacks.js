// Ported VERBATIM from ems-frontend/src/mocks/data/leave-packs.ts (TS types stripped).
// Starter leave policy packs as PURE DATA (spec §8). The engine stays country-agnostic;
// these prove multi-pack resolution + the localize-me fallback. Config-over-code: no branches.

const base = (over) => ({
  leaveYear: { basis: 'CALENDAR' },
  proration: { onJoin: true, onExit: true, basis: 'BY_MONTH' },
  carryForward: { allowed: false },
  yearEnd: 'LAPSE',
  negativeBalance: { allowed: false, convertsToLop: false },
  eligibility: {},
  request: { unit: 'FULL_DAY' },
  sandwichRule: {
    enabled: false,
    scope: 'BETWEEN_LEAVE_DAYS',
    countWeeklyOff: false,
    countHolidays: false,
  },
  noticePeriodLeave: { allowed: true, extendsNotice: false },
  ...over,
});

const pack = (country, rules) => ({
  id: `pack-${country.toLowerCase()}`,
  country,
  version: '2026.1',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  status: 'PUBLISHED',
  applicability: { employmentTypes: [], departmentIds: [] },
  rules,
});

export const LEAVE_STARTER_PACKS = [
  pack('IN', [
    base({
      leaveTypeCode: 'EL',
      grantStyle: 'ACCRUE',
      annualQuota: 18,
      accrual: { frequency: 'MONTHLY', rate: 1.5, cap: 45 },
      carryForward: { allowed: true, cap: 30, expiryMonths: 12 },
      yearEnd: 'CARRY',
      encashment: {
        allowed: true,
        basisTags: ['BASIC', 'DA'],
        divisor: 'DAYS_30',
        trigger: 'EXIT',
      },
    }),
    base({ leaveTypeCode: 'SL', grantStyle: 'UPFRONT', annualQuota: 12 }),
    base({ leaveTypeCode: 'CL', grantStyle: 'UPFRONT', annualQuota: 12 }),
    base({
      leaveTypeCode: 'CO',
      grantStyle: 'EVENT_CREDITED',
      annualQuota: 0,
      compOff: {
        earnTrigger: 'HOLIDAY_WORK',
        creditUnit: 'FULL_DAY',
        rate: 1,
        expiryDays: 90,
        requiresApproval: true,
      },
    }),
  ]),
  pack('US', [
    base({ leaveTypeCode: 'PTO', grantStyle: 'UPFRONT', annualQuota: 15, yearEnd: 'LAPSE' }),
  ]),
  pack('AE', [
    base({
      leaveTypeCode: 'AL',
      grantStyle: 'ACCRUE',
      annualQuota: 30,
      accrual: { frequency: 'MONTHLY', rate: 2.5, cap: 60 },
      carryForward: { allowed: true, cap: 30 },
      yearEnd: 'CARRY',
      encashment: { allowed: true, basisTags: ['BASIC'], divisor: 'DAYS_30', trigger: 'EXIT' },
    }),
    base({ leaveTypeCode: 'SL', grantStyle: 'UPFRONT', annualQuota: 15 }),
  ]),
  pack('GLOBAL', [
    base({ leaveTypeCode: 'AL', grantStyle: 'UPFRONT', annualQuota: 20 }),
    base({ leaveTypeCode: 'SL', grantStyle: 'UPFRONT', annualQuota: 10 }),
    base({
      leaveTypeCode: 'CO',
      grantStyle: 'EVENT_CREDITED',
      annualQuota: 0,
      compOff: {
        earnTrigger: 'HOLIDAY_WORK',
        creditUnit: 'FULL_DAY',
        rate: 1,
        expiryDays: 90,
        requiresApproval: true,
      },
    }),
  ]),
];

export const LEAVE_TYPE_NAMES = {
  EL: 'Earned Leave',
  SL: 'Sick Leave',
  CL: 'Casual Leave',
  PTO: 'Paid Time Off',
  AL: 'Annual Leave',
  CO: 'Comp Off',
};

export function packForCountry(country) {
  return (
    LEAVE_STARTER_PACKS.find((p) => p.country === country) ??
    LEAVE_STARTER_PACKS.find((p) => p.country === 'GLOBAL')
  );
}
