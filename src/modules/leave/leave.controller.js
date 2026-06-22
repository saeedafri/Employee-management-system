import { successResponse, errorResponse } from '../../utils/response.js';
import { prisma } from '../../plugins/prisma.js';
import * as leaveService from './leave.service.js';
import * as leaveEngineService from './leaveEngine.service.js';
import * as leaveValidator from './leave.validator.js';

export async function getLeaveTypes(request, reply) {
  try {
    const tenantId = request.tenant.id;
    // MSW-parity: the self-service screen joins /leave/balance (leaveTypeId = engine code
    // EL/SL/CL/CO) to /leave/types by id. Prefer the engine catalog (id === code) so that
    // join resolves; fall back to legacy DB LeaveType rows when no policies exist.
    const engineTypes = await leaveEngineService.getLeaveTypesFromPolicies(prisma, tenantId);
    if (engineTypes && engineTypes.length > 0) {
      return reply.code(200).send(successResponse(engineTypes));
    }
    const types = await leaveService.getLeaveTypes(tenantId);
    return reply.code(200).send(successResponse(types));
  } catch (error) {
    return reply.code(500).send(errorResponse('INTERNAL_ERROR', error.message, {}, request.id));
  }
}

export async function createLeaveRequest(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;

    const body = leaveValidator.createLeaveRequestSchema.parse(request.body);

    const leaveRequest = await leaveService.createLeaveRequest(tenantId, employeeId, body);

    await request.log.info({
      action: 'LEAVE_REQUEST_CREATED',
      leaveRequestId: leaveRequest.id,
      employeeId,
      totalDays: leaveRequest.totalDays,
    });

    return reply.status(201).send(
      successResponse({
        id: leaveRequest.id,
        referenceNo: leaveRequest.referenceNo,
        leaveTypeId: leaveRequest.leaveTypeId,
        leaveTypeName: leaveRequest.leaveType.name,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        totalDays: leaveRequest.totalDays,
        status: leaveRequest.status,
        reason: leaveRequest.reason,
        submittedAt: leaveRequest.submittedAt,
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getLeaveRequests(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;

    const query = leaveValidator.getLeaveRequestsSchema.parse(request.query);

    const { requests, total } = await leaveService.getLeaveRequests(tenantId, employeeId, query);

    return reply.send(
      successResponse({
        requests: requests.map((r) => ({
          id: r.id,
          referenceNo: r.referenceNo,
          leaveTypeId: r.leaveTypeId,
          leaveTypeName: r.leaveType.name,
          startDate: r.startDate,
          endDate: r.endDate,
          totalDays: r.totalDays,
          status: r.status,
          reason: r.reason,
          submittedAt: r.submittedAt,
          decidedAt: r.decidedAt,
          approverComment: r.approverComment,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getTeamLeaveRequests(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const managerEmployeeId = request.user.employeeId;
    const isSuperAdmin = request.user.memberType === 'SUPER_ADMIN';

    if (!managerEmployeeId && !isSuperAdmin) {
      return reply.status(403).send(
        errorResponse('FORBIDDEN', 'User does not have an employee profile. SUPER_ADMIN without an employee profile cannot access team leave endpoints.', {}, request.id),
      );
    }

    const query = leaveValidator.getLeaveRequestsSchema.parse(request.query);

    // SUPER_ADMIN with no employee profile gets org-wide results (null = all)
    const { requests, total } = await leaveService.getTeamLeaveRequests(
      tenantId,
      isSuperAdmin && !managerEmployeeId ? null : managerEmployeeId,
      query,
    );

    return reply.send(
      successResponse({
        requests: requests.map((r) => ({
          id: r.id,
          referenceNo: r.referenceNo,
          employeeId: r.employeeId,
          employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
          employeeCode: r.employee.employeeCode,
          leaveTypeId: r.leaveTypeId,
          leaveTypeName: r.leaveType.name,
          startDate: r.startDate,
          endDate: r.endDate,
          totalDays: r.totalDays,
          status: r.status,
          reason: r.reason,
          submittedAt: r.submittedAt,
          decidedAt: r.decidedAt,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          pages: Math.ceil(total / query.limit),
        },
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function approveLeaveRequest(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const approverId = request.user.id;
    const { id } = request.params;

    const body = leaveValidator.approveLeaveRequestSchema.parse(request.body);

    const leaveRequest = await leaveService.approveLeaveRequest(tenantId, id, approverId, body.approverComment);

    await request.log.info({
      action: 'LEAVE_REQUEST_APPROVED',
      leaveRequestId: id,
      approverId,
    });

    return reply.send(
      successResponse({
        id: leaveRequest.id,
        referenceNo: leaveRequest.referenceNo,
        status: leaveRequest.status,
        decidedAt: leaveRequest.decidedAt,
        approverComment: leaveRequest.approverComment ?? null,
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function rejectLeaveRequest(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const approverId = request.user.id;
    const { id } = request.params;

    const body = leaveValidator.rejectLeaveRequestSchema.parse(request.body);

    const leaveRequest = await leaveService.rejectLeaveRequest(
      tenantId,
      id,
      approverId,
      body.approverComment,
    );

    await request.log.info({
      action: 'LEAVE_REQUEST_REJECTED',
      leaveRequestId: id,
      approverId,
    });

    return reply.send(
      successResponse({
        id: leaveRequest.id,
        referenceNo: leaveRequest.referenceNo,
        status: leaveRequest.status,
        decidedAt: leaveRequest.decidedAt,
        approverComment: leaveRequest.approverComment ?? null,
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function withdrawLeaveRequest(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;
    const { id } = request.params;

    const leaveRequest = await leaveService.withdrawLeaveRequest(tenantId, employeeId, id);

    await request.log.info({
      action: 'LEAVE_REQUEST_WITHDRAWN',
      leaveRequestId: id,
      employeeId,
    });

    return reply.send(
      successResponse({
        id: leaveRequest.id,
        status: leaveRequest.status,
      }),
    );
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getLeaveBalance(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const employeeId = request.user.employeeId;

    // MSW-parity: the leave-engine MSW handler shadows /leave/balance with engine-derived
    // balances (ledger fold). Prefer the engine when the employee is on it; fall back to the
    // legacy LeaveBalance rows so non-onboarded employees still see something.
    const engineBalances = await leaveEngineService.getBalancesForEmployee(prisma, tenantId, employeeId);
    if (engineBalances && engineBalances.length > 0) {
      return reply.send(successResponse({ balances: engineBalances }));
    }

    const balances = await leaveService.getLeaveBalance(tenantId, employeeId);

    return reply.send(successResponse(balances));
  } catch (error) {
    request.log.error(error);
    if (error.code) {
      return reply.status(error.statusCode || 400).send(
        errorResponse(error.code, error.message, error.details, request.id),
      );
    }
    throw error;
  }
}

export async function getTeamCalendar(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const managerEmployeeId = request.user.employeeId;
    const isSuperAdmin = request.user.memberType === 'SUPER_ADMIN';
    const month = request.query.month || new Date().toISOString().slice(0, 7);

    if (!managerEmployeeId && !isSuperAdmin) {
      return reply.status(403).send(errorResponse('FORBIDDEN', 'User does not have an employee profile.', {}, request.id));
    }

    const data = await leaveService.getTeamCalendar(tenantId, isSuperAdmin && !managerEmployeeId ? null : managerEmployeeId, month);
    return reply.send(successResponse(data));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function createLeaveType(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const type = await leaveService.createLeaveType(tenantId, request.body);
    return reply.status(201).send(successResponse(type));
  } catch (error) {
    request.log.error(error);
    if (error.code) return reply.status(error.statusCode || 400).send(errorResponse(error.code, error.message, error.details, request.id));
    throw error;
  }
}

export async function updateLeaveType(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { id } = request.params;
    const type = await leaveService.updateLeaveType(tenantId, id, request.body);
    return reply.send(successResponse(type));
  } catch (error) {
    request.log.error(error);
    if (error.code) return reply.status(error.statusCode || 400).send(errorResponse(error.code, error.message, error.details, request.id));
    throw error;
  }
}

export async function deleteLeaveType(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { id } = request.params;
    await leaveService.deleteLeaveType(tenantId, id);
    return reply.send(successResponse({ id, status: 'deactivated' }));
  } catch (error) {
    request.log.error(error);
    if (error.code) return reply.status(error.statusCode || 400).send(errorResponse(error.code, error.message, error.details, request.id));
    throw error;
  }
}

function splitBulkResults(results) {
  const succeeded = results.filter(r => r.status !== 'failed').map(r => r.id);
  const failed = results.filter(r => r.status === 'failed').map(r => ({
    id: r.id,
    code: r.code || 'ERROR',
    message: r.error || 'Unknown error',
  }));
  return { succeeded, failed };
}

export async function bulkApproveLeave(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const approverId = request.user.id;
    const { ids, comment } = request.body;
    const results = await leaveService.bulkApproveLeaveRequests(tenantId, ids, approverId, comment);
    return reply.send(successResponse(splitBulkResults(results)));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function bulkDenyLeave(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const approverId = request.user.id;
    const { ids, comment } = request.body;
    const results = await leaveService.bulkDenyLeaveRequests(tenantId, ids, approverId, comment);
    return reply.send(successResponse(splitBulkResults(results)));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getTeamCoverage(request, reply) {
  try {
    const tenantId = request.tenant.id;
    const { date, departmentId } = request.query;
    if (!date) return reply.status(400).send(errorResponse('VALIDATION_ERROR', 'date is required', {}, request.id));
    const result = await leaveService.getTeamCoverage(tenantId, date, departmentId);
    return reply.send(successResponse(result));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}
