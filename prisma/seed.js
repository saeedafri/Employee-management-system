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

  // HR_ADMIN login using the project owner's real email (for UI/Playwright testing)
  const hrGmailUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'mohammadsaeedafri9@gmail.com' } },
    update: { passwordHash: pwHash, status: 'ACTIVE' },
    create: { tenantId: tenant.id, email: 'mohammadsaeedafri9@gmail.com', passwordHash: pwHash, memberType: 'HR_ADMIN', status: 'ACTIVE' },
  });

  // dev1 EMPLOYEE login (listed as a test account; previously only in comprehensive seed)
  const dev1User = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'dev1@acme.test' } },
    update: { passwordHash: pwHash, status: 'ACTIVE' },
    create: { tenantId: tenant.id, email: 'dev1@acme.test', passwordHash: pwHash, memberType: 'EMPLOYEE', status: 'ACTIVE' },
  });

  console.log('✅ Users: 6 seed users');

  // Assign roles to users (idempotent)
  for (const [userId, roleId] of [
    [superAdminUser.id, superAdminRole.id],
    [hrAdminUser.id, hrAdminRole.id],
    [managerUser.id, managerRole.id],
    [employeeUser.id, employeeRole.id],
    [hrGmailUser.id, hrAdminRole.id],
    [dev1User.id, employeeRole.id],
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

  // ── Payroll Seed ────────────────────────────────────────────────────────────

  // Salary Components
  const componentDefs = [
    { code: 'BASIC', name: 'Basic Salary', type: 'EARNING', calculationType: 'FLAT', value: 50000, taxable: true, displayOrder: 1, statutoryTag: 'PF_WAGE' },
    { code: 'HRA', name: 'House Rent Allowance', type: 'EARNING', calculationType: 'PERCENTAGE', value: 40, basisCode: 'BASIC', taxable: false, displayOrder: 2 },
    { code: 'CONVEYANCE', name: 'Conveyance Allowance', type: 'EARNING', calculationType: 'FLAT', value: 1600, taxable: false, displayOrder: 3 },
    { code: 'MEDICAL', name: 'Medical Allowance', type: 'BENEFIT', calculationType: 'FLAT', value: 1250, taxable: false, displayOrder: 4 },
    { code: 'PF', name: 'Provident Fund (Employee)', type: 'DEDUCTION', calculationType: 'PERCENTAGE', value: 12, basisCode: 'BASIC', taxable: false, displayOrder: 5 },
    { code: 'TDS', name: 'Income Tax (TDS)', type: 'DEDUCTION', calculationType: 'FLAT', value: 5000, taxable: false, displayOrder: 6 },
  ];
  const createdComponents = [];
  for (const c of componentDefs) {
    const comp = await prisma.salaryComponent.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: c.code } },
      update: {},
      create: { tenantId: tenant.id, ...c },
    });
    createdComponents.push(comp);
  }
  console.log(`✅ Salary components: ${createdComponents.length}`);

  // Pay Group
  const payGroup = await prisma.payGroup.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'STANDARD' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Standard Pay Group', code: 'STANDARD', currency: 'INR', paySchedule: 'MONTHLY', active: true },
  });
  // Link components to pay group
  for (const comp of createdComponents) {
    await prisma.payGroupComponent.upsert({
      where: { payGroupId_componentId: { payGroupId: payGroup.id, componentId: comp.id } },
      update: {},
      create: { payGroupId: payGroup.id, componentId: comp.id },
    });
  }
  console.log(`✅ Pay group: ${payGroup.code}`);

  // Employee Salary Records
  const salaryRecords = [
    { employee: hrEmployee, annualCtc: 1200000, bank: 'SBI' },
    { employee: managerEmployee, annualCtc: 1800000, bank: 'HDFC' },
    { employee: employeeEmployee, annualCtc: 900000, bank: 'ICICI' },
  ];
  for (const sr of salaryRecords) {
    const existing = await prisma.employeeSalary.findFirst({
      where: { tenantId: tenant.id, employeeId: sr.employee.id, effectiveTo: null },
    });
    if (!existing) {
      await prisma.employeeSalary.create({
        data: {
          tenantId: tenant.id, employeeId: sr.employee.id, payGroupId: payGroup.id,
          annualCtc: sr.annualCtc, effectiveFrom: new Date('2026-01-01'),
          bankName: sr.bank, bankAccountNumber: '0001234567890', bankIfscCode: 'SBIN0001234',
        },
      });
    }
  }
  console.log('✅ Employee salary configs');

  // Payroll Runs + Payslips (Mar / Apr / May 2026 — PAID)
  const runPeriods = [
    { period: '2026-03', label: 'March 2026' },
    { period: '2026-04', label: 'April 2026' },
    { period: '2026-05', label: 'May 2026' },
  ];
  const cloudinaryBase = 'https://res.cloudinary.com/dmljxhmio/image/upload/v1748437200/ems/payslips';
  for (const rp of runPeriods) {
    let run = await prisma.payrollRun.findFirst({
      where: { tenantId: tenant.id, period: rp.period, status: { not: 'CANCELLED' } },
    });
    if (!run) {
      run = await prisma.payrollRun.create({
        data: {
          tenantId: tenant.id, period: rp.period, status: 'PAID',
          employeeCount: 3, currency: 'INR',
          totalGross: 230050, totalDeductions: 30000, totalNet: 200050,
          initiatedById: hrAdminUser.id, approvedById: superAdminUser.id,
          paidAt: new Date(`${rp.period}-28`),
        },
      });
    }
    // Payslips for core employees
    const payslipDefs = [
      { employee: hrEmployee, gross: 90000, deductions: 11000, net: 79000, code: 'E0003' },
      { employee: managerEmployee, gross: 100000, deductions: 12000, net: 88000, code: 'E0001' },
      { employee: employeeEmployee, gross: 75000, deductions: 9000, net: 66000, code: 'E0002' },
    ];
    for (const pd of payslipDefs) {
      const existingPs = await prisma.payslip.findUnique({
        where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: pd.employee.id } },
      });
      if (!existingPs) {
        const docUrl = `${cloudinaryBase}/payslip_${pd.code}_${rp.period.replace('-', '_')}.webp`;
        await prisma.payslip.create({
          data: {
            tenantId: tenant.id, payrollRunId: run.id, employeeId: pd.employee.id,
            period: rp.period, currency: 'INR',
            grossEarnings: pd.gross, totalDeductions: pd.deductions, netPay: pd.net,
            workingDays: 22, presentDays: 22, leaveDays: 0, lopDays: 0,
            status: 'PAID', paymentDate: new Date(`${rp.period}-28`),
            // Line items carry both `amount` (UI PayslipLine contract) and
            // `monthlyAmount` (back-compat) + `taxable`.
            earningsJson: [
              { code: 'BASIC', name: 'Basic Salary', type: 'EARNING', amount: Math.round(pd.gross * 0.5), monthlyAmount: Math.round(pd.gross * 0.5), taxable: true },
              { code: 'HRA', name: 'House Rent Allowance', type: 'EARNING', amount: Math.round(pd.gross * 0.2), monthlyAmount: Math.round(pd.gross * 0.2), taxable: false },
              { code: 'CONVEYANCE', name: 'Conveyance Allowance', type: 'EARNING', amount: 1600, monthlyAmount: 1600, taxable: false },
              { code: 'MEDICAL', name: 'Medical Allowance', type: 'BENEFIT', amount: 1250, monthlyAmount: 1250, taxable: false },
            ],
            deductionsJson: [
              { code: 'PF', name: 'Provident Fund', type: 'DEDUCTION', amount: Math.round(pd.gross * 0.05), monthlyAmount: Math.round(pd.gross * 0.05), taxable: false },
              { code: 'TDS', name: 'Income Tax (TDS)', type: 'DEDUCTION', amount: pd.deductions - Math.round(pd.gross * 0.05), monthlyAmount: pd.deductions - Math.round(pd.gross * 0.05), taxable: false },
            ],
            documentUrl: docUrl,
            generatedAt: new Date(`${rp.period}-28`),
          },
        });
      }
    }
  }
  console.log('✅ Payroll runs (Mar/Apr/May 2026) + payslips');

  // Legal Entity
  await prisma.legalEntity.upsert({
    where: { id: `le_${tenant.id}_in` },
    update: {},
    create: {
      id: `le_${tenant.id}_in`,
      tenantId: tenant.id, name: 'Acme India Pvt Ltd', country: 'IN', currency: 'INR',
      fiscalYearStartMonth: 4, timezone: 'Asia/Kolkata', locale: 'en-IN',
      registrationIds: { PF: 'MHBAN1234567', PAN: 'AAAAA1234A', ESI: '12345678901234' },
    },
  });
  console.log('✅ Legal entity: Acme India');

  // Statutory Pack
  const packData = {
    rounding: { mode: 'NEAREST', precision: 0 },
    proration: { basis: 'CALENDAR_DAYS' },
    taxRegimes: [{ code: 'IN_NEW_REGIME', fiscalYear: '2026-27', currency: 'INR', standardDeduction: 7500000, slabs: [{ from: 0, to: 40000000, rate: 0 }, { from: 40000000, to: 80000000, rate: 5 }, { from: 80000000, to: null, rate: 30 }], cess: { rate: 4 } }],
    contributionSchemes: [{ code: 'IN_EPF', name: "Employees' Provident Fund", wageBaseTag: 'PF_WAGE', wageCeiling: 1500000, apportionmentMode: 'MONTHLY_TOTAL', employee: { rate: 12, component: 'PF' }, employer: { rate: 12, component: 'PF_ER' } }],
    localTaxes: [{ code: 'IN_MH_PT', name: 'Professional Tax (Maharashtra)', component: 'PROF_TAX', slabs: [{ from: 0, to: 750000, amount: 0 }, { from: 750000, to: null, amount: 20000 }] }],
    statutoryComponents: ['PF', 'PF_ER', 'TDS'],
  };
  const packExists = await prisma.statutoryPack.findUnique({
    where: { tenantId_country_version: { tenantId: tenant.id, country: 'IN', version: '2026.1' } },
  });
  if (!packExists) {
    await prisma.statutoryPack.create({
      data: { tenantId: tenant.id, country: 'IN', version: '2026.1', effectiveFrom: new Date('2026-04-01'), packData },
    });
  }
  console.log('✅ Statutory pack: IN 2026.1');

  // Pay Calendar
  await prisma.payCalendar.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'IN_MONTHLY' } },
    update: {},
    create: { tenantId: tenant.id, name: 'India Monthly Payroll', code: 'IN_MONTHLY', country: 'IN', paySchedule: 'MONTHLY', firstPayDate: '2026-01-28' },
  });
  console.log('✅ Pay calendar: IN_MONTHLY');

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
