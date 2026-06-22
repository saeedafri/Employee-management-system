/**
 * Working day counter with configurable work-week pattern.
 * Default: Mon–Fri (ISO days 1–5; 0=Sun, 6=Sat).
 * Pattern is an array of JS day-of-week numbers (0=Sun, 1=Mon … 6=Sat).
 */
export function getWorkingDays(start, end, workWeekPattern = [1, 2, 3, 4, 5]) {
  const workSet = new Set(workWeekPattern);
  let count = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(23, 59, 59, 999);
  while (cur <= endDay) {
    if (workSet.has(cur.getDay())) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Parse a work-week pattern string into a JS day-of-week array.
 * Accepted formats: "MON-FRI", "MON-SAT", "SUN-THU", array of 3-letter abbreviations.
 * Returns [1,2,3,4,5] (Mon–Fri) as the default.
 */
const DAY_MAP = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

export function parseWorkWeekPattern(pattern) {
  if (!pattern) return [1, 2, 3, 4, 5];

  if (typeof pattern === 'string' && pattern.includes('-')) {
    const [startDay, endDay] = pattern.split('-').map((d) => DAY_MAP[d.toUpperCase()]);
    if (startDay == null || endDay == null) return [1, 2, 3, 4, 5];
    const days = [];
    for (let d = startDay; d !== (endDay + 1) % 7; d = (d + 1) % 7) {
      days.push(d);
      if (days.length > 7) break;
    }
    return days;
  }

  if (Array.isArray(pattern)) {
    return pattern
      .map((d) => (typeof d === 'number' ? d : DAY_MAP[String(d).toUpperCase()]))
      .filter((d) => d != null && d >= 0 && d <= 6);
  }

  return [1, 2, 3, 4, 5];
}

// JS day-of-week index (0=Sun .. 6=Sat) → 3-letter token.
export const DAY_TOKENS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/**
 * Resolve a tenant/entity work-week to an ordered JS day-of-week array (0=Sun..6=Sat).
 * Prefers the fine-grained `workWeekDays` (array of tokens or numbers) over the coarse
 * `workWeekPattern` string; falls back to Mon–Fri. Mirrors payroll's resolution order so
 * non-payroll modules (attendance grid, timesheets week-start) stay consistent.
 */
export function resolveWorkWeekDays(workWeekDays, workWeekPattern) {
  if (Array.isArray(workWeekDays) && workWeekDays.length > 0) {
    const days = parseWorkWeekPattern(workWeekDays);
    if (days.length > 0) return days;
  }
  return parseWorkWeekPattern(workWeekPattern);
}

// Ordered JS day numbers → 3-letter tokens (e.g. [0,1,2,3,4] → ['SUN',...,'THU']).
export function toDayTokens(days) {
  return (days || []).map((d) => DAY_TOKENS[d]).filter(Boolean);
}

// The week-start day (0=Sun..6=Sat) for a work-week = its first working day in order.
// SUN-THU → 0 (Sun); MON-FRI/MON-SAT → 1 (Mon). Falls back to Monday.
export function weekStartDayFromDays(days) {
  return Array.isArray(days) && days.length > 0 ? days[0] : 1;
}
