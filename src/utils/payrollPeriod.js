/**
 * Period string parsing, date derivation, and label formatting.
 * Supports: YYYY-MM (monthly), YYYY-MM-H1/H2 (semi-monthly), YYYY-Wnn (weekly).
 */

/**
 * Regex patterns for all supported period formats.
 */
const RE_MONTHLY = /^(\d{4})-(\d{2})$/;
const RE_SEMI_MONTHLY = /^(\d{4})-(\d{2})-(H1|H2)$/;
const RE_WEEKLY = /^(\d{4})-W(\d{2})$/;

/**
 * Validates whether a period string is in any accepted format AND in range.
 * Accepts: YYYY-MM, YYYY-MM-H1, YYYY-MM-H2, YYYY-Wnn (month 01–12, week 01–53).
 * Rejects: YYYY-MM-Wnn, YYYY-13, YYYY-W00/W54, single-digit month, garbage.
 */
export function isValidPeriod(period) {
  if (!period || typeof period !== 'string') return false;
  const p = parsePeriod(period);
  if (!p) return false;
  if (p.type === 'WEEKLY') return p.week >= 1 && p.week <= 53;
  return p.month >= 1 && p.month <= 12;
}

/**
 * Parse a period string into its components.
 * Returns { year, month?, half?, week?, type } or null if unrecognised.
 */
export function parsePeriod(period) {
  if (!period) return null;
  let m;

  m = RE_SEMI_MONTHLY.exec(period);
  if (m) return { year: Number(m[1]), month: Number(m[2]), half: m[3], type: 'SEMI_MONTHLY' };

  m = RE_WEEKLY.exec(period);
  if (m) return { year: Number(m[1]), week: Number(m[2]), type: 'WEEKLY' };

  m = RE_MONTHLY.exec(period);
  if (m) return { year: Number(m[1]), month: Number(m[2]), type: 'MONTHLY' };

  return null;
}

/**
 * Derive { periodStart: Date, periodEnd: Date } from a PayrollRun-like object.
 * Uses run.startDate / run.endDate if present; falls back to period string derivation.
 * periodEnd is set to 23:59:59.999 local time.
 */
export function derivePeriodDates(run) {
  if (run.startDate && run.endDate) {
    const s = new Date(run.startDate);
    const e = new Date(run.endDate);
    e.setHours(23, 59, 59, 999);
    return { periodStart: s, periodEnd: e };
  }
  return derivePeriodDatesFromString(run.period);
}

/**
 * Derive period dates from a period string alone (no startDate/endDate on run).
 */
export function derivePeriodDatesFromString(period) {
  const parsed = parsePeriod(period);
  if (!parsed) throw new Error(`Unrecognised period format: ${period}`);

  const { year, month, half, type } = parsed;

  if (type === 'SEMI_MONTHLY') {
    if (half === 'H1') {
      return {
        periodStart: new Date(year, month - 1, 1),
        periodEnd: new Date(year, month - 1, 15, 23, 59, 59, 999),
      };
    }
    return {
      periodStart: new Date(year, month - 1, 16),
      periodEnd: new Date(year, month, 0, 23, 59, 59, 999),
    };
  }

  if (type === 'WEEKLY') {
    const { start, end } = isoWeekToDateRange(parsed.year, parsed.week);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { periodStart: start, periodEnd: end };
  }

  // MONTHLY default
  return {
    periodStart: new Date(year, month - 1, 1),
    periodEnd: new Date(year, month, 0, 23, 59, 59, 999),
  };
}

/**
 * Infer the pay schedule from a period string alone.
 * YYYY-MM → MONTHLY, YYYY-MM-H1/H2 → SEMI_MONTHLY.
 * YYYY-Wnn is ambiguous (WEEKLY vs BIWEEKLY) → returns null; caller must supply paySchedule explicitly.
 */
export function inferScheduleFromPeriod(period) {
  const parsed = parsePeriod(period);
  if (!parsed) return null;
  if (parsed.type === 'MONTHLY') return 'MONTHLY';
  if (parsed.type === 'SEMI_MONTHLY') return 'SEMI_MONTHLY';
  return null; // WEEKLY/BIWEEKLY indistinguishable from a YYYY-Wnn string
}

/**
 * Return a single representative Date that lies INSIDE the period — used for
 * effective-dated lookups (e.g. statutory pack resolution) so a sub-monthly
 * period string never produces an Invalid Date.
 * Throws a VALIDATION_ERROR-coded error if the period cannot be resolved.
 */
export function periodRepresentativeDate(period) {
  let dates;
  try {
    dates = derivePeriodDatesFromString(period);
  } catch {
    dates = null;
  }
  if (!dates) {
    const err = new Error(`Unrecognised payroll period: ${period}`);
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 422;
    throw err;
  }
  const { periodStart, periodEnd } = dates;
  return new Date((periodStart.getTime() + periodEnd.getTime()) / 2);
}

/**
 * Human-readable label for a period.
 */
export function formatPeriodLabel(period, startDate, endDate) {
  const parsed = parsePeriod(period);
  if (!parsed) return period;

  if (parsed.type === 'SEMI_MONTHLY') {
    const { year, month, half } = parsed;
    const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' });
    if (half === 'H1') return `1–15 ${monthName} ${year}`;
    const lastDay = new Date(year, month, 0).getDate();
    return `16–${lastDay} ${monthName} ${year}`;
  }

  if (parsed.type === 'WEEKLY') {
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const fmtOpts = { month: 'short', day: 'numeric' };
      return `${s.toLocaleString('en-US', fmtOpts)}–${e.toLocaleString('en-US', { ...fmtOpts, year: 'numeric' })}`;
    }
    return period;
  }

  if (parsed.type === 'MONTHLY') {
    return new Date(parsed.year, parsed.month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }

  return period;
}

/**
 * Advance a period string to the next period.
 * MONTHLY: YYYY-MM → next month.
 * SEMI_MONTHLY: YYYY-MM-H1 → YYYY-MM-H2 → next month's H1.
 * WEEKLY: YYYY-Wnn → YYYY-W(nn+1), handling year rollover.
 */
export function nextPeriod(period) {
  const parsed = parsePeriod(period);
  if (!parsed) return period;

  const { year, month, half, week, type } = parsed;

  if (type === 'SEMI_MONTHLY') {
    if (half === 'H1') return `${year}-${String(month).padStart(2, '0')}-H2`;
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    return `${nextY}-${String(nextM).padStart(2, '0')}-H1`;
  }

  if (type === 'WEEKLY') {
    const weeksThisYear = isoWeeksInYear(year);
    if (week >= weeksThisYear) return `${year + 1}-W01`;
    return `${year}-W${String(week + 1).padStart(2, '0')}`;
  }

  // MONTHLY
  const nextM = month === 12 ? 1 : month + 1;
  const nextY = month === 12 ? year + 1 : year;
  return `${nextY}-${String(nextM).padStart(2, '0')}`;
}

/**
 * Return the YYYY-MM base month for any period string.
 * Used for fiscal-year string comparisons and YTD filters.
 * Semi-monthly: "2026-06-H1" → "2026-06"
 * Weekly: "2026-W23" → approximated from ISO week start date
 */
export function periodToMonthKey(period) {
  const parsed = parsePeriod(period);
  if (!parsed) return period.substring(0, 7);

  if (parsed.type === 'SEMI_MONTHLY' || parsed.type === 'MONTHLY') {
    return `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
  }

  if (parsed.type === 'WEEKLY') {
    const { start } = isoWeekToDateRange(parsed.year, parsed.week);
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  }

  return period.substring(0, 7);
}

/**
 * Determine whether this period is the last cycle in its calendar month.
 * SEMI_MONTHLY: H2 is always last.
 * MONTHLY: always true (only one cycle).
 * BIWEEKLY/WEEKLY: requires knowing total cycles in the month — returns false (safe default).
 */
export function isLastCycleInMonth(period) {
  const parsed = parsePeriod(period);
  if (!parsed) return true;
  if (parsed.type === 'MONTHLY') return true;
  if (parsed.type === 'SEMI_MONTHLY') return parsed.half === 'H2';
  return false; // BIWEEKLY/WEEKLY: caller must determine dynamically
}

// ── ISO week helpers ──────────────────────────────────────────────────────────

function isoWeeksInYear(year) {
  const dec28 = new Date(year, 11, 28);
  return getISOWeek(dec28);
}

export function getISOWeek(d) {
  const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
  const jan1Day = new Date(d.getFullYear(), 0, 1).getDay() || 7;
  return Math.ceil((dayOfYear + jan1Day - 1) / 7);
}

function isoWeekToDateRange(year, week) {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - jan4Day + 1 + (week - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return { start: weekStart, end: weekEnd };
}
