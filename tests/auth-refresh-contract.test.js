import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';

const LOGIN_EMAIL = 'superadmin@acme.test';
const LOGIN_PASSWORD = 'Password123!';
const TENANT_KEY = 'acme-corp-001';

let app;

test.before(async () => {
  app = await createApp();
  await app.ready();
});

test.after(async () => {
  if (app) await app.close();
});

function cookieValue(setCookieHeader, name) {
  const row = setCookieHeader.find((entry) => entry.startsWith(`${name}=`));
  if (!row) return null;
  return row.split(';')[0].slice(name.length + 1);
}

function cookieCleared(setCookieHeader, name) {
  const row = setCookieHeader.find((entry) => entry.startsWith(`${name}=`));
  if (!row) return false;
  return /Expires=Thu, 01 Jan 1970/i.test(row) || /Max-Age=0/i.test(row);
}

async function login() {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    },
  });

  assert.equal(response.statusCode, 200);
  const setCookie = response.headers['set-cookie'];
  assert.ok(Array.isArray(setCookie));

  const body = response.json();
  const refreshToken = cookieValue(setCookie, config.sessionCookieName);
  assert.equal(typeof body.data.accessToken, 'string');
  assert.equal(typeof refreshToken, 'string');

  return {
    accessToken: body.data.accessToken,
    refreshToken,
    sessionId: body.data.sessionId,
  };
}

test('POST /auth/refresh rotates cookies and session id', async () => {
  const initial = await login();

  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: {
      cookie: `${config.sessionCookieName}=${initial.refreshToken}`,
    },
  });

  assert.equal(response.statusCode, 200);

  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.data.accessToken, 'string');
  assert.equal(typeof body.data.sessionId, 'string');
  assert.notEqual(body.data.sessionId, initial.sessionId);
  assert.notEqual(body.data.accessToken, initial.accessToken);

  const setCookie = response.headers['set-cookie'];
  assert.ok(Array.isArray(setCookie));

  const rotatedRefreshToken = cookieValue(setCookie, config.sessionCookieName);
  assert.equal(typeof rotatedRefreshToken, 'string');
  assert.notEqual(rotatedRefreshToken, initial.refreshToken);
  assert.match(cookieValue(setCookie, 'accessToken'), /^eyJ/);

  const reuseResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: {
      cookie: `${config.sessionCookieName}=${initial.refreshToken}`,
    },
  });

  assert.equal(reuseResponse.statusCode, 401);
  assert.equal(reuseResponse.json().error.code, 'TOKEN_REUSE');

  const clearedCookies = reuseResponse.headers['set-cookie'];
  assert.ok(Array.isArray(clearedCookies));
  assert.equal(cookieCleared(clearedCookies, 'accessToken'), true);
  assert.equal(cookieCleared(clearedCookies, config.sessionCookieName), true);
});

test('POST /auth/refresh without refresh cookie clears auth cookies', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'REFRESH_TOKEN_MISSING');

  const clearedCookies = response.headers['set-cookie'];
  assert.ok(Array.isArray(clearedCookies));
  assert.equal(cookieCleared(clearedCookies, 'accessToken'), true);
  assert.equal(cookieCleared(clearedCookies, config.sessionCookieName), true);
});

test('POST /auth/refresh with malformed cookie returns contract error', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/refresh',
    headers: {
      cookie: `${config.sessionCookieName}=not-a-session-token`,
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'INVALID_SESSION');
});
