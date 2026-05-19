import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

async function fix() {
  const newHash = await hash('password123', {
    type: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  
  console.log('Updating password hash...');
  const result = await prisma.user.updateMany({
    where: { email: 'admin@testorg.com' },
    data: { passwordHash: newHash }
  });
  
  console.log(`✅ Updated ${result.count} users`);
  console.log(`✅ New hash starts with: ${newHash.substring(0, 30)}...`);
  
  await prisma.$disconnect();
}

fix();
