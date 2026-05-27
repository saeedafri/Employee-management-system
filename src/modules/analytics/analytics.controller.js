import * as analyticsService from './analytics.service.js';
import * as analyticsValidator from './analytics.validator.js';

export async function getSummary(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    await analyticsValidator.summaryQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getSummary(tenantId);
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getAttendance(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const { range } = await analyticsValidator.attendanceQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getAttendance(tenantId, range || '30d');
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getHeadcountByDepartment(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    await analyticsValidator.headcountQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getHeadcountByDepartment(tenantId);
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getRecentActivity(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const { limit } = await analyticsValidator.recentActivityQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getRecentActivity(tenantId, limit || 10);
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getLeaveSummary(request, reply) {
  try {
    const { id: tenantId } = request.tenant;
    const { range } = await analyticsValidator.leaveSummaryQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getLeaveSummary(tenantId, range || '30d');
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
    const result = await analyticsService.getWorkforceTrend(tenantId, range);
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
    const result = await analyticsService.getAttrition(tenantId, range);
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
    const result = await analyticsService.getPayrollCost(tenantId, range);
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
    const result = await analyticsService.getDepartmentPerformance(tenantId, range, managerEmployeeId);
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}
