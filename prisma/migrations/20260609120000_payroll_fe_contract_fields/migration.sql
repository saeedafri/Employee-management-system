-- LegalEntity.active for UI status badges
ALTER TABLE "LegalEntity"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- PayCalendar scheduling fields for frontend PayCalendar shape
ALTER TABLE "PayCalendar"
  ADD COLUMN IF NOT EXISTS "legalEntityId" TEXT,
  ADD COLUMN IF NOT EXISTS "periodAnchor" TEXT DEFAULT 'MONTH_START',
  ADD COLUMN IF NOT EXISTS "payDateRule" TEXT DEFAULT 'LAST_WORKING_DAY',
  ADD COLUMN IF NOT EXISTS "payDay" INTEGER,
  ADD COLUMN IF NOT EXISTS "cutoffDay" INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS "holidayCalendarId" TEXT;

UPDATE "LegalEntity" SET "active" = true WHERE "active" IS NULL;
