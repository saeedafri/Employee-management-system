/**
 * BE-6 — create the missing AUDITOR login on a tenant.
 *
 * `prisma/seed.js` now seeds `auditor@acme.test`, but running the full seed
 * against production is not something you do casually. This does only the one
 * thing: upsert the user, attach the existing AUDITOR role. Additive, idempotent,
 * deletes nothing.
 *
 *   TENANT_KEY=acme-corp-001 node scripts/seedAuditorUser.mjs
 *
 * Env: DATABASE_URL (required), TENANT_KEY, AUDITOR_EMAIL, AUDITOR_PASSWORD.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash.js';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../src/modules/auth/permissionCatalogue.js';

const TENANT_KEY = process.env.TENANT_KEY ?? 'acme-corp-001';
const EMAIL = process.env.AUDITOR_EMAIL ?? 'auditor@acme.test';
const PASSWORD = process.env.AUDITOR_PASSWORD ?? 'Password123!';

const prisma = new PrismaClient();

const tenant = await prisma.tenant.findFirst({ where: { tenantKey: TENANT_KEY } });
if (!tenant) throw new Error(`No tenant with tenantKey=${TENANT_KEY}`);

const role = await prisma.role.findFirst({ where: { tenantId: tenant.id, key: 'AUDITOR' } });
if (!role) throw new Error('No AUDITOR role on this tenant — run the seed first');

const passwordHash = await hashPassword(PASSWORD);
const user = await prisma.user.upsert({
  where: { tenantId_email: { tenantId: tenant.id, email: EMAIL } },
  update: { passwordHash, status: 'ACTIVE' },
  create: { tenantId: tenant.id, email: EMAIL, passwordHash, memberType: 'AUDITOR', status: 'ACTIVE' },
});

await prisma.userRole.upsert({
  where: { userId_roleId: { userId: user.id, roleId: role.id } },
  update: {},
  create: { userId: user.id, roleId: role.id },
});

const granted = await prisma.rolePermission.count({ where: { roleId: role.id } });
console.log(`${EMAIL} ready on ${TENANT_KEY}: ${granted} keys granted to the AUDITOR role`);
console.log(`expected by the catalogue: ${DEFAULT_PERMISSIONS_BY_ROLE.AUDITOR.length}`);

await prisma.$disconnect();
