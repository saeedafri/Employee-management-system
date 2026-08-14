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
| **BE-1** | Tenant audit trail readable by any employee | 🔴 P0 | backend | ☐ Open | ☐ |
| **BE-2** | Company-wide leave assignments readable by any employee | 🔴 P0 | backend | ☐ Open | ☐ |
| **BE-4** | **Decision:** are permission keys enforced or advisory? | 🟠 Blocking FE-9 | backend | ☐ Open | ☐ |
| **BE-3** | Export job list exposes other users' jobs | 🟠 P1 | backend | ☐ Open | ☐ |
| **BE-10** | Async export download: wrong headers + unquoted CSV | 🟠 P1 | backend | ☐ Open | ☐ |
| **BE-11** | `/recruitment/export` does not exist (FE has a placebo button) | 🟠 P1 | backend | ☐ Open | ☐ |
| **BE-5** | Tax-form PDF endpoint does not exist | 🟠 High | backend | ☐ Open | ☐ |
| **BE-6** | No seeded AUDITOR account — all AUDITOR grants unverified | 🟠 High | backend | ☐ Open | ☐ |
| **BE-7** | Embed Unicode font so `₹` renders in payslip PDF | 🟡 Medium | backend | ☐ Open | ☐ |
| **BE-8** | Confirm: `uan` enabled in template but absent from PDF | 🟡 Medium | backend | ☐ Open | ☐ |
| **BE-9** | Confirm 2 intents: manager→report profile, SA 400 on self-service | 🟡 Medium | backend | ☐ Open | ☐ |

**Progress:** 0 / 11 done · 0 / 2 P0 cleared · BE-4 unanswered (frontend blocked)

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

**Status:** ☐ Open  **Owner:** backend  **Priority:** 🔴 P0

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

- [ ] `auditLogs.routes.js:6` — `onRequest: [authenticate, requirePermission('audit:read')]`
- [ ] `auditLogs.routes.js:28` — same
- [ ] Revoke `audit:read` from **MANAGER** on `acme-corp-001` (they hold it today — confirmed in JWT)
- [ ] Revoke `audit:read` from **EMPLOYEE** on `acme-corp-001` (same)
- [ ] Confirm `audit:read` is not in the MANAGER/EMPLOYEE **default** matrix either

> ⚠️ Gating the route alone does **not** close this — both roles currently hold the key, so they
> would still pass the new check. Both halves are required.

### Accept

- [ ] `priya@acme.test` → `GET /audit-logs` = `403`, `details.requiredPermission = "audit:read"`
- [ ] `aman@acme.test` (MANAGER) → `403`
- [ ] `hr@acme.test` → still `200`
- [ ] `superadmin@acme.test` → still `200`

---

## BE-2 · Company-wide leave assignments readable by any employee

**Status:** ☐ Open  **Owner:** backend  **Priority:** 🔴 P0

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

- [ ] Add caller-scoping to `getAssignments` in the leave-engine controller
- [ ] Keep the `?employeeId=` filter working, but reject/ignore it when it targets someone the
      caller may not see
- [ ] Confirm no other `leaveEngine.routes.js` read is unscoped the same way

### Accept

- [ ] EMPLOYEE → `200`, rows for their own `employeeId` only
- [ ] MANAGER → `200`, own reports only
- [ ] HR_ADMIN → `200`, unchanged (all 138 rows)

---

# 🟠 Blocking — the decision we need

## BE-4 · Are these permission keys enforced, or advisory?

**Status:** ☐ Open  **Owner:** backend  **Blocks:** our FE-9 (nav filtering)

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

#### ☐ Option A — enforce, then reconcile the grants *(our preference)*

- [ ] `GET /employees` — `employees.routes.js:27` — require `employees:read`
- [ ] `GET /employees/:id` — `employees.routes.js:66` — require `employees:read` *(keep the existing self-or-`read-any` controller check)*
- [ ] `GET /departments` — `departments.routes.js:16` — require `departments:read`
- [ ] `GET /leave/types` — `leave.routes.js:8` — require `leave:read`
- [ ] `GET /leave/requests` — `leave.routes.js:107` — require `leave:read`
- [ ] `GET /leave/balance` — `leave.routes.js:294` — require `leave:read`
- [ ] `POST /leave/requests` — `leave.routes.js:73` — require `leave:request`
- [ ] `GET /attendance/records` — `attendance.routes.js:40` — require `attendance:read`
- [ ] `GET /attendance/summary` — `attendance.routes.js:125` — require `attendance:read`
- [ ] `GET /attendance/calendar` — `attendance.routes.js:98` — require `attendance:read`
- [ ] `POST /attendance/check-in` — `attendance.routes.js:6` — require `attendance:write`
- [ ] `POST /attendance/check-out` — `attendance.routes.js:25` — require `attendance:write`
- [ ] `POST /attendance/regularization` — `attendance.routes.js:143` — require `attendance:write`

**Then — mandatory second half.** Gating alone will lock both roles out of core screens, because
this tenant's saved customization is missing those keys and your boot-sync "only adds new keys,
never reinstates a revoked grant":

- [ ] Grant MANAGER on `acme-corp-001`: `employees:read`, `departments:read`, `leave:read`, `leave:request`, `attendance:write`
- [ ] Grant EMPLOYEE on `acme-corp-001`: `employees:read`, `departments:read`

#### ☐ Option B — declare them advisory

- [ ] Confirm in writing that these routes are intentionally open to any authenticated user, with
      controller-level scoping doing the real work
- [ ] Publish the full list of advisory (non-enforced) keys

We will then gate the nav on **role**, not `permissions[]`, for exactly those modules.

### Accept

- [ ] **Option A:** listed routes `403` without the key **and** MANAGER/EMPLOYEE still `200` on
      Employees / Departments / Leave after the grant top-up
- [ ] **Option B:** written confirmation + the advisory-key list

**Either answer unblocks us. No answer keeps FE-9 frozen.**

---

# 🟠 Priority 1

## BE-3 · Export job list exposes other users' jobs

**Status:** ☐ Open  **Owner:** backend

```
GET /export/list   as EMPLOYEE  →  200, 7 jobs
  export_type: EMPLOYEES, ATTENDANCE, LEAVE
  file_url:    cloudinary://ems/<tenantId>/exports/<job_id>
```

An employee did not create an `EMPLOYEES` bulk export. The **download is correctly `403`'d**, so no
file content escapes — but the job list plus storage paths should not be visible.
Route: `export.routes.js:84`, `onRequest: [authenticate]`.

### Tasks

- [ ] Filter `/export/list` to jobs the caller requested, unless they hold `employees:export`,
      `attendance:export` or `leave:export`
- [ ] Drop `file_url` from the list response (the download endpoint already resolves it)

### Accept

- [ ] EMPLOYEE → `200` with only their own jobs
- [ ] HR_ADMIN → `200`, unchanged

---

## BE-10 · Async export download: wrong headers + unquoted CSV

**Status:** ☐ Open  **Owner:** backend

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

- [ ] `Content-Type: text/csv; charset=utf-8` on `/export/:job_id/download`
- [ ] Real `Content-Disposition` filename (e.g. `employees-2026-08-13.csv`) — reuse the format the
      direct exports already produce
- [ ] Apply the same RFC-4180 quoting used by `/assets/export` to the job-based exports
- [ ] Emit dates as `YYYY-MM-DD` (or ISO) — not `Date.prototype.toString()`
- [ ] Remove the duplicate `department.id` column
- [ ] Remove the trailing empty row
- [ ] Quote the header row in `/audit-logs/export`
- [ ] Audit export: stream all rows, or return the truncation count so the UI can warn

### Accept

- [ ] All four job-download paths return `text/csv; charset=utf-8` + a real filename
- [ ] Values fully quoted, dates `YYYY-MM-DD`, no duplicate column, no trailing row
- [ ] Audit export streams all rows **or** reports its truncation

---

## BE-11 · `/recruitment/export` does not exist

**Status:** ☐ Open  **Owner:** backend

`GET /recruitment/export` → **404**. No export route in `recruitment.routes.js`.

On our side this is worse than missing — `RecruitmentScreen.tsx:61` renders an Export button whose
only action is `toast.success('Export started — your file will download shortly.')`.
**It downloads nothing.** A placebo button, live in production today.

### Tasks — pick one

- [ ] **Either** confirm we should delete the button (we'll ship that immediately), **or**
- [ ] Build `GET /recruitment/export?type=openings|candidates&status=&departmentId=`
      · `recruitment:read` · `text/csv; charset=utf-8` · same quoting + filename conventions as
      `/assets/export` · columns mirroring the screen

### Accept

- [ ] `200 text/csv` with a real filename — **or** written confirmation to delete the button

---

# 🟠 High

## BE-5 · Tax-form PDF endpoint does not exist

**Status:** ☐ Open  **Owner:** backend

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

- [ ] Implement the route + renderer
- [ ] Honour the tenant's tax-form template (section enable + order), as the payslip renderer does

### Accept

- [ ] priya downloads her own → `200`, `%PDF-`
- [ ] priya on another employee's → `403`
- [ ] HR_ADMIN on any → `200`

---

## BE-6 · No seeded AUDITOR account

**Status:** ☐ Open  **Owner:** backend

`auditor@acme.test` → `401 INVALID_CREDENTIALS`. There is no seeded AUDITOR login on
`acme-corp-001`.

Every AUDITOR claim in your handoff — the headline answers to our Findings B, C and E
(`payroll:self-read`, `timesheets:read`, `analytics:read` granted) — is therefore **unverified in
production**. We cannot build or test AUDITOR-facing UI against it.

### Tasks

- [ ] Seed an AUDITOR user on `acme-corp-001`, password `Password123!`
- [ ] Confirm the 12 documented keys appear in its JWT

### Accept

- [ ] AUDITOR login returns `200` and we can read 12 keys from `permissions[]`

---

# 🟡 Medium

## BE-7 · Embed a Unicode font so `₹` renders

**Status:** ☐ Open  **Owner:** backend

Answering your open question 1: **yes, please embed it.** Confirmed live — the PDF renders
`INR 30,629.00` where the drawer shows `₹30,629.00`. This is the one document employees keep and
forward; the ISO-code fallback reads as broken rather than deliberate.

- [ ] Embed a Unicode-capable font in the PDF renderer
- [ ] **Accept:** rendered payslip PDF contains `₹30,629.00`

---

## BE-8 · `uan` enabled in template but absent from output

**Status:** ☐ Open  **Owner:** backend

The tenant template has `{ "key": "uan", "label": "UAN", "enabled": true }`, but UAN does not appear
in the rendered header (Name / Employee ID / Department / Designation only). Most likely a null
value being skipped — but a field marked enabled that silently never renders is indistinguishable
from a bug.

- [ ] Confirm which it is; if it's "skip when null", say so and we'll document it

---

## BE-9 · Confirm two intents

**Status:** ☐ Open  **Owner:** backend

### (a) A manager cannot open their own report's profile

```
GET /manager/team              as MANAGER  →  200, 26 members
GET /employees/<that member>   as MANAGER  →  403 "Cannot view other employee data"
```

`employees:read-any` is HR/SA-only, so the team list is a dead end.

- [ ] Confirm intended → we stop linking the rows, **or**
- [ ] Grant managers `read-any` scoped to their own reports

### (b) SUPER_ADMIN self-service reads return 400, not a graceful empty

`GET /attendance/today` → **400** and `GET /employee/dashboard` → **400** for SUPER_ADMIN, who has
no employee record. The Hostinger changelog claims graceful no-employee-record reads.

- [ ] Confirm the intended contract: `200` with an empty/`noEmployeeRecord` payload, **or** a
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

- [ ] Tell us which of those four you want; otherwise we leave them

### One inconsistency worth fixing while you're in here

`POST /export/*` requires `format: "csv"` (lowercase); `POST /reports/export` requires
`format: "CSV"` (uppercase, `enum: ['CSV']`). Same product, two casings.

- [ ] Pick one casing and align both

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
|  |  |  |  |
