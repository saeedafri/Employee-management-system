# Backend API Requests — From Frontend Team

> **From:** Frontend team
> **To:** Backend team
> **Status:** Pending implementation
> **Last updated:** 2026-05-25
>
> ## Purpose
>
> This document lists endpoints the **frontend needs** that do **not yet exist** in
> `docs/API_MAPPING.md`.
>
> The frontend is building against these exact response shapes via **MSW mocks
> today**. When you ship the real endpoint with the response shape below, our
> code keeps working — we just flip the MSW handler off. **If you must deviate
> from a documented shape, please ping the frontend team before merging.**
>
> ## Authoritative references
>
> - **API source of truth (live endpoints):** `docs/API_MAPPING.md`
> - **UI source of truth (what each endpoint feeds):** `docs/WIREFRAMES.pdf`
> - **Architecture notes:** `CLAUDE.md` (§3, §4, §10)

---

## Conventions (must match these — same as existing live endpoints)

- **Envelope:** `{ success, data, meta }` — see `API_MAPPING.md` "Response Envelope".
- **Auth:** cookie-based (`accessToken` + `ems_session`). **No** `Authorization` header is sent from the browser. **No** `x-tenant-key` — tenant is resolved from the JWT.
- **Date writes:** `YYYY-MM-DD` strings on POST/PATCH bodies. Server returns full ISO on reads.
- **Field casing per domain (match existing conventions):**
  - `camelCase` — employees, departments, leave, attendance, holidays, notifications, search
  - `snake_case` — settings/tenant, settings/branding, attendance-rules, auth-settings, notification-preferences, audit-logs
- **Status codes:** 200 (GET/PATCH/DELETE), 201 (POST create), 202 (queued), 400/401/403/404/409/422 per `API_MAPPING.md` "HTTP Status Code Rules".
- **Error envelope:** same as `API_MAPPING.md` — `{ success: false, error: { code, message, details, requestId } }`.

---

## Table of Contents

1. [Auth — forgot password, reset, OTP](#1-auth-flows)
2. [Notifications](#2-notifications)
3. [Global search](#3-global-search)
4. [Documents — S3 pre-signed uploads](#4-documents)
5. [Employees — convenience + bulk](#5-employees-convenience)
6. [Departments — reassign + list](#6-departments)
7. [Leave — team calendar, bulk, coverage](#7-leave)
8. [Holidays — .ics import](#8-holidays)
9. [Settings — branding, leave-types CRUD, attendance rules, auth, notification prefs](#9-settings)
10. [Custom roles](#10-custom-roles)
11. [Dashboard analytics with deltas + weekly grid](#11-dashboard-analytics)
12. [Activity feed — human-readable entity labels](#12-activity-feed-entity-labels)

---

## 1. Auth flows

### `POST /auth/forgot-password`

**Why:** Wireframe screen 02 — user clicks "Forgot password?" on login.
**Rate-limited:** 3 requests / hour / IP.

**Body:**
```json
{ "email": "user@company.com" }
```

**Response 202 (always — do not leak whether email exists):**
```json
{
  "success": true,
  "data": { "message": "If an account exists, a reset link has been sent." },
  "meta": {}
}
```

**Errors:**
| Code | Status | When |
|---|---|---|
| `RATE_LIMITED` | 429 | Over 3/hour |
| `VALIDATION_ERROR` | 422 | Invalid email format |

**Side effects:** server enqueues an email job; token stored hashed; valid 30 min, single-use.

---

### `POST /auth/reset-password`

**Why:** Wireframe screen 02 annotations — user clicks the email link.

**Body:**
```json
{ "token": "<one-time-token-from-email>", "password": "<new-password>" }
```

**Response 200:**
```json
{ "success": true, "data": { "message": "Password reset successfully" }, "meta": {} }
```

**Errors:**
| Code | Status | When |
|---|---|---|
| `INVALID_TOKEN` | 400 | Token not found / already used |
| `EXPIRED_TOKEN` | 400 | Past 30-min TTL |
| `WEAK_PASSWORD` | 422 | Fails complexity rules |

**Side effect:** revokes all existing sessions for that user.

---

### `POST /auth/otp/initiate`

**Why:** Wireframe screen 03 — login returned `MFA_REQUIRED`; UI starts a verification challenge.

**Body:**
```json
{ "challengeId": "<from-login-response>" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "challengeId": "chal_...",
    "deliveryMethod": "EMAIL",
    "expiresAt": "2026-05-25T10:10:00.000Z",
    "resendAvailableAt": "2026-05-25T10:01:00.000Z"
  },
  "meta": {}
}
```

**Errors:**
| Code | Status | When |
|---|---|---|
| `CHALLENGE_NOT_FOUND` | 404 | Bad/expired challengeId |
| `RESEND_TOO_SOON` | 429 | Resend before cooldown |
| `MAX_RESENDS` | 429 | More than 3 resends |

---

### Login response change — MFA branch

**Why:** Wireframe screen 03 — login flow forks when MFA is required.

When MFA is required, **don't** issue cookies on `POST /auth/login`. Instead respond:

```json
{
  "success": true,
  "data": {
    "mfaRequired": true,
    "challengeId": "chal_...",
    "deliveryMethod": "EMAIL"
  },
  "meta": {}
}
```

Frontend routes to `/otp-verification?challengeId=...`. Then `POST /auth/verify-otp` (already documented in `API_MAPPING.md`) issues the cookies on success — same shape as a successful login.

---

## 2. Notifications

> Wireframes mention notifications on screens 04, 05, 12 (topbar bell, real-time approvals).
> `CLAUDE.md §3` already lists notifications as "needs MSW".

### `GET /notifications?unreadOnly=true&page=1&limit=20`

**Required role:** any authenticated user.

**Response `data`:**
```json
{
  "notifications": [
    {
      "id": "n_01",
      "type": "LEAVE_APPROVED",
      "title": "Your leave request was approved",
      "body": "Aman Kumar approved your annual leave for Jun 15–17.",
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

**`type` enum:**
`LEAVE_APPROVED | LEAVE_REJECTED | LEAVE_REQUESTED | ATTENDANCE_REGULARIZATION_REQUESTED | ATTENDANCE_REGULARIZATION_APPROVED | ATTENDANCE_REGULARIZATION_DENIED | EMPLOYEE_CREATED | DOCUMENT_UPLOADED | SYSTEM`

### `POST /notifications/:id/read`

**Response 200:** `{ "success": true, "data": { "id": "n_01", "isRead": true }, "meta": {} }`

### `POST /notifications/read-all`

**Response 200:** `{ "success": true, "data": { "markedRead": 7 }, "meta": {} }`

### `GET /notifications?since=ISO_TIMESTAMP` (poll-based)

Same response shape as paginated GET. Frontend polls every 30s by default. **If SSE is later available** at `GET /notifications/stream` (each event: `event: notification`, `data: <Notification>`), the frontend will switch.

---

## 3. Global search

**Why:** Wireframes show a topbar `Search...` input on every authenticated screen, with "/" keyboard shortcut.

### `GET /search?q=<query>&types=employee,department,leave&limit=8`

**Required role:** any authenticated user. **Permission-aware:** only returns rows the caller can read.

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
      "sublabel": "412 employees",
      "url": "/departments?id=dep_..."
    }
  ],
  "groupedCounts": { "employee": 5, "department": 1, "leave": 2 }
}
```

**`type` enum:** `employee | department | leave | holiday | settings`

---

## 4. Documents

> `CLAUDE.md §3` lists "Document upload (POST)" as still needed.
> Wireframes show document upload on Employee Profile (screen 08) and Employee Create step 3 (screen 09).

### `POST /employees/:id/documents/presign`

**Required role:** HR_ADMIN, SUPER_ADMIN, or self.

**Body:**
```json
{
  "filename": "Aadhaar.pdf",
  "contentType": "application/pdf",
  "size": 2415616,
  "category": "AADHAAR"
}
```

**`category` enum:** `OFFER_LETTER | AADHAAR | PAN | BANK | CONTRACT | OTHER`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://s3-presigned-url",
    "method": "PUT",
    "headers": { "Content-Type": "application/pdf" },
    "documentId": "doc_pending_..."
  },
  "meta": {}
}
```

### `POST /employees/:id/documents/:documentId/confirm`

Called after the browser successfully PUTs the file to S3.

**Response 201:** full document object — see GET response.

### `GET /employees/:id/documents`

**Response `data`:**
```json
{
  "documents": [
    {
      "id": "doc_...",
      "employeeId": "emp_...",
      "filename": "Aadhaar.pdf",
      "category": "AADHAAR",
      "sizeBytes": 2415616,
      "contentType": "application/pdf",
      "status": "VERIFIED",
      "uploadedAt": "2026-05-22T10:00:00.000Z",
      "uploadedById": "emp_...",
      "downloadUrl": "/api/v1/employees/emp_.../documents/doc_.../download"
    }
  ]
}
```

**`status` enum:** `PENDING | VERIFIED | REJECTED`

### `GET /employees/:id/documents/:documentId/download`

**Response 302:** redirect to a short-lived signed URL.

### `DELETE /employees/:id/documents/:documentId`

**Response 200:** `{ "id": "doc_...", "status": "deleted" }`

---

## 5. Employees — convenience

### `GET /employees/next-code`

**Why:** Wireframe screen 09 — "Auto / E20XX" + Generate code button.

**Required role:** HR_ADMIN, SUPER_ADMIN.

**Response 200:** `{ "success": true, "data": { "code": "E0068" }, "meta": {} }`

### `POST /employees/bulk/deactivate`

**Why:** Wireframe screen 07 — "Bulk deactivate (HR only)".

**Body:** `{ "ids": ["emp_a", "emp_b"] }`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "succeeded": ["emp_a"],
    "failed": [{ "id": "emp_b", "code": "EMPLOYEE_HAS_DEPENDENTS", "message": "Has 3 direct reports." }]
  },
  "meta": {}
}
```

### `POST /employees/bulk/export`

**Body:** `{ "ids": ["..."], "format": "csv" }`

**Response 200:** `{ "jobId": "...", "status": "PENDING" }` — matches existing `POST /export/employees` pattern.

---

## 6. Departments

### `POST /departments/:id/reassign-and-delete`

**Why:** Wireframe screen 10 — "Cannot delete dept with active employees (offers 'reassign' flow)".
Currently `DELETE /departments/:id` fails with `DEPARTMENT_NOT_EMPTY` (409) and there's no migration path.

**Body:** `{ "reassignEmployeesTo": "dep_target_id" }`

**Response 200:**
```json
{ "id": "dep_old_id", "status": "archived", "reassignedEmployees": 14 }
```

**Errors:**
| Code | Status | When |
|---|---|---|
| `INVALID_TARGET` | 400 | Target dept doesn't exist or is being deleted |
| `SAME_DEPARTMENT` | 400 | Target equals source |

### `GET /departments/:id/employees?page=1&limit=20&search=...`

**Why:** Wireframe screen 10 right-panel "Employees in this department" table.

**Response `data`:** double-nested same as `GET /employees`:
```json
{
  "data": [ /* Employee objects */ ],
  "pagination": { "page": 1, "limit": 20, "total": 14, "pages": 1 }
}
```

---

## 7. Leave

### `POST /leave/requests/bulk/approve` and `POST /leave/requests/bulk/reject`

**Why:** Wireframe screen 12 — "Bulk approve" toolbar button.

**Body:** `{ "ids": ["lr_a", "lr_b"], "comment": "Approved in bulk" }` (comment optional)

**Response 200:**
```json
{
  "succeeded": ["lr_a"],
  "failed": [{ "id": "lr_b", "code": "LEAVE_ALREADY_DECIDED", "message": "Already decided." }]
}
```

### `GET /leave/team/calendar?month=YYYY-MM`

**Why:** Wireframe screen 12 — "Team Calendar" tab. Pre-aggregated per-employee per-day grid so the client doesn't 30× lookup.

**Required role:** MANAGER, HR_ADMIN, SUPER_ADMIN.

**Response `data`:**
```json
{
  "month": "2026-06",
  "members": [
    {
      "employeeId": "emp_...",
      "name": "Priya Sharma",
      "designation": "Senior Engineer",
      "days": [
        { "date": "2026-06-15", "status": "LEAVE", "leaveTypeCode": "ANNUAL", "isPartial": false },
        { "date": "2026-06-16", "status": "WFH", "leaveTypeCode": null, "isPartial": false }
      ]
    }
  ]
}
```

**`status` enum:** `LEAVE | WFH | HOLIDAY | WEEKEND | WORKING`

### `GET /leave/team/coverage?date=YYYY-MM-DD&departmentId=...`

**Why:** Wireframe screen 12 annotation — "Warning chip appears next to date when team coverage < threshold".

**Required role:** MANAGER, HR_ADMIN, SUPER_ADMIN.

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

---

## 8. Holidays

### `POST /holidays/import` (multipart)

**Why:** Wireframe screen 13 — "Import .ics" button.

**Body:** `multipart/form-data` with field `file` = .ics file.

**Response 202:**
```json
{
  "success": true,
  "data": { "jobId": "imp_...", "previewUrl": "/api/v1/holidays/import/imp_.../preview" },
  "meta": {}
}
```

### `GET /holidays/import/:jobId/preview`

**Response `data`:**
```json
{
  "candidates": [
    { "name": "Diwali", "date": "2026-10-20", "isOptional": false, "willOverwrite": false },
    { "name": "Independence Day", "date": "2026-08-15", "isOptional": false, "willOverwrite": true }
  ],
  "summary": { "new": 8, "overwrites": 2, "skipped": 0 }
}
```

### `POST /holidays/import/:jobId/commit`

**Body:** `{ "overwriteExisting": true }`

**Response 200:** `{ "imported": 8, "overwritten": 2, "skipped": 0 }`

---

## 9. Settings

> All settings endpoints use **`snake_case`** field names per existing
> `/settings/tenant` convention.

### `PATCH /settings/branding` (multipart)

**Why:** Wireframe screen 15 left-nav "Branding".
**Required role:** HR_ADMIN, SUPER_ADMIN.

**Body:** `multipart/form-data` — field `logo` (image, max 1 MB, PNG/SVG), or JSON `{ "logo_url": null }` to clear.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "logo_url": "https://cdn.../logo.png",
    "primary_color_hex": "#3b5cff"
  },
  "meta": {}
}
```

### `GET /settings/branding`

Same `data` shape as PATCH response.

---

### `POST /settings/leave-types`

**Why:** Wireframe screen 15 left-nav "Leave types".
**Required role:** HR_ADMIN, SUPER_ADMIN.

**Body (camelCase — matches existing `GET /leave/types`):**
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

**Response 201:** full leave type object — same shape as `GET /leave/types` items.

**Errors:**
| Code | Status |
|---|---|
| `DUPLICATE_LEAVE_TYPE_CODE` | 409 |
| `VALIDATION_ERROR` | 422 |

### `PATCH /settings/leave-types/:id`

**Body:** any subset of the POST body.

### `DELETE /settings/leave-types/:id`

**Response 200:** `{ "id": "lt_...", "status": "deleted" }`

**Errors:**
| Code | Status | When |
|---|---|---|
| `LEAVE_TYPE_IN_USE` | 409 | Active balances exist for this type |

---

### `GET /settings/attendance-rules` and `PATCH`

**Why:** Wireframe screen 15 left-nav "Attendance rules".
**Required role:** HR_ADMIN, SUPER_ADMIN.

**Response `data` (snake_case):**
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

PATCH accepts any subset.

---

### `GET /settings/security/auth` and `PATCH`

**Why:** Wireframe screen 15 left-nav "Authentication".
**Required role:** SUPER_ADMIN.

**Response `data` (snake_case):**
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

**`mfa_policy` enum:** `OPTIONAL | REQUIRED_ADMINS | REQUIRED_ALL`

---

### `GET /settings/notifications/preferences` and `PATCH`

**Why:** Wireframe screen 15 left-nav "In-app preferences".
**Scope:** per-user (caller), not per-tenant.

**Response `data` (snake_case):**
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

---

## 10. Custom roles

**Why:** Wireframe screen 14 — "HR Admin can create new roles in their tenant (e.g. 'Recruiter')".
Today the backend `authorize()` uses a fixed `memberType` enum (`SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | AUDITOR`).

> **Note to backend team:** this is a model change, not just a route addition.
> Adding `Role` and `UserRole` tables (or extending the existing
> `role_permissions`) so role keys are tenant-scoped instead of enum-only.
> Frontend can ship the UI behind a feature flag until ready.

### `POST /settings/roles`

**Body:**
```json
{
  "name": "Recruiter",
  "key": "RECRUITER",
  "permissions": ["employees:read", "departments:read"]
}
```

**Response 201:** `{ "key": "RECRUITER", "name": "Recruiter", "permissions": [...] }`

**Errors:** `DUPLICATE_ROLE_KEY` (409).

### `DELETE /settings/roles/:key`

**Response 200:** `{ "key": "RECRUITER", "status": "deleted" }`
**Errors:** `ROLE_IN_USE` (409) — at least one user has this role.

### `POST /settings/roles/:key/users`

**Body:** `{ "userIds": ["usr_a", "usr_b"] }`
**Response 200:** `{ "assigned": ["usr_a", "usr_b"] }`

### `PATCH /settings/roles-permissions` (existing — extend semantics)

Today this only accepts the fixed enum roles. Extend to accept any tenant role key, including custom ones.

---

## 11. Dashboard analytics — with deltas + weekly grid

### `GET /analytics/summary` — extend to include deltas

**Why:** Wireframe screen 04 — every stats card shows a delta sub-line ("12 vs last month", "3.1%", "5 urgent").

**Current response:** `{ totalEmployees, activeToday, onLeaveToday, openRequests }` — just numbers.

**Proposed response (additive — preserve existing top-level fields for back-compat, add a `deltas` block):**

```json
{
  "totalEmployees": 1240,
  "activeToday": 1087,
  "onLeaveToday": 84,
  "openRequests": 23,
  "deltas": {
    "totalEmployees":  { "delta": 12,    "deltaLabel": "vs last month" },
    "activeToday":     { "deltaPercent": 3.1 },
    "onLeaveToday":    { "delta": 2 },
    "openRequests":    { "urgent": 5 }
  }
}
```

This way the live endpoint can ship the additive block when ready; frontend reads `deltas?.totalEmployees?.delta` etc. and shows nothing if absent.

---

### `GET /attendance/team/weekly?weekStart=YYYY-MM-DD&departmentId=...`

**Why:** Wireframe screen 05 — "Team Attendance — This Week" grid (rows = employees, cols = M T W T F).

**Required role:** MANAGER, HR_ADMIN, SUPER_ADMIN.

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
        { "date": "2026-05-26", "code": "P" },
        { "date": "2026-05-27", "code": "L" },
        { "date": "2026-05-28", "code": "P" },
        { "date": "2026-05-29", "code": "A" }
      ]
    }
  ]
}
```

**`code` enum:** `P` (Present) | `A` (Absent) | `L` (Leave) | `W` (WFH) | `H` (Half day) | `O` (Holiday/weekend).

---

### `GET /manager/dashboard` — extend with `approvalBreakdown`

**Why:** Wireframe screen 05 — "Pending approvals: 5 (3 leave, 2 reg.)".

Add a `approvalBreakdown` field:
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

---

### `GET /employee/dashboard` — extend with leave-balance breakdown + today's attendance

**Why:** Wireframe screen 06 — Today's attendance clock-in card; Leave balance shown as Casual / Sick / Earned columns.

Add `todayAttendance` and `leaveBalanceSummary` to the existing response:
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

`leaveBalanceSummary` is the same data as `GET /leave/balance` but pre-trimmed to top-3 active types for the dashboard card.

---

## 12. Activity feed — entity labels

### `GET /analytics/recent-activity` — extend entity with human-readable label + URL

**Why:** Wireframe screen 04 Recent Activity table shows "Employee #E32m04a1go", "LR-1187", "Department: Engineering". Today the response has only `entity_type` + `entity_id` (a CUID) which is not user-readable.

**Add to each item:**
```json
{
  "id": "audit_...",
  "user_email": "hr@acme.test",
  "action": "UPDATE",
  "entity_type": "Employee",
  "entity_id": "cmpfypq1h001eunacja7guack",
  "entity_label": "Employee E0042 · Priya Sharma",
  "entity_url": "/employees/cmpfypq1h001eunacja7guack",
  "created_at": "2026-05-22T..."
}
```

`entity_label` and `entity_url` are derived server-side from the entity. If the entity was deleted, return `entity_label: "Employee #E0042 (deleted)"` and `entity_url: null`.

---

## Implementation note for the backend team

Frontend will ship UI for **every** endpoint listed here against MSW mocks
matching the response shapes documented above. **You can implement these in
any order.** Once a real endpoint goes live, the frontend's MSW handler for
that path is removed and the live endpoint serves the same data.

If a shape needs to change, please:
1. Update this doc with the new shape.
2. Ping the frontend team — we'll update the MSW handler and TypeScript
   types in lockstep.

Questions / clarifications: open a thread referencing the section number in
this doc.
