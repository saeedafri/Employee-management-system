-- CreateTable LogEntry
CREATE TABLE `LogEntry` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `levelLabel` VARCHAR(191) NOT NULL,
    `levelColor` VARCHAR(191) NOT NULL,
    `module` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191),
    `actorUserId` VARCHAR(191),
    `metadataJson` JSON,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `LogEntry_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    INDEX `LogEntry_tenantId_level_idx`(`tenantId`, `level`),
    INDEX `LogEntry_tenantId_module_idx`(`tenantId`, `module`),
    INDEX `LogEntry_requestId_idx`(`requestId`),
    CONSTRAINT `LogEntry_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE CASCADE,
    CONSTRAINT `LogEntry_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Convert SavedView.filtersJson from VARCHAR to JSON
ALTER TABLE `SavedView` MODIFY `filtersJson` JSON NOT NULL;

-- Convert SavedView.columnsJson from VARCHAR to JSON
ALTER TABLE `SavedView` MODIFY `columnsJson` JSON;

-- Convert Setting.valueJson from VARCHAR to JSON
ALTER TABLE `Setting` MODIFY `valueJson` JSON NOT NULL;

-- Add Employee unique constraint on tenantId + workEmail
ALTER TABLE `Employee` ADD CONSTRAINT `Employee_tenantId_workEmail_key` UNIQUE(`tenantId`, `workEmail`);
