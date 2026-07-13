// BE-PAY-7: leave-year is no longer hardcoded to the calendar year. resolveLeaveYear honours
// leaveYear.basis (CALENDAR default = today's behaviour; FISCAL + startMonth = Apr–Mar etc.),
// and runYearEndClose closes on the fiscal boundary when supplied.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLeaveYear } from '../src/modules/leave/leaveEngine.service.js';
import { runYearEndClose } from '../src/modules/leave/engine/yearEnd.js';

const jul2026 = new Date(2026, 6, 15); // local July 15 2026 (month index 6)
const feb2026 = new Date(2026, 1, 15); // local Feb 15 2026

test('CALENDAR (default / null config) is byte-identical to the old getFullYear behaviour', () => {
  assert.deepEqual(resolveLeaveYear(undefined, jul2026), { leaveYear: 2026, start: '2026-01-01', end: '2026-12-31', nextYear: 2027 });
  assert.deepEqual(resolveLeaveYear({ basis: 'CALENDAR' }, feb2026), { leaveYear: 2026, start: '2026-01-01', end: '2026-12-31', nextYear: 2027 });
});

test('FISCAL Apr–Mar: a mid-year date maps to the current fiscal year', () => {
  const ly = resolveLeaveYear({ basis: 'FISCAL', startMonth: 4 }, jul2026);
  assert.deepEqual(ly, { leaveYear: 2026, start: '2026-04-01', end: '2027-03-31', nextYear: 2027 });
});

test('FISCAL Apr–Mar: a pre-April date belongs to the previous fiscal year', () => {
  const ly = resolveLeaveYear({ basis: 'FISCAL', startMonth: 4 }, feb2026);
  assert.deepEqual(ly, { leaveYear: 2025, start: '2025-04-01', end: '2026-03-31', nextYear: 2026 });
});

test('FISCAL defaults startMonth to 4 (April) when omitted', () => {
  assert.equal(resolveLeaveYear({ basis: 'FISCAL' }, jul2026).start, '2026-04-01');
});

test('runYearEndClose CALENDAR default closes on Dec 31 (unchanged)', () => {
  const rule = { yearEnd: 'CARRY', carryForward: { allowed: true, cap: 5 } };
  const txns = runYearEndClose({ employeeId: 'e1', leaveTypeId: 'EL', policyId: 'p', policyVersion: '1', rule, closingBalance: 8, year: 2026 });
  const carry = txns.find((t) => t.type === 'CARRY_FORWARD_IN');
  assert.equal(carry.effectiveDate, '2026-12-31');
  assert.match(carry.reason, /into 2027/);
});

test('runYearEndClose honours a fiscal window when supplied', () => {
  const rule = { yearEnd: 'CARRY', carryForward: { allowed: true, cap: 5 } };
  const txns = runYearEndClose({
    employeeId: 'e1', leaveTypeId: 'EL', policyId: 'p', policyVersion: '1',
    rule, closingBalance: 8, year: 2026, leaveYearEnd: '2027-03-31', nextYear: 2027,
  });
  const carry = txns.find((t) => t.type === 'CARRY_FORWARD_IN');
  assert.equal(carry.effectiveDate, '2027-03-31');
  assert.match(carry.reason, /into 2027/);
});
