import { authenticate } from '../../middleware/authenticate.js';
import { requireAnalyticsPermission } from './analytics.policy.js';
import * as analyticsController from './analytics.controller.js';

export default async function analyticsRoutes(fastify) {
  // resolveTenant is already a global hook registered in app.js — do not add again
  fastify.addHook('onRequest', authenticate);
  fastify.addHook('onRequest', requireAnalyticsPermission);

  fastify.get('/analytics/summary', {
    schema: {
      tags: ['Analytics'],
      description: 'Get HR admin dashboard summary with key metrics',
      response: {
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
        },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    },
  }, analyticsController.getAttendance);

  fastify.get('/analytics/headcount-by-department', {
    schema: {
      tags: ['Analytics'],
      description: 'Get employee headcount by department',
      response: {
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
        },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    },
  }, analyticsController.getLeaveSummary);
}
