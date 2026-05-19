import { prisma } from '../../plugins/prisma.js';

export async function getAttendanceRecords(tenantId, filters = {}) {
  const where = { tenantId };
  if (filters.fromDate || filters.toDate) {
    where.attendanceDate = {};
    if (filters.fromDate) where.attendanceDate.gte = filters.fromDate;
    if (filters.toDate) where.attendanceDate.lte = filters.toDate;
  }
  if (filters.departmentId) {
    where.employee = { departmentId: filters.departmentId };
  }

  return prisma.attendanceRecord.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { attendanceDate: 'desc' },
  });
}

export async function getLeaveRequests(tenantId, filters = {}) {
  const where = { tenantId };
  if (filters.fromDate || filters.toDate) {
    where.startDate = {};
    if (filters.fromDate) where.startDate.gte = filters.fromDate;
    if (filters.toDate) where.startDate.lte = filters.toDate;
  }
  if (filters.leaveType) {
    where.leaveType = { code: filters.leaveType };
  }
  if (filters.departmentId) {
    where.employee = { departmentId: filters.departmentId };
  }

  return prisma.leaveRequest.findMany({
    where,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      },
      leaveType: true,
    },
    orderBy: { startDate: 'desc' },
  });
}

export async function getHolidays(tenantId, filters = {}) {
  const where = { tenantId };
  if (filters.fromDate || filters.toDate) {
    where.holidayDate = {};
    if (filters.fromDate) where.holidayDate.gte = filters.fromDate;
    if (filters.toDate) where.holidayDate.lte = filters.toDate;
  }

  return prisma.holiday.findMany({
    where,
    orderBy: { holidayDate: 'desc' },
  });
}

export async function createScheduledReport(tenantId, createdById, data) {
  const nextRunDate = calculateNextRunDate(data.frequency);

  return prisma.scheduledReport.create({
    data: {
      tenantId,
      createdById,
      reportType: data.report_type,
      frequency: data.frequency,
      emailRecipients: data.email_recipients,
      nextRunDate,
      isActive: true,
    },
  });
}

export async function getScheduledReports(tenantId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    prisma.scheduledReport.findMany({
      where: { tenantId, isActive: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.scheduledReport.count({
      where: { tenantId, isActive: true },
    }),
  ]);

  return { reports, total };
}

export async function updateScheduledReport(id, tenantId, data) {
  const updateData = {};
  if (data.frequency) updateData.frequency = data.frequency;
  if (data.email_recipients) updateData.emailRecipients = data.email_recipients;
  if (data.is_active !== undefined) updateData.isActive = data.is_active;

  return prisma.scheduledReport.update({
    where: { id, tenantId },
    data: updateData,
  });
}

export async function deleteScheduledReport(id, tenantId) {
  return prisma.scheduledReport.update({
    where: { id, tenantId },
    data: { isActive: false },
  });
}

export async function getReportExports(tenantId, page = 1, limit = 10, status = null) {
  const skip = (page - 1) * limit;
  const where = { tenantId };
  if (status) where.status = status;

  const [exports, total] = await Promise.all([
    prisma.reportExport.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.reportExport.count({ where }),
  ]);

  return { exports, total };
}

export async function createReportExport(tenantId, createdById, reportType, format) {
  return prisma.reportExport.create({
    data: {
      tenantId,
      createdById,
      reportType,
      format,
      status: 'PENDING',
    },
  });
}

function calculateNextRunDate(frequency) {
  const now = new Date();
  const nextDate = new Date(now);

  if (frequency === 'WEEKLY') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (frequency === 'MONTHLY') {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}
