# Entity Relationship Diagram (ERD)

## Core Entities

```
Tenant (1) ---> (*) User
           ---> (*) Role
           ---> (*) Permission
           ---> (*) Session
           ---> (*) LogEntry
           ---> (*) AuditLog

User (1) ----> (*) Session
      ---> (*) AuditLog
      ---> (1) Employee

Role (*) <---> (*) Permission (via RolePermission)
    (*) <---> (*) User (via UserRole)

Employee (1) ---> (1) Department
         ---> (*) LeaveRequest
         ---> (*) EmployeeDocument

Department (1) ---> (*) Employee

LeaveType (1) ---> (*) LeaveRequest
          (1) ---> (*) LeaveBalance
```

## Key Properties

**User**: email, passwordHash, memberType, status, tenantId (unique per tenant)
**Session**: userId, refreshTokenHash (unique), sessionFamilyId, ipAddress, expiresAt, revokedAt
**LogEntry**: tenantId, userId, level, module, message, requestId, metadata
**AuditLog**: tenantId, actorUserId, action, entityType, entityId, ipAddress
**Employee**: userId, employeeCode, firstName, lastName, designation, departmentId
