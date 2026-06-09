/** Flat statutory pack API ↔ DB packData nesting (newreqphase3 F.3). */

/** Contract: statutoryComponents is always string[] on read; legacy { code } objects accepted on write. */
export function normalizeStatutoryComponents(value = []) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : item?.code))
    .filter(Boolean);
}

function normalizePackDataStatutoryComponents(packData = {}) {
  if (!packData || typeof packData !== 'object') return packData;
  return {
    ...packData,
    statutoryComponents: normalizeStatutoryComponents(packData.statutoryComponents),
  };
}

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
  return normalizePackDataStatutoryComponents(packData);
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
    statutoryComponents: normalizeStatutoryComponents(data.statutoryComponents),
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
