# Backend → Frontend handoff — RBAC, exports & downloads

**15 August 2026** · Closes `BACKEND_IMPLEMENTATION_SPEC_2026-08-13.md` (BE-1 … BE-11)
API base: `https://ems-api.saqibsaeed.cloud/api/v1` · Backend HEAD: `b58fe1c`

All eleven items are implemented, deployed, and verified twice — once against production, once against
a local stack driven end-to-end over real HTTP. This document contains everything needed to re-test it
without asking us anything: exact requests, exact response bodies, exact headers, the permission key
for every gated route, the full 55-key matrix, and the three places your UI breaks against it.

---

## Contents

1. [Status and evidence](#1-status-and-evidence)
2. [How to verify it yourself](#2-how-to-verify-it-yourself)
3. [Response envelopes](#3-response-envelopes)
4. [Item by item — BE-1 … BE-11](#4-item-by-item)
5. [Breaking changes, consolidated](#5-breaking-changes-consolidated)
6. [New endpoints](#6-new-endpoints)
7. [The full permission matrix — for FE-8](#7-the-full-permission-matrix)
8. [What breaks on your side — for FE-9, FE-1](#8-what-breaks-on-your-side)
9. [Fixed beyond the tracker](#9-fixed-beyond-the-tracker)
10. [Deliberately not done](#10-deliberately-not-done)
11. [Open questions for you](#11-open-questions-for-you)
12. [Commit log](#12-commit-log)

---

## 1. Status and evidence

| ID | Item | Status | Proven by |
|---|---|---|---|
| BE-1 | Audit trail readable by any employee | ✅ Done | prod + local HTTP |
| BE-2 | Company-wide leave assignments readable by any employee | ✅ Done | prod + local HTTP |
| BE-4 | Are permission keys enforced or advisory? | ✅ **Option A** | prod + local HTTP |
| BE-3 | Export job list exposed other users' jobs | ✅ Done | prod + local HTTP |
| BE-10 | Async download headers + unquoted CSV | ✅ Done | prod + local HTTP |
| BE-11 | `/recruitment/export` did not exist | ✅ Built | prod + local HTTP |
| BE-5 | Tax-form PDF endpoint did not exist | ✅ Built | prod + local HTTP |
| BE-6 | No seeded AUDITOR account | ✅ Done | prod + local HTTP |
| BE-7 | Embed a Unicode font so ₹ renders | ✅ Done | local PDF byte inspection |
| BE-8 | `uan` enabled but absent from the PDF | ✅ Answered | source + template response |
| BE-9 | Manager→report profile · SA 400 on self-service | ✅ Both fixed | prod + local HTTP |

**Two independent verification runs:**

| Run | Result |
|---|---|
| Production — `scripts/verifyTrackerAccepts.mjs`, deploy run `31878368975` | **35 / 35 accept checks** |
| Local stack — `probe-ui-contract.mjs` + `probe-ui-contract-2.mjs` | **55 passed · 0 backend failures** |
| Backend CI — offline suite | **361 / 361** |
| Backend CI — database suite | **103 / 103** |
| Your vitest suite (MSW mocks — proves nothing about integration) | 836 / 838, the 2 known `OptionalHolidayPicker` failures |

The local run existed because MSW mocks cannot prove integration. It stood up a real backend against a
real Postgres, seeded it, and drove every Accept box over HTTP with the seeded logins. It found a
genuine error in an earlier draft of this document — see §4.9.

---

## 2. How to verify it yourself

Against production:

```bash
node scripts/verifyTrackerAccepts.mjs
```

Against anything else:

```bash
API_BASE=http://127.0.0.1:4310/api/v1 node scripts/verifyTrackerAccepts.mjs
BASE=http://127.0.0.1:4310/api/v1     node scripts/probe-ui-contract.mjs
BASE=http://127.0.0.1:4310/api/v1     node scripts/probe-ui-contract-2.mjs
```

Seeded logins — password `Password123!`, tenant header `x-tenant-key: acme-corp-001`
(optional once the JWT carries the tenant):

```
superadmin@acme.test   SUPER_ADMIN
hr@acme.test           HR_ADMIN
aman@acme.test         MANAGER
priya@acme.test        EMPLOYEE
auditor@acme.test      AUDITOR      ← new, BE-6
```

---

## 3. Response envelopes

Every JSON response uses one of these. Binary routes (PDF, CSV) return raw bytes with headers.

```jsonc
// success
{ "success": true, "data": { /* payload */ }, "meta": {} }

// error
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this action",
    "details": { "requiredPermission": "audit:read", "userRole": "EMPLOYEE" },
    "requestId": "req-1a2b"
  }
}
```

`details.requiredPermission` is present on **every** permission `403` — branch on that string, not on
the message. `userRole` is the caller's `memberType`.

---

## 4. Item by item

### 4.1 BE-1 · Audit trail

**Was:** `GET /audit-logs` carried `onRequest: [authenticate]` only. Any employee could page the whole
tenant trail — 501,538 rows, with other users' emails as actors.

**Now:** both read routes require `audit:read`, and the key was revoked from MANAGER and EMPLOYEE on
the tenant. Gating alone would not have closed it — both roles held the key.

```http
GET /audit-logs?page=1&limit=50          audit:read
GET /audit-logs/:id                      audit:read
POST /audit-logs/dpia-report             audit:export   (unchanged)
GET /audit-logs/export                   audit:export   (unchanged)
```

```
PASS  EMPLOYEE    → 403  requiredPermission=audit:read
PASS  MANAGER     → 403  requiredPermission=audit:read
PASS  HR_ADMIN    → 200
PASS  SUPER_ADMIN → 200
PASS  AUDITOR     → 200   (holds audit:read by default)
```

> `audit:read` is **not** in the MANAGER/EMPLOYEE default matrix — it never was. The grant came from
> this tenant's saved `RolePermission` customization, which `hasPermission()` prefers whenever the
> token's `permissions[]` is non-empty. That is why the revoke had to happen against the tenant, not
> the code.

### 4.2 BE-2 · Leave assignments

**Was:** `getAssignments` passed `employeeId: undefined` when no query param was given, so the repo
returned every row in the tenant — 138 rows across 75 employees.

**Now:** caller-scoped, permission-driven, mirroring `/leave/ledger`.

| Caller | Sees | Key |
|---|---|---|
| EMPLOYEE / AUDITOR | own rows only | — |
| MANAGER | self + direct reports | `leave:team-read` |
| HR_ADMIN / SUPER_ADMIN | every row | `leave:policy-manage` |

`?employeeId=` still works but **cannot widen scope** — targeting someone the caller may not see
returns an empty list, not their data.

```
local   EMPLOYEE 1 of 59 · MANAGER 20 of 59 · HR_ADMIN 59 · forced ?employeeId= leaked 0 rows
prod    EMPLOYEE 1        · MANAGER 23       · HR_ADMIN 138 rows
```

### 4.3 BE-4 · Permission keys — **Option A, enforced**

**Decision: Option A.** These keys are enforced. Gate your nav on `permissions[]` for these modules.

| Method | Route | Required key |
|---|---|---|
| GET | `/employees` | `employees:read` |
| GET | `/employees/:id` | `employees:read` + existing self-or-`employees:read-any` check |
| GET | `/departments` | `departments:read` |
| GET | `/leave/types` | `leave:read` |
| GET | `/leave/requests` | `leave:read` |
| GET | `/leave/balance` · `/leave/balance/me` | `leave:read` |
| POST | `/leave/requests` | `leave:request` |
| GET | `/attendance/records` | `attendance:read` |
| GET | `/attendance/summary` | `attendance:read` |
| GET | `/attendance/calendar` | `attendance:read` |
| GET | `/attendance/regularization` | `attendance:read` |
| POST | `/attendance/check-in` | `attendance:write` |
| POST | `/attendance/check-out` | `attendance:write` |
| POST | `/attendance/regularization` | `attendance:write` |

**Two corrections to your premise**, both of which made Option A safer than you expected:

1. All six keys **were already** in the MANAGER and EMPLOYEE default matrix. The live token lacked
   them because `acme-corp-001` carries a saved role customization, and the default fallback applies
   only when `permissions[]` is empty. A fresh tenant would never have hit this.
2. Your grant list was missing **`attendance:read`** — `/attendance/records`, `/summary`,
   `/calendar` and `/regularization` need it, not just `attendance:write`.

**The mandatory second half shipped.** `scripts/rbacGrantReconcileDb.mjs` runs on every deploy
*before* the new container starts serving, so gates can never go live ahead of grants:

```
build image → reconcile grants (old container still serving) → up → migrate → verify → health
```

```
local   all 7 gated routes reachable for MANAGER + EMPLOYEE · 21 / 12 keys held
prod    all listed routes 200 for both roles after the top-up
```

> ⚠️ **One thing to check on your side.** The default matrix gives MANAGER **21** keys; production
> currently reports **20**. Our reconcile only guarantees the six BE-4 keys, so one other MANAGER key
> is still revoked by tenant customization and we could not identify which from here. Find it with
> `GET /settings/roles-permissions` as SUPER_ADMIN and diff `matrix.MANAGER` against §7. It matters
> the moment FE-9 gates nav on `permissions[]`.

### 4.4 BE-3 · Export job list

**Was:** any employee saw all tenant jobs plus `file_url` storage paths
(`cloudinary://ems/<tenantId>/exports/<job_id>`). The download was already correctly 403'd, so no file
content escaped — but the list should not have been visible.

**Now:** filtered on `ExportJob.createdById` unless the caller holds `employees:export`,
`attendance:export` or `leave:export`. `file_url` removed from the response entirely.

```jsonc
// GET /export/list?page=1&limit=10   → 200
{ "success": true, "data": {
    "exports": [
      { "job_id": "b3f1…", "export_type": "EMPLOYEES", "format": "csv",
        "status": "SUCCESS", "error_message": null,
        "created_at": "2026-08-15T09:20:11.000Z",
        "completed_at": "2026-08-15T09:20:14.000Z" }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 15, "pages": 2 } },
  "meta": {} }
```

Anything reading `file_url` from this list now reads `undefined`. Use `GET /export/:job_id/download`.

### 4.5 BE-10 · Async export download

**Your diagnosis was wrong; the symptom was real.** The header code was already correct. The cause was
the `302` to the Cloudinary signed URL — Cloudinary serves raw assets as `application/octet-stream`
named `file`, so our headers never reached the browser. The bytes are proxied now.

```http
GET /export/:job_id/download

Content-Type:        text/csv; charset=utf-8
Content-Disposition: attachment; filename="employees-2026-08-15.csv"
```

```csv
# was
id,firstName,lastName,…,joinedOn,departmentId,department.id,…
cmqjpyds0001,Aman,Kumar,…,Wed Jan 15 2020 00:00:00 GMT+0000 (Coordinated Universal Time),d1,d1,…
,,,,,,,,,,,,,

# now
"id","firstName","lastName",…,"joinedOn","departmentId","department.name",…
"cmqjpyds0001","Aman","Kumar",…,"2020-01-15","d1","Engineering",…
```

Filename convention `<type>-<YYYY-MM-DD>.<ext>` — `employees-`, `attendance-`, `leave-`.
**A parser pinned to the old column count needs a look.**

**Audit export (BE-10b)** — the 10,000-row cap stays, because streaming 501,569 rows would buffer
~100 MB. It now reports itself:

```http
GET /audit-logs/export?format=csv        audit:export

Content-Type:        text/csv; charset=utf-8
Content-Disposition: attachment; filename="audit-logs-2026-08-15.csv"
X-Export-Total:      501569
X-Export-Returned:   10000
X-Export-Truncated:  true
```

Header row is quoted; `created_at` is ISO. Warn when `X-Export-Truncated: true`.

### 4.6 BE-11 · Recruitment export

Built. Replaces the placebo button at `RecruitmentScreen.tsx:61`, which fires
`toast.success('Export started — your file will download shortly.')` and downloads nothing.

```http
GET /recruitment/export?type=openings|candidates&status=&stage=&openingId=
Permission: recruitment:read

200 text/csv; charset=utf-8
Content-Disposition: attachment; filename="recruitment-openings-2026-08-15.csv"
```

```
openings     Title, Department, Location, Employment Type, Applicants, Current Stage, Status, Posted
candidates   Name, Email, Role, Stage, Rating, Days In Stage, Referral, Applied
```

RFC-4180 quoted throughout. Empty values render `—`, booleans `Yes`/`No`, dates `YYYY-MM-DD` — matching
the UI. **`?departmentId` is not supported**: an opening stores `department` as free text, not a
foreign key.

### 4.7 BE-5 · Tax-form PDF

Built. Replaces `window.print()` at `TaxFormDrawer.tsx:61`.

```http
GET /payroll/employees/:employeeId/tax-forms/:formId/download?format=pdf&fy=2026-27
Permission: payroll:self-read  +  self-or-HR/SA

200 application/pdf
Content-Disposition: attachment; filename="tax-form-priya-sharma-fy2026-27.pdf"
403  another employee's form
404  employee has no payroll data
```

`:formId` is the form **type** — `FORM16` | `W2` | `P60` — because there is no `TaxForm` table; a form
is *(type, fiscal year)*. `?fy=` selects the year. The PDF renders the same `TaxFormDocument` the JSON
endpoint already returns, so drawer and file cannot drift.

```
local   EMPLOYEE on own 200 %PDF- · EMPLOYEE on another 403 · HR_ADMIN on any 200
```

### 4.8 BE-6 · AUDITOR account

`auditor@acme.test` / `Password123!` now seeded on `acme-corp-001`, in `prisma/seed.js` and as a
standalone `scripts/seedAuditorUser.mjs` that the deploy runs. Exactly the 12 documented keys:

```
analytics:read  announcements:read  attendance:read  audit:export  audit:read
departments:read  employees:read  holidays:read  leave:read  payout:self
payroll:self-read  timesheets:read
```

### 4.9 BE-9 · The two intents

**(a) Manager → report profile.** Not intended to be blocked. A manager can now open a **direct
report's** profile, checked against `Employee.managerId`. Anyone else's still `403`s. Keep linking the
rows.

```
local   MANAGER on own report 200 · MANAGER on a stranger 403
```

Deliberately **not** added to `canAccessEmployeeRecord()`, which also guards payslips, documents and
tax forms — those stay HR/SA-only.

**(b) Personal reads with no employee record.** Verified endpoint by endpoint against a genuinely
unlinked SUPER_ADMIN:

| Endpoint | Response |
|---|---|
| `GET /employee/dashboard` | `200 { noEmployeeRecord: true }` |
| `GET /attendance/today` | `200 { noEmployeeRecord: true }` |
| `GET /employee/documents` · `/employees/me/documents` | `200 { noEmployeeRecord: true }` |
| `GET /employee/team` · `/employees/me/team` | `200 { noEmployeeRecord: true }` |
| `POST /attendance/check-in` · `/check-out` | `400 NO_EMPLOYEE_RECORD` — unchanged |

Branch on `data.noEmployeeRecord === true`.

> **Correction to an earlier draft of this document.** It listed `/employee/balance` as a fifth
> `noEmployeeRecord` endpoint. **That route does not exist — it returns 404.** The real balance
> endpoints are `GET /leave/balance` and `/leave/balance/me`, and they return `200` *without* the
> flag. `getBalanceHandler` and `getHolidaysHandler` exist in `employee.controller.js` but are not
> routed anywhere — dead code. Caught by running this document back as a test.

### 4.10 BE-7 · Rupee in the payslip PDF

PDFKit's built-in Helvetica is WinAnsi, so `formatMoney` detected the unrenderable symbol and demoted
it to `INR 30,629.00`. Noto Sans Regular + Bold are now embedded (~1.1 MB in-repo, no host font
dependency) and the ISO-code fallback is gone.

Proof is stronger than "a font is embedded": the probe decompresses the PDF streams and finds
**U+20B9 in the ToUnicode CMap** — the glyph→Unicode map for text actually drawn on the page.

```
PASS  payslip 200 %PDF-
PASS  NotoSans embedded · no BaseFont /Helvetica
PASS  U+20B9 present in the ToUnicode map — the rupee is genuinely rendered
```

### 4.11 BE-8 · `uan` enabled but absent

**Neither "skip when null" nor a pure rendering bug — an unmapped key, with no data behind it either.**

1. `renderEmployeeGrid` maps exactly six field keys: `employeeCode`, `designation`, `department`,
   `pan`, `payDate`, `paymentRef`. `uan` is not one, so an enabled `uan` resolves to `undefined` and
   is skipped.
2. It would be skipped even with data — `Employee` has no UAN column, and `payroll.repository.js`
   hardcodes `panNumber: null` on the payslip, so `pan` is equally dead.
3. The skip is deliberate for genuinely absent optional data, and wrong for a key nothing can render.

Your instinct was right: an enabled field that silently never renders is indistinguishable from a bug.
The template response now says so:

```jsonc
// GET /payroll/payslip-templates
{ "fields": [
    { "key": "employeeCode", "label": "Employee ID", "enabled": true,  "supported": true  },
    { "key": "uan",          "label": "UAN",         "enabled": true,  "supported": false }
] }
```

Show `supported: false` fields as unsupported rather than enabled. Real UAN/PAN values are schema work.

---

## 5. Breaking changes, consolidated

| # | Change | Where it bites |
|---|---|---|
| 1 | 13 routes now `403` without the key (§4.3) | Nav gating — **FE-9 unblocked** |
| 2 | `file_url` gone from `/export/list` (§4.4) | Anything reading that field |
| 3 | 4 personal reads `400` → `200 { noEmployeeRecord }` (§4.9b) | SUPER_ADMIN empty states |
| 4 | Job CSV headers + column shape changed (§4.5) | Any pinned CSV parser |
| 5 | Audit export sends `X-Export-*` headers (§4.5) | Truncation warning UI |
| 6 | MANAGER/EMPLOYEE `403` on audit logs (§4.1) | Audit surfaces for those roles |

Non-breaking but worth knowing: `POST /reports/export` now accepts `format` in **either** casing and
canonicalises internally, so your eight files sending `'CSV'` are unaffected. Lowercase is the
documented form, matching `POST /export/*`.

---

## 6. New endpoints

```
GET /recruitment/export?type=openings|candidates          recruitment:read       §4.6
GET /payroll/employees/:id/tax-forms/:formId/download     payroll:self-read      §4.7
```

Changed response shape (additive, non-breaking):

```
GET /payroll/payslip-templates    → fields[].supported: boolean                  §4.11
GET /audit-logs/export            → X-Export-Total / -Returned / -Truncated      §4.5
```

---

## 7. The full permission matrix

For FE-8. 55 keys. `●` = held by default, `·` = not held. This is the **default** matrix — a tenant's
saved customization can differ, which is exactly what BE-1 and BE-4 were about, so read the live
values from `GET /settings/roles-permissions` before hard-coding anything.

Default counts: **SUPER_ADMIN 55 · HR_ADMIN 52 · MANAGER 21 · EMPLOYEE 12 · AUDITOR 12**
SUPER_ADMIN also bypasses every check unconditionally in `hasPermission()`.

| Key | SA | HR | MGR | EMP | AUD | Description |
|---|:--:|:--:|:--:|:--:|:--:|---|
| `analytics:read` | ● | ● | ● | · | ● | View analytics dashboards |
| `announcements:admin` | ● | ● | · | · | · | Delete and pin announcements |
| `announcements:read` | ● | ● | ● | ● | ● | View announcements |
| `announcements:write` | ● | ● | ● | · | · | Create and update announcements |
| `assets:export` | ● | ● | · | · | · | Export the asset inventory |
| `assets:manage` | ● | ● | · | · | · | Manage the asset inventory and assignments |
| `attendance:approve` | ● | ● | ● | · | · | Approve or deny team attendance and regularization |
| `attendance:export` | ● | ● | · | · | · | Export attendance data |
| `attendance:read` | ● | ● | ● | ● | ● | View attendance records |
| `attendance:team-read` | ● | ● | ● | · | · | View team attendance records and weekly rollups |
| `attendance:write` | ● | ● | ● | ● | · | Check in/out and request regularization |
| `audit:export` | ● | ● | · | · | ● | Export audit logs and DPIA reports |
| `audit:read` | ● | ● | · | · | ● | View audit logs |
| `billing:export` | ● | ● | · | · | · | Export the invoice list |
| `billing:read` | ● | ● | · | · | · | View subscription, invoices and usage |
| `departments:read` | ● | ● | ● | ● | ● | View departments |
| `departments:write` | ● | ● | · | · | · | Create, update and delete departments |
| `employees:delete` | ● | ● | · | · | · | Soft-delete employee records |
| `employees:export` | ● | ● | · | · | · | Export employee data |
| `employees:read` | ● | ● | ● | ● | ● | View employee records |
| `employees:read-any` | ● | ● | · | · | · | View any employee record, documents and photo |
| `employees:write` | ● | ● | · | · | · | Create and update employee records |
| `holidays:read` | ● | ● | ● | ● | ● | View the holiday calendar |
| `holidays:write` | ● | ● | · | · | · | Create, update, delete and import holidays |
| `leave:approve` | ● | ● | ● | · | · | Approve or reject team leave requests |
| `leave:export` | ● | ● | · | · | · | Export leave data |
| `leave:manage-types` | ● | ● | · | · | · | Create and update leave types |
| `leave:policy-manage` | ● | ● | · | · | · | Manage leave policy packs, policies, ledger and encashment |
| `leave:read` | ● | ● | ● | ● | ● | View leave records and balances |
| `leave:request` | ● | ● | ● | ● | · | Submit and withdraw own leave requests |
| `leave:team-read` | ● | ● | ● | · | · | View team leave requests, calendar and coverage |
| `logs:read` | ● | ● | · | · | · | View application logs |
| `payout:manage` | ● | ● | · | · | · | Verify and approve payout methods |
| `payout:self` | ● | ● | ● | ● | ● | Manage own payout methods |
| `payroll:admin` | ● | ● | · | · | · | Manage payroll components, groups, schedules and runs |
| `payroll:approve` | ● | ● | · | · | · | Approve payroll runs |
| `payroll:export` | ● | ● | · | · | · | Export payroll registers, journals and bank files |
| `payroll:self-read` | ● | ● | ● | ● | ● | View own salary, payslips, tax declaration, loans, reimbursements |
| `payroll:super` | ● | · | · | · | · | Manage legal entities, statutory packs and country bank schemas |
| `performance:export` | ● | ● | · | · | · | Export performance reviews and goals |
| `performance:manage` | ● | ● | · | · | · | Manage review cycles and calibration |
| `performance:read` | ● | ● | ● | · | · | View performance reviews and goals |
| `permissions:manage` | ● | · | · | · | · | Manage roles and permissions |
| `recruitment:read` | ● | ● | ● | · | · | View requisitions, candidates and interviews |
| `recruitment:write` | ● | ● | · | · | · | Manage requisitions, candidates and offers |
| `reports:read` | ● | ● | · | · | · | View and generate reports |
| `reports:schedule` | ● | ● | · | · | · | Manage scheduled reports and export history |
| `settings:integrations` | ● | ● | · | · | · | Manage email, storage and webhook integrations |
| `settings:manage` | ● | ● | · | · | · | Manage branding, attendance rules, leave types and custom roles |
| `settings:security` | ● | · | · | · | · | Manage authentication and security settings |
| `settings:tenant-write` | ● | ● | · | · | · | Edit company profile and email templates |
| `timesheets:admin` | ● | ● | · | · | · | Manage projects and timesheet settings |
| `timesheets:approve` | ● | ● | ● | · | · | Approve or reject team timesheets |
| `timesheets:read` | ● | ● | ● | ● | ● | View timesheets |
| `timesheets:write` | ● | ● | ● | ● | · | Create and submit timesheets |

---

## 8. What breaks on your side

We pulled `ems-frontend` at `c94ec1a`, read your memory under `docs/context/memory/`, ran your vitest
suite, and drove the UI's assumptions against a real backend. **Three things break or mislead.**

### 8.1 🔴 `audit-logs:read` is not a real permission key

`src/lib/permissions.ts:27,30` grants `audit-logs:read`. The catalogue key is **`audit:read`**. We
diffed all seven keys your `can()` vocabulary uses against our 55 — six match, this one does not exist
server-side. Confirmed live: no role's `permissions[]` contains it.

It works today only because `can()` falls through to `ROLE_IMPLIED_PERMISSIONS` by role
(`permissions.ts:47`). **The moment FE-9 gates on `permissions[]`, every audit surface disappears for
HR_ADMIN and AUDITOR** — the two roles that genuinely hold `audit:read`.

**Fix:** rename to `audit:read` in `permissions.ts` and `ActivityTab.tsx:93`.

### 8.2 🔴 The Employees export button renders for MANAGER and EMPLOYEE, then 403s

`EmployeeTable.tsx:387` — `const canExport = can(user, 'employees:read')` — and the same key at `:861`.
The export route requires **`employees:export`**.

Your memory `hr-admin-empty-permissions-locks-core-crud.md` predicted this and called it harmless
*while* those roles had empty `permissions[]`. **BE-4's grant top-up made it certain.** `can()` checks
the explicit array first, both roles now carry `employees:read`, so the button renders and 403s.

Reproduced empirically, not inferred:

```
UI-2  MANAGER:  holds employees:read = true   →  /employees/export/csv = 403
UI-2  EMPLOYEE: holds employees:read = true   →  /employees/export/csv = 403
```

This is FE-1 on your list. Our change promoted it from latent to live — **do it first.**

**Fix:** `employees:export` at both sites.

### 8.3 🟠 Nothing handles `noEmployeeRecord`

No occurrence of `noEmployeeRecord` or `NO_EMPLOYEE_RECORD` anywhere in `src/`. Those reads previously
threw into your error path; they now return `200` with an otherwise-empty payload, so SUPER_ADMIN gets
blank widgets rather than an empty state. Add the branch (§4.9b).

### 8.4 ✅ Confirmed safe

- **`file_url`** — nothing in `src/` reads it from the export list; the only `fileUrl` hits are
  employee documents. No breakage.
- **`format: 'CSV'`** — eight files send uppercase; the backend accepts both.
- **Job CSV parsing** — you consume neither `/export/list` nor the job download today, so §4.5's
  column changes hit nothing until FE-5 lands.
- **Your test suite** — 836/838, the two documented pre-existing failures, unchanged.

### 8.5 Your queue, updated

| ID | Item | Now |
|---|---|---|
| FE-1 | `employees:export` key fix | 🔴 **Do first** — actively wrong in production (§8.2) |
| — | `audit-logs:read` → `audit:read` | 🔴 **New** — blocks FE-9 correctness (§8.1) |
| — | `noEmployeeRecord` empty state | 🟠 **New** — four endpoints changed status (§8.3) |
| FE-9 | Permission-based nav filtering | ✅ Unblocked — Option A, gate on `permissions[]` |
| FE-10 | Recruitment Export button | ✅ Wire it — don't delete it (§4.6) |
| FE-11 | Tax-form PDF download | ✅ Unblocked (§4.7) |
| FE-6 | Payslip blob download | ✅ Unblocked — `PayslipDrawer.tsx:94` still calls `window.print()` |
| FE-8 | 55-row permissions matrix | ⚠️ Use §7; verify live values per tenant |
| FE-5 | Three client CSVs → our endpoints | Unchanged — those endpoints were already correct |
| FE-2/3/4/7 | SSE, EventSource, bell, `ids[]` | No backend change |

---

## 9. Fixed beyond the tracker

Found while working the queue. Same deploy, same verification.

- **A second leak of the BE-2 shape.** `GET /leave/comp-off/requests?scope=team` dropped the employee
  filter entirely, so a MANAGER saw every comp-off request in the tenant rather than their reports'.
  Scoped with the same helper.
- **Tax forms had no ownership check at all.** `GET /payroll/employees/:id/tax-form` checked only
  `payroll:self-read` — any holder could read anyone's tax form by id. Now self-or-HR/SA.
- **Attendance recorded the wrong day for some tenants.** The employee-timezone resolver documented
  its chain as entity → tenant → UTC but never read `Tenant.timezone`, so a tenant with no
  `TenantConfig` row fell to UTC — putting every check-in after 18:30 IST on the previous day.
  Backend-only; the UI never sends a date.
- **CI ran no tests at all.** The database test job was missing from `ci.yml`; 350+ tests had not run
  on push. Restored, and the deploy now asserts the running container actually carries the deployed
  commit before reporting success — after two deploys silently shipped nothing.
- **`csv` / `CSV` casing aligned** (§5).

---

## 10. Deliberately not done

| Item | Why |
|---|---|
| `?departmentId` on the recruitment export | An opening stores `department` as free text, not a FK. `?status`, `?stage`, `?openingId` work. |
| Tenant-editable tax-form template | Unlike payslips, no such template exists — layout is per form type in code. Making it editable is a new settings surface. |
| Real UAN / PAN values | `Employee` has no UAN column; `panNumber` is hardcoded `null`. Schema work. |
| Tier E exports | **Decided, not built:** build **timesheets** (billable hours and rates, real volume) and **holidays** (small, static, actually mailed around). Skip **departments** — a flat CSV destroys the hierarchy that is the point of the screen — and **announcements**, prose in CSV cells. Say the word. |

---

## 11. Open questions for you

**Custom roles: replace or add?** Assigning a custom role currently *unions* with the user's existing
role links — that is what ships, and a test pins it deliberately. A sibling test assumed it *replaces*.
If replace is intended, the fix belongs in `POST /settings/roles/:key/users`. We did not decide it.

**`note` vs `notes` on check-in.** `CheckInInput` (`attendance.types.ts:65`) declares `notes`; our
`checkInSchema` expects `note`. Unknown keys are stripped silently, so a note typed at check-in would
vanish with no error. **Nothing is broken today** — no call site passes it — but whoever wires that
field next loses the data. We'll accept both if you'd rather not touch the type.

**MANAGER's missing 21st key** — see the warning in §4.3.

---

## 12. Commit log

```
e3dc67a  fix(rbac): BE-1 gate audit-log reads on audit:read
681ec61  fix(rbac): BE-2 scope leave assignments and comp-off team reads to the caller
75bba1e  feat(rbac): BE-4 Option A -- enforce employees/departments/leave/attendance read keys
a8c0aed  fix(export): BE-3 scope /export/list to the caller and drop file_url
97d806e  fix(export): BE-10 correct headers, RFC-4180 quoting and dates on job exports
09e2d5e  feat(recruitment): BE-11 add GET /recruitment/export
9646e61  fix(payroll): BE-7 embed Noto Sans so the rupee renders in the payslip PDF
1b0f6f1  feat(payroll): BE-5 add tax-form PDF download
c23d8fe  feat(seed): BE-6 seed an AUDITOR login on acme-corp-001
cc74550  fix(payroll): BE-8 flag payslip template fields the renderer cannot draw
ee2fc55  fix(rbac): BE-9 open a manager's report profile, make personal reads graceful
4bf365b  fix(export): align the csv/CSV format casing across the two export APIs
f2440b9  ci: run the tests again, and make the BE-4 grant ordering structural
dcab688  fix(boot): commit the missing publicUrl.js that made main unloadable
672af4b  fix(deploy): docker compose run was eating the rest of the deploy script
870cc6e  fix(audit): report the real row count on a truncated export
bed269c  fix(attendance): resolve the tenant timezone, not just TenantConfig
81528b7  test(rbac): establish the custom-role precondition instead of assuming it
b58fe1c  test: prove BE-1..BE-11 over real HTTP on a local stack
```

---

*Backend team · production verified 35/35 on deploy run `31878368975` · local end-to-end 55/55 ·
tracker: `docs/BACKEND_IMPLEMENTATION_SPEC_2026-08-13.md`*
