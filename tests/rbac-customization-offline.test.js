/**
 * The customization promise, proven without a database.
 * Run: node --test --experimental-test-module-mocks tests/rbac-customization-offline.test.js
 *
 * BACKEND_CONTRACT_configurable_rbac.md §0: "a tenant admin can regrant, restrict, or
 * invent a role's access from the Settings -> Roles & Permissions screen alone ... and
 * have it take effect everywhere in the product immediately."
 *
 * The live round trip (PATCH -> re-login -> route closes) lives in
 * rbac-customization-e2e.test.js and needs a real database. This file proves the same
 * chain against a stateful in-memory store, so the guarantee is covered in CI with no
 * infrastructure: the real `updateRolePermissions` writes, the real `resolvePermissions`
 * reads, and the real `hasPermission` decides.
 */
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PERMISSIONS_BY_ROLE,
  PERMISSION_KEYS,
  hasPermission,
} from '../src/modules/auth/auth.policy.js';

const TENANT_ID = 'tenant-1';

/**
 * Minimal stateful Prisma covering exactly what updateRolePermissions touches.
 * Stateful on purpose -- a stub that forgets writes cannot prove a revocation stuck.
 */
function makeStore() {
  const permissions = PERMISSION_KEYS.map((key, i) => ({ id: `perm-${i}`, key }));
  const roles = Object.keys(DEFAULT_PERMISSIONS_BY_ROLE).map((key, i) => ({
    id: `role-${i}`, key, tenantId: TENANT_ID, isSystem: true,
  }));
  const permissionByKey = new Map(permissions.map((p) => [p.key, p]));

  // Seed the default matrix as RolePermission rows.
  let rolePermissions = [];
  for (const role of roles) {
    for (const key of DEFAULT_PERMISSIONS_BY_ROLE[role.key]) {
      rolePermissions.push({ roleId: role.id, permissionId: permissionByKey.get(key).id });
    }
  }

  const prisma = {
    role: {
      findFirst: async ({ where }) => roles.find((r) => r.key === where.key) ?? null,
      findMany: async () => [...roles],
    },
    permission: {
      findMany: async ({ where }) => {
        const wanted = where?.key?.in;
        const rows = wanted ? permissions.filter((p) => wanted.includes(p.key)) : permissions;
        return rows.map((p) => ({ id: p.id, key: p.key }));
      },
    },
    rolePermission: {
      deleteMany: async ({ where }) => {
        const before = rolePermissions.length;
        rolePermissions = rolePermissions.filter((rp) => rp.roleId !== where.roleId);
        return { count: before - rolePermissions.length };
      },
      createMany: async ({ data }) => {
        rolePermissions.push(...data);
        return { count: data.length };
      },
      findMany: async ({ where }) => rolePermissions.filter((rp) => rp.roleId === where.roleId),
      count: async ({ where }) => rolePermissions.filter((rp) => rp.roleId === where.roleId).length,
    },
  };

  /** Build the user shape the login path produces, from current stored grants. */
  const userWithRole = (roleKey, memberType) => {
    const role = roles.find((r) => r.key === roleKey);
    const idToKey = new Map(permissions.map((p) => [p.id, p.key]));
    return {
      memberType,
      userRoles: [{
        role: {
          key: roleKey,
          permissions: rolePermissions
            .filter((rp) => rp.roleId === role.id)
            .map((rp) => ({ permission: { key: idToKey.get(rp.permissionId) } })),
        },
      }],
    };
  };

  return { prisma, roles, permissions, userWithRole };
}

let store;
let updateRolePermissions;
let resolvePermissions;

before(async () => {
  store = makeStore();
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: store.prisma },
    defaultExport: async () => {},
  });
  ({ updateRolePermissions } = await import('../src/modules/settings/settings.repository.js'));
  ({ resolvePermissions } = await import('../src/modules/auth/auth.service.js'));
});

describe('revoking a key through the settings repository closes the route', () => {
  it('the revoked key stops being resolved for that role', async () => {
    const before = store.userWithRole('HR_ADMIN', 'HR_ADMIN');
    const beforePerms = resolvePermissions(before);
    assert.ok(beforePerms.includes('assets:manage'), 'baseline grant missing');
    assert.equal(hasPermission({ ...before, permissions: beforePerms }, 'assets:manage'), true);

    // Exactly what PATCH /settings/roles-permissions calls.
    const kept = DEFAULT_PERMISSIONS_BY_ROLE.HR_ADMIN.filter((k) => k !== 'assets:manage');
    await updateRolePermissions(TENANT_ID, 'HR_ADMIN', kept);

    const after = store.userWithRole('HR_ADMIN', 'HR_ADMIN');
    const afterPerms = resolvePermissions(after);
    assert.equal(afterPerms.includes('assets:manage'), false, 'revoked key still resolved');
    assert.equal(hasPermission({ ...after, permissions: afterPerms }, 'assets:manage'), false,
      'route would stay open after revocation');

    // Nothing else moved.
    assert.equal(afterPerms.length, kept.length);
    assert.equal(hasPermission({ ...after, permissions: afterPerms }, 'employees:read'), true);
  });

  it('restoring the key re-opens it', async () => {
    await updateRolePermissions(TENANT_ID, 'HR_ADMIN', [...DEFAULT_PERMISSIONS_BY_ROLE.HR_ADMIN]);
    const user = store.userWithRole('HR_ADMIN', 'HR_ADMIN');
    const perms = resolvePermissions(user);
    assert.ok(perms.includes('assets:manage'), 'restore did not re-grant');
    assert.equal(hasPermission({ ...user, permissions: perms }, 'assets:manage'), true);
  });

  it('granting a key a role never had opens it', async () => {
    const baseline = store.userWithRole('EMPLOYEE', 'EMPLOYEE');
    assert.equal(resolvePermissions(baseline).includes('assets:manage'), false);

    await updateRolePermissions(TENANT_ID, 'EMPLOYEE',
      [...DEFAULT_PERMISSIONS_BY_ROLE.EMPLOYEE, 'assets:manage']);

    const user = store.userWithRole('EMPLOYEE', 'EMPLOYEE');
    const perms = resolvePermissions(user);
    assert.ok(perms.includes('assets:manage'), 'grant not resolved');
    assert.equal(hasPermission({ ...user, permissions: perms }, 'assets:manage'), true);

    await updateRolePermissions(TENANT_ID, 'EMPLOYEE', [...DEFAULT_PERMISSIONS_BY_ROLE.EMPLOYEE]);
    assert.equal(resolvePermissions(store.userWithRole('EMPLOYEE', 'EMPLOYEE'))
      .includes('assets:manage'), false, 'restore leaked a grant');
  });

  it('revoking everything from a role denies everything -- except for SUPER_ADMIN', async () => {
    await updateRolePermissions(TENANT_ID, 'MANAGER', []);
    const manager = store.userWithRole('MANAGER', 'MANAGER');
    // Empty explicit grants fall back to the memberType default matrix by design
    // (roleDefaultPermissions), so a wipe restores defaults rather than locking out.
    const perms = resolvePermissions(manager);
    assert.deepEqual(perms, [...DEFAULT_PERMISSIONS_BY_ROLE.MANAGER],
      'an empty grant set should fall back to the role defaults, not lock the role out');

    // SUPER_ADMIN is unconditional regardless of stored grants.
    await updateRolePermissions(TENANT_ID, 'SUPER_ADMIN', []);
    for (const key of PERMISSION_KEYS) {
      assert.equal(hasPermission({ memberType: 'SUPER_ADMIN', permissions: [] }, key), true, key);
    }

    await updateRolePermissions(TENANT_ID, 'MANAGER', [...DEFAULT_PERMISSIONS_BY_ROLE.MANAGER]);
    await updateRolePermissions(TENANT_ID, 'SUPER_ADMIN', [...DEFAULT_PERMISSIONS_BY_ROLE.SUPER_ADMIN]);
  });
});

describe('custom roles replace memberType defaults', () => {
  it('a single narrow grant becomes the user\'s entire permission set', () => {
    // The shape a user assigned a tenant custom role arrives in.
    const user = {
      memberType: 'EMPLOYEE',
      userRoles: [{ role: { key: 'readonly', permissions: [{ permission: { key: 'employees:read' } }] } }],
    };
    const perms = resolvePermissions(user);
    assert.deepEqual(perms, ['employees:read'], 'custom role must replace, not layer');

    assert.equal(hasPermission({ ...user, permissions: perms }, 'employees:read'), true);
    // attendance:read is an EMPLOYEE default and must NOT leak through.
    assert.equal(hasPermission({ ...user, permissions: perms }, 'attendance:read'), false);
  });

  it('grants from multiple assigned roles union together', () => {
    const user = {
      memberType: 'EMPLOYEE',
      userRoles: [
        { role: { key: 'a', permissions: [{ permission: { key: 'employees:read' } }] } },
        { role: { key: 'b', permissions: [{ permission: { key: 'assets:manage' } }] } },
      ],
    };
    assert.deepEqual(resolvePermissions(user).sort(), ['assets:manage', 'employees:read']);
  });

  it('no assigned roles falls back to the memberType defaults', () => {
    const user = { memberType: 'AUDITOR', userRoles: [] };
    assert.deepEqual(resolvePermissions(user), [...DEFAULT_PERMISSIONS_BY_ROLE.AUDITOR]);
  });
});
