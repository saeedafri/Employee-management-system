import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { config } from '../config/index.js';

const sec = [{ Bearer: [], TenantKey: [] }];
const r200 = { description: 'Success' };
const r201 = { description: 'Created' };
const r400 = { description: 'Bad Request' };
const r401 = { description: 'Unauthorized' };
const r403 = { description: 'Forbidden' };
const idParam = [{ in: 'path', name: 'id', type: 'string', required: true, description: 'Resource ID' }];

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
          post: op('Authentication', 'Logout current session'),
        },
        '/auth/logout-all': {
          post: op('Authentication', 'Logout from ALL sessions'),
        },
        '/auth/me': {
          get: op('Authentication', 'Get current user profile'),
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

        // ── EMPLOYEES ────────────────────────────────────────────────────────
        '/employees': {
          get: op('Employees', 'List employees with pagination & filters', true, {
            parameters: [
              { in: 'query', name: 'page',         type: 'number',  description: 'Page number (default 1)' },
              { in: 'query', name: 'limit',        type: 'number',  description: 'Per page (default 20)' },
              { in: 'query', name: 'search',       type: 'string',  description: 'Search by name / email' },
              { in: 'query', name: 'departmentId', type: 'string',  description: 'Filter by department' },
              { in: 'query', name: 'status',       type: 'string',  description: 'ACTIVE | INACTIVE | ON_LEAVE | RESIGNED | TERMINATED' },
              { in: 'query', name: 'location',     type: 'string' },
            ],
          }),
          post: op('Employees', 'Create new employee', true, { responses: { 201: r201, 400: r400 } }),
        },
        '/employees/{id}': {
          get:    op('Employees', 'Get employee by ID',    true, { parameters: idParam }),
          patch:  op('Employees', 'Update employee',       true, { parameters: idParam }),
          delete: op('Employees', 'Delete / terminate employee', true, { parameters: idParam }),
        },
        '/employees/export/csv': {
          get: op('Employees', 'Export employees as CSV'),
        },

        // ── DEPARTMENTS ──────────────────────────────────────────────────────
        '/departments': {
          get:  op('Departments', 'List all departments'),
          post: op('Departments', 'Create department', true, { responses: { 201: r201 } }),
        },
        '/departments/{id}': {
          patch:  op('Departments', 'Update department', true, { parameters: idParam }),
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
          get: op('Analytics', 'Headcount breakdown by department'),
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
          patch: op('Settings', 'Update tenant branding — multipart/form-data with logo field or JSON with logo_url'),
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
        '/departments/{id}/employees': {
          get: op('Departments', 'List employees in a department with pagination', true, {
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
