/**
 * CONFIRM GAP FILL — SUPER_ADMIN thinner menus
 * Recruitment, Performance, Assets, Announcements, Permissions, Settings (all subs)
 * Deep: every tab / button / row action / modal / nested layer (budgeted).
 * Screenshots → docs/e2e-ui-screenshots/confirm/sa-gap-menus/
 * Append-only ## SA-GAP-MENUS to FE/BE contracts + docs/E2E_GAP_CONFIRM_FINDINGS.md
 * No Render. No git commit.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://localhost:4000/api/v1';
const SHOT =
  process.env.SHOT_DIR ||
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/confirm/sa-gap-menus';
const DOCS = '/Users/mohdsaeedafri/All-Code-Base/EMS/docs';
const EMAIL = 'superadmin@acme.test';
const PASS = 'Password123!';
const TENANT = 'acme-corp-001';
const ROLE = 'SUPER_ADMIN';
const SECTION = 'SA-GAP-MENUS';

const MAX_DEPTH = 3;
const MAX_CONTROLS_PER_LAYER = 22;
const MAX_CANDIDATE_SCAN = 70;
const MAX_CLICKS_PER_MENU = 55;
const MENU_BUDGET_MS = 150 * 1000;
const MAX_ROW_ACTIONS = 6;
const MAX_CARD_OPENS = 4;

/** Gap menus first (thinner prior coverage), then Permissions + Settings */
const MENUS = [
  { label: 'Recruitment', href: '/recruitment', deep: true },
  { label: 'Performance', href: '/performance', deep: true },
  { label: 'Assets', href: '/assets', deep: true },
  { label: 'Announcements', href: '/announcements', deep: true },
  { label: 'Permissions', href: '/permissions', deep: true },
  { label: 'Settings', href: '/settings', deep: true },
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
  'roles-permissions',
];

/** Stress rapid-succession routes (5) */
const STRESS_SETTINGS = [
  'company-profile',
  'branding',
  'authentication',
  'billing-plan',
  'roles-permissions',
];

const SKIP_RE =
  /sign out|log out|logout|delete all|wipe|reset database|deactivate account|remove tenant|permanently delete/i;
const DESTRUCTIVE_RE = /^(delete|remove|archive|terminate|fire)$/i;
const ERR_PATTERNS = [
  /something went wrong/i,
  /unexpected error/i,
  /failed to load/i,
  /failed to fetch/i,
  /internal server error/i,
  /error boundary/i,
  /application error/i,
  /access restricted/i,
];
const DATA_CELL_RE =
  /@|\.com\b|\.test\b|^\+?\d[\d\s-]{6,}$|^(male|female|other|active|inactive|full.?time|part.?time)$/i;

fs.mkdirSync(SHOT, { recursive: true });
for (const f of fs.readdirSync(SHOT)) {
  if (f.endsWith('.png') || ['FINDINGS.md', 'results.json', '_run.log'].includes(f)) {
    try {
      fs.unlinkSync(path.join(SHOT, f));
    } catch {
      /* ignore */
    }
  }
}

let shotIdx = 0;
let maxDepthReached = 0;
let menuClickBudget = MAX_CLICKS_PER_MENU;
let menuStartedAt = 0;
const globalVisited = new Set();
const clickLog = [];
const mutations = [];
const downloads = [];
const findings = [];
const issues = [];
const seenIssue = new Set();
const stressEvents = [];
const counters = {
  menus: 0,
  settingsSubs: 0,
  controlsClicked: 0,
  layersExplored: 0,
  screenshots: 0,
  exportsTried: 0,
  downloadsOk: 0,
  downloadsFail: 0,
  be: 0,
  fe: 0,
  both: 0,
  stressNavs: 0,
};

function menuBudgetOk() {
  return menuClickBudget > 0 && Date.now() - menuStartedAt < MENU_BUDGET_MS;
}
function resetMenuBudget() {
  menuClickBudget = MAX_CLICKS_PER_MENU;
  menuStartedAt = Date.now();
}
function consumeClick() {
  menuClickBudget -= 1;
  counters.controlsClicked += 1;
}
function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52);
}
function logLine(...args) {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(line);
  try {
    fs.appendFileSync(path.join(SHOT, '_run.log'), line + '\n');
  } catch {
    /* ignore */
  }
}
async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  try {
    await page.screenshot({ path: path.join(SHOT, file), fullPage: false, timeout: 8000 });
  } catch {
    try {
      await page.screenshot({ path: path.join(SHOT, file), timeout: 4000 });
    } catch {
      return null;
    }
  }
  counters.screenshots += 1;
  if (shotIdx % 5 === 0 || shotIdx <= 5) logLine(`  📸 ${file}`);
  return file;
}
function classify(url, status, body) {
  const u = url || '';
  const b = body || '';
  if (/NO_EMPLOYEE_RECORD|NOT_IMPLEMENTED|INTERNAL|Prisma|ECONNREFUSED/i.test(b)) return 'BACKEND';
  if (status >= 500) return 'BACKEND';
  if (u.includes(':4000') || /\/api\/v1\//.test(u)) return 'BACKEND';
  if (u.includes('localhost:3001/api/')) {
    if (status === 502 || status === 504 || status === 404) return 'BOTH';
    if (status === 400 || status === 403 || status === 401) return 'BACKEND';
  }
  if (status >= 400 && /\/api\//.test(u)) return 'BACKEND';
  return 'FRONTEND';
}
function addIssue(p) {
  const key = `${p.classification}|${p.title}|${(p.network || '').slice(0, 120)}`;
  if (seenIssue.has(key)) return null;
  seenIssue.add(key);
  const id = `ISSUE-SA-GAP-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, role: ROLE, section: SECTION, ...p };
  issues.push(issue);
  if (issue.classification === 'BACKEND') counters.be += 1;
  else if (issue.classification === 'FRONTEND') counters.fe += 1;
  else counters.both += 1;
  console.log(`  🐛 ${id} [${issue.classification}] ${issue.title}`);
  return issue;
}
function logF(menu, action, status, detail = {}) {
  findings.push({ menu, action, status, at: new Date().toISOString(), ...detail });
}
function pageAlive(page) {
  return page && !page.isClosed();
}
async function settle(page, ms = 450) {
  if (!pageAlive(page)) return;
  await page.waitForLoadState('domcontentloaded', { timeout: 12000 }).catch(() => {});
  if (!pageAlive(page)) return;
  await page.waitForTimeout(ms).catch(() => {});
}
async function hardDismiss(page) {
  if (!pageAlive(page)) return;
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(50).catch(() => {});
  }
  await page
    .evaluate(() => {
      document.querySelectorAll('[data-base-ui-inert]').forEach((el) => {
        try {
          el.remove();
        } catch {
          /* ignore */
        }
      });
    })
    .catch(() => {});
  const cancel = page
    .locator(
      '[role="dialog"] button:has-text("Cancel"), [role="alertdialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("Close")',
    )
    .first();
  if (await cancel.isVisible({ timeout: 120 }).catch(() => false)) {
    await cancel.click({ force: true, timeout: 800 }).catch(() => {});
  }
}
function attachCollectors(page, state) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|React DevTools|Download the React|hydration|Failed to load resource/i.test(text))
      return;
    state.consoleErrors.push({ text: text.slice(0, 280), url: page.url(), t: Date.now() });
  });
  page.on('pageerror', (err) => {
    state.pageErrors.push({
      text: String(err?.message || err).slice(0, 280),
      url: page.url(),
      t: Date.now(),
    });
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
      t: Date.now(),
    });
  });
  page.on('download', async (dl) => {
    try {
      const p = await dl.path();
      const ok = !!p && !dl.failure();
      downloads.push({ suggested: dl.suggestedFilename(), ok, failure: dl.failure(), pageUrl: page.url() });
      if (ok) counters.downloadsOk += 1;
      else counters.downloadsFail += 1;
    } catch (e) {
      downloads.push({
        suggested: dl.suggestedFilename(),
        ok: false,
        failure: String(e),
        pageUrl: page.url(),
      });
      counters.downloadsFail += 1;
    }
  });
}
function harvest(state, menu, screenshot, sinceIdx, actionLabel) {
  for (const fr of state.failedRequests.slice(sinceIdx)) {
    const key = `${fr.method}|${fr.status}|${fr.url.split('?')[0]}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    if (/\/api\/auth\/(me|refresh)/.test(fr.url) && fr.status === 401 && menu === 'Login') continue;
    const cls = classify(fr.url, fr.status, fr.body);
    addIssue({
      title: `${menu}: ${fr.status} ${fr.method} …/${fr.url.split('/').slice(-2).join('/')}`,
      where: `${menu} / ${fr.pageUrl} / ${actionLabel || 'page'}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${(fr.body || '').slice(0, 240)}`,
      classification: cls,
      how:
        cls === 'BACKEND'
          ? 'Fix backend route/handler/status for SUPER_ADMIN'
          : 'Fix FE client path, BFF proxy, or error UI',
      screenshot,
      network: `${fr.method} ${fr.url} ${fr.status}`,
      expected: '2xx or graceful empty',
      actual: `${fr.status} ${(fr.body || '').slice(0, 120)}`,
    });
  }
  for (const ce of state.consoleErrors.slice(state.consoleAt || 0)) {
    if (/Failed to load resource|401|403|404/i.test(ce.text) && /api\//i.test(ce.text)) continue;
    const key = `c:${ce.text.slice(0, 90)}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    addIssue({
      title: `${menu}: console error`,
      where: `${menu} / ${ce.url}`,
      why: ce.text.slice(0, 300),
      classification: 'FRONTEND',
      how: 'Fix React/runtime error in FE',
      screenshot,
      network: 'n/a (console)',
      expected: 'clean console',
      actual: ce.text.slice(0, 160),
    });
  }
  for (const pe of state.pageErrors.slice(state.pageAt || 0)) {
    const key = `p:${pe.text.slice(0, 90)}`;
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
async function checkVisibleErrors(page, menu, action, screenshot) {
  const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const hit = ERR_PATTERNS.find((re) => re.test(text));
  if (!hit) return;
  const strong = /something went wrong|error boundary|failed to load|internal server/i.test(text);
  if (!strong && /access restricted/i.test(text)) {
    addIssue({
      title: `${menu}: Access restricted for SUPER_ADMIN`,
      where: `${menu} / ${page.url()} / ${action}`,
      why: 'SUPER_ADMIN saw Access Restricted — role gate too strict or wrong role in session',
      classification: 'FRONTEND',
      how: 'Allow SUPER_ADMIN through permissions/settings gates',
      screenshot,
      network: 'n/a',
    });
    return;
  }
  if (!strong) return;
  addIssue({
    title: `${menu}: visible error UI`,
    where: `${menu} / ${page.url()} / ${action}`,
    why: `Visible pattern /${hit.source}/`,
    classification: 'FRONTEND',
    how: 'Resolve underlying failure; show role-aware empty/error state',
    screenshot,
    network: 'n/a',
  });
}
async function labelOf(el) {
  const text = ((await el.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const aria = (await el.getAttribute('aria-label').catch(() => '')) || '';
  const title = (await el.getAttribute('title').catch(() => '')) || '';
  const href = (await el.getAttribute('href').catch(() => '')) || '';
  const testid = (await el.getAttribute('data-testid').catch(() => '')) || '';
  return text || aria || title || testid || href || 'control';
}
async function safeClick(el) {
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 1000 });
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
async function gotoMenu(page, href) {
  if (!pageAlive(page)) throw new Error('page closed before goto');
  await hardDismiss(page);
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 600);
  await hardDismiss(page);
}
async function fillDialogLight(dlg) {
  const inputs = dlg.locator(
    'input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea:visible',
  );
  const ic = Math.min(await inputs.count(), 6);
  for (let j = 0; j < ic; j++) {
    const inp = inputs.nth(j);
    const t = (await inp.getAttribute('type')) || 'text';
    const name = `${(await inp.getAttribute('name')) || ''}${(await inp.getAttribute('id')) || ''}${(await inp.getAttribute('placeholder')) || ''}`;
    if (await inp.isDisabled().catch(() => true)) continue;
    if (t === 'email' || /email/i.test(name)) await inp.fill('e2e.superadmin@acme.test').catch(() => {});
    else if (t === 'number' || /salary|amount|phone/i.test(name)) await inp.fill('1').catch(() => {});
    else if (t === 'date' || /date/i.test(name)) await inp.fill('2026-08-15').catch(() => {});
    else await inp.fill('E2E SA Stress').catch(() => {});
  }
}
async function exploreOpenLayer(page, state, menu, depth, homeHref) {
  maxDepthReached = Math.max(maxDepthReached, depth);
  counters.layersExplored += 1;
  if (depth > MAX_DEPTH || !menuBudgetOk()) return;

  const scopeSelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[data-radix-dialog-content]',
    '[data-vaul-drawer]',
    'aside[data-state="open"]',
  ];
  let layer = null;
  for (const sel of scopeSelectors) {
    const loc = page.locator(sel).last();
    if (await loc.isVisible({ timeout: 150 }).catch(() => false)) {
      layer = loc;
      break;
    }
  }
  const scope = layer || page.locator('main, [role="main"]').first();
  const urlPath = new URL(page.url()).pathname;

  const tabs = scope.locator('[role="tab"]');
  const tc = Math.min(await tabs.count().catch(() => 0), 10);
  for (let i = 0; i < tc; i++) {
    if (!menuBudgetOk()) break;
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const lab = await labelOf(tab);
    const vkey = `${urlPath}|d${depth}|tab|${lab}`;
    if (globalVisited.has(vkey)) continue;
    globalVisited.add(vkey);
    const before = state.failedRequests.length;
    if (!(await safeClick(tab))) continue;
    consumeClick();
    clickLog.push({ menu, depth, action: `tab:${lab}`, url: page.url() });
    await settle(page, 350);
    const ss = await shot(page, `${slug(menu)}-d${depth}-tab-${lab}`);
    logF(menu, `d${depth}/tab:${lab}`, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, `tab:${lab}`);
    await checkVisibleErrors(page, menu, `tab ${lab}`, ss);
  }

  const candidates = scope.locator(
    'button:visible, a[href]:visible, [role="button"]:visible, [role="menuitem"]:visible, [role="combobox"]:visible',
  );
  const rawCount = await candidates.count().catch(() => 0);
  const count = Math.min(rawCount, MAX_CANDIDATE_SCAN);
  const metas = [];
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab) || lab === 'control') continue;
    if (DATA_CELL_RE.test(lab.trim())) continue;
    const href = (await el.getAttribute('href').catch(() => '')) || '';
    if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    // Skip settings-nav spam while deep-clicking a settings panel (we visit subs explicitly)
    if (menu.startsWith('Settings/') && href.startsWith('/settings/') && href !== homeHref) continue;
    if (href.startsWith('/settings/') && menu !== 'Settings' && !menu.startsWith('Settings/')) continue;
    // Skip leaving admin shard
    if (
      href &&
      href.startsWith('/') &&
      !href.startsWith('/permissions') &&
      !href.startsWith('/settings') &&
      !href.startsWith('/recruitment') &&
      !href.startsWith('/performance') &&
      !href.startsWith('/assets') &&
      !href.startsWith('/announcements') &&
      !href.startsWith('#')
    ) {
      // allow in-page relative only for current section; skip cross-app nav
      if (
        !urlPath.startsWith(href.split('?')[0].replace(/\/$/, '')) &&
        !['/dashboard', '/employees', '/leave', '/payroll', '/reports', '/analytics', '/attendance', '/timesheets', '/holidays', '/departments', '/payout-methods'].some(
          (p) => href === p || href.startsWith(p + '/'),
        )
      ) {
        /* keep in-scope links */
      } else if (
        ['/dashboard', '/employees', '/leave', '/payroll', '/reports', '/analytics', '/attendance', '/timesheets', '/holidays', '/departments', '/payout-methods'].some(
          (p) => href === p || href.startsWith(p + '/'),
        )
      ) {
        continue;
      }
    }
    const role = (await el.getAttribute('role').catch(() => '')) || '';
    const disabled = await el.isDisabled().catch(() => false);
    if (disabled) continue;
    const vkey = `${urlPath}|d${depth}|${lab}|${href}`;
    if (globalVisited.has(vkey)) continue;
    const pri =
      /add|create|new|save|upload|export|invite|publish|assign|edit|open|view|filter|search|reset|manage/i.test(
        lab,
      )
        ? 0
        : role === 'tab'
          ? 2
          : 1;
    metas.push({ i, lab, href, pri });
  }
  metas.sort((a, b) => a.pri - b.pri || a.i - b.i);
  const picked = metas.slice(0, MAX_CONTROLS_PER_LAYER);

  for (const m of picked) {
    if (!menuBudgetOk()) break;
    const el = candidates.nth(m.i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const vkey = `${urlPath}|d${depth}|${m.lab}|${m.href}`;
    if (globalVisited.has(vkey)) continue;
    globalVisited.add(vkey);

    if (DESTRUCTIVE_RE.test(m.lab.trim()) && !/draft|cancel/i.test(m.lab)) {
      logF(menu, `skip-destructive:${m.lab}`, 'SKIP');
      continue;
    }

    const before = state.failedRequests.length;
    const beforeUrl = page.url();
    if (!(await safeClick(el))) continue;
    consumeClick();
    clickLog.push({ menu, depth, action: m.lab, url: page.url() });
    await settle(page, 400);

    const dlg = page.locator('[role="dialog"], [role="alertdialog"]').last();
    const dlgOpen = await dlg.isVisible({ timeout: 250 }).catch(() => false);
    if (dlgOpen) {
      await fillDialogLight(dlg);
      const ss = await shot(page, `${slug(menu)}-d${depth}-dlg-${m.lab}`);
      harvest(state, menu, ss, before, `dlg:${m.lab}`);
      await checkVisibleErrors(page, menu, `dlg ${m.lab}`, ss);
      if (depth < MAX_DEPTH) {
        await exploreOpenLayer(page, state, menu, depth + 1, homeHref);
      }
      // Prefer Cancel over Save for stress safety
      const cancel = dlg.getByRole('button', { name: /cancel|close|dismiss/i }).first();
      if (await cancel.isVisible({ timeout: 200 }).catch(() => false)) {
        await cancel.click({ force: true }).catch(() => {});
        consumeClick();
        await settle(page, 250);
      } else {
        await hardDismiss(page);
      }
      continue;
    }

    const ss = await shot(page, `${slug(menu)}-d${depth}-${m.lab}`);
    logF(menu, `d${depth}/${m.lab}`, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, m.lab);
    await checkVisibleErrors(page, menu, m.lab, ss);

    const afterUrl = page.url();
    if (afterUrl !== beforeUrl && depth < MAX_DEPTH) {
      await exploreOpenLayer(page, state, menu, depth + 1, homeHref);
      // return home
      if (homeHref && !page.url().includes(homeHref.split('?')[0])) {
        await gotoMenu(page, homeHref).catch(() => {});
      }
    } else if (depth < MAX_DEPTH && /menu|more|actions|options/i.test(m.lab)) {
      await exploreOpenLayer(page, state, menu, depth + 1, homeHref);
      await hardDismiss(page);
    }
  }
}

async function login(page, state) {
  logLine('→ Login');
  const before = state.failedRequests.length;
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 500);
  const ss0 = await shot(page, 'login-form');
  harvest(state, 'Login', ss0, before, 'form');

  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(PASS);
  const tenant = page.locator('input[name="tenant"], input[placeholder*="tenant" i]').first();
  if (await tenant.isVisible({ timeout: 300 }).catch(() => false)) {
    await tenant.fill(TENANT);
  }
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/dashboard|home|employees|settings/i, { timeout: 30000 }).catch(() => {});
  await settle(page, 1200);
  const ss1 = await shot(page, 'login-success');
  harvest(state, 'Login', ss1, before, 'submit');
  const body = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  if (/invalid|incorrect|unauthorized/i.test(body) && /sign in|log in/i.test(body)) {
    addIssue({
      title: 'Login failed for SUPER_ADMIN',
      where: '/login',
      why: body.slice(0, 200),
      classification: 'BACKEND',
      how: 'Verify seed user superadmin@acme.test',
      screenshot: ss1,
      network: 'POST /auth/login',
    });
    throw new Error('login failed');
  }
  logF('Login', 'submit', 'PASS', { screenshot: ss1, url: page.url() });
}

async function exploreRowAndCardActions(page, state, menu, homeHref) {
  // Row / kebab / announcement actions — prior deep often skipped these
  const actionBtns = page.locator(
    'main button[aria-label*="More options" i], main button[aria-label*="actions" i], main button[aria-label*="Actions for" i], main button:has-text("View"), main button:has-text("Open"), main button:has-text("Review")',
  );
  const n = Math.min(await actionBtns.count().catch(() => 0), MAX_ROW_ACTIONS);
  for (let i = 0; i < n; i++) {
    if (!menuBudgetOk()) break;
    const btn = actionBtns.nth(i);
    if (!(await btn.isVisible().catch(() => false))) continue;
    const lab = await labelOf(btn);
    const vkey = `${homeHref}|rowact|${lab}|${i}`;
    if (globalVisited.has(vkey)) continue;
    globalVisited.add(vkey);
    const before = state.failedRequests.length;
    if (!(await safeClick(btn))) {
      logF(menu, `rowact:${lab}`, 'FAIL', { reason: 'click' });
      continue;
    }
    consumeClick();
    clickLog.push({ menu, depth: 0, action: `rowact:${lab}`, url: page.url() });
    await settle(page, 450);
    const ss = await shot(page, `${slug(menu)}-row-${slug(lab)}-${i}`);
    logF(menu, `rowact:${lab}`, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, `rowact:${lab}`);
    await checkVisibleErrors(page, menu, `rowact ${lab}`, ss);

    // Menu items inside popover
    const items = page.locator('[role="menuitem"]:visible, [role="menu"] button:visible');
    const ic = Math.min(await items.count().catch(() => 0), 6);
    for (let j = 0; j < ic; j++) {
      if (!menuBudgetOk()) break;
      const item = items.nth(j);
      const ilab = await labelOf(item);
      if (!ilab || SKIP_RE.test(ilab) || DESTRUCTIVE_RE.test(ilab.trim())) continue;
      const before2 = state.failedRequests.length;
      if (!(await safeClick(item))) continue;
      consumeClick();
      clickLog.push({ menu, depth: 1, action: `menuitem:${ilab}`, url: page.url() });
      await settle(page, 450);
      const ss2 = await shot(page, `${slug(menu)}-menu-${slug(ilab)}`);
      logF(menu, `menuitem:${ilab}`, 'PASS', { screenshot: ss2 });
      harvest(state, menu, ss2, before2, `menuitem:${ilab}`);
      await checkVisibleErrors(page, menu, `menuitem ${ilab}`, ss2);
      const dlg = page.locator('[role="dialog"], [role="alertdialog"]').last();
      if (await dlg.isVisible({ timeout: 250 }).catch(() => false)) {
        await fillDialogLight(dlg);
        await shot(page, `${slug(menu)}-menu-dlg-${slug(ilab)}`);
        await exploreOpenLayer(page, state, menu, 1, homeHref);
        const cancel = dlg.getByRole('button', { name: /cancel|close|dismiss/i }).first();
        if (await cancel.isVisible({ timeout: 200 }).catch(() => false)) {
          await cancel.click({ force: true }).catch(() => {});
        } else {
          await hardDismiss(page);
        }
      } else {
        await hardDismiss(page);
      }
      // reopen actions menu for next item if needed — go home
      if (page.url() !== `${FE}${homeHref}` && !page.url().includes(homeHref)) {
        await gotoMenu(page, homeHref).catch(() => {});
        break;
      }
      // try reopen same row action for remaining items
      if (j < ic - 1) {
        const again = actionBtns.nth(i);
        if (await again.isVisible().catch(() => false)) await safeClick(again);
        await settle(page, 250);
      }
    }
    await hardDismiss(page);
  }

  // Recruitment pipeline cards (candidate chips)
  if (menu === 'Recruitment') {
    const cards = page.locator('main button').filter({ hasText: /job-|Referral|\d+d\b/i });
    const cn = Math.min(await cards.count().catch(() => 0), MAX_CARD_OPENS);
    for (let i = 0; i < cn; i++) {
      if (!menuBudgetOk()) break;
      const card = cards.nth(i);
      if (!(await card.isVisible().catch(() => false))) continue;
      const lab = await labelOf(card);
      const vkey = `recruit-card|${lab.slice(0, 40)}|${i}`;
      if (globalVisited.has(vkey)) continue;
      globalVisited.add(vkey);
      const before = state.failedRequests.length;
      if (!(await safeClick(card))) {
        logF(menu, `card:${lab.slice(0, 40)}`, 'FAIL', { reason: 'click' });
        continue;
      }
      consumeClick();
      await settle(page, 500);
      const ss = await shot(page, `recruitment-card-${i}`);
      logF(menu, `card:${lab.slice(0, 40)}`, 'PASS', { screenshot: ss });
      harvest(state, menu, ss, before, `card:${i}`);
      await checkVisibleErrors(page, menu, `card ${i}`, ss);
      await exploreOpenLayer(page, state, menu, 1, homeHref);
      await hardDismiss(page);
      if (!page.url().includes('/recruitment')) await gotoMenu(page, homeHref).catch(() => {});
    }
  }
}

async function exploreMenu(page, state, menu) {
  counters.menus += 1;
  resetMenuBudget();
  logLine(`→ ${menu.label}`);
  await gotoMenu(page, menu.href);
  const before = state.failedRequests.length;
  const ss = await shot(page, `${slug(menu.label)}-land`);
  logF(menu.label, 'open', 'PASS', { screenshot: ss, url: page.url() });
  harvest(state, menu.label, ss, before, 'open');
  await checkVisibleErrors(page, menu.label, 'land', ss);
  await exploreOpenLayer(page, state, menu.label, 0, menu.href);
  await exploreRowAndCardActions(page, state, menu.label, menu.href);

  // Re-walk each primary tab with row actions (gap menus)
  const tabs = page.locator('main [role="tab"]');
  const tc = Math.min(await tabs.count().catch(() => 0), 8);
  for (let i = 0; i < tc; i++) {
    if (!menuBudgetOk()) break;
    resetMenuBudget();
    await gotoMenu(page, menu.href);
    const tab = page.locator('main [role="tab"]').nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const tlab = await labelOf(tab);
    const beforeT = state.failedRequests.length;
    if (!(await safeClick(tab))) continue;
    consumeClick();
    await settle(page, 500);
    const sst = await shot(page, `${slug(menu.label)}-tabdeep-${slug(tlab)}`);
    logF(menu.label, `tabdeep:${tlab}`, 'PASS', { screenshot: sst });
    harvest(state, menu.label, sst, beforeT, `tabdeep:${tlab}`);
    await exploreOpenLayer(page, state, `${menu.label}/${tlab}`, 0, menu.href);
    await exploreRowAndCardActions(page, state, `${menu.label}/${tlab}`, menu.href);
  }

  if (menu.label === 'Settings') {
    for (const sub of SETTINGS_SUB) {
      const href = `/settings/${sub}`;
      logLine(`  settings/${sub}`);
      // Tighter budget per settings sub to avoid timeout
      menuClickBudget = 18;
      menuStartedAt = Date.now();
      counters.settingsSubs += 1;
      const b0 = state.failedRequests.length;
      const t0 = Date.now();
      try {
        await gotoMenu(page, href);
      } catch (e) {
        const s = await shot(page, `settings-${slug(sub)}-timeout`);
        addIssue({
          title: `Settings nav timeout: ${sub}`,
          where: href,
          why: String(e).slice(0, 200),
          classification: 'FRONTEND',
          how: 'Investigate slow settings chunk',
          screenshot: s,
          network: 'nav-timeout',
        });
        logF('Settings', `sub:${sub}`, 'FAIL', { error: String(e).slice(0, 160), screenshot: s });
        continue;
      }
      const sSub = await shot(page, `settings-${slug(sub)}-land`);
      logF('Settings', `sub:${sub}`, 'PASS', {
        screenshot: sSub,
        ms: Date.now() - t0,
        url: page.url(),
      });
      harvest(state, `Settings/${sub}`, sSub, b0, 'open');
      await checkVisibleErrors(page, `Settings/${sub}`, 'land', sSub);
      await exploreOpenLayer(page, state, `Settings/${sub}`, 0, href);
    }
  }
}

async function stressRapidSettings(page, state) {
  logLine('→ STRESS rapid settings (5 routes)');
  resetMenuBudget();
  const tStart = Date.now();
  const failBefore = state.failedRequests.length;
  const consBefore = state.consoleErrors.length;
  const pageBefore = state.pageErrors.length;

  for (const sub of STRESS_SETTINGS) {
    const href = `/settings/${sub}`;
    const t0 = Date.now();
    counters.stressNavs += 1;
    try {
      // Rapid: minimal settle
      await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(120);
    } catch (e) {
      stressEvents.push({ sub, ok: false, err: String(e).slice(0, 160), ms: Date.now() - t0 });
      const s = await shot(page, `stress-${slug(sub)}-fail`);
      addIssue({
        title: `Stress nav fail: ${sub}`,
        where: href,
        why: String(e).slice(0, 200),
        classification: 'FRONTEND',
        how: 'Harden settings route transitions under rapid nav',
        screenshot: s,
        network: 'stress-nav-timeout',
      });
      continue;
    }
    const ss = await shot(page, `stress-${slug(sub)}`);
    const fails = state.failedRequests.slice(failBefore).filter((f) => f.t >= t0 || !f.t);
    const cons = state.consoleErrors.slice(consBefore).filter((c) => c.t >= t0 || !c.t);
    stressEvents.push({
      sub,
      ok: true,
      ms: Date.now() - t0,
      url: page.url(),
      screenshot: ss,
      newFails: fails.length,
      newConsole: cons.length,
      fails: fails.slice(0, 8).map((f) => `${f.status} ${f.method} ${f.url}`),
      console: cons.slice(0, 5).map((c) => c.text.slice(0, 120)),
    });
    logLine(`  stress ${sub} ${Date.now() - t0}ms fails+${fails.length} cons+${cons.length}`);
  }

  await settle(page, 500);
  const ssEnd = await shot(page, 'stress-settings-end');
  harvest(state, 'Settings/stress', ssEnd, failBefore, 'rapid-5');
  const newFails = state.failedRequests.slice(failBefore);
  const newCons = state.consoleErrors.slice(consBefore);
  const newPage = state.pageErrors.slice(pageBefore);

  if (newFails.length || newCons.length || newPage.length) {
    addIssue({
      title: `Stress rapid-5 settings: ${newFails.length} net fails, ${newCons.length} console, ${newPage.length} pageerrors`,
      where: `Settings stress / ${STRESS_SETTINGS.join(',')}`,
      why: [
        `durationMs=${Date.now() - tStart}`,
        ...newFails.slice(0, 10).map((f) => `${f.status} ${f.method} ${f.url}`),
        ...newCons.slice(0, 5).map((c) => `console: ${c.text.slice(0, 140)}`),
        ...newPage.slice(0, 3).map((p) => `page: ${p.text.slice(0, 140)}`),
      ].join(' | '),
      classification: newFails.some((f) => classify(f.url, f.status, f.body) === 'BACKEND')
        ? newCons.length
          ? 'BOTH'
          : 'BACKEND'
        : 'FRONTEND',
      how: 'Debounce settings fetches on rapid nav; cancel in-flight; fix failing endpoints',
      screenshot: ssEnd,
      network: newFails
        .slice(0, 5)
        .map((f) => `${f.method} ${f.url} ${f.status}`)
        .join(' · '),
    });
  } else {
    logF('Settings/stress', 'rapid-5', 'PASS', { screenshot: ssEnd, ms: Date.now() - tStart });
  }
}

function issueMd(iss) {
  return [
    `### ${iss.id}: ${iss.title}`,
    `- **Where:** ${iss.where}`,
    `- **Why:** ${iss.why}`,
    `- **Classification:** ${iss.classification}`,
    `- **How to resolve:** ${iss.how}`,
    `- **Screenshot:** \`${iss.screenshot ? `docs/e2e-ui-screenshots/confirm/sa-gap-menus/${iss.screenshot}` : 'n/a'}\``,
    `- **Network:** \`${iss.network || 'n/a'}\``,
    '',
  ].join('\n');
}

function appendOnlyContract(file, heading, bodyLines) {
  const p = path.join(DOCS, file);
  let existing = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const marker = `## ${heading}`;
  // Append-only: if section exists, append a dated subsection instead of wiping
  if (existing.includes(marker)) {
    if (!existing.endsWith('\n')) existing += '\n';
    existing +=
      `\n### ${heading} re-run ${new Date().toISOString().slice(0, 10)}\n\n` +
      bodyLines.filter((l) => !l.startsWith(`## ${heading}`)).join('\n').trim() +
      '\n';
  } else {
    if (!existing.endsWith('\n')) existing += '\n';
    existing += '\n' + bodyLines.join('\n').trim() + '\n';
  }
  fs.writeFileSync(p, existing);
}

function writeFindings() {
  const be = issues.filter((i) => i.classification === 'BACKEND' || i.classification === 'BOTH');
  const fe = issues.filter((i) => i.classification === 'FRONTEND' || i.classification === 'BOTH');
  const pass = findings.filter((f) => f.status === 'PASS');
  const fail = findings.filter((f) => f.status === 'FAIL' || f.status === 'SKIP');
  const lines = [];
  lines.push(`# ${SECTION} — SUPER_ADMIN Gap-Menus Confirm Deep E2E`);
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Role: \`${ROLE}\` (\`${EMAIL}\` / tenant \`${TENANT}\`)`);
  lines.push(`> UI: \`${FE}\` · API: \`${API}\``);
  lines.push('> Tool: Playwright Chromium · gap-fill deep (tabs/row actions/modals/settings subs)');
  lines.push(`> Screenshots: \`docs/e2e-ui-screenshots/confirm/sa-gap-menus/\``);
  lines.push('> **No Render. No git commit.**');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  lines.push(`| Menus | **${counters.menus}** |`);
  lines.push(`| Settings subroutes | **${counters.settingsSubs}** |`);
  lines.push(`| Controls clicked | **${counters.controlsClicked}** |`);
  lines.push(`| Max depth | **${maxDepthReached}** |`);
  lines.push(`| Layers | **${counters.layersExplored}** |`);
  lines.push(`| Screenshots | **${counters.screenshots}** |`);
  lines.push(`| Findings PASS | **${pass.length}** |`);
  lines.push(`| Findings FAIL/SKIP | **${fail.length}** |`);
  lines.push(`| Issues BACKEND | **${counters.be}** |`);
  lines.push(`| Issues FRONTEND | **${counters.fe}** |`);
  lines.push(`| Issues BOTH | **${counters.both}** |`);
  lines.push(`| Click log | **${clickLog.length}** |`);
  lines.push('');
  lines.push('## Menus covered');
  lines.push('');
  for (const m of MENUS) lines.push(`- ${m.label} (\`${m.href}\`)`);
  lines.push(`- Settings subs (${SETTINGS_SUB.length}): ${SETTINGS_SUB.map((s) => `\`${s}\``).join(', ')}`);
  lines.push('');
  lines.push('## Controls tested (PASS)');
  lines.push('');
  if (!pass.length) lines.push('_None._');
  const byMenu = {};
  for (const f of pass) {
    byMenu[f.menu] = byMenu[f.menu] || [];
    byMenu[f.menu].push(f);
  }
  for (const [menu, items] of Object.entries(byMenu)) {
    lines.push(`### ${menu} (${items.length})`);
    lines.push('');
    for (const f of items) {
      lines.push(`- PASS \`${f.action}\`${f.screenshot ? ` — \`${f.screenshot}\`` : ''}`);
    }
    lines.push('');
  }
  lines.push('## Controls failed / skipped');
  lines.push('');
  if (!fail.length) lines.push('_None._');
  for (const f of fail) {
    lines.push(
      `- **${f.status}** ${f.menu} → \`${f.action}\`${f.error || f.reason ? ` — ${f.error || f.reason}` : ''}${f.screenshot ? ` — \`${f.screenshot}\`` : ''}`,
    );
  }
  lines.push('');
  lines.push('## Issues (NEW this run)');
  lines.push('');
  if (!issues.length) lines.push('_None recorded._');
  for (const iss of issues) lines.push(issueMd(iss));
  lines.push('## Click log (truncated)');
  lines.push('');
  for (const c of clickLog.slice(0, 350)) {
    lines.push(`- d${c.depth} ${c.menu} → ${c.action}`);
  }
  if (clickLog.length > 350) lines.push(`- … +${clickLog.length - 350} more`);
  lines.push('');
  lines.push('## Mutations');
  lines.push('');
  lines.push(mutations.length ? mutations.map((m) => `- ${JSON.stringify(m)}`).join('\n') : '_None (Cancel-preferred)._');
  lines.push('');
  lines.push('## Downloads');
  lines.push('');
  lines.push(downloads.length ? downloads.map((d) => `- \`${JSON.stringify(d)}\``).join('\n') : '_None_');
  lines.push('');
  fs.writeFileSync(path.join(SHOT, 'FINDINGS.md'), lines.join('\n'));
  fs.writeFileSync(
    path.join(SHOT, 'results.json'),
    JSON.stringify(
      {
        role: ROLE,
        section: SECTION,
        generatedAt: new Date().toISOString(),
        counters,
        maxDepthReached,
        issues,
        clickLog,
        findings,
        downloads,
      },
      null,
      2,
    ),
  );
  return { be, fe, lines };
}

function writeContracts(be, fe, findingsLines) {
  const commonHead = [
    `## ${SECTION}`,
    '',
    `> Tester: \`${EMAIL}\` (${ROLE}) · tenant \`${TENANT}\` · ${new Date().toISOString().slice(0, 10)}`,
    `> Evidence: \`docs/e2e-ui-screenshots/confirm/sa-gap-menus/\` (**${counters.screenshots}** PNGs + FINDINGS.md)`,
    `> Depth: menus=${counters.menus} settingsSubs=${counters.settingsSubs} clicks=${counters.controlsClicked} maxDepth=${maxDepthReached}`,
    `> Scope: Recruitment · Performance · Assets · Announcements · Permissions · Settings`,
    '',
  ];

  const beLines = [...commonHead];
  if (!be.length) {
    beLines.push('_No NEW backend issues in this confirm gap-fill run._', '');
  } else {
    for (const iss of be) beLines.push(issueMd(iss));
  }

  const feLines = [...commonHead];
  if (!fe.length) {
    feLines.push('_No NEW frontend issues in this confirm gap-fill run._', '');
  } else {
    for (const iss of fe) feLines.push(issueMd(iss));
  }

  appendOnlyContract('E2E_BACKEND_ISSUES_CONTRACT.md', SECTION, beLines);
  appendOnlyContract('E2E_FRONTEND_ISSUES_CONTRACT.md', SECTION, feLines);

  // Consolidated confirm findings (overwrite this file only — not the main contracts)
  const gapDoc = [
    '# E2E_GAP_CONFIRM_FINDINGS',
    '',
    `> SUPER_ADMIN gap-menus confirm · ${new Date().toISOString()}`,
    `> Evidence: \`docs/e2e-ui-screenshots/confirm/sa-gap-menus/\``,
    '> **No Render. No git commit.**',
    '',
    ...findingsLines.slice(1), // skip duplicate H1 from FINDINGS
  ];
  fs.writeFileSync(path.join(DOCS, 'E2E_GAP_CONFIRM_FINDINGS.md'), gapDoc.join('\n'));
}

async function main() {
  logLine(`START ${SECTION} ${new Date().toISOString()}`);
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
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);
  const state = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    consoleAt: 0,
    pageAt: 0,
    seen: new Set(),
  };
  attachCollectors(page, state);

  try {
    await login(page, state);
    // Gap menus first, then Permissions, then Settings (+subs)
    for (const m of MENUS) {
      try {
        await exploreMenu(page, state, m);
        logLine(`✓ ${m.label} clicksLeft=${menuClickBudget} shots=${counters.screenshots}`);
      } catch (e) {
        logLine(`✗ ${m.label}: ${String(e).slice(0, 240)}`);
        const s = await shot(page, `${slug(m.label)}-crash`).catch(() => null);
        logF(m.label, 'explore', 'FAIL', { error: String(e).slice(0, 200), screenshot: s });
        addIssue({
          title: `Menu exploration crashed: ${m.label}`,
          where: `${m.label} / ${m.href}`,
          why: String(e).slice(0, 400),
          classification: 'FRONTEND',
          how: 'Stabilize page; re-run confirm gap shard',
          screenshot: s,
          network: 'n/a',
        });
        await hardDismiss(page).catch(() => {});
      }
    }
  } catch (e) {
    logLine(`FATAL ${e}`);
    await shot(page, 'fatal').catch(() => {});
    addIssue({
      title: `Shard fatal: ${String(e).slice(0, 120)}`,
      where: page.url(),
      why: String(e).slice(0, 300),
      classification: 'FRONTEND',
      how: 'Re-run shard; inspect fatal screenshot',
      screenshot: null,
      network: 'n/a',
    });
  }

  for (const d of downloads.filter((x) => !x.ok)) {
    addIssue({
      title: `Download failed: ${d.suggested || 'unknown'}`,
      where: d.pageUrl || 'n/a',
      why: `Download event failure: ${JSON.stringify(d.failure || {})}`,
      classification: 'FRONTEND',
      how: 'Ensure export triggers a real file download with Content-Disposition',
      screenshot: 'n/a',
      network: 'download event',
    });
  }

  const { be, fe, lines } = writeFindings();
  writeContracts(be, fe, lines);
  logLine(
    `DONE menus=${counters.menus} subs=${counters.settingsSubs} clicks=${counters.controlsClicked} shots=${counters.screenshots} be=${counters.be} fe=${counters.fe} both=${counters.both} depth=${maxDepthReached}`,
  );
  await browser.close().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
