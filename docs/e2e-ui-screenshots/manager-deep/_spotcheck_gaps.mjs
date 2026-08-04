/**
 * Spot-check missing manager-deep nested layers after resume browser crash.
 * aman@acme.test only. No Render. Continues PNG index from 395.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const SHOT = path.resolve('docs/e2e-ui-screenshots/manager-deep');
const USER = 'aman@acme.test';
const PASS = 'Password123!';

let shotIdx = 394;
const issues = [];
const results = [];
const apiFails = [];

async function shot(page, name) {
  shotIdx += 1;
  const file = `${String(shotIdx).padStart(3, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOT, file), fullPage: true }).catch(() => {});
  return file;
}

function note(sev, cls, where, why, screenshot, network = 'n/a') {
  const id = `ISSUE-MGR-SPOT-${String(issues.length + 1).padStart(2, '0')}`;
  issues.push({ id, severity: sev, classification: cls, where, why, screenshot, network });
  console.log(`  🐛 ${id} [${cls}/${sev}] ${where}: ${why}`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('response', async (res) => {
  try {
    if (res.status() >= 400 && /\/api\//.test(res.url())) {
      let bodySnippet = '';
      try {
        bodySnippet = (await res.text()).slice(0, 220);
      } catch {}
      apiFails.push({ status: res.status(), method: res.request().method(), url: res.url(), bodySnippet });
    }
  } catch {}
});

console.log('=== SPOTCHECK MANAGER gaps ===');
await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
await page.locator('#email').fill(USER);
await page.locator('#password').fill(PASS);
await page.getByRole('button', { name: /sign in|log in/i }).click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(800);
const loginShot = await shot(page, 'spot-login-ok');
results.push({ step: 'login', url: page.url(), shot: loginShot });

const probes = [
  { href: '/payout-methods', expect: /payout|bank|account|method/i, label: 'payout' },
  { href: '/payout-methods/approvals', expect: /payout|approv|access restricted|404/i, label: 'payout-approvals' },
  { href: '/reports', expect: /access restricted|restricted/i, label: 'reports', deny: true },
  { href: '/analytics', expect: /access restricted|restricted/i, label: 'analytics', deny: true },
  { href: '/permissions', expect: /access restricted|restricted|super admin/i, label: 'permissions', deny: true },
  { href: '/recruitment', expect: /access restricted|restricted/i, label: 'recruitment', deny: true },
  { href: '/performance', expect: /access restricted|restricted/i, label: 'performance', deny: true },
  { href: '/assets', expect: /access restricted|restricted/i, label: 'assets', deny: true },
  { href: '/settings', expect: /settings|company|locale|working/i, label: 'settings-land' },
  { href: '/settings/roles-permissions', expect: /404|not found|access restricted/i, label: 'settings-roles-permissions' },
  { href: '/settings/company-profile', expect: /access restricted|restricted|company/i, label: 'settings-company-profile' },
  { href: '/settings/pay/components', expect: /access restricted|restricted/i, label: 'settings-pay-components' },
  { href: '/announcements', expect: /announce|empty|no announcement/i, label: 'announcements' },
  { href: '/payroll', expect: /my pay|payslip/i, label: 'payroll-reopen' },
];

for (const p of probes) {
  apiFails.length = 0;
  await page.goto(`${FE}${p.href}`, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch((e) => {
    console.log('goto fail', p.href, e.message);
  });
  await page.waitForTimeout(900);
  const text = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
  const restricted = /access restricted/i.test(text);
  const notFound = /page not found|404/i.test(text);
  let access = 'OK';
  if (restricted) access = 'DENY';
  else if (notFound) access = '404';
  else if (p.deny && !restricted) access = 'LEAK';
  const sn = await shot(
    page,
    `spot-${p.label}-${access.toLowerCase()}`,
  );
  results.push({ href: p.href, url: page.url(), access, shot: sn, api4xx: [...apiFails] });
  console.log(`  ${p.href} → ${access} (${sn})`);

  if (p.deny && access === 'LEAK') {
    note('CRITICAL', 'FRONTEND', p.href, 'MANAGER accessed admin UI content (LEAK)', sn, page.url());
  }
  if (p.href === '/settings/roles-permissions' && access === '404') {
    note(
      'HIGH',
      'FRONTEND',
      '/settings/roles-permissions',
      '404 Page not found instead of RoleGate DENY',
      sn,
      page.url(),
    );
  }
}

// Payslip drawer + designation
apiFails.length = 0;
await page.goto(`${FE}/payroll`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
const payslipBtn = page.getByRole('button', { name: /view payslip|payslip|16-31|dec/i }).first();
if (await payslipBtn.isVisible().catch(() => false)) {
  await payslipBtn.click().catch(() => {});
  await page.waitForTimeout(1500);
  const sn = await shot(page, 'spot-payslip-drawer');
  const text = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
  if (/senior engineer\s*20\d{2}/i.test(text)) {
    note(
      'MEDIUM',
      'FRONTEND',
      'Payroll payslip / employee header',
      'Designation concatenated with date (e.g. Senior Engineer 2026-07-02)',
      sn,
    );
  }
  const drawer = await page.locator('[role="dialog"], aside, [data-state="open"]').first().innerText().catch(() => '');
  if (/payslip/i.test(drawer) && drawer.replace(/\s+/g, '').length < 40) {
    note('HIGH', 'FRONTEND', 'Payroll → payslip drawer', 'Payslip drawer stuck on skeleton / empty content', sn);
  }
  results.push({ step: 'payslip-drawer', shot: sn, api4xx: [...apiFails] });
}

// Timesheets approvals — confirm non-direct-report actions still visible
apiFails.length = 0;
await page.goto(`${FE}/timesheets?tab=approvals`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
const snTs = await shot(page, 'spot-timesheets-approvals');
const body = (await page.evaluate(() => document.body?.innerText || '').catch(() => '')) || '';
const approveCount = await page.getByRole('button', { name: /^approve$/i }).count().catch(() => 0);
results.push({
  step: 'timesheets-approvals',
  shot: snTs,
  approveButtons: approveCount,
  hasProgressEmpty: /PROGRESS/i.test(body),
  api4xx: [...apiFails],
});
console.log(`  timesheets approvals approveButtons=${approveCount}`);

const summary = {
  role: 'MANAGER',
  phase: 'spotcheck-gaps',
  user: USER,
  generatedAt: new Date().toISOString(),
  screenshotFrom: 395,
  screenshotTo: shotIdx,
  results,
  issues,
};
fs.writeFileSync(path.join(SHOT, 'results-spotcheck.json'), JSON.stringify(summary, null, 2));
console.log(`==== SPOT DONE shots=${shotIdx - 394} issues=${issues.length} ====`);
await browser.close();
