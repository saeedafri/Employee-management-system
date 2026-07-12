// BE-SEC-2/3/4: approver/actor authorization. A MANAGER may act only on direct
// reports; HR/SA on anyone; nobody on their own request. Pure — fake prisma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertCanApprove, assertCanViewEmployee } from '../src/utils/approvalGuard.js';

const fakePrisma = (managerId) => ({
  employee: { findFirst: async () => (managerId === undefined ? null : { managerId }) },
});

test('approve: HR/SA can decide anyone', async () => {
  await assertCanApprove(fakePrisma('x'), 't', { memberType: 'HR_ADMIN', employeeId: 'hr' }, 'emp1');
  await assertCanApprove(fakePrisma('x'), 't', { memberType: 'SUPER_ADMIN' }, 'emp1');
});

test('approve: manager can decide a direct report', async () => {
  await assertCanApprove(fakePrisma('mgr1'), 't', { memberType: 'MANAGER', employeeId: 'mgr1' }, 'emp1');
});

test('approve: manager CANNOT decide a non-report', async () => {
  await assert.rejects(
    () => assertCanApprove(fakePrisma('otherMgr'), 't', { memberType: 'MANAGER', employeeId: 'mgr1' }, 'emp1'),
    /NOT_TEAM_APPROVER|direct reports/,
  );
});

test('approve: no self-approval', async () => {
  await assert.rejects(
    () => assertCanApprove(fakePrisma('mgr1'), 't', { memberType: 'MANAGER', employeeId: 'emp1' }, 'emp1'),
    /You cannot approve or reject your own/,
  );
});

test('approve: actor without an employee record is blocked', async () => {
  await assert.rejects(
    () => assertCanApprove(fakePrisma('m'), 't', { memberType: 'MANAGER' }, 'emp1'),
    (e) => e.code === 'NO_EMPLOYEE_RECORD' && e.statusCode === 403,
  );
});

test('view: self is allowed', async () => {
  await assertCanViewEmployee(fakePrisma('x'), 't', { memberType: 'EMPLOYEE', employeeId: 'emp1' }, 'emp1');
});

test('view: manager of a report allowed; non-report blocked', async () => {
  await assertCanViewEmployee(fakePrisma('mgr1'), 't', { memberType: 'MANAGER', employeeId: 'mgr1' }, 'emp1');
  await assert.rejects(
    () => assertCanViewEmployee(fakePrisma('other'), 't', { memberType: 'MANAGER', employeeId: 'mgr1' }, 'emp1'),
    (e) => e.code === 'FORBIDDEN' && e.statusCode === 403,
  );
});

test('view: a plain employee cannot view another employee', async () => {
  await assert.rejects(
    () => assertCanViewEmployee(fakePrisma('x'), 't', { memberType: 'EMPLOYEE', employeeId: 'emp2' }, 'emp1'),
    (e) => e.code === 'FORBIDDEN' && e.statusCode === 403,
  );
});
