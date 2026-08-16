import { hasPermission } from '../auth/auth.policy.js';
import { errorResponse } from '../../utils/response.js';

const MANAGER_ALLOWED_PATHS = ['/api/v1/analytics/department-performance'];

/**
 * Gap E (BACKEND_CONTRACT_configurable_rbac.md): this previously hardcoded
 * ['HR_ADMIN','SUPER_ADMIN'] and never consulted `permissions[]`, so the
 * `analytics:read` key existed in the catalogue but was enforced nowhere --
 * granting or revoking it in Settings had no effect at all.
 *
 * Now driven by `analytics:read`. AUDITOR holds it by default (2026-07-26
 * decision), which is what the nav contract always promised.
 *
 * The department-performance carve-out for MANAGER is preserved: MANAGER holds
 * `analytics:read` for their own dashboard widgets, so the explicit path check
 * keeps every *other* analytics route closed to them exactly as before.
 */
export function requireAnalyticsPermission(request, reply, done) {
  const user = request.user || {};
  const path = request.url.split('?')[0];

  if (!hasPermission(user, 'analytics:read')) {
    reply.code(403).send(
      errorResponse(
        'FORBIDDEN',
        'Insufficient permissions for this action',
        { requiredPermission: 'analytics:read', userRole: user.memberType ?? null },
        request.id,
      ),
    );
    return;
  }

  if (user.memberType === 'MANAGER' && !MANAGER_ALLOWED_PATHS.includes(path)) {
    // This denial is NOT about a missing key -- the check above already passed,
    // so the caller holds `analytics:read`. It used to report
    // `requiredPermission: 'analytics:read'` anyway, which told the client to
    // grant a key that would change nothing; the frontend duly filed it as a
    // missing grant (NEW-1) and would have granted it and seen the same 403.
    // Report the real reason, and do not name a permission that cannot help.
    reply.code(403).send(
      errorResponse(
        'ROLE_RESTRICTED',
        'Analytics access restricted for this role',
        {
          userRole: user.memberType,
          reason: 'MANAGER analytics is limited to the team dashboard',
          allowedPaths: MANAGER_ALLOWED_PATHS,
        },
        request.id,
      ),
    );
    return;
  }

  done();
}
