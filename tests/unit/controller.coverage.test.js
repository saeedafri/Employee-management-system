import { describe, it, before, beforeEach, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from '../helpers.js';

describe('Auth Controller Coverage', function () {
  this.timeout(15000);

  let app;
  let testTenant;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();
    await createTestUser(testTenant.id, {
      email: 'admin@test.com',
      memberType: 'HR_ADMIN',
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('Admin Login Endpoint Errors', function () {
    it('should return 401 for non-existent admin', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/admin/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'nonexistent@test.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('INVALID_CREDENTIALS');
    });

    it('should return 403 for non-admin user trying admin login', async function () {
      await createTestUser(testTenant.id, {
        email: 'employee@test.com',
        memberType: 'EMPLOYEE',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/admin/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'employee@test.com',
          password: 'password',
        },
      });

      expect(response.statusCode).to.equal(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('FORBIDDEN');
    });
  });

  describe('Session Endpoints', function () {
    it('should list empty sessions when no sessions exist', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@test.com',
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
    });

    it('should return 404 when revoking non-existent session', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@test.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/invalid-session-id',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('SESSION_NOT_FOUND');
    });
  });
});

describe('Logs Controller Coverage', function () {
  this.timeout(15000);

  let app;
  let testTenant;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();
    await createTestUser(testTenant.id, {
      email: 'admin@test.com',
      memberType: 'HR_ADMIN',
    });
    await createTestUser(testTenant.id, {
      email: 'employee@test.com',
      memberType: 'EMPLOYEE',
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('Get Logs RBAC', function () {
    it('should return 403 for non-admin user accessing logs', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'employee@test.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('FORBIDDEN');
    });

    it('should allow admin user to access logs', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@test.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.be.an('array');
    });

    it('should return 404 for non-existent log', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@test.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/nonexistent-id',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('LOG_NOT_FOUND');
    });

    it('should filter logs by level', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@test.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs?level=error',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.be.an('array');
    });

    it('should paginate logs results', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@test.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs?page=1&limit=10',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.meta).to.have.property('count');
      expect(body.data).to.be.an('array');
    });
  });

  describe('Export Logs RBAC', function () {
    it('should return 403 for non-admin user exporting logs', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'employee@test.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/export?format=json',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(403);
    });

    it('should allow admin to export logs as JSON', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@test.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/export?format=json',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers['content-type']).to.include('application/json');
    });

    it('should allow admin to export logs as CSV', async function () {
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: {
          email: 'admin@test.com',
          password: 'password',
        },
      });

      const token = JSON.parse(loginResponse.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/export?format=csv',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers['content-type']).to.include('text/csv');
    });
  });
});
