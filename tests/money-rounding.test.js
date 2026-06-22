// TDD for currency-decimal-aware money rounding (truly-global: no hardcoded 2dp).
// currencyDecimals/sets ported verbatim from ems-frontend money.utils.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currencyDecimals, roundMoney } from '../src/utils/money.js';

test('currencyDecimals: 2-decimal default + 0/3-decimal sets', () => {
  assert.equal(currencyDecimals('INR'), 2);
  assert.equal(currencyDecimals('USD'), 2);
  assert.equal(currencyDecimals('GBP'), 2);
  assert.equal(currencyDecimals('KWD'), 3); // 3-decimal
  assert.equal(currencyDecimals('BHD'), 3);
  assert.equal(currencyDecimals('OMR'), 3);
  assert.equal(currencyDecimals('JPY'), 0); // 0-decimal
  assert.equal(currencyDecimals('KRW'), 0);
  assert.equal(currencyDecimals('XOF'), 0);
  assert.equal(currencyDecimals('ZZZ'), 2); // unknown → default 2
});

test('currencyDecimals is case-insensitive', () => {
  assert.equal(currencyDecimals('kwd'), 3);
  assert.equal(currencyDecimals('jpy'), 0);
});

test('roundMoney rounds to the currency’s minor-unit precision', () => {
  assert.equal(roundMoney(1234.5678, 'INR'), 1234.57); // 2dp
  assert.equal(roundMoney(1234.5678, 'USD'), 1234.57);
  assert.equal(roundMoney(1234.5678, 'KWD'), 1234.568); // 3dp — would be 1234.57 under the old 2dp bug
  assert.equal(roundMoney(1234.5678, 'JPY'), 1235); // 0dp
});

test('roundMoney is float-precision safe', () => {
  assert.equal(roundMoney(0.1 + 0.2, 'INR'), 0.3);
  assert.equal(roundMoney(2.005, 'INR'), 2.01);
});

test('INR regression: roundMoney(x,"INR") === Math.round(x*100)/100 (the old behaviour)', () => {
  for (const x of [0, 1, 99.994, 99.995, 12345.678, 250000.005, 7777.771]) {
    assert.equal(roundMoney(x, 'INR'), Math.round(x * 100) / 100, `mismatch at ${x}`);
  }
});

test('roundMoney defaults to 2dp when currency missing', () => {
  assert.equal(roundMoney(1.239), 1.24);
});
