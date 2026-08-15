/**
 * The frontend team's probe, run against a LOCAL backend.
 *
 * Written from the Accept boxes in BACKEND_IMPLEMENTATION_SPEC_2026-08-13.md and
 * from what the UI actually consumes -- deliberately not from the backend's own
 * verify script, so it can disagree with it.
 *
 *   BASE=http://127.0.0.1:4310/api/v1 node scripts/probe-ui-contract.mjs
 *
 * Prints PASS / FAIL / SKIP per Accept box. SKIP means the local seed has no
 * fixture for it -- reported, never silently counted as a pass.
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:4310/api/v1';
const TENANT = process.env.TENANT_KEY ?? 'acme-corp-001';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';

const ACCOUNTS = {
  SUPER_ADMIN: 'superadmin@acme.test',
  HR_ADMIN: 'hr@acme.test',
  MANAGER: 'aman@acme.test',
  EMPLOYEE: 'priya@acme.test',
  AUDITOR: 'auditor@acme.test',
};

const rows = [];
const record = (state, id, what, detail = '') => {
  rows.push({ state, id, what, detail });
  const mark = state === 'PASS' ? 'PASS' : state === 'FAIL' ? 'FAIL' : 'SKIP';
  console.log(`${mark}  ${id.padEnd(6)} ${what}${detail ? `  — ${detail}` : ''}`);
};
const check = (id, what, ok, detail) => record(ok ? 'PASS' : 'FAIL', id, what, detail);
const skip = (id, what, why) => record('SKIP', id, what, why);

async function call(path, { token, method = 'GET', body, raw = false } = {}) {
  const response = await fetch(`${BASE}${path}`, {
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

const token = {};
const permissions = {};
for (const [role, email] of Object.entries(ACCOUNTS)) {
  const { status, json } = await call('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  token[role] = status === 200 ? (json.data?.accessToken ?? json.data?.access_token ?? null) : null;
  if (token[role]) {
    permissions[role] = JSON.parse(Buffer.from(token[role].split('.')[1], 'base64url').toString()).permissions ?? [];
  }
}
if (!token.EMPLOYEE || !token.HR_ADMIN) {
  console.error('Cannot log in as the seeded accounts — is the local DB seeded?');
  process.exit(2);
}

const me = {};
for (const role of Object.keys(ACCOUNTS)) {
  if (!token[role]) continue;
  const { json } = await call('/auth/me', { token: token[role] });
  me[role] = json.data ?? {};
}

console.log('\n── BE-1 · audit trail ─────────────────────────────────────────');
for (const role of ['EMPLOYEE', 'MANAGER']) {
  const { status, json } = await call('/audit-logs?page=1&limit=5', { token: token[role] });
  check('BE-1', `${role} → GET /audit-logs = 403`, status === 403, `got ${status}`);
  check('BE-1', `${role} → details.requiredPermission = "audit:read"`,
    json.error?.details?.requiredPermission === 'audit:read',
    String(json.error?.details?.requiredPermission));
}
for (const role of ['HR_ADMIN', 'SUPER_ADMIN']) {
  const { status } = await call('/audit-logs?page=1&limit=5', { token: token[role] });
  check('BE-1', `${role} → GET /audit-logs still 200`, status === 200, `got ${status}`);
}

console.log('\n── BE-2 · leave assignments ───────────────────────────────────');
{
  const distinct = (json) => new Set((json.data?.assignments ?? []).map((a) => a.employeeId));
  const emp = await call('/leave/assignments', { token: token.EMPLOYEE });
  const empIds = distinct(emp.json);
  const hr = await call('/leave/assignments', { token: token.HR_ADMIN });
  const hrIds = distinct(hr.json);
  const mgr = await call('/leave/assignments', { token: token.MANAGER });
  const mgrIds = distinct(mgr.json);

  if (hrIds.size === 0) {
    skip('BE-2', 'row-scoping', 'no leave assignments in the local seed');
  } else {
    check('BE-2', 'EMPLOYEE sees own rows only', empIds.size <= 1, `${empIds.size} employees`);
    check('BE-2', 'MANAGER sees fewer than the whole tenant', mgrIds.size < hrIds.size,
      `${mgrIds.size} of ${hrIds.size}`);
    check('BE-2', 'HR_ADMIN unchanged', hr.status === 200, `${hrIds.size} employees`);
  }
  // Scope cannot be widened by a query param.
  const other = [...hrIds].find((id) => !empIds.has(id));
  if (other) {
    const forced = await call(`/leave/assignments?employeeId=${other}`, { token: token.EMPLOYEE });
    check('BE-2', '?employeeId= cannot widen an EMPLOYEE\'s scope',
      (forced.json.data?.assignments ?? []).length === 0,
      `${(forced.json.data?.assignments ?? []).length} rows leaked`);
  }
}

console.log('\n── BE-4 · are the keys enforced? ──────────────────────────────');
{
  const GATED = [
    ['/employees?page=1&limit=1', 'employees:read'],
    ['/departments', 'departments:read'],
    ['/leave/types', 'leave:read'],
    ['/leave/requests?page=1&limit=1', 'leave:read'],
    ['/leave/balance', 'leave:read'],
    ['/attendance/records', 'attendance:read'],
    ['/attendance/summary', 'attendance:read'],
  ];
  for (const [path, key] of GATED) {
    for (const role of ['MANAGER', 'EMPLOYEE']) {
      const { status } = await call(path, { token: token[role] });
      const holds = permissions[role].includes(key);
      check('BE-4', `${role} holds ${key} → ${path} reachable`,
        holds && status !== 403, `holds=${holds} status=${status}`);
    }
  }
  // The half the tracker warns about: gate without grant would 403 core screens.
  for (const role of ['MANAGER', 'EMPLOYEE']) {
    const missing = ['employees:read', 'departments:read', 'leave:read', 'attendance:read']
      .filter((key) => !permissions[role].includes(key));
    check('BE-4', `${role} grant top-up landed`, missing.length === 0,
      missing.length ? `missing ${missing.join(', ')}` : `${permissions[role].length} keys`);
  }
}

console.log('\n── BE-3 · export job list ─────────────────────────────────────');
{
  const emp = await call('/export/list?page=1&limit=50', { token: token.EMPLOYEE });
  const hr = await call('/export/list?page=1&limit=50', { token: token.HR_ADMIN });
  const empJobs = emp.json.data?.exports ?? [];
  check('BE-3', 'EMPLOYEE → 200', emp.status === 200, `${empJobs.length} jobs`);
  check('BE-3', 'no file_url in the list response',
    empJobs.every((job) => !('file_url' in job)) && (hr.json.data?.exports ?? []).every((j) => !('file_url' in j)));
  check('BE-3', 'HR_ADMIN → 200', hr.status === 200, `${(hr.json.data?.exports ?? []).length} jobs`);
}

console.log('\n── BE-11 · recruitment export ─────────────────────────────────');
{
  const response = await call('/recruitment/export?type=openings', { token: token.HR_ADMIN, raw: true });
  const type = response.headers.get('content-type') ?? '';
  const disposition = response.headers.get('content-disposition') ?? '';
  check('BE-11', 'GET /recruitment/export → 200 text/csv',
    response.status === 200 && type.includes('text/csv'), `${response.status} ${type}`);
  check('BE-11', 'real filename', /filename="recruitment-openings-\d{4}-\d{2}-\d{2}\.csv"/.test(disposition), disposition);
  const csv = await response.text();
  const header = csv.split('\n')[0] ?? '';
  check('BE-11', 'header row fully quoted',
    header.length > 0 && header.split(',').every((cell) => /^".*"$/.test(cell)), header.slice(0, 60));
}

console.log('\n── BE-9 · the two intents ─────────────────────────────────────');
{
  for (const path of ['/attendance/today', '/employee/dashboard']) {
    const { status, json } = await call(path, { token: token.SUPER_ADMIN });
    const hasEmployee = Boolean(me.SUPER_ADMIN?.employeeId ?? me.SUPER_ADMIN?.user?.employeeId);
    if (hasEmployee) {
      skip('BE-9b', `${path} empty-state`, 'this SUPER_ADMIN has an employee record locally');
    } else {
      check('BE-9b', `SUPER_ADMIN → ${path} = 200 noEmployeeRecord`,
        status === 200 && json.data?.noEmployeeRecord === true, `got ${status}`);
    }
  }
  // BE-9(a): a manager may open a direct report.
  const team = await call('/manager/team', { token: token.MANAGER });
  const members = team.json.data?.team ?? team.json.data?.members ?? team.json.data ?? [];
  const report = Array.isArray(members) ? members[0] : null;
  const reportId = report?.id ?? report?.employeeId;
  if (!reportId) {
    skip('BE-9a', 'manager opens a direct report', 'no team members in the local seed');
  } else {
    const { status } = await call(`/employees/${reportId}`, { token: token.MANAGER });
    check('BE-9a', 'MANAGER can open a direct report profile', status === 200, `got ${status}`);
  }
}

console.log('\n── UI-side contract checks (ours, not the tracker\'s) ──────────');
{
  // 9.1 — the key the UI gates audit surfaces on must actually exist server-side.
  const auditHolders = Object.entries(permissions).filter(([, keys]) => keys.includes('audit:read')).map(([r]) => r);
  check('UI-1', 'audit:read is the real key (UI uses audit-logs:read)',
    auditHolders.length > 0, `held by ${auditHolders.join(', ') || 'nobody'}`);
  const anyHyphen = Object.values(permissions).some((keys) => keys.includes('audit-logs:read'));
  check('UI-1', 'no role is granted "audit-logs:read"', !anyHyphen,
    anyHyphen ? 'the UI key exists server-side after all' : 'confirmed: UI key is wrong');

  // 9.2 — EmployeeTable gates Export on employees:read; the route needs employees:export.
  for (const role of ['MANAGER', 'EMPLOYEE']) {
    const canSeeButton = permissions[role].includes('employees:read');
    const response = await call('/employees/export/csv', { token: token[role], raw: true });
    check('UI-2', `${role}: export button renders (${canSeeButton}) but route says ${response.status}`,
      !(canSeeButton && response.status === 403),
      canSeeButton && response.status === 403 ? 'BUTTON RENDERS AND 403s — FE-1' : 'consistent');
  }

  // The FE's actual audit call shape, as HR.
  const feCall = await call('/audit-logs?entity=Employee&entityId=none&limit=20', { token: token.HR_ADMIN });
  check('UI-3', 'FE ActivityTab query shape still 200 for HR_ADMIN', feCall.status === 200, `got ${feCall.status}`);
}

const fail = rows.filter((r) => r.state === 'FAIL');
const skipped = rows.filter((r) => r.state === 'SKIP');
console.log(`\n${rows.length - fail.length - skipped.length} passed · ${fail.length} failed · ${skipped.length} skipped`);
if (fail.length) {
  console.log('\nFailures:');
  for (const row of fail) console.log(`  ${row.id}  ${row.what}  ${row.detail}`);
}
process.exit(fail.length ? 1 : 0);
