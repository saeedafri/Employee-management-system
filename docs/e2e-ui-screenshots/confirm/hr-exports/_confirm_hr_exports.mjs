/**
 * DEEP EXPORT CONFIRMATION — HR_ADMIN (v2)
 * Click every Export/PDF/Excel/CSV/download on Reports, Payroll, Employees,
 * Attendance, Leave, Analytics. Screenshot + download matrix.
 * Out: docs/e2e-ui-screenshots/confirm/hr-exports/ + FINDINGS.md
 * Appends ## HR_ADMIN into docs/E2E_EXPORT_CONFIRM_MATRIX.md
 * No commits. No Render.
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
const EMAIL = 'hr@acme.test';
const PASS = 'Password123!';
const TENANT = 'acme-corp-001';
const ROLE = 'HR_ADMIN';

const REPORT_ROUTES = [
  'workforce/headcount',
  'workforce/turnover',
  'workforce/demographics',
  'attendance/summary',
  'attendance/absenteeism',
  'leave/utilization',
  'leave/pending',
  'payroll/summary',
  'payroll/ctc-analysis',
];

const EXPORT_RE = /export|download|pdf|excel|csv|xlsx|register|pack|payslip/i;

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.png') || f.startsWith('_dl-') || f === 'results.json' || f === 'FINDINGS.md' || f === '_run.log') {
    // keep script; wipe evidence for clean rerun
    if (!f.startsWith('_confirm')) fs.unlinkSync(path.join(OUT, f));
  }
}

let shotIdx = 0;
const matrix = [];
const findings = [];
const issues = [];
const downloads = [];
const networkLog = [];
const failedApi = [];
const consoleErrors = [];
const discovered = [];

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56);
}

async function settle(page, ms = 500) {
  await page.waitForTimeout(ms);
}

async function ready(page, ms = 1200) {
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await settle(page, ms);
}

async function shot(page, name) {
  shotIdx += 1;
  const f = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  await page.screenshot({ path: path.join(OUT, f), fullPage: false }).catch(() => {});
  return f;
}

function logF(surface, action, status, extra = {}) {
  findings.push({ surface, action, status, ...extra, ts: new Date().toISOString() });
  console.log(`[${status}] ${surface} → ${action}${extra.note ? ` — ${extra.note}` : ''}`);
}

function addIssue(i) {
  const key = `${i.title}|${i.where}|${i.classification}`;
  if (issues.some((x) => `${x.title}|${x.where}|${x.classification}` === key)) return;
  issues.push(i);
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
        body = (await res.text()).slice(0, 300);
      } catch {
        /* ignore */
      }
      failedApi.push({ method, url, status, body, pageUrl: page.url() });
    }
    if (/\/api\/|export|download|\.csv|\.xlsx|\.pdf|reports|payroll|analytics|attendance|leave/i.test(url)) {
      networkLog.push({
        method,
        status,
        url: url.replace(FE, '').replace('http://localhost:4000', ''),
        pageUrl: page.url().replace(FE, ''),
        t: Date.now(),
      });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ text: msg.text().slice(0, 250), pageUrl: page.url() });
  });
  page.on('download', async (dl) => {
    try {
      const fail = await Promise.resolve(dl.failure());
      const p = await dl.path().catch(() => null);
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
        saved: saved ? path.basename(saved) : null,
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
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click({ force: true, timeout: 2500 });
    return true;
  } catch {
    return false;
  }
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
    .slice(0, 100);
}

async function gotoPath(page, href) {
  await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await ready(page, 900);
}

/**
 * Return unique labels of visible export-like controls (no element handles — re-query by label).
 */
async function listExportLabels(page) {
  const labels = [];
  const seen = new Set();
  const loc = page.locator(
    'main button:visible, main a:visible, [role="dialog"] button:visible, header button:visible, [data-slot="page-header"] button:visible',
  );
  const n = Math.min(await loc.count().catch(() => 0), 120);
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    const lab = await labelOf(el);
    if (!lab || !EXPORT_RE.test(lab)) continue;
    // ignore pure navigation noise
    if (/sign out|log out|notification/i.test(lab)) continue;
    const key = lab.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(lab);
  }
  // role-based catch for Export / Export CSV etc.
  const roleBtns = page.getByRole('button', { name: EXPORT_RE });
  const rc = Math.min(await roleBtns.count().catch(() => 0), 20);
  for (let i = 0; i < rc; i++) {
    const el = roleBtns.nth(i);
    if (!(await el.isVisible({ timeout: 100 }).catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || !EXPORT_RE.test(lab)) continue;
    const key = lab.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(lab);
  }
  return labels;
}

function locatorForLabel(page, lab) {
  const esc = lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page
    .getByRole('button', { name: new RegExp(esc, 'i') })
    .or(page.getByRole('link', { name: new RegExp(esc, 'i') }))
    .or(page.locator('main button:visible, main a:visible').filter({ hasText: new RegExp(esc, 'i') }))
    .first();
}

async function waitDownloadOrApi(page, beforeDl, beforeNet, maxMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (downloads.length > beforeDl) return;
    const newNet = networkLog.slice(beforeNet).filter((n) => /export|download|\.csv|\.xlsx|\.pdf/i.test(n.url));
    // if we got a 200 download or 202 export, keep waiting a bit more for browser download event
    if (newNet.some((n) => /\/download/.test(n.url) && n.status === 200)) {
      await settle(page, 800);
      if (downloads.length > beforeDl) return;
    }
    await settle(page, 400);
  }
}

async function clickLabeledExport(page, surface, pageLabel, lab) {
  const beforeDl = downloads.length;
  const beforeNet = networkLog.length;
  const beforeFail = failedApi.length;
  const beforeSs = await shot(page, `${surface}-${pageLabel}-before-${lab}`);

  const el = locatorForLabel(page, lab);
  if (!(await el.isVisible({ timeout: 1500 }).catch(() => false))) {
    const row = {
      surface,
      page: pageLabel,
      control: lab,
      status: 'MISS',
      note: 'control not visible at click time',
      screenshotBefore: beforeSs,
      screenshotAfter: null,
      downloads: [],
      network: [],
      failedApi: [],
      url: page.url(),
    };
    matrix.push(row);
    logF(surface, `${pageLabel}:${lab}`, 'MISS', { screenshot: beforeSs });
    return;
  }

  if (!(await safeClick(el))) {
    matrix.push({
      surface,
      page: pageLabel,
      control: lab,
      status: 'FAIL',
      note: 'click failed',
      screenshotBefore: beforeSs,
      screenshotAfter: null,
      downloads: [],
      network: [],
      failedApi: [],
      url: page.url(),
    });
    logF(surface, `${pageLabel}:${lab}`, 'FAIL', { note: 'click failed' });
    return;
  }

  await settle(page, 500);

  // Format menu?
  const menuItems = page.locator('[role="menuitem"]:visible');
  const mc = await menuItems.count().catch(() => 0);
  const formats = [];
  for (let i = 0; i < Math.min(mc, 8); i++) {
    const item = menuItems.nth(i);
    const flab = await labelOf(item);
    if (flab && EXPORT_RE.test(flab)) formats.push(flab);
  }

  if (formats.length) {
    for (let fi = 0; fi < formats.length; fi++) {
      const flab = formats[fi];
      if (fi > 0) {
        await hardDismiss(page);
        await settle(page, 200);
        const reopen = locatorForLabel(page, lab);
        if (await reopen.isVisible({ timeout: 500 }).catch(() => false)) {
          await safeClick(reopen);
          await settle(page, 300);
        }
      }
      const item = page.getByRole('menuitem', { name: new RegExp(flab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
      if (!(await item.isVisible({ timeout: 500 }).catch(() => false))) continue;
      const d0 = downloads.length;
      const n0 = networkLog.length;
      const f0 = failedApi.length;
      await safeClick(item);
      await waitDownloadOrApi(page, d0, n0, 7000);
      const afterSs = await shot(page, `${surface}-${pageLabel}-${lab}-${flab}`);
      pushResult(surface, pageLabel, `${lab} → ${flab}`, beforeSs, afterSs, d0, n0, f0, page.url());
      await hardDismiss(page);
    }
    return;
  }

  // Dialog with confirm Export?
  const dlg = page.locator('[role="dialog"]:visible').first();
  if (await dlg.isVisible({ timeout: 300 }).catch(() => false)) {
    const dlgSs = await shot(page, `${surface}-${pageLabel}-dialog-${lab}`);
    const confirm = page
      .locator('[role="dialog"] button:visible')
      .filter({ hasText: /export|download|confirm|csv|pdf|excel/i })
      .first();
    if (await confirm.isVisible({ timeout: 400 }).catch(() => false)) {
      const clab = await labelOf(confirm);
      const d0 = downloads.length;
      const n0 = networkLog.length;
      const f0 = failedApi.length;
      await safeClick(confirm);
      await waitDownloadOrApi(page, d0, n0, 7000);
      const afterSs = await shot(page, `${surface}-${pageLabel}-dialog-confirm-${clab}`);
      pushResult(surface, pageLabel, `${lab} → dialog:${clab}`, beforeSs, afterSs, d0, n0, f0, page.url());
    } else {
      matrix.push({
        surface,
        page: pageLabel,
        control: lab,
        status: 'MODAL',
        note: 'opened dialog without confirmable export',
        screenshotBefore: beforeSs,
        screenshotAfter: dlgSs,
        downloads: [],
        network: [],
        failedApi: [],
        url: page.url(),
      });
      logF(surface, `${pageLabel}:${lab}`, 'MODAL', { screenshot: dlgSs });
    }
    await hardDismiss(page);
    return;
  }

  await waitDownloadOrApi(page, beforeDl, beforeNet, 7000);
  const afterSs = await shot(page, `${surface}-${pageLabel}-after-${lab}`);
  pushResult(surface, pageLabel, lab, beforeSs, afterSs, beforeDl, beforeNet, beforeFail, page.url());
  await hardDismiss(page);
}

function pushResult(surface, pageLabel, control, beforeSs, afterSs, d0, n0, f0, url) {
  const newDl = downloads.slice(d0);
  const newNet = networkLog.slice(n0).filter((n) => /export|download|\.csv|\.xlsx|\.pdf/i.test(n.url));
  const newFail = failedApi.slice(f0);
  const ok = newDl.some((d) => d.ok);
  const status = ok ? 'PASS' : newDl.length ? 'FAIL' : newNet.length ? 'WARN' : 'NO_DOWNLOAD';
  const note = ok
    ? `dl:${newDl.map((d) => d.suggested).join(',')}`
    : newDl.length
      ? `dl fail:${newDl.map((d) => d.failure || 'unknown').join(';')}`
      : newNet.length
        ? `api only: ${newNet.map((n) => `${n.status} ${n.method} ${n.url}`).join(' · ')}`
        : 'no download / no export API';
  matrix.push({
    surface,
    page: pageLabel,
    control,
    status,
    note,
    screenshotBefore: beforeSs,
    screenshotAfter: afterSs,
    downloads: newDl.map((d) => ({ suggested: d.suggested, ok: d.ok, failure: d.failure, saved: d.saved })),
    network: newNet.slice(0, 12),
    failedApi: newFail.map((f) => `${f.status} ${f.method} ${f.url.replace(/https?:\/\/[^/]+/, '')}`),
    url,
  });
  logF(surface, `${pageLabel}:${control}`, status, { note, screenshot: afterSs });

  if (status === 'FAIL' || status === 'NO_DOWNLOAD' || status === 'WARN') {
    addIssue({
      id: `HR-EXPORT-${slug(surface)}-${slug(pageLabel)}-${slug(control)}`,
      title: `Export control did not yield successful download`,
      where: `${surface} / ${pageLabel} / ${control}`,
      why: note,
      classification: newFail.some((f) => f.status >= 500)
        ? 'BACKEND'
        : newNet.some((n) => n.status >= 400)
          ? 'BOTH'
          : newNet.length
            ? 'FRONTEND'
            : 'FRONTEND',
      how: 'Ensure FE triggers blob/Content-Disposition download; BE export returns 200 file',
      screenshot: afterSs,
      network: newNet
        .slice(0, 8)
        .map((n) => `${n.status} ${n.method} ${n.url}`)
        .join(' · '),
    });
  }
}

async function probeAndClick(page, surface, href, pageLabel) {
  console.log(`→ ${surface} ${href} (${pageLabel})`);
  await gotoPath(page, href);
  const land = await shot(page, `${surface}-${pageLabel}-landing`);
  logF(surface, `${pageLabel}:landing`, 'PASS', { screenshot: land, url: page.url() });

  // wait for common export labels if expected
  await page
    .getByRole('button', { name: /export|download|pdf|excel|csv/i })
    .first()
    .waitFor({ state: 'visible', timeout: 4000 })
    .catch(() => {});

  const labels = await listExportLabels(page);
  discovered.push({ surface, page: pageLabel, url: page.url(), controls: labels });
  console.log(`  controls: [${labels.join(', ')}]`);

  if (!labels.length) {
    matrix.push({
      surface,
      page: pageLabel,
      control: '(none)',
      status: 'NONE',
      note: 'no Export/PDF/Excel/CSV/download control visible',
      screenshotBefore: await shot(page, `${surface}-${pageLabel}-no-export`),
      screenshotAfter: null,
      downloads: [],
      network: [],
      failedApi: [],
      url: page.url(),
    });
    logF(surface, `${pageLabel}:no-export-controls`, 'NONE');
    return labels;
  }

  // Click each label in place (no re-nav between clicks for same page)
  for (const lab of labels) {
    // re-locate after prior clicks
    await settle(page, 200);
    // if page navigated away, go back
    if (!page.url().includes(href.split('?')[0].replace(/\/$/, '')) && href !== '/payroll') {
      // soft check — for detail pages href may be subset
    }
    await clickLabeledExport(page, surface, pageLabel, lab);
  }
  return labels;
}

async function exploreTabs(page, surface, href, pageLabel) {
  await gotoPath(page, href);
  const tabs = page.locator('main [role="tab"]:visible');
  const tn = Math.min(await tabs.count().catch(() => 0), 8);
  const names = [];
  for (let i = 0; i < tn; i++) {
    const lab = await labelOf(tabs.nth(i));
    if (lab) names.push(lab);
  }
  for (const tab of names) {
    await gotoPath(page, href);
    const el = page.locator('main [role="tab"]:visible').filter({ hasText: new RegExp(tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
    if (!(await el.isVisible({ timeout: 500 }).catch(() => false))) continue;
    await safeClick(el);
    await ready(page, 700);
    await shot(page, `${surface}-tab-${tab}`);
    const labels = await listExportLabels(page);
    const pl = `${pageLabel}-tab-${slug(tab)}`;
    discovered.push({ surface, page: pl, url: page.url(), controls: labels });
    console.log(`  tab ${tab}: [${labels.join(', ')}]`);
    if (!labels.length) {
      matrix.push({
        surface,
        page: pl,
        control: '(none)',
        status: 'NONE',
        note: 'no export on tab',
        screenshotBefore: await shot(page, `${surface}-${pl}-no-export`),
        screenshotAfter: null,
        downloads: [],
        network: [],
        failedApi: [],
        url: page.url(),
      });
      continue;
    }
    for (const lab of labels) {
      await clickLabeledExport(page, surface, pl, lab);
    }
  }
}

async function login(page) {
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 600);
  await shot(page, 'login-form');
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(PASS);
  const tenant = page.locator('input[name="tenant"], input[placeholder*="tenant" i]').first();
  if (await tenant.isVisible({ timeout: 200 }).catch(() => false)) await tenant.fill(TENANT);
  await shot(page, 'login-filled');
  await page.locator('button[type="submit"]').first().click();
  // wait until we leave login
  for (let i = 0; i < 40; i++) {
    await settle(page, 250);
    if (!/\/login/.test(page.url())) break;
  }
  await ready(page, 800);
  const ss = await shot(page, 'login-success');
  if (/\/login/.test(page.url())) {
    addIssue({
      id: 'HR-EXPORT-LOGIN-FAIL',
      title: 'Login did not leave /login',
      where: '/login',
      why: `Still on ${page.url()}`,
      classification: 'FRONTEND',
      how: 'Check auth credentials / FE login flow',
      screenshot: ss,
      network: failedApi
        .filter((f) => /auth/.test(f.url))
        .slice(0, 5)
        .map((f) => `${f.status} ${f.method} ${f.url}`)
        .join(' · '),
    });
    throw new Error('login failed');
  }
  logF('Auth', 'login', 'PASS', { screenshot: ss, url: page.url() });

  const boot = failedApi.filter((f) => /\/api\/auth\/(me|refresh)/.test(f.url) && f.status === 401);
  if (boot.length) {
    addIssue({
      id: 'HR-EXPORT-LOGIN-401',
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

async function explorePayrollDeep(page) {
  console.log('→ Payroll run detail');
  await gotoPath(page, '/payroll');
  await ready(page, 1200);
  await shot(page, 'payroll-list-for-detail');

  const actions = page.getByRole('button', { name: /actions for/i });
  if ((await actions.count().catch(() => 0)) > 0) {
    await safeClick(actions.first());
    await settle(page, 400);
    await shot(page, 'payroll-actions-menu');
    const view = page.getByRole('menuitem', { name: /view/i }).first();
    if (await view.isVisible({ timeout: 600 }).catch(() => false)) {
      await safeClick(view);
      await ready(page, 1000);
      const detailUrl = page.url();
      await shot(page, 'payroll-run-detail');
      const labels = await listExportLabels(page);
      discovered.push({ surface: 'Payroll', page: 'run-detail', url: detailUrl, controls: labels });
      console.log(`  run-detail: [${labels.join(', ')}]`);
      for (const lab of labels) {
        if (!page.url().includes('/payroll/')) {
          await page.goto(detailUrl, { waitUntil: 'domcontentloaded' });
          await ready(page, 800);
        }
        await clickLabeledExport(page, 'Payroll', 'run-detail', lab);
      }
    }
  } else {
    matrix.push({
      surface: 'Payroll',
      page: 'run-detail',
      control: '(no Actions)',
      status: 'NONE',
      note: 'no payroll run actions',
      screenshotBefore: await shot(page, 'payroll-no-actions'),
      screenshotAfter: null,
      downloads: [],
      network: [],
      failedApi: [],
      url: page.url(),
    });
  }

  await probeAndClick(page, 'Payroll', '/payroll/my-payslips', 'my-payslips');
}

async function exploreReports(page) {
  await probeAndClick(page, 'Reports', '/reports', 'hub');
  for (const r of REPORT_ROUTES) {
    const label = `report-${slug(r)}`;
    await gotoPath(page, `/reports/${r}`);
    await ready(page, 1200);
    // wait for Export CSV if present
    await page
      .getByRole('button', { name: /export csv|export|download/i })
      .first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .catch(() => {});
    await shot(page, `reports-${label}-landing`);
    const labels = await listExportLabels(page);
    discovered.push({ surface: 'Reports', page: label, url: page.url(), controls: labels });
    console.log(`  ${r}: [${labels.join(', ')}]`);
    if (!labels.length) {
      matrix.push({
        surface: 'Reports',
        page: label,
        control: '(none)',
        status: 'NONE',
        note: 'no export control on this report',
        screenshotBefore: await shot(page, `reports-${label}-no-export`),
        screenshotAfter: null,
        downloads: [],
        network: [],
        failedApi: [],
        url: page.url(),
      });
      continue;
    }
    for (const lab of labels) {
      // stay on page; if navigated away restore
      if (!page.url().includes('/reports/')) {
        await gotoPath(page, `/reports/${r}`);
        await ready(page, 800);
      }
      await clickLabeledExport(page, 'Reports', label, lab);
      // restore report page for next control
      await gotoPath(page, `/reports/${r}`);
      await ready(page, 600);
    }
  }
}

function writeFindings() {
  const pngCount = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length;
  const pass = matrix.filter((m) => m.status === 'PASS').length;
  const fail = matrix.filter((m) => m.status === 'FAIL').length;
  const none = matrix.filter((m) => m.status === 'NONE').length;
  const warn = matrix.filter((m) => m.status === 'WARN').length;
  const noDl = matrix.filter((m) => m.status === 'NO_DOWNLOAD').length;
  const miss = matrix.filter((m) => m.status === 'MISS').length;
  const dlOk = downloads.filter((d) => d.ok).length;
  const dlFail = downloads.filter((d) => !d.ok).length;
  const be = issues.filter((i) => i.classification === 'BACKEND').length;
  const fe = issues.filter((i) => i.classification === 'FRONTEND').length;
  const both = issues.filter((i) => i.classification === 'BOTH').length;
  const started = new Date().toISOString();

  const lines = [];
  lines.push(`# HR_ADMIN — Deep Export Confirmation`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Date | ${started} |`);
  lines.push(`| Role | \`${ROLE}\` — \`${EMAIL}\` / tenant \`${TENANT}\` |`);
  lines.push(`| UI | \`${FE}\` |`);
  lines.push(`| BE | \`${API}\` |`);
  lines.push(`| Scope | Reports, Payroll, Employees, Attendance, Leave, Analytics |`);
  lines.push(`| Screenshots | \`docs/e2e-ui-screenshots/confirm/hr-exports/\` — **${pngCount}** PNGs |`);
  lines.push('');
  lines.push(`## Counts`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|------:|`);
  lines.push(`| Matrix rows | ${matrix.length} |`);
  lines.push(`| PASS (download ok) | ${pass} |`);
  lines.push(`| FAIL (download fail) | ${fail} |`);
  lines.push(`| WARN (API but no download event) | ${warn} |`);
  lines.push(`| NO_DOWNLOAD | ${noDl} |`);
  lines.push(`| MISS | ${miss} |`);
  lines.push(`| NONE (no control) | ${none} |`);
  lines.push(`| Download events | ${downloads.length} (ok:${dlOk} / fail:${dlFail}) |`);
  lines.push(`| Screenshots | ${pngCount} |`);
  lines.push(`| Issues BACKEND | ${be} |`);
  lines.push(`| Issues FRONTEND | ${fe} |`);
  lines.push(`| Issues BOTH | ${both} |`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(
    `HR_ADMIN export confirmation across Reports (${REPORT_ROUTES.length} report types + hub), Payroll (list + run detail + my-payslips), Employees, Attendance, Leave, Analytics. Download events: **${dlOk}/${downloads.length} ok**. Matrix PASS=${pass} FAIL=${fail} WARN=${warn} NO_DOWNLOAD=${noDl} NONE=${none} MISS=${miss}.`,
  );
  lines.push('');
  lines.push(`## Export / download matrix`);
  lines.push('');
  lines.push(`| Surface | Page | Control | Status | Download | Screenshot | Note |`);
  lines.push(`|---------|------|---------|--------|----------|------------|------|`);
  for (const m of matrix) {
    const dl = m.downloads?.length
      ? m.downloads.map((d) => `${d.suggested} ok:${d.ok}`).join('; ')
      : '—';
    const ss = m.screenshotAfter || m.screenshotBefore || '—';
    lines.push(
      `| ${m.surface} | ${m.page} | ${String(m.control).replace(/\|/g, '/')} | ${m.status} | ${dl.replace(/\|/g, '/')} | \`${ss}\` | ${String(m.note || '').replace(/\|/g, '/').slice(0, 140)} |`,
    );
  }
  lines.push('');
  lines.push(`## Downloads`);
  lines.push('');
  if (!downloads.length) lines.push(`_none_`);
  for (const d of downloads) {
    lines.push(
      `- \`${d.suggested}\` ok:${d.ok} fail:${d.failure || '-'} saved:${d.saved || '-'} @ ${d.pageUrl}`,
    );
  }
  lines.push('');
  lines.push(`## Discovered controls`);
  lines.push('');
  for (const d of discovered) {
    lines.push(
      `- **${d.surface}** / ${d.page} (\`${String(d.url).replace(FE, '')}\`): ${d.controls.length ? d.controls.join(', ') : '_none_'}`,
    );
  }
  lines.push('');
  lines.push(`## Issues`);
  lines.push('');
  if (!issues.length) lines.push(`_No issues._`);
  for (const i of issues) {
    lines.push(`### ${i.id}: ${i.title}`);
    lines.push(`- Where: ${i.where}`);
    lines.push(`- Classification: ${i.classification}`);
    lines.push(`- Why: ${i.why}`);
    lines.push(`- How: ${i.how}`);
    lines.push(`- Screenshot: \`${i.screenshot || 'n/a'}\``);
    lines.push(`- Network: ${i.network || 'n/a'}`);
    lines.push('');
  }
  lines.push(`## Failed API (sample)`);
  lines.push('');
  const sample = failedApi.filter((f) => !/\/api\/auth\/(me|refresh)/.test(f.url)).slice(0, 30);
  if (!sample.length) lines.push(`_none (excluding login bootstrap)_`);
  for (const f of sample) {
    lines.push(`- ${f.status} ${f.method} ${f.url.replace(/https?:\/\/[^/]+/, '')}`);
  }
  lines.push('');

  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));
  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify(
      {
        role: ROLE,
        email: EMAIL,
        tenant: TENANT,
        fe: FE,
        api: API,
        started,
        pngCount,
        matrix,
        downloads,
        discovered,
        issues,
        findings,
        networkLog: networkLog.slice(-250),
        failedApi: failedApi.slice(0, 120),
        consoleErrors: consoleErrors.slice(0, 50),
        counts: { pass, fail, warn, noDl, none, miss, dlOk, dlFail, be, fe, both },
      },
      null,
      2,
    ),
  );

  const matrixPath = path.join(DOCS, 'E2E_EXPORT_CONFIRM_MATRIX.md');
  let existing = '';
  if (fs.existsSync(matrixPath)) existing = fs.readFileSync(matrixPath, 'utf8');
  if (!existing.trim()) {
    existing = `# E2E Export Confirmation Matrix\n\nDeep click-through of Export/PDF/Excel/CSV/download controls per role @ \`localhost:3001\` → \`localhost:4000\`.\n\n`;
  }

  const section = [];
  section.push(`## HR_ADMIN`);
  section.push('');
  section.push(`| Field | Value |`);
  section.push(`|-------|-------|`);
  section.push(`| Date | ${started} |`);
  section.push(`| User | \`${EMAIL}\` / \`${TENANT}\` |`);
  section.push(`| Evidence | \`docs/e2e-ui-screenshots/confirm/hr-exports/\` (${pngCount} PNGs) + \`FINDINGS.md\` |`);
  section.push(`| Downloads | ${downloads.length} events (ok:${dlOk} / fail:${dlFail}) |`);
  section.push(`| Matrix | PASS=${pass} FAIL=${fail} WARN=${warn} NO_DOWNLOAD=${noDl} NONE=${none} MISS=${miss} |`);
  section.push(`| Issues | BE=${be} FE=${fe} BOTH=${both} |`);
  section.push('');
  section.push(`| Surface | Page | Control | Status | Download | Screenshot |`);
  section.push(`|---------|------|---------|--------|----------|------------|`);
  for (const m of matrix) {
    const dl = m.downloads?.length
      ? m.downloads.map((d) => `${d.suggested} ok:${d.ok}`).join('; ')
      : '—';
    const ss = m.screenshotAfter || m.screenshotBefore || '—';
    section.push(
      `| ${m.surface} | ${m.page} | ${String(m.control).replace(/\|/g, '/')} | ${m.status} | ${dl.replace(/\|/g, '/')} | \`${ss}\` |`,
    );
  }
  section.push('');
  section.push(`### Notable`);
  section.push('');
  const notablePass = matrix.filter((m) => m.status === 'PASS');
  const notableFail = matrix.filter((m) => ['FAIL', 'NO_DOWNLOAD', 'WARN', 'MISS'].includes(m.status));
  const notableNone = matrix.filter((m) => m.status === 'NONE');
  if (notablePass.length) {
    section.push(`- **Working downloads (${notablePass.length}):** ${notablePass.map((m) => `${m.surface}/${m.page}:${m.control}`).join('; ')}`);
  } else {
    section.push(`- **Working downloads:** _none_`);
  }
  if (notableFail.length) {
    section.push(
      `- **Broken / no file (${notableFail.length}):** ${notableFail.map((m) => `${m.surface}/${m.page}:${m.control} [${m.status}]`).join('; ')}`,
    );
  }
  if (notableNone.length) {
    section.push(
      `- **No export control:** ${[...new Set(notableNone.map((m) => `${m.surface}/${m.page}`))].join(', ')}`,
    );
  }
  section.push('');

  const sectionText = section.join('\n');
  const re = /## HR_ADMIN[\s\S]*?(?=\n## [A-Z_]+\n|$)/;
  let next;
  if (re.test(existing)) next = existing.replace(re, sectionText);
  else next = existing.replace(/\s*$/, '\n\n') + sectionText;
  fs.writeFileSync(matrixPath, next);
  console.log(`\nWrote FINDINGS.md (${pngCount} PNGs), results.json, updated ${matrixPath}`);
  console.log(`COUNTS pass=${pass} fail=${fail} warn=${warn} noDl=${noDl} none=${none} miss=${miss} dlOk=${dlOk}/${downloads.length}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  wire(page);

  try {
    await login(page);

    // Order: Reports, Payroll, Employees, Attendance, Leave, Analytics
    await exploreReports(page);

    await probeAndClick(page, 'Payroll', '/payroll', 'list');
    await exploreTabs(page, 'Payroll', '/payroll', 'list');
    await explorePayrollDeep(page);

    await probeAndClick(page, 'Employees', '/employees', 'list');
    await exploreTabs(page, 'Employees', '/employees', 'list');

    await probeAndClick(page, 'Attendance', '/attendance', 'main');
    await exploreTabs(page, 'Attendance', '/attendance', 'main');

    await probeAndClick(page, 'Leave', '/leave', 'main');
    await exploreTabs(page, 'Leave', '/leave', 'main');

    await probeAndClick(page, 'Analytics', '/analytics', 'main');
    for (const range of ['7d', '30d', '90d']) {
      await gotoPath(page, '/analytics');
      const chip = page
        .locator('main button:visible, main [role="button"]:visible, main [role="tab"]:visible')
        .filter({ hasText: new RegExp(`^\\s*${range}\\s*$`, 'i') })
        .first();
      if (await chip.isVisible({ timeout: 400 }).catch(() => false)) {
        await safeClick(chip);
        await ready(page, 600);
        await shot(page, `analytics-range-${range}`);
        const labels = await listExportLabels(page);
        const pl = `range-${range}`;
        discovered.push({ surface: 'Analytics', page: pl, url: page.url(), controls: labels });
        if (!labels.length) {
          matrix.push({
            surface: 'Analytics',
            page: pl,
            control: '(none)',
            status: 'NONE',
            note: 'no export on analytics range',
            screenshotBefore: await shot(page, `analytics-${range}-no-export`),
            screenshotAfter: null,
            downloads: [],
            network: [],
            failedApi: [],
            url: page.url(),
          });
        } else {
          for (const lab of labels) await clickLabeledExport(page, 'Analytics', pl, lab);
        }
      }
    }
  } catch (e) {
    console.error('FATAL', e);
    addIssue({
      id: 'HR-EXPORT-FATAL',
      title: 'Export confirmation script crashed',
      where: page.url(),
      why: String(e).slice(0, 400),
      classification: 'FRONTEND',
      how: 'Re-run after fixing crash',
      screenshot: await shot(page, 'fatal').catch(() => 'n/a'),
      network: 'n/a',
    });
  } finally {
    writeFindings();
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
