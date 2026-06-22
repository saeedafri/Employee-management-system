// Ported from ems-frontend proration.test.ts (Vitest -> node:test). Pure engine oracle, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodFraction } from '../src/modules/leave/engine/proration.js';

const close = (a, b, d = 5) => assert.ok(Math.abs(a - b) < Math.pow(10, -d), `${a} ~ ${b}`);

test('BY_DAY counts days from join to period end inclusive', () => {
  const f = periodFraction(
    { start: '2026-03-01', end: '2026-03-31' },
    { joinDate: '2026-03-16', exitDate: null, basis: 'BY_DAY' },
  );
  close(f, 16 / 31);
});

test('BY_MONTH gives a full period when joined before it starts', () => {
  const f = periodFraction(
    { start: '2026-03-01', end: '2026-03-31' },
    { joinDate: '2026-01-10', exitDate: null, basis: 'BY_MONTH' },
  );
  assert.equal(f, 1);
});

test('BY_MONTH gives 0 when joined after the period ends', () => {
  const f = periodFraction(
    { start: '2026-03-01', end: '2026-03-31' },
    { joinDate: '2026-04-02', exitDate: null, basis: 'BY_MONTH' },
  );
  assert.equal(f, 0);
});

test('exit mid-period truncates the fraction (BY_DAY)', () => {
  const f = periodFraction(
    { start: '2026-03-01', end: '2026-03-31' },
    { joinDate: '2026-01-01', exitDate: '2026-03-10', basis: 'BY_DAY' },
  );
  close(f, 10 / 31);
});
