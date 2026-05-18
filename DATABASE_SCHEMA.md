# EMS Database Schema Documentation

**Database**: MySQL 8.0+  
**ORM**: Prisma  
**Schema File**: `prisma/schema.prisma`  

---

## Table of Contents

1. [Core Models](#core-models)
2. [Authentication Models](#authentication-models)
3. [Employee Models](#employee-models)
4. [Leave Models](#leave-models)
5. [Attendance Models](#attendance-models)
6. [Organizational Models](#organizational-models)
7. [Audit & Export Models](#audit--export-models)
8. [Relationships Diagram](#relationships-diagram)

---

## Core Models

### Tenant

Multi-tenant support - each organization is a separate tenant.

```prisma
model Tenant {
  id                    String    @id @default(cuid())
  tenantKey             String    @unique
  name                  String
  legalName             String
  displayName           String
  country               String
  primaryContactEmail   String
  
  // Relationships
  users                 User[]
  employees             Employee[]
  departments           Department[]
  leaveTypes            LeaveType[]
  holidays              Holiday[]
  leaveRequests         LeaveRequest[]
  attendanceRecords     AttendanceRecord[]
  auditLogs             AuditLog[]
  roles                 Role[]
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

**Indexes**: `tenantKey` (unique)  
**Purpose**: Isolate data per customer

---

## Authentication Models

### User

Core user account model.

```prisma
model User {
  id                    String    @id @default(cuid())
  tenantId              String
  email                 String
  passwordHash          String
  memberType            String    // SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE, AUDITOR
  status                String    @default("ACTIVE")  // ACTIVE, LOCKED, DISABLED
  mfaEnabled            Boolean   @default(false)
  lastLoginAt           DateTime?
  
  // Relationships
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userRoles             UserRole[]
  sessions              Session[]
  otpChallenges         OtpChallenge[]
  passwordResetTokens   PasswordResetToken[]
  employee              Employee?
  auditLogs             AuditLog[]  // Actor of audit actions
  
  @@unique([tenantId, email])
  @@index([tenantId])
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

**Indexes**: `tenantId + email` (unique)  
**Purpose**: User authentication & authorization  
**Enum Values**: `memberType` = SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | AUDITOR

### Session

JWT session management with refresh token rotation.

```prisma
model Session {
  id                    String    @id @default(cuid())
  userId                String
  tenantId              String
  sessionFamilyId       String    // For rotation tracking
  refreshTokenHash      String
  ipAddress             String
  userAgent             String
  isRevoked             Boolean   @default(false)
  
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([tenantId])
  @@index([sessionFamilyId])
  createdAt             DateTime  @default(now())
  expiresAt             DateTime
}
```

**Purpose**: Track active sessions & enable refresh token rotation  
**TTL**: 7 days (configurable)

### OtpChallenge

One-Time Password for MFA/OTP verification.

```prisma
model OtpChallenge {
  id                    String    @id @default(cuid())
  userId                String
  tenantId              String
  challengeId           String    @unique  // Frontend receives this
  codeHash              String    // SHA256(6-digit code)
  purpose               String    // LOGIN, PASSWORD_RESET
  deliveryChannel       String    // EMAIL
  destinationMasked     String    // m***@gmail.com
  attempts              Int       @default(0)
  maxAttempts           Int       @default(5)
  lockedAt              DateTime?
  resendCount           Int       @default(0)
  maxResends            Int       @default(3)
  lastSentAt            DateTime?
  consumedAt            DateTime?
  
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([tenantId])
  createdAt             DateTime  @default(now())
  expiresAt             DateTime
}
```

**Purpose**: MFA/OTP management  
**Constraints**: 
- Max 5 failed attempts → locked for 15 min
- Max 3 resends per challenge
- Code expires after 10 minutes

### PasswordResetToken

Password reset token for self-service password reset.

```prisma
model PasswordResetToken {
  id                    String    @id @default(cuid())
  userId                String
  tenantId              String
  tokenHash             String    @unique  // SHA256(token)
  createdByIp           String
  userAgent             String
  revokedAt             DateTime?
  
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  createdAt             DateTime  @default(now())
  expiresAt             DateTime
}
```

---

## Employee Models

### Employee

Employee profile information.

```prisma
model Employee {
  id                    String    @id @default(cuid())
  userId                String    @unique  // Link to User account
  tenantId              String
  employeeCode          String
  firstName             String
  lastName              String
  workEmail             String
  email                 String?
  phone                 String?
  gender                String?   // MALE, FEMALE, OTHER
  dateOfBirth           DateTime?
  
  // Employment Details
  jobTitle              String
  departmentId          String
  reportingManagerId    String?   // Self-reference for manager
  employmentType        String    // FULL_TIME, PART_TIME, CONTRACT
  employmentStatus      String    @default("ACTIVE")  // ACTIVE, ON_LEAVE, SUSPENDED
  workMode              String    // OFFICE, REMOTE, HYBRID
  joinedOn              DateTime
  
  // Relationships
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  department            Department @relation(fields: [departmentId], references: [id])
  reportingManager      Employee? @relation("ReportingManager", fields: [reportingManagerId], references: [id])
  directReports         Employee[] @relation("ReportingManager")
  leaveRequests         LeaveRequest[]
  leaveBalances         LeaveBalance[]
  attendanceRecords     AttendanceRecord[]
  regularizationRequests AttendanceRegularizationRequest[]
  
  @@unique([tenantId, employeeCode])
  @@index([tenantId])
  @@index([departmentId])
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

**Relationships**: 
- Links to `User` (1:1)
- Links to `Department` (many:1)
- Self-referencing for manager hierarchy

---

## Leave Models

### LeaveType

Types of leave available (Annual, Sick, Personal, etc.).

```prisma
model LeaveType {
  id                    String    @id @default(cuid())
  tenantId              String
  name                  String
  code                  String
  description           String?
  requiresApproval      Boolean   @default(true)
  maxDaysPerYear        Int
  carryForwardDays      Int       @default(0)
  isActive              Boolean   @default(true)
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  leaveRequests         LeaveRequest[]
  leaveBalances         LeaveBalance[]
  
  @@unique([tenantId, code])
  @@index([tenantId])
  createdAt             DateTime  @default(now())
}
```

**Purpose**: Configure leave policies

### LeaveBalance

Track leave balances per employee per year.

```prisma
model LeaveBalance {
  id                    String    @id @default(cuid())
  employeeId            String
  leaveTypeId           String
  year                  Int
  totalDays             Int
  usedDays              Int       @default(0)
  carryForwardDays      Int       @default(0)
  
  employee              Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  leaveType             LeaveType @relation(fields: [leaveTypeId], references: [id])
  
  @@unique([employeeId, leaveTypeId, year])
  @@index([employeeId])
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

**Calculation**: `availableDays = totalDays + carryForwardDays - usedDays`

### LeaveRequest

Leave request workflow.

```prisma
model LeaveRequest {
  id                    String    @id @default(cuid())
  employeeId            String
  tenantId              String
  leaveTypeId           String
  startDate             DateTime
  endDate               DateTime
  numberOfDays          Int
  reason                String
  documentUrl           String?
  status                String    @default("PENDING")  // PENDING, APPROVED, REJECTED, WITHDRAWN
  approvedBy            String?   // User ID
  approvalNotes         String?
  
  employee              Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  leaveType             LeaveType @relation(fields: [leaveTypeId], references: [id])
  
  @@index([employeeId])
  @@index([tenantId])
  @@index([status])
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

**Status Flow**: PENDING → APPROVED/REJECTED → (or WITHDRAWN)

---

## Attendance Models

### AttendanceRecord

Daily check-in/check-out records.

```prisma
model AttendanceRecord {
  id                    String    @id @default(cuid())
  employeeId            String
  tenantId              String
  date                  DateTime  @db.Date
  checkedInAt           DateTime?
  checkedOutAt          DateTime?
  checkInLatitude       Float?
  checkInLongitude      Float?
  checkOutLatitude      Float?
  checkOutLongitude     Float?
  distanceFromOffice    Float?    // In meters
  durationMinutes       Int?
  status                String    // PRESENT, ABSENT, HALF_DAY
  notes                 String?
  
  employee              Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([employeeId, date])
  @@index([employeeId])
  @@index([tenantId])
  @@index([date])
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

**Geofence**: 100m radius from office (configurable per tenant)

### AttendanceRegularizationRequest

Request for attendance corrections (late arrivals, missing check-out, etc.).

```prisma
model AttendanceRegularizationRequest {
  id                    String    @id @default(cuid())
  employeeId            String
  tenantId              String
  date                  DateTime  @db.Date
  type                  String    // LATE_ARRIVAL, EARLY_DEPARTURE, MISSING_CHECKOUT, MISSING_CHECKIN
  reason                String
  documentUrl           String?
  status                String    @default("PENDING")  // PENDING, APPROVED, REJECTED
  approvedBy            String?
  
  employee              Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@index([employeeId])
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

---

## Organizational Models

### Department

Company department hierarchy.

```prisma
model Department {
  id                    String    @id @default(cuid())
  tenantId              String
  name                  String
  code                  String
  parentId              String?   // For hierarchy
  budget                Float?
  headCount             Int       @default(0)
  isActive              Boolean   @default(true)
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent                Department? @relation("DepartmentHierarchy", fields: [parentId], references: [id])
  children              Department[] @relation("DepartmentHierarchy")
  employees             Employee[]
  
  @@unique([tenantId, code])
  @@index([tenantId])
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}
```

**Validation**: Prevent circular parent references

### Holiday

Company holidays and observances.

```prisma
model Holiday {
  id                    String    @id @default(cuid())
  tenantId              String
  name                  String
  date                  DateTime  @db.Date
  location              String?   // Country code (US, IN, etc.)
  isOptional            Boolean   @default(false)
  isActive              Boolean   @default(true)
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  
  @@unique([tenantId, date, location])
  @@index([tenantId])
  @@index([date])
  createdAt             DateTime  @default(now())
}
```

---

## RBAC Models

### Role

Role definitions (HR_ADMIN, MANAGER, EMPLOYEE, etc.).

```prisma
model Role {
  id                    String    @id @default(cuid())
  tenantId              String
  name                  String
  key                   String    // SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE
  description           String?
  isSystem              Boolean   @default(false)  // System roles can't be deleted
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  permissions           RolePermission[]
  userRoles             UserRole[]
  
  @@unique([tenantId, key])
  @@index([tenantId])
  createdAt             DateTime  @default(now())
}
```

### Permission

Granular permissions (e.g., "leave:read", "leave:write").

```prisma
model Permission {
  id                    String    @id @default(cuid())
  key                   String    @unique
  module                String    // auth, employees, leave, attendance
  description           String?
  
  rolePermissions       RolePermission[]
  
  createdAt             DateTime  @default(now())
}
```

### RolePermission

Join table: Role → Permission (many-to-many).

```prisma
model RolePermission {
  id                    String    @id @default(cuid())
  roleId                String
  permissionId          String
  
  role                  Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission            Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  
  @@unique([roleId, permissionId])
  createdAt             DateTime  @default(now())
}
```

### UserRole

Join table: User → Role (many-to-many).

```prisma
model UserRole {
  id                    String    @id @default(cuid())
  userId                String
  roleId                String
  
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  role                  Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  @@unique([userId, roleId])
  createdAt             DateTime  @default(now())
}
```

---

## Audit & Export Models

### AuditLog

Immutable audit trail of all sensitive operations.

```prisma
model AuditLog {
  id                    String    @id @default(cuid())
  tenantId              String
  actorUserId           String?   // Who performed the action
  action                String    // USER_LOGIN, LEAVE_APPROVED, EMPLOYEE_CREATED, etc.
  entityType            String    // User, Employee, LeaveRequest, etc.
  entityId              String    // ID of affected entity
  changes               Json?     // { before: {}, after: {} }
  ipAddress             String?
  userAgent             String?
  
  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  actor                 User?     @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  
  @@index([tenantId])
  @@index([actorUserId])
  @@index([entityType])
  @@index([action])
  createdAt             DateTime  @default(now())
  
  // Immutable: @@index([createdAt])
}
```

**Immutability**: No updates or deletes allowed  
**Retention**: 7 years for compliance

### ExportJob

Async data export job tracking.

```prisma
model ExportJob {
  id                    String    @id @default(cuid())
  tenantId              String
  createdByUserId       String
  dataType              String    // EMPLOYEES, ATTENDANCE, LEAVE
  format                String    // CSV, EXCEL, JSON
  status                String    @default("QUEUED")  // QUEUED, PROCESSING, COMPLETED, FAILED
  rowCount              Int       @default(0)
  processedCount        Int       @default(0)
  downloadUrl           String?
  errorMessage          String?
  
  @@index([tenantId])
  @@index([status])
  createdAt             DateTime  @default(now())
  completedAt           DateTime?
}
```

**Async Processing**: Via BullMQ queue  
**TTL**: 24 hours for download link

---

## Relationships Diagram

```
Tenant (root)
├── User (members)
│   ├── Session (active sessions)
│   ├── OtpChallenge (MFA)
│   ├── PasswordResetToken
│   └── UserRole → Role → Permission
│
├── Employee (profiles)
│   ├── LeaveBalance (per type, per year)
│   ├── LeaveRequest
│   ├── AttendanceRecord (daily)
│   └── AttendanceRegularizationRequest
│
├── Department (hierarchy)
├── LeaveType (policies)
├── Holiday (calendar)
├── Role (RBAC)
├── AuditLog (immutable)
└── ExportJob (async exports)
```

---

## Query Optimization

### Indexes by Access Pattern

| Query | Index |
|-------|-------|
| Get user by email | `User(tenantId, email)` |
| Get employee by user | `Employee(userId)` |
| Get active sessions | `Session(userId, isRevoked)` |
| Get leave requests by status | `LeaveRequest(tenantId, status)` |
| Get attendance for date range | `AttendanceRecord(employeeId, date)` |
| Get audit logs by action | `AuditLog(tenantId, action, createdAt)` |
| Get org hierarchy | `Department(tenantId, parentId)` |

### N+1 Query Prevention

Use Prisma's `include` for related data:

```javascript
// ❌ Bad: Multiple queries
const employee = await prisma.employee.findUnique({ where: { id } });
const department = await prisma.department.findUnique({ where: { id: employee.departmentId } });

// ✅ Good: Single query with includes
const employee = await prisma.employee.findUnique({
  where: { id },
  include: { 
    department: true,
    reportingManager: true,
    leaveBalances: { include: { leaveType: true } }
  }
});
```

---

## Data Integrity Constraints

| Constraint | Enforcement |
|-----------|-------------|
| Tenant isolation | Foreign key + soft deletes on Tenant |
| Circular department parents | Application logic validation |
| Overlapping leave requests | Application logic check |
| Attendance outside geofence | Client-side + validation |
| Duplicate leave balance entries | Unique constraint |
| MFA lockout | Time-based flag (lockedAt) |
| Session rotation | sessionFamilyId tracking |

---

## Migration Management

```bash
# Create new migration
npx prisma migrate dev --name add_field

# Deploy migration to production
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

All migrations are version-controlled in `prisma/migrations/`.

---

## Backup & Disaster Recovery

**MySQL Backups**:
- Daily automated backups
- 30-day retention
- Encrypted at rest
- Point-in-time recovery support

**Data Retention Policy**:
- Live data: indefinite
- Soft-deleted data: 90 days
- Audit logs: 7 years
- Export jobs: 24 hours

---

## Compliance & Data Privacy

- **GDPR**: Right to be forgotten via soft deletes
- **SOC2**: Immutable audit trails
- **HIPAA**: Encryption in transit & at rest
- **PCI**: If processing payments (not in scope currently)

---

## Schema Version

- **Current Version**: 1.0.0
- **Last Updated**: May 18, 2026
- **Compatibility**: Prisma 5.15+, MySQL 8.0+
