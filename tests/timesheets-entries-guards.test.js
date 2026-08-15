/**
 * POST /timesheets/entries guard tests — needs a LOCAL Postgres.
 * Run: DATABASE_URL=postgresql://localhost:5432/ems_test NODE_ENV=test \
 *      node --test tests/timesheets-entries-guards.test.js
 *
 * Locks the contract for the 2026-08-02 live 500 (prod reqId req-47):
 *   error {"name":"PrismaClientValidationError"} → "Unhandled error" → 500
 *
 *   #1  Caller with no linked Employee (SUPER_ADMIN) reached
 *       prisma.timesheet.findUnique with employeeId: undefined → 500.
 *       Now 400 NO_EMPLOYEE. Same guard on copy-week.
 *   #2  Unknown projectId hit TimeEntry_projectId_fkey (P2003) → 500.
 *       Now 404 PROJECT_NOT_FOUND.
 */
import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import { createAccessToken } from '../src/utils/token.js';
import { assertTestDatabase } from './assertTestDatabase.js';

const suffix = 'tsguard' + Date.now();
let app;
let tenant;
let project;
let adminToken;
let employeeToken;

before(async () => {
  // Never let this suite point at a shared/remote database. This used to check
  // the server ADDRESS, which the shared guard's own header explains is the weak
  // test: an SSH tunnel to production presents 127.0.0.1 and sails through,
  // while a CI service container presents 172.18.0.2 and is refused despite
  // being a throwaway. Judge the database NAME, which a tunnel cannot disguise.
  assertTestDatabase('the timesheets entry guards');

  app = await createApp();
  await app.ready();

  tenant = await prisma.tenant.create({
    data: {
      name: 'Guard ' + suffix,
      legalName: 'Guard Ltd',
      displayName: 'Guard',
      country: 'IN',
      primaryContactEmail: `admin@${suffix}.test`,
      tenantKey: suffix,
    },
  });

  // A SUPER_ADMIN with no Employee row — login omits employeeId from the JWT
  // entirely, because `user.employee?.id` is undefined and JWT drops undefined keys.
  const admin = await prisma.user.create({
    data: { tenantId: tenant.id, email: `admin@${suffix}.test`, passwordHash: 'x', memberType: 'SUPER_ADMIN' },
  });
  const adminSession = await prisma.session.create({
    data: {
      tenantId: tenant.id, userId: admin.id, refreshTokenHash: 'h' + suffix,
      sessionFamilyId: 'f' + suffix, expiresAt: new Date(Date.now() + 864e5),
    },
  });
  adminToken = await createAccessToken({
    sub: admin.id, tenantId: tenant.id, memberType: 'SUPER_ADMIN',
    sessionId: adminSession.id, permissions: ['timesheets:read', 'timesheets:write'],
  });

  const employee = await prisma.employee.create({
    data: {
      tenantId: tenant.id, employeeCode: 'E' + suffix.slice(-6), firstName: 'Priya',
      lastName: 'R', workEmail: `priya@${suffix}.test`, joinedOn: new Date(),
    },
  });
  const employeeUser = await prisma.user.create({
    data: {
      tenantId: tenant.id, email: `priya@${suffix}.test`, passwordHash: 'x',
      memberType: 'EMPLOYEE', employeeId: employee.id,
    },
  });
  const employeeSession = await prisma.session.create({
    data: {
      tenantId: tenant.id, userId: employeeUser.id, refreshTokenHash: 'h2' + suffix,
      sessionFamilyId: 'f2' + suffix, expiresAt: new Date(Date.now() + 864e5),
    },
  });
  employeeToken = await createAccessToken({
    sub: employeeUser.id, tenantId: tenant.id, memberType: 'EMPLOYEE', employeeId: employee.id,
    sessionId: employeeSession.id, permissions: ['timesheets:read', 'timesheets:write'],
  });

  project = await prisma.timesheetProject.create({
    data: { tenantId: tenant.id, name: 'Guard Project', code: 'GP' + suffix.slice(-5), billable: true },
  });
});

after(async () => {
  if (tenant) {
    await prisma.timeEntry.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.timesheet.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.timesheetProject.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.session.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.employee.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.tenant.delete({ where: { id: tenant.id } });
  }
  if (app) await app.close();
  await prisma.$disconnect();
});

function createEntry(token, payload) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/timesheets/entries',
    headers: { authorization: `Bearer ${token}`, 'x-tenant-key': suffix, 'content-type': 'application/json' },
    payload,
  });
}

const base = { weekStart: '2026-07-27', date: '2026-07-27', hours: 2, billable: true, note: 'Audit FY26' };

test('caller with no employee profile gets 400 NO_EMPLOYEE, not a 500', async () => {
  const res = await createEntry(adminToken, { ...base, projectId: project.id });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, 'NO_EMPLOYEE');
});

test('unknown projectId gets 404 PROJECT_NOT_FOUND, not an FK 500', async () => {
  const res = await createEntry(employeeToken, { ...base, projectId: 'prj-does-not-exist' });
  assert.equal(res.statusCode, 404);
  assert.equal(JSON.parse(res.body).error.code, 'PROJECT_NOT_FOUND');
});

test('employee with a profile and a real project still creates the entry', async () => {
  const res = await createEntry(employeeToken, { ...base, projectId: project.id });
  assert.equal(res.statusCode, 201);
  const entry = JSON.parse(res.body).data;
  assert.equal(entry.hours, 2);
  assert.equal(entry.projectId, project.id);
});

test('omitted billable is still inferred from the project', async () => {
  const res = await createEntry(employeeToken, {
    weekStart: '2026-07-27', date: '2026-07-29', hours: 3, projectId: project.id,
  });
  assert.equal(res.statusCode, 201);
  assert.equal(JSON.parse(res.body).data.billable, true);
});

test('copy-week applies the same no-employee guard', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/timesheets/copy-week',
    headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': suffix, 'content-type': 'application/json' },
    payload: { fromWeekStart: '2026-07-20', toWeekStart: '2026-07-27' },
  });
  assert.equal(res.statusCode, 400);
  assert.equal(JSON.parse(res.body).error.code, 'NO_EMPLOYEE');
});
