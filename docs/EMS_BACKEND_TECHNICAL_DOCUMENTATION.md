---
title: "EMS Backend — Technical Documentation"
subtitle: "Employee Management System REST API"
version: "July 2026 v3.1"
author: "EMS Engineering"
---

<div class="title-page" style="background:linear-gradient(135deg,#1565c0 0%,#2e7d32 100%);color:#fff;padding:48px 32px;border-radius:8px;">

# EMS Backend — Technical Documentation

**Employee Management System REST API**

<p><strong>Version:</strong> July 2026 v3.0<br>
<strong>Runtime:</strong> Node.js 20+ (ES Modules)<br>
<strong>Primary API:</strong> https://ems-api.saqibsaeed.cloud/api/v1<br>
<strong>Swagger UI:</strong> https://ems-api.saqibsaeed.cloud/docs<br>
<strong>Repository:</strong> github.com/saeedafri/Employee-management-system</p>

</div>

\newpage

## Table of Contents

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
   - [10.4 Server-Side Dynamic Export Generation](#104-server-side-dynamic-export-generation-csv--excel--json--pdf)
   - [10.5 July 2026 Hostinger Hardening](#105-july-2026-hostinger-hardening--what-changed)
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
Appendix C. [Complete API Route Index](#appendix-c--complete-api-route-index)
Appendix D. [Developer Troubleshooting](#appendix-d--developer-troubleshooting)

## 0. Quick Start for New Developers

<blockquote style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Clone the repo, start local Postgres, migrate, seed, and hit Swagger — you will have a working API in about 15 minutes.
</blockquote>

> **What it does:** Gets a new engineer from zero to a working local API in under 15 minutes.
>
> **Why it matters:** Onboarding speed reduces mistakes against production data.
>
> **How it works:** Clone → local Postgres → migrate → seed → dev server → Swagger login.

### 0.1 Prerequisites

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Tool</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Version</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Purpose</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Node.js</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">≥ 20</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Runtime (ES modules)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Docker</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">any recent</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Local PostgreSQL only</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Git</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">2.x</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Clone + branch workflow</td></tr>
</tbody></table>

### 0.2 First-Time Setup

1. Clone the repository and install dependencies.
2. Start PostgreSQL via Docker Compose.
3. Point `DATABASE_URL` at the local database.
4. Run Prisma migrations and seed data.
5. Start the dev server and open Swagger.

```bash
git clone https://github.com/saeedafri/Employee-management-system.git EMS
cd EMS
npm ci
docker compose up -d
export DATABASE_URL=postgresql://ems:ems_local_dev@127.0.0.1:5432/ems_dev
npx prisma migrate deploy
npm run db:seed
npm run dev
```

### 0.3 Verify Login (Swagger or curl)

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Key: acme-corp-001" \
  -d '{"email":"hr@acme.test","password":"Password123!"}' | jq .
```

Open **http://localhost:3000/docs** — authorize with the returned `accessToken`.

### 0.4 Where to Look First

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Task</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Start here</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Add an API endpoint</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/modules/<domain>/*.routes.js` → controller → service → repository</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Change auth rules</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/middleware/authenticate.js`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant scoping</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/middleware/resolveTenant.js` + always `tenantId` in Prisma `where`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll math</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/modules/payroll/` + `src/utils/statutoryCalculation.js`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">API contract</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`docs/API_MAPPING.md` + `src/plugins/swagger.js`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Deploy</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`.github/workflows/deploy-hostinger.yml`</td></tr>
</tbody></table>


---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 1. Executive Summary
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> EMS is a multi-tenant HR API — one codebase serves many companies, each isolated by tenant.<br><em>This section orients architects and new backend engineers on scope, endpoints, and design goals.</em>
</blockquote>

The **EMS (Employee Management System) Backend** is a production-grade, multi-tenant Human Resource Management System (HRMS) REST API. It powers employee lifecycle management, attendance, leave, timesheets, payroll, analytics, and administrative workflows for organizations operating across multiple countries.

### Key Characteristics

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Dimension</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Description</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Architecture**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Modular monolith — Fastify v4 with layered route → controller → service → repository pattern</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Data isolation**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Shared PostgreSQL database with row-level `tenantId` scoping on every table</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Authentication**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JWT access tokens (15 min) + opaque refresh token rotation (httpOnly cookie, 30 days)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Authorization**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Role-based via `memberType` + JWT `permissions[]` (`requirePermission`); `SUPER_ADMIN` bypasses role/permission checks</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Deployment**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Primary: Hostinger VPS (Docker + nginx + PM2). Legacy: Render Web Service</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**API contract**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OpenAPI/Swagger at `/docs`; canonical field mapping in `docs/API_MAPPING.md`</td></tr>
</tbody></table>

### Production Endpoints

```
Primary (Hostinger):  https://ems-api.saqibsaeed.cloud/api/v1
Legacy (Render):      https://employee-management-system-2b9q.onrender.com/api/v1
Health:               GET /health  →  { "status": "ok" }
Swagger:              GET /docs
```

### Scope of This Document

This document is intended for **backend developers**, **solution architects**, and **DevOps engineers** integrating with or operating the EMS API. It covers request lifecycles, tenant resolution, auth flows, module boundaries, the payroll calculation engine, deployment topology, and operational concerns.

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 2. System Architecture Overview
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Every request flows through nginx → Fastify middleware → domain modules → Prisma → PostgreSQL.<br><em>Understand the layers before diving into individual modules or auth rules.</em>
</blockquote>

### 2.1 High-Level Architecture

```mermaid
flowchart TB
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
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

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class FE,MOB,SW client
    class App,Clients,Data,Edge,External,FAST,Layer,MOD,MW,NGINX api
    class PG,PRISMA db
    class CLD,REDIS,RESEND external
```

### 2.2 Request Lifecycle

Every HTTP request passes through a deterministic pipeline before reaching domain logic.

```mermaid
sequenceDiagram
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2', 'actorBkg': '#e8f5e9', 'actorTextColor': '#1b5e20', 'actorLineColor': '#2e7d32', 'actorBorder': '#2e7d32', 'signalColor': '#1976d2', 'signalTextColor': '#0d47a1', 'noteBkgColor': '#fff3e0', 'noteTextColor': '#e65100'}}}%%
participant C as Client
    participant N as nginx
    participant F as Fastify
    participant RT as resolveTenant
    participant AU as authenticate
    participant AZ as authorize
    participant CT as Controller
    participant SV as Service
    participant RP as Repository
    participant DB as PostgreSQL

    C->>N: HTTPS request
    N->>F: Proxy to Node :3000
    F->>F: requestId, CORS, helmet, rateLimit
    F->>F: JSON body parser (tolerant empty body)
    F->>RT: onRequest hook
    RT->>DB: Lookup Tenant (if identifier present)
    RT-->>F: request.tenant populated
    F->>AU: Route-level onRequest (protected routes)
    AU->>DB: Verify session not revoked
    AU-->>F: request.user populated
    F->>AZ: authorize(roles[]) if configured
    AZ-->>F: 403 or continue
    F->>CT: Route handler
    CT->>SV: Business logic
    SV->>RP: Data access
    RP->>DB: Prisma query
    DB-->>RP: Result
    RP-->>SV: Domain object
    SV-->>CT: Response DTO
    CT-->>F: successResponse() envelope
    F-->>N: JSON response
    N-->>C: HTTPS response
```

### 2.3 ASCII — Request Path Summary

```
Client
  │
  ▼
nginx (TLS, X-Forwarded-*)
  │
  ▼
Fastify plugins: requestId → cookie → prisma → cors → helmet → rateLimit → multipart
  │
  ▼
Global: requestLogging hook, errorHandler
  │
  ▼
/api/v1/* prefix group:
  onRequest: resolveTenant
  Route: onRequest: [authenticate, authorize(...)]
  Handler: controller → service → repository → Prisma
  │
  ▼
PostgreSQL (tenant-scoped rows)
```

### 2.4 Registered Route Modules

All domain routes register under `config.apiPrefix` (`/api/v1`) in `src/app.js`:

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Module</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Route Prefix</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Primary Concern</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Auth</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Login, refresh, MFA, password reset</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employees</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/employees/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">CRUD, documents, photo upload</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Departments</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/departments/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Org hierarchy</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Holidays</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/holidays/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Calendar management</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/leave/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Requests, balances, approvals</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave Engine</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/leave-engine/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Policy engine, ledger</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Attendance</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/attendance/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Check-in/out, regularization</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheets</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/timesheets/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Time entries, projects</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheets Config</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/timesheets/config/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Templates, settings</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/payroll/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Runs, payslips, statutory</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payout</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/payroll/me/payout-methods`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee bank details</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Analytics</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/analytics/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR dashboards</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Reports</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/reports/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Scheduled reports</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Export</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/export/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Async CSV/Excel exports</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Settings</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/settings/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant config, integrations</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Notifications</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/notifications/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">In-app + SSE stream</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Search</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/search`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Global search</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Audit Logs</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/audit-logs/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Immutable audit trail</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Dashboard (Manager)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/manager/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Manager views</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Dashboard (Employee)</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/employee/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee self-service</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Recruitment</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/recruitment/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Job openings, candidates</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Performance</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/performance/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Reviews, goals</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Assets</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/assets/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Asset tracking</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Announcements</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/announcements/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Company comms</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Billing</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/billing/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Subscription billing</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Logs</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/logs`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Application log entries</td></tr>
</tbody></table>


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 2.5 Middleware Decision Tree — Which Middleware Runs When?


> **What it does:** Shows exactly which hooks fire for public vs protected routes.
>
> **Why it matters:** Misunderstanding middleware order causes auth bugs and missing tenant context.
>
> **How it works:** Follow the tree from HTTP method + path to the final handler.


```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
START([HTTP Request]) --> GLOBAL[Global plugins:<br/>requestId → cookie → prisma → cors → helmet → rateLimit → multipart]
    GLOBAL --> PREFIX{Path starts with /api/v1?}
    PREFIX -->|No| HEALTH["health healthz docs - no tenant hook"]
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

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class PREFIX,START client
    class AUTH,AUTHZ,GLOBAL,HANDLER,HEALTH,ROLE,ROUTE,RT,SVC,TENANT api
    class E400,E401,E403 warn
```

### Tenant-Optional vs Protected Routes

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Route pattern</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">resolveTenant</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">authenticate</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">authorize</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /auth/login`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">optional (email resolves)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /health`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">— (outside prefix)</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /employees`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">required</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">yes</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /employees`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">required</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">yes</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /analytics/summary`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">required</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">yes</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
</tbody></table>

\newpage

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 3. Technology Stack
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Node 20, Fastify 4, Prisma 5, and PostgreSQL form the core; integrations handle email, files, and exports.<br><em>Versions and libraries listed here are the supported production stack.</em>
</blockquote>

### 3.1 Core Stack

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Layer</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Technology</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Version / Notes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Runtime</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Node.js</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">≥ 20.0.0, ES Modules (`"type": "module"`)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Framework</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Fastify</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">v4 — plugins for CORS, helmet, rate-limit, cookie, multipart</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ORM</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Prisma</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">v5 — no raw SQL; always Prisma Client</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Database</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PostgreSQL</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">v18 (local Docker + Hostinger production)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Auth tokens</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">jose</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JWT access tokens</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Password hashing</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Argon2id</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">type:2, memoryCost:19456, timeCost:2</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Validation</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Zod</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Request body validation in services</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Logging</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Pino</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Structured JSON logs; pino-pretty in dev</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">API docs</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">@fastify/swagger</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OpenAPI spec at `/docs`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Image processing</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">sharp</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">WebP conversion before Cloudinary upload</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Email</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Resend HTTP API</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Primary provider for OTP/password reset</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">File storage</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cloudinary</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Documents, employee photos, tenant logos</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Export (Excel)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ExcelJS</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Styled XLSX — frozen header, alternating rows, auto-width</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Export (PDF)</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PDFKit</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Server-side PDF tables (landscape A4) — no headless browser</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Export storage</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cloudinary (raw authenticated)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Durable export artifacts; signed download URLs</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Testing</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Node test runner + Playwright</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Unit, integration, E2E scripts</td></tr>
</tbody></table>

### 3.2 Removed / Deprecated

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Component</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Status</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Redis / BullMQ</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Removed** — all operations synchronous</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MySQL</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Replaced** by PostgreSQL (2026-06)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Queue-based email/export jobs</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Removed** — inline processing</td></tr>
</tbody></table>

### 3.3 Environment Variables (Names Only)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Category</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Variable Names</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Core</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`NODE_ENV`, `PORT`, `LOG_LEVEL`, `APP_NAME`, `APP_VERSION`, `API_PREFIX`, `API_URL`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Database</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`DATABASE_URL`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JWT / Session</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`JWT_SECRET`, `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `SESSION_COOKIE_NAME`, `SESSION_MAX_AGE_DAYS`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Multi-tenant</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`APP_DOMAIN`, `DEFAULT_TENANT_KEY`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">CORS</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`CORS_ORIGIN`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Email</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`EMAIL_PROVIDER`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `RESEND_API_KEY`, `RESEND_FROM`, `BREVO_API_KEY`, `BREVO_FROM`, `SUPPORT_EMAIL`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Password reset</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`RESET_PASSWORD_TOKEN_TTL_MINUTES`, `RESET_PASSWORD_RATE_LIMIT_MAX`, `RESET_PASSWORD_RATE_LIMIT_WINDOW`, `FRONTEND_RESET_PASSWORD_URL`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Invitations</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`INVITE_TOKEN_TTL_HOURS`, `FRONTEND_APP_URL`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">File storage</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Exports</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`EXPORTS_DIR`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Legacy</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`REDIS_URL` (ignored, returns null)</td></tr>
</tbody></table>

> **Production guard:** `JWT_SECRET` must be set to a non-default value when `NODE_ENV=production` — the app fails closed on startup otherwise.

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 4. Project Structure
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Code is organized by domain module, each following routes → controller → service → repository.<br><em>Use this map to find where to add endpoints or trace a bug through the stack.</em>
</blockquote>

### 4.1 Annotated Directory Tree

```
EMS/
├── src/
│   ├── app.js                    # Fastify factory — plugin + route registration
│   ├── server.js                 # Entry point (createApp → listen)
│   ├── config/
│   │   └── index.js              # Centralized env-based configuration
│   ├── middleware/
│   │   ├── authenticate.js       # JWT verify + authorize(roles[])
│   │   ├── resolveTenant.js      # 4-layer tenant resolution
│   │   ├── errorHandler.js       # Global Fastify error handler
│   │   └── requestLogging.js     # Per-request Pino logging hook
│   ├── plugins/
│   │   ├── prisma.js             # Prisma client decorator
│   │   ├── cors.js, helmet.js, rateLimit.js, requestId.js
│   │   └── swagger.js            # OpenAPI spec (registered AFTER routes)
│   ├── modules/                  # Domain modules (see §7)
│   │   └── <module>/
│   │       ├── <module>.routes.js
│   │       ├── <module>.controller.js
│   │       ├── <module>.service.js
│   │       ├── <module>.repository.js
│   │       ├── <module>.validator.js  (where applicable)
│   │       └── <module>.policy.js     (where applicable)
│   └── utils/
│       ├── hash.js, token.js, response.js, id.js, logger.js
│       ├── cloudinary.js, money.js, pagination.js
│       ├── statutoryCalculation.js    # Payroll statutory engine
│       └── sseClients.js              # SSE notification clients
├── prisma/
│   ├── schema.prisma             # 70+ models (see §8)
│   ├── migrations/               # Versioned SQL migrations
│   └── seed*.js                  # Idempotent seed scripts
├── tests/                        # Unit, integration, E2E
├── scripts/                      # Deployed UI audit scripts (phase4)
├── docs/
│   ├── API_MAPPING.md            # Canonical API response shapes
│   └── E2E_BACKEND_ISSUES.md     # Known issues from audits
├── .github/workflows/
│   ├── ci.yml                    # Lint + build check
│   └── deploy-hostinger.yml      # Auto-deploy to VPS
└── docker-compose.yml            # Local Postgres only
```

### 4.2 Module Architecture Pattern

Every domain module follows a consistent layered architecture.

```mermaid
flowchart LR
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
subgraph HTTP
        R[routes.js<br/>Fastify schema<br/>onRequest hooks]
    end
    subgraph Application
        C[controller.js<br/>HTTP I/O<br/>status codes]
        S[service.js<br/>Business rules<br/>validation]
    end
    subgraph Data
        RP[repository.js<br/>Prisma queries<br/>DTO mapping]
        DB[(PostgreSQL)]
    end

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class C client
    class R,S api
    class DB,RP db
```

**Responsibilities:**

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Layer</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Responsibility</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Must NOT</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**routes**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">URL mapping, OpenAPI schema, middleware chain</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Contain business logic</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**controller**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Parse request, call service, format response</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Direct Prisma calls</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**service**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Business rules, authorization checks, orchestration</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Know about HTTP</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**repository**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Prisma queries, data mapping</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Business decisions</td></tr>
</tbody></table>

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 5. Multi-Tenancy Deep Dive
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Every database row belongs to exactly one tenant — isolation is enforced at query time.<br><em>Tenant resolution runs before protected handlers; never query without `tenantId`.</em>
</blockquote>

EMS uses a **shared-database, shared-schema** multi-tenant model. Every table includes a `tenantId` foreign key. Data isolation is enforced at the application layer via Prisma `where` clauses.

### 5.1 Four-Layer Tenant Resolution Chain

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
REQ[Incoming Request] --> L1{Layer 1:<br/>Subdomain slug?}
    L1 -->|acme.yourems.com| SLUG[Lookup Tenant by slug]
    L1 -->|No subdomain| L2{Layer 2:<br/>X-Tenant-Key header?}
    L2 -->|Header present| KEY[Lookup Tenant by tenantKey]
    L2 -->|No header| L3{Layer 3:<br/>JWT tenantId?}
    L3 -->|Token decoded| JWT[Lookup Tenant by id]
    L3 -->|No token/tenantId| L4{Layer 4:<br/>DEFAULT_TENANT_KEY?}
    L4 -->|Env set| DEF[Lookup Tenant by key]
    L4 -->|None| ERR{Route tenant-optional?}
    ERR -->|Yes| PASS[Continue without tenant]
    ERR -->|No| E400[400 MISSING_TENANT]
    SLUG --> FOUND{Tenant found<br/>and active?}
    KEY --> FOUND
    JWT --> FOUND
    DEF --> FOUND
    FOUND -->|Yes| SET["request.tenant populated"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class REQ client
    class DEF,FOUND,JWT,KEY,L1,L2,L3,L4,PASS,SET,SLUG api
    class E400,ERR warn
```

### 5.2 Resolution Priority Table

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Priority</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Source</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Example</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Lookup Field</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">1</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`Host` header subdomain</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`acme.yourems.com` → slug `acme`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`Tenant.slug`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">2</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`X-Tenant-Key` header</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`acme-corp-001`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`Tenant.tenantKey`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">3</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JWT payload `tenantId`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">After login, automatic</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`Tenant.id`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">4</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`DEFAULT_TENANT_KEY` env</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Dev/testing fallback</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`Tenant.tenantKey`</td></tr>
</tbody></table>

### 5.3 Tenant-Optional Routes

These routes resolve tenant internally (typically from email in request body):

- `POST /auth/login`, `/auth/admin/login`, `/auth/refresh`
- `POST /auth/forgot-password`, `/auth/reset-password`, `/auth/validate-reset-token`
- `POST /auth/verify-otp`, `/auth/resend-otp`, `/auth/otp/initiate`
- `POST /auth/register`

### 5.4 Login Auto-Resolution

When a user logs in with email + password (no tenant header):

1. Email is unique across tenants → tenant resolved automatically
2. Email exists in multiple tenants → `AMBIGUOUS_EMAIL` error; client must send `X-Tenant-Key`
3. After login, JWT carries `tenantId` — all subsequent requests are tenant-scoped automatically

### 5.5 Seeded Tenants

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">tenantKey</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Name</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Country</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Currency</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Purpose</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`acme-corp-001`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Acme Corp</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">IN</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">INR</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Primary test tenant (79 employees)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`test-key-123456789`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Test Org</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Secondary test tenant</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`kwd-litmus-001`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Kuwait Litmus Co</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">KW</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">KWD</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Multi-country / locale testing</td></tr>
</tbody></table>

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 6. Authentication & Authorization
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Short-lived JWT access tokens plus rotating httpOnly refresh cookies secure sessions.<br><em>Roles (`memberType`) gate endpoints; SUPER_ADMIN bypasses all role checks.</em>
</blockquote>

### 6.1 Auth Flow Overview

```mermaid
sequenceDiagram
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2', 'actorBkg': '#e8f5e9', 'actorTextColor': '#1b5e20', 'actorLineColor': '#2e7d32', 'actorBorder': '#2e7d32', 'signalColor': '#1976d2', 'signalTextColor': '#0d47a1', 'noteBkgColor': '#fff3e0', 'noteTextColor': '#e65100'}}}%%
participant U as User
    participant API as EMS API
    participant DB as PostgreSQL
    participant Email as Resend

    U->>API: POST /auth/login {email, password}
    API->>DB: Resolve tenant + validate credentials

    alt MFA required (policy or user.mfaEnabled)
        API->>Email: Send OTP
        API-->>U: 202 {mfaRequired, challengeId}
        U->>API: POST /auth/verify-otp {challengeId, code}
        API->>DB: Validate OTP challenge
    end

    API->>DB: Create Session (refresh token hash, familyId)
    API->>API: Sign JWT access token (15m)
    API-->>U: 200 {accessToken, user} + httpOnly cookies
    Note over U,API: accessToken cookie (15m)<br/>ems_session cookie (30d refresh)

    U->>API: Protected request (cookie auto-sent)
    API->>API: authenticate() — verify JWT + session not revoked
    API->>API: authorize(roles) — check memberType
    API-->>U: 200 response

    Note over U,API: Token refresh
    U->>API: POST /auth/refresh (ems_session cookie)
    API->>DB: Validate refresh hash, rotate token
    API-->>U: New accessToken + rotated refresh cookie
```

### 6.2 JWT Access Token Payload

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Claim</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Description</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`sub`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">User ID</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`tenantId`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant ID (for row scoping)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`sessionId`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Session ID (revocation check)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`memberType`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Role enum (SUPER_ADMIN, HR_ADMIN, etc.)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`employeeId`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Linked employee ID (nullable)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`permissions`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Fine-grained permission keys (from Role/Permission tables)</td></tr>
</tbody></table>

### 6.3 Refresh Token Rotation

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
A[Client sends ems_session cookie] --> B[Hash cookie value]
    B --> C{Match active Session?}
    C -->|No| D[401 — re-login required]
    C -->|Yes| E[Generate new refresh token]
    E --> F[Update session.refreshTokenHash]
    F --> G[Issue new accessToken JWT]
    G --> H[Set new httpOnly cookies]

    subgraph Reuse Detection
        I[Old refresh token presented] --> J{sessionFamilyId match<br/>but hash mismatch?}
        J -->|Yes| K[Revoke entire session family]
        K --> L[401 — possible token theft]
    end

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class C client
    class A,B,D,E,F,G,H,I,J,K,L api
```

### 6.4 MFA / OTP Policy

MFA is **policy-driven**, not globally enforced:

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">`mfa_policy` Value</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Who Must MFA</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`REQUIRED_ALL`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Every user</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`REQUIRED_ADMINS`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SUPER_ADMIN + HR_ADMIN</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`OPTIONAL`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Only users with `user.mfaEnabled = true`</td></tr>
</tbody></table>

OTP delivery via Resend email. Challenge stored in `OtpChallenge` table with rate limiting.

### 6.5 Role Hierarchy

```
SUPER_ADMIN  ──► bypasses ALL authorize() checks
    │
HR_ADMIN     ──► full HR operations, settings, analytics
    │
MANAGER      ──► team visibility, leave/attendance approvals
    │
EMPLOYEE     ──► self-service only (own data)
    │
AUDITOR      ──► read-only (same routes as EMPLOYEE currently)
```

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Role</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Typical Access</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`SUPER_ADMIN`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">All endpoints; may lack employee record for `/me/*` routes</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`HR_ADMIN`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee CRUD, payroll runs, settings, exports</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`MANAGER`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Team attendance/leave, manager dashboard</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`EMPLOYEE`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Own attendance, leave, payslips, documents</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`AUDITOR`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Enum exists; no dedicated route set yet</td></tr>
</tbody></table>

### 6.6 Authorization Middleware

```javascript
// authenticate.js — every protected route
onRequest: [authenticate, authorize(['HR_ADMIN', 'SUPER_ADMIN'])]

// SUPER_ADMIN hardcoded bypass in authorize():
if (memberType === 'SUPER_ADMIN') return;
```

> **Note:** `Role`/`Permission`/`RolePermission` models exist in Prisma but `authorize()` uses `memberType` enum only. JWT carries `permissions[]` for future fine-grained checks.

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 7. Module Reference
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Each domain (employees, leave, payroll, etc.) is a self-contained Fastify route group.<br><em>Pick the module that matches your feature; follow the layered pattern inside it.</em>
</blockquote>

### 7.1 Auth (`/auth/*`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Endpoint Group</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Key Operations</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Login</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /login`, `POST /admin/login` — tenant auto-resolve from email</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Session</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /refresh`, `POST /logout`, `POST /logout-all`, `GET /sessions`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Profile</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /me`, `PATCH /me/mfa`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Password</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /forgot-password`, `POST /reset-password`, `GET /validate-reset-token`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MFA</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /verify-otp`, `POST /resend-otp`, `POST /otp/initiate`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Registration</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /register` — creates tenant + first SUPER_ADMIN</td></tr>
</tbody></table>

### 7.2 Employees (`/employees/*`)

- CRUD with soft delete (`deletedAt`)
- `POST /:id/documents` — multipart upload → Cloudinary (WebP for images)
- `POST /:id/photo` — profile photo (sharp → WebP → Cloudinary)
- `GET /employees/export/csv` — HR_ADMIN export
- Role isolation: EMPLOYEE sees own; HR sees all

### 7.3 Departments (`/departments/*`)

- Hierarchical tree (`parentId`, `depth`)
- Optional department head (`headEmployeeId`)
- Cycle detection on parent assignment

### 7.4 Attendance (`/attendance/*`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Endpoint</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Description</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /check-in`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Daily check-in with workMode, location</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /check-out`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Check-out with duration calculation</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /records`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Own records; `?month=YYYY-MM` or date range</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /team/records`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MANAGER/HR_ADMIN team view</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /summary`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Monthly summary stats</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /regularization`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Request attendance correction</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`PATCH /regularization/:id/approve`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Manager approval</td></tr>
</tbody></table>

### 7.5 Leave (`/leave/*` + `/leave-engine/*`)

- Leave types, balances, requests with approval workflow
- Leave engine: policies, assignments, ledger transactions, comp-off
- Statuses: PENDING → APPROVED/DENIED/WITHDRAWN/CANCELLED

### 7.6 Timesheets (`/timesheets/*`)

- Projects, tasks, time entries
- Templates and tenant-level settings
- Integration with payroll (salary context for rate calculation)

### 7.7 Payroll (`/payroll/*`)

See [§9 Payroll Engine](#9-payroll-engine) for calculation details.

Key surfaces: pay groups, salary components, employee salaries, payroll runs, payslips, statutory packs, tax declarations, reimbursements, loans, garnishments.

### 7.8 Holidays (`/holidays/*`)

- Tenant holiday calendar with optional/mandatory flags
- Holiday policies and employee optional selections
- Used by attendance and payroll working-day calculations

### 7.9 Analytics (`/analytics/*`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Endpoint</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Roles</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /summary`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /attendance`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /headcount-by-department`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /recent-activity`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /leave-summary`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
</tbody></table>

### 7.10 Reports & Export

- **Reports:** attendance, leave, payroll reports; scheduled report CRUD
- **Export (dynamic, server-side):** CSV / Excel / JSON / **PDF** for employees, attendance, leave
  - Queue via `POST /export/*` → **202** `{ job_id, status: QUEUED }`
  - Worker: `src/jobs/exportJob.js` (`setImmediate`) — ExcelJS + PDFKit + Cloudinary
  - Download: `GET /export/:job_id/download` (stream or **302** signed URL)
  - Auth: `HR_ADMIN` + permission `employees:export`
  - Full step-by-step + live curls: [§10.4](#104-server-side-dynamic-export-generation-csv--excel--json--pdf)

### 7.11 Settings (`/settings/*`)

- Tenant configuration, email templates, roles/permissions
- Security auth settings (`mfa_policy`)
- Integration endpoints (storage, email provider status)

### 7.12 Notifications (`/notifications/*`)

See [§10.3 Notifications SSE](#103-notifications-sse-stream).

### 7.13 Search (`/search`)

`GET /search?q=<term>` — searches employees, departments, leave, holidays in parallel.

### 7.14 Audit Logs (`/audit-logs/*`)

Immutable change tracking for entity mutations. DPIA report generation and CSV export.

### 7.15 Dashboard

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Prefix</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Audience</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Key Endpoints</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/manager/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MANAGER</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">dashboard, team, approvals</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/employee/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">EMPLOYEE</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">dashboard, documents, team peers</td></tr>
</tbody></table>

### 7.16 Recruitment (`/recruitment/*`)

> **What it does:** Job openings and candidate pipeline for HR hiring workflows.
>
> **Why it matters:** Bridges HRMS with talent acquisition without a separate ATS.
>
> **How it works:** `recruitment.routes.js` → service → Prisma `JobOpening` + `Candidate` models.

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Endpoint area</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Roles</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Notes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Job openings CRUD</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Status: OPEN/CLOSED/ON_HOLD</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Candidates</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Linked to opening; stage tracking</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Public apply</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">varies</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant-scoped candidate create</td></tr>
</tbody></table>

### 7.17 Performance (`/performance/*`)

> **What it does:** Performance cycles, reviews, and goals per employee.
>
> **Why it matters:** Closes the loop between attendance/timesheets and employee development.
>
> **How it works:** Models `PerformanceCycle`, `PerformanceReview`, `PerformanceGoal` with tenant isolation.

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Surface</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Description</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cycles</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Annual/quarterly review periods</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Reviews</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Manager ↔ employee review records</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Goals</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OKR-style targets with status</td></tr>
</tbody></table>

### 7.18 Assets (`/assets/*`)

> **What it does:** Company asset inventory and employee asset requests.
>
> **Why it matters:** Tracks laptops, badges, and equipment assigned to employees.
>
> **How it works:** `Asset` master list + `AssetRequest` workflow (PENDING/APPROVED/DENIED).

### 7.19 Announcements (`/announcements/*`)

> **What it does:** Company-wide or channel-based announcements with read events.
>
> **Why it matters:** Internal comms without email overload.
>
> **How it works:** `AnnouncementChannel` → `Announcement` → `AnnouncementEvent` for delivery tracking.

### 7.20 Billing (`/billing/*`)

> **What it does:** SaaS subscription billing surfaces for tenant admins.
>
> **Why it matters:** SUPER_ADMIN billing screens in settings UI.
>
> **How it works:** `billing.service.js` returns plan/invoice shapes (integration-ready).

### 7.21 Logs (`/logs`)

> **What it does:** Query persisted application log entries (`LogEntry` model).
>
> **Why it matters:** Operational debugging beyond request-level Pino logs.
>
> **How it works:** Filter by level (ERROR/WARN/INFO/DEBUG), paginated list.

### 7.22 Leave Engine (`/leave-engine/*`) — Policy Engine Detail

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Component</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">File</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Role</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Accrual</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`leave/engine/accrual.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Monthly catch-up, tenure tiers</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Proration</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`leave/engine/proration.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Join/exit partial periods</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Ledger</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`leave/engine/ledger.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Balance from txn sum</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Encashment</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`leave/engine/encashment.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Year-end encash rules</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Year-end</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`leave/engine/yearEnd.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Carry-forward / lapse</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Request math</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`leave/engine/requestMath.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Working days in leave span</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Packs</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`leave/data/leavePacks.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Country starter policies</td></tr>
</tbody></table>

```mermaid
flowchart LR
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
POL[LeavePolicy versioned] --> ASG[LeaveAssignment per employee]
    ASG --> ACC[catchUpAccrual]
    ACC --> LED[LeaveLedgerTxn]
    REQ[LeaveRequest] --> RM[requestMath working days]
    RM --> LED

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class REQ client
    class ACC,ASG,LED,POL,RM api
```

### 7.23 Payout (`/payroll/me/payout-methods`)

> **What it does:** Employee bank account / payout method management with country-specific validation.
>
> **Why it matters:** Payroll disbursement requires validated IBAN/account numbers per country.
>
> **How it works:** `payout/` submodule — `bankSchemaCatalog.js`, `bankChecksums.js`, `bankFieldValidation.js`, `isoCountries.js`.

### 7.24 Holidays Policy (`/holidays/policy/*`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Feature</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Description</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Resolved calendar</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`holidayResolver.service.js` merges tenant + optional selections</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Observed dates</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`utils/observedDates.js` — weekend shift rules</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Applicability</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`utils/applicability.js` — location/department filters</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ICS import</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`utils/icsParser.js` for bulk holiday upload</td></tr>
</tbody></table>

### 7.25 Timesheets Config (`/timesheets/config/*`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Feature</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Route</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Roles</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Period locks</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/timesheets/locks`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR create/delete, MGR read</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Approval chain</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">settings blob</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR configure</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Rate config</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">budget/rate math utils</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Templates</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`TimesheetTemplate`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR</td></tr>
</tbody></table>

### 7.26 Auth Submodule Map

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Submodule</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Files</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Concern</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Core auth</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`auth.service.js`, `auth.repository.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Login, refresh, sessions</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Password reset</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`passwordReset.service.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Token hash, TTL, rate limit</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OTP / MFA</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`otp.service.js`, `otp.repository.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Challenge lifecycle</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Invitations</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`invitation.service.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee onboarding emails</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cookies</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`auth.cookies.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">httpOnly `accessToken` + `ems_session`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Policy</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`auth.policy.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MFA requirement rules</td></tr>
</tbody></table>

### 7.27 Settings & Integrations (`/settings/*`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Area</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Key endpoints</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant profile</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET/PATCH /settings/tenant` — logo, work week, timezone</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Email templates</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET/PATCH /settings/email-templates/:type`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Roles display</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET/PATCH /settings/roles-permissions` (SUPER_ADMIN)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Integrations</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">storage status, email provider — `integrations.service.js`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Security</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`mfa_policy` in tenant security settings</td></tr>
</tbody></table>

### 7.28 Module → Prisma Model Quick Map

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Module</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Primary models</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">auth</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">User, Session, PasswordResetToken, OtpChallenge, UserInvitation</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">employees</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee, EmployeeDocument</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">departments</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Department</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">attendance</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AttendanceRecord, AttendanceRegularizationRequest</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">leave</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LeaveType, LeaveBalance, LeaveRequest, LeavePolicy, LeaveLedgerTxn</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">holidays</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Holiday, HolidayPolicy, HolidayOptionalSelection</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">timesheets</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheet, TimeEntry, TimesheetProject, TimesheetTask</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayrollRun, Payslip, PayGroup, StatutoryPack, EmployeeSalary</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">payout</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayoutMethod, PayoutApproval, CountryBankSchema</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">notifications</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Notification</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">auditLogs</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AuditLog</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">export</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ExportJob</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">reports</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ScheduledReport, ReportExport</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">recruitment</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JobOpening, Candidate</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">performance</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PerformanceCycle, PerformanceReview, PerformanceGoal</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">assets</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Asset, AssetRequest</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">announcements</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Announcement, AnnouncementChannel</td></tr>
</tbody></table>

\newpage

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 8. Database Schema Overview
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Prisma models mirror PostgreSQL tables — 40+ entities scoped by `tenantId`.<br><em>Schema relationships drive how services join data; no raw SQL in this codebase.</em>
</blockquote>

### 8.1 Model Inventory (78 Prisma Models)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">#</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Model</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Domain</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Purpose</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">1</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Core</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Multi-tenant root</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">2</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">User</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Core</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Login credentials + memberType</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">3</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Core</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employment profile, manager hierarchy</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">4</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Department</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Core</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Org tree (parentId, depth)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">5</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Role</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">RBAC</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Named roles (future fine-grained)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">6</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Permission</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">RBAC</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Permission keys per module</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">7</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">RolePermission</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">RBAC</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Role ↔ Permission join</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">8</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">UserRole</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">RBAC</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">User ↔ Role join</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">9</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Session</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Auth</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Refresh token + familyId</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">10</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PasswordResetToken</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Auth</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Hashed reset tokens</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">11</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OtpChallenge</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Auth</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MFA OTP challenges</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">12</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">UserInvitation</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Auth</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee invite tokens</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">13</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">EmployeeDocument</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Documents</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cloudinary file metadata</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">14</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AttendanceRecord</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Attendance</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Daily check-in/out</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">15</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AttendanceRegularizationRequest</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Attendance</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Correction workflow</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">16</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LeaveType</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant leave categories</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">17</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LeaveBalance</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cached balance per type</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">18</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LeaveRequest</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Approval workflow</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">19</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LeavePolicy</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Versioned policy config</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">20</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LeaveAssignment</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Policy → employee mapping</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">21</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LeaveLedgerTxn</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Append-only balance ledger</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">22</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">CompOffRequest</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Compensatory off</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">23</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Holiday</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Holidays</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Calendar dates</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">24</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HolidayPolicy</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Holidays</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Optional holiday rules</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">25</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HolidayOptionalSelection</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Holidays</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee selections</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">26</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Resignation</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Resignation workflow (model only)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">27</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AuditLog</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Audit</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Immutable mutation log</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">28</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LogEntry</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Audit</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Application logs</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">29</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Notification</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Comms</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">In-app notifications</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">30</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SavedView</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">UX</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Saved list filters</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">31</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Setting</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Config</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Key-value tenant store</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">32</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ScheduledReport</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Reports</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cron schedule config</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">33</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ReportExport</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Reports</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Export job tracking</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">34</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">TenantConfig</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Config</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Work week, fiscal year</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">35</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">EmailTemplate</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Config</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Custom email bodies</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">36</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ExportJob</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Export</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Async export status</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">37</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SalaryComponent</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Earning/deduction definitions</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">38</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayGroup</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee grouping</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">39</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayGroupComponent</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Components in group</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">40</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">EmployeeSalary</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee pay assignment</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">41</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayrollRun</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Calculation batch</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">42</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payslip</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Per-employee result</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">43</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LegalEntity</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Company registration unit</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">44</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">StatutoryPack</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Country tax/contribution JSON</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">45</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">TaxDeclaration</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee tax regime choice</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">46</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">EmployeeLoan</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Salary advance / loan</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">47</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayrollInput</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Ad-hoc run inputs</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">48</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayCalendar</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Pay period calendar</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">49</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OpeningBalance</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Migration opening balances</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">50</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HistoricalPayslip</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Imported legacy payslips</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">51</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MigrationStatus</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Data migration tracking</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">52</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ReimbursementCategory</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Expense categories</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">53</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ReimbursementClaim</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee claims</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">54</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Garnishment</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Court-ordered deductions</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">55</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ContractorInvoice</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Contractor payments</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">56</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PaymentBatch</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Disbursement batch</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">57</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayrollEvent</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Run audit events</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">58</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayslipTemplate</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PDF template config</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">59</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayoutMethod</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payout</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee bank details</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">60</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayoutApproval</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payout</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payout change approval</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">61</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">CountryBankSchema</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payout</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Per-country field rules</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">62</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JobOpening</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Recruitment</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Open positions</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">63</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Candidate</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Recruitment</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Applicants</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">64</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PerformanceCycle</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Performance</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Review periods</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">65</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PerformanceReview</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Performance</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Review records</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">66</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PerformanceGoal</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Performance</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee goals</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">67</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Asset</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Assets</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Company assets</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">68</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AssetRequest</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Assets</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee requests</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">69</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AnnouncementChannel</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Comms</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Announcement channels</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">70</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Announcement</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Comms</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Posts</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">71</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AnnouncementEvent</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Comms</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Read/delivery events</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">72</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">TimesheetProject</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheets</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Projects</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">73</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">TimesheetTask</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheets</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tasks under projects</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">74</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheet</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheets</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Weekly sheet header</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">75</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">TimeEntry</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheets</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Daily hour rows</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">76</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">TimesheetSettings</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheets</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant timesheet config</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">77</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">TimesheetTemplate</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheets</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Entry templates</td></tr>
</tbody></table>

> **Note:** `Resignation` model exists; dedicated API module not yet wired. RBAC models exist but `authorize()` uses `memberType` enum today.

### 8.1b Domain Grouping (Summary Table)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Domain</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Model count</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Key models</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Core</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">4</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant, User, Employee, Department</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">RBAC</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">4</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Role, Permission, RolePermission, UserRole</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Auth</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">5</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Session, PasswordResetToken, OtpChallenge, UserInvitation</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Attendance</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">2</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AttendanceRecord, AttendanceRegularizationRequest</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Leave</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">7</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">LeaveType, LeaveRequest, LeaveLedgerTxn, ...</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Holidays</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">3</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Holiday, HolidayPolicy, HolidayOptionalSelection</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">22</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayrollRun, Payslip, StatutoryPack, PayGroup, ...</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payout</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">3</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PayoutMethod, PayoutApproval, CountryBankSchema</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheets</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">6</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Timesheet, TimeEntry, TimesheetProject, ...</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Recruitment</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">2</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JobOpening, Candidate</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Performance</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">3</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PerformanceCycle, PerformanceReview, PerformanceGoal</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Assets</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">2</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Asset, AssetRequest</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Announcements</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">3</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Announcement, AnnouncementChannel, AnnouncementEvent</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Platform</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">6</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AuditLog, Notification, ExportJob, Setting, ...</td></tr>
</tbody></table>

### 8.2 Core Entity Relationships

```mermaid
erDiagram
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#fff3e0', 'primaryTextColor': '#e65100', 'lineColor': '#1976d2'}}}%%
Tenant ||--o{ User : has
    Tenant ||--o{ Employee : has
    Tenant ||--o{ Department : has
    User |o--o| Employee : "1:1 optional"
    Employee }o--|| Department : belongs_to
    Employee |o--o| Employee : "manager hierarchy"
    User ||--o{ Session : has
    Employee ||--o{ AttendanceRecord : has
    Employee ||--o{ LeaveRequest : submits
    Employee ||--o{ EmployeeSalary : has
    PayGroup ||--o{ PayGroupComponent : contains
    PayGroup ||--o{ EmployeeSalary : assigns
    PayrollRun ||--o{ Payslip : generates
    StatutoryPack ||--o{ LegalEntity : configures
    Tenant ||--o{ StatutoryPack : owns
```

### 8.3 Multi-Tenant Isolation

Every model with business data includes:

```prisma
tenantId String
tenant   Tenant @relation(fields: [tenantId], references: [id])
```

All repository queries MUST include `where: { tenantId }` — enforced by convention, not database RLS.

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 9. Payroll Engine
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Payroll computes gross → statutory deductions → tax → net per employee per run.<br><em>Highest-risk domain — calculations are data-driven via StatutoryPack JSON, not hardcoded country logic.</em>
</blockquote>

### 9.1 Overview

The payroll engine supports **multi-country statutory compliance** through configurable statutory packs. Calculation is config-driven — no hardcoded country logic in the core loop.

### 9.2 Supported Countries (Built-in Metadata)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Code</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Country</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Currency</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Fiscal Year Start</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">IN</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">India</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">INR</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">April (month 4)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">US</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">United States</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">USD</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">January</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GB</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">United Kingdom</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GBP</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">April</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SA</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Saudi Arabia</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SAR</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">January</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AE</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">UAE</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">AED</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">January</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">VN</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Vietnam</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">VND</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">January</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SG</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Singapore</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SGD</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">January</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">CA</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Canada</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">CAD</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">January</td></tr>
</tbody></table>

> Additional countries (e.g., **KW/KWD** for `kwd-litmus-001` tenant) are supported via tenant-specific `StatutoryPack` and `LegalEntity` configuration without requiring code changes.

### 9.3 Payroll Run Flow

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
START[HR creates PayrollRun<br/>status: DRAFT] --> SELECT[Select pay group + period]
    SELECT --> CALC[POST calculate<br/>status: CALCULATING]

    CALC --> LOOP{For each active<br/>employee in pay group}
    LOOP --> PACK[Resolve StatutoryPack<br/>by legal entity / country / date]
    PACK --> COMP[Build salary components<br/>FLAT / PERCENTAGE / FORMULA]
    COMP --> PRORATE[Prorate for partial periods<br/>join/leave dates]
    PRORATE --> STAT[computeStatutoryContributions<br/>PF, ESI, tax slabs]
    STAT --> TAX[computeIncomeTaxFromRegime<br/>old/new regime India]
    TAX --> DED[Apply loans, garnishments,<br/>reimbursements, inputs]
    DED --> SLIP[Create Payslip record]
    SLIP --> LOOP

    LOOP -->|Done| REVIEW[status: REVIEW]
    REVIEW --> APPROVE[HR approves → APPROVED]
    APPROVE --> PAID[Mark PAID + payment batch]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class START client
    class APPROVE,CALC,COMP,DED,LOOP,PACK,PAID,PRORATE,REVIEW,SELECT,SLIP,STAT,TAX api
```

### 9.4 Statutory Pack Resolution

```mermaid
flowchart LR
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
EMP[EmployeeSalary] --> LE{legalEntityId?}
    LE -->|Yes| LEPACK[LegalEntity → StatutoryPack]
    LE -->|No| COUNTRY{country on salary?}
    COUNTRY -->|Yes| CPACK[Country → active StatutoryPack]
    COUNTRY -->|No| TENANT[Tenant default pack]
    LEPACK --> PIN[Pin pack version<br/>on PayrollRun metadata]
    CPACK --> PIN

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class COUNTRY,CPACK,EMP,LE,LEPACK,PIN,TENANT api
```

**India-specific:** PF, ESI, professional tax, income tax slabs (old/new regime), HRA exemptions.

**KWD / Gulf:** No built-in `SUPPORTED_COUNTRIES` entry — requires tenant-seeded `StatutoryPack` with country `KW` and appropriate contribution schemes.

### 9.5 Component Calculation Types

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Type</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Behavior</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`FLAT`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Fixed monthly amount</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`PERCENTAGE`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`% of basisCode` component (e.g., 40% of BASIC)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`FORMULA`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Evaluated expression referencing computed component codes</td></tr>
</tbody></table>

### 9.6 Payslip Generation

After run approval, payslips are generated per employee with:
- Earnings, deductions, employer contributions breakdown
- Statutory line items from pinned pack version
- YTD accumulators for tax and statutory caps
- Export via `GET /payroll/runs/:id/payslips/export`

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 10. External Integrations
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Email (Resend), file storage (Cloudinary), and optional Redis (BullMQ) live outside the monolith.<br><em>Each integration degrades gracefully when env vars are missing.</em>
</blockquote>

### 10.1 Resend (Email)

```mermaid
flowchart LR
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
TRIGGER[Auth event<br/>OTP / reset / invite] --> JOB[emailJob inline send]
    JOB --> RESEND[Resend HTTP API<br/>RESEND_API_KEY]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class JOB,TRIGGER api
    class RESEND external
```

- Primary provider for OTP, password reset, employee invitations
- Fallback: SMTP (Brevo) configurable via env vars
- Rate limits on forgot-password and OTP endpoints

### 10.2 Cloudinary (File Upload)

```mermaid
sequenceDiagram
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2', 'actorBkg': '#e8f5e9', 'actorTextColor': '#1b5e20', 'actorLineColor': '#2e7d32', 'actorBorder': '#2e7d32', 'signalColor': '#1976d2', 'signalTextColor': '#0d47a1', 'noteBkgColor': '#fff3e0', 'noteTextColor': '#e65100'}}}%%
participant C as Client
    participant API as EMS API
    participant SH as sharp
    participant CL as Cloudinary

    C->>API: POST /employees/:id/documents (multipart)
    API->>API: authenticate + authorize
    API->>API: isCloudinaryConfigured()?
    alt Not configured
        API-->>C: 503 STORAGE_NOT_CONFIGURED
    end
    API->>SH: Convert image → WebP (quality 90)
    SH-->>API: webpBuffer
    API->>CL: upload_stream(folder, publicId)
    CL-->>API: secure_url, publicId
    API->>API: Save EmployeeDocument metadata
    API-->>C: 201 {fileUrl, ...}
```

**Upload targets:**
- Employee documents (`POST /employees/:id/documents`)
- Employee photos (`POST /employees/:id/photo`) — always WebP
- Tenant logo (`PATCH /settings/tenant` with logo file)

### 10.3 Notifications SSE Stream

```mermaid
sequenceDiagram
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2', 'actorBkg': '#e8f5e9', 'actorTextColor': '#1b5e20', 'actorLineColor': '#2e7d32', 'actorBorder': '#2e7d32', 'signalColor': '#1976d2', 'signalTextColor': '#0d47a1', 'noteBkgColor': '#fff3e0', 'noteTextColor': '#e65100'}}}%%
participant FE as Frontend
    participant API as GET /notifications/stream
    participant SSE as sseClients Map
    participant DB as PostgreSQL

    FE->>API: ?token=<accessToken>
    API->>API: verifyToken(token) → userId
    API-->>FE: 200 text/event-stream
    API->>SSE: addClient(userId, reply)

    loop Every 25s
        API-->>FE: : heartbeat
    end

    Note over API,DB: On notification create
    API->>SSE: broadcast to userId clients
    SSE-->>FE: data: {notification JSON}

    FE->>API: Connection close
    API->>SSE: removeClient(userId, reply)
```

- Polling fallback: `GET /notifications?since=ISO`
- Unread badge: `GET /notifications/unread-count`
- Mark read: `PATCH /notifications/:id/read` (POST alias supported)

### 10.4 Server-Side Dynamic Export Generation (CSV / Excel / JSON / PDF)

<blockquote style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> The UI never builds files in the browser. It asks the API to queue a job; the server pulls live DB rows, writes CSV/Excel/JSON/PDF, optionally uploads to Cloudinary, then the UI downloads by <code>job_id</code>.
</blockquote>

> **What it does:** Dynamically generates employee, attendance, and leave export files from live PostgreSQL data.  
> **Why it matters:** Correct columns, tenant isolation, permission gates, and durable storage — no client-side Blob spoofing.  
> **How it works:** `POST /export/*` → `ExportJob` row → `setImmediate` worker in `exportJob.js` → format writers → Cloudinary/disk → `GET /export/:job_id/download`.  
> **Live since:** Hostinger commit `68d32f4` (2026-07-19).  
> **Auth:** `HR_ADMIN` (+ `SUPER_ADMIN` bypass) **and** permission `employees:export`.

#### 10.4.1 Libraries — What / Why / How

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Library</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">What</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Why we use it</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">How it is used</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><strong>ExcelJS</strong></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Node XLSX writer</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Styled workbooks (frozen header, indigo header fill, alternating rows, auto column width) without spawning Excel</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>generateExcel()</code> in <code>src/jobs/exportJob.js</code> → <code>workbook.xlsx.writeFile()</code></td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><strong>PDFKit</strong></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Streaming PDF generator</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Server-side PDF without headless Chrome; small dependency; table layout for ops exports</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>generatePDF()</code> — landscape A4, header bar <code>#4F46E5</code>, first 8 columns, paginated rows</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><strong>Node fs</strong></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Filesystem API</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Write CSV/JSON buffers and stage files before Cloudinary upload</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>writeFileSync</code> under <code>EXPORTS_DIR</code> (<code>/tmp/exports</code> or <code>config.exportsDir</code>)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><strong>Cloudinary SDK</strong></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Object storage CDN</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Durable authenticated <code>raw</code> assets; survives container restarts; signed short-lived download URLs</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>persistSuccess()</code> uploads buffer; stores <code>cloudinary://{publicId}</code> in <code>ExportJob.fileUrl</code></td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><strong>Prisma</strong></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ORM</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant-scoped reads for export datasets + job status rows</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>export.repository.js</code> <code>getEmployeesForExport</code> / attendance / leave + <code>ExportJob</code> CRUD</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><strong>uuid</strong></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ID generator</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Opaque <code>job_id</code> for poll/download URLs</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>uuidv4()</code> in <code>export.service.js</code> queue helpers</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><strong>Zod</strong> (validator)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Schema validation</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Reject bad <code>format</code> / missing date ranges before queueing</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>export.validator.js</code> — <code>format: csv|excel|json|pdf</code></td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><strong>auth.policy</strong></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Permission middleware</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Fine-grained gate beyond role enum</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>requirePermission('employees:export')</code> on export routes</td></tr>
</tbody></table>

#### 10.4.2 End-to-End Flow (all formats)

```mermaid
sequenceDiagram
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2', 'actorBkg': '#e8f5e9', 'actorTextColor': '#1b5e20', 'actorLineColor': '#2e7d32', 'actorBorder': '#2e7d32', 'signalColor': '#1976d2', 'signalTextColor': '#0d47a1', 'noteBkgColor': '#fff3e0', 'noteTextColor': '#e65100'}}}%%
participant UI as Frontend / curl
participant R as export.routes
participant C as export.controller
participant S as export.service
participant DB as PostgreSQL ExportJob
participant W as exportJob.js worker
participant F as Format writers
participant CL as Cloudinary

UI->>R: POST /export/employees {format}
R->>R: authenticate + authorize HR_ADMIN + employees:export
R->>C: exportEmployees
C->>C: Zod parse body
C->>S: queueEmployeeExport
S->>DB: createExportJob QUEUED/PROCESSING
S-->>UI: 202 { job_id, status: QUEUED, estimated_completion_time }
Note over S,W: setImmediate — non-blocking
S->>W: exportEmployees(jobId, tenantId, filters)
W->>DB: SELECT rows (tenant scoped)
W->>F: generateCSV / generateExcel / generateJSON / generatePDF
F-->>W: /tmp/exports/{jobId}.{ext}
alt Cloudinary configured
  W->>CL: upload raw authenticated
  CL-->>W: publicId
  W->>DB: SUCCESS fileUrl=cloudinary://publicId
else Local only
  W->>DB: SUCCESS fileUrl=/export/{jobId}/download
end
UI->>R: GET /export/{job_id}/download
R->>C: downloadExport
alt SUCCESS + cloudinary://
  C-->>UI: 302 signed Cloudinary URL (300s)
else SUCCESS + disk
  C-->>UI: 200 file stream
else Not ready
  C-->>UI: 200 JSON status
end
```

#### 10.4.3 Format Decision Tree

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
START["generateExportFile(data, type, format, jobId)"] --> F{format?}
F -->|csv| CSV["generateCSV — flattenObject + escapeCSV + writeFileSync"]
F -->|excel| XLS["generateExcel — ExcelJS workbook styled header"]
F -->|json| JSON["generateJSON — JSON.stringify pretty"]
F -->|pdf| PDF["generatePDF — PDFKit landscape table"]
F -->|other| ERR["throw Unsupported format"]
CSV --> OUT["{jobId}.csv"]
XLS --> OUT2["{jobId}.xlsx"]
JSON --> OUT3["{jobId}.json"]
PDF --> OUT4["{jobId}.pdf"]
OUT --> PERSIST["persistSuccess → Cloudinary or disk URL"]
OUT2 --> PERSIST
OUT3 --> PERSIST
OUT4 --> PERSIST

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class START client
    class CSV,F,JSON,OUT2,OUT3,OUT4,PDF,PERSIST,XLS api
    class OUT db
    class ERR warn
```

#### 10.4.4 Per-Format Behavior

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">format</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">File</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">MIME</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Generation details</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>csv</code></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>{jobId}.csv</code></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>text/csv</code></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Flatten nested objects; RFC-style quoting for commas/quotes/newlines; empty file if zero rows</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>excel</code></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>{jobId}.xlsx</code></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OOXML spreadsheet</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Frozen header row; indigo <code>#4F46E5</code> header; alternating <code>#F0F0FF</code> rows; summary footer with record count</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>json</code></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>{jobId}.json</code></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>application/json</code></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Pretty-printed array of original (nested) row objects</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>pdf</code></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>{jobId}.pdf</code></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>application/pdf</code></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Landscape A4; title + timestamp; table up to 8 columns; note if more columns exist (use Excel/CSV for full width)</td></tr>
</tbody></table>

#### 10.4.5 API Surface

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Method</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Path</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Body highlights</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">HTTP</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>/api/v1/export/employees</code></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>format</code>: <code>csv</code> | <code>excel</code> | <code>json</code> | <code>pdf</code>; optional <code>department_id</code>, <code>status</code>, <code>include_archived</code></td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><strong>202</strong></td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/api/v1/export/attendance`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">requires `from_date`, `to_date` + `format`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**202**</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/api/v1/export/leave`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">requires `from_date`, `to_date` + `format`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**202**</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/api/v1/export/:job_id/download`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**200** stream / **302** signed URL / **200** status JSON</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/api/v1/export/list`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`?page&limit&status`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**200** (tenant-wide list today)</td></tr>
</tbody></table>

**202 response shape:**

```json
{
  "success": true,
  "data": {
    "job_id": "01a08046-e986-4a97-bbfe-68c3f042e8a3",
    "status": "QUEUED",
    "estimated_completion_time": 2
  }
}
```

#### 10.4.6 Live Examples (Hostinger)

Base: `https://ems-api.saqibsaeed.cloud/api/v1`  
Tenant: `x-tenant-key: acme-corp-001`  
Login: `hr@acme.test` / `Password123!`

**Step 1 — Login**

```bash
TOKEN=$(curl -s -X POST https://ems-api.saqibsaeed.cloud/api/v1/auth/login \
  -H 'content-type: application/json' \
  -H 'x-tenant-key: acme-corp-001' \
  -d '{"email":"hr@acme.test","password":"Password123!"}' \
  | python3 -c 'import sys,json; print((json.load(sys.stdin).get("data") or {}).get("accessToken") or "")')
echo "token_len=${#TOKEN}"
```

**Step 2a — Employees CSV**

```bash
JOB=$(curl -s -X POST https://ems-api.saqibsaeed.cloud/api/v1/export/employees \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"format":"csv"}')
echo "$JOB"
# → 202 { "data": { "job_id": "<uuid>", "status": "QUEUED", ... } }
```

**Step 2b — Employees Excel**

```bash
curl -s -X POST https://ems-api.saqibsaeed.cloud/api/v1/export/employees \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"format":"excel","status":"ACTIVE"}'
```

**Step 2c — Employees PDF**

```bash
curl -s -X POST https://ems-api.saqibsaeed.cloud/api/v1/export/employees \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"format":"pdf"}'
```

**Step 2d — Attendance JSON (date range required)**

```bash
curl -s -X POST https://ems-api.saqibsaeed.cloud/api/v1/export/attendance \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"format":"json","from_date":"2026-07-01","to_date":"2026-07-19"}'
```

**Step 2e — Leave Excel**

```bash
curl -s -X POST https://ems-api.saqibsaeed.cloud/api/v1/export/leave \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"format":"excel","from_date":"2026-06-01","to_date":"2026-07-19","status":"APPROVED"}'
```

**Step 3 — Poll / download**

```bash
JOB_ID="<paste-job_id>"
# Follow redirects (-L) for Cloudinary 302
curl -sL -o /tmp/ems-export.bin -w 'http=%{http_code} type=%{content_type}\n' \
  -H "Authorization: Bearer $TOKEN" \
  "https://ems-api.saqibsaeed.cloud/api/v1/export/${JOB_ID}/download"
file /tmp/ems-export.bin
```

**Step 4 — Permission deny (EMPLOYEE)**

```bash
EMP=$(curl -s -X POST https://ems-api.saqibsaeed.cloud/api/v1/auth/login \
  -H 'content-type: application/json' -H 'x-tenant-key: acme-corp-001' \
  -d '{"email":"priya@acme.test","password":"Password123!"}' \
  | python3 -c 'import sys,json; print((json.load(sys.stdin).get("data") or {}).get("accessToken") or "")')

curl -s -o /dev/null -w 'emp_export=%{http_code}\n' -X POST \
  https://ems-api.saqibsaeed.cloud/api/v1/export/employees \
  -H "Authorization: Bearer $EMP" -H 'content-type: application/json' \
  -d '{"format":"csv"}'
# Expected: emp_export=403
```

**Live proof (2026-07-19 via Vercel BFF):** HR `POST /api/export/employees` → **202 QUEUED**; Employee same call → **403 FORBIDDEN**.

#### 10.4.7 Source Map

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Layer</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">File</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Routes + auth</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/modules/export/export.routes.js`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Controller + download MIME / 302</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/modules/export/export.controller.js`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Queue + `setImmediate`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/modules/export/export.service.js`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Prisma queries + ExportJob</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/modules/export/export.repository.js`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">CSV / Excel / JSON / PDF writers + Cloudinary persist</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/jobs/exportJob.js`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Zod schemas</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/modules/export/export.validator.js`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Permission defaults</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`src/modules/auth/auth.policy.js`</td></tr>
</tbody></table>

#### 10.4.8 FE Contract (mandatory)

1. Stop client-side Blob CSV/Excel/PDF for operational exports.  
2. Call `POST /export/*` → keep `job_id` → open/poll `GET /export/:job_id/download`.  
3. Never use legacy `/files/:jobId`.  
4. Hide Export UI without `employees:export` from `/auth/me`.  
5. Details: `docs/UI_CONTRACT_server_exports_permissions_realtime_logs.md`.

---

### 10.5 July 2026 Hostinger Hardening — What Changed

<blockquote style="background:#fff3e0;border-left:4px solid #ef6c00;padding:12px 16px;margin:16px 0;">
<strong>Deployed:</strong> Hostinger Docker <code>ems-backend</code> git <code>68d32f4</code> (2026-07-19). Not Render.
</blockquote>

```mermaid
flowchart LR
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
A["① PDFKit + Cloudinary exports"] --> B["② permissions SoT + requirePermission"]
B --> C["③ SSE cookie/Bearer/token"]
C --> D["④ /ops/logs private HTML"]
D --> E["⑤ noEmployeeRecord empty reads"]
E --> F["⑥ Live Hostinger + Vercel E2E"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class C client
    class A,B,D,E,F api
```

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Change</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Before</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">After</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Export formats</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">csv / excel / json; disk-only URL</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">+ <strong>pdf</strong>; Cloudinary durable store; download may <strong>302</strong></td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Export auth</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Role HR_ADMIN only</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN + <code>employees:export</code></td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Permissions</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Empty JWT permissions broke FE gates</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>DEFAULT_PERMISSIONS_BY_ROLE</code> + <code>resolvePermissions</code> on login/refresh</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SSE</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Primarily <code>?token=</code></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>?token=</code> <strong>or</strong> Bearer <strong>or</strong> <code>accessToken</code> cookie</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Ops</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>GET /ops/logs</code> HTML + <code>GET /ops/process</code> (SUPER_ADMIN / OPS_LOGS_TOKEN)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Super Admin personal reads</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">400 <code>NO_EMPLOYEE_RECORD</code> → UI “Something went wrong”</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">200 empty + <code>noEmployeeRecord: true</code></td></tr>
</tbody></table>

**Handoff docs:** `docs/UI_TEAM_HANDOFF_HOSTINGER_HARDENING_2026-07-19.md`, `docs/BACKEND_CHANGELOG_hostinger_hardening_2026-07-19.md`, `docs/LIVE_UI_ROLE_MATRIX_VERCEL_2026-07-19.md`.

---

### 10.6 Render (Legacy Deployment)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Field</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Value</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Service</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`Employee-management-system`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">URL</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`https://employee-management-system-2b9q.onrender.com`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Database</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cross-account Render PostgreSQL (external URL)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Status</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Legacy — superseded by Hostinger for production traffic</td></tr>
</tbody></table>

### 10.7 Hostinger (Primary Production)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Field</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Value</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">API URL</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`https://ems-api.saqibsaeed.cloud`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">VPS Path</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/opt/ems/app`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Containers</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`ems-backend`, `ems-postgres`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Deploy trigger</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Push to `main` → GitHub Actions</td></tr>
</tbody></table>

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 11. Error Handling & Logging
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> All errors return a consistent JSON envelope via `errorResponse()`.<br><em>Pino logs every request; audit logs capture business mutations immutably.</em>
</blockquote>

### 11.1 Response Envelope

**Success:**
```json
{ "success": true, "data": {}, "meta": {} }
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable message",
    "details": {},
    "requestId": "req-uuid"
  }
}
```

### 11.2 Error Handler Pipeline

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
ERR[Thrown Error] --> CTP{FST_ERR_CTP<br/>body parse?}
    CTP -->|Yes| E400A[400 INVALID_REQUEST]
    CTP -->|No| AJV{FST_ERR_VALIDATION?}
    AJV -->|Yes| E422A[422 VALIDATION_ERROR<br/>details: field array]
    AJV -->|No| ZOD{ZodError?}
    ZOD -->|Yes| E422B[422 VALIDATION_ERROR]
    ZOD -->|No| APP{error.code set?}
    APP -->|Yes| ECUSTOM[error.statusCode<br/>default 500]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class AJV,APP,CTP,ECUSTOM,ZOD api
    class E400A,E422A,E422B,ERR warn
```

### 11.3 HTTP Status Contract

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Situation</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Status</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Success GET/PATCH/DELETE</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">200</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Success POST create</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">201</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MFA challenge / async</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">202</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Field validation</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">422</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Missing/invalid token</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">401</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Insufficient role</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">403</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Not found</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">404</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Conflict (duplicate, cycle)</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">409</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Bad request / missing tenant</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">400</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Server error</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">500</td></tr>
</tbody></table>

### 11.4 Structured Logging

- **Pino** logger with request ID correlation
- `requestLogging.js` hook logs method, URL, status, duration
- `LogEntry` model for persisted application logs (ERROR/WARN/INFO/DEBUG)
- `AuditLog` for immutable entity mutation tracking

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 12. Testing Strategy
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Unit, integration, and E2E tests guard regressions — integration tests use a local test DB only.<br><em>Never run `npm test` against production DATABASE_URL.</em>
</blockquote>

### 12.1 Test Pyramid

```mermaid
flowchart TB
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
subgraph E2E["E2E / Deployed UI Scripts"]
        P4[phase4E2EAudit.mjs]
        DEEP[deepE2EAudit.mjs]
        STRICT[strictButtonE2EAudit.mjs]
        PW[Playwright specs]
    end
    subgraph INT["Integration"]
        ROUTES[auth.routes.test.js<br/>attendance.routes.test.js<br/>...]
    end
    subgraph UNIT["Unit"]
        SVC[auth.service.test.js<br/>otp.service.test.js<br/>middleware.test.js]
    end

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class DEEP,E2E,INT,P4,PW,ROUTES,STRICT,SVC,UNIT api
```

### 12.2 Test Categories

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Category</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Location / Command</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Scope</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Smoke</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`npm run test:smoke`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">App bootstrap</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Unit</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`tests/unit/`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Service logic, utils, middleware</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Integration</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`tests/integration/`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Route-level with test DB</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Auth-specific</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`npm run test:auth-me`, `test:auth-logout`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Session edge cases</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Deployed UI</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`npm run test:deployed-ui:*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Live Hostinger UI clickthrough</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">E2E Deep</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`npm run test:e2e:deep:*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">API matrix + CRUD probes</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Phase 4</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`npm run test:e2e:phase4:*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Edge cases + exhaustive UI</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Playwright</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`npm run test:playwright:*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Browser automation</td></tr>
</tbody></table>

### 12.3 Test Database Safety

`cleanDatabase()` in `tests/helpers.js` is guarded:
- Requires `NODE_ENV=test`
- `DATABASE_URL` must target `localhost`, `127.0.0.1`, or DB name containing `ems_test`
- Prevents accidental production data wipe

### 12.4 CI Pipeline

```mermaid
flowchart LR
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
PUSH[Push / PR to main] --> LINT[ci.yml: Lint]
    LINT --> BUILD[ci.yml: Build Check<br/>prisma generate + app load]
    PUSH --> SEC[ci.yml: Security Audit<br/>npm audit]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class PUSH client
    class BUILD,LINT,SEC api
```

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 13. Deployment
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Primary production runs on Hostinger VPS (Docker + nginx); Render is a legacy target.<br><em>Deploys are automated via GitHub Actions with pre-deploy database backups.</em>
</blockquote>

### 13.1 Hostinger VPS Architecture

```mermaid
flowchart TB
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
subgraph Internet
        USER[Users / Frontend]
        GH[GitHub Actions]
    end

    subgraph VPS["Hostinger VPS (31.97.186.223)"]
        NGINX[nginx<br/>TLS :443<br/>ems-api.saqibsaeed.cloud]
        subgraph Docker
            BE[ems-backend container<br/>Node 20 + Fastify<br/>PM2 process manager]
            PG[(ems-postgres container<br/>PostgreSQL)]
        end
        BACKUP[/opt/ems/backups/<br/>pg_dump pre-deploy/]
    end

    USER --> NGINX --> BE
    BE --> PG
    GH -->|SSH deploy| VPS

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class USER client
    class BE,GH,NGINX,VPS api
    class BACKUP,PG db
```

### 13.2 ASCII — Hostinger Directory Layout

```
/opt/ems/
├── app/                  # Git clone (origin/main)
│   ├── Dockerfile        # Box-only (not in upstream)
│   ├── .env              # Production secrets (box-only)
│   └── docker-compose.yml
├── backups/              # Pre-deploy pg_dump archives (keep 14)
└── docker-compose.yml    # Orchestrates ems-backend + ems-postgres
```

### 13.3 CI/CD Pipeline (GitHub Actions → Hostinger)

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
A[Push to main] --> B[npm ci + lint]
    B --> C[prisma generate + app load verify]
    C --> D[SSH to Hostinger]
    D --> E[pg_dump backup]
    E --> F[git pull --ff-only]
    F --> G[docker compose build ems-backend]
    G --> H[docker compose up -d]
    H --> I[prisma migrate deploy]
    I --> J[Health check loop<br/>GET /health → 200]
    J -->|40 retries × 3s| K[Deploy success]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class C client
    class A,B,D,E,F,G,H,I,J,K api
```


### 13.6 Hostinger Deep Dive (Production)


> **What it does:** Primary production deployment on a shared Hostinger VPS running Docker + nginx.
>
> **Why it matters:** Most live traffic and the UI team's integration target.
>
> **How it works:** DNS → nginx TLS :443 → Docker ems-backend :4001 → Postgres + Redis on ems-net.


#### 13.6.1 Full VPS Architecture

```mermaid
flowchart TB
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
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

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class BE,DockerEMS,NGINX,PM2,RAPI,Rentocloud,VPS api
    class BACKUP,PG db
    class DEV,DNS,GHA,RD external
```

#### 13.6.2 Port Mapping

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Exposure</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Host</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Container</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Service</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Public 443</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">nginx</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">TLS + reverse proxy</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Loopback 4001</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">127.0.0.1</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ems-backend:3000</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Fastify API</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Loopback 5432</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">127.0.0.1</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ems-postgres:5432</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PostgreSQL</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Loopback 6379</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">127.0.0.1</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ems-redis:6379</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Redis (cache + BullMQ)</td></tr>
</tbody></table>

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
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
S1["① Push to main"] --> S2["② GitHub Actions: npm ci + lint"]
    S2 --> S3["③ prisma generate + app load verify"]
    S3 --> S4["④ SSH with HOSTINGER_SSH_KEY"]
    S4 --> S5["⑤ pg_dump → /opt/ems/backups/"]
    S5 --> S6["⑥ git -C /opt/ems/app pull --ff-only"]
    S6 --> S7["⑦ docker compose build ems-backend"]
    S7 --> S8["⑧ docker compose up -d ems-backend"]
    S8 --> S9["⑨ docker exec ems-backend npx prisma migrate deploy"]
    S9 --> S10["⑩ curl https://ems-api.../health × 40"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class S1 client
    class S2,S3,S4,S5,S6,S7,S8,S9 api
    class S10 external
```

#### 13.6.5 Environment Variables on VPS (categories)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Category</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Examples</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Notes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Core</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`NODE_ENV=production`, `PORT=3000`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Inside container</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Database</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`DATABASE_URL=postgresql://...@ems-postgres:5432/...`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Docker network hostname</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Redis</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`REDIS_URL=redis://redis:6379`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Enables BullMQ + cache</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JWT</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`JWT_SECRET`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Non-default required</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Email</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`RESEND_API_KEY`, `RESEND_FROM`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Live transactional email</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Storage</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`CLOUDINARY_*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Document uploads</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">CORS</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`CORS_ORIGIN`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Frontend origins</td></tr>
</tbody></table>

#### 13.6.6 Local Dev via SSH Tunnel

`scripts/startLocalHostingerStack.sh`:

1. Opens SSH tunnels `localhost:15432 → VPS:5432` and `localhost:16379 → VPS:6379`
2. Rewrites `DATABASE_URL` host to `127.0.0.1:15432`
3. Writes `/tmp/ems-tunnel.override.env`
4. Start: `node --env-file=.env --env-file=/tmp/ems-tunnel.override.env --watch src/server.js`

> **Never** run migrations, seeds, or tests against tunneled production DB.

#### 13.6.7 PM2 vs Docker — What Runs What

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Workload</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Runtime</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Notes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**EMS API**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Docker `ems-backend`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Built from `/opt/ems/app/Dockerfile`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**EMS Postgres**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Docker `ems-postgres`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Isolated volume</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**EMS Redis**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Docker `ems-redis`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll queue + hot config cache</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**rentocloud API**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PM2 on host</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Do not modify**</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**rentocloud frontend**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PM2 :3000</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Separate nginx vhosts</td></tr>
</tbody></table>

EMS and rentocloud share the **same VPS** but use **separate** process managers and nginx server blocks.

#### 13.6.8 SSL/TLS at nginx

- Certificate: Let's Encrypt (or Hostinger-managed) for `ems-api.saqibsaeed.cloud`
- Termination at nginx — backend sees HTTP on loopback
- `X-Forwarded-Proto: https` passed to Fastify

#### 13.6.9 Backup and Migration Strategy

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Step</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">When</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Command</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Pre-deploy backup</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Every GitHub deploy</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`docker exec ems-postgres pg_dump ... \</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">gzip`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Retention</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Automatic</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Keep newest 14 backups</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Migrate</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">After container up</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`docker exec ems-backend npx prisma migrate deploy`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Rollback</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Manual</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Restore `.sql.gz` + pin previous image</td></tr>
</tbody></table>

**Rule:** additive migrations only on production — never `migrate reset` or `db push --force-reset`.

#### 13.6.10 Shared VPS Warnings (rentocloud)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Do</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Don't</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Edit EMS nginx vhost only</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Restart rentocloud PM2 processes</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Use `docker compose` in `/opt/ems`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Change rentocloud nginx server blocks</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Deploy via GitHub Actions</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Run `pm2 delete all` on the box</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SSH key `hostinger_ems_ed25519`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Share production `.env` in git</td></tr>
</tbody></table>

### 13.7 Render vs Hostinger Comparison

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Dimension</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;"><span style="background:#9B59B6;color:#fff;padding:2px 8px;border-radius:4px">Render</span></th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;"><span style="background:#2ECC71;color:#fff;padding:2px 8px;border-radius:4px">Hostinger</span></th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Status**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Legacy / test target</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Primary production**</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**URL**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`employee-management-system-2b9q.onrender.com`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`ems-api.saqibsaeed.cloud`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Compute**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Render Web Service (managed)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Docker on VPS (self-managed)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Database**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Render PostgreSQL (cross-account external URL)</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`ems-postgres` container</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Redis**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Not on Render deploy</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`ems-redis` live — BullMQ + cache</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Deploy**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Render auto-deploy on push</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GitHub Actions → SSH</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**TLS**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Render-managed</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">nginx on VPS</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Cost model**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PaaS per-service</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">VPS flat (shared with rentocloud)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Cold start**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Yes (free tier spin-down)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">No — always on</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Connection pool**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`connection_limit=5` caused bell 500s</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Local pool in container</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Backups**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Render DB backups</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`pg_dump` pre-deploy + retention 14</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Local parity**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">External DATABASE_URL only</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SSH tunnel script available</td></tr>
</tbody></table>

\newpage

### 13.4 Render (Legacy)

- Auto-deploy from GitHub on push (Render Web Service)
- Uses external PostgreSQL URL (cross-account)
- Still available as fallback; production frontend points to Hostinger

### 13.5 Local Development

```bash
docker compose up -d          # Local Postgres on :5432
npm run dev                   # Fastify with --watch
npx prisma migrate deploy     # Apply migrations
npm run db:seed               # Idempotent seed
```

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 14. Security Considerations
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Defense in depth: Argon2id passwords, JWT rotation, rate limits, helmet headers, tenant isolation.<br><em>Review this before exposing new endpoints or changing auth flows.</em>
</blockquote>

### 14.1 Authentication Security

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Control</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Implementation</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Password hashing</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Argon2id (memory-hard)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JWT secret</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Fail-closed in production if default</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Refresh rotation</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Hash stored; family-ID reuse detection revokes all sessions</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Session validation</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Every request checks `Session.revokedAt`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cookie flags</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">httpOnly, secure (production), SameSite</td></tr>
</tbody></table>

### 14.2 Multi-Tenant Security

- All queries scoped by `tenantId` from resolved tenant (never from client body alone)
- JWT `tenantId` cross-checked against `request.tenant.id` in authenticate()
- Subdomain slug validation rejects `www`, `api`, `app`

### 14.3 Input Validation

- Zod schemas in services for business validation
- Fastify JSON Schema for route-level validation (422 responses)
- Tolerant JSON parser for empty-body POSTs (frontend axios compatibility)
- 10 MB multipart file size limit

### 14.4 HTTP Security Headers

- `@fastify/helmet` — CSP, X-Frame-Options, etc.
- `@fastify/rate-limit` — global rate limiting
- CORS restricted to configured origins

### 14.5 Data Protection

- Soft delete on Employee (`deletedAt`) — no hard delete by default
- Audit logs immutable (append-only)
- Password reset tokens hashed (SHA-256) with TTL
- OTP challenges rate-limited with attempt caps

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 15. Known Issues (E2E Audits)
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Documented gaps found by automated UI/API audits — not blockers but tracked honestly.<br><em>Check here before assuming a wireframe feature is fully implemented.</em>
</blockquote>

A comprehensive E2E audit was conducted in July 2026. Full details: `docs/E2E_BACKEND_ISSUES.md`.

### Summary (28 documented issues)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">ID</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Severity</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Issue</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Root Cause</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">1</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">P1</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SUPER_ADMIN attendance returns `NO_EMPLOYEE_RECORD`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Admin user has no linked Employee record</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">2</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">P2</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">SUPER_ADMIN payout-methods 400</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Same — `/me/*` requires employeeId</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">3</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">P1</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">KWD tenant timesheets — salary 404</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Missing salary config for admin employee</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">4</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">P2</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Storage integration `provider: undefined`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Response shape mismatch with frontend</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">KWD tenant no StatutoryPack</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Data gap — blocks payroll for KW country</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MFA blocker (resolved)</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Test users had mfaEnabled; disabled on Hostinger</td></tr>
</tbody></table>

### Recommendations

1. Add employee record for SUPER_ADMIN or return admin-scoped fallback on attendance endpoints
2. Seed salary + statutory pack for `kwd-litmus-001` tenant
3. Align `GET /settings/integrations/storage` response with frontend contract
4. Continue phase4 E2E scripts on every release (`npm run test:e2e:phase4`)

---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 16. API Reference Overview
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Canonical contract lives in Swagger (`/docs`) and `docs/API_MAPPING.md`.<br><em>This section summarizes route groups; use API_MAPPING for field-level shapes.</em>
</blockquote>

### 16.1 Interactive Documentation

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Resource</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">URL</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Swagger UI</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`https://ems-api.saqibsaeed.cloud/docs`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OpenAPI JSON</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`https://ems-api.saqibsaeed.cloud/docs/json`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">API Mapping (canonical)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`docs/API_MAPPING.md` in repository</td></tr>
</tbody></table>

### 16.2 Response Envelope (All Endpoints)

All endpoints return the standard envelope documented in `docs/API_MAPPING.md`. Date format: **`YYYY-MM-DD`** for all input fields (except `holidayDate` which rejects full ISO).

### 16.3 Quick Test

```bash
curl -X POST https://ems-api.saqibsaeed.cloud/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Key: acme-corp-001" \
  -d '{"email":"hr@acme.test","password":"Password123!"}'
```

### 16.4 Auth Headers After Login

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Context</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Headers</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Browser</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cookies auto-send (`accessToken`, `ems_session`)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Swagger/Postman</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`Authorization: Bearer <accessToken>`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Tenant (first login)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`X-Tenant-Key: acme-corp-001` (optional after JWT issued)</td></tr>
</tbody></table>

---



<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 17. End-to-End Workflow Diagrams
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Visual walkthroughs of major business flows with numbered steps.<br><em>Blue = client, green = API, orange = database, purple = external services.</em>
</blockquote>

This section documents every major business flow with numbered steps and color-coded layers (blue = client, green = API, orange = database, purple = external).

### 17.1 Payroll Engine — Gross → Deductions → Statutory → Net


> **What it does:** Computes one payslip per employee for a payroll run period.
>
> **Why it matters:** Payroll is the highest-risk domain — errors affect real money.
>
> **How it works:** `payroll.repository.calculatePayrollRun` orchestrates components, statutory pack, tax, loans, net.


```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
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

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class C1 client
    class A1,A10,A2,A3,A4,A5,A6,A7,A8,A9,API,Client,Ext api
    class D1,D2,D3,DB db
    class E1 external
```

### 17.2 India Statutory — PF / ESI / PT / TDS

```mermaid
flowchart LR
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
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

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class P1,S1,T1 client
    class N1,P2,P3,PF,S2,Step1,Step2,Step3,Step4,Step5,Step6,TD1,TD2,TD3 api
    class E1 external
```

> All India rules live in **StatutoryPack** JSON — not hardcoded `if (country === 'IN')` in the calculation loop.

### 17.3 KWD Work Week + Currency Flow

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
T1["Tenant kwd-litmus-001"] --> TC["TenantConfig.workWeekDays SUN-THU"]
    TC --> ATT["Attendance calendar: Sun-Thu workdays"]
    TC --> TS["Timesheet weekStartDay = 0 Sunday"]
    TC --> PAY["Payroll currency = KWD"]
    PAY --> MU["minorUnitFactor KWD = 1000 fils 3 decimal places"]
    MU --> PACK["StatutoryPack country=KW tenant-seeded"]
    PACK --> CALC["Same engine as IN — data-driven schemes"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class T1 client
    class ATT,CALC,MU,PACK,PAY,TC,TS api
```

### 17.4 Leave Balance Accrual + Approval

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
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

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class R1 client
    class AC1,AC2,AC3,AP1,Accrual,Approval,R2,R3,Request api
    class AC4,AP2 db
    class AP3 external
```

### 17.5 Attendance Check-In/Out + Regularization

```mermaid
sequenceDiagram
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2', 'actorBkg': '#e8f5e9', 'actorTextColor': '#1b5e20', 'actorLineColor': '#2e7d32', 'actorBorder': '#2e7d32', 'signalColor': '#1976d2', 'signalTextColor': '#0d47a1', 'noteBkgColor': '#fff3e0', 'noteTextColor': '#e65100'}}}%%
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
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e8f5e9', 'primaryTextColor': '#1b5e20', 'lineColor': '#1976d2'}}}%%
[*] --> DRAFT: Week created
    DRAFT --> SUBMITTED: Employee submit
    SUBMITTED --> APPROVED: Manager approve
    SUBMITTED --> REJECTED: Manager reject
    REJECTED --> DRAFT: Resubmit
    SUBMITTED --> DRAFT: Employee recall
```

**Period locks** (HR): `POST /timesheets/locks` stores date ranges in tenant settings blob — blocks edits across those calendar dates.

### 17.7 Employee Soft Delete Cascade

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
DEL["DELETE /employees/:id"] --> AUTH{HR_ADMIN or SUPER_ADMIN?}
    AUTH -->|No| F403[403]
    AUTH -->|Yes| CHECK{Direct reports or dept head?}
    CHECK -->|Yes| F409[409 — reassign first]
    CHECK -->|No| SOFT["Set deletedAt + employmentStatus=TERMINATED"]
    SOFT --> USER["User.status may remain — login blocked by policy"]
    SOFT --> HIST["Historical payslips/attendance retained"]
    SOFT --> AUDIT["recordAuditLog EMPLOYEE_TERMINATED"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class DEL,USER client
    class AUTH,CHECK,SOFT api
    class AUDIT,HIST db
    class F403,F409 warn
```

### 17.8 Department Hierarchy Tree Resolution

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
Q["Query all departments tenantId"] --> MAP["buildDepartmentChildrenMap parentId → children"]
    MAP --> DESC["getDescendantDepartmentIds BFS"]
    MAP --> ROLL["buildRollupEmployeeCounts DFS"]
    DESC --> FILTER["Analytics/reports filter by subtree"]
    ROLL --> UI["Headcount includes nested depts"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class Q client
    class DESC,FILTER,MAP,ROLL,UI api
```

### 17.9 Export Job Lifecycle (CSV / Excel / JSON / PDF)

> Full narrative + live curls: [§10.4](#104-server-side-dynamic-export-generation-csv--excel--json--pdf).

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
P1["① POST /export/* format=csv|excel|json|pdf"] --> P2["② Zod + HR_ADMIN + employees:export"]
P2 --> P3["③ createExportJob + 202 job_id"]
P3 --> P4["④ setImmediate worker"]
P4 --> P5["⑤ Prisma tenant-scoped rows"]
P5 --> P6{"⑥ format?"}
P6 -->|csv| C1["escapeCSV writeFile"]
P6 -->|excel| C2["ExcelJS styled XLSX"]
P6 -->|json| C3["JSON.stringify"]
P6 -->|pdf| C4["PDFKit landscape table"]
C1 --> P7["⑦ /tmp/exports/{jobId}.ext"]
C2 --> P7
C3 --> P7
C4 --> P7
P7 --> P8{"⑧ Cloudinary?"}
P8 -->|yes| P9["upload raw → cloudinary://publicId"]
P8 -->|no| P10["fileUrl = /export/jobId/download"]
P9 --> P11["⑨ SUCCESS"]
P10 --> P11
P11 --> P12["⑩ GET download → 200 stream or 302 signed"]
P4 -->|Error| F1["FAILED + error message"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class C1,P1 client
    class C2,C3,C4,P10,P11,P12,P2,P3,P4,P5,P6,P7,P8,P9 api
    class F1 warn
```

### 17.10 Email Flow — Resend (Password Reset + OTP)

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
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

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class T1,T2,T3 client
    class A1,J1,J2 api
    class J3,J4 external
```

### 17.11 Session Family ID Reuse Detection

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
R1["POST /auth/refresh with ems_session cookie"] --> H1["Hash cookie → lookup Session"]
    H1 --> M1{Hash matches active session?}
    M1 -->|Yes| ROT["Rotate refresh token same familyId"]
    M1 -->|No| M2{familyId seen but hash stale?}
    M2 -->|Yes| REV["revokeSessionFamily TOKEN_REUSE_DETECTED"]
    REV --> E401["401 — all sessions in family dead"]
    M2 -->|No| E401B["401 invalid session"]
    ROT --> OK["New accessToken + cookies"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class R1 client
    class H1,M1,M2,OK,ROT api
    class E401,E401B,REV warn
```

### 17.12 Rate Limiting Flow

```mermaid
flowchart LR
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
REQ[Request] --> RL["@fastify/rate-limit global 100/15min"]
    RL --> OK{Under limit?}
    OK -->|Yes| NEXT[Continue pipeline]
    OK -->|No| 429[429 Too Many Requests]
    NEXT --> ROUTE{Per-route limits?}
    ROUTE -->|forgot-password| R5["5 per 15 min"]
    ROUTE -->|verify-otp| R5b["5 per 5 min"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class REQ client
    class NEXT,OK,R5,R5b,RL,ROUTE api
    class 429 warn
```

### 17.13 CORS + Helmet Middleware Chain

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
IN[Incoming request] --> RID[requestId]
    RID --> COOKIE[cookie parser]
    COOKIE --> PRISMA[prisma decorator]
    PRISMA --> CORS["cors: CORS_ORIGIN + credentials"]
    CORS --> HELMET["helmet CSP disabled for Swagger"]
    HELMET --> RATE[rateLimit 100/15m]
    RATE --> MULTI[multipart 10MB]
    MULTI --> LOG[requestLogging hook]
    LOG --> RT[resolveTenant on /api/v1]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class IN client
    class COOKIE,CORS,HELMET,LOG,MULTI,RATE,RID,RT api
    class PRISMA db
```

### 17.14 Swagger Registration Order

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
S1["① Register all route modules under /api/v1"] --> S2["② Register /health /healthz"]
    S2 --> S3["③ swaggerPlugin LAST"]
    S3 --> S4["OpenAPI spec includes all routes"]
    S4 --> S5["/docs UI serves live contract"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class S1 client
    class S2,S3,S4,S5 api
```

### 17.15 Prisma Transaction Patterns

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
USE{Need atomic multi-table write?}
    USE -->|Yes| TX["prisma transaction async callback"]
    USE -->|No| SINGLE["Single prisma.model.create/update"]
    TX --> EX1["Auth: session + audit log"]
    TX --> EX2["Payroll: payslips + run status"]
    TX --> EX3["Leave: ledger txn + balance"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class USE client
    class EX1,EX2,EX3,SINGLE,TX api
```

### 17.16 Audit Log Write on Mutation

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
MUT[Service mutation] --> REC{Module pattern}
    REC -->|Central| RA["recordAuditLog() auditLogs.service"]
    REC -->|Auth| AR["authRepository.createAuditLog"]
    REC -->|Inline| PR["prisma.auditLog.create in tx"]
    RA --> DB[(AuditLog append-only)]
    AR --> DB
    PR --> DB

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class MUT client
    class AR,PR,RA,REC api
    class DB db
```

### 17.17 Search Multi-Entity Flow

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
Q["GET /search?q=term"] --> PAR["Parse types filter default all 4"]
    PAR --> E1["Parallel: employees ILIKE"]
    PAR --> E2["departments ILIKE"]
    PAR --> E3["leave requests ILIKE"]
    PAR --> E4["holidays ILIKE"]
    E1 --> ROLE{Role filter employee scope}
    ROLE --> MERGE["Merge results slice to limit"]
    MERGE --> OUT["groupedCounts + results[]"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class Q client
    class E2,E3,MERGE,PAR,ROLE,results api
    class OUT db
    class E1 external
    class E4 warn
```

### 17.18 Report Scheduling (CRUD — cron execution)

```mermaid
flowchart TD
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'}}}%%
HR["POST /reports/schedule"] --> SR["ScheduledReport row in DB"]
    SR --> NOTE["⚠ No in-process cron worker yet"]
    NOTE --> FUTURE["Future: BullMQ repeatable job reads schedule"]
    SR --> LIST["GET /reports/scheduled paginated"]
    LIST --> PATCH["PATCH /reports/scheduled/:id"]
    PATCH --> SOFT["Soft-disable via isActive flag"]

classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c
    class HR client
    class LIST,PATCH,SOFT api
    class SR db
    class FUTURE,NOTE external
```

\newpage


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 18. Utilities Reference (`src/utils/`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">File</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Purpose</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`hash.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Argon2id password hash + SHA-256 for reset tokens</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`token.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JWT access token creation via `jose`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`response.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`successResponse()` / `errorResponse()` envelope</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`id.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">UUID v4 `generateId()`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`logger.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Shared Pino logger instance</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`otp.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OTP code generation + masking</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`pagination.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Offset pagination helpers</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`money.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Currency-safe decimal formatting</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`statutoryCalculation.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PF/ESI/tax slab engine</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`statutoryPackShape.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Pack DTO normalization</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`payrollPeriod.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Pay period date math</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`payFrequency.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MONTHLY/SEMI_MONTHLY cycle counts</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`payCalendarShape.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Pay calendar DTO helpers</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`payrollComponentShape.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Salary component shapes</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`payrollUiShapes.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">UI-facing payroll DTOs</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`formulaEval.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Safe formula evaluation for `% of basis`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`workingDays.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Working day counts with holidays</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`departmentTree.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">BFS descendants + rollup headcount</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`cloudinary.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Upload stream + WebP pipeline</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`sseClients.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">In-memory SSE client map per userId</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`notifier.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Create in-app Notification rows</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`cycleGenerator.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Pay cycle date generation</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`icsParser.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ICS calendar import for holidays</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`importJobStore.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">In-memory import job status</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`refNo.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Sequential reference numbers</td></tr>
</tbody></table>


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 19. Middleware & Plugins Reference
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Fastify hooks and plugins run in a fixed order before your route handler.<br><em>Changing plugin order can break auth, tenant resolution, or Swagger registration.</em>
</blockquote>

### Middleware (`src/middleware/`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">File</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Hook</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Responsibility</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`resolveTenant.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`onRequest` (global under `/api/v1`)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">4-layer tenant resolution</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`authenticate.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">route `onRequest`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">JWT verify + session revocation check</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`authenticate.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`authorize(roles)`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Role gate; SUPER_ADMIN bypass</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`errorHandler.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`setErrorHandler`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Maps errors → JSON envelope</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`requestLogging.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`onResponse`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Pino request/response log line</td></tr>
</tbody></table>

### Plugins (`src/plugins/`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">File</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Order</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Responsibility</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`requestId.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">1</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`X-Request-Id` correlation</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`prisma.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">3</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`fastify.prisma` decorator</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`cors.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">4</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Origin allowlist + credentials</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`helmet.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">5</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Security headers (CSP off for /docs)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`rateLimit.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">6</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">100 req / 15 min global</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`swagger.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**last**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OpenAPI + `/docs` UI</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`redis.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">legacy stub</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Returns null — use `src/lib/redis.js`</td></tr>
</tbody></table>

### Jobs (`src/jobs/` + `src/lib/`)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">File</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Role</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`emailJob.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Resend HTTP + SMTP fallback; password reset, OTP, invites</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;"><code>exportJob.js</code></td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ExcelJS + PDFKit export worker (CSV/Excel/JSON/PDF via sync <code>setImmediate</code>)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`lib/payrollQueue.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">BullMQ `payroll-calculate` queue + in-process worker</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`lib/redis.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ioredis client; cache get/set; no-op without REDIS_URL</td></tr>
</tbody></table>

<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## Appendix A — Glossary (Expanded)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Term</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Definition</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**tenant**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">One customer organization; all rows scoped by `tenantId`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**tenantKey**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Stable string for `X-Tenant-Key` header (e.g. `acme-corp-001`)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**slug**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Subdomain identifier (`acme` from `acme.yourems.com`)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**memberType**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Role enum: SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE, AUDITOR</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**statutory pack**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Versioned JSON config for country tax/contribution rules</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**pay group**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Set of employees sharing salary components and pay calendar</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**payroll run**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Batch calculation for one pay period (DRAFT→CALCULATING→REVIEW→APPROVED→PAID)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**payslip**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Per-employee result of a payroll run</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**legal entity**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Company registration unit linked to a statutory pack</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**leave ledger**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Append-only transactions for leave balance (accrual, debit, encashment)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**comp-off**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Compensatory off — extra leave earned for working on holiday/weekend</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**regularization**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Employee request to fix missed/wrong attendance punch</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**period lock**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR-defined date range where timesheets cannot be edited</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**session family**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Group of rotated refresh tokens; reuse detection revokes entire family</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**soft delete**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`deletedAt` timestamp — row retained for audit/history</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**export job**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Async (inline) CSV/XLSX generation with `ExportJob` status tracking</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**BullMQ**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Redis-backed job queue used for payroll CALCULATING on Hostinger</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**minor units**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Integer storage for money (INR×100, KWD×1000, JPY×1)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**work week**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">TenantConfig array of workdays (e.g. SUN–THU for Kuwait)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**rentocloud**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Co-tenant on same VPS — must not be disrupted by EMS ops</td></tr>
</tbody></table>




<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## Appendix B — Document Revision History

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Date</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Version</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Changes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">July 2026</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">1.0</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Initial comprehensive technical documentation</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">July 2026</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**2.0**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Expanded workflows, Hostinger deep dive, colored diagrams, Quick Start, full utils/middleware reference, 18+ new flowcharts</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">July 2026</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**3.0**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PDF blank-page fixes, all diagrams pre-rendered in color, section callouts, appendix reorder, HTML tables</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">2026-07-19</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**3.1**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Dynamic export chapter (CSV/Excel/JSON/PDF + libraries + live curls); Hostinger hardening 68d32f4; PDFKit; Cloudinary export storage; noEmployeeRecord; permissions SoT; ops logs</td></tr>
</tbody></table>




<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## Appendix C — Complete API Route Index

Full route list registered in `src/app.js` under `/api/v1`. See `docs/API_MAPPING.md` for request/response shapes.

### Auth & Identity

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Method</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Path</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Auth</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Roles</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/login`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">any</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/admin/login`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/refresh`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">cookie</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">any</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/logout`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Bearer</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">any</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/logout-all`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Bearer</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">any</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/me`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Bearer</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">any</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/sessions`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Bearer</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">any</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">DELETE</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/sessions/:sessionId`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Bearer</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">any</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/forgot-password`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">rate-limited</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/reset-password`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">rate-limited</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/validate-reset-token`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">any</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/verify-otp`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">rate-limited</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/resend-otp`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">rate-limited</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/register`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">creates tenant</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/auth/invitation/resend`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">public generic 200</td></tr>
</tbody></table>

### Employees & Departments

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Method</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Path</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Notes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/employees`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">CRUD; soft delete</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/PATCH/DELETE</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/employees/:id`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`?includeTerminated=true` HR only</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/employees/:id/documents`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">multipart → Cloudinary WebP</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/employees/:id/photo`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">profile photo WebP</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/employees/export/csv`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/POST/PATCH/DELETE</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/departments`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">hierarchy tree</td></tr>
</tbody></table>

### Attendance & Leave

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Method</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Path</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Notes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/attendance/check-in`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">workMode, geo</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/attendance/check-out`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">duration calc</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/attendance/records`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`?month=YYYY-MM`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/attendance/team/records`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MANAGER+</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/attendance/regularization`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">correction request</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PATCH</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/attendance/regularization/:id/approve`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">MANAGER+</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/leave/requests`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">approval workflow</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/leave/balance`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">own balances</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/leave-engine/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">policies, ledger</td></tr>
</tbody></table>

### Timesheets & Payroll

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Method</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Path</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Notes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/timesheets`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">weekly sheets</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/timesheets/:id/submit`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">DRAFT→SUBMITTED</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PATCH</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/timesheets/:id/approve`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">manager</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/POST/DELETE</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/timesheets/locks`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">period locks HR</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/payroll/runs`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">payroll batches</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/payroll/runs/:id/calculate`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">BullMQ async on Hostinger</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/payroll/runs/:id/payslips`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">per-employee slips</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/payroll/me/payout-methods`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">bank details</td></tr>
</tbody></table>

### Platform & Admin

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Method</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Path</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Notes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/analytics/*`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR dashboards</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/POST</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/reports/*`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">reports + schedule CRUD</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/export/employees`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">async job csv|excel|json|pdf + Cloudinary</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/audit-logs`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">immutable audit</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/notifications`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">+ SSE `/notifications/stream`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/search?q=`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">multi-entity search</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET/PATCH</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/settings/tenant`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">tenant config</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/manager/dashboard`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">manager home</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/employee/dashboard`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">employee home</td></tr>
</tbody></table>

### Health & Docs (outside prefix)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Method</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Path</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Response</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/health`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`{status:"ok"}`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/healthz`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`{status:"ok"}`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/docs`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Swagger UI</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">GET</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/docs/json`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">OpenAPI JSON</td></tr>
</tbody></table>

\newpage




<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## Appendix D — Developer Troubleshooting

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Symptom</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Likely cause</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Fix</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`400 MISSING_TENANT`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">No tenant resolved</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Send `X-Tenant-Key` or login first</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`401 TOKEN_REUSE_DETECTED`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Old refresh cookie replayed</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Re-login; family revoked</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`403 FORBIDDEN`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Wrong `memberType`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Check `authorize()` roles on route</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`422 VALIDATION_ERROR`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Zod / JSON schema</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">See `details[]` in error envelope</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`503 STORAGE_NOT_CONFIGURED`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Missing Cloudinary env</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Set `CLOUDINARY_*` vars</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Empty `{}` in API response</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">fast-json-stringify schema</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Add `additionalProperties: true`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Payroll stuck CALCULATING</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Redis/BullMQ down</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Check `ems-redis`; falls back sync</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`WEEK_LOCKED` on timesheet</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Status SUBMITTED/APPROVED</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Recall or manager reject first</td></tr>
</tbody></table>

### Useful Commands

```bash
npm run dev                    # local API with watch
npm run test:smoke             # app boots
npm run test:integration       # route tests (test DB only)
npm run lint                   # ESLint
npx prisma studio              # DB GUI
graphify query "auth refresh"  # codebase graph search
```

---

*End of Document — v3.0*

