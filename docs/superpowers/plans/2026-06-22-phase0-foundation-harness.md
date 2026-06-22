# Phase 0 — Foundation & Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a safe local build/test harness for the *already-live* EMS backend so the
reconcile/gap-fill slices can proceed without risking the production database.

**Architecture:** This repo is a mature Fastify v4 + Prisma v5 + **PostgreSQL** backend, live
on Hostinger. We add an isolated local Postgres (docker) for dev/test, a boot smoke test on the
existing `node --test` runner, and a tracker. No new runtime code; we verify and reconcile.

**Tech Stack:** Node 20 (ESM) · Fastify v4 · Prisma v5 · PostgreSQL 18 · `node --test` ·
Playwright · Zod · jose · Argon2id. **No Redis/BullMQ** (removed; synchronous).

## Global Constraints

- DB provider is `postgresql`. Never reintroduce MySQL. Verbatim from `schema.prisma`.
- ⛔ Never run migrations/seeds/tests against the live Hostinger/Render DB. Local only
  (DATABASE_URL must contain `localhost`/`127.0.0.1`/`ems_test`).
- Money = integer minor units + ISO 4217 code. Never float, never "assume rupees/2dp".
- Multi-country = data, never code. No `if (country === …)`.
- Every protected route enforces RBAC server-side + is tenant-scoped (`tenantId`).
- One slice per commit; STOP and ask before committing; wait for "next".

---

### Task 0.1: Bootstrap verify (safe local harness)

**Files:**
- Modify: `docker-compose.yml` (replace stale MySQL+Redis with local Postgres) ✅ done
- Create: `docker/initdb/01-create-test-db.sql` (creates `ems_test`) ✅ done
- Create: `.env.test.example` (local test DATABASE_URL) ✅ done
- Create: `tests/bootstrap.smoke.test.js` (boot + health smoke) ✅ done
- Create: `BUILD_PLAN.md` (tracker) ✅ done
- Modify: `package.json` (add `test:smoke` script)

**Interfaces:**
- Consumes: `createApp()` from `src/app.js` (async → Fastify instance).
- Produces: `npm run test:smoke` → green when the app boots against a local DB.

- [x] **Step 1: Add the smoke-test script to package.json**

```json
"test:smoke": "node --test tests/bootstrap.smoke.test.js",
```

- [x] **Step 2: Start the configured database path**

Run: existing `.env` Render Postgres for this local backend handoff.
Expected: no migrations/seeds/writes; smoke performs only `SELECT 1`.

- [x] **Step 3: Skip migrations against Render DB**

No `prisma migrate` command was run. Render DB is already the configured DB and must not be
mutated during this bootstrap proof.

- [x] **Step 4: Run the boot smoke test**

Run: `npm run test:smoke`
Expected: 4 passing tests (`/health`, `/healthz`, `/docs`, Prisma `SELECT 1`).
Result: passed 4/4 on 2026-06-22.

- [x] **Step 4b: Local FE/backend browser smoke**

Run backend: `npm run dev` in `EMS` → `http://localhost:3000`.
Run frontend: `pnpm dev -p 3001` in `ems-frontend` with
`API_BASE_URL=http://localhost:3000/api/v1` and `NEXT_PUBLIC_USE_MOCKS=false`.
Result: Playwright login as `hr@acme.test` reached `/dashboard`; auth, analytics,
notifications, and manager approvals returned 200 through the BFF.
Screenshot: `/tmp/ems-local-dashboard-20s.png`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker/initdb .env.test.example tests/bootstrap.smoke.test.js BUILD_PLAN.md package.json docs/superpowers/plans
git commit -m "chore(harness): Phase 0.1 — local Postgres compose + boot smoke test + build tracker"
```

---

### Task 0.2: Cross-cutting envelope / 422-details / logging audit (read-only verify)

**Files:** Review `src/utils/response.js`, `src/middleware/errorHandler.js`, validators.
Confirm the success/error envelope and 422 `error.details[]` match `CLAUDE.md §4`/`§11`.
Write findings to BUILD_PLAN; only change code if a mismatch is found (its own slice).

### Task 0.3: Tenant-scoping audit (read-only verify)

**Files:** Review `src/middleware/resolveTenant.js` + a sample of repositories. Confirm every
query is filtered by `tenantId`. Record gaps as backlog slices.

### Task 0.4: FE↔backend wiring + login browser-QA

**Files:** `ems-frontend/.env.local` → `API_BASE_URL=http://localhost:<port>/api/v1`,
`NEXT_PUBLIC_USE_MOCKS=false`. Run backend locally; `gstack qa-only` smoke: login screen
renders + authenticates against the local backend.

---

## Self-Review

- **Spec coverage:** Phase 0 slices 0.1–0.4 all mapped. 0.1 is fully detailed; 0.2/0.3 are
  read-only audits (no premature code); 0.4 needs the local backend running first.
- **Placeholder scan:** none — commands and code are concrete.
- **Type consistency:** only `createApp()` is consumed; matches `src/app.js:37`.
