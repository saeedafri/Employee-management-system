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
    const data = await service.getComponents(prisma, request.tenant.id, request.query);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createComponent(request, reply) {
  try {
    const data = await service.createComponent(prisma, request.tenant.id, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateComponent(request, reply) {
  try {
    const data = await service.updateComponent(prisma, request.params.id, request.tenant.id, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function deleteComponent(request, reply) {
  try {
    const data = await service.deleteComponent(prisma, request.params.id, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Pay Groups ────────────────────────────────────────────────────────────────

export async function getPayGroups(request, reply) {
  try {
    const data = await service.getPayGroups(prisma, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createPayGroup(request, reply) {
  try {
    const data = await service.createPayGroup(prisma, request.tenant.id, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updatePayGroup(request, reply) {
  try {
    const data = await service.updatePayGroup(prisma, request.params.id, request.tenant.id, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function deletePayGroup(request, reply) {
  try {
    const data = await service.deletePayGroup(prisma, request.params.id, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getPaySchedules(request, reply) {
  try {
    const data = await service.getPaySchedules(prisma, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Employee Salary ───────────────────────────────────────────────────────────

export async function getEmployeeSalary(request, reply) {
  try {
    const data = await service.getEmployeeSalary(
      prisma, request.params.employeeId, request.tenant.id, request.user,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function setEmployeeSalary(request, reply) {
  try {
    const data = await service.setEmployeeSalary(
      prisma, request.params.employeeId, request.tenant.id, request.body,
    );
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Employee Payslips ─────────────────────────────────────────────────────────

export async function getEmployeePayslips(request, reply) {
  try {
    const data = await service.getEmployeePayslips(
      prisma, request.params.employeeId, request.tenant.id, request.user, request.query,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getEmployeePayslip(request, reply) {
  try {
    const data = await service.getEmployeePayslip(
      prisma, request.params.employeeId, request.params.payslipId, request.tenant.id, request.user,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Payroll Runs ──────────────────────────────────────────────────────────────

export async function getPayrollRuns(request, reply) {
  try {
    const data = await service.getPayrollRuns(prisma, request.tenant.id, request.query);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createPayrollRun(request, reply) {
  try {
    const data = await service.createPayrollRun(prisma, request.tenant.id, request.user.userId, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getPayrollRun(request, reply) {
  try {
    const data = await service.getPayrollRun(prisma, request.params.id, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function calculatePayrollRun(request, reply) {
  try {
    const data = await service.calculatePayrollRun(prisma, request.params.id, request.tenant.id);
    reply.code(202).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function approvePayrollRun(request, reply) {
  try {
    const data = await service.approvePayrollRun(
      prisma, request.params.id, request.tenant.id, request.user.userId, request.body,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function markRunPaid(request, reply) {
  try {
    const data = await service.markRunPaid(prisma, request.params.id, request.tenant.id, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function cancelPayrollRun(request, reply) {
  try {
    const data = await service.cancelPayrollRun(prisma, request.params.id, request.tenant.id, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Run Payslips ──────────────────────────────────────────────────────────────

export async function getRunPayslips(request, reply) {
  try {
    const data = await service.getRunPayslips(prisma, request.params.runId, request.tenant.id, request.query);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getRunPayslip(request, reply) {
  try {
    const data = await service.getRunPayslip(
      prisma, request.params.runId, request.params.payslipId, request.tenant.id,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateRunPayslip(request, reply) {
  try {
    const data = await service.updateRunPayslip(
      prisma, request.params.runId, request.params.payslipId, request.tenant.id, request.body,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function exportRunPayslips(request, reply) {
  try {
    const csv = await service.exportRunPayslips(prisma, request.params.runId, request.tenant.id);
    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="payroll-${request.params.runId}.csv"`)
      .send(csv);
  } catch (err) { handleError(reply, err); }
}

// ── Phase 3: Localization ─────────────────────────────────────────────────────

export async function getCountries(_req, reply) {
  try {
    reply.send(successResponse(service.SUPPORTED_COUNTRIES));
  } catch (err) { handleError(reply, err); }
}

export async function getBankSchema(request, reply) {
  try {
    const data = service.getBankSchema(request.params.code.toUpperCase());
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Country not supported')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getLegalEntities(request, reply) {
  try {
    const data = await service.getLegalEntities(prisma, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createLegalEntity(request, reply) {
  try {
    const data = await service.createLegalEntity(prisma, request.tenant.id, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateLegalEntity(request, reply) {
  try {
    const data = await service.updateLegalEntity(prisma, request.params.id, request.tenant.id, request.body);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Legal entity not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Phase 3: Statutory Packs ──────────────────────────────────────────────────

export async function getStatutoryPacks(request, reply) {
  try {
    const data = await service.getStatutoryPacks(prisma, request.tenant.id, request.query.country);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getStatutoryPack(request, reply) {
  try {
    const data = await service.getStatutoryPack(prisma, request.params.id, request.tenant.id);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Statutory pack not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createStatutoryPack(request, reply) {
  try {
    const data = await service.createStatutoryPack(prisma, request.tenant.id, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateStatutoryPack(request, reply) {
  try {
    const data = await service.updateStatutoryPack(prisma, request.params.id, request.tenant.id, request.body);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Statutory pack not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Phase 3: Employee Payroll ─────────────────────────────────────────────────

export async function getEmployeeYtd(request, reply) {
  try {
    const data = await service.getEmployeeYtd(prisma, request.params.id, request.tenant.id, request.query.fy);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Employee not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getTaxDeclaration(request, reply) {
  try {
    const data = await service.getTaxDeclaration(prisma, request.params.id, request.tenant.id, request.query.fy);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function upsertTaxDeclaration(request, reply) {
  try {
    const data = await service.upsertTaxDeclaration(prisma, request.params.id, request.tenant.id, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getEmployeeLoans(request, reply) {
  try {
    const data = await service.getEmployeeLoans(prisma, request.params.id, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createEmployeeLoan(request, reply) {
  try {
    const data = await service.createEmployeeLoan(prisma, request.params.id, request.tenant.id, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateEmployeeLoan(request, reply) {
  try {
    const data = await service.updateEmployeeLoan(prisma, request.params.loanId, request.tenant.id, request.body);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Loan not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getOpeningBalance(request, reply) {
  try {
    const data = await service.getOpeningBalance(prisma, request.params.id, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function upsertOpeningBalance(request, reply) {
  try {
    const data = await service.upsertOpeningBalance(prisma, request.params.id, request.tenant.id, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Phase 3: Run Inputs ───────────────────────────────────────────────────────

export async function getPayrollRoster(request, reply) {
  try {
    const data = await service.getPayrollRoster(prisma, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getRunInputs(request, reply) {
  try {
    const data = await service.getRunInputs(prisma, request.params.runId, request.tenant.id);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Payroll run not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateRunInput(request, reply) {
  try {
    const data = await service.updateRunInput(
      prisma, request.params.runId, request.params.employeeId, request.tenant.id, request.body,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function importRunInputs(request, reply) {
  try {
    const data = await service.importRunInputs(
      prisma, request.params.runId, request.tenant.id, request.body.csv,
    );
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getRunFnf(request, reply) {
  try {
    const data = await service.getRunFnf(prisma, request.params.id, request.tenant.id);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Payroll run not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Phase 3: Run Reports ──────────────────────────────────────────────────────

export async function getStatutoryReturn(request, reply) {
  try {
    const data = await service.getStatutoryReturn(prisma, request.params.id, request.tenant.id, request.query.type);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Payroll run not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getRunRegister(request, reply) {
  try {
    const data = await service.getRunRegister(prisma, request.params.id, request.tenant.id, request.query.type);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Payroll run not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function exportRunRegister(request, reply) {
  try {
    const { csv, filename } = await service.exportRunRegister(
      prisma, request.params.id, request.tenant.id, request.query.type,
    );
    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv);
  } catch (err) { handleError(reply, err); }
}

export async function parallelReconcile(request, reply) {
  try {
    const data = await service.parallelReconcile(
      prisma, request.params.id, request.tenant.id, request.body,
    );
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Payroll run not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Phase 3: Pay Calendars ────────────────────────────────────────────────────

export async function getPayCalendars(request, reply) {
  try {
    const data = await service.getPayCalendars(prisma, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function createPayCalendar(request, reply) {
  try {
    const data = await service.createPayCalendar(prisma, request.tenant.id, request.body);
    reply.code(201).send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updatePayCalendar(request, reply) {
  try {
    const data = await service.updatePayCalendar(prisma, request.params.id, request.tenant.id, request.body);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Pay calendar not found')); return; }
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Phase 3: Migration ────────────────────────────────────────────────────────

export async function getAllOpeningBalances(request, reply) {
  try {
    const data = await service.getAllOpeningBalances(prisma, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getHistoricalPayslips(request, reply) {
  try {
    const data = await service.getHistoricalPayslips(prisma, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function importHistoricalPayslips(request, reply) {
  try {
    const data = await service.importHistoricalPayslips(prisma, request.tenant.id, request.body.rows);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getMigrationStatus(request, reply) {
  try {
    const data = await service.getMigrationStatus(prisma, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateMigrationStatus(request, reply) {
  try {
    const data = await service.updateMigrationStatus(prisma, request.tenant.id, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

// ── Phase 3: Compliance Reports ───────────────────────────────────────────────

export async function getPayEquity(request, reply) {
  try {
    const data = await service.getPayEquity(prisma, request.tenant.id, request.query.groupBy || 'gender');
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function getAuditPack(request, reply) {
  try {
    const data = await service.getAuditPack(prisma, request.tenant.id, request.query.runId);
    if (!data) { reply.code(404).send(errorResponse('NOT_FOUND', 'Payroll run not found')); return; }
    reply
      .header('Content-Type', 'application/json')
      .header('Content-Disposition', `attachment; filename="audit-pack-${data.run?.period || 'unknown'}-${request.query.runId}.json"`)
      .send(JSON.stringify(data));
  } catch (err) { handleError(reply, err); }
}

export async function getDataPolicy(request, reply) {
  try {
    const data = await service.getDataPolicy(prisma, request.tenant.id);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}

export async function updateDataPolicy(request, reply) {
  try {
    const data = await service.updateDataPolicy(prisma, request.tenant.id, request.body);
    reply.send(successResponse(data));
  } catch (err) { handleError(reply, err); }
}
