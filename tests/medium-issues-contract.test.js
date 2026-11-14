/**
 * Contract for the 2026-11-14 medium-issue round (docs/API_MAPPING.md, "round 2").
 * Requires: NODE_ENV=test DATABASE_URL pointing to a test DB.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import { assertTestDatabase } from './assertTestDatabase.js';

assertTestDatabase('medium issues contract');

const TENANT_ID = 'test-medium-tenant-' + Date.now();
let app;
let hr;
let mgr;
const employeeIds = [];

async function login(email) {
  const res = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT_ID },
    payload: { email, password: 'Password123!' },
  });
  return JSON.parse(res.body).data?.accessToken;
}

async function call(token, method, url, payload) {
  const res = await app.inject({
    method, url: `/api/v1${url}`, payload,
    headers: { authorization: `Bearer ${token}`, 'x-tenant-key': TENANT_ID, 'content-type': 'application/json' },
  });
  return { status: res.statusCode, body: JSON.parse(res.body || '{}') };
}

before(async () => {
  app = await createApp();
  await prisma.tenant.create({
    data: {
      id: TENANT_ID, name: 'Medium Test Org', legalName: 'Medium Test Org', displayName: 'Medium Test Org',
      country: 'IN', primaryContactEmail: 'owner@medium.test', tenantKey: TENANT_ID,
    },
  });
  const { hashPassword } = await import('../src/utils/hash.js');
  const passwordHash = await hashPassword('Password123!');
  await prisma.user.createMany({
    data: [
      { id: `${TENANT_ID}-hr`, tenantId: TENANT_ID, email: 'hr@medium.test', passwordHash, memberType: 'HR_ADMIN', status: 'ACTIVE' },
      { id: `${TENANT_ID}-mgr`, tenantId: TENANT_ID, email: 'mgr@medium.test', passwordHash, memberType: 'MANAGER', status: 'ACTIVE' },
    ],
  });
  for (let i = 1; i <= 2; i++) {
    const emp = await prisma.employee.create({
      data: {
        tenantId: TENANT_ID, employeeCode: `MED-${i}`, firstName: `Med${i}`, lastName: 'Test',
        workEmail: `med${i}@medium.test`, joinedOn: new Date('2025-01-01'),
        employmentStatus: 'ACTIVE', employmentType: 'FULL_TIME',
      },
    });
    employeeIds.push(emp.id);
  }
  [hr, mgr] = await Promise.all([login('hr@medium.test'), login('mgr@medium.test')]);
});

after(async () => {
  await prisma.performanceReview.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.performanceCycle.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.announcement.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.announcementChannel.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.userRole.deleteMany({ where: { user: { tenantId: TENANT_ID } } });
  await prisma.employee.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.department.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.delete({ where: { id: TENANT_ID } });
  await app.close();
});

describe('departments store their depth', () => {
  it('child = parent + 1, and re-parenting shifts the subtree', async () => {
    const a = (await call(hr, 'POST', '/departments', { name: 'Root', departmentCode: 'MED-A' })).body.data;
    const b = (await call(hr, 'POST', '/departments', { name: 'Child', departmentCode: 'MED-B', parentId: a.id })).body.data;
    const c = (await call(hr, 'POST', '/departments', { name: 'Grandchild', departmentCode: 'MED-C', parentId: b.id })).body.data;
    assert.deepEqual([a.depth, b.depth, c.depth], [0, 1, 2]);

    const moved = await call(hr, 'PATCH', `/departments/${b.id}`, { parentId: null });
    assert.equal(moved.status, 200);
    const depths = await prisma.department.findMany({ where: { id: { in: [b.id, c.id] } }, select: { id: true, depth: true } });
    assert.deepEqual(Object.fromEntries(depths.map((d) => [d.id, d.depth])), { [b.id]: 0, [c.id]: 1 });
  });
});

describe('announcements work for a tenant with no channel', () => {
  it('first post lands in an auto-created General channel', async () => {
    const res = await call(hr, 'POST', '/announcements', { title: 'Hello', body: 'First post', category: 'Company' });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const channels = await prisma.announcementChannel.findMany({ where: { tenantId: TENANT_ID } });
    assert.deepEqual(channels.map((c) => c.name), ['General']);
  });

  it('channels can be created; duplicates are 409', async () => {
    const created = await call(hr, 'POST', '/announcements/channels', { name: 'IT news', category: 'IT' });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.name, 'IT news');
    assert.equal((await call(hr, 'POST', '/announcements/channels', { name: 'IT news', category: 'IT' })).status, 409);
    assert.equal((await call(mgr, 'POST', '/announcements/channels', { name: 'Nope', category: 'IT' })).status, 403);
  });
});

describe('performance cycles', () => {
  it('starting a cycle opens a review per active employee; only one open cycle at a time', async () => {
    const body = { name: 'H2', selfReviewDue: '2026-12-01', managerReviewDue: '2026-12-10', calibrationDate: '2026-12-20' };
    const first = await call(hr, 'POST', '/performance/cycles', body);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    assert.equal(first.body.data.reviewsCreated, employeeIds.length);
    assert.equal((await call(hr, 'POST', '/performance/cycles', body)).status, 409);

    assert.equal((await call(hr, 'PATCH', `/performance/cycles/${first.body.data.id}`, { status: 'Closed' })).status, 200);
    assert.equal((await call(hr, 'POST', '/performance/cycles', { ...body, name: 'H3' })).status, 201);
    assert.equal((await call(hr, 'POST', '/performance/cycles', { ...body, managerReviewDue: '2026-11-01' })).status, 422);
  });
});

describe('roles can be taken away', () => {
  it('assign then remove a user; a second removal is 404', async () => {
    assert.equal((await call(hr, 'POST', '/settings/roles', { name: 'Readers', key: 'MED_READERS', permissions: ['employees:read'] })).status, 201);
    assert.equal((await call(hr, 'POST', '/settings/roles/MED_READERS/users', { userIds: [`${TENANT_ID}-mgr`] })).status, 200);
    const removed = await call(hr, 'DELETE', `/settings/roles/MED_READERS/users/${TENANT_ID}-mgr`);
    assert.equal(removed.status, 200, JSON.stringify(removed.body));
    assert.equal((await call(hr, 'DELETE', `/settings/roles/MED_READERS/users/${TENANT_ID}-mgr`)).status, 404);
  });
});

describe('error codes instead of 500 / 400 / echoed data', () => {
  it('optional-selections without year is 422', async () => {
    assert.equal((await call(hr, 'GET', '/holidays/optional-selections')).status, 422);
  });

  it('unknown holiday is 404', async () => {
    assert.equal((await call(hr, 'PATCH', '/holidays/cnonexistent00000000000000', { name: 'x' })).status, 404);
  });

  it('ledger for an unknown employee is 404; a manager cannot read a non-report', async () => {
    assert.equal((await call(hr, 'GET', '/leave/ledger?employeeId=cnonexistent00000000000000')).status, 404);
    assert.equal((await call(mgr, 'GET', `/leave/ledger?employeeId=${employeeIds[0]}`)).status, 403);
  });
});
