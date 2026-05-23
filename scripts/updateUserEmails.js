/**
 * Updates all User emails to real Gmail + alias addresses so OTP can be delivered.
 * All aliases deliver to mohammadsaeedafri9@gmail.com.
 * Also enables MFA for all active users.
 * Run: node scripts/updateUserEmails.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_EMAIL = 'mohammadsaeedafri9@gmail.com';

// Map old email → new real email (Gmail + aliases)
const EMAIL_MAP = {
  'superadmin@acme.test':  'mohammadsaeedafri9+superadmin@gmail.com',
  'hr@acme.test':           'mohammadsaeedafri9@gmail.com',         // primary, MFA test user
  'aman@acme.test':         'mohammadsaeedafri9+aman@gmail.com',
  'priya@acme.test':        'mohammadsaeedafri9+priya@gmail.com',
  'riya@acme.test':         'mohammadsaeedafri9+riya@gmail.com',
  'dev1@acme.test':         'mohammadsaeedafri9+dev1@gmail.com',
  'dev2@acme.test':         'mohammadsaeedafri9+dev2@gmail.com',
  'fin1@acme.test':         'mohammadsaeedafri9+fin1@gmail.com',
  'onleave@acme.test':      'mohammadsaeedafri9+onleave@gmail.com',
  'admin@testorg.com':      'mohammadsaeedafri9+testorg@gmail.com',
  // mohammadsaeedafri9@gmail.com already correct (hr user updated earlier)
  'mohammadsaeedafri9@gmail.com': 'mohammadsaeedafri9@gmail.com',
};

async function main() {
  const users = await prisma.user.findMany({ where: { deletedAt: null } });
  console.log(`Found ${users.length} users`);

  for (const user of users) {
    const newEmail = EMAIL_MAP[user.email] || user.email;
    const changed = newEmail !== user.email;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: newEmail,
        mfaEnabled: true,
      },
    });

    const marker = changed ? '→' : '=';
    console.log(`  ${user.memberType.padEnd(12)} ${user.email.padEnd(35)} ${marker} ${newEmail}`);
  }

  console.log('\nDone. All users now have real Gmail addresses + MFA enabled.');
  console.log('All OTP emails will be delivered to: ' + BASE_EMAIL);
  console.log('(Gmail + aliases like +dev1, +aman, etc. also land in the same inbox)');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
