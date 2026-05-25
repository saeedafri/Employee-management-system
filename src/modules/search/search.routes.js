import { authenticate } from '../../middleware/authenticate.js';
import { searchAll } from './search.controller.js';

export default async function searchRoutes(fastify) {
  fastify.get('/search', {
    schema: {
      tags: ['Search'],
      description: 'Global search across employees, departments, leave requests, holidays. Permission-aware.',
      security: [{ Bearer: [] }],
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 1, description: 'Search query' },
          types: { type: 'string', description: 'Comma-separated: employee,department,leave,holiday,settings' },
          limit: { type: 'integer', default: 8, minimum: 1, maximum: 20 },
        },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, searchAll);
}
