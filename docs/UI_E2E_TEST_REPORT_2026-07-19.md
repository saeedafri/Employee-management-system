# UI + Backend E2E Test Report — 2026-07-19

## Direct answer

**No — I had NOT previously tested UI end-to-end with clicks + screenshots.**  
**This session I did run real browser UI tests** against the **deployed** stack.  
**I still cannot claim full PASS for the new hardening work**, because those changes are **not deployed** yet.

| Question | Answer |
|----------|--------|
| Did I run frontend + backend together in the browser? | **YES** — Vercel FE + Hostinger API via BFF |
| Did I click through screens and take screenshots? | **YES** — see evidence below |
| Did I test the **new** local code (PDF export, `/ops/logs`, SSE FE wiring, permission seed)? | **NO** — not on Hostinger / Vercel yet |
| Can this Mac SSH / hit Hostinger directly? | **NO** — still unreachable (timeout) |
| Local Docker FE+BE? | **NO** — Docker Desktop not installed |

---

## Test environment used

| Layer | URL | MSW |
|-------|-----|-----|
| Frontend (deployed) | `https://ems-frontend-iota-ten.vercel.app` | Off on server (live BFF) |
| Backend (Hostinger, via Vercel BFF) | `https://ems-api.saqibsaeed.cloud/api/v1` | n/a |
| Local agent network → Hostinger | **Blocked** (SSH/HTTPS 000) | — |
| Local new code | Uncommitted in `EMS/` + `ems-frontend/` | Not deployed |

**Why Vercel works but local Hostinger curl fails:** the browser talks to Vercel; Vercel’s cloud BFF can reach Hostinger. This Mac cannot reach `31.97.186.223` directly.

---

## Click-test results (deployed stack)

### Auth
| Step | Result | Evidence |
|------|--------|----------|
| Open login | PASS | Login page screenshot |
| Login `hr@acme.test` / `Password123!` | PASS | Dashboard “Welcome back, HR”, 76 employees |
| Login `superadmin@acme.test` | PASS | Dashboard “Welcome back, superadmin” |

### Dashboard (HR)
| Step | Result |
|------|--------|
| KPI cards (76 employees, 7 open requests) | PASS |
| Attendance 30d chart | PASS |
| Headcount doughnut | PASS |
| Pending approvals list + Approve/Deny buttons visible | PASS (not clicked write actions this pass) |

### Notifications bell (HR)
| Step | Result | Notes |
|------|--------|-------|
| Open bell | PASS | Popover opened |
| Content | WARN | Shows stale “Bulk 1…Bulk N / Message body / 30 days ago” |
| Transport | **POLL only** | Network shows `/api/notifications` XHR — **no** `/notifications/stream` EventSource on deployed FE |

### Permissions
| Step | Result |
|------|--------|
| HR → `/permissions` | PASS (correct deny) — “Access restricted… Super Admins” |
| Super Admin → permissions matrix | PASS — roles + cells (`employees:read/write/delete/export`, etc.), Save/Reset/Add Role visible |

### Employees
| Step | Result |
|------|--------|
| List loads (Aman, Priya, HR Admin, …) | PASS |
| Click **Export** | PASS — button “Exporting…” then toast Success |

### Reports
| Step | Result |
|------|--------|
| Headcount report (76, +3, charts, dept table) | PASS |
| Click **Export CSV** | PASS — `/api/reports/export` then `/download` in network |

### Leave (Super Admin)
| Step | Result |
|------|--------|
| Leave page + balances + request table | PASS |

### Ops logs (`/ops/logs`)
| Step | Result |
|------|--------|
| Browser → `https://ems-api.saqibsaeed.cloud/ops/logs` | **FAIL** — `chrome-error` (Hostinger not reachable from this network). Also: **new `/ops/logs` route is local-only, not deployed**. |

---

## Screenshots captured (this session)

1. Login page  
2. HR Dashboard (live data)  
3. Notifications bell (`ui-notifications-bell.png`)  
4. Permissions denied for HR (`ui-permissions-hr-denied.png`)  
5. Employees list + Export (`ui-employees-export.png`)  
6. Reports Headcount (`ui-reports.png`)  
7. Permissions matrix Super Admin (`ui-permissions-superadmin.png`)  
8. Leave page (`ui-leave-superadmin.png`)

---

## What this does **NOT** prove (important)

1. **New backend hardening is NOT live** (PDF via PDFKit, Cloudinary export keys, `/ops/logs`, JWT `resolvePermissions` seed, SSE cookie + FE EventSource). Those are local uncommitted changes.
2. **SSE realtime** was **not** verified end-to-end (deployed FE still polls; no EventSource to stream).
3. **PDF export** button path not verified (deployed API may not accept `format: pdf` yet).
4. **Permission PATCH → HR loses export** after refresh — not exercised (would mutate live grants).
5. **Local FE + local BE** not run (no Docker; Hostinger unreachable from Mac for local BFF).
6. Not every sidebar page was click-tested (Payroll, Timesheets, Assets, etc.).

---

## Verdict

| Scope | Verdict |
|-------|---------|
| Deployed UI ↔ Hostinger API (smoke click-through) | **PARTIAL PASS** — login, dashboard, employees export, reports export, permissions matrix, leave load |
| New hardening features (this plan’s code) in UI | **NOT TESTED / NOT DEPLOYED** |
| Full “every click, every screen, zero issues” | **FAIL claim** — incomplete |

---

## What I need from you to finish a real PASS

1. **Restore Mac → Hostinger reachability** (or approve Hostinger VPS network/firewall check from panel), **or**  
2. **Approve commit + deploy** of backend to Hostinger + FE SSE changes to Vercel, then I re-run the same click suite against the new code, including:
   - PDF export  
   - `/ops/logs` (via tunnel or once API is reachable)  
   - SSE: leave submit → other user bell without refresh  
   - Permission toggle → re-login → export 403  

No commits were made in this session.
