import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  try {
    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { tenantKey: 'test-key-123456789' }
    });
    
    if (!tenant) {
      console.log('❌ Tenant not found');
      process.exit(1);
    }
    
    console.log(`✅ Tenant found: ${tenant.id}`);
    
    // Find user
    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'admin@testorg.com'
        }
      }
    });
    
    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    
    console.log(`✅ User found: ${user.email}`);
    console.log(`   Status: ${user.status}`);
    console.log(`   Hash starts with: ${user.passwordHash.substring(0, 20)}...`);
    
    // Count records
    const empCount = await prisma.employee.count({ where: { tenantId: tenant.id } });
    const attCount = await prisma.attendanceRecord.count({ where: { tenantId: tenant.id } });
    const leaveCount = await prisma.leaveRequest.count({ where: { tenantId: tenant.id } });
    const holCount = await prisma.holiday.count({ where: { tenantId: tenant.id } });
    
    console.log(`✅ Employees: ${empCount}`);
    console.log(`✅ Attendance: ${attCount}`);
    console.log(`✅ Leave requests: ${leaveCount}`);
    console.log(`✅ Holidays: ${holCount}`);
    
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
