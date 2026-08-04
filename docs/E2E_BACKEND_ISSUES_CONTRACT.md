# E2E_BACKEND_ISSUES_CONTRACT

> Generated from Playwright deep UI E2E against local FE:3001 → BE:4000 → Hostinger tunnel  
> Tool: Playwright Chromium + real screenshots  
> Sources: `docs/e2e-ui-screenshots/{hr-admin-deep,manager-deep,employee-deep,superadmin-deep,hr-admin,manager}/FINDINGS.md` (+ prior role-agent contract appends)

## HR_ADMIN

**Tester:** `hr@acme.test` (HR_ADMIN) · tenant `acme-corp-001` · 2026-08-02
**Evidence:** `docs/e2e-ui-screenshots/hr-admin-deep/` (511 PNGs + `FINDINGS.md`)
**Depth:** menus=17 tabs=37 clicks=391 modals=57 wizards=4 exports=4 details=61 nestDepth=2 actions=425

### ISSUE-HR-07
- **Where:** GET /attendance/summary vs records/today
- **Why:** Summary present=0 pct=0 endDate=2026-08-02T19:44:26.343Z while records/UI show attendance
- **Classification:** BACKEND
- **How to resolve:** End summary at end-of-tenant-local-day or inclusive month
- **Screenshot:** `docs/e2e-ui-screenshots/hr-admin-deep/511-attendance-be-probe-settled.png`
- **Network:** `summary present=0; records has PRESENT; today=PRESENT`

### ISSUE-HR-09
- **Where:** GET /attendance/today
- **Why:** PRESENT with duration=0 totalMinutes=undefined
- **Classification:** BACKEND
- **How to resolve:** Reject early check-out or mark incomplete/half-day
- **Screenshot:** `docs/e2e-ui-screenshots/hr-admin-deep/511-attendance-be-probe-settled.png`
- **Network:** `today duration=0`

### ISSUE-HR-10: Timesheets Utilization Export CSV → 400 INVALID_REPORT_TYPE
- **Where:** Reports → Timesheets Utilization → Export CSV (`/reports?report=timesheets/utilization`)
- **Why:** `POST /api/reports/export` → **400** `INVALID_REPORT_TYPE` / `Invalid reportType` — FE shows Export CSV but BE rejects `timesheets/utilization`
- **Classification:** BOTH (listed on both contracts) — confirm `hr-exports` FINDINGS `HR-EXPORT-reports-report-timesheets-utilization-export-csv`
- **How to resolve:** Register `timesheets/utilization` in BE export allow-list, or hide Export CSV until BE supports it
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/hr-exports/105-reports-report-timesheets-utilization-after-export-csv.png`
- **Network:** `400 POST /api/reports/export` body `{"code":"INVALID_REPORT_TYPE","message":"Invalid reportType"}`
- **Evidence:** `docs/e2e-ui-screenshots/confirm/hr-exports/FINDINGS.md` · matrix `docs/E2E_EXPORT_CONFIRM_MATRIX.md` `## HR_ADMIN`

> **Mutations (HR deep E2E):** Timesheets/Approvals:Approve; Shell:mark-all-read

## MANAGER

**Tester:** `aman@acme.test` (MANAGER) · tenant `acme-corp-001` · 2026-08-03  
**Evidence (deep):** `docs/e2e-ui-screenshots/manager-deep/` (**~491** PNGs + `FINDINGS.md`, `results-phase3.json`)  
**Evidence (shallow):** `docs/e2e-ui-screenshots/manager/` (94 PNGs + `FINDINGS.md`)  
**ID note:** Deep FINDINGS `M1` (+ borderline dept 403). `SELF_APPROVAL_FORBIDDEN` / `NOT_TEAM_APPROVER` are correct BE — FE `ISSUE-MGR-02` / `ISSUE-MGR-09`.

### ISSUE-MGR-01
- **Where:** Manager dashboard Present Today / Avg. Attendance vs week grid — `GET /api/attendance/team/weekly?weekStart=2026-08-03`
- **Why:** KPIs Present Today=**0**, Avg=**0%** while grid shows **P. Sharma = P** on Mon 3. Aggregation/timezone/`weekStart` inconsistency.
- **Classification:** BACKEND — deep FINDINGS `M1` (reconfirmed)
- **How to resolve:** Align KPI cards with week-grid source; clarify future-day “A” meaning.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/007-dashboard-zero-attendance-anomaly-observed.png`, `005-dashboard-land-view.png`
- **Network:** `200 GET /api/attendance/team/weekly?weekStart=2026-08-03`

### ISSUE-MGR-03
- **Where:** Departments → Ananya Joshi — `GET /api/employees/{id}?includeTerminated=true`
- **Why:** Deep nest click → **403**. BE over-restrict or FE offers out-of-scope rows. Borderline.
- **Classification:** BACKEND (authz/scope) — `ISSUE-MGR-DEEP-08`
- **How to resolve:** Allow MANAGER read for managed dept/team **or** filter non-scoped rows from dept UI.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/053-departments-n2-ananya-joshi-clicked.png`
- **Network:** `403 GET /api/employees/cmqjpydu9002gkpjdywx910uq?includeTerminated=true`

> **Mutations (MANAGER deep E2E):** Timesheet Approve (Priya / direct report) **SUCCESS**; non-direct Approve/Return → **403** `NOT_TEAM_APPROVER` (BE correct — FE `ISSUE-MGR-09`).  
> **Mutations (MANAGER shallow E2E):** Reg Deny/Approve **200**; Timesheet Approve (other) **200**; Timesheet Return (self) **403** `SELF_APPROVAL_FORBIDDEN` (BE correct — FE `ISSUE-MGR-02`).

## EMPLOYEE

**Tester:** `priya@acme.test` (EMPLOYEE) · tenant `acme-corp-001` · 2026-08-03  
**Evidence:** `docs/e2e-ui-screenshots/employee-deep/` (**201** PNGs + `FINDINGS.md`, `depth-stats.json`)  
**Depth:** menus 24 · tabs 31 · buttons 72 · dialogs 13 · nested layers 97 · leave types tried 5 · settings routes 29 · admin probes 13  
**ID note:** Mapped from employee-deep FINDINGS `C1` / `H3`. Comp Off **400** `INSUFFICIENT_BALANCE` (available 0) is correct BE guard. EL/CL **400** `NO_CHARGEABLE_DAYS` on weekend test dates (2026-11-14/15) is correct calendar guard (not a defect).

### ISSUE-EMP-01
- **Where:** `POST /api/v1/leave/requests` with leave type Annual Leave (`leaveTypeId: "AL"`) — Leave → New Request (all types nested)
- **Why:** `GET /leave/types` includes `{ id: "AL", name: "Annual Leave" }` but `GET /leave/balance` has **no AL row** (only `EL`/`SL`/`CL`/`CO`). Submit returns **400** `NO_LEAVE_BALANCE`. Same deep session: `SL` → **201** PENDING then withdraw **200**. Orphan type breaks type↔balance invariant.
- **Classification:** BACKEND (primary) — FINDINGS `C1`
- **How to resolve:** Seed `LeaveBalance` for AL **or** remove/disable orphan AL from `/leave/types`; ensure every active leave type has a balance row for the employee.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/049-leave-submit-annual-leave.png`, `048-leave-filled-annual-leave.png`
- **Network:** `POST /api/leave/requests` **400** `NO_LEAVE_BALANCE` (`leaveTypeId: "AL"`); `SL` → **201**; `GET /leave/types` includes AL; `GET /leave/balance` has no AL

### ISSUE-EMP-02
- **Where:** `GET /api/v1/leave/requests/preview` (called by FE New Leave Request dialog for every type)
- **Why:** Fastify returns **404** `Route GET:/api/v1/leave/requests/preview … not found`. Observed for `leaveTypeId` AL/SL/CO/EL/CL during deep nested leave submits. Preview is missing while UI depends on it.
- **Classification:** BACKEND — FINDINGS `H3`
- **How to resolve:** Implement `GET /leave/requests/preview` (chargeable days / balance preview) **or** remove FE calls until the route ships.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/049-leave-submit-annual-leave.png` … `057-leave-submit-casual-leave.png` (networks in `results.json`)
- **Network:** `404 GET /api/leave/requests/preview?leaveTypeId=AL|SL|CO|EL|CL&startDate=…&endDate=…` (direct BE probe same 404)

> **Mutations (EMPLOYEE deep E2E):** Leave SL create **201** + withdraw **200**; AL **400** `NO_LEAVE_BALANCE`; CO **400** `INSUFFICIENT_BALANCE`; Notifications mark-all-read **200**. Check-in/out not re-mutated (already completed same day). Timesheet Log time / payslip download did not complete POSTs (see FE contract).

## SUPER_ADMIN

> Updated 2026-08-02T20:04:36Z — full-depth UI E2E vs http://localhost:3001 / http://localhost:4000/api/v1
> Evidence: `docs/e2e-ui-screenshots/superadmin-deep/` (**831** PNGs + FINDINGS.md); shallow support `docs/e2e-ui-screenshots/superadmin/`
> Depth: menus **17** · controls **304** · maxDepth **4** · layers **92** · runner shots **372**
> Tester: `superadmin@acme.test` · tenant `acme-corp-001` · `employeeId: null`
> ID note: **ISSUE-SA-10** = previously tracked as **ISSUE-SA-04** (leave→Priya CRITICAL). Current SA-04 is leave-assignments 401.

### ISSUE-SA-10: Leave APIs return Priya Sharma data for SUPER_ADMIN (**CRITICAL**)
- Where: Leave → balances / My Requests
- Why: With `employeeId: null`, balance ids are prefixed `cmqjpyds7001kkpjdnlhjygrp-*` (Priya Sharma). UI shows her EL **574.8/576.8** and request history as “My Requests”.
- Classification: BACKEND (**CRITICAL** — cross-user data exposure)
- How to resolve: Never fall back to another employee when `employeeId` is null — return empty or `NO_EMPLOYEE_RECORD`
- Screenshot: docs/e2e-ui-screenshots/superadmin/51-leave.png; docs/e2e-ui-screenshots/superadmin-deep/095-leave-d0-my-requests.png
- Network: GET /leave/balance 200 (Priya-prefixed ids); GET /leave/requests 200; GET /auth/me employeeId null

### ISSUE-SA-02: Attendance today returns NO_EMPLOYEE_RECORD
- Where: Attendance / `/attendance`
- Why: GET /api/attendance/today → 400 `NO_EMPLOYEE_RECORD`. Contrast: /attendance/summary returns 200 + `noEmployeeRecord: true`.
- Classification: BACKEND
- How to resolve: BE return 200 empty + `noEmployeeRecord: true`; FE skip when `employeeId` is null
- Screenshot: docs/e2e-ui-screenshots/superadmin-deep/059-attendance-d0-request-regularization.png
- Network: GET /api/attendance/today 400

### ISSUE-SA-03: Leave preview route missing (404)
- Where: Leave request modal
- Why: GET /api/leave/requests/preview?... → 404 Not Found
- Classification: BOTH (listed on both contracts)
- How to resolve: Implement route or remove FE call
- Screenshot: docs/e2e-ui-screenshots/superadmin-deep/093-leave-d1-cancel.png
- Network: GET /api/leave/requests/preview 404

### ISSUE-SA-04: Leave assignments 401 during long Settings crawl
- Where: Settings → leave-assignments
- Why: GET /api/leave/assignments → 401 INVALID_TOKEN exp
- Classification: BACKEND (session TTL / refresh gap)
- How to resolve: Refresh access token before expiry; show re-auth UX instead of silent 401
- Screenshot: docs/e2e-ui-screenshots/superadmin-deep/347-settings-leave-policies-d0-assignments.png
- Network: GET /api/leave/assignments 401

## SA-GAP-MENUS

> Tester: `superadmin@acme.test` (SUPER_ADMIN) · tenant `acme-corp-001` · 2026-08-03
> Evidence: `docs/e2e-ui-screenshots/confirm/sa-gap-menus/` (**368** PNGs + FINDINGS.md)
> Depth: menus=6 settingsSubs=18 clicks=386 maxDepth=3
> Scope: Recruitment · Performance · Assets · Announcements · Permissions · Settings

_No NEW backend issues in this confirm gap-fill run._

### SA-GAP-MENUS settings-resume 2026-08-03

> Evidence: `docs/e2e-ui-screenshots/confirm/sa-gap-menus/` (**391** PNGs + FINDINGS.md)
> Resumed settings: authentication, sessions, audit-log, email-templates, notifications, integration-email, integration-storage, integration-webhooks, billing-plan, billing-invoices, roles-permissions
> Totals: clicks=397 shots=391 be=0 fe=4 both=0

_No NEW issues beyond GAP-01..03 in settings resume._


## NOTIFICATIONS

> Cross-role REST stress (append-only) · 2026-08-03  
> Target: `http://localhost:4000/api/v1` · tenant `acme-corp-001` · parallel ×20 · wall ~89s  
> Roles: SUPER_ADMIN / HR_ADMIN / MANAGER / EMPLOYEE (`superadmin@acme.test`, `hr@acme.test`, `aman@acme.test`, `priya@acme.test`)  
> Evidence: `docs/e2e-ui-screenshots/stress/notifications-api/RESULTS.md` (+ `raw.json`, `_run.log`)  
> Scale: ~20k notifications/user (inventory totals ≈20005–20020)  
> **IDOR / isolation (good):** cross-user `PATCH|POST /notifications/:foreignId/read` → **404×18** per role (72 total); list ID overlap none; missing/bad auth → **401**. No IDOR observed.

### ISSUE-NOTIF-01: Negative page → 500 (**HIGH**)
- **Where:** `GET /api/v1/notifications?page=-1`
- **Why:** Negative `page` reaches Prisma as negative `skip` → **500** `INTERNAL_SERVER_ERROR` (all 4 roles). Query schema lacks `minimum:1`; controller `page ?` allows negatives after Fastify coerce.
- **Classification:** BACKEND — RESULTS `NOTIF-BE-01` / probe `list-page-neg`
- **How to resolve:** Add `minimum:1` (and max) on `page`/`limit` in schema; clamp in controller; return **400** `VALIDATION_ERROR` before repo.
- **Evidence:** `docs/e2e-ui-screenshots/stress/notifications-api/RESULTS.md` (edge tables ×4 roles; Extra probes)
- **Network:** `GET /api/v1/notifications?page=-1` → **500** `INTERNAL_SERVER_ERROR` (SUPER_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE)

### ISSUE-NOTIF-02: Invalid `since` → 500 (**HIGH**)
- **Where:** `GET /api/v1/notifications?since=not-a-date` (also `since=2024-13-40`)
- **Why:** Invalid `since` → `new Date(since)` Invalid Date → Prisma throws → **500**. Schema types `since` as plain `string` with no `format:date-time`.
- **Classification:** BACKEND — RESULTS `NOTIF-BE-02` / probe `list-since-invalid`
- **How to resolve:** Validate ISO date-time in schema or controller; return **400** on Invalid Date before repo call.
- **Evidence:** `docs/e2e-ui-screenshots/stress/notifications-api/RESULTS.md` (edge ×4 roles + Extra probes `since=2024-13-40`)
- **Network:** `GET /api/v1/notifications?since=not-a-date` → **500** `INTERNAL_SERVER_ERROR`; `?since=2024-13-40` → **500**

### ISSUE-NOTIF-03: Unbounded `limit=5000` (~1MB) (**HIGH**)
- **Where:** `GET /api/v1/notifications?limit=5000`
- **Why:** No max `limit` — returns **5000** rows (~**1.07MB** JSON). Concurrent ×4 ≈ **4.3MB**. DoS / memory pressure (Hostinger tunnel + Node).
- **Classification:** BACKEND — RESULTS `NOTIF-BE-03` / probe `list-limit-huge` + Extra `limit=5000 ×4`
- **How to resolve:** Clamp `limit` to e.g. 100 (or 200); reject above with **400**.
- **Evidence:** `docs/e2e-ui-screenshots/stress/notifications-api/RESULTS.md` (`list-limit-huge` ×4 roles; Extra probes `payload_burst_limit_5000_x4`)
- **Network:** `GET /api/v1/notifications?limit=5000` → **200** `n=5000` `lim=5000` (~1.07MB); ×4 concurrent **200×4** wall ~612ms

### MEDIUM / LOW (brief — same evidence)

| ID | Sev | Where | Why | Network / note |
|---|---|---|---|---|
| ISSUE-NOTIF-04 | MED | `?limit=-1` / `-5` | Negative limit accepted; `pages` negative (`pages=-20005`) | **200** `pages=-20005` n=1 — RESULTS `NOTIF-BE-04` |
| ISSUE-NOTIF-05 | MED | `?limit=0` | Falsy coerce → silent default `limit=20` | **200** `pagination.limit=20` — `NOTIF-BE-05` |
| ISSUE-NOTIF-06 | MED | `?page=0` | Falsy coerce → treated as page 1 | **200** `pagination.page=1` — `NOTIF-BE-06` |
| ISSUE-NOTIF-07 | MED | `markAllRead` vs `ACTIVE_FILTER` | Updates expired unread; list/unread-count exclude them | repo `markAllRead` no ACTIVE_FILTER — `NOTIF-BE-07` |
| ISSUE-NOTIF-08 | MED | ~20k notifs/user | List×20 p50 ~700–1500ms; retention/TTL unused on request path | inventory totals; burst latencies — `NOTIF-BE-08` |
| ISSUE-NOTIF-09 | LOW | `?unreadOnly=1\|TRUE\|yes` | Strict boolean schema → 422; FE truthy strings break | **422** `VALIDATION_ERROR` — `NOTIF-BE-09` |

> **PASS notes:** Auth negatives **401**; mark-read / read-all PATCH+POST aliases OK under burst; race list×10 + read-all×10 all **200**, post-race unread-count=0. See RESULTS `NOTIF-OK-IDOR`, `NOTIF-OK-ALIASES-RACE`.

### SSE / Redis fan-out stress (append-only) · 2026-08-03

> Evidence: `docs/e2e-ui-screenshots/stress/notifications-sse/RESULTS.md` (+ `raw.json`, `09-deep-probes.json`, `_stress_notif_sse.mjs`)  
> Target: `http://localhost:4000` · Redis `redis://127.0.0.1:16379` · channel `ems:sse`  
> **Redis fan-out WORKS (positive):** PING/PONG; boot log `[sse] cross-instance fan-out enabled`; leave create → manager/HR/SA SSE HIT; multi-tab approve delivery; burst×10 reconnect balanced; no double-emit on single PUBLISH. Verdict PARTIAL PASS — session-revoke gap below.

### ISSUE-SSE-30 / ISSUE-NOTIF-10: SSE accepts JWT after `logout-all` (**CRITICAL**)
- **Where:** `GET /api/v1/notifications/stream` — `notifications.routes.js` uses `verifyToken()` only; skips `authenticate()` session lookup (`sessionId` + `revokedAt`)
- **Why:** After `POST /auth/logout-all`, REST `/notifications` → **401** `Session revoked or expired`; same JWT on SSE → **200** `: connected`
- **Classification:** BACKEND — RESULTS `ISSUE-SSE-30` / auth edge + deep probes
- **How to resolve:** Reuse session checks from `authenticate.js` (require `sessionId`, load Session, reject if revoked)
- **Evidence:** `docs/e2e-ui-screenshots/stress/notifications-sse/RESULTS.md` §6 Auth edge · `07-auth-edge.json` · `09-deep-probes.json`
- **Network:** `POST /auth/logout-all` then SSE stream → **200** connected; REST `GET /notifications` → **401**

### ISSUE-SSE-31 / ISSUE-NOTIF-11: SSE payload shape ≠ REST (**HIGH**)
- **Where:** `notifier.js` `emitToUser(..., { message, metadata })` vs `notifications.service.js` `mapNotification` (`body`, `isRead`, `entityType`, …)
- **Why:** REST keys `id,type,title,body,entityType,entityId,actionUrl,isRead,createdAt`; SSE keys `id,type,title,message,createdAt,metadata` — FE cannot reuse list DTO
- **Classification:** BACKEND — RESULTS `ISSUE-SSE-31` / deep probes shape
- **How to resolve:** Align SSE emit payload with `mapNotification` (or document + FE adapter contract)
- **Evidence:** `docs/e2e-ui-screenshots/stress/notifications-sse/RESULTS.md` §7 Deep probes · `09-deep-probes.json`
- **Network:** Compare REST list item vs SSE `notification` event data fields

### ISSUE-SSE-32 / ISSUE-NOTIF-12: SSE `writeHead` missing CORS ACAO (**HIGH**)
- **Where:** `reply.raw.writeHead(200, { Content-Type: text/event-stream, ... })` bypasses `@fastify/cors` onSend headers
- **Why:** GET stream with `Origin: http://localhost:3001` has **no** `Access-Control-Allow-Origin`; OPTIONS preflight **does** return ACAO — breaks direct browser → `:4000` EventSource / non-BFF clients
- **Classification:** BACKEND — RESULTS `ISSUE-SSE-32` / CORS probe
- **How to resolve:** Set ACAO (and credentials headers if needed) on the raw SSE response, or route SSE through CORS-aware reply path
- **Evidence:** `docs/e2e-ui-screenshots/stress/notifications-sse/RESULTS.md` §7 · `09-deep-probes.json`
- **Network:** GET stream response headers omit ACAO; OPTIONS includes `access-control-allow-origin: http://localhost:3001`

### SSE MEDIUM / LOW (brief — same evidence)

| ID | Sev | Where | Why | Network / note |
|---|---|---|---|---|
| ISSUE-SSE-33 / ISSUE-NOTIF-13 | MED | SSE 401 body | Flat `{error,message}` ≠ REST `{success:false,error:{code,message,details,requestId}}` | RESULTS `ISSUE-SSE-33` |
| ISSUE-SSE-29 / ISSUE-NOTIF-14 | MED | `?token=` query | Required for native EventSource; leaks via logs/proxies/Referer | Bearer + cookie also accepted — `ISSUE-SSE-29` |
| ISSUE-SSE-34 / ISSUE-NOTIF-15 | MED | Redis `NUMSUB ems:sse`=2 | Local BE + peer on Hostinger Redis; inventory flag (local dup probe=1) | RESULTS `ISSUE-SSE-34` |
| ISSUE-SSE-19 / ISSUE-NOTIF-16 | LOW | mark-read → no SSE | `PATCH /notifications/:id/read` **200**, 0 stream events; tabs must poll unread-count | RESULTS `ISSUE-SSE-19` |

> **SSE PASS notes:** Redis fan-out, multi-user leave_requested, multi-tab leave_approved, burst reconnect, missing/bad/expired token → clean **401**. See RESULTS “What worked”.
