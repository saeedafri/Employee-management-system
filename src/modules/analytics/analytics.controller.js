import * as analyticsService from './analytics.service.js';
import * as analyticsValidator from './analytics.validator.js';

function extractFilters(query) {
  return {
    departmentId: query.departmentId || null,
    from: query.from || null,
    to: query.to || null,
  };
}

export async function getSummary(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const q = await analyticsValidator.summaryQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getSummary(tenantId, extractFilters(q));
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getAttendance(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const q = await analyticsValidator.attendanceQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getAttendance(tenantId, q.range || '30d', extractFilters(q));
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getHeadcountByDepartment(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const q = await analyticsValidator.headcountQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getHeadcountByDepartment(tenantId, extractFilters(q));
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getRecentActivity(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const q = await analyticsValidator.recentActivityQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getRecentActivity(tenantId, q.limit || 10, extractFilters(q));
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getLeaveSummary(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const q = await analyticsValidator.leaveSummaryQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getLeaveSummary(tenantId, q.range || '30d', extractFilters(q));
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getWorkforceTrend(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const range = ['6m', '12m', '2y'].includes(request.query.range) ? request.query.range : '6m';
    const result = await analyticsService.getWorkforceTrend(tenantId, range, extractFilters(request.query));
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getAttrition(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const range = ['6m', '12m', '2y'].includes(request.query.range) ? request.query.range : '6m';
    const result = await analyticsService.getAttrition(tenantId, range, extractFilters(request.query));
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getPayrollCost(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const range = ['6m', '12m'].includes(request.query.range) ? request.query.range : '6m';
    const result = await analyticsService.getPayrollCost(tenantId, range, extractFilters(request.query));
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getDepartmentPerformance(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const range = ['30d', '90d'].includes(request.query.range) ? request.query.range : '30d';
    const managerEmployeeId = request.user.memberType === 'MANAGER' ? request.user.employeeId : null;
    const result = await analyticsService.getDepartmentPerformance(tenantId, range, managerEmployeeId, extractFilters(request.query));
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}
