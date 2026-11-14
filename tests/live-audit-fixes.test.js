/**
 * Contract for the backend fixes from the 2026-11-14 live UI audit (docs/API_MAPPING.md, "round 3").
 * Requires: NODE_ENV=test DATABASE_URL pointing to a test DB.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import { assertTestDatabase } from './assertTestDatabase.js';
import { changeEmployeeRole } from '../src/modules/employees/employees.service.js';

assertTestDatabase('live audit fixes');

const STAMP = Date.now();
const TENANT_ID = `test-audit-fix-${STAMP}`;
const OTHER_TENANT = `test-audit-other-${STAMP}`;
const PASSWORD = 'Password123!';
let app;
let deptId;
const ids = {};
const tokens = {};
const registered = [];

async function login(email) {
  const res = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT_ID },
    payload: { email, password: PASSWORD },
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
  const tenant = (id) => ({ id, name: id, legalName: id, displayName: id, country: '', primaryContactEmail: `owner@${id}.test`, tenantKey: id });
  await prisma.tenant.createMany({ data: [tenant(TENANT_ID), tenant(OTHER_TENANT)] });
  deptId = (await prisma.department.create({ data: { tenantId: TENANT_ID, name: 'Eng', departmentCode: 'ENG' } })).id;
  // Another company already uses E0001–E0005: the codes here must not collide with it.
  await prisma.employee.createMany({
    data: [1, 2, 3, 4, 5].map((n) => ({
      tenantId: OTHER_TENANT, employeeCode: `E000${n}`, firstName: 'Other', lastName: `${n}`,
      workEmail: `other${n}@${OTHER_TENANT}.test`, joinedOn: new Date('2025-01-01'), employmentStatus: 'ACTIVE', employmentType: 'FULL_TIME',
    })),
  });

  const { hashPassword } = await import('../src/utils/hash.js');
  const passwordHash = await hashPassword(PASSWORD);
  const person = async (key, memberType, managerId = null) => {
    const emp = await prisma.employee.create({
      data: {
        tenantId: TENANT_ID, employeeCode: `T-${key}`, firstName: key, lastName: 'Fix', workEmail: `${key}@${TENANT_ID}.test`,
        joinedOn: new Date('2025-01-01'), employmentStatus: 'ACTIVE', employmentType: 'FULL_TIME', departmentId: deptId, managerId,
      },
    });
    const user = await prisma.user.create({
      data: { tenantId: TENANT_ID, email: emp.workEmail, passwordHash, memberType, status: 'ACTIVE', employeeId: emp.id },
    });
    await prisma.employee.update({ where: { id: emp.id }, data: { userId: user.id } });
    ids[key] = { employeeId: emp.id, userId: user.id };
  };
  await person('sa', 'SUPER_ADMIN');
  await person('hr', 'HR_ADMIN');
  await person('mgr', 'MANAGER');
  await person('emp', 'EMPLOYEE', ids.mgr.employeeId);
  for (const k of ['sa', 'hr', 'mgr', 'emp']) tokens[k] = await login(`${k}@${TENANT_ID}.test`);
});

after(async () => {
  for (const id of [TENANT_ID, OTHER_TENANT, ...registered]) await prisma.tenant.delete({ where: { id } }).catch(() => {});
  await app.close();
});

describe('leave preview carries what the request dialog needs', () => {
  it('returns errors[] and balances, and submit refuses exactly what the preview lists', async () => {
    const pv = await call(tokens.emp, 'GET', '/leave/requests/preview?leaveTypeId=EL&startDate=2027-03-03&endDate=2027-03-03');
    assert.equal(pv.status, 200, JSON.stringify(pv.body));
    const d = pv.body.data;
    assert.ok(Array.isArray(d.errors), 'errors must be an array (the dialog reads errors.length)');
    assert.equal(d.chargeableDays, 1);
    const submit = await call(tokens.emp, 'POST', '/leave/requests', { leaveTypeId: 'EL', startDate: '2027-03-03', endDate: '2027-03-03', reason: 'preview contract' });
    if (d.errors.length) {
      assert.equal(submit.body.error?.message, d.errors[0]);
    } else {
      assert.equal(submit.status, 201, JSON.stringify(submit.body));
      assert.equal(typeof d.balanceBefore, 'number');
      assert.equal(d.balanceAfter, d.balanceBefore - 1);
      const again = await call(tokens.emp, 'GET', '/leave/requests/preview?leaveTypeId=EL&startDate=2027-03-03&endDate=2027-03-03');
      assert.ok(again.body.data.errors.includes('Overlapping leave request exists'));
    }
  });

  it('lists every blocking reason at once', async () => {
    const pv = await call(tokens.emp, 'GET', '/leave/requests/preview?leaveTypeId=NOPE&startDate=2027-03-06&endDate=2027-03-07');
    assert.equal(pv.status, 200);
    assert.ok(pv.body.data.errors.includes('Leave type not found'));
    assert.ok(pv.body.data.errors.some((e) => /no chargeable working days/.test(e)));
    assert.equal(pv.body.data.balanceBefore, null);
  });

  it('without a leave type: no errors for a working day, balances null', async () => {
    const pv = await call(tokens.emp, 'GET', '/leave/requests/preview?startDate=2027-03-10&endDate=2027-03-10');
    assert.deepEqual(pv.body.data.errors, []);
    assert.equal(pv.body.data.balanceAfter, null);
  });
});

describe('employee codes are per company', () => {
  it('next-code ignores other companies, and a code another company uses is accepted', async () => {
    const count = await prisma.employee.count({ where: { tenantId: TENANT_ID } });
    const next = await call(tokens.hr, 'GET', '/employees/next-code');
    assert.equal(next.body.data.code, `E${String(count + 1).padStart(4, '0')}`);
    const created = await call(tokens.hr, 'POST', '/employees', {
      firstName: 'Code', lastName: 'Clash', workEmail: `clash@${TENANT_ID}.test`, employeeCode: 'E0001',
      designation: 'Dev', departmentId: deptId, employmentType: 'FULL_TIME', joinedOn: '2026-01-05',
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
  });
});

describe('invites never drop the account', () => {
  it('no personal email: the invite goes to the work email and the role is kept', async () => {
    const r = await call(tokens.hr, 'POST', '/employees', {
      firstName: 'Inv', lastName: 'Ite', workEmail: `invite@${TENANT_ID}.test`, designation: 'Lead', departmentId: deptId,
      employmentType: 'FULL_TIME', joinedOn: '2026-01-05', memberType: 'MANAGER', sendInvite: true,
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.invite?.sentTo, 'WORK');
    const user = await prisma.user.findFirst({ where: { tenantId: TENANT_ID, email: `invite@${TENANT_ID}.test` } });
    assert.equal(user?.memberType, 'MANAGER');
    assert.equal(user?.status, 'INVITED');
  });
});

describe('changing a login role', () => {
  it('HR promotes an employee to manager; their sessions end', async () => {
    const r = await call(tokens.hr, 'PATCH', `/employees/${ids.emp.employeeId}/role`, { memberType: 'MANAGER' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual([r.body.data.previous, r.body.data.memberType], ['EMPLOYEE', 'MANAGER']);
    assert.equal(await prisma.session.count({ where: { userId: ids.emp.userId, revokedAt: null } }), 0);
    await call(tokens.hr, 'PATCH', `/employees/${ids.emp.employeeId}/role`, { memberType: 'EMPLOYEE' });
    tokens.emp = await login(`emp@${TENANT_ID}.test`);
  });

  it('only a super admin grants super admin; nobody changes their own role', async () => {
    assert.equal((await call(tokens.hr, 'PATCH', `/employees/${ids.mgr.employeeId}/role`, { memberType: 'SUPER_ADMIN' })).status, 403);
    assert.equal((await call(tokens.hr, 'PATCH', `/employees/${ids.hr.employeeId}/role`, { memberType: 'MANAGER' })).status, 403);
    assert.equal((await call(tokens.sa, 'PATCH', `/employees/${ids.mgr.employeeId}/role`, { memberType: 'AUDITOR' })).status, 200);
    assert.equal((await call(tokens.sa, 'PATCH', `/employees/${ids.mgr.employeeId}/role`, { memberType: 'MANAGER' })).status, 200);
    tokens.mgr = await login(`mgr@${TENANT_ID}.test`);
  });

  it('the last super admin cannot be demoted; an employee without a login is 409', async () => {
    const r = await changeEmployeeRole(TENANT_ID, ids.sa.employeeId, 'HR_ADMIN', { id: ids.hr.userId }, { canGrantSuperAdmin: true });
    assert.equal(r.error?.code, 'LAST_SUPER_ADMIN');
    const noLogin = await prisma.employee.create({
      data: { tenantId: TENANT_ID, employeeCode: 'T-nologin', firstName: 'No', lastName: 'Login', workEmail: `nologin@${TENANT_ID}.test`, joinedOn: new Date('2025-01-01'), employmentStatus: 'ACTIVE', employmentType: 'FULL_TIME' },
    });
    assert.equal((await call(tokens.sa, 'PATCH', `/employees/${noLogin.id}/role`, { memberType: 'MANAGER' })).status, 409);
  });
});

describe('timesheet history', () => {
  it('records submit and approve, and an employee reads only their own history', async () => {
    const project = await call(tokens.hr, 'POST', '/timesheets/projects', { name: 'Audit fixes', code: 'AF' });
    assert.equal(project.status, 201, JSON.stringify(project.body));
    const entry = await call(tokens.emp, 'POST', '/timesheets/entries', { weekStart: '2026-10-05', projectId: project.body.data.id, date: '2026-10-06', hours: 8 });
    assert.equal(entry.status, 201, JSON.stringify(entry.body));
    const sheet = await prisma.timesheet.findFirst({ where: { tenantId: TENANT_ID, employeeId: ids.emp.employeeId } });
    assert.equal((await call(tokens.emp, 'POST', `/timesheets/${sheet.id}/submit`, {})).status, 200);

    const own = await call(tokens.emp, 'GET', `/timesheets/audit?timesheetId=${sheet.id}`);
    assert.equal(own.status, 200, JSON.stringify(own.body));
    assert.deepEqual(own.body.data.map((a) => a.action), ['WEEK_SUBMITTED']);
    assert.equal(own.body.data[0].weekStart, '2026-10-05');

    const snoop = await call(tokens.emp, 'GET', `/timesheets/audit?employeeId=${ids.mgr.employeeId}`);
    assert.ok(snoop.body.data.every((a) => a.employeeId === ids.emp.employeeId), 'non-approvers see only their own weeks');

    assert.equal((await call(tokens.mgr, 'POST', `/timesheets/${sheet.id}/approve`, { comment: 'ok' })).status, 200);
    const after = await call(tokens.mgr, 'GET', `/timesheets/audit?timesheetId=${sheet.id}`);
    assert.deepEqual(after.body.data.map((a) => a.action), ['WEEK_APPROVED', 'WEEK_SUBMITTED']);
    assert.equal(after.body.data[0].comment, 'ok');
  });
});

describe('leave policies: "New version" on an unsaved starter pack', () => {
  it('saves the pack and versions the saved copy', async () => {
    assert.equal(await prisma.leavePolicy.count({ where: { tenantId: TENANT_ID } }), 0);
    const r = await call(tokens.sa, 'POST', '/leave/policies/pack-in/new-version', {});
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.data.country, 'IN');
    assert.ok((await prisma.leavePolicy.count({ where: { tenantId: TENANT_ID, country: 'IN' } })) >= 2);
  });
});

describe('signup records the company country', () => {
  it('stores an ISO code and rejects anything else', async () => {
    const email = `founder-${STAMP}@audit-fix.test`;
    const ok = await app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: { 'content-type': 'application/json' }, payload: { companyName: `Audit Fix ${STAMP}`, fullName: 'Founder', email, password: PASSWORD, country: 'in' } });
    assert.equal(ok.statusCode, 201, ok.body);
    const tenant = await prisma.tenant.findFirst({ where: { primaryContactEmail: email } });
    registered.push(tenant.id);
    assert.equal(tenant.country, 'IN');
    const bad = await app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: { 'content-type': 'application/json' }, payload: { companyName: 'Bad Country', fullName: 'Founder', email: `bad-${email}`, password: PASSWORD, country: 'India' } });
    assert.equal(bad.statusCode, 422);
  });
});
