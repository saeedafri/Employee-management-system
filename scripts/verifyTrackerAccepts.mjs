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
import { inflateSync } from 'node:zlib';

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
// The previous version of this block asserted `status === 200` and counted rows.
// It passed for weeks while the endpoint returned every job in the tenant to
// every role, because it never asked the only question that matters: can the
// caller see a row that provably is not theirs? This version constructs that row.
{
  // 1. Establish that the EMPLOYEE cannot create an export job at all.
  const denials = [];
  for (const [path, body] of [
    ['/export/employees', { format: 'csv' }],
    ['/export/attendance', { format: 'csv', from_date: '2026-08-01', to_date: '2026-08-16' }],
    ['/export/leave', { format: 'csv', from_date: '2026-08-01', to_date: '2026-08-16' }],
  ]) {
    const res = await call(path, { token: tokens.EMPLOYEE, method: 'POST', body });
    denials.push(`${path}=${res.status}`);
  }
  check('BE-3', 'EMPLOYEE cannot create any export job', denials.every((d) => d.endsWith('=403')), denials.join(' '));

  // 2. HR creates one. By step 1 it cannot belong to the employee.
  const created = await call('/export/employees', { token: tokens.HR_ADMIN, method: 'POST', body: { format: 'csv' } });
  const foreignJobId = created.json.data?.job_id;
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 3. The decisive assertion.
  const employee = await call('/export/list?page=1&limit=50', { token: tokens.EMPLOYEE });
  const jobs = employee.json.data?.exports ?? [];
  const ids = jobs.map((job) => job.job_id);
  // The 200 check is load-bearing. Without it a 500 returns no rows, the
  // "job not present" assertion passes, and a broken endpoint reads as secure.
  // An assertion that a failure can satisfy is not an assertion.
  check('BE-3', 'the scoped listing actually succeeded (not a 5xx reading as empty)',
    employee.status === 200, `status ${employee.status}`);
  check('BE-3', "EMPLOYEE cannot see HR's freshly created job",
    employee.status === 200 && Boolean(foreignJobId) && !ids.includes(foreignJobId),
    `job ${String(foreignJobId).slice(0, 8)} in a list of ${ids.length}`);

  const hr = await call('/export/list?page=1&limit=50', { token: tokens.HR_ADMIN });
  const hrIds = (hr.json.data?.exports ?? []).map((job) => job.job_id);
  check('BE-3', 'the two lists are NOT identical (they were, when it leaked)',
    employee.status === 200 && hr.status === 200
      && !(hrIds.length === ids.length && hrIds.every((id) => ids.includes(id))),
    `EMPLOYEE ${ids.length} · HR ${hrIds.length}`);
  check('BE-3', 'HR_ADMIN still sees the job it created', hrIds.includes(foreignJobId), `${hrIds.length} jobs`);
  check('BE-3', 'file_url is not in the list response', jobs.every((job) => !('file_url' in job)));
}

// ── NEW-1 / NEW-2 / NEW-3 (from the FE verification report) ─────────────────
{
  const managerKeys = JSON.parse(Buffer.from(tokens.MANAGER.split('.')[1], 'base64url').toString()).permissions ?? [];
  const hrClaims = JSON.parse(Buffer.from(tokens.HR_ADMIN.split('.')[1], 'base64url').toString());

  // NEW-1's real complaint was that a role's keys stopped predicting its access.
  // The MANAGER path allowlist is gone; the team dashboard is its own key. So the
  // matrix, the token and the API must now agree in BOTH directions.
  check('NEW-1', 'MANAGER holds analytics:team-read, not tenant-wide analytics:read',
    managerKeys.includes('analytics:team-read') && !managerKeys.includes('analytics:read'),
    `${managerKeys.length} keys`);

  const matrix = await call('/settings/roles-permissions', { token: tokens.SUPER_ADMIN });
  const matrixManager = (matrix.json.data?.matrix ?? matrix.json.matrix)?.MANAGER ?? [];
  check('NEW-1', 'the settings matrix agrees with the minted token',
    matrixManager.includes('analytics:team-read') === managerKeys.includes('analytics:team-read')
      && matrixManager.includes('analytics:read') === managerKeys.includes('analytics:read'),
    `matrix ${matrixManager.length} · token ${managerKeys.length}`);

  const summary = await call('/analytics/summary', { token: tokens.MANAGER });
  check('NEW-1', 'MANAGER denied tenant-wide analytics, naming the key it actually lacks',
    summary.status === 403 && summary.json.error?.details?.requiredPermission === 'analytics:read',
    `${summary.status} ${summary.json.error?.details?.requiredPermission}`);
  const deptPerf = await call('/analytics/department-performance', { token: tokens.MANAGER });
  check('NEW-1', 'MANAGER keeps the team dashboard it always had', deptPerf.status === 200, `got ${deptPerf.status}`);
  const hrSummary = await call('/analytics/summary', { token: tokens.HR_ADMIN });
  check('NEW-1', 'HR_ADMIN tenant-wide analytics unaffected (control)', hrSummary.status === 200, `got ${hrSummary.status}`);

  check('NEW-2', 'HR_ADMIN holds leave:request', (JSON.parse(Buffer.from(tokens.HR_ADMIN.split('.')[1], 'base64url').toString()).permissions ?? []).includes('leave:request'));

  check('NEW-3', 'the JWT carries an email claim (actor name was always "Approver")',
    typeof hrClaims.email === 'string' && hrClaims.email.includes('@'), String(hrClaims.email));
  check('NEW-3', 'the JWT still carries sub (request.user.id derives from it)', typeof hrClaims.sub === 'string');
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

  // BE-7 on production without seeding a payslip. The claim under test is that
  // the embedded font can draw the rupee. The tax-form PDF formats money through
  // Intl with style:'currency' and renders it with the same embedded Noto face as
  // the payslip, so if U+20B9 appears in this document's ToUnicode CMap -- the
  // glyph->Unicode map for text actually drawn -- the rupee renders on this host.
  if (bytes.subarray(0, 5).toString() === '%PDF-') {
    const latin = bytes.toString('latin1');
    let rupee = false;
    for (const match of latin.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
      try {
        if (/20B9/i.test(inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1'))) { rupee = true; break; }
      } catch { /* not a flate stream */ }
    }
    check('BE-7', 'a Unicode font is embedded (not WinAnsi Helvetica)',
      /NotoSans/.test(latin) && !/BaseFont\s*\/Helvetica/.test(latin));
    check('BE-7', 'U+20B9 present in a PDF rendered on THIS host', rupee,
      rupee ? 'rupee is in the drawn text' : 'not found — currency may not be INR on this tenant');
  }
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
  // There is no /payroll/payslips; payslips are listed per employee.
  const me = await call('/auth/me', { token: tokens.EMPLOYEE });
  const selfId = me.json.data?.employeeId ?? me.json.data?.employee?.id;
  const payslips = await call(`/payroll/employees/${selfId}/payslips?page=1&limit=1`, { token: tokens.EMPLOYEE });
  const list = payslips.json.data?.payslips ?? payslips.json.data?.items ?? payslips.json.data ?? [];
  const payslip = Array.isArray(list) ? list[0] : undefined;
  if (!payslip?.id) {
    check('BE-7', 'a payslip exists to render', false,
      `no payslip for ${selfId} (status ${payslips.status})`);
  } else {
    const response = await call(`/payroll/employees/${selfId}/payslips/${payslip.id}/download`, {
      token: tokens.EMPLOYEE, raw: true,
    });
    const pdf = Buffer.from(await response.arrayBuffer()).toString('latin1');
    check('BE-7', 'payslip PDF embeds a Unicode font (rupee renders)',
      /NotoSans/.test(pdf) && !/BaseFont\s*\/Helvetica/.test(pdf));
  }
}

// ── BE-9(b) ─────────────────────────────────────────────────────────────────
{
  // Only meaningful when the account genuinely has no Employee row. On a
  // defaults-seeded database SUPER_ADMIN IS linked to an employee, so the
  // endpoint correctly returns real data -- reporting that as a failure would be
  // a false alarm, and silently passing it would be worse.
  const me = await call('/auth/me', { token: tokens.SUPER_ADMIN });
  const linked = Boolean(me.json.data?.employeeId ?? me.json.data?.employee?.id);
  for (const path of ['/attendance/today', '/employee/dashboard']) {
    const { status, json } = await call(path, { token: tokens.SUPER_ADMIN });
    if (linked) {
      check('BE-9', `SUPER_ADMIN → GET ${path} reachable (has an employee record here)`,
        status === 200, `got ${status} — empty-state path not exercisable on this data`);
    } else {
      check('BE-9', `SUPER_ADMIN → GET ${path} is 200 with noEmployeeRecord`,
        status === 200 && json.data?.noEmployeeRecord === true, `got ${status}`);
    }
  }
}

const failed = results.filter((result) => !result.passed);
console.log(`\n${results.length - failed.length}/${results.length} accept checks passed.`);
if (failed.length) {
  console.log('Failing:');
  for (const result of failed) console.log(`  ${result.id}  ${result.description}  ${result.detail}`);
  process.exit(1);
}
