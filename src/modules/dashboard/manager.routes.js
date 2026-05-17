import {
  managerDashboardHandler,
  getTeamHandler,
  getTeamAttendanceHandler,
  getPendingApprovalsHandler,
  approveLeaveHandler,
  approveRegularizationHandler,
} from './manager.controller.js';

export async function managerDashboardRoutes(fastify) {
  fastify.get(
    '/dashboard/manager',
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
    '/dashboard/manager/team',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Get manager team members',
        response: {
          200: {
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
        },
      },
    },
    getTeamHandler,
  );

  fastify.get(
    '/dashboard/manager/team-attendance',
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
              range: { type: 'string' },
              series: { type: 'array' },
            },
          },
        },
      },
    },
    getTeamAttendanceHandler,
  );

  fastify.get(
    '/dashboard/manager/pending-approvals',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Get pending leave and regularization requests',
        response: {
          200: {
            type: 'object',
            properties: {
              leaveRequests: { type: 'array' },
              regularizationRequests: { type: 'array' },
            },
          },
        },
      },
    },
    getPendingApprovalsHandler,
  );

  fastify.post(
    '/dashboard/manager/approve-leave',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Approve or deny leave request',
        body: {
          type: 'object',
          required: ['leaveRequestId', 'decision'],
          properties: {
            leaveRequestId: { type: 'string' },
            decision: { type: 'string', enum: ['approve', 'deny'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    approveLeaveHandler,
  );

  fastify.post(
    '/dashboard/manager/approve-regularization',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Approve or deny regularization request',
        body: {
          type: 'object',
          required: ['requestId', 'decision'],
          properties: {
            requestId: { type: 'string' },
            decision: { type: 'string', enum: ['approve', 'deny'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
      },
    },
    approveRegularizationHandler,
  );
}
