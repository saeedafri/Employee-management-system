# UI Contract — Role-filtered nav + Super Admin / no-employee handling

> **Audience:** Frontend team only  
> **Date:** 2026-07-19  
> **API:** Hostinger `https://ems-api.saqibsaeed.cloud/api/v1` (after BE deploy)  
> **MSW:** must stay `NEXT_PUBLIC_USE_MOCKS=false`  
> **Related:** `UI_CONTRACT_server_exports_permissions_realtime_logs.md`, `UI_ROLE_MATRIX_E2E_2026-07-19.md`

---

## Why this contract exists

Live E2E (2026-07-19) proved:

| Finding | Impact |
|---------|--------|
| SUPER_ADMIN attendance + payout showed **"Something went wrong"** | Personal APIs returned `400 NO_EMPLOYEE_RECORD` because JWT `employeeId` was `null` |
| Every role sees the **full sidebar** (Permissions, Analytics, Reports, …) | Lower roles hit "Access restricted" pages — noisy UX, looks broken |
| Notifications panel works but **polls**; SSE not live on Vercel | Bell does not update in realtime until FE ships EventSource BFF |

Backend now fixes the 400→empty for personal **reads**. FE still must implement nav + empty-state UX below.

---

## 1. Source of truth for the signed-in user

After login / refresh, always use:

```http
GET /auth/me
```

Required fields:

| Field | Type | Use |
|-------|------|-----|
| `memberType` | `SUPER_ADMIN \| HR_ADMIN \| MANAGER \| EMPLOYEE \| AUDITOR` | Role gates + nav |
| `employeeId` | `string \| null` | Personal vs org-scoped screens |
| `permissions` | `string[]` | Fine-grained UI gates (export, etc.) |
| `user.email` | string | Display |

**Rules**
1. Never hardcode role→permission matrices as authority (backend JWT + `requirePermission` win).
2. If `employeeId === null`, treat the user as **org-admin only** for personal widgets (check-in, my payslips create, my payout create).
3. After any `PATCH /settings/roles-permissions`, force **token refresh or re-login** before trusting `permissions[]`.

---

## 2. Role-filtered sidebar (MANDATORY)

Today every role sees the same nav. Change to **hide** items the role cannot use (do not leave "Access restricted" dead-ends for primary nav).

### Recommended visibility matrix

| Nav item | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | AUDITOR |
|----------|:-----------:|:--------:|:-------:|:--------:|:-------:|
| Dashboard | ✅ | ✅ | ✅ (My Team) | ✅ (personal) | ✅ |
| Employees | ✅ | ✅ | ✅ (read; no Add) | ✅ (read; no Add/Export) | ✅ read |
| Departments | ✅ | ✅ | ✅ read | ✅ read | ✅ read |
| Attendance | ✅ | ✅ | ✅ | ✅ | ✅ read |
| Timesheets | ✅ | ✅ | ✅ | ✅ | ✅ read |
| Leave | ✅ | ✅ | ✅ | ✅ | ✅ read |
| Holidays | ✅ | ✅ | ✅ | ✅ | ✅ read |
| Payroll | ✅ | ✅ | ✅ my-pay only* | ✅ my-pay | ❌ / read-only if product says |
| Payout methods | ✅ | ✅ | ✅ self | ✅ self | ❌ |
| Reports | ✅ | ✅ | ❌ hide | ❌ hide | ❌ |
| Analytics | ✅ | ✅ | ❌ hide | ❌ hide | ✅ if `analytics:read` |
| Permissions | ✅ only | ❌ hide | ❌ hide | ❌ hide | ❌ |
| Settings | ✅ full | ✅ tenant | ✅ sessions/profile only | ✅ sessions/profile | ✅ sessions |
| Recruitment | ✅ | ✅ | product decision | ❌ | ❌ |
| Performance | ✅ | ✅ | ✅ team | ✅ self | ❌ |
| Assets | ✅ | ✅ | product decision | ✅ self | ❌ |
| Announcements | ✅ | ✅ | ✅ | ✅ | ✅ |

\*Manager payroll: redirect to `/payroll/my-payslips` (already happens for Employee). Do **not** show admin payroll runs.

### Implementation notes
1. Build nav from `memberType` + `permissions[]` (e.g. show Export only if `employees:export`).
2. Deep-links to denied routes may still show Access restricted — keep that page for bookmarks.
3. Prefer hiding over showing + denying for items in the matrix marked ❌.

---

## 3. `employeeId === null` — personal screens (MANDATORY)

Backend change (after deploy):

| Endpoint | Old | New |
|----------|-----|-----|
| `GET /attendance/summary` | 400 | **200** zeros + `noEmployeeRecord: true` |
| `GET /attendance/records` | 400 | **200** `{ records: [], total: 0, noEmployeeRecord: true }` |
| `GET /attendance/calendar` | 400 | **200** empty calendar + `noEmployeeRecord: true` |
| `GET /attendance/regularization` | risk of bad query | **200** empty list + flag |
| `GET /payroll/me/payout-methods` | 400 | **200** `{ methods: [], instructions: [], noEmployeeRecord: true }` |
| `POST /attendance/check-in` etc. | 400 | **still 400** (correct) |

### FE must do
1. On Attendance when `employeeId == null` **and** role is HR/SA:
   - Default scope to **team / all employees** (use team endpoints + employee picker), **not** "my" empty calendar as the only view.
   - Hide or disable **Check In** / **Request Regularization** for self.
   - If API returns `noEmployeeRecord: true`, show empty state copy:  
     *"This account is not linked to an employee profile. Select an employee to view attendance."*  
     Never show the red **"Something went wrong"** for this case.
2. On Payout methods when `noEmployeeRecord`:
   - Empty state + CTA for admins: "Open an employee’s payout methods from Payroll → Employees".
   - Hide **+ Add account** for self when `employeeId` is null.
3. Never map `400 NO_EMPLOYEE_RECORD` on **reads** to a global error page after BE deploy (reads are 200). Writes may still 400 — show a toast, not a page crash.

---

## 4. Action buttons by role (strict)

| Action | Who can see |
|--------|-------------|
| + Add employee | HR_ADMIN, SUPER_ADMIN |
| Employees Export | HR_ADMIN / SUPER_ADMIN **and** `employees:export` |
| Approve / Deny leave & regularization | MANAGER (team), HR_ADMIN, SUPER_ADMIN |
| Permissions matrix edit | SUPER_ADMIN only |
| Reports export | HR_ADMIN, SUPER_ADMIN |
| Analytics | HR_ADMIN, SUPER_ADMIN (+ AUDITOR if permitted) |

Evidence from live E2E: Manager already has no Add; Employee has no Add/Export — keep that; extend same pattern to Export / Permissions / Analytics visibility in the **nav and page chrome**.

---

## 5. Notifications (realtime) — still required

Already in prior contract; restate for deploy:

1. Use same-origin BFF `GET /api/notifications/stream` with `EventSource` (cookies).
2. On `notification` / `analytics_update` → invalidate React Query `['notifications']`.
3. Keep ≤60s poll only as fallback.
4. Clean up stale "Bulk N" seed noise in demo DB when possible (ops task, not FE).

Local FE already has `useNotificationStream.ts` + stream BFF — **ship to Vercel**.

---

## 6. Exports (server-side) — still required

1. Remove client Blob CSV/Excel/PDF for employees / attendance / leave.
2. Use `POST /export/*` with `format: csv|excel|json|pdf` → `GET /export/:job_id/download`.
3. Never use `/files/:jobId`.

---

## 7. Acceptance checklist (UI team)

- [ ] SUPER_ADMIN → Attendance: **no** red "Something went wrong"; empty or team picker
- [ ] SUPER_ADMIN → Payout methods: **no** red error; empty state
- [ ] HR_ADMIN → Permissions nav **hidden** (or deep-link Access restricted only)
- [ ] MANAGER → Analytics + Reports nav **hidden**
- [ ] EMPLOYEE → Analytics + Reports + Permissions nav **hidden**
- [ ] EMPLOYEE → Payroll lands on My Pay; Check In works
- [ ] MANAGER → My Team dashboard + team approvals still work
- [ ] Notifications: EventSource connected in Network tab (not only `/api/notifications` poll)
- [ ] MSW off; all calls hit real Hostinger API via BFF

---

## 8. What FE does **not** need to build

- `/ops/logs` product nav (private backend HTML page for SUPER_ADMIN / token)
- Re-implementing permission defaults locally
- Client-side PDF generation for HR exports
