import { prisma } from '../../plugins/prisma.js';
import { overtimeFromSheets, round2 } from './timesheets.derive.js';

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

// Find a project that already uses `code` (case-insensitive, matching the FE mock's
// toLowerCase compare). `exceptId` excludes the project being updated. Drives the
// 409 DUPLICATE_CODE the UI's ProjectDrawer branches on.
export async function findProjectByCode(tenantId, code, exceptId = null) {
  return prisma.timesheetProject.findFirst({
    where: {
      tenantId,
      code: { equals: code, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
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
  // Archive (preserve history) when the project has tasks OR logged entries — matches
  // the MSW rule (archive if it has tasks) and is strictly safer (never hard-deletes a
  // project that still has time logged against it). Hard-delete only a truly empty one.
  const [taskCount, entryCount] = await Promise.all([
    prisma.timesheetTask.count({ where: { projectId: id } }),
    prisma.timeEntry.count({ where: { projectId: id } }),
  ]);
  if (taskCount > 0 || entryCount > 0) {
    return prisma.timesheetProject.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }
  return prisma.timesheetProject.delete({ where: { id } });
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasksByProject(tenantId, projectId) {
  return prisma.timesheetTask.findMany({ where: { tenantId, projectId }, orderBy: { createdAt: 'asc' } });
}

export async function getTaskById(tenantId, id) {
  return prisma.timesheetTask.findFirst({ where: { id, tenantId } });
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

export async function getTimesheetByWeek(tenantId, employeeId, weekStart) {
  return prisma.timesheet.findUnique({
    where: { tenantId_employeeId_weekStart: { tenantId, employeeId, weekStart } },
    include: { entries: { include: { project: true, task: true } } },
  });
}

// Recall (unsubmit): SUBMITTED → DRAFT, clearing the submission + decision fields.
export async function recallTimesheet(id) {
  return prisma.timesheet.update({
    where: { id },
    data: { status: 'DRAFT', submittedAt: null, decidedBy: null, decidedAt: null, comment: null },
    include: { entries: { include: { project: true, task: true } } },
  });
}

export async function getPendingTimesheets(tenantId, status, _managerId) {
  const where = { tenantId, ...(status ? { status } : {}) };
  const sheets = await prisma.timesheet.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    // Include entries so fmtSheet can compute billableHours (and return entries[]) for each
    // row — matches the FE approvals engine (recompute over entries). Without this the
    // approvals list reported billableHours: 0 for every sheet.
    include: { entries: true },
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
  // round2 to match the FE rollup engine (src/mocks/handlers/timesheets.ts recompute()) —
  // an unrounded Σ leaks float artifacts (e.g. 23.999998) into totalHours and overtime.
  const total = round2(entries.reduce((s, e) => s + e.hours, 0));
  return prisma.timesheet.update({ where: { id: timesheetId }, data: { totalHours: total } });
}

// ── Time Entries ──────────────────────────────────────────────────────────────

// An entry with its parent timesheet's status — for the locked-week edit/delete guard.
export async function getEntryById(tenantId, id) {
  return prisma.timeEntry.findFirst({
    where: { id, tenantId },
    include: { timesheet: { select: { status: true } } },
  });
}

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

  const totalHours = round2(entries.reduce((s, e) => s + e.hours, 0));
  const billableHours = round2(entries.filter(e => e.billable).reduce((s, e) => s + e.hours, 0));
  const nonBillableHours = round2(totalHours - billableHours);

  // overtimeHours is DERIVED, never stored: per week max(0, totalHours - standardHours),
  // summed over every timesheet whose weekStart falls in range (same scope + standardHours
  // as fmtSheet and the FE mock at src/mocks/handlers/timesheets.ts:537). Always a number.
  const settings = await prisma.timesheetSettings.findUnique({ where: { tenantId } });
  const standardHours = settings?.standardWeeklyHours ?? 40;
  const scopedSheets = await prisma.timesheet.findMany({
    where: { tenantId, ...(employeeId ? { employeeId } : {}), weekStart: { gte: sinceStr } },
    select: { totalHours: true },
  });
  const overtimeHours = overtimeFromSheets(scopedSheets, standardHours);

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
      hours: round2(row.hours),
      billableHours: round2(row.billableHours),
      employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : 'Unknown',
      employeeCode: emp?.employeeCode ?? '',
      utilizationPct: row.hours > 0 ? Math.round((row.billableHours / row.hours) * 100) : 0,
    };
  // round2 + sort-by-hours-desc to match the FE summary engine
  // (src/mocks/handlers/timesheets.ts summary handler).
  }).sort((a, b) => b.hours - a.hours);

  const byProject = Object.values(projectMap)
    .map(p => ({ ...p, hours: round2(p.hours), billableHours: round2(p.billableHours) }))
    .sort((a, b) => b.hours - a.hours);

  return {
    totalHours,
    billableHours,
    nonBillableHours,
    overtimeHours,
    utilizationPct: totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0,
    byProject,
    byEmployee,
  };
}

// ── Submit reminders (M7) ───────────────────────────────────────────────────────

// All timesheets for a tenant in a given week (used by the reminder job).
export async function getTimesheetsByWeek(tenantId, weekStart) {
  return prisma.timesheet.findMany({
    where: { tenantId, weekStart },
    select: { id: true, employeeId: true, status: true, totalHours: true, weekStart: true },
  });
}

// Cursor-paginated page of a week's timesheets — keeps memory bounded for huge tenants.
export async function getTimesheetsByWeekPage(tenantId, weekStart, { cursorId = null, take = 1000 } = {}) {
  return prisma.timesheet.findMany({
    where: { tenantId, weekStart },
    select: { id: true, employeeId: true, status: true, totalHours: true, weekStart: true },
    orderBy: { id: 'asc' },
    take,
    ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
  });
}

// Tenant reminder timezone (so the day-of-week gate uses the tenant's local day).
export async function getTenantTimezone(tenantId) {
  const cfg = await prisma.tenantConfig.findUnique({ where: { tenantId }, select: { timezone: true } });
  return cfg?.timezone || 'UTC';
}

// Map employeeId -> linked User id (notifications target the User, not the Employee).
export async function getEmployeeUserMap(tenantId, employeeIds) {
  if (!employeeIds.length) return {};
  const emps = await prisma.employee.findMany({
    where: { tenantId, id: { in: employeeIds } },
    select: { id: true, userId: true },
  });
  return Object.fromEntries(emps.filter((e) => e.userId).map((e) => [e.id, e.userId]));
}

// Active approver users (managers + HR/admins) for the approval-reminder fan-out.
export async function getApproverUserIds(tenantId) {
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      memberType: { in: ['MANAGER', 'HR_ADMIN', 'SUPER_ADMIN'] },
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

// Every tenant's reminder cadence — drives the cross-tenant job loop.
export async function getAllReminderSettings() {
  return prisma.timesheetSettings.findMany({
    select: { tenantId: true, submitReminderDay: true },
  });
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
