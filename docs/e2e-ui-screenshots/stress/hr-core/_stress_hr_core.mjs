/**
 * HR-CORE STRESS + DEEP E2E SHORT shard
 * Role: HR_ADMIN hr@acme.test
 * Menus: Dashboard, Employees, Attendance, Leave, Payroll, Reports
 * Stress: concurrent tab switches + export clicks; attendance summary today zeros
 * Out: docs/e2e-ui-screenshots/stress/hr-core/
 * No Render. No commits.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const FE = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_BASE || 'http://localhost:4000/api/v1';
const EMAIL = 'hr@acme.test';
const PASS = 'Password123!';
const TENANT = 'acme-corp-001';

const MENUS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Employees', href: '/employees' },
  { label: 'Attendance', href: '/attendance' },
  { label: 'Leave', href: '/leave' },
  { label: 'Payroll', href: '/payroll' },
  { label: 'Reports', href: '/reports' },
];

const ERR_PATTERNS = [
  /something went wrong/i,
  /failed to load/i,
  /error boundary/i,
  /access restricted/i,
  /internal server error/i,
  /application error/i,
];

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) {
  if (f.endsWith('.png') || f === 'results.json' || f === 'FINDINGS.md') {
    fs.unlinkSync(path.join(OUT, f));
  }
}

let shotIdx = 0;
const screenshots = [];
const issues = [];
const findings = [];
const menuStats = [];
const stressNotes = [];
const seen = new Set();

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function shot(page, menu, action, result = 'ok') {
  shotIdx += 1;
  const name = `${String(shotIdx).padStart(3, '0')}-${slug(menu)}-${slug(action)}-${slug(result)}.png`;
  await page.screenshot({ path: path.join(OUT, name), fullPage: false }).catch(() => {});
  screenshots.push({ name, menu, action, result, url: page.url() });
  console.log(`  📸 ${name}`);
  return name;
}

function addIssue(partial) {
  const key = `${partial.classification}|${partial.where}|${partial.why}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const id = `ISSUE-HR-STRESS-${String(issues.length + 1).padStart(2, '0')}`;
  const issue = { id, ...partial };
  issues.push(issue);
  console.log(`  🐛 ${id} [${partial.classification}] ${partial.where}`);
  return issue;
}

let apiCalls = [];
let consoleErrors = [];
function resetNet() {
  apiCalls = [];
  consoleErrors = [];
}
function failApis() {
  return apiCalls.filter((c) => c.status >= 400);
}

async function settle(page, ms = 600) {
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function bodyText(page) {
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

async function dismiss(page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(100);
  }
  const cancel = page.getByRole('button', { name: /^(cancel|close|dismiss)$/i }).first();
  if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
}

function recordFails(menu, action, screenshot) {
  for (const f of failApis()) {
    if (menu === 'login' && /\/api\/auth\/(me|refresh)/.test(f.url)) continue;
    const classification = f.status >= 500 ? 'BACKEND' : f.status === 404 ? 'BACKEND' : 'FRONTEND';
    addIssue({
      where: `${menu} → ${action}`,
      why: `API ${f.status} ${f.method} ${f.url}`,
      classification,
      how:
        classification === 'BACKEND'
          ? 'Fix backend route/status for HR_ADMIN under stress.'
          : 'Fix FE request wiring / error handling under rapid navigation.',
      screenshot,
      network: `${f.status} ${f.method} ${f.url}` + (f.bodySnippet ? ` | ${f.bodySnippet.slice(0, 180)}` : ''),
      console: consoleErrors.slice(0, 4),
    });
  }
}

async function checkVisible(page, menu, action, screenshot) {
  const text = await bodyText(page);
  const hit = ERR_PATTERNS.find((re) => re.test(text));
  if (!hit) return;
  addIssue({
    where: `${menu} → ${action}`,
    why: `Visible error: /${hit.source}/`,
    classification: failApis().some((f) => f.status >= 500) ? 'BACKEND' : 'FRONTEND',
    how: 'Resolve failure; show role-aware empty/error state.',
    screenshot,
    network: failApis()
      .slice(0, 5)
      .map((f) => `${f.status} ${f.method} ${f.url}`)
      .join('; '),
    console: consoleErrors.slice(0, 4),
  });
}

async function clickDeepButtons(page, menu, max = 10) {
  const clicked = [];
  const candidates = page.locator(
    'main button:visible, main [role="tab"]:visible, main a[href]:visible, main [role="menuitem"]:visible',
  );
  const n = Math.min(await candidates.count().catch(() => 0), max);
  for (let i = 0; i < n; i++) {
    await dismiss(page);
    const el = candidates.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const label = ((await el.innerText().catch(() => '')) || `ctrl-${i}`).trim().slice(0, 40) || `ctrl-${i}`;
    // Skip destructive / logout
    if (/delete|remove|logout|sign out|terminate|archive/i.test(label)) continue;
    resetNet();
    await el.click({ timeout: 4000 }).catch(() => {});
    await settle(page, 500);
    const sn = await shot(page, menu, `deep-${label}`, 'clicked');
    await checkVisible(page, menu, label, sn);
    recordFails(menu, label, sn);
    clicked.push(label);
    // close dialog if opened
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) {
      await shot(page, menu, `deep-${label}-modal`, 'open');
      await page.keyboard.press('Escape').catch(() => {});
      await settle(page, 250);
    }
  }
  return clicked;
}

async function exploreTabs(page, menu) {
  const tabs = page.locator('[role="tab"]');
  const n = Math.min(await tabs.count().catch(() => 0), 8);
  const labels = [];
  for (let i = 0; i < n; i++) {
    await dismiss(page);
    resetNet();
    const tab = tabs.nth(i);
    const label = ((await tab.innerText().catch(() => `tab-${i}`)) || `tab-${i}`).trim().slice(0, 40);
    await tab.click().catch(() => {});
    await settle(page, 450);
    const sn = await shot(page, menu, `tab-${label}`, 'view');
    await checkVisible(page, menu, `tab ${label}`, sn);
    recordFails(menu, `tab ${label}`, sn);
    labels.push(label);
  }
  return labels;
}

async function stressConcurrentTabs(page, menu) {
  const tabs = page.locator('[role="tab"]');
  const n = Math.min(await tabs.count().catch(() => 0), 6);
  if (n < 2) {
    stressNotes.push(`${menu}: <2 tabs — skipped concurrent tab stress`);
    return { ok: true, n };
  }
  resetNet();
  const t0 = Date.now();
  // Rapid sequential fire (Playwright single-page; concurrent Promise.all clicks)
  await Promise.all(
    Array.from({ length: n }, (_, i) =>
      tabs
        .nth(i)
        .click({ timeout: 3000 })
        .catch((e) => ({ err: String(e).slice(0, 80) })),
    ),
  );
  await settle(page, 800);
  const sn = await shot(page, menu, 'stress-concurrent-tabs', 'settled');
  const fails = failApis();
  const note = {
    menu,
    kind: 'concurrent-tabs',
    tabs: n,
    ms: Date.now() - t0,
    failCount: fails.length,
    fails: fails.slice(0, 8).map((f) => `${f.status} ${f.method} ${f.url}`),
    url: page.url(),
  };
  stressNotes.push(note);
  await checkVisible(page, menu, 'stress concurrent tabs', sn);
  recordFails(menu, 'stress concurrent tabs', sn);
  if (fails.length) {
    addIssue({
      where: `${menu} → stress concurrent tabs`,
      why: `${fails.length} API failures during Promise.all tab clicks`,
      classification: fails.some((f) => f.status >= 500) ? 'BACKEND' : 'FRONTEND',
      how: 'Debounce tab switches / cancel in-flight queries; harden BE under concurrent HR reads.',
      screenshot: sn,
      network: fails
        .slice(0, 6)
        .map((f) => `${f.status} ${f.method} ${f.url}`)
        .join('; '),
      console: consoleErrors.slice(0, 4),
    });
  }
  findings.push(`Stress concurrent tabs on ${menu}: n=${n} fails=${fails.length} ${Date.now() - t0}ms`);
  return note;
}

async function stressExportClicks(page, menu) {
  const exportBtns = page.getByRole('button', { name: /export|download|pdf|excel|csv|xlsx/i });
  const n = Math.min(await exportBtns.count().catch(() => 0), 5);
  if (n === 0) {
    // also try links
    const links = page.getByRole('link', { name: /export|download|pdf|excel|csv/i });
    const ln = Math.min(await links.count().catch(() => 0), 4);
    if (ln === 0) {
      stressNotes.push(`${menu}: no export controls found`);
      return { ok: true, n: 0 };
    }
  }
  resetNet();
  const downloads = [];
  page.once('download', (d) => downloads.push(d.suggestedFilename()));
  const t0 = Date.now();
  const count = Math.max(n, 1);
  const visible = [];
  for (let i = 0; i < Math.min(await exportBtns.count().catch(() => 0), 5); i++) {
    if (await exportBtns.nth(i).isVisible().catch(() => false)) visible.push(exportBtns.nth(i));
  }
  if (visible.length === 0) {
    stressNotes.push(`${menu}: export buttons not visible`);
    return { ok: true, n: 0 };
  }
  await Promise.all(visible.map((b) => b.click({ timeout: 4000 }).catch(() => {})));
  await settle(page, 1200);
  const sn = await shot(page, menu, 'stress-export-clicks', 'settled');
  // close any export menus/dialogs
  await dismiss(page);
  const fails = failApis();
  const note = {
    menu,
    kind: 'export-clicks',
    buttons: visible.length,
    ms: Date.now() - t0,
    downloads: downloads.slice(0, 5),
    failCount: fails.length,
    fails: fails.slice(0, 8).map((f) => `${f.status} ${f.method} ${f.url}`),
  };
  stressNotes.push(note);
  await checkVisible(page, menu, 'stress export', sn);
  recordFails(menu, 'stress export', sn);
  findings.push(
    `Stress export on ${menu}: btns=${visible.length} downloads=${downloads.length} fails=${fails.length}`,
  );
  return note;
}

async function probeAttendanceZeros(page, token) {
  console.log('=== ATTENDANCE SUMMARY TODAY ZEROS PROBE ===');
  resetNet();
  await page.goto(`${FE}/attendance`, { waitUntil: 'domcontentloaded' });
  await settle(page, 1000);
  const landSn = await shot(page, 'Attendance', 'zeros-probe-land', 'view');

  // Direct BE probes with HR token
  const headers = {
    authorization: `Bearer ${token}`,
    'x-tenant-key': TENANT,
    'content-type': 'application/json',
  };
  const month = new Date().toISOString().slice(0, 7);
  const [summaryRes, recordsRes, todayRes] = await Promise.all([
    fetch(`${API}/attendance/summary`, { headers }).then(async (r) => ({
      status: r.status,
      body: await r.json().catch(() => ({})),
    })),
    fetch(`${API}/attendance/records?month=${month}`, { headers }).then(async (r) => ({
      status: r.status,
      body: await r.json().catch(() => ({})),
    })),
    fetch(`${API}/attendance/today`, { headers }).then(async (r) => ({
      status: r.status,
      body: await r.json().catch(() => ({})),
    })),
  ]);

  const summary = summaryRes.body?.data || summaryRes.body || {};
  const records = recordsRes.body?.data?.items || recordsRes.body?.data || recordsRes.body?.items || [];
  const today = todayRes.body?.data || todayRes.body || {};
  const present = summary.present ?? summary.presentDays ?? summary.totals?.present;
  const pct = summary.attendancePercentage ?? summary.percentage;
  const endDate = summary.period?.endDate || summary.endDate;
  const recordArr = Array.isArray(records) ? records : records.records || [];
  const hasPresentRow = recordArr.some((r) => /PRESENT|HALF/i.test(String(r.status || '')));
  const todayStatus = today.status || today.attendanceStatus;

  const uiText = await bodyText(page);
  const uiZeroCards =
    /Present\s*0|Absent\s*0|Attendance\s*%\s*0|0\s*%/i.test(uiText) ||
    (/Present/i.test(uiText) && /\b0\b/.test(uiText));

  await shot(page, 'Attendance', 'zeros-probe-settled', 'view');

  // Table view for mismatch evidence
  const tableBtn = page.getByRole('button', { name: /table/i }).first();
  if (await tableBtn.isVisible().catch(() => false)) {
    await tableBtn.click().catch(() => {});
    await settle(page, 600);
    await shot(page, 'Attendance', 'zeros-probe-table', 'view');
  }

  const bug =
    (Number(present) === 0 || Number(pct) === 0) &&
    (hasPresentRow || /PRESENT/i.test(String(todayStatus)));

  const evidence = {
    summaryStatus: summaryRes.status,
    present,
    pct,
    endDate,
    recordsStatus: recordsRes.status,
    recordCount: recordArr.length,
    hasPresentRow,
    todayStatus: todayRes.status,
    todayBodyStatus: todayStatus,
    todayDuration: today.duration ?? today.totalMinutes,
    uiZeroCards,
    bugReproduced: bug,
  };
  findings.push(`Attendance zeros probe: ${JSON.stringify(evidence)}`);
  console.log('  probe', evidence);

  if (bug) {
    addIssue({
      where: 'GET /attendance/summary vs records/today',
      why: `Summary present=${present} pct=${pct} endDate=${endDate} while records has PRESENT and/or today=${todayStatus}`,
      classification: 'BACKEND',
      how: 'End summary period at end-of-tenant-local-day (or inclusive month), not raw wall-clock now UTC that excludes today midnight.',
      screenshot: landSn,
      network: `summary present=${present} pct=${pct} endDate=${endDate}; records hasPresent=${hasPresentRow} n=${recordArr.length}; today=${todayStatus}`,
      console: [],
      aliases: ['ISSUE-HR-05', 'ISSUE-HR-07'],
    });
  } else {
    findings.push('Attendance zeros bug NOT reproduced in this stress shard (summary aligned or no today row).');
  }
  return evidence;
}

async function login(page) {
  console.log('=== LOGIN ===');
  resetNet();
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
  await settle(page, 600);
  await shot(page, 'login', 'form', 'view');
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASS);
  const tenant = page.locator('input[name="tenant"], input[placeholder*="tenant" i]');
  if (await tenant.isVisible().catch(() => false)) await tenant.fill(TENANT);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await page.waitForURL(/dashboard|home|attendance/i, { timeout: 30000 }).catch(() => {});
  await settle(page, 900);
  const sn = await shot(page, 'login', 'submit', page.url().includes('login') ? 'fail' : 'ok');
  if (page.url().includes('login')) {
    addIssue({
      where: 'login',
      why: 'Login did not leave /login',
      classification: 'FRONTEND',
      how: 'Fix login redirect for HR_ADMIN.',
      screenshot: sn,
      network: failApis()
        .map((f) => `${f.status} ${f.url}`)
        .join('; '),
    });
    throw new Error('LOGIN_FAILED');
  }
  // Capture token via API for BE probes
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  }).then((r) => r.json());
  const token = loginRes?.data?.accessToken;
  if (!token) throw new Error('NO_TOKEN');
  return token;
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(60000);
page.setDefaultTimeout(12000);

page.on('response', async (res) => {
  const u = res.url();
  if (!u.includes('/api/')) return;
  const status = res.status();
  let bodySnippet = '';
  if (status >= 400) {
    try {
      bodySnippet = (await res.text()).slice(0, 240);
    } catch {
      /* ignore */
    }
  }
  apiCalls.push({
    url: u.replace(/https?:\/\/[^/]+/, ''),
    status,
    method: res.request().method(),
    bodySnippet,
  });
});
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
});
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e).slice(0, 200)));

let token;
try {
  token = await login(page);
} catch (e) {
  console.error('Login failed', e);
  await browser.close();
  process.exit(1);
}

// Attendance zeros probe early (primary stress target)
const zerosEvidence = await probeAttendanceZeros(page, token);

for (const menu of MENUS) {
  console.log(`==== MENU: ${menu.label} ====`);
  await dismiss(page);
  resetNet();
  await page.goto(`${FE}${menu.href}`, { waitUntil: 'domcontentloaded' });
  await settle(page, 800);
  const land = await shot(page, menu.label, 'land', 'view');
  await checkVisible(page, menu.label, 'land', land);
  recordFails(menu.label, 'land', land);

  const tabs = await exploreTabs(page, menu.label);
  const deep = await clickDeepButtons(page, menu.label, menu.label === 'Reports' ? 14 : 8);
  const tabStress = await stressConcurrentTabs(page, menu.label);
  const exportStress = await stressExportClicks(page, menu.label);

  // Reports: deep-dive report list buttons
  if (menu.label === 'Reports') {
    const reportItems = page.locator(
      'main a[href*="/reports/"], main button:has-text("Headcount"), main [data-report], aside a, nav a[href*="/reports/"]',
    );
    const rn = Math.min(await reportItems.count().catch(() => 0), 10);
    for (let i = 0; i < rn; i++) {
      await dismiss(page);
      resetNet();
      const el = reportItems.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      const lab = ((await el.innerText().catch(() => `report-${i}`)) || `report-${i}`).trim().slice(0, 40);
      await el.click().catch(() => {});
      await settle(page, 700);
      const sn = await shot(page, 'Reports', `deep-report-${lab}`, 'view');
      await checkVisible(page, 'Reports', lab, sn);
      recordFails(menu.label, lab, sn);
      // try export on each report page
      await stressExportClicks(page, `Reports:${lab}`);
    }
  }

  menuStats.push({
    menu: menu.label,
    tabs: tabs.length,
    deepClicks: deep.length,
    tabStress,
    exportStress,
  });
}

// Final stress: rapid menu hop Dashboard↔Attendance↔Leave↔Payroll
console.log('=== RAPID MENU HOP STRESS ===');
resetNet();
const hopT0 = Date.now();
for (let round = 0; round < 2; round++) {
  for (const href of ['/dashboard', '/attendance', '/leave', '/payroll', '/reports', '/employees']) {
    await page.goto(`${FE}${href}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(200);
  }
}
await settle(page, 800);
const hopSn = await shot(page, 'stress', 'rapid-menu-hop', 'settled');
const hopFails = failApis();
stressNotes.push({
  kind: 'rapid-menu-hop',
  ms: Date.now() - hopT0,
  failCount: hopFails.length,
  fails: hopFails.slice(0, 10).map((f) => `${f.status} ${f.method} ${f.url}`),
});
recordFails('stress', 'rapid-menu-hop', hopSn);
findings.push(`Rapid menu hop: fails=${hopFails.length} ${Date.now() - hopT0}ms`);

await browser.close();

// Write results + FINDINGS
const beIssues = issues.filter((i) => i.classification === 'BACKEND');
const feIssues = issues.filter((i) => i.classification === 'FRONTEND');

const results = {
  role: 'HR_ADMIN',
  email: EMAIL,
  shard: 'HR-CORE',
  menus: MENUS.map((m) => m.label),
  screenshotCount: screenshots.length,
  issueCount: issues.length,
  beCount: beIssues.length,
  feCount: feIssues.length,
  zerosEvidence,
  menuStats,
  stressNotes,
  issues,
  findings,
  screenshots,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));

const md = `# HR-CORE Stress + Deep E2E SHORT — FINDINGS

> Date: ${new Date().toISOString().slice(0, 10)}  
> Role: \`HR_ADMIN\` (\`${EMAIL}\` / tenant \`${TENANT}\`)  
> UI: \`${FE}\` · BE: \`${API}\` (Hostinger tunnel)  
> Screenshots: \`docs/e2e-ui-screenshots/stress/hr-core/\` (${screenshots.length} PNGs)  
> **No Render. No git commit.**

## Summary

| Metric | Value |
|--------|------:|
| Menus | ${MENUS.map((m) => m.label).join(', ')} |
| Screenshots | **${screenshots.length}** |
| Backend issues | **${beIssues.length}** |
| Frontend issues | **${feIssues.length}** |
| Attendance zeros bug | **${zerosEvidence?.bugReproduced ? 'REPRODUCED' : 'NOT REPRODUCED'}** |

## Attendance summary today zeros

\`\`\`
${JSON.stringify(zerosEvidence, null, 2)}
\`\`\`

## Stress notes

${stressNotes
  .map((n) => (typeof n === 'string' ? `- ${n}` : `- \`${n.kind || n.menu}\`: ${JSON.stringify(n)}`))
  .join('\n')}

## Issues

${
  issues.length === 0
    ? '_None recorded._'
    : issues
        .map(
          (i) => `### ${i.id}
- **Where:** ${i.where}
- **Why:** ${i.why}
- **Classification:** ${i.classification}
- **How to resolve:** ${i.how}
- **Screenshot:** \`${i.screenshot || 'n/a'}\`
- **Network:** \`${i.network || 'n/a'}\`
${i.aliases ? `- **Aliases:** ${i.aliases.join(', ')}` : ''}`,
        )
        .join('\n\n')
}

## Findings log

${findings.map((f) => `- ${f}`).join('\n')}

## Menu depth

${menuStats.map((m) => `- **${m.menu}**: tabs=${m.tabs} deepClicks=${m.deepClicks}`).join('\n')}
`;

fs.writeFileSync(path.join(OUT, 'FINDINGS.md'), md);
console.log('=== DONE ===');
console.log(`shots=${screenshots.length} issues=${issues.length} be=${beIssues.length} fe=${feIssues.length}`);
console.log(`zeros bug=${zerosEvidence?.bugReproduced}`);
console.log(`wrote ${path.join(OUT, 'FINDINGS.md')}`);
