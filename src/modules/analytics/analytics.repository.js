import { prisma } from '../../plugins/prisma.js';

function getRangeDays(range) {
  const days = { '7d': 7, '30d': 30, '90d': 90 };
  return days[range] || 30;
}

function formatIstDate(date) {
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const parts = formatter.formatToParts(date);
  const values = {};
  parts.forEach(part => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  const period = values.dayPeriod || 'AM';
  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}:${values.second} ${period} IST`;
}

export async function getSummaryData(tenantId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [totalEmployees, activeToday, onLeaveToday, pendingLeaves, pendingRegularizations] = await Promise.all([
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
    prisma.attendanceRegularizationRequest.count({
      where: { tenantId, status: 'PENDING' },
    }),
  ]);

  return {
    totalEmployees,
    activeToday,
    onLeaveToday,
    openRequests: pendingLeaves + pendingRegularizations,
  };
}

export async function getAttendanceData(tenantId, range) {
  const days = getRangeDays(range);
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

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

  const employeeCounts = await prisma.employee.groupBy({
    by: ['departmentId'],
    where: { tenantId, deletedAt: null },
    _count: { id: true },
  });

  const activeCounts = await prisma.employee.groupBy({
    by: ['departmentId'],
    where: { tenantId, deletedAt: null, employmentStatus: 'ACTIVE' },
    _count: { id: true },
  });

  const employeeMap = {};
  const activeMap = {};

  employeeCounts.forEach(e => {
    employeeMap[e.departmentId] = e._count.id;
  });

  activeCounts.forEach(a => {
    activeMap[a.departmentId] = a._count.id;
  });

  const result = departments.map(dept => ({
    departmentId: dept.id,
    departmentName: dept.name,
    employeeCount: employeeMap[dept.id] || 0,
    activeCount: activeMap[dept.id] || 0,
  }));

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
      actor: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });

  return logs.map(log => {
    const actorEmail = log.actor?.email || 'System';
    const [firstName] = actorEmail.split('@');
    const actorName = firstName
      .split('.')
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

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
