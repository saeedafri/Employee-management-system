// Ported VERBATIM from ems-frontend/src/modules/leave/engine/accrual.ts (TS types stripped).
// Pure function, no I/O. Behavioral oracle: tests/leave-engine-accrual.test.js.
import { parseISO, isBefore, endOfMonth, format, addMonths, startOfMonth } from 'date-fns';
import { periodFraction } from './proration.js';

/** Pick the highest tenure tier whose minMonths <= tenure; fall back to base rate (spec §3). */
export function resolveAccrualRate(tenureMonths, baseRate, tiers) {
  if (!tiers || tiers.length === 0) return baseRate;
  const sorted = [...tiers].sort((a, b) => a.minMonths - b.minMonths);
  let rate = baseRate;
  for (const tier of sorted) if (tenureMonths >= tier.minMonths) rate = tier.rate;
  return rate;
}

const monthKey = (d) => format(d, 'yyyy-MM');
const round2 = (n) => Math.round(n * 100) / 100;

/** Monthly accrual catch-up within one leave year (year-boundary handled by caller, Task 5). */
export function catchUpAccrual(input) {
  const { accrual } = input;
  if (accrual.frequency !== 'MONTHLY') {
    // QUARTERLY/ANNUAL handled by extending this switch later; out of scope for this unit.
    return { txns: [], watermark: input.watermark };
  }
  const asOf = parseISO(input.asOf);
  const join = parseISO(input.joinDate);
  const firstPeriodStart = isBefore(join, parseISO(input.leaveYearStart))
    ? parseISO(input.leaveYearStart)
    : startOfMonth(join);

  let cursor = input.watermark
    ? startOfMonth(addMonths(parseISO(`${input.watermark}-01`), 1))
    : startOfMonth(firstPeriodStart);

  const txns = [];
  let balance = input.balanceBefore;
  let lastKey = input.watermark;

  for (;;) {
    const periodEnd = endOfMonth(cursor);
    if (!isBefore(periodEnd, asOf)) break; // only fully-elapsed periods (periodEnd < asOf)

    const tenureMonths = monthsBetween(join, cursor);
    // Tiers live on the AccrualConfig (the canonical config home). The top-level
    // input.tiers is a back-compat fallback only — config always wins.
    const rate = resolveAccrualRate(tenureMonths, accrual.rate, accrual.tiers ?? input.tiers);
    const fraction = periodFraction(
      { start: format(cursor, 'yyyy-MM-dd'), end: format(periodEnd, 'yyyy-MM-dd') },
      { joinDate: input.joinDate, exitDate: input.exitDate, basis: input.prorationBasis },
    );
    let accrued = round2(rate * fraction);
    if (accrual.cap !== undefined && balance + accrued > accrual.cap) {
      accrued = round2(Math.max(0, accrual.cap - balance));
    }
    if (accrued > 0) {
      balance += accrued;
      txns.push(mkAccrual(input, accrued, format(periodEnd, 'yyyy-MM-dd')));
    }
    lastKey = monthKey(cursor);
    cursor = startOfMonth(addMonths(cursor, 1));
  }
  return { txns, watermark: lastKey };
}

function monthsBetween(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function mkAccrual(i, delta, effectiveDate) {
  return {
    id: `acc-${i.employeeId}-${i.leaveTypeId}-${effectiveDate}`,
    employeeId: i.employeeId,
    leaveTypeId: i.leaveTypeId,
    policyId: i.policyId,
    policyVersion: i.policyVersion,
    type: 'ACCRUAL',
    delta,
    effectiveDate,
    postedAt: `${effectiveDate}T00:00:00.000Z`,
    leaveYear: parseISO(effectiveDate).getFullYear(),
    reason: `Monthly accrual for ${effectiveDate.slice(0, 7)}`,
    systemGenerated: true,
  };
}
