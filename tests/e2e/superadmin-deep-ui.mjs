/**
 * SUPER_ADMIN FULL-DEPTH UI E2E — Playwright Chromium
 * Every sidebar parent → every clickable → nested modals/drawers/tabs/pages.
 * Screenshots → docs/e2e-ui-screenshots/superadmin-deep/
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://localhost:4000/api/v1';
const SHOT =
  process.env.SHOT_DIR ||
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/superadmin-deep';
const DOCS = '/Users/mohdsaeedafri/All-Code-Base/EMS/docs';
const EMAIL = 'superadmin@acme.test';
const PASS = 'Password123!';
const TENANT = 'acme-corp-001';
const ROLE = 'SUPER_ADMIN';

const MAX_DEPTH = 3;
const MAX_CONTROLS_PER_LAYER = 28;
const MAX_CANDIDATE_SCAN = 70;
const MAX_ROW_DETAILS = 2;
const MAX_MENU_ITEMS = 8;
const MAX_REPORT_ROUTES = 18;
const MAX_CLICKS_PER_MENU = 70;
const MENU_BUDGET_MS = 5 * 60 * 1000;
const RESUME = process.env.RESUME === '1';
const FRESH = process.env.FRESH === '1' || !RESUME;
const STATE_FILE = path.join(SHOT, '_progress.json');
const DATA_CELL_RE =
  /@|\.com\b|\.test\b|^\+?\d[\d\s-]{6,}$|^(male|female|other|active|inactive|full.?time|part.?time)$/i;
const PERSON_NAME_RE = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/;
const KEBAB_RE = /^actions for /i;

fs.mkdirSync(SHOT, { recursive: true });
if (FRESH && !RESUME) {
  for (const f of fs.readdirSync(SHOT)) {
    if (f.endsWith('.png') || ['FINDINGS.md', 'results.json', '_progress.json'].includes(f)) {
      try {
        fs.unlinkSync(path.join(SHOT, f));
      } catch {
        /* ignore */
      }
    }
  }
}

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
  'roles-permissions',
];

const EXTRA = {
  Payroll: ['/payroll/my-payslips', '/payroll/migration', '/payroll/global'],
  'Payout methods': ['/payout-methods/approvals'],
  Employees: ['/employees/new'],
};

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

let shotIdx = 0;
let maxDepthReached = 0;
let counters = {
  menus: 0,
  controlsClicked: 0,
  screenshots: 0,
  layersExplored: 0,
  exportsTried: 0,
  downloadsOk: 0,
  downloadsFail: 0,
  be: 0,
  fe: 0,
  both: 0,
};
let findings = [];
let issues = [];
let downloads = [];
let mutations = [];
let clickLog = [];
const seenIssue = new Set();
const globalVisited = new Set();
let doneMenus = new Set();
let menuClickBudget = MAX_CLICKS_PER_MENU;
let menuStartedAt = Date.now();

function loadProgress() {
  if (!RESUME || !fs.existsSync(STATE_FILE)) return;
  try {
    const p = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    findings = p.findings || [];
    issues = p.issues || [];
    downloads = p.downloads || [];
    mutations = p.mutations || [];
    clickLog = p.clickLog || [];
    counters = { ...counters, ...(p.counters || {}) };
    shotIdx = p.shotIdx || 0;
    maxDepthReached = p.maxDepthReached || 0;
    doneMenus = new Set(p.doneMenus || []);
    for (const iss of issues) {
      seenIssue.add(`${iss.classification}|${iss.title}|${(iss.network || '').slice(0, 120)}`);
      if (iss.id) {
        /* keep */
      }
    }
    console.log(`RESUME: doneMenus=${[...doneMenus].join(',') || '(none)'} shotIdx=${shotIdx}`);
  } catch (e) {
    console.log('RESUME load failed', e);
  }
}

function saveProgress() {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        shotIdx,
        maxDepthReached,
        counters,
        findings,
        issues,
        downloads,
        mutations,
        clickLog,
        doneMenus: [...doneMenus],
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}

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
  const id = `ISSUE-SA-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, role: ROLE, ...p };
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

function logLine(...args) {
  const line = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  console.log(line);
  try {
    fs.appendFileSync(path.join(SHOT, '_run.log'), line + '\n');
  } catch {
    /* ignore */
  }
}

function pageAlive(page) {
  return page && !page.isClosed();
}

async function settle(page, ms = 550) {
  if (!pageAlive(page)) return;
  await page.waitForLoadState('domcontentloaded', { timeout: 12000 }).catch(() => {});
  if (!pageAlive(page)) return;
  await page.waitForTimeout(ms).catch(() => {});
}

async function hardDismiss(page) {
  if (!pageAlive(page)) return;
  for (let i = 0; i < 4; i++) {
    if (!pageAlive(page)) return;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(70).catch(() => {});
  }
  if (!pageAlive(page)) return;
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
  if (!pageAlive(page)) return;
  const cancel = page
    .locator(
      '[role="dialog"] button:has-text("Cancel"), [role="alertdialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("Close")',
    )
    .first();
  if (await cancel.isVisible({ timeout: 150 }).catch(() => false)) {
    await cancel.click({ force: true, timeout: 800 }).catch(() => {});
  }
}

async function ensurePage(browserRef, contextRef, pageRef, state) {
  let page = pageRef.current;
  if (pageAlive(page)) return page;
  logLine('⚠ recreating browser/context/page after close');
  try {
    await contextRef.current?.close().catch(() => {});
  } catch {
    /* ignore */
  }
  let browser = browserRef.current;
  const browserDead = !browser || !browser.isConnected();
  if (browserDead) {
    try {
      await browser?.close().catch(() => {});
    } catch {
      /* ignore */
    }
    browser = await chromium.launch({ headless: true });
    browserRef.current = browser;
    logLine('⚠ relaunched Chromium');
  }
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
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);
  state.consoleErrors = [];
  state.pageErrors = [];
  state.failedRequests = [];
  state.consoleAt = 0;
  state.pageAt = 0;
  attachCollectors(page, state);
  contextRef.current = context;
  pageRef.current = page;
  await login(page, state);
  return page;
}

function attachCollectors(page, state) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|React DevTools|Download the React|hydration|Failed to load resource/i.test(text))
      return;
    state.consoleErrors.push({ text: text.slice(0, 280), url: page.url() });
  });
  page.on('pageerror', (err) => {
    state.pageErrors.push({ text: String(err?.message || err).slice(0, 280), url: page.url() });
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
      const ok = !!p && !dl.failure();
      downloads.push({
        suggested: dl.suggestedFilename(),
        ok,
        failure: dl.failure(),
        pageUrl: page.url(),
      });
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
    // Ignore expected login bootstrap
    if (/\/api\/auth\/(me|refresh)/.test(fr.url) && fr.status === 401 && menu === 'Login') continue;
    const cls = classify(fr.url, fr.status, fr.body);
    addIssue({
      title: `${menu}: ${fr.status} ${fr.method} …/${fr.url.split('/').slice(-2).join('/')}`,
      where: `${menu} / ${fr.pageUrl} / ${actionLabel || 'page'}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${(fr.body || '').slice(0, 240)}`,
      classification: cls,
      how:
        /NO_EMPLOYEE_RECORD/.test(fr.body || '')
          ? 'BE: admin-safe empty payload when user has no employeeId; FE: hide employee-scoped widgets for SUPER_ADMIN without employee record'
          : cls === 'BACKEND'
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
  if (!strong && /access restricted/i.test(text) && menu.toLowerCase().includes('permission')) {
    // Permissions page Access Restricted for non-SA would be FE; SA should NOT see it
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
    await el.scrollIntoViewIfNeeded({ timeout: 1200 });
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

async function gotoMenu(page, href) {
  if (!pageAlive(page)) throw new Error('page closed before goto');
  await hardDismiss(page);
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 800);
  await hardDismiss(page);
}

async function fillDialogLight(dlg) {
  const inputs = dlg.locator(
    'input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea:visible',
  );
  const ic = Math.min(await inputs.count(), 8);
  for (let j = 0; j < ic; j++) {
    const inp = inputs.nth(j);
    const t = (await inp.getAttribute('type')) || 'text';
    const name = `${(await inp.getAttribute('name')) || ''}${(await inp.getAttribute('id')) || ''}${(await inp.getAttribute('placeholder')) || ''}`;
    const disabled = await inp.isDisabled().catch(() => true);
    if (disabled) continue;
    if (t === 'email' || /email/i.test(name)) await inp.fill('e2e.superadmin@acme.test').catch(() => {});
    else if (t === 'number' || /salary|amount|phone/i.test(name)) await inp.fill('1').catch(() => {});
    else if (t === 'date' || /date/i.test(name)) await inp.fill('2026-08-15').catch(() => {});
    else if (t === 'tel') await inp.fill('9999999999').catch(() => {});
    else await inp.fill('E2E SA Test').catch(() => {});
  }
  // try first select/combobox inside dialog
  const combo = dlg.locator('button[role="combobox"], [role="combobox"]').first();
  if (await combo.isVisible({ timeout: 200 }).catch(() => false)) {
    await combo.click({ force: true }).catch(() => {});
    await dlg.page().waitForTimeout(250);
    const opt = dlg.page().locator('[role="option"]:visible').first();
    if (await opt.isVisible({ timeout: 400 }).catch(() => false)) {
      await opt.click({ force: true }).catch(() => {});
    } else {
      await dlg.page().keyboard.press('Escape').catch(() => {});
    }
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
    if (await loc.isVisible({ timeout: 200 }).catch(() => false)) {
      layer = loc;
      break;
    }
  }
  const scope = layer || page.locator('main, [role="main"]').first();
  const scopeKey = layer ? 'dialog' : 'main';
  const urlPath = new URL(page.url()).pathname;
  const onDetailPage = /\/employees\/[^/]+|\/payroll\/[^/]+|\/recruitment\/[^/]+/.test(urlPath);

  // Tabs inside layer
  const tabs = scope.locator('[role="tab"]');
  const tc = Math.min(await tabs.count().catch(() => 0), 12);
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
    await settle(page, 400);
    const ss = await shot(page, `${menu}-d${depth}-tab-${lab}`);
    logF(menu, `d${depth}/tab:${lab}`, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, `tab:${lab}`);
    await checkVisibleErrors(page, menu, `tab ${lab}`, ss);
  }

  // Enumerate clickables — prefer toolbar/header buttons over table cells
  const candidates = scope.locator(
    [
      'button:visible',
      'a[href]:visible',
      '[role="button"]:visible',
      '[role="menuitem"]:visible',
      '[role="combobox"]:visible',
    ].join(', '),
  );
  const rawCount = await candidates.count().catch(() => 0);
  const count = Math.min(rawCount, MAX_CANDIDATE_SCAN);
  const metas = [];
  const layerCap = depth > 0 || onDetailPage ? Math.min(MAX_CONTROLS_PER_LAYER, 16) : MAX_CONTROLS_PER_LAYER;
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab) || lab === 'control') continue;
    if (DATA_CELL_RE.test(lab.trim())) continue;
    const href = (await el.getAttribute('href').catch(() => '')) || '';
    const tag = await el.evaluate((n) => n.tagName.toLowerCase()).catch(() => '');
    if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (href && MENUS.some((m) => m.href === href) && scopeKey === 'main') continue;
    if (
      href &&
      href.startsWith('/settings/') &&
      !menu.startsWith('Settings') &&
      menu !== 'Settings'
    )
      continue;

    const isKebab = KEBAB_RE.test(lab);
    const isPersonRow =
      PERSON_NAME_RE.test(lab.trim()) &&
      (tag === 'a' || /\/employees\//.test(href));
    const isRow = isKebab || isPersonRow;
    const isApprove = /^(approve|deny|reject)$/i.test(lab.trim());
    const isExport = /export|download|\bpdf\b|\bexcel\b|\bcsv\b|\bxlsx\b/i.test(lab);
    const isPrimary =
      /^(add|create|new|edit|save|cancel|close|filter|search|columns|import|upload|refresh|submit|apply|next|previous|prev|back|view|open|manage|configure|run|generate|invite|assign|check in|check out|request|schedule|compute|lock|unlock|publish|verify|test|export|approve|deny|reject|7d|30d|90d|templates|team|calendar|list|table|overview|job|compensation|documents|terminate|regulariz)/i.test(
        lab,
      ) || isApprove || isExport || isKebab;

    // On detail pages skip person-name / data-looking anchors
    if (onDetailPage && isPersonRow) continue;
    // Depth>0: only primary/export/approve/dialog controls (avoid table thrash)
    if (depth > 0 && !isPrimary && !layer) continue;

    metas.push({ i, lab, href, tag, isRow, isKebab, isApprove, isExport, isPrimary });
  }

  metas.sort(
    (a, b) =>
      Number(b.isApprove) - Number(a.isApprove) ||
      Number(b.isExport) - Number(a.isExport) ||
      Number(b.isPrimary) - Number(a.isPrimary) ||
      Number(a.isRow) - Number(b.isRow),
  );

  let clickedHere = 0;
  let rowClicks = 0;
  let detailNavs = 0;
  for (const m of metas) {
    if (!menuBudgetOk() || clickedHere >= layerCap) break;
    if (m.isRow) {
      if (rowClicks >= MAX_ROW_DETAILS) continue;
      rowClicks += 1;
    }
    if (DESTRUCTIVE_RE.test(m.lab.trim()) && depth === 0 && !/terminate/i.test(m.lab)) {
      logF(menu, m.lab, 'SKIP', { note: 'destructive skipped' });
      continue;
    }
    // Open terminate once as modal probe then Cancel
    const isTerminate = /terminate/i.test(m.lab);

    const vkey = `${urlPath}|d${depth}|${slug(m.lab)}|${m.href.split('?')[0]}`;
    if (globalVisited.has(vkey)) continue;
    globalVisited.add(vkey);

    let el = scope
      .locator('button, a[href], [role="button"], [role="menuitem"], [role="combobox"]', {
        hasText: new RegExp(`^\\s*${m.lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
      })
      .first();
    if (!(await el.isVisible({ timeout: 200 }).catch(() => false))) {
      el = candidates.nth(m.i);
    }
    if (!(await el.isVisible().catch(() => false))) continue;

    const before = state.failedRequests.length;
    const beforeUrl = page.url();
    const ok = await safeClick(el);
    if (!ok) {
      logF(menu, m.lab, 'SKIP', { note: 'click failed' });
      continue;
    }
    consumeClick();
    clickedHere += 1;
    clickLog.push({ menu, depth, action: m.lab, url: page.url() });
    await settle(page, 550);

    const ss = await shot(page, `${menu}-d${depth}-${m.lab}`);
    logF(menu, `d${depth}/${m.lab}`, 'PASS', { screenshot: ss, url: page.url() });

    if (m.isApprove) {
      const confirm = page
        .locator(
          '[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="alertdialog"] button:has-text("Confirm"), [role="alertdialog"] button:has-text("Yes")',
        )
        .first();
      if (await confirm.isVisible({ timeout: 600 }).catch(() => false)) {
        await confirm.click({ force: true }).catch(() => {});
        await settle(page, 700);
        const sc = await shot(page, `${menu}-d${depth}-${m.lab}-confirmed`);
        mutations.push({ menu, action: m.lab, confirmed: true, screenshot: sc });
      } else {
        mutations.push({ menu, action: m.lab, confirmed: false, screenshot: ss });
      }
    }

    const menuItems = page.locator(
      '[role="menu"] [role="menuitem"]:visible, [data-radix-menu-content] [role="menuitem"]:visible',
    );
    const mic = Math.min(await menuItems.count().catch(() => 0), MAX_MENU_ITEMS);
    if (mic > 0 && (m.isExport || m.isKebab || /columns|filter|more|actions|export/i.test(m.lab))) {
      for (let si = 0; si < mic; si++) {
        if (!menuBudgetOk()) break;
        const item = menuItems.nth(si);
        const slab = await labelOf(item);
        if (SKIP_RE.test(slab) || DESTRUCTIVE_RE.test(slab.trim())) continue;
        const b2 = state.failedRequests.length;
        const d2 = downloads.length;
        await item.click({ force: true, timeout: 2000 }).catch(() => {});
        consumeClick();
        if (/pdf|excel|csv|xlsx|export|download/i.test(slab)) counters.exportsTried += 1;
        await settle(page, 900);
        const sss = await shot(page, `${menu}-d${depth}-menu-${slab}`);
        const newDl = downloads.slice(d2);
        const fails = state.failedRequests.slice(b2);
        logF(menu, `menu:${slab}`, fails.length ? 'FAIL' : 'PASS', {
          screenshot: sss,
          downloads: newDl,
        });
        if (fails.length) {
          const fr = fails[0];
          addIssue({
            title: `Menu/export: ${slab}`,
            where: `${menu} / ${beforeUrl} / ${m.lab} → ${slab}`,
            why: `${fr.method} ${fr.url} → ${fr.status}: ${(fr.body || '').slice(0, 200)}`,
            classification: classify(fr.url, fr.status, fr.body),
            how: 'Ensure export/action API returns success and FE handles response',
            screenshot: sss,
            network: `${fr.method} ${fr.url} ${fr.status}`,
          });
        }
        const nestedDlg = page.locator('[role="dialog"], [role="alertdialog"]').last();
        if (await nestedDlg.isVisible({ timeout: 250 }).catch(() => false)) {
          if (/add|create|new|edit|view|invite/i.test(slab)) {
            await fillDialogLight(nestedDlg);
            await shot(page, `${menu}-d${depth}-menu-filled-${slab}`);
          }
          await exploreOpenLayer(page, state, menu, depth + 1, homeHref);
          await hardDismiss(page);
        } else if (/view profile|open|edit/i.test(slab) && page.url() !== beforeUrl && detailNavs < 1) {
          detailNavs += 1;
          await exploreOpenLayer(page, state, `${menu}>detail`, depth + 1, homeHref);
          await gotoMenu(page, homeHref);
        }
      }
      await hardDismiss(page);
    }

    harvest(state, menu, ss, before, m.lab);
    await checkVisibleErrors(page, menu, m.lab, ss);

    const dlg = page.locator('[role="dialog"], [role="alertdialog"], [data-radix-dialog-content]').last();
    if (await dlg.isVisible({ timeout: 300 }).catch(() => false)) {
      if ((/add|create|new|edit|invite|request|regulariz/i.test(m.lab) || isTerminate) && !m.isApprove) {
        await fillDialogLight(dlg);
        await shot(page, `${menu}-d${depth}-filled-${m.lab}`);
      }
      await exploreOpenLayer(page, state, menu, depth + 1, homeHref);
      if (!m.isApprove) {
        const cancel = dlg
          .locator('button:has-text("Cancel"), button:has-text("Close"), button:has-text("Dismiss")')
          .first();
        if (await cancel.isVisible({ timeout: 300 }).catch(() => false)) {
          await cancel.click({ force: true }).catch(() => {});
          consumeClick();
        } else {
          await hardDismiss(page);
        }
      }
    }

    // One detail-page dive max from list (avoid row explosion)
    const afterUrl = page.url();
    if (afterUrl !== beforeUrl && homeHref && detailNavs < 1 && depth === 0) {
      const homeBase = homeHref.replace(/\/$/, '');
      const leftHome = !afterUrl.includes(homeBase);
      const deeperHome =
        afterUrl.includes(homeBase) &&
        new URL(afterUrl).pathname.replace(/\/$/, '') !== homeBase;
      if ((leftHome || deeperHome) && !/\/login/.test(afterUrl)) {
        detailNavs += 1;
        await exploreOpenLayer(page, state, `${menu}>detail`, depth + 1, homeHref);
        await gotoMenu(page, homeHref);
      }
    }

    await hardDismiss(page);
  }

  const search = scope.locator('input[type="search"], input[placeholder*="Search" i]').first();
  if (menuBudgetOk() && (await search.isVisible({ timeout: 200 }).catch(() => false))) {
    const vkey = `${urlPath}|d${depth}|search`;
    if (!globalVisited.has(vkey)) {
      globalVisited.add(vkey);
      const before = state.failedRequests.length;
      await search.fill('a').catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
      consumeClick();
      await settle(page, 400);
      const ss = await shot(page, `${menu}-d${depth}-search`);
      harvest(state, menu, ss, before, 'search');
      await search.fill('').catch(() => {});
    }
  }

  const next = scope.getByRole('button', { name: /next/i }).first();
  if (
    menuBudgetOk() &&
    (await next.isVisible().catch(() => false)) &&
    !(await next.isDisabled().catch(() => true))
  ) {
    const vkey = `${urlPath}|d${depth}|next`;
    if (!globalVisited.has(vkey)) {
      globalVisited.add(vkey);
      const before = state.failedRequests.length;
      await next.click().catch(() => {});
      consumeClick();
      await settle(page, 400);
      const ss = await shot(page, `${menu}-d${depth}-page-next`);
      harvest(state, menu, ss, before, 'pagination');
      const prev = scope.getByRole('button', { name: /prev|previous/i }).first();
      if (await prev.isVisible().catch(() => false)) await prev.click().catch(() => {});
    }
  }
}

async function login(page, state) {
  const before = state.failedRequests.length;
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 800);
  await page.evaluate((t) => {
    try {
      localStorage.setItem('tenantKey', t);
      localStorage.setItem('x-tenant-key', t);
    } catch {
      /* ignore */
    }
  }, TENANT);
  await shot(page, 'login-form');
  await page.waitForSelector('#email', { state: 'visible', timeout: 15000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASS);
  await page.evaluate(() => {
    for (const id of ['email', 'password']) {
      const el = document.querySelector('#' + id);
      if (!el) continue;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/otp/, { timeout: 60000 }).catch(() => {});
  await settle(page, 2000);
  if (!pageAlive(page)) throw new Error('Login page closed unexpectedly');
  let ss = await shot(page, 'login-success');
  let ok = page.url().includes('/dashboard');
  if (!ok) {
    // one retry
    logLine('login retry…');
    await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await settle(page, 600);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 60000 }).catch(() => {});
    await settle(page, 2000);
    ss = await shot(page, 'login-success-retry');
    ok = page.url().includes('/dashboard');
  }
  logF('Login', 'login', ok ? 'PASS' : 'FAIL', { screenshot: ss, url: page.url() });
  logLine(`login url=${page.url()} ok=${ok}`);
  harvest(state, 'Login', ss, before, 'login');
  if (!ok) {
    addIssue({
      title: 'Login did not reach dashboard',
      where: `Login / ${page.url()}`,
      why: 'Post-login URL unexpected',
      classification: 'BOTH',
      how: 'Check auth BFF + redirect for SUPER_ADMIN',
      screenshot: ss,
      network: 'POST /auth/login',
    });
    throw new Error('Login failed');
  }
  // Bootstrap 401s on /login are expected anonymous probes — record once as low-noise note only
  const boot = state.failedRequests.filter(
    (x) => x.status === 401 && /auth\/(me|refresh)/.test(x.url),
  );
  if (boot.length) {
    addIssue({
      title: 'Login bootstrap 401s (me/refresh)',
      where: 'Login /login',
      why: `Anonymous ${boot.map((b) => `${b.method} ${b.url.split('?')[0]}`).join(', ')} → 401 before credentials`,
      classification: 'FRONTEND',
      how: 'Skip me/refresh probes on public auth routes (cosmetic)',
      screenshot: ss,
      network: `${boot[0].method} ${boot[0].url} ${boot[0].status}`,
    });
  }
}

async function exploreDashboardDeep(page, state) {
  if (doneMenus.has('Dashboard')) {
    logLine('↩ skip Dashboard (already done)');
    return;
  }
  counters.menus += 1;
  resetMenuBudget();
  logLine('→ Dashboard (deep)');
  await gotoMenu(page, '/dashboard');
  let before = state.failedRequests.length;
  let ss = await shot(page, 'dashboard-land');
  logF('Dashboard', 'open', 'PASS', { screenshot: ss });
  harvest(state, 'Dashboard', ss, before, 'open');

  // Range toggles
  for (const label of ['7d', '30d', '90d']) {
    const btn = page.locator(`main button:has-text("${label}")`).first();
    if (!(await btn.isVisible({ timeout: 400 }).catch(() => false))) continue;
    before = state.failedRequests.length;
    await safeClick(btn);
    consumeClick();
    await settle(page, 500);
    ss = await shot(page, `dashboard-${label}`);
    harvest(state, 'Dashboard', ss, before, label);
  }

  // Add Employee FULL flow (fill → validate → Cancel; no junk submit)
  const add = page
    .locator('main a:has-text("Add Employee"), main button:has-text("Add Employee"), main a[href="/employees/new"]')
    .first();
  if (await add.isVisible({ timeout: 1500 }).catch(() => false)) {
    before = state.failedRequests.length;
    await safeClick(add);
    consumeClick();
    await settle(page, 900);
    ss = await shot(page, 'dashboard-add-employee-open');
    harvest(state, 'Dashboard', ss, before, 'Add Employee');

    // Wizard / form steps
    const formRoot = page.locator('[role="dialog"], main form, main').first();
    await fillDialogLight(formRoot);
    await shot(page, 'dashboard-add-employee-filled');

    // Next steps if wizard
    for (let step = 0; step < 4; step++) {
      const next = page.getByRole('button', { name: /^(next|continue)$/i }).first();
      if (!(await next.isVisible({ timeout: 300 }).catch(() => false))) break;
      await next.click({ force: true }).catch(() => {});
      consumeClick();
      await settle(page, 500);
      await shot(page, `dashboard-add-employee-step-${step + 1}`);
      await fillDialogLight(page.locator('[role="dialog"], main').first());
    }

    // Document upload control presence
    const file = page.locator('input[type="file"]').first();
    if (await file.count().catch(() => 0)) {
      await shot(page, 'dashboard-add-employee-file-input');
      logF('Dashboard', 'file-input-present', 'PASS');
    }

    // Cancel rather than create junk (documented), then force home
    const cancel = page.getByRole('button', { name: /^(cancel|close)$/i }).first();
    if (await cancel.isVisible({ timeout: 500 }).catch(() => false)) {
      await cancel.click({ force: true }).catch(() => {});
      consumeClick();
      mutations.push({
        menu: 'Dashboard',
        action: 'Add Employee filled then Cancel (no create)',
        confirmed: false,
      });
    } else {
      mutations.push({
        menu: 'Dashboard',
        action: 'Add Employee opened; returned via nav (no create)',
        confirmed: false,
      });
    }
    await gotoMenu(page, '/dashboard');
    await settle(page, 400);
    await shot(page, 'dashboard-after-add-cancel');
  } else {
    logF('Dashboard', 'Add Employee', 'MISS');
  }

  // Approve AND Deny on pending items
  for (const label of ['Approve', 'Deny', 'Reject']) {
    await hardDismiss(page);
    const btn = page.locator(`main button:has-text("${label}")`).first();
    if (!(await btn.isVisible({ timeout: 500 }).catch(() => false))) {
      logF('Dashboard', label, 'MISS');
      continue;
    }
    before = state.failedRequests.length;
    await safeClick(btn);
    consumeClick();
    await settle(page, 500);
    const confirm = page
      .locator(
        '[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="alertdialog"] button:has-text("Confirm")',
      )
      .first();
    if (await confirm.isVisible({ timeout: 600 }).catch(() => false)) {
      await confirm.click({ force: true }).catch(() => {});
      await settle(page, 700);
      mutations.push({ menu: 'Dashboard', action: `${label} confirmed`, confirmed: true });
    } else {
      mutations.push({ menu: 'Dashboard', action: `${label} clicked`, confirmed: false });
    }
    ss = await shot(page, `dashboard-${label.toLowerCase()}`);
    harvest(state, 'Dashboard', ss, before, label);
  }

  await exploreOpenLayer(page, state, 'Dashboard', 0, '/dashboard');
  doneMenus.add('Dashboard');
  saveProgress();
  writeOutputs();
}

async function exploreReportsDeep(page, state) {
  if (doneMenus.has('Reports')) {
    logLine('↩ skip Reports (already done)');
    return;
  }
  counters.menus += 1;
  resetMenuBudget();
  logLine('→ Reports (deep)');
  await gotoMenu(page, '/reports');
  let before = state.failedRequests.length;
  let ss = await shot(page, 'reports-land');
  harvest(state, 'Reports', ss, before, 'open');
  await exploreOpenLayer(page, state, 'Reports', 0, '/reports');

  const links = page.locator('a[href^="/reports/"]');
  const hrefs = [];
  const n = await links.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const h = await links.nth(i).getAttribute('href');
    if (h && !hrefs.includes(h)) hrefs.push(h);
  }
  for (const h of hrefs.slice(0, MAX_REPORT_ROUTES)) {
    logLine(`  report ${h}`);
    resetMenuBudget();
    await gotoMenu(page, h);
    before = state.failedRequests.length;
    ss = await shot(page, `reports-${slug(h)}`);
    harvest(state, `Reports${h}`, ss, before, 'open');
    await exploreOpenLayer(page, state, `Reports${h}`, 0, h);
  }
  doneMenus.add('Reports');
  saveProgress();
  writeOutputs();
}

async function exploreMenuDeep(page, menu, state) {
  if (doneMenus.has(menu.label)) {
    logLine(`↩ skip ${menu.label} (already done)`);
    return;
  }
  counters.menus += 1;
  resetMenuBudget();
  logLine(`→ ${menu.label}`);
  await gotoMenu(page, menu.href);

  // Sidebar click evidence
  const nav = page.locator(`nav[aria-label="Main navigation"] a[aria-label="${menu.label}"]`).first();
  if (await nav.isVisible({ timeout: 600 }).catch(() => false)) {
    await nav.click({ force: true, timeout: 3000 }).catch(() => {});
    await settle(page, 500);
  }

  const before = state.failedRequests.length;
  const ss = await shot(page, `${slug(menu.label)}-land`);
  logF(menu.label, 'open', 'PASS', { screenshot: ss, url: page.url() });
  harvest(state, menu.label, ss, before, 'open');
  await checkVisibleErrors(page, menu.label, 'land', ss);

  await exploreOpenLayer(page, state, menu.label, 0, menu.href);

  if (menu.label === 'Settings') {
    for (const sub of SETTINGS_SUB) {
      const href = `/settings/${sub}`;
      logLine(`  settings/${sub}`);
      resetMenuBudget();
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
        continue;
      }
      const b = state.failedRequests.length;
      const sSub = await shot(page, `settings-${slug(sub)}-land`);
      logF('Settings', `sub:${sub}`, 'PASS', { screenshot: sSub });
      harvest(state, `Settings/${sub}`, sSub, b, 'open');
      await exploreOpenLayer(page, state, `Settings/${sub}`, 0, href);
    }
  }

  for (const extra of EXTRA[menu.label] || []) {
    logLine(`  extra ${extra}`);
    resetMenuBudget();
    await gotoMenu(page, extra);
    const b = state.failedRequests.length;
    const se = await shot(page, slug(extra));
    harvest(state, `${menu.label}${extra}`, se, b, 'open');
    await exploreOpenLayer(page, state, `${menu.label}${extra}`, 0, extra);
  }
  doneMenus.add(menu.label);
  saveProgress();
  writeOutputs();
}

async function shellExtras(page, state) {
  logLine('→ Shell extras');
  resetMenuBudget();
  await gotoMenu(page, '/dashboard');
  const bell = page.locator('button[aria-label*="Notification" i]').first();
  if (await bell.isVisible().catch(() => false)) {
    const before = state.failedRequests.length;
    await bell.click().catch(() => {});
    consumeClick();
    await settle(page, 500);
    const ss = await shot(page, 'shell-notifications');
    harvest(state, 'Shell', ss, before, 'notifications');
    // mark read if present
    const mark = page.getByRole('button', { name: /mark.*read|mark all/i }).first();
    if (await mark.isVisible({ timeout: 400 }).catch(() => false)) {
      await mark.click().catch(() => {});
      consumeClick();
      mutations.push({ menu: 'Shell', action: 'mark notifications read', confirmed: true });
      await settle(page, 400);
      await shot(page, 'shell-notifications-marked');
    }
    await hardDismiss(page);
  }
  const profile = page.locator('button[aria-label*="profile" i], button[aria-label*="account" i], button[aria-label*="user" i]').first();
  if (await profile.isVisible({ timeout: 400 }).catch(() => false)) {
    await profile.click().catch(() => {});
    consumeClick();
    await settle(page, 300);
    await shot(page, 'shell-profile-menu');
    // open Profile / Settings links if present (not Sign out)
    for (const name of ['Profile', 'Settings', 'My profile']) {
      const item = page.getByRole('menuitem', { name: new RegExp(name, 'i') }).first();
      if (!(await item.isVisible({ timeout: 200 }).catch(() => false))) continue;
      await item.click().catch(() => {});
      consumeClick();
      await settle(page, 700);
      await shot(page, `shell-${slug(name)}`);
      await exploreOpenLayer(page, state, `Shell/${name}`, 0, new URL(page.url()).pathname);
      break;
    }
    await hardDismiss(page);
  }
}

function writeOutputs() {
  const lines = [];
  lines.push('# SUPER_ADMIN Full-Depth UI E2E Findings');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Role: \`${ROLE}\` (\`${EMAIL}\` / tenant \`${TENANT}\`)`);
  lines.push(`> UI: \`${FE}\` · API: \`${API}\` (Hostinger tunnel via local BE)`);
  lines.push('> Tool: Playwright Chromium · recursive layer crawl');
  lines.push(`> Screenshots: \`docs/e2e-ui-screenshots/superadmin-deep/\``);
  lines.push('> **No Render. No git commit.**');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  lines.push(`| Menus tested | **${counters.menus}** |`);
  lines.push(`| Controls clicked | **${counters.controlsClicked}** |`);
  lines.push(`| Max depth reached | **${maxDepthReached}** |`);
  lines.push(`| Layers explored | **${counters.layersExplored}** |`);
  lines.push(`| Screenshots | **${counters.screenshots}** |`);
  lines.push(`| Exports tried | **${counters.exportsTried}** |`);
  lines.push(`| Downloads OK / fail | **${counters.downloadsOk}** / **${counters.downloadsFail}** |`);
  lines.push(`| Issues BACKEND | **${counters.be}** |`);
  lines.push(`| Issues FRONTEND | **${counters.fe}** |`);
  lines.push(`| Issues BOTH | **${counters.both}** |`);
  lines.push(`| Mutations | **${mutations.length}** |`);
  lines.push('');
  lines.push('## Top bugs');
  lines.push('');
  const top = [...issues].slice(0, 12);
  if (!top.length) lines.push('_None recorded._');
  top.forEach((iss, i) => {
    lines.push(
      `${i + 1}. **${iss.title}** (${iss.classification}) — ${iss.why.slice(0, 180)} — \`${iss.screenshot || 'n/a'}\``,
    );
  });
  lines.push('');
  lines.push('## Mutations');
  lines.push('');
  if (!mutations.length) lines.push('_None_');
  for (const m of mutations) {
    lines.push(`- ${m.menu}: ${m.action}${m.confirmed ? ' (confirmed)' : ''} ${m.screenshot ? `— \`${m.screenshot}\`` : ''}`);
  }
  lines.push('');
  lines.push('## Issues (full)');
  lines.push('');
  if (!issues.length) lines.push('_None_');
  for (const iss of issues) {
    lines.push(`### ${iss.id}: ${iss.title}`);
    lines.push(`- Where: ${iss.where}`);
    lines.push(`- Why: ${iss.why}`);
    lines.push(`- Classification: **${iss.classification}**`);
    lines.push(`- How to resolve: ${iss.how}`);
    lines.push(`- Screenshot: \`${iss.screenshot || 'n/a'}\``);
    lines.push(`- Network: \`${iss.network || 'n/a'}\``);
    if (iss.expected) lines.push(`- Expected: ${iss.expected}`);
    if (iss.actual) lines.push(`- Actual: ${iss.actual}`);
    lines.push('');
  }
  lines.push('## Click log (truncated)');
  lines.push('');
  for (const c of clickLog.slice(0, 400)) {
    lines.push(`- d${c.depth} ${c.menu} → ${c.action}`);
  }
  if (clickLog.length > 400) lines.push(`- … +${clickLog.length - 400} more`);
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
        counters,
        maxDepthReached,
        issues,
        mutations,
        downloads,
        clickLog,
        findings,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

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
      : `# E2E Issues Contract\n\n`;
    existing = existing.replace(/\n## SUPER_ADMIN[\s\S]*?(?=\n## [A-Z_]|\s*$)/, '\n');
    const sec = [
      '',
      '## SUPER_ADMIN',
      '',
      `> Updated ${new Date().toISOString()} — full-depth UI E2E vs ${FE} / ${API}`,
      `> Controls clicked: ${counters.controlsClicked} · Max depth: ${maxDepthReached} · Shots: ${counters.screenshots}`,
      `> Evidence: \`docs/e2e-ui-screenshots/superadmin-deep/FINDINGS.md\``,
      '',
    ];
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
  // Yield to exclusive v3 runner in superadmin-deep if active
  const lock = path.join(SHOT, '_OWNER.lock');
  const pidf = path.join(SHOT, '_runner.pid');
  if (fs.existsSync(pidf)) {
    const other = parseInt(fs.readFileSync(pidf, 'utf8').trim(), 10);
    if (other && other !== process.pid) {
      try {
        process.kill(other, 0);
        console.error(`ABORT deep-ui: exclusive runner pid=${other} holds ${pidf}`);
        process.exit(2);
      } catch {
        /* stale */
      }
    }
  }
  if (fs.existsSync(lock) && /sa-deep-v3/.test(fs.readFileSync(lock, 'utf8'))) {
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    if (age < 45 * 60 * 1000) {
      console.error('ABORT deep-ui: sa-deep-v3 lock active — use _deep_e2e_sa.mjs');
      process.exit(2);
    }
  }

  loadProgress();
  try {
    if (!RESUME) fs.writeFileSync(path.join(SHOT, '_run.log'), `start ${new Date().toISOString()}\n`);
    else fs.appendFileSync(path.join(SHOT, '_run.log'), `resume ${new Date().toISOString()}\n`);
  } catch {
    /* ignore */
  }
  logLine(`=== SUPER_ADMIN DEEP FRESH=${FRESH} RESUME=${RESUME} ===`);

  const browserRef = { current: await chromium.launch({ headless: true }) };
  const contextRef = { current: null };
  const pageRef = { current: null };
  contextRef.current = await browserRef.current.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  await contextRef.current.addInitScript((t) => {
    try {
      localStorage.setItem('tenantKey', t);
      localStorage.setItem('x-tenant-key', t);
    } catch {
      /* ignore */
    }
  }, TENANT);

  pageRef.current = await contextRef.current.newPage();
  pageRef.current.setDefaultTimeout(12000);
  pageRef.current.setDefaultNavigationTimeout(40000);
  const state = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    seen: new Set(),
    consoleAt: 0,
    pageAt: 0,
  };
  attachCollectors(pageRef.current, state);

  logLine('=== LOGIN ===');
  await login(pageRef.current, state);

  const navLabels = await pageRef.current
    .evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Main navigation"]');
      if (!nav) return [];
      return [...nav.querySelectorAll('a')].map((a) =>
        (a.getAttribute('aria-label') || a.textContent || '').trim(),
      );
    })
    .catch(() => []);
  logLine('SIDEBAR: ' + navLabels.join(' | '));
  if (!RESUME || shotIdx < 3) await shot(pageRef.current, 'shell-sidebar');

  await exploreDashboardDeep(pageRef.current, state);

  for (const menu of MENUS.filter((m) => m.label !== 'Dashboard')) {
    try {
      const page = await ensurePage(browserRef, contextRef, pageRef, state);
      if (menu.label === 'Reports') await exploreReportsDeep(page, state);
      else await exploreMenuDeep(page, menu, state);
      logLine(`✓ done ${menu.label} clicksLeft=${menuClickBudget} shots=${counters.screenshots}`);
    } catch (e) {
      logLine(`✗ crash ${menu.label}: ${String(e).slice(0, 240)}`);
      let ss = null;
      try {
        if (pageAlive(pageRef.current)) ss = await shot(pageRef.current, `${slug(menu.label)}-crash`);
      } catch {
        /* ignore */
      }
      logF(menu.label, 'explore', 'FAIL', { error: String(e), screenshot: ss });
      addIssue({
        title: `Menu exploration crashed: ${menu.label}`,
        where: `${menu.label} / ${menu.href}`,
        why: String(e).slice(0, 400),
        classification: 'FRONTEND',
        how: 'Stabilize page rendering / fix crash; menu NOT marked done (retry on RESUME)',
        screenshot: ss,
        network: 'n/a',
      });
      saveProgress();
      writeOutputs();
      await hardDismiss(pageRef.current).catch(() => {});
      try {
        await ensurePage(browserRef, contextRef, pageRef, state);
      } catch (re) {
        logLine(`relogin failed: ${String(re).slice(0, 200)}`);
      }
    }
  }

  try {
    const page = await ensurePage(browserRef, contextRef, pageRef, state);
    await shellExtras(page, state);
  } catch (e) {
    logLine('shell extras error ' + String(e).slice(0, 200));
  }

  // Export download failures → issues
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

  writeOutputs();
  saveProgress();
  logLine(
    JSON.stringify(
      {
        counters,
        maxDepthReached,
        issues: issues.length,
        shots: counters.screenshots,
        clicks: counters.controlsClicked,
        doneMenus: [...doneMenus],
      },
      null,
      2,
    ),
  );
  await browserRef.current?.close().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  try {
    logLine('FATAL ' + String(e));
    writeOutputs();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
