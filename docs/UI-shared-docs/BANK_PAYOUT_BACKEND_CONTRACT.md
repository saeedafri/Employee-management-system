# Bank & Payout Methods — Backend Implementation Contract

> **Audience:** the backend team.
> **Purpose:** this is the **frontend-defined, build-ready contract** for the
> **employee bank accounts / payout-methods** feature. The whole feature is currently
> served by **MSW mocks** in the frontend (the mock *is* the contract). Implement the
> endpoints below to match these shapes exactly; once each is live and shape-verified,
> the frontend deletes the corresponding mock and the app keeps working with **zero app-code
> change** (only the MSW intercept stops matching).
>
> **Source of truth precedence:** Live API > this doc > FE memory. Where this doc and a
> shipped endpoint disagree, the shipped shape wins — but tell us, because the FE types
> are generated from these shapes and will need a matching edit.
>
> **Casing:** **camelCase** everywhere (this is a payroll-domain feature).
> **Envelope:** success `{ "success": true, "data": ... }`; error
> `{ "success": false, "error": { "code", "message", "details"? } }`.
> **Dates:** write `YYYY-MM-DD`; reads may be full ISO datetime where noted.
> **Money:** the disbursement consumer uses **major units** (mirrors the payslip net);
> payout methods themselves carry **no amounts**.

---

## 0. Live-vs-build status (verified against the **deployed backend code**, `upstream/main`, 2026-06-27)

Verified by reading `src/modules/payroll/payroll.routes.js` + `…controller.js` +
`…service.js` + `prisma/schema.prisma` on `upstream/main` (the deployed remote), cross-checked
with an unauthenticated prod probe (`401` = route exists, `404` = absent).

| Surface                                              | Backend status | Action for backend                                              |
| ---------------------------------------------------- | -------------- | --------------------------------------------------------------- |
| `GET /payroll/countries`                             | **LIVE, divergent** | Returns only **8 fixed countries** (`SUPPORTED_COUNTRIES`), not the full ISO list the FE uses. Decide §3.1. |
| `GET /payroll/countries/:code/bank-schema`           | **LIVE, divergent** | Only **4** countries (IN/US/GB/SG); **404** otherwise (no generic fallback); no `currency`; emits a `select` field type. Reconcile §3.2. |
| `GET/POST/PATCH/DELETE /payroll/country-bank-schemas`| **ABSENT (404)** | **BUILD** — Super-Admin catalog CRUD (§5). Today bank schemas are a **hardcoded `BANK_SCHEMAS` const** in `payroll.service.js` — not tenant-editable. |
| `*/payroll/(me\|employees/:id)/payout-methods` + all method ops | **ABSENT (404)** | **BUILD — greenfield.** No payout-method entity exists at all (§0.5). The core of this contract (§4, §6–§9). |
| Disbursement (`runs/:id/payment-batch`, `bank-file`, …) | **LIVE, demo-stubbed** | Routes exist but bank data is **faked** (`accountNumber:'XXXX'`, generated IFSC/IBAN). Must read real payout methods once built — §10. |

> **Net build list:** **(a)** the **entire payout-methods** lifecycle (CRUD + maker-checker
> + verification) — greenfield; **(b)** the country-bank-schema **catalog CRUD** to replace
> the hardcoded const; **(c)** reconcile the two *divergent* live country endpoints (§3);
> **(d)** rewire disbursement to read real accounts (§10).

---

## 0.5 Backend as-built — what exists today (the model we are migrating FROM)

The deployed backend has **no concept of a payout method**. Verified facts:

- **No `PayoutMethod` Prisma model**, no payout routes, no approval queue, no verification,
  no multi-account, no primary-per-currency, no `rail`/`type`.
- Employee bank details are **four flat nullable columns on `EmployeeSalary`**:
  `bankAccountName`, `bankAccountNumber`, `bankIfscCode`, `bankName`
  (`prisma/schema.prisma` model `EmployeeSalary`). This is the **hardcoded India-shaped
  `bankIfscCode`** model — a single account, no lifecycle, IFSC baked into the column name.
- They are read/written via `GET/POST/PATCH /payroll/employees/:employeeId/salary`
  ("HR sees full bank details; EMPLOYEE sees own masked").
- Per-country bank field schemas are a **hardcoded `BANK_SCHEMAS` object** in
  `payroll.service.js` (IN/US/GB/SG only) — not stored, not tenant-editable.
- The bank-file/disbursement path **fabricates** account numbers (`'XXXX'`, generated
  `HDFC0…`/`DE89…`) with an in-code comment that real fields *should* come from the
  employee country bank schema.

**Implication:** the FE has already moved to the richer **payout-methods** model (multi-account,
maker-checker, verification, multi-currency, config-driven fields). The backend must build that
model and **migrate** the legacy `EmployeeSalary.bank*` data into it (one ACTIVE primary BANK
method per employee, seeded from those columns). Migration is **§12.1**.

---

## 1. Feature overview

An employee (self-service) or HR (on behalf of) registers one or more **bank accounts**
("payout methods") to receive pay. The fields required for an account are **not hardcoded** —
they come from a **per-country bank schema** (IBAN for the Eurozone, IFSC + account number
for India, routing + account for the US, …). Every new account or change to a primary
account goes through **maker-checker approval**, and an active account must be **verified**
(penny-drop / manual) before payroll will disburse to it. The downstream **disbursement**
engine pays only the **primary, active, verified, currency-matched** account.

Three layers, all currently MSW:

1. **Country bank-schema layer** (config-over-code) — what fields a country's account needs.
2. **Payout-methods layer** — the accounts themselves + their lifecycle, approval, verification.
3. **Disbursement consumer** — reads (1)+(2) to build the bank file / payment batch.

---

## 2. Global conventions

### 2.1 Auth & RBAC

Cookie-based (httpOnly `accessToken`/`refreshToken`), same as the rest of the app. Roles:
`SUPER_ADMIN`, `HR_ADMIN`, `MANAGER`, `EMPLOYEE`, `AUDITOR`.

| Capability                                   | Allowed roles                                  |
| -------------------------------------------- | ---------------------------------------------- |
| Read **own** payout methods                  | any authenticated employee (self)              |
| Create / set-primary / archive **own**       | the owning `EMPLOYEE` (self)                    |
| Read / create / archive **for an employee**  | `HR_ADMIN`, `SUPER_ADMIN`                       |
| **Approve / reject** method changes          | `HR_ADMIN`, `SUPER_ADMIN` (the "checker")      |
| **Verify** an account (mark VERIFIED/FAILED) | `HR_ADMIN`, `SUPER_ADMIN`                       |
| Country bank-schema **catalog CRUD**         | `SUPER_ADMIN` only                             |

> **Maker ≠ checker:** the requester (maker) must not be able to approve their own
> request. Enforce server-side.
>
> **FE gating note (for your awareness):** the FE gates these admin surfaces by
> **`memberType`/role**, because `/auth/me` currently returns **no** `payout:*`
> permission strings for any role. If you later add `payout:*` permissions, tell us; until
> then role is the only signal.

### 2.2 Envelope & errors

```jsonc
// success
{ "success": true, "data": { /* ... */ } }

// error
{ "success": false, "error": {
    "code": "MACHINE_CODE",
    "message": "Human readable",
    "details": [ { "field": "details.iban", "message": "Invalid IBAN checksum" } ]  // 422 only
} }
```

Status codes used by the FE: `200`, `201`, `202` (async/approval-queued), `400`, `401`,
`403`, `404`, `409` (conflict / invalid state), `422` (validation; `details[]` populated).

### 2.3 Masking (PII)

- Bank-identifier fields in `details` (account number, IBAN, routing) are **masked on
  non-owner reads** and in **all list responses**. Never return a full account number in a
  list. The owner reading their own single method MAY see full values; HR sees masked.
- `maskedTail` (last 4 of the primary identifier) is **always present** on every read.
- See §11 for storage/encryption requirements.

---

## 3. Country bank-schema layer (LIVE but **DIVERGENT** — reconcile)

Both endpoints below already exist on the backend. Each diverges from what the FE expects;
the divergences are concrete blockers, listed inline.

### 3.1 `GET /payroll/countries` — LIVE, **returns only 8 countries**

The FE expects an **array** at `data` of `Country` objects
(`{ code /*ISO-2*/, name, currency /*ISO-4217*/, locale, fiscalYearStartMonth /*1–12*/ }`).
The shape matches; the **coverage** does not.

- **Backend (as-built):** a hardcoded `SUPPORTED_COUNTRIES` array of **8**: IN, US, GB, SA,
  AE, VN, SG, CA.
- **FE (as-built):** ships the full **ISO-3166 (~251)** list (`ISO_COUNTRIES`) and uses it
  for the employee Country dropdown and the Add-Account country selector.

> **DECISION (§14.1).** Either: **(A)** backend expands `/payroll/countries` to the full ISO
> list (recommended — payout must support any country an employee banks in), **or (B)** the
> product constrains those dropdowns to the backend's supported set. Until resolved, the FE
> sources countries from its own `ISO_COUNTRIES` constant, so the live 8-country response is
> **not currently consumed** for the dropdowns — but the payout `country` an employee picks
> may be one the backend's bank-schema endpoint 404s on (§3.2).

### 3.2 `GET /payroll/countries/:code/bank-schema` — LIVE, **4 divergences**

This is the endpoint that drives the Add-Account form. Backend returns
`getBankSchema(code)` = `BANK_SCHEMAS[code]` or `404 NOT_FOUND "Country not supported"`.

**FE expects** (resolves for **any** country — catalog row if configured, else a generic
IBAN/BIC fallback, always with currency):

```jsonc
{ "success": true, "data": {
  "country": "IN",
  "currency": "INR",                       // ← (1) backend OMITS this
  "fields": [ /* BankField[] — §4.3, type:'text' only */ ]
} }
```

| # | Divergence                                                                 | Fix needed |
| - | -------------------------------------------------------------------------- | ---------- |
| 1 | Backend response is `{ country, fields }` — **no `currency`**.             | Add `currency` (ISO-4217) to the response. |
| 2 | Backend has schemas for **IN/US/GB/SG only**; everything else **404s**.     | Return a **generic IBAN/BIC fallback** for any unmapped country instead of 404 (FE never expects a 404 here). Also add CA/AU/SA/AE (FE seeds 8). |
| 3 | Backend US schema has `{ key:'accountType', type:'select', options:[…] }`. | FE `BankField.type` is **`'text'` only** (no `select`, no `options`). Either drop `select` (model account-type as text/enum-in-helpText) **or** tell us to extend `BankField` to support `type:'select'` + `options`. |
| 4 | IN `accountNumber` regex is `^[0-9]{9,18}$`.                                 | FE uses `^[0-9X]{9,18}$` (tolerates masked `X` on round-trip reads). Align to allow `X`, or confirm masked values never reach validation. |

**Generic fallback the FE expects for unmapped countries:**

```jsonc
"fields": [
  { "key": "accountName", "label": "Account holder name", "type": "text", "required": true },
  { "key": "iban", "label": "IBAN", "type": "text", "required": true,
    "regex": "^[A-Z]{2}[0-9A-Z]{13,32}$", "checksumType": "IBAN", "example": "DE89370400440532013000" },
  { "key": "bic", "label": "BIC / SWIFT", "type": "text", "required": false, "example": "DEUTDEFF" }
]
```

> The FE `useBankSchema(country)` hook reads `data.fields` directly. Divergences #2 and #3
> are the form-breaking ones: a 404 (an employee in an unmapped country) or a `select` field
> the FE can't render.

---

## 4. Data model

### 4.1 `PayoutMethod`

```ts
type PayoutMethodType = 'BANK' | 'PROVIDER_BENEFICIARY' | 'WALLET';   // v1 always 'BANK'
type PayoutRail =
  | 'BANK_LOCAL' | 'BANK_SWIFT' | 'SEPA' | 'ACH' | 'FPS' | 'UPI' | 'WISE' | 'WALLET'; // v1 'BANK_LOCAL'
type LifecycleStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'ARCHIVED';
type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'FAILED';

interface PayoutApprovalMeta {
  requestedBy: string;            // user/employee id
  requestedAt: string;           // ISO datetime
  reviewedBy?: string;
  reviewedAt?: string;
  note?: string;
}

interface PayoutMethod {
  id: string;
  employeeId: string;
  type: PayoutMethodType;
  country: string;               // ISO-3166 alpha-2
  currency: string;              // ISO-4217, derived from country (server-authoritative)
  rail: PayoutRail;
  label: string;                 // user label e.g. "HDFC Salary", 1–60 chars
  holderName: string;            // mirrors details.accountName (server may copy)
  details: Record<string,string>;// keyed by the country bank-schema field keys; MASKED for non-owner reads
  maskedTail: string;            // last-4 of primary identifier; ALWAYS present
  isPrimary: boolean;            // primary FOR ITS CURRENCY (invariant in §7)
  lifecycleStatus: LifecycleStatus;
  verificationStatus: VerificationStatus;
  approval: PayoutApprovalMeta;
  effectiveFrom: string;         // YYYY-MM-DD
  createdAt: string;             // ISO datetime
  updatedAt: string;             // ISO datetime
  supersededById?: string | null;// set when an EDIT supersedes this method (history, never edit in place)
}
```

### 4.2 `PayoutMethodInput` (create body)

```ts
interface PayoutMethodInput {
  type: PayoutMethodType;        // v1 'BANK'
  country: string;               // ISO-2
  rail: PayoutRail;              // v1 'BANK_LOCAL'
  label: string;                 // 1–60 chars, required
  holderName: string;            // = details.accountName
  details: Record<string,string>;// validated against the country bank-schema (§8)
  makePrimary?: boolean;         // request this become primary on approval
}
```

> The FE does **not** send `currency` — derive it server-side from `country` (the country's
> default pay currency, catalog-aware). `details` only contains the keys the country schema
> declares; `accountName` is one of them and is also surfaced as `holderName`.

### 4.3 `BankField` & `CountryBankSchema` (catalog)

```ts
type ChecksumType = 'IBAN' | 'ABA_ROUTING' | 'NONE';

interface BankField {
  key: string;                   // stable key used in PayoutMethod.details
  label: string;                 // shown in the form
  type: 'text';                  // v1 always 'text'
  required: boolean;
  regex?: string;                // source string, anchored
  maxLength?: number;
  checksumType?: ChecksumType;   // structural checksum ON TOP OF regex; default NONE
  example?: string;              // rendered as placeholder
  helpText?: string;             // inline guidance
  // placeholder?: string;       // @deprecated — use `example`
}

interface CountryBankSchema {
  country: string;               // ISO-2 — the PRIMARY KEY (one schema per country)
  currency: string;              // ISO-4217, seeded from ISO default, editable
  fields: BankField[];
  updatedAt: string;             // ISO datetime (audit)
  updatedBy: string;             // user id/email that last changed it (audit)
}

interface CountryBankSchemaInput {  // POST/PATCH body
  country: string;
  currency: string;
  fields: BankField[];
}
```

### 4.4 `PayoutApproval` (maker-checker queue item)

```ts
type ApprovalKind = 'METHOD_ADD' | 'METHOD_EDIT' | 'SET_PRIMARY' | 'SPLIT';

interface PayoutApproval {
  id: string;
  kind: ApprovalKind;
  employeeId: string;
  employee: { id: string; name: string };
  summary: string;                 // e.g. "Add HDFC Salary (INR)"
  diff?: Record<string, unknown>;  // what changed; e.g. { label, maskedTail, makePrimary }
  methodId?: string;               // the method this approval acts on
  requestedBy: string;
  requestedAt: string;             // ISO datetime
}
```

---

## 5. Endpoints — Country bank-schema catalog CRUD (**BUILD**; `SUPER_ADMIN`)

Powers the Super-Admin **Settings → Pay & Compliance → Country bank schemas** panel.
The schema's `country` is the key (latest-wins, no effective-dating).

| Method   | Path                                          | Body                      | Success                                  | Errors |
| -------- | --------------------------------------------- | ------------------------- | ---------------------------------------- | ------ |
| `GET`    | `/payroll/country-bank-schemas`               | —                         | `200 { data: CountryBankSchema[] }`      | —      |
| `GET`    | `/payroll/country-bank-schemas/:country`      | —                         | `200 { data: CountryBankSchema }` (or generic fallback row with `updatedBy:"system"`, `updatedAt:"1970-01-01T00:00:00.000Z"`) | — |
| `POST`   | `/payroll/country-bank-schemas`               | `CountryBankSchemaInput`  | `201 { data: CountryBankSchema }`        | `409 SCHEMA_EXISTS` if country already has a row |
| `PATCH`  | `/payroll/country-bank-schemas/:country`      | `Partial<{currency,fields}>` | `200 { data: CountryBankSchema }`     | `404 NOT_FOUND` |
| `DELETE` | `/payroll/country-bank-schemas/:country`      | —                         | `200 { data: { deleted: true } }`        | — (delete reverts that country to the generic fallback) |

`:country` is **case-insensitive** (FE may send `in`; uppercase it server-side).
On POST/PATCH, set `updatedAt = now`, `updatedBy = <super-admin id/email>`.

**Seed catalog (8 countries):** the FE ships canonical schemas for **IN, US, GB, CA, SG,
AU, SA, AE** (see `src/modules/payroll/constants/country-bank-schemas.seed.ts` — share on
request). Two canonical examples:

```jsonc
// IN
{ "country": "IN", "currency": "INR", "fields": [
  { "key": "accountName", "label": "Account holder name", "type": "text", "required": true },
  { "key": "accountNumber", "label": "Account number", "type": "text", "required": true,
    "regex": "^[0-9X]{9,18}$", "example": "1234567890" },
  { "key": "ifsc", "label": "IFSC code", "type": "text", "required": true,
    "regex": "^[A-Z]{4}0[A-Z0-9]{6}$", "example": "HDFC0001234" },
  { "key": "bankName", "label": "Bank name", "type": "text", "required": false, "example": "HDFC Bank" }
] }

// US
{ "country": "US", "currency": "USD", "fields": [
  { "key": "accountName", "label": "Account holder name", "type": "text", "required": true },
  { "key": "routingNumber", "label": "Routing number", "type": "text", "required": true,
    "regex": "^[0-9]{9}$", "checksumType": "ABA_ROUTING", "example": "021000021" },
  { "key": "accountNumber", "label": "Account number", "type": "text", "required": true,
    "regex": "^[0-9]{4,17}$", "example": "000123456789" }
] }
```

---

## 6. Endpoints — Payout methods CRUD (**BUILD**)

### 6.1 `GET /payroll/me/payout-methods` — self read

Returns the **signed-in employee's** methods + disbursement instructions. `ARCHIVED` methods
are excluded.

```jsonc
{ "success": true, "data": {
  "methods": [ /* PayoutMethod[] — details MASKED, maskedTail present */ ],
  "instructions": [ /* DisbursementInstruction[] — §9, may be [] in v1 */ ]
} }
```

### 6.2 `GET /payroll/employees/:employeeId/payout-methods` — HR read

Same `PayoutMethodsResponse` shape, for the named employee. `HR_ADMIN`/`SUPER_ADMIN`.

### 6.3 `GET /payroll/payout-methods/:id` — single method

`200 { data: PayoutMethod }` or `404 NOT_FOUND`. Owner sees full `details`; others masked.

### 6.4 `POST /payroll/employees/:employeeId/payout-methods` — create

Body `PayoutMethodInput` (§4.2). Server:

1. Validate `details` against the country bank-schema (§8) → `422` on failure with `details[]`.
2. Derive `currency` from `country`; set `holderName = details.accountName`.
3. Create the method with `lifecycleStatus: "PENDING_APPROVAL"`, `verificationStatus:
   "UNVERIFIED"`, `isPrimary: false`, `maskedTail` = last-4 of the primary identifier,
   `approval: { requestedBy, requestedAt: now }`, `effectiveFrom: today`.
4. **Also enqueue** a `METHOD_ADD` approval (§7) carrying `diff: { label, maskedTail,
   makePrimary }`.

Success: `201 { data: PayoutMethod }`.

### 6.5 `POST /payroll/payout-methods/:id/set-primary`

Does **not** flip primary immediately — it **enqueues a `SET_PRIMARY` approval**. Returns
`202 { data: PayoutApproval }`. `404 NOT_FOUND` if the method is absent.

### 6.6 `POST /payroll/payout-methods/:id/archive`

Sets `lifecycleStatus: "ARCHIVED"`, `updatedAt: now`. Returns `200 { data: PayoutMethod }`.
No approval needed (archiving is destructive-safe; it removes from disbursement). `404` if absent.

---

## 7. Endpoints — Maker-checker approvals (**BUILD**)

### 7.1 `GET /payroll/payout-methods/approvals?status=PENDING`

The HR approval queue. Returns:

```jsonc
{ "success": true, "data": {
  "items": [ /* PayoutApproval[] */ ],
  "pagination": { "page": 1, "pageSize": 50, "total": 3 }
} }
```

> The FE reads `data.items`. `pagination` is accepted but not currently paged by the UI;
> include it for forward-compat.

### 7.2 `POST /payroll/payout-methods/approvals/:id/approve`

Body `{ note?: string }`. **Applies** the queued change atomically by `kind`:

- `METHOD_ADD` / `METHOD_EDIT` → set the method `lifecycleStatus: "ACTIVE"`. If the
  add/edit requested `makePrimary`, also run the SET_PRIMARY effect below.
- `SET_PRIMARY` → set `isPrimary: true` on the target method **and `false` on every other
  method of the same `employeeId` + `currency`** (the invariant in §7.4). 
- Then remove the approval from the queue; stamp `reviewedBy`/`reviewedAt` on the method's
  `approval`.

Success: `200 { data: { applied: true } }`. `404 NOT_FOUND` if approval missing.
**Reject self-approval** (`requestedBy === reviewer`) with `403`.

### 7.3 `POST /payroll/payout-methods/approvals/:id/reject`

Body `{ note: string }` (reason required). For a `METHOD_ADD`, set the method
`lifecycleStatus: "REJECTED"`. Remove the approval. `200 { data: { rejected: true } }`.
`404` if missing.

### 7.4 Invariants (enforce server-side)

- **One primary per (employee, currency).** Setting one primary clears the others in the
  same currency. Never two `isPrimary: true` for the same employee+currency.
- **Maker ≠ checker** (§2.1).
- **History, not edits.** An edit creates a new method and sets `supersededById` on the old
  one rather than mutating an `ACTIVE`/`PAID`-referenced record in place.

---

## 8. Endpoints — Verification (**BUILD**)

### 8.1 `GET /payroll/payout-methods/unverified`

Lists `ACTIVE` + `UNVERIFIED` **BANK** methods awaiting verification (HR queue):

```jsonc
{ "success": true, "data": { "items": [ /* PayoutMethod[] */ ] } }
```

### 8.2 `POST /payroll/payout-methods/:id/verify`

Body `{ result: "VERIFIED" | "FAILED", note?: string }`. **Only an `ACTIVE` method can be
verified** — otherwise `409 NOT_ACTIVE` ("Only an active account can be verified"). Sets
`verificationStatus = result`, `updatedAt: now`. Success `200 { data: PayoutMethod }`.
`404 NOT_FOUND` if absent.

### 8.3 Verification FSM

```
UNVERIFIED ──verify(VERIFIED)──► VERIFIED
UNVERIFIED ──verify(FAILED)────► FAILED
(PENDING is reserved for async penny-drop; v1 transitions directly)
```

### 8.4 Field validation (used by §6.4 create)

For each `BankField` in the country schema: enforce `required`, `regex` (anchored), optional
`maxLength`, and `checksumType`:

- `IBAN` — mod-97 checksum over the rearranged IBAN.
- `ABA_ROUTING` — 9-digit ABA weighted checksum (3·7·1).
- `NONE` — regex only.

Validation failures return `422` with `details: [{ field: "details.<key>", message }]`. The
FE maps `field` back onto the form input (`label` is the one top-level field; everything else
is `details.<key>`).

---

## 9. Disbursement instructions / split (v2 — optional)

```ts
type AllocationMode = 'PERCENT' | 'FIXED' | 'REMAINDER';
interface DisbursementAllocation { payoutMethodId: string; mode: AllocationMode; value: number; } // value = percent, or minor units for FIXED
interface DisbursementInstruction { employeeId: string; currency: string; allocations: DisbursementAllocation[]; }

interface PayoutMethodsResponse { methods: PayoutMethod[]; instructions: DisbursementInstruction[]; }
```

Split-pay (route N% to account A, remainder to B) is **modeled but not yet exercised** by
the UI. v1 may return `instructions: []` and ignore the `SPLIT` approval kind. Implement the
type so the field exists; full split CRUD is a later phase. Flag if you want it specified now.

---

## 10. Disbursement consumer contract (what the run engine needs from payout data)

The payment-batch / bank-file generator (`runs/:id/payment-batch`, `runs/:id/bank-file`,
`runs/:id/bank-file/preview`) is a **consumer** of the data above. It must select, per
payslip, the employee's **primary, ACTIVE, VERIFIED, currency-matched BANK** method, and
**exclude** the rest with a reason:

| Exclusion reason     | Condition                                                    |
| -------------------- | ----------------------------------------------------------- |
| `NO_ACCOUNT`         | employee has no primary ACTIVE BANK method                  |
| `UNVERIFIED`         | the primary method's `verificationStatus !== "VERIFIED"`    |
| `CURRENCY_MISMATCH`  | method `currency !== payslip currency`                      |

- Eligible rows carry the **unmasked** `details` (for the bank file only), `country`,
  `amount` (major units, = payslip net), `currency`, and `reference = PAY/<period>/<employeeCode>`.
- `POST /payroll/runs/:id/payment-batch` returns `422 NO_ELIGIBLE_PAYEES` when nothing is
  disbursable ("Verify accounts first.") and `422 RUN_NOT_PAYABLE` unless the run is
  `APPROVED`/`PAID`.
- Bank-file formats are **config-driven** column specs, not code: v1 codes `NACH | ACH |
  SEPA | BACS` (query `?format=`). Unknown format → `422 UNKNOWN_FORMAT`.

> This section documents the **contract the payout layer must satisfy** so disbursement
> keeps working; it is **not** a request to re-implement the run engine. If your
> disbursement already exists, just ensure it reads payout methods exactly per the
> selection rules above. No `country ===` branching anywhere (config over code).

---

## 11. Security & PII (non-negotiable)

- **Encrypt bank identifiers at rest** (account number, IBAN, routing). Store, never log,
  the full value; logs and non-owner reads see only `maskedTail`.
- **Mask on the wire** for every non-owner read and **all** list responses (§2.3).
- **Audit trail:** who created/edited/approved/verified/archived each method, with
  timestamps (`approval.requestedBy/At`, `reviewedBy/At`, schema `updatedBy/At`).
- **Maker ≠ checker** enforced server-side (§2.1).
- Validate `country` is a real ISO-2 and that `details` keys are a **subset** of the
  country schema's field keys — reject unknown keys.

---

## 12. FE removal plan (what we delete once you ship + we shape-verify)

When each surface is live and verified, the FE removes the matching MSW handler/fixtures;
**no component, hook, service, or type changes** (services already call these exact paths):

| When live & verified                          | FE deletes                                                            |
| --------------------------------------------- | -------------------------------------------------------------------- |
| Payout-methods CRUD + approvals + verify      | `src/mocks/handlers/payout-methods.ts`, `src/mocks/data/payout-methods.ts` |
| Country bank-schema **catalog CRUD**          | the `country-bank-schemas` routes in `src/mocks/handlers/payroll-localization.ts` |
| (`/countries`, `/countries/:code/bank-schema` already live — FE already consumes them) | — |
| Disbursement endpoints                        | `src/mocks/handlers/payroll-disbursement.ts`, `src/mocks/data/disbursement-join.ts` |

Kept regardless (FE-owned, not backend): the seed `country-bank-schemas.seed.ts`,
`iso-countries.ts`, validation/mask utils, types, components.

### 12.1 Data migration — `EmployeeSalary.bank*` → payout methods

The legacy bank columns on `EmployeeSalary` (`bankAccountName`, `bankAccountNumber`,
`bankIfscCode`, `bankName`) are the only existing bank data. When the payout-methods entity
ships, **backfill one method per employee that has them**:

```
for each EmployeeSalary row with a non-null bankAccountNumber:
  create PayoutMethod {
    employeeId,
    type: 'BANK', rail: 'BANK_LOCAL',
    country: salary.country (or legalEntity.country; default 'IN' if absent),
    currency: derived from country,
    label: 'Salary account',
    holderName: bankAccountName,
    details: { accountName: bankAccountName, accountNumber: bankAccountNumber,
               ifsc: bankIfscCode, bankName },   // IFSC only for IN; map per country schema
    isPrimary: true,
    lifecycleStatus: 'ACTIVE',
    verificationStatus: 'UNVERIFIED',            // require HR to verify post-migration
  }
```

After backfill, the `EmployeeSalary.bank*` columns are **deprecated** (read-only for one
release, then drop). Salary config no longer owns bank details — payout methods do. This is
the §26-Step-95 "remove hardcoded `bankIfscCode`" change, completed on the backend side.

---

## 13. Reference — FE files that define these shapes

| Concern                         | File                                                                 |
| ------------------------------- | -------------------------------------------------------------------- |
| Method/approval/split types     | `src/modules/payout-methods/types/payoutMethod.types.ts`             |
| Service (exact paths called)    | `src/modules/payout-methods/services/payoutMethods.api.ts`           |
| MSW mock (behavioral contract)  | `src/mocks/handlers/payout-methods.ts`                               |
| Country/bank-schema types       | `src/modules/payroll/types/localization.types.ts`                    |
| Bank-schema MSW + resolver      | `src/mocks/handlers/payroll-localization.ts`                         |
| Seed bank schemas (8 countries) | `src/modules/payroll/constants/country-bank-schemas.seed.ts`         |
| Generic IBAN fallback fields    | `src/modules/payroll/constants/iso-countries.ts` (`GENERIC_FALLBACK_FIELDS`) |
| Disbursement selection rules    | `src/mocks/data/disbursement-join.ts`                                |
| Bank-file format specs          | `src/mocks/data/bank-file-formats.ts`                                |

---

## 14. Open decisions for the backend team

> Items 1–2 are now **verified against `upstream/main`** and have a concrete answer/divergence
> rather than an open question — they are the headline reconciliation work.

1. **`/payroll/countries` coverage** *(verified divergent — §3.1)* — backend returns **8
   fixed countries**, FE uses the full ISO list. Expand to full ISO (recommended) or
   constrain the product to the supported set?
2. **`/countries/:code/bank-schema` parity** *(verified divergent — §3.2)* — **4 concrete
   mismatches** (no `currency`; 404 instead of generic fallback; `select` field type; IN
   regex). The 404-vs-fallback and `select`-type issues are form-breaking. Reconcile per the
   §3.2 table.
3. **No payout-methods entity yet** *(verified — §0.5)* — bank details are flat on
   `EmployeeSalary`. This whole contract (§4–§9) is a **greenfield build** plus the **§12.1
   migration** off those columns. Confirm you'll build it as a first-class entity (not more
   columns on salary).
4. **Verification mechanism** — penny-drop (async, uses `PENDING`) vs manual HR mark? v1
   assumes manual/instant; tell us if you go async so we surface `PENDING`.
5. **Disbursement rewire** *(verified demo-stubbed — §10)* — the bank-file currently fakes
   account numbers. It must read the real primary/active/verified method once payout methods
   exist.
6. **Split pay (§9)** — specify now or defer? FE is fine deferring (`instructions: []`).
7. **Edit flow** — we model edits as supersede-and-replace (`supersededById`). Confirm you
   want immutability rather than in-place PATCH of `details`.
8. **`payout:*` permissions** — will you add them to `/auth/me`? If not, we keep role-gating.
