// HTTP layer for payout methods. Routes stay thin; ownership (self vs other) is
// enforced here, coarse role-gating by `authorize(...)` in the routes.
import { prisma } from '../../../plugins/prisma.js';
import * as service from './payout.service.js';
import { successResponse, errorResponse } from '../../../utils/response.js';

function handleError(reply, err) {
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const details = err.details ?? {};
  reply.code(status).send(errorResponse(code, err.message, details, reply.request?.id));
}

const isAdmin = (user) => user?.memberType === 'HR_ADMIN' || user?.memberType === 'SUPER_ADMIN';

/** Self or HR/SUPER may act on :employeeId; otherwise 403. Returns true if forbidden was sent. */
function denyIfNotSelfOrAdmin(reply, user, employeeId) {
  if (isAdmin(user)) return false;
  if (user?.employeeId && user.employeeId === employeeId) return false;
  reply.code(403).send(errorResponse('FORBIDDEN', 'You may not access this employee’s payout methods'));
  return true;
}

// ── Country layer ─────────────────────────────────────────────────────────────
export async function listCountries(_req, reply) {
  try {
    reply.send(successResponse(service.listCountries()));
  } catch (err) { handleError(reply, err); }
}

export async function getBankSchema(request, reply) {
  try {
    const data = await service.resolveBankSchema(prisma, request.tenant.id, request.params.code);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Catalog CRUD (SUPER_ADMIN) ────────────────────────────────────────────────
export async function listCatalog(request, reply) {
  try {
    reply.send(successResponse(await service.listCatalog(prisma, request.tenant.id)));
  } catch (err) { handleError(reply, err); }
}

export async function getCatalogOne(request, reply) {
  try {
    reply.send(successResponse(await service.getCatalogOne(prisma, request.tenant.id, request.params.country)));
  } catch (err) { handleError(reply, err); }
}

export async function createCatalog(request, reply) {
  try {
    const actor = request.user?.email || request.user?.sub;
    const data = await service.createCatalog(prisma, request.tenant.id, request.body, actor);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateCatalog(request, reply) {
  try {
    const actor = request.user?.email || request.user?.sub;
    const data = await service.updateCatalog(prisma, request.tenant.id, request.params.country, request.body, actor);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function deleteCatalog(request, reply) {
  try {
    reply.send(successResponse(await service.deleteCatalog(prisma, request.tenant.id, request.params.country)));
  } catch (err) { handleError(reply, err); }
}

// ── Payout methods ────────────────────────────────────────────────────────────
export async function listMine(request, reply) {
  try {
    const employeeId = request.user?.employeeId;
    if (!employeeId) {
      reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'Your account is not linked to an employee record'));
      return;
    }
    reply.send(successResponse(await service.listForEmployee(prisma, request.tenant.id, employeeId)));
  } catch (err) { handleError(reply, err); }
}

export async function listForEmployee(request, reply) {
  try {
    const { employeeId } = request.params;
    if (denyIfNotSelfOrAdmin(reply, request.user, employeeId)) return;
    reply.send(successResponse(await service.listForEmployee(prisma, request.tenant.id, employeeId)));
  } catch (err) { handleError(reply, err); }
}

export async function getMethod(request, reply) {
  try {
    const row = await service.getMethodRaw(prisma, request.tenant.id, request.params.id);
    if (!row) { reply.code(404).send(errorResponse('NOT_FOUND', 'Method not found')); return; }
    const owner = request.user?.employeeId && request.user.employeeId === row.employeeId;
    reply.send(successResponse(service.serializeMethod(row, { unmask: !!owner })));
  } catch (err) { handleError(reply, err); }
}

export async function createMethod(request, reply) {
  try {
    const { employeeId } = request.params;
    if (denyIfNotSelfOrAdmin(reply, request.user, employeeId)) return;
    const owner = !!request.user?.employeeId && request.user.employeeId === employeeId;
    const data = await service.createMethod(prisma, request.tenant.id, employeeId, request.body, request.user.sub, owner);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function setPrimary(request, reply) {
  try {
    const row = await service.getMethodRaw(prisma, request.tenant.id, request.params.id);
    if (!row) { reply.code(404).send(errorResponse('NOT_FOUND', 'Method not found')); return; }
    if (denyIfNotSelfOrAdmin(reply, request.user, row.employeeId)) return;
    const data = await service.requestSetPrimary(prisma, request.tenant.id, request.params.id, request.user.sub);
    reply.code(202).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function archive(request, reply) {
  try {
    const row = await service.getMethodRaw(prisma, request.tenant.id, request.params.id);
    if (!row) { reply.code(404).send(errorResponse('NOT_FOUND', 'Method not found')); return; }
    if (denyIfNotSelfOrAdmin(reply, request.user, row.employeeId)) return;
    const owner = !!request.user?.employeeId && request.user.employeeId === row.employeeId;
    const data = await service.archiveMethod(prisma, request.tenant.id, request.params.id, owner);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Approvals (HR/SUPER) ──────────────────────────────────────────────────────
export async function listApprovals(request, reply) {
  try {
    const status = request.query?.status || 'PENDING';
    reply.send(successResponse(await service.listApprovals(prisma, request.tenant.id, status)));
  } catch (err) { handleError(reply, err); }
}

export async function approveApproval(request, reply) {
  try {
    const data = await service.approveApproval(prisma, request.tenant.id, request.params.id, request.user.sub, request.body?.note);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function rejectApproval(request, reply) {
  try {
    const note = typeof request.body?.note === 'string' ? request.body.note.trim() : '';
    if (!note) {
      reply.code(422).send(errorResponse('VALIDATION_ERROR', 'A rejection reason is required', [{ field: 'note', message: 'A rejection reason is required' }]));
      return;
    }
    const data = await service.rejectApproval(prisma, request.tenant.id, request.params.id, request.user.sub, note);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Verification (HR/SUPER) ───────────────────────────────────────────────────
export async function listUnverified(request, reply) {
  try {
    reply.send(successResponse(await service.listUnverified(prisma, request.tenant.id)));
  } catch (err) { handleError(reply, err); }
}

export async function verify(request, reply) {
  try {
    const { result, note } = request.body || {};
    if (result !== 'VERIFIED' && result !== 'FAILED') {
      reply.code(422).send(errorResponse('VALIDATION_ERROR', 'result must be VERIFIED or FAILED', [{ field: 'result', message: 'result must be VERIFIED or FAILED' }]));
      return;
    }
    const data = await service.verifyMethod(prisma, request.tenant.id, request.params.id, result, note);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}
