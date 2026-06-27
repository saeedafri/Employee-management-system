// Encryption-at-rest + masking for payout bank identifiers (§11, non-negotiable).
// - Full `details` JSON is AES-256-GCM encrypted into `PayoutMethod.detailsEnc`.
// - The full value is NEVER logged; non-owner reads and ALL list responses are masked.
// - `maskValue` replaces all but the last 4 with 'X' — which is exactly why the IN
//   accountNumber regex tolerates X on round-trip reads (^[0-9X]{9,18}$).
import crypto from 'crypto';

const BLOB_PREFIX = 'v1';
// Identifier fields that must be masked on the wire (account number, IBAN, routing).
const IDENTIFIER_KEYS = ['accountNumber', 'iban', 'routingNumber'];

function getKey() {
  const raw = process.env.PAYOUT_ENC_KEY || '';
  if (!raw) {
    throw new Error('PAYOUT_ENC_KEY is not set — required to encrypt payout bank details at rest');
  }
  // Accept 64-char hex or base64; must decode to exactly 32 bytes.
  let key;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) key = Buffer.from(raw, 'hex');
  else key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('PAYOUT_ENC_KEY must be 32 bytes (64 hex chars or base64-encoded 32 bytes)');
  }
  return key;
}

/** AES-256-GCM encrypt the details object → "v1:ivB64:tagB64:ctB64". */
export function encryptDetails(details) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(details ?? {}), 'utf8');
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [BLOB_PREFIX, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/** Decrypt a "v1:iv:tag:ct" blob back to the details object. Throws on tamper/auth failure. */
export function decryptDetails(blob) {
  const key = getKey();
  const parts = String(blob ?? '').split(':');
  if (parts.length !== 4 || parts[0] !== BLOB_PREFIX) {
    throw new Error('Malformed payout details ciphertext');
  }
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ct = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString('utf8'));
}

/** Replace all but the last 4 characters with 'X'. */
export function maskValue(value) {
  const v = String(value ?? '');
  if (v.length <= 4) return v;
  return 'X'.repeat(v.length - 4) + v.slice(-4);
}

/** Last-4 of the primary identifier: accountNumber → iban → routingNumber (FE lastTail). */
export function lastTail(details) {
  const id = (details && (details.accountNumber ?? details.iban ?? details.routingNumber)) || '';
  return String(id).slice(-4);
}

/** Mask the identifier fields of a details object; leave non-identifier fields intact. */
export function maskDetails(details) {
  const out = { ...(details || {}) };
  for (const k of IDENTIFIER_KEYS) {
    if (out[k] != null && out[k] !== '') out[k] = maskValue(out[k]);
  }
  return out;
}
