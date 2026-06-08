/**
 * seedPhase3Supplement.mjs — Fill payroll data gaps for production screening
 * Idempotent (all upserts). Safe to re-run.
 * Run: node prisma/seedPhase3Supplement.mjs
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: 'acme-corp-001' } });
  if (!tenant) throw new Error('Tenant acme-corp-001 not found');
  const tenantId = tenant.id;
  console.log(`\n🌱 Phase 3 SUPPLEMENT seed — tenant: ${tenant.name}\n`);

  const emps = await prisma.employee.findMany({
    where: { deletedAt: null },
    take: 10,
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });
  const payGroup = await prisma.payGroup.findFirst({ select: { id: true } });
  const packIN = await prisma.statutoryPack.findFirst({ where: { country: 'IN' }, select: { id: true } });
  const payCalendar = await prisma.payCalendar.findFirst({ select: { id: true } });

  // ── SALARY COMPONENTS: add missing types ───────────────────────────────────
  console.log('── SALARY COMPONENTS ──');
  const missingComps = [
    { id: 'comp-epf-er',  code: 'EPF_ER',    name: 'EPF Employer Contribution',  type: 'EMPLOYER_CONTRIBUTION', calculationType: 'PERCENTAGE', value: 12,    taxable: false, displayOrder: 10 },
    { id: 'comp-esi-er',  code: 'ESI_ER',    name: 'ESI Employer Contribution',  type: 'EMPLOYER_CONTRIBUTION', calculationType: 'PERCENTAGE', value: 3.25,  taxable: false, displayOrder: 11 },
    { id: 'comp-inet',    code: 'INTERNET',  name: 'Internet Reimbursement',     type: 'REIMBURSEMENT',         calculationType: 'FLAT',       value: 1000,  taxable: false, displayOrder: 12 },
    { id: 'comp-fuel',    code: 'FUEL',      name: 'Fuel Reimbursement',         type: 'REIMBURSEMENT',         calculationType: 'FLAT',       value: 2000,  taxable: false, displayOrder: 13 },
    { id: 'comp-pbonus',  code: 'PERF_BONUS',name: 'Performance Bonus',          type: 'VARIABLE',              calculationType: 'PERCENTAGE', value: 10,    taxable: true,  displayOrder: 14 },
    { id: 'comp-rbonus',  code: 'REFERRAL',  name: 'Referral Bonus',             type: 'VARIABLE',              calculationType: 'FLAT',       value: 25000, taxable: true,  displayOrder: 15 },
  ];
  for (const c of missingComps) {
    await prisma.salaryComponent.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, tenantId, active: true, description: c.name },
    });
  }
  console.log(`  ✓ ${missingComps.length} additional components (EMPLOYER_CONTRIBUTION × 2, REIMBURSEMENT × 2, VARIABLE × 2)`);

  // ── US STATUTORY PACK ────────────────────────────────────────────────────
  console.log('── US STATUTORY PACK & LEGAL ENTITY ──');
  await prisma.statutoryPack.upsert({
    where: { id: 'pack-us-2026' },
    update: {},
    create: {
      id: 'pack-us-2026',
      tenantId,
      country: 'US',
      version: '2026.1',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      packData: {
        rounding: 'nearest_dollar',
        proration: 'calendar_days',
        taxRegimes: [
          { code: 'FED', name: 'Federal Income Tax', rate: 22, brackets: true },
          { code: 'FICA_SS', name: 'Social Security', rate: 6.2, wageBase: 168600 },
          { code: 'FICA_MC', name: 'Medicare', rate: 1.45 },
        ],
        contributionSchemes: [
          { code: '401K', name: '401(k) Employee', rate: 4, maxAnnual: 23000, employer: { code: '401K_ER', name: '401(k) Employer Match', rate: 3 } },
        ],
        localTaxes: [],
        statutoryComponents: [
          { code: 'FWT', name: 'Federal Withholding Tax', type: 'DEDUCTION' },
          { code: 'SS_EE', name: 'Social Security (EE)', type: 'DEDUCTION' },
          { code: 'MC_EE', name: 'Medicare (EE)', type: 'DEDUCTION' },
          { code: 'SS_ER', name: 'Social Security (ER)', type: 'EMPLOYER_CONTRIBUTION' },
          { code: 'MC_ER', name: 'Medicare (ER)', type: 'EMPLOYER_CONTRIBUTION' },
        ],
        minimumWages: [{ state: 'CA', amount: 16, currency: 'USD' }, { state: 'NY', amount: 15, currency: 'USD' }],
      },
    },
  });
  console.log('  ✓ US statutory pack 2026.1');

  await prisma.legalEntity.upsert({
    where: { id: 'le-acme-us' },
    update: {},
    create: {
      id: 'le-acme-us',
      tenantId,
      name: 'Acme Technologies Inc',
      country: 'US',
      currency: 'USD',
      fiscalYearStartMonth: 1,
      timezone: 'America/New_York',
      locale: 'en-US',
      registrationIds: { ein: '12-3456789', suta: 'CA-987654' },
      statutoryPackId: 'pack-us-2026',
      payCalendarId: payCalendar?.id ?? null,
    },
  });
  console.log('  ✓ US legal entity (Acme Technologies Inc)');

  // ── US PAY CALENDAR ───────────────────────────────────────────────────────
  await prisma.payCalendar.upsert({
    where: { id: 'cal-us-biweekly' },
    update: {},
    create: {
      id: 'cal-us-biweekly',
      tenantId,
      name: 'US Bi-Weekly Payroll',
      code: 'US_BIWEEKLY',
      country: 'US',
      paySchedule: 'BIWEEKLY',
      firstPayDate: '2026-01-10',
    },
  });
  console.log('  ✓ US bi-weekly pay calendar');

  // ── EMPLOYEE LOANS ────────────────────────────────────────────────────────
  console.log('── EMPLOYEE LOANS ──');
  const loanDefs = [
    { id: 'loan-001', ei: 0, amount: 100000, balance: 65000, emiAmount: 5000, startPeriod: '2025-10', endPeriod: '2026-09', status: 'ACTIVE' },
    { id: 'loan-002', ei: 1, amount: 50000,  balance: 0,     emiAmount: 5000, startPeriod: '2025-05', endPeriod: '2026-04', status: 'CLOSED' },
    { id: 'loan-003', ei: 3, amount: 200000, balance: 180000,emiAmount: 10000,startPeriod: '2026-04', endPeriod: '2027-09', status: 'ACTIVE' },
  ];
  for (const l of loanDefs) {
    const emp = emps[l.ei];
    if (!emp) continue;
    await prisma.employeeLoan.upsert({
      where: { id: l.id },
      update: {},
      create: {
        id: l.id, tenantId,
        employeeId: emp.id,
        amount: l.amount, balance: l.balance, emiAmount: l.emiAmount,
        startPeriod: l.startPeriod, endPeriod: l.endPeriod, status: l.status,
        schedule: { frequency: 'MONTHLY', deductFromPayroll: true },
      },
    });
  }
  console.log(`  ✓ ${loanDefs.length} employee loans (ACTIVE × 2, CLOSED × 1)`);

  // ── TAX DECLARATIONS ──────────────────────────────────────────────────────
  console.log('── TAX DECLARATIONS ──');
  const taxDefs = [
    { id: 'td-001', ei: 0, fiscalYear: '2025-26', regime: 'NEW',
      items: [{ section: '80C', description: 'PPF Contribution', amount: 150000 }, { section: '80D', description: 'Health Insurance', amount: 25000 }] },
    { id: 'td-002', ei: 1, fiscalYear: '2025-26', regime: 'OLD',
      items: [{ section: '80C', description: 'ELSS Mutual Fund', amount: 100000 }, { section: 'HRA', description: 'House Rent Allowance', amount: 180000 }] },
    { id: 'td-003', ei: 3, fiscalYear: '2025-26', regime: 'NEW',
      items: [{ section: '80C', description: 'LIC Premium', amount: 50000 }] },
    { id: 'td-004', ei: 4, fiscalYear: '2025-26', regime: 'NEW', items: [] },
  ];
  for (const t of taxDefs) {
    const emp = emps[t.ei];
    if (!emp) continue;
    await prisma.taxDeclaration.upsert({
      where: { id: t.id },
      update: {},
      create: { id: t.id, tenantId, employeeId: emp.id, fiscalYear: t.fiscalYear, regime: t.regime, items: t.items },
    });
  }
  console.log(`  ✓ ${taxDefs.length} tax declarations (NEW × 3, OLD × 1)`);

  // ── ADDITIONAL SALARY CONFIGS with bank data ──────────────────────────────
  console.log('── ADDITIONAL SALARY CONFIGS ──');
  if (payGroup) {
    const existingEmps = await prisma.employeeSalary.findMany({ select: { employeeId: true } });
    const existingSet = new Set(existingEmps.map(e => e.employeeId));
    const salaryDefs = [
      { ei: 4, ctc: 1200000, bank: 'HDFC', acct: '10184729810', ifsc: 'HDFC0004578', acctName: 'Sakshi Singh' },
      { ei: 5, ctc: 1800000, bank: 'ICICI', acct: '601101829765', ifsc: 'ICIC0000234', acctName: 'Vikram Patel' },
      { ei: 6, ctc: 900000,  bank: 'SBI',   acct: '38291847502', ifsc: 'SBIN0001234', acctName: 'Neha Kumar' },
    ];
    for (const s of salaryDefs) {
      const emp = emps[s.ei];
      if (!emp || existingSet.has(emp.id)) continue;
      await prisma.employeeSalary.create({
        data: {
          tenantId,
          employeeId: emp.id,
          payGroupId: payGroup.id,
          annualCtc: s.ctc,
          effectiveFrom: new Date('2026-01-01'),
          bankName: s.bank,
          bankAccountNumber: s.acct,
          bankIfscCode: s.ifsc,
          bankAccountName: s.acctName,
        },
      });
    }
    console.log('  ✓ Additional salary configs with bank account data');
  }

  // ── DRAFT PAYROLL RUN ────────────────────────────────────────────────────
  console.log('── PAYROLL RUNS ──');
  await prisma.payrollRun.upsert({
    where: { id: 'run-draft-2026-07' },
    update: {},
    create: {
      id: 'run-draft-2026-07',
      tenantId,
      period: '2026-07',
      status: 'DRAFT',
      employeeCount: 0,
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0,
      currency: 'INR',
    },
  });
  console.log('  ✓ DRAFT payroll run (2026-07)');

  // Ensure one payslip with null documentUrl exists for graceful-handling test
  const empWithPayslip = emps[2]; // HR Admin
  // Payslip with null documentUrl: use a different employee + the DRAFT run
  const draftRun = await prisma.payrollRun.findFirst({ where: { status: 'DRAFT' } });
  if (draftRun && emps[7]) {
    const existing = await prisma.payslip.findFirst({ where: { id: 'payslip-null-doc' } });
    if (!existing) {
      await prisma.payslip.create({
        data: {
          id: 'payslip-null-doc',
          tenantId,
          employeeId: emps[7].id,
          payrollRunId: draftRun.id,
          period: draftRun.period,
          status: 'PENDING',
          grossEarnings: 85000,
          totalDeductions: 12000,
          netPay: 73000,
          currency: 'INR',
          earningsJson: [{ code: 'BASIC', name: 'Basic Salary', type: 'EARNING', amount: 50000, monthlyAmount: 50000, taxable: true }],
          deductionsJson: [{ code: 'PF', name: 'PF', type: 'DEDUCTION', amount: 12000, monthlyAmount: 12000, taxable: false }],
          documentUrl: null,
        },
      });
      console.log('  ✓ Payslip with null documentUrl (graceful-handling test)');
    } else {
      console.log('  ✓ Null-doc payslip already exists');
    }
  }

  console.log('\n✅ Phase 3 SUPPLEMENT seed complete!');
  console.log('   Components: +6 (EMPLOYER_CONTRIBUTION×2, REIMBURSEMENT×2, VARIABLE×2)');
  console.log('   Statutory:  US pack 2026.1 + US legal entity + US pay calendar');
  console.log('   Loans:      3 (ACTIVE×2, CLOSED×1)');
  console.log('   TaxDecls:   4 (NEW×3, OLD×1)');
  console.log('   Runs:       +1 DRAFT (2026-07)');
  console.log('   Payslips:   +1 null documentUrl for graceful-handling test');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
