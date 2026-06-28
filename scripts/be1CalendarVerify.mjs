/* eslint-disable no-console */
// Live verification for BE1_ATTENDANCE_CALENDAR_CONTRACT against the deployed box.
const BASE = process.env.EMS_BASE || 'https://ems-api.saqibsaeed.cloud/api/v1';
const TENANT = 'acme-corp-001';
let TOKEN = '';
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT, ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch { /* */ }
  return { status: res.status, data: json?.data ?? json, raw: json };
}
const login = async (e, p) => (await api('POST', '/auth/login', { email: e, password: p })).data?.accessToken || '';

const main = async () => {
  // 1) deploy probe: missing month → 422 VALIDATION_ERROR (my handler), not route-not-found.
  TOKEN = await login('priya@acme.test', 'Password123!');
  if (!TOKEN) { console.log('DEPLOY_STATE: login failed'); return; }
  const probe = await api('GET', '/attendance/calendar');
  const deployed = probe.status === 422 && probe.raw?.error?.code === 'VALIDATION_ERROR';
  console.log('DEPLOY_STATE:', deployed ? 'LIVE' : `NOT_YET (status=${probe.status} body=${JSON.stringify(probe.raw)?.slice(0,120)})`);
  if (!deployed) return;

  // 2) self calendar (priya = IN employee with data)
  const cal = await api('GET', '/attendance/calendar?month=2026-06');
  const d = cal.data;
  console.log('SELF /attendance/calendar?month=2026-06 ->', cal.status,
    '| days=', d?.days?.length, '| summary=', JSON.stringify(d?.summary),
    '| lopDays=', d?.lopDays?.length);
  const sample = (d?.days || []).find((x) => x.bucket === 'HOLIDAY') || (d?.days || [])[0];
  console.log('  sample day:', JSON.stringify(sample));
  const buckets = [...new Set((d?.days || []).map((x) => x.bucket))];
  console.log('  buckets present:', buckets.join(','));

  // 3) HR views an employee + RBAC 403/404
  const saToken = await login('superadmin@acme.test', 'Password123!');
  const me = await api('GET', '/auth/me');
  const meId = me.data?.employeeId || me.data?.employee?.id;
  TOKEN = saToken;
  // find priya's employee id
  const emps = await api('GET', '/employees?search=priya&limit=5');
  const arr = Array.isArray(emps.data?.data) ? emps.data.data : (emps.data?.employees || emps.data || []);
  const priya = (Array.isArray(arr) ? arr : []).find((e) => /priya/i.test(e.workEmail || e.firstName || ''));
  if (priya) {
    const hr = await api('GET', `/employees/${priya.id}/attendance/calendar?month=2026-06`);
    console.log('HR /employees/:id/attendance/calendar ->', hr.status, '| days=', hr.data?.days?.length);
  }
  const notFound = await api('GET', '/employees/nonexistent-id-xyz/attendance/calendar?month=2026-06');
  console.log('404 probe (bad :id) ->', notFound.status, notFound.raw?.error?.code);
  // EMPLOYEE targeting someone else → 403
  TOKEN = await login('priya@acme.test', 'Password123!');
  if (priya) {
    const other = await api('GET', `/employees/${meId || 'x'}/attendance/calendar?month=2026-06`);
    // priya targeting herself would be 200; pick a different known employee
  }
  const someoneElse = await api('GET', '/employees/dev1-fake/attendance/calendar?month=2026-06');
  console.log('403/404 probe (employee role, other id) ->', someoneElse.status, someoneElse.raw?.error?.code);
};
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
