import { prisma } from '../../plugins/prisma.js';

export async function getTodayAttendance(tenantId, employeeId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.attendanceRecord.findFirst({
    where: {
      tenantId,
      employeeId,
      attendanceDate: {
        gte: today,
        lt: tomorrow,
      },
    },
  });
}

export async function createAttendanceRecord(data) {
  return prisma.attendanceRecord.create({
    data,
  });
}

export async function updateAttendanceRecord(tenantId, attendanceRecordId, data) {
  return prisma.attendanceRecord.update({
    where: {
      id: attendanceRecordId,
    },
    data,
  });
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

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      orderBy: {
        attendanceDate: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { records, total };
}

export async function getTeamAttendanceRecords(tenantId, managerEmployeeId, filters = {}) {
  const {
    fromDate, toDate, limit = 10, offset = 0,
  } = filters;

  const where = {
    tenantId,
    employee: {
      managerId: managerEmployeeId,
    },
  };

  if (fromDate || toDate) {
    where.attendanceDate = {};
    if (fromDate) where.attendanceDate.gte = fromDate;
    if (toDate) where.attendanceDate.lte = toDate;
  }

  const [records, total] = await Promise.all([
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
      orderBy: {
        attendanceDate: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { records, total };
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
  return prisma.attendanceRegularizationRequest.create({
    data,
  });
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

  const [requests, total] = await Promise.all([
    prisma.attendanceRegularizationRequest.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.attendanceRegularizationRequest.count({ where }),
  ]);

  return { requests, total };
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

  const [requests, total] = await Promise.all([
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
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.attendanceRegularizationRequest.count({ where }),
  ]);

  return { requests, total };
}

export async function updateRegularizationRequest(tenantId, regularizationId, data) {
  return prisma.attendanceRegularizationRequest.update({
    where: {
      id: regularizationId,
    },
    data,
  });
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
