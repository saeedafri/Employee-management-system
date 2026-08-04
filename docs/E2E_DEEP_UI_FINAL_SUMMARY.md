# E2E Deep UI — Final Rollout Summary

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Tool | **Playwright** Chromium + real PNG screenshots (nested / resume / phase / spot / gap scripts) |
| Stack | **FE** `http://localhost:3001` → **BE** `http://localhost:4000` → **Hostinger** DB/Redis tunnel |
| MSW | Off (live local API) |
| Contracts | `docs/E2E_BACKEND_ISSUES_CONTRACT.md` · `docs/E2E_FRONTEND_ISSUES_CONTRACT.md` |
| This summary | `docs/E2E_DEEP_UI_FINAL_SUMMARY.md` |
| **No Render. No git commit.** | |

---

## Screenshot inventory (shallow + deep)

PNG counts on disk at consolidation time.

| Role | Shallow dir | Shallow PNGs | Deep dir | Deep PNGs | Max nest depth | FINDINGS |
|------|-------------|-------------:|----------|----------:|---------------:|----------|
| EMPLOYEE | `employee/` | **78** | `employee-deep/` | **201** | (employee-deep) | both |
| MANAGER | `manager/` | **94** | `manager-deep/` | **491** | **4** (`n1=41 · n2=139 · n3=62 · n4=16`) | both |
| HR_ADMIN | `hr-admin/` | **185** | `hr-admin-deep/` | **511** | 2 | both |
| SUPER_ADMIN | `superadmin/` | **704** | `superadmin-deep/` | **831** | **4** (menus 17 · controls 304 · layers 92) | both |

**Total PNGs (8 dirs):** **3,095** · **superadmin-deep confirmed 831 PNGs · nest depth 4**

MANAGER deep evidence: `docs/e2e-ui-screenshots/manager-deep/FINDINGS.md` + `depth-stats.json` (`maxNestDepth: 4`, nested action shots **258**, tabs **98**, modals **78**, adminDeny **42**, soft OPEN `/payroll/runs`).

SUPER_ADMIN deep evidence: `docs/e2e-ui-screenshots/superadmin-deep/FINDINGS.md` (disk **831** PNGs; runner counter 372 — parallel Settings/Reports pass wrote extra frames).

---

## Contract issue counts (LIVE — post SUPER_ADMIN deep refresh)

### Backend — `docs/E2E_BACKEND_ISSUES_CONTRACT.md`

| Role | Count | Issue IDs |
|------|------:|-----------|
| HR_ADMIN | **2** | `ISSUE-HR-07` (attendance summary excludes today / timezone), `ISSUE-HR-09` (zero-duration checkout → PRESENT) |
| MANAGER | **2** | `ISSUE-MGR-01` (Present Today / Avg = 0 vs week grid P), `ISSUE-MGR-03` (dept employee GET **403**) |
| EMPLOYEE | **2** | `ISSUE-EMP-01` (`AL` → `NO_LEAVE_BALANCE`), `ISSUE-EMP-02` (leave preview **404**) |
| SUPER_ADMIN | **4** | `ISSUE-SA-10` (leave→**Priya Sharma** — **CRITICAL**; was SA-04), `ISSUE-SA-02` (`GET /attendance/today` **400** `NO_EMPLOYEE_RECORD`), `ISSUE-SA-03` (leave preview **404**), `ISSUE-SA-04` (leave-assignments **401** token exp) |

**BE total: 10** · **SA-10 (leave→Priya) present in BE contract: YES** · Alias: **SA-10 = previously SA-04**

### Frontend — `docs/E2E_FRONTEND_ISSUES_CONTRACT.md`

| Role | Count | Issue IDs |
|------|------:|-----------|
| HR_ADMIN | **7** | `ISSUE-HR-01`…`06`, `ISSUE-HR-08` (login 401s, Permissions nav, settings restricted, reports hrefs, Performance keys, reports 404, attendance Half Day vs PRESENT) |
| MANAGER | **13** | `ISSUE-MGR-02` (self Approve→`SELF_APPROVAL_FORBIDDEN`), `09` (non-team→`NOT_TEAM_APPROVER`), `03` (unfiltered nav), `04` (bulk leave-only), `05`/`11` (404 routes), `13` (`/payroll/runs` OPEN), `10` (Activity tab), `06`/`07`/`12`/`14`/`08` (designation, PROGRESS, login 401s, payslip skeleton, intermittent employees) |
| EMPLOYEE | **9** | `ISSUE-EMP-02`…`10` (AL picker FE, unfiltered nav, Team Calendar DENY, Performance/Assets nav, payslip skeleton, self-route 404s, My Team dupe, login race, roles-permissions 404) |
| SUPER_ADMIN | **7** | `ISSUE-SA-01` (login me/refresh 401s), `ISSUE-SA-03` (leave preview **404** — BOTH), `ISSUE-SA-05`…`09` (exports `ok:false`: employees CSV, payroll CSV, audit-pack, reports CSV, invoices CSV) |

**FE total: 36** · HR/MANAGER/EMPLOYEE sections **intact** (not wiped by SA deep rewrite)

---

## Critical top issues (cross-role)

| # | ID | Layer | Severity | One-line |
|---|----|-------|----------|----------|
| 1 | **ISSUE-SA-10** *(was SA-04)* | BACKEND | CRITICAL | SUPER_ADMIN (`employeeId: null`) Leave My Requests / balance binds **Priya Sharma** |
| 2 | **ISSUE-EMP-01** + FE `ISSUE-EMP-02` | BACKEND (+ FE) | CRITICAL | Annual Leave (`AL`) offered but no balance → `POST /leave/requests` **400** `NO_LEAVE_BALANCE` |
| 3 | **ISSUE-MGR-02** + **ISSUE-MGR-09** | FRONTEND | CRITICAL | Timesheets Approvals Approve/Return on own / non-team rows → **403** `SELF_APPROVAL_FORBIDDEN` / `NOT_TEAM_APPROVER` |
| 4 | **ISSUE-EMP-03** / **ISSUE-MGR-03** | FRONTEND | CRITICAL | Sidebar **unfiltered** — EMPLOYEE/MANAGER see Reports/Analytics/Permissions/Recruitment/Performance/Assets |
| 5 | **ISSUE-SA-03** / **ISSUE-EMP-02** | BOTH / BACKEND | HIGH | `GET /leave/requests/preview` → **404** |
| 6 | **ISSUE-MGR-04** | FRONTEND | HIGH | Dashboard Bulk approve opens empty **Leave** modal (leave-only) |
| 7 | **ISSUE-SA-02** | BACKEND | HIGH | SA `GET /attendance/today` **400** `NO_EMPLOYEE_RECORD` while summary already graceful |
| 8 | **ISSUE-SA-05**…**09** | FRONTEND | HIGH | Export downloads fire with `ok:false` (employees / payroll / audit-pack / reports / invoices) |
| 9 | **ISSUE-EMP-06** / **ISSUE-MGR-14** | FRONTEND | HIGH | Payslip detail stuck on skeleton |
| 10 | **ISSUE-MGR-05** / **11** / EMP-10 | FRONTEND | HIGH | `/settings/roles-permissions` + report subroutes → Next **404** (not RoleGate) |
| 11 | **ISSUE-MGR-13** | FRONTEND | HIGH | `/payroll/runs` **OPEN** for MANAGER (RoleGate miss) |
| 12 | **ISSUE-HR-07** / **09** | BACKEND | HIGH | Attendance summary excludes today; zero-duration checkout accepted as PRESENT |

---

## Per-role highlights

### SUPER_ADMIN (`superadmin@acme.test`)
- Deep crawl (**831** PNGs, **max nest depth 4**) is now SA source of truth alongside shallow (**704** PNGs).
- **CRITICAL ISSUE-SA-10** (alias: was **SA-04**): leave balance/requests return Priya Sharma while `employeeId: null`.
- BE also: `ISSUE-SA-02` attendance/today **400**; `ISSUE-SA-03` leave preview **404**; `ISSUE-SA-04` leave-assignments **401** mid-crawl.
- FE: login bootstrap 401s (`SA-01`); leave preview BOTH (`SA-03`); export `ok:false` (`SA-05`…`09`).

### EMPLOYEE (`priya@acme.test`)
- Deep **201** PNGs; 5 leave types nested: **SL** create+withdraw OK; **AL** → `NO_LEAVE_BALANCE`; leave preview **404**; unfiltered sidebar; payslip skeleton.
- Contract section intact (EMP-01…02 BE · EMP-02…10 FE).

### MANAGER (`aman@acme.test`)
- Deep **491** PNGs; **max nest depth 4**; FINDINGS at `manager-deep/FINDINGS.md`.
- Themes in live contracts: self/non-team Approve→403, unfiltered nav, bulk leave-only, 404 routes, KPI zeros (`ISSUE-MGR-01`), dept employee 403 (`ISSUE-MGR-03` BE), `/payroll/runs` OPEN, payslip skeleton.
- Contract section intact.

### HR_ADMIN (`hr@acme.test`)
- Deep **511** PNGs; nestDepth=2.
- BE: summary-vs-today (`ISSUE-HR-07`) + zero-duration checkout (`ISSUE-HR-09`).
- FE: login noise, Permissions dead-end nav, settings Access restricted, reports href/404, Performance keys, Half Day vs PRESENT.
- Contract section intact.

---

## Contract / evidence paths

| Artifact | Path |
|----------|------|
| Backend issues | [`docs/E2E_BACKEND_ISSUES_CONTRACT.md`](./E2E_BACKEND_ISSUES_CONTRACT.md) |
| Frontend issues | [`docs/E2E_FRONTEND_ISSUES_CONTRACT.md`](./E2E_FRONTEND_ISSUES_CONTRACT.md) |
| This summary | [`docs/E2E_DEEP_UI_FINAL_SUMMARY.md`](./E2E_DEEP_UI_FINAL_SUMMARY.md) |
| SA deep FINDINGS (831 PNGs) | [`docs/e2e-ui-screenshots/superadmin-deep/FINDINGS.md`](./e2e-ui-screenshots/superadmin-deep/FINDINGS.md) |
| SA shallow FINDINGS | [`docs/e2e-ui-screenshots/superadmin/FINDINGS.md`](./e2e-ui-screenshots/superadmin/FINDINGS.md) |
| Manager deep FINDINGS | [`docs/e2e-ui-screenshots/manager-deep/FINDINGS.md`](./e2e-ui-screenshots/manager-deep/FINDINGS.md) |

---

## Honest gaps

1. **superadmin-deep** Recruitment/Performance/Assets/Announcements are land-only after long Settings crawl (not fully nested).
2. Disk PNG count (831) > runner counter (372) — parallel nested pass wrote additional Settings/Reports frames.
3. **MANAGER deep** pass-1 crashed mid-Leave; mitigated by resume/phase3/spot (max nest depth still **4**).
4. FINDINGS label map slightly differs from live IDs for a few MANAGER items (e.g. dept 403 is BE `ISSUE-MGR-03` in contract; FINDINGS map said `ISSUE-MGR-09` which FE uses for non-team Approve). **Live contract IDs win.**
5. SA ID renumber: leave→Priya is **SA-10** (was **SA-04**); current **SA-04** = leave-assignments 401.
6. No production/Render verification (local tunnel only).

---

## Verdict

Deep UI E2E across four roles via **Playwright**, **~3,095** screenshots, two living contracts (all four role sections preserved). **Ship blockers:** **SA-10** leave identity leak (confirmed in BE contract; was SA-04), EMPLOYEE orphan `AL` / `NO_LEAVE_BALANCE`, MANAGER Approvals self/non-team actions, global **unfiltered sidebar**. Overall rollout: **PARTIAL PASS**.
