import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { config } from '../config/index.js';

const sec = [{ Bearer: [], TenantKey: [] }];
const r200 = { description: 'Success' };
const r201 = { description: 'Created' };
const r400 = { description: 'Bad Request' };
const r401 = { description: 'Unauthorized' };
const r403 = { description: 'Forbidden' };
const r404 = { description: 'Not Found' };
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

**Step 1 — Get a token:**
Click \`POST /auth/login\` → Try it out → Execute with body \`{"email":"admin@testorg.com","password":"password123"}\`

In the response, find \`"accessToken"\` and copy **only the long string value** — it starts with \`eyJ\` and ends before the next \`"\`. Example of what to copy:
\`eyJhbGciOiJIUzI1NiJ9.eyJzdW...ONLY_THIS_PART\`

⚠️ **Do NOT copy the surrounding quotes or any other JSON fields.**

**Step 2 — Authorize:**
Click the **Authorize 🔒** button at the top.
- **Bearer**: paste the token string (just \`eyJ...\`, no extra text)
- **TenantKey**: enter \`test-key-123456789\`
Click Authorize on each → Close.

**Step 3 — Test any endpoint:**
Click any endpoint → Try it out → Execute.

Token lasts **8 hours**. If you get 401, repeat Step 1.`,
        contact: { name: 'API Support', email: 'support@acme.test' },
      },
      host: config.isDevelopment ? `localhost:${config.port}` : 'employee-management-system-2b9q.onrender.com',
      basePath: config.apiPrefix,
      schemes: [config.isDevelopment ? 'http' : 'https'],
      securityDefinitions: {
        Bearer:    { type: 'apiKey', name: 'Authorization', in: 'header', description: 'Paste your JWT token here. Get it from POST /auth/login → data.accessToken. Enter with or without "Bearer " prefix — both work. Token lasts 8 hours.' },
        TenantKey: { type: 'apiKey', name: 'X-Tenant-Key',  in: 'header', description: 'Tenant key for your organisation. Test value: test-key-123456789' },
      },
      paths: {

        // ── AUTHENTICATION ────────────────────────────────────────────────────
        '/auth/login': {
          post: op('Authentication', 'User login', false, {
            responses: { 200: { description: 'Returns accessToken, refreshToken, user, permissions' }, 400: r400 },
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
          get:  op('Holidays', 'List all holidays'),
          post: op('Holidays', 'Create holiday', true, { responses: { 201: r201 } }),
        },
        '/holidays/{id}': {
          patch:  op('Holidays', 'Update holiday', true, { parameters: idParam }),
          delete: op('Holidays', 'Delete holiday', true, { parameters: idParam }),
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

        // ── DASHBOARD ────────────────────────────────────────────────────────
        '/employee/dashboard': {
          get: op('Dashboard', 'Employee personal dashboard'),
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
          get: op('Reports', 'Attendance report'),
        },
        '/reports/leaves': {
          get: op('Reports', 'Leave report'),
        },
        '/reports/payroll': {
          get: op('Reports', 'Payroll report (SUPER_ADMIN only)'),
        },
        '/reports/schedule': {
          post: op('Reports', 'Schedule a recurring report', true, { responses: { 201: r201 } }),
        },
        '/reports/scheduled': {
          get: op('Reports', 'List scheduled reports'),
        },
        '/reports/scheduled/{id}': {
          patch:  op('Reports', 'Update scheduled report', true, { parameters: idParam }),
          delete: op('Reports', 'Delete scheduled report', true, { parameters: idParam }),
        },
        '/reports/export-history': {
          get: op('Reports', 'Export history list'),
        },

        // ── AUDIT LOGS ───────────────────────────────────────────────────────
        '/audit-logs': {
          get: op('Audit Logs', 'List audit logs with filters', true, {
            parameters: [
              { in: 'query', name: 'page',       type: 'number' },
              { in: 'query', name: 'limit',      type: 'number' },
              { in: 'query', name: 'entityType', type: 'string' },
              { in: 'query', name: 'action',     type: 'string' },
            ],
          }),
        },
        '/audit-logs/{id}': {
          get: op('Audit Logs', 'Get audit log by ID', true, { parameters: idParam }),
        },
        '/audit-logs/dpia-report': {
          post: op('Audit Logs', 'Generate GDPR DPIA report'),
        },
        '/audit-logs/export': {
          get: op('Audit Logs', 'Export audit logs'),
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
            email:    { type: 'string', format: 'email', example: 'admin@testorg.com' },
            password: { type: 'string', format: 'password', example: 'password123' },
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
