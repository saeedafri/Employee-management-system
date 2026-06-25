import { test } from 'node:test';
import assert from 'node:assert/strict';
import { policyRequiresMfa } from '../src/modules/auth/auth.service.js';

const u = (memberType) => ({ memberType });

test('REQUIRED_ALL → MFA for every role', () => {
  for (const r of ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR']) {
    assert.equal(policyRequiresMfa('REQUIRED_ALL', u(r)), true, r);
  }
});

test('REQUIRED_ADMINS → only SUPER_ADMIN + HR_ADMIN', () => {
  assert.equal(policyRequiresMfa('REQUIRED_ADMINS', u('SUPER_ADMIN')), true);
  assert.equal(policyRequiresMfa('REQUIRED_ADMINS', u('HR_ADMIN')), true);
  assert.equal(policyRequiresMfa('REQUIRED_ADMINS', u('MANAGER')), false);
  assert.equal(policyRequiresMfa('REQUIRED_ADMINS', u('EMPLOYEE')), false);
  assert.equal(policyRequiresMfa('REQUIRED_ADMINS', u('AUDITOR')), false);
});

test('OPTIONAL → never required by policy (per-user opt-in handled separately)', () => {
  for (const r of ['SUPER_ADMIN', 'HR_ADMIN', 'EMPLOYEE']) {
    assert.equal(policyRequiresMfa('OPTIONAL', u(r)), false, r);
  }
});

test('unknown / undefined policy → false (safe default)', () => {
  assert.equal(policyRequiresMfa(undefined, u('SUPER_ADMIN')), false);
  assert.equal(policyRequiresMfa('WHATEVER', u('SUPER_ADMIN')), false);
});
