import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as auditLogsController from './auditLogs.controller.js';

export default async function auditLogsRoutes(fastify) {
  fastify.get('/audit-logs', {
    schema: {
      tags: ['Audit Logs'],
      description: 'Get immutable audit trail',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          user_email: { type: 'string', format: 'email' },
          action: { type: 'string' },
          entity: { type: 'string', description: 'Entity type e.g. Employee, LeaveRequest' },
          entityId: { type: 'string', description: 'Entity ID — filter logs for one specific record' },
          from_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          to_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => auditLogsController.getAuditLogs(request, reply));

  fastify.get('/audit-logs/:id', {
    schema: {
      tags: ['Audit Logs'],
      description: 'Get single audit log entry',
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => auditLogsController.getAuditLogById(request, reply));

  fastify.post('/audit-logs/dpia-report', {
    schema: {
      tags: ['Audit Logs'],
      description: 'Data Protection Impact Assessment report',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['from_date', 'to_date'],
        properties: {
          from_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          to_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
        },
      },
    },
    onRequest: [authenticate, authorize(['SUPER_ADMIN', 'AUDITOR'])],
  }, (request, reply) => auditLogsController.generateDPIAReport(request, reply));

  fastify.get('/audit-logs/export', {
    schema: {
      tags: ['Audit Logs'],
      description: 'Export audit logs',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          from_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          to_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          format: { type: 'string', enum: ['json', 'csv'], default: 'json' },
        },
      },
    },
    onRequest: [authenticate, authorize(['SUPER_ADMIN', 'AUDITOR'])],
  }, (request, reply) => auditLogsController.exportAuditLogs(request, reply));
}
