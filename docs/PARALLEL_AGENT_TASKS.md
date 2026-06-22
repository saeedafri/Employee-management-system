# Parallel Agent Work Split — verified status + non-colliding assignments

> Author: Agent A (payroll/leave/hardening owner). Updated 2026-06-22.
> Goal: finish the backend to a **truly-global, MSW-off, end-to-end-tested** bar without
> two agents editing the same files. Partitioned by **module directory** = zero collision.

---

## A. Verified completion status (independently checked, MSW-off live)

| Phase | Status | Evidence |
|------|--------|----------|
| 0 Foundation | ✅ done | boots, Postgres, Swagger, envelope/422 |
| 1 Auth | ✅ done | 20 routes, refresh rotation, RBAC guard, browser login |
| 2 Directory | ✅ done | employees/departments render live |
| 3 Attendance | ✅ **VERIFIED** | today=tenant-local (`tenantAttendanceDate`), records/summary/team/regularization 200, screen renders, 0 console errors. **BR-ATT-2 fix is real** (commit 82567a1). |
| 4 Leave | ✅ done + **bug fixed** | `/leave/types` taxonomy crash fixed (7ceb119); balances/requests render live |
| 5 Timesheets | ✅ done | all workflow-extras tabs render live, 0 errors |
| 6 Payroll | ✅ 10/11 | 6.6 inputs (08cb9cc), 6.7 run types (10/10), loans §6 shape OK; 6.5 async deferred |
| 7 Holidays | ✅ done | 7.3 countryCode (fdce518) |
| 8 Settings | ✅ done | renders live |
| 9 Reports/Analytics | ✅ screen-live | (export sync, not BullMQ) |
| 10 Permissions | ✅ done | roles-permissions live |
| 11 Cross-cutting | 🔶 11.1–11.3 done | 11.4/11.5 (BullMQ/Redis) deferred |
| 12 Hardening | 🔶 in progress | 12.2 done (auth 100%, tenant-isolation, RBAC, CVE triage, JWT_SECRET fail-closed); 12.1 started (KWD tenant + found/fixed INR hardcode 4dc855b); 12.3 deferred; 12.4 open |

**Two real bugs the truly-global QA caught & fixed:** leave `/leave/types` crash (7ceb119), payroll INR hardcode (4dc855b). **3 FE bugs filed** in `docs/FRONTEND_FOLLOWUPS.md` (not our side).

**Deferred by owner decision:** Redis/BullMQ → 6.5, 11.4, 11.5, 12.3.

---

## B. Work split (by module dir — DO NOT cross these lines)

### Agent A (me) — KEEP, do not touch:
`src/modules/payroll/`, `src/modules/leave/`, `src/modules/analytics/`, `src/modules/reports/`, and cross-cutting `src/config/`, `src/middleware/`, `src/plugins/`, `src/app.js`.
→ 12.1 truly-global UI QA + currency/locale fixes for the money modules; 12.4 reconcile payroll/leave contracts.

### Agent B (you) — OWN these, A will not touch:
`src/modules/attendance/`, `src/modules/timesheets/`, `src/modules/employees/`, `src/modules/departments/`, `src/modules/holidays/`, `src/modules/settings/`, `src/modules/recruitment/`, `src/modules/performance/`, `src/modules/assets/`, `src/modules/announcements/`, `src/modules/notifications/`, `src/modules/search/`, `src/modules/dashboard/`.
→ truly-global UI QA + work-week/locale/date fixes for these modules.

### Shared files — coordinate (append-only, rebase before commit):
`docs/API_MAPPING.md`, `src/plugins/swagger.js` (edit only YOUR module's section), `docs/FRONTEND_FOLLOWUPS.md` (append new FE-N rows), `docs/BACKEND_VERIFICATION_STATUS.md` (append your module rows). `graphify-out/` is generated — just run `graphify update .`, don't hand-resolve.

---

## C. Runtime isolation (critical — avoid stepping on each other)
- Agent A uses the shared backend on **:4000** + FE on **:3001** (already wired, MSW off).
- **Agent B: run your OWN isolated runtime** so restarts don't collide:
  - Backend: `cd EMS && PORT=4001 npm run dev` (uses `--watch`, hot-reloads your edits).
  - FE: second instance pointing at it — in `ems-frontend/.env.local` you can't share; instead start `API_BASE_URL=http://localhost:4001 NEXT_PUBLIC_USE_MOCKS=false pnpm dev -p 3002`.
  - Both hit the same Render DB — fine (row-level tenant isolation). **Additive-only, never delete/drop.**
- **Do NOT re-seed the KWD tenant** — it already exists (`kwd-litmus-001`, admin `admin@kwd.test` / `Password123!`). Reuse it for the non-default-currency litmus.

---

## D. The truly-global test bar (every module, before claiming done)
1. Log in (acme `hr@acme.test` for IST/INR; **`admin@kwd.test`** for KWD 3-decimal).
2. Open the screen with **MSW off**, fill a form / do the action (not just load).
3. Watch network + console: every `/api/*` call 2xx, **zero console errors**.
4. **Truly-global litmus:** at the KWD tenant, money must render `KD x.xxx` (3 decimals), dates/work-week per tenant config — **no hardcoded `₹` / 2dp / Mon-Fri / `if (country===...)`**.
5. Root-cause every defect as **backend** (fix in your module) or **frontend** (append to `FRONTEND_FOLLOWUPS.md`).
6. `npm run lint` green; update `API_MAPPING.md` + `swagger.js` for any shape change; ask owner to commit.

---

## E. Docs to read first (frontend repo `/Users/mohdsaeedafri/All-Code-Base/ems-frontend`)
1. `docs/CONTRACTS_INDEX.md` — screen ↔ contract ↔ status (the front door).
2. `docs/newreqphase3.md` — MSW-first wire specs (Domains F payroll / G timesheets / H leave / I holidays).
3. `docs/BACKEND_PORTING_GUIDE.md` §6 — known live divergences.
4. `docs/backend-handoff/SKILLS_SETUP.md` §3–4 — FE wiring + senior-QA browser protocol.
In the backend repo: `docs/BACKEND_VERIFICATION_STATUS.md`, `docs/FRONTEND_FOLLOWUPS.md`, `CLAUDE.md` (rules), and `graphify query "<question>"` before grepping.
