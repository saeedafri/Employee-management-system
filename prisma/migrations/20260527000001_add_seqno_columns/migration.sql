-- AlterTable: add seqNo to AttendanceRecord (in schema but not in init migration)
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "seqNo" SERIAL;

-- AlterTable: add seqNo to AttendanceRegularizationRequest
ALTER TABLE "AttendanceRegularizationRequest" ADD COLUMN IF NOT EXISTS "seqNo" SERIAL;

-- AlterTable: add seqNo to LeaveRequest
ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "seqNo" SERIAL;
