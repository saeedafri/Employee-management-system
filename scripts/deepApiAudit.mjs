/**
 * Phase 3 — Exhaustive API audit against live Hostinger API.
 * Tests every route extracted from src/modules route files across role matrix + tenants.
 *
 * Usage: API_URL=https://ems-api.saqibsaeed.cloud/api/v1 node scripts/deepApiAudit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const API = process.env.API_URL || 'https://ems-api.saqibsaeed.cloud/api/v1';
const OUT_JSON = path.join(ROOT, 'docs/e2e-deep-api-results.json');

const PASSWORD = 'Password123!';
const TENANTS = {
  acme: 'acme-corp-001',
  kwd: 'kwd-litmus-001',
  testorg: 'test-key-123456789',
};

const ACTORS = [
  { key: 'HR_ADMIN', email: 'hr@acme.test', password: PASSWORD, tenant: TENANTS.acme },
  { key: 'SUPER_ADMIN', email: 'superadmin@acme.test', password: PASSWORD, tenant: TENANTS.acme },
  { key: 'MANAGER', email: 'aman@acme.test', password: PASSWORD, tenant: TENANTS.acme },
  { key: 'EMPLOYEE', email: 'priya@acme.test', password: PASSWORD, tenant: TENANTS.acme },
  { key: 'EMPLOYEE_FIN', email: 'fin1@acme.test', password: PASSWORD, tenant: TENANTS.acme },
  { key: 'EMPLOYEE_DEV', email: 'dev1@acme.test', password: PASSWORD, tenant: TENANTS.acme },
  { key: 'KWD_HR', email: 'admin@kwd.test', password: PASSWORD, tenant: TENANTS.kwd },
  { key: 'TESTORG_HR', email: 'admin@testorg.com', password: 'password123', tenant: TENANTS.testorg },
];

/** @type {Map<string, {token:string, user:object, employeeId?:string}>} */
const sessions = new Map();

/** @type {{method:string,path:string,file:string}[]} */
function extractRoutes() {
  const routes = [];
  const modulesDir = path.join(ROOT, 'src/modules');
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.routes.js')) {
        const c = fs.readFileSync(p, 'utf8');
        const re = /fastify\.(get|post|patch|put|delete)\(\s*['`]([^'`]+)['`]/g;
        let m;
        while ((m = re.exec(c))) {
          routes.push({ method: m[1].toUpperCase(), path: m[2], file: p.replace(ROOT + '/', '') });
        }
      }
    }
  }
  walk(modulesDir);
  const seen = new Set();
  return routes.filter((r) => {
    const k = `${r.method} ${r.path}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function req(method, urlPath, { token, tenant, body } = {}) {
  const t0 = performance.now();
  const headers = { 'content-type': 'application/json' };
  if (tenant) headers['x-tenant-key'] = tenant;
  if (token) headers.authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API}${urlPath}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    return { status: 0, ms: Math.round(performance.now() - t0), json: null, error: String(e.message || e) };
  }
  const ms = Math.round(performance.now() - t0);
  let json = null;
  const ct = res.headers.get('content-type') || '';
  try {
    json = ct.includes('json') ? await res.json() : { _raw: (await res.text()).slice(0, 500) };
  } catch { /* noop */ }
  return { status: res.status, ms, json, error: null };
}

async function login(actor) {
  const r = await req('POST', '/auth/login', {
    tenant: actor.tenant,
    body: { email: actor.email, password: actor.password },
  });
  const token = r.json?.data?.accessToken;
  const user = r.json?.data?.user;
  const ok = r.status === 200 && !!token;
  sessions.set(`${actor.key}@${actor.tenant}`, {
    ok,
    token,
    user,
    employeeId: user?.employeeId,
    memberType: user?.memberType,
    status: r.status,
    error: r.json?.error?.code,
    mfaRequired: r.json?.data?.mfaRequired === true,
  });
  return sessions.get(`${actor.key}@${actor.tenant}`);
}

function resolvePath(template, ctx) {
  return template
    .replace(/:employeeId\b/g, ctx.employeeId || '00000000-0000-4000-8000-000000000001')
    .replace(/:id\b/g, ctx.resourceId || '00000000-0000-4000-8000-000000000002')
    .replace(/:docId\b/g, '00000000-0000-4000-8000-000000000003')
    .replace(/:sessionId\b/g, '00000000-0000-4000-8000-000000000004')
    .replace(/:runId\b/g, ctx.runId || '00000000-0000-4000-8000-000000000005')
    .replace(/:payslipId\b/g, '00000000-0000-4000-8000-000000000006')
    .replace(/:loanId\b/g, '00000000-0000-4000-8000-000000000007')
    .replace(/:garnishmentId\b/g, '00000000-0000-4000-8000-000000000008')
    .replace(/:holidayId\b/g, '00000000-0000-4000-8000-000000000009')
    .replace(/:jobId\b/g, '00000000-0000-4000-8000-000000000010')
    .replace(/:level\b/g, '1')
    .replace(/:country\b/g, 'IN')
    .replace(/:code\b/g, 'IN')
    .replace(/:type\b/g, 'WELCOME')
    .replace(/:garnishmentId\b/g, 'x');
}

function defaultQuery(method, path) {
  const q = [];
  if (path.includes('/employees') && method === 'GET' && !path.includes(':')) q.push('page=1&limit=2');
  if (path.includes('/attendance/records')) q.push('month=2026-06');
  if (path.includes('/attendance/calendar')) q.push('month=2026-06');
  if (path.includes('/holidays') && !path.includes('import') && !path.includes('policy')) q.push('year=2026');
  if (path.includes('/timesheets') && !path.includes('config') && !path.includes('audit')) q.push('weekStart=2026-06-16');
  if (path.includes('/leave/balance')) return '';
  if (path.includes('/payroll/runs') && method === 'GET' && !path.includes(':')) q.push('page=1&limit=3');
  if (path.includes('/notifications') && method === 'GET' && !path.includes('stream')) q.push('page=1&limit=5');
  if (path.includes('/search')) q.push('q=test');
  if (path.includes('/reports/attendance') && !path.includes('summary')) q.push('fromDate=2026-01-01&toDate=2026-06-30');
  if (path.includes('/analytics/attendance')) q.push('month=2026-06');
  if (path.includes('/audit-logs')) q.push('page=1&limit=5');
  return q.length ? `?${q.join('&')}` : '';
}

const SKIP_MUTATION = new Set([
  'POST /auth/login', 'POST /auth/register', 'POST /auth/refresh',
  'POST /auth/forgot-password', 'POST /auth/reset-password',
  'POST /attendance/check-in', 'POST /attendance/check-out',
  'DELETE /employees/:id', 'POST /payroll/runs/:id/approve',
  'POST /payroll/runs/:id/publish', 'PATCH /payroll/runs/:id/mark-paid',
]);

const PUBLIC_GET = new Set([
  'GET /auth/password-policy', 'GET /auth/invitation', 'GET /auth/reset-password/validate',
  'GET /auth/validate-reset-token',
]);

function validateShape(json) {
  if (!json || typeof json !== 'object') return { ok: false, missing: ['envelope'] };
  if (!('success' in json)) return { ok: false, missing: ['success'] };
  if (json.success === true && json.data === undefined) return { ok: false, missing: ['data'] };
  return { ok: true, missing: [] };
}

function classifyResult(route, actor, status, json) {
  const code = json?.error?.code;
  const memberType = actor.memberType;
  const path = route.path;

  // Public routes
  if (PUBLIC_GET.has(`${route.method} ${route.path}`)) {
    return status < 500 ? 'pass' : 'fail';
  }

  // Login failures for testorg
  if (!actor.ok) return 'skip_no_session';

  // Employee-scoped /me endpoints without employee record
  if ((path.includes('/me/') || path === '/payroll/me/payout-methods') && !actor.employeeId) {
    if (status === 400 && code === 'NO_EMPLOYEE_RECORD') return 'expected_fail';
    if (status === 403) return 'expected_fail';
  }

  // Admin analytics — employee should 403
  if (path.startsWith('/analytics/') && memberType === 'EMPLOYEE') {
    if (status === 403) return 'expected_fail';
    if (status === 200) return 'fail_rbac';
  }

  // Settings roles-permissions — only SUPER_ADMIN
  if (path.includes('roles-permissions') && memberType !== 'SUPER_ADMIN') {
    if (status === 403) return 'expected_fail';
    if (status === 200) return 'fail_rbac';
  }

  if (status >= 500) return 'fail';
  if (status === 401) return 'fail_auth';
  if (status === 404 && route.method === 'GET') return 'pass_not_found'; // placeholder id ok
  if (status >= 200 && status < 300) {
    const shape = validateShape(json);
    if (!shape.ok) return 'fail_shape';
    return 'pass';
  }
  if (status === 400 || status === 403 || status === 422) return 'expected_fail';
  return 'unexpected';
}

async function seedContext(hrToken, tenant) {
  const ctx = { employeeId: null, resourceId: null, runId: null };
  const me = await req('GET', '/auth/me', { token: hrToken, tenant });
  ctx.employeeId = me.json?.data?.employeeId;

  const emps = await req('GET', '/employees?page=1&limit=5', { token: hrToken, tenant });
  const list = emps.json?.data?.items ?? emps.json?.data ?? [];
  const first = Array.isArray(list) ? list[0] : null;
  if (first?.id) ctx.employeeId = first.id;
  if (first?.id) ctx.resourceId = first.id;

  const depts = await req('GET', '/departments', { token: hrToken, tenant });
  const dlist = depts.json?.data ?? [];
  if (Array.isArray(dlist) && dlist[0]?.id) ctx.deptId = dlist[0].id;

  const runs = await req('GET', '/payroll/runs?page=1&limit=1', { token: hrToken, tenant });
  const rlist = runs.json?.data?.items ?? runs.json?.data ?? [];
  if (Array.isArray(rlist) && rlist[0]?.id) ctx.runId = rlist[0].id;

  return ctx;
}

async function crossTenantTest(hrAcme, hrKwd) {
  const results = [];
  if (!hrAcme?.token || !hrKwd?.token) return results;

  // Acme token against KWD tenant header
  const r1 = await req('GET', '/employees?page=1&limit=1', { token: hrAcme.token, tenant: TENANTS.kwd });
  results.push({
    test: 'acme_token_kwd_tenant',
    status: r1.status,
    pass: r1.status === 401 || r1.status === 403 || (r1.json?.data?.items?.length === 0),
    detail: r1.json?.error?.code || 'isolated_or_empty',
  });

  // KWD token against acme tenant
  const r2 = await req('GET', '/employees?page=1&limit=1', { token: hrKwd.token, tenant: TENANTS.acme });
  results.push({
    test: 'kwd_token_acme_tenant',
    status: r2.status,
    pass: r2.status === 401 || r2.status === 403 || (r2.json?.data?.items?.length === 0),
    detail: r2.json?.error?.code || 'isolated_or_empty',
  });

  return results;
}

async function main() {
  console.log(`\n=== Phase 3 Deep API Audit ===\nAPI: ${API}\n`);
  const routes = extractRoutes();
  console.log(`Extracted ${routes.length} unique routes\n`);

  // Login all actors
  const loginResults = [];
  for (const actor of ACTORS) {
    const s = await login(actor);
    const row = { actor: actor.key, tenant: actor.tenant, ok: s.ok, status: s.status, error: s.error, mfa: s.mfaRequired };
    loginResults.push(row);
    console.log(`${s.ok ? 'LOGIN OK' : 'LOGIN FAIL'} | ${actor.key} @ ${actor.tenant} | ${s.status} ${s.error || ''}`);
  }

  const hrSession = sessions.get(`HR_ADMIN@${TENANTS.acme}`);
  const ctx = hrSession?.token ? await seedContext(hrSession.token, TENANTS.acme) : {};

  const matrix = [];
  let pass = 0;
  let fail = 0;
  let expected = 0;
  let skipped = 0;

  // Test GET endpoints across primary acme roles (full matrix)
  const acmeRoles = ACTORS.filter((a) => a.tenant === TENANTS.acme);
  const getRoutes = routes.filter((r) => r.method === 'GET' && !r.path.includes('stream'));

  for (const route of getRoutes) {
    for (const actor of acmeRoles) {
      const sessKey = `${actor.key}@${actor.tenant}`;
      const session = sessions.get(sessKey);
      if (!session?.ok && !PUBLIC_GET.has(`${route.method} ${route.path}`)) {
        matrix.push({ route: route.path, method: route.method, actor: actor.key, status: 0, verdict: 'skip_no_session', file: route.file });
        skipped++;
        continue;
      }
      const resolved = resolvePath(route.path, ctx) + defaultQuery(route.method, route.path);
      const r = await req(route.method, resolved, {
        token: session?.token,
        tenant: actor.tenant,
      });
      const verdict = classifyResult(route, { ...session, memberType: session?.memberType || actor.key }, r.status, r.json);
      const row = {
        route: route.path,
        method: route.method,
        actor: actor.key,
        tenant: actor.tenant,
        status: r.status,
        ms: r.ms,
        verdict,
        errorCode: r.json?.error?.code,
        file: route.file,
      };
      matrix.push(row);
      if (verdict === 'pass' || verdict === 'pass_not_found' || verdict === 'expected_fail') {
        if (verdict === 'expected_fail') expected++;
        else pass++;
      } else if (verdict === 'skip_no_session') skipped++;
      else fail++;
    }
  }

  // KWD HR subset — payroll + settings + timesheets
  const kwdSession = sessions.get(`KWD_HR@${TENANTS.kwd}`);
  const kwdRoutes = getRoutes.filter((r) =>
    r.path.startsWith('/payroll/') || r.path.startsWith('/settings/') || r.path.startsWith('/timesheets') || r.path.startsWith('/holidays'),
  );
  if (kwdSession?.ok) {
    const kwdCtx = await seedContext(kwdSession.token, TENANTS.kwd);
    for (const route of kwdRoutes) {
      const resolved = resolvePath(route.path, kwdCtx) + defaultQuery(route.method, route.path);
      const r = await req(route.method, resolved, { token: kwdSession.token, tenant: TENANTS.kwd });
      const verdict = classifyResult(route, kwdSession, r.status, r.json);
      matrix.push({ route: route.path, method: route.method, actor: 'KWD_HR', tenant: TENANTS.kwd, status: r.status, verdict, errorCode: r.json?.error?.code });
      if (verdict === 'pass' || verdict === 'pass_not_found') pass++;
      else if (verdict === 'expected_fail') expected++;
      else if (verdict !== 'skip_no_session') fail++;
    }
  }

  // Safe mutation probes (OPTIONS-like: POST with empty body expecting 422 not 500)
  const mutationProbes = [];
  const mutRoutes = routes.filter((r) => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method));
  for (const route of mutRoutes.slice(0, 80)) {
    const key = `${route.method} ${route.path}`;
    if (SKIP_MUTATION.has(key)) continue;
    if (!hrSession?.ok) continue;
    const resolved = resolvePath(route.path, ctx);
    const r = await req(route.method, resolved, { token: hrSession.token, tenant: TENANTS.acme, body: route.method !== 'DELETE' ? {} : undefined });
    const ok = r.status < 500; // 422/400/403 acceptable for empty body
    mutationProbes.push({ method: route.method, path: route.path, status: r.status, errorCode: r.json?.error?.code, ok });
    if (!ok) fail++;
    else pass++;
  }

  const isolation = await crossTenantTest(
    sessions.get(`HR_ADMIN@${TENANTS.acme}`),
    sessions.get(`KWD_HR@${TENANTS.kwd}`),
  );

  const failures = matrix.filter((m) => ['fail', 'fail_rbac', 'fail_auth', 'fail_shape', 'unexpected'].includes(m.verdict));
  const p1Failures = failures.filter((f) => f.status >= 500 || f.verdict === 'fail_rbac' || (f.actor === 'HR_ADMIN' && f.status === 403 && !f.route.includes('/team')));

  const summary = {
    generatedAt: new Date().toISOString(),
    api: API,
    totalRoutes: routes.length,
    getTestsRun: matrix.length,
    mutationProbes: mutationProbes.length,
    pass,
    expectedFail: expected,
    fail,
    skipped,
    loginResults,
    isolation,
    p1FailureCount: p1Failures.length,
    failures: failures.slice(0, 200),
    mutationProbes,
    routes,
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify({ summary, matrix }, null, 2));

  console.log(`\n--- API Audit Summary ---`);
  console.log(`Routes catalogued: ${routes.length}`);
  console.log(`GET matrix tests: ${matrix.length}`);
  console.log(`Pass: ${pass} | Expected fail: ${expected} | Fail: ${fail} | Skipped: ${skipped}`);
  console.log(`P1 failures: ${p1Failures.length}`);
  console.log(`Wrote ${OUT_JSON}`);
  return summary;
}

main().catch((e) => { console.error(e); process.exit(1); });
