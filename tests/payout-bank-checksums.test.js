import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidIban, isValidAbaRouting } from '../src/modules/payroll/payout/bankChecksums.js';

// ── IBAN (ISO-13616 mod-97) — transcribed from FE bank-checksums.ts ────────────
test('isValidIban accepts canonical valid IBANs', () => {
  assert.equal(isValidIban('DE89370400440532013000'), true);
  assert.equal(isValidIban('GB82WEST12345698765432'), true);
  assert.equal(isValidIban('SA0380000000608010167519'), true);
});

test('isValidIban rejects a bad checksum', () => {
  assert.equal(isValidIban('DE89370400440532013001'), false);
});

test('isValidIban tolerates whitespace and lowercase', () => {
  assert.equal(isValidIban('de89 3704 0044 0532 0130 00'), true);
});

test('isValidIban rejects too-short / malformed', () => {
  assert.equal(isValidIban(''), false);
  assert.equal(isValidIban('DE89'), false);
  assert.equal(isValidIban('!!notaniban!!'), false);
});

// ── ABA routing (weights 3,7,1 repeating, sum % 10 === 0) ──────────────────────
test('isValidAbaRouting accepts a valid 9-digit routing number', () => {
  assert.equal(isValidAbaRouting('021000021'), true);
  assert.equal(isValidAbaRouting('011401533'), true);
});

test('isValidAbaRouting rejects a bad checksum', () => {
  assert.equal(isValidAbaRouting('021000020'), false);
});

test('isValidAbaRouting rejects wrong length', () => {
  assert.equal(isValidAbaRouting('12345'), false);
  assert.equal(isValidAbaRouting('0210000210'), false);
});

test('isValidAbaRouting strips non-digits before checking', () => {
  assert.equal(isValidAbaRouting('0210-0002-1'), true);
});
