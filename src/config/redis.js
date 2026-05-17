import Redis from 'ioredis';
import { config } from './index.js';

export const redis = new Redis(config.redisUrl);

// Redis connection events handled silently - errors will be thrown to callers
redis.on('connect', () => {
  // Connection established
});

redis.on('error', () => {
  // Error handling by caller
});
