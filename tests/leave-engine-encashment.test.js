// Ported from ems-frontend encashment.test.ts (Vitest -> node:test). Pure engine oracle, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEncashment } from '../src/modules/leave/engine/encashment.js';

const cfg = { allowed: true, basisTags: ['BASIC', 'DA'], divisor: 'DAYS_30', trigger: 'EXIT' };

test('Basic+DA / 30 * days (default India norm)', () => {
  const r = computeEncashment({
    config: cfg,
    days: 10,
    componentsByTag: { BASIC: 30000, DA: 6000, HRA: 12000 },
    workingDaysInMonth: 22,
  });
  assert.equal(r.amount, 12000);
  assert.equal(r.days, 10);
});

test('respects maxDays cap', () => {
  const r = computeEncashment({
    config: { ...cfg, maxDays: 5 },
    days: 10,
    componentsByTag: { BASIC: 30000, DA: 6000 },
    workingDaysInMonth: 22,
  });
  assert.equal(r.days, 5);
  assert.equal(r.amount, 6000);
});

test('WORKING_DAYS divisor uses the supplied working-day count', () => {
  const r = computeEncashment({
    config: { ...cfg, divisor: 'WORKING_DAYS' },
    days: 11,
    componentsByTag: { BASIC: 22000 },
    workingDaysInMonth: 22,
  });
  assert.equal(r.amount, 11000);
});
