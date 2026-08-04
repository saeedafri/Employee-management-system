/**
 * STRESS + DEEP E2E shard — SUPER_ADMIN — Dashboard / Employees / Departments
 * SHORT run: tight budgets + rapid-click stress (5x) on safe primaries.
 * Screenshots → docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const DOCS = path.resolve(__dirname, '../../..');
const FE = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://localhost:4000/api/v1';
const ROLE = 'SUPER_ADMIN';
const EMAIL = 'superadmin@acme.test';
const PASS = 'Password123!';
const TENANT = 'acme-corp-001';
const SHARD = 'SA-DASH-EMP-DEPT';

const MAX_DEPTH = 2;
const MAX_CONTROLS = 14;
const MAX_CANDIDATE_SCAN = 40;
const MAX_ROW_DETAILS = 2;
const MAX_CLICKS_PER_MENU = 28;
const MENU_BUDGET_MS = 90 * 1000;
const STRESS_CLICKS = 5;

const SKIP_RE =
  /sign out|log out|logout|delete all|wipe|reset database|deactivate account|remove tenant|permanently delete/i;
const DESTRUCTIVE_RE = /^(delete|remove|archive|terminate|fire)$/i;
const ERR_PATTERNS = [
  /something went wrong/i,
  /unexpected error/i,
  /failed to load/i,
  /failed to fetch/i,
  /internal server error/i,
  /error boundary/i,
  /application error/i,
];
const PERSON_NAME_RE = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/;
const DATA_CELL_RE =
  /@|\.com\b|\.test\b|^\+?\d[\d\s-]{6,}$|^(male|female|other|active|inactive|full.?time|part.?time)$/i;

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.png') || ['FINDINGS.md', 'results.json', '_run.log'].includes(f)) {
    try {
      fs.unlinkSync(path.join(OUT, f));
    } catch {
      /* ignore */
    }
  }
}

let shotIdx = 0;
let maxDepthReached = 0;
let menuClickBudget = MAX_CLICKS_PER_MENU;
let menuStartedAt = Date.now();
const counters = {
  menus: 0,
  controlsClicked: 0,
  screenshots: 0,
  layersExplored: 0,
  stressBursts: 0,
  stressErrors: 0,
  be: 0,
  fe: 0,
  both: 0,
};
const findings = [];
const issues = [];
const mutations = [];
const stressNotes = [];
const clickLog = [];
const seenIssue = new Set();
const globalVisited = new Set();

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 52);
}

function logLine(...args) {
  const line = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  console.log(line);
  try {
    fs.appendFileSync(path.join(OUT, '_run.log'), line + '\n');
  } catch {
    /* ignore */
  }
}

function resetMenuBudget() {
  menuClickBudget = MAX_CLICKS_PER_MENU;
  menuStartedAt = Date.now();
}

function menuBudgetOk() {
  return menuClickBudget > 0 && Date.now() - menuStartedAt < MENU_BUDGET_MS;
}

function consumeClick() {
  menuClickBudget -= 1;
  counters.controlsClicked += 1;
}

function pageAlive(page) {
  return page && !page.isClosed();
}

async function settle(page, ms = 400) {
  if (!pageAlive(page)) return;
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
  if (!pageAlive(page)) return;
  await page.waitForTimeout(ms).catch(() => {});
}

/** Wait until Next.js shell + main content leave the full-page spinner. */
async function waitAppReady(page, { timeout = 25000 } = {}) {
  if (!pageAlive(page)) return false;
  const t0 = Date.now();
  // Prefer sidebar / main nav — proves authenticated shell mounted
  await page
    .locator(
      'nav[aria-label="Main navigation"], aside nav a[href="/dashboard"], a[href="/employees"], [data-sidebar], nav a[aria-label="Dashboard"]',
    )
    .first()
    .waitFor({ state: 'visible', timeout })
    .catch(() => {});
  // Wait out centered full-page spinner (no interactive main yet)
  while (Date.now() - t0 < timeout) {
    if (!pageAlive(page)) return false;
    const ready = await page
      .evaluate(() => {
        const nav =
          document.querySelector('nav[aria-label="Main navigation"]') ||
          document.querySelector('aside nav') ||
          document.querySelector('a[href="/dashboard"]');
        const main = document.querySelector('main, [role="main"]');
        const text = (main?.innerText || document.body?.innerText || '').trim();
        const btnCount = (main || document.body).querySelectorAll(
          'button, a[href], [role="button"]',
        ).length;
        // spinner-only pages are tiny + almost no controls
        const spinnerOnly =
          btnCount < 3 &&
          text.length < 40 &&
          !!document.querySelector('[class*="animate-spin"], .animate-spin, [role="status"]');
        return { hasNav: !!nav, btnCount, textLen: text.length, spinnerOnly };
      })
      .catch(() => ({ hasNav: false, btnCount: 0, textLen: 0, spinnerOnly: true }));
    if (ready.hasNav && ready.btnCount >= 4 && !ready.spinnerOnly && ready.textLen > 40) {
      await page.waitForTimeout(250).catch(() => {});
      return true;
    }
    await page.waitForTimeout(400).catch(() => {});
  }
  return false;
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  try {
    await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 6000 });
  } catch {
    try {
      await page.screenshot({ path: path.join(OUT, file), timeout: 3000 });
    } catch {
      return null;
    }
  }
  counters.screenshots += 1;
  if (shotIdx % 5 === 0 || shotIdx <= 4) logLine(`  📸 ${file}`);
  return file;
}

function classify(url, status, body) {
  const u = url || '';
  const b = body || '';
  if (/NO_EMPLOYEE_RECORD|NOT_IMPLEMENTED|INTERNAL|Prisma|ECONNREFUSED/i.test(b)) return 'BACKEND';
  if (status >= 500) return 'BACKEND';
  if (u.includes(':4000') || /\/api\/v1\//.test(u)) return 'BACKEND';
  if (u.includes('localhost:3001/api/')) {
    if (status === 502 || status === 504 || status === 404) return 'BOTH';
    if (status === 400 || status === 403 || status === 401) return 'BACKEND';
  }
  if (status >= 400 && /\/api\//.test(u)) return 'BACKEND';
  return 'FRONTEND';
}

function addIssue(p) {
  const key = `${p.classification}|${p.title}|${(p.network || '').slice(0, 120)}`;
  if (seenIssue.has(key)) return null;
  seenIssue.add(key);
  const id = `ISSUE-STRESS-SA-DED-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, role: ROLE, shard: SHARD, ...p };
  issues.push(issue);
  if (issue.classification === 'BACKEND') counters.be += 1;
  else if (issue.classification === 'FRONTEND') counters.fe += 1;
  else counters.both += 1;
  logLine(`  🐛 ${id} [${issue.classification}] ${issue.title}`);
  return issue;
}

function logF(menu, action, status, detail = {}) {
  findings.push({ menu, action, status, at: new Date().toISOString(), ...detail });
}

async function hardDismiss(page) {
  if (!pageAlive(page)) return;
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(50).catch(() => {});
  }
  const cancel = page
    .locator(
      '[role="dialog"] button:has-text("Cancel"), [role="alertdialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("Close")',
    )
    .first();
  if (await cancel.isVisible({ timeout: 120 }).catch(() => false)) {
    await cancel.click({ force: true, timeout: 600 }).catch(() => {});
  }
}

function attachCollectors(page, state) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|React DevTools|Download the React|hydration|Failed to load resource/i.test(text))
      return;
    state.consoleErrors.push({ text: text.slice(0, 280), url: page.url() });
  });
  page.on('pageerror', (err) => {
    state.pageErrors.push({ text: String(err?.message || err).slice(0, 280), url: page.url() });
  });
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
    state.failedRequests.push({
      method: res.request().method(),
      url,
      status,
      body,
      pageUrl: page.url(),
      t: Date.now(),
    });
  });
}

function harvest(state, menu, screenshot, sinceIdx, actionLabel) {
  for (const fr of state.failedRequests.slice(sinceIdx)) {
    const key = `${fr.method}|${fr.status}|${fr.url.split('?')[0]}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    if (/\/api\/auth\/(me|refresh)/.test(fr.url) && fr.status === 401 && menu === 'Login') continue;
    const cls = classify(fr.url, fr.status, fr.body);
    addIssue({
      title: `${menu}: ${fr.status} ${fr.method} …/${fr.url.split('/').slice(-2).join('/')}`,
      where: `${menu} / ${fr.pageUrl} / ${actionLabel || 'page'}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${(fr.body || '').slice(0, 240)}`,
      classification: cls,
      how:
        cls === 'BACKEND'
          ? 'Fix backend route/handler/status for SUPER_ADMIN'
          : 'Fix FE client path, BFF proxy, or error UI',
      screenshot,
      network: `${fr.method} ${fr.url} ${fr.status}`,
      expected: '2xx or graceful empty',
      actual: `${fr.status} ${(fr.body || '').slice(0, 120)}`,
    });
  }
  for (const ce of state.consoleErrors.slice(state.consoleAt || 0)) {
    if (/Failed to load resource|401|403|404/i.test(ce.text) && /api\//i.test(ce.text)) continue;
    const key = `c:${ce.text.slice(0, 90)}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    addIssue({
      title: `${menu}: console error`,
      where: `${menu} / ${ce.url}`,
      why: ce.text.slice(0, 300),
      classification: 'FRONTEND',
      how: 'Fix React/runtime error in FE',
      screenshot,
      network: 'n/a (console)',
      expected: 'clean console',
      actual: ce.text.slice(0, 160),
    });
  }
  for (const pe of state.pageErrors.slice(state.pageAt || 0)) {
    const key = `p:${pe.text.slice(0, 90)}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    addIssue({
      title: `${menu}: page error`,
      where: `${menu} / ${pe.url}`,
      why: pe.text.slice(0, 300),
      classification: 'FRONTEND',
      how: 'Fix uncaught FE exception',
      screenshot,
      network: 'n/a',
      expected: 'no pageerror',
      actual: pe.text.slice(0, 160),
    });
  }
  state.consoleAt = state.consoleErrors.length;
  state.pageAt = state.pageErrors.length;
}

async function checkVisibleErrors(page, menu, action, screenshot) {
  const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const hit = ERR_PATTERNS.find((re) => re.test(text));
  if (!hit) return;
  if (!/something went wrong|error boundary|failed to load|internal server/i.test(text)) return;
  addIssue({
    title: `${menu}: visible error UI`,
    where: `${menu} / ${page.url()} / ${action}`,
    why: `Visible pattern /${hit.source}/`,
    classification: 'FRONTEND',
    how: 'Resolve underlying failure; show role-aware empty/error state',
    screenshot,
    network: 'n/a',
  });
}

async function labelOf(el) {
  const text = ((await el.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const aria = (await el.getAttribute('aria-label').catch(() => '')) || '';
  const title = (await el.getAttribute('title').catch(() => '')) || '';
  const href = (await el.getAttribute('href').catch(() => '')) || '';
  const testid = (await el.getAttribute('data-testid').catch(() => '')) || '';
  return text || aria || title || testid || href || 'control';
}

async function safeClick(el) {
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 800 });
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

async function gotoMenu(page, href) {
  await hardDismiss(page);
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 400);
  const ready = await waitAppReady(page, { timeout: 28000 });
  if (!ready) {
    logLine(`  ⚠ app not ready after goto ${href} url=${page.url()}`);
  }
  await hardDismiss(page);
  return ready;
}

async function fillDialogLight(dlg) {
  const inputs = dlg.locator(
    'input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea:visible',
  );
  const ic = Math.min(await inputs.count(), 6);
  for (let j = 0; j < ic; j++) {
    const inp = inputs.nth(j);
    const t = (await inp.getAttribute('type')) || 'text';
    const name = `${(await inp.getAttribute('name')) || ''}${(await inp.getAttribute('id')) || ''}${(await inp.getAttribute('placeholder')) || ''}`;
    if (await inp.isDisabled().catch(() => true)) continue;
    if (t === 'email' || /email/i.test(name)) await inp.fill('e2e.stress.sa@acme.test').catch(() => {});
    else if (t === 'number' || /salary|amount|phone/i.test(name)) await inp.fill('1').catch(() => {});
    else if (t === 'date' || /date/i.test(name)) await inp.fill('2026-08-15').catch(() => {});
    else if (t === 'tel') await inp.fill('9999999999').catch(() => {});
    else await inp.fill('E2E Stress SA').catch(() => {});
  }
  const combo = dlg.locator('button[role="combobox"], [role="combobox"]').first();
  if (await combo.isVisible({ timeout: 150 }).catch(() => false)) {
    await combo.click({ force: true }).catch(() => {});
    await dlg.page().waitForTimeout(200);
    const opt = dlg.page().locator('[role="option"]:visible').first();
    if (await opt.isVisible({ timeout: 300 }).catch(() => false)) {
      await opt.click({ force: true }).catch(() => {});
    } else {
      await dlg.page().keyboard.press('Escape').catch(() => {});
    }
  }
}

/** Rapid-click a visible primary control N times; capture race/errors. */
async function stressRapidClick(page, state, menu, selectorOrLocator, label) {
  const el =
    typeof selectorOrLocator === 'string'
      ? page.locator(selectorOrLocator).first()
      : selectorOrLocator;
  if (!(await el.isVisible({ timeout: 500 }).catch(() => false))) {
    stressNotes.push({ menu, label, status: 'MISS', clicks: 0 });
    logF(menu, `stress:${label}`, 'MISS');
    return;
  }
  counters.stressBursts += 1;
  const before = state.failedRequests.length;
  const beforeConsole = state.consoleErrors.length;
  const statuses = [];
  for (let i = 0; i < STRESS_CLICKS; i++) {
    const t0 = Date.now();
    const ok = await safeClick(el);
    statuses.push({ i: i + 1, ok, ms: Date.now() - t0 });
    // intentionally no settle between clicks — race probe
  }
  await settle(page, 700);
  const ss = await shot(page, `${menu}-stress-${label}`);
  const newFails = state.failedRequests.slice(before);
  const newConsole = state.consoleErrors.slice(beforeConsole);
  const race =
    newFails.length > 0 ||
    newConsole.length > 0 ||
    statuses.some((s) => !s.ok);
  if (race) counters.stressErrors += 1;
  const note = {
    menu,
    label,
    status: race ? 'RACE_OR_ERROR' : 'OK',
    clicks: STRESS_CLICKS,
    clickResults: statuses,
    networkFails: newFails.map((f) => `${f.status} ${f.method} ${f.url.split('?')[0]}`).slice(0, 8),
    console: newConsole.map((c) => c.text.slice(0, 120)).slice(0, 4),
    screenshot: ss,
  };
  stressNotes.push(note);
  logF(menu, `stress:${label}`, note.status, note);
  logLine(
    `  ⚡ stress ${menu}/${label} x${STRESS_CLICKS} → ${note.status} fails=${newFails.length} console=${newConsole.length}`,
  );
  harvest(state, menu, ss, before, `stress:${label}`);
  if (race && newFails.length) {
    addIssue({
      title: `${menu}: stress race on ${label}`,
      where: `${menu} / ${page.url()} / rapid-click ${label} x${STRESS_CLICKS}`,
      why: `Rapid ${STRESS_CLICKS}x click produced ${newFails.length} network error(s): ${note.networkFails.join('; ')}`,
      classification: classify(newFails[0].url, newFails[0].status, newFails[0].body),
      how: 'Debounce/disable primary while in-flight; ensure idempotent handlers under burst clicks',
      screenshot: ss,
      network: note.networkFails[0] || 'n/a',
      expected: 'stable under 5 rapid clicks',
      actual: note.status,
    });
  }
  await hardDismiss(page);
}

async function exploreOpenLayer(page, state, menu, depth, homeHref) {
  maxDepthReached = Math.max(maxDepthReached, depth);
  counters.layersExplored += 1;
  if (depth > MAX_DEPTH || !menuBudgetOk()) return;

  const scopeSelectors = [
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[data-radix-dialog-content]',
    '[data-vaul-drawer]',
  ];
  let layer = null;
  for (const sel of scopeSelectors) {
    const loc = page.locator(sel).last();
    if (await loc.isVisible({ timeout: 150 }).catch(() => false)) {
      layer = loc;
      break;
    }
  }
  const scope = layer || page.locator('main, [role="main"]').first();
  const urlPath = new URL(page.url()).pathname;
  const onDetailPage = /\/employees\/[^/]+/.test(urlPath);

  const tabs = scope.locator('[role="tab"]');
  const tc = Math.min(await tabs.count().catch(() => 0), 8);
  for (let i = 0; i < tc; i++) {
    if (!menuBudgetOk()) break;
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const lab = await labelOf(tab);
    const vkey = `${urlPath}|d${depth}|tab|${lab}`;
    if (globalVisited.has(vkey)) continue;
    globalVisited.add(vkey);
    const before = state.failedRequests.length;
    if (!(await safeClick(tab))) continue;
    consumeClick();
    clickLog.push({ menu, depth, action: `tab:${lab}` });
    await settle(page, 300);
    const ss = await shot(page, `${menu}-d${depth}-tab-${lab}`);
    logF(menu, `d${depth}/tab:${lab}`, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, `tab:${lab}`);
  }

  const candidates = scope.locator(
    'button:visible, a[href]:visible, [role="button"]:visible, [role="menuitem"]:visible, [role="combobox"]:visible',
  );
  const rawCount = await candidates.count().catch(() => 0);
  const count = Math.min(rawCount, MAX_CANDIDATE_SCAN);
  const metas = [];
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab) || lab === 'control') continue;
    if (DATA_CELL_RE.test(lab.trim())) continue;
    const href = (await el.getAttribute('href').catch(() => '')) || '';
    const tag = await el.evaluate((n) => n.tagName.toLowerCase()).catch(() => '');
    if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    if (
      href &&
      ['/dashboard', '/employees', '/departments', '/attendance', '/leave', '/settings'].includes(
        href,
      ) &&
      !layer
    )
      continue;

    const isPersonRow = PERSON_NAME_RE.test(lab.trim()) && (tag === 'a' || /\/employees\//.test(href));
    const isApprove = /^(approve|deny|reject)$/i.test(lab.trim());
    const isPrimary =
      /^(add|create|new|edit|save|cancel|close|filter|search|columns|import|upload|refresh|submit|apply|next|previous|prev|back|view|open|export|download|approve|deny|reject|invite|assign)/i.test(
        lab,
      ) || isApprove;
    if (onDetailPage && isPersonRow) continue;
    if (depth > 0 && !isPrimary && !layer) continue;
    metas.push({ i, lab, href, isPersonRow, isApprove, isPrimary });
  }

  metas.sort(
    (a, b) =>
      Number(b.isApprove) - Number(a.isApprove) ||
      Number(b.isPrimary) - Number(a.isPrimary) ||
      Number(a.isPersonRow) - Number(b.isPersonRow),
  );

  let clickedHere = 0;
  let rowClicks = 0;
  for (const m of metas) {
    if (!menuBudgetOk() || clickedHere >= MAX_CONTROLS) break;
    if (m.isPersonRow) {
      if (rowClicks >= MAX_ROW_DETAILS) continue;
      rowClicks += 1;
    }
    if (DESTRUCTIVE_RE.test(m.lab.trim())) {
      logF(menu, m.lab, 'SKIP', { note: 'destructive' });
      continue;
    }
    const vkey = `${urlPath}|d${depth}|${slug(m.lab)}|${(m.href || '').split('?')[0]}`;
    if (globalVisited.has(vkey)) continue;
    globalVisited.add(vkey);

    let el = scope
      .locator('button, a[href], [role="button"], [role="menuitem"], [role="combobox"]', {
        hasText: new RegExp(`^\\s*${m.lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
      })
      .first();
    if (!(await el.isVisible({ timeout: 150 }).catch(() => false))) el = candidates.nth(m.i);
    if (!(await el.isVisible().catch(() => false))) continue;

    const before = state.failedRequests.length;
    const beforeUrl = page.url();
    if (!(await safeClick(el))) continue;
    consumeClick();
    clickedHere += 1;
    clickLog.push({ menu, depth, action: m.lab });
    await settle(page, 450);
    const ss = await shot(page, `${menu}-d${depth}-${m.lab}`);
    logF(menu, `d${depth}/${m.lab}`, 'PASS', { screenshot: ss, url: page.url() });
    harvest(state, menu, ss, before, m.lab);
    await checkVisibleErrors(page, menu, m.lab, ss);

    if (m.isApprove) {
      const confirm = page
        .locator(
          '[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="alertdialog"] button:has-text("Confirm")',
        )
        .first();
      if (await confirm.isVisible({ timeout: 400 }).catch(() => false)) {
        await confirm.click({ force: true }).catch(() => {});
        await settle(page, 500);
        mutations.push({ menu, action: `${m.lab} confirmed`, confirmed: true });
        await shot(page, `${menu}-d${depth}-${m.lab}-confirmed`);
      } else {
        mutations.push({ menu, action: `${m.lab} clicked`, confirmed: false });
      }
    }

    const menuItems = page.locator('[role="menu"] [role="menuitem"]:visible');
    const mic = Math.min(await menuItems.count().catch(() => 0), 4);
    for (let mi = 0; mi < mic; mi++) {
      if (!menuBudgetOk()) break;
      const item = menuItems.nth(mi);
      const ilab = await labelOf(item);
      if (SKIP_RE.test(ilab) || DESTRUCTIVE_RE.test(ilab.trim())) continue;
      const beforeM = state.failedRequests.length;
      await safeClick(item);
      consumeClick();
      await settle(page, 350);
      const ssm = await shot(page, `${menu}-d${depth}-menu-${ilab}`);
      harvest(state, menu, ssm, beforeM, `menu:${ilab}`);
      await hardDismiss(page);
    }

    const dlg = page.locator('[role="dialog"], [role="alertdialog"]').last();
    if (await dlg.isVisible({ timeout: 250 }).catch(() => false)) {
      if (/add|create|new|edit|invite|filter|import/i.test(m.lab) && !m.isApprove) {
        await fillDialogLight(dlg);
        await shot(page, `${menu}-d${depth}-${m.lab}-filled`);
      }
      if (depth < MAX_DEPTH) {
        await exploreOpenLayer(page, state, menu, depth + 1, homeHref);
      }
      await hardDismiss(page);
    } else if (page.url() !== beforeUrl && depth < MAX_DEPTH) {
      await exploreOpenLayer(page, state, menu, depth + 1, homeHref);
      if (!page.url().includes(homeHref.split('?')[0])) {
        await gotoMenu(page, homeHref);
      }
    }
  }
}

async function login(page, state) {
  const before = state.failedRequests.length;
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 500);
  await page.evaluate((t) => {
    try {
      localStorage.setItem('tenantKey', t);
      localStorage.setItem('x-tenant-key', t);
    } catch {
      /* ignore */
    }
  }, TENANT);
  await shot(page, 'login-form');
  await page.waitForSelector('#email', { state: 'visible', timeout: 15000 });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/otp/, { timeout: 60000 }).catch(() => {});
  await settle(page, 800);
  let ready = await waitAppReady(page, { timeout: 35000 });
  if (!ready && page.url().includes('/dashboard')) {
    // one hard reload under concurrent stress load
    logLine('login shell slow — reloading /dashboard');
    await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    ready = await waitAppReady(page, { timeout: 35000 });
  }
  const ss = await shot(page, 'login-success');
  const ok = page.url().includes('/dashboard') && ready;
  logF('Login', 'login', ok ? 'PASS' : 'FAIL', { screenshot: ss, url: page.url(), ready });
  logLine(`login url=${page.url()} ok=${ok} ready=${ready}`);
  harvest(state, 'Login', ss, before, 'login');
  if (!page.url().includes('/dashboard')) throw new Error('Login failed');
  if (!ready) {
    addIssue({
      title: 'Post-login shell stuck on spinner under stress',
      where: `Login → ${page.url()}`,
      why: 'Authenticated /dashboard stayed on full-page spinner (>35s) while concurrent stress shards load FE/BE/tunnel',
      classification: 'BOTH',
      how: 'Investigate FE bootstrap + BE latency under concurrent Playwright; add shell timeout/error UI',
      screenshot: ss,
      network: 'post-login shell',
    });
  }
  const boot = state.failedRequests.filter(
    (x) => x.status === 401 && /auth\/(me|refresh)/.test(x.url),
  );
  if (boot.length) {
    addIssue({
      title: 'Login bootstrap 401s (me/refresh)',
      where: 'Login /login',
      why: `Anonymous ${boot.map((b) => `${b.method} ${b.url.split('?')[0]}`).join(', ')} → 401`,
      classification: 'FRONTEND',
      how: 'Skip me/refresh probes on public auth routes (cosmetic)',
      screenshot: ss,
      network: `${boot[0].method} ${boot[0].url} ${boot[0].status}`,
    });
  }
}

async function assertLanded(page, state, menu, ss) {
  const info = await page
    .evaluate(() => {
      const main = document.querySelector('main, [role="main"]') || document.body;
      const text = (main.innerText || '').trim();
      const btnCount = main.querySelectorAll('button, a[href], [role="button"]').length;
      return { textLen: text.length, btnCount, url: location.href };
    })
    .catch(() => ({ textLen: 0, btnCount: 0, url: page.url() }));
  if (info.btnCount < 3 || info.textLen < 40) {
    addIssue({
      title: `${menu}: land page empty/spinner`,
      where: `${menu} / ${info.url}`,
      why: `After waitAppReady, main still weak (btnCount=${info.btnCount}, textLen=${info.textLen}) — concurrent stress or FE hang`,
      classification: 'BOTH',
      how: 'Stabilize FE data fetch under concurrency; surface timeout UI instead of infinite spinner',
      screenshot: ss,
      network: 'land-spinner',
    });
    return false;
  }
  return true;
}

async function exploreDashboard(page, state) {
  counters.menus += 1;
  resetMenuBudget();
  logLine('→ Dashboard');
  await gotoMenu(page, '/dashboard');
  let before = state.failedRequests.length;
  let ss = await shot(page, 'dashboard-land');
  logF('Dashboard', 'open', 'PASS', { screenshot: ss });
  harvest(state, 'Dashboard', ss, before, 'open');
  await assertLanded(page, state, 'Dashboard', ss);

  for (const label of ['7d', '30d', '90d']) {
    const btn = page.locator(`button:has-text("${label}")`).first();
    if (!(await btn.isVisible({ timeout: 800 }).catch(() => false))) continue;
    before = state.failedRequests.length;
    await safeClick(btn);
    consumeClick();
    await settle(page, 350);
    ss = await shot(page, `dashboard-${label}`);
    harvest(state, 'Dashboard', ss, before, label);
  }

  // Add Employee flow (open → fill → Cancel)
  const add = page
    .locator(
      'a:has-text("Add Employee"), button:has-text("Add Employee"), a[href="/employees/new"], a[href*="/employees/new"]',
    )
    .first();
  if (await add.isVisible({ timeout: 2500 }).catch(() => false)) {
    before = state.failedRequests.length;
    await safeClick(add);
    consumeClick();
    await settle(page, 700);
    ss = await shot(page, 'dashboard-add-employee-open');
    harvest(state, 'Dashboard', ss, before, 'Add Employee');
    await fillDialogLight(page.locator('[role="dialog"], main form, main').first());
    await shot(page, 'dashboard-add-employee-filled');
    for (let step = 0; step < 3; step++) {
      const next = page.getByRole('button', { name: /^(next|continue)$/i }).first();
      if (!(await next.isVisible({ timeout: 250 }).catch(() => false))) break;
      await next.click({ force: true }).catch(() => {});
      consumeClick();
      await settle(page, 400);
      await shot(page, `dashboard-add-employee-step-${step + 1}`);
    }
    const cancel = page.getByRole('button', { name: /^(cancel|close)$/i }).first();
    if (await cancel.isVisible({ timeout: 400 }).catch(() => false)) {
      await cancel.click({ force: true }).catch(() => {});
      mutations.push({ menu: 'Dashboard', action: 'Add Employee filled then Cancel', confirmed: false });
    } else {
      mutations.push({ menu: 'Dashboard', action: 'Add Employee opened (no create)', confirmed: false });
    }
    await gotoMenu(page, '/dashboard');
    await shot(page, 'dashboard-after-add-cancel');
  } else {
    logF('Dashboard', 'Add Employee', 'MISS');
  }

  // Approve / Deny / Reject once each
  for (const label of ['Approve', 'Deny', 'Reject']) {
    await hardDismiss(page);
    const btn = page.locator(`button:has-text("${label}")`).first();
    if (!(await btn.isVisible({ timeout: 1000 }).catch(() => false))) {
      logF('Dashboard', label, 'MISS');
      continue;
    }
    before = state.failedRequests.length;
    await safeClick(btn);
    consumeClick();
    await settle(page, 400);
    const confirm = page
      .locator(
        '[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes"), [role="alertdialog"] button:has-text("Confirm")',
      )
      .first();
    if (await confirm.isVisible({ timeout: 400 }).catch(() => false)) {
      await confirm.click({ force: true }).catch(() => {});
      await settle(page, 500);
      mutations.push({ menu: 'Dashboard', action: `${label} confirmed`, confirmed: true });
    } else {
      mutations.push({ menu: 'Dashboard', action: `${label} clicked`, confirmed: false });
    }
    ss = await shot(page, `dashboard-${label.toLowerCase()}`);
    harvest(state, 'Dashboard', ss, before, label);
  }

  // Stress: rapid-click safe primaries (refresh/range/filter — not Approve after mutation)
  await gotoMenu(page, '/dashboard');
  await stressRapidClick(page, state, 'Dashboard', 'button:has-text("7d")', '7d');
  await stressRapidClick(page, state, 'Dashboard', 'button:has-text("30d")', '30d');
  await stressRapidClick(
    page,
    state,
    'Dashboard',
    'button:has-text("Refresh"), button[aria-label*="Refresh" i]',
    'Refresh',
  );
  // Stress Add Employee open 5x (Cancel between / Escape)
  {
    const addBtn = page
      .locator(
        'a:has-text("Add Employee"), button:has-text("Add Employee"), a[href="/employees/new"], a[href*="/employees/new"]',
      )
      .first();
    if (await addBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      counters.stressBursts += 1;
      const beforeS = state.failedRequests.length;
      for (let i = 0; i < STRESS_CLICKS; i++) {
        await safeClick(addBtn);
        await page.waitForTimeout(80);
        await hardDismiss(page);
        if (!page.url().includes('/dashboard')) await gotoMenu(page, '/dashboard');
      }
      await settle(page, 500);
      const ssS = await shot(page, 'dashboard-stress-add-employee');
      const fails = state.failedRequests.slice(beforeS);
      const note = {
        menu: 'Dashboard',
        label: 'Add Employee',
        status: fails.length ? 'RACE_OR_ERROR' : 'OK',
        clicks: STRESS_CLICKS,
        networkFails: fails.map((f) => `${f.status} ${f.method} ${f.url.split('?')[0]}`).slice(0, 8),
        screenshot: ssS,
      };
      if (fails.length) counters.stressErrors += 1;
      stressNotes.push(note);
      logF('Dashboard', 'stress:Add Employee', note.status, note);
      harvest(state, 'Dashboard', ssS, beforeS, 'stress:Add Employee');
    }
  }

  await exploreOpenLayer(page, state, 'Dashboard', 0, '/dashboard');
}

async function exploreEmployees(page, state) {
  counters.menus += 1;
  resetMenuBudget();
  logLine('→ Employees');
  await gotoMenu(page, '/employees');
  let before = state.failedRequests.length;
  let ss = await shot(page, 'employees-land');
  logF('Employees', 'open', 'PASS', { screenshot: ss });
  harvest(state, 'Employees', ss, before, 'open');
  await checkVisibleErrors(page, 'Employees', 'land', ss);
  await assertLanded(page, state, 'Employees', ss);

  await exploreOpenLayer(page, state, 'Employees', 0, '/employees');

  // Extra: /employees/new
  await gotoMenu(page, '/employees/new');
  before = state.failedRequests.length;
  ss = await shot(page, 'employees-new');
  harvest(state, 'Employees', ss, before, '/employees/new');
  await fillDialogLight(page.locator('main, [role="dialog"]').first());
  await shot(page, 'employees-new-filled');
  await hardDismiss(page);
  await gotoMenu(page, '/employees');

  // Stress: Filter / Columns / Refresh / Export (safe opens)
  await stressRapidClick(
    page,
    state,
    'Employees',
    'button:has-text("Filter"), button:has-text("Filters")',
    'Filter',
  );
  await hardDismiss(page);
  await stressRapidClick(
    page,
    state,
    'Employees',
    'button:has-text("Columns"), button:has-text("Column")',
    'Columns',
  );
  await hardDismiss(page);
  await stressRapidClick(
    page,
    state,
    'Employees',
    'button:has-text("Refresh"), button[aria-label*="Refresh" i]',
    'Refresh',
  );
  await stressRapidClick(
    page,
    state,
    'Employees',
    'button:has-text("Export"), a:has-text("Export")',
    'Export',
  );
  await hardDismiss(page);
  // Stress Add Employee from list
  await stressRapidClick(
    page,
    state,
    'Employees',
    'a:has-text("Add Employee"), button:has-text("Add Employee"), a[href*="/employees/new"]',
    'Add Employee',
  );
  await hardDismiss(page);
}

async function exploreDepartments(page, state) {
  counters.menus += 1;
  resetMenuBudget();
  logLine('→ Departments');
  await gotoMenu(page, '/departments');
  const before = state.failedRequests.length;
  const ss = await shot(page, 'departments-land');
  logF('Departments', 'open', 'PASS', { screenshot: ss });
  harvest(state, 'Departments', ss, before, 'open');
  await checkVisibleErrors(page, 'Departments', 'land', ss);
  await assertLanded(page, state, 'Departments', ss);

  await exploreOpenLayer(page, state, 'Departments', 0, '/departments');

  await stressRapidClick(
    page,
    state,
    'Departments',
    'button:has-text("Add Department"), a:has-text("Add Department"), button:has-text("New Department"), button:has-text("Add"), button:has-text("New")',
    'Add',
  );
  await hardDismiss(page);
  await stressRapidClick(
    page,
    state,
    'Departments',
    'button:has-text("Refresh"), button[aria-label*="Refresh" i]',
    'Refresh',
  );
  await stressRapidClick(
    page,
    state,
    'Departments',
    'button:has-text("Filter"), button:has-text("Filters")',
    'Filter',
  );
  await hardDismiss(page);
}

function writeFindings() {
  const pngCount = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length;
  const be = issues.filter((i) => i.classification === 'BACKEND');
  const fe = issues.filter((i) => i.classification === 'FRONTEND');
  const both = issues.filter((i) => i.classification === 'BOTH');
  const lines = [];
  lines.push(`# SUPER_ADMIN Stress+Deep E2E — ${SHARD}`);
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Role: ${ROLE} (\`${EMAIL}\`)`);
  lines.push(`- UI: ${FE} → API: ${API} → Hostinger tunnel`);
  lines.push(`- Tenant: ${TENANT}`);
  lines.push(`- Tool: Playwright Chromium`);
  lines.push(`- Screenshots: \`docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/\` (${pngCount} PNGs)`);
  lines.push(`- **No Render deploy. No git commit.**`);
  lines.push('');
  lines.push('## Depth + stress stats');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  lines.push(`| Menus tested | **${counters.menus}** |`);
  lines.push(`| Controls clicked | **${counters.controlsClicked}** |`);
  lines.push(`| Max nest depth | **${maxDepthReached}** |`);
  lines.push(`| Layers explored | **${counters.layersExplored}** |`);
  lines.push(`| Screenshots (runner) | **${counters.screenshots}** |`);
  lines.push(`| Screenshots (disk) | **${pngCount}** |`);
  lines.push(`| Stress bursts (5x) | **${counters.stressBursts}** |`);
  lines.push(`| Stress races/errors | **${counters.stressErrors}** |`);
  lines.push(`| Issues BACKEND | **${be.length}** |`);
  lines.push(`| Issues FRONTEND | **${fe.length}** |`);
  lines.push(`| Issues BOTH | **${both.length}** |`);
  lines.push(`| Mutations | **${mutations.length}** |`);
  lines.push('');
  lines.push('### Menus');
  lines.push('- Dashboard (Add Employee, Approve, Deny/Reject, range toggles, nested layers)');
  lines.push('- Employees (list/filter/columns/export/detail nest + `/employees/new`)');
  lines.push('- Departments (list/add/filter nest)');
  lines.push('');
  lines.push('## Stress notes');
  lines.push('');
  for (const n of stressNotes) {
    lines.push(
      `- **${n.menu} / ${n.label}**: ${n.status} (x${n.clicks || STRESS_CLICKS})${n.networkFails?.length ? ` — ${n.networkFails.join('; ')}` : ''}`,
    );
  }
  if (!stressNotes.length) lines.push('- (none)');
  lines.push('');
  lines.push('## Mutations');
  lines.push('');
  for (const m of mutations) {
    lines.push(`- ${m.menu}: ${m.action} (confirmed=${!!m.confirmed})`);
  }
  if (!mutations.length) lines.push('- (none)');
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  if (!issues.length) {
    lines.push('_No new issues recorded in this shard._');
  }
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
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));
  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify(
      {
        shard: SHARD,
        role: ROLE,
        generatedAt: new Date().toISOString(),
        counters: { ...counters, pngDisk: pngCount, maxDepthReached },
        issues,
        findings,
        mutations,
        stressNotes,
        clickLog: clickLog.slice(0, 200),
      },
      null,
      2,
    ),
  );
  return { pngCount, be, fe, both };
}

function appendContracts({ pngCount, be, fe, both }) {
  const bePath = path.join(DOCS, 'E2E_STRESS_BACKEND_CONTRACT.md');
  const fePath = path.join(DOCS, 'E2E_STRESS_FRONTEND_CONTRACT.md');
  const header = `# E2E_STRESS_BACKEND_CONTRACT

> Stress + deep UI / API shards against local FE:3001 → BE:4000 → Hostinger tunnel  
> Tool: Playwright Chromium + API hammer · **No Render · No commits**

`;
  const feHeader = `# E2E_STRESS_FRONTEND_CONTRACT

> Stress + deep UI shards against local FE:3001 → BE:4000 → Hostinger tunnel  
> Tool: Playwright Chromium · **No Render · No commits**

`;

  if (!fs.existsSync(bePath)) fs.writeFileSync(bePath, header);
  if (!fs.existsSync(fePath)) fs.writeFileSync(fePath, feHeader);

  const meta = `
## ${SHARD}

**Tester:** \`${EMAIL}\` (${ROLE}) · tenant \`${TENANT}\` · ${new Date().toISOString().slice(0, 10)}  
**Evidence:** \`docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/\` (**${pngCount}** PNGs + \`FINDINGS.md\`)  
**Depth:** menus=${counters.menus} clicks=${counters.controlsClicked} layers=${counters.layersExplored} nestDepth=${maxDepthReached} stressBursts=${counters.stressBursts} stressErrors=${counters.stressErrors}  
**Mutations:** ${mutations.map((m) => `${m.menu}:${m.action}`).join('; ') || '(none)'}

`;

  let beBlock = meta;
  const beIssues = [...be, ...both.filter((i) => i.classification === 'BOTH')];
  if (!beIssues.length) {
    beBlock += `_No BACKEND issues unique to this stress shard (or only FE/cosmetic)._

`;
  }
  for (const iss of beIssues) {
    beBlock += `### ${iss.id}
- **Where:** ${iss.where}
- **Why:** ${iss.why}
- **Classification:** ${iss.classification}
- **How to resolve:** ${iss.how}
- **Screenshot:** \`docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/${iss.screenshot || 'n/a'}\`
- **Network:** \`${iss.network || 'n/a'}\`

`;
  }

  let feBlock = meta;
  const feIssues = [...fe, ...both];
  if (!feIssues.length) {
    feBlock += `_No FRONTEND issues unique to this stress shard._

`;
  }
  for (const iss of feIssues) {
    if (iss.classification === 'BACKEND') continue;
    feBlock += `### ${iss.id}
- **Where:** ${iss.where}
- **Why:** ${iss.why}
- **Classification:** ${iss.classification}
- **How to resolve:** ${iss.how}
- **Screenshot:** \`docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/${iss.screenshot || 'n/a'}\`
- **Network:** \`${iss.network || 'n/a'}\`

`;
  }

  // Replace existing section if re-run, else append
  function upsertSection(filePath, section) {
    let cur = fs.readFileSync(filePath, 'utf8');
    const re = new RegExp(`\\n## ${SHARD}[\\s\\S]*?(?=\\n## |$)`);
    if (re.test(cur)) {
      cur = cur.replace(re, '\n' + section.trimEnd() + '\n\n');
    } else {
      if (!cur.endsWith('\n')) cur += '\n';
      cur += section;
    }
    fs.writeFileSync(filePath, cur);
  }

  upsertSection(bePath, beBlock);
  upsertSection(fePath, feBlock);
  logLine(`contracts appended → ${bePath} + ${fePath}`);
}

async function main() {
  logLine(`=== ${SHARD} STRESS+DEEP START ===`);
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
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(35000);
  const state = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    consoleAt: 0,
    pageAt: 0,
    seen: new Set(),
  };
  attachCollectors(page, state);

  try {
    await login(page, state);
    await exploreDashboard(page, state);
    await exploreEmployees(page, state);
    await exploreDepartments(page, state);
  } catch (e) {
    logLine('FATAL', String(e).slice(0, 400));
    await shot(page, 'fatal-error').catch(() => {});
    addIssue({
      title: 'Shard runner fatal',
      where: page.url(),
      why: String(e).slice(0, 300),
      classification: 'BOTH',
      how: 'Re-run shard; inspect fatal screenshot',
      screenshot: 'fatal-error',
      network: 'n/a',
    });
  }

  const counts = writeFindings();
  appendContracts(counts);
  await browser.close().catch(() => {});

  logLine('=== DONE ===');
  logLine(
    JSON.stringify({
      shard: SHARD,
      png: counts.pngCount,
      clicks: counters.controlsClicked,
      layers: counters.layersExplored,
      depth: maxDepthReached,
      stressBursts: counters.stressBursts,
      stressErrors: counters.stressErrors,
      be: counts.be.length,
      fe: counts.fe.length,
      both: counts.both.length,
      issues: issues.length,
      mutations: mutations.length,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
