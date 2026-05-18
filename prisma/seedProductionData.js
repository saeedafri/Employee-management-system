import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { hashPassword, generateId } from '../src/utils/hash.js';

const prisma = new PrismaClient();

const TENANT_ID = 'tenant-acme-prod';
const TENANT_NAME = 'Acme Corporation';

// Realistic employee distribution
const DEPARTMENTS = [
  { name: 'Engineering', code: 'ENG', employees: 412, wfhPercentage: 50 },
  { name: 'Sales', code: 'SAL', employees: 210, wfhPercentage: 0 },
  { name: 'Operations', code: 'OPS', employees: 180, wfhPercentage: 20 },
  { name: 'Finance', code: 'FIN', employees: 150, wfhPercentage: 0 },
  { name: 'Human Resources', code: 'HR', employees: 48, wfhPercentage: 0 },
];

const LEAVE_TYPES = [
  { name: 'Annual Leave', code: 'ANNUAL', annualAllowance: 20, carryForwardAllowed: true },
  { name: 'Sick Leave', code: 'SICK', annualAllowance: 12, carryForwardAllowed: false },
  { name: 'Comp Off', code: 'COMP', annualAllowance: 5, carryForwardAllowed: false },
  { name: 'Maternity Leave', code: 'MATERNITY', annualAllowance: 180, carryForwardAllowed: false },
  { name: 'Paternity Leave', code: 'PATERNITY', annualAllowance: 15, carryForwardAllowed: false },
];

async function seedProductionData() {
  console.log('🌱 Seeding production data for performance testing...\n');

  try {
    // 1. Create or get tenant
    console.log('📦 Setting up tenant...');
    const tenant = await prisma.tenant.upsert({
      where: { id: TENANT_ID },
      update: {},
      create: {
        id: TENANT_ID,
        name: TENANT_NAME,
        legalName: 'Acme Corporation Pvt Ltd',
        displayName: 'Acme',
        country: 'India',
        defaultCurrency: 'INR',
        timezone: 'Asia/Kolkata',
        fiscalYearStart: new Date(2025, 3, 1), // April 1
        primaryContactEmail: 'hr@acme.com',
        supportPhone: '+91-11-4000-0000',
      },
    });
    console.log(`✅ Tenant: ${tenant.name}\n`);

    // 2. Create departments
    console.log('🏢 Creating departments...');
    const departments = {};
    for (const dept of DEPARTMENTS) {
      const created = await prisma.department.create({
        data: {
          tenantId: TENANT_ID,
          name: dept.name,
          departmentCode: dept.code,
          parentId: null,
          depth: 1,
        },
      });
      departments[dept.code] = created;
      console.log(`  ✓ ${dept.name}: ${dept.code}`);
    }
    console.log();

    // 3. Create leave types
    console.log('📅 Creating leave types...');
    const leaveTypes = {};
    for (const leave of LEAVE_TYPES) {
      const created = await prisma.leaveType.create({
        data: {
          tenantId: TENANT_ID,
          name: leave.name,
          code: leave.code,
          annualAllowance: leave.annualAllowance,
          carryForwardAllowed: leave.carryForwardAllowed,
          isPaid: true,
          isActive: true,
        },
      });
      leaveTypes[leave.code] = created;
      console.log(`  ✓ ${leave.name}: ${leave.annualAllowance} days`);
    }
    console.log();

    // 4. Create holidays (2025)
    console.log('🎉 Creating holidays for 2025...');
    const holidays = [
      { date: new Date(2025, 0, 26), name: 'Republic Day' },
      { date: new Date(2025, 2, 8), name: 'Maha Shivaratri' },
      { date: new Date(2025, 3, 11), name: 'Good Friday' },
      { date: new Date(2025, 3, 17), name: 'Ram Navami' },
      { date: new Date(2025, 3, 21), name: 'Mahavir Jayanti' },
      { date: new Date(2025, 4, 1), name: 'May Day' },
      { date: new Date(2025, 5, 20), name: 'Eid ul-Adha' },
      { date: new Date(2025, 6, 17), name: 'Muharram' },
      { date: new Date(2025, 7, 15), name: 'Independence Day' },
      { date: new Date(2025, 8, 16), name: 'Milad un-Nabi' },
      { date: new Date(2025, 9, 2), name: 'Gandhi Jayanti' },
      { date: new Date(2025, 10, 1), name: 'Diwali' },
      { date: new Date(2025, 11, 25), name: 'Christmas' },
    ];

    for (const holiday of holidays) {
      await prisma.holiday.create({
        data: {
          tenantId: TENANT_ID,
          name: holiday.name,
          holidayDate: holiday.date,
          location: 'All', // Global holiday
          isOptional: false,
        },
      });
    }
    console.log(`✅ Created ${holidays.length} holidays\n`);

    // 5. Create employees (1000 total)
    console.log('👥 Creating 1000 employees with realistic distribution...');
    const employees = [];
    let employeeCounter = 1;

    const ROLES = ['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE'];
    const superAdmins = [];
    const hrAdmins = [];
    const managers = [];

    for (const dept of DEPARTMENTS) {
      const deptObj = departments[dept.code];
      const deptEmployeeCount = dept.employees;

      // Create managers first (1 per 8-12 employees)
      const managerCount = Math.ceil(deptEmployeeCount / 10);
      const managersForDept = [];

      for (let i = 0; i < managerCount; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@acme.com`;

        // Create user first
        const user = await prisma.user.create({
          data: {
            tenantId: TENANT_ID,
            email,
            passwordHash: await hashPassword('ChangeMe123!'),
            memberType: 'MANAGER',
            status: 'ACTIVE',
            lastLoginAt: faker.date.recent(),
          },
        });

        // Create employee
        const employee = await prisma.employee.create({
          data: {
            tenantId: TENANT_ID,
            userId: user.id,
            employeeCode: `E${String(employeeCounter++).padStart(4, '0')}`,
            firstName,
            lastName,
            workEmail: email,
            personalEmail: faker.internet.email(),
            phone: `+91${faker.number.int({ min: 9000000000, max: 9999999999 })}`,
            dateOfBirth: faker.date.birthdate({ min: 25, max: 60, mode: 'age' }),
            gender: faker.helpers.arrayElement(['MALE', 'FEMALE', 'OTHER']),
            address: faker.location.streetAddress(),
            emergencyContactName: faker.person.fullName(),
            emergencyContactPhone: `+91${faker.number.int({ min: 9000000000, max: 9999999999 })}`,
            designation: 'Manager',
            departmentId: deptObj.id,
            managerId: null,
            joinedOn: faker.date.past({ years: 5 }),
            employmentType: 'FULL_TIME',
            employmentStatus: 'ACTIVE',
            location: faker.helpers.arrayElement(['Delhi', 'Bangalore', 'Mumbai', 'Pune']),
            payCurrency: 'INR',
          },
        });

        managersForDept.push(employee);
        managers.push(employee);
      }

      // Create regular employees
      for (let i = 0; i < deptEmployeeCount - managerCount; i++) {
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@acme.com`;

        // Assign to a manager
        const assignedManager = managersForDept[i % managersForDept.length];

        // Create user
        const user = await prisma.user.create({
          data: {
            tenantId: TENANT_ID,
            email,
            passwordHash: await hashPassword('ChangeMe123!'),
            memberType: 'EMPLOYEE',
            status: 'ACTIVE',
            lastLoginAt: faker.date.recent(),
          },
        });

        // Create employee
        await prisma.employee.create({
          data: {
            tenantId: TENANT_ID,
            userId: user.id,
            employeeCode: `E${String(employeeCounter++).padStart(4, '0')}`,
            firstName,
            lastName,
            workEmail: email,
            personalEmail: faker.internet.email(),
            phone: `+91${faker.number.int({ min: 9000000000, max: 9999999999 })}`,
            dateOfBirth: faker.date.birthdate({ min: 25, max: 60, mode: 'age' }),
            gender: faker.helpers.arrayElement(['MALE', 'FEMALE', 'OTHER']),
            address: faker.location.streetAddress(),
            emergencyContactName: faker.person.fullName(),
            emergencyContactPhone: `+91${faker.number.int({ min: 9000000000, max: 9999999999 })}`,
            designation: faker.helpers.arrayElement([
              'Engineer',
              'Senior Engineer',
              'Lead',
              'Executive',
              'Analyst',
              'Associate',
            ]),
            departmentId: deptObj.id,
            managerId: assignedManager.id,
            joinedOn: faker.date.past({ years: 5 }),
            employmentType: 'FULL_TIME',
            employmentStatus: 'ACTIVE',
            location: faker.helpers.arrayElement(['Delhi', 'Bangalore', 'Mumbai', 'Pune']),
            payCurrency: 'INR',
          },
        });

        if (i % 100 === 0) {
          console.log(`  ✓ Created ${i + managerCount} employees in ${dept.name}`);
        }
      }
    }

    console.log(`✅ Created 1000 employees total\n`);

    // 6. Create admin users
    console.log('🔐 Creating admin users...');
    const superAdminUser = await prisma.user.upsert({
      where: { email: 'superadmin@acme.com' },
      update: { status: 'ACTIVE' },
      create: {
        tenantId: TENANT_ID,
        email: 'superadmin@acme.com',
        passwordHash: await hashPassword('ChangeMe123!'),
        memberType: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });

    const hrAdminUser = await prisma.user.upsert({
      where: { email: 'hr@acme.com' },
      update: { status: 'ACTIVE' },
      create: {
        tenantId: TENANT_ID,
        email: 'hr@acme.com',
        passwordHash: await hashPassword('ChangeMe123!'),
        memberType: 'HR_ADMIN',
        status: 'ACTIVE',
      },
    });

    console.log(`✅ Admin users created\n`);

    // 7. Create leave balances for all employees
    console.log('💼 Creating leave balances...');
    const allEmployees = await prisma.employee.findMany({
      where: { tenantId: TENANT_ID },
      take: 1000,
    });

    for (const leave of LEAVE_TYPES) {
      for (const employee of allEmployees) {
        await prisma.leaveBalance.create({
          data: {
            tenantId: TENANT_ID,
            employeeId: employee.id,
            leaveTypeId: leaveTypes[leave.code].id,
            balance: leave.annualAllowance,
            used: 0,
            pending: 0,
          },
        });
      }
    }
    console.log(`✅ Leave balances created\n`);

    // 8. Create 6 months of attendance (realistic patterns)
    console.log('📊 Creating 6 months of realistic attendance...');
    let attendanceRecords = 0;
    const startDate = new Date(2024, 11, 1); // December 2024
    const endDate = new Date(2025, 5, 30); // June 2025

    for (const employee of allEmployees) {
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        // Skip weekends
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
          // Check if holiday
          const isHoliday = holidays.some(
            h => h.date.toDateString() === currentDate.toDateString()
          );

          if (!isHoliday) {
            // 70% present, 15% leave, 10% absent, 5% WFH
            const rand = Math.random();
            let status = 'PRESENT';
            let checkInAt = null;
            let checkOutAt = null;
            let workMode = 'OFFICE';

            if (rand < 0.70) {
              // Present: 90% on time, 10% late
              status = 'PRESENT';
              const checkInHour = Math.random() < 0.9 ? 9 : 10;
              const checkInMinute = Math.floor(Math.random() * 60);
              checkInAt = new Date(currentDate);
              checkInAt.setHours(checkInHour, checkInMinute, 0);

              const checkOutHour = 18;
              const checkOutMinute = Math.floor(Math.random() * 60);
              checkOutAt = new Date(currentDate);
              checkOutAt.setHours(checkOutHour, checkOutMinute, 0);

              workMode = Math.random() < 0.3 ? 'WFH' : 'OFFICE';
            } else if (rand < 0.85) {
              status = 'LEAVE';
            } else {
              status = 'ABSENT';
            }

            await prisma.attendanceRecord.create({
              data: {
                tenantId: TENANT_ID,
                employeeId: employee.id,
                attendanceDate: currentDate,
                checkInAt,
                checkOutAt,
                workMode,
                status,
                totalMinutes: checkInAt && checkOutAt ? Math.floor((checkOutAt - checkInAt) / 60000) : null,
              },
            });

            attendanceRecords++;
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    console.log(`✅ Created ${attendanceRecords.toLocaleString()} attendance records\n`);

    // 9. Create leave requests (500+ distributed across statuses)
    console.log('📋 Creating leave requests...');
    let leaveRequestsCreated = 0;

    for (let i = 0; i < 500; i++) {
      const employee = allEmployees[Math.floor(Math.random() * allEmployees.length)];
      const leaveType = Object.values(leaveTypes)[Math.floor(Math.random() * Object.keys(leaveTypes).length)];
      const manager = allEmployees.find(e => e.id === employee.managerId);

      const startDate = faker.date.future({ years: 0.5 });
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 1);

      const statuses = ['PENDING', 'PENDING', 'PENDING', 'APPROVED', 'APPROVED', 'DENIED'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      await prisma.leaveRequest.create({
        data: {
          tenantId: TENANT_ID,
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          startDate,
          endDate,
          totalDays: Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1,
          reason: faker.lorem.sentence(),
          status,
          approverId: status !== 'PENDING' ? manager?.id : null,
          approverComment: status !== 'PENDING' ? faker.lorem.sentence() : null,
          submittedAt: new Date(),
          decidedAt: status !== 'PENDING' ? new Date() : null,
        },
      });

      leaveRequestsCreated++;
    }

    console.log(`✅ Created ${leaveRequestsCreated} leave requests\n`);

    // 10. Create regularization requests (50+)
    console.log('🔧 Creating regularization requests...');
    let regularizationCreated = 0;

    for (let i = 0; i < 50; i++) {
      const employee = allEmployees[Math.floor(Math.random() * allEmployees.length)];
      const manager = allEmployees.find(e => e.id === employee.managerId);
      const attendanceDate = faker.date.past({ years: 0.25 });

      const statuses = ['PENDING', 'PENDING', 'APPROVED', 'DENIED'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      await prisma.attendanceRegularizationRequest.create({
        data: {
          tenantId: TENANT_ID,
          employeeId: employee.id,
          attendanceDate,
          reason: faker.lorem.sentence(),
          status,
          reviewerId: status !== 'PENDING' ? manager?.id : null,
          reviewerComment: status !== 'PENDING' ? faker.lorem.sentence() : null,
        },
      });

      regularizationCreated++;
    }

    console.log(`✅ Created ${regularizationCreated} regularization requests\n`);

    // 11. Create audit logs (sample)
    console.log('📝 Creating audit logs...');
    const actionsLog = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'DENY'];
    for (let i = 0; i < 100; i++) {
      const admin = Math.random() < 0.5 ? superAdminUser : hrAdminUser;
      const employee = allEmployees[Math.floor(Math.random() * allEmployees.length)];

      await prisma.auditLog.create({
        data: {
          tenantId: TENANT_ID,
          actorUserId: admin.id,
          action: actionsLog[Math.floor(Math.random() * actionsLog.length)],
          entityType: 'EMPLOYEE',
          entityId: employee.id,
          oldValuesJson: JSON.stringify({}),
          newValuesJson: JSON.stringify({ status: 'UPDATED' }),
          ipAddress: faker.internet.ipv4(),
          userAgent: faker.internet.userAgent(),
        },
      });
    }
    console.log(`✅ Created 100 audit logs\n`);

    console.log('✨ Production data seeding complete!');
    console.log('\n📊 Summary:');
    console.log(`  • Tenant: ${tenant.name}`);
    console.log(`  • Employees: 1,000`);
    console.log(`  • Managers: ~100`);
    console.log(`  • Attendance Records: ${attendanceRecords.toLocaleString()}`);
    console.log(`  • Leave Requests: ${leaveRequestsCreated}`);
    console.log(`  • Regularization Requests: ${regularizationCreated}`);
    console.log(`  • Holidays: ${holidays.length}`);
    console.log(`  • Audit Logs: 100`);
    console.log('\n🔑 Test Credentials:');
    console.log(`  Super Admin: superadmin@acme.com / ChangeMe123!`);
    console.log(`  HR Admin: hr@acme.com / ChangeMe123!`);
    console.log(`  Any Employee: (email format: firstname.lastname@acme.com) / ChangeMe123!`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedProductionData();
