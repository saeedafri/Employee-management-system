import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

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

async function login(userAgent) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
      'user-agent': userAgent,
    },
    payload: {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();

  return {
    accessToken: body.data.accessToken,
    sessionId: body.data.sessionId,
  };
}

test('GET /auth/me returns contract user shape', async () => {
  const session = await login('ems-auth-me-contract');

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
    },
  });

  assert.equal(response.statusCode, 200);

  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.email, LOGIN_EMAIL);
  assert.equal(body.data.memberType, 'SUPER_ADMIN');
  assert.equal(body.data.employeeId, null);
  assert.equal(body.data.employee, null);
  assert.equal(body.data.status, 'ACTIVE');
  assert.equal(Array.isArray(body.data.permissions), true);
  assert.equal(typeof body.data.lastLoginAt, 'string');
});

test('GET and DELETE /auth/sessions match frontend contract', async () => {
  const primary = await login('ems-primary-session-contract');
  const secondary = await login('ems-secondary-session-contract');

  const listResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/sessions',
    headers: {
      authorization: `Bearer ${primary.accessToken}`,
    },
  });

  assert.equal(listResponse.statusCode, 200);

  const listBody = listResponse.json();
  assert.equal(listBody.success, true);
  assert.equal(Array.isArray(listBody.data), true);
  assert.equal(listBody.meta.count, listBody.data.length);

  const secondaryRow = listBody.data.find((row) => row.id === secondary.sessionId);
  assert.ok(secondaryRow);
  assert.equal(Object.hasOwn(secondaryRow, 'deviceName'), true);
  assert.equal(typeof secondaryRow.userAgent, 'string');
  assert.equal(typeof secondaryRow.loginAt, 'string');
  assert.equal(typeof secondaryRow.lastSeenAt, 'string');
  assert.equal(typeof secondaryRow.expiresAt, 'string');
  assert.equal(secondaryRow.isRevoked, false);

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/api/v1/auth/sessions/${secondary.sessionId}`,
    headers: {
      authorization: `Bearer ${primary.accessToken}`,
    },
  });

  assert.equal(deleteResponse.statusCode, 200);
  assert.equal(deleteResponse.json().data.message, 'Session revoked successfully');

  const revokedMeResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      authorization: `Bearer ${secondary.accessToken}`,
    },
  });

  assert.equal(revokedMeResponse.statusCode, 401);
  assert.equal(revokedMeResponse.json().error.code, 'INVALID_TOKEN');

  const primaryMeResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      authorization: `Bearer ${primary.accessToken}`,
    },
  });

  assert.equal(primaryMeResponse.statusCode, 200);
});
