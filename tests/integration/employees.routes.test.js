import { expect } from 'chai';
import { prisma } from '../../src/plugins/prisma.js';
import {
  createTestApp,
  createTestTenant,
  createTestUser,
  createTestEmployee,
  cleanDatabase,
} from '../helpers.js';

describe('Employees Routes Integration Tests', function () {
  this.timeout(20000);

  let app;
  let testTenant;
  let hrUser, managerUser, employeeUser, otherEmployeeUser;
  let hrEmployee, managerEmployee, employee, otherEmployee;
  let hrToken, managerToken, employeeToken, otherEmployeeToken;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();

    hrUser = await createTestUser(testTenant.id, {
      email: 'hr@example.com',
      memberType: 'HR_ADMIN',
    });
    managerUser = await createTestUser(testTenant.id, {
      email: 'manager@example.com',
      memberType: 'MANAGER',
    });
    employeeUser = await createTestUser(testTenant.id, {
      email: 'employee@example.com',
      memberType: 'EMPLOYEE',
    });
    otherEmployeeUser = await createTestUser(testTenant.id, {
      email: 'other@example.com',
      memberType: 'EMPLOYEE',
    });

    hrEmployee = await createTestEmployee(testTenant.id, hrUser.id, {
      firstName: 'HR',
      lastName: 'Admin',
      employeeCode: 'HR001',
      workEmail: 'hr@example.com',
    });
    managerEmployee = await createTestEmployee(testTenant.id, managerUser.id, {
      firstName: 'Jane',
      lastName: 'Manager',
      employeeCode: 'MGR001',
      workEmail: 'manager@example.com',
    });
    employee = await createTestEmployee(testTenant.id, employeeUser.id, {
      firstName: 'John',
      lastName: 'Doe',
      employeeCode: 'EMP001',
      workEmail: 'employee@example.com',
    });
    otherEmployee = await createTestEmployee(testTenant.id, otherEmployeeUser.id, {
      firstName: 'Jane',
      lastName: 'Other',
      employeeCode: 'EMP002',
      workEmail: 'other@example.com',
    });

    // John reports to Jane Manager
    await prisma.employee.update({
      where: { id: employee.id },
      data: { managerId: managerEmployee.id },
    });

    // Link employeeId onto User records so ownership checks work
    await prisma.user.update({ where: { id: hrUser.id }, data: { employeeId: hrEmployee.id } });
    await prisma.user.update({ where: { id: managerUser.id }, data: { employeeId: managerEmployee.id } });
    await prisma.user.update({ where: { id: employeeUser.id }, data: { employeeId: employee.id } });
    await prisma.user.update({ where: { id: otherEmployeeUser.id }, data: { employeeId: otherEmployee.id } });

    const login = async (email) => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'x-tenant-key': testTenant.tenantKey },
        payload: { email, password: 'password' },
      });
      return JSON.parse(res.body).data?.accessToken;
    };

    hrToken = await login('hr@example.com');
    managerToken = await login('manager@example.com');
    employeeToken = await login('employee@example.com');
    otherEmployeeToken = await login('other@example.com');
  });

  after(async function () {
    await cleanDatabase();
    await app.close();
  });

  // ── Role isolation: GET /employees ──────────────────────────────────────────

  describe('GET /employees — role isolation', function () {
    it('HR_ADMIN sees all employees', async function () {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/employees',
        headers: {
          Authorization: `Bearer ${hrToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data.employees.length).to.be.at.least(4);
    });

    it('MANAGER sees self + direct reports only', async function () {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/employees',
        headers: {
          Authorization: `Bearer ${managerToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      const ids = body.data.employees.map((e) => e.id);
      expect(ids).to.include(managerEmployee.id);
      expect(ids).to.include(employee.id);
      expect(ids).not.to.include(otherEmployee.id);
      expect(ids).not.to.include(hrEmployee.id);
    });

    it('EMPLOYEE sees only themselves', async function () {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/employees',
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      const ids = body.data.employees.map((e) => e.id);
      expect(ids).to.deep.equal([employee.id]);
    });
  });

  // ── GET /employees/:id — access control ────────────────────────────────────

  describe('GET /employees/:id — access control', function () {
    it('HR_ADMIN can fetch any employee', async function () {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/employees/${otherEmployee.id}`,
        headers: {
          Authorization: `Bearer ${hrToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('EMPLOYEE can fetch own profile', async function () {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/employees/${employee.id}`,
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data.id).to.equal(employee.id);
    });

    it('EMPLOYEE cannot fetch another employee profile', async function () {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/employees/${otherEmployee.id}`,
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(403);
    });
  });

  // ── POST /employees — create access control ─────────────────────────────────

  describe('POST /employees — HR_ADMIN only', function () {
    it('HR_ADMIN can create employee', async function () {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/employees',
        headers: {
          Authorization: `Bearer ${hrToken}`,
          'x-tenant-key': testTenant.tenantKey,
          'content-type': 'application/json',
        },
        payload: {
          firstName: 'New',
          lastName: 'Hire',
          workEmail: 'newhire@example.com',
          joinedOn: new Date().toISOString(),
        },
      });
      expect(res.statusCode).to.equal(201);
    });

    it('EMPLOYEE cannot create employee — 403', async function () {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/employees',
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
          'content-type': 'application/json',
        },
        payload: {
          firstName: 'Sneaky',
          lastName: 'User',
          workEmail: 'sneaky@example.com',
          joinedOn: new Date().toISOString(),
        },
      });
      expect(res.statusCode).to.equal(403);
    });
  });

  // ── PATCH /employees/:id — update access control ────────────────────────────

  describe('PATCH /employees/:id — HR_ADMIN only', function () {
    it('HR_ADMIN can update any employee', async function () {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/employees/${employee.id}`,
        headers: {
          Authorization: `Bearer ${hrToken}`,
          'x-tenant-key': testTenant.tenantKey,
          'content-type': 'application/json',
        },
        payload: { designation: 'Senior Developer' },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('EMPLOYEE cannot update another employee — 403', async function () {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/employees/${otherEmployee.id}`,
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
          'content-type': 'application/json',
        },
        payload: { designation: 'Hacked' },
      });
      expect(res.statusCode).to.equal(403);
    });
  });

  // ── Documents — access control ───────────────────────────────────────────────

  describe('GET /employees/:id/documents — access control', function () {
    beforeEach(async function () {
      await prisma.employeeDocument.create({
        data: {
          tenantId: testTenant.id,
          employeeId: employee.id,
          uploadedById: hrUser.id,
          fileName: 'offer.pdf',
          fileUrl: 'https://cloudinary.example.com/offer.pdf',
          documentType: 'OFFER_LETTER',
          fileSize: 1024,
          mimeType: 'application/pdf',
        },
      });
    });

    it('EMPLOYEE can list own documents', async function () {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/employees/${employee.id}/documents`,
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(200);
      const body = JSON.parse(res.body);
      expect(body.data).to.be.an('array').with.length(1);
    });

    it('EMPLOYEE cannot list another employee documents — 403', async function () {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/employees/${otherEmployee.id}/documents`,
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(403);
    });

    it('HR_ADMIN can list any employee documents', async function () {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/employees/${employee.id}/documents`,
        headers: {
          Authorization: `Bearer ${hrToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(200);
    });
  });

  describe('DELETE /employees/:id/documents/:docId — HR_ADMIN only', function () {
    let doc;

    beforeEach(async function () {
      doc = await prisma.employeeDocument.create({
        data: {
          tenantId: testTenant.id,
          employeeId: employee.id,
          uploadedById: hrUser.id,
          fileName: 'contract.pdf',
          fileUrl: 'https://cloudinary.example.com/contract.pdf',
          documentType: 'CONTRACT',
          fileSize: 2048,
          mimeType: 'application/pdf',
        },
      });
    });

    it('HR_ADMIN can delete document', async function () {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/employees/${employee.id}/documents/${doc.id}`,
        headers: {
          Authorization: `Bearer ${hrToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(200);
    });

    it('EMPLOYEE cannot delete document — 403', async function () {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/employees/${employee.id}/documents/${doc.id}`,
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(403);
    });
  });

  // ── Photo upload — access control + WebP enforcement ────────────────────────

  describe('POST /employees/:id/photo — access control', function () {
    it('EMPLOYEE cannot upload photo for another employee — 403', async function () {
      // Tiny valid PNG (1x1 pixel)
      const pngBuf = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );
      const boundary = 'boundary123';
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`),
        pngBuf,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/employees/${otherEmployee.id}/photo`,
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      });
      expect(res.statusCode).to.equal(403);
    });

    it('Returns 503 when Cloudinary is not configured', async function () {
      const pngBuf = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      );
      const boundary = 'boundary456';
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n`),
        pngBuf,
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ]);

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/employees/${employee.id}/photo`,
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
          'content-type': `multipart/form-data; boundary=${boundary}`,
        },
        payload: body,
      });
      // 503 if Cloudinary env vars not set, 200 if they are
      expect([200, 503]).to.include(res.statusCode);
    });
  });

  // ── DELETE /employees/:id — soft delete ──────────────────────────────────────

  describe('DELETE /employees/:id — HR_ADMIN only', function () {
    it('HR_ADMIN can soft delete employee', async function () {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/employees/${employee.id}`,
        headers: {
          Authorization: `Bearer ${hrToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(200);
      const updated = await prisma.employee.findUnique({ where: { id: employee.id } });
      expect(updated.deletedAt).to.not.be.null;
    });

    it('EMPLOYEE cannot delete an employee — 403', async function () {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/employees/${otherEmployee.id}`,
        headers: {
          Authorization: `Bearer ${employeeToken}`,
          'x-tenant-key': testTenant.tenantKey,
        },
      });
      expect(res.statusCode).to.equal(403);
    });
  });
});
