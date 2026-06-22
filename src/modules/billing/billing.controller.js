// Billing controllers (Phase 8.4). Wire shapes mirror ems-frontend/src/mocks/handlers/billing.ts.
import { successResponse, errorResponse } from '../../utils/response.js';
import * as svc from './billing.service.js';

function fail(reply, request, error) {
  request.log.error(error);
  return reply.code(500).send(errorResponse('INTERNAL_ERROR', error.message, {}, request.id));
}

export async function getSubscription(request, reply) {
  try { return reply.send(successResponse(await svc.getSubscription(request.tenant.id))); }
  catch (e) { return fail(reply, request, e); }
}

export async function getPlans(request, reply) {
  try { return reply.send(successResponse(svc.getPlans())); }
  catch (e) { return fail(reply, request, e); }
}

export async function getInvoices(request, reply) {
  try {
    const page = Number(request.query?.page ?? 1);
    const limit = Number(request.query?.limit ?? 20);
    return reply.send(successResponse(await svc.getInvoices(request.tenant.id, page, limit)));
  } catch (e) { return fail(reply, request, e); }
}
