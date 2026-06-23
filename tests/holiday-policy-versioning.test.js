// §2.4 — effective-dated / versioned HolidayPolicy selection oracle (pure, no DB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickEffective } from '../src/modules/holidays/holidaysPolicy.service.js';

const ms = (d) => new Date(d).getTime();
// rows ordered effectiveFrom DESC (as the query returns them)
const rows = [
  { id: 'v2', observedRule: 'NEXT_WORKING_DAY', effectiveFrom: '2026-07-01T00:00:00Z', effectiveTo: null },
  { id: 'v1', observedRule: 'NONE', effectiveFrom: '1970-01-01T00:00:00Z', effectiveTo: '2026-07-01T00:00:00Z' },
];

test('§2.4 picks the version whose window contains the reference date', () => {
  assert.equal(pickEffective(rows, ms('2026-03-01')).id, 'v1'); // before the switch
  assert.equal(pickEffective(rows, ms('2026-09-01')).id, 'v2'); // after the switch
});

test('§2.4 boundary — effectiveFrom inclusive, effectiveTo exclusive', () => {
  assert.equal(pickEffective(rows, ms('2026-07-01')).id, 'v2'); // exactly at the new start
});

test('§2.4 ref before earliest version falls back to the earliest (covers history)', () => {
  const only = [{ id: 'vX', effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: null }];
  assert.equal(pickEffective(only, ms('2020-01-01')).id, 'vX');
});

test('§2.4 no rows → null', () => {
  assert.equal(pickEffective([], ms('2026-01-01')), null);
});
