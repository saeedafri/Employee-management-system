/**
 * STRESS + DEEP E2E SHORT — EMPLOYEE self-service
 * Login: priya@acme.test / Password123!
 * FE :3001 → BE :4000
 * Focus: Attendance CI/CO, Leave (all types+AL), Timesheets, Payslip drawer, Notifications
 * Stress: leave preview ×5, open payslip repeatedly, mark-all-read
 * Shots → docs/e2e-ui-screenshots/stress/emp-self/
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const SHOT =
  process.env.SHOT_DIR ||
  '/Users/mohdsaeedafri/All-Code-Base/EMS/docs/e2e-ui-screenshots/stress/emp-self';
const USER = process.env.QA_EMAIL || 'priya@acme.test';
const PASS = process.env.QA_PASS || 'Password123!';
const TENANT = 'acme-corp-001';

fs.mkdirSync(SHOT, { recursive: true });
for (const f of fs.readdirSync(SHOT)) {
  if (f.endsWith('.png') || ['results.json', 'FINDINGS.md', '_run.log'].includes(f)) {
    // keep script; wipe prior evidence
    if (f.endsWith('.png') || f === 'results.json') fs.unlinkSync(path.join(SHOT, f));
  }
}

let shotIdx = 0;
const screenshots = [];
const findings = [];
const mutations = [];
const stress = {
  leavePreviewCalls: [],
  payslipOpens: [],
  markAllRead: [],
};
const seen = new Set();
let apiLog = [];
let consoleLog = [];
let page;

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52);
}

function persist() {
  fs.writeFileSync(
    path.join(SHOT, 'results.json'),
    JSON.stringify(
      {
        user: USER,
        role: 'EMPLOYEE',
        tenant: TENANT,
        fe: FE,
        mode: 'STRESS+DEEP-SHORT',
        shotCount: shotIdx,
        findings,
        mutations,
        stress,
        screenshots,
        consoleErrors: consoleLog.slice(0, 40),
      },
      null,
      2,
    ),
  );
}

async function shot(name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  await page.screenshot({ path: path.join(SHOT, file), fullPage: false }).catch(() => {});
  screenshots.push({ file, url: page.url(), name });
  console.log(`  📸 ${file}`);
  persist();
  return file;
}

function note(issue) {
  const key = `${issue.layer}|${issue.where}|${String(issue.why).slice(0, 80)}`;
  if (seen.has(key)) return;
  seen.add(key);
  findings.push({ ...issue, ts: new Date().toISOString() });
  console.log(`  🐛 [${issue.severity}][${issue.layer}] ${issue.where}: ${String(issue.why).slice(0, 140)}`);
  persist();
}

function resetNet() {
  apiLog = [];
}

function fails() {
  return apiLog.filter((c) => c.status >= 400);
}

async function bodyText() {
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

async function settle(ms = 700) {
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function dismiss() {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(100);
  }
  const cancel = page.getByRole('button', { name: /^(cancel|close|dismiss)$/i }).first();
  if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
  await page.waitForTimeout(80);
}

async function gotoHard(href) {
  await dismiss();
  resetNet();
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => {
    console.log(`  nav err ${href}: ${String(e).slice(0, 100)}`);
  });
  await settle(800);
}

async function clickNamed(labels, { timeout = 800 } = {}) {
  for (const label of labels) {
    const btn = page.getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first();
    if (await btn.isVisible({ timeout }).catch(() => false)) {
      await btn.click().catch(() => {});
      return label;
    }
    const any = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
    if (await any.isVisible({ timeout: 250 }).catch(() => false)) {
      await any.click().catch(() => {});
      return label;
    }
    const link = page.getByRole('link', { name: new RegExp(label, 'i') }).first();
    if (await link.isVisible({ timeout: 200 }).catch(() => false)) {
      await link.click().catch(() => {});
      return label;
    }
    const tab = page.getByRole('tab', { name: new RegExp(label, 'i') }).first();
    if (await tab.isVisible({ timeout: 200 }).catch(() => false)) {
      await tab.click().catch(() => {});
      return label;
    }
  }
  return null;
}

async function login() {
  console.log('=== LOGIN ===');
  // Cookie auth via FE BFF — retry under concurrent stress / P1001 tunnel blips
  let loggedIn = false;
  let lastLoginApis = [];
  for (let attempt = 1; attempt <= 6; attempt++) {
    console.log(`  login attempt ${attempt}/6`);
    // networkidle + hydration wait — early click causes native GET with email/password in querystring
    await page.goto(`${FE}/login`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() =>
      page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 }),
    );
    await page.waitForSelector('#email, input[type="email"]', { state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1200);
    if (attempt === 1) await shot('login-form');
    const tenant = page.locator('#tenant, #tenantKey, input[name="tenant"], input[name="tenantKey"]');
    if (await tenant.first().isVisible().catch(() => false)) {
      await tenant.first().fill(TENANT);
    }
    const email = page.locator('#email').first();
    const pass = page.locator('#password').first();
    if (await email.isVisible().catch(() => false)) {
      await email.fill('');
      await email.fill(USER);
      await pass.fill('');
      await pass.fill(PASS);
    } else {
      await page.locator('input[type="email"], input[name="email"]').first().fill(USER);
      await page.locator('input[type="password"]').first().fill(PASS);
    }
    if (attempt === 1) await shot('login-filled');
    resetNet();
    const loginWait = page
      .waitForResponse((r) => r.url().includes('/api/auth/login') && r.request().method() === 'POST', {
        timeout: 45000,
      })
      .catch(() => null);
    await page.locator('button[type="submit"], button:has-text("Sign in")').first().click();
    const loginResp = await loginWait;
    const status = loginResp ? loginResp.status() : null;
    console.log(`  LOGIN API: ${status ?? 'none'} url=${page.url()}`);
    if (/[?&]password=/.test(page.url())) {
      note({
        severity: 'CRITICAL',
        layer: 'FRONTEND',
        where: 'Login form submit (pre-hydration)',
        why: 'Native GET navigated with email+password in querystring (React handler not bound yet)',
        screenshot: screenshots.at(-1)?.file,
        network: page.url().replace(/password=[^&]+/, 'password=REDACTED'),
        id: 'STRESS-EMP-FE-LOGIN-GET',
      });
    }
    await page
      .waitForURL((u) => !u.pathname.includes('/login') || u.pathname.includes('otp'), { timeout: 25000 })
      .catch(() => {});
    await settle(1200);
    lastLoginApis = apiLog.filter((c) => c.method === 'POST' && /auth\/login/i.test(c.url));
    loggedIn = (!page.url().includes('/login') || page.url().includes('otp')) && !/[?&]password=/.test(page.url());
    if (!loggedIn && status === 200) {
      await page.goto(`${FE}/dashboard`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await settle(1000);
      loggedIn = !page.url().includes('/login');
    }
    if (loggedIn) break;
    const body = lastLoginApis.map((p) => p.body || '').join(' ');
    if (status === 500 || /P1001|Can't reach database/i.test(body)) {
      console.log('  DB blip — backoff retry');
      await page.waitForTimeout(1500 * attempt);
      continue;
    }
    await page.waitForTimeout(800 * attempt);
  }
  const sn = await shot(loggedIn ? 'login-success-dashboard' : 'login-fail');
  mutations.push({ action: 'login', apis: lastLoginApis, shot: sn, ok: loggedIn });
  if (!loggedIn) {
    note({
      severity: 'CRITICAL',
      layer: lastLoginApis.some((p) => p.status >= 500) ? 'BACKEND' : 'FRONTEND',
      where: 'Login',
      why: `Login failed after retries → ${page.url()} | ${lastLoginApis
        .map((p) => `${p.status} ${(p.body || '').slice(0, 160)}`)
        .join(' | ')}`,
      screenshot: sn,
      network: lastLoginApis.map((p) => `${p.status} ${p.method} ${p.url}`).join('; ') || 'n/a',
      id: 'STRESS-EMP-LOGIN',
    });
    throw new Error('LOGIN_FAILED');
  }
}

async function attendanceCiCo() {
  console.log('\n=== Attendance CI/CO ===');
  await gotoHard('/attendance');
  await shot('attendance-landing');
  for (const t of ['Calendar', 'Table', 'Regularization']) {
    resetNet();
    if (await clickNamed([t], { timeout: 400 })) {
      await settle(600);
      await shot(`attendance-view-${slug(t)}`);
    }
  }
  // Check-in / Check-out
  for (const label of ['Check in', 'Check-in', 'Clock in', 'Check In']) {
    resetNet();
    const hit = await clickNamed([label], { timeout: 500 });
    if (!hit) continue;
    await settle(1500);
    const sn = await shot('attendance-check-in-result');
    const posts = apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method) && /attendance/i.test(c.url));
    mutations.push({ action: 'attendance-check-in', apis: posts, shot: sn });
    if (posts.some((p) => p.status >= 400)) {
      note({
        severity: 'HIGH',
        layer: 'BACKEND',
        where: 'Attendance → Check-in',
        why: posts.map((p) => `${p.status} ${p.url} ${(p.body || '').slice(0, 120)}`).join('; '),
        screenshot: sn,
        network: posts.map((p) => `${p.status} ${p.method} ${p.url}`).join('; '),
      });
    }
    break;
  }
  await shot('attendance-check-in-button-state');

  for (const label of ['Check out', 'Check-out', 'Clock out', 'Check Out']) {
    resetNet();
    const hit = await clickNamed([label], { timeout: 500 });
    if (!hit) continue;
    await settle(1500);
    const sn = await shot('attendance-check-out-result');
    const posts = apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method) && /attendance/i.test(c.url));
    mutations.push({ action: 'attendance-check-out', apis: posts, shot: sn });
    if (posts.some((p) => p.status >= 400)) {
      note({
        severity: 'HIGH',
        layer: 'BACKEND',
        where: 'Attendance → Check-out',
        why: posts.map((p) => `${p.status} ${p.url} ${(p.body || '').slice(0, 120)}`).join('; '),
        screenshot: sn,
        network: posts.map((p) => `${p.status} ${p.method} ${p.url}`).join('; '),
      });
    }
    break;
  }
  await shot('attendance-check-out-button-state');

  // Dashboard CI/CO widgets
  await gotoHard('/dashboard');
  await shot('dashboard-attendance-widget');
  const text = await bodyText();
  if (!/check\s*-?\s*in|checked\s*in|present|absent/i.test(text)) {
    note({
      severity: 'MEDIUM',
      layer: 'FRONTEND',
      where: 'Dashboard attendance widget',
      why: 'No clear check-in/attendance status text on dashboard',
      screenshot: screenshots.at(-1)?.file,
      network: 'n/a',
    });
  }
}

async function fillLeaveDialog(typeName, dayOffset) {
  const dialog = page.locator('[role="dialog"]').first();
  const typeCombo = dialog.locator('[role="combobox"]').first();
  if (await typeCombo.isVisible().catch(() => false)) {
    await typeCombo.click().catch(() => {});
    await page.waitForTimeout(250);
    const opt = page.getByRole('option', { name: new RegExp(typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if (await opt.isVisible().catch(() => false)) await opt.click().catch(() => {});
    else {
      const all = page.locator('[role="option"]');
      const n = await all.count();
      for (let i = 0; i < n; i++) {
        const t = ((await all.nth(i).innerText().catch(() => '')) || '').trim();
        if (t.toLowerCase().includes(typeName.toLowerCase().slice(0, 6))) {
          await all.nth(i).click().catch(() => {});
          break;
        }
      }
    }
  }
  // Use weekday dates (Mon/Tue) to avoid NO_CHARGEABLE_DAYS on weekends
  // 2026-11-16 is Monday
  const base = new Date(Date.UTC(2026, 10, 16 + dayOffset)); // Nov 2026
  const d = base.toISOString().slice(0, 10);
  const dates = dialog.locator('input[type="date"]');
  const dn = await dates.count();
  if (dn >= 1) await dates.nth(0).fill(d).catch(() => {});
  if (dn >= 2) await dates.nth(1).fill(d).catch(() => {});
  const reason = dialog.locator('textarea').first();
  if (await reason.isVisible().catch(() => false)) {
    await reason.fill(`STRESS emp-self leave type=${typeName} date=${d}`).catch(() => {});
  }
  return d;
}

async function leaveAllTypesAndStressPreview() {
  console.log('\n=== Leave (all types) + preview stress ×5 ===');
  await gotoHard('/leave');
  await shot('leave-landing');
  for (const t of ['My Requests', 'Team Calendar', 'Comp-off', 'Calendar']) {
    resetNet();
    if (await clickNamed([t], { timeout: 400 })) {
      await settle(600);
      const sn = await shot(`leave-tab-${slug(t)}`);
      const text = await bodyText();
      if (/team calendar/i.test(t) && /access restricted/i.test(text)) {
        note({
          severity: 'HIGH',
          layer: 'FRONTEND',
          where: 'Leave → Team Calendar',
          why: 'Tab visible to EMPLOYEE but Access restricted',
          screenshot: sn,
          network: 'n/a',
          id: 'STRESS-EMP-FE-TEAM-CAL',
        });
      }
    }
  }

  // Discover types
  await gotoHard('/leave');
  resetNet();
  let open = await clickNamed(['New Request', 'Request Leave', 'Apply Leave', 'Apply', 'Request leave']);
  if (!open) {
    // link / text fallbacks
    const alt = page.getByText(/new request|request leave|apply leave/i).first();
    if (await alt.isVisible({ timeout: 800 }).catch(() => false)) {
      await alt.click().catch(() => {});
      open = 'text';
    }
  }
  if (!open) {
    await shot('leave-new-request-absent');
    note({
      severity: 'CRITICAL',
      layer: 'FRONTEND',
      where: 'Leave → New Request',
      why: 'New Request button not found',
      screenshot: screenshots.at(-1)?.file,
      network: 'n/a',
    });
    return;
  }
  await settle(900);
  await shot('leave-request-dialog-open');
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
    leaveTypes = ['Annual Leave', 'Sick Leave', 'Comp Off', 'Earned Leave', 'Casual Leave'];
  }
  // Ensure AL first for stress focus
  leaveTypes = [
    ...leaveTypes.filter((t) => /annual/i.test(t)),
    ...leaveTypes.filter((t) => !/annual/i.test(t)),
  ];
  console.log('  Leave types:', leaveTypes.join(' | '));
  await dismiss();

  // STRESS: leave preview 5× (open dialog, fill AL, wait for preview GET, close — repeat)
  console.log('  STRESS leave preview ×5');
  for (let i = 1; i <= 5; i++) {
    await gotoHard('/leave');
    resetNet();
    open = await clickNamed(['New Request', 'Request Leave', 'Apply']);
    if (!open) break;
    await settle(700);
    await fillLeaveDialog(leaveTypes.find((t) => /annual/i.test(t)) || leaveTypes[0], i);
    await settle(1200); // allow preview fetch
    const sn = await shot(`stress-leave-preview-${i}`);
    const previews = apiLog.filter((c) => /leave\/requests\/preview/i.test(c.url));
    const leaveGets = apiLog.filter((c) => c.method === 'GET' && /leave/i.test(c.url));
    stress.leavePreviewCalls.push({
      i,
      shot: sn,
      previewApis: previews.map((p) => ({ status: p.status, url: p.url, body: (p.body || '').slice(0, 200) })),
      leaveGets: leaveGets.map((p) => `${p.status} ${p.url}`).slice(0, 8),
    });
    if (previews.some((p) => p.status === 404)) {
      note({
        severity: 'HIGH',
        layer: 'BACKEND',
        where: `Leave preview stress #${i}`,
        why: 'GET /leave/requests/preview → 404 Route not found (UI depends on preview)',
        screenshot: sn,
        network: previews.map((p) => `${p.status} ${p.method} ${p.url}`).join('; '),
        id: 'STRESS-EMP-BE-PREVIEW',
      });
    } else if (!previews.length) {
      note({
        severity: 'MEDIUM',
        layer: 'FRONTEND',
        where: `Leave preview stress #${i}`,
        why: 'No GET /leave/requests/preview observed after fill (FE may not call, or debounce missed)',
        screenshot: sn,
        network: leaveGets.slice(0, 4).map((p) => `${p.status} ${p.url}`).join('; ') || 'n/a',
        id: 'STRESS-EMP-FE-PREVIEW-MISS',
      });
    }
    // Cancel — do not submit on stress loop (avoid spam creates); submit happens in type loop
    await dismiss();
  }

  // Submit once per leave type (incl AL)
  let offset = 0;
  for (const typeName of leaveTypes.slice(0, 8)) {
    offset += 1;
    await gotoHard('/leave');
    resetNet();
    open = await clickNamed(['New Request', 'Request Leave', 'Apply']);
    if (!open) continue;
    await settle(700);
    const d = await fillLeaveDialog(typeName, offset);
    await shot(`leave-filled-${slug(typeName)}`);
    resetNet();
    const submitted = await clickNamed(['Submit', 'Request', 'Apply']);
    if (!submitted) {
      await dismiss();
      continue;
    }
    await settle(2000);
    const sn = await shot(`leave-submit-${slug(typeName)}`);
    const posts = apiLog.filter((c) => c.method === 'POST' && /leave/i.test(c.url));
    const previews = apiLog.filter((c) => /leave\/requests\/preview/i.test(c.url));
    mutations.push({
      action: `leave-submit:${typeName}`,
      date: d,
      apis: posts,
      previewApis: previews,
      shot: sn,
    });
    const text = await bodyText();
    if (/no leave balance/i.test(text) || posts.some((p) => /NO_LEAVE_BALANCE/i.test(p.body || ''))) {
      note({
        severity: 'CRITICAL',
        layer: 'BACKEND',
        where: `Leave → submit ${typeName}`,
        why: `NO_LEAVE_BALANCE for "${typeName}" (types↔balance invariant)`,
        screenshot: sn,
        network: posts.map((p) => `${p.status} ${p.url} ${(p.body || '').slice(0, 160)}`).join('; '),
        id: 'STRESS-EMP-BE-AL',
      });
      if (/annual/i.test(typeName)) {
        note({
          severity: 'CRITICAL',
          layer: 'FRONTEND',
          where: `Leave picker → ${typeName}`,
          why: 'UI offers/submits Annual Leave with no balance',
          screenshot: sn,
          network: posts.map((p) => `${p.status} ${p.url}`).join('; '),
          id: 'STRESS-EMP-FE-AL',
        });
      }
    }
    if (previews.some((p) => p.status === 404)) {
      note({
        severity: 'HIGH',
        layer: 'BACKEND',
        where: `Leave submit path preview (${typeName})`,
        why: '404 on GET /leave/requests/preview during submit flow',
        screenshot: sn,
        network: previews.map((p) => `${p.status} ${p.url}`).join('; '),
        id: 'STRESS-EMP-BE-PREVIEW',
      });
    }
    await dismiss();
  }

  // Withdraw PENDING if any
  await gotoHard('/leave');
  await clickNamed(['My Requests'], { timeout: 500 });
  await settle(800);
  resetNet();
  const withdrawBtn = page.getByRole('button', { name: /withdraw/i }).first();
  if (await withdrawBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await withdrawBtn.click().catch(() => {});
    await settle(300);
    await clickNamed(['Confirm', 'Yes', 'Withdraw'], { timeout: 800 });
    await settle(1400);
    const sn = await shot('leave-withdraw-result');
    mutations.push({
      action: 'leave-withdraw',
      apis: apiLog.filter((c) => ['POST', 'PATCH'].includes(c.method)),
      shot: sn,
    });
  } else {
    await shot('leave-withdraw-absent');
  }
}

async function timesheets() {
  console.log('\n=== Timesheets ===');
  await gotoHard('/timesheets');
  await shot('timesheets-landing');
  for (const t of ['My Timesheet', 'Templates', 'History']) {
    resetNet();
    if (await clickNamed([t], { timeout: 400 })) {
      await settle(600);
      await shot(`timesheets-tab-${slug(t)}`);
    }
  }
  resetNet();
  const open = await clickNamed(['Log time', 'Log Time', 'Add Entry', 'Add entry']);
  if (open) {
    await settle(800);
    await shot('timesheets-log-time-open');
    const dialog = page.locator('[role="dialog"]').first();
    const root = (await dialog.isVisible().catch(() => false)) ? dialog : page.locator('main');
    const inputs = root.locator('input:not([type="hidden"]), textarea, [role="combobox"]');
    const ic = Math.min(await inputs.count().catch(() => 0), 10);
    for (let i = 0; i < ic; i++) {
      const el = inputs.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const role = await el.getAttribute('role').catch(() => '');
      const type = await el.getAttribute('type').catch(() => '');
      if (role === 'combobox') {
        await el.click().catch(() => {});
        await page.waitForTimeout(180);
        const opt = page.locator('[role="option"]').first();
        if (await opt.isVisible().catch(() => false)) await opt.click().catch(() => {});
        else await page.keyboard.press('Escape').catch(() => {});
      } else if (type === 'number' || type === 'text' || !type) {
        await el.fill('2').catch(() => {});
      }
    }
    const ta = root.locator('textarea').first();
    if (await ta.isVisible().catch(() => false)) await ta.fill('STRESS emp-self timesheet').catch(() => {});
    await shot('timesheets-log-time-filled');
    resetNet();
    if (await clickNamed(['Save', 'Add', 'Log', 'Submit'], { timeout: 500 })) {
      await settle(1400);
      const sn = await shot('timesheets-log-time-submit-result');
      const posts = apiLog.filter((c) => ['POST', 'PUT', 'PATCH'].includes(c.method));
      mutations.push({ action: 'timesheet-log-time', apis: posts, shot: sn });
      if (!posts.length) {
        note({
          severity: 'MEDIUM',
          layer: 'FRONTEND',
          where: 'Timesheets → Log time submit',
          why: 'Click Save/Submit but no POST observed (validation / project required)',
          screenshot: sn,
          network: 'n/a',
          id: 'STRESS-EMP-FE-TS-POST',
        });
      }
    }
    await dismiss();
  } else {
    await shot('timesheets-log-time-absent');
  }
}

async function payslipStress() {
  console.log('\n=== Payroll payslip drawer stress ===');
  await gotoHard('/payroll/my-payslips');
  await shot('payroll-my-payslips-landing');
  for (const t of ['Payslips', 'Comp Statement', 'Tax Declaration', 'Claims', 'Loans', 'Tax Forms']) {
    resetNet();
    if (await clickNamed([t], { timeout: 350 })) {
      await settle(500);
      await shot(`payroll-tab-${slug(t)}`);
    }
  }
  await gotoHard('/payroll/my-payslips');
  await clickNamed(['Payslips'], { timeout: 400 });
  await settle(700);

  // STRESS: open payslip drawer repeatedly (5×)
  console.log('  STRESS open payslip ×5');
  for (let i = 1; i <= 5; i++) {
    await dismiss();
    resetNet();
    // Prefer View buttons, else click first card/row
    let opened =
      (await clickNamed(['View', 'View payslip', 'Open'], { timeout: 400 })) ||
      null;
    if (!opened) {
      const card = page.locator('main a, main button, main [role="button"]').filter({ hasText: /payslip|202[0-9]|net pay|₹|INR/i }).first();
      if (await card.isVisible({ timeout: 800 }).catch(() => false)) {
        await card.click().catch(() => {});
        opened = 'card';
      } else {
        // click any list item that looks like a period
        const row = page.locator('main table tbody tr, main [class*="card"], main li').first();
        if (await row.isVisible({ timeout: 600 }).catch(() => false)) {
          await row.click().catch(() => {});
          opened = 'row';
        }
      }
    }
    await settle(1200);
    const sn = await shot(`stress-payslip-open-${i}`);
    const text = await bodyText();
    const drawer = page.locator('[role="dialog"], [data-state="open"], aside').first();
    const drawerVisible = await drawer.isVisible().catch(() => false);
    const skeletonStuck =
      drawerVisible &&
      (/skeleton|loading/i.test(text) ||
        (await drawer.locator('[class*="skeleton"], [class*="Skeleton"]').count().catch(() => 0)) > 0);
    const payslipApis = apiLog.filter((c) => /payslip|payroll/i.test(c.url));
    stress.payslipOpens.push({
      i,
      opened: !!opened,
      drawerVisible,
      skeletonStuck,
      shot: sn,
      apis: payslipApis.map((p) => `${p.status} ${p.method} ${p.url}`).slice(0, 10),
      bodySnippet: text.replace(/\s+/g, ' ').trim().slice(0, 220),
    });
    if (skeletonStuck) {
      note({
        severity: 'HIGH',
        layer: 'FRONTEND',
        where: `Payroll payslip drawer open #${i}`,
        why: 'Payslip drawer stuck on skeleton / loading placeholders',
        screenshot: sn,
        network: payslipApis
          .slice(0, 6)
          .map((p) => `${p.status} ${p.method} ${p.url}`)
          .join('; ') || 'n/a',
        id: 'STRESS-EMP-FE-PAYSLIP',
      });
    }
    if (payslipApis.some((p) => p.status >= 500)) {
      note({
        severity: 'CRITICAL',
        layer: 'BACKEND',
        where: `Payslip open #${i}`,
        why: payslipApis
          .filter((p) => p.status >= 500)
          .map((p) => `${p.status} ${p.url}`)
          .join('; '),
        screenshot: sn,
        network: payslipApis.map((p) => `${p.status} ${p.url}`).join('; '),
        id: 'STRESS-EMP-BE-PAYSLIP',
      });
    }
    if (payslipApis.some((p) => p.status === 404 || p.status === 403)) {
      note({
        severity: 'HIGH',
        layer: 'BACKEND',
        where: `Payslip open #${i}`,
        why: payslipApis
          .filter((p) => p.status === 404 || p.status === 403)
          .map((p) => `${p.status} ${p.url} ${(p.body || '').slice(0, 100)}`)
          .join('; '),
        screenshot: sn,
        network: payslipApis.map((p) => `${p.status} ${p.url}`).join('; '),
        id: 'STRESS-EMP-BE-PAYSLIP-4XX',
      });
    }
    // close drawer between opens
    await dismiss();
    await settle(300);
  }
}

async function notificationsStress() {
  console.log('\n=== Notifications mark-all-read ===');
  await gotoHard('/dashboard');
  resetNet();
  const bell = page.locator('button[aria-label*="otif" i], button[aria-label*="Bell" i]').first();
  let opened = false;
  if (await bell.isVisible({ timeout: 2000 }).catch(() => false)) {
    await bell.click().catch(() => {});
    opened = true;
  } else {
    const btns = page.locator('header button');
    const n = await btns.count();
    for (let i = Math.max(0, n - 10); i < n; i++) {
      const al = ((await btns.nth(i).getAttribute('aria-label').catch(() => '')) || '').toLowerCase();
      if (/notif|bell/.test(al)) {
        await btns.nth(i).click().catch(() => {});
        opened = true;
        break;
      }
    }
  }
  await settle(1000);
  await shot(opened ? 'notifications-panel-open' : 'notifications-bell-absent');

  const item = page
    .locator('[role="menu"] button, [data-state="open"] button')
    .filter({ hasNotText: /mark all/i })
    .first();
  if (await item.isVisible({ timeout: 800 }).catch(() => false)) {
    await item.click().catch(() => {});
    await settle(800);
    await shot('notifications-item-click');
    // re-open for mark-all
    await gotoHard('/dashboard');
    if (await bell.isVisible().catch(() => false)) await bell.click().catch(() => {});
    else {
      const b2 = page.locator('button[aria-label*="otif" i]').first();
      if (await b2.isVisible().catch(() => false)) await b2.click().catch(() => {});
    }
    await settle(700);
  }

  // STRESS mark-all-read ×2 (idempotency)
  for (let i = 1; i <= 2; i++) {
    if (i === 2) {
      // re-open bell
      await gotoHard('/dashboard');
      const b = page.locator('button[aria-label*="otif" i]').first();
      if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
      await settle(600);
    }
    resetNet();
    const hit = await clickNamed(['Mark all as read', 'Mark all read', 'Mark all', 'Clear all'], {
      timeout: 900,
    });
    await settle(1200);
    const sn = await shot(`stress-notifications-mark-all-${i}`);
    const patches = apiLog.filter(
      (c) => ['PATCH', 'POST'].includes(c.method) && /notifications/i.test(c.url) && /read/i.test(c.url),
    );
    stress.markAllRead.push({
      i,
      hit: !!hit,
      shot: sn,
      apis: patches.map((p) => ({
        status: p.status,
        method: p.method,
        url: p.url,
        body: (p.body || '').slice(0, 160),
      })),
    });
    mutations.push({ action: `notifications-mark-all-read-${i}`, apis: patches, shot: sn });
    if (hit && patches.some((p) => p.status >= 400)) {
      note({
        severity: 'HIGH',
        layer: 'BACKEND',
        where: `Notifications mark-all-read #${i}`,
        why: patches.map((p) => `${p.status} ${p.method} ${p.url}`).join('; '),
        screenshot: sn,
        network: patches.map((p) => `${p.status} ${p.url}`).join('; '),
        id: 'STRESS-EMP-BE-NOTIF',
      });
    }
    if (hit && !patches.length) {
      note({
        severity: 'MEDIUM',
        layer: 'FRONTEND',
        where: `Notifications mark-all-read #${i}`,
        why: 'UI click observed but no read-all API call',
        screenshot: sn,
        network: 'n/a',
        id: 'STRESS-EMP-FE-NOTIF',
      });
    }
    if (!hit && i === 1) {
      note({
        severity: 'MEDIUM',
        layer: 'FRONTEND',
        where: 'Notifications mark-all-read',
        why: 'Mark all as read control not found in notification panel',
        screenshot: sn,
        network: 'n/a',
        id: 'STRESS-EMP-FE-NOTIF-ABSENT',
      });
    }
  }
  await dismiss();
}

function writeFindings(elapsedMs) {
  const be = findings.filter((f) => f.layer === 'BACKEND');
  const fe = findings.filter((f) => f.layer === 'FRONTEND');
  const preview404 = stress.leavePreviewCalls.filter((x) => x.previewApis.some((p) => p.status === 404)).length;
  const lines = [];
  lines.push('# FINDINGS — EMP-SELF (EMPLOYEE stress + deep SHORT)');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Date | ${new Date().toISOString().slice(0, 10)} |`);
  lines.push(`| Role | \`EMPLOYEE\` — \`${USER}\` / tenant \`${TENANT}\` |`);
  lines.push(`| UI | \`${FE}\` |`);
  lines.push('| BE | `http://localhost:4000` |');
  lines.push('| Mode | STRESS + DEEP SHORT |');
  lines.push(`| Screenshots | **${shotIdx}** PNGs in \`docs/e2e-ui-screenshots/stress/emp-self/\` |`);
  lines.push(`| Duration | ${elapsedMs} ms |`);
  lines.push(`| Findings | ${findings.length} (BE=${be.length} FE=${fe.length}) |`);
  lines.push(`| Mutations | ${mutations.length} |`);
  lines.push('');
  lines.push('## Focus coverage');
  lines.push('');
  lines.push('| Area | Actions |');
  lines.push('|------|---------|');
  lines.push('| Attendance CI/CO | land + Calendar/Table/Reg views + Check-in/out click |');
  lines.push('| Leave | all types incl AL fill+submit; withdraw PENDING |');
  lines.push('| Leave preview stress | open dialog fill AL ×5 (observe GET preview) |');
  lines.push('| Timesheets | tabs + Log time fill/submit attempt |');
  lines.push('| Payroll payslip | My Pay tabs + open drawer ×5 |');
  lines.push('| Notifications | open panel + mark-all-read ×2 |');
  lines.push('');
  lines.push('## Stress summary');
  lines.push('');
  lines.push(`- Leave preview loops: **${stress.leavePreviewCalls.length}** (404 count: **${preview404}**)`);
  lines.push(`- Payslip opens: **${stress.payslipOpens.length}** (skeleton stuck: **${stress.payslipOpens.filter((x) => x.skeletonStuck).length}**)`);
  lines.push(
    `- Mark-all-read: ${stress.markAllRead.map((m) => `#${m.i} hit=${m.hit} apis=${m.apis.map((a) => a.status).join(',') || 'none'}`).join('; ') || 'n/a'}`,
  );
  lines.push('');
  lines.push('## Mutations');
  lines.push('');
  for (const m of mutations) {
    const apis = (m.apis || []).map((a) => `${a.status} ${a.method || ''} ${String(a.url || '').replace(/https?:\/\/[^/]+/, '')}`).slice(0, 4);
    lines.push(`- \`${m.action}\` → ${(apis.join(' · ') || 'no API')} · shot \`${m.shot || '?'}\``);
  }
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  if (!findings.length) lines.push('_No product issues recorded._');
  for (const f of findings) {
    lines.push(`### ${f.id || 'ISSUE'} — ${f.severity} / ${f.layer}`);
    lines.push(`- **Where:** ${f.where}`);
    lines.push(`- **Why:** ${f.why}`);
    lines.push(`- **Screenshot:** \`${f.screenshot || 'n/a'}\``);
    lines.push(`- **Network:** \`${f.network || 'n/a'}\``);
    lines.push('');
  }
  lines.push('## Contracts');
  lines.push('');
  lines.push('- `docs/E2E_STRESS_BACKEND_CONTRACT.md` → `## EMP-SELF`');
  lines.push('- `docs/E2E_STRESS_FRONTEND_CONTRACT.md` → `## EMP-SELF`');
  lines.push('');
  fs.writeFileSync(path.join(SHOT, 'FINDINGS.md'), lines.join('\n'));
  console.log(`wrote ${path.join(SHOT, 'FINDINGS.md')}`);
}

function appendContracts() {
  const DOCS = '/Users/mohdsaeedafri/All-Code-Base/EMS/docs';
  const bePath = path.join(DOCS, 'E2E_STRESS_BACKEND_CONTRACT.md');
  const fePath = path.join(DOCS, 'E2E_STRESS_FRONTEND_CONTRACT.md');
  const ts = new Date().toISOString();
  const ensure = (p, title) => {
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, `# ${title}\n\nLiving stress-test contract. Appended by SHORT stress shards. Do not wipe role sections.\n\n`);
    }
  };
  ensure(bePath, 'E2E_STRESS_BACKEND_CONTRACT');
  ensure(fePath, 'E2E_STRESS_FRONTEND_CONTRACT');
  const stripExisting = (content, header) => {
    const re = new RegExp(`\\n## ${header}\\n[\\s\\S]*?(?=\\n## [A-Z]|$)`);
    return content.replace(re, '\n');
  };
  let be = fs.readFileSync(bePath, 'utf8');
  let fe = fs.readFileSync(fePath, 'utf8');
  be = stripExisting(be, 'EMP-SELF');
  fe = stripExisting(fe, 'EMP-SELF');

  const beIssues = findings.filter((f) => f.layer === 'BACKEND');
  const feIssues = findings.filter((f) => f.layer === 'FRONTEND');
  const preview404 = stress.leavePreviewCalls.filter((x) => x.previewApis.some((p) => p.status === 404)).length;

  const beSection = [];
  beSection.push('');
  beSection.push('## EMP-SELF');
  beSection.push('');
  beSection.push(`**Tester:** \`${USER}\` (EMPLOYEE) · tenant \`${TENANT}\` · ${ts}`);
  beSection.push(`**Evidence:** \`docs/e2e-ui-screenshots/stress/emp-self/\` (**${shotIdx}** PNGs + \`FINDINGS.md\`)`);
  beSection.push(
    `**Stress:** leave preview ×${stress.leavePreviewCalls.length} (404=${preview404}); payslip open ×${stress.payslipOpens.length}; mark-all-read ×${stress.markAllRead.length}`,
  );
  beSection.push(`**Focus:** Attendance CI/CO · Leave all types+AL · Timesheets · Payslip drawer · Notifications`);
  beSection.push('');
  if (!beIssues.length) {
    beSection.push('_No BACKEND issues unique to this shard (or none captured)._');
    beSection.push('');
  }
  let bi = 0;
  for (const f of beIssues) {
    bi += 1;
    const id = f.id || `ISSUE-EMP-SELF-BE-${String(bi).padStart(2, '0')}`;
    beSection.push(`### ${id}`);
    beSection.push(`- **Where:** ${f.where}`);
    beSection.push(`- **Why:** ${f.why}`);
    beSection.push(`- **Classification:** BACKEND (${f.severity})`);
    beSection.push(`- **How to resolve:** Fix BE route/invariant; see FINDINGS`);
    beSection.push(`- **Screenshot:** \`docs/e2e-ui-screenshots/stress/emp-self/${f.screenshot || 'n/a'}\``);
    beSection.push(`- **Network:** \`${f.network || 'n/a'}\``);
    beSection.push('');
  }

  const feSection = [];
  feSection.push('');
  feSection.push('## EMP-SELF');
  feSection.push('');
  feSection.push(`**Tester:** \`${USER}\` (EMPLOYEE) · tenant \`${TENANT}\` · ${ts}`);
  feSection.push(`**Evidence:** \`docs/e2e-ui-screenshots/stress/emp-self/\` (**${shotIdx}** PNGs + \`FINDINGS.md\`)`);
  feSection.push(
    `**Stress:** leave preview ×${stress.leavePreviewCalls.length}; payslip open ×${stress.payslipOpens.length} (skeleton=${stress.payslipOpens.filter((x) => x.skeletonStuck).length}); mark-all-read ×${stress.markAllRead.length}`,
  );
  feSection.push('');
  if (!feIssues.length) {
    feSection.push('_No FRONTEND-only issues recorded in this shard._');
    feSection.push('');
  }
  let fi = 0;
  for (const f of feIssues) {
    fi += 1;
    const id = f.id || `ISSUE-EMP-SELF-FE-${String(fi).padStart(2, '0')}`;
    feSection.push(`### ${id}`);
    feSection.push(`- **Where:** ${f.where}`);
    feSection.push(`- **Why:** ${f.why}`);
    feSection.push(`- **Classification:** FRONTEND (${f.severity})`);
    feSection.push(`- **How to resolve:** Fix FE UX/role gating; see FINDINGS`);
    feSection.push(`- **Screenshot:** \`docs/e2e-ui-screenshots/stress/emp-self/${f.screenshot || 'n/a'}\``);
    feSection.push(`- **Network:** \`${f.network || 'n/a'}\``);
    feSection.push('');
  }

  fs.writeFileSync(bePath, be.trimEnd() + '\n' + beSection.join('\n') + '\n');
  fs.writeFileSync(fePath, fe.trimEnd() + '\n' + feSection.join('\n') + '\n');
  console.log(`Appended ## EMP-SELF → ${bePath}`);
  console.log(`Appended ## EMP-SELF → ${fePath}`);
}

async function main() {
  // wipe prior pngs/results for fresh run
  for (const f of fs.readdirSync(SHOT)) {
    if (f.endsWith('.png') || f === 'results.json') fs.unlinkSync(path.join(SHOT, f));
  }
  shotIdx = 0;
  screenshots.length = 0;
  findings.length = 0;
  mutations.length = 0;
  stress.leavePreviewCalls = [];
  stress.payslipOpens = [];
  stress.markAllRead = [];
  seen.clear();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  page = await context.newPage();

  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (!/\/api\//.test(url)) return;
      const method = res.request().method();
      const status = res.status();
      let body = '';
      if (status >= 400 || /leave|attendance|payslip|payroll|notification|timesheet|auth\/login/i.test(url)) {
        body = await res.text().catch(() => '');
        if (body.length > 800) body = body.slice(0, 800);
      }
      apiLog.push({ method, status, url, body, t: Date.now() });
    } catch {
      /* ignore */
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleLog.push(msg.text().slice(0, 240));
  });
  page.on('pageerror', (err) => consoleLog.push(String(err).slice(0, 240)));

  const t0 = Date.now();
  try {
    await login();
    await attendanceCiCo();
    await leaveAllTypesAndStressPreview();
    await timesheets();
    await payslipStress();
    await notificationsStress();
    await shot('final-state');
  } catch (e) {
    console.error('RUN ERROR', e);
    if (!String(e).includes('LOGIN_FAILED')) {
      note({
        severity: 'CRITICAL',
        layer: 'FRONTEND',
        where: 'Runner',
        why: String(e).slice(0, 300),
        screenshot: screenshots.at(-1)?.file || 'n/a',
        network: 'n/a',
      });
    }
    await shot('runner-error').catch(() => {});
  }

  const elapsed = Date.now() - t0;
  persist();
  writeFindings(elapsed);
  appendContracts();
  console.log(`\n=== DONE shots=${shotIdx} findings=${findings.length} ms=${elapsed} ===`);
  console.log(
    'Stress summary:',
    JSON.stringify(
      {
        leavePreviewN: stress.leavePreviewCalls.length,
        preview404: stress.leavePreviewCalls.filter((x) => x.previewApis.some((p) => p.status === 404)).length,
        payslipOpens: stress.payslipOpens.length,
        payslipSkeleton: stress.payslipOpens.filter((x) => x.skeletonStuck).length,
        markAllRead: stress.markAllRead,
      },
      null,
      2,
    ),
  );
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
