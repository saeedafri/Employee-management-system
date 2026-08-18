/**
 * The route -> permission manifest the frontend consumes.
 *
 * These assertions are the frontend's own spot-checks (BACKEND_REQUEST §2.4) plus
 * the edge cases they asked to be handled explicitly (§2.5). The one that earns
 * its keep is `/analytics/summary`: those routes are guarded by a module-wide
 * `addHook`, which Fastify's `onRoute` cannot see, so a naive collector publishes
 * them as `[]` -- "open to anyone signed in".
 *
 * Run: node --test --experimental-test-module-mocks tests/permission-manifest.test.js
 */
import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSION_KEYS } from '../src/modules/auth/permissionCatalogue.js';

let manifest;
const find = (method, path) => manifest.routes.find((r) => r.method === method && r.path === path);

before(async () => {
  process.env.NODE_ENV = 'test';
  mock.module('../src/plugins/prisma.js', {
    namedExports: { prisma: new Proxy({}, { get: () => new Proxy({}, { get: () => async () => null }) }) },
    defaultExport: async () => {},
  });
  const { createApp } = await import('../src/app.js');
  const app = await createApp();
  await app.ready();
  const { permissionManifest } = await import('../src/modules/auth/permissionManifest.js');
  manifest = permissionManifest();
  await app.close();
});

describe('manifest shape', () => {
  it('carries a version and a route list', () => {
    assert.ok(manifest.version, 'version must change when the map changes');
    assert.ok(manifest.routes.length > 300, `only ${manifest.routes.length} routes collected`);
  });

  it('names only keys that exist in the catalogue', () => {
    const known = new Set(PERMISSION_KEYS);
    const unknown = [...new Set(manifest.routes.flatMap((r) => r.permissions))].filter((k) => !known.has(k));
    assert.deepEqual(unknown, [], `manifest names keys the catalogue does not define: ${unknown}`);
  });

  it('emits one row per method, never HEAD', () => {
    assert.ok(!manifest.routes.some((r) => r.method === 'HEAD'));
  });
});

describe('the frontend spot-checks', () => {
  it('GET /settings/integrations/email needs settings:integrations', () => {
    assert.deepEqual(find('GET', '/api/v1/settings/integrations/email').permissions, ['settings:integrations']);
  });

  it('GET /analytics/department-performance accepts either analytics key', () => {
    assert.deepEqual(
      find('GET', '/api/v1/analytics/department-performance').permissions,
      ['analytics:read', 'analytics:team-read'],
    );
  });

  it('GET /holidays is authenticated with no key, and is not marked public', () => {
    const row = find('GET', '/api/v1/holidays');
    assert.deepEqual(row.permissions, []);
    assert.ok(!row.public, 'an authenticate-only route must not read as public');
  });
});

describe('the edge cases they asked about', () => {
  it('§2.5.1 resolves a file-local alias', () => {
    assert.deepEqual(find('GET', '/api/v1/settings/tenant').permissions, ['settings:manage']);
  });

  it('§2.5.2 resolves an array alias (adminOnly = [authenticate, canManageIntegrations])', () => {
    assert.deepEqual(find('GET', '/api/v1/settings/webhooks').permissions, ['settings:integrations']);
  });

  it('§2.5.3 a module-wide hook still reaches the manifest', () => {
    const row = find('GET', '/api/v1/analytics/summary');
    assert.notDeepEqual(row.permissions, [], 'analytics routes must never publish as unguarded');
    assert.ok(row.permissions.includes('analytics:read'));
  });

  it('§2.5.4 a path-dependent guard answers per route, not as a union', () => {
    assert.deepEqual(
      find('GET', '/api/v1/analytics/summary').permissions,
      ['analytics:read'],
      'the union here would claim MANAGER can reach every analytics route',
    );
  });

  it('§2.5.6 a genuinely public route is flagged', () => {
    assert.equal(find('POST', '/api/v1/auth/login').public, true);
  });

  it('§2.5.7 methods on one path are not collapsed', () => {
    assert.deepEqual(find('GET', '/api/v1/settings/branding').permissions, []);
    assert.deepEqual(find('PATCH', '/api/v1/settings/branding').permissions, ['settings:manage']);
  });

  it('states what it cannot express instead of staying silent', () => {
    assert.ok(manifest.notCovered.some((n) => n.kind === 'ownership'));
    assert.ok(manifest.notCovered.some((n) => n.kind === 'custom-guard'));
  });
});

describe('guards that live below the route layer', () => {
  it('/logs publishes logs:read rather than reading as unguarded', () => {
    assert.deepEqual(find('GET', '/api/v1/logs').permissions, ['logs:read']);
  });

  it('/manager/* publishes its memberType rule', () => {
    const row = find('GET', '/api/v1/manager/dashboard');
    assert.deepEqual(row.roles, ['MANAGER']);
    assert.ok(!row.public);
  });
});
