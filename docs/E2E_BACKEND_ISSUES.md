# E2E Backend / API Issues

> Generated: 2026-07-02T17:45:00.000Z  
> Frontend: http://localhost:3001 | API: https://ems-api.saqibsaeed.cloud/api/v1  
> MSW: OFF (`NEXT_PUBLIC_USE_MOCKS=false`)  
> MFA fix applied: disabled `mfaEnabled` for `aman@acme.test` and `priya@acme.test` on Hostinger Postgres

**Total issues: 4**

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
