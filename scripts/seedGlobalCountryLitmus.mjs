/**
 * Idempotent seed: global-payroll-litmus-001 tenant + 5 country litmus employees/packs.
 * ADDITIVE ONLY — no deletes. Run via SSH-tunnelled DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash.js';
import {
  COUNTRY_LITMUS,
  LITMUS_HR_EMAIL,
  LITMUS_PASSWORD,
  LITMUS_TENANT_KEY,
} from './globalCountryLitmusConfig.mjs';

const prisma = new PrismaClient();

async function upsertTenant() {
  const tenant = await prisma.tenant.upsert({
    where: { tenantKey: LITMUS_TENANT_KEY },
    update: {
      name: 'Global Payroll Litmus Co',
      defaultCurrency: 'USD',
      country: 'US',
      timezone: 'UTC',
    },
    create: {
      tenantKey: LITMUS_TENANT_KEY,
      slug: 'global-litmus',
      name: 'Global Payroll Litmus Co',
      legalName: 'Global Payroll Litmus Holdings',
      displayName: 'Global Litmus',
      country: 'US',
      defaultCurrency: 'USD',
      timezone: 'UTC',
      fiscalYearStart: 1,
      primaryContactEmail: LITMUS_HR_EMAIL,
    },
  });
  await prisma.tenantConfig.upsert({
    where: { tenantId: tenant.id },
    update: { companyName: 'Global Payroll Litmus Co' },
    create: {
      tenantId: tenant.id,
      companyName: 'Global Payroll Litmus Co',
      timezone: 'UTC',
      fiscalYearStart: 1,
      fiscalYearEnd: 12,
      workWeekPattern: 'MON-FRI',
      workWeekDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    },
  });
  return tenant;
}

async function upsertHrUser(tenantId) {
  const passwordHash = await hashPassword(LITMUS_PASSWORD);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: LITMUS_HR_EMAIL } },
    update: { memberType: 'HR_ADMIN', status: 'ACTIVE' },
    create: {
      tenantId,
      email: LITMUS_HR_EMAIL,
      passwordHash,
      memberType: 'HR_ADMIN',
      status: 'ACTIVE',
    },
  });
  let emp = await prisma.employee.findFirst({
    where: { tenantId, workEmail: LITMUS_HR_EMAIL },
  });
  if (!emp) {
    emp = await prisma.employee.create({
      data: {
        tenantId,
        userId: user.id,
        employeeCode: 'GL-HR-001',
        firstName: 'Global',
        lastName: 'HR',
        workEmail: LITMUS_HR_EMAIL,
        joinedOn: new Date('2024-01-01'),
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        payCurrency: 'USD',
      },
    });
    await prisma.user.update({ where: { id: user.id }, data: { employeeId: emp.id } });
  }
  return user;
}

async function seedCountry(tenantId, cfg) {
  const packId = `pack-litmus-${cfg.code.toLowerCase()}-2026`;
  const leId = `le-litmus-${cfg.code.toLowerCase()}`;
  const pgId = `pg-litmus-${cfg.code.toLowerCase()}`;
  const compId = `comp-litmus-basic-${cfg.code.toLowerCase()}`;

  const pack = await prisma.statutoryPack.upsert({
    where: { tenantId_country_version: { tenantId, country: cfg.code, version: cfg.packVersion } },
    update: { packData: cfg.pack, effectiveFrom: new Date('2026-01-01') },
    create: {
      id: packId,
      tenantId,
      country: cfg.code,
      version: cfg.packVersion,
      effectiveFrom: new Date('2026-01-01'),
      packData: cfg.pack,
    },
  });

  const le = await prisma.legalEntity.upsert({
    where: { id: leId },
    update: {
      name: `${cfg.name} Entity`,
      country: cfg.code,
      currency: cfg.currency,
      workWeekDays: cfg.workWeekDays,
      hoursPerDay: cfg.hoursPerDay,
      workWeekPattern: cfg.workWeekDays.includes('SAT') ? 'MON-SAT' : (cfg.workWeekDays[0] === 'SUN' ? 'SUN-THU' : 'MON-FRI'),
      statutoryPackId: pack.id,
    },
    create: {
      id: leId,
      tenantId,
      name: `${cfg.name} Entity`,
      country: cfg.code,
      currency: cfg.currency,
      fiscalYearStartMonth: cfg.fiscalYearStartMonth,
      timezone: cfg.timezone,
      locale: cfg.locale,
      workWeekDays: cfg.workWeekDays,
      hoursPerDay: cfg.hoursPerDay,
      workWeekPattern: cfg.workWeekDays[0] === 'SUN' ? 'SUN-THU' : 'MON-FRI',
      statutoryPackId: pack.id,
      registrationIds: { litmus: `${cfg.code}-REG-001` },
    },
  });

  await prisma.salaryComponent.upsert({
    where: { id: compId },
    update: {
      statutoryTag: cfg.wageTag,
      type: 'EARNING',
      calculationType: 'PERCENTAGE',
      value: 100,
      basisCode: 'CTC',
      taxable: true,
      active: true,
    },
    create: {
      id: compId,
      tenantId,
      code: `BASIC_${cfg.code}`,
      name: `Basic Salary (${cfg.code})`,
      type: 'EARNING',
      calculationType: 'PERCENTAGE',
      value: 100,
      basisCode: 'CTC',
      statutoryTag: cfg.wageTag,
      taxable: true,
      displayOrder: 1,
      active: true,
    },
  });

  const payGroup = await prisma.payGroup.upsert({
    where: { tenantId_code: { tenantId, code: `LITMUS_${cfg.code}` } },
    update: { currency: cfg.currency, active: true },
    create: {
      id: pgId,
      tenantId,
      name: `Litmus ${cfg.name}`,
      code: `LITMUS_${cfg.code}`,
      paySchedule: 'MONTHLY',
      currency: cfg.currency,
      active: true,
    },
  });

  await prisma.payGroupComponent.upsert({
    where: { payGroupId_componentId: { payGroupId: payGroup.id, componentId: compId } },
    update: {},
    create: { payGroupId: payGroup.id, componentId: compId },
  });

  const passwordHash = await hashPassword(LITMUS_PASSWORD);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId, email: cfg.employeeEmail } },
    update: { memberType: 'EMPLOYEE', status: 'ACTIVE' },
    create: {
      tenantId,
      email: cfg.employeeEmail,
      passwordHash,
      memberType: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  });

  const employee = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId, employeeCode: cfg.employeeCode } },
    update: {
      workEmail: cfg.employeeEmail,
      payCurrency: cfg.currency,
      employmentStatus: 'ACTIVE',
      deletedAt: null,
    },
    create: {
      tenantId,
      userId: user.id,
      employeeCode: cfg.employeeCode,
      firstName: 'Litmus',
      lastName: cfg.code,
      workEmail: cfg.employeeEmail,
      joinedOn: new Date('2024-01-01'),
      designation: `${cfg.name} Test Employee`,
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      payCurrency: cfg.currency,
      location: cfg.name,
    },
  });
  await prisma.user.update({ where: { id: user.id }, data: { employeeId: employee.id } });

  const existingSal = await prisma.employeeSalary.findFirst({
    where: { tenantId, employeeId: employee.id, effectiveTo: null },
  });
  if (!existingSal) {
    await prisma.employeeSalary.create({
      data: {
        tenantId,
        employeeId: employee.id,
        payGroupId: payGroup.id,
        annualCtc: cfg.annualCtcMajor,
        effectiveFrom: new Date('2026-01-01'),
        country: cfg.code,
        currency: cfg.currency,
        legalEntityId: le.id,
        bankAccountName: `Litmus ${cfg.code}`,
        bankAccountNumber: '1234567890',
        bankName: 'Litmus Bank',
      },
    });
  } else {
    await prisma.employeeSalary.update({
      where: { id: existingSal.id },
      data: {
        annualCtc: cfg.annualCtcMajor,
        payGroupId: payGroup.id,
        country: cfg.code,
        currency: cfg.currency,
        legalEntityId: le.id,
      },
    });
  }

  return { pack, le, employee };
}

async function main() {
  console.log('Seeding global payroll litmus tenant…');
  const tenant = await upsertTenant();
  await upsertHrUser(tenant.id);
  for (const [code, cfg] of Object.entries(COUNTRY_LITMUS)) {
    await seedCountry(tenant.id, cfg);
    console.log(`  ✓ ${code} — pack, legal entity, employee, salary`);
  }
  console.log('Done:', LITMUS_TENANT_KEY);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
