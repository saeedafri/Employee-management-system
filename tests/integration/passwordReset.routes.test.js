import { describe, it, before, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase, createTestPasswordResetToken } from '../helpers.js';

describe('Password Reset Routes', function () {
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

  describe('POST /api/v1/auth/forgot-password', function () {
    it('should return 202 for valid email', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: testUser.email },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.body);
      expect(body.data).to.be.null;
    });

    it('should return 202 for non-existent email (no enumeration)', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'nonexistent@test.com' },
      });

      expect(response.statusCode).to.equal(202);
    });

    it('should return 400 for invalid email', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'invalid-email' },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should create password reset token', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: testUser.email },
      });

      expect(response.statusCode).to.equal(202);
    });
  });

  describe('GET /api/v1/auth/validate-reset-token', function () {
    it('should validate valid token', async function () {
      const { rawToken } = await createTestPasswordResetToken(testUser.id, testTenant.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/auth/validate-reset-token?token=${rawToken}`,
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.valid).to.be.true;
      expect(body.data.emailMasked).to.exist;
    });

    it('should reject invalid token', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/validate-reset-token?token=invalid-token',
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('RESET_TOKEN_INVALID');
    });

    it('should reject missing token', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/validate-reset-token',
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe('POST /api/v1/auth/reset-password', function () {
    it('should reset password with valid token', async function () {
      const { rawToken } = await createTestPasswordResetToken(testUser.id, testTenant.id);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          token: rawToken,
          newPassword: 'NewPassword123!',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).to.be.true;
    });

    it('should reject weak password', async function () {
      const { rawToken } = await createTestPasswordResetToken(testUser.id, testTenant.id);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          token: rawToken,
          newPassword: 'weak',
        },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should reject invalid token', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          token: 'invalid-token',
          newPassword: 'NewPassword123!',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('RESET_TOKEN_INVALID');
    });

    it('should allow login with new password', async function () {
      const { rawToken } = await createTestPasswordResetToken(testUser.id, testTenant.id);

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          token: rawToken,
          newPassword: 'NewPassword123!',
        },
      });

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: testUser.email,
          password: 'NewPassword123!',
        },
      });

      expect(loginResponse.statusCode).to.equal(200);
    });
  });
});
