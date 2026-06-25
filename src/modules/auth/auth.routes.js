import { authenticate } from '../../middleware/authenticate.js';
import * as authController from './auth.controller.js';
import * as passwordResetController from './passwordReset.controller.js';
import * as otpController from './otp.controller.js';
import * as invitationService from './invitation.service.js';
import { errorResponse } from '../../utils/response.js';

export default async function authRoutes(fastify) {
  fastify.post('/auth/register', {
    attachValidation: true,
    schema: {
      tags: ['Authentication'],
      description: 'Register a new company and create the first SUPER_ADMIN user. Public endpoint — no auth headers required.',
      body: {
        type: 'object',
        required: ['companyName', 'fullName', 'email', 'password'],
        properties: {
          companyName: { type: 'string', minLength: 2 },
          fullName: { type: 'string', minLength: 2 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
        },
      },
      response: {
        201: { type: 'object', additionalProperties: true },
        409: { type: 'object', additionalProperties: true },
        422: { type: 'object', additionalProperties: true },
      },
    },
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes',
    },
  }, async (request, reply) => authController.registerController(request, reply));

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

  fastify.patch('/auth/me/mfa', {
    schema: {
      tags: ['Authentication'],
      description: 'Toggle your own MFA opt-in (contract §6). Under mfa_policy=OPTIONAL this makes "users choose" real. Body { enabled: boolean }.',
      security: [{ Bearer: [] }],
      body: {
        type: 'object',
        required: ['enabled'],
        properties: { enabled: { type: 'boolean' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    onRequest: [authenticate],
  }, async (request, reply) => authController.updateOwnMfaController(request, reply));

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
        200: { type: 'object', additionalProperties: true },
      },
    },
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes',
    },
  }, async (request, reply) => passwordResetController.forgotPasswordController(request, reply));

  fastify.get('/auth/password-policy', {
    schema: {
      tags: ['Authentication'],
      description: 'Get public password policy for set-password and reset-password screens',
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request, reply) => authController.getPasswordPolicyController(request, reply));

  fastify.get('/auth/reset-password/validate', {
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
        200: { type: 'object', additionalProperties: true },
      },
    },
  }, async (request, reply) => passwordResetController.validateResetTokenController(request, reply));

  fastify.get('/auth/validate-reset-token', {
    schema: {
      tags: ['Password Reset'],
      description: 'Validate reset token before allowing password change (deprecated, use /reset-password/validate)',
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
        },
      },
      deprecated: true,
    },
  }, async (request, reply) => passwordResetController.validateResetTokenController(request, reply));

  fastify.post('/auth/reset-password', {
    schema: {
      tags: ['Password Reset'],
      description: 'Reset password using valid reset token',
      body: {
        type: 'object',
        required: ['token'],
        anyOf: [
          { required: ['password'] },
          { required: ['newPassword'] },
        ],
        properties: {
          token: { type: 'string' },
          password: { type: 'string', description: 'Frontend contract field' },
          newPassword: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes',
    },
  }, async (request, reply) => passwordResetController.resetPasswordController(request, reply));

  fastify.post('/auth/otp/initiate', {
    schema: {
      tags: ['OTP Verification'],
      description: 'Send or re-send OTP for an existing challenge (public). Used in forgot-password / MFA flows.',
      body: { type: 'object', required: ['challengeId'], properties: { challengeId: { type: 'string' } } },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request, reply) => {
    const { initiateOtp } = await import('./otp.service.js');
    try {
      const result = await initiateOtp(request.body.challengeId);
      return reply.send({ success: true, data: result, meta: {} });
    } catch (err) {
      return reply.code(err.statusCode || 400).send({ success: false, error: { code: err.code, message: err.message } });
    }
  });

  fastify.post('/auth/verify-otp', {
    schema: {
      tags: ['OTP Verification'],
      description: 'Verify OTP code',
      body: {
        type: 'object',
        required: ['challengeId', 'code'],
        properties: {
          challengeId: { type: 'string' },
          code: { type: 'string', pattern: '^\\d{6}$' },
        },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
    rateLimit: {
      max: 5,
      timeWindow: '5 minutes',
    },
  }, async (request, reply) => otpController.verifyOtpController(request, reply));

  fastify.post('/auth/resend-otp', {
    schema: {
      tags: ['OTP Verification'],
      description: 'Resend OTP code to registered email (no auth required during MFA flow)',
      body: {
        type: 'object',
        required: ['challengeId'],
        properties: {
          challengeId: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
    rateLimit: {
      max: 5,
      timeWindow: '15 minutes',
    },
  }, async (request, reply) => otpController.resendOtpController(request, reply));

  // ── Invitation routes (public) ──────────────────────────────────────────────

  fastify.get('/auth/invitation', {
    schema: {
      tags: ['Invitation'],
      description: 'Validate an invitation token. Always returns 200 — check status field (VALID | EXPIRED | USED | NOT_FOUND).',
      querystring: {
        type: 'object',
        required: ['token'],
        properties: { token: { type: 'string' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
  }, async (request, reply) => {
    const result = await invitationService.validateInvitationToken(request.query.token);
    return reply.send({ success: true, data: result, meta: {} });
  });

  fastify.post('/auth/accept-invitation', {
    schema: {
      tags: ['Invitation'],
      description: 'Accept an invitation: set password and activate the account (INVITED → ACTIVE). Does not auto-login.',
      body: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: { type: 'string' },
          password: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', additionalProperties: true },
        404: { type: 'object', additionalProperties: true },
        409: { type: 'object', additionalProperties: true },
        410: { type: 'object', additionalProperties: true },
        422: { type: 'object', additionalProperties: true },
      },
    },
    rateLimit: { max: 10, timeWindow: '15 minutes' },
  }, async (request, reply) => {
    const { token, password } = request.body;
    const result = await invitationService.acceptInvitation(token, password);

    if (!result.success) {
      const statusMap = {
        INVITE_EXPIRED: 410,
        INVITE_ALREADY_USED: 409,
        INVALID_TOKEN: 404,
        WEAK_PASSWORD: 422,
      };
      const status = statusMap[result.code] ?? 400;
      const message = result.code === 'WEAK_PASSWORD' ? 'Password does not meet policy' : 'Invitation error';
      return reply.code(status).send(errorResponse(result.code, message, result.details ?? {}, request.id));
    }

    return reply.send({ success: true, data: { activated: result.activated }, meta: {} });
  });

  fastify.post('/auth/invitation/resend', {
    schema: {
      tags: ['Invitation'],
      description: 'Public self-serve invite resend. Always returns generic 200 to prevent account enumeration.',
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
      response: { 200: { type: 'object', additionalProperties: true } },
    },
    rateLimit: { max: 5, timeWindow: '15 minutes' },
  }, async (request, reply) => {
    await invitationService.publicResendInvite(request.body.email);
    return reply.send({ success: true, data: { message: 'If an invite exists, a new link was sent' }, meta: {} });
  });
}
