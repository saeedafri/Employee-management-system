/**
 * BE-9(a) — a MANAGER could list 26 team members via /manager/team and open
 * none of them: `employees:read-any` is HR/SA-only, so GET /employees/<member>
 * returned 403 "Cannot view other employee data". The team screen was a dead end.
 *
 * A manager may now open a direct report's profile. Anyone else's still 403s,
 * and the check is deliberately NOT in canAccessEmployeeRecord, which also
 * guards payslips, documents and tax forms.
 *
 * Run: node --test --experimental-test-module-mocks tests/employee-profile-team-access.test.js
 */
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../src/modules/auth/permissionCatalogue.js';

const EMPLOYEES = [
  { id: 'emp-mgr', managerId: null },
  { id: 'emp-report', managerId: 'emp-mgr' },
  { id: 'emp-stranger', managerId: 'emp-other' },
];

const prismaStub = {
  employee: {
    findFirst: async ({ where }) => EMPLOYEES.find(
      (employee) => employee.id === where.id && employee.managerId === where.managerId,
    ) ?? null,
    findUnique: async ({ where }) => EMPLOYEES.find((employee) => employee.id === where.id) ?? null,
    findMany: async () => [],
  },
};

let getEmployee;

before(async () => {
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: prismaStub },
    defaultExport: async () => {},
  });
  mock.module('../src/modules/employees/employees.service.js', {
    namedExports: {
      isDirectReport: async (_tenantId, managerId, employeeId) => EMPLOYEES.some(
        (employee) => employee.id === employeeId && employee.managerId === managerId,
      ),
      getEmployee: async (id) => ({ success: true, data: { id } }),
    },
  });
  ({ getEmployee } = await import('../src/modules/employees/employees.controller.js'));
});

function callAs(memberType, employeeId, targetId) {
  let status = 200;
  const request = {
    tenant: { id: 't1' },
    params: { id: targetId },
    query: {},
    id: 'req-1',
    log: { error: () => {} },
    user: { memberType, employeeId, permissions: [...DEFAULT_PERMISSIONS_BY_ROLE[memberType]] },
  };
  const reply = {
    code: (value) => { status = value; return reply; },
    send: () => reply,
  };
  return getEmployee(request, reply).then(() => status);
}

describe('GET /employees/:id — manager access to direct reports', () => {
  it('a manager may open their own direct report', async () => {
    assert.equal(await callAs('MANAGER', 'emp-mgr', 'emp-report'), 200);
  });

  it('a manager may still not open someone else\'s report', async () => {
    assert.equal(await callAs('MANAGER', 'emp-mgr', 'emp-stranger'), 403);
  });

  it('an employee may open only their own record', async () => {
    assert.equal(await callAs('EMPLOYEE', 'emp-report', 'emp-report'), 200);
    assert.equal(await callAs('EMPLOYEE', 'emp-report', 'emp-stranger'), 403);
  });

  it('HR_ADMIN (employees:read-any) may open anyone', async () => {
    assert.equal(await callAs('HR_ADMIN', null, 'emp-stranger'), 200);
  });
});
