import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestEmployee, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Export Routes Integration Tests', function () {
  this.timeout(15000);

  let app;
  let testTenant;
  let adminUser;
  let adminToken;
  let testEmployee;
  let testDepartment;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();

    testDepartment = await prisma.department.create({
      data: {
        tenantId: testTenant.id,
        name: 'Engineering',
        departmentCode: 'ENG',
      },
    });

    adminUser = await createTestUser(testTenant.id, {
      email: 'admin@example.com',
      memberType: 'HR_ADMIN',
    });

    adminToken = await generateTestToken(adminUser.id, testTenant.id);

    testEmployee = await createTestEmployee(testTenant.id, null, {
      firstName: 'John',
      lastName: 'Doe',
      departmentId: testDepartment.id,
    });

    await prisma.attendanceRecord.create({
      data: {
        tenantId: testTenant.id,
        employeeId: testEmployee.id,
        attendanceDate: new Date('2025-05-15'),
        status: 'PRESENT',
        checkInAt: new Date('2025-05-15T09:00:00'),
        checkOutAt: new Date('2025-05-15T18:00:00'),
      },
    });

    const leaveType = await prisma.leaveType.create({
      data: {
        tenantId: testTenant.id,
        name: 'Sick Leave',
        code: 'SL',
      },
    });

    await prisma.leaveRequest.create({
      data: {
        tenantId: testTenant.id,
        employeeId: testEmployee.id,
        leaveTypeId: leaveType.id,
        startDate: new Date('2025-05-20'),
        endDate: new Date('2025-05-21'),
        totalDays: 2,
        reason: 'Medical reasons',
        status: 'PENDING',
      },
    });
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('POST /api/v1/export/employees', function () {
    it('should queue employee export for HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/employees',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          format: 'csv',
          department_id: testDepartment.id,
          include_archived: false,
        },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data.job_id).to.exist;
      expect(body.data.status).to.equal('QUEUED');
      expect(body.data.estimated_completion_time).to.be.a('number');

      const exportJob = await prisma.exportJob.findUnique({
        where: { jobId: body.data.job_id },
      });
      expect(exportJob).to.exist;
      expect(exportJob.exportType).to.equal('EMPLOYEES');
      expect(exportJob.format).to.equal('csv');
    });

    it('should reject non-HR_ADMIN users', async function () {
      const regularUser = await createTestUser(testTenant.id, {
        email: 'user@example.com',
        memberType: 'EMPLOYEE',
      });
      const userToken = await generateTestToken(regularUser.id, testTenant.id);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/employees',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { format: 'csv' },
      });

      expect(response.statusCode).to.equal(403);
    });

    it('should accept excel format', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/employees',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { format: 'excel' },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;

      const exportJob = await prisma.exportJob.findUnique({
        where: { jobId: body.data.job_id },
      });
      expect(exportJob.format).to.equal('excel');
    });

    it('should accept json format', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/employees',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { format: 'json' },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;

      const exportJob = await prisma.exportJob.findUnique({
        where: { jobId: body.data.job_id },
      });
      expect(exportJob.format).to.equal('json');
    });
  });

  describe('POST /api/v1/export/attendance', function () {
    it('should queue attendance export', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          format: 'csv',
          from_date: '2025-05-01',
          to_date: '2025-05-31',
          department_id: testDepartment.id,
        },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data.job_id).to.exist;
      expect(body.data.status).to.equal('QUEUED');

      const exportJob = await prisma.exportJob.findUnique({
        where: { jobId: body.data.job_id },
      });
      expect(exportJob.exportType).to.equal('ATTENDANCE');
    });

    it('should reject without required date fields', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { format: 'csv' },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should accept date range filter', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/attendance',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          format: 'excel',
          from_date: '2025-05-10',
          to_date: '2025-05-20',
        },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.body);
      const exportJob = await prisma.exportJob.findUnique({
        where: { jobId: body.data.job_id },
      });
      expect(exportJob.filters.from_date).to.exist;
      expect(exportJob.filters.to_date).to.exist;
    });
  });

  describe('POST /api/v1/export/leave', function () {
    it('should queue leave export', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/leave',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          format: 'csv',
          from_date: '2025-05-01',
          to_date: '2025-05-31',
        },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data.job_id).to.exist;
      expect(body.data.status).to.equal('QUEUED');

      const exportJob = await prisma.exportJob.findUnique({
        where: { jobId: body.data.job_id },
      });
      expect(exportJob.exportType).to.equal('LEAVE');
    });

    it('should accept leave_type filter', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/leave',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          format: 'json',
          from_date: '2025-05-01',
          to_date: '2025-05-31',
          leave_type: 'SL',
        },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.body);
      const exportJob = await prisma.exportJob.findUnique({
        where: { jobId: body.data.job_id },
      });
      expect(exportJob.filters.leave_type).to.equal('SL');
    });

    it('should accept status filter', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/export/leave',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          format: 'csv',
          from_date: '2025-05-01',
          to_date: '2025-05-31',
          status: 'APPROVED',
        },
      });

      expect(response.statusCode).to.equal(202);
      const body = JSON.parse(response.body);
      const exportJob = await prisma.exportJob.findUnique({
        where: { jobId: body.data.job_id },
      });
      expect(exportJob.filters.status).to.equal('APPROVED');
    });
  });

  describe('GET /api/v1/export/:job_id/download', function () {
    it('should return status for QUEUED job', async function () {
      const queueResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/export/employees',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { format: 'csv' },
      });

      const jobId = JSON.parse(queueResponse.body).data.job_id;

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/export/${jobId}/download`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('QUEUED');
      expect(body.data.job_id).to.equal(jobId);
    });

    it('should return status for PROCESSING job', async function () {
      await prisma.exportJob.create({
        data: {
          tenantId: testTenant.id,
          jobId: 'test-processing-job',
          exportType: 'EMPLOYEES',
          format: 'csv',
          status: 'PROCESSING',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/export/test-processing-job/download',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('PROCESSING');
    });

    it('should return error for FAILED job', async function () {
      await prisma.exportJob.create({
        data: {
          tenantId: testTenant.id,
          jobId: 'test-failed-job',
          exportType: 'EMPLOYEES',
          format: 'csv',
          status: 'FAILED',
          errorMessage: 'Database connection failed',
          completedAt: new Date(),
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/export/test-failed-job/download',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('FAILED');
      expect(body.data.error_message).to.equal('Database connection failed');
    });

    it('should reject non-existent job', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/export/non-existent-job/download',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).to.equal(404);
    });

    it('should restrict access to non-HR_ADMIN', async function () {
      const regularUser = await createTestUser(testTenant.id, {
        email: 'user@example.com',
        memberType: 'EMPLOYEE',
      });
      const userToken = await generateTestToken(regularUser.id, testTenant.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/export/any-job/download',
        headers: { authorization: `Bearer ${userToken}` },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('GET /api/v1/export/list', function () {
    it('should list all export jobs', async function () {
      await prisma.exportJob.create({
        data: {
          tenantId: testTenant.id,
          jobId: 'job-1',
          exportType: 'EMPLOYEES',
          format: 'csv',
          status: 'SUCCESS',
          fileUrl: 'http://example.com/export-1.csv',
          completedAt: new Date(),
        },
      });

      await prisma.exportJob.create({
        data: {
          tenantId: testTenant.id,
          jobId: 'job-2',
          exportType: 'ATTENDANCE',
          format: 'excel',
          status: 'QUEUED',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/export/list',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.exports).to.be.an('array');
      expect(body.data.exports.length).to.equal(2);
      expect(body.data.pagination.total).to.equal(2);
    });

    it('should filter by status', async function () {
      await prisma.exportJob.create({
        data: {
          tenantId: testTenant.id,
          jobId: 'job-1',
          exportType: 'EMPLOYEES',
          format: 'csv',
          status: 'SUCCESS',
          fileUrl: 'http://example.com/export-1.csv',
          completedAt: new Date(),
        },
      });

      await prisma.exportJob.create({
        data: {
          tenantId: testTenant.id,
          jobId: 'job-2',
          exportType: 'ATTENDANCE',
          format: 'excel',
          status: 'FAILED',
          errorMessage: 'Test error',
          completedAt: new Date(),
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/export/list?status=SUCCESS',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.exports.length).to.equal(1);
      expect(body.data.exports[0].status).to.equal('SUCCESS');
    });

    it('should support pagination', async function () {
      for (let i = 1; i <= 15; i++) {
        await prisma.exportJob.create({
          data: {
            tenantId: testTenant.id,
            jobId: `job-${i}`,
            exportType: 'EMPLOYEES',
            format: 'csv',
            status: 'QUEUED',
          },
        });
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/export/list?page=1&limit=10',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.exports.length).to.equal(10);
      expect(body.data.pagination.total).to.equal(15);
      expect(body.data.pagination.pages).to.equal(2);
    });
  });

  describe('Security & Authorization', function () {
    it('should require authentication for all export endpoints', async function () {
      const endpoints = [
        { method: 'POST', url: '/api/v1/export/employees', payload: { format: 'csv' } },
        { method: 'POST', url: '/api/v1/export/attendance', payload: { format: 'csv', from_date: '2025-05-01', to_date: '2025-05-31' } },
        { method: 'POST', url: '/api/v1/export/leave', payload: { format: 'csv', from_date: '2025-05-01', to_date: '2025-05-31' } },
        { method: 'GET', url: '/api/v1/export/test-job/download' },
        { method: 'GET', url: '/api/v1/export/list' },
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          payload: endpoint.payload,
        });

        expect(response.statusCode).to.equal(401);
      }
    });

    it('should require HR_ADMIN role for all export endpoints', async function () {
      const managerUser = await createTestUser(testTenant.id, {
        email: 'manager@example.com',
        memberType: 'MANAGER',
      });
      const managerToken = await generateTestToken(managerUser.id, testTenant.id);

      const endpoints = [
        { method: 'POST', url: '/api/v1/export/employees', payload: { format: 'csv' } },
        { method: 'POST', url: '/api/v1/export/attendance', payload: { format: 'csv', from_date: '2025-05-01', to_date: '2025-05-31' } },
        { method: 'POST', url: '/api/v1/export/leave', payload: { format: 'csv', from_date: '2025-05-01', to_date: '2025-05-31' } },
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: endpoint.method,
          url: endpoint.url,
          headers: { authorization: `Bearer ${managerToken}` },
          payload: endpoint.payload,
        });

        expect(response.statusCode).to.equal(403);
      }
    });
  });
});

async function generateTestToken(userId, tenantId) {
  const { createAccessToken } = await import('../../src/utils/token.js');
  return createAccessToken({ userId, tenantId, memberType: 'HR_ADMIN' }, '1h');
}
