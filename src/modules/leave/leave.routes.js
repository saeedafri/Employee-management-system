import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as leaveController from './leave.controller.js';

export default async function leaveRoutes(fastify) {
  fastify.get('/leave/types', {
    schema: {
      tags: ['Leave Management'],
      description: 'Get all active leave types for this tenant',
      security: [{ Bearer: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  code: { type: 'string' },
                  annualAllowance: { type: 'integer' },
                  carryForwardAllowed: { type: 'boolean' },
                  isPaid: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.getLeaveTypes(request, reply));

  fastify.post('/leave/requests', {
    schema: {
      tags: ['Leave Management'],
      description: 'Create a new leave request',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['leaveTypeId', 'startDate', 'endDate', 'reason'],
        properties: {
          leaveTypeId: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.createLeaveRequest(request, reply));

  fastify.get('/leave/requests', {
    schema: {
      tags: ['Leave Management'],
      description: 'Get your leave requests with pagination and filters',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN', 'CANCELLED'] },
          leaveTypeId: { type: 'string' },
          fromDate: { type: 'string' },
          toDate: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.getLeaveRequests(request, reply));

  fastify.get('/leave/team/requests', {
    schema: {
      tags: ['Leave Management'],
      description: 'Get your team leave requests (managers only)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 10 },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN', 'CANCELLED'] },
        },
      },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.getTeamLeaveRequests(request, reply));

  fastify.patch('/leave/requests/:id/approve', {
    schema: {
      tags: ['Leave Management'],
      description: 'Approve a leave request (managers only)',
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
          approverComment: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.approveLeaveRequest(request, reply));

  fastify.patch('/leave/requests/:id/reject', {
    schema: {
      tags: ['Leave Management'],
      description: 'Reject a leave request (managers only)',
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
        required: ['approverComment'],
        properties: {
          approverComment: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, authorize(['MANAGER', 'HR_ADMIN'])],
  }, (request, reply) => leaveController.rejectLeaveRequest(request, reply));

  fastify.patch('/leave/requests/:id/withdraw', {
    schema: {
      tags: ['Leave Management'],
      description: 'Withdraw your pending leave request',
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
  }, (request, reply) => leaveController.withdrawLeaveRequest(request, reply));

  fastify.get('/leave/balance', {
    schema: {
      tags: ['Leave Management'],
      description: 'Get your leave balance',
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate],
  }, (request, reply) => leaveController.getLeaveBalance(request, reply));
}
