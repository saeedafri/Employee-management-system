# E2E Export Confirm Matrix

## SUPER_ADMIN

> Generated: 2026-08-03T03:35:56.057Z · Confirm pass **sa-exports**
> Role: `SUPER_ADMIN` (`superadmin@acme.test`) · UI `http://localhost:3001` · BE `http://localhost:4000/api/v1`
> Screenshots: `docs/e2e-ui-screenshots/confirm/sa-exports/` (**72** PNGs)
> Historical result: **16/16 downloads ok:true** — prior deep ISSUE-SA-05…09 ok:false **not reproduced** at that pass
>
> **Assets Export re-probe (2026-08-03T03:42Z):** see below — **final Assets verdict = flaky** (not solid pass).

### Assets Export conflict re-probe (2026-08-03T03:42Z)

| Field | Value |
|-------|-------|
| Role | `SUPER_ADMIN` `superadmin@acme.test` / `Password123!` / tenant `acme-corp-001` |
| UI → BE | `http://localhost:3001` → `http://localhost:4000` |
| Evidence | `docs/e2e-ui-screenshots/confirm/assets-export-reprobe/` (`results.json` + PNGs) |
| Attempts | **×3** click Export on `/assets` |
| Download events | 3× `assets-inventory.csv` — **ok:false / ok:false / ok:false** (`failure:{}`, no saved path) |
| Network on Export click | **No** export/download/CSV API — FE client-side Blob only (`GET /api/assets` 200 earlier for list data) |
| FE root cause | `ems-frontend/.../AssetsScreen.tsx` `handleExport`: `a.click()` then **immediate** `URL.revokeObjectURL(url)` — classic blob-download race |
| Historical conflict | `sa-exports`: `assets-inventory.csv ok:true` · `sa-gap-menus` GAP-03: `ok:false` ×2 |
| **Final verdict** | **flaky** — one historical ok:true vs gap+reprobe **5× ok:false**; race explains both. **Not solid pass. Not solid fail** (prior pass exists). |

### SA-EXPORTS-CONFIRM (historical — kept)

**Downloads: 16 (ok:16 / false:0)** · bursts=4 · real export PASS=14 FAIL=1 · surfaces ABSENT=7

### Working exports (ok:true) — historical sa-exports; Assets amended

| Surface | Control | Format | Download | Screenshot | Stress |
|---------|---------|--------|----------|------------|--------|
| Assets | Export | csv | assets-inventory.csv **HISTORICAL ok:true** → **REPROBE ×3 ok:false** → verdict **flaky** | `sa-exports/011-…` + `assets-export-reprobe/003..005-…` | ×3 fail |
| Employees | Export | csv | employees-2026-08-03.csv ok:true | `021-employees-x-export.png` |  |
| Employees[STRESS×3] | Export | csv | employees-2026-08-03.csv ok:true | `022-employees-stress-export.png` | ×3 |
| PayrollRun | Export Register | csv | payroll-2026-12-H2.csv ok:true | `025-payrollrun-x-export-register.png` |  |
| PayrollRun | Export pack | json | audit-pack-cmqtilef5001xodfgq1bxxcjv.json ok:true | `026-payrollrun-x-export-pack.png` |  |
| PayrollRun[STRESS×3] | Export Register | csv | payroll-2026-12-H2.csv ok:true | `027-payrollrun-stress-export-register.png` | ×3 |
| PayrollRun[STRESS×3] | Export pack | json | audit-pack-cmqtilef5001xodfgq1bxxcjv.json ok:true | `028-payrollrun-stress-export-pack.png` | ×3 |
| Reports/workforce/headcount | Export CSV | csv | register-2026-08-VARIANCE.csv ok:true | `034-reports-workforce-headcount-x-export-csv.png` |  |
| Reports/workforce/turnover | Export CSV | csv | register-2026-08-VARIANCE.csv ok:true | `039-reports-workforce-turnover-x-export-csv.png` |  |
| Reports/attendance/summary | Export CSV | csv | register-2026-08-VARIANCE.csv ok:true | `048-reports-attendance-summary-x-export-csv.png` |  |
| Reports/attendance/absenteeism | Export CSV | csv | register-2026-08-VARIANCE.csv ok:true | `053-reports-attendance-absenteeism-x-export-csv.png` |  |
| Reports/leave/utilization | Export CSV | csv | register-2026-08-VARIANCE.csv ok:true | `058-reports-leave-utilization-x-export-csv.png` |  |
| Reports/payroll/summary | Export CSV | csv | register-2026-08-VARIANCE.csv ok:true | `067-reports-payroll-summary-x-export-csv.png` |  |
| Reports/headcount[STRESS×3] | Export CSV | csv | workforce-headcount-report.csv ok:true; workforce-headcount-report.csv ok:true; workforce-headcount-report.csv ok:true | `072-reports-headcount-stress-export-csv.png` | ×3 |

### Absent / no control

| Surface | Status | Screenshot |
|---------|--------|------------|
| Attendance | ABSENT | `004-attendance-land.png` |
| Leave | ABSENT | `005-leave-land.png` |
| Payout | ABSENT | `006-payout-land.png` |
| PayoutApprovals | ABSENT | `007-payoutapprovals-land.png` |
| Analytics | ABSENT | `008-analytics-land.png` |
| AuditLogs | ABSENT | `016-auditlogs-land.png` |
| OpsLogs | ABSENT | `017-opslogs-land.png` |

### Real failures / stubs

| Surface | Control | Status | ok | Screenshot |
|---------|---------|--------|----|------------|
| Performance | Export | NO_EVENT | false | `020-performance-x-export.png` |

### Concurrent stress (Promise.all ×3)

| Surface | Control | ok | fail | Screenshot |
|---------|---------|---:|-----:|------------|
| Employees | Export | 1 | 0 | `022-employees-stress-export.png` |
| PayrollRun | Export Register | 1 | 0 | `027-payrollrun-stress-export-register.png` |
| PayrollRun | Export pack | 1 | 0 | `028-payrollrun-stress-export-pack.png` |
| Reports/headcount | Export CSV | 3 | 0 | `072-reports-headcount-stress-export-csv.png` |

### NAV_ONLY false-positives

Sidebar / report-type labels matching `Register|Pack|Invoice` were clicked by the keyword scanner but are **not** export/download actions: Salary/Statutory/Variance Register (Reports nav), Policy Packs / Statutory Packs / Invoices (Settings nav).

### Verdict

- Historical sa-exports download success: **16/16 ok:true** — prior deep SA-05…09 ok:false **not reproduced** on that pass.
- **Assets inventory CSV — FINAL: flaky** (re-probe 2026-08-03T03:42Z: **0/3 ok:true**; GAP-03 also ok:false; sa-exports once ok:true). Client-side Blob + immediate `revokeObjectURL` — no BE export endpoint involved.
- BACKEND export path still healthy for Employees CSV, Payroll Register/pack, Reports Export CSV (+ concurrent ×3). Do **not** count Assets as solid CSV pass.
- FE residuals: Assets Export race/flake; Performance Export stub; CTC / some report types hide Export CSV; Attendance/Leave/Analytics/Payout/Audit have no export toolbar.

Full detail: `docs/e2e-ui-screenshots/confirm/sa-exports/FINDINGS.md` · re-probe: `docs/e2e-ui-screenshots/confirm/assets-export-reprobe/`

## HR_ADMIN

| Field | Value |
|-------|-------|
| Date | 2026-08-03T03:43:40.354Z |
| User | `hr@acme.test` / `acme-corp-001` |
| Evidence | `docs/e2e-ui-screenshots/confirm/hr-exports/` (105 PNGs) + `FINDINGS.md` |
| Downloads | 14 events (ok:14 / fail:0) |
| Matrix | PASS=13 FAIL=0 WARN=1 NO_DOWNLOAD=0 NONE=16 MISS=0 |
| Issues | BE=0 FE=1 BOTH=1 |

| Surface | Page | Control | Status | Download | Screenshot |
|---------|------|---------|--------|----------|------------|
| Payroll | list | (none) | NONE | — | `032-payroll-list-no-export.png` |
| Payroll | run-detail | Export Register | PASS | payroll-2026-12-H2.csv ok:true | `037-payroll-run-detail-after-export-register.png` |
| Payroll | run-detail | Export pack | PASS | audit-pack-cmqtilef5001xodfgq1bxxcjv.json ok:true | `039-payroll-run-detail-after-export-pack.png` |
| Payroll | my-payslips | (none) | NONE | — | `041-payroll-my-payslips-no-export.png` |
| Employees | list | Export | PASS | employees-2026-08-03.csv ok:true | `044-employees-list-after-export.png` |
| Attendance | main | (none) | NONE | — | `046-attendance-main-no-export.png` |
| Leave | main | (none) | NONE | — | `048-leave-main-no-export.png` |
| Leave | main-tab-my-requests | (none) | NONE | — | `050-leave-main-tab-my-requests-no-export.png` |
| Leave | main-tab-team-calendar | (none) | NONE | — | `052-leave-main-tab-team-calendar-no-export.png` |
| Leave | main-tab-comp-off | (none) | NONE | — | `054-leave-main-tab-comp-off-no-export.png` |
| Leave | main-tab-approvals | (none) | NONE | — | `056-leave-main-tab-approvals-no-export.png` |
| Analytics | main | (none) | NONE | — | `058-analytics-main-no-export.png` |
| Analytics | range-7d | (none) | NONE | — | `060-analytics-7d-no-export.png` |
| Analytics | range-30d | (none) | NONE | — | `062-analytics-30d-no-export.png` |
| Analytics | range-90d | (none) | NONE | — | `064-analytics-90d-no-export.png` |
| Reports | report-workforce-headcount | Export CSV | PASS | workforce-headcount-report.csv ok:true | `067-reports-report-workforce-headcount-after-export-csv.png` |
| Reports | report-workforce-turnover | Export CSV | PASS | workforce-turnover-report.csv ok:true | `070-reports-report-workforce-turnover-after-export-csv.png` |
| Reports | report-workforce-demographics | (none) | NONE | — | `072-reports-report-workforce-demographics-no-export.png` |
| Reports | report-attendance-summary | Export CSV | PASS | attendance-summary-report.csv ok:true | `075-reports-report-attendance-summary-after-export-csv.png` |
| Reports | report-attendance-absenteeism | Export CSV | PASS | attendance-absenteeism-report.csv ok:true | `078-reports-report-attendance-absenteeism-after-export-csv.png` |
| Reports | report-leave-utilization | Export CSV | PASS | leave-utilization-report.csv ok:true | `081-reports-report-leave-utilization-after-export-csv.png` |
| Reports | report-leave-pending | (none) | NONE | — | `083-reports-report-leave-pending-no-export.png` |
| Reports | report-payroll-summary | Export CSV | PASS | payroll-summary-report.csv ok:true | `086-reports-report-payroll-summary-after-export-csv.png` |
| Reports | report-payroll-ctc-analysis | (none) | NONE | — | `088-reports-report-payroll-ctc-analysis-no-export.png` |
| Reports | report-payroll-salary-register | Export CSV | PASS | register-2026-08-SALARY.csv ok:true | `091-reports-report-payroll-salary-register-after-export-csv.png` |
| Reports | report-payroll-statutory-register | Export CSV | PASS | register-2026-08-STATUTORY.csv ok:true | `094-reports-report-payroll-statutory-register-after-export-c.png` |
| Reports | report-payroll-bank-advice | Export CSV | PASS | register-2026-08-BANK_ADVICE.csv ok:true | `097-reports-report-payroll-bank-advice-after-export-csv.png` |
| Reports | report-payroll-variance-register | Export CSV | PASS | register-2026-08-VARIANCE.csv ok:true | `100-reports-report-payroll-variance-register-after-export-cs.png` |
| Reports | report-payroll-pay-equity | (none) | NONE | — | `102-reports-report-payroll-pay-equity-no-export.png` |
| Reports | report-timesheets-utilization | Export CSV | WARN | — | `105-reports-report-timesheets-utilization-after-export-csv.png` |

### Notable

- **Working downloads (13 unique controls):** Employees `Export` → `employees-2026-08-03.csv`; Payroll run `Export Register` + `Export pack`; Reports Export CSV for headcount, turnover, attendance summary/absenteeism, leave utilization, payroll summary, salary/statutory/bank-advice/variance registers.
- **Broken (1):** Timesheets Utilization `Export CSV` → `400 INVALID_REPORT_TYPE` (BOTH) — FE button present, BE rejects report type — filed as **ISSUE-HR-10** (BE + FE contracts).
- **No export control:** Attendance (Calendar/Table), Leave (all tabs), Analytics (7d/30d/90d), Payroll list/my-payslips; Reports panels without Export CSV: Demographics, Pending Leave, CTC Analysis, Pay Equity.
- Reports routing: `/reports?report=<type>` — path `/reports/...` is 404.

Full detail: `docs/e2e-ui-screenshots/confirm/hr-exports/FINDINGS.md`
