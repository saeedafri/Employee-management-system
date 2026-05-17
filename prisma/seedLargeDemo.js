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
  console.log('🌱 Seeding large demo database (250+ employees)...');

  // Create Tenant
  const tenant = await prisma.tenant.create({
    data: {
      tenantKey: 'enterprise-demo-001',
      slug: 'enterprise-demo',
      name: 'Enterprise Demo Corp',
      legalName: 'Enterprise Demo Corporation Pvt Ltd',
      displayName: 'EnterpiseDemo',
      country: 'India',
      defaultCurrency: 'INR',
      timezone: 'Asia/Kolkata',
      fiscalYearStart: 4,
      primaryContactEmail: 'hr@enterprise-demo.test',
      supportPhone: '+91 11 99999999',
    },
  });
  console.log(`✅ Tenant created: ${tenant.id}`);

  // Create Permissions
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

  // Assign permissions to roles
  await Promise.all(
    allPermissions.map((permId) =>
      prisma.rolePermission.create({
        data: { roleId: superAdminRole.id, permissionId: permId },
      }).catch(() => undefined),
    ),
  );

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

  const managerPermissions = ['attendance:read', 'leave:approve', 'audit:read'];
  await Promise.all(
    managerPermissions.map((key) =>
      prisma.rolePermission.create({
        data: { roleId: managerRole.id, permissionId: permissionMap[key] },
      }).catch(() => undefined),
    ),
  );

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

  // Create Admin Users
  const superAdminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'superadmin@enterprise-demo.test',
      passwordHash: await hashPassword(seedPassword),
      memberType: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });

  const hrAdminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'hr@enterprise-demo.test',
      passwordHash: await hashPassword(seedPassword),
      memberType: 'HR_ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('✅ Admin users created');

  // Create Departments (12 departments)
  const deptNames = [
    'Engineering',
    'Sales',
    'Marketing',
    'HR',
    'Finance',
    'Operations',
    'Product',
    'Customer Success',
    'Legal',
    'Quality Assurance',
    'DevOps',
    'Data Science',
  ];

  const depts = [];
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
  console.log(`✅ Departments created: ${depts.length}`);

  // Create Leave Types
  const leaveTypes = [];
  const leaveTypeData = [
    { name: 'Annual Leave', code: 'ANNUAL', annualAllowance: 21, carryForwardAllowed: true, isPaid: true },
    { name: 'Sick Leave', code: 'SICK', annualAllowance: 10, carryForwardAllowed: false, isPaid: true },
    { name: 'Casual Leave', code: 'CASUAL', annualAllowance: 12, carryForwardAllowed: false, isPaid: true },
    { name: 'Maternity Leave', code: 'MATERNITY', annualAllowance: 180, carryForwardAllowed: false, isPaid: true },
    { name: 'Paternity Leave', code: 'PATERNITY', annualAllowance: 15, carryForwardAllowed: false, isPaid: true },
  ];

  for (const lt of leaveTypeData) {
    const leaveType = await prisma.leaveType.create({
      data: { ...lt, tenantId: tenant.id, isActive: true },
    });
    leaveTypes.push(leaveType);
  }
  console.log(`✅ Leave types created: ${leaveTypes.length}`);

  // Create Managers (one per department)
  const managers = [];
  const firstNames = [
    'Rajesh', 'Sakshi', 'Vikram', 'Neha', 'Amit', 'Deepika', 'Arjun', 'Ananya', 'Rohan', 'Zara',
    'Karan', 'Pooja',
  ];
  const lastNames = [
    'Sharma', 'Singh', 'Patel', 'Kumar', 'Verma', 'Gupta', 'Malhotra', 'Joshi', 'Rao', 'Bhat',
  ];

  for (let i = 0; i < depts.length; i++) {
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[i % lastNames.length];
    const managerUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `manager${i + 1}@enterprise-demo.test`,
        passwordHash: await hashPassword(seedPassword),
        memberType: 'MANAGER',
        status: 'ACTIVE',
      },
    });

    const manager = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        userId: managerUser.id,
        employeeCode: `M${String(i + 1).padStart(3, '0')}`,
        firstName,
        lastName,
        workEmail: `manager${i + 1}@enterprise-demo.test`,
        personalEmail: `manager${i + 1}@gmail.com`,
        phone: `+91 ${Math.floor(98000 + Math.random() * 99999)}`,
        dateOfBirth: new Date(1980 + Math.floor(Math.random() * 20), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        address: `${['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Pune'][i % 5]}, India`,
        designation: `${depts[i].name} Manager`,
        departmentId: depts[i].id,
        joinedOn: new Date(2015 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        location: ['Delhi', 'Mumbai', 'Bangalore'][i % 3],
        payCurrency: 'INR',
        createdBy: hrAdminUser.id,
      },
    });

    // Update user with employee ID
    await prisma.user.update({
      where: { id: managerUser.id },
      data: { employeeId: manager.id },
    });

    // Create leave balances for manager
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.create({
        data: {
          tenantId: tenant.id,
          employeeId: manager.id,
          leaveTypeId: lt.id,
          balance: lt.annualAllowance,
          used: 0,
          pending: 0,
        },
      }).catch(() => undefined);
    }

    managers.push(manager);
  }
  console.log(`✅ Managers created: ${managers.length}`);

  // Create 250+ Employees across all departments
  const moreFirstNames = [
    'Nikhil', 'Anjali', 'Sanjay', 'Ritika', 'Aditya', 'Sneha', 'Rahul', 'Divya', 'Manish', 'Preeti',
    'Varun', 'Swati', 'Harish', 'Pallavi', 'Ashok', 'Shreya', 'Suresh', 'Avni', 'Ravi', 'Isha',
    'Manoj', 'Nisha', 'Shailesh', 'Diya', 'Pawan', 'Aarav', 'Anushka', 'Naveen', 'Jaya', 'Kartik',
    'Tanya', 'Subhash', 'Akshita', 'Mahesh', 'Kavya', 'Sameer', 'Esha', 'Aryan', 'Pragya', 'Vikrant',
    'Sonali', 'Tarun', 'Shweta', 'Naresh', 'Aparna', 'Gaurav', 'Meera', 'Ronak', 'Amrita', 'Vikas',
  ];

  const employees = [];
  for (let i = 0; i < 260; i++) {
    const dept = depts[i % depts.length];
    const manager = managers[i % managers.length];
    const firstName = moreFirstNames[i % moreFirstNames.length];
    const lastName = lastNames[i % lastNames.length];

    const empUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `emp${String(i + 1).padStart(4, '0')}@enterprise-demo.test`,
        passwordHash: await hashPassword(seedPassword),
        memberType: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });

    const emp = await prisma.employee.create({
      data: {
        tenantId: tenant.id,
        userId: empUser.id,
        employeeCode: `E${String(i + 1).padStart(4, '0')}`,
        firstName,
        lastName,
        workEmail: `emp${String(i + 1).padStart(4, '0')}@enterprise-demo.test`,
        personalEmail: `emp${String(i + 1).padStart(4, '0')}@gmail.com`,
        phone: `+91 ${Math.floor(98000 + Math.random() * 99999)}`,
        dateOfBirth: new Date(1985 + Math.floor(Math.random() * 30), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: Math.random() > 0.5 ? 'MALE' : 'FEMALE',
        address: `${['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Pune', 'Chennai', 'Kolkata'][i % 7]}, India`,
        designation: ['Senior Engineer', 'Software Developer', 'Product Manager', 'Sales Executive', 'Financial Analyst', 'Operations Coordinator'][i % 6],
        departmentId: dept.id,
        managerId: manager.id,
        joinedOn: new Date(2018 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        employmentType: i % 15 === 0 ? 'CONTRACT' : 'FULL_TIME',
        employmentStatus: i % 50 === 0 ? 'INACTIVE' : 'ACTIVE',
        location: ['Delhi', 'Mumbai', 'Bangalore'][i % 3],
        payCurrency: 'INR',
        createdBy: hrAdminUser.id,
      },
    });

    // Update user with employee ID
    await prisma.user.update({
      where: { id: empUser.id },
      data: { employeeId: emp.id },
    });

    // Create leave balances
    for (const lt of leaveTypes) {
      await prisma.leaveBalance.create({
        data: {
          tenantId: tenant.id,
          employeeId: emp.id,
          leaveTypeId: lt.id,
          balance: lt.annualAllowance,
          used: Math.floor(Math.random() * 8),
          pending: Math.random() > 0.8 ? 1 : 0,
        },
      }).catch(() => undefined);
    }

    employees.push(emp);

    if ((i + 1) % 50 === 0) {
      console.log(`  Created ${i + 1} employees...`);
    }
  }
  console.log(`✅ Employees created: ${employees.length}`);

  // Create Holidays
  const currentYear = new Date().getFullYear();
  const holidays = [
    { name: 'Republic Day', date: new Date(`${currentYear}-01-26`) },
    { name: 'Independence Day', date: new Date(`${currentYear}-08-15`) },
    { name: 'Gandhi Jayanti', date: new Date(`${currentYear}-10-02`) },
    { name: 'Diwali', date: new Date(`${currentYear}-11-12`) },
    { name: 'Christmas', date: new Date(`${currentYear}-12-25`) },
    { name: 'New Year', date: new Date(`${currentYear + 1}-01-01`) },
  ];

  for (const h of holidays) {
    await prisma.holiday.create({
      data: {
        tenantId: tenant.id,
        name: h.name,
        holidayDate: h.date,
        location: 'India',
        isOptional: false,
      },
    });
  }
  console.log(`✅ Holidays created: ${holidays.length}`);

  // Create Attendance Records (60 days back)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const statuses = ['PRESENT', 'ABSENT', 'LEAVE', 'WFH', 'HALF_DAY'];
  const workModes = ['OFFICE', 'WFH', 'HYBRID'];

  let attendanceCount = 0;
  for (const emp of employees) {
    for (let d = 0; d < 60; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - d);
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

      const checkInAt = Math.random() > 0.2 ? new Date(date.getTime() + (8 + Math.random() * 2) * 60 * 60 * 1000) : null;
      const checkOutAt = Math.random() > 0.2 ? new Date(date.getTime() + (17 + Math.random() * 2) * 60 * 60 * 1000) : null;
      const totalMinutes = checkInAt && checkOutAt ? Math.round((checkOutAt - checkInAt) / (1000 * 60)) : null;

      await prisma.attendanceRecord.create({
        data: {
          tenantId: tenant.id,
          employeeId: emp.id,
          attendanceDate: date,
          status: statuses[Math.floor(Math.random() * statuses.length)],
          checkInAt,
          checkOutAt,
          totalMinutes,
          workMode: workModes[Math.floor(Math.random() * workModes.length)],
        },
      }).catch(() => undefined);

      attendanceCount++;
    }
  }
  console.log(`✅ Attendance records created: ${attendanceCount}`);

  // Create Leave Requests (300+ requests)
  for (let i = 0; i < 350; i++) {
    const emp = employees[Math.floor(Math.random() * employees.length)];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 60) - 30);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 7));

    const status = ['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN'][Math.floor(Math.random() * 4)];
    const manager = managers[Math.floor(Math.random() * managers.length)];
    const shouldHaveApprover = Math.random() > 0.3 && status !== 'PENDING';

    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp.id,
        leaveTypeId: leaveTypes[Math.floor(Math.random() * leaveTypes.length)].id,
        startDate,
        endDate,
        totalDays: Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000)) + 1,
        reason: ['Family event', 'Medical appointment', 'Personal matters', 'Travel', 'Emergency'][Math.floor(Math.random() * 5)],
        status,
        approverId: shouldHaveApprover ? manager.id : null,
        approverComment: shouldHaveApprover ? ['Approved', 'Denied - conflict', 'Approved with note'][Math.floor(Math.random() * 3)] : null,
        decidedAt: shouldHaveApprover ? new Date() : null,
      },
    }).catch(() => undefined);
  }
  console.log(`✅ Leave requests created: 350`);

  // Create Attendance Regularization Requests
  for (let i = 0; i < 150; i++) {
    const emp = employees[Math.floor(Math.random() * employees.length)];
    const manager = managers[Math.floor(Math.random() * managers.length)];
    const date = new Date(today);
    date.setDate(date.getDate() - Math.floor(Math.random() * 60));

    const status = ['PENDING', 'APPROVED', 'DENIED'][Math.floor(Math.random() * 3)];
    const shouldHaveReviewer = Math.random() > 0.4 && status !== 'PENDING';

    await prisma.attendanceRegularizationRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: emp.id,
        attendanceDate: date,
        reason: ['Late arrival', 'Early departure', 'Forgot to mark', 'System error', 'Network issue'][Math.floor(Math.random() * 5)],
        status,
        reviewerId: shouldHaveReviewer ? manager.id : null,
        reviewerComment: shouldHaveReviewer ? ['Approved', 'Denied - no evidence', 'Approved with note'][Math.floor(Math.random() * 3)] : null,
      },
    }).catch(() => undefined);
  }
  console.log(`✅ Attendance regularization requests created: 150`);

  // Create Audit Logs (500+ logs)
  for (let i = 0; i < 500; i++) {
    const actionTypes = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'LOGIN', 'LOGOUT'];
    const entityTypes = ['Employee', 'LeaveRequest', 'AttendanceRecord', 'Department', 'User', 'Attendance'];
    const actor = [superAdminUser, hrAdminUser, managers[0]][Math.floor(Math.random() * 3)];

    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId: actor.id,
        action: actionTypes[Math.floor(Math.random() * actionTypes.length)],
        entityType: entityTypes[Math.floor(Math.random() * entityTypes.length)],
        entityId: employees[Math.floor(Math.random() * employees.length)].id,
        oldValuesJson: JSON.stringify({ field: 'old_value' }),
        newValuesJson: JSON.stringify({ field: 'new_value' }),
        createdAt: new Date(today.getTime() - Math.random() * 60 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => undefined);
  }
  console.log(`✅ Audit logs created: 500`);

  console.log('🎉 Large demo seeding complete!');
  console.log(`
Seed Users (password: ${seedPassword}):
- Super Admin: superadmin@enterprise-demo.test
- HR Admin: hr@enterprise-demo.test
- Managers: manager1@enterprise-demo.test through manager12@enterprise-demo.test
- Employees: emp0001@enterprise-demo.test through emp0260@enterprise-demo.test

Database Stats:
- Departments: ${depts.length}
- Managers: ${managers.length}
- Employees: ${employees.length} (total ${employees.length + managers.length} with managers)
- Leave Types: ${leaveTypes.length}
- Holidays: ${holidays.length}
- Leave Requests: 350+
- Attendance Records: ${attendanceCount}+
- Regularization Requests: 150+
- Audit Logs: 500+
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
