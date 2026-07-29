# BE → FE — Configurable RBAC + server-side exports are live

> **Date:** 2026-07-29
> **Status:** ✅ implemented, deployed, live-verified on `https://ems-api.saqibsaeed.cloud`
> **Answers:** `BACKEND_CONTRACT_configurable_rbac.md`, `BACKEND_CONTRACT_server_side_exports.md`, `ROLE_ACCESS_AUDIT.md`
> **Commits:** `4d06e2f`, `4c9fd27`

Both contracts are done. This document is everything you need to build against them:
what changed, the decisions we made on your open questions, every new endpoint with
request/response shapes, and the three things that require action on your side.

---

## 0. TL;DR — what changed for you

1. **Permissions are now real.** Editing Settings → Roles & Permissions genuinely changes
   what the API allows, across the whole product. Previously it governed ~4 routes.
2. **The catalogue grew 14 → 55 keys.** `PermissionsMatrix.tsx` must render an
   arbitrary-length list (§7.1).
3. **Five new endpoints** for exports, including the payslip PDF that previously didn't
   exist server-side.
4. **Two findings in your audit were incorrect** — please don't build around them (§2).
5. **One live bug in your code** that we can see from the API side (§7.2).

---

## 1. Answers to your open questions

| Your question | Decision | Consequence for FE |
|---|---|---|
| **AUDITOR** — payroll self-service? (Finding B) | ✅ **Granted** `payroll:self-read` | `MyPayslipsPage` redirect for AUDITOR is now valid — no 403 |
| **AUDITOR** — timesheets? (Finding C) | ✅ **Granted** `timesheets:read` only, **not** write | Your existing `canWriteRole !== 'AUDITOR'` logic is now correct and usable |
| **AUDITOR** — analytics? (Finding E) | ✅ **Granted** `analytics:read`, now actually enforced | You may widen the `/analytics` RoleGate to include AUDITOR if you want |
| **SUPER_ADMIN** settings/reports carve-outs (Findings D, F) | **Not a real restriction — see §2** | **No FE change needed.** Do not add special-casing |
| **Custom roles** — replace or layer? | **Replace** | Present as "this role defines the user's full access", not "adds to" |
| **Billing invoices CSV** — server-side? | ✅ **Yes, moved server-side** | Swap `exportCsv()` for the endpoint in §5.4 |
| **Employees export** — keep both paths? | **Deprecate the old pair** | Standardise on `POST /export/employees`, now with `ids[]` |
| **Payslip PDF** — sync or async job? | **Synchronous download** | Single URL change, no job polling |

---

## 2. ⚠️ Findings D and F are incorrect — no FE work needed

Your audit says SUPER_ADMIN gets 403 on `PATCH /settings/tenant`,
`PATCH /settings/email-templates/:type`, and five `/reports/scheduled*` routes,
and recommends hiding the Save button or adding a narrower gate.

**That was never true.** `authorize()` has always had an unconditional bypass:

```js
// src/middleware/authenticate.js
export function authorize(allowedRoles = []) {
  return async (request, reply) => {
    const memberType = request.user?.memberType;
    if (memberType === 'SUPER_ADMIN') return;   // ← never reached the role check
```

So `authorize(['HR_ADMIN'])` always admitted SUPER_ADMIN. (Your doc actually quotes this
bypass in Gap C, then contradicts it in Findings D/F.)

**Verified live:** SUPER_ADMIN returns `200` on `/settings/tenant` today.

➡️ **Action: none.** Do not hide the Save button; do not add a scheduled-reports sub-gate.

---

## 3. How authorization works now

### 3.1 The JWT carries a real permission list

Every login/refresh mints `permissions[]`. Live counts on the `acme-corp-001` tenant:

| Role | Keys |
|---|---|
| SUPER_ADMIN | 55 (all) |
| HR_ADMIN | 52 |
| MANAGER | 22 |
| EMPLOYEE | 13 |
| AUDITOR | 12 |

Resolution order:
1. If the user has **custom-role grants**, those are their permissions **entirely** (replace).
2. Otherwise the `memberType` default matrix applies.

> **Stale-token behaviour is unchanged and intentional:** after
> `PATCH /settings/roles-permissions`, existing sessions keep their old `permissions[]`
> until refresh or re-login.

### 3.2 Denial shapes — distinguish these two

A **permission** denial always carries `requiredPermission`:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this action",
    "details": { "requiredPermission": "assets:export", "userRole": "EMPLOYEE" },
    "requestId": "a450c38e-…"
  }
}
```

An **ownership** denial (e.g. reading someone else's payslip) does **not**:

```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Access denied", "details": {} } }
```

➡️ Use `error.details.requiredPermission` to decide the message. Present the first as
"your role doesn't allow this" and the second as "this isn't your record."

Unauthenticated:

```json
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Missing access token", "details": {} } }
```

### 3.3 Two surfaces stay role-bound by design

`/ops/*` (SUPER_ADMIN only) and the Manager Dashboard are **not** tenant-customizable —
per contract §3.2, ops access shouldn't be reconfigurable, and the manager dashboard needs
the caller's own `employeeId`. Everything else is permission-driven.

---

## 4. The permission catalogue (55 keys)

| Module | Keys |
|---|---|
| employees | `read`, `read-any` ★, `write`, `delete`, `export` |
| departments | `read`, `write` |
| attendance | `read`, `write`, `team-read` ★, `approve`, `export` |
| leave | `read`, `request`, `team-read` ★, `approve`, `manage-types`, `policy-manage`, `export` |
| holidays | `read`, `write` |
| payroll | `admin`, `super`, `self-read`, `approve`, `export` |
| payout | `self`, `manage` |
| reports | `read`, `schedule` |
| analytics | `read` |
| permissions | `manage` |
| settings | `tenant-write`, `manage`, `security`, `integrations` |
| recruitment | `read`, `write` |
| performance | `read`, `manage`, `export` |
| assets | `manage`, `export` |
| announcements | `read`, `write`, `admin` |
| timesheets | `read`, `write`, `approve`, `admin` |
| audit | `read`, `export` |
| billing | `read`, `export` |
| logs | `read` |

★ = added beyond your proposal, because the contract's list conflated two different things:

- **`attendance:team-read` / `leave:team-read`** — viewing the *team* list is not the same
  capability as *approving*. Overloading `:approve` would have meant a tenant couldn't grant
  a manager read-only visibility of their team.
- **`employees:read-any`** — "view any employee's record/documents/photo", distinct from
  `employees:read`. Every role has `employees:read`; only HR/SA have `read-any`.

`payroll:approve` now exists server-side, so the key your FE invented is real
(`ROLE_ACCESS_AUDIT.md` Finding K).

---

## 5. New endpoints

All require `Authorization: Bearer <token>`. `x-tenant-key` only if the JWT lacks `tenantId`.

### 5.1 Payslip PDF — the big one

Replaces `window.print()` in `PayslipDrawer.tsx`.

```http
GET /payroll/employees/:employeeId/payslips/:payslipId/download?format=pdf
GET /payroll/runs/:runId/payslips/:payslipId/download?format=pdf
```

| | |
|---|---|
| **Permission** | `payroll:self-read` (employee-scoped) · `payroll:admin` (run-scoped) |
| **Extra rule** | Employee-scoped is **self-or-HR/SA** — same as the existing detail routes |
| **Response** | `200` `Content-Type: application/pdf` (binary body, **not** JSON) |
| **Filename** | `Content-Disposition: attachment; filename="payslip-priya-sharma-2026-07.pdf"` |
| **Errors** | `403` (see §3.2) · `404 NOT_FOUND` |

```ts
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) throw new Error((await res.json()).error.message);
const blob = await res.blob();               // do NOT res.json()
```

The PDF honours the tenant's payslip template exactly as the drawer does — section
enable + order, header field enable + order, and locale. If a tenant disables Earnings,
it's absent from the PDF too. Verified live against real payroll data.

> **Known cosmetic difference:** amounts render as `INR 50,000.00`, not `₹50,000.00`.
> PDFKit's built-in font is WinAnsi-encoded and cannot draw `₹` (U+20B9), so we fall back
> to the ISO code for any currency whose symbol is outside that range. Tell us if symbol
> parity matters and we'll embed a Unicode font.

### 5.2 Performance export

```http
GET /performance/export?type=reviews|goals&status=&departmentId=
```

`performance:export` · `200 text/csv; charset=utf-8`

`performance-reviews.csv`:
```csv
"Employee","Department","Reviewer","Self Complete","Manager Complete","Status","Rating"
"Priya Sharma","Engineering","Aman Gupta","Yes","No","IN_PROGRESS","4"
"Dev One","Finance","—","No","No","PENDING","—"
```

`performance-goals.csv`:
```csv
"Employee","Goal","Progress %","Due Date","Status"
"Priya Sharma","Ship payroll v2","60","2026-09-30","ON_TRACK"
```

Calibration has no export, as you specified.

### 5.3 Assets export

```http
GET /assets/export?type=&status=
```

`assets:export` · `assets-inventory.csv`

```csv
"Tag","Name","Type","Status","Assigned To","Since"
"LAP-001","MacBook Pro 14","LAPTOP","ASSIGNED","Priya Sharma","2026-03-01"
"MON-014","Dell U2720Q","MONITOR","AVAILABLE","—","—"
```

### 5.4 Billing invoices export

```http
GET /billing/invoices/export
```

`billing:export` · `invoices-{yyyy-MM-dd}.csv`

```csv
"Invoice #","Description","Date","Due Date","Period","Amount","Status"
"INV-2026-005","Professional Plan — May 2026","2026-05-01","2026-05-07","2026-05-01 to 2026-05-31","999 INR","paid"
```

### 5.5 Employees export — `ids[]` for bulk selection

```http
POST /export/employees
{ "format": "csv", "ids": ["emp_1", "emp_2"], "department_id": "…", "status": "ACTIVE", "include_archived": false }
```

`ids[]` is optional; omit for a full export. Response is the existing `202` job envelope —
poll `GET /export/:job_id/download` as today.

➡️ **`POST /employees/bulk/export` and `GET /employees/export/csv` are deprecated.**
They still work; please migrate.

### 5.6 Export permission keys renamed

| Endpoint | Was | Now |
|---|---|---|
| `POST /export/attendance` | `employees:export` | **`attendance:export`** |
| `POST /export/leave` | `employees:export` | **`leave:export`** |
| `GET /export/:job_id/download` | `employees:export` | any of the three |

**All CSV exports** return `Content-Type: text/csv; charset=utf-8` with a
`Content-Disposition` filename. Every value is quoted; embedded quotes are doubled
(RFC 4180). `—` (em dash) marks an empty value, matching your UI.

---

## 6. `GET /settings/roles-permissions` — unchanged shape, more rows

```json
{
  "success": true,
  "data": {
    "roles": ["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE", "AUDITOR"],
    "permissions": ["analytics:read", "announcements:admin", "…55 total, sorted"],
    "matrix": { "SUPER_ADMIN": ["employees:read", "…"], "HR_ADMIN": ["…"] },
    "customRoles": []
  }
}
```

`PATCH /settings/roles-permissions` is unchanged. `permissions:manage` is required, and
`roleKey: "SUPER_ADMIN"` still rejects with `CANNOT_LOCK_OUT_SUPER_ADMIN`.

---

## 7. Three things needing FE action

### 7.1 `PermissionsMatrix.tsx` must handle 55 rows
It was built against 14. Please confirm it renders an arbitrary-length list — grouping by
the `module:` prefix will read better than one flat list.

### 7.2 🐛 The Export button will now leak to MANAGER and EMPLOYEE
This is your audit's **Finding A**, and it is now live:

```ts
// src/modules/employees/components/EmployeeTable.tsx:387
const canExport = can(user, 'employees:read');   // ← wrong key
```

Both MANAGER and EMPLOYEE hold `employees:read`, so the button renders for them. Clicking
it 403s (no data leaks), but it looks broken. **One-line fix: `'employees:export'`.**

### 7.3 Nav filtering can now use permissions
`AppShell.tsx`'s `NAV_ITEMS` has no role filter. Now that keys are stable, gate on
`can(user, key)` rather than `memberType` literals. Suggested: Reports → `reports:read`,
Analytics → `analytics:read`, Assets → `assets:manage`, Performance → `performance:read`,
Timesheets → `timesheets:read`, Payroll admin → `payroll:admin`, Permissions → `permissions:manage`.

---

## 8. Live verification

Real logins against production, all four seeded roles:

| Route | Key | SA | HR | MGR | EMP |
|---|---|---|---|---|---|
| `/analytics/summary` | `analytics:read` | 200 | 200 | 403 | 403 |
| `/reports/attendance` | `reports:read` | 200 | 200 | 403 | 403 |
| `/assets/export` | `assets:export` | 200 | 200 | 403 | 403 |
| `/performance/summary` | `performance:read` | 200 | 200 | **200** | 403 |
| `/performance/export` | `performance:export` | 200 | 200 | 403 | 403 |
| `/billing/invoices/export` | `billing:export` | 200 | 200 | 403 | 403 |
| `/timesheets/approvals` | `timesheets:approve` | 200 | 200 | **200** | 403 |
| `/settings/security/auth` | `settings:security` | 200 | **403** | 403 | 403 |
| `/settings/roles-permissions` | `permissions:manage` | 200 | **403** | 403 | 403 |
| `/settings/tenant` | `settings:manage` | **200** | 200 | 403 | 403 |
| `/employees`, `/holidays` | `*:read` | 200 | 200 | 200 | 200 |

Every 403 carried `requiredPermission`, i.e. the permission layer decided it.

Payslip PDF verified live on real payroll data: both endpoints `200`, correct filename,
correct totals.

**Test suite: 395 green** (303 without a database, 92 against Postgres).

---

## 9. Migration is behaviour-preserving

Only **20** role/route combinations changed, all of them the AUDITOR grants you asked for
(payroll self-service ×16, timesheets ×4). **No role lost access to anything.** A boot-time
sync tops up every tenant's permission rows on deploy, so no tenant is left on a stale set.

---

## 10. Questions for you

1. **Payslip currency symbol** — is `INR 50,000.00` acceptable, or should we embed a font for `₹`?
2. **AUDITOR analytics** — now that it's enforced, do you want to widen the `/analytics` RoleGate?
3. **Performance/Assets employee self-service** — still doesn't exist (audit Finding G). Product decision needed before we build it.
4. **`recruitment` write keys** — `PATCH /recruitment/candidates/:id/rating` is gated by
   `recruitment:read` because that mirrors its previous `HR_MANAGER` membership exactly.
   Semantically it's a write; we kept behaviour identical rather than guess. Want us to split it?
