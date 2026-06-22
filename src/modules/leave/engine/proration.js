// Ported VERBATIM from ems-frontend/src/modules/leave/engine/proration.ts (TS types stripped).
// Pure function, no I/O. Behavioral oracle: tests/leave-engine-proration.test.js.
import { parseISO, differenceInCalendarDays, isAfter, isBefore } from 'date-fns';

const daysInclusive = (a, b) => differenceInCalendarDays(b, a) + 1;

/** Fraction (0..1) of a period the employee is actually present for (spec §5 S-1). */
export function periodFraction(period, p) {
  const pStart = parseISO(period.start);
  const pEnd = parseISO(period.end);
  const join = parseISO(p.joinDate);
  const exit = p.exitDate ? parseISO(p.exitDate) : null;

  // No overlap.
  if (isAfter(join, pEnd)) return 0;
  if (exit && isBefore(exit, pStart)) return 0;

  if (p.basis === 'BY_MONTH') {
    const joinedBeforeOrAtStart = !isAfter(join, pStart);
    const exitedAtOrAfterEnd = !exit || !isBefore(exit, pEnd);
    return joinedBeforeOrAtStart && exitedAtOrAfterEnd ? 1 : partialByDay(period, join, exit);
  }
  return partialByDay(period, join, exit);
}

function partialByDay(period, join, exit) {
  const pStart = parseISO(period.start);
  const pEnd = parseISO(period.end);
  const effStart = isAfter(join, pStart) ? join : pStart;
  const effEnd = exit && isBefore(exit, pEnd) ? exit : pEnd;
  if (isAfter(effStart, effEnd)) return 0;
  return daysInclusive(effStart, effEnd) / daysInclusive(pStart, pEnd);
}
