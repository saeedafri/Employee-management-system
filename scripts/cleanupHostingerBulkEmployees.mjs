/**
 * Remove bulk-upload test employees from acme-corp-001 (Bulk1/BULK000001 pattern).
 * Keeps the 70 seeded employees (E0001–E0065, E0100–E0104). kwd-litmus-001 untouched.
 *
 * Usage (on Hostinger via docker exec):
 *   node scripts/cleanupHostingerBulkEmployees.mjs          # dry-run counts
 *   node scripts/cleanupHostingerBulkEmployees.mjs --execute
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');
const TENANT_KEY = 'acme-corp-001';
const BATCH = 50_000;

const bulkWhere = {
  tenant: { tenantKey: TENANT_KEY },
  OR: [
    { firstName: { startsWith: 'Bulk' } },
    { employeeCode: { startsWith: 'BULK' } },
    { workEmail: { startsWith: 'bulk' } },
  ],
};

async function countBulk() {
  return prisma.employee.count({ where: bulkWhere });
}

async function countKeep() {
  const tenant = await prisma.tenant.findUnique({ where: { tenantKey: TENANT_KEY } });
  if (!tenant) throw new Error(`Tenant ${TENANT_KEY} not found`);
  return prisma.employee.count({
    where: { tenantId: tenant.id, deletedAt: null, NOT: bulkWhere.OR },
  });
}

async function deleteBulkAttendance() {
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const n = await prisma.$executeRaw`
      DELETE FROM "AttendanceRecord"
      WHERE id IN (
        SELECT ar.id FROM "AttendanceRecord" ar
        INNER JOIN "Employee" e ON ar."employeeId" = e.id
        INNER JOIN "Tenant" t ON e."tenantId" = t.id
        WHERE t."tenantKey" = ${TENANT_KEY}
          AND e."firstName" LIKE 'Bulk%'
        LIMIT ${BATCH}
      )`;
    if (n === 0) break;
    total += Number(n);
    console.log(`  attendance batch deleted: ${n} (running total ${total})`);
  }
  return total;
}

async function deleteBulkEmployees() {
  let total = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.employee.findMany({
      where: bulkWhere,
      select: { id: true },
      take: 200,
    });
    if (batch.length === 0) break;
    const ids = batch.map((e) => e.id);
    const r = await prisma.employee.deleteMany({ where: { id: { in: ids } } });
    total += r.count;
    console.log(`  employees batch deleted: ${r.count} (running total ${total})`);
  }
  return total;
}

async function main() {
  const bulkCount = await countBulk();
  const keepCount = await countKeep();
  const attCount = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS c FROM "AttendanceRecord" ar
    INNER JOIN "Employee" e ON ar."employeeId" = e.id
    INNER JOIN "Tenant" t ON e."tenantId" = t.id
    WHERE t."tenantKey" = ${TENANT_KEY} AND e."firstName" LIKE 'Bulk%'`;

  console.log(`Tenant: ${TENANT_KEY}`);
  console.log(`Bulk employees to remove: ${bulkCount}`);
  console.log(`Valid employees to keep: ${keepCount}`);
  console.log(`Bulk attendance rows: ${attCount[0]?.c ?? 0}`);

  if (!EXECUTE) {
    console.log('\nDry run only. Re-run with --execute to delete.');
    return;
  }

  if (bulkCount === 0) {
    console.log('Nothing to delete.');
    return;
  }

  console.log('\nDeleting bulk attendance...');
  const attDeleted = await deleteBulkAttendance();
  console.log(`Attendance deleted: ${attDeleted}`);

  console.log('\nDeleting bulk employees...');
  const empDeleted = await deleteBulkEmployees();
  console.log(`Employees deleted: ${empDeleted}`);

  const remaining = await countBulk();
  const kept = await countKeep();
  console.log(`\nDone. Remaining bulk: ${remaining}, kept: ${kept}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
