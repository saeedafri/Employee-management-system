import { successResponse, errorResponse } from '../../utils/response.js';
import { config } from '../../config/index.js';
import * as authService from './auth.service.js';
import * as authValidator from './auth.validator.js';

export async function loginController(request, reply) {
  try {
    const body = authValidator.loginSchema.parse(request.body);
    const { email, password } = body;

    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    // Extract tenantId from request (for now, default to first tenant)
    // In production, this would come from subdomain or header
    const tenantId = ''; // Will be set in seed data

    const result = await authService.login(
      request.server.db,
      tenantId,
      email,
      password,
      ipAddress,
      userAgent,
    );

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
    const tenantId = '';

    const result = await authService.adminLogin(
      request.server.db,
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
    const refreshToken = request.cookies[config.sessionCookieName];
    if (!refreshToken) {
      return reply.code(401).send(
        errorResponse(
          'REFRESH_TOKEN_MISSING',
          'Refresh token not found in cookies',
          {},
          request.id,
        ),
      );
    }

    const { sub: userId, sessionId } = request.user;

    const result = await authService.refreshAccessToken(
      request.server.db,
      userId,
      sessionId,
      refreshToken,
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
    await authService.logout(request.server.db, userId, sessionId);

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
    await authService.logoutAll(request.server.db, userId, sessionId);

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
    const user = await authService.getCurrentUser(request.server.db, userId);
    return reply.send(successResponse(user));
  } catch (error) {
    request.log.error(error);
    throw error;
  }
}

export async function getSessionsController(request, reply) {
  try {
    const { sub: userId } = request.user;
    const sessions = await authService.getUserSessions(request.server.db, userId);
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
      request.server.db,
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
