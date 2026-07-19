# UI Team Handoff — Hostinger Hardening + Super Admin Fix

> **Send this file to the frontend team first.**  
> **Date:** 2026-07-19  
> **Backend commit (LIVE on Hostinger):** `68d32f4`  
> **API base:** `https://ems-api.saqibsaeed.cloud/api/v1`  
> **Ops (private):** `https://ems-api.saqibsaeed.cloud/ops/logs`  
> **Frontend (Vercel):** `https://ems-frontend-iota-ten.vercel.app`  
> **MSW:** must stay `NEXT_PUBLIC_USE_MOCKS=false`

---

## 0. Document pack (read in this order)

| # | File | Purpose |
|---|------|---------|
| 1 | **This file** | Single handoff: what BE shipped, what FE must change, acceptance |
| 2 | [`UI_CONTRACT_role_nav_no_employee_2026-07-19.md`](./UI_CONTRACT_role_nav_no_employee_2026-07-19.md) | Role-filtered nav + `noEmployeeRecord` empty states |
| 3 | [`UI_CONTRACT_server_exports_permissions_realtime_logs.md`](./UI_CONTRACT_server_exports_permissions_realtime_logs.md) | Server exports, permissions SoT, SSE, ops |
| 4 | [`BACKEND_CHANGELOG_hostinger_hardening_2026-07-19.md`](./BACKEND_CHANGELOG_hostinger_hardening_2026-07-19.md) | Minute-detail backend file changelog |
| 5 | [`API_MAPPING.md`](./API_MAPPING.md) | Field-level API shapes (source of truth with route code) |
| 6 | [`UI_ROLE_MATRIX_E2E_2026-07-19.md`](./UI_ROLE_MATRIX_E2E_2026-07-19.md) | Pre-fix live UI crawl (PARTIAL — SA was failing) |
| 7 | [`UI_E2E_TEST_REPORT_2026-07-19.md`](./UI_E2E_TEST_REPORT_2026-07-19.md) | Broader UI smoke notes |
| 8 | [`PROOF_hostinger_hardening_2026-07-18.md`](./PROOF_hostinger_hardening_2026-07-18.md) | Offline proof + network blockers log |
| 9 | [`LIVE_E2E_HOSTINGER_68d32f4_2026-07-19.md`](./LIVE_E2E_HOSTINGER_68d32f4_2026-07-19.md) | Post-deploy Hostinger Terminal proof |
| 10 | [`LIVE_UI_ROLE_MATRIX_VERCEL_2026-07-19.md`](./LIVE_UI_ROLE_MATRIX_VERCEL_2026-07-19.md) | **Live Vercel UI** 4-role page matrix + BFF API probes (post-deploy) |

Swagger UI on Hostinger: `https://ems-api.saqibsaeed.cloud/docs` (ops routes intentionally hidden).

---

## 1. What backend shipped (summary)

### Live now on Hostinger (`68d32f4`)

1. **Server-side exports** — CSV / Excel / JSON / **PDF** via PDFKit; Cloudinary when configured; download via `GET /export/:job_id/download` (may **302**); never `/files/:jobId`.
2. **Permissions SoT** — `DEFAULT_PERMISSIONS_BY_ROLE` in `auth.policy.js`; JWT `permissions[]` from `resolvePermissions`; `requirePermission('employees:export')` on export (+ employee mutate gates).
3. **SSE notifications** — `GET /notifications/stream` accepts `?token=` **or** Bearer **or** `accessToken` cookie; heartbeats ~25s.
4. **Ops page** — `GET /ops/logs` (HTML) + `GET /ops/process` (JSON); SUPER_ADMIN or `OPS_LOGS_TOKEN`; **not** product nav.
5. **Super Admin / no-employee personal reads** — return **200 empty** + `noEmployeeRecord: true` instead of **400** (fixes FE “Something went wrong”).

### Still FE / product work (not done by BE alone)

| Item | Owner |
|------|--------|
| Role-filtered sidebar (hide Analytics/Reports/Permissions for lower roles) | **UI** |
| Empty-state UX when `noEmployeeRecord: true` / `employeeId === null` | **UI** |
| Remove client Blob CSV/Excel/PDF; call server export API | **UI** |
| Ship EventSource + streaming BFF to **Vercel** | **UI / FE deploy** |
| Gate Export button on `employees:export` from `/auth/me` | **UI** |
| Link Super Admin → Employee `E0000` on Hostinger DB (optional; empty-read already works) | Ops / BE script (needs DB write approval) |

---

## 2. Test accounts (Acme tenant)

| Role | Email | Password |
|------|-------|----------|
| SUPER_ADMIN | `superadmin@acme.test` | `Password123!` |
| HR_ADMIN | `hr@acme.test` | `Password123!` |
| MANAGER | `aman@acme.test` | `Password123!` |
| EMPLOYEE | `priya@acme.test` | `Password123!` |

Header when needed: `x-tenant-key: acme-corp-001` (JWT usually enough after login).

**Note:** No seeded `AUDITOR` user. AUDITOR defaults exist in BE policy only.

---

## 3. Post-deploy proof (Hostinger Terminal — 2026-07-19)

| Check | Result |
|-------|--------|
| Git on VPS | `68d32f4 feat(hostinger): server exports, permissions, ops logs, SA empty reads` |
| DB backup | `ems_predeploy_20260719_164035.sql.gz` |
| Migrate | No pending migrations |
| Local `/health` | `200` `{"status":"ok"}` |
| Public `/health` | `200` |
| SA login | `token_len=645` |
| `GET /attendance/summary` as SA | **`200`** + `noEmployeeRecord: true` + zeroed counters |

Exact summary body observed:

```json
{
  "success": true,
  "data": {
    "totalDays": 0,
    "present": 0,
    "absent": 0,
    "leave": 0,
    "wfh": 0,
    "halfDay": 0,
    "holiday": 0,
    "late": 0,
    "noEmployeeRecord": true
  },
  "meta": {}
}
```

**Live UI retest (same day, later):** Playwright against Vercel FE confirmed **no FAIL pages** for SA/HR/Manager/Employee; SA attendance/payout **OK**; HR export **202** / EMP export **403**. See `LIVE_UI_ROLE_MATRIX_VERCEL_2026-07-19.md`. Sidebar still not role-filtered; SSE not confirmed OPEN on Vercel.

---

## 4. Canonical permission defaults (FE must match `/auth/me`)

Source: `src/modules/auth/auth.policy.js` → `DEFAULT_PERMISSIONS_BY_ROLE`

| Role | Keys |
|------|------|
| SUPER_ADMIN | all 14 including `permissions:manage` |
| HR_ADMIN | 13 — all except `permissions:manage` (includes `leave:request` + `employees:export`) |
| MANAGER | 8 — `employees:read`, `departments:read`, `attendance:read/write`, `leave:read/request/approve`, `analytics:read` |
| EMPLOYEE | 6 — `employees:read`, `departments:read`, `attendance:read/write`, `leave:read/request` |
| AUDITOR | 6 — `employees:read`, `departments:read`, `attendance:read`, `leave:read`, `analytics:read`, `audit:read` (**no** `attendance:write`, **no** `leave:request`) |

**Rules for UI**
1. Gate chrome from `GET /auth/me` → `memberType` + `permissions[]` (never empty).
2. After `PATCH /settings/roles-permissions`, **refresh token or re-login**.
3. Do **not** treat EMPLOYEE and AUDITOR as the same matrix.
4. Export UI requires `employees:export` (HR/SA usually have it).

---

## 5. API contracts UI must implement

### 5.1 No-employee personal reads

| Method | Path | When `employeeId` null |
|--------|------|-------------------------|
| GET | `/attendance/summary` | **200** zeros + `noEmployeeRecord: true` |
| GET | `/attendance/records` | **200** `{ records: [], total: 0, noEmployeeRecord: true }` |
| GET | `/attendance/calendar` | **200** empty calendar + `noEmployeeRecord: true` |
| GET | `/attendance/regularization` | **200** empty list + flag |
| GET | `/payroll/me/payout-methods` | **200** `{ methods: [], instructions: [], noEmployeeRecord: true }` |
| POST | `/attendance/check-in` (and other personal writes) | still **400 `NO_EMPLOYEE_RECORD`** |

**FE:** never map `noEmployeeRecord` / these 200-empties to red “Something went wrong”. Prefer team/org scope for SA/HR attendance.

### 5.2 Exports

| Method | Path | Notes |
|--------|------|-------|
| POST | `/export/employees` | Body `{ format? }` → **202** `{ job_id, status: QUEUED, … }` |
| POST | `/export/attendance` | requires `from_date`, `to_date` |
| POST | `/export/leave` | requires `from_date`, `to_date` |
| GET | `/export/:job_id/download` | file / **302** Cloudinary / JSON status; **404** if missing |
| GET | `/export/list` | tenant-wide job list today (snake_case fields) |

`format`: `csv` \| `excel` \| `json` \| **`pdf`**  
Auth: `HR_ADMIN` (+ SA bypass) **and** `employees:export`.

### 5.3 Notifications SSE

- `GET /api/v1/notifications/stream`
- Auth: `?token=` **or** Bearer **or** cookie `accessToken`
- Prefer same-origin FE BFF `EventSource` → `/api/notifications/stream` (do not use catch-all BFF; it buffers)
- Events: `notification`, `analytics_update`; `: heartbeat` ~25s
- Poll ≤60s only as fallback

### 5.4 Ops (no product nav)

- `GET /ops/logs` HTML — SUPER_ADMIN or `OPS_LOGS_TOKEN`
- `GET /ops/process` JSON twin

---

## 6. Mandatory FE acceptance checklist

Copy into the FE PR:

- [ ] MSW off against Hostinger API
- [ ] SUPER_ADMIN → Attendance: **no** red error; empty or team picker when `noEmployeeRecord`
- [ ] SUPER_ADMIN → Payout methods: **no** red error; empty state
- [ ] HR_ADMIN → Permissions nav **hidden**
- [ ] MANAGER → Analytics + Reports nav **hidden**
- [ ] EMPLOYEE → Analytics + Reports + Permissions nav **hidden**
- [ ] Export uses `POST /export/*` + download URL (no client Blob PDF/CSV for HR ops data)
- [ ] Export button hidden without `employees:export`
- [ ] Network tab shows `EventSource` to notifications stream (not poll-only)
- [ ] After permission PATCH → re-login/refresh before trusting UI gates

---

## 7. What FE does **not** need

- Building `/ops/logs` into the product sidebar
- Re-implementing default permission matrices as authority
- Client-side PDF libraries for HR employee/attendance/leave exports
- Calling Render (`onrender.com`) — production API for this product is **Hostinger**

---

## 8. Backend files touched in `68d32f4` (quick index)

| Area | Paths |
|------|--------|
| Exports | `src/jobs/exportJob.js`, `src/modules/export/*`, `package.json` (`pdfkit`) |
| Permissions | `src/modules/auth/auth.policy.js`, `auth.service.js`, `settings.service.js` |
| Ops | `src/modules/ops/ops.routes.js`, `src/utils/processMonitor.js`, `src/app.js`, `src/server.js` |
| SSE | `src/modules/notifications/notifications.routes.js`, `src/utils/sseClients.js` |
| No-employee reads | `attendance.service.js`, `attendanceCalendar.service.js`, `attendance.controller.js`, `payout.controller.js` |
| Seed / link | `prisma/seed.js`, `scripts/linkSuperAdminEmployee.mjs` |
| Docs / swagger | `docs/*`, `src/plugins/swagger.js`, `docs/API_MAPPING.md` |

Full narrative: `BACKEND_CHANGELOG_hostinger_hardening_2026-07-19.md`.

---

## 9. Verdict for UI kickoff

| Layer | Verdict |
|-------|---------|
| BE deploy Hostinger | **PASS** (`68d32f4`, SA empty-read proven on VPS) |
| BE contracts for UI | **READY** (this pack) |
| FE role nav + empty states + server exports + Vercel SSE | **NOT DONE** — UI team ownership |
| Full agent-driven browser E2E from author Mac | **BLOCKED** (ISP cannot reach Hostinger); use Hostinger proof + FE QA |

**Handoff status:** UI team can start immediately using this pack + the two `UI_CONTRACT_*.md` files.
