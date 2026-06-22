// Ported from ems-frontend accrual.test.ts (Vitest -> node:test). Pure engine oracle, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAccrualRate, catchUpAccrual } from '../src/modules/leave/engine/accrual.js';

const tiers = [
  { minMonths: 0, rate: 1.25 },
  { minMonths: 60, rate: 1.75 },
];

test('resolveAccrualRate: picks the highest tier whose minMonths <= tenure', () => {
  assert.equal(resolveAccrualRate(12, 1.25, tiers), 1.25);
  assert.equal(resolveAccrualRate(60, 1.25, tiers), 1.75);
  assert.equal(resolveAccrualRate(72, 1.25, tiers), 1.75);
});

test('resolveAccrualRate: falls back to base rate when no tiers', () => {
  assert.equal(resolveAccrualRate(99, 1.5, undefined), 1.5);
});

test('catchUpAccrual: materializes one ACCRUAL per elapsed month up to asOf and respects cap', () => {
  const accrual = { frequency: 'MONTHLY', rate: 1.5, cap: 10 };
  const r = catchUpAccrual({
    employeeId: 'e1',
    leaveTypeId: 'EL',
    policyId: 'p',
    policyVersion: '1',
    accrual,
    joinDate: '2026-01-01',
    exitDate: null,
    prorationBasis: 'BY_MONTH',
    leaveYearStart: '2026-01-01',
    watermark: null,
    asOf: '2026-08-15', // Jan..Jul ended = 7 periods
    balanceBefore: 0,
    tiers: undefined,
  });
  const total = r.txns.reduce((s, x) => s + x.delta, 0);
  assert.ok(r.txns.every((x) => x.type === 'ACCRUAL'));
  assert.equal(total, 10); // 7 * 1.5 = 10.5 → capped at 10
  assert.equal(r.watermark, '2026-07');
});
