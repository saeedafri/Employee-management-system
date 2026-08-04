/**
 * Deep MANAGER UI E2E — Playwright
 * Login: aman@acme.test / Password123!
 * Screenshots → docs/e2e-ui-screenshots/manager/NN-menu-action-result.png
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const BE = process.env.BE_BASE || 'http://localhost:4000';
const SHOT = '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/manager';
const OUT = path.join(SHOT, '_results.json');

fs.mkdirSync(SHOT, { recursive: true });

let shotN = 0;
const findings = [];
const mutations = [];
const apiLog = [];
const consoleLog = [];

function addFinding(f) {
  findings.push({ ts: new Date().toISOString(), ...f });
  console.log(`[${f.severity || 'INFO'}][${f.layer || '?'}] ${f.title}`);
}

async function shot(page, label) {
  shotN += 1;
  const nn = String(shotN).padStart(2, '0');
  const safe = label.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const file = `${nn}-${safe}.png`;
  const full = path.join(SHOT, file);
  await page.screenshot({ path: full, fullPage: true }).catch(async () => {
    await page.screenshot({ path: full }).catch(() => {});
  });
  console.log(`SHOT ${file}`);
  return file;
}

async function bodyText(page) {
  return page.evaluate(() => document.body?.innerText || '').catch(() => '');
}

function classifyPage(text, url, apiFails) {
  const t = text.toLowerCase();
  if (/access restricted|you don.?t have permission|forbidden|not authorized/i.test(text)) {
    return { state: 'DENY', layer: 'FRONTEND', note: 'Access restricted UI' };
  }
  if (/something went wrong|unexpected error|application error|failed to load/i.test(text)) {
    const be = apiFails.some((a) => a.status >= 500 || a.status === 403 || a.status === 404);
    return {
      state: 'FAIL',
      layer: be ? 'BACKEND' : 'FRONTEND',
      note: be ? `API errors: ${apiFails.slice(0, 3).map((a) => `${a.status} ${a.path}`).join('; ')}` : 'Error UI without clear 4xx/5xx API',
    };
  }
  if (apiFails.some((a) => a.status >= 500)) {
    return { state: 'FAIL', layer: 'BACKEND', note: `5xx: ${apiFails.filter((a) => a.status >= 500).map((a) => `${a.status} ${a.path}`).join('; ')}` };
  }
  if (apiFails.some((a) => a.status === 403)) {
    return { state: 'PARTIAL', layer: 'BACKEND', note: `403: ${apiFails.filter((a) => a.status === 403).map((a) => a.path).join('; ')}` };
  }
  return { state: 'OK', layer: null, note: '' };
}

async function waitSettle(page, ms = 1200) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function clickAllVisible(page, selectors, { max = 8, labelPrefix = 'click' } = {}) {
  const clicked = [];
  for (const sel of selectors) {
    const loc = page.locator(sel).filter({ hasNot: page.locator('[disabled]') });
    const count = await loc.count().catch(() => 0);
    for (let i = 0; i < Math.min(count, max); i++) {
      const el = loc.nth(i);
      const visible = await el.isVisible().catch(() => false);
      if (!visible) continue;
      const txt = ((await el.innerText().catch(() => '')) || sel).trim().slice(0, 40);
      try {
        await el.click({ timeout: 4000 });
        await waitSettle(page, 800);
        clicked.push(txt);
      } catch {
        /* ignore */
      }
    }
  }
  return clicked;
}

async function clickTabs(page) {
  const tabs = page.locator('[role="tab"], [data-state][role="tab"], button[role="tab"]');
  const n = await tabs.count().catch(() => 0);
  const names = [];
  for (let i = 0; i < Math.min(n, 12); i++) {
    const t = tabs.nth(i);
    if (!(await t.isVisible().catch(() => false))) continue;
    const name = ((await t.innerText().catch(() => '')) || `tab-${i}`).trim().slice(0, 40);
    await t.click({ timeout: 3000 }).catch(() => {});
    await waitSettle(page, 700);
    names.push(name);
  }
  return names;
}

async function dismissOverlays(page) {
  // Escape / close dialogs
  for (let i = 0; i < 3; i++) {
    const dialog = page.locator('[role="dialog"], [data-state="open"].fixed');
    if ((await dialog.count()) === 0) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
    const close = page.locator('[role="dialog"] button:has-text("Close"), [role="dialog"] button[aria-label="Close"], button:has-text("Cancel")').first();
    if (await close.isVisible().catch(() => false)) {
      await close.click().catch(() => {});
    }
  }
}

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PW_CHANNEL || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();

const pageApiFails = [];
page.on('response', async (r) => {
  const url = r.url();
  if (!/\/api\//.test(url)) return;
  const status = r.status();
  let pathOnly = url;
  try {
    pathOnly = new URL(url).pathname + new URL(url).search;
  } catch { /* */ }
  const entry = { status, url, path: pathOnly, method: r.request().method() };
  apiLog.push(entry);
  if (status >= 400) pageApiFails.push(entry);
});
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleLog.push({ type: 'error', text: msg.text() });
});
page.on('pageerror', (err) => {
  consoleLog.push({ type: 'pageerror', text: String(err?.message || err) });
});

function drainApiFails() {
  const copy = [...pageApiFails];
  pageApiFails.length = 0;
  return copy;
}

// ─── LOGIN ───────────────────────────────────────────────────────────────
console.log('=== LOGIN ===');
await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await waitSettle(page, 1000);
await shot(page, 'login-page');

// tenant if present
const tenant = page.locator('#tenant, #tenantKey, input[name="tenant"], input[name="tenantKey"]');
if (await tenant.first().isVisible().catch(() => false)) {
  await tenant.first().fill('acme-corp-001');
}
await page.fill('#email', 'aman@acme.test');
await page.fill('#password', 'Password123!');
await shot(page, 'login-filled');
drainApiFails();
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 }).catch(() => {});
await waitSettle(page, 2000);
const loginFails = drainApiFails();
const loginUrl = page.url();
const loginShot = await shot(page, 'login-result-dashboard');
if (loginUrl.includes('/login')) {
  addFinding({
    severity: 'CRITICAL',
    layer: 'BACKEND',
    title: 'Manager login failed — stayed on /login',
    evidence: { url: loginUrl, api: loginFails, screenshot: loginShot },
  });
  fs.writeFileSync(OUT, JSON.stringify({ findings, mutations, apiLog, consoleLog, shotN }, null, 2));
  await browser.close();
  process.exit(1);
}
addFinding({
  severity: 'INFO',
  layer: 'OK',
  title: `Login OK as MANAGER → ${loginUrl}`,
  evidence: { screenshot: loginShot, api: loginFails.filter((a) => a.status >= 400) },
});

// Capture sidebar
const navLinks = await page.locator('nav[aria-label="Main navigation"] a, aside a[href]').evaluateAll((as) =>
  as.map((a) => ({ href: a.getAttribute('href'), label: (a.getAttribute('aria-label') || a.textContent || '').trim() })),
);
console.log('SIDEBAR', JSON.stringify(navLinks, null, 2));
await shot(page, 'sidebar-full');

const EXPECTED_HIDDEN_FOR_MANAGER = ['/reports', '/analytics', '/permissions', '/payroll'];
const visibleSensitive = navLinks.filter((n) => EXPECTED_HIDDEN_FOR_MANAGER.some((h) => (n.href || '').startsWith(h)));
if (visibleSensitive.length) {
  addFinding({
    severity: 'HIGH',
    layer: 'FRONTEND',
    title: 'Sidebar not role-filtered for MANAGER — sensitive menus visible',
    evidence: {
      visible: visibleSensitive,
      note: 'Deep-links may DENY, but nav shows Reports/Analytics/Permissions/Payroll to MANAGER',
      screenshot: '02-sidebar-full.png',
    },
  });
}

// ─── Helper: visit route deep ────────────────────────────────────────────
async function visitDeep(route, menuName, deepFns = []) {
  console.log(`\n=== ${menuName} (${route}) ===`);
  drainApiFails();
  await page.goto(`${FE}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await waitSettle(page, 1500);
  let fails = drainApiFails();
  let text = await bodyText(page);
  let cls = classifyPage(text, page.url(), fails);
  const landShot = await shot(page, `${menuName}-land`);
  if (cls.state !== 'OK') {
    addFinding({
      severity: cls.state === 'DENY' ? 'MEDIUM' : 'HIGH',
      layer: cls.layer || 'UNKNOWN',
      title: `${menuName}: ${cls.state} — ${cls.note}`,
      evidence: { url: page.url(), route, api: fails, screenshot: landShot, console: consoleLog.slice(-5) },
    });
  } else {
    addFinding({
      severity: 'INFO',
      layer: 'OK',
      title: `${menuName}: page OK`,
      evidence: { url: page.url(), screenshot: landShot, api4xx: fails.filter((a) => a.status >= 400) },
    });
  }

  // tabs
  const tabNames = await clickTabs(page);
  if (tabNames.length) {
    fails = drainApiFails();
    await shot(page, `${menuName}-tabs-explored`);
    if (fails.some((a) => a.status >= 400)) {
      addFinding({
        severity: 'MEDIUM',
        layer: fails.some((a) => a.status >= 500) ? 'BACKEND' : 'FRONTEND',
        title: `${menuName}: API errors while switching tabs`,
        evidence: { tabs: tabNames, api: fails, url: page.url() },
      });
    }
  }

  // generic buttons (non-destructive first)
  const safeBtns = [
    'button:has-text("Export")',
    'button:has-text("Download")',
    'button:has-text("CSV")',
    'button:has-text("Excel")',
    'button:has-text("PDF")',
    'button:has-text("Filter")',
    'button:has-text("View")',
    'button:has-text("Details")',
    'button:has-text("Team")',
    'button:has-text("My")',
    'a:has-text("View")',
    'button:has-text("Refresh")',
  ];
  const clicked = await clickAllVisible(page, safeBtns, { max: 4, labelPrefix: menuName });
  if (clicked.length) {
    fails = drainApiFails();
    await shot(page, `${menuName}-actions`);
    await dismissOverlays(page);
  }

  for (const fn of deepFns) {
    try {
      await fn();
    } catch (e) {
      addFinding({
        severity: 'MEDIUM',
        layer: 'FRONTEND',
        title: `${menuName}: deep action threw — ${e.message}`,
        evidence: { url: page.url() },
      });
    }
  }

  await dismissOverlays(page);
  return { cls, fails, landShot };
}

// ─── DASHBOARD deep (approvals) ──────────────────────────────────────────
await visitDeep('/dashboard', 'dashboard', [
  async () => {
    // Look for Approvals section / pending leave / regularization
    const approvalSection = page.locator('text=/approval|pending|awaiting/i').first();
    if (await approvalSection.isVisible().catch(() => false)) {
      await shot(page, 'dashboard-approvals-section');
    }

    // Team widgets
    for (const label of ['Team', 'Leave', 'Attendance', 'Approvals', 'Pending']) {
      const btn = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click().catch(() => {});
        await waitSettle(page, 800);
        await shot(page, `dashboard-btn-${label.toLowerCase()}`);
      }
      const link = page.getByRole('link', { name: new RegExp(label, 'i') }).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click().catch(() => {});
        await waitSettle(page, 1000);
        await shot(page, `dashboard-link-${label.toLowerCase()}`);
        // back if navigated away
        if (!page.url().includes('/dashboard')) {
          await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await waitSettle(page, 1000);
        }
      }
    }

    // Approve / Deny buttons on dashboard
    const approveBtns = page.locator('button:has-text("Approve"), button:has-text("Accept")');
    const denyBtns = page.locator('button:has-text("Deny"), button:has-text("Reject")');
    const aCount = await approveBtns.count();
    const dCount = await denyBtns.count();
    console.log(`Dashboard Approve=${aCount} Deny=${dCount}`);
    await shot(page, 'dashboard-approve-deny-visible');

    if (dCount > 0) {
      drainApiFails();
      const beforeUrl = page.url();
      await denyBtns.first().click({ timeout: 5000 }).catch(() => {});
      await waitSettle(page, 600);
      // confirm modal?
      const confirm = page.locator('button:has-text("Confirm"), button:has-text("Deny"), button:has-text("Reject"), button:has-text("Yes")').last();
      if (await confirm.isVisible().catch(() => false)) {
        // Prefer Cancel if this is destructive confirmation — but user asked to test Deny
        const reason = page.locator('textarea, input[name="reason"], input[name="comment"]');
        if (await reason.first().isVisible().catch(() => false)) {
          await reason.first().fill('E2E manager deny test');
        }
        await shot(page, 'dashboard-deny-confirm-modal');
        await confirm.click().catch(() => {});
        await waitSettle(page, 1500);
        const fails = drainApiFails();
        const mutShot = await shot(page, 'dashboard-deny-result');
        mutations.push({ action: 'DENY', from: 'dashboard', api: fails, screenshot: mutShot });
        const ok = fails.some((f) => f.method !== 'GET' && f.status >= 200 && f.status < 300);
        const bad = fails.filter((f) => f.method !== 'GET' && f.status >= 400);
        if (bad.length) {
          addFinding({
            severity: 'CRITICAL',
            layer: 'BACKEND',
            title: 'Dashboard Deny failed with API error',
            evidence: { api: bad, screenshot: mutShot, url: beforeUrl },
          });
        } else if (ok || fails.length === 0) {
          addFinding({
            severity: 'INFO',
            layer: 'OK',
            title: 'Dashboard Deny attempted (mutation)',
            evidence: { api: fails, screenshot: mutShot },
          });
        }
      } else {
        await shot(page, 'dashboard-deny-no-confirm');
        await dismissOverlays(page);
      }
    }

    if (aCount > 0) {
      drainApiFails();
      await approveBtns.first().click({ timeout: 5000 }).catch(() => {});
      await waitSettle(page, 600);
      const confirm = page.locator('button:has-text("Confirm"), button:has-text("Approve"), button:has-text("Yes")').last();
      if (await confirm.isVisible().catch(() => false)) {
        await shot(page, 'dashboard-approve-confirm-modal');
        await confirm.click().catch(() => {});
        await waitSettle(page, 1500);
        const fails = drainApiFails();
        const mutShot = await shot(page, 'dashboard-approve-result');
        mutations.push({ action: 'APPROVE', from: 'dashboard', api: fails, screenshot: mutShot });
        const bad = fails.filter((f) => f.method !== 'GET' && f.status >= 400);
        if (bad.length) {
          addFinding({
            severity: 'CRITICAL',
            layer: bad[0].status >= 500 ? 'BACKEND' : 'BACKEND',
            title: 'Dashboard Approve failed with API error',
            evidence: { api: bad, screenshot: mutShot },
          });
        } else {
          addFinding({
            severity: 'INFO',
            layer: 'OK',
            title: 'Dashboard Approve attempted (mutation)',
            evidence: { api: fails, screenshot: mutShot },
          });
        }
      } else {
        // maybe instant approve
        const fails = drainApiFails();
        await shot(page, 'dashboard-approve-instant');
        mutations.push({ action: 'APPROVE_INSTANT', from: 'dashboard', api: fails });
      }
    }

    if (aCount === 0 && dCount === 0) {
      addFinding({
        severity: 'MEDIUM',
        layer: 'FRONTEND',
        title: 'Dashboard: no Approve/Deny controls visible for MANAGER',
        evidence: { screenshot: 'dashboard-approve-deny-visible', note: 'May be empty queue or missing UI affordance' },
      });
    }
  },
]);

// ─── EMPLOYEES ───────────────────────────────────────────────────────────
await visitDeep('/employees', 'employees', [
  async () => {
    // open first employee row
    const row = page.locator('table tbody tr, [data-row], a[href*="/employees/"]').first();
    if (await row.isVisible().catch(() => false)) {
      await row.click().catch(() => {});
      await waitSettle(page, 1200);
      const fails = drainApiFails();
      await shot(page, 'employees-detail');
      if (fails.some((f) => f.status === 403)) {
        addFinding({
          severity: 'HIGH',
          layer: 'BACKEND',
          title: 'Employees detail 403 for MANAGER',
          evidence: { api: fails, url: page.url() },
        });
      }
      // check Add Employee should be hidden
    }
    const addBtn = page.locator('button:has-text("Add Employee"), a:has-text("Add Employee"), button:has-text("New Employee")');
    if (await addBtn.first().isVisible().catch(() => false)) {
      addFinding({
        severity: 'HIGH',
        layer: 'FRONTEND',
        title: 'MANAGER sees Add Employee control (should be HR/Admin only)',
        evidence: { screenshot: await shot(page, 'employees-add-visible-auth-issue') },
      });
    }
  },
]);

await visitDeep('/departments', 'departments');

// ─── ATTENDANCE (team) ───────────────────────────────────────────────────
await visitDeep('/attendance', 'attendance', [
  async () => {
    await clickTabs(page);
    await shot(page, 'attendance-after-tabs');
    // Team attendance
    for (const name of [/team/i, /records/i, /regulariz/i, /calendar/i, /summary/i]) {
      const tab = page.getByRole('tab', { name }).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await waitSettle(page, 1000);
        const fails = drainApiFails();
        await shot(page, `attendance-tab-${String(name).replace(/\W/g, '')}`);
        if (fails.some((f) => f.status >= 400)) {
          addFinding({
            severity: 'HIGH',
            layer: fails.some((f) => f.status >= 500) ? 'BACKEND' : 'BACKEND',
            title: `Attendance tab API error (${name})`,
            evidence: { api: fails, url: page.url() },
          });
        }
      }
    }
    // Check-in / Check-out if present
    for (const label of ['Check in', 'Check-in', 'Check out', 'Check-out']) {
      const b = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
      if (await b.isVisible().catch(() => false)) {
        drainApiFails();
        await b.click().catch(() => {});
        await waitSettle(page, 1000);
        const fails = drainApiFails();
        const s = await shot(page, `attendance-${label.replace(/\s+/g, '-').toLowerCase()}-result`);
        mutations.push({ action: label, from: 'attendance', api: fails, screenshot: s });
        if (fails.some((f) => f.method !== 'GET' && f.status >= 400)) {
          addFinding({
            severity: 'HIGH',
            layer: 'BACKEND',
            title: `Attendance ${label} API failed`,
            evidence: { api: fails, screenshot: s },
          });
        }
        break; // only one mutation
      }
    }
    // Export
    const exp = page.locator('button:has-text("Export"), button:has-text("CSV"), button:has-text("Excel"), button:has-text("PDF")');
    if (await exp.first().isVisible().catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
        exp.first().click().catch(() => {}),
      ]);
      await waitSettle(page, 1000);
      const fails = drainApiFails();
      await shot(page, 'attendance-export-result');
      if (download) {
        addFinding({ severity: 'INFO', layer: 'OK', title: `Attendance export downloaded: ${download.suggestedFilename()}`, evidence: { api: fails } });
      } else if (fails.some((f) => f.status >= 400)) {
        addFinding({ severity: 'HIGH', layer: 'BACKEND', title: 'Attendance export API error', evidence: { api: fails } });
      }
    }
  },
]);

// ─── TIMESHEETS approvals ────────────────────────────────────────────────
await visitDeep('/timesheets', 'timesheets', [
  async () => {
    for (const name of [/approv/i, /team/i, /my/i, /template/i, /delegat/i, /pending/i]) {
      const tab = page.getByRole('tab', { name }).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await waitSettle(page, 1200);
        const fails = drainApiFails();
        await shot(page, `timesheets-tab-${String(name).replace(/\W/g, '')}`);
        if (fails.some((f) => f.status >= 400)) {
          addFinding({
            severity: 'HIGH',
            layer: 'BACKEND',
            title: `Timesheets tab API error (${name})`,
            evidence: { api: fails, url: page.url() },
          });
        }
      }
    }
    // Also try nav/buttons labeled Approvals
    const apprLink = page.locator('button:has-text("Approvals"), a:has-text("Approvals"), [role="tab"]:has-text("Approvals")').first();
    if (await apprLink.isVisible().catch(() => false)) {
      await apprLink.click();
      await waitSettle(page, 1200);
      await shot(page, 'timesheets-approvals-view');
    }

    const approveBtns = page.locator('button:has-text("Approve")');
    const rejectBtns = page.locator('button:has-text("Reject"), button:has-text("Deny")');
    console.log(`Timesheet Approve=${await approveBtns.count()} Reject=${await rejectBtns.count()}`);
    if ((await rejectBtns.count()) > 0) {
      drainApiFails();
      await rejectBtns.first().click().catch(() => {});
      await waitSettle(page, 600);
      const reason = page.locator('textarea, input[name="reason"]');
      if (await reason.first().isVisible().catch(() => false)) await reason.first().fill('E2E timesheet reject');
      const confirm = page.locator('[role="dialog"] button:has-text("Reject"), [role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Deny")').last();
      if (await confirm.isVisible().catch(() => false)) {
        await shot(page, 'timesheets-reject-modal');
        await confirm.click();
        await waitSettle(page, 1500);
        const fails = drainApiFails();
        const s = await shot(page, 'timesheets-reject-result');
        mutations.push({ action: 'TIMESHEET_REJECT', api: fails, screenshot: s });
        if (fails.some((f) => f.method !== 'GET' && f.status >= 400)) {
          addFinding({ severity: 'CRITICAL', layer: 'BACKEND', title: 'Timesheet reject API failed', evidence: { api: fails, screenshot: s } });
        }
      } else {
        await dismissOverlays(page);
      }
    } else if ((await approveBtns.count()) > 0) {
      drainApiFails();
      await approveBtns.first().click().catch(() => {});
      await waitSettle(page, 600);
      const confirm = page.locator('[role="dialog"] button:has-text("Approve"), [role="dialog"] button:has-text("Confirm")').last();
      if (await confirm.isVisible().catch(() => false)) {
        await shot(page, 'timesheets-approve-modal');
        await confirm.click();
        await waitSettle(page, 1500);
        const fails = drainApiFails();
        const s = await shot(page, 'timesheets-approve-result');
        mutations.push({ action: 'TIMESHEET_APPROVE', api: fails, screenshot: s });
        if (fails.some((f) => f.method !== 'GET' && f.status >= 400)) {
          addFinding({ severity: 'CRITICAL', layer: 'BACKEND', title: 'Timesheet approve API failed', evidence: { api: fails, screenshot: s } });
        }
      }
    } else {
      addFinding({
        severity: 'INFO',
        layer: 'OK',
        title: 'Timesheets: no pending Approve/Reject controls (empty queue or different UX)',
        evidence: { url: page.url() },
      });
    }
  },
]);

// ─── LEAVE (team) ────────────────────────────────────────────────────────
await visitDeep('/leave', 'leave', [
  async () => {
    for (const name of [/team/i, /request/i, /balance/i, /calendar/i, /approv/i, /my/i]) {
      const tab = page.getByRole('tab', { name }).first();
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await waitSettle(page, 1000);
        const fails = drainApiFails();
        await shot(page, `leave-tab-${String(name).replace(/\W/g, '')}`);
        if (fails.some((f) => f.status >= 400)) {
          addFinding({
            severity: 'HIGH',
            layer: 'BACKEND',
            title: `Leave tab API error (${name})`,
            evidence: { api: fails, url: page.url() },
          });
        }
      }
    }
    const approveBtns = page.locator('button:has-text("Approve")');
    const rejectBtns = page.locator('button:has-text("Reject"), button:has-text("Deny")');
    console.log(`Leave Approve=${await approveBtns.count()} Reject=${await rejectBtns.count()}`);
    await shot(page, 'leave-approve-deny-controls');
    if ((await rejectBtns.count()) > 0) {
      drainApiFails();
      await rejectBtns.first().click().catch(() => {});
      await waitSettle(page, 600);
      const reason = page.locator('textarea, input[name="reason"]');
      if (await reason.first().isVisible().catch(() => false)) await reason.first().fill('E2E leave reject by manager');
      const confirm = page.locator('[role="dialog"] button:has-text("Reject"), [role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Deny")').last();
      await shot(page, 'leave-reject-modal');
      if (await confirm.isVisible().catch(() => false)) {
        await confirm.click();
        await waitSettle(page, 1500);
        const fails = drainApiFails();
        const s = await shot(page, 'leave-reject-result');
        mutations.push({ action: 'LEAVE_REJECT', api: fails, screenshot: s });
        if (fails.some((f) => f.method !== 'GET' && f.status >= 400)) {
          addFinding({ severity: 'CRITICAL', layer: 'BACKEND', title: 'Leave reject API failed', evidence: { api: fails, screenshot: s } });
        } else {
          addFinding({ severity: 'INFO', layer: 'OK', title: 'Leave reject succeeded (mutation)', evidence: { api: fails, screenshot: s } });
        }
      } else {
        // maybe needs detail page
        await dismissOverlays(page);
      }
    }
    // Apply leave button
    const apply = page.locator('button:has-text("Apply"), button:has-text("Request Leave"), button:has-text("New Request")').first();
    if (await apply.isVisible().catch(() => false)) {
      await apply.click();
      await waitSettle(page, 800);
      await shot(page, 'leave-apply-modal');
      await dismissOverlays(page);
    }
  },
]);

await visitDeep('/holidays', 'holidays');

// ─── PAYROLL (likely should be restricted) ───────────────────────────────
await visitDeep('/payroll', 'payroll', [
  async () => {
    const text = await bodyText(page);
    if (!/access restricted|permission/i.test(text)) {
      // Manager can see payroll — check scope
      addFinding({
        severity: 'MEDIUM',
        layer: 'FRONTEND',
        title: 'MANAGER can open Payroll page (verify expected scope — my payslips vs org runs)',
        evidence: { url: page.url(), screenshot: 'payroll-land', snippet: text.slice(0, 300) },
      });
    }
    await clickTabs(page);
    await shot(page, 'payroll-tabs');
  },
]);

await visitDeep('/payout-methods', 'payout-methods');

// ─── REPORTS / ANALYTICS / PERMISSIONS (auth matrix) ─────────────────────
for (const [route, name] of [
  ['/reports', 'reports'],
  ['/analytics', 'analytics'],
  ['/permissions', 'permissions'],
]) {
  await visitDeep(route, name, [
    async () => {
      const text = await bodyText(page);
      const denied = /access restricted|permission|forbidden|not authorized/i.test(text);
      // Try export buttons if page somehow accessible
      if (!denied) {
        const exp = page.locator('button:has-text("Export"), button:has-text("CSV"), button:has-text("Excel"), button:has-text("PDF"), button:has-text("Download")');
        if (await exp.first().isVisible().catch(() => false)) {
          drainApiFails();
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
            exp.first().click().catch(() => {}),
          ]);
          await waitSettle(page, 1000);
          const fails = drainApiFails();
          await shot(page, `${name}-export-attempt`);
          if (fails.some((f) => f.status === 403)) {
            addFinding({
              severity: 'HIGH',
              layer: 'FRONTEND',
              title: `${name}: UI shows export but API 403 for MANAGER`,
              evidence: { api: fails },
            });
          } else if (download) {
            addFinding({
              severity: 'CRITICAL',
              layer: 'BACKEND',
              title: `${name}: MANAGER was able to export (${download.suggestedFilename()}) — auth gap?`,
              evidence: { api: fails },
            });
          }
        }
        addFinding({
          severity: 'HIGH',
          layer: pageApiFails.some((a) => a.status === 403) ? 'FRONTEND' : 'BACKEND',
          title: `${name}: page accessible to MANAGER (expected DENY for Reports/Analytics/Permissions)`,
          evidence: { url: page.url(), text: text.slice(0, 200) },
        });
      } else {
        addFinding({
          severity: 'INFO',
          layer: 'OK',
          title: `${name}: correctly DENY for MANAGER (but sidebar still shows link — FE nav issue)`,
          evidence: { url: page.url() },
        });
      }
    },
  ]);
}

await visitDeep('/settings', 'settings', [
  async () => {
    const links = page.locator('a[href*="/settings"], nav a, [role="tab"]');
    const n = await links.count();
    for (let i = 0; i < Math.min(n, 10); i++) {
      const el = links.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const label = ((await el.innerText().catch(() => '')) || '').trim().slice(0, 30);
      await el.click().catch(() => {});
      await waitSettle(page, 800);
      const fails = drainApiFails();
      if (i < 5) await shot(page, `settings-sub-${i}-${label.replace(/\W/g, '') || 'item'}`);
      if (fails.some((f) => f.status >= 500)) {
        addFinding({ severity: 'HIGH', layer: 'BACKEND', title: `Settings subpage 5xx: ${label}`, evidence: { api: fails, url: page.url() } });
      }
    }
  },
]);

await visitDeep('/recruitment', 'recruitment');
await visitDeep('/performance', 'performance');
await visitDeep('/assets', 'assets');
await visitDeep('/announcements', 'announcements', [
  async () => {
    const create = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Announce")').first();
    if (await create.isVisible().catch(() => false)) {
      await create.click();
      await waitSettle(page, 600);
      await shot(page, 'announcements-create-modal');
      await dismissOverlays(page);
    }
  },
]);

// Notifications bell
const bell = page.locator('button[aria-label*="otif"], button:has([class*="bell"]), [aria-label="Notifications"]').first();
if (await bell.isVisible().catch(() => false)) {
  await bell.click().catch(() => {});
  await waitSettle(page, 800);
  await shot(page, 'notifications-panel');
  await dismissOverlays(page);
}

// Profile menu
const avatar = page.locator('button:has([data-slot="avatar"]), header button').last();
if (await avatar.isVisible().catch(() => false)) {
  await avatar.click().catch(() => {});
  await waitSettle(page, 500);
  await shot(page, 'profile-menu');
  await page.keyboard.press('Escape');
}

// Aggregate API 4xx/5xx unique
const badApi = {};
for (const a of apiLog) {
  if (a.status < 400) continue;
  const key = `${a.method} ${a.status} ${a.path.split('?')[0]}`;
  badApi[key] = (badApi[key] || 0) + 1;
}

const summary = {
  role: 'MANAGER',
  email: 'aman@acme.test',
  screenshots: shotN,
  findingsCount: findings.length,
  bySeverity: findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {}),
  byLayer: findings.reduce((acc, f) => {
    acc[f.layer] = (acc[f.layer] || 0) + 1;
    return acc;
  }, {}),
  mutations,
  badApi,
  consoleErrors: consoleLog.length,
  sidebar: navLinks,
};

fs.writeFileSync(OUT, JSON.stringify({ summary, findings, mutations, badApi, consoleLog: consoleLog.slice(0, 80), apiLog: apiLog.filter((a) => a.status >= 400) }, null, 2));
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(summary, null, 2));
await browser.close();
console.log('DONE →', OUT);
