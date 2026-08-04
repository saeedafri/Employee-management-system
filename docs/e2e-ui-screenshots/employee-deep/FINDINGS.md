# EMPLOYEE Full-Depth Nested UI E2E Findings

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Role | `EMPLOYEE` — `priya@acme.test` / `Password123!` / tenant `acme-corp-001` |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000` (Hostinger DB/Redis tunnel) |
| Tooling | Playwright `docs/e2e-ui-screenshots/employee-deep/_employee-deep-nested.mjs` |
| Screenshots | `docs/e2e-ui-screenshots/employee-deep/` — **201** PNGs (`NNN-*.png`) |
| Raw JSON | `results.json`, `depth-stats.json`, `nav-items.json`, `_run.log` |

---

## Depth stats

| Metric | Count |
|--------|------:|
| Screenshots | **201** |
| Menus visited | **24** |
| Tabs clicked | **31** |
| Buttons clicked | **72** |
| Dialogs opened | **13** |
| Nested layers traversed | **97** |
| Leave types tried (all picker options) | **5** |
| Payslips opened | **1** |
| Notification actions | **3** |
| Admin probes | **13** |
| Settings routes clicked | **29** |
| Sidebar items visible | **17** (unfiltered) |
| Mutations recorded | **10** |
| Findings (raw runner) | 55 (41 expected admin RoleGate DENY) |
| Product defects (deduped below) | **11** (2 Critical · 4 High · 5 Medium) |

---

## Coverage matrix (what was nested)

| Area | Nested actions performed | Evidence |
|------|--------------------------|----------|
| Login | Form → fill → Sign in | `001`–`003` |
| Sidebar | Full nav capture + click-through all 17 | `004`, `184`–`200` |
| Dashboard | Land, Request Leave dialog, widgets | `005`–`009` |
| Attendance | Calendar / Table / Regularization; reg dialog fill all fields; CI/CO state | `010`–`021` |
| Timesheets | Tabs, week nav, Log time form (project/task/day/hours/billable/note), Templates, Copy last week, Submit week | `022`–`037` |
| Leave | All tabs; **all 5 leave types** fill+submit; withdraw PENDING | `038`–`058` |
| Holidays | Land + full view | `059`–`060` |
| Payroll My Pay | All 6 tabs + nested tab buttons; payslip drawer; download attempt; year filter | `061`–`107` |
| Payout | Add account dialog fill | `108`–`113` |
| Employees / Depts | Filter/search; dept select | `114`–`119` |
| Announcements | Category buttons + item | `120`–`125` |
| Admin shells | Reports/Analytics/Permissions/Recruitment/Performance/Assets + settings probes + employees/new + payroll/global+migration | `126`–`144` |
| Settings | All 29 settings routes | `145`–`175` |
| Notifications | Open → item click → Mark all read | `176`–`178` |
| Profile | Menu → Profile & settings | `179`–`180` |
| Self wireframe routes | `/employees/me/*`, `/employee/dashboard` | `181`–`183` |

### Mutations log

| Action | Result | Shot |
|--------|--------|------|
| Leave submit Annual Leave (`AL`) | **400** `NO_LEAVE_BALANCE` | `049` |
| Leave submit Sick Leave (`SL`) | **201** PENDING | `051` |
| Leave submit Comp Off (`CO`) | **400** `INSUFFICIENT_BALANCE` (available 0) | `053` |
| Leave submit Earned Leave (`EL`) | **400** `NO_CHARGEABLE_DAYS` (Sat 2026-11-14 — test date on weekend) | `055` |
| Leave submit Casual Leave (`CL`) | **400** `NO_CHARGEABLE_DAYS` (Sun 2026-11-15 — test date on weekend) | `057` |
| Leave withdraw (SL request) | **200** | `058` |
| Notifications mark-all-read | **200** `PATCH /api/notifications/read-all` | `178` |
| Timesheet Log time / Submit week | UI opened; **no POST** (Project required not selected) | `030`, `037` |
| Payslip download | Drawer skeleton; download control not reached | `104`–`105` |

> Check-in/out: prior same-day session already completed — buttons absent (`006`, `014`–`015`). Not re-mutated this run.

---

## Working (OK)

| Area | Evidence |
|------|----------|
| Login EMPLOYEE | `POST /api/auth/login` **200** → dashboard `003` |
| Attendance views + regularization dialog fields | `010`–`017` |
| Timesheets deep Log time UI (all fields visible) | `028`–`029` |
| Leave My Requests / Comp-off tabs | `040`, `042` |
| Sick Leave create + Withdraw | `051`, `058` |
| Holidays | `059`–`060` |
| Payroll redirect `/payroll` → My Pay | `061` |
| Payroll tabs Comp/Tax/Claims/Loans/Forms | `063`–`098` |
| `/payroll/global` + `/migration` safe redirect → My Pay | `139`–`140` |
| Payout Add account dialog | `109`–`110` |
| Employees: no Add/Export for Priya | `114` |
| Notifications open / item / mark-all | `176`–`178` |
| Self settings sessions + notifications | `147`–`149` |
| Admin deep-links RoleGate DENY (no data leak) | `126`–`138`, `150`–`174` |

---

## Critical bugs

### C1. Annual Leave (`AL`) orphan type — `NO_LEAVE_BALANCE`

| | |
|--|--|
| **Layer** | **BACKEND** (primary) + **FRONTEND** (offers/default) |
| **Severity** | CRITICAL |
| **UI** | Leave → New Request → Annual Leave → Submit → toast “No leave balance available for this type” |
| **Screenshot** | `048-leave-filled-annual-leave.png`, `049-leave-submit-annual-leave.png` |
| **Network** | `POST /api/leave/requests` **400** `NO_LEAVE_BALANCE` |
| **API truth** | `GET /leave/types` includes `{id:"AL",name:"Annual Leave"}`; `GET /leave/balance` has **no AL row** (EL/SL/CL/CO only). Same session: `SL` → **201**. |
| **Fix (BE)** | Seed `LeaveBalance` for AL **or** remove/disable orphan AL from `/leave/types` |
| **Fix (FE)** | Default picker to first type with `available > 0`; hide types with missing/zero balance where not allowed |

### C2. Sidebar not role-filtered — EMPLOYEE sees full admin nav (17 items)

| | |
|--|--|
| **Layer** | **FRONTEND** (`AppShell` `NAV_ITEMS`) |
| **Severity** | CRITICAL |
| **Visible** | Reports, Analytics, Permissions, Settings, Recruitment, Performance, Assets (+ Employees/Departments) |
| **Deep-link** | Correctly Access restricted — not a data leak |
| **Screenshot** | `004-nav-sidebar-full.png`, `184`–`199` |
| **Fix** | Filter nav by `memberType` per role-nav contract; keep RoleGate as backstop |

---

## High bugs

### H1. Leave “Team Calendar” tab visible → Access restricted

| | |
|--|--|
| **Layer** | FRONTEND |
| **Screenshot** | `041-leave-tab-team-calendar.png`, `044` |
| **Fix** | Hide Team Calendar for `EMPLOYEE` |

### H2. Performance / Assets / admin nav items visible → RoleGate DENY

| | |
|--|--|
| **Layer** | FRONTEND |
| **Screenshot** | `134`–`137`, `198`–`199` |
| **Fix** | Hide nav items for EMPLOYEE **or** open self-scoped screens |

### H3. `GET /api/leave/requests/preview` → **404** (FE calls missing BE route)

| | |
|--|--|
| **Layer** | **BACKEND** |
| **Severity** | HIGH |
| **Evidence** | Every leave-type submit path: `404 GET /api/leave/requests/preview?leaveTypeId=…` (AL/SL/CO/EL/CL). Direct BE probe: Fastify `Route GET:/api/v1/leave/requests/preview … not found`. |
| **Screenshot context** | leave submit shots `049`–`057` / `results.json` networks |
| **Fix** | Implement preview endpoint **or** stop FE from calling it until shipped |

### H4. Payslip detail drawer stuck on skeleton — download unreachable

| | |
|--|--|
| **Layer** | FRONTEND (timeout/error UI) ± detail fetch |
| **Severity** | HIGH |
| **UI** | My Pay → View payslip → drawer “Payslip” with perpetual skeleton bars; no Download control |
| **Screenshot** | `104-payroll-payslip-detail.png`, `105-payroll-payslip-download.png` |
| **List OK** | Payslip cards for 2023 periods visible behind drawer |
| **Fix** | Bound loading; surface error if detail `GET` fails; ensure `/payroll/employees/:id/payslips/:payslipId` completes |

---

## Medium bugs

### M1. Wireframe self routes → Next **404**

| | |
|--|--|
| **Layer** | FRONTEND (routing) |
| **Paths** | `/employees/me/documents`, `/employees/me/team`, `/employee/dashboard` |
| **Screenshot** | `181`–`183` |
| **Fix** | Add aliases/redirects to dashboard widgets that already call `/api/employee/*` |

### M2. Dashboard “My Team” duplicates Aman Kumar

| | |
|--|--|
| **Layer** | FRONTEND mapping (± BE `/employee/team`) |
| **Screenshot** | `003`, `005` |
| **Fix** | Dedupe by `employeeId` |

### M3. Login briefly hits `401` `/auth/me` + `/auth/refresh`

| | |
|--|--|
| **Layer** | FRONTEND (race) |
| **Network** | `401 GET /api/auth/me`, `401 POST /api/auth/refresh` then dashboard OK |
| **Screenshot** | `003` / `results.json` Login |

### M4. Leave balance labels “Annual” vs API `Earned Leave (EL)` + orphan `AL`

| | |
|--|--|
| **Layer** | FRONTEND display ± BE naming |
| **Related** | C1 |
| **Screenshot** | `005`, `039` |

### M5. `/settings/roles-permissions` → Next **404** (not RoleGate)

| | |
|--|--|
| **Layer** | FRONTEND (routing) |
| **Screenshot** | `144-admin-probe-settings-roles-permissions.png`, `175` |
| **Fix** | Wire route or redirect; EMPLOYEE should never land on bare 404 |

### M6. Log time submit blocked — Project required (deep UI OK, mutation not completed)

| | |
|--|--|
| **Layer** | INFO / UX gap in automation (product may be OK) |
| **UI** | Log time dialog shows Project “Select a project”, Hours 7.5, Billable on — clicking Log time does not POST while project empty |
| **Screenshot** | `028`–`030` |
| **Note** | Not filed as defect if empty project list is seed gap; if projects exist and picker failed to populate options → FRONTEND |

---

## Admin / restriction matrix (EMPLOYEE)

| Route | Nav visible? | Result | Shot |
|-------|:------------:|--------|------|
| `/reports` | Yes | Access restricted | `127` |
| `/analytics` | Yes | Access restricted | `129` |
| `/permissions` | Yes | Access restricted | `131` |
| `/recruitment` | Yes | Access restricted | `133` |
| `/performance` | Yes | Access restricted | `135` |
| `/assets` | Yes | Access restricted | `137` |
| `/employees/new` | No | Access restricted | `138` |
| `/payroll/global` | via Payroll | Redirect → My Pay (OK) | `139` |
| `/payroll/migration` | No | Redirect → My Pay (OK) | `140` |
| `/settings/company-profile` … pay/* | via Settings | Access restricted | `141`–`174` |
| `/settings/roles-permissions` | No | **404** (M5) | `144` |
| `/settings/sessions` | self | OK | `147` |
| `/settings/notifications` | self | OK | `149` |

**No privilege-escalation data leak** on RoleGate pages. Issues are nav hygiene, leave data integrity, missing preview route, payslip detail hang, and 404 routes.

---

## Verdict

Full-depth nested EMPLOYEE pass (**201** screenshots, **97** nested layers) confirms day-to-day blockers: **C1 leave AL**, **C2 unfiltered nav**, **H3 missing leave preview API**, **H4 payslip detail skeleton**. Attendance/timesheet shells and payroll tab navigation largely work; Sick Leave + withdraw and notifications mark-all-read succeed. Not PASS until C1/C2/H3/H4 addressed.
