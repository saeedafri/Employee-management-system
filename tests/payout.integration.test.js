// Full payout-methods lifecycle against a LOCAL Postgres (ems_local). Run with:
//   DATABASE_URL=postgresql://postgres@127.0.0.1:5433/ems_local \
//   PAYOUT_ENC_KEY=<64 hex> LOG_LEVEL=silent node --test tests/payout.integration.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const TENANT = 'acme-corp-001';
let app;
const tok = {}; // role -> { token, user }

async function login(email) {
  const r = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    headers: { 'x-tenant-key': TENANT, 'content-type': 'application/json' },
    payload: { email, password: 'Password123!' },
  });
  assert.equal(r.statusCode, 200, `login ${email}`);
  const b = r.json();
  return { token: b.data.accessToken, user: b.data.user };
}

function req(method, url, who, payload) {
  return app.inject({
    method, url,
    headers: { authorization: `Bearer ${tok[who].token}`, 'x-tenant-key': TENANT, 'content-type': 'application/json' },
    ...(payload ? { payload } : {}),
  });
}

test.before(async () => {
  app = await createApp();
  await app.ready();
  tok.priya = await login('priya@acme.test');
  tok.hr = await login('hr@acme.test');
  tok.super = await login('superadmin@acme.test');
  tok.aman = await login('aman@acme.test');
});
test.after(async () => { if (app) await app.close(); });

// ── §3 Country layer ──────────────────────────────────────────────────────────
test('GET /payroll/countries returns the full ISO list', async () => {
  const r = await req('GET', '/api/v1/payroll/countries', 'priya');
  assert.equal(r.statusCode, 200);
  const data = r.json().data;
  assert.ok(Array.isArray(data) && data.length > 200, `ISO list len=${data.length}`);
  assert.ok(data.find((c) => c.code === 'IN' && c.currency === 'INR'));
});

test('GET bank-schema: IN has currency, US accountType is text (no select), unmapped → generic fallback (no 404)', async () => {
  const inr = (await req('GET', '/api/v1/payroll/countries/IN/bank-schema', 'priya')).json().data;
  assert.equal(inr.country, 'IN');
  assert.equal(inr.currency, 'INR');
  assert.equal(inr.fields.find((f) => f.key === 'accountNumber').regex, '^[0-9X]{9,18}$');

  const us = (await req('GET', '/api/v1/payroll/countries/US/bank-schema', 'priya')).json().data;
  const at = us.fields.find((f) => f.key === 'accountType');
  assert.equal(at.type, 'text'); // select dropped
  assert.ok(!us.fields.some((f) => f.type === 'select'));

  const fr = await req('GET', '/api/v1/payroll/countries/FR/bank-schema', 'priya');
  assert.equal(fr.statusCode, 200); // never 404
  assert.equal(fr.json().data.currency, 'EUR');
  assert.deepEqual(fr.json().data.fields.map((f) => f.key), ['accountName', 'iban', 'bic']);
});

// ── §5 Catalog CRUD (SUPER_ADMIN) ─────────────────────────────────────────────
test('catalog: super lists seeded rows; non-super forbidden; create/409/patch/delete', async () => {
  const list = await req('GET', '/api/v1/payroll/country-bank-schemas', 'super');
  assert.equal(list.statusCode, 200);
  const codes = list.json().data.map((r) => r.country);
  for (const c of ['IN', 'US', 'GB', 'DE', 'CA', 'SG', 'AU', 'SA', 'AE']) assert.ok(codes.includes(c), `seed ${c}`);

  const forbidden = await req('GET', '/api/v1/payroll/country-bank-schemas', 'hr');
  assert.equal(forbidden.statusCode, 403);

  const one = (await req('GET', '/api/v1/payroll/country-bank-schemas/FR', 'super')).json().data;
  assert.equal(one.updatedBy, 'system'); // fallback synthetic row
  assert.equal(one.updatedAt, '1970-01-01T00:00:00.000Z');

  const body = { country: 'NZ', currency: 'NZD', fields: [{ key: 'accountName', label: 'Name', type: 'text', required: true }] };
  const created = await req('POST', '/api/v1/payroll/country-bank-schemas', 'super', body);
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().data.updatedBy.length > 0, true);

  const dup = await req('POST', '/api/v1/payroll/country-bank-schemas', 'super', body);
  assert.equal(dup.statusCode, 409);
  assert.equal(dup.json().error.code, 'SCHEMA_EXISTS');

  const patched = await req('PATCH', '/api/v1/payroll/country-bank-schemas/nz', 'super', { currency: 'USD' });
  assert.equal(patched.statusCode, 200);
  assert.equal(patched.json().data.currency, 'USD');

  const del = await req('DELETE', '/api/v1/payroll/country-bank-schemas/NZ', 'super');
  assert.equal(del.statusCode, 200);
  assert.deepEqual(del.json().data, { deleted: true });
});

// ── §6–§8 Methods lifecycle ───────────────────────────────────────────────────
const IN_DETAILS = { accountName: 'Priya Sharma', accountNumber: '50100123454821', ifsc: 'HDFC0001234', bankName: 'HDFC Bank' };
let priyaMethodId;

test('create (self) → 201 PENDING_APPROVAL, masked details, maskedTail, enqueues approval', async () => {
  const r = await req('POST', `/api/v1/payroll/employees/${tok.priya.user.employeeId}/payout-methods`, 'priya', {
    type: 'BANK', country: 'IN', rail: 'BANK_LOCAL', label: 'HDFC Salary', holderName: 'Priya Sharma',
    details: IN_DETAILS, makePrimary: true,
  });
  assert.equal(r.statusCode, 201);
  const m = r.json().data;
  priyaMethodId = m.id;
  assert.equal(m.lifecycleStatus, 'PENDING_APPROVAL');
  assert.equal(m.verificationStatus, 'UNVERIFIED');
  assert.equal(m.isPrimary, false);
  assert.equal(m.currency, 'INR');
  assert.equal(m.maskedTail, '4821');
  assert.equal(m.details.accountNumber, '50100123454821'); // §2.3: owner-creator sees full
  assert.equal(m.details.accountName, 'Priya Sharma');
});

test('validation failure → 422 with details[] keyed details.<field>', async () => {
  const r = await req('POST', `/api/v1/payroll/employees/${tok.priya.user.employeeId}/payout-methods`, 'priya', {
    type: 'BANK', country: 'IN', rail: 'BANK_LOCAL', label: 'Bad', holderName: 'X',
    details: { accountName: 'X', accountNumber: '12', ifsc: 'nope' },
  });
  assert.equal(r.statusCode, 422);
  const err = r.json().error;
  assert.equal(err.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(err.details));
  assert.ok(err.details.some((d) => d.field === 'details.accountNumber'));
  assert.ok(err.details.some((d) => d.field === 'details.ifsc'));
});

test('me/payout-methods lists own (masked); employee cannot read another’s (403); admin-less me 400', async () => {
  const mine = await req('GET', '/api/v1/payroll/me/payout-methods', 'priya');
  assert.equal(mine.statusCode, 200);
  assert.ok(mine.json().data.methods.some((m) => m.id === priyaMethodId));
  assert.deepEqual(mine.json().data.instructions, []);

  const other = await req('GET', `/api/v1/payroll/employees/${tok.aman.user.employeeId}/payout-methods`, 'priya');
  assert.equal(other.statusCode, 403);

  const noEmp = await req('GET', '/api/v1/payroll/me/payout-methods', 'super');
  assert.equal(noEmp.statusCode, 400);
  assert.equal(noEmp.json().error.code, 'NO_EMPLOYEE_RECORD');
});

test('verify before ACTIVE → 409 NOT_ACTIVE', async () => {
  const r = await req('POST', `/api/v1/payroll/payout-methods/${priyaMethodId}/verify`, 'hr', { result: 'VERIFIED' });
  assert.equal(r.statusCode, 409);
  assert.equal(r.json().error.code, 'NOT_ACTIVE');
});

test('approvals queue shows the METHOD_ADD; approve (checker≠maker) → ACTIVE + primary applied', async () => {
  const q = await req('GET', '/api/v1/payroll/payout-methods/approvals?status=PENDING', 'hr');
  assert.equal(q.statusCode, 200);
  const appr = q.json().data.items.find((a) => a.methodId === priyaMethodId && a.kind === 'METHOD_ADD');
  assert.ok(appr, 'METHOD_ADD enqueued');
  assert.equal(appr.employee.name, 'Priya Sharma');

  const ap = await req('POST', `/api/v1/payroll/payout-methods/approvals/${appr.id}/approve`, 'hr', { note: 'ok' });
  assert.equal(ap.statusCode, 200);
  assert.deepEqual(ap.json().data, { applied: true });

  const m = (await req('GET', `/api/v1/payroll/payout-methods/${priyaMethodId}`, 'priya')).json().data;
  assert.equal(m.lifecycleStatus, 'ACTIVE');
  assert.equal(m.isPrimary, true); // makePrimary on the add
});

test('maker ≠ checker: HR creates on behalf, same HR cannot approve (403); SUPER can', async () => {
  const created = await req('POST', `/api/v1/payroll/employees/${tok.aman.user.employeeId}/payout-methods`, 'hr', {
    type: 'BANK', country: 'IN', rail: 'BANK_LOCAL', label: 'Aman Salary', holderName: 'Aman Kumar',
    details: { accountName: 'Aman Kumar', accountNumber: '50100100010001', ifsc: 'HDFC0001001' },
  });
  assert.equal(created.statusCode, 201);
  assert.equal(created.json().data.details.accountNumber, 'XXXXXXXXXX0001'); // HR-on-behalf → masked (non-owner)
  const amanMethodId = created.json().data.id;
  const q = await req('GET', '/api/v1/payroll/payout-methods/approvals?status=PENDING', 'hr');
  const appr = q.json().data.items.find((a) => a.methodId === amanMethodId);
  const self = await req('POST', `/api/v1/payroll/payout-methods/approvals/${appr.id}/approve`, 'hr', {});
  assert.equal(self.statusCode, 403);
  assert.equal(self.json().error.code, 'SELF_APPROVAL_FORBIDDEN');
  const bySuper = await req('POST', `/api/v1/payroll/payout-methods/approvals/${appr.id}/approve`, 'super', {});
  assert.equal(bySuper.statusCode, 200);
});

test('owner single-GET sees full details; non-owner sees masked', async () => {
  const owner = (await req('GET', `/api/v1/payroll/payout-methods/${priyaMethodId}`, 'priya')).json().data;
  assert.equal(owner.details.accountNumber, '50100123454821'); // full for owner
  const hr = (await req('GET', `/api/v1/payroll/payout-methods/${priyaMethodId}`, 'hr')).json().data;
  assert.equal(hr.details.accountNumber, 'XXXXXXXXXX4821'); // masked for non-owner
});

test('verify ACTIVE → VERIFIED; unverified queue reflects state', async () => {
  const v = await req('POST', `/api/v1/payroll/payout-methods/${priyaMethodId}/verify`, 'hr', { result: 'VERIFIED' });
  assert.equal(v.statusCode, 200);
  assert.equal(v.json().data.verificationStatus, 'VERIFIED');
  const unv = (await req('GET', '/api/v1/payroll/payout-methods/unverified', 'hr')).json().data;
  assert.ok(!unv.items.some((m) => m.id === priyaMethodId)); // now verified → not in queue
});

test('set-primary enqueues approval (202); archive removes from list (200)', async () => {
  const sp = await req('POST', `/api/v1/payroll/payout-methods/${priyaMethodId}/set-primary`, 'priya');
  assert.equal(sp.statusCode, 202);
  assert.equal(sp.json().data.kind, 'SET_PRIMARY');

  const ar = await req('POST', `/api/v1/payroll/payout-methods/${priyaMethodId}/archive`, 'priya');
  assert.equal(ar.statusCode, 200);
  assert.equal(ar.json().data.lifecycleStatus, 'ARCHIVED');
  const mine = (await req('GET', '/api/v1/payroll/me/payout-methods', 'priya')).json().data;
  assert.ok(!mine.methods.some((m) => m.id === priyaMethodId)); // archived excluded
});

test('reject requires a note (422) and transitions a METHOD_ADD to REJECTED', async () => {
  const created = await req('POST', `/api/v1/payroll/employees/${tok.aman.user.employeeId}/payout-methods`, 'hr', {
    type: 'BANK', country: 'IN', rail: 'BANK_LOCAL', label: 'Reject Me', holderName: 'Aman Kumar',
    details: { accountName: 'Aman Kumar', accountNumber: '50100100029999', ifsc: 'HDFC0001002' },
  });
  const mId = created.json().data.id;
  const q = await req('GET', '/api/v1/payroll/payout-methods/approvals?status=PENDING', 'super');
  const appr = q.json().data.items.find((a) => a.methodId === mId);

  const noNote = await req('POST', `/api/v1/payroll/payout-methods/approvals/${appr.id}/reject`, 'super', {});
  assert.equal(noNote.statusCode, 422);
  assert.equal(noNote.json().error.code, 'VALIDATION_ERROR');

  const ok = await req('POST', `/api/v1/payroll/payout-methods/approvals/${appr.id}/reject`, 'super', { note: 'wrong account' });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.json().data, { rejected: true });
  const m = (await req('GET', `/api/v1/payroll/payout-methods/${mId}`, 'super')).json().data;
  assert.equal(m.lifecycleStatus, 'REJECTED');
});

test('not-found surfaces 404', async () => {
  const r = await req('GET', '/api/v1/payroll/payout-methods/pm_does_not_exist', 'hr');
  assert.equal(r.statusCode, 404);
  assert.equal(r.json().error.code, 'NOT_FOUND');
});
