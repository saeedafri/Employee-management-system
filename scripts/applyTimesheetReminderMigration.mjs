// Applies the additive M7/M2 timesheet migrations to the connected database WITHOUT
// `prisma migrate` (all statements are additive + idempotent — nothing is ever dropped
// or deleted), then records each migration in _prisma_migrations so a later
// `prisma migrate deploy` stays consistent. Safe to re-run.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = [
  '20260614120000_timesheet_reminder_settings',
  '20260614130000_timesheet_reminder_dedupe_index',
];

const prisma = new PrismaClient();

function statements(name) {
  const sql = readFileSync(join(__dirname, '..', 'prisma', 'migrations', name, 'migration.sql'), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  // Split on ';' at end of line; ignore comment-only / blank fragments.
  const stmts = sql
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s && !s.split('\n').every((l) => l.trim().startsWith('--') || l.trim() === ''));
  return { stmts, checksum };
}

async function guardNoDuplicateReminders() {
  const dupes = await prisma.$queryRawUnsafe(`
    SELECT "tenantId", "userId", "type", ("metadataJson" ->> 'weekStart') AS week, COUNT(*)::int AS n
    FROM "Notification"
    WHERE "type" IN ('timesheet_submit_reminder', 'timesheet_approval_reminder')
    GROUP BY 1,2,3,4 HAVING COUNT(*) > 1
  `);
  if (dupes.length > 0) {
    throw new Error(
      `Cannot create unique reminder index: ${dupes.length} pre-existing duplicate (user,type,week) reminder group(s) found. ` +
      `These must be de-duplicated first (this script never deletes data).`,
    );
  }
}

async function run() {
  for (const name of MIGRATIONS) {
    const { stmts, checksum } = statements(name);

    if (name.endsWith('dedupe_index')) await guardNoDuplicateReminders();

    for (const stmt of stmts) await prisma.$executeRawUnsafe(stmt);
    console.log(`✔ Applied: ${name} (${stmts.length} statement(s))`);

    const existing = await prisma.$queryRawUnsafe(
      `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1`, name,
    );
    if (existing.length === 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES ($1, $2, now(), $3, NULL, NULL, now(), 1)`,
        randomUUID(), checksum, name,
      );
      console.log(`  ↳ recorded in _prisma_migrations`);
    } else {
      console.log(`  ↳ already recorded — skipped`);
    }
  }

  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='TimesheetSettings' AND column_name IN ('submitReminderDay','requireTaskOnEntry') ORDER BY column_name`,
  );
  const idx = await prisma.$queryRawUnsafe(
    `SELECT indexname FROM pg_indexes WHERE indexname = 'Notification_tsreminder_week_key'`,
  );
  console.log('Verified columns:', cols.map((c) => c.column_name).join(', '));
  console.log('Verified index:', idx.length ? idx[0].indexname : 'MISSING');
}

run()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => { console.error('✖', e.message); await prisma.$disconnect(); process.exit(1); });
