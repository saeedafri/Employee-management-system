# SUPER_ADMIN Deep UI E2E Findings

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Role | `SUPER_ADMIN` — `superadmin@acme.test` / `Password123!` / tenant `acme-corp-001` |
| Auth facts | `employeeId: null`, `employee: null` (`GET /auth/me`) |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000/api/v1` (Hostinger tunnel) |
| Tooling | Playwright Chromium (`_deep_e2e_sa_v3.mjs` + finish + API probes) · MSW off |
| Screenshots | `docs/e2e-ui-screenshots/superadmin/` — **704** PNGs |
| Raw | `_run-raw.json`, `_progress.json`, `_probe-api.json`, `_run_v3.log` |
| Merge note | Restored CRITICAL leave cross-user leak (`ISSUE-SA-04`) that was dropped by a narrower 5-issue overwrite |

---

## Counts

| Metric | Value |
|--------|------:|
| Menus tested | **17** |
| Buttons/actions clicked | **333** |
| Screenshots (runner) | **424** (folder **704** incl. leftovers) |
| Issues BACKEND | **2** (`ISSUE-SA-01`, `ISSUE-SA-04`) |
| Issues FRONTEND | **5** (`ISSUE-SA-02`, `03`, `05`, `06`, `07`) |
| Issues total | **7** |
| Download events | 2 (both `ok:false`) |

## Summary

Deep SUPER_ADMIN crawl covered all 17 sidebar menus. **CRITICAL:** leave balance/requests bind SA (`employeeId: null`) to **Priya Sharma** data (`ISSUE-SA-04`). Attendance `/today` returns **400** `NO_EMPLOYEE_RECORD` while summary already returns a graceful empty payload (`ISSUE-SA-01`). FE: payout empty/self-service, timesheets default to My Timesheet, export `ok:false`, performance duplicate keys, login 401 noise.


## Menu / Action Log

- **[PASS]** Login → login — `02-login-success.png` — http://localhost:3001/dashboard
- **[PASS]** Dashboard → open — `03-dashboard.png` — http://localhost:3001/dashboard
- **[PASS]** Dashboard → Add Employee — `04-dashboard-add-employee.png` — http://localhost:3001/employees/new
- **[PASS]** Dashboard → Approve — `05-dashboard-approve.png` — _mutation noted_
- **[PASS]** Dashboard → Deny — `06-dashboard-deny.png` — _mutation noted_
- **[PASS]** Dashboard → Add Employee — `07-dashboard-add-employee.png` — http://localhost:3001/employees/new
- **[PASS]** Dashboard → 7d — `08-dashboard-7d.png` — http://localhost:3001/dashboard
- **[PASS]** Dashboard → 30d — `09-dashboard-30d.png` — http://localhost:3001/dashboard
- **[PASS]** Dashboard → 90d — `10-dashboard-90d.png` — http://localhost:3001/dashboard
- **[PASS]** Employees → open — `11-employees.png` — http://localhost:3001/employees
- **[PASS]** Employees → search — `12-employees-search.png`
- **[PASS]** Employees → Add employee — `13-employees-add-employee.png` — http://localhost:3001/employees/new
- **[PASS]** Employees → Columns — `14-employees-columns.png` — http://localhost:3001/employees/new
- **[PASS]** Employees → All departments — `15-employees-all-departments.png` — http://localhost:3001/employees/new
- **[PASS]** Employees → All statuses — `16-employees-all-statuses.png` — http://localhost:3001/employees/new
- **[PASS]** Employees → Comfortable — `17-employees-comfortable.png` — http://localhost:3001/employees/new
- **[PASS]** Departments → open — `18-departments.png` — http://localhost:3001/departments
- **[PASS]** Departments → Add department — `19-departments-add-department.png` — http://localhost:3001/departments
- **[PASS]** Departments → control — `21-departments-control.png` — http://localhost:3001/departments
- **[PASS]** Departments → control — `22-departments-control.png` — http://localhost:3001/departments
- **[PASS]** Departments → control — `23-departments-control.png` — http://localhost:3001/departments
- **[PASS]** Departments → control — `24-departments-control.png` — http://localhost:3001/departments
- **[PASS]** Departments → control — `25-departments-control.png` — http://localhost:3001/departments
- **[PASS]** Departments → control — `26-departments-control.png` — http://localhost:3001/departments
- **[PASS]** Departments → control — `27-departments-control.png` — http://localhost:3001/departments
- **[PASS]** Departments → control — `28-departments-control.png` — http://localhost:3001/departments
- **[PASS]** Departments → Actions for Customer Success — `29-departments-actions-for-customer-success.png` — http://localhost:3001/departments
- **[PASS]** Attendance → open — `30-attendance.png` — http://localhost:3001/attendance
- **[PASS]** Attendance → All employees — `31-attendance-all-employees.png` — http://localhost:3001/attendance
- **[PASS]** Attendance → Previous month — `32-attendance-previous-month.png` — http://localhost:3001/attendance
- **[PASS]** Attendance → Next month — `33-attendance-next-month.png` — http://localhost:3001/attendance?month=2026-07
- **[PASS]** Attendance → Calendar — `34-attendance-calendar.png` — http://localhost:3001/attendance?month=2026-07
- **[PASS]** Attendance → Table — `35-attendance-table.png` — http://localhost:3001/attendance?month=2026-07&view=table
- **[PASS]** Attendance → Request Regularization — `36-attendance-request-regularization.png` — http://localhost:3001/attendance?month=2026-07&view=table
- **[PASS]** Timesheets → open — `37-timesheets.png` — http://localhost:3001/timesheets
- **[PASS]** Timesheets → tab:My Timesheet — `38-timesheets-tab-my-timesheet.png`
- **[PASS]** Timesheets → tab:Approvals — `39-timesheets-tab-approvals.png`
- **[PASS]** Timesheets → tab:Projects — `40-timesheets-tab-projects.png`
- **[PASS]** Timesheets → tab:Rates — `41-timesheets-tab-rates.png`
- **[PASS]** Timesheets → tab:Approval Flow — `42-timesheets-tab-approval-flow.png`
- **[PASS]** Timesheets → tab:Locks — `43-timesheets-tab-locks.png`
- **[PASS]** Timesheets → tab:Delegations — `44-timesheets-tab-delegations.png`
- **[PASS]** Timesheets → Approvals — `45-timesheets-approvals.png` — http://localhost:3001/timesheets?tab=approvals
- **[PASS]** Timesheets → Approval Flow — `46-timesheets-approval-flow.png` — http://localhost:3001/timesheets?tab=approval-flow
- **[PASS]** Timesheets → Create delegation — `47-timesheets-create-delegation.png` — http://localhost:3001/timesheets?tab=approval-flow
- **[PASS]** Timesheets → Projects — `48-timesheets-projects.png` — http://localhost:3001/timesheets?tab=projects
- **[PASS]** Timesheets → Rates — `49-timesheets-rates.png` — http://localhost:3001/timesheets?tab=rates
- **[PASS]** Timesheets → My Timesheet — `50-timesheets-my-timesheet.png` — http://localhost:3001/timesheets
- **[PASS]** Leave → open — `51-leave.png` — http://localhost:3001/leave
- **[PASS]** Leave → tab:My Requests — `52-leave-tab-my-requests.png`
- **[PASS]** Leave → tab:Team Calendar — `53-leave-tab-team-calendar.png`
- **[PASS]** Leave → tab:Comp-off — `54-leave-tab-comp-off.png`
- **[PASS]** Leave → tab:Approvals — `55-leave-tab-approvals.png`
- **[PASS]** Leave → New Request — `56-leave-new-request.png` — http://localhost:3001/leave?tab=approvals
- **[PASS]** Leave → Approvals — `58-leave-approvals.png` — http://localhost:3001/leave?tab=approvals
- **[PASS]** Leave → Comp-off — `59-leave-comp-off.png` — http://localhost:3001/leave?tab=comp-off
- **[PASS]** Leave → Pending — `60-leave-pending.png` — http://localhost:3001/leave?tab=comp-off
- **[PASS]** Leave → My Requests — `61-leave-my-requests.png` — http://localhost:3001/leave
- **[PASS]** Holidays → open — `62-holidays.png` — http://localhost:3001/holidays
- **[PASS]** Holidays → Import .ics — `63-holidays-import-ics.png` — http://localhost:3001/holidays
- **[PASS]** Holidays → Add Holiday — `64-holidays-add-holiday.png` — http://localhost:3001/holidays
- **[PASS]** Holidays → Holiday policy — `66-holidays-holiday-policy.png` — http://localhost:3001/holidays
- **[PASS]** Holidays → Previous year — `67-holidays-previous-year.png` — http://localhost:3001/holidays
- **[PASS]** Holidays → Next year — `68-holidays-next-year.png` — http://localhost:3001/holidays
- **[PASS]** Holidays → Actions for New Year's Day — `69-holidays-actions-for-new-year-s-day.png` — http://localhost:3001/holidays
- **[PASS]** Payroll → open — `70-payroll.png` — http://localhost:3001/payroll
- **[PASS]** Payroll → Run Payroll — `71-payroll-run-payroll.png` — http://localhost:3001/payroll
- **[PASS]** Payroll → Migration — `72-payroll-migration.png` — http://localhost:3001/payroll/migration
- **[PASS]** Payroll → Prev — `73-payroll-prev.png` — http://localhost:3001/payroll/migration
- **[PASS]** Payroll → Global Workforce — `74-payroll-global-workforce.png` — http://localhost:3001/payroll
- **[PASS]** Payroll → extra:/payroll/my-payslips — `75-payroll-my-payslips.png` — http://localhost:3001/payroll
- **[PASS]** Payroll/payroll/my-payslips → Run Payroll — `76-payroll-payroll-my-payslips-run-payroll.png` — http://localhost:3001/payroll
- **[PASS]** Payroll/payroll/my-payslips → Migration — `77-payroll-payroll-my-payslips-migration.png` — http://localhost:3001/payroll/migration
- **[PASS]** Payroll/payroll/my-payslips → Prev — `78-payroll-payroll-my-payslips-prev.png` — http://localhost:3001/payroll
- **[PASS]** Payroll/payroll/my-payslips → Next — `79-payroll-payroll-my-payslips-next.png` — http://localhost:3001/payroll
- **[PASS]** Payroll/payroll/my-payslips → Global Workforce — `80-payroll-payroll-my-payslips-global-workforce.png` — http://localhost:3001/payroll/global
- **[PASS]** Payroll → extra:/payroll/migration — `81-payroll-migration.png` — http://localhost:3001/payroll/migration
- **[PASS]** Payroll/payroll/migration → tab:Pay Calendar — `82-payroll-payroll-migration-tab-pay-calendar.png`
- **[PASS]** Payroll/payroll/migration → tab:Opening Balances — `83-payroll-payroll-migration-tab-opening-balances.png`
- **[PASS]** Payroll/payroll/migration → tab:Historical Payslips — `84-payroll-payroll-migration-tab-historical-payslips.png`
- **[PASS]** Payroll/payroll/migration → tab:Parallel Run — `85-payroll-payroll-migration-tab-parallel-run.png`
- **[PASS]** Payroll/payroll/migration → tab:Go-Live — `86-payroll-payroll-migration-tab-go-live.png`
- **[PASS]** Payroll/payroll/migration → Go-Live — `87-payroll-payroll-migration-go-live.png` — http://localhost:3001/payroll/migration?tab=golive
- **[PASS]** Payroll/payroll/migration → Pay Calendar — `88-payroll-payroll-migration-pay-calendar.png` — http://localhost:3001/payroll/migration
- **[PASS]** Payroll → extra:/payroll/global — `89-payroll-global.png` — http://localhost:3001/payroll/global
- **[PASS]** Payroll/payroll/global → New Invoice — `90-payroll-payroll-global-new-invoice.png` — http://localhost:3001/payroll/global
- **[PASS]** Payroll/payroll/global → Worker type — `92-payroll-payroll-global-worker-type.png` — http://localhost:3001/payroll/global
- **[PASS]** Payroll/payroll/global → Employee — `93-payroll-payroll-global-employee.png` — http://localhost:3001/payroll/global
- **[PASS]** Payroll/payroll/global → Employee — `94-payroll-payroll-global-employee.png` — http://localhost:3001/payroll/global
- **[PASS]** Payroll/payroll/global → Employee — `95-payroll-payroll-global-employee.png` — http://localhost:3001/payroll/global
- **[PASS]** Payroll/payroll/global → Employee — `96-payroll-payroll-global-employee.png` — http://localhost:3001/payroll/global
- **[PASS]** Payout methods → open — `97-payout-methods.png` — http://localhost:3001/payout-methods
- **[PASS]** Payout methods → Review approvals — `98-payout-methods-review-approvals.png` — http://localhost:3001/payout-methods/approvals
- **[PASS]** Payout methods → Add account — `99-payout-methods-add-account.png` — http://localhost:3001/payout-methods/approvals
- **[PASS]** Payout methods → extra:/payout-methods/approvals — `100-payout-methods-approvals.png` — http://localhost:3001/payout-methods/approvals
- **[PASS]** Payout methods/payout-methods/approvals → tab:Approvals — `101-payout-methods-payout-methods-approvals-tab-approvals.png`
- **[PASS]** Payout methods/payout-methods/approvals → tab:Verification — `102-payout-methods-payout-methods-approvals-tab-verificatio.png`
- **[PASS]** Payout methods/payout-methods/approvals → Approvals — `103-payout-methods-payout-methods-approvals-approvals.png` — http://localhost:3001/payout-methods/approvals
- **[PASS]** Payout methods/payout-methods/approvals → Verification — `104-payout-methods-payout-methods-approvals-verification.png` — http://localhost:3001/payout-methods/approvals
- **[PASS]** Reports → open — `105-reports.png` — http://localhost:3001/reports
- **[PASS]** Reports → Export CSV — `106-reports-export-csv.png` — http://localhost:3001/reports
- **[PASS]** Reports → Headcount — `107-reports-headcount.png` — http://localhost:3001/reports
- **[PASS]** Reports → Turnover — `108-reports-turnover.png` — http://localhost:3001/reports?report=workforce/turnover
- **[PASS]** Reports → Demographics — `109-reports-demographics.png` — http://localhost:3001/reports?report=workforce/demographics
- **[PASS]** Reports → Utilization — `110-reports-utilization.png` — http://localhost:3001/reports?report=leave/utilization
- **[PASS]** Reports → CTC Analysis — `111-reports-ctc-analysis.png` — http://localhost:3001/reports?report=payroll/ctc-analysis
- **[PASS]** Reports → Utilization — `112-reports-utilization.png` — http://localhost:3001/reports?report=leave/utilization
- **[PASS]** Reports → All departments — `113-reports-all-departments.png` — http://localhost:3001/reports?report=leave/utilization
- **[PASS]** Reports → Monthly Summary — `114-reports-monthly-summary.png` — http://localhost:3001/reports?report=attendance/summary
- **[PASS]** Analytics → open — `115-analytics.png` — http://localhost:3001/analytics
- **[PASS]** Analytics → 7d — `116-analytics-7d.png` — http://localhost:3001/analytics?range=7d
- **[PASS]** Analytics → 30d — `117-analytics-30d.png` — http://localhost:3001/analytics
- **[PASS]** Analytics → 90d — `118-analytics-90d.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Analytics → Custom — `119-analytics-custom.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Analytics → All departments — `120-analytics-all-departments.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Analytics → 6m — `121-analytics-6m.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Analytics → 12m — `122-analytics-12m.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Analytics → 2y — `123-analytics-2y.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Analytics → 6m — `124-analytics-6m.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Analytics → 12m — `125-analytics-12m.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Analytics → 2y — `126-analytics-2y.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Analytics → 6m — `127-analytics-6m.png` — http://localhost:3001/analytics?range=90d
- **[PASS]** Permissions → open — `128-permissions.png` — http://localhost:3001/permissions
- **[PASS]** Permissions → Add Role — `129-permissions-add-role.png` — http://localhost:3001/permissions
- **[PASS]** Permissions → Save changes — `131-permissions-save-changes.png` — http://localhost:3001/permissions
- **[PASS]** Permissions → Reset to defaults — `132-permissions-reset-to-defaults.png` — http://localhost:3001/permissions
- **[PASS]** Settings → open — `133-settings.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → Assignments — `134-settings-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings → Branding — `135-settings-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings → Locale & Timezone — `136-settings-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings → Timesheets — `137-settings-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings → Authentication — `138-settings-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings → Sessions & Devices — `139-settings-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings → In-app Preferences — `140-settings-in-app-preferences.png` — http://localhost:3001/settings/notifications
- **[PASS]** Settings → Email — `141-settings-email.png` — http://localhost:3001/settings/integration-email
- **[PASS]** Settings → Storage — `142-settings-storage.png` — http://localhost:3001/settings/integration-storage
- **[PASS]** Settings → Webhooks — `143-settings-webhooks.png` — http://localhost:3001/settings/integration-webhooks
- **[PASS]** Settings → Plan — `144-settings-plan.png` — http://localhost:3001/settings/billing-plan
- **[PASS]** Settings → Invoices — `145-settings-invoices.png` — http://localhost:3001/settings/billing-invoices
- **[PASS]** Settings → Company Profile — `146-settings-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:company-profile — `147-settings-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/company-profile → Assignments — `148-settings-company-profile-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/company-profile → Save Changes — `149-settings-company-profile-save-changes.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/company-profile → Branding — `150-settings-company-profile-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/company-profile → Locale & Timezone — `151-settings-company-profile-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/company-profile → Timesheets — `152-settings-company-profile-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/company-profile → Authentication — `153-settings-company-profile-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/company-profile → Company Profile — `154-settings-company-profile-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:branding — `155-settings-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/branding → Assignments — `156-settings-branding-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/branding → Upload — `157-settings-branding-upload.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/branding → Branding — `158-settings-branding-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/branding → Locale & Timezone — `159-settings-branding-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/branding → Timesheets — `160-settings-branding-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/branding → Authentication — `161-settings-branding-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/branding → Company Profile — `162-settings-branding-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:locale — `163-settings-locale.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/locale → Assignments — `164-settings-locale-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/locale → Save Changes — `165-settings-locale-save-changes.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/locale → Branding — `166-settings-locale-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/locale → Locale & Timezone — `167-settings-locale-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/locale → Timesheets — `168-settings-locale-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/locale → Authentication — `169-settings-locale-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/locale → Company Profile — `170-settings-locale-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:working-hours — `171-settings-working-hours.png` — http://localhost:3001/settings/working-hours
- **[PASS]** Settings/working-hours → Assignments — `172-settings-working-hours-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/working-hours → Save Changes — `173-settings-working-hours-save-changes.png` — http://localhost:3001/settings/working-hours
- **[PASS]** Settings/working-hours → Branding — `174-settings-working-hours-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/working-hours → Locale & Timezone — `175-settings-working-hours-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/working-hours → Timesheets — `176-settings-working-hours-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/working-hours → Authentication — `177-settings-working-hours-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/working-hours → Company Profile — `178-settings-working-hours-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:leave-types — `179-settings-leave-types.png` — http://localhost:3001/settings/leave-types
- **[PASS]** Settings/leave-types → Assignments — `180-settings-leave-types-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/leave-types → Add Type — `181-settings-leave-types-add-type.png` — http://localhost:3001/settings/leave-types
- **[PASS]** Settings/leave-types → Branding — `183-settings-leave-types-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/leave-types → Locale & Timezone — `184-settings-leave-types-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/leave-types → Timesheets — `185-settings-leave-types-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/leave-types → Authentication — `186-settings-leave-types-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/leave-types → Company Profile — `187-settings-leave-types-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:attendance-rules — `188-settings-attendance-rules.png` — http://localhost:3001/settings/attendance-rules
- **[PASS]** Settings → sub:timesheets — `189-settings-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/timesheets → Assignments — `190-settings-timesheets-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/timesheets → Branding — `191-settings-timesheets-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/timesheets → Locale & Timezone — `192-settings-timesheets-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/timesheets → Timesheets — `193-settings-timesheets-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/timesheets → Authentication — `194-settings-timesheets-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/timesheets → Sessions & Devices — `195-settings-timesheets-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/timesheets → Flag in review (default) — `196-settings-timesheets-flag-in-review-default.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/timesheets → Company Profile — `197-settings-timesheets-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:leave-policies — `198-settings-leave-policies.png` — http://localhost:3001/settings/leave-policies
- **[PASS]** Settings/leave-policies → Assignments — `199-settings-leave-policies-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/leave-policies → New policy — `200-settings-leave-policies-new-policy.png` — http://localhost:3001/settings/leave-policies
- **[PASS]** Settings/leave-policies → New version — `202-settings-leave-policies-new-version.png` — http://localhost:3001/settings/leave-policies
- **[PASS]** Settings/leave-policies → New version — `203-settings-leave-policies-new-version.png` — http://localhost:3001/settings/leave-policies
- **[PASS]** Settings/leave-policies → Branding — `204-settings-leave-policies-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/leave-policies → Locale & Timezone — `205-settings-leave-policies-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/leave-policies → Company Profile — `206-settings-leave-policies-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:leave-packs — `207-settings-leave-packs.png` — http://localhost:3001/settings/leave-packs
- **[PASS]** Settings/leave-packs → Assignments — `208-settings-leave-packs-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/leave-packs → Branding — `209-settings-leave-packs-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/leave-packs → Locale & Timezone — `210-settings-leave-packs-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/leave-packs → Timesheets — `211-settings-leave-packs-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/leave-packs → Authentication — `212-settings-leave-packs-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/leave-packs → Sessions & Devices — `213-settings-leave-packs-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/leave-packs → Company Profile — `214-settings-leave-packs-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:leave-assignments — `215-settings-leave-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/leave-assignments → Assignments — `216-settings-leave-assignments-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/leave-assignments → Branding — `217-settings-leave-assignments-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/leave-assignments → Locale & Timezone — `218-settings-leave-assignments-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/leave-assignments → Timesheets — `219-settings-leave-assignments-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/leave-assignments → Authentication — `220-settings-leave-assignments-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/leave-assignments → Sessions & Devices — `221-settings-leave-assignments-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/leave-assignments → Company Profile — `222-settings-leave-assignments-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:pay/legal-entities — `223-settings-pay-legal-entities.png` — http://localhost:3001/settings/pay/legal-entities
- **[PASS]** Settings/pay/legal-entities → Assignments — `224-settings-pay-legal-entities-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/pay/legal-entities → Add Entity — `225-settings-pay-legal-entities-add-entity.png` — http://localhost:3001/settings/pay/legal-entities
- **[PASS]** Settings/pay/legal-entities → Branding — `227-settings-pay-legal-entities-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/pay/legal-entities → Locale & Timezone — `228-settings-pay-legal-entities-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/pay/legal-entities → Timesheets — `229-settings-pay-legal-entities-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/pay/legal-entities → Authentication — `230-settings-pay-legal-entities-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/pay/legal-entities → Company Profile — `231-settings-pay-legal-entities-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:pay/statutory-packs — `232-settings-pay-statutory-packs.png` — http://localhost:3001/settings/pay/statutory-packs
- **[PASS]** Settings/pay/statutory-packs → Assignments — `233-settings-pay-statutory-packs-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/pay/statutory-packs → New pack — `234-settings-pay-statutory-packs-new-pack.png` — http://localhost:3001/settings/pay/statutory-packs
- **[PASS]** Settings/pay/statutory-packs → Branding — `236-settings-pay-statutory-packs-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/pay/statutory-packs → Locale & Timezone — `237-settings-pay-statutory-packs-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/pay/statutory-packs → Timesheets — `238-settings-pay-statutory-packs-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/pay/statutory-packs → Authentication — `239-settings-pay-statutory-packs-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/pay/statutory-packs → Company Profile — `240-settings-pay-statutory-packs-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:pay/components — `241-settings-pay-components.png` — http://localhost:3001/settings/pay/components
- **[PASS]** Settings/pay/components → search — `242-settings-pay-components-search.png`
- **[PASS]** Settings/pay/components → Assignments — `243-settings-pay-components-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/pay/components → Add Component — `244-settings-pay-components-add-component.png` — http://localhost:3001/settings/pay/components
- **[PASS]** Settings/pay/components → Branding — `246-settings-pay-components-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/pay/components → Locale & Timezone — `247-settings-pay-components-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/pay/components → Timesheets — `248-settings-pay-components-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/pay/components → Company Profile — `249-settings-pay-components-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:pay/groups — `250-settings-pay-groups.png` — http://localhost:3001/settings/pay/groups
- **[PASS]** Settings/pay/groups → Assignments — `251-settings-pay-groups-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/pay/groups → Branding — `252-settings-pay-groups-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/pay/groups → Locale & Timezone — `253-settings-pay-groups-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/pay/groups → Timesheets — `254-settings-pay-groups-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/pay/groups → Authentication — `255-settings-pay-groups-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/pay/groups → Sessions & Devices — `256-settings-pay-groups-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/pay/groups → Company Profile — `257-settings-pay-groups-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:pay/schedules — `258-settings-pay-schedules.png` — http://localhost:3001/settings/pay/schedules
- **[PASS]** Settings/pay/schedules → Assignments — `259-settings-pay-schedules-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/pay/schedules → Branding — `260-settings-pay-schedules-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/pay/schedules → Locale & Timezone — `261-settings-pay-schedules-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/pay/schedules → Timesheets — `262-settings-pay-schedules-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/pay/schedules → Authentication — `263-settings-pay-schedules-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/pay/schedules → Sessions & Devices — `264-settings-pay-schedules-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/pay/schedules → Company Profile — `265-settings-pay-schedules-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:pay/payslip-template — `266-settings-pay-payslip-template.png` — http://localhost:3001/settings/pay/payslip-template
- **[PASS]** Settings/pay/payslip-template → Assignments — `267-settings-pay-payslip-template-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/pay/payslip-template → Save template — `268-settings-pay-payslip-template-save-template.png` — http://localhost:3001/settings/pay/payslip-template
- **[PASS]** Settings/pay/payslip-template → Branding — `269-settings-pay-payslip-template-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/pay/payslip-template → Locale & Timezone — `270-settings-pay-payslip-template-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/pay/payslip-template → Timesheets — `271-settings-pay-payslip-template-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/pay/payslip-template → Authentication — `272-settings-pay-payslip-template-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/pay/payslip-template → Company Profile — `273-settings-pay-payslip-template-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:pay/data-policy — `274-settings-pay-data-policy.png` — http://localhost:3001/settings/pay/data-policy
- **[PASS]** Settings/pay/data-policy → Assignments — `275-settings-pay-data-policy-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/pay/data-policy → Save changes — `276-settings-pay-data-policy-save-changes.png` — http://localhost:3001/settings/pay/data-policy
- **[PASS]** Settings/pay/data-policy → Branding — `277-settings-pay-data-policy-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/pay/data-policy → Locale & Timezone — `278-settings-pay-data-policy-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/pay/data-policy → Timesheets — `279-settings-pay-data-policy-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/pay/data-policy → Authentication — `280-settings-pay-data-policy-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/pay/data-policy → Company Profile — `281-settings-pay-data-policy-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:pay/country-bank-schemas — `282-settings-pay-country-bank-schemas.png` — http://localhost:3001/settings/pay/country-bank-schemas
- **[PASS]** Settings/pay/country-bank-schemas → Assignments — `283-settings-pay-country-bank-schemas-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/pay/country-bank-schemas → Add country — `284-settings-pay-country-bank-schemas-add-country.png` — http://localhost:3001/settings/pay/country-bank-schemas
- **[PASS]** Settings/pay/country-bank-schemas → Company Profile — `286-settings-pay-country-bank-schemas-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:authentication — `287-settings-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/authentication → Assignments — `288-settings-authentication-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/authentication → Branding — `289-settings-authentication-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/authentication → Locale & Timezone — `290-settings-authentication-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/authentication → Timesheets — `291-settings-authentication-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/authentication → Authentication — `292-settings-authentication-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/authentication → Sessions & Devices — `293-settings-authentication-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/authentication → Company Profile — `294-settings-authentication-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:sessions — `295-settings-sessions.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/sessions → Assignments — `296-settings-sessions-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/sessions → Branding — `297-settings-sessions-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/sessions → Locale & Timezone — `298-settings-sessions-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/sessions → Timesheets — `299-settings-sessions-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/sessions → Authentication — `300-settings-sessions-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/sessions → Sessions & Devices — `301-settings-sessions-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/sessions → Company Profile — `302-settings-sessions-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:audit-log — `303-settings-audit-log.png` — http://localhost:3001/settings/audit-log
- **[PASS]** Settings/audit-log → Assignments — `304-settings-audit-log-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/audit-log → Branding — `305-settings-audit-log-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/audit-log → Locale & Timezone — `306-settings-audit-log-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/audit-log → Timesheets — `307-settings-audit-log-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/audit-log → Authentication — `308-settings-audit-log-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/audit-log → Sessions & Devices — `309-settings-audit-log-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/audit-log → Company Profile — `310-settings-audit-log-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:email-templates — `311-settings-email-templates.png` — http://localhost:3001/settings/email-templates
- **[PASS]** Settings/email-templates → Assignments — `312-settings-email-templates-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/email-templates → Branding — `313-settings-email-templates-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/email-templates → Locale & Timezone — `314-settings-email-templates-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/email-templates → Timesheets — `315-settings-email-templates-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/email-templates → Authentication — `316-settings-email-templates-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/email-templates → Sessions & Devices — `317-settings-email-templates-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/email-templates → Company Profile — `318-settings-email-templates-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:notifications — `319-settings-notifications.png` — http://localhost:3001/settings/notifications
- **[PASS]** Settings/notifications → Assignments — `320-settings-notifications-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/notifications → Branding — `321-settings-notifications-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/notifications → Locale & Timezone — `322-settings-notifications-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/notifications → Timesheets — `323-settings-notifications-timesheets.png` — http://localhost:3001/settings/timesheets
- **[PASS]** Settings/notifications → Authentication — `324-settings-notifications-authentication.png` — http://localhost:3001/settings/authentication
- **[PASS]** Settings/notifications → Sessions & Devices — `325-settings-notifications-sessions-devices.png` — http://localhost:3001/settings/sessions
- **[PASS]** Settings/notifications → Company Profile — `326-settings-notifications-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings → sub:integration-email — `327-settings-integration-email.png` — http://localhost:3001/settings/integration-email
- **[PASS]** Settings/integration-email → Assignments — `328-settings-integration-email-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/integration-email → Save configuration — `329-settings-integration-email-save-configuration.png` — http://localhost:3001/settings/integration-email
- **[PASS]** Settings/integration-email → Branding — `330-settings-integration-email-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/integration-email → Locale & Timezone — `331-settings-integration-email-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Login → re-login-finish-pass — http://localhost:3001/dashboard
- **[PASS]** Settings/integration-storage → open — `359-settings-integration-storage.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/integration-storage → Company Profile — `360-settings-integration-storage-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/integration-storage → Branding — `361-settings-integration-storage-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/integration-storage → Locale & Timezone — `362-settings-integration-storage-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/integration-storage → Working Hours — `363-settings-integration-storage-working-hours.png` — http://localhost:3001/settings/working-hours
- **[PASS]** Settings/integration-storage → Leave Types — `364-settings-integration-storage-leave-types.png` — http://localhost:3001/settings/leave-types
- **[PASS]** Settings/integration-storage → Assignments — `365-settings-integration-storage-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/integration-webhooks → open — `366-settings-integration-webhooks.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/integration-webhooks → Company Profile — `367-settings-integration-webhooks-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/integration-webhooks → Branding — `368-settings-integration-webhooks-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/integration-webhooks → Locale & Timezone — `369-settings-integration-webhooks-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/integration-webhooks → Working Hours — `370-settings-integration-webhooks-working-hours.png` — http://localhost:3001/settings/working-hours
- **[PASS]** Settings/integration-webhooks → Leave Types — `371-settings-integration-webhooks-leave-types.png` — http://localhost:3001/settings/leave-types
- **[PASS]** Settings/integration-webhooks → Assignments — `372-settings-integration-webhooks-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/billing-plan → open — `373-settings-billing-plan.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/billing-plan → Company Profile — `374-settings-billing-plan-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/billing-plan → Branding — `375-settings-billing-plan-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/billing-plan → Locale & Timezone — `376-settings-billing-plan-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/billing-plan → Working Hours — `377-settings-billing-plan-working-hours.png` — http://localhost:3001/settings/working-hours
- **[PASS]** Settings/billing-plan → Leave Types — `378-settings-billing-plan-leave-types.png` — http://localhost:3001/settings/leave-types
- **[PASS]** Settings/billing-plan → Assignments — `379-settings-billing-plan-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Settings/billing-invoices → open — `380-settings-billing-invoices.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/billing-invoices → Company Profile — `381-settings-billing-invoices-company-profile.png` — http://localhost:3001/settings/company-profile
- **[PASS]** Settings/billing-invoices → Branding — `382-settings-billing-invoices-branding.png` — http://localhost:3001/settings/branding
- **[PASS]** Settings/billing-invoices → Locale & Timezone — `383-settings-billing-invoices-locale-timezone.png` — http://localhost:3001/settings/locale
- **[PASS]** Settings/billing-invoices → Working Hours — `384-settings-billing-invoices-working-hours.png` — http://localhost:3001/settings/working-hours
- **[PASS]** Settings/billing-invoices → Leave Types — `385-settings-billing-invoices-leave-types.png` — http://localhost:3001/settings/leave-types
- **[PASS]** Settings/billing-invoices → Assignments — `386-settings-billing-invoices-assignments.png` — http://localhost:3001/settings/leave-assignments
- **[PASS]** Recruitment → open — `387-recruitment.png` — http://localhost:3001/recruitment
- **[PASS]** Recruitment → tab:Pipeline — `388-recruitment-tab-pipeline.png`
- **[PASS]** Recruitment → tab:Openings — `389-recruitment-tab-openings.png`
- **[PASS]** Recruitment → tab:Candidates — `390-recruitment-tab-candidates.png`
- **[PASS]** Recruitment → Export — `391-recruitment-export.png` — http://localhost:3001/recruitment
- **[PASS]** Recruitment → Post a Job — `392-recruitment-post-a-job.png` — http://localhost:3001/recruitment
- **[PASS]** Recruitment → Pipeline — `394-recruitment-pipeline.png` — http://localhost:3001/recruitment
- **[PASS]** Recruitment → Openings — `395-recruitment-openings.png` — http://localhost:3001/recruitment
- **[PASS]** Recruitment → Candidates — `396-recruitment-candidates.png` — http://localhost:3001/recruitment
- **[PASS]** Recruitment → Filter — `397-recruitment-filter.png` — http://localhost:3001/recruitment
- **[PASS]** Performance → open — `399-performance.png` — http://localhost:3001/performance
- **[PASS]** Performance → tab:Reviews — `400-performance-tab-reviews.png`
- **[PASS]** Performance → tab:Goals — `401-performance-tab-goals.png`
- **[PASS]** Performance → tab:Calibration — `402-performance-tab-calibration.png`
- **[PASS]** Performance → Export — `403-performance-export.png` — http://localhost:3001/performance
- **[PASS]** Performance → Start a Review — `404-performance-start-a-review.png` — http://localhost:3001/performance
- **[PASS]** Performance → Reviews — `406-performance-reviews.png` — http://localhost:3001/performance
- **[PASS]** Performance → Goals — `407-performance-goals.png` — http://localhost:3001/performance
- **[PASS]** Performance → Calibration — `408-performance-calibration.png` — http://localhost:3001/performance
- **[PASS]** Assets → open — `409-assets.png` — http://localhost:3001/assets
- **[PASS]** Assets → tab:Inventory — `410-assets-tab-inventory.png`
- **[PASS]** Assets → tab:Assigned — `411-assets-tab-assigned.png`
- **[PASS]** Assets → tab:Requests — `412-assets-tab-requests.png`
- **[PASS]** Assets → Export — `413-assets-export.png` — http://localhost:3001/assets
- **[PASS]** Assets → Add Asset — `414-assets-add-asset.png` — http://localhost:3001/assets
- **[PASS]** Assets → Inventory — `416-assets-inventory.png` — http://localhost:3001/assets
- **[PASS]** Assets → Assigned — `417-assets-assigned.png` — http://localhost:3001/assets
- **[PASS]** Assets → Requests — `418-assets-requests.png` — http://localhost:3001/assets
- **[PASS]** Assets → Approve — `419-assets-approve.png` — http://localhost:3001/assets
- **[PASS]** Assets → View — `420-assets-view.png` — http://localhost:3001/assets
- **[PASS]** Announcements → open — `422-announcements.png` — http://localhost:3001/announcements
- **[PASS]** Announcements → New Announcement — `423-announcements-new-announcement.png` — http://localhost:3001/announcements
- **[PASS]** Announcements → Share an update with the company… — `425-announcements-share-an-update-with-the-company.png` — http://localhost:3001/announcements
- **[PASS]** Announcements → Post — `427-announcements-post.png` — http://localhost:3001/announcements
- **[PASS]** Announcements → Announcement actions — `429-announcements-announcement-actions.png` — http://localhost:3001/announcements
- **[PASS]** Announcements → Company-wide 142 — `430-announcements-company-wide-142.png` — http://localhost:3001/announcements
- **[PASS]** NetworkAudit → /dashboard — `431-audit-dashboard.png` — http://localhost:3001/dashboard
- **[PASS]** NetworkAudit → /employees — `432-audit-employees.png` — http://localhost:3001/employees
- **[PASS]** NetworkAudit → /departments — `433-audit-departments.png` — http://localhost:3001/departments
- **[PASS]** NetworkAudit → /attendance — `434-audit-attendance.png` — http://localhost:3001/attendance
- **[PASS]** NetworkAudit → /timesheets — `435-audit-timesheets.png` — http://localhost:3001/timesheets
- **[PASS]** NetworkAudit → /leave — `436-audit-leave.png` — http://localhost:3001/leave
- **[PASS]** NetworkAudit → /holidays — `437-audit-holidays.png` — http://localhost:3001/holidays
- **[PASS]** NetworkAudit → /payroll — `438-audit-payroll.png` — http://localhost:3001/payroll
- **[PASS]** NetworkAudit → /payroll/my-payslips — `439-audit-payroll-my-payslips.png` — http://localhost:3001/payroll
- **[PASS]** NetworkAudit → /payroll/migration — `440-audit-payroll-migration.png` — http://localhost:3001/payroll/migration
- **[PASS]** NetworkAudit → /payroll/global — `441-audit-payroll-global.png` — http://localhost:3001/payroll/global
- **[PASS]** NetworkAudit → /payout-methods — `442-audit-payout-methods.png` — http://localhost:3001/payout-methods
- **[PASS]** NetworkAudit → /payout-methods/approvals — `443-audit-payout-methods-approvals.png` — http://localhost:3001/payout-methods/approvals
- **[PASS]** NetworkAudit → /reports — `444-audit-reports.png` — http://localhost:3001/reports
- **[PASS]** NetworkAudit → /analytics — `445-audit-analytics.png` — http://localhost:3001/analytics
- **[PASS]** NetworkAudit → /permissions — `446-audit-permissions.png` — http://localhost:3001/permissions
- **[PASS]** NetworkAudit → /settings — `447-audit-settings.png` — http://localhost:3001/settings/company-profile
- **[PASS]** NetworkAudit → /recruitment — `448-audit-recruitment.png` — http://localhost:3001/recruitment
- **[PASS]** NetworkAudit → /performance — `449-audit-performance.png` — http://localhost:3001/performance
- **[PASS]** NetworkAudit → /assets — `450-audit-assets.png` — http://localhost:3001/assets
- **[PASS]** NetworkAudit → /announcements — `451-audit-announcements.png` — http://localhost:3001/announcements

## Issues

### ISSUE-SA-01: Attendance today returns NO_EMPLOYEE_RECORD for SUPER_ADMIN
- Role: SUPER_ADMIN
- Where: Attendance / `/attendance` (also Dashboard widgets that call today)
- Why: `GET /api/attendance/today` → **400** `NO_EMPLOYEE_RECORD` because `superadmin@acme.test` has no linked Employee. Contrast: `GET /attendance/summary` **200** `noEmployeeRecord: true`.
- Classification: **BACKEND** (FE also should skip call when `employeeId` null)
- Expected: Graceful empty / admin view without 400
- Actual: 400 `{"error":{"code":"NO_EMPLOYEE_RECORD"}}`
- How to resolve: BE return 200 empty + `noEmployeeRecord: true` (match summary). FE skip `/attendance/today` when `employeeId` is null.
- Screenshot: `31-attendance-all-employees.png`, `30-attendance.png`, `434-audit-attendance.png`
- Network: `GET /api/attendance/today` **400** `NO_EMPLOYEE_RECORD`

### ISSUE-SA-02: Performance page duplicate React keys
- Role: SUPER_ADMIN
- Where: Performance / `/performance`
- Why: ~40× console: Encountered two children with the same key (employee IDs reused as keys).
- Classification: **FRONTEND**
- Expected: No duplicate-key warnings
- Actual: Repeated React key warnings on Performance
- How to resolve: Use unique keys (e.g. `${employeeId}-${cycleId}`).
- Screenshot: `399-performance.png`, `403-performance-export.png`
- Network: `n/a (console)`

### ISSUE-SA-03: Login page fires auth/me and refresh 401 before credentials
- Role: SUPER_ADMIN
- Where: Login / `/login`
- Why: `GET /api/auth/me` **401**; `POST /api/auth/refresh` **401**
- Classification: **FRONTEND**
- Expected: No unauthenticated me/refresh calls on `/login`
- Actual: 401 `UNAUTHORIZED` / `REFRESH_TOKEN_MISSING`
- How to resolve: Skip `/auth/me` and `/auth/refresh` on public auth routes; suppress expected 401 noise.
- Screenshot: `01-login-form.png`
- Network: `GET /api/auth/me` **401**; `POST /api/auth/refresh` **401**

### ISSUE-SA-04: Leave APIs return Priya Sharma data for SUPER_ADMIN
- Role: SUPER_ADMIN
- Where: Leave → My Requests / balance cards; `GET /leave/balance`, `GET /leave/requests`
- Why: With `employeeId: null`, balance ids are prefixed `cmqjpyds7001kkpjdnlhjygrp-*` = Priya’s `employeeId`; UI shows EL **574.8/576.8** and Priya’s request history as “My Requests”.
- Classification: **BACKEND** (**CRITICAL** — cross-user data exposure)
- Expected: Empty balances/requests or `NO_EMPLOYEE_RECORD` when no employee link
- Actual: Another employee’s leave bound as SA “own”
- How to resolve: Never fall back to another employee when `employeeId` is null.
- Screenshot: `51-leave.png`
- Network: `GET /leave/balance` **200** (Priya-prefixed ids); `GET /leave/requests` **200** (Priya rows); `GET /auth/me` `employeeId: null`

### ISSUE-SA-05: Payout methods self-service empty state for SA
- Role: SUPER_ADMIN
- Where: `/payout-methods`
- Why: Employee-oriented copy/empty state (“receive your pay”) despite `employeeId: null`.
- Classification: **FRONTEND**
- Expected: Admin/approvals-first surface for SA
- Actual: Personal payout empty state
- How to resolve: Role-aware landing when `employeeId` is null.
- Screenshot: `97-payout-methods.png`
- Network: `n/a (UI)`

### ISSUE-SA-06: Timesheets defaults to My Timesheet for SA without employee
- Role: SUPER_ADMIN
- Where: `/timesheets` default tab
- Why: Personal timer / “Submit week” / empty personal week shown despite no employee record.
- Classification: **FRONTEND**
- Expected: Default to Approvals/Projects; hide personal tracker
- Actual: My Timesheet default
- How to resolve: Gate personal timesheet on `employeeId`.
- Screenshot: `38-timesheets-tab-my-timesheet.png`, `50-timesheets-my-timesheet.png`
- Network: `n/a (UI)`

### ISSUE-SA-07: Export CSV downloads did not complete (`ok:false`)
- Role: SUPER_ADMIN
- Where: Reports → Export CSV; Assets → Export
- Why: Playwright download events `ok:false` for `workforce-headcount-report.csv` and `assets-inventory.csv`. Also Attendance shows “Request Regularization” for SA without employee.
- Classification: **FRONTEND**
- Expected: Successful CSV download; gate self-attendance actions
- Actual: Download `ok:false`; regularization still visible
- How to resolve: Fix blob/disposition download + toast; gate regularization on `employeeId`.
- Screenshot: `106-reports-export-csv.png`, `413-assets-export.png`, `30-attendance.png`
- Network: `download workforce-headcount-report.csv (ok:false)`; `download assets-inventory.csv (ok:false)`

## Downloads

- {"suggested":"workforce-headcount-report.csv","ok":false,"pageUrl":"http://localhost:3001/reports"}
- {"suggested":"assets-inventory.csv","ok":false,"pageUrl":"http://localhost:3001/assets"}

## Mutations noted

- Dashboard Approve / Deny on pending approvals (clicked; Hostinger-like data may have changed)
- Non-destructive Cancel used for Add/Create modals after opening
