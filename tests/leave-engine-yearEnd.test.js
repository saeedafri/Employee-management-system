// Ported from ems-frontend yearEnd.test.ts (Vitest -> node:test). Pure engine oracle, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runYearEndClose } from '../src/modules/leave/engine/yearEnd.js';

const baseRule = (over) => ({
  leaveTypeCode: 'EL',
  grantStyle: 'ACCRUE',
  annualQuota: 18,
  leaveYear: { basis: 'CALENDAR' },
  proration: { onJoin: true, onExit: true, basis: 'BY_MONTH' },
  carryForward: { allowed: true, cap: 30, expiryMonths: 12 },
  yearEnd: 'CARRY',
  negativeBalance: { allowed: false, convertsToLop: false },
  eligibility: {},
  request: { unit: 'FULL_DAY' },
  sandwichRule: {
    enabled: false,
    scope: 'BETWEEN_LEAVE_DAYS',
    countWeeklyOff: false,
    countHolidays: false,
  },
  noticePeriodLeave: { allowed: true, extendsNotice: false },
  ...over,
});

const ctx = { employeeId: 'e1', leaveTypeId: 'EL', policyId: 'p', policyVersion: '1' };

test('CARRY: carries min(unused, cap) into next year + expires the remainder', () => {
  const rule = baseRule({ yearEnd: 'CARRY', carryForward: { allowed: true, cap: 5 } });
  const txns = runYearEndClose({ ...ctx, rule, closingBalance: 8, year: 2026 });
  const carry = txns.find((x) => x.type === 'CARRY_FORWARD_IN');
  const expired = txns.find((x) => x.type === 'CARRY_FORWARD_EXPIRED');
  assert.equal(carry?.delta, 5);
  assert.equal(expired?.delta, -3);
  assert.equal(txns[0].type, 'CARRY_FORWARD_IN');
});

test('LAPSE: expires the full unused balance', () => {
  const rule = baseRule({ yearEnd: 'LAPSE' });
  const txns = runYearEndClose({ ...ctx, rule, closingBalance: 6, year: 2026 });
  assert.equal(txns.length, 1);
  assert.equal(txns[0].type, 'CARRY_FORWARD_EXPIRED');
  assert.equal(txns[0].delta, -6);
});

test('ENCASH: posts ENCASHED for the full unused balance', () => {
  const rule = baseRule({ yearEnd: 'ENCASH' });
  const txns = runYearEndClose({ ...ctx, rule, closingBalance: 4, year: 2026 });
  assert.equal(txns[0].type, 'ENCASHED');
  assert.equal(txns[0].delta, -4);
});
