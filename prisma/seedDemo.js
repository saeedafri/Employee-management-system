/**
 * Demo seed — makes EVERY API show rich, realistic data for demos.
 * Safe to re-run: uses upsert / skipDuplicates / findFirst-before-create.
 * Run: npm run db:seed:demo
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TODAY = new Date('2026-05-24');
TODAY.setUTCHours(0, 0, 0, 0);

function d(offsetDays, h = 0, m = 0) {
  const dt = new Date(TODAY);
  dt.setDate(dt.getDate() + offsetDays);
  dt.setUTCHours(h, m, 0, 0);
  return dt;
}

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { tenantKey: 'acme-corp-001' } });
  const tid = tenant.id;
  console.log('Tenant:', tenant.name, tid);

  // Real employees (have a departmentId)
  const allEmps = await prisma.employee.findMany({
    where: { tenantId: tid, deletedAt: null, NOT: { departmentId: null } },
    select: { id: true, firstName: true, lastName: true, departmentId: true, managerId: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Real employees: ${allEmps.length}`);

  const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId: tid } });
  const ltByName = Object.fromEntries(leaveTypes.map(l => [l.name, l.id]));
  const annualLt  = ltByName['Annual Leave'];
  const sickLt    = ltByName['Sick Leave'];
  const casualLt  = ltByName['Casual Leave'];
  const compOffLt = ltByName['Compensatory Off'];
  const maternityLt   = ltByName['Maternity Leave'];
  const bereavementLt = ltByName['Bereavement Leave'];

  const users = await prisma.user.findMany({
    where: { tenantId: tid, NOT: { employeeId: null } },
    select: { id: true, email: true, memberType: true, employeeId: true },
  });
  const superAdmin  = await prisma.user.findFirst({ where: { tenantId: tid, memberType: 'SUPER_ADMIN' } });
  const hrAdmin     = await prisma.user.findFirst({ where: { tenantId: tid, memberType: 'HR_ADMIN' } });
  const approverUser = hrAdmin || superAdmin;
  const allAdminIds  = users.filter(u => ['HR_ADMIN','SUPER_ADMIN','MANAGER'].includes(u.memberType)).map(u => u.id);
  const empUserMap   = Object.fromEntries(users.map(u => [u.employeeId, u.id]));

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. TODAY'S ATTENDANCE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[1] Creating today\'s attendance records...');

  const onLeaveToday    = allEmps.slice(8, 16);   // 8 employees on approved leave
  const remaining       = allEmps.filter(e => !onLeaveToday.includes(e));
  const wfhEmps         = remaining.slice(0, 8);
  const halfDayEmps     = remaining.slice(8, 12);
  const presentEmps     = remaining.slice(12, 58);
  const absentEmps      = remaining.slice(58);

  const existingToday   = await prisma.attendanceRecord.findMany({
    where: { tenantId: tid, attendanceDate: TODAY },
    select: { employeeId: true },
  });
  const alreadyIn = new Set(existingToday.map(a => a.employeeId));

  let attCount = 0;

  async function makeAtt(emp, status, workMode, checkInH, checkInM, checkOutH, checkOutM) {
    if (alreadyIn.has(emp.id)) return;
    const checkIn  = checkInH  != null ? d(0, checkInH,  checkInM  || 0) : null;
    const checkOut = checkOutH != null ? d(0, checkOutH, checkOutM || 0) : null;
    const mins = checkIn && checkOut ? Math.round((checkOut - checkIn) / 60000) : null;
    await prisma.attendanceRecord.create({
      data: { tenantId: tid, employeeId: emp.id, attendanceDate: TODAY, checkInAt: checkIn, checkOutAt: checkOut, status, workMode, totalMinutes: mins },
    });
    attCount++;
  }

  for (let i = 0; i < presentEmps.length; i++) {
    const h = 8 + (i % 3);
    const m = (i * 7) % 60;
    const checkedOut = i < 30;
    await makeAtt(presentEmps[i], 'PRESENT', 'OFFICE', h, m, checkedOut ? 17 + (i % 2) : null, checkedOut ? (i * 11) % 60 : null);
  }
  for (let i = 0; i < wfhEmps.length; i++) {
    await makeAtt(wfhEmps[i], 'PRESENT', 'WFH', 9, i * 5, null, null);
  }
  for (let i = 0; i < halfDayEmps.length; i++) {
    await makeAtt(halfDayEmps[i], 'HALF_DAY', 'OFFICE', 9, 0, 13, 0);
  }
  for (const emp of absentEmps) {
    if (alreadyIn.has(emp.id)) continue;
    await prisma.attendanceRecord.create({
      data: { tenantId: tid, employeeId: emp.id, attendanceDate: TODAY, status: 'ABSENT', workMode: 'OFFICE' },
    });
    attCount++;
  }
  for (const emp of onLeaveToday) {
    if (alreadyIn.has(emp.id)) continue;
    await prisma.attendanceRecord.create({
      data: { tenantId: tid, employeeId: emp.id, attendanceDate: TODAY, status: 'LEAVE', workMode: 'OFFICE' },
    });
    attCount++;
  }
  console.log(`  Created ${attCount} attendance records for today`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. APPROVED LEAVES SPANNING TODAY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[2] Creating approved leaves spanning today...');

  const leavesToday = [
    { emp: onLeaveToday[0], lt: annualLt,      start: d(-2), end: d(1),  days: 4,  reason: 'Family vacation' },
    { emp: onLeaveToday[1], lt: sickLt,        start: d(-1), end: d(0),  days: 2,  reason: 'Fever and cold' },
    { emp: onLeaveToday[2], lt: casualLt,      start: d(0),  end: d(1),  days: 2,  reason: 'Personal work' },
    { emp: onLeaveToday[3], lt: annualLt,      start: d(-3), end: d(2),  days: 6,  reason: 'Wedding in family' },
    { emp: onLeaveToday[4], lt: sickLt,        start: d(0),  end: d(0),  days: 1,  reason: 'Migraine' },
    { emp: onLeaveToday[5], lt: maternityLt,   start: d(-30),end: d(60), days: 91, reason: 'Maternity leave' },
    { emp: onLeaveToday[6], lt: bereavementLt, start: d(-1), end: d(2),  days: 4,  reason: 'Family bereavement' },
    { emp: onLeaveToday[7], lt: casualLt,      start: d(0),  end: d(0),  days: 1,  reason: 'Bank work' },
  ];

  let ltCount = 0;
  for (const { emp, lt, start, end, days, reason } of leavesToday) {
    const ex = await prisma.leaveRequest.findFirst({ where: { tenantId: tid, employeeId: emp.id, startDate: start, status: 'APPROVED' } });
    if (ex) continue;
    await prisma.leaveRequest.create({
      data: { tenantId: tid, employeeId: emp.id, leaveTypeId: lt, startDate: start, endDate: end, totalDays: days, reason, status: 'APPROVED', submittedAt: d(-5), decidedAt: d(-4), approverId: approverUser?.id, approverComment: 'Approved.' },
    });
    ltCount++;
  }
  console.log(`  Created ${ltCount} approved leaves spanning today`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PENDING LEAVE REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[3] Creating pending leave requests...');

  const pendingLeaves = [
    { emp: allEmps[20], lt: annualLt,  start: d(3),  end: d(7),  days: 5,  reason: 'Annual holiday trip to Goa' },
    { emp: allEmps[21], lt: sickLt,    start: d(1),  end: d(2),  days: 2,  reason: 'Medical checkup scheduled' },
    { emp: allEmps[22], lt: casualLt,  start: d(5),  end: d(5),  days: 1,  reason: 'Personal errand' },
    { emp: allEmps[23], lt: compOffLt, start: d(2),  end: d(3),  days: 2,  reason: 'Worked on last weekend' },
    { emp: allEmps[24], lt: annualLt,  start: d(10), end: d(17), days: 8,  reason: 'International vacation — Europe trip' },
    { emp: allEmps[25], lt: sickLt,    start: d(1),  end: d(1),  days: 1,  reason: 'Dental appointment' },
    { emp: allEmps[26], lt: casualLt,  start: d(7),  end: d(8),  days: 2,  reason: 'House shifting' },
    { emp: allEmps[27], lt: annualLt,  start: d(14), end: d(18), days: 5,  reason: 'Summer vacation with family' },
    { emp: allEmps[28], lt: compOffLt, start: d(3),  end: d(3),  days: 1,  reason: 'Compensatory off for extra hours' },
    { emp: allEmps[29], lt: sickLt,    start: d(2),  end: d(3),  days: 2,  reason: 'Doctor appointment' },
    { emp: allEmps[30], lt: annualLt,  start: d(21), end: d(25), days: 5,  reason: 'Family get-together' },
    { emp: allEmps[31], lt: casualLt,  start: d(4),  end: d(4),  days: 1,  reason: "Attending a friend's wedding" },
  ];

  let plCount = 0;
  for (let i = 0; i < pendingLeaves.length; i++) {
    const { emp, lt, start, end, days, reason } = pendingLeaves[i];
    const ex = await prisma.leaveRequest.findFirst({ where: { tenantId: tid, employeeId: emp.id, startDate: start, status: 'PENDING' } });
    if (ex) continue;
    await prisma.leaveRequest.create({
      data: { tenantId: tid, employeeId: emp.id, leaveTypeId: lt, startDate: start, endDate: end, totalDays: days, reason, status: 'PENDING', submittedAt: d(-(i % 3 + 1)) },
    });
    plCount++;
  }
  console.log(`  Created ${plCount} pending leave requests`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. HISTORICAL LEAVE REQUESTS (approved, denied, withdrawn)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[4] Creating historical leave requests...');

  const historical = [
    { emp: allEmps[32], lt: annualLt,  start: d(-14), end: d(-10), days: 5,  status: 'APPROVED', reason: 'Trip to Manali',               comment: 'Approved. Enjoy!' },
    { emp: allEmps[33], lt: sickLt,    start: d(-7),  end: d(-6),  days: 2,  status: 'APPROVED', reason: 'Viral fever',                  comment: 'Get well soon.' },
    { emp: allEmps[34], lt: casualLt,  start: d(-5),  end: d(-5),  days: 1,  status: 'DENIED',   reason: 'Personal work',                comment: 'Project deadline this week, please reschedule' },
    { emp: allEmps[35], lt: compOffLt, start: d(-3),  end: d(-2),  days: 2,  status: 'APPROVED', reason: 'Worked on weekend sprint',      comment: 'Approved.' },
    { emp: allEmps[36], lt: annualLt,  start: d(-21), end: d(-17), days: 5,  status: 'APPROVED', reason: 'Diwali vacation',               comment: 'Approved. Have fun!' },
    { emp: allEmps[37], lt: sickLt,    start: d(-10), end: d(-9),  days: 2,  status: 'DENIED',   reason: 'Not feeling well',             comment: 'Medical certificate required for sick leave beyond 1 day' },
    { emp: allEmps[38], lt: annualLt,  start: d(-30), end: d(-26), days: 5,  status: 'WITHDRAWN', reason: 'Planned trip but cancelled',   comment: null },
    { emp: allEmps[39], lt: casualLt,  start: d(-4),  end: d(-4),  days: 1,  status: 'APPROVED', reason: 'Court appearance',              comment: 'Approved.' },
    { emp: allEmps[40], lt: bereavementLt, start: d(-8), end: d(-5), days: 4, status: 'APPROVED', reason: 'Family bereavement',          comment: 'Condolences. Approved.' },
    { emp: allEmps[41], lt: annualLt,  start: d(30),  end: d(40),  days: 11, status: 'APPROVED', reason: 'Annual vacation — Europe',      comment: 'Pre-approved.' },
    { emp: allEmps[42], lt: sickLt,    start: d(-2),  end: d(-1),  days: 2,  status: 'APPROVED', reason: 'Severe headache',              comment: 'Approved. Rest well.' },
    { emp: allEmps[43], lt: casualLt,  start: d(-6),  end: d(-6),  days: 1,  status: 'DENIED',   reason: 'Shopping errand',              comment: 'Not a valid reason for casual leave during project crunch' },
  ];

  let hlCount = 0;
  for (const { emp, lt, start, end, days, status, reason, comment } of historical) {
    const ex = await prisma.leaveRequest.findFirst({ where: { tenantId: tid, employeeId: emp.id, startDate: start } });
    if (ex) continue;
    await prisma.leaveRequest.create({
      data: {
        tenantId: tid, employeeId: emp.id, leaveTypeId: lt,
        startDate: start, endDate: end, totalDays: days, reason, status,
        submittedAt: new Date(start.getTime() - 3 * 86400000),
        decidedAt:   status !== 'PENDING' ? new Date(start.getTime() - 86400000) : null,
        approverId:  status !== 'PENDING' && status !== 'WITHDRAWN' ? approverUser?.id : null,
        approverComment: comment,
      },
    });
    hlCount++;
  }
  console.log(`  Created ${hlCount} historical leave requests`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. REGULARIZATION REQUESTS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[5] Creating regularization requests...');

  const regs = [
    { emp: allEmps[44], date: d(-1),  reason: 'Forgot to check out — emergency client call', status: 'PENDING' },
    { emp: allEmps[45], date: d(-2),  reason: 'System down when I tried to check in — IT can confirm', status: 'PENDING' },
    { emp: allEmps[46], date: d(-1),  reason: 'Checked in from client site, system did not capture', status: 'PENDING' },
    { emp: allEmps[47], date: d(-3),  reason: 'Attended offsite meeting, could not access portal', status: 'PENDING' },
    { emp: allEmps[48], date: d(-4),  reason: 'Network issue at office, check-in failed', status: 'PENDING' },
    { emp: allEmps[49], date: d(-2),  reason: 'Late check-in due to metro disruption (line 7 suspended)', status: 'PENDING' },
    { emp: allEmps[50], date: d(-5),  reason: 'WFH but forgot to log in system', status: 'APPROVED', comment: 'Approved — confirmed via Slack activity' },
    { emp: allEmps[51], date: d(-7),  reason: 'Power outage — could not access system', status: 'APPROVED', comment: 'Verified with IT team' },
    { emp: allEmps[52], date: d(-6),  reason: 'Was on client site all day', status: 'DENIED', comment: 'Client visit not documented — please submit travel request next time' },
    { emp: allEmps[53], date: d(-8),  reason: 'Forgot to check in while WFH', status: 'DENIED', comment: 'Third time this month — please be more careful' },
    { emp: allEmps[54], date: d(-10), reason: 'Attended conference — badge reader was down', status: 'APPROVED', comment: 'Confirmed via conference attendance list' },
  ];

  let regCount = 0;
  for (const { emp, date, reason, status, comment } of regs) {
    const ex = await prisma.attendanceRegularizationRequest.findFirst({ where: { tenantId: tid, employeeId: emp.id, attendanceDate: date } });
    if (ex) continue;
    await prisma.attendanceRegularizationRequest.create({
      data: {
        tenantId: tid, employeeId: emp.id, attendanceDate: date, reason, status,
        reviewerId:      status !== 'PENDING' ? approverUser?.id : null,
        reviewerComment: status !== 'PENDING' ? comment : null,
      },
    });
    regCount++;
  }
  console.log(`  Created ${regCount} regularization requests`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. LAST 7 DAYS HISTORICAL ATTENDANCE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[6] Creating last-7-days attendance...');

  let histCount = 0;
  for (let day = -7; day <= -1; day++) {
    const date = d(day);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;

    for (let i = 0; i < Math.min(allEmps.length, 60); i++) {
      const emp = allEmps[i];
      const ex = await prisma.attendanceRecord.findFirst({ where: { tenantId: tid, employeeId: emp.id, attendanceDate: date } });
      if (ex) continue;

      const roll = (i + Math.abs(day)) % 10;
      let status = 'PRESENT';
      let workMode = 'OFFICE';
      if (roll === 8) status = 'ABSENT';
      else if (roll === 7) status = 'LEAVE';
      else if (roll < 2) workMode = 'WFH';
      else if (roll === 2) status = 'HALF_DAY';

      const checkIn  = (status === 'PRESENT' || status === 'HALF_DAY') ? new Date(date.getTime() + (8 + i % 2) * 3600000 + (i * 7 % 60) * 60000) : null;
      const checkOut = status === 'PRESENT' ? new Date(date.getTime() + (17 + i % 2) * 3600000) : status === 'HALF_DAY' ? new Date(date.getTime() + 13 * 3600000) : null;
      const mins = checkIn && checkOut ? Math.round((checkOut - checkIn) / 60000) : null;

      await prisma.attendanceRecord.create({
        data: { tenantId: tid, employeeId: emp.id, attendanceDate: date, checkInAt: checkIn, checkOutAt: checkOut, status, workMode, totalMinutes: mins },
      });
      histCount++;
    }
  }
  console.log(`  Created ${histCount} last-7-days attendance records`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. LEAVE BALANCES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[7] Upserting leave balances...');

  const balDefs = [
    { ltId: annualLt,  allocated: 18 },
    { ltId: sickLt,    allocated: 12 },
    { ltId: casualLt,  allocated: 6  },
    { ltId: compOffLt, allocated: 4  },
  ];
  let balCount = 0;
  for (let i = 0; i < allEmps.length; i++) {
    const emp = allEmps[i];
    const usedAmt = i % 6;
    for (const { ltId, allocated } of balDefs) {
      await prisma.leaveBalance.upsert({
        where: { tenantId_employeeId_leaveTypeId: { tenantId: tid, employeeId: emp.id, leaveTypeId: ltId } },
        update: {},
        create: { tenantId: tid, employeeId: emp.id, leaveTypeId: ltId, balance: allocated - usedAmt, used: usedAmt, pending: 0 },
      });
      balCount++;
    }
  }
  console.log(`  Upserted ${balCount} leave balances`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. TENANT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[8] Creating tenant settings...');

  const settingsData = [
    { groupKey: 'workspace', settingKey: 'company-name',                       valueJson: 'Acme Corp' },
    { groupKey: 'workspace', settingKey: 'timezone',                           valueJson: 'Asia/Kolkata' },
    { groupKey: 'workspace', settingKey: 'working-hours-start',                valueJson: '09:00' },
    { groupKey: 'workspace', settingKey: 'working-hours-end',                  valueJson: '18:00' },
    { groupKey: 'workspace', settingKey: 'fiscal-year-start',                  valueJson: 4 },
    { groupKey: 'workspace', settingKey: 'work-week',                          valueJson: 'MON-FRI' },
    { groupKey: 'people',    settingKey: 'max-leave-carry-forward',            valueJson: 10 },
    { groupKey: 'people',    settingKey: 'require-medical-cert-after-days',    valueJson: 2 },
    { groupKey: 'attendance', settingKey: 'grace-minutes',                     valueJson: 15 },
    { groupKey: 'attendance', settingKey: 'geofence-radius-meters',            valueJson: 200 },
  ];
  for (const { groupKey, settingKey, valueJson } of settingsData) {
    await prisma.setting.upsert({
      where: { tenantId_groupKey_settingKey: { tenantId: tid, groupKey, settingKey } },
      update: { valueJson },
      create: { tenantId: tid, groupKey, settingKey, valueJson },
    });
  }
  console.log(`  Created ${settingsData.length} settings`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[9] Creating demo notifications...');

  const expires = new Date(Date.now() + 12 * 3600 * 1000);
  const notifData = [];

  // Pending leave notifications → managers/admins
  for (let i = 0; i < Math.min(pendingLeaves.length, 8); i++) {
    const { emp } = pendingLeaves[i];
    const name = `${emp.firstName} ${emp.lastName}`;
    for (const uid of allAdminIds.slice(0, 4)) {
      notifData.push({ tenantId: tid, userId: uid, type: 'leave_requested', title: 'New Leave Request', message: `${name} has submitted a leave request`, expiresAt: expires });
    }
  }

  // Approved/denied leave notifications → employees
  for (const { emp, start, status } of historical) {
    const uid = empUserMap[emp.id];
    if (!uid) continue;
    if (status === 'APPROVED') {
      notifData.push({ tenantId: tid, userId: uid, type: 'leave_approved', title: 'Leave Request Approved', message: `Your leave from ${start.toISOString().slice(0,10)} has been approved`, expiresAt: expires, readAt: Math.random() > 0.5 ? new Date() : null });
    } else if (status === 'DENIED') {
      notifData.push({ tenantId: tid, userId: uid, type: 'leave_denied', title: 'Leave Request Denied', message: `Your leave from ${start.toISOString().slice(0,10)} was not approved`, expiresAt: expires });
    }
  }

  // Regularization result notifications → employees
  for (const { emp, status, date } of regs.filter(r => r.status !== 'PENDING')) {
    const uid = empUserMap[emp.id];
    if (!uid) continue;
    notifData.push({
      tenantId: tid, userId: uid,
      type: status === 'APPROVED' ? 'regularization_approved' : 'regularization_denied',
      title: status === 'APPROVED' ? 'Regularization Approved' : 'Regularization Denied',
      message: `Your regularization for ${date.toISOString().slice(0,10)} has been ${status === 'APPROVED' ? 'approved' : 'denied'}`,
      expiresAt: expires,
    });
  }

  // Check-in notifications → employees themselves
  for (let i = 0; i < Math.min(presentEmps.length, 12); i++) {
    const uid = empUserMap[presentEmps[i].id];
    if (!uid) continue;
    const h = 8 + (i % 3);
    const m = (i * 7) % 60;
    notifData.push({ tenantId: tid, userId: uid, type: 'attendance_checkin', title: 'Check-In Recorded', message: `Your check-in at ${h}:${String(m).padStart(2,'0')} has been recorded`, expiresAt: expires, readAt: i < 6 ? new Date() : null });
  }

  // Pending regularization notifications → admins/managers
  const pendingRegs = regs.filter(r => r.status === 'PENDING');
  for (let i = 0; i < Math.min(pendingRegs.length, 6); i++) {
    const { emp } = pendingRegs[i];
    for (const uid of allAdminIds.slice(0, 3)) {
      notifData.push({ tenantId: tid, userId: uid, type: 'regularization_requested', title: 'Regularization Request', message: `${emp.firstName} ${emp.lastName} submitted a regularization request`, expiresAt: expires });
    }
  }

  const existingNotifs = await prisma.notification.count({ where: { tenantId: tid } });
  if (existingNotifs < 20) {
    await prisma.notification.createMany({ data: notifData, skipDuplicates: true });
    console.log(`  Created ${notifData.length} notifications`);
  } else {
    console.log(`  Notifications already rich (${existingNotifs}), skipping`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. AUDIT LOG ENTRIES (recent activity feed)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[10] Creating recent audit log entries...');

  const recentLogCount = await prisma.auditLog.count({ where: { tenantId: tid, createdAt: { gte: d(-1) } } });
  if (recentLogCount < 10) {
    const hrUid = hrAdmin?.id || superAdmin?.id;
    const auditItems = [
      { action: 'LEAVE_REQUEST_CREATED',           entityType: 'LeaveRequest',                      actorEmpIdx: 20 },
      { action: 'LEAVE_REQUEST_APPROVED',           entityType: 'LeaveRequest',                      actorUserId: hrUid },
      { action: 'ATTENDANCE_CHECK_IN',             entityType: 'AttendanceRecord',                  actorEmpIdx: 1  },
      { action: 'ATTENDANCE_CHECK_IN',             entityType: 'AttendanceRecord',                  actorEmpIdx: 3  },
      { action: 'ATTENDANCE_CHECK_OUT',            entityType: 'AttendanceRecord',                  actorEmpIdx: 5  },
      { action: 'LEAVE_REQUEST_CREATED',           entityType: 'LeaveRequest',                      actorEmpIdx: 22 },
      { action: 'REGULARIZATION_REQUEST_CREATED',  entityType: 'AttendanceRegularizationRequest',   actorEmpIdx: 44 },
      { action: 'LEAVE_REQUEST_REJECTED',          entityType: 'LeaveRequest',                      actorUserId: hrUid },
      { action: 'ATTENDANCE_CHECK_IN',             entityType: 'AttendanceRecord',                  actorEmpIdx: 7  },
      { action: 'LEAVE_REQUEST_CREATED',           entityType: 'LeaveRequest',                      actorEmpIdx: 24 },
      { action: 'REGULARIZATION_APPROVED',         entityType: 'AttendanceRegularizationRequest',   actorUserId: hrUid },
      { action: 'ATTENDANCE_CHECK_IN',             entityType: 'AttendanceRecord',                  actorEmpIdx: 26 },
    ];

    for (let i = 0; i < auditItems.length; i++) {
      const { action, entityType, actorEmpIdx, actorUserId: auId } = auditItems[i];
      let actorUserId = auId || null;
      if (actorEmpIdx !== undefined) {
        const emp = allEmps[actorEmpIdx];
        const u = users.find(u => u.employeeId === emp.id);
        actorUserId = u?.id || null;
      }
      await prisma.auditLog.create({
        data: { tenantId: tid, actorUserId, action, entityType, entityId: `demo-seed-${i}`, createdAt: new Date(Date.now() - i * 9 * 60000) },
      });
    }
    console.log(`  Created ${auditItems.length} audit log entries`);
  } else {
    console.log(`  Recent audit logs already present (${recentLogCount}), skipping`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. EMAIL TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n[11] Creating email templates...');

  const templates = [
    { type: 'LEAVE_APPROVAL',   subject: 'Your Leave Request Has Been Approved',  body: 'Dear {{employeeName}},\n\nYour leave request from {{startDate}} to {{endDate}} ({{totalDays}} day(s)) has been approved.\n\nHave a great time!\n\nBest regards,\nHR Team — Acme Corp' },
    { type: 'LEAVE_REJECTION',  subject: 'Your Leave Request Has Been Declined',   body: 'Dear {{employeeName}},\n\nUnfortunately your leave request from {{startDate}} to {{endDate}} could not be approved.\n\nReason: {{approverComment}}\n\nBest regards,\nHR Team — Acme Corp' },
    { type: 'ATTENDANCE_ALERT', subject: 'Attendance Reminder',                    body: 'Dear {{employeeName}},\n\nYour attendance for {{date}} has not been recorded. Please submit a regularization request if needed.\n\nBest regards,\nHR Team — Acme Corp' },
  ];

  for (const t of templates) {
    const ex = await prisma.emailTemplate.findFirst({ where: { tenantId: tid, type: t.type } });
    if (!ex) await prisma.emailTemplate.create({ data: { tenantId: tid, ...t } });
  }
  console.log(`  Created/verified ${templates.length} email templates`);

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const [todayPresent, todayLeave, pendingCnt, pendingRegCnt, notifCnt, totalAtt, totalLR] = await Promise.all([
    prisma.attendanceRecord.count({ where: { tenantId: tid, attendanceDate: TODAY, status: 'PRESENT' } }),
    prisma.leaveRequest.count({ where: { tenantId: tid, status: 'APPROVED', startDate: { lte: TODAY }, endDate: { gte: TODAY } } }),
    prisma.leaveRequest.count({ where: { tenantId: tid, status: 'PENDING' } }),
    prisma.attendanceRegularizationRequest.count({ where: { tenantId: tid, status: 'PENDING' } }),
    prisma.notification.count({ where: { tenantId: tid } }),
    prisma.attendanceRecord.count({ where: { tenantId: tid } }),
    prisma.leaveRequest.count({ where: { tenantId: tid } }),
  ]);

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║         DEMO SEED COMPLETE               ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Active Today (PRESENT):    ${String(todayPresent).padStart(4)}           ║`);
  console.log(`║  On Leave Today (approved): ${String(todayLeave).padStart(4)}           ║`);
  console.log(`║  Open Leave Requests:       ${String(pendingCnt).padStart(4)}           ║`);
  console.log(`║  Open Regularizations:      ${String(pendingRegCnt).padStart(4)}           ║`);
  console.log(`║  Total Attendance Records:  ${String(totalAtt).padStart(4)}           ║`);
  console.log(`║  Total Leave Requests:      ${String(totalLR).padStart(4)}           ║`);
  console.log(`║  Total Notifications:       ${String(notifCnt).padStart(4)}           ║`);
  console.log('╚══════════════════════════════════════════╝');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
