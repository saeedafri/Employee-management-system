import fastifyCors from '@fastify/cors';
import { config } from '../config/index.js';

export async function corsPlugin(fastify) {
  await fastify.register(fastifyCors, {
    origin: config.corsOrigin,
    credentials: true,
  });
}
