import * as leaveRepository from './leave.repository.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function calculateTotalDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export async function createLeaveRequest(tenantId, employeeId, {
  leaveTypeId, startDate, endDate, reason,
}) {
  const leaveType = await leaveRepository.getLeaveType(tenantId, leaveTypeId);
  if (!leaveType) {
    throw new AppError('Leave type not found', 'LEAVE_TYPE_NOT_FOUND', 404);
  }

  const balance = await leaveRepository.getLeaveBalance(tenantId, employeeId, leaveTypeId);
  if (!balance) {
    throw new AppError('No leave balance found for this leave type', 'NO_LEAVE_BALANCE', 400);
  }

  const overlappingLeave = await leaveRepository.checkOverlappingLeaves(
    tenantId,
    employeeId,
    startDate,
    endDate,
  );
  if (overlappingLeave) {
    throw new AppError(
      'Overlapping leave request exists',
      'OVERLAPPING_LEAVE',
      400,
      { existingLeaveId: overlappingLeave.id },
    );
  }

  const totalDays = calculateTotalDays(startDate, endDate);
  const availableBalance = balance.balance - balance.pending;

  if (totalDays > availableBalance) {
    throw new AppError(
      `Insufficient leave balance. Available: ${availableBalance}, Requested: ${totalDays}`,
      'INSUFFICIENT_BALANCE',
      400,
      { available: availableBalance, requested: totalDays },
    );
  }

  const leaveRequest = await leaveRepository.createLeaveRequest({
    tenantId,
    employeeId,
    leaveTypeId,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    totalDays,
    reason,
    status: 'PENDING',
  });

  await leaveRepository.updateLeaveBalance(tenantId, employeeId, leaveTypeId, {
    pending: balance.pending + totalDays,
  });

  return leaveRequest;
}

export async function getLeaveRequests(tenantId, employeeId, filters = {}) {
  const {
    page = 1, limit = 10, status, leaveTypeId, fromDate, toDate,
  } = filters;

  const offset = (page - 1) * limit;

  return leaveRepository.getEmployeeLeaveRequests(tenantId, employeeId, {
    status,
    leaveTypeId,
    fromDate,
    toDate,
    limit,
    offset,
  });
}

export async function getTeamLeaveRequests(tenantId, managerEmployeeId, filters = {}) {
  const {
    page = 1, limit = 10, status, leaveTypeId, fromDate, toDate,
  } = filters;

  const offset = (page - 1) * limit;

  return leaveRepository.getTeamLeaveRequests(tenantId, managerEmployeeId, {
    status,
    leaveTypeId,
    fromDate,
    toDate,
    limit,
    offset,
  });
}

export async function approveLeaveRequest(tenantId, leaveRequestId, approverId, comment = '') {
  const leaveRequest = await leaveRepository.findLeaveRequest(tenantId, leaveRequestId);

  if (!leaveRequest) {
    throw new AppError('Leave request not found', 'LEAVE_REQUEST_NOT_FOUND', 404);
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new AppError(
      `Cannot approve leave with status ${leaveRequest.status}`,
      'INVALID_REQUEST_STATUS',
      400,
    );
  }

  const updated = await leaveRepository.updateLeaveRequest(tenantId, leaveRequestId, {
    status: 'APPROVED',
    approverId,
    approverComment: comment || null,
    decidedAt: new Date(),
  });

  const balance = await leaveRepository.getLeaveBalance(
    tenantId,
    leaveRequest.employeeId,
    leaveRequest.leaveTypeId,
  );

  await leaveRepository.updateLeaveBalance(tenantId, leaveRequest.employeeId, leaveRequest.leaveTypeId, {
    pending: balance.pending - leaveRequest.totalDays,
    used: balance.used + leaveRequest.totalDays,
  });

  return updated;
}

export async function rejectLeaveRequest(tenantId, leaveRequestId, approverId, comment) {
  const leaveRequest = await leaveRepository.findLeaveRequest(tenantId, leaveRequestId);

  if (!leaveRequest) {
    throw new AppError('Leave request not found', 'LEAVE_REQUEST_NOT_FOUND', 404);
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new AppError(
      `Cannot reject leave with status ${leaveRequest.status}`,
      'INVALID_REQUEST_STATUS',
      400,
    );
  }

  const updated = await leaveRepository.updateLeaveRequest(tenantId, leaveRequestId, {
    status: 'DENIED',
    approverId,
    approverComment: comment,
    decidedAt: new Date(),
  });

  const balance = await leaveRepository.getLeaveBalance(
    tenantId,
    leaveRequest.employeeId,
    leaveRequest.leaveTypeId,
  );

  await leaveRepository.updateLeaveBalance(tenantId, leaveRequest.employeeId, leaveRequest.leaveTypeId, {
    pending: balance.pending - leaveRequest.totalDays,
  });

  return updated;
}

export async function withdrawLeaveRequest(tenantId, employeeId, leaveRequestId) {
  const leaveRequest = await leaveRepository.findLeaveRequest(tenantId, leaveRequestId);

  if (!leaveRequest) {
    throw new AppError('Leave request not found', 'LEAVE_REQUEST_NOT_FOUND', 404);
  }

  if (leaveRequest.employeeId !== employeeId) {
    throw new AppError(
      'You can only withdraw your own leave request',
      'UNAUTHORIZED_ACTION',
      403,
    );
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new AppError(
      'Can only withdraw pending leave requests',
      'INVALID_REQUEST_STATUS',
      400,
    );
  }

  const updated = await leaveRepository.updateLeaveRequest(tenantId, leaveRequestId, {
    status: 'WITHDRAWN',
  });

  const balance = await leaveRepository.getLeaveBalance(
    tenantId,
    employeeId,
    leaveRequest.leaveTypeId,
  );

  await leaveRepository.updateLeaveBalance(tenantId, employeeId, leaveRequest.leaveTypeId, {
    pending: balance.pending - leaveRequest.totalDays,
  });

  return updated;
}

export async function getLeaveBalance(tenantId, employeeId) {
  const balances = await leaveRepository.getLeaveBalances(tenantId, employeeId);

  if (!balances.length) {
    throw new AppError('No leave balances found', 'NO_LEAVE_BALANCE', 404);
  }

  const result = {
    balances: balances.map((b) => ({
      id: b.id,
      leaveTypeId: b.leaveTypeId,
      leaveTypeName: b.leaveType.name,
      leaveTypeCode: b.leaveType.code,
      total: b.balance + b.used + b.pending,
      used: b.used,
      pending: b.pending,
      available: b.balance,
    })),
  };

  return result;
}
