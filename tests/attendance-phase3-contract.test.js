import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';

const TENANT_KEY = 'acme-corp-001';
const PASSWORD = 'Password123!';
const TEST_MONTH = '2035-03';
const TEST_DATE = new Date('2035-03-04T00:00:00.000Z');
const REGULARIZATION_DATE = new Date('2035-03-05T00:00:00.000Z');

let app;
let tenant;
let hr;
let priya;
let aman;
let directReport;

test.before(async () => {
  app = await createApp();
  await app.ready();

  tenant = await prisma.tenant.findUnique({ where: { tenantKey: TENANT_KEY } });
  assert.ok(tenant, 'seed tenant is required');

  [hr, priya, aman] = await Promise.all([
    prisma.user.findFirst({ where: { tenantId: tenant.id, email: 'hr@acme.test' } }),
    prisma.user.findFirst({ where: { tenantId: tenant.id, email: 'priya@acme.test' } }),
    prisma.user.findFirst({ where: { tenantId: tenant.id, email: 'aman@acme.test' } }),
  ]);

  assert.ok(hr?.employeeId, 'HR user with employee profile is required');
  assert.ok(priya?.employeeId, 'Priya employee test user is required');
  assert.ok(aman?.employeeId, 'manager test user is required');

  directReport = await prisma.employee.findFirst({
    where: {
      tenantId: tenant.id,
      managerId: aman.employeeId,
      deletedAt: null,
    },
    select: { id: true },
  });
  assert.ok(directReport, 'manager direct report is required');

  await cleanupTestRows();
});

test.after(async () => {
  await cleanupTestRows();
  if (app) await app.close();
});

async function cleanupTestRows() {
  if (!tenant) return;
  await prisma.attendanceRegularizationRequest.deleteMany({
    where: {
      tenantId: tenant.id,
      attendanceDate: { in: [TEST_DATE, REGULARIZATION_DATE] },
    },
  });
  await prisma.attendanceRecord.deleteMany({
    where: {
      tenantId: tenant.id,
      attendanceDate: { in: [TEST_DATE, REGULARIZATION_DATE] },
    },
  });
}

function cookieHeader(response) {
  const rows = response.headers['set-cookie'];
  assert.ok(Array.isArray(rows), 'login must set auth cookies');
  return rows.map((row) => row.split(';')[0]).join('; ');
}

async function login(email) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      email,
      password: PASSWORD,
    },
  });
  assert.equal(response.statusCode, 200, response.body);
  return { cookie: cookieHeader(response), user: response.json().data.user };
}

async function seedAttendance(employeeId) {
  await prisma.attendanceRecord.upsert({
    where: {
      tenantId_employeeId_attendanceDate: {
        tenantId: tenant.id,
        employeeId,
        attendanceDate: TEST_DATE,
      },
    },
    update: {
      checkInAt: new Date('2035-03-04T03:30:00.000Z'),
      checkOutAt: new Date('2035-03-04T12:30:00.000Z'),
      status: 'PRESENT',
      workMode: 'WFH',
      totalMinutes: 540,
      notes: 'phase 3 contract test',
    },
    create: {
      tenantId: tenant.id,
      employeeId,
      attendanceDate: TEST_DATE,
      checkInAt: new Date('2035-03-04T03:30:00.000Z'),
      checkOutAt: new Date('2035-03-04T12:30:00.000Z'),
      status: 'PRESENT',
      workMode: 'WFH',
      totalMinutes: 540,
      notes: 'phase 3 contract test',
    },
  });
}

test('3.2 records and summary honor month, envelope shape, and scoped employee access', async () => {
  await seedAttendance(priya.employeeId);

  const priyaAuth = await login('priya@acme.test');
  const hrAuth = await login('hr@acme.test');

  const selfRecords = await app.inject({
    method: 'GET',
    url: `/api/v1/attendance/records?month=${TEST_MONTH}&limit=31`,
    headers: { cookie: priyaAuth.cookie },
  });
  assert.equal(selfRecords.statusCode, 200, selfRecords.body);
  const selfBody = selfRecords.json();
  assert.equal(selfBody.success, true);
  assert.equal(Array.isArray(selfBody.data.records), true);
  assert.equal(selfBody.data.records.length, 1);
  assert.equal(selfBody.data.records[0].referenceNo.startsWith('ATT-'), true);
  assert.equal(selfBody.data.records[0].workMode, 'WFH');
  assert.equal(selfBody.data.pagination.total, 1);

  const denied = await app.inject({
    method: 'GET',
    url: `/api/v1/attendance/records?month=${TEST_MONTH}&employeeId=${hr.employeeId}`,
    headers: { cookie: priyaAuth.cookie },
  });
  assert.equal(denied.statusCode, 403, denied.body);
  assert.equal(denied.json().error.code, 'FORBIDDEN');

  const scopedRecords = await app.inject({
    method: 'GET',
    url: `/api/v1/attendance/records?month=${TEST_MONTH}&employeeId=${priya.employeeId}&limit=31`,
    headers: { cookie: hrAuth.cookie },
  });
  assert.equal(scopedRecords.statusCode, 200, scopedRecords.body);
  assert.equal(scopedRecords.json().data.records.length, 1);

  const summary = await app.inject({
    method: 'GET',
    url: `/api/v1/attendance/summary?month=${TEST_MONTH}&employeeId=${priya.employeeId}`,
    headers: { cookie: hrAuth.cookie },
  });
  assert.equal(summary.statusCode, 200, summary.body);
  assert.deepEqual(
    {
      totalDays: summary.json().data.totalDays,
      present: summary.json().data.present,
      attendancePercentage: summary.json().data.attendancePercentage,
    },
    { totalDays: 1, present: 1, attendancePercentage: 100 },
  );
});

test('3.4 team records populate for HR tenant scope and manager direct-report scope', async () => {
  await seedAttendance(directReport.id);

  const hrAuth = await login('hr@acme.test');
  const managerAuth = await login('aman@acme.test');

  const hrTeam = await app.inject({
    method: 'GET',
    url: `/api/v1/attendance/team/records?month=${TEST_MONTH}&limit=31`,
    headers: { cookie: hrAuth.cookie },
  });
  assert.equal(hrTeam.statusCode, 200, hrTeam.body);
  assert.equal(hrTeam.json().success, true);
  assert.ok(
    hrTeam.json().data.records.some((record) => record.employeeId === directReport.id),
    'HR team records should include tenant employee attendance',
  );

  const managerTeam = await app.inject({
    method: 'GET',
    url: `/api/v1/attendance/team/records?month=${TEST_MONTH}&employeeId=${directReport.id}&limit=31`,
    headers: { cookie: managerAuth.cookie },
  });
  assert.equal(managerTeam.statusCode, 200, managerTeam.body);
  assert.equal(managerTeam.json().data.records.length, 1);
  assert.equal(managerTeam.json().data.records[0].employeeId, directReport.id);

  const managerDenied = await app.inject({
    method: 'GET',
    url: `/api/v1/attendance/team/records?month=${TEST_MONTH}&employeeId=${hr.employeeId}&limit=31`,
    headers: { cookie: managerAuth.cookie },
  });
  assert.equal(managerDenied.statusCode, 403, managerDenied.body);
});

test('3.3 regularization submit, team list, approve, and reviewer persistence', async () => {
  const priyaAuth = await login('priya@acme.test');
  const hrAuth = await login('hr@acme.test');

  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/attendance/regularization',
    headers: {
      cookie: priyaAuth.cookie,
      'content-type': 'application/json',
    },
    payload: {
      attendanceDate: REGULARIZATION_DATE.toISOString(),
      reason: 'Phase three contract test regularization request',
    },
  });
  assert.equal(created.statusCode, 201, created.body);
  assert.equal(created.json().data.referenceNo.startsWith('REG-'), true);
  assert.equal(created.json().data.status, 'PENDING');

  const teamList = await app.inject({
    method: 'GET',
    url: '/api/v1/attendance/team/regularization?status=PENDING&limit=100',
    headers: { cookie: hrAuth.cookie },
  });
  assert.equal(teamList.statusCode, 200, teamList.body);
  assert.ok(
    teamList.json().data.requests.some((request) => request.id === created.json().data.id),
    'HR team regularization list should include tenant request',
  );

  const employeeApproveDenied = await app.inject({
    method: 'PATCH',
    url: `/api/v1/attendance/regularization/${created.json().data.id}/approve`,
    headers: {
      cookie: priyaAuth.cookie,
      'content-type': 'application/json',
    },
    payload: { reviewerComment: 'employee cannot approve' },
  });
  assert.equal(employeeApproveDenied.statusCode, 403, employeeApproveDenied.body);

  const approved = await app.inject({
    method: 'PATCH',
    url: `/api/v1/attendance/regularization/${created.json().data.id}/approve`,
    headers: {
      cookie: hrAuth.cookie,
      'content-type': 'application/json',
    },
    payload: { reviewerComment: 'Approved by contract test' },
  });
  assert.equal(approved.statusCode, 200, approved.body);
  assert.equal(approved.json().data.status, 'APPROVED');

  const dbRow = await prisma.attendanceRegularizationRequest.findUnique({
    where: { id: created.json().data.id },
  });
  assert.equal(dbRow.status, 'APPROVED');
  assert.equal(dbRow.reviewerId, hr.id);
});
