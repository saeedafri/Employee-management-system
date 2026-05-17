import { logger } from '../../utils/logger.js';
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
    const filters = await analyticsValidator.summaryQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getSummary(tenantId, filters);

    return reply.send(result);
  } catch (error) {
    logger.error(`Analytics summary error: ${error.message}`);
    throw error;
  }
}

export async function getAttendance(request, reply) {
  try {
    requireAnalyticsRole(request.user.memberType);

    const { id: tenantId } = request.tenant;
    const filters = await analyticsValidator.attendanceQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getAttendance(tenantId, filters);

    return reply.send(result);
  } catch (error) {
    logger.error(`Analytics attendance error: ${error.message}`);
    throw error;
  }
}

export async function getHeadcountByDepartment(request, reply) {
  try {
    requireAnalyticsRole(request.user.memberType);

    const { id: tenantId } = request.tenant;
    const filters = await analyticsValidator.headcountQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getHeadcountByDepartment(tenantId, filters);

    return reply.send(result);
  } catch (error) {
    logger.error(`Analytics headcount error: ${error.message}`);
    throw error;
  }
}

export async function getRecentActivity(request, reply) {
  try {
    requireAnalyticsRole(request.user.memberType);

    const { id: tenantId } = request.tenant;
    const filters = await analyticsValidator.recentActivityQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getRecentActivity(tenantId, filters);

    return reply.send(result);
  } catch (error) {
    logger.error(`Analytics recent activity error: ${error.message}`);
    throw error;
  }
}

export async function getLeaveSummary(request, reply) {
  try {
    requireAnalyticsRole(request.user.memberType);

    const { id: tenantId } = request.tenant;
    const filters = await analyticsValidator.leaveSummaryQuerySchema.parseAsync(request.query);

    const result = await analyticsService.getLeaveSummary(tenantId, filters);

    return reply.send(result);
  } catch (error) {
    logger.error(`Analytics leave summary error: ${error.message}`);
    throw error;
  }
}
