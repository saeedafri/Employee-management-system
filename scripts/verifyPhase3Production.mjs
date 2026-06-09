/**
 * Production smoke for statutory packs + payroll run types + Cloudinary.
 * Run: node scripts/verifyPhase3Production.mjs
 */
const API = process.env.API_URL || 'https://employee-management-system-2b9q.onrender.com/api/v1';
const TENANT = 'acme-corp-001';

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  return { token: json.data?.accessToken, json };
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'x-tenant-key': TENANT,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(pass ? `[PASS] ${name}` : `[FAIL] ${name}`, detail);
}

async function main() {
  const { token: hrToken } = await login('hr@acme.test', 'Password123!');
  const { token: saToken } = await login('superadmin@acme.test', 'Password123!');

  const list = await api(hrToken, 'GET', '/payroll/statutory-packs?country=IN');
  record('statutory-packs list', list.status === 200 && Array.isArray(list.json.data));

  const ver = `audit-${Date.now()}`;
  const flatBody = {
    country: 'IN',
    version: ver,
    effectiveFrom: '2026-04-01',
    effectiveTo: null,
    rounding: { mode: 'NEAREST', precision: 0 },
    proration: { basis: 'CALENDAR_DAYS' },
    taxRegimes: [],
    contributionSchemes: [],
    localTaxes: [],
    statutoryComponents: [],
    minimumWages: [],
    gratuity: { enabled: true, formula: '15/26' },
  };
  const created = await api(saToken, 'POST', '/payroll/statutory-packs', flatBody);
  const pack = created.json?.data;
  record('statutory-packs create flat', created.status === 201 && !pack?.packData && pack?.gratuity?.enabled === true, JSON.stringify(created.json?.error || ''));

  if (pack?.id) {
    const detail = await api(hrToken, 'GET', `/payroll/statutory-packs/${pack.id}`);
    record('statutory-packs detail gratuity', detail.json?.data?.gratuity != null);

    const dup = await api(saToken, 'POST', '/payroll/statutory-packs', flatBody);
    record('statutory-packs duplicate 409', dup.status === 409 && dup.json?.error?.code === 'PACK_VERSION_EXISTS');

    const invalid = await api(saToken, 'POST', '/payroll/statutory-packs', {
      ...flatBody,
      version: `invalid-${Date.now()}`,
      effectiveFrom: '2026-12-01',
      effectiveTo: '2026-01-01',
    });
    record('statutory-packs invalid range 422', invalid.status === 422);

    const updated = await api(saToken, 'PATCH', `/payroll/statutory-packs/${pack.id}`, {
      gratuity: { enabled: false },
    });
    record('statutory-packs patch flat', updated.status === 200 && updated.json?.data?.gratuity?.enabled === false);

    const del = await api(saToken, 'DELETE', `/payroll/statutory-packs/${pack.id}`);
    record('statutory-packs delete', del.status === 200 && del.json?.data?.deleted === true);
  }

  const badType = await api(hrToken, 'POST', '/payroll/runs', { period: '2026-12', type: 'INVALID' });
  record('run invalid type 422', badType.status === 422 && badType.json?.error?.code === 'INVALID_RUN_TYPE');

  const revMissing = await api(hrToken, 'POST', '/payroll/runs', { period: '2026-12', type: 'REVERSAL' });
  record('run reversal target required', revMissing.status === 422 && revMissing.json?.error?.code === 'REVERSAL_TARGET_REQUIRED');

  const storage = await api(hrToken, 'GET', '/settings/integrations/storage');
  record('cloudinary storage configured', storage.json?.data?.configured === true && storage.json?.data?.provider === 'cloudinary');

  const storageTest = await api(hrToken, 'POST', '/settings/integrations/storage/test');
  record('storage test', storageTest.status === 200);

  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails ? 'PARTIAL/FAIL' : 'PASS'} — ${results.length - fails}/${results.length} checks passed\n`);
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
