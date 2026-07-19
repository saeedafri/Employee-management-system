# UI Contract — Server exports, permissions, realtime notifications, ops logs

> For the frontend team. Backend changes for server-side file generation, DB-backed
> permissions, SSE realtime notifications, and a private ops logs page.
> Live API (Hostinger): `https://ems-api.saqibsaeed.cloud/api/v1`
> **MSW must stay OFF** (`NEXT_PUBLIC_USE_MOCKS=false`) for all verification.

---

## 1. Exports — stop client-side CSV/Excel/PDF generation

### Required FE changes
1. **Remove** in-browser `Blob` / string-built CSV / client Excel / client PDF for:
   - Employees, attendance, leave exports
   - Any screen still doing `new Blob([csv]...)` for operational data (assets / performance / billing invoices should call a backend export when available)
2. **Use** existing async export API:
   - `POST /export/employees` | `/export/attendance` | `/export/leave`
   - Body `format`: `"csv" | "excel" | "json" | "pdf"` ← **`pdf` is new**
   - Poll / open `GET /export/:job_id/download` (may **302** to Cloudinary signed URL)
3. **Never** use legacy `/files/:jobId` URLs.
4. Download UX: trigger from `job_id` returned in `202` response; show status from list/download until `SUCCESS`.

### Auth
- Role: `HR_ADMIN` (and SUPER_ADMIN bypass)
- Permission key also required: `employees:export`

---

## 2. Permissions — backend is source of truth

### Already correct (keep)
- `GET /settings/roles-permissions` → render matrix
- `PATCH /settings/roles-permissions` → `{ role, permissions }`

### Required FE changes
1. **Do not** hardcode default permission matrices in the client as authority.
2. After PATCH success: **force token refresh or re-login** so JWT `permissions` updates. Until then, UI gates may be stale; backend `requirePermission` enforces the new grants on next authenticated request with a fresh token.
3. Day-1 defaults (unchanged intent):

| Role | Default permission keys |
|------|-------------------------|
| SUPER_ADMIN | all + `permissions:manage` |
| HR_ADMIN | employees CRUD+export, departments r/w, attendance r/w, leave r/request/approve, analytics, audit |
| MANAGER | employees:read, departments:read, attendance r/w, leave r/request/approve, analytics:read |
| EMPLOYEE | employees:read, departments:read, attendance r/w, leave read/request |
| AUDITOR | read-only employees/departments/attendance/leave + analytics + audit |

4. Gate UI from `/auth/me` → `permissions[]` (and role), not from a local constant matrix.

---

## 3. Notifications — realtime via SSE (not WebSockets)

### Backend truth
- Transport: **Server-Sent Events**
- Endpoint: `GET /api/v1/notifications/stream`
- Auth: `?token=<accessToken>` **or** `Authorization: Bearer` **or** `accessToken` cookie
- Events: `notification`, `analytics_update`; heartbeat comments every ~25s

### Required FE changes
1. Open `EventSource` against the **streaming BFF** route: `/api/notifications/stream` (same-origin; cookies sent). Do **not** use the catch-all BFF for SSE — it buffers and breaks streaming.
2. On `notification` / `analytics_update`: invalidate React Query `['notifications']` (and analytics queries if needed).
3. Keep a slow poll (e.g. 60s) only as fallback if EventSource disconnects.
4. **Do not** require full page refresh for new notifications.

Reference implementation shipped in FE:
- `src/modules/notifications/hooks/useNotificationStream.ts`
- `src/app/api/notifications/stream/route.ts`

---

## 4. Ops logs page (backend-only — no nav item)

- URL: `https://ems-api.saqibsaeed.cloud/ops/logs` (or local `http://localhost:<port>/ops/logs`)
- **Not** listed in product navigation
- Auth: SUPER_ADMIN session **or** `OPS_LOGS_TOKEN`
- UI team: **no work required** unless you want a deep-link bookmark in an internal admin doc

---

## 5. Verification checklist (UI + BE)

- [ ] MSW off
- [ ] Export employees as csv / excel / pdf → download opens file
- [ ] Change HR_ADMIN permission (remove `employees:export`) → refresh token → export returns 403
- [ ] Restore permission → export works again
- [ ] User A submits leave → User B (manager) bell updates without manual refresh (SSE)
- [ ] SUPER_ADMIN opens `/ops/logs` and sees levels + RAM

---

## 6. Out of scope for UI this pass
- WebSocket migration
- Client-side PDF libraries
- Linking `/ops/logs` in the product sidebar
