# EMS — Employee Management System (Backend)
> Last deep-analysis: 2026-05-22

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
| Email | SMTP via Nodemailer (Ethereal for dev) |
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
| HR_ADMIN | `admin@testorg.com` | `password123` | test-key-123456789 |

> **CRITICAL**: `prisma/seed.js` has `seedPassword = 'ChangeMe123!'` but live DB was seeded with `Password123!`. Do NOT re-seed without updating seedPassword first. `seed.js` is wrong for production.

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
│   ├── seed.js                   — WARNING: seedPassword is wrong (see above)
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
| ❌ | /leave/types | **NOT IMPLEMENTED** — UI/wireframes expect this |

### Attendance (`/api/v1/attendance/*`)
| Method | Path | Roles |
|--------|------|-------|
| POST | /attendance/check-in | any |
| POST | /attendance/check-out | any |
| GET | /attendance/records | any (own) |
| GET | /attendance/team/records | MANAGER, HR_ADMIN |
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
| Method | Path |
|--------|------|
| POST | /export/employees |
| POST | /export/attendance |
| POST | /export/leave |
| GET | /export/:job_id/download |
| GET | /export/list |

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
| Method | Path |
|--------|------|
| GET | /employee/dashboard |
| GET | /employee/documents |
| GET | /employee/team |
| GET | /attendance/today (via employee routes) |

### Logs (`/api/v1/logs`)
| Method | Path |
|--------|------|
| GET | /logs |

---

## NOT IMPLEMENTED ❌ (Prisma models exist, no src/modules/ directory)

| Feature | Prisma Model | Status |
|---------|-------------|--------|
| Notifications | `Notification` | No module dir, no routes, not in app.js |
| Payroll | No Prisma model | No module dir, no routes |
| Permissions API | `Permission`, `RolePermission`, `UserRole`, `Role` | Models exist, no CRUD API |
| Resignations | `Resignation` | No module dir, no routes |
| File/Document Upload | `EmployeeDocument` | No module dir, no upload endpoint |
| `/leave/types` | `LeaveType` | Model + data exists, no GET endpoint |
| MFA enforcement | `OtpChallenge` | Flow works but NOT enforced by default |

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

### ✅ FIXED — `analytics.routes.js` double-hooked `resolveTenant`
**File**: `src/modules/analytics/analytics.routes.js:5` — **Fixed 2026-05-22**

### ✅ FIXED — Default DB URL was MySQL
**File**: `src/config/index.js:14` — **Fixed 2026-05-22** (now `postgresql://localhost:5432/ems_local`)

### Bug 3 — Dead Redis/Queue dependencies
**Files**: `package.json`, `src/jobs/*`, `src/plugins/redis.js`, `src/config/redis.js`  
**Problem**: `bullmq`, `ioredis`, `redis` are in `package.json` dependencies. `src/jobs/emailQueue.js` exports `null` for everything. `src/plugins/redis.js` exports `null`. These are dead code shipping to production.  
**Impact**: Larger node_modules, unnecessary install time. No runtime error.  
**Fix**: Remove `bullmq`, `ioredis`, `redis` from `package.json`. Delete `src/jobs/` dir and `src/plugins/redis.js` and `src/config/redis.js` if queue is truly gone.

### Bug 4 — `/leave/types` endpoint missing
**Problem**: `LeaveType` Prisma model has data seeded. Wireframes, docs, and UI team expect `GET /leave/types`. The route does not exist.  
**Impact**: UI will hit 404 on leave type selection dropdown. Leave requests require `leaveTypeId` but there's no way to list types.  
**Fix**: Add `GET /leave/types` to `leave.routes.js`.

### Bug 5 — `seed.js` password mismatch
**File**: `prisma/seed.js`  
**Problem**: `seedPassword = 'ChangeMe123!'` but live DB was seeded with `Password123!`.  
**Impact**: Running `npm run db:seed` will create users with wrong password, breaking all test credentials.  
**Fix**: Update `seedPassword` in `seed.js` to `Password123!` before any re-seed.

### Bug 6 — `playwright` in production dependencies
**File**: `package.json`  
**Problem**: `playwright` (a browser testing framework, ~300MB) is listed under `dependencies` (not `devDependencies`). It gets installed in production.  
**Impact**: Massively bloated production install. Render build will be slow.  
**Fix**: Move `playwright` to `devDependencies`.

### Doc Bug — Old docs show wrong tenant key for `hr@acme.test`
**Files**: `UI_TEAM_GUIDE.md`, `SWAGGER_TESTING_GUIDE.md` (old sections)  
**Problem**: Some docs referenced `test-key-123456789` as the tenant for `hr@acme.test`. Wrong — HR user is in `acme-corp-001`.

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
| EmployeeDocument | Document metadata + verification status (no actual file storage implemented) |
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
**Note**: No test files for employees, departments, holidays modules (integration tests may be missing for them).

---

## Key Env Vars (.env)
```
DATABASE_URL=postgresql://employee_m2e9_user:...@render.../employee_m2e9?sslmode=require
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,http://localhost:5173
JWT_SECRET=<see .env file>
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
SMTP_HOST=smtp.ethereal.email
RENDER_API_KEY=<see .env>
GITHUB_TOKEN=<see .env>
APP_NAME=EMS
API_PREFIX=/api/v1
```

---

## Development Commands
```bash
npm run dev              # Local dev with --watch
npm test                 # All tests (Mocha)
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:coverage    # Coverage with c8
npm run db:seed          # Seed (WARNING: seedPassword needs updating)
npm run db:studio        # Prisma Studio (GUI)
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
