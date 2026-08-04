/**
 * SHORT STRESS + DEEP E2E — SUPER_ADMIN shard SA-ATT-LEAVE
 * Menus ONLY: Attendance, Timesheets, Leave, Holidays
 * Stress: spam refresh/filter/pagination; leave balance/requests ×10 (SA-10 Priya leak)
 * Out: docs/e2e-ui-screenshots/stress/sa-attendance-leave/
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const DOCS = path.resolve(__dirname, '../../..');
const UI = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://localhost:4000/api/v1';
const ROLE = 'SUPER_ADMIN';
const EMAIL = 'superadmin@acme.test';
const PASSWORD = 'Password123!';
const TENANT = 'acme-corp-001';
const PRIYA_ID_PREFIX = 'cmqjpyds7001kkpjdnlhjygrp';

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.png') || f === 'FINDINGS.md' || f === 'results.json' || f === '_run.log') {
    fs.unlinkSync(path.join(OUT, f));
  }
}

const MENUS = [
  { label: 'Attendance', href: '/attendance' },
  { label: 'Timesheets', href: '/timesheets' },
  { label: 'Leave', href: '/leave' },
  { label: 'Holidays', href: '/holidays' },
];

const SKIP_RE = /sign out|log out|logout|delete all|wipe|reset database|deactivate/i;
const PRIORITY_RE =
  /^(add |create |new |export|download|approve|deny|reject|filter|import|upload|pdf|excel|csv|xlsx|refresh|submit|apply|run |generate|request|regulariz|log time|copy|calendar|table|my |team |history|template)/i;

let shotIdx = 0;
let maxDepth = 0;
const findings = [];
const issues = [];
const leaveStressHits = [];
const counters = {
  menus: 0,
  buttons: 0,
  screenshots: 0,
  layers: 0,
  stressRefresh: 0,
  stressFilter: 0,
  stressPagination: 0,
  leaveBalanceHits: 0,
  leaveRequestHits: 0,
  be: 0,
  fe: 0,
  both: 0,
};

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
    await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 5000 });
    counters.screenshots += 1;
    return file;
  } catch {
    try {
      await page.screenshot({ path: path.join(OUT, file), timeout: 3000 });
      counters.screenshots += 1;
      return file;
    } catch {
      return null;
    }
  }
}

function classify(url, status, body) {
  const u = url || '';
  const b = body || '';
  if (/NO_EMPLOYEE_RECORD|NOT_IMPLEMENTED|INTERNAL|Prisma|ECONNREFUSED|Priya|employeeId/i.test(b))
    return 'BACKEND';
  if (u.includes(':4000') || /\/api\/v1\//.test(u)) return 'BACKEND';
  if (u.includes('localhost:3001/api/')) {
    if (status === 502 || status === 504 || status === 404) return 'BOTH';
    if (status >= 500 || status === 400 || status === 401 || status === 403) return 'BACKEND';
  }
  if (status >= 400 && /\/api\//.test(u)) return 'BACKEND';
  return 'FRONTEND';
}

function addIssue(p) {
  const dedupeKey = `${p.title}|${(p.network || '').replace(/\?.*/, '')}`;
  if (issues.some((i) => `${i.title}|${(i.network || '').replace(/\?.*/, '')}` === dedupeKey)) return;
  // Preserve known SA-10 id when it's the Priya leak
  let id;
  if (/Priya|SA-10|leave.*leak|cross-user/i.test(p.title + (p.why || ''))) {
    id = 'ISSUE-SA-10';
    if (issues.some((i) => i.id === 'ISSUE-SA-10')) return;
  } else {
    id = `ISSUE-SA-ATT-${String(issues.length + 1).padStart(2, '0')}`;
  }
  const issue = { id, role: ROLE, shard: 'SA-ATT-LEAVE', ...p };
  issues.push(issue);
  if (issue.classification === 'BACKEND') counters.be += 1;
  else if (issue.classification === 'FRONTEND') counters.fe += 1;
  else counters.both += 1;
}

function logF(menu, action, status, detail = {}) {
  findings.push({ menu, action, status, at: new Date().toISOString(), ...detail });
}

async function hardDismiss(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(40);
  }
}

async function settle(page, ms = 350) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Wait until shell + main heading are painted (tolerate slow BE under parallel stress). */
async function awaitReady(page, { headingRe = null, timeout = 20000 } = {}) {
  const start = Date.now();
  await page
    .locator('nav[aria-label="Main navigation"], aside nav, [data-sidebar]')
    .first()
    .waitFor({ state: 'visible', timeout })
    .catch(() => {});
  if (headingRe) {
    await page
      .locator('main h1, main h2, [role="main"] h1')
      .filter({ hasText: headingRe })
      .first()
      .waitFor({ state: 'visible', timeout: Math.max(4000, timeout - (Date.now() - start)) })
      .catch(() => {});
  } else {
    await page
      .locator('main h1, main h2, [role="main"] h1')
      .first()
      .waitFor({ state: 'visible', timeout: Math.max(4000, timeout - (Date.now() - start)) })
      .catch(() => {});
  }
  // Prefer interactive controls over pure skeleton
  const deadline = start + timeout;
  while (Date.now() < deadline) {
    const btnCount = await page.locator('main button:visible, main a[href]:visible').count().catch(() => 0);
    const skel = await page.locator('main [class*="skeleton"], main [data-slot="skeleton"]').count().catch(() => 0);
    if (btnCount >= 2 && skel < 8) break;
    if (btnCount >= 3) break;
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(200);
}

function attach(page, state) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|React DevTools|hydration/i.test(text)) return;
    state.consoleErrors.push({ text, url: page.url() });
  });
  page.on('pageerror', (err) =>
    state.pageErrors.push({ text: String(err?.message || err), url: page.url() }),
  );
  page.on('response', async (res) => {
    const status = res.status();
    const url = res.url();
    // Capture leave balance/requests for SA-10 even on 200
    if (/\/leave\/(balance|requests)(\?|$)/.test(url) && !/\.(png|css|js)/.test(url)) {
      let body = '';
      try {
        body = (await res.text()).slice(0, 4000);
      } catch {
        body = '';
      }
      const kind = /balance/.test(url) ? 'balance' : 'requests';
      const hit = {
        kind,
        status,
        url,
        body: body.slice(0, 800),
        hasPriyaPrefix: body.includes(PRIYA_ID_PREFIX),
        hasPriyaName: /Priya\s*Sharma/i.test(body),
        at: new Date().toISOString(),
        pageUrl: page.url(),
      };
      leaveStressHits.push(hit);
      if (kind === 'balance') counters.leaveBalanceHits += 1;
      else counters.leaveRequestHits += 1;
    }
    if (status < 400) return;
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
    });
  });
}

function harvest(state, menu, screenshot, since, action) {
  for (const fr of state.failedRequests.slice(since)) {
    const key = `${fr.method}|${fr.status}|${fr.url.split('?')[0]}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    addIssue({
      title: `${menu}: ${fr.status} ${fr.url.split('/').filter(Boolean).slice(-3).join('/')}`,
      where: `${menu} / ${fr.pageUrl} / ${action || 'page'}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${fr.body.slice(0, 240)}`,
      classification: classify(fr.url, fr.status, fr.body),
      how: /NO_EMPLOYEE_RECORD/.test(fr.body)
        ? 'BE admin-safe empty OR FE hide employee-scoped widgets when employeeId is null'
        : 'Fix failing API or FE client/BFF path',
      screenshot,
      network: `${fr.method} ${fr.url} ${fr.status}`,
      expected: '2xx or graceful empty',
      actual: `${fr.status} ${fr.body.slice(0, 120)}`,
    });
  }
  for (const ce of state.consoleErrors.slice(state.consoleAt)) {
    if (/Failed to load resource/i.test(ce.text)) continue;
    const key = `c:${ce.text.slice(0, 90)}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    addIssue({
      title: `${menu}: console error`,
      where: `${menu} / ${ce.url}`,
      why: ce.text.slice(0, 300),
      classification: 'FRONTEND',
      how: 'Fix FE runtime/React error',
      screenshot,
      network: 'n/a (console)',
      expected: 'clean console',
      actual: ce.text.slice(0, 160),
    });
  }
  for (const pe of state.pageErrors.slice(state.pageAt)) {
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

async function labelOf(el) {
  const text = ((await el.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const aria = (await el.getAttribute('aria-label').catch(() => '')) || '';
  const href = (await el.getAttribute('href').catch(() => '')) || '';
  return text || aria || href || 'control';
}

async function safeClick(page, el) {
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 800 });
  } catch {
    /* ignore */
  }
  try {
    await el.click({ timeout: 1800 });
    return true;
  } catch {
    try {
      await el.click({ force: true, timeout: 1200 });
      return true;
    } catch {
      return false;
    }
  }
}

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 400);
  await shot(page, 'login-form');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/otp/, { timeout: 45000 });
  await awaitReady(page, { headingRe: /Welcome|Dashboard/i, timeout: 25000 });
  const ss = await shot(page, 'login-success');
  logF('Login', 'login', page.url().includes('/dashboard') ? 'PASS' : 'FAIL', {
    screenshot: ss,
    url: page.url(),
  });
}

const HEADING_FOR = {
  '/attendance': /Attendance/i,
  '/timesheets': /Timesheet/i,
  '/leave': /Leave/i,
  '/holidays': /Holiday/i,
};

async function gotoMenu(page, href, label) {
  await hardDismiss(page);
  const nav = page
    .locator(
      `nav[aria-label="Main navigation"] a[aria-label="${label || ''}"], nav a[href="${href}"], a[href="${href}"]`,
    )
    .first();
  let usedNav = false;
  if (label && (await nav.isVisible({ timeout: 800 }).catch(() => false))) {
    usedNav = await safeClick(page, nav);
    if (usedNav) {
      await page.waitForURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 15000 }).catch(() => {});
    }
  }
  if (!usedNav) {
    await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  }
  await awaitReady(page, { headingRe: HEADING_FOR[href.split('?')[0]] || null, timeout: 25000 });
  // Retry once if still spinner-only
  const h1 = await page.locator('main h1, main h2').first().isVisible().catch(() => false);
  if (!h1) {
    await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await awaitReady(page, { headingRe: HEADING_FOR[href.split('?')[0]] || null, timeout: 25000 });
  }
}

async function exploreDialogNest(page, state, menu, depth) {
  maxDepth = Math.max(maxDepth, depth);
  counters.layers += 1;
  if (depth > 2) return;
  const tabs = page.locator('[role="dialog"] [role="tab"], [role="alertdialog"] [role="tab"]');
  const tc = Math.min(await tabs.count().catch(() => 0), 5);
  for (let i = 0; i < tc; i++) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const lab = await labelOf(tab);
    await tab.click({ force: true }).catch(() => {});
    counters.buttons += 1;
    await settle(page, 250);
    await shot(page, `${menu}-d${depth}-tab-${lab}`);
  }
  const btns = page.locator('[role="dialog"] button:visible, [role="alertdialog"] button:visible');
  const bc = Math.min(await btns.count().catch(() => 0), 6);
  for (let i = 0; i < bc; i++) {
    const b = btns.nth(i);
    const lab = await labelOf(b);
    if (!lab || SKIP_RE.test(lab) || /^(cancel|close|dismiss|x)$/i.test(lab.trim())) continue;
    if (/^(save|create|submit|confirm|yes|post|publish)$/i.test(lab.trim()) && depth > 0) continue;
    if (!PRIORITY_RE.test(lab) && !/next|back|add|upload|browse|select|view/i.test(lab)) continue;
    await b.click({ force: true }).catch(() => {});
    counters.buttons += 1;
    await settle(page, 280);
    await shot(page, `${menu}-d${depth}-${lab}`);
  }
}

async function spamStress(page, state, menu) {
  // Refresh spam
  const refreshBtns = page.locator(
    'main button:has-text("Refresh"), main button[aria-label*="Refresh" i], main button:has-text("Reload")',
  );
  const rc = Math.min(await refreshBtns.count().catch(() => 0), 1);
  if (rc > 0) {
    const before = state.failedRequests.length;
    for (let i = 0; i < 5; i++) {
      await refreshBtns.first().click({ force: true }).catch(() => {});
      counters.stressRefresh += 1;
      counters.buttons += 1;
      await page.waitForTimeout(80);
    }
    await settle(page, 400);
    const ss = await shot(page, `${menu}-stress-refresh-x5`);
    logF(menu, 'stress:refresh×5', 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, 'stress-refresh');
  }

  // Filter spam (Filter button OR status/employee comboboxes)
  const filterBtns = page.locator(
    'main button:has-text("Filter"), main button[aria-label*="Filter" i], main button:has-text("Filters")',
  );
  const filterCombos = page.locator(
    'main button:has-text("All statuses"), main button:has-text("All employees"), main [role="combobox"]:visible',
  );
  const filterTarget = (await filterBtns.first().isVisible({ timeout: 250 }).catch(() => false))
    ? filterBtns.first()
    : (await filterCombos.first().isVisible({ timeout: 250 }).catch(() => false))
      ? filterCombos.first()
      : null;
  if (filterTarget) {
    const before = state.failedRequests.length;
    for (let i = 0; i < 4; i++) {
      await filterTarget.click({ force: true }).catch(() => {});
      counters.stressFilter += 1;
      counters.buttons += 1;
      await page.waitForTimeout(100);
      // pick first option if listbox opened
      const opt = page.locator('[role="option"]:visible, [role="listbox"] [role="option"]').first();
      if (await opt.isVisible({ timeout: 150 }).catch(() => false)) {
        await opt.click({ force: true }).catch(() => {});
      } else {
        await hardDismiss(page);
      }
    }
    await settle(page, 300);
    const ss = await shot(page, `${menu}-stress-filter-x4`);
    logF(menu, 'stress:filter×4', 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, 'stress-filter');
  }

  // Search spam as filter proxy
  const search = page
    .locator('main input[type="search"], main input[placeholder*="Search" i]')
    .first();
  if (await search.isVisible({ timeout: 250 }).catch(() => false)) {
    const before = state.failedRequests.length;
    for (const q of ['a', 'pri', 'test', '']) {
      await search.fill(q).catch(() => {});
      await page.keyboard.press('Enter').catch(() => {});
      counters.stressFilter += 1;
      await page.waitForTimeout(120);
    }
    await settle(page, 300);
    const ss = await shot(page, `${menu}-stress-search-spam`);
    logF(menu, 'stress:search-spam', 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, 'stress-search');
  }

  // Pagination spam
  const nextBtns = page.locator(
    'main button:has-text("Next"), main button[aria-label*="Next" i], main a:has-text("Next"), main button:has-text("›"), main button:has-text("»")',
  );
  const pageNums = page.locator(
    'main nav[aria-label*="pagination" i] button, main [class*="pagination"] button',
  );
  const beforeP = state.failedRequests.length;
  let paged = 0;
  if (await nextBtns.first().isVisible({ timeout: 250 }).catch(() => false)) {
    for (let i = 0; i < 5; i++) {
      const disabled = await nextBtns.first().isDisabled().catch(() => true);
      if (disabled) break;
      await nextBtns.first().click({ force: true }).catch(() => {});
      counters.stressPagination += 1;
      counters.buttons += 1;
      paged += 1;
      await page.waitForTimeout(120);
    }
  } else {
    const pc = Math.min(await pageNums.count().catch(() => 0), 5);
    for (let i = 0; i < pc; i++) {
      await pageNums.nth(i).click({ force: true }).catch(() => {});
      counters.stressPagination += 1;
      counters.buttons += 1;
      paged += 1;
      await page.waitForTimeout(100);
    }
  }
  if (paged > 0) {
    await settle(page, 300);
    const ss = await shot(page, `${menu}-stress-pagination-x${paged}`);
    logF(menu, `stress:pagination×${paged}`, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, beforeP, 'stress-pagination');
  }
}

async function clickActions(page, menu, state, { home, max = 14 } = {}) {
  let clicked = 0;
  let detailNavs = 0;

  const tabs = page.locator('main [role="tab"], [role="tablist"] [role="tab"]');
  const tc = Math.min(await tabs.count(), 8);
  for (let i = 0; i < tc; i++) {
    await hardDismiss(page);
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const lab = await labelOf(tab);
    const before = state.failedRequests.length;
    if (!(await safeClick(page, tab))) continue;
    counters.buttons += 1;
    clicked += 1;
    await settle(page, 300);
    const ss = await shot(page, `${menu}-tab-${lab}`);
    logF(menu, `tab:${lab}`, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, `tab:${lab}`);
  }

  const candidates = page.locator(
    'main button:visible, main a[href]:visible, [role="main"] button:visible, [role="main"] [role="button"]:visible',
  );
  const count = await candidates.count();
  const metas = [];
  for (let i = 0; i < Math.min(count, 70); i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab)) continue;
    const href = (await el.getAttribute('href').catch(() => '')) || '';
    if (href && MENUS.some((m) => m.href === href)) continue;
    const priority = PRIORITY_RE.test(lab) || /export|download|approv|regulariz|log time/i.test(href + lab);
    const isRow =
      !priority &&
      (/^actions for /i.test(lab) || (/^[A-Z][a-z]+ [A-Z]/.test(lab) && !PRIORITY_RE.test(lab)));
    metas.push({ i, lab, href, priority, isRow });
  }
  metas.sort((a, b) => Number(b.priority) - Number(a.priority) || Number(a.isRow) - Number(b.isRow));

  let rowClicks = 0;
  for (const m of metas) {
    if (clicked >= max) break;
    if (m.isRow) {
      if (rowClicks >= 1) continue;
      rowClicks += 1;
    }
    if (!m.priority && !m.isRow && !/view|open|manage|calendar|table|history|template/i.test(m.lab)) {
      if (clicked > max - 3) continue;
    }

    await hardDismiss(page);
    let el = page
      .locator('main button, main a[href]', {
        hasText: new RegExp(`^${m.lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      })
      .first();
    if (!(await el.isVisible({ timeout: 180 }).catch(() => false))) el = candidates.nth(m.i);

    const before = state.failedRequests.length;
    const beforeUrl = page.url();
    if (!(await safeClick(page, el))) continue;
    counters.buttons += 1;
    clicked += 1;
    await settle(page, 400);
    const ss = await shot(page, `${menu}-${m.lab}`);
    logF(menu, m.lab, 'PASS', { screenshot: ss, url: page.url() });

    const menuItems = page.locator(
      '[role="menu"] [role="menuitem"]:visible, [data-radix-menu-content] [role="menuitem"]:visible',
    );
    const mic = Math.min(await menuItems.count().catch(() => 0), 6);
    if (mic > 0 && (/export|download|actions for|more|columns/i.test(m.lab) || /^actions for /i.test(m.lab))) {
      for (let si = 0; si < mic; si++) {
        const item = menuItems.nth(si);
        const slab = await labelOf(item);
        if (SKIP_RE.test(slab) || /^(delete|remove|terminate)$/i.test(slab.trim())) continue;
        await item.click({ force: true, timeout: 1200 }).catch(() => {});
        counters.buttons += 1;
        await settle(page, 500);
        await shot(page, `${menu}-menu-${slab}`);
        const nestedDlg = page.locator('[role="dialog"], [role="alertdialog"]').last();
        if (await nestedDlg.isVisible({ timeout: 200 }).catch(() => false)) {
          await exploreDialogNest(page, state, menu, 1);
          await hardDismiss(page);
        }
        await hardDismiss(page);
      }
    }

    harvest(state, menu, ss, before, m.lab);

    const dlg = page.locator('[role="dialog"], [role="alertdialog"]').first();
    if (await dlg.isVisible({ timeout: 200 }).catch(() => false)) {
      if (/add|create|new|edit|request|regulariz|log time|filter/i.test(m.lab)) {
        await shot(page, `${menu}-modal-${m.lab}`);
        await exploreDialogNest(page, state, menu, 1);
      }
      const cancel = dlg.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      if (await cancel.isVisible({ timeout: 250 }).catch(() => false)) {
        await cancel.click({ force: true }).catch(() => {});
      } else await hardDismiss(page);
    }

    if (!String(menu).includes('>detail') && home && detailNavs < 1 && page.url() !== beforeUrl) {
      const homeBase = home.split('?')[0].replace(/\/$/, '');
      const pathNow = new URL(page.url()).pathname.replace(/\/$/, '');
      if (pathNow !== homeBase && pathNow.startsWith(homeBase + '/')) {
        detailNavs += 1;
        maxDepth = Math.max(maxDepth, 1);
        await clickActions(page, `${menu}>detail`, state, { home, max: 8 });
        await gotoMenu(page, home);
      }
    }

    await hardDismiss(page);
    if (home) {
      const base = home.replace(/\/$/, '').split('?')[0];
      const cur = new URL(page.url()).pathname.replace(/\/$/, '');
      if (cur !== base && !cur.startsWith(base)) await gotoMenu(page, home);
    }
  }
  return clicked;
}

async function probeAuthMe(token) {
  try {
    const r = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-key': TENANT },
    });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, body: j };
  } catch (e) {
    return { status: 0, error: String(e) };
  }
}

async function leaveBalanceStress(page, state, token) {
  console.log('→ Leave SA-10 stress ×10 (API + UI re-hit)');
  await gotoMenu(page, '/leave', 'Leave');
  // Wait for balance cards / request rows if possible
  await page
    .locator('main')
    .getByText(/Earned Leave|Casual|Sick|My Requests|available|day/i)
    .first()
    .waitFor({ state: 'visible', timeout: 15000 })
    .catch(() => {});
  await settle(page, 800);
  const ssLand = await shot(page, 'leave-landing-pre-stress');
  const uiText = await page.locator('main').innerText().catch(() => '');
  const uiShowsPriya = /Priya\s*Sharma/i.test(uiText) || /574\.8|576\.8/.test(uiText);

  const me = await probeAuthMe(token);
  const employeeId =
    me?.body?.data?.employeeId ??
    me?.body?.employeeId ??
    me?.body?.data?.user?.employeeId ??
    me?.body?.data?.employee?.id ??
    null;

  const apiHits = [];
  for (let i = 1; i <= 10; i++) {
    const headers = { Authorization: `Bearer ${token}`, 'x-tenant-key': TENANT };
    const [bRes, rRes] = await Promise.all([
      fetch(`${API}/leave/balance`, { headers }),
      fetch(`${API}/leave/requests?page=1&limit=20`, { headers }),
    ]);
    const bText = await bRes.text();
    const rText = await rRes.text();
    const hit = {
      n: i,
      balanceStatus: bRes.status,
      requestsStatus: rRes.status,
      balanceHasPriyaPrefix: bText.includes(PRIYA_ID_PREFIX),
      balanceHasPriyaName: /Priya\s*Sharma/i.test(bText),
      requestsHasPriyaPrefix: rText.includes(PRIYA_ID_PREFIX),
      requestsHasPriyaName: /Priya\s*Sharma/i.test(rText),
      balanceSnippet: bText.slice(0, 280),
      requestsSnippet: rText.slice(0, 280),
    };
    apiHits.push(hit);
    counters.leaveBalanceHits += 1;
    counters.leaveRequestHits += 1;
    leaveStressHits.push({
      kind: 'api-stress',
      ...hit,
      at: new Date().toISOString(),
    });
    // Soft UI re-hit every 2nd (avoid full reload which flakes under load)
    if (i % 2 === 0) {
      await gotoMenu(page, '/leave', 'Leave');
      await shot(page, `leave-stress-rehit-${i}`);
    }
  }

  // Switch tabs to force FE re-fetch
  const tabs = page.locator('main [role="tab"]');
  const tc = Math.min(await tabs.count(), 4);
  for (let i = 0; i < tc; i++) {
    await tabs.nth(i).click({ force: true }).catch(() => {});
    await settle(page, 500);
    await shot(page, `leave-stress-tab-${i}`);
  }
  // Return to My Requests and wait for numbers
  const myReq = page.locator('main [role="tab"]').filter({ hasText: /My Requests/i }).first();
  if (await myReq.isVisible().catch(() => false)) {
    await myReq.click({ force: true }).catch(() => {});
    await settle(page, 1000);
  }
  const ssPost = await shot(page, 'leave-landing-post-stress');
  const uiText2 = await page.locator('main').innerText().catch(() => '');
  const uiShowsPriya2 = /Priya\s*Sharma/i.test(uiText2) || /574\.8|576\.8/.test(uiText2);

  const leakCount = apiHits.filter(
    (h) =>
      h.balanceHasPriyaPrefix ||
      h.balanceHasPriyaName ||
      h.requestsHasPriyaPrefix ||
      h.requestsHasPriyaName,
  ).length;
  const leakReproduced = leakCount > 0 || uiShowsPriya || uiShowsPriya2;

  logF('Leave', 'SA-10 stress ×10', leakReproduced ? 'FAIL' : 'PASS', {
    screenshot: ssPost,
    employeeId,
    leakCount,
    uiShowsPriya: uiShowsPriya || uiShowsPriya2,
    sample: apiHits[0],
  });

  if (leakReproduced) {
    addIssue({
      title: 'Leave APIs return Priya Sharma data for SUPER_ADMIN (STRESS REPRO)',
      where: 'Leave → balances / My Requests (stress ×10)',
      why: `employeeId=${JSON.stringify(employeeId)}; ${leakCount}/10 API hits show Priya prefix/name (${PRIYA_ID_PREFIX}). UI Priya visible=${uiShowsPriya || uiShowsPriya2}. Sample balance: ${apiHits[0]?.balanceSnippet?.slice(0, 180)}`,
      classification: 'BACKEND',
      severity: 'CRITICAL',
      how: 'Never fall back to another employee when employeeId is null — return empty or NO_EMPLOYEE_RECORD',
      screenshot: ssPost || ssLand,
      network: 'GET /leave/balance 200; GET /leave/requests 200; GET /auth/me',
      expected: 'empty leave data / NO_EMPLOYEE_RECORD for SUPER_ADMIN with null employeeId',
      actual: `Priya leak on ${leakCount}/10 hits; UI=${uiShowsPriya || uiShowsPriya2}`,
    });
  } else {
    logF('Leave', 'SA-10 NOT reproduced this run', 'PASS', {
      employeeId,
      note: 'No Priya prefix/name in 10× balance/requests',
    });
  }

  harvest(state, 'Leave', ssPost, state.failedRequests.length, 'sa10-stress');
  return { leakReproduced, leakCount, employeeId, apiHits, uiShowsPriya: uiShowsPriya || uiShowsPriya2 };
}

function writeFindings(sa10) {
  const be = issues.filter((i) => i.classification === 'BACKEND' || i.classification === 'BOTH');
  const fe = issues.filter((i) => i.classification === 'FRONTEND' || i.classification === 'BOTH');
  const lines = [];
  lines.push('# FINDINGS — SA-ATT-LEAVE (SUPER_ADMIN stress + deep SHORT)');
  lines.push('');
  lines.push(`- Role: \`${ROLE}\` · \`${EMAIL}\` · tenant \`${TENANT}\``);
  lines.push(`- UI: ${UI} → API: ${API}`);
  lines.push(`- Menus: Attendance, Timesheets, Leave, Holidays`);
  lines.push(
    `- Counts: menus=${counters.menus} buttons=${counters.buttons} screenshots=${counters.screenshots} layers=${counters.layers} maxDepth=${maxDepth}`,
  );
  lines.push(
    `- Stress: refresh=${counters.stressRefresh} filter/search=${counters.stressFilter} pagination=${counters.stressPagination}`,
  );
  lines.push(
    `- Leave hits: balance=${counters.leaveBalanceHits} requests=${counters.leaveRequestHits}`,
  );
  lines.push(
    `- SA-10 Priya leak: **${sa10?.leakReproduced ? 'REPRODUCED' : 'NOT REPRODUCED'}** (API leak hits ${sa10?.leakCount ?? 0}/10; employeeId=${JSON.stringify(sa10?.employeeId)}; UI Priya=${sa10?.uiShowsPriya})`,
  );
  lines.push(`- Issues: BE=${counters.be} FE=${counters.fe} BOTH=${counters.both} total=${issues.length}`);
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  if (!issues.length) lines.push('_None recorded._');
  for (const i of issues) {
    lines.push(`### ${i.id}: ${i.title}`);
    lines.push(`- Where: ${i.where}`);
    lines.push(`- Why: ${i.why}`);
    lines.push(`- Classification: ${i.classification}${i.severity ? ` (**${i.severity}**)` : ''}`);
    lines.push(`- How: ${i.how}`);
    lines.push(`- Screenshot: ${i.screenshot || 'n/a'}`);
    lines.push(`- Network: ${i.network || 'n/a'}`);
    lines.push(`- Expected: ${i.expected || ''}`);
    lines.push(`- Actual: ${i.actual || ''}`);
    lines.push('');
  }
  lines.push('## SA-10 stress detail (10×)');
  lines.push('');
  lines.push('```json');
  lines.push(
    JSON.stringify(
      (sa10?.apiHits || []).map((h) => ({
        n: h.n,
        balanceStatus: h.balanceStatus,
        requestsStatus: h.requestsStatus,
        balanceHasPriyaPrefix: h.balanceHasPriyaPrefix,
        balanceHasPriyaName: h.balanceHasPriyaName,
        requestsHasPriyaPrefix: h.requestsHasPriyaPrefix,
        requestsHasPriyaName: h.requestsHasPriyaName,
      })),
      null,
      2,
    ),
  );
  lines.push('```');
  lines.push('');
  lines.push('## Findings log (truncated)');
  lines.push('');
  for (const f of findings.slice(0, 80)) {
    lines.push(`- [${f.status}] ${f.menu} · ${f.action}${f.screenshot ? ` · ${f.screenshot}` : ''}`);
  }
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));

  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify(
      {
        role: ROLE,
        shard: 'SA-ATT-LEAVE',
        counters,
        maxDepth,
        issues,
        findings,
        leaveStressHits: leaveStressHits.slice(0, 40),
        sa10,
        beIssueCount: be.length,
        feIssueCount: fe.length,
      },
      null,
      2,
    ),
  );
}

function appendContracts(sa10) {
  const bePath = path.join(DOCS, 'E2E_STRESS_BACKEND_CONTRACT.md');
  const fePath = path.join(DOCS, 'E2E_STRESS_FRONTEND_CONTRACT.md');
  const ts = new Date().toISOString();
  const beIssues = issues.filter((i) => i.classification === 'BACKEND' || i.classification === 'BOTH');
  const feIssues = issues.filter((i) => i.classification === 'FRONTEND' || i.classification === 'BOTH');

  const ensure = (p, title) => {
    if (!fs.existsSync(p)) {
      fs.writeFileSync(
        p,
        `# ${title}\n\nLiving stress-test contract. Appended by SHORT stress shards. Do not wipe role sections.\n\n`,
      );
    }
  };
  ensure(bePath, 'E2E STRESS BACKEND CONTRACT');
  ensure(fePath, 'E2E STRESS FRONTEND CONTRACT');

  const stripExisting = (content, header) => {
    const re = new RegExp(`\\n## ${header}\\n[\\s\\S]*?(?=\\n## [A-Z]|$)`);
    return content.replace(re, '\n');
  };

  let be = fs.readFileSync(bePath, 'utf8');
  let fe = fs.readFileSync(fePath, 'utf8');
  be = stripExisting(be, 'SA-ATT-LEAVE');
  fe = stripExisting(fe, 'SA-ATT-LEAVE');

  const beSection = [];
  beSection.push('');
  beSection.push('## SA-ATT-LEAVE');
  beSection.push('');
  beSection.push(`> SUPER_ADMIN stress+deep SHORT · Attendance / Timesheets / Leave / Holidays · ${ts}`);
  beSection.push(
    `> Evidence: \`docs/e2e-ui-screenshots/stress/sa-attendance-leave/\` (${counters.screenshots} PNGs + FINDINGS.md)`,
  );
  beSection.push(
    `> Stress: refresh×${counters.stressRefresh} filter×${counters.stressFilter} pagination×${counters.stressPagination}; leave balance/requests hits=${counters.leaveBalanceHits}/${counters.leaveRequestHits}`,
  );
  beSection.push(
    `> SA-10 Priya leak: **${sa10?.leakReproduced ? 'REPRODUCED' : 'NOT REPRODUCED'}** (${sa10?.leakCount ?? 0}/10 API hits; employeeId=${JSON.stringify(sa10?.employeeId)})`,
  );
  beSection.push('');
  if (!beIssues.length) {
    beSection.push('_No new BACKEND issues in this shard (beyond SA-10 status above)._');
    beSection.push('');
  }
  for (const i of beIssues) {
    beSection.push(`### ${i.id}: ${i.title}${i.severity ? ` (**${i.severity}**)` : ''}`);
    beSection.push(`- Where: ${i.where}`);
    beSection.push(`- Why: ${i.why}`);
    beSection.push(`- Classification: ${i.classification}`);
    beSection.push(`- How to resolve: ${i.how}`);
    beSection.push(`- Screenshot: ${i.screenshot || 'n/a'}`);
    beSection.push(`- Network: ${i.network || 'n/a'}`);
    beSection.push('');
  }

  const feSection = [];
  feSection.push('');
  feSection.push('## SA-ATT-LEAVE');
  feSection.push('');
  feSection.push(`> SUPER_ADMIN stress+deep SHORT · Attendance / Timesheets / Leave / Holidays · ${ts}`);
  feSection.push(
    `> Evidence: \`docs/e2e-ui-screenshots/stress/sa-attendance-leave/\` (${counters.screenshots} PNGs + FINDINGS.md)`,
  );
  feSection.push(
    `> Note: CRITICAL leave→Priya is BACKEND **ISSUE-SA-10** — listed on BE contract. FE section captures console/UI-only defects from this shard.`,
  );
  feSection.push('');
  if (!feIssues.length) {
    feSection.push('_No FRONTEND-only issues recorded in this shard._');
    feSection.push('');
  }
  for (const i of feIssues) {
    feSection.push(`### ${i.id}: ${i.title}`);
    feSection.push(`- Where: ${i.where}`);
    feSection.push(`- Why: ${i.why}`);
    feSection.push(`- Classification: ${i.classification}`);
    feSection.push(`- How to resolve: ${i.how}`);
    feSection.push(`- Screenshot: ${i.screenshot || 'n/a'}`);
    feSection.push(`- Network: ${i.network || 'n/a'}`);
    feSection.push('');
  }

  fs.writeFileSync(bePath, be.trimEnd() + '\n' + beSection.join('\n'));
  fs.writeFileSync(fePath, fe.trimEnd() + '\n' + feSection.join('\n'));
  console.log(`Appended ## SA-ATT-LEAVE → ${bePath}`);
  console.log(`Appended ## SA-ATT-LEAVE → ${fePath}`);
}

async function main() {
  console.log('=== SA-ATT-LEAVE STRESS+DEEP SHORT ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const state = {
    failedRequests: [],
    consoleErrors: [],
    pageErrors: [],
    seen: new Set(),
    consoleAt: 0,
    pageAt: 0,
  };
  attach(page, state);

  let token = null;
  page.on('request', (req) => {
    const h = req.headers();
    if (h.authorization?.startsWith('Bearer ') && !token) {
      token = h.authorization.slice(7);
    }
  });

  await login(page);
  // Grab token from localStorage if request listener missed
  if (!token) {
    token = await page
      .evaluate(() => {
        for (const k of Object.keys(localStorage)) {
          try {
            const v = JSON.parse(localStorage.getItem(k) || '');
            if (v?.accessToken) return v.accessToken;
            if (v?.token) return v.token;
          } catch {
            /* ignore */
          }
        }
        return (
          localStorage.getItem('accessToken') ||
          localStorage.getItem('token') ||
          sessionStorage.getItem('accessToken') ||
          null
        );
      })
      .catch(() => null);
  }

  for (const menu of MENUS) {
    console.log(`→ ${menu.label}`);
    counters.menus += 1;
    await gotoMenu(page, menu.href, menu.label);
    const before = state.failedRequests.length;
    const ss = await shot(page, slug(menu.label));
    const ready = await page.locator('main h1, main h2').first().isVisible().catch(() => false);
    logF(menu.label, 'open', ready ? 'PASS' : 'FAIL', {
      screenshot: ss,
      url: page.url(),
      note: ready ? undefined : 'shell/heading not ready under load',
    });
    harvest(state, menu.label, ss, before, 'open');
    if (!ready) {
      addIssue({
        title: `${menu.label}: page stuck loading / no heading`,
        where: `${menu.label} / ${page.url()}`,
        why: 'After navigation, main heading not visible within ready timeout (parallel FE stress likely)',
        classification: 'FRONTEND',
        how: 'Investigate FE route hydration under concurrent load; add loading timeout UX',
        screenshot: ss,
        network: 'n/a',
        expected: 'menu shell + heading',
        actual: 'spinner/empty',
      });
    }

    await clickActions(page, menu.label, state, { home: menu.href, max: 16 });
    await spamStress(page, state, menu.label);
  }

  // Dedicated SA-10 leave stress (after menu crawl so token is warm)
  if (!token) {
    // last resort: login via API
    try {
      const lr = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      });
      const lj = await lr.json();
      token = lj?.data?.accessToken || lj?.accessToken || null;
    } catch {
      /* ignore */
    }
  }
  const sa10 = await leaveBalanceStress(page, state, token);

  await browser.close();
  writeFindings(sa10);
  appendContracts(sa10);

  console.log('=== DONE ===');
  console.log(
    JSON.stringify(
      {
        screenshots: counters.screenshots,
        buttons: counters.buttons,
        issues: issues.length,
        sa10: sa10?.leakReproduced,
        out: OUT,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('FATAL', e);
  try {
    writeFindings({ leakReproduced: false, leakCount: 0, employeeId: null, apiHits: [], uiShowsPriya: false });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
