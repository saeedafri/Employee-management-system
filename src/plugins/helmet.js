import fastifyHelmet from '@fastify/helmet';

export async function helmetPlugin(fastify) {
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });
}
