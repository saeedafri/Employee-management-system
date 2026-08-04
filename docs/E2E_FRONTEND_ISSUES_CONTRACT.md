# E2E_FRONTEND_ISSUES_CONTRACT

> Generated from Playwright deep UI E2E against local FE:3001 → BE:4000 → Hostinger tunnel  
> Tool: Playwright Chromium + real screenshots · MSW off  
> Sources: `docs/e2e-ui-screenshots/{hr-admin-deep,manager-deep,employee-deep,superadmin-deep,hr-admin,manager}/FINDINGS.md` (+ prior role-agent contract appends)  
> Related: `docs/UI_CONTRACT_role_nav_no_employee_2026-07-19.md`

## HR_ADMIN

**Tester:** `hr@acme.test` (HR_ADMIN) · tenant `acme-corp-001` · 2026-08-02
**Evidence:** `docs/e2e-ui-screenshots/hr-admin-deep/` (511 PNGs + `FINDINGS.md`)
**Depth:** menus=17 tabs=37 clicks=391 modals=57 wizards=4 exports=4 details=61 nestDepth=2 actions=425

### ISSUE-HR-01
- **Where:** /login page bootstrap
- **Why:** Before credentials, UI calls GET /api/auth/me and POST /api/auth/refresh producing 401 UNAUTHORIZED / REFRESH_TOKEN_MISSING noise.
- **Classification:** FRONTEND
- **How to resolve:** Skip me/refresh on public auth routes, or treat expected anonymous 401 as silent.
- **Screenshot:** `docs/e2e-ui-screenshots/hr-admin-deep/001-login-form.png`
- **Network:** `401 GET /api/auth/me · 401 POST /api/auth/refresh`

### ISSUE-HR-02
- **Where:** Sidebar → Permissions (/permissions)
- **Why:** HR sees Permissions; page shows Access restricted (Super Admins only). Dead-end nav.
- **Classification:** FRONTEND
- **How to resolve:** Hide Permissions unless memberType === 'SUPER_ADMIN'; keep Access Restricted for deep links.
- **Screenshot:** `docs/e2e-ui-screenshots/hr-admin-deep/383-permissions.png`
- **Network:** `n/a (client role gate)`

### ISSUE-HR-03
- **Where:** /settings/authentication, integration-*, billing-*, branding, pay/country-bank-schemas
- **Why:** SettingsNav hides these for HR, but hard navigation shows Access restricted instead of redirecting to first allowed panel.
- **Classification:** FRONTEND
- **How to resolve:** On unauthorized settings slug, redirect via firstAccessibleSettingsPath(role).
- **Screenshot:** `docs/e2e-ui-screenshots/hr-admin-deep/446-settings-authentication-restricted.png`
- **Network:** `n/a (client gate)`

### ISSUE-HR-04
- **Where:** /reports left nav
- **Why:** No <a href="/reports/..."> discovered; report switches are not shareable links
- **Classification:** FRONTEND
- **How to resolve:** Use Next <Link href="/reports/<slug>"> for each report item
- **Screenshot:** `docs/e2e-ui-screenshots/hr-admin-deep/353-reports.png`
- **Network:** `n/a`

### ISSUE-HR-05
- **Where:** Performance
- **Why:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsu
- **Classification:** FRONTEND
- **How to resolve:** Fix FE console/key issues
- **Screenshot:** `docs/e2e-ui-screenshots/hr-admin-deep/494-performance-tab-reviews.png`
- **Network:** `n/a (console)`

### ISSUE-HR-06
- **Where:** Reports/export-retry / open
- **Why:** Hard goto /reports/workforce/headcount returned Next.js HTML 404 during export-retry (not API JSON). Report shell otherwise worked in pass1 for all 15 types.
- **Classification:** FRONTEND
- **How to resolve:** Ensure App Router page exists for REPORT_NAV slugs (or redirect /reports/<group>/<slug> → working reports shell). Pass1 hard-gotos succeeded earlier same day — verify soft-nav vs hard-nav parity.
- **Screenshot:** `docs/e2e-ui-screenshots/hr-admin-deep/509-reports-export-retry.png`
- **Network:** `GET http://localhost:3001/reports/workforce/headcount 404`

### ISSUE-HR-08
- **Where:** /attendance Table
- **Why:** API PRESENT but UI Half Day via client classifier
- **Classification:** FRONTEND
- **How to resolve:** Prefer server status or align classifyDay with BE
- **Screenshot:** `docs/e2e-ui-screenshots/hr-admin-deep/511-attendance-be-probe-settled.png`
- **Network:** `GET /attendance/records → PRESENT vs UI Half Day`

### ISSUE-HR-10: Timesheets Utilization Export CSV → 400 INVALID_REPORT_TYPE
- **Where:** Reports → Timesheets Utilization → Export CSV (`/reports?report=timesheets/utilization`)
- **Why:** FE exposes Export CSV for `timesheets/utilization`; BE rejects with **400** `INVALID_REPORT_TYPE` — no download
- **Classification:** BOTH (listed on both contracts) — confirm `hr-exports` FINDINGS `HR-EXPORT-reports-report-timesheets-utilization-export-csv`
- **How to resolve:** Hide Export CSV until BE supports the type, or align FE reportType with BE allow-list after BE registers it
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/hr-exports/105-reports-report-timesheets-utilization-after-export-csv.png`
- **Network:** `400 POST /api/reports/export` body `{"code":"INVALID_REPORT_TYPE","message":"Invalid reportType"}`
- **Evidence:** `docs/e2e-ui-screenshots/confirm/hr-exports/FINDINGS.md` · matrix `docs/E2E_EXPORT_CONFIRM_MATRIX.md` `## HR_ADMIN`

> **Mutations (HR deep E2E):** Timesheets/Approvals:Approve; Shell:mark-all-read

> **Notifications note (2026-08-03):** Badge↔`unread-count` mismatch **not observed for HR_ADMIN** (badge 3 = API 3). See **ISSUE-MGR-15** — MANAGER-only repro; same list-derived badge pattern is latent for all roles.

## MANAGER

**Tester:** `aman@acme.test` (MANAGER) · tenant `acme-corp-001` · 2026-08-03  
**Evidence (deep):** `docs/e2e-ui-screenshots/manager-deep/` (**~491** PNGs + `FINDINGS.md`, `results-phase3.json`, `results-spotcheck.json`, `results-gapfill.json`)  
**Evidence (shallow cross-ref):** `docs/e2e-ui-screenshots/manager/` (94 PNGs + `FINDINGS.md`) — own-row `SELF_APPROVAL_FORBIDDEN`  
**Depth:** nest max 4 · phase-3 adminDeny=42 · hard LEAK `/payroll/runs` OPEN · gap-fill confirmed `NOT_TEAM_APPROVER`  
**Nav source:** `ems-frontend/src/shared/layouts/AppShell.tsx` — `NAV_ITEMS` (no role filter)  
**ID note:** Deep FINDINGS `C1`/`C2`/`H1`–`H6`/`M2`–`M4`. CRITICAL self-approval kept as `ISSUE-MGR-02` (shallow). Deep non-direct actions `ISSUE-MGR-09`. Prior `03`–`08` retained; deep adds `10`–`13`. Notif stress adds `15` (`ISSUE-MGR-NOTIF-01`).

### ISSUE-MGR-02
- **Where:** Timesheets → Approvals — Approve/Return on manager’s **own** rows (`aman@acme.test` / Aman Kumar)
- **Why:** Approvals lists Aman Kumar with Approve + Return; Return modal opens; API **403** `SELF_APPROVAL_FORBIDDEN` (“You cannot approve or reject your own request”).
- **Classification:** FRONTEND (primary) — BE correct — deep FINDINGS `C1` (shallow evidence; deep gap-fill: own rows absent from queue)
- **How to resolve:** Hide Approve/Return when `employeeId === current user`; filter own submissions out of Approvals queue.
- **Screenshot:** `docs/e2e-ui-screenshots/manager/30-timesheets-approvals-view.png`, `69-timesheet-return-modal.png`, `70-timesheet-return-result.png`
- **Network:** `POST /api/timesheets/{id}/reject|approve` → **403** `SELF_APPROVAL_FORBIDDEN` (id `cmr4fpp2m006ggrlntoghkxu0`)
- **Note:** CRITICAL kept from same-day shallow. Not re-queued in manager-deep.

### ISSUE-MGR-09
- **Where:** Timesheets → Approvals — Approve/Return on **non-direct reports** (e.g. HR Admin)
- **Why:** Approvals exposes Approve/Return outside team; Return modal opens; API **403** `NOT_TEAM_APPROVER`. Direct-report approve (Priya Sharma) works.
- **Classification:** FRONTEND (primary) — BE correct — deep FINDINGS `C2`
- **How to resolve:** Only list/enable actions for employees the manager can decide.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/091-timesheets-approvals-view-view.png`, `100`–`101`, `463-timesheets-return-modal-open.png`, `464-timesheets-return-result-done.png`, `470-gap-hr-admin-approve-result.png`
- **Network:** `POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve|reject` → **403** `NOT_TEAM_APPROVER`

### ISSUE-MGR-03
- **Where:** Sidebar `NAV_ITEMS` for MANAGER
- **Why:** Sees Reports, Analytics, Permissions, Recruitment, Performance, Assets; most deep-links DENY (leak=0 except payroll/runs).
- **Classification:** FRONTEND — deep FINDINGS `H1`
- **How to resolve:** Filter `NAV_ITEMS` by `memberType`; keep RoleGate as backstop.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/004-shell-sidebar-visible.png`, `407`–`412`, `398-spot-reports-deny.png`…`403-spot-assets-deny.png`
- **Network:** n/a

### ISSUE-MGR-04
- **Where:** Dashboard → **Bulk approve**
- **Why:** Opens leave-only “Bulk Approve Leave Requests” / empty leave queue (Approve selected still enabled). Shallow: same while regs pending.
- **Classification:** FRONTEND — deep FINDINGS `H2`
- **How to resolve:** Bulk-approve regularization, or rename/split; disable Approve selected when empty.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/008-dashboard-bulk-approve-open.png`, `009`–`010`, `466`–`469`, `472-gap-bulk-approve-modal.png`
- **Network:** n/a

### ISSUE-MGR-05
- **Where:** `/settings/roles-permissions`
- **Why:** Next.js **404 Page not found** (not RoleGate DENY).
- **Classification:** FRONTEND (routing) — deep FINDINGS `H3`
- **How to resolve:** Wire route or hide/redirect; never bare 404.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/435-settings-settings-roles-permissions-404.png`, `405-spot-settings-roles-permissions-404.png`, `458`
- **Network:** n/a

### ISSUE-MGR-13
- **Where:** Deep-link `/payroll/runs`
- **Why:** MANAGER reaches admin Payroll Runs shell (**OPEN**) — Export Register / runs UI — instead of RoleGate DENY or redirect to My Pay. Hard privilege leak (phase-3).
- **Classification:** FRONTEND (RoleGate miss) — deep FINDINGS `H6`
- **How to resolve:** DENY for MANAGER or redirect to `/payroll` (My Pay).
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/452-admin-deeplink-payroll-runs-open.png`
- **Network:** n/a (client route OPEN)

### ISSUE-MGR-10
- **Where:** Employees → employee detail → **Activity** tab
- **Why:** Tab visible; “Access restricted… HR administrators only.”
- **Classification:** FRONTEND — deep FINDINGS `H4`
- **How to resolve:** Hide Activity tab unless HR/Admin.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/041-employee-detail-tab-activity-view.png`, `034`
- **Network:** n/a

### ISSUE-MGR-11
- **Where:** `/reports/headcount`, `/reports/absenteeism`, `/reports/pay-equity`
- **Why:** Bare **404** instead of RoleGate DENY (`/reports` DENYs correctly).
- **Classification:** FRONTEND (routing) — deep FINDINGS `H5`
- **How to resolve:** RoleGate DENY or redirect — never bare 404.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/444`–`446` (contrast `443`)
- **Network:** n/a

### ISSUE-MGR-06
- **Where:** Employee header / Payroll payslip — Designation field
- **Why:** Designation concatenates date, e.g. `Senior Engineer 2026-07-02` (spot drawer fully loaded with same bug).
- **Classification:** FRONTEND (display mapping) — deep FINDINGS `M3`
- **How to resolve:** Separate designation vs effective-date fields.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/410-spot-payslip-drawer.png`, `041-employee-detail-tab-activity-view.png`
- **Network:** n/a

### ISSUE-MGR-07
- **Where:** Timesheets → Approvals — **PROGRESS** column
- **Why:** Always empty.
- **Classification:** FRONTEND — deep FINDINGS `M2`
- **How to resolve:** Render progress or hide column.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/091-timesheets-approvals-view-view.png`, `411-spot-timesheets-approvals.png`
- **Network:** n/a

### ISSUE-MGR-12
- **Where:** `/login` bootstrap
- **Why:** Anonymous `GET /api/auth/me` + `POST /api/auth/refresh` → **401**.
- **Classification:** FRONTEND — deep FINDINGS `M4`
- **How to resolve:** Skip me/refresh on public auth routes.
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/001-login-page-view.png`
- **Network:** `401 GET /api/auth/me`, `401 POST /api/auth/refresh`


### ISSUE-MGR-14
- **Where:** Payroll → My Pay → payslip detail drawer
- **Why:** Nested opens often leave drawer titled “Payslip” stuck on skeletons (`251`, `368`). Spot later loaded full payslip (`410-spot`) — intermittent load/error UX.
- **Classification:** FRONTEND (loading/error UX) — deep FINDINGS `H7`
- **How to resolve:** Bound skeleton timeout; show error; ensure detail query completes (Download already works when loaded).
- **Screenshot:** `docs/e2e-ui-screenshots/manager-deep/251-payroll-n2-view-payslip-for-16-31-dec-2026-modal-open.png`, `368-payroll-detail-n3-view-payslip-for-16-31-dec-2026-modal-open.png` (contrast `410-spot-payslip-drawer.png`)
- **Network:** intermittent detail load

### ISSUE-MGR-08
- **Where:** `/employees` list (MANAGER)
- **Why:** Intermittent skeletons (shallow only); deep loaded OK (`016`+).
- **Classification:** FRONTEND / UNKNOWN — shallow `M9`; **not re-proven deep**
- **How to resolve:** Bound loading timeout / error state.
- **Screenshot:** `docs/e2e-ui-screenshots/manager/88-employees-main.png`; contrast deep `016-employees-land-view.png`
- **Network:** intermittent
- **Note:** Retained shallow-only; lower confidence.

### ISSUE-MGR-15 (ISSUE-MGR-NOTIF-01) — HIGH — Notification badge under-counts vs unread-count API
- **Where:** Header bell badge · `aman@acme.test` (MANAGER)
- **Why:** Badge shows **3** (`aria` “Notifications — 3 unread”) while `GET /notifications/unread-count` → **4** and drawer shows **4** unread-styled items. Badge is derived from `GET /notifications?limit=20` client filter (`filtered.filter(n => !n.isRead).length`); `notificationsApi.unreadCount()` is never used for the badge.
- **Classification:** FRONTEND HIGH — stress FINDINGS `ISSUE-NOTIF-UI-01`
- **How to resolve:** Drive badge from `GET /notifications/unread-count` (or apply the same prefs filter server-side); invalidate/poll on focus.
- **Screenshot:** `docs/e2e-ui-screenshots/stress/notifications-ui/018-mgr-badge-closed.png`, `019-mgr-drawer-open.png`
- **Network:** `GET /notifications/unread-count` **200** `{"count":4}` · `GET /notifications?limit=20` unreadInPage=4
- **Cross-role note:** Badge↔unread-count **mismatch observed MANAGER-only** in `docs/e2e-ui-screenshots/stress/notifications-ui/FINDINGS.md` (SA 9+/14 aligned with aria; HR 3=3; EMP 1=1). Same client derivation pattern exists for all roles — latent for SA/HR/EMP when prefs hide types or list truncates.

## EMPLOYEE

**Tester:** `priya@acme.test` (EMPLOYEE) · tenant `acme-corp-001` · 2026-08-03  
**Evidence:** `docs/e2e-ui-screenshots/employee-deep/` (**201** PNGs + `FINDINGS.md`, `depth-stats.json`)  
**Depth:** menus 24 · tabs 31 · buttons 72 · dialogs 13 · nested layers 97 · leave types tried 5 · settings routes 29 · admin probes 13  
**Nav source:** `ems-frontend/src/shared/layouts/AppShell.tsx` — `NAV_ITEMS` (no role filter)  
**ID note:** Mapped from employee-deep FINDINGS `C1-FE`/`C2`/`H1`/`H2`/`H4`/`M1`–`M5`. Prior shallow checkout stale-card (`H3` old) not re-proven this run (CI/CO already done same day).

### ISSUE-EMP-02
- **Where:** Leave → New Request — Leave Type picker offers **Annual Leave** (`AL`) with no balance
- **Why:** Deep nested pass tried all 5 types; AL submit toasts “No leave balance available for this type” (see BE `ISSUE-EMP-01`). FE should not default/offer types without `available > 0`. Also “Annual” dashboard label vs API `Earned Leave (EL)` mismatch.
- **Classification:** FRONTEND — FINDINGS `C1-FE` + `M4`
- **How to resolve:** Default picker to first type with `available > 0`; hide orphan/zero types; align “Annual” label with real `leaveTypeId` (`EL` vs `AL`).
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/049-leave-submit-annual-leave.png`, `048-leave-filled-annual-leave.png`, `005-dashboard-landing.png`
- **Network:** `POST /api/leave/requests` **400** `NO_LEAVE_BALANCE` (`AL`); contrast `SL` → **201**

### ISSUE-EMP-03
- **Where:** Sidebar for EMPLOYEE (`AppShell` `NAV_ITEMS`)
- **Why:** EMPLOYEE sees full admin-style nav (**17** items) including Reports, Analytics, Permissions, Settings, Recruitment, Performance, Assets. Deep-links correctly Access restricted — no data leak, but violates role-nav contract. Confirmed via sidebar click-through of every item.
- **Classification:** FRONTEND — FINDINGS `C2`
- **How to resolve:** Hide nav items per role matrix; keep RoleGate as backstop only.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/004-nav-sidebar-full.png`, `184`–`199`
- **Network:** n/a (RoleGate DENY on admin probes `126`–`138`, `150`–`174`)

### ISSUE-EMP-04
- **Where:** Leave → **Team Calendar** tab
- **Why:** Tab is visible to EMPLOYEE; page shows Access restricted (managers/HR only). Nested tab + view clicks both DENY.
- **Classification:** FRONTEND — FINDINGS `H1`
- **How to resolve:** Hide Team Calendar for `EMPLOYEE`.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/041-leave-tab-team-calendar.png`, `044-leave-view-team-calendar.png`
- **Network:** n/a (client RoleGate)

### ISSUE-EMP-05
- **Where:** Sidebar → Performance / Assets (and other admin nav)
- **Why:** Nav items visible; RoleGate denies EMPLOYEE. Nav implies access that page denies.
- **Classification:** FRONTEND — FINDINGS `H2`
- **How to resolve:** Hide nav items for EMPLOYEE **or** open self-scoped Performance/Assets screens.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/135-admin-probe-performance.png`, `137-admin-probe-assets.png`, `198`–`199`
- **Network:** n/a (client RoleGate)

### ISSUE-EMP-06
- **Where:** Payroll → My Pay → payslip detail drawer
- **Why:** Opening a payslip shows drawer title “Payslip” stuck on skeleton placeholders; Download never becomes available in deep pass (list cards for 2023 periods are visible behind drawer).
- **Classification:** FRONTEND (loading/error UX) — FINDINGS `H4` (detail fetch may also fail — verify employee payslip detail API)
- **How to resolve:** Bound skeleton timeout; show error state; ensure detail query completes and Download renders.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/104-payroll-payslip-detail.png`, `105-payroll-payslip-download.png`
- **Network:** no successful detail/download mutation captured in deep run

### ISSUE-EMP-07
- **Where:** Wireframe self routes `/employees/me/documents`, `/employees/me/team`, `/employee/dashboard`
- **Why:** Next app returns “404 Page not found”. Dashboard already embeds My Documents / My Team via `/api/employee/*` — aliases missing.
- **Classification:** FRONTEND (routing) — FINDINGS `M1`
- **How to resolve:** Add Next routes/aliases or redirect to dashboard widgets that already call `/api/employee/*`.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/181-self-route-employees-me-documents.png`, `182`, `183`
- **Network:** n/a (client 404)

### ISSUE-EMP-08
- **Where:** Dashboard **My Team** widget
- **Why:** Aman Kumar listed twice (one with Manager badge).
- **Classification:** FRONTEND mapping (or BE `/employee/team` payload) — FINDINGS `M2`
- **How to resolve:** Dedupe by `employeeId`; clarify manager vs peer rows.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/003-login-success-dashboard.png`, `005-dashboard-landing.png`
- **Network:** n/a (verify `GET /api/employee/team`)

### ISSUE-EMP-09
- **Where:** Login transition — session settle
- **Why:** Briefly hits `401 GET /api/auth/me` and `401 POST /api/auth/refresh` before cookies settle; then dashboard OK.
- **Classification:** FRONTEND (race) — FINDINGS `M3`
- **How to resolve:** Gate `/auth/me` until login mutation settles; suppress noisy console for expected transition 401s.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/003-login-success-dashboard.png` / `results.json` Login
- **Network:** `401 GET /api/auth/me`, `401 POST /api/auth/refresh` during login transition

### ISSUE-EMP-10
- **Where:** `/settings/roles-permissions` (hard navigation / admin probe)
- **Why:** Next.js **404 Page not found** (not RoleGate DENY). Dead/missing route when EMPLOYEE (or any role) hits this path.
- **Classification:** FRONTEND (routing) — FINDINGS `M5`
- **How to resolve:** Wire the route or redirect to first allowed settings panel; never show bare 404 for known settings slugs.
- **Screenshot:** `docs/e2e-ui-screenshots/employee-deep/144-admin-probe-settings-roles-permissions.png`, `175-settings-settings-roles-permissions.png`
- **Network:** n/a (client 404)

> **Notifications note (2026-08-03):** Badge↔`unread-count` mismatch **not observed for EMPLOYEE** (badge 1 = API 1). See **ISSUE-MGR-15** — MANAGER-only repro; same list-derived badge pattern is latent for all roles.

## SUPER_ADMIN

> Updated 2026-08-02T20:04:36Z — full-depth UI E2E vs http://localhost:3001 / http://localhost:4000/api/v1
> Evidence: `docs/e2e-ui-screenshots/superadmin-deep/` (**831** PNGs + FINDINGS.md); shallow support `docs/e2e-ui-screenshots/superadmin/`
> Depth: menus **17** · controls **304** · maxDepth **4** · layers **92** · runner shots **372**
> Tester: `superadmin@acme.test` · tenant `acme-corp-001` · `employeeId: null`
> ID note: Leave→Priya CRITICAL lives on BE as **ISSUE-SA-10** (was SA-04). This FE list covers login noise, leave preview (BOTH SA-03), and export `ok:false` (SA-05…09).
>
> **SUPERSEDED note (2026-08-03):** Confirm pass `docs/e2e-ui-screenshots/confirm/sa-exports/` + [`E2E_EXPORT_CONFIRM_MATRIX.md`](./E2E_EXPORT_CONFIRM_MATRIX.md) `## SUPER_ADMIN` recorded **16/16 downloads ok:true**. Prior ISSUE-SA-05…09 `ok:false` **not reproduced**. Historical issue rows below are **kept** (do not delete) and marked SUPERSEDED. Residuals outside those IDs: Performance Export stub; absent toolbars on Attendance/Leave/Analytics/Payout/Audit; Excel still not proven; payslip FE `window.print` vs BE PDF 200 (mgr-emp confirm).
>
> **Notifications note (2026-08-03):** Badge↔`unread-count` mismatch **not observed for SUPER_ADMIN** (badge aria=14 = API 14). See **ISSUE-MGR-15** — MANAGER-only repro; same list-derived badge pattern is latent for all roles.

### ISSUE-SA-01: Login bootstrap 401s (me/refresh)
- Where: Login /login
- Why: Anonymous GET /api/auth/me and POST /api/auth/refresh → 401 before credentials
- Classification: FRONTEND
- How to resolve: Skip me/refresh on public auth routes
- Screenshot: docs/e2e-ui-screenshots/superadmin-deep/002-login-success.png
- Network: GET /api/auth/me 401; POST /api/auth/refresh 401

### ISSUE-SA-03: Leave preview route missing (404)
- Where: Leave request modal
- Why: FE calls GET /api/leave/requests/preview which is not implemented (404)
- Classification: BOTH
- How to resolve: Stop calling missing preview endpoint or implement BFF/BE route
- Screenshot: docs/e2e-ui-screenshots/superadmin-deep/093-leave-d1-cancel.png
- Network: GET /api/leave/requests/preview 404

### ISSUE-SA-05: Employees export download fails
- **Status: SUPERSEDED (2026-08-03)** — confirm sa-exports Employees CSV **ok:true** (`021-employees-x-export.png`, stress ×3). Historical deep `ok:false` kept for audit trail.
- Where: Employees → Export
- Why: Download event `employees-2026-08-02.csv` with ok:false
- Classification: FRONTEND
- How to resolve: Ensure export triggers real file download with Content-Disposition
- Screenshot: docs/e2e-ui-screenshots/superadmin-deep/023-employees-d0-export.png
- Network: download event

### ISSUE-SA-06: Payroll export download fails
- **Status: SUPERSEDED (2026-08-03)** — confirm sa-exports Payroll Register CSV **ok:true** (`025-payrollrun-x-export-register.png`, stress ×3). Historical deep `ok:false` kept for audit trail.
- Where: Payroll detail → Export
- Why: Download event `payroll-2026-10-H1.csv` ok:false
- Classification: FRONTEND
- How to resolve: Wire payroll export to successful file download
- Screenshot: n/a
- Network: download event

### ISSUE-SA-07: Payroll audit-pack download fails
- **Status: SUPERSEDED (2026-08-03)** — confirm sa-exports Export pack JSON **ok:true** (`026-payrollrun-x-export-pack.png`, stress ×3). Historical deep `ok:false` kept for audit trail.
- Where: Payroll detail → Export pack
- Why: Download event `audit-pack-*.json` ok:false
- Classification: FRONTEND
- How to resolve: Wire audit-pack export download
- Screenshot: n/a
- Network: download event

### ISSUE-SA-08: Reports CSV export download fails
- **Status: SUPERSEDED (2026-08-03)** — confirm sa-exports Reports Export CSV **ok:true** (multiple report types + headcount stress ×3). Historical deep `ok:false` kept for audit trail.
- Where: Reports → Export CSV
- Why: Download event `workforce-headcount-report.csv` ok:false
- Classification: FRONTEND
- How to resolve: Ensure reports export returns downloadable CSV
- Screenshot: n/a
- Network: download event

### ISSUE-SA-09: Billing invoices export download fails
- **Status: SUPERSEDED (2026-08-03) for SA-05…09 export-failure class** — confirm sa-exports **16/16 ok:true**; Invoice/Register nav clicks classified as NAV_ONLY false-positives (not export actions). Historical deep `ok:false` kept; dedicated invoices CSV re-probe still optional if product ships a real invoices export control.
- Where: Settings → billing-invoices
- Why: Download event `invoices-2026-08-03.csv` ok:false
- Classification: FRONTEND
- How to resolve: Wire invoices export download
- Screenshot: n/a
- Network: download event

## SA-GAP-MENUS

> Tester: `superadmin@acme.test` (SUPER_ADMIN) · tenant `acme-corp-001` · 2026-08-03
> Evidence: `docs/e2e-ui-screenshots/confirm/sa-gap-menus/` (**368** PNGs + FINDINGS.md)
> Depth: menus=6 settingsSubs=18 clicks=386 maxDepth=3
> Scope: Recruitment · Performance · Assets · Announcements · Permissions · Settings

### ISSUE-SA-GAP-01: Performance: console error
- **Where:** Performance / http://localhost:3001/performance
- **Why:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002yk
- **Classification:** FRONTEND
- **How to resolve:** Fix React/runtime error in FE
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/sa-gap-menus/045-performance-d0-tab-goals.png`
- **Network:** `n/a (console)`

### ISSUE-SA-GAP-02: Menu exploration crashed: Settings
- **Where:** Settings / /settings
- **Why:** TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[role="dialog"], [role="alertdialog"]').last().locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea:visible').nth(1)

- **Classification:** FRONTEND
- **How to resolve:** Stabilize page; re-run confirm gap shard
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/sa-gap-menus/368-settings-crash.png`
- **Network:** `n/a`

### ISSUE-SA-GAP-03: Download failed: assets-inventory.csv
- **Where:** http://localhost:3001/assets
- **Why:** Download event failure: {} (sa-gap-menus ×2). **Re-probe 2026-08-03T03:42Z:** Export ×3 → `assets-inventory.csv` **ok:false×3**; no export API. Conflicts with `sa-exports` historical ok:true → **final verdict: flaky**. Root cause: client Blob + immediate `URL.revokeObjectURL` in `AssetsScreen.handleExport`.
- **Classification:** FRONTEND
- **How to resolve:** Do not revoke object URL until download starts/settles; optional BE CSV with Content-Disposition
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/sa-gap-menus/n/a` · `docs/e2e-ui-screenshots/confirm/assets-export-reprobe/`
- **Network:** `download event` (no export HTTP on click)
- **Status:** OPEN — **flaky** (GAP-01..04 retained)

### SA-GAP-MENUS settings-resume 2026-08-03

> Evidence: `docs/e2e-ui-screenshots/confirm/sa-gap-menus/` (**391** PNGs + FINDINGS.md)
> Resumed settings: authentication, sessions, audit-log, email-templates, notifications, integration-email, integration-storage, integration-webhooks, billing-plan, billing-invoices, roles-permissions
> Totals: clicks=397 shots=391 be=0 fe=4 both=0

### ISSUE-SA-GAP-04: Settings/roles-permissions: 404 GET …/settings/roles-permissions
- **Where:** Settings/roles-permissions / http://localhost:3001/settings/roles-permissions
- **Why:** GET http://localhost:3001/settings/roles-permissions → 404; <!DOCTYPE html><html lang="en" class="inter_8db6fa51-module__MMaAbG__variable jetbrains_mono_9a2f2d6c-module__wsyXyG__variable h-full antialiased"><head><meta charSet="utf-8"/><meta name="viewport" co
- **Classification:** FRONTEND
- **How to resolve:** Fix FE/BFF
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/sa-gap-menus/391-settings-roles-permissions-land.png`
- **Network:** `GET http://localhost:3001/settings/roles-permissions 404`

