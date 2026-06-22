// Sub-monthly per-cycle share + apportionment math (the core of SUBMONTHLY defects Bug 1 & 2). No DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodsPerYear, periodsPerMonth } from '../src/utils/payFrequency.js';

test('periodsPerYear is data-driven (no frequency branches)', () => {
  assert.equal(periodsPerYear('MONTHLY'), 12);
  assert.equal(periodsPerYear('SEMI_MONTHLY'), 24);
  assert.equal(periodsPerYear('BIWEEKLY'), 26);
  assert.equal(periodsPerYear('WEEKLY'), 52);
});

test('per-cycle FLAT factor = 12/ppy — MONTHLY unchanged, sub-monthly shares the month (Bug 1)', () => {
  const factor = (s) => 12 / periodsPerYear(s);
  assert.equal(factor('MONTHLY'), 1); // byte-identical to today
  assert.equal(factor('SEMI_MONTHLY'), 0.5); // ₱100,000 → ₱50,000/cycle
  // a FLAT BASIC of 100000 on a semi-monthly group pays 50000 per cycle, summing to 100000/month
  assert.equal(100000 * factor('SEMI_MONTHLY') * 2, 100000);
});

test('periodsPerMonth drives monthly-cap apportionment (Bug 2)', () => {
  assert.equal(periodsPerMonth('MONTHLY'), 1);
  assert.equal(periodsPerMonth('SEMI_MONTHLY'), 2); // monthly cap split across 2 cycles
});
