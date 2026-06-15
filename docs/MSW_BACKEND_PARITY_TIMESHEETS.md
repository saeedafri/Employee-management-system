# Timesheets — MSW ↔ Backend parity audit

> Date: 2026-06-14. Compares the UI team's MSW mock
> (`ems-frontend/src/mocks/handlers/timesheets.ts`, the reference "formula engine")
> against the live backend (`src/modules/timesheets/*`). Goal: every endpoint the UI
> calls exists in the backend, and every computed value / contract matches the mock.

## 1. Endpoint coverage — 20/20 present ✅

Every endpoint the MSW handler mocks has a matching backend route (`timesheets.routes.js`):

| MSW endpoint | Backend route | Status |
|---|---|---|
| GET `/timesheets` | GET `/timesheets` | ✅ |
| POST `/timesheets/entries` | POST `/timesheets/entries` | ✅ |
| PATCH `/timesheets/entries/:id` | PATCH `/timesheets/entries/:id` | ✅ |
| DELETE `/timesheets/entries/:id` | DELETE `/timesheets/entries/:id` | ✅ |
| GET `/timesheets/settings` | GET `/timesheets/settings` | ✅ |
| PATCH `/timesheets/settings` | PATCH `/timesheets/settings` | ✅ |
| GET `/timesheets/summary` | GET `/timesheets/summary` | ✅ |
| POST `/timesheets/:id/submit` | POST `/timesheets/:id/submit` | ✅ |
| POST `/timesheets/:id/recall` | POST `/timesheets/:id/recall` | ✅ |
| POST `/timesheets/copy-week` | POST `/timesheets/copy-week` | ✅ |
| GET `/timesheets/approvals` | GET `/timesheets/approvals` | ✅ |
| POST `/timesheets/:id/approve` | POST `/timesheets/:id/approve` | ✅ |
| POST `/timesheets/:id/reject` | POST `/timesheets/:id/reject` | ✅ |
| GET `/timesheets/projects` | GET `/timesheets/projects` | ✅ |
| POST `/timesheets/projects` | POST `/timesheets/projects` | ✅ |
| PATCH `/timesheets/projects/:id` | PATCH `/timesheets/projects/:id` | ✅ |
| DELETE `/timesheets/projects/:id` | DELETE `/timesheets/projects/:id` | ✅ |
| GET `/timesheets/projects/:id/tasks` | GET `/timesheets/projects/:id/tasks` | ✅ |
| POST `/timesheets/projects/:id/tasks` | POST `/timesheets/projects/:id/tasks` | ✅ |
| PATCH `/timesheets/tasks/:id` | PATCH `/timesheets/tasks/:id` | ✅ |

> MSW BASE is `/api/timesheets`; the live backend is `/api/v1/timesheets`. The FE BFF
> proxy (`ems-frontend/src/app/api/[...path]/route.ts`) rewrites `/api/*` → `${API_BASE_URL}/*`
> where `API_BASE_URL=…/api/v1`, so the paths line up at runtime. (Verified in UI repo.)

## 2. Formula-engine deltas — aligned to MSW ✅

| # | Value | MSW engine | Backend (before) | Fix |
|---|---|---|---|---|
| A | weekly `totalHours` | `round2(Σ hours)` | `Σ hours` unrounded | `round2` in `recalcTimesheetTotal` |
| B | entry `billable` when omitted | `task.billable ?? project.billable ?? false` | Prisma `@default(true)` | infer `task ?? project ?? billableDefault ?? true` in `service.createEntry` |
| C | summary `byProject`/`byEmployee` | `round2` + sort by `hours` desc | unrounded, unsorted | `round2` + `.sort((a,b)=>b.hours-a.hours)` |
| D | `round2` definition | `Math.round(n*100)/100` | `Math.round((n+EPSILON)*100)/100` | dropped EPSILON — byte-for-byte match |
| E | `fmtSheet` `billableHours`/`overtimeHours` | `round2(…)` | unrounded | wrapped in `round2` |

## 3. Behavioral / contract deltas — fixed this pass ✅

Found by reading the MSW engine + **driving the live Render DB read-only**:

| # | Endpoint(s) | MSW behavior | Backend (before) | Fix |
|---|---|---|---|---|
| 1 | POST/PATCH `/projects` | dup `code` → **409 DUPLICATE_CODE** | no check (silently allowed dupes) | `assertUniqueCode` (case-insensitive) → 409; UI `ProjectDrawer` branches on HTTP 409 |
| 2 | PATCH/DELETE `/entries/:id` | edits on SUBMITTED/APPROVED → **422 WEEK_LOCKED** | allowed (no guard) | `assertWeekEditable` via `getEntryById` (entry→timesheet status) |
| 3 | GET `/approvals` | each row's `billableHours` from its entries | **always 0** (entries not loaded) | `getPendingTimesheets` now `include: { entries }` — verified live: billable now 34 on a 39.5h sheet |
| 4 | DELETE `/projects/:id` | archive if it has tasks, else delete | archived only if it had **entries** | archive if tasks **or** entries (matches MSW + never hard-deletes logged work) |
| 5 | GET `/timesheets` | returns `employeeName` | returned `''` | enrich name from Employee table |
| 6 | error codes | `WEEK_LOCKED` / `ALREADY_SUBMITTED` / `NOT_SUBMITTED` | `TIMESHEET_LOCKED` / `INVALID_STATUS` | renamed to MSW codes (UI shows `message`, but codes now match the contract) |
| 7 | POST `/:id/reject` | empty/blank comment → **422 VALIDATION** + `details` | accepted blanks | route `minLength:1` (→ 422+details) + service trim guard |

### Already matching before this pass (no change)
- summary `overtimeHours` (`Σ max(0, weekTotal − standardWeeklyHours)`, always a number),
  `totalHours`/`billableHours`/`nonBillableHours`/`utilizationPct`.
- copy-week unique-row dedup (`projectId::taskId??''`, hours:0, idempotent, `WEEK_LOCKED`).
- recall (`SUBMITTED → DRAFT`, owner-only, `422 NOT_RECALLABLE`).
- `taskId` null/omit tolerance (no 500 on null FK).
- M2 `requireTaskOnEntry` (`422 TASK_REQUIRED`), M7 submit-reminder job + settings.

## 4. Flagged — for the UI team / known intentional divergences ⚠️

1. **FE mock is missing two settings fields.** `ems-frontend/src/mocks/handlers/timesheets.ts`
   `timesheetSettings` does not include `submitReminderDay` or `requireTaskOnEntry`, which
   live `GET/PATCH /timesheets/settings` now returns. Add to the mock default:
   ```ts
   submitReminderDay: null,      // int 1..7 (ISO weekday) | null = disabled
   requireTaskOnEntry: false,
   ```
2. **Backend is a deliberate superset (harmless):**
   - summary `byEmployee` adds `billableHours` + `employeeCode` (MSW omits). FE reads by key.
   - `createEntry` billable final fallback is `billableDefault ?? true` vs MSW's `false`;
     identical in practice (a valid `projectId` FK is always present, so it resolves to
     `project.billable` either way).
   - `POST /entries` response includes nested `project`/`task` objects; the FE reads flat
     fields and fetches project/task separately, so the extras are ignored.
   - GET `/timesheets` is get-or-**create** (persists an empty DRAFT) vs MSW's synthesize-
     without-persist. Idempotent via the `(tenant,employee,weekStart)` unique key.

## 5. Verification

- **Schema/migrations on live Render DB:** `20260614120000_timesheet_reminder_settings`
  and `20260614130000_timesheet_reminder_dedupe_index` both **APPLIED** (columns +
  partial-unique dedupe index present). M7/M2 code will not 500 on missing columns.
- **DB-free unit suite** `tests/timesheets-derivations.test.js`: **25/25 pass**
  (overtime, taskId-normalize, copy-week dedup, round2 parity, `isEditableWeek`, M7 helpers).
- **ESLint** `src/`: clean (CI lint gate). **App loads** (CI build gate): OK.
- **Live Render DB, read-only** (no writes, no deletes): ran `getSummary`, `getApprovals`
  (all statuses), `getSettings`, `findProjectByCode`, `getProjects` against a tenant with
  1,092 entries / 4,877.25h — summary rounded + sorted desc, OT 76.75, util 86%, approvals
  `billableHours` now correct, settings expose both new fields.
- **Not yet run:** authenticated HTTP end-to-end of the *new* write paths (dup-code 409,
  locked-week 422) against the deployed server — requires deploying this commit first
  (write tests deliberately avoided on prod per "don't delete anything").

## 6. Post-deploy live confirmation (2026-06-15) ✅

`fix/payroll-msw-parity` is **deployed** to `employee-management-system-2b9q.onrender.com`.
Authenticated HTTP end-to-end against the live server (`hr@acme.test` / employee accounts):

- **`requireTaskOnEntry`** present on `GET /timesheets?week=` for **both** HR and employee
  (`dev1@acme.test`) → `false`.
- **`GET /timesheets/settings`** exposes `submitReminderDay: null` + `requireTaskOnEntry: false`.
- **`summary.byEmployee[].employeeCode`** present (15 rows: `E0001`, `E0002`, …).
- **Dup-code write path:** `POST /timesheets/projects` with an existing `code` → **`409 DUPLICATE_CODE`**
  (rejected, no row created) — closes the "not yet run" gap above.

### M7 submit-reminder — scheduled on GitHub Actions (no Render Cron)

- Workflow **`Timesheet Submit Reminders`** is **active**; scheduled run (`cron 0 2 * * *`) and
  `workflow_dispatch -f force=true` both **succeed** on `main`. Secret `TIMESHEET_DB_URL` is set.
- Default state is a **no-op** (`submitReminderDay: null` → job logs `skipped, reason: "disabled"`).
  Enable per tenant via `PATCH /timesheets/settings { "submitReminderDay": 1..7 }`.

### Reminder notification payload — observed live (both types)

> Delivery shape is **`data.notifications[]`**. Each maps `body` ← notification `message`,
> `actionUrl` ← `metadata.actionUrl`. FE prefers `actionUrl` and renders `body ‖ message` — no change needed.

```jsonc
// timesheet_submit_reminder (employee, DRAFT w/ hours)
{
  "type": "timesheet_submit_reminder",
  "title": "Timesheet reminder",
  "body": "Your timesheet for the week of 2026-06-08 is still a draft — please submit it.",
  "actionUrl": "/timesheets?tab=my&week=2026-06-08",
  "isRead": false
}
// timesheet_approval_reminder (manager/HR, when sheets are SUBMITTED)
{
  "type": "timesheet_approval_reminder",
  "title": "Timesheets awaiting approval",
  "body": "1 timesheet(s) are submitted and waiting for your approval.",
  "actionUrl": "/timesheets?tab=approvals",
  "isRead": false
}
```

### Two low-severity backend notes (from the live observation)
1. **`employeeReminders`/`approverReminders` counts under-report** — `createMany({skipDuplicates})`
   returns 0 when an idempotent row already exists for `(tenant, user, type, weekStart)`. Correct
   (no dupes) but the returned count is **not** "newly delivered" — don't use it as delivery proof.
2. **Stored `timesheet.totalHours` can be stale on seeded DRAFTs** — the reminder scan trusts the
   persisted column (`getTimesheetsByWeekPage`); seed rows that bypass `recalcTimesheetTotal` stay
   at 0 and won't nudge until an entry is touched. Seed data should run a recalc.
