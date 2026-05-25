# EMS Wireframes → API Mapping

> **Last updated: 2026-05-24**  
> **Wireframe source:** `WIREFRAMES.pdf` (16 screens)  
> **Base URL:** `https://employee-management-system-2b9q.onrender.com/api/v1`  
> **Local dev:** `http://localhost:3000/api/v1`

All endpoints verified locally with real data. ✅ = implemented and tested. ❌ = not implemented.

---

## Screen 1 — Login

**APIs needed:**
- `POST /auth/login` ✅

**Request:**
```json
{ "email": "hr@acme.test", "password": "Password123!" }
```
Header: `x-tenant-key: acme-corp-001`

**Response `data`:**
```json
{
  "accessToken": "eyJ...",
  "user": {
    "id": "...", "email": "hr@acme.test",
    "memberType": "HR_ADMIN", "employeeId": "..."
  }
}
```

**Notes:**
- MFA is disabled — `accessToken` returned directly, no OTP step
- Store `accessToken` in memory (not localStorage) and send as `Authorization: Bearer <token>` on all subsequent calls
- `memberType` drives which sidebar items are visible

---

## Screen 2 — Employee Dashboard (My Dashboard)

**APIs needed:**
- `GET /employee/dashboard` ✅ — main summary card
- `GET /attendance/today` ✅ — check-in/check-out status widget
- `GET /leave/balance/me` ✅ — leave balance widget
- `GET /holidays/upcoming?limit=3` ✅ — upcoming holidays widget

**`GET /employee/dashboard` response `data`:**
```json
{
  "employee": {
    "id": "...", "firstName": "Priya", "lastName": "Sharma",
    "employeeCode": "E0002", "designation": "Software Engineer",
    "department": "Engineering", "manager": "Aman Kapoor",
    "joinedOn": "2024-01-15T00:00:00.000Z"
  },
  "attendance": {
    "todayStatus": "PRESENT",
    "checkInTime": "09:02:00",
    "checkOutTime": null,
    "monthStats": { "present": 18, "absent": 1, "wfh": 2 }
  },
  "leaveBalance": { "annual": 12, "sick": 6, "casual": 3 },
  "pendingTasks": 2
}
```

**`GET /leave/balance/me` response `data`:**
```json
{
  "balances": [
    {
      "leaveTypeId": "...", "leaveTypeName": "Annual Leave", "leaveTypeCode": "ANNUAL",
      "total": 21, "used": 5, "pending": 2, "available": 14
    }
  ]
}
```

**`GET /holidays/upcoming?limit=3` response `data`:**
```json
{
  "holidays": [
    { "id": "...", "name": "Eid al-Adha", "holidayDate": "2026-06-06T00:00:00.000Z", "isOptional": false }
  ],
  "total": 3
}
```

---

## Screen 3 — Manager Dashboard

**APIs needed:**
- `GET /manager/dashboard` ✅ — team summary
- `GET /leave/team/requests?status=PENDING&limit=5` ✅ — pending approvals widget
- `GET /attendance/team/records?limit=10` ✅ — today's team attendance
- `GET /leave/team/calendar?month=2026-05` ✅ — calendar view

**`GET /manager/dashboard` response `data`:**
```json
{
  "teamSize": 26,
  "presentToday": 18,
  "onLeave": 3,
  "pendingLeaveApprovals": 4,
  "pendingRegularizationApprovals": 1
}
```

---

## Screen 4 — Employee List

**APIs needed:**
- `GET /employees` ✅ — paginated list with search/filter

**Query params:** `page`, `limit`, `search`, `departmentId`, `status`, `location`

**Response shape:** `data: { data: [...employees], pagination: { page, limit, total, pages } }`

> Note: Double-nested — `data.data` is the array, NOT `data.employees`.

Each employee object:
```json
{
  "id": "...", "employeeCode": "E0001", "firstName": "Aman",
  "lastName": "Kapoor", "workEmail": "aman@acme.test",
  "designation": "Engineering Manager", "department": "Engineering",
  "employmentStatus": "ACTIVE", "location": "Bangalore"
}
```

---

## Screen 5 — Create Employee

**APIs needed:**
- `GET /employees/next-code` ✅ — pre-fill employee code field
- `GET /departments` ✅ — department dropdown
- `GET /employees` ✅ — manager dropdown (search by name)
- `POST /employees` ✅ — create

**`GET /employees/next-code` response `data`:** `{ "nextCode": "EMP-0081" }`

**`POST /employees` body (required fields):**
```json
{
  "firstName": "John", "lastName": "Doe",
  "workEmail": "john.doe@acme.test",
  "memberType": "EMPLOYEE",
  "joinedOn": "2026-06-01"
}
```

Optional: `employeeCode`, `phone`, `designation`, `departmentId`, `managerId`, `employmentType`, `employmentStatus`, `location`, `dateOfBirth`, `gender`, `nationality`

**Error codes:** `DUPLICATE_WORK_EMAIL` (409), `DUPLICATE_EMPLOYEE_CODE` (409)

---

## Screen 6 — Employee Profile

**APIs needed:**
- `GET /employees/:id` ✅ — profile header + overview tab
- `GET /employees/:id/documents` ✅ — Documents tab
- `GET /leave/team/requests?employeeId=:id` ✅ — Leave tab (manager/HR view)
- `GET /attendance/team/records?employeeId=:id` ✅ — Attendance tab (manager/HR view)
- `PATCH /employees/:id` ✅ — Edit profile

**`GET /employees/:id` response `data`:** Full employee object with all fields.

**`GET /leave/team/requests?employeeId=<empId>&limit=10` response `data`:**
```json
{
  "requests": [
    {
      "id": "...", "referenceNo": "LVR-0025",
      "leaveTypeName": "Annual Leave", "startDate": "...", "endDate": "...",
      "totalDays": 3, "status": "APPROVED"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 5, "pages": 1 }
}
```

**`GET /attendance/team/records?employeeId=<empId>&limit=10` response `data`:**
```json
{
  "records": [
    {
      "id": "...", "referenceNo": "ATT-0068",
      "attendanceDate": "2026-05-23T00:00:00.000Z",
      "status": "PRESENT", "checkInTime": "09:01:00", "checkOutTime": "18:03:00"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 22, "pages": 3 }
}
```

---

## Screen 7 — Departments

**APIs needed:**
- `GET /departments` ✅ — list with hierarchy
- `GET /departments/:id` ✅ — department detail panel (headcount, sub-depts, employees)
- `POST /departments` ✅ — create
- `PATCH /departments/:id` ✅ — update
- `DELETE /departments/:id` ✅ — delete

**`GET /departments` response `data`:** Flat array of root departments, each with nested `children[]`.

**`GET /departments/:id` response `data`:**
```json
{
  "id": "...", "name": "Engineering", "departmentCode": "ENG",
  "depth": 0, "parentId": null, "parent": null,
  "headEmployee": { "id": "...", "firstName": "Aman", "lastName": "Kapoor" },
  "subDepartments": [
    { "id": "...", "name": "Backend", "departmentCode": "BACK" }
  ],
  "totalHeadcount": 22,
  "subDeptCount": 3,
  "managerCount": 4,
  "employees": [
    {
      "id": "...", "firstName": "Priya", "lastName": "Sharma",
      "employeeCode": "E0002", "designation": "Software Engineer",
      "employmentStatus": "ACTIVE"
    }
  ]
}
```

**Error codes:** `DEPARTMENT_CYCLE` (409), `DEPARTMENT_NOT_EMPTY` (409), `DUPLICATE_CODE` (409)

---

## Screen 8 — My Leave Requests

**APIs needed:**
- `GET /leave/balance` ✅ — balance summary at top
- `GET /leave/requests` ✅ — own request list with filters
- `POST /leave/requests` ✅ — create new request
- `GET /leave/types` ✅ — dropdown options for create form
- `PATCH /leave/requests/:id/withdraw` ✅ — withdraw pending request

**`POST /leave/requests` body:**
```json
{
  "leaveTypeId": "...",
  "startDate": "2026-06-10",
  "endDate": "2026-06-12",
  "reason": "Family vacation (minimum 10 chars)"
}
```

**`GET /leave/requests` query params:** `page`, `limit`, `status`, `leaveTypeId`, `fromDate`, `toDate`

**Response `data`:**
```json
{
  "requests": [
    {
      "id": "...", "referenceNo": "LVR-0025",
      "leaveTypeName": "Annual Leave",
      "startDate": "2026-06-10T00:00:00.000Z",
      "endDate": "2026-06-12T00:00:00.000Z",
      "totalDays": 3, "status": "PENDING",
      "reason": "Family vacation",
      "submittedAt": "2026-05-24T...",
      "decidedAt": null, "approverComment": null
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 7, "pages": 1 }
}
```

**Error codes:** `INSUFFICIENT_BALANCE` (400), `OVERLAPPING_LEAVE` (400), `LEAVE_TYPE_NOT_FOUND` (404)

---

## Screen 9 — Team Leave (Manager View)

**APIs needed:**
- `GET /leave/team/requests` ✅ — pending approvals list (filters: status, fromDate, toDate)
- `GET /leave/team/requests?status=PENDING` ✅ — pending only
- `PATCH /leave/requests/:id/approve` ✅ — approve one
- `PATCH /leave/requests/:id/reject` ✅ — reject one (requires `approverComment`)
- `POST /leave/requests/bulk-approve` ✅ — bulk approve
- `POST /leave/requests/bulk-deny` ✅ — bulk deny
- `GET /leave/team/calendar?month=YYYY-MM` ✅ — calendar view

**`PATCH /leave/requests/:id/approve` body:** `{ "approverComment": "Approved" }` (optional)

**`PATCH /leave/requests/:id/reject` body:** `{ "approverComment": "Short-staffed that week" }` ← **required**

**`POST /leave/requests/bulk-approve` body:**
```json
{ "ids": ["id1", "id2", "id3"], "comment": "Approved — holiday season" }
```

**Response `data`:**
```json
{
  "results": [
    { "id": "id1", "status": "approved", "referenceNo": "LVR-0044" },
    { "id": "id2", "status": "failed", "error": "Cannot approve leave with status APPROVED" }
  ],
  "processed": 3
}
```

---

## Screen 10 — Leave Types Management (HR Admin)

**APIs needed:**
- `GET /leave/types` ✅ — list all active types
- `POST /leave/types` ✅ — create
- `PATCH /leave/types/:id` ✅ — edit
- `DELETE /leave/types/:id` ✅ — soft-deactivate (sets `isActive=false`)

**`POST /leave/types` body:**
```json
{
  "name": "Bereavement Leave",
  "code": "BRVMT",
  "annualAllowance": 5,
  "isPaid": true,
  "carryForwardAllowed": false
}
```

**`GET /leave/types` response `data`:** Array of:
```json
{
  "id": "...", "name": "Annual Leave", "code": "ANNUAL",
  "annualAllowance": 21, "carryForwardAllowed": true, "isPaid": true
}
```

**Error codes:** `DUPLICATE_LEAVE_TYPE_CODE` (409)

---

## Screen 11 — Attendance (My Attendance)

**APIs needed:**
- `GET /attendance/today` ✅ — today's status card
- `POST /attendance/check-in` ✅ — check in
- `POST /attendance/check-out` ✅ — check out
- `GET /attendance/records` ✅ — history list (`?month=2026-05` or `?fromDate=&toDate=`)
- `GET /attendance/summary` ✅ — summary stats
- `POST /attendance/regularization` ✅ — request correction
- `GET /attendance/regularization` ✅ — own regularization list

**`GET /attendance/today` response `data`:**
```json
{
  "status": "PRESENT",
  "checkInTime": "09:02:00",
  "checkOutTime": null,
  "attendanceDate": "2026-05-24T00:00:00.000Z"
}
```

**`POST /attendance/check-in` body:** `{ "workMode": "OFFICE", "location": "Bangalore" }` (both optional)

**`GET /attendance/records?month=2026-05` response `data`:**
```json
{
  "records": [
    {
      "id": "...", "referenceNo": "ATT-0068",
      "attendanceDate": "2026-05-23T00:00:00.000Z",
      "status": "PRESENT",
      "checkInTime": "09:01:00", "checkOutTime": "18:03:00",
      "workMode": "OFFICE"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 22, "pages": 3 }
}
```

**`POST /attendance/regularization` body:**
```json
{ "attendanceDate": "2026-05-20", "reason": "Forgot to check in while in office" }
```
Note: `type` field is not accepted (no DB column).

---

## Screen 12 — Team Attendance (Manager View)

**APIs needed:**
- `GET /attendance/team/records` ✅ — team attendance list (`?month=YYYY-MM`)
- `GET /attendance/team/records?employeeId=:id` ✅ — filtered to one employee (profile page)
- `GET /attendance/team/regularization` ✅ — regularization approval queue
- `PATCH /attendance/regularization/:id/approve` ✅ — approve regularization
- `PATCH /attendance/regularization/:id/deny` ✅ — deny regularization

**`GET /attendance/team/records` response `data`:**
```json
{
  "records": [
    {
      "id": "...", "referenceNo": "ATT-0068",
      "attendanceDate": "2026-05-23T00:00:00.000Z",
      "status": "PRESENT",
      "employee": {
        "id": "...", "firstName": "Priya", "lastName": "Sharma",
        "employeeCode": "E0002"
      }
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 452, "pages": 46 }
}
```

---

## Screen 13 — Holidays

**APIs needed:**
- `GET /holidays` ✅ — list with optional year/month filter
- `POST /holidays` ✅ — create (HR/Admin only)
- `PATCH /holidays/:id` ✅ — update
- `DELETE /holidays/:id` ✅ — delete

**`POST /holidays` body:**
```json
{
  "name": "Diwali",
  "holidayDate": "2026-10-20",
  "isOptional": false,
  "location": "India"
}
```

> `holidayDate` must be `YYYY-MM-DD` format (NOT ISO string — fails validation).

**`GET /holidays` response `data`:**
```json
{
  "holidays": [
    {
      "id": "...", "name": "Independence Day",
      "holidayDate": "2026-08-15T00:00:00.000Z",
      "isOptional": false, "location": "India"
    }
  ],
  "total": 19
}
```

---

## Screen 14 — Analytics (HR Admin)

**APIs needed:**
- `GET /analytics/summary` ✅
- `GET /analytics/attendance` ✅
- `GET /analytics/headcount-by-department` ✅
- `GET /analytics/recent-activity` ✅
- `GET /analytics/leave-summary` ✅

**`GET /analytics/summary` response `data`:**
```json
{
  "totalEmployees": 79,
  "activeEmployees": 75,
  "newHiresThisMonth": 3,
  "onLeaveToday": 4,
  "presentToday": 62,
  "absentToday": 9
}
```

**`GET /analytics/headcount-by-department` response `data`:** Array of `{ department, count }`

**All analytics:** Require `HR_ADMIN` or `SUPER_ADMIN` role.

---

## Screen 15 — Audit Logs

**APIs needed:**
- `GET /audit-logs` ✅ — with filters
- `GET /audit-logs/:id` ✅ — detail view
- `POST /audit-logs/dpia-report` ✅ — compliance report

**Query params:**
| Param | Type | Example | Notes |
|-------|------|---------|-------|
| `page` | int | `1` | |
| `limit` | int | `10` | max 100 |
| `action` | string | `LOGIN` | exact match |
| `entity` | string | `Employee` | matches `entityType` field |
| `entityId` | string | `cmpfyp...` | filter to specific record |
| `user_email` | string | `hr@acme.test` | filter by actor |
| `from_date` | date | `2026-05-01` | |
| `to_date` | date | `2026-05-31` | |

**`GET /audit-logs` response `data`:**
```json
{
  "logs": [
    {
      "id": "...",
      "user_email": "hr@acme.test",
      "action": "LOGIN",
      "entity_type": null,
      "entity_id": null,
      "old_values": null,
      "new_values": null,
      "ip_address": "127.0.0.1",
      "created_at": "2026-05-24T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 288, "pages": 29 }
}
```

> Note: audit log fields are **snake_case** (`user_email`, `entity_type`, `ip_address`, `created_at`) — different from other endpoints.

---

## Screen 16 — Settings

**APIs needed:**
- `GET /settings/tenant` ✅ — company identity + operational config
- `PATCH /settings/tenant` ✅ — update any fields
- `GET /settings/email-templates` ✅ — email template list
- `PATCH /settings/email-templates/:type` ✅ — update template

**`GET /settings/tenant` response `data`:**
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

**`PATCH /settings/tenant` — any combination of:**
```json
{
  "legalName": "Acme Corporation Pvt Ltd",
  "displayName": "Acme",
  "country": "India",
  "defaultCurrency": "INR",
  "primaryContactEmail": "contact@acme.com",
  "supportPhone": "+91...",
  "logoUrl": "https://cdn.example.com/logo.png",
  "company_name": "Acme Corp",
  "timezone": "Asia/Kolkata",
  "working_hours_start": "09:00",
  "working_hours_end": "18:00"
}
```

**`GET /settings/email-templates` response `data`:**
```json
{
  "templates": [
    {
      "id": "...", "type": "LEAVE_APPROVAL",
      "subject": "Your Leave Request Has Been Approved",
      "body": "Dear Employee,\n\nYour leave request has been approved.\n\nThank you."
    }
  ]
}
```

**Template types:** `LEAVE_APPROVAL`, `LEAVE_REJECTION`, `ATTENDANCE_ALERT`

---

## API Coverage Summary

> **Updated 2026-05-25** — includes all UI-team requests from `BACKEND_API_REQUESTS.md`

| Screen | APIs | Status |
|--------|------|--------|
| Login / Forgot Password | 3 | ✅ All covered |
| Employee Dashboard | 6 | ✅ All covered (todayAttendance + leaveBalanceSummary added) |
| Manager Dashboard | 5 | ✅ All covered (approvalBreakdown + presentToday added) |
| Employee List | 3 | ✅ All covered (bulk deactivate + bulk export added) |
| Create Employee | 5 | ✅ All covered (next-code + presign/confirm added) |
| Employee Profile | 7 | ✅ All covered (documents download + delete added) |
| Departments | 7 | ✅ All covered (dept employees + reassign-and-delete added) |
| My Leave Requests | 5 | ✅ All covered |
| Team Leave (Manager) | 9 | ✅ All covered (team/coverage + bulk approve/reject added) |
| Leave Types (HR Admin) | 6 | ✅ All covered (POST/PATCH/DELETE leave-types via settings added) |
| My Attendance | 7 | ✅ All covered |
| Team Attendance | 7 | ✅ All covered (team/weekly grid added) |
| Holidays | 4 | ✅ Covered (.ics import deferred — separate ticket) |
| Analytics | 7 | ✅ All covered (deltas + entity labels added) |
| Notifications (topbar) | 4 | ✅ All covered (GET + read + read-all) |
| Global Search (topbar) | 1 | ✅ All covered |
| Audit Logs | 3 | ✅ All covered |
| Settings — Branding | 2 | ✅ All covered |
| Settings — Attendance Rules | 2 | ✅ All covered |
| Settings — Auth / Security | 2 | ✅ All covered |
| Settings — Notification Prefs | 2 | ✅ All covered |
| Settings — Custom Roles | 3 | ✅ All covered |
| **Total** | **99** | **✅ 97% covered (2 deferred)** |

### Deferred (not yet implemented)

| Feature | Reason |
|---------|--------|
| `POST /auth/otp/initiate` | MFA challenge initiation — existing `/auth/verify-otp` flow still functional |
| `POST /holidays/import` (.ics) | Requires .ics parsing — separate ticket |
