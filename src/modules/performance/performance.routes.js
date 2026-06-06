import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as controller from './performance.controller.js';

export default async function performanceRoutes(fastify) {
  const HR_MANAGER = ['HR_ADMIN', 'SUPER_ADMIN', 'MANAGER'];
  const HR_ONLY = ['HR_ADMIN', 'SUPER_ADMIN'];

  fastify.get('/performance/cycles/active', {
    schema: {
      tags: ['Performance'],
      summary: 'Get the active performance cycle',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.getActiveCycle);

  fastify.get('/performance/summary', {
    schema: {
      tags: ['Performance'],
      summary: 'Performance overview stats',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
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
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
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
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.getGoals);

  fastify.get('/performance/calibration', {
    schema: {
      tags: ['Performance'],
      summary: 'Rating distribution for calibration',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_ONLY)],
  }, controller.getCalibration);

  fastify.get('/performance/employees', {
    schema: {
      tags: ['Performance'],
      summary: 'List employees for performance assignment',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(HR_MANAGER)],
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
    onRequest: [authenticate, authorize(HR_MANAGER)],
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
    onRequest: [authenticate, authorize(HR_MANAGER)],
  }, controller.createGoal);
}
