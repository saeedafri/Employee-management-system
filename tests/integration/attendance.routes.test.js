import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestEmployee, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Attendance Management Routes Integration Tests', function () {
  this.timeout(15000);

  let app;
  let testTenant;
  let employeeUser;
  let managerUser;
  let employee;
  let manager;
  let accessToken;
  let managerAccessToken;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();

    employeeUser = await createTestUser(testTenant.id, {
      email: 'employee@example.com',
      memberType: 'EMPLOYEE',
    });

    managerUser = await createTestUser(testTenant.id, {
      email: 'manager@example.com',
      memberType: 'MANAGER',
    });

    employee = await createTestEmployee(testTenant.id, employeeUser.id, {
      firstName: 'John',
      lastName: 'Doe',
      employeeCode: 'EMP001',
    });

    manager = await createTestEmployee(testTenant.id, managerUser.id, {
      firstName: 'Jane',
      lastName: 'Manager',
      employeeCode: 'MGR001',
    });

    await prisma.employee.update({
      where: { id: employee.id },
      data: { managerId: manager.id },
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'employee@example.com',
        password: 'password',
      },
    });
    accessToken = JSON.parse(loginResponse.body).data.accessToken;

    const managerLoginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'manager@example.com',
        password: 'password',
      },
    });
    managerAccessToken = JSON.parse(managerLoginResponse.body).data.accessToken;
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('POST /attendance/check-in', function () {
    it('should check in successfully', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          latitude: 28.5244,
          longitude: 77.1855,
          note: 'Checked in from office',
        },
      });

      expect(response.statusCode).to.equal(201);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.have.property('id');
      expect(body.data).to.have.property('checkInAt');
      expect(body.data.geofenceValid).to.be.true;
    });

    it('should check in without geofence data', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).to.equal(201);
      const body = JSON.parse(response.body);
      expect(body.data).to.have.property('id');
    });

    it('should prevent duplicate check-in same day', async function () {
      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('ALREADY_CHECKED_IN');
    });

    it('should detect geofence violation', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          latitude: 40.7128,
          longitude: -74.0060,
          note: 'Remote check-in',
        },
      });

      expect(response.statusCode).to.equal(201);
      const body = JSON.parse(response.body);
      expect(body.data.geofenceValid).to.be.false;
    });
  });

  describe('POST /attendance/check-out', function () {
    it('should check out successfully after check-in', async function () {
      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-out',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          note: 'Checked out from office',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.have.property('checkOutAt');
      expect(body.data).to.have.property('durationMinutes');
    });

    it('should prevent checkout without check-in', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-out',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('NO_CHECK_IN');
    });

    it('should prevent duplicate checkout', async function () {
      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-out',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-out',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('ALREADY_CHECKED_OUT');
    });
  });

  describe('GET /attendance/records', function () {
    it('should get attendance records with pagination', async function () {
      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/records?page=1&limit=10',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.records).to.be.an('array');
      expect(body.data.pagination.total).to.equal(1);
    });

    it('should filter records by date range', async function () {
      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      const today = new Date().toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance/records?fromDate=${yesterday}&toDate=${today}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.records.length).to.equal(1);
    });
  });

  describe('GET /attendance/team/records', function () {
    it('should get team attendance records for manager', async function () {
      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/team/records?page=1&limit=10',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${managerAccessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.records.length).to.equal(1);
      expect(body.data.records[0].employeeCode).to.equal('EMP001');
    });

    it('should deny access for non-manager', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/team/records',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('GET /attendance/summary', function () {
    it('should get attendance summary', async function () {
      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/summary',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.have.property('totalDays');
      expect(body.data).to.have.property('present');
      expect(body.data).to.have.property('attendancePercentage');
    });

    it('should calculate summary with date range', async function () {
      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/check-in',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {},
      });

      const today = new Date().toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/attendance/summary?fromDate=${yesterday}&toDate=${today}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.totalDays).to.be.at.least(1);
    });
  });

  describe('POST /attendance/regularization', function () {
    it('should create regularization request', async function () {
      const attendanceDate = new Date().toISOString();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/regularization',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          attendanceDate,
          type: 'LATE',
          reason: 'Traffic jam on the way to office caused late arrival',
        },
      });

      expect(response.statusCode).to.equal(201);
      const body = JSON.parse(response.body);
      expect(body.data).to.have.property('id');
      expect(body.data.status).to.equal('PENDING');
      expect(body.data.type).to.equal('LATE');
    });

    it('should validate regularization reason length', async function () {
      const attendanceDate = new Date().toISOString();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/regularization',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          attendanceDate,
          type: 'LATE',
          reason: 'Short reason',
        },
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe('GET /attendance/regularization', function () {
    it('should get regularization requests', async function () {
      const attendanceDate = new Date().toISOString();

      await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/regularization',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          attendanceDate,
          type: 'LATE',
          reason: 'Traffic jam on the way to office caused late arrival',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/attendance/regularization?page=1&limit=10',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.requests).to.be.an('array');
      expect(body.data.requests.length).to.equal(1);
    });
  });

  describe('PATCH /attendance/regularization/:id/approve', function () {
    it('should approve regularization request', async function () {
      const attendanceDate = new Date().toISOString();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/regularization',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          attendanceDate,
          type: 'LATE',
          reason: 'Traffic jam on the way to office caused late arrival',
        },
      });

      const regularizationId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/attendance/regularization/${regularizationId}/approve`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${managerAccessToken}`,
        },
        payload: {
          reviewerComment: 'Approved',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('APPROVED');
    });
  });

  describe('PATCH /attendance/regularization/:id/deny', function () {
    it('should deny regularization request', async function () {
      const attendanceDate = new Date().toISOString();

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/attendance/regularization',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          attendanceDate,
          type: 'LATE',
          reason: 'Traffic jam on the way to office caused late arrival',
        },
      });

      const regularizationId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/attendance/regularization/${regularizationId}/deny`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${managerAccessToken}`,
        },
        payload: {
          reviewerComment: 'Cannot approve, please check with HR',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('DENIED');
    });
  });
});
