import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../auth/auth.policy.js';
import * as c from './billing.controller.js';

const ok = { 200: { type: 'object', additionalProperties: true } };
const canReadBilling = requirePermission('billing:read');
const T = ['Billing'];

// Billing (Phase 8.4) — mirrors ems-frontend/src/mocks/handlers/billing.ts (read-only).
export default async function billingRoutes(fastify) {
  fastify.get('/billing/subscription', {
    schema: { tags: T, description: 'Current tenant subscription (seat usage enriched live from roster)', security: [{ Bearer: [] }], response: ok },
    onRequest: [authenticate, canReadBilling],
  }, c.getSubscription);

  fastify.get('/billing/plans', {
    schema: { tags: T, description: 'Available billing plan catalog', security: [{ Bearer: [] }], response: ok },
    onRequest: [authenticate, canReadBilling],
  }, c.getPlans);

  fastify.get('/billing/invoices', {
    schema: {
      tags: T, description: 'Paginated invoice history', security: [{ Bearer: [] }],
      querystring: { type: 'object', properties: { page: { type: 'integer', default: 1 }, limit: { type: 'integer', default: 20 } } },
      response: ok,
    },
    onRequest: [authenticate, canReadBilling],
  }, c.getInvoices);

  // BACKEND_CONTRACT_server_side_exports.md §2.5
  fastify.get('/billing/invoices/export', {
    schema: { tags: T, description: 'Export invoice list as CSV', security: [{ Bearer: [] }] },
    onRequest: [authenticate, requirePermission('billing:export')],
  }, c.exportInvoices);
}
