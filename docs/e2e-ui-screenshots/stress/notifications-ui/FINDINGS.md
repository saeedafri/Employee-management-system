# NOTIF-UI Stress Findings

> Generated 2026-08-03T03:42:34.553Z  
> FE `http://localhost:3001` · BE `http://localhost:4000` · tenant `acme-corp-001`  
> Evidence: `docs/e2e-ui-screenshots/stress/notifications-ui/` (**32** PNGs + `results.json` + `_run.log`)  
> Roles: `superadmin` / `hr` / `aman` / `priya` @acme.test · `Password123!`

## Summary

| Role | Badge UI | GET unread-count | List unread (≤20) | Mismatch | Mark one | Mark all | Rapid ×10 |
|------|----------|------------------|-------------------|----------|----------|----------|-----------|
| SUPER_ADMIN | **9+** (aria=14) | 14 | 14 | no | PATCH **200** (14→13) | PATCH **200** | 0 notif API fails |
| HR_ADMIN | **3** | 3 | 3 | no | PATCH **200** (3→2) | PATCH **200** (markedRead=2) | 0 notif API fails |
| MANAGER | **3** | **4** | **4** | **YES** | no PATCH captured; count drifted 3→5 under live fan-out | PATCH **200** (markedRead=5) | 0 notif API fails |
| EMPLOYEE | **1** | 1 | 1 | no | PATCH **200** (1→0) | control absent after zero unread (OK) | 0 notif API fails |

**Working:** Bell opens for all 4 roles; list renders; mark-all-read **200**; rapid open/close ×10 stable (no stuck skeleton, no empty false-positive, no notif API 4xx/5xx).  
**Defect:** MANAGER badge under-counts vs API + drawer (badge **3**, API/list **4**, drawer shows 4 unread-styled items in `019`).

## UI capabilities (drawer)

| Role | Open | Items shown | Empty | Mark all | Unread filter UI | Pagination / Load more |
|------|------|-------------|-------|----------|------------------|------------------------|
| SUPER_ADMIN | yes | 20 | no | yes | **absent** | **absent** |
| HR_ADMIN | yes | 20 | no | yes | **absent** | **absent** |
| MANAGER | yes | 20 | no | yes | **absent** | **absent** |
| EMPLOYEE | yes | 20 | no | yes→gone after mark-one | **absent** | **absent** |

API supports `?unreadOnly=` and paging (`page`/`limit`); drawer exposes neither.

## Root cause (badge)

`NotificationBell` / `useNotifications`:

- Fetches `GET /notifications?limit=20` only.
- Recomputes `unreadCount` as `filtered.filter(n => !n.isRead).length` after client prefs filter.
- **`notificationsApi.unreadCount()` → `GET /notifications/unread-count` is never called** for the badge.

So badge ≠ server unread-count whenever prefs hide types, list page is truncated, or React Query is stale vs live inserts.

## Issues

### ISSUE-NOTIF-UI-01 — HIGH — Badge vs unread-count (MANAGER)
- **Where:** Header bell badge · `aman@acme.test`
- **Why:** UI badge **3** / aria `Notifications — 3 unread` while `GET /notifications/unread-count` → **4** and list unreadInPage=**4**. Drawer `019` shows 4 leave items (incl. “less than a minute ago”) with unread styling while badge still **3**.
- **Classification:** FRONTEND
- **How to resolve:** Drive badge from `GET /notifications/unread-count` (or keep prefs filter but apply the same filter server-side / invalidate on prefs). Poll or invalidate on focus.
- **Screenshot:** `018-mgr-badge-closed.png`, `019-mgr-drawer-open.png`
- **Network:** `GET /notifications/unread-count` **200** `{"count":4}` · `GET /notifications?limit=20` unreadInPage=4

### ISSUE-NOTIF-UI-02 — MEDIUM — No pagination / load-more
- **Where:** Notifications drawer (all roles)
- **Why:** List hard-capped at `limit=20`; drawer has max-height scroll only. SA/HR/MGR/EMP all returned 20 rows with no Next/Load more.
- **Classification:** FRONTEND
- **How to resolve:** Infinite scroll or page controls wired to `page`/`limit`.
- **Screenshot:** `003-sa-drawer-open.png`, `011-hr-drawer-open.png`, `019-mgr-drawer-open.png`, `027-emp-drawer-open.png`
- **Network:** `GET /notifications?limit=20` → 20 items

### ISSUE-NOTIF-UI-03 — MEDIUM — No unread filter in drawer
- **Where:** Notifications drawer
- **Why:** API `?unreadOnly=true` works (probed); UI has no Unread/All toggle.
- **Classification:** FRONTEND
- **How to resolve:** Add filter control calling `list({ unreadOnly: true })`.
- **Screenshot:** `019-mgr-drawer-open.png`
- **Network:** `GET /notifications?unreadOnly=true&limit=20` **200**

### ISSUE-NOTIF-UI-04 — LOW — Console 401 on login bootstrap
- **Where:** `/login` (all roles)
- **Why:** Anonymous `GET /api/auth/me` + `POST /api/auth/refresh` → **401** (same cosmetic noise as other stress shards).
- **Classification:** FRONTEND
- **How to resolve:** Skip me/refresh probes on public auth routes.
- **Screenshot:** `008-sa-final-badge.png` (representative)
- **Network:** `401 GET /api/auth/me` · `401 POST /api/auth/refresh`

### ISSUE-NOTIF-UI-05 — MEDIUM — Mark-one click can miss PATCH (MANAGER)
- **Where:** MANAGER item click
- **Why:** Click navigated to dashboard but **no** `PATCH /notifications/:id/read` in network log; unread-count drifted **3→5** (live leave fan-out from concurrent Priya traffic) before mark-all cleared with `markedRead:5`.
- **Classification:** FRONTEND (race / navigation before mutate flush) · observational under live load
- **How to resolve:** Await mark-read before `router.push`; optimistic cache update.
- **Screenshot:** `020-mgr-item-click.png`, `021-mgr-after-item-click-reopen.png`
- **Network:** no mark-read PATCH; later `PATCH /notifications/read-all` **200** `markedRead:5`

## Stress notes

- Rapid open/close ×10 per role: **0** notification API failures, **0** stuck skeletons, drawer re-opens cleanly (`007`/`015`/`023`/`031`).
- Mark-all-read idempotent when unread>0: SA/HR/MGR **200**; EMP correctly hides control at 0 unread (`030`).
- No empty-state false positive while API had items.
- Concurrent leave/notif fan-out during run caused unread counts to move between steps (esp. MANAGER) — badge lag made mismatch visible.

## Artifacts

- Script: `_stress_notifications_ui.mjs`
- Log: `_run.log`
- Machine results: `results.json`
- PNGs: `001`–`032`
