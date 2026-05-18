import { Queue } from 'bullmq';
import { createClient } from 'redis';
import { config } from '../config/index.js';

const redisUrl = new URL(config.redisUrl);

export const redisConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port, 10) || 6379,
  password: redisUrl.password || undefined,
};

export const exportQueue = new Queue('export', {
  connection: redisConnection,
});

export const redisClient = createClient({
  ...redisConnection,
  password: redisConnection.password,
});

if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'testing') {
  await redisClient.connect();
}
