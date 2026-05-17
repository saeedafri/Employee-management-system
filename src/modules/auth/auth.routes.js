import { authenticate } from '../../middleware/authenticate.js';
import * as authController from './auth.controller.js';

export default async function authRoutes(fastify) {
  // Public routes
  fastify.post('/auth/login', async (request, reply) =>
    authController.loginController(request, reply),
  );

  fastify.post('/auth/admin/login', async (request, reply) =>
    authController.adminLoginController(request, reply),
  );

  // Protected routes
  fastify.post(
    '/auth/refresh',
    { onRequest: [authenticate] },
    async (request, reply) => authController.refreshController(request, reply),
  );

  fastify.post(
    '/auth/logout',
    { onRequest: [authenticate] },
    async (request, reply) => authController.logoutController(request, reply),
  );

  fastify.post(
    '/auth/logout-all',
    { onRequest: [authenticate] },
    async (request, reply) => authController.logoutAllController(request, reply),
  );

  fastify.get(
    '/auth/me',
    { onRequest: [authenticate] },
    async (request, reply) => authController.getMeController(request, reply),
  );

  fastify.get(
    '/auth/sessions',
    { onRequest: [authenticate] },
    async (request, reply) => authController.getSessionsController(request, reply),
  );

  fastify.delete(
    '/auth/sessions/:sessionId',
    { onRequest: [authenticate] },
    async (request, reply) =>
      authController.revokeSessionController(request, reply),
  );
}
