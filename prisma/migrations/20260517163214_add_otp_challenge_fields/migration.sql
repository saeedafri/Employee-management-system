/*
  Warnings:

  - Added the required column `deliveryChannel` to the `OtpChallenge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destinationMasked` to the `OtpChallenge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `purpose` to the `OtpChallenge` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `OtpChallenge` ADD COLUMN `deliveryChannel` VARCHAR(191) NOT NULL,
    ADD COLUMN `destinationMasked` VARCHAR(191) NOT NULL,
    ADD COLUMN `lastSentAt` DATETIME(3) NULL,
    ADD COLUMN `lockedAt` DATETIME(3) NULL,
    ADD COLUMN `maxAttempts` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `maxResends` INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN `purpose` VARCHAR(191) NOT NULL,
    ADD COLUMN `resendCount` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `OtpChallenge_tenantId_challengeId_idx` ON `OtpChallenge`(`tenantId`, `challengeId`);

-- CreateIndex
CREATE INDEX `OtpChallenge_tenantId_userId_consumedAt_idx` ON `OtpChallenge`(`tenantId`, `userId`, `consumedAt`);

-- CreateIndex
CREATE INDEX `OtpChallenge_expiresAt_idx` ON `OtpChallenge`(`expiresAt`);

-- CreateIndex
CREATE INDEX `OtpChallenge_lockedAt_idx` ON `OtpChallenge`(`lockedAt`);
