import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';
import { hashSHA256 } from '../src/utils/hash.js';

// A reset link carries only the token, so the public route has no tenant. Audit rows
// require one; writing tenantId: null made validate and complete 500 (after the password
// had already changed). The tenant must come from the token itself.
const RAW = 'raw-reset-token';
const audits = [];
const token = { id: 'tok-1', userId: 'u-1', tenantId: 't-1', tokenHash: hashSHA256(RAW), usedAt: null, expiresAt: new Date(Date.now() + 60_000) };
const fakePrisma = {
  passwordResetToken: {
    findFirst: async ({ where }) => (where.tokenHash === token.tokenHash ? { ...token } : null),
    update: async ({ data }) => Object.assign(token, data),
  },
  auditLog: { create: async ({ data }) => { assert.ok(data.tenantId, `audit ${data.action} written without tenant`); audits.push(data); } },
  user: { findUnique: async () => ({ id: 'u-1', email: 'person@example.test' }), update: async () => ({}) },
  session: { updateMany: async () => ({ count: 0 }) },
};

let reset;
before(async () => {
  mock.module('../src/plugins/prisma.js', { namedExports: { prisma: fakePrisma }, defaultExport: async () => {} });
  reset = await import('../src/modules/auth/passwordReset.service.js');
});

test('validate and complete work without a request tenant and audit under the token tenant', async () => {
  assert.equal((await reset.validateResetToken(null, RAW)).valid, true);
  assert.equal((await reset.completePasswordReset(null, RAW, 'N3w-Password!x', '1.2.3.4', 'ua')).success, true);
  await assert.rejects(reset.completePasswordReset(null, RAW, 'Other-Pass1!', '1.2.3.4', 'ua'), { code: 'RESET_TOKEN_ALREADY_USED' });
  assert.deepEqual(audits.map((a) => [a.action, a.tenantId]), [
    ['PASSWORD_RESET_TOKEN_VALIDATED', 't-1'],
    ['PASSWORD_RESET_COMPLETED', 't-1'],
    ['PASSWORD_RESET_FAILED', 't-1'],
  ]);
});
