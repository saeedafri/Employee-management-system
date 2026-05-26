-- CreateEnum
CREATE TYPE "RegularizationType" AS ENUM ('LATE', 'MISSED_CHECKOUT', 'EARLY_CHECKOUT', 'OTHER');

-- AlterTable: add type column to AttendanceRegularizationRequest
ALTER TABLE "AttendanceRegularizationRequest" ADD COLUMN IF NOT EXISTS "type" "RegularizationType" NOT NULL DEFAULT 'LATE';
