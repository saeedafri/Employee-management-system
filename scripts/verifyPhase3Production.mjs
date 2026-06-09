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

  // ── Statutory packs ───────────────────────────────────────────────────────
  const list = await api(hrToken, 'GET', '/payroll/statutory-packs?country=IN');
  record('statutory-packs list', list.status === 200 && Array.isArray(list.json.data));
  const listPacks = list.json?.data ?? [];
  const listAllStrings = listPacks.every((p) => (p.statutoryComponents ?? []).every((c) => typeof c === 'string'));
  record('statutory-components GET list all strings', listAllStrings, listPacks.map((p) => `${p.version}:${JSON.stringify(p.statutoryComponents?.[0])}`).join('; '));

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
    record('statutory-packs invalid range 422', invalid.status === 422 && invalid.json?.error?.code === 'INVALID_PACK');

    const updated = await api(saToken, 'PATCH', `/payroll/statutory-packs/${pack.id}`, {
      gratuity: { enabled: false },
    });
    record('statutory-packs patch flat', updated.status === 200 && updated.json?.data?.gratuity?.enabled === false && !updated.json?.data?.packData);

    const del = await api(saToken, 'DELETE', `/payroll/statutory-packs/${pack.id}`);
    record('statutory-packs delete', del.status === 200 && del.json?.data?.deleted === true);
  }

  const verStr = `sc-str-${Date.now()}`;
  const createdStr = await api(saToken, 'POST', '/payroll/statutory-packs', {
    ...flatBody,
    version: verStr,
    statutoryComponents: ['PF', 'PF_ER'],
  });
  record(
    'statutory-components POST string[]',
    createdStr.status === 201 && JSON.stringify(createdStr.json?.data?.statutoryComponents) === '["PF","PF_ER"]',
    JSON.stringify(createdStr.json?.data?.statutoryComponents),
  );

  const verObj = `sc-obj-${Date.now()}`;
  const createdObj = await api(saToken, 'POST', '/payroll/statutory-packs', {
    ...flatBody,
    version: verObj,
    statutoryComponents: [{ code: 'PF' }],
  });
  record(
    'statutory-components POST legacy {code}',
    createdObj.status === 201 && createdObj.json?.data?.statutoryComponents?.join(',') === 'PF',
    JSON.stringify(createdObj.json?.data?.statutoryComponents),
  );

  if (createdObj.json?.data?.id) {
    const patched = await api(saToken, 'PATCH', `/payroll/statutory-packs/${createdObj.json.data.id}`, {
      statutoryComponents: ['PF', { code: 'PF_ER' }],
    });
    record(
      'statutory-components PATCH mixed',
      patched.status === 200 && JSON.stringify(patched.json?.data?.statutoryComponents) === '["PF","PF_ER"]',
      JSON.stringify(patched.json?.data?.statutoryComponents),
    );
    const detail = await api(hrToken, 'GET', `/payroll/statutory-packs/${createdObj.json.data.id}`);
    record(
      'statutory-components GET detail strings',
      (detail.json?.data?.statutoryComponents ?? []).every((c) => typeof c === 'string'),
      JSON.stringify(detail.json?.data?.statutoryComponents),
    );
    await api(saToken, 'DELETE', `/payroll/statutory-packs/${createdObj.json.data.id}`);
  }
  if (createdStr.json?.data?.id) {
    await api(saToken, 'DELETE', `/payroll/statutory-packs/${createdStr.json.data.id}`);
  }

  // ── Payroll run types ─────────────────────────────────────────────────────
  const badType = await api(hrToken, 'POST', '/payroll/runs', { period: '2099-01', type: 'INVALID' });
  record('run invalid type 422', badType.status === 422 && badType.json?.error?.code === 'INVALID_RUN_TYPE');

  const revMissing = await api(hrToken, 'POST', '/payroll/runs', { period: '2099-01', type: 'REVERSAL' });
  record('run reversal target required', revMissing.status === 422 && revMissing.json?.error?.code === 'REVERSAL_TARGET_REQUIRED');

  const emps = await api(hrToken, 'GET', '/employees?limit=5');
  const raw = emps.json?.data;
  const empList = raw?.employees ?? raw?.data ?? raw?.items ?? (Array.isArray(raw) ? raw : []);
  const empIds = empList.slice(0, 2).map((e) => e.id).filter(Boolean);
  const empId = empIds[0];

  const periodUnique = `2099-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}`;
  const regular1 = await api(hrToken, 'POST', '/payroll/runs', { period: periodUnique, type: 'REGULAR' });
  record('run REGULAR create', regular1.status === 201 && regular1.json?.data?.type === 'REGULAR');

  const regularDup = await api(hrToken, 'POST', '/payroll/runs', { period: periodUnique, type: 'REGULAR' });
  record('run REGULAR duplicate 409', regularDup.status === 409 && regularDup.json?.error?.code === 'RUN_EXISTS');

  if (empIds.length >= 2) {
    const offCycle = await api(hrToken, 'POST', '/payroll/runs', {
      period: periodUnique, type: 'OFF_CYCLE', employeeIds: empIds,
    });
    record('run OFF_CYCLE create', offCycle.status === 201 && offCycle.json?.data?.type === 'OFF_CYCLE' && Array.isArray(offCycle.json?.data?.employeeIds));
  }

  const bonusPeriod = `2098-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}`;
  const bonus = await api(hrToken, 'POST', '/payroll/runs', { period: bonusPeriod, type: 'BONUS' });
  record('run BONUS create', bonus.status === 201 && bonus.json?.data?.type === 'BONUS');

  const arrears = await api(hrToken, 'POST', '/payroll/runs', { period: `2097-06`, type: 'ARREARS' });
  record('run ARREARS create', arrears.status === 201 && arrears.json?.data?.type === 'ARREARS');

  if (empId) {
    const fnf = await api(hrToken, 'POST', '/payroll/runs', {
      period: periodUnique,
      type: 'FNF',
      fnf: { employeeId: empId, lastWorkingDay: '2099-06-20', yearsOfService: 3, leaveBalanceDays: 8, noticeShortfallDays: 0 },
    });
    record('run FNF create', fnf.status === 201 && fnf.json?.data?.type === 'FNF' && fnf.json?.data?.employeeId === empId);
  }

  const paidRuns = await api(hrToken, 'GET', '/payroll/runs?status=PAID&limit=1');
  const paidItems = paidRuns.json?.data?.items ?? paidRuns.json?.data?.runs ?? [];
  const paidRun = Array.isArray(paidItems) ? paidItems[0] : null;
  if (paidRun?.id) {
    const rev = await api(hrToken, 'POST', '/payroll/runs', {
      period: `2096-12`, type: 'REVERSAL', reversalOfRunId: paidRun.id,
    });
    record('run REVERSAL create', rev.status === 201 && rev.json?.data?.type === 'REVERSAL' && rev.json?.data?.reversalOfRunId === paidRun.id);
  } else {
    record('run REVERSAL create', false, 'no PAID run for reversal target');
  }

  // ── Cloudinary ────────────────────────────────────────────────────────────
  const storage = await api(hrToken, 'GET', '/settings/integrations/storage');
  record('cloudinary storage configured', storage.json?.data?.configured === true && storage.json?.data?.provider === 'cloudinary');

  const storageTest = await api(hrToken, 'POST', '/settings/integrations/storage/test');
  record('storage test', storageTest.status === 200);

  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${fails ? 'PARTIAL/FAIL' : 'PASS'} — ${results.length - fails}/${results.length} checks passed\n`);
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
