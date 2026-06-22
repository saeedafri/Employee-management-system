-- Legal-entity per-entity working time (Phase 6.2 — WORK_WEEK_BACKEND_CONTRACT §2.1).
-- ADDITIVE + IDEMPOTENT: nullable columns on LegalEntity. Nothing dropped/altered.

ALTER TABLE "LegalEntity" ADD COLUMN IF NOT EXISTS "workWeekDays" JSONB;
ALTER TABLE "LegalEntity" ADD COLUMN IF NOT EXISTS "hoursPerDay" INTEGER;
