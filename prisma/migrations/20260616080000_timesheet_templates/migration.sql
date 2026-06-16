-- Timesheet weekly templates (UI PR #9). Additive + idempotent: safe to run against an
-- already-patched database. Nothing is ever dropped or deleted.

-- CreateTable
CREATE TABLE IF NOT EXISTS "TimesheetTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rows" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TimesheetTemplate_tenantId_idx" ON "TimesheetTemplate"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TimesheetTemplate_employeeId_idx" ON "TimesheetTemplate"("employeeId");

-- AddForeignKey (guarded — ADD CONSTRAINT has no IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TimesheetTemplate_tenantId_fkey'
  ) THEN
    ALTER TABLE "TimesheetTemplate"
      ADD CONSTRAINT "TimesheetTemplate_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
