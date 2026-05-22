# EMS API — Actual Response Mapping

> **Verified against live Render API on 2026-05-22**
> Base URL: `https://employee-management-system-2b9q.onrender.com/api/v1`
>
> The `docs/openapi.json` file contains the Swagger spec (generated from route schemas).
> This file documents what the API **actually returns** — use this as the source of truth.
>
> ## Envelope
> Every response is wrapped in:
> ```json
> { "success": true, "data": <payload>, "meta": {} }
> ```
> On error:
> ```json
> { "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": {} } }
> ```

---

## Auth

### `POST /auth/login`
No headers required. Server resolves tenant from email automatically.

**Body:**
```json
{ "email": "hr@acme.test", "password": "Password123!" }
```

**Response — `data`:**
```json
{
  "accessToken": "eyJ...",
  "sessionId": "fbd3b38de534129c109d90f7",
  "user": {
    "id": "cmpfypbqs000sunacwj0lfpx3",
    "email": "hr@acme.test",
    "memberType": "HR_ADMIN",
    "employeeId": "cmpfypsvr001iunacpwa3m6cf",
    "employee": {
      "id": "cmpfypsvr001iunacpwa3m6cf",
      "tenantId": "cmpfyl9sx0000ug81ekztst0p",
      "userId": "cmpfypbqs000sunacwj0lfpx3",
      "employeeCode": "E0003",
      "firstName": "HR",
      "lastName": "Admin",
      "workEmail": "hr@acme.test",
      "personalEmail": "hr@acme.test",
      "phone": "+91 98765 43212",
      "dateOfBirth": null,
      "gender": null,
      "address": null,
      "emergencyContactName": null,
      "emergencyContactPhone": null,
      "designation": "HR Manager",
      "departmentId": "cmpfypjsk0012unac2shsfsi3",
      "managerId": null,
      "joinedOn": "2019-01-10T00:00:00.000Z",
      "employmentType": "FULL_TIME",
      "employmentStatus": "ACTIVE",
      "location": "Delhi",
      "payCurrency": "INR",
      "createdBy": "cmpfypbcl000qunac4ncom4qx",
      "updatedBy": null,
      "createdAt": "2026-05-21T20:47:51.927Z",
      "updatedAt": "2026-05-21T20:47:51.927Z",
      "deletedAt": null
    }
  },
  "permissions": ["employees:read", "employees:write", "employees:delete", "employees:export", "departments:read", "departments:write", "attendance:read", "attendance:write", "leave:read", "leave:approve", "analytics:read", "audit:read"]
}
```

> ⚠️ **SUPER_ADMIN** has `employeeId: null` and `employee: null` — no employee profile.
> ⚠️ `accessToken` is also set as an **httpOnly cookie** (`accessToken`). Browser uses cookie automatically. `accessToken` in body is for Swagger/Postman only.
> ⚠️ `refreshToken` is set as httpOnly cookie only — never in the body.

---

### `GET /auth/me`
**`data`:**
```json
{
  "id": "cmpfypbqs000sunacwj0lfpx3",
  "email": "hr@acme.test",
  "memberType": "HR_ADMIN",
  "employeeId": "cmpfypsvr001iunacpwa3m6cf",
  "status": "ACTIVE",
  "employee": { ...full employee object (same shape as login.user.employee)... },
  "permissions": ["employees:read", ...]
}
```

---

## Employees

### `GET /employees`
> ⚠️ **QUIRK — double-nested data**: the list is at `data.data`, NOT `data`.

**`data`:**
```json
{
  "data": [
    {
      "id": "cmpfypq1h001eunacja7guack",
      "tenantId": "cmpfyl9sx0000ug81ekztst0p",
      "userId": "cmpfypby3000uunacu0jo96k0",
      "employeeCode": "E0001",
      "firstName": "Aman",
      "lastName": "Kumar",
      "workEmail": "aman@acme.test",
      "personalEmail": "aman.kumar@gmail.com",
      "phone": "+91 98765 43210",
      "dateOfBirth": "1990-03-15T00:00:00.000Z",
      "gender": "MALE",
      "address": "Delhi, India",
      "emergencyContactName": "Priya Kumar",
      "emergencyContactPhone": "+91 98765 43215",
      "designation": "Engineering Manager",
      "departmentId": "cmpfyph7t000yunacvy5kouqi",
      "managerId": null,
      "joinedOn": "2020-01-15T00:00:00.000Z",
      "employmentType": "FULL_TIME",
      "employmentStatus": "ACTIVE",
      "location": "Delhi",
      "payCurrency": "INR",
      "createdBy": "...",
      "updatedBy": null,
      "createdAt": "...",
      "updatedAt": "...",
      "deletedAt": null,
      "department": { "id": "...", "name": "Engineering" },
      "manager": null,
      "user": { "email": "aman@acme.test", "memberType": "MANAGER", "status": "ACTIVE" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 65, "pages": 4 }
}
```

**Query params:** `page`, `limit`, `search`, `departmentId`, `status` (`ACTIVE`/`INACTIVE`)

**Role behaviour (server-enforced):**
- `HR_ADMIN / SUPER_ADMIN` → all employees
- `MANAGER` → direct reports only
- `EMPLOYEE` → themselves only

---

### `GET /employees/:id`
> ⚠️ Data is at `data` directly (not double-nested).

**`data`:**
```json
{
  "id": "cmpfypsvr001iunacpwa3m6cf",
  "tenantId": "...",
  "userId": "...",
  "employeeCode": "E0003",
  "firstName": "HR",
  "lastName": "Admin",
  "workEmail": "hr@acme.test",
  "personalEmail": "hr@acme.test",
  "phone": "+91 98765 43212",
  "dateOfBirth": null,
  "gender": null,
  "address": null,
  "emergencyContactName": null,
  "emergencyContactPhone": null,
  "designation": "HR Manager",
  "departmentId": "...",
  "managerId": null,
  "joinedOn": "2019-01-10T00:00:00.000Z",
  "employmentType": "FULL_TIME",
  "employmentStatus": "ACTIVE",
  "location": "Delhi",
  "payCurrency": "INR",
  "createdBy": "...",
  "updatedBy": null,
  "createdAt": "...",
  "updatedAt": "...",
  "deletedAt": null,
  "user": { "email": "hr@acme.test", "memberType": "HR_ADMIN", "status": "ACTIVE", "mfaEnabled": false },
  "department": { "id": "...", "name": "HR" },
  "manager": null
}
```

---

## Departments

### `GET /departments`
> ⚠️ **QUIRK — data is a flat array directly at `data`** (not nested).

**`data`:** (array)
```json
[
  {
    "id": "cmpfyporh001cunacw7t4f2qx",
    "tenantId": "...",
    "parentId": null,
    "name": "Customer Success",
    "departmentCode": "CUS",
    "headEmployeeId": null,
    "depth": 0,
    "createdAt": "...",
    "updatedAt": "...",
    "deletedAt": null,
    "headEmployee": null,
    "_count": { "employees": 7 },
    "children": []
  }
]
```

> `children` is always `[]` — the API returns a flat list. Build hierarchy on client using `parentId`.

---

## Analytics (HR_ADMIN / SUPER_ADMIN only)

### `GET /analytics/summary`
**`data`:**
```json
{
  "totalEmployees": 65,
  "activeToday": 0,
  "onLeaveToday": 0,
  "openRequests": 0
}
```
**`meta`:** `{ "cached": false, "generatedAt": "2026-05-22T06:49:07.105Z" }`

---

### `GET /analytics/attendance?range=7d`
Supported ranges: `7d`, `30d`, `90d`

**`data`:**
```json
{
  "range": "7d",
  "series": [
    { "date": "2026-05-16", "present": 0, "absent": 0, "leave": 0, "wfh": 0, "halfDay": 0 },
    { "date": "2026-05-17", "present": 3, "absent": 0, "leave": 0, "wfh": 0, "halfDay": 0 }
  ]
}
```

---

### `GET /analytics/headcount-by-department`
> ⚠️ Data is an array directly at `data`.

**`data`:** (array)
```json
[
  {
    "departmentId": "cmpfyph7t000yunacvy5kouqi",
    "departmentName": "Engineering",
    "employeeCount": 10,
    "activeCount": 8
  }
]
```

---

### `GET /analytics/recent-activity?limit=10`
> ⚠️ Data is an array directly at `data`.

**`data`:** (array)
```json
[
  {
    "id": "cmpgk6ym700056d9wcvw28vp0",
    "actorName": "Priya",
    "action": "login",
    "entityType": "User",
    "entityId": "cmpfypc6d000wunac1zlr789l",
    "resourceLabel": "User #CMPFY",
    "createdAt": "2026-05-22T06:49:04.447Z",
    "createdAtIstDisplay": "22/05/2026 12:19:04 pm IST"
  }
]
```

---

### `GET /analytics/leave-summary?range=30d`
**`data`:**
```json
{
  "pending": 0,
  "approved": 0,
  "rejected": 0,
  "withdrawn": 1
}
```

---

## Employee Dashboard

### `GET /employee/dashboard`
> Uses `employeeId` from JWT — no URL param needed.
> Returns `400 NO_EMPLOYEE_RECORD` for SUPER_ADMIN.

**`data`:**
```json
{
  "employeeName": "HR Admin",
  "designation": "HR Manager",
  "department": "HR",
  "todayAttendance": {},
  "pendingLeaves": 0
}
```

---

### `GET /employee/team` (also `/employees/me/team`)
> ⚠️ Known seed data issue — returns empty object `{}` for current seeded employees (manager linkage not set in seed). Schema is correct; data will populate when employee `managerId` fields are set.

**`data`:**
```json
{
  "manager": { "name": "...", "designation": "...", "email": "..." },
  "peers": [{ "name": "...", "designation": "...", "email": "..." }]
}
```

---

## Leave

### `GET /leave/types`
> ⚠️ Data is an array directly at `data`.

**`data`:** (array)
```json
[
  { "id": "cmpfypuvg001kunacml0quuvj", "name": "Annual Leave", "code": "ANNUAL", "annualAllowance": 21, "carryForwardAllowed": true, "isPaid": true },
  { "id": "cmpfypwib001munacc41r3802", "name": "Sick Leave", "code": "SICK", "annualAllowance": 10, "carryForwardAllowed": false, "isPaid": true },
  { "id": "cmpfypxhn001ounacxdcl8j2r", "name": "Casual Leave", "code": "CASUAL", "annualAllowance": 12, "carryForwardAllowed": false, "isPaid": true }
]
```

---

### `GET /leave/balance`
**`data`:**
```json
{
  "balances": [
    {
      "id": "...",
      "leaveTypeId": "cmpfypuvg001kunacml0quuvj",
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
**`data`:**
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
      "status": "WITHDRAWN",
      "reason": "Personal appointment scheduled",
      "submittedAt": "2026-05-21T21:13:37.484Z",
      "decidedAt": null,
      "approverComment": null
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 1, "pages": 1 }
}
```

**Status enum:** `PENDING | APPROVED | DENIED | WITHDRAWN | CANCELLED`

### `POST /leave/requests`
```json
{
  "leaveTypeId": "<id from GET /leave/types>",
  "startDate": "2026-06-15T00:00:00.000Z",
  "endDate": "2026-06-15T00:00:00.000Z",
  "reason": "At least 10 characters"
}
```
> ⚠️ Dates must be ISO datetime strings (`T00:00:00.000Z`), NOT plain date strings (`2026-06-15`).

---

## Attendance

### `GET /attendance/today`
**`data`:**
```json
{
  "date": "2026-05-22T00:00:00.000Z",
  "status": "NOT_MARKED",
  "checkInAt": null,
  "checkOutAt": null,
  "duration": null
}
```
**status enum:** `NOT_MARKED | PRESENT | ABSENT`

---

### `GET /attendance/records?month=2026-05`
**`data`:**
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
  "pagination": { "page": 1, "limit": 10, "total": 15, "pages": 2 }
}
```
**Query params:** `month=YYYY-MM` OR `fromDate=` + `toDate=`

---

### `GET /attendance/summary`
**`data`:**
```json
{
  "period": { "startDate": "2026-05-01T00:00:00.000Z", "endDate": "2026-05-22T..." },
  "totalDays": 15,
  "present": 15,
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
```json
{
  "attendanceDate": "2026-05-20T00:00:00.000Z",
  "type": "MISSED_CHECKOUT",
  "reason": "Minimum 20 characters reason here"
}
```
> ⚠️ `attendanceDate` must be ISO datetime string.
> `type` enum: `LATE | MISSED_CHECKOUT | EARLY_CHECKOUT`
> `reason` minimum 20 characters.

---

## Holidays

### `GET /holidays?year=2026`
**`data`:**
```json
{
  "holidays": [
    {
      "id": "...",
      "tenantId": "...",
      "name": "Independence Day",
      "holidayDate": "2026-08-15T00:00:00.000Z",
      "location": "India",
      "isOptional": false,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ],
  "total": 3
}
```

### `POST /holidays`
```json
{ "name": "Diwali", "holidayDate": "2026-10-20", "location": "India", "isOptional": false }
```

---

## Manager Dashboard

### `GET /manager/dashboard`
**`data`:**
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
> ⚠️ Data is an array directly at `data`.

**`data`:** (array)
```json
[
  { "id": "...", "employeeCode": "E0002", "firstName": "Priya", "lastName": "Sharma", "designation": "Senior Engineer" }
]
```

---

### `GET /manager/approvals`
**`data`:**
```json
{
  "leaveRequests": [],
  "regularizationRequests": []
}
```

---

## Audit Logs

### `GET /audit-logs`
**`data`:**
```json
{
  "logs": [
    {
      "id": "...",
      "user_email": "priya@acme.test",
      "action": "LOGIN",
      "entity_type": "User",
      "entity_id": "...",
      "old_value": null,
      "new_value": null,
      "ip_address": "127.0.0.1",
      "user_agent": "curl/8.7.1",
      "created_at": "2026-05-22T06:49:04.447Z"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 71, "pages": 8 }
}
```

---

## Settings

### `GET /settings/tenant`
**`data`:**
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

## Quirks Summary for Frontend Team

| Endpoint | Where the list/data lives | Notes |
|----------|--------------------------|-------|
| `GET /employees` | `data.data[]` + `data.pagination` | **Double-nested** — list is at `data.data` |
| `GET /departments` | `data[]` | Flat array, build tree from `parentId` |
| `GET /analytics/headcount-by-department` | `data[]` | Array directly |
| `GET /analytics/recent-activity` | `data[]` | Array directly |
| `GET /leave/types` | `data[]` | Array directly |
| `GET /manager/team` | `data[]` | Array directly |
| `GET /leave/requests` | `data.requests[]` + `data.pagination` | Nested under `requests` key |
| `GET /attendance/records` | `data.records[]` + `data.pagination` | Nested under `records` key |
| `GET /audit-logs` | `data.logs[]` + `data.pagination` | Nested under `logs` key |
| `GET /leave/balance` | `data.balances[]` | Nested under `balances` key |
| `GET /holidays` | `data.holidays[]` + `data.total` | Nested under `holidays` key |
| All others | `data` (object) | Single object |

## Date Format Warning
> All date inputs to POST/PATCH endpoints must be **ISO datetime strings**: `"2026-06-15T00:00:00.000Z"`
> Plain date strings like `"2026-06-15"` will fail validation with `FST_ERR_VALIDATION`.
