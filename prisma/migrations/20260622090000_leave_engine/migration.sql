-- Leave Engine (Phase 4): versioned policies + assignments + append-only ledger + comp-off.
-- ADDITIVE + IDEMPOTENT: safe to run against an already-patched database. Nothing is ever
-- dropped, altered destructively, or deleted. Mirrors the safe pattern from
-- 20260616080000_timesheet_templates (CREATE TABLE IF NOT EXISTS + guarded FK).

-- ── LeavePolicy ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeavePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "applicability" JSONB NOT NULL,
    "rules" JSONB NOT NULL,
    "statutoryFloors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeavePolicy_tenantId_idx" ON "LeavePolicy"("tenantId");
CREATE INDEX IF NOT EXISTS "LeavePolicy_tenantId_country_status_idx" ON "LeavePolicy"("tenantId", "country", "status");

-- ── LeaveAssignment ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeaveAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "leaveTypeCodes" JSONB NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveAssignment_tenantId_employeeId_policyId_key" ON "LeaveAssignment"("tenantId", "employeeId", "policyId");
CREATE INDEX IF NOT EXISTS "LeaveAssignment_tenantId_idx" ON "LeaveAssignment"("tenantId");
CREATE INDEX IF NOT EXISTS "LeaveAssignment_employeeId_idx" ON "LeaveAssignment"("employeeId");

-- ── LeaveLedgerTxn (append-only) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeaveLedgerTxn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "delta" DECIMAL(10,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaveYear" INTEGER NOT NULL,
    "sourceRef" TEXT,
    "reason" TEXT NOT NULL,
    "systemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveLedgerTxn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeaveLedgerTxn_tenantId_idx" ON "LeaveLedgerTxn"("tenantId");
CREATE INDEX IF NOT EXISTS "LeaveLedgerTxn_employeeId_idx" ON "LeaveLedgerTxn"("employeeId");
CREATE INDEX IF NOT EXISTS "LeaveLedgerTxn_tenantId_employeeId_leaveTypeId_idx" ON "LeaveLedgerTxn"("tenantId", "employeeId", "leaveTypeId");

-- ── CompOffRequest ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CompOffRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "units" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiryDate" TIMESTAMP(3),
    "approverId" TEXT,
    "approverComment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompOffRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CompOffRequest_tenantId_idx" ON "CompOffRequest"("tenantId");
CREATE INDEX IF NOT EXISTS "CompOffRequest_employeeId_idx" ON "CompOffRequest"("employeeId");

-- ── Foreign keys (guarded — ADD CONSTRAINT has no IF NOT EXISTS) ──────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LeavePolicy_tenantId_fkey') THEN
    ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LeaveAssignment_tenantId_fkey') THEN
    ALTER TABLE "LeaveAssignment" ADD CONSTRAINT "LeaveAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LeaveAssignment_employeeId_fkey') THEN
    ALTER TABLE "LeaveAssignment" ADD CONSTRAINT "LeaveAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LeaveLedgerTxn_tenantId_fkey') THEN
    ALTER TABLE "LeaveLedgerTxn" ADD CONSTRAINT "LeaveLedgerTxn_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'LeaveLedgerTxn_employeeId_fkey') THEN
    ALTER TABLE "LeaveLedgerTxn" ADD CONSTRAINT "LeaveLedgerTxn_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompOffRequest_tenantId_fkey') THEN
    ALTER TABLE "CompOffRequest" ADD CONSTRAINT "CompOffRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'CompOffRequest_employeeId_fkey') THEN
    ALTER TABLE "CompOffRequest" ADD CONSTRAINT "CompOffRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
