-- CreateEnum
CREATE TYPE "ComponentType" AS ENUM ('EARNING', 'DEDUCTION', 'BENEFIT', 'REIMBURSEMENT');

-- CreateEnum
CREATE TYPE "CalculationType" AS ENUM ('FLAT', 'PERCENTAGE', 'FORMULA');

-- CreateEnum
CREATE TYPE "PaySchedule" AS ENUM ('MONTHLY', 'BIWEEKLY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATING', 'REVIEW', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('PENDING', 'PAID', 'HELD');

-- CreateTable
CREATE TABLE "SalaryComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ComponentType" NOT NULL,
    "calculationType" "CalculationType" NOT NULL,
    "value" DECIMAL(15,2),
    "basisCode" TEXT,
    "formula" TEXT,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "paySchedule" "PaySchedule" NOT NULL DEFAULT 'MONTHLY',
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayGroupComponent" (
    "id" TEXT NOT NULL,
    "payGroupId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "overrideCalculationType" "CalculationType",
    "overrideValue" DECIMAL(15,2),
    "overrideFormula" TEXT,

    CONSTRAINT "PayGroupComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payGroupId" TEXT NOT NULL,
    "annualCtc" DECIMAL(15,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfscCode" TEXT,
    "bankName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "totalGross" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "initiatedById" TEXT,
    "approvedById" TEXT,
    "approvalNotes" TEXT,
    "paymentReference" TEXT,
    "cancelReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "summaryJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "grossEarnings" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "workingDays" INTEGER NOT NULL DEFAULT 0,
    "presentDays" INTEGER NOT NULL DEFAULT 0,
    "leaveDays" INTEGER NOT NULL DEFAULT 0,
    "lopDays" INTEGER NOT NULL DEFAULT 0,
    "status" "PayslipStatus" NOT NULL DEFAULT 'PENDING',
    "paymentDate" TIMESTAMP(3),
    "paymentReference" TEXT,
    "earningsJson" JSONB,
    "deductionsJson" JSONB,
    "oneTimeAdditionsJson" JSONB,
    "oneTimeDeductionsJson" JSONB,
    "notes" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalaryComponent_tenantId_code_key" ON "SalaryComponent"("tenantId", "code");
CREATE INDEX "SalaryComponent_tenantId_idx" ON "SalaryComponent"("tenantId");
CREATE INDEX "SalaryComponent_tenantId_active_idx" ON "SalaryComponent"("tenantId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PayGroup_tenantId_code_key" ON "PayGroup"("tenantId", "code");
CREATE INDEX "PayGroup_tenantId_idx" ON "PayGroup"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PayGroupComponent_payGroupId_componentId_key" ON "PayGroupComponent"("payGroupId", "componentId");
CREATE INDEX "PayGroupComponent_payGroupId_idx" ON "PayGroupComponent"("payGroupId");
CREATE INDEX "PayGroupComponent_componentId_idx" ON "PayGroupComponent"("componentId");

-- CreateIndex
CREATE INDEX "EmployeeSalary_tenantId_idx" ON "EmployeeSalary"("tenantId");
CREATE INDEX "EmployeeSalary_employeeId_idx" ON "EmployeeSalary"("employeeId");
CREATE INDEX "EmployeeSalary_tenantId_employeeId_effectiveFrom_idx" ON "EmployeeSalary"("tenantId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PayrollRun_tenantId_idx" ON "PayrollRun"("tenantId");
CREATE INDEX "PayrollRun_tenantId_status_idx" ON "PayrollRun"("tenantId", "status");
CREATE INDEX "PayrollRun_tenantId_period_idx" ON "PayrollRun"("tenantId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payrollRunId_employeeId_key" ON "Payslip"("payrollRunId", "employeeId");
CREATE INDEX "Payslip_tenantId_idx" ON "Payslip"("tenantId");
CREATE INDEX "Payslip_payrollRunId_idx" ON "Payslip"("payrollRunId");
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");
CREATE INDEX "Payslip_tenantId_period_idx" ON "Payslip"("tenantId", "period");
CREATE INDEX "Payslip_status_idx" ON "Payslip"("status");

-- AddForeignKey
ALTER TABLE "SalaryComponent" ADD CONSTRAINT "SalaryComponent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayGroup" ADD CONSTRAINT "PayGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayGroupComponent" ADD CONSTRAINT "PayGroupComponent_payGroupId_fkey" FOREIGN KEY ("payGroupId") REFERENCES "PayGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayGroupComponent" ADD CONSTRAINT "PayGroupComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SalaryComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_payGroupId_fkey" FOREIGN KEY ("payGroupId") REFERENCES "PayGroup"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
