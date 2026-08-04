/**
 * Phase 3 — admin deny/leak matrix + settings + remaining menus (fresh browser).
 * Preserves existing PNGs in manager-deep/.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = 'http://localhost:3001';
const SHOT = '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/manager-deep';
const USER = 'aman@acme.test';
const PASS = 'Password123!';

let shotIdx = fs.readdirSync(SHOT).filter((f) => f.endsWith('.png')).length;
const screenshots = [];
const issues = [];
const menuResults = [];
const deepLinkResults = [];
const mutations = [];
const depthStats = {
  menusLanded: 0,
  tabsClicked: 0,
  buttonsClicked: 0,
  dialogsOpened: 0,
  nestedLevelsReached: 1,
  maxNestSeen: 2,
  adminDeny: 0,
  adminLeak: 0,
  exportsClicked: 0,
  detailViews: 0,
  approvalsAttempted: 0,
  phase: 3,
  resumeFromShot: shotIdx,
};
const seen = new Set();

function slug(s) {
  return String(s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
}

async function shot(page, menu, action, result = 'ok') {
  shotIdx += 1;
  const name = `${String(shotIdx).padStart(3, '0')}-${slug(menu)}-${slug(action)}-${slug(result)}.png`;
  await page.screenshot({ path: path.join(SHOT, name), fullPage: false }).catch(() => {});
  screenshots.push({ name, menu, action, result, url: page.url() });
  console.log(`  📸 ${name}`);
  return name;
}

function addIssue(o) {
  const key = `${o.classification}|${o.where}|${o.why}`;
  if (seen.has(key)) return;
  seen.add(key);
  const id = `ISSUE-MGR-DEEP-P3-${String(issues.length + 1).padStart(2, '0')}`;
  issues.push({ id, severity: 'MEDIUM', ...o });
  console.log(`  🐛 ${id} [${o.classification}/${o.severity || 'MEDIUM'}] ${o.where}: ${o.why}`);
}

function classify(text, url) {
  if (/access restricted|you don.?t have permission|not authorized|forbidden/i.test(text)) return 'DENY';
  if (/page not found|\b404\b/i.test(text)) return '404';
  if (url.includes('/login')) return 'REDIRECT_LOGIN';
  if (/create run|run payroll|role matrix|permission matrix|billing plan|statutory pack|legal entit/i.test(text))
    return 'LEAK';
  return 'OPEN';
}

async function settle(page, ms = 500) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function body(page) {
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

async function dismiss(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(60);
  }
}

async function login(page) {
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
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });
  await settle(page, 1500);
  if (page.url().includes('/login')) throw new Error('login failed');
}

async function clickNamed(page, menu, names) {
  for (const name of names) {
    await dismiss(page);
    const btn = page.getByRole('button', { name: new RegExp(name, 'i') }).first();
    const link = page.getByRole('link', { name: new RegExp(name, 'i') }).first();
    const target = (await btn.isVisible().catch(() => false))
      ? btn
      : (await link.isVisible().catch(() => false))
        ? link
        : null;
    if (!target) continue;
    depthStats.buttonsClicked += 1;
    await target.click().catch(() => {});
    await settle(page, 450);
    const sn = await shot(page, menu, name, 'clicked');
    const t = await body(page);
    if (/access restricted/i.test(t) && !/reports|analytics|permissions|recruitment|performance|assets/i.test(menu)) {
      addIssue({
        where: `${menu} → ${name}`,
        why: 'Access restricted on manager-allowed surface',
        classification: 'FRONTEND',
        severity: 'HIGH',
        how: 'Hide restricted controls/tabs for MANAGER.',
        screenshot: sn,
        network: page.url(),
      });
    }
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      depthStats.dialogsOpened += 1;
      await shot(page, menu, `${name}-modal`, 'open');
      // confirm approve/deny if present
      if (/approve|deny|reject|return/i.test(name)) {
        depthStats.approvalsAttempted += 1;
        const ta = dialog.locator('textarea').first();
        if (await ta.isVisible().catch(() => false)) await ta.fill('E2E phase3').catch(() => {});
        const conf = dialog.getByRole('button', { name: /^(approve|deny|reject|return|confirm|submit|yes)$/i }).first();
        if (await conf.isVisible().catch(() => false)) {
          await conf.click().catch(() => {});
          await settle(page, 500);
          const sn2 = await shot(page, menu, `${name}-result`, 'done');
          mutations.push({ menu, action: name, screenshot: sn2 });
        }
      }
      await dismiss(page);
    }
  }
}

async function exploreTabs(page, menu) {
  const tabs = page.locator('[role="tab"]');
  const n = Math.min(await tabs.count().catch(() => 0), 8);
  for (let i = 0; i < n; i++) {
    const tab = tabs.nth(i);
    const label = ((await tab.innerText().catch(() => `tab-${i}`)) || '').trim().slice(0, 40);
    await tab.click().catch(() => {});
    depthStats.tabsClicked += 1;
    await settle(page, 400);
    await shot(page, menu, `tab-${label}`, 'view');
    depthStats.maxNestSeen = Math.max(depthStats.maxNestSeen, 2);
  }
}

const ADMIN_MENUS = [
  { label: 'Reports', href: '/reports' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Permissions', href: '/permissions' },
  { label: 'Recruitment', href: '/recruitment' },
  { label: 'Performance', href: '/performance' },
  { label: 'Assets', href: '/assets' },
];

const SETTINGS = [
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

const DEEP_LINKS = [
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

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(60000);

let apiCalls = [];
page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('/api/')) return;
  const status = res.status();
  if (status < 400 && !/approve|reject|deny/i.test(u)) return;
  let bodySnippet = '';
  try {
    bodySnippet = (await res.text()).slice(0, 300);
  } catch {
    /* */
  }
  apiCalls.push({ url: u.replace(/https?:\/\/[^/]+/, ''), status, method: res.request().method(), bodySnippet });
});

console.log(`=== PHASE3 from shot ${shotIdx} ===`);
await login(page);
await shot(page, 'phase3', 'login', 'ok');

// Payout methods
console.log('\n=== Payout methods ===');
await page.goto(`${FE}/payout-methods`, { waitUntil: 'domcontentloaded' });
await settle(page, 700);
depthStats.menusLanded += 1;
let sn = await shot(page, 'payout', 'land', 'view');
await exploreTabs(page, 'payout');
await clickNamed(page, 'payout', ['Add', 'Add account', 'Add method', 'Verify', 'Export']);
await page.goto(`${FE}/payout-methods/approvals`, { waitUntil: 'domcontentloaded' });
await settle(page, 600);
sn = await shot(page, 'payout', 'approvals', 'view');
await clickNamed(page, 'payout', ['Approve', 'Deny', 'Reject']);
menuResults.push({ menu: 'Payout methods', href: '/payout-methods', access: 'OPEN' });

// Announcements
console.log('\n=== Announcements ===');
await page.goto(`${FE}/announcements`, { waitUntil: 'domcontentloaded' });
await settle(page, 600);
depthStats.menusLanded += 1;
await shot(page, 'announcements', 'land', 'view');
await exploreTabs(page, 'announcements');
await clickNamed(page, 'announcements', ['Add', 'Create', 'New', 'Publish', 'Export']);
menuResults.push({ menu: 'Announcements', href: '/announcements', access: 'OPEN' });

// Admin menus via sidebar
for (const m of ADMIN_MENUS) {
  console.log(`\n=== ADMIN ${m.label} ===`);
  apiCalls = [];
  await page.goto(`${FE}${m.href}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 650);
  depthStats.menusLanded += 1;
  const t = await body(page);
  const access = classify(t, page.url());
  sn = await shot(page, m.label, 'access-state', access.toLowerCase());
  menuResults.push({ menu: m.label, href: m.href, url: page.url(), access });
  if (access === 'DENY') depthStats.adminDeny += 1;
  else if (access === 'LEAK') {
    depthStats.adminLeak += 1;
    addIssue({
      where: m.label,
      why: `Admin content LEAK for MANAGER`,
      classification: 'FRONTEND',
      severity: 'CRITICAL',
      how: 'RoleGate DENY + hide sidebar.',
      screenshot: sn,
      network: page.url(),
    });
  } else if (access === '404') {
    addIssue({
      where: m.label,
      why: '404 instead of RoleGate DENY',
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Return Access restricted page.',
      screenshot: sn,
      network: page.url(),
    });
  } else if (access === 'OPEN') {
    // Still a nav issue — document sidebar visibility with OPEN content
    addIssue({
      where: `${m.label} sidebar`,
      why: `MANAGER sidebar shows ${m.label}; deep-link OPEN (expected DENY or hide)`,
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Filter NAV_ITEMS by memberType; RoleGate DENY as backstop.',
      screenshot: sn,
      network: page.url(),
    });
    await exploreTabs(page, m.label);
    await clickNamed(page, m.label, ['Export', 'Add', 'Create', 'Edit', 'Save']);
  }
}

// Settings deep
console.log('\n=== Settings routes ===');
await page.goto(`${FE}/settings`, { waitUntil: 'domcontentloaded' });
await settle(page, 500);
depthStats.menusLanded += 1;
await shot(page, 'settings', 'landing', 'view');
for (const href of SETTINGS) {
  apiCalls = [];
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, 400);
  const t = await body(page);
  const access = classify(t, page.url());
  sn = await shot(page, 'settings', href.replace(/\//g, '-').replace(/^-/, ''), access.toLowerCase());
  if (access === 'DENY') depthStats.adminDeny += 1;
  if (access === '404') {
    addIssue({
      where: `settings → ${href}`,
      why: '404 Page not found (not RoleGate DENY)',
      classification: 'FRONTEND',
      severity: 'HIGH',
      how: 'Wire route or redirect to first allowed settings panel.',
      screenshot: sn,
      network: page.url(),
    });
  }
  if (access === 'LEAK') {
    depthStats.adminLeak += 1;
    addIssue({
      where: `settings → ${href}`,
      why: 'Privileged settings LEAK to MANAGER',
      classification: 'FRONTEND',
      severity: 'CRITICAL',
      how: 'Enforce RoleGate DENY.',
      screenshot: sn,
      network: page.url(),
    });
  }
  if (access === 'OPEN') {
    await clickNamed(page, slug(href), ['Save', 'Edit', 'Add', 'Export']);
  }
}

// Deep-link matrix
console.log('\n=== Deep-link matrix ===');
for (const href of DEEP_LINKS) {
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, 400);
  const t = await body(page);
  const access = classify(t, page.url());
  sn = await shot(page, 'admin-deeplink', href.replace(/\//g, '-').replace(/^-/, ''), access.toLowerCase());
  deepLinkResults.push({ href, url: page.url(), access, screenshot: sn });
  if (access === 'DENY') depthStats.adminDeny += 1;
  if (access === 'LEAK') {
    depthStats.adminLeak += 1;
    addIssue({
      where: `Deep-link ${href}`,
      why: 'MANAGER accesses admin UI (LEAK)',
      classification: 'FRONTEND',
      severity: 'CRITICAL',
      how: 'RoleGate DENY on deep links.',
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
}

// Shell + timesheet return self-approval probe
console.log('\n=== Shell + approval probe ===');
await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
await settle(page, 500);
const bell = page.locator('button[aria-label*="Notification" i]').first();
if (await bell.isVisible().catch(() => false)) {
  await bell.click().catch(() => {});
  await settle(page, 350);
  await shot(page, 'shell', 'notifications', 'open');
  await clickNamed(page, 'shell', ['Mark all as read', 'Mark all read']);
  await dismiss(page);
}

// Timesheets approvals — capture self-approval 403 with body
apiCalls = [];
await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
await settle(page, 600);
const appr = page.getByRole('tab', { name: /approv/i }).first();
if (await appr.isVisible().catch(() => false)) {
  await appr.click().catch(() => {});
  await settle(page, 600);
  sn = await shot(page, 'timesheets', 'approvals-probe', 'view');
  const ret = page.getByRole('button', { name: /^return$/i }).first();
  if (await ret.isVisible().catch(() => false)) {
    depthStats.approvalsAttempted += 1;
    await ret.click().catch(() => {});
    await settle(page, 400);
    await shot(page, 'timesheets', 'return-modal', 'open');
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      const ta = dialog.locator('textarea').first();
      if (await ta.isVisible().catch(() => false)) await ta.fill('E2E self-return probe').catch(() => {});
      const conf = dialog.getByRole('button', { name: /return|confirm|submit/i }).first();
      if (await conf.isVisible().catch(() => false)) await conf.click().catch(() => {});
      await settle(page, 700);
      const sn2 = await shot(page, 'timesheets', 'return-result', 'done');
      const self = apiCalls.find((c) => c.status === 403 && /SELF_APPROVAL|approve|reject/i.test(c.url + c.bodySnippet));
      if (self || apiCalls.some((c) => c.status === 403 && /timesheets/i.test(c.url))) {
        const f = self || apiCalls.find((c) => c.status === 403);
        addIssue({
          where: 'Timesheets → Approvals → Return (own row)',
          why: `Approve/Return shown on manager own rows; API 403 ${f?.bodySnippet || ''}`.trim(),
          classification: 'FRONTEND',
          severity: 'CRITICAL',
          how: 'Hide Approve/Return when employeeId === current user.',
          screenshot: sn2,
          network: f ? `${f.status} ${f.method} ${f.url} | ${f.bodySnippet}` : '403',
        });
      }
      mutations.push({ menu: 'timesheets', action: 'return-self-probe', apis: apiCalls.slice(0, 6), screenshot: sn2 });
    }
  }
  // Approve other if available
  const approve = page.getByRole('button', { name: /^approve$/i }).first();
  if (await approve.isVisible().catch(() => false)) {
    apiCalls = [];
    depthStats.approvalsAttempted += 1;
    await approve.click().catch(() => {});
    await settle(page, 700);
    const sn3 = await shot(page, 'timesheets', 'approve-probe', 'done');
    mutations.push({ menu: 'timesheets', action: 'approve-probe', apis: apiCalls.slice(0, 6), screenshot: sn3 });
    for (const f of apiCalls.filter((c) => c.status >= 400)) {
      const isSelf = /SELF_APPROVAL/i.test(f.bodySnippet);
      addIssue({
        where: 'Timesheets → Approvals → Approve',
        why: `API ${f.status} ${f.method} ${f.url} — ${f.bodySnippet.slice(0, 140)}`,
        classification: isSelf ? 'FRONTEND' : 'BACKEND',
        severity: isSelf ? 'CRITICAL' : 'MEDIUM',
        how: isSelf
          ? 'Hide Approve/Return on own rows.'
          : 'Investigate why MANAGER got 403 approving this timesheet (scope/ownership).',
        screenshot: sn3,
        network: `${f.status} ${f.method} ${f.url} | ${f.bodySnippet}`,
      });
    }
  }
}

// Dashboard bulk + reg approve/deny
apiCalls = [];
await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
await settle(page, 600);
await shot(page, 'dashboard', 'phase3-land', 'view');
await clickNamed(page, 'dashboard', ['Bulk approve', 'Deny', 'Approve']);

// Employees activity tab re-confirm
await page.goto(`${FE}/employees`, { waitUntil: 'domcontentloaded' });
await settle(page, 600);
const emp = page.locator('main a[href*="/employees/"]').first();
if (await emp.isVisible().catch(() => false)) {
  await emp.click();
  await settle(page, 700);
  depthStats.detailViews += 1;
  const act = page.getByRole('tab', { name: /activity/i }).first();
  if (await act.isVisible().catch(() => false)) {
    await act.click().catch(() => {});
    await settle(page, 500);
    sn = await shot(page, 'employees', 'activity-tab', 'view');
    if (/access restricted/i.test(await body(page))) {
      addIssue({
        where: 'Employees → detail → Activity tab',
        why: 'Activity tab visible but Access restricted for MANAGER',
        classification: 'FRONTEND',
        severity: 'HIGH',
        how: 'Hide Activity tab for MANAGER or grant read access to team activity.',
        screenshot: sn,
        network: page.url(),
      });
    }
  }
}

const summary = {
  role: 'MANAGER',
  phase: 3,
  user: USER,
  depthStats,
  menusTested: menuResults,
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
  screenshots,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(SHOT, 'results-phase3.json'), JSON.stringify(summary, null, 2));
console.log(
  `\n==== PHASE3 DONE newShots=${screenshots.length} total=${shotIdx} issues=${issues.length} deny=${depthStats.adminDeny} leak=${depthStats.adminLeak} ====`,
);
await browser.close();
