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

function setCookieRows(response) {
  const rows = response.headers['set-cookie'];
  assert.ok(Array.isArray(rows), 'expected Set-Cookie headers');
  return rows;
}

function cookieRow(rows, name) {
  return rows.find((row) => row.startsWith(`${name}=`));
}

test('POST /auth/login matches frontend contract shape and cookies', async () => {
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

  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.data.accessToken, 'string');
  assert.equal(typeof body.data.sessionId, 'string');
  assert.equal(body.data.user.email, LOGIN_EMAIL);
  assert.equal(body.data.user.memberType, 'SUPER_ADMIN');
  assert.equal(body.data.user.employeeId, null);
  assert.equal(body.data.user.employee, null);
  assert.equal(Array.isArray(body.data.permissions), true);
  assert.equal(typeof body.meta, 'object');

  const rows = setCookieRows(response);
  const accessCookie = cookieRow(rows, 'accessToken');
  const refreshCookie = cookieRow(rows, config.sessionCookieName);

  assert.match(accessCookie, /HttpOnly/i);
  assert.match(accessCookie, /SameSite=Strict/i);
  assert.match(accessCookie, /Max-Age=900/i);

  assert.match(refreshCookie, /HttpOnly/i);
  assert.match(refreshCookie, /SameSite=Strict/i);
  assert.match(refreshCookie, /Max-Age=2592000/i);
});

test('POST /auth/login invalid body returns 422 details[]', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: { email: 'superadmin@acme.test', password: '' },
  });

  assert.equal(response.statusCode, 422);

  const body = response.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.equal(Array.isArray(body.error.details), true);
  assert.ok(body.error.details.some((detail) => detail.field === 'password'));
  assert.equal(typeof body.error.requestId, 'string');
});
