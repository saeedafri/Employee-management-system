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

    // Resolve tenant. Priority:
    //   1. Explicit X-Tenant-Key header (already resolved by resolveTenant middleware)
    //   2. Auto-resolve from email — if an explicit header was NOT supplied or matched no user,
    //      and the email exists in exactly one tenant, use that tenant.
    let tenantId = request.tenant?.id;
    const explicitTenantHeader = !!request.headers['x-tenant-key'];

    const candidateUsers = await prisma.user.findMany({
      where: { email, deletedAt: null },
      select: { tenantId: true },
    });

    if (candidateUsers.length === 0) {
      // No user with this email anywhere — generic 401 (do not leak tenant existence)
      return reply.code(401).send(
        errorResponse('INVALID_CREDENTIALS', 'Invalid credentials', {}, request.id),
      );
    }

    if (!explicitTenantHeader) {
      if (candidateUsers.length === 1) {
        // Single tenant for this email — auto-resolve, no header needed
        tenantId = candidateUsers[0].tenantId;
      } else {
        // Email exists in multiple tenants — caller MUST disambiguate with X-Tenant-Key
        return reply.code(400).send(
          errorResponse(
            'AMBIGUOUS_EMAIL',
            'This email is registered in multiple organizations. Supply X-Tenant-Key header to disambiguate.',
            {},
            request.id,
          ),
        );
      }
    }

    if (!tenantId) {
      return reply.code(400).send(
        errorResponse('TENANT_MISSING', 'Tenant context not found', {}, request.id),
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

    reply.setCookie(
      'accessToken',
      result.accessToken,
      {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: 15 * 60,
        path: '/',
      },
    );

    return reply.send(
      successResponse({
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

    reply.setCookie(
      'accessToken',
      result.accessToken,
      {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: 15 * 60,
        path: '/',
      },
    );

    return reply.send(
      successResponse({
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

function clearAuthCookies(reply) {
  reply.clearCookie('accessToken', { path: '/' });
  reply.clearCookie(config.sessionCookieName, { path: '/' });
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
        errorResponse('INVALID_TOKEN_FORMAT', 'Invalid refresh token format', {}, request.id),
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

    reply.setCookie(
      'accessToken',
      result.accessToken,
      {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: 'strict',
        maxAge: 15 * 60,
        path: '/',
      },
    );

    return reply.send(
      successResponse({
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
