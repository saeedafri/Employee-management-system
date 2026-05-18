import { prisma } from '../../plugins/prisma.js';

export async function getEmployeesForExport(tenantId, filters = {}) {
  const where = { tenantId };
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.status) where.status = filters.status;
  if (!filters.include_archived) where.isArchived = false;

  return prisma.employee.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      email: true,
      phone: true,
      status: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
      designation: true,
      joiningDate: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      createdAt: true,
    },
    orderBy: { employeeCode: 'asc' },
  });
}

export async function getAttendanceForExport(tenantId, filters = {}) {
  const where = { tenantId };
  if (filters.departmentId) {
    where.employee = { departmentId: filters.departmentId };
  }
  if (filters.fromDate || filters.toDate) {
    where.attendanceDate = {};
    if (filters.fromDate) where.attendanceDate.gte = filters.fromDate;
    if (filters.toDate) where.attendanceDate.lte = filters.toDate;
  }

  return prisma.attendanceRecord.findMany({
    where,
    select: {
      id: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          email: true,
          department: { select: { name: true } },
        },
      },
      attendanceDate: true,
      checkInTime: true,
      checkOutTime: true,
      status: true,
      workingHours: true,
      remarks: true,
    },
    orderBy: { attendanceDate: 'desc' },
  });
}

export async function getLeaveForExport(tenantId, filters = {}) {
  const where = { tenantId };
  if (filters.fromDate || filters.toDate) {
    where.startDate = {};
    if (filters.fromDate) where.startDate.gte = filters.fromDate;
    if (filters.toDate) where.startDate.lte = filters.toDate;
  }
  if (filters.leaveType) {
    where.leaveType = { code: filters.leaveType };
  }
  if (filters.status) {
    where.status = filters.status;
  }

  return prisma.leaveRequest.findMany({
    where,
    select: {
      id: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          email: true,
          department: { select: { name: true } },
        },
      },
      leaveType: { select: { name: true, code: true } },
      startDate: true,
      endDate: true,
      numberOfDays: true,
      reason: true,
      status: true,
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      createdAt: true,
    },
    orderBy: { startDate: 'desc' },
  });
}

export async function createExportJob(tenantId, userId, data) {
  return prisma.exportJob.create({
    data: {
      tenantId,
      createdById: userId,
      jobId: data.jobId,
      exportType: data.exportType,
      format: data.format,
      status: 'QUEUED',
      filters: data.filters || {},
    },
  });
}

export async function updateExportJobStatus(jobId, status, fileUrl = null, errorMessage = null) {
  const updateData = { status };
  if (fileUrl) updateData.fileUrl = fileUrl;
  if (errorMessage) updateData.errorMessage = errorMessage;
  if (status === 'SUCCESS' || status === 'FAILED') {
    updateData.completedAt = new Date();
  }

  return prisma.exportJob.update({
    where: { jobId },
    data: updateData,
  });
}

export async function getExportJobStatus(jobId, tenantId) {
  return prisma.exportJob.findFirst({
    where: { jobId, tenantId },
  });
}

export async function listExportJobs(tenantId, page = 1, limit = 10, status = null) {
  const skip = (page - 1) * limit;
  const where = { tenantId };
  if (status) where.status = status;

  const [jobs, total] = await Promise.all([
    prisma.exportJob.findMany({
      where,
      select: {
        id: true,
        jobId: true,
        exportType: true,
        format: true,
        status: true,
        fileUrl: true,
        errorMessage: true,
        createdAt: true,
        completedAt: true,
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.exportJob.count({ where }),
  ]);

  return { jobs, total };
}

export async function cleanupOldExports(tenantId, daysOld = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return prisma.exportJob.deleteMany({
    where: {
      tenantId,
      status: { in: ['SUCCESS', 'FAILED'] },
      completedAt: { lt: cutoffDate },
    },
  });
}
