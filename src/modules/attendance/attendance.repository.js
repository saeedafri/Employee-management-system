import { prisma } from '../../plugins/prisma.js';
import { attendanceDayRange, tenantAttendanceDate } from './attendanceDate.js';

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

export async function getTeamAttendanceRecords(tenantId, managerEmployeeId, filters = {}) {
  const {
    fromDate, toDate, limit = 10, offset = 0, employeeId,
  } = filters;

  const where = {
    tenantId,
    ...(employeeId
      ? { employeeId }
      : { employee: { managerId: managerEmployeeId } }),
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

export async function getTeamRegularizationRequests(tenantId, managerEmployeeId, filters = {}) {
  const {
    limit = 10, offset = 0, status,
  } = filters;

  const where = {
    tenantId,
    employee: {
      managerId: managerEmployeeId,
    },
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
  const date = new Date(attendanceDate);
  date.setHours(0, 0, 0, 0);
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);

  return prisma.attendanceRecord.updateMany({
    where: {
      tenantId,
      employeeId,
      attendanceDate: {
        gte: date,
        lt: nextDate,
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
