# Complete Feature Inventory: UI vs. Backend

> **Audited By**: Gemini (Google DeepMind Antigravity)  
> **Target System**: EMS (Backend Fastify v4 + Frontend Next.js 14 App Router)  
> **Database & Cache**: PostgreSQL 16 + Redis 7 (`187.126.125.239`)  
> **Evidence Reference**: REA AST/Static Dataflow + Live Network Wire Probing

---

## 1. Domain-by-Domain Feature Matrix

This matrix maps every functional domain across the Frontend UI routes, Backend API endpoints, Prisma database models, integration status, and observed contract drift.

| Functional Domain | Frontend Route / Components | Backend API Routes | Prisma Models Backing | Status | Empirical Verdict & Gaps |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Session** | `/login`, `/forgot-password`, `/reset-password`, `AuthGuard.tsx` | `/api/v1/auth/login`, `/logout`, `/refresh`, `/me`, `/forgot-password`, `/reset-password` | `User`, `Session`, `PasswordResetToken`, `OtpChallenge` | **Partially Working** | Login & JWT rotation works. Missing Next.js edge middleware leaks client bundle on `/dashboard` before redirect. |
| **Multi-Tenancy** | Organization switcher / Header tenant context | `x-tenant-key` resolution, `resolveTenant.js` | `Tenant`, all 77 models have `tenantId` | **Degraded** | Missing `fp()` wrapper on plugin encapsulates tenant resolution in sub-scopes. Super Admin queries omit tenant filter causing balance sum collapse. |
| **Employee Management** | `/employees`, `/employees/[id]`, `/employees/new`, `EmployeeTable.tsx` | `/api/v1/employees/*`, `GET`, `POST`, `PATCH`, `DELETE` | `Employee`, `Department`, `Designation`, `EmergencyContact` | **Working** | Core CRUD active. Soft deletion working. Export to CSV functional. Photo upload wired to Cloudinary. |
| **Department & Org Hierarchy** | `/departments`, `DepartmentTree.tsx`, `DepartmentModal.tsx` | `/api/v1/departments/*`, `GET`, `POST`, `PATCH`, `DELETE` | `Department` (hierarchical parent/child depth) | **Working** | Nested department hierarchy supported. Head employee assignment works. |
| **Attendance & Geofencing** | `/attendance`, `CheckInOutCard.tsx`, `AttendanceCalendar.tsx` | `/api/v1/attendance/check-in`, `/check-out`, `/records`, `/team/records`, `/today` | `AttendanceRecord`, `AttendanceRegularizationRequest`, `ShiftAssignment` | **Performance Hotspot** | Check-in/out works with IP/geofence metadata. `attendance.service.js:419` has N+1 holiday resolution query (3.7s latency for 70+ employees). |
| **Regularization Requests** | `/attendance/regularize`, `RegularizationDialog.tsx` | `/api/v1/attendance/regularization`, `/team/regularization`, `/:id/approve`, `/:id/deny` | `AttendanceRegularizationRequest` | **Working** | Requests submitted, approval workflows functioning. |
| **Leave Management & Balances** | `/leave`, `LeaveRequestModal.tsx`, `LeaveBalanceCard.tsx` | `/api/v1/leave/requests`, `/team/requests`, `/:id/approve`, `/:id/reject`, `/balance`, `/types` | `LeaveType`, `LeaveBalance`, `LeaveRequest`, `LeaveAuditLog` | **Contract Drift** | UI calls `GET /leave/requests/preview` (backend only implements `POST`). Reason validation allows 5 chars in UI but backend requires 10 chars. |
| **Leave Engine & Accrual** | Background cron / automated policies | `leaveEngine.service.js`, `leaveEngine.repository.js` | `LeavePolicy`, `LeaveAccrualRule`, `CompOffGrant`, `CompOffRequest` | **Logic Flaw** | Super admin balance query omits `employeeId`, summing entire tenant balances into one record. |
| **Payroll Calculation & Runs** | `/payroll`, `PayrollRunTable.tsx`, `SalarySlipModal.tsx` | `/api/v1/payroll/runs`, `/runs/:id/process`, `/runs/:id/approve`, `/payslips/:id` | `PayrollRun`, `Payslip`, `SalaryStructure`, `SalaryComponent` | **Simulated** | Computes basic net pay, but F&F settlement hardcodes `leaveEncashment: 0, gratuity: 0`. Statutory returns hardcode `rows: []`. |
| **Reports & BI Analytics** | `/reports`, `ReportFilters.tsx`, `ExportReportButton.tsx` | `/api/v1/reports/attendance`, `/reports/leaves`, `/reports/payroll`, `/reports/schedule` | Aggregations over Attendance, Leave, Payroll | **Fabricated** | `/reports/payroll*` in `reports.repository.js:669` uses hardcoded ₹80,000 gross and 12% flat deduction instead of live `Payslip` data. |
| **Analytics Dashboard** | `/dashboard`, `AnalyticsOverview.tsx`, `HeadcountChart.tsx` | `/api/v1/analytics/summary`, `/attendance`, `/headcount-by-department`, `/recent-activity` | Direct aggregation queries | **Working** | Real-time counts of headcount, attendance rates, leave distribution. No Redis cache hits (always `cached: false`). |
| **Manager Approvals** | `/manager/approvals`, `PendingApprovalsList.tsx` | `/api/v1/manager/dashboard`, `/manager/approvals`, `/leave-requests/:id/decision` | Multi-table joins | **Working** | Dedicated manager portal for approving team leave and regularizations. |
| **Employee Self-Service (ESS)** | `/portal`, `/profile`, `MyTeamCard.tsx`, `MyDocumentsCard.tsx` | `/api/v1/employee/dashboard`, `/documents`, `/team`, `/employees/me/*` | `EmployeeDocument`, `Employee` | **Working** | Document list and peer team directory wired with wireframe aliases. |
| **Document Vault & Storage** | `/documents`, `FileUploadZone.tsx` | `/api/v1/employees/:id/documents`, `/documents/:docId`, `/photo` | `EmployeeDocument`, `DocumentCategory` | **Working (Cloudinary)** | Uploads multipart directly to Cloudinary `dmljxhmio`. Graceful 503 if credentials missing. |
| **Notifications & Realtime** | Header Notification Bell, `NotificationDrawer.tsx` | `/api/v1/notifications/*`, `GET /stream` (SSE) | `Notification` | **Working** | SSE stream live at `/stream?token=...`. Read/read-all endpoints active. Bell badge count synced. |
| **Global Search** | Header Command Bar (`Ctrl+K`), `SearchModal.tsx` | `/api/v1/search?q=` | Full-text ILIKE across `Employee`, `Department`, `LeaveRequest`, `Holiday` | **Working** | Multi-entity instant search returning formatted categorized matches. |
| **Audit Logs & Compliance** | `/audit-logs`, `AuditLogTable.tsx` | `/api/v1/audit-logs/*`, `/dpia-report`, `/export` | `AuditLog` | **Working** | Comprehensive action tracking with IP, user agent, before/after JSON diffs. |
| **System Settings** | `/settings`, `/settings/tenants`, `/settings/roles` | `/api/v1/settings/tenant`, `/email-templates`, `/roles-permissions` | `TenantSettings`, `EmailTemplate`, `Role`, `Permission` | **Partial** | Tenant metadata and email templates editable. Fine-grained RBAC permissions API not wired to `authorize()`. |
| **Timesheets & Project Time** | `/timesheets` (UI stub) | Models in DB (`Timesheet`, `TimesheetEntry`, `TimesheetTemplate`) | Prisma migration `20260616080000` | **Backend Stub Only** | DB tables exist, but no active controllers or UI integration. |
| **Performance & Appraisals** | Missing in UI | Missing in backend | None | **Missing** | Zero support for OKRs, KPIs, 360 reviews, or performance appraisals. |
| **Recruitment & ATS** | Missing in UI | Missing in backend | None | **Missing** | Zero candidate tracking, job posting, interview pipeline, or offer letter generation. |
| **Asset Management** | Missing in UI | Missing in backend | None | **Missing** | No IT equipment assignment, serial tracking, or recovery workflows. |

---

## 2. API Contract Drift Breakdown

### Drift Case 1: Leave Request Preview
* **Frontend Implementation** (`ems-frontend/src/services/leaveService.ts:84`):
  ```typescript
  export const previewLeaveDays = async (payload: LeavePreviewPayload) => {
    return api.get('/leave/requests/preview', { params: payload });
  };
  ```
* **Backend Implementation** (`src/modules/leave/leave.routes.js:42`):
  ```javascript
  fastify.post('/requests/preview', { schema: previewSchema }, controller.preview);
  ```
* **Observed Failure**: When a user selects date ranges in the leave dialog, the frontend fires a `GET` request. Fastify returns `404 Route GET:/api/v1/leave/requests/preview not found`, breaking real-time deduction calculation.

### Drift Case 2: Validation String Length Mismatch
* **Frontend Schema** (`ems-frontend/src/schemas/leaveSchema.ts:18`):
  ```typescript
  reason: z.string().min(5, "Reason must be at least 5 characters"),
  ```
* **Backend Schema** (`src/modules/leave/leave.validator.js:29`):
  ```javascript
  reason: { type: 'string', minLength: 10, maxLength: 500 },
  ```
* **Observed Failure**: Submitting an 8-character reason passes frontend client-side validation, but Fastify AJV rejects it with `422 Unprocessable Entity: body/reason must NOT have fewer than 10 characters`, confusing end users.

### Drift Case 3: Attendance Regularization Type Missing Column
* **Frontend Payload**: Sends `{ date, checkIn, checkOut, reason, type: 'MISSED_CHECKOUT' }`.
* **Database Model**: `AttendanceRegularizationRequest` has columns `id`, `attendanceRecordId`, `requestedCheckIn`, `requestedCheckOut`, `reason`, `status`. No `type` column exists.
* **Backend Patch**: Service explicitly drops `type` before calling `prisma.attendanceRegularizationRequest.create()`, preventing 500 database crashes.

---

## 3. Realtime & Background Infrastructure Status

```mermaid
flowchart TD
    subgraph UI["Next.js Frontend (:3001)"]
        UI_SSE["Notification Bell (EventSource)"]
        UI_REQ["Axios Client (HTTP/REST)"]
    end

    subgraph BE["Fastify Backend (:4000)"]
        direction TB
        BE_ROOT["Root Router (/api/v1)"]
        BE_NOTIF["notifications.controller.js (SSE Stream)"]
        BE_LEAVE["leave.service.js"]
        BE_PAYROLL["payroll.service.js"]
        BE_ATTEND["attendance.service.js"]
    end

    subgraph DB["Hostinger VPS (187.126.125.239)"]
        PG[("PostgreSQL 16 :5432\n(77 Models / 78 Tables)")]
        RD[("Redis 7 :6379\n(Configured, BullMQ Removed)")]
    end

    UI_SSE -->|GET /notifications/stream?token=...| BE_NOTIF
    UI_REQ -->|REST API Requests| BE_ROOT
    BE_ROOT --> BE_LEAVE
    BE_ROOT --> BE_PAYROLL
    BE_ROOT --> BE_ATTEND
    BE_NOTIF --> PG
    BE_LEAVE --> PG
    BE_PAYROLL --> PG
    BE_ATTEND --> PG
    BE_ROOT -.->|Zero Op (Synchronous Mode)| RD
```

1. **Redis De-coupling**: BullMQ queues were stripped. All email sending (`emailJob.js`) and exports (`exportJob.js`) execute synchronously. While safe for small tenants, bulk payroll runs or 500+ employee report exports will block Fastify event loops.
2. **Notification SSE**: Fully operational without Redis PubSub by polling the Postgres `Notification` table or keeping direct client connections open in-memory. Multi-instance horizontal scaling on Render or Kubernetes will require Redis adapter enablement.
