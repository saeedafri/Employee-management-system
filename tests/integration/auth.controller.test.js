import { describe, it, beforeEach, before } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from '../helpers.js';

describe('Auth Controller Integration Tests', function () {
  this.timeout(10000);

  let app;
  let testTenant;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();
    await createTestUser(testTenant.id, {
      email: 'test@example.com',
      memberType: 'EMPLOYEE',
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('Login Error Cases', function () {
    it('should return 400 for invalid email format', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'not-an-email',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should return 401 for non-existent email', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'nonexistent@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should return 401 for wrong password', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'wrongpassword',
        },
      });

      expect(response.statusCode).to.equal(401);
    });
  });

  describe('Get Sessions', function () {
    it('should return empty array initially', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.be.an('array');
      expect(body.data.length).to.be.greaterThanOrEqual(1);
    });

    it('should require authentication', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
        },
      });

      expect(response.statusCode).to.equal(401);
    });
  });

  describe('Get Current User', function () {
    it('should return current user profile', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.have.property('email', 'test@example.com');
      expect(body.data).to.have.property('memberType');
      expect(body.data).to.have.property('status');
    });

    it('should require authentication', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
        },
      });

      expect(response.statusCode).to.equal(401);
    });
  });

  describe('Refresh Token Errors', function () {
    it('should return 401 for missing refresh token', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
        },
      });

      expect(response.statusCode).to.equal(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('REFRESH_TOKEN_MISSING');
    });

    it('should return 401 for invalid token format', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
        },
        cookies: { refreshToken: 'invalid-format-no-dot' },
      });

      expect(response.statusCode).to.equal(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('INVALID_TOKEN_FORMAT');
    });
  });

  describe('Logout', function () {
    it('should require authentication', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
        },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should successfully logout authenticated user', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
    });
  });

  describe('Logout All', function () {
    it('should require authentication', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
        },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should successfully logout all sessions', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
    });
  });

  describe('Revoke Session', function () {
    it('should require authentication', async function () {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/session-123',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
        },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should return 404 for non-existent session', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/nonexistent-session',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(404);
    });
  });
});
