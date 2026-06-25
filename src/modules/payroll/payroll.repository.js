import { evaluateFormula, topologicalSort } from '../../utils/formulaEval.js';
import { roundMoney } from '../../utils/money.js';
import {
  fmtComponentStatutoryFields,
  normalizeCostCenterRule,
  serializePayInPeriods,
} from '../../utils/payrollComponentShape.js';
import { fmtPayCalendar, payCalendarInputToDb } from '../../utils/payCalendarShape.js';
import { withComponentColor } from '../../utils/payrollUiShapes.js';
import {
  computeStatutoryContributions,
  computeIncomeTaxFromRegime,
  resolveStatutoryPackForEmployee,
  schemeManagedComponentCodes,
  sumEmployerContributions,
  resolveFiscalYear,
} from '../../utils/statutoryCalculation.js';
import { fmtStatutoryPackRow, mergePackUpdate } from '../../utils/statutoryPackShape.js';
import { periodsPerYear, periodsPerMonth, scheduleStepDays, cyclesInMonthFromAnchor } from '../../utils/payFrequency.js';
import {
  derivePeriodDates,
  derivePeriodDatesFromString,
  formatPeriodLabel,
  isLastCycleInMonth,
  inferScheduleFromPeriod,
} from '../../utils/payrollPeriod.js';
import { getWorkingDays, parseWorkWeekPattern } from '../../utils/workingDays.js';
import { resolveHolidayDateSet } from '../holidays/holidayResolver.service.js';

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
    workWeekPattern: e.workWeekPattern ?? 'MON-FRI',
    workWeekDays: e.workWeekDays ?? null,
    hoursPerDay: e.hoursPerDay ?? null,
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

function buildCalculatedComponents(pgComponents, annualCtc, currency = 'INR') {
  const ctcMonthly = Number(annualCtc) / 12;

  const effectiveComponents = pgComponents.map((pgc) => {
    const hasOverride = Boolean(pgc.overrideCalculationType);
    return {
      id: pgc.component.id, code: pgc.component.code, name: pgc.component.name,
      type: pgc.component.type, taxable: pgc.component.taxable,
      calculationType: hasOverride ? pgc.overrideCalculationType : pgc.component.calculationType,
      value: hasOverride && pgc.overrideValue != null
        ? Number(pgc.overrideValue)
        : (pgc.component.value != null ? Number(pgc.component.value) : null),
      basisCode: pgc.component.basisCode,
      formula: (hasOverride && pgc.overrideFormula) ? pgc.overrideFormula : pgc.component.formula,
      displayOrder: pgc.component.displayOrder,
    };
  });

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
    amount = roundMoney(amount, currency);
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
    buildCalculatedComponents(current.payGroup.components, current.annualCtc, current.currency ?? current.payGroup?.currency ?? 'INR');

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
    country: current.country ?? null,
    currency: current.currency ?? null,
    legalEntityId: current.legalEntityId ?? null,
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
      country: data.country ?? null,
      currency: data.currency ?? null,
      legalEntityId: data.legalEntityId ?? null,
      bankAccountName: data.bankAccountName ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankIfscCode: data.bankIfscCode ?? null,
      bankName: data.bankName ?? null,
    },
  });

  return getEmployeeSalary(prisma, employeeId, tenantId, true);
}

// ── Employee Payslips ─────────────────────────────────────────────────────────

function monthLabel(period, startDate, endDate) {
  return formatPeriodLabel(period, startDate, endDate);
}

function fmtPayslipSummary(ps) {
  return {
    id: ps.id, period: ps.period,
    periodLabel: monthLabel(ps.period, ps.payrollRun?.startDate, ps.payrollRun?.endDate),
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

async function computePayslipYtd(prisma, employeeId, tenantId, throughPeriod, fiscalYearStartMonth) {
  // Resolve fiscalYearStartMonth from salary's legal entity if not provided
  let fyStartMonth = fiscalYearStartMonth;
  if (fyStartMonth == null) {
    const sal = await prisma.employeeSalary.findFirst({
      where: { tenantId, employeeId },
      orderBy: { effectiveFrom: 'desc' },
      select: { legalEntityId: true, country: true },
    });
    if (sal?.legalEntityId) {
      const le = await prisma.legalEntity.findFirst({ where: { id: sal.legalEntityId, tenantId }, select: { fiscalYearStartMonth: true } });
      fyStartMonth = le?.fiscalYearStartMonth ?? 1;
    } else if (sal?.country) {
      const le = await prisma.legalEntity.findFirst({
        where: { tenantId, country: sal.country, active: true },
        orderBy: { createdAt: 'asc' },
        select: { fiscalYearStartMonth: true },
      });
      fyStartMonth = le?.fiscalYearStartMonth ?? 1;
    } else {
      fyStartMonth = 1;
    }
  }

  const { fiscalYear, fiscalYearStartPeriod } = resolveFiscalYear(throughPeriod, fyStartMonth);

  // Date-based YTD window — string period comparison is unsafe once weekly/bi-weekly/
  // sub-monthly periods exist (e.g. "2057-W05" vs "2057-02"). Resolve a true date window
  // and filter on each payslip's PayrollRun.startDate (falling back to the period string
  // for legacy payslips whose run predates the cycle-date columns).
  const [fyStartYear, fyStartMon] = fiscalYearStartPeriod.split('-').map(Number);
  const fyStartDate = new Date(fyStartYear, (fyStartMon || 1) - 1, 1);
  const throughDate = derivePeriodDatesFromString(throughPeriod).periodEnd;

  const allPayslips = await prisma.payslip.findMany({
    where: { tenantId, employeeId, status: { in: ['PAID', 'PENDING', 'HELD'] } },
    include: { payrollRun: { select: { startDate: true, period: true } } },
  });
  const payslips = allPayslips
    .map((p) => {
      const runStart = p.payrollRun?.startDate
        ? new Date(p.payrollRun.startDate)
        : derivePeriodDatesFromString(p.payrollRun?.period ?? p.period).periodStart;
      return { ...p, _effDate: runStart };
    })
    .filter((p) => p._effDate >= fyStartDate && p._effDate <= throughDate)
    .sort((a, b) => a._effDate - b._effDate);
  const grossEarnings = payslips.reduce((s, p) => s + Number(p.grossEarnings), 0);
  const totalDeductions = payslips.reduce((s, p) => s + Number(p.totalDeductions), 0);
  const netPay = payslips.reduce((s, p) => s + Number(p.netPay), 0);
  const taxDeducted = payslips.reduce((s, p) => {
    const deds = Array.isArray(p.deductionsJson) ? p.deductionsJson : [];
    return s + deds.filter((d) => ['TDS', 'WITHHOLDING_TAX', 'INCOME_TAX'].includes(d.code))
      .reduce((a, d) => a + Number(d.amount ?? d.monthlyAmount ?? 0), 0);
  }, 0);
  const pfTotal = payslips.reduce((s, p) => {
    const deds = Array.isArray(p.deductionsJson) ? p.deductionsJson : [];
    return s + deds.filter((d) => ['PF', 'PF_EMPLOYEE'].includes(d.code)).reduce((a, d) => a + Number(d.amount ?? d.monthlyAmount ?? 0), 0);
  }, 0);
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
  // Employer contribution lines come ONLY from the resolved country pack's contribution
  // schemes (stored at calculate time). A pack with no schemes → empty list. Never inject
  // India PF_ER/ESI_ER defaults, which would leak onto non-India (e.g. ZA, PH) payslips.
  const employerContributions = storedEmployer.length
    ? storedEmployer
    : (extras.employerContributions ?? []);
  const employerCost = Number(ps.grossEarnings) + sumEmployerContributions(employerContributions);
  return {
    id: ps.id, period: ps.period,
    periodLabel: monthLabel(ps.period, ps.payrollRun?.startDate, ps.payrollRun?.endDate),
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
    prisma.payslip.findMany({
      where, orderBy: { period: 'desc' }, skip: (page - 1) * limit, take: limit,
      include: { payrollRun: { select: { startDate: true, endDate: true } } },
    }),
    prisma.payslip.count({ where }),
  ]);
  return { items: rows.map(fmtPayslipSummary), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getEmployeePayslipById(prisma, employeeId, payslipId, tenantId) {
  const ps = await prisma.payslip.findFirst({
    where: { id: payslipId, employeeId, tenantId },
    include: {
      employee: { include: { department: { select: { name: true } } } }, tenant: true,
      payrollRun: { select: { startDate: true, endDate: true } },
    },
  });
  if (!ps) {
    const err = new Error('Payslip not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  const ytd = await computePayslipYtd(prisma, employeeId, tenantId, ps.period);
  const detail = fmtPayslipDetail(ps, { ytd });
  // HOLIDAY_ENGINE_BACKEND_CONTRACT §3 — payroll consumes the SAME holiday resolution as
  // leave-preview + the attendance calendar. Computed live on read (additive, never persisted):
  // does not alter any money or working-day field, so India payroll output is byte-identical.
  try {
    const from = ps.payrollRun?.startDate ?? new Date(derivePeriodDatesFromString(ps.period).periodStart);
    const to = ps.payrollRun?.endDate ?? new Date(derivePeriodDatesFromString(ps.period).periodEnd);
    const { dates, holidays, workWeekDays } = await resolveHolidayDateSet(prisma, tenantId, {
      employeeId, from, to,
    });
    detail.holidayBasis = {
      holidayDays: dates.size,
      holidaysExcluded: holidays.map((hh) => ({ date: hh.holidayDate.slice(0, 10), name: hh.name, observed: hh.observed })),
      workWeekDays,
    };
  } catch { detail.holidayBasis = { holidayDays: 0, holidaysExcluded: [], workWeekDays: [] }; }
  return detail;
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
    id: run.id,
    period: run.period,
    periodLabel: monthLabel(run.period, run.startDate, run.endDate),
    startDate: run.startDate ? run.startDate.toISOString().slice(0, 10) : null,
    endDate: run.endDate ? run.endDate.toISOString().slice(0, 10) : null,
    payDate: run.payDate ? run.payDate.toISOString().slice(0, 10) : null,
    paySchedule: run.paySchedule ?? null,
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

/**
 * Resolve cycle identity (paySchedule + startDate + endDate + payDate) for a run.
 * Honours explicit values from the request; derives the rest from the period string.
 * Throws VALIDATION_ERROR when a YYYY-Wnn period gives no way to know the cycle length
 * (WEEKLY vs BIWEEKLY) — such runs MUST send paySchedule + startDate + endDate.
 */
function resolveRunCycle(data) {
  const explicitStart = data.startDate ? new Date(data.startDate) : null;
  const explicitEnd = data.endDate ? new Date(data.endDate) : null;
  let paySchedule = data.paySchedule ?? inferScheduleFromPeriod(data.period) ?? null;

  // YYYY-Wnn with no explicit schedule is ambiguous (weekly vs biweekly).
  if (!paySchedule && !(explicitStart && explicitEnd)) {
    const err = new Error(
      `Cannot determine cycle for period "${data.period}". Weekly/bi-weekly runs must send paySchedule plus startDate and endDate.`,
    );
    err.code = 'VALIDATION_ERROR'; err.statusCode = 422; throw err;
  }

  let startDate = explicitStart;
  let endDate = explicitEnd;
  if (!startDate || !endDate) {
    // BIWEEKLY cannot be derived from a YYYY-Wnn string (string only encodes a 7-day ISO week).
    if (paySchedule === 'BIWEEKLY') {
      const err = new Error('Bi-weekly runs must send explicit startDate and endDate.');
      err.code = 'VALIDATION_ERROR'; err.statusCode = 422; throw err;
    }
    const derived = derivePeriodDatesFromString(data.period);
    startDate = startDate ?? new Date(derived.periodStart);
    endDate = endDate ?? new Date(derived.periodEnd);
  }
  const payDate = data.payDate ? new Date(data.payDate) : new Date(endDate);
  return { paySchedule, startDate, endDate, payDate };
}

/**
 * Resolve the run-level display currency. Payslip currency is per-employee and authoritative;
 * this is just the run header. Derived from the selected pay groups (single → that currency,
 * multiple → 'MULTI'); falls back to the tenant's sole active pay-group currency, else 'INR'.
 * Never blindly hardcodes INR for non-INR tenants.
 */
async function resolveRunCurrency(prisma, tenantId, data) {
  const where = data.payGroupIds?.length
    ? { tenantId, id: { in: data.payGroupIds } }
    : { tenantId, active: true };
  const pgs = await prisma.payGroup.findMany({ where, select: { currency: true } });
  const currencies = pgs.map((p) => p.currency).filter(Boolean);
  const unique = [...new Set(currencies)];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) {
    // Mixed-currency run: the run header `currency` is rendered by the FE through
    // Intl.NumberFormat, which throws RangeError on a non-ISO sentinel like 'MULTI'. Use the
    // most common pay-group currency (a valid ISO code) as the header; the per-payslip
    // currency stays authoritative for the actual amounts. (FE parity: MSW never emits 'MULTI'.)
    const counts = {};
    for (const c of currencies) counts[c] = (counts[c] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  // No pay groups configured yet → use the tenant's configured default currency.
  // Never hardcode INR (config-over-code: multi-country is data, not a country rule).
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { defaultCurrency: true } });
  return tenant?.defaultCurrency || 'INR';
}

export async function createPayrollRun(prisma, tenantId, userId, data) {
  const type = data.type || 'REGULAR';
  if (!VALID_RUN_TYPES.includes(type)) {
    const err = new Error(`Invalid run type: ${type}`);
    err.code = 'INVALID_RUN_TYPE'; err.statusCode = 422; throw err;
  }

  // Resolve cycle identity (dates + schedule) for all dated run types.
  const cycle = resolveRunCycle(data);

  if (type === 'REGULAR') {
    // Cycle-identity duplicate detection: a run is a duplicate only when the SAME
    // calendar cycle (schedule + start + end) already exists. Weekly and bi-weekly
    // runs sharing a YYYY-Wnn period string no longer collide.
    const existing = await prisma.payrollRun.findFirst({
      where: {
        tenantId, type: 'REGULAR', status: { not: 'CANCELLED' },
        AND: [
          { OR: [{ startDate: cycle.startDate }, { startDate: null, period: data.period }] },
          { OR: [{ endDate: cycle.endDate }, { endDate: null, period: data.period }] },
          { OR: [{ paySchedule: cycle.paySchedule }, { paySchedule: null, period: data.period }] },
        ],
      },
    });
    if (existing) {
      const err = new Error(`A regular payroll run for cycle ${data.period} (${cycle.startDate.toISOString().slice(0, 10)}–${cycle.endDate.toISOString().slice(0, 10)}) already exists`);
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

  const runCurrency = await resolveRunCurrency(prisma, tenantId, data);

  const run = await prisma.payrollRun.create({
    data: {
      tenantId, period: data.period, type,
      initiatedById: userId, currency: runCurrency,
      // Always persist derived cycle metadata so downstream math, dedup and YTD are date-based.
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      payDate: cycle.payDate,
      ...(cycle.paySchedule && { paySchedule: cycle.paySchedule }),
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

// getWorkingDays is now imported from ../../utils/workingDays.js (Mon-Fri default, configurable).

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
  // Round run totals to the run currency's minor-unit precision (KWD=3dp, JPY=0dp, INR=2dp).
  const runRow = await prisma.payrollRun.findUnique({ where: { id }, select: { currency: true } });
  const ccy = runRow?.currency || 'INR';
  await prisma.payrollRun.update({
    where: { id },
    data: {
      status: 'REVIEW', employeeCount: empCount,
      totalGross: roundMoney(totalGross, ccy),
      totalDeductions: roundMoney(totalDeductions, ccy),
      totalNet: roundMoney(totalNet, ccy),
      employerCost: roundMoney(totalEmployerCost, ccy),
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
      const empSal = await prisma.employeeSalary.findFirst({
        where: { tenantId, employeeId: emp.id, effectiveTo: null },
        include: { payGroup: { select: { currency: true } } },
      });
      const bonusCurrency = empSal?.currency ?? empSal?.payGroup?.currency ?? run.currency ?? 'INR';
      // H10 — marginal income tax on the extra pay: tax(base + extra) − tax(base), at the
      // employee's own bands (FE computeBonusTax). Base = the latest regular payslip's taxable
      // earnings annualized (fallback annualCtc). No regime → tax 0 (prior behaviour preserved).
      let bonusTax = 0;
      try {
        const { pack: bpack } = await resolveStatutoryPackForEmployee(prisma, tenantId, empSal, run.period, periodEnd);
        const bregime = (bpack?.taxRegimes ?? [])[0] ?? null;
        if (bregime && Array.isArray(bregime.slabs) && bregime.slabs.length) {
          const lastReg = await prisma.payslip.findFirst({
            where: { tenantId, employeeId: emp.id, grossEarnings: { gt: 0 }, NOT: { period: run.period } },
            orderBy: { generatedAt: 'desc' }, select: { earningsJson: true },
          });
          const baseAnnual = (lastReg && Array.isArray(lastReg.earningsJson))
            ? lastReg.earningsJson.filter((e) => e.taxable !== false).reduce((s, e) => s + Number(e.amount ?? 0), 0) * 12
            : Number(empSal?.annualCtc ?? 0);
          const taxBase = computeIncomeTaxFromRegime(baseAnnual, bregime, bonusCurrency);
          const taxWith = computeIncomeTaxFromRegime(baseAnnual + amount, bregime, bonusCurrency);
          bonusTax = Math.max(0, Math.round(taxWith - taxBase));
        }
      } catch { bonusTax = 0; }
      const bonusNet = Math.round((amount - bonusTax) * 100) / 100;
      const earningsArr = [{ code: runType, name: label, amount, taxable: true }];
      const bonusDed = bonusTax > 0 ? [{ code: 'TDS', name: 'Income Tax (TDS)', amount: bonusTax, taxable: false }] : [];
      await prisma.payslip.create({
        data: {
          tenantId, payrollRunId: id, employeeId: emp.id, period: run.period,
          currency: bonusCurrency, grossEarnings: amount, totalDeductions: bonusTax, netPay: bonusNet,
          workingDays: 0, presentDays: 0, leaveDays: 0, lopDays: 0, status: 'PENDING',
          earningsJson: earningsArr, deductionsJson: bonusDed,
          oneTimeAdditionsJson: [], oneTimeDeductionsJson: [], generatedAt: new Date(),
        },
      });
      totalGross += amount; totalDeductions += bonusTax; totalNet += bonusNet; empCount++;
      const deptName = emp.department?.name || 'Unassigned';
      if (!byDept[deptName]) byDept[deptName] = { departmentName: deptName, employeeCount: 0, totalNet: 0 };
      byDept[deptName].employeeCount++;
      byDept[deptName].totalNet = Math.round((byDept[deptName].totalNet + bonusNet) * 100) / 100;
    }
    if (!inputs.length) {
      warnings.push({ message: 'No variablePay inputs — add inputs before calculate' });
    }
    await finalizeRunCalculation(prisma, id, preservedMeta, empCount, totalGross, totalDeductions, totalNet, byDept, warnings);
    return;
  }

  const { periodStart, periodEnd } = derivePeriodDates(run);

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

  for (const sal of salaries) {
    const { employee, payGroup } = sal;
    if (employee.employmentStatus !== 'ACTIVE' || employee.deletedAt) continue;

    try {
      // Per-employee pack resolution. Pass the cycle end date so sub-monthly periods
      // (H1/H2, Wnn) resolve effective-dated packs without an Invalid Date.
      const { pack: statutoryPack, legalEntity: empLegalEntity } = await resolveStatutoryPackForEmployee(
        prisma, tenantId, sal, run.period, periodEnd,
      );
      const contributionSchemes = statutoryPack?.contributionSchemes ?? [];
      const { employeeCodes: schemeEmployeeCodes, employerCodes: schemeEmployerCodes } = schemeManagedComponentCodes(contributionSchemes);

      // Pin statutory pack per employee (multi-country reproducibility)
      if (!preservedMeta.pinnedStatutoryPacksByEmployee) preservedMeta.pinnedStatutoryPacksByEmployee = {};
      if (statutoryPack) {
        const resolvedBy = sal.legalEntityId ? 'LEGAL_ENTITY' : (sal.country ? 'SALARY_COUNTRY' : 'TENANT_DEFAULT');
        preservedMeta.pinnedStatutoryPacksByEmployee[employee.id] = {
          employeeId: employee.id,
          country: statutoryPack.country,
          statutoryPackId: statutoryPack.id,
          version: statutoryPack.version,
          resolvedBy,
          pinnedAt: new Date().toISOString(),
        };
        // Backward-compat: keep run-level summary pack (first employee's pack)
        if (!preservedMeta.pinnedStatutoryPack) {
          preservedMeta.pinnedStatutoryPack = {
            statutoryPackId: statutoryPack.id, country: statutoryPack.country,
            version: statutoryPack.version, pinnedAt: new Date().toISOString(),
          };
        }
      } else {
        warnings.push({ employeeId: employee.id, message: 'No statutory pack resolved — statutory contributions skipped' });
      }

      const pgComps = payGroup.components.map((pgc) => {
        const hasOverride = Boolean(pgc.overrideCalculationType);
        return {
          id: pgc.component.id, code: pgc.component.code, name: pgc.component.name,
          type: pgc.component.type, taxable: pgc.component.taxable,
          statutoryTag: pgc.component.statutoryTag ?? null,
          displayOrder: pgc.component.displayOrder,
          calculationType: hasOverride ? pgc.overrideCalculationType : pgc.component.calculationType,
          value: hasOverride && pgc.overrideValue != null
            ? Number(pgc.overrideValue)
            : (pgc.component.value != null ? Number(pgc.component.value) : null),
          basisCode: pgc.component.basisCode,
          formula: (hasOverride && pgc.overrideFormula) ? pgc.overrideFormula : pgc.component.formula,
          prorate: pgc.component.prorate ?? true,
          payInPeriods: pgc.component.payInPeriods ?? null,
        };
      });

      const componentByCode = new Map(pgComps.map((c) => [c.code, c]));
      // The RUN's schedule drives this run's proration/apportionment — a SEMI_MONTHLY run on a
      // MONTHLY pay group must still prorate per cycle (Bug A: previously payGroup won, so an
      // H1 run on a MONTHLY group paid the full month and PF used ppm=1). Falls back to the
      // group, then MONTHLY; for a true MONTHLY run run.paySchedule is MONTHLY/null → unchanged.
      const empPaySchedule = run.paySchedule ?? payGroup.paySchedule ?? 'MONTHLY';
      const ppy = periodsPerYear(empPaySchedule);
      // Apportionment cycle count: for fixed-length schedules (BIWEEKLY/WEEKLY) the number of
      // cycles in a calendar month varies (2 or 3 biweekly; 4 or 5 weekly). Use the ACTUAL count
      // derived from the run's startDate so MONTHLY_TOTAL caps never over-deduct in a 3-cycle month.
      const stepDays = scheduleStepDays(empPaySchedule);
      let ppm = periodsPerMonth(empPaySchedule);
      let lastCycle = isLastCycleInMonth(run.period);
      if (stepDays && run.startDate) {
        const c = cyclesInMonthFromAnchor(new Date(run.startDate), stepDays);
        ppm = c.count;
        lastCycle = c.isLast;
      }
      const ctcPeriod = Number(sal.annualCtc) / ppy;
      // Per-cycle share for FLAT components. FLAT values are authored as MONTHLY amounts;
      // for sub-monthly schedules each cycle must pay only its share of the month. Data-driven
      // from periods-per-year (no frequency branches): MONTHLY ppy=12 → 1 (unchanged, byte-identical);
      // SEMI_MONTHLY ppy=24 → 0.5; BIWEEKLY ppy=26 → 12/26; WEEKLY ppy=52 → 12/52.
      const periodFactor = 12 / ppy;
      // Round per-payslip money to the employee currency's minor-unit precision
      // (KWD=3dp, JPY=0dp, INR=2dp → byte-identical to the old Math.round(x*100)/100).
      const payslipCurrency = sal.currency ?? payGroup.currency ?? 'INR';
      const r2 = (n) => roundMoney(n, payslipCurrency);
      const pMonth = Number(run.period.slice(5, 7));
      const pYear = Number(run.period.slice(0, 4));

      // Run input + attendance resolved up front so LOP proration (H1) can reduce earnings and
      // the garnishment disposable shares the same period context.
      const runInput = await prisma.payrollInput.findFirst({ where: { runId: id, employeeId: employee.id } });
      const attendance = await prisma.attendanceRecord.findMany({
        where: { tenantId, employeeId: employee.id, attendanceDate: { gte: periodStart, lte: periodEnd } },
        select: { status: true },
      });
      // Authoritative work-week: fine-grained workWeekDays[] when set, else coarse pattern, else Mon-Fri.
      // parseWorkWeekPattern handles both an abbrev/number array and the "MON-FRI"/"SUN-THU" string.
      const wwSource =
        (Array.isArray(empLegalEntity?.workWeekDays) && empLegalEntity.workWeekDays.length > 0)
          ? empLegalEntity.workWeekDays
          : empLegalEntity?.workWeekPattern;
      const workWeekPattern = parseWorkWeekPattern(wwSource);
      const workingDays = getWorkingDays(periodStart, periodEnd, workWeekPattern);
      const hasAttendance = attendance.length > 0;
      const presentDays = hasAttendance
        ? attendance.filter((a) => ['PRESENT', 'WFH', 'HALF_DAY'].includes(a.status)).length
        : workingDays;
      const leaveDays = hasAttendance ? attendance.filter((a) => a.status === 'LEAVE').length : 0;
      const lopDays = runInput?.lopDays ?? (hasAttendance ? attendance.filter((a) => a.status === 'ABSENT').length : 0);
      // H1 — LOP proration factor, calendar-day basis (FE proration.utils.prorationFactor).
      const calDays = new Date(pYear, pMonth, 0).getDate();
      const lopFactor = calDays > 0 ? Math.min(1, Math.max(0, calDays - lopDays) / calDays) : 1;

      const sorted = topologicalSort(pgComps);
      const computed = { CTC: ctcPeriod };
      const earningsArr = [], deductionsArr = [];
      // Structural (un-prorated) running sums — formulas + the annual tax base read these so
      // they match the FE engine (which prorates a structural breakdown, not the paid amounts).
      let structEarnSum = 0, structDedSum = 0, annualTaxableStructural = 0;

      for (const comp of sorted) {
        if (comp.type === 'DEDUCTION' && schemeEmployeeCodes.has(comp.code)) continue;
        if (comp.type === 'EMPLOYER_CONTRIBUTION' && schemeEmployerCodes.has(comp.code)) continue;
        // Scheduled components (13th-month, etc.) pay only in their configured months.
        let payIn = null;
        if (comp.payInPeriods) {
          try {
            const a = typeof comp.payInPeriods === 'string' ? JSON.parse(comp.payInPeriods) : comp.payInPeriods;
            if (Array.isArray(a)) payIn = a.map(Number);
          } catch { payIn = null; }
        }
        if (payIn && !payIn.includes(pMonth)) continue;
        let amount = 0;
        if (comp.calculationType === 'FLAT') {
          // FLAT is a monthly figure → scale to the cycle's share (periodFactor=1 for MONTHLY).
          amount = (comp.value || 0) * periodFactor;
        } else if (comp.calculationType === 'PERCENTAGE') {
          amount = ((comp.value || 0) / 100) * (computed[comp.basisCode] || 0);
        } else if (comp.calculationType === 'FORMULA') {
          // FE parity: formulas resolve over STRUCTURAL (un-prorated) GROSS/NET.
          computed.GROSS = structEarnSum;
          computed.NET = structEarnSum - structDedSum;
          amount = evaluateFormula(comp.formula, computed);
        }
        amount = r2(amount);              // structural period amount
        computed[comp.code] = amount;     // basis/formula see structural
        // H1 — paid amount = structural × LOP factor for prorating lines (FE comp.prorate).
        const paid = (comp.prorate ?? true) ? r2(amount * lopFactor) : amount;
        if (comp.type === 'EARNING') {
          earningsArr.push({ code: comp.code, name: comp.name, amount: paid, taxable: comp.taxable });
          structEarnSum += amount;
          // H3 — annual taxable base from STRUCTURAL taxable earnings × periods actually paid.
          if (comp.taxable !== false) annualTaxableStructural += amount * ((payIn && payIn.length) ? payIn.length : 12);
        } else if (comp.type === 'DEDUCTION') {
          deductionsArr.push({ code: comp.code, name: comp.name, amount: paid });
          structDedSum += amount;
        }
      }

      const { statutoryDeductions, employerContributions, warnings: statWarnings = [] } = computeStatutoryContributions(
        earningsArr, componentByCode, contributionSchemes,
        { periodsPerMonth: ppm, isLastCycleInMonth: lastCycle },
      );
      for (const w of statWarnings) {
        warnings.push({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, message: w });
      }
      for (const ded of statutoryDeductions) {
        const idx = deductionsArr.findIndex((d) => d.code === ded.code);
        if (idx >= 0) deductionsArr[idx] = ded;
        else deductionsArr.push(ded);
      }

      const grossEarnings = r2(earningsArr.reduce((s, e) => s + e.amount, 0));

      // H11 — sub-national local taxes (professional tax / LWF) from the pack's localTaxes
      // bands, on the (prorated) monthly gross. No-op when the pack carries no localTaxes.
      const localTaxes = statutoryPack?.localTaxes ?? [];
      if (Array.isArray(localTaxes) && localTaxes.length > 0) {
        const empJurisdiction = sal.jurisdiction ?? employee.jurisdiction ?? empLegalEntity?.jurisdiction ?? null;
        for (const lt of localTaxes) {
          if (lt.jurisdiction && empJurisdiction && lt.jurisdiction !== empJurisdiction) continue;
          let amt = 0;
          for (const b of (lt.slabs ?? lt.bands ?? [])) {
            const upper = b.to == null ? Infinity : Number(b.to);
            if (grossEarnings >= Number(b.from ?? 0) && grossEarnings < upper) { amt = Number(b.amount ?? 0); break; }
          }
          if (amt > 0) {
            const code = lt.component ?? 'PROF_TAX';
            const idx = deductionsArr.findIndex((d) => d.code === code);
            if (idx >= 0) deductionsArr[idx].amount = amt;
            else deductionsArr.push({ code, name: lt.name ?? 'Professional Tax', amount: amt, taxable: false });
          }
        }
      }

      // Income tax (H2/H3/H4): regime from the employee's declaration (else pack default);
      // annual taxable = structural base − VERIFIED declaration exemptions the regime allows;
      // withhold with a YTD true-up across the fiscal year, then split across sub-monthly cycles.
      const taxRegimes = statutoryPack?.taxRegimes ?? [];
      const fyStart = Number(empLegalEntity?.fiscalYearStartMonth ?? statutoryPack?.fiscalYearStartMonth ?? 4);
      const fyStartYear = pMonth >= fyStart ? pYear : pYear - 1;
      const fyLabel = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
      const monthIndex = ((pMonth - fyStart + 12) % 12) + 1;
      const declaration = taxRegimes.length
        ? await prisma.taxDeclaration.findFirst({ where: { tenantId, employeeId: employee.id, fiscalYear: fyLabel } })
        : null;
      const activeRegime =
        (declaration && taxRegimes.find((rg) => rg.code === declaration.regime)) ||
        (taxRegimes.length > 0 ? taxRegimes[0] : null);
      if (activeRegime && Array.isArray(activeRegime.slabs) && activeRegime.slabs.length > 0) {
        const allowed = new Set(activeRegime.allowedExemptions ?? []);
        const items = Array.isArray(declaration?.items) ? declaration.items : [];
        const exemptions = items
          .filter((it) => it.proofStatus === 'VERIFIED' && it.code !== 'STD_DEDUCTION' && allowed.has(it.code))
          .reduce((s, it) => s + Number(it.amount ?? 0), 0);
        const annualTaxable = Math.max(0, annualTaxableStructural - exemptions);
        const taxCurrency = sal.currency ?? payGroup.currency ?? 'INR';
        const annualTax = computeIncomeTaxFromRegime(annualTaxable, activeRegime, taxCurrency);
        // H2 — YTD true-up: walk months 1..monthIndex, spreading the remaining tax over the
        // periods that are left (FE withholdingForMonth). monthIndex=1 → round(annualTax/12).
        let ytd = 0, monthlyTax = 0;
        for (let k = 1; k <= monthIndex; k++) {
          const remaining = Math.max(0, annualTax - ytd);
          monthlyTax = Math.round(remaining / Math.max(1, 12 - (k - 1)));
          if (k < monthIndex) ytd += monthlyTax;
        }
        const cycleTaxFloor = Math.floor(monthlyTax / ppm);
        const cycleTax = lastCycle ? monthlyTax - cycleTaxFloor * (ppm - 1) : cycleTaxFloor;
        if (cycleTax > 0) {
          const taxCode = activeRegime.taxCode ?? 'WITHHOLDING_TAX';
          const taxName = activeRegime.taxName ?? activeRegime.name ?? 'Withholding Tax';
          const idx = deductionsArr.findIndex((d) => d.code === taxCode);
          if (idx >= 0) deductionsArr[idx].amount = cycleTax;
          else deductionsArr.push({ code: taxCode, name: taxName, amount: cycleTax, taxable: false });
        }
      }

      // ── H5 Garnishments (FE parity: payroll-engine.ts applyGarnishments) ───────────────
      // After statutory + tax deductions, before voluntary (loans). disposable = gross − the
      // deductions accrued so far. Orders run in priority order; each withholds a flat amount
      // or % of the ORIGINAL disposable, capped, never breaching its protectedEarningsFloor.
      // Backend garnishment money is MAJOR units (Decimal) — no minor conversion. Additive:
      // employees with no active order are byte-identical to before.
      // Garnishment effectiveFrom/effectiveTo are STRING (YYYY-MM-DD) columns — compare with
      // string dates, not the Date objects periodStart/periodEnd (Prisma rejects Date here).
      const periodStartStr = periodStart instanceof Date ? periodStart.toISOString().slice(0, 10) : String(periodStart);
      const periodEndStr = periodEnd instanceof Date ? periodEnd.toISOString().slice(0, 10) : String(periodEnd);
      const garnishments = await prisma.garnishment.findMany({
        where: {
          tenantId, employeeId: employee.id,
          effectiveFrom: { lte: periodEndStr },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStartStr } }],
        },
      });
      if (garnishments.length > 0) {
        const statutorySoFar = deductionsArr.reduce((s, d) => s + d.amount, 0);
        const disposable = grossEarnings - statutorySoFar;
        let remaining = disposable;
        for (const o of [...garnishments].sort((a, b) => a.priority - b.priority)) {
          let desired = o.amountKind === 'PERCENT_OF_DISPOSABLE'
            ? r2((disposable * Number(o.amountValue)) / 100)
            : Number(o.amountValue);
          if (o.cap != null) desired = Math.min(desired, Number(o.cap));
          const available = Math.max(0, remaining - Number(o.protectedEarningsFloor ?? 0));
          const actual = Math.max(0, Math.min(desired, available));
          if (actual > 0) {
            deductionsArr.push({ code: `GARN_${o.id}`, name: o.type ? `Garnishment (${o.type})` : 'Garnishment', amount: r2(actual), taxable: false });
            remaining -= actual;
          }
        }
      }

      // ── H6 Loan / advance EMI recovery (FE parity: loanEmiForPeriod) ───────────────────
      // Active loans whose window covers this period; deduct min(emi, balance). Additive.
      const loans = await prisma.employeeLoan.findMany({
        where: {
          tenantId, employeeId: employee.id, status: 'ACTIVE',
          startPeriod: { lte: run.period },
          balance: { gt: 0 },
          OR: [{ endPeriod: null }, { endPeriod: { gte: run.period } }],
        },
      });
      for (const loan of loans) {
        const emi = Math.min(Number(loan.emiAmount), Number(loan.balance));
        if (emi > 0) deductionsArr.push({ code: `EMI_${loan.id}`, name: 'Loan EMI', amount: r2(emi), taxable: false });
      }

      // ── H7 Approved reimbursement claims attach as non-taxable one-time additions ───────
      // + M2 one-time additions/deductions from the run input. Claims/oneTime are MAJOR units.
      const approvedClaims = await prisma.reimbursementClaim.findMany({
        where: { tenantId, employeeId: employee.id, status: 'APPROVED', runId: null },
        include: { category: true },
      });
      const oneTimeAdditions = [
        ...((Array.isArray(runInput?.oneTimeAdditions) ? runInput.oneTimeAdditions : [])
          .map((o) => ({ description: o.description ?? o.label ?? 'Addition', amount: Number(o.amount ?? 0) }))),
        ...approvedClaims.map((c) => ({ description: `${c.category?.label ?? c.category?.code ?? 'Reimbursement'} claim`, amount: Number(c.amount) })),
      ];
      const oneTimeDeductions = (Array.isArray(runInput?.oneTimeDeductions) ? runInput.oneTimeDeductions : [])
        .map((o) => ({ description: o.description ?? o.label ?? 'Deduction', amount: Number(o.amount ?? 0) }));
      // Attach the claims to this run (FE attachApprovedClaimsToRun); mark-paid flips them PAID.
      if (approvedClaims.length > 0) {
        await prisma.reimbursementClaim.updateMany({ where: { id: { in: approvedClaims.map((c) => c.id) } }, data: { runId: id } });
      }
      const oneTimeAddTotal = r2(oneTimeAdditions.reduce((s, o) => s + o.amount, 0));
      const oneTimeDedTotal = r2(oneTimeDeductions.reduce((s, o) => s + o.amount, 0));

      const totalDed = r2(deductionsArr.reduce((s, d) => s + d.amount, 0));
      const netPay = r2(grossEarnings - totalDed + oneTimeAddTotal - oneTimeDedTotal);
      const employerCost = r2(grossEarnings + sumEmployerContributions(employerContributions));

      const currency = sal.currency ?? payGroup.currency;

      await prisma.payslip.create({
        data: {
          tenantId, payrollRunId: id, employeeId: employee.id, period: run.period,
          currency, grossEarnings, totalDeductions: totalDed, netPay,
          workingDays, presentDays, leaveDays, lopDays, status: 'PENDING',
          earningsJson: earningsArr, deductionsJson: deductionsArr,
          employerContributionsJson: employerContributions,
          oneTimeAdditionsJson: oneTimeAdditions, oneTimeDeductionsJson: oneTimeDeductions, generatedAt: new Date(),
        },
      });

      totalGross += grossEarnings; totalDeductions += totalDed; totalNet += netPay;
      totalEmployerCost += employerCost; empCount++;
      const deptName = employee.department?.name || 'Unassigned';
      if (!byDept[deptName]) byDept[deptName] = { departmentName: deptName, employeeCount: 0, totalNet: 0 };
      byDept[deptName].employeeCount++;
      byDept[deptName].totalNet = roundMoney(byDept[deptName].totalNet + netPay, currency);
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
  // H7 — claims attached to this run (on calculate) settle when the run is paid (FE markRunClaimsPaid).
  await prisma.reimbursementClaim.updateMany({ where: { tenantId, runId: id, status: 'APPROVED' }, data: { status: 'PAID', decidedAt: paidDate } });
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
    include: {
      employee: { include: { department: { select: { name: true } } } }, tenant: true,
      payrollRun: { select: { startDate: true, endDate: true } },
    },
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
    include: {
      employee: { include: { department: { select: { name: true } } } }, tenant: true,
      payrollRun: { select: { startDate: true, endDate: true } },
    },
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
      locale: data.locale || 'en-IN', workWeekPattern: data.workWeekPattern || 'MON-FRI',
      workWeekDays: data.workWeekDays ?? null, hoursPerDay: data.hoursPerDay ?? null,
      registrationIds: data.registrationIds || {},
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
  for (const field of ['name', 'country', 'currency', 'fiscalYearStartMonth', 'timezone', 'locale', 'workWeekPattern', 'workWeekDays', 'hoursPerDay', 'registrationIds', 'statutoryPackId', 'payCalendarId', 'active']) {
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
