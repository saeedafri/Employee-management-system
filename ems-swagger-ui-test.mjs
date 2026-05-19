/**
 * Tests every major API via Swagger UI "Try it out" flow
 * Uses fetch() directly in the browser page context with proper headers
 * so it exactly replicates what Swagger sends after authorization.
 */
import { chromium } from 'playwright';

const BASE   = 'https://employee-management-system-2b9q.onrender.com';
const API    = `${BASE}/api/v1`;
const TENANT = 'test-key-123456789';

// ─── helpers ─────────────────────────────────────────────────────────────────
async function call(page, method, path, body, token) {
  return page.evaluate(async ({ API, method, path, body, token, TENANT }) => {
    const headers = {
      'Content-Type':  'application/json',
      'x-tenant-key':  TENANT,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body != null) opts.body = JSON.stringify(body);
    try {
      const r   = await fetch(`${API}${path}`, opts);
      const raw = await r.json().catch(() => ({}));
      const d   = raw?.data;
      const count = Array.isArray(d) ? d.length
                  : Array.isArray(d?.data) ? d.data.length
                  : null;
      return { status: r.status, success: raw?.success, count, error: raw?.error?.code, raw };
    } catch (e) {
      return { status: 0, error: e.message };
    }
  }, { API, method, path, body, token, TENANT });
}

function icon(code, expected) {
  if (code >= 200 && code < 300) return '✅';
  if (expected && String(code) === String(expected)) return '⚠️ ';
  if (code === 403) return '⚠️ ';
  return '❌';
}

// ─── main ─────────────────────────────────────────────────────────────────────
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page    = await ctx.newPage();

  // ── Step 1: Navigate to Swagger and screenshot ────────────────────────────
  console.log('\n' + '═'.repeat(68));
  console.log('  EMS SWAGGER UI — FULL API VALIDATION');
  console.log('═'.repeat(68));

  await page.goto(`${BASE}/docs`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  const ops  = await page.locator('.opblock').count();
  const tags = await page.locator('.opblock-tag').count();
  await page.screenshot({ path: '/tmp/sw-01-loaded.png', fullPage: false });
  console.log(`\n📸 Swagger UI loaded: ${ops} operations, ${tags} tag groups → /tmp/sw-01-loaded.png`);

  // ── Step 2: Login to get token ────────────────────────────────────────────
  const loginRes = await call(page, 'POST', '/auth/login',
    { email: 'admin@testorg.com', password: 'password123' }, null);

  if (loginRes.status !== 200) {
    console.log('❌ Login failed:', loginRes);
    await browser.close(); process.exit(1);
  }
  const token = loginRes.raw?.data?.accessToken;
  console.log(`\n✅ Login → 200  token: ${token.slice(0,40)}...`);

  // ── Step 3: All endpoint tests ────────────────────────────────────────────
  const TESTS = [
    // [tag, method, path, body, expectedErrorCode]
    // Auth
    ['Authentication', 'POST', '/auth/login',     { email:'admin@testorg.com', password:'password123' }, null, null],
    ['Authentication', 'GET',  '/auth/me',         null, token, null],
    ['Authentication', 'GET',  '/auth/sessions',   null, token, null],
    ['Authentication', 'POST', '/auth/logout-all', null, null,  '401'],

    // Employees
    ['Employees', 'GET', '/employees',                null, token, null],
    ['Employees', 'GET', '/employees?page=1&limit=5', null, token, null],
    ['Employees', 'POST','/employees', { employeeCode:'EMP-SW-99', firstName:'SwaggerTest', lastName:'User', workEmail:'swagger.test99@testorg.com', designation:'Engineer', joinedOn:'2026-01-01', employmentType:'FULL_TIME' }, token, null],

    // Departments
    ['Departments', 'GET', '/departments', null, token, null],

    // Holidays
    ['Holidays', 'GET', '/holidays', null, token, null],

    // Attendance
    ['Attendance', 'POST', '/attendance/check-in',             { note:'swagger-test' }, token, '400'],
    ['Attendance', 'POST', '/attendance/check-out',            {},                      token, '400'],
    ['Attendance', 'GET',  '/attendance/records',              null, token, null],
    ['Attendance', 'GET',  '/attendance/summary',              null, token, null],
    ['Attendance', 'GET',  '/attendance/today',                null, token, '400'],
    ['Attendance', 'GET',  '/attendance/team/records',         null, token, null],
    ['Attendance', 'GET',  '/attendance/regularization',       null, token, null],
    ['Attendance', 'GET',  '/attendance/team/regularization',  null, token, null],

    // Leave
    ['Leave', 'GET', '/leave/balance',       null, token, null],
    ['Leave', 'GET', '/leave/requests',      null, token, null],
    ['Leave', 'GET', '/leave/team/requests', null, token, '400'],

    // Analytics
    ['Analytics', 'GET', '/analytics/summary',                 null, token, '403'],
    ['Analytics', 'GET', '/analytics/attendance',              null, token, '403'],
    ['Analytics', 'GET', '/analytics/headcount-by-department', null, token, '403'],
    ['Analytics', 'GET', '/analytics/recent-activity',         null, token, '403'],
    ['Analytics', 'GET', '/analytics/leave-summary',           null, token, '403'],

    // Dashboard
    ['Dashboard', 'GET', '/employee/dashboard', null, token, '400'],
    ['Dashboard', 'GET', '/employee/team',      null, token, '400'],
    ['Dashboard', 'GET', '/manager/dashboard',  null, token, '403'],
    ['Dashboard', 'GET', '/manager/team',       null, token, '403'],
    ['Dashboard', 'GET', '/manager/approvals',  null, token, '403'],

    // Export
    ['Export', 'GET',  '/export/list',       null, token, null],
    ['Export', 'POST', '/export/employees',  { format:'csv' }, token, null],
    ['Export', 'POST', '/export/attendance', { format:'csv', from_date:'2026-01-01T00:00:00Z', to_date:'2026-05-19T23:59:59Z' }, token, null],
    ['Export', 'POST', '/export/leave',      { format:'csv', from_date:'2026-01-01T00:00:00Z', to_date:'2026-05-19T23:59:59Z' }, token, null],

    // Reports
    ['Reports', 'GET', '/reports/leaves',         null, token, null],
    ['Reports', 'GET', '/reports/scheduled',      null, token, null],
    ['Reports', 'GET', '/reports/export-history', null, token, null],

    // Audit Logs
    ['Audit Logs', 'GET', '/audit-logs',        null, token, null],
    ['Audit Logs', 'GET', '/audit-logs/export', null, token, '403'],

    // Settings
    ['Settings', 'GET', '/settings/tenant',            null, token, null],
    ['Settings', 'GET', '/settings/email-templates',   null, token, null],
    ['Settings', 'GET', '/settings/roles-permissions', null, token, '403'],

    // System Logs
    ['System Logs', 'GET', '/admin/logs', null, token, null],

    // Health
    ['Health', 'GET', '/health', null, null, null],
  ];

  let pass = 0, warn = 0, fail = 0;
  let currentTag = '';

  console.log('\n' + '─'.repeat(68));
  console.log('  API RESULTS (fetched from Swagger page context — same as Try it out)');
  console.log('─'.repeat(68));

  for (const [tag, method, path, body, tok, expected] of TESTS) {
    if (tag !== currentTag) {
      console.log(`\n  ── ${tag} ${'─'.repeat(Math.max(0, 46 - tag.length))}`);
      currentTag = tag;
    }

    // health uses root BASE not API prefix
    const actualPath = path === '/health' ? null : path;
    let r;
    if (path === '/health') {
      r = await page.evaluate(async ({ BASE, TENANT }) => {
        const res = await fetch(`${BASE}/health`, { headers: { 'x-tenant-key': TENANT } });
        const raw = await res.json().catch(() => ({}));
        return { status: res.status, success: true, count: null, error: null, raw };
      }, { BASE, TENANT });
    } else {
      r = await call(page, method, path, body, tok);
    }

    const ic  = icon(r.status, expected);
    const cnt = r.count !== null && r.count !== undefined ? `  (${r.count} records)` : '';
    const err = r.error && !['200','201','202'].includes(String(r.status)) ? `  [${r.error}]` : '';

    if (r.status >= 200 && r.status < 300)       pass++;
    else if (expected && String(r.status) === String(expected)) warn++;
    else if (r.status === 403)                    warn++;
    else                                          fail++;

    console.log(`  ${ic} ${method.padEnd(6)} ${path.padEnd(44)} → ${r.status}${cnt}${err}`);
  }

  // ── Step 4: Final screenshot ──────────────────────────────────────────────
  await page.screenshot({ path: '/tmp/sw-02-final.png', fullPage: false });

  console.log('\n' + '═'.repeat(68));
  console.log(`  SWAGGER UI  : ${ops} operations across ${tags} tag groups`);
  console.log(`  ✅ PASS      : ${pass}`);
  console.log(`  ⚠️  WARN      : ${warn}  (expected: no-employee-profile / role-restricted)`);
  console.log(`  ❌ FAIL      : ${fail}`);
  console.log('═'.repeat(68));
  console.log('\nScreenshots:');
  console.log('  /tmp/sw-01-loaded.png  — Swagger UI fully loaded');
  console.log('  /tmp/sw-02-final.png   — Swagger UI after tests\n');

  await browser.close();
})();
