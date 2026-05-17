import { authenticate } from '../../middleware/authenticate.js';
import * as authController from './auth.controller.js';

export default async function authRoutes(fastify) {
  fastify.post('/auth/login', {
    schema: {
      tags: ['Authentication'],
      description: 'Login with email and password',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => authController.loginController(request, reply));

  fastify.post('/auth/admin/login', {
    schema: {
      tags: ['Authentication'],
      description: 'Admin login - restricted to HR_ADMIN and SUPER_ADMIN',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => authController.adminLoginController(request, reply));

  fastify.post('/auth/refresh', {
    schema: {
      tags: ['Authentication'],
      description: 'Refresh access token using refresh token from cookie',
    },
  }, async (request, reply) => authController.refreshController(request, reply));

  fastify.post('/auth/logout', {
    schema: {
      tags: ['Authentication'],
      description: 'Logout and revoke current session',
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate],
  }, async (request, reply) => authController.logoutController(request, reply));

  fastify.post('/auth/logout-all', {
    schema: {
      tags: ['Authentication'],
      description: 'Logout from all sessions',
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate],
  }, async (request, reply) => authController.logoutAllController(request, reply));

  fastify.get('/auth/me', {
    schema: {
      tags: ['Authentication'],
      description: 'Get current user profile',
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate],
  }, async (request, reply) => authController.getMeController(request, reply));

  fastify.get('/auth/sessions', {
    schema: {
      tags: ['Authentication'],
      description: 'List all user sessions',
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate],
  }, async (request, reply) => authController.getSessionsController(request, reply));

  fastify.delete('/auth/sessions/:sessionId', {
    schema: {
      tags: ['Authentication'],
      description: 'Revoke specific session',
      params: {
        type: 'object',
        required: ['sessionId'],
        properties: {
          sessionId: { type: 'string' },
        },
      },
      security: [{ Bearer: [] }],
    },
    onRequest: [authenticate],
  }, async (request, reply) => authController.revokeSessionController(request, reply));
}
