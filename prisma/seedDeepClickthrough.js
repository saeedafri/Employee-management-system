/**
 * seedDeepClickthrough.js — Phase 3 deep click-through test data.
 * Creates: DRAFT/REVIEW/APPROVED payroll runs, payment batches, rich payslips,
 *          payroll events, REJECTED timesheets, more timesheet variants.
 * Safe to re-run (all upserts/skips).
 * Run: node prisma/seedDeepClickthrough.js
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
dotenv.config();

const prisma = new PrismaClient();
const TENANT_KEY = 'acme-corp-001';

function id() { return randomUUID(); }

function weekStart(offsetWeeks = 0) {
  const d = new Date('2026-06-09'); // fixed reference date
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
}

function weekEnd(monday) {
  const d = new Date(monday + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: TENANT_KEY } });
  if (!tenant) throw new Error(`Tenant '${TENANT_KEY}' not found`);
  const tenantId = tenant.id;
  console.log(`\n🌱 Deep clickthrough seed — tenant: ${tenant.name} (${tenantId})\n`);

  // ── Fetch resources ─────────────────────────────────────────────────────────
  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, employeeCode: true, departmentId: true },
    take: 20,
  });
  if (employees.length === 0) throw new Error('No employees — run base seed first');

  const payGroup = await prisma.payGroup.findFirst({ where: { tenantId } });
  if (!payGroup) throw new Error('No pay group — run payroll seed first');

  // ── Ensure at least 8 employees have salary config ──────────────────────────
  const withSalary = await prisma.employeeSalary.findMany({ where: { tenantId, effectiveTo: null } });
  const salaryEmpIds = new Set(withSalary.map(s => s.employeeId));
  const empsNeedSalary = employees.filter(e => !salaryEmpIds.has(e.id)).slice(0, 7);
  const ctcValues = [720000, 960000, 840000, 1080000, 660000, 900000, 780000];
  for (let i = 0; i < empsNeedSalary.length; i++) {
    const emp = empsNeedSalary[i];
    const existing = await prisma.employeeSalary.findFirst({ where: { tenantId, employeeId: emp.id, effectiveTo: null } });
    if (!existing) {
      await prisma.employeeSalary.create({
        data: {
          id: id(), tenantId, employeeId: emp.id, payGroupId: payGroup.id,
          annualCtc: ctcValues[i] || 720000, effectiveFrom: new Date('2026-01-01'),
          bankAccountName: `${emp.firstName} ${emp.lastName}`,
          bankAccountNumber: `${1000000000 + i}`,
          bankIfscCode: 'SBIN0000001', bankName: 'State Bank of India',
        },
      });
    }
  }
  console.log(`  ✓ Ensured salary config for ${empsNeedSalary.length} more employees`);

  // ── Fetch all employees with salary for payroll runs ─────────────────────────
  const salaryedEmps = await prisma.employeeSalary.findMany({
    where: { tenantId, effectiveTo: null },
    include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    distinct: ['employeeId'],
    take: 10,
  });
  const payrollEmps = salaryedEmps.map(s => ({ empId: s.employeeId, empCode: s.employee?.employeeCode || 'E001', name: `${s.employee?.firstName} ${s.employee?.lastName}`.trim(), ctc: Number(s.annualCtc) }));
  console.log(`  ✓ ${payrollEmps.length} employees in payroll roster`);

  // Helpers
  function buildPayslipLines(ctc) {
    const monthly = ctc / 12;
    const basic = Math.round(monthly * 0.5);
    const hra = Math.round(monthly * 0.2);
    const special = Math.round(monthly * 0.3);
    const pf = Math.round(basic * 0.12);
    const esi = Math.round(monthly * 0.0075);
    const gross = basic + hra + special;
    const deductions = pf + esi;
    const net = gross - deductions;
    return {
      gross,
      deductions,
      net,
      earningsJson: [
        { code: 'BASIC', name: 'Basic Salary', amount: basic, monthlyAmount: basic },
        { code: 'HRA', name: 'HRA', amount: hra, monthlyAmount: hra },
        { code: 'SPECIAL', name: 'Special Allowance', amount: special, monthlyAmount: special },
      ],
      deductionsJson: [
        { code: 'PF_EMPLOYEE', name: "PF (Employee's Share)", amount: pf, monthlyAmount: pf },
        { code: 'ESI', name: 'ESI', amount: esi, monthlyAmount: esi },
      ],
    };
  }

  function buildPayslipData(emp, period, runId, status = 'PAID') {
    const lines = buildPayslipLines(emp.ctc);
    return {
      id: id(), tenantId, payrollRunId: runId, employeeId: emp.empId, period,
      status, grossEarnings: lines.gross, totalDeductions: lines.deductions, netPay: lines.net,
      earningsJson: lines.earningsJson, deductionsJson: lines.deductionsJson,
    };
  }

  // ── Get existing PAID runs ───────────────────────────────────────────────────
  const existingRuns = await prisma.payrollRun.findMany({ where: { tenantId }, orderBy: { period: 'desc' } });
  console.log(`  Found ${existingRuns.length} existing runs: ${existingRuns.map(r => `${r.period}(${r.status})`).join(', ')}`);

  // ── Enrich existing PAID runs with payslips + payment batches ───────────────
  for (const run of existingRuns.filter(r => r.status === 'PAID')) {
    // Enrich payslips
    const existingPayslips = await prisma.payslip.count({ where: { payrollRunId: run.id } });
    if (existingPayslips < payrollEmps.length) {
      const existingEmpIds = new Set((await prisma.payslip.findMany({ where: { payrollRunId: run.id }, select: { employeeId: true } })).map(p => p.employeeId));
      const toCreate = payrollEmps.filter(e => !existingEmpIds.has(e.empId));
      for (const emp of toCreate) {
        await prisma.payslip.create({ data: buildPayslipData(emp, run.period, run.id, 'PAID') });
      }
      console.log(`  ✓ Added ${toCreate.length} payslips to ${run.period} PAID run`);
    }

    // Update existing payslips with earnings/deduction lines
    const payslipsNeedingUpdate = await prisma.payslip.findMany({
      where: { payrollRunId: run.id, earningsJson: { equals: [] } },
      take: 20,
    });
    for (const ps of payslipsNeedingUpdate) {
      const emp = payrollEmps.find(e => e.empId === ps.employeeId);
      if (!emp) continue;
      const lines = buildPayslipLines(emp.ctc);
      await prisma.payslip.update({
        where: { id: ps.id },
        data: { earningsJson: lines.earningsJson, deductionsJson: lines.deductionsJson },
      });
    }

    // Create payment batch if missing
    const batchExists = await prisma.paymentBatch.findFirst({ where: { runId: run.id, tenantId } });
    if (!batchExists) {
      const allPayslips = await prisma.payslip.findMany({ where: { payrollRunId: run.id, tenantId } });
      const lines = allPayslips.map(p => ({
        payslipId: p.id, employeeId: p.employeeId,
        employeeCode: payrollEmps.find(e => e.empId === p.employeeId)?.empCode || 'E001',
        name: payrollEmps.find(e => e.empId === p.employeeId)?.name || 'Employee',
        netPay: Number(p.netPay), accountNumber: 'XXXX9876', ifsc: 'SBIN0000001',
        status: 'PAID',
      }));
      await prisma.paymentBatch.create({
        data: {
          id: id(), tenantId, runId: run.id,
          count: lines.length,
          totalAmount: lines.reduce((s, l) => s + l.netPay, 0),
          currency: run.currency || 'INR',
          status: 'COMPLETED',
          linesJson: lines,
          reconciledAt: new Date(run.period + '-28T10:00:00Z'),
        },
      });
      console.log(`  ✓ Payment batch created for ${run.period} PAID run`);
    }

    // Add payroll events if missing
    const eventsExist = await prisma.payrollEvent.count({ where: { runId: run.id, tenantId } });
    if (eventsExist === 0) {
      const baseDate = new Date(run.period + '-01T09:00:00Z');
      const events = [
        { type: 'run.created', summary: `${run.period} payroll run initiated` },
        { type: 'run.calculated', summary: `Calculation completed — ${payrollEmps.length} employees processed` },
        { type: 'run.approved', summary: 'Payroll approved by HR Admin' },
        { type: 'payslip.published', summary: 'Payslips published to employees' },
        { type: 'run.paid', summary: 'Disbursement completed via NACH batch' },
      ];
      for (let i = 0; i < events.length; i++) {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i * 2);
        await prisma.payrollEvent.create({
          data: { id: id(), tenantId, runId: run.id, type: events[i].type, summary: events[i].summary, createdAt: d },
        });
      }
      console.log(`  ✓ Added payroll events for ${run.period} PAID run`);
    }
  }

  // ── Create APPROVED run (2026-01) ────────────────────────────────────────────
  const approvedRunId = 'seed-approved-run-2026-01';
  const approvedRunExists = await prisma.payrollRun.findUnique({ where: { id: approvedRunId } });
  if (!approvedRunExists) {
    const grossTotal = payrollEmps.reduce((s, e) => s + Math.round(e.ctc / 12), 0);
    const run = await prisma.payrollRun.create({
      data: {
        id: approvedRunId, tenantId, period: '2026-01', status: 'APPROVED',
        employeeCount: payrollEmps.length,
        totalGross: grossTotal,
        totalDeductions: Math.round(grossTotal * 0.12),
        totalNet: grossTotal - Math.round(grossTotal * 0.12),
        employerCost: Math.round(grossTotal * 1.13),
        currency: 'INR', type: 'REGULAR',
        published: false, publishedAt: null,
        approvedAt: new Date('2026-01-28T14:00:00Z'),
        approvalsJson: [{ level: 1, status: 'APPROVED', approvedBy: 'hr@acme.test', approvedAt: '2026-01-28T14:00:00Z' }],
        summaryJson: { byDepartment: [], warnings: [] },
        auditJson: {},
      },
    });
    for (const emp of payrollEmps) {
      await prisma.payslip.create({ data: buildPayslipData(emp, '2026-01', run.id, 'PENDING') });
    }
    const payrollRunApprovedEvents = [
      { type: 'run.created', summary: 'January 2026 payroll run initiated', d: new Date('2026-01-20T09:00:00Z') },
      { type: 'run.calculated', summary: 'Calculation completed', d: new Date('2026-01-22T11:00:00Z') },
      { type: 'run.approved', summary: 'Approved by HR Admin — ready for disbursement', d: new Date('2026-01-28T14:00:00Z') },
    ];
    for (const evt of payrollRunApprovedEvents) {
      await prisma.payrollEvent.create({ data: { id: id(), tenantId, runId: approvedRunId, type: evt.type, summary: evt.summary, createdAt: evt.d } });
    }
    console.log('  ✓ Created APPROVED run (2026-01)');
  } else {
    console.log('  ✓ APPROVED run (2026-01) already exists');
  }

  // ── Create REVIEW run (2026-02) ──────────────────────────────────────────────
  const reviewRunId = 'seed-review-run-2026-02';
  const reviewRunExists = await prisma.payrollRun.findUnique({ where: { id: reviewRunId } });
  if (!reviewRunExists) {
    const grossTotal = payrollEmps.reduce((s, e) => s + Math.round(e.ctc / 12), 0);
    const run = await prisma.payrollRun.create({
      data: {
        id: reviewRunId, tenantId, period: '2026-02', status: 'REVIEW',
        employeeCount: payrollEmps.length,
        totalGross: grossTotal,
        totalDeductions: Math.round(grossTotal * 0.12),
        totalNet: grossTotal - Math.round(grossTotal * 0.12),
        employerCost: Math.round(grossTotal * 1.13),
        currency: 'INR', type: 'REGULAR',
        published: false, publishedAt: null, approvedAt: null,
        approvalsJson: [],
        summaryJson: { byDepartment: [], warnings: [{ type: 'variance', message: 'Priya Kumar — 23% increase vs last month', employeeId: payrollEmps[0]?.empId }] },
        auditJson: {},
      },
    });
    for (const emp of payrollEmps) {
      await prisma.payslip.create({ data: buildPayslipData(emp, '2026-02', run.id, 'PENDING') });
    }
    // Add one HELD payslip for testing
    if (payrollEmps.length > 1) {
      const heldPayslip = await prisma.payslip.findFirst({ where: { payrollRunId: run.id, employeeId: payrollEmps[1].empId } });
      if (heldPayslip) {
        await prisma.payslip.update({ where: { id: heldPayslip.id }, data: { status: 'HELD', heldAt: new Date(), holdReason: 'Salary revision pending verification' } });
      }
    }
    await prisma.payrollEvent.create({ data: { id: id(), tenantId, runId: reviewRunId, type: 'run.created', summary: 'February 2026 payroll run initiated', createdAt: new Date('2026-02-18T09:00:00Z') } });
    await prisma.payrollEvent.create({ data: { id: id(), tenantId, runId: reviewRunId, type: 'run.calculated', summary: `Calculation complete — ${payrollEmps.length} employees, 1 variance warning`, createdAt: new Date('2026-02-20T11:00:00Z') } });
    console.log('  ✓ Created REVIEW run (2026-02)');
  } else {
    console.log('  ✓ REVIEW run (2026-02) already exists');
  }

  // ── Create DRAFT run (2026-06) ────────────────────────────────────────────────
  const draftRunId = 'seed-draft-run-2026-06';
  const draftRunExists = await prisma.payrollRun.findUnique({ where: { id: draftRunId } });
  if (!draftRunExists) {
    await prisma.payrollRun.create({
      data: {
        id: draftRunId, tenantId, period: '2026-06', status: 'DRAFT',
        employeeCount: payrollEmps.length,
        totalGross: 0, totalDeductions: 0, totalNet: 0,
        employerCost: 0, currency: 'INR', type: 'REGULAR',
        published: false, publishedAt: null, approvedAt: null,
        approvalsJson: [], summaryJson: { byDepartment: [], warnings: [] }, auditJson: {},
      },
    });
    // Add payroll inputs for DRAFT run
    for (const emp of payrollEmps) {
      await prisma.payrollInput.upsert({
        where: { runId_employeeId: { runId: draftRunId, employeeId: emp.empId } },
        update: {},
        create: { id: id(), tenantId, runId: draftRunId, employeeId: emp.empId, lopDays: 0, otHours: 0, variablePay: null },
      });
    }
    await prisma.payrollEvent.create({ data: { id: id(), tenantId, runId: draftRunId, type: 'run.created', summary: 'June 2026 payroll run initiated', createdAt: new Date() } });
    console.log('  ✓ Created DRAFT run (2026-06) with inputs');
  } else {
    console.log('  ✓ DRAFT run (2026-06) already exists');
  }

  // ── Create CANCELLED run (2025-12) ───────────────────────────────────────────
  const cancelRunId = 'seed-cancelled-run-2025-12';
  const cancelRunExists = await prisma.payrollRun.findUnique({ where: { id: cancelRunId } });
  if (!cancelRunExists) {
    await prisma.payrollRun.create({
      data: {
        id: cancelRunId, tenantId, period: '2025-12', status: 'CANCELLED',
        employeeCount: 0, totalGross: 0, totalDeductions: 0, totalNet: 0,
        employerCost: 0, currency: 'INR', type: 'REGULAR',
        published: false, publishedAt: null, approvedAt: null,
        approvalsJson: [], summaryJson: { byDepartment: [], warnings: [] }, auditJson: {},
      },
    });
    await prisma.payrollEvent.create({ data: { id: id(), tenantId, runId: cancelRunId, type: 'run.cancelled', summary: 'Run cancelled — data correction required', createdAt: new Date('2025-12-15T12:00:00Z') } });
    console.log('  ✓ Created CANCELLED run (2025-12)');
  } else {
    console.log('  ✓ CANCELLED run (2025-12) already exists');
  }

  // ── Update run totalNet from payslips ────────────────────────────────────────
  for (const runId of [approvedRunId, reviewRunId]) {
    const agg = await prisma.payslip.aggregate({ where: { payrollRunId: runId }, _sum: { grossEarnings: true, totalDeductions: true, netPay: true } });
    await prisma.payrollRun.update({
      where: { id: runId },
      data: {
        totalGross: Number(agg._sum.grossEarnings || 0),
        totalDeductions: Number(agg._sum.totalDeductions || 0),
        totalNet: Number(agg._sum.netPay || 0),
        employerCost: Math.round(Number(agg._sum.grossEarnings || 0) * 1.13),
      },
    });
  }

  // ── REJECTED timesheets (for Priya — -3 week) ────────────────────────────────
  const priya = employees.find(e => e.firstName === 'Priya') || employees[3];
  if (priya) {
    const rejectedMonday = weekStart(-8); // 8 weeks back
    const rejectedExists = await prisma.timesheet.findFirst({ where: { tenantId, employeeId: priya.id, weekStart: rejectedMonday } });
    if (!rejectedExists) {
      const sheet = await prisma.timesheet.create({
        data: {
          tenantId, employeeId: priya.id,
          weekStart: rejectedMonday, weekEnd: weekEnd(rejectedMonday),
          status: 'REJECTED', totalHours: 32,
          submittedAt: new Date(rejectedMonday + 'T09:00:00Z'),
          decidedBy: 'Manager',
          decidedAt: new Date(rejectedMonday + 'T17:00:00Z'),
          comment: 'Missing entries for Wednesday and Thursday. Please resubmit.',
        },
      });
      await prisma.timeEntry.create({
        data: {
          id: id(), tenantId, timesheetId: sheet.id, employeeId: priya.id,
          projectId: 'prj-seed-1', taskId: 'tsk-seed-1',
          date: addDays(rejectedMonday, 0), hours: 8, billable: true, note: 'Sprint work', source: 'MANUAL',
        },
      });
      await prisma.timeEntry.create({
        data: {
          id: id(), tenantId, timesheetId: sheet.id, employeeId: priya.id,
          projectId: 'prj-seed-2', taskId: 'tsk-seed-4',
          date: addDays(rejectedMonday, 1), hours: 8, billable: false, note: 'Internal', source: 'MANUAL',
        },
      });
      console.log('  ✓ Created REJECTED timesheet for Priya');
    } else {
      console.log('  ✓ REJECTED timesheet for Priya already exists');
    }

    // Resubmittable REJECTED timesheet (week -9, so employee can resubmit)
    const resubMonday = weekStart(-9);
    const resubExists = await prisma.timesheet.findFirst({ where: { tenantId, employeeId: priya.id, weekStart: resubMonday } });
    if (!resubExists) {
      const sheet2 = await prisma.timesheet.create({
        data: {
          tenantId, employeeId: priya.id,
          weekStart: resubMonday, weekEnd: weekEnd(resubMonday),
          status: 'REJECTED', totalHours: 16,
          submittedAt: new Date(resubMonday + 'T09:00:00Z'),
          decidedBy: 'Manager',
          decidedAt: new Date(resubMonday + 'T18:00:00Z'),
          comment: 'Insufficient hours. Minimum 40h required.',
        },
      });
      await prisma.timeEntry.create({
        data: {
          id: id(), tenantId, timesheetId: sheet2.id, employeeId: priya.id,
          projectId: 'prj-seed-3', taskId: 'tsk-seed-6',
          date: addDays(resubMonday, 0), hours: 8, billable: true, note: 'Feature dev', source: 'MANUAL',
        },
      });
      await prisma.timeEntry.create({
        data: {
          id: id(), tenantId, timesheetId: sheet2.id, employeeId: priya.id,
          projectId: 'prj-seed-3', taskId: 'tsk-seed-7',
          date: addDays(resubMonday, 1), hours: 8, billable: true, note: 'Testing', source: 'MANUAL',
        },
      });
      console.log('  ✓ Created second REJECTED timesheet for Priya (resubmittable)');
    }
  }

  // ── Ensure SUBMITTED timesheet exists for Aman's team (for manager approval) ──
  const aman = employees.find(e => e.firstName === 'Aman') || employees[2];
  const dev1 = employees.find(e => e.firstName?.toLowerCase().includes('dev') || e.employeeCode === 'EMP-003') || employees[5];

  for (const emp of [priya, dev1].filter(Boolean)) {
    const submittedMonday = weekStart(-1);
    const submittedExists = await prisma.timesheet.findFirst({ where: { tenantId, employeeId: emp.id, weekStart: submittedMonday } });
    if (!submittedExists) {
      const sheet = await prisma.timesheet.create({
        data: {
          tenantId, employeeId: emp.id,
          weekStart: submittedMonday, weekEnd: weekEnd(submittedMonday),
          status: 'SUBMITTED', totalHours: 40,
          submittedAt: new Date(submittedMonday + 'T17:00:00Z'),
          decidedBy: null, decidedAt: null, comment: null,
        },
      });
      for (let d = 0; d < 5; d++) {
        await prisma.timeEntry.create({
          data: {
            id: id(), tenantId, timesheetId: sheet.id, employeeId: emp.id,
            projectId: 'prj-seed-1', taskId: 'tsk-seed-1',
            date: addDays(submittedMonday, d), hours: 8, billable: true, note: 'Daily work', source: 'MANUAL',
          },
        });
      }
      console.log(`  ✓ Created SUBMITTED timesheet for ${emp.firstName}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const finalRuns = await prisma.payrollRun.groupBy({ by: ['status'], _count: true, where: { tenantId } });
  const finalTimesheets = await prisma.timesheet.groupBy({ by: ['status'], _count: true, where: { tenantId } });
  const finalPayslips = await prisma.payslip.count({ where: { tenantId } });
  const finalBatches = await prisma.paymentBatch.count({ where: { tenantId } });
  const finalEvents = await prisma.payrollEvent.count({ where: { tenantId } });

  console.log('\n📊 Final counts:');
  console.log('  Payroll runs:', JSON.stringify(finalRuns.map(r => `${r.status}(${r._count})`)));
  console.log('  Timesheets:', JSON.stringify(finalTimesheets.map(t => `${t.status}(${t._count})`)));
  console.log('  Payslips:', finalPayslips);
  console.log('  PaymentBatches:', finalBatches);
  console.log('  PayrollEvents:', finalEvents);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
