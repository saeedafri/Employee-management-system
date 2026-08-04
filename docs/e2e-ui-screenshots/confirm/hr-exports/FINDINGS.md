# HR_ADMIN — Deep Export Confirmation

| Field | Value |
|-------|-------|
| Date | 2026-08-03T03:43:40.354Z |
| Role | `HR_ADMIN` — `hr@acme.test` / tenant `acme-corp-001` |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000/api/v1` |
| Scope | Reports (`?report=` panels), Payroll, Employees, Attendance, Leave, Analytics |
| Screenshots | `docs/e2e-ui-screenshots/confirm/hr-exports/` — **105** PNGs |

## Counts

| Metric | Value |
|--------|------:|
| Matrix rows | 30 |
| PASS (download ok) | 13 |
| FAIL (download fail) | 0 |
| WARN (API but no download event) | 1 |
| NO_DOWNLOAD | 0 |
| MISS | 0 |
| NONE (no control) | 16 |
| Download events | 14 (ok:14 / fail:0) |
| Screenshots | 105 |
| Issues BACKEND | 0 |
| Issues FRONTEND | 1 |
| Issues BOTH | 1 |

## Summary

HR_ADMIN export confirmation. Reports use query param `/reports?report=<type>` (path `/reports/...` is 404). Download events: **14/14 ok**. Matrix PASS=13 FAIL=0 WARN=1 NO_DOWNLOAD=0 NONE=16.

## Export / download matrix

| Surface | Page | Control | Status | Download | Screenshot | Note |
|---------|------|---------|--------|----------|------------|------|
| Payroll | list | (none) | NONE | — | `032-payroll-list-no-export.png` | no Export/PDF/Excel/CSV/download control visible |
| Payroll | run-detail | Export Register | PASS | payroll-2026-12-H2.csv ok:true | `037-payroll-run-detail-after-export-register.png` | dl:payroll-2026-12-H2.csv |
| Payroll | run-detail | Export pack | PASS | audit-pack-cmqtilef5001xodfgq1bxxcjv.json ok:true | `039-payroll-run-detail-after-export-pack.png` | dl:audit-pack-cmqtilef5001xodfgq1bxxcjv.json |
| Payroll | my-payslips | (none) | NONE | — | `041-payroll-my-payslips-no-export.png` | no Export/PDF/Excel/CSV/download control visible |
| Employees | list | Export | PASS | employees-2026-08-03.csv ok:true | `044-employees-list-after-export.png` | dl:employees-2026-08-03.csv |
| Attendance | main | (none) | NONE | — | `046-attendance-main-no-export.png` | no Export/PDF/Excel/CSV/download control visible |
| Leave | main | (none) | NONE | — | `048-leave-main-no-export.png` | no Export/PDF/Excel/CSV/download control visible |
| Leave | main-tab-my-requests | (none) | NONE | — | `050-leave-main-tab-my-requests-no-export.png` | no export on tab |
| Leave | main-tab-team-calendar | (none) | NONE | — | `052-leave-main-tab-team-calendar-no-export.png` | no export on tab |
| Leave | main-tab-comp-off | (none) | NONE | — | `054-leave-main-tab-comp-off-no-export.png` | no export on tab |
| Leave | main-tab-approvals | (none) | NONE | — | `056-leave-main-tab-approvals-no-export.png` | no export on tab |
| Analytics | main | (none) | NONE | — | `058-analytics-main-no-export.png` | no Export/PDF/Excel/CSV/download control visible |
| Analytics | range-7d | (none) | NONE | — | `060-analytics-7d-no-export.png` | no export on analytics range |
| Analytics | range-30d | (none) | NONE | — | `062-analytics-30d-no-export.png` | no export on analytics range |
| Analytics | range-90d | (none) | NONE | — | `064-analytics-90d-no-export.png` | no export on analytics range |
| Reports | report-workforce-headcount | Export CSV | PASS | workforce-headcount-report.csv ok:true | `067-reports-report-workforce-headcount-after-export-csv.png` | dl:workforce-headcount-report.csv |
| Reports | report-workforce-turnover | Export CSV | PASS | workforce-turnover-report.csv ok:true | `070-reports-report-workforce-turnover-after-export-csv.png` | dl:workforce-turnover-report.csv |
| Reports | report-workforce-demographics | (none) | NONE | — | `072-reports-report-workforce-demographics-no-export.png` | no Export CSV/PDF/Excel in report content panel |
| Reports | report-attendance-summary | Export CSV | PASS | attendance-summary-report.csv ok:true | `075-reports-report-attendance-summary-after-export-csv.png` | dl:attendance-summary-report.csv |
| Reports | report-attendance-absenteeism | Export CSV | PASS | attendance-absenteeism-report.csv ok:true | `078-reports-report-attendance-absenteeism-after-export-csv.png` | dl:attendance-absenteeism-report.csv |
| Reports | report-leave-utilization | Export CSV | PASS | leave-utilization-report.csv ok:true | `081-reports-report-leave-utilization-after-export-csv.png` | dl:leave-utilization-report.csv |
| Reports | report-leave-pending | (none) | NONE | — | `083-reports-report-leave-pending-no-export.png` | no Export CSV/PDF/Excel in report content panel |
| Reports | report-payroll-summary | Export CSV | PASS | payroll-summary-report.csv ok:true | `086-reports-report-payroll-summary-after-export-csv.png` | dl:payroll-summary-report.csv |
| Reports | report-payroll-ctc-analysis | (none) | NONE | — | `088-reports-report-payroll-ctc-analysis-no-export.png` | no Export CSV/PDF/Excel in report content panel |
| Reports | report-payroll-salary-register | Export CSV | PASS | register-2026-08-SALARY.csv ok:true | `091-reports-report-payroll-salary-register-after-export-csv.png` | dl:register-2026-08-SALARY.csv |
| Reports | report-payroll-statutory-register | Export CSV | PASS | register-2026-08-STATUTORY.csv ok:true | `094-reports-report-payroll-statutory-register-after-export-c.png` | dl:register-2026-08-STATUTORY.csv |
| Reports | report-payroll-bank-advice | Export CSV | PASS | register-2026-08-BANK_ADVICE.csv ok:true | `097-reports-report-payroll-bank-advice-after-export-csv.png` | dl:register-2026-08-BANK_ADVICE.csv |
| Reports | report-payroll-variance-register | Export CSV | PASS | register-2026-08-VARIANCE.csv ok:true | `100-reports-report-payroll-variance-register-after-export-cs.png` | dl:register-2026-08-VARIANCE.csv |
| Reports | report-payroll-pay-equity | (none) | NONE | — | `102-reports-report-payroll-pay-equity-no-export.png` | no Export CSV/PDF/Excel in report content panel |
| Reports | report-timesheets-utilization | Export CSV | WARN | — | `105-reports-report-timesheets-utilization-after-export-csv.png` | api only: 400 POST /api/reports/export |

## Downloads

- `register-2026-08-VARIANCE.csv` ok:true fail:- saved:_dl-register-2026-08-variance-csv-1785728212222 @ http://localhost:3001/reports?report=payroll/variance-register
- `payroll-2026-12-H2.csv` ok:true fail:- saved:_dl-payroll-2026-12-h2-csv-1785728304332 @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `audit-pack-cmqtilef5001xodfgq1bxxcjv.json` ok:true fail:- saved:_dl-audit-pack-cmqtilef5001xodfgq1bxxcjv-json-1785728305068 @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `employees-2026-08-03.csv` ok:true fail:- saved:_dl-employees-2026-08-03-csv-1785728315813 @ http://localhost:3001/employees
- `workforce-headcount-report.csv` ok:true fail:- saved:_dl-workforce-headcount-report-csv-1785728482051 @ http://localhost:3001/reports?report=workforce%2Fheadcount
- `workforce-turnover-report.csv` ok:true fail:- saved:_dl-workforce-turnover-report-csv-1785728489331 @ http://localhost:3001/reports?report=workforce%2Fturnover
- `attendance-summary-report.csv` ok:true fail:- saved:_dl-attendance-summary-report-csv-1785728505806 @ http://localhost:3001/reports?report=attendance%2Fsummary
- `attendance-absenteeism-report.csv` ok:true fail:- saved:_dl-attendance-absenteeism-report-csv-1785728514470 @ http://localhost:3001/reports?report=attendance%2Fabsenteeism
- `leave-utilization-report.csv` ok:true fail:- saved:_dl-leave-utilization-report-csv-1785728522024 @ http://localhost:3001/reports?report=leave%2Futilization
- `payroll-summary-report.csv` ok:true fail:- saved:_dl-payroll-summary-report-csv-1785728538067 @ http://localhost:3001/reports?report=payroll%2Fsummary
- `register-2026-08-SALARY.csv` ok:true fail:- saved:_dl-register-2026-08-salary-csv-1785728560010 @ http://localhost:3001/reports?report=payroll%2Fsalary-register
- `register-2026-08-STATUTORY.csv` ok:true fail:- saved:_dl-register-2026-08-statutory-csv-1785728571468 @ http://localhost:3001/reports?report=payroll%2Fstatutory-register
- `register-2026-08-BANK_ADVICE.csv` ok:true fail:- saved:_dl-register-2026-08-bank-advice-csv-1785728581874 @ http://localhost:3001/reports?report=payroll%2Fbank-advice
- `register-2026-08-VARIANCE.csv` ok:true fail:- saved:_dl-register-2026-08-variance-csv-1785728593963 @ http://localhost:3001/reports?report=payroll%2Fvariance-register

## Discovered controls

- **Payroll** / list (`/payroll`): _none_
- **Payroll** / run-detail (`/payroll/cmqtilef5001xodfgq1bxxcjv`): Export Register, Export pack
- **Payroll** / my-payslips (`/payroll`): _none_
- **Employees** / list (`/employees`): Export
- **Attendance** / main (`/attendance`): _none_
- **Leave** / main (`/leave`): _none_
- **Leave** / main-tab-my-requests (`/leave`): _none_
- **Leave** / main-tab-team-calendar (`/leave?tab=team-calendar`): _none_
- **Leave** / main-tab-comp-off (`/leave?tab=comp-off`): _none_
- **Leave** / main-tab-approvals (`/leave?tab=approvals`): _none_
- **Analytics** / main (`/analytics`): _none_
- **Analytics** / range-7d (`/analytics?range=7d`): _none_
- **Analytics** / range-30d (`/analytics`): _none_
- **Analytics** / range-90d (`/analytics?range=90d`): _none_
- **Reports** / report-workforce-headcount (`/reports?report=workforce%2Fheadcount`): Export CSV
- **Reports** / report-workforce-turnover (`/reports?report=workforce%2Fturnover`): Export CSV
- **Reports** / report-workforce-demographics (`/reports?report=workforce%2Fdemographics`): _none_
- **Reports** / report-attendance-summary (`/reports?report=attendance%2Fsummary`): Export CSV
- **Reports** / report-attendance-absenteeism (`/reports?report=attendance%2Fabsenteeism`): Export CSV
- **Reports** / report-leave-utilization (`/reports?report=leave%2Futilization`): Export CSV
- **Reports** / report-leave-pending (`/reports?report=leave%2Fpending`): _none_
- **Reports** / report-payroll-summary (`/reports?report=payroll%2Fsummary`): Export CSV
- **Reports** / report-payroll-ctc-analysis (`/reports?report=payroll%2Fctc-analysis`): _none_
- **Reports** / report-payroll-salary-register (`/reports?report=payroll%2Fsalary-register`): Export CSV
- **Reports** / report-payroll-statutory-register (`/reports?report=payroll%2Fstatutory-register`): Export CSV
- **Reports** / report-payroll-bank-advice (`/reports?report=payroll%2Fbank-advice`): Export CSV
- **Reports** / report-payroll-variance-register (`/reports?report=payroll%2Fvariance-register`): Export CSV
- **Reports** / report-payroll-pay-equity (`/reports?report=payroll%2Fpay-equity`): _none_
- **Reports** / report-timesheets-utilization (`/reports?report=timesheets%2Futilization`): Export CSV

## Issues

### HR-EXPORT-LOGIN-401: Login bootstrap 401s (me/refresh)
- Where: /login
- Classification: FRONTEND
- Why: GET http://localhost:3001/api/auth/me → 401; POST http://localhost:3001/api/auth/refresh → 401
- How: Skip me/refresh on public auth routes
- Screenshot: `001-login-form.png`
- Network: 401 GET http://localhost:3001/api/auth/me · 401 POST http://localhost:3001/api/auth/refresh

### HR-EXPORT-reports-report-timesheets-utilization-export-csv: Timesheets Utilization Export CSV → 400
- Where: Reports → Timesheets Utilization → Export CSV (`/reports?report=timesheets/utilization`)
- Classification: BOTH
- Why: `POST /api/reports/export` → **400** `INVALID_REPORT_TYPE` / `Invalid reportType` — FE shows Export CSV but BE rejects `timesheets/utilization`
- How: Register `timesheets/utilization` in BE export allow-list, or hide Export CSV until BE supports it
- Screenshot: `105-reports-report-timesheets-utilization-after-export-csv.png`
- Network: `400 POST /api/reports/export` body `{"code":"INVALID_REPORT_TYPE","message":"Invalid reportType"}`

## Notes

- Reports routing is `/reports?report=<type>` (not nested paths). Nested paths under `/reports/...` are **404**.
- Attendance Calendar/Table views + Leave tabs + Analytics ranges: **no** Export/PDF/Excel/CSV toolbar controls for HR_ADMIN.
- Payroll list / my-payslips: no toolbar export; downloads live on run detail (`Export Register`, `Export pack`).
- Panels that hide Export CSV (by design / no `onExport`): Demographics, Pending Leave, CTC Analysis, Pay Equity.

## Verdict

- **14/14 browser download events ok:true** (Employees CSV, Payroll Register/pack, 10 Reports CSVs + 1 earlier hub register CSV).
- **1 real export defect:** Timesheets Utilization Export CSV → BE `INVALID_REPORT_TYPE` (no file).
- Attendance / Leave / Analytics: export controls absent (not broken clicks).
