import * as repo from './timesheets.repository.js';
import { prisma } from '../../plugins/prisma.js';
import { normalizeTaskId, uniqueCopyRows } from './timesheets.derive.js';

function fmtProject(p) {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    clientName: p.clientName,
    status: p.status,
    billable: p.billable,
    defaultRate: p.defaultRate,
    memberIds: JSON.parse(p.memberIds || '[]'),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function fmtSheet(sheet, settings, employeeName) {
  const standardHours = settings?.standardWeeklyHours ?? 40;
  const totalHours = sheet.totalHours ?? 0;
  const overtimeHours = Math.max(0, totalHours - standardHours);
  const billableHours = (sheet.entries || []).filter(e => e.billable).reduce((s, e) => s + e.hours, 0);

  return {
    id: sheet.id,
    employeeId: sheet.employeeId,
    employeeName: employeeName ?? '',
    weekStart: sheet.weekStart,
    weekEnd: sheet.weekEnd,
    status: sheet.status,
    totalHours,
    billableHours,
    overtimeHours,
    standardHours,
    submittedAt: sheet.submittedAt,
    decidedBy: sheet.decidedBy,
    decidedAt: sheet.decidedAt,
    comment: sheet.comment,
    entries: (sheet.entries || []).map(e => ({
      id: e.id,
      timesheetId: e.timesheetId,
      employeeId: e.employeeId,
      projectId: e.projectId,
      taskId: e.taskId,
      date: e.date,
      hours: e.hours,
      billable: e.billable,
      note: e.note,
      source: e.source,
    })),
  };
}

async function enrichSheetsWithNames(sheets) {
  const empIds = [...new Set(sheets.map(s => s.employeeId))];
  const emps = empIds.length > 0
    ? await prisma.employee.findMany({
      where: { id: { in: empIds } },
      select: { id: true, firstName: true, lastName: true },
    })
    : [];
  const empById = Object.fromEntries(emps.map(e => [e.id, `${e.firstName} ${e.lastName}`.trim()]));
  return empById;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProjects(tenantId, memberId) {
  let resolvedId = memberId;
  if (memberId === 'self') {
    resolvedId = null;
  }
  const projects = await repo.getProjects(tenantId, resolvedId);
  return projects.map(fmtProject);
}

export async function createProject(tenantId, data) {
  const p = await repo.createProject(tenantId, data);
  return fmtProject(p);
}

export async function updateProject(tenantId, id, data) {
  const p = await repo.updateProject(tenantId, id, data);
  if (!p) return null;
  return fmtProject(p);
}

export async function archiveOrDeleteProject(tenantId, id) {
  return repo.archiveOrDeleteProject(tenantId, id);
}

export async function getTasksByProject(tenantId, projectId) {
  const project = await repo.getProjectById(tenantId, projectId);
  if (!project) return null;
  return repo.getTasksByProject(tenantId, projectId);
}

export async function createTask(tenantId, projectId, data) {
  const project = await repo.getProjectById(tenantId, projectId);
  if (!project) return null;
  return repo.createTask(tenantId, projectId, data);
}

export async function updateTask(tenantId, id, data) {
  return repo.updateTask(tenantId, id, data);
}

// ── Timesheets ────────────────────────────────────────────────────────────────

export async function getTimesheet(tenantId, employeeId, weekStart) {
  const settings = await repo.getSettings(tenantId);
  const sheet = await repo.getOrCreateTimesheet(tenantId, employeeId, weekStart);
  return fmtSheet(sheet, settings);
}

export async function createEntry(tenantId, employeeId, body) {
  const { weekStart, ...entryData } = body;
  // taskId is optional (a project entry may have no task). Normalize null/'' → null so an
  // empty/absent task never reaches Prisma as a bad FK (was a live 500). Domain G.2 contract.
  normalizeTaskId(entryData);
  const sheet = await repo.getOrCreateTimesheet(tenantId, employeeId, weekStart);

  if (sheet.status === 'SUBMITTED' || sheet.status === 'APPROVED') {
    const err = new Error('Timesheet is already submitted or approved');
    err.statusCode = 422;
    err.code = 'TIMESHEET_LOCKED';
    throw err;
  }

  const entry = await repo.createEntry(tenantId, sheet.id, employeeId, entryData);
  return entry;
}

export async function updateEntry(tenantId, id, data) {
  normalizeTaskId(data);
  const entry = await repo.updateEntry(tenantId, id, data);
  if (!entry) return null;
  return entry;
}

export async function deleteEntry(tenantId, id) {
  return repo.deleteEntry(tenantId, id);
}

export async function submitTimesheet(tenantId, id, employeeId) {
  const sheet = await repo.getTimesheetById(id, tenantId);
  if (!sheet) return null;
  if (sheet.employeeId !== employeeId) return null;

  if (sheet.status !== 'DRAFT' && sheet.status !== 'REJECTED') {
    const err = new Error('Timesheet cannot be submitted in its current status');
    err.statusCode = 422;
    err.code = 'INVALID_STATUS';
    throw err;
  }
  if (sheet.totalHours === 0) {
    const err = new Error('Cannot submit an empty timesheet');
    err.statusCode = 422;
    err.code = 'EMPTY_TIMESHEET';
    throw err;
  }

  const settings = await repo.getSettings(tenantId);
  const updated = await repo.submitTimesheet(id);
  return fmtSheet(updated, settings);
}

// Copy last week (M5): scaffold the target week with each UNIQUE project/task row from the
// source week at hours:0 (Harvest behavior). Idempotent — skips rows the target already has.
export async function copyWeek(tenantId, employeeId, body) {
  const { fromWeekStart, toWeekStart, withNotes = false } = body || {};
  if (!fromWeekStart || !toWeekStart) {
    const err = new Error('fromWeekStart and toWeekStart are required');
    err.statusCode = 400; err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const settings = await repo.getSettings(tenantId);
  const target = await repo.getOrCreateTimesheet(tenantId, employeeId, toWeekStart);
  if (target.status !== 'DRAFT' && target.status !== 'REJECTED') {
    const err = new Error('Target week is locked (already submitted/approved)');
    err.statusCode = 422; err.code = 'WEEK_LOCKED';
    throw err;
  }

  const source = await repo.getTimesheetByWeek(tenantId, employeeId, fromWeekStart);
  // Unique project/task rows from the source the target doesn't already have (idempotent).
  const rows = uniqueCopyRows(source?.entries || [], target.entries || []);
  let copied = 0;
  for (const e of rows) {
    await repo.createEntry(tenantId, target.id, employeeId, {
      projectId: e.projectId,
      taskId: e.taskId ?? null,
      date: toWeekStart,
      hours: 0,
      billable: e.billable,
      note: withNotes ? (e.note ?? null) : null,
      source: 'MANUAL',
    });
    copied++;
  }

  const refreshed = await repo.getOrCreateTimesheet(tenantId, employeeId, toWeekStart);
  return { sheet: fmtSheet(refreshed, settings), copied };
}

// Recall / unsubmit (M6) — OWNER ONLY. SUBMITTED → DRAFT.
export async function recallTimesheet(tenantId, id, employeeId) {
  const sheet = await repo.getTimesheetById(id, tenantId);
  if (!sheet) return null;
  if (sheet.employeeId !== employeeId) return null; // owner-only; hide existence from non-owners
  if (sheet.status !== 'SUBMITTED') {
    const err = new Error('Only a SUBMITTED timesheet can be recalled');
    err.statusCode = 422; err.code = 'NOT_RECALLABLE';
    throw err;
  }
  const settings = await repo.getSettings(tenantId);
  const updated = await repo.recallTimesheet(id);
  return fmtSheet(updated, settings);
}

export async function approveTimesheet(tenantId, id, decidedBy, comment) {
  const sheet = await repo.getTimesheetById(id, tenantId);
  if (!sheet) return null;
  if (sheet.status !== 'SUBMITTED') {
    const err = new Error('Timesheet is not in SUBMITTED status');
    err.statusCode = 422;
    err.code = 'INVALID_STATUS';
    throw err;
  }
  const settings = await repo.getSettings(tenantId);
  const updated = await repo.decideTimesheet(id, 'APPROVED', decidedBy, comment);
  return fmtSheet(updated, settings);
}

export async function rejectTimesheet(tenantId, id, decidedBy, comment) {
  const sheet = await repo.getTimesheetById(id, tenantId);
  if (!sheet) return null;
  if (sheet.status !== 'SUBMITTED') {
    const err = new Error('Timesheet is not in SUBMITTED status');
    err.statusCode = 422;
    err.code = 'INVALID_STATUS';
    throw err;
  }
  const settings = await repo.getSettings(tenantId);
  const updated = await repo.decideTimesheet(id, 'REJECTED', decidedBy, comment);
  return fmtSheet(updated, settings);
}

export async function getApprovals(tenantId, status) {
  const settings = await repo.getSettings(tenantId);
  const sheets = await repo.getPendingTimesheets(tenantId, status || 'SUBMITTED');
  const empById = await enrichSheetsWithNames(sheets);
  return sheets.map(s => fmtSheet(s, settings, empById[s.employeeId]));
}

// ── Summary & Settings ────────────────────────────────────────────────────────

export async function getSummary(tenantId, employeeId, range) {
  const rangeDays = range === '90d' ? 90 : 30;
  return repo.getSummary(tenantId, employeeId || null, rangeDays);
}

export async function getSettings(tenantId) {
  const s = await repo.getSettings(tenantId);
  if (!s) {
    return {
      standardWeeklyHours: 40,
      overtimeThresholdHours: 40,
      roundingMinutes: 15,
      approvalRequired: true,
      unloggedHoursPolicy: 'FLAG',
      billableDefault: true,
      updatedAt: new Date().toISOString(),
    };
  }
  return s;
}

export async function updateSettings(tenantId, data) {
  return repo.upsertSettings(tenantId, data);
}
