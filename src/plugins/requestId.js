import { randomUUID } from 'crypto';

export async function requestIdPlugin(fastify) {
  fastify.addHook('onRequest', async (request, _reply) => {
    request.id = request.headers['x-request-id'] || randomUUID();
  });
}
