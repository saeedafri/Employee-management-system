#!/usr/bin/env python3
"""Build EMS Backend Technical Documentation v2 from v1 base + expansions."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs" / "EMS_BACKEND_TECHNICAL_DOCUMENTATION.md"

# Mermaid color classDefs (reused across diagrams)
MERMAID_STYLES = """
    classDef client fill:#4A90D9,stroke:#2E5F8A,color:#fff
    classDef api fill:#2ECC71,stroke:#1E8449,color:#fff
    classDef db fill:#E67E22,stroke:#CA6F1E,color:#fff
    classDef external fill:#9B59B6,stroke:#7D3C98,color:#fff
"""

def box(what, why, how):
    return f"""
> **What it does:** {what}
>
> **Why it matters:** {why}
>
> **How it works:** {how}
"""

QUICK_START = r"""
## 0. Quick Start for New Developers

""" + box(
    "Gets a new engineer from zero to a working local API in under 15 minutes.",
    "Onboarding speed reduces mistakes against production data.",
    "Clone → local Postgres → migrate → seed → dev server → Swagger login.",
) + r"""

### 0.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 20 | Runtime (ES modules) |
| Docker | any recent | Local PostgreSQL only |
| Git | 2.x | Clone + branch workflow |

### 0.2 First-Time Setup

```bash
git clone https://github.com/saeedafri/Employee-management-system.git EMS
cd EMS
npm ci
docker compose up -d                    # Postgres on localhost:5432
export DATABASE_URL=postgresql://ems:ems_local_dev@127.0.0.1:5432/ems_dev
npx prisma migrate deploy
npm run db:seed
npm run dev                             # http://localhost:3000
```

### 0.3 Verify Login (Swagger or curl)

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Key: acme-corp-001" \
  -d '{"email":"hr@acme.test","password":"Password123!"}' | jq .
```

Open **http://localhost:3000/docs** — authorize with the returned `accessToken`.

### 0.4 Connect to Hostinger DB (optional — read-only caution)

```bash
./scripts/startLocalHostingerStack.sh
# Then run backend with tunnel override (never migrate/seed against prod):
cd EMS && node --env-file=.env --env-file=/tmp/ems-tunnel.override.env --watch src/server.js
```

### 0.5 Where to Look First

| Task | Start here |
|------|-----------|
| Add an API endpoint | `src/modules/<domain>/*.routes.js` → controller → service → repository |
| Change auth rules | `src/middleware/authenticate.js` |
| Tenant scoping | `src/middleware/resolveTenant.js` + always `tenantId` in Prisma `where` |
| Payroll math | `src/modules/payroll/payroll.repository.js` + `src/utils/statutoryCalculation.js` |
| API contract | `docs/API_MAPPING.md` + `src/plugins/swagger.js` |
| Deploy | `.github/workflows/deploy-hostinger.yml` |

\newpage
"""

MIDDLEWARE_TREE = r"""
## 2.5 Middleware Decision Tree — Which Middleware Runs When?

""" + box(
    "Shows exactly which hooks fire for public vs protected routes.",
    "Misunderstanding middleware order causes auth bugs and missing tenant context.",
    "Follow the tree from HTTP method + path to the final handler.",
) + r"""

```mermaid
flowchart TD
    START([HTTP Request]) --> GLOBAL[Global plugins:<br/>requestId → cookie → prisma → cors → helmet → rateLimit → multipart]
    GLOBAL --> PREFIX{Path starts with /api/v1?}
    PREFIX -->|No| HEALTH[/health /healthz /docs — no tenant hook/]
    PREFIX -->|Yes| RT[onRequest: resolveTenant]

    RT --> TENANT{request.tenant set<br/>or route tenant-optional?}
    TENANT -->|Missing tenant on protected route| E400[400 MISSING_TENANT]
    TENANT -->|OK| ROUTE[Route handler registration]

    ROUTE --> AUTHZ{Route defines onRequest?}
    AUTHZ -->|None| HANDLER[Controller]
    AUTHZ -->|authenticate only| AUTH[authenticate JWT + session check]
    AUTHZ -->|authenticate + authorize| AUTH --> ROLE{memberType in roles<br/>or SUPER_ADMIN?}
    ROLE -->|No| E403[403 FORBIDDEN]
    ROLE -->|Yes| HANDLER
    AUTH -->|Invalid token| E401[401 UNAUTHORIZED]

    HANDLER --> SVC[Service → Repository → Prisma]

    class START,PREFIX client
    class GLOBAL,RT,AUTH,ROUTE,HANDLER,SVC api
    class E400,E401,E403 db
""" + MERMAID_STYLES + r"""

### Tenant-Optional vs Protected Routes

| Route pattern | resolveTenant | authenticate | authorize |
|--------------|:-------------:|:------------:|:---------:|
| `POST /auth/login` | optional (email resolves) | — | — |
| `GET /health` | — (outside prefix) | — | — |
| `GET /employees` | required | yes | — |
| `POST /employees` | required | yes | HR_ADMIN, SUPER_ADMIN |
| `GET /analytics/summary` | required | yes | HR_ADMIN, SUPER_ADMIN |

\newpage
"""

WORKFLOWS = r"""
## 17. End-to-End Workflow Diagrams

This section documents every major business flow with numbered steps and color-coded layers (blue = client, green = API, orange = database, purple = external).

### 17.1 Payroll Engine — Gross → Deductions → Statutory → Net

""" + box(
    "Computes one payslip per employee for a payroll run period.",
    "Payroll is the highest-risk domain — errors affect real money.",
    "`payroll.repository.calculatePayrollRun` orchestrates components, statutory pack, tax, loans, net.",
) + r"""

```mermaid
flowchart TD
    subgraph Client["Client (HR Admin)"]
        C1["① POST /payroll/runs/:id/calculate"]
    end
    subgraph API["Application Layer"]
        A1["② Validate run status = DRAFT"]
        A2["③ Enqueue BullMQ job OR sync calculate"]
        A3["④ For each EmployeeSalary in pay group"]
        A4["⑤ Build earnings: FLAT / % / FORMULA"]
        A5["⑥ Prorate join/exit partial month"]
        A6["⑦ computeStatutoryContributions PF/ESI/..."]
        A7["⑧ computeIncomeTaxFromRegime slabs"]
        A8["⑨ Apply loans, garnishments, reimbursements"]
        A9["⑩ netPay = gross - deductions"]
        A10["⑪ Persist Payslip + update run totals"]
    end
    subgraph DB["PostgreSQL"]
        D1[(PayrollRun)]
        D2[(Payslip)]
        D3[(StatutoryPack)]
    end
    subgraph Ext["External"]
        E1["Redis BullMQ optional"]
    end

    C1 --> A1 --> A2
    A2 --> E1
    A2 --> A3
    A3 --> A4 --> A5 --> A6 --> A7 --> A8 --> A9 --> A10
    A3 --> D3
    A10 --> D1
    A10 --> D2

    class C1 client
    class A1,A2,A3,A4,A5,A6,A7,A8,A9,A10 api
    class D1,D2,D3 db
    class E1 external
""" + MERMAID_STYLES + r"""

### 17.2 India Statutory — PF / ESI / PT / TDS

```mermaid
flowchart LR
    subgraph Step1["① Earnings"]
        E1[BASIC + HRA + allowances]
    end
    subgraph Step2["② PF (EPF)"]
        P1["Wage base: components tagged PF_WAGES"]
        P2["Apply 12% employee + 12% employer"]
        P3["Ceiling ₹15,000 wage base"]
    end
    subgraph Step3["③ ESI"]
        S1["Wage base: ESI_WAGES tag"]
        S2["1.75% employee / 4.75% employer if gross ≤ threshold"]
    end
    subgraph Step4["④ Professional Tax"]
        T1["State slab from StatutoryPack"]
    end
    subgraph Step5["⑤ TDS"]
        TD1["Annualize taxable income"]
        TD2["Old vs New regime from declaration"]
        TD3["Slab tax + surcharge + cess"]
    end
    subgraph Step6["⑥ Net"]
        N1["Gross - PF - ESI - PT - TDS - other"]
    end

    E1 --> P1 --> P2 --> S1 --> S2 --> T1 --> TD1 --> TD2 --> TD3 --> N1

    class E1 client
    class P1,P2,S1,S2,T1,TD1,TD2,TD3 api
    class N1 db
""" + MERMAID_STYLES + r"""

> All India rules live in **StatutoryPack** JSON — not hardcoded `if (country === 'IN')` in the calculation loop.

### 17.3 KWD Work Week + Currency Flow

```mermaid
flowchart TD
    T1["Tenant kwd-litmus-001"] --> TC["TenantConfig.workWeekDays SUN-THU"]
    TC --> ATT["Attendance calendar: Sun-Thu workdays"]
    TC --> TS["Timesheet weekStartDay = 0 Sunday"]
    TC --> PAY["Payroll currency = KWD"]
    PAY --> MU["minorUnitFactor KWD = 1000 fils 3 decimal places"]
    MU --> PACK["StatutoryPack country=KW tenant-seeded"]
    PACK --> CALC["Same engine as IN — data-driven schemes"]

    class T1 client
    class TC,ATT,TS,PAY,MU api
    class PACK,CALC db
""" + MERMAID_STYLES + r"""

### 17.4 Leave Balance Accrual + Approval

```mermaid
flowchart TD
    subgraph Accrual["Accrual (leave engine)"]
        AC1["① catchUpAccrual MONTHLY"]
        AC2["② tenure tier → accrual rate"]
        AC3["③ proration on join/exit"]
        AC4["④ LeaveLedgerTxn ACCRUAL posted"]
    end
    subgraph Request["Leave Request"]
        R1["⑤ Employee POST /leave/requests"]
        R2["⑥ Validate balance via ledger"]
        R3["⑦ Status PENDING"]
    end
    subgraph Approval["Approval"]
        AP1["⑧ Manager PATCH approve/reject"]
        AP2["⑨ Ledger DEBIT on approve"]
        AP3["⑩ Notification to employee"]
    end

    AC1 --> AC2 --> AC3 --> AC4
    AC4 --> R1 --> R2 --> R3 --> AP1 --> AP2 --> AP3

    class R1 client
    class AC1,AC2,AC3,R2,R3,AP1,AP2 api
    class AC4,AP2 db
    class AP3 external
""" + MERMAID_STYLES + r"""

### 17.5 Attendance Check-In/Out + Regularization

```mermaid
sequenceDiagram
    participant E as Employee
    participant API as Attendance API
    participant DB as PostgreSQL
    participant M as Manager

    E->>API: ① POST /attendance/check-in
    API->>DB: Upsert AttendanceRecord (workMode, location)
    API-->>E: 200 checkInAt

    E->>API: ② POST /attendance/check-out
    API->>DB: Set checkOutAt, durationMinutes
    API-->>E: 200 summary

    Note over E,M: Missed punch path
    E->>API: ③ POST /attendance/regularization
    API->>DB: AttendanceRegularizationRequest PENDING
    M->>API: ④ PATCH .../approve
    API->>DB: Update record + request APPROVED
```

### 17.6 Timesheet Lock / Unlock / Submit

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Week created
    DRAFT --> SUBMITTED: Employee POST submit
    SUBMITTED --> APPROVED: Manager approve
    SUBMITTED --> REJECTED: Manager reject
    REJECTED --> DRAFT: Employee edits + resubmit
    SUBMITTED --> DRAFT: Employee recall (owner only)
    note right of DRAFT: Editable: add/edit/delete entries
    note right of SUBMITTED: WEEK_LOCKED for edits
    note right of APPROVED: WEEK_LOCKED
```

**Period locks** (HR): `POST /timesheets/locks` stores date ranges in tenant settings blob — blocks edits across those calendar dates.

### 17.7 Employee Soft Delete Cascade

```mermaid
flowchart TD
    DEL["DELETE /employees/:id"] --> AUTH{HR_ADMIN or SUPER_ADMIN?}
    AUTH -->|No| F403[403]
    AUTH -->|Yes| CHECK{Direct reports or dept head?}
    CHECK -->|Yes| F409[409 — reassign first]
    CHECK -->|No| SOFT["Set deletedAt + employmentStatus=TERMINATED"]
    SOFT --> USER["User.status may remain — login blocked by policy"]
    SOFT --> HIST["Historical payslips/attendance retained"]
    SOFT --> AUDIT["recordAuditLog EMPLOYEE_TERMINATED"]

    class DEL client
    class AUTH,CHECK,SOFT api
    class HIST,AUDIT db
""" + MERMAID_STYLES + r"""

### 17.8 Department Hierarchy Tree Resolution

```mermaid
flowchart TD
    Q["Query all departments tenantId"] --> MAP["buildDepartmentChildrenMap parentId → children"]
    MAP --> DESC["getDescendantDepartmentIds BFS"]
    MAP --> ROLL["buildRollupEmployeeCounts DFS"]
    DESC --> FILTER["Analytics/reports filter by subtree"]
    ROLL --> UI["Headcount includes nested depts"]

    class Q client
    class MAP,DESC,ROLL,FILTER api
    class UI db
""" + MERMAID_STYLES + r"""

### 17.9 Export Job Lifecycle (ExcelJS)

```mermaid
flowchart TD
    P1["① POST /export/employees"] --> P2["② createExportJob status=PROCESSING"]
    P2 --> P3["③ setImmediate exportEmployees job"]
    P3 --> P4["④ Prisma fetch rows"]
    P4 --> P5["⑤ ExcelJS styled XLSX / CSV / JSON"]
    P5 --> P6["⑥ Write /tmp/exports/{jobId}.xlsx"]
    P6 --> P7["⑦ updateExportJob SUCCESS + fileUrl"]
    P7 --> P8["⑧ GET /export/:job_id/download"]
    P3 -->|Error| F1["status=FAILED"]

    class P1 client
    class P2,P3,P4,P5,P6,P7,P8 api
    class F1 db
""" + MERMAID_STYLES + r"""

### 17.10 Email Flow — Resend (Password Reset + OTP)

```mermaid
flowchart TD
    subgraph Triggers
        T1[Forgot password]
        T2[MFA OTP]
        T3[Employee invite]
    end
    subgraph API
        J1[emailJob.sendEmail]
        J2{RESEND_API_KEY set?}
        J3[fetch api.resend.com]
        J4[SMTP nodemailer fallback]
    end
    subgraph Audit
        A1[AuditLog PASSWORD_RESET_REQUESTED etc.]
    end

    T1 --> J1
    T2 --> J1
    T3 --> J1
    J1 --> J2
    J2 -->|Yes| J3
    J2 -->|No| J4
    T1 --> A1
    T2 --> A1

    class T1,T2,T3 client
    class J1,J2 api
    class J3,J4 external
    class A1 db
""" + MERMAID_STYLES + r"""

### 17.11 Session Family ID Reuse Detection

```mermaid
flowchart TD
    R1["POST /auth/refresh with ems_session cookie"] --> H1["Hash cookie → lookup Session"]
    H1 --> M1{Hash matches active session?}
    M1 -->|Yes| ROT["Rotate refresh token same familyId"]
    M1 -->|No| M2{familyId seen but hash stale?}
    M2 -->|Yes| REV["revokeSessionFamily TOKEN_REUSE_DETECTED"]
    REV --> E401["401 — all sessions in family dead"]
    M2 -->|No| E401B["401 invalid session"]
    ROT --> OK["New accessToken + cookies"]

    class R1 client
    class H1,M1,ROT,M2,REV api
    class E401,E401B db
""" + MERMAID_STYLES + r"""

### 17.12 Rate Limiting Flow

```mermaid
flowchart LR
    REQ[Request] --> RL["@fastify/rate-limit global 100/15min"]
    RL --> OK{Under limit?}
    OK -->|Yes| NEXT[Continue pipeline]
    OK -->|No| 429[429 Too Many Requests]
    NEXT --> ROUTE{Per-route limits?}
    ROUTE -->|forgot-password| R5["5 per 15 min"]
    ROUTE -->|verify-otp| R5b["5 per 5 min"]

    class REQ client
    class RL,ROUTE,NEXT api
    class 429 db
""" + MERMAID_STYLES + r"""

### 17.13 CORS + Helmet Middleware Chain

```mermaid
flowchart TD
    IN[Incoming request] --> RID[requestId]
    RID --> COOKIE[cookie parser]
    COOKIE --> PRISMA[prisma decorator]
    PRISMA --> CORS["cors: CORS_ORIGIN + credentials"]
    CORS --> HELMET["helmet CSP disabled for Swagger"]
    HELMET --> RATE[rateLimit 100/15m]
    RATE --> MULTI[multipart 10MB]
    MULTI --> LOG[requestLogging hook]
    LOG --> RT[resolveTenant on /api/v1]

    class IN client
    class RID,COOKIE,PRISMA,CORS,HELMET,RATE,MULTI,LOG,RT api
""" + MERMAID_STYLES + r"""

### 17.14 Swagger Registration Order

```mermaid
flowchart TD
    S1["① Register all route modules under /api/v1"] --> S2["② Register /health /healthz"]
    S2 --> S3["③ swaggerPlugin LAST"]
    S3 --> S4["OpenAPI spec includes all routes"]
    S4 --> S5["/docs UI serves live contract"]

    class S1,S2,S3,S4,S5 api
""" + MERMAID_STYLES + r"""

### 17.15 Prisma Transaction Patterns

```mermaid
flowchart TD
    USE{Need atomic multi-table write?}
    USE -->|Yes| TX["prisma.$transaction async callback"]
    USE -->|No| SINGLE["Single prisma.model.create/update"]
    TX --> EX1["Auth: session + audit log"]
    TX --> EX2["Payroll: payslips + run status"]
    TX --> EX3["Leave: ledger txn + balance"]

    class USE client
    class TX,SINGLE,EX1,EX2,EX3 api
""" + MERMAID_STYLES + r"""

### 17.16 Audit Log Write on Mutation

```mermaid
flowchart TD
    MUT[Service mutation] --> REC{Module pattern}
    REC -->|Central| RA["recordAuditLog() auditLogs.service"]
    REC -->|Auth| AR["authRepository.createAuditLog"]
    REC -->|Inline| PR["prisma.auditLog.create in tx"]
    RA --> DB[(AuditLog append-only)]
    AR --> DB
    PR --> DB

    class MUT client
    class RA,AR,PR api
    class DB db
""" + MERMAID_STYLES + r"""

### 17.17 Search Multi-Entity Flow

```mermaid
flowchart TD
    Q["GET /search?q=term"] --> PAR["Parse types filter default all 4"]
    PAR --> E1["Parallel: employees ILIKE"]
    PAR --> E2["departments ILIKE"]
    PAR --> E3["leave requests ILIKE"]
    PAR --> E4["holidays ILIKE"]
    E1 --> ROLE{Role filter employee scope}
    ROLE --> MERGE["Merge results slice to limit"]
    MERGE --> OUT["groupedCounts + results[]"]

    class Q client
    class PAR,E1,E2,E3,E4,ROLE,MERGE api
    class OUT db
""" + MERMAID_STYLES + r"""

### 17.18 Report Scheduling (CRUD — cron execution)

```mermaid
flowchart TD
    HR["POST /reports/schedule"] --> SR["ScheduledReport row in DB"]
    SR --> NOTE["⚠ No in-process cron worker yet"]
    NOTE --> FUTURE["Future: BullMQ repeatable job reads schedule"]
    SR --> LIST["GET /reports/scheduled paginated"]
    LIST --> PATCH["PATCH /reports/scheduled/:id"]
    PATCH --> SOFT["Soft-disable via isActive flag"]

    class HR client
    class SR,LIST,PATCH api
    class NOTE,FUTURE external
""" + MERMAID_STYLES + r"""

\newpage
"""

HOSTINGER = r"""
### 13.6 Hostinger Deep Dive (Production)

""" + box(
    "Primary production deployment on a shared Hostinger VPS running Docker + nginx.",
    "Most live traffic and the UI team's integration target.",
    "DNS → nginx TLS :443 → Docker ems-backend :4001 → Postgres + Redis on ems-net.",
) + r"""

#### 13.6.1 Full VPS Architecture

```mermaid
flowchart TB
    subgraph Internet
        DNS["DNS ems-api.saqibsaeed.cloud → 31.97.186.223"]
        GHA["GitHub Actions deploy-hostinger.yml"]
        DEV["Developer SSH tunnel"]
    end

    subgraph VPS["Hostinger VPS srv1067327 — SHARED with rentocloud"]
        NGINX["nginx :443 TLS termination<br/>ems-api.saqibsaeed.cloud"]
        subgraph DockerEMS["Docker Compose /opt/ems"]
            BE["ems-backend container<br/>Node 20 Fastify<br/>127.0.0.1:4001"]
            PG["ems-postgres postgres:16<br/>127.0.0.1:5432"]
            RD["ems-redis redis:7-alpine<br/>127.0.0.1:6379"]
        end
        subgraph Rentocloud["⚠ rentocloud — DO NOT TOUCH"]
            PM2["PM2 :3000 / :4000"]
            RAPI["api.rentocloud.com vhosts"]
        end
        BACKUP["/opt/ems/backups pg_dump"]
    end

    DNS --> NGINX
    NGINX -->|proxy_pass| BE
    BE --> PG
    BE --> RD
    GHA -->|SSH| VPS
    DEV -->|SSH -L 15432:5432 -L 16379:6379| PG
    DEV --> RD
    GHA --> BACKUP

    class DNS,GHA,DEV client
    class NGINX,BE api
    class PG,BACKUP db
    class RD external
    class PM2,RAPI external
""" + MERMAID_STYLES + r"""

#### 13.6.2 Port Mapping

| Exposure | Host | Container | Service |
|----------|------|-----------|---------|
| Public 443 | nginx | — | TLS + reverse proxy |
| Loopback 4001 | 127.0.0.1 | ems-backend:3000 | Fastify API |
| Loopback 5432 | 127.0.0.1 | ems-postgres:5432 | PostgreSQL |
| Loopback 6379 | 127.0.0.1 | ems-redis:6379 | Redis (cache + BullMQ) |

External clients **never** hit :4001 directly — only nginx on :443.

#### 13.6.3 Directory Layout `/opt/ems/`

```
/opt/ems/
├── docker-compose.yml          # Orchestrates backend + postgres + redis
├── docker-compose.override.yml # Redis service (box-only)
├── backups/
│   └── ems_predeploy_YYYYMMDD.sql.gz   # Last 14 kept
└── app/                          # Git clone of origin/main
    ├── Dockerfile                # Box-only (untracked upstream)
    ├── .dockerignore             # Box-only
    ├── .env                      # Production secrets — NEVER commit
    ├── src/
    └── prisma/
```

#### 13.6.4 SSH Deploy Flow (Step by Step)

```mermaid
flowchart TD
    S1["① Push to main"] --> S2["② GitHub Actions: npm ci + lint"]
    S2 --> S3["③ prisma generate + app load verify"]
    S3 --> S4["④ SSH with HOSTINGER_SSH_KEY"]
    S4 --> S5["⑤ pg_dump → /opt/ems/backups/"]
    S5 --> S6["⑥ git -C /opt/ems/app pull --ff-only"]
    S6 --> S7["⑦ docker compose build ems-backend"]
    S7 --> S8["⑧ docker compose up -d ems-backend"]
    S8 --> S9["⑨ docker exec ems-backend npx prisma migrate deploy"]
    S9 --> S10["⑩ curl https://ems-api.../health × 40"]

    class S1 client
    class S2,S3,S4,S5,S6,S7,S8,S9 api
    class S10 external
""" + MERMAID_STYLES + r"""

#### 13.6.5 Environment Variables on VPS (categories)

| Category | Examples | Notes |
|----------|----------|-------|
| Core | `NODE_ENV=production`, `PORT=3000` | Inside container |
| Database | `DATABASE_URL=postgresql://...@ems-postgres:5432/...` | Docker network hostname |
| Redis | `REDIS_URL=redis://redis:6379` | Enables BullMQ + cache |
| JWT | `JWT_SECRET` | Non-default required |
| Email | `RESEND_API_KEY`, `RESEND_FROM` | Live transactional email |
| Storage | `CLOUDINARY_*` | Document uploads |
| CORS | `CORS_ORIGIN` | Frontend origins |

#### 13.6.6 Local Dev via SSH Tunnel

`scripts/startLocalHostingerStack.sh`:

1. Opens SSH tunnels `localhost:15432 → VPS:5432` and `localhost:16379 → VPS:6379`
2. Rewrites `DATABASE_URL` host to `127.0.0.1:15432`
3. Writes `/tmp/ems-tunnel.override.env`
4. Start: `node --env-file=.env --env-file=/tmp/ems-tunnel.override.env --watch src/server.js`

> **Never** run migrations, seeds, or tests against tunneled production DB.

#### 13.6.7 PM2 vs Docker — What Runs What

| Workload | Runtime | Notes |
|----------|---------|-------|
| **EMS API** | Docker `ems-backend` | Built from `/opt/ems/app/Dockerfile` |
| **EMS Postgres** | Docker `ems-postgres` | Isolated volume |
| **EMS Redis** | Docker `ems-redis` | Payroll queue + hot config cache |
| **rentocloud API** | PM2 on host | **Do not modify** |
| **rentocloud frontend** | PM2 :3000 | Separate nginx vhosts |

EMS and rentocloud share the **same VPS** but use **separate** process managers and nginx server blocks.

#### 13.6.8 SSL/TLS at nginx

- Certificate: Let's Encrypt (or Hostinger-managed) for `ems-api.saqibsaeed.cloud`
- Termination at nginx — backend sees HTTP on loopback
- `X-Forwarded-Proto: https` passed to Fastify

#### 13.6.9 Backup and Migration Strategy

| Step | When | Command |
|------|------|---------|
| Pre-deploy backup | Every GitHub deploy | `docker exec ems-postgres pg_dump ... \| gzip` |
| Retention | Automatic | Keep newest 14 backups |
| Migrate | After container up | `docker exec ems-backend npx prisma migrate deploy` |
| Rollback | Manual | Restore `.sql.gz` + pin previous image |

**Rule:** additive migrations only on production — never `migrate reset` or `db push --force-reset`.

#### 13.6.10 Shared VPS Warnings (rentocloud)

| Do | Don't |
|----|-------|
| Edit EMS nginx vhost only | Restart rentocloud PM2 processes |
| Use `docker compose` in `/opt/ems` | Change rentocloud nginx server blocks |
| Deploy via GitHub Actions | Run `pm2 delete all` on the box |
| SSH key `hostinger_ems_ed25519` | Share production `.env` in git |

### 13.7 Render vs Hostinger Comparison

| Dimension | <span style="background:#9B59B6;color:#fff;padding:2px 8px;border-radius:4px">Render</span> | <span style="background:#2ECC71;color:#fff;padding:2px 8px;border-radius:4px">Hostinger</span> |
|-----------|--------|-----------|
| **Status** | Legacy / test target | **Primary production** |
| **URL** | `employee-management-system-2b9q.onrender.com` | `ems-api.saqibsaeed.cloud` |
| **Compute** | Render Web Service (managed) | Docker on VPS (self-managed) |
| **Database** | Render PostgreSQL (cross-account external URL) | `ems-postgres` container |
| **Redis** | Not on Render deploy | `ems-redis` live — BullMQ + cache |
| **Deploy** | Render auto-deploy on push | GitHub Actions → SSH |
| **TLS** | Render-managed | nginx on VPS |
| **Cost model** | PaaS per-service | VPS flat (shared with rentocloud) |
| **Cold start** | Yes (free tier spin-down) | No — always on |
| **Connection pool** | `connection_limit=5` caused bell 500s | Local pool in container |
| **Backups** | Render DB backups | `pg_dump` pre-deploy + retention 14 |
| **Local parity** | External DATABASE_URL only | SSH tunnel script available |

\newpage
"""

UTILS_REF = r"""
## 18. Utilities Reference (`src/utils/`)

| File | Purpose |
|------|---------|
| `hash.js` | Argon2id password hash + SHA-256 for reset tokens |
| `token.js` | JWT access token creation via `jose` |
| `response.js` | `successResponse()` / `errorResponse()` envelope |
| `id.js` | UUID v4 `generateId()` |
| `logger.js` | Shared Pino logger instance |
| `otp.js` | OTP code generation + masking |
| `pagination.js` | Offset pagination helpers |
| `money.js` | Currency-safe decimal formatting |
| `statutoryCalculation.js` | PF/ESI/tax slab engine |
| `statutoryPackShape.js` | Pack DTO normalization |
| `payrollPeriod.js` | Pay period date math |
| `payFrequency.js` | MONTHLY/SEMI_MONTHLY cycle counts |
| `payCalendarShape.js` | Pay calendar DTO helpers |
| `payrollComponentShape.js` | Salary component shapes |
| `payrollUiShapes.js` | UI-facing payroll DTOs |
| `formulaEval.js` | Safe formula evaluation for `% of basis` |
| `workingDays.js` | Working day counts with holidays |
| `departmentTree.js` | BFS descendants + rollup headcount |
| `cloudinary.js` | Upload stream + WebP pipeline |
| `sseClients.js` | In-memory SSE client map per userId |
| `notifier.js` | Create in-app Notification rows |
| `cycleGenerator.js` | Pay cycle date generation |
| `icsParser.js` | ICS calendar import for holidays |
| `importJobStore.js` | In-memory import job status |
| `refNo.js` | Sequential reference numbers |

## 19. Middleware & Plugins Reference

### Middleware (`src/middleware/`)

| File | Hook | Responsibility |
|------|------|----------------|
| `resolveTenant.js` | `onRequest` (global under `/api/v1`) | 4-layer tenant resolution |
| `authenticate.js` | route `onRequest` | JWT verify + session revocation check |
| `authenticate.js` | `authorize(roles)` | Role gate; SUPER_ADMIN bypass |
| `errorHandler.js` | `setErrorHandler` | Maps errors → JSON envelope |
| `requestLogging.js` | `onResponse` | Pino request/response log line |

### Plugins (`src/plugins/`)

| File | Order | Responsibility |
|------|:-----:|----------------|
| `requestId.js` | 1 | `X-Request-Id` correlation |
| `prisma.js` | 3 | `fastify.prisma` decorator |
| `cors.js` | 4 | Origin allowlist + credentials |
| `helmet.js` | 5 | Security headers (CSP off for /docs) |
| `rateLimit.js` | 6 | 100 req / 15 min global |
| `swagger.js` | **last** | OpenAPI + `/docs` UI |
| `redis.js` | legacy stub | Returns null — use `src/lib/redis.js` |

### Jobs (`src/jobs/` + `src/lib/`)

| File | Role |
|------|------|
| `emailJob.js` | Resend HTTP + SMTP fallback; password reset, OTP, invites |
| `exportJob.js` | ExcelJS export worker (sync `setImmediate`) |
| `lib/payrollQueue.js` | BullMQ `payroll-calculate` queue + in-process worker |
| `lib/redis.js` | ioredis client; cache get/set; no-op without REDIS_URL |

\newpage
"""

GLOSSARY_EXPANDED = r"""
## Appendix A — Glossary (Expanded)

| Term | Definition |
|------|-----------|
| **tenant** | One customer organization; all rows scoped by `tenantId` |
| **tenantKey** | Stable string for `X-Tenant-Key` header (e.g. `acme-corp-001`) |
| **slug** | Subdomain identifier (`acme` from `acme.yourems.com`) |
| **memberType** | Role enum: SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE, AUDITOR |
| **statutory pack** | Versioned JSON config for country tax/contribution rules |
| **pay group** | Set of employees sharing salary components and pay calendar |
| **payroll run** | Batch calculation for one pay period (DRAFT→CALCULATING→REVIEW→APPROVED→PAID) |
| **payslip** | Per-employee result of a payroll run |
| **legal entity** | Company registration unit linked to a statutory pack |
| **leave ledger** | Append-only transactions for leave balance (accrual, debit, encashment) |
| **comp-off** | Compensatory off — extra leave earned for working on holiday/weekend |
| **regularization** | Employee request to fix missed/wrong attendance punch |
| **period lock** | HR-defined date range where timesheets cannot be edited |
| **session family** | Group of rotated refresh tokens; reuse detection revokes entire family |
| **soft delete** | `deletedAt` timestamp — row retained for audit/history |
| **export job** | Async (inline) CSV/XLSX generation with `ExportJob` status tracking |
| **BullMQ** | Redis-backed job queue used for payroll CALCULATING on Hostinger |
| **minor units** | Integer storage for money (INR×100, KWD×1000, JPY×1) |
| **work week** | TenantConfig array of workdays (e.g. SUN–THU for Kuwait) |
| **rentocloud** | Co-tenant on same VPS — must not be disrupted by EMS ops |

## Appendix B — Document Revision History

| Date | Version | Changes |
|------|---------|---------|
| July 2026 | 1.0 | Initial comprehensive technical documentation |
| July 2026 | **2.0** | Expanded workflows, Hostinger deep dive, colored diagrams, Quick Start, full utils/middleware reference, 18+ new flowcharts |

---

*End of Document — v2.0*
"""

NEW_TOC = """## Table of Contents

0. [Quick Start for New Developers](#0-quick-start-for-new-developers)
1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
   - [2.5 Middleware Decision Tree](#25-middleware-decision-tree--which-middleware-runs-when)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Multi-Tenancy Deep Dive](#5-multi-tenancy-deep-dive)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Module Reference](#7-module-reference)
8. [Database Schema Overview](#8-database-schema-overview)
9. [Payroll Engine](#9-payroll-engine)
10. [External Integrations](#10-external-integrations)
11. [Error Handling & Logging](#11-error-handling--logging)
12. [Testing Strategy](#12-testing-strategy)
13. [Deployment](#13-deployment)
    - [13.6 Hostinger Deep Dive](#136-hostinger-deep-dive-production)
    - [13.7 Render vs Hostinger](#137-render-vs-hostinger-comparison)
14. [Security Considerations](#14-security-considerations)
15. [Known Issues (E2E Audits)](#15-known-issues-e2e-audits)
16. [API Reference Overview](#16-api-reference-overview)
17. [End-to-End Workflow Diagrams](#17-end-to-end-workflow-diagrams)
18. [Utilities Reference](#18-utilities-reference-srcutils)
19. [Middleware & Plugins Reference](#19-middleware--plugins-reference)
Appendix A. [Glossary](#appendix-a--glossary-expanded)
Appendix B. [Revision History](#appendix-b--document-revision-history)
"""


def main():
    text = DOC.read_text(encoding="utf-8")

    # Version bump
    text = text.replace('version: "July 2026"', 'version: "July 2026 v2.0"')
    text = text.replace("**Version** | July 2026 |", "**Version** | July 2026 **v2.0** |")
    text = text.replace("| July 2026 | 1.0 | Initial comprehensive technical documentation |",
                        "| July 2026 | 1.0 | Initial comprehensive technical documentation |\n| July 2026 | **2.0** | See Appendix B |")

    # Replace TOC
    import re
    text = re.sub(
        r"## Table of Contents\n\n.*?\n\n\\newpage",
        NEW_TOC + "\n\n\\newpage",
        text,
        count=1,
        flags=re.DOTALL,
    )

    # Insert Quick Start after first \newpage following TOC
    marker = "\\newpage\n\n---\n\n## 1. Executive Summary"
    if marker in text:
        text = text.replace(marker, "\\newpage\n" + QUICK_START + "\n---\n\n## 1. Executive Summary", 1)

    # Colorize main architecture diagram (section 2.1)
    old_arch = """```mermaid
flowchart TB
    subgraph Clients
        FE[Next.js Frontend]
        SW[Swagger / Postman]
        MOB[Mobile / Integrations]
    end

    subgraph Edge["Edge Layer (Hostinger VPS)"]
        NGINX[nginx<br/>TLS termination<br/>reverse proxy]
    end

    subgraph App["Application Layer"]
        FAST[Fastify v4<br/>Node.js 20]
        MW[Middleware Chain]
        MOD[Domain Modules]
    end

    subgraph Data["Data Layer"]
        PRISMA[Prisma ORM v5]
        PG[(PostgreSQL 18)]
    end

    subgraph External["External Services"]
        RESEND[Resend Email API]
        CLD[Cloudinary CDN]
    end

    FE --> NGINX
    SW --> NGINX
    MOB --> NGINX
    NGINX --> FAST
    FAST --> MW --> MOD
    MOD --> PRISMA --> PG
    MOD --> RESEND
    MOD --> CLD
```"""
    new_arch = """```mermaid
flowchart TB
    subgraph Clients["🔵 Clients"]
        FE[Next.js Frontend]
        SW[Swagger / Postman]
        MOB[Mobile / Integrations]
    end

    subgraph Edge["Edge Layer (Hostinger VPS)"]
        NGINX[nginx<br/>TLS :443 → :4001<br/>ems-api.saqibsaeed.cloud]
    end

    subgraph App["🟢 Application Layer"]
        FAST[Fastify v4<br/>Node.js 20]
        MW[Middleware Chain]
        MOD[Domain Modules]
        REDIS[(Redis BullMQ + cache)]
    end

    subgraph Data["🟠 Data Layer"]
        PRISMA[Prisma ORM v5]
        PG[(PostgreSQL 18)]
    end

    subgraph External["🟣 External Services"]
        RESEND[Resend Email API]
        CLD[Cloudinary CDN]
    end

    FE --> NGINX
    SW --> NGINX
    MOB --> NGINX
    NGINX --> FAST
    FAST --> MW --> MOD
    MOD --> PRISMA --> PG
    MOD --> REDIS
    MOD --> RESEND
    MOD --> CLD

    class FE,SW,MOB client
    class NGINX,FAST,MW,MOD api
    class PRISMA,PG,REDIS db
    class RESEND,CLD external
""" + MERMAID_STYLES + "\n```"
    text = text.replace(old_arch, new_arch)

    # Insert middleware tree after section 2.4 (before section 3)
    sec3_marker = "\n---\n\n## 3. Technology Stack"
    if "## 2.5 Middleware Decision Tree" not in text:
        text = text.replace(sec3_marker, MIDDLEWARE_TREE + sec3_marker, 1)

    # Insert Hostinger deep dive before 13.4 Render
    host_marker = "### 13.4 Render (Legacy)"
    if "### 13.6 Hostinger Deep Dive" not in text:
        text = text.replace(host_marker, HOSTINGER + "\n" + host_marker, 1)

    # Insert workflows before appendix A
    app_marker = "## Appendix A — Glossary"
    if "## 17. End-to-End Workflow Diagrams" not in text:
        text = text.replace(app_marker, WORKFLOWS + UTILS_REF + app_marker, 1)

    # Replace glossary appendix
    if "## Appendix A — Glossary (Expanded)" not in text:
        import re as re2
        text = re2.sub(
            r"## Appendix A — Glossary\n\n.*?\n\n## Appendix B — Document Revision History\n\n.*?\n\n---\n\n\*End of Document\*",
            GLOSSARY_EXPANDED,
            text,
            count=1,
            flags=re2.DOTALL,
        )

    # Add role badges to module table sample (HR_ADMIN in section 7 intro) - enhance authorize table
    role_note = "| `SUPER_ADMIN` | All endpoints"
    if "background:#2ECC71" not in text and role_note in text:
        text = text.replace(
            "| `HR_ADMIN` | Employee CRUD, payroll runs, settings, exports |",
            "| <span style=\"background:#2ECC71;color:#fff;padding:2px 8px;border-radius:4px\">HR_ADMIN</span> | Employee CRUD, payroll runs, settings, exports |",
        )

    DOC.write_text(text, encoding="utf-8")
    lines = text.count("\n") + 1
    diagrams = text.count("```mermaid")
    print(f"Wrote {DOC}")
    print(f"Lines: {lines}")
    print(f"Mermaid diagrams: {diagrams}")


if __name__ == "__main__":
    main()
