// Pure, DB-free helpers behind the 2026-06-14 timesheets backend bug fixes
// (see docs/backendtimesheetbug.md). Extracted so the derivation logic can be
// unit-tested without a database (tests/timesheets-derivations.test.js).

// Round to 2 decimal places (hours-safe).
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Bug #1 — overtimeHours is DERIVED, never stored: per week max(0, totalHours -
// standardHours), summed over every in-scope timesheet. Always a finite number
// (0 when there are none). standardHours is the tenant's configured standard
// week, falling back to 40. Contract: docs/newreqphase3.md Domain G.4.
export function overtimeFromSheets(sheets, standardHours) {
  const std = Number.isFinite(standardHours) ? standardHours : 40;
  return round2(
    (sheets || []).reduce((acc, t) => acc + Math.max(0, (t.totalHours ?? 0) - std), 0),
  );
}

// §3d — taskId is optional (a project entry may have no task). Normalize
// null/'' -> null so an empty/absent task never reaches Prisma as a bad FK
// (was a live 500). Mutates and returns the same object. Domain G.2.
export function normalizeTaskId(data) {
  if (data && 'taskId' in data && !data.taskId) data.taskId = null;
  return data;
}

// §3a (copy-week, M5) — pick each UNIQUE project/task row from the source week
// that the target week does not already have. Pure decision step; the caller
// persists the returned rows at hours:0. Idempotent and dedupes the source.
export function uniqueCopyRows(sourceEntries, targetEntries) {
  const rowKey = (e) => `${e.projectId}::${e.taskId ?? ''}`;
  const existing = new Set((targetEntries || []).map(rowKey));
  const seen = new Set();
  const out = [];
  for (const e of sourceEntries || []) {
    const key = rowKey(e);
    if (seen.has(key) || existing.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}
