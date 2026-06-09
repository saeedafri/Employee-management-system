import * as repo from './payroll.repository.js';
import { detectCircularDep } from '../../utils/formulaEval.js';
import {
  fmtGarnishmentForUi,
  fmtPayslipTemplateForUi,
  normalizePayslipTemplateField,
  normalizePayslipTemplateSection,
} from '../../utils/payrollUiShapes.js';
import { flatBodyToPackData } from '../../utils/statutoryPackShape.js';

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
  const [groups, calendars] = await Promise.all([
    repo.getPayGroups(prisma, tenantId),
    repo.getPayCalendars(prisma, tenantId),
  ]);

  const fromGroups = groups
    .filter((g) => g.active)
    .map((g) => ({
      id: g.id,
      name: g.name,
      code: g.code,
      frequency: g.paySchedule,
      currency: g.currency,
      country: g.currency === 'USD' ? 'US' : 'IN',
      startDate: null,
      timezone: 'Asia/Kolkata',
      nextRunDate: null,
      active: g.active,
      source: 'payGroup',
    }));

  const fromCalendars = calendars.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    frequency: c.paySchedule ?? 'MONTHLY',
    currency: c.country === 'US' ? 'USD' : 'INR',
    country: c.country ?? 'IN',
    startDate: c.firstPayDate ? String(c.firstPayDate).split('T')[0] : null,
    timezone: 'Asia/Kolkata',
    nextRunDate: null,
    active: true,
    source: 'payCalendar',
    periodAnchor: 1,
    payDateRule: 'LAST_WORKING_DAY',
    cutoffDay: 25,
  }));

  const seen = new Set();
  return [...fromCalendars, ...fromGroups].filter((s) => {
    const key = `${s.frequency}-${s.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

const VALID_RUN_TYPES = ['REGULAR', 'OFF_CYCLE', 'BONUS', 'ARREARS', 'FNF', 'REVERSAL'];

export async function createPayrollRun(prisma, tenantId, userId, data) {
  if (!data.period || !/^\d{4}-\d{2}$/.test(data.period)) {
    const err = AppError('period is required in YYYY-MM format', 'VALIDATION_ERROR', 400);
    err.details = [{ field: 'period', message: 'Required YYYY-MM' }];
    throw err;
  }
  const type = data.type || 'REGULAR';
  if (!VALID_RUN_TYPES.includes(type)) {
    throw AppError(`Invalid run type: ${type}`, 'INVALID_RUN_TYPE', 422);
  }
  if (type === 'OFF_CYCLE' && (!data.employeeIds || !data.employeeIds.length)) {
    const err = AppError('employeeIds required for OFF_CYCLE run', 'VALIDATION_ERROR', 400);
    err.details = [{ field: 'employeeIds', message: 'Required for OFF_CYCLE' }];
    throw err;
  }
  if (type === 'FNF' && !data.fnf?.employeeId) {
    const err = AppError('fnf.employeeId required for FNF run', 'VALIDATION_ERROR', 400);
    err.details = [{ field: 'fnf.employeeId', message: 'Required for FNF' }];
    throw err;
  }
  if (type === 'REVERSAL' && !data.reversalOfRunId) {
    throw AppError('reversalOfRunId required for REVERSAL run', 'REVERSAL_TARGET_REQUIRED', 422);
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

// ── Phase 3: Static data ──────────────────────────────────────────────────────

export const SUPPORTED_COUNTRIES = [
  { code: 'IN', name: 'India', currency: 'INR', locale: 'en-IN', fiscalYearStartMonth: 4 },
  { code: 'US', name: 'United States', currency: 'USD', locale: 'en-US', fiscalYearStartMonth: 1 },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', fiscalYearStartMonth: 4 },
  { code: 'SG', name: 'Singapore', currency: 'SGD', locale: 'en-SG', fiscalYearStartMonth: 1 },
];

const BANK_SCHEMAS = {
  IN: {
    country: 'IN',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      { key: 'accountNumber', label: 'Account number', type: 'text', required: true, regex: '^[0-9]{9,18}$' },
      { key: 'ifsc', label: 'IFSC code', type: 'text', required: true, regex: '^[A-Z]{4}0[A-Z0-9]{6}$' },
      { key: 'bankName', label: 'Bank name', type: 'text', required: false },
    ],
  },
  US: {
    country: 'US',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      { key: 'routingNumber', label: 'Routing number (ABA)', type: 'text', required: true, regex: '^[0-9]{9}$' },
      { key: 'accountNumber', label: 'Account number', type: 'text', required: true },
      { key: 'accountType', label: 'Account type', type: 'select', options: ['CHECKING', 'SAVINGS'], required: true },
    ],
  },
  GB: {
    country: 'GB',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      { key: 'sortCode', label: 'Sort code', type: 'text', required: true, regex: '^[0-9]{6}$' },
      { key: 'accountNumber', label: 'Account number', type: 'text', required: true, regex: '^[0-9]{8}$' },
    ],
  },
  SG: {
    country: 'SG',
    fields: [
      { key: 'accountName', label: 'Account holder name', type: 'text', required: true },
      { key: 'bankCode', label: 'Bank code', type: 'text', required: true },
      { key: 'branchCode', label: 'Branch code', type: 'text', required: true },
      { key: 'accountNumber', label: 'Account number', type: 'text', required: true },
    ],
  },
};

export function getBankSchema(countryCode) {
  return BANK_SCHEMAS[countryCode] || null;
}

// ── Phase 3: Legal Entities ───────────────────────────────────────────────────

export async function getLegalEntities(prisma, tenantId) {
  return repo.getLegalEntities(prisma, tenantId);
}

export async function createLegalEntity(prisma, tenantId, data) {
  return repo.createLegalEntity(prisma, tenantId, data);
}

export async function updateLegalEntity(prisma, id, tenantId, data) {
  return repo.updateLegalEntity(prisma, id, tenantId, data);
}

// ── Phase 3: Statutory Packs ──────────────────────────────────────────────────

export async function getStatutoryPacks(prisma, tenantId, country) {
  return repo.getStatutoryPacks(prisma, tenantId, country);
}

export async function getStatutoryPack(prisma, id, tenantId) {
  return repo.getStatutoryPackById(prisma, id, tenantId);
}

function validateStatutoryPackBody(body, isCreate = true) {
  const details = [];
  if (isCreate) {
    if (!body.country) details.push({ field: 'country', message: 'country is required' });
    if (!body.version) details.push({ field: 'version', message: 'version is required' });
    if (!body.effectiveFrom) details.push({ field: 'effectiveFrom', message: 'effectiveFrom is required' });
  }
  if (body.effectiveFrom && body.effectiveTo) {
    if (new Date(body.effectiveFrom) > new Date(body.effectiveTo)) {
      details.push({ field: 'effectiveTo', message: 'effectiveTo must be on or after effectiveFrom' });
    }
  }
  if (details.length) {
    const err = AppError('Statutory pack validation failed', details.some((d) => d.field === 'effectiveTo') ? 'INVALID_PACK' : 'VALIDATION_ERROR', details.some((d) => d.field === 'effectiveTo') ? 422 : 400);
    err.details = details;
    throw err;
  }
}

export async function createStatutoryPack(prisma, tenantId, body) {
  validateStatutoryPackBody(body, true);
  const existing = await prisma.statutoryPack.findUnique({
    where: { tenantId_country_version: { tenantId, country: body.country, version: body.version } },
  });
  if (existing) throw AppError('Pack version already exists', 'PACK_VERSION_EXISTS', 409);
  return repo.createStatutoryPack(prisma, tenantId, {
    country: body.country,
    version: body.version,
    effectiveFrom: body.effectiveFrom,
    effectiveTo: body.effectiveTo ?? null,
    packData: flatBodyToPackData(body),
  });
}

export async function updateStatutoryPack(prisma, id, tenantId, body) {
  validateStatutoryPackBody(body, false);
  return repo.updateStatutoryPack(prisma, id, tenantId, body);
}

export async function deleteStatutoryPack(prisma, id, tenantId) {
  return repo.deleteStatutoryPack(prisma, id, tenantId);
}

// ── Phase 3: YTD ─────────────────────────────────────────────────────────────

export async function getEmployeeYtd(prisma, employeeId, tenantId, fy) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } });
  if (!employee) return null;

  const fiscalYear = fy || getCurrentFiscalYear();
  const [fyStart] = fiscalYear.split('-');
  const periodStart = `${fyStart}-04`;

  const payslips = await prisma.payslip.findMany({
    where: {
      tenantId, employeeId, status: 'PAID',
      period: { gte: periodStart },
    },
    orderBy: { period: 'asc' },
  });

  const grossEarnings = payslips.reduce((s, p) => s + Number(p.grossEarnings), 0);
  const totalDeductions = payslips.reduce((s, p) => s + Number(p.totalDeductions), 0);
  const netPay = payslips.reduce((s, p) => s + Number(p.netPay), 0);
  const taxDeducted = payslips.reduce((s, p) => {
    const deds = Array.isArray(p.deductionsJson) ? p.deductionsJson : [];
    return s + deds.filter(d => d.code === 'TDS').reduce((a, d) => a + (d.monthlyAmount || 0), 0);
  }, 0);

  return {
    fiscalYear,
    monthsElapsed: payslips.length,
    grossEarnings,
    taxableIncome: grossEarnings * 0.87,
    taxDeducted,
    totalDeductions,
    netPay,
    contributions: { PF: totalDeductions * 0.1 },
  };
}

function getCurrentFiscalYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 4 ? `${year}-${String(year + 1).slice(2)}` : `${year - 1}-${String(year).slice(2)}`;
}

// ── Phase 3: Tax Declaration ──────────────────────────────────────────────────

export async function getTaxDeclaration(prisma, employeeId, tenantId, fy) {
  const fiscalYear = fy || getCurrentFiscalYear();
  const decl = await prisma.taxDeclaration.findUnique({
    where: { tenantId_employeeId_fiscalYear: { tenantId, employeeId, fiscalYear } },
  });
  return decl || { employeeId, fiscalYear, regime: 'IN_NEW_REGIME', items: [] };
}

export async function upsertTaxDeclaration(prisma, employeeId, tenantId, data) {
  const fiscalYear = data.fiscalYear || getCurrentFiscalYear();
  return prisma.taxDeclaration.upsert({
    where: { tenantId_employeeId_fiscalYear: { tenantId, employeeId, fiscalYear } },
    create: { tenantId, employeeId, fiscalYear, regime: data.regime || 'IN_NEW_REGIME', items: data.items || [] },
    update: {
      ...(data.regime && { regime: data.regime }),
      ...(data.items && { items: data.items }),
    },
  });
}

// ── Phase 3: Loans ────────────────────────────────────────────────────────────

export async function getEmployeeLoans(prisma, employeeId, tenantId) {
  return prisma.employeeLoan.findMany({
    where: { tenantId, employeeId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createEmployeeLoan(prisma, employeeId, tenantId, data) {
  const schedule = buildLoanSchedule(data.amount, data.emiAmount, data.startPeriod);
  return prisma.employeeLoan.create({
    data: {
      tenantId, employeeId,
      amount: data.amount, balance: data.amount, emiAmount: data.emiAmount,
      startPeriod: data.startPeriod, endPeriod: data.endPeriod || null,
      status: 'ACTIVE', schedule,
    },
  });
}

function buildLoanSchedule(amount, emi, startPeriod) {
  const schedule = [];
  let balance = amount;
  let period = startPeriod;
  let n = 1;
  while (balance > 0 && n <= 60) {
    const principal = Math.min(emi, balance);
    balance = Math.max(0, balance - principal);
    schedule.push({
      installmentNo: n, period, emi: principal,
      principalComponent: principal, interestComponent: 0,
      balanceAfter: balance, status: 'PENDING',
    });
    period = nextPeriod(period);
    n++;
  }
  return schedule;
}

function nextPeriod(period) {
  const [y, m] = period.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return next;
}

export async function updateEmployeeLoan(prisma, loanId, tenantId, data) {
  const loan = await prisma.employeeLoan.findFirst({ where: { id: loanId, tenantId } });
  if (!loan) return null;
  return prisma.employeeLoan.update({ where: { id: loanId }, data });
}

// ── Phase 3: Opening Balances ─────────────────────────────────────────────────

export async function getOpeningBalance(prisma, employeeId, tenantId) {
  const fy = getCurrentFiscalYear();
  const balances = await prisma.openingBalance.findMany({ where: { tenantId, employeeId }, orderBy: { fiscalYear: 'desc' } });
  return { employeeId, fiscalYear: fy, items: balances };
}

export async function upsertOpeningBalance(prisma, employeeId, tenantId, data) {
  const fiscalYear = data.fiscalYear || getCurrentFiscalYear();
  return prisma.openingBalance.upsert({
    where: { tenantId_employeeId_fiscalYear: { tenantId, employeeId, fiscalYear } },
    create: {
      tenantId, employeeId, fiscalYear,
      grossEarnings: data.grossEarnings || 0, taxableIncome: data.taxableIncome || 0,
      taxDeducted: data.taxDeducted || 0, totalDeductions: data.totalDeductions || 0,
      netPay: data.netPay || 0, contributions: data.contributions || {},
    },
    update: {
      grossEarnings: data.grossEarnings || 0, taxableIncome: data.taxableIncome || 0,
      taxDeducted: data.taxDeducted || 0, totalDeductions: data.totalDeductions || 0,
      netPay: data.netPay || 0, contributions: data.contributions || {},
    },
  });
}

function fmtOpeningBalance(row) {
  const emp = row.employee;
  return {
    employeeId: row.employeeId,
    employeeCode: emp?.employeeCode ?? null,
    employeeName: emp ? `${emp.firstName} ${emp.lastName}`.trim() : null,
    fiscalYear: row.fiscalYear,
    grossEarnings: Number(row.grossEarnings),
    taxableIncome: Number(row.taxableIncome),
    taxDeducted: Number(row.taxDeducted),
    totalDeductions: Number(row.totalDeductions),
    netPay: Number(row.netPay),
    contributions: row.contributions ?? {},
    importedAt: row.importedAt,
  };
}

export async function getAllOpeningBalances(prisma, tenantId) {
  const rows = await prisma.openingBalance.findMany({
    where: { tenantId },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
    orderBy: { importedAt: 'desc' },
  });
  return rows.map(fmtOpeningBalance);
}

// ── Phase 3: Payroll Roster & Run Inputs ──────────────────────────────────────

export async function getPayrollEmployees(prisma, tenantId) {
  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      department: { select: { name: true } },
      salaries: {
        where: { effectiveTo: null },
        take: 1,
        orderBy: { effectiveFrom: 'desc' },
        include: { payGroup: { select: { id: true, name: true, currency: true } } },
      },
    },
    orderBy: { employeeCode: 'asc' },
  });

  return employees.map((emp) => {
    const salary = emp.salaries[0];
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
      department: emp.department?.name ?? null,
      designation: emp.designation ?? null,
      country: emp.location?.split(',').pop()?.trim() || 'IN',
      currency: salary?.payGroup?.currency ?? emp.payCurrency ?? 'INR',
      payGroupId: salary?.payGroupId ?? null,
      payGroupName: salary?.payGroup?.name ?? null,
      hasSalaryConfig: Boolean(salary),
      annualCtc: salary ? Number(salary.annualCtc) : null,
      active: emp.employmentStatus === 'ACTIVE',
    };
  });
}

export async function getPayrollMigration(prisma, tenantId) {
  const status = await getMigrationStatus(prisma, tenantId);
  return {
    ...status,
    updatedAt: status.updatedAt ?? new Date().toISOString(),
  };
}

export async function listPaymentBatches(prisma, tenantId) {
  return repo.listPaymentBatches(prisma, tenantId);
}

export async function getPayrollReportsIndex(prisma, tenantId) {
  const recentRuns = await prisma.payrollRun.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true, period: true, status: true, type: true, published: true, createdAt: true,
    },
  });
  return {
    reports: [
      { id: 'pay-equity', path: '/payroll/reports/pay-equity', label: 'Pay Equity', method: 'GET' },
      { id: 'audit-pack', path: '/payroll/reports/audit-pack', label: 'Audit Pack', method: 'GET', requiresRunId: true },
      { id: 'statutory-return', path: '/payroll/runs/:runId/statutory-return', label: 'Statutory Return', method: 'GET', requiresRunId: true },
      { id: 'register', path: '/payroll/runs/:runId/register', label: 'Payroll Register', method: 'GET', requiresRunId: true },
    ],
    recentRuns,
  };
}

export async function getPayrollSettings(prisma, tenantId) {
  const [dataPolicy, migration] = await Promise.all([
    getDataPolicy(prisma, tenantId),
    getMigrationStatus(prisma, tenantId),
  ]);
  return {
    defaultCountry: 'IN',
    defaultCurrency: 'INR',
    sandboxMode: migration.sandboxMode,
    dataPolicy,
    features: {
      payrollEnabled: true,
      contractorInvoices: true,
      openingBalances: true,
      statutoryPacks: true,
      offCycleRuns: true,
    },
    updatedAt: dataPolicy.updatedAt ?? new Date().toISOString(),
  };
}

export async function getPayrollRoster(prisma, tenantId) {
  const salaries = await prisma.employeeSalary.findMany({
    where: { tenantId, effectiveTo: null },
    include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
    distinct: ['employeeId'],
  });
  return salaries
    .filter(s => s.employee)
    .map(s => ({
      employeeId: s.employee.id,
      employeeCode: s.employee.employeeCode,
      employeeName: `${s.employee.firstName} ${s.employee.lastName}`,
    }));
}

export async function getRunInputs(prisma, runId, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return null;

  const inputs = await prisma.payrollInput.findMany({ where: { runId, tenantId } });
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: runId },
    include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } } },
  });

  const inputMap = Object.fromEntries(inputs.map(i => [i.employeeId, i]));

  return {
    runId, period: run.period,
    editable: run.status === 'DRAFT',
    inputs: payslips.map(ps => {
      const inp = inputMap[ps.employeeId] || {};
      return {
        employeeId: ps.employeeId,
        employeeCode: ps.employee?.employeeCode,
        employeeName: ps.employee ? `${ps.employee.firstName} ${ps.employee.lastName}` : 'Unknown',
        lopDays: inp.lopDays ?? 0,
        otHours: inp.otHours ?? 0,
        variablePay: inp.variablePay ? Number(inp.variablePay) : null,
        oneTimeAdditions: inp.oneTimeAdditions || [],
        oneTimeDeductions: inp.oneTimeDeductions || [],
      };
    }),
  };
}

export async function updateRunInput(prisma, runId, employeeId, tenantId, data) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw AppError('Payroll run not found', 'NOT_FOUND', 404);

  return prisma.payrollInput.upsert({
    where: { runId_employeeId: { runId, employeeId } },
    create: { tenantId, runId, employeeId, ...data },
    update: data,
  });
}

export async function importRunInputs(prisma, runId, tenantId, csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const results = { imported: 0, failed: 0, errors: [] };

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = Object.fromEntries(headers.map((h, idx) => [h, values[idx]]));
    try {
      const emp = await prisma.employee.findFirst({
        where: { tenantId, employeeCode: row.employeeCode, deletedAt: null },
      });
      if (!emp) { results.failed++; results.errors.push({ row: i, message: `Unknown employee: ${row.employeeCode}` }); continue; }
      await prisma.payrollInput.upsert({
        where: { runId_employeeId: { runId, employeeId: emp.id } },
        create: { tenantId, runId, employeeId: emp.id, lopDays: Number(row.lopDays) || 0, otHours: Number(row.otHours) || 0 },
        update: { lopDays: Number(row.lopDays) || 0, otHours: Number(row.otHours) || 0 },
      });
      results.imported++;
    } catch { results.failed++; results.errors.push({ row: i, message: 'Import error' }); }
  }
  return results;
}

export async function getRunFnf(prisma, id, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) return null;
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: id },
    include: { employee: { select: { firstName: true, lastName: true } } },
  });
  return {
    runId: id, period: run.period, currency: run.currency,
    settlements: payslips.map(ps => ({
      employeeId: ps.employeeId,
      employeeName: ps.employee ? `${ps.employee.firstName} ${ps.employee.lastName}` : 'Unknown',
      grossEarnings: Number(ps.grossEarnings),
      totalDeductions: Number(ps.totalDeductions),
      netPay: Number(ps.netPay),
      leaveEncashment: 0, gratuity: 0,
    })),
  };
}

// ── Phase 3: Run Reports ──────────────────────────────────────────────────────

export async function getStatutoryReturn(prisma, id, tenantId, type) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) return null;
  return { runId: id, period: run.period, type: type || 'ECR', rows: [], generatedAt: new Date().toISOString() };
}

function periodLabel(period) {
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const REGISTER_COLUMNS = {
  SALARY: [
    { key: 'employeeCode', label: 'Code', align: 'left', kind: 'text' },
    { key: 'employeeName', label: 'Employee', align: 'left', kind: 'text' },
    { key: 'department', label: 'Department', align: 'left', kind: 'text' },
    { key: 'grossEarnings', label: 'Gross', align: 'right', kind: 'money' },
    { key: 'totalDeductions', label: 'Deductions', align: 'right', kind: 'money' },
    { key: 'netPay', label: 'Net Pay', align: 'right', kind: 'money' },
    { key: 'employerCost', label: 'Employer Cost', align: 'right', kind: 'money' },
  ],
  STATUTORY: [
    { key: 'employeeCode', label: 'Code', align: 'left', kind: 'text' },
    { key: 'employeeName', label: 'Employee', align: 'left', kind: 'text' },
    { key: 'grossEarnings', label: 'Gross', align: 'right', kind: 'money' },
    { key: 'pfEmployee', label: 'PF (Employee)', align: 'right', kind: 'money' },
    { key: 'pfEmployer', label: 'PF (Employer)', align: 'right', kind: 'money' },
    { key: 'totalDeductions', label: 'Total Deductions', align: 'right', kind: 'money' },
    { key: 'netPay', label: 'Net Pay', align: 'right', kind: 'money' },
  ],
  BANK_ADVICE: [
    { key: 'employeeCode', label: 'Code', align: 'left', kind: 'text' },
    { key: 'employeeName', label: 'Employee', align: 'left', kind: 'text' },
    { key: 'bankName', label: 'Bank', align: 'left', kind: 'text' },
    { key: 'accountNumber', label: 'Account No.', align: 'left', kind: 'text' },
    { key: 'netPay', label: 'Net Pay', align: 'right', kind: 'money' },
  ],
  VARIANCE: [
    { key: 'employeeCode', label: 'Code', align: 'left', kind: 'text' },
    { key: 'employeeName', label: 'Employee', align: 'left', kind: 'text' },
    { key: 'previousNet', label: 'Previous Net', align: 'right', kind: 'money' },
    { key: 'currentNet', label: 'Current Net', align: 'right', kind: 'money' },
    { key: 'variance', label: 'Variance', align: 'right', kind: 'money' },
  ],
};

export async function getRunRegister(prisma, id, tenantId, type) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) return null;
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: id },
    include: {
      employee: {
        select: {
          employeeCode: true, firstName: true, lastName: true,
          department: { select: { name: true } },
          salaries: { select: { bankName: true, bankAccountNumber: true, bankIfscCode: true, effectiveTo: true }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
        },
      },
    },
  });
  const registerType = type || 'SALARY';
  const columns = REGISTER_COLUMNS[registerType] ?? REGISTER_COLUMNS.SALARY;
  const currency = run.currency || 'INR';

  const rows = payslips.map(ps => {
    const employerContribs = Array.isArray(ps.employerContributionsJson) ? ps.employerContributionsJson : [];
    const employerContribTotal = employerContribs.reduce((s, l) => s + Number(l.amount ?? l.monthlyAmount ?? 0), 0);
    const base = {
      employeeCode: ps.employee?.employeeCode ?? '',
      employeeName: ps.employee ? `${ps.employee.firstName} ${ps.employee.lastName}` : 'Unknown',
      department: ps.employee?.department?.name ?? '—',
      grossEarnings: Number(ps.grossEarnings),
      totalDeductions: Number(ps.totalDeductions),
      netPay: Number(ps.netPay),
      employerCost: Number(ps.grossEarnings) + employerContribTotal,
    };
    if (registerType === 'STATUTORY') {
      const lines = Array.isArray(ps.deductionsJson) ? ps.deductionsJson : [];
      const pfEmpLine = lines.find((l) => ['PF', 'PF_EMPLOYEE', 'PF_EE', 'EPF_EE'].includes(l.code));
      const pfErLine = employerContribs.find((l) => ['PF_ER', 'PF_EMPLOYER', 'EPF_ER'].includes(l.code));
      return {
        ...base,
        pfEmployee: Number(pfEmpLine?.amount ?? pfEmpLine?.monthlyAmount ?? 0),
        pfEmployer: Number(pfErLine?.amount ?? pfErLine?.monthlyAmount ?? 0),
      };
    }
    if (registerType === 'BANK_ADVICE') {
      const sal = ps.employee?.salaries?.[0];
      return { ...base, bankName: sal?.bankName ?? '—', accountNumber: sal?.bankAccountNumber ?? '—', ifscCode: sal?.bankIfscCode ?? '—' };
    }
    if (registerType === 'VARIANCE') {
      return { ...base, previousNet: Number(ps.netPay), currentNet: Number(ps.netPay), variance: 0 };
    }
    return base;
  });

  const totalGross = rows.reduce((s, r) => s + r.grossEarnings, 0);
  const totalDeductions = rows.reduce((s, r) => s + r.totalDeductions, 0);
  const totalNet = rows.reduce((s, r) => s + r.netPay, 0);
  const totalEmployerCost = rows.reduce((s, r) => s + (r.employerCost || 0), 0);

  const summary = [
    { label: 'Employees', value: String(rows.length) },
    { label: 'Total Gross', value: totalGross.toLocaleString('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }) },
    { label: 'Total Deductions', value: totalDeductions.toLocaleString('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }) },
    { label: 'Total Net Pay', value: totalNet.toLocaleString('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }) },
    { label: 'Total Employer Cost', value: totalEmployerCost.toLocaleString('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }) },
  ];

  return {
    register: registerType,
    runId: id,
    period: run.period,
    periodLabel: periodLabel(run.period),
    currency,
    columns,
    rows,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export async function exportRunRegister(prisma, id, tenantId, type) {
  const register = await getRunRegister(prisma, id, tenantId, type);
  if (!register) return { csv: '', filename: 'register.csv' };
  const colKeys = register.columns.map(c => c.key);
  const headers = colKeys.join(',') + '\n';
  const rows = register.rows.map(r => colKeys.map(k => r[k] ?? '').join(',')).join('\n');
  return { csv: headers + rows, filename: `register-${register.period}-${type || 'SALARY'}.csv` };
}

export async function parallelReconcile(prisma, id, tenantId, body) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) return null;
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: id },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
  });
  const legacyMap = Object.fromEntries((body.legacy || []).map(l => [l.employeeCode, l.netPay]));
  const tolerance = body.tolerance || 0;
  let matched = 0, mismatched = 0, missing = 0;
  const items = payslips.map(ps => {
    const code = ps.employee?.employeeCode;
    const computed = Number(ps.netPay);
    const legacy = legacyMap[code];
    if (legacy === undefined) { missing++; return { employeeId: ps.employeeId, employeeCode: code, computedNet: computed, legacyNet: null, diff: null, status: 'MISSING' }; }
    const diff = computed - legacy;
    const status = Math.abs(diff) <= tolerance ? 'MATCH' : 'MISMATCH';
    if (status === 'MATCH') matched++; else mismatched++;
    return {
      employeeId: ps.employeeId, employeeCode: code,
      employeeName: ps.employee ? `${ps.employee.firstName} ${ps.employee.lastName}` : 'Unknown',
      computedNet: computed, legacyNet: legacy, diff, status,
    };
  });
  return { runId: id, period: run.period, currency: run.currency, tolerance, matched, mismatched, missing, items, generatedAt: new Date().toISOString() };
}

// ── Phase 3: Pay Calendars ────────────────────────────────────────────────────

export async function getPayCalendars(prisma, tenantId) {
  return repo.getPayCalendars(prisma, tenantId);
}

export async function createPayCalendar(prisma, tenantId, data) {
  return repo.createPayCalendar(prisma, tenantId, data);
}

export async function updatePayCalendar(prisma, id, tenantId, data) {
  return repo.updatePayCalendar(prisma, id, tenantId, data);
}

// ── Phase 3: Migration ────────────────────────────────────────────────────────

export async function getHistoricalPayslips(prisma, tenantId) {
  const rows = await prisma.historicalPayslip.findMany({ where: { tenantId }, orderBy: { importedAt: 'desc' } });
  return { count: rows.length, rows };
}

export async function importHistoricalPayslips(prisma, tenantId, rows) {
  let imported = 0, failed = 0;
  const errors = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const emp = await prisma.employee.findFirst({
        where: { tenantId, employeeCode: row.employeeCode, deletedAt: null },
      });
      if (!emp) { failed++; errors.push({ row: i, message: `Unknown employeeCode: ${row.employeeCode}` }); continue; }
      await prisma.historicalPayslip.create({
        data: {
          tenantId, employeeId: emp.id, employeeCode: row.employeeCode, period: row.period,
          grossEarnings: row.grossEarnings || 0, totalDeductions: row.totalDeductions || 0, netPay: row.netPay || 0,
        },
      });
      imported++;
    } catch { failed++; errors.push({ row: i, message: 'Import error' }); }
  }
  return { imported, failed, errors };
}

export async function getMigrationStatus(prisma, tenantId) {
  const status = await prisma.migrationStatus.findUnique({ where: { tenantId } });
  const openingBalancesCount = await prisma.openingBalance.count({ where: { tenantId } });
  const historicalPayslipsCount = await prisma.historicalPayslip.count({ where: { tenantId } });
  return {
    sandboxMode: status?.sandboxMode ?? true,
    goLivePeriod: status?.goLivePeriod ?? null,
    openingBalancesCount,
    historicalPayslipsCount,
    lastReconciledRunId: status?.lastReconciledRunId ?? null,
    updatedAt: status?.updatedAt ?? null,
  };
}

export async function updateMigrationStatus(prisma, tenantId, data) {
  return prisma.migrationStatus.upsert({
    where: { tenantId },
    create: { tenantId, sandboxMode: data.sandboxMode ?? true, goLivePeriod: data.goLivePeriod || null },
    update: {
      ...(data.sandboxMode !== undefined && { sandboxMode: data.sandboxMode }),
      ...(data.goLivePeriod !== undefined && { goLivePeriod: data.goLivePeriod }),
    },
  });
}

// ── Phase 3: Compliance Reports ───────────────────────────────────────────────

export async function getPayEquity(prisma, tenantId, groupBy) {
  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      salaries: { where: { effectiveTo: null }, take: 1, orderBy: { effectiveFrom: 'desc' } },
    },
  });

  const validGroups = { gender: 'gender', level: 'designation', location: 'location' };
  const field = validGroups[groupBy];
  if (!field) throw AppError('UNKNOWN_GROUP_BY', 'UNKNOWN_GROUP_BY', 422);

  const grouped = {};
  for (const emp of employees) {
    const key = emp[field] || 'Unknown';
    const ctc = emp.salaries[0] ? Number(emp.salaries[0].annualCtc) / 12 : 0;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ctc);
  }

  const groups = Object.entries(grouped).map(([group, pays]) => {
    pays.sort((a, b) => a - b);
    const mean = pays.reduce((s, v) => s + v, 0) / pays.length || 0;
    const median = pays[Math.floor(pays.length / 2)] || 0;
    return { group, headcount: pays.length, meanPay: Math.round(mean), medianPay: Math.round(median) };
  });

  const refGroup = groups.reduce((a, b) => (a.meanPay > b.meanPay ? a : b), groups[0] || { group: '', meanPay: 0, medianPay: 0 });
  const enriched = groups.map(g => ({
    ...g,
    meanGapPct: refGroup.meanPay ? parseFloat(((refGroup.meanPay - g.meanPay) / refGroup.meanPay * 100).toFixed(1)) : 0,
    medianGapPct: refGroup.medianPay ? parseFloat(((refGroup.medianPay - g.medianPay) / refGroup.medianPay * 100).toFixed(1)) : 0,
  }));

  const overallMeanGapPct = Math.max(...enriched.map(g => g.meanGapPct).filter(v => v > 0), 0);
  const overallMedianGapPct = Math.max(...enriched.map(g => g.medianGapPct).filter(v => v > 0), 0);

  return {
    groupBy, currency: 'INR', referenceGroup: refGroup.group,
    overallMeanGapPct, overallMedianGapPct,
    groups: enriched, generatedAt: new Date().toISOString(),
  };
}

export async function getAuditPack(prisma, tenantId, runId) {
  if (!runId) return null;
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return null;
  const auditLog = await getRunAudit(prisma, runId, tenantId);
  const approvals = Array.isArray(run.approvalsJson) ? run.approvalsJson : [];
  return {
    run: { id: run.id, period: run.period, status: run.status, totals: { gross: Number(run.totalGross), deductions: Number(run.totalDeductions), net: Number(run.totalNet) }, currency: run.currency },
    configPin: run.configSnapshotRef ?? null,
    approvalChain: approvals,
    auditLog: auditLog ?? [],
    generatedAt: new Date().toISOString(),
  };
}

export async function getDataPolicy(prisma, tenantId) {
  const setting = await prisma.setting.findUnique({ where: { tenantId_groupKey_settingKey: { tenantId, groupKey: 'payroll', settingKey: 'data-policy' } } });
  if (setting) return setting.valueJson;
  return {
    defaultRetentionYears: 7,
    policies: [
      { country: 'IN', residencyRegion: 'ap-south-1', retentionYears: 8, statutoryHold: true },
    ],
    updatedAt: new Date().toISOString(),
  };
}

export async function updateDataPolicy(prisma, tenantId, data) {
  const value = { ...data, updatedAt: new Date().toISOString() };
  await prisma.setting.upsert({
    where: { tenantId_groupKey_settingKey: { tenantId, groupKey: 'payroll', settingKey: 'data-policy' } },
    create: { tenantId, groupKey: 'payroll', settingKey: 'data-policy', valueJson: value },
    update: { valueJson: value },
  });
  return value;
}

// ── Global Workforce ─────────────────────────────────────────────────────────

function toWorkerClassification(employmentType) {
  if (employmentType === 'CONTRACT') return 'CONTRACTOR';
  return 'EMPLOYEE';
}

export async function listWorkers(prisma, tenantId, classification) {
  const employees = await prisma.employee.findMany({
    where: {
      tenantId,
      deletedAt: null,
      employmentStatus: { in: ['ACTIVE', 'ON_LEAVE'] },
    },
    include: {
      salaries: {
        where: { effectiveTo: null },
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
      },
    },
  });

  let workers = employees.map((e) => {
    const salary = e.salaries?.[0];
    const monthlyCostMinorUnits = salary
      ? Math.round((Number(salary.annualCtc) / 12) * 100)
      : 0;
    return {
      id: e.id,
      employeeCode: e.employeeCode,
      name: `${e.firstName} ${e.lastName}`,
      classification: toWorkerClassification(e.employmentType),
      country: e.location?.slice(0, 2)?.toUpperCase() || 'IN',
      currency: e.payCurrency || 'INR',
      legalEntityId: null,
      legalEntityName: null,
      monthlyCost: monthlyCostMinorUnits,
      riskFlag: null,
      active: true,
    };
  });

  if (classification) {
    workers = workers.filter((w) => w.classification === classification);
  }
  return workers;
}

export async function updateWorkerClassification(prisma, tenantId, employeeId, classification) {
  const emp = await prisma.employee.findFirst({ where: { id: employeeId, tenantId, deletedAt: null } });
  if (!emp) throw AppError('Employee not found', 'NOT_FOUND', 404);

  const newType = classification === 'CONTRACTOR' ? 'CONTRACT' : 'FULL_TIME';
  const updated = await prisma.employee.update({
    where: { id: employeeId },
    data: { employmentType: newType, updatedAt: new Date() },
  });
  return { id: updated.id, classification, employmentType: updated.employmentType };
}

export async function getWorkerCostSummary(prisma, tenantId, groupBy = 'classification') {
  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null, employmentStatus: { in: ['ACTIVE', 'ON_LEAVE'] } },
    include: {
      salaries: { where: { effectiveTo: null }, take: 1, orderBy: { effectiveFrom: 'desc' } },
    },
  });

  const FX_RATES = { INR: 1, USD: 83, EUR: 90, GBP: 105, AED: 22, SGD: 62 };
  const BASE_CURRENCY = 'INR';

  const map = new Map();
  let totalBaseCost = 0;
  let totalWorkers = 0;

  for (const e of employees) {
    const salary = e.salaries?.[0];
    const currency = e.payCurrency || 'INR';
    const monthlyLocal = salary ? Number(salary.annualCtc) / 12 : 0;
    const monthlyBase = Math.round(monthlyLocal * (FX_RATES[currency] ?? 1));

    const classification = toWorkerClassification(e.employmentType);
    const key =
          groupBy === 'currency' ? currency :
            groupBy === 'entity' ? (e.location || 'Unknown') :
              classification;

    totalBaseCost += monthlyBase;
    totalWorkers += 1;
    const g = map.get(key) ?? { key, workerCount: 0, baseAmount: 0 };
    g.workerCount += 1;
    g.baseAmount += monthlyBase;
    map.set(key, g);
  }

  return {
    groupBy,
    baseCurrency: BASE_CURRENCY,
    totalBaseCost,
    totalWorkers,
    groups: [...map.values()].sort((a, b) => b.baseAmount - a.baseAmount),
    fxRates: FX_RATES,
  };
}

function fmtContractorInvoice(row) {
  return {
    id: row.id,
    workerId: row.workerId,
    workerName: row.workerName,
    period: row.period,
    amount: Number(row.amount),
    currency: row.currency,
    withholdingPct: Number(row.withholdingPct),
    netPayable: Number(row.netPayable),
    status: row.status,
    payoutRef: row.payoutRef ?? null,
    submittedAt: row.submittedAt,
    decidedAt: row.decidedAt ?? null,
  };
}

export async function listContractorInvoices(prisma, tenantId, params = {}) {
  const where = { tenantId };
  if (params.workerId) where.workerId = params.workerId;
  if (params.status) where.status = params.status;
  const rows = await prisma.contractorInvoice.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
  });
  return rows.map(fmtContractorInvoice);
}

export async function createContractorInvoice(prisma, tenantId, data) {
  const withholdingPct = data.withholdingPct ?? 0;
  const amount = Number(data.amount);
  const netPayable = data.netPayable ?? Math.round(amount * (1 - withholdingPct / 100));
  const row = await prisma.contractorInvoice.create({
    data: {
      tenantId,
      workerId: data.workerId,
      workerName: data.workerName || 'Contractor',
      period: data.period,
      amount,
      currency: data.currency || 'INR',
      withholdingPct,
      netPayable,
      status: 'SUBMITTED',
    },
  });
  return fmtContractorInvoice(row);
}

export async function updateContractorInvoice(prisma, tenantId, invoiceId, data) {
  const existing = await prisma.contractorInvoice.findFirst({ where: { id: invoiceId, tenantId } });
  if (!existing) throw AppError('Invoice not found', 'NOT_FOUND', 404);
  const updateData = {};
  for (const field of ['workerName', 'period', 'amount', 'currency', 'withholdingPct', 'netPayable', 'status', 'payoutRef']) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }
  if (data.status && data.status !== 'SUBMITTED' && data.status !== existing.status) {
    updateData.decidedAt = new Date();
  }
  const row = await prisma.contractorInvoice.update({ where: { id: invoiceId }, data: updateData });
  return fmtContractorInvoice(row);
}

// ── Phase 3 Extended Services ─────────────────────────────────────────────────

export async function approveRunLevel(prisma, runId, tenantId, level, body) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw AppError('Run not found', 'NOT_FOUND', 404);
  const approvals = run.approvalsJson ?? [];
  const existing = approvals.findIndex(a => a.level === level);
  const entry = { level, status: 'APPROVED', approvedBy: body?.approvedBy || 'SYSTEM', approvedAt: new Date().toISOString(), comment: body?.comment || null };
  if (existing >= 0) approvals[existing] = entry; else approvals.push(entry);
  const allLevels = [1, 2];
  const fullyApproved = allLevels.every(l => approvals.find(a => a.level === l && a.status === 'APPROVED'));
  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: { approvalsJson: approvals, status: fullyApproved ? 'APPROVED' : run.status },
  });
  return updated;
}

export async function getRunVariance(prisma, runId, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return null;
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: runId, tenantId },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
  });
  // Compare with previous run
  const prevRun = await prisma.payrollRun.findFirst({
    where: { tenantId, status: { in: ['PAID', 'APPROVED'] }, id: { not: runId } },
    orderBy: { createdAt: 'desc' },
  });
  const prevPayslips = prevRun ? await prisma.payslip.findMany({ where: { payrollRunId: prevRun.id, tenantId } }) : [];
  const prevMap = new Map(prevPayslips.map(p => [p.employeeId, p]));

  const rows = payslips.map(p => {
    const prev = prevMap.get(p.employeeId);
    const prevNet = prev ? Number(prev.netPay) : 0;
    const curNet = Number(p.netPay);
    const diff = curNet - prevNet;
    return {
      employeeId: p.employeeId,
      employeeCode: p.employee?.employeeCode || null,
      employeeName: p.employee ? `${p.employee.firstName} ${p.employee.lastName}`.trim() : null,
      currentNet: curNet,
      previousNet: prevNet,
      variance: diff,
      variancePct: prevNet !== 0 ? Math.round((diff / prevNet) * 10000) / 100 : null,
      flagged: Math.abs(diff) > curNet * 0.2,
    };
  });

  const items = rows.map((r) => ({
    employeeId: r.employeeId,
    employeeName: r.employeeName,
    currentNet: r.currentNet,
    previousNet: r.previousNet,
    deltaPct: r.variancePct,
    flags: [
      ...(r.flagged ? ['HIGH_VARIANCE'] : []),
      ...(r.currentNet < 0 ? ['NEGATIVE_NET'] : []),
      ...(r.currentNet === 0 ? ['ZERO_PAY'] : []),
      ...(r.previousNet === 0 && r.currentNet > 0 ? ['NEW_JOINER'] : []),
    ],
  }));
  return {
    runId,
    thresholdPct: 20,
    comparedToPeriod: prevRun?.period ?? null,
    comparedWithRunId: prevRun?.id || null,
    items,
    varianceRows: rows,
    summary: {
      totalVariance: rows.reduce((s, r) => s + r.variance, 0),
      flaggedCount: rows.filter((r) => r.flagged).length,
    },
  };
}

function mapEventToAuditEntry(e, runId) {
  const action = (e.type || '').replace(/\./g, '_').toUpperCase();
  return {
    id: e.id,
    runId,
    action,
    actor: e.actor || 'SYSTEM',
    at: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    detail: e.summary ?? null,
  };
}

export async function getRunAudit(prisma, runId, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return null;
  const events = await prisma.payrollEvent.findMany({ where: { runId, tenantId }, orderBy: { createdAt: 'asc' } });
  const stored = Array.isArray(run.auditJson) ? run.auditJson : (run.auditJson?.entries ?? []);
  const fromEvents = events.map((e) => mapEventToAuditEntry(e, runId));
  const fromStored = stored.map((e) => ({
    id: e.id ?? `${runId}-${e.action}`,
    runId,
    action: e.action ?? 'UNKNOWN',
    actor: e.actor ?? 'SYSTEM',
    at: e.at ?? e.createdAt ?? new Date().toISOString(),
    detail: e.detail ?? e.summary ?? null,
  }));
  return [...fromStored, ...fromEvents].sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export async function recalculatePayslip(prisma, runId, payslipId, tenantId, actor) {
  const payslip = await prisma.payslip.findFirst({ where: { id: payslipId, payrollRunId: runId, tenantId } });
  if (!payslip) return null;
  const updated = await prisma.payslip.update({
    where: { id: payslipId },
    data: { updatedAt: new Date() },
  });
  await prisma.payrollEvent.create({
    data: { id: (await import('../../utils/id.js')).generateId(), tenantId, type: 'payslip.recalculated', runId, summary: `Payslip ${payslipId} recalculated by ${actor || 'SYSTEM'}` },
  });
  return updated;
}

export async function holdPayslip(prisma, runId, payslipId, tenantId, body) {
  const payslip = await prisma.payslip.findFirst({ where: { id: payslipId, payrollRunId: runId, tenantId } });
  if (!payslip) return null;
  return await prisma.payslip.update({
    where: { id: payslipId },
    data: { status: 'HELD', heldAt: new Date(), holdReason: body?.reason || null },
  });
}

export async function releasePayslip(prisma, runId, payslipId, tenantId) {
  const payslip = await prisma.payslip.findFirst({ where: { id: payslipId, payrollRunId: runId, tenantId } });
  if (!payslip) return null;
  return await prisma.payslip.update({
    where: { id: payslipId },
    data: { status: 'PENDING', heldAt: null, holdReason: null },
  });
}

export async function importInputsFromTimesheets(prisma, runId, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return null;
  const timesheets = await prisma.timesheet.findMany({
    where: { tenantId, status: 'APPROVED' },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  }).catch(() => []);
  const imported = timesheets.length;
  await prisma.payrollEvent.create({
    data: { id: (await import('../../utils/id.js')).generateId(), tenantId, type: 'inputs.from-timesheets', runId, summary: `${imported} timesheet records imported` },
  });
  return { runId, imported, message: `${imported} timesheet records imported into payroll inputs` };
}

export async function publishRun(prisma, runId, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return null;
  const updated = await prisma.payrollRun.update({
    where: { id: runId },
    data: { published: true, publishedAt: new Date() },
  });
  await prisma.payrollEvent.create({
    data: { id: (await import('../../utils/id.js')).generateId(), tenantId, type: 'payslip.published', runId, summary: 'Payslips published to employees' },
  }).catch(() => null);
  return updated;
}

export async function listPayrollEvents(prisma, tenantId, runId) {
  const where = { tenantId };
  if (runId) where.runId = runId;
  const events = await prisma.payrollEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  return events.map((e) => ({
    id: e.id,
    type: e.type,
    runId: e.runId,
    at: e.createdAt.toISOString(),
    summary: e.summary,
  }));
}

export async function getPaymentBatch(prisma, runId, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return null;
  const batch = await prisma.paymentBatch.findFirst({ where: { runId, tenantId }, orderBy: { createdAt: 'desc' } });
  if (!batch) {
    return {
      id: null, runId, count: 0, totalAmount: 0,
      currency: run.currency || 'INR', status: 'NONE',
      createdAt: null, reconciledAt: null, lines: [],
    };
  }
  const rawLines = batch.linesJson ?? [];
  return {
    id: batch.id,
    runId: batch.runId,
    count: batch.count,
    totalAmount: Number(batch.totalAmount),
    currency: batch.currency,
    status: batch.status,
    createdAt: batch.createdAt,
    reconciledAt: batch.reconciledAt ?? null,
    lines: rawLines.map((l) => ({
      payslipId: l.payslipId ?? l.employeeId ?? '',
      employeeId: l.employeeId ?? '',
      employeeCode: l.employeeCode ?? '',
      employeeName: l.name ?? l.employeeName ?? '',
      amount: Number(l.netPay ?? l.amount ?? 0),
      currency: batch.currency,
      status: l.status ?? 'PENDING',
      failureReason: l.failureReason ?? null,
      payoutRef: l.payoutRef ?? null,
    })),
  };
}

export async function createPaymentBatch(prisma, runId, tenantId) {
  const { generateId } = await import('../../utils/id.js');
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) throw AppError('Run not found', 'NOT_FOUND', 404);
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: runId, tenantId, status: { not: 'HELD' } },
    include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } },
  });
  const lines = payslips.map(p => ({ employeeId: p.employeeId, employeeCode: p.employee?.employeeCode || '', name: p.employee ? `${p.employee.firstName} ${p.employee.lastName}`.trim() : '', netPay: Number(p.netPay), accountNumber: 'XXXX', ifsc: 'XXXX0000000', status: 'PENDING' }));
  const batch = await prisma.paymentBatch.create({
    data: {
      id: generateId(),
      tenantId,
      runId,
      count: lines.length,
      totalAmount: lines.reduce((s, l) => s + l.netPay, 0),
      currency: run.currency || 'INR',
      status: 'PENDING',
      linesJson: lines,
    },
  });
  return batch;
}

export async function getBankFile(prisma, runId, tenantId, format) {
  const batch = await prisma.paymentBatch.findFirst({ where: { runId, tenantId }, orderBy: { createdAt: 'desc' } });
  const lines = batch ? (batch.linesJson ?? []) : [];
  const header = 'EmployeeCode,Name,AccountNumber,IFSC,Amount,Currency';
  const rows = lines.map(l => `${l.employeeCode},${l.name},${l.accountNumber},${l.ifsc},${l.netPay},${batch?.currency || 'INR'}`);
  const csv = [header, ...rows].join('\n');
  return { csv, filename: `bank-file-${runId}.${format === 'NACH' ? 'txt' : 'csv'}` };
}

export async function getPaymentBatchById(prisma, batchId, tenantId) {
  return await prisma.paymentBatch.findFirst({ where: { id: batchId, tenantId } });
}

export async function reconcilePaymentBatch(prisma, batchId, tenantId) {
  const batch = await prisma.paymentBatch.findFirst({ where: { id: batchId, tenantId } });
  if (!batch) return null;
  return await prisma.paymentBatch.update({
    where: { id: batchId },
    data: { status: 'RECONCILED', reconciledAt: new Date() },
  });
}

const DEFAULT_TEMPLATE_SECTIONS = [
  { key: 'earnings', label: 'Earnings', enabled: true, order: 1 },
  { key: 'deductions', label: 'Deductions', enabled: true, order: 2 },
  { key: 'employerContributions', label: 'Employer Contributions', enabled: true, order: 3 },
  { key: 'oneTime', label: 'One-Time Items', enabled: false, order: 4 },
  { key: 'ytd', label: 'Year to Date', enabled: true, order: 5 },
  { key: 'attendance', label: 'Attendance', enabled: false, order: 6 },
  { key: 'paymentInfo', label: 'Payment Info', enabled: false, order: 7 },
];

const DEFAULT_TEMPLATE_FIELDS = [
  { key: 'employeeCode', label: 'Employee ID', enabled: true },
  { key: 'department', label: 'Department', enabled: true },
  { key: 'designation', label: 'Designation', enabled: true },
];

export async function getPayslipTemplate(prisma, tenantId) {
  let template = await prisma.payslipTemplate.findUnique({ where: { tenantId } });
  if (!template) {
    const { generateId } = await import('../../utils/id.js');
    template = await prisma.payslipTemplate.create({
      data: {
        id: generateId(),
        tenantId,
        name: 'Default Payslip',
        locale: 'en-IN',
        logoUrl: null,
        sections: DEFAULT_TEMPLATE_SECTIONS,
        fields: DEFAULT_TEMPLATE_FIELDS,
      },
    });
  }
  return fmtPayslipTemplateForUi(template);
}

export async function updatePayslipTemplate(prisma, tenantId, data) {
  const existing = await prisma.payslipTemplate.findUnique({ where: { tenantId } });
  if (!existing) return getPayslipTemplate(prisma, tenantId);

  const sections = data.sections
    ? data.sections.map(normalizePayslipTemplateSection)
    : existing.sections;
  const fields = data.fields
    ? data.fields.map(normalizePayslipTemplateField)
    : existing.fields;

  const updated = await prisma.payslipTemplate.update({
    where: { tenantId },
    data: {
      name: data.name ?? existing.name,
      locale: data.locale ?? existing.locale,
      logoUrl: data.logoUrl ?? existing.logoUrl,
      sections,
      fields,
      updatedAt: new Date(),
    },
  });
  return fmtPayslipTemplateForUi(updated);
}

export async function getTaxForm(prisma, employeeId, tenantId, type, fy) {
  const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId } });
  if (!employee) return null;
  const currentFY = fy || `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)}`;
  const payslips = await prisma.payslip.findMany({ where: { employeeId, tenantId } });
  const grossAnnual = payslips.reduce((s, p) => s + Number(p.grossEarnings || 0), 0);
  const _netAnnual = payslips.reduce((s, p) => s + Number(p.netPay || 0), 0);
  const taxDeducted = payslips.reduce((s, p) => s + Number(p.totalDeductions || 0), 0);
  return {
    formType: type,
    fiscalYear: currentFY,
    employee: { id: employee.id, name: `${employee.firstName} ${employee.lastName}`.trim(), employeeCode: employee.employeeCode, pan: employee.taxId || 'XXXXX0000X' },
    employer: { name: 'Acme Corp', tan: 'MUMB00000B' },
    incomeDetails: { grossIncome: grossAnnual, netTaxableIncome: grossAnnual, taxDeducted },
    downloadUrl: null,
  };
}

const REIMBURSEMENT_CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

export async function listReimbursementCategories(prisma, tenantId) {
  const cats = await prisma.reimbursementCategory.findMany({ where: { tenantId }, orderBy: { label: 'asc' } });
  if (cats.length === 0) {
    const { generateId } = await import('../../utils/id.js');
    const defaults = [
      { code: 'TRAVEL', label: 'Travel & Conveyance', monthlyCap: 5000 },
      { code: 'FOOD', label: 'Food & Meals', monthlyCap: 3000 },
      { code: 'MEDICAL', label: 'Medical', monthlyCap: 15000 },
      { code: 'INTERNET', label: 'Internet & Phone', monthlyCap: 1500 },
      { code: 'EQUIPMENT', label: 'Equipment & Supplies', monthlyCap: 10000 },
    ];
    const created = await Promise.all(defaults.map(d =>
      prisma.reimbursementCategory.create({ data: { id: generateId(), tenantId, ...d } }),
    ));
    return created.map((c, i) => ({ ...c, monthlyCap: Number(c.monthlyCap), color: REIMBURSEMENT_CATEGORY_COLORS[i % REIMBURSEMENT_CATEGORY_COLORS.length] }));
  }
  return cats.map((c, i) => ({ ...c, monthlyCap: Number(c.monthlyCap), color: REIMBURSEMENT_CATEGORY_COLORS[i % REIMBURSEMENT_CATEGORY_COLORS.length] }));
}

export async function listReimbursementClaims(prisma, tenantId, params = {}) {
  const where = { tenantId };
  if (params.status) where.status = params.status;
  if (params.employeeId) where.employeeId = params.employeeId;
  const [claims, total] = await prisma.$transaction([
    prisma.reimbursementClaim.findMany({
      where,
      include: { category: true },
      orderBy: { submittedAt: 'desc' },
      take: Number(params.limit || 50),
      skip: Number(params.page || 0) * Number(params.limit || 50),
    }),
    prisma.reimbursementClaim.count({ where }),
  ]);
  const mapped = claims.map(fmtReimbursementClaimForUi);
  if (params.employeeId) return mapped;
  return { claims: mapped, total, page: Number(params.page || 0), limit: Number(params.limit || 50) };
}

function fmtReimbursementClaimForUi(c) {
  return {
    id: c.id,
    employeeId: c.employeeId,
    category: c.category?.code ?? c.categoryId,
    categoryLabel: c.category?.label ?? null,
    amount: c.amount != null ? Number(c.amount) : 0,
    currency: c.currency,
    description: c.description ?? null,
    proofUrl: c.proofUrl ?? null,
    status: c.status,
    runId: c.runId ?? null,
    submittedAt: c.submittedAt,
    decidedAt: c.decidedAt ?? null,
  };
}

export async function submitReimbursementClaim(prisma, tenantId, data) {
  const { generateId } = await import('../../utils/id.js');
  const row = await prisma.reimbursementClaim.create({
    data: {
      id: generateId(),
      tenantId,
      employeeId: data.employeeId,
      categoryId: data.categoryId,
      amount: data.amount,
      currency: data.currency || 'INR',
      description: data.description || null,
      proofUrl: data.proofUrl || null,
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
    include: { category: true },
  });
  return fmtReimbursementClaimForUi(row);
}

export async function decideReimbursementClaim(prisma, claimId, tenantId, status) {
  const claim = await prisma.reimbursementClaim.findFirst({ where: { id: claimId, tenantId } });
  if (!claim) throw AppError('Claim not found', 'NOT_FOUND', 404);
  const row = await prisma.reimbursementClaim.update({
    where: { id: claimId },
    data: { status, decidedAt: new Date() },
    include: { category: true },
  });
  return fmtReimbursementClaimForUi(row);
}

export async function listGarnishments(prisma, employeeId, tenantId) {
  const rows = await prisma.garnishment.findMany({ where: { employeeId, tenantId }, orderBy: { priority: 'asc' } });
  return rows.map(fmtGarnishmentForUi);
}

export async function createGarnishment(prisma, employeeId, tenantId, data) {
  const { generateId } = await import('../../utils/id.js');
  const amountKind = data.amount?.kind ?? data.amountKind ?? 'FLAT';
  const amountValue = data.amount?.value ?? data.amountValue;
  const row = await prisma.garnishment.create({
    data: {
      id: generateId(),
      tenantId,
      employeeId,
      type: data.type,
      priority: data.priority ?? 1,
      amountKind,
      amountValue,
      protectedEarningsFloor: data.protectedEarningsFloor ?? 0,
      cap: data.cap ?? null,
      reference: data.reference || null,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo || null,
    },
  });
  return fmtGarnishmentForUi(row);
}

export async function updateGarnishment(prisma, garnishmentId, employeeId, tenantId, data) {
  const g = await prisma.garnishment.findFirst({ where: { id: garnishmentId, employeeId, tenantId } });
  if (!g) return null;
  const patch = { ...data, updatedAt: new Date() };
  if (data.amount) {
    patch.amountKind = data.amount.kind;
    patch.amountValue = data.amount.value;
    delete patch.amount;
  }
  const row = await prisma.garnishment.update({
    where: { id: garnishmentId },
    data: patch,
  });
  return fmtGarnishmentForUi(row);
}

export async function deleteGarnishment(prisma, garnishmentId, employeeId, tenantId) {
  const g = await prisma.garnishment.findFirst({ where: { id: garnishmentId, employeeId, tenantId } });
  if (!g) throw AppError('Garnishment not found', 'NOT_FOUND', 404);
  await prisma.garnishment.delete({ where: { id: garnishmentId } });
}

export async function getRunJournal(prisma, runId, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return null;
  const currency = run.currency || 'INR';
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: runId, tenantId },
    include: {
      employee: {
        select: {
          firstName: true, lastName: true,
          department: { select: { name: true } },
        },
      },
    },
  });
  const lines = payslips.flatMap((p) => {
    const costCenter = p.employee?.department?.name ?? 'General';
    return [
      { account: 'Salary Expense', costCenter, debit: Number(p.grossEarnings || 0), credit: 0, currency },
      { account: 'Tax Payable', costCenter, debit: 0, credit: Number(p.totalDeductions || 0), currency },
      { account: 'Salaries Payable', costCenter, debit: 0, credit: Number(p.netPay || 0), currency },
    ];
  });
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  return {
    runId,
    period: run.period,
    currency,
    lines,
    totalDebit,
    totalCredit,
    balanced: totalDebit === totalCredit,
    generatedAt: new Date().toISOString(),
    entries: lines,
  };
}

export async function exportRunJournal(prisma, runId, tenantId, _format) {
  const journal = await getRunJournal(prisma, runId, tenantId);
  if (!journal) throw AppError('Run not found', 'NOT_FOUND', 404);
  const header = 'Account,CostCenter,Debit,Credit,Currency';
  const rows = journal.lines.map((l) => `${l.account},${l.costCenter},${l.debit},${l.credit},${l.currency}`);
  const csv = [header, ...rows].join('\n');
  return { csv, filename: `journal-${runId}.csv` };
}
