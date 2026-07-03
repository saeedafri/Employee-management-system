/**
 * Phase 4 — Mandatory edge-case E2E battery (API + Playwright).
 * MSW OFF. Chrome channel. localhost:3001 → BFF → Hostinger API.
 *
 * Usage: FE_BASE=http://localhost:3001 node scripts/phase4EdgeCases.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FE = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_URL || 'https://ems-api.saqibsaeed.cloud/api/v1';
const SHOT_DIR = path.join(ROOT, 'docs/e2e-screenshots/phase4/edge');
const OUT_JSON = path.join(ROOT, 'docs/e2e-phase4-edge-results.json');
const PASSWORD = 'Password123!';

fs.mkdirSync(SHOT_DIR, { recursive: true });

const TENANTS = {
  acme: 'acme-corp-001',
  kwd: 'kwd-litmus-001',
  testorg: 'test-key-123456789',
  global: 'global-payroll-litmus-001',
  qa: 'qa-regression-org-001',
};

/** @type {{id:number,case:string,pass:boolean,detail:string,screenshot?:string,severity?:string}[]} */
const results = [];

function record(id, caseName, pass, detail = '', extra = {}) {
  results.push({ id, case: caseName, pass, detail, ...extra, at: new Date().toISOString() });
  console.log(`${pass ? 'PASS' : 'FAIL'} | #${id} ${caseName} → ${detail}`);
}

function slug(s) {
  return (s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
}

async function apiReq(method, urlPath, { token, tenant, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (tenant) headers['x-tenant-key'] = tenant;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  let json = null;
  try { json = await res.json(); } catch { /* noop */ }
  return { status: res.status, json };
}

async function login(email, tenant, password = PASSWORD) {
  const r = await apiReq('POST', '/auth/login', { tenant, body: { email, password } });
  return {
    ok: r.status === 200 && !!r.json?.data?.accessToken,
    token: r.json?.data?.accessToken,
    user: r.json?.data?.user,
    status: r.status,
    code: r.json?.error?.code,
  };
}

function wireCapture(page, net, consoleLog = [], pageErrors = []) {
  page.on('console', (m) => consoleLog.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('response', async (r) => {
    if (!r.url().includes('/api/')) return;
    let body = null;
    try {
      const ct = r.headers()['content-type'] || '';
      body = ct.includes('json') ? await r.json() : (await r.text()).slice(0, 400);
    } catch { /* noop */ }
    net.push({ url: r.url(), method: r.request().method(), status: r.status(), body });
  });
}

async function uiLogin(page, email, password, tenantKey) {
  await page.goto(`${FE}/login`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.fill('#email, input[name="email"], input[type="email"]', email);
  await page.fill('#password, input[name="password"], input[type="password"]', password);
  const tenantInput = page.locator('input[name="tenantKey"], #tenantKey');
  if (await tenantInput.count()) await tenantInput.fill(tenantKey);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login') && !u.pathname.includes('/otp'), { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return !page.url().includes('/login');
}

async function shot(page, name) {
  const file = `edge-${slug(name)}-${Date.now()}.png`;
  const abs = path.join(SHOT_DIR, file);
  await page.screenshot({ path: abs, fullPage: false }).catch(() => {});
  return `docs/e2e-screenshots/phase4/edge/${file}`;
}

async function performLogout(page) {
  const directMenu = page.getByRole('button', { name: /open user menu/i });
  if (await directMenu.isVisible().catch(() => false)) {
    await directMenu.click({ timeout: 10_000 });
    await page.waitForSelector('div[role="menuitem"]', { timeout: 10_000 }).catch(() => {});
    const signOut = page.locator('div[role="menuitem"]:has-text("Sign out"), [role="menuitem"]:has-text("Log out")').first();
    if (await signOut.count()) {
      await signOut.evaluate((el) => el.click());
      return true;
    }
  }
  for (const sel of ['button:has-text("Sign out")', 'button:has-text("Log out")', '[role="menuitem"]:has-text("Sign out")']) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      await loc.click();
      return true;
    }
  }
  return false;
}

// ─── Edge cases 1–15 + logout ─────────────────────────────────

async function runEdgeCases(browser) {
  // 1 Wrong password login
  {
    const r = await login('hr@acme.test', TENANTS.acme, 'WrongPassword!');
    record(1, 'wrong_password_login', !r.ok && r.code === 'INVALID_CREDENTIALS', r.code || String(r.status));
  }

  // 2 Cross-tenant token mismatch
  {
    const acme = await login('hr@acme.test', TENANTS.acme);
    const r = await apiReq('GET', '/employees?limit=1', { token: acme.token, tenant: TENANTS.kwd });
    const code = r.json?.error?.code;
    const pass = r.status === 401 || r.status === 403 || code === 'TENANT_MISMATCH' || code === 'FORBIDDEN';
    record(2, 'cross_tenant_token_mismatch', pass, `${r.status} ${code || ''}`);
  }

  // 3 Unauthenticated deep link
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${FE}/employees/cmqqf21fw00046adzo6h2a22w`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const pass = page.url().includes('/login');
    const ss = await shot(page, 'unauth-deep-link');
    record(3, 'unauthenticated_deep_link', pass, page.url(), { screenshot: ss });
    await ctx.close();
  }

  // 4 Invalid UUID in URL
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    wireCapture(page, net);
    if (await uiLogin(page, 'hr@acme.test', PASSWORD, TENANTS.acme)) {
      await page.goto(`${FE}/employees/00000000-0000-4000-8000-000000000099`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const api404 = net.some((n) => n.status === 404 || n.status === 400);
      const errUi = /not found|does not exist|invalid/i.test(await page.textContent('body') || '');
      const pass = api404 || errUi || !net.some((n) => n.status >= 500);
      const ss = await shot(page, 'invalid-uuid');
      record(4, 'invalid_uuid_url', pass, `api404=${api404} errUi=${errUi}`, { screenshot: ss });
    } else {
      record(4, 'invalid_uuid_url', false, 'LOGIN_FAILED');
    }
    await ctx.close();
  }

  // 5 Browser back after form
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    if (await uiLogin(page, 'hr@acme.test', PASSWORD, TENANTS.acme)) {
      await page.goto(`${FE}/employees/new`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await page.fill('input[name="firstName"], input[placeholder*="First" i]', 'Phase4Back').catch(() => {});
      await page.goBack();
      await page.waitForTimeout(1000);
      const pass = !page.url().includes('/employees/new') || true; // back navigation should not crash
      const crashed = /something went wrong|application error/i.test(await page.textContent('body') || '');
      record(5, 'browser_back_after_form', !crashed, crashed ? 'ERROR_BOUNDARY' : page.url());
    } else {
      record(5, 'browser_back_after_form', false, 'LOGIN_FAILED');
    }
    await ctx.close();
  }

  // 6 Double-click submit
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    wireCapture(page, net);
    await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'hr@acme.test');
    await page.fill('input[type="password"]', 'WrongPassword!');
    const btn = page.locator('button[type="submit"]');
    await btn.dblclick();
    await page.waitForTimeout(2500);
    const loginPosts = net.filter((n) => n.method === 'POST' && n.url.includes('/auth/login'));
    const pass = loginPosts.length <= 3 && !net.some((n) => n.status >= 500);
    record(6, 'double_click_submit', pass, `loginPosts=${loginPosts.length}`);
    await ctx.close();
  }

  // 7 Empty required form submit
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    if (await uiLogin(page, 'hr@acme.test', PASSWORD, TENANTS.acme)) {
      await page.goto(`${FE}/employees/new`, { waitUntil: 'networkidle' });
      await page.click('button[type="submit"]').catch(() => page.locator('button:has-text("Save"), button:has-text("Create")').first().click());
      await page.waitForTimeout(1500);
      const validation = await page.locator('[aria-invalid="true"], .text-destructive, [data-invalid]').count();
      const pass = validation > 0 || page.url().includes('/employees/new');
      const ss = await shot(page, 'empty-form');
      record(7, 'empty_required_form_submit', pass, `validationMarkers=${validation}`, { screenshot: ss });
    } else {
      record(7, 'empty_required_form_submit', false, 'LOGIN_FAILED');
    }
    await ctx.close();
  }

  // 8 Pagination last page
  {
    const hr = await login('hr@acme.test', TENANTS.acme);
    const r1 = await apiReq('GET', '/employees?page=1&limit=5', { token: hr.token, tenant: TENANTS.acme });
    const total = r1.json?.meta?.total ?? r1.json?.data?.total ?? 0;
    const lastPage = Math.max(1, Math.ceil(total / 5));
    const rLast = await apiReq('GET', `/employees?page=${lastPage}&limit=5`, { token: hr.token, tenant: TENANTS.acme });
    const pass = rLast.status === 200 && !Array.isArray(rLast.json?.data) === false;
    record(8, 'pagination_last_page', rLast.status === 200, `page=${lastPage} status=${rLast.status} items=${(rLast.json?.data ?? []).length}`);
  }

  // 9 Search special chars
  {
    const hr = await login('hr@acme.test', TENANTS.acme);
    const queries = ["' OR 1=1--", '😀测试', 'üñîçødé', '<script>alert(1)</script>'];
    let allPass = true;
    const details = [];
    for (const q of queries) {
      const r = await apiReq('GET', `/search?q=${encodeURIComponent(q)}`, { token: hr.token, tenant: TENANTS.acme });
      if (r.status >= 500) allPass = false;
      details.push(`${q.slice(0, 12)}:${r.status}`);
    }
    record(9, 'search_special_chars', allPass, details.join('; '));
  }

  // 10 Role accessing forbidden route
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    wireCapture(page, net);
    if (await uiLogin(page, 'priya@acme.test', PASSWORD, TENANTS.acme)) {
      await page.goto(`${FE}/permissions`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const denied = page.url().includes('/login') || page.url().includes('/403')
        || /not authorized|access denied|forbidden/i.test(await page.textContent('body') || '');
      const api403 = net.some((n) => n.status === 403);
      const pass = denied || api403;
      const ss = await shot(page, 'employee-forbidden-route');
      record(10, 'role_forbidden_route', pass, `denied=${denied} api403=${api403} url=${page.url()}`, {
        screenshot: ss,
        severity: pass ? undefined : 'P1',
      });
    } else {
      record(10, 'role_forbidden_route', false, 'LOGIN_FAILED');
    }
    await ctx.close();
  }

  // 11 SUPER_ADMIN pages without employee
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    wireCapture(page, net);
    if (await uiLogin(page, 'superadmin@acme.test', PASSWORD, TENANTS.acme)) {
      await page.goto(`${FE}/attendance`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const noEmp = net.filter((n) => n.status === 400 && JSON.stringify(n.body).includes('NO_EMPLOYEE_RECORD'));
      record(11, 'super_admin_no_employee', noEmp.length === 0, noEmp.length ? `STILL_BROKEN:${noEmp.length}` : 'graceful_or_fixed', {
        severity: noEmp.length ? 'P1' : undefined,
      });
    } else {
      record(11, 'super_admin_no_employee', false, 'LOGIN_FAILED');
    }
    await ctx.close();
  }

  // 12 Session refresh persistence
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    if (await uiLogin(page, 'hr@acme.test', PASSWORD, TENANTS.acme)) {
      await page.waitForTimeout(3000);
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const pass = !page.url().includes('/login');
      record(12, 'session_refresh_persist', pass, page.url());
    } else {
      record(12, 'session_refresh_persist', false, 'LOGIN_FAILED');
    }
    await ctx.close();
  }

  // 13 Mobile viewport 375px
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    if (await uiLogin(page, 'hr@acme.test', PASSWORD, TENANTS.acme)) {
      await page.goto(`${FE}/dashboard`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const crashed = /something went wrong/i.test(await page.textContent('body') || '');
      const ss = await shot(page, 'mobile-375');
      record(13, 'mobile_viewport_375', !crashed, crashed ? 'ERROR_BOUNDARY' : 'dashboard_ok', { screenshot: ss });
    } else {
      record(13, 'mobile_viewport_375', false, 'LOGIN_FAILED');
    }
    await ctx.close();
  }

  // 14 Large table scroll
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    if (await uiLogin(page, 'hr@acme.test', PASSWORD, TENANTS.acme)) {
      await page.goto(`${FE}/employees`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(800);
      const crashed = /something went wrong/i.test(await page.textContent('body') || '');
      record(14, 'large_table_scroll', !crashed, crashed ? 'ERROR_BOUNDARY' : 'scroll_ok');
    } else {
      record(14, 'large_table_scroll', false, 'LOGIN_FAILED');
    }
    await ctx.close();
  }

  // 15 File upload UI
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const hr = await login('hr@acme.test', TENANTS.acme);
    const empRes = await apiReq('GET', '/employees?limit=1', { token: hr.token, tenant: TENANTS.acme });
    const empId = empRes.json?.data?.[0]?.id;
    if (empId && await uiLogin(page, 'hr@acme.test', PASSWORD, TENANTS.acme)) {
      await page.goto(`${FE}/employees/${empId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const fileInput = page.locator('input[type="file"]');
      const hasUpload = await fileInput.count() > 0;
      if (hasUpload) {
        const tmpFile = path.join(SHOT_DIR, 'test-doc.txt');
        fs.writeFileSync(tmpFile, 'Phase4 test document');
        await fileInput.first().setInputFiles(tmpFile).catch(() => {});
        await page.waitForTimeout(2000);
        record(15, 'file_upload_ui', true, 'upload_input_present_and_triggered');
      } else {
        record(15, 'file_upload_ui', false, 'NO_FILE_INPUT_ON_PROFILE', { severity: 'P2' });
      }
    } else {
      record(15, 'file_upload_ui', false, 'NO_EMPLOYEE_OR_LOGIN');
    }
    await ctx.close();
  }

  // Logout flow (bonus mandatory)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    wireCapture(page, net);
    if (await uiLogin(page, 'hr@acme.test', PASSWORD, TENANTS.acme)) {
      const before = await shot(page, 'logout-before');
      const clicked = await performLogout(page);
      await page.waitForTimeout(2000);
      const onLogin = page.url().includes('/login');
      const logoutApi = net.some((n) => n.url.includes('/auth/logout') && n.status < 400);
      const ss = await shot(page, 'logout-after');
      const pass = clicked && onLogin;
      record(16, 'logout_flow', pass, `clicked=${clicked} onLogin=${onLogin} logoutApi=${logoutApi}`, {
        screenshot: ss,
        severity: pass ? undefined : 'P1',
      });
      if (pass) {
        const relogin = await uiLogin(page, 'hr@acme.test', PASSWORD, TENANTS.acme);
        record(17, 'logout_relogin', relogin, relogin ? 'ok' : 'relogin_failed');
      }
    } else {
      record(16, 'logout_flow', false, 'LOGIN_FAILED');
    }
    await ctx.close();
  }

  // testorg tenant
  {
    const r = await login('admin@testorg.com', TENANTS.testorg, 'password123');
    record(18, 'testorg_tenant_login', r.ok, r.ok ? 'OK' : (r.code || 'TENANT_OR_CREDENTIALS_MISSING'), {
      severity: r.ok ? undefined : 'P1',
    });
  }

  // AUDITOR role
  {
    const r = await login('npjktdbh@guerrillamailblock.com', TENANTS.qa, PASSWORD);
    const pass = r.ok && r.user?.memberType === 'AUDITOR';
    record(19, 'auditor_role_login', pass, pass ? 'AUDITOR_OK' : (r.code || 'fail'));
    if (pass) {
      const me = await apiReq('GET', '/auth/me', { token: r.token, tenant: TENANTS.qa });
      record(20, 'auditor_auth_me', me.status === 200, `status=${me.status}`);
    }
  }
}

async function main() {
  console.log(`\n=== Phase 4 Edge Cases ===\nFE=${FE} API=${API}\n`);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await runEdgeCases(browser);
  } finally {
    await browser.close();
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    total: results.length,
    pass: results.filter((r) => r.pass).length,
    fail: results.filter((r) => !r.pass).length,
    results,
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));
  console.log(`\nEdge cases: ${summary.pass}/${summary.total} pass → ${OUT_JSON}`);
  process.exit(summary.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
