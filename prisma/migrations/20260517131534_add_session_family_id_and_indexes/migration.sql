-- DropIndex
DROP INDEX `Session_revokedAt_idx` ON `Session`;

-- AlterTable: Add sessionFamilyId column
ALTER TABLE `Session` ADD COLUMN `sessionFamilyId` VARCHAR(191);

-- Set sessionFamilyId to id for existing rows (each existing session is its own family)
UPDATE `Session` SET `sessionFamilyId` = `id`;

-- Make sessionFamilyId NOT NULL after populating
ALTER TABLE `Session` MODIFY COLUMN `sessionFamilyId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE INDEX `Session_userId_revokedAt_expiresAt_idx` ON `Session`(`userId`, `revokedAt`, `expiresAt`);

-- CreateIndex
CREATE INDEX `Session_tenantId_userId_revokedAt_idx` ON `Session`(`tenantId`, `userId`, `revokedAt`);

-- CreateIndex
CREATE INDEX `Session_sessionFamilyId_revokedAt_idx` ON `Session`(`sessionFamilyId`, `revokedAt`);
