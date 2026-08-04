/**
 * SUPER_ADMIN deep UI E2E v3 — resume-capable, stricter action caps, incremental saves
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
const ROLE = 'SUPER_ADMIN';
const EMAIL = 'superadmin@acme.test';
const PASSWORD = 'Password123!';
const TENANT = 'acme-corp-001';
const STATE_FILE = path.join(OUT, '_progress.json');

const MENUS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Employees', href: '/employees' },
  { label: 'Departments', href: '/departments' },
  { label: 'Attendance', href: '/attendance' },
  { label: 'Timesheets', href: '/timesheets' },
  { label: 'Leave', href: '/leave' },
  { label: 'Holidays', href: '/holidays' },
  { label: 'Payroll', href: '/payroll' },
  { label: 'Payout methods', href: '/payout-methods' },
  { label: 'Reports', href: '/reports' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Permissions', href: '/permissions' },
  { label: 'Settings', href: '/settings' },
  { label: 'Recruitment', href: '/recruitment' },
  { label: 'Performance', href: '/performance' },
  { label: 'Assets', href: '/assets' },
  { label: 'Announcements', href: '/announcements' },
];

const SETTINGS_SUB = [
  'company-profile', 'branding', 'locale', 'working-hours', 'leave-types',
  'attendance-rules', 'timesheets', 'leave-policies', 'leave-packs', 'leave-assignments',
  'pay/legal-entities', 'pay/statutory-packs', 'pay/components', 'pay/groups',
  'pay/schedules', 'pay/payslip-template', 'pay/data-policy', 'pay/country-bank-schemas',
  'authentication', 'sessions', 'audit-log', 'email-templates', 'notifications',
  'integration-email', 'integration-storage', 'integration-webhooks',
  'billing-plan', 'billing-invoices',
];

const EXTRA = {
  Payroll: ['/payroll/my-payslips', '/payroll/migration', '/payroll/global'],
  'Payout methods': ['/payout-methods/approvals'],
};

const SKIP_RE = /sign out|log out|logout|delete all|wipe|reset database|deactivate/i;
const PRIORITY_RE =
  /^(add |create |new |export|download|approve|deny|reject|filter|import|upload|pdf|excel|csv|xlsx|refresh|submit|apply|run |generate|invite|assign|save |cancel|columns|search)/i;

let shotIdx = 0;
let findings = [];
let issues = [];
let downloads = [];
let counters = { menus: 0, buttons: 0, screenshots: 0, be: 0, fe: 0, both: 0 };
let doneMenus = new Set();
let doneSettings = new Set();

function loadProgress() {
  if (!fs.existsSync(STATE_FILE)) return;
  try {
    const p = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    findings = p.findings || [];
    issues = p.issues || [];
    downloads = p.downloads || [];
    counters = p.counters || counters;
    shotIdx = p.shotIdx || 0;
    doneMenus = new Set(p.doneMenus || []);
    doneSettings = new Set(p.doneSettings || []);
    console.log(`Resuming: menus=${[...doneMenus].join(',') || '(none)'} shotIdx=${shotIdx}`);
  } catch {
    /* ignore */
  }
}

function saveProgress() {
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        shotIdx,
        counters,
        findings,
        issues,
        downloads,
        doneMenus: [...doneMenus],
        doneSettings: [...doneSettings],
      },
      null,
      2,
    ),
  );
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55);
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(2, '0')}-${slug(name)}.png`;
  try {
    await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 6000 });
    counters.screenshots += 1;
    return file;
  } catch {
    try {
      await page.screenshot({ path: path.join(OUT, file), timeout: 4000 });
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
  if (/NO_EMPLOYEE_RECORD|NOT_IMPLEMENTED|INTERNAL|Prisma|ECONNREFUSED/i.test(b)) return 'BACKEND';
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
  const id = `ISSUE-SA-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, role: ROLE, ...p };
  issues.push(issue);
  if (issue.classification === 'BACKEND') counters.be += 1;
  else if (issue.classification === 'FRONTEND') counters.fe += 1;
  else counters.both += 1;
}

function logF(menu, action, status, detail = {}) {
  findings.push({ menu, action, status, at: new Date().toISOString(), ...detail });
}

async function hardDismiss(page) {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(60);
  }
  await page.evaluate(() => {
    document.querySelectorAll('[data-base-ui-inert]').forEach((el) => el.remove());
  }).catch(() => {});
}

async function settle(page, ms = 400) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

function attach(page, state) {
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
    state.failedRequests.push({
      method: res.request().method(),
      url,
      status,
      body,
      pageUrl: page.url(),
    });
  });
  page.on('download', async (dl) => {
    try {
      const pth = await dl.path();
      downloads.push({
        suggested: dl.suggestedFilename(),
        ok: !!pth && !dl.failure(),
        failure: dl.failure(),
        pageUrl: page.url(),
      });
    } catch (e) {
      downloads.push({ suggested: dl.suggestedFilename(), ok: false, failure: String(e), pageUrl: page.url() });
    }
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

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 300);
  if (!findings.some((f) => f.menu === 'Login')) await shot(page, 'login-form');
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard|\/otp/, { timeout: 30000 });
  await settle(page, 800);
  const ss = await shot(page, 'login-success');
  logF('Login', 'login', page.url().includes('/dashboard') ? 'PASS' : 'FAIL', { screenshot: ss, url: page.url() });
}

async function gotoMenu(page, href) {
  await hardDismiss(page);
  await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 700);
  await hardDismiss(page);
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
  const href = (await el.getAttribute('href').catch(() => '')) || '';
  return text || aria || href || 'control';
}

async function clickActions(page, menu, state, { home, max = 12 } = {}) {
  let clicked = 0;

  const search = page.locator('main input[type="search"], main input[placeholder*="Search" i]').first();
  if (await search.isVisible({ timeout: 300 }).catch(() => false)) {
    const before = state.failedRequests.length;
    await search.fill('a').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await settle(page, 400);
    counters.buttons += 1;
    clicked += 1;
    const ss = await shot(page, `${menu}-search`);
    logF(menu, 'search', 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, 'search');
    await search.fill('').catch(() => {});
  }

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
    await settle(page, 350);
    const ss = await shot(page, `${menu}-tab-${lab}`);
    logF(menu, `tab:${lab}`, 'PASS', { screenshot: ss });
    harvest(state, menu, ss, before, `tab:${lab}`);
  }

  const candidates = page.locator('main button:visible, main a[href]:visible, [role="main"] button:visible');
  const count = await candidates.count();
  const metas = [];
  for (let i = 0; i < Math.min(count, 80); i++) {
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = await labelOf(el);
    if (!lab || SKIP_RE.test(lab)) continue;
    const href = (await el.getAttribute('href').catch(() => '')) || '';
    if (href && MENUS.some((m) => m.href === href)) continue;
    const priority = PRIORITY_RE.test(lab) || /\/new$|export|download|approv/i.test(href + lab);
    const isEditCountry = /^edit\s+/i.test(lab) && !/^edit$/i.test(lab.trim());
    const isRow =
      !priority &&
      (/^actions for /i.test(lab) || (/^[A-Z][a-z]+ [A-Z]/.test(lab) && !PRIORITY_RE.test(lab)));
    metas.push({ i, lab, href, priority, isEditCountry, isRow });
  }
  metas.sort((a, b) => Number(b.priority) - Number(a.priority) || Number(a.isRow) - Number(b.isRow));

  let rowClicks = 0;
  let editClicks = 0;
  for (const m of metas) {
    if (clicked >= max) break;
    if (m.isEditCountry) {
      if (editClicks >= 1) continue;
      editClicks += 1;
    }
    if (m.isRow) {
      if (rowClicks >= 1) continue;
      rowClicks += 1;
    }
    // Skip pure pagination numbers etc mid-list unless priority
    if (!m.priority && !m.isRow && !m.isEditCountry && !/cancel|close|view|open|manage|configure/i.test(m.lab)) {
      // still allow a few secondary
      if (clicked > max - 3 && !m.priority) continue;
    }

    await hardDismiss(page);
    let el = page.locator('main button, main a[href]', { hasText: new RegExp(`^${m.lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first();
    if (!(await el.isVisible({ timeout: 200 }).catch(() => false))) el = candidates.nth(m.i);

    const before = state.failedRequests.length;
    const beforeDl = downloads.length;
    const beforeUrl = page.url();
    if (!(await safeClick(page, el))) continue;
    counters.buttons += 1;
    clicked += 1;
    await settle(page, 500);
    const ss = await shot(page, `${menu}-${m.lab}`);
    const isApprove = /^(approve|deny|reject)$/i.test(m.lab.trim());
    logF(menu, m.lab, 'PASS', { screenshot: ss, url: page.url(), note: isApprove ? 'mutation noted' : undefined });

    if (isApprove) {
      const confirm = page.locator('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes")').first();
      if (await confirm.isVisible({ timeout: 400 }).catch(() => false)) {
        await confirm.click({ force: true }).catch(() => {});
        await settle(page, 500);
        await shot(page, `${menu}-${m.lab}-confirmed`);
      }
    }

    if (/export|download|pdf|excel|csv|xlsx/i.test(m.lab)) {
      await settle(page, 600);
      const sub = page.locator('[role="menu"] [role="menuitem"]:visible, [role="menuitem"]:visible');
      const sc = Math.min(await sub.count(), 5);
      for (let si = 0; si < sc; si++) {
        const item = sub.nth(si);
        const slab = await labelOf(item);
        const b2 = state.failedRequests.length;
        const d2 = downloads.length;
        await item.click({ force: true, timeout: 1500 }).catch(() => {});
        counters.buttons += 1;
        await settle(page, 1000);
        const sss = await shot(page, `${menu}-export-${slab}`);
        const newDl = downloads.slice(d2);
        const fails = state.failedRequests.slice(b2);
        const success = newDl.some((d) => d.ok);
        logF(menu, `export:${slab}`, success || fails.length === 0 ? 'PASS' : 'FAIL', {
          screenshot: sss,
          downloads: newDl,
        });
        if (!success && fails.length) {
          const fr = fails[0];
          addIssue({
            title: `Export failed: ${slab || m.lab}`,
            where: `${menu} / ${beforeUrl} / ${m.lab} → ${slab}`,
            why: `${fr.method} ${fr.url} → ${fr.status}: ${fr.body.slice(0, 200)}`,
            classification: classify(fr.url, fr.status, fr.body),
            how: 'Fix export API + FE download trigger',
            screenshot: sss,
            network: `${fr.method} ${fr.url} ${fr.status}`,
            expected: 'file download',
            actual: `HTTP ${fr.status}`,
          });
        } else if (!success && !fails.length) {
          // Menu opened but no network — note as FE if no download
          addIssue({
            title: `Export produced no download: ${slab || m.lab}`,
            where: `${menu} / ${beforeUrl} / ${m.lab}`,
            why: 'No download event and no failed API — likely FE stub or blocked',
            classification: 'FRONTEND',
            how: 'Wire FE export handler to API download',
            screenshot: sss,
            network: 'no request/download',
            expected: 'file download',
            actual: 'no file',
          });
        }
        await hardDismiss(page);
      }
      void beforeDl;
    }

    harvest(state, menu, ss, before, m.lab);

    const dlg = page.locator('[role="dialog"], [role="alertdialog"]').first();
    if (await dlg.isVisible({ timeout: 250 }).catch(() => false)) {
      if (/add|create|new|edit|invite/i.test(m.lab) && !isApprove) {
        await shot(page, `${menu}-modal-${m.lab}`);
      }
      if (!isApprove) {
        const cancel = dlg.locator('button:has-text("Cancel"), button:has-text("Close")').first();
        if (await cancel.isVisible({ timeout: 300 }).catch(() => false)) {
          await cancel.click({ force: true }).catch(() => {});
        } else await hardDismiss(page);
      }
    }
    await hardDismiss(page);

    if (home) {
      const base = home.replace(/\/$/, '');
      if (!page.url().includes(base.replace(/^\//, '')) && !page.url().endsWith(home)) {
        await gotoMenu(page, home);
      }
    }
  }
  return clicked;
}

async function exploreDashboard(page, state) {
  if (doneMenus.has('Dashboard')) return;
  counters.menus += 1;
  await gotoMenu(page, '/dashboard');
  const before = state.failedRequests.length;
  const ss = await shot(page, 'dashboard');
  logF('Dashboard', 'open', 'PASS', { screenshot: ss, url: page.url() });
  harvest(state, 'Dashboard', ss, before, 'open');

  const add = page.locator('main a:has-text("Add Employee"), main button:has-text("Add Employee"), main a:has-text("Add employee")').first();
  if (await add.isVisible({ timeout: 1200 }).catch(() => false)) {
    const b = state.failedRequests.length;
    await safeClick(page, add);
    counters.buttons += 1;
    await settle(page, 600);
    const s2 = await shot(page, 'dashboard-add-employee');
    logF('Dashboard', 'Add Employee', 'PASS', { screenshot: s2, url: page.url() });
    harvest(state, 'Dashboard', s2, b, 'Add Employee');
    await gotoMenu(page, '/dashboard');
  }

  for (const label of ['Approve', 'Deny', 'Reject']) {
    await hardDismiss(page);
    const btn = page.locator(`main button:has-text("${label}")`).first();
    if (!(await btn.isVisible({ timeout: 500 }).catch(() => false))) continue;
    const b = state.failedRequests.length;
    await safeClick(page, btn);
    counters.buttons += 1;
    await settle(page, 400);
    const confirm = page.locator('[role="dialog"] button:has-text("Confirm"), [role="dialog"] button:has-text("Yes")').first();
    if (await confirm.isVisible({ timeout: 400 }).catch(() => false)) {
      await confirm.click({ force: true }).catch(() => {});
      await settle(page, 500);
    }
    const s3 = await shot(page, `dashboard-${label.toLowerCase()}`);
    logF('Dashboard', label, 'PASS', { screenshot: s3, note: 'mutation noted' });
    harvest(state, 'Dashboard', s3, b, label);
  }

  await clickActions(page, 'Dashboard', state, { home: '/dashboard', max: 12 });
  doneMenus.add('Dashboard');
  saveProgress();
}

async function exploreMenu(page, menu, state) {
  if (doneMenus.has(menu.label) && menu.label !== 'Settings') return;
  console.log(`→ ${menu.label}`);
  if (!doneMenus.has(menu.label)) {
    counters.menus += 1;
    await gotoMenu(page, menu.href);
    // sidebar click evidence
    const nav = page.locator(`nav[aria-label="Main navigation"] a[aria-label="${menu.label}"]`).first();
    if (await nav.isVisible({ timeout: 600 }).catch(() => false)) {
      await nav.click({ force: true, timeout: 2000 }).catch(() => {});
      await settle(page, 300);
    }
    const before = state.failedRequests.length;
    const ss = await shot(page, slug(menu.label));
    logF(menu.label, 'open', 'PASS', { screenshot: ss, url: page.url() });
    harvest(state, menu.label, ss, before, 'open');
    await clickActions(page, menu.label, state, { home: menu.href, max: 14 });
  }

  if (menu.label === 'Settings') {
    for (const sub of SETTINGS_SUB) {
      if (doneSettings.has(sub)) continue;
      console.log(`  settings/${sub}`);
      const href = `/settings/${sub}`;
      await gotoMenu(page, href);
      const b = state.failedRequests.length;
      const sSub = await shot(page, `settings-${slug(sub)}`);
      logF('Settings', `sub:${sub}`, 'PASS', { screenshot: sSub, url: page.url() });
      harvest(state, `Settings/${sub}`, sSub, b, 'open');
      const max = sub.includes('country-bank') ? 4 : 8;
      await clickActions(page, `Settings/${sub}`, state, { home: href, max });
      doneSettings.add(sub);
      saveProgress();
    }
  }

  if (!doneMenus.has(menu.label)) {
    for (const extra of EXTRA[menu.label] || []) {
      await gotoMenu(page, extra);
      const b = state.failedRequests.length;
      const se = await shot(page, slug(extra));
      logF(menu.label, `extra:${extra}`, 'PASS', { screenshot: se, url: page.url() });
      harvest(state, `${menu.label}${extra}`, se, b, 'open');
      await clickActions(page, `${menu.label}${extra}`, state, { home: extra, max: 8 });
    }
    doneMenus.add(menu.label);
    saveProgress();
  } else if (menu.label === 'Settings' && SETTINGS_SUB.every((s) => doneSettings.has(s))) {
    doneMenus.add('Settings');
    saveProgress();
  }
}

function writeOutputs() {
  const lines = [];
  lines.push('# SUPER_ADMIN Deep UI E2E Findings');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Role: ${ROLE} (${EMAIL})`);
  lines.push(`- UI: ${UI}`);
  lines.push(`- API: ${API}`);
  lines.push(`- Tenant: ${TENANT}`);
  lines.push('- MSW: OFF');
  lines.push('- Tool: Playwright Chromium (deep v3)');
  lines.push(`- Menus completed: ${[...doneMenus].join(', ')}`);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Menus tested | ${Math.max(counters.menus, doneMenus.size)} |`);
  lines.push(`| Buttons/actions clicked | ${counters.buttons} |`);
  lines.push(`| Screenshots | ${counters.screenshots} |`);
  lines.push(`| Issues BACKEND | ${counters.be} |`);
  lines.push(`| Issues FRONTEND | ${counters.fe} |`);
  lines.push(`| Issues BOTH | ${counters.both} |`);
  lines.push(`| Download events | ${downloads.length} |`);
  lines.push('');
  lines.push('## Menu / Action Log');
  lines.push('');
  for (const f of findings) {
    lines.push(
      `- **[${f.status}]** ${f.menu} → ${f.action}` +
        (f.screenshot ? ` — \`${f.screenshot}\`` : '') +
        (f.url ? ` — ${f.url}` : '') +
        (f.note ? ` — _${f.note}_` : ''),
    );
  }
  lines.push('');
  lines.push('## Issues');
  lines.push('');
  if (!issues.length) lines.push('_None_');
  for (const iss of issues) {
    lines.push(`### ${iss.id}: ${iss.title}`);
    lines.push(`- Role: ${iss.role}`);
    lines.push(`- Where: ${iss.where}`);
    lines.push(`- Why: ${iss.why}`);
    lines.push(`- Classification: **${iss.classification}**`);
    lines.push(`- Expected: ${iss.expected || 'n/a'}`);
    lines.push(`- Actual: ${iss.actual || 'n/a'}`);
    lines.push(`- How to resolve: ${iss.how}`);
    lines.push(`- Screenshot: \`${iss.screenshot || 'n/a'}\``);
    lines.push(`- Network: \`${iss.network || 'n/a'}\``);
    lines.push('');
  }
  lines.push('## Downloads');
  lines.push('');
  lines.push(downloads.length ? downloads.map((d) => `- ${JSON.stringify(d)}`).join('\n') : '_None_');
  lines.push('');
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));
  fs.writeFileSync(path.join(OUT, '_run-raw.json'), JSON.stringify({ counters, findings, issues, downloads, doneMenus: [...doneMenus] }, null, 2));

  for (const [file, side] of [
    ['E2E_BACKEND_ISSUES_CONTRACT.md', 'BACKEND'],
    ['E2E_FRONTEND_ISSUES_CONTRACT.md', 'FRONTEND'],
  ]) {
    const filtered = issues.filter((i) =>
      side === 'BACKEND'
        ? i.classification === 'BACKEND' || i.classification === 'BOTH'
        : i.classification === 'FRONTEND' || i.classification === 'BOTH',
    );
    let existing = fs.existsSync(path.join(DOCS, file))
      ? fs.readFileSync(path.join(DOCS, file), 'utf8')
      : `# E2E Issues Contract\n\n> Living contract of UI E2E findings. Append-only sections per role.\n`;
    existing = existing.replace(/\n## SUPER_ADMIN[\s\S]*?(?=\n## [A-Z_]|\s*$)/, '');
    const sec = ['', '## SUPER_ADMIN', '', `> Updated ${new Date().toISOString()} — deep UI E2E v3 vs ${UI} / ${API}`, ''];
    if (!filtered.length) sec.push('_No issues for this side in this run._', '');
    for (const iss of filtered) {
      sec.push(`### ${iss.id}: ${iss.title}`);
      sec.push(`- Where: ${iss.where}`);
      sec.push(`- Why: ${iss.why}`);
      sec.push(`- Classification: ${iss.classification}`);
      sec.push(`- How to resolve: ${iss.how}`);
      sec.push(`- Screenshot: ${iss.screenshot || 'n/a'}`);
      sec.push(`- Network: ${iss.network || 'n/a'}`);
      sec.push('');
    }
    fs.writeFileSync(path.join(DOCS, file), existing.trimEnd() + '\n' + sec.join('\n'));
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const fresh = process.env.FRESH === '1';
  if (fresh) {
    for (const f of fs.readdirSync(OUT)) {
      if (/^\d{2}-.*\.png$/.test(f) || ['FINDINGS.md', '_run-raw.json', '_progress.json'].includes(f)) {
        try {
          fs.unlinkSync(path.join(OUT, f));
        } catch {
          /* ignore */
        }
      }
    }
  } else {
    loadProgress();
    // continue shot numbering from existing pngs if needed
    const pngs = fs.readdirSync(OUT).filter((f) => /^\d{2}-.*\.png$/.test(f));
    if (pngs.length && shotIdx < pngs.length) {
      const maxN = Math.max(...pngs.map((f) => parseInt(f.slice(0, 2), 10) || 0), ...pngs.map((f) => parseInt(f, 10) || 0));
      // filenames can be 3+ digits now
      const nums = pngs.map((f) => parseInt(f.split('-')[0], 10)).filter((n) => !Number.isNaN(n));
      shotIdx = Math.max(shotIdx, ...nums, 0);
    }
  }

  // If no progress but many screenshots from v2, mark completed menus heuristically and continue settings leftovers
  if (!doneMenus.size) {
    const names = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).join('\n');
    for (const m of MENUS) {
      if (m.label === 'Settings') continue;
      if (names.includes(`-${slug(m.label)}.png`) || names.includes(`-${slug(m.label)}-`)) {
        // don't mark done without findings — retest unfinished menus only if late menus missing
      }
    }
    // Prefer fresh full run with FRESH=1 for accuracy
  }

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
  page.setDefaultTimeout(10000);
  const state = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    seen: new Set(issues.map((i) => (i.network || '').replace(/\s+\d+$/, ''))),
    consoleAt: 0,
    pageAt: 0,
  };
  attach(page, state);

  console.log('Login…');
  await login(page);

  if (!doneMenus.has('Dashboard')) {
    console.log('Dashboard…');
    await exploreDashboard(page, state);
  }

  for (const menu of MENUS.filter((m) => m.label !== 'Dashboard')) {
    try {
      await exploreMenu(page, menu, state);
    } catch (e) {
      const ss = await shot(page, `${slug(menu.label)}-crash`);
      logF(menu.label, 'explore', 'FAIL', { error: String(e), screenshot: ss });
      addIssue({
        title: `Menu exploration crashed: ${menu.label}`,
        where: `${menu.label} / ${menu.href}`,
        why: String(e).slice(0, 400),
        classification: 'FRONTEND',
        how: 'Stabilize page',
        screenshot: ss,
        network: 'n/a',
        expected: 'explorable',
        actual: String(e).slice(0, 160),
      });
      saveProgress();
    }
  }

  writeOutputs();
  console.log(JSON.stringify({ counters, issues: issues.length, doneMenus: [...doneMenus] }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  try {
    writeOutputs();
    saveProgress();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
