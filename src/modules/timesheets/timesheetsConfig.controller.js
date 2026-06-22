// Timesheet workflow-extras controllers (Phase 5.4/5.5). Wire shapes mirror the FE MSW handlers
// (ems-frontend/src/mocks/handlers/timesheets.ts) for MSW-off parity.
import { successResponse, errorResponse } from '../../utils/response.js';
import * as svc from './timesheetsConfig.service.js';

function actor(request) {
  return {
    name: request.user.email || 'Approver',
    userId: request.user.id,
    employeeId: request.user.employeeId,
  };
}

function fail(reply, request, error) {
  request.log.error(error);
  if (error.code) {
    return reply.status(error.statusCode || 400).send(
      errorResponse(error.code, error.message, error.details, request.id),
    );
  }
  return reply.code(500).send(errorResponse('INTERNAL_ERROR', error.message, {}, request.id));
}

// ── Locks ──
export async function getLocks(request, reply) {
  try { return reply.send(successResponse(await svc.getLocks(request.tenant.id))); }
  catch (e) { return fail(reply, request, e); }
}
export async function createLock(request, reply) {
  try {
    const a = actor(request);
    return reply.send(successResponse(await svc.createLock(request.tenant.id, request.body, a.name, a.userId)));
  } catch (e) { return fail(reply, request, e); }
}
export async function deleteLock(request, reply) {
  try { return reply.send(successResponse(await svc.deleteLock(request.tenant.id, request.params.id, request.user.id))); }
  catch (e) { return fail(reply, request, e); }
}

// ── Audit ──
export async function getAudit(request, reply) {
  try {
    const { timesheetId, week, employeeId } = request.query || {};
    return reply.send(successResponse(await svc.getAudit(request.tenant.id, { timesheetId, week, employeeId })));
  } catch (e) { return fail(reply, request, e); }
}

// ── Approval chain ──
export async function getApprovalChain(request, reply) {
  try { return reply.send(successResponse(await svc.getApprovalChain(request.tenant.id))); }
  catch (e) { return fail(reply, request, e); }
}
export async function patchApprovalChain(request, reply) {
  try { return reply.send(successResponse(await svc.patchApprovalChain(request.tenant.id, request.body?.steps, request.user.id))); }
  catch (e) { return fail(reply, request, e); }
}

// ── Rates config ──
export async function getRatesConfig(request, reply) {
  try { return reply.send(successResponse(await svc.getRatesConfig(request.tenant.id))); }
  catch (e) { return fail(reply, request, e); }
}
export async function patchRatesConfig(request, reply) {
  try { return reply.send(successResponse(await svc.patchRatesConfig(request.tenant.id, request.body, request.user.id))); }
  catch (e) { return fail(reply, request, e); }
}

// ── Budgets ──
export async function getBudgets(request, reply) {
  try { return reply.send(successResponse(await svc.getBudgets(request.tenant.id, request.user.id))); }
  catch (e) { return fail(reply, request, e); }
}
export async function patchBudget(request, reply) {
  try { return reply.send(successResponse(await svc.patchBudget(request.tenant.id, request.params.projectId, request.body, request.user.id))); }
  catch (e) { return fail(reply, request, e); }
}

// ── Cost rates ──
export async function getCostRates(request, reply) {
  try { return reply.send(successResponse(await svc.getCostRates(request.tenant.id, request.user.id))); }
  catch (e) { return fail(reply, request, e); }
}
export async function patchCostRate(request, reply) {
  try { return reply.send(successResponse(await svc.patchCostRate(request.tenant.id, request.params.employeeId, request.body.costRate, request.user.id))); }
  catch (e) { return fail(reply, request, e); }
}

// ── Week config ──
export async function getWeekConfig(request, reply) {
  try { return reply.send(successResponse(await svc.getWeekConfig(request.tenant.id))); }
  catch (e) { return fail(reply, request, e); }
}

// ── Delegations ──
export async function getDelegations(request, reply) {
  try { return reply.send(successResponse(await svc.getDelegations(request.tenant.id))); }
  catch (e) { return fail(reply, request, e); }
}
export async function createDelegation(request, reply) {
  try {
    const a = actor(request);
    const body = { ...request.body, actorName: a.name, actorEmployeeId: a.employeeId };
    return reply.code(201).send(successResponse(await svc.createDelegation(request.tenant.id, body, a.userId)));
  } catch (e) { return fail(reply, request, e); }
}
export async function deleteDelegation(request, reply) {
  try { return reply.send(successResponse(await svc.deleteDelegation(request.tenant.id, request.params.id, request.user.id))); }
  catch (e) { return fail(reply, request, e); }
}
