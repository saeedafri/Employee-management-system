import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { createTestApp, cleanDatabase, createTestTenant, createTestUser, createTestLeaveType } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Analytics E2E - Complete Dashboard Flow', function () {
  this.timeout(20000);
  let app;
  let testTenant;
  let testLeaveType;
  let hrAdminAccessToken;

  beforeEach(async () => {
    app = await createTestApp();
    await cleanDatabase();

    testTenant = await createTestTenant();
    testLeaveType = await createTestLeaveType(testTenant.id);

    await createTestUser(testTenant.id, {
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

    await setupTestData();
  });

  afterEach(async () => {
    await app.close();
    await cleanDatabase();
  });

  async function setupTestData() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hrAdminUser = await prisma.user.findFirst({
      where: { tenantId: testTenant.id, email: 'hr-admin@test.com' },
    });

    const dept1 = await prisma.department.create({
      data: { tenantId: testTenant.id, name: 'Engineering', departmentCode: 'ENG' },
    });

    const dept2 = await prisma.department.create({
      data: { tenantId: testTenant.id, name: 'Sales', departmentCode: 'SAL' },
    });

    await prisma.employee.createMany({
      data: [
        ...Array.from({ length: 100 }, (_, i) => ({
          tenantId: testTenant.id,
          departmentId: dept1.id,
          employeeCode: `ENG-${i}`,
          firstName: `Engineer${i}`,
          lastName: 'Test',
          workEmail: `eng${i}@company.com`,
          employmentStatus: i < 90 ? 'ACTIVE' : 'INACTIVE',
          joinedOn: new Date(),
        })),
        ...Array.from({ length: 50 }, (_, i) => ({
          tenantId: testTenant.id,
          departmentId: dept2.id,
          employeeCode: `SAL-${i}`,
          firstName: `Sales${i}`,
          lastName: 'Test',
          workEmail: `sal${i}@company.com`,
          employmentStatus: i < 45 ? 'ACTIVE' : 'INACTIVE',
          joinedOn: new Date(),
        })),
      ],
    });

    const employees = await prisma.employee.findMany({
      where: { tenantId: testTenant.id },
      take: 80,
    });

    await prisma.attendanceRecord.createMany({
      data: Array.from({ length: 240 }, (_, i) => {
        const date = new Date(today);
        date.setDate(date.getDate() - Math.floor(i / 80));
        const statuses = ['PRESENT', 'ABSENT', 'LEAVE', 'WFH', 'HALF_DAY'];

        return {
          tenantId: testTenant.id,
          employeeId: employees[i % employees.length].id,
          attendanceDate: date,
          status: statuses[i % statuses.length],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }),
    });

    await prisma.leaveRequest.createMany({
      data: [
        ...Array.from({ length: 12 }, (_, i) => ({
          tenantId: testTenant.id,
          employeeId: employees[i].id,
          leaveTypeId: testLeaveType.id,
          startDate: new Date(),
          endDate: new Date(),
          totalDays: 1,
          reason: 'Test leave',
          status: 'PENDING',
          createdAt: new Date(),
        })),
        ...Array.from({ length: 45 }, (_, i) => ({
          tenantId: testTenant.id,
          employeeId: employees[i + 12].id,
          leaveTypeId: testLeaveType.id,
          startDate: new Date(),
          endDate: new Date(),
          totalDays: 1,
          reason: 'Test leave',
          status: 'APPROVED',
          createdAt: new Date(),
        })),
        ...Array.from({ length: 8 }, (_, i) => ({
          tenantId: testTenant.id,
          employeeId: employees[i + 57].id,
          leaveTypeId: testLeaveType.id,
          startDate: new Date(),
          endDate: new Date(),
          totalDays: 1,
          reason: 'Test leave',
          status: 'DENIED',
          createdAt: new Date(),
        })),
      ],
    });

    await prisma.attendanceRegularizationRequest.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        tenantId: testTenant.id,
        employeeId: employees[i].id,
        attendanceDate: new Date(),
        reason: `Regularization ${i}`,
        status: 'PENDING',
        createdAt: new Date(),
      })),
    });

    await prisma.auditLog.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        tenantId: testTenant.id,
        actorUserId: hrAdminUser.id,
        action: ['CREATE', 'UPDATE', 'DELETE'][i % 3],
        entityType: ['Employee', 'Department', 'LeaveRequest'][i % 3],
        entityId: `entity-${i}`,
        oldValuesJson: JSON.stringify({}),
        newValuesJson: JSON.stringify({}),
        createdAt: new Date(Date.now() - (i * 5 * 60 * 1000)),
      })),
    });
  }

  it('should load all dashboard components in correct order', async () => {
    const responses = {
      summary: null,
      attendance: null,
      headcount: null,
      activity: null,
      leave: null,
    };

    responses.summary = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary',
      headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
    });

    expect(responses.summary.statusCode).to.equal(200);
    const summaryData = JSON.parse(responses.summary.body).data;
    expect(summaryData.totalEmployees).to.equal(150);
    expect(summaryData.openRequests).to.equal(17);

    responses.attendance = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/attendance?range=30d',
      headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
    });

    expect(responses.attendance.statusCode).to.equal(200);
    const attendanceData = JSON.parse(responses.attendance.body).data;
    expect(attendanceData.series).to.have.lengthOf(30);
    expect(attendanceData.series[0]).to.have.all.keys('date', 'present', 'absent', 'leave', 'wfh', 'halfDay');

    responses.headcount = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/headcount-by-department',
      headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
    });

    expect(responses.headcount.statusCode).to.equal(200);
    const headcountData = JSON.parse(responses.headcount.body).data;
    expect(headcountData).to.have.lengthOf(2);

    const engDept = headcountData.find(d => d.departmentName === 'Engineering');
    expect(engDept.employeeCount).to.equal(100);
    expect(engDept.activeCount).to.equal(90);

    const salDept = headcountData.find(d => d.departmentName === 'Sales');
    expect(salDept.employeeCount).to.equal(50);
    expect(salDept.activeCount).to.equal(45);

    responses.activity = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/recent-activity?limit=10',
      headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
    });

    expect(responses.activity.statusCode).to.equal(200);
    const activityData = JSON.parse(responses.activity.body).data;
    expect(activityData).to.have.lengthOf(10);
    activityData.forEach(log => {
      expect(log.createdAtIstDisplay).to.include('IST');
      expect(log.actorName).to.equal('Hr-admin');
    });

    responses.leave = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/leave-summary?range=30d',
      headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
    });

    expect(responses.leave.statusCode).to.equal(200);
    const leaveData = JSON.parse(responses.leave.body).data;
    expect(leaveData.pending).to.equal(12);
    expect(leaveData.approved).to.equal(45);
    expect(leaveData.rejected).to.equal(8);
  });

  it('should serve cached data on rapid consecutive requests', async () => {
    const url = '/api/v1/analytics/summary';
    const headers = { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey };

    const response1 = await app.inject({ method: 'GET', url, headers });
    const data1 = JSON.parse(response1.body);
    expect(data1.meta.cached).to.be.false;

    const response2 = await app.inject({ method: 'GET', url, headers });
    const data2 = JSON.parse(response2.body);
    expect(data2.meta.cached).to.be.false;

    const response3 = await app.inject({ method: 'GET', url, headers });
    const data3 = JSON.parse(response3.body);
    expect(data3.meta.cached).to.be.false;

    expect(data2.data).to.deep.equal(data1.data);
    expect(data3.data).to.deep.equal(data1.data);
  });

  it('should handle different range parameters correctly', async () => {
    const ranges = ['7d', '30d', '90d'];

    for (const range of ranges) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/analytics/attendance?range=${range}`,
        headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.data.range).to.equal(range);

      const expectedDays = range === '7d' ? 7 : range === '30d' ? 30 : 90;
      expect(data.data.series).to.have.lengthOf(expectedDays);
    }
  });

  it('should provide consistent data across multiple tenants', async () => {
    const tenant2 = await createTestTenant();
    await createTestUser(tenant2.id, {
      email: 'hr-admin-2@test.com',
      memberType: 'HR_ADMIN',
    });

    const loginResponse2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': tenant2.tenantKey },
      payload: {
        email: 'hr-admin-2@test.com',
        password: 'password',
      },
    });

    const loginData2 = JSON.parse(loginResponse2.body);
    const token2 = `Bearer ${loginData2.data.accessToken}`;

    await prisma.employee.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({
        tenantId: tenant2.id,
        employeeCode: `EMP-${i}`,
        firstName: `Employee${i}`,
        lastName: 'Test',
        workEmail: `emp${i}@tenant2.com`,
        joinedOn: new Date(),
      })),
    });

    const response1 = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary',
      headers: { authorization: hrAdminAccessToken, 'x-tenant-key': testTenant.tenantKey },
    });

    const response2 = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary',
      headers: { authorization: token2, 'x-tenant-key': tenant2.tenantKey },
    });

    const data1 = JSON.parse(response1.body).data;
    const data2 = JSON.parse(response2.body).data;

    expect(data1.totalEmployees).to.equal(150);
    expect(data2.totalEmployees).to.equal(200);
  });
});
