# Local E2E — EMS backend (2026-10-17)

## Setup (all local)
- Postgres 16.14 (brew, existing binaries; nothing installed) via fresh `initdb` in scratchpad/pgdata, 127.0.0.1:54329, DB `ems_e2e_local`. DATABASE_URL exported + asserted (`*127.0.0.1*ems_e2e_local`) before every DB-touching command. `.env` DATABASE_URL never used. No Render/Hostinger/vercel URL touched.
- `prisma migrate deploy` (hook permits): all 29 migrations applied.
- Seeds NOT run: hook blocks `node prisma/seed*.js`. `scripts/seedLocalE2E.mjs`/`seedLocal.mjs`/`bootstrapLocalDev.mjs` are wrappers that import prisma/seed.js to dodge the text-match hook; I did NOT use them (would be a workaround). Instead: 2 tenants via public `POST /auth/register`, 4 employees each via API, and User rows (SUPER_ADMIN/HR_ADMIN/MANAGER/EMPLOYEE) inserted with Prisma into the throwaway DB (employee create does not create a login user without invite).
- Server: `node src/server.js` on :3987. `.env` has REDIS_URL=127.0.0.1:16379 (dead tunnel) -> first server run used it; second run exported `REDIS_URL=` (sync path).
- Scripts + raw output: scratchpad/*.mjs, e1_out.txt, p1.log.

## Blocked
- `npm test` -> blocked by ems-safety-guard (even with local DATABASE_URL). Not retried via `node scripts/runTests.mjs` (equivalent = workaround). Test suite results: NONE.
- Seeds: blocked (see above).

## Confirmed defects (evidence)
1. Rate limiting is entirely inert. 30 then 150 consecutive wrong-password `/auth/login` -> all 401, never 429, no x-ratelimit headers, correct password still works after. `/auth/register` (declared 5/15m) accepted 8 -> 201 x8; `/auth/forgot-password` (declared 5/15m) 8 x 202. Global 100/15m also absent (>250 req from one IP). Cause: plugin registered encapsulated (no fastify-plugin) + per-route `rateLimit:` key ignored. Brute force unthrottled.
2. Critical: `/ops/logs` and `/ops/process` readable by ANY SUPER_ADMIN, and SUPER_ADMIN is obtainable by unauthenticated `POST /auth/register` (201, no limit). A brand-new self-registered tenant read log rows of Alpha and Beta tenants ("SECRET-LOG-OF-Alpha Corp ... | Beta Corp") + process info. ops.routes.js findMany has no tenantId filter.
3. Cross-tenant FK references accepted:
   - B-HR `POST /payroll/employees/{B emp}/salary` with Alpha's payGroupId -> 201, response embeds Alpha's pay group.
   - B-HR `POST /payroll/groups` with Alpha's componentId -> 201.
   - A-HR `PATCH /employees/{A e2}` managerId = Beta manager -> 200.
   (Employee create with Beta dept/manager correctly 422.)
4. Payroll payslip mutable after run is PAID: HR `PATCH /payroll/runs/{PAID}/payslips/{id}` +50000 addition -> 200; payslip net 100000->150000, run totalNet stays 300000, employee sees 150000.
5. Employee can read own payslip while run is REVIEW (unapproved/unpublished): 200.
6. Payroll mid-run failure (DB trigger injected to fail one employee's Payslip insert): `calculate` returns 202 success; per-employee error swallowed into summary.warnings (raw Prisma/connector error text stored), run goes REVIEW with 2 of 3 employees and is APPROVABLE (200). calculatePayrollRun sets CALCULATING, deletes all payslips, then creates one by one with no transaction (code: payroll.repository.js ~863-1352). No hard fail, no recovery path: retry -> 400 "must be DRAFT" (only cancel works).
7. With REDIS_URL set but Redis unreachable, `POST /payroll/runs/:id/calculate` hangs indefinitely (>25s timeout, DB idle) — enqueueCalculate blocks; no timeout/fallback. (Env-specific, but availability coupling.)
8. Run dates are host-TZ dependent: period 2026-09 on IST host -> startDate 2026-08-31 (DB 2026-08-31T18:30Z). Likely fine on UTC prod; unverified.
9. Minor: B-HR GET `/payroll/employees/{A emp}/payout-methods` -> 200 empty (expected 404; no data leak). `PATCH /holidays/:id` cross-tenant returns HTTP 400 with code NOT_FOUND.

## Passed (no defect)
- Logins for SA/HR/MGR/EMP in both tenants 200; invalid/garbage/no token 401; token after logout 401.
- RBAC: EMP/MGR create/patch/delete employee 403; EMP sees only self in list, other employee GET 403; holidays create 403 for EMP; audit/analytics/settings/logs/roles-permissions 403 for EMP/MGR; payroll admin routes 403 for EMP/MGR; payslip read of another employee 403; e1 export 403.
- Cross-tenant negatives (employees/dept/holiday/leave approve/regularization/run get/calc/approve/payslip/export download/notifications/search/audit logs/list) all 404 or isolated; mass-assigned tenantId ignored; search injection harmless.
- Leave: policy seed + auto-assign -> EL 13.5; request 2d pending 2 -> approve used 2; overlap 400; over-balance 400; re-approve 409; withdraw approved 409; reject short comment 422; manager can approve only direct reports (NOT_TEAM_APPROVER 403).
- Attendance: check-in 201, duplicate 400, check-out 200, regularization 201 -> approve 200; team records EMP 403.
- Payroll single tenant: components, group, salaries, run create, calculate (1.2M CTC -> 100000/mo), REVIEW->approve->publish->mark-paid, payslip PDF 200, run CSV export; approve twice/recalc after approve 400.
- Exports: employees/attendance 202 -> SUCCESS, download own 200; other tenant 404.
- Notifications: unread-count, read, read-all; cross-user/tenant 404. Search 200.
- Not exercised: payout method create (country-bank-schemas is `payroll:super`, HR got 403), SSE stream, OTP/email flows, file upload.

## Cleanup
Server + Postgres stopped. DB data remains in scratchpad/pgdata. Repo untouched (git status shows only pre-existing untracked docs file).
