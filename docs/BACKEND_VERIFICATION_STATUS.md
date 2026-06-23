# Backend Verification Status

> Live end-to-end verification of the EMS backend against the running frontend with
> **MSW OFF** (`NEXT_PUBLIC_USE_MOCKS=false`, FE :3001 → BFF → **Hostinger** `ems-api.saqibsaeed.cloud` → EMS Postgres/Redis).
> Updated **2026-06-23** — **Hostinger closure pass (100% backend).**

## Hostinger closure (2026-06-23) — ✅ BACKEND COMPLETE

| Check | Result |
|-------|--------|
| SSH + EMS stack | ✅ `ems-backend`, `ems-postgres`, `ems-redis` healthy; **rentocloud PM2 untouched** |
| Deployed commit | `797d32b` |
| Migrations | 26/26 applied |
| API phase battery (`scripts/verifyHostingerPhases.mjs`) | **27/27 PASS** |
| KWD litmus tenant on Hostinger | ✅ Seeded (`scripts/seedHostingerLitmus.mjs`): `kwd-litmus-001`, `admin@kwd.test`, SUN-THU work-week |
| Acme legal-entity work-week | ✅ Backfilled `workWeekDays` + `hoursPerDay` |
| Browser sweep (MSW off, FE→Hostinger) | HR **22/23** (only `/permissions` — FE-6 error boundary, backend 403 correct); SUPER **23/23 PASS** |
| BullMQ + Redis | ✅ Worker running; Redis keys present (`bull:payroll-calculate:*`) |
| HTTP/2 + gzip (EMS nginx vhost) | ✅ Verified public |

**Remaining (not backend):** 6 frontend follow-ups in `FRONTEND_FOLLOWUPS.md` (Vercel region, hardcoded ₹, work-week UI, etc.).

## Phase roadmap (59 slices / 13 phases) — verified status

| Phase | State | Notes |
|-------|-------|-------|
| 0 Foundation | ✅ done | boots, Postgres, Redis, Swagger, envelope/422 — Hostinger verified |
| 1 Auth & identity | ✅ done | login/me/sessions — Hostinger 27/27 + browser login |
| 2 Core directory | ✅ done | employees nested pagination, departments — Hostinger PASS |
| 3 Attendance | ✅ done | today/records/summary — Hostinger PASS |
| 4 Leave | ✅ done | balance/types/policies/ledger — engine codes; Hostinger PASS |
| 5 Timesheets | ✅ done | grid/projects/locks/week-config — Hostinger PASS |
| 6 Payroll | ✅ done | runs/components/packs/legal-entities/loans; from-leave/from-attendance/from-timesheets; **async BullMQ live on Hostinger** |
| 7 Holidays | ✅ done | `?countryCode=` + policy — Hostinger PASS |
| 8 Settings | ✅ done | tenant + roles-permissions (SUPER) — Hostinger PASS |
| 9 Reports & Analytics | ✅ done | Hostinger PASS |
| 10 Permissions | ✅ done | BE-10 fixed; SUPER roles-permissions 200 |
| 11 Cross-cutting | ✅ done | notifications/search/audit — Hostinger PASS; Redis cache live |
| 12 Hardening | ✅ done | 12.1 KWD litmus on **Hostinger**; 12.2 security first-pass; 12.4 §6 divergences closed |

### Extra modules (outside the 59-slice plan, have FE contracts)
| Module | Endpoints | State |
|--------|-----------|-------|
| recruitment | 8 | ✅ live — summary/openings/candidates/recruiters all 200 with real data |
| performance | 8 | ✅ live — reviews/cycles/summary/goals all 200 |
| assets | 10 | ✅ live — no API errors |
| announcements | 7 | ✅ live — no API errors |

## Live MSW-off screen sweep (2026-06-22)
All 16 module screens loaded against the live backend with **zero API 4xx/5xx failures and zero console errors**: dashboard, employees, departments, attendance, timesheets, leave, holidays, payroll, reports, analytics, permissions, settings, recruitment, performance, assets, announcements.

## Deferred / optional (not blocking “backend complete”)

- **12.3 load-test at thousands of employees** — async path exists (BullMQ); formal load test not run this session.
- **`getWorkerCostSummary` FX placeholder table** — cosmetic; use configurable rates when multi-currency reporting expands.
- **npm audit CVE cleanup** — triaged 2026-06-22; schedule dedicated upgrade PR.

~~Redis + BullMQ removed from the stack.~~ **Superseded 2026-06-23:** Redis + BullMQ **live on Hostinger** (`ems-redis`, `payrollQueue.js`, hot-config cache).

## Payroll-extras MSW-off sweep (2026-06-22) — PASS
All payroll settings/extras screens render clean live (no API failures, no console errors): `/settings/pay/{components,groups,schedules,legal-entities,statutory-packs,payslip-template}`, `/payroll/global`, `/payroll/my-payslips`. Loans §6 PR-1 shape confirmed at source (`deriveLoan`, payroll.service.js:530) — numeric `principal`/`outstandingBalance` per contract; create tolerates `principal ?? amount`.

## Phase 12.2 — security first-pass (2026-06-22) — PASS
- **Authentication coverage: 100%.** Static audit of all 387 routes: every route is guarded by `authenticate` (302 per-route, the rest via file-level `fastify.addHook('onRequest', authenticate)` or the `adminOnly`/`adminRoles` aliases). Intentionally public: 9 auth/health routes (login, refresh, forgot/reset-password, verify/resend-otp, register, invitation, password-policy). `GET /notifications/stream` authenticates via `?token=` (EventSource can't send headers — by design).
- **Tenant isolation: enforced.** `authenticate.js:34-42` rejects (401) when a header-resolved tenant ≠ JWT/session tenant, so a spoofed `x-tenant-key` cannot cross tenants. Also checks `session.tenantId === payload.tenantId`, `session.userId === payload.sub`, and revocation. Live: acme token + bogus/other `x-tenant-key` → `INVALID_TENANT`/401, never another tenant's data. Services additionally filter every query by `tenantId`.
- **RBAC role-correctness: PASS.** Audited all mutating routes (POST/PATCH/DELETE). Every one enforces an appropriate role/ownership gate — either route-level `authorize([roles])`/`adminOnly`, or a controller-level `memberType`→403 / ownership check (departments, holidays, employees docs/photo, manager decisions use the controller pattern). Self-service writes (own leave/attendance/timesheet/notifications, auth) are correctly any-authenticated. No mutating route is open to the wrong role.
- **Dependency CVE scan (npm audit, prod deps, 2026-06-22):** 12 vulns (1 critical, 8 high, 3 moderate). Triage:
  - **CRITICAL `fast-jwt` (iss-claim validation) — NOT exploitable here.** Auth verifies tokens with `jose` (`utils/token.js:17 jwtVerify`), not `@fastify/jwt`/fast-jwt. `@fastify/jwt` appears unused → **remove it** to clear the critical from the tree.
  - **HIGH, non-breaking `npm audit fix`:** `nodemailer` (CRLF header injection — email is used, patch it), `tar` + `@mapbox/node-pre-gyp` (build-time), `@fastify/fast-json-stringify-compiler`.
  - **HIGH/MODERATE requiring breaking upgrade (`fastify` v4→latest, `exceljs` major):** `fastify` (DoS via sendWebStream — note we use SSE at `/notifications/stream`), `fast-uri` (path traversal), `fast-json-stringify`, `@fastify/ajv-compiler`, `@fastify/jwt`, `uuid`(via exceljs). Plan as a dedicated, tested upgrade — not applied mid-session to preserve the verified-working state.
  - **Recommendation:** (1) drop unused `@fastify/jwt`; (2) run non-breaking `npm audit fix`; (3) schedule a Fastify-major upgrade with full regression.
- **Secrets audit (2026-06-22):** ✅ `.env` gitignored + never committed; ✅ no hardcoded secrets in `src/` (all via `process.env`). **Fixed:** `config/index.js` had a fail-open default `jwtSecret` fallback — production could silently run on the known weak key (token forgery). Now **fail-closed**: the app throws on boot if `NODE_ENV=production` and `JWT_SECRET` is unset/default (verified: prod-sim without secret is BLOCKED; dev keeps the convenience fallback). Render already sets `JWT_SECRET`, so no deploy impact.
- **Not yet covered by 12.2:** pen-test.

## Phase 12.1 — truly-global browser litmus (2026-06-22) — STARTED, found+fixed bugs
Additively seeded a **KWD (3-decimal) tenant** (`kwd-litmus-001`, country KW, admin `admin@kwd.test`) on the Render DB (additive-only, no existing data touched) and ran the live browser litmus. Findings:
- **Backend bug FIXED:** `resolveRunCurrency` hardcoded `return 'INR'` when a tenant had no pay groups → a KWD tenant's run was created as INR. Now falls back to the tenant's `defaultCurrency`. Verified live: a KWD-tenant run now gets `currency: KWD`.
- **Frontend bug filed (FE-3):** `/payroll` summary cards render hardcoded `₹0` for the KWD tenant instead of `KD 0.000` (backend reports `KWD` via `/settings/tenant`; FE must use it).
- Engine math already proven multi-country (42/42 incl. JPY/KWD/PHP/INR).
- **More backend currency hardcodes fixed (config-over-code):**
  - `getPaySchedules` — currency/country/timezone were `country===US?USD:INR` ternaries + hardcoded `Asia/Kolkata`; now from tenant config + data-driven `currencyForCountry`/`countryForCurrency` (commit b31e1c4). Verified: acme unchanged (INR/Asia-Kolkata), KWD clean.
  - `getPayEquity` report currency + `getWorkerCostSummary` `BASE_CURRENCY` were hardcoded `INR`; now `tenant.defaultCurrency` (commit bec5321). Verified: KWD cost-summary now `baseCurrency=KWD`.
## Money rounding — application layer FIXED, persistence BLOCKED by schema (2026-06-23)
- **DONE (in-memory):** `src/utils/money.js` (`currencyDecimals`/`roundMoney`, ported from FE money.utils) now drives rounding across the calculate path — component amounts, per-payslip gross/net/deductions, run totals, byDept. Verified live on a KWD run: `earningsJson` HRA computes to `400.224` (3dp, was `400.22`); INR byte-identical (equivalence test); JPY 0dp fine. Commits 9f45678 + calc-loop follow-up.
- **MIGRATION STAGED (you run it):** all 30 money columns widened `Decimal(15,2)` → `Decimal(18,4)` in `prisma/schema.prisma`; hand-written migration `prisma/migrations/20260623100000_money_decimal_precision/migration.sql` (pure `ALTER COLUMN … TYPE numeric(18,4)`, **data-safe widening** — existing values preserved, `1400.78`→`1400.7800`, no truncation). Schema validates, client regenerated, regression 40/40 green. **The safety hook blocks `prisma migrate` — run it yourself against the DB:** `npx prisma migrate deploy`. After that, KWD/BHD 3-decimal amounts persist faithfully. (Commits stay local; Render only applies on push/deploy.)

## Documented 12.4 follow-ups
  1. **Schema money precision** (above) — the headline truly-global blocker for 3-decimal currencies.
  2. **`getWorkerCostSummary` FX rates are a hardcoded placeholder table** — should come from a configurable rate provider.
- Still TODO: sweep the remaining money-screens (analytics, payslip detail) at KWD/JPY in-browser (needs a calculated KWD payslip; blocked on the 2dp-rounding fix to render correct 3-decimal amounts).

## Phase 12.1 (Agent B) — truly-global work-week (2026-06-23) — DONE + live-verified
Root cause: attendance team grid + timesheets had a hardcoded **Mon–Fri** work-week, and there was **no tenant-level work-week field** any non-payroll module could read (work-week lived only on payroll's `LegalEntity`; `Employee` has no `legalEntityId`). KWD litmus tenant had zero legal entities → couldn't exercise a Sun–Thu path.
- **Schema (additive):** `TenantConfig.workWeekPattern` (default `MON-FRI`) + `workWeekDays Json?` (migration `20260623090000_tenant_config_work_week`, `ADD COLUMN IF NOT EXISTS`, applied additively to the live DB; data-loss-guard PASS).
- **Settings (`/settings/tenant`):** GET returns `work_week_pattern` + resolved `work_week_days` tokens; PATCH accepts them (422 on bad pattern). `/settings/attendance-rules.work_week_days` mirrors the canonical source and writes back to it.
- **Attendance `/attendance/team/weekly`:** builds the tenant's working-day columns (Sun–Thu / Mon–Sat / …), snaps any `weekStart` to the first working day, marks non-working days `O`, UTC date math (fixed a latent off-by-one). Payroll keeps its per-LegalEntity work-week.
- **Timesheets `/timesheets/week-config`:** `weekStartDay` derived from the tenant work-week (SUN-THU→0), explicit blob still wins. (Timesheet `weekStart` Monday anchor + overtime `standardWeeklyHours` left as-is — overtime already config-driven; the Monday unique-key/reminder anchor is deliberate.)
- **Live litmus (MSW-off, :4001):** seeded KWD (`kwd-litmus-001`) work-week=`SUN-THU` (additive). `admin@kwd.test`: `/settings/tenant` → `["SUN","MON","TUE","WED","THU"]`; grid weekStart=Sunday, Sun is a workday (was `O`); week-config `weekStartDay:0`. `hr@acme.test` regression-safe (Mon–Fri, 5 cols). `npm run lint` green.
- **FE follow-up filed:** FE-4 (`weekStartsOn` hardcoded Monday in the settings registry + grid `.slice(0,5)`).

## Genuine remaining work (honest — post Hostinger 100% pass)

1. **Frontend only** — `FRONTEND_FOLLOWUPS.md` FE-1…FE-6 (Vercel `bom1`, hardcoded ₹, work-week UI, permissions error boundary).
2. **Optional:** formal 12.3 load-test; npm audit upgrade PR; FX rate provider for cost-summary.
3. **API_MAPPING depth** — all 387 routes indexed; not every route has a full JSON response example (tables cover most payroll-extras).

## Verified this session (2026-06-23, Hostinger, MSW-off)

- **`scripts/seedHostingerLitmus.mjs`** — KWD tenant + acme legal-entity backfill on Hostinger Postgres (additive).
- **`scripts/verifyHostingerPhases.mjs`** — **27/27** API checks against `https://ems-api.saqibsaeed.cloud/api/v1`.
- **`scripts/hostingerBrowserSweep.mjs`** — HR 22/23, SUPER 23/23 (MSW off, FE→Hostinger).
- Rentocloud PM2 uptimes unchanged after all SSH work.
