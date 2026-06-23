// Per-employee resolved holiday endpoints (HOLIDAY_ENGINE_BACKEND_CONTRACT §1).
import { prisma } from '../../plugins/prisma.js';
import { resolveEmployeeHolidays } from './holidayResolver.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

function yearOf(request) {
  const y = parseInt(request.query?.year, 10);
  return Number.isFinite(y) ? y : new Date().getUTCFullYear();
}

// GET /me/holidays?year= — resolves the JWT's own employee.
export async function getMyResolvedHolidays(request, reply) {
  const tenantId = request.tenant.id;
  const employeeId = request.user?.employeeId || null;
  try {
    const { holidays, total, context } = await resolveEmployeeHolidays(prisma, tenantId, {
      employeeId, year: yearOf(request),
    });
    // No employee profile (e.g. SUPER_ADMIN): defined behaviour → tenant-wide only (context says so).
    reply.code(200).send(successResponse(
      { holidays, total, year: yearOf(request), context }, { cached: false },
    ));
  } catch (error) {
    reply.code(500).send(errorResponse('RESOLVE_ERROR', error.message, request.requestId));
  }
}

// GET /employees/:id/holidays?year= — HR/SUPER_ADMIN, or the employee viewing their own.
export async function getEmployeeResolvedHolidays(request, reply) {
  const tenantId = request.tenant.id;
  const { id } = request.params;
  const { user } = request;
  const isAdmin = ['HR_ADMIN', 'SUPER_ADMIN'].includes(user.memberType);
  const isSelf = user.employeeId && user.employeeId === id;
  if (!isAdmin && !isSelf) {
    return reply.code(403).send(errorResponse('FORBIDDEN', 'Not allowed to view this employee’s holidays', request.requestId));
  }
  try {
    const employee = await prisma.employee.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!employee) {
      return reply.code(404).send(errorResponse('NOT_FOUND', 'Employee not found', request.requestId));
    }
    const { holidays, total, context } = await resolveEmployeeHolidays(prisma, tenantId, {
      employeeId: id, year: yearOf(request),
    });
    reply.code(200).send(successResponse(
      { holidays, total, year: yearOf(request), context }, { cached: false },
    ));
  } catch (error) {
    reply.code(500).send(errorResponse('RESOLVE_ERROR', error.message, request.requestId));
  }
}
