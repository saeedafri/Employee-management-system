import { describe, it, before, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestOtpChallenge, cleanDatabase } from '../helpers.js';

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
    it('should return 400 for invalid challenge (no auth required)', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resend-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          challengeId: 'invalid_challenge',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).to.equal('OTP_CHALLENGE_NOT_FOUND');
    });

    it('should resend OTP successfully within cooldown window', async function () {
      const challenge = await createTestOtpChallenge(testUser.id, testTenant.id, 'user@test.com');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resend-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { challengeId: challenge.challengeId },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.payload);
      expect(body.data).to.have.property('destinationMasked');
      expect(body.data).to.have.property('expiresIn');
    });

    it('should reject resend for consumed OTP', async function () {
      const challenge = await createTestOtpChallenge(testUser.id, testTenant.id, 'user@test.com');

      // Mark as consumed
      const { prisma } = await import('../../src/plugins/prisma.js');
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resend-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { challengeId: challenge.challengeId },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.payload);
      expect(body.error.code).to.equal('OTP_ALREADY_USED');
    });
  });

  describe('OTP Error Handling', function () {
    it('should reject verify-otp without challengeId', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { code: '123456' },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should reject verify-otp without code', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { challengeId: 'test_challenge' },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should reject resend-otp without challengeId', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resend-otp',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {},
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should reject OTP requests without tenant header', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-otp',
        payload: { challengeId: 'test', code: '123456' },
      });

      expect(response.statusCode).to.equal(400);
    });
  });
});
