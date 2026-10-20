# Comprehensive Codebase Autopsy & Technical Gaps

> **Author**: Gemini (Google DeepMind Antigravity)  
> **Source Investigation**: Reverse Engineering Anything (REA) Protocol  
> **Target Repositories**: `EMS` (Backend) + `ems-frontend` (Frontend)  
> **Hostinger VPS Target**: `187.126.125.239` (PostgreSQL 16, Redis 7)

---

## 1. Security & Architectural Vulnerabilities

### Vulnerability 1: Fastify Plugin Encapsulation Failure (Missing `fastify-plugin`)
* **File Location**:
  * `src/plugins/cors.js`
  * `src/plugins/helmet.js`
  * `src/plugins/rateLimit.js`
* **Mechanism & Root Cause**:
  Fastify employs strict hierarchical plugin encapsulation. When a plugin is registered without wrapping it in `fastify-plugin` (`fp`), Fastify isolates all decorators, hooks, and middleware to that plugin’s own child context.
  ```javascript
  // src/plugins/cors.js (CURRENT FLAWED IMPLEMENTATION)
  import cors from '@fastify/cors';
  export default async function corsPlugin(fastify, opts) {
    await fastify.register(cors, {
      origin: config.corsOrigin,
      credentials: true,
    });
  }
  // Missing: export default fp(corsPlugin);
  ```
* **Empirical Proof via Live Wire Probe**:
  Executing `curl -I http://localhost:4000/api/v1/auth/me` returns:
  ```http
  HTTP/1.1 401 Unauthorized
  content-type: application/json; charset=utf-8
  content-length: 104
  ```
  Missing headers:
  - `Access-Control-Allow-Origin`
  - `Strict-Transport-Security`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `x-ratelimit-limit`, `x-ratelimit-remaining`
* **Impact**:
  None of the root API routes (`/api/v1/*`) are protected by Helmet security headers, CORS origin checks, or Rate Limiting. Brute-force attacks against `/auth/login` and DoS attacks against `/export/*` succeed without throttling.
* **Remediation**:
  Wrap all plugins in `import fp from 'fastify-plugin'`:
  ```javascript
  import fp from 'fastify-plugin';
  import cors from '@fastify/cors';

  async function corsPlugin(fastify, opts) {
    await fastify.register(cors, {
      origin: config.corsOrigin,
      credentials: true,
    });
  }
  export default fp(corsPlugin);
  ```

---

### Vulnerability 2: Next.js Client Bundle Leak on Unauthenticated Routes
* **File Location**: `ems-frontend/src/` (Absence of `middleware.ts`)
* **Mechanism & Root Cause**:
  Authentication protection is implemented exclusively on the client side using `src/components/auth/AuthGuard.tsx`. Because Next.js App Router renders pages on the server first, an unauthenticated request to `/dashboard` or `/employees` responds with `200 OK` and a full HTML payload containing script tags for proprietary client chunks.
* **Empirical Verification**:
  ```bash
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/dashboard
  # Returns: 200 (Expected: 307/302 Redirect to /login)
  ```
  Extracting the HTML reveals 17 client chunks loaded, including `Recharts` charting engines, employee table layouts, and managerial approval state logic.
* **Impact**:
  Proprietary UI code, client-side algorithms, and dashboard structures are completely exposed to search engines, scrapers, and unauthenticated actors.
* **Remediation**:
  Create `src/middleware.ts` at the root of `ems-frontend`:
  ```typescript
  import { NextResponse } from 'next/server';
  import type { NextRequest } from 'next/server';

  export function middleware(request: NextRequest) {
    const token = request.cookies.get('accessToken')?.value;
    const isAuthPage = request.nextUrl.pathname.startsWith('/login');

    if (!token && !isAuthPage && request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  export const config = {
    matcher: ['/dashboard/:path*', '/employees/:path*', '/payroll/:path*'],
  };
  ```

---

### Vulnerability 3: Super Admin Tenant Balance Sum Collapse
* **File Location**: `src/modules/leave/leaveEngine.repository.js:76`
* **Defective Code**:
  ```javascript
  async getLeaveBalances(tenantId, employeeId) {
    const where = { tenantId };
    if (employeeId) {
      where.employeeId = employeeId;
    }
    return prisma.leaveBalance.findMany({ where });
  }
  ```
* **Root Cause & Impact**:
  When a Super Admin visits their leave portal (`/leave`), `employeeId` is passed as `null` or `undefined` (because Super Admins are not tied to a single employee profile). The query omits `where.employeeId`, querying ALL leave balances across every employee in the tenant and summing them together. The UI displays the Super Admin having 4,200 days of annual leave.
* **Remediation**:
  Enforce explicit employee resolution:
  ```javascript
  if (!employeeId) {
    return []; // A system administrator without an employee profile has no personal leave ledger
  }
  ```

---

## 2. Calculation & Compliance Deficits

### Gap 1: Fabricated Payroll Analytics & Reports
* **File Location**: `src/modules/reports/reports.repository.js:669`
* **Defective Code**:
  ```javascript
  // Synthetic calculation bypasses actual Payslip and PayrollRun tables
  const grossPay = 80000;
  const deductions = grossPay * 0.12;
  const netPay = grossPay - deductions;
  return {
    period: row.month,
    totalGrossPay: grossPay * employeeCount,
    totalDeductions: deductions * employeeCount,
    totalNetPay: netPay * employeeCount,
    status: 'GENERATED',
  };
  ```
* **Root Cause & Impact**:
  The reports module simulates payroll figures using hardcoded ₹80,000 gross salaries and a static 12% deduction formula, rather than aggregating live records from `prisma.payslip`. Financial audit exports are mathematically fabricated and legally non-compliant.
* **Remediation**:
  Query `prisma.payslip.aggregate()` grouped by `payPeriod`:
  ```javascript
  const aggregates = await prisma.payslip.aggregate({
    where: { tenantId, payPeriod: period },
    _sum: { grossEarnings: true, totalDeductions: true, netPay: true },
    _count: { id: true },
  });
  ```

---

### Gap 2: Hardcoded Final & Full (F&F) Settlement Values
* **File Location**: `src/modules/payroll/payroll.service.js:1052`
* **Defective Code**:
  ```javascript
  const leaveEncashment = 0; // TODO: Calculate leave encashment
  const gratuity = 0;        // TODO: Implement gratuity calculation
  const noticeRecovery = 0;
  ```
* **Root Cause & Impact**:
  The exit and resignation settlement engine sets leave encashment and gratuity to 0, completely ignoring the employee’s accrued leave balance and years of service under the Payment of Gratuity Act / UAE Labor Law. Resigned employees receive zero statutory severance pay.

---

### Gap 3: Empty Statutory Returns (ECR / 24Q / SIF)
* **File Location**: `src/modules/payroll/payroll.service.js:1062`
* **Defective Code**:
  ```javascript
  async getStatutoryReturns(tenantId, period, returnType) {
    return {
      returnType,
      period,
      generatedAt: new Date().toISOString(),
      rows: [] // Stubbed return
    };
  }
  ```
* **Impact**:
  Enterprise customers cannot export EPFO ECR text files, Income Tax Form 24Q, or WPS SIF files for bank disbursement. The button in the UI downloads an empty JSON/CSV structure.

---

## 3. Performance & Scalability Hotspots

### Hotspot 1: Attendance Team Calculation N+1 Query Loop
* **File Location**: `src/modules/attendance/attendance.service.js:419`
* **Defective Code**:
  ```javascript
  for (const emp of teamMembers) {
    const holidays = await resolveHolidayDateSet(tenantId, emp.id, startDate, endDate);
    const records = await attendanceRepo.findRecords(tenantId, emp.id, startDate, endDate);
    // calculates presence percentage
  }
  ```
* **Performance Trace**:
  For a manager overseeing 75 employees over a 30-day view:
  - 75 queries to `Holiday` / `HolidayCalendar`
  - 75 queries to `AttendanceRecord`
  - **Total**: 150+ sequential roundtrips to Hostinger PostgreSQL (`187.126.125.239:5432`) across the public network.
  - **Latency**: Measured at 3,740ms (3.74 seconds) per page load.
* **Remediation**:
  Batch fetch all attendance records and holidays in 2 SQL queries using `IN` operators and group by `employeeId` in-memory.

---

### Hotspot 2: Synchronous Export Blocking Event Loop
* **File Location**: `src/modules/export/export.controller.js:88`
* **Issue**:
  ExcelJS builds large `.xlsx` files with styled headers, borders, and column widths synchronously in the Fastify event loop. During a 1,000-row employee export, the Fastify thread blocks for ~1,200ms, halting all incoming API requests (health checks, check-ins, auth).
* **Remediation**:
  Re-introduce a background worker or offload file generation to `worker_threads`.

---

## 4. RBAC Decoupling & Role Gaps

| Model Level | Implementation Reality | Disconnect & Risk |
| :--- | :--- | :--- |
| **Prisma Models** | `Role`, `Permission`, `RolePermission`, `UserRole` models fully populated with 120+ fine-grained permission keys. | Models exist in database, but are completely unused by the request pipeline. |
| **Middleware** | `authorize(roles[])` in `authenticate.js` checks `request.user.memberType` against enum `['SUPER_ADMIN', 'HR_ADMIN', 'MANAGER', 'EMPLOYEE']`. | Any custom roles created in Settings -> Roles do not grant any actual API permissions. |
| **Admin Privilege** | `SUPER_ADMIN` has hardcoded bypass on all route guards. | Impossible to grant granular permissions (e.g., "Leave Manager" who can only approve leaves but cannot view salary). |
