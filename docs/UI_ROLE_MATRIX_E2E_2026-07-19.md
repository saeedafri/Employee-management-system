# UI Role Matrix E2E — 2026-07-19

> **Update after BE deploy `68d32f4`:** Hostinger API now returns **200 + `noEmployeeRecord`** for Super Admin personal reads (proven on VPS). The **FAIL** rows below for SA Attendance/Payout were **pre-fix BE**. FE must still ship empty-state + role-filtered nav — see `UI_TEAM_HANDOFF_HOSTINGER_HARDENING_2026-07-19.md`. Full browser re-crawl from agent host remains blocked (ISP).

**Target:** Deployed frontend (Vercel) → Hostinger API via BFF  
**MSW:** off  
**Password for all seeded Acme users:** `Password123!`  
**Verdict (pre-fix UI crawl):** **PARTIAL PASS** — all four seeded role types logged in and click-tested; access control mostly correct; SUPER_ADMIN had two broken personal-data pages (BE fixed); sidebar still shows admin links to every role (FE).

No AUDITOR seed user exists — not tested.

---

## Accounts tested

| Role | Email | Login | Dashboard identity |
|------|-------|-------|--------------------|
| SUPER_ADMIN | `superadmin@acme.test` | OK | Welcome / Super Admin |
| HR_ADMIN | `hr@acme.test` | OK | Welcome back, HR (HA) |
| MANAGER | `aman@acme.test` | OK | My Team (AK) — team size 22 |
| EMPLOYEE | `priya@acme.test` | OK | Hi, Priya — Senior Engineer |

---

## Page matrix (live UI)

Legend: **OK** = page loads without error banners · **DENY** = Access restricted (expected for lower roles) · **FAIL** = Something went wrong / Failed to load

| Page | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|------|-------------|----------|---------|----------|
| `/dashboard` | OK | OK (76 employees, 7 approvals) | OK (My Team, 4 reg approvals) | OK (leave balances, docs, team) |
| `/employees` | OK (+ Add, Export) | OK | OK (no Add) | OK (no Add, no Export) |
| `/departments` | OK | — | — | — |
| `/attendance` | **FAIL** summary + records | **OK** (calendar + stats) | **OK** | **OK** |
| `/timesheets` | OK | — | — | — |
| `/leave` | OK | OK | OK | OK |
| `/holidays` | OK | — | — | — |
| `/payroll` | OK | — | — | OK → `/payroll/my-payslips` |
| `/payout-methods` | **FAIL** load | **OK** | — | — |
| `/reports` | OK | OK | **DENY** | **DENY** |
| `/analytics` | OK | OK | **DENY** | **DENY** |
| `/permissions` | OK | **DENY** (Super Admin only) | **DENY** | **DENY** |
| `/settings` | OK → company-profile | — | OK → sessions | — |
| `/recruitment` | OK | — | — | — |
| `/performance` | OK | — | — | — |
| `/assets` | OK | — | — | — |
| `/announcements` | OK | — | — | — |
| Notifications bell | — | — | — | OK (opens; stale “Bulk N” items) |

`—` = not re-probed for that role in this pass (sidebar present; lower-risk after SA/HR coverage).

---

## Screenshot evidence (local Cursor screenshots dir)

| File | What |
|------|------|
| `role-SA-01-dashboard.png` | SUPER_ADMIN dashboard |
| `role-SA-02-employees.png` | SUPER_ADMIN employees directory |
| `role-SA-03-attendance-FAIL.png` | SUPER_ADMIN attendance load failure |
| `role-SA-04-payout-FAIL.png` | SUPER_ADMIN payout methods failure |
| `role-HR-01-dashboard.png` | HR dashboard live metrics |
| `role-HR-02-attendance-OK.png` | HR attendance working |
| `role-HR-03-permissions-DENIED.png` | HR blocked from permissions |
| `role-MGR-01-dashboard.png` | Manager My Team + approvals |
| `role-MGR-02-analytics-DENIED.png` | Manager blocked from analytics |
| `role-EMP-01-dashboard.png` | Employee personal dashboard |
| `role-EMP-02-notifications.png` | Employee notification panel |

---

## Critical findings

1. **SUPER_ADMIN attendance + payout broken** — same pages work for HR (and attendance for Manager/Employee). Strong signal: Super Admin user has no linked Employee record, so personal-scoped APIs fail while admin directory pages still work.
2. **RBAC gates work** — Permissions = Super Admin only; Analytics/Reports = HR/Super Admin; Manager/Employee get Access restricted with clear copy.
3. **Sidebar not role-filtered** — every role sees Permissions, Analytics, Reports, Settings, Payroll, etc. Lower roles hit DENY pages instead of hidden nav (UX issue, not a data leak of those pages’ contents).
4. **Employee isolation looks correct on UI** — personal leave balances, documents, My Pay redirect, no Add/Export on employees.
5. **Manager isolation** — team dashboard (22), team regularization approvals, no Add employee, analytics/reports denied.
6. **Notifications** — panel opens for employee; content is stale bulk seed noise; deployed FE still poll-based (SSE wiring not live on Vercel).
7. **Not covered here** — AUDITOR role (no seed), second manager `riya@acme.test`, mutate actions (approve leave / check-in), new hardening (PDF export, `/ops/logs`, SSE) because those are not on the deployed stack yet.

---

## Final verdict

**PARTIAL PASS** for multi-role UI E2E on the deployed stack.

- Logins: 4/4 role types OK  
- Access control: OK for Permissions / Analytics / Reports  
- Data pages: mostly OK for HR / Manager / Employee  
- Blockers to full PASS: SUPER_ADMIN attendance + payout FAIL; sidebar not role-scoped; hardening features not deployed; no AUDITOR seed  

Do **not** treat this as PASS for the Hostinger hardening plan until those two Super Admin failures are fixed and new BE/FE changes are deployed and re-tested.
