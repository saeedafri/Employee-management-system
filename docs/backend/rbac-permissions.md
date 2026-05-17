# RBAC & Permissions

## Member Types

1. **SUPER_ADMIN**: Full access to everything
2. **HR_ADMIN**: HR operations + logs access
3. **MANAGER**: Team management + their own data
4. **EMPLOYEE**: Own data only
5. **AUDITOR**: Read-only audit logs

## Permissions (14 total)

- employees:read, write, delete, export
- departments:read, write
- attendance:read, write
- leave:read, request, approve
- analytics:read
- permissions:manage
- audit:read

## RBAC Check

Protected routes use middleware:
```javascript
if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType)) {
  return 403 FORBIDDEN
}
```

## Role-Permission Mapping

Stored in RolePermission join table:
- Role (id, name, key, tenantId)
- Permission (id, key, module, description)
- RolePermission (roleId, permissionId)

Loaded into JWT on login for fast checks.
