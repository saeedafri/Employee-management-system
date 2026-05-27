# Phase 2 API Specification — Payroll, Reports & Analytics

> **For the backend team.** Every endpoint listed here has a corresponding MSW handler
> in the frontend (`src/mocks/handlers/`) that returns exactly this shape. When an
> endpoint goes live, delete the MSW handler and the frontend keeps working.
>
> **Conventions:**
> - All dates returned as ISO 8601 strings (`2024-06-15T00:00:00.000Z`).
> - All date writes (POST/PATCH bodies) as `YYYY-MM-DD` strings (`"2024-06-15"`).
> - All monetary values as JavaScript numbers with up to 2 decimal places (e.g. `51500.00`). No string formatting — the frontend formats for display.
> - `camelCase` throughout (consistent with employees/departments endpoints).
> - Standard success envelope: `{ "success": true, "data": <payload> }`.
> - Standard error envelope: `{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "details": [{"field":"...", "message":"..."}], "requestId": "..." } }`.
> - All list endpoints include pagination: `{ "data": { "items": [...], "pagination": { "page": 1, "limit": 20, "total": 48, "totalPages": 3 } } }`.
> - Role guard notation: roles that may call each endpoint.

---

## Domain 1 — Payroll Settings

### 1.1 Salary Components

Salary components are the building blocks of compensation. They are fully configurable — no hardcoded country rules. Each component has a `calculationType` that determines how its monthly value is derived.

#### Enums

```ts
type ComponentType =
  | 'EARNING'        // positive — adds to gross pay
  | 'DEDUCTION'      // negative — subtracts from gross
  | 'BENEFIT'        // non-cash benefit (informational, not in net)
  | 'REIMBURSEMENT'; // expense reimbursement (not taxable)

type CalculationType =
  | 'FLAT'           // fixed monthly amount from `value`
  | 'PERCENTAGE'     // `value`% of the component referenced by `basisCode`
  | 'FORMULA';       // expression string in `formula` (see §1.1 Formula Language)
```

#### Formula Language

```
Variables:  any component code (uppercase, e.g. BASIC, HRA, DA)
            CTC       → monthly CTC (annualCtc / 12 from employee salary)
            GROSS     → sum of all EARNING components (auto-calculated, circular-safe)
            NET       → GROSS minus sum of all DEDUCTION components

Functions:  MIN(a, b)            → minimum
            MAX(a, b)            → maximum
            IF(cond, then, else) → conditional; cond uses > < >= <= == !=
            ROUND(n)             → round to nearest integer
            ROUND(n, d)          → round to d decimal places
            FLOOR(n)             → round down to integer
            CEIL(n)              → round up to integer
            ABS(n)               → absolute value

Operators:  + - * / > < >= <= == !=

Examples:
  "BASIC * 0.4"                         HRA = 40% of basic
  "MIN(BASIC * 0.4, 10000)"             HRA capped at ₹10,000
  "IF(BASIC > 15000, 200, 0)"           Tier-based professional tax
  "CTC - BASIC - HRA - LTA - PF"        Special allowance fills remaining CTC
  "BASIC * 0.12"                        PF employer contribution at 12%
  "MAX(GROSS * 0.05, 2500)"             Incentive floor at ₹2,500
```

Calculation order is determined by dependency graph (topological sort). Cycles are rejected by the API (`400 CIRCULAR_DEPENDENCY`).

---

#### `GET /api/v1/payroll/components`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Query params:** `?active=true|false` (default: returns all)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "comp_01JA2B3C4D",
      "name": "Basic Salary",
      "code": "BASIC",
      "type": "EARNING",
      "calculationType": "FLAT",
      "value": 50000.00,
      "basisCode": null,
      "formula": null,
      "taxable": true,
      "active": true,
      "displayOrder": 1,
      "description": "Fixed base salary",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "comp_01JA2B3C4E",
      "name": "House Rent Allowance",
      "code": "HRA",
      "type": "EARNING",
      "calculationType": "PERCENTAGE",
      "value": 40.00,
      "basisCode": "BASIC",
      "formula": null,
      "taxable": false,
      "active": true,
      "displayOrder": 2,
      "description": "40% of basic salary",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "comp_01JA2B3C4F",
      "name": "Professional Tax",
      "code": "PROF_TAX",
      "type": "DEDUCTION",
      "calculationType": "FORMULA",
      "value": null,
      "basisCode": null,
      "formula": "IF(BASIC > 15000, 200, 0)",
      "taxable": false,
      "active": true,
      "displayOrder": 10,
      "description": "State professional tax (Maharashtra slab)",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

---

#### `POST /api/v1/payroll/components`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body:**
```json
{
  "name": "Leave Travel Allowance",
  "code": "LTA",
  "type": "EARNING",
  "calculationType": "FLAT",
  "value": 5000.00,
  "basisCode": null,
  "formula": null,
  "taxable": false,
  "active": true,
  "displayOrder": 3,
  "description": "Annual LTA divided monthly"
}
```

**Field rules:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | Max 100 chars |
| `code` | string | ✓ | UPPER_SNAKE_CASE, max 30 chars, unique per tenant, immutable after creation |
| `type` | ComponentType | ✓ | See enum above |
| `calculationType` | CalculationType | ✓ | |
| `value` | number\|null | conditional | Required if `calculationType = FLAT or PERCENTAGE` |
| `basisCode` | string\|null | conditional | Required if `calculationType = PERCENTAGE`; must be an existing component `code` |
| `formula` | string\|null | conditional | Required if `calculationType = FORMULA`; validated for syntax and circular deps |
| `taxable` | boolean | ✓ | |
| `active` | boolean | ✓ | |
| `displayOrder` | number | ✓ | Integer, controls display order in payslips |
| `description` | string\|null | — | Max 500 chars |

**Success (201):** Same shape as the GET list item.

**Errors:**
- `400 INVALID_FORMULA` — formula fails syntax check or has circular dependency
- `409 CODE_EXISTS` — `code` already taken

---

#### `PATCH /api/v1/payroll/components/:id`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body:** Same as POST, all fields optional. `code` is immutable — if sent, ignored or rejected with `400 CODE_IMMUTABLE`.

**Success (200):** Updated component object (same shape as list item).

**Errors:**
- `404` — component not found
- `400 COMPONENT_IN_USE` — cannot deactivate a component that is referenced in a formula by another active component or assigned to an active pay group (return `{ affectedComponents: ["HRA", "SPECIAL_ALLOW"], affectedPayGroups: ["Standard India"] }` in `error.details`)

---

#### `DELETE /api/v1/payroll/components/:id`

**Roles:** SUPER_ADMIN only

**Success (200):** `{ "success": true, "data": { "deleted": true } }`

**Errors:**
- `409 COMPONENT_IN_USE` — referenced by other formulas or active pay groups

---

### 1.2 Pay Groups

A pay group is a named template that bundles salary components. Employees are assigned a pay group. Group-level overrides allow tweaking a specific component's value for all members of the group.

#### `GET /api/v1/payroll/groups`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pg_01JA2B3C4G",
      "name": "Standard India — Engineering",
      "code": "STANDARD_IND_ENG",
      "currency": "INR",
      "paySchedule": "MONTHLY",
      "description": "Standard compensation for engineering band",
      "active": true,
      "employeeCount": 12,
      "components": [
        {
          "componentId": "comp_01JA2B3C4D",
          "componentCode": "BASIC",
          "componentName": "Basic Salary",
          "componentType": "EARNING",
          "overrideCalculationType": null,
          "overrideValue": null,
          "overrideFormula": null
        },
        {
          "componentId": "comp_01JA2B3C4E",
          "componentCode": "HRA",
          "componentName": "House Rent Allowance",
          "componentType": "EARNING",
          "overrideCalculationType": "PERCENTAGE",
          "overrideValue": 50.00,
          "overrideFormula": null
        }
      ],
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

**Pay schedule enum:** `MONTHLY | BIWEEKLY | WEEKLY`

---

#### `POST /api/v1/payroll/groups`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body:**
```json
{
  "name": "Standard India — Engineering",
  "code": "STANDARD_IND_ENG",
  "currency": "INR",
  "paySchedule": "MONTHLY",
  "description": "Engineering band",
  "active": true,
  "components": [
    {
      "componentId": "comp_01JA2B3C4D",
      "overrideCalculationType": null,
      "overrideValue": null,
      "overrideFormula": null
    },
    {
      "componentId": "comp_01JA2B3C4E",
      "overrideCalculationType": "PERCENTAGE",
      "overrideValue": 50.00,
      "overrideFormula": null
    }
  ]
}
```

**Success (201):** Full pay group object as in GET list.

**Errors:**
- `409 CODE_EXISTS`
- `404 COMPONENT_NOT_FOUND` — one of the `componentId`s is invalid
- `400 INVALID_OVERRIDE_FORMULA`

---

#### `PATCH /api/v1/payroll/groups/:id`

Same shape as POST body, all fields optional. `code` is immutable.

---

#### `DELETE /api/v1/payroll/groups/:id`

**Roles:** SUPER_ADMIN

**Errors:** `409 GROUP_HAS_EMPLOYEES` — `{ employeeCount: 12 }` in details

---

### 1.3 Pay Schedules

Defines pay period cadence for groups that use BIWEEKLY or WEEKLY. MONTHLY groups don't need a schedule record — they default to calendar month.

#### `GET /api/v1/payroll/schedules`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "sched_01JA",
      "name": "Bi-weekly US",
      "frequency": "BIWEEKLY",
      "startDate": "2024-01-01",
      "timezone": "America/New_York",
      "nextRunDate": "2024-06-28",
      "active": true
    }
  ]
}
```

---

## Domain 2 — Employee Payroll

### 2.1 Employee Salary Config

#### `GET /api/v1/payroll/employees/:employeeId/salary`

**Roles:** HR_ADMIN, SUPER_ADMIN (any employee); EMPLOYEE (own only — limited fields)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "esal_01JA2B3C4H",
    "employeeId": "emp_01JA2B3C4A",
    "payGroupId": "pg_01JA2B3C4G",
    "payGroup": {
      "id": "pg_01JA2B3C4G",
      "name": "Standard India — Engineering",
      "code": "STANDARD_IND_ENG",
      "currency": "INR",
      "paySchedule": "MONTHLY"
    },
    "annualCtc": 1200000.00,
    "effectiveFrom": "2024-01-15",
    "effectiveTo": null,
    "bankAccountName": "Priya Sharma",
    "bankAccountNumber": "XXXX1234",
    "bankIfscCode": "SBIN0001234",
    "bankName": "State Bank of India",
    "calculatedComponents": [
      {
        "code": "BASIC",
        "name": "Basic Salary",
        "type": "EARNING",
        "monthlyAmount": 50000.00,
        "taxable": true
      },
      {
        "code": "HRA",
        "name": "House Rent Allowance",
        "type": "EARNING",
        "monthlyAmount": 25000.00,
        "taxable": false
      },
      {
        "code": "PROF_TAX",
        "name": "Professional Tax",
        "type": "DEDUCTION",
        "monthlyAmount": 200.00,
        "taxable": false
      }
    ],
    "monthlyGross": 100000.00,
    "monthlyDeductions": 12800.00,
    "monthlyNet": 87200.00,
    "history": [
      {
        "id": "esal_01JA2B3C4I",
        "annualCtc": 1000000.00,
        "effectiveFrom": "2023-01-15",
        "effectiveTo": "2024-01-14",
        "payGroupCode": "STANDARD_IND_ENG"
      }
    ],
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

Note: `bankAccountNumber` is masked for non-HR roles.

---

#### `POST /api/v1/payroll/employees/:employeeId/salary`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body:**
```json
{
  "payGroupId": "pg_01JA2B3C4G",
  "annualCtc": 1200000.00,
  "effectiveFrom": "2024-06-01",
  "bankAccountName": "Priya Sharma",
  "bankAccountNumber": "XXXXXXXXXX1234",
  "bankIfscCode": "SBIN0001234",
  "bankName": "State Bank of India"
}
```

If a salary record already exists for this employee, the current record's `effectiveTo` is set to `effectiveFrom - 1 day` and a new record is created. This preserves salary history.

**Success (201):** Full salary object as in GET.

---

#### `PATCH /api/v1/payroll/employees/:employeeId/salary`

Same body as POST, all fields optional. Always creates a new history record — does NOT edit in place.

---

### 2.2 Employee Payslips (self-service)

#### `GET /api/v1/payroll/employees/:employeeId/payslips`

**Roles:** HR_ADMIN, SUPER_ADMIN (any); EMPLOYEE (own only)

**Query params:** `?page=1&limit=12&year=2024`

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "slip_01JA2B3C4J",
        "period": "2024-06",
        "periodLabel": "June 2024",
        "currency": "INR",
        "grossEarnings": 100000.00,
        "totalDeductions": 12800.00,
        "netPay": 87200.00,
        "status": "PAID",
        "paymentDate": "2024-06-30",
        "payrollRunId": "run_01JA2B3C4K"
      }
    ],
    "pagination": { "page": 1, "limit": 12, "total": 18, "totalPages": 2 }
  }
}
```

---

#### `GET /api/v1/payroll/employees/:employeeId/payslips/:payslipId`

**Roles:** HR_ADMIN, SUPER_ADMIN, EMPLOYEE (own only)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "slip_01JA2B3C4J",
    "period": "2024-06",
    "periodLabel": "June 2024",
    "currency": "INR",
    "employee": {
      "id": "emp_01JA2B3C4A",
      "firstName": "Priya",
      "lastName": "Sharma",
      "employeeCode": "E0042",
      "designation": "Software Engineer",
      "departmentName": "Engineering",
      "panNumber": "ABCDE1234F"
    },
    "company": {
      "name": "Acme Corp",
      "address": "123 Tech Park, Pune 411001",
      "logoUrl": "https://..."
    },
    "earnings": [
      { "code": "BASIC", "name": "Basic Salary", "amount": 50000.00, "taxable": true },
      { "code": "HRA", "name": "House Rent Allowance", "amount": 25000.00, "taxable": false },
      { "code": "LTA", "name": "Leave Travel Allowance", "amount": 5000.00, "taxable": false },
      { "code": "SPECIAL_ALLOW", "name": "Special Allowance", "amount": 20000.00, "taxable": true }
    ],
    "deductions": [
      { "code": "PF", "name": "Provident Fund", "amount": 6000.00 },
      { "code": "PROF_TAX", "name": "Professional Tax", "amount": 200.00 },
      { "code": "TDS", "name": "TDS (Income Tax)", "amount": 6600.00 }
    ],
    "oneTimeAdditions": [
      { "description": "Performance Bonus Q1", "amount": 10000.00 }
    ],
    "oneTimeDeductions": [],
    "grossEarnings": 100000.00,
    "totalDeductions": 12800.00,
    "netPay": 87200.00,
    "workingDays": 22,
    "presentDays": 22,
    "leaveDays": 0,
    "lopDays": 0,
    "status": "PAID",
    "paymentDate": "2024-06-30",
    "paymentReference": "NEFT/2024/06/0042",
    "payrollRunId": "run_01JA2B3C4K",
    "generatedAt": "2024-06-28T10:00:00.000Z"
  }
}
```

---

## Domain 3 — Payroll Operations

### 3.1 Payroll Runs

#### Enums

```ts
type PayrollRunStatus =
  | 'DRAFT'       // initiated, not yet calculated
  | 'CALCULATING' // server is running the computation
  | 'REVIEW'      // calculation done, awaiting HR review
  | 'APPROVED'    // HR approved, ready to pay
  | 'PAID'        // payment disbursed
  | 'CANCELLED';  // voided
```

---

#### `GET /api/v1/payroll/runs`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Query params:** `?page=1&limit=10&year=2024&status=PAID`

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "run_01JA2B3C4K",
        "period": "2024-06",
        "periodLabel": "June 2024",
        "status": "PAID",
        "employeeCount": 48,
        "totalGross": 4800000.00,
        "totalDeductions": 614400.00,
        "totalNet": 4185600.00,
        "currency": "INR",
        "initiatedBy": "hr@acme.test",
        "approvedBy": "superadmin@acme.test",
        "processedAt": "2024-06-28T10:00:00.000Z",
        "approvedAt": "2024-06-29T09:00:00.000Z",
        "paidAt": "2024-06-30T00:00:00.000Z",
        "createdAt": "2024-06-25T08:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 18, "totalPages": 2 }
  }
}
```

---

#### `POST /api/v1/payroll/runs`

Initiates a new payroll run.

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body:**
```json
{
  "period": "2024-07",
  "payGroupIds": ["pg_01JA2B3C4G"],
  "includeAllActiveEmployees": true
}
```

If `includeAllActiveEmployees: true`, `payGroupIds` is ignored — all employees with a salary config are included.

**Success (201):**
```json
{
  "success": true,
  "data": {
    "id": "run_01JA2B3C4L",
    "period": "2024-07",
    "periodLabel": "July 2024",
    "status": "DRAFT",
    "employeeCount": 0,
    "totalGross": 0,
    "totalDeductions": 0,
    "totalNet": 0,
    "createdAt": "2024-07-01T08:00:00.000Z"
  }
}
```

**Errors:**
- `409 RUN_EXISTS` — a run for this period already exists (non-CANCELLED)

---

#### `POST /api/v1/payroll/runs/:id/calculate`

Triggers server-side calculation. Moves status from `DRAFT` → `CALCULATING` → `REVIEW` (async). Poll `GET /payroll/runs/:id` for status change. When status = `REVIEW`, the payslips are populated.

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body:** `{}` (empty)

**Success (202):**
```json
{
  "success": true,
  "data": { "status": "CALCULATING", "estimatedSeconds": 5 }
}
```

---

#### `GET /api/v1/payroll/runs/:id`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Response:** Full run object + `summary` block:
```json
{
  "success": true,
  "data": {
    "id": "run_01JA2B3C4K",
    "period": "2024-06",
    "periodLabel": "June 2024",
    "status": "REVIEW",
    "employeeCount": 48,
    "totalGross": 4800000.00,
    "totalDeductions": 614400.00,
    "totalNet": 4185600.00,
    "currency": "INR",
    "summary": {
      "byDepartment": [
        { "departmentName": "Engineering", "employeeCount": 12, "totalNet": 1245000.00 },
        { "departmentName": "HR", "employeeCount": 5, "totalNet": 390000.00 }
      ],
      "warnings": [
        { "employeeId": "emp_01JA", "employeeName": "Ravi Mehta", "message": "No salary config assigned — employee skipped" }
      ]
    },
    "createdAt": "2024-06-25T08:00:00.000Z",
    "processedAt": "2024-06-28T10:00:00.000Z"
  }
}
```

---

#### `POST /api/v1/payroll/runs/:id/approve`

Moves status from `REVIEW` → `APPROVED`.

**Roles:** SUPER_ADMIN (or HR_ADMIN if policy allows)

**Request body:** `{ "notes": "Approved for June payroll disbursement" }`

**Success (200):** Updated run object with `status: "APPROVED"`.

---

#### `PATCH /api/v1/payroll/runs/:id/mark-paid`

Moves status from `APPROVED` → `PAID`. Records payment date.

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body:**
```json
{
  "paidAt": "2024-06-30",
  "paymentReference": "NEFT/2024/06/BATCH001"
}
```

**Success (200):** Updated run object.

---

#### `POST /api/v1/payroll/runs/:id/cancel`

Voids a run (any status except PAID).

**Roles:** SUPER_ADMIN

**Request body:** `{ "reason": "Recalculation needed" }`

---

### 3.2 Payslips within a Run

#### `GET /api/v1/payroll/runs/:runId/payslips`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Query params:** `?page=1&limit=20&departmentId=&search=` (search on employee name or code)

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "slip_01JA2B3C4J",
        "employeeId": "emp_01JA2B3C4A",
        "employeeCode": "E0042",
        "employeeName": "Priya Sharma",
        "departmentName": "Engineering",
        "designation": "Software Engineer",
        "currency": "INR",
        "grossEarnings": 100000.00,
        "totalDeductions": 12800.00,
        "netPay": 87200.00,
        "workingDays": 22,
        "presentDays": 22,
        "lopDays": 0,
        "status": "PENDING",
        "hasAdjustments": false
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 48, "totalPages": 3 }
  }
}
```

---

#### `GET /api/v1/payroll/runs/:runId/payslips/:payslipId`

Returns the full detailed payslip object — same shape as `GET /payroll/employees/:employeeId/payslips/:payslipId`.

---

#### `PATCH /api/v1/payroll/runs/:runId/payslips/:payslipId`

Add one-time adjustments before approving the run.

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body:**
```json
{
  "oneTimeAdditions": [
    { "description": "Performance Bonus Q1", "amount": 10000.00 }
  ],
  "oneTimeDeductions": [
    { "description": "Salary advance recovery", "amount": 5000.00 }
  ],
  "notes": "Bonus for Q1 target achievement"
}
```

**Success (200):** Updated payslip detail object.

---

#### `GET /api/v1/payroll/runs/:runId/export`

Download payroll register as CSV.

**Roles:** HR_ADMIN, SUPER_ADMIN

**Response:** `Content-Type: text/csv` (binary download)

---

---

## Domain 4 — Reports

All report endpoints accept common filter params unless specified otherwise. Reports are computed on-demand.

**Common query params:**
- `startDate` (`YYYY-MM-DD`)
- `endDate` (`YYYY-MM-DD`)
- `departmentId` (filter by department)
- `employmentType` (`FULL_TIME | PART_TIME | CONTRACT | INTERNSHIP`)

All responses follow the pattern:
```json
{
  "success": true,
  "data": {
    "meta": {
      "reportName": "Headcount Report",
      "generatedAt": "2024-06-30T10:00:00.000Z",
      "filters": { "startDate": "2024-01-01", "endDate": "2024-06-30" }
    },
    "summary": { ... },
    "chartData": [ ... ],
    "tableData": { "items": [...], "pagination": {...} }
  }
}
```

---

### 4.1 Workforce Reports

#### `GET /api/v1/reports/workforce/headcount`

Headcount over time — how many employees at the end of each month.

**Query params:** `startDate`, `endDate`, `departmentId`

**Response `data` shape:**
```json
{
  "meta": { "reportName": "Headcount Report", "generatedAt": "...", "filters": {} },
  "summary": {
    "currentHeadcount": 48,
    "changeFromStart": 6,
    "changePercent": 14.3,
    "netHires": 8,
    "netExits": 2
  },
  "chartData": [
    { "month": "2024-01", "monthLabel": "Jan 2024", "headcount": 42, "hires": 0, "exits": 0 },
    { "month": "2024-02", "monthLabel": "Feb 2024", "headcount": 44, "hires": 3, "exits": 1 },
    { "month": "2024-03", "monthLabel": "Mar 2024", "headcount": 46, "hires": 2, "exits": 0 }
  ],
  "tableData": {
    "items": [
      {
        "departmentName": "Engineering",
        "startHeadcount": 10,
        "endHeadcount": 12,
        "hires": 3,
        "exits": 1,
        "changePercent": 20.0
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
  }
}
```

---

#### `GET /api/v1/reports/workforce/turnover`

Attrition/turnover — exits over the period.

**Query params:** `startDate`, `endDate`, `departmentId`

**Response `data.summary`:**
```json
{
  "totalExits": 4,
  "voluntaryExits": 3,
  "involuntaryExits": 1,
  "averageHeadcount": 46,
  "attritionRate": 8.7
}
```

**Response `data.chartData`:**
```json
[
  { "month": "2024-01", "monthLabel": "Jan 2024", "exits": 0, "attritionRate": 0.0 },
  { "month": "2024-02", "monthLabel": "Feb 2024", "exits": 1, "attritionRate": 2.3 }
]
```

**Response `data.tableData.items`:**
```json
[
  {
    "employeeId": "emp_01JA",
    "employeeCode": "E0021",
    "employeeName": "Amit Kumar",
    "departmentName": "Engineering",
    "designation": "Backend Engineer",
    "exitDate": "2024-02-15",
    "exitType": "VOLUNTARY",
    "tenure": "1 year 3 months"
  }
]
```

---

#### `GET /api/v1/reports/workforce/demographics`

Breakdown by employment type, gender, department.

**Response `data`:**
```json
{
  "meta": { ... },
  "byEmploymentType": [
    { "type": "FULL_TIME", "count": 38, "percent": 79.2 },
    { "type": "CONTRACT", "count": 6, "percent": 12.5 },
    { "type": "PART_TIME", "count": 3, "percent": 6.3 },
    { "type": "INTERNSHIP", "count": 1, "percent": 2.1 }
  ],
  "byDepartment": [
    { "departmentName": "Engineering", "count": 12, "percent": 25.0 }
  ],
  "byGender": [
    { "gender": "MALE", "count": 28, "percent": 58.3 },
    { "gender": "FEMALE", "count": 19, "percent": 39.6 },
    { "gender": "OTHER", "count": 1, "percent": 2.1 }
  ]
}
```

---

### 4.2 Attendance Reports

#### `GET /api/v1/reports/attendance/summary`

Monthly attendance summary per employee.

**Query params:** `month` (`YYYY-MM`), `departmentId`, `page`, `limit`

**Response `data.summary`:**
```json
{
  "month": "2024-06",
  "totalWorkingDays": 22,
  "avgAttendancePercent": 91.8,
  "totalPresent": 1014,
  "totalAbsent": 90,
  "totalLeave": 44
}
```

**Response `data.tableData.items`:**
```json
[
  {
    "employeeId": "emp_01JA",
    "employeeCode": "E0042",
    "employeeName": "Priya Sharma",
    "departmentName": "Engineering",
    "presentDays": 21,
    "absentDays": 1,
    "leaveDays": 0,
    "wfhDays": 5,
    "halfDays": 0,
    "lateDays": 2,
    "attendancePercent": 95.5
  }
]
```

---

#### `GET /api/v1/reports/attendance/absenteeism`

Absenteeism trend — unauthorized absences over time.

**Query params:** `startDate`, `endDate`, `departmentId`

**Response `data.chartData`:**
```json
[
  { "month": "2024-01", "monthLabel": "Jan 2024", "absenteeismRate": 3.2, "absences": 12, "employees": 42 }
]
```

**Response `data.tableData.items`:**
```json
[
  {
    "employeeId": "emp_01JA",
    "employeeName": "Ravi Mehta",
    "absentDays": 5,
    "unauthorizedAbsences": 3,
    "leaveDays": 2,
    "absenteeismRate": 22.7
  }
]
```

---

### 4.3 Leave Reports

#### `GET /api/v1/reports/leave/utilization`

How much of allocated leave is being used.

**Query params:** `year` (default current year), `departmentId`, `leaveTypeId`

**Response `data.summary`:**
```json
{
  "year": 2024,
  "totalAllocated": 1200,
  "totalTaken": 387,
  "totalPending": 23,
  "utilizationRate": 32.3,
  "avgDaysPerEmployee": 8.1
}
```

**Response `data.chartData`:**
```json
[
  {
    "leaveTypeName": "Annual",
    "leaveTypeCode": "ANNUAL",
    "allocated": 504,
    "taken": 189,
    "pending": 12,
    "utilizationRate": 37.5
  }
]
```

**Response `data.tableData.items`:**
```json
[
  {
    "employeeId": "emp_01JA",
    "employeeName": "Priya Sharma",
    "annualAllocated": 21,
    "annualTaken": 8,
    "annualPending": 3,
    "annualBalance": 10,
    "sickAllocated": 12,
    "sickTaken": 2,
    "sickBalance": 10
  }
]
```

---

#### `GET /api/v1/reports/leave/pending`

All pending leave requests across the org.

**Query params:** `departmentId`, `leaveTypeId`, `page`, `limit`

**Response `data.tableData.items`:**
```json
[
  {
    "id": "lr_01JA",
    "referenceNo": "LR-024",
    "employeeName": "Priya Sharma",
    "leaveTypeName": "Annual",
    "startDate": "2024-07-15",
    "endDate": "2024-07-17",
    "totalDays": 3,
    "reason": "Family trip",
    "appliedAt": "2024-07-01T10:00:00.000Z",
    "daysPending": 3
  }
]
```

---

### 4.4 Payroll Reports

#### `GET /api/v1/reports/payroll/summary`

Payroll cost by month and department.

**Query params:** `startDate`, `endDate`, `departmentId`

**Response `data.summary`:**
```json
{
  "totalPayrollCost": 14400000.00,
  "avgMonthlyPayroll": 2400000.00,
  "totalEmployees": 48,
  "currency": "INR",
  "monthsIncluded": 6
}
```

**Response `data.chartData`:**
```json
[
  {
    "month": "2024-01",
    "monthLabel": "Jan 2024",
    "totalGross": 2200000.00,
    "totalDeductions": 281600.00,
    "totalNet": 1918400.00,
    "employeeCount": 42
  }
]
```

**Response `data.tableData.items`:**
```json
[
  {
    "departmentName": "Engineering",
    "employeeCount": 12,
    "totalGross": 720000.00,
    "totalDeductions": 92160.00,
    "totalNet": 627840.00,
    "avgNetPerEmployee": 52320.00
  }
]
```

---

#### `GET /api/v1/reports/payroll/ctc-analysis`

CTC band distribution + salary percentile analysis.

**Query params:** `departmentId`, `asOf` (date, default today)

**Response `data`:**
```json
{
  "meta": { ... },
  "bands": [
    { "label": "< ₹5L", "count": 3, "percent": 6.3 },
    { "label": "₹5L – ₹10L", "count": 14, "percent": 29.2 },
    { "label": "₹10L – ₹20L", "count": 22, "percent": 45.8 },
    { "label": "> ₹20L", "count": 9, "percent": 18.8 }
  ],
  "percentiles": {
    "p25": 800000.00,
    "p50": 1200000.00,
    "p75": 1800000.00,
    "p90": 2400000.00
  }
}
```

---

### 4.5 Report Export

#### `POST /api/v1/reports/export`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Request body:**
```json
{
  "reportType": "attendance/summary",
  "format": "CSV",
  "filters": {
    "month": "2024-06",
    "departmentId": null
  }
}
```

**`reportType` values:** `workforce/headcount`, `workforce/turnover`, `workforce/demographics`, `attendance/summary`, `attendance/absenteeism`, `leave/utilization`, `leave/pending`, `payroll/summary`, `payroll/ctc-analysis`

**`format` values:** `CSV` (PDF is Phase 3)

**Success (200):** `Content-Type: text/csv` binary download. Filename in `Content-Disposition: attachment; filename="attendance-summary-2024-06.csv"`.

---

## Domain 5 — Analytics (Enhanced)

These extend the existing analytics endpoints. Existing endpoints (`/analytics/summary`, `/analytics/attendance`, `/analytics/headcount-by-department`, `/analytics/recent-activity`, `/analytics/leave-summary`) are live and unchanged.

### 5.1 Workforce Trend (new)

#### `GET /api/v1/analytics/workforce-trend`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Query params:** `?range=6m|12m|2y` (default `6m`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "month": "2024-01",
      "monthLabel": "Jan 2024",
      "headcount": 42,
      "hires": 3,
      "exits": 1,
      "netChange": 2
    },
    {
      "month": "2024-02",
      "monthLabel": "Feb 2024",
      "headcount": 44,
      "hires": 2,
      "exits": 0,
      "netChange": 2
    }
  ]
}
```

---

### 5.2 Attrition Rate (new)

#### `GET /api/v1/analytics/attrition`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Query params:** `?range=6m|12m|2y`

**Response:**
```json
{
  "success": true,
  "data": {
    "currentMonthRate": 2.3,
    "rollingAnnualRate": 8.7,
    "trend": [
      { "month": "2024-01", "monthLabel": "Jan 2024", "rate": 0.0, "exits": 0 },
      { "month": "2024-02", "monthLabel": "Feb 2024", "rate": 2.3, "exits": 1 }
    ]
  }
}
```

---

### 5.3 Payroll Cost Trend (new)

#### `GET /api/v1/analytics/payroll-cost`

**Roles:** HR_ADMIN, SUPER_ADMIN

**Query params:** `?range=6m|12m`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "month": "2024-01",
      "monthLabel": "Jan 2024",
      "totalNet": 1918400.00,
      "totalGross": 2200000.00,
      "employeeCount": 42,
      "avgNetPerEmployee": 45676.19
    }
  ]
}
```

---

### 5.4 Department Performance (new)

#### `GET /api/v1/analytics/department-performance`

**Roles:** HR_ADMIN, SUPER_ADMIN, MANAGER (own dept only)

**Query params:** `?range=30d|90d`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "departmentId": "dept_01JA",
      "departmentName": "Engineering",
      "headcount": 12,
      "attendanceRate": 93.2,
      "leaveRate": 4.5,
      "pendingApprovals": 2,
      "avgTenureMonths": 18.4
    }
  ]
}
```

---

## Appendix A — Shared Enums Reference

```ts
// Already defined in codebase — listed here for completeness
type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';
type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | 'ON_LEAVE';
type MemberType = 'SUPER_ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'AUDITOR';

// New for Phase 2
type ComponentType = 'EARNING' | 'DEDUCTION' | 'BENEFIT' | 'REIMBURSEMENT';
type CalculationType = 'FLAT' | 'PERCENTAGE' | 'FORMULA';
type PaySchedule = 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY';
type PayrollRunStatus = 'DRAFT' | 'CALCULATING' | 'REVIEW' | 'APPROVED' | 'PAID' | 'CANCELLED';
type PayslipStatus = 'PENDING' | 'PAID' | 'HELD';
type ReportFormat = 'CSV';
type AnalyticsRange = '7d' | '30d' | '90d' | '6m' | '12m' | '2y';
```

---

## Appendix B — MSW Handler Files (frontend)

When an endpoint goes live, delete the corresponding MSW handler:

| Endpoint | MSW handler file |
|---|---|
| All `/payroll/components/*` | `src/mocks/handlers/payroll-components.ts` |
| All `/payroll/groups/*` | `src/mocks/handlers/payroll-groups.ts` |
| All `/payroll/schedules` | `src/mocks/handlers/payroll-groups.ts` |
| All `/payroll/employees/:id/salary*` | `src/mocks/handlers/payroll-employee.ts` |
| All `/payroll/runs/*` | `src/mocks/handlers/payroll-runs.ts` |
| All `/reports/*` | `src/mocks/handlers/reports.ts` |
| `GET /analytics/workforce-trend` | `src/mocks/handlers/analytics.ts` |
| `GET /analytics/attrition` | `src/mocks/handlers/analytics.ts` |
| `GET /analytics/payroll-cost` | `src/mocks/handlers/analytics.ts` |
| `GET /analytics/department-performance` | `src/mocks/handlers/analytics.ts` |
