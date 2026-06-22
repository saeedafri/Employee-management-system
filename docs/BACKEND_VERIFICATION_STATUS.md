# Backend Verification Status

> Live end-to-end verification of the EMS backend against the running frontend with
> **MSW OFF** (`NEXT_PUBLIC_USE_MOCKS=false`, FE :3001 → BFF → backend :4000 → DB).
> Updated 2026-06-22.

## Phase roadmap (59 slices / 13 phases) — verified status

| Phase | State | Notes |
|-------|-------|-------|
| 0 Foundation | ✅ done | boots, Postgres, Swagger, envelope/422 |
| 1 Auth & identity | ✅ done | 20 routes, refresh rotation, RBAC guard, browser login verified live |
| 2 Core directory | ✅ done | employees/departments render live |
| 3 Attendance | ✅ done | BR-ATT-2 tz fix |
| 4 Leave | ✅ live-verified | balance/types/requests render live; **fixed backend bug** (commit 7ceb119): `/leave/types` now uses engine codes (EL/SL/CL/CO) so the balance↔type join resolves — leave screen was crashing on `undefined.color` under MSW-off |
| 5 Timesheets | ✅ live-verified | core + all workflow-extras tabs (Approvals/Projects/Rates/Approval Flow/Locks/Delegations) render live MSW-off; timer, totals, submit-banner, real projects; zero console errors; no backend defects |
| 6 Payroll | ✅ 10/11 | 6.6 from-leave/from-attendance DONE (commit 08cb9cc); **6.7 run types LIVE-verified** (BONUS/ARREARS/OFF_CYCLE/FNF/REVERSAL create+validation+reversal-linkage, no country hardcode); 6.5 async = deferred (see below) |
| 7 Holidays | ✅ done | 7.3 countryCode live-verified (commit fdce518) |
| 8 Settings | ✅ done | renders live (redirects to /settings/company-profile) |
| 9 Reports & Analytics | ✅ screen-live | no API errors; export is sync (not BullMQ) |
| 10 Permissions | ✅ done | roles-permissions live |
| 11 Cross-cutting | 🔶 11.1–11.3 done | 11.4 BullMQ jobs + 11.5 Redis cache = deferred |
| 12 Hardening | 🔶 12.2 first-pass done | **12.2 auth/tenant first-pass PASS** (below); 12.1 multi-country regression, 12.3 load-test, 12.4 reconcile remain |

### Extra modules (outside the 59-slice plan, have FE contracts)
| Module | Endpoints | State |
|--------|-----------|-------|
| recruitment | 8 | ✅ live — summary/openings/candidates/recruiters all 200 with real data |
| performance | 8 | ✅ live — reviews/cycles/summary/goals all 200 |
| assets | 10 | ✅ live — no API errors |
| announcements | 7 | ✅ live — no API errors |

## Live MSW-off screen sweep (2026-06-22)
All 16 module screens loaded against the live backend with **zero API 4xx/5xx failures and zero console errors**: dashboard, employees, departments, attendance, timesheets, leave, holidays, payroll, reports, analytics, permissions, settings, recruitment, performance, assets, announcements.

## Deferred by decision (2026-06-22)
Redis + BullMQ removed from the stack. Payroll `calculate` runs synchronously. Slices **6.5, 11.4, 11.5, 12.3** are deferred, not done — functionally correct, won't scale to thousands of employees without the async path.

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

## Genuine remaining work (honest)
1. **12.1** — finish the per-module browser sweep at KWD/JPY (payroll runs with data, analytics, payslips); the harness + KWD tenant are now in place.
2. **12.2 deepening** — per-route role-correctness sweep, secrets audit, dependency CVE scan.
3. **Per-field shape parity** for MSW-shadowed modules (payroll-extras, timesheet-workflow) vs their contracts — screens render, exhaustive field diff not done.
4. **Leave-types taxonomy reconciliation — RESOLVED.** Verified the FE only **GETs** `/leave/types` (engine codes) and manages leave types via `/leave/policies` + `/leave/assignments` — it never calls `POST/PATCH/DELETE /leave/types`. The legacy DB-row CRUD is orphaned (writes don't surface in GET once policies exist), so there is no broken FE flow. Marked the CRUD **[DEPRECATED]** in Swagger + API_MAPPING, pointing to policies/packs as the source of truth. No rearchitecture needed.
4. Frontend follow-ups in `FRONTEND_FOLLOWUPS.md` (not our side).

## Verified this session (live, MSW-off)
- **7.3** holidays `?countryCode=` (commit fdce518)
- **6.6** payroll inputs from-leave/from-attendance (commit 08cb9cc)
- **6.7** payroll run types — 10/10 live cases pass (BONUS, ARREARS, OFF_CYCLE ±params, FNF ±params, REVERSAL ±target/±state, invalid-type). No code change needed; already correct.
- Full 16-screen MSW-off sweep — zero API failures, zero console errors.
