-- AlterTable
ALTER TABLE `Tenant` ADD COLUMN `tenantKey` VARCHAR(191);
ALTER TABLE `Tenant` ADD COLUMN `slug` VARCHAR(191);

-- Update existing tenant with default key
UPDATE `Tenant` SET `tenantKey` = 'acme' WHERE `tenantKey` IS NULL;

-- Make tenantKey NOT NULL and unique
ALTER TABLE `Tenant` MODIFY COLUMN `tenantKey` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `Tenant_tenantKey_key` ON `Tenant`(`tenantKey`);

-- Create unique index for slug (allowing nulls)
CREATE UNIQUE INDEX `Tenant_slug_key` ON `Tenant`(`slug`);
