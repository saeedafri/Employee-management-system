import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: 'acme-corp-001' } });
  if (!tenant) throw new Error('Tenant acme-corp-001 not found');
  const tenantId = tenant.id;

  console.log(`Seeding Phase 3 data for tenant: ${tenant.name} (${tenantId})`);

  // ── Recruitment ──────────────────────────────────────────────────────────────

  const openings = await Promise.all([
    prisma.jobOpening.upsert({
      where: { id: 'job-eng-001' },
      update: {},
      create: {
        id: 'job-eng-001', tenantId, title: 'Senior Backend Engineer',
        department: 'Engineering', location: 'Bengaluru',
        employmentType: 'FULL_TIME', applicantCount: 38,
        currentStage: 'Interviewing', status: 'Open',
        createdAt: new Date('2026-04-15'),
      },
    }),
    prisma.jobOpening.upsert({
      where: { id: 'job-des-001' },
      update: {},
      create: {
        id: 'job-des-001', tenantId, title: 'Product Designer',
        department: 'Design', location: 'Remote',
        employmentType: 'FULL_TIME', applicantCount: 22,
        currentStage: 'Screening', status: 'Open',
        createdAt: new Date('2026-04-20'),
      },
    }),
    prisma.jobOpening.upsert({
      where: { id: 'job-fin-001' },
      update: {},
      create: {
        id: 'job-fin-001', tenantId, title: 'Finance Analyst',
        department: 'Finance', location: 'Mumbai',
        employmentType: 'FULL_TIME', applicantCount: 15,
        currentStage: 'Applied', status: 'Closing',
        createdAt: new Date('2026-05-01'),
      },
    }),
    prisma.jobOpening.upsert({
      where: { id: 'job-pm-001' },
      update: {},
      create: {
        id: 'job-pm-001', tenantId, title: 'Product Manager',
        department: 'Product', location: 'Bengaluru',
        employmentType: 'FULL_TIME', applicantCount: 47,
        currentStage: 'Interview', status: 'Open',
        createdAt: new Date('2026-03-10'),
      },
    }),
    prisma.jobOpening.upsert({
      where: { id: 'job-ml-001' },
      update: {},
      create: {
        id: 'job-ml-001', tenantId, title: 'ML Engineer',
        department: 'Engineering', location: 'Hyderabad',
        employmentType: 'CONTRACT', applicantCount: 31,
        currentStage: 'Offer', status: 'Open',
        createdAt: new Date('2026-04-05'),
      },
    }),
    prisma.jobOpening.upsert({
      where: { id: 'job-mkt-001' },
      update: {},
      create: {
        id: 'job-mkt-001', tenantId, title: 'Marketing Specialist',
        department: 'Marketing', location: 'Delhi',
        employmentType: 'FULL_TIME', applicantCount: 19,
        currentStage: 'Applied', status: 'On hold',
        createdAt: new Date('2026-05-10'),
      },
    }),
  ]);
  console.log(`Created ${openings.length} job openings`);

  const candidateData = [
    { id: 'cand-001', openingId: 'job-eng-001', name: 'Fatima Noor', role: 'Senior Backend Engineer', email: 'fatima.noor@example.com', stage: 'interview', rating: 4, daysInStage: 6, isReferral: true },
    { id: 'cand-002', openingId: 'job-eng-001', name: 'Rohan Mehra', role: 'Senior Backend Engineer', email: 'rohan.mehra@example.com', stage: 'screening', rating: 3, daysInStage: 2, isReferral: false },
    { id: 'cand-003', openingId: 'job-eng-001', name: 'Aditi Sinha', role: 'Senior Backend Engineer', email: 'aditi.sinha@example.com', stage: 'offer', rating: 5, daysInStage: 1, isReferral: false },
    { id: 'cand-004', openingId: 'job-des-001', name: 'Karan Shah', role: 'Product Designer', email: 'karan.shah@example.com', stage: 'screening', rating: 3, daysInStage: 4, isReferral: false },
    { id: 'cand-005', openingId: 'job-des-001', name: 'Pooja Iyer', role: 'Product Designer', email: 'pooja.iyer@example.com', stage: 'interview', rating: 4, daysInStage: 3, isReferral: true },
    { id: 'cand-006', openingId: 'job-fin-001', name: 'Vikram Bose', role: 'Finance Analyst', email: 'vikram.bose@example.com', stage: 'applied', rating: 0, daysInStage: 1, isReferral: false },
    { id: 'cand-007', openingId: 'job-pm-001', name: 'Neha Gupta', role: 'Product Manager', email: 'neha.gupta@example.com', stage: 'interview', rating: 4, daysInStage: 5, isReferral: false },
    { id: 'cand-008', openingId: 'job-pm-001', name: 'Arjun Patel', role: 'Product Manager', email: 'arjun.patel@example.com', stage: 'offer', rating: 5, daysInStage: 2, isReferral: true },
    { id: 'cand-009', openingId: 'job-ml-001', name: 'Divya Kumar', role: 'ML Engineer', email: 'divya.kumar@example.com', stage: 'hired', rating: 5, daysInStage: 0, isReferral: false },
    { id: 'cand-010', openingId: 'job-ml-001', name: 'Sameer Ali', role: 'ML Engineer', email: 'sameer.ali@example.com', stage: 'interview', rating: 4, daysInStage: 7, isReferral: false },
    { id: 'cand-011', openingId: 'job-mkt-001', name: 'Priyanka Das', role: 'Marketing Specialist', email: 'priyanka.das@example.com', stage: 'applied', rating: 0, daysInStage: 3, isReferral: false },
  ];

  for (const c of candidateData) {
    await prisma.candidate.upsert({
      where: { id: c.id },
      update: {},
      create: { ...c, tenantId, appliedAt: new Date('2026-05-20') },
    });
  }
  console.log(`Created ${candidateData.length} candidates`);

  // ── Performance ──────────────────────────────────────────────────────────────

  await prisma.performanceCycle.upsert({
    where: { id: 'cycle-h1-2026' },
    update: {},
    create: {
      id: 'cycle-h1-2026', tenantId,
      name: 'H1 2026 Review Cycle',
      selfReviewDue: new Date('2026-06-07'),
      managerReviewDue: new Date('2026-06-14'),
      calibrationDate: new Date('2026-06-21'),
      progressPct: 58,
      status: 'In progress',
      startedAt: new Date('2026-05-15'),
    },
  });
  console.log('Created performance cycle');

  // Fetch some employees for performance data
  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    take: 7,
    select: { id: true, firstName: true, lastName: true, departmentId: true, managerId: true },
  });

  const ratingOptions = ['Exceeds', 'Strong', 'Meets', 'Developing', 'Below', null];
  const statusOptions = ['Calibrated', 'Manager review', 'Self review', 'Not started'];

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const status = statusOptions[i % statusOptions.length];
    const rating = status === 'Calibrated' ? ratingOptions[i % 5] : null;
    await prisma.performanceReview.upsert({
      where: { tenantId_cycleId_employeeId: { tenantId, cycleId: 'cycle-h1-2026', employeeId: emp.id } },
      update: {},
      create: {
        tenantId, cycleId: 'cycle-h1-2026', employeeId: emp.id,
        reviewerId: emp.managerId || null,
        status, rating,
        selfComplete: status !== 'Not started',
        managerComplete: status === 'Calibrated',
      },
    });
  }
  console.log(`Created ${employees.length} performance reviews`);

  const goalTitles = [
    'Ship design-system v2', 'Reduce API latency by 20%', 'Launch mobile app v3',
    'Hire 5 engineers Q2', 'Migrate to microservices', 'Launch Q2 marketing campaign',
  ];

  for (let i = 0; i < Math.min(employees.length, goalTitles.length); i++) {
    const emp = employees[i];
    const statusList = ['On track', 'At risk', 'Done'];
    await prisma.performanceGoal.upsert({
      where: { id: `goal-${i + 1}` },
      update: {},
      create: {
        id: `goal-${i + 1}`, tenantId,
        cycleId: 'cycle-h1-2026',
        employeeId: emp.id,
        title: goalTitles[i],
        progressPct: [80, 45, 100, 60, 30, 55][i],
        dueDate: new Date('2026-06-30'),
        status: statusList[i % 3],
      },
    });
  }
  console.log(`Created ${Math.min(employees.length, goalTitles.length)} performance goals`);

  // ── Assets ───────────────────────────────────────────────────────────────────

  const assetData = [
    { id: 'asset-001', tag: 'LAP-0192', name: 'MacBook Pro 14" M3', type: 'Laptop', status: 'Assigned', assignedToId: employees[0]?.id, assignedToName: employees[0] ? `${employees[0].firstName} ${employees[0].lastName}` : null, assignedSince: '2025-01-15' },
    { id: 'asset-002', tag: 'MON-0041', name: 'Dell 27" 4K Monitor', type: 'Monitor', status: 'Available', assignedToId: null, assignedToName: null, assignedSince: null },
    { id: 'asset-003', tag: 'LAP-0201', name: 'ThinkPad X1 Carbon', type: 'Laptop', status: 'Assigned', assignedToId: employees[1]?.id, assignedToName: employees[1] ? `${employees[1].firstName} ${employees[1].lastName}` : null, assignedSince: '2025-03-01' },
    { id: 'asset-004', tag: 'PHN-0088', name: 'iPhone 15 Pro', type: 'Phone', status: 'Assigned', assignedToId: employees[2]?.id, assignedToName: employees[2] ? `${employees[2].firstName} ${employees[2].lastName}` : null, assignedSince: '2025-06-01' },
    { id: 'asset-005', tag: 'LAP-0180', name: 'MacBook Air M2', type: 'Laptop', status: 'Repair', assignedToId: null, assignedToName: null, assignedSince: null },
    { id: 'asset-006', tag: 'MON-0055', name: 'LG UltraWide 34"', type: 'Monitor', status: 'Available', assignedToId: null, assignedToName: null, assignedSince: null },
    { id: 'asset-007', tag: 'LAP-0215', name: 'Dell XPS 15', type: 'Laptop', status: 'Assigned', assignedToId: employees[3]?.id, assignedToName: employees[3] ? `${employees[3].firstName} ${employees[3].lastName}` : null, assignedSince: '2025-08-10' },
    { id: 'asset-008', tag: 'PHN-0102', name: 'Samsung Galaxy S24', type: 'Phone', status: 'Retired', assignedToId: null, assignedToName: null, assignedSince: null },
  ];

  for (const a of assetData) {
    await prisma.asset.upsert({
      where: { id: a.id },
      update: {},
      create: { ...a, tenantId },
    });
  }
  console.log(`Created ${assetData.length} assets`);

  const requestData = [
    { id: 'req-001', requestedById: employees[0]?.id || 'emp-x', requestedByName: employees[0] ? `${employees[0].firstName} ${employees[0].lastName}` : 'Unknown', item: 'Monitor — 27" 4K', reason: 'New hire setup', status: 'Pending' },
    { id: 'req-002', requestedById: employees[1]?.id || 'emp-x', requestedByName: employees[1] ? `${employees[1].firstName} ${employees[1].lastName}` : 'Unknown', item: 'Keyboard & Mouse', reason: 'Ergonomic upgrade', status: 'Approved' },
    { id: 'req-003', requestedById: employees[2]?.id || 'emp-x', requestedByName: employees[2] ? `${employees[2].firstName} ${employees[2].lastName}` : 'Unknown', item: 'Laptop Dock', reason: 'WFH equipment', status: 'Pending' },
    { id: 'req-004', requestedById: employees[3]?.id || 'emp-x', requestedByName: employees[3] ? `${employees[3].firstName} ${employees[3].lastName}` : 'Unknown', item: 'USB-C Hub', reason: 'Travel kit', status: 'Fulfilled' },
  ];

  for (const r of requestData) {
    await prisma.assetRequest.upsert({
      where: { id: r.id },
      update: {},
      create: { ...r, tenantId, requestedAt: new Date('2026-05-27') },
    });
  }
  console.log(`Created ${requestData.length} asset requests`);

  // ── Announcements ─────────────────────────────────────────────────────────────

  const channelData = [
    { id: 'ch-001', name: 'Company-wide', category: 'Company', postCount: 142 },
    { id: 'ch-002', name: 'People & Culture', category: 'People', postCount: 89 },
    { id: 'ch-003', name: 'Product Updates', category: 'Product', postCount: 54 },
    { id: 'ch-004', name: 'IT & Security', category: 'IT', postCount: 31 },
    { id: 'ch-005', name: 'Office Ops', category: 'Office', postCount: 27 },
  ];

  for (const ch of channelData) {
    await prisma.announcementChannel.upsert({
      where: { tenantId_name: { tenantId, name: ch.name } },
      update: {},
      create: { ...ch, tenantId },
    });
  }
  console.log(`Created ${channelData.length} announcement channels`);

  const channels = await prisma.announcementChannel.findMany({ where: { tenantId } });
  const channelMap = Object.fromEntries(channels.map(ch => [ch.name, ch.id]));

  const announcementData = [
    { id: 'ann-000', channelId: channelMap['Company-wide'], category: 'Company', title: '🎉 Acme Corp Achieves $10M ARR', body: 'We are thrilled to announce that Acme Corp has reached $10M in Annual Recurring Revenue! This milestone reflects the dedication of every team member. More details in the all-hands meeting on Friday.', authorName: 'Rahul Sharma', authorRole: 'CEO', audience: 'All employees', readCount: 182, isPinned: true, postedAt: new Date('2026-05-28') },
    { id: 'ann-001', channelId: channelMap['People & Culture'], category: 'People', title: 'New Parental Leave Policy — Effective July 1', body: 'We are expanding our parental leave policy to 26 weeks fully paid for primary caregivers and 8 weeks for secondary caregivers.', authorName: 'Sunita Verma', authorRole: 'Head of HR', audience: 'All employees', readCount: 95, isPinned: false, postedAt: new Date('2026-05-25') },
    { id: 'ann-002', channelId: channelMap['Product Updates'], category: 'Product', title: 'EMS v2.4 Launched — Payroll Module Live', body: 'The new Payroll module is now live in production. HR admins can access it from the main navigation. Training sessions scheduled for next week.', authorName: 'Aman Khanna', authorRole: 'Engineering Manager', audience: 'All employees', readCount: 67, isPinned: false, postedAt: new Date('2026-05-22') },
    { id: 'ann-003', channelId: channelMap['IT & Security'], category: 'IT', title: 'Mandatory Security Training — Complete by June 15', body: 'All employees must complete the annual security awareness training by June 15, 2026. Link shared on Slack #security channel.', authorName: 'Deepak Nair', authorRole: 'IT Manager', audience: 'All employees', readCount: 44, isPinned: false, postedAt: new Date('2026-05-20') },
    { id: 'ann-004', channelId: channelMap['Office Ops'], category: 'Office', title: 'Bengaluru Office Renovation — Floor 3 Closed', body: 'Floor 3 of the Bengaluru office will be closed for renovation from June 10–20. Please use the hot-desking area on floor 2.', authorName: 'Kavita Reddy', authorRole: 'Office Manager', audience: 'Bengaluru', readCount: 28, isPinned: false, postedAt: new Date('2026-05-18') },
  ];

  for (const a of announcementData) {
    await prisma.announcement.upsert({
      where: { id: a.id },
      update: {},
      create: { ...a, tenantId },
    });
  }
  console.log(`Created ${announcementData.length} announcements`);

  const eventData = [
    { id: 'ev-001', date: '2026-06-02', title: 'Q2 All-Hands', meta: '4:00 PM · Main hall + Zoom' },
    { id: 'ev-002', date: '2026-06-07', title: 'Self-Review Deadline', meta: 'Performance cycle closes' },
    { id: 'ev-003', date: '2026-06-14', title: 'Manager Review Deadline', meta: 'Performance cycle step 2' },
    { id: 'ev-004', date: '2026-06-21', title: 'Calibration Meeting', meta: '10:00 AM · Conference Room A' },
    { id: 'ev-005', date: '2026-06-25', title: 'Team Offsite — Coorg', meta: '2 days · All Bengaluru team' },
  ];

  for (const e of eventData) {
    await prisma.announcementEvent.upsert({
      where: { id: e.id },
      update: {},
      create: { ...e, tenantId },
    });
  }
  console.log(`Created ${eventData.length} announcement events`);

  console.log('\n✅ Phase 3 seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
