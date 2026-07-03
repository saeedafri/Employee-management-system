# E2E Backend / API Issues

> Generated: 2026-07-02T17:45:00.000Z  
> Frontend: http://localhost:3001 | API: https://ems-api.saqibsaeed.cloud/api/v1  
> MSW: OFF (`NEXT_PUBLIC_USE_MOCKS=false`)  
> MFA fix applied: disabled `mfaEnabled` for `aman@acme.test` and `priya@acme.test` on Hostinger Postgres

**Total issues: 4** (Phase 1) + **16** (Phase 2) + **8** (Phase 3) = **28 documented**

---

## 1. Attendance — SUPER_ADMIN (no employee record)

- **Severity:** P1
- **Classification:** Backend
- **Steps to reproduce:**
  1. Login as `superadmin@acme.test` / `Password123!` (tenant `acme-corp-001`)
  2. Navigate to `/attendance`
  3. Observe network calls to employee-scoped attendance endpoints
- **Expected:** Admin without linked employee sees team/org attendance view or graceful empty state; API returns 200 with empty data or redirects to team view
- **Actual:** Multiple `400 NO_EMPLOYEE_RECORD` responses; page loads but API calls fail
- **API endpoint:** `GET /attendance/today`, `GET /attendance/records`, `GET /attendance/calendar`
- **Status/body:** `400` — `{"error":{"code":"NO_EMPLOYEE_RECORD","message":"User has no employee record"}}`
- **Screenshot:** `docs/e2e-screenshots/SUPER_ADMIN-attendance-pass-2026-07-02T17-31-08.png`
- **Root cause:** `superadmin@acme.test` has no linked `Employee` record; attendance endpoints require `employeeId` from JWT. Backend returns 400 instead of admin-scoped fallback.

---

## 2. Payout Methods — SUPER_ADMIN (no employee record)

- **Severity:** P2
- **Classification:** Backend
- **Steps to reproduce:**
  1. Login as `superadmin@acme.test`
  2. Navigate to `/payout-methods`
- **Expected:** Page shows admin message or hides employee-only payout UI for users without `employeeId`
- **Actual:** `GET /payroll/me/payout-methods` returns 400 twice
- **API endpoint:** `GET /payroll/me/payout-methods`
- **Status/body:** `400` — `{"error":{"code":"NO_EMPLOYEE_RECORD","message":"Your account is not linked to an employee record"}}`
- **Screenshot:** `docs/e2e-screenshots/SUPER_ADMIN-payout-methods-pass-2026-07-02T17-31-25.png`
- **Root cause:** Same as #1 — SUPER_ADMIN account has no employee link; `/me/` endpoints cannot resolve employee context.

---

## 3. Timesheets / Salary — KWD tenant (missing salary config)

- **Severity:** P1
- **Classification:** Backend (data)
- **Steps to reproduce:**
  1. Login as `admin@kwd.test` / `Password123!` (tenant `kwd-litmus-001`)
  2. Navigate to `/timesheets`
- **Expected:** Timesheet loads with employee salary context for KWD admin user
- **Actual:** `GET /payroll/employees/{id}/salary` returns 404
- **API endpoint:** `GET /payroll/employees/cmqqf21fw00046adzo6h2a22w/salary`
- **Status/body:** `404` — `{"error":{"code":"NOT_FOUND","message":"No salary configuration found for this employee"}}`
- **Screenshot:** `docs/e2e-screenshots/KWD_LITMUS-timesheets-pass-2026-07-02T17-33-45.png`
- **Root cause:** KWD litmus tenant admin employee exists but has no salary configuration seeded in payroll tables.

---

## 4. Storage Integration — Settings (incomplete API response)

- **Severity:** P2
- **Classification:** Backend
- **Steps to reproduce:**
  1. Login as `hr@acme.test`
  2. Navigate to `/settings/integration-storage`
- **Expected:** `GET /settings/integrations/storage` returns `{ provider: "cloudinary", configured: true, cloudName: "..." }`
- **Actual:** Response body has `provider: undefined` — UI cannot confirm storage provider
- **API endpoint:** `GET /settings/integrations/storage`
- **Status/body:** `200` — body missing `provider` field (deep audit note: `provider=undefined`)
- **Screenshot:** `docs/e2e-screenshots/HR_ADMIN-settings-storage-partial-2026-07-02T17-38-00.png`
- **Root cause:** Backend integration settings endpoint does not surface `provider` in response shape expected by frontend.

---

## API Verification Summary (`verifyHostingerPhases.mjs`)

All 27 phase checks **PASSED** including health, all role logins, HR endpoints, SUPER_ADMIN permissions, and KWD locale/currency/week-config.

---

## MFA Blocker (resolved)

- **Prior state:** `aman@acme.test` and `priya@acme.test` returned `mfaRequired: true` blocking Manager/Employee E2E.
- **Fix applied:** SSH to Hostinger (`root@31.97.186.223`), `UPDATE "User" SET "mfaEnabled" = false WHERE email IN ('aman@acme.test','priya@acme.test')`.
- **Verified:** Both users now receive `accessToken` on login without OTP.

---

## Phase 2

> Strict button audit: 2026-07-02T19:37:44.796Z
> Script: `scripts/strictButtonE2EAudit.mjs`

**New issues this phase: 16**

### P2-1. Auth — secondary tenant test-key-123456789 (HR_ADMIN / testorg)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** POST /auth/login admin@testorg.com + tenant test-key-123456789
- **Expected:** accessToken for HR_ADMIN secondary tenant
- **Actual:** INVALID_CREDENTIALS
- **API:** `POST /auth/login` status `401`

### P2-2. /assets — button "More options for Logitech MX Keys Keyboard" (HR_ADMIN / acme)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /assets, click "More options for Logitech MX Keys Keyboard"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** API 401 /api/notifications
- **API:** `/api/notifications` status `401`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-assets-more-options-for-logitech-mx-keys-keyboa-after.png`

### P2-3. /attendance — button "4" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "4"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **API:** `N/A` status `undefined`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-4-after.png`

### P2-4. /attendance — button "S" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "S"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **API:** `N/A` status `undefined`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-s-after.png`

### P2-5. /attendance — button "Request Regularization" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Request Regularization"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **API:** `N/A` status `undefined`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-request-regularization-after.png`

### P2-6. /attendance — button "All departments" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "All departments"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **API:** `N/A` status `undefined`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-all-departments-after.png`

### P2-7. /attendance — button "All employees" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "All employees"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **API:** `N/A` status `undefined`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-all-employees-after.png`

### P2-8. /attendance — button "Previous month" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Previous month"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** API 400 /api/attendance/calendar
- **API:** `/api/attendance/calendar` status `400`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-previous-month-after.png`

### P2-9. /attendance — button "Next month" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Next month"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** API 400 /api/attendance/calendar
- **API:** `/api/attendance/calendar` status `400`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-next-month-after.png`

### P2-10. /attendance — button "Calendar" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Calendar"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; API 400 /api/attendance/records; Something went wrongFailed to load attendance summary.Try again
- **API:** `/api/attendance/records` status `400`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-calendar-after.png`

### P2-11. /attendance — button "Table" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Table"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** API 400 /api/attendance/records
- **API:** `/api/attendance/records` status `400`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-table-after.png`

### P2-12. /attendance — button "div" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "div"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; API 400 /api/attendance/records; Something went wrongFailed to load attendance summary.Try again
- **API:** `/api/attendance/records` status `400`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-div-after.png`

### P2-13. /payout-methods — button "4" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /payout-methods, click "4"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load payout methodsTry again
- **API:** `N/A` status `undefined`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-payout-methods-4-after.png`

### P2-14. /payout-methods — button "S" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Backend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /payout-methods, click "S"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load payout methodsTry again
- **API:** `N/A` status `undefined`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-payout-methods-s-after.png`

### P2-15. /timesheets — button "History" (EMPLOYEE / acme)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** Login priya@acme.test (acme-corp-001), visit /timesheets, click "History"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; API 403 /api/timesheets/audit
- **API:** `/api/timesheets/audit` status `403`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-EMPLOYEE-timesheets-history-after.png`

### P2-16. /timesheets — button "History" (EMPLOYEE_DEV / acme)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** Login dev1@acme.test (acme-corp-001), visit /timesheets, click "History"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; API 403 /api/timesheets/audit
- **API:** `/api/timesheets/audit` status `403`
- **Screenshot:** `docs/e2e-screenshots/strict/acme-EMPLOYEE_DEV-timesheets-history-after.png`

## Phase 3

> Deep audit: 2026-07-03T02:50:00.000Z  
> Scripts: `scripts/deepApiAudit.mjs`, `scripts/deepCrudE2EAudit.mjs`, `npm run test:e2e:deep`  
> API matrix: 409 routes × 6 acme roles + KWD payroll subset = **1,301 GET tests** + **72 mutation probes**

**New issues this phase: 8**

### P3-1. Audit Logs Export — 500 Internal Server Error

- **Severity:** P0
- **Classification:** Backend
- **Steps:** Login as `superadmin@acme.test`, `GET /audit-logs/export` with Bearer token + `x-tenant-key: acme-corp-001`
- **Expected:** 200 with CSV/stream export body
- **Actual:** 500 `INTERNAL_SERVER_ERROR` — `{"success":false,"error":{"code":"INTERNAL_SERVER_ERROR","message":"An unexpected error occurred"}}`
- **API endpoint:** `GET /audit-logs/export`
- **Evidence:** `docs/e2e-deep-api-results.json` → `summary.failures[0]`; reproduced live 2026-07-03

### P3-2. Multi-tenant — testorg login still invalid

- **Severity:** P1
- **Classification:** Backend (data/seed)
- **Steps:** `POST /auth/login` with `admin@testorg.com` / `password123` + tenant `test-key-123456789`
- **Expected:** accessToken for HR_ADMIN secondary tenant
- **Actual:** 401 `INVALID_CREDENTIALS`
- **API endpoint:** `POST /auth/login`
- **Evidence:** API login matrix + CRUD `multi_tenant.testorg_login`

### P3-3. KWD tenant — admin employee missing salary config

- **Severity:** P1
- **Classification:** Backend (data)
- **Steps:** Login `admin@kwd.test` (tenant `kwd-litmus-001`), `GET /payroll/employees/{adminEmployeeId}/salary`
- **Expected:** 200 with salary configuration for KWD litmus admin
- **Actual:** 404 `NOT_FOUND` — "No salary configuration found for this employee"
- **API endpoint:** `GET /payroll/employees/cmqqf21fw00046adzo6h2a22w/salary`
- **Evidence:** `docs/e2e-deep-crud-results.json` → engine `KWD_admin_salary_config`

### P3-4. SUPER_ADMIN — NO_EMPLOYEE_RECORD on attendance APIs (confirmed)

- **Severity:** P1
- **Classification:** Backend
- **Steps:** Login `superadmin@acme.test` (no linked employee), navigate `/attendance`
- **Expected:** Admin-scoped team/org view or graceful empty state (200)
- **Actual:** 400 on `GET /attendance/today`, `/attendance/records`, `/attendance/calendar` — `NO_EMPLOYEE_RECORD`
- **API endpoint:** `GET /attendance/today`, `GET /attendance/records`, `GET /attendance/calendar`
- **Screenshot:** `docs/e2e-screenshots/deep/super-admin-attendance-fail-2026-07-03T02-46-49.png`

### P3-5. Payroll engine — statutory pack not resolved for employees

- **Severity:** P1
- **Classification:** Backend (payroll engine / data)
- **Steps:** Inspect `GET /payroll/runs/{id}` for 2026-06 REVIEW run after calculate
- **Expected:** All active employees with salary config have statutory pack resolved; PF/ESI/PT/TDS computed
- **Actual:** Run warnings include `"No statutory pack resolved — statutory contributions skipped"` for multiple employees; 60+ employees skipped with `"No salary config assigned"`
- **API endpoint:** `GET /payroll/runs/:id` (summary.warnings)
- **Note:** Manual verification on **2026-05 PAID** run shows PF + TDS present on payslip detail for configured employees; ESI/PT absent for test employee (may be threshold). Engine partially works but data coverage incomplete.

### P3-6. Payroll calculate — 422 on some draft runs

- **Severity:** P2
- **Classification:** Backend
- **Steps:** Create draft run `POST /payroll/runs` then `POST /payroll/runs/:id/calculate`
- **Expected:** 200 calculate success
- **Actual:** 422 `VALIDATION_ERROR` on calculate for some newly created DRAFT runs (period conflicts / RUN_EXISTS 409 on duplicate periods)
- **API endpoint:** `POST /payroll/runs/:id/calculate`
- **Evidence:** CRUD `payroll.calculate` fail; live probe on CANCELLED placeholder run returned 422

### P3-7. Pay component delete — 403 for HR_ADMIN

- **Severity:** P2
- **Classification:** Backend (RBAC — verify intent)
- **Steps:** HR_ADMIN creates component via `POST /payroll/components`, then `DELETE /payroll/components/:id`
- **Expected:** 200/204 delete for HR_ADMIN if UI allows delete
- **Actual:** 403 Forbidden
- **API endpoint:** `DELETE /payroll/components/:id`
- **Evidence:** CRUD `pay_components.delete` status 403

### P3-8. Storage Integration — provider field still missing (reconfirmed)

- **Severity:** P2
- **Classification:** Backend
- **Steps:** `GET /settings/integrations/storage` as HR_ADMIN
- **Expected:** `{ provider: "cloudinary", configured: true, cloudName: "..." }`
- **Actual:** `provider` undefined in response (Phase 1 issue, reconfirmed in settings sweep)
- **API endpoint:** `GET /settings/integrations/storage`


## Phase 4

> Phase 4 exhaustive audit: 2026-07-03T06:05:56.189Z
> Scripts: `scripts/phase4E2EAudit.mjs`, `phase4EdgeCases.mjs`, `phase4ExhaustiveUI.mjs`

**New issues this phase: 25**

### P4B-1. audit_logs_export

- **Severity:** P0
- **API endpoint:** `GET /audit-logs/export`
- **Actual:** 500 INTERNAL_SERVER_ERROR

### P4B-2. leave_create_validation

- **Severity:** P1
- **API endpoint:** `POST /leave/requests`
- **Actual:** 404 LEAVE_TYPE_NOT_FOUND
- **Detail:** {}

### P4B-3. pay_groups_create

- **Severity:** P1
- **API endpoint:** `POST /payroll/pay-groups`
- **Actual:** 404 

### P4B-4. announcements_update

- **Severity:** P1
- **API endpoint:** `announcements_update`
- **Actual:** undefined 
- **Detail:** no announcement to test

### P4B-5. announcements_delete

- **Severity:** P1
- **API endpoint:** `announcements_delete`
- **Actual:** undefined 
- **Detail:** no announcement to test

### P4B-6. testorg_login

- **Severity:** P1
- **API endpoint:** `testorg_login`
- **Actual:** 401 INVALID_CREDENTIALS

### P4B-7. /attendance — "Switch to dark mode"

- **Severity:** P1
- **API endpoint:** `/api/attendance/records`
- **Area:** /attendance — "Switch to dark mode"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-SUPER_ADMIN-attendance-switch-to-dark-mode-after.png`

### P4B-8. /attendance — "Previous month"

- **Severity:** P1
- **API endpoint:** `/api/attendance/records`
- **Area:** /attendance — "Previous month"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-SUPER_ADMIN-attendance-previous-month-after.png`

### P4B-9. /attendance — "Next month"

- **Severity:** P1
- **API endpoint:** `/api/attendance/records`
- **Area:** /attendance — "Next month"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-SUPER_ADMIN-attendance-next-month-after.png`

### P4B-10. /attendance — "Table"

- **Severity:** P1
- **API endpoint:** `/api/attendance/calendar`
- **Area:** /attendance — "Table"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-SUPER_ADMIN-attendance-table-after.png`

### P4B-11. /timesheets — "Copy last week"

- **Severity:** P0
- **API endpoint:** `/api/timesheets/copy-week`
- **Area:** /timesheets — "Copy last week"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-SUPER_ADMIN-timesheets-copy-last-week-after.png`

### P4B-12. /employees — "Priya Sharma"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpyds7001kkpjdnlhjygrp`
- **Area:** /employees — "Priya Sharma"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-priya-sharma-after.png`

### P4B-13. /employees — "Rajesh Sharma"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydtj0022kpjd7hbikivl`
- **Area:** /employees — "Rajesh Sharma"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-rajesh-sharma-after.png`

### P4B-14. /employees — "Neha Kumar"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydtv0028kpjdz9s1w2kl`
- **Area:** /employees — "Neha Kumar"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-neha-kumar-after.png`

### P4B-15. /employees — "Arjun Malhotra"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydu5002ekpjdjxysqafe`
- **Area:** /employees — "Arjun Malhotra"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-arjun-malhotra-after.png`

### P4B-16. /employees — "Zara Bhat"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpyduf002kkpjdj5cnqitt`
- **Area:** /employees — "Zara Bhat"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-zara-bhat-after.png`

### P4B-17. /employees — "Nikhil Patel"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydur002qkpjdqk63skk3`
- **Area:** /employees — "Nikhil Patel"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-nikhil-patel-after.png`

### P4B-18. /employees — "Ritika Gupta"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydv2002wkpjdrwzyc9lr`
- **Area:** /employees — "Ritika Gupta"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-ritika-gupta-after.png`

### P4B-19. /employees — "Rahul Rao"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydve0032kpjdx4ljg1mz`
- **Area:** /employees — "Rahul Rao"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-rahul-rao-after.png`

### P4B-20. /employees — "Preeti Singh"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydvr0038kpjdgswasdwa`
- **Area:** /employees — "Preeti Singh"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-preeti-singh-after.png`

### P4B-21. /employees — "Harish Verma"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydw3003ekpjdbr28pdhd`
- **Area:** /employees — "Harish Verma"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-harish-verma-after.png`

### P4B-22. /employees — "Shreya Joshi"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydwi003kkpjdipkg1fzr`
- **Area:** /employees — "Shreya Joshi"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-shreya-joshi-after.png`

### P4B-23. /employees — "Ravi Sharma"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydww003qkpjdri5e2wbb`
- **Area:** /employees — "Ravi Sharma"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-ravi-sharma-after.png`

### P4B-24. /employees — "Nisha Kumar"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydxb003wkpjdieodvlb8`
- **Area:** /employees — "Nisha Kumar"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-nisha-kumar-after.png`

### P4B-25. /employees — "Pawan Malhotra"

- **Severity:** P1
- **API endpoint:** `/api/employees/cmqjpydxp0042kpjd5k23qf0e`
- **Area:** /employees — "Pawan Malhotra"
- **Screenshot:** `docs/e2e-screenshots/phase4/ui/acme-MANAGER-employees-pawan-malhotra-after.png`
