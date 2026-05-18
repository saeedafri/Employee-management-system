import { authenticate } from '../../middleware/authenticate.js';
import {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} from './holidays.controller.js';

export async function holidaysRoutes(fastify) {
  fastify.addHook('onRequest', authenticate);

  fastify.get(
    '/holidays',
    {
      schema: {
        tags: ['Holidays'],
        description: 'Get holidays for year or date range',
        querystring: {
          type: 'object',
          properties: {
            year: { type: 'number' },
            country: { type: 'string' },
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
                  holidays: { type: 'array' },
                  total: { type: 'number' },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    },
    listHolidays,
  );

  fastify.post(
    '/holidays',
    {
      schema: {
        tags: ['Holidays'],
        description: 'Create holiday (HR_ADMIN only)',
        body: {
          type: 'object',
          required: ['holidayDate', 'name'],
          properties: {
            holidayDate: { type: 'string', format: 'date' },
            name: { type: 'string' },
            location: { type: 'string' },
            isOptional: { type: 'boolean' },
          },
        },
        response: {
          201: {
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
    createHoliday,
  );

  fastify.patch(
    '/holidays/:id',
    {
      schema: {
        tags: ['Holidays'],
        description: 'Update holiday (HR_ADMIN only)',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            holidayDate: { type: 'string', format: 'date' },
            name: { type: 'string' },
            isOptional: { type: 'boolean' },
          },
        },
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
    updateHoliday,
  );

  fastify.delete(
    '/holidays/:id',
    {
      schema: {
        tags: ['Holidays'],
        description: 'Delete holiday (HR_ADMIN only)',
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string' },
          },
        },
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
    deleteHoliday,
  );
}
