import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestEmployee, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Leave Management Routes Integration Tests', function () {
  this.timeout(15000);

  let app;
  let testTenant;
  let employeeUser;
  let managerUser;
  let employee;
  let manager;
  let leaveType;
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

    leaveType = await prisma.leaveType.create({
      data: {
        tenantId: testTenant.id,
        name: 'Annual Leave',
        code: 'ANNUAL',
        annualAllowance: 20,
        isPaid: true,
      },
    });

    await prisma.leaveBalance.create({
      data: {
        tenantId: testTenant.id,
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        balance: 20,
        used: 0,
        pending: 0,
      },
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

  describe('POST /leave/requests', function () {
    it('should create a leave request successfully', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 4);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Family vacation for 5 days',
        },
      });

      expect(response.statusCode).to.equal(201);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.have.property('id');
      expect(body.data.totalDays).to.equal(5);
      expect(body.data.status).to.equal('PENDING');
    });

    it('should reject leave request with insufficient balance', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 25);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Extended vacation exceeding balance',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
      expect(body.error.code).to.equal('INSUFFICIENT_BALANCE');
    });

    it('should reject leave request with invalid date range', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 1);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Invalid date range test',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.false;
    });

    it('should reject leave request with non-existent leave type', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: 'non-existent-id',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Testing with invalid leave type',
        },
      });

      expect(response.statusCode).to.equal(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('LEAVE_TYPE_NOT_FOUND');
    });
  });

  describe('GET /leave/requests', function () {
    it('should get employee leave requests with pagination', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Test leave request',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/leave/requests?page=1&limit=10',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data.requests).to.be.an('array');
      expect(body.data.requests.length).to.equal(1);
      expect(body.data.pagination.total).to.equal(1);
    });

    it('should filter leave requests by status', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Test leave request',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/leave/requests?page=1&limit=10&status=PENDING',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.requests.length).to.equal(1);
      expect(body.data.requests[0].status).to.equal('PENDING');
    });
  });

  describe('GET /leave/team/requests', function () {
    it('should get team leave requests for manager', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Team member leave',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/leave/team/requests?page=1&limit=10',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${managerAccessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.requests.length).to.equal(1);
      expect(body.data.requests[0].employeeCode).to.equal('EMP001');
    });

    it('should deny access for non-manager', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/leave/team/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('PATCH /leave/requests/:id/approve', function () {
    it('should approve pending leave request', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Test leave approval',
        },
      });

      const leaveRequestId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/leave/requests/${leaveRequestId}/approve`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${managerAccessToken}`,
        },
        payload: {
          approverComment: 'Approved',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('APPROVED');
    });
  });

  describe('PATCH /leave/requests/:id/reject', function () {
    it('should reject pending leave request', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Test leave rejection',
        },
      });

      const leaveRequestId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/leave/requests/${leaveRequestId}/reject`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${managerAccessToken}`,
        },
        payload: {
          approverComment: 'Cannot approve due to business needs',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('DENIED');
    });
  });

  describe('PATCH /leave/requests/:id/withdraw', function () {
    it('should withdraw pending leave request', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Test withdraw',
        },
      });

      const leaveRequestId = JSON.parse(createResponse.body).data.id;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/leave/requests/${leaveRequestId}/withdraw`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('WITHDRAWN');
    });

    it('should not allow withdrawing non-pending request', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 2);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Test withdraw denial',
        },
      });

      const leaveRequestId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/leave/requests/${leaveRequestId}/approve`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${managerAccessToken}`,
        },
        payload: {},
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/leave/requests/${leaveRequestId}/withdraw`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('INVALID_REQUEST_STATUS');
    });
  });

  describe('GET /leave/balance', function () {
    it('should get employee leave balance', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/leave/balance',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.balances).to.be.an('array');
      expect(body.data.balances[0].available).to.equal(20);
      expect(body.data.balances[0].used).to.equal(0);
    });

    it('should update balance after approved leave', async function () {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 4);

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/leave/requests',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
        payload: {
          leaveTypeId: leaveType.id,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reason: 'Test balance update',
        },
      });

      const leaveRequestId = JSON.parse(createResponse.body).data.id;

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/leave/requests/${leaveRequestId}/approve`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${managerAccessToken}`,
        },
        payload: {},
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/leave/balance',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.balances[0].available).to.equal(15);
      expect(body.data.balances[0].used).to.equal(5);
    });
  });
});
