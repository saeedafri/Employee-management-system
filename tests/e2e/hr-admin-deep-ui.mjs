/**
 * Deep HR_ADMIN UI E2E — Playwright Chromium (local FE :3001 + BE :4000).
 * Screenshots → docs/e2e-ui-screenshots/hr-admin/NN-menu-action-result.png
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const SHOT =
  process.env.SHOT_DIR ||
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/hr-admin';
const USER = process.env.QA_EMAIL || 'hr@acme.test';
const PASS = process.env.QA_PASS || 'Password123!';

fs.mkdirSync(SHOT, { recursive: true });
for (const f of fs.readdirSync(SHOT)) {
  if (f.endsWith('.png') || f === 'results.json') fs.unlinkSync(path.join(SHOT, f));
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
  /\bunauthorized\b/i,
  /not authorized/i,
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
  { label: 'Reports', href: '/reports', deep: 'reports' },
  { label: 'Analytics', href: '/analytics', deep: 'analytics' },
  { label: 'Permissions', href: '/permissions', deep: 'permissions' },
  { label: 'Settings', href: '/settings', deep: 'settings' },
  { label: 'Recruitment', href: '/recruitment', deep: 'generic' },
  { label: 'Performance', href: '/performance', deep: 'generic' },
  { label: 'Assets', href: '/assets', deep: 'generic' },
  { label: 'Announcements', href: '/announcements', deep: 'generic' },
];

const SETTINGS_ROUTES = [
  '/settings/company-profile',
  '/settings/locale',
  '/settings/working-hours',
  '/settings/attendance-rules',
  '/settings/notifications',
  '/settings/authentication',
  '/settings/sessions',
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
];

let shotIdx = 0;
const screenshots = [];
const issues = [];
const menuResults = [];
const mutationsNoted = [];
const seenIssueKeys = new Set();

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function shot(page, menu, action, result = 'ok') {
  shotIdx += 1;
  const name = `${String(shotIdx).padStart(2, '0')}-${slug(menu)}-${slug(action)}-${slug(result)}.png`;
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false }).catch(() => {});
  screenshots.push({ name, menu, action, result, url: page.url() });
  console.log(`  📸 ${name}`);
  return name;
}

function addIssue({ where, why, classification, how, screenshot, network, console: cons }) {
  const key = `${classification}|${where}|${why}`;
  if (seenIssueKeys.has(key)) return null;
  seenIssueKeys.add(key);
  const id = `ISSUE-HR-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, where, why, classification, how, screenshot, network, console: cons || [] };
  issues.push(issue);
  console.log(`  🐛 ${id} [${classification}] ${where}: ${why}`);
  return issue;
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(15000);

let apiCalls = [];
let consoleErrors = [];
page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('/api/')) return;
  const status = res.status();
  let bodySnippet = '';
  if (status >= 400) {
    try {
      bodySnippet = (await res.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
  }
  apiCalls.push({
    url: u.replace(/https?:\/\/[^/]+/, ''),
    status,
    method: res.request().method(),
    bodySnippet,
    fromSW: res.fromServiceWorker(),
  });
});
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 220));
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 220)));

function resetNet() {
  apiCalls = [];
  consoleErrors = [];
}
function failApis() {
  return apiCalls.filter((c) => c.status >= 400);
}
async function settle(ms = 700) {
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}
async function bodyText() {
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

async function dismissOverlays() {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
  const cancel = page.getByRole('button', { name: /^(cancel|close|dismiss)$/i }).first();
  if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
  // click outside if listbox still open
  await page.mouse.click(10, 10).catch(() => {});
  await page.waitForTimeout(150);
}

function recordApiIssues(menu, action, screenshot) {
  for (const f of failApis()) {
    // ignore expected pre-auth probes only on login
    if (menu === 'login' && /\/api\/auth\/(me|refresh)/.test(f.url)) continue;
    const net = `${f.status} ${f.method} ${f.url}` + (f.bodySnippet ? ` | ${f.bodySnippet}` : '');
    let classification = 'BACKEND';
    if (f.status === 401 || f.status === 422) classification = 'FRONTEND';
    if (f.status === 403 && /permission|FORBIDDEN/i.test(f.bodySnippet)) classification = 'BACKEND';
    if (/NO_EMPLOYEE_RECORD/i.test(f.bodySnippet)) classification = 'BACKEND';
    if (f.status >= 500) classification = 'BACKEND';
    addIssue({
      where: `${menu} → ${action}`,
      why: `API ${f.status} ${f.method} ${f.url}`,
      classification,
      how:
        classification === 'BACKEND'
          ? 'Fix backend status/contract for HR_ADMIN; return usable empty payloads instead of opaque errors where appropriate.'
          : 'Fix frontend request wiring (auth/cookies/payload/path) and map API errors to empty/error states.',
      screenshot,
      network: net,
      console: consoleErrors.slice(0, 5),
    });
  }
  const keyWarn = consoleErrors.filter((e) => /same key|unique "key"/i.test(e));
  if (keyWarn.length) {
    addIssue({
      where: `${menu} → ${action}`,
      why: `React duplicate key console warnings (${keyWarn.length})`,
      classification: 'FRONTEND',
      how: 'Use unique React keys in list renders.',
      screenshot,
      network: 'n/a',
      console: keyWarn.slice(0, 3),
    });
  }
}

async function checkVisibleErrors(menu, action, screenshot) {
  const text = await bodyText();
  const hit = ERR_PATTERNS.find((re) => re.test(text));
  if (!hit) return;
  // "Unauthorized" word may appear in copy; require stronger signal unless API failed
  const strong =
    /something went wrong|error boundary|access restricted|failed to load|internal server/i.test(
      text,
    ) || failApis().length > 0;
  if (!strong && hit.source === '\\bunauthorized\\b') return;
  addIssue({
    where: `${menu} → ${action}`,
    why: `Visible error pattern: /${hit.source}/`,
    classification: failApis().some((f) => f.status >= 500) ? 'BACKEND' : 'FRONTEND',
    how: 'Resolve underlying failure; show role-aware empty/error state instead of broken UI.',
    screenshot,
    network: failApis()
      .slice(0, 6)
      .map((f) => `${f.status} ${f.method} ${f.url}`)
      .join('; '),
    console: consoleErrors.slice(0, 5),
  });
}

async function gotoMenu(href, label) {
  await dismissOverlays();
  resetNet();
  // Prefer hard navigation for reliability, then verify sidebar click also works
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(900);
  const okHard = page.url().includes(href.split('?')[0]);
  if (!okHard) {
    const sn = await shot(page, label, 'goto', 'wrong-url');
    addIssue({
      where: label,
      why: `Hard navigation to ${href} landed on ${page.url()}`,
      classification: 'FRONTEND',
      how: 'Fix route guard / redirect logic for HR_ADMIN.',
      screenshot: sn,
      network: page.url(),
    });
  }

  // Sidebar click round-trip check (from a neutral page when possible)
  await dismissOverlays();
  const side = page.locator(`nav[aria-label="Main navigation"] a[href="${href}"]`).first();
  if (await side.isVisible().catch(() => false)) {
    // bounce via dashboard first if not already there (except dashboard itself)
    if (href !== '/dashboard') {
      await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(500);
      await dismissOverlays();
    }
    resetNet();
    await side.click();
    await settle(900);
    const okSide = page.url().includes(href.split('?')[0]);
    if (!okSide) {
      const sn = await shot(page, label, 'sidebar-click', 'nav-fail');
      addIssue({
        where: `${label} sidebar`,
        why: `Sidebar click for ${href} did not navigate (url=${page.url()})`,
        classification: 'FRONTEND',
        how: 'Ensure sidebar Link navigates even when prior menus/dropdowns were used; close overlays on route change.',
        screenshot: sn,
        network: page.url(),
      });
      // recover with hard goto
      await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded' });
      await settle(800);
    }
  }
}

async function clickNamed(menu, names, { screenshotSuffix = 'clicked', cancelModal = true } = {}) {
  for (const name of names) {
    await dismissOverlays();
    const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first();
    const link = page.getByRole('link', { name: new RegExp(name, 'i') }).first();
    const target = (await btn.isVisible().catch(() => false))
      ? btn
      : (await link.isVisible().catch(() => false))
        ? link
        : null;
    if (!target) continue;
    resetNet();
    await target.click().catch(() => {});
    await settle(800);
    const sn = await shot(page, menu, name.replace(/[^a-z0-9]+/gi, '-'), screenshotSuffix);
    await checkVisibleErrors(menu, name, sn);
    recordApiIssues(menu, name, sn);
    if (cancelModal) {
      const dialog = page.locator('[role="dialog"]').first();
      if (await dialog.isVisible().catch(() => false)) {
        await shot(page, menu, `${name}-modal`, 'open');
        const cancel = dialog.getByRole('button', { name: /cancel|close|dismiss/i }).first();
        if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
        else await page.keyboard.press('Escape').catch(() => {});
        await settle(300);
      }
    }
    await dismissOverlays();
  }
}

async function exploreTabs(menu) {
  const tabs = page.locator('[role="tab"]');
  const n = Math.min(await tabs.count().catch(() => 0), 8);
  for (let i = 0; i < n; i++) {
    await dismissOverlays();
    resetNet();
    const tab = tabs.nth(i);
    const label = ((await tab.innerText().catch(() => `tab-${i}`)) || `tab-${i}`).trim().slice(0, 40);
    await tab.click().catch(() => {});
    await settle(600);
    const sn = await shot(page, menu, `tab-${label}`, 'view');
    await checkVisibleErrors(menu, `tab ${label}`, sn);
    recordApiIssues(menu, `tab ${label}`, sn);
  }
}

async function exploreFilters(menu) {
  await dismissOverlays();
  const combo = page.locator('main button[role="combobox"], main [aria-haspopup="listbox"]').first();
  if (await combo.isVisible().catch(() => false)) {
    resetNet();
    await combo.click().catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, menu, 'filter-open', 'open');
    const opt = page.locator('[role="option"]').nth(1);
    if (await opt.isVisible().catch(() => false)) {
      await opt.click().catch(() => {});
      await settle(500);
      const sn = await shot(page, menu, 'filter-applied', 'applied');
      recordApiIssues(menu, 'filter', sn);
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
  }
  await dismissOverlays();
  const search = page.locator('main input[type="search"], main input[placeholder*="Search" i]').first();
  if (await search.isVisible().catch(() => false)) {
    resetNet();
    await search.fill('a').catch(() => {});
    await settle(500);
    const sn = await shot(page, menu, 'search', 'results');
    recordApiIssues(menu, 'search', sn);
    await search.fill('').catch(() => {});
  }
}

async function explorePagination(menu) {
  const next = page.locator('main').getByRole('button', { name: /next/i }).first();
  if ((await next.isVisible().catch(() => false)) && !(await next.isDisabled().catch(() => true))) {
    resetNet();
    await next.click().catch(() => {});
    await settle(600);
    const sn = await shot(page, menu, 'pagination-next', 'page2');
    recordApiIssues(menu, 'pagination', sn);
    const prev = page.locator('main').getByRole('button', { name: /prev|previous/i }).first();
    if (await prev.isVisible().catch(() => false)) await prev.click().catch(() => {});
    await settle(300);
  }
}

async function deepEmployees(menu) {
  await clickNamed(menu, ['Add Employee', 'Export', 'CSV', 'Excel', 'PDF']);
  await exploreFilters(menu);
  await explorePagination(menu);
  const row = page.locator('main a[href*="/employees/"]').first();
  if (await row.isVisible().catch(() => false)) {
    resetNet();
    await row.click();
    await settle(900);
    const sn = await shot(page, menu, 'employee-detail', 'view');
    await checkVisibleErrors(menu, 'employee-detail', sn);
    recordApiIssues(menu, 'employee-detail', sn);
    await exploreTabs('employee-detail');
    await clickNamed('employee-detail', ['Edit', 'Upload', 'Save', 'Cancel']);
    await page.goto(`${FE}/employees`, { waitUntil: 'domcontentloaded' });
    await settle(500);
  }
}

async function deepDepartments(menu) {
  await clickNamed(menu, ['Add department', 'Add Department']);
  // select first department row/button
  const item = page.locator('main button, main [role="treeitem"], main li').filter({ hasText: /Engineering|Customer Success|HR|Finance/i }).first();
  if (await item.isVisible().catch(() => false)) {
    resetNet();
    await item.click().catch(() => {});
    await settle(700);
    const sn = await shot(page, menu, 'select-department', 'view');
    recordApiIssues(menu, 'select-department', sn);
  }
  await dismissOverlays();
}

async function deepAttendance(menu) {
  await exploreTabs(menu);
  await exploreFilters(menu);
  await clickNamed(menu, [
    'Check In',
    'Check Out',
    'Request Regularization',
    'Regularization',
    'Export',
    'CSV',
    'Excel',
    'PDF',
    'Team',
    'My Attendance',
    'Calendar',
    'List',
  ]);
  // note approve/deny visibility without mutating
  const approve = page.getByRole('button', { name: /^approve$/i }).first();
  if (await approve.isVisible().catch(() => false)) {
    const sn = await shot(page, menu, 'approve-visible', 'ready');
    mutationsNoted.push({ menu, action: 'Approve visible — NOT clicked', screenshot: sn });
  }
}

async function deepTimesheets(menu) {
  await exploreTabs(menu);
  await exploreFilters(menu);
  await clickNamed(menu, [
    'Add Entry',
    'Add entry',
    'Submit',
    'Export',
    'CSV',
    'Excel',
    'PDF',
    'Templates',
    'Team',
    'My Timesheet',
  ]);
}

async function deepLeave(menu) {
  await exploreTabs(menu);
  await exploreFilters(menu);
  await clickNamed(menu, [
    'Request Leave',
    'Apply Leave',
    'New Request',
    'Export',
    'CSV',
    'Excel',
    'PDF',
    'Team',
    'Balance',
    'Calendar',
  ]);
  const approve = page.getByRole('button', { name: /^approve$/i }).first();
  if (await approve.isVisible().catch(() => false)) {
    const sn = await shot(page, menu, 'approve-visible', 'ready');
    mutationsNoted.push({ menu, action: 'Leave Approve visible — NOT clicked', screenshot: sn });
  }
  const deny = page.getByRole('button', { name: /^(deny|reject)$/i }).first();
  if (await deny.isVisible().catch(() => false)) {
    await shot(page, menu, 'deny-visible', 'ready');
  }
}

async function deepHolidays(menu) {
  await exploreTabs(menu);
  await clickNamed(menu, ['Add Holiday', 'Add holiday', 'Import', 'Export', 'Policy']);
}

async function deepPayroll(menu) {
  await exploreTabs(menu);
  await exploreFilters(menu);
  await clickNamed(menu, [
    'Create Run',
    'New Run',
    'Run Payroll',
    'Export',
    'CSV',
    'Excel',
    'PDF',
    'My Payslips',
    'Global',
    'Compute',
    'Generate',
  ]);
  const run = page.locator('main a[href*="/payroll/"]').first();
  if (await run.isVisible().catch(() => false)) {
    resetNet();
    await run.click().catch(() => {});
    await settle(900);
    const sn = await shot(page, menu, 'run-detail', 'view');
    await checkVisibleErrors(menu, 'run-detail', sn);
    recordApiIssues(menu, 'run-detail', sn);
    await exploreTabs('payroll-detail');
    await clickNamed('payroll-detail', ['Export', 'PDF', 'Excel', 'Lock', 'Compute', 'Approve']);
    await page.goto(`${FE}/payroll`, { waitUntil: 'domcontentloaded' });
    await settle(500);
  }
}

async function deepPayout(menu) {
  await exploreTabs(menu);
  await clickNamed(menu, ['Add', 'Add account', 'Add method', 'Verify', 'Export']);
  resetNet();
  await page.goto(`${FE}/payout-methods/approvals`, { waitUntil: 'domcontentloaded' });
  await settle(800);
  const sn = await shot(page, menu, 'approvals', 'view');
  await checkVisibleErrors(menu, 'approvals', sn);
  recordApiIssues(menu, 'approvals', sn);
  await clickNamed(menu, ['Approve', 'Deny', 'Reject']);
}

async function deepReports(menu) {
  await exploreFilters(menu);
  const links = page.locator('a[href^="/reports/"]');
  const hrefs = [];
  const n = await links.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const h = await links.nth(i).getAttribute('href');
    if (h && !hrefs.includes(h)) hrefs.push(h);
  }
  for (const h of hrefs.slice(0, 16)) {
    await dismissOverlays();
    resetNet();
    await page.goto(`${FE}${h}`, { waitUntil: 'domcontentloaded' });
    await settle(700);
    const sn = await shot(page, menu, h.replace(/\//g, '-').replace(/^-/, ''), 'view');
    await checkVisibleErrors(menu, h, sn);
    recordApiIssues(menu, h, sn);
    await clickNamed(menu, ['Export', 'PDF', 'Excel', 'CSV', 'Download', 'Schedule']);
    await dismissOverlays();
  }
}

async function deepAnalytics(menu) {
  await exploreTabs(menu);
  await exploreFilters(menu);
  await clickNamed(menu, ['7d', '30d', '90d', 'Export', 'PDF', 'Excel', 'CSV']);
}

async function deepPermissions(menu) {
  await exploreTabs(menu);
  await clickNamed(menu, ['Save', 'Reset', 'Edit']);
  // HR should typically be restricted — capture access state
  const text = await bodyText();
  if (/access restricted|super.?admin only|not authorized|forbidden/i.test(text)) {
    const sn = await shot(page, menu, 'access-state', 'restricted');
    addIssue({
      where: menu,
      why: 'Permissions page visible in HR_ADMIN sidebar but content is restricted (or should be hidden per role-nav contract)',
      classification: 'FRONTEND',
      how: 'Hide Permissions nav for HR_ADMIN (SUPER_ADMIN only) per UI_CONTRACT_role_nav; keep deep-link Access Restricted page.',
      screenshot: sn,
      network: 'n/a',
    });
  }
}

async function deepSettings(menu) {
  const sn0 = await shot(page, menu, 'landing', 'view');
  recordApiIssues(menu, 'landing', sn0);
  for (const href of SETTINGS_ROUTES) {
    await dismissOverlays();
    resetNet();
    try {
      await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch {
      const sn = await shot(page, menu, href.replace(/\//g, '-'), 'timeout');
      addIssue({
        where: `${menu} → ${href}`,
        why: 'Navigation timeout',
        classification: 'FRONTEND',
        how: 'Investigate slow/broken settings chunk.',
        screenshot: sn,
        network: 'nav-timeout',
      });
      continue;
    }
    await settle(650);
    const sn = await shot(page, menu, href.replace(/\//g, '-').replace(/^-/, ''), 'view');
    await checkVisibleErrors(menu, href, sn);
    recordApiIssues(menu, href, sn);
    await exploreTabs(slug(href));
    await clickNamed(slug(href), ['Save', 'Export', 'Edit', 'Add', 'Test connection', 'Send test']);
    await dismissOverlays();
  }
}

async function deepGeneric(menu) {
  await exploreTabs(menu);
  await exploreFilters(menu);
  await explorePagination(menu);
  await clickNamed(menu, [
    'Add',
    'Create',
    'New',
    'Export',
    'PDF',
    'Excel',
    'CSV',
    'Upload',
    'Import',
    'Publish',
    'Edit',
  ]);
}

async function deepDashboard(menu) {
  await clickNamed(menu, ['7d', '30d', '90d', 'Add Employee']);
  await exploreFilters(menu);
}

const DEEP = {
  dashboard: deepDashboard,
  employees: deepEmployees,
  departments: deepDepartments,
  attendance: deepAttendance,
  timesheets: deepTimesheets,
  leave: deepLeave,
  holidays: deepHolidays,
  payroll: deepPayroll,
  payout: deepPayout,
  reports: deepReports,
  analytics: deepAnalytics,
  permissions: deepPermissions,
  settings: deepSettings,
  generic: deepGeneric,
};

// ── LOGIN ─────────────────────────────────────────────────────────────
console.log('=== LOGIN ===');
resetNet();
await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('#email', { state: 'visible' });
await page.locator('#email').click();
await page.locator('#email').fill(USER);
await page.locator('#password').click();
await page.locator('#password').fill(PASS);
await page.evaluate(() => {
  for (const id of ['email', 'password']) {
    const el = document.querySelector('#' + id);
    if (!el) continue;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
});
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 }).catch(() => {});
await settle(2000);
let loggedIn = !page.url().includes('/login');
if (!loggedIn) {
  await page.locator('#email').fill(USER);
  await page.locator('#password').fill(PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 }).catch(() => {});
  await settle(2000);
  loggedIn = !page.url().includes('/login');
}
const snLogin = await shot(page, 'login', 'submit', loggedIn ? 'ok' : 'fail');
if (!loggedIn) {
  addIssue({
    where: 'login',
    why: 'HR_ADMIN login failed via UI',
    classification: 'FRONTEND',
    how: 'Check BFF auth + cookies + API_BASE_URL.',
    screenshot: snLogin,
    network: failApis()
      .map((f) => `${f.status} ${f.url}`)
      .join('; '),
  });
  fs.writeFileSync(path.join(SHOT, 'results.json'), JSON.stringify({ issues, screenshots }, null, 2));
  await browser.close();
  process.exit(1);
}
// Note pre-login 401 race if present
for (const f of failApis().filter((x) => x.status === 401 && /auth\/(me|refresh)/.test(x.url))) {
  addIssue({
    where: 'login → bootstrap',
    why: `Pre-auth ${f.status} ${f.method} ${f.url} during login page load`,
    classification: 'FRONTEND',
    how: 'Avoid calling /auth/me and /auth/refresh on anonymous login page, or suppress expected 401 console noise.',
    screenshot: snLogin,
    network: `${f.status} ${f.method} ${f.url} | ${f.bodySnippet}`,
  });
}

const navLabels = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Main navigation"]');
  if (!nav) return [];
  return [...nav.querySelectorAll('a')].map((a) => (a.getAttribute('aria-label') || a.textContent || '').trim());
});
console.log('SIDEBAR:', navLabels.join(' | '));
await shot(page, 'shell', 'sidebar', 'visible');

for (const item of MENUS) {
  console.log(`\n=== MENU: ${item.label} (${item.href}) ===`);
  await gotoMenu(item.href, item.label);
  const sn = await shot(page, item.label, 'land', 'view');
  await checkVisibleErrors(item.label, 'land', sn);
  recordApiIssues(item.label, 'land', sn);

  const text = await bodyText();
  const titleOk =
    item.href === '/dashboard'
      ? /welcome|dashboard/i.test(text)
      : new RegExp(item.label.split(' ')[0], 'i').test(text) || page.url().includes(item.href);

  menuResults.push({
    menu: item.label,
    href: item.href,
    url: page.url(),
    titleOk,
    api4xx: failApis()
      .filter((f) => f.status < 500)
      .map((f) => `${f.status} ${f.method} ${f.url}`),
    api5xx: failApis()
      .filter((f) => f.status >= 500)
      .map((f) => `${f.status} ${f.method} ${f.url}`),
    consoleErrors: consoleErrors.slice(0, 5),
  });

  if (!titleOk) {
    addIssue({
      where: item.label,
      why: `Landed URL/content mismatch for ${item.href} (url=${page.url()})`,
      classification: 'FRONTEND',
      how: 'Fix client routing so sidebar destination matches page content.',
      screenshot: sn,
      network: page.url(),
    });
  }

  const fn = DEEP[item.deep] || deepGeneric;
  await fn(item.label);
  await dismissOverlays();
}

// Shell extras
console.log('\n=== SHELL EXTRAS ===');
await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
await settle(600);
const bell = page.locator('button[aria-label*="Notification" i]').first();
if (await bell.isVisible().catch(() => false)) {
  resetNet();
  await bell.click().catch(() => {});
  await settle(500);
  const snBell = await shot(page, 'shell', 'notifications-bell', 'open');
  recordApiIssues('shell', 'notifications', snBell);
  await page.keyboard.press('Escape').catch(() => {});
}

const summary = {
  role: 'HR_ADMIN',
  user: USER,
  fe: FE,
  menusTested: menuResults.map((m) => m.menu),
  menuCount: menuResults.length,
  screenshotCount: screenshots.length,
  issueCount: issues.length,
  backendIssues: issues.filter((i) => i.classification === 'BACKEND').length,
  frontendIssues: issues.filter((i) => i.classification === 'FRONTEND').length,
  mutationsNoted,
  issues,
  menuResults,
  screenshots,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(SHOT, 'results.json'), JSON.stringify(summary, null, 2));
console.log(
  `\n==== DONE menus=${summary.menuCount} shots=${summary.screenshotCount} issues=${summary.issueCount} BE=${summary.backendIssues} FE=${summary.frontendIssues} ====`,
);
await browser.close();
