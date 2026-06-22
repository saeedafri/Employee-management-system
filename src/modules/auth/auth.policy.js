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

export function hasPermission(user, permission) {
  if (!user || !permission) return false;
  if (user.memberType === 'SUPER_ADMIN') return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
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
