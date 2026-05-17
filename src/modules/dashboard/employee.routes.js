import { authenticate } from '../../middleware/authenticate.js';
import {
  employeeDashboardHandler,
  getTodayHandler,
  checkInHandler,
  checkOutHandler,
  getBalanceHandler,
  getHolidaysHandler,
  getDocumentsHandler,
  getTeamHandler,
} from './employee.controller.js';

export async function employeeDashboardRoutes(fastify) {
  fastify.addHook('onRequest', authenticate);
  fastify.get(
    '/dashboard/employee',
    {
      schema: {
        tags: ['Employee Dashboard'],
        description: 'Get employee dashboard summary',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  employeeName: { type: 'string' },
                  designation: { type: 'string' },
                  department: { type: 'string' },
                  todayAttendance: { type: 'object' },
                  pendingLeaves: { type: 'number' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    employeeDashboardHandler,
  );

  fastify.get(
    '/dashboard/employee/today',
    {
      schema: {
        tags: ['Employee Dashboard'],
        description: 'Get today\'s attendance data',
      },
    },
    getTodayHandler,
  );

  fastify.post(
    '/dashboard/employee/check-in',
    {
      schema: {
        tags: ['Employee Dashboard'],
        description: 'Employee check-in',
      },
    },
    checkInHandler,
  );

  fastify.post(
    '/dashboard/employee/check-out',
    {
      schema: {
        tags: ['Employee Dashboard'],
        description: 'Employee check-out',
      },
    },
    checkOutHandler,
  );

  fastify.get(
    '/dashboard/employee/balance',
    {
      schema: {
        tags: ['Employee Dashboard'],
        description: 'Get leave balance',
      },
    },
    getBalanceHandler,
  );

  fastify.get(
    '/dashboard/employee/holidays',
    {
      schema: {
        tags: ['Employee Dashboard'],
        description: 'Get company holidays',
      },
    },
    getHolidaysHandler,
  );

  fastify.get(
    '/dashboard/employee/documents',
    {
      schema: {
        tags: ['Employee Dashboard'],
        description: 'Get employee documents',
      },
    },
    getDocumentsHandler,
  );

  fastify.get(
    '/dashboard/employee/team',
    {
      schema: {
        tags: ['Employee Dashboard'],
        description: 'Get manager and peers',
      },
    },
    getTeamHandler,
  );
}
