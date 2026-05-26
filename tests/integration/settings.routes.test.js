import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, createTestEmployee, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Settings Routes Integration Tests', function () {
  this.timeout(15000);

  let app;
  let testTenant;
  let superAdminUser;
  let hrAdminUser;
  let employeeUser;
  let superAdminToken;
  let hrAdminToken;
  let employeeToken;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();

    superAdminUser = await createTestUser(testTenant.id, {
      email: 'superadmin@example.com',
      memberType: 'SUPER_ADMIN',
    });

    hrAdminUser = await createTestUser(testTenant.id, {
      email: 'hradmin@example.com',
      memberType: 'HR_ADMIN',
    });

    employeeUser = await createTestUser(testTenant.id, {
      email: 'employee@example.com',
      memberType: 'EMPLOYEE',
    });

    await createTestEmployee(testTenant.id, superAdminUser.id, { employeeCode: 'ADM001' });
    await createTestEmployee(testTenant.id, hrAdminUser.id, { employeeCode: 'HR001' });
    await createTestEmployee(testTenant.id, employeeUser.id, { employeeCode: 'EMP001' });

    const superAdminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'superadmin@example.com', password: 'password' },
    });
    superAdminToken = JSON.parse(superAdminLogin.body).data.accessToken;

    const hrAdminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'hradmin@example.com', password: 'password' },
    });
    hrAdminToken = JSON.parse(hrAdminLogin.body).data.accessToken;

    const employeeLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'employee@example.com', password: 'password' },
    });
    employeeToken = JSON.parse(employeeLogin.body).data.accessToken;
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('GET /api/v1/settings/tenant', function () {
    it('should get tenant config for authenticated user', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/tenant',
        headers: { Authorization: `Bearer ${employeeToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.have.property('company_name');
      expect(data.data).to.have.property('timezone');
    });

    it('should require authentication', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/tenant',
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(401);
    });
  });

  describe('PATCH /api/v1/settings/tenant', function () {
    it('should update tenant config as HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings/tenant',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
        payload: {
          company_name: 'Updated Company',
          timezone: 'America/New_York',
          working_hours_start: '08:00',
          working_hours_end: '17:00',
        },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data.company_name).to.equal('Updated Company');
    });

    it('should reject non-HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings/tenant',
        headers: { Authorization: `Bearer ${employeeToken}` },
        payload: {
          company_name: 'Updated Company',
        },
      });

      expect(response.statusCode).to.equal(403);
    });

    it('should validate working hours format', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings/tenant',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
        payload: {
          working_hours_start: 'invalid',
        },
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe('GET /api/v1/settings/email-templates', function () {
    it('should get email templates as HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/email-templates',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.have.property('templates');
      expect(data.data.templates).to.be.an('array');
    });

    it('should reject non-HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/email-templates',
        headers: { Authorization: `Bearer ${employeeToken}` },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('PATCH /api/v1/settings/email-templates/:type', function () {
    it('should update email template as HR_ADMIN', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings/email-templates/LEAVE_APPROVAL',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
        payload: {
          subject: 'Leave Approved',
          body: 'Your leave has been approved. Thank you.',
        },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data.subject).to.equal('Leave Approved');
    });

    it('should validate body length', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings/email-templates/LEAVE_APPROVAL',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
        payload: {
          subject: 'Test',
          body: 'short',
        },
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe('GET /api/v1/settings/roles-permissions', function () {
    it('should get role permissions as SUPER_ADMIN', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/roles-permissions',
        headers: { Authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data).to.be.an('object');
    });

    it('should reject non-SUPER_ADMIN', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/settings/roles-permissions',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('PATCH /api/v1/settings/roles-permissions', function () {
    beforeEach(async function () {
      await prisma.permission.deleteMany({});
      await prisma.permission.create({
        data: {
          key: 'EMPLOYEE_VIEW',
          module: 'employees',
          description: 'View employees',
        },
      });

      await prisma.role.deleteMany({ where: { tenantId: testTenant.id } });
      await prisma.role.create({
        data: {
          tenantId: testTenant.id,
          key: 'HR_ADMIN',
          name: 'HR Admin',
        },
      });
    });

    it('should update role permissions as SUPER_ADMIN', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings/roles-permissions',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        payload: {
          role: 'HR_ADMIN',
          permissions: ['EMPLOYEE_VIEW'],
        },
      });

      expect(response.statusCode).to.equal(200);
      const data = JSON.parse(response.body);
      expect(data.success).to.be.true;
      expect(data.data.role).to.equal('HR_ADMIN');
    });

    it('should reject non-SUPER_ADMIN', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings/roles-permissions',
        headers: { Authorization: `Bearer ${hrAdminToken}` },
        payload: {
          role: 'HR_ADMIN',
          permissions: ['EMPLOYEE_VIEW'],
        },
      });

      expect(response.statusCode).to.equal(403);
    });

    it('should reject empty permissions', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/settings/roles-permissions',
        headers: { Authorization: `Bearer ${superAdminToken}` },
        payload: {
          role: 'HR_ADMIN',
          permissions: [],
        },
      });

      expect(response.statusCode).to.equal(400);
    });
  });
});
