# Payroll Regression — Singapore (SG)

> Generated: 2026-06-23T11:09:10.556Z
> API: https://ems-api.saqibsaeed.cloud/api/v1
> Tenant: `global-payroll-litmus-001`
> Period: `2026-06`
> Pack version: `2026.1`

## Configuration (data-driven)

| Field | Value |
|-------|-------|
| Currency | SGD |
| Annual CTC | SGD 72,000.00 |
| Monthly gross (100% BASIC) | SGD 6,000.00 |
| Work week | MON–TUE–WED–THU–FRI |
| Legal entity | Singapore Entity |
| Employee | GL-SG-001 / litmus.sg@global.test |

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
      "code": "SG_CPF",
      "name": "CPF (age ≤55)",
      "wageBaseTag": "CPF_OW",
      "wageCeiling": 680000,
      "employee": {
        "rate": 20,
        "component": "CPF_EE"
      },
      "employer": {
        "rate": 17,
        "component": "CPF_ER"
      }
    }
  ],
  "localTaxes": [],
  "statutoryComponents": [
    "CPF_EE",
    "CPF_ER"
  ]
}
```

**Sources:** CPF OW ceiling SGD 6,800 (2025); EE 20% / ER 17% for ≤55 (litmus simplified).

## Expected engine output (reference litmus)

| Metric | Amount |
|--------|--------|
| Monthly gross | SGD 6,000.00 |
| Monthly income tax | SGD 0.00 |
| Deduction CPF_EE | SGD 1,200.00 |
| Employer CPF_ER | SGD 1,020.00 |
| **Net monthly** | **SGD 4,800.00** |

## Live API payroll run output

| Field | Value |
|-------|-------|
| Run ID | `cmqqjkph5001v98m7c2fqwg04` |
| Run status | REVIEW |
| Payslip gross | SGD 6,000.00 |
| Payslip deductions | SGD 1,200.00 |
| Payslip net | SGD 4,800.00 |
| Currency | SGD |

### Payslip deduction lines

| Code | Amount |
|------|--------|
| CPF_EE | SGD 1,200.00 |
| CPF_ER | SGD 1,020.00 |

## Verdict

**PASS** — Live payroll output matches expected litmus within tolerance.
