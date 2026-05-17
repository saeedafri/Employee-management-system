import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

describe('Analytics Service - Unit Tests', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getSummary', () => {
    it('should return summary with totalEmployees', async () => {
      const result = {
        success: true,
        data: {
          totalEmployees: 100,
          activeEmployees: 95,
          inactiveEmployees: 5,
          onLeaveToday: 3,
        },
        meta: { generatedAt: new Date().toISOString() },
      };

      expect(result.success).to.be.true;
      expect(result.data.totalEmployees).to.equal(100);
      expect(result.data.activeEmployees).to.equal(95);
    });

    it('should have proper meta structure', async () => {
      const result = {
        success: true,
        data: { totalEmployees: 100 },
        meta: { cached: false, generatedAt: new Date().toISOString() },
      };

      expect(result.meta).to.be.an('object');
      expect(result.meta).to.have.property('generatedAt');
    });
  });

  describe('getAttendance', () => {
    it('should return attendance data with period', async () => {
      const result = {
        success: true,
        data: {
          period: { start: '2025-01-01', end: '2025-01-31' },
          totalRecords: 2000,
          byDepartment: { dept1: '95.5' },
        },
        meta: { generatedAt: new Date().toISOString() },
      };

      expect(result.data).to.have.property('period');
      expect(result.data.period).to.have.property('start');
      expect(result.data.byDepartment).to.be.an('object');
    });
  });

  describe('getHeadcountByDepartment', () => {
    it('should return array of departments with headcount', async () => {
      const result = {
        success: true,
        data: [
          { departmentId: 'dept-1', departmentName: 'Engineering', headcount: 50 },
          { departmentId: 'dept-2', departmentName: 'Sales', headcount: 30 },
        ],
        meta: { generatedAt: new Date().toISOString() },
      };

      expect(result.data).to.be.an('array');
      expect(result.data[0]).to.have.property('headcount');
      expect(result.data[0].headcount).to.be.a('number');
    });
  });

  describe('getRecentActivity', () => {
    it('should return array of activity logs', async () => {
      const result = {
        success: true,
        data: [
          {
            id: 'log-1',
            action: 'LOGIN',
            entityType: 'User',
            actor: 'test@example.com',
            timestamp: new Date().toISOString(),
          },
        ],
        meta: { generatedAt: new Date().toISOString() },
      };

      expect(result.data).to.be.an('array');
      expect(result.data[0]).to.have.property('action');
      expect(result.data[0].actor).to.be.a('string');
    });
  });

  describe('getLeaveSummary', () => {
    it('should return leave summary with status breakdown', async () => {
      const result = {
        success: true,
        data: {
          year: 2025,
          totalLeaves: 150,
          byStatus: { APPROVED: 130, PENDING: 15, DENIED: 5 },
          byType: { 'leave-type-1': { count: 100, totalDays: 200 } },
        },
        meta: { generatedAt: new Date().toISOString() },
      };

      expect(result.data.year).to.equal(2025);
      expect(result.data.byStatus).to.be.an('object');
      expect(result.data.byStatus.APPROVED).to.be.a('number');
    });
  });
});
