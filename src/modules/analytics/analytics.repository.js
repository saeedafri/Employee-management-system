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
      resourceLabel: resolved?.label || (log.entityType && log.entityId ? `${log.entityType} #${log.entityId.slice(-8)}` : null),
      createdAt: log.createdAt.toISOString(),
      createdAtIstDisplay: `${formatIstDate(log.createdAt)} IST`,
      created_at: log.createdAt.toISOString(),
      timestamp: log.createdAt.toISOString(),
      displayTime: formatIstDate(log.createdAt),
    };
  });
}

// ── Phase 2 analytics ────────────────────────────────────────────────────────

function getRangeMonths(range) {
  const map = { '6m': 6, '12m': 12, '2y': 24 };
  return map[range] || 6;
}

function monthLabel(year, month) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export async function getWorkforceTrend(tenantId, range = '6m') {
  const months = getRangeMonths(range);
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const [allEmployees] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId },
      select: { joinedOn: true, deletedAt: true, employmentStatus: true },
    }),
  ]);

  const result = [];
  for (let i = 0; i < months; i++) {
    const mStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0, 23, 59, 59, 999);
    const yr = mStart.getFullYear();
    const mo = mStart.getMonth() + 1;

    let headcount = 0, hires = 0, exits = 0;
    for (const emp of allEmployees) {
      const joined = emp.joinedOn ? new Date(emp.joinedOn) : null;
      const left   = emp.deletedAt ? new Date(emp.deletedAt) : null;
      if (joined && joined <= mEnd && (!left || left > mEnd)) headcount++;
      if (joined && joined >= mStart && joined <= mEnd) hires++;
      if (left && left >= mStart && left <= mEnd) exits++;
    }

    result.push({ month: monthKey(yr, mo), monthLabel: monthLabel(yr, mo), headcount, hires, exits, netChange: hires - exits });
  }
  return result;
}

export async function getAttrition(tenantId, range = '6m') {
  const months = getRangeMonths(range);
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const employees = await prisma.employee.findMany({
    where: { tenantId },
    select: { joinedOn: true, deletedAt: true },
  });

  let totalExits = 0;
  const trend = [];

  for (let i = 0; i < months; i++) {
    const mStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const mEnd   = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0, 23, 59, 59, 999);
    const yr = mStart.getFullYear();
    const mo = mStart.getMonth() + 1;

    let headcount = 0, exits = 0;
    for (const emp of employees) {
      const joined = emp.joinedOn ? new Date(emp.joinedOn) : null;
      const left   = emp.deletedAt ? new Date(emp.deletedAt) : null;
      if (joined && joined <= mEnd && (!left || left > mEnd)) headcount++;
      if (left && left >= mStart && left <= mEnd) exits++;
    }
    totalExits += exits;
    const rate = headcount > 0 ? Math.round((exits / headcount) * 1000) / 10 : 0;
    trend.push({ month: monthKey(yr, mo), monthLabel: monthLabel(yr, mo), rate, exits });
  }

  const avgHeadcount = trend.reduce((s, t) => s + (t.exits + (trend[0]?.exits || 0)), 0) || 0;
  const rollingAnnualRate = avgHeadcount > 0 ? Math.round((totalExits / months * 12) * 10) / 10 : 0;
  const currentMonthRate = trend.length > 0 ? trend[trend.length - 1].rate : 0;

  return { currentMonthRate, rollingAnnualRate, trend };
}

export async function getPayrollCost(tenantId, range = '6m') {
  const months = getRangeMonths(range);
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

  const allEmployees = await prisma.employee.findMany({
    where: { tenantId },
    select: { joinedOn: true, deletedAt: true, employmentType: true },
  });

  // Estimate: FULL_TIME avg 80000/month gross, PART_TIME/CONTRACT avg 40000/month
  const avgGrossMap = { FULL_TIME: 80000, PART_TIME: 40000, CONTRACT: 40000 };

  const result = [];
  for (let i = 0; i < months; i++) {
    const mStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const mEnd   = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0, 23, 59, 59, 999);
    const yr = mStart.getFullYear();
    const mo = mStart.getMonth() + 1;

    let totalGross = 0, activeCount = 0;
    for (const emp of allEmployees) {
      const joined = emp.joinedOn ? new Date(emp.joinedOn) : null;
      const left   = emp.deletedAt ? new Date(emp.deletedAt) : null;
      if (joined && joined <= mEnd && (!left || left > mEnd)) {
        activeCount++;
        totalGross += avgGrossMap[emp.employmentType] || 80000;
      }
    }

    const totalNet = Math.round(totalGross * 0.88 * 100) / 100;
    const avgNetPerEmployee = activeCount > 0 ? Math.round(totalNet / activeCount * 100) / 100 : 0;

    result.push({
      month: monthKey(yr, mo),
      monthLabel: monthLabel(yr, mo),
      totalNet: Math.round(totalNet * 100) / 100,
      totalGross: Math.round(totalGross * 100) / 100,
      employeeCount: activeCount,
      avgNetPerEmployee,
    });
  }
  return result;
}

export async function getDepartmentPerformance(tenantId, range = '30d', managerEmployeeId = null) {
  const days = range === '90d' ? 90 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  let deptWhere;
  if (managerEmployeeId) {
    const managerEmp = await prisma.employee.findFirst({
      where: { id: managerEmployeeId },
      select: { departmentId: true },
    });
    deptWhere = managerEmp?.departmentId
      ? { tenantId, deletedAt: null, id: managerEmp.departmentId }
      : { tenantId, deletedAt: null, id: '__none__' };
  } else {
    deptWhere = { tenantId, deletedAt: null, parentId: null };
  }

  const [departments, empGroups, attnRecords, leaveRecords, pendingLeaveCount, pendingRegCount] = await Promise.all([
    prisma.department.findMany({ where: deptWhere, select: { id: true, name: true } }),
    prisma.employee.groupBy({
      by: ['departmentId'],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { tenantId, attendanceDate: { gte: since } },
      select: { employeeId: true, status: true },
    }),
    prisma.leaveRequest.findMany({
      where: { tenantId, status: 'APPROVED', startDate: { gte: since } },
      select: { employeeId: true, totalDays: true },
    }),
    prisma.leaveRequest.count({ where: { tenantId, status: 'PENDING' } }),
    prisma.attendanceRegularizationRequest.count({ where: { tenantId, status: 'PENDING' } }),
  ]);

  const empMap = {};
  empGroups.forEach(e => { empMap[e.departmentId] = e._count.id; });

  const empDeptMap = {};
  const allEmps = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, departmentId: true, joinedOn: true },
  });
  allEmps.forEach(e => { empDeptMap[e.id] = e.departmentId; });

  return departments.map(dept => {
    const headcount = empMap[dept.id] || 0;
    const deptEmpIds = new Set(allEmps.filter(e => e.departmentId === dept.id).map(e => e.id));
    const deptAttn = attnRecords.filter(r => deptEmpIds.has(r.employeeId));
    const presentDays = deptAttn.filter(r => ['PRESENT','WFH'].includes(r.status)).length;
    const totalDays = deptAttn.length;
    const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 1000) / 10 : 0;

    const deptLeaveDays = leaveRecords.filter(r => deptEmpIds.has(r.employeeId)).reduce((s, r) => s + (r.totalDays || 0), 0);
    const leaveRate = headcount > 0 ? Math.round((deptLeaveDays / (headcount * days)) * 1000) / 10 : 0;

    const deptEmpsArr = allEmps.filter(e => e.departmentId === dept.id);
    const avgTenureMonths = deptEmpsArr.length > 0
      ? Math.round(deptEmpsArr.reduce((s, e) => {
          if (!e.joinedOn) return s;
          return s + (Date.now() - new Date(e.joinedOn).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
        }, 0) / deptEmpsArr.length * 10) / 10
      : 0;

    return {
      departmentId: dept.id,
      departmentName: dept.name,
      headcount,
      attendanceRate,
      leaveRate,
      pendingApprovals: pendingLeaveCount + pendingRegCount,
      avgTenureMonths,
    };
  }).filter(d => d.headcount > 0);
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
