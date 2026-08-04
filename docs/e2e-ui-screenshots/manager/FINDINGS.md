# MANAGER Deep UI E2E Findings

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Role | `MANAGER` — `aman@acme.test` / `Password123!` / tenant `acme-corp-001` |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000` (Hostinger DB/Redis tunnel) |
| Tooling | Playwright (Chrome channel) |
| Screenshots | `docs/e2e-ui-screenshots/manager/` — **94** PNGs (`NN-menu-action-result.png`) |
| Raw JSON | `_results.json`, `_followup.json` |

---

## Summary counts

| Metric | Count |
|--------|------:|
| Screenshots | 94 |
| Menus exercised | 17 sidebar items + settings sub-routes + notifications/profile |
| Critical issues | **1** (self-approval UX / timesheet) |
| High issues | **3** |
| Medium issues | **7** |
| Mutations performed | 4 confirmed API mutations (+ 1 blocked self-return) |
| Backend-classified issues | 2 |
| Frontend-classified issues | 9 |

### Working (OK)

| Area | Evidence |
|------|----------|
| Login as MANAGER | `03-login-result-dashboard.png` → `/dashboard` My Team |
| Dashboard team widgets | Team Size 22; Pending Approvals; Team Attendance week grid — `05-dashboard-land.png` |
| Regularization **Deny** | `PATCH 200 /api/attendance/regularization/.../deny` — `64-reg-deny-confirmed-result.png` |
| Regularization **Approve** | `PATCH 200 /api/attendance/regularization/.../approve` — `65-reg-approve-result.png` |
| Timesheet **Approve** (other employee) | `POST 200 /api/timesheets/.../approve` — toast “Arjun Nair's week approved” — `68-timesheet-approve-api-result.png` |
| Leave Approvals tab | Empty state correct (0 leave pending) — `71-leave-approvals-tab.png` |
| Leave Team Calendar / Comp-off tabs | Load — `72`, `73` |
| Payroll **My Pay** (personal payslips) | List + detail drawer — `75`, `94` |
| Reports / Analytics / Permissions deep-link DENY | RoleGate “Access restricted” — `46`–`48` |
| Recruitment / Performance / Assets DENY | `55`–`57` |
| Most settings privileged routes DENY | company-profile, locale, working-hours, pay/components, email-templates |

---

## Critical bugs

### C1. Timesheets Approvals shows Approve/Return on manager’s **own** rows → API 403

| | |
|--|--|
| **Layer** | **FRONTEND** (primary) — BACKEND correctly rejects |
| **Severity** | CRITICAL (broken UX / false failure for managers) |
| **API** | `POST /api/timesheets/{id}/reject` → **403** `SELF_APPROVAL_FORBIDDEN` — `"You cannot approve or reject your own request"` |
| **Also seen** | First sweep: `POST .../approve` **403** on same id `cmr4fpp2m006ggrlntoghkxu0` (Aman Kumar own week) |
| **UI** | Approvals table lists “Aman Kumar” with Approve + Return; Return modal opens; toast shows error |
| **Screenshots** | `30-timesheets-approvals-view.png`, `69-timesheet-return-modal.png`, `70-timesheet-return-result.png` |
| **Expected** | Hide Approve/Return (or grey out) for rows where employeeId === current user; optional filter “own submissions” out of Approvals queue |

---

## High bugs

### H1. Sidebar not role-filtered — MANAGER sees restricted menus

| | |
|--|--|
| **Layer** | **FRONTEND** (`AppShell.tsx` `NAV_ITEMS` — no role filter) |
| **Visible but DENY** | Reports, Analytics, Permissions, Recruitment, Performance, Assets |
| **Screenshots** | `04-sidebar-full.png`, `46-reports-land.png` (explicit: “restricted to HR and Super Admins”) |
| **Note** | Deep-links correctly DENY; nav noise remains known gap vs `UI_CONTRACT_role_nav_no_employee_2026-07-19.md` |

### H2. “Bulk approve” only opens **Leave** modal while Pending Approvals are **regularizations**

| | |
|--|--|
| **Layer** | **FRONTEND** |
| **Repro** | Dashboard shows “Pending Approvals: N — 0 leave, N reg.” → click **Bulk approve** → modal “Bulk Approve Leave Requests” / “No pending leave requests” |
| **Screenshots** | `13-dashboard-approve-deny-visible.png`, `66-bulk-approve-leave-empty-while-reg-pending.png`, `17-dashboard-approve-result.png` |
| **Expected** | Bulk approve regularization queue, or rename/split actions (“Bulk approve leave” vs “Bulk approve regularization”) |

### H3. `/settings/roles-permissions` is a dead 404 for MANAGER (and likely all roles via that path)

| | |
|--|--|
| **Layer** | **FRONTEND** (routing) |
| **Screenshot** | `83-settings-route-settings-roles-permissions.png` — “404 Page not found” |
| **Note** | Not an auth bypass; path is broken/missing. Privileged settings that exist correctly DENY. |

---

## Medium bugs

### M1. Manager dashboard Present Today = 0 / Avg Attendance = 0% / entire week “A”

| | |
|--|--|
| **Layer** | **BACKEND** (data / timezone / weekly aggregation) or seed gap |
| **API** | `GET /api/attendance/team/weekly?weekStart=2026-08-03` returns 200 but UI shows all Absent |
| **Screenshots** | `05-dashboard-land.png`, `74-dashboard-zero-attendance-anomaly.png` |
| **Note** | Check-in worked for Aman (`87-attendance-main.png` shows Checked in) yet team widget still all “A” — inconsistent |

### M2. Timesheet Approvals “PROGRESS” column always empty

| | |
|--|--|
| **Layer** | FRONTEND or BACKEND (missing field) |
| **Screenshot** | `30-timesheets-approvals-view.png`, `68-…` |

### M3–M7. Nav DENY destinations still linked (Reports, Analytics, Permissions, Recruitment, Performance, Assets)

Counted under H1; individual DENY screenshots `46`–`48`, `55`–`57`. Soft medium UX if H1 not fixed.

### M8. Payslip designation shows concatenated date

| | |
|--|--|
| **Layer** | **FRONTEND** (display mapping) |
| **Evidence** | Detail drawer: Designation `Senior Engineer 2026-07-02` — `94-payroll-payslip-detail.png` |

### M9. Employees list sometimes stuck on skeletons (intermittent)

| | |
|--|--|
| **Layer** | UNKNOWN (race) |
| **Screenshot** | `88-employees-main.png` (skeletons); earlier `18-employees-land.png` / `19-employees-detail.png` OK in first sweep |

---

## Auth matrix (MANAGER)

| Menu | Sidebar visible? | Page result | Layer if wrong |
|------|:----------------:|-------------|---------------|
| Dashboard | ✅ | OK (My Team) | — |
| Employees | ✅ | OK (no Add Employee observed) | — |
| Departments | ✅ | OK | — |
| Attendance | ✅ | OK (check-in/out) | — |
| Timesheets | ✅ | OK + C1 self-approve UX | FE |
| Leave | ✅ | OK (Approvals empty) | — |
| Holidays | ✅ | OK | — |
| Payroll | ✅ | OK (My Pay personal) | Nav OK if personal-only |
| Payout methods | ✅ | OK | — |
| Reports | ✅ should hide | DENY | **FE nav** |
| Analytics | ✅ should hide | DENY | **FE nav** |
| Permissions | ✅ should hide | DENY | **FE nav** |
| Settings | ✅ | Landing OK; privileged subroutes DENY; roles-permissions **404** | FE |
| Recruitment | ✅ should hide | DENY | **FE nav** |
| Performance | ✅ should hide | DENY | **FE nav** |
| Assets | ✅ should hide | DENY | **FE nav** |
| Announcements | ✅ | OK | — |

---

## Mutations log (this run)

| Action | Result | API | Screenshot |
|--------|--------|-----|------------|
| Regularization Deny (Mohit Jain / first item) | SUCCESS | `PATCH 200 .../regularization/.../deny` | `64-reg-deny-confirmed-result.png` |
| Regularization Approve | SUCCESS | `PATCH 200 .../regularization/.../approve` | `65-reg-approve-result.png` |
| Timesheet Approve (Arjun Nair) | SUCCESS | `POST 200 .../timesheets/.../approve` | `68-timesheet-approve-api-result.png` |
| Timesheet Return (Aman Kumar self) | BLOCKED | `POST 403 SELF_APPROVAL_FORBIDDEN` | `70-timesheet-return-result.png` |
| Attendance Check-in | Attempted (1st sweep) | no 4xx observed | `23-attendance-check-in-result.png` |

Pending Approvals counter moved **4 → 2** after deny+approve (confirming mutations stuck).

---

## Exports / PDF

| Action | Result |
|--------|--------|
| Dashboard / Leave / Reports exports | Reports DENY — no export UI |
| Attendance Export buttons | Not clearly available as download in sweep (calendar/table UI) |
| Payslip **Download PDF** | Button present in drawer (`94-…`); download not re-verified after flaky re-login — **gap** |
| Employees CSV/Excel export | No export control observed for MANAGER (good) |

---

## Console / network noise

| Event | Notes |
|-------|-------|
| `GET /api/auth/me` 401 + `POST /api/auth/refresh` 401 | Once at session edge (missing cookie before login completes) — not a product bug |
| `POST .../timesheets/.../approve\|reject` 403 | Self-approval — see C1 |

---

## Verdict

| Area | Verdict |
|------|---------|
| Core manager approvals (regularization) | **PASS** |
| Timesheet approve others | **PASS** |
| Timesheet self row actions | **FAIL** (FE) |
| Role nav hygiene | **FAIL** (FE) |
| Bulk approve vs reg queue | **FAIL** (FE) |
| Leave team approvals UI | **PASS** (empty) |
| Reports/Analytics/Permissions enforcement | **PASS** (page DENY) / **FAIL** (nav visibility) |
| Overall MANAGER deep E2E | **PARTIAL PASS** — usable core flows; critical self-approval UX + nav/bulk-approve FE gaps |
