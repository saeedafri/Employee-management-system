// Ported from ems-frontend observedDates.test.ts (Vitest -> node:test). Pure engine oracle, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observedDate } from '../src/modules/holidays/utils/observedDates.js';

const MON_FRI = [1, 2, 3, 4, 5];
const SUN_THU = [0, 1, 2, 3, 4]; // UAE

test('working day → no shift for any rule', () => {
  assert.equal(observedDate('2026-01-07', MON_FRI, 'NONE'), '2026-01-07');
  assert.equal(observedDate('2026-01-07', MON_FRI, 'NEXT_WORKING_DAY'), '2026-01-07');
  assert.equal(observedDate('2026-01-07', MON_FRI, 'NEAREST_WORKING_DAY'), '2026-01-07');
});

test('NONE rule: non-working day returned as-is', () => {
  assert.equal(observedDate('2026-01-04', MON_FRI, 'NONE'), '2026-01-04');
  assert.equal(observedDate('2026-01-03', MON_FRI, 'NONE'), '2026-01-03');
});

test('empty workingDows guard → input unchanged', () => {
  assert.equal(observedDate('2026-01-04', [], 'NEXT_WORKING_DAY'), '2026-01-04');
  assert.equal(observedDate('2026-01-03', [], 'NEAREST_WORKING_DAY'), '2026-01-03');
});

test('NEXT_WORKING_DAY: Sunday → following Monday', () => {
  assert.equal(observedDate('2026-01-04', MON_FRI, 'NEXT_WORKING_DAY'), '2026-01-05');
});

test('NEXT_WORKING_DAY: Saturday → following Monday (skips Sunday)', () => {
  assert.equal(observedDate('2026-01-03', MON_FRI, 'NEXT_WORKING_DAY'), '2026-01-05');
});

test('NEAREST_WORKING_DAY: Saturday → previous Friday (backward wins)', () => {
  assert.equal(observedDate('2026-01-03', MON_FRI, 'NEAREST_WORKING_DAY'), '2026-01-02');
});

test('NEAREST_WORKING_DAY: Sunday → next Monday', () => {
  assert.equal(observedDate('2026-01-04', MON_FRI, 'NEAREST_WORKING_DAY'), '2026-01-05');
});

test('full ISO string input uses date-only slice (no TZ shift)', () => {
  assert.equal(observedDate('2026-08-15T00:00:00.000Z', MON_FRI, 'NONE'), '2026-08-15');
  assert.equal(observedDate('2026-08-15T00:00:00.000Z', MON_FRI, 'NEAREST_WORKING_DAY'), '2026-08-14');
});

test('UAE SUN_THU NEAREST_WORKING_DAY: Friday → previous Thursday', () => {
  assert.equal(observedDate('2026-01-09', SUN_THU, 'NEAREST_WORKING_DAY'), '2026-01-08');
});
