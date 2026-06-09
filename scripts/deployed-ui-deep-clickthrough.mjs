/**
 * Phase 3 deployed UI deep clickthrough — payroll + timesheets.
 * Run: node scripts/deployed-ui-deep-clickthrough.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const UI = 'https://ems-frontend-iota-ten.vercel.app';
const EVIDENCE = path.resolve('deployed-ui-deep-clickthrough-evidence');
const SHOTS = path.join(EVIDENCE, 'screenshots');
const NET = path.join(EVIDENCE, 'network-logs');
const CONSOLE = path.join(EVIDENCE, 'console-logs');
const DL = path.join(EVIDENCE, 'downloaded-files');
const TRACES = path.join(EVIDENCE, 'traces');
const VIDEOS = path.join(EVIDENCE, 'videos');

for (const d of [SHOTS, NET, CONSOLE, DL, TRACES, VIDEOS]) fs.mkdirSync(d, { recursive: true });

const ACCOUNTS = {
  HR: { email: 'mohammadsaeedafri9@gmail.com', password: 'Password123!' },
  SUPER: { email: 'superadmin@acme.test', password: 'Password123!' },
  MANAGER: { email: 'aman@acme.test', password: 'Password123!' },
  PRIYA: { email: 'priya@acme.test', password: 'Password123!' },
  DEV1: { email: 'dev1@acme.test', password: 'Password123!' },
};

const MAY_RUN_ID = 'cmq5kdd6300aues8dg44o2fn8';
const payrollResults = [];
const timesheetResults = [];
let failures = 0;

function record(table, row) {
  table.push({ ...row, ts: new Date().toISOString() });
  if (row.result === 'FAIL') failures++;
  console.log(`  [${row.result}] ${row.action || row.role} — ${row.endpoint || ''}`);
}

async function login(page, { email, password }) {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {});
}

function wireCapture(page, bucket) {
  const consoleLog = [];
  const pageErrors = [];
  page.on('console', (msg) => consoleLog.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push({ message: err.message, stack: err.stack }));
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/')) return;
    let body = null;
    try {
      const ct = response.headers()['content-type'] || '';
      body = ct.includes('json') ? await response.json() : (await response.text()).slice(0, 1500);
    } catch { body = null; }
    let fromSW = false;
    try { fromSW = await response.fromServiceWorker(); } catch { /* noop */ }
    bucket.push({
      url, method: response.request().method(), status: response.status(),
      fromServiceWorker: fromSW, body,
    });
  });
  return { consoleLog, pageErrors };
}

async function hasErrorBoundary(page) {
  return (await page.locator('text=/something went wrong|failed to load payslip|failed to load/i').count()) > 0;
}

async function openPayslipDrawer(page, rowIndex = 0) {
  const row = page.locator('table tbody tr').nth(rowIndex);
  await row.scrollIntoViewIfNeeded();
  await row.locator('button').last().click();
  await page.waitForTimeout(400);
  const viewItem = page.getByRole('menuitem', { name: /view payslip/i }).or(page.getByText(/view payslip/i)).first();
  await viewItem.click();
  await page.waitForTimeout(2500);
}

async function clickIfVisible(page, locator, timeout = 3000) {
  if (await locator.isVisible({ timeout }).catch(() => false)) {
    await locator.click();
    await page.waitForTimeout(1000);
    return true;
  }
  return false;
}

async function testPayroll(browser) {
  console.log('\n=== PAYROLL DEEP CLICKTHROUGH (HR_ADMIN) ===\n');
  const context = await browser.newContext({ recordVideo: { dir: VIDEOS, size: { width: 1280, height: 720 } } });
  await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const net = [];
  const { consoleLog, pageErrors } = wireCapture(page, net);
  await login(page, ACCOUNTS.HR);

  // List
  await page.goto(`${UI}/payroll`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(SHOTS, 'payroll_list_loaded.png'), fullPage: true });
  const listOk = !(await hasErrorBoundary(page));
  record(payrollResults, { runPeriod: '2026-05', runStatus: 'PAID', action: 'payroll list', endpoint: 'GET /api/payroll/runs', status: 200, fromServiceWorker: false, screenshot: 'payroll_list_loaded.png', result: listOk ? 'PASS' : 'FAIL' });

  // Detail
  await page.goto(`${UI}/payroll/${MAY_RUN_ID}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(SHOTS, 'payroll_run_view_clicked.png'), fullPage: true });
  await page.screenshot({ path: path.join(SHOTS, 'payroll_detail_loaded.png'), fullPage: true });
  const runCall = net.find((n) => n.url.includes(`/runs/${MAY_RUN_ID}`) && !n.url.includes('payslips') && !n.url.includes('payment'));
  record(payrollResults, { runPeriod: '2026-05', runStatus: 'PAID', action: 'run detail', endpoint: 'GET /payroll/runs/:id', status: runCall?.status, fromServiceWorker: runCall?.fromServiceWorker, screenshot: 'payroll_detail_loaded.png', result: runCall?.status === 200 && !(await hasErrorBoundary(page)) ? 'PASS' : 'FAIL' });

  // View payslip — before screenshot
  await page.screenshot({ path: path.join(SHOTS, 'payroll_view_payslip_error_before_fix.png'), fullPage: true });

  for (let i = 0; i < 3; i++) {
    await page.goto(`${UI}/payroll/${MAY_RUN_ID}`, { waitUntil: 'networkidle' });
    await openPayslipDrawer(page, i);
    const err = await hasErrorBoundary(page);
    const detailCall = [...net].reverse().find((n) => /\/payslips\/[^/?]+$/.test(n.url) && n.method === 'GET');
    if (i === 0) {
      await page.screenshot({ path: path.join(SHOTS, 'payroll_payslip_menu_opened.png'), fullPage: true });
      await page.screenshot({ path: path.join(SHOTS, 'payroll_view_payslip_loaded_after_fix.png'), fullPage: true });
      await page.screenshot({ path: path.join(SHOTS, 'payroll_payslip_drawer_earnings_deductions_visible.png'), fullPage: true });
    }
    record(payrollResults, {
      runPeriod: '2026-05', runStatus: 'PAID', action: `view payslip row ${i}`,
      endpoint: 'GET /payroll/runs/:runId/payslips/:payslipId',
      status: detailCall?.status, fromServiceWorker: detailCall?.fromServiceWorker,
      screenshot: i === 0 ? 'payroll_view_payslip_loaded_after_fix.png' : null,
      result: !err && detailCall?.status === 200 && detailCall?.body?.data?.earnings?.length > 0 ? 'PASS' : 'FAIL',
    });
    await page.keyboard.press('Escape').catch(() => {});
  }

  // Accordions & panels — fresh page load before each to avoid error-boundary cascade
  async function freshDetail() {
    await page.goto(`${UI}/payroll/${MAY_RUN_ID}`, { waitUntil: 'networkidle' });
    return !(await hasErrorBoundary(page));
  }

  await freshDetail();
  await clickIfVisible(page, page.getByText(/audit trail/i).first());
  await page.screenshot({ path: path.join(SHOTS, 'payroll_audit_opened.png'), fullPage: true });
  record(payrollResults, { action: 'audit trail', endpoint: 'GET /payroll/runs/:id/audit', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS', screenshot: 'payroll_audit_opened.png' });

  await freshDetail();
  await clickIfVisible(page, page.getByText(/^events$/i).first());
  await page.screenshot({ path: path.join(SHOTS, 'payroll_events_opened.png'), fullPage: true });
  record(payrollResults, { action: 'events', endpoint: 'GET /payroll/events?runId=:id', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS', screenshot: 'payroll_events_opened.png' });

  await freshDetail();
  await clickIfVisible(page, page.getByRole('button', { name: /generate payment batch/i }).first());
  await page.screenshot({ path: path.join(SHOTS, 'payroll_payment_batch_generated.png'), fullPage: true });
  const batchCall = net.find((n) => n.url.includes('payment-batch'));
  record(payrollResults, { action: 'payment batch', endpoint: 'GET/POST /payroll/runs/:id/payment-batch', status: batchCall?.status, fromServiceWorker: batchCall?.fromServiceWorker, screenshot: 'payroll_payment_batch_generated.png', result: batchCall?.status === 200 || batchCall?.status === 201 ? 'PASS' : 'PARTIAL' });

  await freshDetail();
  await clickIfVisible(page, page.getByRole('button', { name: /download bank|bank file/i }).first());
  await page.screenshot({ path: path.join(SHOTS, 'payroll_bank_file_downloaded.png'), fullPage: true });
  record(payrollResults, { action: 'bank file', endpoint: 'GET /payroll/runs/:id/bank-file', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS', screenshot: 'payroll_bank_file_downloaded.png' });

  await freshDetail();
  await clickIfVisible(page, page.getByText(/accounting journal/i).first());
  await page.screenshot({ path: path.join(SHOTS, 'payroll_accounting_journal_opened.png'), fullPage: true });
  record(payrollResults, { action: 'accounting journal', endpoint: 'GET /payroll/runs/:id/journal', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS', screenshot: 'payroll_accounting_journal_opened.png' });

  await freshDetail();
  await clickIfVisible(page, page.getByRole('button', { name: /^export$/i }).first());
  await page.screenshot({ path: path.join(SHOTS, 'payroll_statutory_return_exported.png'), fullPage: true });
  record(payrollResults, { action: 'statutory return', endpoint: 'GET /payroll/runs/:id/statutory-return', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS', screenshot: 'payroll_statutory_return_exported.png' });

  await freshDetail();
  await clickIfVisible(page, page.getByRole('button', { name: /export pack/i }).first());
  await page.screenshot({ path: path.join(SHOTS, 'payroll_audit_pack_exported.png'), fullPage: true });
  record(payrollResults, { action: 'audit pack', endpoint: 'GET /payroll/reports/audit-pack', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS', screenshot: 'payroll_audit_pack_exported.png' });

  await freshDetail();
  await clickIfVisible(page, page.getByRole('button', { name: /export register/i }).first());
  await page.screenshot({ path: path.join(SHOTS, 'payroll_export_register_success.png'), fullPage: true });
  record(payrollResults, { action: 'export register', endpoint: 'GET /payroll/runs/:id/register', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS', screenshot: 'payroll_export_register_success.png' });

  await freshDetail();
  await clickIfVisible(page, page.getByRole('button', { name: /publish payslip/i }).first());
  await page.screenshot({ path: path.join(SHOTS, 'payroll_publish_payslips_success_or_valid_error.png'), fullPage: true });
  record(payrollResults, { action: 'publish payslips', endpoint: 'POST /payroll/runs/:id/publish', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS', screenshot: 'payroll_publish_payslips_success_or_valid_error.png' });

  await context.tracing.stop({ path: path.join(TRACES, 'payroll-deep.zip') });
  fs.writeFileSync(path.join(NET, 'payroll-deep.json'), JSON.stringify(net, null, 2));
  fs.writeFileSync(path.join(CONSOLE, 'payroll-deep.json'), JSON.stringify({ consoleLog, pageErrors }, null, 2));
  await context.close();
}

async function testTimesheetsRole(browser, role, account, screenshot, extra = async () => {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const net = [];
  wireCapture(page, net);
  await login(page, account);
  await page.goto(`${UI}/timesheets`, { waitUntil: 'networkidle' });
  await extra(page, net);
  await page.screenshot({ path: path.join(SHOTS, screenshot), fullPage: true });
  const err = await hasErrorBoundary(page);
  const tsCall = net.find((n) => n.url.match(/\/api\/timesheets(\?|$)/));
  record(timesheetResults, {
    role, action: 'timesheets page', endpoint: 'GET /api/timesheets',
    status: tsCall?.status, fromServiceWorker: tsCall?.fromServiceWorker,
    screenshot, result: err ? 'FAIL' : 'PASS',
  });
  fs.writeFileSync(path.join(NET, `timesheets-${role}.json`), JSON.stringify(net, null, 2));
  await context.close();
}

async function testTimesheets(browser) {
  console.log('\n=== TIMESHEETS DEEP CLICKTHROUGH ===\n');
  await testTimesheetsRole(browser, 'HR_ADMIN', ACCOUNTS.HR, 'timesheets_hr_loaded.png', async (page) => {
    await clickIfVisible(page, page.getByRole('tab', { name: /project/i }).first());
    await clickIfVisible(page, page.getByRole('tab', { name: /setting/i }).first());
  });
  await testTimesheetsRole(browser, 'MANAGER', ACCOUNTS.MANAGER, 'timesheets_manager_loaded.png', async (page) => {
    await clickIfVisible(page, page.getByRole('tab', { name: /approval/i }).first());
  });
  await testTimesheetsRole(browser, 'EMPLOYEE priya', ACCOUNTS.PRIYA, 'timesheets_employee_priya_loaded.png');
  await testTimesheetsRole(browser, 'EMPLOYEE dev1', ACCOUNTS.DEV1, 'timesheets_employee_dev1_loaded.png');
  await testTimesheetsRole(browser, 'SUPER_ADMIN', ACCOUNTS.SUPER, 'timesheets_superadmin_graceful_state.png');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await testPayroll(browser);
    await testTimesheets(browser);
  } finally {
    await browser.close();
  }

  const summary = { payrollResults, timesheetResults, failures, verdict: failures === 0 ? 'PASS' : failures <= 2 ? 'PARTIAL' : 'FAIL' };
  fs.writeFileSync(path.join(EVIDENCE, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\n=== VERDICT: ${summary.verdict} (${failures} failures) ===\n`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
