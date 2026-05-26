-- AlterTable: add profilePhotoUrl to Employee (was added to schema but never migrated)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "profilePhotoUrl" TEXT;
