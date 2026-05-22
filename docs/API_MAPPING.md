# EMS API — Actual Response Mapping

> **Last verified: 2026-05-22 (local inject tests against live DB)**
> Base URL: `https://employee-management-system-2b9q.onrender.com/api/v1`
> Local: `http://localhost:3000/api/v1`

---

## Response Envelope

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
    "details": {},
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
      { "field": "email", "message": "Invalid email" }
    ]
  }
}
```

> `details` is always an **array of `{field, message}`** for 422s. For all other errors, `details` is an object (may be `{}`).

---

## Date Format — Definitive Answer

**Both formats are accepted everywhere:**
- `"2024-01-15"` (YYYY-MM-DD) ✅
- `"2024-01-15T00:00:00.000Z"` (full ISO) ✅

The server stores and returns dates as full ISO strings (`"2024-01-15T00:00:00.000Z"`).
Use whichever format is easier from your forms — both work. The old doc warning about FST_ERR_VALIDATION was wrong.

---

## Auth Headers

After login, two httpOnly cookies are set automatically:
- `accessToken` — 15-minute JWT
- `ems_session` — 30-day opaque refresh token

**Browser:** cookies auto-send — no headers needed after login.
**Swagger / Postman:** copy `accessToken` from login response body, use `Authorization: Bearer <token>`.
**Tenant:** resolved automatically from JWT cookie. No `X-Tenant-Key` needed after first login.

---

## Seeded Test Credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| SUPER_ADMIN | `superadmin@acme.test` | `Password123!` | No employee record — dashboard calls won't work |
| HR_ADMIN | `hr@acme.test` | `Password123!` | Full HR access |
| MANAGER | `aman@acme.test` | `Password123!` | Sees own team |
| EMPLOYEE | `priya@acme.test` | `Password123!` | Sees own data only |

---

## HTTP Status Code Rules

| Situation | Status |
|-----------|--------|
| Success GET/PATCH/DELETE | 200 |
| Success POST (create) | 201 |
| Validation error (missing/invalid fields) | 422 |
| Conflict (duplicate, cycle, not-empty) | 409 |
| Not found | 404 |
| Auth/token missing or invalid | 401 |
| Insufficient role | 403 |
| Other bad request | 400 |

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

> SUPER_ADMIN: `user.employee` is `null`, `employeeId` absent from JWT. Employee-specific endpoints (dashboard, attendance check-in, leave) will fail.

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `INVALID_CREDENTIALS` | 401 | Wrong password / unknown email |
| `AMBIGUOUS_EMAIL` | 400 | Email exists in multiple tenants — send `X-Tenant-Key` |
| `VALIDATION_ERROR` | 422 | Missing email or password |

---

### `POST /auth/refresh`

Uses `ems_session` cookie. Returns new `accessToken` in cookie + body, rotates refresh cookie.

**Response `data`:** `{ "accessToken": "eyJ...", "sessionId": "abc123" }`

On any error, both cookies are cleared. Error codes: `REFRESH_TOKEN_MISSING`, `INVALID_SESSION`, `TOKEN_REUSE`, `SESSION_EXPIRED`

---

### `GET /auth/me`

**Response `data`:**
```json
{
  "id": "...",
  "email": "hr@acme.test",
  "memberType": "HR_ADMIN",
  "employeeId": "...",
  "status": "ACTIVE",
  "employee": { "...full employee fields..." },
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

### `DELETE /auth/sessions/:sessionId`
**Response `data`:** `{ "message": "Session revoked successfully" }`

### `POST /auth/forgot-password`
**Body:** `{ "email": "hr@acme.test" }`
**Response `data`:** `{ "message": "If that email exists, a reset link was sent" }`
Rate limited: 5/15 min.

### `POST /auth/reset-password`
**Body:** `{ "token": "...", "password": "NewPass123!" }`

### `POST /auth/verify-otp`
**Body:** `{ "challengeId": "...", "otp": "123456" }`
**Response `data`:** same shape as login

---

## Employees

### `GET /employees`

**Query params:** `page`, `limit`, `search`, `departmentId`, `status`, `location`

**Response `data`:**

> **Note:** Double-nested — `data.data` is the array, `data.pagination` has counts.

```json
{
  "data": [
    {
      "id": "cmpfypq1h001eunacja7guack",
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
      "departmentId": "...",
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

**Role filtering (server-enforced):**
- SUPER_ADMIN / HR_ADMIN — all employees
- MANAGER — direct reports + self
- EMPLOYEE — self only

---

### `GET /employees/:id`

**Response `data`** — full employee with leaveBalances and documents:
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

**Error:** `NOT_FOUND` → 404

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
  "phone": "+91 9876543210",
  "location": "Mumbai",
  "gender": "FEMALE",
  "dateOfBirth": "1995-06-15"
}
```

> Dates: `"2024-01-15"` and `"2024-01-15T00:00:00.000Z"` both accepted.

**Response:** 201, `data` = full employee object

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `DUPLICATE_EMPLOYEE_CODE` | 409 | Code already taken |
| `DUPLICATE_WORK_EMAIL` | 409 | Email already taken |
| `VALIDATION_ERROR` | 422 | Missing required fields |

---

### `PATCH /employees/:id`

**Body:** any subset of employee fields (all optional)

**Response:** 200, `data` = updated employee object

**Error codes:** `DUPLICATE_EMPLOYEE_CODE` (409), `DUPLICATE_WORK_EMAIL` (409), `NOT_FOUND` (404)

---

### `DELETE /employees/:id`

Soft-deletes (sets `employmentStatus = 'TERMINATED'`).

**Response:** 200, `data`: `{ "id": "...", "status": "TERMINATED" }`

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `NOT_FOUND` | 404 | Employee doesn't exist |
| `EMPLOYEE_HAS_DEPENDENTS` | 409 | Is manager of others or heads a department |

`EMPLOYEE_HAS_DEPENDENTS` details: `{ "managedEmployees": 3, "departmentsHeaded": 1 }`

---

### `GET /employees/export/csv`
Returns CSV file. `Content-Type: text/csv`, `Content-Disposition: attachment; filename="employees.csv"`.

---

## Departments

### `GET /departments`

Returns array of root departments. Each has a `children` array (populated if sub-departments exist with `parentId` pointing to the parent — all seeded departments are root-level so `children: []` in the demo, but nesting works correctly for real data).

**Response `data`** — array of:
```json
{
  "id": "...",
  "parentId": null,
  "name": "Customer Success",
  "departmentCode": "CUS",
  "headEmployeeId": null,
  "depth": 0,
  "headEmployee": null,
  "_count": { "employees": 7 },
  "children": []
}
```

> Tree is server-built. `children[]` is populated when sub-departments exist. If all departments are root-level, all `children` arrays are empty — build nothing client-side, the server returns the tree.

---

### `POST /departments`

**Body:**
```json
{ "name": "Marketing", "departmentCode": "MKT", "parentId": null }
```

> `budget` field does NOT exist in the database. Do not send it.

**Response:** 201, `data` = department object

**Error codes:** `DUPLICATE_CODE` (409), `INVALID_PARENT` (400)

---

### `PATCH /departments/:id`

**Body:** any subset

**Response:** 200, `data` = updated department

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `NOT_FOUND` | 404 | Department doesn't exist |
| `DEPARTMENT_CYCLE` | 409 | Setting parentId would create a cycle |
| `INVALID_PARENT` | 400 | Parent department doesn't exist |
| `DUPLICATE_CODE` | 409 | Code taken by another department |

---

### `DELETE /departments/:id`

**Response:** 200, `data`: `{ "id": "...", "status": "archived" }`

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `NOT_FOUND` | 404 | Department doesn't exist |
| `DEPARTMENT_NOT_EMPTY` | 409 | Has active employees or sub-departments |

---

## Holidays

### `GET /holidays`

**Query params:** `year` (number), `country` (string)

**Response `data`:**
```json
{
  "holidays": [
    {
      "id": "...",
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

**Body:**
```json
{
  "name": "Diwali",
  "holidayDate": "2026-10-20",
  "isOptional": false,
  "location": "India"
}
```

> Field is `holidayDate` (not `date`). Optional flag is `isOptional: boolean` (not `type: string`).

**Response:** 201, `data` = holiday object

---

### `PATCH /holidays/:id`
**Body:** any subset. **Response:** 200, `data` = updated holiday.

### `DELETE /holidays/:id`
**Response:** 200, `data` = `{ "id": "...", "status": "deleted" }`

---

## Leave

### `GET /leave/types`

**Response `data`** — array of:
```json
{
  "id": "...",
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
**Required roles:** MANAGER, HR_ADMIN. Same shape as above.

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

**Error codes:** `LEAVE_TYPE_NOT_FOUND` (404), `NO_LEAVE_BALANCE` (400), `OVERLAPPING_LEAVE` (400), `INSUFFICIENT_BALANCE` (400)

---

### `PATCH /leave/requests/:id/approve`

**Required roles:** MANAGER, HR_ADMIN

**Body:** `{ "comment": "Approved" }` (optional)

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `LEAVE_REQUEST_NOT_FOUND` | 404 | Not found |
| `LEAVE_ALREADY_DECIDED` | 409 | Not PENDING (already approved/denied/withdrawn) |

---

### `PATCH /leave/requests/:id/reject`

**Required roles:** MANAGER, HR_ADMIN

**Body:** `{ "comment": "Team at capacity" }`

**Response `data`:** updated request (status = `DENIED`)

**Error codes:** `LEAVE_REQUEST_NOT_FOUND` (404), `LEAVE_ALREADY_DECIDED` (409)

---

### `PATCH /leave/requests/:id/withdraw`

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `LEAVE_REQUEST_NOT_FOUND` | 404 | Not found |
| `UNAUTHORIZED_ACTION` | 403 | Not your request |
| `LEAVE_ALREADY_DECIDED` | 409 | Not PENDING |

---

## Attendance

### `POST /attendance/check-in`

**Body:** `{ "workMode": "OFFICE", "notes": "On time" }`

`workMode` values: `OFFICE`, `WFH`, `HYBRID`

**Response `data`:** attendance record object

---

### `POST /attendance/check-out`

**Body:** `{ "notes": "Done for the day" }` (optional)

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
      "checkInAt": "2026-05-21T09:12:13.605Z",
      "checkOutAt": "2026-05-21T18:30:00.000Z",
      "status": "PRESENT",
      "workMode": "OFFICE",
      "totalMinutes": 558,
      "notes": null
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 23, "pages": 3 }
}
```

---

### `GET /attendance/team/records`
**Required roles:** MANAGER, HR_ADMIN. **Query:** `month` (YYYY-MM), `departmentId`. Same shape.

---

### `GET /attendance/summary`

**Response `data`:**
```json
{
  "period": { "startDate": "2026-04-30T18:30:00.000Z", "endDate": "2026-05-22T12:31:33.010Z" },
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

**Body:** `{ "attendanceDate": "2026-05-20", "reason": "Forgot to check in while in office" }`

### `GET /attendance/regularization`
Own regularization requests.

### `GET /attendance/team/regularization`
**Required roles:** MANAGER, HR_ADMIN.

### `PATCH /attendance/regularization/:id/approve`
**Required roles:** MANAGER, HR_ADMIN.

### `PATCH /attendance/regularization/:id/deny`
**Required roles:** MANAGER, HR_ADMIN.

---

## Analytics

All require HR_ADMIN or SUPER_ADMIN.

### `GET /analytics/summary`
```json
{ "totalEmployees": 67, "activeToday": 0, "onLeaveToday": 0, "openRequests": 0 }
```

### `GET /analytics/attendance`

**Query:** `range` = `7d` | `30d` | `90d`

```json
{
  "range": "30d",
  "series": [
    { "date": "2026-04-22", "present": 3, "absent": 0, "leave": 0, "wfh": 0, "halfDay": 0 }
  ]
}
```

### `GET /analytics/headcount-by-department`
Array of: `{ "departmentId": "...", "departmentName": "Engineering", "employeeCount": 10, "activeCount": 8 }`

### `GET /analytics/leave-summary`
```json
{ "pending": 0, "approved": 0, "rejected": 0, "withdrawn": 1 }
```

### `GET /analytics/recent-activity`
Array of recent activity events.

---

## Settings

### `GET /settings/tenant`
```json
{
  "company_name": "Acme Corp",
  "timezone": "Asia/Kolkata",
  "working_hours_start": "09:00",
  "working_hours_end": "18:00",
  "fiscal_year_start": 4
}
```

### `PATCH /settings/tenant`
**Required roles:** HR_ADMIN, SUPER_ADMIN. **Body (snake_case):**
```json
{
  "company_name": "Acme Corp",
  "timezone": "Asia/Kolkata",
  "working_hours_start": "09:00",
  "working_hours_end": "18:00"
}
```
**Response `data`:** same shape as GET.

---

### `GET /settings/email-templates`
**Required roles:** HR_ADMIN, SUPER_ADMIN.

**Response `data`:**
```json
{
  "templates": [
    { "id": "...", "type": "LEAVE_APPROVAL", "subject": "Your Leave Request Has Been Approved", "body": "..." }
  ]
}
```
`type` values: `LEAVE_APPROVAL`, `LEAVE_REJECTION`, `ATTENDANCE_ALERT`

### `PATCH /settings/email-templates/:type`
**Body:** `{ "subject": "...", "body": "..." }`

---

### `GET /settings/roles-permissions`
**Required roles:** SUPER_ADMIN.

**Response `data`:**
```json
{
  "roles": ["EMPLOYEE", "HR_ADMIN", "AUDITOR", "MANAGER", "SUPER_ADMIN"],
  "permissions": ["analytics:read", "attendance:read", "attendance:write", "audit:read", "departments:read", "departments:write", "employees:delete", "employees:export", "employees:read", "employees:write", "leave:approve", "leave:read", "leave:request", "permissions:manage"],
  "matrix": {
    "EMPLOYEE":    ["attendance:read", "attendance:write", "leave:read", "leave:request", "audit:read"],
    "HR_ADMIN":    ["employees:read", "employees:write", "employees:delete", "employees:export", "departments:read", "departments:write", "attendance:read", "attendance:write", "leave:read", "leave:approve", "analytics:read", "audit:read"],
    "MANAGER":     ["attendance:read", "leave:approve", "audit:read"],
    "AUDITOR":     ["employees:read", "departments:read", "attendance:read", "leave:read", "analytics:read", "audit:read"],
    "SUPER_ADMIN": ["employees:read", "employees:write", "employees:delete", "employees:export", "departments:read", "departments:write", "attendance:read", "attendance:write", "leave:read", "leave:request", "leave:approve", "analytics:read", "permissions:manage", "audit:read"]
  }
}
```

---

### `PATCH /settings/roles-permissions`
**Required roles:** SUPER_ADMIN.

**Body:** `{ "role": "MANAGER", "permissions": ["attendance:read", "leave:approve"] }`

Replaces full permission set for the role.

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `CANNOT_LOCK_OUT_SUPER_ADMIN` | 403 | Tried to modify SUPER_ADMIN role |
| `ROLE_NOT_FOUND` | 404 | Unknown role key |

---

## Dashboards

### `GET /employee/dashboard`
```json
{
  "employeeName": "Priya Sharma",
  "designation": "Senior Engineer",
  "department": "Engineering",
  "todayAttendance": {},
  "pendingLeaves": 0
}
```

### `GET /employee/team`
Manager + peers in same department.

### `GET /employee/documents`
Array of `EmployeeDocument` records. Also at: `GET /employees/me/documents`

### `GET /manager/dashboard`
**Required roles:** MANAGER, HR_ADMIN, SUPER_ADMIN.
```json
{ "managerName": "Aman Kumar", "teamSize": 19, "pendingApprovals": 0, "todayAttendance": {} }
```

### `GET /manager/team`
Team members under the logged-in manager.

### `GET /manager/approvals`
Pending leave and regularization requests.

---

## Reports

All require HR_ADMIN or SUPER_ADMIN.

### `GET /reports/attendance`
```json
{
  "period": {},
  "summary": { "present": 67, "absent": 0, "late": 0, "on_time": 0, "leave": 0, "wfh": 0, "half_day": 0, "holiday": 0 },
  "by_department": [
    { "department_id": "...", "department_name": "Engineering", "present": 45, "absent": 0, "late": 0, "on_time": 0, "leave": 0, "wfh": 0, "half_day": 0, "holiday": 0 }
  ]
}
```

### `GET /reports/leaves`
Leave summary by department and leave type.

### `GET /reports/payroll`
Payroll summary data.

---

## Audit Logs

### `GET /audit-logs`
**Required roles:** HR_ADMIN, SUPER_ADMIN. **Query:** `page`, `limit`, `entity`, `action`, `userId`

**Response `data`:**
```json
{
  "logs": [
    {
      "id": "...",
      "userId": "...",
      "action": "UPDATE",
      "entity": "Employee",
      "entityId": "...",
      "changes": {},
      "ipAddress": "127.0.0.1",
      "createdAt": "2026-05-22T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 10, "pages": 1 }
}
```

> Shape is `data.logs[]` + `data.pagination` — NOT a flat `data[]` array.

### `GET /audit-logs/:id`
Single audit log entry (direct object, not wrapped in `logs`).

---

## Admin Logs

### `GET /admin/logs`
**Route:** `/api/v1/admin/logs` (NOT `/api/v1/logs`)

**Required roles:** HR_ADMIN, SUPER_ADMIN. **Query:** `level`, `module`, `limit`, `offset`

---

## Export

### `POST /export/employees`
**Body:** `{ "format": "csv", "filters": {} }`
**Response `data`:** `{ "jobId": "...", "status": "PENDING" }`

### `GET /export/:job_id/download`
Download completed export.

### `GET /export/list`
All export jobs for the tenant.

---

## Complete Error Code Reference

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `INVALID_TOKEN` | 401 | Token expired or malformed |
| `INVALID_CREDENTIALS` | 401 | Wrong password or unknown email |
| `TOKEN_REUSE` | 401 | Refresh token reused — session revoked |
| `SESSION_EXPIRED` | 401 | Refresh token expired |
| `FORBIDDEN` | 403 | Authenticated but wrong role |
| `CANNOT_LOCK_OUT_SUPER_ADMIN` | 403 | Cannot modify SUPER_ADMIN permissions |
| `UNAUTHORIZED_ACTION` | 403 | Trying to act on someone else's data |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `LEAVE_REQUEST_NOT_FOUND` | 404 | Leave request not found |
| `LEAVE_TYPE_NOT_FOUND` | 404 | Leave type not found |
| `ROLE_NOT_FOUND` | 404 | Unknown role key |
| `VALIDATION_ERROR` | 422 | Schema validation failed — details is array of {field,message} |
| `AMBIGUOUS_EMAIL` | 400 | Email in multiple tenants — send X-Tenant-Key |
| `MISSING_TENANT` | 400 | Cannot determine tenant |
| `TENANT_INACTIVE` | 403 | Tenant account deactivated |
| `NO_LEAVE_BALANCE` | 400 | No leave balance for this type |
| `OVERLAPPING_LEAVE` | 400 | Date range overlaps existing leave |
| `INSUFFICIENT_BALANCE` | 400 | Not enough leave days available |
| `INVALID_PARENT` | 400 | Parent department doesn't exist |
| `DUPLICATE_EMPLOYEE_CODE` | 409 | Employee code already taken |
| `DUPLICATE_WORK_EMAIL` | 409 | Work email already taken |
| `EMPLOYEE_HAS_DEPENDENTS` | 409 | Employee manages others or heads a dept |
| `DUPLICATE_CODE` | 409 | Department code already taken |
| `DEPARTMENT_CYCLE` | 409 | Setting parent would create circular chain |
| `DEPARTMENT_NOT_EMPTY` | 409 | Dept has employees or sub-departments |
| `LEAVE_ALREADY_DECIDED` | 409 | Leave request is not PENDING |

---

## List Envelope Summary

| Endpoint | Shape |
|----------|-------|
| `GET /employees` | `data: { data: [...], pagination: {} }` — double-nested |
| `GET /departments` | `data: [...]` — flat array of root nodes with nested `children[]` |
| `GET /leave/requests` | `data: { requests: [...], pagination: {} }` |
| `GET /leave/team/requests` | `data: { requests: [...], pagination: {} }` |
| `GET /attendance/records` | `data: { records: [...], pagination: {} }` |
| `GET /audit-logs` | `data: { logs: [...], pagination: {} }` |
| `GET /holidays` | `data: { holidays: [...], total: N }` |
| `GET /analytics/headcount-by-department` | `data: [...]` — flat array |
| `GET /auth/sessions` | `data: [...]` — flat array |

---

## Not Implemented (Prisma models exist, no routes)

| Feature | Status |
|---------|--------|
| Document upload | GET list works, no POST upload (no file storage) |
| Notifications | Prisma model exists, zero routes |
| Resignations | Prisma model exists, zero routes |
| Fine-grained permission enforcement | `authorize()` uses memberType enum, not the Permission tables |
