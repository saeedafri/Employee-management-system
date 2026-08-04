# SUPER_ADMIN Full-Depth Nested UI E2E Findings

- Generated: 2026-08-02T20:04:36Z
- Role: SUPER_ADMIN (`superadmin@acme.test`)
- UI: http://localhost:3001
- API: http://localhost:4000/api/v1
- Tenant: acme-corp-001
- Auth facts: `employeeId: null`, `employee: null` (`GET /auth/me`)
- MSW: OFF
- Tool: Playwright Chromium (full-depth nested)
- Screenshots: `docs/e2e-ui-screenshots/superadmin-deep/`
- Supporting shallow evidence: `docs/e2e-ui-screenshots/superadmin/` (~704 PNGs + FINDINGS.md)
- **No Render deploy. No git commit.**

## Depth stats

| Metric | Value |
|--------|------:|
| Menus tested | **17** |
| Controls clicked | **304** |
| Max nest depth | **4** |
| Layers explored | **92** |
| Screenshots (runner counter) | **372** |
| Screenshots (disk) | **831** |
| Issues BACKEND | **2** (+1 CRITICAL verified API) |
| Issues FRONTEND | **6** |
| Issues BOTH | **1** |
| Download events | **8** (all failed/`ok:false`) |
| Mutations | **1** (Add Employee opened then Cancel) |

### Coverage notes
- Deepest: Settings (many sub-routes), Reports (+ report query routes), Payroll (+ migration/global/detail), Timesheets/Leave/Holidays/Departments/Employees.
- Thinner land-only shots for Recruitment / Performance / Assets / Announcements (`369`–`372-*-land.png`) after long Settings crawl — not zero, but not fully nested.
- Disk PNG count (831) > runner counter because a parallel nested pass wrote additional Settings/Reports frames into the same folder.

## Critical bugs

1. **ISSUE-SA-10** [BACKEND · **CRITICAL**] Leave APIs return another employee’s data for SUPER_ADMIN — `GET /leave/balance` **200** with ids prefixed `cmqjpyds7001kkpjdnlhjygrp-*` (Priya Sharma) while `GET /auth/me` has `employeeId: null`. UI “My Requests” / balances show Priya’s EL **574.8/576.8**. Verified 2026-08-02T20:04:36Z against local `:4000`.
2. **ISSUE-SA-02** [BACKEND] `GET /attendance/today` → **400** `NO_EMPLOYEE_RECORD` for SUPER_ADMIN (summary already returns graceful empty).
3. **ISSUE-SA-03** [BOTH] `GET /leave/requests/preview` → **404** (route missing / FE calls unimplemented path).
4. **ISSUE-SA-05..09** [FRONTEND] Export/download events fire but files fail (`ok:false`) — employees CSV, payroll CSV, audit pack, workforce headcount, invoices.
5. **ISSUE-SA-01** [FRONTEND] Login bootstrap anonymous `GET /auth/me` + `POST /auth/refresh` → **401** (cosmetic).
6. **ISSUE-SA-04** [BACKEND] Mid-crawl `GET /leave/assignments` → **401** `INVALID_TOKEN` / `exp` during Settings (long-session TTL; may be harness flake).

## Issues (full)

### ISSUE-SA-01: Login bootstrap 401s (me/refresh)
- Where: Login /login
- Why: Anonymous GET /api/auth/me, POST /api/auth/refresh → 401 before credentials
- Classification: **FRONTEND**
- How to resolve: Skip me/refresh probes on public auth routes
- Screenshot: `002-login-success.png`
- Network: `GET http://localhost:3001/api/auth/me 401`

### ISSUE-SA-02: Attendance: 400 GET /attendance/today
- Where: Attendance / Request Regularization
- Why: GET /api/attendance/today → 400 `NO_EMPLOYEE_RECORD` (SUPER_ADMIN has no employee link). Contrast: /attendance/summary already returns 200 + `noEmployeeRecord: true`.
- Classification: **BACKEND**
- How to resolve: BE return 200 empty + `noEmployeeRecord: true`; FE skip call when `employeeId` is null
- Screenshot: `059-attendance-d0-request-regularization.png`
- Network: `GET http://localhost:3001/api/attendance/today 400`

### ISSUE-SA-03: Leave preview route 404
- Where: Leave modal / Cancel after fill
- Why: GET /api/leave/requests/preview?... → 404 Not Found
- Classification: **BOTH**
- How to resolve: Implement BE route or stop FE from calling missing preview endpoint
- Screenshot: `093-leave-d1-cancel.png`
- Network: `GET .../leave/requests/preview?... 404`

### ISSUE-SA-04: Settings leave-assignments 401 (token exp)
- Where: Settings/leave-policies → Assignments
- Why: GET /api/leave/assignments → 401 INVALID_TOKEN exp claim failed (long crawl)
- Classification: **BACKEND** (session TTL / refresh gap during long UI sessions)
- How to resolve: Ensure FE refresh before expiry; BE should not hard-fail mid-navigation without re-auth UX
- Screenshot: `347-settings-leave-policies-d0-assignments.png`
- Network: `GET .../leave/assignments 401`

### ISSUE-SA-05: Download failed: employees CSV
- Where: Employees export
- Classification: **FRONTEND**
- How to resolve: Ensure export triggers real file download with Content-Disposition
- Screenshot: n/a (download event)
- Network: download event `employees-2026-08-02.csv` ok:false

### ISSUE-SA-06: Download failed: payroll CSV
- Where: Payroll detail export
- Classification: **FRONTEND**
- Screenshot: n/a
- Network: download event `payroll-2026-10-H1.csv` ok:false

### ISSUE-SA-07: Download failed: audit pack JSON
- Where: Payroll detail export pack
- Classification: **FRONTEND**
- Screenshot: n/a
- Network: download event `audit-pack-*.json` ok:false

### ISSUE-SA-08: Download failed: workforce-headcount-report.csv
- Where: Reports export
- Classification: **FRONTEND**
- Screenshot: n/a
- Network: download event ok:false

### ISSUE-SA-09: Download failed: invoices CSV
- Where: Settings → billing-invoices
- Classification: **FRONTEND**
- Screenshot: n/a
- Network: download event `invoices-2026-08-03.csv` ok:false

### ISSUE-SA-10: Leave APIs return Priya Sharma data for SUPER_ADMIN (**CRITICAL**)
- Where: Leave → balances / My Requests
- Why: With `employeeId: null`, balance ids are prefixed `cmqjpyds7001kkpjdnlhjygrp-*` (= Priya’s employeeId). UI shows her EL/SL/CL balances and request history as “mine”.
- Classification: **BACKEND** (**CRITICAL** — cross-user data exposure)
- How to resolve: Never fall back to another employee when `employeeId` is null — return empty balances/requests or `NO_EMPLOYEE_RECORD`
- Screenshot: shallow `docs/e2e-ui-screenshots/superadmin/51-leave.png`; deep leave shots `090-leave-d0-tab-approvals.png` / `095-leave-d0-my-requests.png`
- Network: `GET /leave/balance` 200 (Priya-prefixed ids); `GET /leave/requests` 200; `GET /auth/me` employeeId null
- Verified API: 2026-08-02T20:04:36Z local `:4000`

## Mutations
- Dashboard → Add Employee opened then Cancel (no create)

## Downloads
- `{"suggested": "employees-2026-08-02.csv", "ok": false, "failure": {}, "pageUrl": "http://localhost:3001/employees"}`
- `{"suggested": "payroll-2026-10-H1.csv", "ok": false, "failure": {}, "pageUrl": "http://localhost:3001/payroll/cmqtuztv1002x5teqvp4efas3"}`
- `{"suggested": "audit-pack-cmqtuztv1002x5teqvp4efas3.json", "ok": false, "failure": {}, "pageUrl": "http://localhost:3001/payroll/cmqtuztv1002x5teqvp4efas3"}`
- `{"suggested": "workforce-headcount-report.csv", "ok": false, "failure": {}, "pageUrl": "http://localhost:3001/reports?report=workforce/turnover"}`
- `{"suggested": "invoices-2026-08-03.csv", "ok": false, "failure": {}, "pageUrl": "http://localhost:3001/settings/billing-invoices"}`
- `{"suggested": "invoices-2026-08-03.csv", "ok": false, "failure": {}, "pageUrl": "http://localhost:3001/settings/billing-invoices"}`
- `{"suggested": "invoices-2026-08-03.csv", "ok": false, "failure": {}, "pageUrl": "http://localhost:3001/settings/billing-invoices"}`
- `{"suggested": "invoices-2026-08-03.csv", "ok": false, "failure": {}, "pageUrl": "http://localhost:3001/settings/billing-invoices"}`

## Menu / Action Log (abridged)

### Login (1 actions)
- **[PASS]** login — `002-login-success.png`

### Dashboard (8 actions)
- **[PASS]** open — `004-dashboard-land.png`
- **[MISS]** Approve
- **[MISS]** Deny
- **[MISS]** Reject
- **[PASS]** d0/7d — `014-dashboard-d0-7d.png`
- **[PASS]** d0/30d — `015-dashboard-d0-30d.png`
- **[PASS]** d0/90d — `016-dashboard-d0-90d.png`
- **[PASS]** d0/Add Employee — `017-dashboard-d0-add-employee.png`

### Dashboard>detail (3 actions)
- **[PASS]** d1/Save draft — `018-dashboard-detail-d1-save-draft.png`
- **[PASS]** d1/Cancel — `019-dashboard-detail-d1-cancel.png`
- **[PASS]** d1/Next — `020-dashboard-detail-d1-next.png`

### Employees (14 actions)
- **[PASS]** open — `022-employees-land.png`
- **[PASS]** d0/Export — `023-employees-d0-export.png`
- **[PASS]** d0/Add employee — `024-employees-d0-add-employee.png`
- **[PASS]** d0/Columns — `025-employees-d0-columns.png`
- **[PASS]** d0/Prev — `026-employees-d0-prev.png`
- **[PASS]** d0/Next — `027-employees-d0-next.png`
- **[PASS]** d0/Actions for Aman Kumar — `028-employees-d0-actions-for-aman-kumar.png`
- **[PASS]** menu:View profile — `029-employees-d0-menu-view-profile.png`
- **[PASS]** menu:control — `030-employees-d0-menu-control.png`
- **[PASS]** menu:control — `031-employees-d0-menu-control.png`
- **[PASS]** d0/Actions for Priya Sharma — `032-employees-d0-actions-for-priya-sharma.png`
- **[PASS]** d0/All departments — `033-employees-d0-all-departments.png`
- … +2 more

### Employees/employees/new (4 actions)
- **[PASS]** d0/Save draft — `037-employees-employees-new-d0-save-draft.png`
- **[PASS]** d0/Cancel — `038-employees-employees-new-d0-cancel.png`
- **[PASS]** d0/Next — `039-employees-employees-new-d0-next.png`
- **[PASS]** d0/Not specified — `040-employees-employees-new-d0-not-specified.png`

### Departments (13 actions)
- **[PASS]** open — `042-departments-land.png`
- **[PASS]** d0/Add department — `043-departments-d0-add-department.png`
- **[PASS]** d1/Cancel — `045-departments-d1-cancel.png`
- **[PASS]** d0/Actions for Customer Success — `046-departments-d0-actions-for-customer-success.png`
- **[PASS]** menu:Edit — `047-departments-d0-menu-edit.png`
- **[PASS]** d1/Save changes — `049-departments-d1-save-changes.png`
- **[PASS]** d2/Cancel — `050-departments-d2-cancel.png`
- **[PASS]** menu:control — `051-departments-d0-menu-control.png`
- **[PASS]** menu:control — `052-departments-d0-menu-control.png`
- **[PASS]** d0/Actions for E2E Nested — `053-departments-d0-actions-for-e2e-nested.png`
- **[PASS]** menu:Edit — `054-departments-d0-menu-edit.png`
- **[PASS]** menu:control — `056-departments-d0-menu-control.png`
- … +1 more

### Attendance (9 actions)
- **[PASS]** open — `058-attendance-land.png`
- **[PASS]** d0/Request Regularization — `059-attendance-d0-request-regularization.png`
- **[PASS]** d1/Cancel — `061-attendance-d1-cancel.png`
- **[PASS]** d0/Previous month — `062-attendance-d0-previous-month.png`
- **[PASS]** d0/Next month — `063-attendance-d0-next-month.png`
- **[PASS]** d0/Calendar — `064-attendance-d0-calendar.png`
- **[PASS]** d0/Table — `065-attendance-d0-table.png`
- **[PASS]** d0/All departments — `066-attendance-d0-all-departments.png`
- **[PASS]** d0/All employees — `067-attendance-d0-all-employees.png`

### Timesheets (17 actions)
- **[PASS]** open — `069-timesheets-land.png`
- **[PASS]** d0/tab:My Timesheet — `070-timesheets-d0-tab-my-timesheet.png`
- **[PASS]** d0/tab:Approvals — `071-timesheets-d0-tab-approvals.png`
- **[PASS]** d0/tab:Projects — `072-timesheets-d0-tab-projects.png`
- **[PASS]** d0/tab:Rates — `073-timesheets-d0-tab-rates.png`
- **[PASS]** d0/tab:Approval Flow — `074-timesheets-d0-tab-approval-flow.png`
- **[PASS]** d0/tab:Locks — `075-timesheets-d0-tab-locks.png`
- **[PASS]** d0/tab:Delegations — `076-timesheets-d0-tab-delegations.png`
- **[PASS]** d0/Locks — `077-timesheets-d0-locks.png`
- **[PASS]** d0/My Timesheet — `078-timesheets-d0-my-timesheet.png`
- **[PASS]** d0/Approvals — `079-timesheets-d0-approvals.png`
- **[PASS]** d0/Projects — `080-timesheets-d0-projects.png`
- … +5 more

### Leave (13 actions)
- **[PASS]** open — `086-leave-land.png`
- **[PASS]** d0/tab:My Requests — `087-leave-d0-tab-my-requests.png`
- **[PASS]** d0/tab:Team Calendar — `088-leave-d0-tab-team-calendar.png`
- **[PASS]** d0/tab:Comp-off — `089-leave-d0-tab-comp-off.png`
- **[PASS]** d0/tab:Approvals — `090-leave-d0-tab-approvals.png`
- **[PASS]** d0/New Request — `091-leave-d0-new-request.png`
- **[PASS]** d1/Cancel — `093-leave-d1-cancel.png`
- **[PASS]** d0/Team Calendar — `094-leave-d0-team-calendar.png`
- **[PASS]** d0/My Requests — `095-leave-d0-my-requests.png`
- **[PASS]** d0/Comp-off — `096-leave-d0-comp-off.png`
- **[PASS]** d0/Approvals — `097-leave-d0-approvals.png`
- **[PASS]** d0/Pending — `098-leave-d0-pending.png`
- … +1 more

### Holidays (18 actions)
- **[PASS]** open — `101-holidays-land.png`
- **[PASS]** d0/Import .ics — `102-holidays-d0-import-ics.png`
- **[PASS]** d1/Cancel — `103-holidays-d1-cancel.png`
- **[PASS]** d0/Add Holiday — `104-holidays-d0-add-holiday.png`
- **[PASS]** d1/Add Holiday — `106-holidays-d1-add-holiday.png`
- **[PASS]** d0/Previous year — `107-holidays-d0-previous-year.png`
- **[PASS]** d0/Next year — `108-holidays-d0-next-year.png`
- **[PASS]** d0/Actions for New Year's Day — `109-holidays-d0-actions-for-new-year-s-day.png`
- **[PASS]** menu:Edit — `110-holidays-d0-menu-edit.png`
- **[PASS]** d1/Save Changes — `112-holidays-d1-save-changes.png`
- **[PASS]** menu:control — `113-holidays-d0-menu-control.png`
- **[PASS]** d0/Actions for Republic Day — `114-holidays-d0-actions-for-republic-day.png`
- … +6 more

### Payroll (10 actions)
- **[PASS]** open — `123-payroll-land.png`
- **[PASS]** d0/Run Payroll — `124-payroll-d0-run-payroll.png`
- **[PASS]** d1/Cancel — `125-payroll-d1-cancel.png`
- **[PASS]** d0/Prev — `126-payroll-d0-prev.png`
- **[PASS]** d0/Next — `127-payroll-d0-next.png`
- **[PASS]** d0/Actions for 16–31 Dec 2026 — `128-payroll-d0-actions-for-16-31-dec-2026.png`
- **[PASS]** menu:View — `129-payroll-d0-menu-view.png`
- **[PASS]** d0/Actions for 1–15 Dec 2026 — `140-payroll-d0-actions-for-1-15-dec-2026.png`
- **[PASS]** menu:View — `141-payroll-d0-menu-view.png`
- **[PASS]** d0/Migration — `142-payroll-d0-migration.png`

### Payroll>detail (8 actions)
- **[PASS]** d1/Export Register — `130-payroll-detail-d1-export-register.png`
- **[PASS]** d1/Export pack — `131-payroll-detail-d1-export-pack.png`
- **[PASS]** d1/Actions for HR Admin — `132-payroll-detail-d1-actions-for-hr-admin.png`
- **[PASS]** menu:View payslip — `133-payroll-detail-d1-menu-view-payslip.png`
- **[PASS]** d2/Download PDF — `135-payroll-detail-d2-download-pdf.png`
- **[PASS]** d3/Download PDF — `136-payroll-detail-d3-download-pdf.png`
- **[PASS]** d1/Actions for Aman Kumar — `137-payroll-detail-d1-actions-for-aman-kumar.png`
- **[PASS]** menu:View payslip — `138-payroll-detail-d1-menu-view-payslip.png`

### Payroll/payroll/migration (11 actions)
- **[PASS]** d0/tab:Pay Calendar — `146-payroll-payroll-migration-d0-tab-pay-calendar.png`
- **[PASS]** d0/tab:Opening Balances — `147-payroll-payroll-migration-d0-tab-opening-balances.png`
- **[PASS]** d0/tab:Historical Payslips — `148-payroll-payroll-migration-d0-tab-historical-payslips.png`
- **[PASS]** d0/tab:Parallel Run — `149-payroll-payroll-migration-d0-tab-parallel-run.png`
- **[PASS]** d0/tab:Go-Live — `150-payroll-payroll-migration-d0-tab-go-live.png`
- **[PASS]** d0/Opening Balances — `151-payroll-payroll-migration-d0-opening-balances.png`
- **[PASS]** d0/Save — `152-payroll-payroll-migration-d0-save.png`
- **[PASS]** d0/Pay Calendar — `153-payroll-payroll-migration-d0-pay-calendar.png`
- **[PASS]** d0/Historical Payslips — `154-payroll-payroll-migration-d0-historical-payslips.png`
- **[PASS]** d0/Parallel Run — `155-payroll-payroll-migration-d0-parallel-run.png`
- **[PASS]** d0/Go-Live — `156-payroll-payroll-migration-d0-go-live.png`

### Payroll/payroll/global (2 actions)
- **[PASS]** d0/Worker type — `158-payroll-payroll-global-d0-worker-type.png`
- **[PASS]** d0/Employee — `159-payroll-payroll-global-d0-employee.png`

### Payout methods (3 actions)
- **[PASS]** open — `160-payout-methods-land.png`
- **[PASS]** d0/Add account — `161-payout-methods-d0-add-account.png`
- **[PASS]** d0/Review approvals — `162-payout-methods-d0-review-approvals.png`

### Payout methods>detail (2 actions)
- **[PASS]** d1/tab:Approvals — `163-payout-methods-detail-d1-tab-approvals.png`
- **[PASS]** d1/tab:Verification — `164-payout-methods-detail-d1-tab-verification.png`

### Payout methods/payout-methods/approvals (4 actions)
- **[PASS]** d0/tab:Approvals — `166-payout-methods-payout-methods-approvals-d0-tab-appro.png`
- **[PASS]** d0/tab:Verification — `167-payout-methods-payout-methods-approvals-d0-tab-verif.png`
- **[PASS]** d0/Approvals — `168-payout-methods-payout-methods-approvals-d0-approvals.png`
- **[PASS]** d0/Verification — `169-payout-methods-payout-methods-approvals-d0-verificat.png`

### Reports (15 actions)
- **[PASS]** d0/Export CSV — `171-reports-d0-export-csv.png`
- **[PASS]** d0/Headcount — `172-reports-d0-headcount.png`
- **[PASS]** d0/Turnover — `173-reports-d0-turnover.png`
- **[PASS]** d0/Demographics — `174-reports-d0-demographics.png`
- **[PASS]** d0/Monthly Summary — `175-reports-d0-monthly-summary.png`
- **[PASS]** d0/Absenteeism Trend — `176-reports-d0-absenteeism-trend.png`
- **[PASS]** d0/Utilization — `177-reports-d0-utilization.png`
- **[PASS]** d0/Pending Requests — `178-reports-d0-pending-requests.png`
- **[PASS]** d0/Payroll Summary — `179-reports-d0-payroll-summary.png`
- **[PASS]** d0/CTC Analysis — `180-reports-d0-ctc-analysis.png`
- **[PASS]** d0/Salary Register — `181-reports-d0-salary-register.png`
- **[PASS]** d0/Statutory Register — `182-reports-d0-statutory-register.png`
- … +3 more

### Analytics (13 actions)
- **[PASS]** open — `186-analytics-land.png`
- **[PASS]** d0/7d — `187-analytics-d0-7d.png`
- **[PASS]** d0/30d — `188-analytics-d0-30d.png`
- **[PASS]** d0/90d — `189-analytics-d0-90d.png`
- **[PASS]** d0/Custom — `190-analytics-d0-custom.png`
- **[PASS]** d1/Apply range — `191-analytics-d1-apply-range.png`
- **[PASS]** d2/Apply range — `192-analytics-d2-apply-range.png`
- **[PASS]** d3/Apply range — `193-analytics-d3-apply-range.png`
- **[PASS]** d0/All departments — `194-analytics-d0-all-departments.png`
- **[PASS]** d0/Load more — `195-analytics-d0-load-more.png`
- **[PASS]** d0/6m — `196-analytics-d0-6m.png`
- **[PASS]** d0/12m — `197-analytics-d0-12m.png`
- … +1 more

### Permissions (5 actions)
- **[PASS]** open — `199-permissions-land.png`
- **[PASS]** d0/Add Role — `200-permissions-d0-add-role.png`
- **[PASS]** d1/Cancel — `202-permissions-d1-cancel.png`
- **[PASS]** d0/Save changes — `203-permissions-d0-save-changes.png`
- **[PASS]** d0/Reset to defaults — `204-permissions-d0-reset-to-defaults.png`

### Settings (47 actions)
- **[PASS]** open — `205-settings-land.png`
- **[PASS]** d0/Assignments — `206-settings-d0-assignments.png`
- **[PASS]** d0/Save Changes — `208-settings-d0-save-changes.png`
- **[PASS]** d0/Branding — `209-settings-d0-branding.png`
- **[PASS]** d0/Locale & Timezone — `210-settings-d0-locale-timezone.png`
- **[PASS]** d0/Timesheets — `211-settings-d0-timesheets.png`
- **[PASS]** d0/Authentication — `212-settings-d0-authentication.png`
- **[PASS]** d0/Sessions & Devices — `213-settings-d0-sessions-devices.png`
- **[PASS]** d0/In-app Preferences — `214-settings-d0-in-app-preferences.png`
- **[PASS]** d0/Email — `215-settings-d0-email.png`
- **[PASS]** d0/Storage — `216-settings-d0-storage.png`
- **[PASS]** d0/Webhooks — `217-settings-d0-webhooks.png`
- … +35 more

### Settings>detail (1 actions)
- **[PASS]** d1/Assignments — `207-settings-detail-d1-assignments.png`

### Settings/branding (20 actions)
- **[PASS]** d0/Assignments — `226-settings-branding-d0-assignments.png`
- **[PASS]** d0/Upload — `227-settings-branding-d0-upload.png`
- **[PASS]** d0/Branding — `228-settings-branding-d0-branding.png`
- **[PASS]** d0/Locale & Timezone — `229-settings-branding-d0-locale-timezone.png`
- **[PASS]** d0/Timesheets — `230-settings-branding-d0-timesheets.png`
- **[PASS]** d0/Authentication — `231-settings-branding-d0-authentication.png`
- **[PASS]** d0/Sessions & Devices — `232-settings-branding-d0-sessions-devices.png`
- **[PASS]** d0/In-app Preferences — `233-settings-branding-d0-in-app-preferences.png`
- **[PASS]** d0/Email — `234-settings-branding-d0-email.png`
- **[PASS]** d0/Storage — `235-settings-branding-d0-storage.png`
- **[PASS]** d0/Webhooks — `236-settings-branding-d0-webhooks.png`
- **[PASS]** d0/Plan — `237-settings-branding-d0-plan.png`
- … +8 more

### Settings/locale (18 actions)
- **[PASS]** d0/Assignments — `247-settings-locale-d0-assignments.png`
- **[PASS]** d0/Save Changes — `248-settings-locale-d0-save-changes.png`
- **[PASS]** d0/Edit — `249-settings-locale-d0-edit.png`
- **[PASS]** d1/Cancel — `251-settings-locale-d1-cancel.png`
- **[PASS]** d0/Branding — `252-settings-locale-d0-branding.png`
- **[PASS]** d0/Locale & Timezone — `253-settings-locale-d0-locale-timezone.png`
- **[PASS]** d0/Timesheets — `254-settings-locale-d0-timesheets.png`
- **[PASS]** d0/Authentication — `255-settings-locale-d0-authentication.png`
- **[PASS]** d0/Sessions & Devices — `256-settings-locale-d0-sessions-devices.png`
- **[PASS]** d0/In-app Preferences — `257-settings-locale-d0-in-app-preferences.png`
- **[PASS]** d0/Email — `258-settings-locale-d0-email.png`
- **[PASS]** d0/Storage — `259-settings-locale-d0-storage.png`
- … +6 more

### Settings/working-hours (16 actions)
- **[PASS]** d0/Assignments — `267-settings-working-hours-d0-assignments.png`
- **[PASS]** d0/Save Changes — `268-settings-working-hours-d0-save-changes.png`
- **[PASS]** d0/Edit — `269-settings-working-hours-d0-edit.png`
- **[PASS]** d0/Branding — `271-settings-working-hours-d0-branding.png`
- **[PASS]** d0/Locale & Timezone — `272-settings-working-hours-d0-locale-timezone.png`
- **[PASS]** d0/Timesheets — `273-settings-working-hours-d0-timesheets.png`
- **[PASS]** d0/Authentication — `274-settings-working-hours-d0-authentication.png`
- **[PASS]** d0/Sessions & Devices — `275-settings-working-hours-d0-sessions-devices.png`
- **[PASS]** d0/In-app Preferences — `276-settings-working-hours-d0-in-app-preferences.png`
- **[PASS]** d0/Email — `277-settings-working-hours-d0-email.png`
- **[PASS]** d0/Storage — `278-settings-working-hours-d0-storage.png`
- **[PASS]** d0/Webhooks — `279-settings-working-hours-d0-webhooks.png`
- … +4 more

### Settings/leave-types (20 actions)
- **[PASS]** d0/Assignments — `285-settings-leave-types-d0-assignments.png`
- **[PASS]** d0/Add Type — `286-settings-leave-types-d0-add-type.png`
- **[PASS]** d1/Cancel — `288-settings-leave-types-d1-cancel.png`
- **[PASS]** d0/Edit — `289-settings-leave-types-d0-edit.png`
- **[PASS]** d1/Save Changes — `291-settings-leave-types-d1-save-changes.png`
- **[PASS]** d2/Cancel — `292-settings-leave-types-d2-cancel.png`
- **[PASS]** d0/Branding — `293-settings-leave-types-d0-branding.png`
- **[PASS]** d0/Locale & Timezone — `294-settings-leave-types-d0-locale-timezone.png`
- **[PASS]** d0/Timesheets — `295-settings-leave-types-d0-timesheets.png`
- **[PASS]** d0/Authentication — `296-settings-leave-types-d0-authentication.png`
- **[PASS]** d0/Sessions & Devices — `297-settings-leave-types-d0-sessions-devices.png`
- **[PASS]** d0/In-app Preferences — `298-settings-leave-types-d0-in-app-preferences.png`
- … +8 more

### Settings/attendance-rules (20 actions)
- **[PASS]** d0/Assignments — `308-settings-attendance-rules-d0-assignments.png`
- **[PASS]** d0/Branding — `309-settings-attendance-rules-d0-branding.png`
- **[PASS]** d0/Locale & Timezone — `310-settings-attendance-rules-d0-locale-timezone.png`
- **[PASS]** d0/Timesheets — `311-settings-attendance-rules-d0-timesheets.png`
- **[PASS]** d0/Authentication — `312-settings-attendance-rules-d0-authentication.png`
- **[PASS]** d0/Sessions & Devices — `313-settings-attendance-rules-d0-sessions-devices.png`
- **[PASS]** d0/In-app Preferences — `314-settings-attendance-rules-d0-in-app-preferences.png`
- **[PASS]** d0/Email — `315-settings-attendance-rules-d0-email.png`
- **[PASS]** d0/Storage — `316-settings-attendance-rules-d0-storage.png`
- **[PASS]** d0/Webhooks — `317-settings-attendance-rules-d0-webhooks.png`
- **[PASS]** d0/Plan — `318-settings-attendance-rules-d0-plan.png`
- **[PASS]** d0/Invoices — `319-settings-attendance-rules-d0-invoices.png`
- … +8 more

### Settings/timesheets (17 actions)
- **[PASS]** d0/Assignments — `329-settings-timesheets-d0-assignments.png`
- **[PASS]** d0/Branding — `330-settings-timesheets-d0-branding.png`
- **[PASS]** d0/Locale & Timezone — `331-settings-timesheets-d0-locale-timezone.png`
- **[PASS]** d0/Timesheets — `332-settings-timesheets-d0-timesheets.png`
- **[PASS]** d0/Authentication — `333-settings-timesheets-d0-authentication.png`
- **[PASS]** d0/Sessions & Devices — `334-settings-timesheets-d0-sessions-devices.png`
- **[PASS]** d0/In-app Preferences — `335-settings-timesheets-d0-in-app-preferences.png`
- **[PASS]** d0/Email — `336-settings-timesheets-d0-email.png`
- **[PASS]** d0/Storage — `337-settings-timesheets-d0-storage.png`
- **[PASS]** d0/Webhooks — `338-settings-timesheets-d0-webhooks.png`
- **[PASS]** d0/Plan — `339-settings-timesheets-d0-plan.png`
- **[PASS]** d0/Invoices — `340-settings-timesheets-d0-invoices.png`
- … +5 more

### Settings/leave-policies (1 actions)
- **[PASS]** d0/Assignments — `347-settings-leave-policies-d0-assignments.png`

### Recruitment (1 actions)
- **[PASS]** open — `369-recruitment-land.png`

### Performance (1 actions)
- **[PASS]** open — `370-performance-land.png`

### Assets (1 actions)
- **[PASS]** open — `371-assets-land.png`

### Announcements (1 actions)
- **[PASS]** open — `372-announcements-land.png`

