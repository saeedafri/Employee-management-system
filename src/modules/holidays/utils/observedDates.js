// Ported VERBATIM from ems-frontend/src/modules/holidays/utils/observedDates.ts (TS types stripped).
// Pure, total, never-throws engine for observed/substitute holiday dates. No country branches —
// all policy via `rule` + `workingDows`. Behavioral oracle: tests/holiday-observedDates.test.js.
import { addDays, format, parseISO } from 'date-fns';

const MAX_RADIUS = 14;

/** Effective non-working date for a public holiday under a country's observed rule. */
export function observedDate(holidayDateISO, workingDows, rule) {
  const start = parseISO(holidayDateISO.slice(0, 10));
  const dow = start.getDay();

  // Guards: empty work week, already a working day, or NONE → return unchanged.
  if (workingDows.length === 0 || workingDows.includes(dow) || rule === 'NONE') {
    return format(start, 'yyyy-MM-dd');
  }

  if (rule === 'NEXT_WORKING_DAY') {
    for (let k = 1; k <= MAX_RADIUS; k++) {
      const candidate = addDays(start, k);
      if (workingDows.includes(candidate.getDay())) {
        return format(candidate, 'yyyy-MM-dd');
      }
    }
    return format(start, 'yyyy-MM-dd');
  }

  // NEAREST_WORKING_DAY: expand outward, backward candidate first (US-federal convention).
  for (let d = 1; d <= MAX_RADIUS; d++) {
    const backward = addDays(start, -d);
    if (workingDows.includes(backward.getDay())) {
      return format(backward, 'yyyy-MM-dd');
    }
    const forward = addDays(start, d);
    if (workingDows.includes(forward.getDay())) {
      return format(forward, 'yyyy-MM-dd');
    }
  }
  return format(start, 'yyyy-MM-dd');
}
