/**
 * POST /auth/register — live endpoint tests
 * Run: node --test tests/auth-register.test.js
 * Requires: BASE env var or defaults to live Render URL
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

const BASE = process.env.BASE || 'https://employee-management-system-2b9q.onrender.com/api/v1';

async function post(path, body, cookieJar) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieJar) headers['Cookie'] = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, headers: res.headers, json };
}

async function get(path, cookieJar) {
  const headers = {};
  if (cookieJar) headers['Cookie'] = cookieJar;
  const res = await fetch(`${BASE}${path}`, { headers });
  const json = await res.json();
  return { status: res.status, headers: res.headers, json };
}

function uniqueEmail() {
  return `qa-reg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@acme-qa.com`;
}

function parseCookies(res) {
  // Extract name=value pairs from Set-Cookie headers, strip attributes
  const raw = res.headers.get('set-cookie') || '';
  return raw
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

test('register new company — 201 with correct shape', async () => {
  const email = uniqueEmail();
  const r = await post('/auth/register', {
    companyName: `QA Corp ${Date.now()}`,
    fullName: 'QA Super Admin',
    email,
    password: 'Password123!',
  });

  assert.equal(r.status, 201, `Expected 201, got ${r.status}: ${JSON.stringify(r.json)}`);
  assert.equal(r.json.success, true);

  const d = r.json.data;
  assert.ok(d.accessToken, 'missing accessToken');
  assert.ok(d.sessionId, 'missing sessionId');

  assert.equal(d.user.email, email);
  assert.equal(d.user.memberType, 'SUPER_ADMIN');
  assert.equal(d.user.employeeId, null);
  assert.equal(d.user.employee, null);

  assert.ok(d.tenant.id, 'missing tenant.id');
  assert.ok(d.tenant.name, 'missing tenant.name');

  const requiredPerms = [
    'employees:read', 'employees:write', 'employees:delete', 'employees:export',
    'departments:read', 'departments:write', 'attendance:read', 'attendance:write',
    'leave:read', 'leave:request', 'leave:approve', 'analytics:read',
    'permissions:manage', 'audit:read',
  ];
  for (const p of requiredPerms) {
    assert.ok(d.permissions.includes(p), `missing permission: ${p}`);
  }
});

test('register sets auth cookies', async () => {
  const r = await post('/auth/register', {
    companyName: `Cookie Corp ${Date.now()}`,
    fullName: 'Cookie Admin',
    email: uniqueEmail(),
    password: 'Password123!',
  });

  assert.equal(r.status, 201);
  const setCookie = parseCookies(r);
  assert.ok(setCookie.includes('accessToken'), 'no accessToken cookie');
  assert.ok(setCookie.includes('refreshToken') || setCookie.includes('refreshtoken') || setCookie.includes('session'), 'no refresh cookie');
});

test('register then /auth/me returns 200 with same user', async () => {
  const email = uniqueEmail();
  const r1 = await post('/auth/register', {
    companyName: `Me Corp ${Date.now()}`,
    fullName: 'Me Admin',
    email,
    password: 'Password123!',
  });

  assert.equal(r1.status, 201);
  const cookieHeader = parseCookies(r1);

  const r2 = await get('/auth/me', cookieHeader);
  assert.equal(r2.status, 200, `Expected 200 from /auth/me, got ${r2.status}: ${JSON.stringify(r2.json)}`);
  assert.equal(r2.json.data.email, email);
  assert.equal(r2.json.data.memberType, 'SUPER_ADMIN');
});

test('duplicate email returns 409 EMAIL_ALREADY_EXISTS', async () => {
  const email = uniqueEmail();
  await post('/auth/register', {
    companyName: `Dup Corp ${Date.now()}`,
    fullName: 'Admin One',
    email,
    password: 'Password123!',
  });

  const r2 = await post('/auth/register', {
    companyName: `Dup Corp 2 ${Date.now()}`,
    fullName: 'Admin Two',
    email,
    password: 'Password123!',
  });

  assert.equal(r2.status, 409, `Expected 409, got ${r2.status}`);
  assert.equal(r2.json.error.code, 'EMAIL_ALREADY_EXISTS');
});

test('no x-tenant-key header required', async () => {
  const email = uniqueEmail();
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName: 'NoHeader Corp', fullName: 'Admin', email, password: 'Password123!' }),
  });
  assert.equal(res.status, 201, `Expected 201 without tenant header, got ${res.status}`);
});

test('missing companyName returns 422', async () => {
  const r = await post('/auth/register', { fullName: 'Admin', email: uniqueEmail(), password: 'Password123!' });
  assert.ok(r.status === 422 || r.status === 400, `Expected 4xx validation, got ${r.status}`);
});

test('invalid email returns 422', async () => {
  const r = await post('/auth/register', { companyName: 'Corp', fullName: 'Admin', email: 'not-an-email', password: 'Password123!' });
  assert.ok(r.status === 422 || r.status === 400, `Expected 4xx validation, got ${r.status}`);
});

test('short password returns 422', async () => {
  const r = await post('/auth/register', { companyName: 'Corp', fullName: 'Admin', email: uniqueEmail(), password: 'abc' });
  assert.ok(r.status === 422 || r.status === 400, `Expected 4xx for weak password, got ${r.status}`);
});
