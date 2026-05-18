import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestEmployee, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Reports Routes Integration Tests', function () {
  this.timeout(15000);

  let app;
  let testTenant;
  let hrAdminUser;
  let employee;
  let accessToken;
  let hrAdminToken;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();

    const employeeUser = await createTestUser(testTenant.id, {
      email: 'employee@example.com',
      memberType: 'EMPLOYEE',
    });

    hrAdminUser = await createTestUser(testTenant.id, {
      email: 'admin@example.com',
      memberType: 'HR_ADMIN',
    });

    employee = await createTestEmployee(testTenant.id, employeeUser.id, {
      employeeCode: 'EMP001',
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'employee@example.com', password: 'password' },
    });
    accessToken = JSON.parse(loginResponse.body).data.accessToken;

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'admin@example.com', password: 'password' },
    });
    hrAdminToken = JSON.parse(adminLogin.body).data.accessToken;

    await prisma.attendanceRecord.create({
      data: {
        tenantId: testTenant.id,
        employeeId: employee.id,
        attendanceDate: new Date('2024-05-01'),
        status: 'PRESENT',
      },
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('GET /api/v1/reports/attendance', function () {
    it('should get attendance report', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/attendance?format=json',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.have.property('summary');
      expect(data.data).to.have.property('by_department');
    });

    it('should get attendance report with date filter', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/attendance?from_date=2024-05-01&to_date=2024-05-31',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
    });
  });

  describe('GET /api/v1/reports/leaves', function () {
    it('should get leaves report', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/leaves',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.have.property('by_status');
      expect(data.data).to.have.property('by_type');
    });
  });

  describe('GET /api/v1/reports/payroll', function () {
    it('should get payroll report', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/payroll?month=5&year=2024',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.have.property('total_payroll');
      expect(data.data).to.have.property('by_department');
    });

    it('should reject missing month', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/payroll?year=2024',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe('POST /api/v1/reports/schedule', function () {
    it('should create scheduled report as HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/reports/schedule',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
        payload: {
          report_type: 'attendance',
          frequency: 'WEEKLY',
          email_recipients: ['admin@example.com'],
        },
      });

      expect(response.statusCode).to.equal(201);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.have.property('id');
      expect(data.data.frequency).to.equal('WEEKLY');
    });

    it('should reject non-HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/reports/schedule',
        headers: { Authorization: `Bearer ${accessToken}` },
        payload: {
          report_type: 'attendance',
          frequency: 'WEEKLY',
          email_recipients: ['admin@example.com'],
        },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('GET /api/v1/reports/scheduled', function () {
    beforeEach(async function () {
      await prisma.scheduledReport.create({
        data: {
          tenantId: testTenant.id,
          createdById: hrAdminUser.id,
          reportType: 'attendance',
          frequency: 'WEEKLY',
          emailRecipients: ['admin@example.com'],
          nextRunDate: new Date(),
        },
      });
    });

    it('should list scheduled reports as HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/scheduled',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data.reports).to.be.an('array');
    });
  });

  describe('PATCH /api/v1/reports/scheduled/:id', function () {
    let scheduledReportId;

    beforeEach(async function () {
      const report = await prisma.scheduledReport.create({
        data: {
          tenantId: testTenant.id,
          createdById: hrAdminUser.id,
          reportType: 'attendance',
          frequency: 'WEEKLY',
          emailRecipients: ['admin@example.com'],
          nextRunDate: new Date(),
        },
      });
      scheduledReportId = report.id;
    });

    it('should update scheduled report as HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/reports/scheduled/${scheduledReportId}`,
        headers: { Authorization: `Bearer ${hrAdminToken}` },
        payload: {
          frequency: 'MONTHLY',
        },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data.frequency).to.equal('MONTHLY');
    });
  });

  describe('DELETE /api/v1/reports/scheduled/:id', function () {
    let scheduledReportId;

    beforeEach(async function () {
      const report = await prisma.scheduledReport.create({
        data: {
          tenantId: testTenant.id,
          createdById: hrAdminUser.id,
          reportType: 'attendance',
          frequency: 'WEEKLY',
          emailRecipients: ['admin@example.com'],
          nextRunDate: new Date(),
        },
      });
      scheduledReportId = report.id;
    });

    it('should delete scheduled report as HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/reports/scheduled/${scheduledReportId}`,
        headers: { Authorization: `Bearer ${hrAdminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data.status).to.equal('archived');
    });
  });

  describe('GET /api/v1/reports/export-history', function () {
    beforeEach(async function () {
      await prisma.reportExport.create({
        data: {
          tenantId: testTenant.id,
          createdById: hrAdminUser.id,
          reportType: 'attendance',
          format: 'json',
          status: 'SUCCESS',
        },
      });
    });

    it('should get export history as HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/export-history',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data.exports).to.be.an('array');
    });

    it('should filter by status', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/reports/export-history?status=SUCCESS',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
    });
  });
});
