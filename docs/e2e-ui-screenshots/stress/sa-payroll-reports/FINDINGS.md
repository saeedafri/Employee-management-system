# SA-PAY-REPORTS — SUPER_ADMIN Stress + Deep E2E (SHORT)

| Field | Value |
|-------|-------|
| Date | 2026-08-03T02:30:04.223Z |
| Role | `SUPER_ADMIN` — `superadmin@acme.test` / tenant `acme-corp-001` |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000/api/v1` |
| Scope | Payroll, Payout methods, Reports, Analytics |
| Stress | `Promise.all` concurrent PDF/Excel/CSV export clicks |
| Screenshots | `docs/e2e-ui-screenshots/stress/sa-payroll-reports/` — **48** PNGs |

## Counts

| Metric | Value |
|--------|------:|
| Menus | 4 |
| Tabs | 0 |
| Buttons | 38 |
| Modals | 2 |
| Export actions | 6 |
| Concurrent export bursts | 6 |
| Nest depth max | 1 |
| Screenshots | 48 |
| Download events | 12 (ok:12 / fail:0) |
| Issues BACKEND | 0 |
| Issues FRONTEND | 3 |
| Issues BOTH | 0 |

## Summary

Short SA stress shard: Payroll (+extras/run detail), Payout approvals, 6 report types, Analytics ranges. Concurrent Export CSV ×3 on headcount → **3/3 ok:true** (POST `/reports/export` 202 → GET download 200). Payroll run detail concurrent `Export Register` + `Export pack` → **2/2 ok:true**. CTC Analysis hides Export CSV (no control). Analytics has no export control. Payout SA lands on empty self-service.

## Stress export bursts

### PayrollRun / detail-export
- Clicks: `Export Register, Export pack`
- Downloads: `payroll-2026-12-H2.csv` ok:true, `audit-pack-cmqtilef5001xodfgq1bxxcjv.json` ok:true
- Network: `200 GET /api/payroll/runs/cmqtilef5001xodfgq1bxxcjv/export`
- Failed API: _none_
- Screenshot: `010-payrollrun-stress-detail-export.png` · 3379ms

### Payroll / list-export
- Clicks: `(none found)`
- Downloads: _none_
- Network: _n/a_
- Failed API: _none_
- Screenshot: `015-payroll-stress-list-export.png` · 3381ms

### Payout / approvals-export
- Clicks: `(none found)`
- Downloads: _none_
- Network: _n/a_
- Failed API: _none_
- Screenshot: `019-payout-stress-approvals-export.png` · 3351ms

### Reports / headcount-formats
- Clicks: `Export CSV, Export CSV#2, Export CSV#3`
- Downloads: `workforce-headcount-report.csv` ok:true, `workforce-headcount-report.csv` ok:true, `workforce-headcount-report.csv` ok:true
- Network: `202 POST /api/reports/export` · `202 POST /api/reports/export` · `202 POST /api/reports/export` · `200 GET /api/reports/export/cmscm2lvw00ryb9xjdrm5j7e2/download` · `200 GET /api/reports/export/cmscm2lvt00rwb9xjqow2afiu/download` · `202 GET /api/reports/export/cmscm2lvt00rub9xjpy0mqef9/download` · `200 GET /api/reports/export/cmscm2lvt00rub9xjpy0mqef9/download`
- Failed API: _none_
- Screenshot: `037-reports-stress-headcount-formats.png` · 3375ms

### Reports / ctc-formats
- Clicks: `(none found)`
- Downloads: _none_
- Network: _n/a_
- Failed API: _none_
- Screenshot: `038-reports-stress-ctc-formats.png` · 3370ms

### Analytics / export-burst
- Clicks: `(none found)`
- Downloads: _none_
- Network: _n/a_
- Failed API: _none_
- Screenshot: `048-analytics-stress-export-burst.png` · 3375ms

## Downloads

- `payroll-2026-12-H2.csv` ok:true fail:- @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `audit-pack-cmqtilef5001xodfgq1bxxcjv.json` ok:true fail:- @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `payroll-2026-12-H2.csv` ok:true fail:- @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `audit-pack-cmqtilef5001xodfgq1bxxcjv.json` ok:true fail:- @ http://localhost:3001/payroll/cmqtilef5001xodfgq1bxxcjv
- `workforce-headcount-report.csv` ok:true fail:- @ http://localhost:3001/reports
- `workforce-turnover-report.csv` ok:true fail:- @ http://localhost:3001/reports?report=attendance/summary
- `attendance-summary-report.csv` ok:true fail:- @ http://localhost:3001/reports?report=leave/utilization
- `leave-utilization-report.csv` ok:true fail:- @ http://localhost:3001/reports?report=payroll/ctc-analysis
- `workforce-headcount-report.csv` ok:true fail:- @ http://localhost:3001/reports
- `workforce-headcount-report.csv` ok:true fail:- @ http://localhost:3001/reports
- `workforce-headcount-report.csv` ok:true fail:- @ http://localhost:3001/reports
- `workforce-headcount-report.csv` ok:true fail:- @ http://localhost:3001/reports

## Issues

### SA-PAY-LOGIN-401: Login bootstrap 401s (me/refresh)
- **Where:** /login
- **Why:** GET http://localhost:3001/api/auth/me → 401; POST http://localhost:3001/api/auth/refresh → 401
- **Classification:** FRONTEND
- **How to resolve:** Skip me/refresh on public auth routes
- **Screenshot:** `001-login-form.png`
- **Network:** `401 GET http://localhost:3001/api/auth/me · 401 POST http://localhost:3001/api/auth/refresh`

### SA-PAYOUT-EMPTY: Payout methods empty/self-service for SUPER_ADMIN
- **Where:** /payout-methods
- **Why:** SA employeeId:null; page shows empty/self-service instead of admin approvals-first
- **Classification:** FRONTEND
- **How to resolve:** Default SUPER_ADMIN to /payout-methods/approvals when no employee record
- **Screenshot:** `016-payout-land.png`
- **Network:** `n/a`
- **Expected:** admin approvals queue
- **Actual:** Payout methods  Manage the accounts where you receive your pay.  Review approvals Payout methods Add account

### SA-REPORTS-CTC-NO-EXPORT: CTC Analysis hides Export CSV
- **Where:** `/reports?report=payroll/ctc-analysis` (also observed when soft-selecting CTC Analysis)
- **Why:** Main toolbar shows report nav chips + All departments but **no** `Export CSV` button (`getByRole('button',{name:/export csv/i})` count=0). Headcount/Turnover/Summary/Utilization expose Export CSV; CTC does not — concurrent export stress cannot run on this type.
- **Classification:** FRONTEND
- **How to resolve:** Show Export CSV for all report types that support `POST /reports/export`, including payroll/ctc-analysis
- **Screenshot:** `038-reports-stress-ctc-formats.png`
- **Network:** `n/a (no export control → no request)`
- **Expected:** Export CSV visible for CTC Analysis
- **Actual:** button absent

## Action log

- **[PASS]** Auth → login — `003-login-success.png`
- **[PASS]** Payroll → open — `004-payroll-land.png`
- **[PASS]** Payroll → modal:Run Payroll — `005-payroll-modal-run-payroll.png`
- **[PASS]** Payroll → actions-found:10
- **[PASS]** Payroll → run-detail-via-actions — `007-payroll-run-detail.png`
- **[PASS]** PayrollRun → btn:Export — `008-payrollrun-btn-export.png`
- **[PASS]** PayrollRun → btn:Export pack — `009-payrollrun-btn-export-pack.png`
- **[PASS]** PayrollRun → STRESS:detail-export — `010-payrollrun-stress-detail-export.png` — concurrent=2 dlOk=2 dlFail=0
- **[PASS]** Payroll → extra:/payroll/migration — `011-payroll-extra-payroll-migration.png`
- **[PASS]** Payroll → extra:/payroll/global — `012-payroll-extra-payroll-global.png`
- **[PASS]** Payroll → extra:/payroll/my-payslips — `013-payroll-extra-payroll-my-payslips.png`
- **[PASS]** Payroll → btn:Migration — `014-payroll-btn-migration.png`
- **[WARN]** Payroll → STRESS:list-export — `015-payroll-stress-list-export.png` — concurrent=0 dlOk=0 dlFail=0
- **[PASS]** Payout → open — `016-payout-land.png`
- **[PASS]** Payout → btn:Review approvals — `017-payout-btn-review-approvals.png`
- **[PASS]** Payout → approvals — `018-payout-approvals.png`
- **[WARN]** Payout → STRESS:approvals-export — `019-payout-stress-approvals-export.png` — concurrent=0 dlOk=0 dlFail=0
- **[PASS]** Reports → open — `020-reports-land.png`
- **[PASS]** Reports → type:workforce/headcount — `021-reports-workforce-headcount.png`
- **[PASS]** Reports/workforce/headcount → btn:Export CSV — `022-reports-workforce-headcount-btn-export-csv.png`
- **[PASS]** Reports/workforce/headcount → btn:Export — `023-reports-workforce-headcount-btn-export.png`
- **[PASS]** Reports → type:workforce/turnover — `024-reports-workforce-turnover.png`
- **[PASS]** Reports/workforce/turnover → btn:Export CSV — `025-reports-workforce-turnover-btn-export-csv.png`
- **[PASS]** Reports/workforce/turnover → btn:Export — `026-reports-workforce-turnover-btn-export.png`
- **[PASS]** Reports → type:attendance/summary — `027-reports-attendance-summary.png`
- **[PASS]** Reports/attendance/summary → btn:Export CSV — `028-reports-attendance-summary-btn-export-csv.png`
- **[PASS]** Reports/attendance/summary → btn:Export — `029-reports-attendance-summary-btn-export.png`
- **[PASS]** Reports → type:leave/utilization — `030-reports-leave-utilization.png`
- **[PASS]** Reports/leave/utilization → btn:Export CSV — `031-reports-leave-utilization-btn-export-csv.png`
- **[PASS]** Reports/leave/utilization → btn:Export — `032-reports-leave-utilization-btn-export.png`
- **[PASS]** Reports → type:payroll/summary — `033-reports-payroll-summary.png`
- **[PASS]** Reports/payroll/summary → btn:Export CSV — `034-reports-payroll-summary-btn-export-csv.png`
- **[PASS]** Reports/payroll/summary → btn:Export — `035-reports-payroll-summary-btn-export.png`
- **[PASS]** Reports → type:payroll/ctc-analysis — `036-reports-payroll-ctc-analysis.png`
- **[PASS]** Reports → STRESS:headcount-formats — `037-reports-stress-headcount-formats.png` — concurrent=3 dlOk=3 dlFail=0
- **[WARN]** Reports → STRESS:ctc-formats — `038-reports-stress-ctc-formats.png` — concurrent=0 dlOk=0 dlFail=0
- **[PASS]** Reports → export-csv-explicit — `039-reports-export-csv-explicit.png` — 202 POST /api/reports/export · 200 GET /api/reports/export/cmscm2ukq00s0b9xj1wqxswem/download
- **[PASS]** Analytics → open — `040-analytics-land.png`
- **[PASS]** Analytics → range:7d — `041-analytics-7d.png`
- **[PASS]** Analytics → range:30d — `042-analytics-30d.png`
- **[PASS]** Analytics → range:90d — `043-analytics-90d.png`
- **[PASS]** Analytics → modal:Custom — `044-analytics-modal-custom.png`
- **[PASS]** Analytics → btn:6m — `045-analytics-btn-6m.png`
- **[PASS]** Analytics → btn:12m — `046-analytics-btn-12m.png`
- **[PASS]** Analytics → btn:2y — `047-analytics-btn-2y.png`
- **[WARN]** Analytics → STRESS:export-burst — `048-analytics-stress-export-burst.png` — concurrent=0 dlOk=0 dlFail=0
