import * as repo from './timesheets.repository.js';

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

function fmtSheet(sheet, settings) {
  const standardHours = settings?.standardWeeklyHours ?? 40;
  const totalHours = sheet.totalHours ?? 0;
  const overtimeHours = Math.max(0, totalHours - standardHours);
  const billableHours = (sheet.entries || []).filter(e => e.billable).reduce((s, e) => s + e.hours, 0);

  return {
    id: sheet.id,
    employeeId: sheet.employeeId,
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
  return sheets.map(s => fmtSheet(s, settings));
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
