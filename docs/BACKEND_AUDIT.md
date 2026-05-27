# Backend API Audit Report
**Date**: 2026-05-27  
**Auditor**: Claude Code (automated curl-based testing)  
**Base URL**: `http://localhost:3001/api/v1`  
**Scope**: All documented endpoints across Auth, Employees, Leave, Attendance, Analytics, Departments, Holidays, Settings, Reports, Export, Audit Logs, Manager Dashboard, Employee Dashboard, Logs

## Summary: 11 bugs found (4 critical, 4 RBAC, 3 warnings)

---

## CRITICAL BUGS (must fix)

### BUG-001: PATCH /employees/:id — MANAGER can update any employee
- **Endpoint**: `PATCH /api/v1/employees/:id`
- **Expected**: 403 FORBIDDEN for MANAGER role
- **Got**: 200 OK, update applied
- **Curl**:
```bash
curl -s -X PATCH http://localhost:3001/api/v1/employees/cmpo6uelx001es7pw9xe6hzcy \
  -H "Authorization: Bearer <MANAGER_TOKEN>" \
  -H "Content-Type: application/json" \
  -H "x-tenant-key: acme-corp-001" \
  -d '{"firstName":"HACKED"}'
# Returns: {"success":true, ...} with updated firstName
```
- **Impact**: MANAGER can modify any employee's profile fields. CLAUDE.md states only HR_ADMIN and SUPER_ADMIN can PATCH. This is an RBAC violation — a manager could modify their own salary fields, designation, or employment status.

---

### BUG-002: GET /employees/:id — Soft-deleted employee returns 200 with deletedAt=null
- **Endpoint**: `GET /api/v1/employees/:id`
- **Expected**: 404 after soft delete, OR 200 with non-null `deletedAt`
- **Got**: 200 OK, `deletedAt: null`, `status: null`
- **Curl**:
```bash
# First delete employee
curl -s -X DELETE http://localhost:3001/api/v1/employees/cmpo763ni002bzozmgx18qs62 \
  -H "Authorization: Bearer <HR_TOKEN>" -H "x-tenant-key: acme-corp-001"

# Then fetch — should 404 or show deletedAt timestamp
curl -s http://localhost:3001/api/v1/employees/cmpo763ni002bzozmgx18qs62 \
  -H "Authorization: Bearer <HR_TOKEN>" -H "x-tenant-key: acme-corp-001"
# Returns: {"success":true, "data": {"deletedAt": null, ...}}
```
- **Impact**: Two problems in one: (1) deleted employees are visible to the UI as if active; (2) `deletedAt` is not being set or not being returned in the response — either the soft delete is not writing `deletedAt` to the DB or the serializer strips it. Either way the UI cannot distinguish deleted vs active employees.

---

### BUG-003: GET /settings/tenant — EMPLOYEE role can read tenant configuration (RBAC failure)
- **Endpoint**: `GET /api/v1/settings/tenant`
- **Expected**: 403 FORBIDDEN for EMPLOYEE role
- **Got**: 200 OK — full tenant config returned including `primaryContactEmail`, `supportPhone`, `working_hours_start`, `working_hours_end`, `defaultCurrency`, etc.
- **Curl**:
```bash
curl -s http://localhost:3001/api/v1/settings/tenant \
  -H "Authorization: Bearer <EMPLOYEE_TOKEN>" \
  -H "x-tenant-key: acme-corp-001"
# Returns 200 with full tenant settings
```
- **Impact**: EMPLOYEE sees internal company configuration. The leaked fields include `primaryContactEmail`, `supportPhone`, `logoUrl`, `fiscal_year_start`. CLAUDE.md specifies this route requires "any admin" — EMPLOYEE is not an admin role.

---

### BUG-004: GET /logs — Route documented as /logs but actual path is /admin/logs
- **Endpoint documented as**: `GET /api/v1/logs`
- **Actual route**: `GET /api/v1/admin/logs`
- **Symptom**: `GET /api/v1/logs` returns `404 Not Found` for all roles including HR
- **Curl**:
```bash
curl -s http://localhost:3001/api/v1/logs -H "Authorization: Bearer <HR_TOKEN>" -H "x-tenant-key: acme-corp-001"
# Returns: {"message":"Route GET:/api/v1/logs not found","error":"Not Found","statusCode":404}

# Actual working path:
curl -s http://localhost:3001/api/v1/admin/logs -H "Authorization: Bearer <HR_TOKEN>" -H "x-tenant-key: acme-corp-001"
# Returns: 200 OK
```
- **Impact**: Any frontend or integration using `/api/v1/logs` will 404. CLAUDE.md, WIREFRAMES_API_MAPPING.md, and API_MAPPING.md all document the path as `/logs`. The route is registered as `/admin/logs` in `src/modules/logs/logs.routes.js`. Either rename the route or update all documentation.

---

## RBAC VIOLATIONS

### RBAC-001: PATCH /employees/:id — MANAGER can update employees (same as BUG-001, confirmed)
See BUG-001 above.

### RBAC-002: GET /employees/:id — Non-existent ID returns 400 (VALIDATION_ERROR) instead of 404
- **Endpoint**: `GET /api/v1/employees/:id`
- **Input**: `id` that is a syntactically invalid cuid (e.g. `nonexistent-id-999`)
- **Expected**: 400 is acceptable for malformed cuid. 404 for valid-format but non-existent cuid.
- **Got**: Valid-format non-existent cuid → correctly returns 404. Malformed cuid → returns 400 with `VALIDATION_ERROR` wrapping a Zod error message (raw Zod schema dump in `message` field).
- **Curl**:
```bash
curl -s http://localhost:3001/api/v1/employees/nonexistent-id-999 \
  -H "Authorization: Bearer <HR_TOKEN>" -H "x-tenant-key: acme-corp-001"
# Returns: {"success":false,"error":{"code":"VALIDATION_ERROR","message":"[\n  {\n    \"validation\": \"cuid\",..."}}
```
- **Impact**: The raw Zod error JSON is exposed in `message` — should be sanitized to a clean human-readable string, not internal schema validation details.

### RBAC-003: GET /settings/tenant — EMPLOYEE can read (same as BUG-003)
See BUG-003 above.

### RBAC-004: POST /employees — MANAGER receives 403 (correct), but error path hides RBAC vs validation
- MANAGER with a complete valid payload gets 403 FORBIDDEN. This is **correct behavior**.
- However, with an incomplete payload, MANAGER gets 400 VALIDATION_ERROR instead of 403 — this means the validation middleware runs before auth checks. The role check order should be: authenticate → authorize (role check) → validate body. Currently validation can short-circuit auth, leaking which fields are required even to unauthorized roles.

---

## MISSING FIELDS / WRONG SHAPES

### SHAPE-001: GET /auth/me — `tenantId` missing from response
- **Expected response fields** (per CLAUDE.md): `id, email, memberType, tenantId`
- **Actual fields**: `id, email, memberType, employeeId, status, employee, permissions, lastLoginAt`
- **Missing**: `tenantId`
- **Curl**:
```bash
curl -s http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer <ANY_TOKEN>" -H "x-tenant-key: acme-corp-001"
# data keys: ['id', 'email', 'memberType', 'employeeId', 'status', 'employee', 'permissions', 'lastLoginAt']
# tenantId NOT present
```
- **Impact**: Frontend cannot confirm which tenant the user belongs to from /auth/me. Must decode JWT to find tenantId.

### SHAPE-002: GET /leave/types — Returns 3 types, seed expects 8
- **Expected**: 8 leave types (per CLAUDE.md comprehensive seed)
- **Got**: 3 types (Annual Leave, Casual Leave, Sick Leave only)
- **Curl**:
```bash
curl -s http://localhost:3001/api/v1/leave/types \
  -H "Authorization: Bearer <ANY_TOKEN>" -H "x-tenant-key: acme-corp-001"
# Returns 3 items
```
- **Impact**: Leave request form will only show 3 options. Employees cannot request Maternity, Paternity, Bereavement, etc. Re-running `npm run db:seed:comprehensive` should fix this, but the base seed should also create all 8 types.

### SHAPE-003: GET /holidays — Returns 3 holidays, not 16+ as expected
- **Expected**: 16+ holidays per CLAUDE.md  
- **Got**: 3 holidays
- **Curl**:
```bash
curl -s http://localhost:3001/api/v1/holidays \
  -H "Authorization: Bearer <HR_TOKEN>" -H "x-tenant-key: acme-corp-001"
# {"data":{"holidays":[...],"total":3}}
```
- **Impact**: Holiday calendar appears nearly empty. Attendance calculations that exclude holidays will be incorrect. Re-run `npm run db:seed:comprehensive`.

### SHAPE-004: GET /employees — Deleted employees show `deletedAt: null` (related to BUG-002)
- Soft-deleted employees return `deletedAt: null` when fetched by ID, and are correctly excluded from the list endpoint. However the serialization of `deletedAt` is broken — the field is present but always null even for deleted records.

---

## EDGE CASE FAILURES

### EDGE-001: POST /attendance/regularization — Field name mismatch (API uses `attendanceDate` not `date`)
- **Documented as**: `date` (in CLAUDE.md and most documentation)
- **Actual required field**: `attendanceDate`
- **Curl** (what fails):
```bash
curl -s -X POST http://localhost:3001/api/v1/attendance/regularization \
  -H "Authorization: Bearer <EMP_TOKEN>" -H "Content-Type: application/json" \
  -H "x-tenant-key: acme-corp-001" \
  -d '{"date":"2026-05-20","reason":"Forgot to check in"}'
# Returns: 400 VALIDATION_ERROR: must have required property 'attendanceDate'
```
- **Correct call**:
```bash
-d '{"attendanceDate":"2026-05-20","checkInTime":"09:00","reason":"Forgot to check in"}'
```
- **Impact**: Any client using the documented `date` field will get a 400. Swagger docs likely show `date` not `attendanceDate`.

### EDGE-002: POST /holidays — Field name mismatch (API uses `holidayDate` not `date`)
- **Documented as**: `date`
- **Actual required field**: `holidayDate`
- **Curl** (what fails):
```bash
curl -s -X POST http://localhost:3001/api/v1/holidays \
  -H "Authorization: Bearer <HR_TOKEN>" -H "Content-Type: application/json" \
  -H "x-tenant-key: acme-corp-001" \
  -d '{"name":"Test Holiday","date":"2026-12-25","isOptional":false}'
# Returns: 400 VALIDATION_ERROR: must have required property 'holidayDate'
```
- **Impact**: Any frontend posting to create holidays using `date` will fail silently.

### EDGE-003: POST /reports/schedule — Field name mismatch and undocumented required fields
- **Documented required fields**: `name, reportType, schedule, format`
- **Actual required fields**: `name, report_type, schedule, format, frequency, email_recipients`
- **Curl**:
```bash
curl -s -X POST http://localhost:3001/api/v1/reports/schedule \
  -H "Authorization: Bearer <HR_TOKEN>" -H "Content-Type: application/json" \
  -H "x-tenant-key: acme-corp-001" \
  -d '{"name":"Monthly Report","reportType":"attendance","schedule":"0 9 1 * *","format":"csv"}'
# Returns: 400 - must have required property 'report_type'
# Then: must have required property 'frequency'
# Then: must have required property 'email_recipients'
```
- **Impact**: Scheduled reports cannot be created through any standard client. The field name is `report_type` (snake_case) not `reportType` (camelCase), inconsistent with the rest of the API.

### EDGE-004: GET /reports/payroll — Requires `year` AND `month` as query params (undocumented)
- **Expected**: Works without params or with `?month=YYYY-MM`
- **Actual**: Requires `?year=2026&month=5` (separate params, not `YYYY-MM` format)
- **Curl**:
```bash
curl -s http://localhost:3001/api/v1/reports/payroll \
  -H "Authorization: Bearer <HR_TOKEN>" -H "x-tenant-key: acme-corp-001"
# Returns: 400 VALIDATION_ERROR: must have required property 'month'

curl -s "http://localhost:3001/api/v1/reports/payroll?year=2026&month=5" \
  -H "Authorization: Bearer <HR_TOKEN>" -H "x-tenant-key: acme-corp-001"
# Returns: 200 OK
```
- **Impact**: Payroll report is inaccessible without knowing the undocumented param format.

### EDGE-005: POST /leave/requests — `reason` minimum length is 10 characters (undocumented)
- Submitting `"reason":"Vacation"` (8 chars) returns `400 VALIDATION_ERROR: Reason must be at least 10 characters`
- Not mentioned in docs or Swagger. Frontend validation should match.

### EDGE-006: GET /employees (no token) — Returns 401 but HTTP body says `UNAUTHORIZED`; HTTP status correctly 401
- This was initially misreported as 400. Confirmed: the HTTP status IS 401 correctly. No bug.

---

## DATA INTEGRITY WARNINGS

### WARN-001: GET /leave/requests (HR) returns 0 results
- HR's own `/leave/requests` returns empty. `/leave/team/requests` also returns 0.
- This appears to be a data state issue (no active leave requests in DB) not a code bug. HR has no employee profile linked to leave requests in the default seed data. However, if the intent is for HR to see ALL tenant leave requests via `/leave/requests`, that scoping is missing — HR only sees own requests, not team-wide.
- **Recommendation**: Verify whether `/leave/requests` for HR_ADMIN should return all tenant requests or just own.

### WARN-002: POST /auth/refresh with empty body returns Fastify internal error code
- **Curl**: `curl -s -X POST http://localhost:3001/api/v1/auth/refresh -H "Content-Type: application/json"`
- **Response**: `{"statusCode":400,"code":"FST_ERR_CTP_EMPTY_JSON_BODY","error":"Bad Request","message":"Body cannot be empty when content-type is set to 'application/json', did you forget to set the charset?"}` 
- **Impact**: Fastify internal error code `FST_ERR_CTP_EMPTY_JSON_BODY` is exposed. Should be caught and returned as a normalized error response.

### WARN-003: Validation error on /employees/:id with non-cuid exposes raw Zod schema
- Error message contains raw JSON from Zod: `"[\n  {\n    \"validation\": \"cuid\", \"code\": \"invalid_string\"...`
- Should be normalized to `"Invalid employee ID format"`.

---

## PASSED (confirmed working)

| Test | Status |
|------|--------|
| POST /auth/login — valid credentials | 200 OK, returns `accessToken, sessionId, user, permissions` |
| POST /auth/login — wrong password | 401 correctly |
| POST /auth/login — missing fields | 400 correctly |
| POST /auth/admin/login — EMPLOYEE rejected | 403 correctly |
| POST /auth/admin/login — HR accepted | 200 OK |
| GET /auth/me — returns id, email, memberType, employeeId | 200 OK |
| GET /auth/sessions | 200 OK |
| POST /auth/forgot-password | 202 Accepted |
| POST /auth/refresh — no cookie | 400 (error code exposed — see WARN-002) |
| GET /employees — all authenticated roles | 200 OK |
| GET /employees — no token | 401 correctly |
| GET /employees — pagination works (page1/page2 return different records) | PASS |
| GET /employees — ?search= filter works | PASS |
| POST /employees — MANAGER rejected | 403 correctly |
| POST /employees — missing required fields | 400 correctly |
| GET /employees/:id — valid non-existent cuid | 404 correctly |
| PATCH /employees/:id — EMPLOYEE rejected | 403 correctly |
| DELETE /employees/:id — HR can delete | 200 OK |
| DELETE /employees/:id — MANAGER rejected | 403 correctly |
| DELETE /employees/:id — EMPLOYEE rejected | 403 correctly |
| Deleted employee excluded from list | PASS (not in GET /employees list) |
| POST /attendance/check-in | 200 OK |
| POST /attendance/check-in again same day | 409 ALREADY_CHECKED_IN correctly |
| POST /attendance/check-out | 200 OK |
| GET /attendance/records — own records | 200 OK |
| GET /attendance/records?month=2026-05 — filter works | PASS (returns 10 filtered records) |
| GET /attendance/team/records — EMPLOYEE rejected | 403 correctly |
| GET /attendance/team/records — MANAGER accepted | 200 OK |
| GET /attendance/summary — correct fields | `period, totalDays, present, absent, leave, wfh, halfDay, holiday, late, attendancePercentage` |
| GET /attendance/regularization — EMPLOYEE own | 200 OK |
| GET /attendance/team/regularization — EMPLOYEE rejected | 403 correctly |
| PATCH /attendance/regularization/:id/approve — EMPLOYEE rejected | 403 correctly |
| PATCH /attendance/regularization/:id/approve — MANAGER accepted | 200 OK |
| GET /leave/types | 200 OK (3 types present; data completeness issue — see SHAPE-002) |
| GET /leave/balance — correct fields | `id, leaveTypeId, leaveTypeName, leaveTypeCode, total, used, pending, available` |
| POST /leave/requests — past date blocked | 400 correctly |
| POST /leave/requests — missing fields | 400 correctly |
| PATCH /leave/requests/:id/approve — EMPLOYEE rejected | 403 correctly |
| PATCH /leave/requests/:id/approve — HR accepted | 200 OK |
| PATCH /leave/requests/:id/reject — EMPLOYEE rejected | 403 correctly |
| GET /leave/team/requests — EMPLOYEE rejected | 403 correctly |
| GET /leave/team/requests — MANAGER accepted | 200 OK |
| Leave data isolation — EMPLOYEE only sees own requests | PASS |
| GET /analytics/summary — correct fields | `totalEmployees, activeToday, onLeaveToday, openRequests, deltas` |
| GET /analytics/summary — EMPLOYEE rejected | 403 correctly |
| GET /analytics/summary — MANAGER rejected | 403 correctly |
| GET /analytics/attendance | 200 OK, `range, series` |
| GET /analytics/headcount-by-department | 200 OK |
| GET /analytics/recent-activity | 200 OK |
| GET /analytics/leave-summary | 200 OK, `pending, approved, rejected, withdrawn` |
| GET /departments — list with hierarchy | 200 OK, 8 departments |
| POST /departments — create | 200 OK |
| PATCH /departments/:id | 200 OK |
| DELETE /departments/:id | 200 OK |
| GET /holidays | 200 OK (3 holidays — completeness issue SHAPE-003) |
| POST /holidays (with correct `holidayDate` field) | 200 OK |
| PATCH /holidays/:id | 200 OK |
| DELETE /holidays/:id | 200 OK |
| GET /settings/tenant — HR accepted | 200 OK |
| PATCH /settings/tenant — EMPLOYEE rejected | 403 correctly |
| PATCH /settings/tenant — HR accepted | 200 OK |
| GET /settings/email-templates | 200 OK |
| PATCH /settings/email-templates/:type | 200 OK |
| GET /settings/roles-permissions — SA accepted | 200 OK |
| GET /settings/roles-permissions — HR rejected | 403 correctly |
| GET /reports/attendance | 200 OK |
| GET /reports/leaves | 200 OK |
| GET /reports/payroll?year=2026&month=5 | 200 OK |
| GET /reports/scheduled | 200 OK |
| POST /export/employees — MANAGER rejected | 403 correctly |
| POST /export/employees — HR csv format | 200 OK, returns jobId |
| POST /export/attendance — missing dates | 400 correctly |
| POST /export/attendance — with dates | 202 Accepted |
| GET /export/list | 200 OK |
| GET /export/:job_id/download | 200 OK |
| GET /audit-logs — pagination works | PASS (page1/page2 return different records) |
| GET /audit-logs/:id | 200 OK |
| GET /manager/dashboard — EMPLOYEE rejected | 403 correctly |
| GET /manager/dashboard — MANAGER accepted | 200 OK, `managerName, teamSize, pendingApprovals, approvalBreakdown, presentToday, avgAttendancePercent, todayAttendance` |
| GET /manager/team | 200 OK |
| GET /manager/team/attendance | 200 OK |
| GET /manager/approvals | 200 OK |
| GET /employee/dashboard | 200 OK, `employeeName, designation, department, todayAttendance, pendingLeaves, leaveBalanceSummary, upcomingLeave` |
| GET /employee/team | 200 OK |
| GET /employee/documents | 200 OK, returns `{documents: []}` |
| GET /admin/logs — HR accepted | 200 OK |
| GET /admin/logs — EMPLOYEE rejected | 403 correctly |
| Double check-in same day | 409 ALREADY_CHECKED_IN correctly |

---

## Action Priority

| Priority | Bug | Fix |
|----------|-----|-----|
| P0 | BUG-001: MGR can PATCH employees | Add `authorize(['HR_ADMIN','SUPER_ADMIN'])` to PATCH /employees route |
| P0 | BUG-003: EMP can GET /settings/tenant | Add role guard to GET /settings/tenant handler |
| P0 | BUG-004: /logs 404 (wrong path) | Either rename route to `/logs` in logs.routes.js or update all docs to `/admin/logs` |
| P1 | BUG-002: Soft delete returns deletedAt=null | Fix service to set `deletedAt` and GET to return 404 for soft-deleted records |
| P1 | EDGE-001: `date` → `attendanceDate` in regularization | Update Swagger docs and client to use `attendanceDate` |
| P1 | EDGE-002: `date` → `holidayDate` in holidays | Update Swagger docs and client to use `holidayDate` |
| P1 | SHAPE-001: tenantId missing from /auth/me | Add `tenantId` to the auth/me response serializer |
| P2 | EDGE-003: /reports/schedule undocumented fields | Document `report_type, frequency, email_recipients` in Swagger |
| P2 | EDGE-004: /reports/payroll requires year+month | Add default values or document `?year=YYYY&month=M` format |
| P2 | SHAPE-002/003: Only 3 leave types, 3 holidays | Run `npm run db:seed:comprehensive` to restore seed data |
| P3 | WARN-002: Raw FST error code in /auth/refresh | Normalize Fastify body parse errors through errorHandler |
| P3 | WARN-003: Raw Zod schema in error.message | Sanitize validation error messages in the error handler |
