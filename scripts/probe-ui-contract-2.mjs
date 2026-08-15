/**
 * Second pass: the Accept boxes the first probe had to SKIP, plus the items that
 * need payroll/export fixtures. Creates its own fixtures through the public API
 * rather than assuming the seed provides them.
 *
 *   BASE=http://127.0.0.1:4310/api/v1 node scripts/probe-ui-contract-2.mjs
 */
import { inflateSync } from 'node:zlib';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4310/api/v1';
const TENANT = process.env.TENANT_KEY ?? 'acme-corp-001';
const PASSWORD = 'Password123!';

const rows = [];
const record = (state, id, what, detail = '') => {
  rows.push({ state, id, what, detail });
  console.log(`${state}  ${id.padEnd(6)} ${what}${detail ? `  — ${detail}` : ''}`);
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
  return { status: response.status, json: await response.json().catch(() => ({})), headers: response.headers };
}

const token = {};
for (const [role, email] of Object.entries({
  SUPER_ADMIN: 'superadmin@acme.test', HR_ADMIN: 'hr@acme.test',
  MANAGER: 'aman@acme.test', EMPLOYEE: 'priya@acme.test', AUDITOR: 'auditor@acme.test',
})) {
  const { status, json } = await call('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  token[role] = status === 200 ? (json.data?.accessToken ?? json.data?.access_token) : null;
}

const meEmployee = (await call('/auth/me', { token: token.EMPLOYEE })).json.data ?? {};
const selfId = meEmployee.employeeId ?? meEmployee.user?.employeeId;

console.log('\n── BE-2 · leave assignments (fixtures created via the API) ────');
{
  const seeded = await call('/leave/packs/seed', { token: token.HR_ADMIN, method: 'POST', body: { country: 'IN' } });
  const assigned = await call('/leave/assignments/auto-assign', { token: token.HR_ADMIN, method: 'POST', body: {} });
  const made = assigned.json.data?.assigned ?? 0;
  if (made === 0) {
    skip('BE-2', 'row-scoping', `auto-assign produced none (packs ${seeded.status}, assign ${assigned.status})`);
  } else {
    const ids = (json) => new Set((json.data?.assignments ?? []).map((a) => a.employeeId));
    const hr = ids((await call('/leave/assignments', { token: token.HR_ADMIN })).json);
    const emp = ids((await call('/leave/assignments', { token: token.EMPLOYEE })).json);
    const mgr = ids((await call('/leave/assignments', { token: token.MANAGER })).json);

    check('BE-2', 'EMPLOYEE → own rows only', emp.size <= 1 && (emp.size === 0 || emp.has(selfId)),
      `${emp.size} of ${hr.size} employees`);
    check('BE-2', 'MANAGER → own reports, not the tenant', mgr.size > 0 && mgr.size < hr.size,
      `${mgr.size} of ${hr.size}`);
    check('BE-2', 'HR_ADMIN → unchanged, sees all', hr.size > mgr.size, `${hr.size} employees`);

    const other = [...hr].find((id) => id !== selfId);
    if (other) {
      const forced = await call(`/leave/assignments?employeeId=${other}`, { token: token.EMPLOYEE });
      check('BE-2', '?employeeId= cannot widen EMPLOYEE scope',
        (forced.json.data?.assignments ?? []).length === 0,
        `${(forced.json.data?.assignments ?? []).length} rows leaked`);
    }
  }
}

console.log('\n── BE-9b · no-employee-record reads (AUDITOR has no Employee) ─');
{
  const auditorMe = (await call('/auth/me', { token: token.AUDITOR })).json.data ?? {};
  const hasEmployee = Boolean(auditorMe.employeeId ?? auditorMe.user?.employeeId);
  if (hasEmployee) {
    skip('BE-9b', 'empty-state', 'no account without an employee record locally');
  } else {
    for (const path of ['/attendance/today', '/employee/dashboard']) {
      const { status, json } = await call(path, { token: token.AUDITOR });
      check('BE-9b', `no-employee user → ${path} = 200 noEmployeeRecord`,
        status === 200 && json.data?.noEmployeeRecord === true, `got ${status}`);
    }
    const checkIn = await call('/employee/check-in', { token: token.AUDITOR, method: 'POST', body: {} });
    check('BE-9b', 'writes still refuse (400 NO_EMPLOYEE_RECORD)',
      checkIn.status === 400 && checkIn.json.error?.code === 'NO_EMPLOYEE_RECORD',
      `got ${checkIn.status} ${checkIn.json.error?.code ?? ''}`);
  }
}

console.log('\n── BE-6 · AUDITOR account ─────────────────────────────────────');
{
  check('BE-6', 'AUDITOR login returns 200', Boolean(token.AUDITOR));
  if (token.AUDITOR) {
    const keys = JSON.parse(Buffer.from(token.AUDITOR.split('.')[1], 'base64url').toString()).permissions ?? [];
    check('BE-6', 'JWT carries the 12 documented keys', keys.length === 12, `${keys.length} keys`);
    check('BE-6', 'AUDITOR can read audit logs', (await call('/audit-logs?limit=1', { token: token.AUDITOR })).status === 200);
  }
}

console.log('\n── BE-5 · tax-form PDF ────────────────────────────────────────');
{
  const own = await call(`/payroll/employees/${selfId}/tax-forms/FORM16/download?format=pdf`, { token: token.EMPLOYEE, raw: true });
  const bytes = Buffer.from(await own.arrayBuffer());
  check('BE-5', 'employee downloads their own → 200 %PDF-',
    own.status === 200 && bytes.subarray(0, 5).toString() === '%PDF-', `status ${own.status}`);
  check('BE-5', 'content-type is application/pdf',
    (own.headers.get('content-type') ?? '').includes('application/pdf'), own.headers.get('content-type'));
  check('BE-5', 'filename follows the contract',
    /filename="tax-form-.+\.pdf"/.test(own.headers.get('content-disposition') ?? ''),
    own.headers.get('content-disposition'));

  const employees = await call('/employees?page=1&limit=10', { token: token.HR_ADMIN });
  const list = employees.json.data?.employees ?? employees.json.data?.items ?? [];
  const otherId = list.map((e) => e.id).find((id) => id && id !== selfId);
  if (!otherId) {
    skip('BE-5', "another employee's form is 403", 'only one employee visible');
  } else {
    const foreign = await call(`/payroll/employees/${otherId}/tax-forms/FORM16/download?format=pdf`, { token: token.EMPLOYEE, raw: true });
    check('BE-5', "employee on another's form → 403", foreign.status === 403, `got ${foreign.status}`);
    const asHr = await call(`/payroll/employees/${otherId}/tax-forms/FORM16/download?format=pdf`, { token: token.HR_ADMIN, raw: true });
    check('BE-5', 'HR_ADMIN on any → 200', asHr.status === 200, `got ${asHr.status}`);
  }
}

console.log('\n── BE-7 · rupee renders in the payslip PDF ────────────────────');
{
  const payslips = await call(`/payroll/employees/${selfId}/payslips?page=1&limit=1`, { token: token.EMPLOYEE });
  const list = payslips.json.data?.payslips ?? payslips.json.data?.items ?? payslips.json.data ?? [];
  const payslip = Array.isArray(list) ? list[0] : null;
  if (!payslip?.id) {
    skip('BE-7', 'payslip PDF', `no payslip for the seeded employee (status ${payslips.status})`);
  } else {
    const response = await call(`/payroll/employees/${selfId}/payslips/${payslip.id}/download`, { token: token.EMPLOYEE, raw: true });
    const pdf = Buffer.from(await response.arrayBuffer());
    const latin = pdf.toString('latin1');
    check('BE-7', 'payslip downloads as a real PDF',
      response.status === 200 && pdf.subarray(0, 5).toString() === '%PDF-', `status ${response.status}`);
    check('BE-7', 'a Unicode font is embedded (not WinAnsi Helvetica)',
      /NotoSans/.test(latin) && !/BaseFont\s*\/Helvetica/.test(latin));

    // Strongest available proof the glyph is actually used: the ToUnicode CMap
    // maps the drawn glyph codes back to Unicode, so U+20B9 appearing there means
    // the rupee sign is genuinely in the rendered text, not merely in the font.
    let foundRupee = false;
    for (const match of latin.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
      try {
        const text = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
        if (/20B9/i.test(text)) { foundRupee = true; break; }
      } catch { /* not a flate stream, skip */ }
    }
    check('BE-7', 'U+20B9 (₹) present in the PDF ToUnicode map', foundRupee,
      foundRupee ? 'rupee is in the rendered text' : 'not found in any decompressed stream');
  }
}

console.log('\n── BE-10 · async export download ──────────────────────────────');
{
  const queued = await call('/export/employees', { token: token.HR_ADMIN, method: 'POST', body: { format: 'csv' } });
  const jobId = queued.json.data?.job_id;
  if (!jobId) {
    skip('BE-10', 'job download', `export not queued (status ${queued.status})`);
  } else {
    let response;
    for (let attempt = 0; attempt < 12; attempt++) {
      response = await call(`/export/${jobId}/download`, { token: token.HR_ADMIN, raw: true });
      if ((response.headers.get('content-type') ?? '').includes('csv')) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    const type = response.headers.get('content-type') ?? '';
    const disposition = response.headers.get('content-disposition') ?? '';
    check('BE-10', 'Content-Type is text/csv; charset=utf-8', type.includes('text/csv'), type);
    check('BE-10', 'real filename, not "file"',
      /filename="employees-\d{4}-\d{2}-\d{2}\.csv"/.test(disposition), disposition);

    const csv = await response.text();
    const lines = csv.split('\n');
    check('BE-10', 'header row fully quoted',
      lines[0].split(',').every((cell) => /^".*"$/.test(cell)), lines[0].slice(0, 50));
    check('BE-10', 'dates are YYYY-MM-DD, not Date.toString()', !/GMT|Coordinated Universal Time/.test(csv));
    check('BE-10', 'no duplicate department.id column', !lines[0].includes('"department.id"'));
    check('BE-10', 'no trailing empty row', !/^,*$/.test(lines[lines.length - 1] ?? 'x'));
  }

  const audit = await call('/audit-logs/export?format=csv', { token: token.HR_ADMIN, raw: true });
  const total = audit.headers.get('x-export-total');
  check('BE-10', 'audit export reports its truncation', total !== null,
    `total=${total} returned=${audit.headers.get('x-export-returned')} truncated=${audit.headers.get('x-export-truncated')}`);
  const auditCsv = await audit.text();
  check('BE-10', 'audit CSV header row quoted',
    (auditCsv.split('\n')[0] ?? '').split(',').every((cell) => /^".*"$/.test(cell)),
    (auditCsv.split('\n')[0] ?? '').slice(0, 50));
}

const fail = rows.filter((r) => r.state === 'FAIL');
const skipped = rows.filter((r) => r.state === 'SKIP');
console.log(`\n${rows.length - fail.length - skipped.length} passed · ${fail.length} failed · ${skipped.length} skipped`);
if (fail.length) {
  console.log('\nFailures:');
  for (const row of fail) console.log(`  ${row.id}  ${row.what}  ${row.detail}`);
}
process.exit(fail.length ? 1 : 0);
