import fastifyRateLimit from '@fastify/rate-limit';

export async function rateLimitPlugin(fastify) {
  await fastify.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '15 minutes',
    cache: 10000,
  });
}
