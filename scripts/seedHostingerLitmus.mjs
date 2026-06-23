/**
 * ADDITIVE-ONLY Hostinger litmus seed (Phase 12.1 closure).
 * 1) KWD tenant kwd-litmus-001 + admin@kwd.test + SUN-THU work-week (if missing).
 * 2) Acme legal-entity workWeekDays/hoursPerDay backfill (if null).
 * Safe to re-run — exits early when already present.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash.js';

const p = new PrismaClient();
const KEY = 'kwd-litmus-001';
const EMAIL = 'admin@kwd.test';

// ── 1. KWD litmus tenant ─────────────────────────────────────────────────────
let kwdTenant = await p.tenant.findUnique({ where: { tenantKey: KEY } });
if (!kwdTenant) {
  kwdTenant = await p.tenant.create({
    data: {
      tenantKey: KEY,
      name: 'Kuwait Litmus Co',
      legalName: 'Kuwait Litmus Co WLL',
      displayName: 'Kuwait Litmus',
      country: 'KW',
      defaultCurrency: 'KWD',
      timezone: 'Asia/Kuwait',
      fiscalYearStart: 1,
      primaryContactEmail: EMAIL,
    },
  });
  console.log('CREATED tenant', KEY, kwdTenant.id);
} else {
  console.log('Tenant exists', KEY, kwdTenant.id);
}

let kwdCfg = await p.tenantConfig.findFirst({ where: { tenantId: kwdTenant.id } });
if (!kwdCfg) {
  kwdCfg = await p.tenantConfig.create({
    data: {
      tenantId: kwdTenant.id,
      companyName: 'Kuwait Litmus Co',
      timezone: 'Asia/Kuwait',
      fiscalYearStart: 1,
      fiscalYearEnd: 12,
      workWeekPattern: 'SUN-THU',
      workWeekDays: ['SUN', 'MON', 'TUE', 'WED', 'THU'],
    },
  });
  console.log('CREATED tenantConfig SUN-THU');
} else if (!kwdCfg.workWeekPattern || kwdCfg.workWeekPattern === 'MON-FRI') {
  kwdCfg = await p.tenantConfig.update({
    where: { id: kwdCfg.id },
    data: {
      workWeekPattern: 'SUN-THU',
      workWeekDays: ['SUN', 'MON', 'TUE', 'WED', 'THU'],
    },
  });
  console.log('UPDATED tenantConfig → SUN-THU');
} else {
  console.log('tenantConfig work-week OK', kwdCfg.workWeekPattern);
}

const kwdUser = await p.user.findFirst({ where: { tenantId: kwdTenant.id, email: EMAIL } });
if (!kwdUser) {
  const emp = await p.employee.create({
    data: {
      tenantId: kwdTenant.id,
      employeeCode: 'KW0001',
      firstName: 'Kuwait',
      lastName: 'Admin',
      workEmail: EMAIL,
      personalEmail: EMAIL,
      joinedOn: new Date('2024-01-01T00:00:00.000Z'),
      designation: 'HR Manager',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      payCurrency: 'KWD',
      location: 'Kuwait City',
    },
  });
  const passwordHash = await hashPassword('Password123!');
  const user = await p.user.create({
    data: { tenantId: kwdTenant.id, employeeId: emp.id, email: EMAIL, passwordHash, memberType: 'HR_ADMIN' },
  });
  await p.employee.update({ where: { id: emp.id }, data: { userId: user.id } });
  console.log('CREATED KWD admin', EMAIL);
} else {
  console.log('KWD admin exists', EMAIL);
}

// ── 2. Acme legal-entity work-week backfill ──────────────────────────────────
const acme = await p.tenant.findUnique({ where: { tenantKey: 'acme-corp-001' } });
if (acme) {
  const entities = await p.legalEntity.findMany({ where: { tenantId: acme.id } });
  let patched = 0;
  for (const ent of entities) {
    if (ent.workWeekDays && ent.hoursPerDay) continue;
    await p.legalEntity.update({
      where: { id: ent.id },
      data: {
        workWeekDays: ent.workWeekDays ?? ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        hoursPerDay: ent.hoursPerDay ?? 8,
        workWeekPattern: ent.workWeekPattern || 'MON-FRI',
      },
    });
    patched += 1;
  }
  console.log('Acme legal-entity backfill rows:', patched);
}

await p.$disconnect();
console.log('seedHostingerLitmus: done');
