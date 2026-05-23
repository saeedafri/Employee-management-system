# EMS — Wireframes → API Mapping (Production Ready)

> **Last verified: `2026-05-23`**  
> API base: `https://employee-management-system-2b9q.onrender.com/api/v1`  
> Swagger UI: `https://employee-management-system-2b9q.onrender.com/docs`  
> Email: Resend HTTP API (OTP delivery confirmed working)  
> Auth: JWT + MFA (OTP via email). All users have MFA enabled — login returns `challengeId`, complete with `POST /auth/verify-otp`.

---

## How Identity Works — Read This First

Every API call identifies "which employee" using one of three modes:

| Mode | How the server knows | UI must do |
|---|---|---|
| **Mode 1 — Self** | Reads `employeeId` from the JWT token | Just send `Authorization: Bearer <token>` |
| **Mode 2 — Target** | Reads `:id` from the URL | Pass the employee's ID in the URL |
| **Mode 3 — Team** | Uses JWT `employeeId` as manager, queries direct reports | Just send `Authorization: Bearer <token>` |

**Login flow — two paths depending on user MFA setting:**
```
MFA OFF (most users):
  POST /auth/login → returns { accessToken, user } directly. Done.

MFA ON (mohammadsaeedafri9@gmail.com):
  POST /auth/login → returns { mfaRequired: true, challengeId, ... }
  Check email for OTP code
  POST /auth/verify-otp { challengeId, code } → returns { accessToken, user }
```

**Login response (no MFA) — store all of this:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": "usr_abc",
      "email": "mohammadsaeedafri9@gmail.com",
      "memberType": "HR_ADMIN",
      "employeeId": "emp_xyz",
      "employee": { "firstName": "Jane", "lastName": "Smith", "designation": "HR Manager" }
    }
  }
}
```

**Route by `memberType` after login:**
```
SUPER_ADMIN → Analytics Dashboard (Page 04)
HR_ADMIN    → Analytics Dashboard (Page 04)  — also has own employee page (Page 06)
MANAGER     → Manager Dashboard  (Page 05)  — also has own employee page (Page 06)
EMPLOYEE    → Employee Dashboard (Page 06)
```

**If `employeeId` is `null`** (SUPER_ADMIN by default): do NOT show check-in, personal dashboard, leave request, or documents tabs. The server returns `400 NO_EMPLOYEE_RECORD`.

---

## Test Users

| Login Email | Password | Role | MFA | Has Employee Record | Tests Pages |
|---|---|---|---|---|---|
| `superadmin@acme.test` | `Password123!` | SUPER_ADMIN | ❌ Off | ❌ No | 14, 15, analytics |
| `mohammadsaeedafri9@gmail.com` | `Password123!` | HR_ADMIN | ✅ On | ✅ E0003 | 04, 06, 07, 08, 09, 10, 13, 15 |
| `aman@acme.test` | `Password123!` | MANAGER | ❌ Off | ✅ E0001 (19 reports) | 05, 06, 11, 12 |
| `priya@acme.test` | `Password123!` | EMPLOYEE | ❌ Off | ✅ E0002 | 06, 11, 12 |
| `riya@acme.test` | `Password123!` | MANAGER | ❌ Off | ✅ | 05, 06 |
| `dev1@acme.test` | `Password123!` | EMPLOYEE | ❌ Off | ✅ | 06 |

> **X-Tenant-Key**: `acme-corp-001` — always include this header on login. After login, JWT carries it automatically.  
> **MFA users**: `mohammadsaeedafri9@gmail.com` has MFA enabled — login returns `mfaRequired:true`, OTP delivered to that inbox. All other users log in directly and return `accessToken` immediately.

---

## Page 01 — Login

| UI Action | Method | Endpoint | Body | Notes |
|---|---|---|---|---|
| Submit form | POST | `/auth/login` | `{ "email": "...", "password": "..." }` | Include `x-tenant-key: acme-corp-001` |
| Enter OTP | POST | `/auth/verify-otp` | `{ "challengeId": "...", "code": "123456" }` | Returns accessToken + user on success |
| Resend OTP | POST | `/auth/resend-otp` | `{ "challengeId": "..." }` | 60s cooldown between resends |

**Step 1 — `POST /auth/login` response (MFA enabled):**
```json
{
  "success": true,
  "data": {
    "mfaRequired": true,
    "challengeId": "b99c55e6-0de6-4713-9f9b-32597dea968b",
    "destinationMasked": "m****************9@gmail.com",
    "expiresIn": 600
  }
}
```

**Step 2 — `POST /auth/verify-otp` response (success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "...",
    "user": {
      "id": "...", "email": "...", "memberType": "HR_ADMIN",
      "employeeId": "emp_xyz",
      "employee": { "firstName": "Jane", "lastName": "Smith" }
    }
  }
}
```

**Error codes:** `INVALID_CREDENTIALS` (401), `OTP_INVALID` (400), `OTP_EXPIRED` (400), `OTP_LOCKED` (429 — 5 failed attempts), `429` rate limit on login.

---

## Page 02 — Forgot Password

| UI Action | Method | Endpoint | Body |
|---|---|---|---|
| Send reset email | POST | `/auth/forgot-password` | `{ "email": "..." }` |
| Validate token on next screen | GET | `/auth/validate-reset-token?token=…` | – |
| Set new password | POST | `/auth/reset-password` | `{ "token": "...", "newPassword": "..." }` |

Always show "If this email exists, we sent a reset link." regardless of response — endpoint always returns `202`.

---

## Page 03 — OTP Verification

| UI Action | Method | Endpoint | Body |
|---|---|---|---|
| Verify code | POST | `/auth/verify-otp` | `{ "challengeId": "...", "code": "123456" }` |
| Resend code | POST | `/auth/resend-otp` | `{ "challengeId": "..." }` |

- OTP expires in 10 minutes
- Lockout after 5 failed attempts (429 `OTP_LOCKED`)
- Resend throttled: 60s cooldown, max 3 resends per challenge

---

## Page 04 — HR/Admin Analytics Dashboard

**Access:** HR_ADMIN, SUPER_ADMIN only. MANAGER and EMPLOYEE get `403`.  
**Test as:** `mohammadsaeedafri9@gmail.com` (HR_ADMIN)

| Widget | Method | Endpoint | Verified |
|---|---|---|---|
| 4 KPI stat cards | GET | `/analytics/summary` | ✅ 200 |
| Attendance chart (last 30 days) | GET | `/analytics/attendance` | ✅ 200 |
| Headcount by Department donut | GET | `/analytics/headcount-by-department` | ✅ 200 |
| Recent Activity feed | GET | `/analytics/recent-activity` | ✅ 200 |
| Leave summary | GET | `/analytics/leave-summary` | ✅ 200 |

**`/analytics/summary` response shape:**
```json
{
  "data": {
    "totalEmployees": 79,
    "activeToday": 12,
    "onLeave": 4,
    "openRequests": 7
  }
}
```

> HR_ADMIN who is also an employee: they can ALSO call `GET /employee/dashboard` (Mode 1) to see their own personal summary. Show a nav toggle.

---

## Page 05 — Manager Dashboard

**Access:** MANAGER and HR_ADMIN. EMPLOYEE gets `403`.  
**Test as:** `mohammadsaeedafri9+aman@gmail.com` (MANAGER, 19 direct reports)  
**Identity: Mode 3** — server uses JWT `employeeId` to scope to that manager's team.

| Widget | Method | Endpoint | Verified |
|---|---|---|---|
| Team stats (size, present, pending) | GET | `/manager/dashboard` | ✅ 200 |
| Pending approvals list | GET | `/manager/approvals` | ✅ 200 |
| Team roster | GET | `/manager/team` | ✅ 200 |
| Team attendance grid (M-F) | GET | `/manager/team/attendance` | ✅ 200 |
| Approve leave | PATCH | `/manager/leave-requests/:id/decision` | ✅ |
| Deny leave | PATCH | `/manager/leave-requests/:id/decision` | ✅ |
| Approve/deny regularization | PATCH | `/manager/regularization-requests/:id/decision` | ✅ |

**`/manager/dashboard` response shape:**
```json
{ "data": { "teamSize": 19, "presentToday": null, "pendingApprovals": 5 } }
```

**`/manager/leave-requests/:id/decision` body:**
```json
{ "decision": "APPROVED", "comment": "Approved" }
```
`decision` enum: `APPROVED | REJECTED`

> Manager who is also an employee: show Page 05 as primary, with a tab/link to their personal Page 06.

---

## Page 06 — Employee Personal Dashboard

**Access:** Any role with a linked employee record. `SUPER_ADMIN` (no emp record) gets `400 NO_EMPLOYEE_RECORD`.  
**Identity: Mode 1** — all calls use JWT `employeeId` automatically.  
**Test as:** `mohammadsaeedafri9+priya@gmail.com`

| Widget | Method | Endpoint | Alias Path | Verified |
|---|---|---|---|---|
| Personal summary (name, dept, leave) | GET | `/employee/dashboard` | – | ✅ 200 |
| Check-in | POST | `/attendance/check-in` | – | ✅ 201 |
| Check-out | POST | `/attendance/check-out` | – | ✅ 200 |
| Today's status | GET | `/attendance/today` | – | ✅ 200 |
| Leave balance | GET | `/leave/balance` | – | ✅ 200 |
| Leave type dropdown | GET | `/leave/types` | – | ✅ 200 |
| Submit leave request | POST | `/leave/requests` | – | ✅ 201 |
| Upcoming holidays | GET | `/holidays?year=2026` | – | ✅ 200 |
| My documents | GET | `/employee/documents` | `/employees/me/documents` | ✅ 200 |
| My team (manager + peers) | GET | `/employee/team` | `/employees/me/team` | ✅ 200 |

**`/employee/dashboard` response shape:**
```json
{
  "data": {
    "employeeName": "Priya Sharma",
    "designation": "Software Engineer",
    "department": "Engineering",
    "todayAttendance": { "status": "PRESENT", "checkInAt": "...", "checkOutAt": "..." },
    "pendingLeaves": 0,
    "upcomingLeave": null
  }
}
```

**`/leave/types` response shape:**
```json
{
  "data": [
    { "id": "...", "name": "Annual Leave", "code": "AL", "annualAllowance": 21, "carryForwardAllowed": true, "isPaid": true },
    { "id": "...", "name": "Sick Leave", "code": "SL", "annualAllowance": 10, "carryForwardAllowed": false, "isPaid": true }
  ]
}
```
> Use `id` from this response as `leaveTypeId` when submitting `POST /leave/requests`.

**`/attendance/check-in` body:**
```json
{ "latitude": 28.5244, "longitude": 77.1855, "note": "optional" }
```
Location is optional. Returns `{ "id": "...", "checkInAt": "...", "geofenceValid": true }`.

**`/employee/team` response shape:**
```json
{
  "data": {
    "manager": { "name": "Aman Kumar", "designation": "Manager", "email": "aman@acme.test" },
    "peers": [{ "name": "...", "designation": "...", "email": "..." }]
  }
}
```

---

## Page 07 — Employees List

**Access:** All roles. Server auto-filters by role — no extra params needed.  
**Identity: Mode 2** (HR targets all; Manager scoped to team; Employee sees self only — server enforces this).

| UI Action | Method | Endpoint | Verified |
|---|---|---|---|
| Load list (paginated) | GET | `/employees?page=1&limit=20` | ✅ 200 |
| Search | GET | `/employees?search=priya` | ✅ 200 |
| Filter by department | GET | `/employees?departmentId=<id>` | ✅ |
| Filter by status | GET | `/employees?status=ACTIVE` | ✅ |
| Row click → profile | GET | `/employees/:id` | ✅ 200 |
| Export CSV | GET | `/employees/export/csv` | ✅ 200 (HR only) |
| Export XLSX/CSV/JSON (async) | POST | `/export/employees` | ✅ 202 (HR only) |

**Auto row-level filtering (server-enforced, no extra params):**
- `HR_ADMIN / SUPER_ADMIN` → all employees in tenant (79 in DB)
- `MANAGER` → their direct reports only
- `EMPLOYEE` → themselves only

**`GET /employees` response shape:**
```json
{
  "data": {
    "employees": [
      { "id": "...", "employeeCode": "E0001", "firstName": "Aman", "lastName": "Kumar",
        "designation": "Manager", "department": { "name": "Engineering" },
        "employmentStatus": "ACTIVE", "joinedOn": "..." }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 79, "pages": 4 }
  }
}
```

---

## Page 08 — Employee Profile

**Access:** HR sees anyone; Manager sees team only; Employee sees self only.  
**Identity: Mode 2** — `employeeId` in URL.

| Tab / Section | Method | Endpoint | Notes |
|---|---|---|---|
| Overview (personal + job) | GET | `/employees/:id` | Full employee row |
| Attendance tab | GET | `/attendance/records?month=YYYY-MM` | Pass month param |
| Leave tab | GET | `/leave/requests` | Employee's own if self; HR can see anyone |
| Documents tab | GET | `/employees/:id/documents` | Returns uploaded docs list |
| Upload document | POST | `/employees/:id/documents` | multipart/form-data, ?documentType= |
| Delete document | DELETE | `/employees/:id/documents/:docId` | HR/Admin only |
| Edit button | PATCH | `/employees/:id` | HR only for others |
| Deactivate | PATCH | `/employees/:id` | Body: `{ "employmentStatus": "INACTIVE" }` |

**`GET /employees/:id` response shape:**
```json
{
  "data": {
    "id": "...", "employeeCode": "E0002", "firstName": "Priya", "lastName": "Sharma",
    "workEmail": "priya@acme.test", "designation": "Software Engineer",
    "employmentType": "FULL_TIME", "employmentStatus": "ACTIVE",
    "joinedOn": "...",
    "department": { "id": "...", "name": "Engineering" },
    "manager": { "id": "...", "firstName": "Aman", "lastName": "Kumar" }
  }
}
```

**`POST /employees/:id/documents` — upload a document:**
- Send as `multipart/form-data`
- Query param: `?documentType=PASSPORT` (enum: `PASSPORT | ID_CARD | RESUME | OFFER_LETTER | CONTRACT | CERTIFICATE | OTHER`)
- Requires Cloudinary env vars on Render — returns `503 STORAGE_NOT_CONFIGURED` if not set
- On success returns `{ "success": true, "data": { "id": "...", "fileName": "...", "fileUrl": "...", "verificationStatus": "PENDING" } }`

**`GET /employees/:id/documents` response shape:**
```json
{
  "success": true,
  "data": [
    { "id": "...", "documentType": "PASSPORT", "fileName": "passport.pdf",
      "fileUrl": "https://res.cloudinary.com/...", "mimeType": "application/pdf",
      "sizeBytes": 204800, "verificationStatus": "PENDING", "createdAt": "..." }
  ]
}
```

**Access control (server-enforced):**
- `GET /employees/:id` where `:id` is another employee → `403 FORBIDDEN` if you're EMPLOYEE
- `GET /employees/:id` where `:id` is own employee ID → `200` for any role

---

## Page 09 — Create / Edit Employee

**Access:** HR_ADMIN and SUPER_ADMIN only.  
**Test as:** `mohammadsaeedafri9@gmail.com` (HR_ADMIN)

| UI Action | Method | Endpoint | Body |
|---|---|---|---|
| Department dropdown | GET | `/departments` | Returns flat list |
| Manager search dropdown | GET | `/employees?search=<name>&limit=10` | – |
| Create employee | POST | `/employees` | See below |
| Update employee | PATCH | `/employees/:id` | Partial body OK |
| Delete (soft) | DELETE | `/employees/:id` | HR only |

**`POST /employees` body:**
```json
{
  "employeeCode": "E0010",
  "firstName": "John",
  "lastName": "Doe",
  "workEmail": "john.doe@company.com",
  "designation": "Software Engineer",
  "joinedOn": "2026-01-15",
  "employmentType": "FULL_TIME",
  "departmentId": "<id from GET /departments>",
  "managerId": "<id from GET /employees>",
  "phone": "+919876543210",
  "location": "Mumbai"
}
```
**Required:** `employeeCode`, `firstName`, `lastName`, `workEmail`, `joinedOn`  
**Optional:** `designation`, `departmentId`, `managerId`, `phone`, `location`, `employmentType`, `employmentStatus`  
**employmentType enum:** `FULL_TIME | PART_TIME | CONTRACT | INTERN`  
**employmentStatus enum:** `ACTIVE | INACTIVE | ON_LEAVE | RESIGNED | TERMINATED`

---

## Page 10 — Departments

**Access:** HR write; all roles can read.

| UI Action | Method | Endpoint | Body | Verified |
|---|---|---|---|---|
| Load tree | GET | `/departments` | – | ✅ 200 |
| Department detail | GET | `/departments/:id` | – | ✅ |
| Employees in dept | GET | `/employees?departmentId=:id` | – | ✅ |
| Add department | POST | `/departments` | `{ "name": "...", "description": "...", "parentId": "...", "headEmployeeId": "..." }` | ✅ |
| Edit / move | PATCH | `/departments/:id` | Same fields (partial) | ✅ |
| Delete | DELETE | `/departments/:id` | – | ✅ |

Returns flat list with `parentId` — client builds the hierarchy tree.

**`GET /departments` response shape:**
```json
{
  "data": [
    { "id": "...", "name": "Engineering", "parentId": null, "depth": 0,
      "headEmployee": { "firstName": "Aman", "lastName": "Kumar" },
      "_count": { "employees": 24, "children": 3 } }
  ]
}
```

---

## Page 11 — Attendance Records

**Identity: Mode 1 for own records; Mode 3 for team records.**

| View / Action | Method | Endpoint | Notes | Verified |
|---|---|---|---|---|
| Own records (calendar) | GET | `/attendance/records?month=2026-05` | Mode 1 — no employeeId param | ✅ 200 |
| Own records (date range) | GET | `/attendance/records?fromDate=2026-05-01&toDate=2026-05-31` | Alt to month | ✅ |
| Team records (manager) | GET | `/attendance/team/records?month=2026-05` | Mode 3 — no extra param | ✅ 200 |
| Attendance summary | GET | `/attendance/summary` | `{ present, absent, late, wfh }` | ✅ 200 |
| Today's status | GET | `/attendance/today` | `{ status, checkInAt, checkOutAt }` | ✅ 200 |
| My regularizations | GET | `/attendance/regularization` | Mode 1 | ✅ |
| Submit regularization | POST | `/attendance/regularization` | Body below | ✅ |
| Team regularization queue | GET | `/attendance/team/regularization` | Mode 3, manager only | ✅ 200 |
| Approve regularization | PATCH | `/attendance/regularization/:id/approve` | – | ✅ |
| Deny regularization | PATCH | `/attendance/regularization/:id/deny` | `{ "reviewerComment": "..." }` required | ✅ |
| Export month | POST | `/export/attendance` | Returns `202 + job_id` | ✅ |
| Download export | GET | `/export/:job_id/download` | Poll until status=SUCCESS | ✅ |

**`/attendance/records?month=2026-05` response shape:**
```json
{
  "data": {
    "records": [
      { "id": "...", "attendanceDate": "2026-05-01", "checkInAt": "...", "checkOutAt": "...",
        "status": "PRESENT", "workMode": "OFFICE", "totalMinutes": 480, "notes": null }
    ],
    "pagination": { "page": 1, "limit": 31, "total": 12, "pages": 1 }
  }
}
```

**`POST /attendance/regularization` body:**
```json
{ "attendanceDate": "2026-05-10T00:00:00.000Z", "reason": "Forgot to check out, was in office till 7pm" }
```
`reason` minimum 20 characters. (Note: `type` field removed — not stored in DB)

**`workMode` enum:** `OFFICE | WFH | HYBRID`  
**`status` enum:** `PRESENT | ABSENT | HALF_DAY | LATE | ON_LEAVE | HOLIDAY | WFH`

---

## Page 12 — Leave Requests & Approvals

**Identity: Mode 1 for own requests; Mode 3 for team approvals.**

| Tab / Action | Method | Endpoint | Notes | Verified |
|---|---|---|---|---|
| Leave type dropdown | GET | `/leave/types` | Load first — provides leaveTypeId | ✅ 200 |
| My Requests tab | GET | `/leave/requests` | Mode 1 — own requests only | ✅ 200 |
| Team Approvals tab (manager) | GET | `/leave/team/requests?status=PENDING` | Mode 3 | ✅ 200 |
| Team Calendar tab | GET | `/leave/team/requests?status=APPROVED` | All approved leaves | ✅ |
| My balance | GET | `/leave/balance` | Mode 1 | ✅ 200 |
| Submit leave request | POST | `/leave/requests` | Body below | ✅ 201 |
| Approve | PATCH | `/leave/requests/:id/approve` | Manager/HR only | ✅ |
| Reject | PATCH | `/leave/requests/:id/reject` | `{ "approverComment": "..." }` required | ✅ |
| Withdraw (own only) | PATCH | `/leave/requests/:id/withdraw` | Must be PENDING status | ✅ |
| Export leaves | POST | `/export/leave` | `{ "from_date": "...", "to_date": "..." }` | ✅ |

**`POST /leave/requests` body:**
```json
{
  "leaveTypeId": "<id from GET /leave/types>",
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-06-03T00:00:00.000Z",
  "reason": "Family vacation"
}
```

**Leave types available (seeded):**
`Annual Leave | Sick Leave | Casual Leave | Maternity Leave | Paternity Leave | Compensatory Leave | Unpaid Leave | Bereavement Leave`

**Business rules (server-enforced):**
- Cannot submit if insufficient leave balance → `400 INSUFFICIENT_BALANCE`
- Cannot submit overlapping dates → `400 OVERLAPPING_LEAVE`
- Can only withdraw PENDING requests → `400 INVALID_REQUEST_STATUS`

**`/leave/requests` response shape:**
```json
{
  "data": {
    "requests": [
      { "id": "...", "leaveTypeName": "Casual Leave", "startDate": "...", "endDate": "...",
        "totalDays": 2, "status": "PENDING", "reason": "..." }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 3, "pages": 1 }
  }
}
```

**`status` enum:** `PENDING | APPROVED | DENIED | WITHDRAWN | CANCELLED`

---

## Page 13 — Holiday Calendar

**Access:** All roles read; HR_ADMIN/SUPER_ADMIN write.

| UI Action | Method | Endpoint | Notes | Verified |
|---|---|---|---|---|
| Load year view | GET | `/holidays?year=2026` | Defaults to current year if omitted | ✅ 200 |
| Load previous year | GET | `/holidays?year=2025` | – | ✅ 200 |
| Add holiday | POST | `/holidays` | HR only | ✅ |
| Edit holiday | PATCH | `/holidays/:id` | HR only | ✅ |
| Delete holiday | DELETE | `/holidays/:id` | HR only | ✅ |

**`/holidays?year=2026` response shape:**
```json
{
  "data": {
    "holidays": [
      { "id": "...", "name": "Independence Day", "holidayDate": "2026-08-15", "isOptional": false, "location": null }
    ],
    "total": 19
  }
}
```

**`POST /holidays` body:**
```json
{ "name": "Diwali", "holidayDate": "2026-10-20", "location": "India", "isOptional": false }
```
> Field is `holidayDate` (ISO date string), NOT `date`.

---

## Page 14 — Permissions Matrix

**Access:** SUPER_ADMIN only. All other roles get `403 FORBIDDEN`.

| UI Action | Method | Endpoint | Verified |
|---|---|---|---|
| Load matrix | GET | `/settings/roles-permissions` | ✅ 200 (SA only) |
| Save changes | PATCH | `/settings/roles-permissions` | ✅ |

---

## Page 15 — Settings

**Access:** HR_ADMIN and SUPER_ADMIN.

| Section | Method | Endpoint | Verified |
|---|---|---|---|
| Company profile (read) | GET | `/settings/tenant` | ✅ 200 |
| Company profile (save) | PATCH | `/settings/tenant` | ✅ |
| Email templates (read) | GET | `/settings/email-templates` | ✅ |
| Update template | PATCH | `/settings/email-templates/:type` | ✅ |
| Audit log | GET | `/audit-logs` | ✅ 200 |
| Active sessions | GET | `/auth/sessions` | ✅ |
| Revoke a session | DELETE | `/auth/sessions/:sessionId` | ✅ |
| Sign out all devices | POST | `/auth/logout-all` | ✅ |

---

## Export Module (Async Jobs)

All exports are async: POST queues a job → poll for status → download when ready.

| Step | Method | Endpoint | Body | Notes |
|---|---|---|---|---|
| Queue employee export | POST | `/export/employees` | `{ "format": "csv" }` | HR only. format: `csv \| excel \| json` |
| Queue attendance export | POST | `/export/attendance` | `{ "from_date": "...", "to_date": "...", "format": "excel" }` | HR only |
| Queue leave export | POST | `/export/leave` | `{ "from_date": "...", "to_date": "...", "format": "csv" }` | HR only |
| Poll status | GET | `/export/:job_id/download` | – | Returns status until SUCCESS |
| Download file | GET | `/export/:job_id/download` | – | Streams file when status=SUCCESS |
| List all exports | GET | `/export/list?page=1&limit=10` | – | Paginated job history |

**`POST /export/employees` response (202):**
```json
{ "data": { "job_id": "abc123", "status": "PENDING", "format": "csv" } }
```

**`GET /export/:job_id/download` when complete:**  
Returns binary file stream with headers:  
`Content-Type: text/csv` (or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` for Excel)  
`Content-Disposition: attachment; filename="export-abc123.csv"`

---

## Document Upload (Employee Profile)

Requires Cloudinary env vars set on Render (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).  
Returns `503 STORAGE_NOT_CONFIGURED` if not set.

| Action | Method | Endpoint | Auth | Notes |
|---|---|---|---|---|
| Upload | POST | `/employees/:id/documents?documentType=PASSPORT` | HR/Admin or own | `multipart/form-data`, max 10MB |
| List | GET | `/employees/:id/documents` | HR/Admin or own | Returns array of doc metadata |
| Delete | DELETE | `/employees/:id/documents/:docId` | HR/Admin only | Deletes from Cloudinary + DB |

**documentType enum:** `PASSPORT | ID_CARD | RESUME | OFFER_LETTER | CONTRACT | CERTIFICATE | OTHER`

---

## Cross-Cutting APIs (Used on Multiple Pages)

| Purpose | Method | Endpoint | Used By |
|---|---|---|---|
| Current user (topbar) | GET | `/auth/me` | All pages — returns memberType + employeeId |
| Employee search (topbar) | GET | `/employees?search=&limit=10` | All pages |
| Departments dropdown | GET | `/departments` | Pages 09, 10 |
| Audit feed | GET | `/audit-logs?limit=10` | Pages 04, 15 |
| Token refresh | POST | `/auth/refresh` | Any page on 401 — uses httpOnly cookie |
| Logout | POST | `/auth/logout` | Topbar |
| Logout all devices | POST | `/auth/logout-all` | Settings page |

---

## Auth Headers Reference

```
Every authenticated request:
  Authorization: Bearer <accessToken>
  x-tenant-key: acme-corp-001     ← required on login; not needed after (JWT carries tenantId)

Token refresh (uses httpOnly cookie — no manual header needed):
  POST /auth/refresh

On 401 INVALID_TOKEN → call /auth/refresh to get new accessToken, then retry original request.
```

---

## Error Codes Reference

| Code | HTTP | Meaning |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `INVALID_TOKEN` | 401 | JWT expired or malformed — call `/auth/refresh` |
| `UNAUTHORIZED` | 401 | No Authorization header |
| `FORBIDDEN` | 403 | Role not allowed for this endpoint |
| `NO_EMPLOYEE_RECORD` | 400 | User has no employee profile — do not show employee tabs |
| `AMBIGUOUS_EMAIL` | 400 | Email in multiple tenants — add X-Tenant-Key header |
| `ALREADY_CHECKED_IN` | 400 | Cannot check in twice in one day |
| `ALREADY_CHECKED_OUT` | 400 | Cannot check out twice in one day |
| `INSUFFICIENT_BALANCE` | 400 | Not enough leave days available |
| `OVERLAPPING_LEAVE` | 400 | Dates clash with existing approved/pending leave |
| `INVALID_REQUEST_STATUS` | 400 | Action not valid for current status (e.g. withdrawing approved leave) |
| `OTP_INVALID` | 400 | Wrong OTP code entered |
| `OTP_EXPIRED` | 400 | OTP 10-minute window elapsed |
| `OTP_LOCKED` | 429 | 5 failed OTP attempts — locked for 15 minutes |
| `OTP_RESEND_COOLDOWN` | 429 | Must wait 60s between OTP resends |
| `STORAGE_NOT_CONFIGURED` | 503 | Cloudinary env vars not set — document upload unavailable |
| `DUPLICATE_EMPLOYEE_CODE` | 409 | Employee code already in use |
| `DUPLICATE_WORK_EMAIL` | 409 | Work email already in use |

---

## Full API Status (Verified 2026-05-23)

```
✅ POST /auth/login         → mfaRequired:true + challengeId (MFA enabled for all users)
✅ POST /auth/verify-otp   → returns accessToken + user after OTP confirmed
✅ POST /auth/resend-otp   → resends OTP (60s cooldown, max 3)
✅ POST /auth/refresh, /auth/logout, /auth/logout-all
✅ GET  /auth/me, /auth/sessions
✅ DELETE /auth/sessions/:sessionId
✅ POST /auth/forgot-password, /auth/reset-password
✅ GET  /auth/validate-reset-token

✅ GET  /analytics/summary, /analytics/attendance
✅ GET  /analytics/headcount-by-department, /analytics/recent-activity, /analytics/leave-summary

✅ GET  /employees?page=&limit=&search=&departmentId=&status=
✅ GET  /employees/:id
✅ POST /employees
✅ PATCH /employees/:id
✅ DELETE /employees/:id (soft delete)
✅ GET  /employees/export/csv  (HR only)
✅ POST /employees/:id/documents  (multipart, needs Cloudinary)
✅ GET  /employees/:id/documents
✅ DELETE /employees/:id/documents/:docId

✅ GET  /departments, /departments/:id
✅ POST /departments
✅ PATCH /departments/:id
✅ DELETE /departments/:id

✅ GET  /holidays?year=YYYY
✅ POST /holidays, PATCH /holidays/:id, DELETE /holidays/:id

✅ GET  /leave/types
✅ GET  /leave/balance, /leave/requests, /leave/team/requests
✅ POST /leave/requests
✅ PATCH /leave/requests/:id/approve, /reject, /withdraw

✅ POST /attendance/check-in, /attendance/check-out
✅ GET  /attendance/records?month=YYYY-MM
✅ GET  /attendance/records?fromDate=&toDate=
✅ GET  /attendance/team/records?month=YYYY-MM
✅ GET  /attendance/summary, /attendance/today, /attendance/regularization
✅ GET  /attendance/team/regularization
✅ POST /attendance/regularization
✅ PATCH /attendance/regularization/:id/approve, /deny

✅ GET  /employee/dashboard, /employee/documents, /employee/team
✅ GET  /employees/me/documents (alias), /employees/me/team (alias)

✅ GET  /manager/dashboard, /manager/team, /manager/team/attendance, /manager/approvals
✅ PATCH /manager/leave-requests/:id/decision
✅ PATCH /manager/regularization-requests/:id/decision

✅ GET  /settings/tenant, /settings/email-templates
✅ PATCH /settings/tenant, /settings/email-templates/:type
✅ GET  /settings/roles-permissions (SUPER_ADMIN only)
✅ PATCH /settings/roles-permissions

✅ GET  /audit-logs, /audit-logs/:id

✅ POST /export/employees, /export/attendance, /export/leave
✅ GET  /export/:job_id/download
✅ GET  /export/list

✅ GET  /reports/attendance, /reports/leaves, /reports/payroll
✅ GET  /reports/scheduled, /reports/export-history
✅ POST /reports/schedule
✅ PATCH /reports/scheduled/:id
✅ DELETE /reports/scheduled/:id

⚠️  /employee/dashboard → 400 NO_EMPLOYEE_RECORD for SUPER_ADMIN (expected — no emp record)
⚠️  /attendance/team/records → 403 for EMPLOYEE (expected — correct access control)
⚠️  /manager/dashboard → 403 for EMPLOYEE (expected)
⚠️  /settings/roles-permissions → 403 for HR_ADMIN (expected — SUPER_ADMIN only)
⚠️  /employees/:id/documents → 503 STORAGE_NOT_CONFIGURED until Cloudinary vars set on Render
```

---

## Seed Data Summary

| Entity | Count |
|---|---|
| Employees | 79 |
| Departments | 10 (incl. 6 sub-departments) |
| Leave Requests | 23 (mix of PENDING/APPROVED/DENIED/WITHDRAWN/CANCELLED) |
| Attendance Records | 523 (PRESENT/WFH/ABSENT/HALF_DAY/LATE) |
| Leave Types | 8 |
| Holidays (2026) | 19 |
| Users | 9 (all MFA-enabled, emails map to mohammadsaeedafri9@gmail.com) |
