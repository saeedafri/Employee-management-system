/** Salary component API ↔ DB helpers (Phase 3 contract). */

export function parsePayInPeriods(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => !Number.isNaN(n));
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(Number).filter((n) => !Number.isNaN(n)) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function serializePayInPeriods(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return JSON.stringify(value.map(Number).filter((n) => !Number.isNaN(n)));
  return null;
}

export function normalizeCostCenterRule(value) {
  if (value == null || value === '') return 'NONE';
  return value === 'DEPARTMENT' ? 'DEPARTMENT' : 'NONE';
}

export function fmtComponentStatutoryFields(c) {
  return {
    statutoryTag: c.statutoryTag ?? null,
    prorate: c.prorate ?? true,
    payInPeriods: parsePayInPeriods(c.payInPeriods),
    glAccountCode: c.glAccountCode ?? null,
    costCenterRule: normalizeCostCenterRule(c.costCenterRule),
  };
}
