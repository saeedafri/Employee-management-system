# EMS API — Actual Response Mapping

> **Last verified: 2026-06-10** (BE-1 `/auth/me` auth precedence fix + prior Phase 3 coverage)
> Base URL: `https://employee-management-system-2b9q.onrender.com/api/v1`
> Local: `http://localhost:3000/api/v1`
> Email: Resend HTTP API (port 443, not SMTP — OTP delivery live and tested)
>
> **Cloudinary:** Live on Render (2026-06-09) — cloud `dmljxhmio`. `POST /employees/:id/photo` and `POST /employees/:id/documents` upload to Cloudinary; `GET` returns `fileUrl` on `res.cloudinary.com`. Settings storage integration returns `provider: cloudinary`, `configured: true`.
>
> **MSW (Mock Service Worker):** The deployed Vercel frontend has `NEXT_PUBLIC_USE_MOCKS` controlled by the Vercel env var. Default in code is `false`. If set to `true`, Phase 3 API calls are intercepted by MSW in the browser before reaching the backend BFF proxy. Set it to `false` in Vercel dashboard → Settings → Environment Variables to force real backend calls.

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

**Use `"YYYY-MM-DD"` everywhere. It works on all endpoints.**

| Field | Accepts YYYY-MM-DD | Accepts full ISO |
|-------|-------------------|-----------------|
| `joinedOn`, `dateOfBirth` (employees) | ✅ | ✅ |
| `startDate`, `endDate` (leave requests) | ✅ | ✅ |
| `attendanceDate` (regularization) | ✅ | ✅ |
| `fromDate`, `toDate`, `from_date`, `to_date` (all filters) | ✅ | ✅ |
| `holidayDate` (holidays) | ✅ | ❌ fails 422 |

Full ISO (`"2026-10-20T00:00:00.000Z"`) fails on `holidayDate` only — use YYYY-MM-DD there.

The server stores and returns all dates as full ISO strings (`"2024-01-15T00:00:00.000Z"`).

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
| SUPER_ADMIN | `superadmin@acme.test` | `Password123!` | No employee record — dashboard/attendance/leave calls won't work |
| HR_ADMIN | `mohammadsaeedafri9@gmail.com` | `Password123!` | Full HR access + employee record |
| MANAGER | `aman@acme.test` | `Password123!` | Sees own team (~19 reports) |
| EMPLOYEE | `priya@acme.test` | `Password123!` | Sees own data only |
| EMPLOYEE | `dev1@acme.test` | `Password123!` | Engineering employee |

> MFA is **disabled for all users** — `POST /auth/login` returns `accessToken` directly.  
> OTP is only used in the **forgot-password flow** (`/auth/forgot-password` → email OTP → `/auth/verify-otp` → `/auth/reset-password`).

---

## HTTP Status Code Contract

> Frontend shared error handler depends on this table exactly. Do not deviate.

| Situation | Status | Frontend behavior |
|-----------|-------:|-------------------|
| Success GET/PATCH/DELETE | 200 | normal |
| Success POST create | 201 | normal |
| Success queued/async | 202 | normal |
| **Field-level validation error** | **422** | maps `error.details[]` `{field,message}` to inline field errors |
| Auth missing / token expired / invalid | 401 | silent token refresh; on fail → `/login` |
| Insufficient role / permission | 403 | access-denied UI |
| Not found | 404 | not-found/error state |
| Conflict (duplicate, cycle, dept-not-empty) | 409 | conflict message |
| Malformed JSON / bad request not tied to a field | 400 | generic error banner |
| Server / upstream error | 500/502 | generic error + retry |

### Validation error body (422)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "email", "message": "Invalid email" }],
    "requestId": "req-..."
  }
}
```

`details` is always an **array of `{field, message}`** for 422.  
For all other errors, `details` is an object (may be `{}`).

### What stays 400

- Malformed / unparseable JSON body
- Missing tenant context (`MISSING_TENANT`, `INVALID_TENANT`)
- Ambiguous email across tenants (`AMBIGUOUS_EMAIL`)
- Domain/state errors not tied to a specific request field (`NO_EMPLOYEE_RECORD`, `INVALID_STATUS`, `PARSE_ERROR`)

---

## Auth

### `POST /auth/register` — Public ✅

Creates a new tenant and first SUPER_ADMIN user in a single transaction. No auth headers required.

**Headers:**
```
Content-Type: application/json
```
No `x-tenant-key`, no `Authorization`.

**Body:**
```json
{
  "companyName": "Acme Inc",
  "fullName": "Mohammad Saqib",
  "email": "admin@acme.com",
  "password": "Password123!"
}
```

| Field | Type | Rules |
|-------|------|-------|
| `companyName` | string | min 2 chars |
| `fullName` | string | min 2 chars |
| `email` | string | valid email, lowercased |
| `password` | string | min 8 chars |

**Success — 201:**
```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "sessionId": "...",
    "tenant": { "id": "...", "name": "Acme Inc", "country": null, "currency": null, "timezone": null },
    "user": { "id": "...", "email": "admin@acme.com", "memberType": "SUPER_ADMIN", "employeeId": null, "employee": null },
    "permissions": ["employees:read", "employees:write", "employees:delete", "employees:export", "departments:read", "departments:write", "attendance:read", "attendance:write", "leave:read", "leave:request", "leave:approve", "analytics:read", "permissions:manage", "audit:read"]
  },
  "meta": {}
}
```

Sets cookies: `accessToken` (httpOnly, 15min), `refreshToken` (httpOnly, 30d).  
First user is always `SUPER_ADMIN`. No `Employee` record is created.

**Errors:**
- `409 EMAIL_ALREADY_EXISTS` — email is already registered
- `409 TENANT_ALREADY_EXISTS` — slug collision after retries (rare)
- `422 VALIDATION_ERROR` — missing/invalid fields

---

### `POST /auth/login`

Include `x-tenant-key: acme-corp-001` header. Returns token directly — no OTP step.

**Body:**
```json
{ "email": "superadmin@acme.test", "password": "Password123!" }
```

**Response `data`:**
```json
{
  "accessToken": "eyJ...",
  "sessionId": "fbd3b38de534129c109d90f7",
  "user": {
    "id": "...",
    "email": "superadmin@acme.test",
    "memberType": "SUPER_ADMIN",
    "employeeId": null,
    "employee": null
  },
  "permissions": ["employees:read", "employees:write", "leave:approve", "..."]
}
```

> SUPER_ADMIN: `user.employee` is `null`, `employeeId` is `null`. Do not call employee-specific endpoints (dashboard, check-in, leave requests) for this role — returns `400 NO_EMPLOYEE_RECORD`.  
> All other roles: `employeeId` is populated and employee endpoints work normally.

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `INVALID_CREDENTIALS` | 401 | Wrong password / unknown email |
| `AMBIGUOUS_EMAIL` | 400 | Email exists in multiple tenants — add `X-Tenant-Key` header |
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

**Auth behavior:**

| Case | Status | Error code |
|------|--------|------------|
| Missing cookie / Bearer token | 401 | `UNAUTHORIZED` |
| Garbage or unparseable token | 401 | `INVALID_TOKEN` or `UNAUTHORIZED` |
| Expired / invalid JWT | 401 | `INVALID_TOKEN` |
| Revoked session token | 401 | `INVALID_TOKEN` |
| Explicit invalid `X-Tenant-Key` or tenant subdomain | 400 | `INVALID_TENANT` |
| Valid token | 200 | — |

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

**Behavior:**
- revokes the current server-side session using `request.user.sessionId`
- clears `accessToken` cookie
- clears `refreshToken` cookie
- old copied access tokens from that session stop working immediately
- reusing the old cookie jar, old `accessToken` cookie, or old Bearer token returns `401 INVALID_TOKEN`

### `POST /auth/logout-all`
**Response `data`:** `{ "message": "Logged out from all devices" }`

**Behavior:**
- revokes all sessions for the current user
- clears `accessToken` cookie
- clears `refreshToken` cookie
- old copied access tokens from any revoked session stop working immediately

### `DELETE /auth/sessions/:sessionId`
**Response `data`:** `{ "message": "Session revoked successfully" }`

### `POST /auth/forgot-password`
**Body:** `{ "email": "hr@acme.test" }`
**Response `data`:** `{ "message": "If that email exists, a reset link was sent" }`
Rate limited: 5/15 min.

### `POST /auth/reset-password`
**Body:** `{ "token": "...", "password": "NewPass123!" }`

### `POST /auth/verify-otp`
Only used in MFA flow (not needed for standard login — MFA is disabled).  
**Body:** `{ "challengeId": "...", "code": "123456" }` ← field is `code`, NOT `otp`  
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
  "pagination": { "page": 1, "limit": 20, "total": 79, "pages": 4 }
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
  "employeeCode": "EMP-0082",
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

> `employeeCode` is **optional** — if omitted, auto-generated as `EMP-0001`, `EMP-0082`, etc.  
> Format for new codes is `EMP-XXXX` (4-digit padded). Dates: `"2024-01-15"` also accepted.

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
  "headEmployeeId": "emp_123",
  "depth": 0,
  "headEmployee": { "id": "emp_123", "firstName": "Priya", "lastName": "Sharma" },
  "headEmployeeFirstName": "Priya",
  "headEmployeeLastName": "Sharma",
  "headEmployeeName": "Priya Sharma",
  "_count": { "employees": 7 },
  "directEmployeeCount": 5,
  "children": []
}
```

> `headEmployee` is the nested object; `headEmployeeFirstName` / `headEmployeeLastName` / `headEmployeeName` (concatenated) are convenience fields for table rendering. All four are `null` when no head is set.

> Tree is server-built. `children[]` is populated when sub-departments exist. If all departments are root-level, all `children` arrays are empty — build nothing client-side, the server returns the tree.

### Department employee counts

`_count.employees` is an **inclusive subtree count** — it includes employees directly assigned to the department **and** all employees assigned to any child, grandchild, or deeper descendant departments.

`directEmployeeCount` is the direct-only count (only employees whose `departmentId` equals this department's ID).

**Example:**
```
Engineering (12 direct) → Backend Engineering (2 direct) → Platform (1 direct)
GET /departments response:
  Engineering._count.employees = 15   ← 12 + 2 + 1
  Backend Engineering._count.employees = 3   ← 2 + 1
  Platform._count.employees = 1
```

Use `_count.employees` for cards and badges. Use `directEmployeeCount` only if the UI needs to show "X direct + Y in sub-departments".

---

### `POST /departments`

**Body:**
```json
{ "name": "Marketing", "departmentCode": "MKT", "parentId": null, "headEmployeeId": "emp_123" }
```

> `budget` field does NOT exist in the database. Do not send it.
> `headEmployeeId` is optional — pass an employee ID in this tenant to set the department head, or omit/`null` for none.

**Response:** 201, `data` = department object (includes `headEmployee` + `headEmployeeFirstName` / `headEmployeeLastName` / `headEmployeeName`)

**Error codes:** `DUPLICATE_CODE` (409), `INVALID_PARENT` (400), `INVALID_HEAD_EMPLOYEE` (400), `HEAD_EMPLOYEE_TAKEN` (409)

---

### `PATCH /departments/:id`

**Body:** any subset of `name`, `departmentCode`, `parentId`, `headEmployeeId`.

```json
{ "name": "Backend Engineering", "departmentCode": "ENG-BE", "parentId": "...", "headEmployeeId": "emp_123" }
```

> Set `headEmployeeId` to assign the department head; pass `null` to clear it. The response always echoes the nested `headEmployee` object plus the flat `headEmployeeFirstName` / `headEmployeeLastName` / `headEmployeeName` fields.

**Response:** 200, `data` = updated department:
```json
{
  "id": "...",
  "name": "Backend Engineering",
  "departmentCode": "ENG-BE",
  "parentId": "...",
  "headEmployeeId": "emp_123",
  "headEmployee": { "id": "emp_123", "firstName": "Priya", "lastName": "Sharma" },
  "headEmployeeFirstName": "Priya",
  "headEmployeeLastName": "Sharma",
  "headEmployeeName": "Priya Sharma",
  "parent": { "id": "...", "name": "Engineering" },
  "_count": { "employees": 1 }
}
```

**Error codes:**
| Code | Status | When |
|------|--------|------|
| `NOT_FOUND` | 404 | Department doesn't exist |
| `DEPARTMENT_CYCLE` | 409 | Setting parentId would create a cycle |
| `INVALID_PARENT` | 400 | Parent department doesn't exist |
| `DUPLICATE_CODE` | 409 | Code taken by another department |
| `INVALID_HEAD_EMPLOYEE` | 400 | `headEmployeeId` is not an employee in this tenant |
| `HEAD_EMPLOYEE_TAKEN` | 409 | That employee already heads another department |

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
      "id": "cmpicb6vn000710lt...",
      "referenceNo": "LVR-0019",
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

> `referenceNo` is the human-friendly display ID (e.g. `LVR-0019`). Use `id` (CUID) for all API operations (approve, reject, etc.).

**Statuses:** `PENDING`, `APPROVED`, `DENIED`, `WITHDRAWN`, `CANCELLED`

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

### `POST /attendance/check-in` — Response `data`
```json
{
  "id": "cmpi0p855000p...",
  "referenceNo": "ATT-0068",
  "checkInAt": "2026-05-23T07:18:56.632Z",
  "geofenceValid": true,
  "message": "Checked in successfully"
}
```

### `POST /attendance/check-out` — Response `data`
```json
{
  "id": "...",
  "referenceNo": "ATT-0068",
  "checkInAt": "2026-05-23T07:18:56.632Z",
  "checkOutAt": "2026-05-23T17:30:00.000Z",
  "durationMinutes": 611,
  "message": "Checked out successfully"
}
```

### `GET /attendance/records`

**Query params:** `page`, `limit`, `month` (YYYY-MM), `fromDate`, `toDate`

**Response `data`:**
```json
{
  "records": [
    {
      "id": "...",
      "referenceNo": "ATT-0068",
      "attendanceDate": "2026-05-21T00:00:00.000Z",
      "checkInAt": "2026-05-21T09:12:13.605Z",
      "checkOutAt": "2026-05-21T18:30:00.000Z",
      "status": "PRESENT",
      "workMode": "OFFICE",
      "totalMinutes": 558,
      "notes": null
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 523, "pages": 53 }
}
```

> `referenceNo` is the human-friendly display ID (e.g. `ATT-0068`). Use `id` (CUID) for API operations.

---

### `POST /attendance/regularization` — Response `data`
```json
{ "id": "...", "referenceNo": "REG-0001", "attendanceDate": "...", "status": "PENDING", "reason": "...", "createdAt": "..." }
```

### `GET /attendance/regularization` and `GET /attendance/team/regularization`
Each record includes `referenceNo: "REG-XXXX"` alongside `id`.

---

### `GET /attendance/team/records`
**Required roles:** MANAGER, HR_ADMIN. **Query:** `month` (YYYY-MM), `departmentId`. Same shape (includes `referenceNo`).

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

**Body:**
```json
{ "attendanceDate": "2026-05-20", "reason": "Forgot to check in while in office" }
```

> `type` field is NOT accepted (no column in DB). Only `attendanceDate` and `reason` are required.

### `GET /attendance/regularization`
Own regularization requests.

### `GET /attendance/team/regularization`
**Required roles:** MANAGER, HR_ADMIN.

### `PATCH /attendance/regularization/:id/approve`
**Required roles:** MANAGER, HR_ADMIN.

### `PATCH /attendance/regularization/:id/deny`
**Required roles:** MANAGER, HR_ADMIN.

---

## Employee Documents

### `POST /employees/:id/documents`
Upload a document. **Content-Type:** `multipart/form-data`

**Required roles:** HR_ADMIN, SUPER_ADMIN, or own employee record.  
**Requires:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` env vars on Render.

**Form fields:**
| Field | Type | Required |
|-------|------|----------|
| `file` | File | Yes |
| `documentType` | string | Yes (e.g. `ID_PROOF`, `OFFER_LETTER`, `CONTRACT`) |

**Response `data`:**
```json
{
  "id": "...", "documentType": "ID_PROOF", "fileName": "passport.pdf",
  "fileUrl": "https://res.cloudinary.com/...", "verificationStatus": "PENDING",
  "createdAt": "..."
}
```

**Error codes:** `STORAGE_NOT_CONFIGURED` (503) if Cloudinary env vars not set.

---

### `GET /employees/:id/documents`
**Required roles:** HR_ADMIN, SUPER_ADMIN, or own employee record.  
**Response `data`:** `{ "documents": [...] }`

---

### `DELETE /employees/:id/documents/:docId`
**Required roles:** HR_ADMIN, SUPER_ADMIN only. Deletes from DB + Cloudinary.

---

## Notifications

All notification endpoints require `Authorization: Bearer <token>` and `x-tenant-key` header (or JWT with tenantId).

---

### Notification Object Shape

Every notification object has these fields:

```json
{
  "id": "cmpicb6vn000710ltqbzcrpa0",
  "type": "leave_requested",
  "title": "New Leave Request",
  "message": "Priya Sharma requested 1 day(s) of Annual Leave starting 2026-05-25",
  "metadataJson": {
    "leaveRequestId": "...",
    "employeeId": "...",
    "referenceNo": "LVR-0012"
  },
  "readAt": null,
  "expiresAt": "2026-05-25T08:30:00.000Z",
  "createdAt": "2026-05-24T20:30:00.000Z"
}
```

- `readAt` — `null` means unread; ISO string when marked read
- `expiresAt` — 12 hours after creation; expired notifications are auto-excluded from all responses
- `metadataJson` — optional context for deep-linking (may be null)

---

### Notification Types & Visibility

| Type | Title | Who receives it |
|------|-------|----------------|
| `leave_requested` | "New Leave Request" | Employee's manager + all HR_ADMINs + all SUPER_ADMINs |
| `leave_approved` | "Leave Request Approved" | Employee who submitted the request |
| `leave_denied` | "Leave Request Denied" | Employee who submitted the request |
| `leave_withdrawn` | "Leave Request Withdrawn" | Employee's manager + all HR_ADMINs + all SUPER_ADMINs |
| `attendance_checkin` | "Employee Checked In" | The employee themselves + their manager + all SUPER_ADMINs |
| `attendance_checkout` | "Employee Checked Out" | The employee themselves + their manager + all SUPER_ADMINs |
| `regularization_requested` | "Regularization Request" | Employee's manager + all HR_ADMINs + all SUPER_ADMINs |
| `regularization_approved` | "Regularization Approved" | Employee who submitted the request |
| `regularization_denied` | "Regularization Denied" | Employee who submitted the request |

> **Privacy guarantee**: Employees only see their own notifications. Notifications about employee A are never visible to employee B.

---

### `GET /notifications`
**Query params:** `page` (default 1), `limit` (default 20), `unreadOnly` (`true`/`false`, default false)

**Response `data`:**
```json
{
  "notifications": [
    {
      "id": "...",
      "type": "leave_requested",
      "title": "New Leave Request",
      "message": "Priya Sharma requested 1 day(s) of Annual Leave starting 2026-05-25",
      "metadataJson": { "leaveRequestId": "...", "referenceNo": "LVR-0012" },
      "readAt": null,
      "expiresAt": "2026-05-25T08:30:00.000Z",
      "createdAt": "2026-05-24T20:30:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 }
}
```

> Expired notifications (TTL 12 hours) are automatically excluded. Only the calling user's notifications are returned.

---

### `GET /notifications/unread-count`
Use this for the bell icon badge. Poll every 30–60 seconds if not using SSE.

**Response `data`:** `{ "count": 3 }`

---

### `PATCH /notifications/:id/read`
Mark a single notification as read.

**Response `data`:** the updated notification object (with `readAt` set to current timestamp).

**Error:** `NOT_FOUND` (404) if the notification ID doesn't belong to the current user.

---

### `PATCH /notifications/read-all`
Mark all of the current user's unread notifications as read at once.

**Response `data`:** `{ "success": true }`

---

### `GET /notifications/stream` — Real-Time SSE

Server-Sent Events stream. The browser's `EventSource` API cannot send `Authorization` headers, so the token is passed as a query parameter instead:

```
GET /api/v1/notifications/stream?token=<accessToken>
```

**No request body. No `x-tenant-key` needed** (tenant is resolved from the JWT in `token`).

**Connection behavior:**
- Server sends a 25-second heartbeat comment (`: heartbeat`) to keep the connection alive through proxies/Render
- Client should handle `onerror` and reconnect automatically (EventSource does this natively)
- Connection is in-memory — after a server restart, client must reconnect

**Events emitted:**

| Event name | Sent to | Payload |
|------------|---------|---------|
| `notification` | The specific user the notification belongs to | `{ id, type, title, message, createdAt, metadata }` |
| `analytics_update` | All connected HR_ADMIN and SUPER_ADMIN users | `{ tenantId, ts }` — tells frontend to refetch analytics |

**Full frontend implementation:**
```js
// Connect to SSE stream
const es = new EventSource(
  `/api/v1/notifications/stream?token=${accessToken}`
);

// Handle new notification — update bell icon
es.addEventListener('notification', (e) => {
  const notification = JSON.parse(e.data);
  // notification has: { id, type, title, message, createdAt, metadata }
  showBellNotification(notification);
  incrementUnreadCount();
});

// Handle analytics update — HR admin / Super admin dashboard refresh
es.addEventListener('analytics_update', () => {
  refetchDashboardData(); // re-call /analytics/summary, /analytics/attendance, etc.
});

// Auto-reconnect on disconnect (EventSource handles this natively)
es.onerror = () => {
  console.log('SSE disconnected, will auto-reconnect');
};

// Cleanup
function disconnect() { es.close(); }
```

**When is `analytics_update` fired?**
- Any leave request created, approved, rejected, or withdrawn
- Any attendance check-in or check-out
- Any regularization request created, approved, or denied

> HR_ADMIN and SUPER_ADMIN users should listen for `analytics_update` and call all analytics endpoints again when received — this is what makes the Super Admin dashboard live without manual refresh.

---

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
**Top-level departments only** (parentId = null). `employeeCount` and `activeCount` are **inclusive subtree counts** — each root department's count includes all employees in its child, grandchild, and deeper descendant departments. Sorted by `employeeCount` descending.

```json
{
  "data": [
    { "departmentId": "...", "departmentName": "Engineering", "employeeCount": 14, "activeCount": 12 },
    { "departmentId": "...", "departmentName": "Sales",       "employeeCount": 9,  "activeCount": 9  }
  ],
  "meta": { "cached": false, "generatedAt": "2026-05-24T07:00:00.000Z" }
}
```

> If Engineering has 12 direct employees and Backend Engineering (child) has 2 employees, `employeeCount` is 14.

### `GET /analytics/leave-summary`
```json
{ "data": { "pending": 0, "approved": 4, "rejected": 1, "withdrawn": 1 }, "meta": { "cached": false, "generatedAt": "..." } }
```

### `GET /analytics/recent-activity`
Query params: `?limit=10` (max 50).

Each activity item has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Audit log ID |
| `actorName` | string | Full name of the person who performed the action (e.g. `"Priya Sharma"`) |
| `actorEmail` | string\|null | Email of the actor (null for system events) |
| `action` | string | Raw action code (e.g. `LOGIN`, `LEAVE_REQUEST_CREATED`) |
| `actionLabel` | string | Human-readable verb phrase (e.g. `"logged in"`, `"submitted a leave request"`) |
| `description` | string | Full readable sentence: `"Priya Sharma submitted a leave request"` |
| `entityType` | string | e.g. `User`, `LeaveRequest`, `AttendanceRecord` |
| `entityId` | string | ID of the affected entity |
| `createdAt` | ISO string | UTC timestamp |
| `timestamp` | ISO string | Same as `createdAt` (alias for UI convenience) |
| `displayTime` | string | IST-formatted time: `"24/05/2026 10:30:00 am IST"` |

**Example response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "actorName": "Priya Sharma",
      "actorEmail": "priya@acme.test",
      "action": "LEAVE_REQUEST_CREATED",
      "actionLabel": "submitted a leave request",
      "description": "Priya Sharma submitted a leave request",
      "entityType": "LeaveRequest",
      "entityId": "...",
      "createdAt": "2026-05-24T07:30:00.000Z",
      "timestamp": "2026-05-24T07:30:00.000Z",
      "displayTime": "24/05/2026 01:00:00 pm IST"
    }
  ],
  "meta": { "cached": false, "generatedAt": "..." }
}
```

**Known action codes:**
`LOGIN`, `LOGOUT`, `MFA_LOGIN_INITIATED`, `CREATE`, `UPDATE`, `DELETE`, `APPROVE`, `REJECT`, `DENY`, `WITHDRAW`, `LEAVE_REQUEST_CREATED`, `LEAVE_REQUEST_APPROVED`, `LEAVE_REQUEST_REJECTED`, `LEAVE_REQUEST_WITHDRAWN`, `ATTENDANCE_CHECK_IN`, `ATTENDANCE_CHECK_OUT`, `REGULARIZATION_APPROVED`, `REGULARIZATION_DENIED`, `REGULARIZATION_REQUEST_CREATED`

---

### `GET /analytics/workforce-trend`
**Roles:** HR_ADMIN, SUPER_ADMIN. Query: `?range=6m|12m|2y` (default `6m`).

Returns month-by-month headcount, hires, exits, and net change.

```json
{
  "success": true,
  "data": [
    { "month": "2025-12", "monthLabel": "Dec 2025", "headcount": 70, "hires": 0, "exits": 0, "netChange": 0 }
  ],
  "meta": { "generatedAt": "2026-05-28T..." }
}
```

---

### `GET /analytics/attrition`
**Roles:** HR_ADMIN, SUPER_ADMIN. Query: `?range=6m|12m|2y` (default `6m`).

Returns attrition rate trend over time.

```json
{
  "success": true,
  "data": {
    "currentMonthRate": 0,
    "rollingAnnualRate": 0,
    "trend": [
      { "month": "2025-12", "monthLabel": "Dec 2025", "rate": 0, "exits": 0 }
    ]
  },
  "meta": { "generatedAt": "..." }
}
```

---

### `GET /analytics/payroll-cost`
**Roles:** HR_ADMIN, SUPER_ADMIN. Query: `?range=6m|12m` (default `6m`).

Returns monthly payroll cost trend. Data sourced from live payroll runs (PayrollRun + Payslip models). Falls back to headcount-based estimation only if no payroll runs exist for the period.

```json
{
  "success": true,
  "data": [
    {
      "month": "2025-12", "monthLabel": "Dec 2025",
      "totalNet": 4928000, "totalGross": 5600000,
      "employeeCount": 70, "avgNetPerEmployee": 70400
    }
  ],
  "meta": { "generatedAt": "..." }
}
```

---

### `GET /analytics/department-performance`
**Roles:** HR_ADMIN, SUPER_ADMIN see all departments. MANAGER sees only their own department. EMPLOYEE: 403.
Query: `?range=30d|90d` (default `30d`).

```json
{
  "success": true,
  "data": [
    {
      "departmentId": "...", "departmentName": "Engineering",
      "headcount": 12, "attendanceRate": 80.7, "leaveRate": 0,
      "pendingApprovals": 35, "avgTenureMonths": 68.4
    }
  ],
  "meta": { "generatedAt": "..." }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `attendanceRate` | number | % of present/WFH days in range |
| `leaveRate` | number | % of working days on approved leave |
| `pendingApprovals` | number | Tenant-wide pending leave + regularization requests |
| `avgTenureMonths` | number | Average months since `joinedOn` for active employees |

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

### Phase 2 Report Endpoints (Domain 4)

All Phase 2 report endpoints require **HR_ADMIN or SUPER_ADMIN**. All responses follow the shape:
```json
{ "success": true, "data": { "meta": { "reportName": "...", "generatedAt": "...", "filters": {} }, "summary": {}, "chartData": [], "tableData": { "items": [], "pagination": {} } } }
```

#### `GET /reports/workforce/headcount`
Query: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&departmentId=`
- `data.summary`: `currentHeadcount`, `changeFromStart`, `changePercent`, `netHires`, `netExits`
- `data.chartData[]`: `month`, `monthLabel`, `headcount`, `hires`, `exits`
- `data.tableData.items[]`: `departmentName`, `startHeadcount`, `endHeadcount`, `hires`, `exits`, `changePercent`

#### `GET /reports/workforce/turnover`
Query: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&departmentId=`
- `data.summary`: `totalExits`, `voluntaryExits`, `involuntaryExits`, `averageHeadcount`, `attritionRate`
- `data.chartData[]`: `month`, `monthLabel`, `exits`, `attritionRate`
- `data.tableData.items[]`: `employeeId`, `employeeCode`, `employeeName`, `departmentName`, `designation`, `exitDate`, `exitType`, `tenure`

#### `GET /reports/workforce/demographics`
Query: `?departmentId=`
- `data.byEmploymentType[]`: `type`, `count`, `percent`
- `data.byGender[]`: `gender`, `count`, `percent`
- `data.byDepartment[]`: `departmentName`, `count`, `percent`

#### `GET /reports/attendance/summary`
Query: `?month=YYYY-MM&departmentId=&page=1&limit=20`
- `data.summary`: `month`, `totalWorkingDays`, `avgAttendancePercent`, `totalPresent`, `totalAbsent`, `totalLeave`
- `data.tableData.items[]`: `employeeId`, `employeeCode`, `employeeName`, `departmentName`, `presentDays`, `absentDays`, `leaveDays`, `wfhDays`, `halfDays`, `lateDays`, `attendancePercent`

#### `GET /reports/attendance/absenteeism`
Query: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&departmentId=`
- `data.chartData[]`: `month`, `monthLabel`, `absenteeismRate`, `absences`, `employees`
- `data.tableData.items[]`: `employeeId`, `employeeName`, `absentDays`, `unauthorizedAbsences`, `leaveDays`, `absenteeismRate`

#### `GET /reports/leave/utilization`
Query: `?year=2026&departmentId=&leaveTypeId=`
- `data.summary`: `year`, `totalAllocated`, `totalTaken`, `totalPending`, `utilizationRate`, `avgDaysPerEmployee`
- `data.chartData[]`: `leaveTypeName`, `leaveTypeCode`, `allocated`, `taken`, `pending`, `utilizationRate`
- `data.tableData.items[]`: `employeeId`, `employeeName`, per-leave-type fields (e.g. `annual_leaveAllocated`, `annual_leaveTaken`, `annual_leaveBalance`)

#### `GET /reports/leave/pending`
Query: `?departmentId=&leaveTypeId=&page=1&limit=20`
- `data.tableData.items[]`: `id`, `referenceNo`, `employeeName`, `leaveTypeName`, `startDate`, `endDate`, `totalDays`, `reason`, `appliedAt`, `daysPending`

#### `GET /reports/payroll/summary`
Query: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&departmentId=`
- `data.summary`: `totalPayrollCost`, `avgMonthlyPayroll`, `totalEmployees`, `currency`, `monthsIncluded`
- `data.chartData[]`: `month`, `monthLabel`, `totalGross`, `totalDeductions`, `totalNet`, `employeeCount`
- `data.tableData.items[]`: `departmentName`, `employeeCount`, `totalGross`, `totalDeductions`, `totalNet`, `avgNetPerEmployee`

> **Note:** When live payroll runs exist, figures come from real Payslip data. The headcount-based estimates (FULL_TIME: ₹80,000/mo, PART_TIME/CONTRACT: ₹40,000/mo, INTERNSHIP: ₹20,000/mo) are used as fallback only when no payroll run covers the month.

#### `GET /reports/payroll/ctc-analysis`
Query: `?departmentId=`
- `data.bands[]`: `label`, `count`, `percent` (4 bands: <₹5L, ₹5L–₹10L, ₹10L–₹20L, >₹20L)
- `data.percentiles`: `p25`, `p50`, `p75`, `p90`

#### `POST /reports/export`
**Body:**
```json
{ "reportType": "workforce/headcount", "format": "CSV", "filters": {} }
```
Valid `reportType` values: `workforce/headcount`, `workforce/turnover`, `workforce/demographics`, `attendance/summary`, `attendance/absenteeism`, `leave/utilization`, `leave/pending`, `payroll/summary`, `payroll/ctc-analysis`

Returns 202:
```json
{ "success": true, "data": { "jobId": "...", "status": "PENDING", "message": "Export queued. Use /export/:job_id/download once ready." } }
```

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
      "user_email": "hr@acme.test",
      "action": "UPDATE",
      "entity_type": "Employee",
      "entity_id": "...",
      "old_value": null,
      "new_value": {},
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2026-05-22T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 10, "pages": 1 }
}
```

> Shape is `data.logs[]` + `data.pagination` — NOT a flat `data[]` array.
> All fields are **snake_case**: `user_email`, `entity_type`, `entity_id`, `old_value`, `new_value`, `ip_address`, `user_agent`, `created_at`.

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
**Body:** `{ "format": "csv" }` (format: csv | excel | json)

**Response `data`:**
```json
{ "job_id": "uuid", "status": "QUEUED", "estimated_completion_time": 2 }
```

### `POST /export/attendance`
**Body:** `{ "format": "csv", "from_date": "2026-05-01", "to_date": "2026-05-31" }`

### `POST /export/leave`
**Body:** `{ "format": "csv", "from_date": "2026-05-01", "to_date": "2026-05-31" }`

### `GET /export/:job_id/download`
Download completed export using `job_id` from the POST response.

### `GET /export/list`
**Response `data`:**
```json
{
  "exports": [
    {
      "job_id": "uuid",
      "export_type": "EMPLOYEES",
      "format": "csv",
      "status": "SUCCESS",
      "file_url": null,
      "created_at": "2026-05-23T...",
      "completed_at": "2026-05-23T..."
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 6, "pages": 1 }
}
```

> All export fields are **snake_case**: `job_id`, `export_type`, `file_url`, `created_at`, `completed_at`.

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
| `ALREADY_CHECKED_IN` | 400 | Already checked in today |
| `ALREADY_CHECKED_OUT` | 400 | Already checked out today |
| `NO_CHECK_IN` | 400 | Checkout attempted without a check-in |
| `INVALID_REQUEST_STATUS` | 400 | Regularization not PENDING |
| `REGULARIZATION_NOT_FOUND` | 404 | Regularization request not found |
| `NO_EMPLOYEE_RECORD` | 400 | User has no linked employee profile |
| `OTP_INVALID` | 400 | OTP code is wrong |
| `OTP_EXPIRED` | 400 | OTP has expired |
| `OTP_LOCKED` | 429 | Too many OTP attempts |
| `OTP_RESEND_COOLDOWN` | 429 | Resend requested too soon |
| `STORAGE_NOT_CONFIGURED` | 503 | Cloudinary env vars missing — upload disabled |

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
| `GET /notifications` | `data: { notifications: [...], pagination: {} }` |

---

## Not Implemented (Prisma models exist, no routes)

| Feature | Status |
|---------|--------|
| Document upload | ✅ Implemented — POST/GET/DELETE `/employees/:id/documents`. Requires Cloudinary env vars. |
| Notifications | ✅ Implemented — GET/PATCH + SSE stream at `/notifications/stream` |
| Resignations | Prisma model exists, zero routes |
| Fine-grained permission enforcement | `authorize()` uses memberType enum, not the Permission tables |

## Human-Friendly Reference Numbers

All major entities now include a `referenceNo` display field in API responses:

| Entity | Format | Example | Use in API calls |
|--------|--------|---------|-----------------|
| Leave Request | `LVR-XXXX` | `LVR-0025` | No — use `id` (CUID) |
| Attendance Record | `ATT-XXXX` | `ATT-0068` | No — use `id` (CUID) |
| Regularization | `REG-XXXX` | `REG-0001` | No — use `id` (CUID) |
| Employee | `employeeCode` | `EMP-0080` | No — use `id` (CUID) |

> `referenceNo` is display-only (for UI, tickets, support). All API operations (approve, reject, download, etc.) use the `id` field (CUID).

---

## New Endpoints (Added 2026-05-24 — Wireframe Gap Fill)

### `GET /holidays/upcoming`
Widget data for the employee dashboard.

**Query:** `?limit=3` (default 3, max 10)

**Response `data`:**
```json
{
  "holidays": [
    {
      "id": "...",
      "name": "Eid al-Adha",
      "holidayDate": "2026-06-06T00:00:00.000Z",
      "isOptional": false,
      "location": null
    }
  ],
  "total": 3
}
```

---

### `GET /employees/next-code`
Used by the Create Employee form to pre-fill the employee code field.

**Required roles:** HR_ADMIN, SUPER_ADMIN

**Response `data`:** `{ "nextCode": "EMP-0081" }`

---

### `GET /departments/:id`
Department detail panel — headcount, sub-departments, managers, employee list.

**Response `data`:**
```json
{
  "id": "...",
  "name": "Engineering",
  "departmentCode": "ENG",
  "depth": 0,
  "parentId": null,
  "parent": null,
  "headEmployee": { "id": "...", "firstName": "Aman", "lastName": "Sharma" },
  "subDepartments": [
    { "id": "...", "name": "Backend", "departmentCode": "BACK" }
  ],
  "totalHeadcount": 22,
  "subDeptCount": 3,
  "managerCount": 4,
  "employees": [
    {
      "id": "...",
      "firstName": "Priya",
      "lastName": "Sharma",
      "employeeCode": "E0002",
      "designation": "Software Engineer",
      "employmentStatus": "ACTIVE"
    }
  ]
}
```

> `totalHeadcount` is an **inclusive subtree count** — includes all employees in this department and all descendant departments (children, grandchildren, etc.). The `employees` preview array (up to 50) also includes employees from all descendant departments.

---

### `GET /leave/types` — extended with CRUD

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/leave/types` | all authenticated | List active leave types |
| POST | `/leave/types` | HR_ADMIN, SUPER_ADMIN | Create new leave type |
| PATCH | `/leave/types/:id` | HR_ADMIN, SUPER_ADMIN | Update fields |
| DELETE | `/leave/types/:id` | HR_ADMIN, SUPER_ADMIN | Soft-deactivate (sets isActive=false) |

**POST body:**
```json
{ "name": "Bereavement Leave", "code": "BRVMT", "annualAllowance": 5, "isPaid": true, "carryForwardAllowed": false }
```
Required: `name`, `code`. Code must be unique per tenant. Once deactivated, code is freed for re-use.

**Error codes:** `DUPLICATE_LEAVE_TYPE_CODE` (409)

---

### `GET /leave/team/requests` — now supports `?employeeId=`

Add `?employeeId=<id>` to filter leave requests to a single employee (used on employee profile Leave tab).
Other filters still apply: `status`, `fromDate`, `toDate`, `page`, `limit`.

---

### `GET /leave/team/calendar`
Team calendar view — who is on leave in a given month.

**Required roles:** MANAGER, HR_ADMIN  
**Query:** `?month=2026-05` (YYYY-MM, defaults to current month)

**Response `data`:**
```json
{
  "month": "2026-05",
  "employees": [
    {
      "id": "...",
      "name": "Priya Sharma",
      "employeeCode": "E0002",
      "leaves": [
        {
          "id": "...",
          "startDate": "2026-05-27T18:30:00.000Z",
          "endDate": "2026-05-29T18:30:00.000Z",
          "totalDays": 3,
          "status": "PENDING",
          "leaveType": "Annual Leave",
          "leaveTypeCode": "ANNUAL"
        }
      ]
    }
  ]
}
```

---

### `GET /leave/balance/me`
Alias for `GET /leave/balance` — used by the employee dashboard widget. Same response shape.

---

### `POST /leave/requests/bulk-approve` (also: `POST /leave/requests/bulk/approve`)
**Required roles:** MANAGER, HR_ADMIN

**Body:**
```json
{ "ids": ["id1", "id2"], "comment": "Approved in bulk" }
```

**Response `data`:**
```json
{
  "succeeded": ["id1"],
  "failed": [
    { "id": "id2", "code": "ERROR", "message": "Cannot approve leave with status APPROVED" }
  ]
}
```

- `succeeded` — flat array of string IDs successfully approved
- `failed` — array of `{ id, code, message }` for each that failed
- Each request is processed independently — partial success is normal
- `code` is always `"ERROR"` in failed items (no per-item error codes)

> **Fixed 2026-05-27:** No longer crashes with `"Cannot read properties of null (reading 'pending')"` when a leave request has no LeaveBalance record (common with seeded/imported data). Balance update is safely skipped; approve still succeeds.

---

### `POST /leave/requests/bulk-deny` (also: `POST /leave/requests/bulk/reject`)
Same response shape as bulk-approve. `comment` optional — defaults to `"Bulk denied"` if omitted.

> Same null-balance fix applied — deny no longer crashes on requests without a LeaveBalance row.

---

### `GET /attendance/team/records` — now supports `?employeeId=`
Add `?employeeId=<id>` to filter to a single employee (used on employee profile Attendance tab).

---

### `GET /audit-logs` — now supports `?entity=` and `?entityId=`
Filter audit logs by entity type and/or entity ID.

| Param | Example | Notes |
|-------|---------|-------|
| `entity` | `Employee` | Matches `entityType` field in DB |
| `entityId` | `cmpfypq1h001eunacja7guack` | Filter to specific record |

---

### `GET /settings/tenant` — now includes Tenant identity fields

Response now returns both company identity fields (from `Tenant` model) and operational config (from `TenantConfig`):

```json
{
  "legalName": "Acme Corporation Pvt Ltd",
  "displayName": "Acme",
  "country": "India",
  "defaultCurrency": "INR",
  "primaryContactEmail": "hr@acme.test",
  "supportPhone": "+91 11 40000000",
  "logoUrl": null,
  "company_name": "Acme Corp",
  "timezone": "Asia/Kolkata",
  "working_hours_start": "09:00",
  "working_hours_end": "18:00",
  "fiscal_year_start": 4
}
```

### `PATCH /settings/tenant` — now accepts Tenant identity fields

Extended body — any combination of:
```json
{
  "legalName": "...",
  "displayName": "...",
  "country": "IN",
  "defaultCurrency": "INR",
  "primaryContactEmail": "hr@company.com",
  "supportPhone": "+91...",
  "logoUrl": "https://...",
  "company_name": "...",
  "timezone": "Asia/Kolkata",
  "working_hours_start": "09:00",
  "working_hours_end": "18:00"
}
```
All fields optional. Returns the merged settings object (same shape as GET).

---

## New Endpoints — Implemented 2026-05-25 (UI Team Requests)

> All routes below are live. Auth: Bearer token or `accessToken` cookie. Tenant resolved from JWT.

---

### Notifications

#### `GET /notifications`

**Roles:** any authenticated user.

**Query params:**
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | integer | 1 | |
| `limit` | integer | 20 | |
| `unreadOnly` | boolean | false | Filter unread only |
| `since` | ISO timestamp | — | Return items newer than this (polling) |

**Response `data`:**
```json
{
  "notifications": [
    {
      "id": "n_01",
      "type": "LEAVE_APPROVED",
      "title": "Your leave request was approved",
      "body": "Aman Kumar approved your annual leave.",
      "entityType": "LeaveRequest",
      "entityId": "lr_99",
      "actionUrl": "/leave?tab=my-requests&id=lr_99",
      "isRead": false,
      "createdAt": "2026-05-22T09:12:00.000Z"
    }
  ],
  "unreadCount": 4,
  "pagination": { "page": 1, "limit": 20, "total": 27, "pages": 2 }
}
```

#### `POST /notifications/:id/read`
Mark a single notification read.
**Response:** `{ "id": "n_01", "isRead": true }`

#### `PATCH /notifications/:id/read`
Alias — same as POST above.

#### `POST /notifications/read-all`
Mark all notifications read for the caller.
**Response:** `{ "markedRead": 7 }`

#### `PATCH /notifications/read-all`
Alias — same as POST above.

---

### Global Search

#### `GET /search?q=<query>`

**Roles:** any authenticated user. Permission-aware — employees see only self + direct reports.

**Query params:**
| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `q` | string | required | Min 1 char |
| `types` | string | all | Comma-separated: `employee,department,leave,holiday` |
| `limit` | integer | 8 | Max 20 |

**Response `data`:**
```json
{
  "results": [
    {
      "type": "employee",
      "id": "emp_...",
      "label": "Priya Sharma",
      "sublabel": "Senior Engineer · Engineering",
      "url": "/employees/emp_..."
    },
    {
      "type": "department",
      "id": "dep_...",
      "label": "Engineering",
      "sublabel": "14 employees",
      "url": "/departments?id=dep_..."
    }
  ],
  "groupedCounts": { "employee": 5, "department": 1, "leave": 2 }
}
```

---

### Employees

#### `GET /employees/next-code`

**Roles:** HR_ADMIN, SUPER_ADMIN.

**Response:** `{ "code": "E0081" }`

Format: `E` + 4-digit zero-padded number. Auto-increments, skips existing codes.

#### `POST /employees/bulk/deactivate`

**Roles:** HR_ADMIN, SUPER_ADMIN.

**Body:** `{ "ids": ["emp_a", "emp_b"] }`

**Response `data`:**
```json
{
  "succeeded": ["emp_a"],
  "failed": [{ "id": "emp_b", "code": "EMPLOYEE_HAS_DEPENDENTS", "message": "Has 3 direct reports." }]
}
```

#### `POST /employees/bulk/export`

**Roles:** HR_ADMIN, SUPER_ADMIN.

**Body:** `{ "ids": ["emp_a"], "format": "csv" }` — format: `csv | excel | json`, default `csv`.

**Response:** `{ "jobId": "...", "status": "PENDING" }`

#### `POST /employees/:id/documents/presign`

**Roles:** HR_ADMIN, SUPER_ADMIN, or self.

**Body:**
```json
{
  "filename": "Aadhaar.pdf",
  "contentType": "application/pdf",
  "size": 2415616,
  "category": "AADHAAR"
}
```
`category` enum: `OFFER_LETTER | AADHAAR | PAN | BANK | CONTRACT | OTHER`

**Response `data`:**
```json
{
  "uploadUrl": "/api/v1/employees/:id/documents",
  "method": "POST",
  "headers": { "Content-Type": "multipart/form-data" },
  "documentId": "doc_pending_..."
}
```
> **Deviation from S3 presign:** Cloudinary does not support unauthenticated PUT presign URLs. `uploadUrl` points to our own multipart endpoint. Upload via `POST` with `multipart/form-data`, then call `/confirm`.

#### `POST /employees/:id/documents/:documentId/confirm`

Call after file upload completes. Returns the confirmed document record.

**Response 201:** document object (same shape as GET /employees/:id/documents items).

#### `GET /employees/:id/documents/:documentId/download`

**Response 302:** redirect to short-lived signed download URL.

---

### Departments

#### `GET /departments/:id/employees`

**Roles:** any authenticated user.

**Query params:** `page` (default 1), `limit` (default 20), `search` (optional name filter).

Returns employees assigned to the selected department **and all descendant departments** (children, grandchildren, etc.). `pagination.total` reflects the full subtree count.

**Response `data`:**
```json
{
  "data": [
    {
      "id": "emp_...",
      "firstName": "Priya",
      "lastName": "Sharma",
      "employeeCode": "E0001",
      "designation": "Senior Engineer",
      "employmentStatus": "ACTIVE",
      "department": { "id": "...", "name": "Backend Engineering" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 14, "pages": 1 }
}
```

> `department` field shows which specific sub-department each employee belongs to — useful when the selected department is a parent and employees come from different sub-departments.

#### `POST /departments/:id/reassign-and-delete`

**Roles:** HR_ADMIN, SUPER_ADMIN.

Reassigns all active employees to the target department, then soft-deletes the source department. Atomic transaction.

**Body:** `{ "reassignEmployeesTo": "dep_target_id" }`

**Response `data`:** `{ "id": "dep_old_id", "status": "archived", "reassignedEmployees": 14 }`

**Errors:**
| Code | Status | When |
|-------|--------|------|
| `INVALID_TARGET` | 400 | Target doesn't exist |
| `SAME_DEPARTMENT` | 400 | Source = target |

---

### Leave

#### `GET /leave/team/coverage`

**Roles:** MANAGER, HR_ADMIN, SUPER_ADMIN.

**Query params:** `date` (YYYY-MM-DD, required), `departmentId` (optional filter).

**Response `data`:**
```json
{
  "date": "2026-06-15",
  "totalTeam": 12,
  "onLeave": 4,
  "available": 8,
  "coveragePercent": 67,
  "thresholdPercent": 70,
  "isBelowThreshold": true
}
```

#### `POST /leave/requests/bulk/approve`

**Roles:** MANAGER, HR_ADMIN.

**Body:** `{ "ids": ["lr_a", "lr_b"], "comment": "Approved in bulk" }` — comment optional.

**Response `data`:**
```json
{
  "succeeded": ["lr_a", "lr_c"],
  "failed": [{ "id": "lr_b", "code": "ERROR", "message": "Cannot approve leave with status APPROVED" }]
}
```

- `succeeded` — flat array of string IDs that were successfully approved
- `failed[].code` — always `"ERROR"` (not a specific code per item)
- `failed[].message` — human-readable reason

**Common failure messages:**
| Message | Cause |
|---------|-------|
| `Cannot approve leave with status APPROVED` | Already approved |
| `Cannot approve leave with status DENIED` | Already rejected |
| `Leave request not found` | ID doesn't exist or belongs to another tenant |

> **Fixed 2026-05-27:** Requests approved/rejected/withdrawn where no LeaveBalance row exists (seeded data) no longer crash with `"Cannot read properties of null (reading 'pending')"`. Balance update is safely skipped when no balance record exists.

**Also available at:** `POST /leave/requests/bulk-approve` (legacy kebab path — same handler).

#### `POST /leave/requests/bulk/reject`

Same response shape as bulk/approve. `comment` optional — defaults to `"Bulk denied"`.

**Common failure messages:**
| Message | Cause |
|---------|-------|
| `Cannot reject leave with status DENIED` | Already rejected |
| `Cannot reject leave with status APPROVED` | Already approved |
| `Leave request not found` | ID not found |

**Also available at:** `POST /leave/requests/bulk-deny` (legacy kebab path — same handler).

---

### Attendance

#### `GET /attendance/team/weekly`

**Roles:** MANAGER, HR_ADMIN, SUPER_ADMIN.

**Query params:** `weekStart` (YYYY-MM-DD, defaults to current Mon), `departmentId` (optional).

**Response `data`:**
```json
{
  "weekStart": "2026-05-25",
  "members": [
    {
      "employeeId": "emp_...",
      "name": "P. Sharma",
      "designation": "Sr Engineer",
      "days": [
        { "date": "2026-05-25", "code": "P" },
        { "date": "2026-05-26", "code": "L" },
        { "date": "2026-05-27", "code": "A" },
        { "date": "2026-05-28", "code": "W" },
        { "date": "2026-05-29", "code": "O" }
      ]
    }
  ]
}
```

**`code` enum:** `P` (Present) | `A` (Absent) | `L` (Leave) | `W` (WFH) | `H` (Half-day) | `O` (Holiday/weekend).

---

### Settings

All settings endpoints use **`snake_case`** field names.

#### `GET /settings/branding` · `PATCH /settings/branding`

**Roles:** HR_ADMIN, SUPER_ADMIN (PATCH). Any admin (GET).

**Response / PATCH body (any subset):**
```json
{
  "logo_url": "https://cdn.../logo.png",
  "primary_color_hex": "#3b5cff"
}
```

PATCH via `multipart/form-data` with field `logo` (image ≤ 1 MB PNG/SVG), or JSON with `logo_url`.

#### `GET /settings/attendance-rules` · `PATCH /settings/attendance-rules`

**Roles:** HR_ADMIN, SUPER_ADMIN.

```json
{
  "work_week_days": ["MON", "TUE", "WED", "THU", "FRI"],
  "late_after": "09:30",
  "half_day_threshold_minutes": 240,
  "full_day_threshold_minutes": 480,
  "regularization_window_days": 7,
  "geo_fencing_enabled": false
}
```

#### `GET /settings/security/auth` · `PATCH /settings/security/auth`

**Roles:** SUPER_ADMIN only.

```json
{
  "password_min_length": 12,
  "password_require_symbol": true,
  "password_require_number": true,
  "session_idle_timeout_minutes": 60,
  "mfa_policy": "OPTIONAL",
  "sso_enabled": false
}
```

`mfa_policy` enum: `OPTIONAL | REQUIRED_ADMINS | REQUIRED_ALL`

#### `GET /settings/notifications/preferences` · `PATCH /settings/notifications/preferences`

**Scope:** per-caller (not per-tenant). Each user sees/updates their own prefs.

```json
{
  "channels": { "in_app": true, "email": true },
  "events": {
    "leave_approved":            ["in_app", "email"],
    "leave_rejected":            ["in_app", "email"],
    "leave_requested":           ["in_app"],
    "attendance_regularization": ["in_app", "email"]
  }
}
```

#### `GET /settings/leave-types` · `POST /settings/leave-types` · `PATCH /settings/leave-types/:id` · `DELETE /settings/leave-types/:id`

Same as the existing `/leave/types` alias. POST creates a new leave type:

**POST body:**
```json
{
  "name": "Bereavement",
  "code": "BEREAVEMENT",
  "annualAllowance": 5,
  "carryForwardAllowed": false,
  "isPaid": true,
  "color": "#94a3b8"
}
```

**Errors:** `DUPLICATE_LEAVE_TYPE_CODE` (409), `LEAVE_TYPE_IN_USE` (409 on DELETE if balances exist).

#### Custom Roles

##### `POST /settings/roles`

**Roles:** HR_ADMIN, SUPER_ADMIN.

**Body:** `{ "name": "Recruiter", "key": "RECRUITER", "permissions": ["employees:read"] }`

**Response 201:** `{ "key": "RECRUITER", "name": "Recruiter", "permissions": [...] }`

**Error:** `DUPLICATE_ROLE_KEY` (409).

##### `DELETE /settings/roles/:key`

**Response:** `{ "key": "RECRUITER", "status": "deleted" }`

**Error:** `ROLE_IN_USE` (409) if users assigned to this role.

##### `POST /settings/roles/:key/users`

**Body:** `{ "userIds": ["usr_a", "usr_b"] }`

**Response:** `{ "assigned": ["usr_a", "usr_b"] }`

---

### Dashboard Analytics

#### `GET /analytics/summary` — Extended with deltas

Response now includes an additive `deltas` block (existing top-level fields unchanged):

```json
{
  "totalEmployees": 80,
  "activeToday": 62,
  "onLeaveToday": 5,
  "openRequests": 3,
  "deltas": {
    "totalEmployees": { "delta": 2, "deltaLabel": "vs last month" },
    "activeToday":    { "deltaPercent": 3.1 },
    "onLeaveToday":   { "delta": 1 },
    "openRequests":   { "urgent": 0 }
  }
}
```

#### `GET /analytics/recent-activity` — Extended with entity labels

Each activity item now includes human-readable `entity_label` and `entity_url`:

```json
{
  "id": "audit_...",
  "user_email": "hr@acme.test",
  "action": "UPDATE",
  "entity_type": "Employee",
  "entity_id": "cmpfypq1h001eunacja7guack",
  "entity_label": "E0001 · Aman Kumar",
  "entity_url": "/employees/cmpfypq1h001eunacja7guack",
  "created_at": "2026-05-22T..."
}
```

If entity was deleted: `entity_label: "<type> (deleted)"`, `entity_url: null`.

#### `GET /manager/dashboard` — Extended

Added `approvalBreakdown`, `presentToday`, `avgAttendancePercent`:

```json
{
  "managerName": "Aman Kumar",
  "teamSize": 19,
  "pendingApprovals": 5,
  "approvalBreakdown": { "leave": 3, "regularization": 2 },
  "presentToday": 11,
  "avgAttendancePercent": 94,
  "todayAttendance": {}
}
```

#### `GET /employee/dashboard` — Extended

Added `todayAttendance` (camelCase field names) and `leaveBalanceSummary` (top-3 active types):

```json
{
  "employeeName": "Priya Sharma",
  "designation": "Senior Engineer",
  "department": "Engineering",
  "pendingLeaves": 0,
  "todayAttendance": {
    "checkedInAt": "2026-05-25T09:14:00.000Z",
    "checkedOutAt": null,
    "workMode": "WFH",
    "status": "PRESENT"
  },
  "leaveBalanceSummary": [
    { "code": "CASUAL",  "name": "Casual", "available": 6 },
    { "code": "SICK",    "name": "Sick",   "available": 4 },
    { "code": "ANNUAL",  "name": "Earned", "available": 12 }
  ]
}
```

---

## UI-Requested Endpoints — All Live ✅ (2026-05-28, fully tested end-to-end)

> All 7 endpoints from `api_to_be_created.md` are implemented and tested.
> MSW mock handlers can be removed.

---

### `POST /auth/otp/initiate` — Public ✅

Send or resend OTP for an existing MFA challenge. Required when login returns `mfaRequired: true`.

**Request body:**
```json
{ "challengeId": "c74f9dc8-55c2-47f7-a081-a73d01681886" }
```

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "challengeId": "c74f9dc8-...",
    "deliveryMethod": "EMAIL",
    "expiresAt": "2026-05-27T18:43:43.526Z",
    "resendAvailableAt": "2026-05-27T18:35:05.325Z"
  },
  "meta": {}
}
```

**Error responses:**

| HTTP | Code | When |
|------|------|------|
| 404 | `CHALLENGE_NOT_FOUND` | challengeId unknown or expired |
| 429 | `RESEND_TOO_SOON` | Called within 60 seconds of last send |
| 429 | `MAX_RESENDS` | More than 3 resend attempts on this challenge |

**How OTP challenges are created:** Login with a user that has `mfaEnabled: true` — the login response returns `{ mfaRequired: true, challengeId }` instead of tokens. Currently no users have MFA enabled by default.

---

### `POST /holidays/import` — HR_ADMIN, SUPER_ADMIN ✅

Upload `.ics` iCalendar file to bulk-import holidays. Two-step: upload → preview → commit.

**Request:** `multipart/form-data`, field `file`, `.ics` / `text/calendar`, max 1 MB.

**Success response (202):**
```json
{
  "success": true,
  "data": {
    "jobId": "imp_89eff8fa",
    "previewUrl": "/api/v1/holidays/import/imp_89eff8fa/preview"
  },
  "meta": {}
}
```

**Error responses:**

| HTTP | Code | When |
|------|------|------|
| 403 | `FORBIDDEN` | MANAGER or EMPLOYEE role |
| 422 | `INVALID_FILE_TYPE` | Not a `.ics` / `text/calendar` file |
| 422 | `FILE_TOO_LARGE` | File exceeds 1 MB |
| 400 | `PARSE_ERROR` | Malformed `.ics` content |

**Notes:** Job is held in memory with 15-min TTL. No DB writes until commit.

---

### `GET /holidays/import/:jobId/preview` — HR_ADMIN, SUPER_ADMIN ✅

Preview candidates from an upload job before committing.

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "candidates": [
      { "name": "Test Holiday A", "date": "2027-03-01", "isOptional": false, "willOverwrite": false },
      { "name": "Test Holiday B", "date": "2027-04-01", "isOptional": true,  "willOverwrite": false }
    ],
    "summary": { "new": 2, "overwrites": 0, "skipped": 0 }
  },
  "meta": {}
}
```

- `willOverwrite: true` → a holiday already exists for that date in this tenant
- `isOptional` → mapped from `TRANSP:TRANSPARENT` in the `.ics`

**Error:** `404 JOB_NOT_FOUND`

---

### `POST /holidays/import/:jobId/commit` — HR_ADMIN, SUPER_ADMIN ✅

Persist holidays from a previewed import job to the DB.

**Request body:**
```json
{ "overwriteExisting": true }
```
- `overwriteExisting: true` → upsert holidays that already exist for the same date
- `overwriteExisting: false` → skip holidays whose date already exists (count in `skipped`)

**Success response (200):**
```json
{
  "success": true,
  "data": { "imported": 3, "overwritten": 0, "skipped": 0 },
  "meta": {}
}
```

**Error responses:**

| HTTP | Code | When |
|------|------|------|
| 404 | `JOB_NOT_FOUND` | jobId expired or never existed |
| 409 | `ALREADY_COMMITTED` | commit called twice on same job |

---

### `GET /employee/documents` — any authenticated (own employee record only) ✅

Self-service document list for the logged-in user's employee profile.

**Success response (200):**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_a1b2c3",
        "filename": "Aadhaar Card.pdf",
        "category": "AADHAAR",
        "sizeBytes": 2415616,
        "status": "VERIFIED",
        "uploadedAt": "2026-01-15T10:00:00.000Z"
      }
    ]
  },
  "meta": {}
}
```

**Notes:**
- Returns `documents: []` if the employee has no documents — never errors on empty list.
- `status` enum: `VERIFIED | PENDING | REJECTED`
- `400 NO_EMPLOYEE_RECORD` if user has no linked employee record (e.g. SUPER_ADMIN with no employee profile).
- Distinct from `GET /employees/:id/documents` (HR admin, any employee).

---

### `GET /employee/dashboard` — leaveBalanceSummary field ✅

Field `leaveBalanceSummary` is present in the live response. Top-3 active leave types.

**Shape in response:**
```json
"leaveBalanceSummary": [
  { "code": "ANNUAL", "name": "Annual Leave", "available": 21 },
  { "code": "CASUAL", "name": "Casual Leave", "available": 10 },
  { "code": "SICK",   "name": "Sick Leave",   "available": 10 }
]
```

Returns `[]` if employee has no leave balance records.

---

### `POST /attendance/regularization/:id/documents` — EMPLOYEE, MANAGER (own requests only) ✅

Attach a supporting document to a regularization request. One document per request.

**Request:** `multipart/form-data`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `document` | File | Yes | PDF, JPG, PNG, DOC, DOCX. Max 5 MB. Field name `file` also accepted. |

**Success response (201):**
```json
{
  "success": true,
  "data": {
    "documentUrl": "https://res.cloudinary.com/dmljxhmio/image/upload/v1.../document.png"
  },
  "meta": {}
}
```

**Error responses:**

| HTTP | Code | When |
|------|------|------|
| 403 | `FORBIDDEN` | HR/SA trying to upload on another employee's request |
| 404 | `REGULARIZATION_NOT_FOUND` | `:id` unknown or not in this tenant |
| 409 | `DOCUMENT_ALREADY_EXISTS` | Document already attached to this request |
| 422 | `INVALID_FILE_TYPE` | Not PDF/JPG/PNG/DOC/DOCX |
| 422 | `FILE_TOO_LARGE` | Exceeds 5 MB |
| 502 | `UPLOAD_FAILED` | Cloudinary upload error (transient) |
| 503 | `STORAGE_NOT_CONFIGURED` | Cloudinary env vars not set on server |

---

## 2026-05-26 Batch — Profile Photos + Swagger Completeness

### `POST /employees/:id/photo` — HR_ADMIN, SUPER_ADMIN, own employee ✅ live
Upload or replace an employee's profile photo.  
**Body:** `multipart/form-data` field `file` — any image format (JPEG/PNG/WebP/GIF).  
**Behavior:** Image is automatically resized to max 800×800 and converted to **WebP format** before storage.  
Old photo is automatically deleted from Cloudinary before uploading new one.  
**Response 200:** `{ success: true, data: { id, profilePhotoUrl } }`

### `DELETE /employees/:id/photo` — HR_ADMIN, SUPER_ADMIN, own employee ✅ live
Delete an employee's profile photo from Cloudinary and clear the `profilePhotoUrl` field.  
**Response 200:** `{ success: true, message: "Profile photo deleted" }`

### `GET /employees/:id` — profilePhotoUrl now included ✅
`Employee` response now includes `profilePhotoUrl` (nullable string — Cloudinary WebP URL or null).

### `GET /holidays/upcoming` ✅ live (was missing from Swagger)
**Query:** `?limit=3` (1–10)  
Returns upcoming holidays for the employee dashboard widget.

### `GET /employees/me/documents` ✅ live alias
Same as `GET /employee/documents` — returns current user's documents.

### `GET /employees/me/team` ✅ live alias
Same as `GET /employee/team` — returns current user's team.

### `GET /leave/balance/me` ✅ live alias
Same as `GET /leave/balance` — returns current employee's leave balance.

### `GET /leave/team/calendar` ✅ live (was missing from Swagger)
**Query:** `?month=YYYY-MM&departmentId=<id>`  
Returns who is on leave for a given month. MANAGER+ only.

---

## Schema Change: Employee.profilePhotoUrl
New nullable field `profilePhotoUrl String?` added to `Employee` model.  
Applied via `npx prisma db push` (no migration needed — additive change).  
All 201 employees seeded with unique WebP avatar images (colored initials avatars).  
Seed script: `npm run db:seed:photos`


---

## Phase 2 — Domain 1-3: Payroll Module (25 endpoints)
**Added:** 2026-05-28 | **Roles:** HR_ADMIN/SUPER_ADMIN (unless noted)

### Salary Components
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/components` | HR,SA | `?active=true\|false`. Returns array of component objects |
| POST | `/payroll/components` | HR,SA | 201. Required: name, code (UPPER_SNAKE_CASE), type, calculationType, taxable. 409 CODE_EXISTS |
| PATCH | `/payroll/components/:id` | HR,SA | code is immutable → 400 CODE_IMMUTABLE |
| DELETE | `/payroll/components/:id` | SA only | 409 COMPONENT_IN_USE if referenced by pay groups |

**Component shape:** `{ id, name, code, type(EARNING|DEDUCTION|BENEFIT|REIMBURSEMENT), calculationType(FLAT|PERCENTAGE|FORMULA), value, basisCode, formula, taxable, active, displayOrder, description, createdAt, updatedAt }`

### Pay Groups
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/groups` | HR,SA | Returns groups with `components[]` and `employeeCount` |
| POST | `/payroll/groups` | HR,SA | 201. Required: name, code. Optional: components[]{componentId, overrideCalculationType, overrideValue, overrideFormula} |
| PATCH | `/payroll/groups/:id` | HR,SA | code immutable. Replaces components array if provided |
| DELETE | `/payroll/groups/:id` | SA only | 409 GROUP_HAS_EMPLOYEES with `{employeeCount}` in details |
| GET | `/payroll/schedules` | HR,SA | Returns BIWEEKLY/WEEKLY groups as schedule records |

### Employee Salary Config
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/employees/:employeeId/salary` | HR,SA,EMP(own) | EMP sees own with bankAccountNumber masked (XXXX1234). Includes calculatedComponents[], history[] |
| POST | `/payroll/employees/:employeeId/salary` | HR,SA | 201. Required: payGroupId, annualCtc, effectiveFrom. Closes previous record's effectiveTo |
| PATCH | `/payroll/employees/:employeeId/salary` | HR,SA | 201. Always creates new history record, never edits in place |

### Employee Payslips (self-service)
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/employees/:employeeId/payslips` | HR,SA,EMP(own) | `?page&limit&year`. Paginated list. EMPLOYEE sees own only. |
| GET | `/payroll/employees/:employeeId/payslips/:payslipId` | HR,SA,EMP(own) | Full detail: earnings[], deductions[], oneTimeAdditions[], oneTimeDeductions[], attendance fields, `documentUrl` (Cloudinary WebP URL or null) |

#### 👉 UI TEAM — How to view & download a payslip document

The payslip PDF is stored on Cloudinary as a WebP image. The download link is the
`documentUrl` field returned by the **payslip detail** endpoint (NOT the list endpoint).

**Step 1 — Login (no `X-Tenant-Key` needed; resolved from email):**
```
POST /api/v1/auth/login
{ "email": "priya@acme.test", "password": "Password123!" }
→ data.accessToken, data.user.employeeId
```

**Step 2 — List the employee's payslips (get IDs + periods):**
```
GET /api/v1/payroll/employees/{employeeId}/payslips
Authorization: Bearer <accessToken>
→ data.items[] = [{ id, period, periodLabel, netPay, status }, ...]
```
> EMPLOYEE may only pass their **own** employeeId (else 403). HR/SA may pass any.

**Step 3 — Get one payslip's detail → read `documentUrl`:**
```
GET /api/v1/payroll/employees/{employeeId}/payslips/{payslipId}
Authorization: Bearer <accessToken>
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "cmponmwqj000ptlvss9t0smkw",
    "period": "2026-05",
    "periodLabel": "May 2026",
    "employee": { "firstName": "Priya", "lastName": "Sharma", "employeeCode": "E0002" },
    "earnings": [ { "code": "BASIC", "name": "Basic Salary", "type": "EARNING", "amount": 30000, "monthlyAmount": 30000, "taxable": true } ],
    "deductions": [ { "code": "PF", "name": "Provident Fund (Employee)", "type": "DEDUCTION", "amount": 3600, "monthlyAmount": 3600, "taxable": false } ],
    "grossEarnings": 75000,
    "totalDeductions": 3800,
    "netPay": 71200,
    "status": "PAID",
    "documentUrl": "https://res.cloudinary.com/dmljxhmio/image/upload/v1.../ems/payslips/payslip_E0002_2026_05.webp"
  },
  "meta": {}
}
```
**Step 4 — Render/download:** use `data.documentUrl` directly as an `<img src>` / download link.
It is a public Cloudinary URL — no auth header needed to fetch the file itself.

> **`documentUrl` is `null`** when the payslip was generated by the live `/calculate`
> API (it computes numbers but does not render a PDF). Only seeded historical payslips
> (Mar/Apr/May 2026) carry Cloudinary documents today. SUPER_ADMIN has no Employee
> record, so it has no payslips.

### Payroll Runs
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/runs` | HR,SA | `?page&limit&year&status`. Paginated. status: DRAFT\|CALCULATING\|REVIEW\|APPROVED\|PAID\|CANCELLED |
| POST | `/payroll/runs` | HR,SA | 201. Required: period (YYYY-MM). 409 RUN_EXISTS if non-CANCELLED run exists |
| GET | `/payroll/runs/:id` | HR,SA | Includes `summary.byDepartment[]` and `summary.warnings[]` |
| POST | `/payroll/runs/:id/calculate` | HR,SA | 202. DRAFT→REVIEW. Computes payslips for all employees with salary config |
| POST | `/payroll/runs/:id/approve` | HR,SA | 200. REVIEW→APPROVED. Body: `{notes}` |
| PATCH | `/payroll/runs/:id/mark-paid` | HR,SA | 200. APPROVED→PAID. Body: `{paidAt, paymentReference}`. Updates all payslips to PAID |
| POST | `/payroll/runs/:id/cancel` | HR_ADMIN, SUPER_ADMIN | 200. Cannot cancel PAID runs (400 INVALID_STATUS). Body: `{reason}` |

### Run Payslips
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/runs/:runId/payslips` | HR,SA | `?page&limit&departmentId&search`. Lists payslips in run |
| GET | `/payroll/runs/:runId/payslips/:payslipId` | HR,SA | **PayslipDetail** for drawer. UI route: `/payroll/:runId` → Payslip drawer. See shape below |
| PATCH | `/payroll/runs/:runId/payslips/:payslipId` | HR,SA | Add one-time adjustments. Body: `{oneTimeAdditions[], oneTimeDeductions[], notes}`. Recalculates net |
| GET | `/payroll/runs/:runId/export` | HR,SA | `Content-Type: text/csv`. Payroll register download |

---

## Domain A — Recruitment (`/recruitment/*`)

> **Added: 2026-06-06** (Phase 3)

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/recruitment/summary` | HR,SA,MGR | `{ openRequisitions, activeCandidates, interviewsThisWeek, avgDaysToHire, closingThisWeek, interviewsToday }` |
| GET | `/recruitment/openings` | HR,SA,MGR | Paginated. `?status` filter: Open\|Closing\|On hold\|Closed. Returns `{ openings[], pagination }` |
| POST | `/recruitment/openings` | HR,SA | 201. Required: `title, department, location, employmentType` |
| PATCH | `/recruitment/openings/:id` | HR,SA | 200. Any subset of opening fields. 404 if not found |
| GET | `/recruitment/candidates` | HR,SA,MGR | Paginated. `?openingId, ?stage`. Returns `{ candidates[], pagination }` — candidate has `tag=openingId` |
| POST | `/recruitment/candidates/:id/advance` | HR,SA,MGR | Body: `{ stage }` — must be exact next stage. Sequence: applied→screening→interview→offer→hired. 409 if hired, 422 if invalid stage name or skip |
| PATCH | `/recruitment/candidates/:id/rating` | HR,SA,MGR | Body: `{ rating: 1-5 }`. 422 if out of range, 404 if not found |
| GET | `/recruitment/recruiters` | HR,SA,MGR | Returns HR_ADMIN users with employee profiles `{ recruiters: [{id, name, email}] }` |

---

## Domain B — Performance (`/performance/*`)

> **Added: 2026-06-06** (Phase 3)

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/performance/cycles/active` | HR,SA,MGR | Returns active cycle or `null` if none. Fields: `id, name, selfReviewDue, managerReviewDue, calibrationDate, progressPct, status, startedAt` |
| GET | `/performance/summary` | HR,SA,MGR | `{ reviewsComplete, reviewsTotal, goalsOnTrackPct, goalsOnTrackDelta, avgRating, overdueReviews }` |
| GET | `/performance/reviews` | HR,SA,MGR | Paginated. `?status` (Not started\|Self review\|Manager review\|Calibrated). Enriched: `{ employeeId, employeeName, department, reviewerName, status, rating, selfComplete, managerComplete }` |
| GET | `/performance/goals` | HR,SA,MGR | Paginated. `?status` (On track\|At risk\|Done). Enriched: `{ id, employeeId, employeeName, title, progressPct, dueDate, status }` |
| GET | `/performance/calibration` | HR,SA | `{ totalReviewed, distribution: [{rating, count, pct}], notes: [{tone, title, body}] }` |
| GET | `/performance/employees` | HR,SA,MGR | `{ employees: [{id, name, department}] }` — active employees |
| PATCH | `/performance/reviews/:employeeId` | HR,SA,MGR | Body: `{ rating: Exceeds\|Strong\|Meets\|Developing\|Below }`. Sets status=Calibrated. 404/409/422 |
| POST | `/performance/goals` | HR,SA,MGR | 201. Required: `employeeId, title, dueDate`. Optional: `progressPct` |

---

## Domain C — Assets (`/assets/*`)

> **Added: 2026-06-06** (Phase 3)

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/assets/summary` | HR,SA,MGR | `{ totalAssets, assigned, available, inRepair, utilizationPct, avgRepairDays }` |
| GET | `/assets` | HR,SA,MGR | Paginated. `?type` (Laptop\|Monitor\|Phone\|Other), `?status` (Assigned\|Available\|Repair\|Retired) |
| POST | `/assets` | HR,SA | 201. Required: `tag, name, type`. Optional: `assignedTo: {employeeId, name}, assignedSince`. 409 if tag exists |
| GET | `/assets/requests` | HR,SA,MGR | Paginated. `?status (Pending\|Approved\|Fulfilled\|Declined)`. Returns `{ requests[], pagination }` |
| PATCH | `/assets/requests/:id/approve` | HR,SA | 200 `{ id, status: "Approved" }`. 409 if not Pending |
| PATCH | `/assets/requests/:id/decline` | HR,SA | 200 `{ id, status: "Declined" }`. Body: `{ reason? }`. 409 if not Pending |
| GET | `/assets/employees` | HR,SA,MGR | Returns `[{ employeeId, name }]` — active employees |
| PATCH | `/assets/:id/status` | HR,SA | Body: `{ status: Available\|Repair\|Retired }`. Clears assignedTo. 404 if not found |
| PATCH | `/assets/:id/assign` | HR,SA | Body: `{ employeeId, name, since? }`. Sets status=Assigned. 404 if not found, 409 if Retired |
| PATCH | `/assets/:id/recall` | HR,SA | Sets status=Available, clears assignedTo. 404 if not found |

---

## Domain D — Announcements (`/announcements/*`)

> **Added: 2026-06-06** (Phase 3)

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/announcements` | All | `?channelId, ?page, ?limit`. Returns `{ pinned: <ann or null>, feed: [], pagination }`. Author shape: `{ name, role }` |
| POST | `/announcements` | HR,SA,MGR | 201. Required: `title, body, category`. Optional: `channelId, audience, isPinned, authorName, authorRole`. 403 if EMPLOYEE |
| GET | `/announcements/channels` | All | `{ channels: [{id, name, postCount, category}] }` |
| GET | `/announcements/events` | All | `{ events: [{id, date, title, meta}] }` |
| POST | `/announcements/events` | HR,SA | 201. Required: `date (YYYY-MM-DD), title, meta` |
| PATCH | `/announcements/:id/pin` | HR,SA | Pins this announcement, demotes existing pinned. 404 if not found |
| PATCH | `/announcements/:id/unpin` | HR,SA | `{ unpinned: true }`. 409 if not currently pinned. 404 if not found |

---

### Formula Language (for FORMULA calculationType)
Variables: any component code (e.g. BASIC, HRA), CTC (annualCtc/12), GROSS (sum of EARNINGs), NET (GROSS - DEDUCTIONs)
Functions: MIN, MAX, IF, ROUND, FLOOR, CEIL, ABS
Example: `"IF(BASIC > 15000, 200, 0)"` (professional tax)

---

## Domain E — Departments (headEmployeeId extension)

> **Status: LIVE ✅** — merged with departments module (2026-05-27)

`POST /departments` and `PATCH /departments/:id` both accept `headEmployeeId` in the request body.

| Field | Type | Notes |
|-------|------|-------|
| `headEmployeeId` | `string \| null` | Optional. Employee must be ACTIVE. Setting null clears the head. |
| `headEmployeeFirstName` | `string \| null` | Informational — sent by UI for denormalization, not stored separately |
| `headEmployeeLastName` | `string \| null` | Informational — sent by UI for denormalization, not stored separately |

**New error code:** `422 INVALID_HEAD_EMPLOYEE` — employee not found or not ACTIVE in this tenant.
**New error code:** `422 HEAD_EMPLOYEE_TAKEN` — employee already heads another department.

Response shape (both POST + PATCH): full department object with `headEmployeeId`, `headEmployeeFirstName`, `headEmployeeLastName`, `headEmployeeName`.

---

## Domain F — Payroll (`/payroll/*`)

> **Status: LIVE ✅ (all sections)**  
> All F.1–F.17 endpoints are **live on Render** as of 2026-06-08.  
> F.6 (Claims), F.7 (Garnishments), F.10 (Documents), F.11 (Accounting) — previously MSW-only — are now implemented. See §F.17 below.  
> **Money:** major units (e.g. `1800000` = ₹18,00,000). **Casing:** camelCase throughout.  
> **Auth:** Bearer token required on every endpoint. Role codes: HR=HR_ADMIN, SA=SUPER_ADMIN, MGR=MANAGER, EMP=EMPLOYEE.

---

### F.1 — Salary Components

#### `GET /payroll/components`
**Roles:** HR, SA  
**Query:** `?active=true|false`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "comp-basic",
      "code": "BASIC",
      "name": "Basic Salary",
      "type": "EARNING",
      "calculationType": "PERCENTAGE",
      "value": 40,
      "basisCode": "CTC",
      "taxable": true,
      "active": true,
      "displayOrder": 1,
      "description": "Basic salary — 40% of CTC",
      "statutoryTag": "PF_WAGE",
      "prorate": true,
      "payInPeriods": null,
      "glAccountCode": null,
      "costCenterRule": "DEPARTMENT",
      "createdAt": "2026-06-09T00:00:00.000Z",
      "updatedAt": "2026-06-09T00:00:00.000Z"
    },
    {
      "id": "comp-hra",
      "code": "HRA",
      "name": "House Rent Allowance",
      "type": "EARNING",
      "calculationType": "PERCENTAGE",
      "value": 20,
      "basisCode": "BASIC",
      "taxable": false,
      "active": true,
      "displayOrder": 2,
      "description": "HRA — 20% of Basic"
    },
    {
      "id": "comp-epf",
      "code": "EPF_EE",
      "name": "Employee PF Contribution",
      "type": "DEDUCTION",
      "calculationType": "PERCENTAGE",
      "value": 12,
      "basisCode": "BASIC",
      "taxable": false,
      "active": true,
      "displayOrder": 5,
      "description": null
    },
    {
      "id": "comp-epf-er",
      "code": "EPF_ER",
      "name": "EPF Employer Contribution",
      "type": "EMPLOYER_CONTRIBUTION",
      "calculationType": "PERCENTAGE",
      "value": 12,
      "basisCode": null,
      "taxable": false,
      "active": true,
      "displayOrder": 10,
      "description": "EPF Employer Contribution"
    },
    {
      "id": "comp-pbonus",
      "code": "PERF_BONUS",
      "name": "Performance Bonus",
      "type": "VARIABLE",
      "calculationType": "PERCENTAGE",
      "value": 10,
      "basisCode": null,
      "taxable": true,
      "active": true,
      "displayOrder": 14,
      "description": "Performance Bonus"
    }
  ],
  "meta": {}
}
```

**All 6 `type` values:** `EARNING` | `DEDUCTION` | `BENEFIT` | `REIMBURSEMENT` | `EMPLOYER_CONTRIBUTION` | `VARIABLE`  
**`calculationType` values:** `FLAT` | `PERCENTAGE` | `FORMULA`  
**Rule:** `PERCENTAGE` type requires `basisCode` (e.g. `"CTC"`, `"BASIC"`, `"GROSS"`). `FLAT` does not.

---

#### `POST /payroll/components`
**Roles:** HR, SA  
**Status:** 201

**Request body (EARNING, PERCENTAGE):**
```json
{
  "name": "Basic Salary",
  "code": "BASIC",
  "type": "EARNING",
  "calculationType": "PERCENTAGE",
  "value": 40,
  "basisCode": "CTC",
  "taxable": true,
  "active": true,
  "displayOrder": 1,
  "description": "Basic salary"
}
```

**Request body (DEDUCTION, FLAT):**
```json
{
  "name": "Professional Tax",
  "code": "PT",
  "type": "DEDUCTION",
  "calculationType": "FLAT",
  "value": 200,
  "taxable": false,
  "active": true,
  "displayOrder": 6
}
```

**Request body (EMPLOYER_CONTRIBUTION):**
```json
{
  "name": "EPF Employer Contribution",
  "code": "EPF_ER",
  "type": "EMPLOYER_CONTRIBUTION",
  "calculationType": "FLAT",
  "value": 5000,
  "taxable": false,
  "active": true
}
```

**Request body (VARIABLE):**
```json
{
  "name": "Performance Bonus",
  "code": "PERF_BONUS",
  "type": "VARIABLE",
  "calculationType": "FLAT",
  "value": 10000,
  "taxable": true,
  "active": true
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "cmq4xxxxxxxxxxxx",
    "tenantId": "...",
    "code": "BASIC",
    "name": "Basic Salary",
    "type": "EARNING",
    "calculationType": "PERCENTAGE",
    "value": 40,
    "basisCode": "CTC",
    "taxable": true,
    "active": true,
    "displayOrder": 1,
    "description": "Basic salary",
    "createdAt": "2026-06-08T00:00:00.000Z"
  },
  "meta": {}
}
```

**Errors:**
- `409 COMPONENT_CODE_EXISTS` — code already in use for this tenant
- `422 VALIDATION_ERROR` — missing required field or invalid enum value

---

#### `PATCH /payroll/components/:id`
**Roles:** HR, SA  
**Note:** `code` is immutable.

**Request body (any subset):**
```json
{
  "name": "Updated Basic Salary",
  "value": 45,
  "active": false
}
```

**Response 200:** same shape as POST 201.

---

### F.2 — Pay Groups

#### `GET /payroll/groups`
**Roles:** HR, SA

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pg-001",
      "code": "DEFAULT",
      "name": "Default Pay Group",
      "currency": "INR",
      "paySchedule": "MONTHLY",
      "active": true,
      "components": [
        {
          "componentId": "comp-basic",
          "code": "BASIC",
          "name": "Basic Salary",
          "type": "EARNING",
          "calculationType": "PERCENTAGE",
          "value": 40,
          "basisCode": "CTC",
          "overrideCalculationType": null,
          "overrideValue": null
        }
      ]
    }
  ],
  "meta": {}
}
```

---

#### `POST /payroll/groups`
**Roles:** HR, SA

**Request body:**
```json
{
  "name": "Senior Engineering Pay Group",
  "code": "SENIOR_ENG",
  "currency": "INR",
  "paySchedule": "MONTHLY",
  "description": "For L4 and above engineers",
  "active": true,
  "components": [
    { "componentId": "comp-basic", "overrideValue": null },
    { "componentId": "comp-hra" },
    { "componentId": "comp-epf" }
  ]
}
```

**Response 201:** same shape as GET item.

---

### F.3 — Legal Entities

#### `GET /payroll/legal-entities`
**Roles:** HR, SA

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "le-acme-in",
      "name": "Acme India Pvt Ltd",
      "country": "IN",
      "currency": "INR",
      "fiscalYearStartMonth": 4,
      "timezone": "Asia/Kolkata",
      "locale": "en-IN",
      "registrationIds": { "pan": "AAACA1234C", "tan": "DELA12345B", "gstin": "07AAACA1234C1Z5" },
      "statutoryPackId": "pack-in-2026",
      "payCalendarId": "cal-in-monthly",
      "active": true,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "le-acme-us",
      "name": "Acme Technologies Inc",
      "country": "US",
      "currency": "USD",
      "fiscalYearStartMonth": 1,
      "timezone": "America/New_York",
      "locale": "en-US",
      "registrationIds": { "ein": "12-3456789", "suta": "CA-987654" },
      "statutoryPackId": "pack-us-2026",
      "payCalendarId": "cal-us-biweekly"
    }
  ],
  "meta": {}
}
```

---

#### `POST /payroll/legal-entities`
**Roles:** SA only

**Request body:**
```json
{
  "name": "Acme Singapore Pte Ltd",
  "country": "SG",
  "currency": "SGD",
  "fiscalYearStartMonth": 1,
  "timezone": "Asia/Singapore",
  "locale": "en-SG",
  "registrationIds": { "uen": "202012345A", "gst": "M90123456A" },
  "statutoryPackId": "pack-sg-2026",
  "payCalendarId": "cal-sg-monthly"
}
```

**Response 201:** same shape as GET item.

---

### F.4 — Statutory Packs

#### `GET /payroll/statutory-packs`
**Roles:** HR, SA  
**Query:** `?country=IN` (optional)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pack-in-2026",
      "country": "IN",
      "version": "2026.1",
      "effectiveFrom": "2026-04-01T00:00:00.000Z",
      "effectiveTo": null,
      "rounding": "nearest_rupee",
      "proration": "working_days",
      "taxRegimes": [
        { "code": "NEW", "name": "New Tax Regime", "default": true,
          "slabs": [
            { "from": 0, "to": 300000, "rate": 0 },
            { "from": 300001, "to": 600000, "rate": 5 },
            { "from": 600001, "to": 900000, "rate": 10 },
            { "from": 900001, "to": 1200000, "rate": 15 },
            { "from": 1200001, "to": 1500000, "rate": 20 },
            { "from": 1500001, "to": null, "rate": 30 }
          ]
        }
      ],
      "contributionSchemes": [
        { "code": "EPF", "name": "Employee Provident Fund",
          "employeeRate": 12, "employerRate": 12, "wageBase": 15000 },
        { "code": "ESI", "name": "Employee State Insurance",
          "employeeRate": 0.75, "employerRate": 3.25, "wageBase": 21000 }
      ],
      "statutoryComponents": ["PF_EE", "PF_ER", "ESI_EE", "ESI_ER", "PROF_TAX", "TDS"]
    }
  ],
  "meta": {}
}
```

> **Note:** `packData` JSON column is flattened to top-level fields in the response. The DB stores `packData: { rounding, proration, taxRegimes, contributionSchemes, ... }` but the API returns all those keys directly on the object.

---

#### `POST /payroll/statutory-packs`
**Roles:** SA only

**Request body (flat — preferred):**
```json
{
  "country": "IN",
  "version": "2026.2",
  "effectiveFrom": "2026-10-01",
  "effectiveTo": null,
  "rounding": { "mode": "NEAREST", "precision": 0 },
  "proration": { "basis": "CALENDAR_DAYS" },
  "taxRegimes": [],
  "contributionSchemes": [],
  "localTaxes": [],
  "statutoryComponents": ["PF", "PF_ER", "ESI_EE", "ESI_ER", "PROF_TAX", "TDS"],
  "minimumWages": [],
  "gratuity": null
}
```

**`statutoryComponents`:** always `string[]` in responses. On write, legacy `{ "code": "PF" }` objects are accepted and normalized to `"PF"` before storage.

**Errors:**  
- `409 PACK_VERSION_EXISTS` — country + version combo already exists

---

### F.5 — Pay Calendars

#### `GET /payroll/pay-calendars`
**Roles:** HR, SA  
**UI:** Payroll → Pay Calendars  
**Seed:** `npm run db:seed:payroll-contract`

**Response 200 (frontend `PayCalendar` shape):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cal-in-monthly",
      "name": "India Monthly Payroll",
      "legalEntityId": "le-acme-in",
      "frequency": "MONTHLY",
      "periodAnchor": 1,
      "payDateRule": "LAST_WORKING_DAY",
      "payDay": 30,
      "cutoffDay": 25,
      "holidayCalendarId": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {}
}
```

**`periodAnchor`:** integer day-of-month `1–28` (UI renders `Day {periodAnchor}`). Legacy DB value `"MONTH_START"` is normalized to `1` on read. POST/PATCH accept integer; response always returns integer.

**`frequency` values:** `MONTHLY` | `BIWEEKLY` | `WEEKLY` (stored as `paySchedule` in DB; POST accepts `frequency` or `paySchedule`)

**Errors:** `422 VALIDATION_ERROR` if `periodAnchor` out of range; `422 INVALID_PAY_CALENDAR` optional alias for invalid scheduling fields.

---

#### `POST /payroll/pay-calendars`
**Request body:**
```json
{
  "name": "India Monthly Payroll",
  "code": "IN_MONTHLY",
  "country": "IN",
  "paySchedule": "MONTHLY",
  "firstPayDate": "2026-01-31"
}
```

---

### F.5b — Payroll Base Paths (UI list screens)

#### `GET /payroll/employees`
**Roles:** HR, SA  
**UI:** Payroll → Employees roster  
**Response 200:** `{ success, data: PayrollEmployee[], meta }` — each item: `employeeId`, `employeeCode`, `employeeName`, `department`, `designation`, `country`, `currency`, `payGroupId`, `payGroupName`, `hasSalaryConfig`, `annualCtc`, `active`

#### `GET /payroll/migration`
**Roles:** HR, SA  
**UI:** Payroll → Migration hub (alias of `/payroll/migration/status` aggregate)  
**Response 200:** `{ sandboxMode, goLivePeriod, openingBalancesCount, historicalPayslipsCount, lastReconciledRunId, updatedAt }`

#### `GET /payroll/payment-batches`
**Roles:** HR, SA  
**Response 200:** array of `{ id, runId, period, count, totalAmount, currency, status, createdAt, reconciledAt }`

#### `GET /payroll/reports`
**Roles:** HR, SA  
**Response 200:** `{ reports: [{ id, path, label, method, requiresRunId? }], recentRuns: [...] }`

#### `GET /payroll/settings`
**Roles:** HR, SA  
**Response 200:** `{ defaultCountry, defaultCurrency, sandboxMode, dataPolicy, features, updatedAt }` — sub-resource `/payroll/settings/data-policy` unchanged

#### `GET /payroll/contractor-invoices`
**Roles:** HR, SA  
**Seed:** `npm run db:seed:payroll-contract`  
**Response item:** `{ id, workerId, workerName, period, amount, currency, withholdingPct, netPayable, status, payoutRef, submittedAt, decidedAt }`

#### `GET /payroll/opening-balances`
**Roles:** HR, SA  
**Seed:** `npm run db:seed:payroll-contract`  
**Response item:** `{ employeeId, employeeCode, employeeName, fiscalYear, grossEarnings, taxableIncome, taxDeducted, totalDeductions, netPay, contributions, importedAt }`

---

### F.6 — Employee Salary Config

#### `GET /payroll/employees/:employeeId/salary`
**Roles:** HR, SA (full bank details) | EMPLOYEE (own, masked bank)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "cmq42gfzu009y117d...",
    "employeeId": "cmq3cxlim001egfijd7jy32pt",
    "payGroupId": "pg-001",
    "annualCtc": 1800000,
    "effectiveFrom": "2026-01-01T00:00:00.000Z",
    "effectiveTo": null,
    "bankName": "HDFC",
    "bankAccountNumber": "50100123456789",
    "bankIfscCode": "HDFC0001234",
    "bankAccountName": "Aman Kumar",
    "currency": "INR",
    "calculatedComponents": [
      { "code": "BASIC", "name": "Basic Salary", "type": "EARNING", "monthlyAmount": 60000, "taxable": true },
      { "code": "HRA", "name": "House Rent Allowance", "type": "EARNING", "monthlyAmount": 12000, "taxable": false },
      { "code": "EPF_EE", "name": "Employee PF Contribution", "type": "DEDUCTION", "monthlyAmount": 7200, "taxable": false }
    ]
  },
  "meta": {}
}
```

> **EMPLOYEE self-view:** `bankAccountNumber` is masked as `"XXXXXX6789"`.

---

#### `POST /payroll/employees/:employeeId/salary`
**Roles:** HR, SA  
**Status:** 201

**Request body:**
```json
{
  "payGroupId": "pg-001",
  "annualCtc": 1800000,
  "effectiveFrom": "2026-01-01",
  "bankName": "HDFC",
  "bankAccountNumber": "50100123456789",
  "bankIfscCode": "HDFC0001234",
  "bankAccountName": "Aman Kumar"
}
```

**Notes:**
- Creates a new salary record and closes the old one (`effectiveTo` = today)
- `PATCH /payroll/employees/:employeeId/salary` — same body, same behavior (creates history)

---

### F.7 — Employee YTD & Tax Declaration

#### `GET /payroll/employees/:id/ytd`
**Roles:** HR, SA, EMPLOYEE (own only)  
**Query:** `?fy=2026-27` (fiscal year, defaults to current FY)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "employeeId": "cmq3cxlim001egfijd7jy32pt",
    "fiscalYear": "2026-27",
    "monthsElapsed": 2,
    "grossEarnings": 200000,
    "taxableIncome": 180000,
    "taxDeducted": 12000,
    "totalDeductions": 24000,
    "netPay": 176000,
    "contributions": {
      "pf": 14400,
      "esi": 0
    },
    "currency": "INR"
  },
  "meta": {}
}
```

---

#### `GET /payroll/employees/:id/tax-declaration`
**Roles:** HR, SA, EMPLOYEE (own)  
**Query:** `?fy=2025-26`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "td-001",
    "employeeId": "cmq3cxlim001egfijd7jy32pt",
    "fiscalYear": "2025-26",
    "regime": "NEW",
    "proofStatus": null,
    "items": [
      { "section": "80C", "description": "PPF Contribution", "amount": 150000 },
      { "section": "80D", "description": "Health Insurance Premium", "amount": 25000 }
    ],
    "createdAt": "2026-01-15T00:00:00.000Z"
  },
  "meta": {}
}
```

---

#### `POST /payroll/employees/:id/tax-declaration`
**Roles:** HR, SA, EMPLOYEE (own)

**Request body:**
```json
{
  "fiscalYear": "2026-27",
  "regime": "NEW",
  "items": [
    { "section": "80C", "description": "PPF Contribution", "amount": 150000 },
    { "section": "80D", "description": "Health Insurance Premium", "amount": 25000 },
    { "section": "HRA", "description": "House Rent Allowance", "amount": 120000 }
  ]
}
```

**Notes:** replaces the existing declaration for that `(employeeId, fiscalYear)` pair.  
`regime` values: `NEW` | `OLD`

---

### F.8 — Employee Loans

#### `GET /payroll/employees/:id/loans`
**Roles:** HR, SA, EMPLOYEE (own)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "loan-001",
      "employeeId": "cmq3cxlim001egfijd7jy32pt",
      "amount": 100000,
      "balance": 65000,
      "emiAmount": 5000,
      "startPeriod": "2025-10",
      "endPeriod": "2026-09",
      "status": "ACTIVE",
      "schedule": { "frequency": "MONTHLY", "deductFromPayroll": true },
      "createdAt": "2025-10-01T00:00:00.000Z"
    }
  ],
  "meta": {}
}
```

**`status` values:** `ACTIVE` | `CLOSED` | `FORECLOSED` | `OVERDUE`

---

#### `POST /payroll/employees/:id/loans`
**Roles:** HR, SA

**Request body:**
```json
{
  "amount": 100000,
  "emiAmount": 5000,
  "startPeriod": "2026-07",
  "endPeriod": "2027-06"
}
```

**Response 201:** same shape as GET item.

---

### F.9 — Payroll Runs

#### `GET /payroll/runs`
**Roles:** HR, SA  
**Query:** `?page=1&limit=10&year=2026&status=PAID`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "runs": [
      {
        "id": "run-nov-2026",
        "period": "2026-11",
        "status": "REVIEW",
        "employeeCount": 7,
        "totalGross": 501200,
        "totalDeductions": 77000,
        "totalNet": 424200,
        "currency": "INR",
        "processedAt": "2026-06-08T00:00:00.000Z",
        "createdAt": "2026-06-08T00:00:00.000Z"
      },
      {
        "id": "run-may-2026",
        "period": "2026-05",
        "status": "PAID",
        "employeeCount": 3,
        "totalGross": 230050,
        "totalDeductions": 30000,
        "totalNet": 200050,
        "currency": "INR",
        "processedAt": null
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 7, "pages": 1 }
  },
  "meta": {}
}
```

**`status` values:** `DRAFT` | `CALCULATING` | `REVIEW` | `APPROVED` | `PAID` | `CANCELLED`

---

#### `POST /payroll/runs`
**Roles:** HR, SA

**Request body:**
```json
{
  "period": "2026-08",
  "includeAllActiveEmployees": true
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "run-aug-2026",
    "period": "2026-08",
    "status": "DRAFT",
    "employeeCount": 0,
    "totalGross": 0,
    "totalDeductions": 0,
    "totalNet": 0,
    "currency": "INR",
    "createdAt": "2026-06-08T00:00:00.000Z"
  },
  "meta": {}
}
```

**Errors:**
- `409 RUN_EXISTS` — non-CANCELLED run for this period already exists

---

#### `POST /payroll/runs/:id/calculate`
**Roles:** HR, SA  
**Status:** 202 (async calculation)

**Request body:** `{}` (empty)

**Response 202:**
```json
{
  "success": true,
  "data": {
    "id": "run-aug-2026",
    "period": "2026-08",
    "status": "REVIEW",
    "employeeCount": 7,
    "totalGross": 490000,
    "totalDeductions": 68000,
    "totalNet": 422000,
    "currency": "INR"
  },
  "meta": {}
}
```

**Notes:** transitions run from `DRAFT` → `REVIEW`. Computes payslips for all employees with a salary config linked to this tenant.

---

#### `POST /payroll/runs/:id/approve`
**Roles:** HR, SA

**Request body:**
```json
{ "notes": "Approved by HR Admin for August 2026" }
```

**Response 200:** run object with `status: "APPROVED"`.

---

#### `PATCH /payroll/runs/:id/mark-paid`
**Roles:** HR, SA

**Request body:**
```json
{
  "paidAt": "2026-08-31",
  "paymentReference": "NEFT/2026/08/ACME"
}
```

**Response 200:** run object with `status: "PAID"`. All payslips updated to `PAID`.

---

### F.10 — Employee Payslips (Self-Service)

#### `GET /payroll/employees/:employeeId/payslips`
**Roles:** HR, SA (any employee) | EMPLOYEE (own only)  
**Query:** `?page=1&limit=12&year=2026`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "payslip-nov-aman",
        "period": "2026-11",
        "status": "PENDING",
        "grossEarnings": 71600,
        "totalDeductions": 11000,
        "netPay": 60600,
        "currency": "INR",
        "documentUrl": null
      },
      {
        "id": "payslip-may-aman",
        "period": "2026-05",
        "status": "PAID",
        "grossEarnings": 65000,
        "totalDeductions": 9500,
        "netPay": 55500,
        "currency": "INR",
        "documentUrl": "https://res.cloudinary.com/..."
      }
    ],
    "pagination": { "page": 1, "limit": 12, "total": 3, "pages": 1 }
  },
  "meta": {}
}
```

> **`documentUrl`:** `null` for payslips generated by the live `/calculate` API (numbers computed, no PDF rendered). Only seeded historical payslips (Mar/Apr/May 2026) carry Cloudinary document URLs.

---

#### `GET /payroll/employees/:employeeId/payslips/:payslipId`
**Roles:** HR, SA, EMPLOYEE (own)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "payslip-nov-aman",
    "employeeId": "cmq3cxlim001egfijd7jy32pt",
    "payrollRunId": "run-nov-2026",
    "period": "2026-11",
    "status": "PENDING",
    "grossEarnings": 71600,
    "totalDeductions": 11000,
    "netPay": 60600,
    "currency": "INR",
    "documentUrl": null,
    "earningsJson": [
      { "code": "BASIC", "name": "Basic Salary", "type": "EARNING", "amount": 60000, "taxable": true },
      { "code": "HRA", "name": "HRA", "type": "EARNING", "amount": 12000, "taxable": false }
    ],
    "deductionsJson": [
      { "code": "EPF_EE", "name": "PF Employee", "type": "DEDUCTION", "amount": 7200, "taxable": false },
      { "code": "PT", "name": "Professional Tax", "type": "DEDUCTION", "amount": 200, "taxable": false }
    ]
  },
  "meta": {}
}
```

---

### F.11 — Run Payslips (HR View)

#### `GET /payroll/runs/:runId/payslips`
**Roles:** HR, SA  
**Query:** `?page=1&limit=20&departmentId=xxx&search=Aman`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "payslips": [
      {
        "id": "payslip-nov-aman",
        "employeeId": "cmq3...",
        "employeeName": "Aman Kumar",
        "department": "Engineering",
        "period": "2026-11",
        "grossEarnings": 71600,
        "totalDeductions": 11000,
        "netPay": 60600,
        "status": "PENDING",
        "currency": "INR"
      }
    ],
    "summary": { "totalGross": 490000, "totalDeductions": 68000, "totalNet": 422000 },
    "pagination": { "page": 1, "limit": 20, "total": 7, "pages": 1 }
  },
  "meta": {}
}
```

---

#### `PATCH /payroll/runs/:runId/payslips/:payslipId`
**Roles:** HR, SA — add one-time adjustments

**Request body:**
```json
{
  "oneTimeAdditions": [
    { "description": "Festival Bonus", "amount": 5000 }
  ],
  "oneTimeDeductions": [
    { "description": "Canteen Recovery", "amount": 500 }
  ],
  "notes": "August adjustment"
}
```

---

### F.12 — Global Workforce (Workers, Cost Summary, Contractor Invoices)

> **Status: LIVE ✅ as of 2026-06-08.** Previously MSW-only — now fully backed by Render DB.  
> Workers are derived from `Employee.employmentType` (no separate model).

#### `GET /payroll/workers`
**Roles:** HR, SA  
**Query:** `?classification=EMPLOYEE|CONTRACTOR|EOR` (optional filter)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cmq3cxlim001egfijd7jy32pt",
      "employeeCode": "E0001",
      "name": "Aman Kumar",
      "classification": "EMPLOYEE",
      "country": "IN",
      "currency": "INR",
      "legalEntityId": null,
      "legalEntityName": null,
      "monthlyCost": 15000000,
      "riskFlag": null,
      "active": true
    },
    {
      "id": "cmq3cxlim002fghij8kz43qu",
      "employeeCode": "E0007",
      "name": "Diego Ramirez",
      "classification": "CONTRACTOR",
      "country": "US",
      "currency": "USD",
      "legalEntityId": null,
      "legalEntityName": null,
      "monthlyCost": 0,
      "riskFlag": null,
      "active": true
    }
  ],
  "meta": {}
}
```

**`classification` values:** `EMPLOYEE` | `CONTRACTOR` | `EOR`  
**`monthlyCost`:** minor units (e.g. `15000000` = ₹1,50,000). Derived from `annualCtc / 12 * 100`.

---

#### `PATCH /payroll/workers/:id`
**Roles:** HR, SA  
**`:id`** = employee ID

**Request body:**
```json
{ "classification": "CONTRACTOR" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "cmq3cxlim002fghij8kz43qu",
    "classification": "CONTRACTOR",
    "employmentType": "CONTRACT"
  },
  "meta": {}
}
```

**Notes:** updates `Employee.employmentType`. `CONTRACTOR` → `CONTRACT`, `EMPLOYEE` → `FULL_TIME`.

---

#### `GET /payroll/cost-summary`
**Roles:** HR, SA  
**Query:** `?groupBy=classification` (default) | `entity` | `currency`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "groupBy": "classification",
    "baseCurrency": "INR",
    "totalBaseCost": 4500000,
    "totalWorkers": 7,
    "groups": [
      {
        "key": "EMPLOYEE",
        "workerCount": 6,
        "baseAmount": 4200000
      },
      {
        "key": "CONTRACTOR",
        "workerCount": 1,
        "baseAmount": 300000
      }
    ],
    "fxRates": { "INR": 1, "USD": 83, "EUR": 90, "GBP": 105, "AED": 22, "SGD": 62 }
  },
  "meta": {}
}
```

**Notes:**
- All amounts in INR (or base currency of tenant)
- FX conversion: `monthlyCost_local × FX_rate → INR`
- `groupBy=entity` groups by employee `location` field
- `groupBy=currency` groups by `Employee.payCurrency`

---

#### `GET /payroll/contractor-invoices`
**Roles:** HR, SA  
**Query:** `?workerId=<employeeId>&status=SUBMITTED`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cinv-abc123",
      "workerId": "cmq3cxlim002fghij8kz43qu",
      "workerName": "Diego Ramirez",
      "period": "2026-06",
      "amount": 500000,
      "currency": "INR",
      "withholdingPct": 10,
      "netPayable": 450000,
      "status": "SUBMITTED",
      "payoutRef": null,
      "submittedAt": "2026-06-02T00:00:00.000Z",
      "decidedAt": null
    }
  ],
  "meta": {}
}
```

**`status` values:** `SUBMITTED` | `APPROVED` | `PAID` | `VOIDED`

---

#### `POST /payroll/contractor-invoices`
**Roles:** HR, SA  
**Status:** 201

**Request body:**
```json
{
  "workerId": "cmq3cxlim002fghij8kz43qu",
  "workerName": "Diego Ramirez",
  "period": "2026-07",
  "amount": 550000,
  "currency": "INR",
  "withholdingPct": 10
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "cinv-newid",
    "workerId": "cmq3cxlim002fghij8kz43qu",
    "workerName": "Diego Ramirez",
    "period": "2026-07",
    "amount": 550000,
    "currency": "INR",
    "withholdingPct": 10,
    "netPayable": 495000,
    "status": "SUBMITTED",
    "payoutRef": null,
    "submittedAt": "2026-06-08T15:00:00.000Z",
    "decidedAt": null
  },
  "meta": {}
}
```

---

#### `PATCH /payroll/contractor-invoices/:id`
**Roles:** HR, SA

**Request body (approve):**
```json
{ "status": "APPROVED" }
```

**Request body (mark paid):**
```json
{
  "status": "PAID",
  "payoutRef": "NEFT/2026/07/RAMIREZ"
}
```

**Response 200:** updated invoice object.

---

### F.13 — Payroll Roster

#### `GET /payroll/roster`
**Roles:** HR, SA

**Response 200:**
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": "cmq3cxlim001egfijd7jy32pt",
        "employeeCode": "E0001",
        "name": "Aman Kumar",
        "department": "Engineering",
        "payGroup": "Default Pay Group",
        "annualCtc": 1800000,
        "currency": "INR"
      }
    ],
    "total": 7
  },
  "meta": {}
}
```

---

### F.14 — Run Inputs

#### `GET /payroll/runs/:runId/inputs`
**Roles:** HR, SA

**Response 200:**
```json
{
  "success": true,
  "data": {
    "inputs": [
      {
        "employeeId": "cmq3cxlim001egfijd7jy32pt",
        "employeeName": "Aman Kumar",
        "lopDays": 0,
        "leaveDays": 2,
        "otHours": 0,
        "variablePay": 0,
        "oneTimeAdditions": [],
        "oneTimeDeductions": []
      }
    ]
  },
  "meta": {}
}
```

---

#### `PATCH /payroll/runs/:runId/inputs/:employeeId`
**Roles:** HR, SA

**Request body (any subset):**
```json
{
  "lopDays": 1,
  "variablePay": 5000,
  "oneTimeAdditions": [
    { "description": "Spot Award", "amount": 2000 }
  ]
}
```

---

### F.15 — Migration

#### `GET /payroll/migration/status`
**Roles:** HR, SA

**Response 200:**
```json
{
  "success": true,
  "data": {
    "sandboxMode": false,
    "goLivePeriod": "2026-04",
    "historicalPayslipsImported": 0,
    "openingBalancesSet": 4,
    "totalEmployees": 7
  },
  "meta": {}
}
```

---

#### `PATCH /payroll/migration/status`
**Request body:**
```json
{
  "sandboxMode": false,
  "goLivePeriod": "2026-04"
}
```

---

### F.16 — Compliance Reporting

#### `GET /payroll/reports/pay-equity`
**Roles:** HR, SA  
**Query:** `?groupBy=gender|level|location`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "groupBy": "gender",
    "groups": [
      { "key": "MALE", "count": 5, "meanCtc": 1650000, "medianCtc": 1500000 },
      { "key": "FEMALE", "count": 4, "meanCtc": 1400000, "medianCtc": 1350000 }
    ],
    "gapPct": 15.2,
    "currency": "INR"
  },
  "meta": {}
}
```

---

### F.17 — Previously MSW-Only Endpoints (NOW LIVE ✅ as of 2026-06-08)

These endpoints were previously MSW-only frontend mocks. They are now fully implemented and live on Render. Calling them returns real data.

| Section | Endpoints |
|---------|-----------|
| **F.6 Claims** | `GET/POST /payroll/reimbursement-claims`, `PATCH /payroll/reimbursement-claims/:id`, `GET /payroll/reimbursement-categories` |
| **F.7 Garnishments** | `GET/POST /payroll/employees/:id/garnishments`, `PATCH/DELETE /payroll/employees/:id/garnishments/:id` |
| **F.10 Documents** | `GET /payroll/payslip-templates`, `PATCH /payroll/payslip-templates`, `POST /payroll/runs/:id/publish`, `GET /payroll/event-catalogue`, `GET /payroll/events`, `GET /payroll/employees/:id/tax-form` |
| **F.11 Accounting** | `GET /payroll/runs/:id/journal`, `GET /payroll/runs/:id/journal/export` |
| **F.9 Disbursement** | `GET/POST /payroll/runs/:id/payment-batch`, `GET /payroll/runs/:id/bank-file`, `GET/POST /payroll/payment-batches/:id/*` |

---

## Domain G — Timesheets (`/timesheets/*`)

> **Added: 2026-06-07** | **Status: LIVE ✅** | **Roles:** HR=HR_ADMIN/SUPER_ADMIN, MGR=MANAGER, ALL=all authenticated

### Projects & Tasks
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/timesheets/projects` | ALL | `?memberId=<employeeId|"self">`. List projects visible to member |
| POST | `/timesheets/projects` | HR,SA | Required: name, code. Optional: clientName, billable, defaultRate, memberIds[] |
| PATCH | `/timesheets/projects/:id` | HR,SA | code immutable |
| DELETE | `/timesheets/projects/:id` | HR,SA | Archives if has entries, deletes if empty |
| GET | `/timesheets/projects/:id/tasks` | ALL | List tasks for project |
| POST | `/timesheets/projects/:id/tasks` | HR,SA | Required: name |
| PATCH | `/timesheets/tasks/:id` | HR,SA | Update task (name, billable, active) |

### Weekly Timesheet & Entries
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/timesheets` | ALL | `?week=YYYY-MM-DD&employeeId=`. Auto-creates DRAFT if absent |
| POST | `/timesheets/entries` | ALL | Required: weekStart, projectId, date, hours. Rejects if sheet SUBMITTED/APPROVED |
| PATCH | `/timesheets/entries/:id` | ALL | Update hours, billable, note, taskId |
| DELETE | `/timesheets/entries/:id` | ALL | Recalculates sheet total |

### Submit & Approve
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| POST | `/timesheets/:id/submit` | ALL | DRAFT/REJECTED → SUBMITTED. 422 if empty |
| GET | `/timesheets/approvals` | HR,SA,MGR | `?status=SUBMITTED`. Manager/HR approval queue |
| POST | `/timesheets/:id/approve` | HR,SA,MGR | SUBMITTED → APPROVED. Body: `{comment}` |
| POST | `/timesheets/:id/reject` | HR,SA,MGR | SUBMITTED → REJECTED. Required: comment |

### Summary & Settings
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/timesheets/summary` | HR,SA,MGR | `?range=30d|90d&employeeId=`. Utilization summary |
| GET | `/timesheets/settings` | HR,SA | Timesheet config (standardWeeklyHours, overtimeThreshold, etc.) |
| PATCH | `/timesheets/settings` | HR,SA | Update timesheet settings |

**Timesheet shape:** `{ id, employeeId, employeeName, weekStart, weekEnd, status(DRAFT/SUBMITTED/APPROVED/REJECTED), totalHours, billableHours, overtimeHours, standardHours, submittedAt, decidedBy, decidedAt, comment, entries[] }`
**Entry shape:** `{ id, timesheetId, projectId, taskId?, date, hours, billable, note, source(MANUAL/TIMER) }`

**`GET /timesheets/approvals` response:** Array of timesheet objects. Each includes `employeeName` (enriched from Employee table — required by ApprovalTab UI).

**`GET /timesheets/summary` response:**
```json
{
  "totalHours": 2993.75,
  "billableHours": 2581.25,
  "nonBillableHours": 412.5,
  "overtimeHours": 0,
  "utilizationPct": 86,
  "byProject": [{ "projectId", "projectName", "hours", "billableHours" }],
  "byEmployee": [{ "employeeId", "employeeName", "employeeCode", "hours", "billableHours", "utilizationPct" }]
}
```
`byEmployee` is non-empty when time entries exist in the range (fixes "No logged hours" in Utilization report).

**`GET /payroll/runs/:id/register?type=SALARY` columns:** `employeeCode, employeeName, department, grossEarnings, totalDeductions, netPay, employerCost`
- `department`: from `employee.department.name`
- `employerCost`: grossEarnings × 1.13 (gross + employer contributions)
- `summary`: includes `totalGross`, `totalDeductions`, `totalNet`, `totalEmployerCost`, `employeeCount`

---

## Phase 3 Extended — Additional Payroll Endpoints (F.17 Updated → Now LIVE)

> **Added: 2026-06-08** | All endpoints below are now **LIVE** on Render. The F.17 "MSW-Only" section above is now superseded.

### F.6 — Reimbursement Claims & Categories
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/reimbursement-categories` | HR,SA | List all claim categories with monthly caps |
| GET | `/payroll/reimbursement-claims` | HR,SA | `?status=SUBMITTED|APPROVED|REJECTED&employeeId=&page=&limit=` |
| POST | `/payroll/reimbursement-claims` | ALL | Body: `{employeeId, categoryId, amount, currency, description, proofUrl}` |
| PATCH | `/payroll/reimbursement-claims/:id` | HR,SA | Body: `{status: "APPROVED"|"REJECTED"}` |

**Response shape:** `{ claim: { id, employeeId, categoryId, amount, currency, description, status, submittedAt, decidedAt, category: { code, label, monthlyCap } } }`

### F.7 — Garnishments
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/employees/:id/garnishments` | HR,SA | List garnishments for employee |
| POST | `/payroll/employees/:id/garnishments` | HR,SA | Body: `{type, amountKind, amountValue, effectiveFrom, priority?, protectedEarningsFloor?, cap?, reference?, effectiveTo?}` |
| PATCH | `/payroll/employees/:id/garnishments/:garnishmentId` | HR,SA | Partial update |
| DELETE | `/payroll/employees/:id/garnishments/:garnishmentId` | HR,SA | Hard delete |

**Garnishment shape:** `{ id, employeeId, type(COURT_ORDER|LOAN_RECOVERY|TAX_LEVY|CHILD_SUPPORT), priority, amountKind(FLAT|PERCENTAGE), amountValue, protectedEarningsFloor, cap, reference, effectiveFrom, effectiveTo }`

### F.8 — Run Approvals, Variance & Audit
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| POST | `/payroll/runs/:id/approvals/:level` | HR,SA | Body: `{approvedBy, comment}`. Level 1 or 2 |
| GET | `/payroll/runs/:id/variance` | HR,SA | `{ runId, thresholdPct, comparedToPeriod, items: [{ employeeId, employeeName, currentNet, previousNet, deltaPct, flags[] }] }` |
| GET | `/payroll/runs/:id/audit` | HR,SA | **`data` is `PayrollRunAuditEntry[]`** (array). UI calls `.map()` on `data` directly. Entry: `{ id, runId, action, actor, at, detail? }` |
| POST | `/payroll/runs/:id/payslips/:payslipId/recalculate` | HR,SA | Re-run calculation for single payslip |
| POST | `/payroll/runs/:runId/payslips/:payslipId/hold` | HR,SA | Body: `{reason}`. Sets status=HELD |
| POST | `/payroll/runs/:runId/payslips/:payslipId/release` | HR,SA | Releases held payslip back to CALCULATED |
| POST | `/payroll/runs/:id/inputs/from-timesheets` | HR,SA | Imports approved timesheet hours into run inputs |

### F.9 — Disbursement & Payment Batch
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/runs/:id/payment-batch` | HR,SA | **PaymentBatch**. Returns empty shell `{ id: null, count: 0, lines: [], status: 'NONE' }` when no batch exists (not `null`) |
| POST | `/payroll/runs/:id/payment-batch` | HR,SA | Create payment batch (skips HELD payslips) |
| GET | `/payroll/runs/:id/bank-file` | HR,SA | `?format=NACH|CSV`. Returns flat file for bank upload |
| GET | `/payroll/payment-batches/:id/status` | HR,SA | Get batch by ID with status |
| POST | `/payroll/payment-batches/:id/reconcile` | HR,SA | Mark batch RECONCILED |

### F.10 — Payslip Publishing & Templates
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| POST | `/payroll/runs/:id/publish` | HR,SA | Publish payslips to employees (sets published=true) |
| GET | `/payroll/payslip-templates` | all authenticated | Get (or auto-create) payslip template. EMPLOYEE/MANAGER can read for self-service payslip drawer. |
| PATCH | `/payroll/payslip-templates` | HR_ADMIN, SUPER_ADMIN | Update sections, fields, logo, locale |

**Template shape (UI contract):** `{ id, name, locale, logoUrl, sections: [{ key, label, enabled, order, color }], fields: [{ key, label, enabled }], updatedAt }`

> Section `key` values: `earnings` | `deductions` | `employerContributions` | `oneTime` | `ytd` | `attendance` | `paymentInfo`. Backend normalizes legacy `id`/`visible` on read/write. Each section includes **`color`** (hex) — UI crashes without it.

### F.11 — Accounting Journal
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/runs/:id/journal` | HR,SA | Debit/credit journal for the run |
| GET | `/payroll/runs/:id/journal/export` | HR,SA | `?format=CSV`. Download journal as CSV |

**Journal shape (JournalDocument):** `{ runId, period, currency, lines: [{ account, costCenter, debit, credit, currency }], totalDebit, totalCredit, balanced, generatedAt }` — UI reads **`lines`** (not `entries`)

### F.12 — Events & Catalogue
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/events` | HR,SA | `?runId=`. **`data` is event array** `[{ id, type, runId, at, summary }]` (not `{ events: [] }`) |
| GET | `/payroll/event-catalogue` | HR,SA | Static list of all event types with descriptions |

### F.13 — Tax Forms
| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/employees/:id/tax-form` | HR,SA | `?type=FORM16|W2|P60&fy=YYYY-YY`. Returns tax form summary |

**Tax form shape:** `{ formType, fiscalYear, employee: {id, name, employeeCode, pan}, employer: {name, tan}, incomeDetails: {grossIncome, netTaxableIncome, taxDeducted}, downloadUrl }`

#### PayslipDetail — `GET /payroll/runs/:runId/payslips/:payslipId`

Consumed by payroll run detail **View payslip** drawer (`/payroll/:runId`).

```json
{
  "success": true,
  "data": {
    "id": "cmq5kde4c00awes8dxbqju4ds",
    "period": "2026-05",
    "periodLabel": "May 2026",
    "currency": "INR",
    "employee": { "id": "...", "firstName": "HR", "lastName": "Admin", "employeeCode": "E0003", "designation": "HR Manager", "departmentName": "HR", "panNumber": null },
    "company": { "name": "Acme Corp", "address": null, "logoUrl": null },
    "earnings": [{ "code": "BASIC", "name": "Basic Salary", "type": "EARNING", "amount": 45000, "monthlyAmount": 45000, "taxable": true }],
    "deductions": [{ "code": "PF", "name": "Provident Fund", "type": "DEDUCTION", "amount": 4500, "monthlyAmount": 4500, "taxable": false }],
    "employerContributions": [{ "code": "PF_ER", "name": "Employer PF", "type": "EMPLOYER_CONTRIBUTION", "amount": 4500, "monthlyAmount": 4500, "taxable": false }],
    "oneTimeAdditions": [],
    "oneTimeDeductions": [],
    "grossEarnings": 90000,
    "totalDeductions": 11000,
    "netPay": 79000,
    "workingDays": 22,
    "presentDays": 22,
    "leaveDays": 0,
    "lopDays": 0,
    "status": "PAID",
    "paymentDate": "2026-05-28",
    "paymentReference": null,
    "payrollRunId": "cmq5kdd6300aues8dg44o2fn8",
    "documentUrl": "https://res.cloudinary.com/.../payslip_E0003_2026_05.webp",
    "generatedAt": "2026-05-28T00:00:00.000Z",
    "ytd": { "fiscalYear": "2026-27", "monthsElapsed": 2, "grossEarnings": 180000, "taxableIncome": 156600, "taxDeducted": 13000, "totalDeductions": 22000, "netPay": 158000, "contributions": { "PF": 9000, "PF_ER": 9000 } }
  }
}
```

> **UI line items:** each `earnings[]` / `deductions[]` / `employerContributions[]` entry must include **`amount`** (UI reads this; `monthlyAmount` is back-compat alias).
> **`employerCost`:** `grossEarnings + sum(employerContributions[].amount)` — employer statutory amounts do not reduce `netPay`.
> **Empty state:** `404 NOT_FOUND` if payslip not in run. Drawer shows "Failed to load payslip" on non-2xx.

### Statutory contribution calculation (engine — no separate route)

On `POST /payroll/runs/:id/calculate`, the engine:

1. Resolves the pinned statutory pack (legal entity `statutoryPackId` or country-effective pack for run `period`).
2. Builds `componentByCode` from pay-group components including each `statutoryTag`.
3. For each `contributionScheme` in `pack.contributionSchemes`:
   - Wage base = sum of earning line `amount` where `component.statutoryTag === scheme.wageBaseTag`.
   - Untagged earnings are excluded.
   - `wageCeiling` (minor units in pack) caps the base: `min(rawBase, wageCeiling / 100)`.
   - Employee amount = `round(base × scheme.employee.rate / 100)` posted to `deductions[]` as `scheme.employee.component`.
   - Employer amount = `round(base × scheme.employer.rate / 100)` posted to `employerContributionsJson` as `scheme.employer.component`.
4. Pay-group deduction/employer components whose `code` matches scheme component codes are skipped (engine is source of truth).
5. `pinnedStatutoryPack` stored on run `summaryJson` at calculate time.

**Example:** `BASIC.statutoryTag = "PF_WAGE"`, scheme `wageBaseTag = "PF_WAGE"`, earning ₹50,000, ceiling ₹15,000 → PF employee ₹1,800, PF employer ₹1,800, `netPay` reduced by employee PF only.

**Registers:** `GET /payroll/runs/:id/register?type=STATUTORY` uses computed `pfEmployee` / `pfEmployer` from stored payslip lines. `type=SALARY` `employerCost` = gross + employer contributions (not hardcoded ×1.13).

### Payment batch detail (run-scoped)

**Frontend detail source:** `GET /payroll/runs/:runId/payment-batch` (not list-only `GET /payroll/payment-batches`).

**Response includes `lines[]`:** `{ payslipId, employeeId, employeeCode, employeeName, amount, currency, status, failureReason, payoutRef }`. Empty shell when no batch: `{ id: null, lines: [], status: "NONE" }`.

---

## Settings — Integrations (Phase 3 UI)

UI routes: `/settings/integration-email`, `/settings/integration-storage`, `/settings/integration-webhooks`

| Method | Path | Roles | UI consumer |
|--------|------|-------|-------------|
| GET | `/settings/integrations/email` | HR,SA | Email integration page |
| PATCH | `/settings/integrations/email` | HR,SA | Save sender/from settings |
| GET | `/settings/integrations/email/stats` | HR,SA | 24h delivery stats panel |
| POST | `/settings/integrations/email/test` | HR,SA | Send test email |
| GET | `/settings/integrations/storage` | HR,SA | Storage integration page |
| PATCH | `/settings/integrations/storage` | HR,SA | Folder/mime limits |
| GET | `/settings/webhooks` | HR,SA | Webhooks list + event catalog |
| POST | `/settings/webhooks` | HR,SA | Create webhook |
| PATCH | `/settings/webhooks/:id` | HR,SA | Update webhook |
| DELETE | `/settings/webhooks/:id` | HR,SA | Delete webhook |
| POST | `/settings/webhooks/:id/test` | HR,SA | Test delivery (simulated) |

**Email response (UI contract):** `{ provider, status: "connected"|"unconfigured"|"error", fromAddress, fromName, lastTestedAt, config: { apiKey, ...providerFields }, configured, enabled, domain?, domainVerified? }`

**Storage response (UI contract):** `{ provider: "s3"|"gcs"|"azure", status, lastTestedAt, config: { bucket, region, accessKeyId, versioningEnabled, presignedUrlTtlSeconds, ... }, retentionPolicies: [{ documentType, retentionDays, autoDeletionEnabled }], virusScan: { enabled, provider, webhookUrl } }`

**Garnishment response:** includes `amount: { kind: "FLAT"|"PERCENT_OF_DISPOSABLE", value }` (not flat `amountKind`/`amountValue` alone).

**Webhooks list:** `{ webhooks: [{ id, name, url, events[], enabled, secretMasked, lastTriggeredAt, createdAt }], eventCatalog: [{ type, label }] }`

---

## Dashboard — Pending Approvals (HR + Manager)

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/manager/approvals` | MGR, HR,SA | Dashboard pending approvals panel |

**HR_ADMIN / SUPER_ADMIN:** tenant-wide queue (`scope=tenant`). **MANAGER:** direct-report queue only.

**Response:** `{ items: [{ id, type, color, title, subtitle, employeeName, submittedAt, ... }], leaveRequests[], regularizationRequests[], timesheetRequests[], assetRequests[], total, approvalBreakdown }`

Each `items[]` entry includes **`color`** (hex). UI maps `type` → color; missing color crashes dashboard.

---

## Employee Profile — Activity

| Method | Path | Roles | UI route |
|--------|------|-------|----------|
| GET | `/employees/:id/activity` | HR,SA,MGR,EMP(own) | Profile → Activity tab |

**Response:** `{ items: [{ id, type, action, actionLabel, description, color, actorEmail?, createdAt, timestamp, fileUrl? }], total }`

---

## Employee Profile — Compensation

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/employees/:employeeId/salary` | HR,SA,EMP(own) | Compensation tab |

**`calculatedComponents[]`** each include **`color`** and **`amount`**. `BENEFIT` type is normalized to `EARNING` for UI. Reimbursement categories include **`color`**.

---

## Pay Schedules

| Method | Path | Roles | UI route |
|--------|------|-------|----------|
| GET | `/payroll/schedules` | HR,SA | `/settings/pay/schedules` |

Merges active pay groups + pay calendars. Seed via `node prisma/seedPhase3Integrations.js` or `npm run seed:production-api` (POST `/payroll/pay-calendars`).

**Empty state:** `[]` — UI shows empty table. **Live:** Render production (2026-06-09 audit: ≥6 schedules after API seed).

---

## Statutory Packs (newreqphase3 F.3) — Flat API

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/payroll/statutory-packs` | HR,SA | `?country=IN` optional filter |
| GET | `/payroll/statutory-packs/:id` | HR,SA | Flat response |
| POST | `/payroll/statutory-packs` | SA | **Flat body** — same fields as GET (no `packData` wrapper) |
| PATCH | `/payroll/statutory-packs/:id` | SA | Partial flat body |
| DELETE | `/payroll/statutory-packs/:id` | SA | `{ deleted: true }` or `409 PACK_IN_USE` |

**Flat response/request fields:** `country`, `version`, `effectiveFrom`, `effectiveTo`, `rounding`, `proration`, `taxRegimes[]`, `contributionSchemes[]`, `localTaxes[]`, **`statutoryComponents: string[]`**, `minimumWages[]`, **`gratuity`** (object or `null`).

**`statutoryComponents` contract:** Response is always `string[]` (e.g. `["PF", "PF_ER"]`). POST/PATCH accept `string[]` or legacy `{ code: string }[]`; backend normalizes to strings before persisting via `normalizeStatutoryComponents()`.

**Errors:** `409 PACK_VERSION_EXISTS` (duplicate tenant+country+version), `422 INVALID_PACK` (effectiveFrom > effectiveTo), `422 VALIDATION_ERROR` (`details: [{field, message}]`), `409 PACK_IN_USE` (referenced by legal entity).

**Storage:** Rule fields stored in DB `packData` JSON; API always flattened via `fmtStatutoryPackRow()` with normalized `statutoryComponents`.

---

## Payroll Run Types (newreqphase3)

| Type | POST body extras | Duplicate rule |
|------|------------------|----------------|
| `REGULAR` | default | `409 RUN_EXISTS` if second REGULAR same period |
| `OFF_CYCLE` | `employeeIds[]` | May coexist with REGULAR same period |
| `BONUS` / `ARREARS` | — (set `variablePay` on run inputs before calculate) | May coexist |
| `FNF` | `fnf: { employeeId, lastWorkingDay, yearsOfService, leaveBalanceDays, noticeShortfallDays }` | May coexist |
| `REVERSAL` | `reversalOfRunId` (target APPROVED/PAID) | May coexist |

**Response fields:** `type`, `employeeIds`, `employeeId`, `fnfParams`, `reversalOfRunId`, `reversalOfPeriodLabel`.

**Errors:** `422 INVALID_RUN_TYPE`, `422 REVERSAL_TARGET_REQUIRED`, `409 RUN_EXISTS` (REGULAR only).

**Calculate behavior:** OFF_CYCLE → subset employees; BONUS/ARREARS → only rows with `variablePay` input; REVERSAL → negate target payslip lines; FNF → single employee.

---

## Deployed UI Complete Audit — Endpoint Reference (2026-06-09)

> Evidence: `deployed-ui-complete-final-audit-evidence/`. Command: `npm run test:deployed-ui` or `npm run test:playwright:deployed`.

### Settings — Payslip Template

| Method | Path | Roles | Request | Response `data` | UI |
|--------|------|-------|---------|-----------------|-----|
| GET | `/payroll/payslip-templates` | all authenticated | — | `{ id, name, locale, sections[{key,label,enabled,order,color}], fields[] }` | `/settings/pay/payslip-template` and employee self-service payslip drawer |
| PATCH | `/payroll/payslip-templates/:id` | HR_ADMIN, SUPER_ADMIN | `{ sections?, fields?, name? }` | Updated template | Save button (enabled only when dirty) |

**Seed:** `seedPhase3Integrations.js` normalizes 7 sections with `color`. **Live:** ✅

### Settings — Email / Resend

| Method | Path | Roles | Request | Response `data` | UI |
|--------|------|-------|---------|-----------------|-----|
| GET | `/settings/integrations/email` | HR,SA | — | `{ provider, status, config:{apiKey}, fromAddress, apiKeyMasked, domainVerified }` | `/settings/integration-email` |
| PATCH | `/settings/integrations/email` | HR,SA | partial settings | same shape | Save |
| GET | `/settings/integrations/email/stats` | HR,SA | — | `{ sent24h, delivered24h, bounced24h, failed24h, lastSentAt }` | Stats panel |
| POST | `/settings/integrations/email/test` | HR,SA | `{ to? }` | `{ sent: true, message }` | Send test email |

**Provider:** Resend when `RESEND_API_KEY` set on Render. **Live:** ✅ test button 200.

### Settings — Storage / Cloudinary

| Method | Path | Roles | Request | Response `data` | UI |
|--------|------|-------|---------|-----------------|-----|
| GET | `/settings/integrations/storage` | HR,SA | — | `{ provider: "cloudinary"\|"s3", status, config:{bucket,region,cloudName,folder,...}, retentionPolicies[], virusScan, metadataStore }` | `/settings/integration-storage` |
| PATCH | `/settings/integrations/storage` | HR,SA | partial | same | Save |
| POST | `/settings/integrations/storage/test` | HR,SA | — | `{ bucket, latencyMs, status }` | Test connection |

**Provider mapping:** defaults to `cloudinary` when Cloudinary env vars configured; S3-shaped `config` retained for UI compatibility. **Upload:** `POST /employees/:id/documents` → `503 STORAGE_NOT_CONFIGURED` until Cloudinary on Render.

### Settings — Webhooks

| Method | Path | Roles | Request | Response | UI |
|--------|------|-------|---------|----------|-----|
| GET | `/settings/webhooks` | HR,SA | — | `{ webhooks[], eventCatalog[] }` | `/settings/integration-webhooks` |
| POST | `/settings/webhooks` | HR,SA | `{ name, url, events[], enabled?, secret? }` | webhook object | Create modal |
| PATCH | `/settings/webhooks/:id` | HR,SA | partial | webhook | Edit / enable |
| POST | `/settings/webhooks/:id/test` | HR,SA | — | `{ delivered, statusCode, testedAt }` | Test button |

**Seed:** `seed:production-api` or `seedPhase3Integrations.js`. **Empty:** `webhooks: []`.

### Employee Documents

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/employees/:id/documents` | HR,SA,EMP(own) | List metadata from Postgres |
| POST | `/employees/:id/documents` | HR,SA,EMP(own) | multipart; WebP via sharp; Cloudinary required |
| DELETE | `/employees/:id/documents/:docId` | HR,SA | Removes DB + Cloudinary |

**Audit:** `DOCUMENT_UPLOADED` / `DOCUMENT_DELETED` logged to `audit_logs` (Activity tab). **Download:** client opens `fileUrl` from list response.

### Employee Activity (audit-logs)

| Method | Path | Roles | Query | Response |
|--------|------|-------|-------|----------|
| GET | `/audit-logs` | HR,SA,MGR | `entity=Employee&entityId=&limit=` | `{ logs[], pagination }` |

UI Activity tab uses this endpoint (not `/employees/:id/activity` alias). **Seed:** PATCH employee or upload document to generate rows. `EMPLOYEE_UPDATED` logged on PATCH.

### Payroll Deep Actions (PAID run)

| Action | Method | Path | Roles |
|--------|--------|------|-------|
| View payslip | GET | `/payroll/runs/:runId/payslips/:payslipId` | HR,SA |
| Export register | GET | `/payroll/runs/:id/register?type=SALARY` | HR,SA |
| Publish payslips | POST | `/payroll/runs/:id/publish` | HR,SA |
| Payment batch | GET/POST | `/payroll/runs/:id/payment-batch` | HR,SA |
| Bank file | GET | `/payroll/runs/:id/bank-file?format=NACH` | HR,SA |
| Accounting journal | GET | `/payroll/runs/:id/journal` | HR,SA |
| Statutory return | GET | `/payroll/runs/:id/statutory-return` | HR,SA |
| Audit pack | GET | `/payroll/reports/audit-pack?runId=` | HR,SA |
| Audit trail | GET | `/payroll/runs/:id/audit` | HR,SA |
| Events | GET | `/payroll/events?runId=` | HR,SA |
| Event catalogue | GET | `/payroll/event-catalogue` | HR,SA |

**2026-06-09 deployed audit:** all deep actions PASS on May 2026 PAID run.

### Timesheets (all roles)

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/timesheets?week=YYYY-MM-DD` | all with employee | Week grid |
| POST | `/timesheets/entries` | EMP | Add entry |
| PATCH | `/timesheets/entries/:id` | EMP | Edit |
| DELETE | `/timesheets/entries/:id` | EMP | Delete |
| POST | `/timesheets/:id/submit` | EMP | Submit week |
| GET | `/timesheets/approvals` | MGR,HR | Approval queue |
| POST | `/timesheets/:id/approve` | MGR,HR | Approve |
| POST | `/timesheets/:id/reject` | MGR,HR | `{ comment }` |
| GET/POST/PATCH | `/timesheets/projects` | HR,MGR | Projects tab |
| POST | `/timesheets/projects/:id/tasks` | HR,MGR | Tasks |

**SUPER_ADMIN:** no employee record — UI shows graceful empty state (not 500).

### Phase 3 Modules

| Module | UI route | Key APIs | Live status |
|--------|----------|----------|-------------|
| Recruitment | `/recruitment` | `/recruitment/summary`, `/openings`, `/candidates` | ✅ load |
| Performance | `/performance` | `/performance/goals`, `/performance/reviews` | ✅ load |
| Assets | `/assets` | `/assets`, `/assets/requests` | ✅ load |
| Announcements | `/announcements` | `/announcements` | ✅ load |

### Known Console Noise

Cold `/api/auth/me` before login should now return `401 UNAUTHORIZED` when no cookie is present. A `400 INVALID_TENANT` there is a regression.

---

## Frontend QA Sweep Fixes (2026-06-10)

### BE-1 — Auth: Invalid JWT now returns 401, not 400
`GET /auth/me` and other protected endpoints now return `401 UNAUTHORIZED` for missing cookies/tokens and `401 INVALID_TOKEN` for garbage, expired, or forged JWTs. `400 INVALID_TENANT` remains valid only when the caller explicitly supplies a bad tenant context such as `X-Tenant-Key` or subdomain.

### BE-2 — PayGroup: overrideCalculationType null/blank accepted
`POST /payroll/pay-groups` and `PATCH /payroll/pay-groups/:id` now accept `null` or `""` for `overrideCalculationType` without 500. Only `FLAT`, `PERCENTAGE`, `FORMULA`, or null are valid.

### BE-3 — Employees: terminated employee lookup
`GET /employees/:id?includeTerminated=true` — HR_ADMIN and SUPER_ADMIN can retrieve soft-deleted/terminated employees by appending this query param. Without the param, `deletedAt: null` is still enforced.

### BE-4 — Payroll Salary: effectiveTo validation
`POST /payroll/employees/:id/salary` now returns `422 VALIDATION_ERROR` if `effectiveTo < effectiveFrom`.

### BE-5 — Leave Team Endpoints: SUPER_ADMIN support
`GET /leave/team/requests` and `GET /leave/team/calendar` now work for SUPER_ADMIN (who has no employee profile). SUPER_ADMIN gets org-wide results (`managerEmployeeId = null` path). Other non-employee users still get `403 FORBIDDEN`.

**Leave team request shape** (with fix):
```json
{
  "id": "...",
  "referenceNo": "LVR-0001",
  "employeeId": "...",
  "employeeName": "Priya Sharma",
  "employeeCode": "E0004",
  "leaveTypeId": "...",
  "leaveTypeName": "Annual Leave",
  "startDate": "2026-06-10T00:00:00.000Z",
  "endDate": "2026-06-12T00:00:00.000Z",
  "totalDays": 3,
  "status": "PENDING",
  "reason": "Vacation",
  "submittedAt": "2026-06-08T10:00:00.000Z",
  "decidedAt": null
}
```

### BE-6 — Leave Approve/Reject: approverComment in response
`PATCH /leave/requests/:id/approve` and `PATCH /leave/requests/:id/reject` now include `approverComment` in the response body:
```json
{ "id": "...", "referenceNo": "LVR-0001", "status": "APPROVED", "decidedAt": "...", "approverComment": "Approved as planned" }
```

### BE-7 — Payroll Cancel: HR_ADMIN can cancel
`POST /payroll/runs/:id/cancel` now accessible to `HR_ADMIN` (previously SUPER_ADMIN only). PAID runs still cannot be cancelled by anyone (400 INVALID_STATUS from repository).

### BE-8 — Payslip Templates: all authenticated users can read
`GET /payroll/payslip-templates` is now accessible to all authenticated users (previously HR_ADMIN only). Required for employee self-service payslip drawer.

### BE-9 — Report Export: status + download endpoints added
Three new routes:
- `GET /reports/export/:jobId` — returns job status (`PENDING` / `SUCCESS` / `FAILED`)
- `GET /reports/export/:jobId/status` — alias for above
- `GET /reports/export/:jobId/download` — streams `text/csv` with `Content-Disposition: attachment`

**Status response:**
```json
{ "jobId": "...", "status": "SUCCESS", "exportType": "attendance", "exportedAt": "..." }
```
**Download:** Returns `text/csv` with `Content-Disposition: attachment; filename="<type>-<YYYY-MM-DD>.csv"`. If still pending → 202 JSON `{ "status": "PENDING" }`. Export is processed near-synchronously.

### BE-10 — Roles: createRole persists permissions
`POST /settings/roles` now writes `permissions[]` as `RolePermission` DB records on creation. If a permission key doesn't exist in the `Permission` table, it is silently skipped.

### BE-11 — Roles: customRoles in GET /settings/roles-permissions
`GET /settings/roles-permissions` now includes `customRoles` array:
```json
{
  "roles": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE", "my-custom-role"],
  "permissions": ["leave:approve", "reports:read"],
  "matrix": { "SUPER_ADMIN": ["leave:approve", ...], "my-custom-role": [] },
  "customRoles": [{ "key": "my-custom-role", "name": "Custom Role" }]
}
```

### Analytics Filters (all 9 endpoints)
All analytics endpoints now accept three optional query params:

| Param | Type | Description |
|-------|------|-------------|
| `departmentId` | string | Filter results to a specific department |
| `from` | YYYY-MM-DD | Start date (overrides preset `range`) |
| `to` | YYYY-MM-DD | End date (overrides preset `range`) |

All 9 endpoints **accept** these query params without error. Filtering behavior per endpoint:

| Endpoint | `departmentId` applied | `from`/`to` applied |
|----------|----------------------|---------------------|
| `/analytics/attendance` | ✅ filters AttendanceRecord | ✅ overrides preset range |
| `/analytics/headcount-by-department` | ✅ filters to single dept | — |
| `/analytics/leave-summary` | ✅ filters LeaveRequest by dept | ✅ overrides preset range |
| `/analytics/recent-activity` | ✅ filters AuditLog by actor dept | — |
| `/analytics/summary` | — (accepted, ignored) | — |
| `/analytics/workforce-trend` | — (accepted, ignored) | — |
| `/analytics/attrition` | — (accepted, ignored) | — |
| `/analytics/payroll-cost` | — (accepted, ignored) | — |
| `/analytics/department-performance` | — (accepted, ignored) | — |

**Note:** "accepted, ignored" means the param is valid (no 400 error) but the response is unfiltered. Full filtering for workforce-trend, attrition, payroll-cost, and department-performance is deferred.
