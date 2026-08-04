/**
 * Resume MANAGER deep E2E from Holidays onward (preserves existing PNGs).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const SHOT =
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/manager-deep';
const USER = 'aman@acme.test';
const PASS = 'Password123!';
const MAX_NEST = 3;
const MAX_CLICKS_PER_LEVEL = 18;
const MAX_TOTAL_CLICKS = 280;

const existing = fs.readdirSync(SHOT).filter((f) => f.endsWith('.png'));
let shotIdx = existing.length;
let totalClicks = 0;

const ERR_PATTERNS = [
  /something went wrong/i,
  /unexpected error/i,
  /failed to load/i,
  /internal server error/i,
  /error boundary/i,
  /application error/i,
  /access restricted/i,
  /page not found/i,
];

const ADMIN_MENUS = new Set([
  'Reports',
  'Analytics',
  'Permissions',
  'Recruitment',
  'Performance',
  'Assets',
]);

const MENUS = [
  { label: 'Leave', href: '/leave', deep: 'leave-finish' }, // leave-detail + approvals only
  { label: 'Holidays', href: '/holidays', deep: 'generic' },
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
  '/settings/roles-permissions',
  '/settings/pay/components',
  '/settings/pay/groups',
  '/settings/pay/schedules',
  '/settings/pay/legal-entities',
  '/settings/pay/statutory-packs',
  '/settings/pay/payslip-template',
  '/settings/pay/data-policy',
];

const ADMIN_DEEP_LINKS = [
  '/reports',
  '/reports/headcount',
  '/reports/absenteeism',
  '/reports/pay-equity',
  '/analytics',
  '/permissions',
  '/recruitment',
  '/performance',
  '/assets',
  '/payroll/runs',
  '/employees/new',
  '/settings/company-profile',
  '/settings/pay/components',
  '/settings/authentication',
  '/settings/billing-plan',
  '/settings/roles-permissions',
];

const screenshots = [];
const issues = [];
const menuResults = [];
const mutations = [];
const depthStats = {
  menusLanded: 0,
  tabsClicked: 0,
  buttonsClicked: 0,
  linksClicked: 0,
  dialogsOpened: 0,
  nestedLevelsReached: 0,
  maxNestSeen: 0,
  adminDeny: 0,
  adminLeak: 0,
  exportsClicked: 0,
  detailViews: 0,
  approvalsAttempted: 0,
  resumeFromShot: shotIdx,
};
const seenIssueKeys = new Set();
const clickFingerprints = new Set();

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function shot(page, menu, action, result = 'ok') {
  shotIdx += 1;
  const name = `${String(shotIdx).padStart(3, '0')}-${slug(menu)}-${slug(action)}-${slug(result)}.png`;
  try {
    await page.screenshot({ path: path.join(SHOT, name), fullPage: false });
  } catch {
    /* browser may be closing */
  }
  screenshots.push({ name, menu, action, result, url: page.url() });
  console.log(`  📸 ${name}`);
  return name;
}

function addIssue({ where, why, classification, how, screenshot, network, console: cons, severity }) {
  const key = `${classification}|${where}|${why}`;
  if (seenIssueKeys.has(key)) return null;
  seenIssueKeys.add(key);
  const id = `ISSUE-MGR-DEEP-R${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, where, why, classification, how, screenshot, network, console: cons || [], severity: severity || 'MEDIUM' };
  issues.push(issue);
  console.log(`  🐛 ${id} [${classification}/${issue.severity}] ${where}: ${why}`);
  return issue;
}

const browser = await chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true }));
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(10000);

let apiCalls = [];
let consoleErrors = [];
page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('/api/')) return;
  const status = res.status();
  let bodySnippet = '';
  if (status >= 400 || /approve|reject|deny|return|bulk/i.test(u)) {
    try {
      bodySnippet = (await res.text()).slice(0, 400);
    } catch {
      /* ignore */
    }
  }
  apiCalls.push({ url: u.replace(/https?:\/\/[^/]+/, ''), status, method: res.request().method(), bodySnippet });
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
async function settle(ms = 600) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(ms);
  } catch {
    /* closed */
  }
}
async function bodyText() {
  try {
    return (await page.evaluate(() => document.body?.innerText || '')) || '';
  } catch {
    return '';
  }
}
async function dismissOverlays() {
  try {
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(80);
    }
    const cancel = page.getByRole('button', { name: /^(cancel|close|dismiss)$/i }).first();
    if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
    await page.mouse.click(8, 8).catch(() => {});
  } catch {
    /* ignore */
  }
}

function recordApiIssues(menu, action, screenshot) {
  for (const f of failApis()) {
    if (menu === 'login' && /\/api\/auth\/(me|refresh)/.test(f.url)) continue;
    const net = `${f.status} ${f.method} ${f.url}` + (f.bodySnippet ? ` | ${f.bodySnippet}` : '');
    let classification = 'BACKEND';
    let severity = 'MEDIUM';
    if (f.status === 401 || f.status === 422) classification = 'FRONTEND';
    if (f.status === 403 && /SELF_APPROVAL_FORBIDDEN/i.test(f.bodySnippet)) {
      classification = 'FRONTEND';
      severity = 'CRITICAL';
    }
    if (f.status >= 500) {
      classification = 'BACKEND';
      severity = 'HIGH';
    }
    addIssue({
      where: `${menu} → ${action}`,
      why: `API ${f.status} ${f.method} ${f.url}${f.bodySnippet ? ' — ' + f.bodySnippet.slice(0, 120) : ''}`,
      classification,
      severity,
      how: classification === 'BACKEND' ? 'Fix backend contract for MANAGER.' : 'Fix FE wiring / hide actions that 403.',
      screenshot,
      network: net,
      console: consoleErrors.slice(0, 4),
    });
  }
}

async function checkVisibleErrors(menu, action, screenshot) {
  const text = await bodyText();
  const hit = ERR_PATTERNS.find((re) => re.test(text));
  if (!hit) return;
  const accessRestricted = /access restricted/i.test(text);
  const notFound = /page not found|404/i.test(text);
  if (ADMIN_MENUS.has(menu) || /settings\//i.test(action) || menu === 'Settings') {
    if (accessRestricted) {
      depthStats.adminDeny += 1;
      return;
    }
    if (notFound) {
      addIssue({
        where: `${menu} → ${action}`,
        why: 'Hard navigation yields 404 Page not found (not RoleGate DENY)',
        classification: 'FRONTEND',
        severity: 'HIGH',
        how: 'Wire route or RoleGate DENY / redirect to first allowed path.',
        screenshot,
        network: page.url(),
      });
      return;
    }
  }
  if (accessRestricted && !ADMIN_MENUS.has(menu)) {
    addIssue({
      where: `${menu} → ${action}`,
      why: 'Access restricted on non-admin surface (possible over-restrict or nav leak)',
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Align RoleGate with manager-allowed tabs; hide restricted tabs.',
      screenshot,
      network: page.url(),
    });
  }
}

function classifyAdminAccess(text, url) {
  if (/access restricted|you don.?t have permission|not authorized|forbidden/i.test(text)) return 'DENY';
  if (/page not found|404/i.test(text)) return '404';
  if (url.includes('/login')) return 'REDIRECT_LOGIN';
  if (/create run|run payroll|role matrix|permission matrix|billing plan|statutory pack/i.test(text)) return 'LEAK';
  return 'OPEN';
}

async function gotoMenu(href) {
  await dismissOverlays();
  resetNet();
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(700);
}

async function confirmIfNeeded() {
  const dialog = page.locator('[role="dialog"]').first();
  if (!(await dialog.isVisible().catch(() => false))) return false;
  depthStats.dialogsOpened += 1;
  const ta = dialog.locator('textarea').first();
  if (await ta.isVisible().catch(() => false)) await ta.fill('E2E manager-deep reason').catch(() => {});
  const confirm = dialog.getByRole('button', { name: /^(approve|deny|reject|return|confirm|submit|yes|save|ok)$/i }).first();
  if (await confirm.isVisible().catch(() => false)) {
    const label = ((await confirm.innerText().catch(() => 'confirm')) || 'confirm').trim();
    await confirm.click().catch(() => {});
    await settle(600);
    return label;
  }
  return 'dialog-open';
}

async function clickTarget(menu, target, label, nest) {
  if (totalClicks >= MAX_TOTAL_CLICKS) return null;
  const fp = `${menu}|${nest}|${slug(label)}`;
  if (clickFingerprints.has(fp)) return null;
  clickFingerprints.add(fp);
  totalClicks += 1;
  depthStats.buttonsClicked += 1;
  depthStats.maxNestSeen = Math.max(depthStats.maxNestSeen, nest);
  resetNet();
  await target.click({ timeout: 3500 }).catch(() => {});
  await settle(550);
  const sn = await shot(page, menu, `n${nest}-${label}`, 'clicked');
  await checkVisibleErrors(menu, label, sn);
  recordApiIssues(menu, label, sn);
  if (/export|csv|excel|pdf|download/i.test(label)) depthStats.exportsClicked += 1;
  if (/approve|deny|reject|return/i.test(label)) {
    depthStats.approvalsAttempted += 1;
    const confirmed = await confirmIfNeeded();
    const sn2 = await shot(page, menu, `n${nest}-${label}-result`, confirmed || 'done');
    mutations.push({
      menu,
      action: label,
      nest,
      confirmed,
      screenshot: sn2,
      apis: apiCalls.filter((c) => /approve|reject|deny|return|bulk/i.test(c.url) || ['POST', 'PATCH'].includes(c.method)).slice(0, 8),
    });
    recordApiIssues(menu, `${label}-result`, sn2);
    await dismissOverlays();
    return sn2;
  }
  const dialog = page.locator('[role="dialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    depthStats.dialogsOpened += 1;
    await shot(page, menu, `n${nest}-${label}-modal`, 'open');
    await dismissOverlays();
  }
  return sn;
}

async function exploreTabs(menu, nest = 1) {
  const tabs = page.locator('[role="tab"]');
  const n = Math.min(await tabs.count().catch(() => 0), 10);
  for (let i = 0; i < n; i++) {
    await dismissOverlays();
    resetNet();
    const tab = tabs.nth(i);
    const label = ((await tab.innerText().catch(() => `tab-${i}`)) || `tab-${i}`).trim().slice(0, 40);
    await tab.click().catch(() => {});
    depthStats.tabsClicked += 1;
    await settle(450);
    const sn = await shot(page, menu, `tab-${label}`, 'view');
    await checkVisibleErrors(menu, `tab ${label}`, sn);
    recordApiIssues(menu, `tab ${label}`, sn);
    if (nest < MAX_NEST) await nestClickActions(menu, nest + 1);
  }
}

async function listMainActions() {
  return page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const out = [];
    for (const el of main.querySelectorAll('button, a[href], [role="button"]')) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 55);
      if (!text || /^(ems|skip)/i.test(text)) continue;
      out.push({ text, disabled: !!(el.disabled || el.getAttribute('aria-disabled') === 'true') });
    }
    return out;
  }).catch(() => []);
}

const SKIP = /^(cancel|close|dismiss|×|sign out|log out|collapse|expand)$/i;
const PRIORITY = /approve|deny|reject|return|bulk|export|csv|excel|pdf|download|team|payslip|view|detail|add|new|submit|template|ledger|comp.?off|check/i;

async function nestClickActions(menu, nest, { allowDestructive = false } = {}) {
  if (nest > MAX_NEST || totalClicks >= MAX_TOTAL_CLICKS) return;
  depthStats.nestedLevelsReached = Math.max(depthStats.nestedLevelsReached, nest);
  const actions = await listMainActions();
  const ranked = [
    ...actions.filter((a) => PRIORITY.test(a.text) && !a.disabled),
    ...actions.filter((a) => !PRIORITY.test(a.text) && !a.disabled && !SKIP.test(a.text)),
  ];
  const seen = new Set();
  let clicked = 0;
  const beforeUrl = page.url();
  for (const a of ranked) {
    if (clicked >= MAX_CLICKS_PER_LEVEL || totalClicks >= MAX_TOTAL_CLICKS) break;
    const key = slug(a.text);
    if (seen.has(key) || SKIP.test(a.text)) continue;
    if (!allowDestructive && /delete|remove|archive/i.test(a.text)) continue;
    seen.add(key);
    let target = page.getByRole('button', { name: new RegExp(`^${escapeRe(a.text.slice(0, 40))}$`, 'i') }).first();
    if (!(await target.isVisible().catch(() => false))) {
      target = page.locator('main').locator(`button:has-text("${a.text.slice(0, 24)}"), a:has-text("${a.text.slice(0, 24)}")`).first();
    }
    if (!(await target.isVisible().catch(() => false))) continue;
    await clickTarget(menu, target, a.text, nest);
    clicked += 1;
    if (page.url() !== beforeUrl && /\/(employees|timesheets|leave|payroll)\//i.test(page.url())) {
      depthStats.detailViews += 1;
      await exploreTabs(`${menu}-detail`, nest + 1);
      await nestClickActions(`${menu}-detail`, nest + 1);
      await page.goto(beforeUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(400);
    } else if (page.url() !== beforeUrl) {
      await page.goto(beforeUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(300);
    }
    await dismissOverlays();
  }
}

async function deepLeaveFinish(menu) {
  // Approvals + leave detail focus
  const appr = page.getByRole('tab', { name: /approv/i }).first();
  if (await appr.isVisible().catch(() => false)) {
    await appr.click().catch(() => {});
    await settle(500);
    await shot(page, menu, 'approvals-focus', 'view');
    for (const name of ['Approve', 'Deny', 'Reject']) {
      const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
      if (await btn.isVisible().catch(() => false)) await clickTarget(menu, btn, `leave-${name}`, 2);
      await dismissOverlays();
    }
  }
  const my = page.getByRole('tab', { name: /my request/i }).first();
  if (await my.isVisible().catch(() => false)) {
    await my.click().catch(() => {});
    await settle(500);
    const row = page.locator('main tr, main a').filter({ hasText: /pending|approved|denied|earned|sick|casual|annual/i }).first();
    if (await row.isVisible().catch(() => false)) {
      await row.click().catch(() => {});
      await settle(600);
      depthStats.detailViews += 1;
      const sn = await shot(page, menu, 'leave-detail', 'view');
      recordApiIssues(menu, 'leave-detail', sn);
      await nestClickActions('leave-detail', 2);
      for (const name of ['Approve', 'Deny', 'Withdraw']) {
        const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
        if (await btn.isVisible().catch(() => false)) await clickTarget('leave-detail', btn, name, 3);
      }
    }
  }
  await nestClickActions(menu, 1);
}

async function deepPayroll(menu) {
  await exploreTabs(menu, 1);
  await nestClickActions(menu, 1);
  const slip = page.locator('main tr, main button, main a').filter({ hasText: /2026|payslip|net|₹|INR|jul|aug/i }).first();
  if (await slip.isVisible().catch(() => false)) {
    await slip.click().catch(() => {});
    await settle(650);
    depthStats.detailViews += 1;
    const sn = await shot(page, menu, 'payslip-detail', 'view');
    const t = await bodyText();
    if (/senior engineer\s*20\d{2}-\d{2}-\d{2}/i.test(t) || /designation[^\n]{0,40}20\d{2}-\d{2}-\d{2}/i.test(t)) {
      addIssue({
        where: 'Payroll → payslip detail → Designation',
        why: 'Designation displays concatenated date (e.g. Senior Engineer 2026-07-02)',
        classification: 'FRONTEND',
        severity: 'MEDIUM',
        how: 'Separate designation vs effective-date in display mapper.',
        screenshot: sn,
        network: 'n/a',
      });
    }
    await nestClickActions('payslip-detail', 2);
    await dismissOverlays();
  }
  const createRun = page.getByRole('button', { name: /create run|run payroll|new run/i }).first();
  if (await createRun.isVisible().catch(() => false)) {
    const sn = await shot(page, menu, 'create-run-visible', 'leak');
    depthStats.adminLeak += 1;
    addIssue({
      where: 'Payroll → Create Run',
      why: 'Admin payroll Create Run visible to MANAGER',
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Hide payroll-run admin controls for MANAGER.',
      screenshot: sn,
      network: 'n/a',
    });
  }
}

async function deepPayout(menu) {
  await exploreTabs(menu, 1);
  await nestClickActions(menu, 1);
  await page.goto(`${FE}/payout-methods/approvals`, { waitUntil: 'domcontentloaded' });
  await settle(600);
  const sn = await shot(page, menu, 'approvals', 'view');
  await checkVisibleErrors(menu, 'approvals', sn);
  for (const name of ['Approve', 'Deny', 'Reject']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
    if (await btn.isVisible().catch(() => false)) await clickTarget(menu, btn, `payout-${name}`, 2);
  }
}

async function deepAdmin(menu) {
  const text = await bodyText();
  const access = classifyAdminAccess(text, page.url());
  const sn = await shot(page, menu, 'access-state', access.toLowerCase());
  if (access === 'DENY') depthStats.adminDeny += 1;
  else if (access === 'LEAK') {
    depthStats.adminLeak += 1;
    addIssue({
      where: menu,
      why: `Admin content LEAK for MANAGER (access=${access})`,
      classification: 'FRONTEND',
      severity: 'CRITICAL',
      how: 'RoleGate DENY + hide sidebar item.',
      screenshot: sn,
      network: page.url(),
    });
  } else if (access === '404') {
    addIssue({
      where: menu,
      why: 'Admin deep-link is 404 instead of RoleGate DENY',
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Return Access restricted, not Next 404.',
      screenshot: sn,
      network: page.url(),
    });
  } else if (access === 'OPEN' && ADMIN_MENUS.has(menu)) {
    addIssue({
      where: `${menu} sidebar`,
      why: `MANAGER sidebar shows ${menu}; deep-link OPEN (expected DENY / hide nav)`,
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Filter NAV_ITEMS by memberType; keep RoleGate DENY.',
      screenshot: sn,
      network: page.url(),
    });
  }
  await exploreTabs(menu, 1);
  await nestClickActions(menu, 1);
}

async function deepSettings(menu) {
  await shot(page, menu, 'landing', 'view');
  await nestClickActions(menu, 1);
  for (const href of SETTINGS_ROUTES) {
    await dismissOverlays();
    resetNet();
    try {
      await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch {
      await shot(page, menu, href.replace(/\//g, '-'), 'timeout');
      continue;
    }
    await settle(450);
    const text = await bodyText();
    const access = classifyAdminAccess(text, page.url());
    const sn = await shot(page, menu, href.replace(/\//g, '-').replace(/^-/, ''), access.toLowerCase());
    if (access === 'DENY') depthStats.adminDeny += 1;
    if (access === '404') {
      addIssue({
        where: `${menu} → ${href}`,
        why: '404 Page not found (not RoleGate DENY)',
        classification: 'FRONTEND',
        severity: 'HIGH',
        how: 'Wire route or redirect unauthorized settings slug.',
        screenshot: sn,
        network: page.url(),
      });
    }
    if (access === 'LEAK') {
      depthStats.adminLeak += 1;
      addIssue({
        where: `${menu} → ${href}`,
        why: 'Privileged settings LEAK to MANAGER',
        classification: 'FRONTEND',
        severity: 'CRITICAL',
        how: 'Enforce RoleGate DENY.',
        screenshot: sn,
        network: page.url(),
      });
    }
    recordApiIssues(menu, href, sn);
    if (access === 'OPEN') await nestClickActions(slug(href), 2);
  }
}

async function deepGeneric(menu) {
  await exploreTabs(menu, 1);
  await nestClickActions(menu, 1);
}

const DEEP = {
  'leave-finish': deepLeaveFinish,
  payroll: deepPayroll,
  payout: deepPayout,
  admin: deepAdmin,
  settings: deepSettings,
  generic: deepGeneric,
};

console.log(`=== RESUME MANAGER deep (from shot ${shotIdx}) ===`);
await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('#email', { state: 'visible' });
await page.locator('#email').fill(USER);
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
await settle(1800);
if (page.url().includes('/login')) {
  console.error('LOGIN FAILED');
  process.exit(1);
}
await shot(page, 'resume', 'login', 'ok');

for (const item of MENUS) {
  console.log(`\n=== MENU: ${item.label} ===`);
  try {
    await gotoMenu(item.href);
    depthStats.menusLanded += 1;
    const sn = await shot(page, item.label, 'land', 'view');
    await checkVisibleErrors(item.label, 'land', sn);
    recordApiIssues(item.label, 'land', sn);
    const text = await bodyText();
    const access = classifyAdminAccess(text, page.url());
    menuResults.push({ menu: item.label, href: item.href, url: page.url(), access });
    const fn = DEEP[item.deep] || deepGeneric;
    await fn(item.label);
    await dismissOverlays();
  } catch (e) {
    console.error(`Menu ${item.label} error:`, String(e).slice(0, 200));
    await shot(page, item.label, 'error', 'crash').catch(() => {});
  }
}

console.log('\n=== ADMIN DEEP-LINK MATRIX ===');
const deepLinkResults = [];
for (const href of ADMIN_DEEP_LINKS) {
  try {
    await dismissOverlays();
    resetNet();
    await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded' });
    await settle(500);
    const text = await bodyText();
    const access = classifyAdminAccess(text, page.url());
    const sn = await shot(page, 'admin-deeplink', href.replace(/\//g, '-').replace(/^-/, ''), access.toLowerCase());
    deepLinkResults.push({ href, url: page.url(), access, screenshot: sn });
    if (access === 'DENY') depthStats.adminDeny += 1;
    if (access === 'LEAK') {
      depthStats.adminLeak += 1;
      addIssue({
        where: `Deep-link ${href}`,
        why: 'MANAGER can access admin UI content (LEAK)',
        classification: 'FRONTEND',
        severity: 'CRITICAL',
        how: 'Enforce RoleGate DENY on deep links.',
        screenshot: sn,
        network: page.url(),
      });
    }
    if (access === '404') {
      addIssue({
        where: `Deep-link ${href}`,
        why: '404 instead of RoleGate DENY',
        classification: 'FRONTEND',
        severity: 'HIGH',
        how: 'Wire route or RoleGate page.',
        screenshot: sn,
        network: page.url(),
      });
    }
  } catch (e) {
    console.error('deeplink err', href, String(e).slice(0, 100));
  }
}

console.log('\n=== SHELL EXTRAS ===');
try {
  await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await settle(400);
  const bell = page.locator('button[aria-label*="Notification" i]').first();
  if (await bell.isVisible().catch(() => false)) {
    await bell.click().catch(() => {});
    await settle(400);
    await shot(page, 'shell', 'notifications', 'open');
    const mark = page.getByRole('button', { name: /mark.*read|mark all/i }).first();
    if (await mark.isVisible().catch(() => false)) await clickTarget('shell', mark, 'mark-read', 1);
    await dismissOverlays();
  }
  // profile / settings self
  await page.goto(`${FE}/settings/sessions`, { waitUntil: 'domcontentloaded' });
  await settle(500);
  await shot(page, 'shell', 'settings-sessions', classifyAdminAccess(await bodyText(), page.url()).toLowerCase());
  await page.goto(`${FE}/settings/notifications`, { waitUntil: 'domcontentloaded' });
  await settle(500);
  await shot(page, 'shell', 'settings-notifications', 'view');
} catch (e) {
  console.error('shell extras', String(e).slice(0, 120));
}

const summary = {
  role: 'MANAGER',
  phase: 'resume',
  user: USER,
  fe: FE,
  totalClicks,
  depthStats,
  menusTested: menuResults.map((m) => m.menu),
  menuCount: menuResults.length,
  screenshotCountNew: screenshots.length,
  screenshotCountTotal: shotIdx,
  issueCount: issues.length,
  backendIssues: issues.filter((i) => i.classification === 'BACKEND').length,
  frontendIssues: issues.filter((i) => i.classification === 'FRONTEND').length,
  criticalIssues: issues.filter((i) => i.severity === 'CRITICAL').length,
  highIssues: issues.filter((i) => i.severity === 'HIGH').length,
  mutations,
  deepLinkResults,
  issues,
  menuResults,
  screenshots,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(SHOT, 'results-resume.json'), JSON.stringify(summary, null, 2));
console.log(
  `\n==== RESUME DONE menus=${summary.menuCount} newShots=${summary.screenshotCountNew} totalShots=${shotIdx} clicks=${totalClicks} issues=${summary.issueCount} deny=${depthStats.adminDeny} leak=${depthStats.adminLeak} ====`,
);
await browser.close().catch(() => {});
