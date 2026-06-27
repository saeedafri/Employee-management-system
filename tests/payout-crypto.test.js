import test from 'node:test';
import assert from 'node:assert/strict';

// 32-byte key (hex) set BEFORE importing the module-under-test; the key is read lazily.
process.env.PAYOUT_ENC_KEY = '0'.repeat(64);

const { encryptDetails, decryptDetails, maskValue, maskDetails, lastTail } = await import(
  '../src/modules/payroll/payout/payoutCrypto.js'
);

test('encrypt → decrypt round-trips the details object', () => {
  const details = { accountName: 'Priya', accountNumber: '50100123454821', ifsc: 'HDFC0001234' };
  const blob = encryptDetails(details);
  assert.equal(typeof blob, 'string');
  assert.notEqual(blob, JSON.stringify(details)); // not plaintext
  assert.deepEqual(decryptDetails(blob), details);
});

test('ciphertext is non-deterministic (random IV) but both decrypt equal', () => {
  const d = { accountNumber: '50100123454821' };
  const a = encryptDetails(d);
  const b = encryptDetails(d);
  assert.notEqual(a, b);
  assert.deepEqual(decryptDetails(a), decryptDetails(b));
});

test('tampered ciphertext fails GCM auth (throws)', () => {
  const blob = encryptDetails({ accountNumber: '50100123454821' });
  const tampered = blob.slice(0, -2) + (blob.endsWith('AA') ? 'BB' : 'AA');
  assert.throws(() => decryptDetails(tampered));
});

test('maskValue replaces all but the last 4 with X (masked-X round-trip)', () => {
  assert.equal(maskValue('50100123454821'), 'XXXXXXXXXX4821');
  assert.equal(maskValue('1234'), '1234');
  assert.equal(maskValue('12'), '12');
  assert.equal(maskValue(''), '');
});

test('lastTail picks accountNumber → iban → routingNumber', () => {
  assert.equal(lastTail({ accountNumber: '50100123454821' }), '4821');
  assert.equal(lastTail({ iban: 'DE89370400440532013000' }), '3000');
  assert.equal(lastTail({ routingNumber: '021000021' }), '0021');
  assert.equal(lastTail({}), '');
});

test('maskDetails masks only identifier fields, leaves the rest', () => {
  const masked = maskDetails({
    accountName: 'Priya Sharma',
    accountNumber: '50100123454821',
    ifsc: 'HDFC0001234',
    bankName: 'HDFC Bank',
  });
  assert.equal(masked.accountNumber, 'XXXXXXXXXX4821');
  assert.equal(masked.accountName, 'Priya Sharma'); // not an identifier
  assert.equal(masked.ifsc, 'HDFC0001234'); // public branch code, not masked
  assert.equal(masked.bankName, 'HDFC Bank');
});

test('maskDetails masks iban and routingNumber too', () => {
  assert.equal(maskDetails({ iban: 'DE89370400440532013000' }).iban, 'XXXXXXXXXXXXXXXXXX3000');
  assert.equal(maskDetails({ routingNumber: '021000021' }).routingNumber, 'XXXXX0021');
});
