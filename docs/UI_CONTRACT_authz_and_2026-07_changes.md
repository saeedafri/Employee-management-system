# UI Contract — Authorization model + API changes (2026-07 security/payroll pass)

> For the frontend team. Covers (A) how authorization actually works in the backend
> (answer to "Authorization middleware banaya h?") and (B) the concrete request/response
> changes shipped this pass that the UI **must** handle. All items are **live** on
> `https://ems-api.saqibsaeed.cloud/api/v1`.

## A. Authorization architecture (there is no single global authz middleware)

Pipeline (Fastify), in order:
`requestId → CORS → helmet → rate-limit → logging → [error handler] → resolveTenant → (per route) authenticate → authorize → handler`

- **Authentication** = `authenticate` (`onRequest`): validates JWT **and** checks the
  `Session` row isn't revoked. Missing token → `401 UNAUTHORIZED`; bad/revoked →
  `401 INVALID_TOKEN`. Token via `Authorization: Bearer` **or** `accessToken` cookie.
- **Authorization = two layers:**
  1. **Role (RBAC)** — `authorize([roles])` per route. `SUPER_ADMIN` bypasses all role
     checks. Failure → `403 FORBIDDEN`, body `error.details = { requiredRoles, userRole }`.
  2. **Relationship (new)** — enforced in services for approvals & PII. Manager may act
     only on **direct reports**; nobody self-approves; documents are self-or-HR/SA.

**UI takeaway:** keep gating buttons by role as today; additionally treat the new 403
codes below as "not allowed" (show a toast, don't retry). There is nothing new to build
for authz itself — it's server-enforced.

---

## B. Breaking / new API behaviors to handle

### B1. 🔴 Employee documents — no more public `fileUrl` (ACTION REQUIRED)
Documents are now private (Cloudinary `authenticated`). **`fileUrl` is no longer a usable
link** — it is an empty string for newly-uploaded docs and a dead `404` URL for
pre-migration ones. Either way, **never render `fileUrl`**; always use `downloadUrl`.

- `GET /employees/:id/documents` → each item now includes **`downloadUrl`**:
  ```json
  { "id": "...", "fileName": "...", "documentType": "PASSPORT",
    "fileUrl": "", "downloadUrl": "/api/v1/employees/:id/documents/:docId/download" }
  ```
- To download/preview: call **`GET /employees/:id/documents/:docId/download`** (send the
  Bearer token) → responds `302` to a **short-lived signed URL** (5 min). Let the browser
  follow the redirect, or `window.open(downloadUrl)` with auth.
- **Access rule:** `download` / `presign` / `confirm` are now **self or HR/SA only**.
  A **manager requesting a team member's document → `403 FORBIDDEN`** (was allowed).
  If your UI showed "view document" to managers for their team, hide it for non-HR.
- Old direct `res.cloudinary.com/...` links are now **404/401** — remove any cached ones.

### B2. 🟠 Approvals — new relationship 403s (leave + timesheets)
`PATCH /leave/requests/:id/approve|reject`, bulk approve/deny, and
`POST /timesheets/:id/approve|reject` can now return `403` with:
| `error.code` | Meaning |
|---|---|
| `SELF_APPROVAL_FORBIDDEN` | actor is the request's owner |
| `NOT_TEAM_APPROVER` | actor is a manager but not this employee's manager |
| `NO_EMPLOYEE_RECORD` | actor (manager) has no linked employee record |

HR_ADMIN/SUPER_ADMIN are unaffected (can approve anyone). The UI already hides cross-team
approve buttons — just surface these 403s gracefully if they occur.

### B3. 🟠 Employee activity — manager scope tightened
`GET /employees/:id/activity` now returns `403 FORBIDDEN` for a manager viewing a
**non-direct-report** (previously any manager could view anyone). Self / HR / SA / direct
manager → `200`.

### B4. 🟡 Leave day counts exclude weekends + holidays (display parity)
`POST /leave/requests` now stores `totalDays` = **chargeable working days** (excludes
weekly-offs and public holidays), matching `POST /leave/requests/preview` →
`{ calendarDays, weekendDays, holidayDays, chargeableDays }`.
- **UI must display the server's `totalDays` / `chargeableDays`**, not a locally computed
  end-minus-start day count (those will now differ, e.g. Fri→Mon = **2**, not 4).
- New guard: a range that is entirely weekend/holiday → `400 NO_CHARGEABLE_DAYS`.

### B5. 🟡 Webhook settings — URL validation
`POST/PATCH /settings/webhooks` now rejects non-https and private/loopback/metadata hosts
with **`422 INVALID_WEBHOOK_URL`**. Surface it on the settings form.

### B6. 🟢 Announcements — edit + delete now available (NEW, optional to adopt)
- `PATCH /announcements/:id` — body: `{ title?, body?, category?, channelId?, audience? }`
  (roles: HR_ADMIN/SUPER_ADMIN/MANAGER) → `200` updated announcement.
- `DELETE /announcements/:id` — (roles: HR_ADMIN/SUPER_ADMIN) → `200 { deleted: true }`.
- Both `404 NOT_FOUND` for a missing id. You can now wire edit/delete buttons.

### B7. 🟢 Audit-logs export fixed
`GET /audit-logs/export?format=csv|json` (SUPER_ADMIN/AUDITOR) now returns `200` (was 500).

---

## Not changed (still true)
- `GET /audit-logs/:id`, `/employees/:id` (profile), attendance regularization approval,
  and the manager-dashboard approval path already enforced the correct rules — no change.
- Auth flow, tenant resolution, and all list/read contracts are unchanged.

_Questions → backend team. Every item above is deployed and was live-verified._
