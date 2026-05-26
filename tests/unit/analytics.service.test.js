import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import * as analyticsService from '../../src/modules/analytics/analytics.service.js';
import { prisma } from '../../src/plugins/prisma.js';
import { createTestLeaveType } from '../helpers.js';

describe('Analytics Service Unit Tests', function () {
  this.timeout(15000);
  let testTenant;
  let testLeaveType;

  beforeEach(async function () {
    await prisma.attendanceRegularizationRequest.deleteMany({});
    await prisma.leaveRequest.deleteMany({});
    await prisma.attendanceRecord.deleteMany({});
    await prisma.employee.deleteMany({});
    await prisma.department.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.leaveType.deleteMany({});
    await prisma.tenant.deleteMany({});

    testTenant = await prisma.tenant.create({
      data: {
        tenantKey: `test-${Date.now()}`,
        name: 'Test Tenant',
        legalName: 'Test Legal',
        displayName: 'Test',
        country: 'India',
        primaryContactEmail: 'test@test.com',
      },
    });

    testLeaveType = await createTestLeaveType(testTenant.id);

    await prisma.user.create({
      data: {
        tenantId: testTenant.id,
        email: 'test@test.com',
        passwordHash: 'hash',
        memberType: 'HR_ADMIN',
      },
    });
  });

  describe('getSummary', () => {
    it('should return summary data with correct structure', async () => {
      await prisma.employee.createMany({
        data: Array.from({ length: 100 }, (_, i) => ({
          tenantId: testTenant.id,
          employeeCode: `E${i}`,
          firstName: `User${i}`,
          lastName: 'Test',
          workEmail: `user${i}@company.com`,
          joinedOn: new Date(),
        })),
      });

      const result = await analyticsService.getSummary(testTenant.id);

      expect(result.success).to.be.true;
      expect(result.data).to.include.all.keys('totalEmployees', 'activeToday', 'onLeaveToday', 'openRequests');
      expect(result.data.totalEmployees).to.equal(100);
      expect(result.meta).to.have.property('cached');
      expect(result.meta).to.have.property('generatedAt');
    });

    it('should count openRequests as sum of pending leaves and regularizations', async () => {
      const employee = await prisma.employee.create({
        data: {
          tenantId: testTenant.id,
          employeeCode: 'E001',
          firstName: 'Test',
          lastName: 'User',
          workEmail: 'emp@company.com',
          joinedOn: new Date(),
        },
      });

      await prisma.leaveRequest.create({
        data: {
          tenantId: testTenant.id,
          employeeId: employee.id,
          leaveTypeId: testLeaveType.id,
          startDate: new Date(),
          endDate: new Date(),
          totalDays: 1,
          reason: 'Test leave',
          status: 'PENDING',
        },
      });

      await prisma.attendanceRegularizationRequest.create({
        data: {
          tenantId: testTenant.id,
          employeeId: employee.id,
          attendanceDate: new Date(),
          reason: 'Late arrival',
          status: 'PENDING',
        },
      });

      const result = await analyticsService.getSummary(testTenant.id);

      expect(result.data.openRequests).to.equal(2);
    });

    it('should return cached: false (no Redis caching)', async () => {
      const result1 = await analyticsService.getSummary(testTenant.id);
      expect(result1.meta.cached).to.be.false;

      const result2 = await analyticsService.getSummary(testTenant.id);
      expect(result2.meta.cached).to.be.false;
    });
  });

  describe('getAttendance', () => {
    it('should return attendance series with correct structure', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const employee = await prisma.employee.create({
        data: {
          tenantId: testTenant.id,
          employeeCode: 'E001',
          firstName: 'Test',
          lastName: 'User',
          workEmail: 'emp@company.com',
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

      const result = await analyticsService.getAttendance(testTenant.id, '30d');

      expect(result.success).to.be.true;
      expect(result.data.range).to.equal('30d');
      expect(result.data.series).to.have.lengthOf(30);
      expect(result.data.series[0]).to.have.all.keys('date', 'present', 'absent', 'leave', 'wfh', 'halfDay');
    });

    it('should use default range of 30d', async () => {
      const result = await analyticsService.getAttendance(testTenant.id);
      expect(result.data.range).to.equal('30d');
    });
  });

  describe('getHeadcountByDepartment', () => {
    it('should return departments with employee counts', async () => {
      const dept = await prisma.department.create({
        data: { tenantId: testTenant.id, name: 'Engineering', departmentCode: 'ENG' },
      });

      await prisma.employee.createMany({
        data: Array.from({ length: 50 }, (_, i) => ({
          tenantId: testTenant.id,
          departmentId: dept.id,
          employeeCode: `E${i}`,
          firstName: `User${i}`,
          lastName: 'Test',
          workEmail: `user${i}@company.com`,
          employmentStatus: i < 45 ? 'ACTIVE' : 'INACTIVE',
          joinedOn: new Date(),
        })),
      });

      const result = await analyticsService.getHeadcountByDepartment(testTenant.id);

      expect(result.data).to.be.an('array');
      expect(result.data[0]).to.have.all.keys('departmentId', 'departmentName', 'employeeCount', 'activeCount');
      expect(result.data[0].employeeCount).to.equal(50);
      expect(result.data[0].activeCount).to.equal(45);
    });
  });

  describe('getRecentActivity', () => {
    it('should return audit logs with IST formatting', async () => {
      const user = await prisma.user.findFirst({ where: { tenantId: testTenant.id } });

      await prisma.auditLog.createMany({
        data: Array.from({ length: 15 }, (_, i) => ({
          tenantId: testTenant.id,
          actorUserId: user.id,
          action: 'CREATE',
          entityType: 'Employee',
          entityId: `emp-${i}`,
          oldValuesJson: '{}',
          newValuesJson: '{}',
          createdAt: new Date(Date.now() - i * 5 * 60 * 1000),
        })),
      });

      const result = await analyticsService.getRecentActivity(testTenant.id, 10);

      expect(result.data).to.have.lengthOf(10);
      expect(result.data[0]).to.include.all.keys(
        'id', 'actorName', 'action', 'entityType', 'entityId', 'resourceLabel', 'createdAt', 'createdAtIstDisplay',
      );
      expect(result.data[0].createdAtIstDisplay).to.include('IST');
    });

    it('should respect limit parameter', async () => {
      const user = await prisma.user.findFirst({ where: { tenantId: testTenant.id } });

      await prisma.auditLog.createMany({
        data: Array.from({ length: 20 }, (_, i) => ({
          tenantId: testTenant.id,
          actorUserId: user.id,
          action: 'UPDATE',
          entityType: 'Employee',
          entityId: `emp-${i}`,
          oldValuesJson: '{}',
          newValuesJson: '{}',
          createdAt: new Date(),
        })),
      });

      const result = await analyticsService.getRecentActivity(testTenant.id, 5);
      expect(result.data.length).to.be.lessThanOrEqual(5);
    });
  });

  describe('getLeaveSummary', () => {
    it('should return leave status breakdown', async () => {
      const employee = await prisma.employee.create({
        data: {
          tenantId: testTenant.id,
          employeeCode: 'E001',
          firstName: 'Test',
          lastName: 'User',
          workEmail: 'emp@company.com',
          joinedOn: new Date(),
        },
      });

      await prisma.leaveRequest.createMany({
        data: [
          ...Array.from({ length: 12 }, () => ({
            tenantId: testTenant.id,
            employeeId: employee.id,
            leaveTypeId: testLeaveType.id,
            startDate: new Date(),
            endDate: new Date(),
            totalDays: 1,
            reason: 'Test leave',
            status: 'PENDING',
          })),
          ...Array.from({ length: 45 }, () => ({
            tenantId: testTenant.id,
            employeeId: employee.id,
            leaveTypeId: testLeaveType.id,
            startDate: new Date(),
            endDate: new Date(),
            totalDays: 1,
            reason: 'Test leave',
            status: 'APPROVED',
          })),
          ...Array.from({ length: 8 }, () => ({
            tenantId: testTenant.id,
            employeeId: employee.id,
            leaveTypeId: testLeaveType.id,
            startDate: new Date(),
            endDate: new Date(),
            totalDays: 1,
            reason: 'Test leave',
            status: 'DENIED',
          })),
        ],
      });

      const result = await analyticsService.getLeaveSummary(testTenant.id, '30d');

      expect(result.data).to.have.all.keys('pending', 'approved', 'rejected', 'withdrawn');
      expect(result.data.pending).to.equal(12);
      expect(result.data.approved).to.equal(45);
      expect(result.data.rejected).to.equal(8);
    });
  });
});
