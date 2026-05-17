import { successResponse, errorResponse } from '../../utils/response.js';
import { config } from '../../config/index.js';
import { prisma } from '../../plugins/prisma.js';
import * as authService from './auth.service.js';
import * as authValidator from './auth.validator.js';

export async function loginController(request, reply) {
  try {
    const body = authValidator.loginSchema.parse(request.body);
    const { email, password } = body;

    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    // Get tenant from request context (set by resolveTenant middleware)
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      return reply.code(400).send(
        errorResponse(
          'TENANT_MISSING',
          'Tenant context not found',
          {},
          request.id,
        ),
      );
    }

    const result = await authService.login(
      prisma,
      tenantId,
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

    // Set refresh token in HttpOnly cookie
    reply.setCookie(
      config.sessionCookieName,
      result.refreshToken,
      {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: config.sessionMaxAgeDays * 24 * 60 * 60,
        path: '/',
      },
    );

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

    // Get tenant from request context (set by resolveTenant middleware)
    const tenantId = request.tenant?.id;
    if (!tenantId) {
      return reply.code(400).send(
        errorResponse(
          'TENANT_MISSING',
          'Tenant context not found',
          {},
          request.id,
        ),
      );
    }

    const result = await authService.adminLogin(
      prisma,
      tenantId,
      email,
      password,
      ipAddress,
      userAgent,
    );

    reply.setCookie(
      config.sessionCookieName,
      result.refreshToken,
      {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: config.sessionMaxAgeDays * 24 * 60 * 60,
        path: '/',
      },
    );

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
    // Get tenant from headers (required for refresh)
    const tenantKey = request.headers['x-tenant-key'];
    if (!tenantKey) {
      return reply.code(400).send(
        errorResponse(
          'TENANT_MISSING',
          'X-Tenant-Key header required',
          {},
          request.id,
        ),
      );
    }

    // Resolve tenant
    const tenant = await prisma.tenant.findUnique({
      where: { tenantKey },
    });
    if (!tenant) {
      return reply.code(400).send(
        errorResponse(
          'INVALID_TENANT',
          'Tenant not found',
          {},
          request.id,
        ),
      );
    }

    // Get refresh token from cookie
    const opaqueRefreshToken = request.cookies[config.sessionCookieName];
    if (!opaqueRefreshToken) {
      return reply.code(401).send(
        errorResponse(
          'REFRESH_TOKEN_MISSING',
          'Refresh token not found in cookies',
          {},
          request.id,
        ),
      );
    }

    // Parse opaque refresh token format: sessionId.rawRefreshToken
    const parts = opaqueRefreshToken.split('.');
    if (parts.length !== 2) {
      return reply.code(401).send(
        errorResponse(
          'INVALID_TOKEN_FORMAT',
          'Invalid refresh token format',
          {},
          request.id,
        ),
      );
    }

    const [sessionId, rawRefreshToken] = parts;

    const result = await authService.refreshAccessToken(
      prisma,
      tenant.id,
      sessionId,
      rawRefreshToken,
    );

    reply.setCookie(
      config.sessionCookieName,
      result.refreshToken,
      {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: config.sessionMaxAgeDays * 24 * 60 * 60,
        path: '/',
      },
    );

    return reply.send(
      successResponse({
        accessToken: result.accessToken,
        sessionId: result.sessionId,
      }),
    );
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function logoutController(request, reply) {
  try {
    const { sub: userId, sessionId } = request.user;
    await authService.logout(prisma, userId, sessionId);

    reply.clearCookie(config.sessionCookieName);
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

    reply.clearCookie(config.sessionCookieName);
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
