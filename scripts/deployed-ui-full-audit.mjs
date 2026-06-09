/**
 * Full deployed UI audit — capture network for known broken pages.
 * Run: node scripts/deployed-ui-full-audit.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const UI = 'https://ems-frontend-iota-ten.vercel.app';
const EVIDENCE = path.resolve('deployed-ui-full-audit-evidence');
const SHOTS = path.join(EVIDENCE, 'screenshots');
const NET = path.join(EVIDENCE, 'network-logs');
const CONSOLE = path.join(EVIDENCE, 'console-logs');
const TRACES = path.join(EVIDENCE, 'traces');

for (const d of [SHOTS, NET, CONSOLE, TRACES]) fs.mkdirSync(d, { recursive: true });

const HR = { email: 'mohammadsaeedafri9@gmail.com', password: 'Password123!' };

const PAGES = [
  { name: 'dashboard', path: '/dashboard', shot: 'dashboard' },
  { name: 'payslip-template', path: '/settings/pay/payslip-template', shot: 'settings_payslip_template' },
  { name: 'pay-schedules', path: '/settings/pay/schedules', shot: 'settings_pay_schedules' },
  { name: 'integration-email', path: '/settings/integration-email', shot: 'settings_email' },
  { name: 'integration-storage', path: '/settings/integration-storage', shot: 'settings_storage' },
  { name: 'integration-webhooks', path: '/settings/integration-webhooks', shot: 'settings_webhooks' },
  { name: 'departments', path: '/departments', shot: 'departments' },
  { name: 'payroll', path: '/payroll', shot: 'payroll_list' },
  { name: 'timesheets', path: '/timesheets', shot: 'timesheets_hr' },
];

async function login(page) {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('input[type="email"], input[name="email"]', HR.email);
  await page.fill('input[type="password"], input[name="password"]', HR.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

function wireCapture(page, bucket, consoleLog, pageErrors) {
  page.on('console', (msg) => consoleLog.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push({ message: err.message, stack: err.stack }));
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/')) return;
    let body = null;
    try {
      const ct = response.headers()['content-type'] || '';
      body = ct.includes('json') ? await response.json() : (await response.text()).slice(0, 2000);
    } catch { body = null; }
    let fromSW = false;
    try { fromSW = await response.fromServiceWorker(); } catch { /* noop */ }
    bucket.push({
      url, method: response.request().method(), status: response.status(),
      fromServiceWorker: fromSW, body,
    });
  });
}

async function hasError(page) {
  const texts = ['something went wrong', 'failed to load', 'tenant not found'];
  for (const t of texts) {
    if ((await page.locator(`text=/${t}/i`).count()) > 0) return true;
  }
  return false;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const network = [];
const consoleLog = [];
const pageErrors = [];
wireCapture(page, network, consoleLog, pageErrors);

await login(page);

const results = [];

for (const p of PAGES) {
  const pageNet = [];
  const sub = page;
  sub.removeAllListeners('response');
  wireCapture(sub, pageNet, consoleLog, pageErrors);

  await sub.goto(`${UI}${p.path}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await sub.waitForTimeout(2500);
  const err = await hasError(sub);
  await sub.screenshot({ path: path.join(SHOTS, `${p.shot}${err ? '_error' : '_loaded'}.png`), fullPage: true });
  const failed = pageNet.filter((r) => r.status >= 400);
  results.push({
    page: p.name,
    path: p.path,
    hasError: err,
    failedRequests: failed,
    apiCalls: pageNet.map((r) => ({ url: r.url.replace(UI, ''), status: r.status, fromSW: r.fromServiceWorker })),
  });
  fs.writeFileSync(path.join(NET, `${p.name}.json`), JSON.stringify(pageNet, null, 2));
  console.log(`[${err ? 'FAIL' : 'OK'}] ${p.path} — ${failed.length} failed API calls`);
}

// Employee profile tabs
const empNet = [];
page.removeAllListeners('response');
wireCapture(page, empNet, consoleLog, pageErrors);
await page.goto(`${UI}/employees`, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(2000);
const firstRow = page.locator('table tbody tr a, table tbody tr button').first();
if (await firstRow.count()) {
  await firstRow.click();
  await page.waitForTimeout(2000);
  for (const tab of ['Compensation', 'Documents', 'Activity']) {
    const tabNet = [];
    page.removeAllListeners('response');
    wireCapture(page, tabNet, consoleLog, pageErrors);
    const tabBtn = page.getByRole('tab', { name: new RegExp(tab, 'i') }).or(page.getByText(new RegExp(`^${tab}$`, 'i'))).first();
    if (await tabBtn.count()) {
      await tabBtn.click();
      await page.waitForTimeout(2500);
      const err = await hasError(page);
      await page.screenshot({ path: path.join(SHOTS, `employee_${tab.toLowerCase()}${err ? '_error' : '_loaded'}.png`), fullPage: true });
      const failed = tabNet.filter((r) => r.status >= 400);
      results.push({ page: `employee-${tab}`, hasError: err, failedRequests: failed, apiCalls: tabNet.map((r) => ({ url: r.url.replace(UI, ''), status: r.status })) });
      fs.writeFileSync(path.join(NET, `employee-${tab.toLowerCase()}.json`), JSON.stringify(tabNet, null, 2));
      console.log(`[${err ? 'FAIL' : 'OK'}] employee ${tab} — ${failed.length} failed`);
    }
  }
}

fs.writeFileSync(path.join(EVIDENCE, 'audit-summary.json'), JSON.stringify({ results, consoleLog, pageErrors }, null, 2));
fs.writeFileSync(path.join(CONSOLE, 'all.json'), JSON.stringify({ consoleLog, pageErrors }, null, 2));

await browser.close();
console.log('\nAudit complete. Evidence:', EVIDENCE);
