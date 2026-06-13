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
