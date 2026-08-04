/**
 * STRESS + DEEP E2E SHORT — MANAGER approvals shard
 * aman@acme.test → Dashboard approvals, Timesheets Approvals (self/non-team),
 * Leave, Team attendance. Rapid Approve/Return to capture 403 races.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const SHOT = path.resolve('docs/e2e-ui-screenshots/stress/mgr-approvals');
const USER = 'aman@acme.test';
const PASS = 'Password123!';

fs.mkdirSync(SHOT, { recursive: true });
for (const f of fs.readdirSync(SHOT)) {
  if (f.endsWith('.png') || ['results.json', 'FINDINGS.md', '_run.log'].includes(f)) {
    // keep script; wipe prior run artifacts
    if (f.endsWith('.png') || f === 'results.json') fs.unlinkSync(path.join(SHOT, f));
  }
}

let shotIdx = 0;
const issues = [];
const findings = [];
const mutations = [];
const stressEvents = [];
let apiCalls = [];
let consoleErrors = [];

function slug(s) {
  return String(s || 'x')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${slug(name)}.png`;
  await page.screenshot({ path: path.join(SHOT, file), fullPage: true }).catch(() => {});
  return file;
}

function note(sev, cls, where, why, screenshot, network = 'n/a', extra = {}) {
  const id = `ISSUE-MGR-STRESS-${String(issues.length + 1).padStart(2, '0')}`;
  const row = { id, severity: sev, classification: cls, where, why, screenshot, network, ...extra };
  issues.push(row);
  console.log(`  🐛 ${id} [${cls}/${sev}] ${where}: ${why.slice(0, 140)}`);
  return id;
}

function finding(title, detail) {
  findings.push({ title, detail });
  console.log(`  ✓ ${title}: ${detail.slice(0, 160)}`);
}

async function settle(page, ms = 500) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function bodyText(page) {
  return (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
}

async function dismiss(page) {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(80);
  }
  const cancel = page.getByRole('button', { name: /^(cancel|close|dismiss|×)$/i }).first();
  if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
}

function resetNet() {
  apiCalls = [];
  consoleErrors = [];
}

function failApis() {
  return apiCalls.filter((c) => c.status >= 400);
}

function classify403(body) {
  if (/SELF_APPROVAL_FORBIDDEN/i.test(body)) return 'SELF_APPROVAL_FORBIDDEN';
  if (/NOT_TEAM_APPROVER/i.test(body)) return 'NOT_TEAM_APPROVER';
  return null;
}

async function confirmIfNeeded(page) {
  const dialog = page.locator('[role="dialog"]').first();
  if (!(await dialog.isVisible().catch(() => false))) return false;
  const ta = dialog.locator('textarea').first();
  if (await ta.isVisible().catch(() => false)) {
    await ta.fill('E2E mgr-approvals stress reason').catch(() => {});
  }
  const confirm = dialog
    .getByRole('button', {
      name: /^(approve|deny|reject|return|confirm|submit|yes|save|apply|continue|ok)$/i,
    })
    .first();
  if (await confirm.isVisible().catch(() => false)) {
    const label = ((await confirm.innerText().catch(() => 'confirm')) || 'confirm').trim();
    await confirm.click().catch(() => {});
    await settle(page, 600);
    return label;
  }
  return 'dialog-open';
}

async function clickAndCapture(page, btn, label) {
  resetNet();
  await btn.click({ timeout: 4000 }).catch(() => {});
  await settle(page, 400);
  const sn1 = await shot(page, `${label}-clicked`);
  const confirmed = await confirmIfNeeded(page);
  const sn2 = await shot(page, `${label}-result`);
  const fails = failApis();
  const codes = fails.map((f) => classify403(f.bodySnippet)).filter(Boolean);
  mutations.push({
    action: label,
    confirmed,
    screenshots: [sn1, sn2],
    fails: fails.slice(0, 6),
    codes,
  });
  for (const f of fails) {
    const code = classify403(f.bodySnippet);
    if (code === 'SELF_APPROVAL_FORBIDDEN') {
      note(
        'CRITICAL',
        'FRONTEND',
        `Timesheets Approvals → ${label}`,
        `UI exposes Approve/Return on own row; API 403 SELF_APPROVAL_FORBIDDEN`,
        sn2,
        `${f.status} ${f.method} ${f.url} | ${f.bodySnippet}`,
        { code },
      );
    } else if (code === 'NOT_TEAM_APPROVER') {
      note(
        'CRITICAL',
        'FRONTEND',
        `Timesheets Approvals → ${label}`,
        `UI exposes Approve/Return on non-team row; API 403 NOT_TEAM_APPROVER`,
        sn2,
        `${f.status} ${f.method} ${f.url} | ${f.bodySnippet}`,
        { code },
      );
    } else if (f.status >= 500) {
      note('HIGH', 'BACKEND', label, `API ${f.status} ${f.method} ${f.url}`, sn2, f.bodySnippet);
    }
  }
  await dismiss(page);
  return { sn1, sn2, codes, fails };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('response', async (res) => {
  try {
    if (!/\/api\//.test(res.url())) return;
    let bodySnippet = '';
    if (res.status() >= 400) {
      try {
        bodySnippet = (await res.text()).slice(0, 280);
      } catch {}
    }
    apiCalls.push({
      status: res.status(),
      method: res.request().method(),
      url: res.url(),
      bodySnippet,
    });
  } catch {}
});

console.log('=== MGR-APPROVALS STRESS START ===');

// —— LOGIN ——
await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
await shot(page, 'login-form');
await page.locator('#email').fill(USER);
await page.locator('#password').fill(PASS);
await shot(page, 'login-filled');
await page.getByRole('button', { name: /sign in|log in/i }).click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 }).catch(() => {});
await settle(page, 800);
const loginShot = await shot(page, 'login-dashboard');
finding('Login', `aman@acme.test → ${page.url()} (${loginShot})`);

// —— DASHBOARD APPROVALS (nested) ——
console.log('→ Dashboard approvals');
await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
await settle(page, 700);
await shot(page, 'dashboard-land');

const dashText = await bodyText(page);
await shot(page, 'dashboard-approvals-section');

const bulk = page.getByRole('button', { name: /bulk approve/i }).first();
if (await bulk.isVisible().catch(() => false)) {
  resetNet();
  await bulk.click().catch(() => {});
  await settle(page, 500);
  const sn = await shot(page, 'dashboard-bulk-approve-open');
  const t = await bodyText(page);
  if (/bulk approve leave|no pending leave/i.test(t)) {
    note(
      'HIGH',
      'FRONTEND',
      'Dashboard → Bulk approve',
      'Bulk approve opens leave-only modal (regs may still be pending)',
      sn,
    );
  }
  await dismiss(page);
}

// Nested dashboard links
for (const linkName of [/view team/i, /leave/i, /attendance/i, /approvals/i, /pending/i]) {
  const link = page.locator('main').getByRole('link', { name: linkName }).first();
  if (!(await link.isVisible().catch(() => false))) continue;
  resetNet();
  await link.click().catch(() => {});
  await settle(page, 600);
  await shot(page, `dashboard-link-${slug(String(linkName))}`);
  await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await settle(page, 350);
}

// Dashboard Approve/Deny (one each — leave pending if possible)
for (const name of ['Deny', 'Approve']) {
  const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
  if (!(await btn.isVisible().catch(() => false))) continue;
  await clickAndCapture(page, btn, `dashboard-${name.toLowerCase()}`);
  await page.goto(`${FE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await settle(page, 400);
}
finding('Dashboard', `approvals section + bulk + links explored; text has pending=${/pending/i.test(dashText)}`);

// —— TIMESHEETS APPROVALS (stress) ——
console.log('→ Timesheets Approvals STRESS');
await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
await settle(page, 700);
await shot(page, 'timesheets-land');

// Tabs nested
const tsTabs = page.locator('[role="tab"]');
const tsTabN = Math.min(await tsTabs.count().catch(() => 0), 8);
for (let i = 0; i < tsTabN; i++) {
  const tab = tsTabs.nth(i);
  const label = ((await tab.innerText().catch(() => `tab-${i}`)) || `tab-${i}`).trim().slice(0, 40);
  await tab.click().catch(() => {});
  await settle(page, 400);
  await shot(page, `timesheets-tab-${slug(label)}`);
}

const appr = page.getByRole('tab', { name: /approv/i }).first();
if (await appr.isVisible().catch(() => false)) {
  await appr.click().catch(() => {});
  await settle(page, 700);
} else {
  // try route/query
  await page.goto(`${FE}/timesheets?tab=approvals`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await settle(page, 700);
}
const apprView = await shot(page, 'timesheets-approvals-view');
const apprText = await bodyText(page);
finding(
  'Approvals queue',
  `visible names: ${[/aman kumar/i.test(apprText) ? 'Aman(self)' : '', /hr admin/i.test(apprText) ? 'HR Admin' : '', /priya/i.test(apprText) ? 'Priya' : ''].filter(Boolean).join(', ') || 'see screenshot'} (${apprView})`,
);

// Collect row employee names near Approve buttons
const rowMeta = await page.evaluate(() => {
  const rows = [];
  document.querySelectorAll('main tr, main [data-row], main li').forEach((el) => {
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
    if (!/approve/i.test(t)) return;
    if (t.length < 8 || t.length > 400) return;
    rows.push(t.slice(0, 180));
  });
  return rows.slice(0, 12);
});
finding('Approvals rows', JSON.stringify(rowMeta).slice(0, 400));

// STRESS: rapid Approve on first N visible buttons (no wait between clicks)
const approveBtns = page.getByRole('button', { name: /^approve$/i });
const approveCount = Math.min(await approveBtns.count().catch(() => 0), 6);
console.log(`  Stress Approve count=${approveCount}`);
const stressStart = Date.now();
resetNet();
const rapidApprovePromises = [];
for (let i = 0; i < approveCount; i++) {
  rapidApprovePromises.push(
    approveBtns
      .nth(i)
      .click({ timeout: 2500 })
      .catch((e) => ({ err: e.message })),
  );
}
await Promise.all(rapidApprovePromises);
await settle(page, 900);
// Confirm any open dialogs from rapid clicks
for (let k = 0; k < 4; k++) {
  const d = page.locator('[role="dialog"]').first();
  if (!(await d.isVisible().catch(() => false))) break;
  await confirmIfNeeded(page);
  await dismiss(page);
}
const stressApproveShot = await shot(page, 'stress-rapid-approve-burst');
const stressApproveFails = failApis().filter((f) => /timesheet/i.test(f.url) && f.status >= 400);
stressEvents.push({
  kind: 'rapid-approve',
  count: approveCount,
  ms: Date.now() - stressStart,
  fails: stressApproveFails,
  screenshot: stressApproveShot,
});
for (const f of stressApproveFails) {
  const code = classify403(f.bodySnippet);
  if (code) {
    note(
      'CRITICAL',
      'FRONTEND',
      'Timesheets Approvals → STRESS rapid Approve',
      `Burst click captured 403 ${code}`,
      stressApproveShot,
      `${f.status} ${f.method} ${f.url} | ${f.bodySnippet}`,
      { code, stress: true },
    );
  }
}
finding(
  'Stress rapid Approve',
  `${approveCount} clicks in ${Date.now() - stressStart}ms → ${stressApproveFails.length} 4xx; codes=${[
    ...new Set(stressApproveFails.map((f) => classify403(f.bodySnippet)).filter(Boolean)),
  ].join(',')}`,
);

// Re-open Approvals for Return stress
await dismiss(page);
await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
await settle(page, 500);
const appr2 = page.getByRole('tab', { name: /approv/i }).first();
if (await appr2.isVisible().catch(() => false)) await appr2.click().catch(() => {});
await settle(page, 600);

const returnBtns = page.getByRole('button', { name: /^return$/i });
const returnCount = Math.min(await returnBtns.count().catch(() => 0), 5);
console.log(`  Stress Return count=${returnCount}`);
const retStart = Date.now();
resetNet();
for (let i = 0; i < returnCount; i++) {
  // sequential-fast: open return, fill, submit quickly
  const btn = returnBtns.nth(i);
  if (!(await btn.isVisible().catch(() => false))) break;
  await btn.click({ timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(180);
  const dialog = page.locator('[role="dialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    const ta = dialog.locator('textarea').first();
    if (await ta.isVisible().catch(() => false)) await ta.fill(`stress return ${i}`).catch(() => {});
    const conf = dialog.getByRole('button', { name: /^(return|confirm|submit|reject)$/i }).first();
    if (await conf.isVisible().catch(() => false)) await conf.click().catch(() => {});
    await page.waitForTimeout(250);
  }
  await dismiss(page);
  // re-find Approvals if navigated away
  if (!/timesheet/i.test(page.url())) {
    await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
    await settle(page, 400);
    const t = page.getByRole('tab', { name: /approv/i }).first();
    if (await t.isVisible().catch(() => false)) await t.click().catch(() => {});
    await settle(page, 350);
  }
}
const stressReturnShot = await shot(page, 'stress-rapid-return-burst');
const stressReturnFails = failApis().filter((f) => /timesheet/i.test(f.url) && f.status >= 400);
stressEvents.push({
  kind: 'rapid-return',
  count: returnCount,
  ms: Date.now() - retStart,
  fails: stressReturnFails,
  screenshot: stressReturnShot,
});
for (const f of stressReturnFails) {
  const code = classify403(f.bodySnippet);
  if (code) {
    note(
      'CRITICAL',
      'FRONTEND',
      'Timesheets Approvals → STRESS rapid Return',
      `Fast Return captured 403 ${code}`,
      stressReturnShot,
      `${f.status} ${f.method} ${f.url} | ${f.bodySnippet}`,
      { code, stress: true },
    );
  }
}
finding(
  'Stress rapid Return',
  `${returnCount} returns in ${Date.now() - retStart}ms → ${stressReturnFails.length} 4xx; codes=${[
    ...new Set(stressReturnFails.map((f) => classify403(f.bodySnippet)).filter(Boolean)),
  ].join(',')}`,
);

// Targeted: try Approve on Aman (self) and HR Admin (non-team) if still present
await dismiss(page);
await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
await settle(page, 500);
const appr3 = page.getByRole('tab', { name: /approv/i }).first();
if (await appr3.isVisible().catch(() => false)) await appr3.click().catch(() => {});
await settle(page, 600);
await shot(page, 'timesheets-approvals-targeted');

for (const target of [
  { name: /aman kumar/i, expect: 'SELF_APPROVAL_FORBIDDEN', label: 'self-aman' },
  { name: /hr admin/i, expect: 'NOT_TEAM_APPROVER', label: 'nonteam-hr' },
  { name: /priya/i, expect: 'OK_OR_200', label: 'team-priya' },
]) {
  const row = page.locator('main tr, main [data-row]').filter({ hasText: target.name }).first();
  if (!(await row.isVisible().catch(() => false))) {
    finding(`Target ${target.label}`, 'row not visible in current Approvals queue');
    continue;
  }
  await shot(page, `target-row-${target.label}`);
  const approve = row.getByRole('button', { name: /^approve$/i }).first();
  if (await approve.isVisible().catch(() => false)) {
    const r = await clickAndCapture(page, approve, `target-approve-${target.label}`);
    finding(
      `Target Approve ${target.label}`,
      `expect=${target.expect} got=${r.codes.join(',') || 'none'} fails=${r.fails.length}`,
    );
  }
  // re-open for Return
  await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
  await settle(page, 400);
  const t4 = page.getByRole('tab', { name: /approv/i }).first();
  if (await t4.isVisible().catch(() => false)) await t4.click().catch(() => {});
  await settle(page, 400);
  const row2 = page.locator('main tr, main [data-row]').filter({ hasText: target.name }).first();
  if (await row2.isVisible().catch(() => false)) {
    const retBtn = row2.getByRole('button', { name: /^return$/i }).first();
    if (await retBtn.isVisible().catch(() => false)) {
      const r = await clickAndCapture(page, retBtn, `target-return-${target.label}`);
      finding(
        `Target Return ${target.label}`,
        `expect=${target.expect} got=${r.codes.join(',') || 'none'} fails=${r.fails.length}`,
      );
    }
  }
}

// —— LEAVE (nested) ——
console.log('→ Leave nested');
await page.goto(`${FE}/leave`, { waitUntil: 'domcontentloaded' });
await settle(page, 700);
await shot(page, 'leave-land');
const leaveTabs = page.locator('[role="tab"]');
const leaveTabN = Math.min(await leaveTabs.count().catch(() => 0), 8);
for (let i = 0; i < leaveTabN; i++) {
  const tab = leaveTabs.nth(i);
  const label = ((await tab.innerText().catch(() => `tab-${i}`)) || `tab-${i}`).trim().slice(0, 40);
  await tab.click().catch(() => {});
  await settle(page, 400);
  await shot(page, `leave-tab-${slug(label)}`);
  // nested buttons in tab
  const btns = page.locator('main button:visible');
  const bn = Math.min(await btns.count().catch(() => 0), 6);
  for (let j = 0; j < bn; j++) {
    const b = btns.nth(j);
    const t = ((await b.innerText().catch(() => '')) || '').trim().slice(0, 40);
    if (!t || /cancel|close/i.test(t)) continue;
    if (/approve|deny|reject|return|request|new|filter|export|calendar/i.test(t)) {
      resetNet();
      await b.click({ timeout: 3000 }).catch(() => {});
      await settle(page, 350);
      await shot(page, `leave-n2-${slug(t)}`);
      await confirmIfNeeded(page);
      await dismiss(page);
    }
  }
}
finding('Leave', `${leaveTabN} tabs nested + action buttons`);

// —— TEAM ATTENDANCE ——
console.log('→ Team attendance');
await page.goto(`${FE}/attendance`, { waitUntil: 'domcontentloaded' });
await settle(page, 700);
await shot(page, 'attendance-land');
const attTabs = page.locator('[role="tab"]');
const attTabN = Math.min(await attTabs.count().catch(() => 0), 8);
for (let i = 0; i < attTabN; i++) {
  const tab = attTabs.nth(i);
  const label = ((await tab.innerText().catch(() => `tab-${i}`)) || `tab-${i}`).trim().slice(0, 40);
  await tab.click().catch(() => {});
  await settle(page, 400);
  await shot(page, `attendance-tab-${slug(label)}`);
}
const teamTab = page.getByRole('tab', { name: /team/i }).first();
if (await teamTab.isVisible().catch(() => false)) {
  await teamTab.click().catch(() => {});
  await settle(page, 600);
  await shot(page, 'attendance-team-view');
}
// Regularization approve/deny if present
for (const name of ['Approve', 'Deny', 'Reject']) {
  const btn = page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first();
  if (!(await btn.isVisible().catch(() => false))) continue;
  await clickAndCapture(page, btn, `attendance-reg-${name.toLowerCase()}`);
}
// Nested filter/calendar buttons
for (const name of [/calendar/i, /table/i, /regularization/i, /filter/i, /this month|month/i]) {
  const btn = page.getByRole('button', { name }).first();
  if (!(await btn.isVisible().catch(() => false))) continue;
  resetNet();
  await btn.click().catch(() => {});
  await settle(page, 350);
  await shot(page, `attendance-n2-${slug(String(name))}`);
  await dismiss(page);
}
finding('Team attendance', `${attTabN} tabs + team view + reg actions`);

await browser.close();

// Deduplicate issues by code+where
const seen = new Set();
const uniqIssues = [];
for (const i of issues) {
  const k = `${i.code || i.why}|${i.where}|${i.classification}`;
  if (seen.has(k)) continue;
  seen.add(k);
  uniqIssues.push(i);
}

const selfHits = uniqIssues.filter((i) => i.code === 'SELF_APPROVAL_FORBIDDEN');
const nonTeamHits = uniqIssues.filter((i) => i.code === 'NOT_TEAM_APPROVER');
const all403 = [
  ...stressEvents.flatMap((e) => e.fails || []),
  ...mutations.flatMap((m) => m.fails || []),
].filter((f) => f.status === 403);

const results = {
  role: 'MANAGER',
  user: USER,
  shotCount: shotIdx,
  issueCount: uniqIssues.length,
  issues: uniqIssues,
  findings,
  mutations,
  stressEvents,
  selfApprovalHits: selfHits.length,
  notTeamApproverHits: nonTeamHits.length,
  total403: all403.length,
  finishedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(SHOT, 'results.json'), JSON.stringify(results, null, 2));

const md = [];
md.push('# FINDINGS — MANAGER Approvals Stress (SHORT)');
md.push('');
md.push(`**Tester:** \`${USER}\` · FE \`${FE}\` · ${results.finishedAt}`);
md.push(`**Screenshots:** \`${SHOT}/\` (${shotIdx} PNGs)`);
md.push(`**Focus:** Dashboard approvals · Timesheets Approvals (self + non-team) · Leave · Team attendance`);
md.push(`**Stress:** rapid Approve (${stressEvents.find((e) => e.kind === 'rapid-approve')?.count ?? 0}) + rapid Return (${stressEvents.find((e) => e.kind === 'rapid-return')?.count ?? 0})`);
md.push('');
md.push('## Summary');
md.push('');
md.push(`| Metric | Value |`);
md.push(`|--------|-------|`);
md.push(`| Screenshots | ${shotIdx} |`);
md.push(`| Unique issues | ${uniqIssues.length} |`);
md.push(`| SELF_APPROVAL_FORBIDDEN captures | ${selfHits.length} |`);
md.push(`| NOT_TEAM_APPROVER captures | ${nonTeamHits.length} |`);
md.push(`| Total 403 API observations | ${all403.length} |`);
md.push('');
md.push('## Observations');
md.push('');
for (const f of findings) {
  md.push(`- **${f.title}:** ${f.detail}`);
}
md.push('');
md.push('## Issues');
md.push('');
if (!uniqIssues.length) {
  md.push('_No new issues recorded this run (queue may have lacked self/non-team rows)._');
} else {
  for (const i of uniqIssues) {
    md.push(`### ${i.id}`);
    md.push(`- **Where:** ${i.where}`);
    md.push(`- **Why:** ${i.why}`);
    md.push(`- **Classification:** ${i.classification} · **Severity:** ${i.severity}`);
    md.push(`- **Screenshot:** \`${i.screenshot}\``);
    md.push(`- **Network:** ${i.network}`);
    if (i.code) md.push(`- **Code:** \`${i.code}\``);
    md.push('');
  }
}
md.push('## Stress events');
md.push('');
md.push('```json');
md.push(JSON.stringify(stressEvents, null, 2).slice(0, 6000));
md.push('```');
md.push('');
md.push('## Cross-ref');
md.push('');
md.push('- Shallow: `docs/e2e-ui-screenshots/manager/` ISSUE-MGR-02 (`SELF_APPROVAL_FORBIDDEN`)');
md.push('- Deep: `docs/e2e-ui-screenshots/manager-deep/` ISSUE-MGR-09 (`NOT_TEAM_APPROVER`)');
md.push('- Contracts: `docs/E2E_STRESS_FRONTEND_CONTRACT.md` / `docs/E2E_STRESS_BACKEND_CONTRACT.md` → `## MGR-APPROVALS`');
fs.writeFileSync(path.join(SHOT, 'FINDINGS.md'), md.join('\n'));

console.log('=== MGR-APPROVALS STRESS DONE ===');
console.log(`shots=${shotIdx} issues=${uniqIssues.length} SELF=${selfHits.length} NOT_TEAM=${nonTeamHits.length}`);
