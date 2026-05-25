/**
 * Multi-tenant demo seed — 10 companies, each fully isolated.
 * Creates tenants, users, employees, departments, leave types, holidays,
 * today's attendance, leave requests, regularizations, notifications.
 *
 * Run: node prisma/seedMultiTenant.js
 * Safe to re-run: uses upsert / findFirst-before-create throughout.
 * DO NOT COMMIT — local demo/testing only.
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────────────────────────
const TODAY = new Date('2026-05-24');
TODAY.setUTCHours(0, 0, 0, 0);
const d = (n, h = 0, m = 0) => { const dt = new Date(TODAY); dt.setDate(dt.getDate() + n); dt.setUTCHours(h, m, 0, 0); return dt; };

// Argon2id hash of "Password123!" — same as existing seed
const HASHED_PW = '$argon2id$v=19$m=19456,t=2,p=1$V5DlcTkS3mxPnxgPlEMoUg$YLcf/FNUkI7s0QLsqlvdkEMI+1PVHFiKRXdDk0Vmwhg';

function cuid() {
  return 'c' + createHash('sha256').update(Math.random().toString() + Date.now()).digest('hex').slice(0, 23);
}

// ── company definitions ───────────────────────────────────────────────────────
const COMPANIES = [
  {
    tenantKey: 'techwave-solutions-001',
    name: 'TechWave Solutions',
    domain: 'techwave.test',
    industry: 'Information Technology',
    depts: ['Engineering', 'Product', 'Design', 'QA', 'DevOps'],
  },
  {
    tenantKey: 'greenleaf-ventures-001',
    name: 'GreenLeaf Ventures',
    domain: 'greenleaf.test',
    industry: 'Finance & Investment',
    depts: ['Finance', 'Investment', 'Risk', 'Compliance', 'Operations'],
  },
  {
    tenantKey: 'stellar-health-001',
    name: 'Stellar Health',
    domain: 'stellarhealth.test',
    industry: 'Healthcare',
    depts: ['Clinical', 'Pharmacy', 'Administration', 'IT', 'HR'],
  },
  {
    tenantKey: 'urbancraft-media-001',
    name: 'UrbanCraft Media',
    domain: 'urbancraft.test',
    industry: 'Media & Marketing',
    depts: ['Content', 'Design', 'Marketing', 'Sales', 'Analytics'],
  },
  {
    tenantKey: 'nexus-logistics-001',
    name: 'Nexus Logistics',
    domain: 'nexuslog.test',
    industry: 'Logistics & Supply Chain',
    depts: ['Operations', 'Warehouse', 'Fleet', 'Procurement', 'Finance'],
  },
  {
    tenantKey: 'brightmind-edu-001',
    name: 'BrightMind Education',
    domain: 'brightmind.test',
    industry: 'Education',
    depts: ['Academics', 'Admissions', 'Technology', 'Student Affairs', 'Finance'],
  },
  {
    tenantKey: 'aurora-retail-001',
    name: 'Aurora Retail',
    domain: 'aurora.test',
    industry: 'Retail',
    depts: ['Merchandising', 'Store Operations', 'E-Commerce', 'Marketing', 'HR'],
  },
  {
    tenantKey: 'vertex-manufacturing-001',
    name: 'Vertex Manufacturing',
    domain: 'vertex.test',
    industry: 'Manufacturing',
    depts: ['Production', 'Quality', 'Maintenance', 'Procurement', 'Safety'],
  },
  {
    tenantKey: 'seaport-consulting-001',
    name: 'SeaPort Consulting',
    domain: 'seaport.test',
    industry: 'Management Consulting',
    depts: ['Strategy', 'Technology', 'Operations', 'Finance', 'HR'],
  },
];

// ── employee name pool ────────────────────────────────────────────────────────
const FIRST_NAMES = ['Arun','Priya','Rahul','Sneha','Vikram','Anjali','Kiran','Deepak','Meera','Suresh','Pooja','Nikhil','Kavya','Ravi','Divya','Amit','Nisha','Arjun','Swati','Manoj','Rekha','Sanjay','Geeta','Vivek','Lakshmi','Prakash','Sunita','Harish','Radha','Vijay','Uma','Ramesh','Saranya','Ganesh','Lavanya','Mohan','Savita','Sunil','Padma','Venkat'];
const LAST_NAMES  = ['Kumar','Sharma','Patel','Singh','Verma','Gupta','Joshi','Rao','Bhat','Nair','Reddy','Mehta','Shah','Iyer','Pillai','Mishra','Agarwal','Tiwari','Pandey','Malhotra'];

function randomName(seed) {
  const h = createHash('md5').update(seed).digest('hex');
  const fi = parseInt(h.slice(0,4),16) % FIRST_NAMES.length;
  const li = parseInt(h.slice(4,8),16) % LAST_NAMES.length;
  return { firstName: FIRST_NAMES[fi], lastName: LAST_NAMES[li] };
}

// ── seed one company ──────────────────────────────────────────────────────────
async function seedCompany(company) {
  const { tenantKey, name, domain, depts } = company;
  console.log(`\n  → ${name} (${tenantKey})`);

  // 1. Tenant
  const slug = tenantKey.replace(/-\d+$/, '');
  const tenant = await prisma.tenant.upsert({
    where: { tenantKey },
    update: { name },
    create: {
      tenantKey, name,
      legalName: `${name} Pvt Ltd`,
      displayName: name,
      country: 'India',
      primaryContactEmail: `hr@${domain}`,
      defaultCurrency: 'INR',
      timezone: 'Asia/Kolkata',
    },
  });
  const tid = tenant.id;

  // 2. Leave types
  const ltDefs = [
    { name: 'Annual Leave',    code: 'AL',  annualAllowance: 18, isPaid: true,  carryForwardAllowed: true },
    { name: 'Sick Leave',      code: 'SL',  annualAllowance: 12, isPaid: true,  carryForwardAllowed: false },
    { name: 'Casual Leave',    code: 'CL',  annualAllowance: 6,  isPaid: true,  carryForwardAllowed: false },
    { name: 'Compensatory Off',code: 'CO',  annualAllowance: 4,  isPaid: true,  carryForwardAllowed: false },
    { name: 'Unpaid Leave',    code: 'UL',  annualAllowance: 0,  isPaid: false, carryForwardAllowed: false },
  ];
  const ltIds = {};
  for (const def of ltDefs) {
    const lt = await prisma.leaveType.upsert({
      where: { tenantId_code: { tenantId: tid, code: def.code } },
      update: {},
      create: { tenantId: tid, ...def },
    });
    ltIds[def.name] = lt.id;
  }

  // 3. Departments
  const deptIds = {};
  for (const deptName of depts) {
    const existing = await prisma.department.findFirst({ where: { tenantId: tid, name: deptName, deletedAt: null } });
    const dept = existing || await prisma.department.create({ data: { tenantId: tid, name: deptName } });
    deptIds[deptName] = dept.id;
  }

  // 4. Core users (SUPER_ADMIN, HR_ADMIN, 2 MANAGERs)
  async function upsertUser(email, memberType, empData = null) {
    let user = await prisma.user.findFirst({ where: { tenantId: tid, email } });
    if (!user) {
      user = await prisma.user.create({
        data: { tenantId: tid, email, passwordHash: HASHED_PW, memberType, status: 'ACTIVE' },
      });
    }
    if (empData && !user.employeeId) {
      const emp = await prisma.employee.create({
        data: { tenantId: tid, firstName: empData.firstName, lastName: empData.lastName, workEmail: email, employeeCode: empData.code, joinedOn: d(-365), employmentStatus: 'ACTIVE', departmentId: empData.deptId },
      });
      await prisma.user.update({ where: { id: user.id }, data: { employeeId: emp.id } });
      user = await prisma.user.findUnique({ where: { id: user.id } });
    }
    return user;
  }

  // Super admin (no employee record needed)
  await upsertUser(`superadmin@${domain}`, 'SUPER_ADMIN');

  // HR admin
  const hrUser = await upsertUser(`hr@${domain}`, 'HR_ADMIN', {
    firstName: 'HR', lastName: 'Admin', code: 'HR-001', deptId: deptIds[depts[depts.length - 1]],
  });

  // Managers (one per first 2 depts)
  const managerUsers = [];
  for (let mi = 0; mi < Math.min(2, depts.length); mi++) {
    const { firstName, lastName } = randomName(`mgr-${tenantKey}-${mi}`);
    const mu = await upsertUser(`manager${mi + 1}@${domain}`, 'MANAGER', {
      firstName, lastName, code: `MGR-00${mi + 1}`, deptId: deptIds[depts[mi]],
    });
    managerUsers.push(mu);
  }

  // 5. Employees (12 per company)
  const empRecords = [];
  const existingEmps = await prisma.employee.findMany({ where: { tenantId: tid, deletedAt: null }, select: { workEmail: true, id: true } });
  const existingEmails = new Set(existingEmps.map(e => e.workEmail));

  for (let i = 0; i < 12; i++) {
    const email = `emp${i + 1}@${domain}`;
    if (existingEmails.has(email)) {
      const emp = existingEmps.find(e => e.workEmail === email);
      if (emp) empRecords.push(emp);
      continue;
    }
    const { firstName, lastName } = randomName(`emp-${tenantKey}-${i}`);
    const deptName = depts[i % depts.length];
    const managerId = managerUsers[i % managerUsers.length]?.employeeId || null;

    let user = await prisma.user.findFirst({ where: { tenantId: tid, email } });
    if (!user) {
      user = await prisma.user.create({
        data: { tenantId: tid, email, passwordHash: HASHED_PW, memberType: 'EMPLOYEE', status: 'ACTIVE' },
      });
    }
    if (!user.employeeId) {
      const emp = await prisma.employee.create({
        data: {
          tenantId: tid, firstName, lastName, workEmail: email,
          employeeCode: `EMP-${String(i + 10).padStart(3,'0')}`,
          joinedOn: d(-(180 + i * 15)), employmentStatus: 'ACTIVE',
          departmentId: deptIds[deptName], managerId,
        },
      });
      await prisma.user.update({ where: { id: user.id }, data: { employeeId: emp.id } });
      empRecords.push(emp);
    }
  }

  // Fetch all employees for this tenant
  const allEmps = await prisma.employee.findMany({
    where: { tenantId: tid, deletedAt: null, NOT: { departmentId: null } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' },
  });

  // 6. Today's attendance
  const todayExisting = new Set(
    (await prisma.attendanceRecord.findMany({ where: { tenantId: tid, attendanceDate: TODAY }, select: { employeeId: true } })).map(a => a.employeeId)
  );
  let attCreated = 0;
  for (let i = 0; i < allEmps.length; i++) {
    const emp = allEmps[i];
    if (todayExisting.has(emp.id)) continue;
    const roll = i % 10;
    let status = 'PRESENT', workMode = 'OFFICE';
    if (roll === 8) status = 'ABSENT';
    else if (roll === 7) status = 'LEAVE';
    else if (roll < 2) workMode = 'WFH';
    else if (roll === 2) status = 'HALF_DAY';
    const checkIn  = (status === 'PRESENT' || status === 'HALF_DAY') ? d(0, 9, i * 3 % 30) : null;
    const checkOut = (status === 'PRESENT' && i % 3 === 0) ? d(0, 17, 30) : status === 'HALF_DAY' ? d(0, 13, 0) : null;
    const mins = checkIn && checkOut ? Math.round((checkOut - checkIn) / 60000) : null;
    await prisma.attendanceRecord.create({ data: { tenantId: tid, employeeId: emp.id, attendanceDate: TODAY, checkInAt: checkIn, checkOutAt: checkOut, status, workMode, totalMinutes: mins } });
    attCreated++;
  }

  // 7. Leave requests (today's + pending + historical)
  const annualLt = ltIds['Annual Leave'];
  const sickLt   = ltIds['Sick Leave'];
  const casualLt = ltIds['Casual Leave'];
  const approver = hrUser;
  let lrCreated = 0;

  const leaveScenarios = [
    // Approved spanning today
    { eIdx: 7, lt: annualLt, start: d(-2), end: d(2), days: 5, status: 'APPROVED', reason: 'Family vacation' },
    // Pending
    { eIdx: 3, lt: sickLt,   start: d(1),  end: d(2), days: 2, status: 'PENDING',  reason: 'Medical appointment' },
    { eIdx: 4, lt: casualLt, start: d(3),  end: d(3), days: 1, status: 'PENDING',  reason: 'Personal work' },
    { eIdx: 5, lt: annualLt, start: d(7),  end: d(11),days: 5, status: 'PENDING',  reason: 'Annual trip' },
    // Historical
    { eIdx: 6, lt: sickLt,   start: d(-7), end: d(-6),days: 2, status: 'APPROVED', reason: 'Fever' },
    { eIdx: 8, lt: casualLt, start: d(-5), end: d(-5),days: 1, status: 'DENIED',   reason: 'Shopping', comment: 'Not a valid reason' },
    { eIdx: 9, lt: annualLt, start: d(-14),end: d(-10),days:5, status: 'APPROVED', reason: 'Holiday' },
    { eIdx: 10,lt: sickLt,   start: d(-3), end: d(-2),days: 2, status: 'WITHDRAWN',reason: 'Cancelled plans' },
  ];

  for (const { eIdx, lt, start, end, days, status, reason, comment } of leaveScenarios) {
    const emp = allEmps[eIdx];
    if (!emp) continue;
    const ex = await prisma.leaveRequest.findFirst({ where: { tenantId: tid, employeeId: emp.id, startDate: start } });
    if (ex) continue;
    await prisma.leaveRequest.create({
      data: {
        tenantId: tid, employeeId: emp.id, leaveTypeId: lt,
        startDate: start, endDate: end, totalDays: days, reason, status,
        submittedAt: new Date(start.getTime() - 3 * 86400000),
        decidedAt: status !== 'PENDING' ? new Date(start.getTime() - 86400000) : null,
        approverId: status !== 'PENDING' && status !== 'WITHDRAWN' && approver?.employeeId ? approver.id : null,
        approverComment: comment || (status === 'APPROVED' ? 'Approved.' : null),
      },
    });
    lrCreated++;
  }

  // 8. Regularization requests
  let regCreated = 0;
  for (let i = 0; i < Math.min(allEmps.length, 5); i++) {
    const emp = allEmps[i];
    const date = d(-(i + 1));
    const ex = await prisma.attendanceRegularizationRequest.findFirst({ where: { tenantId: tid, employeeId: emp.id, attendanceDate: date } });
    if (ex) continue;
    const status = i < 3 ? 'PENDING' : i === 3 ? 'APPROVED' : 'DENIED';
    await prisma.attendanceRegularizationRequest.create({
      data: {
        tenantId: tid, employeeId: emp.id, attendanceDate: date,
        reason: 'System issue during check-in', status,
        reviewerId: status !== 'PENDING' ? (hrUser?.id || null) : null,
        reviewerComment: status === 'APPROVED' ? 'Verified and approved' : status === 'DENIED' ? 'Insufficient evidence' : null,
      },
    });
    regCreated++;
  }

  // 9. Leave balances
  for (let i = 0; i < allEmps.length; i++) {
    const emp = allEmps[i];
    for (const [ltName, ltId] of Object.entries(ltIds).slice(0, 4)) {
      const allocated = ltName === 'Annual Leave' ? 18 : ltName === 'Sick Leave' ? 12 : ltName === 'Casual Leave' ? 6 : 4;
      const used = i % 5;
      await prisma.leaveBalance.upsert({
        where: { tenantId_employeeId_leaveTypeId: { tenantId: tid, employeeId: emp.id, leaveTypeId: ltId } },
        update: {},
        create: { tenantId: tid, employeeId: emp.id, leaveTypeId: ltId, balance: allocated - used, used, pending: 0 },
      });
    }
  }

  // 10. Holidays
  const holidayNames = [
    { name: 'Republic Day',      date: new Date('2026-01-26') },
    { name: 'Holi',              date: new Date('2026-03-14') },
    { name: 'Independence Day',  date: new Date('2026-08-15') },
    { name: 'Gandhi Jayanti',    date: new Date('2026-10-02') },
    { name: 'Diwali',            date: new Date('2026-11-08') },
    { name: 'Christmas',         date: new Date('2026-12-25') },
  ];
  for (const { name: hName, date } of holidayNames) {
    const ex = await prisma.holiday.findFirst({ where: { tenantId: tid, name: hName } });
    if (!ex) await prisma.holiday.create({ data: { tenantId: tid, name: hName, holidayDate: date, isOptional: false } });
  }

  // 11. Settings
  const settingsData = [
    { groupKey: 'workspace', settingKey: 'company-name',         valueJson: name },
    { groupKey: 'workspace', settingKey: 'timezone',             valueJson: 'Asia/Kolkata' },
    { groupKey: 'workspace', settingKey: 'working-hours-start',  valueJson: '09:00' },
    { groupKey: 'workspace', settingKey: 'working-hours-end',    valueJson: '18:00' },
    { groupKey: 'workspace', settingKey: 'fiscal-year-start',    valueJson: 4 },
    { groupKey: 'attendance', settingKey: 'grace-minutes',       valueJson: 15 },
  ];
  for (const { groupKey, settingKey, valueJson } of settingsData) {
    await prisma.setting.upsert({
      where: { tenantId_groupKey_settingKey: { tenantId: tid, groupKey, settingKey } },
      update: { valueJson },
      create: { tenantId: tid, groupKey, settingKey, valueJson },
    });
  }

  // 12. Notifications for pending items
  const allUsers = await prisma.user.findMany({ where: { tenantId: tid, memberType: { in: ['HR_ADMIN','SUPER_ADMIN','MANAGER'] } }, select: { id: true } });
  const expires12h = new Date(Date.now() + 12 * 3600 * 1000);
  const currentNotifCount = await prisma.notification.count({ where: { tenantId: tid } });
  if (currentNotifCount < 5) {
    const notifData = [];
    for (const u of allUsers.slice(0, 3)) {
      notifData.push({ tenantId: tid, userId: u.id, type: 'leave_requested', title: 'New Leave Request', message: 'An employee has submitted a leave request pending your review', expiresAt: expires12h });
      notifData.push({ tenantId: tid, userId: u.id, type: 'regularization_requested', title: 'Regularization Request', message: 'An employee submitted a regularization request', expiresAt: expires12h });
    }
    if (notifData.length > 0) await prisma.notification.createMany({ data: notifData, skipDuplicates: true });
  }

  const todayPresent = await prisma.attendanceRecord.count({ where: { tenantId: tid, attendanceDate: TODAY, status: 'PRESENT' } });
  const todayLeave   = await prisma.leaveRequest.count({ where: { tenantId: tid, status: 'APPROVED', startDate: { lte: TODAY }, endDate: { gte: TODAY } } });
  const pending      = await prisma.leaveRequest.count({ where: { tenantId: tid, status: 'PENDING' } });
  console.log(`     ✓ ${allEmps.length} employees | Today: ${todayPresent} present, ${todayLeave} on leave | ${pending} pending | ${attCreated} att, ${lrCreated} LR, ${regCreated} reg created`);

  return tid;
}

// ── isolation verification ────────────────────────────────────────────────────
async function verifyIsolation(tenantIds) {
  console.log('\n=== ISOLATION VERIFICATION ===');

  for (let i = 0; i < Math.min(tenantIds.length, 3); i++) {
    const tid = tenantIds[i];
    const tenant = await prisma.tenant.findUnique({ where: { id: tid }, select: { name: true } });

    // Count employees visible from this tenant's perspective
    const empCount     = await prisma.employee.count({ where: { tenantId: tid } });
    const leaveCount   = await prisma.leaveRequest.count({ where: { tenantId: tid } });
    const attCount     = await prisma.attendanceRecord.count({ where: { tenantId: tid } });
    const notifCount   = await prisma.notification.count({ where: { tenantId: tid } });

    // Verify NO cross-tenant data leaks (pick a random employee from this tenant)
    const sampleEmp = await prisma.employee.findFirst({ where: { tenantId: tid } });
    let crossLeak = false;
    if (sampleEmp) {
      // An employee from this tenant should ONLY appear in this tenant's records
      const otherTenantRecords = await prisma.attendanceRecord.count({
        where: { employeeId: sampleEmp.id, NOT: { tenantId: tid } },
      });
      crossLeak = otherTenantRecords > 0;
    }

    const status = crossLeak ? '❌ LEAK DETECTED' : '✅ ISOLATED';
    console.log(`  ${status} | ${tenant?.name}: ${empCount} emp, ${leaveCount} LR, ${attCount} att, ${notifCount} notif`);
  }

  // Verify email uniqueness across ALL tenants (no email in 2 tenants — would cause AMBIGUOUS_EMAIL on login)
  const allUsers = await prisma.user.findMany({ select: { email: true, tenantId: true } });
  const emailMap = {};
  let ambiguous = 0;
  for (const u of allUsers) {
    if (!emailMap[u.email]) emailMap[u.email] = [];
    emailMap[u.email].push(u.tenantId);
  }
  for (const [email, tids] of Object.entries(emailMap)) {
    if (tids.length > 1) {
      console.log(`  ⚠️  AMBIGUOUS EMAIL: ${email} exists in ${tids.length} tenants`);
      ambiguous++;
    }
  }
  if (ambiguous === 0) console.log(`  ✅ All ${Object.keys(emailMap).length} emails are unique across tenants (no AMBIGUOUS_EMAIL risk)`);

  console.log('');
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Multi-Tenant Demo Seed');
  console.log('======================');
  console.log(`Creating/updating ${COMPANIES.length} companies...\n`);

  const tenantIds = [];
  for (const company of COMPANIES) {
    const tid = await seedCompany(company);
    tenantIds.push(tid);
  }

  await verifyIsolation(tenantIds);

  // Final summary
  const totalTenants    = await prisma.tenant.count();
  const totalUsers      = await prisma.user.count();
  const totalEmps       = await prisma.employee.count({ where: { deletedAt: null } });
  const totalAtt        = await prisma.attendanceRecord.count();
  const totalLR         = await prisma.leaveRequest.count();
  const totalNotifs     = await prisma.notification.count();

  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║       MULTI-TENANT SEED COMPLETE              ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log(`║  Total Tenants:           ${String(totalTenants).padStart(4)}               ║`);
  console.log(`║  Total Users:             ${String(totalUsers).padStart(4)}               ║`);
  console.log(`║  Total Employees:         ${String(totalEmps).padStart(4)}               ║`);
  console.log(`║  Total Attendance Rec:    ${String(totalAtt).padStart(4)}               ║`);
  console.log(`║  Total Leave Requests:    ${String(totalLR).padStart(4)}               ║`);
  console.log(`║  Total Notifications:     ${String(totalNotifs).padStart(4)}               ║`);
  console.log('╠═══════════════════════════════════════════════╣');
  console.log('║  Login credentials (all tenants):             ║');
  console.log('║    SUPER_ADMIN:  superadmin@{domain}          ║');
  console.log('║    HR_ADMIN:     hr@{domain}                  ║');
  console.log('║    MANAGER:      manager1@{domain}            ║');
  console.log('║    EMPLOYEE:     emp1@{domain} .. emp12@{dom} ║');
  console.log('║    Password:     Password123!                  ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log('║  Company domains:                             ║');
  for (const c of COMPANIES) {
    const line = `║    ${c.tenantKey.padEnd(36)} ║`;
    console.log(line);
  }
  console.log('╚═══════════════════════════════════════════════╝');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
