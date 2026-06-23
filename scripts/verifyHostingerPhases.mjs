/**
 * Phase-by-phase verification against Hostinger EMS API.
 * Usage: node scripts/verifyHostingerPhases.mjs
 * Env: API_URL (default https://ems-api.saqibsaeed.cloud/api/v1)
 */
const API = process.env.API_URL || 'https://ems-api.saqibsaeed.cloud/api/v1';
const PASSWORD = 'Password123!';

async function req(method, path, { token, body, tenant } = {}) {
  const t0 = performance.now();
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': tenant,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const ms = Math.round(performance.now() - t0);
  let json = null;
  try { json = await res.json(); } catch { /* noop */ }
  return { status: res.status, json, ms };
}

const rows = [];
function check(phase, label, ok, detail = '') {
  rows.push({ phase, label, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${phase} | ${label}${detail ? ' | ' + detail : ''}`);
}

async function login(email, tenant) {
  return req('POST', '/auth/login', { body: { email, password: PASSWORD }, tenant });
}

const health = await fetch(API.replace('/api/v1', '') + '/health');
check('0', 'health', health.status === 200, String(health.status));

const hr = await login('hr@acme.test', 'acme-corp-001');
const hrTok = hr.json?.data?.accessToken;
check('1', 'login HR', hr.status === 200 && !!hrTok, `${hr.ms}ms`);

const sa = await login('superadmin@acme.test', 'acme-corp-001');
const saTok = sa.json?.data?.accessToken;
check('1', 'login SUPER', sa.status === 200 && !!saTok, `${sa.ms}ms`);

if (hrTok) {
  for (const [phase, path, note] of [
    ['2', '/employees?page=1&limit=2', ''],
    ['2', '/departments', ''],
    ['3', '/attendance/today', ''],
    ['3', '/attendance/records?month=2026-06', ''],
    ['4', '/leave/balance', ''],
    ['4', '/leave/types', ''],
    ['4', '/leave/policies', ''],
    ['5', '/timesheets?weekStart=2026-06-16', ''],
    ['5', '/timesheets/locks', ''],
    ['6', '/payroll/runs?page=1&limit=3', ''],
    ['6', '/payroll/statutory-packs', ''],
    ['6', '/payroll/legal-entities', ''],
    ['7', '/holidays?year=2026&countryCode=IN', ''],
    ['8', '/settings/tenant', ''],
    ['9', '/reports/attendance', ''],
    ['9', '/analytics/summary', ''],
    ['11', '/notifications/unread-count', ''],
    ['11', '/search?q=test', ''],
  ]) {
    const r = await req('GET', path, { token: hrTok, tenant: 'acme-corp-001' });
    check(phase, path, r.status === 200, `${r.ms}ms`);
  }
  const le = await req('GET', '/payroll/legal-entities', { token: hrTok, tenant: 'acme-corp-001' });
  const ent = le.json?.data?.[0];
  check('6', 'legal-entity workWeekDays', !!ent?.workWeekDays?.length, JSON.stringify(ent?.workWeekDays));
}

if (saTok) {
  const rp = await req('GET', '/settings/roles-permissions', { token: saTok, tenant: 'acme-corp-001' });
  check('10', '/settings/roles-permissions', rp.status === 200, `${rp.ms}ms`);
}

const kwd = await login('admin@kwd.test', 'kwd-litmus-001');
const kwdTok = kwd.json?.data?.accessToken;
check('12', 'KWD login', kwd.status === 200 && !!kwdTok, `${kwd.status}`);

if (kwdTok) {
  const ten = await req('GET', '/settings/tenant', { token: kwdTok, tenant: 'kwd-litmus-001' });
  const cur = ten.json?.data?.currency ?? ten.json?.data?.defaultCurrency;
  const ww = ten.json?.data?.work_week_days ?? ten.json?.data?.workWeekDays;
  check('12', 'KWD currency', cur === 'KWD', cur);
  check('12', 'KWD work_week SUN-THU', Array.isArray(ww) && ww[0] === 'SUN', JSON.stringify(ww));
  const wc = await req('GET', '/timesheets/week-config', { token: kwdTok, tenant: 'kwd-litmus-001' });
  check('12', 'KWD week-config weekStartDay=0', wc.json?.data?.weekStartDay === 0, String(wc.json?.data?.weekStartDay));
}

const fails = rows.filter((r) => !r.ok).length;
console.log(`\nTOTAL ${rows.length - fails}/${rows.length} PASS`);
process.exit(fails ? 1 : 0);
