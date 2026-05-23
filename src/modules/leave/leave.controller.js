import { successResponse, errorResponse } from '../../utils/response.js';
import * as leaveService from './leave.service.js';
import * as leaveValidator from './leave.validator.js';

export async function getLeaveTypes(request, reply) {
  try {
    const tenantId = request.tenant.id;
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

    if (!managerEmployeeId) {
      return reply.status(400).send(
        errorResponse('NO_EMPLOYEE_ID', 'User does not have an employee profile', {}, request.id),
      );
    }

    const query = leaveValidator.getLeaveRequestsSchema.parse(request.query);

    const { requests, total } = await leaveService.getTeamLeaveRequests(
      tenantId,
      managerEmployeeId,
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
