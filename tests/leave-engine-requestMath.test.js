// Ported from ems-frontend requestMath.test.ts (Vitest -> node:test). Pure engine oracle, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countChargeableDays } from '../src/modules/leave/engine/requestMath.js';

const MON_FRI = [1, 2, 3, 4, 5];
const noSandwich = {
  enabled: false,
  scope: 'BETWEEN_LEAVE_DAYS',
  countWeeklyOff: false,
  countHolidays: false,
};

test('default (sandwich off): Fri + Mon = 2 charged, weekend free', () => {
  const n = countChargeableDays({
    start: '2026-08-14',
    end: '2026-08-17', // Fri..Mon
    unit: 'FULL_DAY',
    workWeekDays: MON_FRI,
    holidays: [],
    sandwich: noSandwich,
  });
  assert.equal(n, 2);
});

test('sandwich BETWEEN + countWeeklyOff: Fri..Mon = 4 charged', () => {
  const n = countChargeableDays({
    start: '2026-08-14',
    end: '2026-08-17',
    unit: 'FULL_DAY',
    workWeekDays: MON_FRI,
    holidays: [],
    sandwich: {
      enabled: true,
      scope: 'BETWEEN_LEAVE_DAYS',
      countWeeklyOff: true,
      countHolidays: false,
    },
  });
  assert.equal(n, 4);
});

test('half-day on a single working day = 0.5', () => {
  const n = countChargeableDays({
    start: '2026-08-14',
    end: '2026-08-14',
    unit: 'HALF_DAY',
    workWeekDays: MON_FRI,
    holidays: [],
    sandwich: noSandwich,
  });
  assert.equal(n, 0.5);
});
