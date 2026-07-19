/**
 * Offline unit tests — personal read APIs must not 400 when employeeId is missing.
 * Run with Mocha: npx mocha tests/unit/noEmployeeRecord.reads.test.js
 */
import { expect } from 'chai';
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
    expect(id).to.equal(null);
  });

  it('emptyAttendanceSummary has zeroed counters + flag', () => {
    const s = emptyAttendanceSummary();
    expect(s.present).to.equal(0);
    expect(s.absent).to.equal(0);
    expect(s.noEmployeeRecord).to.equal(true);
  });

  it('getAttendanceSummary returns empty shape without hitting DB', async () => {
    const s = await getAttendanceSummary('tenant-x', requester, {});
    expect(s.totalDays).to.equal(0);
    expect(s.noEmployeeRecord).to.equal(true);
  });

  it('getAttendanceRecords returns empty list without hitting DB', async () => {
    const r = await getAttendanceRecords('tenant-x', requester, { page: 1, limit: 10 });
    expect(r.records).to.deep.equal([]);
    expect(r.total).to.equal(0);
    expect(r.noEmployeeRecord).to.equal(true);
  });

  it('resolveAttendanceCalendar returns empty UPCOMING calendar without DB', async () => {
    const cal = await resolveAttendanceCalendar('tenant-x', requester, { month: '2026-07' });
    expect(cal.noEmployeeRecord).to.equal(true);
    expect(cal.summary.absent).to.equal(0);
    expect(cal.lopDays).to.deep.equal([]);
    expect(cal.days.every((d) => d.bucket === 'UPCOMING' || d.bucket === 'WEEKLY_OFF')).to.equal(true);
  });
});
