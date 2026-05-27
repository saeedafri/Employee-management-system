import * as service from './payroll.service.js';
import { prisma } from '../../plugins/prisma.js';
import { successResponse, errorResponse } from '../../utils/response.js';

function handleError(reply, err) {
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const details = err.details || {};
  reply.code(status).send(errorResponse(code, err.message, details, reply.request?.id));
}

// ── Salary Components ─────────────────────────────────────────────────────────

export async function getComponents(request, reply) {
  try {
    const data = await service.getComponents(prisma, request.tenantId, request.query);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createComponent(request, reply) {
  try {
    const data = await service.createComponent(prisma, request.tenantId, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateComponent(request, reply) {
  try {
    const data = await service.updateComponent(prisma, request.params.id, request.tenantId, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function deleteComponent(request, reply) {
  try {
    const data = await service.deleteComponent(prisma, request.params.id, request.tenantId);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Pay Groups ────────────────────────────────────────────────────────────────

export async function getPayGroups(request, reply) {
  try {
    const data = await service.getPayGroups(prisma, request.tenantId);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createPayGroup(request, reply) {
  try {
    const data = await service.createPayGroup(prisma, request.tenantId, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updatePayGroup(request, reply) {
  try {
    const data = await service.updatePayGroup(prisma, request.params.id, request.tenantId, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function deletePayGroup(request, reply) {
  try {
    const data = await service.deletePayGroup(prisma, request.params.id, request.tenantId);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getPaySchedules(request, reply) {
  try {
    const data = await service.getPaySchedules(prisma, request.tenantId);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Employee Salary ───────────────────────────────────────────────────────────

export async function getEmployeeSalary(request, reply) {
  try {
    const data = await service.getEmployeeSalary(
      prisma, request.params.employeeId, request.tenantId, request.user,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function setEmployeeSalary(request, reply) {
  try {
    const data = await service.setEmployeeSalary(
      prisma, request.params.employeeId, request.tenantId, request.body,
    );
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Employee Payslips ─────────────────────────────────────────────────────────

export async function getEmployeePayslips(request, reply) {
  try {
    const data = await service.getEmployeePayslips(
      prisma, request.params.employeeId, request.tenantId, request.user, request.query,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getEmployeePayslip(request, reply) {
  try {
    const data = await service.getEmployeePayslip(
      prisma, request.params.employeeId, request.params.payslipId, request.tenantId, request.user,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Payroll Runs ──────────────────────────────────────────────────────────────

export async function getPayrollRuns(request, reply) {
  try {
    const data = await service.getPayrollRuns(prisma, request.tenantId, request.query);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createPayrollRun(request, reply) {
  try {
    const data = await service.createPayrollRun(prisma, request.tenantId, request.user.userId, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getPayrollRun(request, reply) {
  try {
    const data = await service.getPayrollRun(prisma, request.params.id, request.tenantId);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function calculatePayrollRun(request, reply) {
  try {
    const data = await service.calculatePayrollRun(prisma, request.params.id, request.tenantId);
    reply.code(202).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function approvePayrollRun(request, reply) {
  try {
    const data = await service.approvePayrollRun(
      prisma, request.params.id, request.tenantId, request.user.userId, request.body,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function markRunPaid(request, reply) {
  try {
    const data = await service.markRunPaid(prisma, request.params.id, request.tenantId, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function cancelPayrollRun(request, reply) {
  try {
    const data = await service.cancelPayrollRun(prisma, request.params.id, request.tenantId, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Run Payslips ──────────────────────────────────────────────────────────────

export async function getRunPayslips(request, reply) {
  try {
    const data = await service.getRunPayslips(prisma, request.params.runId, request.tenantId, request.query);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getRunPayslip(request, reply) {
  try {
    const data = await service.getRunPayslip(
      prisma, request.params.runId, request.params.payslipId, request.tenantId,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateRunPayslip(request, reply) {
  try {
    const data = await service.updateRunPayslip(
      prisma, request.params.runId, request.params.payslipId, request.tenantId, request.body,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function exportRunPayslips(request, reply) {
  try {
    const csv = await service.exportRunPayslips(prisma, request.params.runId, request.tenantId);
    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="payroll-${request.params.runId}.csv"`)
      .send(csv);
  } catch (err) { handleError(reply, err); }
}
