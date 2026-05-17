-- DropForeignKey
ALTER TABLE `LogEntry` DROP FOREIGN KEY `LogEntry_actorUserId_fkey`;

-- DropForeignKey
ALTER TABLE `LogEntry` DROP FOREIGN KEY `LogEntry_tenantId_fkey`;

-- AlterTable
ALTER TABLE `PasswordResetToken` ADD COLUMN `createdByIp` VARCHAR(191) NULL,
    ADD COLUMN `userAgent` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `PasswordResetToken_userId_expiresAt_idx` ON `PasswordResetToken`(`userId`, `expiresAt`);

-- CreateIndex
CREATE INDEX `PasswordResetToken_tenantId_tokenHash_idx` ON `PasswordResetToken`(`tenantId`, `tokenHash`);

-- CreateIndex
CREATE INDEX `PasswordResetToken_expiresAt_idx` ON `PasswordResetToken`(`expiresAt`);

-- CreateIndex
CREATE INDEX `PasswordResetToken_usedAt_idx` ON `PasswordResetToken`(`usedAt`);

-- AddForeignKey
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogEntry` ADD CONSTRAINT `LogEntry_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
