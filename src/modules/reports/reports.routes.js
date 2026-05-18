import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as reportsController from './reports.controller.js';

export default async function reportsRoutes(fastify) {
  fastify.get('/reports/attendance', {
    schema: {
      tags: ['Reports'],
      description: 'Get attendance report with aggregates',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          from_date: { type: 'string', format: 'date-time' },
          to_date: { type: 'string', format: 'date-time' },
          department_id: { type: 'string' },
          format: { type: 'string', enum: ['json', 'csv'], default: 'json' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => reportsController.getAttendanceReport(request, reply));

  fastify.get('/reports/leaves', {
    schema: {
      tags: ['Reports'],
      description: 'Get leave summary report',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          from_date: { type: 'string', format: 'date-time' },
          to_date: { type: 'string', format: 'date-time' },
          leave_type: { type: 'string' },
          department_id: { type: 'string' },
          format: { type: 'string', enum: ['json', 'csv'], default: 'json' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => reportsController.getLeavesReport(request, reply));

  fastify.get('/reports/payroll', {
    schema: {
      tags: ['Reports'],
      description: 'Get payroll summary report',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        required: ['month', 'year'],
        properties: {
          month: { type: 'integer', minimum: 1, maximum: 12 },
          year: { type: 'integer', minimum: 2000, maximum: 2100 },
          department_id: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => reportsController.getPayrollReport(request, reply));

  fastify.post('/reports/schedule', {
    schema: {
      tags: ['Reports'],
      description: 'Schedule recurring report',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['report_type', 'frequency', 'email_recipients'],
        properties: {
          report_type: { type: 'string', enum: ['attendance', 'leaves', 'payroll'] },
          frequency: { type: 'string', enum: ['WEEKLY', 'MONTHLY'] },
          email_recipients: {
            type: 'array',
            items: { type: 'string', format: 'email' },
            minItems: 1,
          },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => reportsController.scheduleReport(request, reply));

  fastify.get('/reports/scheduled', {
    schema: {
      tags: ['Reports'],
      description: 'List scheduled reports',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => reportsController.getScheduledReports(request, reply));

  fastify.patch('/reports/scheduled/:id', {
    schema: {
      tags: ['Reports'],
      description: 'Update scheduled report',
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          frequency: { type: 'string', enum: ['WEEKLY', 'MONTHLY'] },
          email_recipients: {
            type: 'array',
            items: { type: 'string', format: 'email' },
          },
          is_active: { type: 'boolean' },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => reportsController.updateScheduledReport(request, reply));

  fastify.delete('/reports/scheduled/:id', {
    schema: {
      tags: ['Reports'],
      description: 'Delete scheduled report',
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => reportsController.deleteScheduledReport(request, reply));

  fastify.get('/reports/export-history', {
    schema: {
      tags: ['Reports'],
      description: 'Get past exports',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string', enum: ['SUCCESS', 'FAILED'] },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => reportsController.getExportHistory(request, reply));
}
