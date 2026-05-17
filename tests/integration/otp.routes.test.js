import { describe, it, before, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestOtpChallenge, cleanDatabase, getAuthToken } from '../helpers.js';
import { hashSHA256 } from '../../src/utils/hash.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('OTP Routes', function () {
  this.timeout(15000);

  let app;
  let testTenant;
  let testUser;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();
    testUser = await createTestUser(testTenant.id, {
      email: 'user@test.com',
      memberType: 'EMPLOYEE',
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('POST /api/v1/auth/verify-otp', function () {
    it('should reject invalid OTP code', async function () {
      const { challenge } = await createTestOtpChallenge(testUser.id, testTenant.id, testUser.email);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          challengeId: challenge.challengeId,
          code: '999999',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('OTP_INVALID');
    });

    it('should reject non-existent challenge', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          challengeId: 'challenge_nonexistent',
          code: '123456',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('OTP_CHALLENGE_NOT_FOUND');
    });

    it('should reject malformed OTP code', async function () {
      const { challenge } = await createTestOtpChallenge(testUser.id, testTenant.id, testUser.email);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          challengeId: challenge.challengeId,
          code: 'invalid',
        },
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe('POST /api/v1/auth/resend-otp', function () {
    it('should reject resend without authentication', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resend-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          challengeId: 'challenge_test',
        },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should reject resend on non-existent challenge with auth', async function () {
      const token = await getAuthToken(app, testTenant.tenantKey, testUser.email, 'password');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resend-otp',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          'authorization': `Bearer ${token}`,
        },
        payload: {
          challengeId: 'challenge_nonexistent',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('OTP_CHALLENGE_NOT_FOUND');
    });
  });
});
