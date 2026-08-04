/**
 * Gap-fill: wait for Approvals table, stress Approve/Return, capture 403s.
 * Continues PNG index after main stress run.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const SHOT = path.resolve('docs/e2e-ui-screenshots/stress/mgr-approvals');
const USER = 'aman@acme.test';
const PASS = 'Password123!';
const BE = process.env.BE_BASE || 'http://localhost:4000/api/v1';

let shotIdx = 44;
const apiFails = [];
const captures = [];
const issues = [];

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOT, file), fullPage: true }).catch(() => {});
  return file;
}

function note(sev, cls, where, why, screenshot, network, code) {
  const id = `ISSUE-MGR-STRESS-${String(issues.length + 10).padStart(2, '0')}`;
  issues.push({ id, severity: sev, classification: cls, where, why, screenshot, network, code });
  console.log(`  🐛 ${id} ${code || ''} ${why.slice(0, 120)}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

page.on('response', async (res) => {
  try {
    if (!/\/api\/.*timesheets/i.test(res.url())) return;
    if (res.status() < 400) return;
    let bodySnippet = '';
    try {
      bodySnippet = (await res.text()).slice(0, 320);
    } catch {}
    const row = {
      status: res.status(),
      method: res.request().method(),
      url: res.url(),
      bodySnippet,
      t: Date.now(),
    };
    apiFails.push(row);
    console.log(`  NET ${row.status} ${row.method} ${row.url.slice(-70)} | ${bodySnippet.slice(0, 120)}`);
  } catch {}
});

async function settle(ms = 500) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

async function dismiss() {
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(60);
  }
}

console.log('=== GAPFILL 403 ===');
await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
await page.locator('#email').fill(USER);
await page.locator('#password').fill(PASS);
await page.getByRole('button', { name: /sign in|log in/i }).click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });
await settle(600);
await shot(page, 'gap-login');

await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
await settle(500);
const appr = page.getByRole('tab', { name: /approv/i }).first();
await appr.click();
// Wait until table rows OR Approve buttons appear (not skeleton)
await page.getByRole('button', { name: /^approve$/i }).first().waitFor({ state: 'visible', timeout: 30000 });
await page.getByText(/HR Admin/i).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
await settle(800);
const view = await shot(page, 'gap-approvals-loaded');
const approveCount = await page.getByRole('button', { name: /^approve$/i }).count();
const returnCount = await page.getByRole('button', { name: /^return$/i }).count();
console.log(`loaded Approve=${approveCount} Return=${returnCount} shot=${view}`);

// STRESS rapid Approve (first 5) — sequential-fast with short delay so handlers fire
apiFails.length = 0;
const nApprove = Math.min(approveCount, 5);
for (let i = 0; i < nApprove; i++) {
  const btn = page.getByRole('button', { name: /^approve$/i }).nth(i);
  await btn.click({ timeout: 3000 }).catch((e) => console.log('approve click fail', i, e.message));
  await page.waitForTimeout(120);
}
await settle(1200);
const rapidApprShot = await shot(page, 'gap-stress-approve');
const appr403 = apiFails.filter((f) => f.status === 403);
captures.push({ kind: 'rapid-approve', n: nApprove, fails: [...apiFails], shot: rapidApprShot });
console.log(`rapid approve 403s=${appr403.length}`);
for (const f of appr403) {
  const code = /SELF_APPROVAL_FORBIDDEN/i.test(f.bodySnippet)
    ? 'SELF_APPROVAL_FORBIDDEN'
    : /NOT_TEAM_APPROVER/i.test(f.bodySnippet)
      ? 'NOT_TEAM_APPROVER'
      : 'OTHER_403';
  note(
    'CRITICAL',
    'FRONTEND',
    'Timesheets Approvals → STRESS Approve',
    `UI Approve on pending row → 403 ${code}`,
    rapidApprShot,
    `${f.status} ${f.method} ${f.url} | ${f.bodySnippet}`,
    code,
  );
}
await dismiss();

// Re-load Approvals for Return stress
await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
await settle(400);
await page.getByRole('tab', { name: /approv/i }).first().click();
await page.getByRole('button', { name: /^return$/i }).first().waitFor({ state: 'visible', timeout: 30000 });
await settle(600);

apiFails.length = 0;
const nReturn = Math.min(await page.getByRole('button', { name: /^return$/i }).count(), 4);
for (let i = 0; i < nReturn; i++) {
  // always click first visible Return (list may shrink); prefer HR Admin row first pass
  let btn;
  if (i === 0) {
    const hrRow = page.locator('tr, [data-row]').filter({ hasText: /HR Admin/i }).first();
    btn = (await hrRow.isVisible().catch(() => false))
      ? hrRow.getByRole('button', { name: /^return$/i }).first()
      : page.getByRole('button', { name: /^return$/i }).first();
  } else {
    btn = page.getByRole('button', { name: /^return$/i }).nth(Math.min(i, 2));
  }
  await btn.click({ timeout: 3000 }).catch((e) => console.log('return click fail', i, e.message));
  await page.waitForTimeout(200);
  const dialog = page.locator('[role="dialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    const modalShot = await shot(page, `gap-return-modal-${i}`);
    const ta = dialog.locator('textarea').first();
    if (await ta.isVisible().catch(() => false)) await ta.fill(`gap stress return ${i}`);
    const conf = dialog.getByRole('button', { name: /return week|return \d|reject|confirm|submit|^return$/i }).first();
    await conf.click().catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, `gap-return-result-${i}`);
    captures.push({ kind: 'return-modal', i, shot: modalShot });
  }
  await dismiss();
  // ensure still on approvals
  if (!(await page.getByRole('button', { name: /^return$/i }).first().isVisible().catch(() => false))) {
    await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: /approv/i }).first().click().catch(() => {});
    await page.getByRole('button', { name: /^return$/i }).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  }
}
const rapidRetShot = await shot(page, 'gap-stress-return');
const ret403 = apiFails.filter((f) => f.status === 403);
captures.push({ kind: 'rapid-return', n: nReturn, fails: [...apiFails], shot: rapidRetShot });
console.log(`rapid return 403s=${ret403.length}`);
for (const f of ret403) {
  const code = /SELF_APPROVAL_FORBIDDEN/i.test(f.bodySnippet)
    ? 'SELF_APPROVAL_FORBIDDEN'
    : /NOT_TEAM_APPROVER/i.test(f.bodySnippet)
      ? 'NOT_TEAM_APPROVER'
      : 'OTHER_403';
  note(
    'CRITICAL',
    'FRONTEND',
    'Timesheets Approvals → STRESS Return',
    `UI Return modal submit → 403 ${code}`,
    rapidRetShot,
    `${f.status} ${f.method} ${f.url} | ${f.bodySnippet}`,
    code,
  );
}

// Targeted HR Admin Approve (fresh)
await dismiss();
await page.goto(`${FE}/timesheets`, { waitUntil: 'domcontentloaded' });
await page.getByRole('tab', { name: /approv/i }).first().click();
await page.getByText(/HR Admin/i).first().waitFor({ state: 'visible', timeout: 20000 });
await settle(500);
apiFails.length = 0;
const hrRow = page.locator('tr').filter({ hasText: /HR Admin/i }).first();
await shot(page, 'gap-hr-row');
const hrApprove = hrRow.getByRole('button', { name: /^approve$/i }).first();
if (await hrApprove.isVisible().catch(() => false)) {
  await hrApprove.click();
  await settle(1000);
  const sn = await shot(page, 'gap-hr-approve-result');
  const hit = apiFails.find((f) => /NOT_TEAM_APPROVER/i.test(f.bodySnippet));
  if (hit) {
    note(
      'CRITICAL',
      'FRONTEND',
      'Timesheets Approvals → HR Admin Approve',
      'Approve shown for non-direct report; API 403 NOT_TEAM_APPROVER',
      sn,
      `${hit.status} ${hit.method} ${hit.url} | ${hit.bodySnippet}`,
      'NOT_TEAM_APPROVER',
    );
  } else {
    console.log('HR approve: no NOT_TEAM in UI net; fails=', apiFails.length, apiFails.map((f) => f.bodySnippet.slice(0, 80)));
  }
}

// API-level evidence for SELF (no own SUBMITTED in queue) + NOT_TEAM
const loginRes = await page.request.post(`${BE}/auth/login`, {
  data: { email: USER, password: PASS },
  headers: { 'x-tenant-key': 'acme-corp-001', 'content-type': 'application/json' },
});
const loginJson = await loginRes.json();
const token = loginJson?.data?.accessToken;
const apprRes = await page.request.get(`${BE}/timesheets/approvals?status=SUBMITTED`, {
  headers: { Authorization: `Bearer ${token}`, 'x-tenant-key': 'acme-corp-001' },
});
const apprJson = await apprRes.json();
const items = apprJson?.data || [];
const hr = items.find((x) => /HR Admin/i.test(x.employeeName || ''));
const aman = items.find((x) => /Aman/i.test(x.employeeName || ''));
console.log(`API queue=${items.length} hr=${!!hr} aman=${!!aman}`);

if (hr) {
  const r = await page.request.post(`${BE}/timesheets/${hr.id}/approve`, {
    data: { comment: 'gap api' },
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-key': 'acme-corp-001',
      'content-type': 'application/json',
    },
  });
  const body = await r.text();
  console.log('API HR approve', r.status(), body.slice(0, 200));
  captures.push({ kind: 'api-hr-approve', status: r.status(), body: body.slice(0, 400) });
  if (r.status() === 403 && /NOT_TEAM_APPROVER/i.test(body)) {
    note(
      'CRITICAL',
      'FRONTEND',
      'Timesheets Approvals → non-team (API corroboration)',
      'BE correctly returns NOT_TEAM_APPROVER; FE still lists Approve/Return for HR Admin',
      'gap-hr-row / gap-hr-approve-result',
      `403 POST /timesheets/${hr.id}/approve | ${body.slice(0, 280)}`,
      'NOT_TEAM_APPROVER',
    );
  }
}

// SELF: look for any aman timesheet id via my list
const mineRes = await page.request.get(`${BE}/timesheets?mine=1`, {
  headers: { Authorization: `Bearer ${token}`, 'x-tenant-key': 'acme-corp-001' },
}).catch(() => null);
let mineBody = '';
if (mineRes) mineBody = await mineRes.text();
console.log('mine status', mineRes?.status(), mineBody.slice(0, 200));

// Try known shallow id if still exists
const selfIds = ['cmr4fpp2m006ggrlntoghkxu0'];
for (const id of selfIds) {
  const r = await page.request.post(`${BE}/timesheets/${id}/reject`, {
    data: { comment: 'gap self' },
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-key': 'acme-corp-001',
      'content-type': 'application/json',
    },
  });
  const body = await r.text();
  console.log('API self reject', id, r.status(), body.slice(0, 200));
  captures.push({ kind: 'api-self-reject', id, status: r.status(), body: body.slice(0, 400) });
  if (r.status() === 403 && /SELF_APPROVAL_FORBIDDEN/i.test(body)) {
    note(
      'CRITICAL',
      'FRONTEND',
      'Timesheets Approvals → own row (API + shallow UI cross-ref)',
      'BE returns SELF_APPROVAL_FORBIDDEN; current Approvals queue has no Aman SUBMITTED row (UI still showed Approve/Return historically)',
      'cross-ref docs/e2e-ui-screenshots/manager/70-timesheet-return-result.png',
      `403 POST /timesheets/${id}/reject | ${body.slice(0, 280)}`,
      'SELF_APPROVAL_FORBIDDEN',
    );
  }
}

// Nested Leave Approvals + Team attendance quick depth
await page.goto(`${FE}/leave`, { waitUntil: 'domcontentloaded' });
await settle(500);
const leaveAppr = page.getByRole('tab', { name: /approv/i }).first();
if (await leaveAppr.isVisible().catch(() => false)) {
  await leaveAppr.click();
  await settle(600);
  await shot(page, 'gap-leave-approvals');
  const ab = page.getByRole('button', { name: /^approve$/i }).first();
  if (await ab.isVisible().catch(() => false)) {
    apiFails.length = 0;
    await ab.click().catch(() => {});
    await settle(700);
    await shot(page, 'gap-leave-approve-click');
    await dismiss();
  }
}
await page.goto(`${FE}/attendance`, { waitUntil: 'domcontentloaded' });
await settle(500);
for (const name of [/team/i, /regularization/i, /calendar/i, /table/i]) {
  const el = page.getByRole('tab', { name }).or(page.getByRole('button', { name })).first();
  if (await el.isVisible().catch(() => false)) {
    await el.click().catch(() => {});
    await settle(400);
    await shot(page, `gap-att-${String(name).replace(/[^a-z]/gi, '')}`);
  }
}

await browser.close();

const out = {
  shotIdx,
  issues,
  captures,
  apiFailCount: apiFails.length,
  finishedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(SHOT, 'results-gapfill.json'), JSON.stringify(out, null, 2));
console.log('=== GAPFILL DONE ===', 'issues', issues.length, 'shots', shotIdx);
