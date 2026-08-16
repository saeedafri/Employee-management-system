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
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../src/modules/auth/permissionCatalogue.js';

const TENANT_KEY = process.env.TENANT_KEY ?? 'acme-corp-001';
const apply = process.argv.includes('--apply');

// BE-1 — the tenant's customization grants these; the defaults never did.
const REVOKE = {
  // BE-1 — the tenant's customization granted these; the defaults never did.
  // analytics:read — MANAGER's tenant-wide analytics key was replaced by
  // analytics:team-read when the path allowlist was removed. An earlier run of
  // this script granted it (it was still a MANAGER default at the time), and
  // this reconcile is additive-only, so without an explicit revoke MANAGER would
  // KEEP it and silently gain access to all 9 analytics routes it never had.
  MANAGER: ['audit:read', 'audit:export', 'analytics:read'],
  EMPLOYEE: ['audit:read', 'audit:export'],
};

// Every key the role's DEFAULT matrix grants is reconciled, not just the six
// BE-4 needed. Topping up one key at a time is how NEW-1 (`analytics:read` on
// MANAGER) and NEW-2 (`leave:request` on HR_ADMIN) each surfaced separately,
// weeks apart, as soon as a route started enforcing them -- both were keys the
// documented defaults grant and this tenant's customization had silently
// dropped. REVOKE below still wins, so deliberate removals are preserved.
const RECONCILE_TO_DEFAULTS = ['HR_ADMIN', 'MANAGER', 'EMPLOYEE', 'AUDITOR'];

const prisma = new PrismaClient();

const tenant = await prisma.tenant.findFirst({ where: { tenantKey: TENANT_KEY } });
if (!tenant) {
  console.log(`No tenant with tenantKey=${TENANT_KEY}; nothing to reconcile.`);
  await prisma.$disconnect();
  process.exit(0);
}

let changed = 0;

for (const roleKey of RECONCILE_TO_DEFAULTS) {
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

  const revokeSet = new Set(REVOKE[roleKey] ?? []);
  const toRevoke = [...revokeSet].filter((key) => heldKeys.has(key));
  // Defaults minus anything we are explicitly revoking.
  const toGrant = (DEFAULT_PERMISSIONS_BY_ROLE[roleKey] ?? [])
    .filter((key) => !heldKeys.has(key) && !revokeSet.has(key));

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
