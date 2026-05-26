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

  // Last month boundaries for deltas
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

  const [
    totalEmployees, activeToday, onLeaveToday, pendingLeaves, pendingRegularizations,
    lastMonthEmployees, lastMonthOnLeave,
  ] = await Promise.all([
    prisma.employee.count({ where: { tenantId, deletedAt: null } }),
    prisma.attendanceRecord.count({
      where: { tenantId, attendanceDate: { gte: today, lt: tomorrow }, status: 'PRESENT' },
    }),
    prisma.leaveRequest.count({
      where: { tenantId, status: 'APPROVED', startDate: { lte: today }, endDate: { gte: today } },
    }),
    prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
    prisma.attendanceRegularizationRequest.count({ where: { tenantId, status: 'PENDING' } }),
    // Previous month headcount (employees active at end of last month)
    prisma.employee.count({ where: { tenantId, deletedAt: null, joinedOn: { lte: lastMonthEnd } } }),
    // Last month on leave (average approximation — count leave requests that overlapped last month)
    prisma.leaveRequest.count({
      where: { tenantId, status: 'APPROVED', startDate: { lte: lastMonthEnd }, endDate: { gte: lastMonthStart } },
    }),
  ]);

  const openRequests = pendingLeaves + pendingRegularizations;
  const urgentRequests = Math.round(pendingLeaves * 0.2); // approximation

  return {
    totalEmployees,
    activeToday,
    onLeaveToday,
    openRequests,
    deltas: {
      totalEmployees: { delta: totalEmployees - lastMonthEmployees, deltaLabel: 'vs last month' },
      activeToday: { deltaPercent: lastMonthEmployees > 0 ? Math.round((activeToday / lastMonthEmployees) * 1000) / 10 : null },
      onLeaveToday: { delta: onLeaveToday - Math.round(lastMonthOnLeave / 30) },
      openRequests: { urgent: urgentRequests },
    },
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
  // Fetch all non-deleted depts and employee counts in 3 queries
  const [departments, allDepts, employeeCounts, activeCounts] = await Promise.all([
    prisma.department.findMany({
      where: { tenantId, deletedAt: null, parentId: null },
      select: { id: true, name: true },
    }),
    prisma.department.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, parentId: true },
    }),
    prisma.employee.groupBy({
      by: ['departmentId'],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    }),
    prisma.employee.groupBy({
      by: ['departmentId'],
      where: { tenantId, deletedAt: null, employmentStatus: 'ACTIVE' },
      _count: { id: true },
    }),
  ]);

  // Build parent → [child dept ids] map for sub-dept rollup
  const topIds = new Set(departments.map(d => d.id));
  const subtreeIds = {};
  topIds.forEach(id => { subtreeIds[id] = new Set([id]); });
  allDepts.forEach(d => {
    if (d.parentId && topIds.has(d.parentId)) subtreeIds[d.parentId].add(d.id);
  });

  // Build employee count maps
  const empMap = {};
  const activeMap = {};
  employeeCounts.forEach(e => { empMap[e.departmentId] = e._count.id; });
  activeCounts.forEach(a => { activeMap[a.departmentId] = a._count.id; });

  const result = departments.map(dept => {
    const ids = subtreeIds[dept.id] || new Set([dept.id]);
    let employeeCount = 0;
    let activeCount = 0;
    ids.forEach(id => {
      employeeCount += empMap[id] || 0;
      activeCount += activeMap[id] || 0;
    });
    return { departmentId: dept.id, departmentName: dept.name, employeeCount, activeCount };
  });

  return result.sort((a, b) => b.employeeCount - a.employeeCount);
}

const ACTION_LABELS = {
  LOGIN: 'logged in',
  LOGOUT: 'logged out',
  MFA_LOGIN_INITIATED: 'initiated MFA login',
  CREATE: 'created',
  UPDATE: 'updated',
  DELETE: 'deleted',
  APPROVE: 'approved',
  REJECT: 'rejected',
  DENY: 'denied',
  WITHDRAW: 'withdrew',
  LEAVE_REQUEST_CREATED: 'submitted a leave request',
  LEAVE_REQUEST_APPROVED: 'approved a leave request',
  LEAVE_REQUEST_REJECTED: 'rejected a leave request',
  LEAVE_REQUEST_WITHDRAWN: 'withdrew a leave request',
  ATTENDANCE_CHECK_IN: 'checked in',
  ATTENDANCE_CHECK_OUT: 'checked out',
  REGULARIZATION_APPROVED: 'approved a regularization request',
  REGULARIZATION_DENIED: 'denied a regularization request',
  REGULARIZATION_REQUEST_CREATED: 'submitted a regularization request',
};

async function resolveEntityLabels(logs) {
  // Group entityIds by type for batch fetching
  const byType = {};
  logs.forEach(l => {
    if (!l.entityType || !l.entityId) return;
    if (!byType[l.entityType]) byType[l.entityType] = new Set();
    byType[l.entityType].add(l.entityId);
  });

  const labelMap = {}; // entityId → { label, url }

  await Promise.all(
    Object.entries(byType).map(async ([type, ids]) => {
      const idArr = Array.from(ids);
      if (type === 'Employee') {
        const rows = await prisma.employee.findMany({
          where: { id: { in: idArr } },
          select: { id: true, firstName: true, lastName: true, employeeCode: true, deletedAt: true },
        });
        rows.forEach(r => {
          const deleted = r.deletedAt ? ' (deleted)' : '';
          labelMap[r.id] = {
            label: `${r.firstName} ${r.lastName} · ${r.employeeCode}${deleted}`,
            url: r.deletedAt ? null : `/employees/${r.id}`,
          };
        });
      } else if (type === 'Department') {
        const rows = await prisma.department.findMany({
          where: { id: { in: idArr } },
          select: { id: true, name: true, deletedAt: true },
        });
        rows.forEach(r => {
          labelMap[r.id] = {
            label: `Department: ${r.name}${r.deletedAt ? ' (deleted)' : ''}`,
            url: r.deletedAt ? null : `/departments?id=${r.id}`,
          };
        });
      } else if (type === 'LeaveRequest') {
        const rows = await prisma.leaveRequest.findMany({
          where: { id: { in: idArr } },
          select: { id: true, seqNo: true, leaveType: { select: { name: true } } },
        });
        rows.forEach(r => {
          const ref = r.seqNo ? `LR-${String(r.seqNo).padStart(4, '0')}` : r.id.slice(-6).toUpperCase();
          labelMap[r.id] = { label: `Leave Request ${ref} (${r.leaveType?.name || 'Unknown'})`, url: `/leave?id=${r.id}` };
        });
      } else if (type === 'AttendanceRecord') {
        const rows = await prisma.attendanceRecord.findMany({
          where: { id: { in: idArr } },
          select: { id: true, attendanceDate: true },
        });
        rows.forEach(r => {
          labelMap[r.id] = {
            label: `Attendance ${r.attendanceDate?.toISOString().split('T')[0] || ''}`,
            url: `/attendance?id=${r.id}`,
          };
        });
      }
      // For unknown types, leave labelMap empty (falls back to defaults below)
    }),
  );

  return labelMap;
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
      actor: {
        select: {
          email: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(limit, 50),
  });

  const labelMap = await resolveEntityLabels(logs);

  return logs.map(log => {
    let actorName = 'System';
    let actorEmail = null;

    if (log.actor) {
      actorEmail = log.actor.email;
      const emp = log.actor.employee;
      if (emp) {
        actorName = `${emp.firstName} ${emp.lastName}`.trim();
      } else {
        const [localPart] = log.actor.email.split('@');
        actorName = localPart
          .split('.')
          .map(p => p.charAt(0).toUpperCase() + p.slice(1))
          .join(' ');
      }
    }

    const actionLabel = ACTION_LABELS[log.action] || log.action.toLowerCase().replace(/_/g, ' ');
    const description = `${actorName} ${actionLabel}`;
    const resolved = log.entityId ? labelMap[log.entityId] : null;

    return {
      id: log.id,
      user_email: actorEmail || 'System',
      actorName,
      actorEmail,
      action: actionLabel,
      actionCode: log.action,
      actionLabel,
      description,
      entity_type: log.entityType,
      entity_id: log.entityId,
      entity_label: resolved?.label || (log.entityType && log.entityId ? `${log.entityType} #${log.entityId.slice(-8)}` : null),
      entity_url: resolved?.url || null,
      // Legacy fields for backward-compat
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
      created_at: log.createdAt.toISOString(),
      timestamp: log.createdAt.toISOString(),
      displayTime: formatIstDate(log.createdAt),
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
