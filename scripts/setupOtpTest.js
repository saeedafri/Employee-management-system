/**
 * One-time script: prepare hr@acme.test for OTP e2e test.
 * - Changes User.email → mohammadsaeedafri9@gmail.com
 * - Enables MFA so login triggers OTP
 * Run: node scripts/setupOtpTest.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: 'acme-corp-001' } });
  if (!tenant) throw new Error('Tenant acme-corp-001 not found');

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'hr@acme.test' },
  });
  if (!user) throw new Error('User hr@acme.test not found');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: 'mohammadsaeedafri9@gmail.com',
      mfaEnabled: true,
    },
  });

  console.log('Done:');
  console.log('  User ID   :', user.id);
  console.log('  Old email :', user.email);
  console.log('  New email : mohammadsaeedafri9@gmail.com');
  console.log('  MFA       : enabled');
  console.log('');
  console.log('Login with:');
  console.log('  email    : mohammadsaeedafri9@gmail.com');
  console.log('  password : Password123!');
  console.log('  header   : x-tenant-key: acme-corp-001');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
