import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hasPermission, PERMISSION_KEYS } from '../src/modules/auth/auth.policy.js';

const TENANT_KEY = 'acme-corp-001';
const PASSWORD = 'Password123!';

let app;

test.before(async () => {
  app = await createApp();
  await app.ready();
});

test.after(async () => {
  if (app) await app.close();
});

async function login(email) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      email,
      password: PASSWORD,
    },
  });

  assert.equal(response.statusCode, 200);
  return response.json().data.accessToken;
}

test('RBAC permission catalog matches frontend permissions contract', () => {
  assert.deepEqual([...PERMISSION_KEYS].sort(), [
    'analytics:read',
    'attendance:read',
    'attendance:write',
    'audit:read',
    'departments:read',
    'departments:write',
    'employees:delete',
    'employees:export',
    'employees:read',
    'employees:write',
    'leave:approve',
    'leave:read',
    'leave:request',
    'permissions:manage',
  ]);

  assert.equal(
    hasPermission({ memberType: 'HR_ADMIN', permissions: ['permissions:manage'] }, 'permissions:manage'),
    true,
  );
  assert.equal(
    hasPermission({ memberType: 'HR_ADMIN', permissions: [] }, 'permissions:manage'),
    false,
  );
  assert.equal(hasPermission({ memberType: 'SUPER_ADMIN', permissions: [] }, 'permissions:manage'), true);
});

test('GET /settings/roles-permissions enforces permissions:manage server-side', async () => {
  const hrAccessToken = await login('hr@acme.test');
  const superAccessToken = await login('superadmin@acme.test');

  const hrResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/settings/roles-permissions',
    headers: {
      authorization: `Bearer ${hrAccessToken}`,
    },
  });

  assert.equal(hrResponse.statusCode, 403);
  assert.equal(hrResponse.json().error.code, 'FORBIDDEN');
  assert.equal(hrResponse.json().error.details.requiredPermission, 'permissions:manage');

  const superResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/settings/roles-permissions',
    headers: {
      authorization: `Bearer ${superAccessToken}`,
    },
  });

  assert.equal(superResponse.statusCode, 200);
  assert.equal(superResponse.json().success, true);
  assert.equal(Array.isArray(superResponse.json().data.permissions), true);
});
