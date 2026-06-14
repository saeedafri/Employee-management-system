/**
 * Timesheets derivation unit tests — pure, no DB.
 * Run: node --test tests/timesheets-derivations.test.js
 *
 * Locks the contract for the 2026-06-14 backend bug fixes
 * (docs/backendtimesheetbug.md):
 *   Bug #1  overtimeHours derivation     (Domain G.4 — fixes the `undefinedh` card)
 *   §3a     copy-week unique rows         (M5)
 *   §3d     taskId null/'' normalization  (Domain G.2 — fixes the live 500)
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  overtimeFromSheets,
  normalizeTaskId,
  uniqueCopyRows,
  round2,
  isoWeekday,
  priorWeekStartISO,
  shouldRemindToday,
  needsEmployeeReminder,
  tenantToday,
  isEditableWeek,
} from '../src/modules/timesheets/timesheets.derive.js';

// ── Bug #1: overtimeHours = Σ max(0, weekTotal − standardHours) ──────────────
test('overtime: zero timesheets → 0 (a number, never undefined/null)', () => {
  const v = overtimeFromSheets([], 40);
  assert.equal(v, 0);
  assert.equal(typeof v, 'number');
});

test('overtime: all weeks under the standard week → 0', () => {
  assert.equal(overtimeFromSheets([{ totalHours: 38 }, { totalHours: 12 }], 40), 0);
});

test('overtime: sums only the per-week excess', () => {
  // 46→6, 40→0, 50→10  => 16
  assert.equal(
    overtimeFromSheets([{ totalHours: 46 }, { totalHours: 40 }, { totalHours: 50 }], 40),
    16,
  );
});

test('overtime: respects the tenant standard week (not hardcoded 40)', () => {
  assert.equal(overtimeFromSheets([{ totalHours: 40 }], 35), 5);
});

test('overtime: missing/null totalHours is treated as 0', () => {
  assert.equal(overtimeFromSheets([{}, { totalHours: null }], 40), 0);
});

test('overtime: non-finite standardHours falls back to 40', () => {
  assert.equal(overtimeFromSheets([{ totalHours: 46 }], undefined), 6);
});

test('overtime: result is rounded to 2dp', () => {
  assert.equal(overtimeFromSheets([{ totalHours: 46.25 }], 40), 6.25);
});

// ── §3d: taskId normalization (the live 500 root cause) ──────────────────────
test('normalizeTaskId: empty string → null', () => {
  assert.deepEqual(normalizeTaskId({ taskId: '' }), { taskId: null });
});

test('normalizeTaskId: explicit null stays null', () => {
  assert.deepEqual(normalizeTaskId({ taskId: null }), { taskId: null });
});

test('normalizeTaskId: a real id is preserved', () => {
  assert.deepEqual(normalizeTaskId({ taskId: 'task_123' }), { taskId: 'task_123' });
});

test('normalizeTaskId: absent key is left untouched (omit-the-key contract)', () => {
  assert.deepEqual(normalizeTaskId({ projectId: 'p1' }), { projectId: 'p1' });
});

// ── §3a: copy-week unique rows ───────────────────────────────────────────────
test('copyWeek: dedupes by project/task and skips rows the target already has', () => {
  const source = [
    { projectId: 'p1', taskId: 't1' },
    { projectId: 'p1', taskId: 't1' }, // duplicate in source
    { projectId: 'p1', taskId: null }, // distinct: same project, no task
    { projectId: 'p2', taskId: 't9' }, // already in target → skip
  ];
  const target = [{ projectId: 'p2', taskId: 't9' }];
  const rows = uniqueCopyRows(source, target);
  assert.deepEqual(
    rows.map((r) => `${r.projectId}::${r.taskId ?? ''}`),
    ['p1::t1', 'p1::'],
  );
});

test('copyWeek: empty source → nothing to copy', () => {
  assert.deepEqual(uniqueCopyRows([], []), []);
});

test('copyWeek: null inputs are safe', () => {
  assert.deepEqual(uniqueCopyRows(null, null), []);
});

// ── M7: submit-reminder helpers ──────────────────────────────────────────────
test('isoWeekday: Monday=1 .. Sunday=7 (UTC)', () => {
  assert.equal(isoWeekday(new Date('2026-06-08T00:00:00Z')), 1); // Mon
  assert.equal(isoWeekday(new Date('2026-06-12T00:00:00Z')), 5); // Fri
  assert.equal(isoWeekday(new Date('2026-06-14T00:00:00Z')), 7); // Sun
});

test('priorWeekStartISO: returns the Monday of the previous week', () => {
  // Week of 2026-06-08 (Mon) → prior week Monday = 2026-06-01
  assert.equal(priorWeekStartISO(new Date('2026-06-10T09:00:00Z')), '2026-06-01');
  // From a Sunday (still that week) → prior Monday
  assert.equal(priorWeekStartISO(new Date('2026-06-14T23:00:00Z')), '2026-06-01');
  // From a Monday itself → previous Monday
  assert.equal(priorWeekStartISO(new Date('2026-06-08T00:00:00Z')), '2026-06-01');
});

test('shouldRemindToday: null reminderDay disables reminders', () => {
  assert.equal(shouldRemindToday(null, new Date('2026-06-12T00:00:00Z')), false);
  assert.equal(shouldRemindToday(undefined, new Date('2026-06-12T00:00:00Z')), false);
});

test('shouldRemindToday: fires only when today matches the configured ISO weekday', () => {
  const friday = new Date('2026-06-12T00:00:00Z'); // ISO weekday 5
  assert.equal(shouldRemindToday(5, friday), true);
  assert.equal(shouldRemindToday(4, friday), false);
});

test('tenantToday: resolves the tenant-local calendar date (TZ aware)', () => {
  // 2026-06-15 00:30 UTC is still 2026-06-14 in New York (UTC-4) but already 15th in UTC.
  const t = new Date('2026-06-15T00:30:00Z');
  assert.equal(tenantToday(t, 'UTC').toISOString().slice(0, 10), '2026-06-15');
  assert.equal(tenantToday(t, 'America/New_York').toISOString().slice(0, 10), '2026-06-14');
  // Asia/Kolkata (UTC+5:30) is already the 15th.
  assert.equal(tenantToday(t, 'Asia/Kolkata').toISOString().slice(0, 10), '2026-06-15');
});

test('tenantToday: invalid timezone falls back to UTC (never throws)', () => {
  const t = new Date('2026-06-15T00:30:00Z');
  assert.equal(tenantToday(t, 'Not/AZone').toISOString().slice(0, 10), '2026-06-15');
});

test('shouldRemindToday: uses the tenant-local weekday, not UTC', () => {
  // 2026-06-15 00:30 UTC → Monday(1) in UTC, but Sunday(7) in New York.
  const t = new Date('2026-06-15T00:30:00Z');
  assert.equal(shouldRemindToday(1, t, 'UTC'), true);
  assert.equal(shouldRemindToday(1, t, 'America/New_York'), false);
  assert.equal(shouldRemindToday(7, t, 'America/New_York'), true);
});

test('priorWeekStartISO: prior Monday is computed in tenant-local time', () => {
  const t = new Date('2026-06-15T00:30:00Z'); // UTC: Mon 15th → prior Mon 8th
  assert.equal(priorWeekStartISO(t, 'UTC'), '2026-06-08');
  // New York: still Sun 14th → that week's Mon is 8th → prior Mon is 1st
  assert.equal(priorWeekStartISO(t, 'America/New_York'), '2026-06-01');
});

test('needsEmployeeReminder: REJECTED always, DRAFT only with hours, never SUBMITTED/APPROVED', () => {
  assert.equal(needsEmployeeReminder({ status: 'REJECTED', totalHours: 0 }), true);
  assert.equal(needsEmployeeReminder({ status: 'DRAFT', totalHours: 8 }), true);
  assert.equal(needsEmployeeReminder({ status: 'DRAFT', totalHours: 0 }), false);
  assert.equal(needsEmployeeReminder({ status: 'SUBMITTED', totalHours: 8 }), false);
  assert.equal(needsEmployeeReminder({ status: 'APPROVED', totalHours: 40 }), false);
  assert.equal(needsEmployeeReminder(null), false);
});

// ── isEditableWeek (locked-week guard) ───────────────────────────────────────
test('isEditableWeek: DRAFT and REJECTED are editable; SUBMITTED/APPROVED are locked', () => {
  assert.equal(isEditableWeek('DRAFT'), true);
  assert.equal(isEditableWeek('REJECTED'), true);
  assert.equal(isEditableWeek('SUBMITTED'), false);
  assert.equal(isEditableWeek('APPROVED'), false);
  assert.equal(isEditableWeek(undefined), false);
});

// ── round2 helper (must match FE engine exactly: Math.round(n*100)/100) ───────
test('round2: handles binary float drift', () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(2643.5), 2643.5);
  assert.equal(round2(23.999998), 24);
  assert.equal(round2(1284), 1284);
});
