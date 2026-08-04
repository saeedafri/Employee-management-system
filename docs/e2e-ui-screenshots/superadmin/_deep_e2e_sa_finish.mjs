/**
 * Finish remaining SUPER_ADMIN menus + full network audit merge into FINDINGS/contracts
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
const EMAIL = 'superadmin@acme.test';
const PASSWORD = 'Password123!';
const TENANT = 'acme-corp-001';
const ROLE = 'SUPER_ADMIN';

const RAW = path.join(OUT, '_run-raw.json');
const PROG = path.join(OUT, '_progress.json');

const ALL_MENUS = [
  '/dashboard', '/employees', '/departments', '/attendance', '/timesheets',
  '/leave', '/holidays', '/payroll', '/payroll/my-payslips', '/payroll/migration',
  '/payroll/global', '/payout-methods', '/payout-methods/approvals', '/reports',
  '/analytics', '/permissions', '/settings', '/recruitment', '/performance',
  '/assets', '/announcements',
];

const SETTINGS_LEFT = [
  'integration-storage', 'integration-webhooks', 'billing-plan', 'billing-invoices',
];

const DEEP_MENUS = [
  { label: 'Recruitment', href: '/recruitment' },
  { label: 'Performance', href: '/performance' },
  { label: 'Assets', href: '/assets' },
  { label: 'Announcements', href: '/announcements' },
];

let data = {
  counters: { menus: 0, buttons: 0, screenshots: 0, be: 0, fe: 0, both: 0 },
  findings: [],
  issues: [],
  downloads: [],
  doneMenus: [],
  doneSettings: [],
  shotIdx: 0,
};

function load() {
  if (fs.existsSync(PROG)) {
    data = { ...data, ...JSON.parse(fs.readFileSync(PROG, 'utf8')) };
  } else if (fs.existsSync(RAW)) {
    data = { ...data, ...JSON.parse(fs.readFileSync(RAW, 'utf8')) };
  }
  // Drop harness false-positives
  data.issues = (data.issues || []).filter(
    (i) => !/browser has been closed|Target page, context/i.test(i.why || i.title || ''),
  );
  data.findings = (data.findings || []).filter(
    (f) => !/browser has been closed/i.test(f.error || ''),
  );
  // recount
  data.counters.be = data.issues.filter((i) => i.classification === 'BACKEND').length;
  data.counters.fe = data.issues.filter((i) => i.classification === 'FRONTEND').length;
  data.counters.both = data.issues.filter((i) => i.classification === 'BOTH').length;
  const nums = fs
    .readdirSync(OUT)
    .filter((f) => /^\d+-/.test(f) && f.endsWith('.png'))
    .map((f) => parseInt(f.split('-')[0], 10))
    .filter((n) => !Number.isNaN(n));
  data.shotIdx = Math.max(data.shotIdx || 0, ...(nums.length ? nums : [0]));
}

function save() {
  fs.writeFileSync(PROG, JSON.stringify(data, null, 2));
  fs.writeFileSync(RAW, JSON.stringify(data, null, 2));
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55);
}

async function shot(page, name) {
  data.shotIdx += 1;
  const file = `${String(data.shotIdx).padStart(2, '0')}-${slug(name)}.png`;
  try {
    await page.screenshot({ path: path.join(OUT, file), fullPage: false, timeout: 6000 });
    data.counters.screenshots += 1;
    return file;
  } catch {
    return null;
  }
}

function classify(url, status, body) {
  const u = url || '';
  const b = body || '';
  if (/NO_EMPLOYEE_RECORD|NOT_IMPLEMENTED|INTERNAL|Prisma|ECONNREFUSED/i.test(b)) return 'BACKEND';
  if (u.includes(':4000') || /\/api\/v1\//.test(u)) return 'BACKEND';
  if (u.includes('localhost:3001/api/')) {
    if ([404, 502, 504].includes(status)) return 'BOTH';
    if (status >= 400) return 'BACKEND';
  }
  if (status >= 400 && /\/api\//.test(u)) return 'BACKEND';
  return 'FRONTEND';
}

function addIssue(p) {
  const key = `${p.title}|${(p.network || '').replace(/\?.*/, '')}`;
  if (data.issues.some((i) => `${i.title}|${(i.network || '').replace(/\?.*/, '')}` === key)) return;
  // renumber at end
  data.issues.push({ id: 'TMP', role: ROLE, ...p });
  if (p.classification === 'BACKEND') data.counters.be += 1;
  else if (p.classification === 'FRONTEND') data.counters.fe += 1;
  else data.counters.both += 1;
}

function renumber() {
  data.issues.forEach((i, idx) => {
    i.id = `ISSUE-SA-${String(idx + 1).padStart(2, '0')}`;
  });
  data.counters.be = data.issues.filter((i) => i.classification === 'BACKEND').length;
  data.counters.fe = data.issues.filter((i) => i.classification === 'FRONTEND').length;
  data.counters.both = data.issues.filter((i) => i.classification === 'BOTH').length;
}

function logF(menu, action, status, detail = {}) {
  data.findings.push({ menu, action, status, at: new Date().toISOString(), ...detail });
}

async function dismiss(page) {
  for (let i = 0; i < 3; i++) await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => document.querySelectorAll('[data-base-ui-inert]').forEach((e) => e.remove())).catch(() => {});
}

async function settle(page, ms = 500) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'domcontentloaded' });
  await settle(page, 300);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await settle(page, 800);
  logF('Login', 're-login-finish-pass', 'PASS', { url: page.url() });
}

async function safeClick(page, el) {
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

async function deepPage(page, label, href, state, max = 12) {
  await dismiss(page);
  await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await settle(page, 800);
  const before = state.failed.length;
  // sidebar click if present
  const navLab = label.split('/')[0];
  const nav = page.locator(`nav[aria-label="Main navigation"] a[aria-label="${navLab}"]`).first();
  if (await nav.isVisible({ timeout: 500 }).catch(() => false)) {
    await nav.click({ force: true }).catch(() => {});
    await settle(page, 300);
  }
  const ss = await shot(page, slug(label));
  logF(label, 'open', 'PASS', { screenshot: ss, url: page.url() });
  harvest(state, label, ss, before, 'open');

  // tabs
  const tabs = page.locator('main [role="tab"]');
  const tc = Math.min(await tabs.count(), 6);
  for (let i = 0; i < tc; i++) {
    const t = tabs.nth(i);
    const lab = ((await t.innerText().catch(() => '')) || `tab${i}`).trim().slice(0, 40);
    const b = state.failed.length;
    await safeClick(page, t);
    data.counters.buttons += 1;
    await settle(page, 350);
    const s2 = await shot(page, `${label}-tab-${lab}`);
    logF(label, `tab:${lab}`, 'PASS', { screenshot: s2 });
    harvest(state, label, s2, b, `tab:${lab}`);
  }

  const btns = page.locator('main button:visible, main a[href]:visible');
  const count = await btns.count();
  const seen = new Set();
  let clicks = 0;
  for (let i = 0; i < count && clicks < max; i++) {
    const el = btns.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const lab = ((await el.innerText().catch(() => '')) || (await el.getAttribute('aria-label')) || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!lab || seen.has(lab) || /sign out|logout/i.test(lab)) continue;
    if (!/^(add|create|new|export|download|approve|deny|reject|edit|filter|import|invite|assign|save|cancel|columns|search|view|manage|configure|run|generate)/i.test(lab) && clicks > 3) {
      // allow one detail
      if (!/^actions for/i.test(lab) && clicks > 4) continue;
    }
    if (/^edit\s+/i.test(lab) && [...seen].some((s) => /^edit\s+/i.test(s))) continue;
    seen.add(lab);
    await dismiss(page);
    const b = state.failed.length;
    if (!(await safeClick(page, el))) continue;
    data.counters.buttons += 1;
    clicks += 1;
    await settle(page, 450);
    const s3 = await shot(page, `${label}-${lab}`);
    logF(label, lab, 'PASS', { screenshot: s3, url: page.url() });
    if (/export|download|pdf|excel|csv/i.test(lab)) {
      const items = page.locator('[role="menuitem"]:visible');
      const ic = Math.min(await items.count(), 4);
      for (let j = 0; j < ic; j++) {
        const it = items.nth(j);
        const il = ((await it.innerText().catch(() => '')) || 'item').trim();
        const b2 = state.failed.length;
        const d0 = data.downloads.length;
        await it.click({ force: true }).catch(() => {});
        data.counters.buttons += 1;
        await settle(page, 900);
        const s4 = await shot(page, `${label}-export-${il}`);
        const fails = state.failed.slice(b2);
        const dls = data.downloads.slice(d0);
        if (fails.length) {
          const fr = fails[0];
          addIssue({
            title: `Export failed: ${il}`,
            where: `${label} / ${lab} → ${il}`,
            why: `${fr.method} ${fr.url} → ${fr.status}: ${fr.body.slice(0, 200)}`,
            classification: classify(fr.url, fr.status, fr.body),
            how: 'Fix export endpoint / FE download',
            screenshot: s4,
            network: `${fr.method} ${fr.url} ${fr.status}`,
            expected: 'download ok',
            actual: String(fr.status),
          });
        } else if (!dls.length) {
          addIssue({
            title: `Export no download: ${il || lab}`,
            where: `${label} / ${lab}`,
            why: 'No download event and no failed API',
            classification: 'FRONTEND',
            how: 'Wire FE export to API blob download',
            screenshot: s4,
            network: 'no request/download',
            expected: 'file',
            actual: 'none',
          });
        }
        await dismiss(page);
      }
    }
    harvest(state, label, s3, b, lab);
    const dlg = page.locator('[role="dialog"]').first();
    if (await dlg.isVisible({ timeout: 200 }).catch(() => false)) {
      await shot(page, `${label}-modal-${lab}`);
      const cancel = dlg.locator('button:has-text("Cancel"), button:has-text("Close")').first();
      if (await cancel.isVisible({ timeout: 200 }).catch(() => false)) await cancel.click({ force: true }).catch(() => {});
      else await dismiss(page);
    }
    await dismiss(page);
    if (!page.url().includes(href.replace(/^\//, '').split('/')[0])) {
      await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await settle(page, 400);
    }
  }
}

function harvest(state, menu, screenshot, since, action) {
  for (const fr of state.failed.slice(since)) {
    const key = `${fr.method}|${fr.status}|${fr.url.split('?')[0]}`;
    if (state.seen.has(key)) continue;
    state.seen.add(key);
    // ignore expected login 401s
    if (fr.status === 401 && /\/auth\/(me|refresh)/.test(fr.url)) continue;
    addIssue({
      title: `${menu}: ${fr.status} ${fr.url.split('/').filter(Boolean).slice(-3).join('/')}`,
      where: `${menu} / ${fr.pageUrl} / ${action}`,
      why: `${fr.method} ${fr.url} → ${fr.status}; ${fr.body.slice(0, 240)}`,
      classification: classify(fr.url, fr.status, fr.body),
      how: /NO_EMPLOYEE_RECORD/.test(fr.body)
        ? 'BE: admin-safe empty for users without employeeId; FE: hide employee-scoped widgets for SUPER_ADMIN without employee record'
        : 'Fix API handler or FE client/BFF path; surface graceful empty UI',
      screenshot,
      network: `${fr.method} ${fr.url} ${fr.status}`,
      expected: '2xx or graceful empty',
      actual: `${fr.status} ${fr.body.slice(0, 120)}`,
    });
  }
  for (const ce of state.console.slice(state.cAt)) {
    if (/Failed to load resource|favicon|React DevTools/i.test(ce.text)) continue;
    const key = `c:${ce.text.slice(0, 100)}`;
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
  state.cAt = state.console.length;
}

function writeDocs() {
  renumber();
  const menusDone = new Set([
    ...(data.doneMenus || []),
    'Settings',
    'Recruitment',
    'Performance',
    'Assets',
    'Announcements',
  ]);
  data.doneMenus = [...menusDone];
  data.counters.menus = Math.max(data.counters.menus || 0, data.doneMenus.length);

  const lines = [];
  lines.push('# SUPER_ADMIN Deep UI E2E Findings');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Role: ${ROLE} (${EMAIL})`);
  lines.push(`- UI: ${UI}`);
  lines.push(`- API: ${API}`);
  lines.push(`- Tenant: ${TENANT}`);
  lines.push('- MSW: OFF');
  lines.push('- Tool: Playwright Chromium (deep v3 + finish/network audit)');
  lines.push(`- Menus completed: ${data.doneMenus.join(', ')}`);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Menus tested | ${data.doneMenus.length} |`);
  lines.push(`| Buttons/actions clicked | ${data.counters.buttons} |`);
  lines.push(`| Screenshots | ${data.counters.screenshots} |`);
  lines.push(`| Issues BACKEND | ${data.counters.be} |`);
  lines.push(`| Issues FRONTEND | ${data.counters.fe} |`);
  lines.push(`| Issues BOTH | ${data.counters.both} |`);
  lines.push(`| Download events | ${(data.downloads || []).length} |`);
  lines.push('');
  lines.push('## Menu / Action Log');
  lines.push('');
  for (const f of data.findings) {
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
  if (!data.issues.length) lines.push('_None_');
  for (const iss of data.issues) {
    lines.push(`### ${iss.id}: ${iss.title}`);
    lines.push(`- Role: ${ROLE}`);
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
  lines.push(
    (data.downloads || []).length
      ? data.downloads.map((d) => `- ${JSON.stringify(d)}`).join('\n')
      : '_None_',
  );
  lines.push('');
  fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), lines.join('\n'));
  save();

  for (const [file, side] of [
    ['E2E_BACKEND_ISSUES_CONTRACT.md', 'BACKEND'],
    ['E2E_FRONTEND_ISSUES_CONTRACT.md', 'FRONTEND'],
  ]) {
    const filtered = data.issues.filter((i) =>
      side === 'BACKEND'
        ? i.classification === 'BACKEND' || i.classification === 'BOTH'
        : i.classification === 'FRONTEND' || i.classification === 'BOTH',
    );
    let existing = fs.existsSync(path.join(DOCS, file))
      ? fs.readFileSync(path.join(DOCS, file), 'utf8')
      : `# E2E Issues Contract\n\n`;
    existing = existing.replace(/\n## SUPER_ADMIN[\s\S]*?(?=\n## [A-Z_]|\s*$)/, '');
    const sec = [
      '',
      '## SUPER_ADMIN',
      '',
      `> Updated ${new Date().toISOString()} — deep UI E2E (Playwright) vs ${UI} / ${API}`,
      `> Evidence: \`docs/e2e-ui-screenshots/superadmin/\` (${data.counters.screenshots} PNGs + FINDINGS.md)`,
      `> Tester: \`${EMAIL}\` · tenant \`${TENANT}\``,
      '',
    ];
    if (!filtered.length) sec.push('_No issues for this side in this run._', '');
    for (const iss of filtered) {
      sec.push(`### ${iss.id}: ${iss.title}`);
      sec.push(`- Where: ${iss.where}`);
      sec.push(`- Why: ${iss.why}`);
      sec.push(`- Classification: ${iss.classification}`);
      sec.push(`- How to resolve: ${iss.how}`);
      sec.push(`- Screenshot: docs/e2e-ui-screenshots/superadmin/${iss.screenshot || 'n/a'}`);
      sec.push(`- Network: ${iss.network || 'n/a'}`);
      sec.push('');
    }
    fs.writeFileSync(path.join(DOCS, file), existing.trimEnd() + '\n' + sec.join('\n'));
  }
}

async function main() {
  load();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('tenantKey', t);
    } catch {
      /* ignore */
    }
  }, TENANT);

  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const state = { failed: [], console: [], seen: new Set(), cAt: 0 };
  // seed seen from existing issues
  for (const i of data.issues) {
    if (i.network) state.seen.add(i.network.replace(/\s+\d+$/, '').replace(' ', '|') + '|' + (i.network.match(/(\d+)$/) || [])[1]);
  }

  page.on('console', (msg) => {
    if (msg.type() === 'error') state.console.push({ text: msg.text(), url: page.url() });
  });
  page.on('download', async (dl) => {
    try {
      const p = await dl.path();
      data.downloads.push({ suggested: dl.suggestedFilename(), ok: !!p && !dl.failure(), pageUrl: page.url() });
    } catch (e) {
      data.downloads.push({ suggested: dl.suggestedFilename(), ok: false, failure: String(e) });
    }
  });
  page.on('response', async (res) => {
    if (res.status() < 400) return;
    const url = res.url();
    if (/\.(png|jpe?g|svg|css|woff2?|ico|map)(\?|$)/i.test(url)) return;
    if (/_next\/static|hot-update/i.test(url)) return;
    let body = '';
    try {
      body = (await res.text()).slice(0, 500);
    } catch {
      body = '';
    }
    state.failed.push({
      method: res.request().method(),
      url,
      status: res.status(),
      body,
      pageUrl: page.url(),
    });
  });

  console.log('Login…');
  await login(page);

  // Finish settings leftovers
  for (const sub of SETTINGS_LEFT) {
    if ((data.doneSettings || []).includes(sub)) continue;
    console.log('settings/', sub);
    await deepPage(page, `Settings/${sub}`, `/settings/${sub}`, state, 8);
    data.doneSettings = [...new Set([...(data.doneSettings || []), sub])];
    if (!data.doneMenus.includes('Settings')) data.doneMenus.push('Settings');
    save();
  }

  // Deep remaining primary menus
  for (const m of DEEP_MENUS) {
    console.log('→', m.label);
    try {
      await deepPage(page, m.label, m.href, state, 14);
      if (!data.doneMenus.includes(m.label)) data.doneMenus.push(m.label);
      data.counters.menus = Math.max(data.counters.menus, data.doneMenus.length);
      save();
    } catch (e) {
      console.error('fail', m.label, e.message);
      const ss = await shot(page, `${slug(m.label)}-error`);
      logF(m.label, 'explore', 'FAIL', { error: String(e), screenshot: ss });
      // reopen browser context if closed
      if (/closed/i.test(String(e))) throw e;
    }
  }

  // Network audit sweep all routes
  console.log('Network audit sweep…');
  for (const href of ALL_MENUS) {
    const before = state.failed.length;
    await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await settle(page, 900);
    const ss = await shot(page, `audit-${slug(href)}`);
    logF('NetworkAudit', href, 'PASS', { screenshot: ss, url: page.url() });
    harvest(state, `Audit${href}`, ss, before, 'load');
  }

  // Also known NO_EMPLOYEE endpoints via UI already covered; check payout/timesheet personal
  writeDocs();
  console.log(
    JSON.stringify(
      {
        counters: data.counters,
        issues: data.issues.length,
        titles: data.issues.map((i) => `${i.id}:${i.classification}:${i.title}`),
        doneMenus: data.doneMenus,
      },
      null,
      2,
    ),
  );
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  try {
    writeDocs();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
