/**
 * Timesheet seed — 6 projects, 12 tasks, 8 weeks of entries for 12+ employees.
 * Safe to re-run: skips existing timesheets/entries.
 * Run: node prisma/seedTimesheets.js
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TENANT_KEY = 'acme-corp-001';

function weekStart(offsetWeeks = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
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

  // ── Settings ─────────────────────────────────────────────────────────────
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

  // ── 6 Projects ───────────────────────────────────────────────────────────
  const projects = [
    { id: 'prj-seed-1', name: 'Acme Mobile App', code: 'AMA', clientName: 'Acme Inc', billable: true, defaultRate: 4500 },
    { id: 'prj-seed-2', name: 'Internal Portal', code: 'INT', clientName: null, billable: false, defaultRate: 0 },
    { id: 'prj-seed-3', name: 'Data Analytics Platform', code: 'DAP', clientName: 'Beta Corp', billable: true, defaultRate: 5500 },
    { id: 'prj-seed-4', name: 'DevOps Infrastructure', code: 'DEV', clientName: null, billable: false, defaultRate: 0 },
    { id: 'prj-seed-5', name: 'Customer Portal v2', code: 'CPV2', clientName: 'Gamma Ltd', billable: true, defaultRate: 6000 },
    { id: 'prj-seed-6', name: 'Compliance & Audit', code: 'COMP', clientName: null, billable: false, defaultRate: 0 },
  ];

  for (const p of projects) {
    await prisma.timesheetProject.upsert({
      where: { id: p.id },
      update: { name: p.name, status: 'ACTIVE' },
      create: { ...p, tenantId, status: 'ACTIVE', memberIds: '[]' },
    });
  }

  // ── 12 Tasks ─────────────────────────────────────────────────────────────
  const tasks = [
    { id: 'tsk-seed-1',  projectId: 'prj-seed-1', name: 'Sprint Board',       billable: true },
    { id: 'tsk-seed-2',  projectId: 'prj-seed-1', name: 'Bug Fixes',           billable: true },
    { id: 'tsk-seed-3',  projectId: 'prj-seed-1', name: 'Code Review',         billable: true },
    { id: 'tsk-seed-4',  projectId: 'prj-seed-2', name: 'Pipeline Fix',        billable: false },
    { id: 'tsk-seed-5',  projectId: 'prj-seed-2', name: 'Documentation',       billable: false },
    { id: 'tsk-seed-6',  projectId: 'prj-seed-3', name: 'Feature Dev',         billable: true },
    { id: 'tsk-seed-7',  projectId: 'prj-seed-3', name: 'Testing',             billable: true },
    { id: 'tsk-seed-8',  projectId: 'prj-seed-4', name: 'CI/CD Setup',         billable: false },
    { id: 'tsk-seed-9',  projectId: 'prj-seed-5', name: 'UI Implementation',   billable: true },
    { id: 'tsk-seed-10', projectId: 'prj-seed-5', name: 'API Integration',     billable: true },
    { id: 'tsk-seed-11', projectId: 'prj-seed-6', name: 'Policy Review',       billable: false },
    { id: 'tsk-seed-12', projectId: 'prj-seed-6', name: 'Audit Preparation',   billable: false },
  ];

  for (const t of tasks) {
    await prisma.timesheetTask.upsert({
      where: { id: t.id },
      update: { name: t.name, active: true },
      create: { ...t, tenantId, active: true },
    });
  }

  // ── Employees ─────────────────────────────────────────────────────────────
  const employees = await prisma.employee.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    take: 15,
  });

  if (employees.length === 0) {
    console.log('No employees found — run the base seed first');
    return;
  }

  // Per-weekday entry templates — spreads work across all 6 projects
  const entryTemplates = [
    { day: 0, projectId: 'prj-seed-1', taskId: 'tsk-seed-1', hours: 8,   billable: true,  note: 'Sprint planning + dev' },
    { day: 1, projectId: 'prj-seed-1', taskId: 'tsk-seed-2', hours: 7.5, billable: true,  note: 'Bug fixes' },
    { day: 1, projectId: 'prj-seed-2', taskId: 'tsk-seed-4', hours: 0.5, billable: false, note: 'Pipeline maintenance' },
    { day: 2, projectId: 'prj-seed-3', taskId: 'tsk-seed-6', hours: 6,   billable: true,  note: 'Feature implementation' },
    { day: 2, projectId: 'prj-seed-5', taskId: 'tsk-seed-9', hours: 2,   billable: true,  note: 'UI work' },
    { day: 3, projectId: 'prj-seed-1', taskId: 'tsk-seed-3', hours: 5,   billable: true,  note: 'Code review' },
    { day: 3, projectId: 'prj-seed-4', taskId: 'tsk-seed-8', hours: 3,   billable: false, note: 'CI/CD work' },
    { day: 4, projectId: 'prj-seed-3', taskId: 'tsk-seed-7', hours: 6,   billable: true,  note: 'QA testing' },
    { day: 4, projectId: 'prj-seed-6', taskId: 'tsk-seed-11',hours: 2,   billable: false, note: 'Compliance review' },
  ];

  // 8 weeks: current + 7 prior
  const weekOffsets = [0, -1, -2, -3, -4, -5, -6, -7];

  let timesheetCount = 0;
  let entryCount = 0;

  for (const emp of employees) {
    const empIdx = employees.indexOf(emp);

    for (const weekOffset of weekOffsets) {
      const monday = weekStart(weekOffset);
      const sunday = weekEnd(monday);

      const existing = await prisma.timesheet.findFirst({
        where: { tenantId, employeeId: emp.id, weekStart: monday },
      });
      if (existing) continue;

      // Vary hours: odd employees log slightly more, adding overtime in older weeks
      const variance = (empIdx % 4) * 0.25;
      const isOvertimeWeek = weekOffset <= -4 && empIdx % 3 === 0;
      const overtimeExtra = isOvertimeWeek ? 4 : 0;
      const totalHours = entryTemplates.reduce((s, t) => s + t.hours, 0) - variance + overtimeExtra;

      // Status: current=DRAFT, -1=SUBMITTED, older=APPROVED
      let status = 'DRAFT';
      if (weekOffset === -1) status = 'SUBMITTED';
      if (weekOffset <= -2) status = 'APPROVED';

      const sheet = await prisma.timesheet.create({
        data: {
          tenantId,
          employeeId: emp.id,
          weekStart: monday,
          weekEnd: sunday,
          status,
          totalHours,
          submittedAt: weekOffset <= -1 ? new Date(monday + 'T09:00:00Z') : null,
          decidedBy: weekOffset <= -2 ? 'HR Admin' : null,
          decidedAt: weekOffset <= -2 ? new Date(monday + 'T17:00:00Z') : null,
          comment: null,
        },
      });
      timesheetCount++;

      for (const tmpl of entryTemplates) {
        const date = addDays(monday, tmpl.day);
        let hours = tmpl.hours - (tmpl.day === 0 ? variance : 0);
        if (isOvertimeWeek && tmpl.day === 4 && tmpl.billable) hours += overtimeExtra;
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

  console.log(`✓ Timesheet seed: ${timesheetCount} timesheets, ${entryCount} entries for ${employees.length} employees, 6 projects, 12 tasks, 8 weeks`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
