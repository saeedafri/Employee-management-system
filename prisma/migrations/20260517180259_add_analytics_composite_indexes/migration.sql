-- CreateIndex
CREATE INDEX `AttendanceRecord_tenantId_status_attendanceDate_idx` ON `AttendanceRecord`(`tenantId`, `status`, `attendanceDate`);

-- CreateIndex
CREATE INDEX `AttendanceRegularizationRequest_tenantId_status_createdAt_idx` ON `AttendanceRegularizationRequest`(`tenantId`, `status`, `createdAt`);

-- CreateIndex
CREATE INDEX `AuditLog_tenantId_createdAt_action_idx` ON `AuditLog`(`tenantId`, `createdAt`, `action`);

-- CreateIndex
CREATE INDEX `Employee_tenantId_employmentStatus_idx` ON `Employee`(`tenantId`, `employmentStatus`);

-- CreateIndex
CREATE INDEX `Employee_tenantId_departmentId_employmentStatus_idx` ON `Employee`(`tenantId`, `departmentId`, `employmentStatus`);

-- CreateIndex
CREATE INDEX `LeaveRequest_tenantId_status_startDate_idx` ON `LeaveRequest`(`tenantId`, `status`, `startDate`);
