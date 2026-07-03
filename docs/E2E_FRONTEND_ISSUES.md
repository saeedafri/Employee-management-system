# E2E Frontend / UI Issues

> Generated: 2026-07-02T17:45:00.000Z  
> Frontend: http://localhost:3001 | API: https://ems-api.saqibsaeed.cloud/api/v1  
> MSW: OFF (`NEXT_PUBLIC_USE_MOCKS=false`)

**Total issues: 4**

---

## 1. Performance — Duplicate React keys

- **Severity:** P2
- **Classification:** Frontend
- **Steps to reproduce:**
  1. Login as `hr@acme.test` or `superadmin@acme.test`
  2. Navigate to `/performance`
  3. Open browser console
- **Expected:** No React key warnings; list items render uniquely
- **Actual:** 20–40 console errors: `Encountered two children with the same key` (employee IDs used as duplicate keys)
- **API endpoint:** N/A (rendering bug)
- **Screenshot:** `docs/e2e-screenshots/HR_ADMIN-performance-deep-pass-2026-07-02T17-38-00.png`
- **Root cause:** Performance module list renders items with non-unique `key` props (likely duplicate employee IDs in mapped array).

---

## 2. Settings — 401 console errors during navigation

- **Severity:** P2
- **Classification:** Frontend (auth race)
- **Steps to reproduce:**
  1. Login as `hr@acme.test`
  2. Navigate through Settings sub-pages (company profile → locale → integrations)
  3. Observe console during page transitions
- **Expected:** No unauthorized API calls during authenticated session
- **Actual:** `Failed to load resource: the server responded with a status of 401 (Unauthorized)` logged twice during settings sweep
- **API endpoint:** Unauthenticated prefetch during route transition (likely `/api/auth/me` or settings endpoint before cookie propagates)
- **Screenshot:** `docs/e2e-screenshots/HR_ADMIN-settings-integration-storage-pass-2026-07-02T17-29-55.png`
- **Root cause:** Frontend fires API requests before BFF auth cookie is attached on fast client-side navigation.

---

## 3. Attendance / Payout — SUPER_ADMIN calls employee-scoped endpoints

- **Severity:** P2
- **Classification:** Frontend (miswired for admin-without-employee)
- **Steps to reproduce:**
  1. Login as `superadmin@acme.test` (no linked employee)
  2. Visit `/attendance` or `/payout-methods`
- **Expected:** UI detects missing `employeeId` from `/auth/me` and shows admin-appropriate view (team records, or "not applicable" empty state) without calling `/me/` endpoints
- **Actual:** UI calls employee-scoped endpoints anyway, triggering backend 400s (see Backend issue #1/#2)
- **API endpoint:** `GET /attendance/today`, `GET /payroll/me/payout-methods`
- **Screenshot:** `docs/e2e-screenshots/SUPER_ADMIN-attendance-pass-2026-07-02T17-31-08.png`
- **Root cause:** Frontend does not gate employee-only API calls on `user.employeeId` presence.

---

## 4. Timesheets — Mutation flow incomplete in UI

- **Severity:** P2
- **Classification:** Frontend (interaction coverage)
- **Steps to reproduce:**
  1. Login as `dev1@acme.test` (EMPLOYEE)
  2. Navigate to `/timesheets`
  3. Attempt add entry → edit → submit → approve workflow via UI buttons
- **Expected:** Full timesheet mutation cycle completes (add, edit, submit, manager approve)
- **Actual:** Deep clickthrough marked **PARTIAL** — only 2 of 4 mutation API steps triggered via UI controls
- **API endpoint:** `POST/PATCH /timesheets/*` (some steps succeeded at 200, approve/submit buttons not fully exercised)
- **Screenshot:** `docs/e2e-screenshots/HR_ADMIN-timesheets-mutation-partial-2026-07-02T17-38-00.png`
- **Root cause:** Timesheet UI controls for submit/approve may be hidden, disabled, or use non-obvious selectors; workflow not fully clickable in automated sweep.

---

## MSW Status

**Confirmed OFF.** No `fromServiceWorker: true` responses detected in any network capture during audit. All API traffic routes through BFF (`localhost:3001/api/*`) to Hostinger.

---

## Pages Passing (no UI issues detected)

All core modules load without error boundaries for all 5 roles:

| Role | Routes tested | Result |
|------|--------------|--------|
| HR_ADMIN | 47 routes + notifications/search/profile | All PASS |
| SUPER_ADMIN | 47 routes + global features | All PASS (API 400s logged, no crash) |
| MANAGER | 7 routes + global features | All PASS |
| EMPLOYEE | 7 routes + global features | All PASS |
| KWD_LITMUS | 5 routes + global features | All PASS (salary 404 logged) |

Deep clickthrough (HR_ADMIN): dashboard approvals, employee CRUD, department create, payroll run detail, payslip drawer, bank file, audit pack, statutory return, document upload/download, webhooks, announcements create, assets create — all **PASS**.

---

## Phase 2

> Strict button audit: 2026-07-02T19:37:44.797Z
> Script: `scripts/strictButtonE2EAudit.mjs`

**New issues this phase: 45**

### P2-1. /performance — button "Switch to dark mode" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Switch to dark mode"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-switch-to-dark-mode-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-2. /performance — button "Notifications" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Notifications"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-notifications-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-3. /performance — button "HA" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "HA"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-ha-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-4. /performance — button "Export" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Export"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-export-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-5. /performance — button "Start a Review" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Start a Review"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-start-a-review-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-6. /performance — button "Reviews" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Reviews"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-reviews-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-7. /performance — button "Goals" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Goals"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-goals-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-8. /performance — button "Calibration" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Calibration"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-calibration-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-9. /performance — button "All departments" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "All departments"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-all-departments-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-10. /performance — button "Filter" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Filter"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-filter-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-11. /performance — button "View" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "View"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-view-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-12. /performance — button "Open" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Open"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-open-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-13. /performance — button "Review" (HR_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login hr@acme.test (acme-corp-001), visit /performance, click "Review"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-performance-review-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-14. /attendance — button "Switch to light mode" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Switch to light mode"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-switch-to-light-mode-after.png`
- **UI symptom:** Failed to load resource: the server responded with a status of 400 (Bad Request)

### P2-15. /attendance — button "4" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "4"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-4-after.png`
- **UI symptom:** Error boundary

### P2-16. /attendance — button "S" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "S"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-s-after.png`
- **UI symptom:** Error boundary

### P2-17. /attendance — button "Request Regularization" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Request Regularization"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-request-regularization-after.png`
- **UI symptom:** Error boundary

### P2-18. /attendance — button "All departments" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "All departments"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-all-departments-after.png`
- **UI symptom:** Error boundary

### P2-19. /attendance — button "All employees" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "All employees"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load attendance summary.Try again
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-all-employees-after.png`
- **UI symptom:** Error boundary

### P2-20. /attendance — button "Previous month" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Previous month"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** API 400 /api/attendance/calendar
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-previous-month-after.png`
- **UI symptom:** Failed to load resource: the server responded with a status of 400 (Bad Request)

### P2-21. /attendance — button "Next month" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Next month"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** API 400 /api/attendance/calendar
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-next-month-after.png`
- **UI symptom:** Failed to load resource: the server responded with a status of 400 (Bad Request)

### P2-22. /attendance — button "Calendar" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Calendar"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; API 400 /api/attendance/records; Something went wrongFailed to load attendance summary.Try again
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-calendar-after.png`
- **UI symptom:** Error boundary

### P2-23. /attendance — button "Table" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "Table"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** API 400 /api/attendance/records
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-table-after.png`
- **UI symptom:** Failed to load resource: the server responded with a status of 400 (Bad Request)

### P2-24. /attendance — button "div" (SUPER_ADMIN / acme)

- **Severity:** P1
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /attendance, click "div"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; API 400 /api/attendance/records; Something went wrongFailed to load attendance summary.Try again
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-attendance-div-after.png`
- **UI symptom:** Error boundary

### P2-25. /payout-methods — button "4" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /payout-methods, click "4"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load payout methodsTry again
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-payout-methods-4-after.png`
- **UI symptom:** Error boundary

### P2-26. /payout-methods — button "S" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /payout-methods, click "S"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; Something went wrongFailed to load payout methodsTry again
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-payout-methods-s-after.png`
- **UI symptom:** Error boundary

### P2-27. /payout-methods — button "Review approvals" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /payout-methods, click "Review approvals"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-payout-methods-review-approvals-after.png`
- **UI symptom:** Failed to load resource: the server responded with a status of 400 (Bad Request)

### P2-28. /performance — button "Switch to dark mode" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "Switch to dark mode"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-switch-to-dark-mode-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-29. /performance — button "4" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "4"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-4-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-30. /performance — button "S" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "S"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-s-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-31. /performance — button "Export" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "Export"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-export-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-32. /performance — button "Start a Review" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "Start a Review"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-start-a-review-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-33. /performance — button "Reviews" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "Reviews"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-reviews-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-34. /performance — button "Goals" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "Goals"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-goals-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-35. /performance — button "Calibration" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "Calibration"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-calibration-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-36. /performance — button "All departments" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "All departments"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-all-departments-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-37. /performance — button "Filter" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "Filter"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-filter-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-38. /performance — button "View" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "View"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-view-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-39. /performance — button "Open" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "Open"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-open-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-40. /performance — button "Review" (SUPER_ADMIN / acme)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login superadmin@acme.test (acme-corp-001), visit /performance, click "Review"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/acme-SUPER_ADMIN-performance-review-after.png`
- **UI symptom:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002ykpjdw0kveq0p

### P2-41. /timesheets — button "History" (EMPLOYEE / acme)

- **Severity:** P1
- **Classification:** Frontend
- **Steps:** Login priya@acme.test (acme-corp-001), visit /timesheets, click "History"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; API 403 /api/timesheets/audit
- **Screenshot:** `docs/e2e-screenshots/strict/acme-EMPLOYEE-timesheets-history-after.png`
- **UI symptom:** Error boundary

### P2-42. /timesheets — button "History" (EMPLOYEE_DEV / acme)

- **Severity:** P1
- **Classification:** Frontend
- **Steps:** Login dev1@acme.test (acme-corp-001), visit /timesheets, click "History"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** ERROR_BOUNDARY; API 403 /api/timesheets/audit
- **Screenshot:** `docs/e2e-screenshots/strict/acme-EMPLOYEE_DEV-timesheets-history-after.png`
- **UI symptom:** Error boundary

### P2-43. /payroll/my-payslips — button "Run Payroll" (HR_ADMIN / kwd)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login admin@kwd.test (kwd-litmus-001), visit /payroll/my-payslips, click "Run Payroll"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/kwd-HR_ADMIN-payroll-my-payslips-run-payroll-after.png`
- **UI symptom:** Failed to load resource: the server responded with a status of 404 (Not Found)

### P2-44. /payroll/my-payslips — button "Actions for June 2026" (HR_ADMIN / kwd)

- **Severity:** P2
- **Classification:** Frontend
- **Steps:** Login admin@kwd.test (kwd-litmus-001), visit /payroll/my-payslips, click "Actions for June 2026"
- **Expected:** Expected navigation/modal/API 2xx without error boundary
- **Actual:** PARTIAL
- **Screenshot:** `docs/e2e-screenshots/strict/kwd-HR_ADMIN-payroll-my-payslips-actions-for-june-2026-after.png`
- **UI symptom:** Failed to load resource: the server responded with a status of 404 (Not Found)

### P2-45. /permissions — EMPLOYEE role not blocked (EMPLOYEE / acme)

- **Severity:** P1
- **Classification:** Frontend (RBAC)
- **Steps:** Login as `priya@acme.test` (EMPLOYEE), navigate directly to `/permissions`
- **Expected:** Redirect to dashboard or 403/forbidden empty state; nav item hidden for EMPLOYEE
- **Actual:** Page loads at `/permissions` without access denial — permissions matrix visible to employee role
- **Screenshot:** Edge case captured during Phase 2 strict audit
- **UI symptom:** Missing route guard for SUPER_ADMIN-only permissions screen
