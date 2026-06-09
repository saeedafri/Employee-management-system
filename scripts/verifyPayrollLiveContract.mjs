#!/usr/bin/env node
/**
 * Live payroll Phase 3 contract verification against production API.
 */
const BASE = process.env.API_BASE || 'https://employee-management-system-2b9q.onrender.com/api/v1';
const TENANT = process.env.TENANT_KEY || 'acme-corp-001';
const EMAIL = process.env.TEST_EMAIL || 'superadmin@acme.test';
const PASSWORD = process.env.TEST_PASSWORD || 'Password123!';

const results = [];

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json = await res.json();
  if (!json.data?.accessToken) throw new Error(`Login failed: ${JSON.stringify(json)}`);
  return json.data.accessToken;
}

async function check(name, method, path, { expectFields, body, status = 200 } = {}) {
  const headers = { authorization: `Bearer ${token}`, 'x-tenant-key': TENANT };
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  const ok = res.status === status;
  let fieldsOk = true;
  const missing = [];
  if (ok && expectFields && json?.data) {
    const item = Array.isArray(json.data) ? json.data[0] : json.data;
    if (item) {
      for (const f of expectFields) {
        if (!(f in item)) { fieldsOk = false; missing.push(f); }
      }
    }
  }
  const pass = ok && fieldsOk;
  results.push({ name, path, status: res.status, pass, missing });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${method} ${path} → ${res.status}${missing.length ? ` missing: ${missing.join(', ')}` : ''}`);
  return { res, json };
}

let token;

async function main() {
  console.log(`\nPayroll live contract verify → ${BASE}\n`);
  token = await login();

  await check('components list', 'GET', '/payroll/components', {
    expectFields: ['statutoryTag', 'prorate', 'payInPeriods', 'createdAt', 'updatedAt', 'costCenterRule'],
  });

  const created = await check('component create', 'POST', '/payroll/components', {
    status: 201,
    body: {
      name: 'Contract Test Comp',
      code: `CT_${Date.now()}`,
      type: 'EARNING',
      calculationType: 'FLAT',
      value: 1000,
      taxable: true,
      statutoryTag: 'PF_WAGE',
      prorate: false,
      payInPeriods: [1, 7],
      costCenterRule: 'DEPARTMENT',
    },
  });
  if (created.json?.data?.id) {
    await check('component patch', 'PATCH', `/payroll/components/${created.json.data.id}`, {
      body: { prorate: true, payInPeriods: [3, 9] },
      expectFields: ['prorate', 'payInPeriods'],
    });
  }

  await check('pay calendars', 'GET', '/payroll/pay-calendars', {
    expectFields: ['legalEntityId', 'frequency', 'periodAnchor', 'payDateRule', 'payDay', 'cutoffDay'],
  });

  await check('legal entities', 'GET', '/payroll/legal-entities', { expectFields: ['active'] });

  await check('payroll employees', 'GET', '/payroll/employees', { expectFields: ['employeeId', 'hasSalaryConfig'] });
  await check('migration', 'GET', '/payroll/migration', { expectFields: ['sandboxMode', 'openingBalancesCount'] });
  await check('payment batches', 'GET', '/payroll/payment-batches');
  await check('reports index', 'GET', '/payroll/reports', { expectFields: ['reports'] });
  await check('settings', 'GET', '/payroll/settings', { expectFields: ['defaultCountry', 'dataPolicy'] });
  await check('contractor invoices', 'GET', '/payroll/contractor-invoices');
  await check('opening balances', 'GET', '/payroll/opening-balances', {
    expectFields: ['employeeCode', 'employeeName', 'fiscalYear'],
  });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('Failures:', failed);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
