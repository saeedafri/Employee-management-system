/**
 * FULL-DEPTH MANAGER UI E2E — Playwright Chromium (FE :3001 → BE :4000).
 * Nested: every sidebar parent → every tab → every inner button/link/dialog
 * up to MAX_NEST depth. Approvals Approve/Return/Deny + bulk actions exercised.
 * Screenshots → docs/e2e-ui-screenshots/manager-deep/
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const SHOT =
  process.env.SHOT_DIR ||
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/manager-deep';
const USER = process.env.QA_EMAIL || 'aman@acme.test';
const PASS = process.env.QA_PASS || 'Password123!';
const MAX_NEST = Number(process.env.MAX_NEST || 4);
const MAX_CLICKS_PER_LEVEL = Number(process.env.MAX_CLICKS_PER_LEVEL || 28);
const MAX_TOTAL_CLICKS = Number(process.env.MAX_TOTAL_CLICKS || 420);

fs.mkdirSync(SHOT, { recursive: true });
for (const f of fs.readdirSync(SHOT)) {
  if (f.endsWith('.png') || f === 'results.json' || f === 'nav-items.json') {
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
  /\bunauthorized\b/i,
  /not authorized/i,
  /page not found/i,
  /404/i,
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

let shotIdx = 0;
let totalClicks = 0;
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

async function shot(page, menu, action, result = 'ok') {
  shotIdx += 1;
  const name = `${String(shotIdx).padStart(3, '0')}-${slug(menu)}-${slug(action)}-${slug(result)}.png`;
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false }).catch(() => {});
  screenshots.push({ name, menu, action, result, url: page.url() });
  console.log(`  📸 ${name}`);
  return name;
}

function addIssue({ where, why, classification, how, screenshot, network, console: cons, severity }) {
  const key = `${classification}|${where}|${why}`;
  if (seenIssueKeys.has(key)) return null;
  seenIssueKeys.add(key);
  const id = `ISSUE-MGR-DEEP-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = {
    id,
    where,
    why,
    classification,
    how,
    screenshot,
    network,
    console: cons || [],
    severity: severity || 'MEDIUM',
  };
  issues.push(issue);
  console.log(`  🐛 ${id} [${classification}/${issue.severity}] ${where}: ${why}`);
  return issue;
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() =>
  chromium.launch({ headless: true }),
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(90000);
page.setDefaultTimeout(12000);

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
  apiCalls.push({
    url: u.replace(/https?:\/\/[^/]+/, ''),
    status,
    method: res.request().method(),
    bodySnippet,
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
async function settle(ms = 650) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}
async function bodyText() {
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

async function dismissOverlays() {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(120);
  }
  const cancel = page.getByRole('button', { name: /^(cancel|close|dismiss|×)$/i }).first();
  if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
  await page.mouse.click(8, 8).catch(() => {});
  await page.waitForTimeout(100);
}

function recordApiIssues(menu, action, screenshot) {
  for (const f of failApis()) {
    if (menu === 'login' && /\/api\/auth\/(me|refresh)/.test(f.url)) continue;
    // Expected self-approval forbid is a known FE bug — still record once
    const net = `${f.status} ${f.method} ${f.url}` + (f.bodySnippet ? ` | ${f.bodySnippet}` : '');
    let classification = 'BACKEND';
    let severity = 'MEDIUM';
    if (f.status === 401 || f.status === 422) classification = 'FRONTEND';
    if (f.status === 403 && /SELF_APPROVAL_FORBIDDEN/i.test(f.bodySnippet)) {
      classification = 'FRONTEND';
      severity = 'CRITICAL';
    }
    if (f.status === 403 && /FORBIDDEN|permission/i.test(f.bodySnippet) && !/SELF_APPROVAL/i.test(f.bodySnippet)) {
      classification = 'BACKEND';
    }
    if (f.status >= 500) {
      classification = 'BACKEND';
      severity = 'HIGH';
    }
    if (f.status === 404) {
      classification = /settings|roles-permissions/i.test(f.url) ? 'FRONTEND' : 'BACKEND';
    }
    addIssue({
      where: `${menu} → ${action}`,
      why: `API ${f.status} ${f.method} ${f.url}`,
      classification,
      severity,
      how:
        classification === 'BACKEND'
          ? 'Fix backend contract/status for MANAGER role; return usable empty payloads where appropriate.'
          : 'Fix frontend request wiring / hide actions that will 403 / map errors to empty states.',
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
  const accessRestricted = /access restricted/i.test(text);
  const notFound = /page not found|404/i.test(text);
  const strong =
    /something went wrong|error boundary|access restricted|failed to load|internal server|page not found/i.test(
      text,
    ) || failApis().length > 0;
  if (!strong && hit.source === '\\bunauthorized\\b') return;

  if (ADMIN_MENUS.has(menu) || /admin|settings\//i.test(menu)) {
    if (accessRestricted) {
      depthStats.adminDeny += 1;
      return; // expected DENY — not an issue unless also leaked data
    }
    if (notFound) {
      addIssue({
        where: `${menu} → ${action}`,
        why: 'Hard navigation yields 404 Page not found (not RoleGate DENY)',
        classification: 'FRONTEND',
        severity: 'HIGH',
        how: 'Wire the route or redirect; MANAGER should get RoleGate DENY or first-allowed path, not bare 404.',
        screenshot,
        network: page.url(),
      });
      return;
    }
  }

  addIssue({
    where: `${menu} → ${action}`,
    why: `Visible error pattern: /${hit.source}/`,
    classification: failApis().some((f) => f.status >= 500) ? 'BACKEND' : 'FRONTEND',
    severity: accessRestricted && !ADMIN_MENUS.has(menu) ? 'HIGH' : 'MEDIUM',
    how: 'Resolve underlying failure; show role-aware empty/error state instead of broken UI.',
    screenshot,
    network: failApis()
      .slice(0, 6)
      .map((f) => `${f.status} ${f.method} ${f.url}`)
      .join('; '),
    console: consoleErrors.slice(0, 5),
  });
}

function classifyAdminAccess(text, url) {
  if (/access restricted|you don.?t have permission|not authorized|forbidden/i.test(text)) {
    return 'DENY';
  }
  if (/page not found|404/i.test(text)) return '404';
  if (url.includes('/login')) return 'REDIRECT_LOGIN';
  // Heuristic leak: admin-only UI chrome present
  if (
    /create run|run payroll|role matrix|permission matrix|billing|statutory pack|legal entit/i.test(
      text,
    )
  ) {
    return 'LEAK';
  }
  return 'OPEN';
}

async function gotoMenu(href, label) {
  await dismissOverlays();
  resetNet();
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await settle(850);
  const okHard = page.url().includes(href.split('?')[0]);
  if (!okHard && !ADMIN_MENUS.has(label)) {
    const sn = await shot(page, label, 'goto', 'wrong-url');
    addIssue({
      where: label,
      why: `Hard navigation to ${href} landed on ${page.url()}`,
      classification: 'FRONTEND',
      how: 'Fix route guard / redirect logic for MANAGER.',
      screenshot: sn,
      network: page.url(),
    });
  }

  const side = page.locator(`nav[aria-label="Main navigation"] a[href="${href}"]`).first();
  if (await side.isVisible().catch(() => false)) {
    if (href !== '/dashboard') {
      await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(400);
      await dismissOverlays();
    }
    resetNet();
    await side.click().catch(() => {});
    await settle(800);
    if (!page.url().includes(href.split('?')[0])) {
      await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded' });
      await settle(700);
    }
  }
}

async function confirmIfNeeded() {
  const dialog = page.locator('[role="dialog"]').first();
  if (!(await dialog.isVisible().catch(() => false))) return false;
  depthStats.dialogsOpened += 1;
  const confirm = dialog
    .getByRole('button', {
      name: /^(approve|deny|reject|return|confirm|submit|yes|save|apply|continue|ok)$/i,
    })
    .first();
  if (await confirm.isVisible().catch(() => false)) {
    const label = ((await confirm.innerText().catch(() => 'confirm')) || 'confirm').trim();
    // Prefer filling deny reason if textarea present
    const ta = dialog.locator('textarea').first();
    if (await ta.isVisible().catch(() => false)) {
      await ta.fill('E2E manager-deep automated reason').catch(() => {});
    }
    await confirm.click().catch(() => {});
    await settle(700);
    return label;
  }
  return 'dialog-open';
}

async function clickTarget(menu, target, label, nest) {
  if (totalClicks >= MAX_TOTAL_CLICKS) return null;
  const fp = `${menu}|${nest}|${slug(label)}|${page.url()}`;
  if (clickFingerprints.has(fp)) return null;
  clickFingerprints.add(fp);
  totalClicks += 1;
  depthStats.buttonsClicked += 1;
  depthStats.maxNestSeen = Math.max(depthStats.maxNestSeen, nest);
  depthStats.nestedLevelsReached = Math.max(depthStats.nestedLevelsReached, nest);
  resetNet();
  await target.click({ timeout: 4000 }).catch(() => {});
  await settle(650);
  const sn = await shot(page, menu, `n${nest}-${label}`, 'clicked');
  await checkVisibleErrors(menu, label, sn);
  recordApiIssues(menu, label, sn);

  if (/export|csv|excel|pdf|download/i.test(label)) depthStats.exportsClicked += 1;
  if (/approve|deny|reject|return/i.test(label)) {
    depthStats.approvalsAttempted += 1;
    const confirmed = await confirmIfNeeded();
    const sn2 = await shot(page, menu, `n${nest}-${label}-result`, confirmed || 'done');
    const mutApis = apiCalls.filter(
      (c) =>
        /approve|reject|deny|return|bulk/i.test(c.url) ||
        (['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.method) && c.status < 500),
    );
    mutations.push({
      menu,
      action: label,
      nest,
      confirmed,
      screenshot: sn2,
      apis: mutApis.slice(0, 8),
    });
    recordApiIssues(menu, `${label}-result`, sn2);
    await dismissOverlays();
    return sn2;
  }

  const dialog = page.locator('[role="dialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    depthStats.dialogsOpened += 1;
    await shot(page, menu, `n${nest}-${label}-modal`, 'open');
    // Dive into dialog buttons one level
    if (nest < MAX_NEST) {
      const dBtns = dialog.locator('button:visible');
      const dn = Math.min(await dBtns.count().catch(() => 0), 8);
      for (let i = 0; i < dn; i++) {
        const b = dBtns.nth(i);
        const t = ((await b.innerText().catch(() => '')) || '').trim().slice(0, 40);
        if (!t || /cancel|close|dismiss|×/i.test(t)) continue;
        if (/approve|deny|reject|return|confirm|submit|bulk/i.test(t)) {
          await clickTarget(menu, b, `dlg-${t}`, nest + 1);
        }
      }
    }
    await dismissOverlays();
  }
  return sn;
}

async function exploreTabs(menu, nest = 1) {
  const tabs = page.locator('[role="tab"]');
  const n = Math.min(await tabs.count().catch(() => 0), 12);
  for (let i = 0; i < n; i++) {
    await dismissOverlays();
    resetNet();
    const tab = tabs.nth(i);
    const label = ((await tab.innerText().catch(() => `tab-${i}`)) || `tab-${i}`).trim().slice(0, 40);
    await tab.click().catch(() => {});
    depthStats.tabsClicked += 1;
    await settle(550);
    const sn = await shot(page, menu, `tab-${label}`, 'view');
    await checkVisibleErrors(menu, `tab ${label}`, sn);
    recordApiIssues(menu, `tab ${label}`, sn);
    // Nested: click actions inside this tab
    if (nest < MAX_NEST) {
      await nestClickActions(menu, nest + 1, { scope: 'main' });
    }
  }
}

async function exploreFilters(menu) {
  await dismissOverlays();
  const combos = page.locator('main button[role="combobox"], main [aria-haspopup="listbox"]');
  const cn = Math.min(await combos.count().catch(() => 0), 4);
  for (let i = 0; i < cn; i++) {
    const combo = combos.nth(i);
    if (!(await combo.isVisible().catch(() => false))) continue;
    resetNet();
    await combo.click().catch(() => {});
    await page.waitForTimeout(250);
    await shot(page, menu, `filter-${i}-open`, 'open');
    const opt = page.locator('[role="option"]').nth(1);
    if (await opt.isVisible().catch(() => false)) {
      await opt.click().catch(() => {});
      await settle(450);
      const sn = await shot(page, menu, `filter-${i}-applied`, 'applied');
      recordApiIssues(menu, 'filter', sn);
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await dismissOverlays();
  }
  const search = page.locator('main input[type="search"], main input[placeholder*="Search" i]').first();
  if (await search.isVisible().catch(() => false)) {
    resetNet();
    await search.fill('a').catch(() => {});
    await settle(450);
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
    await settle(500);
    const sn = await shot(page, menu, 'pagination-next', 'page2');
    recordApiIssues(menu, 'pagination', sn);
    const prev = page.locator('main').getByRole('button', { name: /prev|previous/i }).first();
    if (await prev.isVisible().catch(() => false)) await prev.click().catch(() => {});
    await settle(250);
  }
}

async function listMainActions() {
  return page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const out = [];
    const nodes = main.querySelectorAll('button, a[href], [role="button"]');
    for (const el of nodes) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 4 || rect.height < 4) continue;
      const text = (el.getAttribute('aria-label') || el.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60);
      if (!text) continue;
      if (/^(ems|skip to)/i.test(text)) continue;
      const tag = el.tagName.toLowerCase();
      const href = el.getAttribute('href') || '';
      out.push({ text, tag, href, disabled: !!(el.disabled || el.getAttribute('aria-disabled') === 'true') });
    }
    return out;
  });
}

const SKIP_LABELS =
  /^(cancel|close|dismiss|×|back to|sign out|log out|collapse|expand|toggle|emoji|copy)$/i;
const PRIORITY =
  /approve|deny|reject|return|bulk|export|csv|excel|pdf|download|detail|view|team|check.?in|check.?out|regulariz|submit|template|my |new request|request leave|add entry|log time|payslip|tax|filter|week|month|calendar|table|list|delegation|pending|confirm/i;

async function nestClickActions(menu, nest, { scope = 'main', allowDestructive = true } = {}) {
  if (nest > MAX_NEST || totalClicks >= MAX_TOTAL_CLICKS) return;
  depthStats.nestedLevelsReached = Math.max(depthStats.nestedLevelsReached, nest);

  const actions = await listMainActions();
  // Prioritize approval/export/detail actions, then others
  const ranked = [
    ...actions.filter((a) => PRIORITY.test(a.text) && !a.disabled),
    ...actions.filter((a) => !PRIORITY.test(a.text) && !a.disabled && !SKIP_LABELS.test(a.text)),
  ];
  const seen = new Set();
  let clicked = 0;
  for (const a of ranked) {
    if (clicked >= MAX_CLICKS_PER_LEVEL || totalClicks >= MAX_TOTAL_CLICKS) break;
    const key = slug(a.text);
    if (seen.has(key)) continue;
    seen.add(key);
    if (SKIP_LABELS.test(a.text)) continue;
    if (!allowDestructive && /delete|remove|archive|terminate/i.test(a.text)) continue;

    // Prefer role button/link by name
    let target = page.getByRole('button', { name: new RegExp(`^${escapeRe(a.text.slice(0, 40))}$`, 'i') }).first();
    if (!(await target.isVisible().catch(() => false))) {
      target = page.getByRole('link', { name: new RegExp(escapeRe(a.text.slice(0, 40)), 'i') }).first();
    }
    if (!(await target.isVisible().catch(() => false))) {
      target = page.locator('main').locator(`button:has-text("${a.text.slice(0, 28)}"), a:has-text("${a.text.slice(0, 28)}")`).first();
    }
    if (!(await target.isVisible().catch(() => false))) continue;

    const beforeUrl = page.url();
    await clickTarget(menu, target, a.text, nest);
    clicked += 1;

    // If navigated to detail, explore nested then go back
    if (page.url() !== beforeUrl && /\/(employees|timesheets|leave|payroll|attendance)\//i.test(page.url())) {
      depthStats.detailViews += 1;
      depthStats.linksClicked += 1;
      await exploreTabs(`${menu}-detail`, nest + 1);
      await nestClickActions(`${menu}-detail`, nest + 1, { allowDestructive: false });
      await page.goto(beforeUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(500);
    } else if (page.url() !== beforeUrl && !page.url().includes(beforeUrl.split('?')[0].replace(/\/$/, ''))) {
      // bounced elsewhere — return
      await page.goto(beforeUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(400);
    }
    await dismissOverlays();
  }
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function deepDashboard(menu) {
  await shot(page, menu, 'land-full', 'view');
  // Capture zero-attendance anomaly if present
  const text = await bodyText();
  if (/present today\s*0/i.test(text) && /avg\.?\s*attendance\s*0%/i.test(text)) {
    const sn = await shot(page, menu, 'zero-attendance-anomaly', 'observed');
    addIssue({
      where: 'Dashboard → Team Attendance',
      why: 'Present Today = 0 / Avg. Attendance = 0% while team week grid shows all Absent (A)',
      classification: 'BACKEND',
      severity: 'MEDIUM',
      how: 'Verify weekStart timezone + team weekly aggregation; ensure today check-ins roll up.',
      screenshot: sn,
      network: apiCalls
        .filter((c) => /attendance|weekly|team/i.test(c.url))
        .slice(0, 4)
        .map((c) => `${c.status} ${c.method} ${c.url}`)
        .join('; '),
    });
  }

  // Bulk approve first (document leave-vs-reg mismatch)
  const bulk = page.getByRole('button', { name: /bulk approve/i }).first();
  if (await bulk.isVisible().catch(() => false)) {
    resetNet();
    await bulk.click().catch(() => {});
    await settle(600);
    const sn = await shot(page, menu, 'bulk-approve', 'open');
    const t = await bodyText();
    if (/no pending leave|bulk approve leave/i.test(t) && /reg/i.test(text)) {
      addIssue({
        where: 'Dashboard → Bulk approve',
        why: 'Bulk approve opens Leave modal empty while Pending Approvals are regularizations',
        classification: 'FRONTEND',
        severity: 'HIGH',
        how: 'Bulk-approve regularization queue, or rename/split leave vs regularization bulk actions.',
        screenshot: sn,
        network: 'n/a',
      });
    }
    await confirmIfNeeded();
    await dismissOverlays();
  }

  // Click Approve / Deny on pending items (mutate)
  for (const name of ['Deny', 'Approve']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
    if (await btn.isVisible().catch(() => false)) {
      await clickTarget(menu, btn, name, 1);
      await dismissOverlays();
    }
  }

  await exploreFilters(menu);
  await nestClickActions(menu, 1);
  // Quick links
  for (const linkName of [/view team/i, /leave/i, /attendance/i, /approvals/i, /pending/i]) {
    const link = page.locator('main').getByRole('link', { name: linkName }).first();
    if (await link.isVisible().catch(() => false)) {
      const href = await link.getAttribute('href').catch(() => '');
      resetNet();
      await link.click().catch(() => {});
      await settle(700);
      const sn = await shot(page, menu, `link-${slug(String(linkName))}`, 'nav');
      recordApiIssues(menu, `link ${href}`, sn);
      await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
      await settle(400);
    }
  }
}

async function deepEmployees(menu) {
  await exploreFilters(menu);
  await explorePagination(menu);
  await nestClickActions(menu, 1, { allowDestructive: false });
  const row = page.locator('main a[href*="/employees/"]').first();
  if (await row.isVisible().catch(() => false)) {
    resetNet();
    await row.click();
    await settle(900);
    depthStats.detailViews += 1;
    const sn = await shot(page, menu, 'employee-detail', 'view');
    await checkVisibleErrors(menu, 'employee-detail', sn);
    recordApiIssues(menu, 'employee-detail', sn);
    await exploreTabs('employee-detail', 2);
    await nestClickActions('employee-detail', 2, { allowDestructive: false });
    // Add Employee should NOT be available for manager — document if present
    await page.goto(`${FE}/employees`, { waitUntil: 'domcontentloaded' });
    await settle(400);
  }
  const add = page.getByRole('button', { name: /add employee/i }).first();
  if (await add.isVisible().catch(() => false)) {
    const sn = await shot(page, menu, 'add-employee-visible', 'leak-check');
    addIssue({
      where: 'Employees → Add Employee',
      why: 'Add Employee control visible to MANAGER (possible privilege leak)',
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Hide Add Employee for MANAGER; keep HR_ADMIN/SUPER_ADMIN only.',
      screenshot: sn,
      network: 'n/a',
    });
    depthStats.adminLeak += 1;
  }
}

async function deepDepartments(menu) {
  await nestClickActions(menu, 1, { allowDestructive: false });
  const item = page
    .locator('main button, main [role="treeitem"], main li')
    .filter({ hasText: /Engineering|Customer Success|HR|Finance|Product/i })
    .first();
  if (await item.isVisible().catch(() => false)) {
    resetNet();
    await item.click().catch(() => {});
    await settle(600);
    const sn = await shot(page, menu, 'select-department', 'view');
    recordApiIssues(menu, 'select-department', sn);
    await nestClickActions(menu, 2, { allowDestructive: false });
  }
}

async function deepAttendance(menu) {
  await exploreTabs(menu, 1);
  await exploreFilters(menu);
  // Explicit check-in / check-out
  for (const name of ['Check In', 'Check Out', 'Request Regularization', 'Regularization']) {
    const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first();
    if (await btn.isVisible().catch(() => false)) {
      await clickTarget(menu, btn, name, 1);
      await dismissOverlays();
    }
  }
  // Team view
  const teamTab = page.getByRole('tab', { name: /team/i }).first();
  if (await teamTab.isVisible().catch(() => false)) {
    await teamTab.click().catch(() => {});
    await settle(600);
    await shot(page, menu, 'team-view', 'view');
    await nestClickActions(menu, 2);
  }
  // Regularization approve/deny if in team/reg tab
  for (const name of ['Approve', 'Deny', 'Reject']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
    if (await btn.isVisible().catch(() => false)) {
      await clickTarget(menu, btn, `reg-${name}`, 2);
      await dismissOverlays();
    }
  }
  await nestClickActions(menu, 1);
}

async function deepTimesheets(menu) {
  await exploreTabs(menu, 1);
  await exploreFilters(menu);

  // Approvals tab — full nest
  const appr = page.getByRole('tab', { name: /approv/i }).first();
  if (await appr.isVisible().catch(() => false)) {
    await appr.click().catch(() => {});
    await settle(700);
    const sn = await shot(page, menu, 'approvals-view', 'view');
    const t = await bodyText();
    if (/progress/i.test(t) && !/\d+\s*%|●|█/.test(t)) {
      addIssue({
        where: 'Timesheets → Approvals → PROGRESS',
        why: 'PROGRESS column appears empty for approval rows',
        classification: 'FRONTEND',
        severity: 'MEDIUM',
        how: 'Render progress from API or hide column until data exists.',
        screenshot: sn,
        network: 'n/a',
      });
    }
    // Row-level Approve / Return — click ALL visible (incl. own → expect 403)
    for (let round = 0; round < 4; round++) {
      const approve = page.getByRole('button', { name: /^approve$/i }).nth(round === 0 ? 0 : 0);
      if (!(await approve.isVisible().catch(() => false))) break;
      await clickTarget(menu, approve, `approve-row-${round}`, 2);
      await dismissOverlays();
      // re-open approvals
      const appr2 = page.getByRole('tab', { name: /approv/i }).first();
      if (await appr2.isVisible().catch(() => false)) {
        await appr2.click().catch(() => {});
        await settle(400);
      }
    }
    const ret = page.getByRole('button', { name: /^return$/i }).first();
    if (await ret.isVisible().catch(() => false)) {
      await clickTarget(menu, ret, 'return-row', 2);
      await dismissOverlays();
    }
  }

  // My timesheet + detail
  const mine = page.getByRole('tab', { name: /my/i }).first();
  if (await mine.isVisible().catch(() => false)) {
    await mine.click().catch(() => {});
    await settle(600);
    await shot(page, menu, 'my-timesheet', 'view');
    await nestClickActions(menu, 2);
    // Open week/detail row
    const weekLink = page.locator('main a[href*="/timesheets"], main tr, main [data-row]').first();
    if (await weekLink.isVisible().catch(() => false)) {
      await weekLink.click().catch(() => {});
      await settle(700);
      depthStats.detailViews += 1;
      await shot(page, menu, 'timesheet-detail', 'view');
      await nestClickActions('timesheet-detail', 3);
      await exploreTabs('timesheet-detail', 3);
    }
  }

  // Templates / Delegation
  for (const tabName of [/template/i, /delegat/i, /team/i]) {
    const tab = page.getByRole('tab', { name: tabName }).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click().catch(() => {});
      await settle(500);
      await shot(page, menu, `tab-${slug(String(tabName))}`, 'view');
      await nestClickActions(menu, 2);
    }
  }

  await nestClickActions(menu, 1);
}

async function deepLeave(menu) {
  await exploreTabs(menu, 1);
  await exploreFilters(menu);

  // Approvals
  const appr = page.getByRole('tab', { name: /approv/i }).first();
  if (await appr.isVisible().catch(() => false)) {
    await appr.click().catch(() => {});
    await settle(600);
    await shot(page, menu, 'approvals-tab', 'view');
    for (const name of ['Approve', 'Deny', 'Reject', 'Return']) {
      const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
      if (await btn.isVisible().catch(() => false)) {
        await clickTarget(menu, btn, `leave-${name}`, 2);
        await dismissOverlays();
      }
    }
  }

  // Team / Calendar
  for (const tabName of [/team/i, /calendar/i, /comp.?off/i, /my/i, /balance/i, /request/i]) {
    const tab = page.getByRole('tab', { name: tabName }).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click().catch(() => {});
      await settle(500);
      await shot(page, menu, `tab-${slug(String(tabName))}`, 'view');
      await nestClickActions(menu, 2);
    }
  }

  // Leave detail row
  const detail = page.locator('main a[href*="/leave"], main tr').filter({ hasText: /pending|approved|denied|annual|earned|sick|casual/i }).first();
  if (await detail.isVisible().catch(() => false)) {
    await detail.click().catch(() => {});
    await settle(700);
    depthStats.detailViews += 1;
    const sn = await shot(page, menu, 'leave-detail', 'view');
    recordApiIssues(menu, 'leave-detail', sn);
    await nestClickActions('leave-detail', 3);
    // Approve/Deny inside detail
    for (const name of ['Approve', 'Deny', 'Reject', 'Withdraw']) {
      const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
      if (await btn.isVisible().catch(() => false)) {
        await clickTarget('leave-detail', btn, name, 3);
        await dismissOverlays();
      }
    }
  }

  // New request (open+cancel unless fills easily)
  const nr = page.getByRole('button', { name: /new request|request leave|apply leave/i }).first();
  if (await nr.isVisible().catch(() => false)) {
    await clickTarget(menu, nr, 'new-request', 1);
    await dismissOverlays();
  }

  await nestClickActions(menu, 1);
}

async function deepHolidays(menu) {
  await exploreTabs(menu, 1);
  await nestClickActions(menu, 1, { allowDestructive: false });
}

async function deepPayroll(menu) {
  await exploreTabs(menu, 1);
  await exploreFilters(menu);
  await nestClickActions(menu, 1, { allowDestructive: false });
  // Payslip detail
  const slip = page.locator('main tr, main button, main a').filter({ hasText: /2026|payslip|net pay|₹|INR/i }).first();
  if (await slip.isVisible().catch(() => false)) {
    await slip.click().catch(() => {});
    await settle(700);
    depthStats.detailViews += 1;
    const sn = await shot(page, menu, 'payslip-detail', 'view');
    const t = await bodyText();
    if (/senior engineer\s*20\d{2}-\d{2}-\d{2}/i.test(t) || /designation[^\n]*20\d{2}-\d{2}-\d{2}/i.test(t)) {
      addIssue({
        where: 'Payroll → My Pay → payslip detail → Designation',
        why: 'Designation displays concatenated date (e.g. Senior Engineer 2026-07-02)',
        classification: 'FRONTEND',
        severity: 'MEDIUM',
        how: 'Separate designation vs effective-date fields in the display mapper.',
        screenshot: sn,
        network: 'n/a',
      });
    }
    await nestClickActions('payslip-detail', 2, { allowDestructive: false });
    await dismissOverlays();
  }
  // Global / admin payroll probe
  resetNet();
  await page.goto(`${FE}/payroll`, { waitUntil: 'domcontentloaded' });
  await settle(500);
  const createRun = page.getByRole('button', { name: /create run|run payroll|new run/i }).first();
  if (await createRun.isVisible().catch(() => false)) {
    const sn = await shot(page, menu, 'create-run-visible', 'leak-check');
    depthStats.adminLeak += 1;
    addIssue({
      where: 'Payroll → Create Run',
      why: 'Admin payroll Create Run control visible to MANAGER',
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Hide payroll-run admin controls for MANAGER; keep My Pay only.',
      screenshot: sn,
      network: 'n/a',
    });
  }
}

async function deepPayout(menu) {
  await exploreTabs(menu, 1);
  await nestClickActions(menu, 1, { allowDestructive: false });
  resetNet();
  await page.goto(`${FE}/payout-methods/approvals`, { waitUntil: 'domcontentloaded' });
  await settle(700);
  const sn = await shot(page, menu, 'approvals', 'view');
  await checkVisibleErrors(menu, 'approvals', sn);
  recordApiIssues(menu, 'approvals', sn);
  for (const name of ['Approve', 'Deny', 'Reject']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
    if (await btn.isVisible().catch(() => false)) {
      await clickTarget(menu, btn, `payout-${name}`, 2);
      await dismissOverlays();
    }
  }
}

async function deepAdmin(menu) {
  const text = await bodyText();
  const access = classifyAdminAccess(text, page.url());
  const sn = await shot(page, menu, 'access-state', access.toLowerCase());
  if (access === 'DENY') {
    depthStats.adminDeny += 1;
  } else if (access === 'LEAK' || access === 'OPEN') {
    // OPEN on admin menu for manager is a nav+content leak if real admin UI
    if (access === 'LEAK' || (access === 'OPEN' && !/access restricted/i.test(text) && ADMIN_MENUS.has(menu))) {
      // Reports etc. may show empty shell — treat OPEN without restricted as potential leak only if admin chrome
      if (access === 'LEAK') {
        depthStats.adminLeak += 1;
        addIssue({
          where: menu,
          why: `Admin menu content LEAK for MANAGER (access=${access})`,
          classification: 'FRONTEND',
          severity: 'CRITICAL',
          how: 'RoleGate must DENY; remove from sidebar for MANAGER.',
          screenshot: sn,
          network: page.url(),
        });
      } else {
        // Still document sidebar visibility
        addIssue({
          where: `${menu} sidebar`,
          why: `MANAGER sidebar shows ${menu}; deep-link access=${access} (expected DENY / hide nav)`,
          classification: 'FRONTEND',
          severity: 'HIGH',
          how: 'Filter NAV_ITEMS by memberType; keep RoleGate as backstop.',
          screenshot: sn,
          network: page.url(),
        });
        if (access === 'DENY') depthStats.adminDeny += 1;
      }
    }
  } else if (access === '404') {
    addIssue({
      where: menu,
      why: 'Admin deep-link is 404 instead of RoleGate DENY',
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Return Access restricted RoleGate page, not Next 404.',
      screenshot: sn,
      network: page.url(),
    });
  }
  // Still try nested clicks to detect leaks behind buttons
  await exploreTabs(menu, 1);
  await nestClickActions(menu, 1, { allowDestructive: false });
}

async function deepSettings(menu) {
  await shot(page, menu, 'landing', 'view');
  await nestClickActions(menu, 1, { allowDestructive: false });
  for (const href of SETTINGS_ROUTES) {
    await dismissOverlays();
    resetNet();
    try {
      await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch {
      await shot(page, menu, href.replace(/\//g, '-'), 'timeout');
      continue;
    }
    await settle(550);
    const text = await bodyText();
    const access = classifyAdminAccess(text, page.url());
    const sn = await shot(page, menu, href.replace(/\//g, '-').replace(/^-/, ''), access.toLowerCase());
    if (access === 'DENY') depthStats.adminDeny += 1;
    if (access === '404') {
      addIssue({
        where: `${menu} → ${href}`,
        why: 'Hard navigation yields 404 Page not found (not RoleGate DENY)',
        classification: 'FRONTEND',
        severity: 'HIGH',
        how: 'Wire the route or redirect unauthorized settings slug to first allowed panel.',
        screenshot: sn,
        network: page.url(),
      });
    }
    if (access === 'LEAK') {
      depthStats.adminLeak += 1;
      addIssue({
        where: `${menu} → ${href}`,
        why: 'Privileged settings content visible to MANAGER (LEAK)',
        classification: 'FRONTEND',
        severity: 'CRITICAL',
        how: 'Enforce RoleGate DENY for privileged settings slugs.',
        screenshot: sn,
        network: page.url(),
      });
    }
    await checkVisibleErrors(menu, href, sn);
    recordApiIssues(menu, href, sn);
    if (access === 'OPEN' || access === 'DENY') {
      await exploreTabs(slug(href), 2);
      if (access === 'OPEN') await nestClickActions(slug(href), 2, { allowDestructive: false });
    }
    await dismissOverlays();
  }
}

async function deepGeneric(menu) {
  await exploreTabs(menu, 1);
  await exploreFilters(menu);
  await explorePagination(menu);
  await nestClickActions(menu, 1, { allowDestructive: false });
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
  admin: deepAdmin,
  settings: deepSettings,
  generic: deepGeneric,
};

// ── LOGIN ─────────────────────────────────────────────────────────────
console.log('=== LOGIN MANAGER deep ===');
resetNet();
await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
await shot(page, 'login', 'page', 'view');
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
await shot(page, 'login', 'filled', 'view');
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
    why: 'MANAGER login failed via UI',
    classification: 'FRONTEND',
    severity: 'CRITICAL',
    how: 'Check BFF auth + cookies + API_BASE_URL.',
    screenshot: snLogin,
    network: failApis()
      .map((f) => `${f.status} ${f.url}`)
      .join('; '),
  });
  fs.writeFileSync(path.join(SHOT, 'results.json'), JSON.stringify({ issues, screenshots, depthStats }, null, 2));
  await browser.close();
  process.exit(1);
}
for (const f of failApis().filter((x) => x.status === 401 && /auth\/(me|refresh)/.test(x.url))) {
  addIssue({
    where: 'login → bootstrap',
    why: `Pre-auth ${f.status} ${f.method} ${f.url} during login page load`,
    classification: 'FRONTEND',
    how: 'Avoid calling /auth/me and /auth/refresh on anonymous login page.',
    screenshot: snLogin,
    network: `${f.status} ${f.method} ${f.url}`,
  });
}

const navLabels = await page.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="Main navigation"]');
  if (!nav) return [];
  return [...nav.querySelectorAll('a')].map((a) => ({
    label: (a.getAttribute('aria-label') || a.textContent || '').trim(),
    href: a.getAttribute('href'),
  }));
});
fs.writeFileSync(path.join(SHOT, 'nav-items.json'), JSON.stringify(navLabels, null, 2));
console.log('SIDEBAR:', navLabels.map((n) => n.label).join(' | '));
await shot(page, 'shell', 'sidebar', 'visible');

// Note unfiltered admin nav
const adminVisible = navLabels.filter((n) => ADMIN_MENUS.has(n.label));
if (adminVisible.length) {
  const sn = screenshots[screenshots.length - 1]?.name;
  addIssue({
    where: 'Sidebar NAV_ITEMS',
    why: `MANAGER sees admin menus: ${adminVisible.map((n) => n.label).join(', ')}`,
    classification: 'FRONTEND',
    severity: 'HIGH',
    how: 'Filter NAV_ITEMS by memberType per UI_CONTRACT_role_nav; keep RoleGate as backstop.',
    screenshot: sn,
    network: 'n/a',
  });
}

for (const item of MENUS) {
  console.log(`\n=== MENU: ${item.label} (${item.href}) nest-max=${MAX_NEST} ===`);
  await gotoMenu(item.href, item.label);
  depthStats.menusLanded += 1;
  const sn = await shot(page, item.label, 'land', 'view');
  await checkVisibleErrors(item.label, 'land', sn);
  recordApiIssues(item.label, 'land', sn);

  const text = await bodyText();
  const access = classifyAdminAccess(text, page.url());
  menuResults.push({
    menu: item.label,
    href: item.href,
    url: page.url(),
    access,
    api4xx: failApis()
      .filter((f) => f.status < 500)
      .map((f) => `${f.status} ${f.method} ${f.url}`),
    api5xx: failApis()
      .filter((f) => f.status >= 500)
      .map((f) => `${f.status} ${f.method} ${f.url}`),
    consoleErrors: consoleErrors.slice(0, 5),
  });

  const fn = DEEP[item.deep] || deepGeneric;
  await fn(item.label);
  await dismissOverlays();
}

// Extra admin deep-link matrix
console.log('\n=== ADMIN DEEP-LINK MATRIX ===');
const deepLinkResults = [];
for (const href of ADMIN_DEEP_LINKS) {
  await dismissOverlays();
  resetNet();
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(600);
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
  if (access === '404' && /roles-permissions/i.test(href)) {
    addIssue({
      where: `Deep-link ${href}`,
      why: '404 Page not found instead of RoleGate DENY',
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Wire route or redirect; do not 404 privileged settings for MANAGER.',
      screenshot: sn,
      network: page.url(),
    });
  }
}

// Shell extras
console.log('\n=== SHELL EXTRAS ===');
await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
await settle(500);
const bell = page.locator('button[aria-label*="Notification" i]').first();
if (await bell.isVisible().catch(() => false)) {
  resetNet();
  await bell.click().catch(() => {});
  await settle(450);
  const snBell = await shot(page, 'shell', 'notifications', 'open');
  recordApiIssues('shell', 'notifications', snBell);
  const mark = page.getByRole('button', { name: /mark.*read|mark all/i }).first();
  if (await mark.isVisible().catch(() => false)) {
    await clickTarget('shell', mark, 'mark-read', 1);
  }
  await dismissOverlays();
}
const profile = page.locator('button[aria-label*="profile" i], button[aria-label*="account" i], [data-testid="user-menu"]').first();
if (await profile.isVisible().catch(() => false)) {
  await profile.click().catch(() => {});
  await settle(300);
  await shot(page, 'shell', 'profile-menu', 'open');
  for (const name of [/profile/i, /settings/i, /sessions/i]) {
    const item = page.getByRole('menuitem', { name }).first();
    if (await item.isVisible().catch(() => false)) {
      await item.click().catch(() => {});
      await settle(600);
      await shot(page, 'shell', `profile-${slug(String(name))}`, 'view');
      await nestClickActions('shell-profile', 2, { allowDestructive: false });
      await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
      await settle(300);
      await profile.click().catch(() => {});
      await settle(200);
    }
  }
  await dismissOverlays();
}

const summary = {
  role: 'MANAGER',
  user: USER,
  fe: FE,
  be: 'http://localhost:4000',
  maxNest: MAX_NEST,
  totalClicks,
  depthStats,
  menusTested: menuResults.map((m) => m.menu),
  menuCount: menuResults.length,
  screenshotCount: screenshots.length,
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
fs.writeFileSync(path.join(SHOT, 'results.json'), JSON.stringify(summary, null, 2));
console.log(
  `\n==== DONE menus=${summary.menuCount} shots=${summary.screenshotCount} clicks=${totalClicks} nestMax=${depthStats.maxNestSeen} issues=${summary.issueCount} BE=${summary.backendIssues} FE=${summary.frontendIssues} deny=${depthStats.adminDeny} leak=${depthStats.adminLeak} mutations=${mutations.length} ====`,
);
await browser.close();
