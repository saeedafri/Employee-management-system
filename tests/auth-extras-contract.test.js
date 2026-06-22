import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const TENANT_KEY = 'acme-corp-001';

let app;

test.before(async () => {
  app = await createApp();
  await app.ready();
});

test.after(async () => {
  if (app) await app.close();
});

test('POST /auth/forgot-password returns contract message in data', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/forgot-password',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      email: 'nobody-for-contract@example.com',
    },
  });

  assert.equal(response.statusCode, 202);
  const body = response.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.data, { message: 'If that email exists, a reset link was sent' });
});

test('POST /auth/reset-password accepts password field from frontend contract', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/reset-password',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      token: 'not-a-real-reset-token',
      password: 'NewPass123!',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'RESET_TOKEN_INVALID');
});

test('POST /auth/reset-password accepts browser contract without tenant header', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/reset-password',
    headers: {
      'content-type': 'application/json',
    },
    payload: {
      token: 'not-a-real-reset-token',
      password: 'NewPass123!',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'RESET_TOKEN_INVALID');
});

test('POST /auth/reset-password keeps legacy newPassword compatibility', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/reset-password',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      token: 'not-a-real-reset-token',
      newPassword: 'NewPass123!',
    },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, 'RESET_TOKEN_INVALID');
});

test('POST /auth/verify-otp accepts code field and rejects otp-only payload', async () => {
  const codeResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-otp',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      challengeId: 'missing-challenge',
      code: '123456',
    },
  });

  assert.equal(codeResponse.statusCode, 400);
  assert.equal(codeResponse.json().error.code, 'OTP_CHALLENGE_NOT_FOUND');

  const otpResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-otp',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      challengeId: 'missing-challenge',
      otp: '123456',
    },
  });

  assert.equal(otpResponse.statusCode, 422);
  assert.equal(otpResponse.json().error.code, 'VALIDATION_ERROR');
  assert.ok(otpResponse.json().error.details.some((detail) => detail.field === 'code'));
});

test('GET /auth/password-policy returns public camelCase password policy', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/password-policy',
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(typeof body.data.minLength, 'number');
  assert.equal(typeof body.data.requireSymbol, 'boolean');
  assert.equal(typeof body.data.requireNumber, 'boolean');
});

test('GET /auth/invitation unknown token returns 200 NOT_FOUND status', async () => {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/invitation?token=definitely-not-real',
    headers: {
      'x-tenant-key': TENANT_KEY,
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'NOT_FOUND');
});
