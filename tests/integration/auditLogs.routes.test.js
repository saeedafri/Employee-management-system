import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestEmployee, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Audit Logs Routes Integration Tests', function () {
  this.timeout(15000);

  let app;
  let testTenant;
  let superAdminUser;
  let auditorUser;
  let employeeUser;
  let superAdminToken;
  let auditorToken;
  let employeeToken;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();

    superAdminUser = await createTestUser(testTenant.id, {
      email: 'superadmin@example.com',
      memberType: 'SUPER_ADMIN',
    });

    auditorUser = await createTestUser(testTenant.id, {
      email: 'auditor@example.com',
      memberType: 'AUDITOR',
    });

    employeeUser = await createTestUser(testTenant.id, {
      email: 'employee@example.com',
      memberType: 'EMPLOYEE',
    });

    await createTestEmployee(testTenant.id, superAdminUser.id, { employeeCode: 'ADM001' });
    await createTestEmployee(testTenant.id, auditorUser.id, { employeeCode: 'AUD001' });
    await createTestEmployee(testTenant.id, employeeUser.id, { employeeCode: 'EMP001' });

    const superAdminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'superadmin@example.com', password: 'password' },
    });
    superAdminToken = JSON.parse(superAdminLogin.body).data.accessToken;

    const auditorLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'auditor@example.com', password: 'password' },
    });
    auditorToken = JSON.parse(auditorLogin.body).data.accessToken;

    const employeeLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'employee@example.com', password: 'password' },
    });
    employeeToken = JSON.parse(employeeLogin.body).data.accessToken;

    await prisma.auditLog.create({
      data: {
        tenantId: testTenant.id,
        actorUserId: superAdminUser.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: superAdminUser.id,
      },
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('GET /api/v1/audit-logs', function () {
    it('should get audit logs for authenticated user', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-logs',
        headers: { Authorization: `Bearer ${employeeToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.have.property('logs');
      expect(data.data).to.have.property('pagination');
    });

    it('should filter by user email', async function () {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-logs?user_email=${superAdminUser.email}`,
        headers: { Authorization: `Bearer ${employeeToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
    });

    it('should filter by action', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-logs?action=LOGIN',
        headers: { Authorization: `Bearer ${employeeToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
    });

    it('should require authentication', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-logs',
      });

      expect(response.statusCode).to.equal(401);
    });
  });

  describe('GET /api/v1/audit-logs/:id', function () {
    let auditLogId;

    beforeEach(async function () {
      const log = await prisma.auditLog.findFirst({
        where: { tenantId: testTenant.id },
      });
      auditLogId = log.id;
    });

    it('should get single audit log', async function () {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/audit-logs/${auditLogId}`,
        headers: { Authorization: `Bearer ${employeeToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.have.property('id');
      expect(data.data.action).to.equal('LOGIN');
    });

    it('should return 404 for non-existent log', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-logs/nonexistent',
        headers: { Authorization: `Bearer ${employeeToken}` },
      });

      expect(response.statusCode).to.equal(404);
    });
  });

  describe('POST /api/v1/audit-logs/dpia-report', function () {
    it('should generate DPIA report as AUDITOR', async function () {
      const fromDate = new Date('2024-05-01');
      const toDate = new Date('2024-05-31');

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/audit-logs/dpia-report',
        headers: { Authorization: `Bearer ${auditorToken}` },
        payload: {
          from_date: fromDate.toISOString(),
          to_date: toDate.toISOString(),
        },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.have.property('report_date');
      expect(data.data).to.have.property('high_access_users');
      expect(data.data).to.have.property('data_categories_accessed');
    });

    it('should reject non-AUDITOR/SUPER_ADMIN', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/audit-logs/dpia-report',
        headers: { Authorization: `Bearer ${employeeToken}` },
        payload: {
          from_date: new Date().toISOString(),
          to_date: new Date().toISOString(),
        },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('GET /api/v1/audit-logs/export', function () {
    it('should export audit logs as AUDITOR', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-logs/export?format=json',
        headers: { Authorization: `Bearer ${auditorToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers['content-type']).to.include('application/json');
    });

    it('should export as CSV', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-logs/export?format=csv',
        headers: { Authorization: `Bearer ${auditorToken}` },
      });

      expect(response.statusCode).to.equal(200);
      expect(response.headers['content-type']).to.include('text/csv');
    });

    it('should reject non-AUDITOR/SUPER_ADMIN', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/audit-logs/export',
        headers: { Authorization: `Bearer ${employeeToken}` },
      });

      expect(response.statusCode).to.equal(403);
    });
  });
});
