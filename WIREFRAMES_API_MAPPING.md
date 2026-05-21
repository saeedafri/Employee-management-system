# EMS — Wireframes → API Mapping (Production Ready)

> **Verified live on Render: `2026-05-22`**  
> Every endpoint below was curl-tested and returned the correct status code.  
> API base: `https://employee-management-system-2b9q.onrender.com/api/v1`  
> Swagger UI: `https://employee-management-system-2b9q.onrender.com/docs`

---

## How Identity Works — Read This First

Every API call identifies "which employee" using one of three modes:

| Mode | How the server knows | UI must do |
|---|---|---|
| **Mode 1 — Self** | Reads `employeeId` from the JWT token | Just send `Authorization: Bearer <token>` |
| **Mode 2 — Target** | Reads `:id` from the URL | Pass the employee's ID in the URL |
| **Mode 3 — Team** | Uses JWT `employeeId` as manager, queries direct reports | Just send `Authorization: Bearer <token>` |

**Login response — store all of this:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": "usr_abc",
      "email": "hr@acme.test",
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

| Email | Password | Role | Has Employee Record | Tests Pages |
|---|---|---|---|---|
| `superadmin@acme.test` | `Password123!` | SUPER_ADMIN | ❌ No | 14, 15, analytics |
| `hr@acme.test` | `Password123!` | HR_ADMIN | ✅ E0003 | 04, 06, 07, 08, 09, 10, 13, 15 |
| `aman@acme.test` | `Password123!` | MANAGER | ✅ E0001 (19 reports) | 05, 06, 11, 12 |
| `priya@acme.test` | `Password123!` | EMPLOYEE | ✅ E0002 | 06, 11, 12 |

> No `X-Tenant-Key` header needed — tenant auto-resolves from email on login. After login, JWT carries it for all subsequent calls.

---

## Page 01 — Login

![Page 01 — Login](./docs-images/wireframes/page-02.png)

| UI Action | Method | Endpoint | Body | Notes |
|---|---|---|---|---|
| Submit form | POST | `/auth/login` | `{ "email": "...", "password": "..." }` | No X-Tenant-Key needed |
| MFA redirect (Phase 2) | POST | `/auth/verify-otp` | `{ "challengeId", "code" }` | Only if OTP is enabled |

**Response (200):**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": "...", "email": "...", "memberType": "HR_ADMIN",
      "employeeId": "emp_xyz",
      "employee": { "firstName": "Jane", "lastName": "Smith" }
    }
  }
}
```

**Error codes:** `INVALID_CREDENTIALS` (401), `AMBIGUOUS_EMAIL` (400 — email in multiple tenants, add X-Tenant-Key), `429` rate limit.

---

## Page 02 — Forgot Password

![Page 02 — Forgot Password](./docs-images/wireframes/page-03.png)

| UI Action | Method | Endpoint | Body |
|---|---|---|---|
| Send reset email | POST | `/auth/forgot-password` | `{ "email": "..." }` |
| Validate token on next screen | GET | `/auth/validate-reset-token?token=…` | – |
| Set new password | POST | `/auth/reset-password` | `{ "token", "newPassword" }` |

Always respond "If this email exists, we sent a reset link." regardless of response — endpoint always returns `202`.

---

## Page 03 — OTP Verification

![Page 03 — OTP Verification](./docs-images/wireframes/page-04.png)

| UI Action | Method | Endpoint | Body |
|---|---|---|---|
| Verify code | POST | `/auth/verify-otp` | `{ "challengeId", "code" }` |
| Resend code | POST | `/auth/resend-otp` | `{ "challengeId" }` |

Lockout after 5 failed attempts. Resend throttled to 60s.

---

## Page 04 — HR/Admin Analytics Dashboard

![Page 04 — Dashboard HR Admin](./docs-images/wireframes/page-05.png)

**Access:** HR_ADMIN, SUPER_ADMIN only. MANAGER and EMPLOYEE get `403`.  
**Test as:** `hr@acme.test` or `superadmin@acme.test`

| Widget | Method | Endpoint | Verified |
|---|---|---|---|
| 4 KPI stat cards | GET | `/analytics/summary` | ✅ 200 |
| Attendance chart (last 30 days) | GET | `/analytics/attendance` | ✅ 200 |
| Headcount by Department donut | GET | `/analytics/headcount-by-department` | ✅ 200 |
| Recent Activity feed | GET | `/analytics/recent-activity` | ✅ 200 |
| Leave summary | GET | `/analytics/leave-summary` | ✅ 200 |
| Add Employee button | – | → opens Page 09 | – |

**`/analytics/summary` response shape:**
```json
{
  "data": {
    "totalEmployees": 22,
    "activeToday": 5,
    "onLeave": 2,
    "openRequests": 5
  }
}
```

> HR_ADMIN who is also an employee: they can ALSO call `GET /employee/dashboard` (Mode 1) to see their own personal summary. Show a nav toggle.

---

## Page 05 — Manager Dashboard

![Page 05 — Dashboard Manager](./docs-images/wireframes/page-06.png)

**Access:** MANAGER and HR_ADMIN. EMPLOYEE gets `403`.  
**Test as:** `aman@acme.test` (19 direct reports)  
**Identity: Mode 3** — server uses JWT `employeeId` to scope to that manager's team.

| Widget | Method | Endpoint | Verified |
|---|---|---|---|
| Team stats (size, present, pending) | GET | `/manager/dashboard` | ✅ 200 |
| Pending approvals list | GET | `/manager/approvals` | ✅ 200 |
| Team roster | GET | `/manager/team` | ✅ 200 |
| Team attendance grid (M-F) | GET | `/manager/team/attendance` | ✅ 200 |
| Approve leave | PATCH | `/manager/leave-requests/:id/decision` | ✅ |
| Deny leave | PATCH | `/manager/leave-requests/:id/decision` | ✅ |

**`/manager/dashboard` response shape:**
```json
{ "data": { "teamSize": 19, "presentToday": null, "pendingApprovals": 5 } }
```

**`/manager/team` response shape** (returns array):
```json
[{ "id": "...", "employeeCode": "E0001", "firstName": "Aman", "lastName": "Kumar", "designation": "..." }, ...]
```

**`/manager/team/attendance` response shape:**
```json
{ "data": { "range": "...", "series": [...] } }
```

> Manager who is also an employee: show Page 05 as primary, with a tab/link to their personal Page 06.

---

## Page 06 — Employee Personal Dashboard

![Page 06 — Dashboard Employee](./docs-images/wireframes/page-07.png)

**Access:** Any role with a linked employee record. `SUPER_ADMIN` (no emp record) gets `400 NO_EMPLOYEE_RECORD`.  
**Identity: Mode 1** — all calls use JWT `employeeId` automatically. UI sends only the token.  
**Test as:** `priya@acme.test`

| Widget | Method | Endpoint | Both Paths Work | Verified |
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

**`/leave/balance` response shape:**
```json
{
  "data": {
    "balances": [
      { "leaveTypeId": "...", "leaveTypeName": "Annual Leave", "leaveTypeCode": "AL", "total": 21, "used": 0, "pending": 0, "available": 21 }
    ]
  }
}
```

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

![Page 07 — Employees List](./docs-images/wireframes/page-08.png)

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

**Auto row-level filtering (server-enforced, no extra params):**
- `HR_ADMIN / SUPER_ADMIN` → all employees in tenant
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
    "pagination": { "page": 1, "limit": 20, "total": 22, "pages": 2 }
  }
}
```

---

## Page 08 — Employee Profile

![Page 08 — Employee Profile](./docs-images/wireframes/page-09.png)

**Access:** HR sees anyone; Manager sees team only; Employee sees self only.  
**Identity: Mode 2** — `employeeId` in URL.

| Tab / Section | Method | Endpoint | Notes |
|---|---|---|---|
| Overview (personal + job) | GET | `/employees/:id` | Full employee row |
| Attendance tab | GET | `/attendance/records?month=YYYY-MM` | Pass month param |
| Leave tab | GET | `/leave/requests` | Employee's own if self; HR can see anyone |
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

**Access control (server-enforced):**
- `GET /employees/:id` where `:id` is another employee → `403 FORBIDDEN` if you're EMPLOYEE
- `GET /employees/:id` where `:id` is own employee ID → `200` for any role

---

## Page 09 — Create / Edit Employee

![Page 09 — Employees Create/Edit](./docs-images/wireframes/page-10.png)

**Access:** HR_ADMIN and SUPER_ADMIN only.  
**Test as:** `hr@acme.test`

| UI Action | Method | Endpoint | Body |
|---|---|---|---|
| Department dropdown | GET | `/departments` | Returns flat list |
| Manager search dropdown | GET | `/employees?search=<name>&limit=10` | – |
| Create employee | POST | `/employees` | See below |
| Update employee | PATCH | `/employees/:id` | Partial body OK |

**`POST /employees` required fields:**
```json
{
  "employeeCode": "E0010",
  "firstName": "John",
  "lastName": "Doe",
  "workEmail": "john@acme.test",
  "designation": "Software Engineer",
  "joinedOn": "2026-01-15",
  "employmentType": "FULL_TIME"
}
```
**Optional:** `departmentId`, `managerId`, `phone`, `location`, `employmentStatus`.  
**employmentType enum:** `FULL_TIME | PART_TIME | CONTRACT | INTERN`

---

## Page 10 — Departments

![Page 10 — Departments](./docs-images/wireframes/page-11.png)

**Access:** HR write; all roles can read.

| UI Action | Method | Endpoint | Body | Verified |
|---|---|---|---|---|
| Load tree | GET | `/departments` | – | ✅ 200 |
| Department detail | GET | `/departments/:id` | – | ✅ |
| Employees in dept | GET | `/employees?departmentId=:id` | – | ✅ |
| Add department | POST | `/departments` | `{ name, description?, parentId?, headEmployeeId? }` | ✅ |
| Edit / move | PATCH | `/departments/:id` | Same fields (partial) | ✅ |
| Delete | DELETE | `/departments/:id` | – | ✅ |

Returns flat list with `parentId` — client builds the hierarchy tree.

---

## Page 11 — Attendance Records

![Page 11 — Attendance Records](./docs-images/wireframes/page-12.png)

**Identity: Mode 1 for own records; Mode 3 for team records.**  
**Test as:** `priya@acme.test` (own), `aman@acme.test` (team)

| View / Action | Method | Endpoint | Notes | Verified |
|---|---|---|---|---|
| Own records (calendar) | GET | `/attendance/records?month=2026-05` | Mode 1 — no employeeId param | ✅ 200 |
| Own records (date range) | GET | `/attendance/records?fromDate=&toDate=` | Alt to month | ✅ |
| Team records (manager) | GET | `/attendance/team/records?month=2026-05` | Mode 3 — no extra param | ✅ 200 |
| Attendance summary | GET | `/attendance/summary` | `{ present, absent, late, wfh }` | ✅ 200 |
| My regularizations | GET | `/attendance/regularization` | Mode 1 | ✅ |
| Submit regularization | POST | `/attendance/regularization` | `{ attendanceDate, type, reason }` | ✅ |
| Team regularization queue | GET | `/attendance/team/regularization` | Mode 3, manager only | ✅ 200 |
| Approve regularization | PATCH | `/attendance/regularization/:id/approve` | – | ✅ |
| Deny regularization | PATCH | `/attendance/regularization/:id/deny` | `{ reviewerComment }` required | ✅ |
| Export month | POST | `/export/attendance` | Returns 202 + `job_id` | ✅ |
| Download export | GET | `/export/:job_id/download` | Poll until ready | ✅ |

**`/attendance/records?month=2026-05` response shape:**
```json
{
  "data": {
    "records": [
      { "id": "...", "attendanceDate": "2026-05-01", "checkInAt": "...", "checkOutAt": "...",
        "status": "PRESENT", "workMode": "OFFICE", "totalMinutes": 480, "notes": null }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 12, "pages": 2 }
  }
}
```

**`/attendance/regularization` POST body:**
```json
{ "attendanceDate": "2026-05-10T00:00:00.000Z", "type": "MISSED_CHECKOUT", "reason": "Forgot to check out, was in office till 7pm" }
```
`type` enum: `LATE | MISSED_CHECKOUT | EARLY_CHECKOUT`  
`reason` minimum 20 characters.

---

## Page 12 — Leave Requests & Approvals

![Page 12 — Leave Requests](./docs-images/wireframes/page-13.png)

**Identity: Mode 1 for own requests; Mode 3 for team approvals.**  
**Test as:** `priya@acme.test` (employee), `aman@acme.test` (manager)

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

**`POST /leave/requests` body:**
```json
{
  "leaveTypeId": "<id from GET /leave/types>",
  "startDate": "2026-06-01T00:00:00.000Z",
  "endDate": "2026-06-03T00:00:00.000Z",
  "reason": "Family vacation"
}
```

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

---

## Page 13 — Holiday Calendar

![Page 13 — Holiday Calendar](./docs-images/wireframes/page-14.png)

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
      { "name": "Independence Day", "holidayDate": "2026-08-15", "isOptional": false }
    ],
    "total": 3
  }
}
```

**`POST /holidays` body:**
```json
{ "name": "Diwali", "holidayDate": "2026-10-20", "location": "India", "isOptional": false }
```
> Field name is `holidayDate` (ISO date string), NOT `date`.

---

## Page 14 — Permissions Matrix

![Page 14 — Permissions Matrix](./docs-images/wireframes/page-15.png)

**Access:** SUPER_ADMIN only. All other roles get `403 FORBIDDEN`. ✅ Verified.

| UI Action | Method | Endpoint | Verified |
|---|---|---|---|
| Load matrix | GET | `/settings/roles-permissions` | ✅ 200 (SA only) |
| Save changes | PATCH | `/settings/roles-permissions` | ✅ |

---

## Page 15 — Settings

![Page 15 — Settings](./docs-images/wireframes/page-16.png)

**Access:** HR_ADMIN and SUPER_ADMIN.

| Section → Item | Method | Endpoint | Verified |
|---|---|---|---|
| Company profile (read) | GET | `/settings/tenant` | ✅ 200 |
| Company profile (save) | PATCH | `/settings/tenant` | ✅ |
| Email templates | GET | `/settings/email-templates` | ✅ |
| Update template | PATCH | `/settings/email-templates/:type` | ✅ |
| Audit log | GET | `/audit-logs` | ✅ 200 |
| Active sessions | GET | `/auth/sessions` | ✅ |
| Revoke a session | DELETE | `/auth/sessions/:sessionId` | ✅ |
| Sign out all devices | POST | `/auth/logout-all` | ✅ |

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

---

## Auth Headers Reference

```
Every authenticated request:
  Authorization: Bearer <accessToken>

No X-Tenant-Key needed after login — JWT carries tenantId.

Only add X-Tenant-Key if you get AMBIGUOUS_EMAIL on login
(same email registered in multiple tenant companies).
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
| `INVALID_REQUEST_STATUS` | 400 | Action not valid for current status |

---

## Full API Status (Verified 2026-05-22)

```
✅ POST /auth/login, /auth/refresh, /auth/logout, /auth/logout-all
✅ GET  /auth/me, /auth/sessions
✅ POST /auth/forgot-password, /auth/reset-password, /auth/verify-otp

✅ GET  /analytics/summary, /analytics/attendance
✅ GET  /analytics/headcount-by-department, /analytics/recent-activity, /analytics/leave-summary

✅ GET  /employees, /employees/:id, /employees/export/csv
✅ POST /employees
✅ PATCH /employees/:id
✅ DELETE /employees/:id

✅ GET  /departments, /departments/:id
✅ POST /departments
✅ PATCH /departments/:id
✅ DELETE /departments/:id

✅ GET  /holidays, /holidays?year=YYYY
✅ POST /holidays, PATCH /holidays/:id, DELETE /holidays/:id

✅ GET  /leave/types
✅ GET  /leave/balance, /leave/requests, /leave/team/requests
✅ POST /leave/requests
✅ PATCH /leave/requests/:id/approve, /reject, /withdraw

✅ GET  /attendance/records, /attendance/records?month=YYYY-MM
✅ GET  /attendance/team/records, /attendance/team/records?month=YYYY-MM
✅ GET  /attendance/summary, /attendance/today, /attendance/regularization
✅ GET  /attendance/team/regularization
✅ POST /attendance/check-in, /attendance/check-out, /attendance/regularization
✅ PATCH /attendance/regularization/:id/approve, /deny

✅ GET  /employee/dashboard, /employee/documents, /employee/team
✅ GET  /employees/me/documents (alias), /employees/me/team (alias)

✅ GET  /manager/dashboard, /manager/team, /manager/team/attendance, /manager/approvals
✅ PATCH /manager/leave-requests/:id/decision

✅ GET  /settings/tenant, /settings/email-templates
✅ PATCH /settings/tenant, /settings/email-templates/:type
✅ GET  /settings/roles-permissions (SUPER_ADMIN only)

✅ GET  /audit-logs, /audit-logs/:id
✅ GET  /reports/attendance, /reports/leaves
✅ GET  /export/list, /export/:job_id/download
✅ POST /export/employees, /export/attendance, /export/leave

⚠️  /employee/dashboard → 400 NO_EMPLOYEE_RECORD for SUPER_ADMIN (expected — no emp record)
⚠️  /attendance/team/records → 403 FORBIDDEN for EMPLOYEE (expected — correct access control)
⚠️  /manager/dashboard → 403 FORBIDDEN for EMPLOYEE (expected)
⚠️  /settings/roles-permissions → 403 FORBIDDEN for HR_ADMIN (expected — SUPER_ADMIN only)
⚠️  /employee/documents returns [] — no upload endpoint exists yet (documents must be seeded directly)
```
