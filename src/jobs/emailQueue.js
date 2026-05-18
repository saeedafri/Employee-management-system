import { Queue } from 'bullmq';
import { createClient } from 'redis';
import { config } from '../config/index.js';

const redisUrl = new URL(config.redisUrl);

export const redisConnection = {
  host: redisUrl.hostname,
  port: parseInt(redisUrl.port, 10) || 6379,
  password: redisUrl.password || undefined,
};

export const emailQueue = new Queue('email', {
  connection: redisConnection,
});

export const redisClient = createClient({
  ...redisConnection,
  password: redisConnection.password,
});

if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'testing') {
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn('⚠️  Redis connection failed. Email queue disabled. Details:', err.message);
  }
}
