/**
 * Offline unit tests — personal read APIs must not 400 when employeeId is missing.
 * Run: node --test tests/unit/noEmployeeRecord.reads.test.js
 *
 * Ported from chai to node:assert — `chai` is not a dependency of this project,
 * so this file threw ERR_MODULE_NOT_FOUND and had never actually executed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCanViewEmployee,
  emptyAttendanceSummary,
  getAttendanceRecords,
  getAttendanceSummary,
} from '../../src/modules/attendance/attendance.service.js';
import { resolveAttendanceCalendar } from '../../src/modules/attendance/attendanceCalendar.service.js';

describe('NO_EMPLOYEE_RECORD — personal read paths', () => {
  const requester = { memberType: 'SUPER_ADMIN', employeeId: null };

  it('assertCanViewEmployee returns null (not throw) for me-scope without employee', async () => {
    const id = await assertCanViewEmployee('tenant-x', requester, undefined);
    assert.equal(id, null);
  });

  it('emptyAttendanceSummary has zeroed counters + flag', () => {
    const s = emptyAttendanceSummary();
    assert.equal(s.present, 0);
    assert.equal(s.absent, 0);
    assert.equal(s.noEmployeeRecord, true);
  });

  it('getAttendanceSummary returns empty shape without hitting DB', async () => {
    const s = await getAttendanceSummary('tenant-x', requester, {});
    assert.equal(s.totalDays, 0);
    assert.equal(s.noEmployeeRecord, true);
  });

  it('getAttendanceRecords returns empty list without hitting DB', async () => {
    const r = await getAttendanceRecords('tenant-x', requester, { page: 1, limit: 10 });
    assert.deepEqual(r.records, []);
    assert.equal(r.total, 0);
    assert.equal(r.noEmployeeRecord, true);
  });

  it('resolveAttendanceCalendar returns empty UPCOMING calendar without DB', async () => {
    const cal = await resolveAttendanceCalendar('tenant-x', requester, { month: '2026-07' });
    assert.equal(cal.noEmployeeRecord, true);
    assert.equal(cal.summary.absent, 0);
    assert.deepEqual(cal.lopDays, []);
    assert.equal(cal.days.every((d) => d.bucket === 'UPCOMING' || d.bucket === 'WEEKLY_OFF'), true);
  });
});
