/**
 * Per-employee routes must confine a caller to their own record.
 *
 * These endpoints are gated by `payroll:self-read` and `performance:read`, keys
 * that EVERY role holds, so the route guard alone lets any employee name any
 * employeeId. Before the fix a plain EMPLOYEE could read another employee's YTD
 * and tax declaration on production, overwrite their tax declaration, list the
 * whole tenant's reimbursement claims, and any MANAGER could calibrate any
 * employee's performance review.
 *
 * Each assertion below fails against the pre-fix service functions.
 *
 * Run: node --test --experimental-test-module-mocks tests/access-scoping.test.js
 */
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

const TENANT = 'tenant-1';
const ME = 'emp-priya';
const SOMEONE_ELSE = 'emp-hr-admin';

const employee = (id, memberType, keys) => ({ sub: `user-${id}`, employeeId: id, memberType, permissions: keys });
const PRIYA = employee(ME, 'EMPLOYEE', ['payroll:self-read', 'timesheets:read']);
const HR = employee('emp-hr', 'HR_ADMIN', ['payroll:self-read', 'employees:read-any', 'performance:manage', 'performance:read']);
const MANAGER = employee('emp-aman', 'MANAGER', ['payroll:self-read', 'performance:read']);

let payroll;
let performance;
const forbidden = { code: 'FORBIDDEN' };

before(async () => {
  process.env.NODE_ENV = 'test';
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: {} },
    defaultExport: async () => {},
  });
  // emp-priya reports to nobody; only emp-mine reports to the manager.
  mock.module('../src/modules/performance/performance.repository.js', {
    namedExports: {
      getEmployeeById: async (_tenantId, id) => ({ id, managerId: id === 'emp-mine' ? MANAGER.employeeId : null }),
      getReviewByEmployeeId: async () => null,
      getEmployeesByIds: async () => [],
      updateReview: async () => ({}),
      createGoal: async () => ({}),
    },
  });
  payroll = await import('../src/modules/payroll/payroll.service.js');
  performance = await import('../src/modules/performance/performance.service.js');
});

describe('payroll: an employee cannot reach another employee by id', () => {
  it('refuses YTD earnings', async () => {
    await assert.rejects(() => payroll.getEmployeeYtd({}, SOMEONE_ELSE, TENANT, '2026-27', PRIYA), forbidden);
  });

  it('refuses the tax declaration', async () => {
    await assert.rejects(() => payroll.getTaxDeclaration({}, SOMEONE_ELSE, TENANT, '2026-27', PRIYA), forbidden);
  });

  it('refuses OVERWRITING the tax declaration', async () => {
    await assert.rejects(
      () => payroll.upsertTaxDeclaration({}, SOMEONE_ELSE, TENANT, { regime: 'IN_OLD_REGIME' }, PRIYA),
      forbidden,
      'the write path reached the database insert before this fix',
    );
  });

  it('refuses filing a reimbursement claim against someone else', async () => {
    await assert.rejects(
      () => payroll.submitReimbursementClaim({}, TENANT, { employeeId: SOMEONE_ELSE, amount: 1 }, PRIYA),
      forbidden,
    );
  });

  it('pins the reimbursement list to the caller instead of the whole tenant', async () => {
    let seen;
    const prisma = {
      $transaction: async () => [[], 0],
      reimbursementClaim: {
        findMany: async ({ where }) => { seen = where; return []; },
        count: async () => 0,
      },
    };
    prisma.$transaction = async (ops) => Promise.all(ops);
    await payroll.listReimbursementClaims(prisma, TENANT, {}, PRIYA);
    assert.equal(seen.employeeId, ME, 'an employee must only ever list their own claims');
  });

  it('still lets an approver see the tenant-wide list', async () => {
    let seen;
    const prisma = {
      $transaction: async (ops) => Promise.all(ops),
      reimbursementClaim: {
        findMany: async ({ where }) => { seen = where; return []; },
        count: async () => 0,
      },
    };
    await payroll.listReimbursementClaims(prisma, TENANT, {}, HR);
    assert.equal(seen.employeeId, undefined);
  });
});

describe('performance: a write is confined to the caller and their reports', () => {
  it('a MANAGER cannot calibrate an employee who does not report to them', async () => {
    await assert.rejects(
      () => performance.updateReview(TENANT, SOMEONE_ELSE, { rating: 'Exceeds' }, MANAGER),
      forbidden,
      "a read key must not authorise writing anyone's review",
    );
  });

  it('a MANAGER can still reach their own direct report', async () => {
    await assert.rejects(
      () => performance.updateReview(TENANT, 'emp-mine', { rating: 'Exceeds' }, MANAGER),
      { code: 'NOT_FOUND' },
      'the team path must get past the scope check',
    );
  });

  it('performance:manage keeps tenant-wide reach', async () => {
    await assert.rejects(
      () => performance.updateReview(TENANT, SOMEONE_ELSE, { rating: 'Exceeds' }, HR),
      { code: 'NOT_FOUND' },
    );
  });

  it('a MANAGER cannot set a goal on someone outside their team', async () => {
    await assert.rejects(
      () => performance.createGoal(TENANT, { employeeId: SOMEONE_ELSE, title: 'x', dueDate: '2026-12-31' }, MANAGER),
      forbidden,
    );
  });

  it('a missing employeeId still reads as a validation error, not a scope error', async () => {
    await assert.rejects(
      () => performance.createGoal(TENANT, { title: 'x', dueDate: '2026-12-31' }, MANAGER),
      { code: 'VALIDATION_ERROR' },
    );
  });
});
