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
import { errorResponse } from '../../utils/response.js';

export async function employeeDashboardHandler(request, reply) {
  const { user, tenantId } = request;

  if (!user.employeeId) {
    return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', request.requestId));
  }

  const result = await getEmployeeDashboard(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getTodayHandler(request, reply) {
  const { user, tenantId } = request;

  if (!user.employeeId) {
    return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', request.requestId));
  }

  const result = await getEmployeeToday(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function checkInHandler(request, reply) {
  const { user, tenantId } = request;

  if (!user.employeeId) {
    return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', request.requestId));
  }

  const result = await checkIn(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function checkOutHandler(request, reply) {
  const { user, tenantId } = request;

  if (!user.employeeId) {
    return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', request.requestId));
  }

  const result = await checkOut(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getBalanceHandler(request, reply) {
  const { user, tenantId } = request;

  if (!user.employeeId) {
    return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', request.requestId));
  }

  const result = await getLeaveBalance(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getHolidaysHandler(request, reply) {
  const { tenantId } = request;

  const result = await getHolidays(tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getDocumentsHandler(request, reply) {
  const { user } = request;

  if (!user.employeeId) {
    return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', request.requestId));
  }

  const result = await getDocuments();
  reply.code(result.error ? 400 : 200).send(result);
}

export async function getTeamHandler(request, reply) {
  const { user, tenantId } = request;

  if (!user.employeeId) {
    return reply.code(400).send(errorResponse('NO_EMPLOYEE_RECORD', 'User has no employee record', request.requestId));
  }

  const result = await getEmployeeTeam(user.employeeId, tenantId);
  reply.code(result.error ? 400 : 200).send(result);
}
