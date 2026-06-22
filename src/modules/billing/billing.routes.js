import { authenticate, authorize } from '../../middleware/authenticate.js';
import * as c from './billing.controller.js';

const ok = { 200: { type: 'object', additionalProperties: true } };
const ADMIN = ['HR_ADMIN', 'SUPER_ADMIN'];
const T = ['Billing'];

// Billing (Phase 8.4) — mirrors ems-frontend/src/mocks/handlers/billing.ts (read-only).
export default async function billingRoutes(fastify) {
  fastify.get('/billing/subscription', {
    schema: { tags: T, description: 'Current tenant subscription (seat usage enriched live from roster)', security: [{ Bearer: [] }], response: ok },
    onRequest: [authenticate, authorize(ADMIN)],
  }, c.getSubscription);

  fastify.get('/billing/plans', {
    schema: { tags: T, description: 'Available billing plan catalog', security: [{ Bearer: [] }], response: ok },
    onRequest: [authenticate, authorize(ADMIN)],
  }, c.getPlans);

  fastify.get('/billing/invoices', {
    schema: {
      tags: T, description: 'Paginated invoice history', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20 } } },
      response: ok,
    },
    onRequest: [authenticate, authorize(ADMIN)],
  }, c.getInvoices);
}
