// Pure margin math oracle (ported from FE rateMath). Revenue = billable hours only; cost = all hours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMargins } from '../src/modules/timesheets/utils/rateMath.js';

const billableRate = () => 100; // $100/h
const costRate = () => 40; // $40/h

test('billable revenue + all-hours cost + margin', () => {
  const entries = [
    { projectId: 'p1', employeeId: 'e1', hours: 10, billable: true },
    { projectId: 'p1', employeeId: 'e1', hours: 5, billable: false }, // costs but no revenue
  ];
  const { byProject, totals } = computeMargins(entries, billableRate, costRate);
  const p1 = byProject.get('p1');
  assert.equal(p1.revenue, 1000); // 10 * 100 (billable only)
  assert.equal(p1.cost, 600); // 15 * 40 (all hours)
  assert.equal(p1.margin, 400);
  assert.equal(totals.revenue, 1000);
  assert.equal(totals.cost, 600);
  assert.equal(totals.marginPct, 40); // 400/1000
});

test('empty entries → zero totals', () => {
  const { totals } = computeMargins([], billableRate, costRate);
  assert.deepEqual(totals, { revenue: 0, cost: 0, margin: 0, marginPct: 0 });
});
