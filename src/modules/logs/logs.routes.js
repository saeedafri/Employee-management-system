import * as logsController from './logs.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

export default async function logsRoutes(fastify) {
  fastify.get('/logs', {
    schema: {
      tags: ['Admin - Logs'],
      description: 'List application logs (HR_ADMIN and SUPER_ADMIN only)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          level: { type: 'string' },
          module: { type: 'string' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
      },
    },
    onRequest: [authenticate],
  }, async (request, reply) => logsController.listLogs(request, reply));

  fastify.get('/logs/:id', {
    schema: {
      tags: ['Admin - Logs'],
      description: 'Get specific log entry (HR_ADMIN and SUPER_ADMIN only)',
      security: [{ Bearer: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    onRequest: [authenticate],
  }, async (request, reply) => logsController.getLog(request, reply));

  fastify.get('/logs/export', {
    schema: {
      tags: ['Admin - Logs'],
      description: 'Export logs to CSV or JSON (HR_ADMIN and SUPER_ADMIN only)',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['csv', 'json'] },
        },
      },
    },
    onRequest: [authenticate],
  }, async (request, reply) => logsController.exportLogs(request, reply));

  fastify.get('/logs/stream', {
    schema: {
      tags: ['Admin - Logs'],
      description: 'Stream logs as NDJSON (HR_ADMIN and SUPER_ADMIN only)',
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate],
  }, async (request, reply) => logsController.streamLogs(request, reply));
}
