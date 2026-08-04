# EMPLOYEE Deep UI E2E Findings

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Role | `EMPLOYEE` — `priya@acme.test` / `Password123!` / tenant `acme-corp-001` |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000` (Hostinger DB/Redis tunnel) |
| Tooling | Playwright (`scripts/e2e-employee-deep.mjs` + follow-up) |
| Screenshots | `docs/e2e-ui-screenshots/employee/` — **78** PNGs (`NN-*.png`) |
| Raw JSON | `results.json`, `followup-results.json`, `nav-items.json` |

---

## Summary counts

| Metric | Count |
|--------|------:|
| Screenshots | 78 |
| Sidebar items visible | **17** (unfiltered — same as admin) |
| Critical issues | **2** |
| High issues | **3** |
| Medium issues | **5** |
| Mutations performed | Check-in **201**, Check-out **200**, Notifications mark-all-read **200**; leave EL create+withdraw via API probe (UI AL path failed) |
| Backend-classified issues | 2 |
| Frontend-classified issues | 8 |

### Working (OK)

| Area | Evidence |
|------|----------|
| Login as EMPLOYEE | `POST /api/auth/login` **200** → `/dashboard` — `03-login-success-dashboard.png` |
| Employee dashboard | Hi Priya, leave widgets, docs, team — `04-nav-visible-sidebar.png`, `05-dashboard-landing.png` |
| Attendance check-in | `POST /api/attendance/check-in` **201** toast “Checked in successfully” — `06-dashboard-check-in-result.png` |
| Attendance check-out | `POST /api/attendance/check-out` **200** (then duplicate **400** `ALREADY_CHECKED_OUT`) — `59-followup-dashboard-check-out-result.png` |
| Attendance Calendar / Table / Regularization dialog | `07`–`13` |
| Timesheets My Timesheet / Templates / Log time UI | `14`–`16`, `77-followup-timesheet-log-time.png` |
| Leave My Requests + New Request dialog | `17`, `61`–`63` |
| Holidays | `25`, `78-followup-holidays-full.png` |
| Payroll My Pay (redirect from `/payroll`) + payslip detail | `26`–`29`, `56`, `75-followup-payslip-view.png` (`GET .../payslips/{id}` **200**) |
| Tax Declaration tab | `76-followup-tax-declaration.png` |
| Payout methods | `31`–`32` |
| Employees / Departments list (read) | `33`–`34` — no Export/Add controls visible |
| Announcements | `37` |
| Notifications bell + mark all read | `PATCH /api/notifications/read-all` **200** |
| Settings sessions / notifications (self) | `41`–`43` |
| Admin deep-links DENY | Reports/Analytics/Permissions/Recruitment/settings\* → Access restricted — `48`–`55` |
| `/payroll/global` redirected to My Pay (safe) | `56-admin-probe-payroll-global.png` |

---

## Critical bugs

### C1. New Leave Request defaults to **Annual Leave (AL)** → `NO_LEAVE_BALANCE` while UI shows balance

| | |
|--|--|
| **Layer** | **BACKEND** (primary data) + **FRONTEND** (default/mapping) |
| **Severity** | **CRITICAL** — employee cannot submit leave for the default type |
| **UI** | Leave → New Request → Leave Type “Annual Leave”, dates filled → toast **“No leave balance available for this type”** |
| **Screenshot** | `64-followup-leave-submit-result.png` |
| **Network (UI)** | `POST /api/leave/requests` **400** |
| **API probe** | `leaveTypeId: "AL"` → **400** `NO_LEAVE_BALANCE` / `No leave balance found for this leave type` |
| **Contradiction** | `GET /leave/types` includes `{ id: "AL", name: "Annual Leave" }` but `GET /leave/balance` has **no AL row** (has `EL`/`SL`/`CL`/`CO` only). Same session: `leaveTypeId: "EL"` → **200** PENDING, then withdraw **200**. |
| **Dashboard lie** | Leave Balance widget shows “Annual 16 / Casual 9 / Sick 10” (`04`) while balance API is EL=9, CL=12, SL=12 |
| **Fix (BE)** | Seed `LeaveBalance` for AL **or** remove/disable orphan AL type; ensure every active type has a balance row |
| **Fix (FE)** | Default leave-type picker to a type with `available > 0`; never offer AL if balance missing; align “Annual” label with `EL`/`AL` consistently |

### C2. Sidebar not role-filtered — EMPLOYEE sees full admin nav

| | |
|--|--|
| **Layer** | **FRONTEND** (`ems-frontend/src/shared/layouts/AppShell.tsx` `NAV_ITEMS` — no `memberType` filter) |
| **Severity** | **CRITICAL** (security/UX — same class as manager sweep) |
| **Visible to EMPLOYEE** | Reports, Analytics, Permissions, Settings, Recruitment, Performance, Assets (+ Employees/Departments) |
| **Deep-link behavior** | Correctly **Access restricted** for admin areas (`48`–`55`, `35`, `36`) — not a data leak, but nav violates `UI_CONTRACT_role_nav_no_employee_2026-07-19.md` |
| **Screenshot** | `04-nav-visible-sidebar.png` |
| **Fix** | Hide nav items per role matrix; keep RoleGate as backstop only |

---

## High bugs

### H1. Leave “Team Calendar” tab visible → Access restricted

| | |
|--|--|
| **Layer** | **FRONTEND** |
| **Severity** | HIGH |
| **Repro** | Leave → Team Calendar |
| **UI** | “Access restricted — Team calendar is available to managers and HR admins.” |
| **Screenshot** | `19-leave-view-calendar.png` |
| **Fix** | Hide Team Calendar (and Comp-off if not applicable) for `EMPLOYEE` |

### H2. Performance / Assets in nav but RoleGate denies EMPLOYEE

| | |
|--|--|
| **Layer** | **FRONTEND** |
| **Severity** | HIGH |
| **UI** | Performance: “restricted to HR and Super Admins” — `35-performance-landing.png`; Assets similar — `36` |
| **Note** | Prior UI contract suggested employee **self** Performance/Assets — current RoleGate is stricter than nav implies |
| **Fix** | Either hide nav items for EMPLOYEE **or** open self-scoped screens |

### H3. Attendance card stale “Checked in” after successful check-out

| | |
|--|--|
| **Layer** | **FRONTEND** (state/cache) |
| **Severity** | HIGH |
| **Evidence** | After `POST /attendance/check-out` **200**, toast “Already checked out today” from **second** POST **400**, while card still shows green **Checked in** + checkout time + “Completed for today” — `59-followup-dashboard-check-out-result.png` |
| **API** | First checkout OK; duplicate `ALREADY_CHECKED_OUT` |
| **Fix** | Invalidate/refetch `attendance/today` after checkout; disable button immediately; debounce double-submit |

---

## Medium bugs

### M1. Wireframe self routes 404 in Next app

| | |
|--|--|
| **Layer** | **FRONTEND** (routing) |
| **Paths** | `/employees/me/documents`, `/employees/me/team`, `/employee/dashboard` |
| **UI** | “404 Page not found” — `44`–`46` |
| **Note** | Dashboard already embeds My Documents / My Team via `/api/employee/*` — aliases missing |

### M2. Dashboard “My Team” duplicates Aman Kumar

| | |
|--|--|
| **Layer** | FRONTEND mapping or BACKEND `/employee/team` payload |
| **Screenshot** | `04`, `06` — Aman listed twice (one with Manager badge) |
| **Fix** | Dedupe by employeeId; clarify manager vs peer rows |

### M3. Login briefly hits 401 `/auth/me` + `/auth/refresh` before session settles

| | |
|--|--|
| **Layer** | FRONTEND race (cookies not ready) |
| **Network** | `401 GET /api/auth/me`, `401 POST /api/auth/refresh` during login transition (then dashboard OK) |
| **Screenshot context** | `results.json` Login screenResult |
| **Fix** | Gate `/auth/me` until login mutation settles; suppress noisy console |

### M4. Leave balance labels mismatch API codes

| | |
|--|--|
| **Layer** | FRONTEND (display) ± BE naming |
| **Evidence** | UI “Annual” vs API `Earned Leave (EL)` + orphan `Annual Leave (AL)` |
| **Related** | C1 |

### M5. No employee export controls (PASS) — note

| | |
|--|--|
| **Layer** | INFO |
| **Evidence** | Employees page: no Export/Add buttons for Priya — `33`, follow-up labels `[]` |
| **Admin probes** | `/employees/new` Access restricted — `55` |

---

## Mutations log (non-destructive intent)

| Action | Result | Shot |
|--------|--------|------|
| Check-in (dashboard) | `POST /api/attendance/check-in` **201** | `06` |
| Check-out (dashboard) | `POST /api/attendance/check-out` **200** then **400** duplicate | `59` |
| Leave submit (UI, AL) | `POST /api/leave/requests` **400** `NO_LEAVE_BALANCE` | `64` |
| Leave submit (API probe EL) | **200** PENDING then `PATCH .../withdraw` **200** WITHDRAWN | (API only — cleaned up) |
| Notifications mark all read | `PATCH /api/notifications/read-all` **200** | notifications follow-up |

---

## Admin menu probe matrix (EMPLOYEE)

| Route | Nav visible? | Result |
|-------|:------------:|--------|
| `/reports` | Yes | Access restricted — `48` |
| `/analytics` | Yes | Access restricted — `49` |
| `/permissions` | Yes | Access restricted — `50` |
| `/settings/company-profile` | Yes (Settings) | Access restricted — `51` |
| `/settings/pay/components` | via Settings | Access restricted — `52` |
| `/settings/audit-log` | via Settings | Access restricted — `53` |
| `/recruitment` | Yes | Access restricted — `54` |
| `/employees/new` | No direct | Access restricted — `55` |
| `/payroll` / `/payroll/global` | Yes | Redirect → My Pay (OK) — `29`, `56` |
| `/performance` | Yes | Access restricted — `35` |
| `/assets` | Yes | Access restricted — `36` |

**No privilege-escalation data leak observed** on denied routes (RoleGate). Issue is nav hygiene + leave data integrity.

---

## Verdict

Employee happy-path attendance + payroll self-service largely works. **Blockers for day-to-day HRSS:** leave submit broken for default Annual Leave (C1), and unfiltered admin sidebar (C2). Fix BE leave-type/balance seed and FE nav + leave-type defaults before calling EMPLOYEE UX PASS.
