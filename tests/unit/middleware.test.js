import { describe, it, before, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from '../helpers.js';

describe('Middleware Tests', function () {
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

  describe('Authenticate Middleware', function () {
    it('should reject request without Authorization header', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
        },
      });

      expect(response.statusCode).to.equal(401);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
      expect(body.error.code).to.equal('UNAUTHORIZED');
    });

    it('should reject request with invalid token', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: 'Bearer invalid.token.string',
        },
      });

      expect(response.statusCode).to.equal(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('INVALID_TOKEN');
    });

    it('should accept request with valid token', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const body = JSON.parse(loginResponse.body);
      const token = body.data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
    });

    it('should extract Bearer token from Authorization header', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const body = JSON.parse(loginResponse.body);
      const token = body.data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.data).to.have.property('email');
    });
  });

  describe('Tenant Resolution', function () {
    it('should reject request without x-tenant-key header', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
      expect(body.error.code).to.equal('MISSING_TENANT');
    });

    it('should set tenant in request object for valid tenant key', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      expect(loginResponse.statusCode).to.equal(200);
    });
  });

  describe('Request Validation', function () {
    it('should validate login email format', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'invalid-email',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should reject login without password', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).to.equal(400);
    });
  });
});
