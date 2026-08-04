# MANAGER Full-Depth Nested UI E2E Findings

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Role | `MANAGER` — `aman@acme.test` / `Password123!` / tenant `acme-corp-001` |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000` (Hostinger DB/Redis tunnel) |
| Tooling | Playwright — `_deep_e2e_mgr.mjs` + `_deep_e2e_mgr_resume.mjs` + `_deep_e2e_mgr_phase3.mjs` + `_spotcheck_gaps.mjs` + gap-fill |
| Screenshots | `docs/e2e-ui-screenshots/manager-deep/` — **~491** PNGs (numbered through **472**; spot/phase3/gap overlaps on some indices) |
| Logs / JSON | `_run.log`, `_run_resume.log`, `_run_phase3.log`, `_spotcheck.log`, `results-resume.json`, `results-phase3.json`, `results-spotcheck.json`, `results-gapfill.json`, `nav-items.json` |
| Cross-ref (shallow) | `docs/e2e-ui-screenshots/manager/FINDINGS.md` (94 PNGs) — **SELF_APPROVAL_FORBIDDEN** on own Approve/Return |

---

## Depth stats (combined passes)

| Metric | Count |
|--------|------:|
| Screenshots (files on disk) | **491** |
| Nest action shots by level | n1=**41** · n2=**139** · n3=**62** · n4=**16** (total **258**) |
| Tab / modal shots | tabs **98** · modals **78** |
| Phase-1 nested (crash @ leave) | `001`–`211` |
| Resume (Leave / Holidays / Payroll) | `212`–`394` |
| Phase-3 (Payout / admin DENY / settings / shell) | through `469` |
| Spotcheck + gap-fill | `395-spot-*`…`411-spot-*`, `468-gap-*`…`472-gap-*` |
| Sidebar items visible | **17** (unfiltered) |
| Admin RoleGate DENY (phase-3) | **42** (hard LEAK=**0**; soft OPEN `/payroll/runs`) |
| Product defects (deduped below) | **13** (2 Critical · 8 High · 3 Medium) |
| Backend-classified defects | **2** (`ISSUE-MGR-01` KPIs · `ISSUE-MGR-09` dept 403) |
| Frontend-classified defects | **11** |

### Coverage matrix

| Area | Nested actions | Evidence |
|------|----------------|----------|
| Login / shell | Form → Sign in → sidebar capture | `001`–`004` |
| Dashboard | Land, zero-attendance anomaly, Bulk approve modal, View team / pending links | `005`–`015`, `465`–`469`, `472-gap-*` |
| Employees | Filters, search, density/columns, employee detail tabs (Overview→Activity) | `016`–`050` |
| Departments | Select dept, open employee (Ananya Joshi → API 403) | `051`–`054` |
| Attendance | Filters, check-out, regularization nested dialogs, calendar/table, dept filter | `055`–`075` |
| Timesheets | Tabs, Approvals Approve/Return, History, Log time, Delegations, week nav | `076`–`121`, `462`–`464`, `469`–`470-gap-*` |
| Leave | All tabs, New Request nested, ledgers, Comp-off, Approvals focus (resume) | `122`–`243` |
| Holidays | Year nav | `244`–`246` |
| Payroll My Pay | Payslips drawers, Comp/Tax/Claims/Loans/Forms nested, Form16 generate | `247`–`394`, `410-spot-payslip-drawer.png` |
| Payout methods | Add / Add account / Approvals | `396`–`401` (phase-3) / `396-spot-*` |
| Announcements | Add / New modals | `402`–`406` |
| Admin shells | Reports/Analytics/Permissions/Recruitment/Performance/Assets DENY | `407`–`412`, `398-spot`–`403-spot`, `443`–`451` |
| Settings | Landing + privileged DENY + **roles-permissions 404** | `413`–`442`, `435`, `405-spot-*`, `458` |
| Shell extras | Notifications mark-all-read | `459`–`461` |

### Mutations / API decisions observed

| Action | Result | Evidence |
|--------|--------|----------|
| Timesheet Approve (Priya Sharma — direct report) | **SUCCESS** toast “Priya Sharma's week approved” | `092`–`093` |
| Timesheet Approve (HR Admin / non-direct) | **403** `NOT_TEAM_APPROVER` | `094`–`099`, `470-gap-*` |
| Timesheet Return (HR Admin) | Modal opens → **403** `NOT_TEAM_APPROVER` toast “You can only decide requests for your direct reports” | `100`–`101`, `463`–`464` |
| Timesheet Approve/Return (Aman Kumar **own** rows) | **Not re-observed in deep** (own weeks absent from Approvals queue). **Shallow** same-day: **403** `SELF_APPROVAL_FORBIDDEN` | shallow `30`, `69`, `70` + `_followup.json` |
| Attendance check-out / regularization UI | Dialogs nested; no confirmed new reg create in logs | `059`–`069` |
| Notifications mark-all-read | UI exercised | `459`–`461` |

---

## Working (OK)

| Area | Evidence |
|------|----------|
| Login as MANAGER | `003-login-submit-ok.png` → dashboard |
| Employees list + detail tabs (except Activity) | `016`–`040` |
| Attendance calendar/table/regularization UI | `055`–`075` |
| Timesheet approve **direct report** | `093` Priya Sharma |
| Leave tabs / Team Calendar / Comp-off / ledgers | `122`–`243` |
| Holidays | `244`–`246` |
| Payroll My Pay personal payslips + Download PDF control | `247`–`394`, `410-spot-*` |
| Payout methods + Announcements land | phase-3 / spot |
| Admin deep-links RoleGate DENY | `407`–`412`, `443`–`451`, `453`–`457` (except bare 404s + `/payroll/runs` OPEN below) |
| Privileged settings DENY | `415`–`434`, `436`–`442` |

---

## Critical bugs

### C1. Timesheets Approvals shows Approve/Return on manager’s **own** rows → API 403 `SELF_APPROVAL_FORBIDDEN`

| | |
|--|--|
| **Layer** | **FRONTEND** (primary) — BACKEND correctly rejects |
| **Severity** | CRITICAL |
| **API** | `POST /api/timesheets/{id}/reject` → **403** `SELF_APPROVAL_FORBIDDEN` — “You cannot approve or reject your own request” |
| **Also** | Shallow: `POST .../approve` **403** on id `cmr4fpp2m006ggrlntoghkxu0` (Aman Kumar own week) |
| **UI** | Approvals table lists “Aman Kumar” with Approve + Return; Return modal opens; toast shows error |
| **Deep status** | **Not re-proven** in `manager-deep` / gap-fill — Aman Kumar rows no longer in Approvals queue (`hasAmanOwnInApprovals=false`). Keep from shallow same-day evidence. |
| **Screenshots** | Shallow: `manager/30-timesheets-approvals-view.png`, `69-timesheet-return-modal.png`, `70-timesheet-return-result.png` |
| **Expected** | Hide Approve/Return (or grey out) when `employeeId === current user`; filter own submissions out of Approvals queue |

### C2. Timesheets Approvals shows Approve/Return for **non-direct reports** → API 403 `NOT_TEAM_APPROVER`

| | |
|--|--|
| **Layer** | **FRONTEND** (primary) — BACKEND correctly rejects |
| **Severity** | CRITICAL (broken UX / false failure; same class as C1) |
| **API** | `POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve\|reject` → **403** `NOT_TEAM_APPROVER` — “You can only decide requests for your direct reports” |
| **UI** | Approvals lists HR Admin, Rajesh Sharma, … with active Approve/Return; Return modal opens for HR Admin; toast error |
| **Screenshots** | `091-timesheets-approvals-view-view.png`, `095`–`101`, `463-timesheets-return-modal-open.png`, `464-timesheets-return-result-done.png`, `470-gap-hr-admin-approve-result.png` |
| **Note** | Phase-3 labeled this “own row” incorrectly — body is `NOT_TEAM_APPROVER`, target row is **HR Admin**, not Aman. Direct-report approve (Priya) still works (`093`). |
| **Expected** | Only list (or only enable actions for) employees the manager can decide |

---

## High bugs

### H1. Sidebar not role-filtered — MANAGER sees restricted menus

| | |
|--|--|
| **Layer** | **FRONTEND** (`AppShell` `NAV_ITEMS`) |
| **Visible but DENY** | Reports, Analytics, Permissions, Recruitment, Performance, Assets |
| **Screenshots** | `004-shell-sidebar-visible.png`, `407`–`412`, spot `398`–`403` |
| **Deep-link** | Correctly Access restricted (leak=0) — nav noise remains |

### H2. “Bulk approve” opens **Leave** modal (empty) even when reg/leave queue empty or mismatched

| | |
|--|--|
| **Layer** | **FRONTEND** |
| **Repro** | Dashboard → **Bulk approve** → “Bulk Approve Leave Requests” / “No pending leave requests”; Approve selected still enabled |
| **Screenshots** | `008`–`010`, `466`–`469`, `472-gap-bulk-approve-modal.png` |
| **Shallow cross-ref** | When Pending Approvals were regularizations, same leave-only modal (`manager/66-…`) |
| **Expected** | Bulk-approve regularization queue, or rename/split leave vs regularization |

### H3. `/settings/roles-permissions` is a dead **404** (not RoleGate DENY)

| | |
|--|--|
| **Layer** | **FRONTEND** (routing) |
| **Screenshots** | `435-settings-settings-roles-permissions-404.png`, `405-spot-settings-roles-permissions-404.png`, `458-admin-deeplink-settings-roles-permissions-404.png` |

### H4. Employee detail **Activity** tab visible → “Access restricted… HR administrators only”

| | |
|--|--|
| **Layer** | **FRONTEND** (tab should hide for MANAGER) |
| **Screenshots** | `034`, `041-employee-detail-tab-activity-view.png` |

### H5. Report sub-routes return bare **404** instead of RoleGate DENY

| | |
|--|--|
| **Layer** | **FRONTEND** (routing) |
| **Paths** | `/reports/headcount`, `/reports/absenteeism`, `/reports/pay-equity` |
| **Screenshots** | `444`–`446` (`ISSUE-MGR-DEEP-P3-02`…`04`) |
| **Contrast** | `/reports` itself DENYs correctly (`407`, `443`) |
| **Contract** | FE `ISSUE-MGR-11` |

### H6. Payslip detail drawer stuck on skeletons

| | |
|--|--|
| **Layer** | **FRONTEND** (loading/error UX) |
| **Evidence** | Drawer title “Payslip” with skeleton bars only — repeated nested opens |
| **Screenshots** | `251`, `368`, `410-spot-payslip-drawer.png` |
| **Contract** | FE `ISSUE-MGR-12` |

### H7. Deep-link `/payroll/runs` **OPEN** for MANAGER (admin payroll shell)

| | |
|--|--|
| **Layer** | **FRONTEND** (RoleGate miss) |
| **UI** | `Payroll > runs` — “Export Register” + Payslips skeletons (not DENY / not My Pay redirect) |
| **Screenshots** | `452-admin-deeplink-payroll-runs-open.png` |
| **Expected** | RoleGate DENY or redirect to `/payroll` My Pay |
| **Contract** | FE `ISSUE-MGR-13` |

---

## Medium bugs


### H6. `/payroll/runs` opens for MANAGER (admin shell / Export Register) — privilege leak

| | |
|--|--|
| **Layer** | **FRONTEND** (RoleGate miss) |
| **Evidence** | Phase-3 deep-link access **OPEN** — breadcrumbs `Payroll > runs`, Export Register, payslips skeleton |
| **Screenshots** | `452-admin-deeplink-payroll-runs-open.png` |
| **Expected** | RoleGate DENY or redirect to My Pay |

### H7. Payslip detail drawer intermittently stuck on skeletons

| | |
|--|--|
| **Layer** | **FRONTEND** (loading/error UX) |
| **Evidence** | Nested payslip opens show empty “Payslip” skeleton drawer (`251`, `368`); spot later loaded full payslip + Download (`410-spot`) |
| **Screenshots** | `251-…modal-open.png`, `368-…modal-open.png`, contrast `410-spot-payslip-drawer.png` |

### M1. Manager dashboard Present Today = 0 / Avg. Attendance = 0% while week grid shows Present

| | |
|--|--|
| **Layer** | **BACKEND** (summary / weekly aggregation / timezone) |
| **Evidence** | Cards: Present Today **0**, Avg **0%**; Team Attendance Mon 3: **P. Sharma = P** |
| **Screenshots** | `007-dashboard-zero-attendance-anomaly-observed.png`, `005`–`006` |
| **API** | Team weekly endpoint returns 200 but card metrics disagree with grid cells |
| **Note** | Shallow FINDINGS `M1` / contract `ISSUE-MGR-01` — **reconfirmed deep** (refined: not “all A”; at least one **P** vs Present Today 0) |

### M2. Timesheet Approvals **PROGRESS** column always empty

| | |
|--|--|
| **Layer** | FRONTEND (or missing BE field) |
| **Screenshots** | `091`, `462`, `411-spot-timesheets-approvals.png` |

### M3. Payslip / employee header Designation concatenates date

| | |
|--|--|
| **Layer** | **FRONTEND** (display mapping) |
| **Evidence** | Designation `Senior Engineer 2026-07-02` (payslip drawer + employee header “Senior Engineer 2026-07-02 · Engineering”) |
| **Screenshots** | `410-spot-payslip-drawer.png`, `041-employee-detail-tab-activity-view.png` (header) |

### M4. Login bootstrap pre-auth 401s (cosmetic)

| | |
|--|--|
| **Layer** | **FRONTEND** |
| **Network** | Anonymous `GET /api/auth/me` **401**, `POST /api/auth/refresh` **401** on `/login` |
| **Screenshots** | `001-login-page-view.png` (`ISSUE-MGR-DEEP-01`/`02`) |

---

## Not defects / correct enforcement

| Observation | Why not a product bug |
|-------------|------------------------|
| Admin menus DENY on deep-link | RoleGate works; defect is nav visibility (H1) |
| `NOT_TEAM_APPROVER` / `SELF_APPROVAL_FORBIDDEN` API 403 | BE correct; FE must hide actions (C1/C2) |
| Departments → Ananya Joshi `GET /api/employees/…` **403** | Scope may be intentional; still filed BE `ISSUE-MGR-09` because FE offers click-through then skeleton hang |
| Resume/phase browser crashes (`page.waitForTimeout: Target closed`) | Runner instability, not product |
| Employees intermittent skeletons (shallow M9) | **Not re-proven** in deep (list loaded `016`+) |

---

## Auth matrix (MANAGER)

| Menu | Sidebar visible? | Page result | Layer if wrong |
|------|:----------------:|-------------|---------------|
| Dashboard | ✅ | OK (My Team) + M1 cards | BE |
| Employees | ✅ | OK; Activity tab DENY | FE H4 |
| Departments | ✅ | OK; some employee opens 403 | — |
| Attendance | ✅ | OK | — |
| Timesheets | ✅ | OK + C1/C2/M2 | FE |
| Leave | ✅ | OK | — |
| Holidays | ✅ | OK | — |
| Payroll | ✅ | OK (My Pay) + M3/H7; `/payroll/runs` **OPEN** leak | FE |
| Payout methods | ✅ | OK | — |
| Reports | ✅ should hide | DENY; subroutes **404** | FE H1/H5 |
| Analytics | ✅ should hide | DENY | FE H1 |
| Permissions | ✅ should hide | DENY | FE H1 |
| Settings | ✅ | Landing OK; privileged DENY; roles-permissions **404** | FE H3 |
| Recruitment / Performance / Assets | ✅ should hide | DENY | FE H1 |
| Announcements | ✅ | OK | — |

---

## Console / network noise

| Event | Notes |
|-------|-------|
| `GET /api/auth/me` 401 + `POST /api/auth/refresh` 401 | Login bootstrap — M4 |
| `POST .../timesheets/.../approve\|reject` 403 `NOT_TEAM_APPROVER` | C2 |
| Shallow `POST .../approve\|reject` 403 `SELF_APPROVAL_FORBIDDEN` | C1 |
| `GET /api/employees/{id}?includeTerminated=true` 403 | Ananya Joshi from Departments |

---

## Verdict

| Area | Verdict |
|------|---------|
| Core manager timesheet approve (direct report) | **PASS** |
| Timesheet actions on own / non-team rows | **FAIL** (FE C1 + C2) |
| Role nav hygiene | **FAIL** (FE H1) |
| Bulk approve vs leave/reg | **FAIL** (FE H2) |
| Settings / report routing | **FAIL** (404s H3/H5) |
| Admin enforcement (no leak) | **PARTIAL** — top-level DENY OK; `/payroll/runs` **OPEN** (H7); report subroutes **404** (H5) |
| Payslip detail drawer | **FAIL** (FE H6 skeletons) |
| Dashboard attendance cards | **FAIL** (BE M1) |
| Overall MANAGER deep E2E | **PARTIAL PASS** — usable core flows; critical Approvals action visibility + nav/bulk/routing FE gaps; attendance card BE inconsistency |

---

## Contract ID map

| FINDINGS | Contract |
|----------|----------|
| C1 + C2 | FE `ISSUE-MGR-02` |
| H1 | FE `ISSUE-MGR-03` |
| H2 | FE `ISSUE-MGR-04` |
| H3 | FE `ISSUE-MGR-05` |
| H4 | FE `ISSUE-MGR-10` |
| H5 | FE `ISSUE-MGR-11` |
| H6 | FE `ISSUE-MGR-12` |
| H7 | FE `ISSUE-MGR-13` |
| M1 | BE `ISSUE-MGR-01` |
| M2 | FE `ISSUE-MGR-07` |
| M3 | FE `ISSUE-MGR-06` |
| Dept employee 403 | BE `ISSUE-MGR-09` |

## Top bugs (priority)

1. **C2/C1** — Approvals Approve/Return on non-decidable / own rows → API 403 (FE)
2. **H7** — `/payroll/runs` OPEN for MANAGER (FE RoleGate)
3. **H1** — Unfiltered sidebar admin nav (FE)
4. **H6** — Payslip drawer perpetual skeletons (FE)
5. **H3/H5** — `roles-permissions` + report subroutes **404** (FE)
6. **M1** — Dashboard Present Today / Avg Attendance vs grid (BE)

---

## Runner notes

1. Phase-1 crashed mid-Leave (`_run.log` end) → resume from shot 211.
2. Resume crashed after Payroll while opening remaining menus (`_run_resume.log` error-crash shots) → phase-3 fresh browser from ~394.
3. Spotcheck + gap-fill reused some shot numbers (`395+`); prefer filename suffix (`spot-` / `gap-` / phase-3 settings) when citing.
4. Phase-3 `ISSUE-MGR-DEEP-P3-06` mis-tagged “own row”; treat as **C2** (`NOT_TEAM_APPROVER` on HR Admin).
