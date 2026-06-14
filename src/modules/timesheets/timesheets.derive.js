// Pure, DB-free helpers behind the 2026-06-14 timesheets backend bug fixes
// (see docs/backendtimesheetbug.md). Extracted so the derivation logic can be
// unit-tested without a database (tests/timesheets-derivations.test.js).

// Round to 2 decimal places (hours-safe). Matches the FE rollup engine exactly
// (src/mocks/handlers/timesheets.ts round2 = Math.round(n * 100) / 100).
export const round2 = (n) => Math.round(n * 100) / 100;

// A week is only editable (entries add/edit/delete, submit, copy-target) in these
// states — matches the MSW EDITABLE_STATUSES. SUBMITTED/APPROVED are locked.
export function isEditableWeek(status) {
  return status === 'DRAFT' || status === 'REJECTED';
}

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

// ── M7 submit-reminder helpers (pure, DB-free) ─────────────────────────────────

// The tenant-local calendar date (as a UTC-midnight Date) for `now` in `timezone`.
// Reminders must fire on the tenant's LOCAL weekday, so a global fleet of tenants
// each gets nudged on their own day rather than everyone on a single UTC boundary.
// timezone defaults to UTC (keeps the helper pure/testable without TZ data).
export function tenantToday(now, timezone = 'UTC') {
  let ymd;
  try {
    ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  } catch {
    // Unknown/invalid IANA zone → fall back to UTC rather than throwing (never break).
    ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  }
  return new Date(`${ymd}T00:00:00Z`);
}

// ISO weekday for a UTC-midnight Date: Monday=1 .. Sunday=7 (matches submitReminderDay).
export function isoWeekday(date) {
  return ((date.getUTCDay() + 6) % 7) + 1;
}

// Monday (YYYY-MM-DD) of the week BEFORE the tenant-local day of `now`.
// Timesheet.weekStart is always a Monday, so this is the prior week's key.
export function priorWeekStartISO(now, timezone = 'UTC') {
  const d = tenantToday(now, timezone);
  const mondayOffset = (d.getUTCDay() + 6) % 7; // 0=Mon .. 6=Sun
  d.setUTCDate(d.getUTCDate() - mondayOffset - 7); // back to this Monday, then a full week
  return d.toISOString().slice(0, 10);
}

// Should the reminder job fire today for this tenant? null/absent = disabled.
// Compares the configured ISO weekday against the tenant-LOCAL weekday.
export function shouldRemindToday(submitReminderDay, now, timezone = 'UTC') {
  if (submitReminderDay == null) return false;
  return isoWeekday(tenantToday(now, timezone)) === submitReminderDay;
}

// An employee needs a submit nudge when the prior week is REJECTED (not resubmitted)
// or DRAFT with hours actually logged. Empty drafts are ignored.
export function needsEmployeeReminder(sheet) {
  if (!sheet) return false;
  if (sheet.status === 'REJECTED') return true;
  if (sheet.status === 'DRAFT' && (sheet.totalHours ?? 0) > 0) return true;
  return false;
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
