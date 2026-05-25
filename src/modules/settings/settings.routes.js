import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as settingsController from './settings.controller.js';

export default async function settingsRoutes(fastify) {
  fastify.get('/settings/tenant', {
    schema: {
      tags: ['Settings'],
      description: 'Get tenant configuration including company identity fields',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, (request, reply) => settingsController.getTenantConfig(request, reply));

  fastify.patch('/settings/tenant', {
    schema: {
      tags: ['Settings'],
      description: 'Update tenant configuration and company identity fields',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          // Tenant model fields
          legalName: { type: 'string', minLength: 1 },
          displayName: { type: 'string', minLength: 1 },
          country: { type: 'string', minLength: 2 },
          defaultCurrency: { type: 'string', minLength: 3, maxLength: 3 },
          primaryContactEmail: { type: 'string', format: 'email' },
          supportPhone: { type: 'string' },
          logoUrl: { type: 'string' },
          // TenantConfig operational fields
          company_name: { type: 'string', minLength: 1, maxLength: 255 },
          timezone: { type: 'string' },
          working_hours_start: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          working_hours_end: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => settingsController.updateTenantConfig(request, reply));

  fastify.get('/settings/email-templates', {
    schema: {
      tags: ['Settings'],
      description: 'Get email templates',
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => settingsController.getEmailTemplates(request, reply));

  fastify.patch('/settings/email-templates/:type', {
    schema: {
      tags: ['Settings'],
      description: 'Update email template',
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['LEAVE_APPROVAL', 'LEAVE_REJECTION', 'ATTENDANCE_ALERT'] },
        },
      },
      body: {
        type: 'object',
        required: ['subject', 'body'],
        properties: {
          subject: { type: 'string', minLength: 1, maxLength: 255 },
          body: { type: 'string', minLength: 10 },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => settingsController.updateEmailTemplate(request, reply));

  fastify.get('/settings/roles-permissions', {
    schema: {
      tags: ['Settings'],
      description: 'Get role permissions matrix',
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate, authorize(['SUPER_ADMIN'])],
  }, (request, reply) => settingsController.getRolePermissions(request, reply));

  fastify.patch('/settings/roles-permissions', {
    schema: {
      tags: ['Settings'],
      description: 'Update role permissions',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['role', 'permissions'],
        properties: {
          role: { type: 'string', minLength: 1 },
          permissions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    onRequest: [authenticate, authorize(['SUPER_ADMIN'])],
  }, (request, reply) => settingsController.updateRolePermissions(request, reply));


  // ── Branding ─────────────────────────────────────────────────────────────────
  fastify.get('/settings/branding', { schema: { tags: ['Settings'], description: 'Get tenant branding (logo, colors)', security: [{ Bearer: [] }], response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate] }, (req, rep) => settingsController.getBranding(req, rep));
  fastify.patch('/settings/branding', { schema: { tags: ['Settings'], description: 'Update tenant branding', security: [{ Bearer: [] }], body: { type: 'object', properties: { logo_url: { type: 'string' }, primary_color_hex: { type: 'string' } } }, response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])] }, (req, rep) => settingsController.updateBranding(req, rep));

  // ── Attendance rules ──────────────────────────────────────────────────────────
  fastify.get('/settings/attendance-rules', { schema: { tags: ['Settings'], description: 'Get attendance rules', security: [{ Bearer: [] }], response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])] }, (req, rep) => settingsController.getAttendanceRules(req, rep));
  fastify.patch('/settings/attendance-rules', { schema: { tags: ['Settings'], description: 'Update attendance rules', security: [{ Bearer: [] }], body: { type: 'object', additionalProperties: true }, response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])] }, (req, rep) => settingsController.updateAttendanceRules(req, rep));

  // ── Auth / Security settings ─────────────────────────────────────────────────
  fastify.get('/settings/security/auth', { schema: { tags: ['Settings'], description: 'Get auth/security settings', security: [{ Bearer: [] }], response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['SUPER_ADMIN'])] }, (req, rep) => settingsController.getAuthSettings(req, rep));
  fastify.patch('/settings/security/auth', { schema: { tags: ['Settings'], description: 'Update auth/security settings', security: [{ Bearer: [] }], body: { type: 'object', additionalProperties: true }, response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['SUPER_ADMIN'])] }, (req, rep) => settingsController.updateAuthSettings(req, rep));

  // ── Notification preferences (per-user) ───────────────────────────────────────
  fastify.get('/settings/notifications/preferences', { schema: { tags: ['Settings'], description: 'Get caller notification preferences', security: [{ Bearer: [] }], response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate] }, (req, rep) => settingsController.getNotificationPreferences(req, rep));
  fastify.patch('/settings/notifications/preferences', { schema: { tags: ['Settings'], description: 'Update caller notification preferences', security: [{ Bearer: [] }], body: { type: 'object', additionalProperties: true }, response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate] }, (req, rep) => settingsController.updateNotificationPreferences(req, rep));

  // ── Leave types (under /settings — aliases for /leave/types) ─────────────────
  fastify.get('/settings/leave-types', { schema: { tags: ['Settings'], description: 'List leave types (alias for GET /leave/types)', security: [{ Bearer: [] }], response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate] }, (req, rep) => settingsController.getLeaveTypes(req, rep));
  fastify.post('/settings/leave-types', { schema: { tags: ['Settings'], description: 'Create a leave type', security: [{ Bearer: [] }], body: { type: 'object', required: ['name', 'code'], properties: { name: { type: 'string' }, code: { type: 'string' }, annualAllowance: { type: 'integer', default: 0 }, carryForwardAllowed: { type: 'boolean', default: false }, isPaid: { type: 'boolean', default: true }, color: { type: 'string' } } }, response: { 201: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])] }, (req, rep) => settingsController.createLeaveType(req, rep));
  fastify.patch('/settings/leave-types/:id', { schema: { tags: ['Settings'], description: 'Update a leave type', security: [{ Bearer: [] }], params: { type: 'object', properties: { id: { type: 'string' } } }, body: { type: 'object', additionalProperties: true }, response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])] }, (req, rep) => settingsController.updateLeaveType(req, rep));
  fastify.delete('/settings/leave-types/:id', { schema: { tags: ['Settings'], description: 'Delete/deactivate a leave type', security: [{ Bearer: [] }], params: { type: 'object', properties: { id: { type: 'string' } } }, response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])] }, (req, rep) => settingsController.deleteLeaveType(req, rep));

  // ── Custom roles ──────────────────────────────────────────────────────────────
  fastify.post('/settings/roles', { schema: { tags: ['Settings'], description: 'Create a custom tenant role', security: [{ Bearer: [] }], body: { type: 'object', required: ['name', 'key'], properties: { name: { type: 'string' }, key: { type: 'string' }, permissions: { type: 'array', items: { type: 'string' } } } }, response: { 201: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])] }, (req, rep) => settingsController.createRole(req, rep));
  fastify.delete('/settings/roles/:key', { schema: { tags: ['Settings'], description: 'Delete a custom role', security: [{ Bearer: [] }], params: { type: 'object', properties: { key: { type: 'string' } } }, response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])] }, (req, rep) => settingsController.deleteRole(req, rep));
  fastify.post('/settings/roles/:key/users', { schema: { tags: ['Settings'], description: 'Assign users to a custom role', security: [{ Bearer: [] }], params: { type: 'object', properties: { key: { type: 'string' } } }, body: { type: 'object', required: ['userIds'], properties: { userIds: { type: 'array', items: { type: 'string' } } } }, response: { 200: { type: 'object', additionalProperties: true } } }, onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])] }, (req, rep) => settingsController.assignUsersToRole(req, rep));
}
