# Payroll Regression — Vietnam (VN)

> Generated: 2026-06-23T11:09:09.980Z
> API: https://ems-api.saqibsaeed.cloud/api/v1
> Tenant: `global-payroll-litmus-001`
> Period: `2026-06`
> Pack version: `2026.1`

## Configuration (data-driven)

| Field | Value |
|-------|-------|
| Currency | VND |
| Annual CTC | ₫360,000,000 |
| Monthly gross (100% BASIC) | ₫30,000,000 |
| Work week | MON–TUE–WED–THU–FRI |
| Legal entity | Vietnam Entity |
| Employee | GL-VN-001 / litmus.vn@global.test |

### Statutory pack summary

```json
{
  "rounding": {
    "mode": "NEAREST",
    "precision": 0
  },
  "proration": {
    "basis": "CALENDAR_DAYS"
  },
  "taxRegimes": [
    {
      "code": "VN_PIT",
      "fiscalYear": "2026",
      "currency": "VND",
      "standardDeduction": 11000000,
      "slabs": [
        {
          "from": 0,
          "to": 60000000,
          "rate": 5
        },
        {
          "from": 60000000,
          "to": 120000000,
          "rate": 10
        },
        {
          "from": 120000000,
          "to": 216000000,
          "rate": 15
        },
        {
          "from": 216000000,
          "to": null,
          "rate": 20
        }
      ]
    }
  ],
  "contributionSchemes": [
    {
      "code": "VN_SI",
      "name": "Social Insurance",
      "wageBaseTag": "SI_WAGE",
      "wageCeiling": 4680000000,
      "employee": {
        "rate": 8,
        "component": "SI_EE"
      },
      "employer": {
        "rate": 17.5,
        "component": "SI_ER"
      }
    }
  ],
  "localTaxes": [],
  "statutoryComponents": [
    "SI_EE",
    "SI_ER",
    "PIT"
  ]
}
```

**Sources:** VN PIT progressive 2026-style slabs; SI 8% EE / 17.5% ER on capped base (simplified).

## Expected engine output (reference litmus)

| Metric | Amount |
|--------|--------|
| Monthly gross | ₫30,000,000 |
| Monthly income tax | ₫4,166,667 |
| Deduction SI_EE | ₫2,400,000 |
| Employer SI_ER | ₫5,250,000 |
| **Net monthly** | **₫23,433,333** |

## Live API payroll run output

| Field | Value |
|-------|-------|
| Run ID | `cmqqjkp0v001r98m78cl48bbj` |
| Run status | REVIEW |
| Payslip gross | ₫30,000,000 |
| Payslip deductions | ₫6,566,666 |
| Payslip net | ₫23,433,334 |
| Currency | VND |

### Payslip deduction lines

| Code | Amount |
|------|--------|
| SI_EE | ₫2,400,000 |
| WITHHOLDING_TAX | ₫4,166,666 |
| SI_ER | ₫5,250,000 |

## Verdict

**PASS** — Live payroll output matches expected litmus within tolerance.

## Advisory (not a failure)

- SI wage ceiling in pack uses `4_680_000_000` (stored minor ×100) because the engine divides all ceilings by 100 — effective cap is **₫46,800,000/month**.
- PIT appears on payslip as `WITHHOLDING_TAX` (₫4,166,666), not `PIT`.
