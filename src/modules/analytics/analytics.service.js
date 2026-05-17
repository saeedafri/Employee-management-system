import { redis } from '../../plugins/redis.js';
import { logger } from '../../utils/logger.js';
import * as repo from './analytics.repository.js';

function getCacheKey(endpoint, tenantId, params = {}) {
  const paramStr = Object.keys(params).length > 0
    ? `:${Object.entries(params).sort().map(([k, v]) => `${k}=${v}`).join('|')}`
    : '';
  return `analytics:${endpoint}:${tenantId}${paramStr}`;
}

async function getCachedOrFetch(cacheKey, fetchFn, ttlSeconds) {
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.debug(`Analytics cache HIT: ${cacheKey}`);
      return { data: JSON.parse(cached), cached: true };
    }

    logger.debug(`Analytics cache MISS: ${cacheKey}`);
    const data = await fetchFn();

    try {
      await redis.setex(cacheKey, ttlSeconds, JSON.stringify(data));
    } catch (cacheErr) {
      logger.warn(`Analytics cache set failed: ${cacheErr.message}`);
    }

    return { data, cached: false };
  } catch (error) {
    logger.error(`Analytics cache error: ${error.message}`);
    const data = await fetchFn();
    return { data, cached: false };
  }
}

export async function getSummary(tenantId) {
  const cacheKey = getCacheKey('summary', tenantId);
  const { data, cached } = await getCachedOrFetch(cacheKey, () => repo.getSummaryData(tenantId), 60);

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
  const cacheKey = getCacheKey('attendance', tenantId, { range });
  const { data, cached } = await getCachedOrFetch(cacheKey, () => repo.getAttendanceData(tenantId, range), 60);

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
  const cacheKey = getCacheKey('headcount-by-department', tenantId);
  const { data, cached } = await getCachedOrFetch(cacheKey, () => repo.getHeadcountByDepartment(tenantId), 300);

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
  const cacheKey = getCacheKey('recent-activity', tenantId, { limit });
  const { data, cached } = await getCachedOrFetch(cacheKey, () => repo.getRecentActivity(tenantId, limit), 30);

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
  const cacheKey = getCacheKey('leave-summary', tenantId, { range });
  const { data, cached } = await getCachedOrFetch(cacheKey, () => repo.getLeaveSummary(tenantId, range), 60);

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
