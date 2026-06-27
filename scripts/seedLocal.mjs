// Drive the idempotent base seed against the LOCAL ems_local DB only.
// Guard: refuse to run unless DATABASE_URL is unmistakably a localhost/test DB.
const url = process.env.DATABASE_URL || '';
if (!/127\.0\.0\.1|localhost|ems_local|ems_test/.test(url)) {
  console.error('REFUSING: DATABASE_URL is not local/test:', url.replace(/:\/\/[^@]*@/, '://***@'));
  process.exit(1);
}
import { PrismaClient } from '@prisma/client';
await import('../prisma/seed.js'); // fires main() (fire-and-forget)
const prisma = new PrismaClient();
let ok = false;
for (let i = 0; i < 90; i++) {
  const u = await prisma.user.findFirst({ where: { email: 'priya@acme.test' }, select: { id: true } });
  const sa = await prisma.user.findFirst({ where: { email: 'superadmin@acme.test' }, select: { id: true } });
  if (u && sa) { ok = true; break; }
  await new Promise((r) => setTimeout(r, 1000));
}
console.log(ok ? '✅ local seed complete' : '⚠️ seed timed out');
await prisma.$disconnect();
process.exit(ok ? 0 : 1);
