# UI Contract — Sub-Monthly Payroll

## Render-verified tenant

- Tenant: `Submonthly Payroll QA Inc 20260613-234919`
- Base URL: `https://employee-management-system-2b9q.onrender.com/api/v1`
- Auth bootstrap: `POST /auth/register` then bearer auth with `x-tenant-key`

## PaySchedule enum

`MONTHLY | SEMI_MONTHLY | BIWEEKLY | WEEKLY`

## Period formats verified live

- `2057-01`
- `2057-01-H1`
- `2057-01-H2`
- `2057-W13` / `2057-W15` / `2057-W17` with explicit `paySchedule: BIWEEKLY`

## Render-verified results

- PH H1 run currency PHP; payslip currency PHP; gross 50000; tax 8437; SSS_EE 875; SSS_ER 1750; workingDays 11
- PH H2 run currency PHP; payslip currency PHP; gross 50000; tax 8438; SSS_EE 875; SSS_ER 1750; workingDays 12
- PH monthly run currency PHP; gross 100000; tax 16875; SSS_EE 1750; SSS_ER 3500; net 81375
- India monthly run currency INR; gross 83333.33; TDS 8883; PF 1800; PF_ER 1800; PT 200; net 72450.33
- Biweekly 3-cycle month SSS_EE: 583 + 583 + 584 = 1750
- Biweekly 3-cycle month SSS_ER: 1166 + 1166 + 1168 = 3500
- Work-week override `MON-SAT`: workingDays 13

## Endpoint artifacts

See `responses/01-register-company.response.json` through `responses/17-ytd.response.json` for the exact sanitized request/response shapes captured from Render.
