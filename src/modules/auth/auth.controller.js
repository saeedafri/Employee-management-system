import { successResponse, errorResponse } from '../../utils/response.js';
import { config } from '../../config/index.js';
import { prisma } from '../../plugins/prisma.js';
import * as authService from './auth.service.js';
import * as authValidator from './auth.validator.js';
import * as settingsService from '../settings/settings.service.js';
import {
  clearAuthCookies,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from './auth.cookies.js';

async function resolveLoginTenantId(request, reply, email) {
  // Resolve tenant. Priority:
  //   1. Explicit X-Tenant-Key header (already resolved by resolveTenant middleware)
  //   2. Auto-resolve from email when the email exists in exactly one tenant.
  let tenantId = request.tenant?.id;
  const explicitTenantHeader = !!request.headers['x-tenant-key'];

  const candidateUsers = await prisma.user.findMany({
    where: { email, deletedAt: null },
    select: { tenantId: true },
  });

  if (candidateUsers.length === 0) {
    return {
      response: reply.code(401).send(
        errorResponse('INVALID_CREDENTIALS', 'Invalid credentials', {}, request.id),
      ),
    };
  }

  if (!explicitTenantHeader) {
    if (candidateUsers.length === 1) {
      tenantId = candidateUsers[0].tenantId;
    } else {
      return {
        response: reply.code(400).send(
          errorResponse(
            'AMBIGUOUS_EMAIL',
            'This email is registered in multiple organizations. Supply X-Tenant-Key header to disambiguate.',
            {},
            request.id,
          ),
        ),
      };
    }
  }

  if (!tenantId) {
    return {
      response: reply.code(400).send(
        errorResponse('TENANT_MISSING', 'Tenant context not found', {}, request.id),
      ),
    };
  }

  return { tenantId };
}

export async function loginController(request, reply) {
  try {
    const body = authValidator.loginSchema.parse(request.body);
    const { email, password } = body;

    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    const tenantResolution = await resolveLoginTenantId(request, reply, email);
    if (tenantResolution.response) return tenantResolution.response;

    const result = await authService.login(
      prisma,
      tenantResolution.tenantId,
      email,
      password,
      ipAddress,
      userAgent,
    );

    // If MFA is required, return MFA challenge without access token
    if (result.mfaRequired) {
      return reply.code(202).send(
        successResponse({
          mfaRequired: true,
          challengeId: result.challengeId,
          destinationMasked: result.destinationMasked,
          expiresIn: result.expiresIn,
        }),
      );
    }

    setRefreshTokenCookie(reply, result.refreshToken);
    setAccessTokenCookie(reply, result.accessToken);

    return reply.send(
      successResponse({
        accessToken: result.accessToken,
        sessionId: result.sessionId,
        user: result.user,
        permissions: result.permissions,
      }),
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function adminLoginController(request, reply) {
  try {
    const body = authValidator.adminLoginSchema.parse(request.body);
    const { email, password } = body;

    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    const tenantResolution = await resolveLoginTenantId(request, reply, email);
    if (tenantResolution.response) return tenantResolution.response;

    const result = await authService.adminLogin(
      prisma,
      tenantResolution.tenantId,
      email,
      password,
      ipAddress,
      userAgent,
    );

    setRefreshTokenCookie(reply, result.refreshToken);
    setAccessTokenCookie(reply, result.accessToken);

    return reply.send(
      successResponse({
        accessToken: result.accessToken,
        sessionId: result.sessionId,
        user: result.user,
        permissions: result.permissions,
      }),
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function refreshController(request, reply) {
  try {
    const opaqueRefreshToken = request.cookies[config.sessionCookieName];
    if (!opaqueRefreshToken) {
      clearAuthCookies(reply);
      return reply.code(401).send(
        errorResponse('REFRESH_TOKEN_MISSING', 'Refresh token not found in cookies', {}, request.id),
      );
    }

    const parts = opaqueRefreshToken.split('.');
    if (parts.length !== 2) {
      clearAuthCookies(reply);
      return reply.code(401).send(
        errorResponse('INVALID_SESSION', 'Invalid refresh session', {}, request.id),
      );
    }

    const [sessionId, rawRefreshToken] = parts;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { tenantId: true },
    });
    if (!session) {
      clearAuthCookies(reply);
      return reply.code(401).send(
        errorResponse('INVALID_SESSION', 'Session not found', {}, request.id),
      );
    }

    const result = await authService.refreshAccessToken(
      prisma,
      session.tenantId,
      sessionId,
      rawRefreshToken,
    );

    setRefreshTokenCookie(reply, result.refreshToken);
    setAccessTokenCookie(reply, result.accessToken);

    return reply.send(
      successResponse({
        accessToken: result.accessToken,
        sessionId: result.sessionId,
      }),
    );
  } catch (error) {
    request.log.error(error);
    // Token mismatch / reuse / expired → clear both cookies so the browser
    // treats the user as logged out immediately.
    const authErrors = ['TOKEN_REUSE', 'SESSION_EXPIRED', 'SESSION_NOT_FOUND', 'INVALID_SESSION', 'TENANT_MISMATCH'];
    if (error.code && authErrors.includes(error.code)) {
      clearAuthCookies(reply);
      return reply.code(401).send(
        errorResponse(error.code, error.message, {}, request.id),
      );
    }
    throw error;
  }
}

export async function logoutController(request, reply) {
  try {
    const { sub: userId, sessionId } = request.user;
    await authService.logout(prisma, userId, sessionId);

    clearAuthCookies(reply);
    return reply.send(successResponse({ message: 'Logged out successfully' }));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function logoutAllController(request, reply) {
  try {
    const { sub: userId, sessionId } = request.user;
    await authService.logoutAll(prisma, userId, sessionId);

    clearAuthCookies(reply);
    return reply.send(
      successResponse({ message: 'Logged out from all devices' }),
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getMeController(request, reply) {
  try {
    const { sub: userId } = request.user;
    const user = await authService.getCurrentUser(prisma, userId);
    return reply.send(successResponse(user));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getSessionsController(request, reply) {
  try {
    const { sub: userId } = request.user;
    const sessions = await authService.getUserSessions(prisma, userId);
    return reply.send(
      successResponse(sessions, { count: sessions.length }),
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getPasswordPolicyController(request, reply) {
  try {
    const policy = await settingsService.getPublicPasswordPolicy(request.tenant?.id ?? null);
    return reply.send(successResponse(policy));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function registerController(request, reply) {
  if (request.validationError) {
    const details = request.validationError.validation.map((v) => ({
      field: v.instancePath ? v.instancePath.replace(/^\//, '').replace(/\//g, '.') : (v.params?.missingProperty || 'unknown'),
      message: v.message,
    }));
    return reply.code(422).send({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
        requestId: request.id,
      },
    });
  }

  try {
    const body = authValidator.registerSchema.parse(request.body);
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await authService.register(prisma, body, ipAddress, userAgent);

    setRefreshTokenCookie(reply, result.refreshToken);
    setAccessTokenCookie(reply, result.accessToken);

    return reply.code(201).send(
      successResponse({
        accessToken: result.accessToken,
        sessionId: result.sessionId,
        tenant: result.tenant,
        user: result.user,
        permissions: result.permissions,
      }),
    );
  } catch (error) {
    if (error.code === 'EMAIL_ALREADY_EXISTS') {
      return reply.code(409).send({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    if (error.code === 'TENANT_ALREADY_EXISTS') {
      return reply.code(409).send({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }
    if (error.name === 'ZodError') {
      return reply.code(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
        },
      });
    }
    request.log.error(error);
    throw error;
  }
}

export async function revokeSessionController(request, reply) {
  try {
    const { sub: userId } = request.user;
    const { sessionId } = request.params;

    await authService.revokeSpecificSession(
      prisma,
      userId,
      sessionId,
    );

    return reply.send(
      successResponse({ message: 'Session revoked successfully' }),
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}
