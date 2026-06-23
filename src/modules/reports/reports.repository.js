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

  // Lean projection: the attendance report aggregates only status + department,
  // so fetch only those fields (the old `include` pulled full employee objects for
  // every row and OOM-killed the container on large tenants). `take` is a hard
  // backstop so a single report can never exhaust memory; callers bound the window.
  const TAKE_CAP = 500000;
  const rows = await prisma.attendanceRecord.findMany({
    where,
    select: {
      status: true,
      attendanceDate: true,
      employee: {
        select: {
          id: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { attendanceDate: 'desc' },
    take: TAKE_CAP + 1,
  });
  if (rows.length > TAKE_CAP) {
    // Don't silently truncate aggregates — surface that the window is too wide.
    throw Object.assign(new Error('Attendance report window too large; narrow the date range'), {
      code: 'REPORT_WINDOW_TOO_LARGE',
      statusCode: 422,
    });
  }
  return rows;
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

export async function getReportExportById(tenantId, id) {
  const row = await prisma.reportExport.findFirst({ where: { id, tenantId } });
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId,
    reportType: row.reportType,
    format: row.format,
    status: row.status,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    errorMessage: row.errorMessage,
    csvContent: row.filePath || null,
  };
}

export async function completeReportExport(id, status, csvContent, errorMessage) {
  return prisma.reportExport.update({
    where: { id },
    data: {
      status,
      filePath: csvContent || null,
      errorMessage: errorMessage || null,
      completedAt: new Date(),
    },
  });
}

// ── Domain 4 helper ──────────────────────────────────────────────────────────

function mKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function mLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function tenureLabel(joinedOn) {
  if (!joinedOn) return '—';
  const months = Math.floor((Date.now() - new Date(joinedOn).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
  return `${y} year${y !== 1 ? 's' : ''} ${m} month${m !== 1 ? 's' : ''}`;
}

// ── 4.1 Workforce Reports ─────────────────────────────────────────────────────

export async function getWorkforceHeadcount(tenantId, { startDate, endDate, departmentId } = {}) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 6));
  const end   = endDate   ? new Date(endDate)   : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const empWhere = { tenantId };
  if (departmentId) empWhere.departmentId = departmentId;

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({ where: empWhere, select: { id: true, joinedOn: true, deletedAt: true, departmentId: true } }),
    prisma.department.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true } }),
  ]);

  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));

  // Build month series
  const months = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur.setMonth(cur.getMonth() + 1);
  }

  const chartData = months.map(({ year, month }) => {
    const mStart = new Date(year, month - 1, 1);
    const mEnd   = new Date(year, month, 0, 23, 59, 59, 999);
    let headcount = 0, hires = 0, exits = 0;
    for (const emp of employees) {
      const joined = emp.joinedOn ? new Date(emp.joinedOn) : null;
      const left   = emp.deletedAt ? new Date(emp.deletedAt) : null;
      if (joined && joined <= mEnd && (!left || left > mEnd)) headcount++;
      if (joined && joined >= mStart && joined <= mEnd) hires++;
      if (left && left >= mStart && left <= mEnd) exits++;
    }
    return { month: mKey(year, month), monthLabel: mLabel(year, month), headcount, hires, exits };
  });

  const startCount = chartData[0]?.headcount || 0;
  const endCount   = chartData[chartData.length - 1]?.headcount || 0;
  const netHires   = chartData.reduce((s, m) => s + m.hires, 0);
  const netExits   = chartData.reduce((s, m) => s + m.exits, 0);

  // Per-dept breakdown
  const deptIds = [...new Set(employees.map(e => e.departmentId).filter(Boolean))];
  const tableItems = deptIds.map(dId => {
    const dEmps = employees.filter(e => e.departmentId === dId);
    const startHead = dEmps.filter(e => {
      const j = e.joinedOn ? new Date(e.joinedOn) : null;
      const l = e.deletedAt ? new Date(e.deletedAt) : null;
      return j && j <= start && (!l || l > start);
    }).length;
    const endHead = dEmps.filter(e => {
      const j = e.joinedOn ? new Date(e.joinedOn) : null;
      const l = e.deletedAt ? new Date(e.deletedAt) : null;
      return j && j <= end && (!l || l > end);
    }).length;
    const dHires = dEmps.filter(e => { const j = e.joinedOn ? new Date(e.joinedOn) : null; return j && j >= start && j <= end; }).length;
    const dExits = dEmps.filter(e => { const l = e.deletedAt ? new Date(e.deletedAt) : null; return l && l >= start && l <= end; }).length;
    return {
      departmentName: deptMap[dId] || dId,
      startHeadcount: startHead,
      endHeadcount: endHead,
      hires: dHires,
      exits: dExits,
      changePercent: startHead > 0 ? Math.round(((endHead - startHead) / startHead) * 1000) / 10 : 0,
    };
  });

  return {
    summary: {
      currentHeadcount: endCount,
      changeFromStart: endCount - startCount,
      changePercent: startCount > 0 ? Math.round(((endCount - startCount) / startCount) * 1000) / 10 : 0,
      netHires,
      netExits,
    },
    chartData,
    tableData: { items: tableItems, pagination: { page: 1, limit: tableItems.length, total: tableItems.length, totalPages: 1 } },
  };
}

export async function getWorkforceTurnover(tenantId, { startDate, endDate, departmentId } = {}) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 6));
  const end   = endDate   ? new Date(endDate)   : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const empWhere = { tenantId };
  if (departmentId) empWhere.departmentId = departmentId;

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: empWhere,
      select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: true, joinedOn: true, deletedAt: true, departmentId: true },
    }),
    prisma.department.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true } }),
  ]);

  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));
  const exited = employees.filter(e => {
    const l = e.deletedAt ? new Date(e.deletedAt) : null;
    return l && l >= start && l <= end;
  });

  const months = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur.setMonth(cur.getMonth() + 1);
  }

  const chartData = months.map(({ year, month }) => {
    const mStart = new Date(year, month - 1, 1);
    const mEnd   = new Date(year, month, 0, 23, 59, 59, 999);
    const mExits = employees.filter(e => { const l = e.deletedAt ? new Date(e.deletedAt) : null; return l && l >= mStart && l <= mEnd; }).length;
    const mHead  = employees.filter(e => { const j = e.joinedOn ? new Date(e.joinedOn) : null; const l = e.deletedAt ? new Date(e.deletedAt) : null; return j && j <= mEnd && (!l || l > mEnd); }).length;
    return { month: mKey(year, month), monthLabel: mLabel(year, month), exits: mExits, attritionRate: mHead > 0 ? Math.round((mExits / mHead) * 1000) / 10 : 0 };
  });

  const avgHeadcount = Math.round(chartData.reduce((s, m) => s + m.exits, 0) / months.length) || 0;

  return {
    summary: {
      totalExits: exited.length,
      voluntaryExits: exited.length,
      involuntaryExits: 0,
      averageHeadcount: avgHeadcount,
      attritionRate: avgHeadcount > 0 ? Math.round((exited.length / avgHeadcount) * 1000) / 10 : 0,
    },
    chartData,
    tableData: {
      items: exited.map(e => ({
        employeeId: e.id,
        employeeCode: e.employeeCode,
        employeeName: `${e.firstName} ${e.lastName}`,
        departmentName: deptMap[e.departmentId] || '—',
        designation: e.designation || '—',
        exitDate: e.deletedAt ? new Date(e.deletedAt).toISOString().split('T')[0] : null,
        exitType: 'VOLUNTARY',
        tenure: tenureLabel(e.joinedOn),
      })),
      pagination: { page: 1, limit: exited.length, total: exited.length, totalPages: 1 },
    },
  };
}

export async function getWorkforceDemographics(tenantId, { departmentId } = {}) {
  const empWhere = { tenantId, deletedAt: null };
  if (departmentId) empWhere.departmentId = departmentId;

  const [employees, departments] = await Promise.all([
    prisma.employee.findMany({ where: empWhere, select: { employmentType: true, gender: true, departmentId: true } }),
    prisma.department.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true } }),
  ]);

  const total = employees.length || 1;
  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));

  const byType = {};
  const byGender = {};
  const byDept = {};

  for (const emp of employees) {
    byType[emp.employmentType]  = (byType[emp.employmentType]  || 0) + 1;
    byGender[emp.gender || 'UNSPECIFIED'] = (byGender[emp.gender || 'UNSPECIFIED'] || 0) + 1;
    byDept[emp.departmentId]    = (byDept[emp.departmentId]    || 0) + 1;
  }

  return {
    byEmploymentType: Object.entries(byType).map(([type, count]) => ({ type, count, percent: Math.round((count / total) * 1000) / 10 })),
    byGender:         Object.entries(byGender).map(([gender, count]) => ({ gender, count, percent: Math.round((count / total) * 1000) / 10 })),
    byDepartment:     Object.entries(byDept).map(([dId, count]) => ({
      departmentName: deptMap[dId] || dId,
      count,
      percent: Math.round((count / total) * 1000) / 10,
    })),
  };
}

// ── 4.2 Attendance Reports ────────────────────────────────────────────────────

export async function getAttendanceSummaryReport(tenantId, { month, departmentId, page = 1, limit = 20 } = {}) {
  const monthStr = month || new Date().toISOString().slice(0, 7);
  const [yr, mo] = monthStr.split('-').map(Number);
  const startDate = new Date(yr, mo - 1, 1);
  const endDate   = new Date(yr, mo, 0, 23, 59, 59, 999);

  const empWhere = { tenantId, deletedAt: null };
  if (departmentId) empWhere.departmentId = departmentId;

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: empWhere,
      select: { id: true, firstName: true, lastName: true, employeeCode: true, departmentId: true, department: { select: { name: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { tenantId, attendanceDate: { gte: startDate, lte: endDate } },
      select: { employeeId: true, status: true },
    }),
  ]);

  const recMap = {};
  for (const r of records) {
    if (!recMap[r.employeeId]) recMap[r.employeeId] = [];
    recMap[r.employeeId].push(r.status);
  }

  const totalWorkingDays = records.length > 0 ? Math.max(...Object.values(recMap).map(a => a.length)) : 0;

  const tableItems = employees.map(emp => {
    const statuses = recMap[emp.id] || [];
    const present  = statuses.filter(s => s === 'PRESENT').length;
    const wfh      = statuses.filter(s => s === 'WFH').length;
    const absent   = statuses.filter(s => s === 'ABSENT').length;
    const halfDay  = statuses.filter(s => s === 'HALF_DAY').length;
    const late     = statuses.filter(s => s === 'LATE').length;
    const leave    = statuses.filter(s => s === 'ON_LEAVE').length;
    const total    = statuses.length || 1;
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      departmentName: emp.department?.name || '—',
      presentDays: present,
      absentDays: absent,
      leaveDays: leave,
      wfhDays: wfh,
      halfDays: halfDay,
      lateDays: late,
      attendancePercent: Math.round(((present + wfh + halfDay * 0.5) / total) * 1000) / 10,
    };
  });

  const skip = (page - 1) * limit;
  const paginated = tableItems.slice(skip, skip + limit);

  const totalPresent  = tableItems.reduce((s, e) => s + e.presentDays, 0);
  const totalAbsent   = tableItems.reduce((s, e) => s + e.absentDays, 0);
  const totalLeave    = tableItems.reduce((s, e) => s + e.leaveDays, 0);
  const avgAttn       = tableItems.length > 0 ? Math.round(tableItems.reduce((s, e) => s + e.attendancePercent, 0) / tableItems.length * 10) / 10 : 0;

  return {
    summary: { month: monthStr, totalWorkingDays, avgAttendancePercent: avgAttn, totalPresent, totalAbsent, totalLeave },
    tableData: { items: paginated, pagination: { page, limit, total: tableItems.length, totalPages: Math.ceil(tableItems.length / limit) } },
  };
}

export async function getAttendanceAbsenteeism(tenantId, { startDate, endDate, departmentId } = {}) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 6));
  const end   = endDate   ? new Date(endDate)   : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const empWhere = { tenantId, deletedAt: null };
  if (departmentId) empWhere.departmentId = departmentId;

  const [employees, records] = await Promise.all([
    prisma.employee.findMany({ where: empWhere, select: { id: true, firstName: true, lastName: true } }),
    prisma.attendanceRecord.findMany({
      where: { tenantId, attendanceDate: { gte: start, lte: end } },
      select: { employeeId: true, status: true, attendanceDate: true },
    }),
  ]);

  const months = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur.setMonth(cur.getMonth() + 1);
  }

  const chartData = months.map(({ year, month }) => {
    const mStart = new Date(year, month - 1, 1);
    const mEnd   = new Date(year, month, 0, 23, 59, 59, 999);
    const mRecs  = records.filter(r => { const d = new Date(r.attendanceDate); return d >= mStart && d <= mEnd; });
    const mEmps  = new Set(mRecs.map(r => r.employeeId)).size;
    const absences = mRecs.filter(r => r.status === 'ABSENT').length;
    return {
      month: mKey(year, month),
      monthLabel: mLabel(year, month),
      absenteeismRate: mRecs.length > 0 ? Math.round((absences / mRecs.length) * 1000) / 10 : 0,
      absences,
      employees: mEmps,
    };
  });

  const empAbsMap = {};
  for (const r of records) {
    if (!empAbsMap[r.employeeId]) empAbsMap[r.employeeId] = { absent: 0, leave: 0, total: 0 };
    empAbsMap[r.employeeId].total++;
    if (r.status === 'ABSENT') empAbsMap[r.employeeId].absent++;
    if (r.status === 'ON_LEAVE') empAbsMap[r.employeeId].leave++;
  }

  const empMap = Object.fromEntries(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));
  const tableItems = Object.entries(empAbsMap)
    .filter(([, v]) => v.absent > 0)
    .map(([empId, v]) => ({
      employeeId: empId,
      employeeName: empMap[empId] || empId,
      absentDays: v.absent,
      unauthorizedAbsences: v.absent,
      leaveDays: v.leave,
      absenteeismRate: v.total > 0 ? Math.round((v.absent / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.absentDays - a.absentDays);

  return {
    chartData,
    tableData: { items: tableItems, pagination: { page: 1, limit: tableItems.length, total: tableItems.length, totalPages: 1 } },
  };
}

// ── 4.3 Leave Reports ─────────────────────────────────────────────────────────

export async function getLeaveUtilization(tenantId, { year, departmentId, leaveTypeId } = {}) {
  const yr = year ? parseInt(year, 10) : new Date().getFullYear();

  const empWhere = { tenantId, deletedAt: null };
  if (departmentId) empWhere.departmentId = departmentId;

  const balanceWhere = { employee: empWhere };
  if (leaveTypeId) balanceWhere.leaveTypeId = leaveTypeId;

  const [employees, leaveTypes, balances] = await Promise.all([
    prisma.employee.findMany({
      where: empWhere,
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.leaveType.findMany({ where: { tenantId }, select: { id: true, name: true, code: true } }),
    prisma.leaveBalance.findMany({
      where: balanceWhere,
      select: { employeeId: true, leaveTypeId: true, balance: true, used: true, pending: true },
    }),
  ]);

  const ltMap = Object.fromEntries(leaveTypes.map(lt => [lt.id, lt]));

  const totalAllocated = balances.reduce((s, b) => s + (b.balance + b.used), 0);
  const totalTaken     = balances.reduce((s, b) => s + b.used, 0);
  const totalPending   = balances.reduce((s, b) => s + (b.pending || 0), 0);
  const utilRate       = totalAllocated > 0 ? Math.round((totalTaken / totalAllocated) * 1000) / 10 : 0;
  const empCount       = employees.length || 1;

  const byType = {};
  for (const b of balances) {
    if (!byType[b.leaveTypeId]) byType[b.leaveTypeId] = { allocated: 0, taken: 0, pending: 0 };
    byType[b.leaveTypeId].allocated += b.balance + b.used;
    byType[b.leaveTypeId].taken     += b.used;
    byType[b.leaveTypeId].pending   += b.pending || 0;
  }

  const chartData = Object.entries(byType).map(([ltId, v]) => ({
    leaveTypeName: ltMap[ltId]?.name || ltId,
    leaveTypeCode: ltMap[ltId]?.code || ltId,
    allocated: v.allocated,
    taken: v.taken,
    pending: v.pending,
    utilizationRate: v.allocated > 0 ? Math.round((v.taken / v.allocated) * 1000) / 10 : 0,
  }));

  const empMap = Object.fromEntries(employees.map(e => [e.id, `${e.firstName} ${e.lastName}`]));
  const empBalances = {};
  for (const b of balances) {
    if (!empBalances[b.employeeId]) empBalances[b.employeeId] = {};
    empBalances[b.employeeId][b.leaveTypeId] = b;
  }

  const tableItems = employees.map(emp => {
    const row = { employeeId: emp.id, employeeName: empMap[emp.id] };
    for (const lt of leaveTypes) {
      const b = empBalances[emp.id]?.[lt.id];
      const key = lt.code?.toLowerCase() || lt.name.toLowerCase().replace(/\s+/g, '_');
      row[`${key}Allocated`] = b ? b.balance + b.used : 0;
      row[`${key}Taken`]     = b ? b.used : 0;
      row[`${key}Pending`]   = b ? (b.pending || 0) : 0;
      row[`${key}Balance`]   = b ? b.balance : 0;
    }
    return row;
  });

  return {
    summary: { year: yr, totalAllocated, totalTaken, totalPending, utilizationRate: utilRate, avgDaysPerEmployee: Math.round((totalTaken / empCount) * 10) / 10 },
    chartData,
    tableData: { items: tableItems, pagination: { page: 1, limit: tableItems.length, total: tableItems.length, totalPages: 1 } },
  };
}

export async function getLeavePending(tenantId, { departmentId, leaveTypeId, page = 1, limit = 20 } = {}) {
  const where = { tenantId, status: 'PENDING' };
  if (leaveTypeId) where.leaveTypeId = leaveTypeId;
  if (departmentId) where.employee = { departmentId };

  const [requests, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { firstName: true, lastName: true, employeeCode: true } },
        leaveType: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  const now = Date.now();
  return {
    tableData: {
      items: requests.map(r => ({
        id: r.id,
        referenceNo: r.seqNo ? `LR-${String(r.seqNo).padStart(4, '0')}` : r.id.slice(-8).toUpperCase(),
        employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
        leaveTypeName: r.leaveType?.name || '—',
        startDate: r.startDate ? new Date(r.startDate).toISOString().split('T')[0] : null,
        endDate:   r.endDate   ? new Date(r.endDate).toISOString().split('T')[0]   : null,
        totalDays: r.totalDays,
        reason: r.reason,
        appliedAt: r.createdAt.toISOString(),
        daysPending: Math.floor((now - r.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  };
}

// ── 4.4 Payroll Reports ───────────────────────────────────────────────────────

export async function getPayrollSummaryReport(tenantId, { startDate, endDate, departmentId } = {}) {
  const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 6));
  const end   = endDate   ? new Date(endDate)   : new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const empWhere = { tenantId };
  if (departmentId) empWhere.departmentId = departmentId;

  const [allEmployees, departments] = await Promise.all([
    prisma.employee.findMany({
      where: empWhere,
      select: { id: true, departmentId: true, joinedOn: true, deletedAt: true, employmentType: true },
    }),
    prisma.department.findMany({ where: { tenantId, deletedAt: null }, select: { id: true, name: true } }),
  ]);

  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]));
  const avgGross = { FULL_TIME: 80000, PART_TIME: 40000, CONTRACT: 40000, INTERNSHIP: 20000 };

  const months = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 });
    cur.setMonth(cur.getMonth() + 1);
  }

  const chartData = months.map(({ year, month }) => {
    const mEnd = new Date(year, month, 0, 23, 59, 59, 999);
    let totalGross = 0, empCount = 0;
    for (const emp of allEmployees) {
      const j = emp.joinedOn ? new Date(emp.joinedOn) : null;
      const l = emp.deletedAt ? new Date(emp.deletedAt) : null;
      if (j && j <= mEnd && (!l || l > mEnd)) {
        totalGross += avgGross[emp.employmentType] || 80000;
        empCount++;
      }
    }
    const totalDeductions = Math.round(totalGross * 0.12 * 100) / 100;
    const totalNet = Math.round((totalGross - totalDeductions) * 100) / 100;
    return { month: mKey(year, month), monthLabel: mLabel(year, month), totalGross, totalDeductions, totalNet, employeeCount: empCount };
  });

  const totalPayroll = chartData.reduce((s, m) => s + m.totalNet, 0);
  const avgMonthly   = months.length > 0 ? Math.round(totalPayroll / months.length * 100) / 100 : 0;

  const deptItems = Object.entries(deptMap).map(([dId, dName]) => {
    const dEmps = allEmployees.filter(e => e.departmentId === dId && !e.deletedAt);
    const totalGross = dEmps.reduce((s, e) => s + (avgGross[e.employmentType] || 80000), 0);
    const totalDeductions = Math.round(totalGross * 0.12 * 100) / 100;
    const totalNet = Math.round((totalGross - totalDeductions) * 100) / 100;
    const count = dEmps.length;
    return {
      departmentName: dName,
      employeeCount: count,
      totalGross,
      totalDeductions,
      totalNet,
      avgNetPerEmployee: count > 0 ? Math.round(totalNet / count * 100) / 100 : 0,
    };
  }).filter(d => d.employeeCount > 0);

  return {
    summary: {
      totalPayrollCost: Math.round(totalPayroll * 100) / 100,
      avgMonthlyPayroll: avgMonthly,
      totalEmployees: allEmployees.filter(e => !e.deletedAt).length,
      currency: 'INR',
      monthsIncluded: months.length,
    },
    chartData,
    tableData: { items: deptItems, pagination: { page: 1, limit: deptItems.length, total: deptItems.length, totalPages: 1 } },
  };
}

export async function getPayrollCtcAnalysis(tenantId, { departmentId } = {}) {
  const empWhere = { tenantId, deletedAt: null };
  if (departmentId) empWhere.departmentId = departmentId;

  const employees = await prisma.employee.findMany({
    where: empWhere,
    select: { employmentType: true },
  });

  const total = employees.length || 1;
  const avgGross = { FULL_TIME: 80000, PART_TIME: 40000, CONTRACT: 40000, INTERNSHIP: 20000 };

  const ctcValues = employees.map(e => (avgGross[e.employmentType] || 80000) * 12);
  ctcValues.sort((a, b) => a - b);

  const pct = (p) => {
    if (ctcValues.length === 0) return 0;
    const idx = Math.ceil((p / 100) * ctcValues.length) - 1;
    return ctcValues[Math.max(0, idx)];
  };

  const bands = [
    { label: '< ₹5L',       min: 0,       max: 500000 },
    { label: '₹5L – ₹10L',  min: 500000,  max: 1000000 },
    { label: '₹10L – ₹20L', min: 1000000, max: 2000000 },
    { label: '> ₹20L',      min: 2000000, max: Infinity },
  ].map(b => {
    const count = ctcValues.filter(v => v >= b.min && v < b.max).length;
    return { label: b.label, count, percent: Math.round((count / total) * 1000) / 10 };
  });

  return {
    bands,
    percentiles: { p25: pct(25), p50: pct(50), p75: pct(75), p90: pct(90) },
  };
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
