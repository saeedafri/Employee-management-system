import * as analyticsService from './analytics.service.js';
import * as analyticsValidator from './analytics.validator.js';

function requireAnalyticsRole(memberType) {
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType)) {
    const error = new Error('Analytics access restricted to HR admins');
    error.code = 'FORBIDDEN';
    error.statusCode = 403;
    throw error;
  }
}

export async function getSummary(request, reply) {
  try {
    requireAnalyticsRole(request.user.memberType);

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
    requireAnalyticsRole(request.user.memberType);

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
    requireAnalyticsRole(request.user.memberType);

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
    requireAnalyticsRole(request.user.memberType);

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
    requireAnalyticsRole(request.user.memberType);

    const { id: tenantId } = request.tenant;
    const { range } = await analyticsValidator.leaveSummaryQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getLeaveSummary(tenantId, range || '30d');
    return reply.send(result);
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}
