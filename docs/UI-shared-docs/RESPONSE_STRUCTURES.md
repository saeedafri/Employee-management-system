# Response Structures — Bank/Payout + MFA contracts

> Captured from **live** `https://ems-api.saqibsaeed.cloud/api/v1` on 2026-06-27.
> All shapes below are real responses, not specs. camelCase throughout.

## Envelope (every endpoint)

```jsonc
// success
{ "success": true, "data": <payload>, "meta": {} }

// error
{ "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [ { "field": "label", "message": "Label is required (1–60 characters)" } ], // optional
    "requestId": "…"
  } }
```

`details` is present only for `422 VALIDATION_ERROR` (array of `{field, message}`). For other errors `details` is omitted or `{}`.

---

# 1. MFA contract (`MFA_BACKEND_REQ.md`)

### `GET /auth/me`  → 200
Two new fields on `data` (everything else unchanged):

```jsonc
{
  "success": true,
  "data": {
    "id": "…",
    "email": "hr@acme.test",
    "memberType": "HR_ADMIN",
    "tenantId": "…",
    "employeeId": "…",
    "status": "ACTIVE",
    "employee": { /* …full employee object… */ },
    "permissions": ["…"],
    "lastLoginAt": "2026-06-27T…Z",
    "mfaEnabled": false,            // ← NEW: the user's own opt-in (boolean, never null)
    "mfaRequiredByPolicy": false    // ← NEW: does tenant policy force MFA on this user (boolean)
  },
  "meta": {}
}
```

### `PATCH /auth/me/mfa`  body `{ "enabled": true }` → 200
```jsonc
{ "success": true, "data": { "mfaEnabled": true }, "meta": {} }
```

### MFA login challenge (the actual OTP flow — verified live)
`POST /auth/login` when the user has `mfaEnabled` or is forced by policy → **202**:
```jsonc
{ "success": true,
  "data": {
    "mfaRequired": true,
    "challengeId": "5073d412-…",
    "destinationMasked": "m****************9@gmail.com",
    "expiresIn": 600
  } }
```
Then `POST /auth/verify-otp` body `{ "challengeId", "code" }` (code = 6 digits) → 200 with the normal login payload (`data.accessToken`, `data.user`, refresh cookie). Non-MFA login returns 200 with tokens directly (no `mfaRequired`).

---

# 2. Bank / Payout contract (`BANK_PAYOUT_BACKEND_CONTRACT.md`)

### Masking rule (important for the UI)
- **Lists** (`/me/payout-methods`, `/employees/:id/payout-methods`) and any **non-owner** read return identifiers **masked** (all-but-last-4 → `X`), e.g. `"accountNumber": "XXXXXXXXX7890"`.
- The **owner** sees **full** `details` only on **create response** and **single GET of their own method**.
- `maskedTail` (last 4) is **always present** regardless.

### `GET /payroll/countries` → 200
```jsonc
{ "success": true,
  "data": [
    { "code": "AD", "name": "Andorra", "currency": "EUR", "locale": "en-AD", "fiscalYearStartMonth": 1 }
    /* …249 entries… */
  ], "meta": {} }
```

### `GET /payroll/countries/:code/bank-schema` → 200
Never 404s — falls back to a generic IBAN schema for unknown countries.
```jsonc
{ "success": true,
  "data": {
    "country": "IN",
    "currency": "INR",
    "fields": [
      { "key": "accountName", "type": "text", "label": "Account holder name", "required": true },
      { "key": "accountNumber", "type": "text", "label": "Account number",
        "regex": "^[0-9X]{9,18}$", "example": "1234567890", "required": true },
      { "key": "ifsc", "type": "text", "label": "IFSC code",
        "regex": "^[A-Z]{4}0[A-Z0-9]{6}$", "example": "HDFC0001234", "required": true },
      { "key": "bankName", "type": "text", "label": "Bank name", "example": "HDFC Bank", "required": false }
    ]
  }, "meta": {} }
```
Field object keys: `key, type, label, required` always; `regex, example, checksumType` ("IBAN" | "ABA") optional.

### The PayoutMethod object (returned by list/get/create/archive/verify)
```jsonc
{
  "id": "cmqw4xhxy000484vx9nvplurf",
  "employeeId": "…",
  "type": "BANK",                      // BANK | … (PayoutMethodType)
  "country": "IN",
  "currency": "INR",
  "rail": "BANK_LOCAL",                // PayoutRail
  "label": "Salary account",
  "holderName": "",
  "details": { "accountNumber": "XXXXXXXXX7890", "ifsc": "SBIN0001234", "bankName": "SBI" }, // masked in lists; full for owner create/get
  "maskedTail": "7890",                // always present
  "isPrimary": true,
  "lifecycleStatus": "ACTIVE",         // PENDING_APPROVAL | ACTIVE | ARCHIVED
  "verificationStatus": "UNVERIFIED",  // UNVERIFIED | VERIFIED | FAILED
  "approval": { "requestedBy": "system", "requestedAt": "…Z", "reviewedBy": "system", "reviewedAt": "…Z" },
  "effectiveFrom": "2026-01-01",
  "createdAt": "…Z",
  "updatedAt": "…Z",
  "supersededById": null
}
```

### `GET /payroll/me/payout-methods` · `GET /payroll/employees/:employeeId/payout-methods` → 200
```jsonc
{ "success": true, "data": { "methods": [ /* PayoutMethod… */ ] }, "meta": {} }
```

### `POST /payroll/employees/:employeeId/payout-methods` → 201
Creates `lifecycleStatus: "PENDING_APPROVAL"` + enqueues an approval. Owner-creator gets **full** `details` in the response; HR-on-behalf gets masked.
```jsonc
{ "success": true, "data": { /* PayoutMethod, lifecycleStatus:"PENDING_APPROVAL" */ }, "meta": {} }
```

### `POST /payroll/payout-methods/:id/set-primary` → 202
Enqueues a "make primary" approval (returns the pending approval/method).

### `POST /payroll/payout-methods/:id/archive` → 200
Soft-delete → `lifecycleStatus: "ARCHIVED"` (drops out of active lists; history kept).

### `GET /payroll/payout-methods/approvals?status=PENDING` → 200 (HR/SUPER)
```jsonc
{ "success": true,
  "data": {
    "items": [
      { "id": "…", "kind": "METHOD_ADD",        // METHOD_ADD | SET_PRIMARY | …
        "employeeId": "…", "employee": { "id": "…", "name": "HR Smoke" },
        "summary": "Add Smoke test account (INR)",
        "requestedBy": "…", "requestedAt": "…Z",
        "diff": { "label": "Smoke test account", "maskedTail": "2345", "makePrimary": false },
        "methodId": "…" }
    ],
    "pagination": { "page": 1, "pageSize": 50, "total": 1 }
  }, "meta": {} }
```

### `POST /payroll/payout-methods/approvals/:id/approve` → 200
Approves → underlying method becomes `ACTIVE`. **Maker ≠ checker**: approving your own request → `403 SELF_APPROVAL_FORBIDDEN`.

### `POST /payroll/payout-methods/approvals/:id/reject` → 200
Body `{ "note": "…" }` **required** — empty/missing note → `422 VALIDATION_ERROR` (`field: "note"`).

### `GET /payroll/payout-methods/unverified` · `POST /payroll/payout-methods/:id/verify` → 200 (HR/SUPER)
Verify body `{ "result": "VERIFIED" | "FAILED", "note"? }`. Only an `ACTIVE` method can be verified → otherwise `409 NOT_ACTIVE`. Response is the updated PayoutMethod with new `verificationStatus`.

### Catalog (SUPER_ADMIN) — `GET /payroll/country-bank-schemas` → 200
`data` is an **array** of catalog items:
```jsonc
{ "country": "AE", "currency": "AED",
  "fields": [ { "key": "iban", "type": "text", "label": "IBAN",
               "regex": "^AE[0-9]{21}$", "example": "AE0703…", "required": true, "checksumType": "IBAN" }, … ],
  "updatedAt": "2026-01-01T00:00:00.000Z", "updatedBy": "system" }
```
Single: `GET /payroll/country-bank-schemas/:country`. Mutations: `POST` / `PATCH /:country` / `DELETE /:country`.

### Error codes seen
| HTTP | code | when |
|---|---|---|
| 400 | `NO_EMPLOYEE_RECORD` | `/me/payout-methods` when the caller has no linked employee |
| 403 | `FORBIDDEN` | acting on another employee's methods without HR/SUPER |
| 403 | `SELF_APPROVAL_FORBIDDEN` | approving your own request |
| 404 | `NOT_FOUND` | unknown method/approval id |
| 409 | `NOT_ACTIVE` | verifying a non-ACTIVE method |
| 422 | `VALIDATION_ERROR` | bad body — `details: [{field,message}]` |

---

# 3. BACKEND_ISSUES fixes (2026-06-28) — live-verified

> Five issues the UI team raised in `BACKEND_ISSUES.md` + `EMPLOYEE_TAX_BACKEND_CONTRACT.md`. All fixed, deployed (commits `e9f5a04`, `a035350`), and verified on live.

## Issue 1 — `POST /leave/requests` accepts the policy leave **code**

For policy-driven (ledger) tenants the FE only has the code (`EL`/`SL`/`CL`/`CO`), not a `LeaveType.id`. `leaveTypeId` now accepts **either**.

```jsonc
// Request
{ "leaveTypeId": "EL", "startDate": "2026-07-01", "endDate": "2026-07-03", "reason": "Family vacation" }

// 201 → the created LeaveRequest (ledger tenants also post a LEAVE_PENDING_HOLD txn)
{ "success": true, "data": {
    "id": "…", "leaveTypeId": "EL", "status": "PENDING",
    "startDate": "2026-07-01", "endDate": "2026-07-03", "days": 3, "reason": "Family vacation",
    "createdAt": "2026-06-28T…Z" }, "meta": {} }
```
Lifecycle (ledger tenants): approve → `LEAVE_PENDING_RELEASE` + `LEAVE_TAKEN`; reject/withdraw → `LEAVE_PENDING_RELEASE`. Balance fold: `available = granted − used − pending`. Legacy tenants unchanged (`LeaveType`/`LeaveBalance`). A code with no balance → `INSUFFICIENT_BALANCE` (400); unknown code → `LEAVE_TYPE_NOT_FOUND` (404).

## Issue 2 — `GET /auth/me` → `permissions[]` never empty

Resolution: explicit per-user grants win; otherwise role default from the 14-key catalogue.

```jsonc
// data.permissions for each memberType (when no explicit grants)
"SUPER_ADMIN": [ /* all 14 */ "employees:read","employees:write","employees:delete","employees:export",
  "departments:read","departments:write","attendance:read","attendance:write",
  "leave:read","leave:request","leave:approve","analytics:read","permissions:manage","audit:read" ]
"HR_ADMIN":   [ /* 13 — no permissions:manage */ ]
"MANAGER":    [ "employees:read","departments:read","attendance:read","attendance:write",
                "leave:read","leave:request","leave:approve","analytics:read" ]   // 8
"EMPLOYEE" / "AUDITOR": [ "employees:read","departments:read","attendance:read",
                          "attendance:write","leave:read","leave:request" ]        // 6
```

## Issue 3 — Semi-monthly `PROF_TAX` (local tax) prorated per cycle

Flat monthly local taxes (`pack.localTaxes`, e.g. Professional Tax) are now split across the month's cycles. **Read the itemized amount from the single-payslip detail** (`GET /payroll/runs/:runId/payslips/:payslipId` → `deductions[]`), not the run-list (which returns `deductionsJson: null`).

```jsonc
// A flat ₹200/month PT, live-verified 2026-06-28:
MONTHLY  2026-11      → deductions[]: { "code":"PROF_TAX", "amount": 200 }
SEMI H1  2026-11-H1   → deductions[]: { "code":"PROF_TAX", "amount": 100 }
SEMI H2  2026-11-H2   → deductions[]: { "code":"PROF_TAX", "amount": 100 }   // H1 + H2 == MONTHLY
```

## Issue B1 — `GET /payroll/employees/:id/tax-declaration` (country-driven, never 404s)

All money in **MINOR units** (paise/cents — KWD/BHD ×1000, JPY ×1). FE needs nothing from the admin-only `/statutory-packs` route.

```jsonc
{ "success": true, "data": {
    "employeeId": "…", "fiscalYear": "2025-26", "country": "IN", "currency": "INR",
    "annualTaxableMinor": 120000000,                 // annualCtc(major) × minorUnitFactor
    "regime": "IN_NEW_REGIME",                       // saved regime → else country default → else IN_NEW_REGIME
    "regimes": [ { "code":"IN_NEW_REGIME", "name":"New Regime", "fiscalYear":"2025-26", "currency":"INR",
                   "standardDeduction": 7500000,
                   "slabs": [ {"from":0,"to":30000000,"rate":0}, {"from":30000000,"to":60000000,"rate":5} ],
                   "cess": {"rate":4} } ],            // passthrough of pack.taxRegimes (minor); [] if no pack
    "items": [ { "code":"80C", "amount":150000, "meta":null, "proofStatus":"PENDING" } ],  // TaxDeclarationItem; stored/returned verbatim; [] if none
    "updatedAt": "2026-01-15T…Z"                     // null until first save
  }, "meta": {} }
```
`POST` (also `PATCH`) upserts `{ fiscalYear?, regime?, items? }` for the `(employeeId, fiscalYear)` pair. `fiscalYear` defaults to the legal-entity FY; `regime` defaults to the country default (no longer hardcoded `NEW`).

## Issue B2 — `GET /payroll/employees/:id/tax-form` → localized `TaxFormDocument`

FE renders **verbatim**. Per-country template (`IN→FORM16`, `US→W2`, `GB→P60`; override with `?type=`). Money is **pre-formatted currency strings** (server runs `Intl.NumberFormat`). 404 only if the employee id is unknown; no payroll yet → zeroed rows.

```jsonc
{ "success": true, "data": {
    "type": "FORM16", "title": "Form 16", "fiscalYear": "2025-26",
    "jurisdiction": "IN", "authority": "Income Tax Department", "currency": "INR",
    "employer": { "name": "Acme India Pvt Ltd",
      "identifiers": [ {"label":"TAN","value":"BLRA12345E"}, {"label":"PAN","value":"AAACA1234A"} ] },
    "employee": { "name": "Priya Sharma", "subtitle": "Senior Engineer",
      "identifiers": [ {"label":"PAN","value":"ABCDE1234F"}, {"label":"Employee Code","value":"EMP-001"} ] },
    "sections": [
      { "title":"Gross Salary", "rows":[ {"label":"Salary as per section 17(1)","value":"₹12,00,000.00"},
                                          {"label":"Total","value":"₹12,00,000.00"} ] },
      { "title":"Tax Deducted at Source", "rows":[ {"label":"Total TDS","value":"₹1,20,000.00"} ] }
    ],
    "generatedAt": "2026-06-28T…Z"
  }, "meta": {} }
```
Identifier labels come from the template (`TAN`/`PAN`, `EIN`/`SSN`, `PAYE Reference`/`NI Number`); values from `LegalEntity.registrationIds` + `Employee.taxId`, with `Employee Code` always appended; missing → `—`. `employee.subtitle` present only when `Employee.designation` is set.
