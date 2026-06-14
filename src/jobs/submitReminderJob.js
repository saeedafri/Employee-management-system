// M7 — Timesheet submit-reminder scheduled job.
//
// No HTTP endpoint: the FE renders the in-app nudge from the notifications it creates.
// Designed to be invoked once a day by a Render Cron Job (or `node src/jobs/submitReminderJob.js`).
//
// Per tenant, only when today's ISO weekday === TimesheetSettings.submitReminderDay
// (null = disabled), it nudges, for the PRIOR week:
//   • employees whose timesheet is DRAFT (with logged hours) or REJECTED, and
//   • managers/HR when timesheets are SUBMITTED and awaiting approval.
// Idempotent per (user, week) — re-running the same day never duplicates.
//
// Flags:
//   --force            ignore the day-of-week gate (fire regardless of submitReminderDay)
//   --tenant=<id>      restrict to a single tenant
//
import 'dotenv/config';
import { runSubmitReminders } from '../modules/timesheets/timesheets.service.js';
import { prisma } from '../plugins/prisma.js';
import { logger } from '../utils/logger.js';

function parseArgs(argv) {
  const force = argv.includes('--force');
  const tenantArg = argv.find((a) => a.startsWith('--tenant='));
  return { force, tenantId: tenantArg ? tenantArg.split('=')[1] : null };
}

export async function main(argv = process.argv.slice(2)) {
  const { force, tenantId } = parseArgs(argv);
  const now = new Date();
  logger.info({ now: now.toISOString(), force, tenantId }, 'timesheet submit-reminder job: start');

  const results = await runSubmitReminders({ now, force, tenantId });
  const totals = results.reduce(
    (acc, r) => ({
      employeeReminders: acc.employeeReminders + (r.employeeReminders || 0),
      approverReminders: acc.approverReminders + (r.approverReminders || 0),
    }),
    { employeeReminders: 0, approverReminders: 0 },
  );
  logger.info(
    { tenants: results.length, ...totals, results },
    'timesheet submit-reminder job: done',
  );
  return { results, totals };
}

// Run only when invoked directly (not when imported by tests).
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('submitReminderJob.js');
if (invokedDirectly) {
  main()
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch(async (err) => {
      logger.error({ err }, 'timesheet submit-reminder job: failed');
      await prisma.$disconnect().catch(() => {});
      process.exit(1);
    });
}
