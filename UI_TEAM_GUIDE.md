# EMS UI Team Integration Guide

**The only document the UI team needs.** Maps every wireframe page to the exact APIs that power it, lists test users for every role, and explains the auth flow.

- **Production API base:** `https://employee-management-system-2b9q.onrender.com/api/v1`
- **Swagger UI:** `https://employee-management-system-2b9q.onrender.com/docs/static/index.html`
- **Backend status:** Live. 90 endpoints. All bug fixes deployed `2026-05-22`.
- **Last verified:** `2026-05-22` — all known bugs fixed. See §7 for status per endpoint.

---

## 1. Authentication — Read This First

### 1.1 Header requirements (updated 2026-05-19)

| Header           | When required                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Authorization`  | On every authenticated route. Format: `Bearer <accessToken>` (the `Bearer ` prefix is optional).                  |
| `X-Tenant-Key`   | **Not required.** Login auto-resolves tenant from email; the JWT then carries it. Only needed for cross-tenant emails (rare). |

For step-by-step Swagger walkthrough with screenshots, see [SWAGGER_TESTING_GUIDE.md](./SWAGGER_TESTING_GUIDE.md).

### 1.2 Login flow

```http
POST /api/v1/auth/login
Content-Type: application/json
X-Tenant-Key: test-key-123456789

{ "email": "admin@testorg.com", "password": "password123" }
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIi...c8c",
    "sessionId": "07602406c2e0cd0790f05926",
    "user": {
      "id": "cmpbjdqp90002wysvug0xd6t4",
      "email": "admin@testorg.com",
      "memberType": "HR_ADMIN",
      "employee": { "firstName": "Emma", "lastName": "Davis", "employeeCode": "EMP0001" }
    },
    "permissions": []
  }
}
```

- Token lifetime: **15 minutes**. On `401 INVALID_TOKEN` → call `POST /auth/refresh` (uses httpOnly cookie automatically) to get a new token without re-login. Full re-login only needed if refresh also fails.
- Store `accessToken` in memory (not localStorage). Refresh token cookie is set automatically by the browser — do not touch it.
- When pasting the token into Swagger UI's **Authorize** dialog, copy **only** the value between the quotes — do not include the quote characters or anything after.

### 1.3 Refresh

```http
POST /api/v1/auth/refresh        // uses httpOnly cookie, no body needed
```

Returns a fresh `accessToken`.

### 1.4 Common error codes

| Code                       | When                                                     |
| -------------------------- | -------------------------------------------------------- |
| `INVALID_CREDENTIALS`      | Wrong email/password OR user not in that tenant          |
| `INVALID_TOKEN`            | Malformed JWT or signature mismatch                      |
| `MISSING_TENANT`           | `X-Tenant-Key` header missing                            |
| `UNAUTHORIZED`             | No `Authorization` header                                |
| `FORBIDDEN`                | User role lacks permission for this endpoint             |
| `NO_EMPLOYEE_RECORD`       | User has no employee profile linked (cannot check-in etc.) |

---

## 2. Test Users — One per Role

All passwords reset to known values on `2026-05-19`. Use these for every role-specific wireframe.

| Email                      | Password        | Tenant Key            | Role          | Employee Linked          | Tests Wireframe Pages       |
| -------------------------- | --------------- | --------------------- | ------------- | ------------------------ | --------------------------- |
| `superadmin@acme.test`     | `Password123!`  | `acme-corp-001`       | `SUPER_ADMIN` | none                     | 14 (Permissions Matrix)     |
| `hr@acme.test`             | `Password123!`  | `acme-corp-001`       | `HR_ADMIN`    | HR Admin (E0003)         | 04, 07, 08, 09, 10, 15      |
| `admin@testorg.com`        | `password123`   | `test-key-123456789`  | `HR_ADMIN`    | Emma Davis (EMP0001)     | 04, 07, 08, 09, 10, 13, 15  |
| `aman@acme.test`           | `Password123!`  | `acme-corp-001`       | `MANAGER`     | Aman Kumar (E0001)       | 05, 11, 12                  |
| `priya@acme.test`          | `Password123!`  | `acme-corp-001`       | `EMPLOYEE`    | Priya Sharma (E0002)     | 06, 11, 12                  |

**Tenant rule:** `acme-corp-001` users see their own data. `test-key-123456789` is a larger demo tenant with 20 employees, 503 attendance records, real holidays, real departments — use it for list/dashboard density testing.

---

## 3. Role × Page Matrix

| Page                             | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
| -------------------------------- | :---------: | :------: | :-----: | :------: |
| 01 Login                         |      ✅     |    ✅    |    ✅   |    ✅    |
| 02 Forgot Password               |      ✅     |    ✅    |    ✅   |    ✅    |
| 03 OTP Verification              |      ✅     |    ✅    |    ✅   |    ✅    |
| 04 Dashboard — HR Admin          |      ✅     |    ✅    |    ❌   |    ❌    |
| 05 Dashboard — Manager           |      ✅     |    ✅    |    ✅   |    ❌    |
| 06 Dashboard — Employee          |      ✅     |    ✅    |    ✅   |    ✅    |
| 07 Employees — List              |      ✅     |    ✅    |    ✅¹  |    ❌    |
| 08 Employees — Profile           |      ✅     |    ✅    |    ✅¹  |    ✅²   |
| 09 Employees — Create / Edit     |      ✅     |    ✅    |    ❌   |    ❌    |
| 10 Departments                   |      ✅     |    ✅    |    ✅³  |    ❌    |
| 11 Attendance — Records          |      ✅     |    ✅⁴   |    ✅⁵  |    ✅⁶   |
| 12 Leave — Requests & Approvals  |      ✅     |    ✅    |    ✅⁷  |    ✅⁸   |
| 13 Holiday Calendar              |      ✅     |    ✅    |    ✅   |    ✅    |
| 14 Permissions Matrix            |      ✅     |    ❌    |    ❌   |    ❌    |
| 15 Settings                      |      ✅     |    ✅    |    ❌   |    ❌    |

¹ Manager sees only their direct reports.   ² Employee sees only their own profile.
³ Manager: read-only.   ⁴ HR sees all.   ⁵ Manager sees own + team.   ⁶ Employee sees only own.
⁷ Manager sees own + team approvals.   ⁸ Employee sees only own requests.

---

## 4. Wireframe → API Mapping (One Section Per Page)

> Every endpoint listed has been verified against the live deploy on `2026-05-19`.

### Page 01 — Login

| UI Action          | Method | Endpoint                       | Notes                                       |
| ------------------ | ------ | ------------------------------ | ------------------------------------------- |
| Submit form        | POST   | `/auth/login`                  | Body: `{ email, password }`                 |
| MFA flow (Phase 2) | POST   | `/auth/verify-otp`             | After OTP redirect                          |

### Page 02 — Forgot Password

| UI Action       | Method | Endpoint                            |
| --------------- | ------ | ----------------------------------- |
| Send reset link | POST   | `/auth/forgot-password`             |
| Validate token  | GET    | `/auth/validate-reset-token?token=…` |
| Set new password | POST  | `/auth/reset-password`              |

### Page 03 — OTP Verification

| UI Action          | Method | Endpoint              |
| ------------------ | ------ | --------------------- |
| Verify code        | POST   | `/auth/verify-otp`    |
| Resend code        | POST   | `/auth/resend-otp`    |

### Page 04 — Dashboard (HR Admin)

| Card                       | Method | Endpoint                                      | Test as                |
| -------------------------- | ------ | --------------------------------------------- | ---------------------- |
| Stat cards (4 KPIs)        | GET    | `/analytics/summary`                          | `admin@testorg.com`*   |
| Attendance — last 30 days  | GET    | `/analytics/attendance?range=30d`             | `admin@testorg.com`*   |
| Headcount by Department    | GET    | `/analytics/headcount-by-department`          | `admin@testorg.com`*   |
| Recent Activity            | GET    | `/audit-logs?limit=10`                        | `admin@testorg.com`    |

\* Note: `/analytics/*` currently returns `403 FORBIDDEN` for the seeded HR_ADMIN users because the role-permission seed doesn't grant `analytics:read`. Test as SUPER_ADMIN, or assign the permission in `/settings/roles-permissions`.

### Page 05 — Dashboard (Manager)

| Card                          | Method | Endpoint                                | Test as              |
| ----------------------------- | ------ | --------------------------------------- | -------------------- |
| Team size + present today     | GET    | `/manager/dashboard`                    | `aman@acme.test`     |
| Pending approvals queue       | GET    | `/manager/approvals`                    | `aman@acme.test`     |
| Approve / Deny leave          | PATCH  | `/manager/leave-requests/:id/decision`  | `aman@acme.test`     |
| Bulk approve                  | PATCH  | `/leave/requests/:id/approve` (loop)    | `aman@acme.test`     |
| Team attendance grid          | GET    | `/manager/team/attendance`              | `aman@acme.test`     |
| View team                     | GET    | `/manager/team`                         | `aman@acme.test`     |

### Page 06 — Dashboard (Employee)

| Card                       | Method | Endpoint                              | Test as              |
| -------------------------- | ------ | ------------------------------------- | -------------------- |
| Today's attendance card    | GET    | `/employee/dashboard`                 | `priya@acme.test`    |
| Today's check-in status    | POST   | `/attendance/check-in`                | `priya@acme.test`    |
| Check out                  | POST   | `/attendance/check-out`               | `priya@acme.test`    |
| Leave balance              | GET    | `/leave/balance`                      | `priya@acme.test`    |
| Upcoming holidays          | GET    | `/holidays?year=2026`                 | any                  |
| My documents               | GET    | `/employee/documents` OR `/employees/me/documents` | `priya@acme.test` — both paths work |
| My team                    | GET    | `/employee/team` OR `/employees/me/team` | `priya@acme.test` — both paths work |
| Request leave drawer       | POST   | `/leave/requests`                     | `priya@acme.test`    |
| Leave type dropdown        | GET    | `/leave/types`                        | any — get leaveTypeId for POST body |

### Page 07 — Employees List

| UI Action               | Method | Endpoint                                                                   |
| ----------------------- | ------ | -------------------------------------------------------------------------- |
| Load list (paginated)   | GET    | `/employees?page=1&limit=20&search=&departmentId=&status=&location=`       |
| Row click → profile     | GET    | `/employees/:id`                                                           |
| Add Employee button     | POST   | `/employees`                                                               |
| Export                  | GET    | `/employees/export/csv`                                                    |

Filter params supported by `GET /employees`: `page`, `limit`, `search`, `departmentId`, `status` (`ACTIVE|INACTIVE|ON_LEAVE|RESIGNED|TERMINATED`), `location`.

### Page 08 — Employee Profile

| Section / Tab    | Method | Endpoint                                          |
| ---------------- | ------ | ------------------------------------------------- |
| Header + Overview | GET   | `/employees/:id`                                  |
| Documents tab    | GET    | `/employees/:id/documents?limit=…`                |
| Attendance tab   | GET    | `/attendance/records?employeeId=:id`              |
| Leave tab        | GET    | `/leave/requests?employeeId=:id`                  |
| Activity tab     | GET    | `/audit-logs?entity=employee&id=:id&limit=20`     |
| Edit button      | PATCH  | `/employees/:id`                                  |
| Deactivate       | PATCH  | `/employees/:id` (body: `{ employmentStatus: "INACTIVE" }`) |

### Page 09 — Employees Create / Edit

| UI Action         | Method | Endpoint                  |
| ----------------- | ------ | ------------------------- |
| Create (4 steps)  | POST   | `/employees`              |
| Update            | PATCH  | `/employees/:id`          |
| Async department dropdown | GET | `/departments?fields=id,name` |

Required body fields for POST: `employeeCode`, `firstName`, `lastName`, `workEmail`, `designation`, `joinedOn` (ISO date), `employmentType` (`FULL_TIME|PART_TIME|CONTRACT|INTERN`).

### Page 10 — Departments

| UI Action                  | Method | Endpoint                  |
| -------------------------- | ------ | ------------------------- |
| Load tree                  | GET    | `/departments`            |
| Department detail          | GET    | `/departments/:id`        |
| Add department             | POST   | `/departments`            |
| Edit / move                | PATCH  | `/departments/:id`        |
| Delete (offers reassign)   | DELETE | `/departments/:id`        |

### Page 11 — Attendance Records

| View / Action            | Method | Endpoint                                                          |
| ------------------------ | ------ | ----------------------------------------------------------------- |
| Calendar (own)           | GET    | `/attendance/records?employeeId=…&month=YYYY-MM`                  |
| Team table (manager)     | GET    | `/attendance/team/records?month=YYYY-MM&departmentId=…`            |
| Month summary            | GET    | `/attendance/summary?employeeId=…&fromDate=…&toDate=…`            |
| Regularize (open drawer) | POST   | `/attendance/regularization`                                      |
| My regularizations       | GET    | `/attendance/regularization`                                      |
| Team regularizations     | GET    | `/attendance/team/regularization`                                 |
| Approve regularization   | PATCH  | `/attendance/regularization/:id/approve`                          |
| Deny regularization      | PATCH  | `/attendance/regularization/:id/deny`                             |
| Export                   | POST   | `/export/attendance` (returns 202 with `job_id`)                  |
| Download export          | GET    | `/export/:job_id/download`                                        |

### Page 12 — Leave Requests & Approvals

| Tab / Action          | Method | Endpoint                                  |
| --------------------- | ------ | ----------------------------------------- |
| My Requests           | GET    | `/leave/requests`                         |
| Approvals (manager)   | GET    | `/leave/team/requests?status=PENDING`     |
| Team Calendar         | GET    | `/leave/team/requests?month=YYYY-MM`      |
| Balances              | GET    | `/leave/balance`                          |
| Submit request        | POST   | `/leave/requests`                         |
| Approve               | PATCH  | `/leave/requests/:id/approve`             |
| Reject (with comment) | PATCH  | `/leave/requests/:id/reject`              |
| Withdraw (own)        | PATCH  | `/leave/requests/:id/withdraw`            |

Body for POST `/leave/requests`: `{ leaveTypeId, startDate, endDate, reason }`. Get `leaveTypeId` from `GET /leave/types` (returns id, name, code per type) or from `/leave/balance` (also returns leaveTypeId).

### Page 13 — Holiday Calendar

| UI Action            | Method | Endpoint                              |
| -------------------- | ------ | ------------------------------------- |
| Load year view       | GET    | `/holidays?year=2026`                 |
| Add holiday          | POST   | `/holidays`                           |
| Edit                 | PATCH  | `/holidays/:id`                       |
| Delete               | DELETE | `/holidays/:id`                       |

Body for POST: `{ name, holidayDate (ISO), location, isOptional }`. Use field name `holidayDate`, **not** `date`.

### Page 14 — Permissions Matrix (Super Admin only)

| UI Action                       | Method | Endpoint                                    |
| ------------------------------- | ------ | ------------------------------------------- |
| Load matrix                     | GET    | `/settings/roles-permissions`               |
| Save changes (bulk patch)       | PATCH  | `/settings/roles-permissions`               |

### Page 15 — Settings

| Sidebar Section / Item        | Method | Endpoint                                |
| ----------------------------- | ------ | --------------------------------------- |
| Company profile               | GET    | `/settings/tenant`                      |
| Save company profile          | PATCH  | `/settings/tenant`                      |
| Email templates list          | GET    | `/settings/email-templates`             |
| Update template               | PATCH  | `/settings/email-templates/:type`       |
| Audit log                     | GET    | `/audit-logs`                           |
| Sessions & devices            | GET    | `/auth/sessions`                        |
| Revoke a session              | DELETE | `/auth/sessions/:sessionId`             |
| Sign out all devices          | POST   | `/auth/logout-all`                      |

---

## 5. Cross-Cutting APIs (Used on Multiple Pages)

| Concern               | Method | Endpoint                            | Used By                       |
| --------------------- | ------ | ----------------------------------- | ----------------------------- |
| Current user          | GET    | `/auth/me`                          | Topbar, RoleSwitch            |
| Topbar search         | GET    | `/employees?search=…&limit=10`      | All authenticated pages       |
| Audit / Activity feed | GET    | `/audit-logs?…`                     | Pages 04, 08, 15              |
| Notifications list    | GET    | `/audit-logs?actor=me`              | Toast / badge counter         |
| System logs (admin)   | GET    | `/admin/logs`                       | Page 15 → Security → Logs     |
| Log stream (SSE)      | GET    | `/admin/logs/stream`                | Live tail panel               |
| Reports               | GET    | `/reports/attendance`, `/reports/leaves`, `/reports/payroll` | Optional reports module |

---

## 6. Permission Notes

The seeded `HR_ADMIN` role does **not** include `analytics:read` in the production data, so `/analytics/*` endpoints will return `403 FORBIDDEN` until you either:

- Test those endpoints as `SUPER_ADMIN`, or
- Edit the permission matrix via Page 14 to grant `analytics:read` to `HR_ADMIN`.

Same caveat for `permissions:manage` (only `SUPER_ADMIN`) and the strict role-restricted manager routes when called as a non-manager.

---

## 7. Quick API Status Reference (Verified 2026-05-19)

```
✅ /auth/login, /auth/me, /auth/sessions, /auth/logout-all       → 200
✅ /employees (GET, GET :id, POST, PATCH, DELETE, export/csv)    → 200/201
✅ /departments (GET, GET :id, POST, PATCH, DELETE)              → 200/201
✅ /holidays (GET, GET :id, POST, PATCH, DELETE)                 → 200/201
✅ /attendance/records, /attendance/summary                       → 200
✅ /attendance/team/records, /attendance/team/regularization     → 200
✅ /attendance/regularization (GET, POST, PATCH :id approve|deny)→ 200/201
✅ /leave/types                                                    → 200
✅ /leave/balance, /leave/requests (GET, POST)                    → 200/201
✅ /leave/team/requests, /leave/requests/:id/{approve,reject,withdraw} → 200
✅ /export/list, /export/employees, /export/attendance, /export/leave  → 200/202
✅ /reports/attendance, /reports/leaves, /reports/scheduled       → 200
✅ /audit-logs, /settings/tenant, /settings/email-templates       → 200
✅ /admin/logs                                                    → 200

⚠️  /attendance/check-in, /check-out, /attendance/today           → 400 NO_EMPLOYEE_RECORD
    (only for users without a linked employee — use priya@acme.test or aman@acme.test)
⚠️  /employee/dashboard, /employee/team, /employee/documents      → 400 NO_EMPLOYEE_RECORD
    (same reason — superadmin@acme.test has no employee record linked)
⚠️  /analytics/*                                                  → 403 FORBIDDEN
    (HR_ADMIN role seed lacks analytics:read — see §6)
⚠️  /manager/dashboard, /manager/team, /manager/approvals         → 403 FORBIDDEN
    (only MANAGER role — use aman@acme.test)
⚠️  /settings/roles-permissions                                   → 403 FORBIDDEN
    (SUPER_ADMIN only — use superadmin@acme.test)
```

---

## 8. Common Questions

**Q: "I get 401 INVALID_TOKEN even after login."**
A: You copied extra text after the token (a quote, a comma, the `sessionId` JSON field). The middleware now strips this automatically — but for clarity, copy **only** the long string starting with `eyJ` and stop before the closing quote.

**Q: "Same email, same password, getting INVALID_CREDENTIALS."**
A: The user belongs to a different tenant than the `X-Tenant-Key` you sent. Check §2 for the right tenant key per user.

**Q: "Check-in returns 400 NO_EMPLOYEE_RECORD."**
A: The logged-in user has no Employee row linked. Test attendance flows as `priya@acme.test` (has Priya Sharma E0002 linked). The `admin@testorg.com` user is now linked to Emma Davis (EMP0001) and can also test these.

**Q: "Analytics dashboard returns 403."**
A: Role doesn't have `analytics:read`. Either grant it via Page 14, or test as `superadmin@acme.test`.

**Q: "How long does the token last?"**
A: 15 minutes. After 401, call `POST /auth/refresh` to get a new token without re-logging in. The refresh token lives in an httpOnly cookie and lasts 7 days. Full re-login only needed after 7 days of inactivity.

**Q: "Can I skip the X-Tenant-Key header?"**
A: After login, yes — the JWT carries `tenantId`, so all subsequent calls need only `Authorization: Bearer <token>`. For the initial `/auth/login` call, the header is also optional if your email is unique across all tenants. It's only required if you get `AMBIGUOUS_EMAIL` (same email in multiple tenants).

---

## 9. Where to Find More

- **Live Swagger UI:** every endpoint, every parameter, every response shape — already authoritative.
- **`WIREFRAMES_API_MAPPING.md`:** same mapping with wireframe images per page.
- **`DATABASE_SCHEMA.md`:** ER diagram + table fields.
- **`DEVELOPER_SETUP.md`:** how to run the backend locally.
- **`RENDER_DEPLOYMENT_GUIDE.md`:** production deployment.

If anything here drifts from Swagger, **Swagger is the source of truth**.
