/**
 * BE-10(b) — the audit CSV export is capped at 10,000 rows. On a tenant with
 * 501,538 rows that is 2% of the data, so the response has to SAY it truncated.
 *
 * This exists because the first fix got it wrong in a way that looked right:
 * it read `data.pagination.total`, but getAuditLogs returns a flat `total`, so
 * it silently fell back to `logs.length` and reported total=10000,
 * truncated=false on a 501k table. Live verification caught it; this pins it.
 *
 * Run: node --test --experimental-test-module-mocks tests/audit-export-truncation.test.js
 */
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';

const CAP = 10000;
let exportAuditLogs;

before(async () => {
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: {} },
    defaultExport: async () => {},
  });
  mock.module('../src/modules/auditLogs/auditLogs.service.js', {
    namedExports: {
      // Mirrors the real shape: a flat `total` that is a genuine COUNT, plus at
      // most `limit` rows.
      getAuditLogs: async (_tenantId, _page, limit) => ({
        logs: Array.from({ length: Math.min(limit, 501538) }, (_, index) => ({
          id: `log-${index}`,
          user_email: 'priya@acme.test',
          action: 'UPDATE',
          entity_type: 'Employee',
          entity_id: 'emp-1',
          created_at: new Date('2026-08-13T11:00:00Z'),
        })),
        total: 501538,
      }),
    },
  });
  ({ exportAuditLogs } = await import('../src/modules/auditLogs/auditLogs.controller.js'));
});

function exportAs(format) {
  const headers = {};
  const request = {
    tenant: { id: 't1' },
    query: { format },
    id: 'req-1',
    log: { error: () => {} },
    user: { memberType: 'HR_ADMIN', permissions: ['audit:export'] },
  };
  let body;
  const reply = {
    header: (name, value) => { headers[name.toLowerCase()] = value; return reply; },
    code: () => reply,
    status: () => reply,
    send: (payload) => { body = payload; return reply; },
  };
  return exportAuditLogs(request, reply).then(() => ({ headers, body }));
}

describe('audit export truncation signalling', () => {
  it('reports the real row count, not the number returned', async () => {
    const { headers } = await exportAs('csv');
    assert.equal(headers['x-export-total'], '501538', 'must be the COUNT, not logs.length');
    assert.equal(headers['x-export-returned'], String(CAP));
    assert.equal(headers['x-export-truncated'], 'true');
  });

  it('sets the csv content type and a dated filename', async () => {
    const { headers } = await exportAs('csv');
    assert.equal(headers['content-type'], 'text/csv; charset=utf-8');
    assert.match(headers['content-disposition'], /^attachment; filename="audit-logs-\d{4}-\d{2}-\d{2}\.csv"$/);
  });

  it('signals on the json export too', async () => {
    const { headers } = await exportAs('json');
    assert.equal(headers['x-export-truncated'], 'true');
    assert.equal(headers['content-type'], 'application/json');
  });
});
