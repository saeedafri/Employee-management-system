import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';

// The Logs screen reads the tenant's LogEntry rows, and nothing used to write them. Every
// 5xx is now persisted under the request's tenant; 4xx and tenant-less requests are not.
const written = [];
let errorHandler;
before(async () => {
  mock.module('../src/plugins/prisma.js', { namedExports: { prisma: {} }, defaultExport: async () => {} });
  mock.module('../src/modules/logs/logs.service.js', {
    namedExports: { createLog: async (...args) => { written.push(args); } },
  });
  ({ errorHandler } = await import('../src/middleware/errorHandler.js'));
});

function fakeRequest(tenantId) {
  return {
    id: 'req-1', method: 'POST', url: '/api/v1/payroll/runs?x=1',
    routeOptions: { url: '/api/v1/payroll/runs' },
    tenant: tenantId ? { id: tenantId } : undefined,
    user: { id: 'u-1' },
    log: { error() {}, warn() {} },
  };
}
const fakeReply = () => ({ code() { return this; }, send() { return this; } });

test('an unhandled error is logged under the tenant with route and status', async () => {
  written.length = 0;
  await errorHandler(new TypeError('boom'), fakeRequest('t-1'), fakeReply());
  assert.equal(written.length, 1);
  const [tenantId, level, , , module, message, requestId, actor, meta] = written[0];
  assert.deepEqual([tenantId, level, module, message, requestId, actor], ['t-1', 'ERROR', 'payroll', 'boom', 'req-1', 'u-1']);
  assert.equal(meta.route, '/api/v1/payroll/runs');
  assert.equal(meta.statusCode, 500);
});

test('client errors and tenant-less requests are not logged', async () => {
  written.length = 0;
  await errorHandler(Object.assign(new Error('nope'), { code: 'NOT_FOUND', statusCode: 404 }), fakeRequest('t-1'), fakeReply());
  await errorHandler(new Error('boom'), fakeRequest(null), fakeReply());
  assert.equal(written.length, 0);
});
