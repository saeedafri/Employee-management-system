# EMS API — Actual Response Mapping

> **Last verified: 2026-05-22 (local + Render)**
> Base URL: `https://employee-management-system-2b9q.onrender.com/api/v1`
> Local: `http://localhost:3000/api/v1`
>
> This file documents what the API **actually returns** — live-verified via inject tests.
> Use this as the source of truth for frontend integration.

---

## Response Envelope

Every response uses this wrapper:

**Success:**
```json
{ "success": true, "data": <payload>, "meta": {} }
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable message",
    "details": [],
    "requestId": "req-1"
  }
}
```

**Validation Error (422):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Invalid email" },
      { "field": "password", "message": "Required" }
    ]
  }
}
```

> `details` is always an **array of `{field, message}`** objects for 422s.
> For other errors, `details` is an object with extra context (may be `{}`).

---

## Auth Headers

After login, the server sets two httpOnly cookies automatically:
- `accessToken` — 15-minute JWT
- `ems_session` — 30-day opaque refresh token

**Browser**: cookies are sent automatically — no headers needed after login.

**Swagger / Postman**: copy `accessToken` from login response body and use `Authorization: Bearer <token>`.

**Tenant resolution**: automatic after login (JWT carries `tenantId`). Only set `X-Tenant-Key: acme-corp-001` for the initial login if you're using Postman without cookies.

---

## Seeded Test Credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| SUPER_ADMIN | `superadmin@acme.test` | `Password123!` | No employee record |
| HR_ADMIN | `hr@acme.test` | `Password123!` | Full HR access |
| MANAGER | `aman@acme.test` | `Password123!` | Sees own team |
| EMPLOYEE | `priya@acme.test` | `Password123!` | Sees own data only |

---

## Auth

### `POST /auth/login`

No headers required. Tenant auto-resolved from email.

**Body:**
```json
{ "email": "hr@acme.test", "password": "Password123!" }
```

**Response `data`:**
```json
{
  "accessToken": "eyJ...",
  "sessionId": "fbd3b38de534129c109d90f7",
  "user": {
    "id": "cmpfypbqs000sunacwj0lfpx3",
    "email": "hr@acme.test",
    "memberType": "HR_ADMIN",
    "employeeId": "cmpfypsvr001iunacpwa3m6cf",
    "employee": { "...full employee object..." }
  },
  "permissions": ["employees:read", "employees:write", "leave:approve", "..."]
}
```

> **SUPER_ADMIN note**: `user.employee` is `null` — SUPER_ADMIN has no employee record. `employeeId` is absent from JWT. Dashboard endpoints that require an employeeId will not work for SUPER_ADMIN.

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `INVALID_CREDENTIALS` | 401 | Wrong password or user not found |
| `AMBIGUOUS_EMAIL` | 400 | Email in multiple tenants — send `X-Tenant-Key` |
| `VALIDATION_ERROR` | 422 | Missing email or password |

---

### `POST /auth/admin/login`

Same as `/auth/login` but only HR_ADMIN and SUPER_ADMIN can succeed. Requires `X-Tenant-Key`.

---

### `POST /auth/refresh`

Uses `ems_session` cookie. Returns new `accessToken` (cookie + body) and rotated refresh cookie.

**Response `data`:**
```json
{ "accessToken": "eyJ...", "sessionId": "abc123" }
```

**Error codes:** `REFRESH_TOKEN_MISSING`, `INVALID_TOKEN_FORMAT`, `INVALID_SESSION`, `TOKEN_REUSE`, `SESSION_EXPIRED`

> On any refresh error, both cookies are cleared automatically.

---

### `GET /auth/me`

**Response `data`:**
```json
{
  "id": "cmpfypbqs000sunacwj0lfpx3",
  "email": "hr@acme.test",
  "memberType": "HR_ADMIN",
  "employeeId": "cmpfypsvr001iunacpwa3m6cf",
  "status": "ACTIVE",
  "employee": {
    "id": "cmpfypsvr001iunacpwa3m6cf",
    "employeeCode": "E0003",
    "firstName": "HR",
    "lastName": "Admin",
    "workEmail": "hr@acme.test",
    "designation": "HR Manager",
    "departmentId": "cmpfypjsk0012unac2shsfsi3",
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "location": "Delhi",
    "joinedOn": "2019-01-10T00:00:00.000Z"
  },
  "permissions": ["employees:read", "..."],
  "lastLoginAt": "2026-05-22T12:31:07.353Z"
}
```

---

### `GET /auth/sessions`

**Response `data`** — array of:
```json
{
  "id": "96ad0f7f4f24312030a3b75e",
  "deviceName": null,
  "ipAddress": "127.0.0.1",
  "userAgent": "Mozilla/5.0...",
  "loginAt": "2026-05-22T12:31:06.816Z",
  "lastSeenAt": "2026-05-22T12:31:06.816Z",
  "expiresAt": "2026-06-21T12:31:06.815Z",
  "isRevoked": false
}
```

---

### `POST /auth/logout`

**Response `data`:** `{ "message": "Logged out successfully" }`

---

### `DELETE /auth/sessions/:sessionId`

Revokes a specific session.
**Response `data`:** `{ "message": "Session revoked successfully" }`

---

### `POST /auth/forgot-password`

**Body:** `{ "email": "hr@acme.test" }`
**Response `data`:** `{ "message": "If that email exists, a reset link was sent" }`

Rate limited: 5 requests / 15 min.

---

### `POST /auth/reset-password`

**Body:** `{ "token": "...", "password": "NewPass123!" }`
**Response `data`:** `{ "message": "Password reset successfully" }`

---

### `POST /auth/verify-otp`

**Body:** `{ "challengeId": "...", "otp": "123456" }`
**Response `data`:** same shape as login (`accessToken`, `sessionId`, `user`, `permissions`)

---

## Employees

### `GET /employees`

**Query params:** `page`, `limit`, `search`, `departmentId`, `status`, `location`

**Response `data`:**
```json
{
  "data": [
    {
      "id": "cmpfypq1h001eunacja7guack",
      "tenantId": "cmpfyl9sx0000ug81ekztst0p",
      "employeeCode": "E0001",
      "firstName": "Aman",
      "lastName": "Kumar",
      "workEmail": "aman@acme.test",
      "personalEmail": "aman.kumar@gmail.com",
      "phone": "+91 98765 43210",
      "dateOfBirth": "1990-03-15T00:00:00.000Z",
      "gender": "MALE",
      "address": "Delhi, India",
      "designation": "Engineering Manager",
      "departmentId": "cmpfyph7t000yunacvy5kouqi",
      "managerId": null,
      "joinedOn": "2020-01-15T00:00:00.000Z",
      "employmentType": "FULL_TIME",
      "employmentStatus": "ACTIVE",
      "location": "Delhi",
      "payCurrency": "INR",
      "department": { "id": "...", "name": "Engineering" },
      "manager": null,
      "user": { "email": "aman@acme.test", "memberType": "MANAGER", "status": "ACTIVE" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 67, "pages": 4 }
}
```

> **Note**: The outer `data` wraps `{ data: [...], pagination: {} }` — double-nested. `data.data` is the array.

**Role filtering:**
- SUPER_ADMIN / HR_ADMIN — sees everyone
- MANAGER — sees own direct reports + self
- EMPLOYEE — sees only self

---

### `GET /employees/:id`

**Response `data`** — full employee object including:
```json
{
  "id": "...",
  "employeeCode": "E0003",
  "firstName": "HR",
  "lastName": "Admin",
  "workEmail": "hr@acme.test",
  "designation": "HR Manager",
  "departmentId": "...",
  "managerId": null,
  "joinedOn": "2019-01-10T00:00:00.000Z",
  "employmentType": "FULL_TIME",
  "employmentStatus": "ACTIVE",
  "location": "Delhi",
  "user": { "email": "...", "memberType": "HR_ADMIN", "status": "ACTIVE", "mfaEnabled": false },
  "department": { "id": "...", "name": "HR" },
  "manager": null,
  "leaveBalances": [
    {
      "id": "...",
      "leaveTypeId": "...",
      "balance": 21,
      "used": 0,
      "pending": 0,
      "leaveType": { "name": "Annual Leave", "code": "ANNUAL" }
    }
  ],
  "documents": []
}
```

---

### `POST /employees`

**Required roles:** HR_ADMIN, SUPER_ADMIN

**Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "workEmail": "jane.doe@acme.test",
  "employeeCode": "E0010",
  "employmentType": "FULL_TIME",
  "joinedOn": "2024-01-15",
  "designation": "Software Engineer",
  "departmentId": "...",
  "managerId": "...",
  "personalEmail": "jane@gmail.com",
  "phone": "+91 9876543210",
  "location": "Mumbai",
  "gender": "FEMALE",
  "dateOfBirth": "1995-06-15"
}
```

**Response:** 201, `data` = full employee object (same shape as GET /employees/:id)

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `DUPLICATE_EMPLOYEE_CODE` | 400 | employeeCode already taken |
| `DUPLICATE_WORK_EMAIL` | 400 | workEmail already taken |
| `VALIDATION_ERROR` | 422 | Missing required fields |
| `FORBIDDEN` | 403 | Not HR_ADMIN or SUPER_ADMIN |

---

### `PATCH /employees/:id`

**Required roles:** HR_ADMIN, SUPER_ADMIN (or own profile)

**Body:** any subset of employee fields (all optional)

**Response:** 200, `data` = updated employee object

**Error codes:** `DUPLICATE_EMPLOYEE_CODE`, `DUPLICATE_WORK_EMAIL`, `NOT_FOUND`

---

### `DELETE /employees/:id`

**Required roles:** HR_ADMIN, SUPER_ADMIN

Soft-deletes (sets `employmentStatus = 'TERMINATED'`).

**Response:** 200, `data`: `{ "id": "...", "status": "TERMINATED" }`

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `NOT_FOUND` | 404 | Employee doesn't exist |
| `EMPLOYEE_HAS_DEPENDENTS` | 409 | Employee is a manager of others or heads a department |

`EMPLOYEE_HAS_DEPENDENTS` details: `{ "managedEmployees": 3, "departmentsHeaded": 1 }`

---

### `GET /employees/export/csv`

Returns a CSV file. Response header: `Content-Type: text/csv`.

---

## Departments

### `GET /departments`

Returns hierarchical tree (root departments with nested `children`).

**Response `data`** — array of:
```json
{
  "id": "cmpfyporh001cunacw7t4f2qx",
  "tenantId": "...",
  "parentId": null,
  "name": "Customer Success",
  "departmentCode": "CUS",
  "headEmployeeId": null,
  "depth": 0,
  "createdAt": "2026-05-21T20:47:46.589Z",
  "updatedAt": "2026-05-21T20:47:46.589Z",
  "deletedAt": null,
  "headEmployee": null,
  "_count": { "employees": 7 },
  "children": []
}
```

---

### `POST /departments`

**Body:**
```json
{ "name": "Marketing", "departmentCode": "MKT", "parentId": null, "budget": 500000 }
```

**Response:** 201, `data` = full department object (same shape as GET)

**Error codes:** `DUPLICATE_CODE`, `INVALID_PARENT`

---

### `PATCH /departments/:id`

**Body:** any subset of department fields

**Response:** 200, `data` = updated department object

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `DEPARTMENT_CYCLE` | 400 | Setting parentId would create a cycle |
| `INVALID_PARENT` | 400 | Parent department doesn't exist |
| `DUPLICATE_CODE` | 400 | Code taken by another department |
| `NOT_FOUND` | 400 | Department not found |

---

### `DELETE /departments/:id`

**Response:** 200, `data`: `{ "id": "...", "status": "archived" }`

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `NOT_FOUND` | 400 | Department not found |
| `DEPARTMENT_NOT_EMPTY` | 400 | Has active employees or sub-departments |

---

## Holidays

### `GET /holidays`

**Query params:** `year` (number), `country` (string)

**Response `data`:**
```json
{
  "holidays": [
    {
      "id": "cmpfypyv8001qunac3pmxe92h",
      "tenantId": "...",
      "name": "Independence Day",
      "holidayDate": "2026-08-15T00:00:00.000Z",
      "location": "India",
      "isOptional": false,
      "createdAt": "2026-05-21T20:47:59.685Z",
      "updatedAt": "2026-05-21T20:47:59.685Z"
    }
  ],
  "total": 4
}
```

---

### `POST /holidays`

**Required roles:** HR_ADMIN, SUPER_ADMIN

**Body:**
```json
{
  "name": "Diwali",
  "holidayDate": "2026-10-20",
  "isOptional": false,
  "location": "India"
}
```

> **Note**: Field is `holidayDate` (not `date`). Optional flag is `isOptional: boolean` (not `type: string`).

**Response:** 201, `data` = holiday object

---

### `PATCH /holidays/:id`

**Body:** any subset of holiday fields

**Response:** 200, `data` = updated holiday object

---

### `DELETE /holidays/:id`

**Response:** 200, `data` = `{ "id": "...", "status": "deleted" }` (or similar)

---

## Leave

### `GET /leave/types`

**Response `data`** — array of:
```json
{
  "id": "cmpfypuvg001kunacml0quuvj",
  "name": "Annual Leave",
  "code": "ANNUAL",
  "annualAllowance": 21,
  "carryForwardAllowed": true,
  "isPaid": true
}
```

---

### `GET /leave/balance`

**Response `data`:**
```json
{
  "balances": [
    {
      "id": "...",
      "leaveTypeId": "...",
      "leaveTypeName": "Annual Leave",
      "leaveTypeCode": "ANNUAL",
      "total": 21,
      "used": 0,
      "pending": 0,
      "available": 21
    }
  ]
}
```

---

### `GET /leave/requests`

**Query params:** `page`, `limit`, `status`, `leaveTypeId`, `fromDate`, `toDate`

**Response `data`:**
```json
{
  "requests": [
    {
      "id": "...",
      "leaveTypeId": "...",
      "leaveTypeName": "Annual Leave",
      "startDate": "2026-06-15T00:00:00.000Z",
      "endDate": "2026-06-15T00:00:00.000Z",
      "totalDays": 1,
      "status": "PENDING",
      "reason": "Personal appointment",
      "submittedAt": "2026-05-21T21:13:37.484Z",
      "decidedAt": null,
      "approverComment": null
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "pages": 1 }
}
```

**Statuses:** `PENDING`, `APPROVED`, `DENIED`, `WITHDRAWN`

---

### `GET /leave/team/requests`

**Required roles:** MANAGER, HR_ADMIN

Same shape as GET /leave/requests.

---

### `POST /leave/requests`

**Body:**
```json
{
  "leaveTypeId": "...",
  "startDate": "2026-07-01",
  "endDate": "2026-07-03",
  "reason": "Family vacation trip"
}
```

**Error codes:** `LEAVE_TYPE_NOT_FOUND`, `NO_LEAVE_BALANCE`, `OVERLAPPING_LEAVE`, `INSUFFICIENT_BALANCE`

---

### `PATCH /leave/requests/:id/approve`

**Required roles:** MANAGER, HR_ADMIN

**Body:** `{ "comment": "Approved" }` (optional)

**Response `data`:** updated leave request object

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `LEAVE_REQUEST_NOT_FOUND` | 404 | Request not found |
| `LEAVE_ALREADY_DECIDED` | 409 | Request is not PENDING (already approved/denied/withdrawn) |

---

### `PATCH /leave/requests/:id/reject`

**Required roles:** MANAGER, HR_ADMIN

**Body:** `{ "comment": "Team at full capacity" }` (comment recommended)

**Response `data`:** updated leave request object (status will be `DENIED`)

**Error codes:** `LEAVE_REQUEST_NOT_FOUND` (404), `LEAVE_ALREADY_DECIDED` (409)

---

### `PATCH /leave/requests/:id/withdraw`

**Body:** none required

**Response `data`:** updated leave request (status = `WITHDRAWN`)

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `LEAVE_REQUEST_NOT_FOUND` | 404 | Not found |
| `UNAUTHORIZED_ACTION` | 403 | Not your leave request |
| `LEAVE_ALREADY_DECIDED` | 409 | Not PENDING |

---

## Attendance

### `POST /attendance/check-in`

**Body:**
```json
{ "workMode": "OFFICE", "notes": "On time" }
```

`workMode` values: `OFFICE`, `WFH`, `HYBRID`

**Response `data`:** attendance record object

---

### `POST /attendance/check-out`

**Body:** `{ "notes": "Done for the day" }` (optional)

**Response `data`:** updated attendance record

---

### `GET /attendance/records`

**Query params:** `page`, `limit`, `month` (YYYY-MM), `fromDate`, `toDate`

**Response `data`:**
```json
{
  "records": [
    {
      "id": "...",
      "attendanceDate": "2026-05-21T00:00:00.000Z",
      "checkInAt": "2026-05-21T21:12:13.605Z",
      "checkOutAt": null,
      "status": "PRESENT",
      "workMode": "OFFICE",
      "totalMinutes": null,
      "notes": null
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 23, "pages": 3 }
}
```

---

### `GET /attendance/team/records`

**Required roles:** MANAGER, HR_ADMIN

**Query params:** `month` (YYYY-MM), `departmentId`

Same shape as GET /attendance/records.

---

### `GET /attendance/summary`

**Response `data`:**
```json
{
  "period": {
    "startDate": "2026-04-30T18:30:00.000Z",
    "endDate": "2026-05-22T12:31:33.010Z"
  },
  "totalDays": 16,
  "present": 16,
  "absent": 0,
  "leave": 0,
  "wfh": 0,
  "halfDay": 0,
  "holiday": 0,
  "late": 0,
  "attendancePercentage": 100
}
```

---

### `POST /attendance/regularization`

**Body:**
```json
{
  "attendanceDate": "2026-05-20",
  "reason": "Forgot to check in while in office"
}
```

**Response `data`:** regularization request object

---

### `GET /attendance/regularization`

**Response `data`:** array of own regularization requests

---

### `GET /attendance/team/regularization`

**Required roles:** MANAGER, HR_ADMIN

---

### `PATCH /attendance/regularization/:id/approve`

**Required roles:** MANAGER, HR_ADMIN

---

### `PATCH /attendance/regularization/:id/deny`

**Required roles:** MANAGER, HR_ADMIN

---

## Analytics

All analytics endpoints require HR_ADMIN or SUPER_ADMIN.

### `GET /analytics/summary`

**Response `data`:**
```json
{
  "totalEmployees": 67,
  "activeToday": 0,
  "onLeaveToday": 0,
  "openRequests": 0
}
```

---

### `GET /analytics/attendance`

**Query params:** `range` (`7d`, `30d`, `90d`)

**Response `data`:**
```json
{
  "range": "30d",
  "series": [
    { "date": "2026-04-22", "present": 3, "absent": 0, "leave": 0, "wfh": 0, "halfDay": 0 }
  ]
}
```

---

### `GET /analytics/headcount-by-department`

**Response `data`** — array of:
```json
{
  "departmentId": "...",
  "departmentName": "Engineering",
  "employeeCount": 10,
  "activeCount": 8
}
```

---

### `GET /analytics/leave-summary`

**Response `data`:**
```json
{
  "pending": 0,
  "approved": 0,
  "rejected": 0,
  "withdrawn": 1
}
```

---

### `GET /analytics/recent-activity`

**Response `data`:** array of recent activity events

---

## Settings

### `GET /settings/tenant`

**Response `data`:**
```json
{
  "company_name": "Acme Corp",
  "timezone": "Asia/Kolkata",
  "working_hours_start": "09:00",
  "working_hours_end": "18:00",
  "fiscal_year_start": 4
}
```

---

### `PATCH /settings/tenant`

**Required roles:** HR_ADMIN, SUPER_ADMIN

**Body (snake_case):**
```json
{
  "company_name": "Acme Corp Updated",
  "timezone": "Asia/Kolkata",
  "working_hours_start": "09:00",
  "working_hours_end": "18:00"
}
```

**Response `data`:** same shape as GET

---

### `GET /settings/email-templates`

**Required roles:** HR_ADMIN, SUPER_ADMIN

**Response `data`:**
```json
{
  "templates": [
    {
      "id": "...",
      "type": "LEAVE_APPROVAL",
      "subject": "Your Leave Request Has Been Approved",
      "body": "Dear Employee, ..."
    }
  ]
}
```

`type` values: `LEAVE_APPROVAL`, `LEAVE_REJECTION`, `ATTENDANCE_ALERT`

---

### `PATCH /settings/email-templates/:type`

**Required roles:** HR_ADMIN, SUPER_ADMIN

**Params:** `type` = `LEAVE_APPROVAL` | `LEAVE_REJECTION` | `ATTENDANCE_ALERT`

**Body:**
```json
{ "subject": "Updated subject", "body": "Updated body text" }
```

---

### `GET /settings/roles-permissions`

**Required roles:** SUPER_ADMIN

**Response `data`:**
```json
{
  "roles": ["EMPLOYEE", "HR_ADMIN", "AUDITOR", "MANAGER", "SUPER_ADMIN"],
  "permissions": [
    "analytics:read", "attendance:read", "attendance:write",
    "audit:read", "departments:read", "departments:write",
    "employees:delete", "employees:export", "employees:read", "employees:write",
    "leave:approve", "leave:read", "leave:request", "permissions:manage"
  ],
  "matrix": {
    "EMPLOYEE": ["attendance:read", "attendance:write", "leave:read", "leave:request", "audit:read"],
    "HR_ADMIN": ["employees:read", "employees:write", "employees:delete", "employees:export", "departments:read", "departments:write", "attendance:read", "attendance:write", "leave:read", "leave:approve", "analytics:read", "audit:read"],
    "MANAGER": ["attendance:read", "leave:approve", "audit:read"],
    "AUDITOR": ["employees:read", "departments:read", "attendance:read", "leave:read", "analytics:read", "audit:read"],
    "SUPER_ADMIN": ["employees:read", "employees:write", "employees:delete", "employees:export", "departments:read", "departments:write", "attendance:read", "attendance:write", "leave:read", "leave:request", "leave:approve", "analytics:read", "permissions:manage", "audit:read"]
  }
}
```

---

### `PATCH /settings/roles-permissions`

**Required roles:** SUPER_ADMIN

**Body:**
```json
{ "role": "MANAGER", "permissions": ["attendance:read", "leave:approve", "employees:read"] }
```

Replaces the full permission set for the given role.

**Response `data`:** `{ "role": "MANAGER", "permissions": ["..."] }`

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `CANNOT_LOCK_OUT_SUPER_ADMIN` | 403 | Tried to modify SUPER_ADMIN role |
| `ROLE_NOT_FOUND` | 404 | Unknown role key |

---

## Dashboards

### `GET /employee/dashboard`

Employee sees own summary.

**Response `data`:**
```json
{
  "employeeName": "Priya Sharma",
  "designation": "Senior Engineer",
  "department": "Engineering",
  "todayAttendance": {},
  "pendingLeaves": 0
}
```

---

### `GET /employee/team`

Employee sees their manager and peers in the same department.

**Response `data`:** `{}` (populated when team data exists)

---

### `GET /employee/documents`

**Response `data`:** array of `EmployeeDocument` records (empty if none seeded)

Also accessible at: `GET /employees/me/documents`

---

### `GET /manager/dashboard`

**Required roles:** MANAGER, HR_ADMIN, SUPER_ADMIN

**Response `data`:**
```json
{
  "managerName": "Aman Kumar",
  "teamSize": 19,
  "pendingApprovals": 0,
  "todayAttendance": {}
}
```

---

### `GET /manager/team`

Team members under the logged-in manager.

---

### `GET /manager/approvals`

Pending leave and regularization requests requiring manager action.

---

## Reports

All require HR_ADMIN or SUPER_ADMIN.

### `GET /reports/attendance`

**Response `data`:**
```json
{
  "period": {},
  "summary": {
    "present": 67, "absent": 0, "late": 0,
    "on_time": 0, "leave": 0, "wfh": 0, "half_day": 0, "holiday": 0
  },
  "by_department": [
    {
      "department_id": "...",
      "department_name": "Engineering",
      "present": 45, "absent": 0, "late": 0,
      "on_time": 0, "leave": 0, "wfh": 0, "half_day": 0, "holiday": 0
    }
  ]
}
```

---

### `GET /reports/leaves`

**Response `data`:** leave summary by department and leave type

---

### `GET /reports/payroll`

Payroll summary data.

---

## Audit Logs

### `GET /audit-logs`

**Required roles:** HR_ADMIN, SUPER_ADMIN

**Query params:** `page`, `limit`, `entity`, `action`, `userId`

**Response `data`** — array of audit log entries:
```json
{
  "id": "...",
  "tenantId": "...",
  "userId": "...",
  "action": "UPDATE",
  "entity": "Employee",
  "entityId": "...",
  "changes": {},
  "ipAddress": "127.0.0.1",
  "createdAt": "2026-05-22T12:00:00.000Z"
}
```

---

### `GET /audit-logs/:id`

Single audit log entry.

---

## Admin Logs

### `GET /admin/logs`

**Required roles:** HR_ADMIN, SUPER_ADMIN

**Query params:** `level` (`ERROR`, `WARN`, `INFO`, `DEBUG`), `module`, `limit`, `offset`

**Response `data`:** array of log entries with `level`, `message`, `module`, `timestamp`

> **Note**: Route is `/api/v1/admin/logs` — not `/api/v1/logs`

---

## Export

### `POST /export/employees`

**Body:** `{ "format": "csv", "filters": {} }`

**Response `data`:** `{ "jobId": "...", "status": "PENDING" }`

---

### `GET /export/:job_id/download`

Download completed export file.

---

### `GET /export/list`

List all export jobs for the tenant.

---

## Common Error Codes Reference

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `INVALID_TOKEN` | 401 | Token expired or malformed |
| `FORBIDDEN` | 403 | Authenticated but insufficient role |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 422 | Request body fails schema validation — `details[]` is array of `{field, message}` |
| `INVALID_CREDENTIALS` | 401 | Wrong password or unknown email |
| `AMBIGUOUS_EMAIL` | 400 | Email in multiple tenants |
| `DUPLICATE_EMPLOYEE_CODE` | 400 | Employee code taken |
| `DUPLICATE_WORK_EMAIL` | 400 | Work email taken |
| `EMPLOYEE_HAS_DEPENDENTS` | 409 | Cannot delete — manages others or heads a dept |
| `DEPARTMENT_CYCLE` | 400 | Circular parent chain detected |
| `DEPARTMENT_NOT_EMPTY` | 400 | Has employees or sub-departments |
| `LEAVE_REQUEST_NOT_FOUND` | 404 | Leave request not found |
| `LEAVE_ALREADY_DECIDED` | 409 | Leave not PENDING — already acted on |
| `OVERLAPPING_LEAVE` | 400 | Date range overlaps existing leave |
| `INSUFFICIENT_BALANCE` | 400 | Not enough leave days available |
| `TOKEN_REUSE` | 401 | Refresh token used twice — session revoked |
| `SESSION_EXPIRED` | 401 | Refresh token expired |
| `CANNOT_LOCK_OUT_SUPER_ADMIN` | 403 | Cannot modify SUPER_ADMIN permissions |
| `ROLE_NOT_FOUND` | 404 | Unknown role key |
| `MISSING_TENANT` | 400 | Cannot determine tenant |
| `TENANT_INACTIVE` | 403 | Tenant account deactivated |

---

## Not Implemented (Models Exist, No Routes)

| Feature | Status |
|---------|--------|
| Document upload | GET works, POST upload not built (no file storage) |
| Notifications | Prisma model exists, no routes |
| Resignations | Prisma model exists, no routes |
| Fine-grained permissions enforcement | Models exist; `authorize()` still uses memberType enum |
