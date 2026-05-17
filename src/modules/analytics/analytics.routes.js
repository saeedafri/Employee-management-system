import { authenticate } from '../../middleware/authenticate.js';
import { resolveTenant } from '../../middleware/resolveTenant.js';
import { requireAnalyticsPermission } from './analytics.policy.js';
import * as analyticsController from './analytics.controller.js';

export default async function analyticsRoutes(fastify) {
  fastify.addHook('onRequest', resolveTenant);
  fastify.addHook('onRequest', authenticate);
  fastify.addHook('onRequest', requireAnalyticsPermission);

  fastify.get('/analytics/summary', {
    schema: {
      tags: ['Analytics'],
      description: 'Get HR admin dashboard summary with key metrics',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalEmployees: { type: 'integer' },
                activeToday: { type: 'integer' },
                onLeaveToday: { type: 'integer' },
                openRequests: { type: 'integer' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                cached: { type: 'boolean' },
                generatedAt: { type: 'string' },
              },
            },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    },
  }, analyticsController.getSummary);

  fastify.get('/analytics/attendance', {
    schema: {
      tags: ['Analytics'],
      description: 'Get attendance analytics with date series',
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
                series: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string' },
                      present: { type: 'integer' },
                      absent: { type: 'integer' },
                      leave: { type: 'integer' },
                      wfh: { type: 'integer' },
                      halfDay: { type: 'integer' },
                    },
                  },
                },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    },
  }, analyticsController.getAttendance);

  fastify.get('/analytics/headcount-by-department', {
    schema: {
      tags: ['Analytics'],
      description: 'Get employee headcount by department',
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
                  departmentId: { type: 'string' },
                  departmentName: { type: 'string' },
                  employeeCount: { type: 'integer' },
                  activeCount: { type: 'integer' },
                },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    },
  }, analyticsController.getHeadcountByDepartment);

  fastify.get('/analytics/recent-activity', {
    schema: {
      tags: ['Analytics'],
      description: 'Get recent audit log activities',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string' },
        },
      },
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
                  actorName: { type: 'string' },
                  action: { type: 'string' },
                  entityType: { type: 'string' },
                  entityId: { type: 'string' },
                  resourceLabel: { type: 'string' },
                  createdAt: { type: 'string' },
                  createdAtIstDisplay: { type: 'string' },
                },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    },
  }, analyticsController.getRecentActivity);

  fastify.get('/analytics/leave-summary', {
    schema: {
      tags: ['Analytics'],
      description: 'Get leave usage summary',
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
                pending: { type: 'integer' },
                approved: { type: 'integer' },
                rejected: { type: 'integer' },
                withdrawn: { type: 'integer' },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    },
  }, analyticsController.getLeaveSummary);
}
