// Per-field validation for a payout method's `details`, driven entirely by the
// country bank-schema `fields[]` (config-over-code — no country branching). Messages
// are transcribed from the FE buildDetailsSchema (bank-field-schema.ts) so a 422's
// `details[]` maps cleanly back onto the same form inputs:
//   required → "<label> is required" · regex → "<label> is invalid"
//   maxLength → "<label> must be at most N characters" · checksum → "<label> failed validation"
import { isValidIban, isValidAbaRouting } from './bankChecksums.js';

/** The ONLY code touch-point for structural checksums. Extend by adding an entry. */
export const CHECKSUM_VALIDATORS = {
  IBAN: isValidIban,
  ABA_ROUTING: isValidAbaRouting,
  NONE: () => true,
};

/**
 * Validate `details` against a country schema's `fields`.
 * @returns {{ ok: boolean, errors: {field:string,message:string}[], normalized: Record<string,string> }}
 *   `normalized` holds the trimmed non-empty values to persist.
 */
export function validateDetails(fields, details) {
  const errors = [];
  const normalized = {};
  const input = details && typeof details === 'object' ? details : {};
  const allowed = new Set((fields || []).map((f) => f.key));

  // PII / schema-subset guard (§11): reject keys not declared by the country schema.
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) errors.push({ field: `details.${key}`, message: 'Unknown field' });
  }

  for (const f of fields || []) {
    const raw = input[f.key];
    const v = (raw == null ? '' : String(raw)).trim();
    if (v !== '') normalized[f.key] = v;

    if (v === '') {
      if (f.required) errors.push({ field: `details.${f.key}`, message: `${f.label} is required` });
      continue; // optional-empty (or already-flagged required) — skip structural checks (FE `!v ||`)
    }
    if (f.maxLength && v.length > f.maxLength) {
      errors.push({ field: `details.${f.key}`, message: `${f.label} must be at most ${f.maxLength} characters` });
      continue;
    }
    if (f.regex && !new RegExp(f.regex).test(v)) {
      errors.push({ field: `details.${f.key}`, message: `${f.label} is invalid` });
      continue;
    }
    const checksum = CHECKSUM_VALIDATORS[f.checksumType ?? 'NONE'] ?? CHECKSUM_VALIDATORS.NONE;
    if (checksum !== CHECKSUM_VALIDATORS.NONE && !checksum(v)) {
      errors.push({ field: `details.${f.key}`, message: `${f.label} failed validation` });
    }
  }

  return { ok: errors.length === 0, errors, normalized };
}
