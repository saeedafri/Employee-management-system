# EMS API — Actual Response Mapping

> **Last verified: 2026-05-27** (bulk approve live-tested + null balance fix deployed)
> Base URL: `https://employee-management-system-2b9q.onrender.com/api/v1`
> Local: `http://localhost:3000/api/v1`
> Email: Resend HTTP API (port 443, not SMTP — OTP delivery live and tested)

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

## HTTP Status Code Rules

| Situation | Status |
|-----------|--------|
| Success GET/PATCH/DELETE | 200 |
| Success POST (create) | 201 |
| Validation error (missing/invalid fields) | 400 |
| Conflict (duplicate, cycle, not-empty) | 409 |
| Not found | 404 |
| Auth/token missing or invalid | 401 |
| Insufficient role | 403 |
| Other bad request | 400 |

---

## Auth

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
**Top-level departments only** (sub-departments are excluded from this chart; their employees roll up into the parent). Sorted by `employeeCount` descending.

```json
{
  "data": [
    { "departmentId": "...", "departmentName": "Engineering", "employeeCount": 12, "activeCount": 10 },
    { "departmentId": "...", "departmentName": "Sales",       "employeeCount": 9,  "activeCount": 9  }
  ],
  "meta": { "cached": false, "generatedAt": "2026-05-24T07:00:00.000Z" }
}
```

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
      "employmentStatus": "ACTIVE"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 14, "pages": 1 }
}
```

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

## New Endpoints — Implemented 2026-05-27 (UI Team api_to_be_created.md)

### `POST /auth/otp/initiate` — Public
Send or resend OTP for an existing challenge. Used in MFA and forgot-password flows.
**Body:** `{ "challengeId": "uuid" }`
**Response:** `{ challengeId, deliveryMethod, expiresAt, resendAvailableAt }`
**Errors:** `CHALLENGE_NOT_FOUND` (404), `RESEND_TOO_SOON` (429), `MAX_RESENDS` (429)

### `POST /holidays/import` — HR_ADMIN, SUPER_ADMIN
Upload `.ics` file. Returns `{ jobId, previewUrl }`. Job lives 15 min in memory.
**Response 202:** `{ jobId: "imp_xxxx", previewUrl: "/api/v1/holidays/import/imp_xxxx/preview" }`
**Errors:** `INVALID_FILE_TYPE` (422), `FILE_TOO_LARGE` (422), `PARSE_ERROR` (400)

### `GET /holidays/import/:jobId/preview` — HR_ADMIN, SUPER_ADMIN
**Response:** `{ candidates: [{ name, date, isOptional, willOverwrite }], summary: { new, overwrites, skipped } }`
**Error:** `JOB_NOT_FOUND` (404)

### `POST /holidays/import/:jobId/commit` — HR_ADMIN, SUPER_ADMIN
**Body:** `{ "overwriteExisting": true }`
**Response:** `{ imported, overwritten, skipped }`
**Errors:** `JOB_NOT_FOUND` (404), `ALREADY_COMMITTED` (409)

### `GET /employee/documents` — any authenticated (own only)
Self-service document list for the logged-in employee.
**Response:** `{ documents: [{ id, filename, category, sizeBytes, status, uploadedAt }] }`
Status enum: `VERIFIED | PENDING | REJECTED`

### `GET /employee/dashboard` — leaveBalanceSummary ✅ live
Field `leaveBalanceSummary` confirmed present: top-3 active leave types ordered by allowance desc.
`[{ code, name, available }]`

### `POST /attendance/regularization/:id/documents` — EMPLOYEE, MANAGER (own)
Attach supporting doc to a regularization request. One doc per request.
**Body:** `multipart/form-data` field `document` (PDF/JPG/PNG/DOC/DOCX, max 5 MB)
**Response 201:** `{ documentUrl: "https://res.cloudinary.com/..." }`
**Errors:** `REGULARIZATION_NOT_FOUND` (404), `DOCUMENT_ALREADY_EXISTS` (409), `INVALID_FILE_TYPE` (422), `FILE_TOO_LARGE` (422), `STORAGE_NOT_CONFIGURED` (503)

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

