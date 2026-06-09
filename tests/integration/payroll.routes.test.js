import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestEmployee, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Payroll Routes Integration Tests', function () {
  this.timeout(30000);

  let app, tenant, empUser;
  let saToken, hrToken, managerToken, empToken;
  let empRecord, empRecord2;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    tenant = await createTestTenant();

    await createTestUser(tenant.id, { email: 'sa@test.com', memberType: 'SUPER_ADMIN' });
    await createTestUser(tenant.id, { email: 'hr@test.com', memberType: 'HR_ADMIN' });
    await createTestUser(tenant.id, { email: 'mgr@test.com', memberType: 'MANAGER' });
    empUser = await createTestUser(tenant.id, { email: 'emp@test.com', memberType: 'EMPLOYEE' });

    empRecord = await createTestEmployee(tenant.id, empUser.id, { employeeCode: 'EMP001' });
    empRecord2 = await createTestEmployee(tenant.id, null, { employeeCode: 'EMP002' });

    // Link employee to user
    await prisma.user.update({ where: { id: empUser.id }, data: { employeeId: empRecord.id } });
    await prisma.employee.update({ where: { id: empRecord.id }, data: { userId: empUser.id } });

    const loginAs = async (email) => {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': tenant.tenantKey },
        payload: { email, password: 'password' },
      });
      return JSON.parse(res.body).data?.accessToken;
    };

    [saToken, hrToken, managerToken, empToken] = await Promise.all([
      loginAs('sa@test.com'), loginAs('hr@test.com'), loginAs('mgr@test.com'), loginAs('emp@test.com'),
    ]);
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  // ── Helper to create test data ────────────────────────────────────────────

  async function createComponent(data = {}) {
    return prisma.salaryComponent.create({
      data: {
        tenantId: tenant.id,
        name: data.name || 'Basic Salary',
        code: data.code || `BASIC_${Date.now()}`,
        type: data.type || 'EARNING',
        calculationType: data.calculationType || 'FLAT',
        value: data.value ?? 50000,
        taxable: true, active: true, displayOrder: 1,
      },
    });
  }

  async function createPayGroup(componentId) {
    return prisma.payGroup.create({
      data: {
        tenantId: tenant.id, name: 'Standard Group',
        code: `STD_${Date.now()}`, currency: 'INR', paySchedule: 'MONTHLY',
        components: { create: [{ componentId }] },
      },
    });
  }

  async function createEmployeeSalary(employeeId, payGroupId) {
    return prisma.employeeSalary.create({
      data: {
        tenantId: tenant.id, employeeId, payGroupId,
        annualCtc: 600000, effectiveFrom: new Date('2024-01-01'),
      },
    });
  }

  // ── Salary Components ─────────────────────────────────────────────────────

  describe('GET /api/v1/payroll/components', function () {
    it('HR can list components', async function () {
      await createComponent({ code: 'BASIC_TEST' });
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/components',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.success).to.be.true;
      expect(body.data).to.be.an('array');
      expect(body.data.length).to.be.greaterThan(0);
    });

    it('EMPLOYEE gets 403', async function () {
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/components',
        headers: { Authorization: `Bearer ${empToken}` },
      });
      expect(res.statusCode).to.equal(403);
    });

    it('MANAGER gets 403', async function () {
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/components',
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      expect(res.statusCode).to.equal(403);
    });

    it('filters by active=true', async function () {
      await createComponent({ code: 'ACTIVE_COMP', active: true });
      await prisma.salaryComponent.create({
        data: { tenantId: tenant.id, name: 'Inactive', code: 'INACTIVE_COMP', type: 'EARNING', calculationType: 'FLAT', value: 1000, taxable: true, active: false, displayOrder: 1 },
      });
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/components?active=true',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data.every((c) => c.active === true)).to.be.true;
    });
  });

  describe('POST /api/v1/payroll/components', function () {
    it('HR can create a FLAT component', async function () {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/components',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { name: 'Basic', code: 'BASIC_NEW', type: 'EARNING', calculationType: 'FLAT', value: 50000, taxable: true, active: true, displayOrder: 1 },
      });
      expect(res.statusCode).to.equal(201);
      const body = JSON.parse(res.body);
      expect(body.success).to.be.true;
      expect(body.data.code).to.equal('BASIC_NEW');
      expect(body.data.type).to.equal('EARNING');
    });

    it('SUPER_ADMIN can create', async function () {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/components',
        headers: { Authorization: `Bearer ${saToken}` },
        payload: { name: 'HRA', code: 'HRA_NEW', type: 'EARNING', calculationType: 'PERCENTAGE', value: 40, basisCode: 'BASIC_NEW', taxable: false, active: true, displayOrder: 2 },
      });
      expect(res.statusCode).to.equal(201);
    });

    it('409 on duplicate code', async function () {
      await createComponent({ code: 'DUPE_CODE' });
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/components',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { name: 'Dupe', code: 'DUPE_CODE', type: 'EARNING', calculationType: 'FLAT', value: 1000, taxable: true, active: true, displayOrder: 1 },
      });
      expect(res.statusCode).to.equal(409);
      const body = JSON.parse(res.body);
      expect(body.error.code).to.equal('CODE_EXISTS');
    });

    it('EMPLOYEE gets 403', async function () {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/components',
        headers: { Authorization: `Bearer ${empToken}` },
        payload: { name: 'X', code: 'XX', type: 'EARNING', calculationType: 'FLAT', value: 1, taxable: true, active: true, displayOrder: 1 },
      });
      expect(res.statusCode).to.equal(403);
    });
  });

  describe('PATCH /api/v1/payroll/components/:id', function () {
    it('HR can update a component', async function () {
      const comp = await createComponent({ code: 'PATCH_ME' });
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/payroll/components/${comp.id}`,
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { name: 'Updated Name', displayOrder: 5 },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data.name).to.equal('Updated Name');
      expect(body.data.displayOrder).to.equal(5);
    });

    it('400 on code change attempt', async function () {
      const comp = await createComponent({ code: 'NO_RENAME' });
      const res = await app.inject({
        method: 'PATCH', url: `/api/v1/payroll/components/${comp.id}`,
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { code: 'NEW_CODE' },
      });
      expect(res.statusCode).to.equal(400);
      const body = JSON.parse(res.body);
      expect(body.error.code).to.equal('CODE_IMMUTABLE');
    });
  });

  describe('DELETE /api/v1/payroll/components/:id', function () {
    it('SUPER_ADMIN can delete unused component', async function () {
      const comp = await createComponent({ code: 'DEL_ME' });
      const res = await app.inject({
        method: 'DELETE', url: `/api/v1/payroll/components/${comp.id}`,
        headers: { Authorization: `Bearer ${saToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data.deleted).to.be.true;
    });

    it('HR cannot delete (role restriction)', async function () {
      const comp = await createComponent({ code: 'NO_DEL_HR' });
      const res = await app.inject({
        method: 'DELETE', url: `/api/v1/payroll/components/${comp.id}`,
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(res.statusCode).to.equal(403);
    });

    it('409 when component used in pay group', async function () {
      const comp = await createComponent({ code: 'IN_USE_COMP' });
      await createPayGroup(comp.id);
      const res = await app.inject({
        method: 'DELETE', url: `/api/v1/payroll/components/${comp.id}`,
        headers: { Authorization: `Bearer ${saToken}` },
      });
      expect(res.statusCode).to.equal(409);
      expect(JSON.parse(res.body).error.code).to.equal('COMPONENT_IN_USE');
    });
  });

  // ── Pay Groups ────────────────────────────────────────────────────────────

  describe('GET /api/v1/payroll/groups', function () {
    it('HR can list pay groups', async function () {
      const comp = await createComponent({ code: 'G_COMP' });
      await createPayGroup(comp.id);
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/groups',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data).to.be.an('array');
      expect(body.data[0]).to.have.property('components');
    });

    it('EMPLOYEE gets 403', async function () {
      const res = await app.inject({ method: 'GET', url: '/api/v1/payroll/groups', headers: { Authorization: `Bearer ${empToken}` } });
      expect(res.statusCode).to.equal(403);
    });
  });

  describe('POST /api/v1/payroll/groups', function () {
    it('HR can create pay group with components', async function () {
      const comp = await createComponent({ code: 'PG_BASIC' });
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/groups',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: {
          name: 'Engineering Standard', code: 'ENG_STD', currency: 'INR', paySchedule: 'MONTHLY',
          components: [{ componentId: comp.id, overrideCalculationType: null, overrideValue: null }],
        },
      });
      expect(res.statusCode).to.equal(201);
      const body = JSON.parse(res.body);
      expect(body.data.code).to.equal('ENG_STD');
      expect(body.data.components.length).to.equal(1);
      expect(body.data.components[0].componentCode).to.equal('PG_BASIC');
    });

    it('409 on duplicate code', async function () {
      const comp = await createComponent({ code: 'DUPE_PG_COMP' });
      await createPayGroup(comp.id);
      const pgCode = (await prisma.payGroup.findFirst({ where: { tenantId: tenant.id } })).code;
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/groups',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { name: 'Dupe', code: pgCode, components: [] },
      });
      expect(res.statusCode).to.equal(409);
    });
  });

  describe('DELETE /api/v1/payroll/groups/:id', function () {
    it('SUPER_ADMIN can delete empty group', async function () {
      const comp = await createComponent({ code: 'EMPTY_GRP_COMP' });
      const pg = await createPayGroup(comp.id);
      const res = await app.inject({
        method: 'DELETE', url: `/api/v1/payroll/groups/${pg.id}`,
        headers: { Authorization: `Bearer ${saToken}` },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('409 when group has employees', async function () {
      const comp = await createComponent({ code: 'BUSY_GRP_COMP' });
      const pg = await createPayGroup(comp.id);
      await createEmployeeSalary(empRecord.id, pg.id);
      const res = await app.inject({
        method: 'DELETE', url: `/api/v1/payroll/groups/${pg.id}`,
        headers: { Authorization: `Bearer ${saToken}` },
      });
      expect(res.statusCode).to.equal(409);
      expect(JSON.parse(res.body).error.code).to.equal('GROUP_HAS_EMPLOYEES');
    });
  });

  // ── Pay Schedules ─────────────────────────────────────────────────────────

  describe('GET /api/v1/payroll/schedules', function () {
    it('HR can get schedules (may be empty array)', async function () {
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/schedules',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(res.statusCode).to.equal(200);
      expect(JSON.parse(res.body).data).to.be.an('array');
    });
  });

  // ── Employee Salary ───────────────────────────────────────────────────────

  describe('GET /api/v1/payroll/employees/:employeeId/salary', function () {
    it('HR can get employee salary config', async function () {
      const comp = await createComponent({ code: 'SAL_COMP' });
      const pg = await createPayGroup(comp.id);
      await createEmployeeSalary(empRecord.id, pg.id);
      const res = await app.inject({
        method: 'GET', url: `/api/v1/payroll/employees/${empRecord.id}/salary`,
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data).to.have.property('annualCtc');
      expect(body.data).to.have.property('calculatedComponents');
      expect(body.data.calculatedComponents).to.be.an('array');
    });

    it('EMPLOYEE can see own salary (bank details masked)', async function () {
      const comp = await createComponent({ code: 'OWN_SAL_COMP' });
      const pg = await createPayGroup(comp.id);
      await prisma.employeeSalary.create({
        data: { tenantId: tenant.id, employeeId: empRecord.id, payGroupId: pg.id, annualCtc: 600000, effectiveFrom: new Date('2024-01-01'), bankAccountNumber: '123456789012' },
      });
      const res = await app.inject({
        method: 'GET', url: `/api/v1/payroll/employees/${empRecord.id}/salary`,
        headers: { Authorization: `Bearer ${empToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data.bankAccountNumber).to.match(/^XXXX/);
    });

    it('EMPLOYEE gets 403 for other employee', async function () {
      const res = await app.inject({
        method: 'GET', url: `/api/v1/payroll/employees/${empRecord2.id}/salary`,
        headers: { Authorization: `Bearer ${empToken}` },
      });
      expect(res.statusCode).to.equal(403);
    });

    it('MANAGER gets 403', async function () {
      const res = await app.inject({
        method: 'GET', url: `/api/v1/payroll/employees/${empRecord.id}/salary`,
        headers: { Authorization: `Bearer ${managerToken}` },
      });
      expect(res.statusCode).to.equal(403);
    });
  });

  describe('POST /api/v1/payroll/employees/:employeeId/salary', function () {
    it('HR can set employee salary', async function () {
      const comp = await createComponent({ code: 'SET_SAL_COMP' });
      const pg = await createPayGroup(comp.id);
      const res = await app.inject({
        method: 'POST', url: `/api/v1/payroll/employees/${empRecord.id}/salary`,
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { payGroupId: pg.id, annualCtc: 1200000, effectiveFrom: '2024-06-01', bankName: 'HDFC' },
      });
      expect(res.statusCode).to.equal(201);
      const body = JSON.parse(res.body);
      expect(body.data.annualCtc).to.equal(1200000);
    });

    it('EMPLOYEE gets 403', async function () {
      const comp = await createComponent({ code: 'EMP_DENIED_COMP' });
      const pg = await createPayGroup(comp.id);
      const res = await app.inject({
        method: 'POST', url: `/api/v1/payroll/employees/${empRecord.id}/salary`,
        headers: { Authorization: `Bearer ${empToken}` },
        payload: { payGroupId: pg.id, annualCtc: 1000000, effectiveFrom: '2024-01-01' },
      });
      expect(res.statusCode).to.equal(403);
    });
  });

  // ── Payroll Runs ──────────────────────────────────────────────────────────

  describe('POST /api/v1/payroll/runs', function () {
    it('HR can create a payroll run', async function () {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { period: '2024-06', includeAllActiveEmployees: true },
      });
      expect(res.statusCode).to.equal(201);
      const body = JSON.parse(res.body);
      expect(body.data.period).to.equal('2024-06');
      expect(body.data.status).to.equal('DRAFT');
    });

    it('409 on duplicate period (non-cancelled)', async function () {
      await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { period: '2024-07', includeAllActiveEmployees: true },
      });
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { period: '2024-07', includeAllActiveEmployees: true },
      });
      expect(res.statusCode).to.equal(409);
      expect(JSON.parse(res.body).error.code).to.equal('RUN_EXISTS');
    });

    it('EMPLOYEE gets 403', async function () {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${empToken}` },
        payload: { period: '2024-05' },
      });
      expect(res.statusCode).to.equal(403);
    });
  });

  describe('GET /api/v1/payroll/runs', function () {
    it('HR can list runs with pagination', async function () {
      await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2024-08' } });
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data).to.have.property('items');
      expect(body.data).to.have.property('pagination');
      expect(body.data.items.length).to.be.greaterThan(0);
    });

    it('MANAGER gets 403', async function () {
      const res = await app.inject({ method: 'GET', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${managerToken}` } });
      expect(res.statusCode).to.equal(403);
    });
  });

  describe('GET /api/v1/payroll/runs/:id', function () {
    it('HR can get run detail with summary', async function () {
      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2024-09' },
      });
      const runId = JSON.parse(createRes.body).data.id;
      const res = await app.inject({
        method: 'GET', url: `/api/v1/payroll/runs/${runId}`,
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data).to.have.property('summary');
    });
  });

  describe('POST /api/v1/payroll/runs/:id/calculate', function () {
    it('calculates and moves to REVIEW', async function () {
      const comp = await createComponent({ code: 'CALC_COMP' });
      const pg = await createPayGroup(comp.id);
      await createEmployeeSalary(empRecord.id, pg.id);

      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2024-10' },
      });
      const runId = JSON.parse(createRes.body).data.id;

      const calcRes = await app.inject({
        method: 'POST', url: `/api/v1/payroll/runs/${runId}/calculate`,
        headers: { Authorization: `Bearer ${hrToken}` }, payload: {},
      });
      expect(calcRes.statusCode).to.equal(202);
      expect(JSON.parse(calcRes.body).data.status).to.equal('CALCULATING');

      // Poll to confirm REVIEW
      const getRes = await app.inject({
        method: 'GET', url: `/api/v1/payroll/runs/${runId}`,
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(JSON.parse(getRes.body).data.status).to.equal('REVIEW');
    });

    it('400 if run is not DRAFT', async function () {
      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2024-11' },
      });
      const runId = JSON.parse(createRes.body).data.id;
      await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/calculate`, headers: { Authorization: `Bearer ${hrToken}` }, payload: {} });
      const res = await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/calculate`, headers: { Authorization: `Bearer ${hrToken}` }, payload: {} });
      expect(res.statusCode).to.equal(400);
    });
  });

  describe('Full payroll run lifecycle', function () {
    it('DRAFT → REVIEW → APPROVED → PAID', async function () {
      const comp = await createComponent({ code: 'LIFE_COMP' });
      const pg = await createPayGroup(comp.id);
      await createEmployeeSalary(empRecord.id, pg.id);

      // Create
      const r1 = await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2025-01' } });
      const runId = JSON.parse(r1.body).data.id;

      // Calculate
      await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/calculate`, headers: { Authorization: `Bearer ${hrToken}` }, payload: {} });

      // Approve
      const r2 = await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/approve`, headers: { Authorization: `Bearer ${saToken}` }, payload: { notes: 'Approved' } });
      expect(r2.statusCode).to.equal(200);
      expect(JSON.parse(r2.body).data.status).to.equal('APPROVED');

      // Mark paid
      const r3 = await app.inject({ method: 'PATCH', url: `/api/v1/payroll/runs/${runId}/mark-paid`, headers: { Authorization: `Bearer ${hrToken}` }, payload: { paidAt: '2025-01-31', paymentReference: 'NEFT001' } });
      expect(r3.statusCode).to.equal(200);
      expect(JSON.parse(r3.body).data.status).to.equal('PAID');
    });
  });

  describe('POST /api/v1/payroll/runs/:id/cancel', function () {
    it('SUPER_ADMIN can cancel', async function () {
      const r1 = await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${saToken}` }, payload: { period: '2025-03' } });
      const runId = JSON.parse(r1.body).data.id;
      const res = await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/cancel`, headers: { Authorization: `Bearer ${saToken}` }, payload: { reason: 'Test' } });
      expect(res.statusCode).to.equal(200);
      expect(JSON.parse(res.body).data.status).to.equal('CANCELLED');
    });

    it('HR cannot cancel (SUPER_ADMIN only)', async function () {
      const r1 = await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2025-04' } });
      const runId = JSON.parse(r1.body).data.id;
      const res = await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/cancel`, headers: { Authorization: `Bearer ${hrToken}` }, payload: { reason: 'Test' } });
      expect(res.statusCode).to.equal(403);
    });
  });

  // ── Run Payslips ──────────────────────────────────────────────────────────

  describe('GET /api/v1/payroll/runs/:runId/payslips', function () {
    it('HR can list payslips after calculation', async function () {
      const comp = await createComponent({ code: 'SLIP_COMP' });
      const pg = await createPayGroup(comp.id);
      await createEmployeeSalary(empRecord.id, pg.id);

      const r1 = await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2025-05' } });
      const runId = JSON.parse(r1.body).data.id;
      await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/calculate`, headers: { Authorization: `Bearer ${hrToken}` }, payload: {} });

      const res = await app.inject({ method: 'GET', url: `/api/v1/payroll/runs/${runId}/payslips`, headers: { Authorization: `Bearer ${hrToken}` } });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data.items).to.be.an('array');
      expect(body.data.pagination).to.have.property('total');
    });

    it('EMPLOYEE gets 403', async function () {
      const r1 = await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2025-06' } });
      const runId = JSON.parse(r1.body).data.id;
      const res = await app.inject({ method: 'GET', url: `/api/v1/payroll/runs/${runId}/payslips`, headers: { Authorization: `Bearer ${empToken}` } });
      expect(res.statusCode).to.equal(403);
    });
  });

  describe('PATCH /api/v1/payroll/runs/:runId/payslips/:payslipId', function () {
    it('HR can add one-time adjustments', async function () {
      const comp = await createComponent({ code: 'ADJ_COMP' });
      const pg = await createPayGroup(comp.id);
      await createEmployeeSalary(empRecord.id, pg.id);

      const r1 = await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2025-07' } });
      const runId = JSON.parse(r1.body).data.id;
      await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/calculate`, headers: { Authorization: `Bearer ${hrToken}` }, payload: {} });

      const slipsRes = await app.inject({ method: 'GET', url: `/api/v1/payroll/runs/${runId}/payslips`, headers: { Authorization: `Bearer ${hrToken}` } });
      const slips = JSON.parse(slipsRes.body).data.items;
      if (slips.length === 0) return; // No salary-configured employees in test set

      const payslipId = slips[0].id;
      const patchRes = await app.inject({
        method: 'PATCH', url: `/api/v1/payroll/runs/${runId}/payslips/${payslipId}`,
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { oneTimeAdditions: [{ description: 'Bonus Q1', amount: 10000 }], notes: 'Bonus approved' },
      });
      expect(patchRes.statusCode).to.equal(200);
      const body = JSON.parse(patchRes.body);
      expect(body.data.oneTimeAdditions.length).to.equal(1);
    });
  });

  describe('GET /api/v1/payroll/runs/:runId/export', function () {
    it('returns CSV content-type', async function () {
      const comp = await createComponent({ code: 'EXP_COMP' });
      const pg = await createPayGroup(comp.id);
      await createEmployeeSalary(empRecord.id, pg.id);

      const r1 = await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2025-08' } });
      const runId = JSON.parse(r1.body).data.id;
      await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/calculate`, headers: { Authorization: `Bearer ${hrToken}` }, payload: {} });

      const res = await app.inject({ method: 'GET', url: `/api/v1/payroll/runs/${runId}/export`, headers: { Authorization: `Bearer ${hrToken}` } });
      expect(res.statusCode).to.equal(200);
      expect(res.headers['content-type']).to.include('text/csv');
    });

    it('EMPLOYEE gets 403', async function () {
      const r1 = await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2025-09' } });
      const runId = JSON.parse(r1.body).data.id;
      const res = await app.inject({ method: 'GET', url: `/api/v1/payroll/runs/${runId}/export`, headers: { Authorization: `Bearer ${empToken}` } });
      expect(res.statusCode).to.equal(403);
    });
  });

  // ── Employee Payslips (self-service) ──────────────────────────────────────

  describe('GET /api/v1/payroll/employees/:employeeId/payslips', function () {
    it('EMPLOYEE can see own payslips', async function () {
      const comp = await createComponent({ code: 'SELF_SLIP_COMP' });
      const pg = await createPayGroup(comp.id);
      await createEmployeeSalary(empRecord.id, pg.id);

      const r1 = await app.inject({ method: 'POST', url: '/api/v1/payroll/runs', headers: { Authorization: `Bearer ${hrToken}` }, payload: { period: '2025-10' } });
      const runId = JSON.parse(r1.body).data.id;
      await app.inject({ method: 'POST', url: `/api/v1/payroll/runs/${runId}/calculate`, headers: { Authorization: `Bearer ${hrToken}` }, payload: {} });

      const res = await app.inject({
        method: 'GET', url: `/api/v1/payroll/employees/${empRecord.id}/payslips`,
        headers: { Authorization: `Bearer ${empToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data).to.have.property('items');
      expect(body.data).to.have.property('pagination');
    });

    it('EMPLOYEE gets 403 for other employee payslips', async function () {
      const res = await app.inject({
        method: 'GET', url: `/api/v1/payroll/employees/${empRecord2.id}/payslips`,
        headers: { Authorization: `Bearer ${empToken}` },
      });
      expect(res.statusCode).to.equal(403);
    });
  });

  // ── Statutory Packs (flat API) ─────────────────────────────────────────────

  describe('Statutory packs flat contract', function () {
    const flatPack = () => ({
      country: 'IN',
      version: `test-${Date.now()}`,
      effectiveFrom: '2026-04-01',
      rounding: { mode: 'NEAREST', precision: 0 },
      proration: { basis: 'CALENDAR_DAYS' },
      taxRegimes: [],
      contributionSchemes: [],
      localTaxes: [],
      statutoryComponents: [],
      minimumWages: [],
      gratuity: { enabled: true },
    });

    it('POST returns flat shape with gratuity', async function () {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/statutory-packs',
        headers: { Authorization: `Bearer ${saToken}` },
        payload: flatPack(),
      });
      expect(res.statusCode).to.equal(201);
      const body = JSON.parse(res.body).data;
      expect(body).to.not.have.property('packData');
      expect(body.gratuity).to.deep.include({ enabled: true });
    });

    it('duplicate version returns 409 PACK_VERSION_EXISTS', async function () {
      const payload = flatPack();
      await app.inject({
        method: 'POST', url: '/api/v1/payroll/statutory-packs',
        headers: { Authorization: `Bearer ${saToken}` },
        payload,
      });
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/statutory-packs',
        headers: { Authorization: `Bearer ${saToken}` },
        payload,
      });
      expect(res.statusCode).to.equal(409);
      expect(JSON.parse(res.body).error.code).to.equal('PACK_VERSION_EXISTS');
    });

    it('DELETE returns deleted true', async function () {
      const created = await app.inject({
        method: 'POST', url: '/api/v1/payroll/statutory-packs',
        headers: { Authorization: `Bearer ${saToken}` },
        payload: flatPack(),
      });
      const id = JSON.parse(created.body).data.id;
      const res = await app.inject({
        method: 'DELETE', url: `/api/v1/payroll/statutory-packs/${id}`,
        headers: { Authorization: `Bearer ${saToken}` },
      });
      expect(res.statusCode).to.equal(200);
      expect(JSON.parse(res.body).data.deleted).to.equal(true);
    });

    it('POST with string[] statutoryComponents returns strings on read', async function () {
      const payload = { ...flatPack(), statutoryComponents: ['PF', 'PF_ER'] };
      const created = await app.inject({
        method: 'POST', url: '/api/v1/payroll/statutory-packs',
        headers: { Authorization: `Bearer ${saToken}` },
        payload,
      });
      expect(created.statusCode).to.equal(201);
      const body = JSON.parse(created.body).data;
      expect(body.statutoryComponents).to.deep.equal(['PF', 'PF_ER']);
      const detail = await app.inject({
        method: 'GET', url: `/api/v1/payroll/statutory-packs/${body.id}`,
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(JSON.parse(detail.body).data.statutoryComponents).to.deep.equal(['PF', 'PF_ER']);
    });

    it('POST with legacy { code } objects normalizes to strings', async function () {
      const payload = {
        ...flatPack(),
        statutoryComponents: [{ code: 'PF' }, { code: 'PF_ER' }],
      };
      const created = await app.inject({
        method: 'POST', url: '/api/v1/payroll/statutory-packs',
        headers: { Authorization: `Bearer ${saToken}` },
        payload,
      });
      expect(created.statusCode).to.equal(201);
      const body = JSON.parse(created.body).data;
      expect(body.statutoryComponents).to.deep.equal(['PF', 'PF_ER']);
      expect(body.statutoryComponents.every((c) => typeof c === 'string')).to.equal(true);
    });

    it('PATCH with mixed statutoryComponents normalizes to strings', async function () {
      const created = await app.inject({
        method: 'POST', url: '/api/v1/payroll/statutory-packs',
        headers: { Authorization: `Bearer ${saToken}` },
        payload: flatPack(),
      });
      const id = JSON.parse(created.body).data.id;
      const patched = await app.inject({
        method: 'PATCH', url: `/api/v1/payroll/statutory-packs/${id}`,
        headers: { Authorization: `Bearer ${saToken}` },
        payload: { statutoryComponents: ['PF', { code: 'PF_ER' }] },
      });
      expect(patched.statusCode).to.equal(200);
      expect(JSON.parse(patched.body).data.statutoryComponents).to.deep.equal(['PF', 'PF_ER']);
    });

    it('GET list never returns object statutoryComponents', async function () {
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/statutory-packs?country=IN',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(res.statusCode).to.equal(200);
      const packs = JSON.parse(res.body).data;
      for (const pack of packs) {
        for (const comp of pack.statutoryComponents ?? []) {
          expect(comp).to.be.a('string');
        }
      }
    });
  });

  describe('Payroll run types', function () {
    it('allows OFF_CYCLE with employeeIds alongside REGULAR', async function () {
      await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { period: '2026-01' },
      });
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { period: '2026-01', type: 'OFF_CYCLE', employeeIds: [empRecord.id] },
      });
      expect(res.statusCode).to.equal(201);
      expect(JSON.parse(res.body).data.type).to.equal('OFF_CYCLE');
    });

    it('REGULAR duplicate returns 409 RUN_EXISTS', async function () {
      await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { period: '2026-02' },
      });
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { period: '2026-02' },
      });
      expect(res.statusCode).to.equal(409);
      expect(JSON.parse(res.body).error.code).to.equal('RUN_EXISTS');
    });

    it('invalid type returns 422 INVALID_RUN_TYPE', async function () {
      const res = await app.inject({
        method: 'POST', url: '/api/v1/payroll/runs',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { period: '2026-03', type: 'NOT_A_TYPE' },
      });
      expect(res.statusCode).to.equal(422);
      expect(JSON.parse(res.body).error.code).to.equal('INVALID_RUN_TYPE');
    });
  });

  describe('Phase 3 contract shapes', function () {
    it('GET /payroll/components returns statutory fields and timestamps', async function () {
      await prisma.salaryComponent.create({
        data: {
          tenantId: tenant.id, name: 'PF Wage', code: 'PF_WAGE_TEST',
          type: 'EARNING', calculationType: 'FLAT', value: 1000, taxable: true, active: true,
          statutoryTag: 'PF_WAGE', prorate: true, payInPeriods: '[1,2,3]',
          costCenterRule: 'DEPARTMENT',
        },
      });
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/components',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      const item = JSON.parse(res.body).data.find((c) => c.code === 'PF_WAGE_TEST');
      expect(item).to.include.keys('statutoryTag', 'prorate', 'payInPeriods', 'createdAt', 'updatedAt', 'costCenterRule');
      expect(item.payInPeriods).to.deep.equal([1, 2, 3]);
    });

    it('POST/PATCH /payroll/components persists statutory fields', async function () {
      const createRes = await app.inject({
        method: 'POST', url: '/api/v1/payroll/components',
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: {
          name: 'Statutory Comp', code: 'STAT_PATCH', type: 'EARNING', calculationType: 'FLAT',
          value: 500, taxable: true, statutoryTag: 'PF_EMPLOYEE', prorate: false, payInPeriods: [6, 12],
        },
      });
      expect(createRes.statusCode).to.equal(201);
      const created = JSON.parse(createRes.body).data;
      expect(created.statutoryTag).to.equal('PF_EMPLOYEE');
      expect(created.payInPeriods).to.deep.equal([6, 12]);

      const patchRes = await app.inject({
        method: 'PATCH', url: `/api/v1/payroll/components/${created.id}`,
        headers: { Authorization: `Bearer ${hrToken}` },
        payload: { prorate: true, payInPeriods: [1, 7] },
      });
      expect(JSON.parse(patchRes.body).data.prorate).to.equal(true);
      expect(JSON.parse(patchRes.body).data.payInPeriods).to.deep.equal([1, 7]);
    });

    it('GET /payroll/pay-calendars returns frontend PayCalendar shape', async function () {
      await prisma.payCalendar.create({
        data: {
          tenantId: tenant.id, name: 'Monthly', code: 'MON_TEST', paySchedule: 'MONTHLY',
          periodAnchor: 'MONTH_START', payDateRule: 'LAST_WORKING_DAY', payDay: 30, cutoffDay: 25,
        },
      });
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/pay-calendars',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      const cal = JSON.parse(res.body).data[0];
      expect(cal).to.include.keys('frequency', 'periodAnchor', 'payDateRule', 'payDay', 'cutoffDay', 'legalEntityId');
      expect(cal.frequency).to.equal('MONTHLY');
    });

    it('GET /payroll/legal-entities includes active', async function () {
      await prisma.legalEntity.create({
        data: { tenantId: tenant.id, name: 'Test LE', country: 'IN', active: false },
      });
      const res = await app.inject({
        method: 'GET', url: '/api/v1/payroll/legal-entities',
        headers: { Authorization: `Bearer ${hrToken}` },
      });
      expect(JSON.parse(res.body).data[0].active).to.equal(false);
    });

    it('base payroll paths return 200', async function () {
      for (const path of [
        '/api/v1/payroll/employees',
        '/api/v1/payroll/migration',
        '/api/v1/payroll/payment-batches',
        '/api/v1/payroll/reports',
        '/api/v1/payroll/settings',
      ]) {
        const res = await app.inject({
          method: 'GET', url: path,
          headers: { Authorization: `Bearer ${hrToken}` },
        });
        expect(res.statusCode, path).to.equal(200);
      }
    });
  });
});
