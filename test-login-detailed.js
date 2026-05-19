import { PrismaClient } from '@prisma/client';
import { verify } from 'argon2';

const prisma = new PrismaClient();

async function testLogin() {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { tenantKey: 'test-key-123456789' }
    });
    
    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'admin@testorg.com'
        }
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    console.log(`✅ User: ${user.email}`);
    console.log(`✅ Status: ${user.status}`);
    console.log(`✅ Has userRoles: ${user.userRoles ? user.userRoles.length : 0}`);
    
    const passwordMatches = await verify(user.passwordHash, 'password123');
    console.log(`✅ Password matches: ${passwordMatches}`);
    
    // Check what happens with permissions
    const permissions = new Set();
    for (const userRole of user.userRoles) {
      for (const rp of userRole.role.permissions) {
        permissions.add(rp.permission.key);
      }
    }
    console.log(`✅ Permissions extracted: ${permissions.size}`);
    
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
