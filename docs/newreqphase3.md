# newreqphase3.md — Phase 3 net-new API contracts

> These endpoints are **NOT yet on the backend**.
> The frontend implements MSW handlers that match these shapes exactly.
> When the backend ships an endpoint: disable the MSW handler (flip
> `NEXT_PUBLIC_USE_MOCKS=false` or delete the handler entry from
> `src/mocks/handlers/index.ts`). **No app code changes required.**
>
> **Conventions:**
>
> - All field names: **camelCase**
> - List envelope: `{ "success": true, "data": { "<collection>": [...], "pagination": { "page", "limit", "total", "totalPages" } } }`
> - Single-object envelope: `{ "success": true, "data": { ... } }`
> - Error envelope (consistent across all endpoints):
>   ```json
>   {
>     "success": false,
>     "error": { "code": "...", "message": "...", "details": [], "requestId": "..." }
>   }
>   ```
> - Roles: `SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | AUDITOR`
> - Date reads: full ISO strings. Date writes: `YYYY-MM-DD`.

---

## Domain A — Recruitment

> Screens: `/recruitment` — Pipeline, Openings, Candidates tabs.
> MSW handler file: `src/mocks/handlers/recruitment.ts`

### GET /recruitment/summary

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER (read-only)
**Query params:** none
**Success response:**

```json
{
  "success": true,
  "data": {
    "openRequisitions": 6,
    "activeCandidates": 242,
    "interviewsThisWeek": 9,
    "avgDaysToHire": 28,
    "closingThisWeek": 2,
    "interviewsToday": 3
  }
}
```

---

### GET /recruitment/openings

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Query params:** `page` (default 1), `limit` (default 20), `status` (optional: `Open|Closing|On hold|Closed`)
**Success response:**

```json
{
  "success": true,
  "data": {
    "openings": [
      {
        "id": "ENG-198",
        "title": "Senior Backend Engineer",
        "department": "Engineering",
        "location": "Bengaluru",
        "employmentType": "FULL_TIME",
        "applicantCount": 38,
        "currentStage": "Interviewing",
        "status": "Open",
        "createdAt": "2026-04-15T00:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 6, "totalPages": 1 }
  }
}
```

**Status values:** `Open` | `Closing` | `On hold` | `Closed`
**Employment types:** `FULL_TIME` | `PART_TIME` | `CONTRACT` | `INTERNSHIP`

---

### GET /recruitment/candidates

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Query params:** `openingId` (optional), `stage` (optional), `page` (default 1), `limit` (default 50)
**Success response:**

```json
{
  "success": true,
  "data": {
    "candidates": [
      {
        "id": "cand_1",
        "name": "Fatima Noor",
        "role": "Senior Backend Engineer",
        "openingId": "ENG-198",
        "stage": "interview",
        "rating": 4,
        "daysInStage": 6,
        "isReferral": true,
        "tag": "ENG-198",
        "email": "fatima.noor@example.com",
        "appliedAt": "2026-05-20T00:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 11, "totalPages": 1 }
  }
}
```

**Stage values:** `applied` | `screening` | `interview` | `offer` | `hired`
**Rating:** integer 0–5 (0 = not yet rated)

---

### POST /recruitment/candidates/:id/advance

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:** `{ "stage": "interview" }` (the target stage, must be the next stage in sequence)
**Success response:**

```json
{ "success": true, "data": { "id": "cand_1", "stage": "interview", "daysInStage": 0 } }
```

**Error codes:**

- `409` — candidate already at `hired` stage (cannot advance further)
- `422` — invalid stage value or skipping stages

---

### POST /recruitment/openings

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:**

```json
{
  "title": "Frontend Engineer",
  "department": "Engineering",
  "location": "Remote",
  "employmentType": "FULL_TIME"
}
```

**Success response:** `{ "success": true, "data": { <opening object> } }`
**Error codes:**

- `422` — validation failure (missing required fields)

---

### PATCH /recruitment/openings/:id

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:** any subset of `{ title, department, location, employmentType, status }`
**Success response:** `{ "success": true, "data": { <updated opening object> } }`
**Error codes:**

- `404` — opening not found
- `422` — validation failure

---

### GET /recruitment/recruiters

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Query params:** none
**Success response:**

```json
{
  "success": true,
  "data": {
    "recruiters": [
      { "id": "rec_1", "name": "Ananya Sharma", "email": "ananya@acme.test" },
      { "id": "rec_2", "name": "Rohan Mehta", "email": "rohan@acme.test" }
    ]
  }
}
```

---

### PATCH /recruitment/candidates/:id/rating

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Request body:** `{ "rating": 4 }` — integer 1–5
**Success response:** `{ "success": true, "data": { "id": "cand_1", "rating": 4 } }`
**Error codes:**

- `422` — rating out of range (must be 1–5)
- `404` — candidate not found

---

## Domain B — Performance

> Screens: `/performance` — Reviews, Goals, Calibration tabs.
> MSW handler file: `src/mocks/handlers/performance.ts`

### GET /performance/cycles/active

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Query params:** none
**Success response:**

```json
{
  "success": true,
  "data": {
    "id": "cycle_h1_2026",
    "name": "H1 2026 Review Cycle",
    "selfReviewDue": "2026-06-07",
    "managerReviewDue": "2026-06-14",
    "calibrationDate": "2026-06-21",
    "progressPct": 58,
    "status": "In progress",
    "startedAt": "2026-05-15T00:00:00Z"
  }
}
```

**Cycle statuses:** `Upcoming` | `In progress` | `Calibrating` | `Closed`
Returns `null` in `data` if no active cycle exists.

---

### GET /performance/summary

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Query params:** none
**Success response:**

```json
{
  "success": true,
  "data": {
    "reviewsComplete": 42,
    "reviewsTotal": 73,
    "goalsOnTrackPct": 81,
    "goalsOnTrackDelta": 6,
    "avgRating": 3.4,
    "overdueReviews": 7
  }
}
```

---

### GET /performance/reviews

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Query params:** `departmentId` (optional), `status` (optional), `page` (default 1), `limit` (default 50)
**Success response:**

```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "employeeId": "emp_1",
        "employeeName": "Priya Sharma",
        "department": "Engineering",
        "reviewerName": "Aman Khanna",
        "status": "Calibrated",
        "rating": "Exceeds",
        "selfComplete": true,
        "managerComplete": true
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 7, "totalPages": 1 }
  }
}
```

**Review statuses:** `Not started` | `Self review` | `Manager review` | `Calibrated`
**Rating values:** `Exceeds` | `Strong` | `Meets` | `Developing` | `Below` | `null`

---

### GET /performance/goals

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Query params:** `status` (optional: `On track|At risk|Done`), `page` (default 1), `limit` (default 50)
**Success response:**

```json
{
  "success": true,
  "data": {
    "goals": [
      {
        "id": "goal_1",
        "employeeId": "emp_1",
        "employeeName": "Priya Sharma",
        "title": "Ship design-system v2 to all squads",
        "progressPct": 80,
        "dueDate": "2026-06-30",
        "status": "On track"
      }
    ],
    "pagination": { "page": 1, "limit": 50, "total": 6, "totalPages": 1 }
  }
}
```

**Goal statuses:** `On track` | `At risk` | `Done`

---

### GET /performance/calibration

**Role:** HR_ADMIN, SUPER_ADMIN
**Query params:** none
**Success response:**

```json
{
  "success": true,
  "data": {
    "totalReviewed": 73,
    "distribution": [
      { "rating": "Exceeds", "count": 8, "pct": 11 },
      { "rating": "Strong", "count": 19, "pct": 26 },
      { "rating": "Meets", "count": 33, "pct": 45 },
      { "rating": "Developing", "count": 10, "pct": 14 },
      { "rating": "Below", "count": 3, "pct": 4 }
    ],
    "notes": [
      {
        "tone": "warning",
        "title": "Engineering skews high",
        "body": "41% rated Strong or above vs 37% org-wide. Flagged for review on Jun 21."
      },
      {
        "tone": "success",
        "title": "Distribution within band",
        "body": "Below + Developing held under 20% target."
      }
    ]
  }
}
```

**Note tones:** `warning` | `success` | `danger` | `info`

---

### GET /performance/employees

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Query params:** none
**Purpose:** Returns the list of employees enrolled in the current (or most recent) review cycle. Used to populate the employee picker in the Add Goal dialog and the Review Detail Sheet.
**Success response:**

```json
{
  "success": true,
  "data": {
    "employees": [
      { "id": "emp_1", "name": "Priya Sharma", "department": "Engineering" },
      { "id": "emp_2", "name": "Rohan Mehta", "department": "Sales" }
    ]
  }
}
```

---

### PATCH /performance/reviews/:employeeId

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Purpose:** Submit or update the manager rating for a review. Automatically transitions the review `status` to `Calibrated` and sets `managerComplete: true`.
**URL param:** `employeeId` — the employee whose review is being rated.
**Request body:**

```json
{ "rating": "Exceeds" }
```

**Rating values:** `Exceeds` | `Strong` | `Meets` | `Developing` | `Below`

**Success response:** `200`, `data` = full updated review object

```json
{
  "success": true,
  "data": {
    "employeeId": "emp_2",
    "employeeName": "Rohan Mehta",
    "department": "Sales",
    "reviewerName": "Sneha Rao",
    "status": "Calibrated",
    "rating": "Meets",
    "selfComplete": true,
    "managerComplete": true
  }
}
```

**Error codes:**

| Code               | Status | When                                                            |
| ------------------ | ------ | --------------------------------------------------------------- |
| `NOT_FOUND`        | 404    | `employeeId` does not exist in the active cycle                 |
| `VALIDATION_ERROR` | 422    | `rating` is missing or not one of the allowed values            |
| `CONFLICT`         | 409    | Review is already `Calibrated` and locked (backend may enforce) |

---

### POST /performance/goals

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER
**Request body:**

```json
{
  "employeeId": "emp_1",
  "title": "Reduce p95 API latency below 200ms",
  "dueDate": "2026-06-30",
  "progressPct": 0
}
```

**Success response:** `{ "success": true, "data": { <goal object> } }`
**Error codes:**

- `422` — validation failure

---

## Domain C — Assets

> Screens: `/assets` — Inventory, Assigned, Requests tabs.
> MSW handler file: `src/mocks/handlers/assets.ts`

### GET /assets/summary

**Role:** HR_ADMIN, SUPER_ADMIN
**Query params:** none
**Success response:**

```json
{
  "success": true,
  "data": {
    "totalAssets": 248,
    "assigned": 201,
    "available": 38,
    "inRepair": 9,
    "utilizationPct": 81,
    "avgRepairDays": 6
  }
}
```

---

### GET /assets

**Role:** HR_ADMIN, SUPER_ADMIN
**Query params:** `type` (optional: `Laptop|Monitor|Phone|Other`), `status` (optional), `page` (default 1), `limit` (default 20)
**Success response:**

```json
{
  "success": true,
  "data": {
    "assets": [
      {
        "id": "asset_1",
        "tag": "LAP-0192",
        "name": "MacBook Pro 14\" M3",
        "type": "Laptop",
        "status": "Assigned",
        "assignedTo": {
          "employeeId": "emp_1",
          "name": "Priya Sharma"
        },
        "assignedSince": "2025-01-15",
        "createdAt": "2025-01-10T00:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 8, "totalPages": 1 }
  }
}
```

**Asset types:** `Laptop` | `Monitor` | `Phone` | `Other`
**Asset statuses:** `Assigned` | `Available` | `Repair` | `Retired`
`assignedTo` is `null` when status is not `Assigned`.

---

### GET /assets/requests

**Role:** HR_ADMIN, SUPER_ADMIN
**Query params:** `status` (optional), `page` (default 1), `limit` (default 20)
**Success response:**

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "req_1",
        "requestedBy": {
          "employeeId": "emp_3",
          "name": "Nisha Iyer"
        },
        "item": "Monitor — 27\" 4K",
        "reason": "New hire setup",
        "requestedAt": "2026-05-27",
        "status": "Pending"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 4, "totalPages": 1 }
  }
}
```

**Request statuses:** `Pending` | `Approved` | `Fulfilled` | `Declined`

---

### PATCH /assets/requests/:id/approve

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:** `{}` (empty)
**Success response:**

```json
{ "success": true, "data": { "id": "req_1", "status": "Approved" } }
```

**Error codes:**

- `409` — request is not in `Pending` state

---

### PATCH /assets/requests/:id/decline

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:** `{ "reason": "string (optional)" }`
**Success response:**

```json
{ "success": true, "data": { "id": "req_1", "status": "Declined" } }
```

**Error codes:**

- `409` — request is not in `Pending` state

---

### GET /assets/employees

**Role:** HR_ADMIN, SUPER_ADMIN
**Query params:** none
**Purpose:** Returns a lightweight employee list for the "Assign to" dropdown (AddAssetDialog, AssetDetailSheet).
**Success response:**

```json
{
  "success": true,
  "data": [
    { "employeeId": "emp_1", "name": "Priya Sharma" },
    { "employeeId": "emp_2", "name": "Rohan Mehta" }
  ]
}
```

---

### PATCH /assets/:id/status

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:**

```json
{ "status": "Available" }
```

**Allowed status values:** `Available` | `Repair` | `Retired`
(Setting `Assigned` is not allowed via this endpoint — use `/assets/:id/assign` instead.)
When status is not `Assigned`, `assignedTo` and `assignedSince` are cleared to `null`.
**Success response:** `{ "success": true, "data": { <full asset object> } }`
**Error codes:**

- `404` — asset not found

---

### PATCH /assets/:id/assign

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:**

```json
{
  "employeeId": "emp_1",
  "name": "Priya Sharma",
  "since": "2026-06-01"
}
```

Sets `status → Assigned`, `assignedTo`, and `assignedSince`.
**Success response:** `{ "success": true, "data": { <full asset object> } }`
**Error codes:**

- `404` — asset not found
- `409` — asset is `Retired` and cannot be assigned

---

### PATCH /assets/:id/recall

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:** `{}` (empty)
Sets `status → Available`, clears `assignedTo` and `assignedSince`.
**Success response:** `{ "success": true, "data": { <full asset object> } }`
**Error codes:**

- `404` — asset not found

---

### POST /assets

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:**

```json
{
  "tag": "LAP-0210",
  "name": "MacBook Pro 14\" M4",
  "type": "Laptop",
  "assignedTo": { "employeeId": "emp_1", "name": "Priya Sharma" },
  "assignedSince": "2026-06-01"
}
```

`assignedTo` and `assignedSince` are optional. When both are provided the asset is created with `status: Assigned`; otherwise `status: Available`.
**Success response:** `{ "success": true, "data": { <full asset object> } }` — `201`
**Error codes:**

- `409` — asset tag already exists
- `422` — validation failure; `error.details[]` maps to `tag`, `name`, `type` fields

---

## Domain D — Announcements

> Screens: `/announcements` — feed + channels + events sidebar.
> MSW handler file: `src/mocks/handlers/announcements.ts`

### GET /announcements

**Role:** All authenticated roles (filtered by audience server-side)
**Query params:** `channelId` (optional), `page` (default 1), `limit` (default 20)
**Success response:**

```json
{
  "success": true,
  "data": {
    "pinned": {
      "id": "ann_0",
      "category": "Company",
      "channelId": "ch_1",
      "title": "Q2 All-Hands — Thursday 4 PM IST",
      "body": "Join the leadership team for the Q2 business review, product roadmap, and a live Q&A. Calendar invites are out; the session will be recorded for those who can't attend live.",
      "author": {
        "name": "Aman Khanna",
        "role": "Chief People Officer"
      },
      "audience": "All employees",
      "readCount": 182,
      "postedAt": "2026-06-02T07:00:00Z",
      "isPinned": true
    },
    "feed": [
      {
        "id": "ann_1",
        "category": "IT",
        "channelId": "ch_4",
        "title": "Mandatory password rotation by Jun 5",
        "body": "Single sign-on credentials must be rotated before June 5. You'll be prompted at next login — enable the authenticator app if you haven't.",
        "author": {
          "name": "Security Team",
          "role": null
        },
        "audience": "All employees",
        "readCount": 211,
        "postedAt": "2026-06-01T14:00:00Z",
        "isPinned": false
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
  }
}
```

**Category values:** `Company` | `People` | `Product` | `IT` | `Office`
`pinned` is `null` when no announcement is pinned.

---

### GET /announcements/channels

**Role:** All authenticated roles
**Query params:** none
**Success response:**

```json
{
  "success": true,
  "data": {
    "channels": [
      { "id": "ch_1", "name": "Company-wide", "postCount": 142, "category": "Company" },
      { "id": "ch_2", "name": "People & Culture", "postCount": 38, "category": "People" },
      { "id": "ch_3", "name": "Product updates", "postCount": 51, "category": "Product" },
      { "id": "ch_4", "name": "IT & Security", "postCount": 24, "category": "IT" },
      { "id": "ch_5", "name": "Office & Facilities", "postCount": 17, "category": "Office" }
    ]
  }
}
```

---

### GET /announcements/events

**Role:** All authenticated roles
**Query params:** none
**Success response:**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "ev_1",
        "date": "2026-06-02",
        "title": "Q2 All-Hands",
        "meta": "4:00 PM · Main hall + Zoom"
      },
      {
        "id": "ev_2",
        "date": "2026-06-06",
        "title": "New-hire orientation",
        "meta": "10:00 AM · 7 joining"
      },
      {
        "id": "ev_3",
        "date": "2026-06-14",
        "title": "Manager review deadline",
        "meta": "H1 2026 cycle"
      }
    ]
  }
}
```

---

### POST /announcements/events

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:**

```json
{
  "date": "2026-07-01",
  "title": "Q3 All-Hands",
  "meta": "4:00 PM · Main hall + Zoom"
}
```

`date` must be `YYYY-MM-DD`. Event is inserted into the list sorted by date.
**Success response:** `{ "success": true, "data": { <event object> } }` — `201`
**Error codes:**

- `422` — validation failure; `error.details[]` maps to `date`, `title`, `meta`

---

### POST /announcements

**Role:** HR_ADMIN, SUPER_ADMIN, MANAGER (scoped to own team channel)
**Request body:**

```json
{
  "title": "New policy: flexible Friday hours",
  "body": "Starting July 1, all employees may flex their Friday end time by up to 2 hours.",
  "category": "People",
  "channelId": "ch_2",
  "audience": "All employees",
  "isPinned": false
}
```

**Success response:** `{ "success": true, "data": { <announcement object> } }`
**Error codes:**

- `403` — EMPLOYEE role cannot create announcements
- `422` — validation failure (missing title / body / category)

---

### PATCH /announcements/:id/pin

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:** none (empty body `{}`)

Promotes the target announcement to the pinned slot. If another announcement is
already pinned, it is demoted back to the feed (with `isPinned: false`) before
the new one is pinned.

**Success response:**

```json
{ "success": true, "data": { <announcement object with isPinned: true> } }
```

**Error codes:**

- `404` — announcement not found

---

### PATCH /announcements/:id/unpin

**Role:** HR_ADMIN, SUPER_ADMIN
**Request body:** none (empty body `{}`)

Demotes the currently pinned announcement back to the feed (prepended, `isPinned: false`).

**Success response:**

```json
{ "success": true, "data": { "unpinned": true } }
```

**Error codes:**

- `409` — announcement is not currently pinned

---

## Domain E — Departments (existing endpoint extensions)

> These are **changes to existing live endpoints**, not new routes.
> The backend must be updated to accept the `headEmployeeId` field.
> MSW is not needed — the existing handlers pass through to the live backend.
> When the backend ships support, the frontend will work automatically (the field
> is already sent in the request payload).

### PATCH /departments/:id — add headEmployeeId

**Change:** Accept `headEmployeeId` in the request body (already in the response shape).

**Role:** HR_ADMIN, SUPER_ADMIN
**Updated body (any subset — existing fields unchanged):**

```json
{
  "name": "Engineering",
  "departmentCode": "ENG",
  "parentId": null,
  "headEmployeeId": "emp_abc123",
  "headEmployeeFirstName": "Aman",
  "headEmployeeLastName": "Khanna"
}
```

`headEmployeeFirstName` and `headEmployeeLastName` are sent alongside `headEmployeeId` for
denormalization / audit purposes. The backend should treat them as informational — the
authoritative name is always resolved from the employee record via `headEmployeeId`.

Setting `headEmployeeId: null` clears the department head (send `headEmployeeFirstName: null,
headEmployeeLastName: null` in the same call).
The employee must exist and be `ACTIVE`; otherwise return `422` with field error `headEmployeeId`.

**Success response:** `200`, `data` = updated department object (unchanged shape — `headEmployeeId` and `headEmployee` already present)

**New error codes:**

| Code                    | Status | When                             |
| ----------------------- | ------ | -------------------------------- |
| `INVALID_HEAD_EMPLOYEE` | 422    | Employee not found or not ACTIVE |

---

### POST /departments — add headEmployeeId

**Change:** Accept optional `headEmployeeId` on create (same validation as PATCH above).

**Role:** HR_ADMIN, SUPER_ADMIN
**Updated body:**

```json
{
  "name": "Design",
  "departmentCode": "DES",
  "parentId": "dept_engineering_id",
  "headEmployeeId": "emp_abc123"
}
```

`headEmployeeId` is optional — omit or pass `null` to create with no head.

**Success response:** `201`, `data` = created department object

---

## Domain F — Payroll Global Implementation

> Drives BUILD_PLAN "PHASE: Payroll Global Implementation" (Steps 93–117). Standing
> rules: `CLAUDE.md §26`. Design: `docs/payroll/PAYROLL_SYSTEM_DESIGN.md`.
> **Money:** all amounts are **integer minor units** + an ISO 4217 `currency` field
> (zero-decimal-currency aware). **Casing:** camelCase. **MSW-first** — no live
> payroll backend exists.

### F.0 — API_MAPPING.md analysis (what changes on the live contract)

- **`API_MAPPING.md` contains NO payroll endpoints.** Payroll (and `/reports/payroll`)
  is entirely MSW-backed (`docs/phase2api.md` Domains 1–3). Therefore **no live
  payroll API changes** — every payroll endpoint is net-new or an MSW-contract extension.
- **`/employees` (live) is NOT changed.** Decision locked (CLAUDE.md §26): country,
  legal entity, work location, bank account, statutory profile, and salary all live
  under `/payroll/*`. Do **not** add payroll fields to the employees endpoint.
- **Existing MSW payroll contract (`phase2api.md`) evolves** — documented as
  "extensions" below (component types, `EmployeeSalary` bank/country shape, run `type`,
  computed payslip fields). When a real backend ships, these supersede the
  `phase2api.md` versions.

Endpoints are grouped P0→P3 (matching the steps). **Foundational endpoints (P0/P1)
carry full shapes; later endpoints carry method/path/role/purpose + key fields and are
finalized in their BUILD_PLAN step per §22.**

---

### F.1 — Localization (Step 94–95)

#### `GET /payroll/countries`

**Roles:** HR_ADMIN, SUPER_ADMIN. Returns supported countries.

```json
{
  "success": true,
  "data": [
    {
      "code": "IN",
      "name": "India",
      "currency": "INR",
      "locale": "en-IN",
      "fiscalYearStartMonth": 4
    },
    {
      "code": "US",
      "name": "United States",
      "currency": "USD",
      "locale": "en-US",
      "fiscalYearStartMonth": 1
    }
  ]
}
```

#### `GET/POST/PATCH /payroll/legal-entities`

**Roles:** SUPER_ADMIN (write), HR_ADMIN (read).

```json
{
  "id": "le_in",
  "name": "Acme India Pvt Ltd",
  "country": "IN",
  "currency": "INR",
  "fiscalYearStartMonth": 4,
  "timezone": "Asia/Kolkata",
  "locale": "en-IN",
  "registrationIds": { "PF": "MHBAN1234567", "ESI": "12345678901234", "PAN": "AAAAA1234A" },
  "statutoryPackId": "pack_in_2026",
  "payCalendarId": "cal_in_monthly",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

#### `GET /payroll/countries/:code/bank-schema`

**Roles:** HR_ADMIN, SUPER_ADMIN. Field defs to render the bank form via `DynamicForm`.

```json
{
  "success": true,
  "data": {
    "country": "IN",
    "fields": [
      { "key": "accountName", "label": "Account holder name", "type": "text", "required": true },
      {
        "key": "accountNumber",
        "label": "Account number",
        "type": "text",
        "required": true,
        "regex": "^[0-9]{9,18}$"
      },
      {
        "key": "ifsc",
        "label": "IFSC code",
        "type": "text",
        "required": true,
        "regex": "^[A-Z]{4}0[A-Z0-9]{6}$"
      }
    ]
  }
}
```

> US returns `routingNumber + accountNumber + accountType`; UK `sortCode + accountNumber`;
> SEPA `iban + bic`. Same envelope, country-specific `fields`.

---

### F.2 — Salary component extensions (Step 93)

**Extends** `phase2api.md §1.1`. `POST/PATCH /payroll/components` and the list item gain:

```jsonc
{
  "type": "EMPLOYER_CONTRIBUTION", // new: EARNING | DEDUCTION | EMPLOYER_CONTRIBUTION | BENEFIT | REIMBURSEMENT | VARIABLE
  "statutoryTag": "PF_WAGE", // string|null — which wage base this earning feeds (for §F.3)
  "prorate": true, // boolean — does LOP reduce this component
  "payInPeriods": null, // number[]|null — for scheduled comps (13th-month, etc.); null = every period
}
```

- `EMPLOYER_CONTRIBUTION` is an employer **cost** — included in CTC/employerCost,
  **never** reduces `netPay`.
- New error: `400 INVALID_STATUTORY_TAG` — `statutoryTag` not known to the active pack.

---

### F.3 — Statutory & tax engine (Step 97–99)

#### `GET/POST/PATCH /payroll/statutory-packs`

**Roles:** SUPER_ADMIN (write), HR_ADMIN (read). Versioned, effective-dated, country-scoped.

```jsonc
{
  "id": "pack_in_2026",
  "country": "IN",
  "version": "2026.1",
  "effectiveFrom": "2026-04-01",
  "effectiveTo": null,
  "rounding": { "mode": "NEAREST", "precision": 0 },
  "proration": { "basis": "CALENDAR_DAYS" }, // CALENDAR_DAYS | WORKING_DAYS | FIXED_30
  "taxRegimes": [
    {
      "code": "IN_NEW_REGIME",
      "fiscalYear": "2026-27",
      "currency": "INR",
      "standardDeduction": 7500000, // minor units
      "slabs": [
        { "from": 0, "to": 40000000, "rate": 0 },
        { "from": 40000000, "to": 80000000, "rate": 5 },
        { "from": 80000000, "to": null, "rate": 30 },
      ],
      "surcharge": [{ "thresholdAnnual": 500000000, "rate": 10 }],
      "cess": { "rate": 4 },
      "allowedExemptions": ["HRA", "LTA", "80C", "80D", "STD_DEDUCTION"],
    },
  ],
  "contributionSchemes": [
    {
      "code": "IN_EPF",
      "name": "Employees' Provident Fund",
      "wageBaseTag": "PF_WAGE",
      "wageCeiling": 1500000, // minor units
      "employee": { "rate": 12, "component": "PF" }, // component code is tenant-defined
      "employer": { "rate": 12, "component": "PF_ER", "split": { "EPS": 8.33, "EPF": 3.67 } },
      "applicability": "GROSS_BELOW_CEILING_OPTIONAL",
    },
  ],
  "localTaxes": [
    {
      "code": "IN_MH_PT",
      "name": "Professional Tax (Maharashtra)",
      "jurisdiction": "IN-MH",
      "component": "PROF_TAX",
      "slabs": [
        { "from": 0, "to": 750000, "amount": 0 },
        { "from": 750000, "to": null, "amount": 20000 },
      ],
    },
  ],
  "statutoryComponents": ["PF_EE", "PF_ER", "ESI_EE", "ESI_ER", "PROF_TAX", "TDS"],
}
```

- Errors: `409 PACK_VERSION_EXISTS`, `422 INVALID_PACK` (overlapping effective ranges,
  unknown component codes).
- **List:** `GET /payroll/statutory-packs[?country=IN]` → `{ success, data: StatutoryPack[] }`.
  `GET /payroll/statutory-packs/:id` → `{ success, data: StatutoryPack }`. Seeds: `pack_in_2026`
  (IN, 2026.1) and `pack_us_2026` (US, 2026.1).
- **Run pinning:** `PayrollRun` gains `configSnapshotRef` — the pack id+version pinned at
  `calculate` time, resolved by the run's entity country + period. Recompute uses the pinned
  version (reproducibility). Shape:

```jsonc
{
  "statutoryPackId": "pack_in_2026",
  "country": "IN",
  "version": "2026.1",
  "effectiveFrom": "2026-04-01",
  "pinnedAt": "2026-06-06T10:00:00.000Z",
}
```

> `tax-regimes` and `contribution-schemes` may also be exposed as standalone CRUD
> (`GET/POST/PATCH /payroll/tax-regimes`, `/payroll/contribution-schemes`) scoped to a
> pack version — finalized in Steps 98–99.

**Tax computation (Step 98 — engine behavior, no new route).** Income tax is computed
from the pinned pack's `taxRegimes[0]`, never a flat rate in code:

- The engine projects full-year taxable income (taxable earnings × 12), applies the
  regime: `standardDeduction` → progressive `slabs` (each band taxes only its own
  portion) → highest applicable `surcharge` band (on tax) → `cess` (on tax + surcharge),
  then spreads the annual tax across the year (÷ remaining periods). YTD true-up is
  wired in Step 100.
- Progressive brackets are evaluated by the `SLAB(value, tableCode)` formula function
  (with `CLAMP(v, lo, hi)`); a tenant can reference a regime's table by code in any
  component formula. No `IF()` chains, no per-country code.
- The computed amount overrides the `TDS` payslip line; recompute is reproducible
  (same pinned pack → same numbers).

**Statutory contributions (Step 99 — engine behavior, no new route).** For each
`contributionScheme` in the pinned pack, the engine builds the **wage base** from
earnings whose component `statutoryTag` matches the scheme's `wageBaseTag`, caps it at
`wageCeiling`, then posts the employee `rate` as a **deduction** (`employee.component`)
and the employer `rate` as an **employer contribution** (`employer.component`, an
employer cost — never reduces net). Schemes with no tagged earnings (zero base) are not
applicable and emit nothing. Component codes referenced by a scheme are tenant-defined
(the IN seed uses `PF` / `PF_ER`).

---

### F.4 — Employee payroll (Step 95, 100, 102, 103)

#### `EmployeeSalary` extension (Step 95)

Replaces the hardcoded India bank fields (`bankIfscCode`, …) with:

```jsonc
{
  "country": "IN",
  "currency": "INR",
  "annualCtc": 120000000, // minor units
  "rateType": "ANNUAL", // ANNUAL | MONTHLY | HOURLY | DAILY
  "bankAccount": { "accountName": "...", "accountNumber": "...", "ifsc": "..." }, // shape from §F.1 bank-schema
  "residenceJurisdiction": "IN-MH", // Step 106
  "workLocations": [{ "jurisdiction": "IN-MH", "allocationPct": 100 }], // Step 106
}
```

#### `GET /payroll/employees/:id/ytd?fy=YYYY-YY` (Step 100)

Per-employee, per-fiscal-year cumulative ledger, accumulated from the fiscal-year
start through the current period (the fiscal-year start month comes from the
employee's country — IN = April). Omitting `fy` returns the current fiscal year.
The same shape is embedded on each computed payslip as `payslip.ytd`.

```json
{
  "success": true,
  "data": {
    "fiscalYear": "2026-27",
    "monthsElapsed": 3,
    "grossEarnings": 60000000,
    "taxableIncome": 52000000,
    "taxDeducted": 3960000,
    "totalDeductions": 5760000,
    "netPay": 54240000,
    "contributions": { "PF": 360000, "PF_ER": 360000 }
  }
}
```

> The income-tax `taxDeducted` uses a **YTD true-up**: each period withholds the
> remaining projected annual tax over the periods left, so withholding is smooth and
> self-correcting (component codes follow the tenant's seed — IN uses `PF` / `PF_ER`).

#### `GET/POST/PATCH /payroll/employees/:id/tax-declaration` (Step 102)

`GET ?fy=YYYY-YY` returns the stored declaration, or a default
`{ employeeId, fiscalYear, regime: <pack's first regime>, items: [] }`. `POST` replaces
the declaration; `PATCH` merges `regime` / `items` (HR uses it to set `proofStatus`).

```jsonc
{
  "employeeId": "emp-004",
  "fiscalYear": "2026-27",
  "regime": "IN_NEW_REGIME", // chosen from the pack's taxRegimes
  "items": [
    { "code": "80C", "amount": 15000000, "proofStatus": "PENDING" },
    {
      "code": "HRA",
      "amount": 30000000,
      "meta": { "rentPaid": 30000000, "metro": true },
      "proofStatus": "VERIFIED", // PENDING | VERIFIED | REJECTED
    },
  ],
}
```

> **Engine effect:** the run picks the declaration's `regime` (falling back to the pack's
> first) and reduces annual taxable income by the sum of **VERIFIED** items whose `code` is
> in that regime's `allowedExemptions` (excluding `STD_DEDUCTION`). The IN pack now ships
> two regimes — `IN_NEW_REGIME` (concessional rates, exemptions disallowed) and
> `IN_OLD_REGIME` (higher rates, exemptions allowed) — so regime choice is meaningful.

#### `GET/POST/PATCH /payroll/employees/:id/loans` (Step 103)

`Loan` = `{ id, employeeId, type: LOAN|ADVANCE, principal, currency, interestMethod: REDUCING|FLAT|ZERO,
annualRatePct, tenureMonths, startPeriod, emiAmount, schedule[], outstandingBalance, status: ACTIVE|CLOSED|FORECLOSED, forecloseFromPeriod }`.
Each `schedule[]` entry is `{ installmentNo, period, emi, principalComponent, interestComponent, balanceAfter, status: PENDING|RECOVERED }`
(amounts minor units). Installment recovery + `outstandingBalance` are **derived from the calendar**
(installments with `period < now` are RECOVERED). `PATCH .../loans/:loanId { action: "foreclose" }`
stops EMIs from the current period; `422 INVALID_LOAN` on non-positive principal/tenure.

> **Engine effect:** for each active loan with a schedule entry for the run's period, the engine
> recovers the EMI as a **deduction** (`EMI_<loanId>`), reducing net pay. Foreclosed loans stop
> from `forecloseFromPeriod`. Outstanding balance carries to FnF (Step 105).

---

### F.5 — Payroll runs (Step 96, 101, 105, 108)

#### `POST /payroll/runs/:id/calculate` — **real compute** (Step 96)

**No new route** — behavior change. The engine iterates included employees, runs the
component graph per their salary config, applies proration, and persists **computed**
payslips. Response unchanged (`202` + `{ status, estimatedSeconds }`); subsequent
`GET /payroll/runs/:id` returns **derived** totals/summary (not hardcoded). Computed
payslip detail adds `employerContributions[]` and (Step 100) a `ytd` block.

#### Run inputs (Step 101)

- `GET /payroll/runs/:runId/inputs` → `{ runId, period, editable, inputs: PayrollInput[] }`.
  `editable` is true only while the run is `DRAFT`. `PayrollInput` =
  `{ employeeId, employeeCode, employeeName, lopDays, leaveDays, otHours, variablePay: Record<code,amount>, oneTime: { label, amount, kind: ADDITION|DEDUCTION }[] }`.
  Inputs are lazily seeded from the roster; **`lopDays` defaults from attendance**.
- `PATCH /payroll/runs/:runId/inputs/:employeeId` — partial update of one employee's input
  (`{ lopDays? , leaveDays? , otHours? , variablePay? , oneTime? }`). `404` if the employee
  is not in the run.
- `POST /payroll/runs/:runId/inputs/import` — body `{ csv }` (header row +
  `employeeCode,lopDays,otHours,leaveDays`); returns `{ updated, skipped, errors[] }`.
- **Effect on calculate:** the engine prorates payable components by `lopDays`, prices
  `otHours` at the OT component's configurable multiplier (× hourly rate), pulls
  `VARIABLE` component amounts from `variablePay`, and folds `oneTime` into net pay.
  Reads (`GET payslips` / run) reflect the stored inputs, so re-calculation is reproducible.

#### Run types (Step 105)

`POST /payroll/runs` body gains `type: REGULAR | OFF_CYCLE | BONUS | ARREARS | FNF | REVERSAL`
(default `REGULAR`) and, for FnF, `fnf: { employeeId, lastWorkingDay, yearsOfService, leaveBalanceDays, noticeShortfallDays }`.
`409 RUN_EXISTS` applies only to a second **REGULAR** run for a period (off-cycle/bonus/FnF
coexist); `422 INVALID_RUN_TYPE` on an unknown type. The run carries `type`, plus
`employeeId` + `fnfParams` for FnF.

- `GET /payroll/runs/:id/fnf` → `FnfSettlement` `{ employeeId, employeeName, lastWorkingDay,
currency, earnings[], deductions[], grossPayable, totalRecovery, netSettlement }` (amounts
  minor units). Earnings = pro-rated salary + leave encashment + **gratuity** (from the pinned
  pack's `gratuity` policy: `daysPerYear`/`monthDivisor`/`minYears`); deductions = notice
  recovery + outstanding-**loan recovery** + final tax. Calculating an FnF run sets the run
  totals from the settlement.
- `GET /payroll/roster` → `{ employeeId, employeeCode, employeeName }[]` (run-subject picker).

> Arrears auto-detection from back-dated comp revisions is recorded via the `ARREARS` type;
> full arrears computation lands with the broader run-recompute work (Step 108).

#### Country pay practices & multi-jurisdiction tax (Step 106)

All of the following are **configuration**, switched on per tenant — never a
`country ===` branch. They reuse the existing engine primitives (scheduled
components, input-driven components, post-compute checks, pack-resolved local taxes).

**Component scheduling (`payInPeriods`, §F.2).** A component may set
`payInPeriods: number[] | null` (calendar months 1–12; `null` = every period). The
engine **emits the component only in the listed months** — this models 13th/14th-month
pay and holiday allowance as ordinary scheduled components (e.g. a `FORMULA` earning
`BASIC` with `payInPeriods: [12]`). Outside those months the component contributes 0.

**Input-driven premiums (§F.5 run inputs extended).** `PayrollInput` gains
`shiftHours` and `onCallHours` (alongside `otHours`). Each is priced exactly like
overtime — `hours × hourlyRate × (component.value / 100)` — using the tenant's `SHIFT`
and `ONCALL` components' configurable multipliers (e.g. `SHIFT.value = 130` → 1.3×
hourly night-shift differential; `ONCALL.value = 50` → 0.5× standby). No premium rate
lives in code.

- CSV import (`POST /payroll/runs/:runId/inputs/import`) additionally recognises
  `shiftHours` and `onCallHours` columns.

**Benefits-in-kind / perquisites.** A non-cash `BENEFIT` component with `taxable: true`
contributes its value to **taxable income** (raising income-tax withholding) but **never**
to gross or net pay — it remains an employer cost. The engine's taxable base therefore
includes taxable `BENEFIT` components in addition to taxable `EARNING`/`VARIABLE`.

**Minimum-wage compliance check.** The pack gains
`minimumWages: { jurisdiction, monthlyFloor }[]` (minor units). After computing each
employee, if monthly gross falls below the highest applicable jurisdiction floor, the
run emits a `PayrollRunWarning` (`message: "Gross … is below the … minimum wage …"`). It
flags, never silently raises.

**Multi-jurisdiction tax (`EmployeeSalary`, §F.4).** `EmployeeSalary` carries
`residenceJurisdiction` (ISO 3166-2) and `workLocations: { jurisdiction, allocationPct }[]`.
The engine resolves the **applicable jurisdiction set** (residence + work locations,
deduped) and applies **each** matching `pack.localTaxes` entry (e.g. professional tax /
LWF), posting the flat band amount to the tax's `component`. This replaces the old
hardcoded `PROF_TAX` formula: the same `PROF_TAX` line is now driven by the pack and the
employee's jurisdiction, so an employee in `IN-KA` and one in `IN-MH` get their state's
amount from config alone.

> No new routes. These are field additions on existing endpoints
> (`/payroll/components`, `/payroll/statutory-packs`, `/payroll/employees/:id/salary`,
> `/payroll/runs/:runId/inputs`) plus engine behaviour. Field casing camelCase.

#### Approvals, variance, dry-run, audit (Step 108)

- **Approval chain.** On `calculate`, the run gains
  `approvals: { level, label, status: PENDING|APPROVED, approver, approvedAt }[]` — a
  configurable multi-level chain (one level by default; a second **Finance** level when
  net exceeds a threshold). Returned on `GET /payroll/runs/:id`.
- `POST /payroll/runs/:id/approvals/:level` — body `{ approver, notes? }`. Records a
  level's sign-off and flips the run to `APPROVED` once **every** level is approved.
  Enforces **maker ≠ checker** (`403 SELF_APPROVAL` if `approver === initiatedBy`),
  one distinct approver per level (`403 SELF_APPROVAL`), sequential order
  (`422 OUT_OF_ORDER`), and `422 INVALID_STATE` outside REVIEW. The legacy
  `POST /payroll/runs/:id/approve` single-shot remains (approves the whole chain).
- `GET /payroll/runs/:id/variance` →
  `{ runId, thresholdPct, comparedToPeriod, items: { employeeId, employeeName, currentNet, previousNet, deltaPct, flags: (HIGH_VARIANCE|NEGATIVE_NET|ZERO_PAY|NEW_JOINER)[] }[] }`.
  Compares per-employee net to the most recent prior REGULAR run.
- `POST /payroll/runs/:id/calculate?dryRun=true` — computes numbers + variance in a
  sandbox and returns `{ dryRun: true, employeeCount, totalGross, totalDeductions, employerCost, totalNet, currency, warnings, variance }` **without** persisting, changing
  status, attaching claims, or moving money.
- `POST /payroll/runs/:id/payslips/:slipId/recalculate` — body `{ actor }`. Recomputes
  a single payslip deterministically (idempotent; same inputs → same numbers) and returns
  the payslip detail.
- `GET /payroll/runs/:id/audit` → `PayrollRunAuditEntry[]`
  (`{ id, runId, action, actor, at, detail? }`). Every transition / override / approval
  (`CALCULATE`, `APPROVE_L<n>`, `MARK_PAID`, `ADJUST`, `REPROCESS`, `HOLD`, `RELEASE`,
  `CANCEL`) appends an entry.

#### Hold / release a single payslip (Step 118)

A maker-checker control to **withhold one employee's payment** while paying the rest
of the run — e.g. a pending investigation or a disputed amount.

- `POST /payroll/runs/:runId/payslips/:payslipId/hold` — body `{ reason?, actor? }`.
  Marks the payslip `HELD`. Allowed only while the run is `REVIEW` or `APPROVED`
  (not after `PAID`). Returns the updated payslip detail (`status: "HELD"`). Audit: `HOLD`.
- `POST /payroll/runs/:runId/payslips/:payslipId/release` — clears the hold
  (back to `PENDING`). Audit: `RELEASE`. `404 NOT_FOUND` for an unknown run/payslip;
  `422 RUN_NOT_HOLDABLE` if the run is `DRAFT`/`CALCULATING`/`PAID`/`CANCELLED`.
- A `HELD` payslip is **excluded from disbursement** — it is dropped from the payment
  batch and the bank file, so the held employee is not paid until released.
- `GET /payroll/runs/:runId/payslips` and the single-payslip read reflect `HELD`
  by overlaying the hold store on the computed status.

#### Import overtime/LOP from timesheets (Step T6)

- `POST /payroll/runs/:id/inputs/from-timesheets` — reads **APPROVED** timesheets whose
  week falls in the run's period and pre-fills run inputs: each employee's
  `overtimeHours → otHours` (raises pay via the tenant's `OT` component); when the
  timesheet setting `unloggedHoursPolicy === 'DEDUCT'`, the standard-hours shortfall →
  added `lopDays` (lowers pay). Unpaid-**leave** LOP is untouched (leave-driven).
  Allowed only while the run is `DRAFT`/`REVIEW`; never edits a `PAID` run. Returns
  `{ updated, items }`. Audit: `INPUTS_FROM_TIMESHEETS`. Full contract: **Domain G.6**.

#### Cancel / void a run (Step 118)

- `POST /payroll/runs/:id/cancel` — body `{ reason?, actor? }`. Sets the run to
  `CANCELLED` (terminal). Allowed only before payment — run status
  `DRAFT`/`CALCULATING`/`REVIEW`. Returns the updated `PayrollRun`. Audit: `CANCEL`.
  (Endpoint already shipped in Step 96; Step 118 wires the UI action + guard.)

- **Granular permissions** (UI gating): `payroll:initiate | adjust | approve | disburse`
  — segregation of duties. Resolved client-side, falling back to HR_ADMIN / SUPER_ADMIN.
  Initiate → create/calculate/dry-run/**cancel**; adjust → adjustment/recalculate/**hold/release**;
  approve → approvals/**publish**; disburse → mark-paid/bank file.

---

### F.6 — Claims & variable pay (Step 104)

`GET/POST/PATCH /payroll/reimbursement-claims` — `{ id, employeeId, category, amount,
currency, description?, proofUrl, status: SUBMITTED|APPROVED|REJECTED|PAID, runId, submittedAt, decidedAt }`.
`GET ?employeeId=&status=` filters; `POST { ...input, employeeId }` (errors `422 CLAIM_OVER_CAP`);
`PATCH :id { status: APPROVED|REJECTED }` decides. `GET /payroll/reimbursement-categories`
→ `{ code, label, monthlyCap }[]` (per-category caps, minor units).

> **Run lifecycle:** on `calculate`, **approved, unattached** claims attach to the run
> (`runId` set) and the engine pays each as a **non-taxable one-time addition**; on
> `mark-paid` the attached claims become `PAID`. Structured **variable pay**
> (incentive/commission/bonus) is entered per employee in the run inputs (`variablePay`,
> §F.5) and the engine emits an earning line even when the component is not in the pay group.

---

### F.7 — Garnishments (Step 107)

`GET/POST/PATCH/DELETE /payroll/employees/:id/garnishments` — court-ordered, legally
mandated deductions (not voluntary). **Roles:** HR_ADMIN / SUPER_ADMIN.

```jsonc
{
  "id": "garn-001",
  "employeeId": "emp-001",
  "type": "CHILD_SUPPORT", // CHILD_SUPPORT | SPOUSAL_SUPPORT | TAX_LEVY | COURT_ORDER | DEFAULTED_LOAN
  "priority": 1, // lower = satisfied first when disposable income is insufficient
  "amount": { "kind": "PERCENT_OF_DISPOSABLE", "value": 20 }, // kind: FLAT (minor units) | PERCENT_OF_DISPOSABLE (percent)
  "protectedEarningsFloor": 2500000, // minor units — minimum take-home retained
  "cap": null, // minor units | null — optional per-order maximum
  "reference": "COURT/2026/1234",
  "effectiveFrom": "2026-04-01",
  "effectiveTo": null,
  "createdAt": "2026-03-15T00:00:00.000Z",
}
```

- `GET` → `{ success, data: Garnishment[] }` sorted by `priority`. `POST` body is the
  shape minus `id`/`employeeId`/`createdAt` (errors `422 INVALID_GARNISHMENT` on
  non-positive amount or priority < 1). `DELETE :garnishmentId` → `{ deleted: true }`
  (`404` if missing).
- **Engine behaviour:** garnishments are applied **after** statutory deductions and
  **before** voluntary ones (loans). Disposable = gross − statutory deductions; orders
  are taken in priority order, each withholding a flat amount or percent-of-disposable,
  optionally capped, and never reducing running take-home below the order's
  `protectedEarningsFloor`. Posts a `GARN_<id>` deduction line. Money fields are minor
  units (the engine converts disposable to minor for the order math, back to major for
  the payslip line). No country rule lives in code — priority/floor/cap are all data.

---

### F.8 — Global employment models (Step 109)

One tenant pays salaried **employees** (own entity), invoice-based **contractors** (no
statutory withholding; optional WHT-at-source), and **EOR** workers (paid via a partner
entity abroad). **Roles:** HR_ADMIN / SUPER_ADMIN. Money is minor units.

- **Workers.** `GET /payroll/workers[?classification=EMPLOYEE|CONTRACTOR|EOR]` →
  `Worker[]` = `{ id, name, classification, country, currency, legalEntityId, legalEntityName, monthlyCost, riskFlag, active }`.
  `PATCH /payroll/workers/:id { classification }` re-classifies (drives which pipeline
  applies). `riskFlag` carries a **misclassification** warning (e.g. a contractor working
  like staff).
- **Contractor invoices.** `GET /payroll/contractor-invoices[?workerId=&status=]` →
  `ContractorInvoice[]` = `{ id, workerId, workerName, period, amount, currency, withholdingPct, netPayable, status: SUBMITTED|APPROVED|PAID, payoutRef, submittedAt, decidedAt }`.
  `POST { workerId, period, amount, currency?, withholdingPct? }` (server computes
  `netPayable = amount − round(amount·withholdingPct/100)`; `422 INVALID_WORKER` unless
  the worker is a CONTRACTOR). `PATCH :id { status, payoutRef? }` approves / pays
  (multi-currency payout; `PAID` records a payout reference).
- **Cost aggregation.** `GET /payroll/cost-summary?groupBy=entity|currency|classification`
  → `{ groupBy, baseCurrency, totalBaseCost, totalWorkers, groups: { key, workerCount, baseAmount }[], fxRates }`.
  Each worker's `monthlyCost` is consolidated into the base currency via a date-effective
  **FX table** (§3.3) — global total people cost across entities, currencies, and types.

---

### F.9 — Disbursement (Step 110)

Post-approval payout. A **payment batch** turns an approved run's payslips into a
per-employee payout ledger; the **bank file** is generated from a **config-driven
format registry** (no `if (country === …)` — each format is an ordered column spec read
from data, so a new format is added by entering config, not code). The per-payslip
status lifecycle is `PENDING → PROCESSING → PAID | FAILED | RETURNED`, reconciled back
from the (mock) bank/gateway. **Roles:** HR_ADMIN / SUPER_ADMIN. Line amounts mirror the
run's payslip net (run-domain major units) with the line's ISO currency.

- **PaymentBatchLine** =
  `{ payslipId, employeeId, employeeCode, employeeName, amount, currency, status: PENDING|PROCESSING|PAID|FAILED|RETURNED, failureReason, payoutRef }`.
- **PaymentBatch** =
  `{ id, runId, count, totalAmount, currency, status: PENDING|PROCESSING|COMPLETED, createdAt, reconciledAt, lines: PaymentBatchLine[] }`.
- `GET /payroll/runs/:id/payment-batch` → `PaymentBatch | null` (the latest batch for the
  run; `null` before one is generated).
- `POST /payroll/runs/:id/payment-batch` → `PaymentBatch` (one line per payslip, all
  `PENDING`; `422 RUN_NOT_PAYABLE` unless the run is `APPROVED` or `PAID`).
- `GET /payroll/runs/:id/bank-file?format=NACH|ACH|SEPA|BACS` → text file download
  (`Content-Disposition: attachment`); columns come from the format registry
  (`422 UNKNOWN_FORMAT` for an unknown code). Format is config-driven, never branched.
- `GET /payroll/payment-batches/:id/status` → `PaymentBatch` (per-payslip statuses).
- `POST /payroll/payment-batches/:id/reconcile` → `PaymentBatch` — simulates the
  bank/gateway callback, advancing the lifecycle one step (`PENDING`→`PROCESSING` for all
  lines, then `PROCESSING`→`PAID`/`FAILED`/`RETURNED`; batch → `COMPLETED`).

---

### F.10 — Documents & events (Step 111–112)

**Payslip template (config-driven, Step 111).** One tenant-level template; the payslip
layout is **data** (section order/visibility/labels, header fields, logo, locale) — not a
per-country React component. **Roles:** HR_ADMIN / SUPER_ADMIN.

- **PayslipTemplateSection** =
  `{ key: earnings|deductions|employerContributions|oneTime|ytd|attendance|paymentInfo, label, enabled, order }`
  (`label` carries the locale-specific heading; `order` + `enabled` drive layout).
- **PayslipTemplateField** =
  `{ key: employeeCode|designation|department|pan|payDate|paymentRef, label, enabled }`
  (header fields shown on the slip).
- **PayslipTemplate** =
  `{ id, name, locale, logoUrl, sections: PayslipTemplateSection[], fields: PayslipTemplateField[], updatedAt }`.
- `GET /payroll/payslip-templates` → `PayslipTemplate` (single tenant template).
- `PATCH /payroll/payslip-templates { name?, locale?, logoUrl?, sections?, fields? }` → updated
  `PayslipTemplate`.

**Publish workflow (Step 111).** Payslips are visible to employees only once their run is
published.

- A run carries `published: boolean` and `publishedAt: string | null`.
- `POST /payroll/runs/:id/publish` → `PayrollRun` (sets `published`/`publishedAt`;
  `422 RUN_NOT_PUBLISHABLE` unless the run is `APPROVED` or `PAID`). Emits `payslip.published`
  and notifies affected employees.
- Employee payslip reads (`GET /payroll/employees/:id/payslips[/:slipId]`) return only
  payslips whose run is **published**.

**Events & webhook catalogue (Step 111).** Lifecycle transitions emit immutable events for
downstream systems (accounting, BI, HRIS) and in-app notifications.

- **Event types:** `payroll.run.created|calculated|approved|paid`, `payslip.published`,
  `payment.failed`, `salary.revised`, `claim.approved`.
- `GET /payroll/event-catalogue` → `{ type, label, description, category }[]` — the
  subscribable catalogue.
- `GET /payroll/events[?runId=]` → `{ id, type, runId, at, summary }[]`, most-recent first.

**Statutory documents (Step 112).** Annual tax forms are **template-driven** — a generic,
country-agnostic engine fills a form template (sections + fields) from the employee's YTD
ledger + statutory pack. No per-country React component; a new form type is added by
registering a template. **Role:** EMPLOYEE (self-service for own forms) / HR_ADMIN.

- **TaxFormDocument** =
  `{ type: FORM16|W2|P60, title, fiscalYear, jurisdiction, authority, currency, employer: TaxFormParty, employee: TaxFormParty, sections: TaxFormSection[], generatedAt }`.
- **TaxFormParty** = `{ name, subtitle?, identifiers: { label, value }[] }`
  (e.g. PAN/SSN/NINO, TAN/EIN/PAYE-ref — labels come from the template).
- **TaxFormSection** = `{ title, rows: { label, value }[] }` (values pre-formatted, so the
  client renders generically).
- `GET /payroll/employees/:id/tax-form?fy=&type=FORM16|W2|P60` → `TaxFormDocument`
  (`fy` defaults to the current fiscal year; `422 UNKNOWN_FORM_TYPE` for an unknown type;
  `404` if the employee has no payroll data).

---

### F.11 — Accounting (Step 113)

Each run produces a **balanced double-entry journal**, derived generically from the run's
computed payslips + each component's `glAccountCode` / `costCenterRule` (config, not code).
Expense lines are cost-centred by department; payable + net-pay control accounts are tenant
config. **Roles:** HR_ADMIN / SUPER_ADMIN. Amounts are run-domain major units.

- **Component config (extends `SalaryComponent`):** `glAccountCode: string | null` (the GL
  account the component posts to) and `costCenterRule: DEPARTMENT | NONE` (how its cost is
  allocated). Editable in the Salary Components drawer.
- **JournalLine** = `{ account, costCenter, debit, credit, currency }` (one of debit/credit is 0).
- **JournalDocument** =
  `{ runId, period, currency, lines: JournalLine[], totalDebit, totalCredit, balanced, generatedAt }`.
- `GET /payroll/runs/:id/journal` → `JournalDocument`. Earnings + employer-contribution
  components debit their expense account (cost-centred by department); deductions credit their
  payable account; employer contributions credit the employer-liability control account; net
  pay credits the net-pay control account — so `totalDebit === totalCredit`.
- `GET /payroll/runs/:id/journal/export?format=TALLY|QUICKBOOKS|CSV` → file download
  (format-specific serializer selected from a registry; `422 UNKNOWN_FORMAT` otherwise).

---

### F.12 — Statutory filing & registers (Step 114)

> Role: HR_ADMIN / SUPER_ADMIN. MSW handler file:
> `src/mocks/handlers/payroll-registers.ts`. Statutory-return exporter data:
> `src/mocks/data/statutory-returns.ts` (template registry, country-agnostic).
> All amounts in register rows are **major units** (the engine works in major INR);
> the consuming UI formats by each column's `kind`.

#### GET /payroll/runs/:id/statutory-return?type=ECR|24Q|RTI

Exporter **driven by the pinned statutory pack + a return template registry** — no
per-country code branch. Each return type is a template of delimited columns whose
keys resolve against a generic per-employee context (`employeeCode`, `employeeName`,
`gross`, `taxable`, `taxDeducted`, `net`, `contribution.<COMPONENT_CODE>`) built from
the run's recomputed payslips. Adding a country's return = registering a template.

- `ECR` — India EPFO electronic challan-cum-return (UAN, wages, EPF/EPS splits).
- `24Q` — India quarterly salary TDS return (PAN, amount paid, TDS).
- `RTI` — UK RTI Full Payment Submission (NINO, taxable pay, tax, NIC).

Returns a downloadable **text file** (not JSON):

```
Content-Type: text/plain
Content-Disposition: attachment; filename="statutory-return-<period>-<type>.txt"
```

Errors: `422 UNKNOWN_RETURN_TYPE` (type not in registry), `404 NOT_FOUND` (run absent).

#### GET /payroll/runs/:id/register?type=SALARY|STATUTORY|BANK_ADVICE|VARIANCE

Returns a **self-describing** register (columns are config, not hardcoded in the UI):

```json
{
  "success": true,
  "data": {
    "register": "SALARY",
    "runId": "run-...",
    "period": "2026-04",
    "periodLabel": "April 2026",
    "currency": "INR",
    "columns": [
      { "key": "employeeCode", "label": "Code", "align": "left", "kind": "text" },
      { "key": "gross", "label": "Gross", "align": "right", "kind": "money" }
    ],
    "rows": [{ "employeeCode": "E0001", "gross": 200000 }],
    "summary": [{ "label": "Total gross", "value": "₹20,00,000" }],
    "generatedAt": "2026-04-28T10:00:00.000Z"
  }
}
```

- `SALARY` — per-employee gross / deductions / employer cost / net (from payslips).
- `STATUTORY` — one money column per `pack.statutoryComponents` code present in the
  run (PF, PF_ER, ESI_EE, ESI_ER, PROF_TAX, TDS, …) — columns derived from the pack.
- `BANK_ADVICE` — per-payee net amount + currency + payment reference.
- `VARIANCE` — per-employee net Δ% vs the prior regular run + outlier flags
  (reuses the run's variance computation).

`column.kind` ∈ `text | money | number | percent`. `404 NOT_FOUND` if run absent;
`422 UNKNOWN_REGISTER_TYPE` for an unknown type.

#### GET /payroll/runs/:id/register/export?type=…

CSV serialization of the same register (header from `columns[].label`, raw cell
values). `Content-Disposition: attachment; filename="register-<period>-<type>.csv"`.

These four registers surface in the **Reports** module payroll category
(`payroll/salary-register`, `payroll/statutory-register`, `payroll/bank-advice`,
`payroll/variance-register`) — each a `ReportShell` + `DynamicTable` panel with a
run selector, reusing the existing report chrome.

---

### F.13 — Onboarding & migration (Step 115)

> Role: HR_ADMIN / SUPER_ADMIN. MSW handler file:
> `src/mocks/handlers/payroll-migration.ts`. Money fields are **major units**
> (run-domain), dates `YYYY-MM-DD` / periods `YYYY-MM`.

#### GET/POST/PATCH /payroll/pay-calendars

A published pay schedule per legal entity — cutoffs, processing & pay dates.

```jsonc
// PayCalendar
{
  "id": "cal-1",
  "name": "India Monthly",
  "legalEntityId": "le-in",
  "frequency": "MONTHLY", // MONTHLY | SEMI_MONTHLY | BIWEEKLY | WEEKLY
  "periodAnchor": 1, // day-of-month the cycle's period starts (1–28)
  "payDateRule": "LAST_WORKING_DAY", // LAST_WORKING_DAY | FIXED_DAY | NEXT_MONTH_FIXED_DAY
  "payDay": null, // day-of-month for FIXED_DAY rules, else null
  "cutoffDay": 25, // attendance/input cutoff day-of-month
  "holidayCalendarId": null,
  "createdAt": "…",
  "updatedAt": "…",
}
```

POST/PATCH body is the same minus server fields (`PayCalendarInput`). List →
`{ success, data: PayCalendar[] }`. `404 NOT_FOUND` on PATCH of an unknown id.

#### GET /payroll/opening-balances · POST /payroll/employees/:id/opening-balances

Opening YTD per employee, so the **first** run computes correct cumulative tax &
ceilings (§5.5). POST body (`OpeningBalanceInput`):

```json
{
  "fiscalYear": "2026-27",
  "grossEarnings": 1200000,
  "taxableIncome": 1080000,
  "taxDeducted": 90000,
  "totalDeductions": 180000,
  "netPay": 1020000,
  "contributions": { "PF": 86400 }
}
```

Stored as `OpeningBalance` (adds `employeeCode`, `employeeName`, `importedAt`). POST is
idempotent per `(employeeId, fiscalYear)` — re-posting replaces. List →
`{ success, data: OpeningBalance[] }`. `404` if the employee is not on the roster.

#### GET / POST /payroll/migration/historical-payslips

Bulk-import prior payslips for continuity & tax forms. POST body:
`{ rows: HistoricalPayslipImportRow[] }` where each row is
`{ employeeCode, period (YYYY-MM), grossEarnings, totalDeductions, netPay }`. Returns
`HistoricalPayslipImportResult`: `{ imported, failed, errors: { row, message }[] }`
(an unknown `employeeCode` is a per-row error, not a 4xx). GET →
`{ success, data: { count, rows: HistoricalPayslipImportRow[] } }`.

#### POST /payroll/runs/:id/parallel-reconcile

Diff the run's **computed** net pay against **legacy** figures, employee-by-employee.
Body (`ParallelReconcileInput`):
`{ tolerance?: number, legacy: { employeeCode, netPay }[] }`. Returns
`ParallelReconcileResult`:

```jsonc
{
  "runId": "run-1",
  "period": "2026-04",
  "currency": "INR",
  "tolerance": 0,
  "matched": 9,
  "mismatched": 1,
  "missing": 0,
  "items": [
    {
      "employeeId": "emp-001",
      "employeeCode": "E0001",
      "employeeName": "Aman Kumar",
      "computedNet": 178520,
      "legacyNet": 178520,
      "diff": 0,
      "status": "MATCH",
    },
    // status: MATCH (|diff| ≤ tolerance) | MISMATCH | MISSING (no legacy row)
  ],
  "generatedAt": "…",
}
```

`404 NOT_FOUND` if the run is absent.

#### GET/PATCH /payroll/migration/status

Tenant migration state incl. the **sandbox/test** flag and go-live period.

```json
{
  "sandboxMode": true,
  "goLivePeriod": null,
  "openingBalancesCount": 0,
  "historicalPayslipsCount": 0,
  "lastReconciledRunId": null,
  "updatedAt": "…"
}
```

PATCH body (`MigrationStatusInput`): `{ sandboxMode?, goLivePeriod? }`. The three
counts/`lastReconciledRunId` are server-derived (read-only).

UI: a light migration **wizard** at `/payroll/migration` (HR_ADMIN / SUPER_ADMIN) —
tabs for Pay Calendar, Opening Balances, Historical Payslips, Parallel Run, Go-Live.

---

### F.14 — Compliance reporting (Step 116)

> Role: HR_ADMIN / SUPER_ADMIN. MSW handler file:
> `src/mocks/handlers/payroll-compliance.ts`. Money fields are **major units**.

#### GET /payroll/reports/pay-equity?groupBy=gender|level|location

Pay-equity / gender-pay-gap & diversity pay analysis — computed from compensation +
demographics. Each group's mean/median pay and the gap vs the highest-paid
(reference) group.

```jsonc
{
  "success": true,
  "data": {
    "groupBy": "gender",
    "currency": "INR",
    "referenceGroup": "Male",
    "overallMeanGapPct": 12.4, // largest disadvantage vs reference, mean
    "overallMedianGapPct": 9.8,
    "groups": [
      {
        "group": "Male",
        "headcount": 5,
        "meanPay": 1860000,
        "medianPay": 1680000,
        "meanGapPct": 0,
        "medianGapPct": 0,
      },
      {
        "group": "Female",
        "headcount": 5,
        "meanPay": 1629600,
        "medianPay": 1515600,
        "meanGapPct": 12.4,
        "medianGapPct": 9.8,
      },
    ],
    "generatedAt": "…",
  },
}
```

`gap% = (referenceMean − groupMean) / referenceMean × 100` (reference group = 0).
`422 UNKNOWN_GROUP_BY` for an unknown `groupBy`.

#### GET /payroll/reports/audit-pack?runId=

Audit assurance pack for a run — **immutable run history + approval chain +
config-version pins + override/action log** — returned as a downloadable JSON file:

```
Content-Type: application/json
Content-Disposition: attachment; filename="audit-pack-<period>-<runId>.json"
```

Body assembles `{ run: { id, period, status, totals, currency }, configPin:
RunConfigSnapshotRef, approvalChain: RunApprovalLevel[], auditLog:
PayrollRunAuditEntry[], generatedAt }`. `404 NOT_FOUND` if the run is absent.

#### GET/PATCH /payroll/settings/data-policy

Per-country data residency & retention. `DataPolicy`:

```json
{
  "defaultRetentionYears": 7,
  "policies": [
    {
      "country": "IN",
      "residencyRegion": "ap-south-1",
      "retentionYears": 8,
      "statutoryHold": true
    },
    { "country": "GB", "residencyRegion": "eu-west-2", "retentionYears": 6, "statutoryHold": false }
  ],
  "updatedAt": "…"
}
```

PATCH body (`DataPolicyInput`): `{ defaultRetentionYears?, policies? }` (policies
replace the set). Surfaced as a **Settings → Pay & Compliance → Data Policy** panel.

Pay-equity surfaces as a Reports payroll panel (`payroll/pay-equity`); the audit pack
downloads from the run-detail screen.

---

### F.15 — Self-service consolidation & verification (Step 117)

**No new endpoints.** Step 117 consolidates existing employee self-service into one
tabbed **My Pay** area (`/payroll/my-payslips`) — Payslips, Comp Statement, Tax
Declaration, Claims, Loans, Tax Forms — reusing the live/MSW endpoints already in
F.4/F.6/F.10. The comp statement reads `GET /payroll/employees/:id/salary` (F.4).

Final verification gate for the phase:

- **Domain F is complete** — every payroll endpoint (F.0–F.14) is documented above.
- **All payroll handlers are MSW-only**, gated behind `NEXT_PUBLIC_USE_MOCKS` (the
  worker starts only when the flag is set — `src/mocks/MSWProvider.tsx`). When the
  backend ships a documented endpoint, flip the flag / drop the handler — no app-code
  change.
- **No-hardcode checklist (`PAYROLL_SYSTEM_DESIGN.md §16`) passes**: no
  `if (country === …)` branch in calculation or UI logic, no tax/contribution rate or
  ceiling literal in code (all read from the `StatutoryPack`), bank & statutory-ID
  fields render from the country schema via `DynamicForm`, and payslip/tax-form/return
  layouts come from templates — verified by code audit at Step 117.

---

## Domain G — Timesheets

> Screens: `/timesheets` (My Timesheet · Approvals · Projects tabs), a Settings panel,
> and a Reports utilization panel. MSW handler: `src/mocks/handlers/timesheets.ts`
> (register in `src/mocks/handlers/index.ts`). Standing rules: `CLAUDE.md §27`.
> Field casing **camelCase**. **Hours are decimal numbers** (e.g. `7.5`); dates
> `YYYY-MM-DD`; a week is its Monday (`weekStart`). All envelopes follow the app
> convention: `{ success, data }` on success; the shared error envelope on failure.
> Roles: `timesheets:write` (employee) · `:approve` (manager/HR) · `:admin` (HR) ·
> `:read` (auditor).

### G.1 — Projects & tasks (Step T1)

```jsonc
// Project
{ "id": "prj-1", "name": "Acme Mobile App", "code": "AMA", "clientName": "Acme Inc",
  "status": "ACTIVE",            // ACTIVE | ARCHIVED
  "billable": true, "defaultRate": 0, "memberIds": ["emp-001"],
  "createdAt": "…", "updatedAt": "…" }
// Task
{ "id": "tsk-1", "projectId": "prj-1", "name": "Frontend", "billable": true, "active": true }
```

- `GET /timesheets/projects[?memberId=<employeeId|self>]` → `Project[]`. **Membership
  scoping (Step T3.1):** without `memberId` the full list returns (admin / management
  view). With `memberId` (an employee id, or the literal `self` = the caller), the
  response is scoped to projects the employee may log against: those with an empty
  `memberIds` (open to everyone) **plus** those whose `memberIds` includes the resolved
  id. The Log-time picker calls it with the signed-in employee's id.
- `POST /timesheets/projects` → `Project` (201). Body may include `memberIds: string[]`
  (employees allowed to log against it; **`[]` = everyone**, the default).
- `PATCH /timesheets/projects/:id` → `Project`. `memberIds` is patchable (re-assign
  members; `[]` re-opens the project to everyone).
- `DELETE /timesheets/projects/:id` → archives (`status: ARCHIVED`) if it has entries,
  hard-deletes otherwise. `404` if absent.
- `GET /timesheets/projects/:id/tasks` → `Task[]`
- `POST /timesheets/projects/:id/tasks` → `Task` (201)
- `PATCH /timesheets/tasks/:id` → `Task`

> **`memberIds` semantics:** an empty array means the project is open to all employees
> (the default). A non-empty array restricts the Log-time picker to listed members only
> (enforced server-side via `?memberId=`). Existing time entries always remain visible
> to their author regardless of later membership changes.

### G.2 — Employee weekly timesheet + entries (Step T2)

```jsonc
// TimeEntry
{ "id": "te-1", "timesheetId": "ts-1", "employeeId": "emp-001",
  "projectId": "prj-1", "taskId": "tsk-1", "date": "2026-06-08",
  "hours": 7.5, "billable": true, "note": "Sprint work", "source": "MANUAL" } // MANUAL | TIMER
// Timesheet (one per employee per week)
{ "id": "ts-1", "employeeId": "emp-001", "employeeName": "Aman Kumar",
  "weekStart": "2026-06-08", "weekEnd": "2026-06-14",
  "status": "DRAFT",            // DRAFT | SUBMITTED | APPROVED | REJECTED
  "totalHours": 38, "billableHours": 30, "overtimeHours": 0, "standardHours": 40,
  "submittedAt": null, "decidedBy": null, "decidedAt": null, "comment": null,
  "entries": [ /* TimeEntry[] */ ] }
```

- `GET /timesheets?week=YYYY-MM-DD&employeeId=` → `Timesheet` for that week (self if
  `employeeId` omitted). Returns a synthesized `DRAFT` (empty `entries`) when none
  exists yet, so the grid always has a week to edit.
- `POST /timesheets/entries` — body `{ weekStart, projectId, taskId, date, hours, billable?, note?, source? }`
  → `TimeEntry` (201). Creates/attaches to the week's timesheet; `422` if the week is
  not `DRAFT`/`REJECTED` (can't edit a submitted/approved week). `source ∈ MANUAL | TIMER`
  (default `MANUAL`); the timer's **Stop** (Step T4) posts here with `source: "TIMER"`.
- `PATCH /timesheets/entries/:id` → `TimeEntry`.
- `DELETE /timesheets/entries/:id` → `{ id }`.
- `POST /timesheets/:id/submit` → `Timesheet` (`DRAFT`/`REJECTED` → `SUBMITTED`).
  `422 EMPTY_TIMESHEET` if zero hours; `422` if already submitted/approved.
- `overtimeHours` is derived server-side: `max(0, totalHours − standardHours)` (the
  `standardHours` comes from G.6 settings) — this is what Step T6 imports to payroll.

> **Timer (Step T4)** is **client-side state (Zustand)** — there are no dedicated timer
> endpoints. Starting/stopping the timer is UI-only; **stop** simply calls
> `POST /timesheets/entries` with `source: "TIMER"` for the elapsed duration.

### G.3 — Approvals (Step T3)

- `GET /timesheets/approvals?status=SUBMITTED` → `Timesheet[]` (manager/HR queue;
  managers see their team, HR sees all).
- `POST /timesheets/:id/approve` — body `{ comment? }` → `Timesheet` (`SUBMITTED` →
  `APPROVED`). `422` if not `SUBMITTED`.
- `POST /timesheets/:id/reject` — body `{ comment }` → `Timesheet` (`SUBMITTED` →
  `REJECTED`; the employee can edit & resubmit).

### G.4 — Reports & summary (Step T5)

- `GET /timesheets/summary?range=30d|90d&employeeId=` →
  `{ totalHours, billableHours, nonBillableHours, overtimeHours, utilizationPct,
byProject: { projectId, projectName, hours, billableHours }[],
byEmployee: { employeeId, employeeName, hours, utilizationPct }[] }`.
- Surfaces as a **Reports → (new) Timesheets** category panel, report type
  `timesheets/utilization` (additive to `reports.types.ts` — `ReportShell` +
  `ChartEngine`, same pattern as the payroll registers).

### G.5 — Settings (Step T7)

```json
{
  "standardWeeklyHours": 40,
  "overtimeThresholdHours": 40,
  "roundingMinutes": 15,
  "approvalRequired": true,
  "unloggedHoursPolicy": "FLAG",
  "billableDefault": true,
  "updatedAt": "…"
}
```

- `GET /timesheets/settings` → `TimesheetSettings`
- `PATCH /timesheets/settings` — body partial `TimesheetSettingsInput`.
  `unloggedHoursPolicy ∈ IGNORE | FLAG | DEDUCT` (default `FLAG`; only `DEDUCT` lets a
  timesheet shortfall reduce pay — see Step T6).

### G.6 — Payroll integration (Step T6) — also in Domain F.5

- `POST /payroll/runs/:id/inputs/from-timesheets` → reads **APPROVED** timesheets whose
  week falls in the run's period, maps each employee's `overtimeHours` →
  `PayrollInput.otHours`; when `unloggedHoursPolicy === 'DEDUCT'`, maps the
  standard-hours shortfall → additional `lopDays`. Returns `{ updated, items }`. LOP
  from unpaid **leave** is unchanged (leave-driven). Never edits a `PAID` run. Audit:
  `INPUTS_FROM_TIMESHEETS`. Surfaced as an **"Import from timesheets"** action on the
  run **Inputs** panel.
