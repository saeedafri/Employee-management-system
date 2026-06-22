import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { prisma } from '../src/plugins/prisma.js';
import {
  dateFromYmd,
  tenantAttendanceDate,
  ymdInTimezone,
} from '../src/modules/attendance/attendanceDate.js';

const TENANT_KEY = 'acme-corp-001';
const LOGIN_EMAIL = 'hr@acme.test';
const LOGIN_PASSWORD = 'Password123!';
const BOUNDARY_NOW = new Date('2035-01-01T20:00:00.000Z');

let app;

test.before(async () => {
  app = await createApp();
  await app.ready();
});

test.after(async () => {
  if (app) await app.close();
});

function cookieHeader(response) {
  const rows = response.headers['set-cookie'];
  assert.ok(Array.isArray(rows), 'expected login to set auth cookies');
  return rows.map((row) => row.split(';')[0]).join('; ');
}

async function login() {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      'content-type': 'application/json',
      'x-tenant-key': TENANT_KEY,
    },
    payload: {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    },
  });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.data.user.employeeId, 'HR test user must have an employee profile');
  return { cookie: cookieHeader(response), employeeId: body.data.user.employeeId };
}

test('tenantAttendanceDate classifies a UTC boundary by tenant timezone', () => {
  assert.equal(ymdInTimezone(BOUNDARY_NOW, 'Asia/Kolkata'), '2035-01-02');
  assert.equal(ymdInTimezone(BOUNDARY_NOW, 'America/New_York'), '2035-01-01');
  assert.equal(ymdInTimezone(BOUNDARY_NOW, 'Not/AZone'), '2035-01-01');
  assert.equal(tenantAttendanceDate(BOUNDARY_NOW, 'Asia/Kolkata').toISOString(), '2035-01-02T00:00:00.000Z');
  assert.equal(dateFromYmd('2035-01-02').toISOString(), '2035-01-02T00:00:00.000Z');
  assert.equal(dateFromYmd('bad-date'), null);
});

test('check-in, today, and check-out use the tenant-local day when UTC is previous date', async () => {
  let tenantId;
  let employeeId;
  const attendanceDate = tenantAttendanceDate(BOUNDARY_NOW, 'Asia/Kolkata');

  mock.timers.enable({ apis: ['Date'], now: BOUNDARY_NOW });
  try {
    const tenant = await prisma.tenant.findUnique({ where: { tenantKey: TENANT_KEY } });
    assert.ok(tenant);
    assert.equal(tenant.timezone, 'Asia/Kolkata');
    tenantId = tenant.id;

    const auth = await login();
    employeeId = auth.employeeId;

    await prisma.attendanceRecord.deleteMany({
      where: { tenantId, employeeId, attendanceDate },
    });

    const checkIn = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/check-in',
      headers: {
        cookie: auth.cookie,
        'content-type': 'application/json',
      },
      payload: { workMode: 'WFH' },
    });
    assert.equal(checkIn.statusCode, 201);
    assert.equal(checkIn.json().success, true);

    const row = await prisma.attendanceRecord.findUnique({
      where: {
        tenantId_employeeId_attendanceDate: {
          tenantId,
          employeeId,
          attendanceDate,
        },
      },
    });
    assert.ok(row);
    assert.equal(row.attendanceDate.toISOString(), '2035-01-02T00:00:00.000Z');
    assert.equal(row.checkInAt.toISOString(), BOUNDARY_NOW.toISOString());
    assert.equal(row.workMode, 'WFH');

    const today = await app.inject({
      method: 'GET',
      url: '/api/v1/attendance/today',
      headers: { cookie: auth.cookie },
    });
    assert.equal(today.statusCode, 200);
    const todayBody = today.json();
    assert.equal(todayBody.success, true);
    assert.equal(todayBody.data.date, '2035-01-02T00:00:00.000Z');
    assert.equal(todayBody.data.status, 'PRESENT');
    assert.equal(todayBody.data.checkInAt, BOUNDARY_NOW.toISOString());

    const checkOut = await app.inject({
      method: 'POST',
      url: '/api/v1/attendance/check-out',
      headers: {
        cookie: auth.cookie,
        'content-type': 'application/json',
      },
      payload: { note: 'boundary checkout' },
    });
    assert.equal(checkOut.statusCode, 200);
    assert.equal(checkOut.json().success, true);

    const updated = await prisma.attendanceRecord.findUnique({
      where: {
        tenantId_employeeId_attendanceDate: {
          tenantId,
          employeeId,
          attendanceDate,
        },
      },
    });
    assert.equal(updated.checkOutAt.toISOString(), BOUNDARY_NOW.toISOString());
  } finally {
    mock.timers.reset();
    if (tenantId && employeeId) {
      await prisma.attendanceRecord.deleteMany({
        where: { tenantId, employeeId, attendanceDate },
      });
    }
  }
});
