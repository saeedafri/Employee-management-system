import { errorResponse } from '../../utils/response.js';

export const PERMISSION_KEYS = Object.freeze([
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

/**
 * Canonical default grants per memberType. Must stay in sync with
 * auth.service resolvePermissions / RolePermission seed.
 * Day-1 behavior matches historical UI gates.
 */
export const DEFAULT_PERMISSIONS_BY_ROLE = Object.freeze({
  SUPER_ADMIN: Object.freeze([
    'employees:read', 'employees:write', 'employees:delete', 'employees:export',
    'departments:read', 'departments:write', 'attendance:read', 'attendance:write',
    'leave:read', 'leave:request', 'leave:approve', 'analytics:read', 'audit:read',
    'permissions:manage',
  ]),
  HR_ADMIN: Object.freeze([
    'employees:read', 'employees:write', 'employees:delete', 'employees:export',
    'departments:read', 'departments:write', 'attendance:read', 'attendance:write',
    'leave:read', 'leave:request', 'leave:approve', 'analytics:read', 'audit:read',
  ]),
  MANAGER: Object.freeze([
    'employees:read', 'departments:read', 'attendance:read', 'attendance:write',
    'leave:read', 'leave:request', 'leave:approve', 'analytics:read',
  ]),
  EMPLOYEE: Object.freeze([
    'employees:read', 'departments:read', 'attendance:read', 'attendance:write',
    'leave:read', 'leave:request',
  ]),
  AUDITOR: Object.freeze([
    'employees:read', 'departments:read', 'attendance:read', 'leave:read',
    'analytics:read', 'audit:read',
  ]),
});

export function roleDefaultPermissions(memberType) {
  return DEFAULT_PERMISSIONS_BY_ROLE[memberType] ?? [];
}

export function hasPermission(user, permission) {
  if (!user || !permission) return false;
  if (user.memberType === 'SUPER_ADMIN') return true;

  const fromToken = Array.isArray(user.permissions) ? user.permissions : [];
  if (fromToken.includes(permission)) return true;

  // Fallback for tokens minted before RolePermission seed / empty grants:
  // match historical default matrix so we never lock out day-1 roles.
  if (fromToken.length === 0) {
    return roleDefaultPermissions(user.memberType).includes(permission);
  }

  return false;
}

export function requirePermission(permission) {
  if (!PERMISSION_KEYS.includes(permission)) {
    throw new Error(`Unknown permission key: ${permission}`);
  }

  return async function permissionPreHandler(request, reply) {
    if (hasPermission(request.user, permission)) return;

    return reply.code(403).send(
      errorResponse(
        'FORBIDDEN',
        'Insufficient permissions for this action',
        { requiredPermission: permission, userRole: request.user?.memberType ?? null },
        request.id,
      ),
    );
  };
}

export function canManageUser(user, targetUserId) {
  if (user.memberType === 'SUPER_ADMIN') {
    return true;
  }

  return user.sub === targetUserId;
}
