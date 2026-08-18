/**
 * Route -> permission manifest, built from the real routing table.
 *
 * The frontend has to know that `/settings/integrations/email` needs
 * `settings:integrations`. Until now that fact only existed inside route files,
 * so their config held a hand-typed copy that drifted -- six settings panels sat
 * hidden from HR_ADMIN while the API answered 200 to every one of them. This
 * publishes the fact instead, so re-guarding a route updates their UI with no
 * frontend change.
 *
 * Collected via Fastify's `onRoute`, which fires per registered route, so the
 * manifest describes what is actually mounted rather than what a source parser
 * believes.
 *
 * ONE CAVEAT, and it is the whole reason `guardScope` exists: `onRoute` reports
 * only the hooks passed in a route's own options. A guard installed for a whole
 * module with `fastify.addHook('onRequest', guard)` is INVISIBLE to it -- every
 * /analytics/* route would be published as `permissions: []`, i.e. "open to
 * anyone signed in", which is the most dangerous wrong answer this file could
 * give. Verified against fastify directly, not assumed.
 */

/** "METHOD /path" -> { method, path, permissions:Set, authenticated, public } */
const routes = new Map();
let stamp = null;

const IGNORED_METHODS = new Set(['HEAD', 'OPTIONS']);

function entryFor(method, path) {
  const id = `${method} ${path}`;
  let entry = routes.get(id);
  if (!entry) {
    entry = { method, path, permissions: new Set(), roles: new Set(), authenticated: false };
    routes.set(id, entry);
  }
  return entry;
}

/** Merge one contribution. Called from several hooks per route, so order-independent. */
export function recordRouteGuards(method, path, { permissions = [], roles = [], authenticated = false } = {}) {
  if (IGNORED_METHODS.has(method)) return;
  const entry = entryFor(method, path);
  for (const key of permissions) entry.permissions.add(key);
  for (const role of roles) entry.roles.add(role);
  if (authenticated) entry.authenticated = true;
  stamp = null;
}

/** Read the keys a tagged guard enforces. Path-dependent guards answer per route. */
function keysFromHandler(handler, path) {
  if (typeof handler !== 'function') return [];
  if (typeof handler.permissionsFor === 'function') return handler.permissionsFor(path);
  return handler.permissions ?? [];
}

/**
 * Global `onRoute` hook. Covers every route whose guards are declared in its own
 * options -- inline `requirePermission(...)`, a file-local alias, or an array
 * alias like `const adminOnly = [authenticate, canManageIntegrations]`, since
 * Fastify has already flattened those into the hook arrays by this point.
 */
export function collectRouteGuards(route) {
  const handlers = [].concat(route.onRequest ?? [], route.preHandler ?? []).filter(Boolean);
  const permissions = handlers.flatMap((handler) => keysFromHandler(handler, route.url));
  const roles = handlers.flatMap((handler) => handler.roles ?? []);
  const authenticated = handlers.some((handler) => handler.isAuthGuard === true);

  for (const method of [].concat(route.method)) {
    recordRouteGuards(method, route.url, { permissions, roles, authenticated });
  }
}

/**
 * Install module-wide guards so they still reach the manifest.
 *
 * `fastify.addHook('onRequest', guard)` alone enforces correctly but publishes
 * nothing; this adds the same hooks AND a scope-local `onRoute` that stamps
 * every route registered in the scope. Enforcement is byte-identical -- same
 * functions, same order.
 */
export function guardScope(fastify, guards) {
  const list = [].concat(guards);
  for (const guard of list) fastify.addHook('onRequest', guard);

  fastify.addHook('onRoute', (route) => {
    const permissions = list.flatMap((guard) => keysFromHandler(guard, route.url));
    const roles = list.flatMap((guard) => guard.roles ?? []);
    const authenticated = list.some((guard) => guard.isAuthGuard === true);
    for (const method of [].concat(route.method)) {
      recordRouteGuards(method, route.url, { permissions, roles, authenticated });
    }
  });
}

/** What the manifest cannot express. An honest gap beats a silent one. */
const NOT_COVERED = Object.freeze([
  {
    kind: 'ownership',
    detail:
      'Routes serving one employee\'s own record (payroll salary/payslips/ytd/tax-declaration/'
      + 'loans/tax-form, employee documents and photo) additionally enforce self-or-'
      + '`employees:read-any` in the service. The key listed here is what a NON-owner needs; '
      + 'the owner reaches their own record without it.',
  },
  {
    kind: 'custom-guard',
    detail:
      '/ops/* accepts a shared OPS_LOGS_TOKEN or a SUPER_ADMIN JWT, and '
      + 'GET /notifications/stream authenticates from a `token` query param because EventSource '
      + 'cannot send headers. Neither is a permission key, so both publish an empty list.',
  },
]);

export function permissionManifest() {
  if (!stamp) stamp = new Date().toISOString();
  return {
    version: stamp,
    routes: [...routes.values()]
      .map((entry) => ({
        method: entry.method,
        path: entry.path,
        permissions: [...entry.permissions].sort(),
        // Only /manager/* uses this: its rule is "you are somebody's manager",
        // which is not a grantable capability. ANY-of, same as permissions, and
        // ANDed with them -- a caller must satisfy both lists where both exist.
        ...(entry.roles.size ? { roles: [...entry.roles].sort() } : {}),
        ...(entry.authenticated ? {} : { public: true }),
      }))
      .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)),
    notCovered: NOT_COVERED,
  };
}

/** Tests register a fresh app per file; without this they accumulate. */
export function resetPermissionManifest() {
  routes.clear();
  stamp = null;
}
