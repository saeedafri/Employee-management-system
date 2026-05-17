# Database Design

## 23 Models

Core:
- Tenant, User, Role, Permission, RolePermission

Auth:
- Session, PasswordResetToken, OtpChallenge, AuditLog

Employee:
- Employee, Department, LeaveRequest, LeaveType, LeaveBalance

Admin:
- LogEntry, Setting, Holiday, Notification, EmployeeDocument

Resignation, SavedView (future use)

## Key Relationships

- User → Tenant (multi-tenant)
- User → Role (many-to-many via UserRole)
- Role → Permission (many-to-many via RolePermission)
- Employee → User (one-to-one)
- Employee → Department (many-to-one)

## Indexes

Every table has:
- Primary key (id)
- Tenant index (tenantId)
- Compound unique: (tenantId, email) on User
- Compound unique: (tenantId, employeeCode) on Employee

Session token index (unique):
- refreshTokenHash (unique, fast lookup)

## Time Zones

- All timestamps: UTC (timestampUtc)
- Display: IST formatted (timestampIstDisplay)
- Application: ISO 8601 format
