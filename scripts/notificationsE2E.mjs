#!/usr/bin/env node
/**
 * Notifications end-to-end: does an event actually reach a connected client in real time?
 * Runs the real app against ems_test — no production data touched.
 */
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';

const TENANT_KEY = 'acme-corp-001';
const PASSWORD = 'Password123!';
const app = await createApp();
await app.ready();

const login = async (email) => {
  const r = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json', 'x-tenant-key': TENANT_KEY },
    payload: { email, password: PASSWORD },
  });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode} ${r.body}`);
  const d = r.json().data;
  return { token: d.accessToken, userId: d.user.id, employeeId: d.user.employeeId };
};

const call = (method, url, token, payload) => app.inject({
  method, url,
  headers: { authorization: `Bearer ${token}`, 'x-tenant-key': TENANT_KEY, 'content-type': 'application/json' },
  ...(payload ? { payload } : {}),
});

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ' — ' + detail : ''}`);
};

const hr = await login('hr@acme.test');
const sa = await login('superadmin@acme.test');
const emp = await login('priya@acme.test');
console.log(`hr.userId=${hr.userId}  priya.employeeId=${emp.employeeId}\n`);

// ── 1. REST surface ─────────────────────────────────────────────────────────
const list = await call('GET', '/api/v1/notifications?limit=5', hr.token);
check('GET /notifications', list.statusCode === 200, `status ${list.statusCode}`);
const listShape = list.json()?.data;
check('list response shape', Array.isArray(listShape?.notifications ?? listShape?.items ?? listShape),
  `keys: ${Object.keys(listShape ?? {}).join(',')}`);

const count = await call('GET', '/api/v1/notifications/unread-count', hr.token);
check('GET /notifications/unread-count', count.statusCode === 200,
  JSON.stringify(count.json()?.data));

// ── 2. SSE stream: subscribe, then trigger an event ─────────────────────────
// app.inject() cannot hold a stream open, so assert the in-process emitter
// directly — that is exactly what the route writes to.
const { addClient, removeClient, getSseDiagnostics, initSseFanout } = await import(
  '../src/utils/sseClients.js');

// Cross-instance fan-out: enabled when REDIS_URL is set, silently local otherwise.
const fanout = await initSseFanout();
check('SSE fan-out init (no-ops without REDIS_URL)', typeof fanout?.enabled === 'boolean',
  `enabled=${fanout?.enabled}`);

const received = [];
const recvEmp = [];
const fakeReply = { raw: { write: (chunk) => received.push(chunk), writableEnded: false } };
const empReply = { raw: { write: (chunk) => recvEmp.push(chunk), writableEnded: false } };
// notifyCheckIn targets [employee, manager, SUPER_ADMIN] — HR_ADMIN is NOT a
// notification recipient (they only receive the analytics_update event).
addClient(sa.userId, fakeReply);
addClient(emp.userId, empReply);
check('SSE client registered', getSseDiagnostics().connectionCount >= 1,
  JSON.stringify(getSseDiagnostics()));

// ── 3. Trigger a real domain event: employee requests leave ─────────────────
// Attendance check-in fires notifyCheckIn -> manager + HR. No balance needed.
const created = await call('POST', '/api/v1/attendance/check-in', emp.token, {
  workMode: 'WFH', location: 'e2e-probe',
});
check('POST /attendance/check-in (event trigger)', [200, 201].includes(created.statusCode),
  `status ${created.statusCode} ${created.statusCode >= 400 ? created.body.slice(0, 200) : ''}`);

// notifier writes are fire-and-forget; give them a tick
await new Promise((r) => setTimeout(r, 1500));

const pushed = received.join('');
check('real-time SSE push received by SUPER_ADMIN', pushed.includes('attendance_checkin'),
  pushed ? `${received.length} frame(s): ${pushed.replace(/\n/g, ' ').slice(0, 150)}` : 'NO FRAMES');
const pushedEmp = recvEmp.join('');
check('real-time SSE push received by the employee', pushedEmp.includes('attendance_checkin'),
  pushedEmp ? `${recvEmp.length} frame(s)` : 'NO FRAMES');

// ── 4. Persisted for later retrieval ────────────────────────────────────────
const after = await call('GET', '/api/v1/notifications?limit=5', sa.token);
const rows = after.json()?.data?.notifications ?? after.json()?.data?.items ?? [];
const found = rows.find((n) => /check|attend/i.test(`${n.type ?? ''} ${n.title ?? ''}`));
check('notification persisted and listable', Boolean(found),
  found ? `${found.type}: ${found.title}` : `${rows.length} rows, none leave-related`);

if (found) {
  const mark = await call('PATCH', `/api/v1/notifications/${found.id}/read`, sa.token);
  check('PATCH /notifications/:id/read', mark.statusCode === 200, `status ${mark.statusCode}`);
}

// ── 5. New events emit and reach their recipient ────────────────────────────
const { notifyDocumentUploaded } = await import('../src/utils/notifier.js');
recvEmp.length = 0;
await notifyDocumentUploaded(
  (await prisma.tenant.findUnique({ where: { tenantKey: TENANT_KEY }, select: { id: true } })).id,
  emp.employeeId,
  { id: 'doc-e2e-probe', title: 'Offer Letter' },
);
await new Promise((r) => setTimeout(r, 800));
check('document_uploaded reaches the employee',
  recvEmp.join('').includes('document_uploaded'),
  recvEmp.length ? `${recvEmp.length} frame(s)` : 'NO FRAMES');

const diag = getSseDiagnostics();
check('diagnostics expose fan-out state',
  'fanoutEnabled' in diag && 'published' in diag, JSON.stringify(diag));

removeClient(sa.userId, fakeReply);
removeClient(emp.userId, empReply);

// cleanup the probe row
try {
  const id = created.json()?.data?.id;
  if (id) await prisma.attendanceRecord.deleteMany({ where: { id } });
} catch { /* best effort */ }

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
await app.close();
await prisma.$disconnect();
process.exit(results.every((r) => r.ok) ? 0 : 1);
