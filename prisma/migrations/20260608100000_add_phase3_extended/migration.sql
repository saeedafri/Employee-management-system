-- AlterTable: SalaryComponent - add Phase 3 fields
ALTER TABLE "SalaryComponent"
  ADD COLUMN IF NOT EXISTS "statutoryTag" TEXT,
  ADD COLUMN IF NOT EXISTS "prorate" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "payInPeriods" TEXT,
  ADD COLUMN IF NOT EXISTS "glAccountCode" TEXT,
  ADD COLUMN IF NOT EXISTS "costCenterRule" TEXT NOT NULL DEFAULT 'NONE';

-- AlterTable: PayrollRun - add type, employer cost, publish, audit
ALTER TABLE "PayrollRun"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS "employerCost" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "published" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvalsJson" JSONB,
  ADD COLUMN IF NOT EXISTS "auditJson" JSONB;

-- AlterTable: Payslip - add hold fields
ALTER TABLE "Payslip"
  ADD COLUMN IF NOT EXISTS "heldAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "holdReason" TEXT;

-- CreateTable: ReimbursementCategory
CREATE TABLE IF NOT EXISTS "ReimbursementCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "monthlyCap" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReimbursementCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReimbursementCategory_tenantId_code_key" ON "ReimbursementCategory"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "ReimbursementCategory_tenantId_idx" ON "ReimbursementCategory"("tenantId");

ALTER TABLE "ReimbursementCategory" DROP CONSTRAINT IF EXISTS "ReimbursementCategory_tenantId_fkey";
ALTER TABLE "ReimbursementCategory" ADD CONSTRAINT "ReimbursementCategory_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ReimbursementClaim
CREATE TABLE IF NOT EXISTS "ReimbursementClaim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT,
    "proofUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "runId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReimbursementClaim_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReimbursementClaim_tenantId_idx" ON "ReimbursementClaim"("tenantId");
CREATE INDEX IF NOT EXISTS "ReimbursementClaim_employeeId_idx" ON "ReimbursementClaim"("employeeId");
CREATE INDEX IF NOT EXISTS "ReimbursementClaim_tenantId_status_idx" ON "ReimbursementClaim"("tenantId", "status");

ALTER TABLE "ReimbursementClaim" DROP CONSTRAINT IF EXISTS "ReimbursementClaim_tenantId_fkey";
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReimbursementClaim" DROP CONSTRAINT IF EXISTS "ReimbursementClaim_employeeId_fkey";
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReimbursementClaim" DROP CONSTRAINT IF EXISTS "ReimbursementClaim_categoryId_fkey";
ALTER TABLE "ReimbursementClaim" ADD CONSTRAINT "ReimbursementClaim_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ReimbursementCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Garnishment
CREATE TABLE IF NOT EXISTS "Garnishment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "amountKind" TEXT NOT NULL DEFAULT 'FLAT',
    "amountValue" DECIMAL(15,2) NOT NULL,
    "protectedEarningsFloor" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cap" DECIMAL(15,2),
    "reference" TEXT,
    "effectiveFrom" TEXT NOT NULL,
    "effectiveTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Garnishment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Garnishment_tenantId_idx" ON "Garnishment"("tenantId");
CREATE INDEX IF NOT EXISTS "Garnishment_employeeId_idx" ON "Garnishment"("employeeId");

ALTER TABLE "Garnishment" DROP CONSTRAINT IF EXISTS "Garnishment_tenantId_fkey";
ALTER TABLE "Garnishment" ADD CONSTRAINT "Garnishment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Garnishment" DROP CONSTRAINT IF EXISTS "Garnishment_employeeId_fkey";
ALTER TABLE "Garnishment" ADD CONSTRAINT "Garnishment_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: ContractorInvoice
CREATE TABLE IF NOT EXISTS "ContractorInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "withholdingPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(15,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "payoutRef" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContractorInvoice_tenantId_idx" ON "ContractorInvoice"("tenantId");
CREATE INDEX IF NOT EXISTS "ContractorInvoice_tenantId_workerId_idx" ON "ContractorInvoice"("tenantId", "workerId");
CREATE INDEX IF NOT EXISTS "ContractorInvoice_tenantId_status_idx" ON "ContractorInvoice"("tenantId", "status");

ALTER TABLE "ContractorInvoice" DROP CONSTRAINT IF EXISTS "ContractorInvoice_tenantId_fkey";
ALTER TABLE "ContractorInvoice" ADD CONSTRAINT "ContractorInvoice_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PaymentBatch
CREATE TABLE IF NOT EXISTS "PaymentBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "linesJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentBatch_tenantId_idx" ON "PaymentBatch"("tenantId");
CREATE INDEX IF NOT EXISTS "PaymentBatch_runId_idx" ON "PaymentBatch"("runId");

ALTER TABLE "PaymentBatch" DROP CONSTRAINT IF EXISTS "PaymentBatch_tenantId_fkey";
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PayrollEvent
CREATE TABLE IF NOT EXISTS "PayrollEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "runId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PayrollEvent_tenantId_idx" ON "PayrollEvent"("tenantId");
CREATE INDEX IF NOT EXISTS "PayrollEvent_tenantId_runId_idx" ON "PayrollEvent"("tenantId", "runId");

ALTER TABLE "PayrollEvent" DROP CONSTRAINT IF EXISTS "PayrollEvent_tenantId_fkey";
ALTER TABLE "PayrollEvent" ADD CONSTRAINT "PayrollEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PayslipTemplate
CREATE TABLE IF NOT EXISTS "PayslipTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default Payslip',
    "locale" TEXT NOT NULL DEFAULT 'en-IN',
    "logoUrl" TEXT,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayslipTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayslipTemplate_tenantId_key" ON "PayslipTemplate"("tenantId");

ALTER TABLE "PayslipTemplate" DROP CONSTRAINT IF EXISTS "PayslipTemplate_tenantId_fkey";
ALTER TABLE "PayslipTemplate" ADD CONSTRAINT "PayslipTemplate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
