import { hasPermission } from '../auth/auth.policy.js';
import { errorResponse } from '../../utils/response.js';

/**
 * Analytics access is now expressed entirely in permission keys.
 *
 * It used to be `analytics:read` plus a hardcoded MANAGER path allowlist, which
 * meant the settings matrix showed Analytics ticked for MANAGER while every
 * analytics route but one returned 403 -- and the 403 named `analytics:read`, a
 * key the caller already held and which could not help. The frontend read that
 * as a missing grant (report NEW-1); granting it would have changed nothing.
 *
 *   analytics:read       tenant-wide dashboards (HR_ADMIN, SUPER_ADMIN, AUDITOR)
 *   analytics:team-read  the manager's department-performance dashboard
 *
 * A role's keys now predict its access exactly, so the permissions screen and
 * the API can no longer disagree.
 */
/**
 * Route -> the keys that satisfy it. This is a route/permission mapping, which is
 * ordinary; what it replaces was a role/path allowlist, which is what made a
 * role's key list stop predicting its access.
 */
const TEAM_SCOPED_PATHS = new Set(['/api/v1/analytics/department-performance']);

export function requireAnalyticsPermission(request, reply, done) {
  const path = request.url.split('?')[0];
  const keys = TEAM_SCOPED_PATHS.has(path)
    ? ['analytics:read', 'analytics:team-read']
    : ['analytics:read'];
  return denyUnless(request, reply, done, keys);
}

/**
 * The per-route answer, not the union. Publishing the union here would tell the
 * frontend MANAGER can reach all nine analytics routes; they can reach one, and
 * a nav item that 403s is a bug they have already shipped once.
 */
requireAnalyticsPermission.permissionsFor = (path) =>
  (TEAM_SCOPED_PATHS.has(path) ? ['analytics:read', 'analytics:team-read'] : ['analytics:read']);

// Union, for any consumer that cannot ask per path.
requireAnalyticsPermission.permissions = ['analytics:read', 'analytics:team-read'];

function denyUnless(request, reply, done, keys) {
  const user = request.user || {};
  if (keys.some((key) => hasPermission(user, key))) {
    done();
    return;
  }
  reply.code(403).send(
    errorResponse(
      'FORBIDDEN',
      'Insufficient permissions for this action',
      {
        requiredPermission: keys.length === 1 ? keys[0] : keys,
        userRole: user.memberType ?? null,
      },
      request.id,
    ),
  );
}
