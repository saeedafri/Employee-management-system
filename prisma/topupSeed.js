import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/mohdsaeedafri/All-Code-Base/EMS/.env' });

const prisma = new PrismaClient();
const TENANT = 'acme-corp-001';

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: TENANT } });
  if (!tenant) throw new Error('Tenant not found');
  const tid = tenant.id;

  const employees = await prisma.employee.findMany({
    where: { tenantId: tid, deletedAt: null, employmentStatus: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true },
    take: 50,
  });

  console.log(`Found ${employees.length} employees`);

  // 1. Add 15 more job openings
  const extraOpenings = [
    { id: 'job-extra-001', title: 'Data Scientist', department: 'Analytics', location: 'Bangalore', employmentType: 'FULL_TIME', status: 'Open', applicantCount: 12 },
    { id: 'job-extra-002', title: 'DevOps Engineer', department: 'Engineering', location: 'Remote', employmentType: 'FULL_TIME', status: 'Open', applicantCount: 8 },
    { id: 'job-extra-003', title: 'Product Manager', department: 'Product', location: 'Mumbai', employmentType: 'FULL_TIME', status: 'Closing', applicantCount: 22 },
    { id: 'job-extra-004', title: 'UI/UX Designer', department: 'Design', location: 'Hyderabad', employmentType: 'FULL_TIME', status: 'Open', applicantCount: 17 },
    { id: 'job-extra-005', title: 'Sales Executive', department: 'Sales', location: 'Delhi', employmentType: 'FULL_TIME', status: 'Open', applicantCount: 31 },
    { id: 'job-extra-006', title: 'ML Engineer', department: 'Engineering', location: 'Bangalore', employmentType: 'FULL_TIME', status: 'Open', applicantCount: 6 },
    { id: 'job-extra-007', title: 'Content Writer', department: 'Marketing', location: 'Remote', employmentType: 'CONTRACT', status: 'Closing', applicantCount: 45 },
    { id: 'job-extra-008', title: 'Finance Analyst', department: 'Finance', location: 'Mumbai', employmentType: 'FULL_TIME', status: 'Open', applicantCount: 9 },
    { id: 'job-extra-009', title: 'Customer Success Lead', department: 'Customer Success', location: 'Pune', employmentType: 'FULL_TIME', status: 'On hold', applicantCount: 14 },
    { id: 'job-extra-010', title: 'Android Developer', department: 'Engineering', location: 'Bangalore', employmentType: 'FULL_TIME', status: 'Open', applicantCount: 19 },
    { id: 'job-extra-011', title: 'HR Business Partner', department: 'HR', location: 'Mumbai', employmentType: 'FULL_TIME', status: 'Closing', applicantCount: 7 },
    { id: 'job-extra-012', title: 'Legal Counsel', department: 'Legal', location: 'Delhi', employmentType: 'FULL_TIME', status: 'On hold', applicantCount: 3 },
    { id: 'job-extra-013', title: 'IT Support Engineer', department: 'IT', location: 'Bangalore', employmentType: 'FULL_TIME', status: 'Open', applicantCount: 11 },
    { id: 'job-extra-014', title: 'Intern — Data', department: 'Analytics', location: 'Remote', employmentType: 'INTERNSHIP', status: 'Open', applicantCount: 88 },
    { id: 'job-extra-015', title: 'Senior QA Engineer', department: 'Engineering', location: 'Pune', employmentType: 'FULL_TIME', status: 'Closed', applicantCount: 24 },
  ];
  for (const o of extraOpenings) {
    await prisma.jobOpening.upsert({
      where: { id: o.id },
      create: { ...o, tenantId: tid, createdAt: new Date() },
      update: { status: o.status },
    });
  }
  console.log(`  ✓ ${extraOpenings.length} extra openings`);

  // 2. Add 20 more candidates spread across all stages
  const stages = ['applied','applied','applied','screening','screening','screening','interview','interview','offer','offer','hired'];
  const names = ['Arjun Shah','Meera Patel','Vikram Singh','Ananya Das','Rohan Kapoor','Priya Nair','Sneha Iyer','Kiran Kumar','Deepak Verma','Amit Joshi','Riya Mehta','Sanjay Bose','Pooja Rao','Harish Nayak','Divya Pillai','Suresh Menon','Lakshmi Rajan','Mohit Agarwal','Tanya Gupta','Aditya Sharma'];
  for (let i = 0; i < names.length; i++) {
    const cid = `cand-extra-${String(i+1).padStart(3,'0')}`;
    const stage = stages[i % stages.length];
    await prisma.candidate.upsert({
      where: { id: cid },
      create: {
        id: cid, tenantId: tid,
        name: names[i], email: `${names[i].toLowerCase().replace(/ /g,'.')}@candidate.test`,
        openingId: extraOpenings[i % extraOpenings.length].id,
        role: extraOpenings[i % extraOpenings.length].title,
        stage, rating: i % 6, daysInStage: (i * 3) % 21,
        isReferral: i % 4 === 0, appliedAt: new Date(),
      },
      update: {},
    });
  }
  console.log(`  ✓ 20 extra candidates`);

  // 3. Add 15 more performance reviews (Not started / Self review / Manager review)
  const cycle = await prisma.performanceCycle.findFirst({ where: { tenantId: tid, status: { in: ['In progress','Calibrating'] } } });
  if (cycle) {
    const existingReviews = await prisma.performanceReview.findMany({ where: { tenantId: tid, cycleId: cycle.id }, select: { employeeId: true } });
    const reviewedIds = new Set(existingReviews.map(r => r.employeeId));
    const reviewEmps = employees.filter(e => !reviewedIds.has(e.id)).slice(0, 15);
    const reviewStatuses = ['Not started','Not started','Not started','Not started','Not started','Self review','Self review','Self review','Self review','Manager review','Manager review','Manager review','Manager review','Manager review','Not started'];
    for (let i = 0; i < reviewEmps.length; i++) {
      const rid = `review-extra-${String(i+1).padStart(3,'0')}`;
      await prisma.performanceReview.upsert({
        where: { id: rid },
        create: {
          id: rid, tenantId: tid,
          cycleId: cycle.id, employeeId: reviewEmps[i].id,
          status: reviewStatuses[i], selfComplete: i > 4, managerComplete: false,
          createdAt: new Date(Date.now() - i * 86400000),
        },
        update: { status: reviewStatuses[i] },
      });
    }
    console.log(`  ✓ 15 extra reviews (Not started/Self review/Manager review)`);
  }

  // 4. Add 15 more performance goals
  const goalData = [
    ['Reduce API p99 latency to <100ms','On track',72],['Ship v2 onboarding flow','Done',100],['Hire 5 engineers by Q3','At risk',30],
    ['Migrate to TypeScript strict mode','On track',55],['Close 20 enterprise deals','At risk',40],['Launch referral program','Done',100],
    ['Reduce churn by 15%','On track',65],['Implement CI/CD for mobile','On track',80],['Complete security audit','Done',100],
    ['Build self-service portal','At risk',20],['Expand to 3 new markets','On track',50],['Achieve SOC2 compliance','On track',88],
    ['Reduce TTFB by 200ms','Done',100],['Onboard 50 enterprise clients','At risk',35],['Launch AI-powered search','On track',60],
  ];
  for (let i = 0; i < goalData.length; i++) {
    const [title, status, pct] = goalData[i];
    const gid = `goal-extra-${String(i+1).padStart(3,'0')}`;
    await prisma.performanceGoal.upsert({
      where: { id: gid },
      create: {
        id: gid, tenantId: tid,
        employeeId: employees[i].id, title, status, progressPct: pct,
        dueDate: new Date('2026-12-31'), createdAt: new Date(),
      },
      update: { status, progressPct: pct },
    });
  }
  console.log(`  ✓ 15 extra goals`);

  // 5. Add 15 more assets
  const assetTypes = ['Laptop','Monitor','Phone','Other'];
  const assetStatuses = ['Available','Available','Available','Available','Assigned','Assigned','Repair','Repair','Retired','Available','Available','Laptop','Available','Assigned','Available'];
  const assetNames = ['ThinkPad X1 Carbon','Dell UltraSharp 27"','iPhone 15 Pro','USB-C Hub','MacBook Air M2','Samsung 32" 4K','Dell XPS 15 (repair)','LG 24" (repair)','Broken iPad','Logitech MX Keys','Sony WH-1000XM5','HP EliteBook 840','Jabra Headset','iPad Air M1','Anker Dock'];
  for (let i = 0; i < assetNames.length; i++) {
    const aid = `asset-extra-${String(i+1).padStart(3,'0')}`;
    const type = assetTypes[i % 4];
    const st = ['Available','Available','Available','Available','Assigned','Assigned','Repair','Repair','Retired','Available','Available','Available','Available','Assigned','Available'][i];
    await prisma.asset.upsert({
      where: { id: aid },
      create: {
        id: aid, tenantId: tid,
        tag: `EXTRA-${String(i+1).padStart(4,'0')}`, name: assetNames[i], type, status: st,
        assignedToId: st === 'Assigned' ? employees[i].id : null,
        assignedToName: st === 'Assigned' ? `${employees[i].firstName} ${employees[i].lastName}` : null,
        assignedSince: st === 'Assigned' ? '2026-01-15' : null,
        createdAt: new Date(),
      },
      update: { status: st },
    });
  }
  console.log(`  ✓ 15 extra assets`);

  // 6. Add 10 pending asset requests
  for (let i = 0; i < 10; i++) {
    const reqId = `req-extra-${String(i+1).padStart(3,'0')}`;
    const items = ['Laptop — MacBook Pro 14"','Monitor — 27" 4K','Phone — iPhone 15','Headset — Jabra 75','USB Hub','External SSD 1TB','Webcam HD','Mechanical Keyboard','Ergonomic Chair','Standing Desk Converter'];
    await prisma.assetRequest.upsert({
      where: { id: reqId },
      create: {
        id: reqId, tenantId: tid,
        requestedById: employees[i + 10].id,
        requestedByName: `${employees[i+10].firstName} ${employees[i+10].lastName}`,
        item: items[i], reason: 'New project requirement', status: 'Pending',
        requestedAt: new Date(),
      },
      update: { status: 'Pending' },
    });
  }
  console.log(`  ✓ 10 extra pending asset requests`);

  // 7. Re-pin ann-000 and add 10 more announcements
  await prisma.announcement.updateMany({ where: { tenantId: tid, isPinned: true }, data: { isPinned: false } });
  await prisma.announcement.upsert({
    where: { id: 'ann-000' },
    create: {
      id: 'ann-000', tenantId: tid,
      channelId: 'ch-001', title: 'Q2 All-Hands — Thursday 4 PM IST',
      body: 'Join the leadership team for the Q2 business review, product roadmap, and a live Q&A.',
      category: 'Company', audience: 'All employees', isPinned: true, readCount: 182,
      authorName: 'Aman Khanna', authorRole: 'Chief People Officer',
      postedAt: new Date('2026-06-02T07:00:00Z'), postedAt: new Date('2026-06-02T07:00:00Z'),
    },
    update: { isPinned: true },
  });
  const extraAnns = [
    { id:'ann-extra-001', ch:'ch-002', title:'New WFH Policy — Effective July 1', body:'Starting July 1, employees can work from home up to 3 days per week. Manager approval required for 5-day WFH.', cat:'People', audience:'All employees', pinned:false },
    { id:'ann-extra-002', ch:'ch-004', title:'MFA Enforcement — Action Required', body:'Multi-factor authentication will be enforced for all accounts starting June 20. Please set up your authenticator app before then.', cat:'IT', audience:'All employees', pinned:false },
    { id:'ann-extra-003', ch:'ch-003', title:'Product Update: v2.4 Released', body:'We shipped major improvements to the dashboard, new export formats, and mobile responsiveness. Full changelog in Notion.', cat:'Product', audience:'All employees', pinned:false },
    { id:'ann-extra-004', ch:'ch-001', title:'Bengaluru Office Expansion Complete', body:'The new floor 4 is now open with 80 additional workstations, 3 conference rooms, and a gaming lounge.', cat:'Office', audience:'All employees', pinned:false },
    { id:'ann-extra-005', ch:'ch-002', title:'Health Insurance Renewal — Documents Due', body:'Please submit your health insurance renewal documents by June 30. HR will send individual reminders.', cat:'People', audience:'All employees', pinned:false },
    { id:'ann-extra-006', ch:'ch-003', title:'Mobile App Beta — Join Now', body:'Our mobile app beta is open for internal testing. Download from TestFlight (iOS) or Google Play Beta (Android).', cat:'Product', audience:'All employees', pinned:false },
    { id:'ann-extra-007', ch:'ch-004', title:'Software License Audit This Week', body:'IT will audit software licenses across all machines this week. Please ensure all tools are approved.', cat:'IT', audience:'All employees', pinned:false },
    { id:'ann-extra-008', ch:'ch-001', title:'Diwali Celebration — Save the Date', body:'Our annual Diwali celebration is on October 20. Venue: Hotel Leela, Bangalore. RSVPs open next week.', cat:'Company', audience:'All employees', pinned:false },
    { id:'ann-extra-009', ch:'ch-005', title:'Cafeteria Menu Update', body:'New healthy options added to the cafeteria starting Monday. Includes vegan, gluten-free, and Jain-friendly meals.', cat:'Office', audience:'All employees', pinned:false },
    { id:'ann-extra-010', ch:'ch-002', title:'Learning Budget 2026 — Apply Now', body:'Each employee has INR 25,000 for courses, certifications, or conferences. Submit your request via the HR portal.', cat:'People', audience:'All employees', pinned:false },
  ];
  for (const a of extraAnns) {
    await prisma.announcement.upsert({
      where: { id: a.id },
      create: {
        id: a.id, tenantId: tid, channelId: a.ch, title: a.title, body: a.body,
        category: a.cat, audience: a.audience, isPinned: a.pinned, readCount: Math.floor(Math.random()*200),
        authorName: 'HR Team', authorRole: 'People Operations',
        postedAt: new Date(Date.now() - Math.random()*7*86400000),
      },
      update: { title: a.title },
    });
  }
  console.log(`  ✓ ann-000 re-pinned + 10 extra announcements`);

  // 8. Add 10 more events
  const extraEvents = [
    { id:'ev-extra-001', date:'2026-07-15', title:'Town Hall — Q3 Kickoff', meta:'3:00 PM · Auditorium + Zoom' },
    { id:'ev-extra-002', date:'2026-07-20', title:'Sales Kickoff 2026-H2', meta:'9:00 AM · Bengaluru campus' },
    { id:'ev-extra-003', date:'2026-08-01', title:'Engineering Summit', meta:'All-day · Conference center' },
    { id:'ev-extra-004', date:'2026-08-15', title:'Independence Day — Office Closed', meta:'Public holiday' },
    { id:'ev-extra-005', date:'2026-09-10', title:'Quarterly Review — HR', meta:'2:00 PM · Room 3B' },
    { id:'ev-extra-006', date:'2026-09-20', title:'Diwali Celebration', meta:'6:00 PM · Hotel Leela' },
    { id:'ev-extra-007', date:'2026-10-10', title:'Q3 All-Hands', meta:'4:00 PM · Auditorium' },
    { id:'ev-extra-008', date:'2026-10-25', title:'Manager Workshop — Feedback Skills', meta:'9:00 AM–5:00 PM · Offsite' },
    { id:'ev-extra-009', date:'2026-11-05', title:'Annual Benefits Enrollment Opens', meta:'Deadline: Nov 30' },
    { id:'ev-extra-010', date:'2026-12-20', title:'Year-End Celebration', meta:'7:00 PM · Grand Ballroom' },
  ];
  for (const e of extraEvents) {
    await prisma.announcementEvent.upsert({
      where: { id: e.id },
      create: { id: e.id, date: e.date, title: e.title, meta: e.meta, tenantId: tid },
      update: { title: e.title },
    });
  }
  console.log(`  ✓ 10 extra events`);

  console.log('\n✅ Top-up seed complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
