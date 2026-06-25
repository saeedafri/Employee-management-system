# Payroll — Run & Payslip Response Structure (for UI team)

> **Backend status:** ✅ Semi-monthly compute fixed + live-verified on
> `https://ems-api.saqibsaeed.cloud/api/v1` (commit `de5e5a6`, 2026-06-26).
> Earnings **and** every deduction now prorate per cycle: **H1 + H2 == one MONTHLY run,
> line-for-line** (earnings, PF, PF_ER, TDS, withholding tax, garnishment, net).
> All examples below are **real, unedited** live responses for Priya Sharma (CTC 900,000).

---

## 0. What changed (so the UI knows what to expect now)

| Field / line | Before (buggy) | After (fixed) |
|---|---|---|
| H1/H2 earnings | full month (BASIC 50,000) | **half** (BASIC 25,000); H1+H2 = month |
| `PF` / `PF_ER` | **absent** (wage base = 0) | present; H1 900 + H2 900 = month 1,800 |
| `WITHHOLDING_TAX` on H1/H2 | **0** | half each; H1 271 + H2 271 = month 542 |
| FLAT garnishment on H1/H2 | full each (10 + 10 = 20 ✗) | half each; 5 + 5 = month 10 |
| MONTHLY run (any field) | — | **unchanged / byte-identical** |

**No response shape changed — only the computed amounts.** Existing rendering keeps working.

---

## 1. Create a run — `POST /payroll/runs`

**MONTHLY:**
```json
{ "period": "2026-10" }
```
**SEMI_MONTHLY (one cycle):**
```json
{
  "period": "2026-10-H1",
  "paySchedule": "SEMI_MONTHLY",
  "startDate": "2026-10-01",
  "endDate": "2026-10-15"
}
```
- `period` format: `YYYY-MM` (monthly) or `YYYY-MM-H1` / `YYYY-MM-H2` (semi-monthly).
- `startDate`/`endDate` are **`YYYY-MM-DD`** and **must be valid calendar dates**
  (e.g. don't send `2026-02-31`). Validation error otherwise:
  `{"code":"VALIDATION_ERROR","details":[{"field":"endDate","message":"must match format \"date\""}]}`.
- Returns `{ success, data: { id, ... } }`. Keep `data.id` = the **runId**.

Then trigger calculation: **`POST /payroll/runs/{runId}/calculate`** (body `{}`).

---

## 2. Read the run — `GET /payroll/runs/{runId}`

```jsonc
{
  "success": true,
  "data": {
    "id": "cmqtuztv1002x5teqvp4efas3",
    "period": "2026-10-H1",
    "periodLabel": "1–15 Oct 2026",
    "startDate": "2026-10-01",
    "endDate": "2026-10-15",
    "payDate": "2026-10-15",
    "paySchedule": "SEMI_MONTHLY",      // or "MONTHLY"
    "type": "REGULAR",
    "status": "REVIEW",                 // DRAFT → REVIEW → APPROVED → PAID (read after calculate)
    "employeeCount": 5,
    "totalGross": 107400,
    "totalDeductions": 15018,
    "totalNet": 92382,
    "employerCost": 110100,
    "currency": "INR",
    "processedAt": "2026-06-25T18:52:10.488Z",
    "approvedAt": null,
    "paidAt": null,
    "published": false,
    "approvals": [],
    "createdAt": "2026-06-25T18:52:10.093Z",
    "summary": {
      "byDepartment": [
        { "departmentName": "Engineering", "employeeCount": 2, "totalNet": 61753 }
      ],
      "warnings": [
        // ⚠️ surface these to admins — a contribution that should exist but didn't is shown here,
        // NOT silently dropped. Examples:
        { "employeeId": "…", "message": "No statutory pack resolved — statutory contributions skipped" },
        { "employeeId": "…", "message": "STATUTORY_WAGE_BASE_EMPTY: scheme IN_EPF found no component tagged PF_WAGE" }
      ]
    }
  }
}
```
> **`summary.warnings[]`** is the new guardrail. If PF/PF_ER is missing for someone, the reason
> is here. Render it on the run review screen.

---

## 3. List payslips in a run — `GET /payroll/runs/{runId}/payslips`

Returns `{ success, data: { items: [...] } }`. Each item is a **summary row**:
```jsonc
{
  "id": "cmqtuzu4k002z5tequz0q9fyn",   // payslipId → use for the detail call
  "employeeId": "cmqjpydsb001mkpjdxlgw74tv",
  "employeeCode": "E0003",
  "employeeName": "HR Admin",
  "departmentName": "HR",
  "designation": "HR Manager",
  "currency": "INR",
  "grossEarnings": 35800,
  "totalDeductions": 5171,
  "netPay": 30629,
  "workingDays": 11,
  "presentDays": 11,
  "lopDays": 0,
  "status": "PENDING",
  "hasAdjustments": false
}
```

---

## 4. Payslip detail — `GET /payroll/runs/{runId}/payslips/{payslipId}`

Also available per employee: `GET /payroll/employees/{employeeId}/payslips/{payslipId}`
(and `GET /payroll/employees/{employeeId}/payslips?year=YYYY` to list across runs).

> ⚠️ **When summing H1 + H2, read each payslip from its OWN run**
> (`/payroll/runs/{runId}/payslips`). The cross-run list
> (`/employees/{id}/payslips?year=`) can return multiple payslips for the same `period`
> string from different runs — don't `.find` by period there.

**Real H1 (1–15 Oct) detail — note every line is the per-cycle (half) amount:**
```jsonc
{
  "success": true,
  "data": {
    "id": "cmqtuzu5v00375teq9y8dzbc8",
    "period": "2026-10-H1",
    "periodLabel": "1–15 Oct 2026",
    "currency": "INR",
    "employee": {
      "id": "cmqjpyds7001kkpjdnlhjygrp",
      "firstName": "Priya", "lastName": "Sharma",
      "employeeCode": "E0002",
      "designation": "Senior Engineer",
      "departmentName": "Engineering",
      "panNumber": null
    },
    "company": { "name": "Acme Corp", "address": null, "logoUrl": null },

    "earnings": [
      { "code": "BASIC",      "name": "Basic Salary",            "amount": 25000, "monthlyAmount": 25000, "taxable": true },
      { "code": "HRA",        "name": "House Rent Allowance",    "amount": 10000, "monthlyAmount": 10000, "taxable": false },
      { "code": "CONVEYANCE", "name": "Conveyance Allowance",    "amount":   800, "monthlyAmount":   800, "taxable": false }
    ],
    "deductions": [
      { "code": "TDS",             "name": "Income Tax (TDS)",                       "amount": 2500, "taxable": false },
      { "code": "PF",              "name": "Employees' Provident Fund (Employee)",   "amount":  900, "taxable": false },
      { "code": "WITHHOLDING_TAX", "name": "Withholding Tax",                        "amount":  271, "taxable": false },
      { "code": "GARN_91416552-…", "name": "Garnishment (LOAN_RECOVERY)",            "amount":    5, "taxable": false }
    ],
    "employerContributions": [
      { "code": "PF_ER", "name": "Employees' Provident Fund (Employer)", "type": "EMPLOYER_CONTRIBUTION", "amount": 900, "taxable": false }
    ],

    "employerCost": 36700,
    "oneTimeAdditions": [],
    "oneTimeDeductions": [],
    "grossEarnings": 35800,
    "totalDeductions": 3676,
    "netPay": 32124,
    "workingDays": 11,
    "presentDays": 11,
    "leaveDays": 0,
    "lopDays": 0,
    "status": "PENDING",
    "paymentDate": null,
    "paymentReference": null,
    "payrollRunId": "cmqtuztv1002x5teqvp4efas3",
    "documentUrl": null,
    "generatedAt": "2026-06-25T18:52:10.482Z",
    "ytd": {
      "fiscalYear": "2026-27",
      "monthsElapsed": 14,
      "grossEarnings": 866000,
      "taxableIncome": 753420,
      "taxDeducted": 65376,
      "totalDeductions": 80186,
      "netPay": 785814,
      "contributions": { "PF": 14700, "PF_ER": 14700 }
    }
  },
  "meta": {}
}
```

### Field notes for rendering
- **`earnings[]` / `deductions[]` / `employerContributions[]`** — render dynamically by
  `code`/`name`/`amount`. Do **not** hardcode a fixed line set; garnishment/loan/reimbursement
  lines appear only when applicable, and codes like `GARN_<id>` / `EMI_<id>` are dynamic.
- **`amount`** is the amount **for this payslip's period** (per-cycle for H1/H2, full for monthly).
  Always display/sum `amount`.
- **`monthlyAmount`** mirrors the cycle figure on sub-monthly slips (it is **not** the full
  month). Don't show it as "monthly" for H1/H2 — prefer `amount`.
- `employerContributions[]` (e.g. `PF_ER`) are **employer cost**, not deducted from net.
- `grossEarnings = Σ earnings.amount`; `netPay = grossEarnings − totalDeductions`
  (employer contributions excluded).
- `ytd` is fiscal-year-to-date for the employee; safe to show on the payslip header.

---

## 5. The invariant the UI can rely on

For the same employee + month:
```
H1.amount(line) + H2.amount(line) === MONTHLY.amount(line)   // every earning, deduction, employer line
H1.netPay       + H2.netPay       === MONTHLY.netPay          // ±1 rounding goes to the last cycle (H2)
```
Verified live (Priya, Oct 2026):

| Line | MONTHLY | H1 | H2 | H1+H2 |
|---|--:|--:|--:|--:|
| BASIC | 50,000 | 25,000 | 25,000 | 50,000 ✓ |
| HRA | 20,000 | 10,000 | 10,000 | 20,000 ✓ |
| CONVEYANCE | 1,600 | 800 | 800 | 1,600 ✓ |
| TDS | 5,000 | 2,500 | 2,500 | 5,000 ✓ |
| PF | 1,800 | 900 | 900 | 1,800 ✓ |
| PF_ER | 1,800 | 900 | 900 | 1,800 ✓ |
| WITHHOLDING_TAX | 542 | 271 | 271 | 542 ✓ |
| Garnishment | 10 | 5 | 5 | 10 ✓ |
| **netPay** | **64,248** | 32,124 | 32,124 | **64,248 ✓** |

> The ±1 last-cycle rounding (e.g. 32,130 / 32,129 in a different month) is expected and
> correct — the remainder is assigned to the last cycle so the month total is exact.
