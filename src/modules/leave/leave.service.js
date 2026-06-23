import * as leaveRepository from './leave.repository.js';
import { prisma } from '../../plugins/prisma.js';
import { resolveHolidayDateSet } from '../holidays/holidayResolver.service.js';
import {
  notifyLeaveRequested,
  notifyLeaveApproved,
  notifyLeaveDenied,
  notifyLeaveWithdrawn,
} from '../../utils/notifier.js';

// Iterate each UTC calendar day in [start,end] inclusive.
function* eachDayUTC(startDate, endDate) {
  const cur = new Date(`${new Date(startDate).toISOString().slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${new Date(endDate).toISOString().slice(0, 10)}T00:00:00.000Z`);
  while (cur <= end) { yield new Date(cur); cur.setUTCDate(cur.getUTCDate() + 1); }
}

/**
 * Holiday-aware chargeable-day breakdown for a leave request (HOLIDAY_ENGINE_BACKEND_CONTRACT §3).
 * Consumes the SHARED holiday resolver — the same engine payroll + attendance use — so the
 * holidays excluded here are identical to the ones the calendar shows and payroll counts.
 */
export async function previewLeaveRequest(tenantId, employeeId, { startDate, endDate }) {
  const { dates, holidays, workWeekDays } = await resolveHolidayDateSet(prisma, tenantId, {
    employeeId, from: startDate, to: endDate,
  });
  const workSet = new Set(workWeekDays);
  let calendarDays = 0; let weekendDays = 0; let holidayDays = 0; let chargeableDays = 0;
  for (const d of eachDayUTC(startDate, endDate)) {
    calendarDays += 1;
    const ymd = d.toISOString().slice(0, 10);
    if (!workSet.has(d.getUTCDay())) { weekendDays += 1; continue; }
    if (dates.has(ymd)) { holidayDays += 1; continue; }
    chargeableDays += 1;
  }
  return {
    startDate, endDate, calendarDays, weekendDays, holidayDays, chargeableDays,
    holidaysExcluded: holidays.map((hh) => ({
      date: hh.holidayDate.slice(0, 10), name: hh.name, observed: hh.observed,
    })),
    workWeekDays,
  };
}

export async function getLeaveTypes(tenantId) {
  return leaveRepository.getLeaveTypes(tenantId);
}

export async function getTeamCalendar(tenantId, managerEmployeeId, month) {
  return leaveRepository.getTeamCalendar(tenantId, managerEmployeeId, month);
}

export async function bulkApproveLeaveRequests(tenantId, ids, approverId, comment) {
  const results = [];
  for (const id of ids) {
    try {
      const result = await approveLeaveRequest(tenantId, id, approverId, comment);
      results.push({ id, status: 'approved', referenceNo: result.referenceNo });
    } catch (err) {
      results.push({ id, status: 'failed', error: err.message });
    }
  }
  return results;
}

export async function bulkDenyLeaveRequests(tenantId, ids, approverId, comment) {
  const results = [];
  for (const id of ids) {
    try {
      const result = await rejectLeaveRequest(tenantId, id, approverId, comment || 'Bulk denied');
      results.push({ id, status: 'denied', referenceNo: result.referenceNo });
    } catch (err) {
      results.push({ id, status: 'failed', error: err.message });
    }
  }
  return results;
}

export async function createLeaveType(tenantId, data) {
  const existing = await leaveRepository.getLeaveTypes(tenantId);
  if (existing.find(lt => lt.code === data.code)) {
    throw new AppError('Leave type code already exists', 'DUPLICATE_LEAVE_TYPE_CODE', 409);
  }
  return leaveRepository.createLeaveType(tenantId, data);
}

export async function updateLeaveType(tenantId, id, data) {
  const result = await leaveRepository.updateLeaveType(tenantId, id, data);
  if (!result) throw new AppError('Leave type not found', 'NOT_FOUND', 404);
  return result;
}

export async function deleteLeaveType(tenantId, id) {
  const result = await leaveRepository.deleteLeaveType(tenantId, id);
  if (!result) throw new AppError('Leave type not found', 'NOT_FOUND', 404);
  return result;
}

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

  notifyLeaveRequested(tenantId, employeeId, leaveRequest).catch(() => {});

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
    page = 1, limit = 10, status, leaveTypeId, fromDate, toDate, employeeId,
  } = filters;

  const offset = (page - 1) * limit;

  return leaveRepository.getTeamLeaveRequests(tenantId, managerEmployeeId, {
    status,
    leaveTypeId,
    fromDate,
    toDate,
    limit,
    offset,
    employeeId,
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
      'LEAVE_ALREADY_DECIDED',
      409,
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

  if (balance) {
    await leaveRepository.updateLeaveBalance(tenantId, leaveRequest.employeeId, leaveRequest.leaveTypeId, {
      pending: Math.max(0, balance.pending - leaveRequest.totalDays),
      used: balance.used + leaveRequest.totalDays,
    });
  }

  notifyLeaveApproved(tenantId, leaveRequest.employeeId, updated).catch(() => {});

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
      'LEAVE_ALREADY_DECIDED',
      409,
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

  if (balance) {
    await leaveRepository.updateLeaveBalance(tenantId, leaveRequest.employeeId, leaveRequest.leaveTypeId, {
      pending: Math.max(0, balance.pending - leaveRequest.totalDays),
    });
  }

  notifyLeaveDenied(tenantId, leaveRequest.employeeId, updated).catch(() => {});

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
      'LEAVE_ALREADY_DECIDED',
      409,
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

  if (balance) {
    await leaveRepository.updateLeaveBalance(tenantId, employeeId, leaveRequest.leaveTypeId, {
      pending: Math.max(0, balance.pending - leaveRequest.totalDays),
    });
  }

  notifyLeaveWithdrawn(tenantId, employeeId, updated).catch(() => {});

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
      total: b.balance + b.used,
      used: b.used,
      pending: b.pending,
      available: b.balance - b.used - b.pending,
    })),
  };

  return result;
}

export async function getTeamCoverage(tenantId, date, departmentId) {
  return leaveRepository.getTeamCoverage(tenantId, date, departmentId || null);
}
