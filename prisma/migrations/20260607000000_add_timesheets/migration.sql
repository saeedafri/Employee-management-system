-- CreateTable
CREATE TABLE "TimesheetProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "defaultRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "memberIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "weekEnd" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "date" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "standardWeeklyHours" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "overtimeThresholdHours" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "roundingMinutes" INTEGER NOT NULL DEFAULT 15,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
    "unloggedHoursPolicy" TEXT NOT NULL DEFAULT 'FLAG',
    "billableDefault" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimesheetProject_tenantId_idx" ON "TimesheetProject"("tenantId");

-- CreateIndex
CREATE INDEX "TimesheetTask_tenantId_idx" ON "TimesheetTask"("tenantId");

-- CreateIndex
CREATE INDEX "TimesheetTask_projectId_idx" ON "TimesheetTask"("projectId");

-- CreateIndex
CREATE INDEX "Timesheet_tenantId_idx" ON "Timesheet"("tenantId");

-- CreateIndex
CREATE INDEX "Timesheet_employeeId_idx" ON "Timesheet"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_tenantId_employeeId_weekStart_key" ON "Timesheet"("tenantId", "employeeId", "weekStart");

-- CreateIndex
CREATE INDEX "TimeEntry_tenantId_idx" ON "TimeEntry"("tenantId");

-- CreateIndex
CREATE INDEX "TimeEntry_timesheetId_idx" ON "TimeEntry"("timesheetId");

-- CreateIndex
CREATE INDEX "TimeEntry_employeeId_idx" ON "TimeEntry"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetSettings_tenantId_key" ON "TimesheetSettings"("tenantId");

-- CreateIndex
CREATE INDEX "TimesheetSettings_tenantId_idx" ON "TimesheetSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "TimesheetProject" ADD CONSTRAINT "TimesheetProject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetTask" ADD CONSTRAINT "TimesheetTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetTask" ADD CONSTRAINT "TimesheetTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TimesheetProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TimesheetProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "TimesheetTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetSettings" ADD CONSTRAINT "TimesheetSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

