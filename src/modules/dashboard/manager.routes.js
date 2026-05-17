import { authenticate } from '../../middleware/authenticate.js';
import {
  managerDashboardHandler,
  getTeamHandler,
  getTeamAttendanceHandler,
  getPendingApprovalsHandler,
  approveLeaveHandler,
  approveRegularizationHandler,
} from './manager.controller.js';

export async function managerDashboardRoutes(fastify) {
  fastify.addHook('onRequest', authenticate);
  fastify.get(
    '/manager/dashboard',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Get manager dashboard summary',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  managerName: { type: 'string' },
                  teamSize: { type: 'number' },
                  pendingApprovals: { type: 'number' },
                  todayAttendance: { type: 'object' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    managerDashboardHandler,
  );

  fastify.get(
    '/manager/team',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Get manager team members',
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
                    employeeCode: { type: 'string' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    designation: { type: 'string' },
                  },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    getTeamHandler,
  );

  fastify.get(
    '/manager/team/attendance',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Get team attendance summary for date range',
        querystring: {
          type: 'object',
          properties: {
            range: { type: 'string', enum: ['7d', '30d', '90d'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  range: { type: 'string' },
                  series: { type: 'array' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    getTeamAttendanceHandler,
  );

  fastify.get(
    '/manager/approvals',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Get pending leave and regularization requests',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  leaveRequests: { type: 'array' },
                  regularizationRequests: { type: 'array' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    getPendingApprovalsHandler,
  );

  fastify.patch(
    '/manager/leave-requests/:id/decision',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Approve or deny leave request',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['approve', 'deny'] },
            comment: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    approveLeaveHandler,
  );

  fastify.patch(
    '/manager/regularization-requests/:id/decision',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Approve or deny regularization request',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['decision'],
          properties: {
            decision: { type: 'string', enum: ['approve', 'deny'] },
            comment: { type: 'string' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  status: { type: 'string' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    approveRegularizationHandler,
  );
}
