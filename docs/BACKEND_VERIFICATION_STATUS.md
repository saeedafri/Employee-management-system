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
| 4 Leave | ✅ code + screen-live | renders live, no API errors; per-field shape parity vs contract = spot-checked only |
| 5 Timesheets | ✅ code + screen-live | core + workflow extras render live, no errors |
| 6 Payroll | ✅ 10/11 | 6.6 from-leave/from-attendance DONE (commit 08cb9cc); **6.7 run types LIVE-verified** (BONUS/ARREARS/OFF_CYCLE/FNF/REVERSAL create+validation+reversal-linkage, no country hardcode); 6.5 async = deferred (see below) |
| 7 Holidays | ✅ done | 7.3 countryCode live-verified (commit fdce518) |
| 8 Settings | ✅ done | renders live (redirects to /settings/company-profile) |
| 9 Reports & Analytics | ✅ screen-live | no API errors; export is sync (not BullMQ) |
| 10 Permissions | ✅ done | roles-permissions live |
| 11 Cross-cutting | 🔶 11.1–11.3 done | 11.4 BullMQ jobs + 11.5 Redis cache = deferred |
| 12 Hardening | ❌ not done | 12.1 multi-country regression, 12.2 security review, 12.3 load-test, 12.4 reconcile |

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

## Genuine remaining work (honest)
1. **12.1** — full truly-global browser regression at non-default country/currency/work-week per module (only spot-proven, e.g. holidays countryCode at API level).
2. **12.2** — security review: authz on every one of the 390 routes, tenant isolation, secrets.
3. **Per-field shape parity** for MSW-shadowed modules (leave, payroll-extras, timesheet-workflow) vs their contracts — screens render, exhaustive field diff not done.
4. Frontend follow-ups in `FRONTEND_FOLLOWUPS.md` (not our side).

## Verified this session (live, MSW-off)
- **7.3** holidays `?countryCode=` (commit fdce518)
- **6.6** payroll inputs from-leave/from-attendance (commit 08cb9cc)
- **6.7** payroll run types — 10/10 live cases pass (BONUS, ARREARS, OFF_CYCLE ±params, FNF ±params, REVERSAL ±target/±state, invalid-type). No code change needed; already correct.
- Full 16-screen MSW-off sweep — zero API failures, zero console errors.
