/**
 * Focused follow-up: regularization approve/deny, timesheet 403 body,
 * leave approvals tab, exports, payroll/settings depth.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = 'http://localhost:3001';
const SHOT = '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/manager';
let shotN = 61; // continue numbering
const findings = [];
const apiAll = [];
const mutations = [];

function add(f) {
  findings.push({ ts: new Date().toISOString(), ...f });
  console.log(`[${f.severity}][${f.layer}] ${f.title}`);
}

async function shot(page, label) {
  shotN += 1;
  const nn = String(shotN).padStart(2, '0');
  const safe = label.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').slice(0, 80);
  const file = `${nn}-${safe}.png`;
  await page.screenshot({ path: path.join(SHOT, file), fullPage: true }).catch(() => {});
  console.log('SHOT', file);
  return file;
}

async function settle(page, ms = 1000) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();

page.on('response', async (r) => {
  if (!/\/api\//.test(r.url())) return;
  let body = null;
  try {
    if (r.status() >= 400) body = await r.text().catch(() => null);
  } catch { /* */ }
  apiAll.push({
    status: r.status(),
    method: r.request().method(),
    path: (() => { try { const u = new URL(r.url()); return u.pathname + u.search; } catch { return r.url(); } })(),
    body: body ? body.slice(0, 800) : null,
  });
});

// Login
await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await settle(page, 800);
await page.fill('#email', 'aman@acme.test');
await page.fill('#password', 'Password123!');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });
await settle(page, 2000);
await shot(page, 'followup-login-dashboard');

// ── 1. Regularization Deny with Confirm ──────────────────────────────────
console.log('\n=== REG DENY ===');
await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
await settle(page, 1500);
const denyLink = page.locator('button:has-text("Deny"), a:has-text("Deny")').first();
if (await denyLink.isVisible().catch(() => false)) {
  await denyLink.click();
  await settle(page, 500);
  const reason = page.locator('input[placeholder*="Reason"], textarea, input:near(:text("Reason for denial"))').first();
  // Prefer the visible denial input
  const reasonInput = page.getByPlaceholder(/reason/i).first();
  if (await reasonInput.isVisible().catch(() => false)) {
    await reasonInput.fill('E2E manager deny — insufficient documentation');
  } else if (await page.locator('text=Reason for denial').isVisible().catch(() => false)) {
    await page.locator('text=Reason for denial').locator('..').locator('input, textarea').first().fill('E2E manager deny');
  }
  await shot(page, 'reg-deny-filled');
  const before = apiAll.length;
  const confirm = page.getByRole('button', { name: /^Confirm$/i }).first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
    await settle(page, 2000);
    const after = apiAll.slice(before);
    const s = await shot(page, 'reg-deny-confirmed-result');
    mutations.push({ action: 'REG_DENY', api: after, screenshot: s });
    const bad = after.filter((a) => a.method !== 'GET' && a.status >= 400);
    const ok = after.filter((a) => a.method !== 'GET' && a.status >= 200 && a.status < 300);
    if (bad.length) {
      add({ severity: 'CRITICAL', layer: 'BACKEND', title: 'Regularization Deny API failed', evidence: { api: bad, screenshot: s } });
    } else if (ok.length) {
      add({ severity: 'INFO', layer: 'OK', title: `Regularization Deny succeeded (${ok.map((a) => `${a.method} ${a.status} ${a.path}`).join(', ')})`, evidence: { api: ok, screenshot: s } });
    } else {
      add({ severity: 'HIGH', layer: 'FRONTEND', title: 'Regularization Deny Confirm clicked but no mutating API call observed', evidence: { api: after, screenshot: s } });
    }
  }
}

// ── 2. Regularization Approve ────────────────────────────────────────────
console.log('\n=== REG APPROVE ===');
await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
await settle(page, 1500);
const approveLink = page.locator('button:has-text("Approve"), a:has-text("Approve")').filter({ hasNotText: /Bulk|selected/i }).first();
if (await approveLink.isVisible().catch(() => false)) {
  const before = apiAll.length;
  await approveLink.click();
  await settle(page, 800);
  // confirm if any
  const confirm = page.getByRole('button', { name: /^Confirm$/i }).first();
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  await settle(page, 2000);
  const after = apiAll.slice(before);
  const s = await shot(page, 'reg-approve-result');
  mutations.push({ action: 'REG_APPROVE', api: after, screenshot: s });
  const bad = after.filter((a) => a.method !== 'GET' && a.status >= 400);
  const ok = after.filter((a) => a.method !== 'GET' && a.status >= 200 && a.status < 300);
  if (bad.length) add({ severity: 'CRITICAL', layer: 'BACKEND', title: 'Regularization Approve API failed', evidence: { api: bad, screenshot: s } });
  else if (ok.length) add({ severity: 'INFO', layer: 'OK', title: `Regularization Approve OK (${ok.map((a) => `${a.status} ${a.path}`).join(', ')})`, evidence: { api: ok, screenshot: s } });
  else add({ severity: 'HIGH', layer: 'FRONTEND', title: 'Regularization Approve clicked — no mutating API observed', evidence: { api: after, screenshot: s } });
}

// Bulk approve leave empty while reg pending
await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
await settle(page, 1000);
const bulk = page.getByRole('button', { name: /Bulk approve/i }).first();
if (await bulk.isVisible().catch(() => false)) {
  await bulk.click();
  await settle(page, 800);
  const s = await shot(page, 'bulk-approve-leave-empty-while-reg-pending');
  const text = await page.evaluate(() => document.body.innerText);
  if (/No pending leave/i.test(text) && /reg/i.test(text)) {
    add({
      severity: 'HIGH',
      layer: 'FRONTEND',
      title: 'Bulk approve only covers Leave — ignores pending Regularization queue (4 reg shown)',
      evidence: { screenshot: s, note: 'Modal title: Bulk Approve Leave Requests; Pending Approvals card shows regularization items' },
    });
  } else if (/No pending leave/i.test(text)) {
    add({
      severity: 'HIGH',
      layer: 'FRONTEND',
      title: 'Bulk approve opens Leave-only modal (empty) while dashboard shows pending regularization approvals',
      evidence: { screenshot: s },
    });
  }
  await page.keyboard.press('Escape');
}

// ── 3. Timesheet Approve → capture 403 ───────────────────────────────────
console.log('\n=== TIMESHEET APPROVE ===');
await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
await settle(page, 1500);
const apprTab = page.getByRole('tab', { name: /Approvals/i }).first();
if (await apprTab.isVisible().catch(() => false)) {
  await apprTab.click();
  await settle(page, 1500);
}
await shot(page, 'timesheets-approvals-before-approve');
// Prefer approving someone who is NOT self (Aman Kumar)
const rows = page.locator('table tbody tr');
const rowCount = await rows.count();
let clicked = false;
for (let i = 0; i < rowCount; i++) {
  const row = rows.nth(i);
  const name = (await row.innerText().catch(() => '')) || '';
  if (/Aman Kumar/i.test(name)) continue;
  const btn = row.locator('button:has-text("Approve"), button[aria-label*="Approve"]').first();
  if (await btn.isVisible().catch(() => false)) {
    const before = apiAll.length;
    await btn.click();
    await settle(page, 600);
    const conf = page.locator('[role="dialog"] button:has-text("Approve"), [role="dialog"] button:has-text("Confirm")').last();
    if (await conf.isVisible().catch(() => false)) {
      await shot(page, 'timesheet-approve-modal');
      await conf.click();
    }
    await settle(page, 2000);
    const after = apiAll.slice(before);
    const s = await shot(page, 'timesheet-approve-api-result');
    mutations.push({ action: 'TIMESHEET_APPROVE', row: name.slice(0, 80), api: after, screenshot: s });
    const bad = after.filter((a) => a.status >= 400);
    if (bad.length) {
      add({
        severity: 'CRITICAL',
        layer: 'BACKEND',
        title: `Timesheet Approve returned ${bad[0].status} for team member`,
        evidence: { api: bad, row: name.slice(0, 120), screenshot: s },
      });
    } else {
      add({ severity: 'INFO', layer: 'OK', title: 'Timesheet Approve succeeded', evidence: { api: after, screenshot: s } });
    }
    clicked = true;
    break;
  }
}
if (!clicked) {
  // fallback first approve
  const btn = page.locator('button:has-text("Approve")').first();
  if (await btn.isVisible().catch(() => false)) {
    const before = apiAll.length;
    await btn.click();
    await settle(page, 1500);
    const after = apiAll.slice(before);
    const s = await shot(page, 'timesheet-approve-fallback');
    mutations.push({ action: 'TIMESHEET_APPROVE_FALLBACK', api: after, screenshot: s });
    const bad = after.filter((a) => a.status >= 400);
    if (bad.length) {
      add({ severity: 'CRITICAL', layer: 'BACKEND', title: `Timesheet Approve ${bad[0].status}`, evidence: { api: bad, screenshot: s } });
    }
  }
}

// Return/reject timesheet
const ret = page.locator('button:has-text("Return"), button[aria-label*="Return"]').first();
if (await ret.isVisible().catch(() => false)) {
  const before = apiAll.length;
  await ret.click();
  await settle(page, 600);
  const note = page.locator('textarea, input[name="reason"], input[placeholder*="note" i]').first();
  if (await note.isVisible().catch(() => false)) await note.fill('E2E return — please correct hours');
  const conf = page.locator('[role="dialog"] button:has-text("Return"), [role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Submit")').last();
  await shot(page, 'timesheet-return-modal');
  if (await conf.isVisible().catch(() => false)) await conf.click();
  await settle(page, 2000);
  const after = apiAll.slice(before);
  const s = await shot(page, 'timesheet-return-result');
  mutations.push({ action: 'TIMESHEET_RETURN', api: after, screenshot: s });
  const bad = after.filter((a) => a.method !== 'GET' && a.status >= 400);
  if (bad.length) add({ severity: 'CRITICAL', layer: 'BACKEND', title: 'Timesheet Return API failed', evidence: { api: bad, screenshot: s } });
  else if (after.some((a) => a.method !== 'GET' && a.status < 300)) add({ severity: 'INFO', layer: 'OK', title: 'Timesheet Return succeeded', evidence: { api: after, screenshot: s } });
}

// ── 4. Leave Approvals tab ───────────────────────────────────────────────
console.log('\n=== LEAVE APPROVALS ===');
await page.goto(`${FE}/leave`, { waitUntil: 'domcontentloaded' });
await settle(page, 1500);
const leaveAppr = page.getByRole('tab', { name: /Approvals/i }).first();
if (await leaveAppr.isVisible().catch(() => false)) {
  await leaveAppr.click();
  await settle(page, 1500);
  const s = await shot(page, 'leave-approvals-tab');
  const text = await page.evaluate(() => document.body.innerText);
  const apiSlice = apiAll.slice(-30);
  const bad = apiSlice.filter((a) => a.status >= 400 && /leave/i.test(a.path));
  if (bad.length) add({ severity: 'HIGH', layer: 'BACKEND', title: 'Leave Approvals tab API errors', evidence: { api: bad, screenshot: s } });
  if (/no pending|caught up|empty/i.test(text)) {
    add({ severity: 'INFO', layer: 'OK', title: 'Leave Approvals tab empty (matches dashboard 0 leave pending)', evidence: { screenshot: s } });
  }
  // Team calendar
  const cal = page.getByRole('tab', { name: /Team Calendar/i }).first();
  if (await cal.isVisible().catch(() => false)) {
    await cal.click();
    await settle(page, 1200);
    await shot(page, 'leave-team-calendar');
  }
  const comp = page.getByRole('tab', { name: /Comp/i }).first();
  if (await comp.isVisible().catch(() => false)) {
    await comp.click();
    await settle(page, 1000);
    await shot(page, 'leave-compoff-tab');
  }
}

// ── 5. Attendance team + export ──────────────────────────────────────────
console.log('\n=== ATTENDANCE TEAM/EXPORT ===');
await page.goto(`${FE}/attendance`, { waitUntil: 'domcontentloaded' });
await settle(page, 1500);
for (const name of [/Team/i, /Calendar/i, /Regulariz/i, /Records/i, /Summary/i]) {
  const t = page.getByRole('tab', { name }).first();
  if (await t.isVisible().catch(() => false)) {
    await t.click();
    await settle(page, 1000);
    await shot(page, `attendance-deep-${String(name).replace(/\W/g, '')}`);
  }
}
// Also click segmented controls / buttons
for (const label of ['Team', 'My attendance', 'Regularization', 'Export', 'CSV', 'Excel', 'PDF', 'Download']) {
  const b = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
  if (!(await b.isVisible().catch(() => false))) continue;
  const before = apiAll.length;
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
    b.click().catch(() => {}),
  ]);
  await settle(page, 1000);
  const after = apiAll.slice(before);
  const s = await shot(page, `attendance-btn-${label.replace(/\s+/g, '-').toLowerCase()}`);
  if (download) {
    add({ severity: 'INFO', layer: 'OK', title: `Attendance download: ${download.suggestedFilename()} via ${label}`, evidence: { screenshot: s, api: after } });
  }
  if (after.some((a) => a.status >= 400)) {
    add({ severity: 'HIGH', layer: 'BACKEND', title: `Attendance ${label} API error`, evidence: { api: after.filter((a) => a.status >= 400), screenshot: s } });
  }
}

// Present today 0 / all Absent note
await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
await settle(page, 1200);
const dashText = await page.evaluate(() => document.body.innerText);
if (/Present Today[\s\S]{0,40}0/.test(dashText) && /Avg\. Attendance[\s\S]{0,40}0%/.test(dashText)) {
  add({
    severity: 'MEDIUM',
    layer: 'BACKEND',
    title: 'Manager dashboard shows Present Today=0 and Avg Attendance=0% with entire team marked Absent',
    evidence: { screenshot: await shot(page, 'dashboard-zero-attendance-anomaly'), note: 'May be timezone/date seed gap for 2026-08-03 vs attendance seeded earlier' },
  });
}

// ── 6. Payroll depth ─────────────────────────────────────────────────────
console.log('\n=== PAYROLL ===');
await page.goto(`${FE}/payroll`, { waitUntil: 'domcontentloaded' });
await settle(page, 1500);
const pText = await page.evaluate(() => document.body.innerText);
const pShot = await shot(page, 'payroll-manager-view');
if (/access restricted/i.test(pText)) {
  add({ severity: 'INFO', layer: 'OK', title: 'Payroll DENY for MANAGER', evidence: { screenshot: pShot } });
} else {
  add({
    severity: 'MEDIUM',
    layer: 'FRONTEND',
    title: 'MANAGER can access Payroll page — verify scoped to my payslips only',
    evidence: { screenshot: pShot, snippet: pText.slice(0, 400), api: apiAll.filter((a) => /payroll/i.test(a.path)).slice(-10) },
  });
  for (const name of [/My/i, /Payslip/i, /Run/i, /Team/i]) {
    const t = page.getByRole('tab', { name }).first();
    if (await t.isVisible().catch(() => false)) {
      await t.click();
      await settle(page, 800);
      await shot(page, `payroll-tab-${String(name).replace(/\W/g, '')}`);
    }
  }
  // Run payroll button?
  if (await page.getByRole('button', { name: /Run payroll|Create run|Process/i }).first().isVisible().catch(() => false)) {
    add({
      severity: 'CRITICAL',
      layer: 'FRONTEND',
      title: 'MANAGER sees payroll run controls (should be HR/Admin)',
      evidence: { screenshot: await shot(page, 'payroll-run-control-visible') },
    });
  }
}

// ── 7. Settings real pages ───────────────────────────────────────────────
console.log('\n=== SETTINGS ===');
const settingsRoutes = [
  '/settings',
  '/settings/company-profile',
  '/settings/locale',
  '/settings/working-hours',
  '/settings/pay/components',
  '/settings/email-templates',
  '/settings/roles-permissions',
];
for (const route of settingsRoutes) {
  await page.goto(`${FE}${route}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, 1000);
  const text = await page.evaluate(() => document.body.innerText);
  const s = await shot(page, `settings-route-${route.replace(/\//g, '-').replace(/^-/, '')}`);
  const recent = apiAll.slice(-15).filter((a) => a.status >= 400);
  if (/access restricted|forbidden/i.test(text)) {
    add({ severity: 'INFO', layer: 'OK', title: `Settings ${route} DENY`, evidence: { screenshot: s } });
  } else if (/something went wrong|failed to load/i.test(text) || recent.some((a) => a.status >= 500)) {
    add({ severity: 'HIGH', layer: 'BACKEND', title: `Settings ${route} error`, evidence: { screenshot: s, api: recent } });
  } else if (route.includes('roles-permissions') || route.includes('pay/')) {
    add({
      severity: 'HIGH',
      layer: 'FRONTEND',
      title: `MANAGER can open privileged settings route ${route}`,
      evidence: { screenshot: s, snippet: text.slice(0, 200) },
    });
  }
}

// ── 8. Employees export / Add ────────────────────────────────────────────
await page.goto(`${FE}/employees`, { waitUntil: 'domcontentloaded' });
await settle(page, 1200);
const addEmp = page.getByRole('button', { name: /Add Employee|New Employee/i }).first();
if (await addEmp.isVisible().catch(() => false)) {
  add({ severity: 'HIGH', layer: 'FRONTEND', title: 'Add Employee visible to MANAGER', evidence: { screenshot: await shot(page, 'employees-add-btn-manager') } });
}
const exp = page.getByRole('button', { name: /Export|CSV|Excel|Download/i }).first();
if (await exp.isVisible().catch(() => false)) {
  const before = apiAll.length;
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
    exp.click().catch(() => {}),
  ]);
  await settle(page, 1500);
  // maybe format menu
  for (const fmt of ['CSV', 'Excel', 'PDF', 'XLSX']) {
    const m = page.getByRole('menuitem', { name: new RegExp(fmt, 'i') }).first();
    if (await m.isVisible().catch(() => false)) {
      const [d2] = await Promise.all([
        page.waitForEvent('download', { timeout: 8000 }).catch(() => null),
        m.click().catch(() => {}),
      ]);
      await settle(page, 1000);
      if (d2) add({ severity: 'INFO', layer: 'OK', title: `Employees export ${fmt}: ${d2.suggestedFilename()}`, evidence: {} });
    }
  }
  const after = apiAll.slice(before);
  const s = await shot(page, 'employees-export-attempt');
  if (after.some((a) => a.status === 403)) {
    add({ severity: 'HIGH', layer: 'FRONTEND', title: 'Employees export UI shown but API 403 for MANAGER', evidence: { api: after.filter((a) => a.status >= 400), screenshot: s } });
  } else if (download || after.some((a) => /export/i.test(a.path) && a.status < 300)) {
    add({ severity: 'MEDIUM', layer: 'BACKEND', title: 'MANAGER able to trigger employees export', evidence: { api: after, screenshot: s } });
  }
}

// Notifications
const bell = page.locator('[aria-label*="otif" i], button:has-text("Notifications")').first();
// try header bell
const bell2 = page.locator('header button').nth(1);
await page.locator('header').locator('button').filter({ has: page.locator('svg') }).nth(1).click().catch(() => {});
await settle(page, 600);
await shot(page, 'notifications-followup');

const badApi = {};
for (const a of apiAll) {
  if (a.status < 400) continue;
  const k = `${a.method} ${a.status} ${a.path.split('?')[0]}`;
  if (!badApi[k]) badApi[k] = { count: 0, body: a.body };
  badApi[k].count++;
}

const out = { findings, mutations, badApi, apiErrors: apiAll.filter((a) => a.status >= 400), shotN };
fs.writeFileSync(path.join(SHOT, '_followup.json'), JSON.stringify(out, null, 2));
console.log('\n=== FOLLOWUP SUMMARY ===');
console.log(JSON.stringify({ findings: findings.length, mutations: mutations.length, badApi, shotN }, null, 2));
await browser.close();
