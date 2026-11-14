import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { redact, describe as describeRoute } from '../src/middleware/auditTrail.js';

describe('audit trail', () => {
  it('redacts secrets at any depth and keeps business fields', () => {
    const out = redact({ reason: 'Family function', password: 'x', details: { accountNumber: '123', ifsc: 'HDFC0001', bankName: 'HDFC' } });
    assert.equal(out.reason, 'Family function');
    assert.equal(out.password, '[REDACTED]');
    assert.equal(out.details.accountNumber, '[REDACTED]');
    assert.equal(out.details.ifsc, '[REDACTED]');
    assert.equal(out.details.bankName, 'HDFC');
  });
  it('names the entity and action from the route', () => {
    assert.deepEqual(describeRoute('PATCH', '/api/v1/leave/requests/:id/approve'), { entityType: 'leave', action: 'PATCH leave/requests/:id/approve' });
  });
});
