import { randomUUID } from 'crypto';
import fp from 'fastify-plugin';

export const requestIdPlugin = fp(async function requestIdPlugin(fastify) {
  fastify.addHook('onRequest', async (request, reply) => {
    request.id = request.headers['x-request-id'] || randomUUID();
    request.requestId = request.id;
    reply.header('x-request-id', request.id);
  });
});
