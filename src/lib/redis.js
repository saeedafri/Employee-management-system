// Redis connectivity for the async stack (BullMQ) + hot-config caching.
// Graceful degradation: if REDIS_URL is unset everything no-ops and callers fall
// back to synchronous behaviour, so the app still boots without Redis.
import IORedis from 'ioredis';
import { logger } from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || null;

export const redisEnabled = !!REDIS_URL;

let cacheClient = null;
let warned = false;

/** Shared client for caching (lazy). Null when Redis is disabled. */
export function getRedis() {
  if (!REDIS_URL) return null;
  if (!cacheClient) {
    cacheClient = new IORedis(REDIS_URL, { maxRetriesPerRequest: 3, enableOfflineQueue: true });
    cacheClient.on('error', (e) => {
      if (!warned) { warned = true; logger.error({ err: e.message }, '[redis] cache client error'); }
    });
  }
  return cacheClient;
}

/** BullMQ requires a dedicated connection with maxRetriesPerRequest: null. */
export function createQueueConnection() {
  if (!REDIS_URL) return null;
  return new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
}

/** JSON cache get; returns null on miss/disabled/error (never throws). */
export async function cacheGet(key) {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

/** JSON cache set with TTL seconds; no-op on disabled/error (never throws). */
export async function cacheSet(key, value, ttlSec = 300) {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), 'EX', ttlSec);
  } catch {
    /* ignore cache write failures */
  }
}

/** Delete keys by exact name (best-effort cache invalidation). */
export async function cacheDel(...keys) {
  const r = getRedis();
  if (!r || keys.length === 0) return;
  try {
    await r.del(...keys);
  } catch {
    /* ignore */
  }
}

/** Delete all keys starting with `prefix` (SCAN-based; best-effort, never throws). */
export async function cacheDelByPrefix(prefix) {
  const r = getRedis();
  if (!r || !prefix) return;
  try {
    let cursor = '0';
    do {
      const [next, keys] = await r.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
      cursor = next;
      if (keys.length) await r.del(...keys);
    } while (cursor !== '0');
  } catch {
    /* ignore invalidation failures */
  }
}
