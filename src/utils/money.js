// Currency-decimal-aware money helpers. Sets ported verbatim from
// ems-frontend/src/modules/payroll/utils/money.utils.ts. Multi-country is DATA:
// rounding precision comes from the currency's ISO 4217 minor-unit digits, never a
// hardcoded 2-decimal assumption.

const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF',
  'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

// ISO 4217 currencies with 3 minor-unit digits.
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** Number of minor-unit digits for a currency (defaults to 2). */
export function currencyDecimals(currency) {
  const c = (currency || '').toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(c)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(c)) return 3;
  return 2;
}

/**
 * Round a major-unit amount to its currency's minor-unit precision.
 * roundMoney(1234.5678,'INR') === 1234.57; ('KWD') === 1234.568; ('JPY') === 1235.
 * For INR/USD (2dp) this is identical to the legacy Math.round(x*100)/100.
 * The +Number.EPSILON nudge keeps half-up rounding stable against float artefacts
 * (e.g. 2.005 → 2.01), matching the legacy behaviour for 2dp.
 */
export function roundMoney(amount, currency) {
  const factor = 10 ** currencyDecimals(currency);
  const n = Number(amount) || 0;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}
