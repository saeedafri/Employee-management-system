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

// ── round2 helper ────────────────────────────────────────────────────────────
test('round2: handles binary float drift', () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round2(2643.5), 2643.5);
});
