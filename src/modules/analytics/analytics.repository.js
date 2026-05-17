import { prisma } from '../../plugins/prisma.js';

export async function getSummaryData(tenantId, filters = {}) {
  const { departmentId } = filters;

  const whereClause = {
    tenantId,
    deletedAt: null,
  };

  if (departmentId) {
    whereClause.departmentId = departmentId;
  }

  const [
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    onLeaveToday,
  ] = await Promise.all([
    prisma.employee.count({
      where: whereClause,
    }),
    prisma.employee.count({
      where: { ...whereClause, employmentStatus: 'ACTIVE' },
    }),
    prisma.employee.count({
      where: { ...whereClause, employmentStatus: 'INACTIVE' },
    }),
    prisma.leaveRequest.count({
      where: {
        tenantId,
        status: 'APPROVED',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    }),
  ]);

  return {
    totalEmployees,
    activeEmployees,
    inactiveEmployees,
    onLeaveToday,
  };
}

export async function getAttendanceData(tenantId, filters = {}) {
  const { startDate: startStr, endDate: endStr } = filters;

  const startDate = startStr ? new Date(startStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = endStr ? new Date(endStr) : new Date();

  const records = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      attendanceDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      status: true,
      employee: {
        select: {
          departmentId: true,
        },
      },
    },
  });

  const byDept = {};
  records.forEach(r => {
    const dept = r.employee?.departmentId || 'unknown';
    if (!byDept[dept]) byDept[dept] = { present: 0, absent: 0, total: 0 };
    byDept[dept].total++;
    if (r.status === 'PRESENT') byDept[dept].present++;
    else if (r.status === 'ABSENT') byDept[dept].absent++;
  });

  const deptRates = {};
  Object.entries(byDept).forEach(([dept, stats]) => {
    deptRates[dept] = stats.total > 0 ? ((stats.present / stats.total) * 100).toFixed(1) : 0;
  });

  return {
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    totalRecords: records.length,
    byDepartment: deptRates,
  };
}

export async function getHeadcountByDepartment(tenantId, filters = {}) {
  const { excludeInactive } = filters;

  const where = { tenantId, deletedAt: null };
  if (excludeInactive) {
    where.employmentStatus = 'ACTIVE';
  }

  const departments = await prisma.department.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          employees: { where },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return departments.map(d => ({
    departmentId: d.id,
    departmentName: d.name,
    headcount: d._count.employees,
  }));
}

export async function getRecentActivity(tenantId, filters = {}) {
  const { action, limit = 10 } = filters;

  const where = { tenantId };
  if (action) {
    where.action = action;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actor: {
        select: {
          email: true,
          id: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 100),
  });

  return logs.map(log => ({
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    actor: log.actor?.email || 'System',
    timestamp: log.createdAt.toISOString(),
  }));
}

export async function getLeaveSummary(tenantId, filters = {}) {
  const year = filters.year || new Date().getFullYear();
  const { status } = filters;

  const where = {
    tenantId,
    startDate: {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31T23:59:59`),
    },
  };

  if (status) {
    where.status = status;
  }

  const [totalLeaves, byStatus, byType] = await Promise.all([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    prisma.leaveRequest.groupBy({
      by: ['leaveTypeId'],
      where,
      select: {
        leaveTypeId: true,
        _count: { id: true },
        _sum: { totalDays: true },
      },
    }),
  ]);

  const statusBreakdown = {};
  byStatus.forEach(s => {
    statusBreakdown[s.status] = s._count.id;
  });

  const typeBreakdown = {};
  byType.forEach(t => {
    typeBreakdown[t.leaveTypeId] = {
      count: t._count.id,
      totalDays: t._sum.totalDays || 0,
    };
  });

  return {
    year,
    totalLeaves,
    byStatus: statusBreakdown,
    byType: typeBreakdown,
  };
}
