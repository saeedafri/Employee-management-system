import { authenticate } from '../../middleware/authenticate.js';
import * as analyticsController from './analytics.controller.js';

export default async function analyticsRoutes(fastify) {
  fastify.addHook('onRequest', authenticate);

  fastify.get('/analytics/summary', {
    schema: {
      tags: ['Analytics'],
      description: 'Get dashboard summary with employee counts and key metrics',
      querystring: {
        type: 'object',
        properties: {
          departmentId: { type: 'string' },
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
                totalEmployees: { type: 'integer' },
                activeEmployees: { type: 'integer' },
                inactiveEmployees: { type: 'integer' },
                onLeaveToday: { type: 'integer' },
              },
            },
            meta: { type: 'object' },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    },
  }, analyticsController.getSummary);

  fastify.get('/analytics/attendance', {
    schema: {
      tags: ['Analytics'],
      description: 'Get attendance analytics with departmental breakdown',
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          departmentId: { type: 'string' },
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
                period: { type: 'object' },
                totalRecords: { type: 'integer' },
                byDepartment: { type: 'object' },
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
      description: 'Get employee headcount distribution by department',
      querystring: {
        type: 'object',
        properties: {
          excludeInactive: { type: 'string', enum: ['true', 'false'] },
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
                  departmentId: { type: 'string' },
                  departmentName: { type: 'string' },
                  headcount: { type: 'integer' },
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
          action: { type: 'string' },
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
                  action: { type: 'string' },
                  entityType: { type: 'string' },
                  entityId: { type: 'string' },
                  actor: { type: 'string' },
                  timestamp: { type: 'string' },
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
          year: { type: 'string', pattern: '^\\d{4}$' },
          status: { type: 'string', enum: ['PENDING', 'APPROVED', 'DENIED'] },
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
                year: { type: 'integer' },
                totalLeaves: { type: 'integer' },
                byStatus: { type: 'object' },
                byType: { type: 'object' },
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
