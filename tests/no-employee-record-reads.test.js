/**
 * BE-9(b) — SUPER_ADMIN has no linked Employee, so GET /attendance/today and
 * GET /employee/dashboard returned 400 NO_EMPLOYEE_RECORD. The Hostinger
 * changelog claimed graceful no-employee-record reads; that was true for
 * /attendance/summary|records|calendar and not for these.
 *
 * Contract chosen: personal READS return 200 with `noEmployeeRecord: true`.
 * WRITES (check-in / check-out) keep 400 — there is nothing to write against.
 *
 * Run: node --test --experimental-test-module-mocks tests/no-employee-record-reads.test.js
 */
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

let handlers;

before(async () => {
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: {} },
    defaultExport: async () => {},
  });
  mock.module('../src/modules/dashboard/employee.service.js', {
    namedExports: {
      getEmployeeDashboard: async () => ({ success: true, data: {} }),
      getEmployeeToday: async () => ({ success: true, data: {} }),
      checkIn: async () => ({ success: true, data: {} }),
      checkOut: async () => ({ success: true, data: {} }),
      getLeaveBalance: async () => ({ success: true, data: {} }),
      getHolidays: async () => ({ success: true, data: {} }),
      getDocuments: async () => ({ success: true, data: {} }),
      getEmployeeTeam: async () => ({ success: true, data: {} }),
    },
  });
  handlers = await import('../src/modules/dashboard/employee.controller.js');
});

/** A SUPER_ADMIN token: authenticated, but no employeeId. */
function callWithoutEmployeeRecord(handlerName) {
  let status;
  let body;
  const request = {
    tenant: { id: 't1', timezone: 'UTC' },
    user: { memberType: 'SUPER_ADMIN', employeeId: null },
    requestId: 'req-1',
    params: {},
    query: {},
  };
  const reply = {
    code: (value) => { status = value; return reply; },
    send: (payload) => { body = payload; return reply; },
  };
  return handlers[handlerName](request, reply).then(() => ({ status, body }));
}

describe('personal reads without an employee record', () => {
  for (const handler of [
    'employeeDashboardHandler', 'getTodayHandler', 'getBalanceHandler',
    'getDocumentsHandler', 'getTeamHandler',
  ]) {
    it(`${handler} returns 200 with noEmployeeRecord`, async () => {
      const { status, body } = await callWithoutEmployeeRecord(handler);
      assert.equal(status, 200, `${handler} must not 400`);
      assert.equal(body.data.noEmployeeRecord, true);
    });
  }
});

describe('personal writes without an employee record', () => {
  for (const handler of ['checkInHandler', 'checkOutHandler']) {
    it(`${handler} still refuses with 400 NO_EMPLOYEE_RECORD`, async () => {
      const { status, body } = await callWithoutEmployeeRecord(handler);
      assert.equal(status, 400);
      assert.equal(body.error.code, 'NO_EMPLOYEE_RECORD');
    });
  }
});
