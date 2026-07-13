// BE-PAY-5: recalculatePayslip no longer forges a `payslip.recalculated` audit event while
// recomputing nothing. It fails honestly (501 RECALC_NOT_SUPPORTED) and writes nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recalculatePayslip } from '../src/modules/payroll/payroll.service.js';

test('existing payslip → throws 501 RECALC_NOT_SUPPORTED and writes NOTHING', async () => {
  let wrote = false;
  const prisma = {
    payslip: {
      findFirst: async () => ({ id: 'ps1', payrollRunId: 'run1' }),
      update: async () => { wrote = true; throw new Error('update must not be called'); },
    },
    payrollEvent: { create: async () => { wrote = true; throw new Error('event must not be logged'); } },
  };
  await assert.rejects(
    () => recalculatePayslip(prisma, 'run1', 'ps1', 't1'),
    (err) => err.code === 'RECALC_NOT_SUPPORTED' && err.statusCode === 501,
  );
  assert.equal(wrote, false, 'no updatedAt bump and no audit event were written');
});

test('missing payslip → returns null (controller maps to 404)', async () => {
  const prisma = { payslip: { findFirst: async () => null } };
  const res = await recalculatePayslip(prisma, 'run1', 'missing', 't1');
  assert.equal(res, null);
});
