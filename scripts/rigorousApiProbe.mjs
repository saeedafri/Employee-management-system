/** Deep probe: capture failing API calls per role on key pages (no data deletion). */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const FE = 'http://localhost:3001';
const PASS = 'Password123!';
const OUT = './e2e-evidence/rigorous-local-20260623/api-probes.json';

const PROBES = [
  { role: 'MANAGER', email: 'aman@acme.test', path: '/attendance' },
  { role: 'EMPLOYEE', email: 'priya@acme.test', path: '/attendance' },
  { role: 'EMPLOYEE', email: 'priya@acme.test', path: '/timesheets' },
  { role: 'KWD_LITMUS', email: 'admin@kwd.test', path: '/timesheets', tenant: 'kwd-litmus-001' },
  { role: 'KWD_LITMUS', email: 'admin@kwd.test', path: '/holidays', tenant: 'kwd-litmus-001' },
];

const browser = await chromium.launch({ headless: true });
const findings = [];

for (const probe of PROBES) {
  const page = await (await browser.newContext()).newPage();
  const apis = [];
  page.on('response', async (r) => {
    const url = r.url();
    if (!url.includes('/api/')) return;
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    apis.push({ status: r.status(), method: r.request().method(), url, error: body?.error?.code || body?.error?.message || null });
  });
  await page.goto(`${FE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email, input[type="email"]', probe.email);
  await page.fill('#password, input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });
  await page.goto(`${FE}${probe.path}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  const bad = apis.filter((a) => a.status >= 400);
  findings.push({ ...probe, bad, total: apis.length });
  console.log(`\n${probe.role} ${probe.path}: ${bad.length} failing / ${apis.length} api calls`);
  for (const b of bad.slice(0, 12)) console.log(`  ${b.status} ${b.method} ${b.url.replace(FE,'')} ${b.error||''}`);
  await page.close();
}

await browser.close();
fs.mkdirSync('./e2e-evidence/rigorous-local-20260623', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(findings, null, 2));
console.log('\nWrote', OUT);
