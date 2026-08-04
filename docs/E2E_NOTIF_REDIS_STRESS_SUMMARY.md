# E2E Notifications + Redis Stress — Final Rollup

| Field | Value |
|-------|-------|
| Date | 2026-08-03 |
| Wave | Notifications REST · SSE fan-out · UI bell · leave→notif E2E · Redis/BullMQ · isolation hammer |
| Stack | **FE** `http://localhost:3001` → **BE** `http://localhost:4000` → Hostinger DB/Redis via local tunnel (`:15432` / Redis `:16379`) |
| Tenant | `acme-corp-001` · roles: `superadmin` / `hr` / `aman` / `priya` @acme.test |
| Contracts (append-only — **not wiped**) | `docs/E2E_BACKEND_ISSUES_CONTRACT.md` → `## NOTIFICATIONS` (NOTIF-01..16, SSE-30) · `docs/E2E_FRONTEND_ISSUES_CONTRACT.md` → **ISSUE-MGR-15** · stress BE/FE contracts |
| This summary | `docs/E2E_NOTIF_REDIS_STRESS_SUMMARY.md` |
| **No Render. No git commit.** | Read-only Redis/BullMQ inspect; leave create cleaned via withdraw. |

---

## 1. Verdict

| Lane | Result |
|------|--------|
| Redis PING + SSE fan-out | **PASS** |
| Leave → notif → SSE E2E create | **PASS** |
| BullMQ `payroll-calculate` idle health | **PASS** (inspect-only) |
| Notification IDOR / cross-user mark-read | **PASS** (no IDOR) |
| Isolation hammer (notif rows) | **PASS** |
| Isolation hammer (SA leave) | **FAIL** — **ISSUE-SA-10** reconfirmed ×5/5 |
| SSE auth after `logout-all` | **FAIL** — **ISSUE-SSE-30** CRITICAL |
| Notifications REST edge params | **PARTIAL** — HIGH pagination/DoS defects |
| Notifications UI badge | **PARTIAL** — **ISSUE-MGR-15** HIGH |

**Wave overall:** PARTIAL PASS — core delivery path (Redis pub/sub, leave fan-out, E2E create, no notif IDOR) is solid; session-revoke SSE hole + SA leave leak + REST validation gaps + manager badge lag remain.

---

## 2. What PASSED

### Redis + fan-out
- `redis-cli` / ioredis **PING → PONG** on `redis://127.0.0.1:16379`
- Channel `ems:sse` present; boot log `[sse] cross-instance fan-out enabled`; `/ops/process` `fanoutEnabled: true`
- Concurrent SSE open (priya×2, aman, SA, HR) → all **200** `text/event-stream` `: connected`
- Leave create → Redis PUBLISH → manager/HR/SA SSE **HIT**; submitter (priya) correctly **does not** get `leave_requested`
- Multi-tab: aman approve → priya A + B both **HIT** `leave_approved`
- Dup probe: 1 Redis PUBLISH → **1** SSE frame (no local double-emit)
- Burst reconnect ×10: **200×10**, 0 hung, connects/disconnects balanced

### E2E leave → notif → SSE (`notif-e2e-create`)
- Priya SL `2026-12-16` → **201** `LVR-0031`
- Aman unread Δ=**1**; SSE `notification` event=**true**; Redis PUBLISH=**true**
- Isolation OK: priya unread Δ=**0**, no self `leave_requested` in UI drawer
- Cleanup: leave **WITHDRAWN** (re-login after harness token TTL)

### BullMQ / cache (`redis-bullmq`)
- `redisEnabled: true`; 100 parallel cache set→get **100/100** in 151 ms; prefix delete clean
- Queue `payroll-calculate`: waiting/active/delayed=0, **failed=0**, **completed=52**
- Hot-config `cache:tenantcfg:*` + `cache:statpacks:*` present
- Cache helpers degrade cleanly when Redis wrong-port (no throw)

### Isolation / IDOR (notifications)
- Cross-user `PATCH|POST /notifications/:foreignId/read` → **404×18** per role (72 total) — **NOTIF-OK-IDOR**
- Mark-read / read-all aliases under burst + race list∥read-all → all **200**; post-race unread-count=0 — **NOTIF-OK-ALIASES-RACE**
- Auth missing/bad → **401**
- Isolation hammer: distinct notif IDs per role; EMP inbox titles differ from approver fan-out; **0** ID overlap; **0** ×5xx across 185 sensitive GETs; cookies unique per parallel login
- EMPLOYEE → `/manager/*` → **403×5** (expected)

### UI stress (happy path)
- Bell opens all 4 roles; list renders; mark-all-read **200**; rapid open/close ×10 → **0** notif API fails, no stuck skeleton

---

## 3. CRITICAL / HIGH defects (canonical IDs)

### CRITICAL

| ID | Layer | Summary | Evidence |
|----|-------|---------|----------|
| **ISSUE-SSE-30** / **ISSUE-NOTIF-10** | BACKEND | SSE accepts JWT after `POST /auth/logout-all` (`verifyToken` only; skips session `revokedAt`). REST same token → **401**. Stolen/revoked sessions keep live notifs until JWT TTL. | `notifications-sse/RESULTS.md` §6 · `07-auth-edge.json` · `09-deep-probes.json` |
| **ISSUE-SA-10** | BACKEND | SUPER_ADMIN leave/balance + leave/requests resolve to Priya (`cmqjpyds7001kkpjdnlhjygrp`) while `auth/me.employeeId=null`. Isolation hammer **5/5** rounds. | `isolation-hammer/RESULTS.md` · contract `## SUPER_ADMIN` |

### HIGH

| ID | Layer | Summary | Evidence |
|----|-------|---------|----------|
| **ISSUE-NOTIF-01** | BACKEND | `?page=-1` → Prisma negative skip → **500** (all 4 roles) | `notifications-api/RESULTS.md` `NOTIF-BE-01` |
| **ISSUE-NOTIF-02** | BACKEND | Invalid `since` → Invalid Date → **500** | `NOTIF-BE-02` |
| **ISSUE-NOTIF-03** | BACKEND | Unbounded `limit=5000` (~1.07MB); ×4 concurrent ≈4.3MB DoS pressure | `NOTIF-BE-03` |
| **ISSUE-SSE-31** / **ISSUE-NOTIF-11** | BACKEND | SSE payload (`message`/`metadata`) ≠ REST (`body`/`isRead`/entity fields) | `notifications-sse` §7 |
| **ISSUE-SSE-32** / **ISSUE-NOTIF-12** | BACKEND | SSE `writeHead` omits CORS ACAO (breaks direct browser→`:4000` EventSource; BFF may mask) | `09-deep-probes.json` |
| **ISSUE-MGR-15** / **ISSUE-NOTIF-UI-01** | FRONTEND | MANAGER badge **3** vs `unread-count` **4** / drawer 4 unread. Badge derived from `list(limit=20)` client filter; `unreadCount()` never called. | `notifications-ui/FINDINGS.md` · `018`/`019` PNGs |

### MEDIUM / LOW (contract catalog — not expanded)

| IDs | Sev | Notes |
|-----|-----|-------|
| NOTIF-04..08 | MED | Negative/zero limit/page coerce; markAllRead vs ACTIVE_FILTER; ~20k/user latency |
| NOTIF-09 | LOW | Strict `unreadOnly` boolean → 422 for `1`/`TRUE`/`yes` |
| SSE-33 / NOTIF-13 | MED | SSE 401 envelope ≠ REST error shape |
| SSE-29 / NOTIF-14 | MED | Token in query string (EventSource necessity + log leak risk) |
| SSE-34 / NOTIF-15 | MED | Shared Redis `NUMSUB ems:sse`=2 (peer inventory; local dup=1) |
| SSE-19 / NOTIF-16 | LOW | Mark-read does not emit SSE (tabs must poll) |
| NOTIF-UI-02/03/05 | MED | No drawer pagination; no unread filter; mgr mark-one click can miss PATCH |
| NOTIF-UI-04 | LOW | Login bootstrap me/refresh 401 noise |
| Redis enqueue degrade | PARTIAL | Wrong-port `enqueueCalculate` hang risk before sync fallback |

Full text: `docs/E2E_BACKEND_ISSUES_CONTRACT.md` → `## NOTIFICATIONS` (NOTIF-01..16, SSE-30 family).

---

## 4. Artifact paths

| Lane | Path |
|------|------|
| Notifications REST stress | `docs/e2e-ui-screenshots/stress/notifications-api/RESULTS.md` (+ `raw.json`, `_run.log`, `_stress_notif_api.mjs`) |
| SSE + Redis fan-out | `docs/e2e-ui-screenshots/stress/notifications-sse/RESULTS.md` (+ `01-redis-ping.json`…`09-deep-probes.json`, `_stress_notif_sse.mjs`) |
| Notifications UI (Playwright) | `docs/e2e-ui-screenshots/stress/notifications-ui/FINDINGS.md` (+ `001`–`032` PNGs, `results.json`) |
| Leave→notif E2E create | `docs/e2e-ui-screenshots/stress/notif-e2e-create/FINDINGS.md` (+ `results.json`, `sse-aman.log`, `redis-pubsub.log`, `005`–`008` PNGs) |
| Redis + BullMQ | `docs/e2e-ui-screenshots/stress/redis-bullmq/RESULTS.md` |
| Isolation hammer | `docs/e2e-ui-screenshots/stress/isolation-hammer/RESULTS.md` (+ `raw.json`) |
| Backend contract | `docs/E2E_BACKEND_ISSUES_CONTRACT.md` → `## NOTIFICATIONS` |
| Frontend contract (badge) | `docs/E2E_FRONTEND_ISSUES_CONTRACT.md` → **ISSUE-MGR-15** |
| This rollup | `docs/E2E_NOTIF_REDIS_STRESS_SUMMARY.md` |

---

## 5. Honest gaps

| Gap | Why |
|-----|-----|
| **Live `POST /payroll/runs/:id/calculate` skipped** | No DRAFT/CALCULATING runs; enqueue would mutate Hostinger payroll. BullMQ health = historical completed jobs only. |
| **Hostinger Redis not killed** for outage test | Wrong-port child only (`:19999`); tunnel Redis left running. |
| **NUMSUB=2 on `ems:sse`** | Peer subscriber on shared Hostinger Redis — inventory unknown; local delivery stayed single. |
| **~20k notifications/user** | Dominates list latency (p50 ~700–1500ms under ×20); retention job unused on request path — seed/spam scale, not a fresh-product baseline. |
| **Withdraw leftovers** | E2E leave withdrawn; `leave_requested` + `leave_withdrawn` notif rows remain until TTL/mark-read (expected). |
| **Harness token TTL** | First withdraw attempt **401** after long Playwright session; product withdraw OK after re-login (**NOTIF-E2E-01** harness-only). |
| **SSE CORS** | May be masked in production if FE BFF proxies `/api/*` same-origin — still broken for direct `:4000` EventSource. |
| **Badge mismatch MANAGER-only in this run** | Same list-derived pattern latent for all roles when prefs/truncation bite. |
| **No Render / no migrate / no commit** | All evidence local-tunnel only. |

---

## 6. Top 5 bugs (priority order)

1. **ISSUE-SSE-30 / NOTIF-10** — CRITICAL — SSE stays connected after `logout-all` while REST correctly 401s.
2. **ISSUE-SA-10** — CRITICAL — SUPER_ADMIN leave APIs leak Priya’s data (isolation hammer 5/5; not a notif bug but wave-confirmed).
3. **ISSUE-NOTIF-01..03** — HIGH — Negative page / invalid `since` → **500**; unbounded `limit=5000` DoS.
4. **ISSUE-SSE-31 / SSE-32** (NOTIF-11/12) — HIGH — SSE DTO ≠ REST; SSE response missing CORS ACAO.
5. **ISSUE-MGR-15** (NOTIF-UI-01) — HIGH — Manager bell badge under-counts vs authoritative `unread-count`.

---

## 7. Source index

| Source | Role in rollup |
|--------|----------------|
| `docs/e2e-ui-screenshots/stress/notifications-api/RESULTS.md` | REST burst, edges, IDOR pass, NOTIF-BE-01..09 |
| `docs/e2e-ui-screenshots/stress/notifications-sse/RESULTS.md` | Redis PING, fan-out, SSE-30..34, reconnect |
| `docs/e2e-ui-screenshots/stress/notifications-ui/FINDINGS.md` | Bell UI, MGR-15 / NOTIF-UI-* |
| `docs/e2e-ui-screenshots/stress/notif-e2e-create/FINDINGS.md` | Leave→notif→SSE PASS + isolation |
| `docs/e2e-ui-screenshots/stress/redis-bullmq/RESULTS.md` | Cache stress, BullMQ idle, calculate skipped |
| `docs/e2e-ui-screenshots/stress/isolation-hammer/RESULTS.md` | SA-10 reconfirm; notif IDOR clean |
| `docs/E2E_BACKEND_ISSUES_CONTRACT.md` `## NOTIFICATIONS` | Canonical NOTIF-01..16 + SSE-30 family |
