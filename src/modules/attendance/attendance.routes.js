import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as attendanceController from './attendance.controller.js';

export default async function attendanceRoutes(fastify) {
  fastify.post('/attendance/check-in', {
    schema: {
      tags: ['Attendance'],
      description: 'Clock in for the day',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          note: { type: 'string' },
          workMode: { type: 'string', enum: ['OFFICE', 'WFH', 'HYBRID'] },
          date: { type: 'string', description: 'Employee-local date YYYY-MM-DD override. Defaults to tenant-local date from tenant timezone.' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.checkIn(request, reply));

  fastify.post('/attendance/check-out', {
    schema: {
      tags: ['Attendance'],
      description: 'Clock out for the day',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        properties: {
          note: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.checkOut(request, reply));

  fastify.get('/attendance/records', {
    schema: {
      tags: ['Attendance'],
      description: 'Get your attendance records. Use ?month=YYYY-MM for a full month, or ?fromDate=&toDate= for a custom range.',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'Filter by month, e.g. 2025-06' },
          fromDate: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          toDate: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          employeeId: { type: 'string', description: 'HR/manager scoped employee filter' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.getAttendanceRecords(request, reply));

  fastify.get('/attendance/team/records', {
    schema: {
      tags: ['Attendance'],
      description: 'Get team attendance records. HR sees tenant records; managers see direct reports. Use ?month=YYYY-MM for a full month.',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'Filter by month, e.g. 2025-06' },
          fromDate: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          toDate: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          employeeId: { type: 'string', description: 'Filter by specific employee ID (HR/Manager only)' },
          departmentId: { type: 'string', description: 'Filter by department ID (HR/Manager only)' },
        },
      },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => attendanceController.getTeamAttendanceRecords(request, reply));

  // BE-1 — per-employee monthly attendance calendar (full month, reconciled buckets).
  // month validated in the service so a bad/missing value returns 422 VALIDATION_ERROR
  // with error.details[] (not Fastify's 400 schema error) per contract §7.
  const calendarSchema = (description, withParams) => ({
    tags: ['Attendance'],
    description,
    security: [{ Bearer: [] }],
    ...(withParams ? { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } : {}),
    querystring: {
      type: 'object',
      properties: {
        month: { type: 'string', description: 'Target month YYYY-MM (required).' },
      },
    },
    response: { 200: { type: 'object', additionalProperties: true } },
  });

  fastify.get('/attendance/calendar', {
    schema: calendarSchema('Your monthly attendance calendar (one entry per day, reconciled bucket + summary + LOP days).', false),
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.getMyAttendanceCalendar(request, reply));

  fastify.get('/employees/:id/attendance/calendar', {
    schema: calendarSchema('Monthly attendance calendar for an employee. MANAGER (their team) · HR_ADMIN/SUPER_ADMIN (anyone).', true),
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.getEmployeeAttendanceCalendar(request, reply));

  fastify.get('/attendance/team/weekly', {
    schema: {
      tags: ['Attendance'],
      description: 'Weekly attendance grid for the team (M-F per employee). Used by manager dashboard.',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          weekStart: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Any date in the target week (YYYY-MM-DD); snapped back to the tenant work-week’s first working day. Defaults to current week.' },
          departmentId: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => attendanceController.getTeamWeekly(request, reply));

  fastify.get('/attendance/summary', {
    schema: {
      tags: ['Attendance'],
      description: 'Get attendance summary for a period',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          toDate: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'Filter by month, e.g. 2025-06' },
          employeeId: { type: 'string', description: 'HR/manager scoped employee filter' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.getAttendanceSummary(request, reply));

  fastify.post('/attendance/regularization', {
    schema: {
      tags: ['Attendance'],
      description: 'Submit an attendance regularization request',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['attendanceDate', 'reason'],
        properties: {
          attendanceDate: { type: 'string', description: 'Date string, YYYY-MM-DD or full ISO' },
          reason: { type: 'string', minLength: 10 },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.submitRegularization(request, reply));

  fastify.get('/attendance/regularization', {
    schema: {
      tags: ['Attendance'],
      description: 'Get your regularization requests',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN'] },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.getRegularizationRequests(request, reply));

  fastify.get('/attendance/team/regularization', {
    schema: {
      tags: ['Attendance'],
      description: 'Get your team regularization requests (managers only)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN'] },
          employeeId: { type: 'string' },
          departmentId: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => attendanceController.getTeamRegularizationRequests(request, reply));

  fastify.patch('/attendance/regularization/:id/approve', {
    schema: {
      tags: ['Attendance'],
      description: 'Approve a regularization request (managers only)',
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
          reviewerComment: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => attendanceController.approveRegularization(request, reply));

  fastify.patch('/attendance/regularization/:id/deny', {
    schema: {
      tags: ['Attendance'],
      description: 'Deny a regularization request (managers only)',
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
        required: ['reviewerComment'],
        properties: {
          reviewerComment: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => attendanceController.denyRegularization(request, reply));

  fastify.post('/attendance/regularization/:id/documents', {
    schema: {
      tags: ['Attendance'],
      description: 'Upload supporting document for a regularization request (PDF/JPG/PNG/DOC/DOCX, max 5 MB)',
      security: [{ Bearer: [] }],
      consumes: ['multipart/form-data'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.uploadRegularizationDocument(request, reply));
}
