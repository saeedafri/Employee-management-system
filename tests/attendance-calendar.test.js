import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar } from '../src/modules/attendance/attendanceCalendar.service.js';

// Mon–Fri work-week (JS dow 1..5). June 2026: 06-01 = Monday; 06-06/07 = Sat/Sun.
const WORKWEEK = [1, 2, 3, 4, 5];
const THRESHOLDS = { lateAfter: '09:30', halfDayMinutes: 240 };
const rec = (date, hhmm, totalMinutes, workMode = 'OFFICE') => ({
  id: `r-${date}`,
  referenceNo: `ATT-${date}`,
  attendanceDate: `${date}T00:00:00.000Z`,
  checkInAt: `${date}T${hhmm}:00.000Z`,
  checkOutAt: null,
  status: 'PRESENT',
  workMode,
  totalMinutes,
  notes: null,
});

test('§4 per-day precedence: holiday > weekly-off > leave > worked-family > absent > upcoming', () => {
  const recordsByDate = new Map([
    ['2026-06-04', rec('2026-06-04', '09:00', 120)], // < halfDayMinutes → HALF_DAY
    ['2026-06-05', rec('2026-06-05', '10:00', 480)], // 10:00 > 09:30 → LATE
    ['2026-06-08', rec('2026-06-08', '09:00', 480, 'WFH')], // → WFH
    ['2026-06-09', rec('2026-06-09', '09:00', 480)], // 09:00 !> 09:30 → WORKED
  ]);
  const res = buildCalendar({
    month: '2026-06',
    holidaySet: new Set(['2026-06-01']),
    holidayNames: new Map([['2026-06-01', 'Test Holiday']]),
    workWeekDays: WORKWEEK,
    leaveSpans: [
      { start: '2026-06-01', end: '2026-06-01', leaveTypeName: 'Annual', isPaid: true }, // loses to holiday
      { start: '2026-06-02', end: '2026-06-02', leaveTypeName: 'Annual', isPaid: true },
      { start: '2026-06-03', end: '2026-06-03', leaveTypeName: 'LWP', isPaid: false },
    ],
    recordsByDate,
    thresholds: THRESHOLDS,
    todayKey: '2026-06-11', // 06-10 is strictly past; 06-11 is "today"
  });

  const by = Object.fromEntries(res.days.map((d) => [d.date, d]));
  assert.equal(res.days.length, 30, 'one entry per calendar day');

  assert.equal(by['2026-06-01'].bucket, 'HOLIDAY'); // holiday wins over leave
  assert.equal(by['2026-06-01'].holidayName, 'Test Holiday');
  assert.equal(by['2026-06-01'].isLop, false);
  assert.equal(by['2026-06-02'].bucket, 'PAID_LEAVE');
  assert.equal(by['2026-06-02'].leaveType, 'Annual');
  assert.equal(by['2026-06-03'].bucket, 'UNPAID_LEAVE');
  assert.equal(by['2026-06-04'].bucket, 'HALF_DAY');
  assert.equal(by['2026-06-05'].bucket, 'LATE');
  assert.equal(by['2026-06-08'].bucket, 'WFH');
  assert.equal(by['2026-06-09'].bucket, 'WORKED');
  assert.equal(by['2026-06-10'].bucket, 'ABSENT'); // past working day, no record/leave
  assert.equal(by['2026-06-10'].isLop, true);
  assert.equal(by['2026-06-06'].bucket, 'WEEKLY_OFF'); // Saturday
  assert.equal(by['2026-06-06'].weekDay, 'SAT');
  assert.equal(by['2026-06-07'].bucket, 'WEEKLY_OFF'); // Sunday
  assert.equal(by['2026-06-11'].bucket, 'UPCOMING'); // today, not yet worked
  assert.ok(res.lopDays.includes('2026-06-10'));
});

test('§5 summary math: totalDays excludes leave/holiday/weekly-off/upcoming; % rounds', () => {
  // todayKey 06-30 → only 06-30 (Tue) is "today"; the other 21 working days are past.
  // 5 WORKED records; remaining 16 past working days → ABSENT. 8 weekend days → weekly-off.
  const recordsByDate = new Map(
    ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05']
      .map((d) => [d, rec(d, '09:00', 480)]),
  );
  const res = buildCalendar({
    month: '2026-06',
    holidaySet: new Set(),
    holidayNames: new Map(),
    workWeekDays: WORKWEEK,
    leaveSpans: [],
    recordsByDate,
    thresholds: THRESHOLDS,
    todayKey: '2026-06-30',
  });

  const s = res.summary;
  assert.equal(s.present, 5);
  assert.equal(s.absent, 16);
  assert.equal(s.weeklyOff, 8);
  assert.equal(s.holiday, 0);
  assert.equal(s.leave, 0);
  assert.equal(s.totalDays, 21); // 5 present + 16 absent
  assert.equal(s.attendancePercentage, 24); // round(5/21*100) = 24
  assert.equal(res.lopDays.length, 16);
  // UPCOMING (06-30) is not counted anywhere.
  assert.equal(res.days.find((d) => d.date === '2026-06-30').bucket, 'UPCOMING');
});

test('unknown leave type defaults to paid only via service; pure engine honors explicit isPaid', () => {
  const res = buildCalendar({
    month: '2026-06',
    holidaySet: new Set(),
    holidayNames: new Map(),
    workWeekDays: WORKWEEK,
    leaveSpans: [{ start: '2026-06-02', end: '2026-06-02', leaveTypeName: null, isPaid: true }],
    recordsByDate: new Map(),
    thresholds: THRESHOLDS,
    todayKey: '2026-06-01',
  });
  const day = res.days.find((d) => d.date === '2026-06-02');
  assert.equal(day.bucket, 'PAID_LEAVE');
  assert.equal(day.leaveType, null);
});
