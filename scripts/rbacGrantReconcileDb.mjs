/**
 * Reconcile a tenant's saved RolePermission grants with what the routes enforce.
 * Same job as rbacGrantReconcile.mjs, but straight against the database rather
 * than the settings API — so the deploy can run it while the OLD container is
 * still serving, before the gated code starts.
 *
 * That ordering is not cosmetic. BE-4's gates without BE-1/BE-4's grants lock
 * MANAGER and EMPLOYEE out of Employees, Departments and Leave; the grants
 * without the gates are inert. Doing it here makes the order structural instead
 * of a runbook step someone can forget.
 *
 *   node scripts/rbacGrantReconcileDb.mjs            # dry run, prints the delta
 *   node scripts/rbacGrantReconcileDb.mjs --apply
 *
 * Env: DATABASE_URL (required), TENANT_KEY (default acme-corp-001).
 * Additive except for the two audit keys it is explicitly told to revoke.
 */
import { PrismaClient } from '@prisma/client';

const TENANT_KEY = process.env.TENANT_KEY ?? 'acme-corp-001';
const apply = process.argv.includes('--apply');

// BE-1 — the tenant's customization grants these; the defaults never did.
const REVOKE = {
  MANAGER: ['audit:read', 'audit:export'],
  EMPLOYEE: ['audit:read', 'audit:export'],
};

// BE-4 Option A — every key the newly-gated routes require. All of these are
// already in each role's DEFAULT matrix; this tenant's saved customization is
// what dropped them, and boot-sync never reinstates a revoked grant.
const GRANT = {
  MANAGER: ['employees:read', 'departments:read', 'leave:read', 'leave:request', 'attendance:read', 'attendance:write'],
  EMPLOYEE: ['employees:read', 'departments:read', 'leave:read', 'leave:request', 'attendance:read', 'attendance:write'],
};

const prisma = new PrismaClient();

const tenant = await prisma.tenant.findFirst({ where: { tenantKey: TENANT_KEY } });
if (!tenant) {
  console.log(`No tenant with tenantKey=${TENANT_KEY}; nothing to reconcile.`);
  await prisma.$disconnect();
  process.exit(0);
}

let changed = 0;

for (const roleKey of ['MANAGER', 'EMPLOYEE']) {
  const role = await prisma.role.findFirst({ where: { tenantId: tenant.id, key: roleKey } });
  if (!role) {
    console.log(`${roleKey}: no role row on this tenant, skipping`);
    continue;
  }

  const held = await prisma.rolePermission.findMany({
    where: { roleId: role.id },
    include: { permission: { select: { key: true } } },
  });
  const heldKeys = new Set(held.map((row) => row.permission.key));

  const toRevoke = (REVOKE[roleKey] ?? []).filter((key) => heldKeys.has(key));
  const toGrant = (GRANT[roleKey] ?? []).filter((key) => !heldKeys.has(key));

  if (toRevoke.length === 0 && toGrant.length === 0) {
    console.log(`${roleKey}: already reconciled (${heldKeys.size} keys)`);
    continue;
  }
  console.log(`${roleKey}: -[${toRevoke.join(', ') || '—'}] +[${toGrant.join(', ') || '—'}]`);
  changed += toRevoke.length + toGrant.length;

  if (!apply) continue;

  for (const key of toRevoke) {
    const permission = await prisma.permission.findUnique({ where: { key } });
    if (permission) {
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: permission.id } });
    }
  }

  for (const key of toGrant) {
    const permission = await prisma.permission.findUnique({ where: { key } });
    if (!permission) {
      console.log(`  ! no Permission row for ${key} — run the seed to sync the catalogue`);
      continue;
    }
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }
  console.log(`${roleKey}: applied`);
}

console.log(apply ? `Reconcile done (${changed} changes).` : `Dry run (${changed} changes pending). Re-run with --apply.`);
await prisma.$disconnect();
