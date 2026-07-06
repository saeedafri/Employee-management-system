---
title: "EMS Backend — Technical Documentation"
subtitle: "Employee Management System REST API"
version: "July 2026 v3.0"
author: "EMS Engineering"
---




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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**Authorization**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Role-based via `memberType` enum; `SUPER_ADMIN` bypasses all role checks</td></tr>
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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 2. System Architecture Overview
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Every request flows through nginx → Fastify middleware → domain modules → Prisma → PostgreSQL.<br><em>Understand the layers before diving into individual modules or auth rules.</em>
</blockquote>

### 2.1 High-Level Architecture


<figure class="diagram">
<img src=".pdf-assets/diagram-1.png" alt="Diagram 1" />
</figure>


### 2.2 Request Lifecycle

Every HTTP request passes through a deterministic pipeline before reaching domain logic.


<figure class="diagram">
<img src=".pdf-assets/diagram-2.png" alt="Diagram 2" />
</figure>


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 2.5 Middleware Decision Tree — Which Middleware Runs When?


> **What it does:** Shows exactly which hooks fire for public vs protected routes.
>
> **Why it matters:** Misunderstanding middleware order causes auth bugs and missing tenant context.
>
> **How it works:** Follow the tree from HTTP method + path to the final handler.



<figure class="diagram">
<img src=".pdf-assets/diagram-3.png" alt="Diagram 3" />
</figure>


### Tenant-Optional vs Protected Routes

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Route pattern</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">resolveTenant</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">authenticate</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">authorize</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /auth/login`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">optional (email resolves)</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /health`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">— (outside prefix)</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /employees`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">required</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">yes</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">—</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`POST /employees`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">required</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">yes</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`GET /analytics/summary`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">required</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">yes</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">HR_ADMIN, SUPER_ADMIN</td></tr>
</tbody></table>



---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Export</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ExcelJS</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Styled XLSX exports</td></tr>
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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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


<figure class="diagram">
<img src=".pdf-assets/diagram-4.png" alt="Diagram 4" />
</figure>


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 5. Multi-Tenancy Deep Dive
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Every database row belongs to exactly one tenant — isolation is enforced at query time.<br><em>Tenant resolution runs before protected handlers; never query without `tenantId`.</em>
</blockquote>

EMS uses a **shared-database, shared-schema** multi-tenant model. Every table includes a `tenantId` foreign key. Data isolation is enforced at the application layer via Prisma `where` clauses.

### 5.1 Four-Layer Tenant Resolution Chain


<figure class="diagram">
<img src=".pdf-assets/diagram-5.png" alt="Diagram 5" />
</figure>


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 6. Authentication & Authorization
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Short-lived JWT access tokens plus rotating httpOnly refresh cookies secure sessions.<br><em>Roles (`memberType`) gate endpoints; SUPER_ADMIN bypasses all role checks.</em>
</blockquote>

### 6.1 Auth Flow Overview


<figure class="diagram">
<img src=".pdf-assets/diagram-6.png" alt="Diagram 6" />
</figure>


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


<figure class="diagram">
<img src=".pdf-assets/diagram-7.png" alt="Diagram 7" />
</figure>


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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
- **Export:** async job queue (synchronous processing) — CSV/Excel/JSON for employees, attendance, leave

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


<figure class="diagram">
<img src=".pdf-assets/diagram-8.png" alt="Diagram 8" />
</figure>


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



---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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


<figure class="diagram">
<img src=".pdf-assets/diagram-9.png" alt="Diagram 9" />
</figure>


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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


<figure class="diagram">
<img src=".pdf-assets/diagram-10.png" alt="Diagram 10" />
</figure>


### 9.4 Statutory Pack Resolution


<figure class="diagram">
<img src=".pdf-assets/diagram-11.png" alt="Diagram 11" />
</figure>


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 10. External Integrations
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Email (Resend), file storage (Cloudinary), and optional Redis (BullMQ) live outside the monolith.<br><em>Each integration degrades gracefully when env vars are missing.</em>
</blockquote>

### 10.1 Resend (Email)


<figure class="diagram">
<img src=".pdf-assets/diagram-12.png" alt="Diagram 12" />
</figure>


- Primary provider for OTP, password reset, employee invitations
- Fallback: SMTP (Brevo) configurable via env vars
- Rate limits on forgot-password and OTP endpoints

### 10.2 Cloudinary (File Upload)


<figure class="diagram">
<img src=".pdf-assets/diagram-13.png" alt="Diagram 13" />
</figure>


**Upload targets:**
- Employee documents (`POST /employees/:id/documents`)
- Employee photos (`POST /employees/:id/photo`) — always WebP
- Tenant logo (`PATCH /settings/tenant` with logo file)

### 10.3 Notifications SSE Stream


<figure class="diagram">
<img src=".pdf-assets/diagram-14.png" alt="Diagram 14" />
</figure>


- Polling fallback: `GET /notifications?since=ISO`
- Unread badge: `GET /notifications/unread-count`
- Mark read: `PATCH /notifications/:id/read` (POST alias supported)

### 10.4 Render (Legacy Deployment)

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Field</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Value</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Service</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`Employee-management-system`</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">URL</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`https://employee-management-system-2b9q.onrender.com`</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Database</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Cross-account Render PostgreSQL (external URL)</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Status</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Legacy — superseded by Hostinger for production traffic</td></tr>
</tbody></table>

### 10.5 Hostinger (Primary Production)

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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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


<figure class="diagram">
<img src=".pdf-assets/diagram-15.png" alt="Diagram 15" />
</figure>


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 12. Testing Strategy
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Unit, integration, and E2E tests guard regressions — integration tests use a local test DB only.<br><em>Never run `npm test` against production DATABASE_URL.</em>
</blockquote>

### 12.1 Test Pyramid


<figure class="diagram">
<img src=".pdf-assets/diagram-16.png" alt="Diagram 16" />
</figure>


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


<figure class="diagram">
<img src=".pdf-assets/diagram-17.png" alt="Diagram 17" />
</figure>


---


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## 13. Deployment
<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Primary production runs on Hostinger VPS (Docker + nginx); Render is a legacy target.<br><em>Deploys are automated via GitHub Actions with pre-deploy database backups.</em>
</blockquote>

### 13.1 Hostinger VPS Architecture


<figure class="diagram">
<img src=".pdf-assets/diagram-18.png" alt="Diagram 18" />
</figure>


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


<figure class="diagram">
<img src=".pdf-assets/diagram-19.png" alt="Diagram 19" />
</figure>



### 13.6 Hostinger Deep Dive (Production)


> **What it does:** Primary production deployment on a shared Hostinger VPS running Docker + nginx.
>
> **Why it matters:** Most live traffic and the UI team's integration target.
>
> **How it works:** DNS → nginx TLS :443 → Docker ems-backend :4001 → Postgres + Redis on ems-net.


#### 13.6.1 Full VPS Architecture


<figure class="diagram">
<img src=".pdf-assets/diagram-20.png" alt="Diagram 20" />
</figure>


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


<figure class="diagram">
<img src=".pdf-assets/diagram-21.png" alt="Diagram 21" />
</figure>


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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



<figure class="diagram">
<img src=".pdf-assets/diagram-22.png" alt="Diagram 22" />
</figure>


### 17.2 India Statutory — PF / ESI / PT / TDS


<figure class="diagram">
<img src=".pdf-assets/diagram-23.png" alt="Diagram 23" />
</figure>


> All India rules live in **StatutoryPack** JSON — not hardcoded `if (country === 'IN')` in the calculation loop.

### 17.3 KWD Work Week + Currency Flow


<figure class="diagram">
<img src=".pdf-assets/diagram-24.png" alt="Diagram 24" />
</figure>


### 17.4 Leave Balance Accrual + Approval


<figure class="diagram">
<img src=".pdf-assets/diagram-25.png" alt="Diagram 25" />
</figure>


### 17.5 Attendance Check-In/Out + Regularization


<figure class="diagram">
<img src=".pdf-assets/diagram-26.png" alt="Diagram 26" />
</figure>


### 17.6 Timesheet Lock / Unlock / Submit


<figure class="diagram">
<img src=".pdf-assets/diagram-27.png" alt="Diagram 27" />
</figure>


**Period locks** (HR): `POST /timesheets/locks` stores date ranges in tenant settings blob — blocks edits across those calendar dates.

### 17.7 Employee Soft Delete Cascade


<figure class="diagram">
<img src=".pdf-assets/diagram-28.png" alt="Diagram 28" />
</figure>


### 17.8 Department Hierarchy Tree Resolution


<figure class="diagram">
<img src=".pdf-assets/diagram-29.png" alt="Diagram 29" />
</figure>


### 17.9 Export Job Lifecycle (ExcelJS)


<figure class="diagram">
<img src=".pdf-assets/diagram-30.png" alt="Diagram 30" />
</figure>


### 17.10 Email Flow — Resend (Password Reset + OTP)


<figure class="diagram">
<img src=".pdf-assets/diagram-31.png" alt="Diagram 31" />
</figure>


### 17.11 Session Family ID Reuse Detection


<figure class="diagram">
<img src=".pdf-assets/diagram-32.png" alt="Diagram 32" />
</figure>


### 17.12 Rate Limiting Flow


<figure class="diagram">
<img src=".pdf-assets/diagram-33.png" alt="Diagram 33" />
</figure>


### 17.13 CORS + Helmet Middleware Chain


<figure class="diagram">
<img src=".pdf-assets/diagram-34.png" alt="Diagram 34" />
</figure>


### 17.14 Swagger Registration Order


<figure class="diagram">
<img src=".pdf-assets/diagram-35.png" alt="Diagram 35" />
</figure>


### 17.15 Prisma Transaction Patterns


<figure class="diagram">
<img src=".pdf-assets/diagram-36.png" alt="Diagram 36" />
</figure>


### 17.16 Audit Log Write on Mutation


<figure class="diagram">
<img src=".pdf-assets/diagram-37.png" alt="Diagram 37" />
</figure>


### 17.17 Search Multi-Entity Flow


<figure class="diagram">
<img src=".pdf-assets/diagram-38.png" alt="Diagram 38" />
</figure>


### 17.18 Report Scheduling (CRUD — cron execution)


<figure class="diagram">
<img src=".pdf-assets/diagram-39.png" alt="Diagram 39" />
</figure>





<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`exportJob.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ExcelJS export worker (sync `setImmediate`)</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`lib/payrollQueue.js`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">BullMQ `payroll-calculate` queue + in-process worker</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`lib/redis.js`</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ioredis client; cache get/set; no-op without REDIS_URL</td></tr>
</tbody></table>

<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">

## Appendix B — Document Revision History

<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">
<thead><tr><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Date</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Version</th><th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">Changes</th></tr></thead><tbody>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">July 2026</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">1.0</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Initial comprehensive technical documentation</td></tr>
<tr><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">July 2026</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**2.0**</td><td style="background:#ffffff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">Expanded workflows, Hostinger deep dive, colored diagrams, Quick Start, full utils/middleware reference, 18+ new flowcharts</td></tr>
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">July 2026</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">**3.0**</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">PDF blank-page fixes, all diagrams pre-rendered in color, section callouts, appendix reorder, HTML tables</td></tr>
</tbody></table>




<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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
<tr><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">POST</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">`/export/employees`</td><td style="background:#f5f9ff;padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">ExcelJS async job</td></tr>
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






<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">


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

