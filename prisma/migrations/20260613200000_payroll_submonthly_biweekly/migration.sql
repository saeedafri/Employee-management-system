-- Migration: payroll_submonthly_biweekly
-- Adds SEMI_MONTHLY to PaySchedule enum and adds cycle date fields to PayrollRun.
-- Safe: all new columns are nullable; enum addition is additive only.

-- 1. Add SEMI_MONTHLY to PaySchedule enum (PostgreSQL requires ALTER TYPE ... ADD VALUE)
ALTER TYPE "PaySchedule" ADD VALUE IF NOT EXISTS 'SEMI_MONTHLY';

-- 2. Add cycle date fields and paySchedule to PayrollRun
ALTER TABLE "PayrollRun"
  ADD COLUMN IF NOT EXISTS "startDate"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endDate"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payDate"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paySchedule" TEXT;

-- 3. Index for range queries (YTD, cycle lookup)
CREATE INDEX IF NOT EXISTS "PayrollRun_tenantId_startDate_idx"
  ON "PayrollRun" ("tenantId", "startDate");

-- 4. Work-week pattern on LegalEntity (drives cycle working-day counts; default Mon–Fri).
--    NOT NULL with a default so existing rows backfill safely.
ALTER TABLE "LegalEntity"
  ADD COLUMN IF NOT EXISTS "workWeekPattern" TEXT NOT NULL DEFAULT 'MON-FRI';
