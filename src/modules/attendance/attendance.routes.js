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
      description: 'Get your attendance records',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          fromDate: { type: 'string', format: 'date-time' },
          toDate: { type: 'string', format: 'date-time' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => attendanceController.getAttendanceRecords(request, reply));

  fastify.get('/attendance/team/records', {
    schema: {
      tags: ['Attendance'],
      description: 'Get your team attendance records (managers only)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          fromDate: { type: 'string', format: 'date-time' },
          toDate: { type: 'string', format: 'date-time' },
        },
      },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => attendanceController.getTeamAttendanceRecords(request, reply));

  fastify.get('/attendance/summary', {
    schema: {
      tags: ['Attendance'],
      description: 'Get attendance summary for a period',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          fromDate: { type: 'string', format: 'date-time' },
          toDate: { type: 'string', format: 'date-time' },
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
        required: ['attendanceDate', 'type', 'reason'],
        properties: {
          attendanceDate: { type: 'string', format: 'date-time' },
          type: { type: 'string', enum: ['LATE', 'MISSED_CHECKOUT', 'EARLY_CHECKOUT'] },
          reason: { type: 'string' },
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
}
