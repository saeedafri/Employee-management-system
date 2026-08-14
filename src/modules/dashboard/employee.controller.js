import {
  getEmployeeDashboard,
  getEmployeeToday,
  checkIn,
  checkOut,
  getLeaveBalance,
  getHolidays,
  getDocuments,
  getEmployeeTeam,
} from './employee.service.js';
import { errorResponse, successResponse } from '../../utils/response.js';

export async function employeeDashboardHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!user.employeeId) {
    // BE-9(b): a personal READ by someone with no linked Employee (SUPER_ADMIN)
    // is an empty state, not a client error. Matches the decision already made
    // for /attendance/summary|records|calendar in attendance.service.js.
    // The write handlers below still 400 -- you cannot check in without one.
    return reply.code(200).send(successResponse({ noEmployeeRecord: true }));
  }

  const result = await getEmployeeDashboard(user.employeeId, tenantId, request.tenant?.timezone || 'UTC');
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getTodayHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!user.employeeId) {
    // BE-9(b): a personal READ by someone with no linked Employee (SUPER_ADMIN)
    // is an empty state, not a client error. Matches the decision already made
    // for /attendance/summary|records|calendar in attendance.service.js.
    // The write handlers below still 400 -- you cannot check in without one.
    return reply.code(200).send(successResponse({ noEmployeeRecord: true }));
  }

  const result = await getEmployeeToday(user.employeeId, tenantId, request.tenant?.timezone || 'UTC');
  reply.code(result.error ? 400 : 200).send(result);
}

export async function checkInHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!user.employeeId) {
    return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', request.requestId));
  }

  const result = await checkIn(user.employeeId, tenantId, request.tenant?.timezone || 'UTC');
  reply.code(result.error ? 400 : 200).send(result);
}

export async function checkOutHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!user.employeeId) {
    return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', request.requestId));
  }

  const result = await checkOut(user.employeeId, tenantId, request.tenant?.timezone || 'UTC');
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getBalanceHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!user.employeeId) {
    // BE-9(b): a personal READ by someone with no linked Employee (SUPER_ADMIN)
    // is an empty state, not a client error. Matches the decision already made
    // for /attendance/summary|records|calendar in attendance.service.js.
    // The write handlers below still 400 -- you cannot check in without one.
    return reply.code(200).send(successResponse({ noEmployeeRecord: true }));
  }

  const result = await getLeaveBalance(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getHolidaysHandler(request, reply) {
  const tenantId = request.tenant.id;

  const result = await getHolidays(tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getDocumentsHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!user.employeeId) {
    // BE-9(b): a personal READ by someone with no linked Employee (SUPER_ADMIN)
    // is an empty state, not a client error. Matches the decision already made
    // for /attendance/summary|records|calendar in attendance.service.js.
    // The write handlers below still 400 -- you cannot check in without one.
    return reply.code(200).send(successResponse({ noEmployeeRecord: true }));
  }

  const result = await getDocuments(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getTeamHandler(request, reply) {
  const { user } = request; const tenantId = request.tenant.id;

  if (!user.employeeId) {
    // BE-9(b): a personal READ by someone with no linked Employee (SUPER_ADMIN)
    // is an empty state, not a client error. Matches the decision already made
    // for /attendance/summary|records|calendar in attendance.service.js.
    // The write handlers below still 400 -- you cannot check in without one.
    return reply.code(200).send(successResponse({ noEmployeeRecord: true }));
  }

  const result = await getEmployeeTeam(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}
