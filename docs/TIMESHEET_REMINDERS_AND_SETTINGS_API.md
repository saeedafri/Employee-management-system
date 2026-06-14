# Timesheets — Settings, Entry Rules & Submit Reminders (API for UI team)

> **Status:** ✅ Live & verified end-to-end on 2026-06-14 against the production DB across
> **SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE**. All shapes below are real responses.
> Base URL: `/api/v1` · Auth: `Authorization: Bearer <accessToken>` (tenant comes from the JWT).

This covers what changed for the timesheet self-service overhaul (M2 + M7) plus the
two flows that were live but unconfirmed (copy-week, recall).

---

## 1. Timesheet Settings

Two new fields were added: **`submitReminderDay`** and **`requireTaskOnEntry`**.
Everything else is unchanged.

### `GET /timesheets/settings`
**Roles:** `HR_ADMIN`, `SUPER_ADMIN` (MANAGER/EMPLOYEE → `403`).

```json
{
  "success": true,
  "data": {
    "id": "cmq6xg04n00016h2gez68uv89",
    "tenantId": "cmq6w07ue000019wgllf0t5eu",
    "standardWeeklyHours": 40,
    "overtimeThresholdHours": 40,
    "roundingMinutes": 15,
    "approvalRequired": true,
    "unloggedHoursPolicy": "FLAG",
    "billableDefault": true,
    "submitReminderDay": null,
    "requireTaskOnEntry": false,
    "updatedAt": "2026-06-09T17:42:01.895Z"
  },
  "meta": {}
}
```

| Field | Type | Notes |
|-------|------|-------|
| `submitReminderDay` | `integer 1..7 \| null` | ISO weekday (**Mon=1 … Sun=7**) the reminder job nudges on. `null` = reminders **disabled** (default). |
| `requireTaskOnEntry` | `boolean` | When `true`, a time entry **must** have a `taskId` or the API returns `422 TASK_REQUIRED`. Default `false`. |

### `PATCH /timesheets/settings`
**Roles:** `HR_ADMIN`, `SUPER_ADMIN`. **Partial** body — send only what changes. Returns the full updated settings object (same shape as GET).

```jsonc
// Enable reminders every Friday + enforce task selection
PATCH /timesheets/settings
{ "submitReminderDay": 5, "requireTaskOnEntry": true }

// Disable reminders again
{ "submitReminderDay": null }
```

**Validation:** `submitReminderDay` outside `1..7` → `422` (validation error). `null` is accepted (clears it).

---

## 2. Time Entries — `taskId` is optional (and `requireTaskOnEntry`)

`taskId` is **optional** on a time entry (a project row may have no task).

### `POST /timesheets/entries`
**Roles:** all authenticated. Body:
```jsonc
{
  "weekStart": "2026-09-07",   // Monday of the week (required)
  "projectId": "cmqc...",       // required
  "taskId": null,               // OPTIONAL — send null, omit it, or a real id
  "date": "2026-09-08",         // required, YYYY-MM-DD
  "hours": 1.5,                 // required, 0.25..24
  "billable": true,             // optional
  "note": "…",                  // optional
  "source": "MANUAL"            // optional: MANUAL | TIMER
}
```

Behaviour matrix (verified live):

| `requireTaskOnEntry` | `taskId` sent | Result |
|----------------------|---------------|--------|
| `false` (default) | omitted | ✅ `201` — stored `taskId: null` |
| `false` | `null` | ✅ `201` — stored `taskId: null` |
| `false` | real id | ✅ `201` |
| `true` | omitted | ⛔ `422 { code: "TASK_REQUIRED" }` |
| `true` | `null` | ⛔ `422 { code: "TASK_REQUIRED" }` |
| `true` | real id | ✅ `201` |

> The old footgun is gone: sending `"taskId": null` no longer 500s — it stores `null`.
> `PATCH /timesheets/entries/:id` follows the same rule (only enforced when the body includes `taskId`).

Other entry errors: posting to a `SUBMITTED`/`APPROVED` week → `422 TIMESHEET_LOCKED`.

---

## 3. Copy last week — `POST /timesheets/copy-week`

Scaffolds the target week with each **unique project/task row** from the source week at
`hours: 0` (Harvest-style). **Idempotent** — re-running skips rows the target already has.

**Roles:** all authenticated. Body: `{ "fromWeekStart": "2026-09-07", "toWeekStart": "2026-09-14", "withNotes": false }`

```json
{
  "success": true,
  "data": {
    "id": "…", "employeeId": "…", "employeeName": "",
    "weekStart": "2026-09-14", "weekEnd": "2026-09-20",
    "status": "DRAFT", "totalHours": 0, "billableHours": 0,
    "overtimeHours": 0, "standardHours": 40,
    "submittedAt": null, "decidedBy": null, "decidedAt": null, "comment": null,
    "entries": [
      { "id": "…", "projectId": "cmqc…", "taskId": "cmqd…", "date": "2026-09-14", "hours": 0, "billable": true, "note": null, "source": "MANUAL" },
      { "id": "…", "projectId": "cmqc…", "taskId": null,     "date": "2026-09-14", "hours": 0, "billable": true, "note": null, "source": "MANUAL" }
    ]
  },
  "meta": { "copied": 2 }     // ← number of rows created; 0 on a no-op re-run
}
```

- HTTP `201`. `meta.copied` = rows created this call.
- Target week not `DRAFT`/`REJECTED` → `422 WEEK_LOCKED`.
- Missing `fromWeekStart`/`toWeekStart` → `422 VALIDATION_ERROR`.

---

## 4. Recall / unsubmit — `POST /timesheets/:id/recall`

Owner-only. Flips `SUBMITTED → DRAFT` and clears the submission/decision fields.

**Roles:** all authenticated (owner only — non-owners get `404`).

```json
{
  "success": true,
  "data": { "id": "…", "status": "DRAFT", "submittedAt": null, "decidedBy": null, "decidedAt": null, "comment": null, "entries": [ … ] }
}
```

- HTTP `200` on success.
- Not the owner / not found → `404 NOT_FOUND`.
- Sheet not `SUBMITTED` (e.g. already DRAFT/APPROVED) → `422 NOT_RECALLABLE`.

---

## 5. Submit Reminders (M7) — **no endpoint to call; render from notifications**

There is **no HTTP endpoint** for reminders. A backend scheduled job (Render Cron, once
per day) creates **in-app notifications**; the FE renders the nudge from the normal
notifications feed (`GET /notifications`, unread badge `GET /notifications/unread-count`,
and the SSE stream `GET /notifications/stream`).

**When it fires:** on the tenant's `submitReminderDay` (compared against the tenant's
**local** timezone), for the **prior** week. `submitReminderDay: null` → nothing happens.

**Who gets what (verified live across roles):**

| Notification `type` | Sent to | When |
|---------------------|---------|------|
| `timesheet_submit_reminder` | the **timesheet owner** (any role — employee or a manager who logs time) | their prior-week sheet is `DRAFT` **with hours logged**, or `REJECTED` |
| `timesheet_approval_reminder` | every active **MANAGER + HR_ADMIN + SUPER_ADMIN** | one or more sheets are `SUBMITTED` and awaiting approval that week |

**Notification payload** (same envelope as all notifications). Example bodies:

```jsonc
// Employee nudge
{
  "type": "timesheet_submit_reminder",
  "title": "Timesheet reminder",
  "message": "Your timesheet for the week of 2026-06-01 is still a draft — please submit it.",
  // (REJECTED variant): "… was rejected — please update and resubmit."
  "metadata": { "weekStart": "2026-06-01", "timesheetId": "…", "status": "DRAFT" }
}

// Approver nudge
{
  "type": "timesheet_approval_reminder",
  "title": "Timesheets awaiting approval",
  "message": "12 timesheet(s) are submitted and waiting for your approval.",
  "metadata": { "weekStart": "2026-06-01", "pendingCount": 12 }
}
```

> `metadata.weekStart` is always present on reminder notifications — use it to dedupe/group
> in the UI and to deep-link to the right week.

**Guarantees (built for scale, won't break):**
- **Idempotent** — a DB unique index on `(tenant, user, type, weekStart)` means a user can
  receive **at most one** reminder of each type per week, even if the job runs twice.
- **Bulk + paginated** — handles large tenants (thousands of timesheets) safely.
- **Per-tenant isolation** — one tenant erroring never blocks others.
- **Timezone-aware** — each tenant is nudged on *their* local weekday.

**SSE note:** when reminders are created, connected clients receive a lightweight
`notification` event `{ "refresh": true, "reason": "timesheet_reminder" }` — treat it as a
signal to refetch the notifications list / unread count (don't expect a full row in that event).

---

## 6. Role access — quick reference (verified)

| Endpoint | EMPLOYEE | MANAGER | HR_ADMIN | SUPER_ADMIN |
|----------|:--------:|:-------:|:--------:|:-----------:|
| `GET /timesheets`, entries, `copy-week`, `recall`, `submit`, projects/tasks (GET) | ✅ | ✅ | ✅ | ✅ |
| `GET /timesheets/approvals`, `:id/approve`, `:id/reject`, `GET /timesheets/summary` | ⛔ 403 | ✅ | ✅ | ✅ |
| `POST/PATCH/DELETE projects`, create task | ⛔ 403 | ⛔ 403 | ✅ | ✅ |
| `GET/PATCH /timesheets/settings` | ⛔ 403 | ⛔ 403 | ✅ | ✅ |

> Accounts with no Employee profile (e.g. some SUPER_ADMIN) get a read-only empty week shell
> from `GET /timesheets` (no crash).

---

## 7. Error codes you may surface

| HTTP | `code` | Meaning |
|------|--------|---------|
| 422 | `TASK_REQUIRED` | `requireTaskOnEntry` is on and the entry has no `taskId` |
| 422 | `TIMESHEET_LOCKED` | adding/editing an entry on a `SUBMITTED`/`APPROVED` week |
| 422 | `WEEK_LOCKED` | copy-week target is not `DRAFT`/`REJECTED` |
| 422 | `NOT_RECALLABLE` | recall called on a sheet that isn't `SUBMITTED` |
| 422 | `EMPTY_TIMESHEET` | submit called on a week with 0 hours |
| 404 | `NOT_FOUND` | not found / not the owner |
| 403 | — | role not permitted (see §6) |
