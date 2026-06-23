# EMS Backend — Status of Record

> **Last verified: 2026-06-23** — live read-only verification against the Render DB (MSW-off),
> + sub-monthly doubling live E2E + unit suite. CI green on `ea354f5`.
> **This is the single source of truth.** It supersedes `IMPLEMENTATION_STATUS.md` (stale, 2026-05-22).
> Method + per-slice ticks live in [`../BUILD_PLAN.md`](../BUILD_PLAN.md); reconciliation rationale
> in the project memory `project_backend_build_reconciliation.md`.

## TL;DR

**The backend is feature-complete against the frontend contract. All 12 phases are functionally
done.** The only items not implemented are the **async/scale stack (BullMQ + Redis)**, which is
**deliberately deferred** (the app is synchronous Postgres by design — see Decisions). No genuine
code defects were found in the 2026-06-23 verification pass.

| Metric | Value |
|--------|-------|
| Stack | Fastify v4 (ESM) · Prisma v5 · **PostgreSQL** · JWT (`jose`) · Argon2id · Swagger |
| Registered routes | **~354** across 20 route-bearing modules |
| Prisma migrations | **26** (all applied; additive-only policy) |
| Test files | **36** (`node --test`; ported engine units + contract tests) |
| Queue/cache | **None** — Redis/BullMQ removed; all ops synchronous (by decision) |
| Deploy | Render web service + Render PostgreSQL (also Hostinger VPS Docker) |
| CI | GitHub Actions `CI` — **green** on `ea354f5` |

## Route surface by module (registered)

| Module | Routes | Module | Routes |
|--------|-------:|--------|-------:|
| payroll | 107 | analytics | 9 |
| timesheets | 41 | holidays | 8 |
| leave | 35 | performance | 8 |
| settings | 33 | recruitment | 8 |
| reports | 21 | announcements | 7 |
| auth | 20 | notifications | 7 |
| attendance | 12 | export | 5 |
| assets | 10 | auditLogs | 4 |
| dashboard | 4 | logs | 4 |
| billing | 3 | search | 1 |

> `files/`, `permissions/`, `resignations/` have no route files — intentional:
> documents live under `/employees/:id/documents`; permissions are served via
> `/settings/roles-permissions` + `/settings/roles`; resignations not in the FE contract.

## Phase-by-phase status (BACKEND_BUILD_PLAN Phases 0–12)

| Phase | Verdict | Notes / evidence |
|-------|---------|------------------|
| **0 — Foundation & harness** | ✅ Done | Boot smoke, success/error envelope + 422 `details`, request-id, tenant-scoping audit, FE↔backend wiring (MSW-off). |
| **1 — Auth & identity** | ✅ Done | login / refresh-rotation / me / sessions / logout(-all) / RBAC policy / forgot-reset / OTP / invite. Contract-tested + live (acme + KWD). |
| **2 — Core directory** | ✅ Done | employees `data.data[] + pagination` (live-verified), `next-code`, soft-delete; departments tree; Cloudinary documents. |
| **3 — Attendance** | ✅ Done | today / check-in / check-out (BR-ATT-2 tz fix), records?month / summary / regularization / team. |
| **4 — Leave** | ✅ Done | Engine ported verbatim: balance / ledger(+adjust) / requests lifecycle / comp-off / encashment / policies (versioning+publish) / policy-packs. Browser-verified MSW-off. |
| **5 — Timesheets** | ✅ Done | projects/tasks/entries (PATCH-500 fixed) / timer / submit / copy-week / templates; workflow extras (locks, audit, approval-chain, rates, budgets, delegation, week-config). |
| **6 — Payroll** | ✅ Done¹ | components + formula engine, statutory packs, countries, legal entities (`workWeekDays[]`+`hoursPerDay`), pay groups/schedules/calendars, salary assignment (append-only), run engine `DRAFT→CALCULATING→REVIEW→APPROVED→PAID`, run inputs (approval-gated), run types, payslips/templates, **loans (numeric)**, garnishments, tax-forms/declaration, reimbursements, journal/registers, disbursement/payment-batches, statutory-return, contractor/workers, cost-summary, migration. **Sub-monthly doubling live-verified fixed.** |
| **7 — Holidays** | ✅ Done | CRUD; per-country policy / observed / optional-selection (7.2); `?countryCode=` scoping (7.3). |
| **8 — Settings** | ✅ Done | tenant/company-profile, locale/currency/week-start/fiscal-year, notifications, auth/sessions/password-policy, working-hours (per-entity work-week), roles-permissions, email-templates, integrations, billing, branding, audit-log. |
| **9 — Reports & Analytics** | ✅ Done² | reports/* + analytics/* server-computed; HR/SUPER_ADMIN authz enforced (legacy reports reconciled). |
| **10 — Permissions** | ✅ Done | roles-permissions (rejects SUPER_ADMIN edit); custom roles persist `permissions[]`. `/permissions` verified no-op (FE uses `/settings/roles`). |
| **11 — Cross-cutting** | ✅ Done³ | notifications + unread-count + SSE, search, audit-logs. |
| **12 — Hardening** | ✅ Done⁴ | 12.1 truly-global QA (KWD 3-decimal + semi-monthly schedule, live), 12.2 security (RBAC on mutating routes, tenant isolation, fail-closed JWT secret), 12.4 final reconcile (this pass). |

## Deliberately deferred (NOT gaps — locked decision)

The frontend handoff assumed Redis + BullMQ; this repo removed them and runs **synchronous on
PostgreSQL**. The following stay deferred until scale demands them:

- ¹ **6.5 async CALCULATING** — payroll runs compute synchronously, not via a BullMQ worker.
- ³ **11.4 BullMQ job fan-out** (notification/webhook/export) and **11.5 Redis caching pass**.
- ⁴ **12.3 load-test the payroll worker** — N/A while synchronous.

> Reintroduce the queue/cache only at the payroll-scale slice if load requires it.

## Open / operational items (none block "done")

| # | Item | Type | Action owner |
|---|------|------|-------------|
| 1 | Render `DATABASE_URL` `connection_limit=5` → intermittent pool-timeout 500s under burst | Operational config | Raise pool on the live service (needs approval — `render-safety`) |
| 2 | Inert litmus pay group "KWD Semi Litmus" in KWD QA tenant | Test residue | Delete as SUPER_ADMIN (HR_ADMIN can't — correct RBAC); harmless |
| 3 | Timesheet workflow-extras per-feature browser-QA at non-default settings | Optional deeper QA | Marked `[~]` — screens verified earlier; not re-swept this pass |
| 4 | Destructive Mocha/integration suite must run only on a throwaway **local** DB | Safety rule | Never against Render (wiped prod 2026-05-27) |

## Verification evidence (2026-06-23, live vs Render DB, MSW-off)

- **Auth + multi-tenant isolation**: acme HR + KWD HR login 200, JWT issued, tenant-scoped.
- **Truly-global money litmus PASSED** at KWD (3-decimal) AND non-default semi-monthly schedule:
  - Monthly run: gross `1400.777`, ded `120.067`, net `1280.71`, currency `KWD`.
  - Semi-monthly run (same employee): gross **`700.389` = exactly half** (not doubled `2801.554`,
    not full `1400.777`), ded `60.033`, net `640.356` — KWD 3dp preserved. State restored.
- **Sub-monthly unit suite**: `payroll-subMonthly.test.js` 3/3 (`periodFactor = 12/ppy`, SEMI_MONTHLY ppy=24 → 0.5).
- **Wire shapes**: employees `data.data[] + pagination`; runs `data.items[]`; leave `balances[]`.
- **~40 endpoints / all 16 product modules → 200**; RBAC correct (HR_ADMIN → 403 on SUPER_ADMIN-only routes).
- **No genuine code defects.** The only 500s were transient Render pool-timeouts (item 1), recovering to 200 in isolation.

## Locked decisions (carry-forward)

- **DB = PostgreSQL**, additive-only migrations; never wipe/seed/migrate-reset prod (incident 2026-05-27).
- **Synchronous** (no Redis/BullMQ) until scale demands; money = currency-decimal-aware (KWD 3dp, JPY 0dp, INR 2dp).
- **Multi-country is DATA** (no `if (country === …)`); statutory rules in versioned packs; tax = `evaluateSlab` over configured tables.
- **RBAC enforced server-side** in policy; tenant isolation on every query.
