// BE-PAY-3: statutory pack `rounding` {mode, precision} is now read and applied. No config →
// legacy whole-major-unit Math.round (INR unchanged). Precision is currency-exponent aware.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundWith,
  resolveRounding,
  computeStatutoryContributions,
  computeIncomeTaxFromRegime,
} from '../src/utils/statutoryCalculation.js';

test('roundWith(null,...) === Math.round — legacy whole-unit default (INR regression)', () => {
  for (const x of [0, 1, 99.4, 99.5, 100.05, 1799.5, 12345.678, 250000.005]) {
    assert.equal(roundWith(null, 0, x), Math.round(x), `mismatch at ${x}`);
  }
});

test('roundWith NEAREST precision 0 stays byte-identical to Math.round (India precision:0 pack)', () => {
  for (const x of [0, 1800, 1799.5, 100.05, 12345.4, 12345.6]) {
    assert.equal(roundWith('NEAREST', 0, x), Math.round(x), `mismatch at ${x}`);
  }
});

test('roundWith honours mode + precision', () => {
  assert.equal(roundWith('NEAREST', 2, 100.056), 100.06);
  assert.equal(roundWith('DOWN', 2, 1.239), 1.23);
  assert.equal(roundWith('UP', 2, 1.231), 1.24);
  assert.equal(roundWith('NEAREST', 3, 1234.5678), 1234.568); // 3dp
});

test('resolveRounding clamps precision to the currency ISO-4217 minor-unit digits', () => {
  assert.deepEqual(resolveRounding(null, 'INR'), { mode: null, precision: 0 });
  assert.deepEqual(resolveRounding({ mode: 'NEAREST', precision: 0 }, 'INR'), { mode: 'NEAREST', precision: 0 });
  assert.equal(resolveRounding({ mode: 'NEAREST', precision: 5 }, 'INR').precision, 2); // clamped to 2dp
  assert.equal(resolveRounding({ mode: 'NEAREST', precision: 5 }, 'KWD').precision, 3); // 3dp currency
  assert.equal(resolveRounding({ mode: 'NEAREST', precision: 5 }, 'JPY').precision, 0); // 0dp currency
});

const earnings = [{ code: 'BASIC', amount: 1000.5 }];
const byCode = new Map([['BASIC', { statutoryTag: 'PF_WAGE' }]]);
const scheme = { code: 'PF', wageBaseTag: 'PF_WAGE', employee: { rate: 10, component: 'PF_EMP' }, employer: { rate: 10, component: 'PF_ER' } };
const empAmt = (r) => r.statutoryDeductions.find((d) => d.code === 'PF_EMP')?.amount;

test('computeStatutoryContributions: no rounding config → legacy whole-unit round (unchanged)', () => {
  const r = computeStatutoryContributions(earnings, byCode, [scheme], { currency: 'INR' });
  assert.equal(empAmt(r), 100); // Math.round(100.05)
});

test('computeStatutoryContributions: rounding {NEAREST,2} keeps 2 decimals', () => {
  const r = computeStatutoryContributions(earnings, byCode, [scheme], { currency: 'KWD', rounding: { mode: 'NEAREST', precision: 2 } });
  assert.equal(empAmt(r), 100.05); // 10% of 1000.5, kept at 2dp
});

const regime = { slabs: [{ from: 0, to: null, rate: 10 }], standardDeduction: 0 };

test('computeIncomeTaxFromRegime: no rounding config → whole-unit round (INR unchanged)', () => {
  assert.equal(computeIncomeTaxFromRegime(1234.56, regime, 'INR'), 123); // Math.round(123.456)
  assert.equal(computeIncomeTaxFromRegime(1234.56, regime, 'INR', { mode: 'NEAREST', precision: 0 }), 123);
});

test('computeIncomeTaxFromRegime: rounding {NEAREST,2} keeps 2 decimals', () => {
  assert.equal(computeIncomeTaxFromRegime(1234.56, regime, 'USD', { mode: 'NEAREST', precision: 2 }), 123.46);
});
