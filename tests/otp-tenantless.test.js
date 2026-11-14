import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';

// The OTP page posts with no tenant. verify-otp created the session with tenantId null (500 on
// every correct code), and resend-otp searched `tenantId: null` so "resend code" never found
// the challenge. Both must use the challenge's own tenant.
const seen = {};
let controller;
before(async () => {
  mock.module('../src/plugins/prisma.js', {
    namedExports: {
      prisma: {
        otpChallenge: {
          findFirst: async ({ where }) => { seen.resendWhere = where; return { tenantId: 't-1', challengeId: 'c-1', user: { email: 'a@b.test' } }; },
        },
      },
    },
    defaultExport: async () => {},
  });
  mock.module('../src/modules/auth/otp.service.js', {
    namedExports: {
      verifyOtp: async () => ({ valid: true, challengeId: 'c-1', userId: 'u-1', tenantId: 't-1', purpose: 'LOGIN' }),
      resendOtp: async (tenantId) => { seen.resendTenant = tenantId; return { destinationMasked: 'a***@b.test', expiresIn: 600 }; },
    },
  });
  mock.module('../src/modules/auth/auth.service.js', {
    namedExports: {
      completeMfaLogin: async (db, tenantId) => { seen.loginTenant = tenantId; return { accessToken: 'a', refreshToken: 'r', user: {}, permissions: [], sessionId: 's' }; },
    },
  });
  controller = await import('../src/modules/auth/otp.controller.js');
});

const reply = () => ({ statusCode: 200, code(c) { this.statusCode = c; return this; }, send(b) { this.body = b; return this; }, setCookie() { return this; } });
const request = (body) => ({ tenant: undefined, body, ip: '1.2.3.4', headers: {}, id: 'r', log: { error() {} } });

test('verify-otp creates the session under the challenge tenant', async () => {
  const r = reply();
  await controller.verifyOtpController(request({ challengeId: 'c-1', code: '123456' }), r);
  assert.equal(seen.loginTenant, 't-1');
  assert.equal(r.statusCode, 200);
});

test('resend-otp finds the challenge without a request tenant', async () => {
  const r = reply();
  await controller.resendOtpController(request({ challengeId: 'c-1' }), r);
  assert.deepEqual(seen.resendWhere, { challengeId: 'c-1' });
  assert.equal(seen.resendTenant, 't-1');
  assert.equal(r.statusCode, 202);
});
