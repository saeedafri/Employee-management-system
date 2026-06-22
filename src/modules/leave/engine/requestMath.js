// Ported VERBATIM from ems-frontend/src/modules/leave/engine/requestMath.ts (TS types stripped).
// Pure function, no I/O. Behavioral oracle: tests/leave-engine-requestMath.test.js.
import { parseISO, eachDayOfInterval, format } from 'date-fns';

const isWorking = (d, work, holidays) =>
  work.includes(d.getDay()) && !holidays.has(format(d, 'yyyy-MM-dd'));

/** Charged leave days for a request, honoring sandwich + holiday/weekend config (spec §5 S-9). */
export function countChargeableDays(i) {
  const days = eachDayOfInterval({ start: parseISO(i.start), end: parseISO(i.end) });
  const holidays = new Set(i.holidays);

  if (i.unit === 'HALF_DAY') {
    return 0.5 * days.filter((d) => isWorking(d, i.workWeekDays, holidays)).length;
  }

  let charged = 0;
  for (const d of days) {
    const working = isWorking(d, i.workWeekDays, holidays);
    if (working) {
      charged += 1;
      continue;
    }
    // Non-working day: charged only when sandwich is enabled and it sits BETWEEN leave days.
    if (i.sandwich.enabled && i.sandwich.scope === 'BETWEEN_LEAVE_DAYS') {
      const dow = d.getDay();
      const isWeeklyOff = !i.workWeekDays.includes(dow);
      const isHoliday = holidays.has(format(d, 'yyyy-MM-dd'));
      if ((isWeeklyOff && i.sandwich.countWeeklyOff) || (isHoliday && i.sandwich.countHolidays)) {
        charged += 1;
      }
    }
  }
  return Math.round(charged * 100) / 100;
}
