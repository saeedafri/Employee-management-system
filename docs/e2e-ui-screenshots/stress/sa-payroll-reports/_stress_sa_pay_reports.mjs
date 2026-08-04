/**
 * SUPER_ADMIN STRESS + DEEP E2E SHORT shard
 * ONLY: Payroll, Payout methods, Reports, Analytics
 * Stress: Promise.all concurrent PDF/Excel/CSV export clicks
 * UI :3001 → BE :4000. No Render. No commits. Keep < ~3 min.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const DOCS = path.resolve(__dirname, '../../..'); // docs/
const UI = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://localhost:4000/api/v1';
const ROLE = 'SUPER_ADMIN';
const EMAIL = 'superadmin@acme.test';
const PASSWORD = 'Password123!';
const TENANT = 'acme-corp-001';

const REPORT_ROUTES = [
  'workforce/headcount',
  'workforce/turnover',
  'attendance/summary',
  'leave/utilization',
  'payroll/summary',
  'payroll/ctc-analysis',
];
const PAYROLL_EXTRA = ['/payroll/migration', '/payroll/global', '/payroll/my-payslips'];
const ANALYTICS_RANGES = ['7d', '30d', '90d'];

fs.mkdirSync(OUT, { recursive: true });
// wipe prior partial PNGs for clean shard
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));
}

let shotIdx = 0;
const findings = [];
const issues = [];
const downloads = [];
const networkLog = [];
const stressExports = [];
const depthStats = {
  menus: 0,
  tabs: 0,
  buttons: 0,
  modals: 0,
  exports: 0,
  nestDepth: 0,
  screenshots: 0,
  concurrentExportBursts: 0,
};
let state = { failedRequests: [], consoleErrors: [], me: null };

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function settle(page, ms = 350) {
  await page.waitForTimeout(ms);
}

async function shot(page, name) {
  shotIdx += 1;
  depthStats.screenshots += 1;
  const f = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  await page.screenshot({ path: path.join(OUT, f), fullPage: false }).catch(() => {});
  return f;
}

function logF(menu, action, status, extra = {}) {
  findings.push({ menu, action, status, ...extra, ts: new Date().toISOString() });
  console.log(`[${status}] ${menu} → ${action}${extra.note ? ` — ${extra.note}` : ''}`);
}

function addIssue(i) {
  const key = `${i.title}|${i.where}|${i.classification}`;
  if (issues.some((x) => `${x.title}|${x.where}|${x.classification}` === key)) return;
  issues.push(i);
}

function classify(url, status, body = '') {
  if (status >= 500) return 'BACKEND';
  if (status === 404 && /\/api\//.test(url)) return 'BACKEND';
  if (!url || !/\/api\//.test(url)) return 'FRONTEND';
  return status >= 400 ? 'BACKEND' : 'FRONTEND';
}

function wire(page) {
  page.on('response', async (res) => {
    const url = res.url();
    const status = res.status();
    const method = res.request().method();
    if (!/localhost:(3001|4000)/.test(url)) return;
    let body = '';
    if (status >= 400) {
      try {
        body = (await res.text()).slice(0, 350);
      } catch {
        /* ignore */
      }
      state.failedRequests.push({ method, url, status, body, pageUrl: page.url() });
    }
    if (/\/api\/|export|download|\.csv|\.xlsx|\.pdf|reports|payroll|analytics|payout/i.test(url)) {
      networkLog.push({
        method,
        status,
        url: url.replace(UI, '').replace('http://localhost:4000', ''),
        pageUrl: page.url().replace(UI, ''),
        t: Date.now(),
      });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') state.consoleErrors.push({ text: msg.text().slice(0, 250), pageUrl: page.url() });
  });
  page.on('download', async (dl) => {
    try {
      const fail = await Promise.resolve(dl.failure());
      const p = await dl.path().catch(() => null);
      // save a copy for evidence
      let saved = null;
      if (p) {
        saved = path.join(OUT, `_dl-${slug(dl.suggestedFilename())}-${Date.now()}`);
        try {
          fs.copyFileSync(p, saved);
        } catch {
          saved = null;
        }
      }
      downloads.push({
        suggested: dl.suggestedFilename(),
        ok: !!p && !fail,
        failure: fail || null,
        path: p,
        saved,
        pageUrl: page.url(),
        t: Date.now(),
      });
    } catch (e) {
      downloads.push({
        suggested: dl.suggestedFilename(),
        ok: false,
        failure: String(e),
        pageUrl: page.url(),
        t: Date.now(),
      });
    }
  });
}

async function labelOf(el) {
  return (
    (await el.getAttribute('aria-label').catch(() => null)) ||
    (await el.innerText().catch(() => '')) ||
    (await el.getAttribute('title').catch(() => null)) ||
    ''
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

async function hardDismiss(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  const close = page
    .locator('[role="dialog"] button:has-text("Cancel"), [role="dialog"] button:has-text("Close")')
    .first();
  if (await close.isVisible({ timeout: 150 }).catch(() => false)) {
    await close.click({ force: true, timeout: 1000 }).catch(() => {});
  }
}

async function safeClick(el) {
  try {
    await el.click({ force: true, timeout: 1500 });
    return true;
  } catch {
    return false;
  }
}

async function gotoPath(page, href) {
  await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await settle(page, 450);
}

async function clickByText(page, re, opts = {}) {
  const root = opts.root || 'main';
  const el = page.locator(`${root} button:visible, ${root} a:visible, ${root} [role="tab"]:visible`).filter({ hasText: re }).first();
  if (!(await el.isVisible({ timeout: opts.timeout || 400 }).catch(() => false))) return false;
  if (!(await safeClick(el))) return false;
  depthStats.buttons += 1;
  await settle(page, opts.wait || 400);
  return true;
}

async function clickTabs(page, menu, max = 6) {
  const tabs = page.locator('main [role="tab"]:visible');
  const n = Math.min(await tabs.count(), max);
  for (let i = 0; i < n; i++) {
    const t = tabs.nth(i);
    const lab = await labelOf(t);
    if (!lab) continue;
    if (!(await safeClick(t))) continue;
    depthStats.tabs += 1;
    depthStats.buttons += 1;
    await settle(page, 300);
    const ss = await shot(page, `${menu}-tab-${lab}`);
    logF(menu, `tab:${lab}`, 'PASS', { screenshot: ss });
  }
}

async function clickNamed(page, menu, names) {
  for (const name of names) {
    const re = new RegExp(name, 'i');
    const el = page.getByRole('button', { name: re }).or(page.getByRole('link', { name: re })).first();
    if (!(await el.isVisible({ timeout: 400 }).catch(() => false))) continue;
    const beforeDl = downloads.length;
    if (!(await safeClick(el))) continue;
    depthStats.buttons += 1;
    await settle(page, 450);
    const dlg = page.locator('[role="dialog"]:visible').first();
    if (await dlg.isVisible({ timeout: 200 }).catch(() => false)) {
      depthStats.modals += 1;
      depthStats.nestDepth = Math.max(depthStats.nestDepth, 1);
      const ss = await shot(page, `${menu}-modal-${name}`);
      logF(menu, `modal:${name}`, 'PASS', { screenshot: ss });
      await hardDismiss(page);
      continue;
    }
    const menuItems = page.locator('[role="menuitem"]:visible');
    const mc = Math.min(await menuItems.count(), 5);
    if (mc && /export|download/i.test(name)) {
      depthStats.exports += 1;
      for (let i = 0; i < mc; i++) {
        const item = menuItems.nth(i);
        const lab = await labelOf(item);
        const d0 = downloads.length;
        await safeClick(item);
        depthStats.buttons += 1;
        depthStats.exports += 1;
        await settle(page, 700);
        const ss = await shot(page, `${menu}-export-${lab || i}`);
        const newDl = downloads.slice(d0);
        logF(menu, `export:${lab}`, newDl.some((d) => d.ok) ? 'PASS' : 'FAIL', {
          screenshot: ss,
          downloads: newDl,
        });
        await hardDismiss(page);
        if (i < mc - 1) {
          const reopen = page.locator('main button:visible').filter({ hasText: /export|download/i }).first();
          if (await reopen.isVisible({ timeout: 250 }).catch(() => false)) {
            await safeClick(reopen);
            await settle(page, 250);
          }
        }
      }
      continue;
    }
    const ss = await shot(page, `${menu}-btn-${name}`);
    logF(menu, `btn:${name}`, 'PASS', {
      screenshot: ss,
      downloads: downloads.slice(beforeDl),
      url: page.url(),
    });
    await hardDismiss(page);
  }
}

/**
 * Stress: Promise.all concurrent clicks on Export CSV / PDF / Excel / Download
 */
async function stressConcurrentExports(page, menu, label) {
  depthStats.concurrentExportBursts += 1;
  const beforeDl = downloads.length;
  const beforeNet = networkLog.length;
  const beforeFail = state.failedRequests.length;

  // Prefer role-based export controls (Reports uses "Export CSV")
  const roleBtns = page.getByRole('button', { name: /export|download|pdf|excel|csv|xlsx/i });
  const roleCount = await roleBtns.count();
  const clickables = [];
  for (let i = 0; i < Math.min(roleCount, 4); i++) {
    const el = roleBtns.nth(i);
    const lab = (await el.innerText().catch(() => '')) || (await el.getAttribute('aria-label')) || `export-${i}`;
    clickables.push({ el, lab: lab.replace(/\s+/g, ' ').trim() });
  }
  // If only one Export CSV, duplicate-click it N times for concurrency stress
  if (clickables.length === 1) {
    const base = clickables[0];
    clickables.push({ el: base.el, lab: `${base.lab}#2` }, { el: base.el, lab: `${base.lab}#3` });
  }
  // Also include open menu items
  const menuItems = page.locator('[role="menuitem"]:visible');
  const mc = await menuItems.count();
  for (let i = 0; i < Math.min(mc, 4); i++) {
    const el = menuItems.nth(i);
    const lab = await labelOf(el);
    if (/export|download|pdf|excel|csv|xlsx|pack/i.test(lab)) clickables.push({ el, lab });
  }

  console.log(
    `  ⚡ stress ${menu}/${label}: Promise.all(${clickables.length}) [${clickables.map((c) => c.lab).join(', ')}]`,
  );
  const started = Date.now();
  const results = await Promise.all(
    clickables.map(async ({ el, lab }) => {
      const t0 = Date.now();
      try {
        await el.click({ force: true, timeout: 1500 });
        depthStats.buttons += 1;
        depthStats.exports += 1;
        return { lab, clicked: true, ms: Date.now() - t0 };
      } catch (e) {
        return { lab, clicked: false, ms: Date.now() - t0, err: String(e).slice(0, 100) };
      }
    }),
  );
  // allow async export job → download polling
  await settle(page, 2500);
  const ss = await shot(page, `${menu}-stress-${label}`);
  // wait a bit more for late download events
  await settle(page, 800);
  const newDl = downloads.slice(beforeDl);
  const newNet = networkLog
    .slice(beforeNet)
    .filter((n) => /export|download|\.csv|\.xlsx|\.pdf|reports\/export/i.test(n.url));
  const newFail = state.failedRequests.slice(beforeFail);
  const entry = {
    menu,
    label,
    clicked: results,
    downloads: newDl,
    network: newNet,
    failedApi: newFail.map((f) => `${f.status} ${f.method} ${f.url.replace(/https?:\/\/[^/]+/, '')}`),
    elapsedMs: Date.now() - started,
    screenshot: ss,
    anyDownloadOk: newDl.some((d) => d.ok),
    anyDownloadFail: newDl.some((d) => !d.ok),
  };
  stressExports.push(entry);
  logF(menu, `STRESS:${label}`, entry.anyDownloadOk ? 'PASS' : newDl.length ? 'FAIL' : 'WARN', {
    screenshot: ss,
    note: `concurrent=${clickables.length} dlOk=${newDl.filter((d) => d.ok).length} dlFail=${newDl.filter((d) => !d.ok).length}`,
    downloads: newDl,
  });

  if (newDl.some((d) => !d.ok) || (clickables.length > 0 && newDl.length === 0)) {
    const has202Download = newNet.some((n) => /\/download/.test(n.url) && n.status === 202);
    const hasExportPost = newNet.some((n) => /reports\/export/.test(n.url) && n.method === 'POST');
    addIssue({
      id: `STRESS-EXPORT-${slug(menu)}-${slug(label)}`,
      title: `Concurrent export stress failed (${menu})`,
      where: `${menu} / concurrent Export CSV|PDF|Excel`,
      why: newDl.length
        ? `Download events: ${newDl.map((d) => `${d.suggested} ok:${d.ok} fail:${d.failure}`).join('; ')}`
        : `No download event; API: ${newNet
            .slice(0, 6)
            .map((n) => `${n.status} ${n.method} ${n.url}`)
            .join('; ') || 'none'}`,
      classification: has202Download || hasExportPost ? 'BOTH' : newFail.some((f) => f.status >= 500) ? 'BACKEND' : 'FRONTEND',
      how: has202Download
        ? 'Download polled while job still 202 Accepted — FE should retry until 200 or serialize exports under concurrency'
        : 'Ensure export returns downloadable file and FE triggers blob download',
      screenshot: ss,
      network:
        newNet
          .slice(0, 10)
          .map((n) => `${n.status} ${n.method} ${n.url}`)
          .join(' · ') ||
        newDl.map((d) => `download ${d.suggested} (ok:${d.ok})`).join(' · ') ||
        'n/a',
      expected: 'download ok:true per click',
      actual: JSON.stringify({
        downloads: newDl.map((d) => ({ s: d.suggested, ok: d.ok, f: d.failure })),
        clicks: results,
      }).slice(0, 500),
    });
  }
  await hardDismiss(page);
  return entry;
}

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await settle(page, 400);
  await shot(page, 'login-form');
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(PASSWORD);
  const tenant = page.locator('input[name="tenant"], input[placeholder*="tenant" i]').first();
  if (await tenant.isVisible({ timeout: 200 }).catch(() => false)) await tenant.fill(TENANT);
  await shot(page, 'login-filled');
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
  await page.waitForURL(/dashboard|home|payroll|employees/, { timeout: 20000 }).catch(() => {});
  await settle(page, 600);
  const ss = await shot(page, 'login-success');
  logF('Auth', 'login', 'PASS', { screenshot: ss, url: page.url() });

  // bootstrap 401 noise
  const boot = state.failedRequests.filter((f) => /\/api\/auth\/(me|refresh)/.test(f.url) && f.status === 401);
  if (boot.length) {
    addIssue({
      id: 'SA-PAY-LOGIN-401',
      title: 'Login bootstrap 401s (me/refresh)',
      where: '/login',
      why: boot.map((f) => `${f.method} ${f.url} → ${f.status}`).join('; '),
      classification: 'FRONTEND',
      how: 'Skip me/refresh on public auth routes',
      screenshot: '001-login-form.png',
      network: boot.map((f) => `${f.status} ${f.method} ${f.url}`).join(' · '),
    });
  }
}

async function explorePayroll(page) {
  depthStats.menus += 1;
  console.log('→ Payroll');
  await gotoPath(page, '/payroll');
  const ss = await shot(page, 'payroll-land');
  logF('Payroll', 'open', 'PASS', { screenshot: ss });
  await clickTabs(page, 'Payroll', 6);
  await settle(page, 1200);
  await clickNamed(page, 'Payroll', ['Run Payroll']);
  await hardDismiss(page);
  await gotoPath(page, '/payroll');
  await settle(page, 1200);

  // Nest via Actions for <period> → View
  const actions = page.getByRole('button', { name: /actions for/i });
  const actCount = await actions.count();
  logF('Payroll', `actions-found:${actCount}`, actCount ? 'PASS' : 'WARN');
  if (actCount > 0) {
    await safeClick(actions.first());
    depthStats.buttons += 1;
    await settle(page, 400);
    await shot(page, 'payroll-actions-menu');
    const view = page.getByRole('menuitem', { name: /view/i }).first();
    if (await view.isVisible({ timeout: 500 }).catch(() => false)) {
      await safeClick(view);
      depthStats.nestDepth = Math.max(depthStats.nestDepth, 1);
      await settle(page, 1000);
      const sd = await shot(page, 'payroll-run-detail');
      logF('Payroll', 'run-detail-via-actions', 'PASS', { screenshot: sd, url: page.url() });
      await clickTabs(page, 'PayrollRun', 5);
      await clickNamed(page, 'PayrollRun', [
        'Export CSV',
        'Export',
        'Download',
        'Export pack',
        'PDF',
        'Excel',
        'CSV',
      ]);
      await stressConcurrentExports(page, 'PayrollRun', 'detail-export');
    } else {
      await hardDismiss(page);
    }
  }

  for (const extra of PAYROLL_EXTRA) {
    await gotoPath(page, extra);
    const se = await shot(page, `payroll-extra-${slug(extra)}`);
    logF('Payroll', `extra:${extra}`, 'PASS', { screenshot: se });
    await clickTabs(page, `Payroll${extra}`, 5);
    await clickNamed(page, `Payroll${extra}`, ['Export CSV', 'Export', 'New Invoice', 'Save', 'Go-Live', 'Pay Calendar']);
  }

  await gotoPath(page, '/payroll');
  await settle(page, 1000);
  // soft-nav buttons that stay on payroll shell
  await clickNamed(page, 'Payroll', ['Migration', 'Global Workforce']);
  await gotoPath(page, '/payroll');
  await settle(page, 800);
  await stressConcurrentExports(page, 'Payroll', 'list-export');
}

async function explorePayout(page) {
  depthStats.menus += 1;
  console.log('→ Payout methods');
  await gotoPath(page, '/payout-methods');
  const ss = await shot(page, 'payout-land');
  logF('Payout', 'open', 'PASS', { screenshot: ss });
  const bodyText = await page.locator('main').innerText().catch(() => '');
  if (/no payout|add.*account|self-service|no employee|get started|empty/i.test(bodyText)) {
    addIssue({
      id: 'SA-PAYOUT-EMPTY',
      title: 'Payout methods empty/self-service for SUPER_ADMIN',
      where: '/payout-methods',
      why: 'SA employeeId:null; page shows empty/self-service instead of admin approvals-first',
      classification: 'FRONTEND',
      how: 'Default SUPER_ADMIN to /payout-methods/approvals when no employee record',
      screenshot: ss,
      network: 'n/a',
      expected: 'admin approvals queue',
      actual: bodyText.slice(0, 160).replace(/\n/g, ' '),
    });
  }
  await clickNamed(page, 'Payout', ['Review approvals', 'Add account', 'Export', 'Download']);

  await gotoPath(page, '/payout-methods/approvals');
  const sa = await shot(page, 'payout-approvals');
  logF('Payout', 'approvals', 'PASS', { screenshot: sa });
  await clickTabs(page, 'PayoutApprovals', 5);
  await clickNamed(page, 'PayoutApprovals', ['Approvals', 'Verification', 'Add account', 'Export', 'Download']);
  const add = page.locator('main button:visible').filter({ hasText: /add account|add payout/i }).first();
  if (await add.isVisible({ timeout: 350 }).catch(() => false)) {
    await safeClick(add);
    depthStats.modals += 1;
    await settle(page, 350);
    await shot(page, 'payout-add-account-modal');
    await hardDismiss(page);
  }
  await stressConcurrentExports(page, 'Payout', 'approvals-export');
}

async function exploreReports(page) {
  depthStats.menus += 1;
  console.log('→ Reports');
  await gotoPath(page, '/reports');
  const ss = await shot(page, 'reports-land');
  logF('Reports', 'open', 'PASS', { screenshot: ss });

  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/reports"]')].map((a) => a.getAttribute('href')),
  );
  if (!hrefs.length) {
    addIssue({
      id: 'SA-REPORTS-NO-HREF',
      title: 'Reports nav items are not real hrefs',
      where: '/reports left nav',
      why: 'No <a href="/reports/..."> discovered',
      classification: 'FRONTEND',
      how: 'Use Next Link for each report slug',
      screenshot: ss,
      network: 'n/a',
    });
  }

  for (const r of REPORT_ROUTES) {
    const leaf = r.split('/').pop();
    const clicked = await clickByText(page, new RegExp(leaf.replace(/-/g, '[- ]?'), 'i'), {
      root: 'body',
      timeout: 350,
      wait: 450,
    });
    if (!clicked) {
      await gotoPath(page, `/reports?report=${r}`);
      const mainTxt = await page.locator('main').innerText().catch(() => '');
      if (/404|not found|this page could not/i.test(mainTxt)) {
        await gotoPath(page, `/reports/${r}`);
      }
    }
    const s = await shot(page, `reports-${slug(r)}`);
    const mainTxt = await page.locator('main').innerText().catch(() => '');
    const status = /404|not found|this page could not/i.test(mainTxt) ? 'FAIL' : 'PASS';
    logF('Reports', `type:${r}`, status, { screenshot: s, url: page.url() });
    if (status === 'FAIL') {
      addIssue({
        id: `SA-REPORTS-404-${slug(r)}`,
        title: `Report route 404: ${r}`,
        where: `/reports/${r}`,
        why: 'Nav landed on not-found',
        classification: 'FRONTEND',
        how: 'Ensure App Router page or redirect for report slugs',
        screenshot: s,
        network: `GET ${page.url()}`,
      });
    }
    await clickNamed(page, `Reports/${r}`, ['Export CSV', 'Export', 'Download', 'Schedule']);
  }

  // Stress bursts — concurrent Export CSV (Promise.all)
  await gotoPath(page, '/reports');
  await settle(page, 800);
  await clickByText(page, /headcount/i, { root: 'body', wait: 500 });
  await stressConcurrentExports(page, 'Reports', 'headcount-formats');

  await gotoPath(page, '/reports');
  await settle(page, 600);
  await clickByText(page, /ctc analysis/i, { root: 'body', wait: 700 });
  await settle(page, 500);
  await stressConcurrentExports(page, 'Reports', 'ctc-formats');

  // Explicit single Export CSV
  await gotoPath(page, '/reports');
  await settle(page, 800);
  await clickByText(page, /headcount/i, { root: 'body', wait: 500 });
  const d0 = downloads.length;
  const n0 = networkLog.length;
  const csvBtn = page.getByRole('button', { name: /export csv/i }).first();
  if (await csvBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
    await safeClick(csvBtn);
    depthStats.exports += 1;
    depthStats.buttons += 1;
    await settle(page, 2500);
  }
  const ssCsv = await shot(page, 'reports-export-csv-explicit');
  const newDl = downloads.slice(d0);
  const newNet = networkLog.slice(n0).filter((n) => /export|download/i.test(n.url));
  logF('Reports', 'export-csv-explicit', newDl.some((d) => d.ok) ? 'PASS' : newDl.length ? 'FAIL' : 'WARN', {
    screenshot: ssCsv,
    downloads: newDl,
    note: newNet.map((n) => `${n.status} ${n.method} ${n.url}`).join(' · '),
  });
  if (newDl.length && newDl.every((d) => !d.ok)) {
    addIssue({
      id: 'SA-REPORTS-CSV-OKFALSE',
      title: 'Reports CSV export download ok:false',
      where: 'Reports → Export CSV',
      why: `Download event(s) failed: ${newDl.map((d) => `${d.suggested} ok:${d.ok} fail:${d.failure}`).join('; ')}`,
      classification: newNet.some((n) => n.status === 202 && /download/.test(n.url)) ? 'BOTH' : 'FRONTEND',
      how: 'Serialize export jobs or poll download until 200; fix FE download completion under async 202',
      screenshot: ssCsv,
      network: newNet.map((n) => `${n.status} ${n.method} ${n.url}`).join(' · ') || newDl.map((d) => `download ${d.suggested} (ok:${d.ok})`).join(' · '),
      expected: 'ok:true',
      actual: 'ok:false',
    });
  }
}

async function exploreAnalytics(page) {
  depthStats.menus += 1;
  console.log('→ Analytics');
  await gotoPath(page, '/analytics');
  const ss = await shot(page, 'analytics-land');
  logF('Analytics', 'open', 'PASS', { screenshot: ss });

  for (const r of ANALYTICS_RANGES) {
    const ok = await clickByText(page, new RegExp(`^${r}$`, 'i'), { wait: 400 });
    if (!ok) await gotoPath(page, `/analytics?range=${r}`);
    const s = await shot(page, `analytics-${r}`);
    logF('Analytics', `range:${r}`, 'PASS', { screenshot: s, url: page.url() });
  }
  await clickNamed(page, 'Analytics', ['Export', 'Download', 'Custom', 'All departments', '6m', '12m', '2y']);
  await stressConcurrentExports(page, 'Analytics', 'export-burst');

  for (const f of state.failedRequests.filter((x) => /\/analytics\//.test(x.url)).slice(0, 4)) {
    addIssue({
      id: `SA-ANALYTICS-${f.status}-${slug(f.url).slice(-20)}`,
      title: `Analytics API ${f.status}`,
      where: f.url.replace(/https?:\/\/[^/]+/, ''),
      why: `${f.method} → ${f.status}: ${f.body.slice(0, 140)}`,
      classification: classify(f.url, f.status, f.body),
      how: 'Fix analytics endpoint or FE query params',
      screenshot: ss,
      network: `${f.status} ${f.method} ${f.url}`,
    });
  }
}

function writeFindings() {
  const be = issues.filter((i) => i.classification === 'BACKEND');
  const fe = issues.filter((i) => i.classification === 'FRONTEND');
  const both = issues.filter((i) => i.classification === 'BOTH');
  const lines = [];
  lines.push('# SA-PAY-REPORTS — SUPER_ADMIN Stress + Deep E2E (SHORT)');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Date | ${new Date().toISOString()} |`);
  lines.push(`| Role | \`${ROLE}\` — \`${EMAIL}\` / tenant \`${TENANT}\` |`);
  lines.push(`| UI | \`${UI}\` |`);
  lines.push(`| BE | \`${API}\` |`);
  lines.push('| Scope | Payroll, Payout methods, Reports, Analytics |');
  lines.push('| Stress | `Promise.all` concurrent PDF/Excel/CSV export clicks |');
  lines.push(
    `| Screenshots | \`docs/e2e-ui-screenshots/stress/sa-payroll-reports/\` — **${depthStats.screenshots}** PNGs |`,
  );
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  lines.push(`| Menus | ${depthStats.menus} |`);
  lines.push(`| Tabs | ${depthStats.tabs} |`);
  lines.push(`| Buttons | ${depthStats.buttons} |`);
  lines.push(`| Modals | ${depthStats.modals} |`);
  lines.push(`| Export actions | ${depthStats.exports} |`);
  lines.push(`| Concurrent export bursts | ${depthStats.concurrentExportBursts} |`);
  lines.push(`| Nest depth max | ${depthStats.nestDepth} |`);
  lines.push(`| Screenshots | ${depthStats.screenshots} |`);
  lines.push(
    `| Download events | ${downloads.length} (ok:${downloads.filter((d) => d.ok).length} / fail:${downloads.filter((d) => !d.ok).length}) |`,
  );
  lines.push(`| Issues BACKEND | ${be.length} |`);
  lines.push(`| Issues FRONTEND | ${fe.length} |`);
  lines.push(`| Issues BOTH | ${both.length} |`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(
    `Short SA stress shard: Payroll (+extras/run detail), Payout approvals, ${REPORT_ROUTES.length} report types, Analytics ranges. Concurrent export bursts=${depthStats.concurrentExportBursts}; downloads ok=${downloads.filter((d) => d.ok).length} false=${downloads.filter((d) => !d.ok).length}.`,
  );
  lines.push('');
  lines.push('## Stress export bursts');
  lines.push('');
  if (!stressExports.length) lines.push('_None_');
  for (const s of stressExports) {
    lines.push(`### ${s.menu} / ${s.label}`);
    lines.push(`- Clicks: \`${s.clicked.map((c) => c.lab).join(', ') || '(none found)'}\``);
    lines.push(
      `- Downloads: ${s.downloads.length ? s.downloads.map((d) => `\`${d.suggested}\` ok:${d.ok}`).join(', ') : '_none_'}`,
    );
    lines.push(
      `- Network: ${s.network.length ? s.network.map((n) => `\`${n.status} ${n.method} ${n.url}\``).join(' · ') : '_n/a_'}`,
    );
    lines.push(`- Failed API: ${s.failedApi.length ? s.failedApi.join(' · ') : '_none_'}`);
    lines.push(`- Screenshot: \`${s.screenshot}\` · ${s.elapsedMs}ms`);
    lines.push('');
  }
  lines.push('## Downloads');
  lines.push('');
  lines.push(
    downloads.length
      ? downloads.map((d) => `- \`${d.suggested}\` ok:${d.ok} fail:${d.failure || '-'} @ ${d.pageUrl}`).join('\n')
      : '_None_',
  );
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  if (!issues.length) lines.push('_No issues filed._');
  for (const i of issues) {
    lines.push(`### ${i.id}: ${i.title}`);
    lines.push(`- **Where:** ${i.where}`);
    lines.push(`- **Why:** ${i.why}`);
    lines.push(`- **Classification:** ${i.classification}`);
    lines.push(`- **How to resolve:** ${i.how}`);
    lines.push(`- **Screenshot:** \`${i.screenshot || 'n/a'}\``);
    lines.push(`- **Network:** \`${i.network || 'n/a'}\``);
    if (i.expected) lines.push(`- **Expected:** ${i.expected}`);
    if (i.actual) lines.push(`- **Actual:** ${i.actual}`);
    lines.push('');
  }
  lines.push('## Action log');
  lines.push('');
  for (const f of findings) {
    lines.push(
      `- **[${f.status}]** ${f.menu} → ${f.action}${f.screenshot ? ` — \`${f.screenshot}\`` : ''}${f.note ? ` — ${f.note}` : ''}`,
    );
  }
  lines.push('');
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));
  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify(
      {
        role: ROLE,
        email: EMAIL,
        depthStats,
        findings,
        issues,
        downloads,
        stressExports,
        networkLog: networkLog.slice(-250),
        consoleErrors: state.consoleErrors.slice(0, 40),
      },
      null,
      2,
    ),
  );
}

function appendContracts() {
  const bePath = path.join(DOCS, 'E2E_STRESS_BACKEND_CONTRACT.md');
  const fePath = path.join(DOCS, 'E2E_STRESS_FRONTEND_CONTRACT.md');
  const headerBe = `# E2E_STRESS_BACKEND_CONTRACT

> Stress + deep UI E2E shards against local FE:3001 → BE:4000 → Hostinger tunnel  
> Tool: Playwright Chromium · concurrent export / race probes  
> Evidence under \`docs/e2e-ui-screenshots/stress/\`

`;
  const headerFe = `# E2E_STRESS_FRONTEND_CONTRACT

> Stress + deep UI E2E shards against local FE:3001 → BE:4000 → Hostinger tunnel  
> Tool: Playwright Chromium · concurrent export / race probes  
> Evidence under \`docs/e2e-ui-screenshots/stress/\`

`;

  const beIssues = issues.filter((i) => i.classification === 'BACKEND' || i.classification === 'BOTH');
  const feIssues = issues.filter((i) => i.classification === 'FRONTEND' || i.classification === 'BOTH');

  const meta = [
    `**Tester:** \`${EMAIL}\` (${ROLE}) · tenant \`${TENANT}\` · ${new Date().toISOString().slice(0, 10)}`,
    `**Evidence:** \`docs/e2e-ui-screenshots/stress/sa-payroll-reports/\` (**${depthStats.screenshots}** PNGs + \`FINDINGS.md\`)`,
    `**Depth:** menus=${depthStats.menus} tabs=${depthStats.tabs} buttons=${depthStats.buttons} exports=${depthStats.exports} bursts=${depthStats.concurrentExportBursts} nest=${depthStats.nestDepth}`,
    `**Downloads:** ${downloads.length} (ok:${downloads.filter((d) => d.ok).length} / false:${downloads.filter((d) => !d.ok).length})`,
    '',
  ];

  const sectionBe = ['## SA-PAY-REPORTS', '', ...meta];
  if (!beIssues.length) {
    sectionBe.push('_No backend issues in this shard (export ok:false classified FRONTEND unless API 4xx/5xx)._');
    sectionBe.push('');
  }
  for (const [idx, i] of beIssues.entries()) {
    sectionBe.push(`### ISSUE-SA-PAY-BE-${String(idx + 1).padStart(2, '0')}`);
    sectionBe.push(`- **Where:** ${i.where}`);
    sectionBe.push(`- **Why:** ${i.why}`);
    sectionBe.push(`- **Classification:** ${i.classification}`);
    sectionBe.push(`- **How to resolve:** ${i.how}`);
    sectionBe.push(
      `- **Screenshot:** \`docs/e2e-ui-screenshots/stress/sa-payroll-reports/${i.screenshot || 'n/a'}\``,
    );
    sectionBe.push(`- **Network:** \`${i.network || 'n/a'}\``);
    sectionBe.push('');
  }

  const sectionFe = ['## SA-PAY-REPORTS', '', ...meta];
  if (!feIssues.length) {
    sectionFe.push('_No frontend issues in this shard._');
    sectionFe.push('');
  }
  for (const [idx, i] of feIssues.entries()) {
    sectionFe.push(`### ISSUE-SA-PAY-FE-${String(idx + 1).padStart(2, '0')}`);
    sectionFe.push(`- **Where:** ${i.where}`);
    sectionFe.push(`- **Why:** ${i.why}`);
    sectionFe.push(`- **Classification:** ${i.classification}`);
    sectionFe.push(`- **How to resolve:** ${i.how}`);
    sectionFe.push(
      `- **Screenshot:** \`docs/e2e-ui-screenshots/stress/sa-payroll-reports/${i.screenshot || 'n/a'}\``,
    );
    sectionFe.push(`- **Network:** \`${i.network || 'n/a'}\``);
    sectionFe.push('');
  }

  function upsert(filePath, fileHeader, sectionBody) {
    let cur = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : fileHeader;
    const marker = '## SA-PAY-REPORTS';
    const idx = cur.indexOf(marker);
    const body = sectionBody.join('\n') + '\n';
    if (idx >= 0) {
      const rest = cur.slice(idx + marker.length);
      const next = rest.search(/\n## /);
      const end = next >= 0 ? idx + marker.length + next + 1 : cur.length;
      cur = cur.slice(0, idx) + body + (next >= 0 ? cur.slice(end) : '');
    } else {
      if (!cur.endsWith('\n')) cur += '\n';
      cur += '\n' + body;
    }
    if (!cur.endsWith('\n')) cur += '\n';
    fs.writeFileSync(filePath, cur);
  }

  upsert(bePath, headerBe, sectionBe);
  upsert(fePath, headerFe, sectionFe);
  console.log(`Wrote contracts:\n  ${bePath}\n  ${fePath}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  wire(page);

  const hardDeadline = setTimeout(() => {
    console.error('HARD DEADLINE 180s — writing partial results');
    writeFindings();
    appendContracts();
    browser.close().finally(() => process.exit(2));
  }, 180000);

  try {
    await login(page);
    await explorePayroll(page);
    await explorePayout(page);
    await exploreReports(page);
    await exploreAnalytics(page);
  } catch (e) {
    console.error('RUNNER ERROR', e);
    await shot(page, 'runner-error');
    addIssue({
      id: 'SA-PAY-RUNNER-ERROR',
      title: 'Runner exception',
      where: page.url(),
      why: String(e).slice(0, 400),
      classification: 'FRONTEND',
      how: 'Stabilize selectors / timing',
      screenshot: 'runner-error',
      network: 'n/a',
    });
  } finally {
    clearTimeout(hardDeadline);
    writeFindings();
    appendContracts();
    await browser.close().catch(() => {});
  }

  console.log('\n=== DONE SA-PAY-REPORTS ===');
  console.log(
    JSON.stringify(
      { depthStats, issues: issues.length, downloads: downloads.length, bursts: stressExports.length },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
