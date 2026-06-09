# Payroll Phase 3 — Live API Contract Fixes

> **Resolved:** 2026-06-09  
> **Commit:** `fe13d18`  
> **Live API:** `https://employee-management-system-2b9q.onrender.com/api/v1`  
> **Deployed UI:** `https://ems-frontend-iota-ten.vercel.app`  
> **Source issue report:** UI team `BACKEND_LIVE_API_ISSUES.md` (verified against live Render API)

This document describes every payroll contract issue that was fixed, with full request/response shapes for the UI team and QA.

---

## Table of Contents

1. [Common conventions](#common-conventions)
2. [P1 — Salary components (statutory fields)](#p1--salary-components-statutory-fields)
3. [P2 — Pay calendars (frontend shape)](#p2--pay-calendars-frontend-shape)
4. [P3 — Legal entities (`active` field)](#p3--legal-entities-active-field)
5. [P4 — Missing base payroll paths (404 → 200)](#p4--missing-base-payroll-paths-404--200)
6. [P5 — Contractor invoices & opening balances (seed + shape)](#p5--contractor-invoices--opening-balances-seed--shape)
7. [Verified unchanged (no rework)](#verified-unchanged-no-rework)
8. [Seed & verification commands](#seed--verification-commands)

---

## Common conventions

### Base URL

```
https://employee-management-system-2b9q.onrender.com/api/v1
```

### Authentication

All endpoints below require:

```http
Authorization: Bearer <accessToken>
x-tenant-key: acme-corp-001
```

**Roles:** Unless noted, endpoints require `HR_ADMIN` or `SUPER_ADMIN`.

### Success envelope

```json
{
  "success": true,
  "data": <payload>,
  "meta": {}
}
```

### Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": {}
  },
  "meta": { "requestId": "..." }
}
```

Common error codes on payroll endpoints: `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 CODE_EXISTS`, `409 RUN_EXISTS`, `422 INVALID_RUN_TYPE`, `422 INVALID_PACK`.

---

## P1 — Salary components (statutory fields)

### What was wrong

`GET /payroll/components` returned only basic fields (`id`, `name`, `code`, `type`, …, `color`, `amount`). The frontend TypeScript contract requires statutory wiring fields on **every** component:

- `statutoryTag`
- `prorate`
- `payInPeriods` (as `number[] | null`, not a JSON string)
- `createdAt`, `updatedAt`
- Optional: `glAccountCode`, `costCenterRule`

Routes/Swagger documented these fields, but `payroll.repository.js` did not select, persist, or format them.

### What was fixed

- DB columns already existed (`statutoryTag`, `prorate`, `payInPeriods`, `glAccountCode`, `costCenterRule`).
- Repository `COMPONENT_INCLUDE`, `fmtComponent()`, `createComponent()`, `updateComponent()` now read/write all fields.
- `payInPeriods` is stored as JSON in DB and **returned as a number array** in API responses.
- PATCH route body schema accepts statutory fields.

---

### `GET /payroll/components`

**Roles:** HR_ADMIN, SUPER_ADMIN  
**Query (optional):** `?active=true` or `?active=false`

**Request**

```http
GET /api/v1/payroll/components HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "cmq6qbk4f0003bjydm5benhyv",
      "name": "Basic",
      "code": "BASIC",
      "type": "EARNING",
      "calculationType": "PERCENTAGE",
      "value": 40,
      "basisCode": "CTC",
      "formula": null,
      "taxable": true,
      "active": true,
      "displayOrder": 1,
      "description": null,
      "color": "#16a34a",
      "amount": 0,
      "statutoryTag": "PF_WAGE",
      "prorate": true,
      "payInPeriods": null,
      "glAccountCode": null,
      "costCenterRule": "DEPARTMENT",
      "createdAt": "2026-06-09T14:22:37.216Z",
      "updatedAt": "2026-06-09T14:22:37.548Z"
    }
  ],
  "meta": {}
}
```

| Field | Type | Required on response | Notes |
|-------|------|---------------------|-------|
| `statutoryTag` | `string \| null` | Yes | e.g. `PF_WAGE`, `PF_EMPLOYEE`, `ESI`, `TDS` |
| `prorate` | `boolean` | Yes | Default `true` if unset in DB |
| `payInPeriods` | `number[] \| null` | Yes | `null` = paid every month |
| `glAccountCode` | `string \| null` | Yes | Optional GL mapping |
| `costCenterRule` | `"DEPARTMENT" \| "NONE"` | Yes | Default `NONE` |
| `createdAt` | ISO string | Yes | |
| `updatedAt` | ISO string | Yes | |
| `color`, `amount` | extra | No | UI helpers; FE ignores if unused |

---

### `POST /payroll/components`

**Roles:** HR_ADMIN, SUPER_ADMIN  
**Status:** `201 Created`

**Request body**

```json
{
  "name": "Basic Salary",
  "code": "BASIC",
  "type": "EARNING",
  "calculationType": "PERCENTAGE",
  "value": 40,
  "basisCode": "CTC",
  "taxable": true,
  "active": true,
  "displayOrder": 1,
  "description": "Basic — 40% of CTC",
  "statutoryTag": "PF_WAGE",
  "prorate": true,
  "payInPeriods": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  "glAccountCode": "GL-4100",
  "costCenterRule": "DEPARTMENT"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name`, `code`, `type`, `calculationType`, `taxable` | Yes | `code` stored uppercase |
| `statutoryTag`, `prorate`, `payInPeriods`, `glAccountCode`, `costCenterRule` | No | Persisted when provided |

**Response `201`** — same single-object shape as one item in the GET list above.

**Errors**

| Status | Code | When |
|--------|------|------|
| 409 | `CODE_EXISTS` | Duplicate `code` for tenant |
| 400 | `VALIDATION_ERROR` | Invalid body |

---

### `PATCH /payroll/components/:id`

**Roles:** HR_ADMIN, SUPER_ADMIN  
**Note:** `code` is immutable.

**Request body (partial update)**

```json
{
  "prorate": false,
  "payInPeriods": [6, 12],
  "statutoryTag": "PF_EMPLOYEE",
  "costCenterRule": "NONE",
  "glAccountCode": "GL-4200"
}
```

**Response `200`** — updated component object (full shape).

**Example live response after patch**

```json
{
  "success": true,
  "data": {
    "id": "cmq6qbk4f0003bjydm5benhyv",
    "name": "Contract Test Comp",
    "code": "CT_1781014956709",
    "type": "EARNING",
    "calculationType": "FLAT",
    "value": 1000,
    "basisCode": null,
    "formula": null,
    "taxable": true,
    "active": true,
    "displayOrder": 0,
    "description": null,
    "color": "#16a34a",
    "amount": 0,
    "statutoryTag": "PF_WAGE",
    "prorate": true,
    "payInPeriods": [3, 9],
    "glAccountCode": null,
    "costCenterRule": "DEPARTMENT",
    "createdAt": "2026-06-09T14:22:37.216Z",
    "updatedAt": "2026-06-09T14:22:37.548Z"
  },
  "meta": {}
}
```

---

## P2 — Pay calendars (frontend shape)

### What was wrong

`GET /payroll/pay-calendars` returned the **internal DB shape**:

```
id, tenantId, name, code, country, paySchedule, firstPayDate, createdAt, updatedAt
```

The frontend expects the **`PayCalendar`** contract:

```
id, name, legalEntityId, frequency, periodAnchor, payDateRule, payDay, cutoffDay, holidayCalendarId, createdAt, updatedAt
```

### What was fixed

- Migration added scheduling columns on `PayCalendar`: `legalEntityId`, `periodAnchor`, `payDateRule`, `payDay`, `cutoffDay`, `holidayCalendarId`.
- `fmtPayCalendar()` maps DB → frontend shape (`paySchedule` → `frequency`).
- POST/PATCH accept `frequency` (alias for `paySchedule`) and all scheduling fields.

---

### `GET /payroll/pay-calendars`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request**

```http
GET /api/v1/payroll/pay-calendars HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "cmq5kdirs00b4es8ddu4v3gj4",
      "name": "India Monthly Payroll",
      "legalEntityId": "le_cmq5k2bkv0000es8dzc32uxe3_in",
      "frequency": "MONTHLY",
      "periodAnchor": "MONTH_START",
      "payDateRule": "LAST_WORKING_DAY",
      "payDay": 30,
      "cutoffDay": 25,
      "holidayCalendarId": null,
      "createdAt": "2026-06-08T18:48:24.904Z",
      "updatedAt": "2026-06-08T18:48:24.904Z"
    }
  ],
  "meta": {}
}
```

| Field | Type | Notes |
|-------|------|-------|
| `frequency` | `MONTHLY \| BIWEEKLY \| WEEKLY` | Mapped from DB `paySchedule` |
| `periodAnchor` | string | Default `MONTH_START` |
| `payDateRule` | string | Default `LAST_WORKING_DAY` |
| `payDay` | integer | Default 30 / 15 / 7 by frequency |
| `cutoffDay` | integer | Default `25` |
| `legalEntityId` | string \| null | Link to legal entity |
| `holidayCalendarId` | string \| null | Optional |

**Removed from API response (internal only):** `tenantId`, `code`, `country`, `paySchedule`, `firstPayDate`.

---

### `POST /payroll/pay-calendars`

**Roles:** HR_ADMIN, SUPER_ADMIN  
**Status:** `201 Created`

**Request body**

```json
{
  "name": "India Monthly Payroll",
  "code": "IN-MONTHLY",
  "country": "IN",
  "frequency": "MONTHLY",
  "legalEntityId": "le_cmq5k2bkv0000es8dzc32uxe3_in",
  "periodAnchor": "MONTH_START",
  "payDateRule": "LAST_WORKING_DAY",
  "payDay": 30,
  "cutoffDay": 25,
  "holidayCalendarId": null,
  "firstPayDate": "2026-01-31"
}
```

You may send `paySchedule` instead of `frequency` — both are accepted on write.

**Response `201`** — single `PayCalendar` object (same shape as GET item).

---

### `PATCH /payroll/pay-calendars/:id`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body (partial)**

```json
{
  "payDay": 28,
  "cutoffDay": 23,
  "legalEntityId": "le_cmq5k2bkv0000es8dzc32uxe3_in",
  "frequency": "BIWEEKLY"
}
```

**Response `200`** — updated `PayCalendar` object.

**Errors:** `404 NOT_FOUND` if calendar id does not exist for tenant.

---

## P3 — Legal entities (`active` field)

### What was wrong

`GET /payroll/legal-entities` did not return `active`. POST/PATCH did not accept it. The UI uses `active` for status badges and filtering.

### What was fixed

- Migration: `LegalEntity.active BOOLEAN NOT NULL DEFAULT true`.
- All existing rows default to `active: true`.
- `fmtLegalEntity()` returns `active` on list/create/update.
- Seed includes one active and one inactive entity.

---

### `GET /payroll/legal-entities`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request**

```http
GET /api/v1/payroll/legal-entities HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "le_cmq5k2bkv0000es8dzc32uxe3_in",
      "name": "Acme India Pvt Ltd",
      "country": "IN",
      "currency": "INR",
      "fiscalYearStartMonth": 4,
      "timezone": "Asia/Kolkata",
      "locale": "en-IN",
      "registrationIds": {
        "PF": "MHBAN1234567",
        "ESI": "12345678901234",
        "PAN": "AAAAA1234A"
      },
      "statutoryPackId": "cmq5kdiaj00b2es8dfw96vts7",
      "payCalendarId": null,
      "active": true,
      "createdAt": "2026-06-08T18:48:20.822Z",
      "updatedAt": "2026-06-09T14:20:18.144Z"
    },
    {
      "id": "...",
      "name": "Acme Legacy Entity",
      "country": "IN",
      "currency": "INR",
      "fiscalYearStartMonth": 4,
      "timezone": "Asia/Kolkata",
      "locale": "en-IN",
      "registrationIds": {},
      "statutoryPackId": null,
      "payCalendarId": null,
      "active": false,
      "createdAt": "2026-06-09T14:20:18.144Z",
      "updatedAt": "2026-06-09T14:20:18.144Z"
    }
  ],
  "meta": {}
}
```

---

### `POST /payroll/legal-entities`

**Roles:** SUPER_ADMIN only  
**Status:** `201 Created`

**Request body**

```json
{
  "name": "Acme India Pvt Ltd",
  "country": "IN",
  "currency": "INR",
  "fiscalYearStartMonth": 4,
  "timezone": "Asia/Kolkata",
  "locale": "en-IN",
  "registrationIds": {
    "cin": "U12345KA2020PTC123456"
  },
  "statutoryPackId": "cmq5kdiaj00b2es8dfw96vts7",
  "payCalendarId": "cmq5kdirs00b4es8ddu4v3gj4",
  "active": true
}
```

| Field | Required | Default |
|-------|----------|---------|
| `name`, `country` | Yes | |
| `active` | No | `true` |

**Response `201`** — single legal entity object (same shape as GET item).

---

### `PATCH /payroll/legal-entities/:id`

**Roles:** SUPER_ADMIN only

**Request body (partial)**

```json
{
  "active": false,
  "payCalendarId": "cmq5kdirs00b4es8ddu4v3gj4"
}
```

**Response `200`** — updated legal entity object.

---

## P4 — Missing base payroll paths (404 → 200)

### What was wrong

The deployed UI called these parent paths and received **404**:

| Path | Previously |
|------|------------|
| `GET /payroll/employees` | 404 (only `/payroll/employees/:id/...` existed) |
| `GET /payroll/migration` | 404 (only `/payroll/migration/status` existed) |
| `GET /payroll/payment-batches` | 404 (only `/:id/status` existed) |
| `GET /payroll/reports` | 404 (only `/reports/pay-equity` etc.) |
| `GET /payroll/settings` | 404 (only `/settings/data-policy` existed) |

### What was fixed

All five base routes implemented with contract-aligned response shapes.

---

### `GET /payroll/employees`

**Roles:** HR_ADMIN, SUPER_ADMIN  
**UI screen:** Payroll → Employees roster

**Request**

```http
GET /api/v1/payroll/employees HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "employeeId": "cmq5k4wso001ies8d5sjxzwum",
      "employeeCode": "E0001",
      "employeeName": "Aman Kumar",
      "department": "Engineering",
      "designation": "Engineering Manager",
      "country": "IN",
      "currency": "INR",
      "payGroupId": "pg-india-monthly",
      "payGroupName": "India Monthly",
      "hasSalaryConfig": true,
      "annualCtc": 1200000,
      "active": true
    }
  ],
  "meta": {}
}
```

| Field | Type | Notes |
|-------|------|-------|
| `hasSalaryConfig` | boolean | `true` if active `EmployeeSalary` exists |
| `annualCtc` | number \| null | From current salary record |
| `active` | boolean | `employmentStatus === ACTIVE` |
| `country` | string | From `location` or default `IN` |

---

### `GET /payroll/migration`

**Roles:** HR_ADMIN, SUPER_ADMIN  
**UI screen:** Payroll → Migration hub  
**Note:** Aggregate alias of `/payroll/migration/status` with guaranteed `updatedAt`.

**Request**

```http
GET /api/v1/payroll/migration HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "sandboxMode": true,
    "goLivePeriod": "2026-06",
    "openingBalancesCount": 1,
    "historicalPayslipsCount": 0,
    "lastReconciledRunId": null,
    "updatedAt": "2026-06-09T14:20:24.641Z"
  },
  "meta": {}
}
```

**Related endpoints (unchanged):**

- `GET /payroll/migration/status` — same core fields
- `PATCH /payroll/migration/status` — update `sandboxMode`, `goLivePeriod`
- `GET /payroll/opening-balances` — list opening balances (see P5)
- `GET /payroll/migration/historical-payslips` — historical payslip import list

---

### `GET /payroll/payment-batches`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request**

```http
GET /api/v1/payroll/payment-batches HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "batch-abc123",
      "runId": "run-may-2026",
      "period": "2026-05",
      "count": 10,
      "totalAmount": 250000,
      "currency": "INR",
      "status": "PENDING",
      "createdAt": "2026-06-09T00:00:00.000Z",
      "reconciledAt": null
    }
  ],
  "meta": {}
}
```

Returns an empty array `[]` when no batches exist (valid — not an error).

| `status` values | `PENDING`, `PROCESSING`, `COMPLETED` |

---

### `GET /payroll/reports`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request**

```http
GET /api/v1/payroll/reports HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "pay-equity",
        "path": "/payroll/reports/pay-equity",
        "label": "Pay Equity",
        "method": "GET"
      },
      {
        "id": "audit-pack",
        "path": "/payroll/reports/audit-pack",
        "label": "Audit Pack",
        "method": "GET",
        "requiresRunId": true
      },
      {
        "id": "statutory-return",
        "path": "/payroll/runs/:runId/statutory-return",
        "label": "Statutory Return",
        "method": "GET",
        "requiresRunId": true
      },
      {
        "id": "register",
        "path": "/payroll/runs/:runId/register",
        "label": "Payroll Register",
        "method": "GET",
        "requiresRunId": true
      }
    ],
    "recentRuns": [
      {
        "id": "run-id",
        "period": "2026-05",
        "status": "APPROVED",
        "type": "REGULAR",
        "published": false,
        "createdAt": "2026-06-01T10:00:00.000Z"
      }
    ]
  },
  "meta": {}
}
```

Use `reports[].path` for navigation; call detail endpoints (e.g. `GET /payroll/reports/pay-equity?groupBy=gender`) for actual report data.

---

### `GET /payroll/settings`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request**

```http
GET /api/v1/payroll/settings HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "defaultCountry": "IN",
    "defaultCurrency": "INR",
    "sandboxMode": true,
    "dataPolicy": {
      "defaultRetentionYears": 7,
      "policies": [
        {
          "country": "IN",
          "residencyRegion": "ap-south-1",
          "retentionYears": 8,
          "statutoryHold": true
        }
      ],
      "updatedAt": "2026-06-09T00:00:00.000Z"
    },
    "features": {
      "payrollEnabled": true,
      "contractorInvoices": true,
      "openingBalances": true,
      "statutoryPacks": true,
      "offCycleRuns": true
    },
    "updatedAt": "2026-06-09T00:00:00.000Z"
  },
  "meta": {}
}
```

**Sub-resource (unchanged):** `GET /payroll/settings/data-policy` returns only the `dataPolicy` object.

---

## P5 — Contractor invoices & opening balances (seed + shape)

### What was wrong

- `GET /payroll/contractor-invoices` returned `[]` — data lived in a `Setting` JSON blob, not the `ContractorInvoice` table.
- `GET /payroll/opening-balances` returned `[]` and, when populated, lacked `employeeCode` / `employeeName`.

### What was fixed

- `listContractorInvoices()` reads from `ContractorInvoice` Prisma model.
- `getAllOpeningBalances()` joins employee and returns enriched shape.
- Idempotent seed: `npm run db:seed:payroll-contract`

---

### `GET /payroll/contractor-invoices`

**Roles:** HR_ADMIN, SUPER_ADMIN  
**Query (optional):** `?workerId=<id>&status=SUBMITTED`

**Request**

```http
GET /api/v1/payroll/contractor-invoices HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "cmq6q8pdj000fwmusbpv2an36",
      "workerId": "cmq5k4wso001ies8d5sjxzwum",
      "workerName": "Contractor Name",
      "period": "2026-06",
      "amount": 100000,
      "currency": "INR",
      "withholdingPct": 10,
      "netPayable": 90000,
      "status": "SUBMITTED",
      "payoutRef": null,
      "submittedAt": "2026-06-09T14:20:24.055Z",
      "decidedAt": null
    }
  ],
  "meta": {}
}
```

| `status` values | `SUBMITTED`, `APPROVED`, `PAID`, `VOIDED` |

---

### `POST /payroll/contractor-invoices`

**Roles:** HR_ADMIN, SUPER_ADMIN  
**Status:** `201 Created`

**Request body**

```json
{
  "workerId": "cmq5k4wso001ies8d5sjxzwum",
  "workerName": "Raj Contractor",
  "period": "2026-07",
  "amount": 150000,
  "currency": "INR",
  "withholdingPct": 10
}
```

`netPayable` is auto-calculated as `amount × (1 - withholdingPct/100)` if omitted.

**Response `201`** — single invoice object (same shape as GET item).

---

### `GET /payroll/opening-balances`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request**

```http
GET /api/v1/payroll/opening-balances HTTP/1.1
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

**Response `200`**

```json
{
  "success": true,
  "data": [
    {
      "employeeId": "cmq5k4wso001ies8d5sjxzwum",
      "employeeCode": "E0001",
      "employeeName": "Aman Kumar",
      "fiscalYear": "2025-26",
      "grossEarnings": 100000,
      "taxableIncome": 90000,
      "taxDeducted": 10000,
      "totalDeductions": 15000,
      "netPay": 85000,
      "contributions": {
        "pf": 5000
      },
      "importedAt": "2026-06-09T14:20:24.641Z"
    }
  ],
  "meta": {}
}
```

**Per-employee endpoints (unchanged):**

- `GET /payroll/employees/:id/opening-balances`
- `POST /payroll/employees/:id/opening-balances`

---

## Verified unchanged (no rework)

These were already correct or fixed in a prior release. Re-verified live on 2026-06-09.

### Statutory packs

- Flat POST/PATCH body (no `packData` wrapper)
- `statutoryComponents` always `string[]` in responses
- `gratuity` included on all pack responses
- `DELETE /payroll/statutory-packs/:id` with `409 PACK_IN_USE`
- Errors: `409 PACK_VERSION_EXISTS`, `422 INVALID_PACK`

### Payroll run types

`REGULAR | OFF_CYCLE | BONUS | ARREARS | FNF | REVERSAL` — all live-tested via `npm run verify:phase3-production` (23/23 pass).

---

## Seed & verification commands

### Seed contract fixtures (production-safe, idempotent)

```bash
npm run db:seed:payroll-contract
```

**Before/after counts (example production run):**

| Entity | Before | After |
|--------|--------|-------|
| components | 7 | 8 |
| pay calendars | 5 | 6 |
| legal entities | 1 | 2 |
| contractor invoices | 0 | 1 |
| opening balances | 0 | 1 |

### Live API contract verification

```bash
npm run verify:payroll-contract
```

Expected: **12/12 PASS**

### Phase 3 broader verification (statutory packs + run types + storage)

```bash
npm run verify:phase3-production
```

Expected: **23/23 PASS**

### Playwright live contract test

```bash
npx playwright test tests/e2e/payroll-live-api-contract.spec.ts --project=chromium --workers=1
```

### Quick login (for manual testing)

```bash
curl -s -X POST https://employee-management-system-2b9q.onrender.com/api/v1/auth/login \
  -H "content-type: application/json" \
  -H "x-tenant-key: acme-corp-001" \
  -d '{"email":"superadmin@acme.test","password":"Password123!"}'
```

---

## Summary checklist

| Issue | Endpoint(s) | Status |
|-------|-------------|--------|
| P1 — Component statutory fields | `GET/POST/PATCH /payroll/components` | Fixed & live-verified |
| P2 — Pay calendar shape | `GET/POST/PATCH /payroll/pay-calendars` | Fixed & live-verified |
| P3 — Legal entity `active` | `GET/POST/PATCH /payroll/legal-entities` | Fixed & live-verified |
| P4 — Base path 404s | `/employees`, `/migration`, `/payment-batches`, `/reports`, `/settings` | Fixed & live-verified |
| P5 — Empty seed lists | `/contractor-invoices`, `/opening-balances` | Seeded & shape verified |
| Statutory packs | `/payroll/statutory-packs` | Previously fixed, re-verified |
| Run types | `POST /payroll/runs` | Previously fixed, re-verified |

---

## Known follow-ups (not blocking API contract)

1. **`statutoryTag` in calculation engine** — field is stored and returned; PF/ESI wage-base runtime calculation does not yet consume component tags (configuration-ready).
2. **Older pay calendars** may have `legalEntityId: null` until linked via PATCH or re-seed.
3. **Full deployed UI clickthrough** — run `npm run test:deployed-ui` for end-to-end browser evidence.

---

*For the canonical long-form API reference, see `docs/API_MAPPING.md` (Section F — Payroll).*
