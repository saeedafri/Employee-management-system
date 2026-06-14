# Timesheets API — Response Reference (MSW → Backend swap)

> For the UI team. The live backend is a **drop-in replacement** for the MSW handler
> (`ems-frontend/src/mocks/handlers/timesheets.ts`). Every field the UI reads matches the
> mock. Captured against the live Render API on 2026-06-14, commit `eac80ae`.
>
> **Read-path + error examples are real live captures** (§1, §5, §9, §12, §16, §19, 409/422).
> **Write-path success examples are shape-accurate** (same verified `Timesheet`/`TimeEntry`/
> `Project`/`Task` objects, placeholder ids) — not executed against production to avoid
> creating/mutating data. All write paths are covered by unit tests + the live `409`/`422`
> non-mutating checks.

## Conventions

- **Base path:** `/api/v1/timesheets` (MSW used `/api/timesheets`; the FE BFF proxy already
  rewrites `/api/*` → `${API_BASE_URL}/*` with `API_BASE_URL=…/api/v1`, so paths line up).
- **Headers:** `Authorization: Bearer <accessToken>`, `x-tenant-key: <tenantKey>`,
  `content-type: application/json`.
- **Success envelope:** `{ "success": true, "data": <T>, "meta"?: {} }`
- **Error envelope:** `{ "success": false, "error": { "code": string, "message": string, "details": {} | [{field,message}], "requestId": string } }`
- **Roles:** `EMPLOYEE` (own week + entries, submit, recall, copy-week, projects/tasks read),
  `MANAGER`/`HR_ADMIN`/`SUPER_ADMIN` (approvals, summary), `HR_ADMIN`+ (settings, project/task writes).
- Dates are `YYYY-MM-DD`; timestamps are ISO-8601; hours are 2-dp numbers.

### Differences from MSW (all additive / non-breaking — the UI reads by key)
| Where | MSW | Backend | Impact |
|---|---|---|---|
| every success | `{success,data}` | `{success,data,meta:{}}` | none (`meta` optional) |
| every error | `{code,message[,details]}` | `+ details:{}` (non-validation) `+ requestId` | none |
| `summary.byEmployee[]` | `{employeeId,employeeName,hours,utilizationPct}` | `+ billableHours,+ employeeCode` | none |
| task object | `{id,projectId,name,billable,active}` | `+ tenantId,createdAt,updatedAt` | none |
| validation 422 | `details: [{field,message}]` | same (array) — map to form errors | ✅ matches |

---

## 1. `GET /timesheets?week=YYYY-MM-DD&employeeId=` — weekly timesheet
Role: any authed. `employeeId` optional (defaults to caller). Get-or-create: returns the
existing week or a fresh `DRAFT`. (HR/admin with no employee profile and no `employeeId`
gets a read-only empty shell with `id: null`.)
```jsonc
{ "success": true, "data": {
  "id": "cmq6xhljc008z6h2gpo6vgz8r", "employeeId": "cmq6w2hh5001m19wg8yk2mngg",
  "employeeName": "HR Admin", "weekStart": "2026-06-08", "weekEnd": "2026-06-14",
  "status": "APPROVED", "totalHours": 39.5, "billableHours": 34, "overtimeHours": 0,
  "standardHours": 40, "submittedAt": "2026-06-10T17:40:35.052Z",
  "decidedBy": "cmq6w2hh5001m19wg8yk2mngg", "decidedAt": "2026-06-10T17:40:42.401Z",
  "comment": null,
  "entries": [
    { "id": "cmq6xhlse00916h2gflkgh0hl", "timesheetId": "cmq6xhljc008z6h2gpo6vgz8r",
      "employeeId": "cmq6w2hh5001m19wg8yk2mngg", "projectId": "prj-seed-1",
      "taskId": "tsk-seed-1", "date": "2026-06-08", "hours": 7.5, "billable": true,
      "note": "Sprint planning + dev", "source": "MANUAL" }
  ]
} }
```
Errors: `422 VALIDATION` (missing `week` — actually optional here, defaults to current Monday).

## 2. `POST /timesheets/entries` → 201 — create time entry
Body: `{ weekStart*, projectId*, taskId?, date*, hours* (0.25–24), billable?, note?, source? }`.
`billable` when omitted is inferred `task.billable ?? project.billable ?? billableDefault`.
`taskId` may be `null`/omitted.
```jsonc
{ "success": true, "data": {
  "id": "te-…", "timesheetId": "ts-…", "employeeId": "emp-…",
  "projectId": "prj-seed-1", "taskId": "tsk-seed-1", "date": "2026-06-08",
  "hours": 7.5, "billable": true, "note": "Sprint board", "source": "MANUAL"
} }
```
Errors: `422 WEEK_LOCKED` (week not DRAFT/REJECTED) · `422 TASK_REQUIRED` (tenant `requireTaskOnEntry` and no task) · `422 VALIDATION` (bad body).

## 3. `PATCH /timesheets/entries/:id` → 200 — update entry
Body (partial): `{ hours?, billable?, note?, taskId? }`. Returns the updated `TimeEntry` (shape as §2).
Errors: `404 NOT_FOUND` · `422 WEEK_LOCKED` (parent week submitted/approved) · `422 TASK_REQUIRED`.

## 4. `DELETE /timesheets/entries/:id` → 200
```jsonc
{ "success": true, "data": { "id": "te-…" } }
```
Errors: `404 NOT_FOUND` · `422 WEEK_LOCKED`.

## 5. `GET /timesheets/summary?range=30d|90d&employeeId=` — utilization
Role: MANAGER/HR. All numbers 2-dp; `byProject`/`byEmployee` **sorted by `hours` desc**.
```jsonc
{ "success": true, "data": {
  "totalHours": 4877.25, "billableHours": 4204.75, "nonBillableHours": 672.5,
  "overtimeHours": 76.75, "utilizationPct": 86,
  "byProject": [
    { "projectId": "prj-seed-1", "projectName": "Acme Mobile App", "hours": 2426, "billableHours": 2426 },
    { "projectId": "prj-seed-3", "projectName": "Data Analytics Platform", "hours": 1536, "billableHours": 1536 }
  ],
  "byEmployee": [
    { "employeeId": "cmq6w2gyx…", "employeeName": "Priya Sharma", "hours": 357.25, "billableHours": 300.75, "utilizationPct": 84 },
    { "employeeId": "cmq6w2gh4…", "employeeName": "Aman Kumar", "hours": 336, "billableHours": 292, "utilizationPct": 87 }
  ]
} }
```

## 6. `POST /timesheets/:id/submit` → 200 — DRAFT/REJECTED → SUBMITTED
Returns the updated `Timesheet` (shape as §1, `status: "SUBMITTED"`, `submittedAt` set).
Errors: `404 NOT_FOUND` · `422 ALREADY_SUBMITTED` · `422 EMPTY_TIMESHEET` (0 hours).

## 7. `POST /timesheets/:id/recall` → 200 — owner only, SUBMITTED → DRAFT
Returns the `Timesheet` with `status: "DRAFT"`, `submittedAt/decidedBy/decidedAt/comment` cleared.
Errors: `404 NOT_FOUND` (missing or not owner) · `422 NOT_RECALLABLE` (not SUBMITTED).

## 8. `POST /timesheets/copy-week` → 201 — scaffold a week from another
Body: `{ fromWeekStart*, toWeekStart*, withNotes? }`. Copies each unique `project/task` row
at `hours: 0` (idempotent; skips rows the target already has). `meta.copied` = rows created.
```jsonc
{ "success": true, "data": { /* target Timesheet, shape as §1 */ }, "meta": { "copied": 3 } }
```
Errors: `422 WEEK_LOCKED` (target not DRAFT/REJECTED) · `400 VALIDATION_ERROR` (missing weeks).

## 9. `GET /timesheets/approvals?status=SUBMITTED|APPROVED|REJECTED|DRAFT` — queue
Role: MANAGER/HR. Array of `Timesheet` (each with `employeeName` + `entries[]`), default `SUBMITTED`.
```jsonc
{ "success": true, "data": [ {
  "id": "cmq6xhljc…", "employeeId": "cmq6w2hh5…", "employeeName": "HR Admin",
  "weekStart": "2026-06-08", "weekEnd": "2026-06-14", "status": "APPROVED",
  "totalHours": 39.5, "billableHours": 34, "overtimeHours": 0, "standardHours": 40,
  "submittedAt": "2026-06-10T17:40:35.052Z", "decidedBy": "cmq6w2hh5…",
  "decidedAt": "2026-06-10T17:40:42.401Z", "comment": null,
  "entries": [ { "id": "cmq6xhlse…", "timesheetId": "cmq6xhljc…", "employeeId": "cmq6w2hh5…",
    "projectId": "prj-seed-1", "taskId": "tsk-seed-1", "date": "2026-06-08", "hours": 7.5,
    "billable": true, "note": "Sprint planning + dev", "source": "MANUAL" } ]
} ] }
```

## 10. `POST /timesheets/:id/approve` → 200 — SUBMITTED → APPROVED
Body: `{ comment? }`. Returns `Timesheet` (`status: "APPROVED"`, `decidedBy`, `decidedAt`).
Errors: `404 NOT_FOUND` · `422 NOT_SUBMITTED`.

## 11. `POST /timesheets/:id/reject` → 200 — SUBMITTED → REJECTED
Body: `{ comment* }` (required, non-empty). Returns `Timesheet` (`status: "REJECTED"`, `comment`).
Errors: `404 NOT_FOUND` · `422 NOT_SUBMITTED` · `422 VALIDATION` (missing/blank comment, with `details:[{field:"comment",…}]`).

## 12. `GET /timesheets/projects?memberId=self|<id>` — list projects
Role: any authed. Returns `Project[]`.
```jsonc
{ "success": true, "data": [ {
  "id": "cmqcymnl5…", "name": "Test", "code": "tst", "clientName": "testwala",
  "status": "ACTIVE", "billable": true, "defaultRate": 0,
  "memberIds": ["cmq6w2gyx…","cmq6w2sio…"], "createdAt": "2026-06-13T23:01:48.905Z",
  "updatedAt": "2026-06-13T23:01:48.905Z"
} ] }
```

## 13. `POST /timesheets/projects` → 201 — create project (HR_ADMIN)
Body: `{ name*, code*, clientName?, billable?, defaultRate?, memberIds? }`. Returns the `Project` (shape as §12).
Errors: `409 DUPLICATE_CODE` (code already used, case-insensitive) · `422 VALIDATION`.
```jsonc
// 409 example (real):
{ "success": false, "error": { "code": "DUPLICATE_CODE",
  "message": "Project code already exists", "details": {}, "requestId": "req-3u" } }
```

## 14. `PATCH /timesheets/projects/:id` → 200 — update project (HR_ADMIN)
Body (partial): `{ name?, code?, clientName?, billable?, memberIds? }`. Returns the `Project`.
Errors: `404 NOT_FOUND` · `409 DUPLICATE_CODE`.

## 15. `DELETE /timesheets/projects/:id` → 200 — archive or delete (HR_ADMIN)
Archives (preserves history) if the project has tasks or logged entries; hard-deletes only if empty.
```jsonc
{ "success": true, "data": { "id": "prj-…" } }
```
Errors: `404 NOT_FOUND`.

## 16. `GET /timesheets/projects/:id/tasks` — list tasks
Role: any authed. Returns `Task[]` (extra `tenantId/createdAt/updatedAt` vs MSW — ignore).
```jsonc
{ "success": true, "data": [ {
  "id": "cmqdgft09…", "tenantId": "cmq6w07ue…", "projectId": "cmqcymnl5…",
  "name": "Design QA Pass", "billable": true, "active": true,
  "createdAt": "2026-06-14T07:20:22.425Z", "updatedAt": "2026-06-14T07:20:22.425Z"
} ] }
```

## 17. `POST /timesheets/projects/:id/tasks` → 201 — create task (HR_ADMIN)
Body: `{ name*, billable? }` (`active` defaults true). Returns the `Task` (shape as §16).
Errors: `404 NOT_FOUND` (project missing).

## 18. `PATCH /timesheets/tasks/:id` → 200 — update task (HR_ADMIN)
Body (partial): `{ name?, billable?, active? }`. Returns the `Task`. Errors: `404 NOT_FOUND`.

## 19. `GET /timesheets/settings` — tenant settings (HR_ADMIN)
```jsonc
{ "success": true, "data": {
  "id": "cmq6xg04n…", "tenantId": "cmq6w07ue…", "standardWeeklyHours": 40,
  "overtimeThresholdHours": 40, "roundingMinutes": 15, "approvalRequired": true,
  "unloggedHoursPolicy": "FLAG", "billableDefault": true,
  "submitReminderDay": null, "requireTaskOnEntry": false,
  "updatedAt": "2026-06-14T13:55:46.018Z"
}, "meta": {} }
```
> ⚠️ **UI mock gap:** add `submitReminderDay: null` and `requireTaskOnEntry: false` to the
> MSW `timesheetSettings` default so the mock matches live.

## 20. `PATCH /timesheets/settings` → 200 — update settings (HR_ADMIN)
Body (partial): `{ standardWeeklyHours?, overtimeThresholdHours?, roundingMinutes?,
approvalRequired?, unloggedHoursPolicy? (IGNORE|FLAG|DEDUCT), billableDefault?,
submitReminderDay? (1–7|null), requireTaskOnEntry? }`. Returns the full settings object (shape as §19).

---

## Error code reference (HTTP status → code)
| Status | code | When |
|---|---|---|
| 401 | (auth) | missing/invalid token |
| 403 | (forbidden) | role not allowed for the route |
| 404 | `NOT_FOUND` | entry/timesheet/project/task missing (or recall by non-owner) |
| 409 | `DUPLICATE_CODE` | project code already in use |
| 422 | `WEEK_LOCKED` | add/edit/delete entry on a non-DRAFT/REJECTED week |
| 422 | `ALREADY_SUBMITTED` | submit a week already submitted |
| 422 | `EMPTY_TIMESHEET` | submit a week with 0 hours |
| 422 | `NOT_RECALLABLE` | recall a week not in SUBMITTED |
| 422 | `NOT_SUBMITTED` | approve/reject a week not in SUBMITTED |
| 422 | `TASK_REQUIRED` | entry without taskId while tenant `requireTaskOnEntry` |
| 422 | `VALIDATION` / `VALIDATION_ERROR` | bad body (Fastify schema) — `details:[{field,message}]` |
