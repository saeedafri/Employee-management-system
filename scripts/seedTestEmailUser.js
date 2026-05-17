#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/hash.js';
import { generateId } from '../src/utils/id.js';

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const emailIndex = args.indexOf('--email');
let testEmail = 'mohammadsaeedafri9@gmail.com';

if (emailIndex !== -1 && args[emailIndex + 1]) {
  testEmail = args[emailIndex + 1];
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(testEmail)) {
  console.error('Error: Invalid email format');
  process.exit(1);
}

const mfaFlag = args.includes('--mfa');

async function seedTestUser() {
  try {
    // Get or create default tenant
    let tenant = await prisma.tenant.findFirst({
      where: { tenantKey: 'acme' },
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          tenantKey: 'acme',
          name: 'ACME Corporation',
          legalName: 'ACME Corporation Limited',
          displayName: 'ACME',
          country: 'India',
          primaryContactEmail: 'contact@acme.com',
        },
      });
      console.log('Created default tenant: acme');
    }

    // Get or create EMPLOYEE role
    let employeeRole = await prisma.role.findFirst({
      where: {
        tenantId: tenant.id,
        key: 'EMPLOYEE',
      },
    });

    if (!employeeRole) {
      employeeRole = await prisma.role.create({
        data: {
          tenant: { connect: { id: tenant.id } },
          name: 'Employee',
          key: 'EMPLOYEE',
        },
      });
      console.log('Created EMPLOYEE role');
    }

    // Check if user already exists
    let user = await prisma.user.findFirst({
      where: {
        email: testEmail,
        tenantId: tenant.id,
      },
    });

    const testPassword = 'TestPass123!@';
    const hashedPassword = await hashPassword(testPassword);

    if (user) {
      // Update existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email: testEmail,
          passwordHash: hashedPassword,
          status: 'ACTIVE',
          memberType: 'EMPLOYEE',
          mfaEnabled: mfaFlag,
        },
      });
      console.log(`Updated existing user: ${testEmail}`);
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          email: testEmail,
          passwordHash: hashedPassword,
          memberType: 'EMPLOYEE',
          status: 'ACTIVE',
          mfaEnabled: mfaFlag,
        },
      });
      console.log(`Created new user: ${testEmail}`);
    }

    // Assign EMPLOYEE role if not already assigned
    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId: user.id,
        roleId: employeeRole.id,
      },
    });

    if (!existingRole) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: employeeRole.id,
        },
      });
      console.log('Assigned EMPLOYEE role to user');
    }

    // Create or update employee record
    let employee = await prisma.employee.findFirst({
      where: {
        tenantId: tenant.id,
        workEmail: testEmail,
      },
    });

    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          employeeCode: `TEST_${Date.now()}`,
          firstName: 'Test',
          lastName: 'User',
          workEmail: testEmail,
          joinedOn: new Date(),
          employmentStatus: 'ACTIVE',
        },
      });
      console.log('Created employee record');
    } else {
      await prisma.employee.update({
        where: { id: employee.id },
        data: {
          workEmail: testEmail,
          employmentStatus: 'ACTIVE',
        },
      });
      console.log('Updated employee record');
    }

    console.log('\n✅ Test user setup complete');
    console.log(`Email: ${testEmail}`);
    console.log(`Password: ${testPassword}`);
    console.log(`MFA Enabled: ${mfaFlag}`);
    console.log(`Tenant: acme`);
  } catch (error) {
    console.error('Error setting up test user:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestUser();
