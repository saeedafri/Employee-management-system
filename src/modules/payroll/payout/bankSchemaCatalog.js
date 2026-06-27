// Built-in per-country bank-field seed catalog (8 countries + DE/SEPA). Ported
// VERBATIM from the FE seed (ems-frontend/.../country-bank-schemas.seed.ts). This is
// the in-code default layer beneath the editable tenant CountryBankSchema catalog.
/** Fixed stamp for seeded rows — deterministic, never `Date.now()`. */
export const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

/** Shared SEPA / IBAN fields. DE is the catalog representative; other Eurozone
 *  members resolve the byte-identical generic fallback. */
export const SEPA_FIELDS = [
  { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
  {
    key: 'iban',
    label: 'IBAN',
    type: 'text',
    required: true,
    regex: '^[A-Z]{2}[0-9A-Z]{13,32}$',
    checksumType: 'IBAN',
    example: 'DE89370400440532013000',
  },
  { key: 'bic', label: 'BIC / SWIFT', type: 'text', required: false, example: 'DEUTDEFF' },
];

export const COUNTRY_BANK_SCHEMA_SEED = [
  // India
  {
    country: 'IN',
    currency: 'INR',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      {
        key: 'accountNumber',
        label: 'Account number',
        type: 'text',
        required: true,
        regex: '^[0-9X]{9,18}$',
        example: '1234567890',
      },
      {
        key: 'ifsc',
        label: 'IFSC code',
        type: 'text',
        required: true,
        regex: '^[A-Z]{4}0[A-Z0-9]{6}$',
        example: 'HDFC0001234',
      },
      { key: 'bankName', label: 'Bank name', type: 'text', required: false, example: 'HDFC Bank' },
    ],
  },
  // United States
  {
    country: 'US',
    currency: 'USD',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      {
        key: 'routingNumber',
        label: 'Routing number',
        type: 'text',
        required: true,
        regex: '^[0-9]{9}$',
        checksumType: 'ABA_ROUTING',
        example: '021000021',
      },
      {
        key: 'accountNumber',
        label: 'Account number',
        type: 'text',
        required: true,
        regex: '^[0-9X]{4,17}$',
        example: '0001234567',
      },
      {
        key: 'accountType',
        label: 'Account type',
        type: 'text',
        required: false,
        example: 'CHECKING / SAVINGS',
      },
    ],
  },
  // United Kingdom
  {
    country: 'GB',
    currency: 'GBP',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      {
        key: 'sortCode',
        label: 'Sort code',
        type: 'text',
        required: true,
        regex: '^[0-9]{2}-?[0-9]{2}-?[0-9]{2}$',
        example: '12-34-56',
      },
      {
        key: 'accountNumber',
        label: 'Account number',
        type: 'text',
        required: true,
        regex: '^[0-9]{8}$',
        example: '12345678',
      },
    ],
  },
  // Germany — SEPA representative
  { country: 'DE', currency: 'EUR', fields: SEPA_FIELDS },
  // Canada
  {
    country: 'CA',
    currency: 'CAD',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      {
        key: 'institutionNumber',
        label: 'Institution number',
        type: 'text',
        required: true,
        regex: '^[0-9]{3}$',
        example: '001',
        helpText: '3-digit bank identifier (e.g. 001 = BMO).',
      },
      {
        key: 'transitNumber',
        label: 'Transit (branch) number',
        type: 'text',
        required: true,
        regex: '^[0-9]{5}$',
        example: '12345',
      },
      {
        key: 'accountNumber',
        label: 'Account number',
        type: 'text',
        required: true,
        regex: '^[0-9]{7,12}$',
        example: '1234567',
      },
    ],
  },
  // Singapore
  {
    country: 'SG',
    currency: 'SGD',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      {
        key: 'bankCode',
        label: 'Bank code',
        type: 'text',
        required: true,
        regex: '^[0-9]{4}$',
        example: '7171',
        helpText: '4-digit bank code (e.g. 7171 = DBS).',
      },
      {
        key: 'branchCode',
        label: 'Branch code',
        type: 'text',
        required: false,
        regex: '^[0-9]{3}$',
        example: '081',
        helpText: 'Some banks embed the branch in the account number.',
      },
      {
        key: 'accountNumber',
        label: 'Account number',
        type: 'text',
        required: true,
        regex: '^[0-9]{6,12}$',
        example: '123456789',
      },
    ],
  },
  // Australia
  {
    country: 'AU',
    currency: 'AUD',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      {
        key: 'bsb',
        label: 'BSB',
        type: 'text',
        required: true,
        regex: '^[0-9]{3}-?[0-9]{3}$',
        example: '062-000',
        helpText: 'Bank-State-Branch code.',
      },
      {
        key: 'accountNumber',
        label: 'Account number',
        type: 'text',
        required: true,
        regex: '^[0-9]{5,9}$',
        example: '12345678',
      },
    ],
  },
  // Saudi Arabia — IBAN, tightened to 24 chars
  {
    country: 'SA',
    currency: 'SAR',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      {
        key: 'iban',
        label: 'IBAN',
        type: 'text',
        required: true,
        regex: '^SA[0-9]{2}[0-9A-Z]{20}$',
        checksumType: 'IBAN',
        example: 'SA0380000000608010167519',
      },
      { key: 'bic', label: 'BIC / SWIFT', type: 'text', required: false },
    ],
  },
  // United Arab Emirates — IBAN, tightened to 23 chars
  {
    country: 'AE',
    currency: 'AED',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      {
        key: 'iban',
        label: 'IBAN',
        type: 'text',
        required: true,
        regex: '^AE[0-9]{21}$',
        checksumType: 'IBAN',
        example: 'AE070331234567890123456',
      },
      { key: 'bic', label: 'BIC / SWIFT', type: 'text', required: false },
    ],
  },
];

const SEED_BY_CODE = new Map(COUNTRY_BANK_SCHEMA_SEED.map((s) => [s.country, s]));

/** Seed schema row for a country (uppercased), or undefined. */
export function seedSchemaFor(country) {
  return SEED_BY_CODE.get(String(country ?? '').toUpperCase());
}
