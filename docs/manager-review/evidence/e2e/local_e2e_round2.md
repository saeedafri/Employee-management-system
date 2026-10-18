# EMS local E2E, round 2 (2026-10-17)

Scope: local only. Throwaway Postgres 16 (127.0.0.1:54329, db `ems_e2e_local`, DATABASE_URL asserted before each DB command), server on :3987 with `REDIS_URL=` empty, `RESEND_API_KEY` unset, SMTP pointed at a local sink (127.0.0.1:2525, `deep2/smtp.mjs`; captured mails in `deep2/mail.txt`). No Render/Hostinger/onrender/vercel call. No repo file edited. The test runner and seeds were not run (hook-blocked; not worked around). Cloudinary never contacted (upload test used a loopback block preload on :3989, `deep2/block.mjs`). NOTE: a foreign process (pid 42793, port 3988, DB `ems_fe_local`) belongs to another session; I sent it one /health and one failed login by mistake before noticing, nothing else.

Fixtures: tenants IsoAlpha (A) and IsoBeta (B), each with SA/HR/MGR/E1/E2/E3 and objects for leave, attendance, regularization, holiday, components, pay group, salaries, payroll run+payslips, export job, loan, garnishment, pay calendar, tax declaration, timesheet+entry+template+project+task, delegation, webhook, role, scheduled report, comp-off, asset+request, opening+candidate, announcement, payout method, legal entity, stat pack. Scripts: `deep2/*.mjs`.

## 1. Tenant isolation

Result: every path-id route is isolated (B using A ids gets 404/403/409/422; a checksum of all 72 tenant tables for A was unchanged by B's calls). Isolation breaks only in foreign-key fields of bodies (no tenant check on referenced ids) plus one privilege path (X1). Full matrix at the end of this file (362 routes called, 8 not callable: SSE streams or no fixture creatable).

### Confirmed cross-tenant defects
| # | Call (as Beta) | Result | Impact |
|---|---|---|---|
| X1 | `POST /settings/roles/:key/users {userIds:[A user id]}` on a B role | 200, `UserRole` row links an Alpha user to a Beta role. Created B role `evil_b` with `payroll:super, audit:read, permissions:manage`; Alpha's EMPLOYEE e1 re-logged in with those permissions and got 200 on `GET /audit-logs`, `/settings/roles-permissions`, `/payroll/country-bank-schemas` in Alpha | Cross-tenant privilege escalation (needs victim user id; a self-registered tenant SUPER_ADMIN gives Beta full control of its roles) |
| X2 | `POST /employees {managerId: A mgr}` (B-HR) | 201, response embeds A manager name (`manager:{firstName:"Mgr",lastName:"A"}`), A id stored in B row. `PATCH /employees/:id managerId=A` also 200 (round 1) | name leak + FK pollution |
| X3 | `PATCH /assets/:id/assign {employeeId: A emp}` | 200; `GET /assets` in B then shows `assignedTo:{name:"E1 A"}` | A employee name leak |
| X4 | B-HR writes with an A employee as path id or body id: `POST /payroll/employees/{A}/salary` (B pay group), `/loans`, `/garnishments`, `/tax-declaration`, `/opening-balances`, `/payout-methods`; `POST /leave/ledger/adjust employeeId=A`; `POST /timesheets/entries {employeeId:A}` | 200/201, rows created in the B tenant referencing A employee ids | integrity pollution only; A's own rows and balances unchanged. Reads of A employee payslips/payout-methods/loans return 200 empty (not 404) |
| X5 | `POST /payroll/employees/{B}/salary payGroupId=A`, `POST /payroll/groups componentId=A`, `POST /payroll/pay-calendars legalEntityId=A`, `POST /payroll/runs employeeIds=[A]`, `POST /timesheets/delegations delegateId=A`, `POST /timesheets/projects memberIds=[A]`, announcement with A `channelId` | 201 each; salary response embeds A pay group (round 1) | FK pollution, small read leak |
| X6 | `PATCH /payroll/employees/{A}/tax-declaration`, `PATCH /timesheets/budgets/{A project}` | 200 (create B rows keyed by A ids) | pollution |

Good (blocked): employee create/patch with A `departmentId` 422; department parent/head A 400; timesheet entry with A project 404; comp-off, timesheet, leave, payroll-run actions on A ids 404/409; webhook to localhost 422 (https only).

Within-tenant: Alpha EMPLOYEE e2 against e1/HR ids over all 149 path-id routes: only `GET /payroll/payout-methods/:id` returned 200 (IDOR, see C16). Minor: `GET/DELETE /holidays/optional-selections*` as a SUPER_ADMIN without an employee record -> 500 with raw Prisma text; settings PATCH endpoints (`/payroll/settings/data-policy`, `/settings/attendance-rules`, `/settings/security/auth`, `/settings/notifications/preferences`, `/timesheets/rates-config`) store arbitrary body keys verbatim; a GET of payslip PDF by A lazily creates a `PayslipTemplate` row (read side effect).

## 2. Claim verification

| ID | Claim | Verdict | Evidence |
|---|---|---|---|
| C1 | Payslip visible to employee while run in REVIEW | CONFIRMED | run 2026-12 REVIEW; e1 `GET /payroll/employees/{e1}/payslips` 200 incl. `status:PENDING` row, detail 200, PDF download 200 (`%PDF`). e1 on `/payroll/runs/:id/payslips` 403 |
| C2 | Mid-calculation failure swallowed | CONFIRMED | trigger on Payslip insert raising for E2: `calculate` 202; run REVIEW with employeeCount 4 of 5; `warnings[0].message` holds raw Prisma/connector text; `approve` on the incomplete run 200 |
| C3 | Concurrent approve of same leave x20 double-posts | CONFIRMED | 7 of 20 got 200, 13 got 409. Ledger: 7 `LEAVE_TAKEN` (-14) + 7 `LEAVE_PENDING_RELEASE` (-14) vs 1 hold (-2); balance used 14 of 13.5 (available -0.5) |
| C4 | Concurrent calculate x5 | CONFIRMED (new detail) | statuses 400,202,202,202,202 (no lock). End state REVIEW with 5 unique payslips but run `totalGross/totalNet=0, employeeCount=0` (lost update); serial run gives 500000/498500/5 |
| C5 | Double withdraw | CONFIRMED | 10 parallel withdraw all 200; ledger shows 10 `LEAVE_PENDING_RELEASE` rows for 1 hold; sequential 3rd call 409. Balance endpoint hides it (derived) |
| C6 | Refresh-token double-use race | CONFIRMED | 10 parallel refresh with same cookie: 10x 200, 10 distinct new refresh cookies. A later sequential reuse -> 401 TOKEN_REUSE (family revoked after the fact). Cookies HttpOnly, SameSite=Strict (Secure not checked in dev) |
| C7 | Timesheet approvals list scope for manager | CONFIRMED (list only) | mgr `GET /timesheets/approvals` returned E2, E1 and **Hr A** (HR is not a report). Approving HR's timesheet is 403 NOT_TEAM_APPROVER |
| C8 | Manager `employeeId` leave filter bypass | CONFIRMED on one route | mgr `GET /leave/team/requests?employeeId={HR}` returns HR's leave (HR absent without the filter). `/leave/requests?employeeId=`, `/leave/team/calendar?employeeId=` ignore it (no leak). mgr approve of HR leave 403 |
| C9 | Terminated employee can still call APIs/refresh | CONFIRMED | `DELETE /employees/:id` (status TERMINATED) and `PATCH employmentStatus=TERMINATED`: user stays ACTIVE; old access token 200 on /auth/me, /leave/balance, POST check-in 201; refresh with pre-termination cookie 200; fresh login 200 |
| C10 | HR self-approval | CONFIRMED | HR approves own leave 200, own regularization 200, creates+calculates+approves a payroll run alone 200. MANAGER approving own leave 403 SELF_APPROVAL_FORBIDDEN; payout method self-approval by HR 403 |
| C11 | Back-dated attendance check-in | CONFIRMED | `POST /attendance/check-in {date}` by an EMPLOYEE: `2026-01-05` (9 months back), `2027-05-03` (future), `1999-01-01` all 201 and stored under that date |
| C12 | Leave 0001-9999 range stalls event loop | PARTIAL | `/leave/requests/preview`: 100y range 46 ms (/health stall 20 ms); 1000y 233 ms stall; 3800y 866 ms; 8000y 1.9 s stall; 5 parallel 8000y previews blocked the server ~9.2 s. Exact 0001-9999 (and 1900-9999) -> 500 with raw Prisma "Could not convert date" text, no stall. POST request with 100y range fails at balance check (400) |
| C13 | Open /auth/register abuse | CONFIRMED | 40 parallel anonymous registrations all 201 in 306 ms, each returns a SUPER_ADMIN access token, no throttle headers, no verification mail (sink empty), duplicate company name accepted, `<script>` company name stored verbatim. 60 parallel wrong-password logins all 401 (no lockout/429) |
| C14 | SSE connection cap | CONFIRMED (no cap) | 200 concurrent `/notifications/stream` from one user all 200; /health 1 ms and API 5 ms meanwhile; RSS 171 MB -> 241 MB. `/logs/stream` with `?token=` for HR -> 401 |
| C15 | File upload type/size/path traversal | PARTIAL | Storage not configured -> 503 before any validation. With dummy creds + blocked egress: documents endpoint has no type allowlist (`.exe`, `.html`, `../../../etc/passwd`, `..\..\boot.ini` all reach the storage call); storage key uses a generated id, so traversal names are only stored in `fileName` (stored unsanitised; not verifiable end-to-end without Cloudinary). 11 MB (limit 10 MB) -> 500 `UPLOAD_ERROR "request file too large"` (should be 413). Photo: text/html and svg 400, png-mime with HTML bytes 500. Regularization docs: exe 422 (allowlist works). Other-employee upload 403 |
| C16 | Payout-method creation | WORKS with `payout:self` | EMPLOYEE role holds `payout:self`: e2 creates own method 201 (PENDING_APPROVAL), for e1 403. Approval needs `payout:manage` (HR_ADMIN): e2 self-approve 403, HR approve 200 `{applied:true}`, HR approving own 403 SELF_APPROVAL_FORBIDDEN. `country-bank-schemas` needs `payroll:super`. Requires `PAYOUT_ENC_KEY` env (without it create -> 500). **New IDOR**: `GET /payroll/payout-methods/:id` returns 200 to any employee in the tenant (peer e1, e3, manager) with masked details (accountName, IFSC, bankName, last-4); only the owner sees full |
| C17 | OTP/MFA enrol+verify | WORKS with caveats | `PATCH /auth/me/mfa {enabled:true}` 200; login 202 `mfaRequired` + challenge; OTP mail captured by the sink (Resend not called); correct code -> tokens + cookies; replay 400 OTP_ALREADY_USED; 6 sequential wrong codes -> 5x 400 then 429 OTP_LOCKED. Defects: (a) `/auth/verify-otp` without `X-Tenant-Key` -> 500 (audit insert with null tenantId; even for the correct code); (b) 40 parallel wrong guesses on one challenge all 400 OTP_INVALID (attempt cap of 5 not enforced under concurrency); (c) rate-limit config inert (no 429 from limiter) |

## 3. Additional defects found while testing

| # | Finding | Evidence |
|---|---|---|
| N1 | **Job exports corrupt and can hang the whole API.** `exportJob.js` does `data.map(flattenObject)`, so the row index is passed as `prefix`: row i's keys become `i.firstName`, ... CSV for 300 employees has 4478 columns (4.1 MB, data on the diagonal); Excel keeps only row 1's headers so rows 2..N are blank. `csvHeaders` then does `keys.includes` over ~12xN keys (O(N^2)): attendance CSV 230 rows 4.4 s; 1.1k rows 11 s (3.7 s freeze); 2.3k rows 22 s (**14.9 s freeze**); 6.5k rows >=90 s (>=49.7 s freeze); 82k rows (12 months x 300) pinned the single node thread at 100% CPU for >15 min (/health unreachable, I killed the server). Any HR user can trigger it | files `/tmp/exports/a7d50c52-*.csv`, `4e5bbc12-*.xlsx`; macOS `sample` showed `Builtins_ArrayIncludesSmiOrObject` 100% of main thread |
| N2 | Concurrent `POST /employees` collides on employee code: with concurrency 10, 131 of 300 creates failed (400 `CREATE_ERROR` with raw Prisma unique-violation text, or 409 DUPLICATE_EMPLOYEE_CODE). Sequential: 300 in 20.8 s (69 ms each) | perf seed log |
| N3 | `GET /attendance/team/weekly` issues ~175 SQL queries per request for a manager with 29 reports (N+1); `GET /reports/attendance` loads a whole year (78k rows, `LIMIT 500001`) into memory and aggregates in Node: 668 ms single, 3.7 s p50 at c=10 | pg log |

## 4. Performance baseline (local, M-series Mac, 10 cores, Node single process, Postgres local)

Data: 300 employees (API, sequential), 300 salaries, 81,900 attendance rows (12 months, createMany directly into the throwaway DB), 1,801 leave requests (createMany + 1 API), 6 depts. Load: 60 requests at c=1, 300 at c=10 per endpoint, fetch-based script (`deep2/perf.mjs`). No endpoint returned an error.

Payroll and exports (single call, `deep2/perf2.mjs`, `perf3.mjs`):
- Payroll calculate, 300 employees, sync: 421 ms (202). Two concurrent calculates on separate runs: 454 ms total. Run read endpoints: payslips page 4 ms, register 12 ms, journal 12 ms (166 KB), variance 10 ms, bank-file 2 ms, approve 4 ms, publish 6 ms.
- Exports: employees csv 300 rows ok but corrupt (see N1); attendance csv 1 day 4.4 s, 1 week 11.2 s, 2 weeks 22.3 s, 1 month did not finish in 90 s, 12 months hung >15 min. The status poll in my script was wrong for the first two (waited 60 s), the file timestamps show the employee exports finished within seconds.

Slow queries (log_min_duration_statement=100 on the DB): only 4 statements over 100 ms, all `AttendanceRecord` year selects (max 148.6 ms cold, 20 ms warm). With threshold 0 per endpoint: DB time is small everywhere (reports/attendance 6 queries 20 ms; absenteeism 4 queries 23 ms; team/weekly 175 queries 3 ms; others <=3 ms). The latency is Node-side aggregation and per-row work, not SQL.

EXPLAIN (ANALYZE, BUFFERS) of the worst five:
1. reports/attendance year select (78,300 rows, ORDER BY date DESC LIMIT 500001): Index Scan Backward on `AttendanceRecord_tenantId_attendanceDate_idx`, 12.8 ms, 2,402 buffers. SQL is fine; the 668 ms is JS aggregation of 78k rows.
2. absenteeism per-employee status counts (6 months, 39,600 rows): Bitmap Heap Scan + HashAggregate, 8.9 ms.
3. team/weekly per-employee lookup (x175 per request): Index Scan on the unique (tenantId, employeeId, attendanceDate) key, 0.036 ms each; cost is the 175 round trips.
4. leave requests tenant+status+date window: Index Scan Backward on `LeaveRequest_tenantId_status_startDate_idx`, 0.077 ms.
5. export attendance (join Employee, no LIMIT, 81,900 rows): Index Scan Backward + nested index scan on Employee_pkey, ~25 ms; fetch is not the problem, the export builder (N1) is.
(AuditLog list uses `AuditLog_createdAt_idx` instead of the tenant+createdAt index but is 0.03 ms.)

Endpoint latency table (c=10 columns; ms):

| Endpoint | resp bytes | c=1 p50/p95 ms | c=10 p50 | p95 | p99 | max | err % | req/s |
|---|---|---|---|---|---|---|---|---|
| employees list limit=50 | 45264 | 3/5 | 10 | 14 | 16 | 21 | 0.0 | 950 |
| employees list limit=300 | skipped: HTTP 422 | | | | | | | |
| employees search | 18484 | 2/3 | 8 | 10 | 10 | 10 | 0.0 | 1197 |
| attendance records (own, month) | 2601 | 1/1 | 3 | 7 | 10 | 10 | 0.0 | 2964 |
| attendance team records (mgr, month) | 3453 | 1/2 | 5 | 6 | 7 | 7 | 0.0 | 2014 |
| attendance team weekly | 7296 | 9/26 | 68 | 81 | 87 | 88 | 0.0 | 143 |
| attendance calendar | 9251 | 2/3 | 7 | 15 | 36 | 37 | 0.0 | 1157 |
| attendance summary | 240 | 1/1 | 2 | 4 | 6 | 7 | 0.0 | 4057 |
| leave requests (hr) | 2236 | 1/1 | 3 | 5 | 8 | 9 | 0.0 | 2735 |
| leave team requests (mgr) | 4344 | 1/2 | 5 | 6 | 7 | 7 | 0.0 | 1977 |
| leave team calendar | 3567 | 1/1 | 4 | 5 | 5 | 6 | 0.0 | 2453 |
| leave balance | 668 | 1/1 | 4 | 4 | 5 | 5 | 0.0 | 2684 |
| leave ledger (hr) | 3385 | 1/1 | 3 | 4 | 4 | 4 | 0.0 | 3246 |
| analytics summary | 322 | 1/1 | 5 | 7 | 8 | 8 | 0.0 | 1818 |
| analytics attendance | 2524 | 14/14 | 75 | 162 | 208 | 252 | 0.0 | 111 |
| analytics headcount-by-dept | 726 | 1/3 | 4 | 6 | 7 | 7 | 0.0 | 2230 |
| analytics leave-summary | 145 | 1/1 | 3 | 4 | 6 | 7 | 0.0 | 3360 |
| analytics workforce-trend | 639 | 2/2 | 8 | 13 | 14 | 15 | 0.0 | 1113 |
| analytics attrition | 506 | 1/2 | 7 | 14 | 38 | 39 | 0.0 | 1141 |
| analytics payroll-cost | 867 | 2/3 | 7 | 10 | 11 | 11 | 0.0 | 1381 |
| analytics dept-performance | 1077 | 14/16 | 49 | 95 | 117 | 139 | 0.0 | 187 |
| analytics recent-activity | 6484 | 2/3 | 9 | 14 | 17 | 18 | 0.0 | 1060 |
| reports attendance | 1304 | 685/892 | 3729 | 4560 | 4816 | 4987 | 0.0 | 3 |
| reports leaves | 957 | 33/36 | 202 | 294 | 319 | 336 | 0.0 | 49 |
| reports attendance summary | 4915 | 7/9 | 32 | 47 | 62 | 72 | 0.0 | 300 |
| reports absenteeism | 45915 | 110/144 | 884 | 1316 | 1576 | 1862 | 0.0 | 11 |
| reports headcount | 1504 | 2/3 | 12 | 17 | 20 | 20 | 0.0 | 838 |
| reports turnover | 847 | 2/3 | 11 | 15 | 17 | 18 | 0.0 | 919 |
| search | 414 | 2/3 | 8 | 10 | 10 | 10 | 0.0 | 1199 |
| manager dashboard | 291 | 2/4 | 7 | 10 | 11 | 11 | 0.0 | 1327 |
| manager team | 6481 | 1/2 | 6 | 6 | 7 | 7 | 0.0 | 1818 |
| manager team attendance | 2343 | 2/3 | 5 | 6 | 7 | 7 | 0.0 | 2067 |
| manager approvals | 234 | 2/2 | 9 | 11 | 12 | 12 | 0.0 | 1085 |
| employee dashboard | 310 | 2/2 | 7 | 14 | 21 | 23 | 0.0 | 1354 |
| employee team | 584 | 1/2 | 5 | 7 | 8 | 9 | 0.0 | 1804 |
| audit-logs | 2717 | 1/1 | 4 | 5 | 6 | 6 | 0.0 | 2656 |
| payroll runs list | 106 | 1/1 | 4 | 5 | 6 | 7 | 0.0 | 2304 |
| payroll employees | 93525 | 10/12 | 40 | 52 | 63 | 67 | 0.0 | 253 |
| payroll cost-summary | 299 | 8/10 | 31 | 48 | 52 | 57 | 0.0 | 305 |
| payroll roster | 28425 | 5/6 | 17 | 23 | 28 | 30 | 0.0 | 558 |
| timesheets approvals | 26 | 1/1 | 3 | 5 | 5 | 5 | 0.0 | 2917 |
| notifications | 125 | 1/2 | 4 | 6 | 6 | 7 | 0.0 | 2494 |
| holidays | 73 | 1/1 | 3 | 4 | 4 | 6 | 0.0 | 3804 |
| departments | 2569 | 1/1 | 4 | 5 | 7 | 7 | 0.0 | 2347 |

## Appendix: full isolation matrices

### Cross-tenant matrix (attacker = Beta SUPER_ADMIN, victim = Alpha ids)
Routes enumerated from route manifest: 370 entries; called: 362; not callable (no fixture / SSE): 8.
Status distribution: {"200":178,"201":2,"202":1,"400":10,"404":108,"406":1,"409":7,"422":48,"500":7}

| Method | Path | A-ctrl | B status | code | A data leaked | A rows mutated |
|---|---|---|---|---|---|---|
| GET | /analytics/attendance | - | 200 |  | no | no |
| GET | /analytics/attrition | - | 200 |  | no | no |
| GET | /analytics/department-performance | - | 200 |  | no | no |
| GET | /analytics/headcount-by-department | - | 200 |  | no | no |
| GET | /analytics/leave-summary | - | 200 |  | no | no |
| GET | /analytics/payroll-cost | - | 200 |  | no | no |
| GET | /analytics/recent-activity | - | 200 |  | no | no |
| GET | /analytics/summary | - | 200 |  | no | no |
| GET | /analytics/workforce-trend | - | 200 |  | no | no |
| GET | /announcements | - | 200 |  | no | no |
| GET | /announcements/channels | - | 200 |  | no | no |
| GET | /announcements/events | - | 200 |  | no | no |
| GET | /assets | - | 200 |  | no | no |
| GET | /assets/employees | - | 200 |  | no | no |
| GET | /assets/export | - | 200 |  | no | no |
| GET | /assets/requests | - | 200 |  | no | no |
| GET | /assets/summary | - | 200 |  | no | no |
| GET | /attendance/calendar | - | 200 |  | no | no |
| GET | /attendance/records | - | 404 | EMPLOYEE_NOT_FOUND | no | no |
| GET | /attendance/regularization | - | 200 |  | no | no |
| GET | /attendance/summary | - | 404 | EMPLOYEE_NOT_FOUND | no | no |
| GET | /attendance/team/records | - | 404 | EMPLOYEE_NOT_FOUND | no | no |
| GET | /attendance/team/regularization | - | 404 | EMPLOYEE_NOT_FOUND | no | no |
| GET | /attendance/team/weekly | - | 200 |  | no | no |
| GET | /audit-logs | - | 200 |  | no | no |
| GET | /audit-logs/:id | 200 | 404 | NOT_FOUND | no | no |
| GET | /audit-logs/export | - | 200 |  | no | no |
| GET | /auth/invitation | - | 422 | VALIDATION_ERROR | no | no |
| GET | /auth/me | - | 200 |  | no | no |
| GET | /auth/password-policy | - | 200 |  | no | no |
| GET | /auth/permission-manifest | - | 200 |  | no | no |
| GET | /auth/sessions | - | 200 |  | no | no |
| GET | /auth/validate-reset-token | - | 422 | VALIDATION_ERROR | no | no |
| GET | /billing/invoices | - | 200 |  | no | no |
| GET | /billing/invoices/export | - | 200 |  | no | no |
| GET | /billing/plans | - | 200 |  | no | no |
| GET | /billing/subscription | - | 200 |  | no | no |
| GET | /employee/documents | - | 200 |  | no | no |
| GET | /employee/team | - | 200 |  | no | no |
| GET | /employees/:id/attendance/calendar | 422 | 404 | EMPLOYEE_NOT_FOUND | no | no |
| GET | /employees/:id/holidays | 200 | 404 | NOT_FOUND | no | no |
| GET | /employees/me/documents | - | 200 |  | no | no |
| GET | /employees/me/team | - | 200 |  | no | no |
| GET | /export/:job_id/download | 200 | 404 | NOT_FOUND | no | no |
| GET | /export/list | - | 200 |  | no | no |
| GET | /holidays/import/:jobId/preview | 404 | 404 | JOB_NOT_FOUND | no | no |
| GET | /holidays/optional-selections | - | 500 | INTERNAL_ERROR | no | no |
| GET | /holidays/policy | - | 200 |  | no | no |
| GET | /leave/assignments | - | 200 |  | no | no |
| GET | /leave/balance | - | 200 |  | no | no |
| GET | /leave/balance/me | - | 200 |  | no | no |
| GET | /leave/comp-off/requests | - | 200 |  | no | no |
| GET | /leave/comp-off/types | - | 200 |  | no | no |
| GET | /leave/ledger | - | 200 |  | no | no |
| GET | /leave/policies | - | 200 |  | no | no |
| GET | /leave/policy-packs/catalog | - | 200 |  | no | no |
| GET | /leave/requests | - | 200 |  | no | no |
| GET | /leave/team/calendar | - | 200 |  | no | no |
| GET | /leave/team/coverage | - | 422 | VALIDATION_ERROR | no | no |
| GET | /leave/team/requests | - | 200 |  | no | no |
| GET | /leave/types | - | 200 |  | no | no |
| GET | /logs | - | 200 |  | no | no |
| GET | /logs/:id | - | skip: no A fixture: logEntry,unresolved /logs/ |  | no | no |
| GET | /logs/export | - | 200 |  | no | no |
| GET | /logs/stream | - | skip: skipped(SSE) |  | no | no |
| GET | /me/holidays | - | 200 |  | see notes (1) | no |
| GET | /notifications | - | 200 |  | no | no |
| GET | /notifications/stream | - | skip: skipped(SSE) |  | no | no |
| GET | /notifications/unread-count | - | 200 |  | no | no |
| GET | /ops/logs | - | 404 |  | no | no |
| GET | /ops/process | - | 404 |  | no | no |
| GET | /payroll/components | - | 200 |  | no | no |
| GET | /payroll/contractor-invoices | - | 200 |  | no | no |
| GET | /payroll/cost-summary | - | 200 |  | no | no |
| GET | /payroll/countries | - | 200 |  | no | no |
| GET | /payroll/countries/:code/bank-schema | 200 | 200 |  | no | no |
| GET | /payroll/country-bank-schemas | - | 200 |  | no | no |
| GET | /payroll/country-bank-schemas/:country | 200 | 200 |  | no | no |
| GET | /payroll/employees | - | 200 |  | no | no |
| GET | /payroll/employees/:employeeId/payout-methods | 200 | 200 |  | no | no |
| GET | /payroll/employees/:employeeId/payslips | 200 | 200 |  | no | no |
| GET | /payroll/employees/:employeeId/payslips/:payslipId | 404 | 404 | NOT_FOUND | no | no |
| GET | /payroll/employees/:employeeId/payslips/:payslipId/download | 404 | 404 | NOT_FOUND | no | no |
| GET | /payroll/employees/:employeeId/salary | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/employees/:employeeId/tax-forms/:formId/download | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/employees/:id/garnishments | 200 | 200 |  | no | no |
| GET | /payroll/employees/:id/loans | 200 | 200 |  | no | no |
| GET | /payroll/employees/:id/opening-balances | 200 | 200 |  | no | no |
| GET | /payroll/employees/:id/tax-declaration | 200 | 200 |  | no | no |
| GET | /payroll/employees/:id/tax-form | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/employees/:id/ytd | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/event-catalogue | - | 200 |  | no | no |
| GET | /payroll/events | - | 200 |  | no | no |
| GET | /payroll/groups | - | 200 |  | no | no |
| GET | /payroll/legal-entities | - | 200 |  | no | no |
| GET | /payroll/me/payout-methods | - | 200 |  | no | no |
| GET | /payroll/migration | - | 200 |  | no | no |
| GET | /payroll/migration/historical-payslips | - | 200 |  | no | no |
| GET | /payroll/migration/status | - | 200 |  | no | no |
| GET | /payroll/opening-balances | - | 200 |  | no | no |
| GET | /payroll/pay-calendars | - | 200 |  | no | no |
| GET | /payroll/pay-calendars/:id/cycles | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/payment-batches | - | 200 |  | no | no |
| GET | /payroll/payment-batches/:id/status | - | skip: no A fixture: batch,unresolved /payroll/ |  | no | no |
| GET | /payroll/payout-methods/:id | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/payout-methods/approvals | - | 200 |  | no | no |
| GET | /payroll/payout-methods/unverified | - | 200 |  | no | no |
| GET | /payroll/payslip-templates | - | 200 |  | no | no |
| GET | /payroll/reimbursement-categories | - | 200 |  | no | no |
| GET | /payroll/reimbursement-claims | - | 200 |  | no | no |
| GET | /payroll/reports | - | 200 |  | no | no |
| GET | /payroll/reports/audit-pack | - | 404 | NOT_FOUND | no | no |
| GET | /payroll/reports/pay-equity | - | 200 |  | no | no |
| GET | /payroll/roster | - | 200 |  | no | no |
| GET | /payroll/runs | - | 200 |  | no | no |
| GET | /payroll/runs/:id | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:id/audit | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:id/bank-file | 200 | 200 |  | no | no |
| GET | /payroll/runs/:id/fnf | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:id/journal | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:id/journal/export | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:id/payment-batch | 200 | 200 |  | no | no |
| GET | /payroll/runs/:id/register | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:id/register/export | 200 | 200 |  | no | no |
| GET | /payroll/runs/:id/statutory-return | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:id/variance | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:runId/export | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:runId/inputs | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:runId/payslips | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:runId/payslips/:payslipId | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/runs/:runId/payslips/:payslipId/download | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/schedules | - | 200 |  | no | no |
| GET | /payroll/settings | - | 200 |  | see notes (4) | no |
| GET | /payroll/settings/data-policy | - | 200 |  | see notes (4) | no |
| GET | /payroll/statutory-packs | - | 200 |  | no | no |
| GET | /payroll/statutory-packs/:id | 200 | 404 | NOT_FOUND | no | no |
| GET | /payroll/workers | - | 200 |  | no | no |
| GET | /performance/calibration | - | 200 |  | no | no |
| GET | /performance/cycles/active | - | 200 |  | no | no |
| GET | /performance/employees | - | 200 |  | no | no |
| GET | /performance/export | - | 200 |  | no | no |
| GET | /performance/goals | - | 200 |  | no | no |
| GET | /performance/reviews | - | 200 |  | no | no |
| GET | /performance/summary | - | 200 |  | no | no |
| GET | /recruitment/candidates | - | 200 |  | no | no |
| GET | /recruitment/export | - | 200 |  | no | no |
| GET | /recruitment/openings | - | 200 |  | no | no |
| GET | /recruitment/recruiters | - | 200 |  | no | no |
| GET | /recruitment/summary | - | 200 |  | no | no |
| GET | /reports/attendance | - | 200 |  | no | no |
| GET | /reports/attendance/absenteeism | - | 200 |  | no | no |
| GET | /reports/attendance/summary | - | 200 |  | no | no |
| GET | /reports/export-history | - | 200 |  | no | no |
| GET | /reports/export/:jobId | 404 | 404 | NOT_FOUND | no | no |
| GET | /reports/export/:jobId/download | 404 | 404 | NOT_FOUND | no | no |
| GET | /reports/export/:jobId/status | 404 | 404 | NOT_FOUND | no | no |
| GET | /reports/leave/pending | - | 200 |  | no | no |
| GET | /reports/leave/utilization | - | 200 |  | no | no |
| GET | /reports/leaves | - | 200 |  | no | no |
| GET | /reports/payroll | - | 422 | VALIDATION_ERROR | no | no |
| GET | /reports/payroll/ctc-analysis | - | 200 |  | no | no |
| GET | /reports/payroll/summary | - | 200 |  | no | no |
| GET | /reports/scheduled | - | 200 |  | no | no |
| GET | /reports/workforce/demographics | - | 200 |  | no | no |
| GET | /reports/workforce/headcount | - | 200 |  | no | no |
| GET | /reports/workforce/turnover | - | 200 |  | no | no |
| GET | /search | - | 422 | VALIDATION_ERROR | no | no |
| GET | /settings/attendance-rules | - | 200 |  | see notes (4) | no |
| GET | /settings/branding | - | 200 |  | no | no |
| GET | /settings/email-templates | - | 200 |  | no | no |
| GET | /settings/integrations/email | - | 200 |  | no | no |
| GET | /settings/integrations/email/stats | - | 200 |  | no | no |
| GET | /settings/integrations/storage | - | 200 |  | no | no |
| GET | /settings/leave-types | - | 200 |  | no | no |
| GET | /settings/notifications/preferences | - | 200 |  | see notes (4) | no |
| GET | /settings/roles-permissions | - | 200 |  | no | no |
| GET | /settings/security/auth | - | 200 |  | see notes (4) | no |
| GET | /settings/tenant | - | 200 |  | no | no |
| GET | /settings/webhooks | - | 200 |  | no | no |
| GET | /timesheets | - | 200 |  | no | no |
| GET | /timesheets/approval-chain | - | 200 |  | no | no |
| GET | /timesheets/approvals | - | 200 |  | no | no |
| GET | /timesheets/audit | - | 200 |  | no | no |
| GET | /timesheets/budgets | - | 200 |  | no | no |
| GET | /timesheets/cost-rates | - | 200 |  | no | no |
| GET | /timesheets/delegations | - | 200 |  | see notes (1) | no |
| GET | /timesheets/locks | - | 200 |  | no | no |
| GET | /timesheets/projects | - | 200 |  | no | no |
| GET | /timesheets/projects/:id/tasks | 200 | 404 | NOT_FOUND | no | no |
| GET | /timesheets/rates-config | - | 200 |  | see notes (4) | no |
| GET | /timesheets/settings | - | 200 |  | no | no |
| GET | /timesheets/summary | - | 200 |  | no | no |
| GET | /timesheets/templates | - | 200 |  | no | no |
| GET | /timesheets/week-config | - | 200 |  | no | no |
| PATCH | /announcements/:id | - | 404 | NOT_FOUND | no | PayslipTemplate |
| PATCH | /announcements/:id/pin | - | 404 | NOT_FOUND | no | no |
| PATCH | /announcements/:id/unpin | - | 404 | NOT_FOUND | no | no |
| PATCH | /assets/:id/assign | - | 404 | NOT_FOUND | no | no |
| PATCH | /assets/:id/recall | - | 404 | NOT_FOUND | no | no |
| PATCH | /assets/:id/status | - | 404 | NOT_FOUND | no | no |
| PATCH | /assets/requests/:id/approve | - | 404 | NOT_FOUND | no | no |
| PATCH | /assets/requests/:id/decline | - | 404 | NOT_FOUND | no | no |
| PATCH | /attendance/regularization/:id/approve | - | 404 | REGULARIZATION_NOT_FOUND | no | no |
| PATCH | /attendance/regularization/:id/deny | - | 422 | VALIDATION_ERROR | no | no |
| PATCH | /auth/me/mfa | - | 422 | VALIDATION_ERROR | no | no |
| PATCH | /holidays/policy | - | 422 | VALIDATION_ERROR | no | no |
| PATCH | /leave/policies/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /leave/requests/:id/approve | - | 404 | LEAVE_REQUEST_NOT_FOUND | no | no |
| PATCH | /leave/requests/:id/reject | - | 404 | LEAVE_REQUEST_NOT_FOUND | no | no |
| PATCH | /leave/requests/:id/withdraw | - | 404 | LEAVE_REQUEST_NOT_FOUND | no | no |
| PATCH | /leave/types/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /notifications/:id/read | - | 404 | NOT_FOUND | no | no |
| PATCH | /notifications/read-all | - | 200 |  | no | no |
| PATCH | /payroll/components/:id | - | 400 | CODE_IMMUTABLE | no | no |
| PATCH | /payroll/contractor-invoices/:id | - | skip: no A fixture: invoice,unresolved /payrol |  | no | no |
| PATCH | /payroll/country-bank-schemas/:country | - | 404 | NOT_FOUND | no | no |
| PATCH | /payroll/employees/:employeeId/salary | - | 422 | NO_ACTIVE_SALARY | no | no |
| PATCH | /payroll/employees/:id/garnishments/:garnishmentId | - | 404 | NOT_FOUND | no | no |
| PATCH | /payroll/employees/:id/loans/:loanId | - | 404 | NOT_FOUND | no | no |
| PATCH | /payroll/employees/:id/tax-declaration | - | 200 |  | no | no |
| PATCH | /payroll/groups/:id | - | 400 | CODE_IMMUTABLE | no | no |
| PATCH | /payroll/legal-entities/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /payroll/migration/status | - | 200 |  | no | no |
| PATCH | /payroll/pay-calendars/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /payroll/payslip-templates | - | 200 |  | no | no |
| PATCH | /payroll/reimbursement-claims/:id | - | skip: no A fixture: claim,unresolved /payroll/ |  | no | no |
| PATCH | /payroll/runs/:id/mark-paid | - | 404 | NOT_FOUND | no | no |
| PATCH | /payroll/runs/:runId/inputs/:employeeId | - | 404 | NOT_FOUND | no | no |
| PATCH | /payroll/runs/:runId/payslips/:payslipId | - | 404 | NOT_FOUND | no | no |
| PATCH | /payroll/settings/data-policy | - | 200 |  | no | no |
| PATCH | /payroll/statutory-packs/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /payroll/workers/:id | - | skip: no A fixture: worker,unresolved /payroll |  | no | no |
| PATCH | /performance/reviews/:employeeId | - | 422 | VALIDATION_ERROR | no | no |
| PATCH | /recruitment/candidates/:id/rating | - | 404 | NOT_FOUND | no | no |
| PATCH | /recruitment/openings/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /reports/scheduled/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /settings/attendance-rules | - | 200 |  | no | no |
| PATCH | /settings/branding | - | 200 |  | no | no |
| PATCH | /settings/email-templates/:type | - | 422 | VALIDATION_ERROR | no | no |
| PATCH | /settings/integrations/email | - | 200 |  | no | no |
| PATCH | /settings/integrations/storage | - | 200 |  | no | no |
| PATCH | /settings/leave-types/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /settings/notifications/preferences | - | 200 |  | no | no |
| PATCH | /settings/roles-permissions | - | 422 | VALIDATION_ERROR | no | no |
| PATCH | /settings/security/auth | - | 200 |  | no | no |
| PATCH | /settings/tenant | - | 200 |  | no | no |
| PATCH | /settings/webhooks/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /timesheets/approval-chain | - | 200 |  | no | no |
| PATCH | /timesheets/budgets/:projectId | - | 200 |  | no | no |
| PATCH | /timesheets/cost-rates/:employeeId | - | 422 | VALIDATION_ERROR | no | no |
| PATCH | /timesheets/entries/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /timesheets/projects/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /timesheets/rates-config | - | 200 |  | no | no |
| PATCH | /timesheets/settings | - | 500 | INTERNAL_SERVER_ERROR | no | no |
| PATCH | /timesheets/tasks/:id | - | 404 | NOT_FOUND | no | no |
| PATCH | /timesheets/templates/:id | - | 400 | NO_EMPLOYEE | no | no |
| POST | /announcements | - | 422 | VALIDATION_ERROR | no | no |
| POST | /announcements/events | - | 422 | VALIDATION_ERROR | no | no |
| POST | /assets | - | 422 | VALIDATION_ERROR | no | no |
| POST | /attendance/check-in | - | 400 | NO_EMPLOYEE_RECORD | no | no |
| POST | /attendance/check-out | - | 400 | NO_EMPLOYEE_RECORD | no | no |
| POST | /attendance/regularization | - | 422 | VALIDATION_ERROR | no | no |
| POST | /attendance/regularization/:id/documents | - | 400 | NO_EMPLOYEE_RECORD | no | no |
| POST | /audit-logs/dpia-report | - | 200 |  | no | no |
| POST | /auth/invitation/resend | - | 422 | VALIDATION_ERROR | no | no |
| POST | /auth/logout | - | 200 |  | no | no |
| POST | /auth/logout-all | - | 200 |  | no | no |
| POST | /export/attendance | - | 202 |  | no | no |
| POST | /export/employees | - | 422 | VALIDATION_ERROR | no | no |
| POST | /export/leave | - | 422 | VALIDATION_ERROR | no | no |
| POST | /holidays/import | - | 406 | FST_INVALID_MULTIPART_CONTENT_TYPE | no | no |
| POST | /holidays/import/:jobId/commit | - | 404 | JOB_NOT_FOUND | no | no |
| POST | /holidays/optional-selections | - | 422 | VALIDATION_ERROR | no | no |
| POST | /leave/assignments/auto-assign | - | 200 |  | no | no |
| POST | /leave/comp-off/requests | - | 422 | VALIDATION_ERROR | no | no |
| POST | /leave/comp-off/requests/:id/approve | - | 409 | INVALID_STATE | no | no |
| POST | /leave/comp-off/requests/:id/reject | - | 409 | INVALID_STATE | no | no |
| POST | /leave/encashment | - | 422 | VALIDATION_ERROR | no | no |
| POST | /leave/ledger/adjust | - | 422 | VALIDATION_ERROR | no | no |
| POST | /leave/policies | - | 422 | VALIDATION_ERROR | no | no |
| POST | /leave/policies/:id/new-version | - | 404 | NOT_FOUND | no | no |
| POST | /leave/policies/:id/publish | - | 409 | INVALID_STATE | no | no |
| POST | /leave/policy-packs/seed | - | 200 |  | no | no |
| POST | /leave/requests | - | 500 | INTERNAL_SERVER_ERROR | no | no |
| POST | /leave/requests/bulk-approve | - | 200 |  | no | no |
| POST | /leave/requests/bulk-deny | - | 200 |  | no | no |
| POST | /leave/requests/bulk/approve | - | 200 |  | no | no |
| POST | /leave/requests/bulk/reject | - | 200 |  | no | no |
| POST | /leave/requests/preview | - | 200 |  | no | no |
| POST | /leave/types | - | 409 | DUPLICATE_LEAVE_TYPE_CODE | no | no |
| POST | /notifications/:id/read | - | 404 | NOT_FOUND | no | no |
| POST | /notifications/read-all | - | 200 |  | no | no |
| POST | /payroll/components | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/contractor-invoices | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/country-bank-schemas | - | 500 | INTERNAL_ERROR | see notes (1) | no |
| POST | /payroll/employees/:employeeId/payout-methods | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/employees/:employeeId/salary | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/employees/:id/garnishments | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/employees/:id/loans | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/employees/:id/opening-balances | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/employees/:id/tax-declaration | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/groups | - | 409 | CODE_EXISTS | no | no |
| POST | /payroll/legal-entities | - | 201 |  | no | no |
| POST | /payroll/migration/historical-payslips | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/pay-calendars | - | 500 | P2002 | no | no |
| POST | /payroll/payment-batches/:id/reconcile | - | skip: no A fixture: batch,unresolved /payroll/ |  | no | no |
| POST | /payroll/payout-methods/:id/archive | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/payout-methods/:id/set-primary | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/payout-methods/:id/verify | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/payout-methods/approvals/:id/approve | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/payout-methods/approvals/:id/reject | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/reimbursement-claims | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/runs | - | 409 | RUN_EXISTS | no | no |
| POST | /payroll/runs/:id/approvals/:level | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:id/approve | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:id/calculate | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:id/cancel | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:id/inputs/from-attendance | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:id/inputs/from-leave | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:id/inputs/from-timesheets | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:id/parallel-reconcile | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/runs/:id/payment-batch | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:id/payslips/:payslipId/recalculate | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:id/publish | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:runId/inputs/import | - | 422 | VALIDATION_ERROR | no | no |
| POST | /payroll/runs/:runId/payslips/:payslipId/hold | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/runs/:runId/payslips/:payslipId/release | - | 404 | NOT_FOUND | no | no |
| POST | /payroll/statutory-packs | - | 422 | VALIDATION_ERROR | no | no |
| POST | /performance/goals | - | 422 | VALIDATION_ERROR | no | no |
| POST | /recruitment/candidates/:id/advance | - | 422 | VALIDATION_ERROR | no | no |
| POST | /recruitment/openings | - | 422 | VALIDATION_ERROR | no | no |
| POST | /reports/export | - | 422 | VALIDATION_ERROR | no | no |
| POST | /reports/schedule | - | 422 | VALIDATION_ERROR | no | no |
| POST | /settings/integrations/email/test | - | 200 |  | no | no |
| POST | /settings/integrations/storage/test | - | 200 |  | no | no |
| POST | /settings/leave-types | - | 409 | DUPLICATE_LEAVE_TYPE_CODE | no | no |
| POST | /settings/roles | - | 422 | VALIDATION_ERROR | no | no |
| POST | /settings/roles/:key/users | - | 404 | NOT_FOUND | no | no |
| POST | /settings/webhooks | - | 422 | INVALID_WEBHOOK_URL | no | no |
| POST | /settings/webhooks/:id/test | - | 404 | NOT_FOUND | no | no |
| POST | /timesheets/:id/approve | - | 404 | NOT_FOUND | no | no |
| POST | /timesheets/:id/recall | - | 404 | NOT_FOUND | no | no |
| POST | /timesheets/:id/reject | - | 404 | NOT_FOUND | no | no |
| POST | /timesheets/:id/submit | - | 404 | NOT_FOUND | no | no |
| POST | /timesheets/copy-week | - | 422 | VALIDATION_ERROR | no | no |
| POST | /timesheets/delegations | - | 201 |  | no | no |
| POST | /timesheets/entries | - | 400 | NO_EMPLOYEE | no | no |
| POST | /timesheets/locks | - | 200 |  | no | no |
| POST | /timesheets/projects | - | 500 | INTERNAL_SERVER_ERROR | no | no |
| POST | /timesheets/projects/:id/tasks | - | 404 | NOT_FOUND | no | no |
| POST | /timesheets/templates | - | 400 | NO_EMPLOYEE | no | no |
| POST | /timesheets/templates/:id/apply | - | 400 | NO_EMPLOYEE | no | no |
| DELETE | /announcements/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /auth/sessions/:sessionId | - | 404 | SESSION_NOT_FOUND | no | no |
| DELETE | /holidays/optional-selections/:holidayId | - | 500 | INTERNAL_ERROR | see notes (1) | no |
| DELETE | /leave/types/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /payroll/components/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /payroll/country-bank-schemas/:country | - | 200 |  | no | no |
| DELETE | /payroll/employees/:id/garnishments/:garnishmentId | - | 404 | NOT_FOUND | no | no |
| DELETE | /payroll/groups/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /payroll/statutory-packs/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /reports/scheduled/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /settings/leave-types/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /settings/roles/:key | - | 404 | NOT_FOUND | no | no |
| DELETE | /settings/webhooks/:id | - | 200 |  | no | no |
| DELETE | /timesheets/delegations/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /timesheets/entries/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /timesheets/locks/:id | - | 200 |  | no | no |
| DELETE | /timesheets/projects/:id | - | 404 | NOT_FOUND | no | no |
| DELETE | /timesheets/templates/:id | - | 400 | NO_EMPLOYEE | no | no |

### Within-tenant matrix (attacker = Alpha EMPLOYEE e2, resources of e1/HR/other, path-id routes only)
| Method | Path | status | code |
|---|---|---|---|
| GET | /audit-logs/:id | 403 | FORBIDDEN |
| GET | /employees/:id/attendance/calendar | 403 | FORBIDDEN |
| GET | /employees/:id/holidays | 403 | FORBIDDEN |
| GET | /export/:job_id/download | 403 | FORBIDDEN |
| GET | /holidays/import/:jobId/preview | 403 | FORBIDDEN |
| GET | /payroll/countries/:code/bank-schema | 200 |  |
| GET | /payroll/country-bank-schemas/:country | 403 | FORBIDDEN |
| GET | /payroll/employees/:employeeId/payout-methods | 403 | FORBIDDEN |
| GET | /payroll/employees/:employeeId/payslips | 403 | FORBIDDEN |
| GET | /payroll/employees/:employeeId/payslips/:payslipId | 403 | FORBIDDEN |
| GET | /payroll/employees/:employeeId/payslips/:payslipId/download | 403 | FORBIDDEN |
| GET | /payroll/employees/:employeeId/salary | 403 | FORBIDDEN |
| GET | /payroll/employees/:employeeId/tax-forms/:formId/download | 403 | FORBIDDEN |
| GET | /payroll/employees/:id/garnishments | 403 | FORBIDDEN |
| GET | /payroll/employees/:id/loans | 403 | FORBIDDEN |
| GET | /payroll/employees/:id/opening-balances | 403 | FORBIDDEN |
| GET | /payroll/employees/:id/tax-declaration | 403 | FORBIDDEN |
| GET | /payroll/employees/:id/tax-form | 403 | FORBIDDEN |
| GET | /payroll/employees/:id/ytd | 403 | FORBIDDEN |
| GET | /payroll/pay-calendars/:id/cycles | 403 | FORBIDDEN |
| GET | /payroll/payout-methods/:id | 200 |  |
| GET | /payroll/runs/:id | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/audit | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/bank-file | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/fnf | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/journal | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/journal/export | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/payment-batch | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/register | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/register/export | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/statutory-return | 403 | FORBIDDEN |
| GET | /payroll/runs/:id/variance | 403 | FORBIDDEN |
| GET | /payroll/runs/:runId/export | 403 | FORBIDDEN |
| GET | /payroll/runs/:runId/inputs | 403 | FORBIDDEN |
| GET | /payroll/runs/:runId/payslips | 403 | FORBIDDEN |
| GET | /payroll/runs/:runId/payslips/:payslipId | 403 | FORBIDDEN |
| GET | /payroll/runs/:runId/payslips/:payslipId/download | 403 | FORBIDDEN |
| GET | /payroll/statutory-packs/:id | 403 | FORBIDDEN |
| GET | /reports/export/:jobId | 403 | FORBIDDEN |
| GET | /reports/export/:jobId/download | 403 | FORBIDDEN |
| GET | /reports/export/:jobId/status | 403 | FORBIDDEN |
| GET | /timesheets/projects/:id/tasks | 200 |  |
| PATCH | /announcements/:id | 403 | FORBIDDEN |
| PATCH | /announcements/:id/pin | 403 | FORBIDDEN |
| PATCH | /announcements/:id/unpin | 403 | FORBIDDEN |
| PATCH | /assets/:id/assign | 403 | FORBIDDEN |
| PATCH | /assets/:id/recall | 403 | FORBIDDEN |
| PATCH | /assets/:id/status | 403 | FORBIDDEN |
| PATCH | /assets/requests/:id/approve | 403 | FORBIDDEN |
| PATCH | /assets/requests/:id/decline | 403 | FORBIDDEN |
| PATCH | /attendance/regularization/:id/approve | 403 | FORBIDDEN |
| PATCH | /attendance/regularization/:id/deny | 403 | FORBIDDEN |
| PATCH | /leave/policies/:id | 403 | FORBIDDEN |
| PATCH | /leave/requests/:id/approve | 403 | FORBIDDEN |
| PATCH | /leave/requests/:id/reject | 403 | FORBIDDEN |
| PATCH | /leave/requests/:id/withdraw | 403 | UNAUTHORIZED_ACTION |
| PATCH | /leave/types/:id | 403 | FORBIDDEN |
| PATCH | /notifications/:id/read | 404 | NOT_FOUND |
| PATCH | /payroll/components/:id | 403 | FORBIDDEN |
| PATCH | /payroll/country-bank-schemas/:country | 403 | FORBIDDEN |
| PATCH | /payroll/employees/:employeeId/salary | 403 | FORBIDDEN |
| PATCH | /payroll/employees/:id/garnishments/:garnishmentId | 403 | FORBIDDEN |
| PATCH | /payroll/employees/:id/loans/:loanId | 403 | FORBIDDEN |
| PATCH | /payroll/employees/:id/tax-declaration | 403 | FORBIDDEN |
| PATCH | /payroll/groups/:id | 403 | FORBIDDEN |
| PATCH | /payroll/legal-entities/:id | 403 | FORBIDDEN |
| PATCH | /payroll/pay-calendars/:id | 403 | FORBIDDEN |
| PATCH | /payroll/runs/:id/mark-paid | 403 | FORBIDDEN |
| PATCH | /payroll/runs/:runId/inputs/:employeeId | 403 | FORBIDDEN |
| PATCH | /payroll/runs/:runId/payslips/:payslipId | 403 | FORBIDDEN |
| PATCH | /payroll/statutory-packs/:id | 403 | FORBIDDEN |
| PATCH | /performance/reviews/:employeeId | 403 | FORBIDDEN |
| PATCH | /recruitment/candidates/:id/rating | 403 | FORBIDDEN |
| PATCH | /recruitment/openings/:id | 403 | FORBIDDEN |
| PATCH | /reports/scheduled/:id | 403 | FORBIDDEN |
| PATCH | /settings/email-templates/:type | 403 | FORBIDDEN |
| PATCH | /settings/leave-types/:id | 403 | FORBIDDEN |
| PATCH | /settings/webhooks/:id | 403 | FORBIDDEN |
| PATCH | /timesheets/budgets/:projectId | 403 | FORBIDDEN |
| PATCH | /timesheets/cost-rates/:employeeId | 403 | FORBIDDEN |
| PATCH | /timesheets/entries/:id | 422 | WEEK_LOCKED |
| PATCH | /timesheets/projects/:id | 403 | FORBIDDEN |
| PATCH | /timesheets/tasks/:id | 403 | FORBIDDEN |
| PATCH | /timesheets/templates/:id | 404 | NOT_FOUND |
| POST | /attendance/regularization/:id/documents | 403 | FORBIDDEN |
| POST | /holidays/import/:jobId/commit | 403 | FORBIDDEN |
| POST | /leave/comp-off/requests/:id/approve | 403 | FORBIDDEN |
| POST | /leave/comp-off/requests/:id/reject | 403 | FORBIDDEN |
| POST | /leave/policies/:id/new-version | 403 | FORBIDDEN |
| POST | /leave/policies/:id/publish | 403 | FORBIDDEN |
| POST | /notifications/:id/read | 404 | NOT_FOUND |
| POST | /payroll/employees/:employeeId/payout-methods | 403 | FORBIDDEN |
| POST | /payroll/employees/:employeeId/salary | 403 | FORBIDDEN |
| POST | /payroll/employees/:id/garnishments | 403 | FORBIDDEN |
| POST | /payroll/employees/:id/loans | 422 | VALIDATION_ERROR |
| POST | /payroll/employees/:id/opening-balances | 403 | FORBIDDEN |
| POST | /payroll/employees/:id/tax-declaration | 422 | VALIDATION_ERROR |
| POST | /payroll/payout-methods/:id/archive | 403 | FORBIDDEN |
| POST | /payroll/payout-methods/:id/set-primary | 403 | FORBIDDEN |
| POST | /payroll/payout-methods/:id/verify | 403 | FORBIDDEN |
| POST | /payroll/payout-methods/approvals/:id/approve | 403 | FORBIDDEN |
| POST | /payroll/payout-methods/approvals/:id/reject | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/approvals/:level | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/approve | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/calculate | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/cancel | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/inputs/from-attendance | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/inputs/from-leave | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/inputs/from-timesheets | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/parallel-reconcile | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/payment-batch | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/payslips/:payslipId/recalculate | 403 | FORBIDDEN |
| POST | /payroll/runs/:id/publish | 403 | FORBIDDEN |
| POST | /payroll/runs/:runId/inputs/import | 403 | FORBIDDEN |
| POST | /payroll/runs/:runId/payslips/:payslipId/hold | 403 | FORBIDDEN |
| POST | /payroll/runs/:runId/payslips/:payslipId/release | 403 | FORBIDDEN |
| POST | /recruitment/candidates/:id/advance | 403 | FORBIDDEN |
| POST | /settings/roles/:key/users | 403 | FORBIDDEN |
| POST | /settings/webhooks/:id/test | 403 | FORBIDDEN |
| POST | /timesheets/:id/approve | 403 | FORBIDDEN |
| POST | /timesheets/:id/recall | 404 | NOT_FOUND |
| POST | /timesheets/:id/reject | 403 | FORBIDDEN |
| POST | /timesheets/:id/submit | 404 | NOT_FOUND |
| POST | /timesheets/projects/:id/tasks | 403 | FORBIDDEN |
| POST | /timesheets/templates/:id/apply | 404 | NOT_FOUND |
| DELETE | /announcements/:id | 403 | FORBIDDEN |
| DELETE | /auth/sessions/:sessionId | 404 | SESSION_NOT_FOUND |
| DELETE | /holidays/optional-selections/:holidayId | 500 | INTERNAL_ERROR |
| DELETE | /leave/types/:id | 403 | FORBIDDEN |
| DELETE | /payroll/components/:id | 403 | FORBIDDEN |
| DELETE | /payroll/country-bank-schemas/:country | 403 | FORBIDDEN |
| DELETE | /payroll/employees/:id/garnishments/:garnishmentId | 403 | FORBIDDEN |
| DELETE | /payroll/groups/:id | 403 | FORBIDDEN |
| DELETE | /payroll/statutory-packs/:id | 403 | FORBIDDEN |
| DELETE | /reports/scheduled/:id | 403 | FORBIDDEN |
| DELETE | /settings/leave-types/:id | 403 | FORBIDDEN |
| DELETE | /settings/roles/:key | 403 | FORBIDDEN |
| DELETE | /settings/webhooks/:id | 403 | FORBIDDEN |
| DELETE | /timesheets/delegations/:id | 403 | FORBIDDEN |
| DELETE | /timesheets/entries/:id | 422 | WEEK_LOCKED |
| DELETE | /timesheets/locks/:id | 403 | FORBIDDEN |
| DELETE | /timesheets/projects/:id | 403 | FORBIDDEN |
| DELETE | /timesheets/templates/:id | 404 | NOT_FOUND |
