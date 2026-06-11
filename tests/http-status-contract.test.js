/**
 * HTTP Status Code Contract Tests
 * Run: node --test tests/http-status-contract.test.js
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const BASE = process.env.BASE || 'https://employee-management-system-2b9q.onrender.com/api/v1';

async function req(method, path, { body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, json };
}

function cookies(res) {
  return (res.headers.get('set-cookie') || '')
    .split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

async function loginAs(email, password = 'Password123!') {
  const r = await req('POST', '/auth/login', { body: { email, password } });
  return cookies(r);
}

// ── 422 Field validation ───────────────────────────────────────────────────

test('422 — POST /auth/register invalid body', async () => {
  const r = await req('POST', '/auth/register', { body: { companyName: '', fullName: '', email: 'bad', password: '' } });
  assert.equal(r.status, 422);
  assert.equal(r.json.error?.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(r.json.error?.details));
});

test('422 — POST /auth/login missing password', async () => {
  const r = await req('POST', '/auth/login', { body: { email: 'x@x.com' } });
  assert.ok(r.status === 422 || r.status === 400, `got ${r.status}`); // login may not use Zod on password
});

test('422 — POST /employees missing required fields', async () => {
  const cookie = await loginAs('hr@acme.test');
  const r = await req('POST', '/employees', { body: { firstName: 'X' }, cookie });
  assert.equal(r.status, 422, `Expected 422, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.equal(r.json.error?.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(r.json.error?.details));
});

test('422 — POST /departments missing required fields', async () => {
  const cookie = await loginAs('hr@acme.test');
  const r = await req('POST', '/departments', { body: {}, cookie });
  assert.equal(r.status, 422, `Expected 422, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.equal(r.json.error?.code, 'VALIDATION_ERROR');
});

// ── 409 Conflict ──────────────────────────────────────────────────────────

test('409 — POST /auth/register duplicate email', async () => {
  const r = await req('POST', '/auth/register', {
    body: { companyName: 'Dup', fullName: 'Admin', email: 'superadmin@acme.test', password: 'Password123!' },
  });
  assert.equal(r.status, 409);
  assert.equal(r.json.error?.code, 'EMAIL_ALREADY_EXISTS');
});

// ── 401 Auth ──────────────────────────────────────────────────────────────

test('401 — GET /auth/me with no token', async () => {
  const r = await req('GET', '/auth/me');
  assert.equal(r.status, 401);
});

test('401 — GET /auth/me with garbage token', async () => {
  const r = await req('GET', '/auth/me', { cookie: 'accessToken=garbage.token.here' });
  assert.equal(r.status, 401);
});

// ── 403 Forbidden ─────────────────────────────────────────────────────────

test('403 — POST /employees as EMPLOYEE role', async () => {
  const cookie = await loginAs('priya@acme.test');
  const r = await req('POST', '/employees', { body: { firstName: 'Test', lastName: 'User', workEmail: 't@t.com', joinedOn: '2024-01-01' }, cookie });
  assert.equal(r.status, 403, `Expected 403, got ${r.status}`);
});

// ── 404 Not found ─────────────────────────────────────────────────────────

test('404 — GET /employees/:id with unknown id', async () => {
  const cookie = await loginAs('hr@acme.test');
  const r = await req('GET', '/employees/nonexistentid123456', { cookie });
  assert.ok(r.status === 404 || r.status === 400, `got ${r.status}`);
});

// ── 200/201 Success ───────────────────────────────────────────────────────

test('200 — GET /auth/me with valid cookie', async () => {
  const cookie = await loginAs('hr@acme.test');
  const r = await req('GET', '/auth/me', { cookie });
  assert.equal(r.status, 200);
  assert.equal(r.json.success, true);
});

test('201 — POST /auth/register success', async () => {
  const email = `contract-test-${Date.now()}@test.com`;
  const r = await req('POST', '/auth/register', {
    body: { companyName: `Contract Test ${Date.now()}`, fullName: 'Admin', email, password: 'Password123!' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.data?.user?.memberType, 'SUPER_ADMIN');
});

// ── 400 Malformed ─────────────────────────────────────────────────────────

test('400 — POST with malformed JSON', async () => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.ok(res.status === 400 || res.status === 422, `got ${res.status}`);
});
