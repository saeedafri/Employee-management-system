# Backend changelog — Hostinger hardening + Super Admin fix (minute detail)

> **Repo:** EMS backend (`/Users/mohdsaeedafri/All-Code-Base/EMS`)  
> **Status:** **DEPLOYED** to Hostinger — git `68d32f4` (2026-07-19)  
> **Deploy target:** Hostinger Docker (`ems-backend`) only — **not** Render, **not** rentocloud  
> **Date window:** 2026-07-18 → 2026-07-19  
> **UI handoff:** `docs/UI_TEAM_HANDOFF_HOSTINGER_HARDENING_2026-07-19.md`

---

## A. Problem we fixed today (role E2E)

### Symptom (live UI)
- Login `superadmin@acme.test` → `/attendance` → **"Failed to load attendance summary/records"**
- Same user → `/payout-methods` → **"Failed to load payout methods"**
- `hr@acme.test` / `aman@acme.test` / `priya@acme.test` → same pages **OK**

### Root cause (exact)
1. Seed created `SUPER_ADMIN` user **without** linking `User.employeeId` / Employee row (`prisma/seed.js` only linked HR/Manager/Employee).
2. JWT + `/auth/me` exposed `employeeId: null`.
3. Personal read paths threw / returned **400 `NO_EMPLOYEE_RECORD`**:
   - `assertCanViewEmployee` in `src/modules/attendance/attendance.service.js` (summary, records, calendar)
   - `listMine` in `src/modules/payroll/payout/payout.controller.js`
4. FE mapped those 400s to the red **"Something went wrong"** error UI.

### Fix (two layers)

#### A1 — Graceful personal **reads** (always correct in production)
| File | Change |
|------|--------|
| `src/modules/attendance/attendance.service.js` | `assertCanViewEmployee`: no employee + no `employeeId` query → return `null` (no throw). Added `emptyAttendanceSummary()`. `getAttendanceRecords` / `getAttendanceSummary` return empty + `noEmployeeRecord: true`. |
| `src/modules/attendance/attendanceCalendar.service.js` | If resolved employee is `null` → empty calendar (`todayKey: 0000-01-01` so working days stay UPCOMING, no ABSENT/LOP spam) + `noEmployeeRecord: true`. |
| `src/modules/attendance/attendance.controller.js` | `getRegularizationRequests`: if no `employeeId` → 200 empty pagination + flag. |
| `src/modules/payroll/payout/payout.controller.js` | `listMine`: 200 `{ methods: [], instructions: [], noEmployeeRecord: true }` instead of 400. |

**Writes unchanged:** check-in / check-out / leave create still `400 NO_EMPLOYEE_RECORD` when no employee (correct).

#### A2 — Seed + optional Hostinger link script (demo Super Admin can use personal UIs)
| File | Change |
|------|--------|
| `prisma/seed.js` | Upsert Employee `E0000` (Super Admin), link `user.employeeId`. Banner updated. |
| `scripts/linkSuperAdminEmployee.mjs` | **New.** Idempotent one-shot for existing DBs (Acme). **Do not run** until you approve Hostinger DB write. |

#### A3 — Docs / Swagger / tests
| File | Change |
|------|--------|
| `docs/API_MAPPING.md` | Document 200-empty + `noEmployeeRecord` for personal reads; SUPER_ADMIN note updated. |
| `src/plugins/swagger.js` | Description updated for Super Admin + payout me. |
| `tests/unit/noEmployeeRecord.reads.test.js` | **New** offline unit tests (no DB). |
| `docs/UI_CONTRACT_role_nav_no_employee_2026-07-19.md` | **New** FE contract (nav + empty states). |
| `docs/UI_ROLE_MATRIX_E2E_2026-07-19.md` | Role matrix evidence from live UI. |

---

## B. Hardening included in deploy `68d32f4`

These were implemented 2026-07-18 and **are live on Hostinger** as of Set3 deploy 2026-07-19.

### B1 — Server-side exports (PDF + Cloudinary)

| File | What changed (detail) |
|------|------------------------|
| `package.json` / `package-lock.json` | Added dependency **`pdfkit`**. |
| `src/jobs/exportJob.js` | Real PDF generation via PDFKit; upload to Cloudinary (`cloudinary://` prefix stored in `ExportJob.fileUrl`); download prefers signed Cloudinary URL, falls back to disk; fixed broken `/files/:jobId` usage → `/export/:job_id/download`. Formats: `csv \| excel \| json \| pdf`. |
| `src/modules/export/export.validator.js` | Allow `format: 'pdf'`. |
| `src/modules/export/export.controller.js` | Controller wiring for new format / download behaviour. |
| `src/modules/export/export.routes.js` | Routes + **`requirePermission('employees:export')`** (and related) on export endpoints. |
| `src/modules/employees/employees.routes.js` | Employee write/delete/export routes also gated with `requirePermission` where applicable. |

**API contract for FE:** stop client Blob CSV/Excel/PDF; call `POST /export/*` then `GET /export/:job_id/download`.

### B2 — Permissions source of truth (backend)

| File | What changed (detail) |
|------|------------------------|
| `src/modules/auth/auth.policy.js` | Canonical `DEFAULT_PERMISSIONS_BY_ROLE`; `hasPermission` empty-token fallback to day-1 defaults; policy helpers for `requirePermission`. |
| `src/modules/auth/auth.service.js` | Login / refresh JWT minting uses `resolvePermissions`; one-time tenant seed `ensureTenantRolePermissionDefaults` (Setting flag `security/role_permissions_defaults_seeded`). |
| `src/modules/settings/settings.service.js` | `GET` roles-permissions seeds/fills matrix from defaults when incomplete. |

**Day-1 defaults (intent):** SUPER_ADMIN all + `permissions:manage`; HR full HR set; Manager team ops; Employee self; Auditor read + analytics + audit.

### B3 — Ops logs (private, not in FE nav)

| File | What changed (detail) |
|------|------------------------|
| `src/modules/ops/ops.routes.js` | **New module.** `GET /ops/logs` (HTML) + `GET /ops/process` (JSON process/RAM/SSE diagnostics). Auth: SUPER_ADMIN session **or** `OPS_LOGS_TOKEN`. Registered in `app.js` **outside** `/api/v1`. |
| `src/utils/processMonitor.js` | **New.** Process memory / uptime / crash-oriented helpers. |
| `src/server.js` | Hooks process monitor + diagnostics into server lifecycle. |
| `src/utils/sseClients.js` | SSE client diagnostics exposed for ops page. |
| `src/app.js` | Registers ops routes. |

### B4 — Notifications SSE (backend already existed; small hardening)

| File | What changed (detail) |
|------|------------------------|
| `src/modules/notifications/notifications.routes.js` | Stream accepts cookie / `?token=` / `Authorization` Bearer. |

**FE (local, not necessarily on Vercel):** `ems-frontend` has `useNotificationStream.ts` + `/api/notifications/stream` BFF — must be deployed for live realtime.

### B5 — Proof / prior UI docs

| File | Purpose |
|------|---------|
| `docs/PROOF_hostinger_hardening_2026-07-18.md` | Offline proof + partial deploy notes |
| `docs/UI_CONTRACT_server_exports_permissions_realtime_logs.md` | FE contract for exports / permissions / SSE / ops |
| `docs/UI_E2E_TEST_REPORT_2026-07-19.md` | Earlier UI smoke |
| `docs/UI_ROLE_MATRIX_E2E_2026-07-19.md` | Full role matrix E2E |

---

## C. What is **not** done / blocked

| Item | Blocker |
|------|---------|
| Deploy BE to Hostinger | **DONE** — `68d32f4` via Hostinger Terminal Set3 |
| SA empty-read live proof | **DONE** — VPS curl `summary_http=200` + `noEmployeeRecord=true` |
| Run `linkSuperAdminEmployee.mjs` on Hostinger DB | Optional; empty-read already works without link |
| Agent Mac → Hostinger SSH/HTTPS | Still ISP-blocked; use Hostinger Terminal / FE network |
| Full `npm test` against Postgres | Local Docker/`ems_test` not available in agent env |
| Vercel FE: role nav + empty states + SSE | **UI team** — see handoff MD |
| AUDITOR role E2E | No seeded auditor user |

---

## D. Deploy sequence (when you approve)

1. **Commit** (only if you ask) — do not commit `.env` / tokens.  
2. **Build & restart** Hostinger `ems-backend` container with new image/code.  
3. **Optional DB:**  
   `DATABASE_URL=<hostinger> node scripts/linkSuperAdminEmployee.mjs`  
   (or re-run seed only if you explicitly want full seed — prefer the link script).  
4. **Smoke:** login Super Admin → Attendance + Payout must **not** show red errors.  
5. Hand UI team:  
   - `docs/UI_CONTRACT_role_nav_no_employee_2026-07-19.md`  
   - `docs/UI_CONTRACT_server_exports_permissions_realtime_logs.md`  
6. Deploy FE (nav filter + SSE stream BFF).  
7. Re-run role matrix E2E; update report to PASS only if all checklist items green.

---

## E. File list — this session’s Super Admin fix (paths)

```
src/modules/attendance/attendance.service.js          (modified)
src/modules/attendance/attendanceCalendar.service.js  (modified)
src/modules/attendance/attendance.controller.js       (modified)
src/modules/payroll/payout/payout.controller.js       (modified)
prisma/seed.js                                        (modified)
scripts/linkSuperAdminEmployee.mjs                    (new)
tests/unit/noEmployeeRecord.reads.test.js             (new)
docs/API_MAPPING.md                                   (modified)
src/plugins/swagger.js                                (modified)
docs/UI_CONTRACT_role_nav_no_employee_2026-07-19.md   (new)
docs/BACKEND_CHANGELOG_hostinger_hardening_2026-07-19.md (this file)
```

---

## F. Behaviour matrix after BE deploy (no FE yet)

| Caller | `GET /attendance/summary` | `GET /payroll/me/payout-methods` | `POST /attendance/check-in` |
|--------|---------------------------|----------------------------------|-----------------------------|
| SUPER_ADMIN, `employeeId: null` | 200 empty + flag | 200 empty + flag | 400 NO_EMPLOYEE_RECORD |
| SUPER_ADMIN, linked E0000 | 200 real/empty month | 200 methods | 200/409 normal |
| HR / Manager / Employee | 200 as today | 200 as today | normal |

FE still needs section §2–§3 of the UI contract to stop showing admin nav to employees and to prefer team scope for org-admins.
