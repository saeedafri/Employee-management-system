// Regression for BE-API-1: GET /audit-logs/export 500.
// Root cause: oldValuesJson/newValuesJson are Prisma `Json?` columns, returned
// already-deserialized as JS objects. The service called JSON.parse() on them,
// so JSON.parse({...}) -> JSON.parse("[object Object]") -> SyntaxError, and one
// non-null row in the 10000-row export threw and 500'd the whole export.
// The fix normalizes both shapes (already-parsed object AND legacy JSON string)
// without ever throwing. Pure oracle, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuditJson } from '../src/modules/auditLogs/auditLogs.service.js';

test('normalizeAuditJson: already-parsed object (Prisma Json column) returned as-is, no throw', () => {
  assert.deepEqual(normalizeAuditJson({ status: 'ACTIVE' }), { status: 'ACTIVE' });
  assert.deepEqual(
    normalizeAuditJson({ lastName: 'Joshi', firstName: 'Sneha' }),
    { lastName: 'Joshi', firstName: 'Sneha' },
  );
});

test('normalizeAuditJson: array returned as-is', () => {
  assert.deepEqual(normalizeAuditJson([1, 2, 3]), [1, 2, 3]);
});

test('normalizeAuditJson: legacy JSON string (double-encoded row) is parsed to object', () => {
  assert.deepEqual(normalizeAuditJson('{"status":"INACTIVE"}'), { status: 'INACTIVE' });
});

test('normalizeAuditJson: null and undefined -> null', () => {
  assert.equal(normalizeAuditJson(null), null);
  assert.equal(normalizeAuditJson(undefined), null);
});

test('normalizeAuditJson: non-JSON string returned as-is (never throws)', () => {
  assert.equal(normalizeAuditJson('plain text value'), 'plain text value');
});
