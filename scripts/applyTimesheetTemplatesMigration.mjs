// Applies the additive TimesheetTemplate migration to the connected database WITHOUT
// `prisma migrate` (every statement is additive + idempotent — nothing is ever dropped or
// deleted), then records it in _prisma_migrations so a later `prisma migrate deploy` stays
// consistent. Safe to re-run.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NAME = '20260616080000_timesheet_templates';
const prisma = new PrismaClient();

// Explicit statements (the migration.sql contains a $$-quoted DO block that a naive
// ';'-splitter would mangle, so we run discrete statements here and use the file only
// for the Prisma checksum).
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "TimesheetTemplate" (
     "id" TEXT NOT NULL,
     "tenantId" TEXT NOT NULL,
     "employeeId" TEXT NOT NULL,
     "name" TEXT NOT NULL,
     "rows" TEXT NOT NULL DEFAULT '[]',
     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" TIMESTAMP(3) NOT NULL,
     CONSTRAINT "TimesheetTemplate_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "TimesheetTemplate_tenantId_idx" ON "TimesheetTemplate"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "TimesheetTemplate_employeeId_idx" ON "TimesheetTemplate"("employeeId")`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'TimesheetTemplate_tenantId_fkey'
     ) THEN
       ALTER TABLE "TimesheetTemplate"
         ADD CONSTRAINT "TimesheetTemplate_tenantId_fkey"
         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
     END IF;
   END$$`,
];

async function run() {
  // Hard guard: this script only ever creates. Refuse genuinely destructive statements
  // (DROP/TRUNCATE/DELETE FROM) — but NOT the "ON DELETE CASCADE" FK clause.
  for (const s of STATEMENTS) {
    if (/\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT|SCHEMA|DATABASE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(s)) {
      throw new Error('Refusing: destructive statement detected');
    }
  }

  for (const stmt of STATEMENTS) await prisma.$executeRawUnsafe(stmt);
  console.log(`✔ Applied: ${NAME} (${STATEMENTS.length} statement(s))`);

  const sql = readFileSync(join(__dirname, '..', 'prisma', 'migrations', NAME, 'migration.sql'), 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const existing = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1`, NAME,
  );
  if (existing.length === 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
       VALUES ($1, $2, now(), $3, NULL, NULL, now(), 1)`,
      randomUUID(), checksum, NAME,
    );
    console.log('  ↳ recorded in _prisma_migrations');
  } else {
    console.log('  ↳ already recorded — skipped');
  }

  const cols = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='TimesheetTemplate' ORDER BY ordinal_position`,
  );
  console.log('Verified TimesheetTemplate columns:', cols.map((c) => c.column_name).join(', ') || 'MISSING');
}

run()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (e) => { console.error('✖', e.message); await prisma.$disconnect(); process.exit(1); });
