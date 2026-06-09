/**
 * Reproduce View Payslip failure on deployed UI — capture network + screenshots.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const EVIDENCE = path.resolve('deployed-ui-deep-clickthrough-evidence');
const SCREENSHOTS = path.join(EVIDENCE, 'screenshots');
const NETWORK = path.join(EVIDENCE, 'network-logs');
const CONSOLE = path.join(EVIDENCE, 'console-logs');
const TRACES = path.join(EVIDENCE, 'traces');
const VIDEOS = path.join(EVIDENCE, 'videos');

for (const d of [SCREENSHOTS, NETWORK, CONSOLE, TRACES, VIDEOS]) {
  fs.mkdirSync(d, { recursive: true });
}

const UI_BASE = 'https://ems-frontend-iota-ten.vercel.app';
const HR_EMAIL = 'mohammadsaeedafri9@gmail.com';
const HR_PASSWORD = 'Password123!';

const networkLog = [];
const consoleLog = [];
const pageErrors = [];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: { dir: VIDEOS, size: { width: 1280, height: 720 } },
  });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });

  const page = await context.newPage();

  page.on('console', (msg) => {
    consoleLog.push({ type: msg.type(), text: msg.text(), location: msg.location() });
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ message: err.message, stack: err.stack });
  });
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/') && !url.includes('onrender.com')) return;
    let body = null;
    try {
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('json')) body = await response.json();
      else body = (await response.text()).slice(0, 2000);
    } catch {
      body = '<unreadable>';
    }
    let fromSW = false;
    try {
      fromSW = typeof response.fromServiceWorker === 'function' ? await response.fromServiceWorker() : false;
    } catch {
      fromSW = false;
    }
    networkLog.push({
      url,
      method: response.request().method(),
      status: response.status(),
      fromServiceWorker: fromSW,
      body,
    });
  });

  // Login
  await page.goto(`${UI_BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[type="email"], input[name="email"]', HR_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', HR_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {});

  // Payroll list
  await page.goto(`${UI_BASE}/payroll`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'payroll_list_loaded.png'), fullPage: true });

  // Click View on May 2026 run
  const mayRow = page.locator('tr, [data-testid*="run"], div').filter({ hasText: /May 2026|2026-05/ }).first();
  const viewBtn = page.getByRole('button', { name: /view/i }).or(page.getByRole('link', { name: /view/i })).first();
  if (await viewBtn.isVisible().catch(() => false)) {
    await viewBtn.click();
  } else {
    // Try clicking row or link containing May
    const link = page.locator('a, button').filter({ hasText: /May 2026|2026-05/ }).first();
    if (await link.isVisible().catch(() => false)) await link.click();
    else await page.goto(`${UI_BASE}/payroll/cmq5kdd6300aues8dg44o2fn8`, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'payroll_run_view_clicked.png'), fullPage: true });
  await page.screenshot({ path: path.join(SCREENSHOTS, 'payroll_detail_loaded.png'), fullPage: true });

  // Scroll to payslips section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(1000);

  // Open three-dot menu on first payslip
  const menuBtn = page.locator('[aria-label*="menu" i], button:has(svg), [data-testid*="menu"]').filter({ has: page.locator('svg') }).last();
  const moreBtn = page.getByRole('button', { name: /more|actions|options|\.\.\./i }).first();
  const dotsBtn = page.locator('button').filter({ hasText: /^$/ }).nth(5);

  await page.screenshot({ path: path.join(SCREENSHOTS, 'payroll_payslip_menu_opened_before.png'), fullPage: true });

  let menuOpened = false;
  for (const btn of [moreBtn, menuBtn, dotsBtn]) {
    if (await btn.isVisible().catch(() => false)) {
      await btn.click().catch(() => {});
      menuOpened = true;
      break;
    }
  }
  if (!menuOpened) {
    // Try row action menu in table
    const rowMenu = page.locator('table tbody tr').first().locator('button').last();
    if (await rowMenu.isVisible().catch(() => false)) await rowMenu.click();
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'payroll_payslip_menu_opened.png'), fullPage: true });

  // Before click View payslip
  await page.screenshot({ path: path.join(SCREENSHOTS, 'payroll_view_payslip_error_before_fix.png'), fullPage: true });

  const viewPayslip = page.getByRole('menuitem', { name: /view payslip/i })
    .or(page.getByText(/view payslip/i))
    .first();
  if (await viewPayslip.isVisible().catch(() => false)) {
    await viewPayslip.click();
  } else {
  // fallback: any menu item with payslip
    const item = page.locator('[role="menuitem"], li, button').filter({ hasText: /view payslip/i }).first();
    if (await item.isVisible().catch(() => false)) await item.click();
  }

  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SCREENSHOTS, 'payroll_view_payslip_after_click.png'), fullPage: true });

  const errorText = await page.locator('text=/something went wrong|failed to load payslip/i').count();
  console.log('Error boundary visible:', errorText > 0);

  await context.tracing.stop({ path: path.join(TRACES, 'view-payslip-repro.zip') });
  await browser.close();

  fs.writeFileSync(path.join(NETWORK, 'view-payslip-repro.json'), JSON.stringify(networkLog, null, 2));
  fs.writeFileSync(path.join(CONSOLE, 'view-payslip-repro.json'), JSON.stringify({ console: consoleLog, pageErrors }, null, 2));

  const payslipCalls = networkLog.filter((n) => n.url.includes('payslip'));
  console.log('\n=== PAYSLIP API CALLS ===');
  for (const c of payslipCalls) {
    console.log(`${c.method} ${c.status} SW=${c.fromServiceWorker} ${c.url}`);
    console.log('Body sample:', JSON.stringify(c.body).slice(0, 500));
  }
  console.log('\n=== ALL PAYROLL API CALLS ===');
  for (const c of networkLog.filter((n) => n.url.includes('payroll'))) {
    console.log(`${c.method} ${c.status} SW=${c.fromServiceWorker} ${c.url}`);
  }
  if (pageErrors.length) {
    console.log('\n=== PAGE ERRORS ===');
    pageErrors.forEach((e) => console.log(e.message, e.stack?.slice(0, 300)));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
