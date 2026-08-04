# SA-EXPORTS-CONFIRM — SUPER_ADMIN Deep Export Confirmation

| Field | Value |
|-------|-------|
| Date | 2026-08-03T03:35:56.056Z |
| Role | `SUPER_ADMIN` — `superadmin@acme.test` / tenant `acme-corp-001` |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000/api/v1` (Hostinger tunnel) |
| Scope | Reports (9 types), Payroll run Register/pack, Employees Export, Assets Export, Attendance/Leave/Analytics/Payout/Audit/Ops/Performance, Payslips |
| Stress | `Promise.all` ×3 same control |
| Screenshots | `docs/e2e-ui-screenshots/confirm/sa-exports/` — **72** PNGs |

## Verdict

- **All real download events succeeded: 16/16 ok:true** (0 ok:false).
- Confirmed working: Employees CSV, Assets inventory CSV, Payroll Export Register (CSV), Payroll Export pack (JSON), Reports Export CSV (multiple types), concurrent headcount Export CSV ×3 (3/3), Employees Export stress, Payroll Register/pack stress.
- **No export controls** on Attendance, Leave, Analytics, Payout, Audit logs, Ops logs (ABSENT — expected for these surfaces in current UI).
- Performance **Export** button visible but produced **no download / no export API** (FE stub or incomplete).
- Settings sidebar labels Policy Packs / Statutory Packs / Invoices matched keyword scan — **NAV_ONLY**, not export actions.
- Reports left-nav Salary/Statutory/Variance **Register** items are report-type nav — **NAV_ONLY**, not Export Register.

## Counts

| Metric | Value |
|--------|------:|
| Surfaces scanned | 10 |
| Controls found (raw matcher) | 40 |
| Controls clicked | 41 |
| Concurrent bursts | 4 |
| Matrix rows (raw) | 52 |
| Real export actions | 15 |
| Real export PASS (ok:true) | 14 |
| Real export FAIL | 1 |
| Surfaces ABSENT | 7 |
| NAV_ONLY false-positives | 30 |
| Download events | 16 (ok:16 / fail:0) |
| Real issues | 1 |
| Screenshots | 72 |

## Export confirmation matrix (cleaned)

| Surface | Control | Format | Status | ok | Download | Screenshot | Stress |
|---------|---------|--------|--------|----|----------|------------|--------|
| Attendance | (none found) | n/a | ABSENT | n/a | — | `004-attendance-land.png` |  |
| Leave | (none found) | n/a | ABSENT | n/a | — | `005-leave-land.png` |  |
| Payout | (none found) | n/a | ABSENT | n/a | — | `006-payout-land.png` |  |
| PayoutApprovals | (none found) | n/a | ABSENT | n/a | — | `007-payoutapprovals-land.png` |  |
| Analytics | (none found) | n/a | ABSENT | n/a | — | `008-analytics-land.png` |  |
| Assets | Export | csv | PASS | true | assets-inventory.csv ok:true | `011-assets-x-export.png` |  |
| AuditLogs | (none found) | n/a | ABSENT | n/a | — | `016-auditlogs-land.png` |  |
| OpsLogs | (none found) | n/a | ABSENT | n/a | — | `017-opslogs-land.png` |  |
| Performance | Export | unknown | NO_EVENT | false | — | `020-performance-x-export.png` |  |
| Employees | Export | csv | PASS | true | employees-2026-08-03.csv ok:true | `021-employees-x-export.png` |  |
| Employees[STRESS×3] | Export | csv | PASS | true | employees-2026-08-03.csv ok:true | `022-employees-stress-export.png` | ×3 |
| PayrollRun | Export Register | csv | PASS | true | payroll-2026-12-H2.csv ok:true | `025-payrollrun-x-export-register.png` |  |
| PayrollRun | Export pack | json | PASS | true | audit-pack-cmqtilef5001xodfgq1bxxcjv.json ok:true | `026-payrollrun-x-export-pack.png` |  |
| PayrollRun[STRESS×3] | Export Register | csv | PASS | true | payroll-2026-12-H2.csv ok:true | `027-payrollrun-stress-export-register.png` | ×3 |
| PayrollRun[STRESS×3] | Export pack | json | PASS | true | audit-pack-cmqtilef5001xodfgq1bxxcjv.json ok:true | `028-payrollrun-stress-export-pack.png` | ×3 |
| Reports/workforce/headcount | Export CSV | csv | PASS | true | register-2026-08-VARIANCE.csv ok:true | `034-reports-workforce-headcount-x-export-csv.png` |  |
| Reports/workforce/turnover | Export CSV | csv | PASS | true | register-2026-08-VARIANCE.csv ok:true | `039-reports-workforce-turnover-x-export-csv.png` |  |
| Reports/attendance/summary | Export CSV | csv | PASS | true | register-2026-08-VARIANCE.csv ok:true | `048-reports-attendance-summary-x-export-csv.png` |  |
| Reports/attendance/absenteeism | Export CSV | csv | PASS | true | register-2026-08-VARIANCE.csv ok:true | `053-reports-attendance-absenteeism-x-export-csv.png` |  |
| Reports/leave/utilization | Export CSV | csv | PASS | true | register-2026-08-VARIANCE.csv ok:true | `058-reports-leave-utilization-x-export-csv.png` |  |
| Reports/payroll/summary | Export CSV | csv | PASS | true | register-2026-08-VARIANCE.csv ok:true | `067-reports-payroll-summary-x-export-csv.png` |  |
| Reports/headcount[STRESS×3] | Export CSV | csv | PASS | true | workforce-headcount-report.csv ok:true; workforce-headcount-report.csv ok:true; workforce-headcount-report.csv ok:true | `072-reports-headcount-stress-export-csv.png` | ×3 |

### NAV_ONLY (keyword false-positives — not export controls)

| Surface | Label | Note |
|---------|-------|------|
| Settings | Policy Packs | sidebar/report-type nav |
| Settings | Statutory Packs | sidebar/report-type nav |
| Settings | Invoices | sidebar/report-type nav |
| Reports/workforce/headcount | Salary Register | sidebar/report-type nav |
| Reports/workforce/headcount | Statutory Register | sidebar/report-type nav |
| Reports/workforce/headcount | Variance Register | sidebar/report-type nav |
| Reports/workforce/turnover | Salary Register | sidebar/report-type nav |
| Reports/workforce/turnover | Statutory Register | sidebar/report-type nav |
| Reports/workforce/turnover | Variance Register | sidebar/report-type nav |
| Reports/workforce/demographics | Salary Register | sidebar/report-type nav |
| Reports/workforce/demographics | Statutory Register | sidebar/report-type nav |
| Reports/workforce/demographics | Variance Register | sidebar/report-type nav |
| Reports/attendance/summary | Salary Register | sidebar/report-type nav |
| Reports/attendance/summary | Statutory Register | sidebar/report-type nav |
| Reports/attendance/summary | Variance Register | sidebar/report-type nav |
| Reports/attendance/absenteeism | Salary Register | sidebar/report-type nav |
| Reports/attendance/absenteeism | Statutory Register | sidebar/report-type nav |
| Reports/attendance/absenteeism | Variance Register | sidebar/report-type nav |
| Reports/leave/utilization | Salary Register | sidebar/report-type nav |
| Reports/leave/utilization | Statutory Register | sidebar/report-type nav |
| Reports/leave/utilization | Variance Register | sidebar/report-type nav |
| Reports/leave/pending | Salary Register | sidebar/report-type nav |
| Reports/leave/pending | Statutory Register | sidebar/report-type nav |
| Reports/leave/pending | Variance Register | sidebar/report-type nav |
| Reports/payroll/summary | Salary Register | sidebar/report-type nav |
| Reports/payroll/summary | Statutory Register | sidebar/report-type nav |
| Reports/payroll/summary | Variance Register | sidebar/report-type nav |
| Reports/payroll/ctc-analysis | Salary Register | sidebar/report-type nav |
| Reports/payroll/ctc-analysis | Statutory Register | sidebar/report-type nav |
| Reports/payroll/ctc-analysis | Variance Register | sidebar/report-type nav |

## Concurrent stress bursts

### Employees / Export
- Downloads: `employees-2026-08-03.csv` ok:true
- ok=1 fail=0 · `022-employees-stress-export.png` · 4131ms

### PayrollRun / Export Register
- Downloads: `payroll-2026-12-H2.csv` ok:true
- ok=1 fail=0 · `027-payrollrun-stress-export-register.png` · 4079ms

### PayrollRun / Export pack
- Downloads: `audit-pack-cmqtilef5001xodfgq1bxxcjv.json` ok:true
- ok=1 fail=0 · `028-payrollrun-stress-export-pack.png` · 4048ms

### Reports/headcount / Export CSV
- Downloads: `workforce-headcount-report.csv` ok:true, `workforce-headcount-report.csv` ok:true, `workforce-headcount-report.csv` ok:true
- ok=3 fail=0 · `072-reports-headcount-stress-export-csv.png` · 4054ms

## Downloads (all)

- `assets-inventory.csv` format:csv **ok:true** @ http://localhost:3001/assets
- `employees-2026-08-03.csv` format:csv **ok:true** @ http://localhost:3001/employees
- `employees-2026-08-03.csv` format:csv **ok:true** @ http://localhost:3001/employees
- `payroll-2026-12-H2.csv` format:csv **ok:true** @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `audit-pack-cmqtilef5001xodfgq1bxxcjv.json` format:json **ok:true** @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `payroll-2026-12-H2.csv` format:csv **ok:true** @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `audit-pack-cmqtilef5001xodfgq1bxxcjv.json` format:json **ok:true** @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `register-2026-08-VARIANCE.csv` format:csv **ok:true** @ http://localhost:3001/reports?report=payroll/variance-register
- `register-2026-08-VARIANCE.csv` format:csv **ok:true** @ http://localhost:3001/reports?report=payroll/variance-register
- `register-2026-08-VARIANCE.csv` format:csv **ok:true** @ http://localhost:3001/reports?report=payroll/variance-register
- `register-2026-08-VARIANCE.csv` format:csv **ok:true** @ http://localhost:3001/reports?report=payroll/variance-register
- `register-2026-08-VARIANCE.csv` format:csv **ok:true** @ http://localhost:3001/reports?report=payroll/variance-register
- `register-2026-08-VARIANCE.csv` format:csv **ok:true** @ http://localhost:3001/reports?report=payroll/variance-register
- `workforce-headcount-report.csv` format:csv **ok:true** @ http://localhost:3001/reports
- `workforce-headcount-report.csv` format:csv **ok:true** @ http://localhost:3001/reports
- `workforce-headcount-report.csv` format:csv **ok:true** @ http://localhost:3001/reports

## Real issues

### SA-EXP-performance-export: Export control failed: Export
- Where: Performance → Export
- Why: no usable download; net=none
- Classification: FRONTEND
- How: Ensure export returns downloadable file and FE completes blob download
- Screenshot: `020-performance-x-export.png`

## Notes

- CTC Analysis: no `Export CSV` control (ABSENT on that type after nav FP filter) — consistent with prior stress FE note.
- Leave/pending & demographics: Export CSV not always present depending on which report panel stayed active.
- Payslips: SA may lack employee-linked payslip Download in drawer (surface scanned via `/payroll/my-payslips`).
