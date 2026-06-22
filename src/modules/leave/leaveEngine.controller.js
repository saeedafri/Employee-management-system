// Leave-engine controllers (Phase 4). Wire shapes mirror the FE MSW handlers
// (ems-frontend/src/mocks/handlers/leave-engine.ts) exactly so MSW can be turned off with zero UI change.
import { successResponse, errorResponse } from '../../utils/response.js';
import { prisma } from '../../plugins/prisma.js';
import * as svc from './leaveEngine.service.js';

const PRIVILEGED = new Set(['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN']);

// Resolve the target employeeId, enforcing data isolation: non-privileged users see only their own.
function resolveEmployeeId(request, fallbackToSelf = true) {
  const requested = request.query?.employeeId;
  const self = request.user.employeeId;
  if (!requested) return fallbackToSelf ? self : null;
  if (PRIVILEGED.has(request.user.memberType)) return requested;
  return self; // EMPLOYEE/AUDITOR can never read another person's ledger
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

// ── Policy packs ─────────────────────────────────────────────────────────────
export async function getPackCatalog(request, reply) {
  try {
    return reply.send(successResponse({ packs: svc.getStarterPacks() }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function seedPacks(request, reply) {
  try {
    const result = await svc.seedPacks(prisma, request.tenant.id, request.body?.country);
    return reply.send(successResponse(result));
  } catch (e) {
    return fail(reply, request, e);
  }
}

// ── Policies ─────────────────────────────────────────────────────────────────
export async function getPolicies(request, reply) {
  try {
    const policies = await svc.listPolicies(prisma, request.tenant.id, {
      country: request.query?.country,
      status: request.query?.status,
    });
    return reply.send(successResponse({ policies }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function createPolicy(request, reply) {
  try {
    const policy = await svc.createPolicyVersion(prisma, request.tenant.id, request.body);
    return reply.code(201).send(successResponse(policy));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function newPolicyVersion(request, reply) {
  try {
    const policy = await svc.newPolicyVersion(prisma, request.tenant.id, request.params.id);
    if (!policy) return reply.code(404).send(errorResponse('NOT_FOUND', 'No such policy', {}, request.id));
    return reply.code(201).send(successResponse(policy));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function patchPolicy(request, reply) {
  try {
    const res = await svc.patchDraftPolicy(prisma, request.tenant.id, request.params.id, request.body);
    if (res.notFound) return reply.code(404).send(errorResponse('NOT_FOUND', 'No such policy', {}, request.id));
    if (res.immutable)
      return reply.code(409).send(errorResponse('IMMUTABLE', 'Published policies cannot be edited — create a new version', {}, request.id));
    return reply.send(successResponse(res.policy));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function publishPolicy(request, reply) {
  try {
    const policy = await svc.publishPolicy(prisma, request.tenant.id, request.params.id);
    if (!policy) return reply.code(409).send(errorResponse('INVALID_STATE', 'Only DRAFT can be published', {}, request.id));
    return reply.send(successResponse(policy));
  } catch (e) {
    return fail(reply, request, e);
  }
}

// ── Assignments ──────────────────────────────────────────────────────────────
export async function getAssignments(request, reply) {
  try {
    const employeeId = resolveEmployeeId(request, false);
    const assignments = await svc.listAssignments(prisma, request.tenant.id, employeeId || undefined);
    return reply.send(successResponse({ assignments }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function autoAssign(request, reply) {
  try {
    const tenantId = request.tenant.id;
    let ids = request.body?.employeeIds;
    if (!ids || ids.length === 0) {
      const all = await svc.repo.listActiveEmployees(prisma, tenantId);
      ids = all.map((e) => e.id);
    }
    let assigned = 0;
    let skipped = 0;
    const made = [];
    for (const id of ids) {
      const employee = await svc.repo.getEmployee(prisma, tenantId, id);
      if (!employee) {
        skipped++;
        continue;
      }
      const r = await svc.autoAssign(prisma, tenantId, employee, request.body?.country);
      if (r.skipped || !r.assignment) skipped++;
      else {
        assigned++;
        made.push(r.assignment);
      }
    }
    return reply.send(successResponse({ assigned, skipped, assignments: made }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

// ── Ledger ───────────────────────────────────────────────────────────────────
export async function getLedger(request, reply) {
  try {
    const employeeId = resolveEmployeeId(request);
    const leaveTypeId = request.query?.leaveTypeId ?? 'EL';
    const result = await svc.getLedger(prisma, request.tenant.id, employeeId, leaveTypeId, request.query?.country);
    return reply.send(successResponse(result));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function adjustLedger(request, reply) {
  try {
    const { employeeId, leaveTypeId, delta, reason } = request.body;
    const result = await svc.postAdjustment(prisma, request.tenant.id, employeeId, leaveTypeId, delta, reason, request.body?.country);
    return reply.send(successResponse(result));
  } catch (e) {
    return fail(reply, request, e);
  }
}

// ── Comp-off ─────────────────────────────────────────────────────────────────
export async function getCompOffTypes(request, reply) {
  try {
    const employeeId = resolveEmployeeId(request);
    const types = await svc.eligibleCompOffTypes(prisma, request.tenant.id, employeeId, request.query?.country);
    return reply.send(successResponse({ types }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function submitCompOff(request, reply) {
  try {
    const req = await svc.submitCompOff(prisma, request.tenant.id, request.user.employeeId, request.body);
    return reply.code(201).send(successResponse(req));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function listCompOff(request, reply) {
  try {
    const scope = request.query?.scope;
    const status = request.query?.status;
    const isTeam = scope === 'team' && PRIVILEGED.has(request.user.memberType);
    const employeeId = isTeam ? undefined : request.user.employeeId;
    const requests = await svc.listCompOffRequests(prisma, request.tenant.id, employeeId, status);
    return reply.send(successResponse({ requests }));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function approveCompOff(request, reply) {
  try {
    const req = await svc.approveCompOff(prisma, request.tenant.id, request.params.id, request.user.id, request.body?.country);
    if (!req) return reply.code(409).send(errorResponse('INVALID_STATE', 'Request is not pending', {}, request.id));
    return reply.send(successResponse(req));
  } catch (e) {
    return fail(reply, request, e);
  }
}

export async function rejectCompOff(request, reply) {
  try {
    const req = await svc.rejectCompOff(prisma, request.tenant.id, request.params.id, request.body?.approverComment ?? '', request.user.id);
    if (!req) return reply.code(409).send(errorResponse('INVALID_STATE', 'Request is not pending', {}, request.id));
    return reply.send(successResponse(req));
  } catch (e) {
    return fail(reply, request, e);
  }
}

// ── Encashment ───────────────────────────────────────────────────────────────
export async function encash(request, reply) {
  try {
    const { employeeId, leaveTypeCode, days, componentsByTag } = request.body;
    const res = await svc.encash(prisma, request.tenant.id, employeeId, leaveTypeCode, days, componentsByTag, request.body?.country);
    if (!res) return reply.code(422).send(errorResponse('NOT_ELIGIBLE', 'Encashment not allowed', {}, request.id));
    return reply.send(successResponse(res));
  } catch (e) {
    return fail(reply, request, e);
  }
}
