# EMS Backend — Build Tracker

> Source plan: `docs/superpowers/plans/2026-06-22-phase0-foundation-harness.md`
> Method: **one slice at a time** → research → plan → tradeoffs → replan → implement →
> test → review → **STOP, ask to commit, wait for "next"** (per the frontend handoff
> `BACKEND_BUILD_PLAN.md`).

## Reality reconciliation (2026-06-22)

The frontend handoff's `BACKEND_BUILD_PLAN.md` assumes a **greenfield** Fastify · **MySQL** ·
**Redis** · **BullMQ** · **Vitest** app. **This repo is none of those:**

| Handoff assumes | This repo actually is |
| --------------- | --------------------- |
| MySQL | **PostgreSQL** (`schema.prisma` provider, live on Hostinger) |
| Redis + BullMQ | **removed** — synchronous; no `bullmq`/`ioredis` in deps or `src/` |
| Vitest | **Node `node --test`** (e.g. `test:auth-me`, `test:auth-logout`) |
| Blank slate | **Already built & LIVE** — auth, employees, departments, attendance, leave, holidays, reports, analytics, settings, notifications, search, **payroll, timesheets, recruitment, performance, assets, announcements** are all registered in `src/app.js` and live at `ems-api.saqibsaeed.cloud` |

**Therefore the real work is RECONCILE + GAP-FILL, not greenfield.** Most "phases" below
collapse into: (a) fix documented live divergences, (b) implement the MSW-only surfaces the
FE defined but the backend hasn't shipped, (c) port the FE's pure engines + tests where the
backend reimplemented logic ad hoc.

## Decisions locked

- **DB:** keep Postgres. Deploy target = Hostinger (prod). Dev/test = **local docker Postgres**
  only (`docker-compose.yml`). Never migrate/seed/test against prod.
- **Async:** stay synchronous for now. Reintroduce a queue ONLY at the payroll `CALCULATING`
  scale slice if load demands it — not as a Phase-0 checkbox.
- **Engine-port test runner:** defer the Vitest-vs-`node --test` decision to the first
  engine-port slice (Phase: attendance/leave/payroll). Slice 0.1 uses `node --test` (existing).

## Phase 0 — Foundation & harness

- [x] **0.1 Bootstrap verify** — boot smoke test (`tests/bootstrap.smoke.test.js`) now proves
  Fastify health, Swagger, and a read-only Prisma DB probe. Verified 2026-06-22 with configured
  Render DB: `npm run test:smoke` passed 4/4. Local backend ran on `http://localhost:3000`;
  frontend ran on `http://localhost:3001` with BFF `API_BASE_URL=http://localhost:3000/api/v1`.
  Browser QA login as `hr@acme.test` reached `/dashboard`; dashboard APIs returned 200
  (`/analytics/*`, `/manager/approvals`, notifications). Screenshot: `/tmp/ems-local-dashboard-20s.png`.
- [x] 0.2 Cross-cutting envelope/422-details/logging audit — fixed legacy
  `errorResponse(code, message, requestId)` call compatibility, normalized missing details to
  `{}`, and made `requestIdPlugin` global via `fastify-plugin` so `request.id`,
  `request.requestId`, and `x-request-id` are consistently available. Verified 2026-06-22:
  `node --test tests/response-envelope.test.js` passed 3/3 and `npm run test:smoke` passed 4/4.
- [ ] 0.3 Tenant-scoping audit — confirm `resolveTenant` + per-query `tenantId` coverage.
- [ ] 0.4 FE↔backend wiring — point `ems-frontend` `.env.local` at local backend, `NEXT_PUBLIC_USE_MOCKS=false`, browser-QA login.

## Backlog — documented divergences to reconcile (highest value first)

- [ ] Loans PR-1 — align live `amount`/`balance` strings → numeric `principal`/`outstandingBalance`.
- [ ] Sub-monthly payroll — semi-monthly run doubles pay; needs `salary.legalEntityId`.
- [ ] `createRole` BE-10 — `POST /settings/roles` drops `permissions[]` on create.
- [ ] Attendance UTC bug (BR-ATT-2) — classify day in employee tz, not UTC.
- [ ] Timesheet `PATCH /entries/:id` 500.
- [ ] Legal-entity work-time — add `workWeekDays[]` + `hoursPerDay`.

## MSW-only surfaces to implement (FE contract exists, backend 404s)

- [ ] Leave engine (`balance`/`ledger`/`requests`/`comp-off`/`policies`/`packs`) — port `leave/engine/*`.
- [ ] Holiday per-country policy / observed / substitute / optional-selection + `?countryCode=`.
- [ ] Timesheet workflow extras (budgets, rates, locks, audit, delegation, approval-chain, routing, bulk, week-config, templates).
- [ ] Payroll extras (loans/garnishments/tax-forms/declaration/events/reimbursements/journal/registers/disbursement/...).

> Tick a box only after its slice passes Definition of Done (`BACKEND_BUILD_PLAN.md`):
> wire shape exact · engine + ported tests green · Zod 422 details · RBAC enforced ·
> tenant-scoped · money minor-units · config-driven (no `if (country===)`) · browser-QA at
> a non-default country/currency/work-week.
