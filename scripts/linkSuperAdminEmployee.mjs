#!/usr/bin/env node
/**
 * Idempotent: ensure superadmin@acme.test has Employee E0000 + user.employeeId.
 *
 * SAFE: only upserts one employee + updates one user. Does NOT truncate/reset.
 *
 * Usage (after approving DB target):
 *   DATABASE_URL='postgresql://...' node scripts/linkSuperAdminEmployee.mjs
 *
 * Default tenantKey: acme-corp-001
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_KEY = process.env.TENANT_KEY || 'acme-corp-001';
const EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@acme.test';

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: TENANT_KEY } });
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_KEY}`);

  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: EMAIL } },
  });
  if (!user) throw new Error(`User not found: ${EMAIL}`);

  const hrDept = await prisma.department.findFirst({
    where: { tenantId: tenant.id, departmentCode: 'HR' },
  });
  if (!hrDept) throw new Error('HR department not found');

  const employee = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: 'E0000' } },
    update: { userId: user.id, workEmail: EMAIL },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      employeeCode: 'E0000',
      firstName: 'Super',
      lastName: 'Admin',
      workEmail: EMAIL,
      personalEmail: EMAIL,
      designation: 'System Administrator',
      departmentId: hrDept.id,
      joinedOn: new Date('2018-01-01'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      location: 'Delhi',
      payCurrency: 'INR',
      createdBy: user.id,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { employeeId: employee.id },
  });

  console.log(JSON.stringify({
    ok: true,
    tenantKey: TENANT_KEY,
    email: EMAIL,
    userId: user.id,
    employeeId: employee.id,
    employeeCode: 'E0000',
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
