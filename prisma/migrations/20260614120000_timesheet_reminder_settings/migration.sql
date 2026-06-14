-- M7 / M2 timesheet self-service settings.
-- Additive and idempotent: safe to run against an already-patched database.

ALTER TABLE "TimesheetSettings" ADD COLUMN IF NOT EXISTS "submitReminderDay" INTEGER;
ALTER TABLE "TimesheetSettings" ADD COLUMN IF NOT EXISTS "requireTaskOnEntry" BOOLEAN NOT NULL DEFAULT false;
