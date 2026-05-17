import { authenticate } from '../../middleware/authenticate.js';
import * as authController from './auth.controller.js';
import * as passwordResetController from './passwordReset.controller.js';

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

  fastify.post('/auth/forgot-password', {
    schema: {
      tags: ['Password Reset'],
      description: 'Request password reset link - always returns 202 regardless of email existence',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
        },
      },
      response: {
        202: {
          type: 'object',
          properties: {
            data: { type: 'null' },
            meta: {
              type: 'object',
              properties: {
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes',
    },
  }, async (request, reply) => passwordResetController.forgotPasswordController(request, reply));

  fastify.get('/auth/validate-reset-token', {
    schema: {
      tags: ['Password Reset'],
      description: 'Validate reset token before allowing password change',
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                valid: { type: 'boolean' },
                expiresAt: { type: 'string', format: 'date-time' },
                emailMasked: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => passwordResetController.validateResetTokenController(request, reply));

  fastify.post('/auth/reset-password', {
    schema: {
      tags: ['Password Reset'],
      description: 'Reset password using valid reset token',
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string' },
          newPassword: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes',
    },
  }, async (request, reply) => passwordResetController.resetPasswordController(request, reply));
}
