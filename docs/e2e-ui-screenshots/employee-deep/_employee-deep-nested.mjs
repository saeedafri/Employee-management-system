/**
 * FULL-DEPTH nested EMPLOYEE UI E2E — Playwright
 * Login: priya@acme.test / Password123!
 * FE :3001 → BE :4000
 * Screenshots → docs/e2e-ui-screenshots/employee-deep/
 *
 * Depth goals:
 * - every sidebar nav item (sidebar click + hard goto)
 * - every role=tab + nested buttons/dialogs on each land
 * - attendance check-in/out + regularization form fields
 * - leave: all leave types fill+submit; withdraw if PENDING
 * - timesheet: Log time dialog fields, templates, week nav
 * - holidays full UI
 * - payroll self: every tab, payslip View/Download
 * - notifications: open, click item, mark-all-read
 * - profile menu + self settings routes
 * - admin nav items: open shell + verify Access restricted
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const SHOT =
  process.env.SHOT_DIR ||
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/employee-deep';
const USER = process.env.QA_EMAIL || 'priya@acme.test';
const PASS = process.env.QA_PASS || 'Password123!';

fs.mkdirSync(SHOT, { recursive: true });
for (const f of fs.readdirSync(SHOT)) {
  if (f.endsWith('.png') || f === 'results.json' || f === 'nav-items.json' || f === 'depth-stats.json') {
    fs.unlinkSync(path.join(SHOT, f));
  }
}

const ERR_PATTERNS = [
  /something went wrong/i,
  /unexpected error/i,
  /failed to load/i,
  /failed to fetch/i,
  /internal server error/i,
  /error boundary/i,
  /application error/i,
  /access restricted/i,
  /not authorized/i,
  /you don.?t have permission/i,
  /forbidden/i,
  /404 page not found/i,
  /no leave balance/i,
];

const MENUS = [
  { label: 'Dashboard', href: '/dashboard', deep: 'dashboard' },
  { label: 'Employees', href: '/employees', deep: 'employees' },
  { label: 'Departments', href: '/departments', deep: 'departments' },
  { label: 'Attendance', href: '/attendance', deep: 'attendance' },
  { label: 'Timesheets', href: '/timesheets', deep: 'timesheets' },
  { label: 'Leave', href: '/leave', deep: 'leave' },
  { label: 'Holidays', href: '/holidays', deep: 'holidays' },
  { label: 'Payroll', href: '/payroll', deep: 'payroll' },
  { label: 'Payout methods', href: '/payout-methods', deep: 'payout' },
  { label: 'Reports', href: '/reports', deep: 'admin' },
  { label: 'Analytics', href: '/analytics', deep: 'admin' },
  { label: 'Permissions', href: '/permissions', deep: 'admin' },
  { label: 'Settings', href: '/settings', deep: 'settings' },
  { label: 'Recruitment', href: '/recruitment', deep: 'admin' },
  { label: 'Performance', href: '/performance', deep: 'admin' },
  { label: 'Assets', href: '/assets', deep: 'admin' },
  { label: 'Announcements', href: '/announcements', deep: 'generic' },
];

const SETTINGS_ROUTES = [
  '/settings',
  '/settings/sessions',
  '/settings/notifications',
  '/settings/company-profile',
  '/settings/locale',
  '/settings/working-hours',
  '/settings/attendance-rules',
  '/settings/authentication',
  '/settings/audit-log',
  '/settings/email-templates',
  '/settings/integration-email',
  '/settings/integration-storage',
  '/settings/integration-webhooks',
  '/settings/billing-plan',
  '/settings/billing-invoices',
  '/settings/branding',
  '/settings/leave-types',
  '/settings/leave-policies',
  '/settings/leave-packs',
  '/settings/leave-assignments',
  '/settings/timesheets',
  '/settings/pay/components',
  '/settings/pay/groups',
  '/settings/pay/schedules',
  '/settings/pay/legal-entities',
  '/settings/pay/statutory-packs',
  '/settings/pay/payslip-template',
  '/settings/pay/data-policy',
  '/settings/roles-permissions',
];

const ADMIN_PROBES = [
  '/reports',
  '/analytics',
  '/permissions',
  '/recruitment',
  '/performance',
  '/assets',
  '/employees/new',
  '/payroll/global',
  '/payroll/migration',
  '/settings/company-profile',
  '/settings/pay/components',
  '/settings/audit-log',
  '/settings/roles-permissions',
];

const SELF_ROUTES = ['/employees/me/documents', '/employees/me/team', '/employee/dashboard'];

let shotIdx = 0;
const screenshots = [];
const findings = [];
const mutations = [];
const screenResults = [];
const depthStats = {
  menusVisited: 0,
  tabsClicked: 0,
  buttonsClicked: 0,
  dialogsOpened: 0,
  leaveTypesTried: 0,
  payslipsOpened: 0,
  notificationsActions: 0,
  adminProbes: 0,
  settingsRoutes: 0,
  nestedLayers: 0,
  screenshots: 0,
};
const seenIssueKeys = new Set();
let apiLog = [];
let consoleLog = [];
let navItems = [];

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52);
}

function persist() {
  depthStats.screenshots = shotIdx;
  fs.writeFileSync(
    path.join(SHOT, 'results.json'),
    JSON.stringify(
      {
        user: USER,
        role: 'EMPLOYEE',
        tenant: 'acme-corp-001',
        fe: FE,
        shotCount: shotIdx,
        findingsCount: findings.length,
        mutations,
        screenResults,
        findings,
        depthStats,
        navItems,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(SHOT, 'depth-stats.json'), JSON.stringify(depthStats, null, 2));
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  await page.screenshot({ path: path.join(SHOT, file), fullPage: false }).catch(() => {});
  screenshots.push({ file, url: page.url() });
  console.log(`  📸 ${file}`);
  persist();
  return file;
}

function note(issue) {
  const key = `${issue.layer}|${issue.where}|${issue.why}`;
  if (seenIssueKeys.has(key)) return;
  seenIssueKeys.add(key);
  findings.push({ ...issue, ts: new Date().toISOString() });
  console.log(`  🐛 [${issue.severity || '?'}][${issue.layer}] ${issue.where}: ${String(issue.why).slice(0, 120)}`);
  persist();
}

function resetNet() {
  apiLog = [];
  consoleLog = [];
}

function failApis() {
  return apiLog.filter((c) => c.status >= 400);
}

async function bodyText(page) {
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

async function settle(page, ms = 700) {
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function dismiss(page) {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
  }
  const cancel = page.getByRole('button', { name: /^(cancel|close|dismiss)$/i }).first();
  if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
  await page.mouse.click(8, 8).catch(() => {});
  await page.waitForTimeout(100);
}

function classify(text, fails) {
  const accessRestricted = /access restricted/i.test(text);
  const notFound = /404 page not found/i.test(text);
  const errHit = ERR_PATTERNS.find((re) => re.test(text));
  const api5xx = fails.filter((f) => f.status >= 500);
  const api4xx = fails.filter((f) => f.status >= 400 && f.status < 500);
  let layer = null;
  let state = 'OK';
  if (accessRestricted || notFound) {
    state = 'DENY';
    layer = 'FRONTEND';
  } else if (api5xx.length) {
    state = 'FAIL';
    layer = 'BACKEND';
  } else if (errHit || api4xx.length) {
    state = 'FAIL';
    layer =
      api4xx.some((f) => [400, 403, 404, 422].includes(f.status) && /leave|attendance|payroll|timesheet/i.test(f.url))
        ? 'BACKEND'
        : 'FRONTEND';
    if (/no leave balance/i.test(text) || api4xx.some((f) => /NO_LEAVE_BALANCE/i.test(f.body || ''))) {
      layer = 'BACKEND';
    }
  }
  return { state, layer, accessRestricted, notFound, errHit: errHit ? String(errHit) : null, api4xx, api5xx };
}

async function evaluate(page, menu, action) {
  const text = await bodyText(page);
  const fails = failApis();
  const c = classify(text, fails);
  const rec = {
    menu,
    action,
    url: page.url(),
    ...c,
    api4xx: c.api4xx.map((f) => `${f.status} ${f.method} ${f.url}`).slice(0, 12),
    api5xx: c.api5xx.map((f) => `${f.status} ${f.method} ${f.url}`).slice(0, 8),
    consoleErrors: consoleLog.slice(0, 6),
    bodySnippet: text.replace(/\s+/g, ' ').trim().slice(0, 280),
  };
  screenResults.push(rec);
  if (c.state !== 'OK' || c.api4xx.length || c.api5xx.length) {
    // Access-restricted on admin probes is expected — still record as finding with severity INFO/HIGH depending
    const isAdminDeny = c.accessRestricted && /admin|reports|analytics|permissions|recruitment|performance|assets|settings/i.test(`${menu} ${action}`);
    note({
      severity: c.api5xx.length ? 'CRITICAL' : c.accessRestricted ? (isAdminDeny ? 'HIGH' : 'HIGH') : 'MEDIUM',
      layer: c.layer || 'FRONTEND',
      where: `${menu} → ${action}`,
      why: c.accessRestricted
        ? `Access restricted UI (${page.url()})`
        : c.notFound
          ? `404 Page not found (${page.url()})`
          : c.errHit || `API failures: ${rec.api4xx.concat(rec.api5xx).slice(0, 4).join('; ')}`,
      screenshot: screenshots.at(-1)?.file,
      network: rec.api4xx.concat(rec.api5xx).slice(0, 6).join('; ') || 'n/a',
      expectedAdminDeny: !!isAdminDeny,
    });
  }
  return rec;
}

async function gotoHard(page, href) {
  await dismiss(page);
  resetNet();
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => {
    console.log(`  nav error ${href}: ${String(e).slice(0, 100)}`);
  });
  await settle(page, 850);
}

async function clickNamed(page, labels, { timeout = 700 } = {}) {
  for (const label of labels) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
    if (await btn.isVisible({ timeout }).catch(() => false)) {
      await btn.click({ timeout: 4000 }).catch(() => {});
      depthStats.buttonsClicked += 1;
      return label;
    }
    const tab = page.getByRole('tab', { name: new RegExp(label, 'i') }).first();
    if (await tab.isVisible({ timeout: 300 }).catch(() => false)) {
      await tab.click({ timeout: 4000 }).catch(() => {});
      depthStats.tabsClicked += 1;
      return label;
    }
    const any = page
      .locator(`main button:has-text("${label}"), main a:has-text("${label}"), [role="dialog"] button:has-text("${label}")`)
      .first();
    if (await any.isVisible({ timeout: 300 }).catch(() => false)) {
      await any.click({ timeout: 4000 }).catch(() => {});
      depthStats.buttonsClicked += 1;
      return label;
    }
  }
  return null;
}

/** Click every visible tab; return labels */
async function exploreTabs(page, menu) {
  const tabs = page.locator('[role="tab"]');
  const n = Math.min(await tabs.count().catch(() => 0), 14);
  const names = [];
  for (let i = 0; i < n; i++) {
    await dismiss(page);
    resetNet();
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const label = ((await tab.innerText().catch(() => `tab-${i}`)) || `tab-${i}`).trim().slice(0, 40);
    await tab.click().catch(() => {});
    await settle(page, 650);
    depthStats.tabsClicked += 1;
    depthStats.nestedLayers += 1;
    names.push(label);
    await shot(page, `${slug(menu)}-tab-${slug(label)}`);
    await evaluate(page, menu, `tab:${label}`);
  }
  return names;
}

/** Click up to N visible primary buttons in main (skip destructive admin if flagged) */
async function exploreMainButtons(page, menu, { max = 10, skip = [] } = {}) {
  const clicked = [];
  const btns = page.locator('main button:visible, [data-slot="page-header"] button:visible');
  const count = await btns.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, max + 8); i++) {
    if (clicked.length >= max) break;
    const b = btns.nth(i);
    if (!(await b.isVisible().catch(() => false))) continue;
    if (await b.isDisabled().catch(() => true)) continue;
    const txt = ((await b.innerText().catch(() => '')) || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!txt) continue;
    if (skip.some((s) => s.test(txt))) continue;
    if (clicked.includes(txt)) continue;
    // Avoid logout / theme noise
    if (/^sign out$|^log out$|^theme$/i.test(txt)) continue;
    resetNet();
    await b.click({ timeout: 4000 }).catch(() => {});
    await settle(page, 700);
    depthStats.buttonsClicked += 1;
    depthStats.nestedLayers += 1;
    clicked.push(txt);
    const sn = await shot(page, `${slug(menu)}-btn-${slug(txt)}`);
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      depthStats.dialogsOpened += 1;
      await shot(page, `${slug(menu)}-dialog-${slug(txt)}`);
      await evaluate(page, menu, `dialog:${txt}`);
      // leave dialog open for caller if they want; otherwise close
      const cancel = dialog.getByRole('button', { name: /cancel|close|dismiss/i }).first();
      if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
      else await page.keyboard.press('Escape').catch(() => {});
      await settle(page, 250);
    } else {
      await evaluate(page, menu, `btn:${txt}`);
    }
    // if navigated away from menu, go back
    const href = MENUS.find((m) => m.label === menu)?.href;
    if (href && !page.url().includes(href.split('?')[0]) && !page.url().includes('/payroll/my')) {
      await gotoHard(page, href);
    }
    void sn;
  }
  return clicked;
}

async function exploreFilters(page, menu) {
  const combo = page.locator('main button[role="combobox"], main [aria-haspopup="listbox"]').first();
  if (await combo.isVisible().catch(() => false)) {
    resetNet();
    await combo.click().catch(() => {});
    await page.waitForTimeout(300);
    depthStats.nestedLayers += 1;
    await shot(page, `${slug(menu)}-filter-open`);
    const opt = page.locator('[role="option"]').nth(1);
    if (await opt.isVisible().catch(() => false)) {
      await opt.click().catch(() => {});
      await settle(page, 500);
      await shot(page, `${slug(menu)}-filter-applied`);
      await evaluate(page, menu, 'filter');
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  const search = page.locator('main input[type="search"], main input[placeholder*="Search" i]').first();
  if (await search.isVisible().catch(() => false)) {
    resetNet();
    await search.fill('a').catch(() => {});
    await settle(page, 500);
    depthStats.nestedLayers += 1;
    await shot(page, `${slug(menu)}-search`);
    await evaluate(page, menu, 'search');
    await search.fill('').catch(() => {});
  }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(15000);

page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('/api/')) return;
  let body = '';
  if (res.status() >= 400) {
    try {
      body = (await res.text()).slice(0, 280);
    } catch {
      /* */
    }
  }
  apiLog.push({
    url: u.replace(/https?:\/\/[^/]+/, ''),
    status: res.status(),
    method: res.request().method(),
    body,
  });
});
page.on('console', (m) => {
  if (m.type() === 'error') consoleLog.push(m.text().slice(0, 220));
});
page.on('pageerror', (e) => consoleLog.push('pageerror: ' + String(e).slice(0, 220)));

// ═══ LOGIN ═══════════════════════════════════════════════════════════════════
console.log('=== LOGIN ===');
resetNet();
await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });
await page.waitForTimeout(800);
await shot(page, 'login-form');
const tenant = page.locator('#tenant, #tenantKey, input[name="tenant"], input[name="tenantKey"]');
if (await tenant.first().isVisible().catch(() => false)) {
  await tenant.first().fill('acme-corp-001');
}
await page.locator('#email').fill(USER);
await page.locator('#password').fill(PASS);
await shot(page, 'login-filled');
const loginWait = page
  .waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', {
    timeout: 30000,
  })
  .catch(() => null);
await page.getByRole('button', { name: /sign in/i }).click();
const loginResp = await loginWait;
console.log(`LOGIN API: ${loginResp ? loginResp.status() : 'none'}`);
await page
  .waitForURL((u) => !u.pathname.includes('/login') || u.pathname.includes('otp'), { timeout: 45000 })
  .catch(() => {});
await settle(page, 1500);
let loggedIn = !page.url().includes('/login') && !page.url().includes('otp');
if (!loggedIn && !page.url().includes('otp')) {
  await gotoHard(page, '/dashboard');
  loggedIn = !page.url().includes('/login');
}
await shot(page, loggedIn ? 'login-success-dashboard' : 'login-fail');
await evaluate(page, 'Login', 'submit');
if (!loggedIn) {
  persist();
  await browser.close();
  process.exit(1);
}

navItems = await page.evaluate(() => {
  const out = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('aside a[href], nav[aria-label="Main navigation"] a[href]')) {
    const href = a.getAttribute('href') || '';
    const label = (a.getAttribute('aria-label') || a.textContent || '').trim().replace(/\s+/g, ' ');
    if (!href.startsWith('/') || seen.has(href)) continue;
    seen.add(href);
    out.push({ href, label: label.slice(0, 60) });
  }
  return out;
});
fs.writeFileSync(path.join(SHOT, 'nav-items.json'), JSON.stringify(navItems, null, 2));
await shot(page, 'nav-sidebar-full');
console.log(`NAV (${navItems.length}):`, navItems.map((n) => n.label || n.href).join(' | '));

if (navItems.length >= 14) {
  note({
    severity: 'CRITICAL',
    layer: 'FRONTEND',
    where: 'Sidebar NAV_ITEMS for EMPLOYEE',
    why: `EMPLOYEE sees ${navItems.length} nav items (unfiltered admin-style nav) including ${navItems
      .filter((n) => /report|analytic|permission|recruit|performance|asset|setting/i.test(n.label + n.href))
      .map((n) => n.label)
      .join(', ')}`,
    screenshot: '004-nav-sidebar-full.png',
    network: 'n/a',
    findingId: 'C2',
  });
}

// Dashboard team duplication check
{
  const text = await bodyText(page);
  const amanCount = (text.match(/Aman Kumar/g) || []).length;
  if (amanCount >= 2) {
    note({
      severity: 'MEDIUM',
      layer: 'FRONTEND',
      where: 'Dashboard → My Team',
      why: `Aman Kumar listed ${amanCount} times (duplicate manager/peer rows)`,
      screenshot: screenshots.at(-1)?.file,
      network: 'n/a',
      findingId: 'M2',
    });
  }
}

// ═══ Per-menu deep explorers ═════════════════════════════════════════════════

async function deepDashboard() {
  console.log('\n=== Dashboard (deep) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/dashboard');
  await shot(page, 'dashboard-landing');
  await evaluate(page, 'Dashboard', 'landing');

  // Check-in / Check-out flows
  resetNet();
  let hit = await clickNamed(page, ['Check In', 'Clock In']);
  if (hit) {
    await settle(page, 1600);
    const sn = await shot(page, 'dashboard-check-in-result');
    const ev = await evaluate(page, 'Dashboard', 'check-in');
    const posts = apiLog.filter((c) => c.method === 'POST');
    mutations.push({ action: 'dashboard-check-in', apis: posts, shot: sn, ok: ev.state });
    console.log('  check-in posts', posts.map((p) => `${p.status} ${p.url}`));
  } else {
    await shot(page, 'dashboard-check-in-absent-or-done');
  }

  resetNet();
  hit = await clickNamed(page, ['Check Out', 'Clock Out']);
  if (hit) {
    await settle(page, 400);
    await clickNamed(page, ['Confirm', 'Yes', 'Check Out'], { timeout: 600 });
    await settle(page, 1600);
    const sn = await shot(page, 'dashboard-check-out-result');
    const ev = await evaluate(page, 'Dashboard', 'check-out');
    mutations.push({
      action: 'dashboard-check-out',
      apis: apiLog.filter((c) => c.method === 'POST'),
      shot: sn,
      ok: ev.state,
    });
    // second click to catch stale UI / ALREADY_CHECKED_OUT
    resetNet();
    const again = await clickNamed(page, ['Check Out', 'Clock Out'], { timeout: 500 });
    if (again) {
      await settle(page, 1200);
      const sn2 = await shot(page, 'dashboard-check-out-duplicate');
      await evaluate(page, 'Dashboard', 'check-out-duplicate');
      mutations.push({
        action: 'dashboard-check-out-duplicate',
        apis: apiLog.filter((c) => c.method === 'POST'),
        shot: sn2,
      });
      const text = await bodyText(page);
      if (/already checked out|checked in/i.test(text) && /checked in/i.test(text)) {
        note({
          severity: 'HIGH',
          layer: 'FRONTEND',
          where: 'Dashboard attendance card after Check Out',
          why: 'After checkout, UI still shows Checked in / confusing state while API returns ALREADY_CHECKED_OUT on duplicate',
          screenshot: sn2,
          network: failApis()
            .map((f) => `${f.status} ${f.method} ${f.url}`)
            .join('; '),
          findingId: 'H3',
        });
      }
    }
  }

  // nested widget buttons
  await exploreMainButtons(page, 'Dashboard', {
    max: 8,
    skip: [/^check in$/i, /^check out$/i, /^clock/i],
  });
  for (const label of ['Documents', 'My Team', 'View all', 'Request Leave', 'View Payslip']) {
    resetNet();
    const h = await clickNamed(page, [label], { timeout: 400 });
    if (!h) continue;
    await settle(page, 800);
    depthStats.nestedLayers += 1;
    await shot(page, `dashboard-widget-${slug(label)}`);
    await evaluate(page, 'Dashboard', `widget:${label}`);
    await gotoHard(page, '/dashboard');
  }
}

async function deepAttendance() {
  console.log('\n=== Attendance (deep) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/attendance');
  await shot(page, 'attendance-landing');
  await evaluate(page, 'Attendance', 'landing');
  await exploreTabs(page, 'Attendance');
  await exploreFilters(page, 'Attendance');

  for (const label of ['Calendar', 'Table', 'List', 'Summary', 'Regularization', 'My Attendance', 'Team']) {
    resetNet();
    const h = await clickNamed(page, [label], { timeout: 400 });
    if (!h) continue;
    await settle(page, 700);
    await shot(page, `attendance-view-${slug(label)}`);
    await evaluate(page, 'Attendance', `view:${label}`);
  }

  resetNet();
  let hit = await clickNamed(page, ['Check In', 'Clock In']);
  if (hit) {
    await settle(page, 1600);
    const sn = await shot(page, 'attendance-check-in-result');
    mutations.push({
      action: 'attendance-check-in',
      apis: apiLog.filter((c) => c.method === 'POST'),
      shot: sn,
    });
    await evaluate(page, 'Attendance', 'check-in');
  } else {
    await shot(page, 'attendance-check-in-button-state');
  }

  resetNet();
  hit = await clickNamed(page, ['Check Out', 'Clock Out']);
  if (hit) {
    await settle(page, 400);
    await clickNamed(page, ['Confirm', 'Yes'], { timeout: 500 });
    await settle(page, 1600);
    const sn = await shot(page, 'attendance-check-out-result');
    mutations.push({
      action: 'attendance-check-out',
      apis: apiLog.filter((c) => c.method === 'POST'),
      shot: sn,
    });
    await evaluate(page, 'Attendance', 'check-out');
  } else {
    await shot(page, 'attendance-check-out-button-state');
  }

  // Regularization dialog — fill all fields then cancel (or submit if safe)
  resetNet();
  hit = await clickNamed(page, ['Request Regularization', 'Regularize', 'New Request', 'Regularization']);
  if (hit) {
    await settle(page, 900);
    depthStats.dialogsOpened += 1;
    depthStats.nestedLayers += 1;
    await shot(page, 'attendance-reg-dialog-open');
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      const dates = dialog.locator('input[type="date"]');
      if ((await dates.count()) >= 1) await dates.nth(0).fill('2026-07-15').catch(() => {});
      const times = dialog.locator('input[type="time"]');
      if ((await times.count()) >= 1) await times.nth(0).fill('09:30').catch(() => {});
      if ((await times.count()) >= 2) await times.nth(1).fill('18:00').catch(() => {});
      const combo = dialog.locator('[role="combobox"]').first();
      if (await combo.isVisible().catch(() => false)) {
        await combo.click().catch(() => {});
        await page.locator('[role="option"]').first().click().catch(() => {});
      }
      const ta = dialog.locator('textarea').first();
      if (await ta.isVisible().catch(() => false)) {
        await ta.fill('E2E deep nested regularization — cancel without submit').catch(() => {});
      }
      await shot(page, 'attendance-reg-dialog-filled');
      await evaluate(page, 'Attendance', 'reg-form-filled');
      await dialog.getByRole('button', { name: /cancel|close/i }).first().click().catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  await exploreMainButtons(page, 'Attendance', { max: 6, skip: [/^check/i, /^clock/i] });
}

async function deepTimesheets() {
  console.log('\n=== Timesheets (deep) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/timesheets');
  await shot(page, 'timesheets-landing');
  await evaluate(page, 'Timesheets', 'landing');
  await exploreTabs(page, 'Timesheets');

  for (const label of ['My Timesheet', 'My Timesheets', 'Templates', 'Team', 'Approvals', 'History']) {
    resetNet();
    const h = await clickNamed(page, [label], { timeout: 400 });
    if (!h) continue;
    await settle(page, 800);
    await shot(page, `timesheets-view-${slug(label)}`);
    await evaluate(page, 'Timesheets', `view:${label}`);
  }

  // Week navigation
  for (const label of ['Previous', 'Prev', 'Next', 'This week', 'Current']) {
    resetNet();
    const h = await clickNamed(page, [label], { timeout: 350 });
    if (!h) continue;
    await settle(page, 600);
    depthStats.nestedLayers += 1;
    await shot(page, `timesheets-week-${slug(label)}`);
    await evaluate(page, 'Timesheets', `week:${label}`);
  }

  // Log time / Add entry — deep field fill
  resetNet();
  const open = await clickNamed(page, ['Log time', 'Log Time', 'Add Entry', 'Add entry', 'Add Hours', 'New Entry']);
  if (open) {
    await settle(page, 900);
    depthStats.dialogsOpened += 1;
    depthStats.nestedLayers += 1;
    await shot(page, 'timesheets-log-time-open');
    const dialog = page.locator('[role="dialog"]').first();
    const root = (await dialog.isVisible().catch(() => false)) ? dialog : page.locator('main');
    // fill all inputs in dialog
    const inputs = root.locator('input:not([type="hidden"]), textarea, [role="combobox"]');
    const ic = Math.min(await inputs.count().catch(() => 0), 12);
    for (let i = 0; i < ic; i++) {
      const el = inputs.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const role = await el.getAttribute('role').catch(() => '');
      const type = await el.getAttribute('type').catch(() => '');
      if (role === 'combobox') {
        await el.click().catch(() => {});
        await page.waitForTimeout(200);
        const opt = page.locator('[role="option"]').first();
        if (await opt.isVisible().catch(() => false)) await opt.click().catch(() => {});
        else await page.keyboard.press('Escape').catch(() => {});
      } else if (type === 'number' || type === 'text' || !type) {
        const ph = ((await el.getAttribute('placeholder').catch(() => '')) || '').toLowerCase();
        if (/hour|hrs|duration/.test(ph)) await el.fill('2').catch(() => {});
        else if (/project|task|desc|note/.test(ph)) await el.fill('E2E deep timesheet note').catch(() => {});
        else await el.fill('1').catch(() => {});
      } else if (type === 'date') {
        await el.fill('2026-08-03').catch(() => {});
      } else if (type === 'time') {
        await el.fill('10:00').catch(() => {});
      }
    }
    const ta = root.locator('textarea').first();
    if (await ta.isVisible().catch(() => false)) {
      await ta.fill('E2E deep nested timesheet entry — cancel').catch(() => {});
    }
    await shot(page, 'timesheets-log-time-filled');
    await evaluate(page, 'Timesheets', 'log-time-filled');
    // Submit optionally (mutation) — try save then cancel if validation fails
    resetNet();
    const saved = await clickNamed(page, ['Save', 'Add', 'Log', 'Submit'], { timeout: 500 });
    if (saved) {
      await settle(page, 1400);
      const sn = await shot(page, 'timesheets-log-time-submit-result');
      mutations.push({
        action: 'timesheet-log-time-submit',
        apis: apiLog.filter((c) => ['POST', 'PUT', 'PATCH'].includes(c.method)),
        shot: sn,
      });
      await evaluate(page, 'Timesheets', 'log-time-submit');
    }
    await dismiss(page);
  } else {
    await shot(page, 'timesheets-log-time-absent');
  }

  // Templates nested
  resetNet();
  if (await clickNamed(page, ['Templates'], { timeout: 500 })) {
    await settle(page, 700);
    await shot(page, 'timesheets-templates-deep');
    await exploreMainButtons(page, 'Timesheets', { max: 5 });
  }

  // Submit week if visible
  resetNet();
  if (await clickNamed(page, ['Submit week', 'Submit Week', 'Submit timesheet', 'Submit'], { timeout: 500 })) {
    await settle(page, 500);
    await clickNamed(page, ['Confirm', 'Yes', 'Submit'], { timeout: 500 });
    await settle(page, 1400);
    const sn = await shot(page, 'timesheets-submit-week-result');
    mutations.push({
      action: 'timesheet-submit-week',
      apis: apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method)),
      shot: sn,
    });
    await evaluate(page, 'Timesheets', 'submit-week');
    await dismiss(page);
  }
}

async function deepLeave() {
  console.log('\n=== Leave (deep — all types) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/leave');
  await shot(page, 'leave-landing');
  await evaluate(page, 'Leave', 'landing');

  // Capture balance widget text
  const landText = await bodyText(page);
  await shot(page, 'leave-balance-visible');

  await exploreTabs(page, 'Leave');
  for (const label of ['My Requests', 'Team Calendar', 'Comp-off', 'Balance', 'Calendar', 'History']) {
    resetNet();
    const h = await clickNamed(page, [label], { timeout: 400 });
    if (!h) continue;
    await settle(page, 800);
    const sn = await shot(page, `leave-view-${slug(label)}`);
    const ev = await evaluate(page, 'Leave', `view:${label}`);
    if (/team calendar/i.test(label) && ev.accessRestricted) {
      note({
        severity: 'HIGH',
        layer: 'FRONTEND',
        where: 'Leave → Team Calendar',
        why: 'Tab visible to EMPLOYEE but Access restricted',
        screenshot: sn,
        network: 'n/a',
        findingId: 'H1',
      });
    }
  }

  // Discover leave types via opening dialog once
  await gotoHard(page, '/leave');
  resetNet();
  let open = await clickNamed(page, ['New Request', 'Request Leave', 'Apply Leave', 'Apply']);
  if (!open) {
    await shot(page, 'leave-new-request-absent');
    return;
  }
  await settle(page, 1000);
  depthStats.dialogsOpened += 1;
  await shot(page, 'leave-request-dialog-open');

  // Collect leave type option labels
  let leaveTypes = [];
  const combo = page.locator('[role="dialog"] [role="combobox"]').first();
  if (await combo.isVisible().catch(() => false)) {
    await combo.click().catch(() => {});
    await page.waitForTimeout(350);
    leaveTypes = await page.locator('[role="option"]').evaluateAll((opts) =>
      opts.map((o) => (o.textContent || '').trim()).filter(Boolean),
    );
    await page.keyboard.press('Escape').catch(() => {});
  }
  if (!leaveTypes.length) {
    // fallback known types from prior findings
    leaveTypes = ['Annual Leave', 'Earned Leave', 'Casual Leave', 'Sick Leave', 'Comp Off', 'Comp-off'];
  }
  console.log('  Leave types discovered:', leaveTypes.join(' | '));
  await dismiss(page);

  // Dashboard annual mismatch
  if (/Annual\s+16/i.test(landText) || /Annual\s+\d+/i.test(landText)) {
    note({
      severity: 'MEDIUM',
      layer: 'FRONTEND',
      where: 'Dashboard / Leave balance labels',
      why: 'UI shows “Annual” balance cards that may not match API leaveTypeId EL/AL mapping',
      screenshot: 'leave-balance-visible',
      network: 'cross-check GET /leave/balance vs /leave/types',
      findingId: 'M4',
    });
  }

  const createdLeaveIds = [];
  for (const typeName of leaveTypes.slice(0, 8)) {
    await gotoHard(page, '/leave');
    resetNet();
    open = await clickNamed(page, ['New Request', 'Request Leave', 'Apply']);
    if (!open) continue;
    await settle(page, 800);
    depthStats.leaveTypesTried += 1;
    depthStats.nestedLayers += 1;
    depthStats.dialogsOpened += 1;

    const dialog = page.locator('[role="dialog"]').first();
    const typeCombo = dialog.locator('[role="combobox"]').first();
    if (await typeCombo.isVisible().catch(() => false)) {
      await typeCombo.click().catch(() => {});
      await page.waitForTimeout(250);
      const opt = page.getByRole('option', { name: new RegExp(typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
      if (await opt.isVisible().catch(() => false)) await opt.click().catch(() => {});
      else {
        // pick by index matching
        const all = page.locator('[role="option"]');
        const n = await all.count();
        let picked = false;
        for (let i = 0; i < n; i++) {
          const t = ((await all.nth(i).innerText().catch(() => '')) || '').trim();
          if (t.toLowerCase().includes(typeName.toLowerCase().slice(0, 6))) {
            await all.nth(i).click().catch(() => {});
            picked = true;
            break;
          }
        }
        if (!picked) await page.keyboard.press('Escape').catch(() => {});
      }
    }

    // stagger dates per type to avoid overlap conflicts
    const day = 10 + depthStats.leaveTypesTried;
    const d = `2026-11-${String(Math.min(day, 28)).padStart(2, '0')}`;
    const dates = dialog.locator('input[type="date"]');
    const dn = await dates.count();
    if (dn >= 1) await dates.nth(0).fill(d).catch(() => {});
    if (dn >= 2) await dates.nth(1).fill(d).catch(() => {});
    // day-part radios / selects
    for (const half of ['Full Day', 'Full day', 'Half Day', 'First Half', 'Second Half']) {
      const r = dialog.getByRole('radio', { name: new RegExp(half, 'i') }).first();
      if (await r.isVisible().catch(() => false)) {
        await r.click().catch(() => {});
        break;
      }
    }
    const reason = dialog.locator('textarea').first();
    if (await reason.isVisible().catch(() => false)) {
      await reason.fill(`E2E deep leave type=${typeName} date=${d}`).catch(() => {});
    }
    // any other comboboxes (day type etc.)
    const combos = dialog.locator('[role="combobox"]');
    const cc = await combos.count();
    for (let i = 1; i < Math.min(cc, 3); i++) {
      await combos.nth(i).click().catch(() => {});
      await page.waitForTimeout(150);
      const o = page.locator('[role="option"]').first();
      if (await o.isVisible().catch(() => false)) await o.click().catch(() => {});
      else await page.keyboard.press('Escape').catch(() => {});
    }

    await shot(page, `leave-filled-${slug(typeName)}`);
    resetNet();
    const submitted = await clickNamed(page, ['Submit', 'Request', 'Apply']);
    if (!submitted) {
      await dismiss(page);
      continue;
    }
    await settle(page, 2000);
    const sn = await shot(page, `leave-submit-${slug(typeName)}`);
    const posts = apiLog.filter((c) => c.method === 'POST' && /leave/i.test(c.url));
    mutations.push({ action: `leave-submit:${typeName}`, apis: posts, shot: sn });
    const ev = await evaluate(page, 'Leave', `submit:${typeName}`);
    const text = await bodyText(page);
    if (/no leave balance/i.test(text) || posts.some((p) => p.status === 400 && /NO_LEAVE_BALANCE/i.test(p.body || ''))) {
      note({
        severity: 'CRITICAL',
        layer: 'BACKEND',
        where: `Leave → New Request → ${typeName}`,
        why: `Submit failed NO_LEAVE_BALANCE for type "${typeName}" (types/balance invariant broken; FE may also default poorly)`,
        screenshot: sn,
        network: posts.map((p) => `${p.status} ${p.url} ${p.body}`).join('; '),
        findingId: 'C1',
        alsoFrontend: /annual leave/i.test(typeName),
      });
      note({
        severity: 'CRITICAL',
        layer: 'FRONTEND',
        where: `Leave → New Request default/picker → ${typeName}`,
        why: `UI offers/submits "${typeName}" which has no balance; should default to type with available>0`,
        screenshot: sn,
        network: posts.map((p) => `${p.status} ${p.url}`).join('; '),
        findingId: 'C1-FE',
      });
    }
    if (posts.some((p) => p.status === 200 || p.status === 201)) {
      createdLeaveIds.push(typeName);
      console.log(`  ✓ leave created for ${typeName}`);
    }
    await dismiss(page);
    void ev;
  }

  // Withdraw any PENDING row
  await gotoHard(page, '/leave');
  await clickNamed(page, ['My Requests'], { timeout: 500 });
  await settle(page, 800);
  resetNet();
  const withdrawBtn = page.getByRole('button', { name: /withdraw/i }).first();
  if (await withdrawBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await withdrawBtn.click().catch(() => {});
    await settle(page, 400);
    await clickNamed(page, ['Confirm', 'Yes', 'Withdraw'], { timeout: 800 });
    await settle(page, 1600);
    const sn = await shot(page, 'leave-withdraw-result');
    mutations.push({
      action: 'leave-withdraw',
      apis: apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method)),
      shot: sn,
    });
    await evaluate(page, 'Leave', 'withdraw');
  } else {
    await shot(page, 'leave-withdraw-absent');
    // row actions menu
    const more = page.locator('main button[aria-label*="more" i], main button:has-text("⋯"), main button:has-text("...")').first();
    if (await more.isVisible().catch(() => false)) {
      await more.click().catch(() => {});
      await settle(page, 400);
      depthStats.nestedLayers += 1;
      await shot(page, 'leave-row-actions-menu');
      const w = page.getByRole('menuitem', { name: /withdraw/i }).first();
      if (await w.isVisible().catch(() => false)) {
        await w.click().catch(() => {});
        await settle(page, 400);
        await clickNamed(page, ['Confirm', 'Yes', 'Withdraw'], { timeout: 800 });
        await settle(page, 1400);
        const sn = await shot(page, 'leave-withdraw-via-menu');
        mutations.push({
          action: 'leave-withdraw-menu',
          apis: apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method)),
          shot: sn,
        });
        await evaluate(page, 'Leave', 'withdraw-menu');
      }
    }
  }
  console.log('  leave types created OK:', createdLeaveIds.join(', ') || '(none)');
}

async function deepHolidays() {
  console.log('\n=== Holidays (deep) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/holidays');
  await shot(page, 'holidays-landing');
  await evaluate(page, 'Holidays', 'landing');
  await exploreTabs(page, 'Holidays');
  await exploreFilters(page, 'Holidays');
  for (const label of ['Optional', 'Mandatory', 'Calendar', 'List', 'My Selection', 'Upcoming', 'All']) {
    resetNet();
    if (!(await clickNamed(page, [label], { timeout: 350 }))) continue;
    await settle(page, 600);
    await shot(page, `holidays-view-${slug(label)}`);
    await evaluate(page, 'Holidays', `view:${label}`);
  }
  await exploreMainButtons(page, 'Holidays', { max: 6 });
  // year selector
  const combo = page.locator('main button[role="combobox"]').first();
  if (await combo.isVisible().catch(() => false)) {
    await combo.click().catch(() => {});
    await page.waitForTimeout(200);
    depthStats.nestedLayers += 1;
    await shot(page, 'holidays-year-open');
    const opt = page.locator('[role="option"]').first();
    if (await opt.isVisible().catch(() => false)) {
      await opt.click().catch(() => {});
      await settle(page, 500);
      await shot(page, 'holidays-year-selected');
    } else await page.keyboard.press('Escape').catch(() => {});
  }
  await shot(page, 'holidays-full');
}

async function deepPayroll() {
  console.log('\n=== Payroll self (deep) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/payroll');
  await shot(page, 'payroll-route-landing');
  await evaluate(page, 'Payroll', 'landing-/payroll');

  await gotoHard(page, '/payroll/my-payslips');
  await shot(page, 'payroll-my-payslips-landing');
  await evaluate(page, 'Payroll-self', 'landing');
  await exploreTabs(page, 'Payroll-self');

  for (const label of ['Payslips', 'Comp Statement', 'Tax Declaration', 'Claims', 'Loans', 'Tax Forms', 'YTD', 'Tax']) {
    resetNet();
    if (!(await clickNamed(page, [label], { timeout: 400 }))) continue;
    await settle(page, 800);
    depthStats.nestedLayers += 1;
    await shot(page, `payroll-tab-${slug(label)}`);
    await evaluate(page, 'Payroll-self', `tab:${label}`);
    // nested buttons inside tab
    await exploreMainButtons(page, `Payroll-${label}`, { max: 4 });
    await gotoHard(page, '/payroll/my-payslips');
    await clickNamed(page, [label], { timeout: 400 });
    await settle(page, 500);
  }

  // Payslip view + download
  await gotoHard(page, '/payroll/my-payslips');
  await clickNamed(page, ['Payslips'], { timeout: 400 });
  await settle(page, 800);
  resetNet();
  const viewBtn = page.getByRole('button', { name: /view|eye/i }).first();
  const viewLink = page.locator('main button:has-text("View"), main a:has-text("View")').first();
  const target = (await viewBtn.isVisible().catch(() => false))
    ? viewBtn
    : (await viewLink.isVisible().catch(() => false))
      ? viewLink
      : null;
  if (target) {
    await target.click().catch(() => {});
    await settle(page, 1200);
    depthStats.payslipsOpened += 1;
    depthStats.dialogsOpened += 1;
    depthStats.nestedLayers += 1;
    const sn = await shot(page, 'payroll-payslip-detail');
    await evaluate(page, 'Payroll-self', 'payslip-detail');
    // designation anomaly
    const text = await bodyText(page);
    if (/Senior Engineer\s+20\d{2}-\d{2}-\d{2}/i.test(text)) {
      note({
        severity: 'MEDIUM',
        layer: 'FRONTEND',
        where: 'Payroll → Payslip detail → Designation',
        why: 'Designation displays concatenated date (e.g. Senior Engineer 2026-07-02)',
        screenshot: sn,
        network: 'n/a',
      });
    }
    // Download
    resetNet();
    const dl = await clickNamed(page, ['Download', 'Download PDF', 'PDF', 'Export'], { timeout: 800 });
    if (dl) {
      await settle(page, 1500);
      const sn2 = await shot(page, 'payroll-payslip-download');
      mutations.push({
        action: 'payslip-download',
        apis: apiLog.filter((c) => c.method === 'GET' || c.method === 'POST'),
        shot: sn2,
      });
      await evaluate(page, 'Payroll-self', 'payslip-download');
    } else {
      await shot(page, 'payroll-payslip-download-absent');
    }
    await dismiss(page);
  } else {
    // click first payslip card
    const card = page.locator('main .rounded-lg.border button, main .rounded-lg.border').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click().catch(() => {});
      await settle(page, 1000);
      depthStats.payslipsOpened += 1;
      await shot(page, 'payroll-payslip-card-open');
      await evaluate(page, 'Payroll-self', 'payslip-card');
      await clickNamed(page, ['Download', 'PDF'], { timeout: 600 });
      await settle(page, 1000);
      await shot(page, 'payroll-payslip-card-download');
      await dismiss(page);
    } else {
      await shot(page, 'payroll-no-payslips');
    }
  }

  // Year filter
  await exploreFilters(page, 'Payroll-self');
}

async function deepPayout() {
  console.log('\n=== Payout methods (deep) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/payout-methods');
  await shot(page, 'payout-landing');
  await evaluate(page, 'Payout', 'landing');
  await exploreTabs(page, 'Payout');
  resetNet();
  if (await clickNamed(page, ['Add', 'Add Method', 'Add account', 'New'])) {
    await settle(page, 800);
    depthStats.dialogsOpened += 1;
    await shot(page, 'payout-add-dialog');
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      const inputs = dialog.locator('input:not([type="hidden"]), textarea');
      const n = Math.min(await inputs.count(), 8);
      for (let i = 0; i < n; i++) {
        const el = inputs.nth(i);
        const type = (await el.getAttribute('type').catch(() => '')) || 'text';
        if (type === 'checkbox' || type === 'radio') continue;
        await el.fill(type === 'number' ? '1' : 'E2E').catch(() => {});
      }
      await shot(page, 'payout-add-filled');
      await evaluate(page, 'Payout', 'add-filled');
      await dismiss(page);
    }
  }
  await exploreMainButtons(page, 'Payout', { max: 5 });
  await gotoHard(page, '/payout-methods/approvals');
  await shot(page, 'payout-approvals-probe');
  await evaluate(page, 'Payout', 'approvals-route');
}

async function deepEmployees() {
  console.log('\n=== Employees (deep) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/employees');
  await shot(page, 'employees-landing');
  await evaluate(page, 'Employees', 'landing');
  await exploreFilters(page, 'Employees');
  resetNet();
  const add = await clickNamed(page, ['Add Employee', 'Add employee', 'Add']);
  if (add) {
    await settle(page, 900);
    const sn = await shot(page, 'employees-add-visible');
    note({
      severity: 'HIGH',
      layer: 'FRONTEND',
      where: 'Employees → Add Employee',
      why: 'Add Employee control visible/clickable for EMPLOYEE role',
      screenshot: sn,
      network: failApis()
        .map((f) => `${f.status} ${f.url}`)
        .join('; '),
      securityIssue: true,
    });
    await dismiss(page);
  }
  const exportHit = await clickNamed(page, ['Export', 'Download CSV'], { timeout: 400 });
  if (exportHit) {
    await settle(page, 1000);
    const sn = await shot(page, 'employees-export-attempt');
    note({
      severity: 'HIGH',
      layer: 'FRONTEND',
      where: 'Employees → Export',
      why: 'Export control visible to EMPLOYEE',
      screenshot: sn,
      network: failApis()
        .map((f) => `${f.status} ${f.url}`)
        .join('; '),
      securityIssue: true,
    });
  }
  const row = page.locator('main table tbody tr a, main table tbody tr, main a[href*="/employees/"]').first();
  if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
    resetNet();
    await row.click().catch(() => {});
    await settle(page, 1000);
    depthStats.nestedLayers += 1;
    await shot(page, 'employees-row-detail');
    await evaluate(page, 'Employees', 'row-detail');
    await exploreTabs(page, 'Employees-detail');
    await exploreMainButtons(page, 'Employees-detail', { max: 5 });
  }
}

async function deepDepartments() {
  console.log('\n=== Departments (deep) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/departments');
  await shot(page, 'departments-landing');
  await evaluate(page, 'Departments', 'landing');
  await exploreMainButtons(page, 'Departments', { max: 4 });
  const item = page
    .locator('main button, main [role="treeitem"], main li, main a')
    .filter({ hasText: /Engineering|Customer Success|HR|Finance|Product/i })
    .first();
  if (await item.isVisible().catch(() => false)) {
    resetNet();
    await item.click().catch(() => {});
    await settle(page, 700);
    depthStats.nestedLayers += 1;
    await shot(page, 'departments-select');
    await evaluate(page, 'Departments', 'select');
  }
}

async function deepAnnouncements() {
  console.log('\n=== Announcements (deep) ===');
  depthStats.menusVisited += 1;
  await gotoHard(page, '/announcements');
  await shot(page, 'announcements-landing');
  await evaluate(page, 'Announcements', 'landing');
  await exploreTabs(page, 'Announcements');
  await exploreMainButtons(page, 'Announcements', { max: 5 });
  const card = page.locator('main article, main a, main .rounded-lg.border').first();
  if (await card.isVisible().catch(() => false)) {
    await card.click().catch(() => {});
    await settle(page, 700);
    depthStats.nestedLayers += 1;
    await shot(page, 'announcements-item');
    await evaluate(page, 'Announcements', 'item');
    await dismiss(page);
  }
}

async function deepAdminShell(label, href) {
  console.log(`\n=== Admin shell: ${label} (${href}) ===`);
  depthStats.menusVisited += 1;
  depthStats.adminProbes += 1;
  // sidebar click if present
  await gotoHard(page, '/dashboard');
  const side = page.locator(`aside a[href="${href}"], nav a[href="${href}"]`).first();
  if (await side.isVisible().catch(() => false)) {
    resetNet();
    await side.click().catch(() => {});
    await settle(page, 900);
    await shot(page, `admin-sidebar-${slug(label)}`);
  }
  await gotoHard(page, href);
  const sn = await shot(page, `admin-probe-${slug(href)}`);
  const ev = await evaluate(page, `Admin:${label}`, href);
  const text = await bodyText(page);
  const looksAdminData =
    /payroll run|statutory|permissions matrix|role matrix|company profile|billing|headcount|create employee|job requisition/i.test(
      text,
    ) && !ev.accessRestricted;
  if (looksAdminData) {
    note({
      severity: 'CRITICAL',
      layer: 'FRONTEND',
      where: `Admin probe ${href}`,
      why: 'EMPLOYEE reached admin-looking data UI (privilege leak)',
      screenshot: sn,
      network: failApis()
        .map((f) => `${f.status} ${f.url}`)
        .join('; '),
      securityIssue: true,
    });
  }
  if (ev.accessRestricted) {
    // still click any visible buttons on deny shell
    await exploreMainButtons(page, `Admin:${label}`, { max: 3 });
  } else if (/performance|assets/i.test(label)) {
    note({
      severity: 'HIGH',
      layer: 'FRONTEND',
      where: `${label} nav`,
      why: `${label} visible in nav; page not restricted or unexpected content for EMPLOYEE`,
      screenshot: sn,
      network: 'n/a',
      findingId: 'H2',
    });
  }
}

async function deepSettings() {
  console.log('\n=== Settings routes (deep) ===');
  depthStats.menusVisited += 1;
  for (const href of SETTINGS_ROUTES) {
    depthStats.settingsRoutes += 1;
    await gotoHard(page, href);
    const sn = await shot(page, `settings-${slug(href)}`);
    const ev = await evaluate(page, 'Settings', href);
    // self settings should work; admin should deny
    const selfOk = /\/settings\/(sessions|notifications)?$/.test(href) || href === '/settings/sessions' || href === '/settings/notifications';
    if (selfOk && ev.accessRestricted) {
      note({
        severity: 'HIGH',
        layer: 'FRONTEND',
        where: `Settings self ${href}`,
        why: 'Employee self settings unexpectedly Access restricted',
        screenshot: sn,
        network: 'n/a',
      });
    }
    if (ev.notFound) {
      note({
        severity: 'MEDIUM',
        layer: 'FRONTEND',
        where: `Settings ${href}`,
        why: '404 Page not found',
        screenshot: sn,
        network: 'n/a',
      });
    }
    // nested: try Save / Edit if on allowed page
    if (!ev.accessRestricted && !ev.notFound) {
      await exploreTabs(page, `Settings:${href}`);
      await exploreMainButtons(page, `Settings:${href}`, { max: 3, skip: [/delete|destroy|danger/i] });
    }
  }
}

async function deepNotifications() {
  console.log('\n=== Notifications (deep) ===');
  await gotoHard(page, '/dashboard');
  resetNet();
  const bell = page.locator('button[aria-label*="otif" i], button[aria-label*="Bell" i]').first();
  if (await bell.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bell.click().catch(() => {});
  } else {
    const btns = page.locator('header button');
    const n = await btns.count();
    for (let i = Math.max(0, n - 8); i < n; i++) {
      const al = (await btns.nth(i).getAttribute('aria-label').catch(() => '')) || '';
      if (/notif|bell/i.test(al)) {
        await btns.nth(i).click().catch(() => {});
        break;
      }
    }
  }
  await settle(page, 1000);
  depthStats.notificationsActions += 1;
  depthStats.nestedLayers += 1;
  await shot(page, 'notifications-panel-open');
  await evaluate(page, 'Notifications', 'open');

  // click first notification item
  const item = page.locator('[role="menu"] button, [data-state="open"] button').filter({ hasNotText: /mark all/i }).first();
  const item2 = page.locator('button:has(.rounded-full)').first();
  const clickTarget = (await item.isVisible().catch(() => false)) ? item : item2;
  if (await clickTarget.isVisible().catch(() => false)) {
    resetNet();
    await clickTarget.click().catch(() => {});
    await settle(page, 1200);
    depthStats.notificationsActions += 1;
    depthStats.nestedLayers += 1;
    await shot(page, 'notifications-item-click');
    await evaluate(page, 'Notifications', 'item-click');
    // re-open bell
    await gotoHard(page, '/dashboard');
    if (await bell.isVisible().catch(() => false)) await bell.click().catch(() => {});
    else {
      const b2 = page.locator('button[aria-label*="otif" i]').first();
      if (await b2.isVisible().catch(() => false)) await b2.click().catch(() => {});
    }
    await settle(page, 700);
  }

  resetNet();
  const mark = await clickNamed(page, ['Mark all as read', 'Mark all', 'Mark as read'], { timeout: 800 });
  if (mark) {
    await settle(page, 1000);
    depthStats.notificationsActions += 1;
    const sn = await shot(page, 'notifications-mark-all-read');
    mutations.push({
      action: 'notifications-mark-all-read',
      apis: apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method)),
      shot: sn,
    });
    await evaluate(page, 'Notifications', 'mark-all-read');
  } else {
    await shot(page, 'notifications-mark-all-absent');
  }
  await page.keyboard.press('Escape').catch(() => {});
}

async function deepProfile() {
  console.log('\n=== Profile menu (deep) ===');
  await gotoHard(page, '/dashboard');
  resetNet();
  const avatar = page
    .locator('header button:has([data-slot="avatar"]), header [data-slot="avatar"], header button:has(img)')
    .first();
  if (await avatar.isVisible({ timeout: 2000 }).catch(() => false)) {
    await avatar.click().catch(() => {});
  } else {
    await page.locator('header img').first().click().catch(() => {});
  }
  await settle(page, 700);
  depthStats.nestedLayers += 1;
  await shot(page, 'profile-menu-open');
  await evaluate(page, 'Profile', 'menu-open');

  const menuLabels = await page.locator('[role="menuitem"]').evaluateAll((els) =>
    els.map((e) => (e.textContent || '').trim()).filter(Boolean),
  );
  console.log('  profile menu items:', menuLabels.join(' | '));
  for (const label of menuLabels.slice(0, 8)) {
    if (/sign out|log out/i.test(label)) continue;
    await gotoHard(page, '/dashboard');
    const av = page.locator('header button:has([data-slot="avatar"]), header [data-slot="avatar"]').first();
    if (await av.isVisible().catch(() => false)) await av.click().catch(() => {});
    await settle(page, 400);
    const item = page.getByRole('menuitem', { name: new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if (!(await item.isVisible().catch(() => false))) continue;
    resetNet();
    await item.click().catch(() => {});
    await settle(page, 1000);
    depthStats.nestedLayers += 1;
    await shot(page, `profile-goto-${slug(label)}`);
    await evaluate(page, 'Profile', `goto:${label}`);
  }
}

async function deepSelfRoutes() {
  console.log('\n=== Self wireframe routes ===');
  for (const href of SELF_ROUTES) {
    await gotoHard(page, href);
    const sn = await shot(page, `self-route-${slug(href)}`);
    const ev = await evaluate(page, 'Self-routes', href);
    if (ev.notFound) {
      note({
        severity: 'MEDIUM',
        layer: 'FRONTEND',
        where: `Self route ${href}`,
        why: '404 Page not found — wireframe alias missing',
        screenshot: sn,
        network: 'n/a',
        findingId: 'M1',
      });
    }
  }
}

// ═══ RUN ALL ═════════════════════════════════════════════════════════════════
try {
  await deepDashboard();
  await deepAttendance();
  await deepTimesheets();
  await deepLeave();
  await deepHolidays();
  await deepPayroll();
  await deepPayout();
  await deepEmployees();
  await deepDepartments();
  await deepAnnouncements();

  for (const m of MENUS.filter((x) => x.deep === 'admin')) {
    await deepAdminShell(m.label, m.href);
  }
  for (const href of ADMIN_PROBES) {
    if (MENUS.some((m) => m.href === href && m.deep === 'admin')) continue;
    await deepAdminShell(href, href);
  }

  await deepSettings();
  await deepNotifications();
  await deepProfile();
  await deepSelfRoutes();

  // Final: sidebar click every visible nav item once more
  console.log('\n=== Sidebar click-through all nav ===');
  for (const n of navItems) {
    await gotoHard(page, '/dashboard');
    const side = page.locator(`aside a[href="${n.href}"]`).first();
    if (!(await side.isVisible().catch(() => false))) continue;
    resetNet();
    await side.click().catch(() => {});
    await settle(page, 800);
    depthStats.nestedLayers += 1;
    await shot(page, `sidebar-click-${slug(n.label || n.href)}`);
    await evaluate(page, 'Sidebar', n.href);
  }

  await gotoHard(page, '/dashboard');
  await shot(page, 'final-dashboard');
} catch (e) {
  console.error('FATAL', e);
  await shot(page, 'fatal-error').catch(() => {});
  note({
    severity: 'CRITICAL',
    layer: 'FRONTEND',
    where: 'runner',
    why: String(e?.message || e),
    screenshot: screenshots.at(-1)?.file,
    network: 'n/a',
  });
}

persist();
const be = findings.filter((f) => f.layer === 'BACKEND' && !f.expectedAdminDeny);
const fe = findings.filter((f) => f.layer === 'FRONTEND' && !f.expectedAdminDeny);
const adminDeny = findings.filter((f) => f.expectedAdminDeny);
console.log('\n==== DEPTH STATS ====');
console.log(JSON.stringify(depthStats, null, 2));
console.log(
  `\n==== DONE shots=${shotIdx} findings=${findings.length} (BE=${be.length} FE=${fe.length} adminDenyExpected=${adminDeny.length}) mutations=${mutations.length} ====`,
);
console.log(`Output: ${SHOT}`);
await browser.close();
