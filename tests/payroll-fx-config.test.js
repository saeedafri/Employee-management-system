// BE-PAY-4: consolidated worker-cost FX moved from a hardcoded table to tenant config (a Setting).
// A MISSING rate refuses to blend (no silent 1:1) and returns the per-currency breakdown + a
// missingRates flag. Single-currency tenants are unaffected.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWorkerCostSummary } from '../src/modules/payroll/payroll.service.js';

function fakePrisma({ employees, defaultCurrency = 'INR', fxSetting = null }) {
  return {
    employee: { findMany: async () => employees },
    tenant: { findUnique: async () => ({ defaultCurrency }) },
    setting: { findUnique: async () => fxSetting },
  };
}
const emp = (payCurrency, annualCtc, employmentType = 'FULL_TIME') => ({
  employmentType, payCurrency, location: 'HQ', salaries: [{ annualCtc }],
});
const fx = { valueJson: { base: 'INR', asOf: '2026-07-01', rates: { INR: 1, USD: 83 } } };

test('all rates present → blends to base, blended:true, no missingRates', async () => {
  const prisma = fakePrisma({ employees: [emp('INR', 1200000), emp('USD', 12000)], fxSetting: fx });
  const out = await getWorkerCostSummary(prisma, 't1');
  assert.equal(out.blended, true);
  assert.deepEqual(out.missingRates, []);
  assert.equal(out.baseCurrency, 'INR');
  assert.equal(out.asOf, '2026-07-01');
  // 100000 INR/mo + 1000 USD/mo * 83 = 100000 + 83000
  assert.equal(out.totalBaseCost, 183000);
});

test('missing rate → refuses to blend: blended:false, totalBaseCost null, missingRates + perCurrency', async () => {
  const prisma = fakePrisma({ employees: [emp('INR', 1200000), emp('EUR', 12000)], fxSetting: fx });
  const out = await getWorkerCostSummary(prisma, 't1');
  assert.equal(out.blended, false);
  assert.equal(out.totalBaseCost, null);
  assert.deepEqual(out.missingRates, ['EUR']);
  assert.ok(Array.isArray(out.perCurrency));
  const eur = out.perCurrency.find((c) => c.currency === 'EUR');
  assert.equal(eur.localAmount, 1000); // 12000/12, un-converted (never invented at 1:1)
});

test('single-currency tenant (no FX setting) is unaffected — blends INR 1:1', async () => {
  const prisma = fakePrisma({ employees: [emp('INR', 1200000), emp('INR', 600000)], fxSetting: null });
  const out = await getWorkerCostSummary(prisma, 't1');
  assert.equal(out.blended, true);
  assert.deepEqual(out.missingRates, []);
  assert.equal(out.totalBaseCost, 150000); // 100000 + 50000
});
