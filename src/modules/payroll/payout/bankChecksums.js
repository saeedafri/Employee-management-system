// Structural bank-identifier checksums — transcribed VERBATIM from the FE source of
// truth (ems-frontend/src/modules/payroll/utils/bank-checksums.ts) so backend
// validation and the FE/MSW fallback agree byte-for-byte.

/** ISO-13616 IBAN validation via the mod-97 algorithm. */
export function isValidIban(value) {
  const iban = String(value ?? '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z0-9]{15,34}$/.test(iban)) return false;
  // Move the first 4 chars to the end.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  // Convert letters to numbers: A=10 … Z=35.
  const expanded = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  // Piecewise mod-97 to avoid BigInt/precision issues.
  let remainder = 0;
  for (const ch of expanded) {
    remainder = (remainder * 10 + Number(ch)) % 97;
  }
  return remainder === 1;
}

/** US ABA routing number checksum: weights 3,7,1 repeating, sum % 10 === 0. */
export function isValidAbaRouting(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 9) return false;
  const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1];
  const sum = digits.split('').reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
  return sum % 10 === 0;
}
