/**
 * Focused SUPER_ADMIN API probe via UI pages — longer settles, capture all 4xx/5xx
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const UI = 'http://localhost:3001';
const EMAIL = 'superadmin@acme.test';
const PASSWORD = 'Password123!';

const PAGES = [
  '/dashboard',
  '/employees',
  '/departments',
  '/attendance',
  '/timesheets',
  '/leave',
  '/holidays',
  '/payroll',
  '/payroll/my-payslips',
  '/payout-methods',
  '/payout-methods/approvals',
  '/reports',
  '/analytics',
  '/permissions',
  '/settings/company-profile',
  '/settings/authentication',
  '/settings/integration-email',
  '/recruitment',
  '/performance',
  '/assets',
  '/announcements',
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const fails = [];
  const consoleErrors = [];
  const uiErrors = [];

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push({ text: m.text(), url: page.url() });
  });
  page.on('response', async (res) => {
    if (res.status() < 400) return;
    const url = res.url();
    if (!/\/api\//.test(url)) return;
    if (/_next\//.test(url)) return;
    let body = '';
    try {
      body = (await res.text()).slice(0, 400);
    } catch {
      body = '';
    }
    fails.push({
      method: res.request().method(),
      url,
      status: res.status(),
      body,
      pageUrl: page.url(),
    });
  });

  await page.goto(`${UI}/login`);
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(1000);

  let idx = 0;
  for (const href of PAGES) {
    await page.goto(`${UI}${href}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(async () => {
      await page.goto(`${UI}${href}`, { waitUntil: 'domcontentloaded' });
    });
    await page.waitForTimeout(1500);
    idx += 1;
    const file = `probe-${String(idx).padStart(2, '0')}-${href.replace(/\//g, '_').replace(/^_/, '') || 'root'}.png`;
    await page.screenshot({ path: path.join(OUT, file), fullPage: false }).catch(() => {});

    // visible error banners / empty error text
    const texts = await page.locator('main').innerText().catch(() => '');
    if (/something went wrong|failed to|error loading|unauthorized|forbidden|no employee|access denied|not found|500|503/i.test(texts)) {
      const snip = texts.split('\n').filter((l) => /error|fail|denied|forbidden|employee record|not found|went wrong/i.test(l)).slice(0, 8);
      uiErrors.push({ href, snip, screenshot: file });
    }
  }

  // Dedup fails
  const uniq = [];
  const seen = new Set();
  for (const f of fails) {
    const k = `${f.method}|${f.status}|${f.url.split('?')[0]}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(f);
  }

  const out = { fails: uniq, consoleErrors: consoleErrors.slice(0, 50), uiErrors };
  fs.writeFileSync(path.join(OUT, '_probe-api.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ failCount: uniq.length, consoleCount: consoleErrors.length, uiErrorPages: uiErrors.length, fails: uniq }, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
