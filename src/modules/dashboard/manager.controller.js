import {
  getManagerDashboard,
  getTeam,
  getTeamAttendance,
  getPendingApprovals,
} from './manager.service.js';
import { errorResponse } from '../../utils/response.js';
import * as leaveController from '../leave/leave.controller.js';
import * as attendanceController from '../attendance/attendance.controller.js';

export async function managerDashboardHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;


  const result = await getManagerDashboard(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getTeamHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;


  const result = await getTeam(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getTeamAttendanceHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;
  const { range = '30d' } = request.query;


  if (!['7d', '30d', '90d'].includes(range)) {
    return reply.code(400).send(errorResponse('INVALID_RANGE', 'Range must be 7d, 30d, or 90d', request.requestId));
  }

  const result = await getTeamAttendance(user.employeeId, tenantId, range);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getPendingApprovalsHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  const isManager = user.memberType === 'MANAGER';
  const isAdmin = ['HR_ADMIN', 'SUPER_ADMIN'].includes(user.memberType);
  if (!isManager && !isAdmin) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only managers and HR admins can access this', request.requestId));
  }

  const scope = isAdmin ? 'tenant' : 'team';
  const managerId = isManager ? user.employeeId : null;
  const result = await getPendingApprovals(managerId, tenantId, { scope });
  reply.code(result.error ? 400 : 200).send(result);
}

// These ran their own approval path: approverId got an employee id (a User foreign key),
// the error was stripped to {}, and leave balances were never touched. They now go through
// the same handlers as PATCH /leave/requests/:id/approve|reject and
// /attendance/regularization/:id/approve|deny: same scoping, balances, audit, notifications.
export async function approveLeaveHandler(request, reply) {
  const { decision, comment } = request.body;
  request.body = comment === undefined ? {} : { approverComment: comment };
  return decision === 'approve'
    ? leaveController.approveLeaveRequest(request, reply)
    : leaveController.rejectLeaveRequest(request, reply);
}

export async function approveRegularizationHandler(request, reply) {
  const { decision, comment } = request.body;
  request.body = comment === undefined ? {} : { reviewerComment: comment };
  return decision === 'approve'
    ? attendanceController.approveRegularization(request, reply)
    : attendanceController.denyRegularization(request, reply);
}
