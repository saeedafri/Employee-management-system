// BE-PAY-2: leave must charge only working, non-holiday days (not raw calendar days).
// Pure oracle for chargeableDaysBetween. workWeek Mon–Fri = [1,2,3,4,5].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargeableDaysBetween } from '../src/modules/leave/leave.service.js';

const MON_FRI = [1, 2, 3, 4, 5];

test('Mon–Fri span with no holidays = 5', () => {
  assert.equal(chargeableDaysBetween('2026-09-14', '2026-09-18', MON_FRI, new Set()), 5);
});

test('Mon–Fri span containing one public holiday (Wed) = 4', () => {
  assert.equal(chargeableDaysBetween('2026-09-14', '2026-09-18', MON_FRI, new Set(['2026-09-16'])), 4);
});

test('Fri→Mon span = 2 (weekend excluded)', () => {
  assert.equal(chargeableDaysBetween('2026-09-18', '2026-09-21', MON_FRI, new Set()), 2);
});

test('weekend-only span = 0', () => {
  assert.equal(chargeableDaysBetween('2026-09-19', '2026-09-20', MON_FRI, new Set()), 0);
});

test('single working day = 1', () => {
  assert.equal(chargeableDaysBetween('2026-09-14', '2026-09-14', MON_FRI, new Set()), 1);
});

test('respects a Sun–Thu work week (Gulf)', () => {
  // work week Sun(0)–Thu(4); Fri/Sat off. Sun 20 → Thu 24.
  assert.equal(chargeableDaysBetween('2026-09-20', '2026-09-24', [0, 1, 2, 3, 4], new Set()), 5);
  // Fri 25 → Sat 26 are the weekend → 0
  assert.equal(chargeableDaysBetween('2026-09-25', '2026-09-26', [0, 1, 2, 3, 4], new Set()), 0);
});
