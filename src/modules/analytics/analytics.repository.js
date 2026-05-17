import { prisma } from '../../plugins/prisma.js';

function getRangeDays(range) {
  const days = { '7d': 7, '30d': 30, '90d': 90 };
  return days[range] || 30;
}

function formatIstDate(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${day}/${month}/${year} ${hours}:${mins}:${secs} ${ampm} IST`;
}

export async function getSummaryData(tenantId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [totalEmployees, activeToday, onLeaveToday, openRequests] = await Promise.all([
    prisma.employee.count({
      where: { tenantId, deletedAt: null },
    }),
    prisma.attendanceRecord.count({
      where: {
        tenantId,
        attendanceDate: { gte: today, lt: tomorrow },
        status: 'PRESENT',
      },
    }),
    prisma.leaveRequest.count({
      where: {
        tenantId,
        status: 'APPROVED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    }),
    prisma.leaveRequest.count({
      where: { tenantId, status: 'PENDING' },
    }),
  ]);

  return {
    totalEmployees,
    activeToday,
    onLeaveToday,
    openRequests,
  };
}

export async function getAttendanceData(tenantId, range) {
  const days = getRangeDays(range);
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      tenantId,
      attendanceDate: { gte: startDate, lte: endDate },
    },
    select: { attendanceDate: true, status: true },
  });

  const byDate = {};
  records.forEach(r => {
    const dateKey = r.attendanceDate.toISOString().split('T')[0];
    if (!byDate[dateKey]) {
      byDate[dateKey] = { present: 0, absent: 0, leave: 0, wfh: 0, halfDay: 0 };
    }
    if (r.status === 'PRESENT') byDate[dateKey].present++;
    else if (r.status === 'ABSENT') byDate[dateKey].absent++;
    else if (r.status === 'LEAVE') byDate[dateKey].leave++;
    else if (r.status === 'WFH') byDate[dateKey].wfh++;
    else if (r.status === 'HALF_DAY') byDate[dateKey].halfDay++;
  });

  const series = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateKey = d.toISOString().split('T')[0];
    series.push({
      date: dateKey,
      ...(byDate[dateKey] || { present: 0, absent: 0, leave: 0, wfh: 0, halfDay: 0 }),
    });
  }

  return { range, series };
}

export async function getHeadcountByDepartment(tenantId) {
  const departments = await prisma.department.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, name: true },
  });

  const result = [];
  for (const dept of departments) {
    const [employeeCount, activeCount] = await Promise.all([
      prisma.employee.count({
        where: { tenantId, departmentId: dept.id, deletedAt: null },
      }),
      prisma.employee.count({
        where: { tenantId, departmentId: dept.id, employmentStatus: 'ACTIVE', deletedAt: null },
      }),
    ]);

    result.push({
      departmentId: dept.id,
      departmentName: dept.name,
      employeeCount,
      activeCount,
    });
  }

  return result;
}

export async function getRecentActivity(tenantId, limit = 10) {
  const logs = await prisma.auditLog.findMany({
    where: { tenantId },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actor: { select: { email: true, id: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });

  return logs.map(log => {
    const actorEmail = log.actor?.email || 'System';
    const [firstName] = actorEmail.split('@');
    const actorName = firstName.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

    return {
      id: log.id,
      actorName,
      action: log.action.toLowerCase(),
      entityType: log.entityType,
      entityId: log.entityId,
      resourceLabel: `${log.entityType} #${log.entityId.slice(0, 5).toUpperCase()}`,
      createdAt: log.createdAt.toISOString(),
      createdAtIstDisplay: formatIstDate(log.createdAt),
    };
  });
}

export async function getLeaveSummary(tenantId, range) {
  const days = getRangeDays(range);
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      tenantId,
      startDate: { gte: startDate },
    },
    select: { status: true },
  });

  const summary = {
    pending: 0,
    approved: 0,
    rejected: 0,
    withdrawn: 0,
  };

  leaves.forEach(leave => {
    if (leave.status === 'PENDING') summary.pending++;
    else if (leave.status === 'APPROVED') summary.approved++;
    else if (leave.status === 'DENIED') summary.rejected++;
    else if (leave.status === 'WITHDRAWN') summary.withdrawn++;
  });

  return summary;
}
