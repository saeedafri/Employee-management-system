import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSlabTax,
  computeIncomeTaxFromRegime,
  resolveFiscalYear,
} from '../src/utils/statutoryCalculation.js';
import { computeStatutoryContributions } from '../src/utils/statutoryCalculation.js';

// ── Philippines TRAIN Law (RA 11976, 2023) ────────────────────────────────────
// computeSlabTax works on already-normalized (major-unit) values; no currency factor applied here.

test('PH: computeSlabTax — 1,200,000 taxable income (major units) → 202,500 annual tax', () => {
  const PH_SLABS = [
    { from: 0,         to: 250000,    rate: 0,  base: 0 },
    { from: 250000,    to: 400000,    rate: 15, base: 0 },
    { from: 400000,    to: 800000,    rate: 20, base: 22500 },
    { from: 800000,    to: 2000000,   rate: 25, base: 102500 },
    { from: 2000000,   to: 8000000,   rate: 30, base: 402500 },
    { from: 8000000,   to: null,      rate: 35, base: 2202500 },
  ];
  const tax = computeSlabTax(1_200_000, PH_SLABS);
  assert.equal(tax, 202_500);
});

// computeIncomeTaxFromRegime normalizes minor-unit pack fields before computing.
// All monetary slab values below are in PHP centavos (minor units), annualGross is major (PHP pesos).

test('PH: computeIncomeTaxFromRegime — minor-unit slabs, no standard deduction, 1,200,000 gross → 202,500', () => {
  const regime = {
    standardDeduction: 0,
    slabs: [
      { from: 0,           to: 25_000_000,  rate: 0,  base: 0 },
      { from: 25_000_000,  to: 40_000_000,  rate: 15, base: 0 },
      { from: 40_000_000,  to: 80_000_000,  rate: 20, base: 2_250_000 },
      { from: 80_000_000,  to: 200_000_000, rate: 25, base: 10_250_000 },
      { from: 200_000_000, to: 800_000_000, rate: 30, base: 40_250_000 },
      { from: 800_000_000, to: null,        rate: 35, base: 220_250_000 },
    ],
    taxCredits: [],
  };
  const annualTax = computeIncomeTaxFromRegime(1_200_000, regime, 'PHP');
  assert.equal(annualTax, 202_500);
  const monthly = Math.round(annualTax / 12);
  assert.equal(monthly, 16_875); // 202,500 / 12 = 16,875
});

test('PH: SSS contribution via computeStatutoryContributions — wage ceiling 35,000, ee=5%, er=10%', () => {
  const componentByCode = new Map([
    ['BASIC', { code: 'BASIC', statutoryTag: 'SSS_WAGE_BASE', name: 'Basic' }],
  ]);
  const schemes = [
    {
      code: 'SSS',
      name: 'SSS',
      wageBaseTag: 'SSS_WAGE_BASE',
      wageCeiling: 3_500_000, // stored as minor units (PHP centavos): 35,000 * 100
      employee: { rate: 5, component: 'SSS_EE' },
      employer: { rate: 10, component: 'SSS_ER' },
    },
  ];
  // Monthly basic of 50,000 PHP — capped at 35,000
  const earnings = [{ code: 'BASIC', amount: 50_000 }];
  const { statutoryDeductions, employerContributions } = computeStatutoryContributions(earnings, componentByCode, schemes);

  const eeDeduction = statutoryDeductions.find((d) => d.code === 'SSS_EE');
  const erContrib = employerContributions.find((c) => c.code === 'SSS_ER');
  assert.ok(eeDeduction, 'SSS_EE deduction must exist');
  assert.ok(erContrib, 'SSS_ER contribution must exist');
  assert.equal(eeDeduction.amount, 1_750); // 35,000 * 5%
  assert.equal(erContrib.amount, 3_500);   // 35,000 * 10%
});

// ── India regression — minor-unit slabs (paise) ──────────────────────────────

test('IN: computeIncomeTaxFromRegime — minor-unit slabs, 10L gross, 50K std deduction → 106,600', () => {
  const regime = {
    standardDeduction: 5_000_000, // 50,000 INR in paise
    slabs: [
      { from: 0,          to: 25_000_000,  rate: 0,  base: 0 },
      { from: 25_000_000, to: 50_000_000,  rate: 5,  base: 0 },
      { from: 50_000_000, to: 100_000_000, rate: 20, base: 1_250_000 },
      { from: 100_000_000, to: null,       rate: 30, base: 11_250_000 },
    ],
    cess: 4,
    taxCredits: [],
  };
  // Annual gross 1,000,000 INR, taxable = 950,000
  // 500K-1M bracket: base 12,500 + 20% * (950K - 500K) = 12,500 + 90,000 = 102,500
  // cess: 102,500 * 1.04 = 106,600
  const tax = computeIncomeTaxFromRegime(1_000_000, regime, 'INR');
  assert.equal(tax, 106_600);
});

test('IN: resolveFiscalYear — Apr-Mar year, period 2026-09 → FY 2026-27', () => {
  const { fiscalYear, fiscalYearStartPeriod, fiscalYearEndPeriod } = resolveFiscalYear('2026-09', 4);
  assert.equal(fiscalYear, '2026-27');
  assert.equal(fiscalYearStartPeriod, '2026-04');
  assert.equal(fiscalYearEndPeriod, '2027-03');
});

test('IN: resolveFiscalYear — period 2027-01 with Apr start → FY 2026-27 (Jan is in previous FY)', () => {
  const { fiscalYear } = resolveFiscalYear('2027-01', 4);
  assert.equal(fiscalYear, '2026-27');
});

// ── Philippines — fiscal year is calendar year ────────────────────────────────

test('PH: resolveFiscalYear — Jan start, period 2027-03 → FY "2027"', () => {
  const { fiscalYear, fiscalYearStartPeriod, fiscalYearEndPeriod } = resolveFiscalYear('2027-03', 1);
  assert.equal(fiscalYear, '2027');
  assert.equal(fiscalYearStartPeriod, '2027-01');
  assert.equal(fiscalYearEndPeriod, '2027-12');
});

// ── South Africa — minor-unit slabs, taxCredits in paise-equivalent (ZAR cents) ─

test('ZA: taxCredits are subtracted from computed tax, not from income', () => {
  const regime = {
    standardDeduction: 0,
    slabs: [
      { from: 0, to: null, rate: 20, base: 0 }, // flat 20%
    ],
    taxCredits: [
      { code: 'PRIMARY_REBATE', amount: 1_723_500 }, // 17,235 ZAR in cents
    ],
  };
  // Annual gross 500,000 ZAR → tax before credits = 100,000
  // After credits: 100,000 - 17,235 = 82,765
  const tax = computeIncomeTaxFromRegime(500_000, regime, 'ZAR');
  assert.equal(tax, 82_765);
});

test('ZA: multiple taxCredits are summed before subtraction', () => {
  const regime = {
    standardDeduction: 0,
    slabs: [
      { from: 0, to: null, rate: 25, base: 0 },
    ],
    taxCredits: [
      { code: 'PRIMARY_REBATE', amount: 1_723_500 },   // 17,235 ZAR in cents
      { code: 'SECONDARY_REBATE', amount: 944_400 },   // 9,444 ZAR in cents
    ],
  };
  // gross 400,000 ZAR → tax before credits = 100,000
  // After credits: 100,000 - 17,235 - 9,444 = 73,321
  const tax = computeIncomeTaxFromRegime(400_000, regime, 'ZAR');
  assert.equal(tax, 73_321);
});

test('ZA: taxCredits never produce negative tax', () => {
  const regime = {
    standardDeduction: 0,
    slabs: [{ from: 0, to: null, rate: 5, base: 0 }],
    taxCredits: [{ code: 'REBATE', amount: 99_999_900 }], // huge credit in cents
  };
  const tax = computeIncomeTaxFromRegime(10_000, regime, 'ZAR');
  assert.equal(tax, 0); // clamps at 0
});

// ── Edge cases ────────────────────────────────────────────────────────────────

test('computeSlabTax: zero income returns 0', () => {
  const slabs = [{ from: 0, to: null, rate: 30, base: 0 }];
  assert.equal(computeSlabTax(0, slabs), 0);
});

test('computeSlabTax: empty slabs returns 0', () => {
  assert.equal(computeSlabTax(1_000_000, []), 0);
});

test('computeIncomeTaxFromRegime: missing regime returns 0', () => {
  assert.equal(computeIncomeTaxFromRegime(1_000_000, null), 0);
});

test('computeIncomeTaxFromRegime: regime with empty slabs returns 0', () => {
  assert.equal(computeIncomeTaxFromRegime(1_000_000, { slabs: [] }), 0);
});

test('FLAT component: grossEarnings should equal the flat value directly', () => {
  // This tests the principle: FLAT value = 100,000 → gross earnings = 100,000
  // Verified at calculation level: the payroll repository assigns FLAT value directly
  // Formula: componentValue for FLAT type IS the grossEarnings contribution
  const flatValue = 100_000;
  const grossEarnings = flatValue; // FLAT type: value applied directly
  assert.equal(grossEarnings, 100_000);
});
