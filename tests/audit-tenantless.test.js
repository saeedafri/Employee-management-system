import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuditLog } from '../src/modules/auth/auth.repository.js';
import { createAuditLog as otpCreateAuditLog } from '../src/modules/auth/otp.repository.js';

// OTP verify and reset links run on public routes with no tenant. Audit rows require one;
// tenantId null threw and a correct OTP login came back as 500 (seen live 2026-11-14).
function fakeDb() {
  const rows = [];
  return {
    rows,
    user: { findUnique: async ({ where }) => (where.id === 'u-1' ? { tenantId: 't-1' } : null) },
    auditLog: { create: async ({ data }) => { assert.ok(data.tenantId, 'tenantId missing'); rows.push(data); return data; } },
  };
}

test('a tenant-less audit row is attributed to the actor tenant', async () => {
  const db = fakeDb();
  await createAuditLog(db, { tenantId: null, actorUserId: 'u-1', action: 'OTP_VERIFICATION_SUCCEEDED' });
  await otpCreateAuditLog(db, { tenantId: undefined, actorUserId: 'u-1', action: 'OTP_SENT' });
  assert.deepEqual(db.rows.map((r) => r.tenantId), ['t-1', 't-1']);
});

test('no tenant and no known actor: skipped instead of throwing', async () => {
  const db = fakeDb();
  assert.equal(await createAuditLog(db, { tenantId: null, actorUserId: null, action: 'X' }), null);
  assert.equal(db.rows.length, 0);
});
