// Working-day engine — proves per-entity work-week (incl. UAE Sun-Thu) computes correctly. No DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWorkingDays, parseWorkWeekPattern } from '../src/utils/workingDays.js';

test('parseWorkWeekPattern: abbrev array → day numbers (UAE Sun-Thu)', () => {
  assert.deepEqual(parseWorkWeekPattern(['SUN', 'MON', 'TUE', 'WED', 'THU']), [0, 1, 2, 3, 4]);
});

test('parseWorkWeekPattern: default Mon-Fri when empty/unknown', () => {
  assert.deepEqual(parseWorkWeekPattern(null), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkWeekPattern('MON-FRI'), [1, 2, 3, 4, 5]);
  assert.deepEqual(parseWorkWeekPattern('SUN-THU'), [0, 1, 2, 3, 4]);
});

test('getWorkingDays: India Mon-Fri vs UAE Sun-Thu differ for the same month', () => {
  // March 2026: count Mon-Fri vs Sun-Thu
  const start = '2026-03-01';
  const end = '2026-03-31';
  const monFri = getWorkingDays(new Date(start), new Date(end), parseWorkWeekPattern('MON-FRI'));
  const sunThu = getWorkingDays(new Date(start), new Date(end), parseWorkWeekPattern(['SUN', 'MON', 'TUE', 'WED', 'THU']));
  // Mar 2026: 31 days. Mon-Fri = 22; Sun-Thu = 23 (Fri/Sat off).
  assert.equal(monFri, 22);
  assert.equal(sunThu, 23);
  assert.notEqual(monFri, sunThu); // proves the work-week actually changes the denominator
});
