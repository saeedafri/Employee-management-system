import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { config } from '../config/index.js';

const sec = [{ Bearer: [], TenantKey: [] }];
const r200 = { description: 'Success' };
const r201 = { description: 'Created' };
const r400 = { description: 'Bad Request — malformed JSON, missing tenant context, non-field bad request' };
const r401 = { description: 'Unauthorized — missing, expired, or revoked token' };
const r403 = { description: 'Forbidden — authenticated but insufficient role/permission' };
const _r404 = { description: 'Not Found' };
const r404 = _r404;
const _r409 = { description: 'Conflict — duplicate, cycle, or resource already exists' };
const r409 = _r409;
const _r422 = { description: 'Unprocessable Entity — field-level validation failure; error.details[] contains {field, message} pairs' };
const r422 = _r422;
const idParam = [{ in: 'path', name: 'id', type: 'string', required: true, description: 'Resource ID' }];
const pathParam = (name, desc) => ({ in: 'path', name, type: 'string', required: true, description: desc });
const queryParam = (name, type, desc) => ({ in: 'query', name, type, required: false, description: desc });
const pageQuery = [queryParam('page', 'integer', 'Page (default 1)'), queryParam('limit', 'integer', 'Per page')];

function op(tag, summary, security = true, extra = {}) {
  return { tags: [tag], summary, security: security ? sec : undefined, responses: { 200: r200, 401: r401, 403: r403 }, ...extra };
}

export async function swaggerPlugin(fastify) {
  await fastify.register(fastifySwagger, {
    mode: 'dynamic',
    swagger: {
      info: {
        title: config.appName,
        version: config.appVersion,
        description: `Employee Management System Backend API

## How to use this Swagger UI

**Step 1 — Login (sets auth cookie automatically):**
Click \`POST /auth/login\` → Try it out → Execute with one of these bodies:

| Who | Body |
|-----|------|
| HR Admin | \`{"email":"hr@acme.test","password":"Password123!"}\` |
| Manager  | \`{"email":"aman@acme.test","password":"Password123!"}\` |
| Employee | \`{"email":"priya@acme.test","password":"Password123!"}\` |
| SuperAdmin | \`{"email":"superadmin@acme.test","password":"Password123!"}\` |

No \`X-Tenant-Key\` needed — server resolves it from email automatically.

After login the browser stores the \`accessToken\` as an **httpOnly cookie**. All subsequent Swagger calls automatically include it — **you do NOT need to paste anything into Authorize**.

**Step 2 — Test any endpoint:**
Click any endpoint → Try it out → Execute. Auth is automatic via cookie.

---

## Which user to use for which endpoint

| Endpoint | Use this login |
|----------|----------------|
| \`GET /employee/dashboard\` | hr@acme.test OR priya@acme.test OR aman@acme.test |
| \`GET /manager/dashboard\` | aman@acme.test (MANAGER) |
| \`GET /analytics/summary\` | hr@acme.test (HR_ADMIN) |
| \`GET /employees\` | any |

⚠️ **SUPER_ADMIN has no employee record** — \`/employee/dashboard\`, \`/attendance/check-in\`, \`/leave/requests\` will return \`400 NO_EMPLOYEE_RECORD\`. Use hr@acme.test, aman@acme.test or priya@acme.test for those endpoints.

---

## How employeeId works — you never pass it manually

The \`employeeId\` is embedded inside the JWT at login time. The server reads it automatically from the token. There is no \`employeeId\` parameter in any URL — just login as the right user and call the endpoint.

---

## If you need to use curl / Postman instead

Copy the \`accessToken\` cookie value from browser DevTools (Application → Cookies) and add it as a header:
\`Authorization: Bearer <token>\``,
        contact: { name: 'API Support', email: 'support@acme.test' },
      },
      host: config.isDevelopment ? `localhost:${config.port}` : 'employee-management-system-2b9q.onrender.com',
      basePath: config.apiPrefix,
      schemes: [config.isDevelopment ? 'http' : 'https'],
      securityDefinitions: {
        Bearer:    { type: 'apiKey', name: 'Authorization', in: 'header', description: 'Only needed for curl/Postman. In Swagger, just call POST /auth/login first — the accessToken cookie is set automatically and all requests use it. For curl: paste "Bearer eyJ..." here.' },
        TenantKey: { type: 'apiKey', name: 'X-Tenant-Key',  in: 'header', description: 'Tenant key for your organisation. Seed value: acme-corp-001' },
      },
      paths: {

        // ── AUTHENTICATION ────────────────────────────────────────────────────
        '/auth/login': {
          post: op('Authentication', 'User login', false, {
            responses: { 200: { description: 'Sets accessToken + refreshToken as httpOnly cookies. Returns sessionId, user, permissions in body.' }, 400: r400 },
            parameters: [{ in: 'body', name: 'body', required: true, schema: { $ref: '#/definitions/LoginRequest' } }],
          }),
        },
        '/auth/admin/login': {
          post: op('Authentication', 'Admin login (HR_ADMIN / SUPER_ADMIN only)', false, {
            responses: { 200: r200, 400: r400, 403: r403 },
            parameters: [{ in: 'body', name: 'body', required: true, schema: { $ref: '#/definitions/LoginRequest' } }],
          }),
        },
        '/auth/refresh': {
          post: op('Authentication', 'Refresh access token (uses refreshToken cookie)', false),
        },
        '/auth/logout': {
          post: op('Authentication', 'Logout current session', true, {
            responses: {
              200: { description: 'Revokes current session and clears both accessToken and refreshToken cookies.' },
              401: { description: 'Missing access token or invalid/expired/revoked session token' },
              403: r403,
            },
          }),
        },
        '/auth/logout-all': {
          post: op('Authentication', 'Logout from ALL sessions', true, {
            responses: {
              200: { description: 'Revokes all user sessions and clears both accessToken and refreshToken cookies.' },
              401: { description: 'Missing access token or invalid/expired/revoked session token' },
              403: r403,
            },
          }),
        },
        '/auth/me': {
          get: op('Authentication', 'Get current user profile', true, {
            responses: {
              200: r200,
              400: { description: 'Explicit invalid tenant context (for example bad X-Tenant-Key or tenant subdomain)' },
              401: { description: 'Missing access token or invalid/expired/revoked session token' },
              403: r403,
            },
          }),
        },
        '/auth/sessions': {
          get: op('Authentication', 'List all active sessions for current user'),
        },
        '/auth/sessions/{sessionId}': {
          delete: op('Authentication', 'Revoke a specific session', true, {
            parameters: [{ in: 'path', name: 'sessionId', type: 'string', required: true }],
          }),
        },
        '/auth/forgot-password': {
          post: op('Authentication', 'Send password reset email', false),
        },
        '/auth/reset-password/validate': {
          get: op('Authentication', 'Validate reset token before allowing password change', false),
        },
        '/auth/validate-reset-token': {
          get: op('Authentication', 'Validate reset token (alias)', false),
        },
        '/auth/reset-password': {
          post: op('Authentication', 'Reset password using token', false),
        },
        '/auth/otp/initiate': {
          post: op('Authentication', 'Send/resend OTP for a challenge (public) — MFA and forgot-password flows', false),
        },
        '/auth/verify-otp': {
          post: op('Authentication', 'Verify OTP code', false),
        },
        '/auth/resend-otp': {
          post: op('Authentication', 'Resend OTP code', false),
        },
        '/auth/invitation': {
          get: op('Invitation', 'Validate invitation token. Always returns 200 — check status field: VALID | EXPIRED | USED | NOT_FOUND. No auth required.', false, {
            parameters: [{ in: 'query', name: 'token', required: true, type: 'string' }],
            responses: { 200: { description: 'status: VALID | EXPIRED | USED | NOT_FOUND' } },
          }),
        },
        '/auth/accept-invitation': {
          post: op('Invitation', 'Accept invitation: set password and activate account (INVITED → ACTIVE). Does NOT auto-login — FE redirects to /login. Returns 410 INVITE_EXPIRED, 409 INVITE_ALREADY_USED, 404 INVALID_TOKEN, 422 WEAK_PASSWORD.', false, {
            responses: { 200: r200, 404: r404, 409: r409, 410: { description: 'INVITE_EXPIRED' }, 422: r422 },
          }),
        },
        '/auth/invitation/resend': {
          post: op('Invitation', 'Public self-serve invite resend. Always returns generic 200 (prevents enumeration). Rate-limited 5 per 15 min.', false, {
            responses: { 200: r200, 429: { description: 'RATE_LIMITED' } },
          }),
        },

        // ── EMPLOYEES ────────────────────────────────────────────────────────
        '/employees': {
          get: op('Employees', 'List employees with pagination & filters. Soft-deleted employees are always excluded. departmentId filter is subtree-aware — passing a parent department ID returns employees in that department and all descendants.', true, {
            parameters: [
              { in: 'query', name: 'page',         type: 'number',  description: 'Page number (default 1)' },
              { in: 'query', name: 'limit',        type: 'number',  description: 'Per page (default 20)' },
              { in: 'query', name: 'search',       type: 'string',  description: 'Search by name / email' },
              { in: 'query', name: 'departmentId', type: 'string',  description: 'Subtree-aware department filter — includes employees in selected department and all descendants. Soft-deleted excluded.' },
              { in: 'query', name: 'status',       type: 'string',  description: 'ACTIVE | INACTIVE | ON_LEAVE | RESIGNED | TERMINATED' },
              { in: 'query', name: 'location',     type: 'string' },
            ],
          }),
          post: op('Employees', 'Create new employee. Optional fields: memberType (login role, default EMPLOYEE), sendInvite (bool, default false), emailTarget (PERSONAL|WORK). If sendInvite=true, creates User with INVITED status, issues invite token, sends email. Response includes user and invite objects. Email failure does not roll back employee creation.', true, { responses: { 201: r201, 400: r400, 422: { description: 'VALIDATION_ERROR — departmentId invalid path' } } }),
        },
        '/employees/{id}': {
          get:    op('Employees', 'Get employee by ID',    true, { parameters: idParam }),
          patch:  op('Employees', 'Update employee',       true, { parameters: idParam }),
          delete: op('Employees', 'Delete / terminate employee', true, { parameters: idParam }),
        },
        '/employees/{id}/invite': {
          post: op('Employees', 'Send or resend invitation email for an employee. Creates/links User with INVITED status if needed. Rate-limited 3/hr per employee. Errors: 404 EMPLOYEE_NOT_FOUND, 409 ALREADY_ACTIVE, 409 EMPLOYEE_TERMINATED, 422 NO_DELIVERY_EMAIL, 429 RATE_LIMITED.', true, {
            parameters: idParam,
            responses: { 200: r200, 404: r404, 409: r409, 422: r422, 429: { description: 'RATE_LIMITED' } },
          }),
        },
        '/employees/export/csv': {
          get: op('Employees', 'Export employees as CSV'),
        },

        // ── DEPARTMENTS ──────────────────────────────────────────────────────
        '/departments': {
          get:  op('Departments', 'List all departments (hierarchical tree). Each node includes headEmployee plus flat headEmployeeFirstName / headEmployeeLastName / headEmployeeName. _count.employees is an inclusive subtree count (direct + all descendants). directEmployeeCount is direct-only.'),
          post: op('Departments', 'Create department (HR_ADMIN/SUPER_ADMIN). headEmployeeId optional — must be an employee in this tenant who does not already head another department.', true, {
            responses: { 201: r201, 400: r400, 409: { description: 'Duplicate code or head employee already heads another department' } },
            parameters: [{ in: 'body', name: 'body', required: true, schema: { $ref: '#/definitions/DepartmentInput' } }],
          }),
        },
        '/departments/{id}': {
          patch:  op('Departments', 'Update department (HR_ADMIN/SUPER_ADMIN). Send headEmployeeId to set the department head (null to clear). Response echoes headEmployee object plus headEmployeeFirstName / headEmployeeLastName / headEmployeeName.', true, {
            responses: { 200: r200, 400: r400, 404: { description: 'Department not found' }, 409: { description: 'Duplicate code, circular parent, or head employee already heads another department' } },
            parameters: [...idParam, { in: 'body', name: 'body', required: true, schema: { $ref: '#/definitions/DepartmentInput' } }],
          }),
          delete: op('Departments', 'Delete department', true, { parameters: idParam }),
        },

        // ── HOLIDAYS ─────────────────────────────────────────────────────────
        '/holidays': {
          get:  op('Holidays', 'List all holidays', true, {
            parameters: [
              { in: 'query', name: 'year', type: 'number', description: 'Year (default current year)' },
              { in: 'query', name: 'country', type: 'string' },
            ],
          }),
          post: op('Holidays', 'Create holiday (HR_ADMIN)', true, { responses: { 201: r201 } }),
        },
        '/holidays/upcoming': {
          get: op('Holidays', 'Upcoming holidays — widget for employee dashboard (limit 1–10, default 3)', true, {
            parameters: [{ in: 'query', name: 'limit', type: 'integer', description: 'Max holidays to return (default 3)' }],
          }),
        },
        '/holidays/{id}': {
          patch:  op('Holidays', 'Update holiday', true, { parameters: idParam }),
          delete: op('Holidays', 'Delete holiday', true, { parameters: idParam }),
        },
        '/holidays/import': {
          post: op('Holidays', 'Upload .ics file to import holidays (HR_ADMIN) — returns jobId for preview/commit', true, { responses: { 202: { description: 'Accepted' } } }),
        },
        '/holidays/import/{jobId}/preview': {
          get: op('Holidays', 'Preview candidates from import job before committing', true, {
            parameters: [{ in: 'path', name: 'jobId', type: 'string', required: true }],
          }),
        },
        '/holidays/import/{jobId}/commit': {
          post: op('Holidays', 'Commit import job — writes holidays to DB', true, {
            parameters: [{ in: 'path', name: 'jobId', type: 'string', required: true }],
          }),
        },

        // ── ATTENDANCE ───────────────────────────────────────────────────────
        '/attendance/check-in': {
          post: op('Attendance', 'Record check-in'),
        },
        '/attendance/check-out': {
          post: op('Attendance', 'Record check-out'),
        },
        '/attendance/records': {
          get: op('Attendance', 'Get my attendance records', true, {
            parameters: [
              { in: 'query', name: 'from',  type: 'string', description: 'Date from (YYYY-MM-DD)' },
              { in: 'query', name: 'to',    type: 'string', description: 'Date to (YYYY-MM-DD)' },
              { in: 'query', name: 'page',  type: 'number' },
              { in: 'query', name: 'limit', type: 'number' },
            ],
          }),
        },
        '/attendance/summary': {
          get: op('Attendance', 'Get attendance summary/stats'),
        },
        '/attendance/team/records': {
          get: op('Attendance', 'Get team attendance records (manager)'),
        },
        '/attendance/regularization': {
          post: op('Attendance', 'Submit attendance regularization request'),
          get:  op('Attendance', 'List my regularization requests'),
        },
        '/attendance/team/regularization': {
          get: op('Attendance', 'List team regularization requests (manager)'),
        },
        '/attendance/regularization/{id}/approve': {
          patch: op('Attendance', 'Approve regularization request', true, { parameters: idParam }),
        },
        '/attendance/regularization/{id}/deny': {
          patch: op('Attendance', 'Deny regularization request', true, { parameters: idParam }),
        },

        // ── LEAVE ────────────────────────────────────────────────────────────
        '/leave/balance': {
          get: op('Leave', 'Get leave balance for current employee'),
        },
        '/leave/requests': {
          get:  op('Leave', 'List my leave requests'),
          post: op('Leave', 'Create leave request', true, { responses: { 201: r201 } }),
        },
        '/leave/team/requests': {
          get: op('Leave', 'List team leave requests (manager)', true, {
            parameters: [
              { in: 'query', name: 'status', type: 'string', description: 'PENDING | APPROVED | DENIED' },
            ],
          }),
        },
        '/leave/requests/{id}/approve': {
          patch: op('Leave', 'Approve leave request', true, { parameters: idParam }),
        },
        '/leave/requests/{id}/reject': {
          patch: op('Leave', 'Reject leave request', true, { parameters: idParam }),
        },
        '/leave/requests/{id}/withdraw': {
          patch: op('Leave', 'Withdraw leave request', true, { parameters: idParam }),
        },

        // ── ANALYTICS ────────────────────────────────────────────────────────
        '/analytics/summary': {
          get: op('Analytics', 'Overall dashboard summary (headcount, attendance %, leave stats)'),
        },
        '/analytics/attendance': {
          get: op('Analytics', 'Attendance analytics over time'),
        },
        '/analytics/headcount-by-department': {
          get: op('Analytics', 'Headcount breakdown by top-level department. employeeCount and activeCount are inclusive subtree counts — each root department includes all employees from its child, grandchild, and deeper descendant departments.'),
        },
        '/analytics/recent-activity': {
          get: op('Analytics', 'Recent activity feed'),
        },
        '/analytics/leave-summary': {
          get: op('Analytics', 'Leave summary analytics'),
        },
        '/analytics/workforce-trend': {
          get: op('Analytics', 'Monthly workforce trend — headcount, hires, exits, net change. ?range=6m|12m|2y. HR_ADMIN/SUPER_ADMIN only.'),
        },
        '/analytics/attrition': {
          get: op('Analytics', 'Attrition rate trend over time. ?range=6m|12m|2y. HR_ADMIN/SUPER_ADMIN only.'),
        },
        '/analytics/payroll-cost': {
          get: op('Analytics', 'Monthly payroll cost trend. ?range=6m|12m. HR_ADMIN/SUPER_ADMIN only.'),
        },
        '/analytics/department-performance': {
          get: op('Analytics', 'Department performance metrics. ?range=30d|90d. MANAGER sees own dept only; HR_ADMIN/SUPER_ADMIN see all.'),
        },

        // ── DASHBOARD ────────────────────────────────────────────────────────
        '/employee/dashboard': {
          get: op('Dashboard', 'Employee personal dashboard — summary, attendance today, leave balance, upcoming holidays, recent docs'),
        },
        '/attendance/today': {
          get: op('Dashboard', 'Today\'s attendance status for current employee'),
        },
        '/employee/documents': {
          get: op('Dashboard', 'Employee documents list'),
        },
        '/employee/team': {
          get: op('Dashboard', 'Employee\'s team members'),
        },
        '/manager/dashboard': {
          get: op('Dashboard', 'Manager dashboard with team overview'),
        },
        '/manager/team': {
          get: op('Dashboard', 'Manager\'s team list'),
        },
        '/manager/team/attendance': {
          get: op('Dashboard', 'Team attendance for manager'),
        },
        '/manager/approvals': {
          get: op('Dashboard', 'Pending approvals for manager'),
        },
        '/manager/leave-requests/{id}/decision': {
          patch: op('Dashboard', 'Approve/reject leave request (manager)', true, { parameters: idParam }),
        },
        '/manager/regularization-requests/{id}/decision': {
          patch: op('Dashboard', 'Approve/deny regularization request (manager)', true, { parameters: idParam }),
        },

        // ── EXPORT ───────────────────────────────────────────────────────────
        '/export/employees': {
          post: op('Export', 'Export employees data (CSV/Excel)', true, { responses: { 201: r201 } }),
        },
        '/export/attendance': {
          post: op('Export', 'Export attendance data', true, { responses: { 201: r201 } }),
        },
        '/export/leave': {
          post: op('Export', 'Export leave data', true, { responses: { 201: r201 } }),
        },
        '/export/list': {
          get: op('Export', 'List all export jobs'),
        },
        '/export/{job_id}/download': {
          get: op('Export', 'Download export file by job ID', true, {
            parameters: [{ in: 'path', name: 'job_id', type: 'string', required: true }],
          }),
        },

        // ── REPORTS ──────────────────────────────────────────────────────────
        '/reports/attendance': {
          get: op('Reports', 'Attendance report', true, {
            parameters: [
              { in: 'query', name: 'from_date', type: 'string', description: 'YYYY-MM-DD' },
              { in: 'query', name: 'to_date', type: 'string', description: 'YYYY-MM-DD' },
              { in: 'query', name: 'department_id', type: 'string' },
              { in: 'query', name: 'format', type: 'string', description: 'json | csv (default json)' },
            ],
          }),
        },
        '/reports/leaves': {
          get: op('Reports', 'Leave report', true, {
            parameters: [
              { in: 'query', name: 'from_date', type: 'string', description: 'YYYY-MM-DD' },
              { in: 'query', name: 'to_date', type: 'string', description: 'YYYY-MM-DD' },
              { in: 'query', name: 'leave_type', type: 'string' },
              { in: 'query', name: 'department_id', type: 'string' },
              { in: 'query', name: 'format', type: 'string', description: 'json | csv' },
            ],
          }),
        },
        '/reports/payroll': {
          get: op('Reports', 'Payroll report (SUPER_ADMIN only) — requires month + year query params', true, {
            parameters: [
              { in: 'query', name: 'month', type: 'integer', required: true, description: '1–12' },
              { in: 'query', name: 'year',  type: 'integer', required: true, description: 'e.g. 2026' },
              { in: 'query', name: 'department_id', type: 'string' },
            ],
          }),
        },
        '/reports/schedule': {
          post: op('Reports', 'Schedule a recurring report', true, {
            responses: { 201: r201 },
            parameters: [{ in: 'body', name: 'body', required: true, schema: {
              type: 'object',
              required: ['report_type', 'frequency', 'email_recipients'],
              properties: {
                report_type: { type: 'string', enum: ['attendance', 'leaves', 'payroll'], description: 'Use snake_case: attendance | leaves | payroll' },
                frequency: { type: 'string', enum: ['WEEKLY', 'MONTHLY'] },
                email_recipients: { type: 'array', items: { type: 'string', format: 'email' }, description: 'List of recipient emails' },
              },
            }}],
          }),
        },
        '/reports/scheduled': {
          get: op('Reports', 'List scheduled reports', true, {
            parameters: [
              { in: 'query', name: 'page', type: 'integer' },
              { in: 'query', name: 'limit', type: 'integer' },
            ],
          }),
        },
        '/reports/scheduled/{id}': {
          patch:  op('Reports', 'Update scheduled report', true, {
            parameters: [...idParam, { in: 'body', name: 'body', schema: {
              type: 'object',
              properties: {
                frequency: { type: 'string', enum: ['WEEKLY', 'MONTHLY'] },
                email_recipients: { type: 'array', items: { type: 'string', format: 'email' } },
                is_active: { type: 'boolean' },
              },
            }}],
          }),
          delete: op('Reports', 'Delete scheduled report', true, { parameters: idParam }),
        },
        '/reports/export-history': {
          get: op('Reports', 'Export history list', true, {
            parameters: [
              { in: 'query', name: 'page', type: 'integer' },
              { in: 'query', name: 'limit', type: 'integer' },
              { in: 'query', name: 'status', type: 'string', description: 'SUCCESS | FAILED' },
            ],
          }),
        },

        // ── PHASE 2 REPORTS ───────────────────────────────────────────────────
        '/reports/workforce/headcount': {
          get: op('Reports', 'Headcount over time — monthly headcount, hires, exits per dept. HR_ADMIN/SUPER_ADMIN only. ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&departmentId=', true),
        },
        '/reports/workforce/turnover': {
          get: op('Reports', 'Attrition/turnover — exits over the period with per-employee table. HR_ADMIN/SUPER_ADMIN only.', true),
        },
        '/reports/workforce/demographics': {
          get: op('Reports', 'Breakdown by employment type, gender, department. HR_ADMIN/SUPER_ADMIN only. ?departmentId=', true),
        },
        '/reports/attendance/summary': {
          get: op('Reports', 'Monthly attendance summary per employee. HR_ADMIN/SUPER_ADMIN only. ?month=YYYY-MM&departmentId=&page=&limit=', true),
        },
        '/reports/attendance/absenteeism': {
          get: op('Reports', 'Absenteeism trend — unauthorized absences over time. HR_ADMIN/SUPER_ADMIN only.', true),
        },
        '/reports/leave/utilization': {
          get: op('Reports', 'Leave utilization — how much allocated leave is being used. HR_ADMIN/SUPER_ADMIN only. ?year=&departmentId=&leaveTypeId=', true),
        },
        '/reports/leave/pending': {
          get: op('Reports', 'All pending leave requests across the org. HR_ADMIN/SUPER_ADMIN only. ?departmentId=&leaveTypeId=&page=&limit=', true),
        },
        '/reports/payroll/summary': {
          get: op('Reports', 'Payroll cost by month and department. HR_ADMIN/SUPER_ADMIN only.', true),
        },
        '/reports/payroll/ctc-analysis': {
          get: op('Reports', 'CTC band distribution and salary percentile analysis. HR_ADMIN/SUPER_ADMIN only. ?departmentId=', true),
        },
        '/reports/export': {
          post: op('Reports', 'Export a report as CSV. HR_ADMIN/SUPER_ADMIN only. reportType: workforce/headcount|workforce/turnover|workforce/demographics|attendance/summary|attendance/absenteeism|leave/utilization|leave/pending|payroll/summary|payroll/ctc-analysis', true, {
            responses: { 202: r201 },
            parameters: [{ in: 'body', name: 'body', required: true, schema: {
              type: 'object',
              required: ['reportType'],
              properties: {
                reportType: { type: 'string', description: 'e.g. workforce/headcount, attendance/summary' },
                format: { type: 'string', enum: ['CSV'], default: 'CSV' },
                filters: { type: 'object', additionalProperties: true },
              },
            }}],
          }),
        },

        // ── PAYROLL ──────────────────────────────────────────────────────────
        '/payroll/components': {
          get:  op('Payroll', 'List salary components. HR_ADMIN/SUPER_ADMIN. ?active=true|false', true),
          post: op('Payroll', 'Create salary component. HR_ADMIN/SUPER_ADMIN. Required: name, code, type, calculationType, taxable', true, { responses: { 201: r201, 400: r400, 409: { description: 'CODE_EXISTS' } } }),
        },
        '/payroll/components/{id}': {
          patch:  op('Payroll', 'Update component. code is immutable.', true, { parameters: idParam }),
          delete: op('Payroll', 'Delete component. SUPER_ADMIN only.', true, { parameters: idParam, responses: { 200: r200, 403: r403, 409: { description: 'COMPONENT_IN_USE' } } }),
        },
        '/payroll/groups': {
          get:  op('Payroll', 'List pay groups with components. HR_ADMIN/SUPER_ADMIN.', true),
          post: op('Payroll', 'Create pay group. Required: name, code. Optional: currency, paySchedule, components[]', true, { responses: { 201: r201 } }),
        },
        '/payroll/groups/{id}': {
          patch:  op('Payroll', 'Update pay group. code is immutable.', true, { parameters: idParam }),
          delete: op('Payroll', 'Delete pay group. SUPER_ADMIN only.', true, { parameters: idParam, responses: { 200: r200, 403: r403, 409: { description: 'GROUP_HAS_EMPLOYEES' } } }),
        },
        '/payroll/schedules': {
          get: op('Payroll', 'List non-monthly pay schedules. HR_ADMIN/SUPER_ADMIN.', true),
        },
        '/payroll/employees/{employeeId}/salary': {
          get:   op('Payroll', 'Get employee salary config. HR sees full; EMPLOYEE sees own (bank masked).', true, { parameters: [pathParam('employeeId', 'Employee ID')] }),
          post:  op('Payroll', 'Set employee salary. HR_ADMIN/SUPER_ADMIN. Required: payGroupId, annualCtc, effectiveFrom. Creates history.', true, { parameters: [pathParam('employeeId', 'Employee ID')], responses: { 201: r201 } }),
          patch: op('Payroll', 'Update employee salary. Creates new record, closes old. Same as POST but all fields optional.', true, { parameters: [pathParam('employeeId', 'Employee ID')], responses: { 201: r201 } }),
        },
        '/payroll/employees/{employeeId}/payslips': {
          get: op('Payroll', 'List employee payslips. HR sees any; EMPLOYEE sees own.', true, { parameters: [pathParam('employeeId', 'Employee ID'), ...pageQuery, queryParam('year', 'string', 'Filter by year e.g. 2026')] }),
        },
        '/payroll/employees/{employeeId}/payslips/{payslipId}': {
          get: op('Payroll', 'Get payslip detail with earnings/deductions breakdown. Response includes `documentUrl` — direct Cloudinary WebP link to the downloadable payslip (null if not generated yet).', true, { parameters: [pathParam('employeeId', 'Employee ID'), pathParam('payslipId', 'Payslip ID')] }),
        },
        '/payroll/runs': {
          get:  op('Payroll', 'List payroll runs. HR_ADMIN/SUPER_ADMIN. ?page&limit&year&status', true),
          post: op('Payroll', 'Initiate payroll run. Required: period (YYYY-MM | YYYY-MM-H1 | YYYY-MM-H2 | YYYY-Wnn). For sub-monthly/weekly send startDate, endDate, payDate, paySchedule. Duplicate detection is by cycle identity (paySchedule + startDate + endDate), so weekly and bi-weekly runs sharing a YYYY-Wnn string do not collide. 409 RUN_EXISTS when the same cycle already exists.', true, { responses: { 201: r201, 409: { description: 'RUN_EXISTS' } } }),
        },
        '/payroll/pay-calendars/{id}/cycles': {
          get: op('Payroll', 'List computed pay cycles for a calendar over a month range. Query: ?from=YYYY-MM&to=YYYY-MM. Returns MONTHLY/SEMI_MONTHLY(H1,H2)/BIWEEKLY/WEEKLY cycles with startDate, endDate, payDate, cutoffDate.', true, { parameters: [pathParam('id', 'Pay calendar ID'), queryParam('from', 'string', 'Start month YYYY-MM'), queryParam('to', 'string', 'End month YYYY-MM')] }),
        },
        '/payroll/runs/{id}': {
          get: op('Payroll', 'Get payroll run detail with summary (byDepartment, warnings).', true, { parameters: idParam }),
        },
        '/payroll/runs/{id}/calculate': {
          post: op('Payroll', 'Calculate run (DRAFT → REVIEW). Builds payslips for all employees with salary config. Returns 202.', true, { parameters: idParam, responses: { 202: r201 } }),
        },
        '/payroll/runs/{id}/approve': {
          post: op('Payroll', 'Approve run (REVIEW → APPROVED). HR_ADMIN/SUPER_ADMIN. Optional: notes', true, { parameters: idParam }),
        },
        '/payroll/runs/{id}/mark-paid': {
          patch: op('Payroll', 'Mark run PAID (APPROVED → PAID). HR_ADMIN/SUPER_ADMIN. Optional: paidAt, paymentReference', true, { parameters: idParam }),
        },
        '/payroll/runs/{id}/cancel': {
          post: op('Payroll', 'Cancel run. SUPER_ADMIN only. Cannot cancel PAID runs.', true, { parameters: idParam }),
        },
        '/payroll/runs/{runId}/payslips': {
          get: op('Payroll', 'List payslips in run. HR_ADMIN/SUPER_ADMIN.', true, { parameters: [pathParam('runId', 'Payroll run ID'), ...pageQuery, queryParam('departmentId', 'string', 'Filter by department'), queryParam('search', 'string', 'Search by name/code')] }),
        },
        '/payroll/runs/{runId}/payslips/{payslipId}': {
          get:   op('Payroll', 'Get payslip detail within a run. Response includes `documentUrl` — direct Cloudinary WebP link to the downloadable payslip (null if not generated yet).', true, { parameters: [pathParam('runId', 'Payroll run ID'), pathParam('payslipId', 'Payslip ID')] }),
          patch: op('Payroll', 'Add one-time adjustments (bonus/deduction) to payslip. Body: oneTimeAdditions[], oneTimeDeductions[], notes', true, { parameters: [pathParam('runId', 'Payroll run ID'), pathParam('payslipId', 'Payslip ID')] }),
        },
        '/payroll/runs/{runId}/export': {
          get: op('Payroll', 'Export payroll register as CSV. Returns Content-Type: text/csv.', true, { parameters: [pathParam('runId', 'Payroll run ID')] }),
        },

        // ── AUDIT LOGS ───────────────────────────────────────────────────────
        '/audit-logs': {
          get: op('Audit Logs', 'List audit logs with filters', true, {
            parameters: [
              { in: 'query', name: 'page',       type: 'integer' },
              { in: 'query', name: 'limit',      type: 'integer' },
              { in: 'query', name: 'user_email', type: 'string', description: 'Filter by actor email' },
              { in: 'query', name: 'action',     type: 'string', description: 'e.g. CREATE, UPDATE, DELETE' },
              { in: 'query', name: 'entity',     type: 'string', description: 'e.g. EMPLOYEE, LEAVE' },
              { in: 'query', name: 'from_date',  type: 'string', description: 'YYYY-MM-DD' },
              { in: 'query', name: 'to_date',    type: 'string', description: 'YYYY-MM-DD' },
            ],
          }),
        },
        '/audit-logs/{id}': {
          get: op('Audit Logs', 'Get audit log by ID', true, { parameters: idParam }),
        },
        '/audit-logs/dpia-report': {
          post: op('Audit Logs', 'Generate GDPR DPIA report — requires from_date + to_date in body', true, {
            parameters: [{ in: 'body', name: 'body', required: true, schema: {
              type: 'object',
              required: ['from_date', 'to_date'],
              properties: {
                from_date: { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
                to_date:   { type: 'string', format: 'date', description: 'YYYY-MM-DD' },
              },
            }}],
          }),
        },
        '/audit-logs/export': {
          get: op('Audit Logs', 'Export audit logs — streams file (CSV or JSON with Content-Disposition)', true, {
            parameters: [
              { in: 'query', name: 'from_date', type: 'string', description: 'YYYY-MM-DD' },
              { in: 'query', name: 'to_date',   type: 'string', description: 'YYYY-MM-DD' },
              { in: 'query', name: 'format',    type: 'string', description: 'json (default) | csv' },
            ],
          }),
        },

        // ── ADMIN / SYSTEM LOGS ──────────────────────────────────────────────
        '/admin/logs': {
          get: op('System Logs', 'List system logs (SUPER_ADMIN)', true, {
            parameters: [
              { in: 'query', name: 'level',  type: 'string', description: 'error | warn | info' },
              { in: 'query', name: 'from',   type: 'string' },
              { in: 'query', name: 'to',     type: 'string' },
              { in: 'query', name: 'page',   type: 'number' },
              { in: 'query', name: 'limit',  type: 'number' },
            ],
          }),
        },
        '/admin/logs/{id}': {
          get: op('System Logs', 'Get system log entry by ID', true, { parameters: idParam }),
        },
        '/admin/logs/export': {
          get: op('System Logs', 'Export system logs'),
        },
        '/admin/logs/stream': {
          get: op('System Logs', 'Stream system logs (WebSocket/SSE)'),
        },

        // ── SETTINGS ─────────────────────────────────────────────────────────
        '/settings/tenant': {
          get:   op('Settings', 'Get tenant configuration'),
          patch: op('Settings', 'Update tenant configuration'),
        },
        '/settings/email-templates': {
          get: op('Settings', 'List email templates'),
        },
        '/settings/email-templates/{type}': {
          patch: op('Settings', 'Update email template by type', true, {
            parameters: [{ in: 'path', name: 'type', type: 'string', required: true, description: 'Template type (e.g. welcome, reset-password)' }],
          }),
        },
        '/settings/roles-permissions': {
          get:   op('Settings', 'Get roles and permissions (SUPER_ADMIN)'),
          patch: op('Settings', 'Update roles and permissions (SUPER_ADMIN)'),
        },
        '/settings/branding': {
          get:   op('Settings', 'Get tenant branding (logo_url, primary_color_hex)'),
          patch: {
            tags: ['Settings'],
            summary: 'Update tenant branding',
            description: 'Multipart: fields logo (PNG/JPEG/WebP/SVG ≤1 MB, converted to WebP) + primary_color_hex. JSON: {logo_url, primary_color_hex}. HR_ADMIN or SUPER_ADMIN only.',
            security: [{ Bearer: [] }],
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      logo: { type: 'string', format: 'binary', description: 'PNG/JPEG/WebP/SVG, max 1 MB' },
                      primary_color_hex: { type: 'string', example: '#3b5cff', description: '#RRGGBB' },
                    },
                  },
                },
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      logo_url: { type: 'string', example: 'https://res.cloudinary.com/.../logo.webp' },
                      primary_color_hex: { type: 'string', example: '#3b5cff' },
                    },
                  },
                },
              },
            },
            responses: {
              200: { description: 'Updated branding', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
              422: { description: 'INVALID_FILE_TYPE / FILE_TOO_LARGE / VALIDATION_ERROR' },
              503: { description: 'STORAGE_NOT_CONFIGURED' },
              502: { description: 'UPLOAD_FAILED' },
            },
          },
        },
        '/settings/attendance-rules': {
          get:   op('Settings', 'Get attendance rules (work_week_days, late_after, thresholds, etc.)'),
          patch: op('Settings', 'Update attendance rules — any subset of the GET response'),
        },
        '/settings/security/auth': {
          get:   op('Settings', 'Get auth/security settings (SUPER_ADMIN) — password policy, MFA, session timeout'),
          patch: op('Settings', 'Update auth/security settings (SUPER_ADMIN)'),
        },
        '/settings/notifications/preferences': {
          get:   op('Settings', 'Get notification preferences for the current user (channels + event subscriptions)'),
          patch: op('Settings', 'Update notification preferences for the current user'),
        },
        '/settings/leave-types': {
          get:  op('Settings', 'List all leave types (alias for GET /leave/types)'),
          post: op('Settings', 'Create a new leave type (HR_ADMIN)', true, { responses: { 201: r201, 409: { description: 'DUPLICATE_LEAVE_TYPE_CODE' } } }),
        },
        '/settings/leave-types/{id}': {
          patch:  op('Settings', 'Update leave type by ID', true, { parameters: idParam }),
          delete: op('Settings', 'Delete leave type by ID — fails 409 if active balances exist', true, { parameters: idParam }),
        },
        '/settings/roles': {
          post: op('Settings', 'Create a custom role (HR_ADMIN)', true, { responses: { 201: r201, 409: { description: 'DUPLICATE_ROLE_KEY' } } }),
        },
        '/settings/roles/{key}': {
          delete: op('Settings', 'Delete a custom role — fails 409 if users are assigned', true, {
            parameters: [{ in: 'path', name: 'key', type: 'string', required: true, description: 'Role key e.g. RECRUITER' }],
          }),
        },
        '/settings/roles/{key}/users': {
          post: op('Settings', 'Assign users to a role', true, {
            parameters: [{ in: 'path', name: 'key', type: 'string', required: true }],
          }),
        },
        '/settings/integrations/email': {
          get: op('Settings', 'Email integration status (Resend/SMTP)', true),
          patch: op('Settings', 'Update email integration settings', true),
        },
        '/settings/integrations/email/stats': {
          get: op('Settings', 'Email delivery stats (24h)', true),
        },
        '/settings/integrations/storage': {
          get: op('Settings', 'Storage integration status (Cloudinary)', true),
          patch: op('Settings', 'Update storage integration settings', true),
        },
        '/settings/webhooks': {
          get: op('Settings', 'List outbound webhooks', true),
          post: op('Settings', 'Create webhook', true),
        },
        '/settings/webhooks/{id}': {
          patch: op('Settings', 'Update webhook', true, { parameters: [{ in: 'path', name: 'id', type: 'string', required: true }] }),
          delete: op('Settings', 'Delete webhook', true, { parameters: [{ in: 'path', name: 'id', type: 'string', required: true }] }),
        },
        '/employees/{id}/activity': {
          get: op('Employees', 'Employee activity timeline', true, {
            parameters: [
              { in: 'path', name: 'id', type: 'string', required: true },
              { in: 'query', name: 'limit', type: 'integer' },
            ],
          }),
        },

        // ── NOTIFICATIONS ─────────────────────────────────────────────────────
        '/notifications': {
          get: op('Notifications', 'List notifications for current user (newest first, expired excluded)', true, {
            parameters: [
              { in: 'query', name: 'page',       type: 'integer', description: 'Page number (default 1)' },
              { in: 'query', name: 'limit',       type: 'integer', description: 'Items per page (default 20)' },
              { in: 'query', name: 'unreadOnly',  type: 'boolean', description: 'Filter to unread only' },
              { in: 'query', name: 'since',       type: 'string',  description: 'ISO timestamp — return notifications created after this time (poll-based updates)' },
            ],
          }),
        },
        '/notifications/unread-count': {
          get: op('Notifications', 'Get unread notification count (for bell icon badge)'),
        },
        '/notifications/read-all': {
          patch: op('Notifications', 'Mark all notifications as read (PATCH)'),
          post:  op('Notifications', 'Mark all notifications as read (POST alias)'),
        },
        '/notifications/{id}/read': {
          patch: op('Notifications', 'Mark a single notification as read (PATCH)', true, { parameters: idParam }),
          post:  op('Notifications', 'Mark a single notification as read (POST alias)', true, { parameters: idParam }),
        },
        '/notifications/stream': {
          get: op('Notifications', 'SSE stream for real-time notifications — pass ?token=<accessToken>', false),
        },

        // ── SEARCH ────────────────────────────────────────────────────────────
        '/search': {
          get: op('Search', 'Global search across employees, departments, leave, holidays — permission-aware', true, {
            parameters: [
              { in: 'query', name: 'q',     type: 'string',  required: true,  description: 'Search query (min 1 char)' },
              { in: 'query', name: 'types', type: 'string',  description: 'Comma-separated entity types: employee,department,leave,holiday' },
              { in: 'query', name: 'limit', type: 'integer', description: 'Max results (default 8, max 20)' },
            ],
          }),
        },

        // ── EMPLOYEES (new endpoints) ─────────────────────────────────────────
        '/employees/next-code': {
          get: op('Employees', 'Get next auto-generated employee code for the Add Employee form (HR_ADMIN)'),
        },
        '/employees/me/documents': {
          get: op('Employees', 'Get current user\'s own documents (alias for /employee/documents)'),
        },
        '/employees/me/team': {
          get: op('Employees', 'Get current user\'s team (alias for /employee/team)'),
        },
        '/employees/{id}/photo': {
          post:   op('Employees', 'Upload / replace profile photo — any image format, auto-converted to WebP 800×800. HR/Admin or own.', true, {
            parameters: idParam,
            responses: { 200: r200, 400: r400, 403: r403, 503: { description: 'Storage not configured' } },
          }),
          delete: op('Employees', 'Delete profile photo for an employee. HR/Admin or own.', true, { parameters: idParam }),
        },
        '/employees/bulk/deactivate': {
          post: op('Employees', 'Bulk deactivate employees — returns { succeeded, failed } (HR_ADMIN)', true, {
            parameters: [{ in: 'body', name: 'body', required: true, schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } } }],
          }),
        },
        '/employees/bulk/export': {
          post: op('Employees', 'Bulk export selected employees — returns a job (HR_ADMIN)', true, {
            parameters: [{ in: 'body', name: 'body', schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, format: { type: 'string', enum: ['csv', 'excel', 'json'] } } } }],
          }),
        },
        '/employees/{id}/documents': {
          get:  op('Employees', 'List documents for an employee', true, { parameters: idParam }),
          post: op('Employees', 'Upload a document (multipart/form-data). Requires Cloudinary env vars.', true, { parameters: idParam, responses: { 201: r201 } }),
        },
        '/employees/{id}/documents/presign': {
          post: op('Employees', 'Get presign info for document upload — returns uploadUrl + documentId', true, { parameters: idParam }),
        },
        '/employees/{id}/documents/{documentId}/confirm': {
          post: op('Employees', 'Confirm document upload after file transfer', true, {
            parameters: [...idParam, { in: 'path', name: 'documentId', type: 'string', required: true }],
            responses: { 201: r201 },
          }),
        },
        '/employees/{id}/documents/{documentId}/download': {
          get: op('Employees', 'Redirect (302) to signed download URL for a document', true, {
            parameters: [...idParam, { in: 'path', name: 'documentId', type: 'string', required: true }],
          }),
        },
        '/employees/{id}/documents/{docId}': {
          delete: op('Employees', 'Delete an employee document (HR_ADMIN)', true, {
            parameters: [...idParam, { in: 'path', name: 'docId', type: 'string', required: true }],
          }),
        },

        // ── DEPARTMENTS (new endpoints) ───────────────────────────────────────
        '/departments/{id}/members': {
          post: op('Departments', 'Bulk assign existing employees to a department (HR_ADMIN/SUPER_ADMIN). Idempotent — already-assigned employees counted as skipped. _count.employees is updated inclusive subtree count.', true, {
            parameters: [...idParam, { in: 'body', name: 'body', required: true, schema: { type: 'object', required: ['employeeIds'], properties: { employeeIds: { type: 'array', items: { type: 'string' }, minItems: 1 } } } }],
            responses: { 200: r200, 403: r403, 404: { description: 'DEPARTMENT_NOT_FOUND or EMPLOYEE_NOT_FOUND' }, 422: { description: 'VALIDATION_ERROR — employeeIds empty or invalid' } },
          }),
        },
        '/departments/{id}/employees': {
          get: op('Departments', 'List employees in a department and all descendant departments (subtree-inclusive). pagination.total reflects the full subtree count.', true, {
            parameters: [
              ...idParam,
              { in: 'query', name: 'page',   type: 'integer' },
              { in: 'query', name: 'limit',  type: 'integer' },
              { in: 'query', name: 'search', type: 'string' },
            ],
          }),
        },
        '/departments/{id}/reassign-and-delete': {
          post: op('Departments', 'Reassign all employees to another department then soft-delete this one (atomic)', true, {
            parameters: [
              ...idParam,
              { in: 'body', name: 'body', required: true, schema: { type: 'object', properties: { reassignEmployeesTo: { type: 'string', description: 'Target department ID' } } } },
            ],
          }),
        },

        // ── LEAVE (new endpoints) ─────────────────────────────────────────────
        '/leave/types': {
          get: op('Leave', 'List all leave types for the tenant'),
        },
        '/leave/balance/me': {
          get: op('Leave', 'Get leave balance for current employee (alias for /leave/balance)'),
        },
        '/leave/team/calendar': {
          get: op('Leave', 'Team leave calendar — list of who is on leave for a month (MANAGER+)', true, {
            parameters: [
              { in: 'query', name: 'month', type: 'string', description: 'YYYY-MM — defaults to current month' },
              { in: 'query', name: 'departmentId', type: 'string' },
            ],
          }),
        },
        '/leave/team/coverage': {
          get: op('Leave', 'Team leave coverage for a date — coverage %, isBelowThreshold (MANAGER+)', true, {
            parameters: [
              { in: 'query', name: 'date',         type: 'string',  required: true, description: 'Date YYYY-MM-DD' },
              { in: 'query', name: 'departmentId', type: 'string',  description: 'Filter to department' },
            ],
          }),
        },
        '/leave/requests/bulk/approve': {
          post: op('Leave', 'Bulk approve leave requests — returns { succeeded, failed } (MANAGER+)', true, {
            parameters: [{ in: 'body', name: 'body', schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, comment: { type: 'string' } } } }],
          }),
        },
        '/leave/requests/bulk/reject': {
          post: op('Leave', 'Bulk reject leave requests — returns { succeeded, failed } (MANAGER+)', true, {
            parameters: [{ in: 'body', name: 'body', schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } }, comment: { type: 'string' } } } }],
          }),
        },
        '/leave/requests/bulk-approve': {
          post: op('Leave', 'Bulk approve (legacy alias — prefer /bulk/approve)'),
        },
        '/leave/requests/bulk-deny': {
          post: op('Leave', 'Bulk deny (legacy alias — prefer /bulk/reject)'),
        },

        // ── LEAVE ENGINE (Phase 4 — versioned policies, ledger, comp-off) ─────
        '/leave/policy-packs/catalog': {
          get: op('Leave Engine', 'Starter leave policy pack catalog (IN/US/AE/GLOBAL) — MANAGER+'),
        },
        '/leave/policy-packs/seed': {
          post: op('Leave Engine', 'Seed starter packs as tenant policies, idempotent (HR_ADMIN, SUPER_ADMIN)', true, {
            parameters: [{ in: 'body', name: 'body', schema: { type: 'object', properties: { country: { type: 'string', description: 'Optional: seed one country only' } } } }],
          }),
        },
        '/leave/policies': {
          get:  op('Leave Engine', 'List versioned leave policies — ?country & ?status filters (MANAGER+)', true, { parameters: [queryParam('country', 'string', 'ISO-3166 alpha-2 or GLOBAL'), queryParam('status', 'string', 'DRAFT|PUBLISHED|ARCHIVED')] }),
          post: op('Leave Engine', 'Create a DRAFT policy version (HR_ADMIN, SUPER_ADMIN)', true, { responses: { 201: r201 }, parameters: [{ in: 'body', name: 'body', required: true, schema: { type: 'object', additionalProperties: true } }] }),
        },
        '/leave/policies/{id}/new-version': {
          post: op('Leave Engine', 'Clone a policy into a new DRAFT version (HR_ADMIN, SUPER_ADMIN)', true, { parameters: idParam, responses: { 201: r201, 404: r404 } }),
        },
        '/leave/policies/{id}': {
          patch: op('Leave Engine', 'Patch a DRAFT policy — 409 if PUBLISHED (HR_ADMIN, SUPER_ADMIN)', true, { parameters: idParam, responses: { 200: r200, 404: r404, 409: r409 } }),
        },
        '/leave/policies/{id}/publish': {
          post: op('Leave Engine', 'Publish a DRAFT (archives prior PUBLISHED for that country) — 409 if not DRAFT', true, { parameters: idParam, responses: { 200: r200, 409: r409 } }),
        },
        '/leave/assignments': {
          get: op('Leave Engine', 'List leave-policy assignments — ?employeeId filter', true, { parameters: [queryParam('employeeId', 'string', 'Filter to one employee')] }),
        },
        '/leave/assignments/auto-assign': {
          post: op('Leave Engine', 'Auto-assign country policy + post opening grants/accruals, idempotent (HR_ADMIN, SUPER_ADMIN)', true, { parameters: [{ in: 'body', name: 'body', schema: { type: 'object', properties: { employeeIds: { type: 'array', items: { type: 'string' } }, country: { type: 'string' } } } }] }),
        },
        '/leave/ledger': {
          get: op('Leave Engine', 'Append-only ledger entries + folded balance for an employee/leave-type', true, { parameters: [queryParam('employeeId', 'string', 'Defaults to caller; non-privileged forced to self'), queryParam('leaveTypeId', 'string', 'Leave-type CODE (EL/SL/CL/CO/PTO/AL)')] }),
        },
        '/leave/ledger/adjust': {
          post: op('Leave Engine', 'Post a manual ADJUSTMENT ledger entry (HR_ADMIN, SUPER_ADMIN)', true, { parameters: [{ in: 'body', name: 'body', required: true, schema: { type: 'object', required: ['employeeId', 'leaveTypeId', 'delta', 'reason'], properties: { employeeId: { type: 'string' }, leaveTypeId: { type: 'string' }, delta: { type: 'number' }, reason: { type: 'string' } } } }] }),
        },
        '/leave/comp-off/types': {
          get: op('Leave Engine', 'Comp-off-eligible leave types for the current user'),
        },
        '/leave/comp-off/requests': {
          get:  op('Leave Engine', 'List comp-off requests — ?scope=team (managers) else own; ?status filter', true, { parameters: [queryParam('scope', 'string', 'team|mine'), queryParam('status', 'string', 'PENDING|APPROVED|REJECTED')] }),
          post: op('Leave Engine', 'Submit a comp-off-earn request (PENDING)', true, { responses: { 201: r201 }, parameters: [{ in: 'body', name: 'body', required: true, schema: { type: 'object', required: ['leaveTypeId', 'workDate', 'units', 'reason'], properties: { leaveTypeId: { type: 'string' }, workDate: { type: 'string' }, units: { type: 'number' }, reason: { type: 'string' } } } }] }),
        },
        '/leave/comp-off/requests/{id}/approve': {
          post: op('Leave Engine', 'Approve comp-off → posts COMP_OFF_EARNED + sets config-driven expiry (MANAGER+)', true, { parameters: idParam, responses: { 200: r200, 409: r409 } }),
        },
        '/leave/comp-off/requests/{id}/reject': {
          post: op('Leave Engine', 'Reject a comp-off request (MANAGER+)', true, { parameters: idParam, responses: { 200: r200, 409: r409 } }),
        },
        '/leave/encashment': {
          post: op('Leave Engine', 'Encash leave days (config-driven daily rate) — 422 if not allowed (HR_ADMIN, SUPER_ADMIN)', true, { parameters: [{ in: 'body', name: 'body', required: true, schema: { type: 'object', required: ['employeeId', 'leaveTypeCode', 'days'], properties: { employeeId: { type: 'string' }, leaveTypeCode: { type: 'string' }, days: { type: 'number' }, componentsByTag: { type: 'object', additionalProperties: true } } } }], responses: { 200: r200, 422: r422 } }),
        },

        // ── ATTENDANCE (new endpoints) ────────────────────────────────────────
        '/attendance/regularization/{id}/documents': {
          post: op('Attendance', 'Upload supporting doc for a regularization request (PDF/JPG/PNG/DOC/DOCX ≤5 MB)', true, {
            parameters: idParam,
            responses: { 201: { description: 'Uploaded' } },
          }),
        },
        '/attendance/team/weekly': {
          get: op('Attendance', 'Weekly attendance grid — rows=employees, cols=M-F, code=P/A/L/W/H/O (MANAGER+)', true, {
            parameters: [
              { in: 'query', name: 'weekStart',    type: 'string', description: 'YYYY-MM-DD — defaults to current Monday' },
              { in: 'query', name: 'departmentId', type: 'string', description: 'Filter to department' },
            ],
          }),
        },

        // ── RECRUITMENT ──────────────────────────────────────────────────────
        '/recruitment/summary': {
          get: op('Recruitment', 'Recruitment pipeline summary (HR_ADMIN, SUPER_ADMIN, MANAGER)'),
        },
        '/recruitment/openings': {
          get:  op('Recruitment', 'List job openings — paginated, ?status filter', true, { parameters: [...pageQuery, queryParam('status', 'string', 'Open|Closing|On hold|Closed')] }),
          post: op('Recruitment', 'Create a job opening (HR_ADMIN, SUPER_ADMIN)', true, { responses: { 201: r201 } }),
        },
        '/recruitment/openings/{id}': {
          patch: op('Recruitment', 'Update a job opening (HR_ADMIN, SUPER_ADMIN)', true, { parameters: idParam }),
        },
        '/recruitment/candidates': {
          get: op('Recruitment', 'List candidates — paginated, ?openingId, ?stage filters', true, { parameters: [...pageQuery, queryParam('openingId', 'string', 'Filter by opening'), queryParam('stage', 'string', 'Filter by stage')] }),
        },
        '/recruitment/candidates/{id}/advance': {
          post: op('Recruitment', 'Advance candidate to next stage — body: {stage} must be exact next stage. 409 if hired, 422 if invalid/skip', true, {
            parameters: [
              ...idParam,
              { in: 'body', name: 'body', required: true, schema: { type: 'object', required: ['stage'], properties: { stage: { type: 'string', enum: ['screening', 'interview', 'offer', 'hired'] } } } },
            ],
            responses: { 200: r200, 409: { description: 'Already hired' }, 422: { description: 'Invalid or skipped stage' } },
          }),
        },
        '/recruitment/candidates/{id}/rating': {
          patch: op('Recruitment', 'Rate a candidate 1-5 (HR_ADMIN, SUPER_ADMIN, MANAGER)', true, {
            parameters: idParam,
            responses: { 200: r200, 422: { description: 'Rating out of range' }, 404: { description: 'Not found' } },
          }),
        },
        '/recruitment/recruiters': {
          get: op('Recruitment', 'List HR recruiters for this tenant (HR_ADMIN users with employee profiles)'),
        },

        // ── PERFORMANCE ──────────────────────────────────────────────────────
        '/performance/cycles/active': {
          get: op('Performance', 'Get the active performance cycle — returns null if none'),
        },
        '/performance/summary': {
          get: op('Performance', 'Performance overview stats (reviewsComplete, goalsOnTrackPct, avgRating, etc.)'),
        },
        '/performance/reviews': {
          get: op('Performance', 'List performance reviews — paginated, ?status filter (Not started|Self review|Manager review|Calibrated)', true, { parameters: [...pageQuery, queryParam('status', 'string', 'Not started|Self review|Manager review|Calibrated')] }),
        },
        '/performance/goals': {
          get:  op('Performance', 'List performance goals — paginated, ?status filter (On track|At risk|Done)', true, { parameters: [...pageQuery, queryParam('status', 'string', 'On track|At risk|Done')] }),
          post: op('Performance', 'Create a performance goal', true, { responses: { 201: r201 } }),
        },
        '/performance/calibration': {
          get: op('Performance', 'Rating distribution for calibration view (HR_ADMIN, SUPER_ADMIN)'),
        },
        '/performance/employees': {
          get: op('Performance', 'List employees for performance assignment'),
        },
        '/performance/reviews/{employeeId}': {
          patch: op('Performance', 'Set rating for a review — sets status=Calibrated, 409 if already calibrated', true, {
            parameters: [pathParam('employeeId', 'Employee ID')],
            responses: { 200: r200, 404: { description: 'Review not found' }, 409: { description: 'Already calibrated' } },
          }),
        },

        // ── ASSETS ───────────────────────────────────────────────────────────
        '/assets/summary': {
          get: op('Assets', 'Asset inventory summary (totalAssets, assigned, available, inRepair, utilizationPct)'),
        },
        '/assets': {
          get:  op('Assets', 'List assets — paginated, ?type, ?status filters', true, { parameters: [...pageQuery, queryParam('type', 'string', 'Laptop|Monitor|Phone|Other'), queryParam('status', 'string', 'Assigned|Available|Repair|Retired')] }),
          post: op('Assets', 'Add a new asset — status=Assigned if assignedTo provided (HR_ADMIN)', true, { responses: { 201: r201, 409: { description: 'Duplicate tag' } } }),
        },
        '/assets/requests': {
          get: op('Assets', 'List asset requests — paginated, ?status filter (Pending|Approved|Fulfilled|Declined)', true, { parameters: [...pageQuery, queryParam('status', 'string', 'Pending|Approved|Fulfilled|Declined')] }),
        },
        '/assets/requests/{id}/approve': {
          patch: op('Assets', 'Approve asset request — 409 if not Pending (HR_ADMIN)', true, { parameters: idParam }),
        },
        '/assets/requests/{id}/decline': {
          patch: op('Assets', 'Decline asset request — 409 if not Pending, optional reason (HR_ADMIN)', true, { parameters: idParam }),
        },
        '/assets/employees': {
          get: op('Assets', 'List employees for asset assignment dropdown'),
        },
        '/assets/{id}/status': {
          patch: op('Assets', 'Change asset status to Available|Repair|Retired — clears assignedTo (HR_ADMIN)', true, { parameters: idParam }),
        },
        '/assets/{id}/assign': {
          patch: op('Assets', 'Assign asset to employee — sets status=Assigned, 409 if Retired (HR_ADMIN)', true, { parameters: idParam }),
        },
        '/assets/{id}/recall': {
          patch: op('Assets', 'Recall asset — sets status=Available, clears assignedTo (HR_ADMIN)', true, { parameters: idParam }),
        },

        // ── ANNOUNCEMENTS ─────────────────────────────────────────────────────
        '/announcements': {
          get:  op('Announcements', 'List announcements feed — pinned item + feed array, ?channelId filter', true, { parameters: [...pageQuery, queryParam('channelId', 'string', 'Filter by channel')] }),
          post: op('Announcements', 'Post an announcement — 403 if EMPLOYEE role (HR_ADMIN, MANAGER)', true, { responses: { 201: r201, 403: r403 } }),
        },
        '/announcements/channels': {
          get: op('Announcements', 'List announcement channels'),
        },
        '/announcements/events': {
          get:  op('Announcements', 'List upcoming events'),
          post: op('Announcements', 'Create an event (HR_ADMIN, SUPER_ADMIN only)', true, { responses: { 201: r201 } }),
        },
        '/announcements/{id}/pin': {
          patch: op('Announcements', 'Pin announcement — demotes any existing pinned one (HR_ADMIN)', true, { parameters: idParam }),
        },
        '/announcements/{id}/unpin': {
          patch: op('Announcements', 'Unpin announcement — 409 if not currently pinned (HR_ADMIN)', true, {
            parameters: idParam,
            responses: { 200: r200, 409: { description: 'Not pinned' } },
          }),
        },

        // ── HEALTH ───────────────────────────────────────────────────────────
        '/health': {
          get: { tags: ['Health'], summary: 'Server health check', responses: { 200: r200 } },
        },
      },

      // ── SHARED DEFINITIONS ─────────────────────────────────────────────────
      definitions: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'superadmin@acme.test' },
            password: { type: 'string', format: 'password', example: 'Password123!' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                accessToken:  { type: 'string', example: 'eyJhbGc...' },
                sessionId:    { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' }, email: { type: 'string' }, memberType: { type: 'string' },
                  },
                },
                permissions: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code:    { type: 'string', example: 'INVALID_CREDENTIALS' },
                message: { type: 'string', example: 'Invalid email or password' },
                details: { type: 'object' },
              },
            },
            requestId: { type: 'string' },
          },
        },
        // ── PHASE 3 — TIMESHEETS ─────────────────────────────────────────────
        TimesheetEntry: {
          type: 'object',
          properties: {
            id:          { type: 'string' },
            timesheetId: { type: 'string' },
            employeeId:  { type: 'string' },
            projectId:   { type: 'string' },
            taskId:      { type: 'string' },
            date:        { type: 'string', format: 'date' },
            hours:       { type: 'number' },
            billable:    { type: 'boolean' },
            note:        { type: 'string' },
            source:      { type: 'string', enum: ['MANUAL', 'TIMER'] },
          },
        },
        Timesheet: {
          type: 'object',
          properties: {
            id:            { type: 'string' },
            employeeId:    { type: 'string' },
            employeeName:  { type: 'string', description: 'Full name enriched from Employee table — present in all GET /timesheets and GET /timesheets/approvals responses' },
            weekStart:     { type: 'string', format: 'date' },
            weekEnd:       { type: 'string', format: 'date' },
            status:        { type: 'string', enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] },
            totalHours:    { type: 'number' },
            billableHours: { type: 'number' },
            overtimeHours: { type: 'number' },
            standardHours: { type: 'number' },
            submittedAt:   { type: 'string', format: 'date-time' },
            decidedBy:     { type: 'string' },
            decidedAt:     { type: 'string', format: 'date-time' },
            comment:       { type: 'string' },
            entries:       { type: 'array', items: { '$ref': '#/definitions/TimesheetEntry' } },
          },
        },
        TimesheetSummaryByEmployee: {
          type: 'object',
          properties: {
            employeeId:     { type: 'string' },
            employeeName:   { type: 'string' },
            hours:          { type: 'number', description: 'Total hours in range' },
            billableHours:  { type: 'number' },
            utilizationPct: { type: 'integer', description: 'billableHours / hours * 100' },
          },
        },
        TimesheetSummaryByProject: {
          type: 'object',
          properties: {
            projectId:     { type: 'string' },
            projectName:   { type: 'string' },
            hours:         { type: 'number' },
            billableHours: { type: 'number' },
          },
        },
        TimesheetSummary: {
          type: 'object',
          description: 'Response for GET /timesheets/summary',
          properties: {
            totalHours:       { type: 'number' },
            billableHours:    { type: 'number' },
            nonBillableHours: { type: 'number' },
            utilizationPct:   { type: 'integer' },
            byProject:        { type: 'array', items: { '$ref': '#/definitions/TimesheetSummaryByProject' } },
            byEmployee:       { type: 'array', items: { '$ref': '#/definitions/TimesheetSummaryByEmployee' }, description: 'Non-empty when time entries exist in the range. Used by Utilization Report.' },
          },
        },
        // ── PHASE 3 — PAYROLL REGISTER ────────────────────────────────────────
        PayrollComponent: {
          type: 'object',
          description: 'Salary component definition',
          properties: {
            id:              { type: 'string' },
            name:            { type: 'string' },
            code:            { type: 'string' },
            type:            { type: 'string', enum: ['EARNING', 'DEDUCTION', 'BENEFIT', 'REIMBURSEMENT', 'EMPLOYER_CONTRIBUTION', 'VARIABLE'] },
            calculationType: { type: 'string', enum: ['FLAT', 'PERCENTAGE', 'FORMULA'] },
            value:           { type: 'number' },
            basisCode:       { type: 'string' },
            formula:         { type: 'string' },
            taxable:         { type: 'boolean' },
            active:          { type: 'boolean' },
            displayOrder:    { type: 'integer' },
            description:     { type: 'string' },
            statutoryTag:    { type: 'string', description: 'e.g. PF_EMPLOYEE, ESI, TDS — maps component to statutory deduction bucket' },
            prorate:         { type: 'boolean', description: 'Pro-rate for mid-month joiners/exits (default true)' },
            payInPeriods:    { type: 'string', description: 'JSON-encoded number[] — months to pay (null = all). e.g. "[3,6,9,12]" for quarterly.' },
            glAccountCode:   { type: 'string', description: 'GL ledger account code for accounting integration' },
            costCenterRule:  { type: 'string', enum: ['DEPARTMENT', 'NONE'], description: 'DEPARTMENT allocates cost to employee dept. NONE uses default center.' },
          },
        },
        SalaryRegisterRow: {
          type: 'object',
          description: 'Row in SALARY register type. Includes department and employerCost.',
          properties: {
            employeeCode:    { type: 'string' },
            employeeName:    { type: 'string' },
            department:      { type: 'string', description: 'Employee department name' },
            grossEarnings:   { type: 'number' },
            totalDeductions: { type: 'number' },
            netPay:          { type: 'number' },
            employerCost:    { type: 'number', description: 'grossEarnings + sum(employerContributions) from statutory engine' },
          },
        },
        StatutoryRegisterRow: {
          type: 'object',
          description: 'Row in STATUTORY register type',
          properties: {
            employeeCode:    { type: 'string' },
            employeeName:    { type: 'string' },
            grossEarnings:   { type: 'number' },
            pfEmployee:      { type: 'number', description: 'PF_EMPLOYEE component amount' },
            pfEmployer:      { type: 'number', description: 'PF_EMPLOYER component amount' },
            totalDeductions: { type: 'number' },
            netPay:          { type: 'number' },
          },
        },
        BankAdviceRow: {
          type: 'object',
          description: 'Row in BANK_ADVICE register type',
          properties: {
            employeeCode:  { type: 'string' },
            employeeName:  { type: 'string' },
            bankName:      { type: 'string' },
            accountNumber: { type: 'string' },
            netPay:        { type: 'number' },
          },
        },
        VarianceRow: {
          type: 'object',
          description: 'Row in VARIANCE register type — compares current vs previous period net pay',
          properties: {
            employeeCode: { type: 'string' },
            employeeName: { type: 'string' },
            previousNet:  { type: 'number' },
            currentNet:   { type: 'number' },
            variance:     { type: 'number', description: 'currentNet - previousNet' },
          },
        },
        PayrollRegister: {
          type: 'object',
          description: 'Response for GET /payroll/runs/:id/register',
          properties: {
            register:         { type: 'string', enum: ['SALARY', 'STATUTORY', 'BANK_ADVICE', 'VARIANCE'] },
            runId:            { type: 'string' },
            period:           { type: 'string', example: '2026-05' },
            periodLabel:      { type: 'string', example: 'May 2026' },
            currency:         { type: 'string', example: 'INR' },
            columns:          { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, label: { type: 'string' }, align: { type: 'string' }, kind: { type: 'string' } } } },
            rows:             { type: 'array', description: 'Shape varies by type. SALARY rows include department + employerCost.', items: { type: 'object', additionalProperties: true } },
            summary:          { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } } } },
            totalEmployerCost:{ type: 'number', description: 'Sum of all employerCost values — SALARY register only' },
          },
        },
        PayslipLine: {
          type: 'object',
          description: 'Single earnings/deduction/employer line on a payslip',
          properties: {
            code:          { type: 'string', example: 'BASIC' },
            name:          { type: 'string', example: 'Basic Salary' },
            type:          { type: 'string', enum: ['EARNING', 'DEDUCTION', 'BENEFIT', 'EMPLOYER_CONTRIBUTION'] },
            amount:        { type: 'number', description: 'UI reads this field' },
            monthlyAmount: { type: 'number', description: 'Back-compat alias of amount' },
            taxable:       { type: 'boolean' },
          },
        },
        PayslipYtd: {
          type: 'object',
          properties: {
            fiscalYear:      { type: 'string', example: '2026-27' },
            monthsElapsed:   { type: 'integer' },
            grossEarnings:   { type: 'number' },
            taxableIncome:   { type: 'number' },
            taxDeducted:     { type: 'number' },
            totalDeductions: { type: 'number' },
            netPay:          { type: 'number' },
            contributions:   { type: 'object', additionalProperties: { type: 'number' } },
          },
        },
        PayslipListItem: {
          type: 'object',
          description: 'Row in GET /payroll/runs/:runId/payslips',
          properties: {
            id: { type: 'string' }, employeeId: { type: 'string' }, employeeCode: { type: 'string' },
            employeeName: { type: 'string' }, departmentName: { type: 'string' }, designation: { type: 'string' },
            currency: { type: 'string' }, grossEarnings: { type: 'number' }, totalDeductions: { type: 'number' },
            netPay: { type: 'number' }, workingDays: { type: 'integer' }, presentDays: { type: 'integer' },
            lopDays: { type: 'integer' }, status: { type: 'string' }, hasAdjustments: { type: 'boolean' },
          },
        },
        PayslipDetail: {
          type: 'object',
          description: 'Full payslip for drawer/detail view — GET /payroll/runs/:runId/payslips/:payslipId',
          properties: {
            id: { type: 'string' }, period: { type: 'string' }, periodLabel: { type: 'string' }, currency: { type: 'string' },
            employee: { type: 'object', properties: { id: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' }, employeeCode: { type: 'string' }, designation: { type: 'string' }, departmentName: { type: 'string' }, panNumber: { type: 'string' } } },
            company: { type: 'object', properties: { name: { type: 'string' }, address: { type: 'string' }, logoUrl: { type: 'string' } } },
            earnings: { type: 'array', items: { '$ref': '#/definitions/PayslipLine' } },
            deductions: { type: 'array', items: { '$ref': '#/definitions/PayslipLine' } },
            employerContributions: { type: 'array', items: { '$ref': '#/definitions/PayslipLine' }, description: 'Employer statutory lines sourced ONLY from the resolved country pack contribution schemes. A pack with no schemes returns [] (no India PF_ER/ESI_ER defaults).' },
            oneTimeAdditions: { type: 'array', items: { type: 'object' } },
            oneTimeDeductions: { type: 'array', items: { type: 'object' } },
            grossEarnings: { type: 'number' }, totalDeductions: { type: 'number' }, netPay: { type: 'number' },
            employerCost: { type: 'number', description: 'grossEarnings + employer statutory contributions' },
            workingDays: { type: 'integer' }, presentDays: { type: 'integer' }, leaveDays: { type: 'integer' }, lopDays: { type: 'integer' },
            status: { type: 'string' }, paymentDate: { type: 'string', format: 'date' }, paymentReference: { type: 'string' },
            payrollRunId: { type: 'string' }, documentUrl: { type: 'string', nullable: true },
            generatedAt: { type: 'string', format: 'date-time' },
            ytd: { '$ref': '#/definitions/PayslipYtd' },
          },
        },
        PayrollRunSummary: {
          type: 'object',
          properties: {
            id: { type: 'string' }, period: { type: 'string', description: 'YYYY-MM | YYYY-MM-H1 | YYYY-MM-H2 | YYYY-Wnn' },
            periodLabel: { type: 'string' },
            startDate: { type: 'string', format: 'date', nullable: true, description: 'Cycle start (null for legacy monthly runs)' },
            endDate: { type: 'string', format: 'date', nullable: true, description: 'Cycle end' },
            payDate: { type: 'string', format: 'date', nullable: true, description: 'Scheduled pay date' },
            paySchedule: { type: 'string', enum: ['MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'], nullable: true },
            type: { type: 'string' }, status: { type: 'string' }, employeeCount: { type: 'integer' },
            totalGross: { type: 'number' }, totalDeductions: { type: 'number' }, totalNet: { type: 'number' },
            employerCost: { type: 'number' }, currency: { type: 'string', description: 'Run-header display currency. ISO 4217 for single-currency runs; the non-ISO sentinel "MULTI" when the run spans multiple pay-group currencies. Per-payslip currency is always a real ISO code. Do NOT pass "MULTI" to Intl.NumberFormat({style:"currency"}).' },
            published: { type: 'boolean' }, publishedAt: { type: 'string', format: 'date-time' },
          },
        },
        PayCalendarCycle: {
          type: 'object',
          description: 'Computed cycle from GET /payroll/pay-calendars/:id/cycles (no stored table)',
          properties: {
            period: { type: 'string' }, periodLabel: { type: 'string' },
            startDate: { type: 'string', format: 'date' }, endDate: { type: 'string', format: 'date' },
            payDate: { type: 'string', format: 'date' }, cutoffDate: { type: 'string', format: 'date' },
            paySchedule: { type: 'string', enum: ['MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
          },
        },
        PayCalendarCyclesResponse: {
          type: 'object',
          properties: {
            payCalendarId: { type: 'string' },
            paySchedule: { type: 'string', enum: ['MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
            cycles: { type: 'array', items: { '$ref': '#/definitions/PayCalendarCycle' } },
          },
        },
        PayCalendar: {
          type: 'object',
          description: 'GET/POST/PATCH /payroll/pay-calendars',
          properties: {
            id: { type: 'string' }, name: { type: 'string' }, legalEntityId: { type: 'string', nullable: true },
            frequency: { type: 'string', enum: ['MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
            periodAnchor: { type: 'integer', minimum: 1, maximum: 28, description: 'Day-of-month period starts (1–28)' },
            payDateRule: { type: 'string' }, payDay: { type: 'integer' }, cutoffDay: { type: 'integer' },
            holidayCalendarId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PayCalendarCreateRequest: {
          type: 'object',
          required: ['name', 'code'],
          properties: {
            name: { type: 'string' }, code: { type: 'string' }, country: { type: 'string' },
            frequency: { type: 'string', enum: ['MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
            periodAnchor: { type: 'integer', minimum: 1, maximum: 28 },
            payDateRule: { type: 'string' }, payDay: { type: 'integer' }, cutoffDay: { type: 'integer' },
            legalEntityId: { type: 'string', nullable: true }, holidayCalendarId: { type: 'string', nullable: true },
          },
        },
        PayCalendarUpdateRequest: {
          type: 'object',
          properties: {
            name: { type: 'string' }, frequency: { type: 'string', enum: ['MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
            periodAnchor: { type: 'integer', minimum: 1, maximum: 28 },
            payDateRule: { type: 'string' }, payDay: { type: 'integer' }, cutoffDay: { type: 'integer' },
            legalEntityId: { type: 'string', nullable: true }, holidayCalendarId: { type: 'string', nullable: true },
          },
        },
        PaymentBatchLine: {
          type: 'object',
          properties: {
            payslipId: { type: 'string' }, employeeId: { type: 'string' }, employeeCode: { type: 'string' },
            employeeName: { type: 'string' }, amount: { type: 'number' }, currency: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'RETURNED'] },
            failureReason: { type: 'string' }, payoutRef: { type: 'string' },
          },
        },
        PaymentBatch: {
          type: 'object',
          description: 'GET /payroll/runs/:id/payment-batch — returns empty shell when no batch exists',
          properties: {
            id: { type: 'string', nullable: true }, runId: { type: 'string' }, count: { type: 'integer' },
            totalAmount: { type: 'number' }, currency: { type: 'string' }, status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' }, reconciledAt: { type: 'string', format: 'date-time' },
            lines: { type: 'array', items: { '$ref': '#/definitions/PaymentBatchLine' } },
          },
        },
        JournalLine: {
          type: 'object',
          properties: {
            account: { type: 'string' }, costCenter: { type: 'string' },
            debit: { type: 'number' }, credit: { type: 'number' }, currency: { type: 'string' },
          },
        },
        AccountingJournal: {
          type: 'object',
          description: 'GET /payroll/runs/:id/journal — UI reads lines[]',
          properties: {
            runId: { type: 'string' }, period: { type: 'string' }, currency: { type: 'string' },
            lines: { type: 'array', items: { '$ref': '#/definitions/JournalLine' } },
            totalDebit: { type: 'number' }, totalCredit: { type: 'number' },
            balanced: { type: 'boolean' }, generatedAt: { type: 'string', format: 'date-time' },
          },
        },
        PayrollEvent: {
          type: 'object',
          properties: {
            id: { type: 'string' }, type: { type: 'string' }, runId: { type: 'string' },
            summary: { type: 'string' }, createdAt: { type: 'string', format: 'date-time' },
          },
        },
        StatutoryReturn: {
          type: 'object',
          properties: {
            runId: { type: 'string' }, period: { type: 'string' }, type: { type: 'string' },
            rows: { type: 'array', items: { type: 'object' } }, generatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AuditPack: {
          type: 'object',
          properties: {
            run: { type: 'object' }, configPin: { type: 'object' },
            approvalChain: { type: 'array', items: { type: 'object' } },
            auditLog: { type: 'array', items: { type: 'object' } },
            generatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' }, message: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
                requestId: { type: 'string' },
              },
            },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string' }, action: { type: 'string' }, entityType: { type: 'string' },
            entityId: { type: 'string' }, actorUserId: { type: 'string' },
            oldValuesJson: { type: 'object' }, newValuesJson: { type: 'object' },
            ipAddress: { type: 'string' }, userAgent: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        DepartmentInput: {
          type: 'object',
          required: ['name'],
          properties: {
            name:           { type: 'string', example: 'Backend Engineering' },
            departmentCode: { type: 'string', example: 'ENG-BE' },
            parentId:       { type: 'string', description: 'Parent department ID (null/omit for top-level)', example: 'cmpo9988d000yxf8l5v0onjc6' },
            headEmployeeId: { type: 'string', description: 'Employee ID of the department head. Pass null to clear. Must belong to this tenant and not already head another department.', example: 'cmpo99i9o001gxf8ln1rh63oy' },
          },
        },
        DepartmentResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' }, tenantId: { type: 'string' }, parentId: { type: 'string' },
                name: { type: 'string', example: 'Backend Engineering' },
                departmentCode: { type: 'string', example: 'ENG-BE' },
                headEmployeeId: { type: 'string', example: 'cmpo99i9o001gxf8ln1rh63oy' },
                headEmployee: {
                  type: 'object',
                  properties: { id: { type: 'string' }, firstName: { type: 'string', example: 'Priya' }, lastName: { type: 'string', example: 'Sharma' } },
                },
                headEmployeeFirstName: { type: 'string', example: 'Priya' },
                headEmployeeLastName:  { type: 'string', example: 'Sharma' },
                headEmployeeName:      { type: 'string', example: 'Priya Sharma' },
                depth: { type: 'integer' },
                parent: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } },
                _count: { type: 'object', properties: { employees: { type: 'integer' } } },
              },
            },
            meta: { type: 'object', properties: { cached: { type: 'boolean', example: false } } },
          },
        },
        PayslipTemplateSection: {
          type: 'object',
          properties: {
            key: { type: 'string' }, label: { type: 'string' }, enabled: { type: 'boolean' },
            order: { type: 'integer' }, color: { type: 'string', example: '#16a34a' },
          },
        },
        PayslipTemplate: {
          type: 'object',
          properties: {
            id: { type: 'string' }, name: { type: 'string' }, locale: { type: 'string' }, logoUrl: { type: 'string', nullable: true },
            sections: { type: 'array', items: { '$ref': '#/definitions/PayslipTemplateSection' } },
            fields: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, label: { type: 'string' }, enabled: { type: 'boolean' } } } },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        EmailIntegrationSettings: {
          type: 'object',
          properties: {
            provider: { type: 'string', example: 'resend' }, configured: { type: 'boolean' }, enabled: { type: 'boolean' },
            fromAddress: { type: 'string' }, fromName: { type: 'string' }, domainVerified: { type: 'boolean' },
            apiKeyMasked: { type: 'string', nullable: true },
          },
        },
        StorageIntegrationSettings: {
          type: 'object',
          properties: {
            provider: { type: 'string', example: 'cloudinary' }, configured: { type: 'boolean' }, enabled: { type: 'boolean' },
            cloudName: { type: 'string', nullable: true }, folder: { type: 'string' }, maxFileSizeMb: { type: 'number' },
            metadataStore: { type: 'string', example: 'postgresql' },
          },
        },
        WebhookConfig: {
          type: 'object',
          properties: {
            id: { type: 'string' }, name: { type: 'string' }, url: { type: 'string' },
            events: { type: 'array', items: { type: 'string' } }, enabled: { type: 'boolean' },
            secretMasked: { type: 'string' }, lastTriggeredAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        PendingApproval: {
          type: 'object',
          properties: {
            id: { type: 'string' }, type: { type: 'string', enum: ['leave', 'regularization', 'timesheet', 'asset'] },
            color: { type: 'string' }, title: { type: 'string' }, subtitle: { type: 'string' },
            employeeName: { type: 'string' }, submittedAt: { type: 'string', format: 'date-time' },
          },
        },
        EmployeeActivityItem: {
          type: 'object',
          properties: {
            id: { type: 'string' }, type: { type: 'string' }, action: { type: 'string' },
            description: { type: 'string' }, color: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        PaySchedule: {
          type: 'object',
          properties: {
            id: { type: 'string' }, code: { type: 'string' }, name: { type: 'string' },
            country: { type: 'string' }, paySchedule: { type: 'string', enum: ['MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'] },
            firstPayDate: { type: 'string', format: 'date' }, source: { type: 'string' },
          },
        },
        WebhookEvent: {
          type: 'object',
          properties: {
            type: { type: 'string' }, label: { type: 'string' },
          },
        },
        EmployeeDocument: {
          type: 'object',
          properties: {
            id: { type: 'string' }, employeeId: { type: 'string' }, documentType: { type: 'string' },
            fileName: { type: 'string' }, fileUrl: { type: 'string' }, mimeType: { type: 'string' },
            sizeBytes: { type: 'integer' }, verificationStatus: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        DepartmentTree: {
          type: 'object',
          properties: {
            id: { type: 'string' }, name: { type: 'string' }, depth: { type: 'integer' },
            parentId: { type: 'string', nullable: true }, headEmployeeId: { type: 'string', nullable: true },
            children: { type: 'array', items: { '$ref': '#/definitions/DepartmentTree' } },
          },
        },
        TimesheetProject: {
          type: 'object',
          properties: {
            id: { type: 'string' }, name: { type: 'string' }, code: { type: 'string' },
            status: { type: 'string' }, billable: { type: 'boolean' },
          },
        },
        TimesheetTask: {
          type: 'object',
          properties: {
            id: { type: 'string' }, projectId: { type: 'string' }, name: { type: 'string' },
            status: { type: 'string' },
          },
        },
        TimesheetApproval: {
          type: 'object',
          properties: {
            id: { type: 'string' }, employeeId: { type: 'string' }, employeeName: { type: 'string' },
            weekStart: { type: 'string', format: 'date' }, status: { type: 'string' },
            totalHours: { type: 'number' }, submittedAt: { type: 'string', format: 'date-time' },
          },
        },
        StatutoryPack: {
          type: 'object',
          description: 'Flat statutory pack — GET/POST/PATCH response shape',
          properties: {
            id: { type: 'string' }, country: { type: 'string' }, version: { type: 'string' },
            effectiveFrom: { type: 'string', format: 'date' }, effectiveTo: { type: 'string', format: 'date', nullable: true },
            rounding: { type: 'object', additionalProperties: true }, proration: { type: 'object', additionalProperties: true },
            taxRegimes: { type: 'array', items: { type: 'object' } },
            contributionSchemes: { type: 'array', items: { type: 'object' } },
            localTaxes: { type: 'array', items: { type: 'object' } },
            statutoryComponents: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tenant component codes — always string[] in responses',
            },
            minimumWages: { type: 'array', items: { type: 'object' } },
            gratuity: { type: 'object', nullable: true, additionalProperties: true },
            createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        StatutoryPackCreateRequest: {
          type: 'object',
          required: ['country', 'version', 'effectiveFrom'],
          properties: {
            country: { type: 'string' }, version: { type: 'string' },
            effectiveFrom: { type: 'string' }, effectiveTo: { type: 'string', nullable: true },
            rounding: { type: 'object' }, proration: { type: 'object' },
            taxRegimes: { type: 'array', items: { type: 'object' } },
            contributionSchemes: { type: 'array', items: { type: 'object' } },
            localTaxes: { type: 'array', items: { type: 'object' } },
            statutoryComponents: {
              type: 'array',
              items: { type: 'string' },
              description: 'Component codes; legacy { code } objects accepted on write and normalized to strings',
            },
            minimumWages: { type: 'array', items: { type: 'object' } },
            gratuity: { type: 'object', nullable: true },
          },
        },
        StatutoryPackUpdateRequest: {
          type: 'object',
          additionalProperties: true,
          description: 'Partial flat statutory pack fields',
        },
        PayrollRunType: {
          type: 'string',
          enum: ['REGULAR', 'OFF_CYCLE', 'BONUS', 'ARREARS', 'FNF', 'REVERSAL'],
        },
        FnFParams: {
          type: 'object',
          properties: {
            employeeId: { type: 'string' }, lastWorkingDay: { type: 'string', format: 'date' },
            yearsOfService: { type: 'number' }, leaveBalanceDays: { type: 'number' },
            noticeShortfallDays: { type: 'number' },
          },
        },
        PayrollRunCreateRequest: {
          type: 'object',
          required: ['period'],
          properties: {
            period: { type: 'string', example: '2026-06', description: 'YYYY-MM | YYYY-MM-H1 | YYYY-MM-H2 | YYYY-Wnn' },
            startDate: { type: 'string', format: 'date', description: 'Cycle start. Optional for MONTHLY/SEMI_MONTHLY (derived); REQUIRED for BIWEEKLY.' },
            endDate: { type: 'string', format: 'date', description: 'Cycle end. Optional for MONTHLY/SEMI_MONTHLY (derived); REQUIRED for BIWEEKLY.' },
            payDate: { type: 'string', format: 'date', description: 'Scheduled pay date. Defaults to endDate when omitted.' },
            paySchedule: { type: 'string', enum: ['MONTHLY', 'SEMI_MONTHLY', 'BIWEEKLY', 'WEEKLY'], description: 'Required when period is YYYY-Wnn (weekly vs bi-weekly is otherwise ambiguous).' },
            type: { '$ref': '#/definitions/PayrollRunType' },
            employeeIds: { type: 'array', items: { type: 'string' } },
            fnf: { '$ref': '#/definitions/FnFParams' },
            reversalOfRunId: { type: 'string' },
          },
        },
        CloudinaryStorageSettings: {
          type: 'object',
          properties: {
            provider: { type: 'string', example: 'cloudinary' },
            configured: { type: 'boolean' }, status: { type: 'string' },
            cloudName: { type: 'string' }, config: { type: 'object', additionalProperties: true },
          },
        },
        WebhookTestResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' }, delivered: { type: 'boolean' },
            statusCode: { type: 'integer' }, testedAt: { type: 'string', format: 'date-time' },
          },
        },
        PayrollRunDetail: {
          type: 'object',
          description: 'Payroll run detail including type-specific fields',
          allOf: [{ '$ref': '#/definitions/PayrollRunSummary' }],
          properties: {
            type: { '$ref': '#/definitions/PayrollRunType' },
            employeeIds: { type: 'array', items: { type: 'string' } },
            employeeId: { type: 'string' },
            fnfParams: { '$ref': '#/definitions/FnFParams' },
            reversalOfRunId: { type: 'string' },
            reversalOfPeriodLabel: { type: 'string' },
          },
        },
      },
    },
  });

  await fastify.register(fastifySwaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });
}
