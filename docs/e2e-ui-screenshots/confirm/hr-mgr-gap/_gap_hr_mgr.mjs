/**
 * DEEP GAP FILL — HR + MANAGER (parallel roles, sequential runners)
 * A) hr@acme.test — Permissions (expect deny) + every button;
 *    Settings subs HR can open + deep buttons;
 *    Recruitment / Performance / Assets / Announcements if visible.
 * B) aman@acme.test — Approvals + Timesheets nested;
 *    every Approve / Return / Bulk; Reports if visible.
 *
 * UI :3001 · BE :4000 · No Render · No commits
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const UI = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://localhost:4000/api/v1';
const TENANT = 'acme-corp-001';
const PASS = 'Password123!';

/** Settings slugs HR_ADMIN may open per SettingsNav.tsx */
const HR_SETTINGS_OPEN = [
  'company-profile',
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
  'sessions',
  'audit-log',
  'email-templates',
  'notifications',
];

/** SA-only — expect Access restricted for HR */
const HR_SETTINGS_DENY = [
  'branding',
  'authentication',
  'integration-email',
  'integration-storage',
  'integration-webhooks',
  'billing-plan',
  'billing-invoices',
  'pay/country-bank-schemas',
];

const SKIP_RE =
  /sign out|log out|logout|delete all|wipe|reset database|deactivate account|remove tenant|permanently delete|danger zone/i;
const DESTRUCTIVE_RE = /^(delete|remove|archive|terminate|fire|void|cancel run|lock run)$/i;

let shotIdx = 0;
const issues = [];
const findings = [];
const apiFails = [];
const mutations = [];
const consoleErrors = [];

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
  return file;
}

function note(role, sev, cls, where, why, screenshot, network = 'n/a', extra = {}) {
  const prefix = role === 'HR_ADMIN' ? 'GAP-HR' : 'GAP-MGR';
  const id = `${prefix}-${String(issues.length + 1).padStart(2, '0')}`;
  const row = { id, role, severity: sev, classification: cls, where, why, screenshot, network, ...extra };
  // Dedupe by where+why head
  const key = `${where}|${why.slice(0, 80)}`;
  if (issues.some((i) => `${i.where}|${i.why.slice(0, 80)}` === key)) return null;
  issues.push(row);
  console.log(`  🐛 ${id} [${cls}/${sev}] ${where}: ${why.slice(0, 140)}`);
  return row;
}

function logF(role, menu, action, status, detail = {}) {
  findings.push({ role, menu, action, status, at: new Date().toISOString(), ...detail });
}

async function settle(page, ms = 500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function hardDismiss(page) {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(50);
  }
  const cancel = page
    .locator(
      '[role="dialog"] button:has-text("Cancel"), [role="alertdialog"] button:has-text("Cancel"), button:has-text("Close")',
    )
    .first();
  if (await cancel.isVisible({ timeout: 200 }).catch(() => false)) {
    await cancel.click({ force: true, timeout: 1000 }).catch(() => {});
  }
}

async function labelOf(el) {
  const text = ((await el.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const aria = (await el.getAttribute('aria-label').catch(() => '')) || '';
  const href = (await el.getAttribute('href').catch(() => '')) || '';
  const title = (await el.getAttribute('title').catch(() => '')) || '';
  return text || aria || title || href || 'control';
}

async function safeClick(page, el) {
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 1000 });
  } catch {
    /* ignore */
  }
  try {
    await el.click({ timeout: 2000 });
    return true;
  } catch {
    try {
      await el.click({ force: true, timeout: 1500 });
      return true;
    } catch {
      return false;
    }
  }
}

async function bodyText(page) {
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

function isDeny(text) {
  return /access restricted|you don.?t have permission|super admins? only|forbidden|not authorized/i.test(
    text || '',
  );
}

async function login(page, email) {
  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 400);
  await page.fill('#email', email);
  await page.fill('#password', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/otp/, { timeout: 45000 });
  await settle(page, 900);
  return page.url();
}

async function navLabels(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main navigation"]');
    if (!nav) {
      return [...document.querySelectorAll('aside a, nav a')]
        .map((a) => ({
          t: (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim(),
          href: a.getAttribute('href') || '',
        }))
        .filter((x) => x.t);
    }
    return [...nav.querySelectorAll('a')].map((a) => ({
      t: (a.getAttribute('aria-label') || a.textContent || '').replace(/\s+/g, ' ').trim(),
      href: a.getAttribute('href') || '',
    }));
  });
}

async function deepButtons(page, role, menu, home, opts = {}) {
  const max = opts.max ?? 22;
  const nestDialogs = opts.nestDialogs !== false;
  const clicked = new Set();
  let n = 0;

  // Tabs first
  const tabs = page.locator('main [role="tab"], [role="tablist"] [role="tab"]');
  const tc = await tabs.count();
  for (let i = 0; i < tc; i++) {
    await hardDismiss(page);
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const lab = await labelOf(tab);
    const before = apiFails.length;
    await safeClick(page, tab);
    await settle(page, 450);
    const ss = await shot(page, `${role}-${menu}-tab-${lab}`);
    logF(role, menu, `tab:${lab}`, 'PASS', { screenshot: ss });
    n += 1;
    await harvestApi(role, menu, `tab:${lab}`, ss, before);
    // Priority buttons on this tab
    n += await clickBatch(page, role, `${menu}/${lab}`, home, {
      max: Math.min(10, Math.floor(max / Math.max(tc, 1))),
      nestDialogs,
      clicked,
    });
  }

  n += await clickBatch(page, role, menu, home, { max: Math.max(8, max - n), nestDialogs, clicked });
  return n;
}

async function clickBatch(page, role, menu, home, opts = {}) {
  const max = opts.max ?? 12;
  const nestDialogs = opts.nestDialogs !== false;
  const clicked = opts.clicked || new Set();
  let n = 0;

  const controls = page.locator(
    'main button:visible, main a[href]:visible, main [role="button"]:visible, main [role="menuitem"]:visible',
  );
  const count = await controls.count();
  for (let i = 0; i < count && n < max; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab) || DESTRUCTIVE_RE.test(lab.trim())) continue;
    const key = lab.toLowerCase();
    if (clicked.has(key)) continue;
    // Skip pure nav back to unrelated modules
    const href = (await el.getAttribute('href').catch(() => '')) || '';
    if (href && home && href.startsWith('/') && !href.startsWith(home.split('?')[0]) && !href.includes('#')) {
      // allow relative same-module and hash; skip jumping away to other top menus
      if (
        /^\/(dashboard|employees|departments|attendance|leave|holidays|payroll|reports|analytics|permissions|settings|recruitment|performance|assets|announcements|payout)/i.test(
          href,
        ) &&
        !href.startsWith(home)
      ) {
        continue;
      }
    }
    clicked.add(key);
    const before = apiFails.length;
    if (!(await safeClick(page, el))) continue;
    n += 1;
    await settle(page, 400);
    const ss = await shot(page, `${role}-${menu}-btn-${lab}`);
    logF(role, menu, `btn:${lab}`, 'PASS', { screenshot: ss, url: page.url() });
    await harvestApi(role, menu, `btn:${lab}`, ss, before);

    if (nestDialogs) {
      const dlg = page.locator('[role="dialog"], [role="alertdialog"]').first();
      if (await dlg.isVisible({ timeout: 250 }).catch(() => false)) {
        const sd = await shot(page, `${role}-${menu}-dialog-${lab}`);
        logF(role, menu, `dialog:${lab}`, 'PASS', { screenshot: sd });
        // Click a few dialog controls (not final create/save)
        const dBtns = dlg.locator('button:visible, [role="tab"]:visible');
        const dc = Math.min(await dBtns.count(), 6);
        for (let j = 0; j < dc; j++) {
          const db = dBtns.nth(j);
          const dlab = await labelOf(db);
          if (!dlab || /^(cancel|close|create|save|submit|confirm|send)$/i.test(dlab.trim())) continue;
          if (SKIP_RE.test(dlab) || DESTRUCTIVE_RE.test(dlab.trim())) continue;
          await safeClick(page, db);
          await settle(page, 300);
          await shot(page, `${role}-${menu}-dlgctrl-${dlab}`);
        }
        await hardDismiss(page);
      }
    }

    // If navigated away from home, go back
    if (home && !page.url().includes(home.replace(/^\//, '').split('/')[0]) && !page.url().includes(home)) {
      await page.goto(`${UI}${home}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(page, 400);
    }
  }
  return n;
}

function harvestApi(role, menu, action, screenshot, beforeIdx) {
  const fresh = apiFails.slice(beforeIdx);
  for (const fr of fresh) {
    // Expected denies are recorded separately; still flag 5xx / unexpected
    if (fr.status >= 500) {
      note(
        role,
        'HIGH',
        'BACKEND',
        `${menu} / ${action}`,
        `${fr.method} ${fr.path} → ${fr.status}: ${fr.body.slice(0, 180)}`,
        screenshot,
        `${fr.status} ${fr.method} ${fr.path}`,
      );
    }
  }
  return fresh;
}

async function explorePermissionsHr(page) {
  console.log('\n=== HR Permissions (expect deny) ===');
  const before = apiFails.length;
  await page.goto(`${UI}/permissions`, { waitUntil: 'domcontentloaded' });
  await settle(page, 800);
  const ss = await shot(page, 'hr-permissions-land');
  const text = await bodyText(page);
  const deny = isDeny(text);
  logF('HR_ADMIN', 'Permissions', 'open', deny ? 'DENY_OK' : 'UNEXPECTED', {
    screenshot: ss,
    deny,
    url: page.url(),
  });

  if (!deny) {
    note(
      'HR_ADMIN',
      'CRITICAL',
      'FRONTEND',
      'Sidebar → Permissions (/permissions)',
      'HR_ADMIN opened Permissions without Access restricted (expected Super Admins only)',
      ss,
      'n/a',
      { expected: 'Access restricted', actual: text.slice(0, 200), crossRef: 'ISSUE-HR-01' },
    );
  } else {
    console.log('  ✓ Permissions denied as expected');
  }

  // Deep every button still visible (e.g. Go back / Request access / shell)
  const btns = page.locator('main button:visible, main a:visible, [role="main"] button:visible');
  const bc = Math.min(await btns.count(), 16);
  for (let i = 0; i < bc; i++) {
    const el = btns.nth(i);
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab)) continue;
    const b0 = apiFails.length;
    await safeClick(page, el);
    await settle(page, 400);
    const sb = await shot(page, `hr-permissions-btn-${lab}`);
    logF('HR_ADMIN', 'Permissions', `btn:${lab}`, 'PASS', { screenshot: sb, url: page.url() });
    harvestApi('HR_ADMIN', 'Permissions', lab, sb, b0);
    // Stay near permissions
    if (!/permissions/i.test(page.url()) && !isDeny(await bodyText(page))) {
      await page.goto(`${UI}/permissions`, { waitUntil: 'domcontentloaded' });
      await settle(page, 400);
    }
  }

  // Sidebar click evidence
  const nav = page.locator('nav[aria-label="Main navigation"] a[aria-label="Permissions"]').first();
  if (await nav.isVisible({ timeout: 600 }).catch(() => false)) {
    await nav.click({ force: true }).catch(() => {});
    await settle(page, 500);
    const sn = await shot(page, 'hr-permissions-sidebar-click');
    const t2 = await bodyText(page);
    if (!isDeny(t2)) {
      note(
        'HR_ADMIN',
        'CRITICAL',
        'FRONTEND',
        'Sidebar → Permissions (nav click)',
        'Sidebar Permissions link for HR does not land on Access restricted',
        sn,
        'n/a',
        { crossRef: 'ISSUE-HR-01' },
      );
    }
  }
  harvestApi('HR_ADMIN', 'Permissions', 'open', ss, before);
}

async function exploreSettingsHr(page) {
  console.log('\n=== HR Settings (openable + deny) ===');
  await page.goto(`${UI}/settings`, { waitUntil: 'domcontentloaded' });
  await settle(page, 700);
  const land = await shot(page, 'hr-settings-land');
  logF('HR_ADMIN', 'Settings', 'land', 'PASS', { screenshot: land, url: page.url() });

  // Visible nav items in settings sidebar
  const setNav = await page.evaluate(() =>
    [...document.querySelectorAll('aside a, nav a, [data-settings-nav] a, a[href^="/settings/"]')]
      .map((a) => ({
        t: (a.textContent || '').replace(/\s+/g, ' ').trim(),
        href: a.getAttribute('href') || '',
      }))
      .filter((x) => x.href.includes('/settings')),
  );
  logF('HR_ADMIN', 'Settings', 'nav-items', 'PASS', { items: setNav });

  for (const sub of HR_SETTINGS_OPEN) {
    const href = `/settings/${sub}`;
    console.log(`  open ${href}`);
    const before = apiFails.length;
    await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    await settle(page, 600);
    const ss = await shot(page, `hr-settings-open-${sub}`);
    const text = await bodyText(page);
    const deny = isDeny(text);
    const is404 = /404|this page could not be found|not found/i.test(text);
    logF('HR_ADMIN', 'Settings', `open:${sub}`, deny ? 'DENY' : is404 ? '404' : 'PASS', {
      screenshot: ss,
      url: page.url(),
    });
    if (deny) {
      note(
        'HR_ADMIN',
        'HIGH',
        'FRONTEND',
        `Settings → ${sub}`,
        `HR_ADMIN incorrectly Access-restricted on settings slug allowed in SettingsNav (${sub})`,
        ss,
        'n/a',
        { expected: 'panel loads', actual: 'Access restricted' },
      );
    } else if (is404) {
      note(
        'HR_ADMIN',
        'HIGH',
        'FRONTEND',
        `Settings → ${sub}`,
        `Settings slug ${sub} returns 404 for HR_ADMIN`,
        ss,
        'n/a',
        { crossRef: 'ISSUE-MGR-11 / roles-permissions pattern' },
      );
    } else {
      await deepButtons(page, 'HR_ADMIN', `settings-${slug(sub)}`, href, { max: 14, nestDialogs: true });
    }
    harvestApi('HR_ADMIN', `Settings/${sub}`, 'open', ss, before);
  }

  for (const sub of HR_SETTINGS_DENY) {
    const href = `/settings/${sub}`;
    console.log(`  deny-expect ${href}`);
    await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await settle(page, 500);
    const ss = await shot(page, `hr-settings-deny-${sub}`);
    const text = await bodyText(page);
    const deny = isDeny(text);
    logF('HR_ADMIN', 'Settings', `deny:${sub}`, deny ? 'DENY_OK' : 'LEAK', {
      screenshot: ss,
      url: page.url(),
    });
    if (!deny) {
      note(
        'HR_ADMIN',
        'CRITICAL',
        'FRONTEND',
        `Settings → ${sub}`,
        `HR_ADMIN can open SA-only settings panel ${sub} (expected Access restricted)`,
        ss,
        'n/a',
        { expected: 'Access restricted', actual: text.slice(0, 180), crossRef: 'ISSUE-HR-02' },
      );
      // Still don't deep-mutate SA settings
    }
  }
}

async function exploreModuleIfVisible(page, nav, label, href) {
  const visible = nav.some(
    (n) => n.t.toLowerCase() === label.toLowerCase() || (n.href && n.href.includes(href)),
  );
  console.log(`\n=== HR ${label} (nav visible=${visible}) ===`);
  if (!visible) {
    // Still hard-nav to document deep-link behavior
    console.log(`  nav hidden — hard-nav ${href}`);
  }
  const before = apiFails.length;
  await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
  await settle(page, 700);
  const ss = await shot(page, `hr-${slug(label)}-land`);
  const text = await bodyText(page);
  const deny = isDeny(text);
  logF('HR_ADMIN', label, 'open', deny ? 'DENY' : 'PASS', {
    screenshot: ss,
    navVisible: visible,
    url: page.url(),
  });
  if (deny) {
    note(
      'HR_ADMIN',
      'MEDIUM',
      'FRONTEND',
      `${label} (${href})`,
      visible
        ? `${label} in sidebar but Access restricted for HR_ADMIN`
        : `${label} Access restricted on hard-nav`,
      ss,
      'n/a',
    );
    return;
  }
  await deepButtons(page, 'HR_ADMIN', slug(label), href, { max: 20, nestDialogs: true });
  harvestApi('HR_ADMIN', label, 'open', ss, before);
}

async function runHr() {
  console.log('\n######## ROLE A: HR_ADMIN ########');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('tenantKey', t);
      localStorage.setItem('x-tenant-key', t);
    } catch {
      /* ignore */
    }
  }, TENANT);

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ role: 'HR', text: msg.text().slice(0, 240) });
  });
  page.on('response', async (res) => {
    try {
      if (res.status() < 400 || !/\/api\//.test(res.url())) return;
      let body = '';
      try {
        body = (await res.text()).slice(0, 280);
      } catch {
        /* ignore */
      }
      apiFails.push({
        role: 'HR',
        status: res.status(),
        method: res.request().method(),
        path: res.url().replace(/https?:\/\/[^/]+/, ''),
        body,
        t: Date.now(),
      });
    } catch {
      /* ignore */
    }
  });

  const url = await login(page, 'hr@acme.test');
  const loginShot = await shot(page, 'hr-login-ok');
  logF('HR_ADMIN', 'Login', 'login', url.includes('dashboard') ? 'PASS' : 'FAIL', {
    screenshot: loginShot,
    url,
  });

  const nav = await navLabels(page);
  await shot(page, 'hr-nav-sidebar');
  logF('HR_ADMIN', 'Nav', 'sidebar', 'PASS', { items: nav });
  console.log(
    '  nav:',
    nav
      .map((n) => n.t)
      .slice(0, 24)
      .join(', '),
  );

  await explorePermissionsHr(page);
  await exploreSettingsHr(page);

  for (const m of [
    ['Recruitment', '/recruitment'],
    ['Performance', '/performance'],
    ['Assets', '/assets'],
    ['Announcements', '/announcements'],
  ]) {
    await exploreModuleIfVisible(page, nav, m[0], m[1]);
  }

  await browser.close();
}

async function openTimesheetApprovals(page) {
  await page.goto(`${UI}/timesheets`, { waitUntil: 'domcontentloaded' });
  await settle(page, 600);
  const land = await shot(page, 'mgr-timesheets-land');
  const appr = page.getByRole('tab', { name: /approv/i }).first();
  if (await appr.isVisible({ timeout: 3000 }).catch(() => false)) {
    await appr.click();
  } else {
    // try link
    const link = page.locator('a,button').filter({ hasText: /^approvals?$/i }).first();
    if (await link.isVisible().catch(() => false)) await link.click();
  }
  await page
    .getByRole('button', { name: /^approve$/i })
    .first()
    .waitFor({ state: 'visible', timeout: 30000 })
    .catch(() => {});
  await settle(page, 800);
  const loaded = await shot(page, 'mgr-timesheets-approvals-loaded');
  return { land, loaded };
}

async function runManager() {
  console.log('\n######## ROLE B: MANAGER ########');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('tenantKey', t);
      localStorage.setItem('x-tenant-key', t);
    } catch {
      /* ignore */
    }
  }, TENANT);

  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ role: 'MGR', text: msg.text().slice(0, 240) });
  });
  page.on('response', async (res) => {
    try {
      if (res.status() < 400 || !/\/api\//.test(res.url())) return;
      let body = '';
      try {
        body = (await res.text()).slice(0, 320);
      } catch {
        /* ignore */
      }
      const row = {
        role: 'MGR',
        status: res.status(),
        method: res.request().method(),
        path: res.url().replace(/https?:\/\/[^/]+/, ''),
        body,
        t: Date.now(),
      };
      apiFails.push(row);
      if (/timesheets\/.*(approve|reject)/i.test(row.path)) {
        console.log(`  NET ${row.status} ${row.method} ${row.path.slice(-80)} | ${row.body.slice(0, 100)}`);
        mutations.push(row);
      }
    } catch {
      /* ignore */
    }
  });

  const url = await login(page, 'aman@acme.test');
  const loginShot = await shot(page, 'mgr-login-ok');
  logF('MANAGER', 'Login', 'login', url.includes('dashboard') ? 'PASS' : 'FAIL', {
    screenshot: loginShot,
    url,
  });

  const nav = await navLabels(page);
  await shot(page, 'mgr-nav-sidebar');
  logF('MANAGER', 'Nav', 'sidebar', 'PASS', { items: nav });
  console.log(
    '  nav:',
    nav
      .map((n) => n.t)
      .slice(0, 24)
      .join(', '),
  );

  // Dashboard Approvals + Bulk
  console.log('\n=== MGR Dashboard Approvals + Bulk ===');
  await page.goto(`${UI}/dashboard`, { waitUntil: 'domcontentloaded' });
  await settle(page, 800);
  await shot(page, 'mgr-dashboard-land');

  const bulk = page.getByRole('button', { name: /bulk approve/i }).first();
  if (await bulk.isVisible().catch(() => false)) {
    const b0 = apiFails.length;
    await safeClick(page, bulk);
    await settle(page, 500);
    const sb = await shot(page, 'mgr-dashboard-bulk-approve');
    const t = await bodyText(page);
    logF('MANAGER', 'Dashboard', 'bulk-approve', 'PASS', { screenshot: sb });
    if (/bulk approve leave/i.test(t) && /regulariz/i.test(t) === false) {
      // leave-only bulk while regs may exist — known ISSUE-MGR-04; record as reconfirm only if new nuance
      logF('MANAGER', 'Dashboard', 'bulk-leave-only', 'RECONFIRM', {
        screenshot: sb,
        crossRef: 'ISSUE-MGR-04',
      });
    }
    // dialog buttons
    const dlg = page.locator('[role="dialog"]').first();
    if (await dlg.isVisible().catch(() => false)) {
      const dBtns = dlg.locator('button:visible');
      const dc = Math.min(await dBtns.count(), 8);
      for (let i = 0; i < dc; i++) {
        const lab = await labelOf(dBtns.nth(i));
        if (/^(approve all|confirm|submit)$/i.test(lab.trim())) {
          await shot(page, `mgr-bulk-has-${lab}`);
          continue; // don't mass-approve leave
        }
        if (/cancel|close/i.test(lab)) continue;
        await safeClick(page, dBtns.nth(i));
        await settle(page, 250);
        await shot(page, `mgr-bulk-dlg-${lab}`);
      }
      await hardDismiss(page);
    }
    harvestApi('MANAGER', 'Dashboard', 'bulk', sb, b0);
  }

  // Dashboard Approve/Deny if present
  for (const name of ['Approve', 'Deny', 'Reject']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
    if (!(await btn.isVisible().catch(() => false))) continue;
    const b0 = apiFails.length;
    await safeClick(page, btn);
    await settle(page, 500);
    const ss = await shot(page, `mgr-dashboard-${name}`);
    logF('MANAGER', 'Dashboard', name, 'PASS', { screenshot: ss });
    harvestApi('MANAGER', 'Dashboard', name, ss, b0);
    await hardDismiss(page);
  }

  // Timesheets nested — all tabs + Approvals deep
  console.log('\n=== MGR Timesheets nested + Approvals ===');
  await page.goto(`${UI}/timesheets`, { waitUntil: 'domcontentloaded' });
  await settle(page, 600);
  await deepButtons(page, 'MANAGER', 'timesheets', '/timesheets', { max: 18, nestDialogs: true });

  const { loaded } = await openTimesheetApprovals(page);
  const approveCount = await page.getByRole('button', { name: /^approve$/i }).count();
  const returnCount = await page.getByRole('button', { name: /^return$/i }).count();
  console.log(`  Approvals loaded Approve=${approveCount} Return=${returnCount} shot=${loaded}`);
  logF('MANAGER', 'Timesheets/Approvals', 'loaded', 'PASS', {
    screenshot: loaded,
    approveCount,
    returnCount,
  });

  // Click EVERY Approve (re-find each time as list mutates)
  let approveClicks = 0;
  for (let round = 0; round < Math.min(approveCount, 12); round++) {
    await openTimesheetApprovals(page);
    const btn = page.getByRole('button', { name: /^approve$/i }).nth(0);
    if (!(await btn.isVisible().catch(() => false))) break;
    // Identify row person
    const rowInfo = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (el) => /^approve$/i.test((el.innerText || '').trim()),
      );
      const row = b?.closest('tr, [data-row], li, .grid');
      return (row?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    });
    const b0 = apiFails.length;
    await safeClick(page, btn);
    approveClicks += 1;
    await settle(page, 700);
    const ss = await shot(page, `mgr-approve-${round}`);
    const fresh = apiFails.slice(b0).filter((f) => /approve|reject/i.test(f.path));
    logF('MANAGER', 'Timesheets/Approvals', `approve:${round}`, fresh.length ? 'FAIL' : 'PASS', {
      screenshot: ss,
      rowInfo,
      fails: fresh,
    });
    for (const fr of fresh) {
      const code = (fr.body.match(/"code"\s*:\s*"([^"]+)"/) || [])[1] || '';
      if (code === 'NOT_TEAM_APPROVER' || code === 'SELF_APPROVAL_FORBIDDEN') {
        note(
          'MANAGER',
          'CRITICAL',
          'FRONTEND',
          'Timesheets → Approvals → Approve',
          `Approve exposed for row "${rowInfo}" → 403 ${code}`,
          ss,
          `${fr.status} ${fr.method} ${fr.path}`,
          { code, crossRef: code === 'SELF_APPROVAL_FORBIDDEN' ? 'ISSUE-MGR-02' : 'ISSUE-MGR-09' },
        );
      } else if (fr.status >= 400) {
        note(
          'MANAGER',
          'HIGH',
          'BOTH',
          'Timesheets → Approvals → Approve',
          `Approve failed ${fr.status} ${code || fr.body.slice(0, 100)} row="${rowInfo}"`,
          ss,
          `${fr.status} ${fr.method} ${fr.path}`,
          { code },
        );
      }
    }
    await hardDismiss(page);
  }

  // Click EVERY Return (open modal + submit reason)
  let returnClicks = 0;
  for (let round = 0; round < Math.min(returnCount, 8); round++) {
    await openTimesheetApprovals(page);
    const btn = page.getByRole('button', { name: /^return$/i }).nth(0);
    if (!(await btn.isVisible().catch(() => false))) break;
    const rowInfo = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (el) => /^return$/i.test((el.innerText || '').trim()),
      );
      const row = b?.closest('tr, [data-row], li, .grid');
      return (row?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    });
    const b0 = apiFails.length;
    await safeClick(page, btn);
    await settle(page, 400);
    const sm = await shot(page, `mgr-return-modal-${round}`);
    // Fill reason + submit
    const dlg = page.locator('[role="dialog"], [role="alertdialog"]').first();
    if (await dlg.isVisible().catch(() => false)) {
      const ta = dlg.locator('textarea, input[type="text"]').first();
      if (await ta.isVisible().catch(() => false)) {
        await ta.fill('E2E gap confirm return reason').catch(() => {});
      }
      const submit = dlg
        .getByRole('button', { name: /return|reject|submit|confirm/i })
        .filter({ hasNotText: /cancel/i })
        .first();
      if (await submit.isVisible().catch(() => false)) {
        await safeClick(page, submit);
        returnClicks += 1;
        await settle(page, 700);
      }
    }
    const ss = await shot(page, `mgr-return-result-${round}`);
    const fresh = apiFails.slice(b0).filter((f) => /approve|reject/i.test(f.path));
    logF('MANAGER', 'Timesheets/Approvals', `return:${round}`, fresh.length ? 'FAIL' : 'PASS', {
      screenshot: ss,
      modal: sm,
      rowInfo,
      fails: fresh,
    });
    for (const fr of fresh) {
      const code = (fr.body.match(/"code"\s*:\s*"([^"]+)"/) || [])[1] || '';
      if (code === 'NOT_TEAM_APPROVER' || code === 'SELF_APPROVAL_FORBIDDEN') {
        note(
          'MANAGER',
          'CRITICAL',
          'FRONTEND',
          'Timesheets → Approvals → Return',
          `Return exposed for row "${rowInfo}" → 403 ${code}`,
          ss,
          `${fr.status} ${fr.method} ${fr.path}`,
          { code, crossRef: code === 'SELF_APPROVAL_FORBIDDEN' ? 'ISSUE-MGR-02' : 'ISSUE-MGR-09' },
        );
      }
    }
    await hardDismiss(page);
  }

  // Bulk on Approvals tab if any
  const bulkTs = page.getByRole('button', { name: /bulk/i }).first();
  if (await bulkTs.isVisible().catch(() => false)) {
    await safeClick(page, bulkTs);
    await settle(page, 400);
    await shot(page, 'mgr-timesheets-bulk');
    await hardDismiss(page);
  }

  // Other timesheet tabs nest again
  for (const tabName of [/my/i, /template/i, /delegat/i, /history/i]) {
    const tab = page.getByRole('tab', { name: tabName }).first();
    if (!(await tab.isVisible().catch(() => false))) continue;
    await tab.click().catch(() => {});
    await settle(page, 500);
    const sn = await shot(page, `mgr-timesheets-retab-${String(tabName)}`);
    await deepButtons(page, 'MANAGER', `timesheets-${slug(String(tabName))}`, '/timesheets', {
      max: 10,
      nestDialogs: true,
    });
    logF('MANAGER', 'Timesheets', `retab:${tabName}`, 'PASS', { screenshot: sn });
  }

  // Reports if visible
  const reportsVisible = nav.some(
    (n) => /reports/i.test(n.t) || (n.href && n.href.includes('/reports')),
  );
  console.log(`\n=== MGR Reports (nav visible=${reportsVisible}) ===`);
  if (reportsVisible) {
    await page.goto(`${UI}/reports`, { waitUntil: 'domcontentloaded' });
    await settle(page, 700);
    const ss = await shot(page, 'mgr-reports-land');
    const text = await bodyText(page);
    const deny = isDeny(text);
    logF('MANAGER', 'Reports', 'open', deny ? 'DENY' : 'PASS', {
      screenshot: ss,
      url: page.url(),
    });
    if (!deny) {
      note(
        'MANAGER',
        'CRITICAL',
        'FRONTEND',
        'Sidebar → Reports',
        'MANAGER can open Reports (expected Access restricted / hidden nav)',
        ss,
        'n/a',
        { crossRef: 'ISSUE-MGR-03', actual: text.slice(0, 200) },
      );
      await deepButtons(page, 'MANAGER', 'reports', '/reports', { max: 16, nestDialogs: true });
    } else {
      // Dead-end nav — known unfiltered sidebar
      note(
        'MANAGER',
        'HIGH',
        'FRONTEND',
        'Sidebar → Reports',
        'Reports visible in MANAGER sidebar but page Access restricted (dead-end nav)',
        ss,
        'n/a',
        { crossRef: 'ISSUE-MGR-03', expected: 'hidden nav', actual: 'visible + deny' },
      );
    }
  } else {
    // hard-nav probe
    await page.goto(`${UI}/reports`, { waitUntil: 'domcontentloaded' });
    await settle(page, 500);
    const ss = await shot(page, 'mgr-reports-hardnav');
    const deny = isDeny(await bodyText(page));
    logF('MANAGER', 'Reports', 'hardnav', deny ? 'DENY_OK' : 'LEAK', { screenshot: ss });
    if (!deny) {
      note(
        'MANAGER',
        'CRITICAL',
        'FRONTEND',
        '/reports hard-nav',
        'MANAGER hard-nav to Reports is not Access restricted',
        ss,
        'n/a',
      );
    }
  }

  console.log(`  approveClicks=${approveClicks} returnClicks=${returnClicks}`);
  await browser.close();
}

function writeFindings() {
  const pngs = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length;
  const hrIssues = issues.filter((i) => i.role === 'HR_ADMIN');
  const mgrIssues = issues.filter((i) => i.role === 'MANAGER');

  // Cross-ref known contract IDs — mark NEW vs RECONFIRM
  const knownPatterns = [
    { re: /Permissions.*Access restricted|Permissions without Access/i, known: 'ISSUE-HR-01' },
    { re: /SA-only settings|settings panel.*authentication|branding|integration|billing/i, known: 'ISSUE-HR-02' },
    { re: /SELF_APPROVAL_FORBIDDEN/i, known: 'ISSUE-MGR-02' },
    { re: /NOT_TEAM_APPROVER/i, known: 'ISSUE-MGR-09' },
    { re: /Reports visible|unfiltered|Reports \(expected/i, known: 'ISSUE-MGR-03' },
    { re: /Bulk approve.*[Ll]eave|bulk-leave/i, known: 'ISSUE-MGR-04' },
    { re: /roles-permissions|404 for HR/i, known: 'ISSUE-EMP-10' },
  ];

  for (const iss of issues) {
    const hit = knownPatterns.find((k) => k.re.test(`${iss.where} ${iss.why}`));
    iss.novelty = hit ? `RECONFIRM:${hit.known}` : 'NEW';
    if (hit && !iss.crossRef) iss.crossRef = hit.known;
  }

  const newIssues = issues.filter((i) => i.novelty === 'NEW');
  const reconfirm = issues.filter((i) => i.novelty !== 'NEW');

  const md = [];
  md.push('# FINDINGS — HR + MANAGER Gap Confirm');
  md.push('');
  md.push(`> Generated: ${new Date().toISOString()}`);
  md.push(`> Roles: \`HR_ADMIN\` (\`hr@acme.test\`) · \`MANAGER\` (\`aman@acme.test\`) · tenant \`acme-corp-001\``);
  md.push(`> UI: \`${UI}\` · API: \`${API}\``);
  md.push(`> Screenshots: \`docs/e2e-ui-screenshots/confirm/hr-mgr-gap/\` (**${pngs}** PNGs)`);
  md.push(`> **No Render. No git commit.**`);
  md.push('');
  md.push('## Summary');
  md.push('');
  md.push('| Metric | Value |');
  md.push('|--------|------:|');
  md.push(`| Screenshots | **${pngs}** |`);
  md.push(`| Findings log rows | ${findings.length} |`);
  md.push(`| API ≥400 captured | ${apiFails.length} |`);
  md.push(`| Approve/Reject mutations | ${mutations.length} |`);
  md.push(`| Issues total | **${issues.length}** |`);
  md.push(`| NEW issues | **${newIssues.length}** |`);
  md.push(`| RECONFIRM (known) | ${reconfirm.length} |`);
  md.push(`| HR issues | ${hrIssues.length} |`);
  md.push(`| Manager issues | ${mgrIssues.length} |`);
  md.push('');
  md.push('## Coverage');
  md.push('');
  md.push('### A) HR_ADMIN');
  md.push('- Permissions — land (expect deny) + every main button + sidebar click');
  md.push(`- Settings openable (${HR_SETTINGS_OPEN.length} slugs) — deep buttons/dialogs per panel`);
  md.push(`- Settings SA-only deny probe (${HR_SETTINGS_DENY.length} slugs)`);
  md.push('- Recruitment / Performance / Assets / Announcements — if nav visible + hard-nav deep');
  md.push('');
  md.push('### B) MANAGER');
  md.push('- Dashboard Approvals + Bulk approve dialog controls');
  md.push('- Timesheets — nested tabs/buttons; Approvals table wait; every Approve + Return');
  md.push('- Reports — if sidebar visible (expect deny / dead-end)');
  md.push('');
  md.push('## Issues');
  md.push('');
  if (!issues.length) {
    md.push('_No issues recorded._');
  }
  for (const iss of issues) {
    md.push(`### ${iss.id} — ${iss.where}`);
    md.push(`| | |`);
    md.push(`|--|--|`);
    md.push(`| **Novelty** | ${iss.novelty} |`);
    md.push(`| **Severity** | ${iss.severity} |`);
    md.push(`| **Class** | ${iss.classification} |`);
    md.push(`| **Role** | ${iss.role} |`);
    md.push(`| **Why** | ${iss.why} |`);
    md.push(`| **Evidence** | \`${iss.screenshot || 'n/a'}\` |`);
    md.push(`| **Network** | ${iss.network} |`);
    if (iss.code) md.push(`| **Code** | \`${iss.code}\` |`);
    if (iss.crossRef) md.push(`| **Cross-ref** | ${iss.crossRef} |`);
    md.push('');
  }
  md.push('## API fails (sample)');
  md.push('');
  md.push('```');
  for (const f of apiFails.slice(-40)) {
    md.push(`${f.role} ${f.status} ${f.method} ${f.path} | ${f.body.slice(0, 120)}`);
  }
  md.push('```');
  md.push('');

  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), md.join('\n'));
  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify(
      { pngs, issues, findings, apiFails, mutations, consoleErrors: consoleErrors.slice(0, 40) },
      null,
      2,
    ),
  );

  // Append NEW only to central confirm doc
  const confirmPath = path.resolve(__dirname, '../../../E2E_GAP_CONFIRM_FINDINGS.md');
  let existing = '';
  if (fs.existsSync(confirmPath)) existing = fs.readFileSync(confirmPath, 'utf8');
  else {
    existing = [
      '# E2E Gap Confirm Findings',
      '',
      '> Living log of **new** issues found during confirm/gap-fill Playwright passes.',
      '> Reconfirmations of known contract IDs are kept in per-shard FINDINGS.md only.',
      '',
    ].join('\n');
  }

  if (newIssues.length) {
    const block = [];
    block.push('');
    block.push(`## HR+MGR gap confirm — ${new Date().toISOString().slice(0, 10)}`);
    block.push('');
    block.push(`Source: \`docs/e2e-ui-screenshots/confirm/hr-mgr-gap/\` (${pngs} PNGs)`);
    block.push('');
    for (const iss of newIssues) {
      block.push(`### ${iss.id} — ${iss.where}`);
      block.push(`- **Severity:** ${iss.severity}`);
      block.push(`- **Class:** ${iss.classification}`);
      block.push(`- **Role:** ${iss.role}`);
      block.push(`- **Why:** ${iss.why}`);
      block.push(`- **Screenshot:** \`docs/e2e-ui-screenshots/confirm/hr-mgr-gap/${iss.screenshot || ''}\``);
      block.push(`- **Network:** ${iss.network}`);
      if (iss.code) block.push(`- **Code:** \`${iss.code}\``);
      block.push('');
    }
    // Avoid duplicate append of same ids
    const toAppend = block.filter((line) => {
      if (!line.startsWith('### ')) return true;
      const id = line.replace(/^###\s+/, '').split(' ')[0];
      return !existing.includes(id);
    });
    // If all issue headers already present, skip
    const hasNewHeader = toAppend.some((l) => l.startsWith('### '));
    if (hasNewHeader) {
      fs.writeFileSync(confirmPath, existing.trimEnd() + '\n' + block.join('\n') + '\n');
      console.log(`\nAppended ${newIssues.length} NEW issue(s) → docs/E2E_GAP_CONFIRM_FINDINGS.md`);
    } else {
      console.log('\nNo new unique IDs to append (already in confirm doc)');
    }
  } else {
    if (!existing.includes('HR+MGR gap confirm')) {
      const stub = [
        '',
        `## HR+MGR gap confirm — ${new Date().toISOString().slice(0, 10)}`,
        '',
        `Source: \`docs/e2e-ui-screenshots/confirm/hr-mgr-gap/\` (${pngs} PNGs)`,
        '',
        '_No NEW issues — all findings reconfirmed known contract IDs (see shard FINDINGS.md)._',
        '',
      ].join('\n');
      fs.writeFileSync(confirmPath, existing.trimEnd() + '\n' + stub);
    }
    console.log('\nNo NEW issues — confirm doc updated with stub / unchanged');
  }

  console.log(`\nDONE pngs=${pngs} issues=${issues.length} new=${newIssues.length}`);
}

const browserWarm = await chromium.launch({ headless: true });
await browserWarm.close();

await runHr();
await runManager();
writeFindings();
