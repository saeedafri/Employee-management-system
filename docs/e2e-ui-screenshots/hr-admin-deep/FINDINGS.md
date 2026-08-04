# HR_ADMIN Full-Depth Nested UI E2E Findings

- Generated: 2026-08-02T19:44:55.405Z
- Role: `HR_ADMIN` (`hr@acme.test` / `Password123!` / tenant `acme-corp-001`)
- UI: `http://localhost:3001` · BE: `http://localhost:4000` (Hostinger)
- Tool: Playwright Chromium · MSW off
- Screenshots: `docs/e2e-ui-screenshots/hr-admin-deep/`
- Runners: `_deep_e2e_hr.mjs` (pass1) + `_deep_e2e_hr_resume2.mjs` (settings/remainder)
- **No Render deploy. No git commit.**

## Depth stats

| Metric | Value |
|--------|------:|
| Menus tested | **17** (full sidebar) |
| Tabs clicked | **37** |
| Buttons/actions clicked | **391** |
| Modals/drawers entered | **57** |
| Nested wizard steps | **4** |
| Row actions | **3** |
| Export actions | **4** |
| Detail pages | **61** |
| Max nest depth | **2** |
| Screenshots (PNG) | **511** |
| Action log entries | **425** |
| Issues BACKEND | **2** |
| Issues FRONTEND | **7** |
| Download events | **2** |
| Mutations noted | **2** |

## Critical bugs

1. **Permissions in HR sidebar → Access restricted** (FRONTEND) — dead-end nav; SUPER_ADMIN-only.
2. **Attendance summary excludes “today”** (BACKEND) — `period.endDate` is wall-clock `now` UTC; cards show zeros while records/today show PRESENT.
3. **Attendance UI status ≠ API** (FRONTEND) — API `PRESENT` (0 minutes) rendered as **Half Day**.
4. **Zero-duration check-out accepted** (BACKEND) — prior/deep attendance left `duration: 0` PRESENT.
5. **SA-only Settings deep-links Access restricted** (FRONTEND) — no redirect to first allowed panel.
6. **Performance duplicate React keys** (FRONTEND).

## Mutations

- `Timesheets/Approvals` → **Approve** (`067-timesheets-approvals-approve.png`)
- `Shell` → **mark-all-read**

> Dashboard Approve/Deny: no pending leave queue buttons visible at test time (not clicked). Timesheet Approve **was** clicked. Shell mark-all-read clicked. Check-in/out not re-clicked in resume (prior zero-duration row still present — see BE probe).

## Coverage

- Sidebar parents: Dashboard, Employees, Departments, Attendance, Timesheets (all tabs), Leave (tabs), Holidays, Payroll (+ my-payslips/migration/global + run detail tabs), Payout (+ approvals), Reports (**all 15 REPORT_NAV types**), Analytics, Permissions, Settings (**28 sub-routes**), Recruitment, Performance, Assets, Announcements
- Nested: modals/drawers (57), Add Employee wizard Next, row actions, export menu attempts, notifications bell
- Dashboard: Add Employee + range chips; Approve/Deny absent (empty queue)

## Issues

### ISSUE-HR-01: Login bootstrap 401s (me/refresh)
- **Where:** /login page bootstrap
- **Why:** Before credentials, UI calls GET /api/auth/me and POST /api/auth/refresh producing 401 UNAUTHORIZED / REFRESH_TOKEN_MISSING noise.
- **Classification:** **FRONTEND**
- **How to resolve:** Skip me/refresh on public auth routes, or treat expected anonymous 401 as silent.
- **Screenshot:** `001-login-form.png`
- **Network:** `401 GET /api/auth/me · 401 POST /api/auth/refresh`

### ISSUE-HR-02: Permissions nav visible to HR_ADMIN
- **Where:** Sidebar → Permissions (/permissions)
- **Why:** HR sees Permissions; page shows Access restricted (Super Admins only). Dead-end nav.
- **Classification:** **FRONTEND**
- **How to resolve:** Hide Permissions unless memberType === 'SUPER_ADMIN'; keep Access Restricted for deep links.
- **Screenshot:** `383-permissions.png`
- **Network:** `n/a (client role gate)`

### ISSUE-HR-03: SA-only Settings deep-links show Access restricted
- **Where:** /settings/authentication, integration-*, billing-*, branding, pay/country-bank-schemas
- **Why:** SettingsNav hides these for HR, but hard navigation shows Access restricted instead of redirecting to first allowed panel.
- **Classification:** **FRONTEND**
- **How to resolve:** On unauthorized settings slug, redirect via firstAccessibleSettingsPath(role).
- **Screenshot:** `446-settings-authentication-restricted.png`
- **Network:** `n/a (client gate)`

### ISSUE-HR-04: Reports secondary nav not real hrefs
- **Where:** /reports left nav
- **Why:** No <a href="/reports/..."> discovered; report switches are not shareable links
- **Classification:** **FRONTEND**
- **How to resolve:** Use Next <Link href="/reports/<slug>"> for each report item
- **Screenshot:** `353-reports.png`
- **Network:** `n/a`

### ISSUE-HR-05: Performance: React duplicate key
- **Where:** Performance
- **Why:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsu
- **Classification:** **FRONTEND**
- **How to resolve:** Fix FE console/key issues
- **Screenshot:** `494-performance-tab-reviews.png`
- **Network:** `n/a (console)`

### ISSUE-HR-06: Reports path /reports/workforce/headcount intermittent Next 404
- **Where:** Reports/export-retry / open
- **Why:** Hard goto /reports/workforce/headcount returned Next.js HTML 404 during export-retry (not API JSON). Report shell otherwise worked in pass1 for all 15 types.
- **Classification:** **FRONTEND**
- **How to resolve:** Ensure App Router page exists for REPORT_NAV slugs (or redirect /reports/<group>/<slug> → working reports shell). Pass1 hard-gotos succeeded earlier same day — verify soft-nav vs hard-nav parity.
- **Screenshot:** `509-reports-export-retry.png`
- **Network:** `GET http://localhost:3001/reports/workforce/headcount 404`

### ISSUE-HR-07: Attendance summary period excludes today (timezone)
- **Where:** GET /attendance/summary vs records/today
- **Why:** Summary present=0 pct=0 endDate=2026-08-02T19:44:26.343Z while records/UI show attendance
- **Classification:** **BACKEND**
- **How to resolve:** End summary at end-of-tenant-local-day or inclusive month
- **Screenshot:** `511-attendance-be-probe-settled.png`
- **Network:** `summary present=0; records has PRESENT; today=PRESENT`

### ISSUE-HR-08: Attendance UI status vs API PRESENT mismatch
- **Where:** /attendance Table
- **Why:** API PRESENT but UI Half Day via client classifier
- **Classification:** **FRONTEND**
- **How to resolve:** Prefer server status or align classifyDay with BE
- **Screenshot:** `511-attendance-be-probe-settled.png`
- **Network:** `GET /attendance/records → PRESENT vs UI Half Day`

### ISSUE-HR-09: Zero-duration check-out accepted as PRESENT
- **Where:** GET /attendance/today
- **Why:** PRESENT with duration=0 totalMinutes=undefined
- **Classification:** **BACKEND**
- **How to resolve:** Reject early check-out or mark incomplete/half-day
- **Screenshot:** `511-attendance-be-probe-settled.png`
- **Network:** `today duration=0`

## Explicitly not product bugs

| Observation | Reason |
|-------------|--------|
| Settings sessions timeout mid-resume | Harness browser recycle / session drop; recovered with re-login |
| Payroll Total Paid ₹0 with CANCELLED runs | FE aggregates paid runs only — correct |
