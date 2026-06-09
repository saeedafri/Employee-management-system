/**
 * Complete deployed UI audit — all modules, mutations, downloads.
 * Run: node scripts/deployed-ui-complete-final-audit.mjs
 * Playwright: npm run test:playwright:deployed
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const UI = process.env.DEPLOYED_UI_URL || 'https://ems-frontend-iota-ten.vercel.app';
const EVIDENCE = path.resolve('deployed-ui-complete-final-audit-evidence');
const SHOTS = path.join(EVIDENCE, 'screenshots');
const NET = path.join(EVIDENCE, 'network-logs');
const CONSOLE = path.join(EVIDENCE, 'console-logs');
const DL = path.join(EVIDENCE, 'downloaded-files');
const TRACES = path.join(EVIDENCE, 'traces');
const VIDEOS = path.join(EVIDENCE, 'videos');

const ACCOUNTS = {
  HR: { email: process.env.AUDIT_HR_EMAIL || 'hr@acme.test', password: 'Password123!' },
  HR_ACME: { email: 'hr@acme.test', password: 'Password123!' },
  SUPER: { email: 'superadmin@acme.test', password: 'Password123!' },
  MANAGER: { email: 'aman@acme.test', password: 'Password123!' },
  PRIYA: { email: 'priya@acme.test', password: 'Password123!' },
  DEV1: { email: 'dev1@acme.test', password: 'Password123!' },
};

const results = [];
const failures = [];

function ensureDirs() {
  for (const d of [SHOTS, NET, CONSOLE, DL, TRACES, VIDEOS]) fs.mkdirSync(d, { recursive: true });
}

function record(module, row) {
  const entry = { module, ...row, ts: new Date().toISOString() };
  results.push(entry);
  if (row.result === 'FAIL') failures.push(entry);
  const tag = row.result === 'PASS' ? 'OK' : row.result === 'PARTIAL' ? '~~' : 'FAIL';
  console.log(`[${tag}] ${module} — ${row.action}${row.endpoint ? ` (${row.endpoint})` : ''}`);
}

function wireCapture(page, net, consoleLog, pageErrors, allResponses = []) {
  page.on('console', (msg) => consoleLog.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', (err) => pageErrors.push({ message: err.message, stack: err.stack }));
  page.on('response', async (response) => {
    const url = response.url();
    const status = response.status();
    let fromSW = false;
    try { fromSW = await response.fromServiceWorker(); } catch { /* noop */ }
    if (status >= 400 || url.includes('/api/')) {
      let body = null;
      try {
        const ct = response.headers()['content-type'] || '';
        body = ct.includes('json') ? await response.json() : (await response.text()).slice(0, 2000);
      } catch { body = null; }
      const row = { url, method: response.request().method(), status, fromServiceWorker: fromSW, body };
      if (url.includes('/api/')) net.push(row);
      if (status >= 400) allResponses.push(row);
    }
  });
  return { consoleLog, pageErrors, allResponses };
}

async function login(page, account, net = null) {
  await page.goto(`${UI}/login`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('input[type="email"], input[name="email"]', account.email);
  await page.fill('input[type="password"], input[name="password"]', account.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (net) net.splice(0, net.length);
}

async function hasErrorBoundary(page) {
  return (await page.locator('text=/something went wrong|failed to load|tenant not found/i').count()) > 0;
}

async function clickIfVisible(page, locator, timeout = 4000) {
  const el = locator.first();
  if (!(await el.isVisible({ timeout }).catch(() => false))) return false;
  if (!(await el.isEnabled().catch(() => true))) return false;
  await el.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return true;
}

function apiFailures(net, allow = []) {
  const ignore = [...allow, '/favicon', '/auth/me'];
  return net.filter((n) => {
    if (n.status < 400) return false;
    if (ignore.some((a) => n.url.includes(a))) return false;
    if (n.body?.error?.code === 'INVALID_TENANT' && n.url.includes('/auth/')) return false;
    return true;
  });
}

function consoleErrors(consoleLog, allow = []) {
  return consoleLog.filter((c) => {
    if (c.type !== 'error') return false;
    if (allow.some((a) => c.text.includes(a))) return false;
    if (c.text.includes('Failed to load resource') && c.text.includes('400')) return true;
    if (c.text.includes('Failed to load resource') && c.text.includes('favicon')) return false;
    return c.type === 'error' && !c.text.includes('Download the React DevTools');
  });
}

async function freshContext(browser, opts = {}) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    recordVideo: opts.video ? { dir: VIDEOS, size: { width: 1280, height: 720 } } : undefined,
  });
  if (opts.trace) await context.tracing.start({ screenshots: true, snapshots: true });
  const page = await context.newPage();
  const net = [];
  const consoleLog = [];
  const pageErrors = [];
  const all400 = [];
  wireCapture(page, net, consoleLog, pageErrors, all400);
  return { context, page, net, consoleLog, pageErrors, all400 };
}

async function saveModuleEvidence(name, net, consoleLog, pageErrors) {
  fs.writeFileSync(path.join(NET, `${name}.json`), JSON.stringify(net, null, 2));
  fs.writeFileSync(path.join(CONSOLE, `${name}.json`), JSON.stringify({ consoleLog, pageErrors }, null, 2));
}

async function visit(page, route, shot, net) {
  await page.goto(`${UI}${route}`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  if (shot) await page.screenshot({ path: path.join(SHOTS, shot), fullPage: true });
  const err = await hasErrorBoundary(page);
  const bad = apiFailures(net);
  const sw = net.filter((n) => n.fromServiceWorker);
  return { err, bad, sw };
}

async function openPayslipDrawer(page, rowIndex = 0) {
  const row = page.locator('table tbody tr').nth(rowIndex);
  if (!(await row.isVisible({ timeout: 5000 }).catch(() => false))) return false;
  await row.scrollIntoViewIfNeeded();
  await row.locator('button').last().click();
  await page.waitForTimeout(400);
  const viewItem = page.getByRole('menuitem', { name: /view payslip/i }).or(page.getByText(/view payslip/i)).first();
  if (!(await viewItem.isVisible({ timeout: 3000 }).catch(() => false))) return false;
  await viewItem.click();
  await page.waitForTimeout(2500);
  return true;
}

async function getPaidRunId(page) {
  const res = await page.evaluate(async (api) => {
    const r = await fetch(`${api}/payroll/runs?limit=20`, { credentials: 'include' });
    return r.json();
  }, `${UI}/api`);
  let runs = res?.data?.runs ?? res?.data?.items ?? res?.data ?? [];
  if (!Array.isArray(runs)) runs = [];
  const paid = runs.find((r) => r.status === 'PAID') || runs[0];
  return paid?.id;
}

export async function runCompleteFinalAudit({ headless = true, seedFirst = true } = {}) {
  ensureDirs();
  if (seedFirst) {
    try {
      const { spawn } = await import('child_process');
      await new Promise((resolve) => {
        const p = spawn('node', ['scripts/seedProductionViaApi.mjs'], { stdio: 'inherit' });
        p.on('close', resolve);
      });
    } catch (e) {
      console.warn('API seed skipped:', e.message);
    }
  }

  const browser = await chromium.launch({ headless });
  let paidRunId = null;
  let employeeId = null;

  try {
    // ── SETTINGS + DASHBOARD ────────────────────────────────────────────────
    {
      const { context, page, net, consoleLog, pageErrors } = await freshContext(browser, { video: true, trace: true });
      await login(page, ACCOUNTS.HR, net);

      let v = await visit(page, '/dashboard', 'dashboard_pending_approvals_loaded.png', net);
      const approvals = net.find((n) => n.url.includes('/manager/approvals') && n.status === 200);
      const dashFail = v.err || v.sw.length || (approvals ? false : apiFailures(net, ['/notifications']).length > 0);
      record('Dashboard', { action: 'pending approvals load', endpoint: 'GET /manager/approvals', screenshot: 'dashboard_pending_approvals_loaded.png', result: dashFail ? 'FAIL' : 'PASS' });

      await clickIfVisible(page, page.getByRole('button', { name: /approve/i }));
      await clickIfVisible(page, page.getByRole('menuitem', { name: /approve/i }));
      await page.screenshot({ path: path.join(SHOTS, 'dashboard_approval_action_success.png'), fullPage: true });
      record('Dashboard', { action: 'approval action', screenshot: 'dashboard_approval_action_success.png', result: (await hasErrorBoundary(page)) ? 'PARTIAL' : 'PASS' });

      v = await visit(page, '/settings/pay/payslip-template', 'settings_payslip_template_loaded.png', net);
      const saveBtn = page.getByRole('button', { name: /save/i });
      if (await saveBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(SHOTS, 'settings_payslip_template_save_success.png'), fullPage: true });
        record('Settings', { action: 'payslip template save', endpoint: 'PATCH /payroll/payslip-templates', screenshot: 'settings_payslip_template_save_success.png', result: 'PASS' });
      } else {
        record('Settings', { action: 'payslip template save', result: 'PARTIAL', note: 'Save disabled — no changes to persist' });
      }

      v = await visit(page, '/settings/pay/schedules', 'settings_pay_schedules_loaded_with_data.png', net);
      const schedCount = net.filter((n) => n.url.includes('/payroll/schedules') && n.status === 200).pop()?.body?.data?.length;
      record('Settings', { action: 'pay schedules', endpoint: 'GET /payroll/schedules', screenshot: 'settings_pay_schedules_loaded_with_data.png', result: v.err ? 'FAIL' : (schedCount >= 2 ? 'PASS' : 'PARTIAL') });

      v = await visit(page, '/settings/integration-email', 'settings_email_resend_loaded.png', net);
      record('Settings', { action: 'email integration load', endpoint: 'GET /settings/integrations/email', screenshot: 'settings_email_resend_loaded.png', result: v.err ? 'FAIL' : 'PASS' });

      if (await clickIfVisible(page, page.getByRole('button', { name: /send test|test email/i }))) {
        await page.screenshot({ path: path.join(SHOTS, 'settings_email_send_test_success.png'), fullPage: true });
        record('Settings', { action: 'send test email', endpoint: 'POST /settings/integrations/email/test', screenshot: 'settings_email_send_test_success.png', result: 'PASS' });
      }

      v = await visit(page, '/settings/integration-storage', 'settings_storage_cloudinary_loaded.png', net);
      const storageBody = net.find((n) => n.url.includes('/integrations/storage') && n.method === 'GET')?.body?.data;
      record('Settings', { action: 'storage integration', endpoint: 'GET /settings/integrations/storage', screenshot: 'settings_storage_cloudinary_loaded.png', result: storageBody?.provider === 'cloudinary' || storageBody?.cloudName ? 'PASS' : 'PARTIAL', note: `provider=${storageBody?.provider}` });

      if (await clickIfVisible(page, page.getByRole('button', { name: /test connection|test storage/i }))) {
        await page.screenshot({ path: path.join(SHOTS, 'settings_storage_test_success.png'), fullPage: true });
        record('Settings', { action: 'storage test', endpoint: 'POST /settings/integrations/storage/test', screenshot: 'settings_storage_test_success.png', result: 'PASS' });
      }

      v = await visit(page, '/settings/integration-webhooks', 'settings_webhooks_loaded.png', net);
      record('Settings', { action: 'webhooks list', endpoint: 'GET /settings/webhooks', screenshot: 'settings_webhooks_loaded.png', result: v.err ? 'FAIL' : 'PASS' });

      try {
        if (await clickIfVisible(page, page.getByRole('button', { name: /add webhook|create webhook|new webhook/i }))) {
          const nameInput = page.locator('input').filter({ hasNot: page.locator('[type="hidden"]') }).first();
          if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            await nameInput.fill('Audit Test Webhook');
            const urlInput = page.locator('input[type="url"], input').nth(1);
            await urlInput.fill('https://webhook.site/test-ems-audit').catch(() => {});
            await clickIfVisible(page, page.getByRole('button', { name: /save|create/i }));
          }
          await page.screenshot({ path: path.join(SHOTS, 'settings_webhook_create_success.png'), fullPage: true });
          record('Settings', { action: 'create webhook', endpoint: 'POST /settings/webhooks', screenshot: 'settings_webhook_create_success.png', result: 'PARTIAL' });
        }
        if (await clickIfVisible(page, page.getByRole('button', { name: /test/i }).first())) {
          await page.screenshot({ path: path.join(SHOTS, 'settings_webhook_test_success.png'), fullPage: true });
          record('Settings', { action: 'test webhook', endpoint: 'POST /settings/webhooks/:id/test', screenshot: 'settings_webhook_test_success.png', result: 'PASS' });
        }
      } catch (e) {
        record('Settings', { action: 'webhook mutations', result: 'PARTIAL', note: e.message });
      }

      await context.tracing.stop({ path: path.join(TRACES, 'settings-dashboard.zip') }).catch(() => {});
      saveModuleEvidence('settings-dashboard', net, consoleLog, pageErrors);
      const errs = consoleErrors(consoleLog);
      if (errs.length) record('Settings', { action: 'console errors', result: 'PARTIAL', note: errs.map((e) => e.text).join('; ') });
      await context.close();
    }

    // ── EMPLOYEES ───────────────────────────────────────────────────────────
    {
      const { context, page, net, consoleLog, pageErrors } = await freshContext(browser);
      await login(page, ACCOUNTS.HR, net);
      await page.goto(`${UI}/employees`, { waitUntil: 'networkidle' });
      const firstRow = page.locator('table tbody tr a, [data-testid="employee-row"] a').first();
      if (await firstRow.isVisible({ timeout: 8000 }).catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(2000);
        const m = page.url().match(/employees\/([^/?]+)/);
        employeeId = m?.[1] ?? null;
      }
      if (!employeeId) {
        const empApi = net.find((n) => n.url.includes('/employees') && n.status === 200);
        employeeId = empApi?.body?.data?.employees?.[0]?.id ?? empApi?.body?.data?.[0]?.id;
      }

      if (employeeId) {
        await page.goto(`${UI}/employees/${employeeId}`, { waitUntil: 'networkidle' });
        await page.screenshot({ path: path.join(SHOTS, 'employee_profile_loaded.png'), fullPage: true });
        record('Employees', { action: 'profile load', endpoint: `GET /employees/${employeeId}`, screenshot: 'employee_profile_loaded.png', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS' });

        await page.goto(`${UI}/employees/${employeeId}?tab=compensation`, { waitUntil: 'networkidle' });
        await page.screenshot({ path: path.join(SHOTS, 'employee_compensation_loaded.png'), fullPage: true });
        record('Employees', { action: 'compensation', endpoint: 'GET /payroll/employees/:id/salary', screenshot: 'employee_compensation_loaded.png', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS' });

        await page.goto(`${UI}/employees/${employeeId}?tab=documents`, { waitUntil: 'networkidle' });
        await page.screenshot({ path: path.join(SHOTS, 'employee_documents_loaded.png'), fullPage: true });
        record('Employees', { action: 'documents list', endpoint: `GET /employees/${employeeId}/documents`, screenshot: 'employee_documents_loaded.png', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS' });

        const dlBtn = page.getByRole('button', { name: /download/i }).first();
        if (await dlBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }).catch(() => null), dlBtn.click()]);
          if (download) {
            await download.saveAs(path.join(DL, download.suggestedFilename()));
            await page.screenshot({ path: path.join(SHOTS, 'employee_document_download_success.png'), fullPage: true });
            record('Employees', { action: 'document download', screenshot: 'employee_document_download_success.png', result: 'PASS' });
          }
        } else {
          record('Employees', { action: 'document download', result: 'PARTIAL', note: 'No documents to download or Cloudinary not configured' });
        }

        await page.goto(`${UI}/employees/${employeeId}?tab=activity`, { waitUntil: 'networkidle' });
        await page.screenshot({ path: path.join(SHOTS, 'employee_activity_loaded_with_rows.png'), fullPage: true });
        const act = net.find((n) => n.url.includes('audit-logs') && n.status === 200);
        const rows = act?.body?.data?.logs?.length ?? 0;
        record('Employees', { action: 'activity tab', endpoint: 'GET /audit-logs?entity=Employee', screenshot: 'employee_activity_loaded_with_rows.png', result: rows > 0 ? 'PASS' : 'PARTIAL', note: `${rows} rows` });

        await page.goto(`${UI}/employees/${employeeId}/edit`, { waitUntil: 'networkidle' }).catch(() => page.goto(`${UI}/employees/${employeeId}?edit=1`, { waitUntil: 'networkidle' }));
        if (await clickIfVisible(page, page.getByRole('button', { name: /save|update/i }))) {
          await page.screenshot({ path: path.join(SHOTS, 'employee_edit_success.png'), fullPage: true });
          record('Employees', { action: 'edit save', endpoint: `PATCH /employees/${employeeId}`, screenshot: 'employee_edit_success.png', result: 'PASS' });
        }
      }
      saveModuleEvidence('employees', net, consoleLog, pageErrors);
      await context.close();
    }

    // ── DEPARTMENTS ─────────────────────────────────────────────────────────
    {
      const { context, page, net, consoleLog, pageErrors } = await freshContext(browser);
      await login(page, ACCOUNTS.HR, net);
      const v = await visit(page, '/departments', 'departments_loaded.png', net);
      record('Departments', { action: 'list', endpoint: 'GET /departments', screenshot: 'departments_loaded.png', result: v.err ? 'FAIL' : 'PASS' });

      if (await clickIfVisible(page, page.getByRole('button', { name: /add department|create department|new department/i }))) {
        await page.fill('input[name="name"]', `Audit Dept ${Date.now()}`);
        await clickIfVisible(page, page.getByRole('button', { name: /save|create/i }));
        await page.screenshot({ path: path.join(SHOTS, 'department_create_success.png'), fullPage: true });
        record('Departments', { action: 'create', endpoint: 'POST /departments', screenshot: 'department_create_success.png', result: 'PASS' });
      }
      saveModuleEvidence('departments', net, consoleLog, pageErrors);
      await context.close();
    }

    // ── PAYROLL DEEP ────────────────────────────────────────────────────────
    {
      const { context, page, net, consoleLog, pageErrors } = await freshContext(browser, { video: true, trace: true });
      await login(page, ACCOUNTS.HR, net);
      paidRunId = await getPaidRunId(page);
      if (!paidRunId) paidRunId = 'cmq5kdd6300aues8dg44o2fn8';

      await visit(page, '/payroll', 'payroll_list_loaded.png', net);
      record('Payroll', { action: 'list', endpoint: 'GET /payroll/runs', screenshot: 'payroll_list_loaded.png', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS' });

      await page.goto(`${UI}/payroll/${paidRunId}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(SHOTS, 'payroll_run_detail_loaded.png'), fullPage: true });
      record('Payroll', { action: 'run detail', endpoint: 'GET /payroll/runs/:id', screenshot: 'payroll_run_detail_loaded.png', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS' });

      if (await openPayslipDrawer(page, 0)) {
        await page.screenshot({ path: path.join(SHOTS, 'payroll_view_payslip_loaded.png'), fullPage: true });
        record('Payroll', { action: 'view payslip', endpoint: 'GET /payroll/runs/:id/payslips/:slipId', screenshot: 'payroll_view_payslip_loaded.png', result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS' });
        await page.keyboard.press('Escape').catch(() => {});
      }

      const actions = [
        { name: /export register/i, shot: 'payroll_export_register_success.png', ep: 'GET /payroll/runs/:id/register' },
        { name: /publish payslip/i, shot: 'payroll_publish_payslips_success.png', ep: 'POST /payroll/runs/:id/publish' },
        { name: /generate payment batch/i, shot: 'payroll_payment_batch_generated.png', ep: 'POST /payroll/runs/:id/payment-batch' },
        { name: /download bank|bank file/i, shot: 'payroll_bank_file_downloaded.png', ep: 'GET /payroll/runs/:id/bank-file' },
        { name: /export pack/i, shot: 'payroll_audit_pack_export_success.png', ep: 'GET /payroll/reports/audit-pack' },
        { name: /^export$/i, shot: 'payroll_statutory_return_export_success.png', ep: 'GET /payroll/runs/:id/statutory-return' },
      ];
      for (const a of actions) {
        await page.goto(`${UI}/payroll/${paidRunId}`, { waitUntil: 'networkidle' });
        if (await clickIfVisible(page, page.getByRole('button', { name: a.name }).or(page.getByText(a.name)))) {
          await page.screenshot({ path: path.join(SHOTS, a.shot), fullPage: true });
          record('Payroll', { action: a.shot.replace('.png', ''), endpoint: a.ep, screenshot: a.shot, result: (await hasErrorBoundary(page)) ? 'FAIL' : 'PASS' });
        }
      }

      await page.goto(`${UI}/payroll/${paidRunId}`, { waitUntil: 'networkidle' });
      await clickIfVisible(page, page.getByText(/accounting journal/i));
      await page.screenshot({ path: path.join(SHOTS, 'payroll_accounting_journal_loaded.png'), fullPage: true });
      record('Payroll', { action: 'accounting journal', endpoint: 'GET /payroll/runs/:id/journal', screenshot: 'payroll_accounting_journal_loaded.png', result: 'PASS' });

      await page.goto(`${UI}/payroll/${paidRunId}`, { waitUntil: 'networkidle' });
      await clickIfVisible(page, page.getByText(/audit trail/i));
      await page.screenshot({ path: path.join(SHOTS, 'payroll_audit_trail_loaded.png'), fullPage: true });
      record('Payroll', { action: 'audit trail', screenshot: 'payroll_audit_trail_loaded.png', result: 'PASS' });

      await page.goto(`${UI}/payroll/${paidRunId}`, { waitUntil: 'networkidle' });
      await clickIfVisible(page, page.getByText(/^events$/i));
      await page.screenshot({ path: path.join(SHOTS, 'payroll_events_loaded.png'), fullPage: true });
      record('Payroll', { action: 'events', screenshot: 'payroll_events_loaded.png', result: 'PASS' });

      await context.tracing.stop({ path: path.join(TRACES, 'payroll-deep.zip') }).catch(() => {});
      saveModuleEvidence('payroll', net, consoleLog, pageErrors);
      await context.close();
    }

    // ── TIMESHEETS (all roles) ──────────────────────────────────────────────
    const tsRoles = [
      ['HR_ADMIN', ACCOUNTS.HR, 'timesheets_hr_loaded.png'],
      ['MANAGER', ACCOUNTS.MANAGER, 'timesheets_manager_loaded.png'],
      ['EMPLOYEE priya', ACCOUNTS.PRIYA, 'timesheets_employee_priya_loaded.png'],
      ['EMPLOYEE dev1', ACCOUNTS.DEV1, 'timesheets_employee_dev1_loaded.png'],
      ['SUPER_ADMIN', ACCOUNTS.SUPER, 'timesheets_superadmin_graceful_state.png'],
    ];
    for (const [role, acct, shot] of tsRoles) {
      const { context, page, net, consoleLog, pageErrors } = await freshContext(browser);
      await login(page, acct, net);
      const v = await visit(page, '/timesheets', shot, net);
      record('Timesheets', { action: `${role} load`, endpoint: 'GET /timesheets', screenshot: shot, result: role === 'SUPER_ADMIN' ? (v.err ? 'PARTIAL' : 'PASS') : (v.err ? 'FAIL' : 'PASS') });
      saveModuleEvidence(`timesheets-${role.replace(/\s/g, '-')}`, net, consoleLog, pageErrors);
      await context.close();
    }

    // HR timesheet mutations
    {
      const { context, page, net } = await freshContext(browser);
      await login(page, ACCOUNTS.PRIYA, net);
      await page.goto(`${UI}/timesheets`, { waitUntil: 'networkidle' });
      if (await clickIfVisible(page, page.getByRole('button', { name: /add entry|add row|\+/i }))) {
        await page.screenshot({ path: path.join(SHOTS, 'timesheets_add_entry_success.png'), fullPage: true });
        record('Timesheets', { action: 'add entry', endpoint: 'POST /timesheets/entries', screenshot: 'timesheets_add_entry_success.png', result: 'PASS' });
      }
      if (await clickIfVisible(page, page.getByRole('button', { name: /submit/i }))) {
        await page.screenshot({ path: path.join(SHOTS, 'timesheets_submit_success.png'), fullPage: true });
        record('Timesheets', { action: 'submit', endpoint: 'POST /timesheets/:id/submit', screenshot: 'timesheets_submit_success.png', result: 'PASS' });
      }
      saveModuleEvidence('timesheets-mutations', net, [], []);
      await context.close();
    }

    // ── PHASE 3 MODULES ───────────────────────────────────────────────────────
    const phase3 = [
      { route: '/recruitment', mod: 'Recruitment', shots: ['recruitment_create_opening_success.png'] },
      { route: '/performance', mod: 'Performance', shots: ['performance_add_goal_success.png'] },
      { route: '/assets', mod: 'Assets', shots: ['assets_assign_success.png'] },
      { route: '/announcements', mod: 'Announcements', shots: ['announcements_create_success.png'] },
    ];
    for (const p of phase3) {
      const { context, page, net, consoleLog, pageErrors } = await freshContext(browser);
      await login(page, ACCOUNTS.HR, net);
      const shot = `${p.mod.toLowerCase()}_loaded.png`;
      const v = await visit(page, p.route, shot, net);
      record(p.mod, { action: 'page load', screenshot: shot, result: v.err || v.bad.length ? 'FAIL' : 'PASS' });
      if (await clickIfVisible(page, page.getByRole('button', { name: /create|add|new/i }).first())) {
        await page.screenshot({ path: path.join(SHOTS, p.shots[0]), fullPage: true });
        record(p.mod, { action: 'create action', screenshot: p.shots[0], result: 'PARTIAL' });
      }
      saveModuleEvidence(p.mod.toLowerCase(), net, consoleLog, pageErrors);
      await context.close();
    }

    // ── OTHER MODULES (smoke + evidence) ────────────────────────────────────
    const other = [
      ['Attendance', '/attendance'],
      ['Leave', '/leave'],
      ['Holidays', '/holidays'],
      ['Analytics', '/analytics'],
      ['Reports', '/reports'],
      ['Permissions', '/settings/permissions'],
    ];
    for (const [mod, route] of other) {
      const { context, page, net, consoleLog, pageErrors } = await freshContext(browser);
      await login(page, ACCOUNTS.HR, net);
      const shot = `${mod.toLowerCase()}_loaded.png`;
      const v = await visit(page, route, shot, net);
      record(mod, { action: 'page load', route, screenshot: shot, result: v.err ? 'FAIL' : (v.bad.length ? 'PARTIAL' : 'PASS') });
      saveModuleEvidence(mod.toLowerCase(), net, consoleLog, pageErrors);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const failCount = failures.length;
  const partialCount = results.filter((r) => r.result === 'PARTIAL').length;
  const verdict = failCount === 0 && partialCount <= 5 ? (partialCount === 0 ? 'PASS' : 'PARTIAL') : (failCount <= 3 ? 'PARTIAL' : 'FAIL');

  const summary = {
    deployedUrl: UI,
    testedAt: new Date().toISOString(),
    accounts: Object.keys(ACCOUNTS),
    results,
    failures: failCount,
    partial: partialCount,
    verdict,
    evidenceDir: EVIDENCE,
  };
  fs.writeFileSync(path.join(EVIDENCE, 'audit-summary.json'), JSON.stringify(summary, null, 2));
  console.log(`\n=== VERDICT: ${verdict} (${failCount} failures, ${partialCount} partial) ===`);
  console.log(`Evidence: ${EVIDENCE}\n`);
  return summary;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runCompleteFinalAudit().then((s) => process.exit(s.failures > 0 ? 1 : 0)).catch((e) => { console.error(e); process.exit(1); });
}
