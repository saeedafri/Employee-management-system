import { authenticate, authorize } from '../../middleware/authenticate.js';
import {
  listHolidays,
  getUpcomingHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  importHolidays,
  previewImport,
  commitImport,
} from './holidays.controller.js';

export default async function holidaysRoutes(fastify) {
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
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    listHolidays,
  );

  fastify.get(
    '/holidays/upcoming',
    {
      schema: {
        tags: ['Holidays'],
        description: 'Get upcoming holidays (employee dashboard widget)',
        querystring: { type: 'object', properties: { limit: { type: 'integer', default: 3, minimum: 1, maximum: 10 } } },
        response: { 200: { type: 'object', additionalProperties: true } },
      },
    },
    getUpcomingHolidays,
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
          201: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
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
          200: { type: 'object', additionalProperties: true },
        },
      },
    },
    deleteHoliday,
  );

  fastify.post('/holidays/import', {
    schema: {
      tags: ['Holidays'],
      description: 'Upload a .ics file to import holidays (HR_ADMIN). Returns a jobId for preview/commit flow.',
      consumes: ['multipart/form-data'],
      security: [{ Bearer: [] }],
      response: { 202: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
  }, importHolidays);

  fastify.get('/holidays/import/:jobId/preview', {
    schema: {
      tags: ['Holidays'],
      description: 'Preview candidates from an import job before committing',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['jobId'], properties: { jobId: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
  }, previewImport);

  fastify.post('/holidays/import/:jobId/commit', {
    schema: {
      tags: ['Holidays'],
      description: 'Commit a previewed import job — creates/overwrites holidays in DB',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['jobId'], properties: { jobId: { type: 'string' } } },
      body: { type: 'object', properties: { overwriteExisting: { type: 'boolean', default: false } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
  }, commitImport);
}
