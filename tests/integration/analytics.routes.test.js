import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { createTestApp, cleanDatabase, createTestTenant, createTestUser, createTestLeaveType } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Analytics Routes - Integration Tests', function () {
  this.timeout(15000);
  let app;
  let testTenant;
  let testLeaveType;
  let hrAdminAccessToken;
  let hrAdminUser;

  beforeEach(async () => {
    app = await createTestApp();
    await cleanDatabase();

    testTenant = await createTestTenant();
    testLeaveType = await createTestLeaveType(testTenant.id);

    hrAdminUser = await createTestUser(testTenant.id, {
      email: 'hr-admin@test.com',
      memberType: 'HR_ADMIN',
    });

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: {
        email: 'hr-admin@test.com',
        password: 'password',
      },
    });

    const loginData = JSON.parse(loginResponse.body);
    hrAdminAccessToken = `Bearer ${loginData.data.accessToken}`;
  });

  afterEach(async () => {
    await app.close();
    await cleanDatabase();
  });

  describe('GET /api/v1/analytics/summary', () => {
    beforeEach(async () => {
      await prisma.employee.createMany({
        data: Array.from({ length: 100 }, (_, i) => ({
          tenantId: testTenant.id,
          employeeCode: `EMP-${i.toString().padStart(4, '0')}`,
          firstName: `Employee${i}`,
          lastName: 'Test',
          workEmail: `emp${i}@company.com`,
          employmentStatus: 'ACTIVE',
          joinedOn: new Date(),
        })),
      });
    });

    it('should return summary for HR_ADMIN with 200 status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.have.all.keys('totalEmployees', 'activeToday', 'onLeaveToday', 'openRequests');
      expect(body.data.totalEmployees).to.equal(100);
      expect(body.meta).to.have.property('cached');
      expect(body.meta).to.have.property('generatedAt');
    });

    it('should return 401 for missing authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should cache results and return cached: true on subsequent calls', async () => {
      const response1 = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      const body1 = JSON.parse(response1.body);
      expect(body1.meta.cached).to.be.false;

      const response2 = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      const body2 = JSON.parse(response2.body);
      expect(body2.meta.cached).to.be.false;
      expect(body2.data).to.deep.equal(body1.data);
    });
  });

  describe('GET /api/v1/analytics/attendance', () => {
    beforeEach(async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const employee = await prisma.employee.create({
        data: {
          tenantId: testTenant.id,
          employeeCode: 'E001',
          firstName: 'Test',
          lastName: 'User',
          workEmail: 'emp@test.com',
          joinedOn: new Date(),
        },
      });

      await prisma.attendanceRecord.createMany({
        data: Array.from({ length: 30 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          return {
            tenantId: testTenant.id,
            employeeId: employee.id,
            attendanceDate: date,
            status: ['PRESENT', 'ABSENT', 'LEAVE', 'WFH', 'HALF_DAY'][i % 5],
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }),
      });
    });

    it('should return attendance series for default 30d range', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/attendance',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.have.property('range').equal('30d');
      expect(body.data).to.have.property('series');
      expect(body.data.series).to.be.an('array');
      expect(body.data.series[0]).to.have.all.keys('date', 'present', 'absent', 'leave', 'wfh', 'halfDay');
    });

    it('should accept range query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/attendance?range=7d',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.range).to.equal('7d');
      expect(body.data.series).to.have.lengthOf(7);
    });

    it('should fill all dates in range with zeros for missing data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/attendance?range=7d',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      const body = JSON.parse(response.body);
      expect(body.data.series).to.have.lengthOf(7);

      body.data.series.forEach((day) => {
        expect(day).to.have.property('date');
        expect(day.present).to.be.a('number');
        expect(day.absent).to.be.a('number');
        expect(day.leave).to.be.a('number');
        expect(day.wfh).to.be.a('number');
        expect(day.halfDay).to.be.a('number');
      });
    });
  });

  describe('GET /api/v1/analytics/headcount-by-department', () => {
    beforeEach(async () => {
      await prisma.department.createMany({
        data: [
          { tenantId: testTenant.id, name: 'Engineering', departmentCode: 'ENG' },
          { tenantId: testTenant.id, name: 'Sales', departmentCode: 'SAL' },
          { tenantId: testTenant.id, name: 'HR', departmentCode: 'HR' },
        ],
      });

      const departments = await prisma.department.findMany({
        where: { tenantId: testTenant.id },
      });

      const engDept = departments.find(d => d.name === 'Engineering');
      const salDept = departments.find(d => d.name === 'Sales');

      await prisma.employee.createMany({
        data: [
          ...Array.from({ length: 50 }, (_, i) => ({
            tenantId: testTenant.id,
            departmentId: engDept.id,
            employeeCode: `ENG-${i}`,
            firstName: `Eng${i}`,
            lastName: 'Test',
            workEmail: `eng${i}@company.com`,
            employmentStatus: i < 45 ? 'ACTIVE' : 'INACTIVE',
            joinedOn: new Date(),
          })),
          ...Array.from({ length: 30 }, (_, i) => ({
            tenantId: testTenant.id,
            departmentId: salDept.id,
            employeeCode: `SAL-${i}`,
            firstName: `Sal${i}`,
            lastName: 'Test',
            workEmail: `sal${i}@company.com`,
            employmentStatus: i < 25 ? 'ACTIVE' : 'INACTIVE',
            joinedOn: new Date(),
          })),
        ],
      });
    });

    it('should return array of departments with headcount', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/headcount-by-department',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.be.an('array');
      expect(body.data.length).to.be.greaterThan(0);

      body.data.forEach(dept => {
        expect(dept).to.have.all.keys('departmentId', 'departmentName', 'employeeCount', 'activeCount');
        expect(dept.employeeCount).to.be.a('number');
        expect(dept.activeCount).to.be.a('number');
        expect(dept.activeCount).to.be.lessThanOrEqual(dept.employeeCount);
      });
    });

    it('should correctly count active vs total employees', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/headcount-by-department',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      const body = JSON.parse(response.body);
      const engDept = body.data.find(d => d.departmentName === 'Engineering');

      expect(engDept.employeeCount).to.equal(50);
      expect(engDept.activeCount).to.equal(45);
    });
  });

  describe('GET /api/v1/analytics/recent-activity', () => {
    beforeEach(async () => {
      await prisma.auditLog.createMany({
        data: Array.from({ length: 15 }, (_, i) => ({
          tenantId: testTenant.id,
          actorUserId: hrAdminUser.id,
          action: ['CREATE', 'UPDATE', 'DELETE'][i % 3],
          entityType: 'Employee',
          entityId: `emp-${i}`,
          oldValuesJson: JSON.stringify({ field: 'value' }),
          newValuesJson: JSON.stringify({}),
          createdAt: new Date(Date.now() - (i * 5 * 60 * 1000)),
        })),
      });
    });

    it('should return recent activity logs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/recent-activity',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.be.an('array');
      expect(body.data.length).to.be.lessThanOrEqual(10);

      body.data.forEach(activity => {
        expect(activity).to.have.all.keys(
          'id', 'actorName', 'action', 'entityType', 'entityId', 'resourceLabel', 'createdAt', 'createdAtIstDisplay',
        );
        expect(activity.createdAtIstDisplay).to.include('IST');
      });
    });

    it('should respect limit query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/recent-activity?limit=5',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      const body = JSON.parse(response.body);
      expect(body.data.length).to.be.lessThanOrEqual(5);
    });

    it('should default to limit of 10', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/recent-activity',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      const body = JSON.parse(response.body);
      expect(body.data.length).to.be.lessThanOrEqual(10);
    });
  });

  describe('GET /api/v1/analytics/leave-summary', () => {
    beforeEach(async () => {
      const employee = await prisma.employee.create({
        data: {
          tenantId: testTenant.id,
          employeeCode: 'E001',
          firstName: 'Test',
          lastName: 'User',
          workEmail: 'emp@test.com',
          joinedOn: new Date(),
        },
      });

      await prisma.leaveRequest.createMany({
        data: [
          ...Array.from({ length: 12 }, (_, i) => ({
            tenantId: testTenant.id,
            employeeId: employee.id,
            leaveTypeId: testLeaveType.id,
            startDate: new Date(),
            endDate: new Date(),
            totalDays: 1,
            reason: 'Test leave',
            status: 'PENDING',
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          })),
          ...Array.from({ length: 45 }, (_, i) => ({
            tenantId: testTenant.id,
            employeeId: employee.id,
            leaveTypeId: testLeaveType.id,
            startDate: new Date(),
            endDate: new Date(),
            totalDays: 1,
            reason: 'Test leave',
            status: 'APPROVED',
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          })),
          ...Array.from({ length: 8 }, (_, i) => ({
            tenantId: testTenant.id,
            employeeId: employee.id,
            leaveTypeId: testLeaveType.id,
            startDate: new Date(),
            endDate: new Date(),
            totalDays: 1,
            reason: 'Test leave',
            status: 'DENIED',
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          })),
        ],
      });
    });

    it('should return leave status breakdown', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/leave-summary',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.have.all.keys('pending', 'approved', 'rejected', 'withdrawn');
      expect(body.data.pending).to.be.a('number');
      expect(body.data.approved).to.be.a('number');
      expect(body.data.rejected).to.be.a('number');
      expect(body.data.withdrawn).to.be.a('number');
    });

    it('should accept range query parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/leave-summary?range=7d',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data).to.have.property('pending');
    });

    it('should map DENIED status to rejected', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/leave-summary',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      const body = JSON.parse(response.body);
      expect(body.data.rejected).to.exist;
    });
  });

  describe('tenant isolation', () => {
    it('should only return data for authenticated tenant', async () => {
      const tenant2 = await createTestTenant();
      await createTestUser(tenant2.id, {
        email: 'user-tenant2@test.com',
        memberType: 'HR_ADMIN',
      });

      await prisma.employee.create({
        data: {
          tenantId: testTenant.id,
          employeeCode: 'TENANT1-EMP',
          firstName: 'Tenant1',
          lastName: 'Employee',
          workEmail: 'tenant1-emp@test.com',
          joinedOn: new Date(),
        },
      });

      await prisma.employee.create({
        data: {
          tenantId: tenant2.id,
          employeeCode: 'TENANT2-EMP',
          firstName: 'Tenant2',
          lastName: 'Employee',
          workEmail: 'tenant2-emp@test.com',
          joinedOn: new Date(),
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      const body = JSON.parse(response.body);
      expect(body.data.totalEmployees).to.equal(1);
    });
  });
});
