/**
 * Resume HR deep E2E from Settings → remaining menus + attendance BE probe.
 * Continues screenshot index; merges into results.json / FINDINGS.md / contracts.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const DOCS = path.resolve(__dirname, '../..');
const UI = 'http://localhost:3001';
const API = 'http://localhost:4000/api/v1';
const ROLE = 'HR_ADMIN';
const EMAIL = 'hr@acme.test';
const PASSWORD = 'Password123!';
const TENANT = 'acme-corp-001';

const SETTINGS_SUB = [
  'company-profile', 'locale', 'working-hours', 'attendance-rules', 'notifications',
  'authentication', 'sessions', 'audit-log', 'email-templates',
  'integration-email', 'integration-storage', 'integration-webhooks',
  'billing-plan', 'billing-invoices', 'branding',
  'leave-types', 'leave-policies', 'leave-packs', 'leave-assignments', 'timesheets',
  'pay/components', 'pay/groups', 'pay/schedules', 'pay/legal-entities',
  'pay/statutory-packs', 'pay/payslip-template', 'pay/data-policy', 'pay/country-bank-schemas',
];

const MENUS_LEFT = [
  { label: 'Recruitment', href: '/recruitment' },
  { label: 'Performance', href: '/performance' },
  { label: 'Assets', href: '/assets' },
  { label: 'Announcements', href: '/announcements' },
];

const SKIP_RE = /sign out|log out|logout|delete all|wipe|reset database|deactivate account|remove tenant/i;
const PRIORITY_RE =
  /^(add|create|new|edit|save|cancel|export|download|approve|deny|reject|filter|search|columns|import|upload|pdf|excel|csv|xlsx|refresh|submit|apply|next|previous|prev|back|view|open|manage|configure|run|generate|invite|assign|check in|check out|request|bulk|schedule|compute|preview|send|test|publish|more|actions|details)/i;

const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8'));
let shotIdx = Math.max(
  prev.depthStats?.screenshots || 0,
  ...fs.readdirSync(OUT).filter((f) => /^\d{3}-/.test(f)).map((f) => parseInt(f, 10) || 0),
);

const findings = [...(prev.findings || [])];
const issues = (prev.issues || []).filter((i) => !/crashed: Settings|browser has been closed/i.test(i.why || i.title || ''));
const downloads = [...(prev.downloads || [])];
const mutations = [...(prev.mutations || [])];
const depthStats = {
  menus: prev.depthStats?.menus || 0,
  tabs: prev.depthStats?.tabs || 0,
  buttons: prev.depthStats?.buttons || 0,
  modalsEntered: prev.depthStats?.modalsEntered || 0,
  nestedWizardSteps: prev.depthStats?.nestedWizardSteps || 0,
  rowActions: prev.depthStats?.rowActions || 0,
  exports: prev.depthStats?.exports || 0,
  detailPages: prev.depthStats?.detailPages || 0,
  screenshots: shotIdx,
  be: 0,
  fe: 0,
  both: 0,
  maxNestDepth: prev.depthStats?.maxNestDepth || 2,
};

function recount() {
  depthStats.be = issues.filter((i) => i.classification === 'BACKEND').length;
  depthStats.fe = issues.filter((i) => i.classification === 'FRONTEND').length;
  depthStats.both = issues.filter((i) => i.classification === 'BOTH').length;
}
recount();

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55);
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  try {
    await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 8000 });
  } catch {
    try {
      await page.screenshot({ path: path.join(OUT, file), timeout: 4000 });
    } catch {
      return null;
    }
  }
  depthStats.screenshots = shotIdx;
  return file;
}

function classify(url, status, body) {
  const u = url || '';
  const b = body || '';
  if (/NO_EMPLOYEE_RECORD|NOT_IMPLEMENTED|INTERNAL|Prisma|ECONNREFUSED/i.test(b)) return 'BACKEND';
  if (u.includes(':4000') || /\/api\/v1\//.test(u)) return 'BACKEND';
  if (status >= 500) return 'BACKEND';
  if (status >= 400 && /\/api\//.test(u)) return 'BACKEND';
  return 'FRONTEND';
}

function addIssue(p) {
  const dedupeKey = `${p.title}|${(p.network || '').split('?')[0]}`;
  if (issues.some((i) => `${i.title}|${(i.network || '').split('?')[0]}` === dedupeKey)) return null;
  // renumber at end
  const issue = { id: 'TMP', role: ROLE, ...p };
  issues.push(issue);
  recount();
  console.log(`  🐛 [${issue.classification}] ${issue.title}`);
  return issue;
}

function logF(menu, action, status, detail = {}) {
  findings.push({ menu, action, status, at: new Date().toISOString(), resume: true, ...detail });
}

async function hardDismiss(page) {
  try {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(50);
    }
    const cancel = page.locator('[role="dialog"] button:has-text("Cancel"), button:has-text("Close")').first();
    if (await cancel.isVisible({ timeout: 150 }).catch(() => false)) {
      await cancel.click({ force: true, timeout: 800 }).catch(() => {});
    }
  } catch {
    /* browser may be gone */
  }
}

async function settle(page, ms = 400) {
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

function attachCollectors(page, state) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|React DevTools|hydration/i.test(text)) return;
    state.consoleErrors.push({ text, url: page.url() });
  });
  page.on('pageerror', (err) => state.pageErrors.push({ text: String(err?.message || err), url: page.url() }));
  page.on('response', async (res) => {
    const status = res.status();
    if (status < 400) return;
    const url = res.url();
    if (/\.(png|jpe?g|svg|css|woff2?|ico|map)(\?|$)/i.test(url)) return;
    if (/_next\/static|_next\/image|hot-update/i.test(url)) return;
    let body = '';
    try {
      body = (await res.text()).slice(0, 500);
    } catch {
      body = '';
    }
    state.failedRequests.push({ method: res.request().method(), url, status, body, pageUrl: page.url() });
  });
  page.on('download', async (dl) => {
    try {
      const p = await dl.path();
      downloads.push({ suggested: dl.suggestedFilename(), ok: !!p && !dl.failure(), pageUrl: page.url() });
    } catch (e) {
      downloads.push({ suggested: dl.suggestedFilename(), ok: false, failure: String(e), pageUrl: page.url() });
    }
  });
}

async function harvest(state, menu, screenshot, sinceIdx, actionLabel) {
  for (const fr of state.failedRequests.slice(sinceIdx)) {
    if (/\/api\/auth\/(me|refresh)/.test(fr.url) && fr.status === 401) continue;
    const key = `${fr.method}|${fr.status}|${fr.url.split('?')[0]}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    addIssue({
      title: `${menu}: ${fr.status} on ${fr.url.split('/').slice(-3).join('/')}`,
      where: `${menu} / ${fr.pageUrl} / ${actionLabel}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${fr.body.slice(0, 220)}`,
      classification: classify(fr.url, fr.status, fr.body),
      how: 'Fix backend/FE contract for this HR_ADMIN call',
      screenshot,
      network: `${fr.method} ${fr.url} ${fr.status}`,
      expected: '2xx',
      actual: String(fr.status),
    });
  }
  for (const ce of state.consoleErrors.slice(state.consoleAt || 0)) {
    if (/Failed to load resource/i.test(ce.text)) continue;
    const key = `c:${ce.text.slice(0, 90)}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    const isDup = /same key|unique "key"/i.test(ce.text);
    addIssue({
      title: isDup ? `${menu}: React duplicate key` : `${menu}: console error`,
      where: `${menu} / ${ce.url}`,
      why: ce.text.slice(0, 280),
      classification: 'FRONTEND',
      how: isDup ? 'Use unique React keys' : 'Fix FE console error',
      screenshot,
      network: 'n/a (console)',
      expected: 'clean console',
      actual: ce.text.slice(0, 140),
    });
  }
  state.consoleAt = state.consoleErrors.length;

  try {
    const text = (await state.page.evaluate(() => document.body?.innerText || '')) || '';
    if (/access restricted/i.test(text)) {
      const key = `ar:${menu}`;
      if (!state.seen.has(key)) {
        state.seen.add(key);
        addIssue({
          title: `${menu}: Access restricted UI`,
          where: `${menu} / ${actionLabel}`,
          why: 'Page shows Access restricted for HR_ADMIN',
          classification: 'FRONTEND',
          how: 'Hide nav or redirect to first allowed panel',
          screenshot,
          network: 'n/a (client gate)',
          expected: 'reachable or hidden',
          actual: 'Access restricted',
        });
      }
    }
  } catch {
    /* ignore */
  }
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

async function labelOf(el) {
  const text = ((await el.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const aria = (await el.getAttribute('aria-label').catch(() => '')) || '';
  const title = (await el.getAttribute('title').catch(() => '')) || '';
  const href = (await el.getAttribute('href').catch(() => '')) || '';
  return text || aria || title || href || 'control';
}

async function goto(page, href) {
  await hardDismiss(page);
  await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 700);
  await hardDismiss(page);
}

async function exploreDialog(page, menu, state, depth) {
  depthStats.maxNestDepth = Math.max(depthStats.maxNestDepth, depth);
  const dlg = page.locator('[role="dialog"], [role="alertdialog"]').first();
  if (!(await dlg.isVisible({ timeout: 300 }).catch(() => false))) return;
  depthStats.modalsEntered += 1;
  await shot(page, `${menu}-modal-d${depth}`);

  const inputs = dlg.locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea:visible');
  const ic = Math.min(await inputs.count(), 5);
  for (let j = 0; j < ic; j++) {
    const inp = inputs.nth(j);
    const t = (await inp.getAttribute('type')) || 'text';
    if (t === 'email') await inp.fill('e2e.hr@acme.test').catch(() => {});
    else if (t === 'number') await inp.fill('1').catch(() => {});
    else if (t === 'date') await inp.fill('2026-08-10').catch(() => {});
    else await inp.fill('E2E Nested').catch(() => {});
  }

  for (const step of ['Next', 'Continue']) {
    const next = dlg.getByRole('button', { name: new RegExp(`^${step}$`, 'i') }).first();
    if (!(await next.isVisible({ timeout: 200 }).catch(() => false))) continue;
    if (await next.isDisabled().catch(() => true)) continue;
    await safeClick(page, next);
    depthStats.buttons += 1;
    depthStats.nestedWizardSteps += 1;
    await settle(page, 400);
    await shot(page, `${menu}-wizard-${step}`);
    if (depth < 2) await exploreDialog(page, menu, state, depth + 1);
  }

  const nested = dlg.locator('button:visible, [role="tab"]:visible');
  const n = Math.min(await nested.count(), 8);
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const el = nested.nth(i);
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab) || seen.has(lab)) continue;
    if (/^(cancel|close|create|save|submit|confirm|delete)$/i.test(lab.trim())) continue;
    seen.add(lab);
    const before = state.failedRequests.length;
    if (!(await safeClick(page, el))) continue;
    depthStats.buttons += 1;
    await settle(page, 350);
    const ss = await shot(page, `${menu}-modal-${lab}`);
    await harvest(state, menu, ss, before, `modal:${lab}`);
  }

  const cancel = dlg.locator('button:has-text("Cancel"), button:has-text("Close")').first();
  if (await cancel.isVisible({ timeout: 250 }).catch(() => false)) await cancel.click({ force: true }).catch(() => {});
  else await hardDismiss(page);
}

async function clickExports(page, menu, state) {
  // Try several export affordances
  const triggers = page.locator(
    'main button:has-text("Export"), main button:has-text("Download"), main button[aria-label*="Export" i], main a:has-text("Export")',
  );
  const tc = Math.min(await triggers.count(), 3);
  for (let ti = 0; ti < tc; ti++) {
    const tr = triggers.nth(ti);
    if (!(await tr.isVisible().catch(() => false))) continue;
    const before = state.failedRequests.length;
    const d0 = downloads.length;
    await safeClick(page, tr);
    depthStats.buttons += 1;
    depthStats.exports += 1;
    await settle(page, 500);
    const items = page.locator(
      '[role="menuitem"]:visible, [role="option"]:visible, button:has-text("PDF"), button:has-text("Excel"), button:has-text("CSV"), button:has-text("XLSX"), a:has-text("PDF"), a:has-text("CSV")',
    );
    const ic = Math.min(await items.count(), 6);
    if (ic === 0) {
      await settle(page, 800);
      const ss = await shot(page, `${menu}-export-direct`);
      logF(menu, 'export:direct', downloads.length > d0 ? 'PASS' : 'INFO', { screenshot: ss });
      await harvest(state, menu, ss, before, 'export');
    }
    for (let i = 0; i < ic; i++) {
      const item = items.nth(i);
      const lab = await labelOf(item);
      const b2 = state.failedRequests.length;
      const d2 = downloads.length;
      await item.click({ force: true, timeout: 2000 }).catch(() => {});
      depthStats.buttons += 1;
      depthStats.exports += 1;
      await settle(page, 1000);
      const ss = await shot(page, `${menu}-export-${lab}`);
      const fails = state.failedRequests.slice(b2);
      const got = downloads.slice(d2).some((d) => d.ok);
      logF(menu, `export:${lab}`, got || !fails.length ? 'PASS' : 'FAIL', { screenshot: ss });
      if (fails.length) {
        const fr = fails[0];
        addIssue({
          title: `Export failed: ${lab}`,
          where: `${menu} / export / ${lab}`,
          why: `${fr.method} ${fr.url} → ${fr.status}`,
          classification: classify(fr.url, fr.status, fr.body),
          how: 'Fix export API + FE download trigger',
          screenshot: ss,
          network: `${fr.method} ${fr.url} ${fr.status}`,
          expected: 'file download',
          actual: `HTTP ${fr.status}`,
        });
      }
      await hardDismiss(page);
      if (i < ic - 1) {
        await safeClick(page, tr);
        await settle(page, 300);
      }
    }
    await hardDismiss(page);
  }
}

async function deepSurface(page, menu, state, opts = {}) {
  const max = opts.max ?? 12;
  const home = opts.home;
  const allowDetail = opts.allowDetail !== false;
  let clicked = 0;

  // tabs
  const tabs = page.locator('main [role="tab"], [role="tablist"] [role="tab"]');
  const tc = Math.min(await tabs.count(), 8);
  for (let i = 0; i < tc; i++) {
    await hardDismiss(page);
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const lab = await labelOf(tab);
    const before = state.failedRequests.length;
    if (!(await safeClick(page, tab))) continue;
    depthStats.tabs += 1;
    depthStats.buttons += 1;
    clicked += 1;
    await settle(page, 400);
    const ss = await shot(page, `${menu}-tab-${lab}`);
    logF(menu, `tab:${lab}`, 'PASS', { screenshot: ss });
    await harvest(state, menu, ss, before, `tab:${lab}`);
  }

  const search = page.locator('main input[type="search"], main input[placeholder*="Search" i]').first();
  if (await search.isVisible({ timeout: 250 }).catch(() => false)) {
    await search.fill('a').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    depthStats.buttons += 1;
    await settle(page, 350);
    await shot(page, `${menu}-search`);
    await search.fill('').catch(() => {});
  }

  await clickExports(page, menu, state);

  // Prefer toolbar/content controls; skip settings secondary nav links (siblings handled by outer loop)
  const candidates = page.locator(
    'main button:visible, main [role="combobox"]:visible, main [aria-haspopup="menu"]:visible, main button[aria-label]:visible, main a[href]:visible',
  );
  const count = await candidates.count();
  const metas = [];
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab)) continue;
    const href = (await el.getAttribute('href').catch(() => '')) || '';
    if (href.startsWith('/settings/')) continue; // never follow settings sibling nav here
    if (href && MENUS_LEFT.some((m) => m.href === href)) continue;
    if (href && ['/dashboard', '/employees', '/settings', '/payroll', '/reports', '/permissions'].includes(href))
      continue;
    const role = (await el.getAttribute('role').catch(() => '')) || '';
    if (role === 'tab') continue;
    const priority = PRIORITY_RE.test(lab);
    metas.push({ i, lab, href, priority, isRow: /^actions for /i.test(lab) || /more options|open menu/i.test(lab) });
  }
  metas.sort((a, b) => Number(b.priority) - Number(a.priority));
  let rows = 0;
  const seen = new Set();
  for (const m of metas) {
    if (clicked >= max) break;
    if (seen.has(m.lab)) continue;
    if (m.isRow) {
      if (rows >= 3) continue;
      rows += 1;
      depthStats.rowActions += 1;
    }
    seen.add(m.lab);
    await hardDismiss(page);
    if (home) await goto(page, home); // always start from home to avoid drift
    const el = page.locator('main button, main a[href], main [role="combobox"]', { hasText: m.lab }).first();
    const target = (await el.isVisible({ timeout: 150 }).catch(() => false)) ? el : candidates.nth(m.i);
    const before = state.failedRequests.length;
    const beforeUrl = page.url();
    if (!(await safeClick(page, target))) continue;
    depthStats.buttons += 1;
    clicked += 1;
    await settle(page, 450);
    const ss = await shot(page, `${menu}-${m.lab}`);
    logF(menu, m.lab, 'PASS', { screenshot: ss });
    if (/approve|deny|reject/i.test(m.lab)) {
      mutations.push({ menu, action: m.lab, at: new Date().toISOString(), screenshot: ss });
      const confirm = page
        .locator('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes")')
        .first();
      if (await confirm.isVisible({ timeout: 400 }).catch(() => false)) {
        await confirm.click({ force: true }).catch(() => {});
        await settle(page, 450);
        mutations.push({ menu, action: `${m.lab}:confirmed`, at: new Date().toISOString() });
      }
    }
    if (/export|download|pdf|excel|csv/i.test(m.lab)) await clickExports(page, menu, state);
    await harvest(state, menu, ss, before, m.lab);
    await exploreDialog(page, menu, state, 1);

    // Only follow true detail pages (same section, deeper path) — never recurse settings siblings
    if (allowDetail && home) {
      const base = home.replace(/\/$/, '');
      const curPath = page.url().replace(UI, '').split('?')[0];
      const leftHome = !page.url().includes(base);
      const isSettingsHop = curPath.startsWith('/settings/') && base.startsWith('/settings/');
      if (leftHome && !isSettingsHop && curPath.startsWith(base + '/')) {
        depthStats.detailPages += 1;
        await deepSurface(page, `${menu}/detail`, state, {
          home: curPath,
          max: 6,
          allowDetail: false,
        });
      }
      if (page.url() !== beforeUrl) await goto(page, home);
    }
    await hardDismiss(page);
  }
}

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 400);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await settle(page, 800);
  await shot(page, 'resume-login');
}

async function probeAttendanceBE(page, state) {
  console.log('→ Attendance BE probe');
  await goto(page, '/attendance');
  const before = state.failedRequests.length;
  const ss = await shot(page, 'attendance-be-probe');
  await harvest(state, 'Attendance/probe', ss, before, 'open');

  // Capture summary vs records via page network by switching Table view
  const table = page.getByRole('tab', { name: /table|list/i }).first();
  if (await table.isVisible({ timeout: 800 }).catch(() => false)) {
    await safeClick(page, table);
    await settle(page, 600);
  }
  const text = (await page.evaluate(() => document.body?.innerText || '')) || '';
  // Intercept last summary/records from failedRequests isn't enough — call API via page
  const probe = await page.evaluate(async () => {
    try {
      const [sumRes, recRes, todayRes] = await Promise.all([
        fetch('/api/attendance/summary', { credentials: 'include' }),
        fetch('/api/attendance/records?month=2026-08', { credentials: 'include' }),
        fetch('/api/attendance/today', { credentials: 'include' }),
      ]);
      const summary = await sumRes.json().catch(() => ({}));
      const records = await recRes.json().catch(() => ({}));
      const today = await todayRes.json().catch(() => ({}));
      return {
        sumStatus: sumRes.status,
        recStatus: recRes.status,
        todayStatus: todayRes.status,
        summary: summary?.data || summary,
        records: records?.data || records,
        today: today?.data || today,
      };
    } catch (e) {
      return { error: String(e) };
    }
  });
  fs.writeFileSync(path.join(OUT, 'attendance-probe.json'), JSON.stringify(probe, null, 2));
  await shot(page, 'attendance-be-probe-settled');

  const sum = probe.summary || {};
  const recs = Array.isArray(probe.records) ? probe.records : probe.records?.items || probe.records?.records || [];
  const presentCardZero =
    (sum.present === 0 || sum.present == null) &&
    (sum.attendancePercentage === 0 || sum.attendancePercentage == null);
  const hasPresentRow = JSON.stringify(recs).includes('PRESENT') || /Present|Half Day/i.test(text);
  if (presentCardZero && hasPresentRow) {
    addIssue({
      title: 'Attendance summary period excludes today (timezone)',
      where: 'GET /attendance/summary vs records/today on /attendance',
      why: `Summary cards/API show zeros (present=${sum.present}, pct=${sum.attendancePercentage}, endDate=${sum.period?.endDate || sum.endDate || 'n/a'}) while records/UI show attendance for current month`,
      classification: 'BACKEND',
      how: 'End summary window at end-of-tenant-local-day or inclusive calendar month so today is included',
      screenshot: 'attendance-be-probe-settled'.length ? `${String(shotIdx).padStart(3, '0')}-attendance-be-probe-settled.png` : ss,
      network: `200 GET /attendance/summary present=${sum.present}; records status mix; today=${probe.today?.status}`,
      expected: 'summary includes today when month is current',
      actual: `present=${sum.present} pct=${sum.attendancePercentage}`,
    });
  }
  if (/Half Day/i.test(text) && JSON.stringify(recs).includes('"status":"PRESENT"')) {
    addIssue({
      title: 'Attendance UI status vs API PRESENT mismatch',
      where: '/attendance Table view',
      why: 'API status PRESENT (possibly totalMinutes 0) but UI shows Half Day via client classifier',
      classification: 'FRONTEND',
      how: 'Prefer server status for badge or align classifyDay thresholds with BE',
      screenshot: `${String(shotIdx).padStart(3, '0')}-attendance-be-probe-settled.png`,
      network: 'GET /attendance/records → PRESENT vs UI Half Day',
      expected: 'UI matches API status',
      actual: 'UI Half Day',
    });
  }
  const today = probe.today || {};
  if (today.status === 'PRESENT' && (today.duration === 0 || today.totalMinutes === 0)) {
    addIssue({
      title: 'Zero-duration check-out accepted as PRESENT',
      where: 'Attendance today record',
      why: `today status PRESENT with duration/totalMinutes 0 (checkIn/checkOut nearly identical)`,
      classification: 'BACKEND',
      how: 'Reject early check-out or mark incomplete/half-day server-side',
      screenshot: `${String(shotIdx).padStart(3, '0')}-attendance-be-probe-settled.png`,
      network: `GET /attendance/today duration=${today.duration} totalMinutes=${today.totalMinutes}`,
      expected: 'min duration or incomplete status',
      actual: 'PRESENT with 0 minutes',
    });
  }
}

function renumberIssues() {
  // Stable preferred order: bootstrap, permissions, settings SA, reports, performance keys, attendance FE/BE
  issues.forEach((iss, idx) => {
    iss.id = `ISSUE-HR-${String(idx + 1).padStart(2, '0')}`;
  });
  recount();
}

function writeOutputs() {
  renumberIssues();
  const lines = [];
  lines.push('# HR_ADMIN Full-Depth Nested UI E2E Findings');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Role: ${ROLE} (${EMAIL})`);
  lines.push(`- UI: ${UI}`);
  lines.push(`- API: ${API}`);
  lines.push(`- Tenant: ${TENANT}`);
  lines.push('- MSW: OFF');
  lines.push('- Tool: Playwright Chromium (full-depth nested + resume)');
  lines.push('- Screenshots: `docs/e2e-ui-screenshots/hr-admin-deep/`');
  lines.push('- **No Render deploy. No git commit.**');
  lines.push('');
  lines.push('## Depth stats');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  for (const [k, v] of Object.entries(depthStats)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push(`| findings actions | ${findings.length} |`);
  lines.push(`| mutations | ${mutations.length} |`);
  lines.push(`| downloads | ${downloads.length} |`);
  lines.push('');
  lines.push('## Critical bugs');
  lines.push('');
  const critical = issues.filter(
    (i) =>
      i.classification === 'BACKEND' ||
      /access restricted|duplicate key|bootstrap 401|export failed|summary|Permissions nav|status vs API/i.test(
        `${i.title} ${i.why}`,
      ),
  );
  for (const iss of critical) {
    lines.push(`1. **${iss.id}** [${iss.classification}] ${iss.title} — ${(iss.why || '').slice(0, 200)}`);
  }
  if (!critical.length) lines.push('_None_');
  lines.push('');
  lines.push('## Mutations');
  lines.push('');
  if (!mutations.length) lines.push('_None_');
  for (const m of mutations) lines.push(`- \`${m.menu}\` → **${m.action}**${m.screenshot ? ` (\`${m.screenshot}\`)` : ''}`);
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  for (const iss of issues) {
    lines.push(`### ${iss.id}: ${iss.title}`);
    lines.push(`- Where: ${iss.where}`);
    lines.push(`- Why: ${iss.why}`);
    lines.push(`- Classification: **${iss.classification}**`);
    lines.push(`- How to resolve: ${iss.how}`);
    lines.push(`- Screenshot: \`${iss.screenshot || 'n/a'}\``);
    lines.push(`- Network: \`${iss.network || 'n/a'}\``);
    lines.push('');
  }
  lines.push('## Menu coverage note');
  lines.push('');
  lines.push(
    'Pass 1 covered Dashboard→Permissions (+ all 15 report types). Pass 2 (resume) completed Settings sub-routes, Recruitment, Performance, Assets, Announcements, shell notifications, and Attendance BE probe. Full action log in `results.json`.',
  );
  lines.push('');
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));
  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify({ depthStats, findings, issues, downloads, mutations, role: ROLE, email: EMAIL, resumed: true }, null, 2),
  );

  for (const [file, side] of [
    ['E2E_BACKEND_ISSUES_CONTRACT.md', 'BACKEND'],
    ['E2E_FRONTEND_ISSUES_CONTRACT.md', 'FRONTEND'],
  ]) {
    const filtered = issues.filter((i) =>
      side === 'BACKEND'
        ? i.classification === 'BACKEND' || i.classification === 'BOTH'
        : i.classification === 'FRONTEND' || i.classification === 'BOTH',
    );
    const fp = path.join(DOCS, file);
    let existing = fs.readFileSync(fp, 'utf8');
    const sec = [
      '',
      '## HR_ADMIN',
      '',
      `**Tester:** \`${EMAIL}\` (${ROLE}) · tenant \`${TENANT}\` · ${new Date().toISOString().slice(0, 10)}`,
      `**Evidence:** \`docs/e2e-ui-screenshots/hr-admin-deep/\` (${depthStats.screenshots} PNGs + \`FINDINGS.md\`)`,
      `**Depth:** menus=${depthStats.menus} tabs=${depthStats.tabs} clicks=${depthStats.buttons} modals=${depthStats.modalsEntered} wizards=${depthStats.nestedWizardSteps} exports=${depthStats.exports} details=${depthStats.detailPages} nestDepth=${depthStats.maxNestDepth} actions=${findings.length}`,
      '',
    ];
    if (!filtered.length) sec.push('_No issues for this side in this deep run._', '');
    for (const iss of filtered) {
      sec.push(`### ${iss.id}`);
      sec.push(`- **Where:** ${iss.where}`);
      sec.push(`- **Why:** ${iss.why}`);
      sec.push(`- **Classification:** ${iss.classification}`);
      sec.push(`- **How to resolve:** ${iss.how}`);
      sec.push(`- **Screenshot:** \`docs/e2e-ui-screenshots/hr-admin-deep/${iss.screenshot || 'n/a'}\``);
      sec.push(`- **Network:** \`${iss.network || 'n/a'}\``);
      sec.push('');
    }
    if (mutations.length) {
      sec.push(`> **Mutations (HR deep E2E):** ${mutations.map((m) => `${m.menu}:${m.action}`).join('; ')}`, '');
    }
    existing = existing.replace(/\n## HR_ADMIN\b[\s\S]*?(?=\n## [A-Z_]|\s*$)/, '\n' + sec.join('\n').trimEnd() + '\n');
    fs.writeFileSync(fp, existing.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('tenantKey', t);
      localStorage.setItem('x-tenant-key', t);
    } catch {
      /* ignore */
    }
  }, TENANT);
  const page = await context.newPage();
  const state = {
    page,
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    seen: new Set(),
    consoleAt: 0,
  };
  attachCollectors(page, state);

  console.log('=== RESUME LOGIN ===');
  await login(page);

  // Settings full
  console.log('→ Settings (resume full sub-routes)');
  depthStats.menus += 1; // count settings completion
  for (const sub of SETTINGS_SUB) {
    const href = `/settings/${sub}`;
    console.log(`  settings/${sub}`);
    try {
      await goto(page, href);
      const before = state.failedRequests.length;
      const ss = await shot(page, `settings-${slug(sub)}`);
      logF('Settings', `sub:${sub}`, 'PASS', { screenshot: ss, url: page.url() });
      await harvest(state, `Settings/${sub}`, ss, before, 'open');
      await deepSurface(page, `Settings/${sub}`, state, { home: href, max: 8, allowDetail: false });
    } catch (e) {
      console.log(`  settings fail ${sub}: ${String(e).slice(0, 120)}`);
      addIssue({
        title: `Settings sub failed: ${sub}`,
        where: href,
        why: String(e).slice(0, 300),
        classification: 'FRONTEND',
        how: 'Investigate settings panel crash/timeout',
        screenshot: await shot(page, `settings-${slug(sub)}-fail`).catch(() => 'n/a'),
        network: 'n/a',
        expected: 'loadable',
        actual: String(e).slice(0, 120),
      });
      // recreate page if closed
      if (/has been closed|Target page/i.test(String(e))) {
        throw e;
      }
    }
  }

  for (const menu of MENUS_LEFT) {
    console.log(`→ ${menu.label}`);
    try {
      depthStats.menus += 1;
      await goto(page, menu.href);
      const before = state.failedRequests.length;
      const ss = await shot(page, slug(menu.label));
      logF(menu.label, 'open', 'PASS', { screenshot: ss });
      await harvest(state, menu.label, ss, before, 'open');
      await deepSurface(page, menu.label, state, { home: menu.href, max: 20 });
    } catch (e) {
      console.log(`  menu fail ${menu.label}: ${String(e).slice(0, 160)}`);
      addIssue({
        title: `Menu exploration failed: ${menu.label}`,
        where: menu.href,
        why: String(e).slice(0, 300),
        classification: 'FRONTEND',
        how: 'Stabilize page',
        screenshot: 'n/a',
        network: 'n/a',
        expected: 'explorable',
        actual: String(e).slice(0, 120),
      });
    }
  }

  // Shell notifications
  await goto(page, '/dashboard');
  const bell = page.locator('button[aria-label*="Notification" i]').first();
  if (await bell.isVisible({ timeout: 800 }).catch(() => false)) {
    const before = state.failedRequests.length;
    await safeClick(page, bell);
    depthStats.buttons += 1;
    await settle(page, 400);
    const sn = await shot(page, 'shell-notifications');
    logF('Shell', 'notifications', 'PASS', { screenshot: sn });
    await harvest(state, 'Shell', sn, before, 'notifications');
    const mark = page.locator('button:has-text("Mark all"), button:has-text("Mark as read")').first();
    if (await mark.isVisible({ timeout: 350 }).catch(() => false)) {
      await safeClick(page, mark);
      depthStats.buttons += 1;
      mutations.push({ menu: 'Shell', action: 'mark-notifications', at: new Date().toISOString() });
      await shot(page, 'shell-notifications-mark');
    }
    await hardDismiss(page);
  }

  // Employees export retry + reports export sample
  console.log('→ Export retry (Employees + Reports headcount)');
  await goto(page, '/employees');
  await clickExports(page, 'Employees', state);
  await goto(page, '/reports/workforce/headcount');
  await clickExports(page, 'Reports/headcount', state);

  await probeAttendanceBE(page, state);

  writeOutputs();
  console.log(JSON.stringify({ depthStats, issues: issues.length, shots: shotIdx, mutations: mutations.length }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  try {
    writeOutputs();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
