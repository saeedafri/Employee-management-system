import { prisma } from '../../plugins/prisma.js';
import { ensureTenantRolePermissionDefaults } from './auth.service.js';
import { registerPermissionKeys } from './auth.policy.js';

/**
 * Boot-time catalogue sync.
 *
 * `ensureTenantRolePermissionDefaults` is otherwise only reached when an admin
 * opens Settings -> Roles & Permissions. That is too late: once routes start
 * requiring newly-added keys, a tenant seeded against the old catalogue has a
 * non-empty (but stale) `permissions[]`, and `hasPermission()` only falls back
 * to the defaults when that array is *empty* -- so every new key would 403 until
 * someone happened to visit that screen.
 *
 * Running it for every tenant at boot makes a deploy self-healing. It is
 * idempotent and early-returns per tenant once the catalogue is unchanged.
 */
export async function syncPermissionCatalogue(logger) {
  try {
    const known = await prisma.permission.findMany({ select: { key: true } });
    registerPermissionKeys(known.map((row) => row.key));

    const tenants = await prisma.tenant.findMany({ select: { id: true, tenantKey: true } });
    let updated = 0;

    for (const tenant of tenants) {
      const result = await ensureTenantRolePermissionDefaults(prisma, tenant.id);
      if (result.seeded) {
        updated += 1;
        logger?.info({
          msg: 'Permission catalogue seeded',
          tenantKey: tenant.tenantKey,
          newKeys: result.newKeys,
        });
      }
    }

    logger?.info({ msg: 'Permission catalogue sync complete', tenants: tenants.length, updated });
    return { tenants: tenants.length, updated };
  } catch (error) {
    // Never block startup on this -- the default-matrix fallback still applies.
    logger?.error({ msg: 'Permission catalogue sync failed', err: error?.message });
    return { tenants: 0, updated: 0, error: error?.message };
  }
}
