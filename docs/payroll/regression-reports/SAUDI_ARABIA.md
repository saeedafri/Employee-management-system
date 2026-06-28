# Payroll Regression — Saudi Arabia (SA)

> Generated: 2026-06-23T11:09:08.794Z
> API: https://ems-api.saqibsaeed.cloud/api/v1
> Tenant: `global-payroll-litmus-001`
> Period: `2026-06`
> Pack version: `2026.1`

## Configuration (data-driven)

| Field | Value |
|-------|-------|
| Currency | SAR |
| Annual CTC | SAR 180,000.00 |
| Monthly gross (100% BASIC) | SAR 15,000.00 |
| Work week | SUN–MON–TUE–WED–THU |
| Legal entity | Saudi Arabia Entity |
| Employee | GL-SA-001 / litmus.sa@global.test |

### Statutory pack summary

```json
{
  "rounding": {
    "mode": "NEAREST",
    "precision": 2
  },
  "proration": {
    "basis": "CALENDAR_DAYS"
  },
  "taxRegimes": [],
  "contributionSchemes": [
    {
      "code": "SA_GOSI",
      "name": "GOSI (expatriate contribution)",
      "wageBaseTag": "GOSI_WAGE",
      "wageCeiling": 4500000,
      "employee": {
        "rate": 9.75,
        "component": "GOSI_EE"
      },
      "employer": {
        "rate": 11.75,
        "component": "GOSI_ER"
      }
    }
  ],
  "localTaxes": [],
  "statutoryComponents": [
    "GOSI_EE",
    "GOSI_ER"
  ]
}
```

**Sources:** GOSI expat rates 9.75% EE / 11.75% ER; no personal income tax on employment income.

## Expected engine output (reference litmus)

| Metric | Amount |
|--------|--------|
| Monthly gross | SAR 15,000.00 |
| Monthly income tax | SAR 0.00 |
| Deduction GOSI_EE | SAR 1,463.00 |
| Employer GOSI_ER | SAR 1,763.00 |
| **Net monthly** | **SAR 13,537.00** |

## Live API payroll run output

| Field | Value |
|-------|-------|
| Run ID | `cmqqjknx0001j98m7n8w2i1wr` |
| Run status | REVIEW |
| Payslip gross | SAR 15,000.00 |
| Payslip deductions | SAR 1,463.00 |
| Payslip net | SAR 13,537.00 |
| Currency | SAR |

### Payslip deduction lines

| Code | Amount |
|------|--------|
| GOSI_EE | SAR 1,463.00 |
| GOSI_ER | SAR 1,763.00 |

## Verdict

**PASS** — Live payroll output matches expected litmus within tolerance.
