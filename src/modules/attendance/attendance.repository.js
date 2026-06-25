import { prisma } from '../../plugins/prisma.js';
import { attendanceDayRange, tenantAttendanceDate } from './attendanceDate.js';

// Tenant-level work-week (coarse pattern + fine-grained override) for the team grid.
export async function getTenantWorkWeek(tenantId) {
  return prisma.tenantConfig.findUnique({
    where: { tenantId },
    select: { workWeekPattern: true, workWeekDays: true },
  });
}

function attRef(r) {
  if (!r) return r;
  const { seqNo, ...rest } = r;
  return { ...rest, referenceNo: `ATT-${String(seqNo).padStart(4, '0')}` };
}

function regRef(r) {
  if (!r) return r;
  const { seqNo, ...rest } = r;
  return { ...rest, referenceNo: `REG-${String(seqNo).padStart(4, '0')}` };
}

export async function getTodayAttendance(tenantId, employeeId, attendanceDate = tenantAttendanceDate()) {
  const { start, end } = attendanceDayRange(attendanceDate);

  return prisma.attendanceRecord.findFirst({
    where: {
      tenantId,
      employeeId,
      attendanceDate: {
        gte: start,
        lt: end,
      },
    },
  });
}

export async function createAttendanceRecord(data) {
  const r = await prisma.attendanceRecord.create({ data });
  return attRef(r);
}

export async function updateAttendanceRecord(tenantId, attendanceRecordId, data) {
  const r = await prisma.attendanceRecord.update({
    where: { id: attendanceRecordId },
    data,
  });
  return attRef(r);
}

export async function getAttendanceRecords(tenantId, employeeId, filters = {}) {
  const {
    fromDate, toDate, limit = 10, offset = 0,
  } = filters;

  const where = {
    tenantId,
    employeeId,
  };

  if (fromDate || toDate) {
    where.attendanceDate = {};
    if (fromDate) where.attendanceDate.gte = fromDate;
    if (toDate) where.attendanceDate.lte = toDate;
  }

  const [raw, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: { attendanceDate: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { records: raw.map(attRef), total };
}

function scopedEmployeeWhere(tenantId, requester, filters = {}) {
  const { employeeId, departmentId } = filters;
  const isAdmin = ['HR_ADMIN', 'SUPER_ADMIN'].includes(requester?.memberType);
  const where = {
    tenantId,
    deletedAt: null,
  };

  if (employeeId) {
    where.id = employeeId;
  } else if (!isAdmin) {
    where.managerId = requester?.employeeId || '__none__';
  }

  if (departmentId) {
    where.departmentId = departmentId;
  }

  return where;
}

export async function findEmployeeForScope(tenantId, employeeId) {
  if (!employeeId) return null;
  return prisma.employee.findFirst({
    where: {
      tenantId,
      id: employeeId,
      deletedAt: null,
    },
    select: {
      id: true,
      managerId: true,
      departmentId: true,
    },
  });
}

export async function getTeamAttendanceRecords(tenantId, requester, filters = {}) {
  const {
    fromDate, toDate, limit = 10, offset = 0, employeeId, departmentId,
  } = filters;

  const where = {
    tenantId,
    employee: scopedEmployeeWhere(tenantId, requester, { employeeId, departmentId }),
  };

  if (fromDate || toDate) {
    where.attendanceDate = {};
    if (fromDate) where.attendanceDate.gte = fromDate;
    if (toDate) where.attendanceDate.lte = toDate;
  }

  const [raw, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { attendanceDate: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { records: raw.map(attRef), total };
}

export async function getAttendanceSummary(tenantId, employeeId, fromDate, toDate) {
  const where = {
    tenantId,
    employeeId,
    attendanceDate: {
      gte: fromDate,
      lte: toDate,
    },
  };

  const records = await prisma.attendanceRecord.findMany({
    where,
    select: {
      status: true,
      attendanceDate: true,
    },
  });

  const summary = {
    totalDays: records.length,
    present: 0,
    absent: 0,
    leave: 0,
    wfh: 0,
    halfDay: 0,
    holiday: 0,
    late: 0,
  };

  records.forEach((record) => {
    switch (record.status) {
    case 'PRESENT':
      summary.present += 1;
      break;
    case 'ABSENT':
      summary.absent += 1;
      break;
    case 'LEAVE':
      summary.leave += 1;
      break;
    case 'WFH':
      summary.wfh += 1;
      break;
    case 'HALF_DAY':
      summary.halfDay += 1;
      break;
    case 'HOLIDAY':
      summary.holiday += 1;
      break;
    default:
      break;
    }
  });

  const workingDays = summary.present + summary.absent + summary.halfDay + summary.late;
  const attendancePercentage = workingDays > 0 ? ((summary.present + (summary.halfDay * 0.5)) / workingDays) * 100 : 0;

  return {
    period: {
      startDate: fromDate,
      endDate: toDate,
    },
    ...summary,
    attendancePercentage: Math.round(attendancePercentage * 100) / 100,
  };
}

export async function createRegularizationRequest(data) {
  const r = await prisma.attendanceRegularizationRequest.create({ data });
  return regRef(r);
}

export async function findRegularizationRequest(tenantId, regularizationId) {
  return prisma.attendanceRegularizationRequest.findFirst({
    where: {
      id: regularizationId,
      tenantId,
    },
    include: {
      employee: {
        select: {
          id: true,
          managerId: true,
        },
      },
    },
  });
}

export async function getRegularizationRequests(tenantId, employeeId, filters = {}) {
  const {
    limit = 10, offset = 0, status,
  } = filters;

  const where = {
    tenantId,
    employeeId,
  };

  if (status) {
    where.status = status;
  }

  const [raw, total] = await Promise.all([
    prisma.attendanceRegularizationRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.attendanceRegularizationRequest.count({ where }),
  ]);

  return { requests: raw.map(regRef), total };
}

export async function getTeamRegularizationRequests(tenantId, requester, filters = {}) {
  const {
    limit = 10, offset = 0, status, employeeId, departmentId,
  } = filters;

  const where = {
    tenantId,
    employee: scopedEmployeeWhere(tenantId, requester, { employeeId, departmentId }),
  };

  if (status) {
    where.status = status;
  }

  const [raw, total] = await Promise.all([
    prisma.attendanceRegularizationRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.attendanceRegularizationRequest.count({ where }),
  ]);

  return { requests: raw.map(regRef), total };
}

export async function updateRegularizationRequest(tenantId, regularizationId, data) {
  const r = await prisma.attendanceRegularizationRequest.update({
    where: { id: regularizationId },
    data,
  });
  return regRef(r);
}

export async function updateAttendanceStatus(tenantId, employeeId, attendanceDate, status) {
  const { start, end } = attendanceDayRange(attendanceDate);

  return prisma.attendanceRecord.updateMany({
    where: {
      tenantId,
      employeeId,
      attendanceDate: {
        gte: start,
        lt: end,
      },
    },
    data: {
      status,
    },
  });
}

export async function getTeamMembers(tenantId, departmentId, managerId) {
  const where = { tenantId, deletedAt: null, employmentStatus: 'ACTIVE' };
  if (departmentId) where.departmentId = departmentId;
  else if (managerId) where.managerId = managerId;
  return prisma.employee.findMany({
    where,
    select: { id: true, firstName: true, lastName: true, designation: true },
    orderBy: { employeeCode: 'asc' },
    take: 100,
  });
}

export async function getHolidaysInRange(tenantId, startDate, endDate) {
  return prisma.holiday.findMany({
    where: { tenantId, holidayDate: { gte: startDate, lte: endDate } },
    select: { holidayDate: true },
  });
}

export async function getAttendanceInRange(tenantId, dates, employeeWhere) {
  const employees = await prisma.employee.findMany({ where: employeeWhere, select: { id: true } });
  if (employees.length === 0) return [];
  const empIds = employees.map(e => e.id);
  const startDate = dates[0]; const endDate = dates[dates.length - 1];
  return prisma.attendanceRecord.findMany({
    where: { tenantId, employeeId: { in: empIds }, attendanceDate: { gte: startDate, lte: endDate } },
    select: { employeeId: true, attendanceDate: true, status: true },
  });
}

export async function getApprovedLeavesInRange(tenantId, startDate, endDate) {
  return prisma.leaveRequest.findMany({
    where: { tenantId, status: 'APPROVED', startDate: { lte: endDate }, endDate: { gte: startDate } },
    select: { employeeId: true, startDate: true, endDate: true },
  });
}

// BE-1 calendar: approved-leave spans for ONE employee overlapping [startDate,endDate],
// carrying the leave type's name + paid-ness so the day classifier can split
// PAID_LEAVE vs UNPAID_LEAVE (contract §4.3). Unknown type → caller defaults to paid.
export async function getApprovedLeavesForEmployee(tenantId, employeeId, startDate, endDate) {
  return prisma.leaveRequest.findMany({
    where: {
      tenantId, employeeId, status: 'APPROVED', startDate: { lte: endDate }, endDate: { gte: startDate },
    },
    select: {
      startDate: true,
      endDate: true,
      leaveType: { select: { name: true, isPaid: true } },
    },
  });
}
