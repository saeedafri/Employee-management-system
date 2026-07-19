# Live UI Role Matrix — Vercel → Hostinger (post `68d32f4`)

> **Date:** 2026-07-19 ~23:35 IST  
> **FE:** `https://ems-frontend-iota-ten.vercel.app`  
> **API (via BFF):** Hostinger `ems-api.saqibsaeed.cloud`  
> **Method:** Playwright `scripts/liveUiRoleMatrix.mjs` + browser BFF API probes  
> **Raw JSON:** `docs/live-ui-e2e/ROLE_MATRIX_LIVE.json`  
> **Screenshots:** `docs/live-ui-e2e/screenshots/`

---

## Honest scope

| Covered | Not covered |
|---------|-------------|
| All 4 seeded roles: SA / HR / Manager / Employee | **AUDITOR** (no seed user) |
| 14 pages × 4 roles (load OK / DENY / FAIL) | Full click-every-button / form submits |
| SA attendance + payout empty-read (UI + API) | Destructive writes (approve leave, delete, payroll run) |
| HR export queue `202` + EMP export `403` | Download file open / PDF visual QA |
| Nav link presence sample | SSE production-ready (EventSource did not stay OPEN) |

---

## Login

| Role | Email | Login | employeeId |
|------|-------|-------|------------|
| SUPER_ADMIN | `superadmin@acme.test` | 200 OK | `null` |
| HR_ADMIN | `hr@acme.test` | 200 OK | set |
| MANAGER | `aman@acme.test` | 200 OK | set |
| EMPLOYEE | `priya@acme.test` | 200 OK | set |

---

## Page matrix (live)

Legend: **OK** = page loads without error banners · **DENY** = Access restricted · **FAIL** = Something went wrong

| Page | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|------|:-----------:|:--------:|:-------:|:--------:|
| /dashboard | OK | OK | OK | OK |
| /employees | OK | OK | OK | OK |
| /departments | OK | OK | OK | OK |
| /attendance | **OK** | OK | OK | OK |
| /timesheets | OK | OK | OK | OK |
| /leave | OK | OK | OK | OK |
| /holidays | OK | OK | OK | OK |
| /payroll | OK | OK | OK | OK |
| /payout-methods | **OK** | OK | OK | OK |
| /reports | OK | OK | DENY | DENY |
| /analytics | OK | OK | DENY | DENY |
| /permissions | OK | DENY | DENY | DENY |
| /settings | OK | OK | OK | OK |
| /announcements | OK | OK | OK | OK |

### Regression check (why this matters)

| Before BE `68d32f4` | After (this run) |
|--------------------|------------------|
| SA `/attendance` **FAIL** (“Failed to load…”) | **OK** |
| SA `/payout-methods` **FAIL** | **OK** (empty “No payout methods”) |

---

## API probes via FE BFF (same session cookies)

| Probe | Result |
|-------|--------|
| SA `GET /api/attendance/summary` | **200** + `noEmployeeRecord: true` |
| SA `GET /api/payroll/me/payout-methods` | **200** + `noEmployeeRecord: true` |
| HR `POST /api/export/employees` `{format:csv}` | **202** `{ job_id, status: QUEUED }` |
| EMP `POST /api/export/employees` | **403 FORBIDDEN** |
| `EventSource('/api/notifications/stream')` | BFF path exists; did **not** confirm stable OPEN (timeout / readyState CLOSED) — treat SSE as **PARTIAL / FE deploy gap** |

---

## FE gaps still visible

1. **Sidebar not role-filtered** — every role’s `navSample` still lists Reports, Analytics, Permissions, etc. Deep-links correctly DENY for lower roles, but nav is noisy.
2. **SA `employeeId: null`** — empty-read works; FE should still prefer team/org scope + empty-state copy (not “Add account” as primary for org admin).
3. **SSE on Vercel** — not proven open in this run; keep poll fallback until BFF stream is confirmed in Network tab.
4. **Client vs server export UI** — API export works for HR; FE must ensure UI uses server export (not Blob) — not visually audited button-by-button here.

---

## Verdict

| Layer | Verdict |
|-------|---------|
| Live UI multi-role page matrix | **PASS** (no FAIL rows) |
| BE SA empty-read fix on live | **PASS** |
| BE export permission gate on live | **PASS** (HR 202 / EMP 403) |
| FE role nav + empty-state polish + SSE | **PARTIAL / OPEN** — UI team |
| AUDITOR | **NOT TESTED** |
| Full “everything click” E2E | **NOT claimed** |

**Overall for handoff:** Backend live behavior for this hardening pass is **verified enough to hand to UI**. UI still owns nav filtering, empty-state copy, server-export UX, and Vercel SSE.
