/**
 * notifyPayslipsPublished — the highest-value notification in the product.
 * Run: node --test --experimental-test-module-mocks tests/notifier-payslip-published.test.js
 *
 * Fires for every employee in a payroll run the moment HR publishes it. Covered
 * here with a stubbed Prisma so it runs in CI with no database: the end-to-end
 * script proves the transport, this proves the fan-out shape and the edge cases
 * that are awkward to stage against real payroll data (an employee with no user
 * account, an empty run).
 */
import { describe, it, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

const TENANT = 'tenant-1';
let created = [];
let payslips = [];
let notifyPayslipsPublished;

before(async () => {
  const prismaStub = {
    payslip: {
      findMany: async () => payslips,
    },
    notification: {
      createMany: async ({ data }) => { created.push(...data); return { count: data.length }; },
      create: async ({ data }) => { created.push(data); return { ...data, createdAt: new Date() }; },
    },
    employee: { findUnique: async () => null },
    user: { findMany: async () => [] },
  };

  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: prismaStub },
    defaultExport: async () => {},
  });

  ({ notifyPayslipsPublished } = await import('../src/utils/notifier.js'));
});

beforeEach(() => { created = []; payslips = []; });

describe('notifyPayslipsPublished', () => {
  it('notifies every employee in the run, once each', async () => {
    payslips = [
      { id: 'ps-1', employee: { userId: 'user-a' } },
      { id: 'ps-2', employee: { userId: 'user-b' } },
      { id: 'ps-3', employee: { userId: 'user-c' } },
    ];

    const result = await notifyPayslipsPublished(TENANT, 'run-1', 'July 2026');

    assert.equal(result.notified, 3);
    assert.equal(created.length, 3);
    assert.deepEqual(created.map((n) => n.userId).sort(), ['user-a', 'user-b', 'user-c']);
  });

  it('carries the payload the UI renders', async () => {
    payslips = [{ id: 'ps-1', employee: { userId: 'user-a' } }];
    await notifyPayslipsPublished(TENANT, 'run-1', 'July 2026');

    const [n] = created;
    assert.equal(n.type, 'payslip_published');
    assert.equal(n.title, 'Payslip Available');
    assert.match(n.message, /July 2026/, 'the period must appear in the message');
    assert.equal(n.tenantId, TENANT);
    // The bell needs to deep-link to the payslip.
    assert.equal(n.metadataJson.payslipId, 'ps-1');
    assert.equal(n.metadataJson.runId, 'run-1');
    assert.ok(n.expiresAt instanceof Date, 'must carry the 12h TTL');
    assert.ok(n.expiresAt.getTime() > Date.now(), 'TTL must be in the future');
  });

  it('skips employees with no linked user account rather than throwing', async () => {
    payslips = [
      { id: 'ps-1', employee: { userId: 'user-a' } },
      { id: 'ps-2', employee: { userId: null } },   // never onboarded
      { id: 'ps-3', employee: null },               // employee row missing
    ];

    const result = await notifyPayslipsPublished(TENANT, 'run-1', 'July 2026');

    assert.equal(result.notified, 1, 'only the employee with a user account');
    assert.deepEqual(created.map((n) => n.userId), ['user-a']);
  });

  it('is a no-op for an empty run — no writes at all', async () => {
    payslips = [];
    const result = await notifyPayslipsPublished(TENANT, 'run-1', 'July 2026');
    assert.equal(result.notified, 0);
    assert.equal(created.length, 0);
  });

  it('gives every notification a distinct id', async () => {
    payslips = Array.from({ length: 25 }, (_, i) => ({
      id: `ps-${i}`, employee: { userId: `user-${i}` },
    }));

    await notifyPayslipsPublished(TENANT, 'run-1', 'July 2026');
    assert.equal(new Set(created.map((n) => n.id)).size, 25, 'ids must not collide');
  });
});
