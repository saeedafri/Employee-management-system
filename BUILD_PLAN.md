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
- [x] 0.3 Tenant-scoping audit — confirmed `resolveTenant` plus `authenticate()` tenant/session
  mismatch protection. Fixed narrow high-risk tenant-model reads that used global `id` first:
  dashboard employee/manager lookups, manager approval lookups, and timesheet employee-name lookup.
  Verified 2026-06-22: `npm run test:smoke` passed 4/4, `node --test tests/response-envelope.test.js`
  passed 3/3, and browser dashboard smoke through local FE/backend returned 200 for auth,
  notifications, `/analytics/*`, and `/manager/approvals`. Screenshot:
  `/tmp/ems-phase03-dashboard.png`.
- [x] 0.4 FE↔backend wiring — used local frontend only for QA; no frontend commit.
  `ems-frontend/.env.local` was pointed at `API_BASE_URL=http://localhost:3000/api/v1` with
  `NEXT_PUBLIC_USE_MOCKS=false`; backend ran on `3000`, frontend on `3001`. Browser login as
  `hr@acme.test` reached `/dashboard`; dashboard data loaded from local backend via BFF.
  Evidence: `/tmp/ems-local-dashboard-20s.png`, `/tmp/ems-phase03-dashboard.png`.

## Phase 1 — Auth & identity

- [x] 1.1 `POST /auth/login` contract — reconciled SUPER_ADMIN/no-employee response
  nullability so contract fields are always present (`employeeId`, `employee`,
  `tenantContext`, `tenantMemberships`). Added focused contract coverage for login response
  shape, httpOnly auth cookies, and 422 validation details/requestId. Verified 2026-06-22:
  `node --test tests/auth-login-contract.test.js` passed 2/2,
  `node --test tests/auth-me.test.js` passed 7/7,
  `node --test tests/auth-logout.test.js` passed 2/2, and `npm run test:smoke` passed 4/4.
- [x] 1.2 `POST /auth/refresh` contract — verified refresh-token rotation creates a new
  session id, rotates both auth cookies, returns the new access token/session id, detects
  old-token reuse as `TOKEN_REUSE`, and clears both cookies on refresh failure. Malformed
  refresh cookies now return the published `INVALID_SESSION` contract error. Verified
  2026-06-22: `node --test tests/auth-refresh-contract.test.js` passed 3/3,
  `node --test tests/auth-login-contract.test.js` passed 2/2,
  `node --test tests/auth-me.test.js` passed 7/7,
  `node --test tests/auth-logout.test.js` passed 2/2, and `npm run test:smoke` passed 4/4.
- [x] 1.3 `GET /auth/me`, `GET/DELETE /auth/sessions`, logout, logout-all — added
  contract coverage for `/auth/me` user shape, flat session list shape, session revoke,
  revoked-session token rejection, and current-session continuity after revoking another
  session. Existing logout tests verify both cookies clear and old access tokens stop
  working immediately. Verified 2026-06-22:
  `node --test tests/auth-sessions-contract.test.js` passed 2/2,
  `node --test tests/auth-me.test.js` passed 7/7,
  `node --test tests/auth-logout.test.js` passed 2/2,
  `node --test tests/auth-login-contract.test.js` passed 2/2,
  `node --test tests/auth-refresh-contract.test.js` passed 3/3, and
  `npm run test:smoke` passed 4/4.
- [x] 1.4 RBAC policy layer — added a backend permission catalog matching the frontend
  permission-key contract, `hasPermission()`, and a Fastify `preHandler` factory
  (`requirePermission`). Wired `GET/PATCH /settings/roles-permissions` to enforce
  `permissions:manage` server-side instead of relying only on UI affordances or role labels.
  Verified 2026-06-22: `node --test tests/rbac-policy-contract.test.js` passed 2/2,
  `node --test tests/auth-login-contract.test.js` passed 2/2,
  `node --test tests/auth-me.test.js` passed 7/7, and `npm run test:smoke` passed 4/4.
- [x] 1.6 Auth extras — reconciled `forgot-password`, `reset-password`, `verify-otp`,
  invitation validation, and public password-policy contracts used by the frontend auth
  screens. `POST /auth/forgot-password` now returns the documented message in `data`;
  `POST /auth/reset-password` accepts frontend `{ token, password }` while preserving
  legacy `{ token, newPassword }`; unauthenticated reset links no longer require tenant
  context; `GET /auth/password-policy` returns camelCase policy data for set/reset forms.
  Verified 2026-06-22: `node --test tests/auth-extras-contract.test.js` passed 7/7,
  auth login/me/refresh regressions passed 12/12, logout/sessions/RBAC regressions passed
  6/6, `BASE=http://127.0.0.1:3000/api/v1 node --test tests/http-status-contract.test.js`
  passed 12/12, `node --test tests/invitation.test.js` passed 16/16,
  `npm run test:smoke` passed 4/4, and `node --test tests/response-envelope.test.js`
  passed 3/3. MSW-off browser QA through local frontend (`localhost:3001`) confirmed
  service-worker registrations 0, all captured auth API responses `fromServiceWorker=false`,
  forgot-password 202 reached "Check your email", password-policy 200, reset-password posted
  `{ token, password }` and rendered the invalid-link error on `RESET_TOKEN_INVALID`, and
  set-password unknown token rendered the invalid-invitation screen. Screenshots:
  `/tmp/ems-auth-extras-forgot-debug-after.png`,
  `/tmp/ems-auth-extras-reset-invalid-msw-off.png`,
  `/tmp/ems-auth-extras-set-password-invalid-msw-off.png`.

## Phase 3 — Attendance

- [x] 3.1 `today` · `check-in` · `check-out` — fixed BR-ATT-2 end-to-end by deriving
  the attendance day from the tenant timezone on the backend, not server-local midnight
  or a frontend-supplied date. Explicit `date` remains a compatible override, and
  `workMode` is now accepted on check-in. Verified 2026-06-22:
  `node --test tests/attendance-timezone-contract.test.js` passed 2/2, proving
  `2035-01-01T20:00:00.000Z` stores/reads/checks out as `2035-01-02` for
  `Asia/Kolkata`; `npm run test:smoke` passed 4/4; response/status/auth regressions
  passed 27/27; touched-source ESLint passed. MSW-off browser QA through local
  frontend (`localhost:3001`) logged in, loaded `/attendance`, performed check-in
  and check-out against the local backend, confirmed service-worker registrations 0,
  all captured `/api/*` responses `fromServiceWorker=false`, and cleaned the temporary
  current-day row afterward. Screenshots:
  `/tmp/ems-attendance-msw-off-before.png`,
  `/tmp/ems-attendance-msw-off-checked-in.png`,
  `/tmp/ems-attendance-msw-off-checked-out.png`.

## Phase 10 — Permissions & settings

- [x] 10.2 Custom roles / BE-10-BE-11 — source already persisted `permissions[]` on
  `POST /settings/roles` and returned `customRoles[]` from `GET /settings/roles-permissions`;
  added regression coverage so this cannot silently drift. Verified 2026-06-22:
  `node --test tests/settings-roles-contract.test.js` passed 1/1, creating a temporary
  role with `employees:read` + `leave:approve`, confirming the create response echoed both
  permissions, confirming the permissions matrix and `customRoles[]` exposed the role, then
  deleting it. MSW-off browser QA through local frontend (`localhost:3001`) logged in as
  `superadmin@acme.test`, opened `/permissions`, loaded `GET /api/settings/roles-permissions`
  with 200, created a temporary custom role through Add Role with both selected permissions,
  confirmed `POST /api/settings/roles` returned 201 and echoed both permissions, deleted it
  with `DELETE /api/settings/roles/:key` 200, and captured no API responses from a service
  worker. Screenshots: `/tmp/ems-settings-roles-created-msw-off.png`,
  `/tmp/ems-settings-roles-deleted-msw-off.png`.

## Phase 12 — Hardening

- [x] 12.1 HTTP status/envelope hardening — fixed malformed JSON to return `400 INVALID_REQUEST`
  instead of 500, kept Fastify validation errors at `422 VALIDATION_ERROR`, made employee create
  authorization run before body validation so unauthorized users get 403, relaxed employee id
  param parsing so unknown ids reach repository lookup and return 404, and shortened tenant
  registration transactions by upserting global permissions outside the transaction with a longer
  transaction timeout. Verified 2026-06-22: `BASE=http://127.0.0.1:3000/api/v1 node --test
  tests/http-status-contract.test.js` passed 12/12, `npm run test:smoke` passed 4/4,
  `node --test tests/response-envelope.test.js` passed 3/3, auth/RBAC regressions passed 11/11,
  and MSW-off local UI login reached `/dashboard` with `navigator.serviceWorker` registrations 0,
  all captured frontend API responses `fromServiceWorker=false`, and dashboard APIs 200.
  Screenshot: `/tmp/ems-status-hardening-dashboard-25s.png`.

## Backlog — documented divergences to reconcile (highest value first)

- [ ] Loans PR-1 — align live `amount`/`balance` strings → numeric `principal`/`outstandingBalance`.
- [ ] Sub-monthly payroll — semi-monthly run doubles pay; needs `salary.legalEntityId`.
- [x] Attendance UTC bug (BR-ATT-2) — classify day in employee/tenant tz, not UTC.
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
