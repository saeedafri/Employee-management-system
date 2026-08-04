/**
 * Deep SUPER_ADMIN UI E2E — Playwright Chromium
 * Screenshots + network/console capture for every sidebar menu.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const UI = process.env.UI_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://localhost:4000/api/v1';
const ROLE = 'SUPER_ADMIN';
const EMAIL = 'superadmin@acme.test';
const PASSWORD = 'Password123!';
const TENANT = 'acme-corp-001';

const MENUS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Employees', href: '/employees' },
  { label: 'Departments', href: '/departments' },
  { label: 'Attendance', href: '/attendance' },
  { label: 'Timesheets', href: '/timesheets' },
  { label: 'Leave', href: '/leave' },
  { label: 'Holidays', href: '/holidays' },
  { label: 'Payroll', href: '/payroll' },
  { label: 'Payout methods', href: '/payout-methods' },
  { label: 'Reports', href: '/reports' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Permissions', href: '/permissions' },
  { label: 'Settings', href: '/settings' },
  { label: 'Recruitment', href: '/recruitment' },
  { label: 'Performance', href: '/performance' },
  { label: 'Assets', href: '/assets' },
  { label: 'Announcements', href: '/announcements' },
];

const SETTINGS_SUB = [
  'company-profile',
  'branding',
  'locale',
  'working-hours',
  'leave-types',
  'attendance-rules',
  'timesheets',
  'leave-policies',
  'leave-packs',
  'leave-assignments',
  'pay/legal-entities',
  'pay/statutory-packs',
  'pay/components',
  'pay/groups',
  'pay/schedules',
  'pay/payslip-template',
  'pay/data-policy',
  'pay/country-bank-schemas',
  'authentication',
  'sessions',
  'audit-log',
  'email-templates',
  'notifications',
  'integration-email',
  'integration-storage',
  'integration-webhooks',
  'billing-plan',
  'billing-invoices',
];

const SKIP_TEXT =
  /sign out|logout|log out|delete all|wipe|reset database|danger zone|remove tenant|deactivate account/i;
const DESTRUCTIVE_CONFIRM = /are you sure|confirm delete|permanently|cannot be undone/i;
const APPROVE_DENY = /^(approve|deny|reject)$/i;

let shotIdx = 0;
const findings = [];
const issues = [];
const downloads = [];
const counters = {
  menus: 0,
  buttons: 0,
  screenshots: 0,
  be: 0,
  fe: 0,
  both: 0,
};

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function shot(page, name) {
  shotIdx += 1;
  const nn = String(shotIdx).padStart(2, '0');
  const file = `${nn}-${slugify(name)}.png`;
  const full = path.join(OUT, file);
  await page.screenshot({ path: full, fullPage: true }).catch(async () => {
    await page.screenshot({ path: full }).catch(() => {});
  });
  counters.screenshots += 1;
  return file;
}

function classifyNetwork(url, status, body) {
  const u = url || '';
  const isApi =
    u.includes('/api/') ||
    u.includes(':4000') ||
    u.includes('localhost:4000') ||
    u.includes('/api/v1');
  const isNext = u.includes('localhost:3001') && !u.includes('/api/');
  let classification = 'FRONTEND';
  if (isApi && status >= 400) classification = 'BACKEND';
  if (isApi && status >= 500) classification = 'BACKEND';
  if (isNext && status >= 400) classification = 'FRONTEND';
  if (body && /NO_EMPLOYEE_RECORD|NOT_IMPLEMENTED|FORBIDDEN|UNAUTHORIZED/i.test(body)) {
    classification = 'BACKEND';
  }
  // FE calling wrong path while BE has correct route → BOTH if 404 on FE BFF
  if (u.includes('localhost:3001/api/') && (status === 404 || status === 502)) {
    classification = 'BOTH';
  }
  return classification;
}

function addIssue(partial) {
  const id = `ISSUE-SA-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, role: ROLE, ...partial };
  issues.push(issue);
  if (issue.classification === 'BACKEND') counters.be += 1;
  else if (issue.classification === 'FRONTEND') counters.fe += 1;
  else counters.both += 1;
  return issue;
}

function logFinding(menu, action, status, detail = {}) {
  findings.push({
    menu,
    action,
    status,
    at: new Date().toISOString(),
    ...detail,
  });
}

async function dismissOverlays(page) {
  // Escape any open dialogs/menus; cancel destructive confirms
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
  const cancel = page
    .locator(
      'button:has-text("Cancel"), button:has-text("Close"), [aria-label="Close"], [data-state="open"] button:has-text("Cancel")',
    )
    .first();
  if (await cancel.isVisible({ timeout: 300 }).catch(() => false)) {
    await cancel.click({ timeout: 1000 }).catch(() => {});
  }
}

async function waitSettled(page, ms = 800) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

function collectors(page, state) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (/favicon|Download the React DevTools|hydration/i.test(text)) return;
      state.consoleErrors.push({ text, url: page.url(), ts: Date.now() });
    }
  });
  page.on('pageerror', (err) => {
    state.pageErrors.push({ text: String(err), url: page.url(), ts: Date.now() });
  });
  page.on('response', async (res) => {
    const status = res.status();
    const url = res.url();
    if (status < 400) return;
    if (/\.(png|jpg|jpeg|svg|css|woff2?|ico|map)(\?|$)/i.test(url)) return;
    if (/hot-update|_next\/static/i.test(url)) return;
    let body = '';
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      body = '';
    }
    state.failedRequests.push({
      method: res.request().method(),
      url,
      status,
      body,
      pageUrl: page.url(),
      ts: Date.now(),
    });
  });
  page.on('download', async (dl) => {
    const suggested = dl.suggestedFilename();
    try {
      const p = await dl.path();
      downloads.push({
        suggested,
        ok: !!p,
        path: p || null,
        pageUrl: page.url(),
        failure: dl.failure() || null,
      });
    } catch (e) {
      downloads.push({
        suggested,
        ok: false,
        path: null,
        pageUrl: page.url(),
        failure: String(e),
      });
    }
  });
}

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded' });
  await waitSettled(page, 500);
  // Tenant field if present
  const tenant = page.locator(
    'input[name="tenant"], input[id*="tenant"], input[placeholder*="tenant" i], input[name="tenantKey"]',
  );
  if (await tenant.first().isVisible({ timeout: 800 }).catch(() => false)) {
    await tenant.first().fill(TENANT);
  }
  await page.locator('#email, input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('#password, input[type="password"], input[name="password"]').first().fill(PASSWORD);
  const loginShot = await shot(page, 'login-form');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|otp)/, { timeout: 30000 }).catch(() => {});
  // OTP bypass if shown
  if (/otp/i.test(page.url())) {
    logFinding('Login', 'OTP challenge appeared', 'WARN', { url: page.url() });
    await shot(page, 'login-otp-challenge');
  }
  await waitSettled(page, 1200);
  const after = await shot(page, 'login-success-dashboard');
  if (!page.url().includes('/dashboard') && !page.url().includes('/employees')) {
    addIssue({
      title: 'Login did not reach dashboard',
      where: `Login → ${page.url()}`,
      why: 'After submit, URL did not include /dashboard',
      classification: 'BOTH',
      how: 'Verify auth cookie/BFF proxy and SUPER_ADMIN redirect',
      screenshot: after,
      network: 'POST /auth/login ?',
      expected: 'Land on /dashboard',
      actual: page.url(),
    });
  }
  logFinding('Login', 'login', page.url().includes('/dashboard') ? 'PASS' : 'FAIL', {
    screenshot: loginShot,
    url: page.url(),
  });
}

async function clickSidebar(page, label) {
  const link = page.locator(`nav[aria-label="Main navigation"] a[aria-label="${label}"]`).first();
  if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
    await link.click();
    return true;
  }
  // fallback by text
  const byText = page.locator('nav[aria-label="Main navigation"] a', { hasText: label }).first();
  if (await byText.isVisible({ timeout: 1000 }).catch(() => false)) {
    await byText.click();
    return true;
  }
  return false;
}

function actionableLocator(page) {
  return page.locator(
    [
      'main button:visible',
      'main a[href]:visible',
      '[role="main"] button:visible',
      '[role="tab"]:visible',
      '[role="dialog"] button:visible',
      '[data-radix-dialog-content] button:visible',
      'main [role="combobox"]:visible',
      'main input[type="search"]:visible',
      'main [data-testid]:visible',
    ].join(', '),
  );
}

async function getActionMeta(el) {
  const text = ((await el.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const aria = (await el.getAttribute('aria-label').catch(() => '')) || '';
  const href = (await el.getAttribute('href').catch(() => '')) || '';
  const title = (await el.getAttribute('title').catch(() => '')) || '';
  const type = (await el.getAttribute('type').catch(() => '')) || '';
  const role = (await el.getAttribute('role').catch(() => '')) || '';
  const tag = await el.evaluate((n) => n.tagName.toLowerCase()).catch(() => '');
  const label = text || aria || title || href || tag;
  return { text, aria, href, title, type, role, tag, label };
}

async function interactElement(page, el, menu, state) {
  const meta = await getActionMeta(el);
  if (!meta.label || SKIP_TEXT.test(meta.label)) return { skipped: true };
  // Avoid sidebar re-clicks inside main (shouldn't happen)
  if (meta.href && MENUS.some((m) => meta.href === m.href || meta.href.endsWith(m.href))) {
    // allow employee detail etc.
  }

  const beforeUrl = page.url();
  const beforeFails = state.failedRequests.length;
  const beforeConsole = state.consoleErrors.length;
  const beforeDl = downloads.length;

  try {
    await el.scrollIntoViewIfNeeded().catch(() => {});
    // For search inputs: type a query instead of click-only
    if (meta.tag === 'input' || (await el.getAttribute('type')) === 'search') {
      await el.fill('test').catch(async () => {
        await el.click();
        await page.keyboard.type('test');
      });
      await page.keyboard.press('Enter').catch(() => {});
      await waitSettled(page, 600);
      counters.buttons += 1;
      const ss = await shot(page, `${menu}-search-test`);
      logFinding(menu, `search "test"`, 'PASS', { screenshot: ss });
      await el.fill('').catch(() => {});
      return { ok: true };
    }

    await el.click({ timeout: 4000, trial: false });
    counters.buttons += 1;
    await waitSettled(page, 700);

    // Destructive confirm → cancel
    const dialogText = await page
      .locator('[role="dialog"], [data-radix-dialog-content], [role="alertdialog"]')
      .first()
      .innerText()
      .catch(() => '');
    if (DESTRUCTIVE_CONFIRM.test(dialogText) && !APPROVE_DENY.test(meta.label)) {
      const cancel = page.locator('button:has-text("Cancel"), button:has-text("No")').first();
      if (await cancel.isVisible({ timeout: 500 }).catch(() => false)) {
        await cancel.click().catch(() => {});
      } else {
        await page.keyboard.press('Escape');
      }
      const ss = await shot(page, `${menu}-${meta.label}-cancelled`);
      logFinding(menu, `${meta.label} (destructive cancelled)`, 'PASS', { screenshot: ss });
      return { ok: true, cancelled: true };
    }

    // Approve/Deny — still click (mutate noted)
    if (APPROVE_DENY.test(meta.label.trim())) {
      const ss = await shot(page, `${menu}-${meta.label}-clicked`);
      // confirm if needed
      const confirm = page
        .locator('button:has-text("Confirm"), button:has-text("Yes"), [role="dialog"] button:has-text("Approve"), [role="dialog"] button:has-text("Deny")')
        .first();
      if (await confirm.isVisible({ timeout: 600 }).catch(() => false)) {
        await confirm.click().catch(() => {});
        await waitSettled(page, 800);
      }
      logFinding(menu, `${meta.label} (mutation noted)`, 'PASS', {
        screenshot: ss,
        note: 'Mutated Hostinger-like data',
      });
    } else {
      const ss = await shot(page, `${menu}-${meta.label}`);
      logFinding(menu, meta.label, 'PASS', { screenshot: ss, url: page.url() });
    }

    // Export/download heuristics
    if (/export|download|pdf|excel|csv|xlsx/i.test(meta.label)) {
      await waitSettled(page, 1500);
      const newDls = downloads.slice(beforeDl);
      const relatedFails = state.failedRequests.slice(beforeFails).filter((f) =>
        /export|download|pdf|excel|csv|report/i.test(f.url + f.body),
      );
      const ok = newDls.some((d) => d.ok) || relatedFails.length === 0;
      downloads.push({
        action: meta.label,
        menu,
        triggered: true,
        files: newDls,
        fails: relatedFails,
        ok,
      });
      if (!ok || relatedFails.length) {
        const fr = relatedFails[0];
        addIssue({
          title: `Export/download failed: ${meta.label}`,
          where: `${menu} / ${beforeUrl} / button "${meta.label}"`,
          why: fr
            ? `${fr.method} ${fr.url} → ${fr.status}: ${fr.body.slice(0, 200)}`
            : 'No download event and/or failed network',
          classification: fr ? classifyNetwork(fr.url, fr.status, fr.body) : 'FRONTEND',
          how: 'Wire export endpoint + FE download handling; verify Content-Disposition',
          screenshot: findings[findings.length - 1]?.screenshot,
          network: fr ? `${fr.method} ${fr.url} ${fr.status}` : 'no download',
          expected: 'File download succeeds',
          actual: relatedFails.length ? `HTTP ${relatedFails[0].status}` : 'No file received',
        });
        logFinding(menu, meta.label, 'FAIL', { export: true });
      }
    }

    // New failures since click
    const newFails = state.failedRequests.slice(beforeFails);
    const newConsole = state.consoleErrors.slice(beforeConsole);
    for (const fr of newFails) {
      // Dedup by url+status for this menu
      const key = `${fr.method}:${fr.status}:${fr.url}`;
      if (state.seenFailKeys.has(key)) continue;
      state.seenFailKeys.add(key);
      const cls = classifyNetwork(fr.url, fr.status, fr.body);
      addIssue({
        title: `API/UI error on ${menu}: ${fr.status}`,
        where: `${menu} / ${fr.pageUrl} / after "${meta.label}"`,
        why: `${fr.method} ${fr.url} → ${fr.status}; body=${fr.body.slice(0, 220)}`,
        classification: cls,
        how:
          cls === 'BACKEND'
            ? 'Fix API route/handler or return graceful empty for SUPER_ADMIN without employeeId'
            : cls === 'FRONTEND'
              ? 'Fix FE route/client call path or error handling UX'
              : 'Align FE BFF proxy path with BE route; handle error states',
        screenshot: findings[findings.length - 1]?.screenshot,
        network: `${fr.method} ${fr.url} ${fr.status}`,
        expected: '2xx success or graceful empty UI',
        actual: `${fr.status} ${fr.body.slice(0, 120)}`,
      });
    }
    for (const ce of newConsole) {
      const key = `console:${ce.text.slice(0, 120)}`;
      if (state.seenFailKeys.has(key)) continue;
      state.seenFailKeys.add(key);
      // Skip if purely network mirror
      if (/Failed to load resource/i.test(ce.text)) continue;
      addIssue({
        title: `Console error on ${menu}`,
        where: `${menu} / ${ce.url} / after "${meta.label}"`,
        why: ce.text.slice(0, 300),
        classification: 'FRONTEND',
        how: 'Fix React/runtime error in FE component',
        screenshot: findings[findings.length - 1]?.screenshot,
        network: 'n/a (console)',
        expected: 'No console errors',
        actual: ce.text.slice(0, 160),
      });
    }

    // If navigated to detail, go back to menu root unless settings sub
    if (page.url() !== beforeUrl && !page.url().includes('/settings/')) {
      // stay for one layer; caller may continue
    }
  } catch (e) {
    const ss = await shot(page, `${menu}-${meta.label}-error`);
    logFinding(menu, meta.label, 'FAIL', { error: String(e), screenshot: ss });
    addIssue({
      title: `Click failed: ${meta.label}`,
      where: `${menu} / ${beforeUrl} / ${meta.label}`,
      why: String(e).slice(0, 300),
      classification: 'FRONTEND',
      how: 'Make control interactive / fix overlay intercept',
      screenshot: ss,
      network: 'n/a',
      expected: 'Click succeeds',
      actual: String(e).slice(0, 160),
    });
  }
  return { ok: true };
}

async function deepClickMain(page, menu, state, opts = {}) {
  const maxClicks = opts.maxClicks ?? 28;
  const clicked = new Set();
  let idleRounds = 0;

  for (let round = 0; round < 6 && clicked.size < maxClicks; round++) {
    await dismissOverlays(page);
    const loc = actionableLocator(page);
    const count = await loc.count();
    let progressed = false;
    for (let i = 0; i < count && clicked.size < maxClicks; i++) {
      const el = loc.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const meta = await getActionMeta(el);
      const key = `${meta.tag}|${meta.label}|${meta.href}`;
      if (!meta.label || clicked.has(key) || SKIP_TEXT.test(meta.label)) continue;
      // Skip pure nav to other primary menus from main
      if (
        meta.href &&
        MENUS.some((m) => m.href === meta.href) &&
        !meta.href.includes(opts.allowHrefIncludes || '___')
      ) {
        // still allow Add Employee etc which may be /employees/new
        if (!/new|edit|approvals|detail|settings\//i.test(meta.href)) continue;
      }
      clicked.add(key);
      progressed = true;
      const beforeUrl = page.url();
      await interactElement(page, el, menu, state);
      // Return to menu if we drifted to unrelated area
      if (opts.homeHref && !page.url().includes(opts.homeHref.split('?')[0])) {
        // allow detail under same prefix
        const home = opts.homeHref;
        if (!page.url().includes(home.replace(/^\//, '')) && !page.url().endsWith(home)) {
          await page.goto(`${UI}${home}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await waitSettled(page, 500);
        }
      }
      // close dialogs after each action to keep exploring
      const openDlg = page.locator('[role="dialog"][data-state="open"], [data-radix-dialog-content]');
      if (await openDlg.first().isVisible({ timeout: 200 }).catch(() => false)) {
        // try fill required fields lightly then cancel if Save would need data
        if (/add|create|new|edit/i.test(meta.label) && opts.fillModals) {
          const inputs = openDlg.locator('input:visible, textarea:visible, select:visible');
          const ic = Math.min(await inputs.count(), 6);
          for (let j = 0; j < ic; j++) {
            const inp = inputs.nth(j);
            const t = (await inp.getAttribute('type')) || 'text';
            const name = ((await inp.getAttribute('name')) || '') + ((await inp.getAttribute('id')) || '');
            if (t === 'email' || /email/i.test(name)) await inp.fill('e2e.sa@acme.test').catch(() => {});
            else if (t === 'number') await inp.fill('1').catch(() => {});
            else if (t === 'date') await inp.fill('2026-08-01').catch(() => {});
            else if (t === 'checkbox' || t === 'radio' || t === 'file') continue;
            else await inp.fill('E2E Test').catch(() => {});
          }
          await shot(page, `${menu}-modal-${meta.label}-filled`);
        }
        // Prefer Cancel over Save for non-approve flows
        if (!APPROVE_DENY.test(meta.label)) {
          const cancel = openDlg.locator('button:has-text("Cancel"), button:has-text("Close")').first();
          if (await cancel.isVisible({ timeout: 400 }).catch(() => false)) {
            await cancel.click().catch(() => {});
          } else {
            await page.keyboard.press('Escape');
          }
        }
        await waitSettled(page, 300);
      }
      void beforeUrl;
    }
    if (!progressed) {
      idleRounds += 1;
      if (idleRounds >= 2) break;
    } else idleRounds = 0;
  }
  return clicked.size;
}

async function exploreDashboard(page, state) {
  counters.menus += 1;
  await clickSidebar(page, 'Dashboard');
  await waitSettled(page, 1000);
  const ss = await shot(page, 'dashboard');
  logFinding('Dashboard', 'open menu', 'PASS', { screenshot: ss, url: page.url() });

  // Explicit Add Employee
  const addEmp = page
    .locator(
      'main a:has-text("Add Employee"), main button:has-text("Add Employee"), main a:has-text("Add employee"), main button:has-text("Add employee")',
    )
    .first();
  if (await addEmp.isVisible({ timeout: 2000 }).catch(() => false)) {
    await addEmp.click();
    counters.buttons += 1;
    await waitSettled(page, 1000);
    const s2 = await shot(page, 'dashboard-add-employee');
    logFinding('Dashboard', 'Add Employee', 'PASS', { screenshot: s2, url: page.url() });
    await page.goto(`${UI}/dashboard`, { waitUntil: 'domcontentloaded' });
    await waitSettled(page, 800);
  } else {
    logFinding('Dashboard', 'Add Employee', 'MISS', { note: 'button not found' });
  }

  // Approve / Deny on pending approvals
  for (const label of ['Approve', 'Deny', 'Reject']) {
    const btn = page.locator(`main button:has-text("${label}")`).first();
    if (await btn.isVisible({ timeout: 800 }).catch(() => false)) {
      const before = state.failedRequests.length;
      await btn.click().catch(() => {});
      counters.buttons += 1;
      await waitSettled(page, 800);
      const confirm = page.locator('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes")').first();
      if (await confirm.isVisible({ timeout: 500 }).catch(() => false)) {
        await confirm.click().catch(() => {});
        await waitSettled(page, 600);
      }
      const s3 = await shot(page, `dashboard-${label.toLowerCase()}`);
      logFinding('Dashboard', `${label} pending`, 'PASS', {
        screenshot: s3,
        note: 'mutation noted',
      });
      const newFails = state.failedRequests.slice(before);
      for (const fr of newFails) {
        const key = `${fr.method}:${fr.status}:${fr.url}`;
        if (state.seenFailKeys.has(key)) continue;
        state.seenFailKeys.add(key);
        addIssue({
          title: `Dashboard ${label} failed: ${fr.status}`,
          where: `Dashboard / ${page.url()} / ${label}`,
          why: `${fr.method} ${fr.url} → ${fr.status} ${fr.body.slice(0, 200)}`,
          classification: classifyNetwork(fr.url, fr.status, fr.body),
          how: 'Fix approval endpoint / FE payload for SUPER_ADMIN',
          screenshot: s3,
          network: `${fr.method} ${fr.url} ${fr.status}`,
          expected: '2xx',
          actual: String(fr.status),
        });
      }
    }
  }

  await deepClickMain(page, 'Dashboard', state, {
    homeHref: '/dashboard',
    maxClicks: 20,
    fillModals: true,
  });
}

async function exploreMenu(page, menu, state) {
  counters.menus += 1;
  const clickedNav = await clickSidebar(page, menu.label);
  if (!clickedNav) {
    await page.goto(`${UI}${menu.href}`, { waitUntil: 'domcontentloaded' });
  }
  await waitSettled(page, 1000);
  const ss = await shot(page, `${slugify(menu.label)}`);
  const beforeFails = state.failedRequests.length;
  logFinding(menu.label, 'open menu', 'PASS', { screenshot: ss, url: page.url() });

  // Capture page-load API failures
  await waitSettled(page, 800);
  for (const fr of state.failedRequests.slice(beforeFails)) {
    const key = `load:${fr.method}:${fr.status}:${fr.url}`;
    if (state.seenFailKeys.has(key)) continue;
    state.seenFailKeys.add(key);
    addIssue({
      title: `${menu.label} page load error ${fr.status}`,
      where: `${menu.label} / ${menu.href}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${fr.body.slice(0, 220)}`,
      classification: classifyNetwork(fr.url, fr.status, fr.body),
      how:
        /NO_EMPLOYEE_RECORD/.test(fr.body)
          ? 'Backend: provide admin fallback OR FE: hide employee-scoped widgets for SUPER_ADMIN without employeeId'
          : 'Fix failing endpoint or FE client path',
      screenshot: ss,
      network: `${fr.method} ${fr.url} ${fr.status}`,
      expected: 'Page loads with 2xx data or empty state',
      actual: `${fr.status}`,
    });
  }

  // Tabs
  const tabs = page.locator('[role="tab"]:visible');
  const tabCount = await tabs.count();
  for (let i = 0; i < tabCount; i++) {
    const tab = tabs.nth(i);
    const t = ((await tab.innerText().catch(() => '')) || '').trim();
    await tab.click().catch(() => {});
    counters.buttons += 1;
    await waitSettled(page, 600);
    await shot(page, `${slugify(menu.label)}-tab-${slugify(t || String(i))}`);
    logFinding(menu.label, `tab:${t}`, 'PASS');
  }

  await deepClickMain(page, menu.label, state, {
    homeHref: menu.href,
    maxClicks: menu.label === 'Settings' ? 12 : 24,
    fillModals: true,
    allowHrefIncludes: menu.href,
  });

  // Settings deep subnav
  if (menu.label === 'Settings') {
    for (const sub of SETTINGS_SUB) {
      const href = `/settings/${sub}`;
      await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded' });
      await waitSettled(page, 900);
      const sSub = await shot(page, `settings-${slugify(sub)}`);
      logFinding('Settings', `sub:${sub}`, 'PASS', { screenshot: sSub, url: page.url() });
      // click a few actions on each settings page
      await deepClickMain(page, `Settings/${sub}`, state, {
        homeHref: href,
        maxClicks: 8,
        fillModals: true,
      });
    }
  }

  // Payroll extras
  if (menu.label === 'Payroll') {
    for (const extra of ['/payroll/my-payslips', '/payroll/migration', '/payroll/global']) {
      await page.goto(`${UI}${extra}`, { waitUntil: 'domcontentloaded' });
      await waitSettled(page, 800);
      await shot(page, `payroll-${slugify(extra)}`);
      logFinding('Payroll', `nav ${extra}`, 'PASS', { url: page.url() });
      await deepClickMain(page, `Payroll${extra}`, state, {
        homeHref: extra,
        maxClicks: 10,
        fillModals: true,
      });
    }
  }

  // Payout approvals
  if (menu.label === 'Payout methods') {
    await page.goto(`${UI}/payout-methods/approvals`, { waitUntil: 'domcontentloaded' });
    await waitSettled(page, 800);
    await shot(page, 'payout-methods-approvals');
    await deepClickMain(page, 'Payout methods/approvals', state, {
      homeHref: '/payout-methods/approvals',
      maxClicks: 12,
      fillModals: true,
    });
  }
}

function renderFindingsMd() {
  const lines = [];
  lines.push(`# SUPER_ADMIN Deep UI E2E Findings`);
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Role: ${ROLE} (${EMAIL})`);
  lines.push(`- UI: ${UI}`);
  lines.push(`- API: ${API}`);
  lines.push(`- Tenant: ${TENANT}`);
  lines.push(`- MSW: OFF (assumed via running stack)`);
  lines.push('');
  lines.push(`## Counts`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Menus tested | ${counters.menus} |`);
  lines.push(`| Buttons/actions clicked | ${counters.buttons} |`);
  lines.push(`| Screenshots | ${counters.screenshots} |`);
  lines.push(`| Issues (BACKEND) | ${counters.be} |`);
  lines.push(`| Issues (FRONTEND) | ${counters.fe} |`);
  lines.push(`| Issues (BOTH) | ${counters.both} |`);
  lines.push(`| Downloads observed | ${downloads.filter((d) => d.suggested || d.action).length} |`);
  lines.push('');
  lines.push(`## Menu / Action Log`);
  lines.push('');
  for (const f of findings) {
    lines.push(
      `- **[${f.status}]** ${f.menu} → ${f.action}` +
        (f.screenshot ? ` — \`${f.screenshot}\`` : '') +
        (f.url ? ` — ${f.url}` : '') +
        (f.note ? ` — _${f.note}_` : '') +
        (f.error ? ` — ERROR: ${f.error}` : ''),
    );
  }
  lines.push('');
  lines.push(`## Issues`);
  lines.push('');
  if (!issues.length) lines.push('_No issues recorded._');
  for (const iss of issues) {
    lines.push(`### ${iss.id}: ${iss.title}`);
    lines.push(`- Role: ${iss.role}`);
    lines.push(`- Where: ${iss.where}`);
    lines.push(`- Why: ${iss.why}`);
    lines.push(`- Classification: **${iss.classification}**`);
    lines.push(`- Expected: ${iss.expected || 'n/a'}`);
    lines.push(`- Actual: ${iss.actual || 'n/a'}`);
    lines.push(`- How to resolve: ${iss.how}`);
    lines.push(`- Screenshot: \`${iss.screenshot || 'n/a'}\``);
    lines.push(`- Network: ${iss.network || 'n/a'}`);
    lines.push('');
  }
  lines.push(`## Downloads`);
  lines.push('');
  if (!downloads.length) lines.push('_No download events._');
  for (const d of downloads) {
    lines.push(`- ${JSON.stringify(d)}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderContractSection(classification) {
  const filtered = issues.filter((i) =>
    classification === 'BACKEND'
      ? i.classification === 'BACKEND' || i.classification === 'BOTH'
      : i.classification === 'FRONTEND' || i.classification === 'BOTH',
  );
  const lines = [];
  lines.push('');
  lines.push(`## SUPER_ADMIN`);
  lines.push('');
  lines.push(`> Appended ${new Date().toISOString()} — deep UI E2E vs ${UI} / ${API}`);
  lines.push('');
  if (!filtered.length) {
    lines.push('_No issues classified for this side in this run._');
    lines.push('');
    return lines.join('\n');
  }
  for (const iss of filtered) {
    lines.push(`### ${iss.id}: ${iss.title}`);
    lines.push(`- Where: ${iss.where}`);
    lines.push(`- Why: ${iss.why}`);
    lines.push(`- Classification: ${iss.classification}`);
    lines.push(`- How to resolve: ${iss.how}`);
    lines.push(`- Screenshot: ${iss.screenshot || 'n/a'}`);
    lines.push(`- Network: ${iss.network || 'n/a'}`);
    lines.push('');
  }
  return lines.join('\n');
}

function appendContract(filePath, section) {
  const header =
    `# E2E Issues Contract\n\n> Living contract of UI E2E findings. Append-only sections per role.\n`;
  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf8');
    // Replace existing SUPER_ADMIN section if present
    if (/## SUPER_ADMIN/.test(existing)) {
      existing = existing.replace(/\n## SUPER_ADMIN[\s\S]*?(?=\n## [A-Z_]|\s*$)/, '');
    }
  } else {
    existing = header;
  }
  fs.writeFileSync(filePath, existing.trimEnd() + '\n' + section);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // clean prior numbered screenshots from this folder (keep md)
  for (const f of fs.readdirSync(OUT)) {
    if (/^\d{2}-.*\.png$/.test(f) || f === 'FINDINGS.md' || f.startsWith('_run')) {
      try {
        fs.unlinkSync(path.join(OUT, f));
      } catch {
        /* ignore */
      }
    }
  }

  const browser = await chromium.launch({
    headless: true,
    downloadsPath: path.join(OUT, '_downloads'),
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  // Ensure tenant header for API via init if FE uses it — also set localStorage hints
  await context.addInitScript((tenant) => {
    try {
      localStorage.setItem('x-tenant-key', tenant);
      localStorage.setItem('tenantKey', tenant);
    } catch {
      /* ignore */
    }
  }, TENANT);

  const page = await context.newPage();
  const state = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    seenFailKeys: new Set(),
  };
  collectors(page, state);

  console.log('Logging in…');
  await login(page);

  // Dashboard first (special)
  console.log('Exploring Dashboard…');
  await exploreDashboard(page, state);

  for (const menu of MENUS.filter((m) => m.label !== 'Dashboard')) {
    console.log(`Exploring ${menu.label}…`);
    try {
      await exploreMenu(page, menu, state);
    } catch (e) {
      const ss = await shot(page, `${slugify(menu.label)}-crash`);
      addIssue({
        title: `Menu exploration crashed: ${menu.label}`,
        where: `${menu.label} / ${menu.href}`,
        why: String(e).slice(0, 400),
        classification: 'FRONTEND',
        how: 'Stabilize page; fix crash',
        screenshot: ss,
        network: 'n/a',
        expected: 'Menu explorable',
        actual: String(e).slice(0, 160),
      });
      logFinding(menu.label, 'explore', 'FAIL', { error: String(e), screenshot: ss });
    }
  }

  // Final orphan failures not yet issued
  for (const fr of state.failedRequests) {
    const key = `final:${fr.method}:${fr.status}:${fr.url}`;
    if (state.seenFailKeys.has(key) || state.seenFailKeys.has(`${fr.method}:${fr.status}:${fr.url}`))
      continue;
    state.seenFailKeys.add(key);
    addIssue({
      title: `Unhandled failed request ${fr.status}`,
      where: fr.pageUrl,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${fr.body.slice(0, 220)}`,
      classification: classifyNetwork(fr.url, fr.status, fr.body),
      how: 'Investigate endpoint',
      screenshot: 'n/a',
      network: `${fr.method} ${fr.url} ${fr.status}`,
      expected: '2xx',
      actual: String(fr.status),
    });
  }

  const findingsMd = renderFindingsMd();
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), findingsMd);
  fs.writeFileSync(path.join(OUT, '_run-raw.json'), JSON.stringify({ counters, findings, issues, downloads }, null, 2));

  const bePath = path.join(__dirname, '../../E2E_BACKEND_ISSUES_CONTRACT.md');
  const fePath = path.join(__dirname, '../../E2E_FRONTEND_ISSUES_CONTRACT.md');
  // docs/e2e-ui-screenshots/superadmin → docs/
  const docsDir = path.resolve(__dirname, '../..');
  appendContract(path.join(docsDir, 'E2E_BACKEND_ISSUES_CONTRACT.md'), renderContractSection('BACKEND'));
  appendContract(path.join(docsDir, 'E2E_FRONTEND_ISSUES_CONTRACT.md'), renderContractSection('FRONTEND'));

  console.log(
    JSON.stringify(
      {
        counters,
        issues: issues.length,
        findingsFile: path.join(OUT, 'FINDINGS.md'),
        bePath: path.join(docsDir, 'E2E_BACKEND_ISSUES_CONTRACT.md'),
        fePath: path.join(docsDir, 'E2E_FRONTEND_ISSUES_CONTRACT.md'),
      },
      null,
      2,
    ),
  );

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
