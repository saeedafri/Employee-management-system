/**
 * Tests for payroll global readiness follow-up fixes:
 * 1. Minor-unit tax normalization (computeIncomeTaxFromRegime + normalizeTaxRegimeForComputation)
 * 2. Pay group null override coercion
 * 3. PATCH statutory-packs preserving taxCode/taxName
 * 4. PATCH salary partial behavior
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeIncomeTaxFromRegime,
  normalizeTaxRegimeForComputation,
} from '../src/utils/statutoryCalculation.js';
import { mergePackUpdate } from '../src/utils/statutoryPackShape.js';

// ── Part 2: normalizeTaxRegimeForComputation ──────────────────────────────────

test('normalizeTaxRegimeForComputation: PHP minor-unit slabs normalize to major units', () => {
  const regime = {
    standardDeduction: 0,
    slabs: [
      { from: 0,           to: 25_000_000,  rate: 0,  base: 0 },
      { from: 25_000_000,  to: 40_000_000,  rate: 15, base: 0 },
      { from: 40_000_000,  to: 80_000_000,  rate: 20, base: 2_250_000 },
      { from: 80_000_000,  to: 200_000_000, rate: 25, base: 10_250_000 },
    ],
    taxCredits: [],
  };
  const normalized = normalizeTaxRegimeForComputation(regime, 'PHP');
  assert.equal(normalized.slabs[0].to, 250_000);
  assert.equal(normalized.slabs[1].from, 250_000);
  assert.equal(normalized.slabs[1].to, 400_000);
  assert.equal(normalized.slabs[2].base, 22_500);
  assert.equal(normalized.slabs[3].from, 800_000);
  // Rates must NOT change
  assert.equal(normalized.slabs[1].rate, 15);
  assert.equal(normalized.slabs[2].rate, 20);
});

test('normalizeTaxRegimeForComputation: INR minor-unit standardDeduction normalizes correctly', () => {
  const regime = {
    standardDeduction: 7_500_000, // 75,000 INR in paise
    slabs: [{ from: 0, to: null, rate: 30, base: 0 }],
    taxCredits: [],
  };
  const normalized = normalizeTaxRegimeForComputation(regime, 'INR');
  assert.equal(normalized.standardDeduction, 75_000);
});

test('normalizeTaxRegimeForComputation: taxCredits amounts normalize from minor to major', () => {
  const regime = {
    standardDeduction: 0,
    slabs: [],
    taxCredits: [
      { code: 'REBATE', amount: 1_723_500 }, // 17,235 ZAR in cents
    ],
  };
  const normalized = normalizeTaxRegimeForComputation(regime, 'ZAR');
  assert.equal(normalized.taxCredits[0].amount, 17_235);
});

test('normalizeTaxRegimeForComputation: null/undefined regime returns as-is', () => {
  assert.equal(normalizeTaxRegimeForComputation(null, 'PHP'), null);
  assert.equal(normalizeTaxRegimeForComputation(undefined, 'PHP'), undefined);
});

test('normalizeTaxRegimeForComputation: JPY (zero exponent) no division', () => {
  const regime = {
    standardDeduction: 500_000, // 500,000 JPY — factor=1, no change
    slabs: [{ from: 0, to: 5_000_000, rate: 10, base: 0 }],
    taxCredits: [],
  };
  const normalized = normalizeTaxRegimeForComputation(regime, 'JPY');
  assert.equal(normalized.standardDeduction, 500_000);
  assert.equal(normalized.slabs[0].to, 5_000_000);
});

test('normalizeTaxRegimeForComputation: KWD (3-decimal, factor=1000) divides by 1000', () => {
  const regime = {
    standardDeduction: 1_000_000, // 1,000 KWD in fils
    slabs: [{ from: 0, to: 10_000_000, rate: 5, base: 0 }],
    taxCredits: [],
  };
  const normalized = normalizeTaxRegimeForComputation(regime, 'KWD');
  assert.equal(normalized.standardDeduction, 1_000);
  assert.equal(normalized.slabs[0].to, 10_000);
});

// ── Part 2: computeIncomeTaxFromRegime with currency ─────────────────────────

test('computeIncomeTaxFromRegime: PH minor-unit pack → 202,500 annual tax for 1.2M gross', () => {
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
  assert.equal(Math.round(annualTax / 12), 16_875);
});

test('computeIncomeTaxFromRegime: taxCredits in minor units are applied correctly', () => {
  const regime = {
    standardDeduction: 0,
    slabs: [{ from: 0, to: null, rate: 20, base: 0 }],
    taxCredits: [
      { code: 'REBATE', amount: 500_000 }, // 5,000 in cents
    ],
  };
  // Gross 100,000, tax = 20,000. After 5,000 credit = 15,000.
  const tax = computeIncomeTaxFromRegime(100_000, regime, 'ZAR');
  assert.equal(tax, 15_000);
});

test('computeIncomeTaxFromRegime: cess as object {rate} is handled', () => {
  const regime = {
    standardDeduction: 0,
    slabs: [{ from: 0, to: null, rate: 10, base: 0 }],
    cess: { rate: 4 }, // India seeded pack uses {rate} format
    taxCredits: [],
  };
  // gross 100,000, tax = 10,000, cess = 400, total = 10,400
  const tax = computeIncomeTaxFromRegime(100_000, regime, 'INR');
  assert.equal(tax, 10_400);
});

test('computeIncomeTaxFromRegime: empty slabs still returns 0 (no regression)', () => {
  assert.equal(computeIncomeTaxFromRegime(1_000_000, null, 'PHP'), 0);
  assert.equal(computeIncomeTaxFromRegime(1_000_000, { slabs: [] }, 'PHP'), 0);
});

// ── Part 4: mergePackUpdate — preserve taxCode/taxName on PATCH ──────────────

test('mergePackUpdate: PATCH with updated slabs preserves taxCode and taxName', () => {
  const existingRow = {
    country: 'PH',
    version: '1.0',
    effectiveFrom: new Date('2027-01-01'),
    effectiveTo: null,
    packData: {
      taxRegimes: [
        {
          code: 'PH_TRAIN',
          taxCode: 'WITHHOLDING_TAX',
          taxName: 'Withholding Tax',
          standardDeduction: 0,
          slabs: [{ from: 0, to: 25_000_000, rate: 0, base: 0 }],
          taxCredits: [],
        },
      ],
      contributionSchemes: [],
    },
  };

  const body = {
    taxRegimes: [
      {
        code: 'PH_TRAIN',
        // taxCode and taxName omitted — simulate a client that doesn't include them
        standardDeduction: 0,
        slabs: [
          { from: 0,          to: 25_000_000,  rate: 0,  base: 0 },
          { from: 25_000_000, to: 40_000_000,  rate: 15, base: 0 },
        ],
        taxCredits: [],
      },
    ],
  };

  const result = mergePackUpdate(existingRow, body);
  const regime = result.packData.taxRegimes[0];
  assert.equal(regime.taxCode, 'WITHHOLDING_TAX', 'taxCode must be preserved');
  assert.equal(regime.taxName, 'Withholding Tax', 'taxName must be preserved');
  // Updated slabs must reflect the new ones
  assert.equal(regime.slabs.length, 2);
});

test('mergePackUpdate: PATCH with explicit taxCode update replaces it', () => {
  const existingRow = {
    country: 'PH',
    version: '1.0',
    effectiveFrom: new Date('2027-01-01'),
    effectiveTo: null,
    packData: {
      taxRegimes: [
        {
          code: 'PH_TRAIN',
          taxCode: 'OLD_CODE',
          taxName: 'Old Tax',
          slabs: [],
          taxCredits: [],
        },
      ],
    },
  };

  const body = {
    taxRegimes: [
      {
        code: 'PH_TRAIN',
        taxCode: 'WITHHOLDING_TAX',
        taxName: 'Withholding Tax',
        slabs: [],
        taxCredits: [],
      },
    ],
  };

  const result = mergePackUpdate(existingRow, body);
  const regime = result.packData.taxRegimes[0];
  assert.equal(regime.taxCode, 'WITHHOLDING_TAX');
  assert.equal(regime.taxName, 'Withholding Tax');
});

test('mergePackUpdate: new regime code not in existing is added as-is', () => {
  const existingRow = {
    country: 'PH',
    version: '1.0',
    effectiveFrom: new Date('2027-01-01'),
    effectiveTo: null,
    packData: {
      taxRegimes: [
        { code: 'PH_OLD', taxCode: 'OLD', taxName: 'Old', slabs: [], taxCredits: [] },
      ],
    },
  };

  const body = {
    taxRegimes: [
      { code: 'PH_NEW', taxCode: 'NEW', taxName: 'New Tax', slabs: [], taxCredits: [] },
    ],
  };

  const result = mergePackUpdate(existingRow, body);
  assert.equal(result.packData.taxRegimes.length, 1);
  assert.equal(result.packData.taxRegimes[0].code, 'PH_NEW');
  assert.equal(result.packData.taxRegimes[0].taxCode, 'NEW');
});
