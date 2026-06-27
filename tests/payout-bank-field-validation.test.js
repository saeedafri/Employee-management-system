import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDetails } from '../src/modules/payroll/payout/bankFieldValidation.js';
import { seedSchemaFor } from '../src/modules/payroll/payout/bankSchemaCatalog.js';
import { GENERIC_FALLBACK_FIELDS } from '../src/modules/payroll/payout/isoCountries.js';

const IN = seedSchemaFor('IN').fields;
const US = seedSchemaFor('US').fields;

test('valid IN details pass', () => {
  const r = validateDetails(IN, {
    accountName: 'Priya Sharma',
    accountNumber: '50100123454821',
    ifsc: 'HDFC0001234',
    bankName: 'HDFC Bank',
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.errors, []);
});

test('missing required field → "<label> is required"', () => {
  const r = validateDetails(IN, { accountName: 'A', accountNumber: '50100123454821' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.find((e) => e.field === 'details.ifsc'), {
    field: 'details.ifsc',
    message: 'IFSC code is required',
  });
});

test('regex failure → "<label> is invalid"', () => {
  const r = validateDetails(IN, {
    accountName: 'A',
    accountNumber: '12', // too short for ^[0-9X]{9,18}$
    ifsc: 'HDFC0001234',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.field === 'details.accountNumber' && e.message === 'Account number is invalid'));
});

test('IN accountNumber tolerates masked X (round-trip read)', () => {
  const r = validateDetails(IN, {
    accountName: 'A',
    accountNumber: 'XXXXXXXXXX4821',
    ifsc: 'HDFC0001234',
  });
  assert.equal(r.ok, true);
});

test('checksum failure (regex passes) → "<label> failed validation"', () => {
  const r = validateDetails(US, {
    accountName: 'A',
    routingNumber: '021000020', // 9 digits (regex ok) but bad ABA checksum
    accountNumber: '0001234567',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.field === 'details.routingNumber' && e.message === 'Routing number failed validation'));
});

test('generic IBAN fallback: bad checksum fails, valid passes', () => {
  const bad = validateDetails(GENERIC_FALLBACK_FIELDS, { accountName: 'A', iban: 'DE89370400440532013001' });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.field === 'details.iban'));
  const good = validateDetails(GENERIC_FALLBACK_FIELDS, { accountName: 'A', iban: 'DE89370400440532013000' });
  assert.equal(good.ok, true);
});

test('optional empty field is allowed; values are trimmed in normalized output', () => {
  const r = validateDetails(IN, {
    accountName: '  Priya  ',
    accountNumber: '50100123454821',
    ifsc: 'HDFC0001234',
    bankName: '', // optional, empty allowed
  });
  assert.equal(r.ok, true);
  assert.equal(r.normalized.accountName, 'Priya');
});

test('unknown keys are rejected (PII / schema-subset guard)', () => {
  const r = validateDetails(IN, {
    accountName: 'A',
    accountNumber: '50100123454821',
    ifsc: 'HDFC0001234',
    evil: 'x',
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.field === 'details.evil'));
});

test('maxLength is enforced with the FE message', () => {
  const fields = [{ key: 'note', label: 'Note', type: 'text', required: true, maxLength: 3 }];
  const r = validateDetails(fields, { note: 'abcd' });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].message, 'Note must be at most 3 characters');
});
