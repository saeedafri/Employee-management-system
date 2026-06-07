import { evaluateFormula, topologicalSort } from '../../utils/formulaEval.js';

const COMPONENT_INCLUDE = {
  id: true, name: true, code: true, type: true, calculationType: true,
  value: true, basisCode: true, formula: true, taxable: true, active: true,
  displayOrder: true, description: true, createdAt: true, updatedAt: true,
};

function fmtComponent(c) {
  return {
    id: c.id, name: c.name, code: c.code, type: c.type,
    calculationType: c.calculationType,
    value: c.value !== null ? Number(c.value) : null,
    basisCode: c.basisCode ?? null, formula: c.formula ?? null,
    taxable: c.taxable, active: c.active, displayOrder: c.displayOrder,
    description: c.description ?? null, createdAt: c.createdAt, updatedAt: c.updatedAt,
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
          overrideCalculationType: c.overrideCalculationType ?? null,
          overrideValue: c.overrideValue ?? null,
          overrideFormula: c.overrideFormula ?? null,
        })),
      },
    },
    include: PG_INCLUDE,
  });
  return fmtPayGroup(pg);
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
        overrideCalculationType: c.overrideCalculationType ?? null,
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
    const item = { code: comp.code, name: comp.name, type: comp.type, monthlyAmount: amount, taxable: comp.taxable };
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

function fmtPayslipDetail(ps) {
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
    earnings: ps.earningsJson ?? [],
    deductions: ps.deductionsJson ?? [],
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
  return fmtPayslipDetail(ps);
}

// ── Payroll Runs ──────────────────────────────────────────────────────────────

function fmtRun(run, withSummary = false) {
  const base = {
    id: run.id, period: run.period, periodLabel: monthLabel(run.period),
    status: run.status, employeeCount: run.employeeCount,
    totalGross: Number(run.totalGross), totalDeductions: Number(run.totalDeductions),
    totalNet: Number(run.totalNet), currency: run.currency,
    initiatedBy: run.initiatedByUser?.email ?? null,
    approvedBy: run.approvedByUser?.email ?? null,
    processedAt: run.processedAt ?? null,
    approvedAt: run.approvedAt ?? null,
    paidAt: run.paidAt ?? null,
    createdAt: run.createdAt,
  };
  if (withSummary) base.summary = run.summaryJson ?? { byDepartment: [], warnings: [] };
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

export async function createPayrollRun(prisma, tenantId, userId, data) {
  const existing = await prisma.payrollRun.findFirst({
    where: { tenantId, period: data.period, status: { not: 'CANCELLED' } },
  });
  if (existing) {
    const err = new Error(`A payroll run for ${data.period} already exists`);
    err.code = 'RUN_EXISTS'; err.statusCode = 409; throw err;
  }
  const run = await prisma.payrollRun.create({
    data: { tenantId, period: data.period, initiatedById: userId, currency: 'INR' },
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

export async function calculatePayrollRun(prisma, id, tenantId) {
  const run = await prisma.payrollRun.findFirst({ where: { id, tenantId } });
  if (!run) {
    const err = new Error('Payroll run not found'); err.code = 'NOT_FOUND'; err.statusCode = 404; throw err;
  }
  if (run.status !== 'DRAFT') {
    const err = new Error('Run must be in DRAFT status to calculate'); err.code = 'INVALID_STATUS'; err.statusCode = 400; throw err;
  }

  await prisma.payrollRun.update({ where: { id }, data: { status: 'CALCULATING' } });

  const [yearStr, monthStr] = run.period.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const salaries = await prisma.employeeSalary.findMany({
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

  const warnings = [];
  const byDept = {};
  let totalGross = 0, totalDeductions = 0, totalNet = 0, empCount = 0;

  await prisma.payslip.deleteMany({ where: { payrollRunId: id } });

  for (const sal of salaries) {
    const { employee, payGroup } = sal;
    if (employee.employmentStatus !== 'ACTIVE' || employee.deletedAt) continue;

    try {
      const pgComps = payGroup.components.map((pgc) => ({
        id: pgc.component.id, code: pgc.component.code, name: pgc.component.name,
        type: pgc.component.type, taxable: pgc.component.taxable,
        displayOrder: pgc.component.displayOrder,
        calculationType: pgc.overrideCalculationType || pgc.component.calculationType,
        value: pgc.overrideValue !== null && pgc.overrideValue !== undefined
          ? Number(pgc.overrideValue) : (pgc.component.value !== null ? Number(pgc.component.value) : null),
        basisCode: pgc.component.basisCode,
        formula: pgc.overrideFormula || pgc.component.formula,
      }));

      const ctcMonthly = Number(sal.annualCtc) / 12;
      const sorted = topologicalSort(pgComps);
      const computed = { CTC: ctcMonthly };
      const earningsArr = [], deductionsArr = [];

      for (const comp of sorted) {
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

      const grossEarnings = Math.round(earningsArr.reduce((s, e) => s + e.amount, 0) * 100) / 100;
      const totalDed = Math.round(deductionsArr.reduce((s, d) => s + d.amount, 0) * 100) / 100;
      const netPay = Math.round((grossEarnings - totalDed) * 100) / 100;

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
          oneTimeAdditionsJson: [], oneTimeDeductionsJson: [], generatedAt: new Date(),
        },
      });

      totalGross += grossEarnings; totalDeductions += totalDed; totalNet += netPay; empCount++;
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

  await prisma.payrollRun.update({
    where: { id },
    data: {
      status: 'REVIEW', employeeCount: empCount,
      totalGross: Math.round(totalGross * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      totalNet: Math.round(totalNet * 100) / 100,
      processedAt: new Date(),
      summaryJson: { byDepartment: Object.values(byDept), warnings },
    },
  });
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
  return fmtPayslipDetail(ps);
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
  return prisma.legalEntity.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
}

export async function createLegalEntity(prisma, tenantId, data) {
  return prisma.legalEntity.create({
    data: {
      tenantId,
      name: data.name, country: data.country || 'IN', currency: data.currency || 'INR',
      fiscalYearStartMonth: data.fiscalYearStartMonth || 4, timezone: data.timezone || 'Asia/Kolkata',
      locale: data.locale || 'en-IN', registrationIds: data.registrationIds || {},
      statutoryPackId: data.statutoryPackId || null, payCalendarId: data.payCalendarId || null,
    },
  });
}

export async function updateLegalEntity(prisma, id, tenantId, data) {
  const existing = await prisma.legalEntity.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.legalEntity.update({ where: { id }, data });
}

// ── Phase 3: Statutory Packs ──────────────────────────────────────────────────

export async function getStatutoryPacks(prisma, tenantId, country) {
  return prisma.statutoryPack.findMany({
    where: { tenantId, ...(country && { country }) },
    orderBy: [{ country: 'asc' }, { effectiveFrom: 'desc' }],
  });
}

export async function getStatutoryPackById(prisma, id, tenantId) {
  return prisma.statutoryPack.findFirst({ where: { id, tenantId } });
}

export async function createStatutoryPack(prisma, tenantId, data) {
  return prisma.statutoryPack.create({
    data: {
      tenantId, country: data.country, version: data.version,
      effectiveFrom: new Date(data.effectiveFrom),
      effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
      packData: data.packData,
    },
  });
}

export async function updateStatutoryPack(prisma, id, tenantId, data) {
  const existing = await prisma.statutoryPack.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.statutoryPack.update({
    where: { id },
    data: {
      ...(data.effectiveTo !== undefined && { effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null }),
      ...(data.packData && { packData: data.packData }),
    },
  });
}

// ── Phase 3: Pay Calendars ────────────────────────────────────────────────────

export async function getPayCalendars(prisma, tenantId) {
  return prisma.payCalendar.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
}

export async function createPayCalendar(prisma, tenantId, data) {
  return prisma.payCalendar.create({
    data: {
      tenantId, name: data.name, code: data.code.toUpperCase(),
      country: data.country || 'IN', paySchedule: data.paySchedule || 'MONTHLY',
      firstPayDate: data.firstPayDate || null,
    },
  });
}

export async function updatePayCalendar(prisma, id, tenantId, data) {
  const existing = await prisma.payCalendar.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  return prisma.payCalendar.update({ where: { id }, data });
}
