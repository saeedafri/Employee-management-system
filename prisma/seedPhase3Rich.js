/**
 * seedPhase3Rich.js — Large additive seed for Phase 3 modules
 * Appends only. Never deletes. Safe to run multiple times (all upserts).
 * Run: node prisma/seedPhase3Rich.js
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: 'acme-corp-001' } });
  if (!tenant) throw new Error('Tenant acme-corp-001 not found');
  const tenantId = tenant.id;
  console.log(`\n🌱 Phase 3 RICH seed — tenant: ${tenant.name}\n`);

  // Fetch real employees for realistic linkage
  const allEmployees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    take: 30,
    select: { id: true, firstName: true, lastName: true, departmentId: true, managerId: true,
              department: { select: { name: true } } },
  });
  console.log(`  Found ${allEmployees.length} employees for linkage`);

  // ── RECRUITMENT: 15 openings, 50 candidates ───────────────────────────────
  console.log('\n── RECRUITMENT ──');

  const openingDefs = [
    { id: 'job-eng-001', title: 'Senior Backend Engineer',      department: 'Engineering', location: 'Bengaluru',  employmentType: 'FULL_TIME',  applicantCount: 38, currentStage: 'Interviewing', status: 'Open',    date: '2026-04-15' },
    { id: 'job-des-001', title: 'Product Designer',             department: 'Design',      location: 'Remote',     employmentType: 'FULL_TIME',  applicantCount: 22, currentStage: 'Screening',    status: 'Open',    date: '2026-04-20' },
    { id: 'job-fin-001', title: 'Finance Analyst',              department: 'Finance',     location: 'Mumbai',     employmentType: 'FULL_TIME',  applicantCount: 15, currentStage: 'Applied',      status: 'Closing', date: '2026-05-01' },
    { id: 'job-pm-001',  title: 'Product Manager',              department: 'Product',     location: 'Bengaluru',  employmentType: 'FULL_TIME',  applicantCount: 47, currentStage: 'Interview',    status: 'Open',    date: '2026-03-10' },
    { id: 'job-ml-001',  title: 'ML Engineer',                  department: 'Engineering', location: 'Hyderabad',  employmentType: 'CONTRACT',   applicantCount: 31, currentStage: 'Offer',        status: 'Open',    date: '2026-04-05' },
    { id: 'job-mkt-001', title: 'Marketing Specialist',         department: 'Marketing',   location: 'Delhi',      employmentType: 'FULL_TIME',  applicantCount: 19, currentStage: 'Applied',      status: 'On hold', date: '2026-05-10' },
    { id: 'job-eng-002', title: 'DevOps Engineer',              department: 'Engineering', location: 'Pune',       employmentType: 'FULL_TIME',  applicantCount: 26, currentStage: 'Screening',    status: 'Open',    date: '2026-04-28' },
    { id: 'job-eng-003', title: 'Frontend Engineer (React)',    department: 'Engineering', location: 'Remote',     employmentType: 'FULL_TIME',  applicantCount: 54, currentStage: 'Interviewing', status: 'Open',    date: '2026-04-10' },
    { id: 'job-hr-001',  title: 'HR Business Partner',          department: 'HR',          location: 'Bengaluru',  employmentType: 'FULL_TIME',  applicantCount: 11, currentStage: 'Offer',        status: 'Closing', date: '2026-05-05' },
    { id: 'job-cs-001',  title: 'Customer Success Manager',     department: 'Customer Success', location: 'Delhi', employmentType: 'FULL_TIME',  applicantCount: 9,  currentStage: 'Interview',    status: 'Open',    date: '2026-05-12' },
    { id: 'job-sec-001', title: 'Security Engineer',            department: 'Engineering', location: 'Bengaluru',  employmentType: 'FULL_TIME',  applicantCount: 17, currentStage: 'Screening',    status: 'Open',    date: '2026-05-15' },
    { id: 'job-data-001',title: 'Data Analyst',                 department: 'Analytics',   location: 'Mumbai',     employmentType: 'FULL_TIME',  applicantCount: 33, currentStage: 'Applied',      status: 'Open',    date: '2026-05-08' },
    { id: 'job-ops-001', title: 'Operations Manager',           department: 'Operations',  location: 'Delhi',      employmentType: 'FULL_TIME',  applicantCount: 8,  currentStage: 'Applied',      status: 'On hold', date: '2026-05-18' },
    { id: 'job-qa-001',  title: 'QA Engineer',                  department: 'Engineering', location: 'Hyderabad',  employmentType: 'FULL_TIME',  applicantCount: 21, currentStage: 'Screening',    status: 'Open',    date: '2026-05-03' },
    { id: 'job-arch-001',title: 'Solutions Architect',          department: 'Engineering', location: 'Bengaluru',  employmentType: 'FULL_TIME',  applicantCount: 12, currentStage: 'Interview',    status: 'Closed',  date: '2026-03-01' },
  ];

  for (const o of openingDefs) {
    await prisma.jobOpening.upsert({
      where: { id: o.id },
      update: { applicantCount: o.applicantCount, status: o.status, currentStage: o.currentStage },
      create: { id: o.id, tenantId, title: o.title, department: o.department, location: o.location,
                employmentType: o.employmentType, applicantCount: o.applicantCount,
                currentStage: o.currentStage, status: o.status, createdAt: new Date(o.date) },
    });
  }
  console.log(`  ✓ ${openingDefs.length} job openings`);

  const stages = ['applied','screening','interview','offer','hired'];
  const candidateDefs = [
    // Engineering - Senior Backend
    { id:'cand-001', openingId:'job-eng-001', name:'Fatima Noor',        email:'fatima.noor@example.com',     stage:'interview',  rating:4, daysInStage:6,  isReferral:true },
    { id:'cand-002', openingId:'job-eng-001', name:'Rohan Mehra',        email:'rohan.mehra@example.com',     stage:'screening',  rating:3, daysInStage:2,  isReferral:false },
    { id:'cand-003', openingId:'job-eng-001', name:'Aditi Sinha',        email:'aditi.sinha@example.com',     stage:'offer',      rating:5, daysInStage:1,  isReferral:false },
    { id:'cand-012', openingId:'job-eng-001', name:'Imran Khan',         email:'imran.khan@example.com',      stage:'applied',    rating:0, daysInStage:1,  isReferral:false },
    { id:'cand-013', openingId:'job-eng-001', name:'Shruti Mehta',       email:'shruti.mehta@example.com',    stage:'interview',  rating:3, daysInStage:4,  isReferral:true },
    // Design
    { id:'cand-004', openingId:'job-des-001', name:'Karan Shah',         email:'karan.shah@example.com',      stage:'screening',  rating:3, daysInStage:4,  isReferral:false },
    { id:'cand-005', openingId:'job-des-001', name:'Pooja Iyer',         email:'pooja.iyer@example.com',      stage:'interview',  rating:4, daysInStage:3,  isReferral:true },
    { id:'cand-014', openingId:'job-des-001', name:'Rahul Tiwari',       email:'rahul.tiwari@example.com',    stage:'applied',    rating:0, daysInStage:2,  isReferral:false },
    // Finance
    { id:'cand-006', openingId:'job-fin-001', name:'Vikram Bose',        email:'vikram.bose@example.com',     stage:'applied',    rating:0, daysInStage:1,  isReferral:false },
    { id:'cand-015', openingId:'job-fin-001', name:'Nandini Rao',        email:'nandini.rao@example.com',     stage:'screening',  rating:2, daysInStage:3,  isReferral:false },
    // Product Manager
    { id:'cand-007', openingId:'job-pm-001',  name:'Neha Gupta',         email:'neha.gupta@example.com',      stage:'interview',  rating:4, daysInStage:5,  isReferral:false },
    { id:'cand-008', openingId:'job-pm-001',  name:'Arjun Patel',        email:'arjun.patel@example.com',     stage:'offer',      rating:5, daysInStage:2,  isReferral:true },
    { id:'cand-016', openingId:'job-pm-001',  name:'Gayatri Singh',      email:'gayatri.singh@example.com',   stage:'applied',    rating:0, daysInStage:1,  isReferral:false },
    { id:'cand-017', openingId:'job-pm-001',  name:'Tushar Joshi',       email:'tushar.joshi@example.com',    stage:'screening',  rating:3, daysInStage:5,  isReferral:false },
    // ML Engineer
    { id:'cand-009', openingId:'job-ml-001',  name:'Divya Kumar',        email:'divya.kumar@example.com',     stage:'hired',      rating:5, daysInStage:0,  isReferral:false },
    { id:'cand-010', openingId:'job-ml-001',  name:'Sameer Ali',         email:'sameer.ali@example.com',      stage:'interview',  rating:4, daysInStage:7,  isReferral:false },
    { id:'cand-018', openingId:'job-ml-001',  name:'Prachi Desai',       email:'prachi.desai@example.com',    stage:'screening',  rating:3, daysInStage:3,  isReferral:true },
    // Marketing
    { id:'cand-011', openingId:'job-mkt-001', name:'Priyanka Das',       email:'priyanka.das@example.com',    stage:'applied',    rating:0, daysInStage:3,  isReferral:false },
    { id:'cand-019', openingId:'job-mkt-001', name:'Anil Kapoor',        email:'anil.kapoor@example.com',     stage:'applied',    rating:0, daysInStage:2,  isReferral:false },
    // DevOps
    { id:'cand-020', openingId:'job-eng-002', name:'Suresh Nair',        email:'suresh.nair@example.com',     stage:'screening',  rating:3, daysInStage:4,  isReferral:false },
    { id:'cand-021', openingId:'job-eng-002', name:'Ananya Pillai',      email:'ananya.pillai@example.com',   stage:'interview',  rating:4, daysInStage:2,  isReferral:true },
    { id:'cand-022', openingId:'job-eng-002', name:'Rajesh Verma',       email:'rajesh.verma@example.com',    stage:'applied',    rating:0, daysInStage:1,  isReferral:false },
    // Frontend
    { id:'cand-023', openingId:'job-eng-003', name:'Kavya Reddy',        email:'kavya.reddy@example.com',     stage:'interview',  rating:4, daysInStage:5,  isReferral:false },
    { id:'cand-024', openingId:'job-eng-003', name:'Mohit Agarwal',      email:'mohit.agarwal@example.com',   stage:'offer',      rating:5, daysInStage:1,  isReferral:true },
    { id:'cand-025', openingId:'job-eng-003', name:'Deepa Krishnan',     email:'deepa.krishnan@example.com',  stage:'screening',  rating:2, daysInStage:3,  isReferral:false },
    { id:'cand-026', openingId:'job-eng-003', name:'Varun Malhotra',     email:'varun.malhotra@example.com',  stage:'applied',    rating:0, daysInStage:2,  isReferral:false },
    // HR BP
    { id:'cand-027', openingId:'job-hr-001',  name:'Ritika Sharma',      email:'ritika.sharma@example.com',   stage:'offer',      rating:5, daysInStage:1,  isReferral:false },
    { id:'cand-028', openingId:'job-hr-001',  name:'Sanjay Dubey',       email:'sanjay.dubey@example.com',    stage:'interview',  rating:3, daysInStage:6,  isReferral:false },
    // Customer Success
    { id:'cand-029', openingId:'job-cs-001',  name:'Tina Saxena',        email:'tina.saxena@example.com',     stage:'interview',  rating:4, daysInStage:3,  isReferral:true },
    { id:'cand-030', openingId:'job-cs-001',  name:'Abhinav Chaudhary',  email:'abhinav@example.com',         stage:'screening',  rating:2, daysInStage:4,  isReferral:false },
    // Security
    { id:'cand-031', openingId:'job-sec-001', name:'Meera Iyer',         email:'meera.iyer@example.com',      stage:'screening',  rating:3, daysInStage:2,  isReferral:false },
    { id:'cand-032', openingId:'job-sec-001', name:'Tarun Singh',        email:'tarun.singh@example.com',     stage:'applied',    rating:0, daysInStage:1,  isReferral:false },
    // Data Analyst
    { id:'cand-033', openingId:'job-data-001',name:'Sneha Patil',        email:'sneha.patil@example.com',     stage:'interview',  rating:4, daysInStage:4,  isReferral:false },
    { id:'cand-034', openingId:'job-data-001',name:'Vivek Mishra',       email:'vivek.mishra@example.com',    stage:'applied',    rating:0, daysInStage:2,  isReferral:false },
    { id:'cand-035', openingId:'job-data-001',name:'Pallavi Jain',       email:'pallavi.jain@example.com',    stage:'screening',  rating:2, daysInStage:5,  isReferral:false },
    // Operations
    { id:'cand-036', openingId:'job-ops-001', name:'Manish Kumar',       email:'manish.kumar@example.com',    stage:'applied',    rating:0, daysInStage:3,  isReferral:false },
    // QA
    { id:'cand-037', openingId:'job-qa-001',  name:'Ritu Bajaj',         email:'ritu.bajaj@example.com',      stage:'screening',  rating:3, daysInStage:3,  isReferral:false },
    { id:'cand-038', openingId:'job-qa-001',  name:'Harsh Thakur',       email:'harsh.thakur@example.com',    stage:'interview',  rating:4, daysInStage:2,  isReferral:true },
    // Solutions Architect (closed)
    { id:'cand-039', openingId:'job-arch-001',name:'Ankit Sharma',       email:'ankit.sharma@example.com',    stage:'hired',      rating:5, daysInStage:0,  isReferral:false },
    { id:'cand-040', openingId:'job-arch-001',name:'Swati Agarwal',      email:'swati.agarwal@example.com',   stage:'offer',      rating:4, daysInStage:0,  isReferral:false },
  ];

  for (const c of candidateDefs) {
    await prisma.candidate.upsert({
      where: { id: c.id },
      update: { stage: c.stage, rating: c.rating, daysInStage: c.daysInStage },
      create: { ...c, tenantId, role: c.name, appliedAt: new Date('2026-05-20') },
    });
  }
  console.log(`  ✓ ${candidateDefs.length} candidates`);

  // ── PERFORMANCE: 2 cycles, 25+ reviews, 20+ goals ────────────────────────
  console.log('\n── PERFORMANCE ──');

  await prisma.performanceCycle.upsert({
    where: { id: 'cycle-h1-2026' },
    update: { progressPct: 58, status: 'In progress' },
    create: { id: 'cycle-h1-2026', tenantId, name: 'H1 2026 Review Cycle',
              selfReviewDue: new Date('2026-06-07'), managerReviewDue: new Date('2026-06-14'),
              calibrationDate: new Date('2026-06-21'), progressPct: 58,
              status: 'In progress', startedAt: new Date('2026-05-15') },
  });

  await prisma.performanceCycle.upsert({
    where: { id: 'cycle-h2-2025' },
    update: {},
    create: { id: 'cycle-h2-2025', tenantId, name: 'H2 2025 Review Cycle',
              selfReviewDue: new Date('2025-12-10'), managerReviewDue: new Date('2025-12-20'),
              calibrationDate: new Date('2025-12-27'), progressPct: 100,
              status: 'Closed', startedAt: new Date('2025-11-15') },
  });
  console.log('  ✓ 2 performance cycles');

  const ratings = ['Exceeds','Strong','Meets','Meets','Meets','Developing','Below'];
  const statuses = ['Calibrated','Calibrated','Manager review','Self review','Not started'];

  // H1 2026 reviews — use up to 25 employees
  const empSubset = allEmployees.slice(0, Math.min(25, allEmployees.length));
  for (let i = 0; i < empSubset.length; i++) {
    const emp = empSubset[i];
    const st = statuses[i % statuses.length];
    const rt = st === 'Calibrated' ? ratings[i % ratings.length] : null;
    await prisma.performanceReview.upsert({
      where: { tenantId_cycleId_employeeId: { tenantId, cycleId: 'cycle-h1-2026', employeeId: emp.id } },
      update: {},
      create: { tenantId, cycleId: 'cycle-h1-2026', employeeId: emp.id,
                reviewerId: emp.managerId || null, status: st, rating: rt,
                selfComplete: st !== 'Not started', managerComplete: st === 'Calibrated' },
    });
  }
  console.log(`  ✓ ${empSubset.length} H1 2026 reviews`);

  // H2 2025 reviews — all Calibrated (closed cycle)
  for (let i = 0; i < Math.min(20, allEmployees.length); i++) {
    const emp = allEmployees[i];
    await prisma.performanceReview.upsert({
      where: { tenantId_cycleId_employeeId: { tenantId, cycleId: 'cycle-h2-2025', employeeId: emp.id } },
      update: {},
      create: { tenantId, cycleId: 'cycle-h2-2025', employeeId: emp.id,
                reviewerId: emp.managerId || null, status: 'Calibrated',
                rating: ratings[i % ratings.length],
                selfComplete: true, managerComplete: true },
    });
  }
  console.log(`  ✓ 20 H2 2025 reviews`);

  const goalTitles = [
    'Ship design-system v2 to all squads',
    'Reduce p95 API latency below 200ms',
    'Launch mobile app v3 — iOS + Android',
    'Hire 5 senior engineers Q2',
    'Migrate auth service to microservices',
    'Run Q2 demand-gen campaign — 500 MQLs',
    'Complete ISO 27001 gap assessment',
    'Deploy observability stack (Grafana + Prom)',
    'Onboard 3 enterprise clients in Q2',
    'Reduce cloud spend by 15%',
    'Launch self-service employee portal v2',
    'Build ML-based attrition prediction model',
    'Document all engineering runbooks',
    'Roll out 360 feedback across all teams',
    'Achieve 95% on-time payroll for 3 months',
    'Set up SIEM and alerting for SOC readiness',
    'Migrate legacy codebase from CJS to ESM',
    'Grow NPS from 38 to 50',
    'Launch referral program — 20 hires',
    'Complete DSAR automation project',
  ];
  const goalStatuses = ['On track','On track','At risk','Done'];
  const progressValues = [80,60,40,100,30,55,70,45,90,20,65,35,85,50,95,15,75,60,100,40];

  for (let i = 0; i < goalTitles.length; i++) {
    const emp = allEmployees[i % allEmployees.length];
    const gid = `goal-rich-${String(i+1).padStart(3,'0')}`;
    await prisma.performanceGoal.upsert({
      where: { id: gid },
      update: {},
      create: {
        id: gid, tenantId,
        cycleId: i < 10 ? 'cycle-h1-2026' : 'cycle-h2-2025',
        employeeId: emp.id,
        title: goalTitles[i],
        progressPct: progressValues[i],
        dueDate: new Date(i < 10 ? '2026-06-30' : '2025-12-31'),
        status: goalStatuses[i % goalStatuses.length],
      },
    });
  }
  console.log(`  ✓ ${goalTitles.length} performance goals`);

  // ── ASSETS: 30 assets, 10 requests ───────────────────────────────────────
  console.log('\n── ASSETS ──');

  const assetDefs = [
    { id:'asset-001', tag:'LAP-0192', name:'MacBook Pro 14" M3',       type:'Laptop',  status:'Assigned',  ai:0, as:'2025-01-15' },
    { id:'asset-002', tag:'MON-0041', name:'Dell 27" 4K Monitor',       type:'Monitor', status:'Available', ai:null, as:null },
    { id:'asset-003', tag:'LAP-0201', name:'ThinkPad X1 Carbon',        type:'Laptop',  status:'Assigned',  ai:1, as:'2025-03-01' },
    { id:'asset-004', tag:'PHN-0088', name:'iPhone 15 Pro',             type:'Phone',   status:'Assigned',  ai:2, as:'2025-06-01' },
    { id:'asset-005', tag:'LAP-0180', name:'MacBook Air M2',            type:'Laptop',  status:'Repair',    ai:null, as:null },
    { id:'asset-006', tag:'MON-0055', name:'LG UltraWide 34"',          type:'Monitor', status:'Available', ai:null, as:null },
    { id:'asset-007', tag:'LAP-0215', name:'Dell XPS 15',               type:'Laptop',  status:'Assigned',  ai:3, as:'2025-08-10' },
    { id:'asset-008', tag:'PHN-0102', name:'Samsung Galaxy S24',        type:'Phone',   status:'Retired',   ai:null, as:null },
    { id:'asset-009', tag:'LAP-0230', name:'MacBook Pro 16" M3 Max',    type:'Laptop',  status:'Available', ai:null, as:null },
    { id:'asset-010', tag:'MON-0062', name:'Samsung 32" Curved',        type:'Monitor', status:'Assigned',  ai:4, as:'2025-09-20' },
    { id:'asset-011', tag:'PHN-0115', name:'iPhone 14',                 type:'Phone',   status:'Available', ai:null, as:null },
    { id:'asset-012', tag:'LAP-0245', name:'HP EliteBook 840',          type:'Laptop',  status:'Assigned',  ai:5, as:'2025-11-01' },
    { id:'asset-013', tag:'LAP-0250', name:'Lenovo IdeaPad Pro',        type:'Laptop',  status:'Repair',    ai:null, as:null },
    { id:'asset-014', tag:'MON-0075', name:'BenQ 27" IPS',              type:'Monitor', status:'Available', ai:null, as:null },
    { id:'asset-015', tag:'OTH-0001', name:'USB-C Docking Station',     type:'Other',   status:'Assigned',  ai:6, as:'2025-12-01' },
    { id:'asset-016', tag:'LAP-0260', name:'MacBook Air M3',            type:'Laptop',  status:'Available', ai:null, as:null },
    { id:'asset-017', tag:'PHN-0130', name:'Pixel 8 Pro',               type:'Phone',   status:'Assigned',  ai:7, as:'2026-01-10' },
    { id:'asset-018', tag:'MON-0090', name:'ASUS ProArt 27"',           type:'Monitor', status:'Repair',    ai:null, as:null },
    { id:'asset-019', tag:'OTH-0010', name:'Logitech MX Keys Keyboard', type:'Other',   status:'Available', ai:null, as:null },
    { id:'asset-020', tag:'LAP-0270', name:'Surface Laptop 5',          type:'Laptop',  status:'Assigned',  ai:8, as:'2026-02-01' },
    { id:'asset-021', tag:'OTH-0020', name:'Ergonomic Chair — Herman Miller', type:'Other', status:'Assigned', ai:9, as:'2025-07-01' },
    { id:'asset-022', tag:'LAP-0280', name:'MacBook Pro 13" M2',        type:'Laptop',  status:'Available', ai:null, as:null },
    { id:'asset-023', tag:'PHN-0145', name:'Samsung S23',               type:'Phone',   status:'Retired',   ai:null, as:null },
    { id:'asset-024', tag:'MON-0100', name:'Dell UltraSharp 24"',       type:'Monitor', status:'Assigned',  ai:10, as:'2026-03-15' },
    { id:'asset-025', tag:'LAP-0290', name:'ASUS ROG Zephyrus',         type:'Laptop',  status:'Repair',    ai:null, as:null },
    { id:'asset-026', tag:'OTH-0030', name:'Jabra Evolve2 Headset',     type:'Other',   status:'Available', ai:null, as:null },
    { id:'asset-027', tag:'PHN-0160', name:'OnePlus 12',                type:'Phone',   status:'Assigned',  ai:11, as:'2026-04-01' },
    { id:'asset-028', tag:'LAP-0300', name:'HP ZBook Studio',           type:'Laptop',  status:'Available', ai:null, as:null },
    { id:'asset-029', tag:'MON-0110', name:'Philips 32" 4K',            type:'Monitor', status:'Available', ai:null, as:null },
    { id:'asset-030', tag:'OTH-0040', name:'iPad Pro 12.9"',            type:'Other',   status:'Assigned',  ai:12, as:'2026-05-01' },
  ];

  for (const a of assetDefs) {
    const emp = a.ai !== null ? allEmployees[a.ai % allEmployees.length] : null;
    await prisma.asset.upsert({
      where: { id: a.id },
      update: {},
      create: {
        id: a.id, tenantId, tag: a.tag, name: a.name, type: a.type, status: a.status,
        assignedToId:   emp ? emp.id : null,
        assignedToName: emp ? `${emp.firstName} ${emp.lastName}` : null,
        assignedSince: a.as,
      },
    });
  }
  console.log(`  ✓ ${assetDefs.length} assets`);

  const reqDefs = [
    { id:'req-001', ai:0, item:'Monitor — 27" 4K',          reason:'New hire setup',         status:'Pending',   date:'2026-05-27' },
    { id:'req-002', ai:1, item:'Keyboard & Mouse',           reason:'Ergonomic upgrade',      status:'Approved',  date:'2026-05-20' },
    { id:'req-003', ai:2, item:'Laptop Dock',                reason:'WFH equipment',          status:'Pending',   date:'2026-06-01' },
    { id:'req-004', ai:3, item:'USB-C Hub',                  reason:'Travel kit',             status:'Fulfilled', date:'2026-05-15' },
    { id:'req-005', ai:4, item:'MacBook Pro 14"',            reason:'Old laptop failing',     status:'Pending',   date:'2026-06-03' },
    { id:'req-006', ai:5, item:'iPhone 15',                  reason:'Work phone refresh',     status:'Approved',  date:'2026-05-28' },
    { id:'req-007', ai:6, item:'Standing Desk Converter',    reason:'Health & ergonomics',    status:'Declined',  date:'2026-05-10' },
    { id:'req-008', ai:7, item:'External SSD 2TB',           reason:'Video editing storage',  status:'Pending',   date:'2026-06-04' },
    { id:'req-009', ai:8, item:'Mechanical Keyboard',        reason:'Developer preference',   status:'Declined',  date:'2026-05-05' },
    { id:'req-010', ai:9, item:'Webcam HD — Logitech C920',  reason:'Improved video calls',   status:'Fulfilled', date:'2026-04-25' },
  ];

  for (const r of reqDefs) {
    const emp = allEmployees[r.ai % allEmployees.length];
    await prisma.assetRequest.upsert({
      where: { id: r.id },
      update: {},
      create: {
        id: r.id, tenantId, item: r.item, reason: r.reason, status: r.status,
        requestedById: emp.id, requestedByName: `${emp.firstName} ${emp.lastName}`,
        requestedAt: new Date(r.date),
      },
    });
  }
  console.log(`  ✓ ${reqDefs.length} asset requests`);

  // ── ANNOUNCEMENTS: 5 channels, 20 announcements, 10 events ───────────────
  console.log('\n── ANNOUNCEMENTS ──');

  const channelDefs = [
    { id:'ch-001', name:'Company-wide',     category:'Company', postCount:142 },
    { id:'ch-002', name:'People & Culture', category:'People',  postCount:89  },
    { id:'ch-003', name:'Product Updates',  category:'Product', postCount:54  },
    { id:'ch-004', name:'IT & Security',    category:'IT',      postCount:31  },
    { id:'ch-005', name:'Office Ops',       category:'Office',  postCount:27  },
  ];

  for (const ch of channelDefs) {
    await prisma.announcementChannel.upsert({
      where: { tenantId_name: { tenantId, name: ch.name } },
      update: { postCount: ch.postCount },
      create: { id: ch.id, tenantId, name: ch.name, category: ch.category, postCount: ch.postCount },
    });
  }
  const channels = await prisma.announcementChannel.findMany({ where: { tenantId } });
  const cm = Object.fromEntries(channels.map(c => [c.name, c.id]));
  console.log(`  ✓ ${channels.length} channels`);

  const annDefs = [
    // Pinned
    { id:'ann-000', ch:'Company-wide',     cat:'Company', title:'🎉 Acme Hits $10M ARR — A Team Milestone', body:'We reached $10M ARR this quarter. Every team member contributed to this milestone. The leadership will share more at Friday\'s all-hands. Thank you for your relentless work!', authorName:'Rahul Sharma', authorRole:'CEO', audience:'All employees', readCount:182, isPinned:true,  date:'2026-05-28' },
    // Feed items — Company-wide
    { id:'ann-001', ch:'Company-wide',     cat:'Company', title:'Welcome 7 New Joiners — June Batch',       body:'Please give a warm welcome to our new colleagues joining this month across Engineering, Design, Sales, and HR. Their onboarding week starts June 10.',                      authorName:'Sunita Verma',  authorRole:'Head of HR',           audience:'All employees', readCount:74,  isPinned:false, date:'2026-06-03' },
    { id:'ann-002', ch:'Company-wide',     cat:'Company', title:'Acme Ranked #12 Best Tech Workplace 2026', body:'We are proud to be ranked 12th on the Great Place to Work list for 2026. This reflects our culture of trust, inclusion, and continuous improvement.',                   authorName:'Rahul Sharma',  authorRole:'CEO',                  audience:'All employees', readCount:159, isPinned:false, date:'2026-05-30' },
    // People & Culture
    { id:'ann-003', ch:'People & Culture', cat:'People',  title:'New Parental Leave: 26 Weeks Paid',        body:'Starting July 1, primary caregivers receive 26 weeks fully paid parental leave; secondary caregivers get 8 weeks. Retroactive for anyone currently on leave.',          authorName:'Sunita Verma',  authorRole:'Head of HR',           audience:'All employees', readCount:95,  isPinned:false, date:'2026-05-25' },
    { id:'ann-004', ch:'People & Culture', cat:'People',  title:'H1 2026 Performance Cycle — Now Open',     body:'Self-reviews are open from May 15 to June 7. Manager reviews run June 8–14. Use the Performance tab in EMS to submit your review.',                                     authorName:'Priya Mehta',   authorRole:'HRBP',                 audience:'All employees', readCount:112, isPinned:false, date:'2026-05-15' },
    { id:'ann-005', ch:'People & Culture', cat:'People',  title:'Learning Budget Refresh — ₹15,000 per Employee', body:'Your annual L&D budget of ₹15,000 has been refreshed. Use it for online courses, books, or conferences. Submit claims through the expense portal.',           authorName:'Sunita Verma',  authorRole:'Head of HR',           audience:'All employees', readCount:88,  isPinned:false, date:'2026-05-12' },
    { id:'ann-006', ch:'People & Culture', cat:'People',  title:'Referral Bonus Doubled — Refer & Earn ₹50K', body:'For this quarter, all successful employee referrals for senior positions earn ₹50,000. Junior positions earn ₹25,000. See open roles in the Recruitment tab.',       authorName:'Sunita Verma',  authorRole:'Head of HR',           audience:'All employees', readCount:204, isPinned:false, date:'2026-05-08' },
    // Product Updates
    { id:'ann-007', ch:'Product Updates',  cat:'Product', title:'EMS v2.4 — Payroll Module Now Live',       body:'The Payroll module is live. HR admins can run payroll, manage salary components, and generate payslips. Training sessions run June 3–5. Check the calendar.',          authorName:'Aman Khanna',   authorRole:'Engineering Manager',  audience:'All employees', readCount:67,  isPinned:false, date:'2026-05-22' },
    { id:'ann-008', ch:'Product Updates',  cat:'Product', title:'EMS v2.5 Preview — Recruitment & Assets',  body:'Phase 3 of EMS is in testing — Recruitment pipeline, Asset management, Performance reviews, and Company announcements. Target launch: June 2026.',                    authorName:'Aman Khanna',   authorRole:'Engineering Manager',  audience:'All employees', readCount:43,  isPinned:false, date:'2026-06-01' },
    { id:'ann-009', ch:'Product Updates',  cat:'Product', title:'Mobile App Update — Attendance on iOS',    body:'The EMS mobile app v1.8 is available on the App Store. New features: one-tap check-in, leave balance widget, and push notifications for approvals.',                    authorName:'Deepa Rao',     authorRole:'Product Manager',      audience:'All employees', readCount:131, isPinned:false, date:'2026-05-20' },
    // IT & Security
    { id:'ann-010', ch:'IT & Security',    cat:'IT',      title:'Mandatory Security Training by June 15',   body:'All employees must complete the annual security awareness training by June 15. The 45-minute course covers phishing, password hygiene, and data handling. Link on Slack.', authorName:'Deepak Nair',   authorRole:'IT Manager',           audience:'All employees', readCount:44,  isPinned:false, date:'2026-05-20' },
    { id:'ann-011', ch:'IT & Security',    cat:'IT',      title:'VPN Upgrade Scheduled — June 8, 2–4 PM',   body:'The corporate VPN will be upgraded on June 8 between 2–4 PM IST. Save your work and disconnect before 2 PM. The new version has improved speed and MFA support.',      authorName:'Deepak Nair',   authorRole:'IT Manager',           audience:'All employees', readCount:62,  isPinned:false, date:'2026-06-02' },
    { id:'ann-012', ch:'IT & Security',    cat:'IT',      title:'New SSO Login for All Internal Tools',     body:'Single Sign-On is now live for Slack, Jira, Confluence, and Figma. Use your @acme.test email. Legacy passwords expire June 30. Reset instructions sent to your inbox.',  authorName:'Deepak Nair',   authorRole:'IT Manager',           audience:'All employees', readCount:178, isPinned:false, date:'2026-05-18' },
    // Office Ops
    { id:'ann-013', ch:'Office Ops',       cat:'Office',  title:'Bengaluru Floor 3 Closed — June 10–20',    body:'Floor 3 of the Bengaluru office will be closed for renovation June 10–20. Use hot-desking on floor 2. Bookings via the office portal. Sorry for the inconvenience.',   authorName:'Kavita Reddy',  authorRole:'Office Manager',       audience:'Bengaluru',    readCount:28,  isPinned:false, date:'2026-05-18' },
    { id:'ann-014', ch:'Office Ops',       cat:'Office',  title:'New Pantry Hours — 8 AM to 8 PM',          body:'The office pantry will now be open from 8 AM to 8 PM on weekdays. Complimentary breakfast is available 8–10 AM. Snack bar restocked every Monday.',                    authorName:'Kavita Reddy',  authorRole:'Office Manager',       audience:'All employees', readCount:55,  isPinned:false, date:'2026-05-14' },
    { id:'ann-015', ch:'Office Ops',       cat:'Office',  title:'Team Offsite — Coorg — June 25–26',        body:'The Bengaluru team offsite is set for June 25–26 in Coorg. Travel and accommodation are covered. RSVP by June 15. Activities include team-building games and a dinner.',  authorName:'Sunita Verma',  authorRole:'Head of HR',           audience:'Bengaluru',    readCount:91,  isPinned:false, date:'2026-06-01' },
  ];

  for (const a of annDefs) {
    const chId = cm[a.ch];
    if (!chId) { console.warn(`    ⚠ Channel "${a.ch}" not found, skipping ${a.id}`); continue; }
    await prisma.announcement.upsert({
      where: { id: a.id },
      update: { readCount: a.readCount, isPinned: a.isPinned },
      create: { id: a.id, tenantId, channelId: chId, category: a.cat, title: a.title,
                body: a.body, authorName: a.authorName, authorRole: a.authorRole,
                audience: a.audience, readCount: a.readCount, isPinned: a.isPinned,
                postedAt: new Date(a.date) },
    });
  }
  console.log(`  ✓ ${annDefs.length} announcements`);

  const eventDefs = [
    { id:'ev-001', date:'2026-06-02', title:'Q2 All-Hands',                meta:'4:00 PM · Main hall + Zoom' },
    { id:'ev-002', date:'2026-06-07', title:'Self-Review Deadline',         meta:'Performance cycle closes' },
    { id:'ev-003', date:'2026-06-08', title:'VPN Maintenance Window',       meta:'2:00–4:00 PM IST' },
    { id:'ev-004', date:'2026-06-10', title:'Bengaluru Renovation Starts',  meta:'Floor 3 closed until Jun 20' },
    { id:'ev-005', date:'2026-06-14', title:'Manager Review Deadline',      meta:'H1 2026 cycle step 2' },
    { id:'ev-006', date:'2026-06-15', title:'Security Training Deadline',   meta:'Mandatory — all employees' },
    { id:'ev-007', date:'2026-06-20', title:'Bengaluru Renovation Ends',    meta:'Floor 3 reopens' },
    { id:'ev-008', date:'2026-06-21', title:'H1 Calibration Meeting',       meta:'10:00 AM · Conference Room A' },
    { id:'ev-009', date:'2026-06-25', title:'Team Offsite — Coorg',         meta:'2 days · All Bengaluru team' },
    { id:'ev-010', date:'2026-06-30', title:'Q2 Close',                     meta:'Finance team deadline' },
  ];

  for (const e of eventDefs) {
    await prisma.announcementEvent.upsert({
      where: { id: e.id },
      update: {},
      create: { id: e.id, tenantId, date: e.date, title: e.title, meta: e.meta },
    });
  }
  console.log(`  ✓ ${eventDefs.length} events`);

  console.log('\n✅ Phase 3 RICH seed complete!');
  console.log('   Recruitment : 15 openings, 40 candidates');
  console.log('   Performance : 2 cycles, 45 reviews, 20 goals');
  console.log('   Assets      : 30 assets, 10 requests');
  console.log('   Announcements: 5 channels, 15 announcements, 10 events');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
