import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

const seedPassword = 'Password123!';

async function hashPassword(password) {
  return hash(password, {
    type: 2,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

async function main() {
  console.log('🌱 Seeding database...');

  // Upsert Tenant — safe to re-run
  const tenant = await prisma.tenant.upsert({
    where: { tenantKey: 'acme-corp-001' },
    update: {},
    create: {
      tenantKey: 'acme-corp-001',
      slug: 'acme',
      name: 'Acme Corp',
      legalName: 'Acme Corporation Pvt Ltd',
      displayName: 'Acme',
      country: 'India',
      defaultCurrency: 'INR',
      timezone: 'Asia/Kolkata',
      fiscalYearStart: 4,
      primaryContactEmail: 'hr@acme.test',
      supportPhone: '+91 11 40000000',
    },
  });
  console.log(`✅ Tenant: ${tenant.id} (${tenant.tenantKey})`);

  // Upsert Permissions
  const permissionData = [
    { key: 'employees:read', module: 'employees', description: 'View employees' },
    { key: 'employees:write', module: 'employees', description: 'Create/edit employees' },
    { key: 'employees:delete', module: 'employees', description: 'Delete employees' },
    { key: 'employees:export', module: 'employees', description: 'Export employees' },
    { key: 'departments:read', module: 'departments', description: 'View departments' },
    { key: 'departments:write', module: 'departments', description: 'Create/edit departments' },
    { key: 'attendance:read', module: 'attendance', description: 'View attendance' },
    { key: 'attendance:write', module: 'attendance', description: 'Check-in/out and regularize' },
    { key: 'leave:read', module: 'leave', description: 'View leave' },
    { key: 'leave:request', module: 'leave', description: 'Request leave' },
    { key: 'leave:approve', module: 'leave', description: 'Approve/deny leave' },
    { key: 'analytics:read', module: 'analytics', description: 'View analytics' },
    { key: 'permissions:manage', module: 'permissions', description: 'Manage roles and permissions' },
    { key: 'audit:read', module: 'audit', description: 'View audit logs' },
  ];

  const permissions = await Promise.all(
    permissionData.map((p) =>
      prisma.permission.upsert({
        where: { key: p.key },
        update: {},
        create: p,
      }),
    ),
  );
  console.log(`✅ Permissions: ${permissions.length}`);

  // Upsert Roles (tenant-scoped)
  const roleData = [
    { name: 'Super Admin', key: 'SUPER_ADMIN', isSystem: true },
    { name: 'HR Admin', key: 'HR_ADMIN', isSystem: true },
    { name: 'Manager', key: 'MANAGER', isSystem: true },
    { name: 'Employee', key: 'EMPLOYEE', isSystem: true },
    { name: 'Auditor', key: 'AUDITOR', isSystem: true },
  ];

  const roles = await Promise.all(
    roleData.map((r) =>
      prisma.role.upsert({
        where: { tenantId_key: { tenantId: tenant.id, key: r.key } },
        update: {},
        create: { ...r, tenantId: tenant.id },
      }),
    ),
  );
  console.log(`✅ Roles: ${roles.length}`);

  // Build permission map
  const permissionMap = {};
  for (const p of permissions) {
    permissionMap[p.key] = p.id;
  }

  const allPermissions = Object.values(permissionMap);
  const superAdminRole = roles.find((r) => r.key === 'SUPER_ADMIN');
  const hrAdminRole = roles.find((r) => r.key === 'HR_ADMIN');
  const managerRole = roles.find((r) => r.key === 'MANAGER');
  const employeeRole = roles.find((r) => r.key === 'EMPLOYEE');
  const auditorRole = roles.find((r) => r.key === 'AUDITOR');

  const assignPermissions = async (roleId, permKeys) => {
    for (const key of permKeys) {
      const permId = permissionMap[key];
      if (!permId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permId } },
        update: {},
        create: { roleId, permissionId: permId },
      });
    }
  };

  await assignPermissions(superAdminRole.id, permissionData.map((p) => p.key));
  await assignPermissions(hrAdminRole.id, [
    'employees:read', 'employees:write', 'employees:delete', 'employees:export',
    'departments:read', 'departments:write', 'attendance:read', 'attendance:write',
    'leave:read', 'leave:approve', 'analytics:read', 'audit:read',
  ]);
  await assignPermissions(managerRole.id, ['attendance:read', 'leave:approve', 'audit:read']);
  await assignPermissions(employeeRole.id, ['attendance:read', 'attendance:write', 'leave:read', 'leave:request', 'audit:read']);
  await assignPermissions(auditorRole.id, ['employees:read', 'departments:read', 'attendance:read', 'leave:read', 'analytics:read', 'audit:read']);
  console.log('✅ Role-Permission mappings done');

  // Hash password once
  const pwHash = await hashPassword(seedPassword);

  // Upsert Users — safe to re-run
  const superAdminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'superadmin@acme.test' } },
    update: { passwordHash: pwHash, status: 'ACTIVE' },
    create: { tenantId: tenant.id, email: 'superadmin@acme.test', passwordHash: pwHash, memberType: 'SUPER_ADMIN', status: 'ACTIVE' },
  });

  const hrAdminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'hr@acme.test' } },
    update: { passwordHash: pwHash, status: 'ACTIVE' },
    create: { tenantId: tenant.id, email: 'hr@acme.test', passwordHash: pwHash, memberType: 'HR_ADMIN', status: 'ACTIVE' },
  });

  const managerUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'aman@acme.test' } },
    update: { passwordHash: pwHash, status: 'ACTIVE' },
    create: { tenantId: tenant.id, email: 'aman@acme.test', passwordHash: pwHash, memberType: 'MANAGER', status: 'ACTIVE' },
  });

  const employeeUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'priya@acme.test' } },
    update: { passwordHash: pwHash, status: 'ACTIVE' },
    create: { tenantId: tenant.id, email: 'priya@acme.test', passwordHash: pwHash, memberType: 'EMPLOYEE', status: 'ACTIVE' },
  });

  console.log('✅ Users: 4 seed users');

  // Assign roles to users (idempotent)
  for (const [userId, roleId] of [
    [superAdminUser.id, superAdminRole.id],
    [hrAdminUser.id, hrAdminRole.id],
    [managerUser.id, managerRole.id],
    [employeeUser.id, employeeRole.id],
  ]) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }
  console.log('✅ User roles assigned');

  // Upsert Departments
  const deptDefs = [
    { name: 'Engineering', code: 'ENG' },
    { name: 'Sales', code: 'SALES' },
    { name: 'HR', code: 'HR' },
    { name: 'Finance', code: 'FIN' },
    { name: 'Operations', code: 'OPS' },
    { name: 'Product', code: 'PRO' },
    { name: 'Marketing', code: 'MAR' },
    { name: 'Customer Success', code: 'CUS' },
  ];

  const depts = [];
  for (const d of deptDefs) {
    const dept = await prisma.department.upsert({
      where: { tenantId_departmentCode: { tenantId: tenant.id, departmentCode: d.code } },
      update: {},
      create: { tenantId: tenant.id, name: d.name, departmentCode: d.code, depth: 0 },
    });
    depts.push(dept);
  }
  const [engineeringDept, , hrDept] = depts;
  console.log(`✅ Departments: ${depts.length}`);

  // Upsert core Employees — update userId so re-runs re-link correctly
  const managerEmployee = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: 'E0001' } },
    update: { userId: managerUser.id },
    create: {
      tenantId: tenant.id, userId: managerUser.id, employeeCode: 'E0001',
      firstName: 'Aman', lastName: 'Kumar', workEmail: 'aman@acme.test',
      personalEmail: 'aman.kumar@gmail.com', phone: '+91 98765 43210',
      dateOfBirth: new Date('1990-03-15'), gender: 'MALE', address: 'Delhi, India',
      emergencyContactName: 'Priya Kumar', emergencyContactPhone: '+91 98765 43215',
      designation: 'Engineering Manager', departmentId: engineeringDept.id,
      joinedOn: new Date('2020-01-15'), employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE', location: 'Delhi', payCurrency: 'INR',
      createdBy: hrAdminUser.id,
    },
  });

  const employeeEmployee = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: 'E0002' } },
    update: { userId: employeeUser.id },
    create: {
      tenantId: tenant.id, userId: employeeUser.id, employeeCode: 'E0002',
      firstName: 'Priya', lastName: 'Sharma', workEmail: 'priya@acme.test',
      personalEmail: 'priya.sharma@gmail.com', phone: '+91 98765 43211',
      dateOfBirth: new Date('1995-08-22'), gender: 'FEMALE', address: 'Noida, India',
      emergencyContactName: 'Raj Sharma', emergencyContactPhone: '+91 98765 43216',
      designation: 'Senior Engineer', departmentId: engineeringDept.id,
      managerId: managerEmployee.id, joinedOn: new Date('2021-06-10'),
      employmentType: 'FULL_TIME', employmentStatus: 'ACTIVE',
      location: 'Delhi', payCurrency: 'INR', createdBy: hrAdminUser.id,
    },
  });

  const hrEmployee = await prisma.employee.upsert({
    where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: 'E0003' } },
    update: { userId: hrAdminUser.id },
    create: {
      tenantId: tenant.id, userId: hrAdminUser.id, employeeCode: 'E0003',
      firstName: 'HR', lastName: 'Admin', workEmail: 'hr@acme.test',
      personalEmail: 'hr@acme.test', phone: '+91 98765 43212',
      designation: 'HR Manager', departmentId: hrDept.id,
      joinedOn: new Date('2019-01-10'), employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE', location: 'Delhi', payCurrency: 'INR',
      createdBy: superAdminUser.id,
    },
  });

  // Clear any stale employeeId links before re-assigning (makes seed idempotent across user changes)
  await prisma.user.updateMany({ where: { employeeId: managerEmployee.id, NOT: { id: managerUser.id } }, data: { employeeId: null } });
  await prisma.user.updateMany({ where: { employeeId: employeeEmployee.id, NOT: { id: employeeUser.id } }, data: { employeeId: null } });
  await prisma.user.updateMany({ where: { employeeId: hrEmployee.id, NOT: { id: hrAdminUser.id } }, data: { employeeId: null } });

  // Link employeeId back to user
  await prisma.user.update({ where: { id: managerUser.id }, data: { employeeId: managerEmployee.id } });
  await prisma.user.update({ where: { id: employeeUser.id }, data: { employeeId: employeeEmployee.id } });
  await prisma.user.update({ where: { id: hrAdminUser.id }, data: { employeeId: hrEmployee.id } });

  console.log('✅ Core employees: 3');

  // Upsert Leave Types
  const leaveTypeDefs = [
    { code: 'ANNUAL', name: 'Annual Leave', annualAllowance: 21, carryForwardAllowed: true, isPaid: true },
    { code: 'SICK', name: 'Sick Leave', annualAllowance: 10, carryForwardAllowed: false, isPaid: true },
    { code: 'CASUAL', name: 'Casual Leave', annualAllowance: 12, carryForwardAllowed: false, isPaid: true },
  ];

  const leaveTypes = [];
  for (const lt of leaveTypeDefs) {
    const leaveType = await prisma.leaveType.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: lt.code } },
      update: {},
      create: { tenantId: tenant.id, isActive: true, ...lt },
    });
    leaveTypes.push(leaveType);
  }
  console.log(`✅ Leave types: ${leaveTypes.length}`);

  // Upsert Holidays
  const currentYear = new Date().getFullYear();
  const holidayDefs = [
    { name: 'Independence Day', date: new Date(`${currentYear}-08-15`) },
    { name: 'Gandhi Jayanti', date: new Date(`${currentYear}-10-02`) },
    { name: 'Christmas', date: new Date(`${currentYear}-12-25`) },
    { name: 'New Year', date: new Date(`${currentYear + 1}-01-01`) },
  ];

  for (const h of holidayDefs) {
    const existing = await prisma.holiday.findFirst({ where: { tenantId: tenant.id, name: h.name, holidayDate: h.date } });
    if (!existing) {
      await prisma.holiday.create({ data: { tenantId: tenant.id, name: h.name, holidayDate: h.date, location: 'India', isOptional: false } });
    }
  }
  console.log(`✅ Holidays: ${holidayDefs.length}`);

  // Bulk employees (skip if already exist)
  const firstNames = ['Rajesh', 'Sakshi', 'Vikram', 'Neha', 'Amit', 'Deepika', 'Arjun', 'Ananya', 'Rohan', 'Zara',
    'Karan', 'Pooja', 'Nikhil', 'Anjali', 'Sanjay', 'Ritika', 'Aditya', 'Sneha', 'Rahul', 'Divya',
    'Manish', 'Preeti', 'Varun', 'Swati', 'Harish', 'Pallavi', 'Ashok', 'Shreya', 'Suresh', 'Avni',
    'Ravi', 'Isha', 'Manoj', 'Nisha', 'Shailesh', 'Diya', 'Pawan', 'Aarav', 'Anushka', 'Naveen',
    'Jaya', 'Kartik', 'Tanya', 'Subhash', 'Akshita', 'Mahesh', 'Kavya', 'Sameer', 'Esha', 'Aryan'];
  const lastNames = ['Sharma', 'Singh', 'Patel', 'Kumar', 'Verma', 'Gupta', 'Malhotra', 'Joshi', 'Rao', 'Bhat'];

  const employees = [managerEmployee, employeeEmployee, hrEmployee];
  for (let i = 0; i < 62; i++) {
    const dept = depts[i % depts.length];
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const code = `E${String(i + 4).padStart(4, '0')}`;
    const emp = await prisma.employee.upsert({
      where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: code } },
      update: {},
      create: {
        tenantId: tenant.id,
        employeeCode: code,
        firstName, lastName,
        workEmail: `emp${i + 4}@acme.test`,
        personalEmail: `emp${i + 4}@gmail.com`,
        phone: `+91 98765 ${String(10000 + i).padStart(5, '0')}`,
        dateOfBirth: new Date(1985 + (i % 25), i % 12, (i % 28) + 1),
        gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
        address: `${['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Pune'][i % 5]}, India`,
        emergencyContactName: `${firstName} Family`,
        emergencyContactPhone: `+91 98765 ${String(20000 + i).padStart(5, '0')}`,
        designation: ['Senior Engineer', 'Software Developer', 'Product Manager', 'Sales Executive', 'Financial Analyst', 'Operations Coordinator'][i % 6],
        departmentId: dept.id,
        managerId: i % 3 === 0 ? managerEmployee.id : undefined,
        joinedOn: new Date(2020 + (i % 4), i % 12, (i % 28) + 1),
        employmentType: 'FULL_TIME',
        employmentStatus: i % 10 === 0 ? 'INACTIVE' : 'ACTIVE',
        location: ['Delhi', 'Mumbai', 'Bangalore'][i % 3],
        payCurrency: 'INR',
        createdBy: hrAdminUser.id,
      },
    });
    employees.push(emp);
  }
  console.log(`✅ Total employees: ${employees.length}`);

  // Leave Balances for core employees only (skip if exist)
  for (const emp of [managerEmployee, employeeEmployee, hrEmployee]) {
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.upsert({
        where: { tenantId_employeeId_leaveTypeId: { tenantId: tenant.id, employeeId: emp.id, leaveTypeId: lt.id } },
        update: {},
        create: {
          tenantId: tenant.id, employeeId: emp.id, leaveTypeId: lt.id,
          balance: lt.code === 'ANNUAL' ? 21 : 10, used: 0, pending: 0,
        },
      });
    }
  }
  console.log('✅ Leave balances for core employees');

  // Attendance records for core employees last 30 days (skip weekends, skip if exist)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const emp of [managerEmployee, employeeEmployee, hrEmployee]) {
    for (let d = 1; d <= 30; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dow = date.getDay();
      if (dow === 0 || dow === 6) continue;

      await prisma.attendanceRecord.upsert({
        where: { tenantId_employeeId_attendanceDate: { tenantId: tenant.id, employeeId: emp.id, attendanceDate: date } },
        update: {},
        create: {
          tenantId: tenant.id, employeeId: emp.id, attendanceDate: date,
          status: 'PRESENT',
          checkInAt: new Date(date.getTime() + 9 * 60 * 60 * 1000),
          checkOutAt: new Date(date.getTime() + 18 * 60 * 60 * 1000),
          totalMinutes: 540, workMode: 'OFFICE',
        },
      });
    }
  }
  console.log('✅ Attendance records for core employees (30 days)');

  console.log('\n🎉 Seeding complete!');
  console.log(`
Seed Users (password: ${seedPassword}):
  superadmin@acme.test  → SUPER_ADMIN
  hr@acme.test          → HR_ADMIN     (employeeId linked)
  aman@acme.test        → MANAGER      (employeeId linked)
  priya@acme.test       → EMPLOYEE     (employeeId linked)

  x-tenant-key: acme-corp-001
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
