// Ported from ems-frontend applicability.test.ts (Vitest -> node:test). Pure engine oracle, no DB.
// Backs Phase 7.3 — server-side per-country holiday scoping via resolveApplicableHolidays.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApplicableHolidays } from '../src/modules/holidays/utils/applicability.js';

function holiday(overrides) {
  return {
    id: 'h-default',
    name: 'Test Holiday',
    holidayDate: '2026-01-01T00:00:00.000Z',
    location: null,
    isOptional: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── country filter ───────────────────────────────────────────────────────────
test('null country code → returns all holidays unchanged (safe default)', () => {
  const holidays = [
    holiday({ id: 'h-null', location: null }),
    holiday({ id: 'h-india', location: 'India' }),
    holiday({ id: 'h-us', location: 'United States' }),
  ];
  assert.deepEqual(resolveApplicableHolidays(holidays, null), holidays);
});

test("country 'IN' keeps null-location + India; drops United States", () => {
  const holidays = [
    holiday({ id: 'h-null', location: null }),
    holiday({ id: 'h-india', location: 'India' }),
    holiday({ id: 'h-us', location: 'United States' }),
  ];
  const result = resolveApplicableHolidays(holidays, 'IN');
  assert.deepEqual(result.map((h) => h.id), ['h-null', 'h-india']);
});

test('is case-insensitive on location text ("india", "INDIA")', () => {
  const holidays = [
    holiday({ id: 'h-lower', location: 'india' }),
    holiday({ id: 'h-upper', location: 'INDIA' }),
  ];
  const result = resolveApplicableHolidays(holidays, 'IN');
  assert.deepEqual(result.map((h) => h.id), ['h-lower', 'h-upper']);
});

test('malformed country code does not throw and behaves sensibly (keeps only null-location)', () => {
  const holidays = [
    holiday({ id: 'h-null', location: null }),
    holiday({ id: 'h-india', location: 'India' }),
  ];
  assert.doesNotThrow(() => resolveApplicableHolidays(holidays, 'ZZ'));
  assert.deepEqual(resolveApplicableHolidays(holidays, 'ZZ').map((h) => h.id), ['h-null']);

  assert.doesNotThrow(() => resolveApplicableHolidays(holidays, 'xx'));
  assert.deepEqual(resolveApplicableHolidays(holidays, 'xx').map((h) => h.id), ['h-null']);
});

test("'US' keeps location 'United States' via display-name match; drops India", () => {
  const holidays = [
    holiday({ id: 'h-null', location: null }),
    holiday({ id: 'h-us', location: 'United States' }),
    holiday({ id: 'h-india', location: 'India' }),
  ];
  const result = resolveApplicableHolidays(holidays, 'US');
  assert.deepEqual(result.map((h) => h.id), ['h-null', 'h-us']);
});

test('does NOT false-positive a 2-letter code substring (e.g. "in" inside "Indonesia")', () => {
  const holidays = [holiday({ id: 'h-indonesia', location: 'Indonesia' })];
  assert.deepEqual(resolveApplicableHolidays(holidays, 'IN'), []);
});

test('keeps a location that includes the display name as a substring (loc.includes(name))', () => {
  const holidays = [holiday({ id: 'h-substr', location: 'United States (Federal)' })];
  const result = resolveApplicableHolidays(holidays, 'US');
  assert.deepEqual(result.map((h) => h.id), ['h-substr']);
});

// ── opts.selectedOptionalIds ─────────────────────────────────────────────────
const mandatory = holiday({ id: 'h-mandatory', isOptional: false, location: null });
const selectedOpt = holiday({ id: 'h-sel', isOptional: true, location: null });
const unselectedOpt = holiday({ id: 'h-unsel', isOptional: true, location: null });
const all = [mandatory, selectedOpt, unselectedOpt];

test('omitted opts → all holidays kept (backward-compat)', () => {
  const result = resolveApplicableHolidays(all, 'IN');
  assert.deepEqual(result.map((h) => h.id), ['h-mandatory', 'h-sel', 'h-unsel']);
});

test('opts but selectedOptionalIds omitted → all holidays kept (backward-compat)', () => {
  const result = resolveApplicableHolidays(all, 'IN', {});
  assert.deepEqual(result.map((h) => h.id), ['h-mandatory', 'h-sel', 'h-unsel']);
});

test('selectedOptionalIds provided → selected optional kept, unselected optional dropped', () => {
  const result = resolveApplicableHolidays(all, 'IN', { selectedOptionalIds: ['h-sel'] });
  assert.deepEqual(result.map((h) => h.id), ['h-mandatory', 'h-sel']);
});

test('mandatory holidays are always kept regardless of selectedOptionalIds', () => {
  const result = resolveApplicableHolidays(all, 'IN', { selectedOptionalIds: [] });
  assert.deepEqual(result.map((h) => h.id), ['h-mandatory']);
});

test('optional filter composes with country filter — country-excluded optionals still dropped', () => {
  const inMandatory = holiday({ id: 'h-in-mand', isOptional: false, location: 'India' });
  const inOpt = holiday({ id: 'h-in-opt', isOptional: true, location: 'India' });
  const usOpt = holiday({ id: 'h-us-opt', isOptional: true, location: 'United States' });
  const tenantWide = holiday({ id: 'h-tenant', isOptional: false, location: null });

  const result = resolveApplicableHolidays([inMandatory, inOpt, usOpt, tenantWide], 'IN', {
    selectedOptionalIds: ['h-us-opt', 'h-in-opt'],
  });
  assert.deepEqual(result.map((h) => h.id), ['h-in-mand', 'h-in-opt', 'h-tenant']);
});

test('null country + selectedOptionalIds → optional filter still applies', () => {
  const result = resolveApplicableHolidays(all, null, { selectedOptionalIds: ['h-sel'] });
  assert.deepEqual(result.map((h) => h.id), ['h-mandatory', 'h-sel']);
});
