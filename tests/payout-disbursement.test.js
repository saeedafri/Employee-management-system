// §10 disbursement selection: the primary/ACTIVE/VERIFIED/currency-matched rule and
// the three exclusion reasons. Runs against LOCAL ems_local.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/plugins/prisma.js';
import * as payout from '../src/modules/payroll/payout/payout.service.js';
import { encryptDetails } from '../src/modules/payroll/payout/payoutCrypto.js';

let tenantId, methodId;
// Dedicated synthetic employeeId (no FK on PayoutMethod.employeeId) so this file is fully
// isolated from the integration test, which runs concurrently against the same local DB.
const empId = 'disb-test-emp-iso';

test.before(async () => {
  const t = await prisma.tenant.findUnique({ where: { tenantKey: 'acme-corp-001' }, select: { id: true } });
  tenantId = t.id;
  await prisma.payoutMethod.deleteMany({ where: { tenantId, employeeId: empId } }); // clear any prior run
  const m = await prisma.payoutMethod.create({
    data: {
      tenantId, employeeId: empId, type: 'BANK', country: 'IN', currency: 'INR', rail: 'BANK_LOCAL',
      label: 'Disb Test', holderName: 'Priya', maskedTail: '4821',
      detailsEnc: encryptDetails({ accountName: 'Priya', accountNumber: '50100123454821', ifsc: 'HDFC0001234' }),
      isPrimary: true, lifecycleStatus: 'ACTIVE', verificationStatus: 'VERIFIED', effectiveFrom: new Date(),
    },
  });
  methodId = m.id;
});

test.after(async () => {
  await prisma.payoutMethod.deleteMany({ where: { tenantId, employeeId: empId } });
  await prisma.$disconnect();
});

test('eligible: primary/ACTIVE/VERIFIED/currency-matched → returns unmasked details', async () => {
  const r = await payout.resolvePayoutForLine(prisma, tenantId, empId, 'INR');
  assert.equal(r.excludedReason, undefined);
  assert.equal(r.method.id, methodId);
  assert.equal(r.details.accountNumber, '50100123454821'); // unmasked for the bank file
});

test('CURRENCY_MISMATCH when payslip currency differs', async () => {
  const r = await payout.resolvePayoutForLine(prisma, tenantId, empId, 'USD');
  assert.equal(r.excludedReason, 'CURRENCY_MISMATCH');
});

test('UNVERIFIED when the primary method is not verified', async () => {
  await prisma.payoutMethod.update({ where: { id: methodId }, data: { verificationStatus: 'UNVERIFIED' } });
  const r = await payout.resolvePayoutForLine(prisma, tenantId, empId, 'INR');
  assert.equal(r.excludedReason, 'UNVERIFIED');
  await prisma.payoutMethod.update({ where: { id: methodId }, data: { verificationStatus: 'VERIFIED' } });
});

test('NO_ACCOUNT when there is no primary active bank method', async () => {
  await prisma.payoutMethod.update({ where: { id: methodId }, data: { isPrimary: false } });
  const r = await payout.resolvePayoutForLine(prisma, tenantId, empId, 'INR');
  assert.equal(r.excludedReason, 'NO_ACCOUNT');
  await prisma.payoutMethod.update({ where: { id: methodId }, data: { isPrimary: true } });
});
