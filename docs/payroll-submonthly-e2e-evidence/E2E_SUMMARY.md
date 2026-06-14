# E2E Summary — Sub-Monthly Payroll

## Deploy proof

- Deploy id: `dep-d8mopocm0tmc73au9a8g`
- Commit: `dda9585f3ebb2c614e1ec8252c3170c73a649cc4`
- Status: `live`
- Build finished: `2026-06-13T17:02:35.841105Z`
- Migration log: `No pending migrations to apply.`

## Scenario A — PH semi-monthly H1/H2

- H1 gross 50000, tax 8437, SSS_EE 875, SSS_ER 1750, net 40688, run currency PHP, workingDays 11
- H2 gross 50000, tax 8438, SSS_EE 875, SSS_ER 1750, net 40687, run currency PHP, workingDays 12
- Month totals: gross 100000, tax 16875, SSS_EE 1750, SSS_ER 3500

## Scenario B — PH monthly regression

- Gross 100000
- Tax 16875
- SSS_EE 1750
- SSS_ER 3500
- Net 81375
- Run currency PHP

## Scenario C — India monthly regression

- Gross 83333.33
- TDS 8883
- PF 1800
- PF_ER 1800
- PT 200
- Net 72450.33
- Run currency INR
- Fiscal year 2056-57

## Scenario D — PH biweekly 3-cycle month

- Cycle 1 2057-04-01..2057-04-14: gross 46153.85, tax 5625, SSS_EE 583, SSS_ER 1166, run currency PHP, workingDays 10
- Cycle 2 2057-04-15..2057-04-28: gross 46153.85, tax 5625, SSS_EE 583, SSS_ER 1166, run currency PHP, workingDays 10
- Cycle 3 2057-04-29..2057-05-12: gross 46153.85, tax 5625, SSS_EE 584, SSS_ER 1168, run currency PHP, workingDays 10
- Month total SSS_EE 1750
- Month total SSS_ER 3500

## Scenario E — Pay calendar cycles

- Calendars verified: PH monthly, PH semi-monthly, PH biweekly, PH weekly
- Evidence: `responses/15-pay-calendar-cycles.response.json`

## Scenario F — Work-week

- MON-SAT payslip workingDays 13 for period 1–15 May 2057

## YTD

- Evidence: `responses/17-ytd.response.json`
