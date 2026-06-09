import { prisma } from '../../plugins/prisma.js';

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProjects(tenantId, memberId) {
  const all = await prisma.timesheetProject.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: { tasks: { where: { active: true } } },
  });
  if (!memberId) return all;
  return all.filter(p => {
    const ids = JSON.parse(p.memberIds || '[]');
    return ids.length === 0 || ids.includes(memberId);
  });
}

export async function getProjectById(tenantId, id) {
  return prisma.timesheetProject.findFirst({ where: { id, tenantId }, include: { tasks: true } });
}

export async function createProject(tenantId, data) {
  const { memberIds = [], ...rest } = data;
  return prisma.timesheetProject.create({
    data: { tenantId, ...rest, memberIds: JSON.stringify(memberIds) },
    include: { tasks: true },
  });
}

export async function updateProject(tenantId, id, data) {
  const existing = await getProjectById(tenantId, id);
  if (!existing) return null;
  const { memberIds, ...rest } = data;
  return prisma.timesheetProject.update({
    where: { id },
    data: {
      ...rest,
      ...(memberIds !== undefined ? { memberIds: JSON.stringify(memberIds) } : {}),
    },
    include: { tasks: true },
  });
}

export async function archiveOrDeleteProject(tenantId, id) {
  const existing = await getProjectById(tenantId, id);
  if (!existing) return null;
  const entryCount = await prisma.timeEntry.count({ where: { projectId: id } });
  if (entryCount > 0) {
    return prisma.timesheetProject.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }
  return prisma.timesheetProject.delete({ where: { id } });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasksByProject(tenantId, projectId) {
  return prisma.timesheetTask.findMany({ where: { tenantId, projectId }, orderBy: { createdAt: 'asc' } });
}

export async function createTask(tenantId, projectId, data) {
  return prisma.timesheetTask.create({ data: { tenantId, projectId, ...data } });
}

export async function updateTask(tenantId, id, data) {
  const existing = await prisma.timesheetTask.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.timesheetTask.update({ where: { id }, data });
}

// ── Timesheets ────────────────────────────────────────────────────────────────

function toWeekBounds(weekStart) {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    weekStart: weekStart,
    weekEnd: end.toISOString().slice(0, 10),
  };
}

export async function getOrCreateTimesheet(tenantId, employeeId, weekStart) {
  const existing = await prisma.timesheet.findUnique({
    where: { tenantId_employeeId_weekStart: { tenantId, employeeId, weekStart } },
    include: { entries: { include: { project: true, task: true } } },
  });
  if (existing) return existing;
  const bounds = toWeekBounds(weekStart);
  return prisma.timesheet.create({
    data: { tenantId, employeeId, ...bounds },
    include: { entries: { include: { project: true, task: true } } },
  });
}

export async function getTimesheetById(id, tenantId) {
  return prisma.timesheet.findFirst({
    where: { id, tenantId },
    include: { entries: { include: { project: true, task: true } } },
  });
}

export async function getPendingTimesheets(tenantId, status, _managerId) {
  const where = { tenantId, ...(status ? { status } : {}) };
  const sheets = await prisma.timesheet.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
  });
  return sheets;
}

export async function submitTimesheet(id) {
  return prisma.timesheet.update({
    where: { id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
    include: { entries: true },
  });
}

export async function decideTimesheet(id, status, decidedBy, comment) {
  return prisma.timesheet.update({
    where: { id },
    data: { status, decidedBy, decidedAt: new Date(), comment },
    include: { entries: true },
  });
}

export async function recalcTimesheetTotal(timesheetId) {
  const entries = await prisma.timeEntry.findMany({ where: { timesheetId } });
  const total = entries.reduce((s, e) => s + e.hours, 0);
  return prisma.timesheet.update({ where: { id: timesheetId }, data: { totalHours: total } });
}

// ── Time Entries ──────────────────────────────────────────────────────────────

export async function createEntry(tenantId, timesheetId, employeeId, data) {
  const entry = await prisma.timeEntry.create({
    data: { tenantId, timesheetId, employeeId, ...data },
    include: { project: true, task: true },
  });
  await recalcTimesheetTotal(timesheetId);
  return entry;
}

export async function updateEntry(tenantId, id, data) {
  const existing = await prisma.timeEntry.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  const entry = await prisma.timeEntry.update({
    where: { id },
    data,
    include: { project: true, task: true },
  });
  await recalcTimesheetTotal(existing.timesheetId);
  return entry;
}

export async function deleteEntry(tenantId, id) {
  const existing = await prisma.timeEntry.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  await prisma.timeEntry.delete({ where: { id } });
  await recalcTimesheetTotal(existing.timesheetId);
  return { id };
}

// ── Summary ───────────────────────────────────────────────────────────────────

export async function getSummary(tenantId, employeeId, rangeDays) {
  const since = new Date();
  since.setDate(since.getDate() - rangeDays);
  const sinceStr = since.toISOString().slice(0, 10);

  const where = {
    tenantId,
    ...(employeeId ? { employeeId } : {}),
    date: { gte: sinceStr },
  };

  const entries = await prisma.timeEntry.findMany({
    where,
    include: { project: true },
  });

  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const billableHours = entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0);
  const nonBillableHours = totalHours - billableHours;

  const projectMap = {};
  const employeeMap = {};
  for (const e of entries) {
    if (!projectMap[e.projectId]) {
      projectMap[e.projectId] = { projectId: e.projectId, projectName: e.project?.name || 'Unknown', hours: 0, billableHours: 0 };
    }
    projectMap[e.projectId].hours += e.hours;
    if (e.billable) projectMap[e.projectId].billableHours += e.hours;

    if (!employeeMap[e.employeeId]) {
      employeeMap[e.employeeId] = { employeeId: e.employeeId, hours: 0, billableHours: 0 };
    }
    employeeMap[e.employeeId].hours += e.hours;
    if (e.billable) employeeMap[e.employeeId].billableHours += e.hours;
  }

  // Fetch employee names for all unique employeeIds
  const empIds = Object.keys(employeeMap);
  const empRecords = empIds.length > 0
    ? await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    })
    : [];
  const empById = Object.fromEntries(empRecords.map(e => [e.id, e]));

  const byEmployee = Object.values(employeeMap).map(row => {
    const emp = empById[row.employeeId];
    return {
      ...row,
      employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : 'Unknown',
      employeeCode: emp?.employeeCode ?? '',
      utilizationPct: row.hours > 0 ? Math.round((row.billableHours / row.hours) * 100) : 0,
    };
  });

  return {
    totalHours,
    billableHours,
    nonBillableHours,
    overtimeHours: 0,
    utilizationPct: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
    byProject: Object.values(projectMap),
    byEmployee,
  };
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(tenantId) {
  return prisma.timesheetSettings.findUnique({ where: { tenantId } });
}

export async function upsertSettings(tenantId, data) {
  return prisma.timesheetSettings.upsert({
    where: { tenantId },
    update: { ...data, updatedAt: new Date() },
    create: { tenantId, ...data, updatedAt: new Date() },
  });
}
