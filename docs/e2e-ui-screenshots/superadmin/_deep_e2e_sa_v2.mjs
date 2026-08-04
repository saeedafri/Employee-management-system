/**
 * SUPER_ADMIN deep UI E2E v2 — robust navigation via goto + overlay cleanup
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const DOCS = path.resolve(__dirname, '../..');
const UI = 'http://localhost:3001';
const API = 'http://localhost:4000/api/v1';
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
  'company-profile', 'branding', 'locale', 'working-hours', 'leave-types',
  'attendance-rules', 'timesheets', 'leave-policies', 'leave-packs', 'leave-assignments',
  'pay/legal-entities', 'pay/statutory-packs', 'pay/components', 'pay/groups',
  'pay/schedules', 'pay/payslip-template', 'pay/data-policy', 'pay/country-bank-schemas',
  'authentication', 'sessions', 'audit-log', 'email-templates', 'notifications',
  'integration-email', 'integration-storage', 'integration-webhooks',
  'billing-plan', 'billing-invoices',
];

const EXTRA_ROUTES = {
  Payroll: ['/payroll/my-payslips', '/payroll/migration', '/payroll/global'],
  'Payout methods': ['/payout-methods/approvals'],
  Reports: [],
};

const SKIP_RE =
  /sign out|log out|logout|delete all|wipe|reset database|deactivate account|remove tenant/i;
const PRIORITY_RE =
  /^(add|create|new|edit|save|cancel|export|download|approve|deny|reject|filter|search|columns|import|upload|pdf|excel|csv|xlsx|refresh|submit|apply|next|previous|prev|back|view|open|manage|configure|run|generate|invite|assign)/i;

let shotIdx = 0;
const findings = [];
const issues = [];
const downloads = [];
const counters = { menus: 0, buttons: 0, screenshots: 0, be: 0, fe: 0, both: 0 };

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55);
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(2, '0')}-${slug(name)}.png`;
  try {
    await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 8000 });
  } catch {
    try {
      await page.screenshot({ path: path.join(OUT, file), timeout: 5000 });
    } catch {
      return null;
    }
  }
  counters.screenshots += 1;
  return file;
}

function classify(url, status, body) {
  const u = url || '';
  const b = body || '';
  if (/NO_EMPLOYEE_RECORD|NOT_IMPLEMENTED|INTERNAL|Prisma|ECONNREFUSED/i.test(b)) return 'BACKEND';
  if (u.includes(':4000') || /\/api\/v1\//.test(u)) return 'BACKEND';
  if (u.includes('localhost:3001/api/')) {
    if (status === 502 || status === 504) return 'BOTH';
    if (status >= 500) return 'BACKEND';
    if (status === 404) return 'BOTH';
    if (status === 400 || status === 403 || status === 401) return 'BACKEND';
  }
  if (status >= 400 && /\/api\//.test(u)) return 'BACKEND';
  return 'FRONTEND';
}

function addIssue(p) {
  // Dedup similar titles+network
  const dedupeKey = `${p.title}|${p.network || ''}|${(p.where || '').split('/')[0]}`;
  if (issues.some((i) => `${i.title}|${i.network || ''}|${(i.where || '').split('/')[0]}` === dedupeKey))
    return null;
  const id = `ISSUE-SA-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, role: ROLE, ...p };
  issues.push(issue);
  if (issue.classification === 'BACKEND') counters.be += 1;
  else if (issue.classification === 'FRONTEND') counters.fe += 1;
  else counters.both += 1;
  return issue;
}

function logF(menu, action, status, detail = {}) {
  findings.push({ menu, action, status, at: new Date().toISOString(), ...detail });
}

async function hardDismiss(page) {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => {
    document.querySelectorAll('[data-base-ui-inert], [aria-hidden="true"][data-base-ui-portal]').forEach((el) => {
      try {
        el.remove();
      } catch {
        /* ignore */
      }
    });
    // close open menus
    document.querySelectorAll('[data-state="open"]').forEach((el) => {
      if (el.getAttribute('role') === 'menu' || el.getAttribute('data-radix-menu-content') != null) {
        el.setAttribute('data-state', 'closed');
        el.style.display = 'none';
      }
    });
  }).catch(() => {});
  const cancel = page.locator(
    '[role="dialog"] button:has-text("Cancel"), [role="alertdialog"] button:has-text("Cancel"), button:has-text("Close")',
  ).first();
  if (await cancel.isVisible({ timeout: 200 }).catch(() => false)) {
    await cancel.click({ force: true, timeout: 1000 }).catch(() => {});
  }
}

async function settle(page, ms = 500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

function attachCollectors(page, state) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|React DevTools|Download the React|hydration/i.test(text)) return;
    state.consoleErrors.push({ text, url: page.url() });
  });
  page.on('pageerror', (err) => {
    state.pageErrors.push({ text: String(err?.message || err), url: page.url() });
  });
  page.on('response', async (res) => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    if (/\.(png|jpe?g|svg|css|woff2?|ico|map)(\?|$)/i.test(url)) return;
    if (/_next\/static|_next\/image|hot-update/i.test(url)) return;
    let body = '';
    try {
      body = (await res.text()).slice(0, 500);
    } catch {
      body = '';
    }
    state.failedRequests.push({
      method: res.request().method(),
      url,
      status,
      body,
      pageUrl: page.url(),
    });
  });
  page.on('download', async (dl) => {
    try {
      const p = await dl.path();
      downloads.push({
        suggested: dl.suggestedFilename(),
        ok: !!p && !dl.failure(),
        failure: dl.failure(),
        pageUrl: page.url(),
      });
    } catch (e) {
      downloads.push({ suggested: dl.suggestedFilename(), ok: false, failure: String(e), pageUrl: page.url() });
    }
  });
}

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 400);
  await shot(page, 'login-form');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/otp/, { timeout: 30000 });
  await settle(page, 1000);
  const ss = await shot(page, 'login-success');
  const ok = page.url().includes('/dashboard');
  logF('Login', 'login', ok ? 'PASS' : 'FAIL', { screenshot: ss, url: page.url() });
  if (!ok) {
    addIssue({
      title: 'Login did not reach dashboard',
      where: `Login / ${page.url()}`,
      why: 'Post-login URL unexpected',
      classification: 'BOTH',
      how: 'Check auth BFF + redirect',
      screenshot: ss,
      network: 'POST /auth/login',
      expected: '/dashboard',
      actual: page.url(),
    });
  }
}

async function gotoMenu(page, href) {
  await hardDismiss(page);
  await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 900);
  await hardDismiss(page);
}

function harvestFailures(state, menu, screenshot, sinceIdx, actionLabel) {
  const slice = state.failedRequests.slice(sinceIdx);
  for (const fr of slice) {
    const key = `${fr.method}|${fr.status}|${fr.url.split('?')[0]}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    const cls = classify(fr.url, fr.status, fr.body);
    addIssue({
      title: `${menu}: ${fr.status} on ${fr.url.split('/').slice(-2).join('/')}`,
      where: `${menu} / ${fr.pageUrl} / ${actionLabel || 'page'}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${fr.body.slice(0, 240)}`,
      classification: cls,
      how:
        /NO_EMPLOYEE_RECORD/.test(fr.body)
          ? 'BE: admin-safe empty response OR FE: hide employee-scoped widgets when user.employeeId is null'
          : cls === 'BACKEND'
            ? 'Fix backend route/handler/status for this SUPER_ADMIN call'
            : 'Fix FE client path, BFF proxy, or error UI',
      screenshot,
      network: `${fr.method} ${fr.url} ${fr.status}`,
      expected: '2xx or graceful empty',
      actual: `${fr.status} ${(fr.body || '').slice(0, 120)}`,
    });
  }
  for (const ce of state.consoleErrors.slice(state.consoleAt || 0)) {
    if (/Failed to load resource/i.test(ce.text)) continue;
    const key = `c:${ce.text.slice(0, 100)}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    addIssue({
      title: `${menu}: console error`,
      where: `${menu} / ${ce.url}`,
      why: ce.text.slice(0, 300),
      classification: 'FRONTEND',
      how: 'Fix React/runtime warning or error in FE',
      screenshot,
      network: 'n/a (console)',
      expected: 'clean console',
      actual: ce.text.slice(0, 160),
    });
  }
  for (const pe of state.pageErrors.slice(state.pageAt || 0)) {
    const key = `p:${pe.text.slice(0, 100)}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    addIssue({
      title: `${menu}: page error`,
      where: `${menu} / ${pe.url}`,
      why: pe.text.slice(0, 300),
      classification: 'FRONTEND',
      how: 'Fix uncaught FE exception',
      screenshot,
      network: 'n/a',
      expected: 'no pageerror',
      actual: pe.text.slice(0, 160),
    });
  }
  state.consoleAt = state.consoleErrors.length;
  state.pageAt = state.pageErrors.length;
}

async function safeClick(page, el) {
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 1500 });
  } catch {
    /* ignore */
  }
  try {
    await el.click({ timeout: 2500 });
    return true;
  } catch {
    try {
      await el.click({ force: true, timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}

async function labelOf(el) {
  const text = ((await el.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const aria = (await el.getAttribute('aria-label').catch(() => '')) || '';
  const href = (await el.getAttribute('href').catch(() => '')) || '';
  const title = (await el.getAttribute('title').catch(() => '')) || '';
  return text || aria || title || href || 'control';
}

async function clickPriorityActions(page, menu, state, opts = {}) {
  const max = opts.max ?? 18;
  const home = opts.home;
  let clicked = 0;

  // Search box
  const search = page.locator('main input[type="search"], main input[placeholder*="Search" i]').first();
  if (await search.isVisible({ timeout: 400 }).catch(() => false)) {
    const before = state.failedRequests.length;
    await search.fill('a').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await settle(page, 600);
    counters.buttons += 1;
    clicked += 1;
    const ss = await shot(page, `${menu}-search`);
    logF(menu, 'search', 'PASS', { screenshot: ss });
    harvestFailures(state, menu, ss, before, 'search');
    await search.fill('').catch(() => {});
  }

  // Tabs
  const tabs = page.locator('main [role="tab"], [role="tablist"] [role="tab"]');
  const tc = await tabs.count();
  for (let i = 0; i < tc; i++) {
    await hardDismiss(page);
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const lab = await labelOf(tab);
    const before = state.failedRequests.length;
    if (!(await safeClick(page, tab))) continue;
    counters.buttons += 1;
    clicked += 1;
    await settle(page, 500);
    const ss = await shot(page, `${menu}-tab-${lab}`);
    logF(menu, `tab:${lab}`, 'PASS', { screenshot: ss });
    harvestFailures(state, menu, ss, before, `tab:${lab}`);
  }

  // Collect candidate buttons/links in main toolbar-ish areas first
  const candidates = page.locator(
    [
      'main button:visible',
      'main a[href]:visible',
      '[role="main"] button:visible',
      'main [role="combobox"]:visible',
    ].join(', '),
  );

  const count = await candidates.count();
  const metas = [];
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab)) continue;
    const href = (await el.getAttribute('href').catch(() => '')) || '';
    // Skip jumping to unrelated primary nav
    if (href && MENUS.some((m) => m.href === href)) continue;
    const priority = PRIORITY_RE.test(lab) || /\/new$|\/edit|export|download|approv/i.test(href + lab);
    const isRowNoise =
      !priority &&
      (/^actions for /i.test(lab) ||
        (/^[A-Z][a-z]+ [A-Z]/.test(lab) && !PRIORITY_RE.test(lab)));
    metas.push({ i, lab, href, priority, isRowNoise });
  }

  // Sort: priority first, then non-row, then limited rows
  metas.sort((a, b) => Number(b.priority) - Number(a.priority) || Number(a.isRowNoise) - Number(b.isRowNoise));

  let rowClicks = 0;
  for (const m of metas) {
    if (clicked >= max) break;
    if (m.isRowNoise) {
      if (rowClicks >= 2) continue; // only 2 detail rows max
      rowClicks += 1;
    }
    await hardDismiss(page);
    // Re-find by label roughly
    let el = candidates.nth(m.i);
    // If stale, find by text
    const byText = page.locator('main button, main a[href]', { hasText: m.lab }).first();
    if (await byText.isVisible({ timeout: 200 }).catch(() => false)) el = byText;

    const before = state.failedRequests.length;
    const beforeDl = downloads.length;
    const beforeUrl = page.url();
    const ok = await safeClick(page, el);
    if (!ok) {
      logF(menu, m.lab, 'SKIP', { note: 'click failed after force' });
      continue;
    }
    counters.buttons += 1;
    clicked += 1;
    await settle(page, 700);

    // Close dropdowns that are not dialogs (Columns etc.) after screenshot
    const ss = await shot(page, `${menu}-${m.lab}`);
    const isApprove = /^(approve|deny|reject)$/i.test(m.lab.trim());
    logF(menu, m.lab, 'PASS', {
      screenshot: ss,
      url: page.url(),
      note: isApprove ? 'mutation noted' : undefined,
    });

    // Confirm approve/deny dialogs
    if (isApprove) {
      const confirm = page
        .locator('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="alertdialog"] button:has-text("Confirm")')
        .first();
      if (await confirm.isVisible({ timeout: 500 }).catch(() => false)) {
        await confirm.click({ force: true }).catch(() => {});
        await settle(page, 600);
        await shot(page, `${menu}-${m.lab}-confirmed`);
      }
    }

    // Export observation
    if (/export|download|pdf|excel|csv|xlsx/i.test(m.lab)) {
      await settle(page, 1200);
      // maybe submenu items
      const sub = page.locator('[role="menu"] [role="menuitem"]:visible, [data-radix-menu-content] button:visible, [role="menuitem"]:visible');
      const sc = Math.min(await sub.count(), 6);
      for (let si = 0; si < sc; si++) {
        const item = sub.nth(si);
        const slab = await labelOf(item);
        const b2 = state.failedRequests.length;
        const d2 = downloads.length;
        await item.click({ force: true, timeout: 2000 }).catch(() => {});
        counters.buttons += 1;
        await settle(page, 1200);
        const sss = await shot(page, `${menu}-export-${slab}`);
        const newDl = downloads.slice(d2);
        const fails = state.failedRequests.slice(b2);
        const success = newDl.some((d) => d.ok) || fails.length === 0;
        logF(menu, `export:${slab}`, success ? 'PASS' : 'FAIL', {
          screenshot: sss,
          downloads: newDl,
          fails: fails.map((f) => `${f.status} ${f.url}`),
        });
        if (!success || fails.length) {
          const fr = fails[0];
          addIssue({
            title: `Export failed: ${slab || m.lab}`,
            where: `${menu} / ${beforeUrl} / ${m.lab} → ${slab}`,
            why: fr
              ? `${fr.method} ${fr.url} → ${fr.status}: ${fr.body.slice(0, 200)}`
              : 'No download event received',
            classification: fr ? classify(fr.url, fr.status, fr.body) : 'FRONTEND',
            how: 'Ensure export API returns file + FE triggers download',
            screenshot: sss,
            network: fr ? `${fr.method} ${fr.url} ${fr.status}` : 'no download',
            expected: 'file download',
            actual: fr ? `HTTP ${fr.status}` : 'no file',
          });
        }
        await hardDismiss(page);
      }
    }

    harvestFailures(state, menu, ss, before, m.lab);

    // If dialog open for Add/Create — fill lightly then Cancel (non-destructive)
    const dlg = page.locator('[role="dialog"], [data-radix-dialog-content], [role="alertdialog"]').first();
    if (await dlg.isVisible({ timeout: 300 }).catch(() => false)) {
      if (/add|create|new|edit|invite/i.test(m.lab) && !isApprove) {
        const inputs = dlg.locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea:visible');
        const ic = Math.min(await inputs.count(), 5);
        for (let j = 0; j < ic; j++) {
          const inp = inputs.nth(j);
          const t = (await inp.getAttribute('type')) || 'text';
          const name = `${(await inp.getAttribute('name')) || ''}${(await inp.getAttribute('id')) || ''}`;
          if (t === 'email' || /email/i.test(name)) await inp.fill('e2e.sa@acme.test').catch(() => {});
          else if (t === 'number') await inp.fill('1').catch(() => {});
          else if (t === 'date') await inp.fill('2026-08-01').catch(() => {});
          else await inp.fill('E2E Test').catch(() => {});
        }
        await shot(page, `${menu}-modal-${m.lab}`);
      }
      if (!isApprove) {
        const cancel = dlg.locator('button:has-text("Cancel"), button:has-text("Close")').first();
        if (await cancel.isVisible({ timeout: 400 }).catch(() => false)) {
          await cancel.click({ force: true }).catch(() => {});
        } else {
          await hardDismiss(page);
        }
      }
    }

    // Dropdown menus (Columns) — screenshot then dismiss
    await hardDismiss(page);

    // Return home if navigated away to deep path
    if (home && !page.url().includes(home.split('?')[0].replace(/^\//, '')) && !page.url().endsWith(home)) {
      // allow same section prefixes
      const base = home.replace(/\/$/, '');
      if (!page.url().includes(base)) {
        await gotoMenu(page, home);
      }
    }
  }

  return clicked;
}

async function exploreDashboard(page, state) {
  counters.menus += 1;
  await gotoMenu(page, '/dashboard');
  const before = state.failedRequests.length;
  const ss = await shot(page, 'dashboard');
  logF('Dashboard', 'open', 'PASS', { screenshot: ss, url: page.url() });
  harvestFailures(state, 'Dashboard', ss, before, 'open');

  // Add Employee explicit
  const add = page.locator('main a:has-text("Add Employee"), main button:has-text("Add Employee"), main a:has-text("Add employee")').first();
  if (await add.isVisible({ timeout: 1500 }).catch(() => false)) {
    const b = state.failedRequests.length;
    await safeClick(page, add);
    counters.buttons += 1;
    await settle(page, 800);
    const s2 = await shot(page, 'dashboard-add-employee');
    logF('Dashboard', 'Add Employee', 'PASS', { screenshot: s2, url: page.url() });
    harvestFailures(state, 'Dashboard', s2, b, 'Add Employee');
    await gotoMenu(page, '/dashboard');
  } else {
    logF('Dashboard', 'Add Employee', 'MISS');
  }

  // Approve / Deny
  for (const label of ['Approve', 'Deny', 'Reject']) {
    await hardDismiss(page);
    const btn = page.locator(`main button:has-text("${label}")`).first();
    if (!(await btn.isVisible({ timeout: 600 }).catch(() => false))) continue;
    const b = state.failedRequests.length;
    await safeClick(page, btn);
    counters.buttons += 1;
    await settle(page, 500);
    const confirm = page.locator('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes")').first();
    if (await confirm.isVisible({ timeout: 500 }).catch(() => false)) {
      await confirm.click({ force: true }).catch(() => {});
      await settle(page, 600);
    }
    const s3 = await shot(page, `dashboard-${label.toLowerCase()}`);
    logF('Dashboard', label, 'PASS', { screenshot: s3, note: 'mutation noted' });
    harvestFailures(state, 'Dashboard', s3, b, label);
  }

  await clickPriorityActions(page, 'Dashboard', state, { home: '/dashboard', max: 14 });
}

async function exploreMenu(page, menu, state) {
  counters.menus += 1;
  console.log(`→ ${menu.label}`);
  await gotoMenu(page, menu.href);
  const before = state.failedRequests.length;
  const ss = await shot(page, slug(menu.label));
  logF(menu.label, 'open', 'PASS', { screenshot: ss, url: page.url() });
  harvestFailures(state, menu.label, ss, before, 'open');

  // Also click matching sidebar for evidence of nav working
  const nav = page.locator(`nav[aria-label="Main navigation"] a[aria-label="${menu.label}"]`).first();
  if (await nav.isVisible({ timeout: 800 }).catch(() => false)) {
    await nav.click({ force: true, timeout: 3000 }).catch(() => {});
    await settle(page, 400);
  }

  await clickPriorityActions(page, menu.label, state, { home: menu.href, max: 20 });

  if (menu.label === 'Settings') {
    for (const sub of SETTINGS_SUB) {
      const href = `/settings/${sub}`;
      console.log(`  settings/${sub}`);
      await gotoMenu(page, href);
      const b = state.failedRequests.length;
      const sSub = await shot(page, `settings-${slug(sub)}`);
      logF('Settings', `sub:${sub}`, 'PASS', { screenshot: sSub, url: page.url() });
      harvestFailures(state, `Settings/${sub}`, sSub, b, 'open');
      await clickPriorityActions(page, `Settings/${sub}`, state, { home: href, max: 8 });
    }
  }

  for (const extra of EXTRA_ROUTES[menu.label] || []) {
    await gotoMenu(page, extra);
    const b = state.failedRequests.length;
    const se = await shot(page, slug(extra));
    logF(menu.label, `extra:${extra}`, 'PASS', { screenshot: se, url: page.url() });
    harvestFailures(state, `${menu.label}${extra}`, se, b, 'open');
    await clickPriorityActions(page, `${menu.label}${extra}`, state, { home: extra, max: 10 });
  }
}

function writeOutputs() {
  const lines = [];
  lines.push('# SUPER_ADMIN Deep UI E2E Findings');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Role: ${ROLE} (${EMAIL})`);
  lines.push(`- UI: ${UI}`);
  lines.push(`- API: ${API}`);
  lines.push(`- Tenant: ${TENANT}`);
  lines.push('- MSW: OFF');
  lines.push('- Tool: Playwright Chromium (deep v2)');
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Menus tested | ${counters.menus} |`);
  lines.push(`| Buttons/actions clicked | ${counters.buttons} |`);
  lines.push(`| Screenshots | ${counters.screenshots} |`);
  lines.push(`| Issues BACKEND | ${counters.be} |`);
  lines.push(`| Issues FRONTEND | ${counters.fe} |`);
  lines.push(`| Issues BOTH | ${counters.both} |`);
  lines.push(`| Download events | ${downloads.length} |`);
  lines.push('');
  lines.push('## Menu / Action Log');
  lines.push('');
  for (const f of findings) {
    lines.push(
      `- **[${f.status}]** ${f.menu} → ${f.action}` +
        (f.screenshot ? ` — \`${f.screenshot}\`` : '') +
        (f.url ? ` — ${f.url}` : '') +
        (f.note ? ` — _${f.note}_` : '') +
        (f.note2 ? ` — ${f.note2}` : ''),
    );
  }
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  if (!issues.length) lines.push('_None_');
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
    lines.push(`- Network: \`${iss.network || 'n/a'}\``);
    lines.push('');
  }
  lines.push('## Downloads');
  lines.push('');
  lines.push(downloads.length ? downloads.map((d) => `- ${JSON.stringify(d)}`).join('\n') : '_None_');
  lines.push('');
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));
  fs.writeFileSync(path.join(OUT, '_run-raw.json'), JSON.stringify({ counters, findings, issues, downloads }, null, 2));

  for (const [file, side] of [
    ['E2E_BACKEND_ISSUES_CONTRACT.md', 'BACKEND'],
    ['E2E_FRONTEND_ISSUES_CONTRACT.md', 'FRONTEND'],
  ]) {
    const filtered = issues.filter((i) =>
      side === 'BACKEND'
        ? i.classification === 'BACKEND' || i.classification === 'BOTH'
        : i.classification === 'FRONTEND' || i.classification === 'BOTH',
    );
    let existing = fs.existsSync(path.join(DOCS, file))
      ? fs.readFileSync(path.join(DOCS, file), 'utf8')
      : `# E2E Issues Contract\n\n> Living contract of UI E2E findings. Append-only sections per role.\n`;
    existing = existing.replace(/\n## SUPER_ADMIN[\s\S]*?(?=\n## [A-Z_]|\s*$)/, '');
    const sec = ['', '## SUPER_ADMIN', '', `> Updated ${new Date().toISOString()} — deep UI E2E v2 vs ${UI} / ${API}`, ''];
    if (!filtered.length) sec.push('_No issues for this side in this run._', '');
    for (const iss of filtered) {
      sec.push(`### ${iss.id}: ${iss.title}`);
      sec.push(`- Where: ${iss.where}`);
      sec.push(`- Why: ${iss.why}`);
      sec.push(`- Classification: ${iss.classification}`);
      sec.push(`- How to resolve: ${iss.how}`);
      sec.push(`- Screenshot: ${iss.screenshot || 'n/a'}`);
      sec.push(`- Network: ${iss.network || 'n/a'}`);
      sec.push('');
    }
    fs.writeFileSync(path.join(DOCS, file), existing.trimEnd() + '\n' + sec.join('\n'));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) {
    if (/^\d{2}-.*\.png$/.test(f) || f === 'FINDINGS.md' || f === '_run-raw.json') {
      try {
        fs.unlinkSync(path.join(OUT, f));
      } catch {
        /* ignore */
      }
    }
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('tenantKey', t);
      localStorage.setItem('x-tenant-key', t);
    } catch {
      /* ignore */
    }
  }, TENANT);

  const page = await context.newPage();
  const state = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    seen: new Set(),
    consoleAt: 0,
    pageAt: 0,
  };
  attachCollectors(page, state);

  console.log('Login…');
  await login(page);

  console.log('Dashboard…');
  await exploreDashboard(page, state);

  for (const menu of MENUS.filter((m) => m.label !== 'Dashboard')) {
    try {
      await exploreMenu(page, menu, state);
    } catch (e) {
      const ss = await shot(page, `${slug(menu.label)}-crash`);
      logF(menu.label, 'explore', 'FAIL', { error: String(e), screenshot: ss });
      addIssue({
        title: `Menu exploration crashed: ${menu.label}`,
        where: `${menu.label} / ${menu.href}`,
        why: String(e).slice(0, 400),
        classification: 'FRONTEND',
        how: 'Stabilize page rendering / fix crash',
        screenshot: ss,
        network: 'n/a',
        expected: 'explorable',
        actual: String(e).slice(0, 160),
      });
      await hardDismiss(page);
    }
  }

  writeOutputs();
  console.log(JSON.stringify({ counters, issues: issues.length, shots: counters.screenshots }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  try {
    writeOutputs();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
