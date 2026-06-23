/* eslint-disable no-console */
// Live multi-country evidence for HOLIDAY_ENGINE_BACKEND_CONTRACT §5 (additive, idempotent).
// Creates US + KWD legal entities / employees / salaries / holidays on the LIVE box via API,
// then captures the resolved holidays (disjoint + observed shift) and a payroll run's holidayBasis.
// Run:  node scripts/holidayEngineLiveLitmus.mjs           (create + capture)
//       node scripts/holidayEngineLiveLitmus.mjs cleanup   (soft-delete throwaway emps + holidays)
const BASE = process.env.EMS_BASE || 'https://ems-api.saqibsaeed.cloud/api/v1';
const TENANT = 'acme-corp-001';
const MODE = process.argv[2] || 'create';
const CLEANUP = MODE === 'cleanup';

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
const login = async (email, pw) => {
  const r = await api('POST', '/auth/login', { email, password: pw });
  return r.data?.accessToken || '';
};
// Robust list extraction across the API's envelope shapes ({data:{data:[]}}, {data:{employees:[]}}, {data:[]}).
const asArray = (d) => {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  for (const k of ['data', 'employees', 'legalEntities', 'payGroups', 'payslips', 'holidays', 'departments']) {
    if (Array.isArray(d[k])) return d[k];
  }
  return [];
};

async function ensureLegalEntity(country, payload) {
  const list = await api('GET', '/payroll/legal-entities');
  const found = asArray(list.data).find((e) => e.country === country && /litmus/i.test(e.name));
  if (found) return found;
  const r = await api('POST', '/payroll/legal-entities', payload);
  return r.data;
}
async function ensurePayGroup() {
  const list = await api('GET', '/payroll/groups');
  const found = asArray(list.data).find((p) => p.code === 'LITMUS-MULTI');
  if (found) return found;
  const r = await api('POST', '/payroll/groups', { name: 'Litmus Multi-currency', code: 'LITMUS-MULTI', currency: 'USD', paySchedule: 'MONTHLY' });
  return r.data;
}
async function ensureHoliday(name, date, location) {
  const r = await api('POST', '/holidays', { name, holidayDate: date, location, isOptional: false });
  if (r.status === 201 || r.status === 200) return r.data;
  // already exists → look it up by listing the year
  const y = date.slice(0, 4);
  const list = await api('GET', `/holidays?year=${y}`);
  return (list.data?.holidays || []).find((h) => h.name === name) || r.data;
}
async function ensureEmployee(code, first, deptId) {
  const r = await api('POST', '/employees', {
    firstName: first, lastName: 'LitmusZZ', workEmail: `${code.toLowerCase()}@litmus.acme.test`,
    employeeCode: code, joinedOn: '2026-01-01', employmentType: 'FULL_TIME', departmentId: deptId,
  });
  if (r.data?.id) return r.data;
  const list = await api('GET', '/employees?search=LITMUS&limit=50');
  return asArray(list.data).find((e) => e.employeeCode === code) || null;
}

async function findLitmusEmployees() {
  const list = await api('GET', '/employees?search=LITMUS&limit=50');
  const arr = asArray(list.data);
  return {
    us: arr.find((e) => /LITMUS-US/.test(e.employeeCode || '')),
    kw: arr.find((e) => /LITMUS-KW/.test(e.employeeCode || '')),
  };
}
const pick = (r) => ({
  context: r.data?.context, total: r.data?.total,
  countryOrShifted: (r.data?.holidays || [])
    .filter((h) => h.countryCode || h.observed)
    .map((h) => ({ name: h.name, holidayDate: h.holidayDate?.slice(0, 10), actualDate: h.actualDate?.slice(0, 10) || null, observed: h.observed, countryCode: h.countryCode })),
});

async function capture() {
  const { us, kw } = await findLitmusEmployees();
  const usRes = await api('GET', `/employees/${us.id}/holidays?year=2026`);
  const kwRes = await api('GET', `/employees/${kw.id}/holidays?year=2026`);
  // §5.5 — ensure a June payslip for the KW employee, then read holidayBasis
  let basis = null;
  let ps = await api('GET', `/payroll/employees/${kw.id}/payslips?year=2026`);
  let slip = asArray(ps.data)[0];
  if (!slip) {
    const run = await api('POST', '/payroll/runs', { period: '2026-06', employeeIds: [kw.id] });
    if (run.data?.id) {
      const calc = await api('POST', `/payroll/runs/${run.data.id}/calculate`, {});
      ps = await api('GET', `/payroll/employees/${kw.id}/payslips?year=2026`);
      slip = asArray(ps.data)[0];
      if (!slip) console.error('run/calc debug:', run.status, JSON.stringify(run.data)?.slice(0, 200), '| calc', calc.status, JSON.stringify(calc.data)?.slice(0, 200));
    } else {
      console.error('run create failed:', run.status, JSON.stringify(run.data)?.slice(0, 300));
    }
  }
  if (slip?.id) {
    const detail = await api('GET', `/payroll/employees/${kw.id}/payslips/${slip.id}`);
    basis = detail.data?.holidayBasis;
  }
  console.log(JSON.stringify({
    US_employee_resolved: pick(usRes),
    KW_employee_resolved: pick(kwRes),
    KW_payslip_holidayBasis: basis,
  }, null, 2));
}

async function main() {
  TOKEN = await login('superadmin@acme.test', 'Password123!');
  if (!TOKEN) throw new Error('login failed');

  if (MODE === 'capture') { await capture(); return; }

  if (CLEANUP) {
    const list = await api('GET', '/employees?limit=200');
    const rows = list.data?.employees || list.data || [];
    for (const e of (Array.isArray(rows) ? rows : []).filter((x) => /LITMUS-(US|KW)/.test(x.employeeCode || ''))) {
      const d = await api('DELETE', `/employees/${e.id}`);
      console.log('soft-deleted employee', e.employeeCode, d.status);
    }
    for (const y of ['2026']) {
      const hs = await api('GET', `/holidays?year=${y}`);
      for (const h of (hs.data?.holidays || []).filter((x) => /litmus/i.test(x.name))) {
        const d = await api('DELETE', `/holidays/${h.id}`);
        console.log('deleted holiday', h.name, d.status);
      }
    }
    return;
  }

  const depts = await api('GET', '/departments');
  const drows = depts.data?.departments || depts.data || [];
  const deptId = (Array.isArray(drows) ? drows : [])[0]?.id;

  const usLE = await ensureLegalEntity('US', { name: 'Acme USA Inc (litmus)', country: 'US', currency: 'USD', workWeekPattern: 'MON-FRI', workWeekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'], timezone: 'America/New_York', locale: 'en-US' });
  const kwLE = await ensureLegalEntity('KW', { name: 'Acme Kuwait WLL (litmus)', country: 'KW', currency: 'KWD', workWeekPattern: 'SUN-THU', workWeekDays: ['SUN', 'MON', 'TUE', 'WED', 'THU'], timezone: 'Asia/Kuwait', locale: 'ar-KW' });
  const payGroup = await ensurePayGroup();

  // US Independence Day 2026-07-04 is a SATURDAY → US policy NEAREST_WORKING_DAY → Fri 2026-07-03.
  const usHol = await ensureHoliday('US Independence Day (litmus)', '2026-07-04', 'United States');
  // KW National Day 2026-06-26 is a FRIDAY → SUN-THU NEXT_WORKING_DAY → Sun 2026-06-28.
  const kwHol = await ensureHoliday('KW National Day (litmus)', '2026-06-26', 'KW');

  const usEmp = await ensureEmployee('LITMUS-US-1', 'UsLitmus', deptId);
  const kwEmp = await ensureEmployee('LITMUS-KW-1', 'KwLitmus', deptId);

  // salaries pin the country via legalEntityId (resolver reads salary→legalEntity, same as payroll)
  await api('POST', `/payroll/employees/${usEmp.id}/salary`, { payGroupId: payGroup.id, annualCtc: 120000, effectiveFrom: '2026-01-01', legalEntityId: usLE.id });
  await api('POST', `/payroll/employees/${kwEmp.id}/salary`, { payGroupId: payGroup.id, annualCtc: 12000, effectiveFrom: '2026-01-01', legalEntityId: kwLE.id });

  const usRes = await api('GET', `/employees/${usEmp.id}/holidays?year=2026`);
  const kwRes = await api('GET', `/employees/${kwEmp.id}/holidays?year=2026`);

  const pick = (r) => ({ context: r.data?.context, total: r.data?.total, rows: (r.data?.holidays || []).filter((h) => /litmus/i.test(h.name) || h.observed).map((h) => ({ name: h.name, holidayDate: h.holidayDate?.slice(0, 10), actualDate: h.actualDate?.slice(0, 10) || null, observed: h.observed, countryCode: h.countryCode })) });

  // §5.5 — payroll run (June) for the KW employee → payslip holidayBasis
  const run = await api('POST', '/payroll/runs', { period: '2026-06', employeeIds: [kwEmp.id] });
  const runId = run.data?.id;
  if (runId) await api('POST', `/payroll/runs/${runId}/calculate`, {});
  let holidayBasis = null;
  if (runId) {
    const ps = await api('GET', `/payroll/employees/${kwEmp.id}/payslips?year=2026`);
    const slip = asArray(ps.data)[0];
    if (slip?.id) {
      const detail = await api('GET', `/payroll/employees/${kwEmp.id}/payslips/${slip.id}`);
      holidayBasis = detail.data?.holidayBasis;
    }
  }

  console.log(JSON.stringify({
    usLegalEntity: { id: usLE.id, country: usLE.country },
    kwLegalEntity: { id: kwLE.id, country: kwLE.country, workWeekDays: kwLE.workWeekDays },
    payGroup: { id: payGroup.id, code: payGroup.code },
    holidays: { us: usHol?.id, kw: kwHol?.id },
    employees: { us: usEmp?.id, kw: kwEmp?.id },
    EVIDENCE: {
      'US_employee_resolved': pick(usRes),
      'KW_employee_resolved (SUN-THU observed shift)': pick(kwRes),
      'KW_payslip_holidayBasis (§5.5)': holidayBasis,
    },
  }, null, 2));
}
main().catch((e) => { console.error('ERR', e.message); process.exit(1); });
