import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const TENANT_KEY = 'acme-corp-001';
const PASSWORD = 'Password123!';

let app;

test.before(async () => {
  app = await createApp();
  await app.ready();
});

test.after(async () => {
  if (app) await app.close();
});

function cookieHeader(response) {
  const rows = response.headers['set-cookie'];
  assert.ok(Array.isArray(rows), 'expected Set-Cookie headers');
  return rows.map((row) => row.split(';')[0]).join('; ');
}

async function login(email) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: { email, password: PASSWORD },
  });
  assert.equal(response.statusCode, 200);
  return cookieHeader(response);
}

const legacyReportPaths = [
  '/api/v1/reports/attendance',
  '/api/v1/reports/leaves',
  '/api/v1/reports/payroll',
];

test('legacy reports enforce HR/SUPER_ADMIN server-side', async () => {
  const employeeCookie = await login('priya@acme.test');

  for (const path of legacyReportPaths) {
    const response = await app.inject({
      method: 'GET',
      url: path,
      headers: { cookie: employeeCookie },
    });
    assert.equal(response.statusCode, 403, `${path} should reject EMPLOYEE`);
    const body = response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  }
});

test('legacy reports remain available to HR_ADMIN', async () => {
  const hrCookie = await login('hr@acme.test');

  for (const path of legacyReportPaths) {
    const response = await app.inject({
      method: 'GET',
      url: path,
      headers: { cookie: hrCookie },
    });
    assert.equal(response.statusCode, 200, `${path} should allow HR_ADMIN`);
    assert.equal(response.json().success, true);
  }
});
