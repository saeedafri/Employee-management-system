# Payroll API — Response Reference (MSW → Backend swap)

> For the UI team. The live backend is a drop-in replacement for the MSW payroll handlers
> (`ems-frontend/src/mocks/handlers/payroll-*.ts`). **All 97 MSW endpoints exist in the
> backend** (verified). Captured on **2026-06-15** against the **live Render DB**
> (`employee_m2e9`) via the backend running the `fix/payroll-msw-parity` branch — so the
> H5–H9/H12 fixes are reflected. Read-path examples are **real live captures**; write-path
> success bodies are shape-accurate (not executed against prod to avoid mutating data).
>
> Parity gaps still open (Stage 2 — change India numbers, tracked in
> `docs/MSW_BACKEND_PARITY_PAYROLL.md`): LOP proration, YTD tax true-up, annual tax base,
> regime-from-declaration, bonus marginal tax, professional tax.

## Conventions
- **Base path:** `/api/v1/payroll` (MSW used `/api/payroll`; the FE BFF rewrites `/api/*` →
  `${API_BASE_URL}/*`, so paths line up).
- **Headers:** `Authorization: Bearer <accessToken>`, `content-type: application/json`.
- **Success envelope:** `{ "success": true, "data": <T>, "meta"?: {} }`
- **Error envelope:** `{ "success": false, "error": { "code", "message", "details", "requestId" } }`
- **Roles:** most payroll routes are `HR_ADMIN` / `SUPER_ADMIN`; employee self-service reads
  (`/payroll/employees/:id/payslips`, `/tax-form`) allow the owner.
- Money is **major units** (₹) on these endpoints unless noted; dates `YYYY-MM-DD`, periods `YYYY-MM`.

### Differences from MSW (the UI reads by key)
| Where | MSW | Backend | Impact |
|---|---|---|---|
| every success | `{success,data}` | `+ meta:{}` sometimes | none |
| bank-file `?format=` | NACH/ACH/SEPA/BACS column registry | ✅ **now matches** (H9) | ✅ fixed |
| invalid `format` | `422 UNKNOWN_FORMAT` | `422 VALIDATION_ERROR` (route enum) | both 422; code differs |
| reimbursement categories | `FUEL/TELEPHONE/INTERNET/MEAL` (minor units) | `TRAVEL/FOOD/MEDICAL/INTERNET/EQUIPMENT/BOOKS` (major units) | ⚠️ **H8** — codes + unit differ; align together |
| `CLAIM_OVER_CAP` | 422 on submit over cap | ✅ **now enforced** (H8) | ✅ fixed |
| garnishment `amount` | `{kind,value}` nested | ✅ matches (`{kind,value}`) | ✅ |
| surcharge | `[{thresholdAnnual,rate}]` bands | ✅ accepts bands **or** scalar (H12) | ✅ |
| payslip net | garnishment/loan/claim/one-time included | ✅ **now included** (H5/H6/H7/M2) | ✅ when data exists |

---

## 1. `GET /payroll/components` → `SalaryComponent[]`
```jsonc
{ "success": true, "data": [
  { "id": "cmqbxhv0q002u49ddmnluk7k2", "name": "ZA Basic Pay", "code": "ZA_BASIC",
    "type": "EARNING", "calculationType": "FLAT", "value": 41666, "basisCode": null,
    "formula": null, "taxable": true, "active": true, "displayOrder": 0,
    "description": null, "color": "#16a34a", "statutoryTag": null,
    "prorate": true, "payInPeriods": null, "glAccountCode": null, "costCenterRule": "NONE",
    "createdAt": "2026-06-13T05:42:19.466Z", "updatedAt": "2026-06-13T05:42:19.466Z" }
] }
```
> `prorate` + `payInPeriods` drive LOP proration / scheduled components (Stage 2).

## 2. `GET /payroll/reimbursement-categories` → `Category[]`  ⚠️ H8
```jsonc
{ "success": true, "data": [
  { "id": "rcat-001", "code": "TRAVEL",   "label": "Travel & Conveyance", "monthlyCap": 5000,  "color": "#6366f1" },
  { "id": "rcat-002", "code": "FOOD",     "label": "Food & Meals",        "monthlyCap": 3000,  "color": "#f59e0b" },
  { "id": "rcat-003", "code": "MEDICAL",  "label": "Medical",             "monthlyCap": 15000, "color": "#ef4444" },
  { "id": "rcat-004", "code": "INTERNET", "label": "Internet & Phone",    "monthlyCap": 1500,  "color": "#8b5cf6" },
  { "id": "rcat-005", "code": "EQUIPMENT","label": "Equipment & Supplies","monthlyCap": 10000, "color": "#10b981" },
  { "id": "rcat-006", "code": "BOOKS",    "label": "Books & Courses",     "monthlyCap": 5000,  "color": "#3b82f6" }
] }
```
> **Caps are MAJOR units** here (₹5,000). MSW caps are minor units (e.g. FUEL `1500000`) and
> use codes `FUEL/TELEPHONE/INTERNET/MEAL`. UI + backend must agree on one canonical list.

## 3. `GET /payroll/reimbursement-claims?status=&employeeId=` → `{claims,total,...}`
```jsonc
{ "success": true, "data": { "claims": [
  { "id": "b5812d35-…", "employeeId": "cmq6w2hh5001m19wg8yk2mngg", "category": "EQUIPMENT",
    "categoryLabel": "Equipment & Supplies", "amount": 8000, "currency": "INR",
    "description": "Keyboard + mouse", "proofUrl": null, "status": "APPROVED",
    "runId": null, "submittedAt": "2026-06-07T18:54:19.952Z", "decidedAt": "2026-06-09T17:41:45.731Z" }
] } }
```
> This APPROVED claim has `runId: null` → on the next `calculate` (H7) it attaches to the run
> and is paid as a non-taxable one-time addition; on `mark-paid` it flips to `PAID`.
> `POST /payroll/reimbursement-claims` with `amount > category.monthlyCap` now → `422 CLAIM_OVER_CAP` (H8).

## 4. `GET /payroll/employees/:id/garnishments` → `Garnishment[]`
```jsonc
{ "success": true, "data": [
  { "id": "3720757f-…", "employeeId": "cmq6w2hh5001m19wg8yk2mngg", "type": "TAX_LEVY",
    "priority": 1, "amount": { "kind": "FLAT", "value": 3000 },
    "protectedEarningsFloor": 20000, "cap": null, "reference": "TAX-LEVY-2025",
    "effectiveFrom": "2025-04-01", "effectiveTo": null,
    "createdAt": "2026-06-09T17:41:53.180Z", "updatedAt": "2026-06-09T17:41:53.180Z" } ] }
```
> Active order → on `calculate` (H5) a `GARN_<id>` deduction is withheld in priority order
> from disposable (gross − statutory), respecting `protectedEarningsFloor` and `cap`.

## 5. `GET /payroll/employees/:id/loans` → `EmployeeLoan[]` (empty here)
`{ "success": true, "data": [] }` — when present, active loans deduct `min(emi, balance)` as `EMI_<id>` (H6).

## 6. `GET /payroll/runs/:id` → `PayrollRun`
```jsonc
{ "success": true, "data": {
  "id": "cmq6w863u00au19wgz7b8rr72", "period": "2026-05", "status": "PAID", "type": "REGULAR",
  "employeeCount": 3, "totalGross": 230050, "totalDeductions": 30000, "totalNet": 200050,
  "employerCost": 0, "currency": "INR", "published": false, "approvals": [ … ] } }
```

## 7. `GET /payroll/runs/:id/payslips` → `{ items: Payslip[] }`
```jsonc
{ "success": true, "data": { "items": [
  { "id": "cmq6w86jp00aw19wgc5i2y4pm", "employeeId": "cmq6w2hh5001m19wg8yk2mngg",
    "employeeCode": "E0003", "employeeName": "HR Admin", "departmentName": "HR",
    "designation": "HR Manager", "currency": "INR", "grossEarnings": 90000,
    "totalDeductions": 11000, "netPay": 79000, "workingDays": 22, "presentDays": 22,
    "lopDays": 0, "status": "PAID", "hasAdjustments": false } ] } }
```

## 8. `GET /payroll/runs/:id/register?type=SALARY|STATUTORY|BANK_ADVICE|VARIANCE`
Self-describing columns + rows (UI renders generically by `column.kind`):
```jsonc
{ "success": true, "data": {
  "register": "SALARY", "runId": "cmq6w863u00au19wgz7b8rr72", "period": "2026-05",
  "periodLabel": "May 2026", "currency": "INR",
  "columns": [
    { "key": "employeeCode", "label": "Code", "align": "left", "kind": "text" },
    { "key": "grossEarnings", "label": "Gross", "align": "right", "kind": "money" },
    { "key": "totalDeductions", "label": "Deductions", "align": "right", "kind": "money" },
    { "key": "netPay", "label": "Net Pay", "align": "right", "kind": "money" },
    { "key": "employerCost", "label": "Employer Cost", "align": "right", "kind": "money" } ],
  "rows": [ { "employeeCode": "E0101", "employeeName": "Arjun Nair", "department": "Engineering",
    "grossEarnings": 90000, "totalDeductions": 6075, "netPay": 83925, "employerCost": 90000 } ] } }
```

## 9. `GET /payroll/runs/:id/journal` → balanced double-entry `JournalDocument`
```jsonc
{ "success": true, "data": { "runId": "cmq6w863u00au19wgz7b8rr72", "period": "2026-05", "currency": "INR",
  "lines": [
    { "account": "Salary Expense",   "costCenter": "Engineering", "debit": 90000, "credit": 0,     "currency": "INR" },
    { "account": "Tax Payable",      "costCenter": "Engineering", "debit": 0,     "credit": 6075,  "currency": "INR" },
    { "account": "Salaries Payable", "costCenter": "Engineering", "debit": 0,     "credit": 83925, "currency": "INR" } ],
  "totalDebit": …, "totalCredit": …, "balanced": true } }
```

## 10. `GET /payroll/runs/:id/payment-batch` → `PaymentBatch`
```jsonc
{ "success": true, "data": {
  "id": "f4abf089-…", "runId": "cmq6w863u00au19wgz7b8rr72", "count": 10, "totalAmount": 769187,
  "currency": "INR", "status": "COMPLETED", "createdAt": "2026-06-09T17:49:32.801Z",
  "reconciledAt": "2026-05-28T10:00:00.000Z",
  "lines": [ { "payslipId": "14986ec0-…", "employeeId": "cmq6w96oy000h11mr853wggyj",
    "employeeCode": "E0101", "employeeName": "Arjun Nair", "amount": 83925, "currency": "INR",
    "status": "PAID", "failureReason": null, "payoutRef": null } ] } }
```

## 11. `GET /payroll/runs/:id/bank-file?format=NACH|ACH|SEPA|BACS`  ✅ H9 (live capture)
Text file (`Content-Disposition: attachment`). **Columns are format-specific, from the registry** —
real output against run `2026-05`:
```text
# format=NACH
BeneficiaryCode,BeneficiaryName,IFSC,AccountNumber,Amount,Reference
E0101,Arjun Nair,HDFC0000,000001015500,83925.00,
E0003,HR Admin,HDFC0000,000000035500,79000.00,

# format=ACH
EmployeeId,Name,RoutingNumber,AccountNumber,Amount,Currency
E0101,Arjun Nair,021000010,000001015500,83925.00,INR

# format=SEPA
CreditorName,IBAN,BIC,Amount,Currency,RemittanceInfo
Arjun Nair,DE890001010000000000,DEUTDEFFXXX,83925.00,INR,

# format=BACS
Name,SortCode,AccountNumber,Amount,Reference
Arjun Nair,00-01-01,000001015500,83925.00,
```
> Bank identifiers (IBAN/BIC/SortCode/RoutingNumber) are deterministically synthesized per
> employee code — byte-identical to the FE `syntheticBank()`. An unsupported `format` →
> `422` (route enum validation).

## 12. `GET /payroll/cost-summary?groupBy=entity|currency|classification`
```jsonc
{ "success": true, "data": {
  "groupBy": "classification", "baseCurrency": "INR", "totalBaseCost": 3221666, "totalWorkers": 101,
  "groups": [ { "key": "EMPLOYEE", "workerCount": 98, "baseAmount": 2901666 },
              { "key": "CONTRACTOR", "workerCount": 3, "baseAmount": 320000 } ],
  "fxRates": { "INR": 1, "USD": 83, "EUR": 90, "GBP": 105, "AED": 22, "SGD": 62 } } }
```

## 13. `GET /payroll/employees/:id/ytd?fy=` → fiscal-year-to-date ledger
```jsonc
{ "success": true, "data": {
  "fiscalYear": "2026-27", "monthsElapsed": 2, "grossEarnings": 180000, "taxableIncome": 156600,
  "taxDeducted": 13000, "totalDeductions": 22000, "netPay": 158000, "contributions": { "PF": 2200 } } }
```

## 14. `GET /payroll/settings`
```jsonc
{ "success": true, "data": {
  "defaultCountry": "IN", "defaultCurrency": "INR", "sandboxMode": true,
  "dataPolicy": { "defaultRetentionYears": 7, "policies": [ { "country": "IN",
    "residencyRegion": "ap-south-1", "retentionYears": 8, "statutoryHold": true } ] },
  "features": { "payrollEnabled": true, "contractorInvoices": true, "openingBalances": true,
    "statutoryPacks": true, "offCycleRuns": true } } }
```

## 15. Other live-verified reads (200, real data)
`GET /payroll/groups` (39) · `/payroll/event-catalogue` (8) · `/payroll/pay-calendars` (16) ·
`/payroll/legal-entities` (15) · `/payroll/countries` (4) · `/payroll/workers` (101) ·
`/payroll/contractor-invoices` (1) · `/payroll/runs/:id/variance` · `/payroll/employees/:id/salary`.

---

## Capture method
Backend (`fix/payroll-msw-parity`) run locally against the live Render DB (read-only GETs; no
writes/deletes), authenticated as `hr@acme.test` (tenant `acme-corp-001`). Run used:
`cmq6w863u00au19wgz7b8rr72` (period `2026-05`, `PAID`). No production data was mutated.
