import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Departments Routes Integration Tests', function () {
  this.timeout(10000);

  let app;
  let testTenant;
  let adminToken;
  let _adminUser;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();
    _adminUser = await createTestUser(testTenant.id, {
      email: 'admin@example.com',
      memberType: 'HR_ADMIN',
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'x-tenant-key': testTenant.tenantKey },
      payload: { email: 'admin@example.com', password: 'password' },
    });
    const loginBody = JSON.parse(loginRes.body);
    adminToken = loginBody.data.accessToken;
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  describe('GET /departments', function () {
    it('should return empty list initially', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/departments',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.be.an('array').with.lengthOf(0);
    });

    it('should return departments in tree structure', async function () {
      await prisma.department.create({
        data: {
          tenantId: testTenant.id,
          name: 'Engineering',
          departmentCode: 'ENG',
        },
      });

      await prisma.department.create({
        data: {
          tenantId: testTenant.id,
          name: 'Backend',
          departmentCode: 'BE',
          parentId: (await prisma.department.findFirst({ where: { name: 'Engineering' } })).id,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/departments',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data).to.be.an('array').with.lengthOf(1);
      expect(body.data[0].name).to.equal('Engineering');
      expect(body.data[0].children).to.have.lengthOf(1);
      expect(body.data[0].children[0].name).to.equal('Backend');
    });

    it('should require authentication', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/departments',
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(401);
    });

    it('should require HR_ADMIN role', async function () {
      const _employee = await createTestUser(testTenant.id, {
        email: 'emp@example.com',
        memberType: 'EMPLOYEE',
      });

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email: 'emp@example.com', password: 'password' },
      });
      const empToken = JSON.parse(loginRes.body).data.accessToken;

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/departments',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${empToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
    });
  });

  describe('POST /departments', function () {
    it('should create department with valid data', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/departments',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Engineering',
          departmentCode: 'ENG',
        },
      });

      expect(response.statusCode).to.equal(201);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data.name).to.equal('Engineering');
      expect(body.data.departmentCode).to.equal('ENG');
    });

    it('should reject duplicate department code', async function () {
      await prisma.department.create({
        data: {
          tenantId: testTenant.id,
          name: 'Engineering',
          departmentCode: 'ENG',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/departments',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Tech',
          departmentCode: 'ENG',
        },
      });

      expect(response.statusCode).to.equal(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('DUPLICATE_CODE');
    });

    it('should create with parent department', async function () {
      const parent = await prisma.department.create({
        data: {
          tenantId: testTenant.id,
          name: 'Engineering',
          departmentCode: 'ENG',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/departments',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Backend',
          parentId: parent.id,
        },
      });

      expect(response.statusCode).to.equal(201);
      const body = JSON.parse(response.body);
      expect(body.data.parentId).to.equal(parent.id);
    });

    it('should reject invalid parent id', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/departments',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Backend',
          parentId: 'invalid-id-format',
        },
      });

      expect(response.statusCode).to.equal(400);
    });

    it('should reject non-existent parent', async function () {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/departments',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Backend',
          parentId: 'cuid123456789012345678901234',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('INVALID_PARENT');
    });
  });

  describe('PATCH /departments/:id', function () {
    it('should update department name', async function () {
      const dept = await prisma.department.create({
        data: {
          tenantId: testTenant.id,
          name: 'Engineering',
          departmentCode: 'ENG',
        },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/departments/${dept.id}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Technology',
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).to.equal('Technology');
    });

    it('should prevent circular parent assignment', async function () {
      const parent = await prisma.department.create({
        data: {
          tenantId: testTenant.id,
          name: 'Parent',
          departmentCode: 'PARENT',
        },
      });

      const child = await prisma.department.create({
        data: {
          tenantId: testTenant.id,
          name: 'Child',
          departmentCode: 'CHILD',
          parentId: parent.id,
        },
      });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/departments/${parent.id}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          parentId: child.id,
        },
      });

      expect(response.statusCode).to.equal(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('DEPARTMENT_CYCLE');
    });

    it('should return 404 for non-existent department', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/departments/cuid123456789012345678901234',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Updated',
        },
      });

      expect(response.statusCode).to.equal(404);
    });
  });

  describe('DELETE /departments/:id', function () {
    it('should archive empty department', async function () {
      const dept = await prisma.department.create({
        data: {
          tenantId: testTenant.id,
          name: 'Engineering',
          departmentCode: 'ENG',
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/departments/${dept.id}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('archived');

      const archived = await prisma.department.findFirst({ where: { id: dept.id } });
      expect(archived.deletedAt).to.not.be.null;
    });

    it('should reject deletion with employees', async function () {
      const dept = await prisma.department.create({
        data: {
          tenantId: testTenant.id,
          name: 'Engineering',
          departmentCode: 'ENG',
        },
      });

      await prisma.employee.create({
        data: {
          tenantId: testTenant.id,
          employeeCode: 'EMP001',
          firstName: 'John',
          lastName: 'Doe',
          workEmail: 'john@example.com',
          joinedOn: new Date(),
          departmentId: dept.id,
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/departments/${dept.id}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(409);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('DEPARTMENT_NOT_EMPTY');
    });
  });
});
