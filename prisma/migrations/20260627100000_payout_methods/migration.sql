-- BANK_PAYOUT_BACKEND_CONTRACT — payout-methods entity (greenfield) + tenant bank-schema
-- catalog. ADDITIVE + idempotent. Replaces the flat EmployeeSalary.bank* columns (those
-- are kept read-only for one release; backfill is a separate app-context script).

-- 1. Enums (idempotent — CREATE TYPE has no IF NOT EXISTS, guard via pg_type).
DO $$ BEGIN
  CREATE TYPE "PayoutMethodType" AS ENUM ('BANK', 'PROVIDER_BENEFICIARY', 'WALLET');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "PayoutRail" AS ENUM ('BANK_LOCAL','BANK_SWIFT','SEPA','ACH','FPS','UPI','WISE','WALLET');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "PayoutLifecycleStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','ACTIVE','REJECTED','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "PayoutVerificationStatus" AS ENUM ('UNVERIFIED','PENDING','VERIFIED','FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  CREATE TYPE "PayoutApprovalKind" AS ENUM ('METHOD_ADD','METHOD_EDIT','SET_PRIMARY','SPLIT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. PayoutMethod
CREATE TABLE IF NOT EXISTS "PayoutMethod" (
  "id"                 TEXT NOT NULL,
  "tenantId"           TEXT NOT NULL,
  "employeeId"         TEXT NOT NULL,
  "type"               "PayoutMethodType" NOT NULL DEFAULT 'BANK',
  "country"            TEXT NOT NULL,
  "currency"           TEXT NOT NULL,
  "rail"               "PayoutRail" NOT NULL DEFAULT 'BANK_LOCAL',
  "label"              TEXT NOT NULL,
  "holderName"         TEXT NOT NULL,
  "detailsEnc"         TEXT NOT NULL,
  "maskedTail"         TEXT NOT NULL,
  "isPrimary"          BOOLEAN NOT NULL DEFAULT false,
  "lifecycleStatus"    "PayoutLifecycleStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "verificationStatus" "PayoutVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "requestedBy"        TEXT,
  "requestedAt"        TIMESTAMP(3),
  "reviewedBy"         TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "approvalNote"       TEXT,
  "effectiveFrom"      TIMESTAMP(3) NOT NULL,
  "supersededById"     TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutMethod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PayoutMethod_tenantId_employeeId_idx" ON "PayoutMethod"("tenantId","employeeId");
CREATE INDEX IF NOT EXISTS "PayoutMethod_tenantId_employeeId_currency_idx" ON "PayoutMethod"("tenantId","employeeId","currency");
CREATE INDEX IF NOT EXISTS "PayoutMethod_tenantId_lifecycle_verification_idx" ON "PayoutMethod"("tenantId","lifecycleStatus","verificationStatus");

-- 3. PayoutApproval
CREATE TABLE IF NOT EXISTS "PayoutApproval" (
  "id"           TEXT NOT NULL,
  "tenantId"     TEXT NOT NULL,
  "kind"         "PayoutApprovalKind" NOT NULL,
  "employeeId"   TEXT NOT NULL,
  "employeeName" TEXT NOT NULL,
  "summary"      TEXT NOT NULL,
  "diffJson"     JSONB,
  "methodId"     TEXT,
  "requestedBy"  TEXT NOT NULL,
  "requestedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedBy"   TEXT,
  "reviewedAt"   TIMESTAMP(3),
  "note"         TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayoutApproval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PayoutApproval_tenantId_status_idx" ON "PayoutApproval"("tenantId","status");
CREATE INDEX IF NOT EXISTS "PayoutApproval_tenantId_methodId_idx" ON "PayoutApproval"("tenantId","methodId");

-- 4. CountryBankSchema (tenant-scoped catalog; (tenantId, country) is the key)
CREATE TABLE IF NOT EXISTS "CountryBankSchema" (
  "tenantId"   TEXT NOT NULL,
  "country"    TEXT NOT NULL,
  "currency"   TEXT NOT NULL,
  "fieldsJson" JSONB NOT NULL,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy"  TEXT NOT NULL,
  CONSTRAINT "CountryBankSchema_pkey" PRIMARY KEY ("tenantId","country")
);
