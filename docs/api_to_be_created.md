# APIs to be Created by Backend Team

> **Generated: 2026-05-26**
> These are all endpoints the frontend currently serves via MSW mocks because
> they are not yet live on the backend. Once each endpoint is live, notify the
> frontend team and we will delete the MSW handler for it.
>
> **How to use this doc:**
>
> - Implement each endpoint to match the exact request body and response shape below.
> - Do NOT deviate from field names, casing, or nesting — the frontend TypeScript
>   types are already written against these shapes.
> - All responses must wrap data in `{ "success": true, "data": <payload>, "meta": {} }`.
> - All errors must use `{ "success": false, "error": { "code": "...", "message": "..." } }`.

---

## Status Overview

| #   | Endpoint                                                | Priority | Notes                                      |
| --- | ------------------------------------------------------- | -------- | ------------------------------------------ |
| 1   | `POST /auth/otp/initiate`                               | High     | MFA challenge — forgot-password flow       |
| 2   | `POST /holidays/import`                                 | Medium   | .ics upload                                |
| 3   | `GET /holidays/import/:jobId/preview`                   | Medium   | Preview before commit                      |
| 4   | `POST /holidays/import/:jobId/commit`                   | Medium   | Commit imported holidays                   |
| 5   | `GET /employee/documents`                               | High     | Employee self-service document list        |
| 6   | `GET /employee/dashboard` — `leaveBalanceSummary` field | High     | Partial — field missing from live response |
| 7   | `POST /attendance/regularization/:id/documents`         | Medium   | Upload supporting doc for regularization   |

---

## 1. `POST /auth/otp/initiate`

**Why needed:** Forgot-password flow. After `POST /auth/forgot-password` returns a `challengeId`,
the frontend calls this endpoint to send (or re-send) a 6-digit OTP to the user's email.

**Roles:** Public (unauthenticated).

**Request:**

```http
POST /api/v1/auth/otp/initiate
Content-Type: application/json
```

```json
{ "challengeId": "chal_abc123" }
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "challengeId": "chal_abc123",
    "deliveryMethod": "EMAIL",
    "expiresAt": "2026-05-26T10:10:00.000Z",
    "resendAvailableAt": "2026-05-26T10:01:00.000Z"
  },
  "meta": {}
}
```

**Error Responses:**

| HTTP | `error.code`          | When                                              |
| ---- | --------------------- | ------------------------------------------------- |
| 404  | `CHALLENGE_NOT_FOUND` | `challengeId` doesn't match any active challenge  |
| 429  | `RESEND_TOO_SOON`     | Called again before `resendAvailableAt`           |
| 429  | `MAX_RESENDS`         | More than 3 resend attempts on the same challenge |

**Business rules:**

- OTP is 6 digits, valid for 10 minutes from generation.
- Resend cooldown: 60 seconds between resends.
- Max 3 resend attempts per challenge. After that return `MAX_RESENDS`.
- `POST /auth/verify-otp` (already live) validates the code and issues cookies.

---

## 2. `POST /holidays/import`

**Why needed:** "Import .ics" button on the Holidays screen lets HR upload an iCal file
to bulk-create public holidays.

**Roles:** `HR_ADMIN`, `SUPER_ADMIN`.

**Request:** `multipart/form-data` with a single field `file` containing the `.ics` file.

```http
POST /api/v1/holidays/import
Content-Type: multipart/form-data
```

**Success Response (202):**

```json
{
  "success": true,
  "data": {
    "jobId": "imp_f3a91b",
    "previewUrl": "/api/v1/holidays/import/imp_f3a91b/preview"
  },
  "meta": {}
}
```

**Error Responses:**

| HTTP | `error.code`        | When                                         |
| ---- | ------------------- | -------------------------------------------- |
| 422  | `INVALID_FILE_TYPE` | File is not a valid `.ics` / `text/calendar` |
| 422  | `FILE_TOO_LARGE`    | File exceeds size limit (suggest 1 MB)       |
| 400  | `PARSE_ERROR`       | `.ics` is malformed                          |

**Notes:**

- Import is a two-step flow: upload → preview → commit.
- The job is transient — no entries are written to the DB until `POST .../commit`.
- Store the parsed candidates in a short-lived job store (Redis or in-memory, TTL 15 min).

---

## 3. `GET /holidays/import/:jobId/preview`

**Why needed:** After upload, the frontend shows a preview of what will be imported
before the user confirms.

**Roles:** `HR_ADMIN`, `SUPER_ADMIN`.

**Request:**

```http
GET /api/v1/holidays/import/imp_f3a91b/preview
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "candidates": [
      {
        "name": "Diwali",
        "date": "2026-10-20",
        "isOptional": false,
        "willOverwrite": false
      },
      {
        "name": "Independence Day",
        "date": "2026-08-15",
        "isOptional": false,
        "willOverwrite": true
      }
    ],
    "summary": {
      "new": 8,
      "overwrites": 2,
      "skipped": 0
    }
  },
  "meta": {}
}
```

**Field notes:**

- `willOverwrite: true` means a holiday already exists for that date — user can choose to overwrite or skip via the commit body.
- `isOptional` maps to the `X-WR-CALNAME` or `OPTIONAL` property in the `.ics`.

**Error Responses:**

| HTTP | `error.code`    | When                             |
| ---- | --------------- | -------------------------------- |
| 404  | `JOB_NOT_FOUND` | `jobId` expired or never existed |

---

## 4. `POST /holidays/import/:jobId/commit`

**Why needed:** User reviews the preview and clicks "Import". The frontend sends this to
persist the holidays.

**Roles:** `HR_ADMIN`, `SUPER_ADMIN`.

**Request:**

```http
POST /api/v1/holidays/import/imp_f3a91b/commit
Content-Type: application/json
```

```json
{ "overwriteExisting": true }
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "imported": 8,
    "overwritten": 2,
    "skipped": 0
  },
  "meta": {}
}
```

**Error Responses:**

| HTTP | `error.code`        | When                                     |
| ---- | ------------------- | ---------------------------------------- |
| 404  | `JOB_NOT_FOUND`     | `jobId` expired or was already committed |
| 409  | `ALREADY_COMMITTED` | Commit called twice on same job          |

---

## 5. `GET /employee/documents`

**Why needed:** Employee self-service "My Documents" card on the employee dashboard.
Shows documents uploaded against the logged-in employee's profile.

**Roles:** `EMPLOYEE`, `MANAGER`, `HR_ADMIN`, `SUPER_ADMIN` (own documents only for non-HR roles).

**Request:**

```http
GET /api/v1/employee/documents
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_a1b2c3",
        "filename": "Aadhaar Card.pdf",
        "category": "AADHAAR",
        "sizeBytes": 2415616,
        "status": "VERIFIED",
        "uploadedAt": "2026-01-15T10:00:00.000Z"
      },
      {
        "id": "doc_d4e5f6",
        "filename": "PAN Card.pdf",
        "category": "PAN",
        "sizeBytes": 1048576,
        "status": "PENDING",
        "uploadedAt": "2026-03-20T14:30:00.000Z"
      }
    ]
  },
  "meta": {}
}
```

**`status` enum values:** `VERIFIED` | `PENDING` | `REJECTED`

**`category` enum values (non-exhaustive):**
`AADHAAR` | `PAN` | `OFFER_LETTER` | `EDUCATION` | `EXPERIENCE` | `PASSPORT` | `OTHER`

**Notes:**

- This is the _self-service_ endpoint — it automatically scopes to the authenticated user's `employeeId`.
- It is distinct from `GET /employees/:id/documents` (HR admin endpoint, already live).
- Response wraps documents under `data.documents[]` (not `data[]` directly).

---

## 6. `GET /employee/dashboard` — `leaveBalanceSummary` field

**Why needed:** The employee dashboard "Leave Balance" card shows a quick summary of
the top 3 active leave types and remaining balance.

**Current situation:** The endpoint `GET /employee/dashboard` is live but the
`leaveBalanceSummary` field is missing from the response. Please add it.

**Roles:** `EMPLOYEE`, `MANAGER` (own dashboard).

**Expected full response shape after the fix:**

```json
{
  "success": true,
  "data": {
    "employeeName": "Priya Sharma",
    "designation": "Senior Engineer",
    "department": "Engineering",
    "pendingLeaves": 1,
    "todayAttendance": {
      "checkedInAt": "2026-05-26T09:14:00.000Z",
      "checkedOutAt": null,
      "workMode": "WFH",
      "status": "PRESENT"
    },
    "leaveBalanceSummary": [
      { "code": "CASUAL", "name": "Casual", "available": 6 },
      { "code": "SICK", "name": "Sick", "available": 4 },
      { "code": "ANNUAL", "name": "Earned", "available": 12 }
    ]
  },
  "meta": {}
}
```

**`leaveBalanceSummary` field rules:**

- Return the top 3 active leave types ordered by `available` descending (or by display order if configured).
- Each item: `code` (leave type code), `name` (display name), `available` (remaining days as integer).
- If the employee has no leave balance records, return `"leaveBalanceSummary": []`.

---

## 7. `POST /attendance/regularization/:id/documents`

**Why needed:** When submitting a regularization request, the employee can optionally
attach a supporting document (e.g. doctor's note, WFH approval email screenshot).
The frontend uploads the file after creating the regularization request.

**Roles:** `EMPLOYEE`, `MANAGER` (own regularization requests only).

**Request:** `multipart/form-data` with a single field `document`.

```http
POST /api/v1/attendance/regularization/:id/documents
Content-Type: multipart/form-data
```

| Field      | Type | Required | Notes                               |
| ---------- | ---- | -------- | ----------------------------------- |
| `document` | File | Yes      | PDF, JPG, PNG, DOC, DOCX. Max 5 MB. |

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "documentUrl": "https://res.cloudinary.com/<cloud>/attendance/regularization/<id>/document.pdf"
  },
  "meta": {}
}
```

**Error Responses:**

| HTTP | `error.code`               | When                                                             |
| ---- | -------------------------- | ---------------------------------------------------------------- |
| 404  | `REGULARIZATION_NOT_FOUND` | `:id` doesn't exist or doesn't belong to the requesting employee |
| 409  | `DOCUMENT_ALREADY_EXISTS`  | A document is already attached — only one allowed                |
| 422  | `INVALID_FILE_TYPE`        | File is not PDF/JPG/PNG/DOC/DOCX                                 |
| 422  | `FILE_TOO_LARGE`           | File exceeds 5 MB                                                |

**Notes:**

- Store the file in Cloudinary (same bucket as employee documents).
- Only the employee who created the regularization request can upload a document.
- Only one document per regularization request.
- The upload is non-blocking for the HR/manager approval flow — they see the
  `documentUrl` when reviewing the request.
- Return `409 DOCUMENT_ALREADY_EXISTS` if called twice (don't silently overwrite).

---

## When an endpoint ships

1. Tell the frontend team which endpoint number (from the Status Overview table) is live.
2. Frontend will delete the MSW handler and test against the real backend.
3. The endpoint moves from this file to `docs/API_MAPPING.md`.
