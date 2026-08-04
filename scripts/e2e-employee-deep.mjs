/**
 * Deep EMPLOYEE UI E2E — Playwright (local FE :3001 + BE :4000).
 * Screenshots → docs/e2e-ui-screenshots/employee/NN-menu-action-result.png
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const USER = process.env.QA_EMAIL || 'priya@acme.test';
const PASS = process.env.QA_PASS || 'Password123!';
const SHOT =
  process.env.SHOT_DIR ||
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/employee';
fs.mkdirSync(SHOT, { recursive: true });

const ERR_BODY = [
  /something went wrong/i,
  /unexpected error/i,
  /failed to load/i,
  /failed to fetch/i,
  /internal server error/i,
  /application error/i,
  /error boundary/i,
  /access restricted/i,
  /you don.?t have permission/i,
  /not authorized/i,
  /forbidden/i,
];

let shotIdx = 0;
const findings = [];
const mutations = [];
const screenResults = [];
let apiLog = [];
let consoleLog = [];

function resetNet() {
  apiLog = [];
  consoleLog = [];
}

function slug(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'x'
  );
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOT, file), fullPage: false }).catch(() => {});
  return file;
}

function persist() {
  fs.writeFileSync(
    path.join(SHOT, 'results.json'),
    JSON.stringify(
      {
        user: USER,
        role: 'EMPLOYEE',
        tenant: 'acme-corp-001',
        shotCount: shotIdx,
        findingsCount: findings.length,
        mutations,
        screenResults,
        findings,
      },
      null,
      2,
    ),
  );
}

function note(issue) {
  findings.push({ ...issue, ts: new Date().toISOString() });
  persist();
}

async function bodyText(page) {
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

async function settle(page, ms = 700) {
  await page.waitForTimeout(ms);
  await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
}

async function clickText(page, labels, { timeout = 900 } = {}) {
  for (const label of labels) {
    const loc = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
    if (await loc.isVisible({ timeout }).catch(() => false)) {
      await loc.click({ timeout: 3000 }).catch(() => {});
      return label;
    }
    const tab = page.getByRole('tab', { name: new RegExp(label, 'i') }).first();
    if (await tab.isVisible({ timeout: 400 }).catch(() => false)) {
      await tab.click({ timeout: 3000 }).catch(() => {});
      return label;
    }
    const any = page.locator(`button:has-text("${label}"), a:has-text("${label}")`).first();
    if (await any.isVisible({ timeout: 400 }).catch(() => false)) {
      await any.click({ timeout: 3000 }).catch(() => {});
      return label;
    }
  }
  return null;
}

async function evaluateScreen(page, menu, action) {
  const text = await bodyText(page);
  const errHit = ERR_BODY.find((re) => re.test(text));
  const api4xx = apiLog.filter((c) => c.status >= 400 && c.status < 500);
  const api5xx = apiLog.filter((c) => c.status >= 500);
  const consoleErrors = consoleLog.slice(0, 8);
  const url = page.url();
  const redirectedToLogin = url.includes('/login');
  const accessRestricted = /access restricted/i.test(text);
  const ok = !redirectedToLogin && !errHit && api5xx.length === 0;

  let layer = null;
  if (api5xx.length) layer = 'BACKEND';
  else if (accessRestricted) layer = 'FRONTEND';
  else if (api4xx.some((c) => c.status >= 500)) layer = 'BACKEND';
  else if (api4xx.length && errHit) layer = 'BACKEND';
  else if (errHit) layer = 'FRONTEND';
  else if (api4xx.some((c) => [401, 403, 404, 422, 400].includes(c.status))) layer = 'BACKEND';

  const rec = {
    menu,
    action,
    url,
    ok,
    layer,
    errText: errHit ? String(errHit) : null,
    accessRestricted,
    redirectedToLogin,
    api4xx: api4xx.map((c) => `${c.status} ${c.method} ${c.url}`).slice(0, 15),
    api5xx: api5xx.map((c) => `${c.status} ${c.method} ${c.url}`).slice(0, 15),
    consoleErrors,
    bodySnippet: text.replace(/\s+/g, ' ').trim().slice(0, 240),
  };
  screenResults.push(rec);
  if (!ok || accessRestricted || api4xx.length || api5xx.length || consoleErrors.length) note(rec);
  return rec;
}

async function goto(page, href) {
  resetNet();
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
    console.log(`  nav error ${href}: ${String(e).slice(0, 120)}`);
  });
  await settle(page, 900);
}

async function withTimeout(label, ms, fn) {
  let timer;
  try {
    await Promise.race([
      fn(),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error(`timeout:${label}`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(60000);
page.setDefaultTimeout(12000);

page.on('response', (res) => {
  const u = res.url();
  if (!u.includes('/api/')) return;
  let method = 'GET';
  try {
    method = res.request().method();
  } catch {
    /* ignore */
  }
  apiLog.push({ url: u.replace(/https?:\/\/[^/]+/, ''), status: res.status(), method });
});
page.on('console', (m) => {
  if (m.type() === 'error') consoleLog.push(m.text().slice(0, 220));
});
page.on('pageerror', (e) => consoleLog.push('pageerror: ' + String(e).slice(0, 220)));

// ── LOGIN ──────────────────────────────────────────────────────────────────
resetNet();
await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#email', { state: 'visible', timeout: 30000 });
await page.waitForTimeout(1000);
await shot(page, 'login-form');
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
console.log(`LOGIN API: ${loginResp ? loginResp.status() : 'none'} ${loginResp?.url() || ''}`);
await page
  .waitForURL((u) => !u.pathname.includes('/login') || u.pathname.includes('otp'), { timeout: 45000 })
  .catch(() => {});
await settle(page, 1500);
let loggedIn = !page.url().includes('/login') && !page.url().includes('otp');
if (!loggedIn && !page.url().includes('otp')) {
  await goto(page, '/dashboard');
  loggedIn = !page.url().includes('/login');
}
await shot(page, loggedIn ? 'login-success-dashboard' : 'login-fail');
await evaluateScreen(page, 'Login', 'submit');
console.log(`LOGIN: ${loggedIn ? 'OK' : 'FAIL'} url=${page.url()}`);
if (!loggedIn) {
  persist();
  await browser.close();
  process.exit(1);
}

const navItems = await page.evaluate(() => {
  const out = [];
  const seen = new Set();
  for (const a of document.querySelectorAll('aside a, nav a')) {
    const href = a.getAttribute('href') || '';
    const label = (a.getAttribute('aria-label') || a.textContent || '').trim();
    if (!href.startsWith('/') || seen.has(href)) continue;
    seen.add(href);
    out.push({ href, label: label.slice(0, 60) });
  }
  return out;
});
await shot(page, 'nav-visible-sidebar');
fs.writeFileSync(path.join(SHOT, 'nav-items.json'), JSON.stringify(navItems, null, 2));
console.log(`NAV (${navItems.length}):`, navItems.map((n) => n.label || n.href).join(' | '));

// ── helpers per menu ───────────────────────────────────────────────────────
async function landing(menu, href) {
  await goto(page, href);
  const sn = await shot(page, `${slug(menu)}-landing`);
  const ev = await evaluateScreen(page, menu, 'landing');
  console.log(
    `  [${menu}] landing ok=${ev.ok} restricted=${!!ev.accessRestricted} 4xx=${ev.api4xx.length} 5xx=${ev.api5xx.length} shot=${sn}`,
  );
  return ev;
}

async function tryTabs(menu, labels) {
  for (const label of labels) {
    resetNet();
    const hit = await clickText(page, [label], { timeout: 600 });
    if (!hit) continue;
    await settle(page, 700);
    await shot(page, `${slug(menu)}-view-${slug(label)}`);
    const ev = await evaluateScreen(page, menu, `view:${label}`);
    console.log(`  [${menu}] view ${label} ok=${ev.ok}`);
  }
}

async function tryExport(menu) {
  resetNet();
  const hit = await clickText(page, ['Export', 'Download', 'Download CSV', 'Export CSV'], {
    timeout: 600,
  });
  if (!hit) return;
  await settle(page, 1200);
  await shot(page, `${slug(menu)}-export-attempt`);
  const ev = await evaluateScreen(page, menu, 'export');
  console.log(`  [${menu}] export "${hit}" 4xx=${ev.api4xx.length} 5xx=${ev.api5xx.length}`);
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
console.log('\n=== Dashboard ===');
await withTimeout('Dashboard', 90000, async () => {
  await landing('Dashboard', '/dashboard');
  resetNet();
  const ci = await clickText(page, ['Check In', 'Clock In']);
  if (ci) {
    await settle(page, 1500);
    const sn = await shot(page, 'dashboard-check-in-result');
    const ev = await evaluateScreen(page, 'Dashboard', 'check-in');
    const posts = apiLog.filter((c) => c.method === 'POST');
    mutations.push({ action: 'dashboard check-in', apis: posts, shot: sn });
    console.log(`  [Dashboard] check-in posts=${posts.length} ok=${ev.ok}`);
  }
  // documents / team widgets
  for (const label of ['Documents', 'My Team', 'Team', 'View all']) {
    resetNet();
    const hit = await clickText(page, [label], { timeout: 500 });
    if (hit) {
      await settle(page, 800);
      await shot(page, `dashboard-${slug(label)}`);
      await evaluateScreen(page, 'Dashboard', `click:${label}`);
    }
  }
}).catch((e) => console.log('  Dashboard timeout/error', e.message));

// ── ATTENDANCE ─────────────────────────────────────────────────────────────
console.log('\n=== Attendance ===');
await withTimeout('Attendance', 120000, async () => {
  await landing('Attendance', '/attendance');
  await tryTabs('Attendance', ['Calendar', 'Table', 'List', 'Summary', 'Regularization']);

  resetNet();
  let hit = await clickText(page, ['Check In', 'Clock In']);
  if (hit) {
    await settle(page, 1800);
    const sn = await shot(page, 'attendance-check-in-result');
    const ev = await evaluateScreen(page, 'Attendance', 'check-in');
    mutations.push({
      action: 'attendance check-in',
      apis: apiLog.filter((c) => c.method === 'POST'),
      shot: sn,
      eval: { ok: ev.ok, api4xx: ev.api4xx, api5xx: ev.api5xx },
    });
    console.log(`  [Attendance] CHECK-IN ok=${ev.ok} 4xx=${JSON.stringify(ev.api4xx)} 5xx=${JSON.stringify(ev.api5xx)}`);
  } else {
    await shot(page, 'attendance-check-in-button-absent');
  }

  resetNet();
  hit = await clickText(page, ['Check Out', 'Clock Out']);
  if (hit) {
    await settle(page, 500);
    await clickText(page, ['Confirm', 'Yes', 'Check Out'], { timeout: 800 });
    await settle(page, 1800);
    const sn = await shot(page, 'attendance-check-out-result');
    const ev = await evaluateScreen(page, 'Attendance', 'check-out');
    mutations.push({
      action: 'attendance check-out',
      apis: apiLog.filter((c) => c.method === 'POST'),
      shot: sn,
      eval: { ok: ev.ok, api4xx: ev.api4xx, api5xx: ev.api5xx },
    });
    console.log(`  [Attendance] CHECK-OUT ok=${ev.ok}`);
  } else {
    await shot(page, 'attendance-check-out-button-absent');
  }

  resetNet();
  hit = await clickText(page, ['Request Regularization', 'Regularize', 'Regularization']);
  if (hit) {
    await settle(page, 900);
    await shot(page, 'attendance-regularization-dialog');
    await evaluateScreen(page, 'Attendance', 'open-regularization');
    await page.keyboard.press('Escape').catch(() => {});
    await clickText(page, ['Cancel', 'Close'], { timeout: 500 });
  }
  await tryExport('Attendance');
}).catch((e) => console.log('  Attendance timeout/error', e.message));

// ── TIMESHEETS ─────────────────────────────────────────────────────────────
console.log('\n=== Timesheets ===');
await withTimeout('Timesheets', 90000, async () => {
  await landing('Timesheets', '/timesheets');
  await tryTabs('Timesheets', ['My Timesheet', 'My Timesheets', 'Templates', 'Team', 'Approvals']);
  resetNet();
  const open = await clickText(page, ['Add Entry', 'New', 'Add Hours', 'Create']);
  if (open) {
    await settle(page, 800);
    await shot(page, 'timesheets-create-dialog');
    await evaluateScreen(page, 'Timesheets', 'open-create');
    await page.keyboard.press('Escape').catch(() => {});
    await clickText(page, ['Cancel', 'Close'], { timeout: 500 });
  }
  await tryExport('Timesheets');
}).catch((e) => console.log('  Timesheets timeout/error', e.message));

// ── LEAVE ──────────────────────────────────────────────────────────────────
console.log('\n=== Leave ===');
await withTimeout('Leave', 120000, async () => {
  await landing('Leave', '/leave');
  await tryTabs('Leave', ['My Requests', 'Balance', 'Calendar', 'Team', 'History']);

  resetNet();
  let open = await clickText(page, ['Request Leave', 'Apply Leave', 'New Request', 'Apply']);
  if (open) {
    await settle(page, 1000);
    await shot(page, 'leave-request-dialog-open');
    await evaluateScreen(page, 'Leave', 'open-request');

    // Prefer combobox / select for leave type
    const combo = page.getByRole('combobox').first();
    if (await combo.isVisible({ timeout: 800 }).catch(() => false)) {
      await combo.click().catch(() => {});
      await page.keyboard.press('ArrowDown').catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
    }
    const dates = page.locator('input[type="date"]');
    const n = await dates.count();
    if (n >= 1) {
      await dates.nth(0).fill('2026-12-28').catch(() => {});
      if (n >= 2) await dates.nth(1).fill('2026-12-28').catch(() => {});
    }
    const reason = page.locator('textarea').first();
    if (await reason.isVisible({ timeout: 500 }).catch(() => false)) {
      await reason.fill('E2E employee deep test leave — non-destructive').catch(() => {});
    }
    await shot(page, 'leave-request-form-filled');

    resetNet();
    const submitted = await clickText(page, ['Submit', 'Request', 'Apply']);
    if (submitted) {
      await settle(page, 2000);
      const sn = await shot(page, 'leave-request-submit-result');
      const ev = await evaluateScreen(page, 'Leave', 'submit-request');
      mutations.push({
        action: 'leave submit',
        apis: apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method)),
        shot: sn,
        eval: { ok: ev.ok, api4xx: ev.api4xx, api5xx: ev.api5xx },
      });
      console.log(`  [Leave] SUBMIT ok=${ev.ok} 4xx=${JSON.stringify(ev.api4xx)}`);
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
  } else {
    await shot(page, 'leave-request-button-absent');
  }

  resetNet();
  const withdraw = await clickText(page, ['Withdraw', 'Cancel Request']);
  if (withdraw) {
    await settle(page, 400);
    await clickText(page, ['Confirm', 'Yes', 'Withdraw'], { timeout: 800 });
    await settle(page, 1600);
    const sn = await shot(page, 'leave-withdraw-result');
    const ev = await evaluateScreen(page, 'Leave', 'withdraw');
    mutations.push({
      action: 'leave withdraw',
      apis: apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method)),
      shot: sn,
      eval: { ok: ev.ok, api4xx: ev.api4xx, api5xx: ev.api5xx },
    });
    console.log(`  [Leave] WITHDRAW ok=${ev.ok}`);
  } else {
    await shot(page, 'leave-withdraw-button-absent');
  }
}).catch((e) => console.log('  Leave timeout/error', e.message));

// ── HOLIDAYS ───────────────────────────────────────────────────────────────
console.log('\n=== Holidays ===');
await withTimeout('Holidays', 60000, async () => {
  await landing('Holidays', '/holidays');
  await tryTabs('Holidays', ['Optional', 'Mandatory', 'Calendar', 'List', 'My Selection']);
  resetNet();
  const sel = await clickText(page, ['Select', 'Opt in', 'Choose']);
  if (sel) {
    await settle(page, 900);
    await shot(page, 'holidays-optional-select');
    await evaluateScreen(page, 'Holidays', 'optional-select');
  }
}).catch((e) => console.log('  Holidays timeout/error', e.message));

// ── PAYROLL SELF ───────────────────────────────────────────────────────────
console.log('\n=== Payroll self ===');
await withTimeout('Payroll', 90000, async () => {
  await landing('Payroll-self', '/payroll/my-payslips');
  await tryTabs('Payroll-self', ['Payslips', 'YTD', 'Tax']);
  await tryExport('Payroll-self');

  await landing('Payroll-admin-probe', '/payroll');
  await shot(page, 'payroll-admin-route');
  await evaluateScreen(page, 'Payroll-admin-probe', 'landing-/payroll');
}).catch((e) => console.log('  Payroll timeout/error', e.message));

// ── PAYOUT ─────────────────────────────────────────────────────────────────
console.log('\n=== Payout methods ===');
await withTimeout('Payout', 60000, async () => {
  await landing('Payout-methods', '/payout-methods');
  resetNet();
  const add = await clickText(page, ['Add', 'Add Method', 'New']);
  if (add) {
    await settle(page, 800);
    await shot(page, 'payout-add-dialog');
    await evaluateScreen(page, 'Payout-methods', 'open-add');
    await page.keyboard.press('Escape').catch(() => {});
    await clickText(page, ['Cancel', 'Close'], { timeout: 500 });
  }
}).catch((e) => console.log('  Payout timeout/error', e.message));

// ── EMPLOYEES / DEPTS / DOCS ───────────────────────────────────────────────
console.log('\n=== Employees ===');
await withTimeout('Employees', 90000, async () => {
  await landing('Employees', '/employees');
  await tryExport('Employees');
  resetNet();
  const add = await clickText(page, ['Add Employee', 'Add']);
  if (add) {
    await settle(page, 1000);
    await shot(page, 'employees-add-attempt-security');
    await evaluateScreen(page, 'Employees', 'add-employee-visible');
    note({
      menu: 'Employees',
      action: 'add-employee-visible-to-employee',
      layer: 'FRONTEND',
      ok: false,
      securityIssue: true,
      errText: 'Add Employee control visible/clickable for EMPLOYEE role',
      api4xx: apiLog.filter((c) => c.status >= 400 && c.status < 500).map((c) => `${c.status} ${c.url}`),
      api5xx: [],
      consoleErrors: [],
    });
  }
  const row = page.locator('table tbody tr a, table tbody tr').first();
  if (await row.isVisible({ timeout: 1500 }).catch(() => false)) {
    await row.click().catch(() => {});
    await settle(page, 1000);
    await shot(page, 'employees-row-open');
    await evaluateScreen(page, 'Employees', 'open-row');
    await tryTabs('Employees', ['Documents', 'Profile', 'Attendance', 'Team']);
  }
}).catch((e) => console.log('  Employees timeout/error', e.message));

console.log('\n=== Departments ===');
await withTimeout('Departments', 45000, async () => {
  await landing('Departments', '/departments');
}).catch((e) => console.log('  Departments timeout/error', e.message));

// ── OTHER SELF MODULES ─────────────────────────────────────────────────────
for (const [menu, href] of [
  ['Performance', '/performance'],
  ['Assets', '/assets'],
  ['Announcements', '/announcements'],
]) {
  console.log(`\n=== ${menu} ===`);
  await withTimeout(menu, 45000, async () => {
    await landing(menu, href);
    await tryExport(menu);
  }).catch((e) => console.log(`  ${menu} timeout/error`, e.message));
}

// ── NOTIFICATIONS ──────────────────────────────────────────────────────────
console.log('\n=== Notifications ===');
await withTimeout('Notifications', 45000, async () => {
  resetNet();
  // Prefer aria-label containing notification
  const bell = page.locator('button[aria-label*="otif" i], button[aria-label*="Bell" i]').first();
  if (await bell.isVisible({ timeout: 1500 }).catch(() => false)) {
    await bell.click().catch(() => {});
  } else {
    // heuristic: header buttons near end
    const btns = page.locator('header button');
    const n = await btns.count();
    for (let i = Math.max(0, n - 6); i < n; i++) {
      const al = (await btns.nth(i).getAttribute('aria-label').catch(() => '')) || '';
      if (/notif|bell/i.test(al)) {
        await btns.nth(i).click().catch(() => {});
        break;
      }
    }
  }
  await settle(page, 1000);
  await shot(page, 'notifications-panel');
  await evaluateScreen(page, 'Notifications', 'open-bell');
  resetNet();
  const mark = await clickText(page, ['Mark all as read', 'Mark all', 'Mark as read'], { timeout: 700 });
  if (mark) {
    await settle(page, 900);
    await shot(page, 'notifications-mark-read');
    await evaluateScreen(page, 'Notifications', 'mark-read');
    mutations.push({
      action: 'notifications mark-read',
      apis: apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method)),
    });
  }
  await page.keyboard.press('Escape').catch(() => {});
}).catch((e) => console.log('  Notifications timeout/error', e.message));

// ── PROFILE / SETTINGS SELF ────────────────────────────────────────────────
console.log('\n=== Profile / Settings ===');
await withTimeout('Profile', 60000, async () => {
  resetNet();
  const avatar = page.locator('header button:has([data-slot="avatar"]), header [data-slot="avatar"]').first();
  if (await avatar.isVisible({ timeout: 1500 }).catch(() => false)) {
    await avatar.click().catch(() => {});
  } else {
    await page.locator('header img').first().click().catch(() => {});
  }
  await settle(page, 700);
  await shot(page, 'profile-menu-open');
  await evaluateScreen(page, 'Profile', 'open-menu');

  for (const label of ['Profile', 'Settings', 'Sessions', 'Account']) {
    const item = page.getByRole('menuitem', { name: new RegExp(label, 'i') }).first();
    if (await item.isVisible({ timeout: 600 }).catch(() => false)) {
      await item.click().catch(() => {});
      await settle(page, 1000);
      await shot(page, `profile-${slug(label)}`);
      await evaluateScreen(page, 'Profile', `goto:${label}`);
      break;
    }
  }

  for (const href of ['/settings/sessions', '/settings/notifications', '/settings']) {
    await goto(page, href);
    await shot(page, `settings-self-${slug(href)}`);
    await evaluateScreen(page, 'Settings-self', href);
  }
}).catch((e) => console.log('  Profile timeout/error', e.message));

// Self document/team routes
console.log('\n=== Self routes ===');
for (const href of ['/employees/me/documents', '/employees/me/team', '/employee/dashboard']) {
  await goto(page, href);
  await shot(page, `self-route-${slug(href)}`);
  await evaluateScreen(page, 'Self-routes', href);
  console.log(`  SELF ${href} → ${page.url()}`);
}

// ── ADMIN PROBES (security / UI) ───────────────────────────────────────────
console.log('\n=== ADMIN PROBES ===');
const ADMIN = [
  '/reports',
  '/analytics',
  '/permissions',
  '/settings/company-profile',
  '/settings/pay/components',
  '/settings/audit-log',
  '/recruitment',
  '/employees/new',
  '/payroll/global',
];
for (const href of ADMIN) {
  await withTimeout(`admin-${href}`, 45000, async () => {
    await goto(page, href);
    const sn = await shot(page, `admin-probe-${slug(href)}`);
    const ev = await evaluateScreen(page, 'Admin-probe', href);
    const navVisible = navItems.some((n) => href === n.href || href.startsWith(n.href + '/') || n.href === href);
    const text = await bodyText(page);
    const looksAdmin =
      /payroll run|statutory|permissions matrix|role matrix|company profile|billing|audit log|headcount|analytics summary|create employee/i.test(
        text,
      ) && !ev.accessRestricted;
    if (looksAdmin) {
      note({
        menu: 'Admin-probe',
        action: href,
        layer: 'FRONTEND',
        ok: false,
        securityIssue: true,
        errText: `EMPLOYEE reached admin-looking UI at ${href}`,
        accessRestricted: false,
        api4xx: ev.api4xx,
        api5xx: ev.api5xx,
        consoleErrors: ev.consoleErrors,
        shot: sn,
        navVisible,
      });
    }
    console.log(
      `  PROBE ${href} restricted=${!!ev.accessRestricted} 4xx=${ev.api4xx.length} 5xx=${ev.api5xx.length} looksAdmin=${looksAdmin} shot=${sn}`,
    );
  }).catch((e) => console.log(`  PROBE ${href} timeout/error`, e.message));
}

await goto(page, '/dashboard');
await shot(page, 'final-dashboard');
persist();

const be = findings.filter((f) => f.layer === 'BACKEND');
const fe = findings.filter((f) => f.layer === 'FRONTEND' || f.securityIssue);
console.log(`\n==== DONE shots=${shotIdx} findings=${findings.length} (BE=${be.length} FE=${fe.length}) mutations=${mutations.length} ====`);
console.log(`Output: ${SHOT}`);
await browser.close();
