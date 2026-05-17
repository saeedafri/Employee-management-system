import { successResponse, errorResponse } from '../../utils/response.js';
import * as analyticsService from './analytics.service.js';
import * as analyticsValidator from './analytics.validator.js';

export async function getDashboardSummary(request, reply) {
  try {
    const { id: tenantId } = request.tenant;

    const data = await analyticsService.getDashboardSummary(tenantId);

    return reply.send(
      successResponse(data, {
        endpoint: 'dashboard-summary',
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getAttendanceAnalytics(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const { startDate, endDate } = await analyticsValidator.attendanceParamsSchema.parseAsync(
      request.query
    );

    const data = await analyticsService.getAttendanceAnalytics(tenantId, {
      startDate,
      endDate,
    });

    return reply.send(
      successResponse(data, {
        endpoint: 'attendance',
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getLeaveAnalytics(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const { year } = await analyticsValidator.leaveParamsSchema.parseAsync(
      request.query
    );

    const data = await analyticsService.getLeaveAnalytics(tenantId, { year });

    return reply.send(
      successResponse(data, {
        endpoint: 'leave',
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getPayrollAnalytics(request, reply) {
  try {
    const { id: tenantId, memberType } = request.tenant;

    // Only SUPER_ADMIN can access payroll analytics
    if (memberType !== 'SUPER_ADMIN') {
      return reply.code(403).send(
        errorResponse(
          'FORBIDDEN',
          'Payroll analytics restricted to SUPER_ADMIN',
          {},
          request.id
        )
      );
    }

    const { month, year } = await analyticsValidator.payrollParamsSchema.parseAsync(
      request.query
    );

    const data = await analyticsService.getPayrollAnalytics(tenantId, {
      month,
      year,
    });

    return reply.send(
      successResponse(data, {
        endpoint: 'payroll',
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getDepartmentAnalytics(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const { departmentId } = await analyticsValidator.departmentParamsSchema.parseAsync(
      request.params
    );

    const data = await analyticsService.getDepartmentAnalytics(tenantId, departmentId);

    return reply.send(
      successResponse(data, {
        endpoint: 'department',
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}
