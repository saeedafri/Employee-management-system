import * as attendanceRepository from './attendance.repository.js';
import { prisma } from '../../plugins/prisma.js';
import { resolveHolidayDateSet } from '../holidays/holidayResolver.service.js';
import { dateFromYmd, tenantAttendanceDate } from './attendanceDate.js';
import { resolveWorkWeekDays, weekStartDayFromDays } from '../../utils/workingDays.js';
import {
  notifyCheckIn,
  notifyCheckOut,
  notifyRegularizationRequested,
  notifyRegularizationApproved,
  notifyRegularizationDenied,
} from '../../utils/notifier.js';

class AppError extends Error {
  constructor(message, code, statusCode = 400, details = {}) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = (Math.sin(dLat / 2) * Math.sin(dLat / 2)) + (Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2));
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function checkIn(tenantId, employeeId, {
  latitude, longitude, note, date, workMode,
} = {}, { timezone = 'UTC', now = new Date() } = {}) {
  const today = dateFromYmd(date) || tenantAttendanceDate(now, timezone);
  const existingRecord = await attendanceRepository.getTodayAttendance(tenantId, employeeId, today);

  if (existingRecord && existingRecord.checkInAt) {
    throw new AppError('Already checked in today', 'ALREADY_CHECKED_IN', 400);
  }

  let geofenceValid = true;
  let locationJson = null;

  if (latitude !== undefined && longitude !== undefined) {
    locationJson = {
      latitude,
      longitude,
      checkedInAt: now,
    };

    const officeLatitude = 28.5244;
    const officeLongitude = 77.1855;
    const distance = calculateDistance(latitude, longitude, officeLatitude, officeLongitude);
    geofenceValid = distance <= 100;
  }

  let attendanceRecord;
  if (existingRecord) {
    attendanceRecord = await attendanceRepository.updateAttendanceRecord(tenantId, existingRecord.id, {
      checkInAt: now,
      notes: note || null,
      locationJson,
      ...(workMode ? { workMode } : {}),
    });
  } else {
    attendanceRecord = await attendanceRepository.createAttendanceRecord({
      tenantId,
      employeeId,
      attendanceDate: today,
      checkInAt: now,
      status: 'PRESENT',
      notes: note || null,
      locationJson,
      ...(workMode ? { workMode } : {}),
    });
  }

  const result = {
    id: attendanceRecord.id,
    referenceNo: attendanceRecord.referenceNo,
    checkInAt: attendanceRecord.checkInAt,
    geofenceValid,
  };

  notifyCheckIn(tenantId, employeeId, attendanceRecord).catch(() => {});

  return result;
}

export async function checkOut(tenantId, employeeId, { note } = {}, { timezone = 'UTC', now = new Date() } = {}) {
  const today = tenantAttendanceDate(now, timezone);
  const existingRecord = await attendanceRepository.getTodayAttendance(tenantId, employeeId, today);

  if (!existingRecord) {
    throw new AppError('No check-in record found for today', 'NO_CHECK_IN', 400);
  }

  if (!existingRecord.checkInAt) {
    throw new AppError('Not checked in yet', 'NOT_CHECKED_IN', 400);
  }

  if (existingRecord.checkOutAt) {
    throw new AppError('Already checked out today', 'ALREADY_CHECKED_OUT', 400);
  }

  const checkOutTime = now;
  const checkInTime = new Date(existingRecord.checkInAt);
  const durationMinutes = Math.round((checkOutTime - checkInTime) / (1000 * 60));

  const attendanceRecord = await attendanceRepository.updateAttendanceRecord(
    tenantId,
    existingRecord.id,
    {
      checkOutAt: checkOutTime,
      totalMinutes: durationMinutes,
      notes: note || null,
    },
  );

  const result = {
    id: attendanceRecord.id,
    referenceNo: attendanceRecord.referenceNo,
    checkInAt: attendanceRecord.checkInAt,
    checkOutAt: attendanceRecord.checkOutAt,
    durationMinutes,
  };

  notifyCheckOut(tenantId, employeeId, result).catch(() => {});

  return result;
}

function monthToDateRange(month) {
  const [year, mon] = month.split('-').map(Number);
  const from = new Date(Date.UTC(year, mon - 1, 1));
  const to = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));
  return { from, to };
}

function isAdminScope(user) {
  return ['HR_ADMIN', 'SUPER_ADMIN'].includes(user?.memberType);
}

export async function assertCanViewEmployee(tenantId, requester, requestedEmployeeId) {
  const ownEmployeeId = requester?.employeeId;

  if (!requestedEmployeeId) {
    if (!ownEmployeeId) {
      throw new AppError('User has no employee record', 'NO_EMPLOYEE_RECORD', 400);
    }
    return ownEmployeeId;
  }

  const target = await attendanceRepository.findEmployeeForScope(tenantId, requestedEmployeeId);
  if (!target) {
    throw new AppError('Employee not found', 'EMPLOYEE_NOT_FOUND', 404);
  }

  if (requestedEmployeeId === ownEmployeeId || isAdminScope(requester)) {
    return requestedEmployeeId;
  }

  if (requester?.memberType === 'MANAGER' && target.managerId === ownEmployeeId) {
    return requestedEmployeeId;
  }

  throw new AppError('Access denied for employee attendance', 'FORBIDDEN', 403);
}

function resolveDateRange({ month, fromDate, toDate } = {}) {
  if (month) {
    return monthToDateRange(month);
  }

  return {
    from: fromDate,
    to: toDate,
  };
}

export async function getAttendanceRecords(tenantId, requester, filters = {}) {
  const {
    page = 1, limit = 10,
  } = filters;

  const offset = (page - 1) * limit;
  const employeeId = await assertCanViewEmployee(tenantId, requester, filters.employeeId);
  const { from, to } = resolveDateRange(filters);

  return attendanceRepository.getAttendanceRecords(tenantId, employeeId, {
    fromDate: from,
    toDate: to,
    limit,
    offset,
  });
}

export async function getTeamAttendanceRecords(tenantId, requester, filters = {}) {
  const {
    page = 1, limit = 10, employeeId, departmentId,
  } = filters;

  const offset = (page - 1) * limit;
  if (employeeId) {
    await assertCanViewEmployee(tenantId, requester, employeeId);
  }
  const { from, to } = resolveDateRange(filters);

  return attendanceRepository.getTeamAttendanceRecords(tenantId, requester, {
    fromDate: from,
    toDate: to,
    limit,
    offset,
    employeeId,
    departmentId,
  });
}

export async function getAttendanceSummary(tenantId, requester, filters = {}) {
  const employeeId = await assertCanViewEmployee(tenantId, requester, filters.employeeId);
  const range = resolveDateRange(filters);
  const now = new Date();
  const startDate = range.from || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endDate = range.to || now;

  return attendanceRepository.getAttendanceSummary(tenantId, employeeId, startDate, endDate);
}

export async function submitRegularizationRequest(tenantId, employeeId, {
  attendanceDate, reason, type,
}) {
  const request = await attendanceRepository.createRegularizationRequest({
    tenantId,
    employeeId,
    attendanceDate: new Date(attendanceDate),
    type: type || 'LATE',
    reason,
    status: 'PENDING',
  });

  notifyRegularizationRequested(tenantId, employeeId, request).catch(() => {});

  return request;
}

export async function getRegularizationRequests(tenantId, employeeId, filters = {}) {
  const {
    page = 1, limit = 10, status,
  } = filters;

  const offset = (page - 1) * limit;

  return attendanceRepository.getRegularizationRequests(tenantId, employeeId, {
    limit,
    offset,
    status,
  });
}

export async function getTeamRegularizationRequests(tenantId, requester, filters = {}) {
  const {
    page = 1, limit = 10, status, employeeId, departmentId,
  } = filters;

  const offset = (page - 1) * limit;
  if (employeeId) {
    await assertCanViewEmployee(tenantId, requester, employeeId);
  }

  return attendanceRepository.getTeamRegularizationRequests(tenantId, requester, {
    limit,
    offset,
    status,
    employeeId,
    departmentId,
  });
}

async function assertCanReviewRegularization(tenantId, reviewer, request) {
  if (isAdminScope(reviewer)) return;

  if (reviewer?.memberType === 'MANAGER' && request.employee?.managerId === reviewer.employeeId) {
    return;
  }

  throw new AppError('Access denied for regularization request', 'FORBIDDEN', 403);
}

export async function approveRegularization(tenantId, regularizationId, reviewer, comment = '') {
  const request = await attendanceRepository.findRegularizationRequest(tenantId, regularizationId);

  if (!request) {
    throw new AppError('Regularization request not found', 'REGULARIZATION_NOT_FOUND', 404);
  }

  await assertCanReviewRegularization(tenantId, reviewer, request);

  if (request.status !== 'PENDING') {
    throw new AppError(
      `Cannot approve request with status ${request.status}`,
      'INVALID_REQUEST_STATUS',
      400,
    );
  }

  const updated = await attendanceRepository.updateRegularizationRequest(tenantId, regularizationId, {
    status: 'APPROVED',
    reviewerId: reviewer.sub,
    reviewerComment: comment || null,
  });

  await attendanceRepository.updateAttendanceStatus(tenantId, request.employeeId, request.attendanceDate, 'PRESENT');

  notifyRegularizationApproved(tenantId, request.employeeId, updated).catch(() => {});

  return updated;
}

export async function denyRegularization(tenantId, regularizationId, reviewer, comment) {
  const request = await attendanceRepository.findRegularizationRequest(tenantId, regularizationId);

  if (!request) {
    throw new AppError('Regularization request not found', 'REGULARIZATION_NOT_FOUND', 404);
  }

  await assertCanReviewRegularization(tenantId, reviewer, request);

  if (request.status !== 'PENDING') {
    throw new AppError(
      `Cannot deny request with status ${request.status}`,
      'INVALID_REQUEST_STATUS',
      400,
    );
  }

  const updated = await attendanceRepository.updateRegularizationRequest(tenantId, regularizationId, {
    status: 'DENIED',
    reviewerId: reviewer.sub,
    reviewerComment: comment,
  });

  notifyRegularizationDenied(tenantId, request.employeeId, updated).catch(() => {});

  return updated;
}

export async function getTeamWeeklyGrid(tenantId, weekStart, departmentId, managerEmployeeId) {
  // Truly-global work-week: build the tenant's working-day columns (Sun–Thu, Mon–Fri,
  // Mon–Sat, …) instead of a hardcoded Mon–Fri. Source = TenantConfig (fine-grained
  // workWeekDays[] over coarse workWeekPattern, fallback Mon–Fri), parsed to JS day
  // numbers (0=Sun..6=Sat). Payroll keeps its own per-LegalEntity work-week.
  const cfg = await attendanceRepository.getTenantWorkWeek(tenantId);
  const workWeek = resolveWorkWeekDays(cfg?.workWeekDays, cfg?.workWeekPattern);
  const workSet = new Set(workWeek);
  const startDow = weekStartDayFromDays(workWeek); // first working day of the week
  // Column span covers from the first working day through the last (wrap-safe), so a
  // Sun–Thu week is 5 columns Sun→Thu and Mon–Sat is 6 columns Mon→Sat.
  const span = workWeek.reduce((m, d) => Math.max(m, (d - startDow + 7) % 7), 0) + 1;

  // Anchor on the caller's weekStart when given, else today; snap back to the work-week's
  // first day so the grid always begins on a real working day (compensates for a client
  // that anchors on Monday regardless of the tenant work-week). All date math is UTC so it
  // stays consistent with toISOString()/attendanceDate formatting (no off-by-one TZ shift).
  const anchor = weekStart ? new Date(`${weekStart}T00:00:00.000Z`) : new Date();
  const startDate = new Date(Date.UTC(
    anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(),
  ));
  startDate.setUTCDate(startDate.getUTCDate() - ((startDate.getUTCDay() - startDow + 7) % 7));
  const weekDates = [];
  for (let i = 0; i < span; i++) {
    const d = new Date(startDate); d.setUTCDate(d.getUTCDate() + i); weekDates.push(d);
  }
  const endDate = weekDates[weekDates.length - 1];

  const employeeWhere = { tenantId, deletedAt: null, employmentStatus: 'ACTIVE' };
  if (departmentId) employeeWhere.departmentId = departmentId;
  else if (managerEmployeeId) employeeWhere.managerId = managerEmployeeId;

  const [employees, attendanceRecords, leaveRecords] = await Promise.all([
    attendanceRepository.getTeamMembers(tenantId, departmentId, managerEmployeeId),
    attendanceRepository.getAttendanceInRange(tenantId, weekDates.map(d => d), employeeWhere),
    attendanceRepository.getApprovedLeavesInRange(tenantId, startDate, endDate),
  ]);

  // Shared holiday engine (HOLIDAY_ENGINE_BACKEND_CONTRACT §3): resolve PER EMPLOYEE — each
  // member's calendar uses their own country/work-week resolution, identical to that employee's
  // leave-preview + payslip holidayBasis (no tenant-wide divergence for multi-country teams).
  const holidayByEmp = new Map(
    await Promise.all(employees.map((e) => resolveHolidayDateSet(prisma, tenantId, {
      employeeId: e.id, from: startDate, to: endDate,
    }).then((r) => [e.id, r.dates]))),
  );
  const EMPTY = new Set();

  const codeForDay = (empId, dateStr) => {
    const dateObj = new Date(`${dateStr}T00:00:00.000Z`);
    const dayOfWeek = dateObj.getUTCDay();
    if (!workSet.has(dayOfWeek)) return 'O'; // non-working day per tenant work-week
    if ((holidayByEmp.get(empId) || EMPTY).has(dateStr)) return 'O';

    const leave = leaveRecords.find(l => l.employeeId === empId
      && new Date(l.startDate) <= dateObj && new Date(l.endDate) >= dateObj);
    if (leave) return 'L';

    const att = attendanceRecords.find(a => a.employeeId === empId && a.attendanceDate.toISOString().split('T')[0] === dateStr);
    if (!att) return 'A';
    if (att.status === 'PRESENT') return 'P';
    if (att.status === 'WFH') return 'W';
    if (att.status === 'HALF_DAY') return 'H';
    if (att.status === 'ABSENT') return 'A';
    if (att.status === 'LEAVE') return 'L';
    return 'A';
  };

  const members = employees.map(emp => ({
    employeeId: emp.id,
    name: `${emp.firstName[0]}. ${emp.lastName}`,
    designation: emp.designation || '',
    days: weekDates.map(d => {
      const dateStr = d.toISOString().split('T')[0];
      return { date: dateStr, code: codeForDay(emp.id, dateStr) };
    }),
  }));

  return {
    weekStart: weekDates[0].toISOString().split('T')[0],
    members,
  };
}
