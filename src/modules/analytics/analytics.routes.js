import { authenticate } from '../../middleware/authenticate.js';
import * as analyticsController from './analytics.controller.js';

const requireAnalyticsRole = (request, reply, done) => {
  const { memberType } = request.user || {};
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType)) {
    reply.code(403).send({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Analytics access restricted to HR admins' },
    });
  } else {
    done();
  }
};

export default async function analyticsRoutes(fastify) {
  // All analytics endpoints require authentication
  fastify.register(async (fastify) => {
    fastify.addHook('onRequest', authenticate);
    fastify.addHook('onRequest', requireAnalyticsRole);

    // Dashboard Summary
    fastify.get('/analytics/dashboard-summary', {
      schema: {
        tags: ['Analytics'],
        description: 'Get dashboard summary with employee counts and department breakdown',
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
                  departmentBreakdown: { type: 'object' },
                  newHiresLast7Days: { type: 'integer' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    }, analyticsController.getDashboardSummary);

    // Attendance Analytics
    fastify.get('/analytics/attendance', {
      schema: {
        tags: ['Analytics'],
        description: 'Get attendance analytics with filters',
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            department: { type: 'string' },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    }, analyticsController.getAttendanceAnalytics);

    // Leave Analytics
    fastify.get('/analytics/leave', {
      schema: {
        tags: ['Analytics'],
        description: 'Get leave analytics with usage and trends',
        querystring: {
          type: 'object',
          properties: {
            year: { type: 'string', pattern: '^\\d{4}$' },
            department: { type: 'string' },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    }, analyticsController.getLeaveAnalytics);

    // Payroll Analytics (SUPER_ADMIN only)
    fastify.get('/analytics/payroll', {
      schema: {
        tags: ['Analytics'],
        description: 'Get payroll analytics with salary distribution (SUPER_ADMIN only)',
        querystring: {
          type: 'object',
          properties: {
            month: { type: 'string', pattern: '^\\d{1,2}$' },
            year: { type: 'string', pattern: '^\\d{4}$' },
          },
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    }, analyticsController.getPayrollAnalytics);

    // Department Analytics
    fastify.get('/analytics/department/:departmentId', {
      schema: {
        tags: ['Analytics'],
        description: 'Get analytics for specific department',
        params: {
          type: 'object',
          properties: {
            departmentId: { type: 'string' },
          },
          required: ['departmentId'],
        },
      },
      rateLimit: { max: 100, timeWindow: '1 minute' },
    }, analyticsController.getDepartmentAnalytics);
  });
}
