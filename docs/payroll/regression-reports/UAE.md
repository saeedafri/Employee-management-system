# Payroll Regression — United Arab Emirates (AE)

> Generated: 2026-06-23T11:09:09.409Z
> API: https://ems-api.saqibsaeed.cloud/api/v1
> Tenant: `global-payroll-litmus-001`
> Period: `2026-06`
> Pack version: `2026.1`

## Configuration (data-driven)

| Field | Value |
|-------|-------|
| Currency | AED |
| Annual CTC | AED 240,000.00 |
| Monthly gross (100% BASIC) | AED 20,000.00 |
| Work week | SUN–MON–TUE–WED–THU |
| Legal entity | United Arab Emirates Entity |
| Employee | GL-AE-001 / litmus.ae@global.test |

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
  "contributionSchemes": [],
  "localTaxes": [],
  "statutoryComponents": [],
  "gratuity": {
    "daysPerYear": 21,
    "monthDivisor": 30,
    "minYears": 1
  }
}
```

**Sources:** UAE: no PIT on employment; EOS gratuity accrual config-only (not deducted from net pay in this litmus).

## Expected engine output (reference litmus)

| Metric | Amount |
|--------|--------|
| Monthly gross | AED 20,000.00 |
| Monthly income tax | AED 0.00 |
| **Net monthly** | **AED 20,000.00** |

## Live API payroll run output

| Field | Value |
|-------|-------|
| Run ID | `cmqqjkokw001n98m7bsmssxyl` |
| Run status | REVIEW |
| Payslip gross | AED 20,000.00 |
| Payslip deductions | AED 0.00 |
| Payslip net | AED 20,000.00 |
| Currency | AED |

### Payslip deduction lines

| Code | Amount |
|------|--------|

## Verdict

**PASS** — Live payroll output matches expected litmus within tolerance.
