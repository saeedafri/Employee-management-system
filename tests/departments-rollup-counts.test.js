/**
 * Department roll-up count tests.
 *
 * Verifies that parent department counts include all descendant employees,
 * that GET /departments/:id/employees returns subtree employees,
 * that GET /employees?departmentId= is subtree-aware,
 * and that soft-deleted employees are excluded from all counts and lists.
 *
 * Requires: NODE_ENV=test DATABASE_URL pointing to a test DB.
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';

// Guard: never run against production DB
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1') && !dbUrl.includes('ems_test')) {
  throw new Error('Refusing to run department rollup tests against non-test DB. Set DATABASE_URL to a local test database.');
}

const TENANT_ID = 'test-rollup-tenant-' + Date.now();
let app;
let adminToken;

// IDs created in before()
let engDeptId;
let backendDeptId;
let engEmployeeIds = [];
let backendEmployeeId;
let deletedEmployeeId;

async function login(email, password, tenantKey) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json', 'x-tenant-key': tenantKey },
    payload: { email, password },
  });
  return JSON.parse(res.body).data?.accessToken;
}

before(async () => {
  app = await createApp();

  // Create a minimal tenant + HR admin user for auth
  const tenant = await prisma.tenant.create({
    data: {
      id: TENANT_ID,
      name: 'Rollup Test Org',
      tenantKey: TENANT_ID,
      domain: null,
    },
  });

  // Create HR admin user
  const { hashPassword } = await import('../src/utils/hash.js');
  const passwordHash = await hashPassword('Password123!');
  await prisma.user.create({
    data: {
      id: 'test-rollup-admin-' + Date.now(),
      tenantId: TENANT_ID,
      email: 'rollup-admin@test.local',
      passwordHash,
      memberType: 'HR_ADMIN',
      status: 'ACTIVE',
    },
  });

  adminToken = await login('rollup-admin@test.local', 'Password123!', TENANT_ID);

  // Create departments: Engineering → Backend Engineering
  const engResp = await app.inject({
    method: 'POST',
    url: '/api/v1/departments',
    headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID, 'content-type': 'application/json' },
    payload: { name: 'Engineering', departmentCode: 'ENG-ROLLUP' },
  });
  engDeptId = JSON.parse(engResp.body).data?.id;

  const beResp = await app.inject({
    method: 'POST',
    url: '/api/v1/departments',
    headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID, 'content-type': 'application/json' },
    payload: { name: 'Backend Engineering', departmentCode: 'BACK-ROLLUP', parentId: engDeptId },
  });
  backendDeptId = JSON.parse(beResp.body).data?.id;

  // Create 4 employees directly in Engineering
  const { generateId } = await import('../src/utils/id.js');
  for (let i = 1; i <= 4; i++) {
    const emp = await prisma.employee.create({
      data: {
        id: generateId(),
        tenantId: TENANT_ID,
        employeeCode: `ENG-${i}`,
        firstName: `Eng${i}`,
        lastName: 'Test',
        workEmail: `eng${i}@rollup.test`,
        departmentId: engDeptId,
        joinedOn: new Date('2025-01-01'),
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
      },
    });
    engEmployeeIds.push(emp.id);
  }

  // Create 1 employee in Backend Engineering
  const beEmp = await prisma.employee.create({
    data: {
      id: generateId(),
      tenantId: TENANT_ID,
      employeeCode: 'BACK-1',
      firstName: 'Backend1',
      lastName: 'Test',
      workEmail: 'back1@rollup.test',
      departmentId: backendDeptId,
      joinedOn: new Date('2025-01-01'),
      employmentStatus: 'ACTIVE',
      employmentType: 'FULL_TIME',
    },
  });
  backendEmployeeId = beEmp.id;

  // Create 1 soft-deleted employee in Engineering (should NOT be counted)
  const delEmp = await prisma.employee.create({
    data: {
      id: generateId(),
      tenantId: TENANT_ID,
      employeeCode: 'ENG-DEL',
      firstName: 'Deleted',
      lastName: 'Test',
      workEmail: 'deleted@rollup.test',
      departmentId: engDeptId,
      joinedOn: new Date('2025-01-01'),
      employmentStatus: 'TERMINATED',
      employmentType: 'FULL_TIME',
      deletedAt: new Date(),
    },
  });
  deletedEmployeeId = delEmp.id;
});

after(async () => {
  // Clean up test data
  await prisma.employee.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.department.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.user.deleteMany({ where: { tenantId: TENANT_ID } });
  await prisma.tenant.delete({ where: { id: TENANT_ID } });
  await app.close();
});

describe('Department roll-up counts', () => {
  it('GET /departments — Engineering roll-up count = 5 (4 direct + 1 backend)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/departments',
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID },
    });
    expect(res.statusCode).to.equal(200);
    const tree = JSON.parse(res.body).data;
    const eng = tree.find(d => d.id === engDeptId);
    expect(eng, 'Engineering dept in tree').to.exist;
    expect(eng._count.employees, 'Engineering rollup count').to.equal(5);
    expect(eng.directEmployeeCount, 'Engineering direct count').to.equal(4);
  });

  it('GET /departments — Backend Engineering count = 1 (direct only)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/departments',
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID },
    });
    const tree = JSON.parse(res.body).data;
    const eng = tree.find(d => d.id === engDeptId);
    const be = eng?.children?.find(c => c.id === backendDeptId);
    expect(be, 'Backend Engineering in children').to.exist;
    expect(be._count.employees, 'Backend Engineering count').to.equal(1);
  });

  it('GET /departments — soft-deleted employee is NOT counted in any dept', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/departments',
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID },
    });
    const tree = JSON.parse(res.body).data;
    const eng = tree.find(d => d.id === engDeptId);
    // If soft-deleted employee were counted, direct would be 5 and rollup 6
    expect(eng.directEmployeeCount).to.equal(4);
    expect(eng._count.employees).to.equal(5);
  });

  it('GET /departments/:id — Engineering totalHeadcount = 5', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/departments/${engDeptId}`,
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID },
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.totalHeadcount, 'Engineering totalHeadcount').to.equal(5);
  });

  it('GET /departments/:id/employees — Engineering returns 5 employees (all subtree, no deleted)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/departments/${engDeptId}/employees`,
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID },
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.pagination.total, 'Engineering/employees total').to.equal(5);
    const ids = data.data.map(e => e.id);
    expect(ids).to.include(backendEmployeeId, 'Backend employee should appear in Engineering employee list');
    expect(ids).to.not.include(deletedEmployeeId, 'Soft-deleted employee must not appear');
  });

  it('GET /departments/:id/employees — Backend Engineering returns 1 employee only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/departments/${backendDeptId}/employees`,
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID },
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.pagination.total, 'Backend/employees total').to.equal(1);
    expect(data.data[0].id).to.equal(backendEmployeeId);
  });

  it('GET /employees?departmentId=Engineering — returns 5, not 6 (excludes deleted)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/employees?departmentId=${engDeptId}`,
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID },
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.pagination.total, 'employees list with departmentId filter').to.equal(5);
    const ids = data.data.map(e => e.id);
    expect(ids).to.not.include(deletedEmployeeId, 'Soft-deleted must not appear in employee list');
  });

  it('GET /employees?departmentId=BackendEngineering — returns 1', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/employees?departmentId=${backendDeptId}`,
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID },
    });
    expect(res.statusCode).to.equal(200);
    const data = JSON.parse(res.body).data;
    expect(data.pagination.total, 'backend employees list').to.equal(1);
  });

  it('GET /employees list — soft-deleted employee never appears without ?includeTerminated', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/employees',
      headers: { authorization: `Bearer ${adminToken}`, 'x-tenant-key': TENANT_ID },
    });
    const data = JSON.parse(res.body).data;
    const ids = data.data.map(e => e.id);
    expect(ids).to.not.include(deletedEmployeeId);
  });
});
