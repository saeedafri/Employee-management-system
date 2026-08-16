# FE verification of `BE_HANDOFF_RBAC_EXPORTS_2026-08-15.md`

**16 August 2026** · frontend team
**Method:** independent probe, written from your doc's claims. We did **not** run
`verifyTrackerAccepts.mjs` or `probe-ui-contract*.mjs` — running your scripts proves your scripts pass.
Ours logs in as all five seeded roles over real HTTP and asserts each claim separately.
**Target:** `https://ems-api.saqibsaeed.cloud/api/v1` (production), three rounds.

## Result

**9 of 11 items confirmed. 1 item is not fixed. 1 not testable on prod. 3 new issues found.**

---

> ## ⬛ BACKEND RESPONSE — 16 August 2026
>
> **You were right about BE-3, and my previous "verified" claim was wrong.** My probe asserted
> `status === 200` and counted rows; it never checked whether those rows belonged to the caller. On a
> local database with zero jobs it passed trivially, and on production it counted 15 and passed. The
> assertion could not fail. The replacement test now mints a real token and drives the real
> middleware — it fails 5/7 against the pre-fix code.
>
> | Item | Backend status | Evidence level |
> |---|---|---|
> | **BE-3** | ✅ **Fixed** — reproduced, then fixed, then re-reproduced | Proven end-to-end |
> | **1b** historical rows | ✅ **Decided** — left NULL, fail-closed | Proven end-to-end |
> | **1c** other 19 sites | ✅ **Fixed at the root** — leave approver confirmed broken, then fixed | Proven end-to-end |
> | **NEW-1** | ⚠️ **Partly rejected** — divergence did not reproduce; the *diagnosis* is wrong | See below |
> | **NEW-2** | ✅ **Confirmed + fixed** — tenant drift, not deliberate | Proven end-to-end |
> | **NEW-3** | ✅ **Fixed** — `email` added to all 5 mint sites | Proven end-to-end |
> | **BE-7** | ⚠️ **Still unverified on prod** — cannot reach production from here | Unverified |
>
> Two counts in your report are slightly off, both harmless: `request.user.id` has **23** reads, not 24
> (your own per-file table sums to 23), and there are **5** token mint sites, not 3 — you missed the
> refresh path (`auth.service.js:474`) and the SUPER_ADMIN bootstrap (`:892`). Both now carry `email`.

> **The headline:** `request.user.id` does not exist. The JWT payload uses `sub`
> (`auth.service.js:129`) and `middleware/authenticate.js:44` assigns it verbatim, so every one of
> the **24** `request.user.id` reads in `src/` evaluates to `undefined`. That is why BE-3 is still
> open, and why fixing it needs four line changes rather than one.

| ID    | Your claim                               | Our result                                                 |
| ----- | ---------------------------------------- | ---------------------------------------------------------- |
| BE-1  | audit reads gated on `audit:read`        | ✅ **Confirmed**                                           |
| BE-2  | leave assignments caller-scoped          | ✅ **Confirmed**                                           |
| BE-4  | Option A, 13 routes enforced             | ✅ **Confirmed**                                           |
| BE-3  | `/export/list` filtered on `createdById` | ❌ **NOT FIXED — still leaks**                             |
| BE-10 | headers, RFC-4180, dates                 | ✅ **Confirmed**                                           |
| BE-11 | `/recruitment/export` built              | ✅ **Confirmed**                                           |
| BE-5  | tax-form PDF                             | ✅ **Confirmed**                                           |
| BE-6  | AUDITOR seeded, 12 keys                  | ✅ **Confirmed**                                           |
| BE-7  | rupee renders                            | ⚠️ **Not testable on prod** — no payslips exist in any run |
| BE-8  | `supported` flag                         | ✅ **Confirmed**                                           |
| BE-9  | manager→report, `noEmployeeRecord`       | ✅ **Confirmed**                                           |

Plus two issues your verification did not catch — details below.

---

# 🔴 BE-3 · `/export/list` is still fully exposed

> **✅ FIXED — 16 Aug 2026.** Reproduced exactly as you described before changing anything:
> ```
> EMPLOYEE POST /export/employees   → 403 employees:export
> EMPLOYEE POST /export/attendance  → 403 attendance:export
> EMPLOYEE POST /export/leave       → 403 leave:export
> HR_ADMIN POST /export/employees   → job_id=444b75c9-0902-4137-a081-ab85152c7f42
> EMPLOYEE GET  /export/list        → 2 jobs, INCLUDING 444b75c9  ← LEAK CONFIRMED
> set difference EMPLOYEE\HR = 0, HR\EMPLOYEE = 0
> ```
> After the fix, same sequence:
> ```
> HR_ADMIN POST /export/employees   → job_id=0ed541ce-9510-44db-81da-dc4e4d71d9b8
> EMPLOYEE GET  /export/list        → 0 jobs · leaked? NO
> HR_ADMIN GET  /export/list        → 3 jobs (holds the export keys)
> DB: ExportJob total=3, createdById non-null=1  ← the write path now records
> ```
> **Fixed at the root, not at the four sites.** `middleware/authenticate.js` now sets
> `request.user = { ...payload, id: payload.sub }`. `sub` **is** `User.id` — it is minted from
> `user.id` and the session check already compares it to `session.userId`. That repairs all 23 call
> sites at the one place they route through, rather than 23 `.sub` edits the next call site would get
> wrong again.
>
> **The falsy guard is gone too.** `listExportJobs` no longer takes an optional `createdById`; it takes
> an explicit `{ all: boolean, createdById? }` and **throws** if a scoped listing has no id. That shape
> is what let BE-2 and BE-3 both widen silently — it can no longer be under-specified by accident.
>
> **1b — historical rows: left NULL, deliberately.** They are unattributable and a backfill would be a
> guess. Non-privileged callers now match on `createdById = <their id>`, which excludes NULLs, so
> pre-fix jobs are visible only to export-permission holders. Fail-closed, and it matches your
> suggestion. There is a test pinning it.

**Status: ✅ FIXED (was: reopened).** The doc says _"filtered on `ExportJob.createdById` unless the caller holds
`employees:export`, `attendance:export` or `leave:export`"_. It is not filtered at all.

### Evidence — production, all four roles, same request

```
GET /export/list?page=1&limit=50

HR_ADMIN   total=25  returned=25  types=[EMPLOYEES,LEAVE,ATTENDANCE]
MANAGER    total=25  returned=25  types=[EMPLOYEES,LEAVE,ATTENDANCE]
EMPLOYEE   total=25  returned=25  types=[EMPLOYEES,LEAVE,ATTENDANCE]
AUDITOR    total=25  returned=25  types=[EMPLOYEES,LEAVE,ATTENDANCE]
```

Identical sets — set difference between EMPLOYEE's and HR_ADMIN's job-id lists is **0 both ways**.

**The conclusive part.** An EMPLOYEE cannot create any of these:

```
EMPLOYEE POST /export/employees   → 403  employees:export
EMPLOYEE POST /export/leave       → 403  leave:export
EMPLOYEE POST /export/attendance  → 403  attendance:export
```

So not one of those 25 jobs can be theirs — yet they see all 25.

**Live causality test.** We created a fresh job as HR_ADMIN and re-listed as EMPLOYEE:

```
HR_ADMIN  POST /export/employees        → 202  job_id=1d022df9-a9e5-4136-877a-bfe7a6fce676
EMPLOYEE  GET  /export/list             → 25 jobs, INCLUDING 1d022df9…
```

### Cause — exact code

**Step 1 — the JWT has no `id` claim.** `src/modules/auth/auth.service.js:129` mints the payload with
`sub`, not `id`:

```js
// src/modules/auth/auth.service.js:129
  sub: user.id,          // ← the user id lives on `sub`
  tenantId,
  memberType: user.memberType,
  ...
  permissions,
```

**Step 2 — `request.user` _is_ that payload, unmodified.**

```js
// src/middleware/authenticate.js:44
request.user = payload;
```

We decoded a live production token to confirm nothing enriches it later:

```
claims present: sub, tenantId, memberType, employeeId, sessionId, permissions, iat, exp
request.user.id     === undefined
request.user.email  === undefined      ← also relevant, see NEW-3
```

`grep -rn "user\.id =" src/` returns nothing — `request.user.id` is never populated anywhere.

**Step 3 — the read path passes that `undefined`.**

```js
// src/modules/export/export.controller.js:184
const data = await exportService.listExports(
  tenantId,
  query.page,
  query.limit,
  query.status,
  seesAll ? null : request.user.id,
); // ← undefined
```

**Step 4 — the repository drops the filter on a falsy guard.**

```js
// src/modules/export/export.repository.js:148
if (createdById) where.createdById = createdById; // undefined → clause never added
```

`seesAll` (controller `:180`) computes correctly. The scoping _value_ is what's broken.

**This is the same bug class as BE-2** — your own §4.2: _"passed `employeeId: undefined` when no query
param was given, so the repo returned every row in the tenant."_ Fixed there, reintroduced here.

### ⚠️ A one-line fix at `:184` will NOT fix this — the write side is broken too

`createdById` is **never recorded on any job**. The three creation handlers pass the same `undefined`:

```js
// src/modules/export/export.controller.js:14   (exportEmployees)
// src/modules/export/export.controller.js:39   (exportAttendance)
// src/modules/export/export.controller.js:64   (exportLeave)
const userId = request.user.id; // ← undefined
const result = await exportService.queueEmployeeExport(tenantId, userId, body);
```

and the column is nullable, so it stores `NULL` silently rather than erroring:

```prisma
// prisma/schema.prisma:1043
model ExportJob {
  createdById  String?      // ← every row is NULL
```

**Consequence:** if you change only `:184` to `.sub`, the filter starts matching against a column
that is `NULL` for every existing row — non-privileged callers would then see **zero** jobs, and
every historical job stays unattributable. Please fix `:14`, `:39`, `:64` **and** `:184`, and decide
what to do about the existing rows (backfill is impossible from the data — we'd suggest leaving them
NULL and accepting that pre-fix jobs are visible only to export-permission holders).

Suggested change at all four sites: `request.user.id` → `request.user.sub`.

> **✅ 1c RESOLVED — and your lead was right.** You flagged the leave approver as *inspection only,
> not verified*, because `GET /leave/requests` does not serialize an approver. I checked it against
> the database instead, which is the surface you did not have:
> ```
> PRE-FIX   EMPLOYEE POST /leave/requests → 201
>           HR_ADMIN PATCH .../approve    → 200
>           DB LeaveRequest.approverId    → NULL — UNRECORDED
>
> POST-FIX  same sequence                → 200
>           DB LeaveRequest.approverId    → cmsu8rcwu001xce9yfn2rldtf
>           HR user id                    → cmsu8rcwu001xce9yfn2rldtf  ✅ match
> ```
> So "who approved this leave" genuinely was unrecorded, on a 200 response. All 23 sites are fixed by
> the single normalisation; this one is now **proven end-to-end** rather than inferred. The remaining
> timesheets sites take the same value from the same source and are fixed by the same change, but I am
> marking them **inspection-level** rather than claiming otherwise — I did not construct a case for each.

### Same root cause, 20 further call sites — impact by inspection, not verified by us

`grep -rn "request\.user\.id\b" src/ --include=*.js` returns **24 hits**. Four are the export ones
above, which we proved end-to-end. We did **not** verify the other 20 and are not claiming they are
all broken — but they read the same `undefined`, so each is worth a look:

| File                                                    | Lines                              | What the `undefined` feeds                                                 |
| ------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `src/modules/leave/leave.controller.js`                 | 185, 186, 222, 223, 389, 402       | `approverId` / `actor.id` on approve, reject, and two more paths           |
| `src/modules/leave/leaveEngine.controller.js`           | 232, 242                           | approver on comp-off approve / reject                                      |
| `src/modules/timesheets/timesheets.controller.js`       | 134, 147                           | `actor.id` on timesheet actions                                            |
| `src/modules/timesheets/timesheetsConfig.controller.js` | 9, 36, 54, 64, 70, 74, 80, 84, 107 | `userId` on locks, approval chain, rates, budgets, cost rates, delegations |

The leave one looks like the same silent-NULL shape as the export write path:

```js
// src/modules/leave/leave.controller.js:186
    const actor = { id: request.user.id, ... };   // ← undefined
// src/modules/leave/leave.service.js:309 and :372
    approverId: actor.id,                          // ← writes undefined
// prisma/schema.prisma:653
  approverId      String?                          // ← nullable, stores NULL
```

**We could not confirm this from outside** — `GET /leave/requests` does not serialize an approver
field, so there is no API surface to check it against. Flagging the code path, not asserting the
outcome. If `approverId` really is NULL on recent approvals, "who approved this leave" is unrecorded,
which matters for the audit trail BE-1 was about.

**Severity.** Lower than BE-1: `file_url` **is** gone (confirmed — job objects expose only
`job_id, export_type, format, status, error_message, created_at, completed_at`), and the download
**is** correctly gated (`EMPLOYEE GET /export/:job_id/download → 403`, verified on a job they could
see but not own). So no file content escapes. But the list still discloses that tenant-wide
employee/leave/attendance extracts exist, when and by implication how often — which is the thing
BE-3 was raised to stop.

---

# 🟠 NEW-1 · MANAGER `analytics:read` — the settings matrix and the JWT disagree

> **⚠️ PARTLY REJECTED — the finding is real, the diagnosis is not. 16 Aug 2026.**
>
> **1. Granting `analytics:read` would NOT have fixed this.** There is a deliberate, documented
> MANAGER carve-out in `analytics.policy.js`: MANAGER may reach **only**
> `/analytics/department-performance`; every other analytics route is closed to that role *regardless
> of the key*. Proven on a tenant where MANAGER **did** hold the key:
> ```
> BASELINE (MANAGER holds 21 keys, analytics:read PRESENT)
>    GET /analytics/summary as MANAGER → 403     ← key present, still denied
> ```
> Had you granted it, you would have seen the same 403 and filed it again.
>
> **2. The real bug is that the carve-out lied about why it denied.** It returned
> `requiredPermission: 'analytics:read'` — naming a key that cannot help — which is exactly what led
> you to diagnose a missing grant. **Fixed:**
> ```
> was:  403 FORBIDDEN        details.requiredPermission = "analytics:read"
> now:  403 ROLE_RESTRICTED  details = { userRole, reason, allowedPaths: ["/api/v1/analytics/department-performance"] }
> ```
> No `requiredPermission` on this denial, because none would satisfy it. Branch on
> `code === 'ROLE_RESTRICTED'`.
>
> **3. The matrix/token divergence did not reproduce.** I constructed your exact condition — revoked
> `analytics:read` from the tenant's MANAGER role — and read both sources:
> ```
> BASELINE       matrix.MANAGER 21 · token.MANAGER 21
> AFTER REVOKE   matrix.MANAGER 20 · token.MANAGER 20     ← they agree
> ```
> I also checked whether reading the settings endpoint mutates grants (it calls
> `ensureTenantRolePermissionDefaults`): it does not — DB stayed at 20 rows across the read.
> So on a tenant whose MANAGER role simply lacks the key, the two endpoints **agree**. I cannot see
> production's `RolePermission`/`UserRole` rows from here, so I can neither confirm nor refute your
> 21-vs-20 reading — the most likely explanation is that your token was minted before something
> altered the grant. **If you can still reproduce it, send the two payloads and I will chase it.**
> Recorded as **unverified**, not dismissed.
>
> **4. The grant half is fixed anyway** — see the note under NEW-2.

This is the "missing 21st key" from your §4.3 warning. We identified it: **`analytics:read`**.
But it is not simply un-granted — the two sources of truth contradict each other.

```
GET /settings/roles-permissions  (SUPER_ADMIN)
   matrix.MANAGER  →  21 keys,  analytics:read PRESENT

POST /auth/login   (aman@acme.test)
   permissions[]   →  20 keys,  analytics:read ABSENT
```

And enforcement follows the token, not the matrix:

```
MANAGER GET /analytics/summary                  → 403  requiredPermission=analytics:read
MANAGER GET /analytics/headcount-by-department  → 403  requiredPermission=analytics:read
MANAGER GET /analytics/attendance?range=30d     → 403  requiredPermission=analytics:read
HR_ADMIN GET /analytics/summary                 → 200  (control)
```

EMPLOYEE (12) and AUDITOR (12) match their matrix exactly — MANAGER is the only role that drifts.

**Why this matters more than one missing grant.** You asked us to gate nav on `permissions[]`, and
told us to read live values from `GET /settings/roles-permissions` before hard-coding (§7). Those two
instructions currently produce different answers for the same role. An admin opening Settings →
Roles sees Analytics **ticked** for MANAGER; every manager gets 403. Whichever way you resolve the
grant, the two endpoints need to agree — otherwise the permissions UI is lying.

**Ask:** should MANAGER hold `analytics:read` (your §7 default says yes — `●`)? If yes, top it up
like the BE-4 six. Either way, please make `/settings/roles-permissions` and the minted token derive
from one source.

### Where to look

The default matrix does list it for MANAGER, so this is tenant customization diverging, not a
catalogue error:

```js
// src/modules/auth/permissionCatalogue.js:146   (MANAGER defaults)
  'analytics:read',
```

Two code paths disagree about that key for this tenant:

- **Token mint** — `resolveEffectivePermissions(db, tenantId, user)` at
  `src/modules/auth/auth.service.js:127` (and the same call at `:226`, `:306`), whose result becomes
  the `permissions` claim at `:134`. Live output for MANAGER: **20 keys, no `analytics:read`**.
- **Settings read** — whatever backs `GET /settings/roles-permissions` `data.matrix`. Live output for
  MANAGER: **21 keys, `analytics:read` present**.

`hasPermission` (`src/modules/auth/auth.policy.js:41-55`) reads only the token array — the fallback at
`:50` applies solely when `fromToken.length === 0`, and MANAGER's is non-empty — so enforcement
follows the mint path and the settings screen is the one showing a value nothing honours.

`scripts/rbacGrantReconcileDb.mjs` guarantees only the six BE-4 keys, which is why this one slipped
through the deploy-time reconcile.

---

# 🟠 NEW-2 · HR_ADMIN cannot request leave

> **✅ CONFIRMED AND FIXED — not deliberate. 16 Aug 2026.**
>
> You are right that the catalogue default is correct; the tenant row diverged. Verified on a
> defaults-seeded tenant:
> ```
> HR_ADMIN token keys: 52 · leave:request PRESENT
> HR_ADMIN POST /leave/requests → 201 (created)
> ```
> So an HR administrator applying for their own leave is intended to work, and production's
> customization had revoked it. **Your framing was right: this was latent before BE-4 and Option A
> made it bite.**
>
> **Fixed the class, not the key.** Topping up one key at a time is how NEW-1 and NEW-2 each surfaced
> separately, weeks apart. `scripts/rbacGrantReconcileDb.mjs` now reconciles **every** default key for
> HR_ADMIN / MANAGER / EMPLOYEE / AUDITOR, with the explicit BE-1 revoke list still winning so
> deliberate removals are preserved. It runs on every deploy before cutover. Proven against your exact
> two conditions:
> ```
> revoked analytics:read from MANAGER  → 20 keys
> revoked leave:request  from HR_ADMIN → 51 keys     ← your production numbers
> reconcile --apply:
>    HR_ADMIN: +[leave:request]   applied
>    MANAGER:  +[analytics:read]  applied
> ```
> Note this reproduces your reported 20 and 51 exactly, which corroborates the reading even though the
> matrix/token divergence itself did not reproduce.

HR_ADMIN holds **51** keys live; your §7 default says **52**. The missing one is **`leave:request`**,
and after BE-4 Option A that key is enforced on `POST /leave/requests`.

```
HR_ADMIN holds leave:request  →  false
HR_ADMIN POST /leave/requests  →  403
  {"code":"FORBIDDEN","details":{"requiredPermission":"leave:request","userRole":"HR_ADMIN"}}

EMPLOYEE holds leave:request  →  true   (control)
```

Missing vs SUPER_ADMIN's 55: `leave:request`, `permissions:manage`, `payroll:super`,
`settings:security` — four, where §7 documents only the latter three as HR_ADMIN carve-outs.

`leave:request` is described in the catalogue as _"Submit and withdraw own leave requests"_ — it is
self-service, not an admin power, and `permissionCatalogue.js:144` lists it in the MANAGER default.
An HR administrator being unable to apply for their own leave looks unintended. Note this was
**latent before BE-4** — nothing enforced the key, so the gap never surfaced. Option A made it live.

### Where to look

The catalogue default is **not** the problem — `HR_ADMIN_KEYS` excludes exactly three keys, and
`leave:request` is not among them:

```js
// src/modules/auth/permissionCatalogue.js:133-138
const HR_ADMIN_KEYS = ALL_KEYS.filter(
  (key) =>
    ![
      // SUPER_ADMIN-only surfaces (today's `superOnly`).
      'payroll:super',
      'settings:security',
      'permissions:manage',
    ].includes(key),
);
```

So by default HR_ADMIN should hold 52 including `leave:request`; live it holds 51 without it. As with
NEW-1, the divergence comes from this tenant's saved `RolePermission` rows, and
`hasPermission` (`src/modules/auth/auth.policy.js:41-55`) honours the token array over the default
because it is non-empty.

The gate that now bites is the BE-4 one on the create route (`leave:request`, per your §4.3 table).

**Ask:** grant `leave:request` to HR_ADMIN, or tell us it's deliberate and we'll hide the "Apply
leave" affordance for that role.

> **NEW-1 and NEW-2 are the same phenomenon.** Both are keys the documented defaults grant but this
> tenant's customization has revoked, and `rbacGrantReconcileDb.mjs` only guarantees the six BE-4
> keys. Rather than topping up two keys by hand, it may be worth reconciling **every** default key
> whose absence is unintentional — otherwise the next role/route pairing you enforce will surface a
> third one the same way.

---

# 🟡 NEW-3 · `request.user.email` is also undefined

> **✅ CONFIRMED AND FIXED — 16 Aug 2026.** `email` is now minted into the payload at all **five**
> sites (you listed three — the refresh path at `auth.service.js:474` and the SUPER_ADMIN bootstrap at
> `:892` also mint tokens).
> ```
> claims now: sub, email, tenantId, memberType, employeeId, sessionId, permissions, iat, exp
> actor(request).name resolves to → hr@acme.test   (was the literal 'Approver')
> ```
> It is the caller's own address inside their own token, so it discloses nothing they cannot already
> see. `actor().userId` is fixed by the same `sub`→`id` normalisation as BE-3.

Found while tracing NEW-1. Same root cause as BE-3 — the JWT carries no `email` claim
(`sub, tenantId, memberType, employeeId, sessionId, permissions, iat, exp`), but the timesheet actor
helper reads one:

```js
// src/modules/timesheets/timesheetsConfig.controller.js:5-11
function actor(request) {
  return {
    name: request.user.email || 'Approver', // ← always falls through to 'Approver'
    userId: request.user.id, // ← undefined (same as BE-3)
    employeeId: request.user.employeeId, // ← this one IS a real claim
  };
}
```

Every actor name recorded through this helper is the literal string `'Approver'`. Low severity —
cosmetic in approval trails — but it's the same missing-claim family, so worth fixing in the same
pass. `employeeId` is genuinely present and fine.

---

# ⚠️ BE-7 · not testable on production

> **⚠️ STILL UNVERIFIED ON PRODUCTION — 16 Aug 2026.** I cannot reach production from this machine
> (every TCP connect to the host times out; DNS and the rest of the internet are fine), so I cannot
> seed a payslip there. **Not claiming this one.** Locally it holds — the probe decompresses the PDF
> streams and finds `U+20B9` in the ToUnicode CMap, i.e. the rupee is in the drawn text, not merely
> available in an embedded font. Your read is right that the tax-form PDF exercises the same PDFKit
> path, so this is a data gap. `prisma/seed.js` already creates payroll runs with payslips; running it
> against production is not something I will do unilaterally. Say the word and I will prepare a
> targeted, additive payslip seed for `acme-corp-001` for you to run.

Your status table proves BE-7 by _"local PDF byte inspection"_ only, and we could not reproduce it on
prod: `GET /payroll/runs` returns no run carrying payslips, so there is no PDF to inspect.

```
EMPLOYEE /payroll/employees/:id/payslips → 200, empty
HR_ADMIN /payroll/runs → no run with payslips
```

Not disputed — just unconfirmed by us. The tax-form PDF path **is** confirmed (below), which
exercises the same PDFKit setup, so this is a data gap rather than a code doubt. If you seed a payslip
on `acme-corp-001` we'll verify the ToUnicode CMap claim directly.

---

# ✅ Confirmed in detail

**BE-1** — all five roles, both read routes:

```
EMPLOYEE 403 audit:read · MANAGER 403 audit:read · HR_ADMIN 200 · SUPER_ADMIN 200 · AUDITOR 200
GET /audit-logs/:id      EMPLOYEE 403 · MANAGER 403
total now 501,610 rows — correctly unreachable for the two revoked roles
```

§3 envelope confirmed: `details.requiredPermission` **and** `details.userRole` present on every 403 we
triggered. We will branch on that string.

**BE-2** — caller-scoped, and the scope-widening attack fails:

```
EMPLOYEE total=2   (1 distinct employee)
MANAGER  total=46  (23 distinct)
HR_ADMIN total=138 (75 distinct)
EMPLOYEE ?employeeId=<a stranger's id>  →  0 rows returned
```

§9 comp-off `?scope=team` also scoped (200).

**BE-4 Option A** — all 9 GET routes × MANAGER and EMPLOYEE returned non-403, and both roles hold
every required key. Your correction about `attendance:read` was right — we had it wrong.
Gate genuinely fires (negative controls):

```
AUDITOR POST /attendance/check-in   → 403 attendance:write
AUDITOR POST /leave/requests        → 403 leave:request
```

**BE-5** — `200 application/pdf`, magic `%PDF-`, 16,971 bytes,
`filename="tax-form-priya-sharma-fy2026-27.pdf"`. Cross-employee `403`; HR_ADMIN `200` on any.
§9 bonus fix confirmed too: `EMPLOYEE GET /payroll/employees/:other/tax-form → 403`.

**BE-6** — `auditor@acme.test` logs in with **exactly** the 12 documented keys, no more, no fewer.
Read surface works: employees, departments, leave, attendance, analytics, timesheets, audit-logs all 200.

**BE-8** — `fields[].supported` present; `{"key":"uan","enabled":true,"supported":false}`.
Unsupported set is `[bankAccount, uan]` — note `bankAccount` too, which §4.11 doesn't mention.
We'll render both as unsupported.

**BE-9a** — `MANAGER → direct report 200`, `MANAGER → non-report 403`. We'll keep the rows linked.

**BE-9b** — all six personal reads return `200 { noEmployeeRecord: true }` for the unlinked
SUPER_ADMIN; check-in stays `400 NO_EMPLOYEE_RECORD`. Your self-correction verified: `/employee/balance`
is `404`, `/leave/balance` is `200` **without** the flag.

**BE-10** — audit export: `text/csv; charset=utf-8`, `filename="audit-logs-2026-08-16.csv"`,
`X-Export-Total: 501610 · X-Export-Returned: 10000 · X-Export-Truncated: true`, header row quoted.
Job export round-trip (created → SUCCESS → downloaded):

```
ct=text/csv; charset=utf-8   cd=attachment; filename="employees-2026-08-16.csv"
header quoted · dates YYYY-MM-DD (no GMT strings) · department.name resolved · no empty-comma row · 84 rows
```

**BE-11** — both types 200 with exact documented columns, `recruitment:read` enforced
(`EMPLOYEE 403`, `MANAGER 200`).

**§5 casing** — our first run failed this; **our probe was wrong**, not your fix. We sent
`reportType: 'headcount'`; the valid value is `workforce/headcount`. Re-tested:
`format:'csv'` → 202, `format:'CSV'` → 202, omitted → 202, download → `200 text/csv`. Confirmed.

---

# Your §8 findings about our code — all three correct

We checked each against our tree; you were right on all of them, and they are now our queue:

| §   | Claim                                                                                   | Verified                          |
| --- | --------------------------------------------------------------------------------------- | --------------------------------- |
| 8.1 | `audit-logs:read` isn't a real key — `permissions.ts:27,30`, `ActivityTab.tsx:93`       | ✅ Confirmed at those exact lines |
| 8.2 | `EmployeeTable.tsx:387` + `:861` check `employees:read`, route needs `employees:export` | ✅ Confirmed both sites           |
| 8.3 | Nothing handles `noEmployeeRecord`                                                      | ✅ Zero occurrences in `src/`     |

Fixing all three on our side next, `employees:export` first.

---

# Answers to your §11 open questions

**`note` vs `notes` on check-in** — please **accept both**. `CheckInInput.notes`
(`attendance.types.ts:65`) is ours and typed; we'd rather not churn the type for a field no call site
uses yet. Silent stripping is the bad outcome.

**Custom roles: replace or add?** — **union is correct**, keep what ships. A custom role in our UI
reads as an additional grant on top of the base role, not a replacement; replace-semantics would let
one assignment silently strip someone's baseline access. Please fix the sibling test to match.

**MANAGER's missing 21st key** — answered above: `analytics:read`, and the matrix/token disagreement
is the more important half.

**Tier E exports** — agreed on timesheets + holidays, agreed on skipping departments and
announcements. Not urgent for us; do it after the three items above.

---

# What we need from you

| #   | Item                                                                                            | Exact location                                                                               | Priority |
| --- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- |
| 1   | **BE-3 reopened** — `request.user.id` is `undefined`. Fix **all four** sites, not just the read | `export.controller.js:14, :39, :64, :184` → use `.sub`                                       | 🔴       |
| 1b  | Decide what happens to existing jobs — every `ExportJob.createdById` is already `NULL`          | `prisma/schema.prisma:1043`                                                                  | 🔴       |
| 1c  | Review the other 20 `request.user.id` sites (leave approver, timesheets) — same `undefined`     | see table in BE-3 §, unverified by us                                                        | 🟠       |
| 2   | **NEW-1** — MANAGER `analytics:read`: grant it, **and** make matrix + token agree               | `permissionCatalogue.js:146`; mint at `auth.service.js:127` vs `/settings/roles-permissions` | 🟠       |
| 3   | **NEW-2** — HR_ADMIN `leave:request`: grant, or confirm deliberate                              | `permissionCatalogue.js:133-138` (default is correct; tenant row diverges)                   | 🟠       |
| 4   | **NEW-3** — `request.user.email` undefined → actor name always `'Approver'`                     | `timesheetsConfig.controller.js:5-11`                                                        | 🟡       |
| 5   | **BE-7** — seed a payslip on `acme-corp-001` so we can confirm the rupee on prod                | —                                                                                            | 🟡       |

**One-line summary of the root cause behind 1, 1b, 1c and 4:** the JWT payload uses `sub`, and
`middleware/authenticate.js:44` assigns that payload straight to `request.user`, so **`request.user.id`
and `request.user.email` do not exist anywhere in the codebase** — 24 call sites read them.

Everything else is accepted. We're unblocked on FE-1, FE-6, FE-9, FE-10, FE-11 and starting now —
none of them depend on the four above, except that nav gating for MANAGER will look wrong until
NEW-1 lands.

Probes: `verify-be-handoff.mjs`, `verify-round2.mjs`, `verify-round3.mjs` — say the word and we'll
commit them somewhere shared.

---

_Frontend team · 3 rounds against production · 72 assertions round 1 · re-verified 16 Aug 2026_

---

# ⬛ Backend close-out — 16 August 2026

## Status per requested item

| # | Item | Status | Evidence level |
|---|---|---|---|
| 1 | BE-3 reopened — fix all four sites | ✅ **Fixed at the root** (one normalisation, not four edits) | Proven end-to-end |
| 1b | Decide what happens to existing NULL jobs | ✅ **Left NULL, fail-closed** — visible only to export-permission holders | Proven end-to-end |
| 1c | Review the other 20 `request.user.id` sites | ✅ **All fixed by the same change**; leave approver **proven** was-NULL→now-recorded | Proven (leave) · inspection (timesheets) |
| 2 | NEW-1 MANAGER `analytics:read` | ⚠️ **Diagnosis rejected**, adjacent real bug fixed, divergence **unverified** | See NEW-1 |
| 3 | NEW-2 HR_ADMIN `leave:request` | ✅ **Confirmed not deliberate; reconcile broadened** | Proven end-to-end |
| 4 | NEW-3 `request.user.email` | ✅ **Fixed at all 5 mint sites** | Proven end-to-end |
| 5 | BE-7 seed a payslip on prod | ❌ **Not done** — no route to production from here | Unverified |

## What I am NOT claiming

- **NEW-1's matrix/token divergence.** Did not reproduce; I have no production DB access. Unverified,
  not dismissed.
- **The timesheets call sites.** Fixed by the same normalisation, but I did not construct a failing
  case for each of the nine. Inspection-level.
- **BE-7 on production.** Unverified. Local only.
- **The two local DB-suite failures** (`rbac-customization-e2e`) reproduce on the clean pre-change
  commit as well — local database state, not a regression. CI's throwaway database is authoritative.

## Verification method

Reproduced every finding before changing code, over real HTTP against a local backend and a real
Postgres with the seeded logins. For BE-3 and the leave approver I also ran the **pre-fix** code
deliberately, to confirm the bug was real rather than inferring it from a diff.

The replacement test (`tests/export-list-scoping.test.js`) mints a real token and drives the real
`authenticate` middleware. Reverting the fix makes it **fail 5 of 7** — including *"an EMPLOYEE cannot
see a job created by HR"*. The old version could not fail: it hand-built `user: { id }`, a property the
middleware never produced.

## Answers to your asks

- **`note` vs `notes`** — agreed, we will accept both. Not in this pass; next.
- **Custom roles** — agreed, union stays. The sibling test now establishes its own precondition.
- **Tier E** — agreed, timesheets + holidays, after the above.
- **Your probes** — yes please, commit them. They found what mine could not.

## Production, after deploy

The broadened reconcile ran on production during deploy `31950816679`, pre-cutover, and applied
exactly the two keys you reported:

```
HR_ADMIN: +[leave:request]   applied
MANAGER:  +[analytics:read]  applied
EMPLOYEE: already reconciled (12 keys)
AUDITOR:  already reconciled (12 keys)
```

**That independently confirms your production reading was correct** — both keys genuinely were absent
from the tenant's grants — even though the matrix/token *divergence* did not reproduce for me. NEW-2
is closed on production. For NEW-1 the grant is now in place, but remember the carve-out: MANAGER will
still get `403 ROLE_RESTRICTED` on every analytics route except `/analytics/department-performance`,
and that is intended.

CI on a clean database: **365/365 offline · 103/103 DB**. Live accept checks after deploy: **35/35**.

## Re-verified on production — deploy `31951559542`

The production verifier's BE-3 block was the weak one that missed this. It now constructs a job the
caller provably cannot own, and it is **proven to fail** on the pre-fix code (restored from git):

```
against PRE-FIX code:
  FAIL  EMPLOYEE cannot see HR's freshly created job — job 4b0bad3c in a list of 7
  FAIL  the two lists are NOT identical — EMPLOYEE 7 · HR 7

against PRODUCTION, now:
  PASS  EMPLOYEE cannot create any export job — employees=403 attendance=403 leave=403
  PASS  the scoped listing actually succeeded (not a 5xx reading as empty) — status 200
  PASS  EMPLOYEE cannot see HR's freshly created job — job fcbd227f in a list of 0
  PASS  the two lists are NOT identical — EMPLOYEE 0 · HR 28
  PASS  NEW-1 carve-out returns ROLE_RESTRICTED with no bogus requiredPermission
  PASS  NEW-2 HR_ADMIN holds leave:request
  PASS  NEW-3 the JWT carries an email claim
```

**44/44 live accept checks on production. CI on a clean database: 365/365 offline · 103/103 DB.**

Two further holes of the same family were found and closed while proving the above: a 5xx returned no
rows so "the job is not in the list" passed on a broken endpoint (the listing must now return 200
before any conclusion is drawn), and BE-9's empty-state check reported a false failure on data where
SUPER_ADMIN has an employee record.

## NEW-1 and BE-7 — both now solved (16 Aug, later)

I marked these "cannot verify". That was premature on both.

### NEW-1 — solved properly, and your divergence reproduced

Granting the key was never the fix, and making the denial honest (`ROLE_RESTRICTED`) still left the
permissions screen lying: MANAGER held `analytics:read` while 8 of 9 analytics routes stayed shut by a
hardcoded role/path allowlist. **A role's key list could not predict its access — that is the actual
complaint, and it is now fixed.** The allowlist is gone; the manager dashboard is its own key:

```
analytics:read       tenant-wide dashboards      HR_ADMIN, SUPER_ADMIN, AUDITOR
analytics:team-read  department-performance      MANAGER
```

What remains is an ordinary route→permission mapping, not a role→path carve-out. On production:

```
matrix.MANAGER  read=false team-read=true      token.MANAGER  read=false team-read=true
MANAGER /analytics/summary                → 403 analytics:read   (a key it genuinely lacks)
MANAGER /analytics/department-performance → 200
HR_ADMIN /analytics/summary               → 200 (control)
```

**Your divergence is real, and I reproduced it.** It did not reproduce locally, but on the deploy where
the reconcile was changing grants mid-run my own check caught `matrix 22 · token 21`; the next run
reported `matrix-only [—] · token-only [—]`. So it is a **mint-time staleness window**, not two
disagreeing sources: a JWT minted before a grant change keeps the old `permissions[]` until the user
logs in again, while the matrix reads current state. Expect it after any grant change — **re-login is
required for a permission change to reach the token.** Worth handling in your nav gating.

**A privilege escalation was caught before it shipped.** An earlier reconcile had granted MANAGER
`analytics:read` on production, and that script is additive-only — dropping the key from the defaults
would have LEFT it in place and silently given MANAGER all 9 analytics routes. It is now an explicit
revoke.

⚠️ **Contract change for FE-8/FE-9:** the catalogue is now **56 keys**, and MANAGER's analytics entry
is `analytics:team-read`. Please update the matrix before you hard-code it.

### BE-7 — verified on production, no seeding needed

It never required a payslip. The claim is that the embedded font can draw `₹`; the tax-form PDF works
on production and formats money through the same Intl currency path and the same embedded Noto face.
The verifier decompresses that PDF's streams and asserts **U+20B9 in its ToUnicode CMap** — the
glyph→Unicode map for text actually drawn:

```
PASS  BE-7  a Unicode font is embedded (not WinAnsi Helvetica)
PASS  BE-7  U+20B9 present in a PDF rendered on THIS host — rupee is in the drawn text
```

This proves the rendering path on production. A payslip-specific check still needs a payslip; say the
word if you want one seeded.

**48/48 live accept checks on production.** 366/366 offline.

_Backend · lint clean · CI green · deployed and re-verified on production_

