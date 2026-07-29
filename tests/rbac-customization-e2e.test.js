/**
 * The whole point of BACKEND_CONTRACT_configurable_rbac.md, proven end to end.
 * Run: node --test --test-force-exit tests/rbac-customization-e2e.test.js
 *
 * §0: "a tenant admin can regrant, restrict, or invent a role's access from the
 * Settings -> Roles & Permissions screen alone -- no engineering change, no
 * redeploy -- and have it take effect everywhere in the product immediately."
 *
 * Every other test proves the *mechanism*. This proves the *promise*: revoke a
 * key through the real endpoint, log in again, and watch the route close.
 *
 * Needs a test database (assertTestDatabase refuses production).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import { assertTestDatabase } from './assertTestDatabase.js';

assertTestDatabase('RBAC customization e2e');

const TENANT_KEY = 'acme-corp-001';
const PASSWORD = 'Password123!';

let app;

before(async () => {
  app = await createApp();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
});

async function login(email) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT_KEY },
    payload: { email, password: PASSWORD },
  });
  assert.equal(res.statusCode, 200, `login failed for ${email}: ${res.body}`);
  const body = res.json().data;
  return { token: body.accessToken, permissions: body.permissions ?? [] };
}

function call(method, url, token, payload) {
  return app.inject({
    method,
    url,
    headers: {
      authorization: `Bearer ${token}`,
      'x-tenant-key': TENANT_KEY,
      'content-type': 'application/json',
    },
    ...(payload ? { payload } : {}),
  });
}

/** Read the live matrix, apply a mutation to one role, PATCH it back. */
async function editMatrix(superToken, roleKey, mutate) {
  const before = await call('GET', '/api/v1/settings/roles-permissions', superToken);
  assert.equal(before.statusCode, 200);
  const matrix = before.json().data.matrix;
  const next = mutate([...(matrix[roleKey] ?? [])]);

  const patch = await call('PATCH', '/api/v1/settings/roles-permissions', superToken, {
    roleKey, permissions: next,
  });
  assert.equal(patch.statusCode, 200, `PATCH failed: ${patch.body}`);
  return matrix[roleKey] ?? [];
}

describe('a tenant admin can close a route from Settings alone', () => {
  it('revoking assets:manage from HR_ADMIN takes effect on next login', async () => {
    const superUser = await login('superadmin@acme.test');

    // 1. Baseline: HR reaches the route.
    const hrBefore = await login('hr@acme.test');
    assert.ok(hrBefore.permissions.includes('assets:manage'), 'baseline grant missing');
    assert.equal((await call('GET', '/api/v1/assets/summary', hrBefore.token)).statusCode, 200);

    // 2. Revoke it through the real settings endpoint.
    const original = await editMatrix(superUser.token, 'HR_ADMIN',
      (keys) => keys.filter((k) => k !== 'assets:manage'));

    try {
      // 3. A fresh login must no longer carry the key...
      const hrAfter = await login('hr@acme.test');
      assert.equal(hrAfter.permissions.includes('assets:manage'), false,
        'revoked key still minted into the JWT');

      // ...and the route must now 403 with the key that was denied.
      const denied = await call('GET', '/api/v1/assets/summary', hrAfter.token);
      assert.equal(denied.statusCode, 403, 'route stayed open after revocation');
      assert.equal(denied.json().error.details.requiredPermission, 'assets:manage');

      // 4. The already-issued token keeps working — documented stale-session behaviour.
      assert.equal((await call('GET', '/api/v1/assets/summary', hrBefore.token)).statusCode, 200,
        'existing sessions should keep stale permissions until refresh');
    } finally {
      // 5. Restore, and prove the restore actually re-opens the route.
      await editMatrix(superUser.token, 'HR_ADMIN', () => original);
    }

    const hrRestored = await login('hr@acme.test');
    assert.ok(hrRestored.permissions.includes('assets:manage'), 'restore did not re-grant');
    assert.equal((await call('GET', '/api/v1/assets/summary', hrRestored.token)).statusCode, 200,
      'route did not re-open after restore');
  });

  it('granting a key a role never had opens the route', async () => {
    const superUser = await login('superadmin@acme.test');

    const employeeBefore = await login('priya@acme.test');
    assert.equal(employeeBefore.permissions.includes('assets:manage'), false);
    assert.equal((await call('GET', '/api/v1/assets/summary', employeeBefore.token)).statusCode, 403);

    const original = await editMatrix(superUser.token, 'EMPLOYEE',
      (keys) => [...keys, 'assets:manage']);

    try {
      const employeeAfter = await login('priya@acme.test');
      assert.ok(employeeAfter.permissions.includes('assets:manage'), 'grant not minted');
      assert.equal((await call('GET', '/api/v1/assets/summary', employeeAfter.token)).statusCode, 200,
        'route stayed closed after granting the key');
    } finally {
      await editMatrix(superUser.token, 'EMPLOYEE', () => original);
    }

    const restored = await login('priya@acme.test');
    assert.equal(restored.permissions.includes('assets:manage'), false, 'restore leaked a grant');
  });
});

describe('§4 guardrails hold against a hostile edit', () => {
  it('SUPER_ADMIN cannot be locked out of permissions:manage', async () => {
    const superUser = await login('superadmin@acme.test');
    const res = await call('PATCH', '/api/v1/settings/roles-permissions', superUser.token, {
      roleKey: 'SUPER_ADMIN', permissions: [],
    });
    assert.equal(res.statusCode >= 400, true, 'stripping SUPER_ADMIN must be rejected');
    assert.equal(res.json().error.code, 'CANNOT_LOCK_OUT_SUPER_ADMIN');

    // And it is genuinely still able to reach the screen.
    const after = await login('superadmin@acme.test');
    assert.equal((await call('GET', '/api/v1/settings/roles-permissions', after.token)).statusCode, 200);
  });

  it('a non-admin cannot edit the matrix', async () => {
    const employee = await login('priya@acme.test');
    const res = await call('PATCH', '/api/v1/settings/roles-permissions', employee.token, {
      roleKey: 'EMPLOYEE', permissions: ['payroll:admin'],
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error.details.requiredPermission, 'permissions:manage');
  });

  it('SUPER_ADMIN keeps reaching a route even with an empty token', async () => {
    // hasPermission() bypasses unconditionally; a tenant must not be able to
    // lock the support role out of the product.
    const superUser = await login('superadmin@acme.test');
    for (const url of ['/api/v1/assets/summary', '/api/v1/reports/attendance', '/api/v1/settings/security/auth']) {
      assert.equal((await call('GET', url, superUser.token)).statusCode, 200, url);
    }
  });
});

describe('custom roles replace memberType defaults', () => {
  const ROLE_KEY = 'e2e-readonly-auditor';

  it('a user assigned a custom role gets exactly that role\'s grants', async () => {
    const superUser = await login('superadmin@acme.test');

    const created = await call('POST', '/api/v1/settings/roles', superUser.token, {
      name: 'E2E Read-Only', key: ROLE_KEY, permissions: ['employees:read'],
    });
    assert.equal([200, 201].includes(created.statusCode), true, `create role: ${created.body}`);

    const user = await prisma.user.findFirst({
      where: { email: 'priya@acme.test' }, select: { id: true },
    });

    try {
      const assigned = await call('POST', `/api/v1/settings/roles/${ROLE_KEY}/users`, superUser.token, {
        userIds: [user.id],
      });
      assert.equal(assigned.statusCode, 200, `assign: ${assigned.body}`);

      const priya = await login('priya@acme.test');
      // Replace, not layer: the memberType default set is NOT consulted.
      assert.deepEqual(priya.permissions, ['employees:read'],
        'custom role should replace the memberType defaults entirely');

      assert.equal((await call('GET', '/api/v1/employees', priya.token)).statusCode, 200);
      // attendance:read is an EMPLOYEE default, deliberately absent now.
      const denied = await call('GET', '/api/v1/attendance/records', priya.token);
      assert.equal(denied.statusCode, 403, 'memberType default leaked through a custom role');
    } finally {
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await call('DELETE', `/api/v1/settings/roles/${ROLE_KEY}`, superUser.token);
    }

    const restored = await login('priya@acme.test');
    assert.ok(restored.permissions.length > 1, 'defaults did not come back after unassignment');
    assert.ok(restored.permissions.includes('attendance:read'));
  });
});
