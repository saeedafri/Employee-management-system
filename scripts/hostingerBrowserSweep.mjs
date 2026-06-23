/** Robust Hostinger browser sweep — MSW off, FE → BFF → ems-api.saqibsaeed.cloud */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const FE = process.env.FE_BASE || 'http://localhost:3001';
const USER = process.env.QA_EMAIL || 'hr@acme.test';
const PASS = process.env.QA_PASS || 'Password123!';
const SHOT = process.env.SHOT_DIR || '/tmp/hostinger-sweep';
fs.mkdirSync(SHOT, { recursive: true });

const ROUTES = [
  '/dashboard', '/employees', '/departments', '/attendance', '/leave', '/timesheets',
  '/payroll', '/payroll/global', '/payroll/my-payslips', '/holidays', '/reports', '/analytics',
  '/permissions', '/announcements', '/assets', '/recruitment', '/performance',
  '/settings/company-profile', '/settings/locale', '/settings/working-hours',
  '/settings/pay/components', '/settings/pay/statutory-packs', '/settings/pay/legal-entities',
];

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
const apiFails = [];
page.on('response', (r) => {
  if (r.url().includes('/api/') && r.status() >= 500) apiFails.push(`${r.status()} ${r.url()}`);
});

await page.goto(`${FE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
await page.fill('#email', USER);
await page.fill('#password', PASS);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });
await page.waitForTimeout(2000);
console.log('LOGIN OK', page.url());

const results = [];
for (const route of ROUTES) {
  apiFails.length = 0;
  await page.goto(`${FE}${route}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const text = await page.evaluate(() => document.body.innerText);
  const err = /something went wrong|unexpected error|application error/i.test(text);
  const ok = !page.url().includes('/login') && !err && apiFails.length === 0;
  results.push({ route, ok, api5xx: [...apiFails] });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${route}${apiFails.length ? ' 5xx:' + apiFails.join(';') : ''}${err ? ' ERR-BOUNDARY' : ''}`);
}

const pass = results.filter((r) => r.ok).length;
console.log(`\nSWEEP ${USER}: ${pass}/${results.length} PASS`);
fs.writeFileSync(`${SHOT}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
process.exit(pass === results.length ? 0 : 1);
