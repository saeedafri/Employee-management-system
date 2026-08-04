# HR-CORE Stress + Deep E2E SHORT — FINDINGS

> Date: 2026-08-03  
> Role: `HR_ADMIN` (`hr@acme.test` / `Password123!` / tenant `acme-corp-001`)  
> UI: `http://localhost:3001` · BE: `http://localhost:4000` (Hostinger tunnel `127.0.0.1:15432`)  
> Screenshots: `docs/e2e-ui-screenshots/stress/hr-core/` (**85** PNGs incl. post-probe)  
> Runner: `_stress_hr_core.mjs`  
> **No Render. No git commit.**

## Summary

| Metric | Value |
|--------|------:|
| Menus | Dashboard · Employees · Attendance · Leave · Payroll · Reports |
| Screenshots | **84** (+1 supplemental probe attempt) |
| Deep clicks | Dashboard 6 · Employees 8 · Attendance 7 · Leave 7 · Payroll 8 · Reports 14 |
| Concurrent tab stress | Leave (4 tabs, 0 fails) · Employees detail tabs (6, 0 fails) |
| Export stress | Dashboard/Employees CSV download ok (`employees-2026-08-03.csv`); Reports Export CSV clicked |
| Rapid menu hop | 2×6 routes · 0 API ≥400 |
| Backend issues | **1** (zero-duration PRESENT) |
| Frontend issues | **1** (summary cards Present=0 / 50% vs BE present=1 / 100%) |
| Classic BE “summary excludes today” | **NOT reproduced** at `~02:15Z` (summary `present=1`) |

## Attendance summary today zeros — verdict

**UI zeros REPRODUCED. Classic BE timezone exclusion NOT active at this wall-clock.**

| Source | Present | Attendance % | Notes |
|--------|--------:|-------------:|-------|
| UI cards (`003`/`005`/`024`) | **0** | **50%** | Calendar/table label **Half Day** |
| `GET /attendance/summary` | **1** | **100%** | `period.endDate=2026-08-03T02:15:07.815Z` |
| `GET /attendance/records?month=2026-08` | 1 row `PRESENT` | — | `totalMinutes=0` |
| `GET /attendance/today` | status `PRESENT` | — | `duration=0` |

Interpretation:
1. **FRONTEND** — cards ignore BE summary totals and re-classify zero-duration `PRESENT` as Half Day → Present card stays **0**, % → **50%**.
2. **BACKEND** — still accepts check-out within ~2s → `duration=0` / `totalMinutes=0` with `status=PRESENT` (reconfirm prior `ISSUE-HR-09`).
3. Prior **BACKEND** `ISSUE-HR-05`/`ISSUE-HR-07` (summary `endDate=now` excludes local-today before UTC midnight) did **not** fire here because wall-clock was already past `2026-08-03T00:00Z`.

## Stress notes

- Concurrent Leave tab switches (My Requests / Team Calendar / Comp Off / Approvals): **0** failed APIs.
- Concurrent Employees detail tabs: **0** failed APIs.
- Export CSV from Employees list under Dashboard deep path: download **ok**.
- Reports deep buttons: Headcount, Turnover, Demographics, Monthly Summary, Absenteeism, Utilization, Pending, Payroll Summary, CTC, Salary/Statutory/Bank/Variance/Pay Equity — all navigated; Export CSV clicked on report pages.
- Rapid hop Dashboard→Attendance→Leave→Payroll→Reports→Employees ×2: **stable**.

## Issues

### ISSUE-HR-STRESS-BE-01 — Zero-duration PRESENT accepted
- **Where:** `GET /attendance/today` (+ records month)
- **Why:** HR row for 2026-08-03 is `status=PRESENT` with `duration=0` / `totalMinutes=0` (check-in/out ~2s apart from prior E2E mutation).
- **Classification:** BACKEND
- **How to resolve:** Reject early check-out or mark incomplete/half-day server-side; do not emit PRESENT with 0 minutes.
- **Screenshot:** `003-attendance-zeros-probe-land-view.png`, `005-attendance-zeros-probe-table-view.png`
- **Network:** `200 GET /attendance/today` `status=PRESENT duration=0`; records `totalMinutes=0`
- **Aliases:** `ISSUE-HR-09`

### ISSUE-HR-STRESS-FE-01 — Summary cards Present=0 / 50% while BE summary present=1 / 100%
- **Where:** `/attendance` KPI cards vs `GET /attendance/summary`
- **Why:** Screenshots show Present **0**, Attendance % **50%**, table/calendar **Half Day**, while BE summary returns `present:1`, `attendancePercentage:100` and today badge still says Present.
- **Classification:** FRONTEND
- **How to resolve:** Prefer server summary totals for KPI cards; if client `classifyDay` overrides PRESENT→Half Day, update Present/HalfDay cards and % consistently (or stop overriding server status).
- **Screenshot:** `003-attendance-zeros-probe-land-view.png`, `005-attendance-zeros-probe-table-view.png`, `024-attendance-land-view.png`
- **Network:** `200 GET /attendance/summary` `present=1 pct=100` vs UI Present=0 pct=50
- **Aliases:** `ISSUE-HR-06` (status mismatch); UI symptom formerly blamed solely on `ISSUE-HR-05`

## Menu depth

- **Dashboard**: deep Add Employee / filters / Columns / Export
- **Employees**: deep Add / filters / Export / row Aman Kumar / Documents; concurrent tabs on detail
- **Attendance**: Regularization modal, dept/employee filters, Calendar/Table
- **Leave**: tabs My Requests / Team Calendar / Comp Off / Approvals + New Request modal; concurrent tab stress
- **Payroll**: Migration, Run Payroll modal, nested controls
- **Reports**: 14 report-nav deep clicks + sidebar report routes + export stress
