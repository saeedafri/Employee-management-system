import { describe, it, beforeEach, before, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';
import * as logsService from '../../src/modules/logs/logs.service.js';

describe('Logs Routes Integration Tests', function () {
  this.timeout(10000);

  let app;
  let testTenant;
  let adminToken;
  let employeeToken;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    await prisma.logEntry.deleteMany({});

    testTenant = await createTestTenant();
    const adminUser = await createTestUser(testTenant.id, {
      email: 'admin@example.com',
      memberType: 'HR_ADMIN',
    });

    const employeeUser = await createTestUser(testTenant.id, {
      email: 'employee@example.com',
      memberType: 'EMPLOYEE',
    });

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'admin@example.com', password: 'password' },
    });

    adminToken = JSON.parse(adminLogin.body).data.accessToken;

    const employeeLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'employee@example.com', password: 'password' },
    });

    employeeToken = JSON.parse(employeeLogin.body).data.accessToken;

    // Create test logs
    await logsService.createLog(
      testTenant.id,
      'error',
      'Error',
      '#FF0000',
      'auth',
      'Authentication failed',
      'req-001',
      adminUser.id,
      { errorCode: 'INVALID_CREDENTIALS' },
    );

    await logsService.createLog(
      testTenant.id,
      'warn',
      'Warn',
      '#FFA500',
      'user',
      'User updated',
      'req-002',
      adminUser.id,
      { action: 'UPDATE' },
    );

    await logsService.createLog(
      testTenant.id,
      'info',
      'Info',
      '#0000FF',
      'auth',
      'User logged in',
      'req-003',
      employeeUser.id,
      {},
    );
  });

  after(async function () {
    await cleanDatabase();
    await prisma.logEntry.deleteMany({});
    await app.close();
  });

  describe('GET /admin/logs', function () {
    it('should allow HR_ADMIN to list logs', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.be.an('array');
      expect(body.data.length).to.be.greaterThan(0);
    });

    it('should reject EMPLOYEE from listing logs', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).to.equal(403);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('FORBIDDEN');
    });

    it('should filter logs by level', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs?level=error',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.every((log) => log.level === 'error')).to.be.true;
    });

    it('should filter logs by module', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs?module=auth',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.every((log) => log.module === 'auth')).to.be.true;
    });

    it('should support pagination with limit and offset', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs?limit=2&offset=0',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.length).to.be.lessThanOrEqual(2);
    });
  });

  describe('GET /admin/logs/:id', function () {
    it('should retrieve log by ID', async function () {
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      const body = JSON.parse(listResponse.body);
      const logId = body.data[0].id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/logs/${logId}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const logBody = JSON.parse(response.body);
      expect(logBody.data.id).to.equal(logId);
    });

    it('should return 404 for non-existent log', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/nonexistent-id',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('LOG_NOT_FOUND');
    });

    it('should reject EMPLOYEE from getting log', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/any-id',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('GET /admin/logs/export', function () {
    it('should export logs as CSV', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/export?format=csv',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers['content-type']).to.include('text/csv');
    });

    it('should export logs as JSON', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/export?format=json',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers['content-type']).to.include('application/json');
    });

    it('should default to JSON if format not specified', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/export',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers['content-type']).to.include('application/json');
    });

    it('should reject EMPLOYEE from exporting logs', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/export',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('GET /admin/logs/stream', function () {
    it('should reject EMPLOYEE from streaming logs', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/logs/stream',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          Authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).to.equal(403);
    });
  });
});
