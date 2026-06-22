// Ported from ems-frontend applicability.test.ts (Vitest -> node:test). Pure engine oracle, no DB.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePolicyForEmployee } from '../src/modules/leave/engine/applicability.js';

const policy = (over) => ({
  id: 'p',
  country: 'IN',
  version: '2026.1',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  status: 'PUBLISHED',
  applicability: { employmentTypes: [], departmentIds: [] },
  rules: [],
  ...over,
});

const emp = {
  employeeId: 'e1',
  joinDate: '2026-02-01',
  employmentType: 'FULL_TIME',
  departmentId: 'd1',
  legalEntityId: 'le-in',
  country: 'IN',
  workWeekDays: [1, 2, 3, 4, 5],
  holidays: [],
};

test('matches country + entity; most-specific (dept-scoped) wins over generic', () => {
  const generic = policy({ id: 'gen', applicability: { employmentTypes: [], departmentIds: [] } });
  const deptScoped = policy({
    id: 'dept',
    applicability: { employmentTypes: ['FULL_TIME'], departmentIds: ['d1'], legalEntityId: 'le-in' },
  });
  const got = resolvePolicyForEmployee([generic, deptScoped], emp, '2026-03-01');
  assert.equal(got?.id, 'dept');
});

test('ignores DRAFT and out-of-effective-window policies', () => {
  const draft = policy({ id: 'draft', status: 'DRAFT' });
  const future = policy({ id: 'future', effectiveFrom: '2027-01-01' });
  const got = resolvePolicyForEmployee([draft, future], emp, '2026-03-01');
  assert.equal(got, null);
});
