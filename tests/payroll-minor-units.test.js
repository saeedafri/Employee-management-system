// BE-PAY-1: minor-unit handling must be currency-exponent aware, not hardcoded ÷100.
// Statutory wageCeiling (minorToMajor) + bank-file amount formatting. INR preserved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatutoryContributions } from '../src/utils/statutoryCalculation.js';
import { currencyDecimals, roundMoney } from '../src/utils/money.js';

const earnings = [{ code: 'BASIC', amount: 1000 }];
const componentByCode = new Map([['BASIC', { statutoryTag: 'PF_WAGE' }]]);
const scheme = (wageCeiling) => ({
  code: 'PF', name: 'PF', wageBaseTag: 'PF_WAGE', wageCeiling,
  employee: { rate: 10, component: 'PF_EMP' }, employer: { rate: 10, component: 'PF_ER' },
});
const empAmt = (r) => r.statutoryDeductions.find((d) => d.code === 'PF_EMP')?.amount;

test('KWD (3dp): wageCeiling 500000 minor = 500 major → base capped at 500 → 10% = 50', () => {
  const r = computeStatutoryContributions(earnings, componentByCode, [scheme(500000)], { currency: 'KWD' });
  assert.equal(empAmt(r), 50); // was 100 with the ÷100 bug (ceiling read as 5000, never hit)
});

test('INR (2dp) unchanged — India regression: 500000 minor = 5000 major → ceiling not hit → 100', () => {
  const r = computeStatutoryContributions(earnings, componentByCode, [scheme(500000)], { currency: 'INR' });
  assert.equal(empAmt(r), 100);
});

test('JPY (0dp): wageCeiling 800 minor = 800 major → base capped at 800 → 10% = 80', () => {
  const r = computeStatutoryContributions(earnings, componentByCode, [scheme(800)], { currency: 'JPY' });
  assert.equal(empAmt(r), 80); // was 1 with the ÷100 bug (ceiling read as 8)
});

test('bank-file amount formatting is exponent-aware (KWD 3dp, JPY 0dp, INR 2dp)', () => {
  assert.equal(roundMoney(123.456, 'KWD').toFixed(currencyDecimals('KWD')), '123.456');
  assert.equal(roundMoney(123.456, 'JPY').toFixed(currencyDecimals('JPY')), '123');
  assert.equal(roundMoney(123.456, 'INR').toFixed(currencyDecimals('INR')), '123.46');
});
