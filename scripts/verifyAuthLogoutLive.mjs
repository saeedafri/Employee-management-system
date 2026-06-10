import { SignJWT } from 'jose';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';

const BASE = process.env.API_BASE || 'https://employee-management-system-2b9q.onrender.com/api/v1';
const TENANT_KEY = process.env.TENANT_KEY || 'acme-corp-001';
const EMAIL = process.env.AUTH_EMAIL || 'superadmin@acme.test';
const PASSWORD = process.env.AUTH_PASSWORD || 'Password123!';
const TENANT_ID = process.env.AUTH_TENANT_ID || 'cmq6w07ue000019wgllf0t5eu';
const OUT_DIR = path.resolve('live-auth-logout-evidence');

fs.mkdirSync(OUT_DIR, { recursive: true });

function parseSetCookies(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map((cookie) => ({
    raw: cookie,
    name: cookie.split('=')[0],
    clears: /Expires=Thu, 01 Jan 1970/i.test(cookie) || /Max-Age=0/i.test(cookie),
  }));
}

async function apiJson(name, url, options = {}) {
  const res = await fetch(url, options);
  let body = null;
  try { body = await res.json(); } catch {}
  return {
    name,
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    setCookies: parseSetCookies(res.headers),
    body,
  };
}

async function login() {
  return apiJson('login', `${BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
}

const secret = new TextEncoder().encode(config.jwtSecret);
const invalidToken = await new SignJWT({ sub: 'test-user', tenantId: TENANT_ID, memberType: 'SUPER_ADMIN' })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('-1s')
  .sign(secret);

const be1 = {
  no_token: await apiJson('be1_no_token', `${BASE}/auth/me`),
  garbage_bearer: await apiJson('be1_garbage_bearer', `${BASE}/auth/me`, {
    headers: { Authorization: 'Bearer garbage-token' },
  }),
  garbage_cookie: await apiJson('be1_garbage_cookie', `${BASE}/auth/me`, {
    headers: { Cookie: 'accessToken=garbage-token' },
  }),
};

const loginRes = await login();
if (loginRes.status !== 200) {
  throw new Error(`login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
}

const accessToken = loginRes.body.data.accessToken;
const refreshCookie = loginRes.setCookies.find((row) => row.name === 'refreshToken')?.raw?.split(';')[0];
const accessCookie = loginRes.setCookies.find((row) => row.name === 'accessToken')?.raw?.split(';')[0];
const fullCookieJar = [accessCookie, refreshCookie].filter(Boolean).join('; ');

const beforeLogout = await apiJson('auth_me_before_logout', `${BASE}/auth/me`, {
  headers: { Cookie: fullCookieJar },
});

const logout = await apiJson('logout', `${BASE}/auth/logout`, {
  method: 'POST',
  headers: { Cookie: fullCookieJar },
});

const afterLogoutFullJar = await apiJson('after_logout_full_cookie_jar', `${BASE}/auth/me`, {
  headers: { Cookie: fullCookieJar },
});

const afterLogoutAccessCookie = await apiJson('after_logout_access_cookie_only', `${BASE}/auth/me`, {
  headers: { Cookie: `accessToken=${accessToken}` },
});

const afterLogoutBearer = await apiJson('after_logout_bearer', `${BASE}/auth/me`, {
  headers: { Authorization: `Bearer ${accessToken}` },
});

const afterLogoutInvalidJwt = await apiJson('after_logout_invalid_jwt', `${BASE}/auth/me`, {
  headers: { Authorization: `Bearer ${invalidToken}` },
});

const login2 = await login();
const freshToken = login2.body?.data?.accessToken;
const freshMe = await apiJson('fresh_login_me', `${BASE}/auth/me`, {
  headers: { Authorization: `Bearer ${freshToken}` },
});

const logoutAll = await apiJson('logout_all', `${BASE}/auth/logout-all`, {
  method: 'POST',
  headers: {
    Cookie: [
      login2.setCookies.find((row) => row.name === 'accessToken')?.raw?.split(';')[0],
      login2.setCookies.find((row) => row.name === 'refreshToken')?.raw?.split(';')[0],
    ].filter(Boolean).join('; '),
  },
});

const afterLogoutAllBearer = await apiJson('after_logout_all_bearer', `${BASE}/auth/me`, {
  headers: { Authorization: `Bearer ${freshToken}` },
});

const report = {
  checkedAt: new Date().toISOString(),
  base: BASE,
  be1,
  be12: {
    login: {
      status: loginRes.status,
      sessionId: loginRes.body?.data?.sessionId || null,
      setCookies: loginRes.setCookies,
    },
    beforeLogout: { status: beforeLogout.status, code: beforeLogout.body?.error?.code || null },
    logout: {
      status: logout.status,
      code: logout.body?.error?.code || null,
      setCookies: logout.setCookies,
    },
    afterLogoutFullJar: { status: afterLogoutFullJar.status, code: afterLogoutFullJar.body?.error?.code || null },
    afterLogoutAccessCookie: { status: afterLogoutAccessCookie.status, code: afterLogoutAccessCookie.body?.error?.code || null },
    afterLogoutBearer: { status: afterLogoutBearer.status, code: afterLogoutBearer.body?.error?.code || null },
    afterLogoutInvalidJwt: { status: afterLogoutInvalidJwt.status, code: afterLogoutInvalidJwt.body?.error?.code || null },
    freshLogin: { status: login2.status, sessionId: login2.body?.data?.sessionId || null },
    freshMe: { status: freshMe.status, code: freshMe.body?.error?.code || null },
    logoutAll: { status: logoutAll.status, setCookies: logoutAll.setCookies },
    afterLogoutAllBearer: { status: afterLogoutAllBearer.status, code: afterLogoutAllBearer.body?.error?.code || null },
  },
};

fs.writeFileSync(path.join(OUT_DIR, 'verify-auth-logout-live.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
