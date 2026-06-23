// Pure oracle for the shared Holiday Applicability Engine (HOLIDAY_ENGINE_BACKEND_CONTRACT).
// Covers §2 rule matrix, §4 config-over-code (never-seen country), §5 multi-country, §6 edges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildResolvedHolidays, offDateSet } from '../src/modules/holidays/holidayResolver.service.js';

let n = 0;
const h = (o = {}) => ({ id: `h${++n}`, name: 'H', holidayDate: '2026-01-01T00:00:00.000Z', location: null, isOptional: false, ...o });

const MON_FRI = [1, 2, 3, 4, 5];
const SUN_THU = [0, 1, 2, 3, 4];

test('§2 country scoping — IN and US are disjoint but both keep tenant-wide rows', () => {
  const rows = [
    h({ id: 'tw', location: null, name: 'New Year' }),         // tenant-wide
    h({ id: 'in1', location: 'IN', name: 'Holi' }),
    h({ id: 'us1', location: 'United States', name: 'July 4' }),
  ];
  const inSet = buildResolvedHolidays(rows, { countryCode: 'IN', workWeekDays: MON_FRI }).map((x) => x.id);
  const usSet = buildResolvedHolidays(rows, { countryCode: 'US', workWeekDays: MON_FRI }).map((x) => x.id);
  assert.deepEqual(inSet.sort(), ['in1', 'tw'].sort());
  assert.deepEqual(usSet.sort(), ['tw', 'us1'].sort());
  // disjoint country rows, shared tenant-wide
  assert.ok(inSet.includes('tw') && usSet.includes('tw'));
  assert.ok(!inSet.includes('us1') && !usSet.includes('in1'));
});

test('§5 unresolved country → tenant-wide ONLY (not "all countries")', () => {
  const rows = [h({ id: 'tw', location: null }), h({ id: 'in1', location: 'IN' })];
  const out = buildResolvedHolidays(rows, { countryCode: null, workWeekDays: MON_FRI });
  assert.deepEqual(out.map((x) => x.id), ['tw']);
});

test('§2 observed shift — KWD holiday on Fri (non-working in SUN-THU) shifts + carries actualDate', () => {
  // 2026-01-02 is a Friday. SUN-THU work-week → Friday is off; NEXT_WORKING_DAY → Sunday 2026-01-04.
  const rows = [h({ id: 'k1', location: 'KW', name: 'National Day', holidayDate: '2026-01-02T00:00:00.000Z' })];
  const out = buildResolvedHolidays(rows, { countryCode: 'KW', workWeekDays: SUN_THU, observedRule: 'NEXT_WORKING_DAY' });
  assert.equal(out[0].observed, true);
  assert.equal(out[0].holidayDate, '2026-01-04T00:00:00.000Z'); // observed (Sunday)
  assert.equal(out[0].actualDate, '2026-01-02T00:00:00.000Z'); // original (Friday)
});

test('§2 no shift on a working day → observed=false, actualDate=null', () => {
  // 2026-01-01 is a Thursday → working in MON-FRI.
  const out = buildResolvedHolidays([h({ location: 'IN' })], { countryCode: 'IN', workWeekDays: MON_FRI, observedRule: 'NEXT_WORKING_DAY' });
  assert.equal(out[0].observed, false);
  assert.equal(out[0].actualDate, null);
});

test('§2 optional/restricted — mandatory always kept; optional only when selected', () => {
  const rows = [
    h({ id: 'm', isOptional: false, location: 'IN' }),
    h({ id: 'oSel', isOptional: true, location: 'IN', holidayDate: '2026-03-10T00:00:00.000Z' }),
    h({ id: 'oUn', isOptional: true, location: 'IN', holidayDate: '2026-03-11T00:00:00.000Z' }),
  ];
  const out = buildResolvedHolidays(rows, { countryCode: 'IN', workWeekDays: MON_FRI, selectedOptionalIds: ['oSel'] });
  const byId = Object.fromEntries(out.map((x) => [x.id, x]));
  assert.equal(byId.m.selected, true);
  assert.equal(byId.oSel.selected, true);
  assert.equal(byId.oUn.selected, false);
  // off-set excludes the unselected optional
  const off = offDateSet(out);
  assert.ok(off.has('2026-03-10') && !off.has('2026-03-11'));
});

test('§4 config-over-code — a never-seen country (BR) resolves with zero code changes', () => {
  const rows = [h({ id: 'tw', location: null }), h({ id: 'br1', location: 'Brazil' }), h({ id: 'in1', location: 'IN' })];
  const out = buildResolvedHolidays(rows, { countryCode: 'BR', workWeekDays: MON_FRI }).map((x) => x.id).sort();
  assert.deepEqual(out, ['br1', 'tw'].sort()); // BR row + tenant-wide, no IN
});

test('§6 empty — no holidays → empty list', () => {
  assert.deepEqual(buildResolvedHolidays([], { countryCode: 'IN', workWeekDays: MON_FRI }), []);
});

test('each resolved row carries the full metadata contract (§1)', () => {
  const out = buildResolvedHolidays([h({ location: 'IN' })], { countryCode: 'IN', workWeekDays: MON_FRI });
  assert.deepEqual(Object.keys(out[0]).sort(),
    ['actualDate', 'countryCode', 'holidayDate', 'id', 'isOptional', 'location', 'name', 'observed', 'selected'].sort());
});
