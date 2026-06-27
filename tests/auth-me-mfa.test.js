// MFA_BACKEND_REQ: GET /auth/me must expose mfaEnabled (and mfaRequiredByPolicy) so
// the FE self-service toggle can render its initial/forced state. Runs against LOCAL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const TENANT = 'acme-corp-001';
let app, token;

test.before(async () => {
  app = await createApp();
  await app.ready();
  const r = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    headers: { 'x-tenant-key': TENANT, 'content-type': 'application/json' },
    payload: { email: 'priya@acme.test', password: 'Password123!' },
  });
  token = r.json().data.accessToken;
});
test.after(async () => { if (app) await app.close(); });

test('GET /auth/me returns mfaEnabled as a boolean (never absent/null)', async () => {
  const r = await app.inject({
    method: 'GET', url: '/api/v1/auth/me',
    headers: { authorization: `Bearer ${token}`, 'x-tenant-key': TENANT },
  });
  assert.equal(r.statusCode, 200);
  const data = r.json().data;
  assert.equal(typeof data.mfaEnabled, 'boolean');
  assert.equal(data.mfaEnabled, false); // priya has not opted in
});

test('GET /auth/me returns mfaRequiredByPolicy as a boolean (policy-only verdict)', async () => {
  const r = await app.inject({
    method: 'GET', url: '/api/v1/auth/me',
    headers: { authorization: `Bearer ${token}`, 'x-tenant-key': TENANT },
  });
  const data = r.json().data;
  assert.equal(typeof data.mfaRequiredByPolicy, 'boolean');
  assert.equal(data.mfaRequiredByPolicy, false); // default policy OPTIONAL → false for EMPLOYEE
});
