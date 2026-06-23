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
import {
  getHolidayPolicy,
  patchHolidayPolicy,
  getOptionalSelections,
  addOptionalSelection,
  removeOptionalSelection,
} from './holidaysPolicy.controller.js';
import {
  getMyResolvedHolidays,
  getEmployeeResolvedHolidays,
} from './holidayResolved.controller.js';

export default async function holidaysRoutes(fastify) {
  fastify.addHook('onRequest', authenticate);

  // ── Holiday Applicability Engine (HOLIDAY_ENGINE_BACKEND_CONTRACT) ──
  // Fully-resolved per-employee set: country-scoped + observed-shifted + optional/selected
  // metadata. The SAME resolution leave/payroll/attendance consume server-side (§3).
  const resolvedSchema = {
    tags: ['Holidays'],
    querystring: { type: 'object', properties: { year: { type: 'integer' } } },
    security: [{ Bearer: [] }],
    response: { 200: { type: 'object', additionalProperties: true } },
  };
  fastify.get('/me/holidays', {
    schema: { ...resolvedSchema, description: 'Resolved holidays for the logged-in employee (observed/optional metadata). No employee profile → tenant-wide only.' },
  }, getMyResolvedHolidays);
  fastify.get('/employees/:id/holidays', {
    schema: {
      ...resolvedSchema,
      description: 'Resolved holidays for an employee (HR/SUPER_ADMIN, or the employee themselves).',
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, getEmployeeResolvedHolidays);

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
            country: { type: 'string', description: 'Exact location match (back-compat)' },
            countryCode: { type: 'string', description: 'Phase 7.3 — ISO alpha-2; server-side per-country scoping (location matches code/display-name, keeps tenant-wide).' },
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

  // ── Holiday Policy (Phase 7.2) — per-country restricted-limit + observed-rule ──
  fastify.get('/holidays/policy', {
    schema: {
      tags: ['Holidays'],
      description: 'Per-country holiday policies (restricted-limit + observed-rule)',
      security: [{ Bearer: [] }],
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, getHolidayPolicy);

  fastify.patch('/holidays/policy', {
    schema: {
      tags: ['Holidays'],
      description: 'Upsert a country holiday policy (HR_ADMIN / SUPER_ADMIN)',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['countryCode'],
        properties: {
          countryCode: { type: 'string' },
          restrictedLimit: { type: 'integer' },
          observedRule: { type: 'string', enum: ['NONE', 'NEXT_WORKING_DAY', 'NEAREST_WORKING_DAY'] },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])],
  }, patchHolidayPolicy);

  // ── Optional (restricted) holiday selections ──
  fastify.get('/holidays/optional-selections', {
    schema: {
      tags: ['Holidays'],
      description: 'Restricted-holiday ids selected by an employee for a year',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: { employeeId: { type: 'string' }, year: { type: 'integer' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, getOptionalSelections);

  fastify.post('/holidays/optional-selections', {
    schema: {
      tags: ['Holidays'],
      description: 'Select a restricted holiday (validates optional/country/past/limit)',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['holidayId', 'year'],
        properties: { holidayId: { type: 'string' }, year: { type: 'integer' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, addOptionalSelection);

  fastify.delete('/holidays/optional-selections/:holidayId', {
    schema: {
      tags: ['Holidays'],
      description: 'Deselect a restricted holiday (422 if past)',
      security: [{ Bearer: [] }],
      params: { type: 'object', required: ['holidayId'], properties: { holidayId: { type: 'string' } } },
      querystring: { type: 'object', properties: { year: { type: 'integer' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, removeOptionalSelection);
}
