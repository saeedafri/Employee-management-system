# Backend → Frontend handoff — RBAC, exports & downloads

**15 August 2026** · Closes `BACKEND_IMPLEMENTATION_SPEC_2026-08-13.md` (BE-1 … BE-11)
API base: `https://ems-api.saqibsaeed.cloud/api/v1`

All eleven items are implemented, deployed and verified against production. This document has
everything you need to re-test it yourself: exact request shapes, exact response bodies, exact
headers, and the six places your code has to change.

**Before you read the backend part:** §9 is a self-audit we ran *as if we were you* — we pulled your
repo at `c94ec1a`, read your memory, ran your vitest suite, and checked whether the UI actually
survives these changes. It does not, in three specific places. They're listed with file and line.

---

## 1. Verification

`scripts/verifyTrackerAccepts.mjs` checks every **Accept** box on the tracker against production with
real logins for all five seeded roles. It runs as the final step of every deploy, so a regression
fails the deploy instead of reaching you.

| | |
|---|---|
| Live accept checks | **35 / 35** |
| Backend offline tests | **361 / 361** |
| Backend database tests | **103 / 103** |
| Deploy run | `31878368975` |
| Local end-to-end probe (independent, §9) | **55 passed · 0 backend failures** |
| Your vitest suite (MSW mocks, not this backend) | **836 / 838** — the 2 known `OptionalHolidayPicker` failures, unchanged |

```
PASS  BE-1  priya@acme.test  → GET /audit-logs   403  requiredPermission=audit:read
PASS  BE-1  aman@acme.test   → GET /audit-logs   403
PASS  BE-1  hr@ / superadmin@                    still 200
PASS  BE-2  EMPLOYEE 1 employee · MANAGER 23 (own team) · HR_ADMIN 138 rows
PASS  BE-3  EMPLOYEE 15 own jobs · no file_url
PASS  BE-10 text/csv; charset=utf-8 · employees-2026-08-15.csv · quoted · no GMT dates
PASS  BE-10 audit truncation total=501569 returned=10000
PASS  BE-11 200 · recruitment-openings-2026-08-15.csv
PASS  BE-5  priya own tax form 200 %PDF- · another employee's 403 · HR 200
PASS  BE-6  auditor@acme.test logs in · 12 keys in permissions[]
PASS  BE-7  payslip PDF embeds NotoSans (₹ renders)
PASS  BE-9  SUPER_ADMIN /attendance/today + /employee/dashboard → 200 noEmployeeRecord
```

Reproduce all 35 in one command:

```bash
node scripts/verifyTrackerAccepts.mjs
API_BASE=https://ems-api.saqibsaeed.cloud/api/v1 node scripts/verifyTrackerAccepts.mjs
```

Seeded logins, password `Password123!`: `superadmin@` `hr@` `aman@` `priya@` `auditor@acme.test`.
Tenant header `x-tenant-key: acme-corp-001` (optional once the JWT carries the tenant).

---

## 2. Response envelopes

Every JSON response uses one of these two shapes. Binary routes (PDF, CSV) return raw bytes.

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

`details.requiredPermission` is present on **every** permission `403` and is the string you should
branch on. `userRole` is the caller's `memberType`.

---

## 3. What shipped

| ID | Item | Status | Live evidence |
|---|---|---|---|
| BE-1 | Audit trail readable by any employee | ✅ Done | 403 + `audit:read` |
| BE-2 | Company-wide leave assignments readable by any employee | ✅ Done | 1 / 23 / 138 rows |
| BE-4 | Are permission keys enforced or advisory? | ✅ **Option A** | gated + grants topped up |
| BE-3 | Export job list exposed other users' jobs | ✅ Done | own jobs, no `file_url` |
| BE-10 | Async download headers + unquoted CSV | ✅ Done | `employees-2026-08-15.csv` |
| BE-11 | `/recruitment/export` did not exist | ✅ Built | 200 `text/csv` |
| BE-5 | Tax-form PDF endpoint did not exist | ✅ Built | 200 `%PDF-` · 403 · 404 |
| BE-6 | No seeded AUDITOR account | ✅ Done | `auditor@acme.test` · 12 keys |
| BE-7 | Embed a Unicode font so ₹ renders | ✅ Done | NotoSans embedded |
| BE-8 | `uan` enabled but absent from the PDF | ✅ Answered | unmapped key, not null-skip |
| BE-9 | Manager→report profile · SA 400 on self-service | ✅ Both fixed | 200 `noEmployeeRecord` |

You were right on all eleven — every finding reproduced in our source. Three had details worth
correcting (§4.1, §4.4, §7); none changed the verdict.

---

## 4. Breaking changes — with exact shapes

Six responses changed. All are live now.

### 4.1 Permission keys are enforced — **FE-9 unblocked** (BE-4, Option A)

Thirteen routes now require a key. Gate your nav on `permissions[]` for these modules.

| Method | Route | Required key |
|---|---|---|
| GET | `/employees` | `employees:read` |
| GET | `/employees/:id` | `employees:read` *(plus the existing self-or-`employees:read-any` check)* |
| GET | `/departments` | `departments:read` |
| GET | `/leave/types` · `/leave/requests` · `/leave/balance` · `/leave/balance/me` | `leave:read` |
| POST | `/leave/requests` | `leave:request` |
| GET | `/attendance/records` · `/attendance/summary` · `/attendance/calendar` · `/attendance/regularization` | `attendance:read` |
| POST | `/attendance/check-in` · `/attendance/check-out` · `/attendance/regularization` | `attendance:write` |

Denial shape:

```jsonc
// 403
{ "success": false, "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this action",
    "details": { "requiredPermission": "employees:read", "userRole": "MANAGER" } } }
```

**Two corrections to your premise**, both of which made this safer than you expected:

1. All six keys **were already** in the MANAGER and EMPLOYEE default matrix. The live token lacked
   them because `acme-corp-001` carries a saved role customization, and the default fallback only
   applies when `permissions[]` is empty. A fresh tenant would never have hit this.
2. Your grant list was missing **`attendance:read`** — `/attendance/records`, `/summary` and
   `/calendar` need it, not just `attendance:write`.

Both roles were topped up before the gates went live, and the reconcile now runs on every deploy
*before* cutover, so the ordering can't be skipped. Current live grants:

```
MANAGER   20 keys      EMPLOYEE  12 keys      AUDITOR  12 keys
```

### 4.2 `file_url` removed from the export list (BE-3)

`GET /export/list` now returns only the caller's own jobs unless they hold `employees:export`,
`attendance:export` or `leave:export`. The storage path is gone from the payload.

```jsonc
// 200 — note: no file_url
{ "success": true, "data": {
    "exports": [
      { "job_id": "b3f1…", "export_type": "EMPLOYEES", "format": "csv",
        "status": "SUCCESS", "error_message": null,
        "created_at": "2026-08-15T09:20:11.000Z", "completed_at": "2026-08-15T09:20:14.000Z" }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 15, "pages": 2 } } }
```

Anything reading `file_url` from this list now reads `undefined`. Use
`GET /export/:job_id/download`, which resolves it behind the permission check.

### 4.3 Personal reads return 200, not 400 (BE-9b)

| | |
|---|---|
| Was | `400 { error: { code: "NO_EMPLOYEE_RECORD" } }` |
| Now | `200 { success: true, data: { noEmployeeRecord: true }, meta: {} }` |

Verified endpoint by endpoint against a local backend with a genuinely unlinked SUPER_ADMIN:

| Endpoint | No-employee response |
|---|---|
| `GET /employee/dashboard` | `200 { noEmployeeRecord: true }` |
| `GET /attendance/today` | `200 { noEmployeeRecord: true }` |
| `GET /employee/documents` · `/employees/me/documents` | `200 { noEmployeeRecord: true }` |
| `GET /employee/team` · `/employees/me/team` | `200 { noEmployeeRecord: true }` |
| `POST /attendance/check-in` · `/check-out` | `400 NO_EMPLOYEE_RECORD` — unchanged, nothing to write against |

Branch on `data.noEmployeeRecord === true`.

> **Correction to an earlier draft of this document.** It listed `/employee/balance` as a fifth
> `noEmployeeRecord` endpoint. That route does not exist — it returns `404`. The real balance
> endpoints are `GET /leave/balance` and `/leave/balance/me`, and they return `200` *without* the
> flag. `getBalanceHandler` and `getHolidaysHandler` exist in `employee.controller.js` but are not
> routed anywhere; they are dead code. Caught by running this document back as a test, not by review.

### 4.4 Job CSV downloads changed headers *and* column shape (BE-10)

Your diagnosis pointed at the header code. The real cause was the `302` to the Cloudinary signed URL:
Cloudinary serves raw assets as `application/octet-stream` named `file`, so our headers never reached
the browser. The bytes are proxied now.

```http
GET /export/:job_id/download

Content-Type:        text/csv; charset=utf-8
Content-Disposition: attachment; filename="employees-2026-08-15.csv"
```

Body, before and after:

```csv
# was — unquoted, JS toString dates, duplicate column, trailing empty row
id,firstName,lastName,…,joinedOn,departmentId,department.id,…
cmqjpyds0001,Aman,Kumar,…,Wed Jan 15 2020 00:00:00 GMT+0000 (Coordinated Universal Time),d1,d1,…
,,,,,,,,,,,,,

# now — RFC 4180 throughout, ISO dates, no duplicate, no trailing row
"id","firstName","lastName",…,"joinedOn","departmentId","department.name",…
"cmqjpyds0001","Aman","Kumar",…,"2020-01-15","d1","Engineering",…
```

Filename convention is `<type>-<YYYY-MM-DD>.<ext>` — `employees-`, `attendance-`, `leave-`.
**Any parser pinned to the old column count needs a look.**

### 4.5 Audit export reports truncation (BE-10b)

The 10,000-row cap stays — streaming 501,569 rows would buffer ~100 MB — but the response now says so.

```http
GET /audit-logs/export?format=csv          (permission: audit:export)

Content-Type:        text/csv; charset=utf-8
Content-Disposition: attachment; filename="audit-logs-2026-08-15.csv"
X-Export-Total:      501569
X-Export-Returned:   10000
X-Export-Truncated:  true
```

Header row is quoted now, and `created_at` is ISO. Show a warning when `X-Export-Truncated: true`.

### 4.6 Two roles lost audit access (BE-1)

MANAGER and EMPLOYEE now receive `403` on `GET /audit-logs` and `GET /audit-logs/:id`, with
`details.requiredPermission = "audit:read"`. Both the route was gated **and** the key was revoked from
the tenant — the route change alone would not have closed it, since both roles held the key.

Any audit surface rendered for those roles will now be empty. See §9.1 — this interacts with a key
mismatch on your side.

---

## 5. New endpoints

### 5.1 Recruitment export — BE-11

Replaces the placebo button at `RecruitmentScreen.tsx:61`, which today only fires
`toast.success('Export started …')` and downloads nothing.

```http
GET /recruitment/export?type=openings|candidates&status=&stage=&openingId=
Permission: recruitment:read

200 text/csv; charset=utf-8
Content-Disposition: attachment; filename="recruitment-openings-2026-08-15.csv"
```

Columns, RFC-4180 quoted, mirroring the two tables on the screen:

```
openings    Title, Department, Location, Employment Type, Applicants, Current Stage, Status, Posted
candidates  Name, Email, Role, Stage, Rating, Days In Stage, Referral, Applied
```

Empty values render as `—` and booleans as `Yes`/`No`, matching the UI. Dates are `YYYY-MM-DD`.

> `?departmentId` is **not** supported: an opening stores `department` as free text, not a foreign
> key, so there is no id to filter on. Use `?status`, `?stage`, `?openingId`.

### 5.2 Tax-form PDF — BE-5

Replaces `window.print()` at `TaxFormDrawer.tsx:61`.

```http
GET /payroll/employees/:employeeId/tax-forms/:formId/download?format=pdf&fy=2026-27
Permission: payroll:self-read  +  self-or-HR/SA (same rule as the payslip route)

200 application/pdf
Content-Disposition: attachment; filename="tax-form-priya-sharma-fy2026-27.pdf"
403  another employee's form   ·   404  employee has no payroll data
```

`:formId` is the form **type** — `FORM16` | `W2` | `P60` — because there is no `TaxForm` table; a form
is *(type, fiscal year)*. `?fy=` selects the year, defaulting to the current one. The PDF renders the
same `TaxFormDocument` the existing JSON endpoint returns, so drawer and file cannot drift.

### 5.3 Payslip template now flags unrenderable fields — BE-8

`GET /payroll/payslip-templates` gained a per-field `supported` boolean:

```jsonc
{ "fields": [
    { "key": "employeeCode", "label": "Employee ID", "enabled": true,  "supported": true  },
    { "key": "uan",          "label": "UAN",         "enabled": true,  "supported": false }
] }
```

`supported: false` means the renderer has no mapping for that key, so enabling it puts nothing on the
payslip. Show those as unsupported rather than enabled. Renderable keys today: `employeeCode`,
`designation`, `department`, `pan`, `payDate`, `paymentRef`.

### 5.4 `csv` / `CSV` casing aligned

`POST /reports/export` now accepts **both** casings and canonicalises internally. Your eight files
sending `format: 'CSV'` are unaffected. Lowercase is the documented form, matching `POST /export/*`.

---

## 6. BE-2 scoping, exactly

`GET /leave/assignments` is now caller-scoped rather than tenant-wide.

| Caller | Sees | Key |
|---|---|---|
| EMPLOYEE / AUDITOR | own row only | — |
| MANAGER | self + direct reports | `leave:team-read` |
| HR_ADMIN / SUPER_ADMIN | every row | `leave:policy-manage` |

`?employeeId=` still works but can no longer widen scope — targeting someone the caller may not see
returns an empty list rather than their data. Live: 1 / 23 / 138 rows respectively.

Same fix applied to `GET /leave/comp-off/requests?scope=team`, which had the identical leak (a MANAGER
saw every comp-off request in the tenant). **Not in your tracker — we found it while working BE-2.**

---

## 7. Answers to the questions you asked

**BE-8 — is `uan` "skip when null" or a bug?** Neither, and there is no data behind it either.
`renderEmployeeGrid` maps six field keys; `uan` is not one of them, so an enabled `uan` resolves to
`undefined` and is skipped. It would be skipped even with data: `Employee` has no UAN column and
`panNumber` is hardcoded `null` on the payslip, so `pan` is equally dead. Your instinct was right —
an enabled field that silently never renders is a bug. Fixed by exposing `supported` (§5.3). Real
UAN/PAN values are schema work, not a renderer change.

**BE-9(a) — should a manager open their report's profile?** Not intended to be blocked. A manager can
now open a **direct report's** profile, checked against `Employee.managerId`. Anyone else's still
`403`s. Keep linking the rows. Deliberately *not* added to `canAccessEmployeeRecord()`, which also
guards payslips, documents and tax forms — those stay HR/SA-only.

**BE-9(b) — 400 or graceful empty?** Graceful empty, `200 { noEmployeeRecord: true }` (§4.3). Your
changelog was half right: attendance already did this; the dashboard handlers never got it.

**Tier E — which of timesheets / holidays / departments / announcements get exports?** Build
**timesheets** (billable hours and rates, real per-row volume) and **holidays** (small, static, the
thing people actually mail around once a year). Skip **departments** — a flat CSV destroys the
hierarchy that is the point of the screen, and the rollups are already in the analytics exports — and
**announcements**, which is prose in CSV cells. Neither is built; say the word.

---

## 8. Fixed beyond the tracker, and deliberately not done

**Also fixed, same deploy:**

- `GET /leave/comp-off/requests?scope=team` leaked the whole tenant to a MANAGER (§6).
- `GET /payroll/employees/:id/tax-form` had **no ownership check at all** — only `payroll:self-read`,
  so any holder could read anyone's tax form by id. Now self-or-HR/SA.
- Attendance was recording the **wrong day** for tenants with no `TenantConfig` row: the timezone
  resolver documented entity → tenant → UTC but never read `Tenant.timezone`, so it fell to UTC,
  putting every check-in after 18:30 IST on the previous day. Backend-only — the UI never sends a date.

**Deliberately not done:**

- **`?departmentId` on the recruitment export** — no foreign key to filter on (§5.1).
- **Tenant-editable tax-form template** — unlike payslips, no such template exists; the layout is per
  form type in code. Making it editable is a new settings surface.
- **Real UAN / PAN values** — schema work (§7).
- **Tier E exports** — decided, not built (§7).

---

## 9. We tested this as you, before sending it

Pulled `ems-frontend` at `c94ec1a`, read your memory under `docs/context/memory/`, ran `vitest run`,
and — because MSW mocks prove nothing about integration — stood up a **local backend against a local
Postgres** and drove every Accept box through real HTTP with the seeded logins.

```
scripts/probe-ui-contract.mjs     32 passed · 2 failed · 3 skipped
scripts/probe-ui-contract-2.mjs   23 passed · 1 failed · 1 skipped
```

Every failure and skip was chased to ground:

- The **2 failures in pass 1** are the real FE-1 bug (§9.2) — reproduced, not inferred.
- The **1 failure in pass 2** was our probe calling `/employee/check-in`, which is not a route; the
  write path is `/attendance/check-in`, and it correctly returns `400`.
- The **3 skips in pass 1** were missing fixtures. Pass 2 created them through the public API
  (leave packs + auto-assign) and they now pass.
- The **1 skip in pass 2** was a wrong response shape in our probe; retested and passed
  (§below, BE-5 ownership).

That exercise found a **genuine error in this document** — see the correction box in §4.3.

**Three things break or mislead on the UI side. All are one-line FE fixes.**

### 9.1 🔴 `audit-logs:read` is not a real permission key

`src/lib/permissions.ts:27,30` grants `audit-logs:read`. The backend catalogue key is **`audit:read`**.
We diffed all seven keys your `can()` vocabulary uses against our 55-key catalogue — six match, this
one does not exist server-side.

It works *today* only because `can()` falls through to `ROLE_IMPLIED_PERMISSIONS` by role. **The moment
FE-9 gates on `permissions[]`, every audit surface disappears for HR_ADMIN and AUDITOR**, who genuinely
hold `audit:read` — the array will never contain `audit-logs:read`.

Fix: rename to `audit:read` in `permissions.ts` and `ActivityTab.tsx:93`.

### 9.2 🔴 The Employees export button now renders for MANAGER and EMPLOYEE — and 403s

`EmployeeTable.tsx:387` — `const canExport = can(user, 'employees:read')` — and the same key on
`:861`'s `PermissionWrapper`. The export route requires **`employees:export`**.

Your own memory `hr-admin-empty-permissions-locks-core-crud.md` predicted this: it was harmless while
MANAGER/EMPLOYEE had empty `permissions[]`. **BE-4's grant top-up made it certain** — both roles now
carry `employees:read` on `acme-corp-001`, `can()` checks the explicit array first
(`permissions.ts:46`), so the button renders and 403s on click.

This is FE-1 on your list. Our change promoted it from latent to live — worth doing first.

Fix: `employees:export` at both sites.

### 9.3 🟠 Nothing handles `noEmployeeRecord`

No occurrence of `noEmployeeRecord` or `NO_EMPLOYEE_RECORD` anywhere in `src/`. Those five reads
previously threw into your error path; they now return `200` with an otherwise-empty payload, so
SUPER_ADMIN will get blank widgets rather than an empty state. Add the branch (§4.3).

### 9.4 ✅ Confirmed safe

- **`file_url`** — nothing in `src/` reads it from the export list; the only `fileUrl` hits are
  employee documents, unrelated. No breakage.
- **`format: 'CSV'`** — eight files send uppercase; the backend accepts both. No breakage.
- **Job CSV parsing** — you don't consume `GET /export/list` or the job download anywhere, so the
  column changes in §4.4 hit nothing today. They matter when FE-5 lands.
- **Your test suite** — at its documented baseline against this backend, no new failures.

### 9.5 What the local run proved, item by item

Real HTTP, local backend, seeded database — not static analysis:

```
BE-1   EMPLOYEE 403 · MANAGER 403 · both with requiredPermission=audit:read · HR/SA 200
BE-2   EMPLOYEE 1 of 59 · MANAGER 20 of 59 · HR 59 · ?employeeId= leaked 0 rows
BE-4   all 7 gated routes reachable for MANAGER+EMPLOYEE · grants present (21 / 12 keys)
BE-3   200, own jobs only, no file_url in any row
BE-5   own 200 %PDF- · another employee's 403 · HR on any 200
BE-6   auditor@acme.test 200 · exactly 12 keys · can read audit logs
BE-7   payslip 200 %PDF- · NotoSans embedded · U+20B9 present in the ToUnicode map
BE-9a  MANAGER on own report 200 · on a stranger 403
BE-9b  4 read paths 200 noEmployeeRecord · both writes 400 NO_EMPLOYEE_RECORD
BE-10  text/csv; charset=utf-8 · employees-2026-08-15.csv · quoted header · no GMT
       no duplicate department.id · no trailing row · audit export sends X-Export-*
BE-11  200 text/csv · recruitment-openings-2026-08-15.csv · quoted header
```

BE-7 is worth calling out: rather than just checking the font is embedded, the probe decompresses the
PDF streams and looks for `U+20B9` in the ToUnicode CMap — which is the glyph→Unicode map for text
actually drawn on the page. The rupee is genuinely rendered, not merely available.

### 9.6 Verdict

**Backend: yes, all eleven are done, and 35/35 accept checks pass live.** The deviations in §8 are
real and documented rather than hidden — check them before you sign off.

**Frontend: not yet safe to call this shipped end-to-end.** §9.1 will silently break audit UI the day
FE-9 lands, and §9.2 is already wrong on production right now. Neither is a backend defect; both are
consequences of the backend finally enforcing what the contract always said.

---

## 10. Your queue, updated

| ID | Item | Now |
|---|---|---|
| FE-1 | `employees:export` key fix | 🔴 **Do first** — now actively wrong in production (§9.2) |
| — | `audit-logs:read` → `audit:read` | 🔴 **New** — blocks FE-9 correctness (§9.1) |
| — | `noEmployeeRecord` empty state | 🟠 **New** — five endpoints changed status (§9.3) |
| FE-9 | Permission-based nav filtering | ✅ Unblocked — Option A, gate on `permissions[]` |
| FE-10 | Recruitment Export button | ✅ Wire it — don't delete it, the endpoint exists (§5.1) |
| FE-11 | Tax-form PDF download | ✅ Unblocked (§5.2) |
| FE-6 | Payslip blob download | ✅ Unblocked — `PayslipDrawer.tsx:94` still calls `window.print()` |
| FE-8 | 55-row permissions matrix | ⚠️ Recheck — BE-4 changed which routes enforce; catalogue is 55 keys |
| FE-5 | Three client CSVs → our endpoints | Unchanged — those endpoints were already correct |
| FE-2/3/4/7 | SSE, EventSource, bell, `ids[]` | No backend change |

---

## 11. Open questions for you

**Custom roles: replace or add?** Assigning a custom role currently *unions* with the user's existing
role links — that is what ships, and a test pins it deliberately. A sibling test assumed it *replaces*.
If replace is intended, the fix belongs in `POST /settings/roles/:key/users`. We did not decide it.

**`note` vs `notes` on check-in.** `CheckInInput` (`attendance.types.ts:65`) declares `notes`; our
`checkInSchema` expects `note`. Unknown keys are stripped silently, so a note typed at check-in would
vanish with no error. **Nothing is broken today** — no call site passes it — but whoever wires that
field next loses the data. We'll accept both if you'd rather not touch the type.

---

*Backend team · verified against `ems-api.saqibsaeed.cloud` on 15 August 2026 ·
tracker: `docs/BACKEND_IMPLEMENTATION_SPEC_2026-08-13.md`*
