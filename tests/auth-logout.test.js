import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const LOGIN_EMAIL = 'superadmin@acme.test';
const LOGIN_PASSWORD = 'Password123!';
const TENANT_KEY = 'acme-corp-001';

let app;

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
  const loginRes = await app.inject({
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

  assert.equal(loginRes.statusCode, 200);
  const setCookie = loginRes.headers['set-cookie'];
  assert.ok(Array.isArray(setCookie));

  const accessToken = loginRes.json().data.accessToken;
  const refreshToken = cookieValue(setCookie, 'refreshToken');
  const cookieJar = `accessToken=${accessToken}; refreshToken=${refreshToken}`;

  return {
    accessToken,
    refreshToken,
    cookieJar,
  };
}

test.before(async () => {
  app = await createApp();
  await app.ready();
});

test.after(async () => {
  if (app) await app.close();
});

test('logout clears both cookies and immediately revokes old access token', async () => {
  const session = await login();

  const meBefore = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie: session.cookieJar },
  });
  assert.equal(meBefore.statusCode, 200);

  const logoutRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: { cookie: session.cookieJar },
  });

  assert.equal(logoutRes.statusCode, 200);
  const clearedCookies = logoutRes.headers['set-cookie'];
  assert.ok(Array.isArray(clearedCookies));
  assert.equal(cookieCleared(clearedCookies, 'accessToken'), true);
  assert.equal(cookieCleared(clearedCookies, 'refreshToken'), true);

  const oldJar = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie: session.cookieJar },
  });
  assert.equal(oldJar.statusCode, 401);
  assert.equal(oldJar.json().error.code, 'INVALID_TOKEN');

  const oldCookieOnly = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie: `accessToken=${session.accessToken}` },
  });
  assert.equal(oldCookieOnly.statusCode, 401);
  assert.equal(oldCookieOnly.json().error.code, 'INVALID_TOKEN');

  const oldBearer = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  assert.equal(oldBearer.statusCode, 401);
  assert.equal(oldBearer.json().error.code, 'INVALID_TOKEN');

  const fresh = await login();
  const freshMe = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { authorization: `Bearer ${fresh.accessToken}` },
  });
  assert.equal(freshMe.statusCode, 200);
});

test('logout-all revokes all sessions and clears both cookies', async () => {
  const session = await login();

  const logoutAllRes = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout-all',
    headers: { cookie: session.cookieJar },
  });

  assert.equal(logoutAllRes.statusCode, 200);
  const clearedCookies = logoutAllRes.headers['set-cookie'];
  assert.ok(Array.isArray(clearedCookies));
  assert.equal(cookieCleared(clearedCookies, 'accessToken'), true);
  assert.equal(cookieCleared(clearedCookies, 'refreshToken'), true);

  const oldBearer = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { authorization: `Bearer ${session.accessToken}` },
  });
  assert.equal(oldBearer.statusCode, 401);
  assert.equal(oldBearer.json().error.code, 'INVALID_TOKEN');
});
