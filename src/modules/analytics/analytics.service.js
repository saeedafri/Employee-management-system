import { logger } from '../../utils/logger.js';
import * as repo from './analytics.repository.js';

async function fetchData(fetchFn) {
  try {
    const data = await fetchFn();
    return { data, cached: false };
  } catch (error) {
    logger.error(`Analytics fetch error: ${error.message}`);
    throw error;
  }
}

export async function getSummary(tenantId, filters = {}) {
  const { data, cached } = await fetchData(() => repo.getSummaryData(tenantId, filters));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getAttendance(tenantId, range = '30d', filters = {}) {
  const { data, cached } = await fetchData(() => repo.getAttendanceData(tenantId, range, filters));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getHeadcountByDepartment(tenantId, filters = {}) {
  const { data, cached } = await fetchData(() => repo.getHeadcountByDepartment(tenantId, filters));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getRecentActivity(tenantId, limit = 10, filters = {}) {
  const { data, cached } = await fetchData(() => repo.getRecentActivity(tenantId, limit, filters));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getLeaveSummary(tenantId, range = '30d', filters = {}) {
  const { data, cached } = await fetchData(() => repo.getLeaveSummary(tenantId, range, filters));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getWorkforceTrend(tenantId, range = '6m', filters = {}) {
  const { data } = await fetchData(() => repo.getWorkforceTrend(tenantId, range, filters));
  return { success: true, data, meta: { generatedAt: new Date().toISOString() } };
}

export async function getAttrition(tenantId, range = '6m', filters = {}) {
  const { data } = await fetchData(() => repo.getAttrition(tenantId, range, filters));
  return { success: true, data, meta: { generatedAt: new Date().toISOString() } };
}

export async function getPayrollCost(tenantId, range = '6m', filters = {}) {
  const { data } = await fetchData(() => repo.getPayrollCost(tenantId, range, filters));
  return { success: true, data, meta: { generatedAt: new Date().toISOString() } };
}

export async function getDepartmentPerformance(tenantId, range = '30d', managerEmployeeId = null, filters = {}) {
  const { data } = await fetchData(() => repo.getDepartmentPerformance(tenantId, range, managerEmployeeId, filters));
  return { success: true, data, meta: { generatedAt: new Date().toISOString() } };
}

export async function invalidateAnalyticsCache(tenantId) {
  logger.info(`Cache invalidation skipped (Redis not available for tenant ${tenantId})`);
}
