/**
 * seedPayrollPhase3.js — Seeds Phase 3 payroll entities:
 *   ReimbursementCategory, ReimbursementClaim, Garnishment,
 *   PayrollEvent, PayslipTemplate
 * Safe to re-run (upserts/skips existing).
 * Run: node prisma/seedPayrollPhase3.js
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: 'acme-corp-001' } });
  if (!tenant) throw new Error('Tenant acme-corp-001 not found');
  const tenantId = tenant.id;
  console.log(`\n🌱 Payroll Phase 3 seed — tenant: ${tenant.name}\n`);

  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    take: 10,
    select: { id: true, firstName: true, lastName: true },
  });
  if (employees.length === 0) throw new Error('No employees found — run base seed first');

  // ── PayslipTemplate ──────────────────────────────────────────────────────
  const existing = await prisma.payslipTemplate.findUnique({ where: { tenantId } });
  if (!existing) {
    await prisma.payslipTemplate.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: 'Acme Standard Payslip',
        locale: 'en-IN',
        logoUrl: null,
        sections: [
          { id: 'earnings', label: 'Earnings', visible: true, order: 1 },
          { id: 'deductions', label: 'Deductions', visible: true, order: 2 },
          { id: 'employer', label: 'Employer Contributions', visible: true, order: 3 },
          { id: 'reimbursements', label: 'Reimbursements', visible: true, order: 4 },
        ],
        fields: [
          { key: 'employeeCode', label: 'Employee ID', visible: true },
          { key: 'department', label: 'Department', visible: true },
          { key: 'designation', label: 'Designation', visible: true },
          { key: 'bankAccount', label: 'Bank Account', visible: false },
          { key: 'pan', label: 'PAN', visible: false },
          { key: 'uan', label: 'UAN', visible: true },
        ],
      },
    });
    console.log('  ✓ PayslipTemplate created');
  } else {
    console.log('  ✓ PayslipTemplate already exists');
  }

  // ── ReimbursementCategories ──────────────────────────────────────────────
  const catDefs = [
    { id: 'rcat-001', code: 'TRAVEL', label: 'Travel & Conveyance', monthlyCap: 5000 },
    { id: 'rcat-002', code: 'FOOD', label: 'Food & Meals', monthlyCap: 3000 },
    { id: 'rcat-003', code: 'MEDICAL', label: 'Medical', monthlyCap: 15000 },
    { id: 'rcat-004', code: 'INTERNET', label: 'Internet & Phone', monthlyCap: 1500 },
    { id: 'rcat-005', code: 'EQUIPMENT', label: 'Equipment & Supplies', monthlyCap: 10000 },
    { id: 'rcat-006', code: 'BOOKS', label: 'Books & Courses', monthlyCap: 5000 },
  ];

  for (const c of catDefs) {
    await prisma.reimbursementCategory.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      update: { label: c.label, monthlyCap: c.monthlyCap },
      create: { ...c, tenantId },
    });
  }
  console.log(`  ✓ ${catDefs.length} reimbursement categories`);

  // ── ReimbursementClaims ──────────────────────────────────────────────────
  const claimDefs = [
    { emp: 0, cat: 'rcat-001', amount: 2500, desc: 'Taxi to client office', status: 'APPROVED' },
    { emp: 0, cat: 'rcat-002', amount: 1200, desc: 'Team lunch', status: 'APPROVED' },
    { emp: 1, cat: 'rcat-003', amount: 3500, desc: 'Pharmacy bills', status: 'SUBMITTED' },
    { emp: 1, cat: 'rcat-004', amount: 1500, desc: 'Internet bill June', status: 'SUBMITTED' },
    { emp: 2, cat: 'rcat-005', amount: 8000, desc: 'Keyboard + mouse', status: 'APPROVED' },
    { emp: 2, cat: 'rcat-006', amount: 2999, desc: 'Udemy annual subscription', status: 'SUBMITTED' },
    { emp: 3, cat: 'rcat-001', amount: 4500, desc: 'Flight Bangalore–Pune', status: 'REJECTED' },
    { emp: 3, cat: 'rcat-002', amount: 800, desc: 'Working weekend snacks', status: 'APPROVED' },
    { emp: 4, cat: 'rcat-003', amount: 12000, desc: 'Dental treatment', status: 'SUBMITTED' },
    { emp: 4, cat: 'rcat-004', amount: 1500, desc: 'Phone bill reimbursement', status: 'APPROVED' },
  ];

  let claimCount = 0;
  for (const c of claimDefs) {
    const emp = employees[c.emp];
    if (!emp) continue;
    const existingClaim = await prisma.reimbursementClaim.findFirst({
      where: { tenantId, employeeId: emp.id, description: c.desc },
    });
    if (existingClaim) continue;
    await prisma.reimbursementClaim.create({
      data: {
        id: randomUUID(),
        tenantId,
        employeeId: emp.id,
        categoryId: c.cat,
        amount: c.amount,
        currency: 'INR',
        description: c.desc,
        status: c.status,
        submittedAt: new Date(Date.now() - Math.random() * 30 * 86400 * 1000),
        decidedAt: c.status !== 'SUBMITTED' ? new Date() : null,
      },
    });
    claimCount++;
  }
  console.log(`  ✓ ${claimCount} reimbursement claims`);

  // ── Garnishments ─────────────────────────────────────────────────────────
  const garnDefs = [
    { emp: 0, type: 'COURT_ORDER', amountKind: 'FLAT', amountValue: 5000, reference: 'COURT/2024/001', effectiveFrom: '2024-01-01' },
    { emp: 1, type: 'LOAN_RECOVERY', amountKind: 'PERCENTAGE', amountValue: 10, reference: 'LOAN-2023-456', effectiveFrom: '2023-06-01', effectiveTo: '2026-12-31' },
    { emp: 2, type: 'TAX_LEVY', amountKind: 'FLAT', amountValue: 3000, reference: 'TAX-LEVY-2025', effectiveFrom: '2025-04-01' },
  ];

  let garnCount = 0;
  for (const g of garnDefs) {
    const emp = employees[g.emp];
    if (!emp) continue;
    const existing = await prisma.garnishment.findFirst({ where: { tenantId, employeeId: emp.id, reference: g.reference } });
    if (existing) continue;
    const { emp: _emp, ...gData } = g;
    await prisma.garnishment.create({
      data: { id: randomUUID(), tenantId, employeeId: emp.id, priority: 1, protectedEarningsFloor: 20000, ...gData },
    });
    garnCount++;
  }
  console.log(`  ✓ ${garnCount} garnishments`);

  // ── PayrollEvents ────────────────────────────────────────────────────────
  const runs = await prisma.payrollRun.findMany({ where: { tenantId }, take: 3, orderBy: { createdAt: 'desc' } });
  let eventCount = 0;
  for (const run of runs) {
    const existingEvent = await prisma.payrollEvent.findFirst({ where: { tenantId, runId: run.id } });
    if (existingEvent) continue;
    const eventsForRun = [
      { type: 'payroll.run.created', summary: `Run ${run.period} created` },
      { type: 'payroll.run.calculated', summary: `Calculations completed for ${run.period}` },
    ];
    if (run.status === 'APPROVED' || run.status === 'PAID') {
      eventsForRun.push({ type: 'payroll.run.approved', summary: `Run ${run.period} approved` });
    }
    if (run.status === 'PAID') {
      eventsForRun.push({ type: 'payroll.run.paid', summary: `Run ${run.period} marked as paid` });
    }
    for (const ev of eventsForRun) {
      await prisma.payrollEvent.create({
        data: { id: randomUUID(), tenantId, runId: run.id, ...ev },
      });
      eventCount++;
    }
  }
  console.log(`  ✓ ${eventCount} payroll events`);

  console.log('\n✅ Payroll Phase 3 seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
