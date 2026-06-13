-- AddColumn EmployeeSalary.country
ALTER TABLE "EmployeeSalary" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'IN';
-- AddColumn EmployeeSalary.currency
ALTER TABLE "EmployeeSalary" ADD COLUMN IF NOT EXISTS "currency" TEXT;
-- AddColumn EmployeeSalary.legalEntityId
ALTER TABLE "EmployeeSalary" ADD COLUMN IF NOT EXISTS "legalEntityId" TEXT;
-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeSalary_tenantId_country_idx" ON "EmployeeSalary"("tenantId", "country");
-- CreateIndex
CREATE INDEX IF NOT EXISTS "EmployeeSalary_tenantId_legalEntityId_idx" ON "EmployeeSalary"("tenantId", "legalEntityId");
