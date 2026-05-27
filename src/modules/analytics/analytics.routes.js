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

  fastify.get('/analytics/workforce-trend', {
    schema: {
      tags: ['Analytics'],
      description: 'Monthly workforce trend — headcount, hires, exits, net change',
      querystring: {
        type: 'object',
        properties: { range: { type: 'string', enum: ['6m', '12m', '2y'] } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, analyticsController.getWorkforceTrend);

  fastify.get('/analytics/attrition', {
    schema: {
      tags: ['Analytics'],
      description: 'Attrition rate trend over time',
      querystring: {
        type: 'object',
        properties: { range: { type: 'string', enum: ['6m', '12m', '2y'] } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, analyticsController.getAttrition);

  fastify.get('/analytics/payroll-cost', {
    schema: {
      tags: ['Analytics'],
      description: 'Monthly payroll cost trend (derived from annualCtc when no payroll runs exist)',
      querystring: {
        type: 'object',
        properties: { range: { type: 'string', enum: ['6m', '12m'] } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, analyticsController.getPayrollCost);

  fastify.get('/analytics/department-performance', {
    schema: {
      tags: ['Analytics'],
      description: 'Department performance — attendance rate, leave rate, tenure. MANAGER sees own dept only.',
      querystring: {
        type: 'object',
        properties: { range: { type: 'string', enum: ['30d', '90d'] } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, analyticsController.getDepartmentPerformance);
}
