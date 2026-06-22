// Pure budget classification oracle (ported from FE budgetMath). No DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyBudget } from '../src/modules/timesheets/utils/budgetMath.js';

test('cap <= 0 → OK, no burn', () => {
  assert.deepEqual(classifyBudget(0, 50, 80), { burnPct: 0, status: 'OK', remaining: 0 });
});

test('under warn threshold → OK', () => {
  const r = classifyBudget(100, 50, 80);
  assert.equal(r.status, 'OK');
  assert.equal(r.burnPct, 50);
  assert.equal(r.remaining, 50);
});

test('at/over warn threshold but under cap → AT_RISK', () => {
  const r = classifyBudget(100, 85, 80);
  assert.equal(r.status, 'AT_RISK');
  assert.equal(r.burnPct, 85);
});

test('at/over cap → OVER with negative remaining', () => {
  const r = classifyBudget(100, 120, 80);
  assert.equal(r.status, 'OVER');
  assert.equal(r.remaining, -20);
});
