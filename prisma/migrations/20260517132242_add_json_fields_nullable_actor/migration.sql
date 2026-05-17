/*
  Warnings:

  - You are about to alter the column `locationJson` on the `AttendanceRecord` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `oldValuesJson` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `newValuesJson` on the `AuditLog` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.
  - You are about to alter the column `metadataJson` on the `Notification` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Json`.

*/
-- DropForeignKey
ALTER TABLE `AuditLog` DROP FOREIGN KEY `AuditLog_actorUserId_fkey`;

-- AlterTable
ALTER TABLE `AttendanceRecord` MODIFY `locationJson` JSON NULL;

-- AlterTable
ALTER TABLE `AuditLog` MODIFY `actorUserId` VARCHAR(191) NULL,
    MODIFY `oldValuesJson` JSON NULL,
    MODIFY `newValuesJson` JSON NULL;

-- AlterTable
ALTER TABLE `Notification` MODIFY `metadataJson` JSON NULL;

-- CreateIndex
CREATE INDEX `AttendanceRecord_tenantId_attendanceDate_idx` ON `AttendanceRecord`(`tenantId`, `attendanceDate`);

-- CreateIndex
CREATE INDEX `AttendanceRecord_employeeId_attendanceDate_idx` ON `AttendanceRecord`(`employeeId`, `attendanceDate`);

-- CreateIndex
CREATE INDEX `AttendanceRecord_status_idx` ON `AttendanceRecord`(`status`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_createdAt_idx` ON `AuditLog`(`tenantId`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_action_idx` ON `AuditLog`(`tenantId`, `action`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_entityType_entityId_idx` ON `AuditLog`(`tenantId`, `entityType`, `entityId`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_actorUserId_idx` ON `AuditLog`(`tenantId`, `actorUserId`);

-- CreateIndex
CREATE INDEX `AuditLog_action_idx` ON `AuditLog`(`action`);

-- CreateIndex
CREATE INDEX `Notification_tenantId_userId_idx` ON `Notification`(`tenantId`, `userId`);

-- CreateIndex
CREATE INDEX `Notification_tenantId_createdAt_idx` ON `Notification`(`tenantId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Notification_userId_readAt_idx` ON `Notification`(`userId`, `readAt`);

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
