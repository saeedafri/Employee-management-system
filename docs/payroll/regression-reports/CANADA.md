# Payroll Regression — Canada (CA)

> Generated: 2026-06-23T11:09:11.170Z
> API: https://ems-api.saqibsaeed.cloud/api/v1
> Tenant: `global-payroll-litmus-001`
> Period: `2026-06`
> Pack version: `2026.1`

## Configuration (data-driven)

| Field | Value |
|-------|-------|
| Currency | CAD |
| Annual CTC | CA$60,000.00 |
| Monthly gross (100% BASIC) | CA$5,000.00 |
| Work week | MON–TUE–WED–THU–FRI |
| Legal entity | Canada Entity |
| Employee | GL-CA-001 / litmus.ca@global.test |

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
  "taxRegimes": [
    {
      "code": "CA_FED",
      "fiscalYear": "2026",
      "currency": "CAD",
      "standardDeduction": 1570500,
      "slabs": [
        {
          "from": 0,
          "to": 5586700,
          "rate": 15
        },
        {
          "from": 5586700,
          "to": 11173300,
          "rate": 20.5
        },
        {
          "from": 11173300,
          "to": 17320500,
          "rate": 26
        },
        {
          "from": 17320500,
          "to": 24675200,
          "rate": 29
        },
        {
          "from": 24675200,
          "to": null,
          "rate": 33
        }
      ]
    }
  ],
  "contributionSchemes": [
    {
      "code": "CA_CPP",
      "name": "CPP",
      "wageBaseTag": "CPP_WAGE",
      "wageCeiling": 500000,
      "employee": {
        "rate": 5.95,
        "component": "CPP_EE"
      },
      "employer": {
        "rate": 5.95,
        "component": "CPP_ER"
      }
    },
    {
      "code": "CA_EI",
      "name": "EI",
      "wageBaseTag": "CPP_WAGE",
      "wageCeiling": 500000,
      "employee": {
        "rate": 1.64,
        "component": "EI_EE"
      },
      "employer": {
        "rate": 2.296,
        "component": "EI_ER"
      }
    }
  ],
  "localTaxes": [],
  "statutoryComponents": [
    "CPP_EE",
    "CPP_ER",
    "EI_EE",
    "EI_ER",
    "FED_TAX"
  ]
}
```

**Sources:** Federal brackets 2026 approx; CPP 5.95% / EI 1.64% EE on monthly pensionable (simplified cap).

## Expected engine output (reference litmus)

| Metric | Amount |
|--------|--------|
| Monthly gross | CA$5,000.00 |
| Monthly income tax | CA$554.00 |
| Deduction CPP_EE | CA$298.00 |
| Deduction EI_EE | CA$82.00 |
| Employer CPP_ER | CA$298.00 |
| Employer EI_ER | CA$115.00 |
| **Net monthly** | **CA$4,066.00** |

## Live API payroll run output

| Field | Value |
|-------|-------|
| Run ID | `cmqqjkpwx001z98m7q94fp6t6` |
| Run status | REVIEW |
| Payslip gross | CA$5,000.00 |
| Payslip deductions | CA$933.00 |
| Payslip net | CA$4,067.00 |
| Currency | CAD |

### Payslip deduction lines

| Code | Amount |
|------|--------|
| CPP_EE | CA$298.00 |
| EI_EE | CA$82.00 |
| WITHHOLDING_TAX | CA$553.00 |
| CPP_ER | CA$298.00 |
| EI_ER | CA$115.00 |

## Verdict

**PASS** — Live payroll output matches expected litmus within tolerance.

## Advisory (not a failure)

- Federal withholding: engine returns `WITHHOLDING_TAX` **CA$553.00** vs reference litmus **CA$554.00** (CA$1 annualized slab rounding).
- Net pay **CA$4,067.00** vs reference **CA$4,066.00** — within ±CA$3 tolerance.
- UI should display tax line as `WITHHOLDING_TAX`, not `FED_TAX` from pack config.
