# HR_ADMIN Deep UI E2E Findings

> Date: 2026-08-03  
> Role: `HR_ADMIN` (`hr@acme.test` / `Password123!` / tenant `acme-corp-001`)  
> UI: `http://localhost:3001` · BE: `http://localhost:4000` (Hostinger DB/Redis tunnel)  
> Tooling: Playwright Chromium · MSW off  
> Screenshots: `docs/e2e-ui-screenshots/hr-admin/` (185 PNGs)  
> Runner: `tests/e2e/hr-admin-deep-ui.mjs` + supplemental reports pass  
> **No Render deploy. No git commit.**

## Summary

| Metric | Value |
|--------|------:|
| Menus tested | **17** |
| Screenshots | **185** |
| Backend issues | **2** (`ISSUE-HR-05`, `ISSUE-HR-09`) |
| Frontend issues | **6** (`ISSUE-HR-01`…`04`, `06`, `07`) |
| Approve/Deny data changes | **None** (buttons photographed only when visible; Leave Approvals had 0) |
| Other mutations | **Yes — Attendance Check In + Check Out** clicked during deep pass (created zero-duration record for 2026-08-03) |

## Menus tested

Dashboard · Employees · Departments · Attendance · Timesheets · Leave · Holidays · Payroll · Payout methods · Reports (+ 15 report routes) · Analytics · Permissions · Settings (27 sub-routes) · Recruitment · Performance · Assets · Announcements · Shell notifications bell

## Top critical bugs

1. **Permissions in HR sidebar → Access restricted** (FRONTEND) — dead-end nav item; should be SUPER_ADMIN-only per role-nav contract.
2. **Attendance summary excludes “today”** (BACKEND) — `GET /attendance/summary` period `endDate` is wall-clock `now` (UTC), so today’s `attendanceDate` (start-of-day UTC) is outside the window; cards show zeros while records/table show today’s row.
3. **Attendance status UI ≠ API** (FRONTEND) — API `status: PRESENT` with `totalMinutes: 0`; UI table shows **Half Day** and **Attendance % 50%** via client classifier.
4. **Performance duplicate React keys** (FRONTEND) — 20–40 console warnings on Reviews/Goals.
5. **Login page anonymous 401 noise** (FRONTEND) — `/api/auth/me` + `/api/auth/refresh` fired before credentials.

---

## Issues (consolidated)

### ISSUE-HR-01 — Login bootstrap 401s
- **Where:** `/login` page load  
- **Why:** Anonymous session probes `GET /api/auth/me` → 401 `UNAUTHORIZED` and `POST /api/auth/refresh` → 401 `REFRESH_TOKEN_MISSING` before sign-in.  
- **Classification:** FRONTEND  
- **How to resolve:** Skip me/refresh on public auth routes, or treat expected 401 as silent.  
- **Screenshot:** `01-login-submit-ok.png`  
- **Network:** `401 GET /api/auth/me` · `401 POST /api/auth/refresh`

### ISSUE-HR-02 — Permissions nav visible to HR_ADMIN
- **Where:** Sidebar → Permissions (`/permissions`)  
- **Why:** HR sees Permissions; page shows “Access restricted … Super Admins.”  
- **Classification:** FRONTEND  
- **How to resolve:** Hide Permissions in `AppShell` `NAV_ITEMS` unless `memberType === SUPER_ADMIN` (keep deep-link Access Restricted page).  
- **Screenshot:** `79-permissions-land-view.png`, `80-permissions-access-state-restricted.png`  
- **Network:** no failing API (client role gate)

### ISSUE-HR-03 — SA-only Settings deep-links show Access restricted
- **Where:** Direct goto `/settings/authentication`, `integration-*`, `billing-*`, `branding`  
- **Why:** SettingsNav correctly hides these for HR, but hard navigation shows Access restricted instead of redirecting to first allowed panel.  
- **Classification:** FRONTEND  
- **How to resolve:** On unauthorized settings slug, redirect via `firstAccessibleSettingsPath(role)`.  
- **Screenshot:** `98-settings-settings-authentication-view.png` (also 104–109)  
- **Network:** n/a (client gate); note BE `GET /settings/security/auth` can still 200 for HR in some cases — FE gate is stricter.

### ISSUE-HR-04 — Performance duplicate React keys
- **Where:** `/performance` Reviews + Goals tabs  
- **Why:** Console: “Encountered two children with the same key” (40 then 20 warnings).  
- **Classification:** FRONTEND  
- **How to resolve:** Use unique keys (e.g. reviewId / goalId + employeeId), never raw employeeId alone if duplicated.  
- **Screenshot:** `145-performance-land-view.png`, `147-performance-tab-goals-view.png`  
- **Network:** n/a

### ISSUE-HR-05 — Attendance summary period excludes today (timezone)
- **Where:** `/attendance` summary cards vs table  
- **Why:** After Check In/Out, `GET /attendance/records?month=2026-08` returns today’s PRESENT row, but `GET /attendance/summary` returns all zeros with `period.endDate` ≈ request `now` (UTC). Today’s `attendanceDate` midnight UTC is after that end → excluded. UI cards Present/Absent/… = 0 while table has a row.  
- **Classification:** BACKEND  
- **How to resolve:** End summary period at end-of-tenant-local-day (or inclusive calendar month), not raw `new Date()` mid-day UTC.  
- **Screenshot:** `183-attendance-after-settle-view.png`, `24-attendance-land-view.png`  
- **Network:** `200 GET /attendance/summary` body `present:0,…,attendancePercentage:0` while `200 GET /attendance/records?month=2026-08` has 1 PRESENT record · `200 GET /attendance/today` status PRESENT

### ISSUE-HR-06 — Attendance UI status vs API status mismatch
- **Where:** Attendance Table view  
- **Why:** API record `status: "PRESENT"`, `totalMinutes: 0`; UI shows **Half Day** and Attendance % **50%** (client `classifyDay` / `classifyMonth`).  
- **Classification:** FRONTEND  
- **How to resolve:** Prefer server status for display, or align client thresholds with BE and surface Half Day in summary cards when classifier overrides.  
- **Screenshot:** `183-attendance-after-settle-view.png`  
- **Network:** `200 GET /attendance/records` status PRESENT vs UI Half Day

### ISSUE-HR-07 — Reports secondary nav not real hrefs
- **Where:** `/reports` left report list  
- **Why:** Playwright only discovered `a[href="/reports"]`; report switches are not `<a href="/reports/...">`, so deep linking/share/automation is harder (routes themselves work when navigated).  
- **Classification:** FRONTEND (UX/a11y)  
- **How to resolve:** Use Next `<Link href="/reports/...">` for each report item.  
- **Screenshot:** `165-reports-reports-view.png`  
- **Network:** all probed report routes returned OK (no 4xx/5xx)

### ISSUE-HR-09 — Zero-duration check-out accepted
- **Where:** Attendance Check In / Check Out  
- **Why:** Deep pass clicked Check In then Check Out within ~2s; BE stored `totalMinutes: 0` / `duration: 0` with `status: PRESENT`.  
- **Classification:** BACKEND (product rule gap) + **test mutation**  
- **How to resolve:** Reject early check-out or mark incomplete/half-day server-side; for QA, avoid auto-clicking Check Out or clean the 2026-08-03 HR row.  
- **Screenshot:** `27-attendance-check-in-clicked.png`, `28-attendance-check-out-clicked.png`, `183-attendance-after-settle-view.png`  
- **Network:** `200` check-in/out; `GET /attendance/today` duration 0

---

## Explicitly not bugs

| Observation | Reason |
|-------------|--------|
| Payroll cards Total Paid ₹0 / Employees 0 while table lists CANCELLED runs | FE aggregates **paid** runs only (`PayrollRunsTab.tsx`) — correct |
| Leave Approvals: no Approve/Deny buttons | Empty pending queue for HR at test time |
| Settings SA pages hidden in SettingsNav for HR | Working as designed |

## Screenshot index (selected)

| # | File | Meaning |
|---|------|---------|
| 01 | `01-login-submit-ok.png` | Login success |
| 02 | `02-shell-sidebar-visible.png` | Full HR sidebar |
| 03 | `03-dashboard-land-view.png` | Dashboard |
| 11 | `11-employees-land-view.png` | Employees |
| 18 | `18-departments-land-view.png` | Departments |
| 24 | `24-attendance-land-view.png` | Attendance land |
| 34 | `34-timesheets-land-view.png` | Timesheets |
| 44 | `44-leave-land-view.png` | Leave |
| 51 | `51-holidays-land-view.png` | Holidays |
| 60 | `60-payroll-land-view.png` | Payroll |
| 64 | `64-payout-methods-land-view.png` | Payout methods |
| 70 | `70-reports-land-view.png` | Reports |
| 73 | `73-analytics-land-view.png` | Analytics |
| 79 | `79-permissions-land-view.png` | Permissions restricted |
| 81+ | `81-settings-*` … `139-*` | Settings sweep |
| 140+ | recruitment / performance / assets / announcements | Module pages |
| 165–180 | reports subroutes | Supplemental report coverage |
| 183 | `183-attendance-after-settle-view.png` | Summary vs table evidence |
| 184 | `184-analytics-settle-view.png` | Analytics settled |
| 185 | `185-payroll-row-open-view.png` | Payroll row interaction |

Full machine log: `results.json`, `supplemental.json`.
