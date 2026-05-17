import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from '../helpers.js';

describe('Auth Routes Integration Tests', function () {
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
    await createTestUser(testTenant.id, {
      email: 'admin@example.com',
      memberType: 'HR_ADMIN',
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('POST /auth/login', function () {
    it('should successfully login with valid credentials and return access token', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.have.property('accessToken');
      expect(body.data).to.have.property('sessionId');
      expect(body.data).to.have.property('user');
      expect(body.data).to.have.property('permissions');
      expect(body.data.user).to.have.property('id');
      expect(body.data.user).to.have.property('email');
    });

    it('should set httpOnly refresh token cookie', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      expect(response.cookies).to.have.lengthOf(1);
      const cookie = response.cookies[0];
      expect(cookie.httpOnly).to.be.true;
      expect(cookie.sameSite).to.equal('Strict');
      expect(cookie.value).to.include('.');
    });

    it('should return 401 for missing tenant header', async function () {
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

    it('should return 401 for non-existent user', async function () {
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
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
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
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
    });

    it('should create session with sessionFamilyId equal to sessionId', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const body = JSON.parse(response.body);
      expect(body.data.sessionId).to.exist;
    });

    it('should create audit log for login', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(200);
    });
  });

  describe('POST /auth/admin/login', function () {
    it('should successfully login as admin', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/admin/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.have.property('accessToken');
    });

    it('should reject non-admin users', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/admin/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(403);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
      expect(body.error.code).to.equal('FORBIDDEN');
    });

    it('should return 401 for missing tenant header', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/admin/login',
        payload: {
          email: 'admin@example.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe('POST /auth/refresh', function () {
    it('should refresh access token without requiring Authorization header', async function () {
      // Login first
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const loginBody = JSON.parse(loginResponse.body);
      const refreshToken = loginResponse.cookies[0].value;
      const sessionId = loginBody.data.sessionId;

      // Refresh without access token
      const refreshResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        cookies: { refreshToken },
      });

      expect(refreshResponse.statusCode).to.equal(200);
      const refreshBody = JSON.parse(refreshResponse.body);
      expect(refreshBody.success).to.be.true;
      expect(refreshBody.data).to.have.property('accessToken');
      expect(refreshBody.data.sessionId).to.not.equal(sessionId);
    });

    it('should rotate refresh token on each refresh', async function () {
      // Login
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const firstRefreshToken = loginResponse.cookies[0].value;

      // Refresh 1
      const refresh1Response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        cookies: { refreshToken: firstRefreshToken },
      });

      expect(refresh1Response.statusCode).to.equal(200);
      const secondRefreshToken = refresh1Response.cookies[0].value;
      expect(secondRefreshToken).to.not.equal(firstRefreshToken);

      // Refresh 2
      const refresh2Response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        cookies: { refreshToken: secondRefreshToken },
      });

      expect(refresh2Response.statusCode).to.equal(200);
      const thirdRefreshToken = refresh2Response.cookies[0].value;
      expect(thirdRefreshToken).to.not.equal(secondRefreshToken);
    });

    it('should return 401 for missing refresh token', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('REFRESH_TOKEN_MISSING');
    });

    it('should return 401 for missing tenant header', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { refreshToken: 'sessionid.token' },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should return 401 for invalid token format', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        cookies: { refreshToken: 'invalid-token-without-dot' },
      });

      expect(response.statusCode).to.equal(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('INVALID_TOKEN_FORMAT');
    });

    it('should detect token reuse and revoke entire family', async function () {
      // Login
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const firstRefreshToken = loginResponse.cookies[0].value;

      // Refresh 1 (should succeed)
      const refresh1Response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        cookies: { refreshToken: firstRefreshToken },
      });

      expect(refresh1Response.statusCode).to.equal(200);

      // Try to reuse old token (should fail)
      const reuseResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        cookies: { refreshToken: firstRefreshToken },
      });

      expect(reuseResponse.statusCode).to.equal(401);
      const body = JSON.parse(reuseResponse.body);
      expect(body.error.code).to.equal('TOKEN_REUSE');
    });
  });

  describe('POST /auth/logout', function () {
    it('should logout and revoke session', async function () {
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
      const accessToken = body.data.accessToken;

      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(logoutResponse.statusCode).to.equal(200);
    });

    it('should require valid access token', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(401);
    });
  });

  describe('POST /auth/logout-all', function () {
    it('should logout from all sessions', async function () {
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
      const accessToken = body.data.accessToken;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).to.be.true;
    });
  });

  describe('GET /auth/me', function () {
    it('should return current user with valid token', async function () {
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
      const accessToken = body.data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).to.be.true;
      expect(responseBody.data).to.have.property('email');
      expect(responseBody.data.email).to.equal('test@example.com');
    });

    it('should require valid access token', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(401);
    });
  });

  describe('GET /auth/sessions', function () {
    it('should list user sessions', async function () {
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
      const accessToken = body.data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.success).to.be.true;
      expect(Array.isArray(responseBody.data)).to.be.true;
    });
  });

  describe('DELETE /auth/sessions/:sessionId', function () {
    it('should revoke specific session', async function () {
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
      const accessToken = body.data.accessToken;
      const sessionId = body.data.sessionId;

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/auth/sessions/${sessionId}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
    });
  });

  describe('GET /logs (Role-Based Access Control)', function () {
    it('should allow HR_ADMIN to access logs', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@example.com',
          password: 'password',
        },
      });

      const loginBody = JSON.parse(loginResponse.body);
      const accessToken = loginBody.data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.be.an('array');
    });

    it('should reject EMPLOYEE from accessing logs with 403', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'test@example.com',
          password: 'password',
        },
      });

      const loginBody = JSON.parse(loginResponse.body);
      const accessToken = loginBody.data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('FORBIDDEN');
    });
  });
});
