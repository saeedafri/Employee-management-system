import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Get all users per tenant and update to unique gmail+ aliases
const users = await p.user.findMany({ orderBy: { createdAt: 'asc' } });
const seenTenant = {};
let i = 0;

for (const u of users) {
  const key = u.tenantId;
  if (!seenTenant[key]) seenTenant[key] = 0;
  seenTenant[key]++;
  const n = seenTenant[key];
  // gmail+alias trick: all delivered to same inbox
  const newEmail = `mohammadsaeedafri9+user${n}t${i}@gmail.com`;
  await p.user.update({ where: { id: u.id }, data: { email: newEmail } });
  console.log(`${u.email} → ${newEmail}`);
  i++;
}

await p.$disconnect();
console.log('Done');
