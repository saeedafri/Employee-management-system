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
    '/employee/dashboard',
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
    '/attendance/today',
    {
      schema: {
        tags: ['Attendance'],
        description: 'Get today\'s attendance data',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    getTodayHandler,
  );

  // Note: POST /attendance/check-in and /attendance/check-out are provided by attendance module

  // Note: GET /leave/balance is provided by leave module
  // Note: GET /holidays is provided by holidays module

  fastify.get(
    '/employee/documents',
    {
      schema: {
        tags: ['Employee'],
        description: 'Get employee documents',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'array' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    getDocumentsHandler,
  );

  fastify.get(
    '/employee/team',
    {
      schema: {
        tags: ['Employee'],
        description: 'Get manager and peers',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    getTeamHandler,
  );
}
