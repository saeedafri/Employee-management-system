#!/usr/bin/env bash
# Sub-monthly payroll E2E test sequence — local DB only
# Replace BASE_URL with local server, never onrender.com
BASE_URL="http://localhost:3000/api/v1"
TENANT="submonthly-qa-001"

# 0. Login as super admin (created via seed on local DB)
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: $TENANT" \
  -d '{"email":"admin@submonthly-qa.test","password":"Password123!"}' \
  | jq -r '.data.accessToken')
AUTH="Authorization: Bearer $TOKEN"

# 1. Create PH statutory pack with MONTHLY_TOTAL SSS apportionment
curl -s -X POST "$BASE_URL/payroll/statutory-packs" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: $TENANT" \
  -H "$AUTH" \
  -d @requests/02-create-ph-statutory-pack.json | jq .

# 2. Create PH legal entity
curl -s -X POST "$BASE_URL/payroll/legal-entities" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: $TENANT" \
  -H "$AUTH" \
  -d @requests/03-create-ph-legal-entity.json | jq .

# 3. Create salary components (BASIC, HRA, SSS_EE, SSS_ER)
curl -s -X POST "$BASE_URL/payroll/components" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: $TENANT" \
  -H "$AUTH" \
  -d @requests/04-create-ph-components.json | jq .

# 4. Create semi-monthly pay group
curl -s -X POST "$BASE_URL/payroll/groups" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: $TENANT" \
  -H "$AUTH" \
  -d @requests/05-create-semi-monthly-pay-group.json | jq .

# 5. Create employee
curl -s -X POST "$BASE_URL/employees" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: $TENANT" \
  -H "$AUTH" \
  -d @requests/06-create-ph-employee.json | jq .

# 6. Set salary (annualCtc = 120000000 paise = PHP 1,200,000)
curl -s -X POST "$BASE_URL/payroll/salaries" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: $TENANT" \
  -H "$AUTH" \
  -d @requests/07-set-ph-salary.json | jq .

# 7. Create H1 payroll run
curl -s -X POST "$BASE_URL/payroll/runs" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: $TENANT" \
  -H "$AUTH" \
  -d @requests/08-create-h1-run.json | jq .

# 8. Create H2 payroll run
curl -s -X POST "$BASE_URL/payroll/runs" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: $TENANT" \
  -H "$AUTH" \
  -d @requests/09-create-h2-run.json | jq .

# 9. Get pay calendar cycles (Scenario E)
PAY_CAL_ID="<PAY_CALENDAR_ID>"
curl -s "$BASE_URL/payroll/pay-calendars/$PAY_CAL_ID/cycles?from=2057-01&to=2057-01" \
  -H "x-tenant-key: $TENANT" \
  -H "$AUTH" | jq .

# 10. Bi-weekly run — explicit dates required (Scenario D)
curl -s -X POST "$BASE_URL/payroll/runs" \
  -H "Content-Type: application/json" -H "x-tenant-key: $TENANT" -H "$AUTH" \
  -d @requests/10-create-biweekly-run.json | jq .

# 11. Monthly regression run (Scenario B) — period only; dates derived & persisted
curl -s -X POST "$BASE_URL/payroll/runs" \
  -H "Content-Type: application/json" -H "x-tenant-key: $TENANT" -H "$AUTH" \
  -d @requests/11-create-monthly-regression-run.json | jq .

# 12. Date-based YTD after calculating/approving the H1+H2 runs
EMP_ID="<EMPLOYEE_ID>"
curl -s "$BASE_URL/payroll/employees/$EMP_ID/ytd?fy=2057" \
  -H "x-tenant-key: $TENANT" -H "$AUTH" | jq .

# NOTE: calculate each run with POST /payroll/runs/<id>/calculate, then fetch
#   GET /payroll/runs/<id>/payslips/<payslipId> for the actual payslip evidence.
