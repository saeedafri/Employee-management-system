# UI Contract — Sub-Monthly Payroll

## PaySchedule Enum (all endpoints)

```
MONTHLY | SEMI_MONTHLY | BIWEEKLY | WEEKLY
```

## Period Formats

| paySchedule  | period format  | example       | meaning            |
|-------------|---------------|---------------|--------------------|
| MONTHLY     | `YYYY-MM`     | `2057-01`     | Jan 2057 full month |
| SEMI_MONTHLY| `YYYY-MM-H1`  | `2057-01-H1`  | Jan 1–15           |
| SEMI_MONTHLY| `YYYY-MM-H2`  | `2057-01-H2`  | Jan 16–31          |
| BIWEEKLY    | `YYYY-Wnn`    | `2057-W02`    | ISO week 2         |
| WEEKLY      | `YYYY-Wnn`    | `2057-W03`    | ISO week 3         |

## POST /payroll/runs — Request Body

```json
{
  "period": "2057-01-H1",
  "startDate": "2057-01-01",
  "endDate": "2057-01-15",
  "payDate": "2057-01-15",
  "paySchedule": "SEMI_MONTHLY",
  "type": "REGULAR",
  "payGroupIds": ["<PAY_GROUP_ID>"]
}
```

`startDate`/`endDate`/`payDate` are **derived & persisted** for MONTHLY and SEMI_MONTHLY when omitted.
For **BIWEEKLY** `startDate`+`endDate` are **required** (a `YYYY-Wnn` string can't encode a 14-day cycle).
For any `YYYY-Wnn` period, `paySchedule` is **required** (weekly vs bi-weekly is otherwise ambiguous → 422).
`payDate` defaults to `endDate`.

## GET /payroll/runs/:id — Response

New fields added:
```json
{
  "period": "2057-01-H1",
  "periodLabel": "1–15 Jan 2057",
  "startDate": "2057-01-01",
  "endDate": "2057-01-15",
  "payDate": "2057-01-15",
  "paySchedule": "SEMI_MONTHLY"
}
```

`startDate`, `endDate`, `payDate`, `paySchedule` are **null** for legacy MONTHLY runs created before this migration.

## GET /payroll/pay-calendars/:id/cycles

Query params: `?from=YYYY-MM&to=YYYY-MM`

Response:
```json
{
  "success": true,
  "data": {
    "payCalendarId": "<ID>",
    "paySchedule": "SEMI_MONTHLY",
    "cycles": [
      {
        "period": "2057-01-H1",
        "periodLabel": "1–15 Jan 2057",
        "startDate": "2057-01-01",
        "endDate": "2057-01-15",
        "payDate": "2057-01-15",
        "cutoffDate": "2057-01-14",
        "paySchedule": "SEMI_MONTHLY"
      },
      {
        "period": "2057-01-H2",
        "periodLabel": "16–31 Jan 2057",
        "startDate": "2057-01-16",
        "endDate": "2057-01-31",
        "payDate": "2057-01-31",
        "cutoffDate": "2057-01-25",
        "paySchedule": "SEMI_MONTHLY"
      }
    ]
  }
}
```

## Payslip Shape — deductionsJson

Deductions are dynamic. Render all entries. Key codes:
- `WITHHOLDING_TAX` — income tax per cycle
- `SSS_EE` — SSS employee contribution (PH)
- `PF_EE` — PF employee contribution (IN)
- `ESI_EE` — ESI employee contribution (IN)

## Payslip Shape — employerContributionsJson

Same dynamic array — display as employer cost breakdown:
- `SSS_ER` — SSS employer contribution (PH)
- `PF_ER` — PF employer contribution (IN)

## workingDays Behavior

- **MONTHLY**: counts Mon–Fri within the full calendar month
- **SEMI_MONTHLY H1**: counts Mon–Fri within 1st–15th only
- **SEMI_MONTHLY H2**: counts Mon–Fri within 16th–EOM only
- **BIWEEKLY / WEEKLY**: counts Mon–Fri within cycle startDate–endDate

## Contribution Apportionment (MONTHLY_TOTAL)

For PH SSS (wageCeiling = PHP 35,000/month):

| cycle | SSS_EE | SSS_ER |
|-------|--------|--------|
| H1    | 875    | 1750   |
| H2    | 875    | 1750   |
| **month total** | **1750** | **3500** |

Monthly total is **always correct**; H1/H2 split evenly (remainder to H2).

## Gross / Tax per Cycle

| paySchedule  | annual CTC 1,200,000 | gross/cycle | tax (annual 202,500) |
|-------------|----------------------|-------------|----------------------|
| MONTHLY     | /12 = 100,000        | 100,000     | 16,875 (monthly total) |
| SEMI_MONTHLY| /24 = 50,000         | 50,000      | 8,437 (H1) + 8,438 (H2) = 16,875 |
| BIWEEKLY    | /26 ≈ 46,154         | ~46,154     | monthly 16,875 split over cycles in month (last absorbs remainder) |
| WEEKLY      | /52 ≈ 23,077         | ~23,077     | monthly 16,875 split over cycles in month |

> **Tax model:** income tax is withheld by **monthly total** (`round(annualTax/12)`), then
> split across the actual number of cycles in that calendar month — the last cycle absorbs
> the rounding remainder. This guarantees the month total is exact regardless of pay frequency
> and is identical to the MONTHLY figure. (annualTax 202,500 → 16,875/month for the PH example.)

---

## Canonical endpoint examples (sub-monthly)

All requests need `Authorization: Bearer <ACCESS_TOKEN>` and `x-tenant-key: <TENANT_ID>`.
Values are the calibrated PH semi-monthly example; ids are placeholders.

### POST /payroll/legal-entities  (with workWeekPattern)
```json
{ "name": "QA — Philippines", "country": "PH", "currency": "PHP",
  "fiscalYearStartMonth": 1, "workWeekPattern": "MON-FRI",
  "statutoryPackId": "<PH_STATUTORY_PACK_ID>", "payCalendarId": "<PAY_CALENDAR_ID>" }
```

### POST /payroll/statutory-packs  (MONTHLY_TOTAL contribution + TRAIN tax)
```json
{ "country": "PH", "version": "2057-v1", "effectiveFrom": "2057-01-01",
  "contributionSchemes": [
    { "code": "SSS", "wageBaseTag": "SSS_BASE", "wageCeiling": 3500000,
      "apportionmentMode": "MONTHLY_TOTAL",
      "employee": { "component": "SSS_EE", "rate": 5 },
      "employer": { "component": "SSS_ER", "rate": 10 } } ],
  "taxRegimes": [ { "taxCode": "WITHHOLDING_TAX", "standardDeduction": 0, "slabs": [ /* TRAIN, see requests/02 */ ] } ] }
```
> Monetary pack fields are in **minor units** (centavos ×100). `wageCeiling` 3,500,000 = ₱35,000/month.

### POST /payroll/groups  (SEMI_MONTHLY)
```json
{ "name": "PH Semi-Monthly", "code": "PH_SEMI", "currency": "PHP",
  "paySchedule": "SEMI_MONTHLY", "components": [ { "componentId": "<BASIC_ID>" } ] }
```

### POST /payroll/employees/:id/salary
```json
{ "payGroupId": "<PAY_GROUP_ID>", "annualCtc": 1200000, "effectiveFrom": "2057-01-01",
  "legalEntityId": "<PH_LEGAL_ENTITY_ID>", "country": "PH", "currency": "PHP" }
```

### POST /payroll/runs  (semi-monthly H1)  → run currency follows the PHP pay group
```json
{ "period": "2057-01-H1", "startDate": "2057-01-01", "endDate": "2057-01-15",
  "payDate": "2057-01-15", "paySchedule": "SEMI_MONTHLY", "type": "REGULAR",
  "payGroupIds": ["<PAY_GROUP_ID>"] }
```
Response `data` includes `periodLabel: "1–15 Jan 2057"`, `startDate/endDate/payDate`,
`paySchedule: "SEMI_MONTHLY"`, `currency: "PHP"`.

### GET /payroll/runs/:id
Returns `PayrollRunSummary` incl. `startDate`, `endDate`, `payDate`, `paySchedule`, `currency`.

### POST /payroll/runs/:id/calculate  → 202, builds payslips.

### GET /payroll/runs/:id/payslips  → list (currency PHP per payslip).

### GET /payroll/runs/:runId/payslips/:payslipId  (PH H1 payslip)
```json
{ "period": "2057-01-H1", "periodLabel": "1–15 Jan 2057", "currency": "PHP", "workingDays": 11,
  "earnings": [ { "code": "BASIC", "amount": 50000 } ],
  "deductions": [ { "code": "SSS_EE", "amount": 875 }, { "code": "WITHHOLDING_TAX", "amount": 8437 } ],
  "employerContributions": [ { "code": "SSS_ER", "amount": 1750 } ],
  "grossEarnings": 50000, "totalDeductions": 9312, "netPay": 40688 }
```
Bi-weekly payslips render `periodLabel` as a date range (e.g. `Jan 1 – Jan 14, 2057`) using the run's startDate/endDate.

### GET /payroll/pay-calendars/:id/cycles?from=2057-01&to=2057-01
Returns computed cycles — see `responses/13-pay-calendar-cycles.json`.
