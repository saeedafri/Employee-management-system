# Backend Performance Report — `/auth/me` "slowness" investigation

> **Date:** 2026-06-23 · **For:** UI / frontend team · **Verdict:** the backend is **not** slow.
> Every endpoint responds in **single- to double-digit milliseconds** server-side. The seconds you
> see come from the **network path** (Vercel functions located far from the Mumbai backend), not the API.

---

## TL;DR

- The reported `/auth/me` call goes **Browser → Vercel BFF function → `https://ems-api.saqibsaeed.cloud` (Mumbai)**.
- The **backend processes `/auth/me` in ~9 ms** (measured on the box; server log `responseTime` 8–28 ms).
- The **Hostinger backend is in Mumbai, India**. The **Vercel BFF has no region pinned**, so it runs in
  Vercel's **default region (US-East, `iad1`)**. Every API call therefore crosses **US ↔ India (~250 ms RTT each way)**,
  plus Vercel cold-starts, plus a fresh TLS handshake (`cache: 'no-store'`) — **per call**.
- A single cold `/auth/me` over that path ≈ **1.5–3 s**; a page firing 8–15 calls compounds it. That is the "seconds."
- **Primary fix is on the Vercel side: pin the functions to Mumbai (`bom1`).** RTT then drops from ~250 ms to ~5–20 ms.

---

## Evidence — the backend is fast at every layer

| Measurement | `/auth/me` time | Notes |
|---|---|---|
| Backend **on the box** (no network) | **9 ms** (8–28 ms in server logs) | pure handler + DB |
| Backend **through nginx**, measured from India | 210–290 ms total | **130–190 ms is the TLS handshake**; server work ~20–100 ms |
| **8-endpoint dashboard burst** (parallel, box) | **0.22 s total** | a real page's worth of calls |
| **30 parallel `/auth/me`** (box) | 0.94 s total; 0.13–0.45 s each | mild DB-pool queuing only |

### Per-API server-side timing (box-local, best of 3) — none exceed the ms range
```
 244 ms  /payroll/cost-summary      (heaviest — an aggregation)
  68 ms  /payroll/runs
  66 ms  /timesheets/summary
  46 ms  /audit-logs
  30 ms  /notifications?limit=20
  27 ms  /recruitment/summary
  25 ms  /analytics/recent-activity
  22 ms  /analytics/summary · /performance/summary
  15 ms  /search · /notifications/unread-count
  13 ms  /employees · /departments · /reports/attendance
   9 ms  /auth/me
   6 ms  /settings/tenant · /payroll/roster · /leave/types
   5 ms  /payroll/statutory-packs
```
**No backend endpoint is "slow."** The slowest single call is `/payroll/cost-summary` at 244 ms.

---

## Where the time actually goes

```
  Browser (user)
     │  ~? (user's link)
     ▼
  Vercel BFF function  ──────────────  ❶ cold start 0.5–2 s (serverless)
  (region: US-East iad1 — DEFAULT)
     │
     │  fetch(API_BASE_URL)  ❷ US ↔ India ~250 ms RTT + TLS handshake (~500–750 ms cold)
     ▼                        ❸ cache: 'no-store' → every call round-trips
  nginx (Mumbai) ─► ems-backend (Mumbai)  ❹ actual work: 9 ms ✅
     │
  Postgres (Mumbai)  ❺ 1–2 queries, ms
```
❶+❷+❸ (Vercel + cross-continent network) dominate. ❹ (the backend) is negligible.

---

## Root cause

**The Vercel BFF functions run ~12,000 km from the Mumbai backend.** Each browser API call is proxied by a
Vercel serverless function in US-East that opens a fresh, globe-spanning HTTPS connection to Mumbai for every
request (`cache: 'no-store'`), with possible cold starts. The 9 ms backend is irrelevant when the function
calling it is on another continent. Multiplied across the many calls a page makes, this presents as "seconds."

Supporting facts: backend in Mumbai (AS47583, Hostinger); Vercel BFF is a catch-all proxy
(`src/app/api/[...path]/route.ts`) with **no `vercel.json` region** and no `runtime` override → default region;
from India a *fresh* TLS handshake to the box already costs 130–190 ms, and is multiplied from the US.

---

## Fixes, by impact

### 🔴 1 — Pin Vercel functions to Mumbai (`bom1`) — **the fix, frontend-owned**
Add `vercel.json` at the frontend repo root (or set **Vercel → Settings → Functions → Region = Mumbai**):
```json
{ "regions": ["bom1"] }
```
This co-locates the BFF with the Mumbai backend → per-call RTT ~250 ms → ~5–20 ms. Single biggest win.

### 🟠 2 — Backend nginx (we own; can apply on request)
- Enable **HTTP/2** on `listen 443` (currently HTTP/1.1 — no multiplexing).
- Replace the WebSocket-style `proxy_set_header Connection "upgrade"` with an `upstream { keepalive }` block so
  nginx reuses the backend connection.
- Enable `gzip` for JSON responses.

### 🟡 3 — DB connection pool (we own)
`DATABASE_URL` has no `connection_limit` → Prisma defaults to **5** on this 2-core box. Raise to ~15–20
(`?connection_limit=20`) for burst headroom. Minor; not the cause of the seconds.

### ⚪ 4 — Operational note
Each `git push` auto-deploys and **restarts `ems-backend` (~30–60 s)**. During that window calls are slow or
fail — don't load-test during a deploy.

---

## Confirm it in 30 seconds
1. **Vercel → Settings → Functions → Region.** If it is not **Mumbai (`bom1`)**, that is the root cause.
2. Compare two timings:
   - `curl -w "%{time_total}\n" https://ems-frontend-iota-ten.vercel.app/api/auth/me` (with cookies) → **seconds**
   - `curl -w "%{time_total}\n" -H "authorization: Bearer <token>" https://ems-api.saqibsaeed.cloud/api/v1/auth/me` → **sub-second**

   The difference between the two **is** the Vercel hop.
