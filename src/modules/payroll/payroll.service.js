import * as repo from './payroll.repository.js';
import { detectCircularDep } from '../../utils/formulaEval.js';

function AppError(message, code, statusCode = 400) {
  const e = new Error(message);
  e.code = code; e.statusCode = statusCode;
  return e;
}

function validateComponentData(data, isCreate = true) {
  if (isCreate) {
    if (!data.name) throw AppError('name is required', 'VALIDATION_ERROR');
    if (!data.code) throw AppError('code is required', 'VALIDATION_ERROR');
    if (!data.type) throw AppError('type is required', 'VALIDATION_ERROR');
    if (!data.calculationType) throw AppError('calculationType is required', 'VALIDATION_ERROR');
    if (data.taxable === undefined) throw AppError('taxable is required', 'VALIDATION_ERROR');
  }
  const ct = data.calculationType;
  if (ct === 'FLAT' || ct === 'PERCENTAGE') {
    if (data.value === undefined || data.value === null) throw AppError('value is required for FLAT/PERCENTAGE', 'VALIDATION_ERROR');
  }
  if (ct === 'PERCENTAGE' && !data.basisCode) throw AppError('basisCode is required for PERCENTAGE', 'VALIDATION_ERROR');
  if (ct === 'FORMULA' && !data.formula) throw AppError('formula is required for FORMULA', 'VALIDATION_ERROR');
}

// ── Salary Components ─────────────────────────────────────────────────────────

export async function getComponents(prisma, tenantId, query) {
  let active;
  if (query.active === 'true') active = true;
  else if (query.active === 'false') active = false;
  return repo.getComponents(prisma, tenantId, active);
}

export async function createComponent(prisma, tenantId, data) {
  validateComponentData(data, true);
  if (data.calculationType === 'FORMULA') {
    const existing = await repo.getComponents(prisma, tenantId);
    const allComps = [...existing, { code: data.code, calculationType: data.calculationType, formula: data.formula, basisCode: data.basisCode }];
    if (detectCircularDep(allComps)) throw AppError('Formula creates a circular dependency', 'CIRCULAR_DEPENDENCY');
  }
  return repo.createComponent(prisma, tenantId, data);
}

export async function updateComponent(prisma, id, tenantId, data) {
  if (data.code) throw AppError('Component code is immutable', 'CODE_IMMUTABLE');
  if (data.calculationType) validateComponentData(data, false);
  return repo.updateComponent(prisma, id, tenantId, data);
}

export async function deleteComponent(prisma, id, tenantId) {
  return repo.deleteComponent(prisma, id, tenantId);
}

// ── Pay Groups ────────────────────────────────────────────────────────────────

export async function getPayGroups(prisma, tenantId) {
  return repo.getPayGroups(prisma, tenantId);
}

export async function createPayGroup(prisma, tenantId, data) {
  if (!data.name) throw AppError('name is required', 'VALIDATION_ERROR');
  if (!data.code) throw AppError('code is required', 'VALIDATION_ERROR');
  return repo.createPayGroup(prisma, tenantId, data);
}

export async function updatePayGroup(prisma, id, tenantId, data) {
  if (data.code) throw AppError('Pay group code is immutable', 'CODE_IMMUTABLE');
  return repo.updatePayGroup(prisma, id, tenantId, data);
}

export async function deletePayGroup(prisma, id, tenantId) {
  return repo.deletePayGroup(prisma, id, tenantId);
}

export async function getPaySchedules(prisma, tenantId) {
  const groups = await repo.getPayGroups(prisma, tenantId);
  return groups
    .filter((g) => g.paySchedule !== 'MONTHLY' && g.active)
    .map((g) => ({
      id: g.id, name: g.name, frequency: g.paySchedule,
      startDate: null, timezone: 'UTC', nextRunDate: null, active: g.active,
    }));
}

// ── Employee Salary ───────────────────────────────────────────────────────────

export async function getEmployeeSalary(prisma, employeeId, tenantId, requestingUser) {
  const isHR = ['HR_ADMIN', 'SUPER_ADMIN'].includes(requestingUser.memberType);
  if (!isHR && requestingUser.employeeId !== employeeId) {
    throw AppError('Access denied', 'FORBIDDEN', 403);
  }
  const salary = await repo.getEmployeeSalary(prisma, employeeId, tenantId, isHR);
  if (!salary) throw AppError('No salary configuration found for this employee', 'NOT_FOUND', 404);
  return salary;
}

export async function setEmployeeSalary(prisma, employeeId, tenantId, data) {
  if (!data.payGroupId) throw AppError('payGroupId is required', 'VALIDATION_ERROR');
  if (!data.annualCtc) throw AppError('annualCtc is required', 'VALIDATION_ERROR');
  if (!data.effectiveFrom) throw AppError('effectiveFrom is required', 'VALIDATION_ERROR');
  return repo.setEmployeeSalary(prisma, employeeId, tenantId, data);
}

// ── Employee Payslips ─────────────────────────────────────────────────────────

export async function getEmployeePayslips(prisma, employeeId, tenantId, requestingUser, query) {
  const isHR = ['HR_ADMIN', 'SUPER_ADMIN'].includes(requestingUser.memberType);
  if (!isHR && requestingUser.employeeId !== employeeId) {
    throw AppError('Access denied', 'FORBIDDEN', 403);
  }
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 12;
  return repo.getEmployeePayslips(prisma, employeeId, tenantId, { page, limit, year: query.year });
}

export async function getEmployeePayslip(prisma, employeeId, payslipId, tenantId, requestingUser) {
  const isHR = ['HR_ADMIN', 'SUPER_ADMIN'].includes(requestingUser.memberType);
  if (!isHR && requestingUser.employeeId !== employeeId) {
    throw AppError('Access denied', 'FORBIDDEN', 403);
  }
  return repo.getEmployeePayslipById(prisma, employeeId, payslipId, tenantId);
}

// ── Payroll Runs ──────────────────────────────────────────────────────────────

export async function getPayrollRuns(prisma, tenantId, query) {
  return repo.getPayrollRuns(prisma, tenantId, {
    page: parseInt(query.page) || 1,
    limit: parseInt(query.limit) || 10,
    year: query.year, status: query.status,
  });
}

export async function createPayrollRun(prisma, tenantId, userId, data) {
  if (!data.period || !/^\d{4}-\d{2}$/.test(data.period)) {
    throw AppError('period is required in YYYY-MM format', 'VALIDATION_ERROR');
  }
  return repo.createPayrollRun(prisma, tenantId, userId, data);
}

export async function getPayrollRun(prisma, id, tenantId) {
  return repo.getPayrollRun(prisma, id, tenantId);
}

export async function calculatePayrollRun(prisma, id, tenantId) {
  await repo.calculatePayrollRun(prisma, id, tenantId);
  return { status: 'CALCULATING', estimatedSeconds: 5 };
}

export async function approvePayrollRun(prisma, id, tenantId, userId, data) {
  return repo.approvePayrollRun(prisma, id, tenantId, userId, data.notes);
}

export async function markRunPaid(prisma, id, tenantId, data) {
  return repo.markRunPaid(prisma, id, tenantId, data.paidAt, data.paymentReference);
}

export async function cancelPayrollRun(prisma, id, tenantId, data) {
  return repo.cancelPayrollRun(prisma, id, tenantId, data.reason);
}

// ── Run Payslips ──────────────────────────────────────────────────────────────

export async function getRunPayslips(prisma, runId, tenantId, query) {
  return repo.getRunPayslips(prisma, runId, tenantId, {
    page: parseInt(query.page) || 1,
    limit: parseInt(query.limit) || 20,
    departmentId: query.departmentId,
    search: query.search,
  });
}

export async function getRunPayslip(prisma, runId, payslipId, tenantId) {
  return repo.getRunPayslip(prisma, runId, payslipId, tenantId);
}

export async function updateRunPayslip(prisma, runId, payslipId, tenantId, data) {
  return repo.updateRunPayslip(prisma, runId, payslipId, tenantId, data);
}

export async function exportRunPayslips(prisma, runId, tenantId) {
  return repo.exportRunPayslipsCsv(prisma, runId, tenantId);
}
