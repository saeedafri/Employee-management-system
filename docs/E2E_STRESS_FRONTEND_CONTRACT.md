# E2E STRESS FRONTEND CONTRACT

Living stress-test contract. Appended by SHORT stress shards. Do not wipe role sections.


## SA-SETTINGS-ADMIN

> Tester: `superadmin@acme.test` (SUPER_ADMIN) · tenant `acme-corp-001` · 2026-08-03
> Evidence: `docs/e2e-ui-screenshots/stress/sa-settings-admin/` (**82** PNGs + FINDINGS.md)
> Depth: menus=6 settingsSubs=29 clicks=40 maxDepth=2 stressNavs=5
> Stress: rapid open company-profile → branding → authentication → billing-plan → roles-permissions

### ISSUE-SA-SET-01
- **Where:** Hard nav `/settings/roles-permissions`
- **Why:** Next.js App Router HTML **404** — no `settings/roles-permissions/page.tsx`. Matrix UI is at `/permissions` (API path `/settings/roles-permissions` unchanged). SettingsNav does not list this slug.
- **Classification:** FRONTEND
- **How to resolve:** Add redirect page → `/permissions`, or drop dead deep-links.
- **Screenshot:** `docs/e2e-ui-screenshots/stress/sa-settings-admin/072-settings-roles-permissions-land.png`
- **Network:** `GET http://localhost:3001/settings/roles-permissions 404`

### ISSUE-SA-SET-02
- **Where:** Stress rapid-5 settings routes
- **Why:** 4/5 clean (≤463ms, 0 console). Only `roles-permissions` repeats SET-01 Next **404**. No race/cancel bugs on other panels.
- **Classification:** FRONTEND
- **How to resolve:** Same as SET-01.
- **Screenshot:** `docs/e2e-ui-screenshots/stress/sa-settings-admin/078-stress-settings-end.png`
- **Network:** `GET http://localhost:3001/settings/roles-permissions 404`

### Stress console summary

_No console errors during rapid-5 settings nav._



## SA-DASH-EMP-DEPT

**Tester:** `superadmin@acme.test` (SUPER_ADMIN) · tenant `acme-corp-001` · 2026-08-03  
**Evidence:** `docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/` (**44** PNGs + `FINDINGS.md`)  
**Depth:** menus=3 clicks=27 layers=6 nestDepth=1 stressBursts=7 stressErrors=1  
**Mutations:** Dashboard:Add Employee opened (no create); Dashboard:Approve clicked; Dashboard:Deny clicked  
**Stress OK:** Dashboard 7d/30d/Add Employee; Employees Columns/Export; Departments Add  
**Stress race:** Employees Add Employee ×5 → 1 ok + 4 click-fail (no API errors)

### ISSUE-STRESS-SA-DED-01
- **Where:** Login /login
- **Why:** Anonymous GET http://localhost:3001/api/auth/me, POST http://localhost:3001/api/auth/refresh → 401
- **Classification:** FRONTEND
- **How to resolve:** Skip me/refresh probes on public auth routes (cosmetic)
- **Screenshot:** `docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/002-login-success.png`
- **Network:** `GET http://localhost:3001/api/auth/me 401`

### ISSUE-STRESS-SA-DED-02
- **Where:** Employees → Add Employee (rapid-click ×5)
- **Why:** First click opens create flow; subsequent 4 clicks fail (detached/not clickable, 3.5–4.3s). Zero network/console failures — CTA not debounce-guarded under burst.
- **Classification:** FRONTEND
- **How to resolve:** Disable Add Employee while wizard/route transition in-flight; debounce primary CTA
- **Screenshot:** `docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/035-employees-stress-add-employee.png`
- **Network:** `n/a (click race; 0 failed API)`


## SA-ATT-LEAVE

> SUPER_ADMIN stress+deep SHORT · Attendance / Timesheets / Leave / Holidays · 2026-08-03T02:18:51.014Z
> Evidence: `docs/e2e-ui-screenshots/stress/sa-attendance-leave/` (64 PNGs + FINDINGS.md)
> Note: CRITICAL leave→Priya is BACKEND **ISSUE-SA-10** — listed on BE contract. FE section captures console/UI-only defects from this shard.

_No FRONTEND-only issues recorded in this shard._

## MGR-APPROVALS

> Tester: `aman@acme.test` (MANAGER) · tenant `acme-corp-001` · 2026-08-03  
> Evidence: `docs/e2e-ui-screenshots/stress/mgr-approvals/` (**58** PNGs + `FINDINGS.md`, `results-gapfill.json`)  
> Depth: Dashboard approvals · Timesheets Approvals · Leave · Team attendance (nested tabs/buttons)  
> Stress: rapid Approve×5 → **4×403**; rapid Return×4 → **2×403**; HR Admin targeted Approve **403**

### ISSUE-MGR-STRESS-01
- **Where:** Timesheets → Approvals — Approve/Return on **non-direct reports** (HR Admin + others)
- **Why:** Approvals queue lists Approve + Return outside team. Stress bursts: **4×** `POST …/approve` and **2×** `POST …/reject` → **403** `NOT_TEAM_APPROVER`. Targeted HR Admin Approve reproduces.
- **Classification:** FRONTEND (primary) — BE correct
- **How to resolve:** Only list/enable actions for employees the manager can decide (direct reports / delegates).
- **Screenshot:** `docs/e2e-ui-screenshots/stress/mgr-approvals/046-gap-approvals-loaded.png`, `047-gap-stress-approve.png`, `048-gap-return-modal-0.png`, `054-gap-stress-return.png`, `055-gap-hr-row.png`, `056-gap-hr-approve-result.png`
- **Network:** `POST /api/timesheets/cmqjpyhsz009j12oncxrxe5gz/approve|reject` → **403** `NOT_TEAM_APPROVER` (“You can only decide requests for your direct reports”); also ids `cmqjpyi4800mv12onxd63wav0`, `cmqjpyi1600if12onc8cpavvh`, `cmqjpyiaq00vr12onlie5r8xa`
- **Cross-ref:** `ISSUE-MGR-09` / deep FINDINGS `C2`

### ISSUE-MGR-STRESS-02
- **Where:** Timesheets → Approvals — Approve/Return on manager’s **own** rows
- **Why:** Current stress queue has **no** Aman SUBMITTED row (week is `DRAFT`). API still returns **403** `SELF_APPROVAL_FORBIDDEN` for historic own id. Shallow UI same-day showed Approve/Return on Aman Kumar rows.
- **Classification:** FRONTEND (primary) — BE correct
- **How to resolve:** Hide Approve/Return when `employeeId === current user`; filter own submissions out of Approvals.
- **Screenshot:** cross-ref `docs/e2e-ui-screenshots/manager/30-timesheets-approvals-view.png`, `69-timesheet-return-modal.png`, `70-timesheet-return-result.png` · stress API capture in `results-gapfill.json`
- **Network:** `POST /api/timesheets/cmr4fpp2m006ggrlntoghkxu0/reject` → **403** `SELF_APPROVAL_FORBIDDEN` (“You cannot approve or reject your own request”)
- **Cross-ref:** `ISSUE-MGR-02` / deep FINDINGS `C1`

### ISSUE-MGR-STRESS-03
- **Where:** Dashboard → Bulk approve
- **Why:** Opens leave-only “Bulk Approve Leave Requests” modal while pending items may be regularizations.
- **Classification:** FRONTEND
- **How to resolve:** Bulk-approve regularization, or rename/split; disable Approve selected when empty.
- **Screenshot:** `docs/e2e-ui-screenshots/stress/mgr-approvals/006-dashboard-bulk-approve-open.png`
- **Network:** n/a
- **Cross-ref:** `ISSUE-MGR-04`

### Stress notes
- First pass hit Approvals **skeleton** (`014`) before rows loaded — gap-fill waited for `button:Approve` (13 Approve / 13 Return).
- Leave nested tabs + Attendance Calendar/Table/Regularization covered (`023`–`044`, `057`–`058`).
- No FE crash / blank error boundary under rapid multi-row clicks; failures surface as API 403 (toasts).

## HR-CORE

> Tester: `hr@acme.test` (HR_ADMIN) · tenant `acme-corp-001` · 2026-08-03  
> Evidence: `docs/e2e-ui-screenshots/stress/hr-core/` (**84** PNGs + `FINDINGS.md`, `results.json`)  
> Menus: Dashboard · Employees · Attendance · Leave · Payroll · Reports  
> Stress: concurrent tab switches + export clicks + rapid menu hop  
> Depth: deep buttons per menu (Reports 14 report-nav clicks)

### ISSUE-HR-STRESS-FE-01
- **Where:** `/attendance` KPI cards vs `GET /attendance/summary`
- **Why:** UI shows Present **0**, Attendance % **50%**, table/calendar **Half Day** while BE summary returns `present:1`, `attendancePercentage:100` and Today badge still says Present. Client re-aggregation/classifier overrides server totals.
- **Classification:** FRONTEND
- **How to resolve:** Bind KPI cards to server summary totals; if client classifies zero-minute PRESENT as Half Day, update Half Day card and % consistently (or stop overriding server status).
- **Screenshot:** `docs/e2e-ui-screenshots/stress/hr-core/003-attendance-zeros-probe-land-view.png`, `005-attendance-zeros-probe-table-view.png`, `024-attendance-land-view.png`
- **Network:** `200 GET /attendance/summary` `present=1 pct=100` vs UI Present=0 pct=50
- **Aliases:** `ISSUE-HR-06`

### Stress FE notes
- Concurrent Leave tabs (4) and Employees detail tabs (6): **0** failed APIs / no error boundaries.
- Export CSV (Employees via Dashboard deep Export): download ok `employees-2026-08-03.csv`.
- Reports deep nav + Export CSV clicks: no FE crash; report list buttons are clickable (not all real `<a href>` deep-links — prior UX note `ISSUE-HR-07` still applies).
- Rapid menu hop ×2 across core menus: stable, no visible error boundary.

## SA-PAY-REPORTS

**Tester:** `superadmin@acme.test` (SUPER_ADMIN) · tenant `acme-corp-001` · 2026-08-03
**Evidence:** `docs/e2e-ui-screenshots/stress/sa-payroll-reports/` (**48** PNGs + `FINDINGS.md`)
**Depth:** menus=4 tabs=0 buttons=38 exports=6 bursts=6 nest=1
**Downloads:** 12 (ok:12 / false:0)

### ISSUE-SA-PAY-FE-01
- **Where:** /login
- **Why:** GET http://localhost:3001/api/auth/me → 401; POST http://localhost:3001/api/auth/refresh → 401
- **Classification:** FRONTEND
- **How to resolve:** Skip me/refresh on public auth routes
- **Screenshot:** `docs/e2e-ui-screenshots/stress/sa-payroll-reports/001-login-form.png`
- **Network:** `401 GET http://localhost:3001/api/auth/me · 401 POST http://localhost:3001/api/auth/refresh`

### ISSUE-SA-PAY-FE-02
- **Where:** /payout-methods
- **Why:** SA employeeId:null; page shows empty/self-service instead of admin approvals-first
- **Classification:** FRONTEND
- **How to resolve:** Default SUPER_ADMIN to /payout-methods/approvals when no employee record
- **Screenshot:** `docs/e2e-ui-screenshots/stress/sa-payroll-reports/016-payout-land.png`
- **Network:** `n/a`

### ISSUE-SA-PAY-FE-03
- **Where:** `/reports?report=payroll/ctc-analysis`
- **Why:** CTC Analysis toolbar has no `Export CSV` control (count=0) while Headcount/etc. expose it — concurrent export stress cannot target this type
- **Classification:** FRONTEND
- **How to resolve:** Show Export CSV for all `POST /reports/export`-capable report types including CTC
- **Screenshot:** `docs/e2e-ui-screenshots/stress/sa-payroll-reports/038-reports-stress-ctc-formats.png`
- **Network:** `n/a (no export control)`

### Stress SA-PAY-REPORTS notes
- Concurrent Reports Export CSV ×3 (Promise.all): **3/3 download ok:true**; network `202 POST /api/reports/export` ×3 then `200 GET .../download` (one interim 202 download polled to 200).
- Payroll run detail concurrent `Export Register` + `Export pack`: **2/2 ok:true** (`payroll-*.csv`, `audit-pack-*.json`).
- Analytics: no export/download control on page (burst skipped).
- Payroll list / Payout approvals: no PDF|Excel|CSV toolbar controls (exports live on run detail).

## EMP-SELF

**Tester:** `priya@acme.test` (EMPLOYEE) · tenant `acme-corp-001` · 2026-08-03T02:23:01.002Z  
**Evidence:** `docs/e2e-ui-screenshots/stress/emp-self/` (**55** PNGs + `FINDINGS.md`)  
**Stress:** leave preview ×5; payslip open ×5 (skeleton=0, drawer OK); mark-all-read ×2 (#1 **200**, #2 control gone after empty inbox — OK)

### STRESS-EMP-FE-01 — CRITICAL
- **Where:** Leave → New Request → Annual Leave picker
- **Why:** UI offers/submits AL which has no balance → toast / **400** `NO_LEAVE_BALANCE` (BE STRESS-EMP-BE-01)
- **Classification:** FRONTEND
- **How to resolve:** Default/hide types without `available > 0`
- **Screenshot:** `docs/e2e-ui-screenshots/stress/emp-self/023-leave-submit-annual-leave.png`
- **Network:** `POST /api/leave/requests` **400**

### STRESS-EMP-FE-02 — HIGH
- **Where:** Leave → Team Calendar tab
- **Why:** Tab visible to EMPLOYEE; page Access restricted
- **Classification:** FRONTEND
- **How to resolve:** Hide Team Calendar for `EMPLOYEE`
- **Screenshot:** `docs/e2e-ui-screenshots/stress/emp-self/013-leave-tab-team-calendar.png`
- **Network:** `n/a`

### STRESS-EMP-FE-03 — MEDIUM
- **Where:** Timesheets → Log time → Save/Submit
- **Why:** Dialog fills; Save/Submit click produces **no POST** (likely Project required validation)
- **Classification:** FRONTEND
- **How to resolve:** Surface validation errors; preselect project if only one
- **Screenshot:** `docs/e2e-ui-screenshots/stress/emp-self/039-timesheets-log-time-submit-result.png`
- **Network:** `n/a`

> **Working under stress:** Login **200**; Attendance views; Leave SL/EL create + withdraw; Payslip drawer open ×5 (detail **200**); Notifications mark-all-read **200**.

## SA-EXPORTS-CONFIRM

> Deep export confirmation SUPER_ADMIN · 2026-08-03 · UI :3001 / BE :4000

**Matrix:** `docs/E2E_EXPORT_CONFIRM_MATRIX.md` · screenshots `docs/e2e-ui-screenshots/confirm/sa-exports/` (72 PNGs)

**Downloads:** 16 (ok:16 / false:0) · bursts=4

- **Performance Export** → no download / no export API (FE stub).
- **ABSENT** export toolbar: Attendance, Leave, Analytics, Payout, Audit logs, Ops logs.
- CTC Analysis / some report panels hide Export CSV.
- Settings/Reports `Register|Pack|Invoice` labels are NAV_ONLY (not export controls).

## NOTIF-UI

> Deep UI stress — Notification bell/drawer · **all 4 roles** · 2026-08-03  
> Testers: `superadmin@acme.test` / `hr@acme.test` / `aman@acme.test` / `priya@acme.test` · tenant `acme-corp-001`  
> Evidence: `docs/e2e-ui-screenshots/stress/notifications-ui/` (**32** PNGs + `FINDINGS.md` + `results.json`)  
> Stress: open bell · list · click item · mark one · mark all · unread filter probe · pagination probe · rapid open/close ×10 · badge vs `GET /notifications/unread-count`

### Badge vs API (per role)
| Role | Badge | unread-count | List unread≤20 | Match |
|------|-------|--------------|----------------|-------|
| SUPER_ADMIN | 9+ (aria 14) | 14 | 14 | yes |
| HR_ADMIN | 3 | 3 | 3 | yes |
| MANAGER | **3** | **4** | **4** | **NO** |
| EMPLOYEE | 1 | 1 | 1 | yes |

### ISSUE-NOTIF-UI-01 — HIGH
- **Where:** Header bell badge · MANAGER (`aman@acme.test`)
- **Why:** Badge **3** while `GET /notifications/unread-count` → **4** and drawer shows 4 unread-styled items. FE never calls `unread-count`; badge = unread in client-filtered `list(limit=20)`.
- **Classification:** FRONTEND
- **How to resolve:** Bind badge to `GET /notifications/unread-count` (or server-side prefs-aware count); invalidate on mark-read / focus.
- **Screenshot:** `docs/e2e-ui-screenshots/stress/notifications-ui/018-mgr-badge-closed.png`, `019-mgr-drawer-open.png`
- **Network:** `GET /notifications/unread-count` **200** `count=4`

### ISSUE-NOTIF-UI-02 — MEDIUM
- **Where:** Notifications drawer (all roles)
- **Why:** Hard `limit=20` with scroll only — no pagination / load-more despite full pages of 20.
- **Classification:** FRONTEND
- **How to resolve:** Wire `page`/`limit` or infinite scroll.
- **Screenshot:** `003-sa-drawer-open.png`, `011-hr-drawer-open.png`, `019-mgr-drawer-open.png`, `027-emp-drawer-open.png`
- **Network:** `GET /notifications?limit=20` → 20 items

### ISSUE-NOTIF-UI-03 — MEDIUM
- **Where:** Notifications drawer
- **Why:** No Unread/All filter UI; API `?unreadOnly=` unused by drawer.
- **Classification:** FRONTEND
- **How to resolve:** Add filter → `list({ unreadOnly: true })`.
- **Screenshot:** `019-mgr-drawer-open.png`
- **Network:** `GET /notifications?unreadOnly=true` **200** (API OK)

### ISSUE-NOTIF-UI-04 — LOW
- **Where:** `/login` bootstrap (all roles)
- **Why:** Anonymous me/refresh → **401** console noise.
- **Classification:** FRONTEND
- **How to resolve:** Skip auth probes on public routes.
- **Screenshot:** `008-sa-final-badge.png`
- **Network:** `401 GET /api/auth/me` · `401 POST /api/auth/refresh`

### ISSUE-NOTIF-UI-05 — MEDIUM
- **Where:** MANAGER item click
- **Why:** Navigation without captured `PATCH …/read`; unread drifted under live fan-out before mark-all (`markedRead:5`).
- **Classification:** FRONTEND
- **How to resolve:** Await mark-read before route push; optimistic cache.
- **Screenshot:** `020-mgr-item-click.png`, `022-mgr-mark-all-read.png`
- **Network:** (miss) then `PATCH /notifications/read-all` **200**

### Stress OK
- Rapid open/close ×10 ×4 roles: **0** notif API fails, **0** stuck skeletons, **0** false empty states.
- Mark-all-read **200** (SA/HR/MGR); EMP control correctly absent at 0 unread.
- Mark-one-read **200** for SA/HR/EMP.

## NOTIF-API

> Deep stress Notifications REST (BE-heavy) · 2026-08-03 · BE `:4000` · tenant `acme-corp-001`  
> Evidence: `docs/e2e-ui-screenshots/stress/notifications-api/RESULTS.md`  
> UI drawer/bell covered separately under `notifications-ui` / EMP-SELF; this shard is API contract for FE clients.

### FE-relevant BE failures
- **Pagination:** do not send `page<=0` or `limit<=0` — BE may **500** (`page=-1`) or silently rewrite (`page=0`/`limit=0`).
- **since:** only send valid ISO-8601; invalid dates → BE **500** (not a friendly 400).
- **limit:** never request large pages — BE allows `limit=5000` (~1MB+ JSON); can freeze bell/drawer.
- **unreadOnly:** must be JSON boolean / `"true"`/`"false"` — `"TRUE"` / `"1"` / `"yes"` → **422**.
- **Aliases:** both `PATCH` and `POST` work for `/:id/read` and `/read-all` (empty JSON body OK for axios).

### STRESS-NOTIF-FE-01 — HIGH (client hardening)
- **Where:** Notification list / poller query builder
- **Why:** If FE ever forwards raw pager or date inputs, BE **500** on `page=-1` or bad `since` surfaces as generic errors / empty bell.
- **Classification:** FRONTEND
- **How to resolve:** Clamp page/limit client-side (min 1, max 50–100); validate `since` with `Date.parse` before GET
- **Screenshot:** n/a (API shard)
- **Network:** avoid `page=-1` / `since=not-a-date` (BE STRESS-NOTIF-BE-01/02)

### STRESS-NOTIF-FE-02 — MEDIUM
- **Where:** Notification infinite-scroll / “load more”
- **Why:** Unbounded BE `limit` means a buggy FE param can download **5000** rows (~1MB) and jank the UI.
- **Classification:** FRONTEND
- **How to resolve:** Hard-code FE page size (e.g. 20); never bind limit to user input
- **Screenshot:** n/a
- **Network:** prefer `limit=20` only

### STRESS-NOTIF-FE-03 — LOW
- **Where:** unread filter toggle
- **Why:** Sending `unreadOnly=1` or `TRUE` yields **422** — filter appears broken.
- **Classification:** FRONTEND
- **How to resolve:** Send boolean `true`/`false` (or string `"true"`/`"false"` only)
- **Screenshot:** n/a
- **Network:** `GET /notifications?unreadOnly=true` → **200**

### STRESS-NOTIF-FE-04 — MEDIUM (latency UX)
- **Where:** Bell badge + drawer initial fetch
- **Why:** BE holds ~**20k** notifications/user; list×20 p50 **700–1500ms**. Drawer can feel stuck even when API returns 200.
- **Classification:** FRONTEND
- **How to resolve:** Skeleton + abort/timeout; prefer unread-count for badge; paginate drawer (`limit=20`) never full dump
- **Screenshot:** n/a
- **Network:** `GET /notifications` slow **200**; badge via `GET /notifications/unread-count`

### FE note — mark-all vs expired (BE STRESS-NOTIF-BE-06)
- BE `markAllRead` can mark **expired** rows that list/count hide. FE should trust post-mark `unread-count` refresh, not `markedRead` alone (can be > visible unread).

### Working under stress (API)
- Login ×4 roles **200**
- List / unread-count bursts **200**
- Mark-read + mark-all-read aliases + race **200**; unread settles to 0
- Cross-user ids **404** (no leakage of others’ notification rows)
- Missing/bad JWT on notifications REST → **401**
## NOTIF-E2E-CREATE

> UI watch for create-path delivery · 2026-08-03 · FE `http://localhost:3001`  
> Screenshots: `docs/e2e-ui-screenshots/stress/notif-e2e-create/` (**8+** PNGs + `FINDINGS.md`)  
> Bell selector: `button[aria-label*="otif" i]` / `Notifications — N unread`

### UI checks
- `006-aman-bell-drawer.png` — aman drawer shows **New Leave Request** (“Priya Sharma requested 1 day(s) of Sick Leave”) + **Leave Request Withdrawn**; badge **2**
- `008-priya-bell-drawer.png` — priya drawer shows Leave Approved / attendance only — **no** self-targeted `leave_requested`
- Pending approvals card on aman = 0 after withdraw (consistent)

### Verdict
**PASS** — create-path delivery visible in UI; isolation holds on drawer contents
