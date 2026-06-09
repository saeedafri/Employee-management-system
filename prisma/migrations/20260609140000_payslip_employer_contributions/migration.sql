-- Store computed employer statutory contributions on payslip (Phase 3 O2)
ALTER TABLE "Payslip"
  ADD COLUMN IF NOT EXISTS "employerContributionsJson" JSONB;
