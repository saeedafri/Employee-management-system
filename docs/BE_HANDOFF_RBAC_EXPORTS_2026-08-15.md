# Backend → Frontend handoff — RBAC, exports & downloads

**15 August 2026** · Tracker: `BACKEND_IMPLEMENTATION_SPEC_2026-08-13.md` (BE-1 … BE-11)

Every item is implemented, deployed and verified against production. This is what changed,
what breaks on your side, and what is still open.

---

## Verified on production, not just locally

`scripts/verifyTrackerAccepts.mjs` checks every **Accept** box on the tracker against
`https://ems-api.saqibsaeed.cloud` with real logins for all five roles. It runs as the last step of
every deploy, so a regression fails the deploy rather than reaching you.

| | |
|---|---|
| Live accept checks | **35 / 35** |
| Offline tests | **361 / 361** |
| Database tests | **103 / 103** |
| Deploy run | `31878368975` |

```
# the two P0s, checked live as the seeded accounts
PASS  BE-1  priya@acme.test → GET /audit-logs   403  requiredPermission=audit:read
PASS  BE-1  aman@acme.test  → GET /audit-logs   403
PASS  BE-1  hr@ / superadmin@               still 200
PASS  BE-2  EMPLOYEE 1 employee · MANAGER 23 (their team) · HR_ADMIN 138 rows
```

---

## What shipped

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

**You were right on all eleven.** Every finding reproduced in our source. Three had details worth
correcting, called out below — none of them changed the verdict.

---

## ⚠️ Breaking changes — read this part

Six responses changed shape or status. Nothing here is optional; these are live now.

### 1. Permission keys are enforced (BE-4, Option A)

Thirteen routes across Employees, Departments, Leave and Attendance now return `403` without the key.
**You can gate the sidebar on `permissions[]` — FE-9 is unblocked.**

| | |
|---|---|
| Was | `GET /employees` → 200 for everyone (nothing checked) |
| Now | `GET /employees` → requires `employees:read` |

Two corrections to your premise, both of which made this safer than you expected:

1. All six keys **were already** in the MANAGER and EMPLOYEE default matrix. The live token lacked
   them because `acme-corp-001` carries a saved role customization, and the default fallback only
   applies when `permissions[]` is empty. A fresh tenant would never have hit this.
2. Your grant list was missing **`attendance:read`** — `/attendance/records`, `/summary` and
   `/calendar` need it.

Both roles were topped up before the gates went live, and the reconcile now runs on every deploy
before cutover.

### 2. `file_url` is gone from the export list (BE-3)

`GET /export/list` returns only the caller's own jobs unless they hold `employees:export`,
`attendance:export` or `leave:export` — and the storage path is no longer in the payload. If anything
reads `file_url` from the list it now reads `undefined`. Use `GET /export/:job_id/download`, which
resolves it behind the permission check.

### 3. Personal reads return 200, not 400 (BE-9b)

| | |
|---|---|
| Was | `400 NO_EMPLOYEE_RECORD` |
| Now | `200 { data: { noEmployeeRecord: true } }` |

Applies to `/employee/dashboard`, `/attendance/today`, `/employee/balance`, `/employee/documents`,
`/employee/team`. Branch on `data.noEmployeeRecord`.

**Writes are unchanged** — `check-in` and `check-out` still `400`, because there is nothing to write
against.

### 4. Job-based CSV downloads changed shape (BE-10)

Your diagnosis pointed at the header code; the actual cause was the `302` to the Cloudinary signed
URL, which serves raw assets as `application/octet-stream` named `file` — our headers never reached
the browser. The bytes are proxied now.

| | |
|---|---|
| Was | `application/octet-stream` · `filename="file"` |
| Now | `text/csv; charset=utf-8` · `employees-2026-08-15.csv` |

Body changes too: every value quoted (RFC 4180), dates as `YYYY-MM-DD` instead of `Date.toString()`,
the duplicate `department.id` column dropped, and no trailing empty row. **Any parser pinned to the
old column count needs a look.**

### 5. Audit export now reports truncation (BE-10b)

The 10,000-row cap stays — streaming 501,569 rows would buffer ~100 MB — but the response now says so:

```
X-Export-Total:      501569
X-Export-Returned:   10000
X-Export-Truncated:  true
```

### 6. Two roles lost audit access (BE-1)

MANAGER and EMPLOYEE now get `403` on `GET /audit-logs` and `/audit-logs/:id`, with
`details.requiredPermission = "audit:read"`. Both keys were revoked from the tenant as well as the
route being gated — the route change alone would not have closed it, since both roles held the key.
**Any audit surface shown to those roles will now be empty.**

---

## New endpoints

```
// BE-11 — replaces the placebo Export button at RecruitmentScreen.tsx:61
GET /recruitment/export?type=openings|candidates&status=&stage=&openingId=
    → 200 text/csv; charset=utf-8
    → recruitment-openings-2026-08-15.csv    // RFC-4180 quoted
    → permission: recruitment:read

// BE-5 — replaces window.print() at TaxFormDrawer.tsx:61
GET /payroll/employees/:employeeId/tax-forms/:formId/download?format=pdf
    → 200 application/pdf
    → tax-form-priya-sharma-fy2026-27.pdf
    → :formId is the form TYPE (FORM16 | W2 | P60); ?fy= picks the year
    → permission: payroll:self-read + self-or-HR/SA · 403 · 404
```

There is no `TaxForm` table — a form is *(type, fiscal year)*, which is why `:formId` is the type.
The PDF renders the same `TaxFormDocument` the JSON endpoint already returns, so the drawer and the
file cannot drift.

---

## Your queue, updated

| ID | Item | Now |
|---|---|---|
| FE-9 | Permission-based nav filtering | ✅ **Unblocked** — Option A, gate on `permissions[]` |
| FE-10 | Recruitment Export button | ✅ **Wire it** — don't delete it, the endpoint exists |
| FE-11 | Tax-form PDF download | ✅ Unblocked |
| FE-6 | Payslip blob download | ✅ Unblocked — `PayslipDrawer.tsx:94` still calls `window.print()` |
| FE-5 | Three client-side CSVs → our endpoints | Unchanged — endpoints were already correct |
| FE-8 | 55-row permissions matrix | ⚠️ **Recheck** — BE-4 changed which routes enforce |
| FE-1..4, 7 | Export key, SSE, EventSource, bell, `ids[]` | No backend change |

---

## Fixed beyond the tracker

Found while working the queue. Same production, same deploy.

- **A second leak of the BE-2 shape.** `GET /leave/comp-off/requests?scope=team` dropped the employee
  filter entirely, so a MANAGER saw every comp-off request in the tenant rather than their own
  reports'. Scoped with the same helper.
- **Tax forms had no ownership check at all.** `GET /payroll/employees/:id/tax-form` checked only
  `payroll:self-read`, so any holder could read anyone's tax form by id. Now self-or-HR/SA, matching
  the payslip rule.
- **Attendance was recording the wrong day for some tenants.** The employee-timezone resolver
  documented its chain as entity → tenant → UTC but never read `Tenant.timezone`, so a tenant with no
  `TenantConfig` row silently fell to UTC — putting every check-in after 18:30 IST on the previous
  day. Backend-only; the UI never sends a date.
- **`csv` vs `CSV`.** `POST /reports/export` now accepts both and canonicalises internally, so callers
  sending `"CSV"` are unaffected. Lowercase is the documented form, matching `POST /export/*`.

---

## Not done — so nobody is surprised

All eleven items are closed, but three carry deviations from the letter of the request.

- **`?departmentId` on the recruitment export — not supported.** An opening stores `department` as
  free text, not a foreign key, so there is no id to filter on. `?status`, `?stage` and `?openingId`
  work.
- **Tenant-editable tax-form template — does not exist.** Unlike payslips there is no tenant-editable
  tax-form template; the layout is per form type in code. The PDF honours that. Making it editable is
  a new settings surface, not part of this route.
- **Real UAN / PAN values — schema work.** `Employee` has no UAN column and `panNumber` is hardcoded
  `null` on the payslip. The template response now carries `supported: <bool>` per field so your
  settings UI can show unrenderable fields as unsupported instead of enabled-and-silent.
- **Tier E exports — decided, not built.** Build **timesheets** (billable hours and rates, real
  volume) and **holidays** (small, static, genuinely mailed around). Skip **departments** — a flat CSV
  destroys the hierarchy that is the point of the screen — and **announcements**, which is prose in
  CSV cells. Say the word and we'll build the two.

---

## Open questions for you

**Custom roles: replace or add?** Assigning a custom role currently *unions* with the user's existing
role links — that is what ships, and a test pins it deliberately. A sibling test assumed it
*replaces*. If replace is the intent, the fix belongs in `POST /settings/roles/:key/users`. We did not
decide this for you.

**`note` vs `notes` on check-in.** `CheckInInput` declares `notes`; our `checkInSchema` expects
`note`. Unknown keys are stripped silently, so a note typed at check-in would vanish with no error.
**Nothing is broken today** — no call site passes it — but whoever wires that field next loses the
data. We'll accept both if you'd rather not touch the type.

---

## Re-verify it yourself

Don't take this page's word for it. One command runs the same 35 checks your probes cover:

```bash
node scripts/verifyTrackerAccepts.mjs

# or point it anywhere
API_BASE=https://ems-api.saqibsaeed.cloud/api/v1 node scripts/verifyTrackerAccepts.mjs
```

New this cycle: CI had drifted to running **no tests at all** — the database test job was missing from
`ci.yml`, so 350+ tests hadn't run on push. It's restored and green, and the deploy now asserts the
running container actually carries the deployed commit before reporting success.

---

*Backend team · verified against `ems-api.saqibsaeed.cloud` on 15 August 2026*
