/**
 * DEEP EXPORT CONFIRMATION — SUPER_ADMIN
 * Every visible Export / Download / PDF / Excel / CSV / Register / Pack / Print
 * UI :3001 → BE :4000. Concurrent Promise.all ×3 where control exists.
 * No commits. Screenshots → this folder; matrix → docs/E2E_EXPORT_CONFIRM_MATRIX.md
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

const EXPORT_RE =
  /export|download|pdf|excel|csv|xlsx|register|pack|print|invoice/i;
const EXPORT_BTN_RE =
  /^(export|download|export csv|export excel|export pdf|export pack|export register|print|download pdf|download csv)/i;

const REPORT_TYPES = [
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

const SURFACES = [
  { id: 'Employees', path: '/employees' },
  { id: 'Attendance', path: '/attendance' },
  { id: 'Leave', path: '/leave' },
  { id: 'Payroll', path: '/payroll' },
  { id: 'PayrollPayslips', path: '/payroll/my-payslips' },
  { id: 'Payout', path: '/payout-methods' },
  { id: 'PayoutApprovals', path: '/payout-methods/approvals' },
  { id: 'Reports', path: '/reports' },
  { id: 'Analytics', path: '/analytics' },
  { id: 'Assets', path: '/assets' },
  { id: 'Settings', path: '/settings' },
  { id: 'AuditLogs', path: '/settings/audit-logs' },
  { id: 'OpsLogs', path: '/ops/logs' },
  { id: 'Performance', path: '/performance' },
];

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.png') || f.startsWith('_dl-')) {
    try {
      fs.unlinkSync(path.join(OUT, f));
    } catch {
      /* ignore */
    }
  }
}

let shotIdx = 0;
const matrix = []; // export confirmation rows
const findings = [];
const issues = [];
const downloads = [];
const networkLog = [];
const stressBursts = [];
const stats = {
  surfaces: 0,
  controlsFound: 0,
  controlsClicked: 0,
  bursts: 0,
  screenshots: 0,
};

const state = { failedRequests: [], consoleErrors: [] };

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 56);
}

function guessFormat(name = '', url = '') {
  const s = `${name} ${url}`.toLowerCase();
  if (/\.xlsx|excel/.test(s)) return 'xlsx';
  if (/\.csv|csv/.test(s)) return 'csv';
  if (/\.pdf|pdf/.test(s)) return 'pdf';
  if (/\.json|audit-pack|pack/.test(s)) return 'json';
  if (/register/.test(s)) return 'csv';
  return 'unknown';
}

async function settle(page, ms = 400) {
  await page.waitForTimeout(ms);
}

async function shot(page, name) {
  shotIdx += 1;
  stats.screenshots += 1;
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
      state.failedRequests.push({ method, url, status, body, pageUrl: page.url() });
    }
    if (/\/api\/|export|download|\.csv|\.xlsx|\.pdf|reports|payroll|invoice/i.test(url)) {
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
    if (msg.type() === 'error') {
      state.consoleErrors.push({ text: msg.text().slice(0, 200), pageUrl: page.url() });
    }
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
        saved,
        pageUrl: page.url(),
        format: guessFormat(dl.suggestedFilename()),
        t: Date.now(),
      });
    } catch (e) {
      downloads.push({
        suggested: dl.suggestedFilename(),
        ok: false,
        failure: String(e),
        pageUrl: page.url(),
        format: guessFormat(dl.suggestedFilename()),
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
    await el.click({ force: true, timeout: 1800 });
    return true;
  } catch {
    return false;
  }
}

async function gotoPath(page, href) {
  await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await settle(page, 500);
}

/**
 * Collect visible export-like controls on current page.
 */
async function findExportControls(page) {
  const locs = page.locator(
    'main button:visible, main a:visible, main [role="menuitem"]:visible, [role="dialog"] button:visible',
  );
  const n = await locs.count();
  const out = [];
  const seen = new Set();
  for (let i = 0; i < n && out.length < 12; i++) {
    const el = locs.nth(i);
    const lab = await labelOf(el);
    if (!lab || !EXPORT_RE.test(lab)) continue;
    // skip pure UI chrome that isn't an export action
    if (/^export history|^schedule/i.test(lab) && !/csv|excel|pdf|download/i.test(lab)) {
      // still include "Export history" as discovery row but mark later if no download
    }
    const key = lab.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ el, lab });
  }
  // also role-based catch for Export CSV etc.
  const role = page.getByRole('button', { name: EXPORT_RE });
  const rc = await role.count();
  for (let i = 0; i < Math.min(rc, 8); i++) {
    const el = role.nth(i);
    const lab = await labelOf(el);
    if (!lab || !EXPORT_RE.test(lab)) continue;
    const key = lab.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ el, lab });
  }
  return out;
}

function pushMatrix(row) {
  matrix.push(row);
  const okStr = row.ok === true ? 'true' : row.ok === false ? 'false' : 'n/a';
  console.log(
    `  MATRIX ${row.surface} | ${row.control} | ${row.format} | status=${row.status} | ok=${okStr} | ${row.screenshot}`,
  );
}

/**
 * Click one export control; wait for download or export network; screenshot; matrix row.
 */
async function exerciseControl(page, surface, control, { stress = false } = {}) {
  stats.controlsClicked += 1;
  const d0 = downloads.length;
  const n0 = networkLog.length;
  const f0 = state.failedRequests.length;
  const clicked = await safeClick(control.el);
  if (!clicked) {
    const ss = await shot(page, `${surface}-failclick-${control.lab}`);
    pushMatrix({
      surface,
      control: control.lab,
      format: guessFormat(control.lab),
      status: 'CLICK_FAIL',
      ok: false,
      download: null,
      network: '',
      screenshot: ss,
      stress: !!stress,
      note: 'click failed',
    });
    return;
  }

  // menu expand → click first format item if present
  await settle(page, 350);
  const menuItems = page.locator('[role="menuitem"]:visible');
  const mc = await menuItems.count();
  if (mc > 0 && /^(export|download)$/i.test(control.lab.trim())) {
    const item = menuItems.first();
    const ilab = await labelOf(item);
    await safeClick(item);
    await settle(page, 900);
    control = { ...control, lab: `${control.lab}→${ilab || 'menuitem'}` };
  } else {
    await settle(page, 1800);
  }

  // allow async job poll
  await settle(page, 1200);

  const newDl = downloads.slice(d0);
  const newNet = networkLog
    .slice(n0)
    .filter((n) => /export|download|\.csv|\.xlsx|\.pdf|invoice|register|pack/i.test(n.url));
  const newFail = state.failedRequests.slice(f0);
  const ss = await shot(page, `${surface}-x-${control.lab}`);

  const best = newDl.find((d) => d.ok) || newDl[0] || null;
  const format = best
    ? best.format
    : guessFormat(control.lab, newNet.map((n) => n.url).join(' '));
  let status = 'NO_DOWNLOAD';
  let ok = null;
  if (best) {
    ok = best.ok;
    status = best.ok ? 'PASS' : 'FAIL';
  } else if (newNet.some((n) => n.status >= 200 && n.status < 300 && /export|download/i.test(n.url))) {
    status = 'NET_OK_NO_DL';
    ok = false;
  } else if (newFail.some((f) => /export|download/i.test(f.url))) {
    status = 'API_FAIL';
    ok = false;
  } else if (/history|schedule/i.test(control.lab)) {
    status = 'NAV_ONLY';
    ok = null;
  } else {
    status = 'NO_EVENT';
    ok = false;
  }

  pushMatrix({
    surface,
    control: control.lab,
    format,
    status,
    ok,
    download: best ? `${best.suggested} ok:${best.ok}` : null,
    network: newNet.map((n) => `${n.status} ${n.method} ${n.url}`).join(' · ').slice(0, 220),
    screenshot: ss,
    stress: !!stress,
    note: newFail.length
      ? newFail
          .slice(0, 2)
          .map((f) => `${f.status} ${f.url}`)
          .join('; ')
      : '',
  });

  if (ok === false && status !== 'NAV_ONLY') {
    addIssue({
      id: `SA-EXP-${slug(surface)}-${slug(control.lab)}`.slice(0, 48),
      title: `Export control failed: ${control.lab}`,
      where: `${surface} → ${control.lab}`,
      why:
        best
          ? `download ${best.suggested} ok:false fail:${best.failure || '-'}`
          : `no usable download; net=${newNet.map((n) => `${n.status} ${n.url}`).join(' · ') || 'none'}`,
      classification: newFail.some((f) => f.status >= 500)
        ? 'BACKEND'
        : newNet.some((n) => n.status === 202 && /download/.test(n.url))
          ? 'BOTH'
          : newFail.some((f) => f.status >= 400)
            ? 'BACKEND'
            : 'FRONTEND',
      how: 'Ensure export returns downloadable file and FE completes blob download',
      screenshot: ss,
      network:
        newNet.map((n) => `${n.status} ${n.method} ${n.url}`).join(' · ') ||
        (best ? `download ${best.suggested}` : 'n/a'),
    });
  }

  await hardDismiss(page);
  logF(surface, `export:${control.lab}`, status === 'PASS' || status === 'NAV_ONLY' ? 'PASS' : 'FAIL', {
    screenshot: ss,
    note: best ? `${best.suggested} ok:${best.ok}` : newNet[0]?.url || status,
  });
}

/**
 * Concurrent stress: Promise.all 3× clicks on same control.
 */
async function stressSameControl(page, surface, controlLab) {
  const btn = page.getByRole('button', { name: new RegExp(controlLab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
  if (!(await btn.isVisible({ timeout: 600 }).catch(() => false))) {
    // fallback: any export csv
    const alt = page.getByRole('button', { name: /export csv|export register|export pack|export|download/i }).first();
    if (!(await alt.isVisible({ timeout: 400 }).catch(() => false))) {
      logF(surface, `STRESS:${controlLab}`, 'WARN', { note: 'control not found for stress' });
      return;
    }
    return stressSameControlEl(page, surface, controlLab, alt);
  }
  return stressSameControlEl(page, surface, controlLab, btn);
}

async function stressSameControlEl(page, surface, label, el) {
  stats.bursts += 1;
  const d0 = downloads.length;
  const n0 = networkLog.length;
  const t0 = Date.now();
  await Promise.all([
    el.click({ force: true, timeout: 2000 }).catch(() => {}),
    el.click({ force: true, timeout: 2000 }).catch(() => {}),
    el.click({ force: true, timeout: 2000 }).catch(() => {}),
  ]);
  await settle(page, 2800);
  await settle(page, 1200);
  const newDl = downloads.slice(d0);
  const newNet = networkLog.slice(n0).filter((n) => /export|download/i.test(n.url));
  const ss = await shot(page, `${surface}-stress-${label}`);
  const entry = {
    surface,
    label,
    clicks: 3,
    downloads: newDl,
    network: newNet,
    screenshot: ss,
    elapsedMs: Date.now() - t0,
    okCount: newDl.filter((d) => d.ok).length,
    failCount: newDl.filter((d) => !d.ok).length,
  };
  stressBursts.push(entry);
  pushMatrix({
    surface: `${surface}[STRESS×3]`,
    control: label,
    format: newDl[0]?.format || guessFormat(label),
    status: newDl.some((d) => d.ok) ? 'PASS' : newDl.length ? 'FAIL' : 'NO_EVENT',
    ok: newDl.length ? newDl.every((d) => d.ok) || newDl.some((d) => d.ok) : false,
    download: newDl.map((d) => `${d.suggested} ok:${d.ok}`).join('; ') || null,
    network: newNet.map((n) => `${n.status} ${n.method} ${n.url}`).join(' · ').slice(0, 220),
    screenshot: ss,
    stress: true,
    note: `ok=${entry.okCount} fail=${entry.failCount}`,
  });
  logF(surface, `STRESS×3:${label}`, entry.okCount > 0 ? 'PASS' : 'FAIL', {
    screenshot: ss,
    note: `dl=${newDl.length} ok=${entry.okCount}`,
  });
  await hardDismiss(page);
}

async function login(page) {
  await gotoPath(page, '/login');
  await shot(page, 'login-form');
  const email = page.locator('input[type="email"], input[name="email"]').first();
  const pass = page.locator('input[type="password"], input[name="password"]').first();
  await email.fill(EMAIL);
  await pass.fill(PASSWORD);
  const tenant = page.locator('input[name="tenant"], input[name="tenantKey"], input[placeholder*="tenant" i]').first();
  if (await tenant.isVisible({ timeout: 300 }).catch(() => false)) {
    await tenant.fill(TENANT);
  }
  await shot(page, 'login-filled');
  await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first().click();
  await page.waitForURL(/dashboard|home|payroll|employees|analytics/, { timeout: 20000 }).catch(() => {});
  await settle(page, 700);
  await shot(page, 'login-success');
  logF('Auth', 'login', 'PASS', { url: page.url() });
}

async function scanSurface(page, surfaceId, href) {
  stats.surfaces += 1;
  console.log(`→ ${surfaceId} ${href}`);
  await gotoPath(page, href);
  const land = await shot(page, `${surfaceId}-land`);
  const mainTxt = await page.locator('main').innerText().catch(() => '');
  if (/404|not found|this page could not/i.test(mainTxt)) {
    logF(surfaceId, 'open', 'FAIL', { screenshot: land, note: '404' });
    pushMatrix({
      surface: surfaceId,
      control: '(page)',
      format: 'n/a',
      status: 'PAGE_404',
      ok: false,
      download: null,
      network: '',
      screenshot: land,
      stress: false,
      note: 'route 404',
    });
    return;
  }
  logF(surfaceId, 'open', 'PASS', { screenshot: land });

  let controls = await findExportControls(page);
  stats.controlsFound += controls.length;

  // open Export dropdown if present to reveal format items
  const exportBtn = page.getByRole('button', { name: /^export$/i }).first();
  if (await exportBtn.isVisible({ timeout: 300 }).catch(() => false)) {
    await safeClick(exportBtn);
    await settle(page, 300);
    await shot(page, `${surfaceId}-export-menu`);
    // collect menu items then dismiss and re-exercise one-by-one
    const items = page.locator('[role="menuitem"]:visible');
    const ic = await items.count();
    const menuLabs = [];
    for (let i = 0; i < Math.min(ic, 6); i++) {
      menuLabs.push(await labelOf(items.nth(i)));
    }
    await hardDismiss(page);
    for (const lab of menuLabs.filter(Boolean)) {
      await safeClick(exportBtn);
      await settle(page, 250);
      const item = page.getByRole('menuitem', { name: new RegExp(lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
      if (await item.isVisible({ timeout: 400 }).catch(() => false)) {
        stats.controlsFound += 1;
        await exerciseControl(page, surfaceId, { el: item, lab: `Export→${lab}` });
      } else {
        await hardDismiss(page);
      }
    }
    // refresh controls list after menu pass
    controls = await findExportControls(page);
  }

  // exercise each distinct control (skip ones already exercised via menu)
  const exercised = new Set(matrix.filter((m) => m.surface === surfaceId).map((m) => m.control.toLowerCase()));
  for (const c of controls) {
    if (exercised.has(c.lab.toLowerCase())) continue;
    if (/^export$/i.test(c.lab.trim()) && matrix.some((m) => m.surface === surfaceId && /^Export→/.test(m.control))) {
      continue; // already expanded
    }
    await exerciseControl(page, surfaceId, c);
    exercised.add(c.lab.toLowerCase());
  }

  if (!controls.length && !matrix.some((m) => m.surface === surfaceId && m.control !== '(page)')) {
    pushMatrix({
      surface: surfaceId,
      control: '(none found)',
      format: 'n/a',
      status: 'ABSENT',
      ok: null,
      download: null,
      network: '',
      screenshot: land,
      stress: false,
      note: 'no Export/Download/PDF/Excel/CSV/Register/Pack/Print visible',
    });
  }
}

async function explorePayrollDeep(page) {
  await gotoPath(page, '/payroll');
  await settle(page, 1000);
  const actions = page.getByRole('button', { name: /actions for/i });
  if ((await actions.count()) > 0) {
    await safeClick(actions.first());
    await settle(page, 350);
    await shot(page, 'payroll-actions-menu');
    const view = page.getByRole('menuitem', { name: /view/i }).first();
    if (await view.isVisible({ timeout: 500 }).catch(() => false)) {
      await safeClick(view);
      await settle(page, 1000);
      await shot(page, 'payroll-run-detail');
      const controls = await findExportControls(page);
      stats.controlsFound += controls.length;
      for (const c of controls) {
        await exerciseControl(page, 'PayrollRun', c);
      }
      // stress Register + Pack if present
      const reg = page.getByRole('button', { name: /export register|export csv/i }).first();
      if (await reg.isVisible({ timeout: 400 }).catch(() => false)) {
        await stressSameControlEl(page, 'PayrollRun', 'Export Register', reg);
      }
      const pack = page.getByRole('button', { name: /export pack|audit pack|pack/i }).first();
      if (await pack.isVisible({ timeout: 400 }).catch(() => false)) {
        await stressSameControlEl(page, 'PayrollRun', 'Export pack', pack);
      }
      // payslip download if any row
      const dl = page.getByRole('button', { name: /download/i }).first();
      if (await dl.isVisible({ timeout: 400 }).catch(() => false)) {
        await exerciseControl(page, 'PayrollRun', { el: dl, lab: 'Download' });
      }
    } else {
      await hardDismiss(page);
    }
  }
}

async function exploreReportsDeep(page) {
  for (const r of REPORT_TYPES) {
    const leaf = r.split('/').pop();
    await gotoPath(page, '/reports');
    await settle(page, 500);
    const clicked = await (async () => {
      const el = page.locator('body button:visible, body a:visible').filter({ hasText: new RegExp(leaf.replace(/-/g, '[- ]?'), 'i') }).first();
      if (await el.isVisible({ timeout: 350 }).catch(() => false)) {
        return safeClick(el);
      }
      return false;
    })();
    if (!clicked) {
      await gotoPath(page, `/reports?report=${r}`);
      const mainTxt = await page.locator('main').innerText().catch(() => '');
      if (/404|not found/i.test(mainTxt)) await gotoPath(page, `/reports/${r}`);
    }
    await settle(page, 600);
    await shot(page, `reports-${slug(r)}`);
    const controls = await findExportControls(page);
    stats.controlsFound += controls.length;
    const surface = `Reports/${r}`;
    if (!controls.length) {
      pushMatrix({
        surface,
        control: '(none found)',
        format: 'n/a',
        status: 'ABSENT',
        ok: null,
        download: null,
        network: '',
        screenshot: `${String(shotIdx).padStart(3, '0')}-reports-${slug(r)}.png`,
        stress: false,
        note: 'no export control on this report type',
      });
      continue;
    }
    for (const c of controls) {
      await exerciseControl(page, surface, c);
    }
  }
  // concurrent Export CSV ×3 on headcount
  await gotoPath(page, '/reports');
  await settle(page, 600);
  const hc = page.locator('body button:visible, body a:visible').filter({ hasText: /headcount/i }).first();
  if (await hc.isVisible({ timeout: 400 }).catch(() => false)) await safeClick(hc);
  await settle(page, 500);
  const csv = page.getByRole('button', { name: /export csv/i }).first();
  if (await csv.isVisible({ timeout: 800 }).catch(() => false)) {
    await stressSameControlEl(page, 'Reports/headcount', 'Export CSV', csv);
  }
}

async function exploreEmployeesExport(page) {
  await gotoPath(page, '/employees');
  await settle(page, 700);
  // Columns / Export common pattern
  const exportBtn = page.getByRole('button', { name: /export/i }).first();
  if (await exportBtn.isVisible({ timeout: 800 }).catch(() => false)) {
    await exerciseControl(page, 'Employees', { el: exportBtn, lab: await labelOf(exportBtn) });
    // reopen for stress
    const again = page.getByRole('button', { name: /export/i }).first();
    if (await again.isVisible({ timeout: 500 }).catch(() => false)) {
      // if dropdown, pick CSV then stress CSV path via API-style: click Export 3×
      await stressSameControlEl(page, 'Employees', 'Export', again);
    }
  }
}

async function explorePayslips(page) {
  await gotoPath(page, '/payroll/my-payslips');
  await settle(page, 800);
  await shot(page, 'payslips-land');
  // open first payslip card if any
  const card = page.locator('main a:visible, main button:visible').filter({ hasText: /payslip|202[0-9]|download/i }).first();
  if (await card.isVisible({ timeout: 600 }).catch(() => false)) {
    await safeClick(card);
    await settle(page, 900);
    await shot(page, 'payslip-detail');
  }
  const controls = await findExportControls(page);
  for (const c of controls) await exerciseControl(page, 'Payslips', c);
  const dl = page.getByRole('button', { name: /download/i }).first();
  if (await dl.isVisible({ timeout: 500 }).catch(() => false)) {
    await exerciseControl(page, 'Payslips', { el: dl, lab: 'Download' });
  }
}

function writeOutputs() {
  const okN = matrix.filter((m) => m.ok === true).length;
  const failN = matrix.filter((m) => m.ok === false).length;
  const absentN = matrix.filter((m) => m.status === 'ABSENT').length;
  const dlOk = downloads.filter((d) => d.ok).length;
  const dlFail = downloads.filter((d) => !d.ok).length;

  const findingsMd = [];
  findingsMd.push('# SA-EXPORTS-CONFIRM — SUPER_ADMIN Deep Export Confirmation');
  findingsMd.push('');
  findingsMd.push('| Field | Value |');
  findingsMd.push('|-------|-------|');
  findingsMd.push(`| Date | ${new Date().toISOString()} |`);
  findingsMd.push(`| Role | \`${ROLE}\` — \`${EMAIL}\` / tenant \`${TENANT}\` |`);
  findingsMd.push(`| UI | \`${UI}\` |`);
  findingsMd.push(`| BE | \`${API}\` |`);
  findingsMd.push(
    '| Scope | Reports (all types), Payroll (runs/register/pack/payslips), Employees, Attendance, Leave, Analytics, Assets, Audit/settings, Payout/invoices |',
  );
  findingsMd.push('| Stress | `Promise.all` ×3 same control where present |');
  findingsMd.push(
    `| Screenshots | \`docs/e2e-ui-screenshots/confirm/sa-exports/\` — **${stats.screenshots}** PNGs |`,
  );
  findingsMd.push('');
  findingsMd.push('## Counts');
  findingsMd.push('');
  findingsMd.push('| Metric | Value |');
  findingsMd.push('|--------|------:|');
  findingsMd.push(`| Surfaces scanned | ${stats.surfaces} |`);
  findingsMd.push(`| Controls found | ${stats.controlsFound} |`);
  findingsMd.push(`| Controls clicked | ${stats.controlsClicked} |`);
  findingsMd.push(`| Concurrent bursts | ${stats.bursts} |`);
  findingsMd.push(`| Matrix rows | ${matrix.length} |`);
  findingsMd.push(`| Matrix ok:true | ${okN} |`);
  findingsMd.push(`| Matrix ok:false | ${failN} |`);
  findingsMd.push(`| Controls absent | ${absentN} |`);
  findingsMd.push(`| Download events | ${downloads.length} (ok:${dlOk} / fail:${dlFail}) |`);
  findingsMd.push(`| Issues | ${issues.length} |`);
  findingsMd.push(`| Screenshots | ${stats.screenshots} |`);
  findingsMd.push('');
  findingsMd.push('## Export confirmation matrix');
  findingsMd.push('');
  findingsMd.push('| Surface | Control | Format | Status | ok | Download | Screenshot | Stress |');
  findingsMd.push('|---------|---------|--------|--------|----|----------|------------|--------|');
  for (const m of matrix) {
    findingsMd.push(
      `| ${m.surface} | ${m.control} | ${m.format} | ${m.status} | ${m.ok === null || m.ok === undefined ? 'n/a' : m.ok} | ${m.download || '—'} | \`${m.screenshot}\` | ${m.stress ? '×3' : ''} |`,
    );
  }
  findingsMd.push('');
  findingsMd.push('## Concurrent stress bursts');
  findingsMd.push('');
  if (!stressBursts.length) findingsMd.push('_None_');
  for (const s of stressBursts) {
    findingsMd.push(`### ${s.surface} / ${s.label}`);
    findingsMd.push(`- Clicks: ${s.clicks}`);
    findingsMd.push(
      `- Downloads: ${s.downloads.length ? s.downloads.map((d) => `\`${d.suggested}\` ok:${d.ok}`).join(', ') : '_none_'}`,
    );
    findingsMd.push(
      `- Network: ${s.network.length ? s.network.map((n) => `\`${n.status} ${n.method} ${n.url}\``).join(' · ') : '_n/a_'}`,
    );
    findingsMd.push(`- Screenshot: \`${s.screenshot}\` · ${s.elapsedMs}ms`);
    findingsMd.push('');
  }
  findingsMd.push('## Downloads');
  findingsMd.push('');
  findingsMd.push(
    downloads.length
      ? downloads.map((d) => `- \`${d.suggested}\` format:${d.format} ok:${d.ok} fail:${d.failure || '-'} @ ${d.pageUrl}`).join('\n')
      : '_None_',
  );
  findingsMd.push('');
  findingsMd.push('## Issues');
  findingsMd.push('');
  if (!issues.length) findingsMd.push('_None_');
  for (const i of issues) {
    findingsMd.push(`### ${i.id}: ${i.title}`);
    findingsMd.push(`- Where: ${i.where}`);
    findingsMd.push(`- Why: ${i.why}`);
    findingsMd.push(`- Classification: ${i.classification}`);
    findingsMd.push(`- How: ${i.how}`);
    findingsMd.push(`- Screenshot: \`${i.screenshot}\``);
    findingsMd.push(`- Network: ${i.network}`);
    findingsMd.push('');
  }
  findingsMd.push('## Failed API (sample)');
  findingsMd.push('');
  const fails = state.failedRequests.filter((f) => !/\/auth\/(me|refresh)/.test(f.url)).slice(0, 20);
  findingsMd.push(
    fails.length
      ? fails.map((f) => `- ${f.status} ${f.method} ${f.url}`).join('\n')
      : '_None (excluding login bootstrap me/refresh)_',
  );
  findingsMd.push('');
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), findingsMd.join('\n'));
  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify(
      { stats, matrix, downloads, stressBursts, issues, findings, failedRequests: state.failedRequests },
      null,
      2,
    ),
  );

  // Canonical matrix doc
  const matrixDoc = [];
  matrixDoc.push('# E2E Export Confirm Matrix — SUPER_ADMIN');
  matrixDoc.push('');
  matrixDoc.push(`> Generated: ${new Date().toISOString()}`);
  matrixDoc.push(`> Role: \`${ROLE}\` (\`${EMAIL}\`) · UI \`${UI}\` · BE \`${API}\``);
  matrixDoc.push(`> Screenshots: \`docs/e2e-ui-screenshots/confirm/sa-exports/\` (**${stats.screenshots}** PNGs)`);
  matrixDoc.push('');
  matrixDoc.push('## SA-EXPORTS-CONFIRM');
  matrixDoc.push('');
  matrixDoc.push(
    `Surfaces=${stats.surfaces} · controlsFound=${stats.controlsFound} · clicked=${stats.controlsClicked} · bursts=${stats.bursts} · downloads ok:${dlOk}/fail:${dlFail} · matrix ok:true=${okN} ok:false=${failN} absent=${absentN}`,
  );
  matrixDoc.push('');
  matrixDoc.push('| Surface | Control | Format | Status | ok | Download | Network (abbrev) | Screenshot |');
  matrixDoc.push('|---------|---------|--------|--------|----|----------|------------------|------------|');
  for (const m of matrix) {
    matrixDoc.push(
      `| ${m.surface} | ${m.control} | ${m.format} | ${m.status} | ${m.ok === null || m.ok === undefined ? 'n/a' : m.ok} | ${(m.download || '—').replace(/\|/g, '/')} | ${(m.network || '—').replace(/\|/g, '/')} | \`${m.screenshot}\` |`,
    );
  }
  matrixDoc.push('');
  matrixDoc.push('## Concurrent stress (Promise.all ×3)');
  matrixDoc.push('');
  matrixDoc.push('| Surface | Control | ok downloads | fail | Screenshot |');
  matrixDoc.push('|---------|---------|-------------:|-----:|------------|');
  for (const s of stressBursts) {
    matrixDoc.push(
      `| ${s.surface} | ${s.label} | ${s.okCount} | ${s.failCount} | \`${s.screenshot}\` |`,
    );
  }
  if (!stressBursts.length) matrixDoc.push('| — | — | 0 | 0 | — |');
  matrixDoc.push('');
  matrixDoc.push('## Issues');
  matrixDoc.push('');
  if (!issues.length) matrixDoc.push('_None_');
  for (const i of issues) {
    matrixDoc.push(`- **${i.id}** [${i.classification}] ${i.title} @ ${i.where} — ${i.why}`);
  }
  matrixDoc.push('');
  matrixDoc.push('## Verdict');
  matrixDoc.push('');
  const beIssues = issues.filter((i) => i.classification === 'BACKEND' || i.classification === 'BOTH');
  const feIssues = issues.filter((i) => i.classification === 'FRONTEND');
  matrixDoc.push(
    `- Download success rate: **${dlOk}/${downloads.length || 0}** ok:true`,
  );
  matrixDoc.push(`- BACKEND/BOTH issues: **${beIssues.length}** · FRONTEND issues: **${feIssues.length}**`);
  matrixDoc.push(
    `- Absent export controls (surfaces with no Export/Download visible): **${absentN}**`,
  );
  matrixDoc.push('');
  matrixDoc.push('Full detail: `docs/e2e-ui-screenshots/confirm/sa-exports/FINDINGS.md`');
  matrixDoc.push('');
  fs.writeFileSync(path.join(DOCS, 'E2E_EXPORT_CONFIRM_MATRIX.md'), matrixDoc.join('\n'));

  // Append short section to stress contracts if they exist
  for (const fname of ['E2E_STRESS_BACKEND_CONTRACT.md', 'E2E_STRESS_FRONTEND_CONTRACT.md']) {
    const p = path.join(DOCS, fname);
    if (!fs.existsSync(p)) continue;
    const prev = fs.readFileSync(p, 'utf8');
    if (prev.includes('## SA-EXPORTS-CONFIRM')) continue;
    const isBe = fname.includes('BACKEND');
    const section = [
      '',
      '## SA-EXPORTS-CONFIRM',
      '',
      `> Deep export confirmation SUPER_ADMIN · ${new Date().toISOString().slice(0, 10)} · UI :3001 / BE :4000`,
      '',
      `**Matrix:** \`docs/E2E_EXPORT_CONFIRM_MATRIX.md\` · screenshots \`docs/e2e-ui-screenshots/confirm/sa-exports/\` (${stats.screenshots} PNGs)`,
      '',
      `**Downloads:** ${downloads.length} (ok:${dlOk} / false:${dlFail}) · bursts=${stats.bursts} · matrix ok:true=${okN} ok:false=${failN} absent=${absentN}`,
      '',
      isBe
        ? beIssues.length
          ? beIssues.map((i) => `- **${i.id}** ${i.title}: ${i.why}`).join('\n')
          : '_No backend issues in export confirm pass._'
        : feIssues.length
          ? feIssues.map((i) => `- **${i.id}** ${i.title}: ${i.why}`).join('\n')
          : '_No frontend-only export issues (or none classified FE)._',
      '',
    ].join('\n');
    fs.appendFileSync(p, section);
  }

  console.log('\n=== DONE ===');
  console.log(JSON.stringify({ stats, downloads: downloads.length, ok: dlOk, fail: dlFail, issues: issues.length, matrix: matrix.length }, null, 2));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  wire(page);

  try {
    await login(page);

    // Core surfaces (quick land + control scan)
    for (const s of SURFACES) {
      if (s.id === 'Reports') continue; // deep below
      if (s.id === 'Payroll') continue; // deep below
      if (s.id === 'PayrollPayslips') continue;
      if (s.id === 'Employees') continue;
      await scanSurface(page, s.id, s.path);
    }

    await exploreEmployeesExport(page);
    await explorePayrollDeep(page);
    await explorePayslips(page);
    await exploreReportsDeep(page);

    // Analytics / Assets / Audit already scanned; stress analytics if export appears
    await gotoPath(page, '/analytics');
    const anExport = page.getByRole('button', { name: /export|download/i }).first();
    if (await anExport.isVisible({ timeout: 500 }).catch(() => false)) {
      await stressSameControlEl(page, 'Analytics', await labelOf(anExport), anExport);
    }

    writeOutputs();
  } catch (e) {
    console.error('FATAL', e);
    await shot(page, 'fatal-error').catch(() => {});
    writeOutputs();
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main();
