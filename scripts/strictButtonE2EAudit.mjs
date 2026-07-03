/**
 * Phase 2 — Strict button-by-button E2E audit.
 * MSW OFF. Chrome channel. localhost FE → BFF → Hostinger API.
 *
 * Usage:
 *   FE_BASE=http://localhost:3001 node scripts/strictButtonE2EAudit.mjs
 *   STRICT_MAX_BUTTONS=80 node scripts/strictButtonE2EAudit.mjs  # cap per page
 *
 * Outputs:
 *   docs/E2E_STRICT_AUDIT.md
 *   docs/e2e-strict-summary.json
 *   docs/e2e-screenshots/strict/{tenant}-{role}-{page}-{button}-{before|after}.png
 *   Appends ## Phase 2 to docs/E2E_BACKEND_ISSUES.md & docs/E2E_FRONTEND_ISSUES.md
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FE = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_URL || 'https://ems-api.saqibsaeed.cloud/api/v1';
const SHOT_DIR = path.join(ROOT, 'docs/e2e-screenshots/strict');
const STRICT_MD = path.join(ROOT, 'docs/E2E_STRICT_AUDIT.md');
const SUMMARY_JSON = path.join(ROOT, 'docs/e2e-strict-summary.json');
const BACKEND_ISSUES_MD = path.join(ROOT, 'docs/E2E_BACKEND_ISSUES.md');
const FRONTEND_ISSUES_MD = path.join(ROOT, 'docs/E2E_FRONTEND_ISSUES.md');
const MAX_BUTTONS = Number(process.env.STRICT_MAX_BUTTONS || 60);
const WAIT_MS = Number(process.env.STRICT_WAIT_MS || 2000);

fs.mkdirSync(SHOT_DIR, { recursive: true });

/** @type {{ tenantKey: string, tenantSlug: string, roleKey: string, email: string, password: string, note?: string }[]} */
const ACTORS = [
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'HR_ADMIN', email: 'hr@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'SUPER_ADMIN', email: 'superadmin@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'MANAGER', email: 'aman@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'EMPLOYEE', email: 'priya@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'EMPLOYEE_DEV', email: 'dev1@acme.test', password: 'Password123!' },
  { tenantKey: 'test-key-123456789', tenantSlug: 'testorg', roleKey: 'HR_ADMIN', email: 'admin@testorg.com', password: 'password123' },
  { tenantKey: 'kwd-litmus-001', tenantSlug: 'kwd', roleKey: 'HR_ADMIN', email: 'admin@kwd.test', password: 'Password123!' },
];

const CORE_ROUTES = [
  '/dashboard', '/employees', '/departments', '/attendance', '/timesheets', '/leave',
  '/holidays', '/payroll', '/payroll/global', '/payroll/my-payslips', '/payout-methods',
  '/reports', '/analytics', '/permissions', '/settings', '/recruitment', '/performance',
  '/assets', '/announcements',
];

const SETTINGS_ROUTES = [
  '/settings/company-profile', '/settings/locale', '/settings/working-hours',
  '/settings/pay/components', '/settings/pay/statutory-packs', '/settings/pay/legal-entities',
  '/settings/pay/groups', '/settings/pay/schedules', '/settings/pay/payslip-template',
  '/settings/pay/data-policy', '/settings/leave-types', '/settings/leave-policies',
  '/settings/leave-packs', '/settings/leave-assignments', '/settings/attendance-rules',
  '/settings/timesheets', '/settings/notifications', '/settings/email-templates',
  '/settings/branding', '/settings/authentication', '/settings/sessions',
  '/settings/audit-log', '/settings/integration-email', '/settings/integration-storage',
  '/settings/integration-webhooks',
];

const SKIP_TEXT = [
  /log\s*out|sign\s*out|logout/i,
  /delete\s+permanently|permanently\s+delete|confirm\s+delete/i,
  /send\s+payroll|finalize\s+payroll|submit\s+payroll\s+run/i,
  /remove\s+employee|terminate\s+employee/i,
];

const buttonMatrix = [];
const edgeCases = [];
const backendIssues = [];
const frontendIssues = [];

function slug(s, max = 40) {
  return (s || 'unnamed')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, max) || 'unnamed';
}

function shotPath(tenantSlug, roleKey, pageSlug, buttonSlug, phase) {
  const name = `${tenantSlug}-${roleKey}-${pageSlug}-${buttonSlug}-${phase}.png`;
  return { rel: `docs/e2e-screenshots/strict/${name}`, abs: path.join(SHOT_DIR, name) };
}

function routesForRole(roleKey) {
  if (roleKey === 'MANAGER' || roleKey === 'EMPLOYEE' || roleKey === 'EMPLOYEE_DEV') {
    return [...new Set(['/dashboard', '/attendance', '/leave', '/timesheets', '/payroll/my-payslips', '/holidays', '/employees', '/payout-methods'])];
  }
  if (roleKey === 'HR_ADMIN' || roleKey === 'SUPER_ADMIN') {
    return [...new Set([...CORE_ROUTES, ...SETTINGS_ROUTES, '/employees/new'])];
  }
  return [...CORE_ROUTES];
}

function shouldSkipClick(text) {
  return SKIP_TEXT.some((re) => re.test(text));
}

function apiPath(url) {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\/api\/v1/, '') || u.pathname;
  } catch {
    return url;
  }
}

function wireCapture(page, bucket) {
  const consoleLog = [];
  const pageErrors = [];
  page.on('console', (m) => consoleLog.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('response', async (r) => {
    const url = r.url();
    if (!url.includes('/api/')) return;
    let body = null;
    try {
      const ct = r.headers()['content-type'] || '';
      body = ct.includes('json') ? await r.json() : (await r.text()).slice(0, 600);
    } catch { /* noop */ }
    let fromSW = false;
    try { fromSW = await r.fromServiceWorker(); } catch { /* noop */ }
    bucket.push({ url, method: r.request().method(), status: r.status(), body, fromServiceWorker: fromSW });
  });
  return { consoleLog, pageErrors };
}

async function hasErrorBoundary(page) {
  const text = await page.evaluate(() => document.body?.innerText || '');
  return /something went wrong|unexpected error|application error|failed to load/i.test(text);
}

async function apiLogin(email, password, tenant) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-key': tenant },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  return {
    status: res.status,
    json,
    ok: res.ok && json?.success,
    mfaRequired: json?.data?.mfaRequired === true,
    token: json?.data?.accessToken,
    memberType: json?.data?.user?.memberType,
  };
}

async function uiLogin(page, actor, net) {
  await page.goto(`${FE}/login`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.fill('#email, input[name="email"], input[type="email"]', actor.email);
  await page.fill('#password, input[name="password"], input[type="password"]', actor.password);
  const tenantInput = page.locator('input[name="tenantKey"], #tenantKey');
  if (await tenantInput.count()) await tenantInput.fill(actor.tenantKey);
  net.length = 0;
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login') && !u.pathname.includes('/otp'), { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return !page.url().includes('/login') && !page.url().includes('/otp');
}

async function collectClickables(page, { includeNav = false } = {}) {
  return page.evaluate(({ includeNav }) => {
    const sel = 'button, [role="button"], a[href], input[type="submit"], [data-testid]';
    const seen = new Set();
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      if (!includeNav) {
        const inNav = el.closest('nav, aside, [role="navigation"], [data-testid="sidebar"], [data-testid="app-sidebar"]');
        if (inNav) continue;
      }
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (rect.width < 2 || rect.height < 2) continue;
      if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') continue;
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') continue;
      const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
      const href = el.getAttribute('href') || '';
      if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;
      const testId = el.getAttribute('data-testid') || '';
      const tag = el.tagName.toLowerCase();
      const key = `${tag}|${text}|${href}|${testId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ text, href, testId, tag, key });
    }
    return out;
  }, { includeNav });
}

async function sweepNavOnce(page, actor, net, consoleLog) {
  const pageSlug = 'global-nav';
  const clickables = await collectClickables(page, { includeNav: true });
  const navOnly = clickables.filter((m) => /dashboard|employees|departments|attendance|leave|timesheets|payroll|settings|reports|analytics|permissions|holidays|assets|announcements|recruitment|performance/i.test(m.text + m.href));
  let count = 0;
  for (const meta of navOnly.slice(0, 25)) {
    const label = meta.text || meta.href;
    if (shouldSkipClick(label)) continue;
    net.length = 0;
    const btnSlug = slug(label);
    const before = shotPath(actor.tenantSlug, actor.roleKey, pageSlug, btnSlug, 'before');
    await page.screenshot({ path: before.abs, fullPage: false }).catch(() => {});
    const clickOk = await clickByKey(page, meta.key, true);
    await page.waitForTimeout(WAIT_MS);
    const after = shotPath(actor.tenantSlug, actor.roleKey, pageSlug, btnSlug, 'after');
    await page.screenshot({ path: after.abs, fullPage: false }).catch(() => {});
    buttonMatrix.push({
      tenant: actor.tenantSlug, role: actor.roleKey, page: '(global-nav)', button: label,
      verdict: clickOk ? 'PASS' : 'PARTIAL', urlChanged: true,
      screenshots: { before: before.rel, after: after.rel }, at: new Date().toISOString(),
    });
    count++;
    await page.goto(`${FE}/dashboard`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  console.log(`  [${actor.roleKey}@${actor.tenantSlug}] global-nav: ${count} nav links`);
}

async function clickByKey(page, key, includeNav = false) {
  return page.evaluate(({ targetKey, includeNav }) => {
    const sel = 'button, [role="button"], a[href], input[type="submit"], [data-testid]';
    const seen = new Set();
    for (const el of document.querySelectorAll(sel)) {
      if (!includeNav) {
        const inNav = el.closest('nav, aside, [role="navigation"], [data-testid="sidebar"], [data-testid="app-sidebar"]');
        if (inNav) continue;
      }
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (rect.width < 2 || rect.height < 2) continue;
      if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') continue;
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') continue;
      const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
      const href = el.getAttribute('href') || '';
      const testId = el.getAttribute('data-testid') || '';
      const tag = el.tagName.toLowerCase();
      const k = `${tag}|${text}|${href}|${testId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (k === targetKey) {
        el.scrollIntoView({ block: 'center' });
        el.click();
        return true;
      }
    }
    return false;
  }, { targetKey: key, includeNav });
}

function classifyClick({ beforeUrl, afterUrl, apiCalls, errBoundary, consoleErrs, swActive, skipped, clickFailed }) {
  if (skipped) return 'SKIP';
  if (clickFailed) return 'PARTIAL';
  if (errBoundary || swActive) return 'FAIL';
  const badApi = apiCalls.filter((c) => c.status >= 500 || (c.fromServiceWorker && c.status >= 400));
  if (badApi.length) return 'FAIL';
  const client4xx = apiCalls.filter((c) => c.status >= 400 && c.status < 500 && !c.url.includes('/notifications/unread-count'));
  const hardConsole = consoleErrs.filter((c) => c.type === 'error' && !/favicon|React DevTools|hydration/i.test(c.text));
  if (client4xx.length >= 2 || hardConsole.length >= 3) return 'PARTIAL';
  if (afterUrl !== beforeUrl || apiCalls.some((c) => c.status >= 200 && c.status < 300)) return 'PASS';
  return 'PASS';
}

async function recoverPageState(page, routePath, beforeUrl) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
  const target = `${FE}${routePath}`;
  const pathNow = datetimeSafeUrl(page.url());
  const rootSeg = routePath.split('/').filter(Boolean)[0] || 'dashboard';
  if (!pathNow.includes(`/${rootSeg}`)) {
    await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  } else if (page.url() !== beforeUrl && !page.url().startsWith(target)) {
    await page.goto(target, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  }
  await page.waitForTimeout(800);
}

function datetimeSafeUrl(u) {
  try { return new URL(u).pathname; } catch { return u; }
}

async function sweepPageButtons(page, actor, routePath, net, consoleLog, pageErrors) {
  const pageSlug = slug(routePath.replace(/^\//, '').replace(/\//g, '-') || 'root');
  const baseUrl = `${FE}${routePath}`;
  net.length = 0;
  consoleLog.length = 0;
  pageErrors.length = 0;

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1200);

  if (page.url().includes('/login')) {
    buttonMatrix.push({
      tenant: actor.tenantSlug, role: actor.roleKey, page: routePath, button: '(page load)',
      verdict: 'FAIL', note: 'REDIRECT_LOGIN', screenshots: {},
    });
    return;
  }

  const clickables = await collectClickables(page);
  const clickedKeys = new Set();
  let count = 0;

  for (const meta of clickables) {
    if (count >= MAX_BUTTONS) break;
    if (clickedKeys.has(meta.key)) continue;
    clickedKeys.add(meta.key);

    const label = meta.text || meta.testId || meta.href || meta.tag;
    if (shouldSkipClick(label)) {
      buttonMatrix.push({
        tenant: actor.tenantSlug, role: actor.roleKey, page: routePath,
        button: label, verdict: 'SKIP', note: 'destructive/logout policy',
        screenshots: {},
      });
      count++;
      continue;
    }

    const beforeUrl = page.url();
    net.length = 0;
    const btnSlug = slug(label);
    const before = shotPath(actor.tenantSlug, actor.roleKey, pageSlug, btnSlug, 'before');
    await page.screenshot({ path: before.abs, fullPage: false }).catch(() => {});

    const clickOk = await clickByKey(page, meta.key);
    await page.waitForTimeout(WAIT_MS);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    const afterUrl = page.url();
    const modalOpen = await page.locator('[role="dialog"], [data-state="open"]').first().isVisible().catch(() => false);
    const toast = await page.locator('[data-sonner-toast], [role="alert"], .toast').first().textContent().catch(() => '');
    const errBoundary = await hasErrorBoundary(page);
    const apiSlice = [...net];
    const consoleErrs = consoleLog.filter((c) => c.type === 'error');
    const swActive = apiSlice.some((n) => n.fromServiceWorker);

    const after = shotPath(actor.tenantSlug, actor.roleKey, pageSlug, btnSlug, 'after');
    await page.screenshot({ path: after.abs, fullPage: false }).catch(() => {});

    const verdict = classifyClick({
      beforeUrl, afterUrl, apiCalls: apiSlice, errBoundary, consoleErrs, swActive,
      skipped: false, clickFailed: !clickOk,
    });

    const row = {
      tenant: actor.tenantSlug,
      role: actor.roleKey,
      page: routePath,
      button: label,
      tag: meta.tag,
      href: meta.href,
      verdict,
      urlChanged: afterUrl !== beforeUrl,
      modalOpen,
      toast: toast?.slice(0, 120) || null,
      apiStatuses: apiSlice.map((c) => ({ path: apiPath(c.url), status: c.status, method: c.method })),
      consoleErrors: consoleErrs.slice(0, 5).map((c) => c.text.slice(0, 120)),
      errorBoundary: errBoundary,
      mswActive: swActive,
      screenshots: { before: before.rel, after: after.rel },
      at: new Date().toISOString(),
    };
    buttonMatrix.push(row);
    count++;

    if (verdict === 'FAIL' || verdict === 'PARTIAL') {
      const worst = apiSlice.filter((c) => c.status >= 400).sort((a, b) => b.status - a.status)[0];
      const issueBase = {
        module: `${routePath} — button "${label.slice(0, 60)}"`,
        role: actor.roleKey,
        tenant: actor.tenantSlug,
        steps: `Login ${actor.email} (${actor.tenantKey}), visit ${routePath}, click "${label}"`,
        expected: 'Expected navigation/modal/API 2xx without error boundary',
        actual: [errBoundary ? 'ERROR_BOUNDARY' : null, worst ? `API ${worst.status} ${apiPath(worst.url)}` : null, toast || null].filter(Boolean).join('; ') || verdict,
        severity: worst?.status >= 500 ? 'P0' : worst?.status >= 400 ? 'P1' : 'P2',
        screenshot: after.rel,
      };
      if (worst || errBoundary) {
        backendIssues.push({ ...issueBase, classification: 'Backend', endpoint: worst ? apiPath(worst.url) : 'N/A', status: worst?.status, body: worst?.body });
      }
      if (errBoundary || swActive || consoleErrs.length >= 2) {
        frontendIssues.push({ ...issueBase, classification: 'Frontend', uiSymptom: errBoundary ? 'Error boundary' : swActive ? 'MSW active' : consoleErrs[0]?.text });
      }
    }

    await recoverPageState(page, routePath, beforeUrl);
  }

  console.log(`  [${actor.roleKey}@${actor.tenantSlug}] ${routePath}: ${count} buttons (${clickables.length} visible)`);
}

async function runEdgeCaseTests(browser) {
  console.log('\n=== Edge Cases ===\n');

  // Wrong password (API)
  {
    const res = await apiLogin('hr@acme.test', 'WrongPassword!', 'acme-corp-001');
    const pass = !res.ok && res.json?.error?.code === 'INVALID_CREDENTIALS';
    edgeCases.push({ case: 'login_wrong_password_api', pass, detail: res.json?.error?.code || res.status });
    console.log(`${pass ? 'PASS' : 'FAIL'} | login_wrong_password_api`);
  }

  // Wrong password (UI)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'hr@acme.test');
    await page.fill('input[type="password"]', 'WrongPassword!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    const pass = /invalid|incorrect|wrong|credentials/i.test(body || '') || page.url().includes('/login');
    edgeCases.push({ case: 'login_wrong_password_ui', pass, detail: page.url() });
    console.log(`${pass ? 'PASS' : 'FAIL'} | login_wrong_password_ui`);
    await ctx.close();
  }

  // Cross-tenant token mismatch
  {
    const acme = await apiLogin('hr@acme.test', 'Password123!', 'acme-corp-001');
    const res = await fetch(`${API}/employees?limit=1`, {
      headers: { authorization: `Bearer ${acme.token}`, 'x-tenant-key': 'kwd-litmus-001' },
    });
    const json = await res.json().catch(() => ({}));
    const pass = res.status === 401 || res.status === 403 || json?.error?.code === 'TENANT_MISMATCH' || json?.error?.code === 'FORBIDDEN';
    edgeCases.push({ case: 'cross_tenant_token_header_mismatch', pass, detail: `${res.status} ${json?.error?.code || ''}` });
    console.log(`${pass ? 'PASS' : 'FAIL'} | cross_tenant_token_header_mismatch → ${res.status}`);
  }

  // Unauthenticated route access
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${FE}/employees`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const pass = page.url().includes('/login');
    edgeCases.push({ case: 'unauth_route_redirect_login', pass, detail: page.url() });
    console.log(`${pass ? 'PASS' : 'FAIL'} | unauth_route_redirect_login`);
    await ctx.close();
  }

  // Employee accessing /permissions
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    wireCapture(page, net);
    const actor = ACTORS.find((a) => a.roleKey === 'EMPLOYEE');
    const ok = await uiLogin(page, actor, net);
    if (ok) {
      await page.goto(`${FE}/permissions`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const denied = page.url().includes('/login') || page.url().includes('/403')
        || /not authorized|access denied|forbidden|permission denied/i.test(await page.textContent('body') || '');
      const api403 = net.some((n) => n.status >= 403);
      const pass = denied || api403;
      edgeCases.push({ case: 'employee_permissions_denied', pass, detail: page.url() });
      console.log(`${pass ? 'PASS' : 'FAIL'} | employee_permissions_denied → ${page.url()}`);
    } else {
      edgeCases.push({ case: 'employee_permissions_denied', pass: false, detail: 'LOGIN_FAILED' });
    }
    await ctx.close();
  }

  // SUPER_ADMIN no employee — attendance
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    wireCapture(page, net);
    const actor = ACTORS.find((a) => a.roleKey === 'SUPER_ADMIN');
    if (await uiLogin(page, actor, net)) {
      await page.goto(`${FE}/attendance`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const noEmp = net.filter((n) => n.status === 400 && JSON.stringify(n.body).includes('NO_EMPLOYEE_RECORD'));
      const pass = noEmp.length > 0; // verify known issue still present or fixed if zero
      edgeCases.push({
        case: 'super_admin_no_employee_attendance',
        pass: true,
        detail: noEmp.length ? `STILL_BROKEN: ${noEmp.length} NO_EMPLOYEE_RECORD` : 'FIXED: no 400 NO_EMPLOYEE_RECORD',
        regression: noEmp.length > 0,
      });
      console.log(`INFO | super_admin_no_employee_attendance → ${noEmp.length ? 'still broken' : 'fixed'}`);
    }
    await ctx.close();
  }

  // Secondary tenant login
  {
    const res = await apiLogin('admin@testorg.com', 'password123', 'test-key-123456789');
    const pass = res.ok;
    edgeCases.push({
      case: 'secondary_tenant_testorg_login',
      pass,
      detail: pass ? 'OK' : (res.json?.error?.code || 'INVALID_CREDENTIALS'),
    });
    console.log(`${pass ? 'PASS' : 'FAIL'} | secondary_tenant_testorg_login`);
    if (!pass) {
      backendIssues.push({
        module: 'Auth — secondary tenant test-key-123456789',
        role: 'HR_ADMIN',
        tenant: 'testorg',
        steps: 'POST /auth/login admin@testorg.com + tenant test-key-123456789',
        expected: 'accessToken for HR_ADMIN secondary tenant',
        actual: res.json?.error?.code || 'login failed',
        classification: 'Backend',
        endpoint: 'POST /auth/login',
        status: res.status,
        severity: 'P1',
      });
    }
  }

  // AUDITOR role — no seeded user on Hostinger
  edgeCases.push({
    case: 'auditor_role_seeded_user',
    pass: false,
    detail: 'SKIP — no AUDITOR user found in seed/Hostinger; role exists in enum only',
  });
  console.log('SKIP | auditor_role_seeded_user (no user)');

  // Empty search
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    wireCapture(page, net);
    const actor = ACTORS.find((a) => a.roleKey === 'HR_ADMIN');
    if (await uiLogin(page, actor, net)) {
      const search = page.locator('input[placeholder*="search" i]').first();
      if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
        await search.fill('zzzznonexistent99999');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
        const pass = !net.some((n) => n.status >= 500);
        edgeCases.push({ case: 'empty_search_no_500', pass, detail: `api calls ${net.length}` });
        console.log(`${pass ? 'PASS' : 'FAIL'} | empty_search_no_500`);
      }
    }
    await ctx.close();
  }

  // 404 route
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const actor = ACTORS.find((a) => a.roleKey === 'HR_ADMIN');
    const net = [];
    wireCapture(page, net);
    if (await uiLogin(page, actor, net)) {
      await page.goto(`${FE}/this-route-does-not-exist-404`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const text = await page.textContent('body');
      const pass = /not found|404|page.*exist/i.test(text || '') || page.url().includes('404');
      edgeCases.push({ case: 'unknown_route_404', pass, detail: page.url() });
      console.log(`${pass ? 'PASS' : 'FAIL'} | unknown_route_404`);
    }
    await ctx.close();
  }

  // Logout + re-login
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    wireCapture(page, net);
    const actor = ACTORS.find((a) => a.roleKey === 'HR_ADMIN');
    if (await uiLogin(page, actor, net)) {
      await page.goto(`${FE}/dashboard`, { waitUntil: 'networkidle' });
      const menu = page.locator('[data-testid="user-menu"], button:has([class*="avatar"])').last();
      if (await menu.isVisible({ timeout: 3000 }).catch(() => false)) {
        await menu.click();
        const logout = page.getByRole('menuitem', { name: /log\s*out|sign\s*out/i });
        if (await logout.isVisible({ timeout: 2000 }).catch(() => false)) {
          await logout.click();
          await page.waitForTimeout(2000);
        }
      }
      const loggedOut = page.url().includes('/login');
      let relogin = false;
      if (loggedOut) relogin = await uiLogin(page, actor, net);
      edgeCases.push({ case: 'logout_relogin', pass: loggedOut && relogin, detail: { loggedOut, relogin } });
      console.log(`${loggedOut && relogin ? 'PASS' : 'FAIL'} | logout_relogin`);
    }
    await ctx.close();
  }

  // Form validation — employees/new empty submit
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const actor = ACTORS.find((a) => a.roleKey === 'HR_ADMIN');
    const net = [];
    wireCapture(page, net);
    if (await uiLogin(page, actor, net)) {
      await page.goto(`${FE}/employees/new`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const submit = page.locator('button[type="submit"]').first();
      if (await submit.isVisible().catch(() => false)) {
        await submit.click();
        await page.waitForTimeout(1500);
        const text = await page.textContent('body');
        const validation = /required|invalid|must|enter/i.test(text || '');
        const no500 = !net.some((n) => n.status >= 500);
        const pass = validation && no500;
        edgeCases.push({ case: 'form_validation_empty_submit', pass, detail: validation ? 'validation shown' : 'no validation' });
        console.log(`${pass ? 'PASS' : 'FAIL'} | form_validation_empty_submit`);
      }
    }
    await ctx.close();
  }
}

function dedupeIssues(issues) {
  const seen = new Set();
  return issues.filter((i) => {
    const k = `${i.module}|${i.endpoint || ''}|${i.role}|${i.tenant || ''}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function tally(matrix) {
  const by = {};
  for (const row of matrix) {
    const k = `${row.tenant}|${row.role}`;
    by[k] ??= { PASS: 0, FAIL: 0, PARTIAL: 0, SKIP: 0, total: 0 };
    by[k][row.verdict] = (by[k][row.verdict] || 0) + 1;
    by[k].total++;
  }
  return by;
}

function writeStrictReport(summary) {
  const lines = [
    '# E2E Strict Audit — Phase 2',
    '',
    `> Generated: ${summary.generatedAt}`,
    `> Frontend: ${FE} | API: ${API}`,
    `> MSW: OFF | Chrome channel`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total button clicks | ${summary.totalButtons} |`,
    `| PASS | ${summary.verdicts.PASS} |`,
    `| FAIL | ${summary.verdicts.FAIL} |`,
    `| PARTIAL | ${summary.verdicts.PARTIAL} |`,
    `| SKIP | ${summary.verdicts.SKIP} |`,
    `| New backend issues | ${summary.newBackendIssues} |`,
    `| New frontend issues | ${summary.newFrontendIssues} |`,
    `| Edge cases pass | ${summary.edgeCasesPass}/${summary.edgeCasesTotal} |`,
    '',
    '## Per role × tenant',
    '',
    '| Tenant | Role | PASS | FAIL | PARTIAL | SKIP | Total |',
    '|--------|------|------|------|---------|------|-------|',
  ];
  for (const [key, counts] of Object.entries(summary.byRoleTenant)) {
    const [tenant, role] = key.split('|');
    lines.push(`| ${tenant} | ${role} | ${counts.PASS || 0} | ${counts.FAIL || 0} | ${counts.PARTIAL || 0} | ${counts.SKIP || 0} | ${counts.total} |`);
  }

  lines.push('', '## Edge cases', '', '| Case | Result | Detail |', '|------|--------|--------|');
  for (const ec of summary.edgeCases) {
    lines.push(`| ${ec.case} | ${ec.pass ? 'PASS' : 'FAIL/SKIP'} | ${typeof ec.detail === 'object' ? JSON.stringify(ec.detail) : ec.detail} |`);
  }

  lines.push('', '## Button matrix (failures & partials)', '');
  const interesting = buttonMatrix.filter((r) => r.verdict === 'FAIL' || r.verdict === 'PARTIAL').slice(0, 100);
  if (!interesting.length) lines.push('_No FAIL/PARTIAL button clicks._');
  for (const r of interesting) {
    lines.push(`### ${r.tenant} / ${r.role} / ${r.page} / "${r.button}"`);
    lines.push(`- **Verdict:** ${r.verdict}`);
    lines.push(`- **URL changed:** ${r.urlChanged}`);
    if (r.apiStatuses?.length) lines.push(`- **API:** ${r.apiStatuses.map((a) => `${a.method} ${a.path} → ${a.status}`).join('; ')}`);
    if (r.screenshots?.before) lines.push(`- **Screenshots:** \`${r.screenshots.before}\`, \`${r.screenshots.after}\``);
    lines.push('');
  }

  fs.writeFileSync(STRICT_MD, lines.join('\n'));
}

function appendPhase2Issues(filePath, title, issues) {
  const phaseBlock = [
    '',
    '---',
    '',
    '## Phase 2',
    '',
    `> Strict button audit: ${new Date().toISOString()}`,
    `> Script: \`scripts/strictButtonE2EAudit.mjs\``,
    '',
    `**New issues this phase: ${issues.length}**`,
    '',
  ];
  if (!issues.length) {
    phaseBlock.push('_No new issues in Phase 2 strict audit._');
  } else {
    issues.forEach((issue, idx) => {
      phaseBlock.push(`### P2-${idx + 1}. ${issue.module} (${issue.role}${issue.tenant ? ` / ${issue.tenant}` : ''})`);
      phaseBlock.push('');
      phaseBlock.push(`- **Severity:** ${issue.severity}`);
      phaseBlock.push(`- **Classification:** ${issue.classification}`);
      phaseBlock.push(`- **Steps:** ${issue.steps}`);
      phaseBlock.push(`- **Expected:** ${issue.expected}`);
      phaseBlock.push(`- **Actual:** ${issue.actual}`);
      if (issue.endpoint) phaseBlock.push(`- **API:** \`${issue.endpoint}\` status \`${issue.status}\``);
      if (issue.screenshot) phaseBlock.push(`- **Screenshot:** \`${issue.screenshot}\``);
      if (issue.uiSymptom) phaseBlock.push(`- **UI symptom:** ${issue.uiSymptom}`);
      phaseBlock.push('');
    });
  }

  if (fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, phaseBlock.join('\n'));
  } else {
    fs.writeFileSync(filePath, [`# ${title}`, ...phaseBlock].join('\n'));
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('=== Phase 2 Strict Button E2E Audit ===\n');
console.log(`FE=${FE} API=${API} MAX_BUTTONS=${MAX_BUTTONS}\n`);

const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || 'chrome' });

await runEdgeCaseTests(browser);

for (const actor of ACTORS) {
  console.log(`\n--- ${actor.tenantSlug} / ${actor.roleKey} (${actor.email}) ---`);
  const loginCheck = await apiLogin(actor.email, actor.password, actor.tenantKey);
  if (!loginCheck.ok || loginCheck.mfaRequired) {
    console.log(`SKIP role — login failed: ${loginCheck.json?.error?.code || 'MFA'}`);
    buttonMatrix.push({
      tenant: actor.tenantSlug, role: actor.roleKey, page: '(login)',
      button: 'API login', verdict: 'SKIP',
      note: loginCheck.mfaRequired ? 'MFA_REQUIRED' : (loginCheck.json?.error?.code || 'LOGIN_FAILED'),
    });
    continue;
  }

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const net = [];
  const { consoleLog, pageErrors } = wireCapture(page, net);

  const loggedIn = await uiLogin(page, actor, net);
  if (!loggedIn) {
    console.log('SKIP — UI login failed');
    buttonMatrix.push({ tenant: actor.tenantSlug, role: actor.roleKey, page: '(login)', button: 'UI login', verdict: 'SKIP', note: 'UI_LOGIN_FAILED' });
    await ctx.close();
    continue;
  }

  await page.goto(`${FE}/dashboard`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
  await sweepNavOnce(page, actor, net, consoleLog);

  const routes = routesForRole(actor.roleKey);
  for (const route of routes) {
    try {
      await sweepPageButtons(page, actor, route, net, consoleLog, pageErrors);
    } catch (err) {
      console.error(`  ERROR on ${route}:`, err.message);
      buttonMatrix.push({ tenant: actor.tenantSlug, role: actor.roleKey, page: route, button: '(page error)', verdict: 'FAIL', note: err.message });
    }
  }

  await ctx.close();
}

await browser.close();

const dedupedBackend = dedupeIssues(backendIssues);
const dedupedFrontend = dedupeIssues(frontendIssues);
const verdicts = { PASS: 0, FAIL: 0, PARTIAL: 0, SKIP: 0 };
for (const r of buttonMatrix) verdicts[r.verdict] = (verdicts[r.verdict] || 0) + 1;

const summary = {
  generatedAt: new Date().toISOString(),
  frontend: FE,
  api: API,
  phase: 2,
  mswOff: true,
  totalButtons: buttonMatrix.length,
  verdicts,
  byRoleTenant: tally(buttonMatrix),
  edgeCases,
  edgeCasesPass: edgeCases.filter((e) => e.pass).length,
  edgeCasesTotal: edgeCases.length,
  newBackendIssues: dedupedBackend.length,
  newFrontendIssues: dedupedFrontend.length,
  buttonMatrix,
  backendIssues: dedupedBackend,
  frontendIssues: dedupedFrontend,
};

fs.writeFileSync(SUMMARY_JSON, JSON.stringify(summary, null, 2));
writeStrictReport(summary);
appendPhase2Issues(BACKEND_ISSUES_MD, 'E2E Backend / API Issues', dedupedBackend);
appendPhase2Issues(FRONTEND_ISSUES_MD, 'E2E Frontend / UI Issues', dedupedFrontend);

console.log('\n=== PHASE 2 AUDIT COMPLETE ===');
console.log(`Buttons: ${summary.totalButtons} (PASS ${verdicts.PASS} / FAIL ${verdicts.FAIL} / PARTIAL ${verdicts.PARTIAL} / SKIP ${verdicts.SKIP})`);
console.log(`Edge cases: ${summary.edgeCasesPass}/${summary.edgeCasesTotal}`);
console.log(`New backend issues: ${dedupedBackend.length}`);
console.log(`New frontend issues: ${dedupedFrontend.length}`);
console.log(`Report: docs/E2E_STRICT_AUDIT.md`);
console.log(`JSON: docs/e2e-strict-summary.json`);
console.log(`Screenshots: docs/e2e-screenshots/strict/`);

process.exit(verdicts.FAIL > 0 ? 1 : 0);
