-- AlterTable: add documentUrl to AttendanceRegularizationRequest (in schema but not in init migration)
ALTER TABLE "AttendanceRegularizationRequest" ADD COLUMN IF NOT EXISTS "documentUrl" TEXT;
