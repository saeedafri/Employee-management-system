/**
 * Revert all user emails back to original @acme.test addresses.
 * Keep hr@acme.test → mohammadsaeedafri9@gmail.com (MFA test user, mfaEnabled=true).
 * Disable MFA for all others so Swagger testing works normally.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REVERT_MAP = {
  'mohammadsaeedafri9+superadmin@gmail.com': { email: 'superadmin@acme.test', mfa: false },
  'mohammadsaeedafri9+aman@gmail.com':       { email: 'aman@acme.test',       mfa: false },
  'mohammadsaeedafri9+priya@gmail.com':      { email: 'priya@acme.test',      mfa: false },
  'mohammadsaeedafri9+riya@gmail.com':       { email: 'riya@acme.test',       mfa: false },
  'mohammadsaeedafri9+dev1@gmail.com':       { email: 'dev1@acme.test',       mfa: false },
  'mohammadsaeedafri9+dev2@gmail.com':       { email: 'dev2@acme.test',       mfa: false },
  'mohammadsaeedafri9+fin1@gmail.com':       { email: 'fin1@acme.test',       mfa: false },
  'mohammadsaeedafri9+onleave@gmail.com':    { email: 'onleave@acme.test',    mfa: false },
  'mohammadsaeedafri9+testorg@gmail.com':    { email: 'admin@testorg.com',    mfa: false },
  // Keep hr user as mohammadsaeedafri9@gmail.com with MFA ON — OTP test user
  'mohammadsaeedafri9@gmail.com':            { email: 'mohammadsaeedafri9@gmail.com', mfa: true },
};

async function main() {
  const users = await prisma.user.findMany({ where: { deletedAt: null } });
  console.log(`Found ${users.length} users\n`);

  for (const user of users) {
    const patch = REVERT_MAP[user.email];
    if (!patch) {
      console.log(`  SKIP  ${user.email} (no mapping)`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { email: patch.email, mfaEnabled: patch.mfa },
    });
    const mfaTag = patch.mfa ? '[MFA ON]' : '[MFA OFF]';
    const arrow = patch.email !== user.email ? ` → ${patch.email}` : ' (unchanged)';
    console.log(`  ${user.memberType.padEnd(12)} ${user.email}${arrow} ${mfaTag}`);
  }

  console.log('\nDone. Swagger test credentials restored:');
  console.log('  superadmin@acme.test  / Password123!  (SUPER_ADMIN, no MFA)');
  console.log('  hr@acme.test          → mohammadsaeedafri9@gmail.com / Password123!  (HR_ADMIN, MFA ON)');
  console.log('  aman@acme.test        / Password123!  (MANAGER, no MFA)');
  console.log('  priya@acme.test       / Password123!  (EMPLOYEE, no MFA)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
