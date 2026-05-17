import Fastify from 'fastify';
import cookiePlugin from '@fastify/cookie';
import { config } from './config/index.js';
import prismaPlugin from './plugins/prisma.js';
import { swaggerPlugin } from './plugins/swagger.js';
import { corsPlugin } from './plugins/cors.js';
import { helmetPlugin } from './plugins/helmet.js';
import { rateLimitPlugin } from './plugins/rateLimit.js';
import { requestIdPlugin } from './plugins/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';

export async function createApp() {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: config.isDevelopment
        ? {
          target: 'pino-pretty',
          options: { colorize: true },
        }
        : undefined,
    },
  });

  // Register plugins
  await fastify.register(requestIdPlugin);
  await fastify.register(cookiePlugin);
  await fastify.register(prismaPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(helmetPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(swaggerPlugin);

  // Global error handler
  fastify.setErrorHandler(errorHandler);

  // Register routes
  fastify.register(
    async (fastify) => {
      fastify.register(authRoutes);
    },
    { prefix: config.apiPrefix },
  );

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  return fastify;
}
