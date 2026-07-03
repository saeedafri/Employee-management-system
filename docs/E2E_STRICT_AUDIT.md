# E2E Strict Audit — Phase 2

> Generated: 2026-07-02T19:37:44.790Z
> Frontend: http://localhost:3001 | API: https://ems-api.saqibsaeed.cloud/api/v1
> MSW: OFF | Chrome channel

## Summary

| Metric | Value |
|--------|-------|
| Total button clicks | 1731 |
| PASS | 1192 |
| FAIL | 10 |
| PARTIAL | 528 |
| SKIP | 1 |
| New backend issues | 16 |
| New frontend issues | 44 |
| Edge cases pass | 7/11 |

## Per role × tenant

| Tenant | Role | PASS | FAIL | PARTIAL | SKIP | Total |
|--------|------|------|------|---------|------|-------|
| acme | HR_ADMIN | 332 | 0 | 176 | 0 | 508 |
| acme | SUPER_ADMIN | 343 | 8 | 145 | 0 | 496 |
| acme | MANAGER | 77 | 0 | 91 | 0 | 168 |
| acme | EMPLOYEE | 86 | 1 | 40 | 0 | 127 |
| acme | EMPLOYEE_DEV | 80 | 1 | 40 | 0 | 121 |
| testorg | HR_ADMIN | 0 | 0 | 0 | 1 | 1 |
| kwd | HR_ADMIN | 274 | 0 | 36 | 0 | 310 |

## Edge cases

| Case | Result | Detail |
|------|--------|--------|
| login_wrong_password_api | PASS | INVALID_CREDENTIALS |
| login_wrong_password_ui | PASS | http://localhost:3001/login |
| cross_tenant_token_header_mismatch | PASS | 401 INVALID_TOKEN |
| unauth_route_redirect_login | PASS | http://localhost:3001/login?next=%2Femployees |
| employee_permissions_denied | FAIL | EMPLOYEE (priya) can load `/permissions` without redirect — RBAC gap; page renders instead of 403/redirect |
| super_admin_no_employee_attendance | PASS | STILL_BROKEN: 5 NO_EMPLOYEE_RECORD |
| secondary_tenant_testorg_login | FAIL/SKIP | INVALID_CREDENTIALS |
| auditor_role_seeded_user | FAIL/SKIP | SKIP — no AUDITOR user found in seed/Hostinger; role exists in enum only |
| empty_search_no_500 | PASS | api calls 10 |
| unknown_route_404 | PASS | http://localhost:3001/this-route-does-not-exist-404 |
| logout_relogin | FAIL/SKIP | {"loggedOut":false,"relogin":false} |

## Button matrix (failures & partials)

### acme / HR_ADMIN / /employees / "All departments"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-all-departments-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-all-departments-after.png`

### acme / HR_ADMIN / /employees / "All statuses"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-all-statuses-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-all-statuses-after.png`

### acme / HR_ADMIN / /employees / "Comfortable"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-comfortable-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-comfortable-after.png`

### acme / HR_ADMIN / /employees / "Columns"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-columns-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-columns-after.png`

### acme / HR_ADMIN / /employees / "Export"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-export-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-export-after.png`

### acme / HR_ADMIN / /employees / "Aman Kumar"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-aman-kumar-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-aman-kumar-after.png`

### acme / HR_ADMIN / /employees / "Actions for Aman Kumar"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-aman-kumar-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-aman-kumar-after.png`

### acme / HR_ADMIN / /employees / "Priya Sharma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **API:** GET /api/notifications → 200
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-priya-sharma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-priya-sharma-after.png`

### acme / HR_ADMIN / /employees / "Actions for Priya Sharma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-priya-sharma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-priya-sharma-after.png`

### acme / HR_ADMIN / /employees / "HR Admin"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-hr-admin-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-hr-admin-after.png`

### acme / HR_ADMIN / /employees / "Actions for HR Admin"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-hr-admin-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-hr-admin-after.png`

### acme / HR_ADMIN / /employees / "Rajesh Sharma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-rajesh-sharma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-rajesh-sharma-after.png`

### acme / HR_ADMIN / /employees / "Actions for Rajesh Sharma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-rajesh-sharma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-rajesh-sharma-after.png`

### acme / HR_ADMIN / /employees / "Sakshi Singh"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-sakshi-singh-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-sakshi-singh-after.png`

### acme / HR_ADMIN / /employees / "Actions for Sakshi Singh"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-sakshi-singh-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-sakshi-singh-after.png`

### acme / HR_ADMIN / /employees / "Vikram Patel"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-vikram-patel-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-vikram-patel-after.png`

### acme / HR_ADMIN / /employees / "Actions for Vikram Patel"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-vikram-patel-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-vikram-patel-after.png`

### acme / HR_ADMIN / /employees / "Neha Kumar"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-neha-kumar-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-neha-kumar-after.png`

### acme / HR_ADMIN / /employees / "Actions for Neha Kumar"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-neha-kumar-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-neha-kumar-after.png`

### acme / HR_ADMIN / /employees / "Amit Verma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-amit-verma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-amit-verma-after.png`

### acme / HR_ADMIN / /employees / "Actions for Amit Verma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-amit-verma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-amit-verma-after.png`

### acme / HR_ADMIN / /employees / "Deepika Gupta"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-deepika-gupta-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-deepika-gupta-after.png`

### acme / HR_ADMIN / /employees / "Actions for Deepika Gupta"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-deepika-gupta-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-deepika-gupta-after.png`

### acme / HR_ADMIN / /employees / "Arjun Malhotra"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-arjun-malhotra-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-arjun-malhotra-after.png`

### acme / HR_ADMIN / /employees / "Actions for Arjun Malhotra"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-arjun-malhotra-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-arjun-malhotra-after.png`

### acme / HR_ADMIN / /employees / "Ananya Joshi"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-ananya-joshi-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-ananya-joshi-after.png`

### acme / HR_ADMIN / /employees / "Actions for Ananya Joshi"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-ananya-joshi-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-ananya-joshi-after.png`

### acme / HR_ADMIN / /employees / "Rohan Rao"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-rohan-rao-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-rohan-rao-after.png`

### acme / HR_ADMIN / /employees / "Actions for Rohan Rao"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-rohan-rao-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-rohan-rao-after.png`

### acme / HR_ADMIN / /employees / "Zara Bhat"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-zara-bhat-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-zara-bhat-after.png`

### acme / HR_ADMIN / /employees / "Actions for Zara Bhat"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-zara-bhat-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-zara-bhat-after.png`

### acme / HR_ADMIN / /employees / "Karan Sharma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-karan-sharma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-karan-sharma-after.png`

### acme / HR_ADMIN / /employees / "Actions for Karan Sharma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-karan-sharma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-karan-sharma-after.png`

### acme / HR_ADMIN / /employees / "Pooja Singh"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-pooja-singh-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-pooja-singh-after.png`

### acme / HR_ADMIN / /employees / "Actions for Pooja Singh"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-pooja-singh-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-pooja-singh-after.png`

### acme / HR_ADMIN / /employees / "Nikhil Patel"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-nikhil-patel-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-nikhil-patel-after.png`

### acme / HR_ADMIN / /employees / "Actions for Nikhil Patel"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-nikhil-patel-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-nikhil-patel-after.png`

### acme / HR_ADMIN / /employees / "Anjali Kumar"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-anjali-kumar-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-anjali-kumar-after.png`

### acme / HR_ADMIN / /employees / "Actions for Anjali Kumar"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-anjali-kumar-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-anjali-kumar-after.png`

### acme / HR_ADMIN / /employees / "Sanjay Verma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-sanjay-verma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-sanjay-verma-after.png`

### acme / HR_ADMIN / /employees / "Actions for Sanjay Verma"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-sanjay-verma-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-employees-actions-for-sanjay-verma-after.png`

### acme / HR_ADMIN / /attendance / "1 Absent"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-1-absent-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-1-absent-after.png`

### acme / HR_ADMIN / /attendance / "2 Half Day"
- **Verdict:** PARTIAL
- **URL changed:** false
- **API:** GET /api/notifications → 200
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-2-half-day-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-2-half-day-after.png`

### acme / HR_ADMIN / /attendance / "3"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-3-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-3-after.png`

### acme / HR_ADMIN / /attendance / "4"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-4-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-4-after.png`

### acme / HR_ADMIN / /attendance / "5"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-5-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-5-after.png`

### acme / HR_ADMIN / /attendance / "6"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-6-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-6-after.png`

### acme / HR_ADMIN / /attendance / "7"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-7-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-7-after.png`

### acme / HR_ADMIN / /attendance / "8"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-8-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-8-after.png`

### acme / HR_ADMIN / /attendance / "9"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-9-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-9-after.png`

### acme / HR_ADMIN / /attendance / "10"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-10-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-10-after.png`

### acme / HR_ADMIN / /attendance / "11"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-11-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-11-after.png`

### acme / HR_ADMIN / /attendance / "12"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-12-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-12-after.png`

### acme / HR_ADMIN / /attendance / "13"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-13-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-13-after.png`

### acme / HR_ADMIN / /attendance / "14"
- **Verdict:** PARTIAL
- **URL changed:** false
- **API:** GET /api/notifications → 200
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-14-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-14-after.png`

### acme / HR_ADMIN / /attendance / "15"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-15-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-15-after.png`

### acme / HR_ADMIN / /attendance / "16"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-16-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-16-after.png`

### acme / HR_ADMIN / /attendance / "17"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-17-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-17-after.png`

### acme / HR_ADMIN / /attendance / "18"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-18-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-18-after.png`

### acme / HR_ADMIN / /attendance / "19"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-19-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-19-after.png`

### acme / HR_ADMIN / /attendance / "20"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-20-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-20-after.png`

### acme / HR_ADMIN / /attendance / "21"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-21-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-21-after.png`

### acme / HR_ADMIN / /attendance / "22"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-22-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-22-after.png`

### acme / HR_ADMIN / /attendance / "23"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-23-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-23-after.png`

### acme / HR_ADMIN / /attendance / "24"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-24-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-24-after.png`

### acme / HR_ADMIN / /attendance / "25"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-25-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-25-after.png`

### acme / HR_ADMIN / /attendance / "26"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-26-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-26-after.png`

### acme / HR_ADMIN / /attendance / "27"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-27-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-27-after.png`

### acme / HR_ADMIN / /attendance / "28"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-28-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-28-after.png`

### acme / HR_ADMIN / /attendance / "29"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-29-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-29-after.png`

### acme / HR_ADMIN / /attendance / "30"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-30-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-30-after.png`

### acme / HR_ADMIN / /attendance / "31"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-31-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-attendance-31-after.png`

### acme / HR_ADMIN / /timesheets / "Project"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-project-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-project-after.png`

### acme / HR_ADMIN / /timesheets / "Previous week"
- **Verdict:** PARTIAL
- **URL changed:** false
- **API:** GET /api/notifications → 200
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-previous-week-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-previous-week-after.png`

### acme / HR_ADMIN / /timesheets / "This week"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-this-week-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-this-week-after.png`

### acme / HR_ADMIN / /timesheets / "Next week"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-next-week-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-next-week-after.png`

### acme / HR_ADMIN / /timesheets / "History"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-history-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-history-after.png`

### acme / HR_ADMIN / /timesheets / "Copy last week"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-copy-last-week-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-copy-last-week-after.png`

### acme / HR_ADMIN / /timesheets / "Templates"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-templates-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-templates-after.png`

### acme / HR_ADMIN / /timesheets / "Log time"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-log-time-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-log-time-after.png`

### acme / HR_ADMIN / /timesheets / "Acme Mobile App · Sprint Board"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-acme-mobile-app-sprint-board-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-acme-mobile-app-sprint-board-after.png`

### acme / HR_ADMIN / /timesheets / "Customer Portal v2 · UI Implementation"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-customer-portal-v2-ui-implementation-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-customer-portal-v2-ui-implementation-after.png`

### acme / HR_ADMIN / /timesheets / "Acme Mobile App · Bug Fixes"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-acme-mobile-app-bug-fixes-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-acme-mobile-app-bug-fixes-after.png`

### acme / HR_ADMIN / /timesheets / "Internal Portal · Pipeline Fix"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-internal-portal-pipeline-fix-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-internal-portal-pipeline-fix-after.png`

### acme / HR_ADMIN / /timesheets / "Data Analytics Platform · Feature Dev"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-data-analytics-platform-feature-dev-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-data-analytics-platform-feature-dev-after.png`

### acme / HR_ADMIN / /timesheets / "Acme Mobile App · Code Review"
- **Verdict:** PARTIAL
- **URL changed:** false
- **API:** GET /api/notifications → 200
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-acme-mobile-app-code-review-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-timesheets-acme-mobile-app-code-review-after.png`

### acme / HR_ADMIN / /leave / "Earned Leave 7.5 / 7.5 days View ledger"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-earned-leave-7-5-7-5-days-view-ledger-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-earned-leave-7-5-7-5-days-view-ledger-after.png`

### acme / HR_ADMIN / /leave / "Sick Leave 12 / 12 days View ledger"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-sick-leave-12-12-days-view-ledger-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-sick-leave-12-12-days-view-ledger-after.png`

### acme / HR_ADMIN / /leave / "Casual Leave 12 / 12 days View ledger"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-casual-leave-12-12-days-view-ledger-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-casual-leave-12-12-days-view-ledger-after.png`

### acme / HR_ADMIN / /leave / "Comp Off 0 / 0 days View ledger"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-comp-off-0-0-days-view-ledger-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-comp-off-0-0-days-view-ledger-after.png`

### acme / HR_ADMIN / /leave / "All statuses"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-all-statuses-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-leave-all-statuses-after.png`

### acme / HR_ADMIN / /payroll / "Run Payroll"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-run-payroll-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-run-payroll-after.png`

### acme / HR_ADMIN / /payroll / "Actions for 16–31 Dec 2026"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-16-31-dec-2026-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-16-31-dec-2026-after.png`

### acme / HR_ADMIN / /payroll / "Actions for 1–15 Dec 2026"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-1-15-dec-2026-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-1-15-dec-2026-after.png`

### acme / HR_ADMIN / /payroll / "Actions for December 2026"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-december-2026-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-december-2026-after.png`

### acme / HR_ADMIN / /payroll / "Actions for 16–30 Nov 2026"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-16-30-nov-2026-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-16-30-nov-2026-after.png`

### acme / HR_ADMIN / /payroll / "Actions for 1–15 Nov 2026"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-1-15-nov-2026-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-1-15-nov-2026-after.png`

### acme / HR_ADMIN / /payroll / "Actions for November 2026"
- **Verdict:** PARTIAL
- **URL changed:** false
- **API:** GET /api/notifications → 200
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-november-2026-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-november-2026-after.png`

### acme / HR_ADMIN / /payroll / "Actions for 16–31 Oct 2026"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-16-31-oct-2026-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-actions-for-16-31-oct-2026-after.png`

### acme / HR_ADMIN / /payroll / "Next"
- **Verdict:** PARTIAL
- **URL changed:** false
- **Screenshots:** `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-next-before.png`, `docs/e2e-screenshots/strict/acme-HR_ADMIN-payroll-next-after.png`
