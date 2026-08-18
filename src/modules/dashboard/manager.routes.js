import { authenticate } from '../../middleware/authenticate.js';
import { guardScope } from '../auth/permissionManifest.js';
import { requireMemberType } from '../auth/auth.policy.js';
import {
  managerDashboardHandler,
  getTeamHandler,
  getTeamAttendanceHandler,
  getPendingApprovalsHandler,
  approveLeaveHandler,
  approveRegularizationHandler,
} from './manager.controller.js';

export async function managerDashboardRoutes(fastify) {
  // The memberType check used to sit in all five controllers, where no route-level
  // manifest could see it -- so /manager/* published as "any signed-in user" while
  // the API 403s everyone but a MANAGER. Same rule, same 403 body, declared once.
  guardScope(fastify, [authenticate, requireMemberType(['MANAGER'], 'Only managers can access this')]);
  fastify.get(
    '/manager/dashboard',
    {
      schema: {
        tags: ['Manager Dashboard'],
        description: 'Get manager dashboard summary',
        response: {
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    approveRegularizationHandler,
  );
}
