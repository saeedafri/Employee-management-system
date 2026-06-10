import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import { createAccessToken } from '../src/utils/token.js';

const LOGIN_EMAIL = 'superadmin@acme.test';
const LOGIN_PASSWORD = 'Password123!';
const TENANT_KEY = 'acme-corp-001';

let app;
let tenant;

test.before(async () => {
  tenant = await prisma.tenant.findUnique({
    where: { tenantKey: TENANT_KEY },
    select: { id: true, tenantKey: true },
  });

  assert.ok(tenant, `Seed tenant ${TENANT_KEY} must exist for auth tests`);

  app = await createApp();
  await app.ready();
});

test.after(async () => {
  if (app) await app.close();
});

test('GET /auth/me without cookie or Authorization returns 401 UNAUTHORIZED', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error.code, 'UNAUTHORIZED');
});

test('GET /auth/me with garbage Authorization token returns 401', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      authorization: 'Bearer not-a-jwt',
    },
  });

  assert.equal(res.statusCode, 401);
  assert.match(res.json().error.code, /^(INVALID_TOKEN|UNAUTHORIZED)$/);
});

test('GET /auth/me with garbage accessToken cookie returns 401', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      cookie: 'accessToken=not-a-jwt',
    },
  });

  assert.equal(res.statusCode, 401);
  assert.match(res.json().error.code, /^(INVALID_TOKEN|UNAUTHORIZED)$/);
});

test('GET /auth/me with well-formed but invalid JWT returns 401 INVALID_TOKEN', async () => {
  const expiredToken = await createAccessToken(
    { sub: 'test-user', tenantId: tenant.id, memberType: 'SUPER_ADMIN' },
    '-1s',
  );

  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      authorization: `Bearer ${expiredToken}`,
    },
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.json().error.code, 'INVALID_TOKEN');
});

test('GET /auth/me with invalid explicit tenant key still returns 400 INVALID_TENANT', async () => {
  const res = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      'x-tenant-key': 'definitely-not-real',
    },
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error.code, 'INVALID_TENANT');
});

test('POST /auth/login with x-tenant-key still returns token', async () => {
  const res = await app.inject({
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

  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.success, true);
  assert.ok(body.data?.accessToken);
});

test('GET /auth/me with valid login token still returns 200', async () => {
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
  const accessToken = loginRes.json().data.accessToken;
  assert.ok(accessToken);

  const meRes = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(meRes.statusCode, 200);
  assert.equal(meRes.json().success, true);
  assert.equal(meRes.json().data.email, LOGIN_EMAIL);
});
