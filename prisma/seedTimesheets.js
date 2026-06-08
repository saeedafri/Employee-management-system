/**
 * Timesheet seed — creates projects, tasks, and rich timesheet entries for all
 * demo employees covering the last 4 weeks (including the current week).
 * Safe to re-run: upserts projects/tasks, skips existing timesheets.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_KEY = 'acme-corp-001';

// Monday of a given week offset (0 = current week, -1 = last week, etc.)
function weekStart(offsetWeeks = 0) {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // days to Monday
  d.setDate(d.getDate() + diff + offsetWeeks * 7);
  return d.toISOString().slice(0, 10);
}

function weekEnd(monday) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { tenantKey: TENANT_KEY } });
  if (!tenant) throw new Error(`Tenant '${TENANT_KEY}' not found`);
  const tenantId = tenant.id;

  // ── Timesheet settings ───────────────────────────────────────────────────
  await prisma.timesheetSettings.upsert({
    where: { tenantId },
    update: {},
    create: {
      tenantId,
      standardWeeklyHours: 40,
      overtimeThresholdHours: 40,
      roundingMinutes: 15,
      approvalRequired: true,
      unloggedHoursPolicy: 'FLAG',
      billableDefault: true,
    },
  });

  // ── Projects ─────────────────────────────────────────────────────────────
  const projects = [
    { id: 'prj-seed-1', name: 'Acme Mobile App', code: 'AMA', clientName: 'Acme Inc', billable: true, defaultRate: 4500 },
    { id: 'prj-seed-2', name: 'Internal Portal', code: 'INT', clientName: null, billable: false, defaultRate: 0 },
    { id: 'prj-seed-3', name: 'Data Analytics Platform', code: 'DAP', clientName: 'Beta Corp', billable: true, defaultRate: 5500 },
    { id: 'prj-seed-4', name: 'DevOps Infrastructure', code: 'DEV', clientName: null, billable: false, defaultRate: 0 },
  ];

  for (const p of projects) {
    await prisma.timesheetProject.upsert({
      where: { id: p.id },
      update: { name: p.name, status: 'ACTIVE', memberIds: '[]' },
      create: { ...p, tenantId, status: 'ACTIVE', memberIds: '[]' },
    });
  }

  // ── Tasks ────────────────────────────────────────────────────────────────
  const tasks = [
    { id: 'tsk-seed-1', projectId: 'prj-seed-1', name: 'Sprint Board', billable: true },
    { id: 'tsk-seed-2', projectId: 'prj-seed-1', name: 'Bug Fixes', billable: true },
    { id: 'tsk-seed-3', projectId: 'prj-seed-1', name: 'Code Review', billable: true },
    { id: 'tsk-seed-4', projectId: 'prj-seed-2', name: 'Pipeline Fix', billable: false },
    { id: 'tsk-seed-5', projectId: 'prj-seed-2', name: 'Documentation', billable: false },
    { id: 'tsk-seed-6', projectId: 'prj-seed-3', name: 'Feature Dev', billable: true },
    { id: 'tsk-seed-7', projectId: 'prj-seed-3', name: 'Testing', billable: true },
    { id: 'tsk-seed-8', projectId: 'prj-seed-4', name: 'CI/CD Setup', billable: false },
  ];

  for (const t of tasks) {
    await prisma.timesheetTask.upsert({
      where: { id: t.id },
      update: { name: t.name, active: true },
      create: { ...t, tenantId, active: true },
    });
  }

  // ── Employees to seed for ─────────────────────────────────────────────────
  // Get employees linked to the tenant
  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    take: 12,
  });

  if (employees.length === 0) {
    console.log('No employees found — run the base seed first');
    return;
  }

  // Entry templates per weekday (0=Mon … 4=Fri)
  const entryTemplates = [
    { day: 0, projectId: 'prj-seed-1', taskId: 'tsk-seed-1', hours: 8, billable: true, note: 'Sprint planning + dev' },
    { day: 1, projectId: 'prj-seed-1', taskId: 'tsk-seed-2', hours: 7.5, billable: true, note: 'Bug fixes' },
    { day: 1, projectId: 'prj-seed-2', taskId: 'tsk-seed-4', hours: 0.5, billable: false, note: 'Pipeline maintenance' },
    { day: 2, projectId: 'prj-seed-3', taskId: 'tsk-seed-6', hours: 8, billable: true, note: 'Feature implementation' },
    { day: 3, projectId: 'prj-seed-1', taskId: 'tsk-seed-3', hours: 6, billable: true, note: 'Code review' },
    { day: 3, projectId: 'prj-seed-4', taskId: 'tsk-seed-8', hours: 2, billable: false, note: 'CI/CD work' },
    { day: 4, projectId: 'prj-seed-3', taskId: 'tsk-seed-7', hours: 8, billable: true, note: 'QA testing' },
  ];

  const weeks = [0, -1, -2, -3]; // current + 3 prior weeks

  let timesheetCount = 0;
  let entryCount = 0;

  for (const emp of employees) {
    for (const weekOffset of weeks) {
      const monday = weekStart(weekOffset);
      const sunday = weekEnd(monday);

      // Vary hours slightly per employee (hash by emp index for determinism)
      const empIdx = employees.indexOf(emp);
      const variance = (empIdx % 3) * 0.5; // 0, 0.5, or 1 hour variance

      // Skip if already exists
      const existing = await prisma.timesheet.findFirst({
        where: { tenantId, employeeId: emp.id, weekStart: monday },
      });
      if (existing) continue;

      // Calculate totals
      const totalHours = entryTemplates.reduce((s, t) => s + t.hours, 0) - variance;

      const sheet = await prisma.timesheet.create({
        data: {
          tenantId,
          employeeId: emp.id,
          weekStart: monday,
          weekEnd: sunday,
          status: weekOffset < -1 ? 'APPROVED' : weekOffset === -1 ? 'SUBMITTED' : 'DRAFT',
          totalHours,
          submittedAt: weekOffset <= -1 ? new Date(monday + 'T09:00:00Z') : null,
          decidedBy: weekOffset < -1 ? 'HR Admin' : null,
          decidedAt: weekOffset < -1 ? new Date(monday + 'T17:00:00Z') : null,
          comment: null,
        },
      });
      timesheetCount++;

      // Create entries
      for (const tmpl of entryTemplates) {
        const date = addDays(monday, tmpl.day);
        const hours = tmpl.hours - (tmpl.day === 0 ? variance : 0); // only vary Monday
        if (hours <= 0) continue;
        await prisma.timeEntry.create({
          data: {
            tenantId,
            timesheetId: sheet.id,
            employeeId: emp.id,
            projectId: tmpl.projectId,
            taskId: tmpl.taskId,
            date,
            hours,
            billable: tmpl.billable,
            note: tmpl.note,
            source: 'MANUAL',
          },
        });
        entryCount++;
      }
    }
  }

  console.log(`✓ Timesheet seed complete: ${timesheetCount} timesheets, ${entryCount} entries across ${employees.length} employees`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
