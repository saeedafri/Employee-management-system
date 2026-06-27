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
