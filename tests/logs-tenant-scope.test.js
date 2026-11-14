import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';

// The logs controller destructured `tenantId` from request.tenant, which only has `id`, so
// every query ran with tenantId undefined — Prisma drops undefined filters — and returned
// every tenant's logs. Every read must be scoped to the caller's tenant.
const wheres = [];
const logEntry = {
  findMany: async ({ where }) => { wheres.push(where); return []; },
  findFirst: async ({ where }) => { wheres.push(where); return null; },
  count: async ({ where }) => { wheres.push(where); return 0; },
};
let controller;
before(async () => {
  mock.module('../src/plugins/prisma.js', { namedExports: { prisma: { logEntry } }, defaultExport: async () => {} });
  controller = await import('../src/modules/logs/logs.controller.js');
});

const reply = () => ({
  code() { return this; }, send() { return this; }, type() { return this; }, header() { return this; },
  write() {}, end() {}, raw: { write() {}, end() {} },
});

test('list, get, export and stream all filter by the caller tenant', async () => {
  const req = (extra = {}) => ({ tenant: { id: 't-1' }, query: {}, params: { id: 'log-1' }, user: { id: 'u-1' }, log: { error() {} }, ...extra });
  await controller.listLogs(req(), reply());
  await controller.getLog(req(), reply());
  await controller.exportLogs(req({ query: { format: 'json' } }), reply());
  await controller.streamLogs(req(), reply());
  assert.ok(wheres.length >= 4, `expected queries, got ${wheres.length}`);
  for (const where of wheres) assert.equal(where.tenantId, 't-1', JSON.stringify(where));
});
