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

export async function getSummary(tenantId) {
  const { data, cached } = await fetchData(() => repo.getSummaryData(tenantId));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getAttendance(tenantId, range = '30d') {
  const { data, cached } = await fetchData(() => repo.getAttendanceData(tenantId, range));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getHeadcountByDepartment(tenantId) {
  const { data, cached } = await fetchData(() => repo.getHeadcountByDepartment(tenantId));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getRecentActivity(tenantId, limit = 10) {
  const { data, cached } = await fetchData(() => repo.getRecentActivity(tenantId, limit));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getLeaveSummary(tenantId, range = '30d') {
  const { data, cached } = await fetchData(() => repo.getLeaveSummary(tenantId, range));

  return {
    success: true,
    data,
    meta: {
      cached,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function invalidateAnalyticsCache(tenantId) {
  logger.info(`Cache invalidation skipped (Redis not available for tenant ${tenantId})`);
}
