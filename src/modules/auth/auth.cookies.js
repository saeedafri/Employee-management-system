import { config } from '../../config/index.js';

export function authCookieOptions(overrides = {}) {
  return {
    path: '/',
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    ...overrides,
  };
}

export function setRefreshTokenCookie(reply, refreshToken) {
  reply.setCookie(
    config.sessionCookieName,
    refreshToken,
    authCookieOptions({
      maxAge: config.sessionMaxAgeDays * 24 * 60 * 60,
    }),
  );
}

export function setAccessTokenCookie(reply, accessToken) {
  reply.setCookie(
    'accessToken',
    accessToken,
    authCookieOptions({
      maxAge: 15 * 60,
    }),
  );
}

export function clearAuthCookies(reply) {
  const opts = authCookieOptions();
  reply.clearCookie('accessToken', opts);
  reply.clearCookie(config.sessionCookieName, opts);
}
