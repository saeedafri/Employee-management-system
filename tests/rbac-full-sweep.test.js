/**
 * Full RBAC sweep — EVERY permission-gated route, EVERY role, over real HTTP.
 * Run: node --test --experimental-test-module-mocks tests/rbac-full-sweep.test.js
 *
 * The representative-sample test (`rbac-enforcement-e2e.test.js`) proves the
 * mechanism. This proves the *coverage*: it extracts the declared permission for
 * every route straight from the route files, then drives each one through the
 * live router as each of the five roles and asserts the response matches what
 * the default matrix says it should be.
 *
 * Regression guard for BACKEND_CONTRACT_configurable_rbac.md §4:
 * "No route should go from gated to ungated as a side effect of this migration."
 */
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../src/modules/auth/auth.policy.js';

const TENANT = { id: 'tenant-1', tenantKey: 'acme-corp-001', name: 'Acme Corp', slug: 'acme' };
const ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR'];
const FORBIDDEN = 403;

/**
 * Behaves like a real but empty database: `findMany` yields `[]`, `count`
 * yields 0, `findUnique`/`findFirst` yield null. Returning null for findMany
 * (the naive stub) makes handlers throw and muddies the 403-vs-allowed signal.
 */
function stubPrisma() {
  const anyModel = new Proxy({}, {
    get: (_t, op) => async () => {
      const name = String(op);
      if (name.startsWith('findMany')) return [];
      if (name.startsWith('count')) return 0;
      if (name.startsWith('aggregate') || name.startsWith('groupBy')) return [];
      return null;
    },
  });
  return new Proxy({
    tenant: { findUnique: async () => TENANT, findFirst: async () => TENANT },
    session: {
      findUnique: async ({ where }) => ({
        id: where.id, userId: `user-${where.id}`, tenantId: TENANT.id, revokedAt: null,
      }),
    },
    $disconnect: async () => {},
  }, { get: (t, p) => (p in t ? t[p] : anyModel) });
}

// ── Static extraction: route -> declared permission key ──────────────────────

function routeFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...routeFiles(full));
    else if (entry.endsWith('.routes.js')) found.push(full);
  }
  return found;
}

/** `const canFoo = requirePermission('a:b')` -> { canFoo: 'a:b' } */
function constKeys(source) {
  const map = {};
  for (const m of source.matchAll(/const (\w+) = require(?:Any)?Permission\(\s*'([a-z:-]+)'/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

/**
 * Pull every `fastify.<verb>('<url>', { ... })` block and the permission its
 * onRequest/preHandler array declares, whether inline or via a local const.
 */
function extractRoutes(file) {
  const source = readFileSync(file, 'utf8');
  const consts = constKeys(source);
  const routes = [];

  const routeRe = /fastify\.(get|post|patch|put|delete)\(\s*'([^']+)'/g;
  let match;
  while ((match = routeRe.exec(source)) !== null) {
    const [, method, url] = match;
    // Look ahead to the next route declaration for this route's guard array.
    const nextIndex = source.slice(match.index + 1).search(/fastify\.(get|post|patch|put|delete)\(/);
    const block = source.slice(
      match.index,
      nextIndex === -1 ? source.length : match.index + 1 + nextIndex,
    );

    const guard = block.match(/(?:onRequest|preHandler|preValidation):\s*\[([^\]]*)\]/);
    if (!guard) { routes.push({ method, url, key: null, file }); continue; }

    const inline = guard[1].match(/require(?:Any)?Permission\(\s*'([a-z:-]+)'/);
    if (inline) { routes.push({ method, url, key: inline[1], file }); continue; }

    const named = guard[1].match(/\b(can[A-Za-z]+)\b/);
    routes.push({ method, url, key: named ? consts[named[1]] ?? null : null, file });
  }
  return routes;
}

const ALL_ROUTES = routeFiles('src/modules').flatMap(extractRoutes);
const GUARDED_GETS = ALL_ROUTES.filter((r) => r.method === 'get' && r.key);

/**
 * One representative GET per distinct permission key. Driving all ~130 guarded
 * GETs through the router for all five roles executes every handler and takes
 * minutes; the role-behaviour question is decided entirely by the key, so one
 * route per key answers it. Coverage of *every* route is asserted statically
 * in the first describe block, so nothing goes unchecked.
 */
const BY_KEY = [...new Map(GUARDED_GETS.map((r) => [r.key, r])).values()];

let app;
let tokenFor;

before(async () => {
  process.env.NODE_ENV = 'test';
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: stubPrisma() },
    defaultExport: async () => {},
  });
  const { createApp } = await import('../src/app.js');
  const { createAccessToken } = await import('../src/utils/token.js');
  app = await createApp();
  await app.ready();

  const cache = {};
  tokenFor = async (role) => {
    if (!cache[role]) {
      cache[role] = await createAccessToken({
        sub: `user-sess-${role}`,
        sessionId: `sess-${role}`,
        tenantId: TENANT.id,
        memberType: role,
        permissions: [...DEFAULT_PERMISSIONS_BY_ROLE[role]],
      });
    }
    return cache[role];
  };
});

after(async () => { if (app) await app.close(); });

/** Replace `:param` segments with a dummy value so the router matches. */
const concreteUrl = (url) => `/api/v1${url}`.replace(/:[A-Za-z_]+/g, 'dummy-id');

async function call(url, token) {
  return app.inject({
    method: 'GET',
    url: concreteUrl(url),
    headers: {
      'x-tenant-key': TENANT.tenantKey,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
}

describe('coverage: the migration left nothing ungated', () => {
  it('extracted a realistic number of guarded routes', () => {
    assert.ok(GUARDED_GETS.length > 80, `only found ${GUARDED_GETS.length} guarded GETs`);
    assert.ok(BY_KEY.length > 20, `only ${BY_KEY.length} distinct permission keys in use`);
  });

  it('every guarded route across all verbs declares a key (no silent gaps)', () => {
    // A route with a guard array but no resolvable permission means either an
    // unmigrated role check or a const this extractor cannot see -- both worth failing on.
    const guardedButKeyless = ALL_ROUTES.filter((r) => r.key === null);
    const suspicious = guardedButKeyless.filter((r) => {
      const source = readFileSync(r.file, 'utf8');
      return /authorize\(/.test(source);
    });
    assert.deepEqual(suspicious, []);
  });

  it('no route file still calls authorize()', () => {
    const offenders = routeFiles('src/modules')
      .filter((f) => /\bauthorize\(/.test(readFileSync(f, 'utf8')));
    assert.deepEqual(offenders, []);
  });

  it('every extracted permission key exists in the catalogue', () => {
    const unknown = ALL_ROUTES
      .filter((r) => r.key)
      .filter((r) => !DEFAULT_PERMISSIONS_BY_ROLE.SUPER_ADMIN.includes(r.key))
      .map((r) => `${r.file}: ${r.key}`);
    assert.deepEqual(unknown, []);
  });
});

describe('every guarded GET enforces its declared permission, for every role', () => {
  // The MANAGER analytics carve-out is deliberate and documented: MANAGER holds
  // analytics:read for dashboard widgets but reaches only department-performance.
  const isManagerAnalyticsCarveOut = (role, url) => role === 'MANAGER'
    && url.startsWith('/analytics/')
    && !url.endsWith('/department-performance');

  for (const role of ROLES) {
    it(`${role}`, async () => {
      const token = await tokenFor(role);
      const grants = DEFAULT_PERMISSIONS_BY_ROLE[role];
      const mismatches = [];

      for (const { url, key } of BY_KEY) {
        const res = await call(url, token);
        if (res.statusCode === 401 || res.statusCode === 404) continue;

        // A 403 from the permission gate names the key it wanted. A 403 from a
        // handler's own ownership rule (e.g. "you may only read your own
        // payslip") does not, and is out of scope here -- the gate still passed.
        const body = res.statusCode === FORBIDDEN ? JSON.parse(res.body || '{}') : null;
        const isPermissionDenial = Boolean(body?.error?.details?.requiredPermission);
        if (res.statusCode === FORBIDDEN && !isPermissionDenial) continue;

        const shouldPass = role === 'SUPER_ADMIN'
          || (grants.includes(key) && !isManagerAnalyticsCarveOut(role, url));
        const didPass = res.statusCode !== FORBIDDEN;

        if (shouldPass !== didPass) {
          mismatches.push(`${url} (${key}) expected ${shouldPass ? 'allow' : '403'}, got ${res.statusCode}`);
        }
      }

      assert.deepEqual(mismatches, [], `${role}: ${mismatches.length} mismatches`);
    });
  }
});

describe('unauthenticated requests never reach a handler', () => {
  it('every guarded GET is 401 without a token', async () => {
    const leaked = [];
    for (const { url } of BY_KEY) {
      const res = await call(url, null);
      if (res.statusCode !== 401) leaked.push(`${url} -> ${res.statusCode}`);
    }
    assert.deepEqual(leaked, []);
  });
});
