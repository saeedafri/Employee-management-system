import { errorResponse } from '../../utils/response.js';
import {
  PERMISSION_CATALOGUE,
  PERMISSION_KEYS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  roleDefaultPermissions,
  permissionDescription,
  permissionModule,
} from './permissionCatalogue.js';

export {
  PERMISSION_CATALOGUE,
  PERMISSION_KEYS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  roleDefaultPermissions,
  permissionDescription,
  permissionModule,
};

/**
 * Keys discovered in the `Permission` table at boot, on top of the static
 * catalogue. Lets a tenant-authored permission be enforced without a redeploy,
 * per BACKEND_CONTRACT_configurable_rbac.md 3.1.
 */
const runtimePermissionKeys = new Set();

export function registerPermissionKeys(keys = []) {
  for (const key of keys) {
    if (typeof key === 'string' && key.includes(':')) runtimePermissionKeys.add(key);
  }
}

export function isKnownPermission(key) {
  return PERMISSION_KEYS.includes(key) || runtimePermissionKeys.has(key);
}

export function knownPermissionKeys() {
  return [...new Set([...PERMISSION_KEYS, ...runtimePermissionKeys])].sort();
}

export function hasPermission(user, permission) {
  if (!user || !permission) return false;
  if (user.memberType === 'SUPER_ADMIN') return true;

  const fromToken = Array.isArray(user.permissions) ? user.permissions : [];
  if (fromToken.includes(permission)) return true;

  // Fallback for tokens minted before RolePermission seed / empty grants:
  // match the default matrix so we never lock out day-1 roles.
  if (fromToken.length === 0) {
    return roleDefaultPermissions(user.memberType).includes(permission);
  }

  return false;
}

export function requirePermission(permission) {
  // Unknown keys are a wiring mistake, but the catalogue is data now, so this
  // only guards against typos in route files at registration time.
  if (!isKnownPermission(permission)) {
    throw new Error(`Unknown permission key: ${permission}`);
  }

  const permissionPreHandler = async function permissionPreHandler(request, reply) {
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

  // Read by the route manifest. Labels the guard; changes nothing it does.
  permissionPreHandler.permissions = [permission];
  return permissionPreHandler;
}

/**
 * Passes when the user holds ANY of the given keys. Used where one route serves
 * both a self-service and an admin audience (e.g. a list endpoint that scopes
 * its own rows by role).
 */
export function requireAnyPermission(...permissions) {
  for (const permission of permissions) {
    if (!isKnownPermission(permission)) {
      throw new Error(`Unknown permission key: ${permission}`);
    }
  }

  const anyPermissionPreHandler = async function anyPermissionPreHandler(request, reply) {
    if (permissions.some((permission) => hasPermission(request.user, permission))) return;

    return reply.code(403).send(
      errorResponse(
        'FORBIDDEN',
        'Insufficient permissions for this action',
        { requiredPermission: permissions, userRole: request.user?.memberType ?? null },
        request.id,
      ),
    );
  };

  anyPermissionPreHandler.permissions = permissions;
  return anyPermissionPreHandler;
}

/**
 * Self-or-admin access to an employee's own record, documents and photo.
 * Everyone may reach their own; `employees:read-any` reaches anyone else's.
 * Lives here rather than being repeated per controller.
 */
export function canAccessEmployeeRecord(user, employeeId) {
  if (!user) return false;
  if (user.employeeId && user.employeeId === employeeId) return true;
  return hasPermission(user, 'employees:read-any');
}

export function canManageUser(user, targetUserId) {
  if (user.memberType === 'SUPER_ADMIN') {
    return true;
  }

  return user.sub === targetUserId;
}

/**
 * Gate on memberType rather than a capability key.
 *
 * Used only by the manager dashboard, whose rule is genuinely "you are somebody's
 * manager" rather than a permission anyone can be granted. It lives here, tagged,
 * instead of inside five controllers, so the route manifest can publish it -- a
 * check the manifest cannot see is a check the frontend will contradict.
 */
export function requireMemberType(memberTypes, message) {
  const memberTypePreHandler = async function memberTypePreHandler(request, reply) {
    if (memberTypes.includes(request.user?.memberType)) return;
    return reply.code(403).send(errorResponse('FORBIDDEN', message, {}, request.id));
  };

  memberTypePreHandler.roles = [...memberTypes];
  return memberTypePreHandler;
}
