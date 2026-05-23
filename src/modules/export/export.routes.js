import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as exportController from './export.controller.js';

export default async function exportRoutes(fastify) {
  fastify.post('/export/employees', {
    schema: {
      tags: ['Export'],
      description: 'Start async employee data export',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['csv', 'excel', 'json'], default: 'csv' },
          department_id: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] },
          include_archived: { type: 'boolean', default: false },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => exportController.exportEmployees(request, reply));

  fastify.post('/export/attendance', {
    schema: {
      tags: ['Export'],
      description: 'Start async attendance export',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['from_date', 'to_date'],
        properties: {
          format: { type: 'string', enum: ['csv', 'excel', 'json'], default: 'csv' },
          from_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          to_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          department_id: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => exportController.exportAttendance(request, reply));

  fastify.post('/export/leave', {
    schema: {
      tags: ['Export'],
      description: 'Start async leave export',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['from_date', 'to_date'],
        properties: {
          format: { type: 'string', enum: ['csv', 'excel', 'json'], default: 'csv' },
          from_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          to_date: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          leave_type: { type: 'string' },
          status: { type: 'string', enum: ['APPROVED', 'REJECTED', 'PENDING', 'WITHDRAWN', 'CANCELLED'] },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => exportController.exportLeave(request, reply));

  fastify.get('/export/:job_id/download', {
    schema: {
      tags: ['Export'],
      description: 'Download completed export or get status',
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['job_id'],
        properties: {
          job_id: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN'])],
  }, (request, reply) => exportController.downloadExport(request, reply));

  fastify.get('/export/list', {
    schema: {
      tags: ['Export'],
      description: 'List exports — any authenticated user sees their own; HR Admins see all',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string', enum: ['QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED'] },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => exportController.listExports(request, reply));
}
