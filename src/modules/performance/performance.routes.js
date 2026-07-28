import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../auth/auth.policy.js';
import * as controller from './performance.controller.js';

export default async function performanceRoutes(fastify) {
  const canReadPerformance = requirePermission('performance:read');
  const canManagePerformance = requirePermission('performance:manage');

  fastify.get('/performance/cycles/active', {
    schema: {
      tags: ['Performance'],
      summary: 'Get the active performance cycle',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canReadPerformance],
  }, controller.getActiveCycle);

  fastify.get('/performance/summary', {
    schema: {
      tags: ['Performance'],
      summary: 'Performance overview stats',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canReadPerformance],
  }, controller.getSummary);

  fastify.get('/performance/reviews', {
    schema: {
      tags: ['Performance'],
      summary: 'List performance reviews (paginated)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 50 },
          status: { type: 'string' },
          departmentId: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canReadPerformance],
  }, controller.getReviews);

  fastify.get('/performance/goals', {
    schema: {
      tags: ['Performance'],
      summary: 'List performance goals (paginated)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 50 },
          status: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canReadPerformance],
  }, controller.getGoals);

  fastify.get('/performance/calibration', {
    schema: {
      tags: ['Performance'],
      summary: 'Rating distribution for calibration',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canManagePerformance],
  }, controller.getCalibration);

  fastify.get('/performance/employees', {
    schema: {
      tags: ['Performance'],
      summary: 'List employees for performance assignment',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canReadPerformance],
  }, controller.getEmployees);

  fastify.patch('/performance/reviews/:employeeId', {
    schema: {
      tags: ['Performance'],
      summary: 'Update a review (manager calibration)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['employeeId'], properties: { employeeId: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          rating: { type: 'string' },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canReadPerformance],
  }, controller.updateReview);

  fastify.post('/performance/goals', {
    schema: {
      tags: ['Performance'],
      summary: 'Create a performance goal',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['employeeId', 'title', 'dueDate'],
        properties: {
          employeeId: { type: 'string' },
          title: { type: 'string' },
          dueDate: { type: 'string', description: 'YYYY-MM-DD' },
          progressPct: { type: 'integer', minimum: 0, maximum: 100 },
        },
      },
      response: { 201: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, canReadPerformance],
  }, controller.createGoal);

  // BACKEND_CONTRACT_server_side_exports.md §2.3
  fastify.get('/performance/export', {
    schema: {
      tags: ['Performance'],
      summary: 'Export performance reviews or goals as CSV',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['reviews', 'goals'], default: 'reviews' },
          status: { type: 'string' },
          departmentId: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate, requirePermission('performance:export')],
  }, controller.exportPerformance);
}
