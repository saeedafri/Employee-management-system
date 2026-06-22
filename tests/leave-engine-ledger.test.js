// Ported VERBATIM from ems-frontend/src/modules/leave/engine/__tests__/ledger.test.ts
// (Vitest -> node:test). Pure engine oracle — no DB. Run: node --test tests/leave-engine-ledger.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { foldBalance } from '../src/modules/leave/engine/ledger.js';

const t = (over) => ({
  id: 'x',
  employeeId: 'e1',
  leaveTypeId: 'EL',
  policyId: 'p',
  policyVersion: '1',
  type: 'ACCRUAL',
  delta: 0,
  effectiveDate: '2026-01-31',
  postedAt: '2026-01-31T00:00:00Z',
  leaveYear: 2026,
  reason: 'r',
  systemGenerated: true,
  ...over,
});

test('foldBalance: grants add, taken subtracts, holds reduce available not used', () => {
  const txns = [
    t({ type: 'OPENING_GRANT', delta: 12 }),
    t({ type: 'LEAVE_TAKEN', delta: -3 }),
    t({ type: 'LEAVE_PENDING_HOLD', delta: -2 }),
  ];
  const b = foldBalance(txns, 'EL');
  assert.equal(b.granted, 12);
  assert.equal(b.used, 3); // taken only
  assert.equal(b.pending, 2); // active hold
  assert.equal(b.available, 7); // 12 - 3 - 2
});

test('foldBalance: a released hold no longer reduces available (S-7/S-8)', () => {
  const txns = [
    t({ type: 'OPENING_GRANT', delta: 10 }),
    t({ type: 'LEAVE_PENDING_HOLD', delta: -4, sourceRef: 'req1' }),
    t({ type: 'LEAVE_PENDING_RELEASE', delta: 4, sourceRef: 'req1' }),
  ];
  const b = foldBalance(txns, 'EL');
  assert.equal(b.pending, 0);
  assert.equal(b.available, 10);
});
