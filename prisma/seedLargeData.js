import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

const TENANT_ID = 'test-tenant-001';
const TENANT_KEY = 'test-key-123456789';

async function hashPassword(password) {
  return hash(password, {
    type: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function seedLargeData() {
  console.log('🌱 Starting large data seed...');
  const startTime = Date.now();

  try {
    // 1. Ensure tenant exists
    console.log('📍 Creating/verifying tenant...');
    const tenant = await prisma.tenant.upsert({
      where: { tenantKey: TENANT_KEY },
      update: {},
      create: {
        tenantKey: TENANT_KEY,
        name: 'Test Organization',
        legalName: 'Test Organization Inc.',
        displayName: 'Test Org',
        country: 'US',
        primaryContactEmail: 'admin@testorg.com',
      },
    });
    console.log(`✅ Tenant: ${tenant.id}`);

    // 2. Create users
    console.log('👥 Creating users...');
    const userPassword = await hashPassword('password123');
    const adminUser = await prisma.user.upsert({
      where: {
        tenantId_email: {
          tenantId: tenant.id,
          email: 'admin@testorg.com',
        },
      },
      update: {
        passwordHash: userPassword,
        memberType: 'HR_ADMIN',
        status: 'ACTIVE',
      },
      create: {
        tenantId: tenant.id,
        email: 'admin@testorg.com',
        passwordHash: userPassword,
        memberType: 'HR_ADMIN',
        status: 'ACTIVE',
      },
    });
    console.log(`✅ Admin user created: ${adminUser.id}`);

    // 3. Create departments
    console.log('🏢 Creating 8 departments...');
    const departmentNames = [
      'Engineering',
      'Sales',
      'Marketing',
      'Human Resources',
      'Finance',
      'Operations',
      'Product',
      'Support',
    ];
    const departments = [];
    for (const deptName of departmentNames) {
      const dept = await prisma.department.upsert({
        where: {
          tenantId_departmentCode: {
            tenantId: tenant.id,
            departmentCode: deptName.toUpperCase().replace(/\s+/g, '_'),
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          name: deptName,
          departmentCode: deptName.toUpperCase().replace(/\s+/g, '_'),
        },
      });
      departments.push(dept);
    }
    console.log(`✅ Created ${departments.length} departments`);

    // 4. Create leave types
    console.log('📋 Creating 5 leave types...');
    const leaveTypes = [
      { name: 'Annual Leave', code: 'ANNUAL', annualAllowance: 20 },
      { name: 'Sick Leave', code: 'SICK', annualAllowance: 10 },
      { name: 'Maternity Leave', code: 'MATERNITY', annualAllowance: 180 },
      { name: 'Casual Leave', code: 'CASUAL', annualAllowance: 5 },
      { name: 'Unpaid Leave', code: 'UNPAID', annualAllowance: 0 },
    ];
    const createdLeaveTypes = [];
    for (const lt of leaveTypes) {
      const leaveType = await prisma.leaveType.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: lt.code,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          name: lt.name,
          code: lt.code,
          annualAllowance: lt.annualAllowance,
          isPaid: lt.code !== 'UNPAID',
        },
      });
      createdLeaveTypes.push(leaveType);
    }
    console.log(`✅ Created ${createdLeaveTypes.length} leave types`);

    // 5. Create 150 employees
    console.log('👔 Creating 150 employees...');
    const firstNames = [
      'John',
      'Jane',
      'Michael',
      'Sarah',
      'David',
      'Emma',
      'Robert',
      'Lisa',
      'James',
      'Mary',
    ];
    const lastNames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Rodriguez',
      'Martinez',
    ];
    const designations = [
      'Software Engineer',
      'Senior Engineer',
      'Manager',
      'Sales Executive',
      'Marketing Manager',
      'HR Specialist',
      'Accountant',
      'Operations Manager',
      'Product Manager',
      'Support Lead',
    ];

    const employees = [];
    for (let i = 1; i <= 150; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const deptIdx = (i - 1) % departments.length;
      const designationIdx = (i - 1) % designations.length;

      const emp = await prisma.employee.upsert({
        where: {
          tenantId_workEmail: {
            tenantId: tenant.id,
            workEmail: `emp${i}@testorg.com`,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          employeeCode: `EMP${String(i).padStart(4, '0')}`,
          firstName,
          lastName,
          workEmail: `emp${i}@testorg.com`,
          personalEmail: `personal${i}@gmail.com`,
          phone: `+1-555-${String(i).padStart(4, '0')}`,
          dateOfBirth: new Date(1990 + Math.floor(i / 15), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
          address: `${i} Main Street, City, State 12345`,
          designation: designations[designationIdx],
          departmentId: departments[deptIdx].id,
          joinedOn: new Date(2020 + Math.floor(i / 50), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          employmentType: 'FULL_TIME',
          employmentStatus: 'ACTIVE',
          location: 'New York',
        },
      });
      employees.push(emp);

      if (i % 30 === 0) console.log(`  ✓ Created ${i} employees...`);
    }
    console.log(`✅ Created ${employees.length} employees`);

    // 6. Create leave balances for all employees
    console.log('⚖️ Creating leave balances...');
    for (const emp of employees) {
      for (const lt of createdLeaveTypes) {
        await prisma.leaveBalance.upsert({
          where: {
            tenantId_employeeId_leaveTypeId: {
              tenantId: tenant.id,
              employeeId: emp.id,
              leaveTypeId: lt.id,
            },
          },
          update: {},
          create: {
            tenantId: tenant.id,
            employeeId: emp.id,
            leaveTypeId: lt.id,
            balance: lt.annualAllowance,
            used: 0,
            pending: 0,
          },
        });
      }
    }
    console.log(`✅ Created leave balances for all employees`);

    // 7. Create 200+ leave requests
    console.log('📅 Creating 200+ leave requests...');
    let leaveRequestCount = 0;
    for (let i = 0; i < 200; i++) {
      const emp = employees[Math.floor(Math.random() * employees.length)];
      const lt = createdLeaveTypes[Math.floor(Math.random() * createdLeaveTypes.length)];
      const startDate = new Date(2026, 4 + Math.floor(i / 40), (i % 28) + 1);
      const daysCount = Math.floor(Math.random() * 5) + 1;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + daysCount);

      const statuses = ['PENDING', 'APPROVED', 'DENIED'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const approverId = status === 'PENDING' ? null : adminUser.id;

      await prisma.leaveRequest.create({
        data: {
          tenantId: tenant.id,
          employeeId: emp.id,
          leaveTypeId: lt.id,
          startDate,
          endDate,
          totalDays: daysCount,
          reason: `${lt.name} request`,
          status,
          approverId,
          approverComment: status === 'DENIED' ? 'Insufficient balance' : null,
        },
      });
      leaveRequestCount++;

      if ((i + 1) % 50 === 0) console.log(`  ✓ Created ${i + 1} leave requests...`);
    }
    console.log(`✅ Created ${leaveRequestCount} leave requests`);

    // 8. Create 500+ attendance records
    console.log('📊 Creating 500+ attendance records...');
    let attendanceCount = 0;
    for (const emp of employees.slice(0, 50)) {
      for (let day = 1; day <= 10; day++) {
        const attendanceDate = new Date(2026, 4, day);
        const statuses = ['PRESENT', 'ABSENT', 'WFH', 'HOLIDAY'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        const checkInAt = status === 'PRESENT' || status === 'WFH'
          ? new Date(attendanceDate.setHours(9, Math.floor(Math.random() * 60), 0))
          : null;

        const checkOutAt = status === 'PRESENT' || status === 'WFH'
          ? new Date(attendanceDate.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0))
          : null;

        await prisma.attendanceRecord.create({
          data: {
            tenantId: tenant.id,
            employeeId: emp.id,
            attendanceDate,
            checkInAt,
            checkOutAt,
            workMode: Math.random() > 0.7 ? 'WFH' : 'OFFICE',
            status,
            totalMinutes: checkInAt && checkOutAt
              ? Math.floor((checkOutAt - checkInAt) / (1000 * 60))
              : null,
            notes: `Attendance record for ${emp.firstName}`,
          },
        });
        attendanceCount++;
      }
    }
    console.log(`✅ Created ${attendanceCount} attendance records`);

    // 9. Create 15 holidays
    console.log('🎉 Creating 15 holidays...');
    const holidays = [
      { name: 'New Year', date: new Date(2026, 0, 1) },
      { name: 'Martin Luther King Jr. Day', date: new Date(2026, 0, 19) },
      { name: 'Presidents Day', date: new Date(2026, 1, 16) },
      { name: 'Memorial Day', date: new Date(2026, 4, 25) },
      { name: 'Independence Day', date: new Date(2026, 6, 4) },
      { name: 'Labor Day', date: new Date(2026, 8, 7) },
      { name: 'Columbus Day', date: new Date(2026, 9, 12) },
      { name: 'Veterans Day', date: new Date(2026, 10, 11) },
      { name: 'Thanksgiving', date: new Date(2026, 10, 26) },
      { name: 'Christmas Eve', date: new Date(2026, 11, 24) },
      { name: 'Christmas', date: new Date(2026, 11, 25) },
      { name: 'New Years Eve', date: new Date(2026, 11, 31) },
      { name: 'Easter', date: new Date(2026, 3, 5) },
      { name: 'Thanksgiving Day', date: new Date(2026, 10, 27) },
      { name: 'Summer Break', date: new Date(2026, 6, 15) },
    ];

    for (const holiday of holidays) {
      await prisma.holiday.create({
        data: {
          tenantId: tenant.id,
          name: holiday.name,
          holidayDate: holiday.date,
          location: 'All Locations',
          isOptional: false,
        },
      });
    }
    console.log(`✅ Created ${holidays.length} holidays`);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✨ Data seeding completed in ${totalTime}s`);
    console.log(`\nSummary:`);
    console.log(`  • Tenant: 1`);
    console.log(`  • Users: 1`);
    console.log(`  • Departments: ${departments.length}`);
    console.log(`  • Leave Types: ${createdLeaveTypes.length}`);
    console.log(`  • Employees: ${employees.length}`);
    console.log(`  • Leave Requests: ${leaveRequestCount}`);
    console.log(`  • Attendance Records: ${attendanceCount}`);
    console.log(`  • Holidays: ${holidays.length}`);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedLargeData().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
