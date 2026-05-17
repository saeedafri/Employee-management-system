import { createClient } from 'redis';
import { config } from '../config/index.js';

const redisUrl = new URL(config.redisUrl);

export const redis = createClient({
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port, 10) || 6379,
  password: redisUrl.password || undefined,
});

if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'testing') {
  await redis.connect();
}
