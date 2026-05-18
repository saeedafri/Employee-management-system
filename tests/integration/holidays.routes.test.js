import { expect } from 'chai';
import { createTestApp, createTestTenant, createTestUser, cleanDatabase } from '../helpers.js';
import { prisma } from '../../src/plugins/prisma.js';

describe('Holidays Routes Integration Tests', function () {
  this.timeout(10000);

  let app;
  let testTenant;
  let adminToken;

  before(async function () {
    app = await createTestApp();
  });

  beforeEach(async function () {
    await cleanDatabase();
    testTenant = await createTestTenant();
    await createTestUser(testTenant.id, {
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

  describe('GET /holidays', function () {
    it('should return empty list initially', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/holidays',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data.holidays).to.be.an('array').with.lengthOf(0);
      expect(body.data.total).to.equal(0);
    });

    it('should return holidays for specified year', async function () {
      const year = 2025;
      const holidayDate = new Date(`${year}-01-26`);

      await prisma.holiday.create({
        data: {
          tenantId: testTenant.id,
          name: 'Republic Day',
          holidayDate,
          location: 'India',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/holidays?year=${year}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.holidays).to.have.lengthOf(1);
      expect(body.data.holidays[0].name).to.equal('Republic Day');
    });

    it('should filter by country/location', async function () {
      const year = 2025;

      await prisma.holiday.create({
        data: {
          tenantId: testTenant.id,
          name: 'Republic Day',
          holidayDate: new Date(`${year}-01-26`),
          location: 'India',
        },
      });

      await prisma.holiday.create({
        data: {
          tenantId: testTenant.id,
          name: 'Independence Day',
          holidayDate: new Date(`${year}-07-04`),
          location: 'USA',
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/holidays?year=${year}&country=India`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.holidays).to.have.lengthOf(1);
      expect(body.data.holidays[0].location).to.equal('India');
    });

    it('should require authentication', async function () {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/holidays',
        headers: { 'x-tenant-key': testTenant.tenantKey },
      });

      expect(response.statusCode).to.equal(401);
    });
  });

  describe('POST /holidays', function () {
    it('should create holiday with valid data', async function () {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/holidays',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          holidayDate: dateStr,
          name: 'New Year',
          location: 'Global',
          isOptional: false,
        },
      });

      expect(response.statusCode).to.equal(201);
      const body = JSON.parse(response.body);
      expect(body.success).to.be.true;
      expect(body.data.name).to.equal('New Year');
      expect(body.data.location).to.equal('Global');
      expect(body.data.isOptional).to.be.false;
    });

    it('should reject past dates', async function () {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);
      const dateStr = pastDate.toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/holidays',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          holidayDate: dateStr,
          name: 'Old Holiday',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('INVALID_DATE');
    });

    it('should reject duplicate holidays', async function () {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      await prisma.holiday.create({
        data: {
          tenantId: testTenant.id,
          name: 'New Year',
          holidayDate: new Date(dateStr),
          location: 'India',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/holidays',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          holidayDate: dateStr,
          name: 'New Year 2',
          location: 'India',
        },
      });

      expect(response.statusCode).to.equal(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).to.equal('DUPLICATE_HOLIDAY');
    });

    it('should require HR_ADMIN role', async function () {
      const employee = await createTestUser(testTenant.id, {
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

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/holidays',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${empToken}`,
        },
        payload: {
          holidayDate: dateStr,
          name: 'Holiday',
        },
      });

      expect(response.statusCode).to.equal(403);
    });
  });

  describe('PATCH /holidays/:id', function () {
    it('should update holiday', async function () {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const holiday = await prisma.holiday.create({
        data: {
          tenantId: testTenant.id,
          name: 'Old Name',
          holidayDate: futureDate,
          isOptional: false,
        },
      });

      const newDate = new Date(futureDate);
      newDate.setDate(newDate.getDate() + 1);
      const newDateStr = newDate.toISOString().split('T')[0];

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/holidays/${holiday.id}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'New Name',
          holidayDate: newDateStr,
          isOptional: true,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.name).to.equal('New Name');
      expect(body.data.isOptional).to.be.true;
    });

    it('should return 404 for non-existent holiday', async function () {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/holidays/cuid123456789012345678901234',
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: 'Updated',
        },
      });

      expect(response.statusCode).to.equal(400);
    });
  });

  describe('DELETE /holidays/:id', function () {
    it('should delete holiday', async function () {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const holiday = await prisma.holiday.create({
        data: {
          tenantId: testTenant.id,
          name: 'Holiday to Delete',
          holidayDate: futureDate,
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/holidays/${holiday.id}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).to.equal(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).to.equal('deleted');

      const deleted = await prisma.holiday.findFirst({ where: { id: holiday.id } });
      expect(deleted).to.be.null;
    });

    it('should require HR_ADMIN role', async function () {
      const employee = await createTestUser(testTenant.id, {
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

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const holiday = await prisma.holiday.create({
        data: {
          tenantId: testTenant.id,
          name: 'Holiday',
          holidayDate: futureDate,
        },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/holidays/${holiday.id}`,
        headers: {
          'x-tenant-key': testTenant.tenantKey,
          authorization: `Bearer ${empToken}`,
        },
      });

      expect(response.statusCode).to.equal(403);
    });
  });
});
