/**
 * RBAC catalogue contract — offline guardrails for the permission migration.
 * Run: node --test tests/rbac-catalogue-contract.test.js
 *
 * Backs BACKEND_CONTRACT_configurable_rbac.md. These assertions are the safety
 * net for migrating ~260 `authorize([...])` calls to `requirePermission()`:
 * they pin the locked product decisions and the §4 guardrails so a later edit
 * to the default matrix cannot silently change who can reach what.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  PERMISSION_CATALOGUE,
  PERMISSION_KEYS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  hasPermission,
  requirePermission,
  isKnownPermission,
} from '../src/modules/auth/auth.policy.js';

const ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR'];

describe('permission catalogue shape', () => {
  it('every key is <module>:<action> and unique', () => {
    const seen = new Set();
    for (const key of PERMISSION_KEYS) {
      assert.match(key, /^[a-z]+:[a-z-]+$/, `malformed key: ${key}`);
      assert.equal(seen.has(key), false, `duplicate key: ${key}`);
      seen.add(key);
    }
  });

  it('every catalogue key sits under a module matching its prefix', () => {
    for (const [moduleName, group] of Object.entries(PERMISSION_CATALOGUE)) {
      for (const key of Object.keys(group)) {
        assert.equal(key.split(':')[0], moduleName, `${key} filed under ${moduleName}`);
      }
    }
  });

  it('every key has a non-empty human description', () => {
    for (const group of Object.values(PERMISSION_CATALOGUE)) {
      for (const [key, description] of Object.entries(group)) {
        assert.ok(description && description.length > 3, `${key} needs a description`);
      }
    }
  });

  it('every default grant refers to a real catalogue key', () => {
    for (const role of ROLES) {
      for (const key of DEFAULT_PERMISSIONS_BY_ROLE[role]) {
        assert.ok(PERMISSION_KEYS.includes(key), `${role} granted unknown key ${key}`);
      }
    }
  });

  it('requirePermission rejects unknown keys at registration time', () => {
    assert.throws(() => requirePermission('nope:invented'), /Unknown permission key/);
    assert.equal(isKnownPermission('employees:read'), true);
  });
});

describe('§4 guardrails', () => {
  it('SUPER_ADMIN holds every key in the catalogue', () => {
    assert.deepEqual(
      [...DEFAULT_PERMISSIONS_BY_ROLE.SUPER_ADMIN].sort(),
      [...PERMISSION_KEYS].sort(),
    );
  });

  it('SUPER_ADMIN bypasses hasPermission unconditionally, even with an empty token', () => {
    for (const key of PERMISSION_KEYS) {
      assert.equal(hasPermission({ memberType: 'SUPER_ADMIN', permissions: [] }, key), true);
    }
  });

  it('only SUPER_ADMIN holds permissions:manage by default', () => {
    for (const role of ROLES) {
      const holds = DEFAULT_PERMISSIONS_BY_ROLE[role].includes('permissions:manage');
      assert.equal(holds, role === 'SUPER_ADMIN', `${role} permissions:manage`);
    }
  });

  it('a token with grants does not silently inherit role defaults', () => {
    // Custom roles REPLACE memberType defaults (2026-07-26 decision).
    const user = { memberType: 'EMPLOYEE', permissions: ['leave:read'] };
    assert.equal(hasPermission(user, 'leave:read'), true);
    assert.equal(hasPermission(user, 'attendance:read'), false);
  });

  it('an empty token falls back to the role default matrix', () => {
    const user = { memberType: 'EMPLOYEE', permissions: [] };
    assert.equal(hasPermission(user, 'attendance:read'), true);
    assert.equal(hasPermission(user, 'payroll:admin'), false);
  });
});

describe('locked product decisions (2026-07-26)', () => {
  const auditor = DEFAULT_PERMISSIONS_BY_ROLE.AUDITOR;

  it('AUDITOR gets payroll self-service, timesheets read and analytics read', () => {
    assert.ok(auditor.includes('payroll:self-read'), 'Finding B');
    assert.ok(auditor.includes('timesheets:read'), 'Finding C');
    assert.ok(auditor.includes('analytics:read'), 'Finding E');
  });

  it('AUDITOR stays read-only — no write/approve/admin keys anywhere', () => {
    for (const key of auditor) {
      assert.doesNotMatch(key, /:(write|approve|delete|manage|admin|super)$/, `AUDITOR has ${key}`);
    }
  });

  it('AUDITOR keeps audit export (previously SUPER_ADMIN+AUDITOR only)', () => {
    assert.ok(auditor.includes('audit:export'));
    assert.equal(DEFAULT_PERMISSIONS_BY_ROLE.HR_ADMIN.includes('audit:export'), true);
    assert.equal(DEFAULT_PERMISSIONS_BY_ROLE.MANAGER.includes('audit:export'), false);
  });

  it('SUPER_ADMIN carve-outs are gone — SA holds settings and reports writes', () => {
    // Findings D + F: these were authorize(['HR_ADMIN']) only, excluding SA.
    for (const key of ['settings:tenant-write', 'reports:schedule']) {
      assert.ok(DEFAULT_PERMISSIONS_BY_ROLE.SUPER_ADMIN.includes(key), key);
      assert.ok(DEFAULT_PERMISSIONS_BY_ROLE.HR_ADMIN.includes(key), key);
    }
  });

  it('SUPER_ADMIN-only surfaces stay closed to HR_ADMIN', () => {
    for (const key of ['payroll:super', 'settings:security', 'permissions:manage']) {
      assert.equal(DEFAULT_PERMISSIONS_BY_ROLE.HR_ADMIN.includes(key), false, key);
    }
  });

  it('Gap D resolved — payroll, payout and timesheets self-service agree per role', () => {
    // These three disagreed on AUDITOR across three hand-copied local arrays.
    for (const role of ['MANAGER', 'EMPLOYEE', 'AUDITOR']) {
      const grants = DEFAULT_PERMISSIONS_BY_ROLE[role];
      assert.equal(grants.includes('payroll:self-read'), true, `${role} payroll:self-read`);
      assert.equal(grants.includes('payout:self'), true, `${role} payout:self`);
      assert.equal(grants.includes('timesheets:read'), true, `${role} timesheets:read`);
    }
  });
});

describe('no role loses access it had before the migration', () => {
  // The original 14-key matrix, verbatim from auth.policy.js before the
  // catalogue expansion. §3.2 is only behaviour-preserving if these survive.
  const LEGACY = {
    SUPER_ADMIN: ['employees:read', 'employees:write', 'employees:delete', 'employees:export',
      'departments:read', 'departments:write', 'attendance:read', 'attendance:write',
      'leave:read', 'leave:request', 'leave:approve', 'analytics:read', 'audit:read',
      'permissions:manage'],
    HR_ADMIN: ['employees:read', 'employees:write', 'employees:delete', 'employees:export',
      'departments:read', 'departments:write', 'attendance:read', 'attendance:write',
      'leave:read', 'leave:request', 'leave:approve', 'analytics:read', 'audit:read'],
    MANAGER: ['employees:read', 'departments:read', 'attendance:read', 'attendance:write',
      'leave:read', 'leave:request', 'leave:approve', 'analytics:read'],
    EMPLOYEE: ['employees:read', 'departments:read', 'attendance:read', 'attendance:write',
      'leave:read', 'leave:request'],
    AUDITOR: ['employees:read', 'departments:read', 'attendance:read', 'leave:read',
      'analytics:read', 'audit:read'],
  };

  /**
   * A documented substitution, not a loss. MANAGER's legacy `analytics:read`
   * never granted tenant-wide analytics: `analytics.policy.js` carried a MANAGER
   * path allowlist from the original policy, so the only analytics route MANAGER
   * could ever reach was department-performance. That allowlist is gone and the
   * same access is now expressed as `analytics:team-read`, so the ACCESS this
   * suite protects is unchanged while the key name is not.
   *
   * The allowlist is why the settings matrix showed Analytics ticked for a role
   * that 403'd on 8 of 9 routes (FE verification report, NEW-1).
   */
  const SUBSTITUTED = {
    MANAGER: { 'analytics:read': 'analytics:team-read' },
  };

  for (const [role, legacyKeys] of Object.entries(LEGACY)) {
    it(`${role} retains all ${legacyKeys.length} legacy grants`, () => {
      const current = DEFAULT_PERMISSIONS_BY_ROLE[role];
      for (const key of legacyKeys) {
        const replacement = SUBSTITUTED[role]?.[key];
        if (replacement) {
          assert.ok(
            current.includes(replacement),
            `${role} lost ${key} and did not gain its documented replacement ${replacement}`,
          );
          continue;
        }
        assert.ok(current.includes(key), `${role} lost ${key}`);
      }
    });
  }

  it('the MANAGER substitution preserves the one route it ever reached', async () => {
    // Guards the claim above: if department-performance stops accepting the
    // replacement key, this is a real access loss and must fail.
    const { requireAnalyticsPermission } = await import('../src/modules/analytics/analytics.policy.js');
    const manager = { memberType: 'MANAGER', permissions: [...DEFAULT_PERMISSIONS_BY_ROLE.MANAGER] };
    const run = (url) => new Promise((resolve) => {
      const request = { user: manager, url, id: 'r' };
      const reply = { code: () => ({ send: () => resolve(403) }) };
      requireAnalyticsPermission(request, reply, () => resolve(200));
    });
    assert.equal(await run('/api/v1/analytics/department-performance'), 200, 'MANAGER lost its team dashboard');
    assert.equal(await run('/api/v1/analytics/summary'), 403, 'MANAGER must not gain tenant-wide analytics');
  });
});

describe('route migration progress', () => {
  function routeFiles(dir) {
    const found = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) found.push(...routeFiles(full));
      else if (entry.endsWith('.routes.js')) found.push(full);
    }
    return found;
  }

  // §3.2 keeps `authorize()` as a coarse net for genuinely role-identity-bound
  // surfaces. Ops is the sanctioned example: platform support access is not
  // meant to be tenant-customizable, so it stays a hardcoded SUPER_ADMIN check.
  const ROLE_IDENTITY_BOUND = ['src/modules/ops/ops.routes.js'];

  it('no route file gates on a raw memberType string comparison', () => {
    const offenders = [];
    for (const file of routeFiles('src/modules')) {
      if (ROLE_IDENTITY_BOUND.includes(file)) continue;
      const source = readFileSync(file, 'utf8');
      if (/memberType\s*[=!]==?\s*['"]/.test(source)) offenders.push(file);
    }
    assert.deepEqual(offenders, [], 'route files must gate via permissions, not memberType');
  });

  it('no route file still calls authorize() with a hardcoded role array', () => {
    const offenders = [];
    for (const file of routeFiles('src/modules')) {
      if (ROLE_IDENTITY_BOUND.includes(file)) continue;
      const source = readFileSync(file, 'utf8');
      const calls = (source.match(/authorize\(/g) || []).length;
      if (calls > 0) offenders.push(`${file} (${calls})`);
    }
    assert.deepEqual(offenders, []);
  });

  // Controllers must not 403 on a raw memberType comparison either -- that was
  // Gap B's other half, and route-file-only checks missed logs/holidayResolved.
  // Scoping a query by role is fine; denying access by role is not.
  const IDENTITY_BOUND_CONTROLLERS = [
    // The manager dashboard is the manager's *own* view and needs their
    // employeeId; it is not a tenant-customizable surface.
    'src/modules/dashboard/manager.controller.js',
  ];

  function controllerFiles(dir) {
    const found = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) found.push(...controllerFiles(full));
      else if (entry.endsWith('.controller.js')) found.push(full);
    }
    return found;
  }

  it('no controller denies access with a hardcoded memberType check', () => {
    const offenders = [];
    for (const file of controllerFiles('src/modules')) {
      if (IDENTITY_BOUND_CONTROLLERS.includes(file)) continue;
      const source = readFileSync(file, 'utf8');
      // a memberType comparison within ~6 lines of a 403 reply
      const lines = source.split('\n');
      lines.forEach((line, index) => {
        if (!/memberType/.test(line)) return;
        if (!/includes\(|===|!==/.test(line)) return;
        const window = lines.slice(index, index + 6).join('\n');
        if (/code\(403\)/.test(window)) offenders.push(`${file}:${index + 1}`);
      });
    }
    assert.deepEqual(offenders, []);
  });

  it('every requirePermission call in route files uses a real catalogue key', () => {
    const bad = [];
    for (const file of routeFiles('src/modules')) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/requirePermission\(\s*'([^']+)'/g)) {
        if (!isKnownPermission(match[1])) bad.push(`${file}: ${match[1]}`);
      }
    }
    assert.deepEqual(bad, []);
  });
});
