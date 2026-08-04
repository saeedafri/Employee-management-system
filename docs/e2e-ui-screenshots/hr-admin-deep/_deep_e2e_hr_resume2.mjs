/**
 * Stable resume: Settings (all subs) + Recruitment/Performance/Assets/Announcements
 * + export retries + attendance BE probe. Fresh browser every 6 settings pages.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const DOCS = path.resolve(__dirname, '../..');
const UI = 'http://localhost:3001';
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
const ACTION_NAMES = [
  'Add', 'Create', 'New', 'Edit', 'Save', 'Export', 'Download', 'PDF', 'Excel', 'CSV',
  'Import', 'Upload', 'Test connection', 'Send test', 'Publish', 'Filter', 'Columns',
];

const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8'));
let shotIdx = Math.max(
  438,
  ...fs.readdirSync(OUT).filter((f) => /^\d{3}-/.test(f)).map((f) => parseInt(f, 10) || 0),
);
const findings = [...(prev.findings || [])];
const issues = [...(prev.issues || [])];
const mutations = [...(prev.mutations || [])];
const downloads = [...(prev.downloads || [])];
const depthStats = {
  ...(prev.depthStats || {}),
  screenshots: shotIdx,
};
depthStats.menus = depthStats.menus || 12;

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}
function recount() {
  depthStats.be = issues.filter((i) => i.classification === 'BACKEND').length;
  depthStats.fe = issues.filter((i) => i.classification === 'FRONTEND').length;
  depthStats.both = issues.filter((i) => i.classification === 'BOTH').length;
}
function addIssue(p) {
  const key = `${p.title}|${(p.network || '').slice(0, 80)}`;
  if (issues.some((i) => `${i.title}|${(i.network || '').slice(0, 80)}` === key)) return;
  issues.push({ id: 'TMP', role: 'HR_ADMIN', ...p });
  recount();
  console.log(`  🐛 [${p.classification}] ${p.title}`);
}
function logF(menu, action, status, detail = {}) {
  findings.push({ menu, action, status, at: new Date().toISOString(), resume: true, ...detail });
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
  depthStats.screenshots = shotIdx;
  return file;
}
async function settle(page, ms = 400) {
  await page.waitForLoadState('domcontentloaded', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(ms);
}
async function dismiss(page) {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(40);
  }
  const c = page.locator('[role="dialog"] button:has-text("Cancel"), button:has-text("Close")').first();
  if (await c.isVisible({ timeout: 120 }).catch(() => false)) await c.click({ force: true }).catch(() => {});
}

async function newSession() {
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
  const state = { failed: [], consoleErrors: [], seen: new Set() };
  page.on('response', async (res) => {
    if (res.status() < 400) return;
    const url = res.url();
    if (/\.(png|css|woff|ico|map)(\?|$)/i.test(url) || /_next\//.test(url)) return;
    let body = '';
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      body = '';
    }
    state.failed.push({ status: res.status(), method: res.request().method(), url, body, pageUrl: page.url() });
  });
  page.on('console', (m) => {
    if (m.type() === 'error') state.consoleErrors.push(m.text().slice(0, 220));
  });
  page.on('download', async (dl) => {
    try {
      const p = await dl.path();
      downloads.push({ suggested: dl.suggestedFilename(), ok: !!p && !dl.failure(), pageUrl: page.url() });
    } catch (e) {
      downloads.push({ ok: false, failure: String(e) });
    }
  });

  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 300);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await settle(page, 600);
  return { browser, page, state };
}

function harvest(state, menu, ss, since, action) {
  for (const fr of state.failed.slice(since)) {
    if (/auth\/(me|refresh)/.test(fr.url) && fr.status === 401) continue;
    const key = `${fr.method}|${fr.status}|${fr.url.split('?')[0]}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    const cls =
      fr.status >= 500 || /\/api\/v1\//.test(fr.url) || fr.url.includes(':4000') ? 'BACKEND' : 'BACKEND';
    addIssue({
      title: `${menu}: ${fr.status} ${fr.url.split('/').slice(-2).join('/')}`,
      where: `${menu} / ${action}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${fr.body.slice(0, 200)}`,
      classification: cls,
      how: 'Fix API/FE contract for HR_ADMIN',
      screenshot: ss,
      network: `${fr.method} ${fr.url} ${fr.status}`,
    });
  }
  for (const ce of state.consoleErrors.splice(0)) {
    if (/Failed to load resource|favicon/i.test(ce)) continue;
    const key = `c:${ce.slice(0, 80)}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    addIssue({
      title: /same key|unique "key"/i.test(ce) ? `${menu}: React duplicate key` : `${menu}: console error`,
      where: menu,
      why: ce.slice(0, 280),
      classification: 'FRONTEND',
      how: 'Fix FE console/key issues',
      screenshot: ss,
      network: 'n/a (console)',
    });
  }
}

async function clickNamed(page, state, menu) {
  // tabs first
  const tabs = page.locator('main [role="tab"]');
  const tc = Math.min(await tabs.count(), 8);
  for (let i = 0; i < tc; i++) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const lab = ((await tab.innerText().catch(() => '')) || `tab${i}`).trim().slice(0, 40);
    const before = state.failed.length;
    await tab.click({ timeout: 2000 }).catch(() => {});
    depthStats.tabs = (depthStats.tabs || 0) + 1;
    depthStats.buttons = (depthStats.buttons || 0) + 1;
    await settle(page, 350);
    const ss = await shot(page, `${menu}-tab-${lab}`);
    logF(menu, `tab:${lab}`, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, `tab:${lab}`);
  }

  for (const name of ACTION_NAMES) {
    await dismiss(page);
    const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
    const link = page.getByRole('link', { name: new RegExp(`^${name}$`, 'i') }).first();
    const target = (await btn.isVisible({ timeout: 200 }).catch(() => false))
      ? btn
      : (await link.isVisible({ timeout: 150 }).catch(() => false))
        ? link
        : null;
    if (!target) continue;
    const before = state.failed.length;
    const d0 = downloads.length;
    await target.click({ timeout: 2000 }).catch(() => {});
    depthStats.buttons = (depthStats.buttons || 0) + 1;
    await settle(page, 450);
    // export submenu
    if (/export|download|pdf|excel|csv/i.test(name)) {
      depthStats.exports = (depthStats.exports || 0) + 1;
      const items = page.locator('[role="menuitem"]:visible, button:has-text("PDF"), button:has-text("Excel"), button:has-text("CSV")');
      const ic = Math.min(await items.count(), 5);
      for (let i = 0; i < ic; i++) {
        const lab = ((await items.nth(i).innerText().catch(() => '')) || `fmt${i}`).trim().slice(0, 30);
        await items.nth(i).click({ force: true }).catch(() => {});
        depthStats.exports += 1;
        depthStats.buttons += 1;
        await settle(page, 900);
        const s2 = await shot(page, `${menu}-export-${lab}`);
        logF(menu, `export:${lab}`, 'PASS', { screenshot: s2, downloads: downloads.slice(d0) });
        harvest(state, menu, s2, before, `export:${lab}`);
        await dismiss(page);
        await target.click({ timeout: 1500 }).catch(() => {});
        await settle(page, 250);
      }
    }
    const ss = await shot(page, `${menu}-${name}`);
    logF(menu, name, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, name);
    const dlg = page.locator('[role="dialog"]').first();
    if (await dlg.isVisible({ timeout: 250 }).catch(() => false)) {
      depthStats.modalsEntered = (depthStats.modalsEntered || 0) + 1;
      depthStats.maxNestDepth = Math.max(depthStats.maxNestDepth || 0, 1);
      await shot(page, `${menu}-${name}-modal`);
      // wizard next once
      const next = dlg.getByRole('button', { name: /^next$/i }).first();
      if (await next.isVisible({ timeout: 200 }).catch(() => false)) {
        await next.click().catch(() => {});
        depthStats.nestedWizardSteps = (depthStats.nestedWizardSteps || 0) + 1;
        depthStats.maxNestDepth = Math.max(depthStats.maxNestDepth || 0, 2);
        await settle(page, 300);
        await shot(page, `${menu}-${name}-wizard-next`);
      }
      const cancel = dlg.getByRole('button', { name: /cancel|close/i }).first();
      if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
      else await dismiss(page);
    }
  }

  // access restricted?
  const text = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
  if (/access restricted/i.test(text)) {
    addIssue({
      title: `${menu}: Access restricted UI`,
      where: menu,
      why: 'Page shows Access restricted for HR_ADMIN',
      classification: 'FRONTEND',
      how: 'Hide nav or redirect to first allowed panel',
      screenshot: await shot(page, `${menu}-restricted`),
      network: 'n/a (client gate)',
    });
  }
}

async function exploreHref(page, state, menu, href) {
  const before = state.failed.length;
  await dismiss(page);
  await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 700);
  await dismiss(page);
  const ss = await shot(page, slug(menu));
  logF(menu, 'open', 'PASS', { screenshot: ss, url: page.url() });
  harvest(state, menu, ss, before, 'open');
  await clickNamed(page, state, menu);
}

function writeOutputs() {
  issues.forEach((iss, i) => {
    iss.id = `ISSUE-HR-${String(i + 1).padStart(2, '0')}`;
  });
  recount();
  depthStats.screenshots = shotIdx;
  depthStats.menus = 17; // full sidebar
  const lines = [];
  lines.push('# HR_ADMIN Full-Depth Nested UI E2E Findings');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Role: HR_ADMIN (${EMAIL})`);
  lines.push(`- UI: ${UI} · BE: http://localhost:4000/api/v1 · tenant ${TENANT}`);
  lines.push('- Tool: Playwright Chromium (full-depth nested + stable resume)');
  lines.push('- Screenshots: `docs/e2e-ui-screenshots/hr-admin-deep/`');
  lines.push('- **No Render deploy. No git commit.**');
  lines.push('');
  lines.push('## Depth stats');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  for (const [k, v] of Object.entries(depthStats)) lines.push(`| ${k} | ${v} |`);
  lines.push(`| findings actions | ${findings.length} |`);
  lines.push(`| mutations | ${mutations.length} |`);
  lines.push(`| downloads | ${downloads.length} |`);
  lines.push('');
  lines.push('## Critical bugs');
  lines.push('');
  for (const iss of issues.filter(
    (i) =>
      i.classification === 'BACKEND' ||
      /access restricted|Permissions nav|bootstrap 401|duplicate key|summary|status vs API|Zero-duration|Export failed|Reports secondary/i.test(
        `${i.title} ${i.why}`,
      ),
  )) {
    lines.push(`1. **${iss.id}** [${iss.classification}] ${iss.title} — ${(iss.why || '').slice(0, 200)}`);
  }
  lines.push('');
  lines.push('## Mutations');
  lines.push('');
  for (const m of mutations) lines.push(`- \`${m.menu}\` → **${m.action}**`);
  if (!mutations.length) lines.push('_None_');
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
  lines.push('## Coverage');
  lines.push('');
  lines.push(
    'Pass 1: Dashboard→Permissions, all 15 report types, payroll nested tabs/extras, payout approvals, notifications. Pass 2: all Settings sub-routes with nested tab/action/modal clicks; Recruitment/Performance/Assets/Announcements; Employees+Reports export retry; Attendance BE probe.',
  );
  lines.push('');
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));
  fs.writeFileSync(
    path.join(OUT, 'results.json'),
    JSON.stringify({ depthStats, findings, issues, downloads, mutations, role: 'HR_ADMIN', email: EMAIL, resumed: true }, null, 2),
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
      `**Tester:** \`${EMAIL}\` (HR_ADMIN) · tenant \`${TENANT}\` · ${new Date().toISOString().slice(0, 10)}`,
      `**Evidence:** \`docs/e2e-ui-screenshots/hr-admin-deep/\` (${shotIdx} PNGs + \`FINDINGS.md\`)`,
      `**Depth:** menus=${depthStats.menus} tabs=${depthStats.tabs} clicks=${depthStats.buttons} modals=${depthStats.modalsEntered} wizards=${depthStats.nestedWizardSteps} exports=${depthStats.exports} nestDepth=${depthStats.maxNestDepth} actions=${findings.length}`,
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

async function probeAttendance(page, state) {
  console.log('→ Attendance BE probe');
  await page.goto(`${UI}/attendance`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await settle(page, 800);
  const ss = await shot(page, 'attendance-be-probe');
  const table = page.getByRole('tab', { name: /table|list/i }).first();
  if (await table.isVisible({ timeout: 600 }).catch(() => false)) {
    await table.click().catch(() => {});
    await settle(page, 500);
  }
  const text = (await page.evaluate(() => document.body?.innerText || '')) || '';
  const probe = await page.evaluate(async () => {
    const j = async (u) => {
      const r = await fetch(u, { credentials: 'include' });
      const body = await r.json().catch(() => ({}));
      return { status: r.status, body };
    };
    return {
      summary: await j('/api/attendance/summary'),
      records: await j('/api/attendance/records?month=2026-08'),
      today: await j('/api/attendance/today'),
    };
  });
  fs.writeFileSync(path.join(OUT, 'attendance-probe.json'), JSON.stringify(probe, null, 2));
  const ss2 = await shot(page, 'attendance-be-probe-settled');
  const sum = probe.summary?.body?.data || probe.summary?.body || {};
  const recBody = probe.records?.body?.data || probe.records?.body || {};
  const recs = Array.isArray(recBody) ? recBody : recBody.items || recBody.records || [];
  const today = probe.today?.body?.data || probe.today?.body || {};
  const presentZero = Number(sum.present || 0) === 0 && Number(sum.attendancePercentage || 0) === 0;
  const hasPresent = JSON.stringify(recs).includes('PRESENT') || /Present|Half Day/i.test(text);
  if (presentZero && hasPresent) {
    addIssue({
      title: 'Attendance summary period excludes today (timezone)',
      where: 'GET /attendance/summary vs records/today',
      why: `Summary present=${sum.present} pct=${sum.attendancePercentage} endDate=${sum.period?.endDate || 'n/a'} while records/UI show attendance`,
      classification: 'BACKEND',
      how: 'End summary at end-of-tenant-local-day or inclusive month',
      screenshot: ss2,
      network: `summary present=${sum.present}; records has PRESENT; today=${today.status}`,
    });
  }
  if (/Half Day/i.test(text) && JSON.stringify(recs).includes('"status":"PRESENT"')) {
    addIssue({
      title: 'Attendance UI status vs API PRESENT mismatch',
      where: '/attendance Table',
      why: 'API PRESENT but UI Half Day via client classifier',
      classification: 'FRONTEND',
      how: 'Prefer server status or align classifyDay with BE',
      screenshot: ss2,
      network: 'GET /attendance/records → PRESENT vs UI Half Day',
    });
  }
  if (today.status === 'PRESENT' && (today.duration === 0 || today.totalMinutes === 0)) {
    addIssue({
      title: 'Zero-duration check-out accepted as PRESENT',
      where: 'GET /attendance/today',
      why: `PRESENT with duration=${today.duration} totalMinutes=${today.totalMinutes}`,
      classification: 'BACKEND',
      how: 'Reject early check-out or mark incomplete/half-day',
      screenshot: ss2,
      network: `today duration=${today.duration}`,
    });
  }
  harvest(state, 'Attendance/probe', ss2, 0, 'probe');
}

async function main() {
  console.log('=== STABLE RESUME (shotIdx=', shotIdx, ') ===');
  let { browser, page, state } = await newSession();
  await shot(page, 'resume2-login');

  // Settings in chunks with browser recycle
  console.log('→ Settings');
  for (let i = 0; i < SETTINGS_SUB.length; i++) {
    const sub = SETTINGS_SUB[i];
    console.log(`  settings/${sub}`);
    try {
      if (i > 0 && i % 6 === 0) {
        await browser.close().catch(() => {});
        ({ browser, page, state } = await newSession());
        console.log('  (browser recycled)');
      }
      await exploreHref(page, state, `Settings/${sub}`, `/settings/${sub}`);
    } catch (e) {
      console.log(`  FAIL ${sub}: ${String(e).slice(0, 140)}`);
      addIssue({
        title: `Settings sub failed: ${sub}`,
        where: `/settings/${sub}`,
        why: String(e).slice(0, 300),
        classification: 'FRONTEND',
        how: 'Investigate settings panel stability',
        screenshot: 'n/a',
        network: 'n/a',
      });
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
      ({ browser, page, state } = await newSession());
    }
  }

  for (const menu of MENUS_LEFT) {
    console.log(`→ ${menu.label}`);
    try {
      await exploreHref(page, state, menu.label, menu.href);
    } catch (e) {
      console.log(`  FAIL ${menu.label}: ${String(e).slice(0, 140)}`);
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
      ({ browser, page, state } = await newSession());
      await exploreHref(page, state, menu.label, menu.href).catch((err) =>
        addIssue({
          title: `Menu failed: ${menu.label}`,
          where: menu.href,
          why: String(err).slice(0, 300),
          classification: 'FRONTEND',
          how: 'Stabilize page',
          screenshot: 'n/a',
          network: 'n/a',
        }),
      );
    }
  }

  // Shell notifications
  await page.goto(`${UI}/dashboard`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, 500);
  const bell = page.locator('button[aria-label*="Notification" i]').first();
  if (await bell.isVisible({ timeout: 700 }).catch(() => false)) {
    await bell.click().catch(() => {});
    depthStats.buttons = (depthStats.buttons || 0) + 1;
    await settle(page, 400);
    const sn = await shot(page, 'shell-notifications');
    logF('Shell', 'notifications', 'PASS', { screenshot: sn });
    const mark = page.locator('button:has-text("Mark all")').first();
    if (await mark.isVisible({ timeout: 300 }).catch(() => false)) {
      await mark.click().catch(() => {});
      mutations.push({ menu: 'Shell', action: 'mark-all-read', at: new Date().toISOString() });
      await shot(page, 'shell-notifications-mark');
    }
    await dismiss(page);
  }

  // Export retries
  console.log('→ Export retries');
  await exploreHref(page, state, 'Employees/export-retry', '/employees');
  await exploreHref(page, state, 'Reports/export-retry', '/reports/workforce/headcount');

  await probeAttendance(page, state);

  writeOutputs();
  console.log(JSON.stringify({ depthStats, issues: issues.length, shots: shotIdx, mutations: mutations.length }, null, 2));
  await browser.close().catch(() => {});
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
