import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStatutoryContributions } from '../src/utils/statutoryCalculation.js';

const schemes = [{
  code: 'IN_EPF', name: 'EPF', wageBaseTag: 'PF_WAGE', apportionmentMode: 'MONTHLY_TOTAL',
  wageCeiling: 1500000, employee: { rate: 12, component: 'PF' }, employer: { rate: 12, component: 'PF_ER' },
}];

test('Bug B: scheme wageBaseTag with NO matching component → warning, no silent drop', () => {
  const earnings = [{ code: 'BASIC', amount: 50000 }];
  const componentByCode = new Map([['BASIC', { code: 'BASIC', statutoryTag: null }]]); // untagged
  const { statutoryDeductions, warnings } = computeStatutoryContributions(earnings, componentByCode, schemes);
  assert.equal(statutoryDeductions.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /STATUTORY_WAGE_BASE_EMPTY.*IN_EPF.*PF_WAGE/);
});

test('Bug B: tagged component → PF computes, no warning', () => {
  const earnings = [{ code: 'BASIC', amount: 50000 }];
  const componentByCode = new Map([['BASIC', { code: 'BASIC', statutoryTag: 'PF_WAGE' }]]);
  const { statutoryDeductions, employerContributions, warnings } = computeStatutoryContributions(earnings, componentByCode, schemes, { periodsPerMonth: 1, isLastCycleInMonth: true });
  assert.equal(warnings.length, 0);
  const pf = statutoryDeductions.find((d) => d.code === 'PF');
  assert.ok(pf, 'PF present');
  assert.equal(pf.amount, 1800); // 12% of min(50000, 15000 ceiling)
  assert.ok(employerContributions.find((c) => c.code === 'PF_ER'));
});

test('Bug A/B apportionment: MONTHLY_TOTAL splits across cycles, H1+H2 == monthly', () => {
  const earnings = [{ code: 'BASIC', amount: 25000 }]; // already cycle-prorated half
  const componentByCode = new Map([['BASIC', { code: 'BASIC', statutoryTag: 'PF_WAGE' }]]);
  const h1 = computeStatutoryContributions(earnings, componentByCode, schemes, { periodsPerMonth: 2, isLastCycleInMonth: false });
  const h2 = computeStatutoryContributions(earnings, componentByCode, schemes, { periodsPerMonth: 2, isLastCycleInMonth: true });
  const pf1 = h1.statutoryDeductions.find((d) => d.code === 'PF').amount;
  const pf2 = h2.statutoryDeductions.find((d) => d.code === 'PF').amount;
  assert.equal(pf1 + pf2, 1800, 'H1.PF + H2.PF == monthly 1800');
});
