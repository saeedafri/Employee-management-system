-- Loan contract metadata (Phase 6.10 — PAYROLL_EXTRAS_BACKEND_CONTRACT §1).
-- ADDITIVE + IDEMPOTENT: nullable columns on EmployeeLoan. Nothing dropped/altered destructively.

ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "type" TEXT;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "interestMethod" TEXT DEFAULT 'FLAT';
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "annualRatePct" DECIMAL(7,4);
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "tenureMonths" INTEGER;
ALTER TABLE "EmployeeLoan" ADD COLUMN IF NOT EXISTS "currency" TEXT;
