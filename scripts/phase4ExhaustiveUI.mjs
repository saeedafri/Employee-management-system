/**
 * Phase 4 — Exhaustive UI button sweep (gap modules + re-sweep critical paths).
 * MSW OFF. Chrome channel. STRICT_MAX_BUTTONS default 120.
 *
 * Usage: FE_BASE=http://localhost:3001 node scripts/phase4ExhaustiveUI.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FE = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_URL || 'https://ems-api.saqibsaeed.cloud/api/v1';
const SHOT_DIR = path.join(ROOT, 'docs/e2e-screenshots/phase4/ui');
const OUT_JSON = path.join(ROOT, 'docs/e2e-phase4-ui-results.json');
const MAX_BUTTONS = Number(process.env.STRICT_MAX_BUTTONS || 120);
const WAIT_MS = Number(process.env.STRICT_WAIT_MS || 1500);

fs.mkdirSync(SHOT_DIR, { recursive: true });

/** @type {typeof import('./strictButtonE2EAudit.mjs')} — inline actors */
const ACTORS = [
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'HR_ADMIN', email: 'hr@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'SUPER_ADMIN', email: 'superadmin@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'MANAGER', email: 'aman@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'EMPLOYEE', email: 'priya@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'EMPLOYEE_DEV', email: 'dev1@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'EMPLOYEE_FIN', email: 'fin1@acme.test', password: 'Password123!' },
  { tenantKey: 'acme-corp-001', tenantSlug: 'acme', roleKey: 'EMPLOYEE_ONLEAVE', email: 'onleave@acme.test', password: 'Password123!' },
  { tenantKey: 'kwd-litmus-001', tenantSlug: 'kwd', roleKey: 'HR_ADMIN', email: 'admin@kwd.test', password: 'Password123!' },
  { tenantKey: 'global-payroll-litmus-001', tenantSlug: 'global', roleKey: 'HR_ADMIN', email: 'hr@global-litmus.test', password: 'Password123!' },
  { tenantKey: 'qa-regression-org-001', tenantSlug: 'qa', roleKey: 'AUDITOR', email: 'npjktdbh@guerrillamailblock.com', password: 'Password123!' },
];

const PHASE4_ROUTES = [
  '/recruitment', '/performance', '/reports', '/analytics', '/announcements', '/assets',
  '/payroll/global', '/payroll', '/payroll/my-payslips', '/payroll/migration',
  '/employees/new', '/employees', '/settings/audit-log', '/settings',
  '/settings/company-profile', '/settings/locale', '/settings/working-hours',
  '/settings/pay/components', '/settings/pay/statutory-packs', '/settings/pay/legal-entities',
  '/settings/pay/groups', '/settings/pay/schedules', '/settings/pay/payslip-template',
  '/settings/pay/data-policy', '/settings/pay/country-bank-schemas',
  '/settings/leave-types', '/settings/leave-policies', '/settings/leave-packs',
  '/settings/leave-assignments', '/settings/attendance-rules', '/settings/timesheets',
  '/settings/notifications', '/settings/email-templates', '/settings/branding',
  '/settings/authentication', '/settings/sessions', '/settings/integration-email',
  '/settings/integration-storage', '/settings/integration-webhooks',
  '/settings/billing-plan', '/settings/billing-invoices',
  '/permissions', '/payout-methods', '/payout-methods/approvals',
  '/dashboard', '/departments', '/attendance', '/timesheets', '/leave', '/holidays',
];

const SKIP_TEXT = [
  /delete\s+permanently|permanently\s+delete|confirm\s+delete/i,
  /send\s+payroll|finalize\s+payroll|submit\s+payroll\s+run/i,
  /remove\s+employee|terminate\s+employee/i,
];

const buttonMatrix = [];
const backendIssues = [];
const frontendIssues = [];

function slug(s, max = 40) {
  return (s || 'unnamed').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max) || 'unnamed';
}

function shotPath(tenantSlug, roleKey, pageSlug, buttonSlug, phase) {
  const name = `${tenantSlug}-${roleKey}-${pageSlug}-${buttonSlug}-${phase}.png`;
  return { rel: `docs/e2e-screenshots/phase4/ui/${name}`, abs: path.join(SHOT_DIR, name) };
}

function routesForRole(roleKey) {
  if (roleKey === 'AUDITOR') {
    return ['/dashboard', '/settings/audit-log', '/reports', '/analytics', '/employees', '/attendance'];
  }
  if (roleKey === 'MANAGER' || roleKey.startsWith('EMPLOYEE')) {
    return PHASE4_ROUTES.filter((r) => !r.startsWith('/settings') && !['/permissions', '/analytics', '/payroll/global', '/payroll/migration'].includes(r));
  }
  if (roleKey === 'HR_ADMIN' || roleKey === 'SUPER_ADMIN') return PHASE4_ROUTES;
  return PHASE4_ROUTES.slice(0, 15);
}

function shouldSkipClick(text) { return SKIP_TEXT.some((re) => re.test(text)); }

function apiPath(url) {
  try { return new URL(url).pathname.replace(/^\/api\/v1/, '') || new URL(url).pathname; } catch { return url; }
}

function wireCapture(page, bucket) {
  const consoleLog = [];
  const pageErrors = [];
  page.on('console', (m) => consoleLog.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('response', async (r) => {
    if (!r.url().includes('/api/')) return;
    let body = null;
    try {
      const ct = r.headers()['content-type'] || '';
      body = ct.includes('json') ? await r.json() : (await r.text()).slice(0, 600);
    } catch { /* noop */ }
    let fromSW = false;
    try { fromSW = await r.fromServiceWorker(); } catch { /* noop */ }
    bucket.push({ url: r.url(), method: r.request().method(), status: r.status(), body, fromServiceWorker: fromSW });
  });
  return { consoleLog, pageErrors };
}

async function apiLogin(email, password, tenant) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-key': tenant },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json?.success, mfaRequired: json?.data?.mfaRequired, token: json?.data?.accessToken };
}

async function uiLogin(page, actor, net) {
  const pre = await apiLogin(actor.email, actor.password, actor.tenantKey);
  if (!pre.ok || pre.mfaRequired) return false;
  await page.goto(`${FE}/login`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.fill('#email, input[name="email"], input[type="email"]', actor.email);
  await page.fill('#password, input[name="password"], input[type="password"]', actor.password);
  const tenantInput = page.locator('input[name="tenantKey"], #tenantKey');
  if (await tenantInput.count()) await tenantInput.fill(actor.tenantKey);
  net.length = 0;
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login') && !u.pathname.includes('/otp'), { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return !page.url().includes('/login');
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

async function clickByKey(page, key) {
  return page.evaluate((targetKey) => {
    const sel = 'button, [role="button"], a[href], input[type="submit"], [data-testid]';
    const seen = new Set();
    for (const el of document.querySelectorAll(sel)) {
      const inNav = el.closest('nav, aside, [role="navigation"], [data-testid="sidebar"]');
      if (inNav) continue;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (rect.width < 2 || rect.height < 2) continue;
      if (style.visibility === 'hidden' || style.display === 'none') continue;
      const text = (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
      const href = el.getAttribute('href') || '';
      const testId = el.getAttribute('data-testid') || '';
      const tag = el.tagName.toLowerCase();
      const k = `${tag}|${text}|${href}|${testId}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (k === targetKey) { el.scrollIntoView({ block: 'center' }); el.click(); return true; }
    }
    return false;
  }, key);
}

async function hasErrorBoundary(page) {
  const text = await page.evaluate(() => document.body?.innerText || '');
  return /something went wrong|unexpected error|application error|failed to load/i.test(text);
}

function classifyClick({ apiCalls, errBoundary, consoleErrs, swActive, clickFailed }) {
  if (clickFailed) return 'PARTIAL';
  if (errBoundary || swActive) return 'FAIL';
  const badApi = apiCalls.filter((c) => c.status >= 500);
  if (badApi.length) return 'FAIL';
  const client4xx = apiCalls.filter((c) => c.status >= 400 && c.status < 500 && !c.url.includes('/notifications/unread-count'));
  const hardConsole = consoleErrs.filter((c) => c.type === 'error' && !/favicon|React DevTools|hydration/i.test(c.text));
  if (client4xx.length >= 2 || hardConsole.length >= 3) return 'PARTIAL';
  return 'PASS';
}

async function recoverPageState(page, routePath) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await page.goto(`${FE}${routePath}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function sweepPageButtons(page, actor, routePath, net, consoleLog) {
  const pageSlug = slug(routePath.replace(/^\//, '').replace(/\//g, '-') || 'root');
  net.length = 0;
  consoleLog.length = 0;
  await page.goto(`${FE}${routePath}`, { waitUntil: 'networkidle', timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1000);

  if (page.url().includes('/login')) {
    buttonMatrix.push({ tenant: actor.tenantSlug, role: actor.roleKey, page: routePath, button: '(load)', verdict: 'FAIL', note: 'REDIRECT_LOGIN' });
    return 0;
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
      buttonMatrix.push({ tenant: actor.tenantSlug, role: actor.roleKey, page: routePath, button: label, verdict: 'SKIP' });
      count++;
      continue;
    }

    net.length = 0;
    const btnSlug = slug(label);
    const before = shotPath(actor.tenantSlug, actor.roleKey, pageSlug, btnSlug, 'before');
    await page.screenshot({ path: before.abs, fullPage: false }).catch(() => {});
    const clickOk = await clickByKey(page, meta.key);
    await page.waitForTimeout(WAIT_MS);
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});

    const apiSlice = [...net];
    const consoleErrs = consoleLog.filter((c) => c.type === 'error');
    const errBoundary = await hasErrorBoundary(page);
    const verdict = classifyClick({ apiCalls: apiSlice, errBoundary, consoleErrs, swActive: apiSlice.some((n) => n.fromServiceWorker), clickFailed: !clickOk });
    const after = shotPath(actor.tenantSlug, actor.roleKey, pageSlug, btnSlug, 'after');
    await page.screenshot({ path: after.abs, fullPage: false }).catch(() => {});

    buttonMatrix.push({
      tenant: actor.tenantSlug, role: actor.roleKey, page: routePath, button: label, verdict,
      apiStatuses: apiSlice.filter((c) => c.status >= 400).map((c) => ({ path: apiPath(c.url), status: c.status })),
      consoleErrors: consoleErrs.slice(0, 3).map((c) => c.text.slice(0, 100)),
      errorBoundary: errBoundary,
      screenshots: { before: before.rel, after: after.rel },
    });
    count++;

    if (verdict === 'FAIL' || verdict === 'PARTIAL') {
      const worst = apiSlice.filter((c) => c.status >= 400).sort((a, b) => b.status - a.status)[0];
      const issue = {
        module: `${routePath} — "${label.slice(0, 50)}"`,
        role: actor.roleKey, tenant: actor.tenantSlug, verdict,
        endpoint: worst ? apiPath(worst.url) : null, status: worst?.status,
        severity: worst?.status >= 500 ? 'P0' : worst?.status >= 400 ? 'P1' : 'P2',
        screenshot: after.rel,
      };
      if (worst?.status >= 400 || errBoundary) backendIssues.push(issue);
      if (errBoundary || consoleErrs.length >= 2) frontendIssues.push(issue);
    }
    await recoverPageState(page, routePath);
  }
  console.log(`  [${actor.roleKey}@${actor.tenantSlug}] ${routePath}: ${count}/${clickables.length} buttons`);
  return count;
}

async function sweepReportsTabs(page, actor, net, consoleLog) {
  await page.goto(`${FE}/reports`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const tabs = await page.locator('[role="tab"], button[data-state]').all();
  let count = 0;
  for (const tab of tabs.slice(0, 12)) {
    const label = (await tab.textContent())?.trim() || `tab-${count}`;
    net.length = 0;
    const before = shotPath(actor.tenantSlug, actor.roleKey, 'reports-tabs', slug(label), 'before');
    await page.screenshot({ path: before.abs }).catch(() => {});
    await tab.click().catch(() => {});
    await page.waitForTimeout(WAIT_MS);
    const after = shotPath(actor.tenantSlug, actor.roleKey, 'reports-tabs', slug(label), 'after');
    await page.screenshot({ path: after.abs }).catch(() => {});
    const verdict = net.some((n) => n.status >= 500) ? 'FAIL' : 'PASS';
    buttonMatrix.push({ tenant: actor.tenantSlug, role: actor.roleKey, page: '/reports', button: `tab:${label}`, verdict, screenshots: { before: before.rel, after: after.rel } });
    count++;
  }
  return count;
}

async function sweepPayrollGlobalTabs(page, actor, net) {
  await page.goto(`${FE}/payroll/global`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const tabs = await page.locator('[role="tab"], button:has-text("IN"), button:has-text("AE"), button:has-text("SA"), button:has-text("CA"), button:has-text("SG"), button:has-text("VN")').all();
  let count = 0;
  for (const tab of tabs.slice(0, 10)) {
    const label = (await tab.textContent())?.trim() || `country-${count}`;
    net.length = 0;
    const before = shotPath(actor.tenantSlug, actor.roleKey, 'payroll-global', slug(label), 'before');
    await page.screenshot({ path: before.abs }).catch(() => {});
    await tab.click().catch(() => {});
    await page.waitForTimeout(WAIT_MS);
    const after = shotPath(actor.tenantSlug, actor.roleKey, 'payroll-global', slug(label), 'after');
    await page.screenshot({ path: after.abs }).catch(() => {});
    buttonMatrix.push({ tenant: actor.tenantSlug, role: actor.roleKey, page: '/payroll/global', button: `country:${label}`, verdict: net.some((n) => n.status >= 500) ? 'FAIL' : 'PASS' });
    count++;
  }
  return count;
}

async function main() {
  console.log(`\n=== Phase 4 Exhaustive UI ===\nFE=${FE} MAX_BUTTONS=${MAX_BUTTONS}\n`);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  let totalClicks = 0;
  let screenshotCount = 0;

  for (const actor of ACTORS) {
    const pre = await apiLogin(actor.email, actor.password, actor.tenantKey);
    if (!pre.ok) {
      console.log(`SKIP login ${actor.roleKey}@${actor.tenantSlug}`);
      buttonMatrix.push({ tenant: actor.tenantSlug, role: actor.roleKey, page: '(login)', button: 'api_login', verdict: 'FAIL', note: 'LOGIN_FAILED' });
      continue;
    }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const net = [];
    const { consoleLog } = wireCapture(page, net);
    if (!await uiLogin(page, actor, net)) {
      console.log(`SKIP UI login ${actor.roleKey}@${actor.tenantSlug}`);
      await ctx.close();
      continue;
    }

    const routes = routesForRole(actor.roleKey);
    for (const route of routes) {
      totalClicks += await sweepPageButtons(page, actor, route, net, consoleLog);
    }
    if (actor.roleKey === 'HR_ADMIN' || actor.roleKey === 'SUPER_ADMIN') {
      totalClicks += await sweepReportsTabs(page, actor, net, consoleLog);
      if (actor.tenantSlug === 'global' || actor.tenantSlug === 'acme') {
        totalClicks += await sweepPayrollGlobalTabs(page, actor, net);
      }
    }
    await ctx.close();
  }

  await browser.close();
  screenshotCount = fs.readdirSync(SHOT_DIR).filter((f) => f.endsWith('.png')).length;

  const tally = { PASS: 0, FAIL: 0, PARTIAL: 0, SKIP: 0 };
  for (const r of buttonMatrix) tally[r.verdict] = (tally[r.verdict] || 0) + 1;

  const summary = {
    generatedAt: new Date().toISOString(),
    fe: FE,
    maxButtonsPerPage: MAX_BUTTONS,
    actors: ACTORS.length,
    totalButtonClicks: totalClicks,
    matrixRows: buttonMatrix.length,
    screenshots: screenshotCount,
    tally,
    buttonMatrix,
    backendIssues,
    frontendIssues,
    notTested: [
      { item: '/resignations UI', reason: 'No frontend route exists (src/app has no resignations page)' },
      { item: 'testorg tenant', reason: 'Tenant test-key-123456789 not on Hostinger DB' },
      { item: 'GB/US statutory packs', reason: 'No StatutoryPack rows for GB or US in Hostinger DB' },
      { item: 'KW statutory pack', reason: 'kwd-litmus-001 has no StatutoryPack row' },
    ],
  };
  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2));
  console.log(`\nUI sweep: ${totalClicks} clicks, ${screenshotCount} screenshots, tally=${JSON.stringify(tally)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
