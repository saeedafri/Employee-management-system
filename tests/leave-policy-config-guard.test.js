// BE-PAY-6 + BE-PAY-8: reject leave-policy config the engine does not honour, at write time.
// The accrual engine only does MONTHLY; balance enforcement is an unconditional hard block —
// so QUARTERLY/ANNUAL accrual and negativeBalance.allowed/convertsToLop must not be persistable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePolicyRules, createPolicyVersion } from '../src/modules/leave/leaveEngine.service.js';

test('BE-PAY-6: non-MONTHLY accrual frequency is rejected', () => {
  assert.throws(
    () => validatePolicyRules([{ accrual: { frequency: 'QUARTERLY', rate: 1 } }]),
    (e) => e.code === 'ACCRUAL_FREQUENCY_NOT_SUPPORTED' && e.statusCode === 422,
  );
  assert.throws(
    () => validatePolicyRules([{ accrual: { frequency: 'ANNUAL', rate: 1 } }]),
    (e) => e.code === 'ACCRUAL_FREQUENCY_NOT_SUPPORTED',
  );
});

test('BE-PAY-6: MONTHLY accrual is allowed', () => {
  assert.doesNotThrow(() => validatePolicyRules([{ accrual: { frequency: 'MONTHLY', rate: 1.5 } }]));
});

test('BE-PAY-8: negativeBalance.allowed / convertsToLop is rejected', () => {
  assert.throws(
    () => validatePolicyRules([{ negativeBalance: { allowed: true, convertsToLop: false } }]),
    (e) => e.code === 'NEGATIVE_BALANCE_NOT_SUPPORTED' && e.statusCode === 422,
  );
  assert.throws(
    () => validatePolicyRules([{ negativeBalance: { allowed: false, convertsToLop: true } }]),
    (e) => e.code === 'NEGATIVE_BALANCE_NOT_SUPPORTED',
  );
});

test('BE-PAY-8: the safe default (allowed:false, convertsToLop:false) is accepted', () => {
  assert.doesNotThrow(() => validatePolicyRules([{ negativeBalance: { allowed: false, convertsToLop: false } }]));
});

test('createPolicyVersion rejects a lying config BEFORE touching the repo/DB', async () => {
  // Empty prisma: if validation did not short-circuit, repo.createPolicy would blow up with a
  // different error. We assert the specific write-time guard fires first.
  await assert.rejects(
    () => createPolicyVersion({}, 't1', { country: 'IN', effectiveFrom: '2026-01-01', rules: [{ accrual: { frequency: 'ANNUAL' } }] }),
    (e) => e.code === 'ACCRUAL_FREQUENCY_NOT_SUPPORTED',
  );
});
