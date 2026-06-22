-- Holiday Policy (Phase 7.2): per-country restricted-limit + observed-rule + optional selections.
-- ADDITIVE + IDEMPOTENT: CREATE TABLE IF NOT EXISTS + guarded FKs. Nothing dropped/altered.

-- ── HolidayPolicy ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "HolidayPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "restrictedLimit" INTEGER NOT NULL DEFAULT 0,
    "observedRule" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HolidayPolicy_tenantId_countryCode_key" ON "HolidayPolicy"("tenantId", "countryCode");
CREATE INDEX IF NOT EXISTS "HolidayPolicy_tenantId_idx" ON "HolidayPolicy"("tenantId");

-- ── HolidayOptionalSelection ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "HolidayOptionalSelection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "holidayId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HolidayOptionalSelection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HolidayOptionalSelection_tenantId_employeeId_holidayId_key" ON "HolidayOptionalSelection"("tenantId", "employeeId", "holidayId");
CREATE INDEX IF NOT EXISTS "HolidayOptionalSelection_tenantId_employeeId_year_idx" ON "HolidayOptionalSelection"("tenantId", "employeeId", "year");

-- ── Foreign keys (guarded — ADD CONSTRAINT has no IF NOT EXISTS) ──────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'HolidayPolicy_tenantId_fkey') THEN
    ALTER TABLE "HolidayPolicy" ADD CONSTRAINT "HolidayPolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'HolidayOptionalSelection_tenantId_fkey') THEN
    ALTER TABLE "HolidayOptionalSelection" ADD CONSTRAINT "HolidayOptionalSelection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'HolidayOptionalSelection_employeeId_fkey') THEN
    ALTER TABLE "HolidayOptionalSelection" ADD CONSTRAINT "HolidayOptionalSelection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
