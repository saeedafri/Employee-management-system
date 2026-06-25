// ── BE-1 Per-Employee Monthly Attendance Calendar (BE1_ATTENDANCE_CALENDAR_CONTRACT) ──
// The backend transcription of the FE reference engine (classifyDay.ts / classifyMonth.ts /
// contextResolve.ts). It is the SINGLE source of truth that retires FE/BE drift: same holiday
// set as GET /me/holidays (shared resolver), same work-week + observed shifting, same strict
// per-day precedence and summary math. Config-over-code: no `if (country === …)` anywhere.
import { prisma } from '../../plugins/prisma.js';
import { resolveHolidayDateSet } from '../holidays/holidayResolver.service.js';
import { getAttendanceRules } from '../settings/settings.repository.js';
import { ymdInTimezone } from './attendanceDate.js';
import * as attendanceRepository from './attendance.repository.js';
import { assertCanViewEmployee } from './attendance.service.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = []) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

const WEEKDAY_TOKENS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const isoDay = (v) => new Date(v).toISOString().slice(0, 10);

// §4.1 parity-critical: the FE compares the literal HH:mm substring (positions 11–16) of the
// checkInAt string to lateAfter — NO timezone conversion. We emit checkInAt as that same ISO
// string and compare its [11,16) slice, so FE-fallback and BE agree byte-for-byte.
const wallHHmm = (isoStr) => new Date(isoStr).toISOString().slice(11, 16);

const daysInMonth = (year, mon1to12) => new Date(Date.UTC(year, mon1to12, 0)).getUTCDate();

/**
 * PURE. Build the full month of classified days + summary + lopDays from resolved primitives.
 * Mirrors classifyDay.ts (§4 precedence) and classifyMonth.ts (§5 math) exactly.
 *
 * @param {object} p
 *   month        'YYYY-MM'
 *   holidaySet   Set<'YYYY-MM-DD'> effective off-days (mandatory + selected optional)
 *   holidayNames Map<'YYYY-MM-DD', string>
 *   workWeekDays number[] JS dow (0=Sun..6=Sat) that are working days
 *   leaveSpans   [{ start:'YYYY-MM-DD', end:'YYYY-MM-DD', leaveTypeName, isPaid }]
 *   recordsByDate Map<'YYYY-MM-DD', record>  (record already in §3 wire shape, or absent)
 *   thresholds   { lateAfter:'HH:mm', halfDayMinutes:number }
 *   todayKey     'YYYY-MM-DD' today in the employee's resolved timezone
 */
export function buildCalendar({
  month, holidaySet, holidayNames, workWeekDays, leaveSpans, recordsByDate, thresholds, todayKey,
}) {
  const [year, mon] = month.split('-').map(Number);
  const workSet = new Set(workWeekDays);
  const { lateAfter, halfDayMinutes } = thresholds;
  const days = [];

  const leaveForDay = (d) => leaveSpans.find((s) => s.start <= d && d <= s.end) || null;

  for (let dom = 1; dom <= daysInMonth(year, mon); dom += 1) {
    const date = `${month}-${String(dom).padStart(2, '0')}`;
    const utcDow = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    const weekDay = WEEKDAY_TOKENS[utcDow];
    const record = recordsByDate.get(date) || null;

    let bucket; let holidayName = null; let leaveType = null; let isLop = false;

    if (holidaySet.has(date)) {
      // 1. HOLIDAY — wins over weekly-off and leave (a holiday on a non-working day is HOLIDAY).
      bucket = 'HOLIDAY';
      holidayName = holidayNames.get(date) || null;
    } else if (!workSet.has(utcDow)) {
      // 2. WEEKLY_OFF
      bucket = 'WEEKLY_OFF';
    } else {
      const leave = leaveForDay(date);
      if (leave) {
        // 3. PAID_LEAVE / UNPAID_LEAVE — paid-ness from the type; unknown defaults to paid.
        bucket = leave.isPaid === false ? 'UNPAID_LEAVE' : 'PAID_LEAVE';
        leaveType = leave.leaveTypeName || null;
      } else if (record && record.checkInAt) {
        // 4. Worked family — sub-order: HALF_DAY → WFH → LATE → WORKED
        if (record.totalMinutes != null && record.totalMinutes < halfDayMinutes) {
          bucket = 'HALF_DAY';
        } else if (record.workMode === 'WFH') {
          bucket = 'WFH';
        } else if (wallHHmm(record.checkInAt) > lateAfter) {
          bucket = 'LATE';
        } else {
          bucket = 'WORKED';
        }
      } else if (date < todayKey) {
        // 5. ABSENT — strictly-past working day, no check-in and no leave. The ONLY isLop bucket.
        bucket = 'ABSENT';
        isLop = true;
      } else {
        // 6. UPCOMING — today or a future working day, not yet worked.
        bucket = 'UPCOMING';
      }
    }

    days.push({
      date, weekDay, bucket, holidayName, leaveType, isLop, record,
    });
  }

  // §5 summary — UPCOMING is not counted anywhere.
  const count = (b) => days.filter((d) => d.bucket === b).length;
  const present = count('WORKED');
  const wfh = count('WFH');
  const late = count('LATE');
  const halfDay = count('HALF_DAY');
  const absent = count('ABSENT');
  const leave = count('PAID_LEAVE') + count('UNPAID_LEAVE');
  const holiday = count('HOLIDAY');
  const weeklyOff = count('WEEKLY_OFF');

  const totalDays = present + wfh + late + halfDay + absent; // elapsed WORKING days only
  const workedEquivalent = present + wfh + late + (0.5 * halfDay);
  const attendancePercentage = totalDays === 0 ? 0 : Math.round((workedEquivalent / totalDays) * 100);
  const lopDays = days.filter((d) => d.isLop).map((d) => d.date);

  return {
    month,
    days,
    summary: {
      totalDays, present, wfh, late, halfDay, leave, absent, holiday, weeklyOff, attendancePercentage,
    },
    lopDays,
  };
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// §3 wire shape for the day's AttendanceRecord (camelCase, dates as ISO strings, or null).
function toRecordShape(r) {
  if (!r) return null;
  return {
    id: r.id,
    referenceNo: r.referenceNo,
    attendanceDate: r.attendanceDate ? new Date(r.attendanceDate).toISOString() : null,
    checkInAt: r.checkInAt ? new Date(r.checkInAt).toISOString() : null,
    checkOutAt: r.checkOutAt ? new Date(r.checkOutAt).toISOString() : null,
    status: r.status,
    workMode: r.workMode ?? null,
    totalMinutes: r.totalMinutes ?? null,
    notes: r.notes ?? null,
  };
}

/**
 * DB-backed BE-1 calendar for an employee. RBAC: self always; MANAGER→team; HR/SA→anyone.
 * @param requestedEmployeeId  undefined → self (caller's employee); else the :id target.
 */
export async function resolveAttendanceCalendar(tenantId, requester, { month, employeeId: requestedEmployeeId } = {}) {
  if (!month || !MONTH_RE.test(month)) {
    throw new AppError('month must be provided as YYYY-MM', 'VALIDATION_ERROR', 422, [
      { field: 'month', message: 'Required, format YYYY-MM' },
    ]);
  }

  // 403/404/own-resolution reuse the exact attendance scoping rules.
  const employeeId = await assertCanViewEmployee(tenantId, requester, requestedEmployeeId);

  const [year, mon] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, mon - 1, 1));
  const to = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

  // Shared resolver (§3): same holidays/work-week/timezone as GET /me/holidays + leave + payroll.
  const hol = await resolveHolidayDateSet(prisma, tenantId, { employeeId, from, to });
  const ctx = hol.context;

  // §6 thresholds — entity hours/day → fallback 8; attendance-rules (snake_case) → defaults.
  const rules = await getAttendanceRules(tenantId);
  const hoursPerDay = ctx.hoursPerDay ?? 8;
  const fullDay = Math.round(hoursPerDay * 60);
  const lateAfter = (typeof rules.late_after === 'string' && rules.late_after.trim()) || '09:30';
  const halfDayMinutes = rules.half_day_threshold_minutes ?? Math.round(fullDay / 2);

  const [leaves, recordsResult] = await Promise.all([
    attendanceRepository.getApprovedLeavesForEmployee(tenantId, employeeId, from, to),
    attendanceRepository.getAttendanceRecords(tenantId, employeeId, { fromDate: from, toDate: to, limit: 400, offset: 0 }),
  ]);

  const leaveSpans = leaves.map((l) => ({
    start: isoDay(l.startDate),
    end: isoDay(l.endDate),
    leaveTypeName: l.leaveType?.name || null,
    isPaid: l.leaveType ? l.leaveType.isPaid : true, // unknown type → paid (§4.3)
  }));

  const recordsByDate = new Map();
  for (const r of recordsResult.records) {
    recordsByDate.set(isoDay(r.attendanceDate), toRecordShape(r));
  }

  const holidayNames = new Map(hol.holidays.map((h) => [h.holidayDate.slice(0, 10), h.name]));
  const todayKey = ymdInTimezone(new Date(), ctx.timezone);

  return buildCalendar({
    month,
    holidaySet: hol.dates,
    holidayNames,
    workWeekDays: hol.workWeekDays,
    leaveSpans,
    recordsByDate,
    thresholds: { lateAfter, halfDayMinutes },
    todayKey,
  });
}
