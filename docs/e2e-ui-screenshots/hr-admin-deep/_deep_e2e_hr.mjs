/**
 * HR_ADMIN FULL-DEPTH nested UI E2E — Playwright
 * UI :3001 → BE :4000 (Hostinger). No Render. No commits.
 *
 * Depth: every sidebar parent → every tab → every toolbar/row/icon control →
 * enter every modal/drawer/detail → nest into wizard steps → export PDF/Excel/CSV.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const DOCS = path.resolve(__dirname, '../..');
const UI = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://localhost:4000/api/v1';
const ROLE = 'HR_ADMIN';
const EMAIL = process.env.QA_EMAIL || 'hr@acme.test';
const PASSWORD = process.env.QA_PASS || 'Password123!';
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
  'locale',
  'working-hours',
  'attendance-rules',
  'notifications',
  'authentication',
  'sessions',
  'audit-log',
  'email-templates',
  'integration-email',
  'integration-storage',
  'integration-webhooks',
  'billing-plan',
  'billing-invoices',
  'branding',
  'leave-types',
  'leave-policies',
  'leave-packs',
  'leave-assignments',
  'timesheets',
  'pay/components',
  'pay/groups',
  'pay/schedules',
  'pay/legal-entities',
  'pay/statutory-packs',
  'pay/payslip-template',
  'pay/data-policy',
  'pay/country-bank-schemas',
];

const REPORT_ROUTES = [
  'workforce/headcount',
  'workforce/turnover',
  'workforce/demographics',
  'attendance/summary',
  'attendance/absenteeism',
  'leave/utilization',
  'leave/pending',
  'payroll/summary',
  'payroll/ctc-analysis',
  'payroll/salary-register',
  'payroll/statutory-register',
  'payroll/bank-advice',
  'payroll/variance-register',
  'payroll/pay-equity',
  'timesheets/utilization',
];

const PAYROLL_EXTRA = ['/payroll/my-payslips', '/payroll/migration', '/payroll/global'];

const SKIP_RE =
  /sign out|log out|logout|delete all|wipe|reset database|deactivate account|remove tenant|permanently delete|danger zone/i;
const DESTRUCTIVE_SUBMIT_RE =
  /^(delete|remove|archive|terminate|fire|void|cancel run|lock run)$/i;
const PRIORITY_RE =
  /^(add|create|new|edit|save|cancel|export|download|approve|deny|reject|filter|search|columns|import|upload|pdf|excel|csv|xlsx|refresh|submit|apply|next|previous|prev|back|view|open|manage|configure|run|generate|invite|assign|check in|check out|request|bulk|schedule|compute|preview|send|test|publish|duplicate|copy|more|actions|details)/i;

let shotIdx = 0;
const findings = [];
const issues = [];
const downloads = [];
const mutations = [];
const depthStats = {
  menus: 0,
  tabs: 0,
  buttons: 0,
  modalsEntered: 0,
  nestedWizardSteps: 0,
  rowActions: 0,
  exports: 0,
  detailPages: 0,
  screenshots: 0,
  be: 0,
  fe: 0,
  both: 0,
  maxNestDepth: 0,
};

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 55);
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  try {
    await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 8000 });
  } catch {
    try {
      await page.screenshot({ path: path.join(OUT, file), timeout: 5000 });
    } catch {
      return null;
    }
  }
  depthStats.screenshots += 1;
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
  const dedupeKey = `${p.title}|${p.network || ''}|${(p.where || '').split('/')[0]}`;
  if (issues.some((i) => `${i.title}|${i.network || ''}|${(i.where || '').split('/')[0]}` === dedupeKey))
    return null;
  const id = `ISSUE-HR-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, role: ROLE, ...p };
  issues.push(issue);
  if (issue.classification === 'BACKEND') depthStats.be += 1;
  else if (issue.classification === 'FRONTEND') depthStats.fe += 1;
  else depthStats.both += 1;
  console.log(`  🐛 ${id} [${issue.classification}] ${issue.title}`);
  return issue;
}

function logF(menu, action, status, detail = {}) {
  findings.push({ menu, action, status, at: new Date().toISOString(), ...detail });
}

async function hardDismiss(page) {
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(60);
  }
  await page
    .evaluate(() => {
      document
        .querySelectorAll('[data-base-ui-inert], [aria-hidden="true"][data-base-ui-portal]')
        .forEach((el) => {
          try {
            el.remove();
          } catch {
            /* ignore */
          }
        });
      document.querySelectorAll('[data-state="open"]').forEach((el) => {
        if (el.getAttribute('role') === 'menu' || el.getAttribute('data-radix-menu-content') != null) {
          el.setAttribute('data-state', 'closed');
          el.style.display = 'none';
        }
      });
    })
    .catch(() => {});
  const cancel = page
    .locator(
      '[role="dialog"] button:has-text("Cancel"), [role="alertdialog"] button:has-text("Cancel"), button:has-text("Close")',
    )
    .first();
  if (await cancel.isVisible({ timeout: 180 }).catch(() => false)) {
    await cancel.click({ force: true, timeout: 1000 }).catch(() => {});
  }
}

async function settle(page, ms = 450) {
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
      downloads.push({
        suggested: dl.suggestedFilename(),
        ok: false,
        failure: String(e),
        pageUrl: page.url(),
      });
    }
  });
}

async function login(page, state) {
  const before = state.failedRequests.length;
  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 500);
  await shot(page, 'login-form');
  // Capture anonymous bootstrap noise
  for (const fr of state.failedRequests.slice(before)) {
    if (/\/api\/auth\/(me|refresh)/.test(fr.url) && fr.status === 401) {
      addIssue({
        title: 'Login bootstrap 401s (me/refresh)',
        where: `/login`,
        why: `Anonymous ${fr.method} ${fr.url} → ${fr.status}`,
        classification: 'FRONTEND',
        how: 'Skip me/refresh on public auth routes or silence expected 401s',
        screenshot: '001-login-form.png',
        network: `${fr.status} ${fr.method} ${fr.url}`,
        expected: 'no anonymous session probes',
        actual: String(fr.status),
      });
    }
  }
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
  await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 800);
  await hardDismiss(page);
}

async function harvestFailures(state, menu, screenshot, sinceIdx, actionLabel) {
  const slice = state.failedRequests.slice(sinceIdx);
  for (const fr of slice) {
    // ignore expected login noise already recorded
    if (/\/api\/auth\/(me|refresh)/.test(fr.url) && fr.status === 401) continue;
    const key = `${fr.method}|${fr.status}|${fr.url.split('?')[0]}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    const cls = classify(fr.url, fr.status, fr.body);
    addIssue({
      title: `${menu}: ${fr.status} on ${fr.url.split('/').slice(-3).join('/')}`,
      where: `${menu} / ${fr.pageUrl} / ${actionLabel || 'page'}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${fr.body.slice(0, 240)}`,
      classification: cls,
      how:
        /NO_EMPLOYEE_RECORD/.test(fr.body)
          ? 'BE: admin-safe empty OR FE: hide employee-scoped widgets when employeeId is null'
          : cls === 'BACKEND'
            ? 'Fix backend route/handler/status for this HR_ADMIN call'
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
    const isDupKey = /same key|unique "key"/i.test(ce.text);
    addIssue({
      title: isDupKey ? `${menu}: React duplicate key` : `${menu}: console error`,
      where: `${menu} / ${ce.url}`,
      why: ce.text.slice(0, 300),
      classification: 'FRONTEND',
      how: isDupKey
        ? 'Use unique React keys (id ± employeeId), never raw employeeId alone if duplicated'
        : 'Fix React/runtime warning or error in FE',
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

  // Access restricted visible text
  try {
    const text = (await pageBody(state.page)) || '';
    if (/access restricted/i.test(text)) {
      const key = `ar:${menu}:${(actionLabel || 'open').split(':')[0]}`;
      if (!state.seen.has(key)) {
        state.seen.add(key);
        addIssue({
          title: `${menu}: Access restricted UI`,
          where: `${menu} / ${actionLabel || 'page'}`,
          why: 'Page shows Access restricted for HR_ADMIN',
          classification: 'FRONTEND',
          how: 'Hide nav item for HR or redirect to first allowed panel',
          screenshot,
          network: 'n/a (client gate)',
          expected: 'reachable HR page or hidden nav',
          actual: 'Access restricted',
        });
      }
    }
  } catch {
    /* ignore */
  }
}

async function pageBody(page) {
  if (!page) return '';
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

async function safeClick(page, el) {
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 1200 });
  } catch {
    /* ignore */
  }
  try {
    await el.click({ timeout: 2200 });
    return true;
  } catch {
    try {
      await el.click({ force: true, timeout: 1800 });
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
  const testid = (await el.getAttribute('data-testid').catch(() => '')) || '';
  return text || aria || title || testid || href || 'control';
}

async function exploreDialogNest(page, menu, state, nestDepth, home) {
  depthStats.maxNestDepth = Math.max(depthStats.maxNestDepth, nestDepth);
  const dlg = page.locator('[role="dialog"], [role="alertdialog"], [data-radix-dialog-content]').first();
  if (!(await dlg.isVisible({ timeout: 350 }).catch(() => false))) return;
  depthStats.modalsEntered += 1;
  const ss = await shot(page, `${menu}-modal-d${nestDepth}`);
  logF(menu, `modal:depth${nestDepth}`, 'PASS', { screenshot: ss });

  // Light-fill inputs (non-submit)
  const inputs = dlg.locator(
    'input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea:visible',
  );
  const ic = Math.min(await inputs.count(), 6);
  for (let j = 0; j < ic; j++) {
    const inp = inputs.nth(j);
    const t = (await inp.getAttribute('type')) || 'text';
    const name = `${(await inp.getAttribute('name')) || ''}${(await inp.getAttribute('id')) || ''}`;
    if (t === 'email' || /email/i.test(name)) await inp.fill('e2e.hr@acme.test').catch(() => {});
    else if (t === 'number') await inp.fill('1').catch(() => {});
    else if (t === 'date') await inp.fill('2026-08-10').catch(() => {});
    else if (t === 'password') await inp.fill('Password123!').catch(() => {});
    else await inp.fill('E2E Nested').catch(() => {});
  }

  // Wizard Next / Back / Steps
  if (nestDepth < 3) {
    for (const stepLabel of ['Next', 'Continue', 'Step 2', 'Step 3']) {
      const next = dlg.getByRole('button', { name: new RegExp(`^${stepLabel}$`, 'i') }).first();
      if (!(await next.isVisible({ timeout: 250 }).catch(() => false))) continue;
      if (await next.isDisabled().catch(() => false)) continue;
      const before = state.failedRequests.length;
      await safeClick(page, next);
      depthStats.buttons += 1;
      depthStats.nestedWizardSteps += 1;
      await settle(page, 500);
      const sn = await shot(page, `${menu}-wizard-${stepLabel}-d${nestDepth}`);
      logF(menu, `wizard:${stepLabel}:d${nestDepth}`, 'PASS', { screenshot: sn });
      await harvestFailures(state, menu, sn, before, `wizard:${stepLabel}`);
      await exploreDialogNest(page, menu, state, nestDepth + 1, home);
    }
  }

  // Nested controls inside dialog (tabs, buttons) — cancel/close preferred over submit
  const nestedBtns = dlg.locator(
    'button:visible, [role="tab"]:visible, a[href]:visible, [role="menuitem"]:visible',
  );
  const nbc = Math.min(await nestedBtns.count(), nestDepth === 1 ? 10 : 6);
  const clickedLabs = new Set();
  for (let i = 0; i < nbc; i++) {
    const el = nestedBtns.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab) || clickedLabs.has(lab)) continue;
    if (/^(cancel|close|dismiss|x)$/i.test(lab.trim())) continue;
    if (DESTRUCTIVE_SUBMIT_RE.test(lab.trim())) continue;
    // Avoid final submit of create forms (non-approve)
    if (/^(create|save|submit|send|confirm)$/i.test(lab.trim()) && nestDepth >= 1) {
      // still screenshot that the button exists
      await shot(page, `${menu}-modal-has-${lab}`);
      continue;
    }
    clickedLabs.add(lab);
    const before = state.failedRequests.length;
    if (!(await safeClick(page, el))) continue;
    depthStats.buttons += 1;
    await settle(page, 450);
    const sn = await shot(page, `${menu}-modal-${lab}-d${nestDepth}`);
    logF(menu, `modal-ctrl:${lab}`, 'PASS', { screenshot: sn, nest: nestDepth });
    await harvestFailures(state, menu, sn, before, `modal:${lab}`);
    if (nestDepth < 2) await exploreDialogNest(page, menu, state, nestDepth + 1, home);
  }

  // Cancel out
  const cancel = dlg.locator('button:has-text("Cancel"), button:has-text("Close"), button:has-text("Back")').first();
  if (await cancel.isVisible({ timeout: 300 }).catch(() => false)) {
    await cancel.click({ force: true }).catch(() => {});
  } else {
    await hardDismiss(page);
  }
  await settle(page, 200);
}

async function clickExportMenu(page, menu, state, triggerLab) {
  depthStats.exports += 1;
  await settle(page, 400);
  const sub = page.locator(
    '[role="menu"] [role="menuitem"]:visible, [data-radix-menu-content] button:visible, [role="menuitem"]:visible, [role="listbox"] [role="option"]:visible',
  );
  const sc = Math.min(await sub.count(), 8);
  if (sc === 0) {
    // maybe direct download already
    const ss = await shot(page, `${menu}-export-${triggerLab}`);
    logF(menu, `export:${triggerLab}`, 'PASS', { screenshot: ss, note: 'no submenu' });
    return;
  }
  for (let si = 0; si < sc; si++) {
    const item = sub.nth(si);
    const slab = await labelOf(item);
    if (SKIP_RE.test(slab)) continue;
    const b2 = state.failedRequests.length;
    const d2 = downloads.length;
    await item.click({ force: true, timeout: 2000 }).catch(() => {});
    depthStats.buttons += 1;
    depthStats.exports += 1;
    await settle(page, 1100);
    const sss = await shot(page, `${menu}-export-${slab || si}`);
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
        title: `Export failed: ${slab || triggerLab}`,
        where: `${menu} / export / ${triggerLab} → ${slab}`,
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
    // Re-open export if more formats remain
    if (si < sc - 1) {
      const reopen = page
        .locator('main button, main a')
        .filter({ hasText: /export|download/i })
        .first();
      if (await reopen.isVisible({ timeout: 400 }).catch(() => false)) {
        await reopen.click({ force: true }).catch(() => {});
        await settle(page, 300);
      }
    }
  }
}

async function deepClickSurface(page, menu, state, opts = {}) {
  const max = opts.max ?? 28;
  const home = opts.home;
  const nestBudget = opts.nestBudget ?? 2;
  let clicked = 0;

  // Search
  const search = page.locator('main input[type="search"], main input[placeholder*="Search" i]').first();
  if (await search.isVisible({ timeout: 350 }).catch(() => false)) {
    const before = state.failedRequests.length;
    await search.fill('a').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await settle(page, 500);
    depthStats.buttons += 1;
    clicked += 1;
    const ss = await shot(page, `${menu}-search`);
    logF(menu, 'search', 'PASS', { screenshot: ss });
    await harvestFailures(state, menu, ss, before, 'search');
    await search.fill('').catch(() => {});
  }

  // ALL tabs — then nest controls per tab
  const tabs = page.locator('main [role="tab"], [role="tablist"] [role="tab"]');
  const tc = await tabs.count();
  for (let i = 0; i < tc; i++) {
    await hardDismiss(page);
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const lab = await labelOf(tab);
    const before = state.failedRequests.length;
    if (!(await safeClick(page, tab))) continue;
    depthStats.tabs += 1;
    depthStats.buttons += 1;
    clicked += 1;
    await settle(page, 550);
    const ss = await shot(page, `${menu}-tab-${lab}`);
    logF(menu, `tab:${lab}`, 'PASS', { screenshot: ss });
    await harvestFailures(state, menu, ss, before, `tab:${lab}`);
    // Nested priority clicks inside this tab (limited)
    await clickPriorityBatch(page, `${menu}/${lab}`, state, {
      home,
      max: Math.min(12, Math.max(6, Math.floor(max / Math.max(tc, 1)))),
      nestBudget,
      skipTabs: true,
    });
  }

  if (tc === 0) {
    await clickPriorityBatch(page, menu, state, { home, max, nestBudget, skipTabs: true });
  } else {
    // Also one more pass on current surface for non-tab controls
    await clickPriorityBatch(page, menu, state, {
      home,
      max: Math.max(8, max - clicked),
      nestBudget,
      skipTabs: true,
    });
  }

  return clicked;
}

async function clickPriorityBatch(page, menu, state, opts = {}) {
  const max = opts.max ?? 18;
  const home = opts.home;
  const nestBudget = opts.nestBudget ?? 2;
  let clicked = 0;

  const candidates = page.locator(
    [
      'main button:visible',
      'main a[href]:visible',
      '[role="main"] button:visible',
      'main [role="combobox"]:visible',
      'main [aria-haspopup="menu"]:visible',
      'main [aria-haspopup="listbox"]:visible',
      'main button[aria-label]:visible',
      'main [role="row"] button:visible',
      'main [role="menuitem"]:visible',
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
    if (href && MENUS.some((m) => m.href === href)) continue;
    const role = (await el.getAttribute('role').catch(() => '')) || '';
    if (opts.skipTabs && role === 'tab') continue;
    const priority =
      PRIORITY_RE.test(lab) || /\/new$|\/edit|export|download|approv|deny|reject/i.test(href + lab);
    const isRowNoise =
      !priority &&
      (/^actions for /i.test(lab) ||
        (/^[A-Z][a-z]+ [A-Z]/.test(lab) && !PRIORITY_RE.test(lab)) ||
        /open menu|more options|row actions/i.test(lab));
    metas.push({ i, lab, href, priority, isRowNoise });
  }

  metas.sort((a, b) => Number(b.priority) - Number(a.priority) || Number(a.isRowNoise) - Number(b.isRowNoise));

  let rowClicks = 0;
  const seenLab = new Set();
  for (const m of metas) {
    if (clicked >= max) break;
    if (seenLab.has(m.lab)) continue;
    if (m.isRowNoise) {
      if (rowClicks >= 4) continue;
      rowClicks += 1;
      depthStats.rowActions += 1;
    }
    seenLab.add(m.lab);
    await hardDismiss(page);

    let el = candidates.nth(m.i);
    const byText = page.locator('main button, main a[href], main [role="combobox"]', { hasText: m.lab }).first();
    if (await byText.isVisible({ timeout: 180 }).catch(() => false)) el = byText;
    // aria-label exact
    const byAria = page.locator(`main button[aria-label="${m.lab}"], main a[aria-label="${m.lab}"]`).first();
    if (await byAria.isVisible({ timeout: 120 }).catch(() => false)) el = byAria;

    const before = state.failedRequests.length;
    const beforeUrl = page.url();
    const ok = await safeClick(page, el);
    if (!ok) {
      logF(menu, m.lab, 'SKIP', { note: 'click failed' });
      continue;
    }
    depthStats.buttons += 1;
    clicked += 1;
    await settle(page, 600);

    const ss = await shot(page, `${menu}-${m.lab}`);
    const isApprove = /^(approve|deny|reject|bulk approve)$/i.test(m.lab.trim());
    const isCheck = /check in|check out/i.test(m.lab);
    logF(menu, m.lab, 'PASS', {
      screenshot: ss,
      url: page.url(),
      note: isApprove || isCheck ? 'mutation noted' : undefined,
    });
    if (isApprove || isCheck) {
      mutations.push({ menu, action: m.lab, url: page.url(), screenshot: ss, at: new Date().toISOString() });
    }

    if (isApprove) {
      const confirm = page
        .locator(
          '[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="alertdialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Approve"), [role="dialog"] button:has-text("Deny")',
        )
        .first();
      if (await confirm.isVisible({ timeout: 500 }).catch(() => false)) {
        await confirm.click({ force: true }).catch(() => {});
        await settle(page, 600);
        await shot(page, `${menu}-${m.lab}-confirmed`);
        mutations.push({
          menu,
          action: `${m.lab}:confirmed`,
          url: page.url(),
          at: new Date().toISOString(),
        });
      }
    }

    if (/export|download|pdf|excel|csv|xlsx/i.test(m.lab)) {
      await clickExportMenu(page, menu, state, m.lab);
    }

    await harvestFailures(state, menu, ss, before, m.lab);

    // Nested dialog / drawer exploration
    if (nestBudget > 0) {
      const dlg = page.locator('[role="dialog"], [role="alertdialog"], [data-radix-dialog-content]').first();
      if (await dlg.isVisible({ timeout: 280 }).catch(() => false)) {
        await exploreDialogNest(page, menu, state, 1, home);
      }
    }

    // Detail page navigation
    if (home) {
      const base = home.replace(/\/$/, '');
      const cur = page.url();
      if (!cur.includes(base) && !cur.includes('/login')) {
        depthStats.detailPages += 1;
        const sd = await shot(page, `${menu}-detail`);
        logF(menu, 'detail-page', 'PASS', { screenshot: sd, url: cur });
        // Explore nested tabs/controls on detail briefly
        await deepClickSurface(page, `${menu}/detail`, state, {
          home: cur.replace(UI, ''),
          max: 10,
          nestBudget: Math.max(0, nestBudget - 1),
        });
        await gotoMenu(page, home);
      }
    }

    await hardDismiss(page);
    if (home) {
      const base = home.replace(/\/$/, '');
      if (!page.url().includes(base) && !page.url().endsWith(home)) {
        await gotoMenu(page, home);
      }
    } else {
      void beforeUrl;
    }
  }

  return clicked;
}

async function exploreDashboard(page, state) {
  depthStats.menus += 1;
  state.page = page;
  await gotoMenu(page, '/dashboard');
  const before = state.failedRequests.length;
  const ss = await shot(page, 'dashboard');
  logF('Dashboard', 'open', 'PASS', { screenshot: ss, url: page.url() });
  await harvestFailures(state, 'Dashboard', ss, before, 'open');

  // Explicit Add Employee
  const add = page
    .locator(
      'main a:has-text("Add Employee"), main button:has-text("Add Employee"), main a:has-text("Add employee")',
    )
    .first();
  if (await add.isVisible({ timeout: 1500 }).catch(() => false)) {
    const b = state.failedRequests.length;
    await safeClick(page, add);
    depthStats.buttons += 1;
    await settle(page, 800);
    const s2 = await shot(page, 'dashboard-add-employee');
    logF('Dashboard', 'Add Employee', 'PASS', { screenshot: s2, url: page.url() });
    await harvestFailures(state, 'Dashboard', s2, b, 'Add Employee');
    await exploreDialogNest(page, 'Dashboard', state, 1, '/dashboard');
    // If navigated to /employees/new explore wizard
    if (page.url().includes('/employees')) {
      depthStats.detailPages += 1;
      await deepClickSurface(page, 'Dashboard/AddEmployee', state, {
        home: page.url().replace(UI, ''),
        max: 14,
        nestBudget: 2,
      });
    }
    await gotoMenu(page, '/dashboard');
  } else {
    logF('Dashboard', 'Add Employee', 'MISS');
  }

  // Explicit Approve / Deny
  for (const label of ['Approve', 'Deny', 'Reject', 'Bulk approve', 'Bulk Approve']) {
    await hardDismiss(page);
    const btn = page.locator(`main button`).filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
    if (!(await btn.isVisible({ timeout: 500 }).catch(() => false))) continue;
    const b = state.failedRequests.length;
    await safeClick(page, btn);
    depthStats.buttons += 1;
    await settle(page, 500);
    const confirm = page
      .locator(
        '[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="dialog"] button:has-text("Approve"), [role="dialog"] button:has-text("Deny")',
      )
      .first();
    if (await confirm.isVisible({ timeout: 500 }).catch(() => false)) {
      await confirm.click({ force: true }).catch(() => {});
      await settle(page, 600);
      mutations.push({ menu: 'Dashboard', action: `${label}:confirmed`, at: new Date().toISOString() });
    } else {
      mutations.push({ menu: 'Dashboard', action: label, at: new Date().toISOString() });
    }
    const s3 = await shot(page, `dashboard-${slug(label)}`);
    logF('Dashboard', label, 'PASS', { screenshot: s3, note: 'mutation noted' });
    await harvestFailures(state, 'Dashboard', s3, b, label);
    await exploreDialogNest(page, 'Dashboard', state, 1, '/dashboard');
    await hardDismiss(page);
  }

  // Range chips
  for (const label of ['7d', '30d', '90d']) {
    const chip = page.locator('main button, main [role="radio"]').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
    if (!(await chip.isVisible({ timeout: 300 }).catch(() => false))) continue;
    await safeClick(page, chip);
    depthStats.buttons += 1;
    await settle(page, 400);
    await shot(page, `dashboard-${label}`);
  }

  await deepClickSurface(page, 'Dashboard', state, { home: '/dashboard', max: 20, nestBudget: 2 });
}

async function exploreReports(page, state) {
  depthStats.menus += 1;
  console.log('→ Reports (all types + export)');
  await gotoMenu(page, '/reports');
  const before = state.failedRequests.length;
  const ss = await shot(page, 'reports');
  logF('Reports', 'open', 'PASS', { screenshot: ss });
  await harvestFailures(state, 'Reports', ss, before, 'open');

  // Discover if report items are real links
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="/reports/"]')].map((a) => a.getAttribute('href')),
  );
  if (!hrefs.length) {
    addIssue({
      title: 'Reports secondary nav not real hrefs',
      where: '/reports left nav',
      why: 'No <a href="/reports/..."> discovered; report switches are not shareable links',
      classification: 'FRONTEND',
      how: 'Use Next <Link href="/reports/<slug>"> for each report item',
      screenshot: ss,
      network: 'n/a',
      expected: 'hrefs for each report',
      actual: 'only client-state switches',
    });
  }

  for (const r of REPORT_ROUTES) {
    const href = `/reports/${r}`;
    console.log(`  report ${r}`);
    await gotoMenu(page, href);
    const b = state.failedRequests.length;
    const s = await shot(page, `reports-${slug(r)}`);
    logF('Reports', `type:${r}`, 'PASS', { screenshot: s, url: page.url() });
    await harvestFailures(state, `Reports/${r}`, s, b, 'open');
    await deepClickSurface(page, `Reports/${r}`, state, { home: href, max: 14, nestBudget: 2 });
    // Explicit export family
    for (const lab of ['Export', 'Download', 'PDF', 'Excel', 'CSV', 'Schedule']) {
      const btn = page.locator('main button, main a').filter({ hasText: new RegExp(`^${lab}$`, 'i') }).first();
      if (!(await btn.isVisible({ timeout: 250 }).catch(() => false))) continue;
      const b2 = state.failedRequests.length;
      await safeClick(page, btn);
      depthStats.buttons += 1;
      await settle(page, 500);
      if (/export|download|pdf|excel|csv/i.test(lab)) await clickExportMenu(page, `Reports/${r}`, state, lab);
      else await exploreDialogNest(page, `Reports/${r}`, state, 1, href);
      await harvestFailures(state, `Reports/${r}`, await shot(page, `reports-${slug(r)}-${lab}`), b2, lab);
      await hardDismiss(page);
    }
  }
}

async function explorePayroll(page, state) {
  depthStats.menus += 1;
  console.log('→ Payroll (nested tabs + extras)');
  await gotoMenu(page, '/payroll');
  const before = state.failedRequests.length;
  const ss = await shot(page, 'payroll');
  logF('Payroll', 'open', 'PASS', { screenshot: ss });
  await harvestFailures(state, 'Payroll', ss, before, 'open');
  await deepClickSurface(page, 'Payroll', state, { home: '/payroll', max: 32, nestBudget: 2 });

  // Open first run row if present
  const run = page.locator('main a[href*="/payroll/"], main tr[data-row], main [role="row"]').first();
  if (await run.isVisible({ timeout: 800 }).catch(() => false)) {
    const b = state.failedRequests.length;
    await safeClick(page, run);
    depthStats.rowActions += 1;
    depthStats.detailPages += 1;
    await settle(page, 800);
    const sd = await shot(page, 'payroll-run-detail');
    logF('Payroll', 'run-detail', 'PASS', { screenshot: sd, url: page.url() });
    await harvestFailures(state, 'Payroll/run', sd, b, 'detail');
    await deepClickSurface(page, 'Payroll/run', state, {
      home: page.url().replace(UI, ''),
      max: 16,
      nestBudget: 2,
    });
    await gotoMenu(page, '/payroll');
  }

  for (const extra of PAYROLL_EXTRA) {
    await gotoMenu(page, extra);
    const b = state.failedRequests.length;
    const se = await shot(page, slug(extra));
    logF('Payroll', `extra:${extra}`, 'PASS', { screenshot: se, url: page.url() });
    await harvestFailures(state, `Payroll${extra}`, se, b, 'open');
    await deepClickSurface(page, `Payroll${extra}`, state, { home: extra, max: 14, nestBudget: 2 });
  }
}

async function exploreSettings(page, state) {
  depthStats.menus += 1;
  console.log('→ Settings (all sub-routes nested)');
  await gotoMenu(page, '/settings');
  const before = state.failedRequests.length;
  const ss = await shot(page, 'settings');
  logF('Settings', 'open', 'PASS', { screenshot: ss });
  await harvestFailures(state, 'Settings', ss, before, 'open');

  for (const sub of SETTINGS_SUB) {
    const href = `/settings/${sub}`;
    console.log(`  settings/${sub}`);
    await gotoMenu(page, href);
    const b = state.failedRequests.length;
    const sSub = await shot(page, `settings-${slug(sub)}`);
    logF('Settings', `sub:${sub}`, 'PASS', { screenshot: sSub, url: page.url() });
    await harvestFailures(state, `Settings/${sub}`, sSub, b, 'open');
    await deepClickSurface(page, `Settings/${sub}`, state, { home: href, max: 12, nestBudget: 2 });
  }
}

async function exploreMenu(page, menu, state) {
  if (menu.label === 'Reports') return exploreReports(page, state);
  if (menu.label === 'Payroll') return explorePayroll(page, state);
  if (menu.label === 'Settings') return exploreSettings(page, state);

  depthStats.menus += 1;
  console.log(`→ ${menu.label}`);
  await gotoMenu(page, menu.href);
  const before = state.failedRequests.length;
  const ss = await shot(page, slug(menu.label));
  logF(menu.label, 'open', 'PASS', { screenshot: ss, url: page.url() });
  await harvestFailures(state, menu.label, ss, before, 'open');

  // Sidebar click evidence
  const nav = page.locator(`nav[aria-label="Main navigation"] a[aria-label="${menu.label}"]`).first();
  if (await nav.isVisible({ timeout: 600 }).catch(() => false)) {
    await nav.click({ force: true, timeout: 3000 }).catch(() => {});
    await settle(page, 350);
  }

  const max =
    menu.label === 'Employees' || menu.label === 'Leave' || menu.label === 'Attendance'
      ? 30
      : menu.label === 'Timesheets' || menu.label === 'Assets'
        ? 24
        : 22;

  await deepClickSurface(page, menu.label, state, { home: menu.href, max, nestBudget: 2 });

  if (menu.label === 'Payout methods') {
    await gotoMenu(page, '/payout-methods/approvals');
    const b = state.failedRequests.length;
    const se = await shot(page, 'payout-approvals');
    logF('Payout methods', 'approvals', 'PASS', { screenshot: se });
    await harvestFailures(state, 'Payout/approvals', se, b, 'open');
    await deepClickSurface(page, 'Payout/approvals', state, {
      home: '/payout-methods/approvals',
      max: 14,
      nestBudget: 2,
    });
  }

  if (menu.label === 'Employees') {
    const row = page.locator('main a[href*="/employees/"]').first();
    if (await row.isVisible({ timeout: 800 }).catch(() => false)) {
      const b = state.failedRequests.length;
      await safeClick(page, row);
      depthStats.detailPages += 1;
      await settle(page, 800);
      const sd = await shot(page, 'employee-detail');
      logF('Employees', 'detail', 'PASS', { screenshot: sd, url: page.url() });
      await harvestFailures(state, 'Employees/detail', sd, b, 'detail');
      await deepClickSurface(page, 'Employees/detail', state, {
        home: page.url().replace(UI, ''),
        max: 16,
        nestBudget: 2,
      });
      await gotoMenu(page, '/employees');
    }
  }

  if (menu.label === 'Permissions') {
    const text = await pageBody(page);
    if (/access restricted|super.?admin/i.test(text)) {
      addIssue({
        title: 'Permissions nav visible to HR_ADMIN',
        where: 'Sidebar → Permissions (/permissions)',
        why: 'HR sees Permissions; page shows Access restricted (Super Admins)',
        classification: 'FRONTEND',
        how: 'Hide Permissions unless memberType === SUPER_ADMIN',
        screenshot: ss,
        network: 'n/a (client role gate)',
        expected: 'hidden nav for HR',
        actual: 'Access restricted page',
      });
    }
  }
}

function writeOutputs() {
  const lines = [];
  lines.push('# HR_ADMIN Full-Depth Nested UI E2E Findings');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Role: ${ROLE} (${EMAIL})`);
  lines.push(`- UI: ${UI}`);
  lines.push(`- API: ${API}`);
  lines.push(`- Tenant: ${TENANT}`);
  lines.push('- MSW: OFF');
  lines.push('- Tool: Playwright Chromium (full-depth nested)');
  lines.push(`- Screenshots: \`docs/e2e-ui-screenshots/hr-admin-deep/\``);
  lines.push('- **No Render deploy. No git commit.**');
  lines.push('');
  lines.push('## Depth stats');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  lines.push(`| Menus tested | ${depthStats.menus} |`);
  lines.push(`| Tabs clicked | ${depthStats.tabs} |`);
  lines.push(`| Buttons/actions clicked | ${depthStats.buttons} |`);
  lines.push(`| Modals/drawers entered | ${depthStats.modalsEntered} |`);
  lines.push(`| Nested wizard steps | ${depthStats.nestedWizardSteps} |`);
  lines.push(`| Row actions | ${depthStats.rowActions} |`);
  lines.push(`| Export actions | ${depthStats.exports} |`);
  lines.push(`| Detail pages | ${depthStats.detailPages} |`);
  lines.push(`| Max nest depth | ${depthStats.maxNestDepth} |`);
  lines.push(`| Screenshots | ${depthStats.screenshots} |`);
  lines.push(`| Issues BACKEND | ${depthStats.be} |`);
  lines.push(`| Issues FRONTEND | ${depthStats.fe} |`);
  lines.push(`| Issues BOTH | ${depthStats.both} |`);
  lines.push(`| Download events | ${downloads.length} |`);
  lines.push(`| Mutations noted | ${mutations.length} |`);
  lines.push('');
  lines.push('## Critical bugs');
  lines.push('');
  const critical = issues.filter(
    (i) =>
      i.classification === 'BACKEND' ||
      /access restricted|duplicate key|bootstrap 401|export failed|summary|NO_EMPLOYEE/i.test(
        `${i.title} ${i.why}`,
      ),
  );
  if (!critical.length) lines.push('_None classified critical beyond listed issues._');
  for (const iss of critical.slice(0, 12)) {
    lines.push(`1. **${iss.id}** [${iss.classification}] ${iss.title} — ${iss.why.slice(0, 180)}`);
  }
  lines.push('');
  lines.push('## Mutations');
  lines.push('');
  if (!mutations.length) lines.push('_None_');
  for (const m of mutations) {
    lines.push(`- \`${m.menu}\` → **${m.action}**${m.screenshot ? ` (\`${m.screenshot}\`)` : ''}`);
  }
  lines.push('');
  lines.push('## Menu / Action Log (abridged — full in results.json)');
  lines.push('');
  const byMenu = new Map();
  for (const f of findings) {
    if (!byMenu.has(f.menu)) byMenu.set(f.menu, []);
    byMenu.get(f.menu).push(f);
  }
  for (const [menu, items] of byMenu) {
    lines.push(`### ${menu} (${items.length} actions)`);
    for (const f of items.slice(0, 40)) {
      lines.push(
        `- **[${f.status}]** ${f.action}` +
          (f.screenshot ? ` — \`${f.screenshot}\`` : '') +
          (f.note ? ` — _${f.note}_` : ''),
      );
    }
    if (items.length > 40) lines.push(`- _…+${items.length - 40} more_`);
    lines.push('');
  }
  lines.push('## Issues');
  lines.push('');
  if (!issues.length) lines.push('_None_');
  for (const iss of issues) {
    lines.push(`### ${iss.id}: ${iss.title}`);
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
  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify({ depthStats, findings, issues, downloads, mutations, role: ROLE, email: EMAIL }, null, 2),
  );

  // Update ONLY ## HR_ADMIN sections in contracts
  for (const [file, side] of [
    ['E2E_BACKEND_ISSUES_CONTRACT.md', 'BACKEND'],
    ['E2E_FRONTEND_ISSUES_CONTRACT.md', 'FRONTEND'],
  ]) {
    const filtered = issues.filter((i) =>
      side === 'BACKEND'
        ? i.classification === 'BACKEND' || i.classification === 'BOTH'
        : i.classification === 'FRONTEND' || i.classification === 'BOTH',
    );
    const fp = path.join(DOCS, file);
    let existing = fs.existsSync(fp)
      ? fs.readFileSync(fp, 'utf8')
      : `# E2E Issues Contract\n\n> Living contract of UI E2E findings.\n`;

    const sec = [
      '',
      '## HR_ADMIN',
      '',
      `**Tester:** \`${EMAIL}\` (${ROLE}) · tenant \`${TENANT}\` · ${new Date().toISOString().slice(0, 10)}`,
      `**Evidence:** \`docs/e2e-ui-screenshots/hr-admin-deep/\` (${depthStats.screenshots} PNGs + \`FINDINGS.md\`)`,
      `**Depth:** menus=${depthStats.menus} tabs=${depthStats.tabs} clicks=${depthStats.buttons} modals=${depthStats.modalsEntered} wizards=${depthStats.nestedWizardSteps} exports=${depthStats.exports} details=${depthStats.detailPages} nestDepth=${depthStats.maxNestDepth}`,
      '',
    ];
    if (!filtered.length) {
      sec.push('_No issues for this side in this deep run._', '');
    }
    for (const iss of filtered) {
      sec.push(`### ${iss.id}`);
      sec.push(`- **Where:** ${iss.where}`);
      sec.push(`- **Why:** ${iss.why}`);
      sec.push(`- **Classification:** ${iss.classification}`);
      sec.push(`- **How to resolve:** ${iss.how}`);
      sec.push(`- **Screenshot:** \`docs/e2e-ui-screenshots/hr-admin-deep/${iss.screenshot || 'n/a'}\``);
      sec.push(`- **Network:** \`${iss.network || 'n/a'}\``);
      sec.push('');
    }
    if (mutations.length) {
      sec.push(
        `> **Mutations (HR deep E2E):** ${mutations.map((m) => `${m.menu}:${m.action}`).join('; ')}`,
        '',
      );
    }

    // Replace only ## HR_ADMIN ... until next ## ROLE heading
    if (/^## HR_ADMIN\b/m.test(existing)) {
      existing = existing.replace(/\n## HR_ADMIN\b[\s\S]*?(?=\n## [A-Z_]|\s*$)/, '\n' + sec.join('\n').trimEnd() + '\n');
    } else {
      // Insert after title block
      const m = existing.match(/^#[^\n]*\n(?:.*\n)*?/);
      if (m) {
        existing = existing.slice(0, m[0].length) + sec.join('\n') + '\n' + existing.slice(m[0].length);
      } else {
        existing = existing.trimEnd() + '\n' + sec.join('\n');
      }
    }
    fs.writeFileSync(fp, existing.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) {
    if (/^\d{3}-.*\.png$/.test(f) || f === 'FINDINGS.md' || f === 'results.json' || f === '_run.log') {
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
    page,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    seen: new Set(),
    consoleAt: 0,
    pageAt: 0,
  };
  attachCollectors(page, state);

  console.log('=== LOGIN ===');
  await login(page, state);

  const navLabels = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main navigation"]');
    if (!nav) return [];
    return [...nav.querySelectorAll('a')].map((a) => (a.getAttribute('aria-label') || a.textContent || '').trim());
  });
  console.log('SIDEBAR:', navLabels.join(' | '));
  await shot(page, 'shell-sidebar');

  console.log('=== DASHBOARD ===');
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

  // Shell notifications
  await gotoMenu(page, '/dashboard');
  const bell = page.locator('button[aria-label*="Notification" i]').first();
  if (await bell.isVisible({ timeout: 800 }).catch(() => false)) {
    const b = state.failedRequests.length;
    await safeClick(page, bell);
    depthStats.buttons += 1;
    await settle(page, 500);
    const sn = await shot(page, 'shell-notifications');
    logF('Shell', 'notifications', 'PASS', { screenshot: sn });
    await harvestFailures(state, 'Shell', sn, b, 'notifications');
    // nested mark-read if present
    const mark = page.locator('button:has-text("Mark all"), button:has-text("Mark as read")').first();
    if (await mark.isVisible({ timeout: 400 }).catch(() => false)) {
      await safeClick(page, mark);
      depthStats.buttons += 1;
      mutations.push({ menu: 'Shell', action: 'mark-notifications', at: new Date().toISOString() });
      await settle(page, 400);
      await shot(page, 'shell-notifications-mark');
    }
    await hardDismiss(page);
  }

  writeOutputs();
  console.log(
    JSON.stringify(
      {
        depthStats,
        issues: issues.length,
        shots: depthStats.screenshots,
        mutations: mutations.length,
      },
      null,
      2,
    ),
  );
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
