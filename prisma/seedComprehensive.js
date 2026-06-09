/**
 * Comprehensive seed — additive only, safe to run against live Render DB.
 * Run: node prisma/seedComprehensive.js
 * Requires: existing base seed (tenant, users, employees, departments, leaveTypes)
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'argon2';

const prisma = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 3600 * 1000);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isWeekend(date) {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

async function main() {
  console.log('🌱 Running comprehensive seed...\n');

  // ── Resolve base data ──────────────────────────────────────────────────────
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: 'acme-corp-001' } });
  if (!tenant) throw new Error('Base tenant not found — run npm run db:seed first');

  const tenantId = tenant.id;

  const users = await prisma.user.findMany({ where: { tenantId } });
  const userMap = Object.fromEntries(users.map((u) => [u.email, u]));

  const superAdmin = userMap['superadmin@acme.test'];
  const hrAdmin = userMap['hr@acme.test'];
  const manager = userMap['aman@acme.test'];
  const employee = userMap['priya@acme.test'];

  const employees = await prisma.employee.findMany({ where: { tenantId, deletedAt: null } });
  const empMap = Object.fromEntries(employees.map((e) => [e.workEmail, e]));

  const managerEmp = empMap['aman@acme.test'];
  const priyaEmp = empMap['priya@acme.test'];
  const hrEmp = empMap['hr@acme.test'];

  console.log(`Found ${employees.length} employees in DB`);

  const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId } });
  const leaveTypeMap = Object.fromEntries(leaveTypes.map((lt) => [lt.code, lt]));
  const annualLeave = leaveTypeMap['ANNUAL'];
  const sickLeave = leaveTypeMap['SICK'];
  const casualLeave = leaveTypeMap['CASUAL'];

  if (!annualLeave) throw new Error('Leave types not found — run npm run db:seed first');

  const departments = await prisma.department.findMany({ where: { tenantId } });
  const deptMap = Object.fromEntries(departments.map((d) => [d.departmentCode, d]));

  // ── Department hierarchy ───────────────────────────────────────────────────
  console.log('\n📂 Setting up department hierarchy...');
  const eng = deptMap['ENG'];
  const ops = deptMap['OPS'];
  const sales = deptMap['SALES'];

  // Create sub-departments
  const subDepts = [
    { name: 'Frontend Engineering', code: 'ENG-FE', parentId: eng.id, depth: 1 },
    { name: 'Backend Engineering', code: 'ENG-BE', parentId: eng.id, depth: 1 },
    { name: 'QA & Testing', code: 'ENG-QA', parentId: eng.id, depth: 1 },
    { name: 'Sales - North', code: 'SALES-N', parentId: sales.id, depth: 1 },
    { name: 'Sales - South', code: 'SALES-S', parentId: sales.id, depth: 1 },
    { name: 'IT Support', code: 'OPS-IT', parentId: ops.id, depth: 1 },
  ];

  for (const sd of subDepts) {
    const existing = await prisma.department.findFirst({
      where: { tenantId, departmentCode: sd.code },
    });
    if (!existing) {
      await prisma.department.create({
        data: { tenantId, name: sd.name, departmentCode: sd.code, parentId: sd.parentId, depth: sd.depth },
      });
      console.log(`  ✓ Created sub-dept: ${sd.name}`);
    } else {
      console.log(`  · Skipped (exists): ${sd.name}`);
    }
  }

  // ── Additional users + employees ───────────────────────────────────────────
  console.log('\n👥 Adding additional named employees...');

  const seedPassword = 'Password123!';
  const pwHash = await hash(seedPassword, { type: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });

  const namedEmployees = [
    { email: 'riya@acme.test', first: 'Riya', last: 'Kapoor', code: 'E0100', role: 'MANAGER', dept: 'SALES', desig: 'Sales Manager' },
    { email: 'dev1@acme.test', first: 'Arjun', last: 'Nair', code: 'E0101', role: 'EMPLOYEE', dept: 'ENG', desig: 'Frontend Developer' },
    { email: 'dev2@acme.test', first: 'Sneha', last: 'Reddy', code: 'E0102', role: 'EMPLOYEE', dept: 'ENG', desig: 'Backend Developer' },
    { email: 'fin1@acme.test', first: 'Mohit', last: 'Jain', code: 'E0103', role: 'EMPLOYEE', dept: 'FIN', desig: 'Finance Analyst' },
    { email: 'onleave@acme.test', first: 'Sara', last: 'Ali', code: 'E0104', role: 'EMPLOYEE', dept: 'MAR', desig: 'Marketing Specialist' },
  ];

  const namedEmpObjects = [];
  for (const ne of namedEmployees) {
    const existingUser = await prisma.user.findFirst({ where: { tenantId, email: ne.email } });
    let userId = existingUser?.id;

    if (!existingUser) {
      const newUser = await prisma.user.create({
        data: { tenantId, email: ne.email, passwordHash: pwHash, memberType: ne.role, status: 'ACTIVE' },
      });
      userId = newUser.id;
    }

    const dept = deptMap[ne.dept];
    const existingEmp = await prisma.employee.findFirst({ where: { tenantId, employeeCode: ne.code } });
    let empObj = existingEmp;

    if (!existingEmp) {
      empObj = await prisma.employee.create({
        data: {
          tenantId, userId, employeeCode: ne.code,
          firstName: ne.first, lastName: ne.last, workEmail: ne.email,
          phone: `+91 99000 0${ne.code.slice(-4)}`,
          designation: ne.desig,
          departmentId: dept?.id,
          managerId: ne.role === 'EMPLOYEE' ? managerEmp.id : null,
          joinedOn: new Date('2022-01-10'),
          employmentType: 'FULL_TIME',
          employmentStatus: ne.email === 'onleave@acme.test' ? 'ON_LEAVE' : 'ACTIVE',
          location: 'Bangalore',
          payCurrency: 'INR',
          createdBy: hrAdmin?.id,
        },
      });

      if (!existingUser) {
        await prisma.user.update({ where: { id: userId }, data: { employeeId: empObj.id } });
      }

      console.log(`  ✓ Created: ${ne.first} ${ne.last} (${ne.code})`);
    } else {
      console.log(`  · Skipped (exists): ${ne.first} ${ne.last}`);
    }

    namedEmpObjects.push(empObj);
  }

  // Re-fetch all employees after additions
  const allEmployees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    take: 30,
  });

  // ── Leave Balances for all employees ──────────────────────────────────────
  console.log('\n📋 Setting up leave balances...');
  let lbCreated = 0;
  for (const emp of allEmployees) {
    for (const lt of leaveTypes) {
      const result = await prisma.leaveBalance.upsert({
        where: { tenantId_employeeId_leaveTypeId: { tenantId, employeeId: emp.id, leaveTypeId: lt.id } },
        update: {},
        create: {
          tenantId, employeeId: emp.id, leaveTypeId: lt.id,
          balance: lt.code === 'ANNUAL' ? 18 : lt.code === 'SICK' ? 8 : 10,
          used: 0, pending: 0,
        },
      });
      if (result) lbCreated++;
    }
  }
  console.log(`  ✓ Leave balances created: ${lbCreated}`);

  // ── Leave requests in ALL statuses ────────────────────────────────────────
  console.log('\n🏖️  Creating leave requests in all statuses...');

  const existingLeaveCount = await prisma.leaveRequest.count({ where: { tenantId } });
  if (existingLeaveCount >= 20) {
    console.log(`  · Skipping (${existingLeaveCount} already exist)`);
  } else {
    const leaveScenarios = [
      // PENDING requests
      { emp: priyaEmp, lt: annualLeave, start: daysAgo(-5), days: 3, status: 'PENDING', reason: 'Family vacation to Goa' },
      { emp: priyaEmp, lt: casualLeave, start: daysAgo(-10), days: 1, status: 'PENDING', reason: 'Personal work' },
      { emp: managerEmp, lt: annualLeave, start: daysAgo(-3), days: 5, status: 'PENDING', reason: 'Annual vacation' },
      { emp: namedEmpObjects[1], lt: sickLeave, start: daysAgo(-2), days: 2, status: 'PENDING', reason: 'Fever and cold' },
      { emp: namedEmpObjects[2], lt: casualLeave, start: daysAgo(-1), days: 1, status: 'PENDING', reason: 'Personal appointment' },

      // APPROVED requests
      { emp: priyaEmp, lt: annualLeave, start: daysAgo(60), days: 5, status: 'APPROVED', reason: 'Diwali holidays', approverId: manager?.id, comment: 'Approved. Enjoy!' },
      { emp: priyaEmp, lt: sickLeave, start: daysAgo(45), days: 2, status: 'APPROVED', reason: 'Not feeling well', approverId: manager?.id, comment: 'Get well soon' },
      { emp: managerEmp, lt: annualLeave, start: daysAgo(90), days: 7, status: 'APPROVED', reason: 'Family vacation', approverId: hrAdmin?.id, comment: 'Approved' },
      { emp: namedEmpObjects[1], lt: annualLeave, start: daysAgo(30), days: 3, status: 'APPROVED', reason: 'Wedding ceremony', approverId: manager?.id, comment: 'Approved, enjoy the wedding!' },
      { emp: namedEmpObjects[3], lt: casualLeave, start: daysAgo(20), days: 1, status: 'APPROVED', reason: 'Bank work', approverId: manager?.id, comment: 'OK' },
      { emp: hrEmp, lt: annualLeave, start: daysAgo(50), days: 4, status: 'APPROVED', reason: 'Travel', approverId: superAdmin?.id, comment: 'Approved' },

      // DENIED requests
      { emp: priyaEmp, lt: annualLeave, start: daysAgo(120), days: 10, status: 'DENIED', reason: 'Extended vacation', approverId: manager?.id, comment: 'Team bandwidth is low, cannot approve' },
      { emp: namedEmpObjects[2], lt: annualLeave, start: daysAgo(15), days: 5, status: 'DENIED', reason: 'Holiday', approverId: manager?.id, comment: 'Critical sprint in progress, please reschedule' },
      { emp: namedEmpObjects[1], lt: casualLeave, start: daysAgo(25), days: 2, status: 'DENIED', reason: 'Personal trip', approverId: manager?.id, comment: 'Release week, not approved' },

      // WITHDRAWN requests
      { emp: priyaEmp, lt: casualLeave, start: daysAgo(70), days: 1, status: 'WITHDRAWN', reason: 'Doctor visit (cancelled)' },
      { emp: namedEmpObjects[3], lt: annualLeave, start: daysAgo(40), days: 3, status: 'WITHDRAWN', reason: 'Trip plans cancelled' },

      // CANCELLED
      { emp: managerEmp, lt: casualLeave, start: daysAgo(100), days: 1, status: 'CANCELLED', reason: 'Meeting rescheduled' },
    ];

    for (const scenario of leaveScenarios) {
      if (!scenario.emp) continue;
      const start = scenario.start;
      const end = addDays(start, scenario.days - 1);

      await prisma.leaveRequest.create({
        data: {
          tenantId,
          employeeId: scenario.emp.id,
          leaveTypeId: scenario.lt.id,
          startDate: start,
          endDate: end,
          totalDays: scenario.days,
          reason: scenario.reason,
          status: scenario.status,
          approverId: scenario.approverId ?? null,
          approverComment: scenario.comment ?? null,
          submittedAt: addDays(start, -2),
          decidedAt: scenario.approverId ? addDays(start, -1) : null,
        },
      });
    }
    console.log(`  ✓ Created ${leaveScenarios.length} leave requests`);
  }

  // ── Attendance records — varied statuses ──────────────────────────────────
  console.log('\n🕐 Creating varied attendance records...');

  const coreEmps = [managerEmp, priyaEmp, hrEmp, ...namedEmpObjects].filter(Boolean);
  let attCreated = 0;
  let attSkipped = 0;

  for (const emp of coreEmps) {
    for (let d = 1; d <= 90; d++) {
      const date = daysAgo(d);
      if (isWeekend(date)) continue;

      const existing = await prisma.attendanceRecord.findFirst({
        where: { tenantId, employeeId: emp.id, attendanceDate: date },
      });
      if (existing) { attSkipped++; continue; }

      // Vary attendance status: mostly PRESENT, some WFH, occasional ABSENT/HALF_DAY
      let status = 'PRESENT';
      let checkIn = addHours(date, 9);
      let checkOut = addHours(date, 18);
      let totalMinutes = 540;
      let workMode = 'OFFICE';
      let notes = null;

      const rand = (d + emp.id.charCodeAt(0)) % 10;
      if (rand === 9) {
        status = 'ABSENT';
        checkIn = null; checkOut = null; totalMinutes = null;
        notes = 'No show';
      } else if (rand >= 7) {
        status = 'WFH';
        workMode = 'WFH';
        checkIn = addHours(date, 9.5);
        checkOut = addHours(date, 18.5);
      } else if (rand === 6) {
        status = 'HALF_DAY';
        checkIn = addHours(date, 9);
        checkOut = addHours(date, 13.5);
        totalMinutes = 270;
        notes = 'Half-day leave';
      } else if (rand >= 4) {
        workMode = 'WFH';
        checkIn = addHours(date, 9.25);
        checkOut = addHours(date, 18.25);
      } else {
        // Late arrival some days
        if (rand === 3) {
          checkIn = addHours(date, 10.5);
          totalMinutes = 450;
          notes = 'Late arrival';
        }
      }

      await prisma.attendanceRecord.create({
        data: {
          tenantId,
          employeeId: emp.id,
          attendanceDate: date,
          status,
          checkInAt: checkIn,
          checkOutAt: checkOut,
          workMode,
          totalMinutes,
          notes,
        },
      });
      attCreated++;
    }
  }
  console.log(`  ✓ Created: ${attCreated} | Skipped (exist): ${attSkipped}`);

  // ── More leave types ───────────────────────────────────────────────────────
  console.log('\n📄 Adding more leave types...');
  const extraLeaveTypes = [
    { code: 'MATERNITY', name: 'Maternity Leave', annualAllowance: 180, isPaid: true, carryForwardAllowed: false },
    { code: 'PATERNITY', name: 'Paternity Leave', annualAllowance: 15, isPaid: true, carryForwardAllowed: false },
    { code: 'COMPENSATORY', name: 'Compensatory Off', annualAllowance: 12, isPaid: true, carryForwardAllowed: true },
    { code: 'UNPAID', name: 'Unpaid Leave', annualAllowance: 30, isPaid: false, carryForwardAllowed: false },
    { code: 'BEREAVEMENT', name: 'Bereavement Leave', annualAllowance: 5, isPaid: true, carryForwardAllowed: false },
  ];

  for (const lt of extraLeaveTypes) {
    await prisma.leaveType.upsert({
      where: { tenantId_code: { tenantId, code: lt.code } },
      update: { name: lt.name },
      create: { tenantId, isActive: true, ...lt },
    });
    console.log(`  ✓ Upserted: ${lt.name}`);
  }

  // ── More holidays ──────────────────────────────────────────────────────────
  console.log('\n🎉 Adding full holiday calendar...');
  const year = new Date().getFullYear();
  const allHolidays = [
    { name: "New Year's Day", date: new Date(`${year}-01-01`) },
    { name: 'Republic Day', date: new Date(`${year}-01-26`) },
    { name: 'Holi', date: new Date(`${year}-03-14`) },
    { name: 'Good Friday', date: new Date(`${year}-04-18`) },
    { name: 'Eid al-Fitr', date: new Date(`${year}-03-30`) },
    { name: 'Ram Navami', date: new Date(`${year}-04-06`) },
    { name: 'Maharashtra Day', date: new Date(`${year}-05-01`) },
    { name: 'Eid al-Adha', date: new Date(`${year}-06-06`) },
    { name: 'Independence Day', date: new Date(`${year}-08-15`) },
    { name: 'Onam', date: new Date(`${year}-09-05`) },
    { name: 'Gandhi Jayanti', date: new Date(`${year}-10-02`) },
    { name: 'Dussehra', date: new Date(`${year}-10-02`) },
    { name: 'Diwali', date: new Date(`${year}-10-20`) },
    { name: 'Guru Nanak Jayanti', date: new Date(`${year}-11-05`) },
    { name: 'Christmas', date: new Date(`${year}-12-25`) },
  ];

  let holCreated = 0;
  for (const h of allHolidays) {
    const existing = await prisma.holiday.findFirst({ where: { tenantId, name: h.name, holidayDate: h.date } });
    if (!existing) {
      await prisma.holiday.create({
        data: { tenantId, name: h.name, holidayDate: h.date, isOptional: false },
      });
      holCreated++;
    }
  }
  console.log(`  ✓ Created: ${holCreated} holidays`);

  // ── TenantConfig (working hours) ───────────────────────────────────────────
  console.log('\n⚙️  Setting up tenant config...');
  const existingConfig = await prisma.tenantConfig.findFirst({ where: { tenantId } });
  if (!existingConfig) {
    await prisma.tenantConfig.create({
      data: {
        tenantId,
        companyName: 'Acme Corp',
        timezone: 'Asia/Kolkata',
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
        fiscalYearStart: 4,
        fiscalYearEnd: 3,
      },
    });
    console.log('  ✓ Tenant config created');
  } else {
    console.log('  · Skipped (exists)');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const [totalEmp, totalLeave, totalAttendance, totalHolidays, totalLeaveTypes] = await Promise.all([
    prisma.employee.count({ where: { tenantId, deletedAt: null } }),
    prisma.leaveRequest.count({ where: { tenantId } }),
    prisma.attendanceRecord.count({ where: { tenantId } }),
    prisma.holiday.count({ where: { tenantId } }),
    prisma.leaveType.count({ where: { tenantId } }),
  ]);

  const leaveByStatus = await prisma.leaveRequest.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: true,
  });

  console.log(`
╔══════════════════════════════════════════════════════╗
║            COMPREHENSIVE SEED COMPLETE               ║
╠══════════════════════════════════════════════════════╣
║  Employees:        ${String(totalEmp).padEnd(33)}║
║  Leave Requests:   ${String(totalLeave).padEnd(33)}║
║  Attendance Recs:  ${String(totalAttendance).padEnd(33)}║
║  Holidays:         ${String(totalHolidays).padEnd(33)}║
║  Leave Types:      ${String(totalLeaveTypes).padEnd(33)}║
╠══════════════════════════════════════════════════════╣
║  Leave by status:                                    ║`);
  for (const row of leaveByStatus) {
    console.log(`║    ${row.status.padEnd(12)}: ${String(row._count).padEnd(36)}║`);
  }
  console.log(`╠══════════════════════════════════════════════════════╣
║  Extra accounts (Password123!):                      ║
║    riya@acme.test      → MANAGER (Sales)             ║
║    dev1@acme.test      → EMPLOYEE (Engineering)      ║
║    dev2@acme.test      → EMPLOYEE (Engineering)      ║
║    fin1@acme.test      → EMPLOYEE (Finance)          ║
║    onleave@acme.test   → EMPLOYEE (ON_LEAVE status)  ║
╚══════════════════════════════════════════════════════╝
`);
}

main()
  .catch((e) => {
    console.error('❌ Comprehensive seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
