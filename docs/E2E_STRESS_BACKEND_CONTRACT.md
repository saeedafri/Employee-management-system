# E2E Stress — Backend Contract

Local stress probes against `http://localhost:4000` (Hostinger DB). No Render. No migrations.

## API-HAMMER

> Generated 2026-08-03T02:15:23.941Z · target `http://localhost:4000` · tenant `acme-corp-001` · 20 parallel GETs × 8 endpoints × 4 roles · wall **64295 ms** · Hostinger via `127.0.0.1:15432`

### Login
- **SUPER_ADMIN** (superadmin@acme.test): HTTP 200, token=ok, 2176ms
- **HR_ADMIN** (hr@acme.test): HTTP 200, token=ok, 1451ms
- **MANAGER** (aman@acme.test): HTTP 200, token=ok, 2215ms
- **EMPLOYEE** (priya@acme.test): HTTP 200, token=ok, 2307ms

### Status / latency highlights
- **SUPER_ADMIN**
  - `health`: 200×20 · p50=4ms · p95=4ms
  - `auth/me`: 200×20 · p50=2419ms · p95=2624ms
  - `employees`: 200×20 · p50=2174ms · p95=2640ms
  - `leave/balance`: 200×20 · p50=2119ms · p95=2272ms
  - `leave/requests`: 200×20 · p50=1625ms · p95=2100ms
  - `attendance/today`: 400×20 · p50=789ms · p95=926ms
  - `attendance/summary`: 200×20 · p50=647ms · p95=782ms
  - `notifications`: 200×20 · p50=1360ms · p95=1788ms
- **HR_ADMIN**
  - `health`: 200×20 · p50=3ms · p95=3ms
  - `auth/me`: 200×20 · p50=3016ms · p95=3289ms
  - `employees`: 200×20 · p50=2307ms · p95=2898ms
  - `leave/balance`: 200×20 · p50=2236ms · p95=2466ms
  - `leave/requests`: 200×20 · p50=1638ms · p95=2027ms
  - `attendance/today`: 200×20 · p50=1016ms · p95=1116ms
  - `attendance/summary`: 200×20 · p50=944ms · p95=1061ms
  - `notifications`: 200×20 · p50=1209ms · p95=1547ms
- **MANAGER**
  - `health`: 200×20 · p50=1ms · p95=1ms
  - `auth/me`: 200×20 · p50=2387ms · p95=2482ms
  - `employees`: 200×20 · p50=2068ms · p95=2854ms
  - `leave/balance`: 200×20 · p50=2141ms · p95=2300ms
  - `leave/requests`: 200×20 · p50=1840ms · p95=2436ms
  - `attendance/today`: 200×20 · p50=810ms · p95=925ms
  - `attendance/summary`: 200×20 · p50=713ms · p95=813ms
  - `notifications`: 200×20 · p50=1025ms · p95=1334ms
- **EMPLOYEE**
  - `health`: 200×20 · p50=1ms · p95=2ms
  - `auth/me`: 200×20 · p50=1942ms · p95=2046ms
  - `employees`: 200×20 · p50=1531ms · p95=2063ms
  - `leave/balance`: 200×20 · p50=1526ms · p95=1630ms
  - `leave/requests`: 200×20 · p50=1174ms · p95=1522ms
  - `attendance/today`: 200×20 · p50=765ms · p95=878ms
  - `attendance/summary`: 200×20 · p50=718ms · p95=820ms
  - `notifications`: 200×20 · p50=797ms · p95=1092ms

### Notable errors (esp leave / attendance/today)
- **SUPER_ADMIN** `attendance/today` → 400×20: `NO_EMPLOYEE_RECORD` ("User has no employee record") — only failing cell in the matrix
- **SUPER_ADMIN** `leave/balance` / `leave/requests` → 200 but **resolve to Priya** (`employeeId` prefix `cmqjpyds7001kkpjdnlhjygrp`, refs `LVR-0026`/`LVR-0025`) while auth/me has `employeeId: null`
- HR / Manager / Employee: all eight endpoints 200×20 under hammer

### Identity peeks (leave / attendance/today)
- **SUPER_ADMIN** `auth/me` → 200: `{"success":true,"data":{"id":"cmqjpydqe000qkpjd8q8idw1k","email":"superadmin@acme.test","memberType":"SUPER_ADMIN","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":null,"status":"ACTIVE","employee":null,"permissions":["employees:read","employees:write","employees:delete","empl`
- **SUPER_ADMIN** `leave/balance` → 200: `{"success":true,"data":{"balances":[{"id":"cmqjpyds7001kkpjdnlhjygrp-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":580.57,"used":2,"pending":0,"available":578.57},{"id":"cmqjpyds7001kkpjdnlhjygrp-SL","leaveTypeId":"SL","leaveTypeName":"Sick Le`
- **SUPER_ADMIN** `leave/requests` → 200: `{"success":true,"data":{"requests":[{"id":"cmsc6zss8007bb9xjpslcrb5n","referenceNo":"LVR-0026","leaveTypeId":"cmsc6zsbh0079b9xjds8qibrf","leaveTypeName":"Sick Leave","startDate":"2026-11-12T00:00:00.000Z","endDate":"2026-11-12T00:00:00.000Z","totalDays":1,"status":"WITHDRAWN","re`
- **SUPER_ADMIN** `attendance/today` → 400: `{"success":false,"error":{"code":"NO_EMPLOYEE_RECORD","message":"User has no employee record","details":{},"requestId":"e96a5c8b-d1d6-41b5-a21f-bfa5d64a0a53"}}`
- **HR_ADMIN** `auth/me` → 200: `{"success":true,"data":{"id":"cmqjpydqj000skpjdp2l6cvg5","email":"hr@acme.test","memberType":"HR_ADMIN","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":"cmqjpydsb001mkpjdxlgw74tv","status":"ACTIVE","employee":{"id":"cmqjpydsb001mkpjdxlgw74tv","tenantId":"cmqjpydkv0000kpjdelzt`
- **HR_ADMIN** `leave/balance` → 200: `{"success":true,"data":{"balances":[{"id":"cmqjpydsb001mkpjdxlgw74tv-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":9,"used":0,"pending":0,"available":9},{"id":"cmqjpydsb001mkpjdxlgw74tv-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leav`
- **HR_ADMIN** `leave/requests` → 200: `{"success":true,"data":{"requests":[{"id":"cmqjpyfna006fdwadtwp9ooog","referenceNo":"LVR-0011","leaveTypeId":"cmqjpydsy001okpjdqd9sxmu5","leaveTypeName":"Annual Leave","startDate":"2026-04-29T00:00:00.000Z","endDate":"2026-05-02T00:00:00.000Z","totalDays":4,"status":"APPROVED","r`
- **HR_ADMIN** `attendance/today` → 200: `{"success":true,"data":{"date":"2026-08-03T00:00:00.000Z","status":"PRESENT","checkInAt":"2026-08-02T19:05:47.312Z","checkOutAt":"2026-08-02T19:05:49.663Z","duration":0},"meta":{"cached":false}}`
- **MANAGER** `auth/me` → 200: `{"success":true,"data":{"id":"cmqjpydql000ukpjdbhesbmpi","email":"aman@acme.test","memberType":"MANAGER","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":"cmqjpyds0001ikpjd5br3r2uh","status":"ACTIVE","employee":{"id":"cmqjpyds0001ikpjd5br3r2uh","tenantId":"cmqjpydkv0000kpjdelz`
- **MANAGER** `leave/balance` → 200: `{"success":true,"data":{"balances":[{"id":"cmqjpyds0001ikpjd5br3r2uh-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":9,"used":2,"pending":0,"available":7},{"id":"cmqjpyds0001ikpjd5br3r2uh-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leav`
- **MANAGER** `leave/requests` → 200: `{"success":true,"data":{"requests":[{"id":"cmrgtkj5a00105ij38spgd230","referenceNo":"LVR-0021","leaveTypeId":"cmqx9cnfd001b3782zzr4haer","leaveTypeName":"Earned Leave","startDate":"2026-07-20T00:00:00.000Z","endDate":"2026-07-21T00:00:00.000Z","totalDays":2,"status":"APPROVED","r`
- **MANAGER** `attendance/today` → 200: `{"success":true,"data":{"date":"2026-08-03T00:00:00.000Z","status":"PRESENT","checkInAt":"2026-08-02T18:50:25.917Z","checkOutAt":"2026-08-02T19:27:48.859Z","duration":37},"meta":{"cached":false}}`
- **EMPLOYEE** `auth/me` → 200: `{"success":true,"data":{"id":"cmqjpydqn000wkpjd02gyqzd3","email":"priya@acme.test","memberType":"EMPLOYEE","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":"cmqjpyds7001kkpjdnlhjygrp","status":"ACTIVE","employee":{"id":"cmqjpyds7001kkpjdnlhjygrp","tenantId":"cmqjpydkv0000kpjde`
- **EMPLOYEE** `leave/balance` → 200: `{"success":true,"data":{"balances":[{"id":"cmqjpyds7001kkpjdnlhjygrp-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":9,"used":0,"pending":0,"available":9},{"id":"cmqjpyds7001kkpjdnlhjygrp-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leav`
- **EMPLOYEE** `leave/requests` → 200: `{"success":true,"data":{"requests":[{"id":"cmsc6zss8007bb9xjpslcrb5n","referenceNo":"LVR-0026","leaveTypeId":"cmsc6zsbh0079b9xjds8qibrf","leaveTypeName":"Sick Leave","startDate":"2026-11-12T00:00:00.000Z","endDate":"2026-11-12T00:00:00.000Z","totalDays":1,"status":"WITHDRAWN","re`
- **EMPLOYEE** `attendance/today` → 200: `{"success":true,"data":{"date":"2026-08-03T00:00:00.000Z","status":"PRESENT","checkInAt":"2026-08-02T19:04:47.372Z","checkOutAt":"2026-08-02T19:06:56.506Z","duration":2},"meta":{"cached":false}}`

### Artifacts
- `docs/e2e-ui-screenshots/stress/api-hammer/RESULTS.md`
- `docs/e2e-ui-screenshots/stress/api-hammer/raw.json`



## SA-SETTINGS-ADMIN

> Tester: `superadmin@acme.test` (SUPER_ADMIN) · tenant `acme-corp-001` · 2026-08-03
> Evidence: `docs/e2e-ui-screenshots/stress/sa-settings-admin/` (**82** PNGs + FINDINGS.md)
> Depth: menus=6 settingsSubs=29 clicks=40 maxDepth=2 stressNavs=5
> Stress: rapid open company-profile → branding → authentication → billing-plan → roles-permissions

_No backend issues unique to this shard (or none captured)._

### Stress network summary

- `404 GET http://localhost:3001/settings/roles-permissions` — **Next.js HTML 404** (missing FE page), not API `/api/v1/...`. Tracked as FE **ISSUE-SA-SET-01/02**. Other 4 rapid routes: 0 HTTP ≥400.



## SA-DASH-EMP-DEPT

**Tester:** `superadmin@acme.test` (SUPER_ADMIN) · tenant `acme-corp-001` · 2026-08-03  
**Evidence:** `docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/` (**44** PNGs + `FINDINGS.md`)  
**Depth:** menus=3 clicks=27 layers=6 nestDepth=1 stressBursts=7 stressErrors=1  
**Mutations:** Dashboard:Add Employee opened (no create); Dashboard:Approve clicked; Dashboard:Deny clicked  
**Stress:** 7 bursts; Dashboard 7d/30d/Add Employee OK; Employees Columns/Export OK; Departments Add OK; Employees Add Employee race = FE-only (no 4xx/5xx)

_No BACKEND issues unique to this stress shard (Dashboard/Employees/Departments APIs returned 2xx under rapid primary clicks). FE issues: `ISSUE-STRESS-SA-DED-01`, `ISSUE-STRESS-SA-DED-02`._


## SA-ATT-LEAVE

> SUPER_ADMIN stress+deep SHORT · Attendance / Timesheets / Leave / Holidays · 2026-08-03T02:18:51.014Z
> Evidence: `docs/e2e-ui-screenshots/stress/sa-attendance-leave/` (64 PNGs + FINDINGS.md)
> Stress: refresh×0 filter×0 pagination×10; leave balance/requests hits=12/14
> SA-10 Priya leak: **REPRODUCED** (10/10 API hits; employeeId=null)

### ISSUE-SA-10: Leave APIs return Priya Sharma data for SUPER_ADMIN (STRESS REPRO) (**CRITICAL**)
- Where: Leave → balances / My Requests (stress ×10)
- Why: employeeId=null; 10/10 API hits show Priya prefix/name (cmqjpyds7001kkpjdnlhjygrp). UI name absent; UI EL 578.57/580.57 matches Priya-prefixed API balance. Sample balance: {"success":true,"data":{"balances":[{"id":"cmqjpyds7001kkpjdnlhjygrp-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":580.57,"used":2,"pending":0,
- Classification: BACKEND
- How to resolve: Never fall back to another employee when employeeId is null — return empty or NO_EMPLOYEE_RECORD
- Screenshot: 064-leave-landing-post-stress.png
- Network: GET /leave/balance 200; GET /leave/requests 200; GET /auth/me

## MGR-APPROVALS

> Tester: `aman@acme.test` (MANAGER) · tenant `acme-corp-001` · 2026-08-03  
> Evidence: `docs/e2e-ui-screenshots/stress/mgr-approvals/` (**58** PNGs + `FINDINGS.md`, `results-gapfill.json`)  
> Stress: UI rapid Approve/Return + API corroboration against Hostinger via local `:4000`

### BE verdict — AUTHORIZATION CORRECT (no new BE defect)

| Probe | Result | Note |
|-------|--------|------|
| `POST /timesheets/{hrAdminId}/approve` | **403** `NOT_TEAM_APPROVER` | UI still shows Approve — FE `ISSUE-MGR-STRESS-01` |
| `POST /timesheets/{hrAdminId}/reject` | **403** `NOT_TEAM_APPROVER` | Return modal submits → same code |
| Stress Approve×5 (UI) | **4×403** `NOT_TEAM_APPROVER` | No 500 / no silent success |
| Stress Return×4 (UI) | **2×403** `NOT_TEAM_APPROVER` | Modal reason required; BE stable under burst |
| `POST /timesheets/cmr4fpp2m006ggrlntoghkxu0/reject` | **403** `SELF_APPROVAL_FORBIDDEN` | Own historic id; FE `ISSUE-MGR-STRESS-02` |
| `GET /timesheets/approvals?status=SUBMITTED` | **200** · 13 rows | Includes HR Admin; **no** Aman SUBMITTED (Aman week=`DRAFT`) |

### Sample bodies
```json
{"success":false,"error":{"code":"NOT_TEAM_APPROVER","message":"You can only decide requests for your direct reports"}}
{"success":false,"error":{"code":"SELF_APPROVAL_FORBIDDEN","message":"You cannot approve or reject your own request"}}
```

### IDs exercised
- Non-team: `cmqjpyhsz009j12oncxrxe5gz` (HR Admin), `cmqjpyi4800mv12onxd63wav0`, `cmqjpyi1600if12onc8cpavvh`, `cmqjpyiaq00vr12onlie5r8xa`
- Self: `cmr4fpp2m006ggrlntoghkxu0`

_No BACKEND bug filed for this shard — guards behave as designed under stress. FE must hide forbidden actions._

## HR-CORE

> Tester: `hr@acme.test` (HR_ADMIN) · tenant `acme-corp-001` · 2026-08-03  
> Evidence: `docs/e2e-ui-screenshots/stress/hr-core/` (**84** PNGs + `FINDINGS.md`, `results.json`)  
> Menus: Dashboard · Employees · Attendance · Leave · Payroll · Reports  
> Stress: concurrent tab switches (Leave/Employees) + export clicks + rapid menu hop ×2  
> Attendance zeros: UI Present=0 / 50% **REPRODUCED**; classic BE summary-excludes-today **NOT** at ~02:15Z (`present=1`)

### ISSUE-HR-STRESS-BE-01
- **Where:** `GET /attendance/today` (+ `GET /attendance/records?month=2026-08`)
- **Why:** HR attendance for 2026-08-03 is `status=PRESENT` with `duration=0` / `totalMinutes=0` (near-instant check-out from prior E2E).
- **Classification:** BACKEND
- **How to resolve:** Reject early check-out or mark incomplete/half-day; never emit PRESENT with 0 minutes.
- **Screenshot:** `docs/e2e-ui-screenshots/stress/hr-core/003-attendance-zeros-probe-land-view.png`, `005-attendance-zeros-probe-table-view.png`
- **Network:** `200 GET /attendance/today` `PRESENT duration=0`; records `totalMinutes=0`
- **Aliases:** `ISSUE-HR-09`

### Attendance summary today zeros (BE probe)
- Direct BE at stress time: `GET /attendance/summary` → `present=1`, `attendancePercentage=100`, `endDate=2026-08-03T02:15:07.815Z` while records/today also PRESENT.
- Classic timezone exclusion (`ISSUE-HR-05` / `ISSUE-HR-07`) **not reproduced** after UTC midnight; UI card zeros tracked on FE contract as `ISSUE-HR-STRESS-FE-01`.

> **Mutations:** none in this shard (read-only deep + stress). Prior HR check-in/out zero-duration row reused for probe.

## SA-PAY-REPORTS

**Tester:** `superadmin@acme.test` (SUPER_ADMIN) · tenant `acme-corp-001` · 2026-08-03
**Evidence:** `docs/e2e-ui-screenshots/stress/sa-payroll-reports/` (**48** PNGs + `FINDINGS.md`)
**Depth:** menus=4 tabs=0 buttons=38 exports=6 bursts=6 nest=1
**Downloads:** 12 (ok:12 / false:0)

_No backend issues in this shard._ Concurrent export stress against Hostinger BE succeeded: `POST /api/reports/export` → **202**, download poll → **200**; payroll run `GET /api/payroll/runs/:id/export` → **200** (CSV + audit-pack JSON). Prior shallow `ok:false` export findings for SA were Playwright `failure()` Promise mishandling / race — **not reproduced** as BE failures here (all 12 downloads ok:true).

## EMP-SELF

**Tester:** `priya@acme.test` (EMPLOYEE) · tenant `acme-corp-001` · 2026-08-03T02:23:01.002Z  
**Evidence:** `docs/e2e-ui-screenshots/stress/emp-self/` (**55** PNGs + `FINDINGS.md`)  
**Stress:** leave preview ×5 (**404=5/5**); payslip open ×5 (detail **200** first open; skeleton=0); mark-all-read ×2 (#1 **200** `markedRead:1`)  
**Focus:** Attendance CI/CO · Leave all types+AL · Timesheets · Payslip drawer · Notifications  
**Mutations:** AL **400** `NO_LEAVE_BALANCE`; SL **201**; CO **400** `INSUFFICIENT_BALANCE`; EL **201**; CL **400** `NO_CHARGEABLE_DAYS` (Sat); withdraw **200**; notif mark-all **200**

### STRESS-EMP-BE-01 (ISSUE-EMP-01 reconfirm) — CRITICAL
- **Where:** `POST /api/leave/requests` leaveType Annual Leave (`AL`)
- **Why:** Stress submit returns **400** `NO_LEAVE_BALANCE`. Types list includes AL; balance has no AL row. SL/EL succeed same session.
- **Classification:** BACKEND
- **How to resolve:** Seed `LeaveBalance` for AL or remove/disable orphan AL from `/leave/types`
- **Screenshot:** `docs/e2e-ui-screenshots/stress/emp-self/023-leave-submit-annual-leave.png`
- **Network:** `POST /api/leave/requests` **400** `NO_LEAVE_BALANCE`; contrast SL/EL **201**

### STRESS-EMP-BE-02 (ISSUE-EMP-02 reconfirm) — HIGH
- **Where:** `GET /api/v1/leave/requests/preview` (FE New Leave Request dialog)
- **Why:** Stress opened AL preview **5×** — **5/5** returned **404** Route not found. Also 404 during submit flow for AL/SL/CO/EL/CL.
- **Classification:** BACKEND
- **How to resolve:** Implement `GET /leave/requests/preview` or stop FE calling it
- **Screenshot:** `docs/e2e-ui-screenshots/stress/emp-self/017-stress-leave-preview-1.png` … `021-stress-leave-preview-5.png`
- **Network:** `404 GET /api/leave/requests/preview?leaveTypeId=AL&startDate=2026-11-17…` (×5)

> **Not defects (correct BE):** CO `INSUFFICIENT_BALANCE` available=0; CL `NO_CHARGEABLE_DAYS` (2026-11-21 Saturday). Attendance CI/CO buttons absent (already completed same day). Payslip detail GET **200**. Notifications mark-all-read **200**.

## SA-EXPORTS-CONFIRM

> Deep export confirmation SUPER_ADMIN · 2026-08-03 · UI :3001 / BE :4000

**Matrix:** `docs/E2E_EXPORT_CONFIRM_MATRIX.md` · screenshots `docs/e2e-ui-screenshots/confirm/sa-exports/` (72 PNGs)

**Downloads:** 16 (ok:16 / false:0) · bursts=4

_No backend export failures. All download events ok:true (Employees CSV, Assets CSV, Payroll Register/pack, Reports Export CSV, concurrent headcount ×3). Prior ISSUE-SA-05…09 ok:false not reproduced._

## REDIS-BULLMQ

> Deep stress Redis cache + BullMQ payroll path · 2026-08-03T03:39:57.880Z  
> Target `http://localhost:4000` · `REDIS_URL=redis://127.0.0.1:16379` · HR `hr@acme.test`  
> Evidence: `docs/e2e-ui-screenshots/stress/redis-bullmq/RESULTS.md`  
> Constraints: no Render · no migrate · Hostinger Redis tunnel not killed

### redisEnabled
- `node --env-file=.env` import `src/lib/redis.js` → **`redisEnabled=true`**, `PING=PONG`

### Cache stress (100 parallel)
- `cacheSet`→`cacheGet`: **100/100 hits** · wall **151 ms** · avg **1.51 ms/key**
- `cacheDelByPrefix`: leftovers sample20=**0** · exact `cacheDel` OK

### BullMQ `payroll-calculate`
- Counts: waiting=0 active=0 failed=**0** completed=**52** · `bull:*` keys≈**57**
- Newest completed: `calc-cmsbwp4gy002112xqipqgzuf1` · **189 ms** · finished 2026-08-02T14:39:23.976Z
- HR list: DRAFT=**0** CALCULATING=**0** REVIEW=2 (includes same run id) → **calculate NOT triggered** (mutate caution on Hostinger payroll)
- Safe route probe: `POST …/does-not-exist-stress/calculate` → **404** `NOT_FOUND`

### Unreachable Redis (child → `:19999`, tunnel untouched)
- `cacheGet`/`cacheSet`/`cacheDelByPrefix`: **never throw** (null / no-op)
- `enqueueCalculate`: **hang risk** (>3s) before fail/false — sync fallback not instant on cold ECONNREFUSED

### Hot-config
- `cache:tenantcfg:cmqjpydkv0000kpjdelztyg88` present (`settings.service` TTL 300)
- `cache:statpacks:…:all` present (payroll statutory packs TTL 300)
- `GET /settings/tenant` ×2 → **200/200**

### Verdict
**PASS (read-only)** — Redis + cache stress + queue history healthy. Live calculate skipped (no DRAFT). Enqueue degrade under total Redis outage is PARTIAL (possible hang).

## ISOLATION-HAMMER

> Cross-tenant/cross-user isolation under concurrency · 2026-08-03T03:41:00.298Z  
> Target `http://localhost:4000` · tenant `acme-corp-001` · **5 rounds** parallel login×4 + simultaneous sensitive GETs · wall **17704 ms**  
> Evidence: `docs/e2e-ui-screenshots/stress/isolation-hammer/RESULTS.md` · `raw.json`  
> No Render · No migrations · No Playwright

### Method
- Parallel login each round: `superadmin@acme.test` / `hr@acme.test` / `aman@acme.test` / `priya@acme.test`
- Concurrent GETs per token: `/auth/me`, `/employees`, `/leave/requests`, `/leave/balance`, `/notifications`, payroll payslips (own emp; SA also `/payroll/runs` + Priya payslips), `/manager/dashboard|team|approvals` (EMP expect **403**)

### Login
- **5/5** rounds · all 4 roles **200** + token · parallel wall ≈623–1214 ms/round · no Set-Cookie value collisions across roles

### Isolation matrix (hunt)
| Check | Verdict | Detail |
|---|---|---|
| SA leave → Priya (**ISSUE-SA-10**) | **FAIL** 5/5 | SA `auth/me.employeeId=null` but `leave/balance` prefix `cmqjpyds7001kkpjdnlhjygrp` + requests `LVR-0028…0024` (same as Priya) |
| HR/MGR/EMP own leave | **PASS** | leave prefix === own employeeId every round under concurrency |
| Notification bodies / ids | **PASS** | distinct notification ids per role; EMP titles (`Leave Approved`…) ≠ SA/HR/MGR approver fan-out; 0 id overlap |
| HTTP 500 under concurrency | **PASS** | **0** × 5xx/network across **185** sensitive GETs |
| Cookie/session confusion | **PASS** | `auth/me.email` always matched login email; parallel refresh cookies unique |
| EMPLOYEE → `/manager/*` | **PASS** | dashboard/team/approvals **403×5** |

### ISSUE-SA-10 reconfirm (isolation hammer) — CRITICAL
- **Where:** `GET /leave/balance` + `GET /leave/requests` as SUPER_ADMIN under 4-role concurrent hammer
- **Why:** 5/5 rounds return Priya Sharma employee scope (`cmqjpyds7001kkpjdnlhjygrp-*`, refs `LVR-0028`/`LVR-0027`/`LVR-0026`) while `auth/me` has `employeeId: null` / `employee: null`
- **Classification:** BACKEND (data leak / wrong employee resolution for null-employee SA)
- **How to resolve:** When `employeeId` is null, leave self-endpoints must 400/`NO_EMPLOYEE_RECORD` (like `attendance/today`) or return empty — never fall through to another employee
- **Evidence:** `docs/e2e-ui-screenshots/stress/isolation-hammer/RESULTS.md` spotlight table; peeks in same file

### Observational (not filed as isolation fail)
- SA + HR: `/manager/dashboard` + `/manager/team` → **403**; `/manager/approvals` → **200×5**
- SA admin read of Priya payslips `GET /payroll/employees/{priya}/payslips` → **200** (expected elevated access)

### Artifacts
- `docs/e2e-ui-screenshots/stress/isolation-hammer/RESULTS.md`
- `docs/e2e-ui-screenshots/stress/isolation-hammer/raw.json`
- `docs/e2e-ui-screenshots/stress/isolation-hammer/_isolation_hammer.mjs`

## NOTIF-UI

> Cross-check from notification bell UI stress · 2026-08-03 · BE `http://localhost:4000` · tenant `acme-corp-001`  
> Evidence: `docs/e2e-ui-screenshots/stress/notifications-ui/` (API captures in `results.json` / FINDINGS)  
> Roles: SUPER_ADMIN / HR_ADMIN / MANAGER / EMPLOYEE

### API verification (no BE defect on unread-count)
| Role | `GET /notifications/unread-count` | `GET /notifications?limit=20` unreadInPage | Consistent? |
|------|-----------------------------------|--------------------------------------------|-------------|
| SUPER_ADMIN | 200 · count=14 | 14 | yes |
| HR_ADMIN | 200 · count=3 | 3 | yes |
| MANAGER | 200 · count=4 | 4 | yes |
| EMPLOYEE | 200 · count=1 | 1 | yes |

- `PATCH /notifications/:id/read` → **200** (SA/HR/EMP observed).
- `PATCH /notifications/read-all` → **200** (`markedRead` matched remaining unread: HR=2, MGR=5 under live fan-out, SA ok).
- `GET /notifications?unreadOnly=true` → **200**.
- User-visible badge mismatch (MANAGER badge 3 vs count 4) is **FRONTEND** — FE does not call `unread-count` for the badge (`ISSUE-NOTIF-UI-01`). **No BACKEND issue filed.**

### Observational
- Concurrent leave traffic during UI stress changed unread counts between steps (MGR beforeApi→afterApi drift); unread-count endpoint itself remained coherent with list samples.

## NOTIF-API

> Deep stress Notifications REST · 2026-08-03 · target `http://localhost:4000` · tenant `acme-corp-001` · 4 roles · parallel **20** · wall **88729 ms**  
> Evidence: `docs/e2e-ui-screenshots/stress/notifications-api/` (`RESULTS.md`, `raw.json`, `_run.log`)  
> Constraints: no Render · no migrate · Hostinger via tunnel · mutations limited to mark-read / mark-all-read

### Login
- **SUPER_ADMIN** (superadmin@acme.test): 200 · token=ok · ~1334ms
- **HR_ADMIN** (hr@acme.test): 200 · token=ok · ~703ms
- **MANAGER** (aman@acme.test): 200 · token=ok · ~611ms
- **EMPLOYEE** (priya@acme.test): 200 · token=ok · ~601ms

### Inventory scale
| Role | total | unread-count (pre) |
|---|---:|---:|
| SUPER_ADMIN | ~20019 | 3 |
| HR_ADMIN | ~20017 | 3 |
| MANAGER | ~20015 | 0 |
| EMPLOYEE | ~20005 | 0 |

### Burst highlights (×20 parallel, all roles 200 unless noted)
- `GET /notifications` variants (default / page·limit / unreadOnly / since / combo): **200×20** · p50 ≈ **700–1270ms** · p95 ≈ **1000–1650ms**
- `GET /notifications/unread-count`: **200×20** · p50 ≈ **585–792ms**
- `PATCH|POST /:id/read` interleaved burst: **200×20** (idempotent)
- Race `list×10 + PATCH read-all×5 + POST read-all×5`: all **200**; post-race unread-count=**0**

### Isolation / auth (PASS)
- Cross-user mark-read (PATCH+POST × foreign ids): **404×18** per role — **no IDOR**
- Invalid ids → **404 NOT_FOUND**
- Missing/bad JWT → **401** (list, unread-count, read-all)

### STRESS-NOTIF-BE-01 — HIGH
- **Where:** `GET /api/v1/notifications?page=-1`
- **Why:** Negative page → Prisma negative `skip` → **500 INTERNAL_SERVER_ERROR** (all 4 roles). Schema has `page: integer` with no `minimum`.
- **Classification:** BACKEND
- **How to resolve:** `minimum: 1` on page; clamp/validate in controller; return **400** not 500
- **Evidence:** `docs/e2e-ui-screenshots/stress/notifications-api/RESULTS.md` · edge `list-page-neg`
- **Network:** `GET /notifications?page=-1&limit=10` → **500**

### STRESS-NOTIF-BE-02 — HIGH
- **Where:** `GET /api/v1/notifications?since=<invalid>`
- **Why:** `since=not-a-date` and `since=2024-13-40` → `new Date(since)` Invalid Date → Prisma throw → **500**. Query schema is bare `string` (no `format: date-time`).
- **Classification:** BACKEND
- **How to resolve:** Validate ISO date-time; **400 VALIDATION_ERROR** before repository
- **Evidence:** RESULTS edge `list-since-invalid` + post-run `since=2024-13-40`
- **Network:** `GET /notifications?since=not-a-date` → **500**

### STRESS-NOTIF-BE-03 — HIGH
- **Where:** `GET /api/v1/notifications?limit=5000`
- **Why:** No max clamp — returns **5000** rows (~**1.07MB** JSON). Concurrent ×4 ≈ **4.3MB** egress in ~612ms. DoS/memory risk.
- **Classification:** BACKEND
- **How to resolve:** Cap `limit` (e.g. max 100); reject above with 400
- **Evidence:** RESULTS `list-limit-huge` + `extraProbes.payload_burst_limit_5000_x4`
- **Network:** `GET /notifications?limit=5000` → **200** n=5000

### STRESS-NOTIF-BE-04 — MEDIUM
- **Where:** `GET /notifications?limit=-1` (also `limit=-5`)
- **Why:** Negative limit accepted **200**; `pagination.pages` becomes **negative** (`Math.ceil(total/limit)` → `-20005`); Prisma `take` behavior surprising (n=1 or abs-like).
- **Classification:** BACKEND
- **How to resolve:** `minimum: 1` on limit; 400 on negatives
- **Evidence:** post-run `limit=-1` → pages=-20005
- **Network:** `GET /notifications?limit=-1` → **200**

### STRESS-NOTIF-BE-05 — MEDIUM
- **Where:** controller `listNotifications` falsy coerce (`page ?` / `limit ?`)
- **Why:** `limit=0` silently becomes **20**; `page=0` silently becomes **1**. Client cannot express/detect invalid zero page/limit.
- **Classification:** BACKEND
- **How to resolve:** Use nullish checks + explicit `>= 1` validation
- **Evidence:** `limit=0` → pagination.limit=20; `page=0&limit=5` → page=1
- **Network:** `GET /notifications?limit=0` → **200** (wrong semantics)

### STRESS-NOTIF-BE-06 — MEDIUM
- **Where:** `markAllRead` vs list/count `ACTIVE_FILTER`
- **Why:** `updateMany` marks **all** unread including **expired**; list/unread-count exclude expired. `markedRead` can count invisible rows; expired rows mutated.
- **Classification:** BACKEND
- **How to resolve:** Apply same `ACTIVE_FILTER` in `markAllRead` (`repository.js`)
- **Evidence:** code `notifications.repository.js` markAllRead vs getNotifications
- **Network:** behavioral / code-diff (not requiring expired seed to fail HTTP)

### STRESS-NOTIF-BE-07 — MEDIUM
- **Where:** per-user notification volume ~**20k**
- **Why:** Inventory totals ~20005–20020 for every role; list bursts p50 **700–1500ms**. Retention/`deleteExpired` not on request path → Hostinger latency under stress.
- **Classification:** BACKEND
- **How to resolve:** scheduled `deleteExpired` + retention policy; compound index; archive old rows
- **Evidence:** inventory table + burst p50/p95 in RESULTS
- **Network:** `GET /notifications` ×20 → 200 but slow

### STRESS-NOTIF-BE-08 — LOW
- **Where:** `unreadOnly=1|TRUE|yes`
- **Why:** Fastify boolean schema → **422 VALIDATION_ERROR**; only strict booleans / `"true"` accepted.
- **Classification:** BACKEND (contract strictness; FE must send boolean)
- **How to resolve:** Document; optionally coerce common truthy strings pre-schema
- **Evidence:** edge probes 422
- **Network:** `GET /notifications?unreadOnly=TRUE` → **422**

### Not defects (correct BE)
- Cross-user mark-read → **404 NOT_FOUND** (IDOR blocked)
- PATCH/POST aliases for mark-read and read-all under burst → **200**
- Race mark-all while listing → **200**, unread settles to **0**
- Unauthenticated → **401**
- `since` future → empty list **200**
## NOTIF-E2E-CREATE

> Deep create-path E2E · 2026-08-03T03:43:46.944Z · BE `http://localhost:4000` · Redis `redis://127.0.0.1:16379`  
> Evidence: `docs/e2e-ui-screenshots/stress/notif-e2e-create/FINDINGS.md`  
> Actors: `priya@acme.test` (EMP) → `aman@acme.test` (MGR)

### Mutation
- priya → `POST /leave/requests` **SL** `2026-12-16` (1 day, avoid AL)
- HTTP **201** · leaveRequestId=`cmscopykg0114b9xjppnmaoo0` · ref=`LVR-0031`
- Hostinger: +1 LeaveRequest + N Notification (`leave_requested` → manager + HR + SA)

### Delivery
- aman unread **0 → 1** (Δ=1); new row id `5733c09635b6e32d7e5487b3`
- SSE aman `event: notification` **true** (`sse-aman.log`)
- Redis channel **`ems:sse`** PUBLISH observed **true** — 4× notification + 3× analytics_update (`redis-pubsub.log`)
- NUMSUB before=`["ems:sse",2]` · during probe subscribe=`["ems:sse",3]`
- Notification storage keys: **none** (Prisma only); fan-out channel only
- Unrelated `cache:*`: `cache:tenantcfg:cmqjpydkv0000kpjdelztyg88`

### Isolation
- priya does **not** receive `leave_requested` for own submit (**true**)
- priya unread **0 → 0**
- Redis PUBLISH targets excluded priya userId for `leave_requested`

### Cleanup
- Script withdraw with stale JWT → **401** (harness); fresh login withdraw → **200** / status **WITHDRAWN**
- Verified: `GET /leave/requests` → `LVR-0031` **WITHDRAWN** (`cleanup-verify.log`)
- aman unread-count after → **`{"count":2}`** (unread `leave_requested` + `leave_withdrawn` leftovers)
- withdraw does **not** delete prior Notification rows (12h TTL filter only)

### Verdict
**PASS**

## NOTIF-SSE-REDIS

> Deep stress · Notifications SSE stream + Redis fan-out · 2026-08-03  
> BE `http://localhost:4000` · Redis `redis://127.0.0.1:16379` (Hostinger tunnel) · tenant `acme-corp-001`  
> Evidence: `docs/e2e-ui-screenshots/stress/notifications-sse/` (`RESULTS.md`, `raw.json`, `01`–`09` captures, `_stress_notif_sse.mjs`)

### Infra
- Redis `PING` via redis-cli + ioredis → **PONG**
- Channel `ems:sse` present · `NUMSUB` = **2** (local BE + peer on shared Hostinger Redis)
- Boot log: `[sse] cross-instance fan-out enabled` · `/ops/process` `fanoutEnabled: true`

### Concurrent SSE
- Opened **5** streams: priya×2, aman, SA, HR → all **200** `text/event-stream` + `: connected`
- Ops: `connectionCount=5` `uniqueUsers=4`

### Fan-out delivery
- Priya `POST /leave/requests` CL `2026-12-14` → **201** `LVR-0029`
- Aman / HR / SA SSE received `leave_requested` (Redis tap saw **7** pub/sub msgs incl. analytics_update)
- Aman approve → Priya A **and** Priya B both received `leave_approved` (multi-tab OK)
- Manual Redis PUBLISH probe → **1** SSE frame (no local double-emit)
- Mark-read → **200**, **0** SSE events

### Reconnect stress
- Kill all → burst reconnect **×10** → **200×10**, hung=0, 401=0
- Counters balanced (`connects==disconnects`) · post-reconnect leave create delivered to aman SSE

### Auth edges
| Case | Result |
|---|---|
| No / empty / bad / expired token | **401** (clean, not hung) |
| Bearer header (no query) | **200** connected |
| After `POST /auth/logout-all` — REST `/notifications` | **401** Session revoked |
| After `POST /auth/logout-all` — SSE stream same JWT | **200** connected — **CRITICAL** |

### Backend issues
| ID | Sev | Summary |
|---|---|---|
| **ISSUE-SSE-30** | CRITICAL | SSE uses `verifyToken` only — accepts JWT after session revoke / logout-all; REST correctly 401s |
| **ISSUE-SSE-31** | HIGH | SSE payload uses `message`/`metadata`; REST list uses `body`/`isRead`/entity fields — shape mismatch |
| **ISSUE-SSE-32** | HIGH | `reply.raw.writeHead` SSE omits CORS ACAO (OPTIONS has it) — breaks cross-origin EventSource to `:4000` |
| **ISSUE-SSE-33** | MEDIUM | SSE 401 envelope `{error,message}` ≠ standard `{success:false,error:{code,message,…}}` |
| **ISSUE-SSE-29** | MEDIUM | `?token=` query auth (EventSource constraint) — log/Referer leak risk |
| **ISSUE-SSE-19** | LOW | Mark-read does not push SSE; clients must poll |
| **ISSUE-SSE-34** | MEDIUM | Shared Redis `NUMSUB ems:sse=2` — inventory second subscriber (not local double-delivery) |

### Not defects (observed healthy)
- Fan-out boot + publish/receive counters (`published` ≈ `receivedFromRedis`)
- Cross-role leave notification targeting (requester excluded)
- Burst reconnect without registry leak at ×10
- Missing/bad/expired token rejection

### Verdict
**PARTIAL PASS** — Redis SSE fan-out works end-to-end; **session-revoke bypass on stream is a ship-blocker** for multi-device logout security.
