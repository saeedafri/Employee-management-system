# FINDINGS — MANAGER + EMPLOYEE Export Confirmation

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Roles | MANAGER `aman@acme.test` → EMPLOYEE `priya@acme.test` (sequential, one agent) |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000` |
| Screenshots | **27** PNGs in `docs/e2e-ui-screenshots/confirm/mgr-emp-exports/` |
| Runner | `_confirm_exports.mjs` · `results.json` · `_run.log` · `api_probe.json` |
| Matrix | `docs/E2E_EXPORT_CONFIRM_MATRIX.md` → `## MANAGER` / `## EMPLOYEE` |

## Verdict

| Role | UI export affordances | API export / PDF |
|------|----------------------|------------------|
| **MANAGER** | Timesheets / Leave / Attendance: **no Export controls**. Reports: RoleGate **Access restricted**. Employees list: **no Export** button. Payslip **Download PDF** visible → `window.print()` only. | `POST /export/{attendance,leave,employees}`, `GET /employees/export/csv`, `POST /reports/export` → **403** (missing `*:export` / `reports:read`). Self payslip PDF → **200** `%PDF` (2201 bytes). |
| **EMPLOYEE** | Leave / Attendance / Timesheets / Employees: **no Export**. Reports: **Access restricted**. Payslip **Download PDF** visible → `window.print()` only. | Same org-export endpoints → **403**. Self payslip PDF → **200** `%PDF` (2158 bytes). |

**Bottom line:** Neither role gets team/org CSV exports (UI hidden + BE 403 — aligned). The only downloadable surface is My Pay → Download PDF, and FE does **not** call the live server PDF endpoint.

## Product defects

### CONF-MGR-FE-01 / CONF-EMP-FE-01 — Payslip Download PDF is client print, not server PDF — HIGH (FRONTEND)

| | |
|--|--|
| **Layer** | FRONTEND (`PayslipDrawer.tsx` → `onClick={() => window.print()}`) |
| **BE truth** | `GET /payroll/employees/:employeeId/payslips/:payslipId/download?format=pdf` returns **200** `application/pdf` for both Aman and Priya (`api_probe.json`) |
| **UI** | Button label “Download PDF” with printer icon; click triggers `window.print()` only — **zero** `/download?format=pdf` network calls |
| **Shots** | Manager `012`–`013` · Employee `026`–`027` |
| **Expected** | Fetch server PDF blob + save (per `UI_HANDOFF_rbac_and_exports_2026-07-29.md` §5.1) |

> Same FE gap for both roles — counted once as the root cause; matrix rows listed per role.

## Correct RBAC (not defects)

| Check | Manager | Employee | Notes |
|-------|---------|----------|-------|
| Reports hub / Export CSV | DENY shell | DENY shell | `009`/`010`, `023`/`024` |
| `POST /export/attendance` | 403 `attendance:export` | 403 | Correct |
| `POST /export/leave` | 403 `leave:export` | 403 | Correct |
| `POST /export/employees` | 403 `employees:export` | 403 | Correct |
| `GET /employees/export/csv` | 403 | 403 | Correct |
| `POST /reports/export` | 403 `reports:read` | 403 | Correct |
| Timesheets / Leave / Attendance Export UI | HIDDEN | HIDDEN | No affordance on page |
| Employees Export UI | HIDDEN | HIDDEN | Aligns with missing `employees:export` (FE `can(user,'employees:read')` still did not show Export for Aman — list toolbar has Comfortable/Columns only · `005`) |
| Sidebar shows Reports/Analytics/… | VISIBLE | VISIBLE | Known nav noise; deep pages DENY |

## Permissions observed at login (export-relevant)

| Role | Keys present | Export keys absent |
|------|--------------|--------------------|
| MANAGER | `attendance:read`, `attendance:team-read`, `attendance:approve`, `leave:approve`, `leave:team-read`, `payroll:self-read` | `attendance:export`, `leave:export`, `employees:export`, `reports:read` |
| EMPLOYEE | `attendance:read/write`, `leave:read/request`, `payroll:self-read` | same export/report keys |

## Screenshot index

| # | File | What |
|---|------|------|
| 001–003 | `mgr-login-*` | Manager login → dashboard |
| 004 | `mgr-sidebar` | Full sidebar (Reports visible) |
| 005–008 | `man-{employees,timesheets,leave,attendance}-land` | No Export controls |
| 009–010 | `mgr-reports-*` | Access restricted |
| 011–013 | `mgr-payroll/payslip-*` | Download PDF → client print |
| 014 | `mgr-logout-cleared` | Session clear before employee |
| 015–017 | `emp-login-*` | Employee login |
| 018 | `emp-sidebar` | Sidebar |
| 019–022 | `emp-{leave,attendance,timesheets,employees}-land` | No Export |
| 023–024 | `emp-reports-*` | Access restricted |
| 025–027 | `emp-payroll/payslip-*` | Download PDF → client print |

## API probe (direct BE login — `api_probe.json`)

### MANAGER `aman@acme.test`

| Endpoint | Status | Detail |
|----------|--------|--------|
| `POST /export/attendance` | **403** | required `attendance:export` |
| `POST /export/leave` | **403** | required `leave:export` |
| `POST /export/employees` | **403** | required `employees:export` |
| `GET /employees/export/csv` | **403** | required `employees:export` |
| `POST /reports/export` | **403** | required `reports:read` |
| `GET .../payslips/:id/download?format=pdf` | **200** | `application/pdf` 2201 bytes `%PDF` |

### EMPLOYEE `priya@acme.test`

| Endpoint | Status | Detail |
|----------|--------|--------|
| `POST /export/attendance` | **403** | required `attendance:export` |
| `POST /export/leave` | **403** | required `leave:export` |
| `POST /export/employees` | **403** | required `employees:export` |
| `GET /employees/export/csv` | **403** | required `employees:export` |
| `POST /reports/export` | **403** | required `reports:read` |
| `GET .../payslips/:id/download?format=pdf` | **200** | `application/pdf` 2158 bytes `%PDF` |

## Contracts updated

- `docs/E2E_EXPORT_CONFIRM_MATRIX.md` → `## MANAGER` + `## EMPLOYEE`
