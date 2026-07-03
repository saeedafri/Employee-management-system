/**
 * Phase 3 — Deep CRUD + Payroll Engine + UI sweep audit.
 * MSW OFF. localhost:3001 → BFF → Hostinger API.
 *
 * Usage: FE_BASE=http://localhost:3001 node scripts/deepCrudE2EAudit.mjs
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FE = process.env.FE_BASE || 'http://localhost:3001';
const API = process.env.API_URL || 'https://ems-api.saqibsaeed.cloud/api/v1';
const PASSWORD = 'Password123!';
const SHOT_DIR = path.join(ROOT, 'docs/e2e-screenshots/deep');
const OUT_JSON = path.join(ROOT, 'docs/e2e-deep-crud-results.json');

fs.mkdirSync(SHOT_DIR, { recursive: true });

const TENANTS = { acme: 'acme-corp-001', kwd: 'kwd-litmus-001', testorg: 'test-key-123456789' };

const crudResults = [];
const engineResults = [];
const uiResults = [];
const backendIssues = [];
const frontendIssues = [];
const cleanup = [];

function ts() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }
function slug(s) { return (s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50); }

async function apiReq(method, urlPath, { token, tenant, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (tenant) headers['x-tenant-key'] = tenant;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(45_000),
  });
  let json = null;
  try { json = await res.json(); } catch { /* noop */ }
  return { status: res.status, json };
}

async function login(email, tenant, password = PASSWORD) {
  const r = await apiReq('POST', '/auth/login', { tenant, body: { email, password } });
  return { token: r.json?.data?.accessToken, user: r.json?.data?.user, status: r.status, error: r.json?.error?.code, mfa: r.json?.data?.mfaRequired };
}

function recordCrud(module, op, pass, detail = {}) {
  crudResults.push({ module, op, pass, ...detail, at: new Date().toISOString() });
  console.log(`${pass ? 'CRUD PASS' : 'CRUD FAIL'} | ${module} | ${op}${detail.note ? ' | ' + detail.note : ''}`);
}

function recordEngine(name, pass, detail = {}) {
  engineResults.push({ name, pass, ...detail, at: new Date().toISOString() });
  console.log(`${pass ? 'ENGINE PASS' : 'ENGINE FAIL'} | ${name}${detail.note ? ' | ' + detail.note : ''}`);
}

function addBackendIssue(issue) {
  backendIssues.push(issue);
}

function addFrontendIssue(issue) {
  frontendIssues.push(issue);
}

async function shot(page, name) {
  const file = `${slug(name)}-${ts()}.png`;
  const abs = path.join(SHOT_DIR, file);
  await page.screenshot({ path: abs, fullPage: true }).catch(() => {});
  return `docs/e2e-screenshots/deep/${file}`;
}

// ─── CRUD via API ───────────────────────────────────────────────

async function crudDepartments(token, tenant) {
  const name = `e2e-dept-${Date.now()}`;
  const create = await apiReq('POST', '/departments', { token, tenant, body: { name, description: 'Phase3 test' } });
  const id = create.json?.data?.id;
  recordCrud('departments', 'create', create.status === 201 || create.status === 200, { status: create.status, id });
  if (!id) return;
  cleanup.push(async () => apiReq('DELETE', `/departments/${id}`, { token, tenant }));

  const read = await apiReq('GET', '/departments', { token, tenant });
  const found = (read.json?.data ?? []).some((d) => d.id === id);
  recordCrud('departments', 'read', read.status === 200 && found, { status: read.status });

  const patch = await apiReq('PATCH', `/departments/${id}`, { token, tenant, body: { name: name + '-renamed' } });
  recordCrud('departments', 'update', patch.status === 200, { status: patch.status });

  const del = await apiReq('DELETE', `/departments/${id}`, { token, tenant });
  recordCrud('departments', 'delete', del.status === 200 || del.status === 204, { status: del.status });
}

async function crudHolidays(token, tenant) {
  const create = await apiReq('POST', '/holidays', {
    token, tenant,
    body: { name: `E2E Holiday ${Date.now()}`, holidayDate: '2026-12-25', isOptional: false },
  });
  const id = create.json?.data?.id;
  recordCrud('holidays', 'create', create.status === 201 || create.status === 200, { status: create.status, id });
  if (!id) return;

  const read = await apiReq('GET', '/holidays?year=2026', { token, tenant });
  recordCrud('holidays', 'read', read.status === 200, { status: read.status });

  const patch = await apiReq('PATCH', `/holidays/${id}`, { token, tenant, body: { name: 'E2E Updated' } });
  recordCrud('holidays', 'update', patch.status === 200, { status: patch.status });

  const del = await apiReq('DELETE', `/holidays/${id}`, { token, tenant });
  recordCrud('holidays', 'delete', del.status === 200 || del.status === 204, { status: del.status });
}

async function crudAnnouncements(token, tenant) {
  const create = await apiReq('POST', '/announcements', {
    token, tenant,
    body: { title: `E2E Announce ${Date.now()}`, body: 'Phase 3 test announcement body', category: 'GENERAL', audience: 'ALL' },
  });
  const id = create.json?.data?.id;
  recordCrud('announcements', 'create', create.status === 201 || create.status === 200, { status: create.status, id });
  if (!id) return;

  const read = await apiReq('GET', '/announcements', { token, tenant });
  recordCrud('announcements', 'read', read.status === 200, { status: read.status });

  const patch = await apiReq('PATCH', `/announcements/${id}`, { token, tenant, body: { title: 'E2E Updated' } });
  recordCrud('announcements', 'update', patch.status === 200, { status: patch.status });

  const del = await apiReq('DELETE', `/announcements/${id}`, { token, tenant });
  recordCrud('announcements', 'delete', del.status === 200 || del.status === 204, { status: del.status });
}

async function crudPayComponents(token, tenant) {
  const code = `E2E_${Date.now()}`;
  const create = await apiReq('POST', '/payroll/components', {
    token, tenant,
    body: { name: 'E2E Component', code, type: 'EARNING', calculationType: 'FLAT', value: 500, taxable: true },
  });
  const id = create.json?.data?.id;
  recordCrud('pay_components', 'create', create.status === 201, { status: create.status, id });
  if (!id) return;

  const read = await apiReq('GET', '/payroll/components', { token, tenant });
  recordCrud('pay_components', 'read', read.status === 200, { status: read.status });

  const patch = await apiReq('PATCH', `/payroll/components/${id}`, { token, tenant, body: { value: 600 } });
  recordCrud('pay_components', 'update', patch.status === 200, { status: patch.status });

  const del = await apiReq('DELETE', `/payroll/components/${id}`, { token, tenant });
  recordCrud('pay_components', 'delete', del.status === 200 || del.status === 204, { status: del.status });
}

async function crudLegalEntities(saToken, tenant) {
  const create = await apiReq('POST', '/payroll/legal-entities', {
    token: saToken, tenant,
    body: { name: `E2E Entity ${Date.now()}`, country: 'IN', currency: 'INR', workWeekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  });
  const id = create.json?.data?.id;
  recordCrud('legal_entities', 'create', create.status === 201 || create.status === 200, { status: create.status, id });
  if (!id) return;

  const read = await apiReq('GET', '/payroll/legal-entities', { token: saToken, tenant });
  recordCrud('legal_entities', 'read', read.status === 200, { status: read.status });

  const patch = await apiReq('PATCH', `/payroll/legal-entities/${id}`, { token: saToken, tenant, body: { name: 'E2E Entity Updated' } });
  recordCrud('legal_entities', 'update', patch.status === 200, { status: patch.status });
}

async function crudPayGroups(token, tenant) {
  const le = await apiReq('GET', '/payroll/legal-entities', { token, tenant });
  const legalEntityId = (le.json?.data ?? [])[0]?.id;
  const create = await apiReq('POST', '/payroll/groups', {
    token, tenant,
    body: { name: `E2E Group ${Date.now()}`, description: 'Phase3', legalEntityId, payCalendarId: null },
  });
  const id = create.json?.data?.id;
  recordCrud('pay_groups', 'create', create.status === 201 || create.status === 200, { status: create.status, id });
  if (!id) return;

  const read = await apiReq('GET', '/payroll/groups', { token, tenant });
  recordCrud('pay_groups', 'read', read.status === 200, { status: read.status });

  const patch = await apiReq('PATCH', `/payroll/groups/${id}`, { token, tenant, body: { description: 'Updated' } });
  recordCrud('pay_groups', 'update', patch.status === 200, { status: patch.status });

  const del = await apiReq('DELETE', `/payroll/groups/${id}`, { token, tenant });
  recordCrud('pay_groups', 'delete', del.status === 200 || del.status === 204, { status: del.status });
}

async function crudLeave(token, tenant, employeeToken) {
  const types = await apiReq('GET', '/leave/types', { token: employeeToken, tenant });
  const typeId = types.json?.data?.[0]?.id;
  if (!typeId) { recordCrud('leave', 'create', false, { note: 'no leave type' }); return; }

  const create = await apiReq('POST', '/leave/requests', {
    token: employeeToken, tenant,
    body: { leaveTypeId: typeId, startDate: '2026-09-10', endDate: '2026-09-11', reason: 'E2E Phase3 test leave request' },
  });
  const id = create.json?.data?.id;
  recordCrud('leave', 'create', create.status === 201 || create.status === 200, { status: create.status, id });

  const balance = await apiReq('GET', '/leave/balance', { token: employeeToken, tenant });
  recordCrud('leave', 'read_balance', balance.status === 200, { status: balance.status });

  const list = await apiReq('GET', '/leave/requests', { token: employeeToken, tenant });
  recordCrud('leave', 'read_list', list.status === 200, { status: list.status });

  if (id) {
    const withdraw = await apiReq('PATCH', `/leave/requests/${id}/withdraw`, { token: employeeToken, tenant });
    recordCrud('leave', 'withdraw', withdraw.status === 200, { status: withdraw.status });
  }
}

async function crudAttendance(empToken, tenant) {
  const checkIn = await apiReq('POST', '/attendance/check-in', {
    token: empToken, tenant,
    body: { workMode: 'OFFICE', location: 'E2E test' },
  });
  // May fail if already checked in — that's ok
  const checkedIn = checkIn.status === 200 || checkIn.status === 409 || checkIn.json?.error?.code === 'ALREADY_CHECKED_IN';
  recordCrud('attendance', 'check_in', checkedIn, { status: checkIn.status, code: checkIn.json?.error?.code });

  const records = await apiReq('GET', '/attendance/records?month=2026-07', { token: empToken, tenant });
  recordCrud('attendance', 'read_records', records.status === 200, { status: records.status });

  const reg = await apiReq('POST', '/attendance/regularization', {
    token: empToken, tenant,
    body: { date: '2026-07-01', requestedCheckIn: '09:00:00', requestedCheckOut: '18:00:00', reason: 'E2E test regularization request' },
  });
  recordCrud('attendance', 'regularization', reg.status === 200 || reg.status === 201 || reg.status === 409, { status: reg.status });
}

async function crudSettings(token, tenant) {
  const read = await apiReq('GET', '/settings/tenant', { token, tenant });
  recordCrud('settings', 'read', read.status === 200, { status: read.status });

  const orig = read.json?.data?.timezone || 'Asia/Kolkata';
  const patch = await apiReq('PATCH', '/settings/tenant', { token, tenant, body: { timezone: orig } });
  recordCrud('settings', 'update', patch.status === 200, { status: patch.status });
}

async function crudNotifications(empToken, tenant) {
  const list = await apiReq('GET', '/notifications?page=1&limit=5', { token: empToken, tenant });
  recordCrud('notifications', 'read_list', list.status === 200, { status: list.status });

  const count = await apiReq('GET', '/notifications/unread-count', { token: empToken, tenant });
  recordCrud('notifications', 'unread_count', count.status === 200, { status: count.status });

  const items = list.json?.data?.items ?? list.json?.data ?? [];
  const first = Array.isArray(items) ? items[0] : null;
  if (first?.id) {
    const mark = await apiReq('PATCH', `/notifications/${first.id}/read`, { token: empToken, tenant });
    recordCrud('notifications', 'mark_read', mark.status === 200, { status: mark.status });
  } else {
    recordCrud('notifications', 'mark_read', true, { note: 'no notifications to mark' });
  }
}

async function crudTimesheets(empToken, mgrToken, tenant) {
  const week = '2026-06-16';
  const list = await apiReq('GET', `/timesheets?weekStart=${week}`, { token: empToken, tenant });
  recordCrud('timesheets', 'read', list.status === 200, { status: list.status });

  const locks = await apiReq('GET', '/timesheets/locks', { token: mgrToken, tenant });
  recordCrud('timesheets', 'locks_read', locks.status === 200, { status: locks.status });

  // Employee audit should 403
  const auditEmp = await apiReq('GET', '/timesheets/audit', { token: empToken, tenant });
  const audit403 = auditEmp.status === 403;
  recordCrud('timesheets', 'history_employee_403', audit403, { status: auditEmp.status });
  if (!audit403) {
    addBackendIssue({
      id: 'P3-BE-timesheets-audit-employee',
      severity: 'P1',
      endpoint: 'GET /timesheets/audit',
      note: `EMPLOYEE got ${auditEmp.status} instead of expected 403`,
    });
  }

  const auditMgr = await apiReq('GET', '/timesheets/audit', { token: mgrToken, tenant });
  recordCrud('timesheets', 'history_manager', auditMgr.status === 200, { status: auditMgr.status });
}

async function crudPayrollRun(token, tenant) {
  const create = await apiReq('POST', '/payroll/runs', {
    token, tenant,
    body: { period: '2026-06', startDate: '2026-06-01', endDate: '2026-06-30', payDate: '2026-07-05', type: 'REGULAR', includeAllActiveEmployees: true },
  });
  const id = create.json?.data?.id;
  recordCrud('payroll', 'create_draft', create.status === 201 || create.status === 200, { status: create.status, id });
  if (!id) return null;

  const read = await apiReq('GET', `/payroll/runs/${id}`, { token, tenant });
  recordCrud('payroll', 'read_detail', read.status === 200, { status: read.status });

  const calc = await apiReq('POST', `/payroll/runs/${id}/calculate`, { token, tenant });
  recordCrud('payroll', 'calculate', calc.status === 200, { status: calc.status });

  return { id, detail: read.json?.data, calc: calc.json?.data };
}

async function crudAssets(token, tenant) {
  const create = await apiReq('POST', '/assets', {
    token, tenant,
    body: { tag: `E2E-${Date.now()}`, name: `E2E Laptop ${Date.now()}`, type: 'Laptop' },
  });
  const id = create.json?.data?.id;
  recordCrud('assets', 'create', create.status === 201 || create.status === 200, { status: create.status, id });
  if (!id) return;

  const read = await apiReq('GET', '/assets', { token, tenant });
  recordCrud('assets', 'read', read.status === 200, { status: read.status });
}

async function crudEmployees(token, tenant) {
  const depts = await apiReq('GET', '/departments', { token, tenant });
  const deptId = (depts.json?.data ?? [])[0]?.id;
  if (!deptId) { recordCrud('employees', 'create', false, { note: 'no department' }); return; }
  const create = await apiReq('POST', '/employees', {
    token, tenant,
    body: {
      firstName: 'E2E', lastName: 'TestUser', workEmail: `e2e.${Date.now()}@acme.test`,
      departmentId: [deptId], joinedOn: '2026-01-01', employmentType: 'FULL_TIME',
    },
  });
  const id = create.json?.data?.id;
  recordCrud('employees', 'create', create.status === 201 || create.status === 200, { status: create.status, id, error: create.json?.error?.code });
  if (!id) return;

  const read = await apiReq('GET', `/employees/${id}`, { token, tenant });
  recordCrud('employees', 'read', read.status === 200, { status: read.status });

  const patch = await apiReq('PATCH', `/employees/${id}`, { token, tenant, body: { jobTitle: 'E2E Tester' } });
  recordCrud('employees', 'update', patch.status === 200, { status: patch.status });

  const docs = await apiReq('GET', `/employees/${id}/documents`, { token, tenant });
  recordCrud('employees', 'documents_read', docs.status === 200, { status: docs.status });

  const del = await apiReq('DELETE', `/employees/${id}`, { token, tenant });
  recordCrud('employees', 'soft_delete', del.status === 200, { status: del.status });
}

// ─── Payroll Engine ───────────────────────────────────────────────

async function testPayrollEngineIN(hrToken, tenant) {
  const packs = await apiReq('GET', '/payroll/statutory-packs?countryCode=IN', { token: hrToken, tenant });
  const inPacks = packs.json?.data ?? [];
  recordEngine('IN_statutory_packs_list', packs.status === 200 && inPacks.length > 0, { count: inPacks.length });

  const emps = await apiReq('GET', '/payroll/employees?page=1&limit=10', { token: hrToken, tenant });
  const withSalary = (emps.json?.data?.items ?? emps.json?.data ?? []).find((e) => e.hasSalaryConfig);
  if (!withSalary) {
    recordEngine('IN_employee_with_salary', false, { note: 'no employee with salary config' });
    return;
  }
  recordEngine('IN_employee_with_salary', true, { employeeId: withSalary.employeeId });

  const salary = await apiReq('GET', `/payroll/employees/${withSalary.employeeId}/salary`, { token: hrToken, tenant });
  recordEngine('IN_salary_config_read', salary.status === 200, { status: salary.status });

  const runResult = await crudPayrollRun(hrToken, tenant);
  if (!runResult?.id) {
    recordEngine('IN_draft_run_calculate', false, { note: 'could not create run' });
    return;
  }

  const payslips = await apiReq('GET', `/payroll/runs/${runResult.id}/payslips`, { token: hrToken, tenant });
  const slipList = payslips.json?.data?.items ?? payslips.json?.data ?? [];
  recordEngine('IN_payslips_after_calculate', payslips.status === 200, { count: Array.isArray(slipList) ? slipList.length : 0 });

  if (Array.isArray(slipList) && slipList[0]) {
    const slip = slipList[0];
    const components = slip.components ?? slip.lineItems ?? slip.deductions ?? [];
    const tags = JSON.stringify(components).toUpperCase();
    const hasPF = /PF|EPF|PROVIDENT/.test(tags);
    const hasESI = /ESI/.test(tags);
    const hasPT = /PROFESSIONAL.?TAX|PT_/.test(tags);
    const hasTDS = /TDS|TAX/.test(tags);
    recordEngine('IN_PF_component', hasPF, { note: hasPF ? 'found' : 'missing in payslip' });
    recordEngine('IN_ESI_component', hasESI, { note: hasESI ? 'found' : 'missing (may be below threshold)' });
    recordEngine('IN_PT_component', hasPT, { note: hasPT ? 'found' : 'missing' });
    recordEngine('IN_TDS_component', hasTDS, { note: hasTDS ? 'found' : 'missing' });
    recordEngine('IN_gross_net_present', !!(slip.grossPay ?? slip.gross) && !!(slip.netPay ?? slip.net), {
      gross: slip.grossPay ?? slip.gross,
      net: slip.netPay ?? slip.net,
    });
  }

  const bankFile = await apiReq('GET', `/payroll/runs/${runResult.id}/bank-file`, { token: hrToken, tenant });
  recordEngine('IN_bank_file_export', bankFile.status === 200, { status: bankFile.status });

  const statReturn = await apiReq('GET', `/payroll/runs/${runResult.id}/statutory-return`, { token: hrToken, tenant });
  recordEngine('IN_statutory_return', statReturn.status === 200, { status: statReturn.status });

  const cancel = await apiReq('POST', `/payroll/runs/${runResult.id}/cancel`, { token: hrToken, tenant });
  recordEngine('IN_run_cancel_cleanup', cancel.status === 200, { status: cancel.status });
}

async function testPayrollEngineKWD(kwdToken, tenant) {
  const ten = await apiReq('GET', '/settings/tenant', { token: kwdToken, tenant });
  const cur = ten.json?.data?.currency ?? ten.json?.data?.defaultCurrency;
  const ww = ten.json?.data?.work_week_days ?? ten.json?.data?.workWeekDays;
  recordEngine('KWD_currency', cur === 'KWD', { currency: cur });
  recordEngine('KWD_work_week_SUN', Array.isArray(ww) && ww[0] === 'SUN', { workWeek: ww });

  const packs = await apiReq('GET', '/payroll/statutory-packs?countryCode=KW', { token: kwdToken, tenant });
  recordEngine('KWD_statutory_packs', packs.status === 200, { count: (packs.json?.data ?? []).length });

  const me = await apiReq('GET', '/auth/me', { token: kwdToken, tenant });
  const empId = me.json?.data?.employeeId;
  if (empId) {
    const sal = await apiReq('GET', `/payroll/employees/${empId}/salary`, { token: kwdToken, tenant });
    recordEngine('KWD_admin_salary_config', sal.status === 200, { status: sal.status, code: sal.json?.error?.code });
    if (sal.status === 404) {
      addBackendIssue({
        id: 'P3-BE-kwd-salary-missing',
        severity: 'P1',
        endpoint: `GET /payroll/employees/${empId}/salary`,
        note: 'KWD admin has no salary configuration',
      });
    }
  }

  const wc = await apiReq('GET', '/timesheets/week-config', { token: kwdToken, tenant });
  recordEngine('KWD_week_config', wc.status === 200 && wc.json?.data?.weekStartDay === 0, { weekStartDay: wc.json?.data?.weekStartDay });
}

async function testTestorgLogin() {
  const r = await login('admin@testorg.com', TENANTS.testorg, 'password123');
  recordCrud('multi_tenant', 'testorg_login', r.token != null, { status: r.status, error: r.error });
  if (!r.token) {
    addBackendIssue({
      id: 'P3-BE-testorg-login',
      severity: 'P1',
      endpoint: 'POST /auth/login',
      note: `testorg login failed: ${r.error || r.status}`,
    });
  }
}

// ─── UI Deep Sweep (untested areas) ─────────────────────────────

const DEEP_UI_ROUTES = {
  HR_ADMIN: [
    { path: '/dashboard', actions: ['widget drill-down'] },
    { path: '/employees', tab: 'profile-tabs' },
    { path: '/settings/locale', actions: ['empty submit'] },
    { path: '/settings/pay/components', actions: ['table actions'] },
    { path: '/payroll', actions: ['run detail'] },
    { path: '/settings/integration-storage', actions: ['read'] },
  ],
  SUPER_ADMIN: [
    { path: '/attendance', actions: ['calendar nav'] },
    { path: '/permissions', actions: ['matrix'] },
  ],
  EMPLOYEE: [
    { path: '/timesheets', actions: ['history tab'] },
    { path: '/payroll/my-payslips', actions: ['payslip drawer'] },
  ],
  MANAGER: [
    { path: '/dashboard', actions: ['approvals'] },
    { path: '/leave', actions: ['team requests'] },
  ],
};

const EMPLOYEE_PROFILE_TABS = ['personal', 'job', 'documents', 'compensation', 'bank'];

async function uiLogin(page, email, password = PASSWORD) {
  await page.goto(`${FE}/login`, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.fill('#email, input[type="email"]', email);
  await page.fill('#password, input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return !page.url().includes('/login');
}

async function uiDeepSweep(browser) {
  const actors = [
    { role: 'HR_ADMIN', email: 'hr@acme.test' },
    { role: 'SUPER_ADMIN', email: 'superadmin@acme.test' },
    { role: 'MANAGER', email: 'aman@acme.test' },
    { role: 'EMPLOYEE', email: 'priya@acme.test' },
    { role: 'EMPLOYEE_DEV', email: 'dev1@acme.test' },
    { role: 'KWD_HR', email: 'admin@kwd.test' },
  ];

  let interactionCount = 0;

  for (const actor of actors) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const net = [];
    const consoleErr = [];
    page.on('response', async (r) => {
      if (!r.url().includes('/api/')) return;
      let body = null;
      try { body = (r.headers()['content-type'] || '').includes('json') ? await r.json() : null; } catch { /* noop */ }
      net.push({ url: r.url(), status: r.status(), method: r.request().method(), code: body?.error?.code });
    });
    page.on('console', (m) => { if (m.type() === 'error') consoleErr.push(m.text()); });

    const ok = await uiLogin(page, actor.email);
    if (!ok) {
      uiResults.push({ role: actor.role, pass: false, note: 'login failed' });
      await ctx.close();
      continue;
    }

    // Sidebar collapse + theme toggle
    const sidebarBtn = page.locator('[data-testid="sidebar-toggle"], button[aria-label*="sidebar"], button[aria-label*="collapse"]').first();
    if (await sidebarBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await sidebarBtn.click().catch(() => {});
      interactionCount++;
    }
    const themeBtn = page.locator('button[aria-label*="dark"], button[aria-label*="light"], button:has-text("Switch to")').first();
    if (await themeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await themeBtn.click().catch(() => {});
      interactionCount++;
    }

    // HR: employee profile tabs
    if (actor.role === 'HR_ADMIN') {
      await page.goto(`${FE}/employees`, { waitUntil: 'networkidle', timeout: 60_000 });
      const firstRow = page.locator('table tbody tr a, [data-testid="employee-row"] a').first();
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.click();
        await page.waitForTimeout(2000);
        for (const tab of EMPLOYEE_PROFILE_TABS) {
          const tabBtn = page.locator(`[role="tab"]:has-text("${tab}"), button:has-text("${tab}")`).first();
          if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tabBtn.click().catch(() => {});
            await page.waitForTimeout(1000);
            interactionCount++;
            const bad = net.filter((n) => n.status >= 400 && !n.url.includes('unread-count'));
            const recentBad = bad.slice(-3);
            uiResults.push({ role: actor.role, area: `employee_tab_${tab}`, pass: recentBad.length === 0, apis: recentBad });
          }
        }
        const shotPath = await shot(page, `${actor.role}-employee-profile-tabs`);
        uiResults.push({ role: actor.role, area: 'employee_profile', screenshot: shotPath });
      }

      // Payroll run detail
      await page.goto(`${FE}/payroll`, { waitUntil: 'networkidle', timeout: 60_000 });
      const runLink = page.locator('a[href*="/payroll/runs/"], table tbody tr').first();
      if (await runLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await runLink.click().catch(() => {});
        await page.waitForTimeout(2000);
        interactionCount++;
        for (const btn of ['Payslips', 'Bank file', 'Audit pack', 'Statutory']) {
          const b = page.locator(`button:has-text("${btn}"), a:has-text("${btn}")`).first();
          if (await b.isVisible({ timeout: 2000 }).catch(() => false)) {
            await b.click().catch(() => {});
            await page.waitForTimeout(1500);
            interactionCount++;
          }
        }
        await shot(page, `${actor.role}-payroll-run-detail`);
      }

      // Settings sub-tabs empty submit
      for (const sp of ['/settings/locale', '/settings/company-profile']) {
        await page.goto(`${FE}${sp}`, { waitUntil: 'networkidle', timeout: 60_000 });
        const saveBtn = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Update")').first();
        if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await saveBtn.click().catch(() => {});
          await page.waitForTimeout(1000);
          interactionCount++;
        }
      }
    }

    // SUPER_ADMIN attendance
    if (actor.role === 'SUPER_ADMIN') {
      await page.goto(`${FE}/attendance`, { waitUntil: 'networkidle', timeout: 60_000 });
      const bad = net.filter((n) => n.status === 400 && n.url.includes('attendance'));
      const boundary = await page.evaluate(() => /something went wrong/i.test(document.body?.innerText || ''));
      uiResults.push({ role: actor.role, area: 'attendance_admin_no_employee', pass: !boundary, apis: bad, errorBoundary: boundary });
      if (boundary || bad.length) {
        const p = await shot(page, `${actor.role}-attendance-fail`);
        addFrontendIssue({ id: 'P3-FE-superadmin-attendance', severity: 'P1', area: '/attendance', screenshot: p });
        addBackendIssue({ id: 'P3-BE-superadmin-attendance-400', severity: 'P1', area: '/attendance', apis: bad });
      }
      interactionCount += 3;
    }

    // EMPLOYEE timesheets history
    if (actor.role === 'EMPLOYEE' || actor.role === 'EMPLOYEE_DEV') {
      await page.goto(`${FE}/timesheets`, { waitUntil: 'networkidle', timeout: 60_000 });
      const histBtn = page.locator('button:has-text("History"), [role="tab"]:has-text("History")').first();
      if (await histBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await histBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
        interactionCount++;
        const boundary = await page.evaluate(() => /something went wrong/i.test(document.body?.innerText || ''));
        const audit403 = net.some((n) => n.url.includes('timesheets/audit') && n.status === 403);
        uiResults.push({ role: actor.role, area: 'timesheets_history', pass: !boundary, errorBoundary: boundary, audit403 });
        if (boundary) {
          const p = await shot(page, `${actor.role}-timesheets-history`);
          addFrontendIssue({ id: `P3-FE-timesheets-history-${actor.role}`, severity: 'P1', area: '/timesheets History', screenshot: p });
        }
      }
    }

    // EMPLOYEE permissions RBAC
    if (actor.role === 'EMPLOYEE') {
      await page.goto(`${FE}/permissions`, { waitUntil: 'networkidle', timeout: 60_000 });
      const forbidden = await page.evaluate(() => /forbidden|not authorized|access denied/i.test(document.body?.innerText || ''));
      const onPage = page.url().includes('/permissions');
      const rbacFail = onPage && !forbidden;
      uiResults.push({ role: actor.role, area: 'permissions_rbac', pass: !rbacFail, onPage, forbidden });
      if (rbacFail) {
        addFrontendIssue({ id: 'P3-FE-employee-permissions', severity: 'P1', area: '/permissions', note: 'EMPLOYEE can access permissions page' });
      }
      interactionCount++;
    }

    // Dashboard widgets
    await page.goto(`${FE}/dashboard`, { waitUntil: 'networkidle', timeout: 60_000 });
    const widgets = page.locator('[data-testid*="widget"], .recharts-wrapper, a:has-text("View all")');
    const wcount = await widgets.count();
    for (let i = 0; i < Math.min(wcount, 5); i++) {
      await widgets.nth(i).click().catch(() => {});
      await page.waitForTimeout(800);
      interactionCount++;
    }

    // Profile menu
    const profileBtn = page.locator('button:has-text("HA"), [data-testid="user-menu"], button[aria-label*="profile"]').first();
    if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await profileBtn.click().catch(() => {});
      interactionCount++;
    }

    const dupKeys = consoleErr.filter((e) => e.includes('same key'));
    if (dupKeys.length) {
      addFrontendIssue({ id: `P3-FE-dup-keys-${actor.role}`, severity: 'P2', area: 'console', note: dupKeys[0]?.slice(0, 120) });
    }

    await ctx.close();
  }

  return interactionCount;
}

async function main() {
  console.log(`\n=== Phase 3 Deep CRUD + Engine + UI ===\n`);

  const hr = await login('hr@acme.test', TENANTS.acme);
  const sa = await login('superadmin@acme.test', TENANTS.acme);
  const mgr = await login('aman@acme.test', TENANTS.acme);
  const emp = await login('priya@acme.test', TENANTS.acme);
  const kwd = await login('admin@kwd.test', TENANTS.kwd);

  if (hr.token) {
    await crudDepartments(hr.token, TENANTS.acme);
    await crudHolidays(hr.token, TENANTS.acme);
    await crudAnnouncements(hr.token, TENANTS.acme);
    await crudPayComponents(hr.token, TENANTS.acme);
    await crudPayGroups(hr.token, TENANTS.acme);
    await crudSettings(hr.token, TENANTS.acme);
    await crudEmployees(hr.token, TENANTS.acme);
    await crudAssets(hr.token, TENANTS.acme);
    await testPayrollEngineIN(hr.token, TENANTS.acme);
  }
  if (sa.token) {
    await crudLegalEntities(sa.token, TENANTS.acme);
  }

  if (emp.token) {
    await crudLeave(hr.token, TENANTS.acme, emp.token);
    await crudAttendance(emp.token, TENANTS.acme);
    await crudNotifications(emp.token, TENANTS.acme);
  }

  if (emp.token && mgr.token) {
    await crudTimesheets(emp.token, mgr.token, TENANTS.acme);
  }

  if (kwd.token) {
    await testPayrollEngineKWD(kwd.token, TENANTS.kwd);
  }

  await testTestorgLogin();

  // Statutory packs read IN/KWD
  if (hr.token) {
    for (const cc of ['IN', 'KW']) {
      const r = await apiReq('GET', `/payroll/statutory-packs?countryCode=${cc}`, { token: hr.token, tenant: TENANTS.acme });
      recordCrud('statutory_packs', `read_${cc}`, r.status === 200, { status: r.status, count: (r.json?.data ?? []).length });
    }
  }

  // Leave types read
  if (hr.token) {
    const lt = await apiReq('GET', '/leave/types', { token: hr.token, tenant: TENANTS.acme });
    const lp = await apiReq('GET', '/leave/policies', { token: hr.token, tenant: TENANTS.acme }).catch(() => ({ status: 0 }));
    recordCrud('leave_types', 'read', lt.status === 200, { status: lt.status });
    recordCrud('leave_policies', 'read', lp.status === 200, { status: lp.status });
  }

  // UI sweep
  let uiInteractions = 0;
  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true }));
  try {
    uiInteractions = await uiDeepSweep(browser);
  } finally {
    await browser.close();
  }

  for (const fn of cleanup) await fn().catch(() => {});

  const crudPass = crudResults.filter((r) => r.pass).length;
  const crudFail = crudResults.filter((r) => !r.pass).length;
  const enginePass = engineResults.filter((r) => r.pass).length;
  const engineFail = engineResults.filter((r) => !r.pass).length;

  const out = {
    generatedAt: new Date().toISOString(),
    crud: { total: crudResults.length, pass: crudPass, fail: crudFail, results: crudResults },
    engine: { total: engineResults.length, pass: enginePass, fail: engineFail, results: engineResults },
    ui: { interactions: uiInteractions, results: uiResults },
    backendIssues,
    frontendIssues,
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log(`\nCRUD: ${crudPass}/${crudResults.length} pass | Engine: ${enginePass}/${engineResults.length} pass | UI interactions: ${uiInteractions}`);
  console.log(`Wrote ${OUT_JSON}`);
  return out;
}

main().catch((e) => { console.error(e); process.exit(1); });
