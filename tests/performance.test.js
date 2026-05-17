import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from './helpers.js';
import { prisma } from '../src/plugins/prisma.js';

describe('Performance Tests - Dashboard APIs', function () {
  this.timeout(30000);
  let app;
  let testTenant;
  let managerToken;
  let employeeToken;
  let managerId;

  before(async () => {
    app = await createTestApp();
    await cleanDatabase();
    testTenant = await createTestTenant();

    // Create manager
    const manager = await createTestUser(testTenant.id, {
      email: 'manager@test.com',
      memberType: 'MANAGER',
    });

    // Create employee
    await createTestUser(testTenant.id, {
      email: 'emp@test.com',
      memberType: 'EMPLOYEE',
    });

    managerId = manager.id;

    // Get manager token
    const managerLoginResp = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'manager@test.com', password: 'password' },
    });
    const managerData = JSON.parse(managerLoginResp.body);
    managerToken = `Bearer ${managerData.data.accessToken}`;

    // Get employee token
    const empLoginResp = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'emp@test.com', password: 'password' },
    });
    const empData = JSON.parse(empLoginResp.body);
    employeeToken = `Bearer ${empData.data.accessToken}`;

    // Create team data for manager
    for (let i = 0; i < 10; i++) {
      const emp = await createTestUser(testTenant.id, {
        email: `emp${i}@test.com`,
        memberType: 'EMPLOYEE',
      });
      // Link to manager
      const empRecord = await prisma.employee.findFirst({
        where: { userId: emp.id },
      });
      if (empRecord) {
        await prisma.employee.update({
          where: { id: empRecord.id },
          data: { managerId },
        });
      }
    }
  });

  after(async () => {
    await app.close();
    await cleanDatabase();
  });

  describe('Manager Dashboard Performance', () => {
    it('GET /api/v1/manager/dashboard should complete in <150ms p95', async () => {
      const times = [];
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await app.inject({
          method: 'GET',
          url: '/api/v1/manager/dashboard',
          headers: {
            authorization: managerToken,
            'x-tenant-key': testTenant.tenantKey,
          },
        });
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1000000;
        times.push(ms);
      }
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)];
      expect(p95).to.be.lessThan(150);
    });

    it('GET /api/v1/manager/team should complete in <150ms p95', async () => {
      const times = [];
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await app.inject({
          method: 'GET',
          url: '/api/v1/manager/team',
          headers: {
            authorization: managerToken,
            'x-tenant-key': testTenant.tenantKey,
          },
        });
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1000000;
        times.push(ms);
      }
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)];
      expect(p95).to.be.lessThan(150);
    });
  });

  describe('Employee Dashboard Performance', () => {
    it('GET /api/v1/employee/dashboard should complete in <120ms p95', async () => {
      const times = [];
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await app.inject({
          method: 'GET',
          url: '/api/v1/employee/dashboard',
          headers: {
            authorization: employeeToken,
            'x-tenant-key': testTenant.tenantKey,
          },
        });
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1000000;
        times.push(ms);
      }
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)];
      expect(p95).to.be.lessThan(120);
    });

    it('GET /api/v1/attendance/today should complete in <120ms p95', async () => {
      const times = [];
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await app.inject({
          method: 'GET',
          url: '/api/v1/attendance/today',
          headers: {
            authorization: employeeToken,
            'x-tenant-key': testTenant.tenantKey,
          },
        });
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1000000;
        times.push(ms);
      }
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)];
      expect(p95).to.be.lessThan(120);
    });
  });

  describe('Analytics Caching Performance', () => {
    it('GET /api/v1/analytics/summary cached should complete in <20ms p95', async () => {
      // Warm up cache
      await app.inject({
        method: 'GET',
        url: '/api/v1/analytics/summary',
        headers: {
          authorization: managerToken,
          'x-tenant-key': testTenant.tenantKey,
        },
      });

      const times = [];
      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await app.inject({
          method: 'GET',
          url: '/api/v1/analytics/summary',
          headers: {
            authorization: managerToken,
            'x-tenant-key': testTenant.tenantKey,
          },
        });
        const end = process.hrtime.bigint();
        const ms = Number(end - start) / 1000000;
        times.push(ms);
      }
      times.sort((a, b) => a - b);
      const p95 = times[Math.floor(times.length * 0.95)];
      expect(p95).to.be.lessThan(20);
    });
  });
});
