import { redis } from '../../plugins/redis.js';
import { logger } from '../../utils/logger.js';
import * as repo from './analytics.repository.js';

function getCacheKey(endpoint, tenantId, filters = {}) {
  const filterStr = Object.keys(filters).length > 0
    ? `:${Object.entries(filters).sort().map(([k, v]) => `${k}=${v}`).join('|')}`
    : '';
  return `analytics:${endpoint}:${tenantId}${filterStr}`;
}

async function getCachedOrFetch(cacheKey, fetchFn, ttlSeconds) {
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug(`Analytics cache HIT: ${cacheKey}`);
      return JSON.parse(cached);
    }

    logger.debug(`Analytics cache MISS: ${cacheKey}`);
    const result = await fetchFn();

    try {
      await redis.setex(cacheKey, ttlSeconds, JSON.stringify(result));
    } catch (cacheErr) {
      logger.warn(`Analytics cache set failed: ${cacheErr.message}`);
    }

    return result;
  } catch (error) {
    logger.error(`Analytics cache error: ${error.message}`);
    return await fetchFn();
  }
}

export async function getSummary(tenantId, filters = {}) {
  const cacheKey = getCacheKey('summary', tenantId, filters);

  const data = await getCachedOrFetch(cacheKey, () => repo.getSummaryData(tenantId, filters), 60);

  return {
    success: true,
    data,
    meta: {
      cached: false,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getAttendance(tenantId, filters = {}) {
  const cacheKey = getCacheKey('attendance', tenantId, filters);

  const data = await getCachedOrFetch(cacheKey, () => repo.getAttendanceData(tenantId, filters), 60);

  return {
    success: true,
    data,
    meta: {
      cached: false,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getHeadcountByDepartment(tenantId, filters = {}) {
  const cacheKey = getCacheKey('headcount-by-department', tenantId, filters);

  const data = await getCachedOrFetch(cacheKey, () => repo.getHeadcountByDepartment(tenantId, filters), 300);

  return {
    success: true,
    data,
    meta: {
      cached: false,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getRecentActivity(tenantId, filters = {}) {
  const cacheKey = getCacheKey('recent-activity', tenantId, filters);

  const data = await getCachedOrFetch(cacheKey, () => repo.getRecentActivity(tenantId, filters), 30);

  return {
    success: true,
    data,
    meta: {
      cached: false,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function getLeaveSummary(tenantId, filters = {}) {
  const cacheKey = getCacheKey('leave-summary', tenantId, filters);

  const data = await getCachedOrFetch(cacheKey, () => repo.getLeaveSummary(tenantId, filters), 60);

  return {
    success: true,
    data,
    meta: {
      cached: false,
      generatedAt: new Date().toISOString(),
    },
  };
}

export async function invalidateAnalyticsCache(tenantId) {
  try {
    const pattern = `analytics:*:${tenantId}*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Invalidated ${keys.length} analytics cache keys for tenant ${tenantId}`);
    }
  } catch (error) {
    logger.error(`Failed to invalidate analytics cache: ${error.message}`);
  }
}
