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
          from_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          to_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
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
          from_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          to_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
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
        required: ['frequency'],
        properties: {
          reportType: { type: 'string', enum: ['attendance', 'leaves', 'payroll'] },
          report_type: { type: 'string', enum: ['attendance', 'leaves', 'payroll'] },
          frequency: { type: 'string', enum: ['WEEKLY', 'MONTHLY'] },
          emailRecipients: { type: 'array', items: { type: 'string', format: 'email' }, minItems: 1 },
          email_recipients: { type: 'array', items: { type: 'string', format: 'email' }, minItems: 1 },
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

  // ── Domain 4 — Phase 2 Reports ─────────────────────────────────────────────

  const adminRoles = ['HR_ADMIN', 'SUPER_ADMIN'];
  const commonQs = {
    type: 'object',
    properties: {
      startDate:    { type: 'string', description: 'YYYY-MM-DD' },
      endDate:      { type: 'string', description: 'YYYY-MM-DD' },
      departmentId: { type: 'string' },
    },
  };

  fastify.get('/reports/workforce/headcount', {
    schema: { tags: ['Reports'], description: 'Headcount over time — monthly headcount, hires, exits per dept', security: [{ Bearer: [] }], querystring: commonQs, response: { 200: { type: 'object', additionalProperties: true } } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getWorkforceHeadcount(req, rep));

  fastify.get('/reports/workforce/turnover', {
    schema: { tags: ['Reports'], description: 'Attrition/turnover — exits over the period', security: [{ Bearer: [] }], querystring: commonQs, response: { 200: { type: 'object', additionalProperties: true } } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getWorkforceTurnover(req, rep));

  fastify.get('/reports/workforce/demographics', {
    schema: {
      tags: ['Reports'], description: 'Breakdown by employment type, gender, department', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { departmentId: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getWorkforceDemographics(req, rep));

  fastify.get('/reports/attendance/summary', {
    schema: {
      tags: ['Reports'], description: 'Monthly attendance summary per employee', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { month: { type: 'string', description: 'YYYY-MM' }, departmentId: { type: 'string' }, page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20 } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getAttendanceSummaryReport(req, rep));

  fastify.get('/reports/attendance/absenteeism', {
    schema: { tags: ['Reports'], description: 'Absenteeism trend — unauthorized absences over time', security: [{ Bearer: [] }], querystring: commonQs, response: { 200: { type: 'object', additionalProperties: true } } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getAttendanceAbsenteeism(req, rep));

  fastify.get('/reports/leave/utilization', {
    schema: {
      tags: ['Reports'], description: 'Leave utilization — how much allocated leave is being used', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { year: { type: 'string' }, departmentId: { type: 'string' }, leaveTypeId: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getLeaveUtilization(req, rep));

  fastify.get('/reports/leave/pending', {
    schema: {
      tags: ['Reports'], description: 'All pending leave requests across the org', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { departmentId: { type: 'string' }, leaveTypeId: { type: 'string' }, page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20 } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getLeavePending(req, rep));

  fastify.get('/reports/payroll/summary', {
    schema: { tags: ['Reports'], description: 'Payroll cost by month and department', security: [{ Bearer: [] }], querystring: commonQs, response: { 200: { type: 'object', additionalProperties: true } } },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getPayrollSummaryReport(req, rep));

  fastify.get('/reports/payroll/ctc-analysis', {
    schema: {
      tags: ['Reports'], description: 'CTC band distribution and salary percentile analysis', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { departmentId: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getPayrollCtcAnalysis(req, rep));

  fastify.post('/reports/export', {
    schema: {
      tags: ['Reports'], description: 'Export a report as CSV — returns jobId; poll GET /reports/export/:jobId/status then download at GET /reports/export/:jobId/download', security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['reportType'],
        properties: {
          reportType: { type: 'string', description: 'e.g. workforce/headcount, attendance/summary, leave/pending, payroll/summary' },
          format: { type: 'string', enum: ['CSV'], default: 'CSV' },
          filters: { type: 'object', additionalProperties: true },
        },
      },
      response: { 202: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.exportReport(req, rep));

  fastify.get('/reports/export/:jobId', {
    schema: {
      tags: ['Reports'], description: 'Get export job status', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['jobId'], properties: { jobId: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getExportJobStatus(req, rep));

  fastify.get('/reports/export/:jobId/status', {
    schema: {
      tags: ['Reports'], description: 'Get export job status (alias)', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['jobId'], properties: { jobId: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.getExportJobStatus(req, rep));

  fastify.get('/reports/export/:jobId/download', {
    schema: {
      tags: ['Reports'], description: 'Download export CSV — returns text/csv when SUCCESS, 202 when PENDING', security: [{ Bearer: [] }],
      params: { type: 'object', required: ['jobId'], properties: { jobId: { type: 'string' } } },
    },
    onRequest: [authenticate, authorize(adminRoles)],
  }, (req, rep) => reportsController.downloadExport(req, rep));
}
