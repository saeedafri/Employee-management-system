/**
 * Phase 2 seed — adds rich test data for all new API endpoints.
 * Safe to re-run (uses upsert / skip-duplicates where possible).
 * Run: node prisma/seedPhase2.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addHours(date, h) { return new Date(date.getTime() + h * 3600000); }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function main() {
  console.log('🌱 Phase 2 seed starting...');

  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: 'acme-corp-001' } });
  if (!tenant) throw new Error('Run base seed first');

  const employees = await prisma.employee.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    include: { user: true },
    take: 70,
  });
  console.log(`Found ${employees.length} employees`);

  // ─── 1. LEAVE TYPES ────────────────────────────────────────────────────────
  const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId: tenant.id } });
  const ltAnnual = leaveTypes.find(l => l.code === 'ANNUAL') || leaveTypes[0];
  const ltSick   = leaveTypes.find(l => l.code === 'SICK')   || leaveTypes[1] || ltAnnual;
  const ltCasual = leaveTypes.find(l => l.code === 'CASUAL') || leaveTypes[2] || ltAnnual;
  console.log(`Leave types: ${leaveTypes.map(l=>l.code).join(', ')}`);

  // ─── 2. LEAVE REQUESTS (50 more in varied statuses) ────────────────────────
  console.log('Adding leave requests...');
  const leaveStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'];
  let lrAdded = 0;
  for (let i = 0; i < 50; i++) {
    const emp = pick(employees);
    const lt  = pick([ltAnnual, ltSick, ltCasual]);
    const startOffset = randomInt(1, 120);
    const startDate   = daysAgo(startOffset);
    const days        = randomInt(1, 5);
    const endDate     = new Date(startDate.getTime() + days * 86400000);
    const status      = pick(leaveStatuses);

    try {
      await prisma.leaveRequest.create({
        data: {
          tenantId:    tenant.id,
          employeeId:  emp.id,
          leaveTypeId: lt.id,
          startDate,
          endDate,
          totalDays:   days,
          reason:      pick(['Family event', 'Medical appointment', 'Personal work', 'Vacation', 'Sick', 'Urgent travel']),
          status,
          reviewedAt:  ['APPROVED','REJECTED'].includes(status) ? new Date() : null,
          reviewNote:  status === 'REJECTED' ? 'Team bandwidth constraint' : null,
        },
      });
      lrAdded++;
    } catch { /* skip duplicates */ }
  }
  console.log(`✅ Added ${lrAdded} leave requests`);

  // ─── 3. ATTENDANCE RECORDS (180 more — last 90 days for 20 employees) ──────
  console.log('Adding attendance records...');
  const attStatuses = ['PRESENT', 'PRESENT', 'PRESENT', 'WFH', 'WFH', 'ABSENT', 'HALF_DAY', 'ON_LEAVE'];
  let attnAdded = 0;
  const targetEmps = employees.slice(0, 20);
  for (const emp of targetEmps) {
    for (let d = 1; d <= 30; d++) {
      const date = daysAgo(d);
      const dow  = date.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends
      const status = pick(attStatuses);
      try {
        const checkIn  = status === 'ABSENT' ? null : addHours(date, randomInt(8, 10));
        const checkOut = (status === 'ABSENT' || status === 'HALF_DAY') ? null
          : checkIn ? addHours(checkIn, randomInt(7, 10)) : null;
        await prisma.attendanceRecord.create({
          data: {
            tenantId:      tenant.id,
            employeeId:    emp.id,
            attendanceDate: date,
            checkInAt:     checkIn,
            checkOutAt:    checkOut,
            status,
            workMode:      pick(['OFFICE', 'WFH', 'OFFICE', 'OFFICE']),
            totalMinutes:  checkIn && checkOut
              ? Math.floor((checkOut - checkIn) / 60000)
              : null,
          },
        });
        attnAdded++;
      } catch { /* skip duplicates */ }
    }
  }
  console.log(`✅ Added ${attnAdded} attendance records`);

  // ─── 4. REGULARIZATION REQUESTS (20 more) ──────────────────────────────────
  console.log('Adding regularization requests...');
  const regStatuses = ['PENDING', 'APPROVED', 'DENIED', 'PENDING', 'APPROVED'];
  let regAdded = 0;
  for (let i = 0; i < 20; i++) {
    const emp = pick(employees);
    try {
      await prisma.attendanceRegularizationRequest.create({
        data: {
          tenantId:       tenant.id,
          employeeId:     emp.id,
          attendanceDate: daysAgo(randomInt(2, 60)),
          reason:         pick(['WFH not marked', 'Forgot to check in', 'System issue', 'Left early due to emergency', 'Check-in time wrong']),
          status:         pick(regStatuses),
        },
      });
      regAdded++;
    } catch { /* skip */ }
  }
  console.log(`✅ Added ${regAdded} regularization requests`);

  // ─── 5. NOTIFICATIONS (30 — varied types) ──────────────────────────────────
  console.log('Adding notifications...');
  const notifTypes = ['LEAVE_APPROVED','LEAVE_REJECTED','ATTENDANCE_FLAGGED','PAYROLL_PROCESSED','GENERAL'];
  const ttl12h = new Date(Date.now() + 12 * 3600000);
  let notifAdded = 0;
  for (let i = 0; i < 30; i++) {
    const emp = pick(employees);
    if (!emp.user) continue;
    const type = pick(notifTypes);
    try {
      await prisma.notification.create({
        data: {
          tenantId:  tenant.id,
          userId:    emp.user.id,
          type,
          title:     `${type.replace(/_/g,' ')} — ${emp.firstName}`,
          message:   pick([
            'Your leave request has been approved.',
            'Please check your attendance for last week.',
            'Payroll for June has been processed.',
            'Your regularization request was reviewed.',
            'A new holiday has been added to the calendar.',
          ]),
          isRead:    pick([true, false, false]),
          expiresAt: ttl12h,
        },
      });
      notifAdded++;
    } catch { /* skip */ }
  }
  console.log(`✅ Added ${notifAdded} notifications`);

  // ─── 6. AUDIT LOGS (20 more) ───────────────────────────────────────────────
  console.log('Adding audit logs...');
  const actions = ['EMPLOYEE_UPDATED','LEAVE_APPROVED','LEAVE_REJECTED','ATTENDANCE_CHECKED_IN','SETTING_CHANGED'];
  let auditAdded = 0;
  for (let i = 0; i < 20; i++) {
    const emp = pick(employees);
    if (!emp.user) continue;
    try {
      await prisma.auditLog.create({
        data: {
          tenantId:     tenant.id,
          actorUserId:  emp.user.id,
          action:       pick(actions),
          entityType:   pick(['Employee','LeaveRequest','AttendanceRecord','Setting']),
          entityId:     emp.id,
          before:       { status: 'PENDING' },
          after:        { status: 'APPROVED' },
          ipAddress:    '127.0.0.1',
        },
      });
      auditAdded++;
    } catch { /* skip */ }
  }
  console.log(`✅ Added ${auditAdded} audit log entries`);

  // ─── 7. HOLIDAYS (next 12 months) ──────────────────────────────────────────
  console.log('Adding holidays...');
  const upcoming = [
    { name: 'Independence Day',    date: '2026-08-15', optional: false },
    { name: 'Gandhi Jayanti',      date: '2026-10-02', optional: false },
    { name: 'Dussehra',            date: '2026-10-12', optional: true  },
    { name: 'Diwali',              date: '2026-10-28', optional: false },
    { name: 'Diwali (Extra)',      date: '2026-10-29', optional: true  },
    { name: 'Christmas',           date: '2026-12-25', optional: false },
    { name: 'New Year',            date: '2027-01-01', optional: false },
    { name: 'Republic Day',        date: '2027-01-26', optional: false },
    { name: 'Holi',                date: '2027-03-01', optional: true  },
    { name: 'Eid ul-Fitr',         date: '2027-03-30', optional: true  },
    { name: 'Good Friday',         date: '2027-04-02', optional: true  },
    { name: 'Eid ul-Adha',         date: '2027-06-07', optional: true  },
  ];
  let holidayAdded = 0;
  for (const h of upcoming) {
    const existing = await prisma.holiday.findFirst({
      where: { tenantId: tenant.id, name: h.name },
    });
    if (!existing) {
      await prisma.holiday.create({
        data: {
          tenantId:    tenant.id,
          name:        h.name,
          holidayDate: new Date(h.date),
          isOptional:  h.optional,
          location:    'India',
        },
      });
      holidayAdded++;
    }
  }
  console.log(`✅ Added ${holidayAdded} holidays`);

  // ─── FINAL COUNT ───────────────────────────────────────────────────────────
  const [emps, attn, leave, regs, notifs, audits, hols] = await Promise.all([
    prisma.employee.count({ where: { tenantId: tenant.id, deletedAt: null } }),
    prisma.attendanceRecord.count({ where: { tenantId: tenant.id } }),
    prisma.leaveRequest.count({ where: { tenantId: tenant.id } }),
    prisma.attendanceRegularizationRequest.count({ where: { tenantId: tenant.id } }),
    prisma.notification.count({ where: { tenantId: tenant.id } }),
    prisma.auditLog.count({ where: { tenantId: tenant.id } }),
    prisma.holiday.count({ where: { tenantId: tenant.id } }),
  ]);
  console.log('\n📊 Final DB state (acme-corp-001):');
  console.log(`  Employees:       ${emps}`);
  console.log(`  Attendance:      ${attn}`);
  console.log(`  Leave Requests:  ${leave}`);
  console.log(`  Regularizations: ${regs}`);
  console.log(`  Notifications:   ${notifs}`);
  console.log(`  Audit Logs:      ${audits}`);
  console.log(`  Holidays:        ${hols}`);
  console.log('\n✅ Phase 2 seed complete.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
