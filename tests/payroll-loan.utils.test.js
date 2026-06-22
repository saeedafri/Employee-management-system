// Ported oracle for the loan amortization engine. Pure, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEmi, buildSchedule, addMonths } from '../src/modules/payroll/utils/loan.utils.js';

test('ZERO method: principal / tenure', () => {
  assert.equal(computeEmi(120000, 0, 12, 'ZERO'), 10000);
});

test('FLAT method: (principal + flat interest) / tenure', () => {
  // 120000 + 120000*0.10*1 = 132000 / 12 = 11000
  assert.equal(computeEmi(120000, 10, 12, 'FLAT'), 11000);
});

test('REDUCING method: standard amortization EMI', () => {
  // 100000 @ 12% p.a. for 12 months ≈ 8885
  const emi = computeEmi(100000, 12, 12, 'REDUCING');
  assert.ok(Math.abs(emi - 8885) <= 1, `emi=${emi}`);
});

test('buildSchedule: tenure installments, balance reaches 0, last clears remainder', () => {
  const s = buildSchedule(120000, 10, 12, 'FLAT', '2026-07');
  assert.equal(s.length, 12);
  assert.equal(s[0].period, '2026-07');
  assert.equal(s[11].period, '2027-06'); // 2026-07 + 11 months → 2027-06
  assert.equal(s[11].balanceAfter, 0);
  const totalPrincipal = s.reduce((a, e) => a + e.principalComponent, 0);
  assert.equal(totalPrincipal, 120000);
});

test('addMonths rolls over the year', () => {
  assert.equal(addMonths('2026-11', 3), '2027-02');
});
