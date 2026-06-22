-- Tenant-level work-week (truly-global) on TenantConfig.
-- Additive only: new column with a safe default + a nullable JSON override.
-- Read by non-payroll modules (attendance team grid, timesheets week-start);
-- payroll keeps its per-LegalEntity work-week.
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "workWeekPattern" TEXT NOT NULL DEFAULT 'MON-FRI';
ALTER TABLE "TenantConfig" ADD COLUMN IF NOT EXISTS "workWeekDays" JSONB;
