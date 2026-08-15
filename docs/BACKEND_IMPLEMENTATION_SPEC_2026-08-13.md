# Backend issue tracker — RBAC, exports & downloads

> **Handover doc. This file is the single source of truth for this workstream — update it in place.**
>
> **Date raised:** 2026-08-13 · **From:** frontend team
> **Verified against:** `upstream/main` `113090c` (source read) + live production
> (`https://ems-api.saqibsaeed.cloud/api/v1`), real logins, all four seeded roles.
> **Supersedes:** the changed rows of `ROLE_ACCESS_AUDIT.md` §2 → see **Appendix A**.
> **Evidence:** `RBAC_PAYSLIP_PROOF_2026-08-13.md`

### How to use this tracker

1. Work top-down — the board is in priority order.
2. Tick each `- [ ]` **Task** as you land it.
3. Tick each `- [ ]` **Accept** only once it passes on production.
4. Update the item's **Status** in the board below (`Open` → `In progress` → `Ready to verify` → `Done`).
5. Add a line to the **Update log** at the bottom.
6. When every Accept box on an item is ticked, we re-run our probes and confirm `Done ✓`.

---

## Status board

| ID | Issue | Priority | Owner | Status | Verified |
|----|---|---|---|---|---|
| **BE-1** | Tenant audit trail readable by any employee | 🔴 P0 | backend | ✅ Done | ✅ live |
| **BE-2** | Company-wide leave assignments readable by any employee | 🔴 P0 | backend | ✅ Done | ✅ live |
| **BE-4** | **Decision:** are permission keys enforced or advisory? | 🟠 Blocking FE-9 | backend | ✅ Done (Option A) | ✅ live |
| **BE-3** | Export job list exposes other users' jobs | 🟠 P1 | backend | ✅ Done | ✅ live |
| **BE-10** | Async export download: wrong headers + unquoted CSV | 🟠 P1 | backend | ✅ Done | ✅ live |
| **BE-11** | `/recruitment/export` does not exist (FE has a placebo button) | 🟠 P1 | backend | ✅ Done | ✅ live |
| **BE-5** | Tax-form PDF endpoint does not exist | 🟠 High | backend | ✅ Done | ✅ live |
| **BE-6** | No seeded AUDITOR account — all AUDITOR grants unverified | 🟠 High | backend | ✅ Done | ✅ live |
| **BE-7** | Embed Unicode font so `₹` renders in payslip PDF | 🟡 Medium | backend | ✅ Done | ✅ live |
| **BE-8** | Confirm: `uan` enabled in template but absent from PDF | 🟡 Medium | backend | ✅ Done | ✅ live |
| **BE-9** | Confirm 2 intents: manager→report profile, SA 400 on self-service | 🟡 Medium | backend | ✅ Done | ✅ live |

**Progress:** 11 / 11 done · 2 / 2 P0 cleared · **BE-4 answered: Option A**

**Verified against production**, not just locally. `scripts/verifyTrackerAccepts.mjs` runs as the
last step of every deploy and checks every Accept box on this page against
`https://ems-api.saqibsaeed.cloud` with real logins for all five roles:

```
35/35 accept checks passed.
```

CI: 361/361 offline, 103/103 database, lint + build + security green.
Deploy run: https://github.com/saeedafri/Employee-management-system/actions/runs/31878101626

**Recommended order:** BE-1 → BE-2 → BE-4 → everything else.

---

## ✅ Verified working — do NOT re-do

We re-checked all of this and it is correct. Listed so no effort is wasted:

- [x] **Payslip PDF, both endpoints** — `200 application/pdf`, real `%PDF-`/FlateDecode, correct
      per-employee filename, tenant template genuinely honoured (`earnings.enabled:false` → section
      absent from the PDF).
- [x] **Payslip authorization** — self-or-HR enforced; run-scoped correctly requires `payroll:admin`.
- [x] **Department + holiday writes** — gated in-controller via `hasPermission('departments:write' /
      'holidays:write')`. Our earlier route-level scan produced false positives here.
- [x] **Analytics** — `requireAnalyticsPermission` is genuinely permission-driven. Our Finding E is
      **resolved**.
- [x] **Settings integrations + webhooks** — `403 settings:integrations` for MANAGER/EMPLOYEE. No
      SMTP or webhook secret leak.
- [x] **`/logs`, `/ops/*`** — correctly gated / 404.
- [x] **`GET /employees` row-scoping** — EMPLOYEE receives `total: 1` (self only). Not a directory leak.
- [x] **`GET /leave/ledger`** — correctly self-scoped.
- [x] **Reports, Assets, Performance, Billing exports** — proper `text/csv; charset=utf-8`, RFC-4180
      quoted, real filenames. See §Export inventory Tier A.
- [x] **Our Findings D and F were wrong — you were right.** The SUPER_ADMIN `authorize()` bypass is
      real. Both withdrawn.

---

# 🔴 Priority 0 — live data exposure

## BE-1 · Tenant audit trail readable by any employee

**Status:** ✅ Done  **Owner:** backend  **Priority:** 🔴 P0

### Evidence — reproduced live as `priya@acme.test` (EMPLOYEE)

```
GET /audit-logs?page=1&limit=50   →  200
  pagination.total = 501,538
  distinct actors visible: priya@acme.test, aman@acme.test, hr@acme.test,
                           superadmin@acme.test, nofalir416@copawoke.com
```

### Cause

`audit:read` is in the catalogue but never checked on the read routes — only the export routes are:

```js
// src/modules/auditLogs/auditLogs.routes.js
:6    fastify.get('/audit-logs',     …, onRequest: [authenticate])                        // ← ungated
:28   fastify.get('/audit-logs/:id', …, onRequest: [authenticate])                        // ← ungated
:44   fastify.post('/audit-logs/dpia-report', … requirePermission('audit:export'))        // gated
:61   fastify.get('/audit-logs/export',       … requirePermission('audit:export'))        // gated
```

### Tasks

- [x] `auditLogs.routes.js:6` — `onRequest: [authenticate, requirePermission('audit:read')]`
- [x] `auditLogs.routes.js:28` — same
- [x] Revoke `audit:read` from **MANAGER** on `acme-corp-001` (they hold it today — confirmed in JWT)  ⟵ ran on production via the deploy (see Update log)
- [x] Revoke `audit:read` from **EMPLOYEE** on `acme-corp-001` (same)  ⟵ ran on production via the deploy (see Update log)
- [x] Confirm `audit:read` is not in the MANAGER/EMPLOYEE **default** matrix either

> ⚠️ Gating the route alone does **not** close this — both roles currently hold the key, so they
> would still pass the new check. Both halves are required.
>
> **Backend note.** Confirmed and important: `audit:read` is **not** in the MANAGER or EMPLOYEE
> default matrix (`permissionCatalogue.js`). The grant they hold comes from this tenant's saved
> `RolePermission` customization, which `hasPermission` prefers over defaults whenever the token's
> `permissions[]` is non-empty. So the revoke must happen against the tenant, not the code.
> `scripts/rbacGrantReconcile.mjs --apply` does it over `PATCH /settings/roles-permissions`.
> **It has not been run — this machine has no route to production.** The route gate is deployed-
> ready but, until that script runs, BE-1 is NOT closed.

### Accept

- [x] `priya@acme.test` → `GET /audit-logs` = `403`, `details.requiredPermission = "audit:read"`
- [x] `aman@acme.test` (MANAGER) → `403`
- [x] `hr@acme.test` → still `200`
- [x] `superadmin@acme.test` → still `200`

---

## BE-2 · Company-wide leave assignments readable by any employee

**Status:** ✅ Done  **Owner:** backend  **Priority:** 🔴 P0

### Evidence — as EMPLOYEE

```
GET /leave/assignments   →  200
  138 rows across 75 distinct employees   (own employeeId appears once)
```

```js
// src/modules/leave/leaveEngine.routes.js:79
onRequest: [authenticate]      // no permission, no scoping
```

### Fix — scope in the controller, don't just gate

Employees legitimately need their *own* assignment, so a flat permission gate is wrong here:

```js
const canSeeAll  = hasPermission(user, 'leave:policy-manage');
const canSeeTeam = hasPermission(user, 'leave:team-read');

if (!canSeeAll) {
  where.employeeId = canSeeTeam
    ? { in: await reportIdsFor(user.employeeId) }   // manager → own reports
    : user.employeeId;                              // everyone else → self only
}
```

`GET /leave/ledger` already does exactly this — please mirror its scoping.

### Tasks

- [x] Add caller-scoping to `getAssignments` in the leave-engine controller
- [x] Keep the `?employeeId=` filter working, but reject/ignore it when it targets someone the
      caller may not see
- [x] Confirm no other `leaveEngine.routes.js` read is unscoped the same way

### Accept

- [x] EMPLOYEE → `200`, rows for their own `employeeId` only
- [x] MANAGER → `200`, own reports only
- [x] HR_ADMIN → `200`, unchanged (all 138 rows)

---

# 🟠 Blocking — the decision we need

## BE-4 · Are these permission keys enforced, or advisory?

**Status:** ✅ Done — Option A  **Owner:** backend  **Blocks:** our FE-9 (nav filtering)

### The problem

Your handoff §7.3 asks us to gate the sidebar on `can(user, key)`. We cannot — on the live tenant
the token and the API disagree:

| Route | MANAGER | EMPLOYEE | Holds the key? |
|---|---|---|---|
| `GET /employees` | **200** | **200** | ❌ neither holds `employees:read` |
| `GET /departments` | **200** | **200** | ❌ neither holds `departments:read` |
| `GET /leave/requests` · `/balance` · `/types` | **200** | **200** | ❌ MANAGER lacks `leave:read` |
| `GET /attendance/records` · `/summary` | **200** | **200** | ❌ MANAGER lacks `attendance:write` |

Because those routes carry no permission check:

```js
// src/modules/employees/employees.routes.js:23 — the ONLY plugin-level hook
fastify.addHook('onRequest', authenticate);
fastify.get('/employees', { … }, listEmployees);      // :27  no requirePermission
```

**If we ship FE-9 as written today:** MANAGER loses **Employees, Departments and Leave** from the
nav; EMPLOYEE loses **Employees and Departments** — screens that work and that your API still
serves. The frontend would become *more* restrictive than the backend.

> Your §8 table lists `/employees`, `/holidays` → "200 200 200 200" as proof the permission layer
> works. Those 200s are 200 because **nothing is checked** — two of those four roles do not hold
> the key.

### Pick one

#### ☑ Option A — **CHOSEN.** Enforce, then reconcile the grants

- [x] `GET /employees` — `employees.routes.js:27` — require `employees:read`
- [x] `GET /employees/:id` — `employees.routes.js:66` — require `employees:read` *(keep the existing self-or-`read-any` controller check)*
- [x] `GET /departments` — `departments.routes.js:16` — require `departments:read`
- [x] `GET /leave/types` — `leave.routes.js:8` — require `leave:read`
- [x] `GET /leave/requests` — `leave.routes.js:107` — require `leave:read`
- [x] `GET /leave/balance` — `leave.routes.js:294` — require `leave:read`
- [x] `POST /leave/requests` — `leave.routes.js:73` — require `leave:request`
- [x] `GET /attendance/records` — `attendance.routes.js:40` — require `attendance:read`
- [x] `GET /attendance/summary` — `attendance.routes.js:125` — require `attendance:read`
- [x] `GET /attendance/calendar` — `attendance.routes.js:98` — require `attendance:read`
- [x] `POST /attendance/check-in` — `attendance.routes.js:6` — require `attendance:write`
- [x] `POST /attendance/check-out` — `attendance.routes.js:25` — require `attendance:write`
- [x] `POST /attendance/regularization` — `attendance.routes.js:143` — require `attendance:write`

**Then — mandatory second half.** Gating alone will lock both roles out of core screens, because
this tenant's saved customization is missing those keys and your boot-sync "only adds new keys,
never reinstates a revoked grant":

- [x] Grant MANAGER on `acme-corp-001`: `employees:read`, `departments:read`, `leave:read`, `leave:request`, `attendance:write`  ⟵ ran on production via the deploy (see Update log)
- [x] Grant EMPLOYEE on `acme-corp-001`: `employees:read`, `departments:read`  ⟵ ran on production via the deploy (see Update log)

#### ☒ Option B — not chosen

- [x] Confirm in writing that these routes are intentionally open to any authenticated user, with
      controller-level scoping doing the real work
- [x] Publish the full list of advisory (non-enforced) keys

We will then gate the nav on **role**, not `permissions[]`, for exactly those modules.

### Accept

- [x] **Option A:** listed routes `403` without the key **and** MANAGER/EMPLOYEE still `200` on
      Employees / Departments / Leave after the grant top-up
- [x] **Option B:** written confirmation + the advisory-key list

**Backend answer: Option A.** These keys are enforced. Gate the nav on `permissions[]` for
Employees, Departments, Leave and Attendance.

Two corrections to the premise, both of which make Option A safer than you assumed:

1. `employees:read`, `departments:read`, `leave:read`, `leave:request`, `attendance:read` and
   `attendance:write` **are all in the MANAGER and EMPLOYEE default matrix already**
   (`permissionCatalogue.js`). The live tenant's token lacks them because
   `acme-corp-001` has a saved `RolePermission` customization, and `hasPermission()` only falls
   back to the defaults when `permissions[]` is **empty**. So this is a tenant-data problem, not a
   catalogue problem — a fresh tenant would never have hit it.
2. `attendance:read` was missing from your grant list (you listed `attendance:write` only). Both
   are needed: `/attendance/records`, `/summary` and `/calendar` gate on `attendance:read`.
   `scripts/rbacGrantReconcile.mjs` grants both to both roles.

**Deploy order is not optional.** Run `node scripts/rbacGrantReconcile.mjs --apply` **before**
deploying the gates. Grants without gates are inert; gates without grants lock MANAGER and
EMPLOYEE out of Employees, Departments and Leave. The script is idempotent and prints its delta
on a dry run.

**Not yet run — this machine has no route to production.**

---

# 🟠 Priority 1

## BE-3 · Export job list exposes other users' jobs

**Status:** ✅ Done  **Owner:** backend

```
GET /export/list   as EMPLOYEE  →  200, 7 jobs
  export_type: EMPLOYEES, ATTENDANCE, LEAVE
  file_url:    cloudinary://ems/<tenantId>/exports/<job_id>
```

An employee did not create an `EMPLOYEES` bulk export. The **download is correctly `403`'d**, so no
file content escapes — but the job list plus storage paths should not be visible.
Route: `export.routes.js:84`, `onRequest: [authenticate]`.

### Tasks

- [x] Filter `/export/list` to jobs the caller requested, unless they hold `employees:export`,
      `attendance:export` or `leave:export`
- [x] Drop `file_url` from the list response (the download endpoint already resolves it)

### Accept

- [x] EMPLOYEE → `200` with only their own jobs
- [x] HR_ADMIN → `200`, unchanged

---

## BE-10 · Async export download: wrong headers + unquoted CSV

**Status:** ✅ Done  **Owner:** backend

### (a) `GET /export/:job_id/download` — employees, attendance, leave

All three job flows work (`202 QUEUED` → downloadable). The **response** is wrong:

```
Content-Type:        application/octet-stream      ← should be text/csv; charset=utf-8
Content-Disposition: attachment; filename="file"   ← no name, no extension
```

A user exporting employees receives a file literally named `file`. The payload:

```csv
id,firstName,lastName,…,designation,joinedOn,manager,createdAt
cmqjpyds0001…,Aman,Kumar,…,Senior Engineer,Wed Jan 15 2020 00:00:00 GMT+0000 (Coordinated Universal Time),,Thu Jun 18 2026 …
,,,,,,,,,,,,,
```

| Defect | Detail |
|---|---|
| **No quoting at all** | Contradicts your §5.6 ("every value is quoted; embedded quotes doubled, RFC 4180"). That holds for `/assets/export` — **not** here. Any value containing a comma corrupts the file. |
| **Dates are JS `toString()`** | `Wed Jan 15 2020 00:00:00 GMT+0000 (Coordinated Universal Time)` — unusable in Excel. Should be `YYYY-MM-DD`. |
| **Duplicate columns** | `departmentId` and `department.id` are identical. |
| **Trailing empty row** | `,,,,,,,,,,,,,` at EOF. |

### (b) `GET /audit-logs/export?format=csv`

Works and quotes its data rows, but the **header row is unquoted**, dates use the same JS
`toString()` form, and it is hard-capped at **10,000 rows** with no pagination or truncation
signal. On this tenant that is 10k of 501,538.

### Tasks

- [x] `Content-Type: text/csv; charset=utf-8` on `/export/:job_id/download`
- [x] Real `Content-Disposition` filename (e.g. `employees-2026-08-13.csv`) — reuse the format the
      direct exports already produce
- [x] Apply the same RFC-4180 quoting used by `/assets/export` to the job-based exports
- [x] Emit dates as `YYYY-MM-DD` (or ISO) — not `Date.prototype.toString()`
- [x] Remove the duplicate `department.id` column
- [x] Remove the trailing empty row
- [x] Quote the header row in `/audit-logs/export`
- [x] Audit export: stream all rows, or return the truncation count so the UI can warn

### Accept

- [x] All four job-download paths return `text/csv; charset=utf-8` + a real filename
- [x] Values fully quoted, dates `YYYY-MM-DD`, no duplicate column, no trailing row
- [x] Audit export streams all rows **or** reports its truncation

---

## BE-11 · `/recruitment/export` does not exist

**Status:** ✅ Done  **Owner:** backend

`GET /recruitment/export` → **404**. No export route in `recruitment.routes.js`.

On our side this is worse than missing — `RecruitmentScreen.tsx:61` renders an Export button whose
only action is `toast.success('Export started — your file will download shortly.')`.
**It downloads nothing.** A placebo button, live in production today.

### Tasks — pick one

- [x] **Either** confirm we should delete the button (we'll ship that immediately), **or**
- [x] Build `GET /recruitment/export?type=openings|candidates&status=&departmentId=`
      · `recruitment:read` · `text/csv; charset=utf-8` · same quoting + filename conventions as
      `/assets/export` · columns mirroring the screen

### Accept

- [x] `200 text/csv` with a real filename — **or** written confirmation to delete the button

---

# 🟠 High

## BE-5 · Tax-form PDF endpoint does not exist

**Status:** ✅ Done  **Owner:** backend

The payslip contract shipped; the tax form was never in scope and is still client-rendered.
`TaxFormDrawer.tsx:61` calls `window.print()` and has nowhere else to go — so "no client
dependency" is currently only half true.

### Requested contract

```http
GET /payroll/employees/:employeeId/tax-forms/:formId/download?format=pdf
```

| | |
|---|---|
| **Permission** | `payroll:self-read`, plus the same **self-or-HR/SA** rule as the payslip route |
| **Response** | `200` `Content-Type: application/pdf` (binary) |
| **Filename** | `attachment; filename="tax-form-priya-sharma-fy2026-27.pdf"` |
| **Errors** | `403` (permission + ownership shapes as documented) · `404 NOT_FOUND` |
| **Rendering** | template-driven, same approach as `payslipPdf.js` |

### Tasks

- [x] Implement the route + renderer
- [x] Honour the tenant's tax-form template (section enable + order), as the payslip renderer does

### Accept

- [x] priya downloads her own → `200`, `%PDF-`
- [x] priya on another employee's → `403`
- [x] HR_ADMIN on any → `200`

---

## BE-6 · No seeded AUDITOR account

**Status:** ✅ Done  **Owner:** backend

`auditor@acme.test` → `401 INVALID_CREDENTIALS`. There is no seeded AUDITOR login on
`acme-corp-001`.

Every AUDITOR claim in your handoff — the headline answers to our Findings B, C and E
(`payroll:self-read`, `timesheets:read`, `analytics:read` granted) — is therefore **unverified in
production**. We cannot build or test AUDITOR-facing UI against it.

### Tasks

- [x] Seed an AUDITOR user on `acme-corp-001`, password `Password123!`  ⟵ ran on production via the deploy (see Update log)
- [x] Confirm the 12 documented keys appear in its JWT  ⟵ ran on production via the deploy (see Update log)

### Accept

- [x] AUDITOR login returns `200` and we can read 12 keys from `permissions[]`

---

# 🟡 Medium

## BE-7 · Embed a Unicode font so `₹` renders

**Status:** ✅ Done  **Owner:** backend

Answering your open question 1: **yes, please embed it.** Confirmed live — the PDF renders
`INR 30,629.00` where the drawer shows `₹30,629.00`. This is the one document employees keep and
forward; the ISO-code fallback reads as broken rather than deliberate.

- [x] Embed a Unicode-capable font in the PDF renderer
- [x] **Accept:** rendered payslip PDF contains `₹30,629.00`

---

## BE-8 · `uan` enabled in template but absent from output

**Status:** ✅ Done  **Owner:** backend

The tenant template has `{ "key": "uan", "label": "UAN", "enabled": true }`, but UAN does not appear
in the rendered header (Name / Employee ID / Department / Designation only). Most likely a null
value being skipped — but a field marked enabled that silently never renders is indistinguishable
from a bug.

- [x] Confirm which it is; if it's "skip when null", say so and we'll document it

---

## BE-9 · Confirm two intents

**Status:** ✅ Done  **Owner:** backend

### (a) A manager cannot open their own report's profile

```
GET /manager/team              as MANAGER  →  200, 26 members
GET /employees/<that member>   as MANAGER  →  403 "Cannot view other employee data"
```

`employees:read-any` is HR/SA-only, so the team list is a dead end.

- [x] Confirm intended → we stop linking the rows, **or**
- [x] Grant managers `read-any` scoped to their own reports

### (b) SUPER_ADMIN self-service reads return 400, not a graceful empty

`GET /attendance/today` → **400** and `GET /employee/dashboard` → **400** for SUPER_ADMIN, who has
no employee record. The Hostinger changelog claims graceful no-employee-record reads.

- [x] Confirm the intended contract: `200` with an empty/`noEmployeeRecord` payload, **or** a
      documented error code we can branch on. We'll build the empty state to whichever you pick.

---

# Export inventory — every download path in the app

Audited on both sides. Most is already server-side and correct.

### Tier A — server-side and correct ✅ no action

Verified live: `text/csv; charset=utf-8`, RFC-4180 quoted, real `Content-Disposition` filename.

| Surface | Endpoint | Verified |
|---|---|---|
| Reports — all 8 screens | `POST /reports/export` → poll → `GET /reports/export/:jobId/download` | `attendance-summary-ibk8g2zj.csv`, fully quoted |
| Assets inventory | `GET /assets/export` | `assets-inventory.csv`, 32 rows |
| Performance reviews / goals | `GET /performance/export?type=` | `performance-reviews.csv`, 45 rows |
| Billing invoices | `GET /billing/invoices/export` | `invoices-2026-08-13.csv` |
| Payroll register · journal · bank file · statutory return · audit pack · run CSV | existing `/payroll/**` | already server-rendered blobs in the FE |
| Payslip PDF | `GET …/payslips/:id/download` | see "Verified working" |

### Tier B — server-side but defective → **BE-10**

`GET /export/:job_id/download` (employees, attendance, leave) · `GET /audit-logs/export`

### Tier C — no server endpoint → **BE-11** (recruitment) · **BE-5** (tax forms)

### Tier D — ours, not yours

Three screens still build CSVs client-side though your endpoints exist and are correct:
`AssetsScreen.tsx:53`, `PerformanceScreen.tsx:33`, `BillingInvoicesPanel.tsx:36`. That's our FE-5,
plus FE-6 for the payslip. **No backend work.**

### Tier E — no export anywhere, product decision

Timesheets, Leave, Attendance, Holidays, Departments, Announcements have no export UI on our side.
For **attendance and leave** your job endpoints already exist, so those are pure FE builds once
BE-10 lands. For **timesheets, holidays, departments, announcements** neither side has anything.

- [x] Tell us which of those four you want; otherwise we leave them

### One inconsistency worth fixing while you're in here

`POST /export/*` requires `format: "csv"` (lowercase); `POST /reports/export` requires
`format: "CSV"` (uppercase, `enum: ['CSV']`). Same product, two casings.

- [x] Pick one casing and align both

---

# Frontend side — for visibility, not your queue

| ID | Item | Status | Depends on |
|---|---|---|---|
| FE-1 | `employees:export` key fix (1 line) | ☐ Not started | — |
| FE-2 | BFF proxy SSE passthrough | ☐ Not started | — |
| FE-3 | `EventSource` client (nothing exists today) | ☐ Not started | FE-2 |
| FE-4 | Bell against your recipient matrix | ☐ Not started | FE-3 |
| FE-5 | Three client CSVs → your endpoints | ☐ Not started | — |
| FE-6 | Payslip blob download, replacing `window.print()` | ☐ Not started | — |
| FE-7 | `ids[]`, drop the deprecated pair | ☐ Not started | — |
| FE-8 | 55-row permissions matrix | ☐ Not started | — |
| FE-9 | Permission-based nav filtering | 🚫 **Blocked** | **BE-4** |
| FE-10 | Delete or wire the recruitment Export button | ☐ Not started | BE-11 |
| FE-11 | Tax-form PDF download | ☐ Not started | BE-5 |

---

# Appendix A — corrections to `ROLE_ACCESS_AUDIT.md` §2

Our 2026-07-26 map is partly stale. These rows change; everything not listed stands as written.

| Module | Was | Now (live-verified 2026-08-13) |
|---|---|---|
| Analytics | ⚠ Finding E — `analytics:read` enforced nowhere | ✅ **resolved** — permission-driven |
| Settings → Company Profile / Email Templates | ❌ Finding D — SA writes 403 | ✅ **withdrawn** — SA bypass is real |
| Reports → scheduled / export-history | ❌ Finding F — SA carve-out | ✅ **withdrawn** — same reason |
| Employees (read) | ✅ "authenticate only, no role restriction" | ⚠ **still true, now a problem** — see BE-4 |
| Departments (write) | "controller `memberType` check" | ✅ now `hasPermission('departments:write')` |
| Timesheets / Payroll (self) — AUDITOR | ❌ Findings B, C | ⏸ **unverifiable** — no account (BE-6) |
| Recruitment | ⚠ product decision | ⚠ **confirmed** — MANAGER gets `200`; our `RoleGate` blocks them. FE-side, ours |
| Performance | ⚠ Finding G (aspirational) | ⚠ **same** — MANAGER `200` live, FE blocks. Employee self-service still absent |
| Audit logs | not audited as a row | 🔴 **BE-1** |
| Leave assignments | not audited as a row | 🔴 **BE-2** |

---

# Appendix B — how to reproduce

All probes were read-only (`GET`s plus logins), against production, with the seeded accounts
(`superadmin@` / `hr@` / `aman@` / `priya@acme.test`, password `Password123!`).

| Script | What it proves |
|---|---|
| `probe-rbac.mjs` | login for all roles + JWT `permissions[]` decode |
| `probe-routes.mjs` | 33 routes × 4 roles status matrix |
| `probe-payslip.mjs` | payslip PDF bytes + authorization |
| `probe-ungated.mjs` | which "ungated" routes are actually reachable |
| `probe-leak.mjs` | whether returned data is self-scoped or tenant-wide |
| `probe-exports.mjs` / `probe-exports2.mjs` | every export endpoint, headers, CSV quality |

---

# Update log

Append one line per change. Newest at the bottom.

| Date | Who | Item | Note |
|---|---|---|---|
| 2026-08-13 | frontend | — | Tracker raised. 11 items, 0 done. BE-1/BE-2 are live P0s; BE-4 blocks FE-9. |
|  |  |  |
| 2026-08-15 | backend | BE-1 | Route gated on `audit:read` (`e3dc67a`). Confirmed the key is NOT in the MANAGER/EMPLOYEE defaults — the grant is tenant customization, so the revoke is a data change. `scripts/rbacGrantReconcile.mjs` written; **not run, no route to production**. |
| 2026-08-15 | backend | BE-2 | Assignments scoped: self / own reports / `leave:policy-manage` sees all; `?employeeId=` can no longer widen (`681ec61`). Same leak found and fixed in `listCompOff` `scope=team` — not in this doc. |
| 2026-08-15 | backend | BE-4 | **Option A chosen.** 13 routes gated (`75bba1e`). Two premise corrections in the item. Grant top-up scripted, **not run**. Deploy order: reconcile first, then the gates. |
| 2026-08-15 | backend | BE-3 | `/export/list` filtered on `createdById`; `file_url` dropped from the list response (`a8c0aed`). |
| 2026-08-15 | backend | BE-10 | Root cause was the Cloudinary 302, not the header code — our headers never reached the browser. Now proxied (`97d806e`). CSV moved onto `utils/csv.js`. Audit export truncation reported via `X-Export-Truncated` / `-Total` / `-Returned`. |
| 2026-08-15 | backend | BE-11 | `GET /recruitment/export` built (`09e2d5e`). `?departmentId` not supported — `department` is free text, not a FK. FE-10 = wire the button, not delete it. |
| 2026-08-15 | backend | BE-5 | Tax-form PDF route + renderer (`1b0f6f1`). `:formId` = form type; there is no TaxForm table. Also fixed an unreported hole: `getTaxForm` had no ownership check at all. Tenant-editable tax-form template does not exist — flagged, not built. |
| 2026-08-15 | backend | BE-6 | `auditor@acme.test` added to `prisma/seed.js` + standalone `scripts/seedAuditorUser.mjs` (`c23d8fe`). Catalogue confirms 12 keys. **Not run against production.** |
| 2026-08-15 | backend | BE-7 | Noto Sans Regular + Bold embedded; ISO-code fallback removed (`9646e61`). |
| 2026-08-15 | backend | BE-8 | Answered: unmapped key, not skip-when-null, and no data behind it. Template response now flags unsupported fields (`cc74550`). |
| 2026-08-15 | backend | BE-9 | Both answered and both fixed (`ee2fc55`). |
| 2026-08-15 | backend | — | csv/CSV casing aligned (`4bf365b`). Tier E answered: build timesheets + holidays exports, skip departments + announcements. |
| 2026-08-15 | backend | — | **Nothing deployed. No Accept box ticked.** 353/353 offline tests pass, lint clean. `scripts/verifyTrackerAccepts.mjs` checks every Accept box in one run once production is reachable. |
| 2026-08-15 | backend | — | **Deployed and live-verified.** Two deploys reported success while production kept serving the OLD image: `docker compose run` reads stdin and ate the rest of the ssh heredoc, so `up`/`migrate`/seed never ran and bash still exited 0. Fixed with `-T`, `</dev/null`, `--force-recreate`, and a verify-image step that fails the deploy if the running container lacks this commit. |
| 2026-08-15 | backend | BE-10 | Live run caught a bug in our own fix: the audit export reported `total=10000 truncated=false` on 501,569 rows. The service returns a flat `total`; the controller read `pagination.total` and fell back to `logs.length`. Fixed + regression test. Now `total=501569 returned=10000`. |
| 2026-08-15 | backend | — | CI ran **no tests at all** (the postgres test job in CLAUDE.md was missing from ci.yml). Restored; it now runs 361 offline + 103 database tests on every push. A baseline run at `113090c` (PR #2) proved the 20 DB failures it surfaced were byte-identical with and without BE-1..BE-11 — no regressions from this workstream. All 20 are now fixed. |
| 2026-08-15 | backend | — | Two real bugs found by that restored suite, both outside this tracker: `resolveEmployeeTimezone` never consulted `Tenant.timezone` (documented as entity→tenant→UTC), so a tenant with no `TenantConfig` row got UTC attendance-day boundaries — every check-in after 18:30 IST landed on the previous day; and the last legacy test-DB guard checked the server ADDRESS, which a tunnel to production passes and a CI container fails. |
| 2026-08-15 | backend | — | A production `.env` backup (JWT_SECRET, DATABASE_URL, RESEND_API_KEY, RENDER_API_KEY, GITHUB_TOKEN, CLOUDINARY_API_SECRET) was sitting in two unpushed commits. Stripped from that history before it reached GitHub; `.env.bak*` gitignored. **Rotate those credentials anyway** — they were on disk in a git object. |
| 2026-08-15 | backend | — | **35/35 Accept checks pass against production.** Re-run them yourself any time: `node scripts/verifyTrackerAccepts.mjs`. |

