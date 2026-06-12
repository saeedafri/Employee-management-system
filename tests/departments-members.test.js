/**
 * POST /departments/:id/members integration tests.
 *
 * Requires: NODE_ENV=test DATABASE_URL pointing to a test DB.
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('ems_test')) {
  throw new Error('Refusing to run department members tests against non-test DB. Set DATABASE_URL to a local test database.');
}

const TENANT_ID = 'test-members-tenant-' + Date.now();
let app;
let adminToken;
let managerToken;

let targetDeptId;   // Finance (target for add-member tests)
let sourceDeptId;   // HR (source employees come from here)
let childDeptId;    // Finance Sub (child of Finance)

let sourceEmployeeIds = [];  // HR employees — not in Finance at test start
let targetEmployeeId;        // already in Finance (for idempotency test)

async function login(email, password, tenantKey) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json', 'x-tenant-key': tenantKey },
    payload: { email, password },
  });
  return JSON.parse(res.body).data?.accessToken;
}

function headers(token) {
  return { authorization: `Bearer ${token}`, 'x-tenant-key': TENANT_ID, 'content-type': 'application/json' };
}

before(async () => {
  app = await createApp();

  await prisma.tenant.create({
    data: { id: TENANT_ID, name: 'Members Test Org', tenantKey: TENANT_ID, domain: null },
  });

  const { hashPassword } = await import('../src/utils/hash.js');
  const adminHash = await hashPassword('Password123!');
  const mgrHash   = await hashPassword('Password123!');

  await prisma.user.createMany({
    data: [
      { id: TENANT_ID + '-admin', tenantId: TENANT_ID, email: 'admin@members.test', passwordHash: adminHash, memberType: 'HR_ADMIN', status: 'ACTIVE' },
      { id: TENANT_ID + '-mgr',   tenantId: TENANT_ID, email: 'mgr@members.test',   passwordHash: mgrHash,   memberType: 'MANAGER',  status: 'ACTIVE' },
    ],
  });

  [adminToken, managerToken] = await Promise.all([
    login('admin@members.test', 'Password123!', TENANT_ID),
    login('mgr@members.test',   'Password123!', TENANT_ID),
  ]);

  // Create departments
  const finResp = await app.inject({ method: 'POST', url: '/api/v1/departments', headers: headers(adminToken), payload: { name: 'Finance',     departmentCode: 'FIN-MBR'  } });
  const hrResp  = await app.inject({ method: 'POST', url: '/api/v1/departments', headers: headers(adminToken), payload: { name: 'HR',          departmentCode: 'HR-MBR'   } });
  targetDeptId = JSON.parse(finResp.body).data?.id;
  sourceDeptId = JSON.parse(hrResp.body).data?.id;

  const subResp = await app.inject({ method: 'POST', url: '/api/v1/departments', headers: headers(adminToken), payload: { name: 'Finance Sub', departmentCode: 'FIN-SUB-MBR', parentId: targetDeptId } });
  childDeptId = JSON.parse(subResp.body).data?.id;

  const { generateId } = await import('../src/utils/id.js');

  // Create 2 HR employees (will be moved to Finance in tests)
  for (let i = 1; i <= 2; i++) {
    const emp = await prisma.employee.create({
      data: {
        id: generateId(),
        tenantId: TENANT_ID,
        employeeCode: `HR-MBR-${i}`,
        firstName: `HrEmp${i}`,
        lastName: 'Test',
        workEmail: `hremp${i}@members.test`,
        departmentId: sourceDeptId,
        joinedOn: new Date('2025-01-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
      },
    });
    sourceEmployeeIds.push(emp.id);
  }

  // Create 1 employee already in Finance (for idempotency test)
  const finEmp = await prisma.employee.create({
    data: {
      id: generateId(),
      tenantId: TENANT_ID,
      employeeCode: 'FIN-EXIST',
      firstName: 'FinanceExisting',
      lastName: 'Test',
      workEmail: 'finexist@members.test',
      departmentId: targetDeptId,
      joinedOn: new Date('2025-01-01'),
      employmentStatus: 'ACTIVE',
      employmentType: 'FULL_TIME',
    },
  });
  targetEmployeeId = finEmp.id;
});

after(async () => {
  await prisma.employee.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.department.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.delete({ where: { id: TENANT_ID } });
  await app.close();
});

describe('POST /departments/:id/members', () => {
  it('HR_ADMIN adds 2 employees from another dept → added: 2, skipped: 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/departments/${targetDeptId}/members`,
      headers: headers(adminToken),
      payload: { employeeIds: sourceEmployeeIds },
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.added).to.equal(2);
    expect(data.skipped).to.equal(0);
    expect(data._count.employees).to.equal(3); // 2 new + 1 existing Finance employee
  });

  it('Repeat same call is idempotent → added: 0, skipped: 2', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/departments/${targetDeptId}/members`,
      headers: headers(adminToken),
      payload: { employeeIds: sourceEmployeeIds },
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.added).to.equal(0);
    expect(data.skipped).to.equal(2);
  });

  it('Already-in-dept employee in list → skipped count includes them', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/departments/${targetDeptId}/members`,
      headers: headers(adminToken),
      payload: { employeeIds: [targetEmployeeId] },
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.added).to.equal(0);
    expect(data.skipped).to.equal(1);
  });

  it('GET /departments/:id/employees reflects added members', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/departments/${targetDeptId}/employees`,
      headers: headers(adminToken),
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.pagination.total).to.equal(3);
    const ids = data.data.map(e => e.id);
    expect(ids).to.include(sourceEmployeeIds[0]);
    expect(ids).to.include(sourceEmployeeIds[1]);
    expect(ids).to.include(targetEmployeeId);
  });

  it('GET /employees?departmentId reflects added members', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/employees?departmentId=${targetDeptId}`,
      headers: headers(adminToken),
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.pagination.total).to.equal(3);
  });

  it('Add to child department increases parent roll-up count', async () => {
    // Move one HR employee to the child dept (Finance Sub)
    const hrEmpForChild = sourceEmployeeIds[0];
    // First move them to HR again so they are not in Finance subtree
    await prisma.employee.update({ where: { id: hrEmpForChild }, data: { departmentId: sourceDeptId } });

    const preBefore = await app.inject({ method: 'GET', url: `/api/v1/departments/${targetDeptId}`, headers: headers(adminToken) });
    const parentBefore = JSON.parse(preBefore.body).data.totalHeadcount;

    // Add to child (Finance Sub)
    const addRes = await app.inject({
      method: 'POST',
      url: `/api/v1/departments/${childDeptId}/members`,
      headers: headers(adminToken),
      payload: { employeeIds: [hrEmpForChild] },
    });
    expect(addRes.statusCode).to.equal(200);
    expect(JSON.parse(addRes.body).data.added).to.equal(1);

    const parentAfter = await app.inject({ method: 'GET', url: `/api/v1/departments/${targetDeptId}`, headers: headers(adminToken) });
    expect(JSON.parse(parentAfter.body).data.totalHeadcount).to.equal(parentBefore + 1);

    // Restore: move back to HR
    await prisma.employee.update({ where: { id: hrEmpForChild }, data: { departmentId: targetDeptId } });
  });

  it('employeeIds: [] → 422 VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/departments/${targetDeptId}/members`,
      headers: headers(adminToken),
      payload: { employeeIds: [] },
    });
    expect(res.statusCode).to.equal(422);
    expect(JSON.parse(res.body).error.code).to.equal('VALIDATION_ERROR');
  });

  it('Non-existent employee → 404 EMPLOYEE_NOT_FOUND, no partial update', async () => {
    const finBefore = await app.inject({ method: 'GET', url: `/api/v1/departments/${targetDeptId}`, headers: headers(adminToken) });
    const countBefore = JSON.parse(finBefore.body).data.totalHeadcount;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/departments/${targetDeptId}/members`,
      headers: headers(adminToken),
      payload: { employeeIds: ['nonexistent-id-abc'] },
    });
    expect(res.statusCode).to.equal(404);
    const err = JSON.parse(res.body).error;
    expect(err.code).to.equal('EMPLOYEE_NOT_FOUND');
    expect(err.details.employeeIds).to.include('nonexistent-id-abc');

    // Count unchanged — no partial update
    const finAfter = await app.inject({ method: 'GET', url: `/api/v1/departments/${targetDeptId}`, headers: headers(adminToken) });
    expect(JSON.parse(finAfter.body).data.totalHeadcount).to.equal(countBefore);
  });

  it('MANAGER role → 403 FORBIDDEN', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/departments/${targetDeptId}/members`,
      headers: headers(managerToken),
      payload: { employeeIds: [targetEmployeeId] },
    });
    expect(res.statusCode).to.equal(403);
    expect(JSON.parse(res.body).error.code).to.equal('FORBIDDEN');
  });

  it('Non-existent department → 404 DEPARTMENT_NOT_FOUND', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/departments/nonexistent-dept-id/members',
      headers: headers(adminToken),
      payload: { employeeIds: [targetEmployeeId] },
    });
    expect(res.statusCode).to.equal(404);
    expect(JSON.parse(res.body).error.code).to.equal('DEPARTMENT_NOT_FOUND');
  });
});
