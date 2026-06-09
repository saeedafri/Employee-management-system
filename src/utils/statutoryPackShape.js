/** Flat statutory pack API ↔ DB packData nesting (newreqphase3 F.3). */

export const PACK_NESTED_KEYS = [
  'rounding',
  'proration',
  'taxRegimes',
  'contributionSchemes',
  'localTaxes',
  'statutoryComponents',
  'minimumWages',
  'gratuity',
];

export function flatBodyToPackData(body = {}) {
  const packData = body.packData && typeof body.packData === 'object' ? { ...body.packData } : {};
  for (const key of PACK_NESTED_KEYS) {
    if (body[key] !== undefined) packData[key] = body[key];
  }
  return packData;
}

export function fmtStatutoryPackRow(row) {
  if (!row) return null;
  const data = row.packData || {};
  return {
    id: row.id,
    country: row.country,
    version: row.version,
    effectiveFrom: row.effectiveFrom ? row.effectiveFrom.toISOString().slice(0, 10) : null,
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString().slice(0, 10) : null,
    rounding: data.rounding ?? null,
    proration: data.proration ?? null,
    taxRegimes: data.taxRegimes ?? [],
    contributionSchemes: data.contributionSchemes ?? [],
    localTaxes: data.localTaxes ?? [],
    statutoryComponents: data.statutoryComponents ?? [],
    minimumWages: data.minimumWages ?? [],
    gratuity: data.gratuity ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mergePackUpdate(existingRow, body) {
  const current = existingRow.packData || {};
  const merged = flatBodyToPackData({ ...current, ...body, packData: { ...current, ...(body.packData || {}) } });
  return {
    country: body.country ?? existingRow.country,
    version: body.version ?? existingRow.version,
    effectiveFrom: body.effectiveFrom !== undefined ? body.effectiveFrom : existingRow.effectiveFrom,
    effectiveTo: body.effectiveTo !== undefined ? body.effectiveTo : existingRow.effectiveTo,
    packData: merged,
  };
}
