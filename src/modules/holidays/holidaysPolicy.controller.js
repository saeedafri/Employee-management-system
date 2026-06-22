// Holiday policy + optional-selection controllers (Phase 7.2). Wire shapes mirror the FE MSW
// handlers (ems-frontend/src/mocks/handlers/holidays.ts) exactly for MSW-off parity.
import { successResponse, errorResponse } from '../../utils/response.js';
import * as svc from './holidaysPolicy.service.js';

const PRIVILEGED = new Set(['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN']);

function fail(reply, request, error) {
  request.log.error(error);
  if (error.code) {
    return reply.status(error.statusCode || 400).send(
      errorResponse(error.code, error.message, error.details, request.id),
    );
  }
  return reply.code(500).send(errorResponse('INTERNAL_ERROR', error.message, {}, request.id));
}

export async function getHolidayPolicy(request, reply) {
  try {
    const policies = await svc.getPolicies(request.tenant.id);
    return reply.send(successResponse({ policies }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function patchHolidayPolicy(request, reply) {
  try {
    const policies = await svc.upsertPolicy(request.tenant.id, request.body);
    return reply.send(successResponse({ policies }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function getOptionalSelections(request, reply) {
  try {
    const self = request.user.employeeId;
    const requested = request.query?.employeeId;
    const employeeId = requested && PRIVILEGED.has(request.user.memberType) ? requested : self;
    const year = Number(request.query?.year);
    const holidayIds = await svc.getSelectionIds(request.tenant.id, employeeId, year);
    return reply.send(successResponse({ holidayIds }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function addOptionalSelection(request, reply) {
  try {
    const { holidayId } = request.body;
    const year = Number(request.body.year);
    const holidayIds = await svc.addSelection(request.tenant.id, request.user.employeeId, year, holidayId);
    return reply.send(successResponse({ holidayIds }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function removeOptionalSelection(request, reply) {
  try {
    const { holidayId } = request.params;
    const year = Number(request.query?.year);
    const holidayIds = await svc.removeSelection(request.tenant.id, request.user.employeeId, holidayId, year);
    return reply.send(successResponse({ holidayIds }));
  } catch (e) {
    return fail(reply, request, e);
  }
}
