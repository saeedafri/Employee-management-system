# Frontend contract — 2026-11-14

**For:** the UI team (`SAQIBJH/ems-frontend`)
**From:** backend (`saeedafri/Employee-management-system`), commits after `4316ba7`
**API:** `https://ems-api.saqibsaeed.cloud/api/v1` · full reference: `docs/API_MAPPING.md` (two change tables dated 2026-11-14) · every route is now in Swagger at `/docs`

The **UI status** column is empty on purpose. Fill it in (`done` / `in progress` / `won't do` + PR link), and add questions under each section.

Priority: **P1** = users see a wrong result or a dead end today · **P2** = a new backend feature waiting for UI · **P3** = polish.

---

## 1. Bugs in the frontend today

| # | P | Where | Problem | What to do | UI status |
|---|---|---|---|---|---|
| 1.1 | P1 | `src/lib/query-client.ts:6` | `retry: 2` retries every failed query, including 401/403/404/422 that can never succeed, so each failure costs 3 requests. With `refetchOnWindowFocus: true` (`src/modules/dashboard/hooks/useDashboard.ts:68`), every tab focus fires 3 more. | Retry only network errors and 5xx, for example `retry: (n, err) => n < 2 && (!err.response \|\| err.response.status >= 500)`. Drop `refetchOnWindowFocus` on the approvals hook. | |
| 1.2 | P1 | `src/modules/auth/components/LoginForm.tsx:60-80` | `429` falls through to "Something went wrong". 10 wrong passwords lock an account for 15 minutes (`429 ACCOUNT_TEMPORARILY_LOCKED`). Auth forms are limited per account (`429 RATE_LIMITED`). | Show the server's `error.message`, which says how long to wait. Treat `401 ACCOUNT_DISABLED` as "Your account has been deactivated. Contact HR." | |
| 1.3 | P1 | `src/modules/performance/components/StartReviewDialog.tsx:50-54` | The form shows "cannot be created yet". | Wire it to **`POST /performance/cycles`** (section 2.1). The form's four fields already match. | |
| 1.4 | P2 | Login, all pages | Offboarding now revokes sessions immediately. The next call returns `401`. | Make sure any `401` on a non-auth route signs out and returns to `/login`, without a retry loop. | |
| 1.5 | P2 | `src/modules/reports/components/PayrollSummaryReport.tsx` | `GET /reports/payroll` totals are real now (they were `employees × 50,000`), and there is a new `total_net_pay`. | Show net pay. Empty periods now really return 0. | |
| 1.6 | P3 | `DocumentsTab.tsx:61`, `EmployeeFormStepper.tsx:107` | The backend now checks file **content**: a renamed or HTML file returns `422 INVALID_FILE_TYPE`. It allows PDF, JPG/PNG/GIF/WebP, DOC/DOCX and XLS/XLSX for documents. | Optionally add `.gif,.webp,.xls,.xlsx` to `ACCEPTED_MIME`. Show the `422` message. | |

## 2. New backend endpoints that need UI

### 2.1 Performance review cycles (`performance:manage`: HR, SUPER_ADMIN)

```
POST /performance/cycles
{ "name": "H2 2026", "selfReviewDue": "2026-12-01", "managerReviewDue": "2026-12-10", "calibrationDate": "2026-12-20" }
→ 201 { success, data: { id, name, selfReviewDue, managerReviewDue, calibrationDate, progressPct, status: "In progress", startedAt, reviewsCreated } }
  409 ACTIVE_CYCLE_EXISTS   — close the current cycle first
  422 VALIDATION_ERROR      — dates must be in order self ≤ manager ≤ calibration (YYYY-MM-DD)

PATCH /performance/cycles/:id   { "status": "Upcoming" | "In progress" | "Calibrating" | "Closed" }
→ 200 cycle   404 NOT_FOUND
```
Starting a cycle opens one `Not started` review for every active employee, with their manager as reviewer. Afterwards `GET /performance/cycles/active` returns it.

| # | Task | UI status |
|---|---|---|
| 2.1.a | Start-cycle dialog → `POST /performance/cycles` (item 1.3) | |
| 2.1.b | A "Close cycle" / status action on the active cycle → `PATCH /performance/cycles/:id` | |

### 2.2 Announcement channels (`announcements:write`)

```
POST /announcements/channels   { "name": "IT news", "category": "Company" | "People" | "Product" | "IT" | "Office" }
→ 201 { success, data: { id, name, postCount, category, color } }    409 DUPLICATE_CHANNEL
```
A company with no channels no longer gets `422 NO_CHANNEL` when posting. The post goes to an auto-created **General** channel.

| # | Task | UI status |
|---|---|---|
| 2.2.a | "New channel" action on the Announcements screen | |
| 2.2.b | Remove any `NO_CHANNEL` handling | |

### 2.3 Remove a user from a role (`settings:manage`)

```
DELETE /settings/roles/:key/users/:userId
→ 200 { success, data: { removed: userId, role: key } }
  403 FORBIDDEN   — you can only remove a role whose permissions you hold yourself
  404 NOT_FOUND   — no such role, or the user does not hold it
```

| # | Task | UI status |
|---|---|---|
| 2.3.a | A "Remove" action per assigned user on the Permissions → Roles screen (until now a role could be given but never taken away) | |

### 2.4 Logs screen (new screen, `logs:read`: HR_ADMIN, SUPER_ADMIN)

Every server error (5xx) is now written to the company's log. These endpoints already exist and are company-scoped (a cross-company leak in them was fixed in this release).

```
GET /logs?level=ERROR|WARN|INFO|DEBUG&module=payroll&actorUserId=&from=ISO&to=ISO&limit=50&offset=0
→ 200 { success, data: [ LogEntry ], meta: { count, page, limit, total, totalPages } }     limit ≤ 200

LogEntry = {
  id, level, levelLabel, levelColor,          // "ERROR", "Error", "red"
  module,                                     // first path segment: "payroll", "leave", …
  message,                                    // error message, ≤ 500 chars
  requestId,                                  // matches the response's error.requestId — show it, support asks for it
  actorUserId, tenantId,
  metadata: { method, route, statusCode, name, code, stack },   // stack: first 8 lines
  timestampUtc, timestampIstDisplay
}

GET /logs/:id                                  → 200 one LogEntry, 404 if not in your company
GET /logs/export?format=csv|json&level=&module=&startDate=&endDate=   → file download
GET /logs/stream?level=&module=&startDate=&endDate=                  → application/x-ndjson, one LogEntry per line
```

| # | Task | UI status |
|---|---|---|
| 2.4.a | Logs list: level chip (colour from `levelColor`), module, message, time, request id; filters for level, module and date range; paging via `limit`/`offset` | |
| 2.4.b | Row detail drawer: `metadata` (method, route, status, stack) with copy buttons for the request id and stack | |
| 2.4.c | Export button → `/logs/export?format=csv` | |
| 2.4.d | Menu entry visible only with `logs:read` (in the permission manifest) | |

## 3. Behaviour changes and new error codes to handle

Show `error.message` from the response for these. It's written for end users.

| Endpoint | Status / code | When | UI status |
|---|---|---|---|
| `POST /attendance/check-in` | `422 DATE_OUT_OF_RANGE` | `date` is not today (±1 day). Past days go through regularization. | |
| `POST /attendance/regularization` | `409 DUPLICATE_REGULARIZATION` | A pending/approved request already covers that day | |
| `POST/PATCH /timesheets/entries` | `403 NOT_PROJECT_MEMBER`, `422 DAY_LIMIT_EXCEEDED` | Not on the project's member list; more than 24 h in a day | |
| `POST/PATCH /employees` | `422 INVALID_MANAGER`, `403 FORBIDDEN` | Manager from another company, self, or a reporting loop; non-super-admin creating a SUPER_ADMIN | |
| `POST /payroll/runs` | `422 VALIDATION_ERROR` | `employeeIds` on a REGULAR run. Use `OFF_CYCLE` to pay selected people | |
| `POST /settings/roles`, `POST /settings/roles/:key/users` | `403 FORBIDDEN`, `422 INVALID_USERS` | Granting a permission you don't hold; a user from another company | |
| `GET /leave/ledger?employeeId=` | `403 FORBIDDEN`, `404 NOT_FOUND` | Manager asking for someone outside their team; unknown employee | |
| `PATCH/DELETE /holidays/:id` | `404 NOT_FOUND` (was 400) | Unknown holiday | |
| `GET /payroll/employees/:id/payslips` (own) | — | An employee sees only APPROVED/PAID payslips. Draft/review runs no longer appear. Empty state should say "No published payslips yet." | |
| `POST /auth/login` | `202 { mfaRequired, challengeId }` | MFA on. Already handled. Note the status is **202**, not 200. | |

## 4. Already correct, no action needed

| Item | Why it's fine |
|---|---|
| Leave preview (`leave.api.ts` GET `/leave/requests/preview`) | The backend now serves GET too. |
| Optional holidays (`optional-selections.api.ts`) | Already sends `year`, which is now required. |
| Offboarded profile (`useEmployee.ts` passes `includeTerminated`) | Correct. HR/SA must keep sending it. |
| Email links `/set-password?token=` and `/reset-password?token=` | Pages exist. Invite and reset emails are verified end to end. The reset-link 500 was a backend bug, now fixed. |
| Department `depth` | Now correct from the API (it was always 0). |
| `/manager/*/decision` | The UI doesn't call these. They now share the main approval flow anyway. |

## 5. Questions for the UI team

- Is the permission manifest's `roles` field used when deciding menu visibility (`src/lib/permissions.ts`)? `/manager/*` routes are role-gated (`roles: ['MANAGER']`, approvals also HR/SA). Keys are **any-of**.
- Do you want a channel picker in the announcement composer now that channels can be created?
