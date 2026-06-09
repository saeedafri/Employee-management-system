import {
  getManagerDashboard,
  getTeam,
  getTeamAttendance,
  getPendingApprovals,
  approveLeaveRequest,
  approveRegularizationRequest,
} from './manager.service.js';
import { errorResponse } from '../../utils/response.js';

export async function managerDashboardHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (user.memberType !== 'MANAGER') {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only managers can access this', request.requestId));
  }

  const result = await getManagerDashboard(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getTeamHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (user.memberType !== 'MANAGER') {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only managers can access this', request.requestId));
  }

  const result = await getTeam(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getTeamAttendanceHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;
  const { range = '30d' } = request.query;

  if (user.memberType !== 'MANAGER') {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only managers can access this', request.requestId));
  }

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

export async function approveLeaveHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;
  const { id } = request.params;
  const { decision, comment } = request.body;

  if (user.memberType !== 'MANAGER') {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only managers can approve leaves', request.requestId));
  }

  if (!['approve', 'deny'].includes(decision)) {
    return reply.code(400).send(errorResponse('INVALID_DECISION', 'Decision must be approve or deny', request.requestId));
  }

  const result = await approveLeaveRequest(user.employeeId, id, tenantId, decision, comment);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function approveRegularizationHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;
  const { id } = request.params;
  const { decision, comment } = request.body;

  if (user.memberType !== 'MANAGER') {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Only managers can approve requests', request.requestId));
  }

  if (!['approve', 'deny'].includes(decision)) {
    return reply.code(400).send(errorResponse('INVALID_DECISION', 'Decision must be approve or deny', request.requestId));
  }

  const result = await approveRegularizationRequest(user.employeeId, id, tenantId, decision, comment);
  reply.code(result.error ? 400 : 200).send(result);
}
