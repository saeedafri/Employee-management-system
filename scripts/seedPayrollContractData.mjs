#!/usr/bin/env node
/**
 * Idempotent seed for Phase 3 payroll contract fixtures:
 * components (statutory fields), pay calendars, legal entities (active),
 * contractor invoices, opening balances.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_KEY = process.env.SEED_TENANT_KEY || 'acme-corp-001';

async function count(label, fn) {
  const n = await fn();
  console.log(`${label}: ${n}`);
  return n;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { tenantKey: TENANT_KEY } });
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_KEY}`);
  const { id: tenantId } = tenant;

  console.log(`\n=== seedPayrollContractData (${TENANT_KEY}) ===\nBefore:`);
  const before = {
    components: await count('  components', () => prisma.salaryComponent.count({ where: { tenantId } })),
    calendars: await count('  payCalendars', () => prisma.payCalendar.count({ where: { tenantId } })),
    legalEntities: await count('  legalEntities', () => prisma.legalEntity.count({ where: { tenantId } })),
    contractorInvoices: await count('  contractorInvoices', () => prisma.contractorInvoice.count({ where: { tenantId } })),
    openingBalances: await count('  openingBalances', () => prisma.openingBalance.count({ where: { tenantId } })),
  };

  let aman = await prisma.employee.findFirst({
    where: { tenantId, employeeCode: 'E0001' },
    include: { department: true },
  });
  if (!aman) {
    aman = await prisma.employee.findFirst({ where: { tenantId, deletedAt: null } });
  }

  const pack = await prisma.statutoryPack.findFirst({ where: { tenantId, country: 'IN' } });

  // Legal entities — active + inactive
  const activeLe = await prisma.legalEntity.findFirst({ where: { tenantId, name: 'Acme India Pvt Ltd' } });
  if (activeLe) {
    await prisma.legalEntity.update({
      where: { id: activeLe.id },
      data: { active: true, statutoryPackId: pack?.id ?? activeLe.statutoryPackId },
    });
  } else {
    await prisma.legalEntity.create({
      data: {
        tenantId,
        name: 'Acme India Pvt Ltd',
        country: 'IN',
        currency: 'INR',
        fiscalYearStartMonth: 4,
        timezone: 'Asia/Kolkata',
        locale: 'en-IN',
        registrationIds: { cin: 'U12345KA2020PTC123456' },
        statutoryPackId: pack?.id ?? null,
        active: true,
      },
    });
  }

  const inactiveLe = await prisma.legalEntity.findFirst({ where: { tenantId, name: 'Acme Legacy Entity' } });
  if (!inactiveLe) {
    await prisma.legalEntity.create({
      data: {
        tenantId,
        name: 'Acme Legacy Entity',
        country: 'IN',
        currency: 'INR',
        active: false,
      },
    });
  } else {
    await prisma.legalEntity.update({ where: { id: inactiveLe.id }, data: { active: false } });
  }

  const legalEntity = await prisma.legalEntity.findFirst({ where: { tenantId, active: true } });

  // Pay calendars
  const calendarDefs = [
    { code: 'IN-MONTHLY', name: 'India Monthly Payroll', paySchedule: 'MONTHLY', payDay: 30, cutoffDay: 25 },
    { code: 'IN-BIWEEKLY', name: 'India Biweekly Payroll', paySchedule: 'BIWEEKLY', payDay: 15, cutoffDay: 12 },
    { code: 'IN-WEEKLY', name: 'India Weekly Payroll', paySchedule: 'WEEKLY', payDay: 7, cutoffDay: 5 },
  ];
  for (const cal of calendarDefs) {
    await prisma.payCalendar.upsert({
      where: { tenantId_code: { tenantId, code: cal.code } },
      create: {
        tenantId,
        ...cal,
        country: 'IN',
        legalEntityId: legalEntity?.id ?? null,
        periodAnchor: '1',
        payDateRule: 'LAST_WORKING_DAY',
        holidayCalendarId: null,
      },
      update: {
        name: cal.name,
        legalEntityId: legalEntity?.id ?? null,
        periodAnchor: '1',
        payDateRule: 'LAST_WORKING_DAY',
        payDay: cal.payDay,
        cutoffDay: cal.cutoffDay,
      },
    });
  }

  // Components with statutory fields
  const componentDefs = [
    { code: 'BASIC', name: 'Basic', type: 'EARNING', calculationType: 'PERCENTAGE', value: 40, basisCode: 'CTC', statutoryTag: 'PF_WAGE', prorate: true, costCenterRule: 'DEPARTMENT', displayOrder: 1 },
    { code: 'HRA', name: 'HRA', type: 'EARNING', calculationType: 'PERCENTAGE', value: 20, basisCode: 'BASIC', statutoryTag: null, prorate: true, payInPeriods: JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), displayOrder: 2 },
    { code: 'PF_EE', name: 'PF Employee', type: 'DEDUCTION', calculationType: 'PERCENTAGE', value: 12, basisCode: 'PF_WAGE', statutoryTag: 'PF_EMPLOYEE', prorate: false, displayOrder: 10 },
  ];
  for (const c of componentDefs) {
    await prisma.salaryComponent.upsert({
      where: { tenantId_code: { tenantId, code: c.code } },
      create: {
        tenantId,
        taxable: true,
        active: true,
        description: null,
        formula: null,
        glAccountCode: null,
        costCenterRule: c.costCenterRule ?? 'NONE',
        ...c,
      },
      update: {
        statutoryTag: c.statutoryTag ?? null,
        prorate: c.prorate ?? true,
        payInPeriods: c.payInPeriods ?? null,
        costCenterRule: c.costCenterRule ?? 'NONE',
      },
    });
  }

  // Contractor invoice
  const contractor = await prisma.employee.findFirst({
    where: { tenantId, employmentType: 'CONTRACT', deletedAt: null },
  });
  const workerId = contractor?.id ?? aman?.id;
  if (workerId) {
    const existingInv = await prisma.contractorInvoice.findFirst({
      where: { tenantId, workerId, period: '2026-06' },
    });
    if (!existingInv) {
      await prisma.contractorInvoice.create({
        data: {
          tenantId,
          workerId,
          workerName: contractor ? `${contractor.firstName} ${contractor.lastName}` : 'Contractor Name',
          period: '2026-06',
          amount: 100000,
          currency: 'INR',
          withholdingPct: 10,
          netPayable: 90000,
          status: 'SUBMITTED',
        },
      });
    }
  }

  // Opening balance
  if (aman) {
    await prisma.openingBalance.upsert({
      where: { tenantId_employeeId_fiscalYear: { tenantId, employeeId: aman.id, fiscalYear: '2025-26' } },
      create: {
        tenantId,
        employeeId: aman.id,
        fiscalYear: '2025-26',
        grossEarnings: 100000,
        taxableIncome: 90000,
        taxDeducted: 10000,
        totalDeductions: 15000,
        netPay: 85000,
        contributions: { pf: 5000 },
      },
      update: {
        grossEarnings: 100000,
        taxableIncome: 90000,
        taxDeducted: 10000,
        totalDeductions: 15000,
        netPay: 85000,
        contributions: { pf: 5000 },
      },
    });
  }

  console.log('\nAfter:');
  const after = {
    components: await count('  components', () => prisma.salaryComponent.count({ where: { tenantId } })),
    calendars: await count('  payCalendars', () => prisma.payCalendar.count({ where: { tenantId } })),
    legalEntities: await count('  legalEntities', () => prisma.legalEntity.count({ where: { tenantId } })),
    contractorInvoices: await count('  contractorInvoices', () => prisma.contractorInvoice.count({ where: { tenantId } })),
    openingBalances: await count('  openingBalances', () => prisma.openingBalance.count({ where: { tenantId } })),
  };

  console.log('\nDelta:', {
    components: after.components - before.components,
    calendars: after.calendars - before.calendars,
    legalEntities: after.legalEntities - before.legalEntities,
    contractorInvoices: after.contractorInvoices - before.contractorInvoices,
    openingBalances: after.openingBalances - before.openingBalances,
  });
  console.log('\nDone.\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
