import { evaluateFormula, topologicalSort } from '../../utils/formulaEval.js';
import {
  fmtComponentStatutoryFields,
  normalizeCostCenterRule,
  serializePayInPeriods,
} from '../../utils/payrollComponentShape.js';
import { fmtPayCalendar, payCalendarInputToDb } from '../../utils/payCalendarShape.js';
import { withComponentColor } from '../../utils/payrollUiShapes.js';
import {
  computeStatutoryContributions,
  resolveStatutoryPackForRun,
  schemeManagedComponentCodes,
  sumEmployerContributions,
} from '../../utils/statutoryCalculation.js';
import { fmtStatutoryPackRow, mergePackUpdate } from '../../utils/statutoryPackShape.js';

const COMPONENT_INCLUDE = {
  id: true, name: true, code: true, type: true, calculationType: true,
  value: true, basisCode: true, formula: true, taxable: true, active: true,
  displayOrder: true, description: true,
  statutoryTag: true, prorate: true, payInPeriods: true,
  glAccountCode: true, costCenterRule: true,
  createdAt: true, updatedAt: true,
};

function fmtComponent(c) {
  return withComponentColor({
    id: c.id, name: c.name, code: c.code, type: c.type,
    calculationType: c.calculationType,
    value: c.value !== null ? Number(c.value) : null,
    basisCode: c.basisCode ?? null, formula: c.formula ?? null,
    taxable: c.taxable, active: c.active, displayOrder: c.displayOrder,
    description: c.description ?? null,
    ...fmtComponentStatutoryFields(c),
    createdAt: c.createdAt, updatedAt: c.updatedAt,
  });
}

function fmtLegalEntity(e) {
  return {
    id: e.id,
    name: e.name,
    country: e.country,
    currency: e.currency,
    fiscalYearStartMonth: e.fiscalYearStartMonth,
    timezone: e.timezone,
    locale: e.locale,
    registrationIds: e.registrationIds ?? {},
    statutoryPackId: e.statutoryPackId ?? null,
    payCalendarId: e.payCalendarId ?? null,
    active: e.active ?? true,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function fmtPayGroup(pg) {
  const employeeCount = pg._count?.salaries ?? 0;
  return {
    id: pg.id, name: pg.name, code: pg.code, currency: pg.currency,
    paySchedule: pg.paySchedule, description: pg.description ?? null,
    active: pg.active, employeeCount,
    components: (pg.components || []).map((pgc) => ({
      componentId: pgc.component.id,
      componentCode: pgc.component.code,
      componentName: pgc.component.name,
      componentType: pgc.component.type,
      overrideCalculationType: pgc.overrideCalculationType ?? null,
      overrideValue: pgc.overrideValue !== null ? Number(pgc.overrideValue) : null,
      overrideFormula: pgc.overrideFormula ?? null,
    })),
    createdAt: pg.createdAt, updatedAt: pg.updatedAt,
  };
}

const PG_INCLUDE = {
  components: {
    include: { component: true },
    orderBy: [{ component: { displayOrder: 'asc' } }],
  },
  _count: { select: { employeeSalaries: true } },
};

// ── Salary Components ─────────────────────────────────────────────────────────

export async function getComponents(prisma, tenantId, active) {
  const where = { tenantId };
  if (active !== undefined) where.active = active;
  const rows = await prisma.salaryComponent.findMany({
    where, select: COMPONENT_INCLUDE, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(fmtComponent);
}

export async function createComponent(prisma, tenantId, data) {
  const existing = await prisma.salaryComponent.findUnique({ where: { tenantId_code: { tenantId, code: data.code } } });
  if (existing) {
    const err = new Error('Component code already exists');
    err.code = 'CODE_EXISTS'; err.statusCode = 409;
    throw err;
  }
  const row = await prisma.salaryComponent.create({
    data: {
      tenantId, name: data.name, code: data.code.toUpperCase(),
      type: data.type, calculationType: data.calculationType,
      value: data.value ?? null, basisCode: data.basisCode ?? null,
      formula: data.formula ?? null, taxable: data.taxable,
      active: data.active ?? true, displayOrder: data.displayOrder ?? 0,
      description: data.description ?? null,
      statutoryTag: data.statutoryTag ?? null,
      prorate: data.prorate ?? true,
      payInPeriods: serializePayInPeriods(data.payInPeriods),
      glAccountCode: data.glAccountCode ?? null,
      costCenterRule: normalizeCostCenterRule(data.costCenterRule),
    },
    select: COMPONENT_INCLUDE,
  });
  return fmtComponent(row);
}

export async function updateComponent(prisma, id, tenantId, data) {
  const existing = await prisma.salaryComponent.findFirst({ where: { id, tenantId } });
  if (!existing) {
    const err = new Error('Component not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.calculationType !== undefined) updateData.calculationType = data.calculationType;
  if (data.value !== undefined) updateData.value = data.value;
  if (data.basisCode !== undefined) updateData.basisCode = data.basisCode;
  if (data.formula !== undefined) updateData.formula = data.formula;
  if (data.taxable !== undefined) updateData.taxable = data.taxable;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.statutoryTag !== undefined) updateData.statutoryTag = data.statutoryTag;
  if (data.prorate !== undefined) updateData.prorate = data.prorate;
  if (data.payInPeriods !== undefined) updateData.payInPeriods = serializePayInPeriods(data.payInPeriods);
  if (data.glAccountCode !== undefined) updateData.glAccountCode = data.glAccountCode;
  if (data.costCenterRule !== undefined) updateData.costCenterRule = normalizeCostCenterRule(data.costCenterRule);

  const row = await prisma.salaryComponent.update({ where: { id }, data: updateData, select: COMPONENT_INCLUDE });
  return fmtComponent(row);
}

export async function deleteComponent(prisma, id, tenantId) {
  const existing = await prisma.salaryComponent.findFirst({ where: { id, tenantId } });
  if (!existing) {
    const err = new Error('Component not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  const usedInGroups = await prisma.payGroupComponent.count({ where: { componentId: id } });
  if (usedInGroups > 0) {
    const err = new Error('Component is referenced by pay groups'); err.code = 'COMPONENT_IN_USE'; err.statusCode = 409; throw err;
  }
  await prisma.salaryComponent.delete({ where: { id } });
  return { deleted: true };
}

// ── Pay Groups ────────────────────────────────────────────────────────────────

export async function getPayGroups(prisma, tenantId) {
  const rows = await prisma.payGroup.findMany({
    where: { tenantId }, include: PG_INCLUDE, orderBy: { createdAt: 'asc' },
  });
  return rows.map(fmtPayGroup);
}

export async function getPayGroup(prisma, id, tenantId) {
  const pg = await prisma.payGroup.findFirst({ where: { id, tenantId }, include: PG_INCLUDE });
  if (!pg) {
    const err = new Error('Pay group not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  return fmtPayGroup(pg);
}

export async function createPayGroup(prisma, tenantId, data) {
  const existing = await prisma.payGroup.findUnique({ where: { tenantId_code: { tenantId, code: data.code } } });
  if (existing) {
    const err = new Error('Pay group code already exists'); err.code = 'CODE_EXISTS'; err.statusCode = 409; throw err;
  }
  const pg = await prisma.payGroup.create({
    data: {
      tenantId, name: data.name, code: data.code.toUpperCase(),
      currency: data.currency ?? 'INR', paySchedule: data.paySchedule ?? 'MONTHLY',
      description: data.description ?? null, active: data.active ?? true,
      components: {
        create: (data.components || []).map((c) => ({
          componentId: c.componentId,
          overrideCalculationType: normalizeOverrideCalcType(c.overrideCalculationType),
          overrideValue: c.overrideValue ?? null,
          overrideFormula: c.overrideFormula ?? null,
        })),
      },
    },
    include: PG_INCLUDE,
  });
  return fmtPayGroup(pg);
}

const VALID_CALC_TYPES = new Set(['FLAT', 'PERCENTAGE', 'FORMULA']);
function normalizeOverrideCalcType(v) {
  if (v === null || v === undefined || v === '') return null;
  if (!VALID_CALC_TYPES.has(v)) {
    const err = new Error(`Invalid overrideCalculationType: "${v}". Must be FLAT, PERCENTAGE, FORMULA, or null.`);
    err.code = 'VALIDATION_ERROR'; err.statusCode = 422; throw err;
  }
  return v;
}

export async function updatePayGroup(prisma, id, tenantId, data) {
  const existing = await prisma.payGroup.findFirst({ where: { id, tenantId } });
  if (!existing) {
    const err = new Error('Pay group not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.paySchedule !== undefined) updateData.paySchedule = data.paySchedule;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.active !== undefined) updateData.active = data.active;

  if (data.components !== undefined) {
    await prisma.payGroupComponent.deleteMany({ where: { payGroupId: id } });
    updateData.components = {
      create: data.components.map((c) => ({
        componentId: c.componentId,
        overrideCalculationType: normalizeOverrideCalcType(c.overrideCalculationType),
        overrideValue: c.overrideValue ?? null,
        overrideFormula: c.overrideFormula ?? null,
      })),
    };
  }

  const pg = await prisma.payGroup.update({ where: { id }, data: updateData, include: PG_INCLUDE });
  return fmtPayGroup(pg);
}

export async function deletePayGroup(prisma, id, tenantId) {
  const pg = await prisma.payGroup.findFirst({ where: { id, tenantId }, include: { _count: { select: { employeeSalaries: true } } } });
  if (!pg) {
    const err = new Error('Pay group not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  if (pg._count.employeeSalaries > 0) {
    const err = new Error('Pay group has assigned employees');
    err.code = 'GROUP_HAS_EMPLOYEES'; err.statusCode = 409;
    err.details = { employeeCount: pg._count.employeeSalaries };
    throw err;
  }
  await prisma.payGroup.delete({ where: { id } });
  return { deleted: true };
}

// ── Employee Salary ───────────────────────────────────────────────────────────

function buildCalculatedComponents(pgComponents, annualCtc) {
  const ctcMonthly = Number(annualCtc) / 12;

  const effectiveComponents = pgComponents.map((pgc) => ({
    id: pgc.component.id, code: pgc.component.code, name: pgc.component.name,
    type: pgc.component.type, taxable: pgc.component.taxable,
    calculationType: pgc.overrideCalculationType || pgc.component.calculationType,
    value: pgc.overrideValue !== null && pgc.overrideValue !== undefined
      ? Number(pgc.overrideValue) : (pgc.component.value !== null ? Number(pgc.component.value) : null),
    basisCode: pgc.component.basisCode,
    formula: pgc.overrideFormula || pgc.component.formula,
    displayOrder: pgc.component.displayOrder,
  }));

  const sorted = topologicalSort(effectiveComponents);
  const computed = { CTC: ctcMonthly };
  const earnings = [];
  const deductions = [];
  const calculated = [];

  for (const comp of sorted) {
    let amount = 0;
    try {
      if (comp.calculationType === 'FLAT') {
        amount = comp.value || 0;
      } else if (comp.calculationType === 'PERCENTAGE') {
        const basis = computed[comp.basisCode] || 0;
        amount = ((comp.value || 0) / 100) * basis;
      } else if (comp.calculationType === 'FORMULA') {
        computed.GROSS = earnings.reduce((s, e) => s + e.amount, 0);
        computed.NET = computed.GROSS - deductions.reduce((s, d) => s + d.amount, 0);
        amount = evaluateFormula(comp.formula, computed);
      }
    } catch {
      amount = 0;
    }
    amount = Math.round(amount * 100) / 100;
    computed[comp.code] = amount;
    const item = withComponentColor({ code: comp.code, name: comp.name, type: comp.type, monthlyAmount: amount, taxable: comp.taxable });
    calculated.push(item);
    if (comp.type === 'EARNING') earnings.push({ amount });
    else if (comp.type === 'DEDUCTION') deductions.push({ amount });
  }

  const monthlyGross = earnings.reduce((s, e) => s + e.amount, 0);
  const monthlyDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  return { calculated, monthlyGross, monthlyDeductions, monthlyNet: monthlyGross - monthlyDeductions };
}

export async function getEmployeeSalary(prisma, employeeId, tenantId, isHR = true) {
  const current = await prisma.employeeSalary.findFirst({
    where: { tenantId, employeeId, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] },
    orderBy: { effectiveFrom: 'desc' },
    include: {
      payGroup: {
        include: { components: { include: { component: true }, orderBy: [{ component: { displayOrder: 'asc' } }] } },
      },
    },
  });

  const history = await prisma.employeeSalary.findMany({
    where: { tenantId, employeeId, effectiveTo: { not: null } },
    orderBy: { effectiveFrom: 'desc' },
    include: { payGroup: { select: { code: true } } },
  });

  if (!current) return null;

  const { calculated, monthlyGross, monthlyDeductions, monthlyNet } =
    buildCalculatedComponents(current.payGroup.components, current.annualCtc);

  const bankAccountNumber = isHR
    ? current.bankAccountNumber
    : current.bankAccountNumber
      ? `XXXX${current.bankAccountNumber.slice(-4)}`
      : null;

  return {
    id: current.id, employeeId: current.employeeId,
    payGroupId: current.payGroupId,
    payGroup: {
      id: current.payGroup.id, name: current.payGroup.name, code: current.payGroup.code,
      currency: current.payGroup.currency, paySchedule: current.payGroup.paySchedule,
    },
    annualCtc: Number(current.annualCtc),
    effectiveFrom: current.effectiveFrom.toISOString().split('T')[0],
    effectiveTo: current.effectiveTo ? current.effectiveTo.toISOString().split('T')[0] : null,
    bankAccountName: isHR ? current.bankAccountName : undefined,
    bankAccountNumber,
    bankIfscCode: isHR ? current.bankIfscCode : undefined,
    bankName: current.bankName ?? null,
    calculatedComponents: calculated,
    monthlyGross, monthlyDeductions, monthlyNet,
    history: history.map((h) => ({
      id: h.id, annualCtc: Number(h.annualCtc),
      effectiveFrom: h.effectiveFrom.toISOString().split('T')[0],
      effectiveTo: h.effectiveTo ? h.effectiveTo.toISOString().split('T')[0] : null,
      payGroupCode: h.payGroup.code,
    })),
    createdAt: current.createdAt, updatedAt: current.updatedAt,
  };
}

export async function setEmployeeSalary(prisma, employeeId, tenantId, data) {
  const effectiveFrom = new Date(data.effectiveFrom);

  // Close any current salary record
  const activeSalary = await prisma.employeeSalary.findFirst({
    where: { tenantId, employeeId, OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }] },
    orderBy: { effectiveFrom: 'desc' },
  });

  if (activeSalary) {
    const effectiveTo = new Date(effectiveFrom);
    effectiveTo.setDate(effectiveTo.getDate() - 1);
    await prisma.employeeSalary.update({
      where: { id: activeSalary.id },
      data: { effectiveTo },
    });
  }

  await prisma.employeeSalary.create({
    data: {
      tenantId, employeeId, payGroupId: data.payGroupId,
      annualCtc: data.annualCtc, effectiveFrom,
      bankAccountName: data.bankAccountName ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankIfscCode: data.bankIfscCode ?? null,
      bankName: data.bankName ?? null,
    },
  });

  return getEmployeeSalary(prisma, employeeId, tenantId, true);
}

// ── Employee Payslips ─────────────────────────────────────────────────────────

function monthLabel(period) {
  const [y, m] = period.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function fmtPayslipSummary(ps) {
  return {
    id: ps.id, period: ps.period, periodLabel: monthLabel(ps.period),
    currency: ps.currency, grossEarnings: Number(ps.grossEarnings),
    totalDeductions: Number(ps.totalDeductions), netPay: Number(ps.netPay),
    status: ps.status,
    paymentDate: ps.paymentDate ? ps.paymentDate.toISOString().split('T')[0] : null,
    payrollRunId: ps.payrollRunId,
  };
}

// Payslip line items are consumed by the UI's PayslipLine contract
// ({ code, name, amount, taxable }). Stored JSON uses monthlyAmount, so emit
// both: `amount` (what the UI reads) and `monthlyAmount` (back-compat).
function normalizePayslipLine(l) {
  const amount = l.amount ?? l.monthlyAmount ?? 0;
  return {
    code: l.code ?? null,
    name: l.name ?? l.code ?? '',
    type: l.type ?? null,
    amount,
    monthlyAmount: amount,
    taxable: l.taxable ?? false,
  };
}

function buildEmployerContributions(earnings, deductions) {
  const basicLine = (earnings ?? []).find((e) => e.code === 'BASIC');
  const basicAmt = Number(basicLine?.amount ?? basicLine?.monthlyAmount ?? 0);
  const pfLine = (deductions ?? []).find((d) => ['PF', 'PF_EMPLOYEE'].includes(d.code));
  const pfAmt = Number(pfLine?.amount ?? pfLine?.monthlyAmount ?? Math.round(basicAmt * 0.12));
  const esiAmt = Math.round(basicAmt * 0.0325);
  return [
    { code: 'PF_ER', name: 'Employer PF', type: 'EMPLOYER_CONTRIBUTION', amount: pfAmt, monthlyAmount: pfAmt, taxable: false },
    { code: 'ESI_ER', name: 'Employer ESI', type: 'EMPLOYER_CONTRIBUTION', amount: esiAmt, monthlyAmount: esiAmt, taxable: false },
  ];
}

async function computePayslipYtd(prisma, employeeId, tenantId, throughPeriod) {
  const [year, month] = throughPeriod.split('-').map(Number);
  const fyStartYear = month >= 4 ? year : year - 1;
  const periodStart = `${fyStartYear}-04`;
  const payslips = await prisma.payslip.findMany({
    where: {
      tenantId, employeeId, status: { in: ['PAID', 'PENDING', 'HELD'] },
      period: { gte: periodStart, lte: throughPeriod },
    },
    orderBy: { period: 'asc' },
  });
  const grossEarnings = payslips.reduce((s, p) => s + Number(p.grossEarnings), 0);
  const totalDeductions = payslips.reduce((s, p) => s + Number(p.totalDeductions), 0);
  const netPay = payslips.reduce((s, p) => s + Number(p.netPay), 0);
  const taxDeducted = payslips.reduce((s, p) => {
    const deds = Array.isArray(p.deductionsJson) ? p.deductionsJson : [];
    return s + deds.filter((d) => d.code === 'TDS').reduce((a, d) => a + Number(d.amount ?? d.monthlyAmount ?? 0), 0);
  }, 0);
  const pfTotal = payslips.reduce((s, p) => {
    const deds = Array.isArray(p.deductionsJson) ? p.deductionsJson : [];
    return s + deds.filter((d) => ['PF', 'PF_EMPLOYEE'].includes(d.code)).reduce((a, d) => a + Number(d.amount ?? d.monthlyAmount ?? 0), 0);
  }, 0);
  const fiscalYear = `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;
  return {
    fiscalYear,
    monthsElapsed: payslips.length,
    grossEarnings,
    taxableIncome: Math.round(grossEarnings * 0.87),
    taxDeducted,
    totalDeductions,
    netPay,
    contributions: { PF: pfTotal, PF_ER: pfTotal },
  };
}

function fmtPayslipDetail(ps, extras = {}) {
  const earnings = (ps.earningsJson ?? []).map(normalizePayslipLine);
  const deductions = (ps.deductionsJson ?? []).map(normalizePayslipLine);
  const storedEmployer = (ps.employerContributionsJson ?? []).map(normalizePayslipLine);
  const employerContributions = storedEmployer.length
    ? storedEmployer
    : (extras.employerContributions ?? buildEmployerContributions(earnings, deductions));
  const employerCost = Number(ps.grossEarnings) + sumEmployerContributions(employerContributions);
  return {
    id: ps.id, period: ps.period, periodLabel: monthLabel(ps.period),
    currency: ps.currency,
    employee: ps.employee ? {
      id: ps.employee.id,
      firstName: ps.employee.firstName, lastName: ps.employee.lastName,
      employeeCode: ps.employee.employeeCode,
      designation: ps.employee.designation ?? null,
      departmentName: ps.employee.department?.name ?? null,
      panNumber: null,
    } : undefined,
    company: ps.tenant ? { name: ps.tenant.name, address: null, logoUrl: ps.tenant.logoUrl ?? null } : undefined,
    earnings,
    deductions,
    employerContributions,
    employerCost,
    oneTimeAdditions: ps.oneTimeAdditionsJson ?? [],
    oneTimeDeductions: ps.oneTimeDeductionsJson ?? [],
    grossEarnings: Number(ps.grossEarnings),
    totalDeductions: Number(ps.totalDeductions),
    netPay: Number(ps.netPay),
    workingDays: ps.workingDays, presentDays: ps.presentDays,
    leaveDays: ps.leaveDays, lopDays: ps.lopDays,
    status: ps.status,
    paymentDate: ps.paymentDate ? ps.paymentDate.toISOString().split('T')[0] : null,
    paymentReference: ps.paymentReference ?? null,
    payrollRunId: ps.payrollRunId,
    documentUrl: ps.documentUrl ?? null,
    generatedAt: ps.generatedAt,
    ...(extras.ytd ? { ytd: extras.ytd } : {}),
  };
}

export async function getEmployeePayslips(prisma, employeeId, tenantId, { page = 1, limit = 12, year } = {}) {
  const where = { tenantId, employeeId };
  if (year) where.period = { startsWith: String(year) };
  const [rows, total] = await Promise.all([
    prisma.payslip.findMany({ where, orderBy: { period: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.payslip.count({ where }),
  ]);
  return { items: rows.map(fmtPayslipSummary), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getEmployeePayslipById(prisma, employeeId, payslipId, tenantId) {
  const ps = await prisma.payslip.findFirst({
    where: { id: payslipId, employeeId, tenantId },
    include: { employee: { include: { department: { select: { name: true } } } }, tenant: true },
  });
  if (!ps) {
    const err = new Error('Payslip not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  const ytd = await computePayslipYtd(prisma, employeeId, tenantId, ps.period);
  return fmtPayslipDetail(ps, { ytd });
}

// ── Payroll Runs ──────────────────────────────────────────────────────────────

function runMeta(summaryJson) {
  const meta = summaryJson && typeof summaryJson === 'object' ? summaryJson : {};
  return {
    employeeIds: meta.employeeIds ?? undefined,
    employeeId: meta.employeeId ?? meta.fnfParams?.employeeId ?? undefined,
    fnfParams: meta.fnfParams ?? undefined,
    reversalOfRunId: meta.reversalOfRunId ?? undefined,
    reversalOfPeriodLabel: meta.reversalOfPeriodLabel ?? undefined,
  };
}

function fmtRun(run, withSummary = false) {
  const meta = runMeta(run.summaryJson);
  const base = {
    id: run.id, period: run.period, periodLabel: monthLabel(run.period),
    type: run.type ?? 'REGULAR',
    status: run.status, employeeCount: run.employeeCount,
    totalGross: Number(run.totalGross), totalDeductions: Number(run.totalDeductions),
    totalNet: Number(run.totalNet),
    employerCost: Number(run.employerCost ?? 0),
    currency: run.currency,
    initiatedBy: run.initiatedByUser?.email ?? null,
    approvedBy: run.approvedByUser?.email ?? null,
    processedAt: run.processedAt ?? null,
    approvedAt: run.approvedAt ?? null,
    paidAt: run.paidAt ?? null,
    published: run.published ?? false,
    publishedAt: run.publishedAt ?? null,
    approvals: run.approvalsJson ?? [],
    createdAt: run.createdAt,
    ...meta,
  };
  if (withSummary) {
    const sj = run.summaryJson ?? { byDepartment: [], warnings: [] };
    base.summary = {
      byDepartment: sj.byDepartment ?? [],
      warnings: sj.warnings ?? [],
    };
  }
  return base;
}

const RUN_USER_INCLUDE = {
  initiatedByUser: { select: { email: true } },
  approvedByUser: { select: { email: true } },
};

export async function getPayrollRuns(prisma, tenantId, { page = 1, limit = 10, year, status } = {}) {
  const where = { tenantId };
  if (year) where.period = { startsWith: String(year) };
  if (status) where.status = status;
  const [rows, total] = await Promise.all([
    prisma.payrollRun.findMany({
      where, orderBy: { period: 'desc' }, skip: (page - 1) * limit, take: limit,
      include: RUN_USER_INCLUDE,
    }),
    prisma.payrollRun.count({ where }),
  ]);
  return { items: rows.map((r) => fmtRun(r)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

const VALID_RUN_TYPES = ['REGULAR', 'OFF_CYCLE', 'BONUS', 'ARREARS', 'FNF', 'REVERSAL'];

export async function createPayrollRun(prisma, tenantId, userId, data) {
  const type = data.type || 'REGULAR';
  if (!VALID_RUN_TYPES.includes(type)) {
    const err = new Error(`Invalid run type: ${type}`);
    err.code = 'INVALID_RUN_TYPE'; err.statusCode = 422; throw err;
  }

  if (type === 'REGULAR') {
    const existing = await prisma.payrollRun.findFirst({
      where: { tenantId, period: data.period, type: 'REGULAR', status: { not: 'CANCELLED' } },
    });
    if (existing) {
      const err = new Error(`A regular payroll run for ${data.period} already exists`);
      err.code = 'RUN_EXISTS'; err.statusCode = 409; throw err;
    }
  }

  const summaryJson = {};
  if (type === 'OFF_CYCLE') summaryJson.employeeIds = data.employeeIds;
  if (type === 'FNF' && data.fnf) {
    summaryJson.fnfParams = data.fnf;
    summaryJson.employeeId = data.fnf.employeeId;
  }
  if (type === 'REVERSAL') {
    const target = await prisma.payrollRun.findFirst({
      where: { id: data.reversalOfRunId, tenantId },
    });
    if (!target) {
      const err = new Error('Reversal target run not found');
      err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
    }
    if (!['APPROVED', 'PAID'].includes(target.status)) {
      const err = new Error('Reversal target must be APPROVED or PAID');
      err.code = 'INVALID_RUN_TYPE'; err.statusCode = 422; throw err;
    }
    summaryJson.reversalOfRunId = data.reversalOfRunId;
    summaryJson.reversalOfPeriodLabel = monthLabel(target.period);
  }

  const run = await prisma.payrollRun.create({
    data: {
      tenantId, period: data.period, type,
      initiatedById: userId, currency: 'INR',
      ...(Object.keys(summaryJson).length && { summaryJson }),
    },
    include: RUN_USER_INCLUDE,
  });
  return fmtRun(run);
}

export async function getPayrollRun(prisma, id, tenantId) {
  const run = await prisma.payrollRun.findFirst({
    where: { id, tenantId }, include: RUN_USER_INCLUDE,
  });
  if (!run) {
    const err = new Error('Payroll run not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  return fmtRun(run, true);
}

function getWorkingDays(start, end) {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function preserveRunMeta(summaryJson) {
  const meta = summaryJson && typeof summaryJson === 'object' ? { ...summaryJson } : {};
  delete meta.byDepartment;
  delete meta.warnings;
  return meta;
}

function negateLines(arr) {
  return (Array.isArray(arr) ? arr : []).map((line) => ({
    ...line,
    amount: -Math.abs(Number(line.amount ?? line.monthlyAmount ?? 0)),
  }));
}

async function finalizeRunCalculation(prisma, id, preservedMeta, empCount, totalGross, totalDeductions, totalNet, byDept, warnings, totalEmployerCost = 0) {
  await prisma.payrollRun.update({
    where: { id },
    data: {
      status: 'REVIEW', employeeCount: empCount,
      totalGross: Math.round(totalGross * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      employerCost: Math.round(totalEmployerCost * 100) / 100,
      processedAt: new Date(),
      summaryJson: {
        ...preservedMeta,
        byDepartment: Object.values(byDept),
        warnings,
      },
    },
  });
}

export async function calculatePayrollRun(prisma, id, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) {
    const err = new Error('Payroll run not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  if (run.status !== 'DRAFT') {
    const err = new Error('Run must be in DRAFT status to calculate'); err.code = 'INVALID_STATUS'; err.statusCode = 400; throw err;
  }

  await prisma.payrollRun.update({ where: { id }, data: { status: 'CALCULATING' } });

  const runType = run.type || 'REGULAR';
  const preservedMeta = preserveRunMeta(run.summaryJson);

  await prisma.payslip.deleteMany({ where: { payrollRunId: id } });

  if (runType === 'REVERSAL') {
    const targetId = preservedMeta.reversalOfRunId;
    const targetPayslips = await prisma.payslip.findMany({ where: { payrollRunId: targetId, tenantId } });
    let totalGross = 0; let totalDeductions = 0; let totalNet = 0; let empCount = 0;
    const byDept = {}; const warnings = [];
    for (const ps of targetPayslips) {
      const gross = -Number(ps.grossEarnings);
      const ded = -Number(ps.totalDeductions);
      const net = -Number(ps.netPay);
      await prisma.payslip.create({
        data: {
          tenantId, payrollRunId: id, employeeId: ps.employeeId, period: run.period,
          currency: ps.currency, grossEarnings: gross, totalDeductions: ded, netPay: net,
          workingDays: ps.workingDays, presentDays: ps.presentDays, leaveDays: ps.leaveDays, lopDays: ps.lopDays,
          status: 'PENDING',
          earningsJson: negateLines(ps.earningsJson),
          deductionsJson: negateLines(ps.deductionsJson),
          oneTimeAdditionsJson: negateLines(ps.oneTimeAdditionsJson),
          oneTimeDeductionsJson: negateLines(ps.oneTimeDeductionsJson),
          generatedAt: new Date(),
        },
      });
      totalGross += gross; totalDeductions += ded; totalNet += net; empCount++;
    }
    await finalizeRunCalculation(prisma, id, preservedMeta, empCount, totalGross, totalDeductions, totalNet, byDept, warnings);
    return;
  }

  if (runType === 'BONUS' || runType === 'ARREARS') {
    const inputs = await prisma.payrollInput.findMany({
      where: { runId: id, tenantId, variablePay: { not: null } },
    });
    let totalGross = 0; let totalDeductions = 0; let totalNet = 0; let empCount = 0;
    const byDept = {}; const warnings = [];
    const label = runType === 'BONUS' ? 'Bonus' : 'Arrears';
    for (const inp of inputs) {
      const amount = Number(inp.variablePay);
      if (!amount) continue;
      const emp = await prisma.employee.findFirst({
        where: { id: inp.employeeId, tenantId },
        include: { department: { select: { name: true } } },
      });
      if (!emp) continue;
      const earningsArr = [{ code: runType, name: label, amount, taxable: true }];
      await prisma.payslip.create({
        data: {
          tenantId, payrollRunId: id, employeeId: emp.id, period: run.period,
          currency: 'INR', grossEarnings: amount, totalDeductions: 0, netPay: amount,
          workingDays: 0, presentDays: 0, leaveDays: 0, lopDays: 0, status: 'PENDING',
          earningsJson: earningsArr, deductionsJson: [],
          oneTimeAdditionsJson: [], oneTimeDeductionsJson: [], generatedAt: new Date(),
        },
      });
      totalGross += amount; totalNet += amount; empCount++;
      const deptName = emp.department?.name || 'Unassigned';
      if (!byDept[deptName]) byDept[deptName] = { departmentName: deptName, employeeCount: 0, totalNet: 0 };
      byDept[deptName].employeeCount++;
      byDept[deptName].totalNet = Math.round((byDept[deptName].totalNet + amount) * 100) / 100;
    }
    if (!inputs.length) {
      warnings.push({ message: 'No variablePay inputs — add inputs before calculate' });
    }
    await finalizeRunCalculation(prisma, id, preservedMeta, empCount, totalGross, totalDeductions, totalNet, byDept, warnings);
    return;
  }

  const [yearStr, monthStr] = run.period.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

  let salaries = await prisma.employeeSalary.findMany({
    where: {
      tenantId,
      effectiveFrom: { lte: periodEnd },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
    },
    include: {
      employee: { include: { department: { select: { name: true } } } },
      payGroup: {
        include: {
          components: {
            include: { component: true },
            orderBy: [{ component: { displayOrder: 'asc' } }],
          },
        },
      },
    },
  });

  if (runType === 'OFF_CYCLE') {
    const allowed = new Set(preservedMeta.employeeIds || []);
    salaries = salaries.filter((s) => allowed.has(s.employeeId));
  }
  if (runType === 'FNF') {
    const empId = preservedMeta.employeeId || preservedMeta.fnfParams?.employeeId;
    salaries = salaries.filter((s) => s.employeeId === empId);
  }

  const warnings = [];
  const byDept = {};
  let totalGross = 0, totalDeductions = 0, totalNet = 0, totalEmployerCost = 0, empCount = 0;

  const { pack: statutoryPack } = await resolveStatutoryPackForRun(prisma, tenantId, run.period);
  const contributionSchemes = statutoryPack?.contributionSchemes ?? [];
  const { employeeCodes: schemeEmployeeCodes, employerCodes: schemeEmployerCodes } = schemeManagedComponentCodes(contributionSchemes);
  if (statutoryPack) {
    preservedMeta.pinnedStatutoryPack = {
      statutoryPackId: statutoryPack.id,
      country: statutoryPack.country,
      version: statutoryPack.version,
      pinnedAt: new Date().toISOString(),
    };
  } else {
    warnings.push({ message: 'No statutory pack resolved for run period — statutory contributions skipped' });
  }

  for (const sal of salaries) {
    const { employee, payGroup } = sal;
    if (employee.employmentStatus !== 'ACTIVE' || employee.deletedAt) continue;

    try {
      const pgComps = payGroup.components.map((pgc) => ({
        id: pgc.component.id, code: pgc.component.code, name: pgc.component.name,
        type: pgc.component.type, taxable: pgc.component.taxable,
        statutoryTag: pgc.component.statutoryTag ?? null,
        displayOrder: pgc.component.displayOrder,
        calculationType: pgc.overrideCalculationType || pgc.component.calculationType,
        value: pgc.overrideValue !== null && pgc.overrideValue !== undefined
          ? Number(pgc.overrideValue) : (pgc.component.value !== null ? Number(pgc.component.value) : null),
        basisCode: pgc.component.basisCode,
        formula: pgc.overrideFormula || pgc.component.formula,
      }));

      const componentByCode = new Map(pgComps.map((c) => [c.code, c]));
      const ctcMonthly = Number(sal.annualCtc) / 12;
      const sorted = topologicalSort(pgComps);
      const computed = { CTC: ctcMonthly };
      const earningsArr = [], deductionsArr = [];

      for (const comp of sorted) {
        if (comp.type === 'DEDUCTION' && schemeEmployeeCodes.has(comp.code)) continue;
        if (comp.type === 'EMPLOYER_CONTRIBUTION' && schemeEmployerCodes.has(comp.code)) continue;
        let amount = 0;
        if (comp.calculationType === 'FLAT') {
          amount = comp.value || 0;
        } else if (comp.calculationType === 'PERCENTAGE') {
          amount = ((comp.value || 0) / 100) * (computed[comp.basisCode] || 0);
        } else if (comp.calculationType === 'FORMULA') {
          computed.GROSS = earningsArr.reduce((s, e) => s + e.amount, 0);
          computed.NET = computed.GROSS - deductionsArr.reduce((s, d) => s + d.amount, 0);
          amount = evaluateFormula(comp.formula, computed);
        }
        amount = Math.round(amount * 100) / 100;
        computed[comp.code] = amount;
        if (comp.type === 'EARNING') earningsArr.push({ code: comp.code, name: comp.name, amount, taxable: comp.taxable });
        else if (comp.type === 'DEDUCTION') deductionsArr.push({ code: comp.code, name: comp.name, amount });
      }

      const { statutoryDeductions, employerContributions } = computeStatutoryContributions(
        earningsArr, componentByCode, contributionSchemes,
      );
      for (const ded of statutoryDeductions) {
        const idx = deductionsArr.findIndex((d) => d.code === ded.code);
        if (idx >= 0) deductionsArr[idx] = ded;
        else deductionsArr.push(ded);
      }

      const grossEarnings = Math.round(earningsArr.reduce((s, e) => s + e.amount, 0) * 100) / 100;
      const totalDed = Math.round(deductionsArr.reduce((s, d) => s + d.amount, 0) * 100) / 100;
      const netPay = Math.round((grossEarnings - totalDed) * 100) / 100;
      const employerCost = Math.round((grossEarnings + sumEmployerContributions(employerContributions)) * 100) / 100;

      const attendance = await prisma.attendanceRecord.findMany({
        where: { tenantId, employeeId: employee.id, attendanceDate: { gte: periodStart, lte: periodEnd } },
        select: { status: true },
      });
      const workingDays = getWorkingDays(periodStart, periodEnd);
      const presentDays = attendance.filter((a) => ['PRESENT', 'WFH', 'HALF_DAY'].includes(a.status)).length;
      const leaveDays = attendance.filter((a) => a.status === 'LEAVE').length;
      const lopDays = attendance.filter((a) => a.status === 'ABSENT').length;

      await prisma.payslip.create({
        data: {
          tenantId, payrollRunId: id, employeeId: employee.id, period: run.period,
          currency: payGroup.currency, grossEarnings, totalDeductions: totalDed, netPay,
          workingDays, presentDays, leaveDays, lopDays, status: 'PENDING',
          earningsJson: earningsArr, deductionsJson: deductionsArr,
          employerContributionsJson: employerContributions,
          oneTimeAdditionsJson: [], oneTimeDeductionsJson: [], generatedAt: new Date(),
        },
      });

      totalGross += grossEarnings; totalDeductions += totalDed; totalNet += netPay;
      totalEmployerCost += employerCost; empCount++;
      const deptName = employee.department?.name || 'Unassigned';
      if (!byDept[deptName]) byDept[deptName] = { departmentName: deptName, employeeCount: 0, totalNet: 0 };
      byDept[deptName].employeeCount++;
      byDept[deptName].totalNet = Math.round((byDept[deptName].totalNet + netPay) * 100) / 100;
    } catch (err) {
      warnings.push({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, message: err.message });
    }
  }

  // Warn about active employees without salary config
  const allActive = await prisma.employee.findMany({
    where: { tenantId, employmentStatus: 'ACTIVE', deletedAt: null }, select: { id: true, firstName: true, lastName: true },
  });
  const salaryEmpIds = new Set(salaries.map((s) => s.employeeId));
  for (const emp of allActive) {
    if (!salaryEmpIds.has(emp.id)) {
      warnings.push({ employeeId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}`, message: 'No salary config assigned — employee skipped' });
    }
  }

  await finalizeRunCalculation(prisma, id, preservedMeta, empCount, totalGross, totalDeductions, totalNet, byDept, warnings, totalEmployerCost);
}

export async function approvePayrollRun(prisma, id, tenantId, userId, notes) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) {
    const err = new Error('Payroll run not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  if (run.status !== 'REVIEW') {
    const err = new Error('Run must be in REVIEW status to approve'); err.code = 'INVALID_STATUS'; err.statusCode = 400; throw err;
  }
  const updated = await prisma.payrollRun.update({
    where: { id },
    data: { status: 'APPROVED', approvedById: userId, approvalNotes: notes ?? null, approvedAt: new Date() },
    include: RUN_USER_INCLUDE,
  });
  return fmtRun(updated, true);
}

export async function markRunPaid(prisma, id, tenantId, paidAt, reference) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) {
    const err = new Error('Payroll run not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  if (run.status !== 'APPROVED') {
    const err = new Error('Run must be in APPROVED status to mark paid'); err.code = 'INVALID_STATUS'; err.statusCode = 400; throw err;
  }
  const paidDate = paidAt ? new Date(paidAt) : new Date();
  await prisma.payslip.updateMany({ where: { payrollRunId: id }, data: { status: 'PAID', paymentDate: paidDate, paymentReference: reference ?? null } });
  const updated = await prisma.payrollRun.update({
    where: { id },
    data: { status: 'PAID', paidAt: paidDate, paymentReference: reference ?? null },
    include: RUN_USER_INCLUDE,
  });
  return fmtRun(updated, true);
}

export async function cancelPayrollRun(prisma, id, tenantId, reason) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) {
    const err = new Error('Payroll run not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  if (run.status === 'PAID') {
    const err = new Error('Cannot cancel a PAID run'); err.code = 'INVALID_STATUS'; err.statusCode = 400; throw err;
  }
  const updated = await prisma.payrollRun.update({
    where: { id },
    data: { status: 'CANCELLED', cancelReason: reason ?? null },
    include: RUN_USER_INCLUDE,
  });
  return fmtRun(updated, true);
}

// ── Run Payslips ──────────────────────────────────────────────────────────────

export async function getRunPayslips(prisma, runId, tenantId, { page = 1, limit = 20, departmentId, search } = {}) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) {
    const err = new Error('Payroll run not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }

  const where = { payrollRunId: runId, tenantId };
  if (departmentId || search) {
    where.employee = {};
    if (departmentId) where.employee.departmentId = departmentId;
    if (search) {
      where.employee.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  const [rows, total] = await Promise.all([
    prisma.payslip.findMany({
      where, skip: (page - 1) * limit, take: limit,
      include: { employee: { include: { department: { select: { name: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.payslip.count({ where }),
  ]);

  const items = rows.map((ps) => ({
    id: ps.id, employeeId: ps.employeeId,
    employeeCode: ps.employee?.employeeCode ?? null,
    employeeName: ps.employee ? `${ps.employee.firstName} ${ps.employee.lastName}` : null,
    departmentName: ps.employee?.department?.name ?? null,
    designation: ps.employee?.designation ?? null,
    currency: ps.currency,
    grossEarnings: Number(ps.grossEarnings), totalDeductions: Number(ps.totalDeductions), netPay: Number(ps.netPay),
    workingDays: ps.workingDays, presentDays: ps.presentDays, lopDays: ps.lopDays,
    status: ps.status, hasAdjustments: (ps.oneTimeAdditionsJson?.length || 0) + (ps.oneTimeDeductionsJson?.length || 0) > 0,
  }));

  return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getRunPayslip(prisma, runId, payslipId, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) {
    const err = new Error('Payroll run not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  const ps = await prisma.payslip.findFirst({
    where: { id: payslipId, payrollRunId: runId, tenantId },
    include: { employee: { include: { department: { select: { name: true } } } }, tenant: true },
  });
  if (!ps) {
    const err = new Error('Payslip not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  const ytd = await computePayslipYtd(prisma, ps.employeeId, tenantId, ps.period);
  return fmtPayslipDetail(ps, { ytd });
}

export async function updateRunPayslip(prisma, runId, payslipId, tenantId, data) {
  const ps = await prisma.payslip.findFirst({ where: { id: payslipId, payrollRunId: runId, tenantId } });
  if (!ps) {
    const err = new Error('Payslip not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }

  const additions = data.oneTimeAdditions ?? (ps.oneTimeAdditionsJson || []);
  const deductions = data.oneTimeDeductions ?? (ps.oneTimeDeductionsJson || []);

  const addTotal = additions.reduce((s, a) => s + (a.amount || 0), 0);
  const dedTotal = deductions.reduce((s, d) => s + (d.amount || 0), 0);
  const newGross = Number(ps.grossEarnings) + addTotal;
  const newDed = Number(ps.totalDeductions) + dedTotal;
  const newNet = newGross - newDed;

  const updated = await prisma.payslip.update({
    where: { id: payslipId },
    data: {
      oneTimeAdditionsJson: additions, oneTimeDeductionsJson: deductions,
      grossEarnings: newGross, totalDeductions: newDed, netPay: newNet,
      notes: data.notes ?? ps.notes,
    },
    include: { employee: { include: { department: { select: { name: true } } } }, tenant: true },
  });
  return fmtPayslipDetail(updated);
}

export async function exportRunPayslipsCsv(prisma, runId, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) {
    const err = new Error('Payroll run not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  const payslips = await prisma.payslip.findMany({
    where: { payrollRunId: runId, tenantId },
    include: { employee: { include: { department: { select: { name: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  const header = 'Employee Code,Name,Department,Designation,Gross Earnings,Total Deductions,Net Pay,Working Days,Present Days,LOP Days,Status\n';
  const rows = payslips.map((ps) => {
    const name = ps.employee ? `${ps.employee.firstName} ${ps.employee.lastName}` : '';
    return [
      ps.employee?.employeeCode ?? '', name, ps.employee?.department?.name ?? '',
      ps.employee?.designation ?? '',
      Number(ps.grossEarnings), Number(ps.totalDeductions), Number(ps.netPay),
      ps.workingDays, ps.presentDays, ps.lopDays, ps.status,
    ].join(',');
  }).join('\n');

  return header + rows;
}

// ── Phase 3: Legal Entities ───────────────────────────────────────────────────

export async function getLegalEntities(prisma, tenantId) {
  const rows = await prisma.legalEntity.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  return rows.map(fmtLegalEntity);
}

export async function createLegalEntity(prisma, tenantId, data) {
  const row = await prisma.legalEntity.create({
    data: {
      tenantId,
      name: data.name, country: data.country || 'IN', currency: data.currency || 'INR',
      fiscalYearStartMonth: data.fiscalYearStartMonth || 4, timezone: data.timezone || 'Asia/Kolkata',
      locale: data.locale || 'en-IN', registrationIds: data.registrationIds || {},
      statutoryPackId: data.statutoryPackId || null, payCalendarId: data.payCalendarId || null,
      active: data.active ?? true,
    },
  });
  return fmtLegalEntity(row);
}

export async function updateLegalEntity(prisma, id, tenantId, data) {
  const existing = await prisma.legalEntity.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  const updateData = {};
  for (const field of ['name', 'country', 'currency', 'fiscalYearStartMonth', 'timezone', 'locale', 'registrationIds', 'statutoryPackId', 'payCalendarId', 'active']) {
    if (data[field] !== undefined) updateData[field] = data[field];
  }
  const row = await prisma.legalEntity.update({ where: { id }, data: updateData });
  return fmtLegalEntity(row);
}

// ── Phase 3: Statutory Packs ──────────────────────────────────────────────────

function fmtStatutoryPack(p) {
  return fmtStatutoryPackRow(p);
}

export async function getStatutoryPacks(prisma, tenantId, country) {
  const rows = await prisma.statutoryPack.findMany({
    where: { tenantId, ...(country && { country }) },
    orderBy: [{ country: 'asc' }, { effectiveFrom: 'desc' }],
  });
  return rows.map(fmtStatutoryPack);
}

export async function getStatutoryPackById(prisma, id, tenantId) {
  const row = await prisma.statutoryPack.findFirst({ where: { id, tenantId } });
  return row ? fmtStatutoryPack(row) : null;
}

export async function createStatutoryPack(prisma, tenantId, data) {
  const row = await prisma.statutoryPack.create({
    data: {
      tenantId, country: data.country, version: data.version,
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      packData: data.packData,
    },
  });
  return fmtStatutoryPack(row);
}

export async function updateStatutoryPack(prisma, id, tenantId, data) {
  const existing = await prisma.statutoryPack.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  const merged = mergePackUpdate(existing, data);
  const row = await prisma.statutoryPack.update({
    where: { id },
    data: {
      ...(data.country && { country: merged.country }),
      ...(data.version && { version: merged.version }),
      ...(data.effectiveFrom !== undefined && { effectiveFrom: new Date(merged.effectiveFrom) }),
      ...(data.effectiveTo !== undefined && { effectiveTo: merged.effectiveTo ? new Date(merged.effectiveTo) : null }),
      packData: merged.packData,
    },
  });
  return fmtStatutoryPack(row);
}

export async function deleteStatutoryPack(prisma, id, tenantId) {
  const existing = await prisma.statutoryPack.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  const inUse = await prisma.legalEntity.count({ where: { tenantId, statutoryPackId: id } });
  if (inUse > 0) {
    const err = new Error('Statutory pack is referenced by a legal entity');
    err.code = 'PACK_IN_USE'; err.statusCode = 409; throw err;
  }
  await prisma.statutoryPack.delete({ where: { id } });
  return { deleted: true };
}

// ── Phase 3: Pay Calendars ────────────────────────────────────────────────────

export async function getPayCalendars(prisma, tenantId) {
  const rows = await prisma.payCalendar.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  return rows.map(fmtPayCalendar);
}

export async function createPayCalendar(prisma, tenantId, data) {
  const row = await prisma.payCalendar.create({
    data: {
      tenantId,
      name: data.name,
      code: data.code.toUpperCase(),
      country: data.country || 'IN',
      firstPayDate: data.firstPayDate || null,
      ...payCalendarInputToDb(data),
    },
  });
  return fmtPayCalendar(row);
}

export async function updatePayCalendar(prisma, id, tenantId, data) {
  const existing = await prisma.payCalendar.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  const row = await prisma.payCalendar.update({
    where: { id },
    data: payCalendarInputToDb(data, existing),
  });
  return fmtPayCalendar(row);
}

export async function listPaymentBatches(prisma, tenantId) {
  const batches = await prisma.paymentBatch.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  if (!batches.length) return [];
  const runIds = [...new Set(batches.map((b) => b.runId))];
  const runs = await prisma.payrollRun.findMany({
    where: { id: { in: runIds }, tenantId },
    select: { id: true, period: true },
  });
  const periodByRun = Object.fromEntries(runs.map((r) => [r.id, r.period]));
  return batches.map((b) => ({
    id: b.id,
    runId: b.runId,
    period: periodByRun[b.runId] ?? null,
    count: b.count,
    totalAmount: Number(b.totalAmount),
    currency: b.currency,
    status: b.status,
    createdAt: b.createdAt,
    reconciledAt: b.reconciledAt,
  }));
}
