/** Pay frequency utilities — periodsPerYear, periodsPerMonth, schedule validation. */

const PERIODS_PER_YEAR_MAP = {
  MONTHLY: 12,
  SEMI_MONTHLY: 24,
  BIWEEKLY: 26,
  WEEKLY: 52,
};

export const VALID_PAY_SCHEDULES = Object.keys(PERIODS_PER_YEAR_MAP);

/** Returns exact periods per year for a given pay schedule. Defaults to 12. */
export function periodsPerYear(paySchedule) {
  return PERIODS_PER_YEAR_MAP[paySchedule] ?? 12;
}

/**
 * Returns the typical number of cycles per calendar month.
 * MONTHLY=1, SEMI_MONTHLY=2, BIWEEKLY=2 (approx — actual months may have 3),
 * WEEKLY=4 (approx — actual months may have 5).
 */
export function periodsPerMonth(paySchedule) {
  return Math.round((PERIODS_PER_YEAR_MAP[paySchedule] ?? 12) / 12);
}

/**
 * Count the number of biweekly (or weekly) cycles whose startDate falls in the given month.
 * Used to determine accurate periodsPerMonth for contribution apportionment.
 * startDates: array of Date objects representing cycle start dates in the month.
 */
export function countCyclesInMonth(startDates, year, month) {
  if (!startDates || startDates.length === 0) return 2;
  return startDates.filter((d) => d.getFullYear() === year && d.getMonth() + 1 === month).length;
}

/** Step (in days) between cycle starts for a fixed-length schedule. */
const SCHEDULE_STEP_DAYS = { BIWEEKLY: 14, WEEKLY: 7 };

export function scheduleStepDays(paySchedule) {
  return SCHEDULE_STEP_DAYS[paySchedule] ?? null;
}

/**
 * Determine the ACTUAL number of fixed-length cycles whose start falls in the same
 * calendar month as `startDate`, walking the cycle grid anchored on startDate itself.
 *
 * For BIWEEKLY this returns 2 or 3 depending on the month; for WEEKLY, 4 or 5.
 * Returns { count, index, isLast } where:
 *   count  — number of cycle starts in the month
 *   index  — 0-based position of this cycle among them
 *   isLast — true when this is the last cycle start in the month (absorbs rounding remainder)
 *
 * Deterministic from startDate alone — needs no stored pay calendar. This fixes the
 * MONTHLY_TOTAL over-deduction in 3-cycle biweekly months.
 */
export function cyclesInMonthFromAnchor(startDate, stepDays) {
  if (!startDate || !stepDays) return { count: 1, index: 0, isLast: true };
  const anchor = new Date(startDate);
  anchor.setHours(0, 0, 0, 0);
  const y = anchor.getFullYear();
  const m = anchor.getMonth();

  // Walk back to the earliest cycle start still inside this calendar month.
  let first = new Date(anchor);
  for (;;) {
    const prev = new Date(first);
    prev.setDate(prev.getDate() - stepDays);
    if (prev.getFullYear() === y && prev.getMonth() === m) first = prev;
    else break;
  }

  // Walk forward collecting every cycle start inside the month.
  const starts = [];
  let cur = new Date(first);
  while (cur.getFullYear() === y && cur.getMonth() === m) {
    starts.push(new Date(cur));
    cur.setDate(cur.getDate() + stepDays);
  }

  const index = starts.findIndex((d) => d.getTime() === anchor.getTime());
  const safeIndex = index < 0 ? starts.length - 1 : index;
  return { count: starts.length, index: safeIndex, isLast: safeIndex === starts.length - 1 };
}
