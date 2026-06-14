import { successResponse, errorResponse } from '../../utils/response.js';
import * as service from './timesheets.service.js';

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getProjects(request, reply) {
  const { memberId } = request.query;
  const resolvedMemberId = memberId === 'self' ? request.user.employeeId : memberId;
  const projects = await service.getProjects(request.tenant.id, resolvedMemberId || null);
  return reply.send(successResponse(projects));
}

export async function createProject(request, reply) {
  const project = await service.createProject(request.tenant.id, request.body);
  return reply.code(201).send(successResponse(project));
}

export async function updateProject(request, reply) {
  const project = await service.updateProject(request.tenant.id, request.params.id, request.body);
  if (!project) return reply.code(404).send(errorResponse('NOT_FOUND', 'Project not found', {}, request.id));
  return reply.send(successResponse(project));
}

export async function deleteProject(request, reply) {
  const result = await service.archiveOrDeleteProject(request.tenant.id, request.params.id);
  if (!result) return reply.code(404).send(errorResponse('NOT_FOUND', 'Project not found', {}, request.id));
  return reply.send(successResponse({ id: request.params.id }));
}

export async function getProjectTasks(request, reply) {
  const tasks = await service.getTasksByProject(request.tenant.id, request.params.id);
  if (!tasks) return reply.code(404).send(errorResponse('NOT_FOUND', 'Project not found', {}, request.id));
  return reply.send(successResponse(tasks));
}

export async function createTask(request, reply) {
  const task = await service.createTask(request.tenant.id, request.params.id, request.body);
  if (!task) return reply.code(404).send(errorResponse('NOT_FOUND', 'Project not found', {}, request.id));
  return reply.code(201).send(successResponse(task));
}

export async function updateTask(request, reply) {
  const task = await service.updateTask(request.tenant.id, request.params.id, request.body);
  if (!task) return reply.code(404).send(errorResponse('NOT_FOUND', 'Task not found', {}, request.id));
  return reply.send(successResponse(task));
}

// ── Timesheets ────────────────────────────────────────────────────────────────

export async function getTimesheet(request, reply) {
  const { week, employeeId } = request.query;
  const resolvedEmployeeId = employeeId || request.user.employeeId;
  const weekStart = week || getMonday(new Date()).toISOString().slice(0, 10);
  // Accounts with no Employee record (e.g. SUPER_ADMIN) have no personal
  // timesheet. Return a clear 400 instead of letting Prisma throw a 500.
  if (!resolvedEmployeeId) {
    // HR_ADMIN / SUPER_ADMIN with no employee profile — return a read-only empty shell
    // so the UI renders an empty week instead of crashing into an error boundary.
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return reply.send(successResponse({
      id: null, employeeId: null, employeeName: null,
      weekStart, weekEnd: weekEnd.toISOString().slice(0, 10),
      status: 'DRAFT', totalHours: 0, billableHours: 0,
      overtimeHours: 0, standardHours: 40,
      submittedAt: null, decidedBy: null, decidedAt: null, comment: null, entries: [],
    }));
  }
  const sheet = await service.getTimesheet(request.tenant.id, resolvedEmployeeId, weekStart);
  return reply.send(successResponse(sheet));
}

export async function createEntry(request, reply) {
  try {
    const entry = await service.createEntry(request.tenant.id, request.user.employeeId, request.body);
    return reply.code(201).send(successResponse(entry));
  } catch (err) {
    if (err.statusCode) return reply.code(err.statusCode).send(errorResponse(err.code, err.message, {}, request.id));
    throw err;
  }
}

export async function updateEntry(request, reply) {
  try {
    const entry = await service.updateEntry(request.tenant.id, request.params.id, request.body);
    if (!entry) return reply.code(404).send(errorResponse('NOT_FOUND', 'Entry not found', {}, request.id));
    return reply.send(successResponse(entry));
  } catch (err) {
    if (err.statusCode) return reply.code(err.statusCode).send(errorResponse(err.code, err.message, {}, request.id));
    throw err;
  }
}

export async function deleteEntry(request, reply) {
  const result = await service.deleteEntry(request.tenant.id, request.params.id);
  if (!result) return reply.code(404).send(errorResponse('NOT_FOUND', 'Entry not found', {}, request.id));
  return reply.send(successResponse({ id: request.params.id }));
}

export async function submitTimesheet(request, reply) {
  try {
    const sheet = await service.submitTimesheet(request.tenant.id, request.params.id, request.user.employeeId);
    if (!sheet) return reply.code(404).send(errorResponse('NOT_FOUND', 'Timesheet not found', {}, request.id));
    return reply.send(successResponse(sheet));
  } catch (err) {
    if (err.statusCode) return reply.code(err.statusCode).send(errorResponse(err.code, err.message, {}, request.id));
    throw err;
  }
}

export async function approveTimesheet(request, reply) {
  try {
    const { comment } = request.body || {};
    const sheet = await service.approveTimesheet(request.tenant.id, request.params.id, request.user.employeeId, comment);
    if (!sheet) return reply.code(404).send(errorResponse('NOT_FOUND', 'Timesheet not found', {}, request.id));
    return reply.send(successResponse(sheet));
  } catch (err) {
    if (err.statusCode) return reply.code(err.statusCode).send(errorResponse(err.code, err.message, {}, request.id));
    throw err;
  }
}

export async function rejectTimesheet(request, reply) {
  try {
    const { comment } = request.body || {};
    const sheet = await service.rejectTimesheet(request.tenant.id, request.params.id, request.user.employeeId, comment);
    if (!sheet) return reply.code(404).send(errorResponse('NOT_FOUND', 'Timesheet not found', {}, request.id));
    return reply.send(successResponse(sheet));
  } catch (err) {
    if (err.statusCode) return reply.code(err.statusCode).send(errorResponse(err.code, err.message, {}, request.id));
    throw err;
  }
}

export async function copyWeek(request, reply) {
  try {
    const result = await service.copyWeek(request.tenant.id, request.user.employeeId, request.body || {});
    return reply.code(201).send(successResponse(result.sheet, { copied: result.copied }));
  } catch (err) {
    if (err.statusCode) return reply.code(err.statusCode).send(errorResponse(err.code, err.message, {}, request.id));
    throw err;
  }
}

export async function recallTimesheet(request, reply) {
  try {
    const sheet = await service.recallTimesheet(request.tenant.id, request.params.id, request.user.employeeId);
    if (!sheet) return reply.code(404).send(errorResponse('NOT_FOUND', 'Timesheet not found', {}, request.id));
    return reply.send(successResponse(sheet));
  } catch (err) {
    if (err.statusCode) return reply.code(err.statusCode).send(errorResponse(err.code, err.message, {}, request.id));
    throw err;
  }
}

export async function getApprovals(request, reply) {
  const { status } = request.query;
  const sheets = await service.getApprovals(request.tenant.id, status);
  return reply.send(successResponse(sheets));
}

export async function getSummary(request, reply) {
  const { range, employeeId } = request.query;
  const result = await service.getSummary(request.tenant.id, employeeId || null, range || '30d');
  return reply.send(successResponse(result));
}

export async function getSettings(request, reply) {
  const settings = await service.getSettings(request.tenant.id);
  return reply.send(successResponse(settings));
}

export async function updateSettings(request, reply) {
  const settings = await service.updateSettings(request.tenant.id, request.body);
  return reply.send(successResponse(settings));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonday(d) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
