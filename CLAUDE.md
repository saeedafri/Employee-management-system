# EMS — Employee Management System (Backend)
> Last deep-analysis: 2026-05-27

## Project Overview
Production-grade multi-tenant HRMS REST API. Fastify v4 + Prisma + PostgreSQL.  
Deployed on **Render**. GitHub: `github.com/saeedafri/Employee-management-system`

---

## Stack
| Layer | Technology |
|-------|-----------|
| Framework | Fastify v4 (ES modules) |
| ORM | Prisma v5 |
| DB | PostgreSQL (Render) |
| Auth | JWT access tokens + refresh token rotation (httpOnly cookie) |
| Password | Argon2id (type:2, memoryCost:19456, timeCost:2, parallelism:1) |
| Email | **Resend** (HTTP API via `RESEND_API_KEY`) — `emailJob.js` uses Resend directly; `EMAIL_PROVIDER` env var not used by password reset/OTP flows |
| File Storage | **Cloudinary** (live on Render) — cloud `dmljxhmio`; `CLOUDINARY_*` env vars on Render + local `.env` |
| Export | Real XLSX via ExcelJS — styled headers, alternating rows, auto-width |
| Queue | **REMOVED** — Redis/BullMQ removed; all ops are synchronous |
| Docs | Swagger UI at `/docs` |
| Deploy | Render Web Service + Render PostgreSQL |
| Tests | Mocha + Chai + Supertest (unit + integration + e2e) |
| Node | >= 20.0.0 (ES modules, `type: "module"`) |

---

## Git
- **Branch**: `main` (only branch, ~30+ commits)
- **Remote**: `https://github.com/saeedafri/Employee-management-system.git`
- **Auth token in remote URL**: stored in `.env` as `GITHUB_TOKEN` — see local `.env` file
- **Latest commit**: `9bdd417` (Add WIREFRAMES_API_MAPPING.md)
- **You are allowed to commit and push** — user has granted explicit permission
- **Staged but uncommitted**: `CLAUDE.md` (new file)

---

## Database
| Field | Value |
|-------|-------|
| Provider | PostgreSQL |
| Host | `dpg-d85jt2p9rddc73af0so0-a.oregon-postgres.render.com` |
| DB Name | `employee_m2e9` |
| User | `employee_m2e9_user` |
| Password | `<see .env file — DATABASE_URL>` |
| SSL | required |
| Migrations | Single migration: `20260518155048_init` |
| ORM | Prisma v5 (no raw SQL — always use Prisma client) |

### DB Connection (external)
```
postgresql://employee_m2e9_user:<password>@dpg-d85jt2p9rddc73af0so0-a.oregon-postgres.render.com/employee_m2e9?sslmode=require
```

### Tenants in DB
| tenantKey | Name | Used for |
|-----------|------|---------|
| `acme-corp-001` | Acme Corp | **Main tenant — all seeded users belong here** |
| `test-key-123456789` | Test Org | Secondary test tenant |

### Seeded Users
| Role | Email | Password | Tenant |
|------|-------|---------|--------|
| SUPER_ADMIN | `superadmin@acme.test` | `Password123!` | acme-corp-001 |
| HR_ADMIN | `hr@acme.test` | `Password123!` | acme-corp-001 |
| MANAGER | `aman@acme.test` | `Password123!` | acme-corp-001 |
| EMPLOYEE | `priya@acme.test` | `Password123!` | acme-corp-001 |
| MANAGER | `riya@acme.test` | `Password123!` | acme-corp-001 |
| EMPLOYEE | `dev1@acme.test` | `Password123!` | acme-corp-001 |
| EMPLOYEE | `dev2@acme.test` | `Password123!` | acme-corp-001 |
| EMPLOYEE | `fin1@acme.test` | `Password123!` | acme-corp-001 |
| EMPLOYEE | `onleave@acme.test` | `Password123!` | acme-corp-001 |
| HR_ADMIN | `admin@testorg.com` | `password123` | test-key-123456789 |

> **Comprehensive seed** run on 2026-05-23: 79 employees, 23 leave requests (PENDING/APPROVED/DENIED/WITHDRAWN/CANCELLED), 523 attendance records (varied WFH/ABSENT/HALF_DAY), 8 leave types, 19 holidays, 6 sub-departments.
> Run again anytime with `npm run db:seed:comprehensive` (additive, safe).

---

## Render Deployment
| Field | Value |
|-------|-------|
| Service ID | `srv-d85k6cl8nd3s73drar50` |
| Service Name | `Employee-management-system` |
| Live URL | `https://employee-management-system-2b9q.onrender.com` |
| API Base | `https://employee-management-system-2b9q.onrender.com/api/v1` |
| Swagger UI | `https://employee-management-system-2b9q.onrender.com/docs` |
| Render API Key | `<see .env file — RENDER_API_KEY>` |
| Health check | `/health` and `/healthz` (both return `{status: "ok"}`) |

### Render Env Vars (key ones)
- `CORS_ORIGIN` = `http://localhost:3000,http://localhost:3001,http://localhost:5173`
- `NODE_ENV` = `production`
- `DATABASE_URL` = internal Render PostgreSQL URL (not the external one above)

---

## File Structure
```
EMS/
├── src/
│   ├── app.js                    — Fastify factory, plugin + route registration
│   ├── server.js                 — Entry point (calls createApp, listen)
│   ├── config/
│   │   ├── index.js              — All env-based config (JWT, CORS, DB, email, etc.)
│   │   └── redis.js              — Returns null (Redis removed)
│   ├── jobs/
│   │   ├── emailJob.js           — Dead code (queue removed, returns null)
│   │   ├── emailQueue.js         — Dead code (exports null)
│   │   ├── exportJob.js          — Dead code
│   │   └── exportQueue.js        — Dead code
│   ├── middleware/
│   │   ├── authenticate.js       — JWT verify + authorize(roles[]) for role checks
│   │   ├── resolveTenant.js      — x-tenant-key → JWT-decoded tenantId → DEFAULT_TENANT_KEY
│   │   ├── errorHandler.js       — Global Fastify error handler
│   │   └── requestLogging.js     — Per-request logging hook
│   ├── plugins/
│   │   ├── prisma.js             — Prisma client as Fastify decorator
│   │   ├── cors.js               — @fastify/cors using config.corsOrigin
│   │   ├── helmet.js             — @fastify/helmet
│   │   ├── rateLimit.js          — @fastify/rate-limit
│   │   ├── requestId.js          — Unique request IDs
│   │   ├── redis.js              — Returns null (Redis removed)
│   │   └── swagger.js            — Swagger/OpenAPI spec (registered AFTER routes)
│   ├── modules/
│   │   ├── analytics/            — routes, controller, service, repository, policy, validator
│   │   ├── attendance/           — routes, controller, service, repository, validator
│   │   ├── auditLogs/            — routes, controller, service, repository, validator
│   │   ├── auth/                 — routes, controller, service, repository, policy, validator
│   │   │                           + otp.*, passwordReset.*
│   │   ├── dashboard/
│   │   │   ├── manager.*         — routes, controller, service
│   │   │   └── employee.*        — routes, controller, service
│   │   ├── departments/          — routes, controller, service, repository, validator
│   │   ├── employees/            — routes, controller, service, repository, validator
│   │   ├── export/               — routes, controller, service, repository, validator
│   │   ├── holidays/             — routes, controller, service, repository, validator
│   │   ├── leave/                — routes, controller, service, repository, validator
│   │   ├── logs/                 — routes, controller, service
│   │   ├── reports/              — routes, controller, service, repository, validator
│   │   └── settings/             — routes, controller, service, repository, validator
│   └── utils/
│       ├── hash.js               — hashPassword(), verifyPassword(), hashSHA256()
│       ├── token.js              — createAccessToken(), generateRefreshToken()
│       ├── response.js           — successResponse(), errorResponse()
│       ├── id.js                 — generateId() (UUID v4)
│       ├── logger.js             — Pino logger instance
│       ├── otp.js                — OTP generation utils
│       └── pagination.js         — Pagination helpers
├── prisma/
│   ├── schema.prisma             — 25 models, single migration
│   ├── seed.js                   — Idempotent (upsert everywhere). seedPassword = 'Password123!'
│   ├── seedLargeDemo.js
│   └── seedProductionData.js
├── tests/
│   ├── unit/                     — Unit tests (auth, analytics, logs, utils, otp, etc.)
│   ├── integration/              — Integration route tests (all major modules)
│   ├── e2e/                      — E2E tests (analytics, auth, otp)
│   ├── setup.js                  — Test setup
│   └── helpers.js                — Test helpers
└── [docs - many .md files]
```

---

## All Implemented Routes (confirmed from source)

### Auth (`/api/v1/auth/*`)
| Method | Path | Auth | Roles |
|--------|------|------|-------|
| POST | /auth/login | none | any |
| POST | /auth/admin/login | none | HR_ADMIN, SUPER_ADMIN only (validated in service) |
| POST | /auth/refresh | none (cookie) | any |
| POST | /auth/logout | Bearer | any |
| POST | /auth/logout-all | Bearer | any |
| GET | /auth/me | Bearer | any |
| GET | /auth/sessions | Bearer | any |
| DELETE | /auth/sessions/:sessionId | Bearer | any |
| POST | /auth/forgot-password | none | any (rate-limited 5/15min) |
| GET | /auth/reset-password/validate | none | any |
| GET | /auth/validate-reset-token | none | any (deprecated alias) |
| POST | /auth/reset-password | none | any (rate-limited 5/15min) |
| POST | /auth/verify-otp | none | any (rate-limited 5/5min) |
| POST | /auth/resend-otp | none | any (rate-limited 5/15min) |

### Employees (`/api/v1/employees/*`)
| Method | Path | Roles |
|--------|------|-------|
| GET | /employees | all authenticated |
| POST | /employees | HR_ADMIN, SUPER_ADMIN |
| GET | /employees/:id | all authenticated |
| PATCH | /employees/:id | HR_ADMIN, SUPER_ADMIN |
| DELETE | /employees/:id | HR_ADMIN, SUPER_ADMIN (soft delete) |
| GET | /employees/export/csv | HR_ADMIN, SUPER_ADMIN |

### Departments (`/api/v1/departments/*`)
| Method | Path | Notes |
|--------|------|-------|
| GET | /departments | list with hierarchy |
| POST | /departments | create |
| PATCH | /departments/:id | update |
| DELETE | /departments/:id | delete |

### Holidays (`/api/v1/holidays/*`)
| Method | Path |
|--------|------|
| GET | /holidays |
| POST | /holidays |
| PATCH | /holidays/:id |
| DELETE | /holidays/:id |

### Leave (`/api/v1/leave/*`)
| Method | Path | Roles |
|--------|------|-------|
| POST | /leave/requests | any |
| GET | /leave/requests | any (own) |
| GET | /leave/team/requests | MANAGER, HR_ADMIN |
| PATCH | /leave/requests/:id/approve | MANAGER, HR_ADMIN |
| PATCH | /leave/requests/:id/reject | MANAGER, HR_ADMIN |
| PATCH | /leave/requests/:id/withdraw | any (own) |
| GET | /leave/balance | any |
| GET | /leave/types | any |

### Attendance (`/api/v1/attendance/*`)
| Method | Path | Roles |
|--------|------|-------|
| POST | /attendance/check-in | any |
| POST | /attendance/check-out | any |
| GET | /attendance/records | any (own) — supports ?month=YYYY-MM or ?fromDate=&toDate= |
| GET | /attendance/team/records | MANAGER, HR_ADMIN — supports ?month=YYYY-MM |
| GET | /attendance/summary | any |
| POST | /attendance/regularization | any |
| GET | /attendance/regularization | any (own) |
| GET | /attendance/team/regularization | MANAGER, HR_ADMIN |
| PATCH | /attendance/regularization/:id/approve | MANAGER, HR_ADMIN |
| PATCH | /attendance/regularization/:id/deny | MANAGER, HR_ADMIN |

### Analytics (`/api/v1/analytics/*`)
| Method | Path | Roles |
|--------|------|-------|
| GET | /analytics/summary | HR_ADMIN, SUPER_ADMIN |
| GET | /analytics/attendance | HR_ADMIN, SUPER_ADMIN |
| GET | /analytics/headcount-by-department | HR_ADMIN, SUPER_ADMIN |
| GET | /analytics/recent-activity | HR_ADMIN, SUPER_ADMIN |
| GET | /analytics/leave-summary | HR_ADMIN, SUPER_ADMIN |

### Reports (`/api/v1/reports/*`)
| Method | Path |
|--------|------|
| GET | /reports/attendance |
| GET | /reports/leaves |
| GET | /reports/payroll |
| POST | /reports/schedule |
| GET | /reports/scheduled |
| PATCH | /reports/scheduled/:id |
| DELETE | /reports/scheduled/:id |
| GET | /reports/export-history |

### Export (`/api/v1/export/*`)
| Method | Path | Notes |
|--------|------|-------|
| POST | /export/employees | HR_ADMIN only. format: csv/excel/json |
| POST | /export/attendance | HR_ADMIN only. requires from_date, to_date |
| POST | /export/leave | HR_ADMIN only. requires from_date, to_date |
| GET | /export/:job_id/download | streams file; 404 if expired |
| GET | /export/list | paginated job list |

### Audit Logs (`/api/v1/audit-logs/*`)
| Method | Path |
|--------|------|
| GET | /audit-logs |
| GET | /audit-logs/:id |
| POST | /audit-logs/dpia-report |
| GET | /audit-logs/export |

### Settings (`/api/v1/settings/*`)
| Method | Path | Roles |
|--------|------|-------|
| GET | /settings/tenant | any admin |
| PATCH | /settings/tenant | HR_ADMIN, SUPER_ADMIN |
| GET | /settings/email-templates | any admin |
| PATCH | /settings/email-templates/:type | HR_ADMIN, SUPER_ADMIN |
| GET | /settings/roles-permissions | SUPER_ADMIN |
| PATCH | /settings/roles-permissions | SUPER_ADMIN |

### Manager Dashboard (`/api/v1/manager/*`)
| Method | Path |
|--------|------|
| GET | /manager/dashboard |
| GET | /manager/team |
| GET | /manager/team/attendance |
| GET | /manager/approvals |
| PATCH | /manager/leave-requests/:id/decision |
| PATCH | /manager/regularization-requests/:id/decision |
| GET | /manager/team (plus more) |

### Employee Dashboard (`/api/v1/employee/*`)
| Method | Path | Notes |
|--------|------|-------|
| GET | /employee/dashboard | personal summary |
| GET | /employee/documents | returns EmployeeDocument records from DB |
| GET | /employees/me/documents | alias for above (wireframe path) |
| GET | /employee/team | manager + peers in same dept |
| GET | /employees/me/team | alias for above (wireframe path) |

### Employee Documents (`/api/v1/employees/:id/documents`)
| Method | Path | Notes |
|--------|------|-------|
| POST | /employees/:id/documents | Upload file (multipart/form-data). Requires Cloudinary env vars. HR/Admin or own. |
| GET | /employees/:id/documents | List documents. HR/Admin or own. |
| DELETE | /employees/:id/documents/:docId | Delete document from DB + Cloudinary. HR/Admin only. |
| GET | /attendance/today | today's check-in/out status |

### Logs (`/api/v1/logs`)
| Method | Path |
|--------|------|
| GET | /logs |

### Notifications (`/api/v1/notifications/*`)
| Method | Path | Notes |
|--------|------|-------|
| GET | /notifications | List notifications (own). `?page&limit&unreadOnly&since` |
| GET | /notifications/unread-count | Bell-icon badge count |
| PATCH | /notifications/:id/read | Mark single read |
| POST | /notifications/:id/read | Alias (UI-team compat) |
| PATCH | /notifications/read-all | Mark all read |
| POST | /notifications/read-all | Alias (UI-team compat) |
| GET | /notifications/stream | SSE stream — pass `?token=<accessToken>` |

### Search (`/api/v1/search`)
| Method | Path | Notes |
|--------|------|-------|
| GET | /search | `?q=<term>` — searches employees, departments, leave, holidays |

---

## Module Status

### ✅ FULLY IMPLEMENTED (registered in app.js)
| Feature | Module Path | Notes |
|---------|------------|-------|
| Notifications | `src/modules/notifications/` | List, unread-count, mark-read, mark-all-read, SSE stream at `/notifications/stream` |
| Search | `src/modules/search/` | `GET /search?q=` — searches employees, departments, leave, holidays |
| File/Document Upload | `EmployeeDocument` | POST/GET/DELETE `/employees/:id/documents` — needs Cloudinary env vars |
| MFA / OTP | `OtpChallenge` | Flow works but NOT enforced by default |

### ❌ NOT IMPLEMENTED (directory exists but empty)
| Feature | Directory | Status |
|---------|-----------|--------|
| Payroll | `src/modules/payroll/` | Empty dir — no routes, no Prisma model |
| Permissions CRUD | `src/modules/permissions/` | Empty dir — models exist, no API |
| Resignations | `src/modules/resignations/` | Empty dir — `Resignation` Prisma model exists |
| Files (generic) | `src/modules/files/` | Empty dir — use `/employees/:id/documents` instead |

---

## Multi-Tenant Architecture

**DB Model**: Shared DB, row-level isolation — every table has `tenantId`. Correct approach for SaaS. One DB, many companies, fully isolated data.

### Tenant Resolution — 4-Layer Priority Chain (in `resolveTenant.js`)
```
1. Subdomain    acme.yourems.com → Tenant.slug = "acme"   (requires APP_DOMAIN env var)
2. Header       X-Tenant-Key: acme-corp-001               (always works, for Postman/Swagger)
3. JWT payload  Bearer <token> → tenantId from JWT         (automatic after login)
4. Env fallback DEFAULT_TENANT_KEY                         (dev/testing only)
```

### Login Auto-Resolution
- Email unique across tenants → login with just email + password (no header needed)
- Email in multiple tenants → returns `AMBIGUOUS_EMAIL`, requires `X-Tenant-Key`
- After any login, JWT carries `tenantId` — all subsequent calls are automatic

### Enabling Subdomain Routing (when domain is configured)
1. Set `APP_DOMAIN=yourems.com` in Render env vars
2. Wildcard DNS: `*.yourems.com → Render service`
3. Wildcard SSL on Render or Cloudflare
4. Code already handles it — no changes needed

### API Auth Pattern
Every protected request needs:
```
Authorization: Bearer <accessToken>
x-tenant-key: acme-corp-001   ← only if JWT doesn't already have tenantId
```

**Tenant-optional routes** (resolve tenant from email internally):
- `/auth/login`, `/auth/admin/login`, `/auth/refresh`
- `/auth/forgot-password`, `/auth/reset-password`, `/auth/reset-password/validate`, `/auth/validate-reset-token`
- `/auth/verify-otp`, `/auth/resend-otp`

---

## Role Hierarchy
```
SUPER_ADMIN > HR_ADMIN > MANAGER > EMPLOYEE > AUDITOR
```
- `SUPER_ADMIN` bypasses all role checks — hardcoded in `authorize()` in `authenticate.js`
- `AUDITOR` role is in enum but no dedicated routes — same access as EMPLOYEE
- `authorize(roles[])` in `authenticate.js` uses `request.user.memberType` directly
- DB-level `Role`/`Permission`/`RolePermission` models exist but are NOT wired up to `authorize()` — it uses memberType enum only

---

## Known Bugs & Issues (Confirmed by Code Audit)

### ✅ FIXED — `analytics.routes.js` double-hooked `resolveTenant` (2026-05-22)
### ✅ FIXED — Default DB URL was MySQL in `src/config/index.js` (2026-05-22)
### ✅ FIXED — Dead Redis/BullMQ/ioredis removed from `package.json` (2026-05-22)
### ✅ FIXED — `GET /leave/types` route added (2026-05-22)
### ✅ FIXED — `seed.js` seedPassword corrected to `Password123!` (2026-05-22)
### ✅ FIXED — `playwright` moved to devDependencies (2026-05-22)
### ✅ FIXED — `getDocuments()` now queries `prisma.employeeDocument` instead of returning `[]` (2026-05-22)
### ✅ FIXED — `GET /attendance/records` now supports `?month=YYYY-MM` (2026-05-22)
### ✅ FIXED — Added `/employees/me/documents` and `/employees/me/team` route aliases (2026-05-22)
### ✅ FIXED — `tests/helpers.js::cleanDatabase()` now guards against non-test DBs (2026-05-22)
**Root cause of production data loss**: `cleanDatabase()` had no env guard — running `npm test` locally wiped the Render DB. Fixed with: NODE_ENV=test + DATABASE_URL must contain `localhost`, `127.0.0.1`, or `ems_test`.
### ✅ FIXED — `prisma/seed.js` fully rewritten to be idempotent (2026-05-22)
Uses `upsert` everywhere (correct compound key names: `tenantId_email`, `tenantId_key`). Holidays use `findFirst + create` (no unique constraint). Safe to re-run against any DB state.
### ✅ FIXED — `fast-json-stringify` stripping response fields (2026-05-22)
Routes with `data: { type: 'object' }` without `additionalProperties: true` returned `{}`. Fixed in: `departments.routes.js`, `holidays.routes.js`, `employees.routes.js`, `employee.routes.js`.
### ✅ FIXED — Analytics/e2e tests expecting `cached: true` (2026-05-22)
Redis removed — analytics no longer caches. Updated `analytics.routes.test.js` and `analytics.e2e.test.js` to expect `cached: false`.
### ✅ FIXED — Auth tests expecting `MISSING_TENANT` error (2026-05-22)
Login auto-resolves tenant from email — `MISSING_TENANT` is never returned. Updated 3 tests in `auth.routes.test.js`.
### ✅ FIXED — `POST /attendance/regularization` always 500 (2026-05-22)
Validator required `type` field (LATE/MISSED_CHECKOUT/EARLY_CHECKOUT) but `AttendanceRegularizationRequest` Prisma model has no `type` column. Stripped from service insert in `attendance.service.js`.
### ✅ FIXED — CI pipeline test job re-enabled with PostgreSQL service container (2026-05-27)
`.github/workflows/ci.yml` now has a `test` job with a `postgres:16` service container (`ems_test` DB). Runs `prisma migrate deploy` then `npm test` on every push. Requires no external DB.

### ✅ FIXED — File upload implemented (2026-05-23)
`POST /employees/:id/documents` (multipart/form-data), `GET /employees/:id/documents`, `DELETE /employees/:id/documents/:docId`.
Uses Cloudinary for storage. Requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` on Render.
Returns `503 STORAGE_NOT_CONFIGURED` if vars not set (graceful fallback).

### Cloudinary on Render (configured 2026-06-09)
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` are set on Render service `srv-d85k6cl8nd3s73drar50` (cloud: **dmljxhmio**). `POST /employees/:id/documents` and `POST /employees/:id/photo` are live. Settings → Storage shows `provider: cloudinary`, `configured: true`. Local `.env` matches same cloud name.

### Remaining — Notifications module not built
No `src/modules/notifications/` dir. `Notification` Prisma model exists but zero routes.

### Remaining — Resignations module not built
No `src/modules/resignations/` dir. `Resignation` Prisma model exists but zero routes.

### Remaining — Permissions API not wired
`Role`/`Permission`/`RolePermission`/`UserRole` models exist. `authorize()` middleware still uses `memberType` enum only. Fine-grained permission checks not implemented.

---

## Prisma Schema — All 25 Models
| Model | Purpose |
|-------|---------|
| Tenant | Multi-tenant root — all data scoped to tenantId |
| User | Login credentials, role (memberType), status. 1:1 optional link to Employee |
| Employee | Employment profile, department, manager hierarchy, soft-deletable |
| Department | Hierarchical (parentId + depth), optional head employee |
| Role | Named roles, tenant-scoped or system-global |
| Permission | Fine-grained permission keys per module |
| RolePermission | Role ↔ Permission join |
| UserRole | User ↔ Role join |
| Session | Refresh token rotation with family-ID reuse detection |
| PasswordResetToken | Hashed reset tokens with TTL and IP tracking |
| OtpChallenge | MFA OTP: rate-limited attempts, resend count, masked destination |
| EmployeeDocument | Document metadata + verification status. Upload to Cloudinary via POST /employees/:id/documents |
| AttendanceRecord | Daily check-in/check-out per employee with workMode and location |
| AttendanceRegularizationRequest | Employee request to fix missed/wrong attendance |
| LeaveType | Tenant leave types (annual, sick, casual, etc.) |
| LeaveBalance | Per-employee per-type balance tracking |
| LeaveRequest | Leave submissions with approval workflow |
| Holiday | Tenant holiday calendar (optional/mandatory) |
| Resignation | Employee resignation flow (PENDING/APPROVED/REJECTED/WITHDRAWN) |
| AuditLog | Immutable change tracking for all entity mutations |
| LogEntry | Structured application logs (ERROR/WARN/INFO/DEBUG) |
| Notification | In-app notifications (model exists, module not implemented) |
| SavedView | User-saved filter views for list screens |
| Setting | Key-value tenant configuration store |
| ScheduledReport | Recurring report job configuration |
| ReportExport | Report export job tracking |
| TenantConfig | Per-tenant working hours, fiscal year |
| EmailTemplate | Customizable email templates per tenant |
| ExportJob | Async export job status tracking |

---

## Test Suite
```
tests/
├── unit/
│   ├── auth.service.test.js
│   ├── auth.service.unit.test.js
│   ├── analytics.service.test.js
│   ├── logs.service.test.js
│   ├── otp.service.test.js
│   ├── passwordReset.service.test.js
│   ├── utilities.test.js
│   ├── utils.test.js
│   ├── middleware.test.js
│   ├── middleware.coverage.test.js
│   ├── controller.coverage.test.js
│   └── repository.coverage.test.js
├── integration/
│   ├── auth.routes.test.js
│   ├── auth.controller.test.js
│   ├── analytics.routes.test.js
│   ├── attendance.routes.test.js
│   ├── auditLogs.routes.test.js
│   ├── departments.routes.test.js
│   ├── export.routes.test.js
│   ├── holidays.routes.test.js
│   ├── leave.routes.test.js
│   ├── logs.routes.test.js
│   ├── otp.routes.test.js
│   ├── passwordReset.routes.test.js
│   ├── reports.routes.test.js
│   └── settings.routes.test.js
├── e2e/
│   ├── auth.e2e.test.js
│   ├── analytics.e2e.test.js
│   └── otp.e2e.test.js
├── performance.test.js
├── email-verification.test.js
├── otp-email-flow.test.js
└── password-reset-flow.test.js
```
**Note**: No test files for departments, holidays modules. `tests/integration/employees.routes.test.js` added 2026-05-27 — covers role isolation (EMPLOYEE/MANAGER/HR), document access control, photo 403 enforcement, soft delete.

---

## Key Env Vars (.env)
```
DATABASE_URL=postgresql://employee_m2e9_user:...@render.../employee_m2e9?sslmode=require
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:5173
JWT_SECRET=<see .env file>
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Email (current = Ethereal fake SMTP, preview at https://ethereal.email/messages)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.ethereal.email     # Change to smtp.gmail.com for real email
SMTP_PORT=587                     # Use 465 for Resend/SSL
SMTP_USER=<ethereal or gmail addr>
SMTP_PASS=<ethereal pass or Gmail App Password>
SMTP_FROM=<sender address>
# For Gmail: 1) enable 2FA, 2) create App Password at myaccount.google.com/apppasswords
# For Resend: SMTP_HOST=smtp.resend.com SMTP_PORT=465 SMTP_USER=resend SMTP_PASS=re_KEY SMTP_FROM=onboarding@resend.dev

# File Storage — Cloudinary (configured; values in .env — never commit)
# CLOUDINARY_CLOUD_NAME=dmljxhmio

RENDER_API_KEY=<see .env>
GITHUB_TOKEN=<see .env>
APP_NAME=EMS
API_PREFIX=/api/v1
API_URL=https://employee-management-system-2b9q.onrender.com/api/v1
EXPORTS_DIR=/tmp/exports
```

---

## Development Commands
```bash
npm run dev                    # Local dev with --watch
npm test                       # All tests (Mocha)
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:coverage          # Coverage with c8
npm run db:seed                # Base seed (tenant, users, 65 employees, leave types, holidays)
npm run db:seed:comprehensive  # Additive seed — sub-depts, leave in all statuses, 454 attendance records
npm run db:studio              # Prisma Studio (GUI)
npm run lint             # ESLint
npm run format           # Prettier
```

---

## Quick Test Login
```bash
curl -X POST https://employee-management-system-2b9q.onrender.com/api/v1/auth/login \
  -H "content-type: application/json" \
  -H "x-tenant-key: acme-corp-001" \
  -d '{"email":"hr@acme.test","password":"Password123!"}'
```

---

## Rules for This Project
1. **Always work in `/Users/mohdsaeedafri/All-Code-Base/EMS`** — never other dirs
2. DB: use Prisma client only — never raw SQL
3. All protected routes go through `authenticate` middleware
4. Tenant always available as `request.tenant` after `resolveTenant`
5. Errors: use `errorResponse()` from `utils/response.js`
6. New modules: routes → controller → service → repository pattern
7. Commit and push to GitHub when work is done (explicit permission granted)
8. **Never commit to Bitbucket**
9. Memory/analysis files stay in this project folder only — not global

## Mandatory Engineering Habits (EMS only — enforced on EVERY change)
10. **API_MAPPING.md** — update `docs/API_MAPPING.md` on every API add/change/delete. Keep field names, auth roles, request/response shapes accurate.
11. **Zero-regression tests** — run `npm test` (or relevant integration test) before every commit. Fix all failures before pushing. Never push a red test suite.
12. **Swagger first** — every new or changed endpoint must be reflected in `src/plugins/swagger.js` with correct field names, required params, and response shape. Test via Swagger UI at `/docs` after deploy.
13. **Git identity** — always commit as `mohdsaeedafri@coresight.com` / `Mohd Saeed Afri`. Never change git config. Current config is already correct — verify with `git config user.email` before committing if unsure.
14. **Monitor GitHub Actions after every push** — check `https://github.com/saeedafri/Employee-management-system/actions` after every push. If the pipeline fails, fix it before doing anything else. Use `gh run list --limit 3` to check status.
15. **Images always WebP** — any image upload endpoint must convert to WebP before storing (use `sharp`). Never store raw JPEG/PNG in Cloudinary.
16. **Test on Render after deploy** — after every Render deploy, smoke-test the changed endpoints on `https://employee-management-system-2b9q.onrender.com/api/v1` before reporting done.
17. **Employee-scoped data isolation** — always verify that employee-role users can only see their own data, manager-role can see their team, HR/admin can see all. Test each role separately when adding filtered endpoints.
