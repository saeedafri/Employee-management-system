-- HOLIDAY_ENGINE_BACKEND_CONTRACT §2.4 — make HolidayPolicy effective-dated / versioned
-- (same model as StatutoryPack). ADDITIVE + data-safe: existing single rows become v1 with
-- effectiveFrom = epoch (so they keep covering all dates) and effectiveTo = NULL (open).

-- 1. Add columns (idempotent). effectiveFrom is added nullable first, backfilled, then NOT NULL.
ALTER TABLE "HolidayPolicy" ADD COLUMN IF NOT EXISTS "version" TEXT NOT NULL DEFAULT 'v1';
ALTER TABLE "HolidayPolicy" ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3);
ALTER TABLE "HolidayPolicy" ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3);

-- 2. Backfill existing rows so they cover all time, then enforce NOT NULL + a now() default.
UPDATE "HolidayPolicy" SET "effectiveFrom" = TIMESTAMP '1970-01-01 00:00:00' WHERE "effectiveFrom" IS NULL;
ALTER TABLE "HolidayPolicy" ALTER COLUMN "effectiveFrom" SET NOT NULL;
ALTER TABLE "HolidayPolicy" ALTER COLUMN "effectiveFrom" SET DEFAULT CURRENT_TIMESTAMP;

-- 3. Swap the unique constraint: (tenantId, countryCode) -> (tenantId, countryCode, effectiveFrom).
DROP INDEX IF EXISTS "HolidayPolicy_tenantId_countryCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "HolidayPolicy_tenantId_countryCode_effectiveFrom_key"
  ON "HolidayPolicy"("tenantId", "countryCode", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "HolidayPolicy_tenantId_countryCode_idx"
  ON "HolidayPolicy"("tenantId", "countryCode");
