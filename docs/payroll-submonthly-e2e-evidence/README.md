# Sub-Monthly Payroll — E2E Evidence

Evidence pack for the Render QA tenant `Submonthly Payroll QA Inc 20260613-234919`. All files here were captured from the live backend at `https://employee-management-system-2b9q.onrender.com/api/v1` on 2026-06-13T18:19:19.051Z.

## Evidence status

- Deploy: `dep-d8mopocm0tmc73au9a8g`
- Commit: `dda9585f3ebb2c614e1ec8252c3170c73a649cc4`
- Build command proved in Render logs: `npm install && npx prisma generate && npx prisma migrate deploy`
- Migration log proof: `No pending migrations to apply.`
- Tenant scope: `Submonthly Payroll QA Inc 20260613-234919`
- Sanitization: tokens, passwords, cookies, and ids are placeholdered in saved artifacts

## Key results

- PH semi-monthly H1/H2 gross: 50000 + 50000 = 100000
- PH semi-monthly tax: 8437 + 8438 = 16875
- PH semi-monthly SSS_EE: 875 + 875 = 1750
- PH semi-monthly SSS_ER: 1750 + 1750 = 3500
- PH run currency: PHP
- PH monthly regression net pay: 81375 PHP
- India monthly regression currency: INR, FY 2056-57
- PH biweekly 3-cycle SSS_EE totals: 583 + 583 + 584 = 1750
- Work-week override (MON-SAT) workingDays: 13
