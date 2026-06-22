-- Money precision: widen all payroll money columns from numeric(15,2) to numeric(18,4)
-- so 3-decimal currencies (KWD/BHD/OMR/…) and 0-decimal (JPY) persist faithfully.
-- WIDENING is data-safe: existing 2-decimal values are preserved exactly (e.g. 1400.78 → 1400.7800);
-- no truncation, no data loss. 14 integer digits + 4 decimal = ample range for all ISO 4217 currencies.

ALTER TABLE "SalaryComponent" ALTER COLUMN "value" TYPE numeric(18,4);
ALTER TABLE "PayGroupComponent" ALTER COLUMN "overrideValue" TYPE numeric(18,4);
ALTER TABLE "EmployeeSalary" ALTER COLUMN "annualCtc" TYPE numeric(18,4);
ALTER TABLE "PayrollRun" ALTER COLUMN "totalGross" TYPE numeric(18,4);
ALTER TABLE "PayrollRun" ALTER COLUMN "totalDeductions" TYPE numeric(18,4);
ALTER TABLE "PayrollRun" ALTER COLUMN "totalNet" TYPE numeric(18,4);
ALTER TABLE "PayrollRun" ALTER COLUMN "employerCost" TYPE numeric(18,4);
ALTER TABLE "Payslip" ALTER COLUMN "grossEarnings" TYPE numeric(18,4);
ALTER TABLE "Payslip" ALTER COLUMN "totalDeductions" TYPE numeric(18,4);
ALTER TABLE "Payslip" ALTER COLUMN "netPay" TYPE numeric(18,4);
ALTER TABLE "EmployeeLoan" ALTER COLUMN "amount" TYPE numeric(18,4);
ALTER TABLE "EmployeeLoan" ALTER COLUMN "balance" TYPE numeric(18,4);
ALTER TABLE "EmployeeLoan" ALTER COLUMN "emiAmount" TYPE numeric(18,4);
ALTER TABLE "PayrollInput" ALTER COLUMN "variablePay" TYPE numeric(18,4);
ALTER TABLE "OpeningBalance" ALTER COLUMN "grossEarnings" TYPE numeric(18,4);
ALTER TABLE "OpeningBalance" ALTER COLUMN "taxableIncome" TYPE numeric(18,4);
ALTER TABLE "OpeningBalance" ALTER COLUMN "taxDeducted" TYPE numeric(18,4);
ALTER TABLE "OpeningBalance" ALTER COLUMN "totalDeductions" TYPE numeric(18,4);
ALTER TABLE "OpeningBalance" ALTER COLUMN "netPay" TYPE numeric(18,4);
ALTER TABLE "HistoricalPayslip" ALTER COLUMN "grossEarnings" TYPE numeric(18,4);
ALTER TABLE "HistoricalPayslip" ALTER COLUMN "totalDeductions" TYPE numeric(18,4);
ALTER TABLE "HistoricalPayslip" ALTER COLUMN "netPay" TYPE numeric(18,4);
ALTER TABLE "ReimbursementCategory" ALTER COLUMN "monthlyCap" TYPE numeric(18,4);
ALTER TABLE "ReimbursementClaim" ALTER COLUMN "amount" TYPE numeric(18,4);
ALTER TABLE "Garnishment" ALTER COLUMN "amountValue" TYPE numeric(18,4);
ALTER TABLE "Garnishment" ALTER COLUMN "protectedEarningsFloor" TYPE numeric(18,4);
ALTER TABLE "Garnishment" ALTER COLUMN "cap" TYPE numeric(18,4);
ALTER TABLE "ContractorInvoice" ALTER COLUMN "amount" TYPE numeric(18,4);
ALTER TABLE "ContractorInvoice" ALTER COLUMN "netPayable" TYPE numeric(18,4);
ALTER TABLE "PaymentBatch" ALTER COLUMN "totalAmount" TYPE numeric(18,4);
