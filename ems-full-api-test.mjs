/**
 * Full EMS API test — runs against LOCAL or RENDER
 * Usage:  node ems-full-api-test.mjs [local|render]
 */
import { chromium } from 'playwright';

const TARGET = process.argv[2] === 'local'
  ? 'http://localhost:3000'
  : 'https://employee-management-system-2b9q.onrender.com';

const API    = `${TARGET}/api/v1`;
const TENANT = 'test-key-123456789';
const ENV    = process.argv[2] === 'local' ? 'LOCAL' : 'RENDER (PRODUCTION)';

// ── helpers ──────────────────────────────────────────────────────────────────
async function apiCall(page, method, path, body, token) {
  return page.evaluate(async ({ API, method, path, body, token, TENANT }) => {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'x-tenant-key': TENANT },
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body)  opts.body = JSON.stringify(body);
    try {
      const r   = await fetch(`${API}${path}`, opts);
      const raw = await r.json().catch(() => ({}));
      const d   = raw?.data;
      const count = Array.isArray(d)
        ? d.length
        : Array.isArray(d?.data) ? d.data.length : null;
      return { status: r.status, success: raw?.success, count, error: raw?.error?.code };
    } catch (e) {
      return { status: 0, error: e.message };
    }
  }, { API, method, path, body, token, TENANT });
}

function icon(status) {
  if (status >= 200 && status < 300) return '✅';
  if (status === 403)               return '⚠️ ';   // permission — expected
  if (status === 400)               return '🔶';   // bad request — needs params
  return '❌';
}

// ── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  // ── 1. SWAGGER UI screenshot ───────────────────────────────────────────────
  const swPage = await ctx.newPage();
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  EMS FULL TEST — ${ENV}`);
  console.log(`${'═'.repeat(62)}\n`);

  console.log('📸 Capturing Swagger UI screenshot...');
  await swPage.goto(`${TARGET}/docs`, { waitUntil: 'networkidle', timeout: 30000 });
  await swPage.waitForTimeout(4000);

  const ops  = await swPage.locator('.opblock').count();
  const tags = await swPage.locator('.opblock-tag').count();
  await swPage.screenshot({ path: '/tmp/final-swagger.png', fullPage: true });

  console.log(`   Operations : ${ops}`);
  console.log(`   Tag groups : ${tags}`);
  console.log(`   Screenshot : /tmp/final-swagger.png`);
  console.log(ops > 50 ? '   ✅ Swagger UI FULLY POPULATED' : '   ❌ Swagger still incomplete');

  // ── 2. LOGIN (need token for all other calls) ──────────────────────────────
  const apiPage = await ctx.newPage();
  const login   = await apiCall(apiPage, 'POST', '/auth/login',
    { email: 'admin@testorg.com', password: 'password123' });
  const token   = login.status === 200
    ? await apiPage.evaluate(async ({ API, TENANT }) => {
        const r = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tenant-key': TENANT },
          body: JSON.stringify({ email: 'admin@testorg.com', password: 'password123' }),
        });
        const d = await r.json();
        return d.data?.accessToken;
      }, { API, TENANT })
    : null;

  // ── 3. ALL ENDPOINT TESTS ──────────────────────────────────────────────────
  const TESTS = [
    // ── Authentication
    ['Authentication', 'POST', '/auth/login',                    null,                                    null ],
    ['Authentication', 'POST', '/auth/refresh',                  null,                                    null ],
    ['Authentication', 'GET',  '/auth/me',                       null,                                    token],
    ['Authentication', 'GET',  '/auth/sessions',                 null,                                    token],
    ['Authentication', 'POST', '/auth/logout-all',               null,                                    null ], // no token = 401
    // ── Employees
    ['Employees',     'GET',  '/employees',                      null,                                    token],
    ['Employees',     'GET',  '/employees?page=1&limit=5',        null,                                    token],
    ['Employees',     'POST', '/employees',                      { firstName:'Test',lastName:'User',workEmail:'test.new@testorg.com',designation:'Engineer',departmentId:null,joinedOn:'2026-01-01',employmentType:'FULL_TIME' }, token],
    // ── Departments
    ['Departments',   'GET',  '/departments',                    null,                                    token],
    // ── Holidays
    ['Holidays',      'GET',  '/holidays',                       null,                                    token],
    // ── Attendance
    ['Attendance',    'POST', '/attendance/check-in',            { workMode:'OFFICE', location:'HQ' },    token],
    ['Attendance',    'POST', '/attendance/check-out',           {},                                      token],
    ['Attendance',    'GET',  '/attendance/records',             null,                                    token],
    ['Attendance',    'GET',  '/attendance/summary',             null,                                    token],
    ['Attendance',    'GET',  '/attendance/team/records',        null,                                    token],
    ['Attendance',    'GET',  '/attendance/regularization',      null,                                    token],
    ['Attendance',    'GET',  '/attendance/team/regularization', null,                                    token],
    // ── Leave
    ['Leave',         'GET',  '/leave/balance',                  null,                                    token],
    ['Leave',         'GET',  '/leave/requests',                 null,                                    token],
    ['Leave',         'GET',  '/leave/team/requests',            null,                                    token],
    // ── Analytics
    ['Analytics',     'GET',  '/analytics/summary',              null,                                    token],
    ['Analytics',     'GET',  '/analytics/attendance',           null,                                    token],
    ['Analytics',     'GET',  '/analytics/headcount-by-department', null,                                 token],
    ['Analytics',     'GET',  '/analytics/recent-activity',     null,                                    token],
    ['Analytics',     'GET',  '/analytics/leave-summary',       null,                                    token],
    // ── Dashboard
    ['Dashboard',     'GET',  '/employee/dashboard',             null,                                    token],
    ['Dashboard',     'GET',  '/attendance/today',               null,                                    token],
    ['Dashboard',     'GET',  '/employee/team',                  null,                                    token],
    ['Dashboard',     'GET',  '/manager/dashboard',              null,                                    token],
    ['Dashboard',     'GET',  '/manager/team',                   null,                                    token],
    ['Dashboard',     'GET',  '/manager/approvals',              null,                                    token],
    // ── Export
    ['Export',        'GET',  '/export/list',                    null,                                    token],
    ['Export',        'POST', '/export/employees',               { format:'csv' },                       token],
    ['Export',        'POST', '/export/attendance',              { format:'csv' },                       token],
    ['Export',        'POST', '/export/leave',                   { format:'csv' },                       token],
    // ── Reports
    ['Reports',       'GET',  '/reports/leaves',                 null,                                    token],
    ['Reports',       'GET',  '/reports/scheduled',              null,                                    token],
    ['Reports',       'GET',  '/reports/export-history',         null,                                    token],
    // ── Audit Logs
    ['Audit Logs',    'GET',  '/audit-logs',                     null,                                    token],
    ['Audit Logs',    'GET',  '/audit-logs/export',              null,                                    token],
    // ── Settings
    ['Settings',      'GET',  '/settings/tenant',                null,                                    token],
    ['Settings',      'GET',  '/settings/email-templates',       null,                                    token],
    ['Settings',      'GET',  '/settings/roles-permissions',     null,                                    token],
    // ── System Logs
    ['System Logs',   'GET',  '/admin/logs',                     null,                                    token],
  ];

  const results = {};
  let pass = 0, warn = 0, fail = 0;
  let currentTag = '';

  console.log('\n📋 API TEST RESULTS\n');

  for (const [tag, method, path, body, tok] of TESTS) {
    if (tag !== currentTag) {
      console.log(`  ── ${tag} ${'─'.repeat(Math.max(0, 40 - tag.length))}`);
      currentTag = tag;
      if (!results[tag]) results[tag] = [];
    }
    const r    = await apiCall(apiPage, method, path, body, tok);
    const ic   = icon(r.status);
    const cnt  = r.count !== null ? `  (${r.count} records)` : '';
    const err  = r.error ? `  [${r.error}]` : '';
    console.log(`  ${ic} ${method.padEnd(6)} ${path.padEnd(42)} → ${r.status}${cnt}${err}`);
    results[tag].push({ method, path, status: r.status });

    if (r.status >= 200 && r.status < 300) pass++;
    else if (r.status === 403)             warn++;
    else                                   fail++;
  }

  // ── 4. Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`  SWAGGER UI   : ${ops} operations, ${tags} tag groups`);
  console.log(`  API PASS     : ${pass}`);
  console.log(`  API WARN 403 : ${warn}  (permission-restricted — expected)`);
  console.log(`  API FAIL     : ${fail}`);
  console.log(`${'═'.repeat(62)}`);

  // ── 5. Production screenshot of full page ──────────────────────────────────
  console.log('\n📸 Taking full-page production Swagger screenshot...');
  await swPage.screenshot({ path: '/tmp/final-swagger-full.png', fullPage: true });
  console.log('   Saved: /tmp/final-swagger-full.png\n');

  await browser.close();
})();
