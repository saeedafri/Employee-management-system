/**
 * seedUIData.js — fills every API-backed table with realistic test data
 * Safe to re-run (upsert / skip-if-exists guards throughout).
 * Run: node prisma/seedUIData.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  // ── Resolve tenant and core users ────────────────────────────────────────
  const tenant = await prisma.tenant.findFirstOrThrow({ where: { tenantKey: 'acme-corp-001' } });
  const tenantId = tenant.id;

  const allUsers = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, email: true, memberType: true, employeeId: true },
  });

  const byEmail = Object.fromEntries(allUsers.map(u => [u.email, u]));
  const superAdmin = byEmail['superadmin@acme.test'];
  const hr = byEmail['hr@acme.test'];
  const aman = byEmail['aman@acme.test'];
  const priya = byEmail['priya@acme.test'];
  const riya = byEmail['riya@acme.test'];
  const dev1 = byEmail['dev1@acme.test'];
  const dev2 = byEmail['dev2@acme.test'];
  const fin1 = byEmail['fin1@acme.test'];
  const onLeave = byEmail['onleave@acme.test'];

  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, userId: true },
  });

  // Map userId → employeeId for named users
  const userToEmp = Object.fromEntries(employees.filter(e => e.userId).map(e => [e.userId, e.id]));
  const amanEmpId = userToEmp[aman.id];
  const priyaEmpId = userToEmp[priya.id];
  const riyaEmpId = userToEmp[riya.id];
  const dev1EmpId = userToEmp[dev1.id];
  const dev2EmpId = userToEmp[dev2.id];
  const fin1EmpId = userToEmp[fin1.id];
  const onLeaveEmpId = userToEmp[onLeave.id];
  const hrEmpId = userToEmp[hr.id];

  // Extra employees (no user accounts)
  const extraEmps = employees.filter(e => !e.userId).slice(0, 10);

  console.log('✓ Resolved tenant + users + employees');

  // ── 1. Settings ───────────────────────────────────────────────────────────
  const settingsData = [
    // workspace group
    { groupKey: 'workspace', settingKey: 'company-name', valueJson: 'Acme Corp' },
    { groupKey: 'workspace', settingKey: 'timezone', valueJson: 'Asia/Kolkata' },
    { groupKey: 'workspace', settingKey: 'date-format', valueJson: 'DD/MM/YYYY' },
    { groupKey: 'workspace', settingKey: 'currency', valueJson: 'INR' },
    { groupKey: 'workspace', settingKey: 'fiscal-year-start', valueJson: '04-01' },
    // people group
    { groupKey: 'people', settingKey: 'probation-period-days', valueJson: 90 },
    { groupKey: 'people', settingKey: 'notice-period-days', valueJson: 60 },
    { groupKey: 'people', settingKey: 'max-team-size', valueJson: 25 },
    // security group
    { groupKey: 'security', settingKey: 'password-expiry-days', valueJson: 90 },
    { groupKey: 'security', settingKey: 'mfa-enabled', valueJson: false },
    { groupKey: 'security', settingKey: 'session-timeout-minutes', valueJson: 480 },
    { groupKey: 'security', settingKey: 'max-login-attempts', valueJson: 5 },
    // leave group
    { groupKey: 'leave', settingKey: 'carry-forward-max-days', valueJson: 10 },
    { groupKey: 'leave', settingKey: 'leave-encashment-enabled', valueJson: true },
    { groupKey: 'leave', settingKey: 'advance-application-days', valueJson: 3 },
    // attendance group
    { groupKey: 'attendance', settingKey: 'check-in-window-minutes', valueJson: 30 },
    { groupKey: 'attendance', settingKey: 'wfh-allowed', valueJson: true },
    { groupKey: 'attendance', settingKey: 'overtime-tracking', valueJson: false },
    // notifications group
    { groupKey: 'notifications', settingKey: 'leave-approval-email', valueJson: true },
    { groupKey: 'notifications', settingKey: 'attendance-alert-email', valueJson: true },
    { groupKey: 'notifications', settingKey: 'weekly-summary-email', valueJson: false },
  ];

  for (const s of settingsData) {
    await prisma.setting.upsert({
      where: { tenantId_groupKey_settingKey: { tenantId, groupKey: s.groupKey, settingKey: s.settingKey } },
      create: { tenantId, ...s, updatedById: hr.id },
      update: {},
    });
  }
  console.log(`✓ Settings: ${settingsData.length} records`);

  // ── 2. Email Templates ────────────────────────────────────────────────────
  const emailTemplates = [
    {
      type: 'LEAVE_APPROVAL',
      subject: 'Your leave request has been approved',
      body: 'Dear {{employeeName}},\n\nYour leave request from {{startDate}} to {{endDate}} ({{totalDays}} days) has been approved by {{approverName}}.\n\nRegards,\nHR Team',
    },
    {
      type: 'LEAVE_REJECTION',
      subject: 'Your leave request has been rejected',
      body: 'Dear {{employeeName}},\n\nWe regret to inform you that your leave request from {{startDate}} to {{endDate}} has been rejected.\n\nReason: {{reason}}\n\nRegards,\nHR Team',
    },
    {
      type: 'LEAVE_REQUEST',
      subject: 'New leave request from {{employeeName}}',
      body: 'Dear Manager,\n\n{{employeeName}} has submitted a leave request for {{leaveType}} from {{startDate}} to {{endDate}} ({{totalDays}} days).\n\nReason: {{reason}}\n\nPlease review and take action.\n\nRegards,\nHR Team',
    },
    {
      type: 'ATTENDANCE_ALERT',
      subject: 'Attendance alert for {{employeeName}}',
      body: 'Dear {{managerName}},\n\n{{employeeName}} has not checked in today ({{date}}).\n\nPlease follow up.\n\nRegards,\nAttendance System',
    },
    {
      type: 'PASSWORD_RESET',
      subject: 'Reset your Acme Corp EMS password',
      body: 'Dear {{name}},\n\nClick the link below to reset your password. This link expires in 15 minutes.\n\n{{resetLink}}\n\nIf you did not request this, please ignore.\n\nRegards,\nAcme Corp EMS',
    },
    {
      type: 'WELCOME',
      subject: 'Welcome to Acme Corp EMS!',
      body: 'Dear {{name}},\n\nWelcome aboard! Your account has been created.\n\nEmail: {{email}}\nTemporary Password: {{password}}\n\nPlease change your password on first login.\n\nRegards,\nHR Team',
    },
    {
      type: 'REGULARIZATION_APPROVED',
      subject: 'Your attendance regularization request has been approved',
      body: 'Dear {{employeeName}},\n\nYour attendance regularization request for {{date}} has been approved.\n\nRegards,\nHR Team',
    },
  ];

  for (const t of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { tenantId_type: { tenantId, type: t.type } },
      create: { tenantId, ...t },
      update: {},
    });
  }
  console.log(`✓ Email templates: ${emailTemplates.length} records`);

  // ── 3. Scheduled Reports ──────────────────────────────────────────────────
  const existingScheduled = await prisma.scheduledReport.count({ where: { tenantId } });
  if (existingScheduled === 0) {
    await prisma.scheduledReport.createMany({
      data: [
        {
          tenantId,
          createdById: hr.id,
          reportType: 'attendance',
          frequency: 'WEEKLY',
          emailRecipients: ['hr@acme.test', 'superadmin@acme.test'],
          nextRunDate: daysFromNow(3),
          isActive: true,
          lastRunAt: daysAgo(4),
        },
        {
          tenantId,
          createdById: hr.id,
          reportType: 'leaves',
          frequency: 'MONTHLY',
          emailRecipients: ['hr@acme.test'],
          nextRunDate: daysFromNow(12),
          isActive: true,
          lastRunAt: daysAgo(18),
        },
        {
          tenantId,
          createdById: superAdmin.id,
          reportType: 'payroll',
          frequency: 'MONTHLY',
          emailRecipients: ['superadmin@acme.test', 'fin1@acme.test'],
          nextRunDate: daysFromNow(8),
          isActive: true,
          lastRunAt: daysAgo(22),
        },
        {
          tenantId,
          createdById: hr.id,
          reportType: 'attendance',
          frequency: 'WEEKLY',
          emailRecipients: ['aman@acme.test'],
          nextRunDate: daysFromNow(5),
          isActive: false,
          lastRunAt: daysAgo(11),
        },
      ],
    });
    console.log('✓ Scheduled reports: 4 records');
  } else {
    console.log(`✓ Scheduled reports: already have ${existingScheduled}`);
  }

  // ── 4. Report Exports (export history) ───────────────────────────────────
  const existingReportExports = await prisma.reportExport.count({ where: { tenantId } });
  if (existingReportExports === 0) {
    const reDate = (daysBack) => { const d = daysAgo(daysBack); return d; };
    await prisma.reportExport.createMany({
      data: [
        { tenantId, createdById: hr.id, reportType: 'attendance', format: 'csv', status: 'SUCCESS', fileUrl: 'https://storage.example.com/reports/attendance-may-2026.csv', filePath: '/tmp/reports/attendance-may-2026.csv', completedAt: reDate(1) },
        { tenantId, createdById: hr.id, reportType: 'leaves', format: 'json', status: 'SUCCESS', fileUrl: 'https://storage.example.com/reports/leaves-may-2026.json', filePath: '/tmp/reports/leaves-may-2026.json', completedAt: reDate(3) },
        { tenantId, createdById: superAdmin.id, reportType: 'payroll', format: 'csv', status: 'SUCCESS', fileUrl: 'https://storage.example.com/reports/payroll-apr-2026.csv', filePath: '/tmp/reports/payroll-apr-2026.csv', completedAt: reDate(7) },
        { tenantId, createdById: hr.id, reportType: 'attendance', format: 'csv', status: 'FAILED', errorMessage: 'Database timeout while aggregating records', completedAt: reDate(5) },
        { tenantId, createdById: hr.id, reportType: 'leaves', format: 'csv', status: 'PENDING' },
        { tenantId, createdById: superAdmin.id, reportType: 'attendance', format: 'json', status: 'SUCCESS', fileUrl: 'https://storage.example.com/reports/attendance-apr-2026.json', completedAt: reDate(15) },
        { tenantId, createdById: hr.id, reportType: 'payroll', format: 'csv', status: 'SUCCESS', fileUrl: 'https://storage.example.com/reports/payroll-mar-2026.csv', completedAt: reDate(30) },
      ],
    });
    console.log('✓ Report exports: 7 records');
  } else {
    console.log(`✓ Report exports: already have ${existingReportExports}`);
  }

  // ── 5. Export Jobs ────────────────────────────────────────────────────────
  const existingExportJobs = await prisma.exportJob.count({ where: { tenantId } });
  if (existingExportJobs === 0) {
    const { v4: uuidv4 } = await import('uuid');
    await prisma.exportJob.createMany({
      data: [
        {
          tenantId, jobId: uuidv4(), createdById: hr.id, exportType: 'EMPLOYEES', format: 'excel', status: 'SUCCESS',
          fileUrl: 'https://storage.example.com/exports/employees-20260527.xlsx',
          filters: { department: null, status: 'ACTIVE' }, completedAt: daysAgo(1),
        },
        {
          tenantId, jobId: uuidv4(), createdById: hr.id, exportType: 'ATTENDANCE', format: 'csv', status: 'SUCCESS',
          fileUrl: 'https://storage.example.com/exports/attendance-may-2026.csv',
          filters: { from_date: '2026-05-01', to_date: '2026-05-31' }, completedAt: daysAgo(2),
        },
        {
          tenantId, jobId: uuidv4(), createdById: hr.id, exportType: 'LEAVE', format: 'excel', status: 'SUCCESS',
          fileUrl: 'https://storage.example.com/exports/leave-q1-2026.xlsx',
          filters: { from_date: '2026-01-01', to_date: '2026-03-31' }, completedAt: daysAgo(5),
        },
        {
          tenantId, jobId: uuidv4(), createdById: superAdmin.id, exportType: 'EMPLOYEES', format: 'json', status: 'FAILED',
          errorMessage: 'Export timeout — too many records', completedAt: daysAgo(3),
        },
        {
          tenantId, jobId: uuidv4(), createdById: hr.id, exportType: 'ATTENDANCE', format: 'csv', status: 'QUEUED',
          filters: { from_date: '2026-05-27', to_date: '2026-05-27' },
        },
        {
          tenantId, jobId: uuidv4(), createdById: hr.id, exportType: 'LEAVE', format: 'csv', status: 'PROCESSING',
          filters: { from_date: '2026-04-01', to_date: '2026-04-30' },
        },
      ],
    });
    console.log('✓ Export jobs: 6 records');
  } else {
    console.log(`✓ Export jobs: already have ${existingExportJobs}`);
  }

  // ── 6. Attendance Regularization Requests ────────────────────────────────
  const existingReg = await prisma.attendanceRegularizationRequest.count({ where: { tenantId } });
  if (existingReg === 0) {
    const regData = [
      // PENDING
      { employeeId: priyaEmpId, attendanceDate: daysAgo(2), type: 'LATE', reason: 'Traffic delay on NH-48, was stuck for 45 minutes', status: 'PENDING' },
      { employeeId: dev1EmpId, attendanceDate: daysAgo(3), type: 'MISSED_CHECKOUT', reason: 'Had to leave for a family emergency and forgot to check out', status: 'PENDING' },
      { employeeId: dev2EmpId, attendanceDate: daysAgo(1), type: 'LATE', reason: 'Metro breakdown near Cyber City station', status: 'PENDING' },
      { employeeId: fin1EmpId, attendanceDate: daysAgo(4), type: 'EARLY_CHECKOUT', reason: 'Doctor appointment that could not be rescheduled', status: 'PENDING' },
      // APPROVED
      { employeeId: priyaEmpId, attendanceDate: daysAgo(10), type: 'MISSED_CHECKOUT', reason: 'System crash at end of day, could not check out', status: 'APPROVED', reviewerId: aman.id, reviewerComment: 'Verified with IT team — system was down. Approved.' },
      { employeeId: amanEmpId, attendanceDate: daysAgo(14), type: 'LATE', reason: 'Client call overran from previous day timezone', status: 'APPROVED', reviewerId: hr.id, reviewerComment: 'Client escalation verified. Approved.' },
      { employeeId: dev1EmpId, attendanceDate: daysAgo(8), type: 'EARLY_CHECKOUT', reason: 'Mandatory blood donation camp', status: 'APPROVED', reviewerId: aman.id, reviewerComment: 'Company initiative. Approved.' },
      { employeeId: onLeaveEmpId, attendanceDate: daysAgo(20), type: 'LATE', reason: 'Visa appointment in the morning', status: 'APPROVED', reviewerId: hr.id, reviewerComment: 'Supporting document shared. Approved.' },
      // DENIED
      { employeeId: dev2EmpId, attendanceDate: daysAgo(12), type: 'LATE', reason: 'Slept through alarm', status: 'DENIED', reviewerId: aman.id, reviewerComment: 'Not a valid reason for regularization. Denied.' },
      { employeeId: fin1EmpId, attendanceDate: daysAgo(16), type: 'MISSED_CHECKOUT', reason: 'Left early to watch cricket match', status: 'DENIED', reviewerId: hr.id, reviewerComment: 'Personal entertainment not a valid reason. Denied.' },
      // WITHDRAWN
      { employeeId: priyaEmpId, attendanceDate: daysAgo(25), type: 'OTHER', reason: 'Internet outage at home while WFH — withdrawn as resolved', status: 'WITHDRAWN' },
      // Extra PENDING for managers to action
      ...extraEmps.slice(0, 5).map((emp, i) => ({
        employeeId: emp.id,
        attendanceDate: daysAgo(i + 2),
        type: ['LATE', 'MISSED_CHECKOUT', 'EARLY_CHECKOUT', 'OTHER', 'LATE'][i],
        reason: [
          'Public transport strike disrupted commute',
          'Power outage caused system shutdown without checkout',
          'Medical emergency — left early with manager verbal approval',
          'Network issues prevented attendance system access',
          'Road accident blocked the highway for 2 hours',
        ][i],
        status: 'PENDING',
      })),
    ];

    for (const r of regData) {
      await prisma.attendanceRegularizationRequest.create({ data: { tenantId, ...r } });
    }
    console.log(`✓ Regularization requests: ${regData.length} records`);
  } else {
    console.log(`✓ Regularization requests: already have ${existingReg}`);
  }

  // ── 7. Employee Documents ─────────────────────────────────────────────────
  const existingDocs = await prisma.employeeDocument.count({ where: { tenantId } });
  if (existingDocs === 0) {
    const namedEmps = [
      { empId: priyaEmpId, uploadedById: hr.id },
      { empId: amanEmpId, uploadedById: hr.id },
      { empId: dev1EmpId, uploadedById: hr.id },
      { empId: dev2EmpId, uploadedById: hr.id },
      { empId: fin1EmpId, uploadedById: hr.id },
      { empId: hrEmpId, uploadedById: hr.id },
      { empId: onLeaveEmpId, uploadedById: hr.id },
    ];
    const docTypes = [
      { documentType: 'OFFER_LETTER', fileName: 'offer_letter.pdf', mimeType: 'application/pdf', sizeBytes: 245_760 },
      { documentType: 'ID_PROOF', fileName: 'aadhaar_card.pdf', mimeType: 'application/pdf', sizeBytes: 512_000 },
      { documentType: 'ADDRESS_PROOF', fileName: 'utility_bill.pdf', mimeType: 'application/pdf', sizeBytes: 180_000 },
      { documentType: 'EDUCATION_CERTIFICATE', fileName: 'degree_certificate.pdf', mimeType: 'application/pdf', sizeBytes: 320_000 },
      { documentType: 'EXPERIENCE_LETTER', fileName: 'experience_letter.pdf', mimeType: 'application/pdf', sizeBytes: 150_000 },
    ];

    const verStatuses = ['VERIFIED', 'PENDING', 'PENDING', 'VERIFIED', 'REJECTED'];

    for (const { empId, uploadedById } of namedEmps) {
      // Each employee gets 2-3 documents
      for (let i = 0; i < 3; i++) {
        const dt = docTypes[i % docTypes.length];
        await prisma.employeeDocument.create({
          data: {
            tenantId,
            employeeId: empId,
            ...dt,
            fileUrl: `https://res.cloudinary.com/dmljxhmio/raw/upload/v1/ems/documents/${empId}_${dt.documentType.toLowerCase()}.pdf`,
            storageKey: `ems/documents/${empId}_${dt.documentType.toLowerCase()}`,
            verificationStatus: verStatuses[i % verStatuses.length],
            uploadedById,
            verifiedById: verStatuses[i % verStatuses.length] === 'VERIFIED' ? hr.id : null,
          },
        });
      }
    }

    // extra employees — 1 doc each
    for (const emp of extraEmps.slice(0, 8)) {
      await prisma.employeeDocument.create({
        data: {
          tenantId,
          employeeId: emp.id,
          documentType: 'ID_PROOF',
          fileName: 'id_proof.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 400_000,
          fileUrl: `https://res.cloudinary.com/dmljxhmio/raw/upload/v1/ems/documents/${emp.id}_id_proof.pdf`,
          storageKey: `ems/documents/${emp.id}_id_proof`,
          verificationStatus: 'PENDING',
          uploadedById: hr.id,
        },
      });
    }
    const docCount = await prisma.employeeDocument.count({ where: { tenantId } });
    console.log(`✓ Employee documents: ${docCount} records`);
  } else {
    console.log(`✓ Employee documents: already have ${existingDocs}`);
  }

  // ── 8. Resignations ───────────────────────────────────────────────────────
  const existingRes = await prisma.resignation.count({ where: { tenantId } });
  if (existingRes === 0) {
    await prisma.resignation.createMany({
      data: [
        // PENDING
        {
          tenantId, employeeId: dev2EmpId,
          reason: 'Received a better opportunity at another company with a 40% salary hike',
          preferredLastWorkingDate: daysFromNow(30),
          status: 'PENDING', submittedAt: daysAgo(2),
        },
        {
          tenantId, employeeId: fin1EmpId,
          reason: 'Relocating to another city due to spouse transfer',
          preferredLastWorkingDate: daysFromNow(45),
          status: 'PENDING', submittedAt: daysAgo(1),
        },
        // APPROVED
        {
          tenantId, employeeId: extraEmps[0]?.id,
          reason: 'Pursuing higher education — MBA admission confirmed',
          preferredLastWorkingDate: daysAgo(5),
          status: 'APPROVED', reviewerId: hr.id,
          reviewerComment: 'Accepted. Notice period served. Best wishes.',
          submittedAt: daysAgo(40), decidedAt: daysAgo(35),
        },
        // REJECTED
        {
          tenantId, employeeId: extraEmps[1]?.id,
          reason: 'Personal reasons',
          preferredLastWorkingDate: daysAgo(10),
          status: 'REJECTED', reviewerId: hr.id,
          reviewerComment: 'Insufficient notice period. Please resubmit with 60 days notice.',
          submittedAt: daysAgo(20), decidedAt: daysAgo(15),
        },
        // WITHDRAWN
        {
          tenantId, employeeId: extraEmps[2]?.id,
          reason: 'Salary expectations not met',
          preferredLastWorkingDate: daysAgo(20),
          status: 'WITHDRAWN', submittedAt: daysAgo(35),
        },
      ].filter(r => r.employeeId), // skip if extraEmps doesn't have enough
    });
    const rCount = await prisma.resignation.count({ where: { tenantId } });
    console.log(`✓ Resignations: ${rCount} records`);
  } else {
    console.log(`✓ Resignations: already have ${existingRes}`);
  }

  // ── 9. Notifications ──────────────────────────────────────────────────────
  const existingNotifs = await prisma.notification.count({ where: { tenantId } });
  if (existingNotifs < 30) {
    const futureExpiry = daysFromNow(30);
    const notifData = [
      // priya
      { userId: priya.id, type: 'leave_approved', title: 'Leave Approved', message: 'Your casual leave request (May 20–21) has been approved by Aman Kumar.', readAt: daysAgo(1), expiresAt: futureExpiry },
      { userId: priya.id, type: 'leave_rejected', title: 'Leave Request Rejected', message: 'Your sick leave request (May 15) was rejected. Reason: Team critical delivery week.', readAt: null, expiresAt: futureExpiry },
      { userId: priya.id, type: 'attendance_alert', title: 'Late Check-in Detected', message: 'You checked in 47 minutes late today. Please submit a regularization request if needed.', readAt: null, expiresAt: futureExpiry },
      { userId: priya.id, type: 'regularization_approved', title: 'Regularization Approved', message: 'Your attendance regularization for May 17 has been approved.', readAt: daysAgo(2), expiresAt: futureExpiry },
      // aman
      { userId: aman.id, type: 'leave_requested', title: 'New Leave Request', message: 'Priya Sharma has requested casual leave from May 28–29. Please review.', readAt: null, expiresAt: futureExpiry },
      { userId: aman.id, type: 'leave_requested', title: 'New Leave Request', message: 'Dev User 1 has requested sick leave for May 30. Please review.', readAt: null, expiresAt: futureExpiry },
      { userId: aman.id, type: 'regularization_requested', title: 'Regularization Request', message: 'Dev User 2 submitted an attendance regularization request for May 26.', readAt: null, expiresAt: futureExpiry },
      { userId: aman.id, type: 'team_absent', title: 'Team Absence Alert', message: '3 team members are absent today. Check the team attendance dashboard.', readAt: daysAgo(1), expiresAt: futureExpiry },
      // hr
      { userId: hr.id, type: 'leave_requested', title: 'Leave Request Pending', message: 'You have 5 pending leave requests awaiting approval.', readAt: null, expiresAt: futureExpiry },
      { userId: hr.id, type: 'resignation_submitted', title: 'Resignation Submitted', message: 'Dev User 2 has submitted a resignation with last working date June 26, 2026.', readAt: null, expiresAt: futureExpiry },
      { userId: hr.id, type: 'resignation_submitted', title: 'Resignation Submitted', message: 'Fin User 1 has submitted a resignation with last working date July 11, 2026.', readAt: null, expiresAt: futureExpiry },
      { userId: hr.id, type: 'document_uploaded', title: 'Documents Pending Verification', message: '8 employee documents are awaiting verification in the documents portal.', readAt: daysAgo(1), expiresAt: futureExpiry },
      { userId: hr.id, type: 'attendance_report', title: 'Weekly Attendance Report Ready', message: 'Attendance report for week of May 20–24 has been generated and emailed.', readAt: daysAgo(3), expiresAt: futureExpiry },
      // riya
      { userId: riya.id, type: 'leave_requested', title: 'New Leave Request', message: 'A team member has submitted a new leave request. Please review.', readAt: null, expiresAt: futureExpiry },
      { userId: riya.id, type: 'attendance_alert', title: 'Team Attendance Low', message: 'Team attendance today is 72%. 2 members are absent without prior leave.', readAt: null, expiresAt: futureExpiry },
      // dev1
      { userId: dev1.id, type: 'leave_approved', title: 'Leave Approved', message: 'Your annual leave request (June 2–4) has been approved.', readAt: daysAgo(1), expiresAt: futureExpiry },
      { userId: dev1.id, type: 'regularization_approved', title: 'Regularization Approved', message: 'Your attendance regularization for May 19 has been approved by your manager.', readAt: null, expiresAt: futureExpiry },
      // dev2
      { userId: dev2.id, type: 'leave_rejected', title: 'Leave Rejected', message: 'Your leave request for May 22 was not approved. Please discuss with your manager.', readAt: null, expiresAt: futureExpiry },
      { userId: dev2.id, type: 'regularization_denied', title: 'Regularization Denied', message: 'Your attendance regularization for May 15 was denied. Reason: Insufficient justification.', readAt: null, expiresAt: futureExpiry },
      // fin1
      { userId: fin1.id, type: 'leave_balance_low', title: 'Leave Balance Low', message: 'Your annual leave balance is down to 2 days. Plan your leaves accordingly.', readAt: null, expiresAt: futureExpiry },
      { userId: fin1.id, type: 'leave_approved', title: 'Leave Approved', message: 'Your sick leave for May 23 has been approved.', readAt: daysAgo(2), expiresAt: futureExpiry },
      // onLeave
      { userId: onLeave.id, type: 'leave_approved', title: 'Leave Approved', message: 'Your annual leave (May 19–30) has been approved. Enjoy your time off!', readAt: daysAgo(8), expiresAt: futureExpiry },
      // superAdmin
      { userId: superAdmin.id, type: 'system_report', title: 'Monthly Payroll Report Ready', message: 'The May 2026 payroll report has been generated. Download from Reports > Export History.', readAt: null, expiresAt: futureExpiry },
      { userId: superAdmin.id, type: 'security_alert', title: 'Multiple Failed Login Attempts', message: '5 failed login attempts detected for account: unknown@acme.test from IP 103.21.58.xx', readAt: null, expiresAt: futureExpiry },
      { userId: superAdmin.id, type: 'export_complete', title: 'Employee Export Ready', message: 'Your employee data export (Excel) is ready for download. Available for 24 hours.', readAt: daysAgo(1), expiresAt: futureExpiry },
    ];

    // Delete old sparse ones and recreate
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.notification.createMany({ data: notifData.map(n => ({ tenantId, ...n })) });
    console.log(`✓ Notifications: ${notifData.length} records`);
  } else {
    console.log(`✓ Notifications: already have ${existingNotifs}`);
  }

  // ── 10. Log Entries ───────────────────────────────────────────────────────
  const existingLogs = await prisma.logEntry.count({ where: { tenantId } });
  if (existingLogs < 50) {
    const logRows = [
      // AUTH module
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'auth', message: 'User hr@acme.test logged in successfully', actorUserId: hr.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'auth', message: 'User aman@acme.test logged in successfully', actorUserId: aman.id },
      { level: 'WARN', levelLabel: 'Warning', levelColor: 'yellow', module: 'auth', message: 'Failed login attempt for email unknown@acme.test — invalid password (attempt 3/5)', actorUserId: null },
      { level: 'WARN', levelLabel: 'Warning', levelColor: 'yellow', module: 'auth', message: 'Failed login attempt for email superadmin@acme.test — invalid password (attempt 1/5)', actorUserId: null },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'auth', message: 'Password reset initiated for user priya@acme.test', actorUserId: priya.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'auth', message: 'Refresh token rotated for user aman@acme.test', actorUserId: aman.id },
      { level: 'ERROR', levelLabel: 'Error', levelColor: 'red', module: 'auth', message: 'JWT verification failed — token expired (userId: unknown)', actorUserId: null, metadataJson: { reason: 'TokenExpiredError', path: '/api/v1/employees' } },
      // LEAVE module
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'leave', message: 'Leave request created: ANNUAL_LEAVE for priya@acme.test (May 28–29)', actorUserId: priya.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'leave', message: 'Leave request APPROVED by aman@acme.test (ID: lr-001)', actorUserId: aman.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'leave', message: 'Bulk approve: 4 leave requests approved by hr@acme.test', actorUserId: hr.id },
      { level: 'WARN', levelLabel: 'Warning', levelColor: 'yellow', module: 'leave', message: 'Leave balance insufficient for employee dev2@acme.test — available: 0, requested: 3', actorUserId: dev2.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'leave', message: 'Leave request withdrawn by dev1@acme.test', actorUserId: dev1.id },
      // ATTENDANCE module
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'attendance', message: 'Check-in recorded: priya@acme.test at 09:47 AM (late by 47 min)', actorUserId: priya.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'attendance', message: 'Check-out recorded: aman@acme.test at 06:32 PM', actorUserId: aman.id },
      { level: 'WARN', levelLabel: 'Warning', levelColor: 'yellow', module: 'attendance', message: 'Duplicate check-in attempt blocked for dev1@acme.test — already checked in at 09:12 AM', actorUserId: dev1.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'attendance', message: 'Regularization request approved for priya@acme.test (May 17)', actorUserId: aman.id },
      { level: 'ERROR', levelLabel: 'Error', levelColor: 'red', module: 'attendance', message: 'Check-in failed — invalid location coordinates: lat=999, lon=999', actorUserId: null, metadataJson: { ip: '203.0.113.42', userAgent: 'Mozilla/5.0' } },
      // EMPLOYEES module
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'employees', message: 'Employee profile updated: Priya Sharma — phone number changed', actorUserId: hr.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'employees', message: 'New employee created: Sneha Joshi (Dept: Engineering)', actorUserId: hr.id },
      { level: 'WARN', levelLabel: 'Warning', levelColor: 'yellow', module: 'employees', message: 'Soft delete attempted on employee with active leave request — leave auto-cancelled', actorUserId: hr.id },
      // EXPORT module
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'export', message: 'Export job queued: EMPLOYEES/excel (jobId: exp-001) by hr@acme.test', actorUserId: hr.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'export', message: 'Export completed: ATTENDANCE/csv — 512 records, 142 KB', actorUserId: null },
      { level: 'ERROR', levelLabel: 'Error', levelColor: 'red', module: 'export', message: 'Export job failed: EMPLOYEES/json — database timeout after 30s', actorUserId: null, metadataJson: { jobId: 'exp-fail-001', duration: 30000 } },
      // REPORTS module
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'reports', message: 'Scheduled report generated: attendance/WEEKLY — emailed to hr@acme.test, superadmin@acme.test', actorUserId: null },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'reports', message: 'Report exported: payroll/csv by superadmin@acme.test', actorUserId: superAdmin.id },
      // SETTINGS module
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'settings', message: 'Tenant settings updated: leave.carry-forward-max-days changed to 10 by hr@acme.test', actorUserId: hr.id },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'settings', message: 'Email template updated: LEAVE_APPROVAL by hr@acme.test', actorUserId: hr.id },
      // SYSTEM
      { level: 'ERROR', levelLabel: 'Error', levelColor: 'red', module: 'system', message: 'Unhandled promise rejection in leave.service.js: Cannot read properties of null', actorUserId: null, metadataJson: { stack: 'Error at approveLeaveRequest', resolved: true } },
      { level: 'WARN', levelLabel: 'Warning', levelColor: 'yellow', module: 'system', message: 'Database connection pool at 80% capacity — consider scaling', actorUserId: null },
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'system', message: 'Server started successfully on port 3000 in production mode', actorUserId: null },
      { level: 'ERROR', levelLabel: 'Error', levelColor: 'red', module: 'system', message: 'Cloudinary upload failed — Invalid API credentials (CLOUDINARY_API_KEY mismatch)', actorUserId: null, metadataJson: { endpoint: '/employees/:id/documents', statusCode: 503 } },
      // DEPARTMENTS
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'departments', message: 'Department created: Data Science (parent: Engineering)', actorUserId: hr.id },
      // HOLIDAYS
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'holidays', message: '3 new public holidays added for year 2026 by hr@acme.test', actorUserId: hr.id },
      // ANALYTICS
      { level: 'WARN', levelLabel: 'Warning', levelColor: 'yellow', module: 'analytics', message: 'Analytics summary query took 2340ms — consider adding indexes on attendanceRecord.attendanceDate', actorUserId: null },
      // SEARCH
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'search', message: 'Global search performed: query="priya" types=employee by aman@acme.test — 3 results', actorUserId: aman.id },
      // NOTIFICATIONS
      { level: 'INFO', levelLabel: 'Information', levelColor: 'blue', module: 'notifications', message: 'Bulk notifications dispatched: 25 leave_approved notifications sent', actorUserId: null },
    ];

    await prisma.logEntry.deleteMany({ where: { tenantId } });
    await prisma.logEntry.createMany({ data: logRows.map(l => ({ tenantId, ...l })) });
    console.log(`✓ Log entries: ${logRows.length} records`);
  } else {
    console.log(`✓ Log entries: already have ${existingLogs}`);
  }

  // ── 11. Audit Logs (bulk) ─────────────────────────────────────────────────
  const existingAudit = await prisma.auditLog.count({ where: { tenantId } });
  if (existingAudit < 50) {
    const auditRows = [
      { actorUserId: hr.id, action: 'EMPLOYEE_CREATED', entityType: 'Employee', entityId: extraEmps[0]?.id, newValuesJson: { firstName: 'Sneha', lastName: 'Joshi', department: 'Engineering' } },
      { actorUserId: hr.id, action: 'EMPLOYEE_UPDATED', entityType: 'Employee', entityId: priyaEmpId, oldValuesJson: { phone: '+91-9876543210' }, newValuesJson: { phone: '+91-9876543211' } },
      { actorUserId: hr.id, action: 'EMPLOYEE_DELETED', entityType: 'Employee', entityId: extraEmps[3]?.id, oldValuesJson: { status: 'ACTIVE' }, newValuesJson: { status: 'INACTIVE', deletedAt: new Date().toISOString() } },
      { actorUserId: hr.id, action: 'LEAVE_TYPE_CREATED', entityType: 'LeaveType', entityId: 'lt-paternity', newValuesJson: { name: 'Paternity Leave', code: 'PATERNITY', annualAllowance: 5 } },
      { actorUserId: aman.id, action: 'LEAVE_APPROVED', entityType: 'LeaveRequest', entityId: 'lr-001', oldValuesJson: { status: 'PENDING' }, newValuesJson: { status: 'APPROVED', approverId: aman.id } },
      { actorUserId: aman.id, action: 'LEAVE_REJECTED', entityType: 'LeaveRequest', entityId: 'lr-002', oldValuesJson: { status: 'PENDING' }, newValuesJson: { status: 'DENIED', comment: 'Critical delivery week' } },
      { actorUserId: priya.id, action: 'LEAVE_WITHDRAWN', entityType: 'LeaveRequest', entityId: 'lr-003', oldValuesJson: { status: 'PENDING' }, newValuesJson: { status: 'WITHDRAWN' } },
      { actorUserId: hr.id, action: 'BULK_LEAVE_APPROVED', entityType: 'LeaveRequest', entityId: 'bulk-001', newValuesJson: { count: 4, approvedIds: ['lr-010', 'lr-011', 'lr-012', 'lr-013'] } },
      { actorUserId: hr.id, action: 'DEPARTMENT_CREATED', entityType: 'Department', entityId: 'dept-ds', newValuesJson: { name: 'Data Science', parentId: 'dept-eng' } },
      { actorUserId: hr.id, action: 'DEPARTMENT_UPDATED', entityType: 'Department', entityId: 'dept-hr', oldValuesJson: { headEmployeeId: null }, newValuesJson: { headEmployeeId: hrEmpId } },
      { actorUserId: hr.id, action: 'HOLIDAY_CREATED', entityType: 'Holiday', entityId: 'hol-eid', newValuesJson: { name: 'Eid ul-Adha', date: '2026-06-17', type: 'OPTIONAL' } },
      { actorUserId: hr.id, action: 'HOLIDAY_DELETED', entityType: 'Holiday', entityId: 'hol-old-001', oldValuesJson: { name: 'Obsolete Holiday' } },
      { actorUserId: hr.id, action: 'SETTINGS_UPDATED', entityType: 'Setting', entityId: 'set-001', oldValuesJson: { 'carry-forward-max-days': 5 }, newValuesJson: { 'carry-forward-max-days': 10 } },
      { actorUserId: superAdmin.id, action: 'SETTINGS_UPDATED', entityType: 'Setting', entityId: 'set-002', oldValuesJson: { 'mfa-enabled': false }, newValuesJson: { 'mfa-enabled': true } },
      { actorUserId: hr.id, action: 'EMAIL_TEMPLATE_UPDATED', entityType: 'EmailTemplate', entityId: 'et-001', oldValuesJson: { subject: 'Old subject' }, newValuesJson: { subject: 'Your leave request has been approved' } },
      { actorUserId: hr.id, action: 'DOCUMENT_VERIFIED', entityType: 'EmployeeDocument', entityId: 'doc-001', oldValuesJson: { verificationStatus: 'PENDING' }, newValuesJson: { verificationStatus: 'VERIFIED' } },
      { actorUserId: hr.id, action: 'DOCUMENT_REJECTED', entityType: 'EmployeeDocument', entityId: 'doc-002', oldValuesJson: { verificationStatus: 'PENDING' }, newValuesJson: { verificationStatus: 'REJECTED', reason: 'Blurry scan, resubmit required' } },
      { actorUserId: aman.id, action: 'REGULARIZATION_APPROVED', entityType: 'AttendanceRegularization', entityId: 'reg-001', oldValuesJson: { status: 'PENDING' }, newValuesJson: { status: 'APPROVED' } },
      { actorUserId: aman.id, action: 'REGULARIZATION_DENIED', entityType: 'AttendanceRegularization', entityId: 'reg-002', oldValuesJson: { status: 'PENDING' }, newValuesJson: { status: 'DENIED' } },
      { actorUserId: hr.id, action: 'RESIGNATION_APPROVED', entityType: 'Resignation', entityId: 'res-001', oldValuesJson: { status: 'PENDING' }, newValuesJson: { status: 'APPROVED' } },
      { actorUserId: hr.id, action: 'RESIGNATION_REJECTED', entityType: 'Resignation', entityId: 'res-002', oldValuesJson: { status: 'PENDING' }, newValuesJson: { status: 'REJECTED', reason: 'Insufficient notice period' } },
      { actorUserId: superAdmin.id, action: 'EXPORT_COMPLETED', entityType: 'ExportJob', entityId: 'exp-001', newValuesJson: { type: 'EMPLOYEES', format: 'excel', records: 70 } },
      { actorUserId: hr.id, action: 'REPORT_SCHEDULED', entityType: 'ScheduledReport', entityId: 'sr-001', newValuesJson: { type: 'attendance', frequency: 'WEEKLY', recipients: ['hr@acme.test'] } },
      { actorUserId: superAdmin.id, action: 'ROLE_UPDATED', entityType: 'Role', entityId: 'role-manager', oldValuesJson: { permissions: [] }, newValuesJson: { permissions: ['leave.approve', 'attendance.view_team'] } },
      { actorUserId: null, action: 'SYSTEM_STARTUP', entityType: 'System', entityId: 'server', newValuesJson: { version: '1.0.0', node: '20.x', env: 'production' } },
    ];

    for (const row of auditRows) {
      await prisma.auditLog.create({ data: { tenantId, ...row } });
    }
    const totalAudit = await prisma.auditLog.count({ where: { tenantId } });
    console.log(`✓ Audit logs: ${totalAudit} total records`);
  } else {
    console.log(`✓ Audit logs: already have ${existingAudit}`);
  }

  // ── 12. Saved Views ───────────────────────────────────────────────────────
  const existingViews = await prisma.savedView.count({ where: { tenantId } }).catch(() => 0);
  if (existingViews === 0) {
    const savedViews = [
      { userId: hr.id, name: 'Active Employees — Engineering', module: 'employees', filtersJson: { department: 'Engineering', status: 'ACTIVE' } },
      { userId: hr.id, name: 'Pending Leave Requests', module: 'leave', filtersJson: { status: 'PENDING' } },
      { userId: hr.id, name: 'This Month Attendance', module: 'attendance', filtersJson: { month: '2026-05' } },
      { userId: aman.id, name: 'My Team Leaves', module: 'leave', filtersJson: { status: 'PENDING', teamOnly: true } },
      { userId: aman.id, name: 'WFH Team Members', module: 'attendance', filtersJson: { workMode: 'WFH', today: true } },
      { userId: superAdmin.id, name: 'All Pending Resignations', module: 'resignations', filtersJson: { status: 'PENDING' } },
      { userId: superAdmin.id, name: 'Finance Department', module: 'employees', filtersJson: { department: 'Finance', status: 'ACTIVE' } },
      { userId: priya.id, name: 'My Leave History', module: 'leave', filtersJson: { personal: true } },
    ];

    try {
      await prisma.savedView.createMany({ data: savedViews.map(v => ({ tenantId, ...v })) });
      console.log(`✓ Saved views: ${savedViews.length} records`);
    } catch (e) {
      // savedView might have different field names — check if it exists
      console.log('⚠ Saved views: skipped —', e.message.split('\n')[0]);
    }
  } else {
    console.log(`✓ Saved views: already have ${existingViews}`);
  }

  // ── Final count ───────────────────────────────────────────────────────────
  console.log('\n=== Final DB State ===');
  const finalCounts = await Promise.all([
    prisma.setting.count({ where: { tenantId } }),
    prisma.emailTemplate.count({ where: { tenantId } }),
    prisma.scheduledReport.count({ where: { tenantId } }),
    prisma.reportExport.count({ where: { tenantId } }),
    prisma.exportJob.count({ where: { tenantId } }),
    prisma.attendanceRegularizationRequest.count({ where: { tenantId } }),
    prisma.employeeDocument.count({ where: { tenantId } }),
    prisma.resignation.count({ where: { tenantId } }),
    prisma.notification.count({ where: { tenantId } }),
    prisma.logEntry.count({ where: { tenantId } }),
    prisma.auditLog.count({ where: { tenantId } }),
    prisma.attendanceRecord.count({ where: { tenantId } }),
    prisma.leaveRequest.count({ where: { tenantId } }),
    prisma.employee.count({ where: { tenantId, deletedAt: null } }),
  ]);
  const labels = ['settings','emailTemplates','scheduledReports','reportExports','exportJobs','regularizationRequests','employeeDocuments','resignations','notifications','logEntries','auditLogs','attendanceRecords','leaveRequests','employees'];
  labels.forEach((l, i) => console.log(`  ${l}: ${finalCounts[i]}`));
}

main()
  .then(() => { console.log('\n✅ seedUIData complete'); process.exit(0); })
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
