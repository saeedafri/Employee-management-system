/**
 * Rigorous local E2E: FE localhost → BFF → local backend → Hostinger DB/Redis.
 * Read-only navigation (no deletes). Screenshots + API failure capture per role.
 *
 * Usage:
 *   FE_BASE=http://localhost:3001 node scripts/rigorousLocalE2E.mjs
 *   SHOT_DIR=./e2e-evidence/rigorous-$(date +%Y%m%d) node scripts/rigorousLocalE2E.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const PASS = process.env.QA_PASS || 'Password123!';
const SHOT = process.env.SHOT_DIR || path.resolve('e2e-evidence/rigorous-local');
const API_PREFIX = '/api/';

fs.mkdirSync(SHOT, { recursive: true });

/** Role matrix — phases covered per SKILLS_SETUP §4 + BACKEND_BUILD_PLAN */
const ROLES = [
  {
    key: 'HR_ADMIN',
    email: 'hr@acme.test',
    tenant: 'acme-corp-001',
    routes: [
      { phase: '1', path: '/dashboard', label: 'Dashboard' },
      { phase: '2', path: '/employees', label: 'Employees list' },
      { phase: '2', path: '/departments', label: 'Departments' },
      { phase: '3', path: '/attendance', label: 'Attendance' },
      { phase: '4', path: '/leave', label: 'Leave' },
      { phase: '5', path: '/timesheets', label: 'Timesheets' },
      { phase: '6', path: '/payroll', label: 'Payroll runs' },
      { phase: '6', path: '/payroll/global', label: 'Payroll global' },
      { phase: '6', path: '/settings/pay/statutory-packs', label: 'Statutory packs' },
      { phase: '6', path: '/settings/pay/legal-entities', label: 'Legal entities' },
      { phase: '6', path: '/settings/pay/components', label: 'Pay components' },
      { phase: '6', path: '/settings/pay/groups', label: 'Pay groups' },
      { phase: '7', path: '/holidays', label: 'Holidays' },
      { phase: '8', path: '/settings/company-profile', label: 'Company profile' },
      { phase: '8', path: '/settings/locale', label: 'Locale' },
      { phase: '8', path: '/settings/working-hours', label: 'Working hours' },
      { phase: '9', path: '/reports', label: 'Reports' },
      { phase: '9', path: '/analytics', label: 'Analytics' },
      { phase: '11', path: '/announcements', label: 'Announcements' },
      { phase: '11', path: '/assets', label: 'Assets' },
      { phase: '11', path: '/recruitment', label: 'Recruitment' },
      { phase: '11', path: '/performance', label: 'Performance' },
    ],
  },
  {
    key: 'SUPER_ADMIN',
    email: 'superadmin@acme.test',
    tenant: 'acme-corp-001',
    routes: [
      { phase: '10', path: '/permissions', label: 'Permissions (SUPER only)' },
      { phase: '8', path: '/settings/company-profile', label: 'Settings' },
      { phase: '6', path: '/payroll', label: 'Payroll' },
      { phase: '9', path: '/analytics', label: 'Analytics' },
    ],
  },
  {
    key: 'MANAGER',
    email: 'aman@acme.test',
    tenant: 'acme-corp-001',
    routes: [
      { phase: '1', path: '/dashboard', label: 'Manager dashboard' },
      { phase: '3', path: '/attendance', label: 'Team attendance' },
      { phase: '4', path: '/leave', label: 'Team leave' },
      { phase: '5', path: '/timesheets', label: 'Timesheets' },
      { phase: '6', path: '/payroll/my-payslips', label: 'My payslips' },
    ],
  },
  {
    key: 'EMPLOYEE',
    email: 'priya@acme.test',
    tenant: 'acme-corp-001',
    routes: [
      { phase: '1', path: '/dashboard', label: 'Employee dashboard' },
      { phase: '3', path: '/attendance', label: 'My attendance' },
      { phase: '4', path: '/leave', label: 'My leave' },
      { phase: '5', path: '/timesheets', label: 'My timesheet' },
      { phase: '6', path: '/payroll/my-payslips', label: 'My payslips' },
    ],
  },
  {
    key: 'KWD_LITMUS',
    email: 'admin@kwd.test',
    tenant: 'kwd-litmus-001',
    routes: [
      { phase: '12', path: '/dashboard', label: 'KWD dashboard' },
      { phase: '8', path: '/settings/locale', label: 'KWD locale/currency' },
      { phase: '5', path: '/timesheets', label: 'KWD timesheets (SUN week)' },
      { phase: '6', path: '/payroll/global', label: 'KWD payroll global' },
      { phase: '7', path: '/holidays', label: 'KWD holidays' },
    ],
  },
];

function slug(s) {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
}

async function login(page, { email, tenant }) {
  await page.goto(`${FE}/login`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.fill('#email, input[name="email"], input[type="email"]', email);
  await page.fill('#password, input[name="password"], input[type="password"]', PASS);
  if (tenant) {
    const tenantInput = page.locator('input[name="tenantKey"], #tenantKey, [data-testid="tenant-key"]');
    if (await tenantInput.count()) await tenantInput.fill(tenant);
  }
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 90_000 });
  await page.waitForTimeout(1500);
}

async function runRole(browser, role) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const apiCalls = [];
  const consoleErr = [];

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErr.push(m.text());
  });
  page.on('response', async (r) => {
    const url = r.url();
    if (!url.includes(API_PREFIX)) return;
    let body = null;
    try {
      const ct = r.headers()['content-type'] || '';
      body = ct.includes('json') ? await r.json() : (await r.text()).slice(0, 500);
    } catch { /* noop */ }
    apiCalls.push({ url, status: r.status(), method: r.request().method(), body });
  });

  const roleDir = path.join(SHOT, role.key);
  fs.mkdirSync(roleDir, { recursive: true });
  const results = [];

  try {
    await login(page, role);
    await page.screenshot({ path: path.join(roleDir, '00_login_ok.png'), fullPage: true });

    for (const route of role.routes) {
      apiCalls.length = 0;
      consoleErr.length = 0;
      const shotName = `${route.phase}_${slug(route.path)}.png`;

      await page.goto(`${FE}${route.path}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
      await page.waitForTimeout(1200);

      const text = await page.evaluate(() => document.body.innerText);
      const errBoundary = /something went wrong|unexpected error|application error|failed to load/i.test(text);
      const onLogin = page.url().includes('/login');
      const api5xx = apiCalls.filter((c) => c.status >= 500);
      const api403 = apiCalls.filter((c) => c.status === 403);
      const api404 = apiCalls.filter((c) => c.status === 404);

      const ok = !onLogin && !errBoundary && api5xx.length === 0;
      const note = [
        onLogin ? 'REDIRECT_LOGIN' : null,
        errBoundary ? 'ERROR_BOUNDARY' : null,
        api5xx.length ? `5xx:${api5xx.map((x) => x.status).join(',')}` : null,
        api403.length ? `403:${api403.length}` : null,
        api404.length ? `404:${api404.length}` : null,
      ].filter(Boolean).join(' ');

      await page.screenshot({ path: path.join(roleDir, shotName), fullPage: true });

      results.push({
        role: role.key,
        phase: route.phase,
        path: route.path,
        label: route.label,
        ok,
        note,
        url: page.url(),
        apiFailures: [...api5xx, ...api403.filter((c) => route.path.includes('permissions'))],
      });

      const mark = ok ? 'PASS' : 'FAIL';
      console.log(`${mark} | ${role.key} | P${route.phase} | ${route.path} | ${note || 'ok'}`);
    }
  } catch (e) {
    console.error(`ROLE_CRASH ${role.key}:`, e.message);
    results.push({ role: role.key, ok: false, note: `CRASH: ${e.message}` });
  } finally {
    await ctx.close();
  }

  fs.writeFileSync(path.join(roleDir, 'results.json'), JSON.stringify(results, null, 2));
  return results;
}

const browser = await chromium.launch({ headless: true });
const all = [];
for (const role of ROLES) {
  console.log(`\n=== ${role.key} (${role.email}) ===`);
  all.push(...(await runRole(browser, role)));
}
await browser.close();

const summary = {
  at: new Date().toISOString(),
  fe: FE,
  total: all.length,
  pass: all.filter((r) => r.ok).length,
  fail: all.filter((r) => !r.ok),
};
fs.writeFileSync(path.join(SHOT, 'summary.json'), JSON.stringify(summary, null, 2));

console.log(`\n=== SUMMARY ${summary.pass}/${summary.total} PASS ===`);
if (summary.fail.length) {
  console.log('FAILURES:');
  for (const f of summary.fail) {
    console.log(`  - ${f.role} ${f.path}: ${f.note}`);
  }
}
process.exit(summary.fail.length ? 1 : 0);
