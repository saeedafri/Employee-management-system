# Timesheets — Backend: remaining API work

> **Source of truth: live API, not docs.** Compiled 2026-06-15 from a read-only
> authenticated sweep (`hr@acme.test`) of the production backend. This lists only what the
> backend still **owes or must confirm** — everything not listed here was verified live and
> is working. Companion file: `FRONTEND_REMAINING.md`.

## ✅ Backend response (2026-06-15) — addressed on branch `fix/payroll-msw-parity`

- **§2 `requireTaskOnEntry` for non-admins — DONE.** Now returned on `GET /timesheets` (the
  week response, readable by all roles). Live-verified: employee `priya@acme.test` sees
  `requireTaskOnEntry: true`, and `POST /entries` without `taskId` → `422 TASK_REQUIRED`.
- **§1 reminder `actionUrl` — DONE.** Both reminder types now carry an authoritative deep-link
  in metadata (`/timesheets?tab=my&week=<weekStart>` for submit, `/timesheets?tab=approvals`
  for approval). The notifications API maps `message → body` and `metadata.actionUrl →
  actionUrl`. Live-verified: forced job created a `timesheet_submit_reminder` with
  `actionUrl: "/timesheets?tab=my&week=2026-06-08"`. **Field name: the feed returns `body`**
  (mapped from `message`); both are populated. Cron fires on the tenant's `submitReminderDay`
  in its local timezone (`Asia/Kolkata` confirmed in the job result).
- **§3 dup-code / week-lock — confirmed live:** `POST /timesheets/projects` with an existing
  `code` → `409 DUPLICATE_CODE`; lock guard throws `422 WEEK_LOCKED`.
- **§4 lock code — confirmed `WEEK_LOCKED`** in source (`timesheets.service.js`).
- **§5 `byEmployee.employeeCode` — DONE.** It was computed but stripped by the response schema;
  now declared in the route schema so it serializes.

> ⚠️ All of the above are on branch `fix/payroll-msw-parity` (PR #1) — **not yet merged/deployed
> to Render**. Merge + deploy to make them live on `…onrender.com`.

## Live-verified as DONE (read-only) — no action

All 20 timesheet endpoints exist and respond (control route `__no_such_route__` →
`404 "Route … not found"` proves the rest are real hits):

- `GET /timesheets` — get-or-create persists a DRAFT, `employeeName` populated.
- `GET /timesheets/settings` — returns `submitReminderDay` (`null`) + `requireTaskOnEntry`
  (`false`) + all standard fields.
- `GET /timesheets/summary` — `overtimeHours` a number (`76.75`/`2.75`), all values ≤2dp
  rounded, `byProject` sorted desc, `byEmployee` carries `billableHours`.
- `GET /timesheets/approvals` — `billableHours` non-zero (`34`), `employeeName` populated,
  `entries` included.
- `POST /timesheets/copy-week` — route exists (`422` on empty body).
- `POST /timesheets/:id/recall` — route exists (`404 NOT_FOUND` on fake id).
- `POST /:id/submit` / `/approve` → `404 NOT_FOUND` on fake id; `/reject` → `422` requires
  `comment`; `POST /entries`, `/projects` → `422` validation. All present.

## Remaining / to confirm

### 1. Submit-reminder notifications — define the payload + confirm the cron fires

Reminders are delivered as in-app notifications, but the **exact payload is unverified**
(cron-gated; `submitReminderDay` is `null`, so none exist). The FE consumes notifications
through `GET /notifications`, whose live shape is `{ title, body, actionUrl, isRead,
createdAt, … }`. Please confirm/commit to, for `timesheet_submit_reminder` and
`timesheet_approval_reminder`:

- **Field name** delivered to the feed: is it `body` or `message`? (FE renders `body ||
message` defensively, but pick one.)
- **`actionUrl`** — strongly prefer the backend **set `actionUrl`** to the deep-link
  (`/timesheets?tab=my&week=<weekStart>` for submit, `/timesheets?tab=approvals` for
  approval). Today the FE _derives_ it from `metadata.weekStart` as a fallback; an
  authoritative `actionUrl` removes that guesswork.
- **Cron** — confirm the job actually fires on the tenant's `submitReminderDay` (local
  timezone) and writes both notification types. Not observable from the FE.

### 2. Expose `requireTaskOnEntry` to non-admin roles

`GET /timesheets/settings` is `HR_ADMIN`/`SUPER_ADMIN`-only (employees/managers `403`).
Because of that, the **employee** entry UI cannot show "task required" upfront — it only
learns of the rule when the server rejects the save with `422 TASK_REQUIRED`. To let
employees see the requirement _before_ submitting, surface `requireTaskOnEntry` to all
authenticated roles — e.g. include it on the `GET /timesheets` (week) response, or expose
a small non-admin-readable settings subset. (Enforcement itself already works server-side
for all roles.)

### 3. HTTP end-to-end of the new write paths (deploy + confirm)

Per the parity audit §5, these were validated by code/DB read-only but **not** over
authenticated HTTP on the deployed server. Deploy the parity commit and confirm:

- `POST/PATCH /timesheets/projects` with a duplicate `code` → **`409 DUPLICATE_CODE`**
  (case-insensitive).
- `PATCH`/`DELETE /timesheets/entries/:id` on a `SUBMITTED`/`APPROVED` week → **`422
WEEK_LOCKED`** (see §4).

### 4. Lock-code value — ensure `WEEK_LOCKED` is what's deployed

Two backend docs conflicted: the settings/entry-rules doc said live returns
`TIMESHEET_LOCKED`; the parity audit says it was renamed to **`WEEK_LOCKED`** to match the
reference MSW. The FE/MSW now expects **`WEEK_LOCKED`**. Please confirm the deployed value
is `WEEK_LOCKED` (a no-op `PATCH` on a locked entry → `422 WEEK_LOCKED`). The FE doesn't
branch on the code (shows `message`), so this is contract-fidelity, not a functional break.

### 5. Minor / low priority

- `summary.byEmployee` — the audit claims an added `employeeCode`; the live response did
  **not** include it (only `employeeId, employeeName, hours, billableHours,
utilizationPct`). Harmless (FE reads by key); align doc or add the field.

## Verification method (so the team can reproduce)

Authenticated read-only calls against `…/api/v1/timesheets/*` with the `hr@acme.test`
session; route existence probed with fake ids / empty bodies (rejected, non-mutating);
a `__no_such_route__` control distinguishes real `404 NOT_FOUND` (route exists) from
`404 "Route … not found"` (route missing). No writes/deletes were issued to production.
