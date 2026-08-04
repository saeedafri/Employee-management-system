# Notifications SSE + Redis Fan-out — Stress Results

> Target: `http://localhost:4000` · Redis: `redis://127.0.0.1:16379` · Tenant: `acme-corp-001`  
> Started: 2026-08-03T03:41:20.416Z · Finished: ~2026-08-03T03:45:00Z  
> Harness: `_stress_notif_sse.mjs` + deep probes `09-deep-probes.json`  
> Defects filed: **7** (1 CRITICAL · 2 HIGH · 3 MEDIUM · 1 LOW)

## Verdict

**PARTIAL PASS** — Happy-path Redis pub/sub fan-out, multi-user / multi-tab delivery, burst reconnect, and auth-missing/bad/expired tokens all work. Critical gap: **SSE accepts JWTs after `logout-all` (session revoke)** while REST correctly returns 401.

## 1) Redis PING

| Check | Result |
|---|---|
| `redis-cli -u redis://127.0.0.1:16379 PING` | **PONG** |
| ioredis `PING` | **PONG** |
| `PUBSUB CHANNELS ems:*` | `ems:sse` present |
| `PUBSUB NUMSUB ems:sse` | **2** subscribers (local BE + peer on shared Hostinger Redis) |

Capture: `01-redis-ping.json`

## 2) Fan-out boot log

Found in BE terminal (`node --env-file=.env src/server.js`, pid 98982):

```text
{"level":30,...,"channel":"ems:sse","msg":"[sse] cross-instance fan-out enabled"}
```

`/ops/process` SSE diag: `fanoutEnabled: true` throughout.

Capture: `05-fanout-boot-log.txt`, `02-ops-sse-before.json`, `02b-ops-sse-during.json`

## 3) Concurrent SSE open (priya×2, aman, SA, HR)

| Client | HTTP | Content-Type | Connected |
|---|---:|---|---|
| priya-A | 200 | text/event-stream | `: connected` |
| priya-B | 200 | text/event-stream | `: connected` |
| aman | 200 | text/event-stream | `: connected` |
| sa | 200 | text/event-stream | `: connected` |
| hr | 200 | text/event-stream | `: connected` |

Ops during open: `connectionCount=5` `uniqueUsers=4` `fanoutEnabled=true`

## 4) Event delivery (leave create → Redis → SSE)

| Step | Result |
|---|---|
| Priya `POST /leave/requests` CL 2026-12-14 | **201** `LVR-0029` / `cmscomu3g00zgb9xjvmg12knu` |
| Aman SSE `leave_requested` | **HIT** ~356ms |
| HR SSE `leave_requested` | **HIT** ~52ms |
| SA SSE `leave_requested` + `analytics_update` | **HIT** |
| Priya incorrectly got `leave_requested` | **false** |
| Independent Redis tap on `ems:sse` | **7** messages on create (3 notif + 1 extra admin + 3 analytics) |
| Aman approve → Priya A `leave_approved` | **HIT** ~304ms |
| Priya B (2nd tab) same event | **HIT** (multi-tab OK) |
| Dup-delivery probe (1 Redis PUBLISH) | **1** SSE frame (no double-emit) |

Captures: `04-leave-create.json`, `04b-event-delivery.json`, `04c-leave-decision.json`

## 5) Burst reconnect ×10

| Metric | Value |
|---|---|
| Burst open status | **200×10** |
| 401 / hung | **0 / 0** |
| After kill `connectionCount` | **0** |
| Counters | `connects=15` `disconnects=15` (balanced) |
| Post-reconnect leave create → aman SSE | **HIT** ~306ms |
| Final ops | `connects=17` `disconnects=17` `live=0` `published=123` `receivedFromRedis=123` |

No client-registry leak observed under this burst size.

Capture: `06-burst-reconnect.json`

## 6) Auth edge cases

| Case | HTTP | Hung | Body / notes |
|---|---:|---|---|
| No token | **401** | no | `{"error":"UNAUTHORIZED","message":"Missing token"}` |
| Bad token | **401** | no | `INVALID_TOKEN` |
| Expired JWT (signed, exp past) | **401** | no | `INVALID_TOKEN` |
| Empty `?token=` | **401** | no | Missing token |
| Bearer header (no query) | **200** | no | `: connected` works |
| **After `POST /auth/logout-all`** | **200** SSE | no | **CONNECTED — DEFECT** |
| Same token on REST `GET /notifications` after logout-all | **401** | — | `Session revoked or expired` (correct) |

Capture: `07-auth-edge.json`, `09-deep-probes.json`

## 7) Deep probes (shape / CORS)

- REST notification keys: `id,type,title,body,entityType,entityId,actionUrl,isRead,createdAt`
- SSE notification keys: `id,type,title,message,createdAt,metadata`
- SSE GET with `Origin: http://localhost:3001`: **no** `Access-Control-Allow-Origin` (OPTIONS preflight **does** return ACAO)
- Mark-read **200**, **0** SSE events emitted

## Defects

### ISSUE-SSE-30 [CRITICAL] SSE accepts access token after session revoke (`logout-all`)

- **Where:** `GET /api/v1/notifications/stream` — `notifications.routes.js` uses `verifyToken()` only; skips `authenticate()` session lookup (`sessionId` + `revokedAt`)
- **Evidence:** After `POST /auth/logout-all`, REST `/notifications` → **401** `Session revoked or expired`; SSE stream with same JWT → **200** `: connected`
- **Why it matters:** Stolen/revoked sessions keep receiving live notifications until JWT TTL
- **Fix:** Reuse session checks from `authenticate.js` (require `sessionId`, load Session, reject if revoked)

### ISSUE-SSE-31 [HIGH] SSE event payload shape ≠ REST notification object

- **Where:** `notifier.js` `emitToUser(..., { message, metadata })` vs `notifications.service.js` `mapNotification` (`body`, `isRead`, `entityType`, …)
- **Evidence:** REST has `body`/`isRead`/entity fields; SSE has `message`/`metadata`
- **Impact:** FE EventSource handlers cannot reuse the list DTO without adapters; easy to miss fields

### ISSUE-SSE-32 [HIGH] SSE `writeHead` response omits CORS ACAO (breaks cross-origin EventSource)

- **Where:** `reply.raw.writeHead(200, { Content-Type: text/event-stream, ... })` bypasses `@fastify/cors` onSend headers
- **Evidence:** GET stream headers = `content-type,cache-control,connection,x-accel-buffering,date,transfer-encoding` only; OPTIONS returns `access-control-allow-origin: http://localhost:3001`
- **Note:** Official FE BFF proxies `/api/*` same-origin, so production FE may avoid this — still broken for direct browser → `:4000` EventSource / non-BFF clients

### ISSUE-SSE-33 [MEDIUM] SSE 401 envelope inconsistent with API standard

- **SSE:** `{"error":"UNAUTHORIZED","message":"Missing token"}`
- **REST:** `{"success":false,"error":{"code":"UNAUTHORIZED","message":"...", "details":{}, "requestId":"..."}}`

### ISSUE-SSE-29 [MEDIUM] Access token accepted in query string

- Required for native `EventSource` (no custom headers), but leaks via access logs, proxies, Referer if ever cross-origin
- Mitigations present: Bearer + `accessToken` cookie also accepted
- App request-logging redacts object keys containing `token`, but raw URLs may still surface in infra logs

### ISSUE-SSE-19 [LOW] Mark-read does not emit SSE

- `PATCH /notifications/:id/read` → **200**, no stream event
- Clients must poll/`unread-count` to sync read state across tabs

### ISSUE-SSE-34 [MEDIUM] Shared Redis shows NUMSUB=2 on `ems:sse`

- Local BE + another subscriber on Hostinger Redis (likely second EMS instance / leftover)
- Local delivery stayed single (dup probe count=1); flag for multi-instance inventory, not a local double-emit bug

## What worked (not defects)

- Redis PING + channel + fan-out boot log
- Cross-user leave_requested fan-out (manager/HR/SA) via Redis pub/sub
- Multi-tab same-user delivery on approve
- Burst ×10 reconnect, no hung sockets, counters balanced
- Missing / bad / expired token → clean 401
- SA SSE receives `notification` + `analytics_update`
- Ops diagnostics expose `fanoutEnabled`, `published`, `receivedFromRedis`

## Artifacts

| File | Purpose |
|---|---|
| `RESULTS.md` | This report |
| `raw.json` | Full harness dump |
| `_stress_notif_sse.mjs` | Repro harness |
| `_run.log` | Console transcript |
| `01-redis-ping.json` … `08-ops-final.json` | Step captures |
| `09-deep-probes.json` | CORS / logout / shape / dup probes |
