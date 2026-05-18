# GSD Implementation Plan: Pages 08-15 (Leave, Attendance, Departments, Holidays, Reports, Audit, Settings, Export)

**Objective**: Complete 40+ API endpoints across Pages 08-15 with full testing, documentation, and production readiness.

**Timeline**: 2-3 weeks (60-80 hours)  
**Focus**: Backend APIs only, no UI  
**Testing**: Mandatory unit + integration tests for every endpoint  

---

## PHASE BREAKDOWN

### Phase 1: Core Modules (Pages 08-11) - Week 1-2
**Endpoints**: 20 APIs  
**Effort**: 40 hours

#### Page 08: Leave Management (6 endpoints)
**Module**: `src/modules/leave/`

**Endpoints**:
```
GET  /api/v1/leave/requests?status=&employeeId=&page=&limit=
POST /api/v1/leave/requests (Request leave)
GET  /api/v1/leave/requests/:id (Detail)
PATCH /api/v1/leave/requests/:id/withdraw (Withdraw pending)
GET  /api/v1/leave/balance (Get employee's leave balance)
GET  /api/v1/leave/types (Get available leave types)
```

**Files to Create**:
- `leave.routes.js` - Route definitions
- `leave.controller.js` - Request handlers
- `leave.service.js` - Business logic
  - `createLeaveRequest(userId, leaveTypeId, startDate, endDate, reason, tenantId)`
  - `getLeaveRequests(filters, pagination, tenantId)`
  - `getLeaveRequestDetail(id, userId, tenantId)`
  - `withdrawLeaveRequest(id, userId, tenantId)`
  - `getLeaveBalance(userId, tenantId)`
  - `getLeaveTypes(tenantId)`
  - Helper: `calculateLeaveDays(startDate, endDate, excludeWeekends, excludeHolidays)`
  - Helper: `validateLeaveOverlap(employeeId, startDate, endDate, tenantId)`
  - Helper: `updateLeaveBalance(employeeId, leaveTypeId, usedDays, tenantId)`
- `leave.repository.js` - Database queries
- `leave.validator.js` - Zod schemas
- `leave.policy.js` - Authorization logic

**Validation Rules**:
- Start date <= end date
- No past dates for new requests
- Enough balance available
- No overlapping leaves
- Not during locked period (HR_ADMIN override)

**Business Logic**:
- Employee can request leave (PENDING)
- Manager can approve/deny (APPROVED/DENIED)
- Employee can withdraw if PENDING
- Balance updates on approval
- Notifications: request created, approved, denied, withdrawn
- Audit log: all mutations

**RBAC**:
- EMPLOYEE: View own, create new, withdraw own pending
- MANAGER: View team's, approve/deny team's
- HR_ADMIN: View all, override dates, approve all
- SUPER_ADMIN: Full access

**Tests Required**:
- ✅ Create leave request with valid data
- ✅ Reject overlapping leaves
- ✅ Reject without sufficient balance
- ✅ Manager approves/denies team leave
- ✅ Employee cannot approve own leave
- ✅ Employee can withdraw PENDING only
- ✅ Balance updates after approval
- ✅ Pagination works
- ✅ Filters (status, employeeId) work
- ✅ Audit logs recorded

**Performance Targets**:
- GET list: p95 < 150ms
- GET balance: p95 < 50ms
- POST request: p95 < 100ms

---

#### Page 09: Attendance Management (6 endpoints)
**Module**: `src/modules/attendance/`

**Endpoints**:
```
GET  /api/v1/attendance/records?employeeId=&startDate=&endDate=&page=&limit=
GET  /api/v1/attendance/summary?employeeId=&month=
POST /api/v1/attendance/regularize (Request attendance correction)
GET  /api/v1/attendance/regularization-requests?status=&page=
PATCH /api/v1/attendance/regularization-requests/:id/decision (Manager approve/deny)
GET  /api/v1/attendance/geofence?date= (Check geofence on check-in)
```

**Files to Create**:
- `attendance.routes.js`
- `attendance.controller.js`
- `attendance.service.js`
  - `getAttendanceRecords(filters, pagination, tenantId)`
  - `getAttendanceSummary(employeeId, month, tenantId)`
  - `createRegularizationRequest(employeeId, attendanceDate, reason, tenantId)`
  - `getRegularizationRequests(filters, tenantId)`
  - `approveRegularizationRequest(id, reviewerId, comment, tenantId)`
  - `denyRegularizationRequest(id, reviewerId, comment, tenantId)`
  - `checkGeofence(employeeId, latitude, longitude, tenantId)`
  - Helper: `calculateAttendancePercentage(employeeId, month, tenantId)`
  - Helper: `validateGeofenceLocation(lat, lon, allowedRadius)`
- `attendance.repository.js`
- `attendance.validator.js`
- `attendance.policy.js`

**Validation Rules**:
- Attendance date is valid
- Check-in/out times are logical
- Geofence within allowed radius
- Regularization only for missing check-outs

**Business Logic**:
- Check-in/out records already in Page 06
- Regularization: submit request for missing attendance
- Manager approves/denies regularization
- Attendance summary: present, absent, leave, half-day, holiday
- Geofence: optional location tracking
- Attendance percentage calculation

**RBAC**:
- EMPLOYEE: View own, submit regularization, check-in/out
- MANAGER: View team, approve/deny regularization
- HR_ADMIN: View all, override
- SUPER_ADMIN: Full access

**Tests Required**:
- ✅ Regularization request created
- ✅ Manager can approve/deny
- ✅ Employee cannot create duplicate regularization
- ✅ Attendance summary calculated correctly
- ✅ Geofence validation works
- ✅ Attendance percentage correct
- ✅ Audit logs recorded
- ✅ Filters work correctly

**Performance Targets**:
- GET records: p95 < 150ms
- GET summary: p95 < 100ms
- POST regularize: p95 < 80ms

---

#### Page 10: Department Management (4 endpoints)
**Module**: `src/modules/departments/`

**Endpoints**:
```
GET  /api/v1/departments?includeInactive=false&page=
POST /api/v1/departments (Create - HR_ADMIN only)
PATCH /api/v1/departments/:id (Update - HR_ADMIN only)
DELETE /api/v1/departments/:id (Soft delete - HR_ADMIN only)
```

**Files to Create**:
- `departments.routes.js`
- `departments.controller.js`
- `departments.service.js`
  - `getDepartments(filters, pagination, tenantId)`
  - `createDepartment(name, code, parentId, headEmployeeId, tenantId)`
  - `updateDepartment(id, updates, tenantId)`
  - `deleteDepartment(id, tenantId)` (Soft delete)
  - `getDepartmentHierarchy(tenantId)`
  - Helper: `validateDepartmentCode(code, tenantId, excludeId)`
- `departments.repository.js`
- `departments.validator.js`
- `departments.policy.js`

**Validation Rules**:
- Unique department code per tenant
- Parent department exists (if provided)
- No circular hierarchy
- Department head exists (if provided)
- Cannot delete if employees assigned

**Business Logic**:
- Hierarchical departments (parent/child)
- Department heads
- Active/inactive status
- Prevents deletion if employees exist (must reassign)
- Track department changes in audit log

**RBAC**:
- EMPLOYEE: View all (read-only)
- MANAGER: View team department (read-only)
- HR_ADMIN: Full CRUD
- SUPER_ADMIN: Full access

**Tests Required**:
- ✅ Create department with hierarchy
- ✅ Reject duplicate code
- ✅ Reject circular hierarchy
- ✅ Update department
- ✅ Cannot delete if employees exist
- ✅ Soft delete works
- ✅ Hierarchy traversal correct
- ✅ Audit logs recorded

**Performance Targets**:
- GET list: p95 < 80ms
- POST create: p95 < 60ms
- Hierarchy: p95 < 100ms

---

#### Page 11: Holiday Management (4 endpoints)
**Module**: `src/modules/holidays/`

**Endpoints**:
```
GET  /api/v1/holidays?location=&year=&page=
POST /api/v1/holidays (Create - HR_ADMIN only)
PATCH /api/v1/holidays/:id (Update - HR_ADMIN only)
DELETE /api/v1/holidays/:id (Delete - HR_ADMIN only)
```

**Files to Create**:
- `holidays.routes.js`
- `holidays.controller.js`
- `holidays.service.js`
  - `getHolidays(filters, pagination, tenantId)`
  - `createHoliday(name, date, location, isOptional, tenantId)`
  - `updateHoliday(id, updates, tenantId)`
  - `deleteHoliday(id, tenantId)`
  - `getHolidaysForDateRange(startDate, endDate, tenantId)`
  - Helper: `isHoliday(date, tenantId)`
- `holidays.repository.js`
- `holidays.validator.js`
- `holidays.policy.js`

**Validation Rules**:
- Valid date format
- No duplicate holidays on same date for location
- Location required if not global

**Business Logic**:
- Holiday calendar per tenant
- Optional holidays (can work on opt holidays)
- Location-based holidays (multiple holidays for different locations)
- Used in leave and attendance calculations
- Affects working day calculation

**RBAC**:
- EMPLOYEE: View holidays (read-only)
- HR_ADMIN: Full CRUD
- SUPER_ADMIN: Full access

**Tests Required**:
- ✅ Create holiday
- ✅ Reject duplicate date/location
- ✅ Location-based holidays work
- ✅ Optional holiday flag works
- ✅ Update holiday
- ✅ Delete holiday
- ✅ isHoliday() helper correct
- ✅ Filters work

**Performance Targets**:
- GET list: p95 < 80ms
- GET range: p95 < 50ms

---

### Phase 2: Advanced Features (Pages 12-14) - Week 2-3
**Endpoints**: 18 APIs  
**Effort**: 30 hours

#### Page 12: Reports & Analytics (8 endpoints)
**Module**: `src/modules/reports/`

**Endpoints**:
```
GET  /api/v1/reports/attendance?department=&month=&format=json|csv
GET  /api/v1/reports/leave?status=&month=&department=&format=json|csv
GET  /api/v1/reports/payroll?month=&department=&format=json|csv
GET  /api/v1/reports/custom?template=&filters=&format=json|csv|pdf
POST /api/v1/reports/schedule (Schedule recurring - HR_ADMIN)
GET  /api/v1/reports/scheduled (List scheduled reports)
GET  /api/v1/reports/:id/download (Download generated report)
DELETE /api/v1/reports/:id (Delete report - HR_ADMIN)
```

**Files to Create**:
- `reports.routes.js`
- `reports.controller.js`
- `reports.service.js` - Complex reporting engine
  - `generateAttendanceReport(filters, format, tenantId)`
  - `generateLeaveReport(filters, format, tenantId)`
  - `generatePayrollReport(filters, format, tenantId)` (Placeholder for payroll module)
  - `generateCustomReport(templateId, filters, format, tenantId)`
  - `scheduleReport(config, tenantId)` (BullMQ job)
  - `getScheduledReports(tenantId)`
  - `downloadReport(id, tenantId)`
  - Helper: `formatReportAs(data, format)` (JSON, CSV, PDF)
  - Helper: `emailReport(reportId, recipients, tenantId)` (BullMQ)
- `reports.repository.js`
- `reports.validator.js`
- `reports.policy.js`
- `jobs/reportGenerationJob.js` (BullMQ)
- `utils/reportGenerator.js` (CSV, PDF formats)

**Business Logic**:
- Aggregated reports (no PII unless authorized)
- Multiple formats: JSON, CSV, PDF
- Scheduled report generation (monthly, quarterly, annually)
- Email delivery of reports
- Custom report builder with filters
- Report audit trail

**RBAC**:
- EMPLOYEE: View own data only
- MANAGER: View team reports
- HR_ADMIN: Full access, schedule reports
- SUPER_ADMIN: Full access

**Tests Required**:
- ✅ Attendance report generates
- ✅ Leave report generates
- ✅ CSV export works
- ✅ PDF export works
- ✅ Filters applied correctly
- ✅ Schedule report created
- ✅ Email delivery triggered
- ✅ Access control enforced

**Performance Targets**:
- GET report: p95 < 500ms (complex aggregation)
- CSV download: p95 < 1s
- PDF generation: p95 < 2s

---

#### Page 13: Audit Logs & Compliance (4 endpoints)
**Module**: `src/modules/auditLogs/` (Already exists, need to complete)

**Endpoints**:
```
GET  /api/v1/audit-logs?actor=&action=&entity=&range=&page=
GET  /api/v1/audit-logs/:id (Detail)
GET  /api/v1/audit-logs/export?format=csv|json&range= (HR_ADMIN)
GET  /api/v1/compliance/dpia (Data Protection Impact Assessment - HR_ADMIN)
```

**Files to Update/Create**:
- `auditLogs.routes.js` (Complete)
- `auditLogs.controller.js` (Complete)
- `auditLogs.service.js` (Complete)
- `auditLogs.repository.js` (Optimize queries)
- `auditLogs.validator.js` (Complete)
- `auditLogs.policy.js` (Create)
- `compliance.routes.js` (New)
- `compliance.service.js` (New)
- `utils/auditTrail.js` (Ensure immutability)

**Business Logic**:
- Immutable audit trail (all mutations logged)
- Track: actor, action, entity, old values, new values, IP, user-agent
- DPIA: Data protection impact assessment report
- Compliance: GDPR, CCPA, SOC2 requirements
- Export capabilities (CSV, JSON)
- Retention policies

**RBAC**:
- EMPLOYEE: View own audit logs only
- MANAGER: View team's
- HR_ADMIN: View all, export, DPIA
- SUPER_ADMIN: Full access

**Tests Required**:
- ✅ All mutations logged
- ✅ Immutability enforced
- ✅ Filters work
- ✅ Export works (CSV, JSON)
- ✅ DPIA report generates
- ✅ Access control enforced
- ✅ Retention policies work

**Performance Targets**:
- GET list: p95 < 200ms
- GET export: p95 < 1s

---

#### Page 14: Settings & Configuration (6 endpoints)
**Module**: `src/modules/settings/`

**Endpoints**:
```
GET  /api/v1/settings/tenant (Get tenant settings)
PATCH /api/v1/settings/tenant (Update - HR_ADMIN)
GET  /api/v1/settings/working-hours (Get working hours per department)
PATCH /api/v1/settings/working-hours (Update - HR_ADMIN)
GET  /api/v1/settings/email-templates (Get email templates)
PATCH /api/v1/settings/email-templates (Update - HR_ADMIN)
```

**Files to Create**:
- `settings.routes.js`
- `settings.controller.js`
- `settings.service.js`
  - `getTenantSettings(tenantId)`
  - `updateTenantSettings(tenantId, updates)`
  - `getWorkingHours(departmentId, tenantId)` (Returns default if not set)
  - `updateWorkingHours(departmentId, settings, tenantId)`
  - `getEmailTemplates(tenantId)`
  - `updateEmailTemplate(templateKey, content, tenantId)`
  - Helper: `validateWorkingHours(hours)` (9-5, flexible, etc)
  - Helper: `mergeSettingsWithDefaults(custom, defaults)`
- `settings.repository.js`
- `settings.validator.js`
- `settings.policy.js`

**Business Logic**:
- Tenant configuration (company name, logo, timezone, fiscal year)
- Working hours per department (9-5, flexible, shift-based)
- Email template customization (leave approval, password reset, etc.)
- Feature flags (leave module enabled, attendance module enabled, etc.)
- Compliance settings (data retention, encryption, etc.)

**RBAC**:
- EMPLOYEE: View only
- HR_ADMIN: Full CRUD
- SUPER_ADMIN: Full access

**Tests Required**:
- ✅ Get/update tenant settings
- ✅ Get/update working hours
- ✅ Get/update email templates
- ✅ Defaults applied correctly
- ✅ Validation works
- ✅ Audit logs recorded

**Performance Targets**:
- GET settings: p95 < 50ms (cache after fetch)
- PATCH settings: p95 < 80ms

---

### Phase 3: Finalization (Page 15) - Week 3
**Endpoints**: 4 APIs  
**Effort**: 10 hours

#### Page 15: Data Export (4 endpoints)
**Module**: `src/modules/export/`

**Endpoints**:
```
POST /api/v1/export/employees (Start async export - HR_ADMIN)
POST /api/v1/export/attendance (Start async export - HR_ADMIN)
POST /api/v1/export/leave (Start async export - HR_ADMIN)
GET  /api/v1/exports/:id/download (Download or email results)
```

**Files to Create**:
- `export.routes.js`
- `export.controller.js`
- `export.service.js`
  - `startEmployeesExport(filters, format, tenantId, userId)`
  - `startAttendanceExport(filters, format, tenantId, userId)`
  - `startLeaveExport(filters, format, tenantId, userId)`
  - `getExportStatus(id, userId, tenantId)`
  - `downloadExport(id, userId, tenantId)`
  - Helper: `anonymizeData(data, fields)` (Optional GDPR)
- `export.repository.js`
- `export.validator.js`
- `export.policy.js`
- `jobs/exportJob.js` (BullMQ - async processing)
- `utils/csvExporter.js`
- `utils/excelExporter.js`

**Business Logic**:
- Async export (BullMQ jobs, don't block HTTP)
- Multiple formats: CSV, Excel, JSON
- Large dataset support (streaming)
- Email delivery (optional)
- Data anonymization option (GDPR)
- Scheduled exports (daily, weekly, monthly)

**RBAC**:
- EMPLOYEE: Cannot export
- HR_ADMIN: Full export access
- SUPER_ADMIN: Full access

**Tests Required**:
- ✅ Export job queued
- ✅ CSV generated correctly
- ✅ Excel generated correctly
- ✅ Large dataset handled
- ✅ Filters applied
- ✅ Email delivery works
- ✅ Anonymization works
- ✅ Download works

**Performance Targets**:
- POST export: p95 < 100ms (async, returns immediately)
- 100k records: < 30s export time
- GET download: p95 < 500ms

---

## TESTING STRATEGY

### Test Coverage Targets
```
Overall: 90%+
├── Unit Tests: 85%+ (logic, validators, policies)
├── Integration Tests: 90%+ (API + DB)
└── E2E Tests: 80%+ (complete workflows)
```

### Test Types per Page

**For Each Page**:
1. **Unit Tests** (20-30 tests)
   - Service logic
   - Validators (accept valid, reject invalid)
   - Policies (RBAC enforcement)
   - Helpers (calculations, date logic)

2. **Integration Tests** (15-25 tests)
   - API endpoints
   - Database operations
   - Error handling
   - Error status codes
   - Response formats

3. **E2E Tests** (10-15 tests)
   - Complete user workflows
   - Cross-module interactions
   - Audit logging
   - Notification triggers

### Test Organization
```
tests/
├── leave/
│   ├── leave.unit.test.js
│   ├── leave.integration.test.js
│   └── leave.e2e.test.js
├── attendance/
├── departments/
├── holidays/
├── reports/
├── auditLogs/
├── settings/
└── export/
```

### Performance Testing

**Command**: `npm run test:performance`

```javascript
// tests/performance.test.js
describe('Performance Baselines - Pages 08-15', () => {
  it('page 08: GET /api/v1/leave/requests - p95 < 150ms', async () => { });
  it('page 08: POST /api/v1/leave/requests - p95 < 100ms', async () => { });
  it('page 09: GET /api/v1/attendance/records - p95 < 150ms', async () => { });
  // ... more tests
});
```

---

## DOCUMENTATION REQUIREMENTS

### Per Page
1. **API Specification** (Swagger/OpenAPI)
   - Endpoint definition
   - Request/response schemas
   - Error responses
   - Auth requirements

2. **Implementation Guide**
   - Database changes
   - Service logic
   - RBAC matrix
   - Error cases

3. **Postman Collection Updates**
   - Add new endpoints
   - Set up environment variables
   - Add pre/post scripts

4. **Operations Guide**
   - Monitoring metrics
   - Alert thresholds
   - Troubleshooting
   - Known issues

---

## DEPENDENCY & INTEGRATION MAP

```
Page 08: Leave Management
├── Depends on: Page 07 (Employees), Page 06 (Employee Dashboard)
├── Uses: Leave types, Leave balances, Leave requests tables
├── Notifies: Page 13 (Audit logs)
└── Integrates with: Page 09 (Attendance - holiday check)

Page 09: Attendance Management
├── Depends on: Page 07 (Employees), Page 06 (Check-in/out)
├── Uses: Attendance records, Regularization tables
├── Notifies: Page 13 (Audit logs)
└── Integrates with: Page 08 (Leave - conflict check)

Page 10: Departments
├── Depends on: Tenant initialization
├── Uses: Departments table
├── Referenced by: Page 07 (Employees)
├── Notifies: Page 13 (Audit logs)
└── Integrates with: Page 14 (Settings - working hours)

Page 11: Holidays
├── Depends on: Tenant initialization
├── Uses: Holidays table
├── Referenced by: Page 08 (Leave), Page 09 (Attendance)
├── Notifies: Page 13 (Audit logs)
└── Integrates with: Page 14 (Settings)

Page 12: Reports
├── Depends on: Pages 08, 09, 10, 11
├── Reads: Leave, Attendance, Departments, Holidays
├── Notifies: Page 13 (Audit logs)
└── Integrates with: Page 14 (Settings - email templates)

Page 13: Audit Logs
├── Depends on: All pages (write-only)
├── No dependencies on others
└── Used by: Page 14 (Settings), Page 12 (Reports)

Page 14: Settings
├── Depends on: Tenant initialization
├── Uses: Settings table
├── Referenced by: All modules
└── Integrates with: Page 12 (Reports)

Page 15: Export
├── Depends on: Pages 07, 08, 09, 10, 11, 13
├── Async operations: BullMQ jobs
└── Integrates with: Page 14 (Email templates)
```

---

## IMPLEMENTATION CHECKLIST

### Per Page Checklist

```markdown
## Page 08: Leave Management
- [ ] Database schema verified
- [ ] Routes created (6 endpoints)
- [ ] Controllers implemented
- [ ] Service logic complete
- [ ] Validators created (Zod)
- [ ] Policies implemented (RBAC)
- [ ] Unit tests written (30 tests)
- [ ] Integration tests written (20 tests)
- [ ] E2E tests written (10 tests)
- [ ] Swagger docs added
- [ ] Postman collection updated
- [ ] Performance baseline measured
- [ ] Code review passed
- [ ] Merged to main
- [ ] Deployed to staging

## Page 09: Attendance Management
[ ] ... (same pattern)

## ... (repeat for all pages)
```

---

## GIT WORKFLOW

**Per Page**:
```bash
# 1. Create feature branch
git checkout -b feat/page-08-leave-management

# 2. Implement all files
# - src/modules/leave/* (routes, controller, service, repository, validator, policy)
# - tests/leave/* (unit, integration, e2e)
# - docs/api/leave.md
# - docs/postman updates

# 3. Commit atomically
git commit -m "feat(page-08): leave management system - 6 endpoints, full tests"

# 4. Push and create PR
git push origin feat/page-08-leave-management

# 5. Merge after review
# GitHub PR → review → approve → merge
```

---

## SUCCESS CRITERIA

By end of Phase 1 (Pages 08-11):
- ✅ 20 endpoints implemented
- ✅ 400+ tests passing
- ✅ All endpoints <150ms p95
- ✅ Full Postman collection
- ✅ 90%+ test coverage
- ✅ Zero linting errors
- ✅ All docs complete

By end of Phase 2 (Pages 12-14):
- ✅ 38 endpoints implemented
- ✅ 600+ tests passing
- ✅ Reporting system functional
- ✅ Audit trail complete
- ✅ Settings system functional

By end of Phase 3 (Page 15):
- ✅ All 42 endpoints implemented
- ✅ 700+ tests passing (90%+ coverage)
- ✅ All wireframes covered
- ✅ Full documentation
- ✅ Production-ready
- ✅ GitHub pushed
- ✅ Ready for deployment

---

## BLOCKERS & DEPENDENCIES

### Current Blockers
1. **Page 03 (OTP)**: Needs clarification on MFA requirement
   - Decision needed: Always on? Optional? For admins only?
   - Impact: Authentication flow design
   - Action: Clarify requirement before starting

2. **CSV Export (Page 07)**: Incomplete
   - Needs: Stream large datasets
   - Action: Complete before phase 3

3. **Redis Configuration**: Not fully utilized
   - Action: Add caching for reports, settings

### External Dependencies
- None identified (all internal)

---

## ESTIMATED TIMELINE

```
Week 1 (Days 1-5): Pages 08-09 (12 endpoints, 20 hours)
├── Day 1-2: Page 08 Leave Management (routes, controllers, services, tests)
└── Day 3-5: Page 09 Attendance Management (routes, controllers, services, tests)

Week 2 (Days 6-10): Pages 10-12 (16 endpoints, 25 hours)
├── Day 6-7: Page 10 Departments + Page 11 Holidays (8 endpoints)
├── Day 8-10: Page 12 Reports (8 endpoints, complex logic)
└── Day 10: Performance baseline testing

Week 3 (Days 11-15): Pages 13-15 + Polish (10 endpoints, 20 hours)
├── Day 11-12: Page 13 Audit Logs (complete/optimize)
├── Day 13-14: Page 14 Settings (6 endpoints)
├── Day 15: Page 15 Export (4 endpoints)
└── Final: Full testing, documentation, GitHub push
```

---

## RESOURCES & TOOLS

**Development**:
- Node.js 20+
- Fastify 4
- Prisma 5
- Zod for validation
- Mocha for testing
- Postman for API testing

**Database**:
- MySQL 8 (local)
- Connection: `root:SecPlatform2024@localhost:3306/employee-management`

**Documentation**:
- Swagger/OpenAPI
- Postman Collection
- Markdown docs in `/docs/api/`

**Monitoring** (Post-launch):
- Pino logger (already configured)
- Performance monitoring (needed)
- Error tracking (needed)

---

## NEXT ACTIONS

1. **Today (2026-05-18)**:
   - ✅ Complete comprehensive review
   - ✅ Create GSD plan
   - ⏳ **Start Page 08 (Leave Management)**

2. **Tomorrow**:
   - Complete Page 08 with full testing
   - Start Page 09

3. **This Week**:
   - Complete Pages 08-09
   - Deploy to staging
   - Get stakeholder feedback

---

**Plan Status**: READY FOR EXECUTION  
**Next Review**: 2026-05-22 (Mid-week checkpoint)  
**Target Completion**: 2026-06-01 (All pages complete)  

---
