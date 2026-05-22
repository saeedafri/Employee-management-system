import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as settingsController from './settings.controller.js';

export default async function settingsRoutes(fastify) {
  fastify.get('/settings/tenant', {
    schema: {
      tags: ['Settings'],
      description: 'Get tenant configuration',
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate],
  }, (request, reply) => settingsController.getTenantConfig(request, reply));

  fastify.patch('/settings/tenant', {
    schema: {
      tags: ['Settings'],
      description: 'Update tenant configuration',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          company_name: { type: 'string', minLength: 1, maxLength: 255 },
          timezone: { type: 'string' },
          working_hours_start: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
          working_hours_end: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
        },
      },
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
}
