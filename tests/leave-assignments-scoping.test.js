/**
 * BE-2 — `GET /leave/assignments` was `authenticate`-only and unscoped, so any
 * employee read all 138 assignment rows across 75 employees. Assignments are
 * per-employee policy data: self by default, own reports for `leave:team-read`,
 * whole tenant only for `leave:policy-manage`.
 *
 * Run: node --test --experimental-test-module-mocks tests/leave-assignments-scoping.test.js
 */
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../src/modules/auth/permissionCatalogue.js';

const TENANT = { id: 'tenant-1' };

// Three employees: emp-mgr manages emp-a; emp-b reports to someone else.
const ASSIGNMENTS = [
  { id: 'a1', tenantId: TENANT.id, employeeId: 'emp-mgr', policyId: 'p', policyVersion: '1', assignedAt: new Date() },
  { id: 'a2', tenantId: TENANT.id, employeeId: 'emp-a', policyId: 'p', policyVersion: '1', assignedAt: new Date() },
  { id: 'a3', tenantId: TENANT.id, employeeId: 'emp-b', policyId: 'p', policyVersion: '1', assignedAt: new Date() },
];

const EMPLOYEES = [
  { id: 'emp-mgr', managerId: null },
  { id: 'emp-a', managerId: 'emp-mgr' },
  { id: 'emp-b', managerId: 'emp-other' },
];

function matches(row, where) {
  if (where.employeeId === undefined) return true;
  if (typeof where.employeeId === 'string') return row.employeeId === where.employeeId;
  if (where.employeeId?.in) return where.employeeId.in.includes(row.employeeId);
  return true;
}

const prismaStub = {
  leaveAssignment: {
    findMany: async ({ where }) => ASSIGNMENTS.filter((row) => matches(row, where)),
  },
  employee: {
    findMany: async ({ where }) => EMPLOYEES
      .filter((employee) => employee.managerId === where.managerId)
      .map((employee) => ({ id: employee.id })),
    findFirst: async () => null,
  },
};

let getAssignments;

before(async () => {
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: prismaStub },
    defaultExport: async () => {},
  });
  ({ getAssignments } = await import('../src/modules/leave/leaveEngine.controller.js'));
});

function callAs(memberType, employeeId, query = {}) {
  let captured;
  const request = {
    tenant: TENANT,
    query,
    log: { error: () => {} },
    user: { memberType, employeeId, permissions: [...DEFAULT_PERMISSIONS_BY_ROLE[memberType]] },
  };
  const reply = {
    send: (payload) => { captured = payload; return reply; },
    code: () => reply,
    status: () => reply,
  };
  return getAssignments(request, reply).then(() => captured.data.assignments.map((a) => a.employeeId));
}

describe('GET /leave/assignments is caller-scoped', () => {
  it('EMPLOYEE sees only their own row', async () => {
    assert.deepEqual(await callAs('EMPLOYEE', 'emp-a'), ['emp-a']);
  });

  it('MANAGER sees themselves plus their direct reports, not the whole tenant', async () => {
    const seen = (await callAs('MANAGER', 'emp-mgr')).sort();
    assert.deepEqual(seen, ['emp-a', 'emp-mgr']);
    assert.ok(!seen.includes('emp-b'), 'someone else\'s report must not be visible');
  });

  it('HR_ADMIN (leave:policy-manage) still sees every row', async () => {
    assert.equal((await callAs('HR_ADMIN', null)).length, ASSIGNMENTS.length);
  });

  it('?employeeId= cannot widen the scope past what the caller may see', async () => {
    assert.deepEqual(await callAs('EMPLOYEE', 'emp-a', { employeeId: 'emp-b' }), []);
    assert.deepEqual(await callAs('MANAGER', 'emp-mgr', { employeeId: 'emp-b' }), []);
  });

  it('?employeeId= still works inside the caller\'s scope', async () => {
    assert.deepEqual(await callAs('MANAGER', 'emp-mgr', { employeeId: 'emp-a' }), ['emp-a']);
    assert.deepEqual(await callAs('HR_ADMIN', null, { employeeId: 'emp-b' }), ['emp-b']);
  });
});
