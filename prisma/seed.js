import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

const seedPassword = 'ChangeMe123!';

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

  // Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
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
  console.log(`✅ Tenant created: ${tenant.id}`);

  // Create Permissions
  const permissionData = [
    // Employees
    { key: 'employees:read', module: 'employees', description: 'View employees' },
    { key: 'employees:write', module: 'employees', description: 'Create/edit employees' },
    { key: 'employees:delete', module: 'employees', description: 'Delete employees' },
    { key: 'employees:export', module: 'employees', description: 'Export employees' },
    // Departments
    { key: 'departments:read', module: 'departments', description: 'View departments' },
    { key: 'departments:write', module: 'departments', description: 'Create/edit departments' },
    // Attendance
    { key: 'attendance:read', module: 'attendance', description: 'View attendance' },
    { key: 'attendance:write', module: 'attendance', description: 'Check-in/out and regularize' },
    // Leave
    { key: 'leave:read', module: 'leave', description: 'View leave' },
    { key: 'leave:request', module: 'leave', description: 'Request leave' },
    { key: 'leave:approve', module: 'leave', description: 'Approve/deny leave' },
    // Analytics
    { key: 'analytics:read', module: 'analytics', description: 'View analytics' },
    // Permissions
    { key: 'permissions:manage', module: 'permissions', description: 'Manage roles and permissions' },
    // Audit
    { key: 'audit:read', module: 'audit', description: 'View audit logs' },
  ];

  const permissions = await Promise.all(
    permissionData.map((p) =>
      prisma.permission.create({ data: p }).catch(() => undefined),
    ),
  );
  console.log(`✅ Permissions created: ${permissions.filter((p) => p).length}`);

  // Create Roles
  const roleData = [
    { name: 'Super Admin', key: 'SUPER_ADMIN', isSystem: true },
    { name: 'HR Admin', key: 'HR_ADMIN', isSystem: true },
    { name: 'Manager', key: 'MANAGER', isSystem: true },
    { name: 'Employee', key: 'EMPLOYEE', isSystem: true },
    { name: 'Auditor', key: 'AUDITOR', isSystem: true },
  ];

  const roles = await Promise.all(
    roleData.map((r) =>
      prisma.role.create({
        data: { ...r, tenantId: tenant.id },
      }),
    ),
  );
  console.log(`✅ Roles created: ${roles.length}`);

  // Map permissions to roles
  const permissionMap = {};
  for (const p of permissionData) {
    const perm = await prisma.permission.findUnique({ where: { key: p.key } });
    if (perm) permissionMap[p.key] = perm.id;
  }

  const allPermissions = Object.values(permissionMap);
  const superAdminRole = roles.find((r) => r.key === 'SUPER_ADMIN');
  const hrAdminRole = roles.find((r) => r.key === 'HR_ADMIN');
  const managerRole = roles.find((r) => r.key === 'MANAGER');
  const employeeRole = roles.find((r) => r.key === 'EMPLOYEE');
  const auditorRole = roles.find((r) => r.key === 'AUDITOR');

  // Super Admin has all permissions
  await Promise.all(
    allPermissions.map((permId) =>
      prisma.rolePermission.create({
        data: { roleId: superAdminRole.id, permissionId: permId },
      }).catch(() => undefined),
    ),
  );

  // HR Admin has employees, departments, attendance, leave approve, analytics, audit
  const hrPermissions = [
    'employees:read',
    'employees:write',
    'employees:delete',
    'employees:export',
    'departments:read',
    'departments:write',
    'attendance:read',
    'attendance:write',
    'leave:read',
    'leave:approve',
    'analytics:read',
    'audit:read',
  ];
  await Promise.all(
    hrPermissions.map((key) =>
      prisma.rolePermission.create({
        data: { roleId: hrAdminRole.id, permissionId: permissionMap[key] },
      }).catch(() => undefined),
    ),
  );

  // Manager has attendance read, leave approve for team, audit read
  const managerPermissions = ['attendance:read', 'leave:approve', 'audit:read'];
  await Promise.all(
    managerPermissions.map((key) =>
      prisma.rolePermission.create({
        data: { roleId: managerRole.id, permissionId: permissionMap[key] },
      }).catch(() => undefined),
    ),
  );

  // Employee has leave read, leave request, attendance read/write, audit read
  const employeePermissions = [
    'attendance:read',
    'attendance:write',
    'leave:read',
    'leave:request',
    'audit:read',
  ];
  await Promise.all(
    employeePermissions.map((key) =>
      prisma.rolePermission.create({
        data: { roleId: employeeRole.id, permissionId: permissionMap[key] },
      }).catch(() => undefined),
    ),
  );

  // Auditor has read-only
  const auditorPermissions = [
    'employees:read',
    'departments:read',
    'attendance:read',
    'leave:read',
    'analytics:read',
    'audit:read',
  ];
  await Promise.all(
    auditorPermissions.map((key) =>
      prisma.rolePermission.create({
        data: { roleId: auditorRole.id, permissionId: permissionMap[key] },
      }).catch(() => undefined),
    ),
  );

  console.log('✅ Role-Permission mappings created');

  // Create Users with hashed passwords
  const superAdminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'superadmin@acme.test',
      passwordHash: await hashPassword(seedPassword),
      memberType: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  const hrAdminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'hr@acme.test',
      passwordHash: await hashPassword(seedPassword),
      memberType: 'HR_ADMIN',
      status: 'ACTIVE',
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'aman@acme.test',
      passwordHash: await hashPassword(seedPassword),
      memberType: 'MANAGER',
      status: 'ACTIVE',
    },
  });

  const employeeUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'priya@acme.test',
      passwordHash: await hashPassword(seedPassword),
      memberType: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Users created (4 seed users)');

  // Assign roles to users
  await prisma.userRole.create({ data: { userId: superAdminUser.id, roleId: superAdminRole.id } });
  await prisma.userRole.create({ data: { userId: hrAdminUser.id, roleId: hrAdminRole.id } });
  await prisma.userRole.create({ data: { userId: managerUser.id, roleId: managerRole.id } });
  await prisma.userRole.create({ data: { userId: employeeUser.id, roleId: employeeRole.id } });
  console.log('✅ User roles assigned');

  // Create Departments
  const engineeringDept = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      name: 'Engineering',
      departmentCode: 'ENG',
      depth: 0,
    },
  });

  const salesDept = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      name: 'Sales',
      departmentCode: 'SALES',
      depth: 0,
    },
  });

  const hrDept = await prisma.department.create({
    data: {
      tenantId: tenant.id,
      name: 'HR',
      departmentCode: 'HR',
      depth: 0,
    },
  });

  console.log(`✅ Departments created: 3`);

  // Create Employees
  const managerEmployee = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      userId: managerUser.id,
      employeeCode: 'E0001',
      firstName: 'Aman',
      lastName: 'Kumar',
      workEmail: 'aman@acme.test',
      personalEmail: 'aman.kumar@gmail.com',
      phone: '+91 98765 43210',
      dateOfBirth: new Date('1990-03-15'),
      gender: 'MALE',
      address: 'Delhi, India',
      emergencyContactName: 'Priya Kumar',
      emergencyContactPhone: '+91 98765 43215',
      designation: 'Engineering Manager',
      departmentId: engineeringDept.id,
      joinedOn: new Date('2020-01-15'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      location: 'Delhi',
      payCurrency: 'INR',
      createdBy: hrAdminUser.id,
    },
  });

  const employeeEmployee = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      userId: employeeUser.id,
      employeeCode: 'E0002',
      firstName: 'Priya',
      lastName: 'Sharma',
      workEmail: 'priya@acme.test',
      personalEmail: 'priya.sharma@gmail.com',
      phone: '+91 98765 43211',
      dateOfBirth: new Date('1995-08-22'),
      gender: 'FEMALE',
      address: 'Noida, India',
      emergencyContactName: 'Raj Sharma',
      emergencyContactPhone: '+91 98765 43216',
      designation: 'Senior Engineer',
      departmentId: engineeringDept.id,
      managerId: managerEmployee.id,
      joinedOn: new Date('2021-06-10'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      location: 'Delhi',
      payCurrency: 'INR',
      createdBy: hrAdminUser.id,
    },
  });

  const hrEmployee = await prisma.employee.create({
    data: {
      tenantId: tenant.id,
      userId: hrAdminUser.id,
      employeeCode: 'E0003',
      firstName: 'HR',
      lastName: 'Admin',
      workEmail: 'hr@acme.test',
      personalEmail: 'hr@acme.test',
      phone: '+91 98765 43212',
      designation: 'HR Manager',
      departmentId: hrDept.id,
      joinedOn: new Date('2019-01-10'),
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      location: 'Delhi',
      payCurrency: 'INR',
      createdBy: superAdminUser.id,
    },
  });

  console.log(`✅ Employees created: 3`);

  // Update manager and HR employee with their actual IDs
  await prisma.user.update({
    where: { id: managerUser.id },
    data: { employeeId: managerEmployee.id },
  });
  await prisma.user.update({
    where: { id: employeeUser.id },
    data: { employeeId: employeeEmployee.id },
  });
  await prisma.user.update({
    where: { id: hrAdminUser.id },
    data: { employeeId: hrEmployee.id },
  });

  // Create Leave Types
  const annualLeave = await prisma.leaveType.create({
    data: {
      tenantId: tenant.id,
      name: 'Annual Leave',
      code: 'ANNUAL',
      annualAllowance: 21,
      carryForwardAllowed: true,
      isPaid: true,
      isActive: true,
    },
  });

  const sickLeave = await prisma.leaveType.create({
    data: {
      tenantId: tenant.id,
      name: 'Sick Leave',
      code: 'SICK',
      annualAllowance: 10,
      carryForwardAllowed: false,
      isPaid: true,
      isActive: true,
    },
  });

  const casualLeave = await prisma.leaveType.create({
    data: {
      tenantId: tenant.id,
      name: 'Casual Leave',
      code: 'CASUAL',
      annualAllowance: 12,
      carryForwardAllowed: false,
      isPaid: true,
      isActive: true,
    },
  });

  console.log(`✅ Leave types created: 3`);

  // Create Leave Balances
  await prisma.leaveBalance.create({
    data: {
      tenantId: tenant.id,
      employeeId: managerEmployee.id,
      leaveTypeId: annualLeave.id,
      balance: 21,
      used: 0,
      pending: 0,
    },
  });

  await prisma.leaveBalance.create({
    data: {
      tenantId: tenant.id,
      employeeId: managerEmployee.id,
      leaveTypeId: sickLeave.id,
      balance: 10,
      used: 0,
      pending: 0,
    },
  });

  await prisma.leaveBalance.create({
    data: {
      tenantId: tenant.id,
      employeeId: employeeEmployee.id,
      leaveTypeId: annualLeave.id,
      balance: 21,
      used: 0,
      pending: 0,
    },
  });

  await prisma.leaveBalance.create({
    data: {
      tenantId: tenant.id,
      employeeId: employeeEmployee.id,
      leaveTypeId: sickLeave.id,
      balance: 10,
      used: 0,
      pending: 0,
    },
  });

  console.log('✅ Leave balances created');

  // Create Holidays
  const currentYear = new Date().getFullYear();
  const holidays = [
    { name: 'Independence Day', date: new Date(`${currentYear}-08-15`) },
    { name: 'Gandhi Jayanti', date: new Date(`${currentYear}-10-02`) },
    { name: 'Christmas', date: new Date(`${currentYear}-12-25`) },
    { name: 'New Year', date: new Date(`${currentYear + 1}-01-01`) },
  ];

  await Promise.all(
    holidays.map((h) =>
      prisma.holiday.create({
        data: {
          tenantId: tenant.id,
          name: h.name,
          holidayDate: h.date,
          location: 'India',
          isOptional: false,
        },
      }),
    ),
  );
  console.log(`✅ Holidays created: ${holidays.length}`);

  // Create Additional Departments (8 total)
  const depts = [engineeringDept, salesDept, hrDept];
  const deptNames = ['Finance', 'Operations', 'Product', 'Marketing', 'Customer Success'];
  for (const name of deptNames) {
    const dept = await prisma.department.create({
      data: {
        tenantId: tenant.id,
        name,
        departmentCode: name.substring(0, 3).toUpperCase(),
        depth: 0,
      },
    });
    depts.push(dept);
  }
  console.log(`✅ Additional departments created: ${depts.length - 3}`);

  // Create 60+ Employees
  const employees = [managerEmployee, employeeEmployee, hrEmployee];
  const firstNames = ['Rajesh', 'Sakshi', 'Vikram', 'Neha', 'Amit', 'Deepika', 'Arjun', 'Ananya', 'Rohan', 'Zara',
    'Karan', 'Pooja', 'Nikhil', 'Anjali', 'Sanjay', 'Ritika', 'Aditya', 'Sneha', 'Rahul', 'Divya',
    'Manish', 'Preeti', 'Varun', 'Swati', 'Harish', 'Pallavi', 'Ashok', 'Shreya', 'Suresh', 'Avni',
    'Ravi', 'Isha', 'Manoj', 'Nisha', 'Shailesh', 'Diya', 'Pawan', 'Aarav', 'Anushka', 'Naveen',
    'Jaya', 'Kartik', 'Tanya', 'Subhash', 'Akshita', 'Mahesh', 'Kavya', 'Sameer', 'Esha', 'Aryan'];
  const lastNames = ['Sharma', 'Singh', 'Patel', 'Kumar', 'Verma', 'Gupta', 'Malhotra', 'Joshi', 'Rao', 'Bhat'];

  for (let i = 0; i < 62; i++) {
    const dept = depts[i % depts.length];
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const emp = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        employeeCode: `E${String(i + 4).padStart(4, '0')}`,
        firstName,
        lastName,
        workEmail: `emp${i + 4}@acme.test`,
        personalEmail: `emp${i + 4}@gmail.com`,
        phone: `+91 ${Math.floor(98000 + Math.random() * 99999)}`,
        dateOfBirth: new Date(1985 + Math.floor(Math.random() * 25), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        address: `${['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Pune'][i % 5]}, India`,
        emergencyContactName: `${firstName} Family`,
        emergencyContactPhone: `+91 ${Math.floor(98000 + Math.random() * 99999)}`,
        designation: ['Senior Engineer', 'Software Developer', 'Product Manager', 'Sales Executive', 'Financial Analyst', 'Operations Coordinator'][i % 6],
        departmentId: dept.id,
        managerId: i % 3 === 0 ? managerEmployee.id : undefined,
        joinedOn: new Date(2020 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        employmentType: 'FULL_TIME',
        employmentStatus: i % 10 === 0 ? 'INACTIVE' : 'ACTIVE',
        location: ['Delhi', 'Mumbai', 'Bangalore'][i % 3],
        payCurrency: 'INR',
        createdBy: hrAdminUser.id,
      },
    });
    employees.push(emp);
  }
  console.log(`✅ Employees created: ${employees.length}`);

  // Create Leave Balances for all new employees
  const allLeaveTypes = [annualLeave, sickLeave, casualLeave];
  for (const emp of employees) {
    for (const leaveType of allLeaveTypes) {
      await prisma.leaveBalance.create({
        data: {
          tenantId: tenant.id,
          employeeId: emp.id,
          leaveTypeId: leaveType.id,
          balance: leaveType.code === 'ANNUAL' ? 21 : 10,
          used: Math.floor(Math.random() * 5),
          pending: Math.random() > 0.7 ? 1 : 0,
        },
      }).catch(() => undefined);
    }
  }
  console.log(`✅ Leave balances created for ${employees.length} employees`);

  // Create Attendance Records (30 days back)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const statuses = ['PRESENT', 'ABSENT', 'LEAVE', 'WFH', 'HALF_DAY'];

  for (const emp of employees) {
    for (let d = 0; d < 30; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      await prisma.attendanceRecord.create({
        data: {
          tenantId: tenant.id,
          employeeId: emp.id,
          attendanceDate: date,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          checkInTime: Math.random() > 0.3 ? new Date(date.getTime() + 9 * 60 * 60 * 1000) : null,
          checkOutTime: Math.random() > 0.3 ? new Date(date.getTime() + 18 * 60 * 60 * 1000) : null,
        },
      }).catch(() => undefined);
    }
  }
  console.log(`✅ Attendance records created (30 days × ${employees.length} employees)`);

  // Create Leave Requests
  for (let i = 0; i < 50; i++) {
    const emp = employees[Math.floor(Math.random() * employees.length)];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30) - 15);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5));

    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp.id,
        leaveTypeId: allLeaveTypes[Math.floor(Math.random() * allLeaveTypes.length)].id,
        startDate,
        endDate,
        totalDays: Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1,
        reason: ['Family event', 'Medical appointment', 'Personal matters', 'Travel'][Math.floor(Math.random() * 4)],
        status: ['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN'][Math.floor(Math.random() * 4)],
        approvedBy: Math.random() > 0.3 ? managerEmployee.id : null,
        approvedAt: Math.random() > 0.3 ? new Date() : null,
      },
    }).catch(() => undefined);
  }
  console.log(`✅ Leave requests created: 50`);

  // Create Attendance Regularization Requests
  for (let i = 0; i < 20; i++) {
    const emp = employees[Math.floor(Math.random() * employees.length)];
    const date = new Date(today);
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));

    await prisma.attendanceRegularizationRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp.id,
        attendanceDate: date,
        reason: ['Late arrival', 'Early departure', 'Forgot to mark', 'System error'][Math.floor(Math.random() * 4)],
        status: ['PENDING', 'APPROVED', 'DENIED'][Math.floor(Math.random() * 3)],
        approvedBy: Math.random() > 0.4 ? managerEmployee.id : null,
        approvedAt: Math.random() > 0.4 ? new Date() : null,
      },
    }).catch(() => undefined);
  }
  console.log(`✅ Attendance regularization requests created: 20`);

  // Create Audit Logs
  for (let i = 0; i < 100; i++) {
    const actionTypes = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'];
    const entityTypes = ['Employee', 'LeaveRequest', 'AttendanceRecord', 'Department', 'User'];

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: [superAdminUser.id, hrAdminUser.id, managerUser.id][Math.floor(Math.random() * 3)],
        action: actionTypes[Math.floor(Math.random() * actionTypes.length)],
        entityType: entityTypes[Math.floor(Math.random() * entityTypes.length)],
        entityId: employees[Math.floor(Math.random() * employees.length)].id,
        oldValuesJson: JSON.stringify({ field: 'old_value' }),
        newValuesJson: JSON.stringify({ field: 'new_value' }),
        createdAt: new Date(today.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => undefined);
  }
  console.log(`✅ Audit logs created: 100`);

  console.log('🎉 Seeding complete!');
  console.log(`
Seed Users (password: ${seedPassword}):
- Super Admin: superadmin@acme.test
- HR Admin: hr@acme.test
- Manager: aman@acme.test
- Employee: priya@acme.test

Database Stats:
- Departments: ${depts.length}
- Employees: ${employees.length}
- Leave Types: ${allLeaveTypes.length}
- Holidays: ${holidays.length}
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
