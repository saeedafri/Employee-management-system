# 01 — Executive Summary & System Topology

**Author**: Antigravity Autonomous Systems & Architecture  
**Audit Series**: REA Deep Reverse-Engineering Audit (iPhone Gemini Edition)  
**Target Platform**: EMS (Employee Management System)  
**Timestamp**: 2026-10-20  

---

## 1. Executive Summary

This investigation represents an exhaustive, ground-truth reverse-engineering audit of the entire EMS enterprise platform. Using the **Reverse Engineering Anything (REA)** toolchain, we inspected:
- The **Backend Core** (`/Users/mohdsaeedafri/All-Code-Base/EMS`): Node.js 20+ ESM, Fastify v4, Prisma v5 ORM, PostgreSQL 16, Redis 7.
- The **Frontend Web Client** (`/Users/mohdsaeedafri/All-Code-Base/ems-frontend`): Next.js 16.2.6 (App Router, Turbopack, React 19, Tailwind CSS v4, Zustand, React Query).
- The **Live Infrastructure** on Hostinger Cloud VPS (`187.126.125.239`): Single Docker container `EMS` running PostgreSQL 16 (`:5432`), Redis 7 (`:6379`), and Fastify API (`:5000`).
- The **Active Local Runtime**: Local Fastify API on `http://localhost:4000` connected directly to Hostinger PostgreSQL and Redis; Local Next.js UI on `http://localhost:3001` with zero local databases.

---

## 2. Architectural Topology

```mermaid
flowchart TD
    subgraph Client_Tier ["Client Tier (Browser & Next.js BFF)"]
        Browser["User Browser (Chrome / Safari / Firefox)"]
        NextServer["Next.js 16.2.6 Server (Port 3001)<br/>App Router, Turbopack, React 19"]
        BFFProxy["BFF Proxy Route Handler (/api/[...path])"]
        
        Browser <-->|HTTP/2, HttpOnly Cookies| NextServer
        NextServer --> BFFProxy
    end

    subgraph Backend_Tier ["Application Service Tier (Fastify v4)"]
        FastifyApp["Fastify v4 Micro-Framework (Port 4000)"]
        ReqIdHook["x-request-id Plugin (Wrapped in fp)"]
        AuthHook["JWT & Session Verification Middleware"]
        RBAC["56-Key Permission Catalogue Guard"]
        Modules["21 Domain Modules (Payroll, Leave, Attendance...)"]
        
        BFFProxy <-->|HTTP/1.1 Loopback Proxy| FastifyApp
        FastifyApp --> ReqIdHook --> AuthHook --> RBAC --> Modules
    end

    subgraph Hostinger_VPS ["Hostinger Cloud Infrastructure (187.126.125.239)"]
        PostgresDB[("PostgreSQL 16 (:5432)<br/>77 Prisma Models, 78 Tables<br/>Database: employee_management_database_ibyc")]
        RedisCache[("Redis 7 (:6379)<br/>PubSub SSE, Caching, BullMQ")]
        PublicFastify["Public Container API (:5000)"]
    end

    Modules <-->|Prisma v5 Connection Pool| PostgresDB
    Modules <-->|ioredis Client (SSE & Cache)| RedisCache
    PublicFastify -.->|Container Image Replica| PostgresDB
```

---

## 3. Scale & Metric Breakdown

| Dimension | Measured Metric | Detail & Verification |
| :--- | :--- | :--- |
| **Prisma Models** | **77 Models** | Defined in `prisma/schema.prisma`. All 78 tables migrated in PostgreSQL. |
| **Backend REST Endpoints** | **~420 Endpoints** | Registered across 21 Fastify modules in `src/app.js`. |
| **Frontend UI Routes** | **60 Routes** | Defined under `src/app/**/page.tsx` (App Router). |
| **Frontend UI Components** | **110+ Custom Components** | Modularized in `src/modules/*/components/` and `src/components/`. |
| **Permission Catalogue** | **56 Unique Keys** | Documented in `src/modules/auth/permissionCatalogue.js`. |
| **Database Roster** | **71 Employees, 11 Users** | Seeded in Tenant `acme-corp-001`, verified live on Hostinger DB. |
| **Tenants** | **2 Tenants** | `acme-corp-001` (Acme Corp) and `test-key-123456789` (Test Org). |
| **Authentication Flow** | **Dual Token Architecture** | 15-minute JWT Access Token + 7-day HttpOnly Refresh Token in `prisma.session`. |

---

## 4. Key Takeaway

EMS possesses a production-grade schema and an unusually broad surface area (~420 endpoints, 60 UI screens). However, REA reverse engineering demonstrates that substantial portions of the system rely on **mocked JSON settings, synthetic calculation scripts, and hardcoded stubs**, compounded by **plugin encapsulation defects** that leave security headers and rate limits inert. 

The subsequent chapters detail every empirical AST observation, hidden stub, competitive gap, and actionable remediation step.
