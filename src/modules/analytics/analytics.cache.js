import { redis } from '../../plugins/redis.js';
import { logger } from '../../utils/logger.js';

export async function getCachedOrFetch(key, fetchFn, ttlSeconds = 3600) {
  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.debug(`Cache HIT for ${key}`);
      return JSON.parse(cached);
    }

    logger.debug(`Cache MISS for ${key}`);
    const result = await fetchFn();

    await redis.setex(key, ttlSeconds, JSON.stringify(result));
    return result;
  } catch (error) {
    logger.error(`Cache error for ${key}:`, error.message);
    // Fallback to fetch without cache
    return await fetchFn();
  }
}

export async function invalidateAnalyticsCache(tenantId, type = null) {
  try {
    const pattern = type
      ? `analytics:${type}:${tenantId}:*`
      : `analytics:*:${tenantId}:*`;

    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Invalidated ${keys.length} cache keys for tenant ${tenantId}`);
    }
  } catch (error) {
    logger.error(`Failed to invalidate cache:`, error.message);
  }
}

export function getCacheKey(endpoint, tenantId, params = {}) {
  const paramStr = Object.keys(params).length > 0
    ? `:${JSON.stringify(params)}`
    : '';
  return `analytics:${endpoint}:${tenantId}${paramStr}`;
}
