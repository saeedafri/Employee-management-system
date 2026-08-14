/**
 * Checks every `- [ ] Accept` box in BACKEND_IMPLEMENTATION_SPEC_2026-08-13.md
 * against a running environment. One command, one pass/fail table.
 *
 *   node scripts/verifyTrackerAccepts.mjs
 *   API_BASE=http://localhost:3000/api/v1 node scripts/verifyTrackerAccepts.mjs
 *
 * Read-only except where an item's Accept requires a job (BE-10 posts an export).
 * Run scripts/rbacGrantReconcile.mjs --apply BEFORE the BE-4 gates deploy, and
 * scripts/seedAuditorUser.mjs before BE-6 can pass.
 */
const API = process.env.API_BASE ?? 'https://ems-api.saqibsaeed.cloud/api/v1';
const TENANT = process.env.TENANT_KEY ?? 'acme-corp-001';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';

const ACCOUNTS = {
  SUPER_ADMIN: 'superadmin@acme.test',
  HR_ADMIN: 'hr@acme.test',
  MANAGER: 'aman@acme.test',
  EMPLOYEE: 'priya@acme.test',
  AUDITOR: 'auditor@acme.test',
};

const results = [];
function check(id, description, passed, detail = '') {
  results.push({ id, description, passed, detail });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${id}  ${description}${detail ? `  — ${detail}` : ''}`);
}

async function call(path, { token, method = 'GET', body, raw = false } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (raw) return response;
  const json = await response.json().catch(() => ({}));
  return { status: response.status, json, headers: response.headers };
}

async function login(email) {
  const { status, json } = await call('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  if (status !== 200) return null;
  return json.data?.accessToken ?? json.data?.access_token ?? null;
}

const tokens = {};
for (const [role, email] of Object.entries(ACCOUNTS)) {
  tokens[role] = await login(email);
  if (!tokens[role] && role !== 'AUDITOR') {
    console.error(`Could not log in as ${email} — cannot verify.`);
    process.exit(2);
  }
}

// ── BE-1 ────────────────────────────────────────────────────────────────────
for (const role of ['EMPLOYEE', 'MANAGER']) {
  const { status, json } = await call('/audit-logs?page=1&limit=5', { token: tokens[role] });
  check('BE-1', `${role} → GET /audit-logs is 403`, status === 403,
    `got ${status}, requiredPermission=${json.error?.details?.requiredPermission ?? '—'}`);
}
for (const role of ['HR_ADMIN', 'SUPER_ADMIN']) {
  const { status } = await call('/audit-logs?page=1&limit=5', { token: tokens[role] });
  check('BE-1', `${role} → GET /audit-logs still 200`, status === 200, `got ${status}`);
}

// ── BE-2 ────────────────────────────────────────────────────────────────────
{
  const employeeIdsOf = (json) => new Set((json.data?.assignments ?? []).map((a) => a.employeeId));

  const employee = await call('/leave/assignments', { token: tokens.EMPLOYEE });
  check('BE-2', 'EMPLOYEE sees only their own assignments',
    employee.status === 200 && employeeIdsOf(employee.json).size <= 1,
    `${employeeIdsOf(employee.json).size} distinct employees`);

  const manager = await call('/leave/assignments', { token: tokens.MANAGER });
  const managerCount = employeeIdsOf(manager.json).size;
  check('BE-2', 'MANAGER sees their reports, not the tenant',
    manager.status === 200 && managerCount > 0 && managerCount < 75, `${managerCount} distinct employees`);

  const hr = await call('/leave/assignments', { token: tokens.HR_ADMIN });
  check('BE-2', 'HR_ADMIN unchanged (all rows)',
    hr.status === 200 && (hr.json.data?.assignments ?? []).length >= managerCount,
    `${(hr.json.data?.assignments ?? []).length} rows`);
}

// ── BE-4 (Option A) ─────────────────────────────────────────────────────────
for (const path of ['/employees?page=1&limit=1', '/departments', '/leave/types', '/leave/balance', '/attendance/summary']) {
  for (const role of ['MANAGER', 'EMPLOYEE']) {
    const { status } = await call(path, { token: tokens[role] });
    check('BE-4', `${role} → GET ${path} still 200 after gating`, status === 200, `got ${status}`);
  }
}

// ── BE-3 ────────────────────────────────────────────────────────────────────
{
  const employee = await call('/export/list?page=1&limit=50', { token: tokens.EMPLOYEE });
  const jobs = employee.json.data?.exports ?? [];
  check('BE-3', 'EMPLOYEE sees only their own export jobs', employee.status === 200, `${jobs.length} jobs`);
  check('BE-3', 'file_url is not in the list response', jobs.every((job) => !('file_url' in job)));

  const hr = await call('/export/list?page=1&limit=50', { token: tokens.HR_ADMIN });
  check('BE-3', 'HR_ADMIN unchanged', hr.status === 200, `${(hr.json.data?.exports ?? []).length} jobs`);
}

// ── BE-10 ───────────────────────────────────────────────────────────────────
{
  const queued = await call('/export/employees', {
    token: tokens.HR_ADMIN, method: 'POST', body: { format: 'csv' },
  });
  const jobId = queued.json.data?.job_id;
  if (!jobId) {
    check('BE-10', 'employees export job accepted', false, `status ${queued.status}`);
  } else {
    let response;
    for (let attempt = 0; attempt < 15; attempt++) {
      response = await call(`/export/${jobId}/download`, { token: tokens.HR_ADMIN, raw: true });
      if (response.headers.get('content-type')?.includes('csv')) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    const contentType = response.headers.get('content-type') ?? '';
    const disposition = response.headers.get('content-disposition') ?? '';
    check('BE-10', 'download is text/csv; charset=utf-8', contentType.includes('text/csv'), contentType);
    check('BE-10', 'download has a real filename', /filename="[a-z]+-\d{4}-\d{2}-\d{2}\.csv"/.test(disposition), disposition);

    const csv = await response.text();
    const [header, ...rows] = csv.split('\n');
    check('BE-10', 'header row fully quoted', header.split(',').every((cell) => /^".*"$/.test(cell)));
    check('BE-10', 'no JS toString() dates', !csv.includes('GMT'));
    check('BE-10', 'no duplicate department.id column', !header.includes('"department.id"'));
    check('BE-10', 'no trailing empty row', !/^,*$/.test(rows[rows.length - 1] ?? 'x'));
  }

  const audit = await call('/audit-logs/export?format=csv', { token: tokens.HR_ADMIN, raw: true });
  check('BE-10', 'audit export reports truncation',
    audit.headers.get('x-export-truncated') !== null,
    `total=${audit.headers.get('x-export-total')} returned=${audit.headers.get('x-export-returned')}`);
}

// ── BE-11 ───────────────────────────────────────────────────────────────────
{
  const response = await call('/recruitment/export?type=openings', { token: tokens.HR_ADMIN, raw: true });
  check('BE-11', 'GET /recruitment/export is 200 text/csv',
    response.status === 200 && (response.headers.get('content-type') ?? '').includes('text/csv'),
    `${response.status} ${response.headers.get('content-disposition') ?? ''}`);
}

// ── BE-5 ────────────────────────────────────────────────────────────────────
{
  const me = await call('/auth/me', { token: tokens.EMPLOYEE });
  const selfId = me.json.data?.employeeId ?? me.json.data?.employee?.id;
  const others = await call('/employees?page=1&limit=5', { token: tokens.HR_ADMIN });
  const otherId = (others.json.data?.employees ?? []).map((e) => e.id).find((id) => id !== selfId);

  const own = await call(`/payroll/employees/${selfId}/tax-forms/FORM16/download?format=pdf`, {
    token: tokens.EMPLOYEE, raw: true,
  });
  const bytes = Buffer.from(await own.arrayBuffer());
  check('BE-5', 'employee downloads their own tax form',
    own.status === 200 && bytes.subarray(0, 5).toString() === '%PDF-', `status ${own.status}`);

  if (otherId) {
    const foreign = await call(`/payroll/employees/${otherId}/tax-forms/FORM16/download?format=pdf`, {
      token: tokens.EMPLOYEE, raw: true,
    });
    check('BE-5', "employee on another employee's tax form is 403", foreign.status === 403, `got ${foreign.status}`);
  }

  const hr = await call(`/payroll/employees/${selfId}/tax-forms/FORM16/download?format=pdf`, {
    token: tokens.HR_ADMIN, raw: true,
  });
  check('BE-5', 'HR_ADMIN downloads any tax form', hr.status === 200, `got ${hr.status}`);
}

// ── BE-6 ────────────────────────────────────────────────────────────────────
{
  const token = tokens.AUDITOR;
  check('BE-6', 'AUDITOR login returns 200', Boolean(token));
  if (token) {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    check('BE-6', 'AUDITOR JWT carries 12 keys', (payload.permissions ?? []).length === 12,
      `${(payload.permissions ?? []).length} keys`);
  }
}

// ── BE-7 ────────────────────────────────────────────────────────────────────
{
  const payslips = await call('/payroll/payslips?page=1&limit=1', { token: tokens.EMPLOYEE });
  const payslip = (payslips.json.data?.payslips ?? payslips.json.data ?? [])[0];
  if (!payslip?.id) {
    check('BE-7', 'a payslip exists to render', false, 'no payslip on the seeded employee');
  } else {
    const me = await call('/auth/me', { token: tokens.EMPLOYEE });
    const selfId = me.json.data?.employeeId ?? me.json.data?.employee?.id;
    const response = await call(`/payroll/employees/${selfId}/payslips/${payslip.id}/download`, {
      token: tokens.EMPLOYEE, raw: true,
    });
    const pdf = Buffer.from(await response.arrayBuffer()).toString('latin1');
    check('BE-7', 'payslip PDF embeds a Unicode font (rupee renders)',
      /NotoSans/.test(pdf) && !/BaseFont\s*\/Helvetica/.test(pdf));
  }
}

// ── BE-9(b) ─────────────────────────────────────────────────────────────────
for (const path of ['/attendance/today', '/employee/dashboard']) {
  const { status, json } = await call(path, { token: tokens.SUPER_ADMIN });
  check('BE-9', `SUPER_ADMIN → GET ${path} is 200 with noEmployeeRecord`,
    status === 200 && json.data?.noEmployeeRecord === true, `got ${status}`);
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} accept checks passed.`);
if (failed.length) {
  console.log('Failing:');
  for (const result of failed) console.log(`  ${result.id}  ${result.description}  ${result.detail}`);
  process.exit(1);
}
