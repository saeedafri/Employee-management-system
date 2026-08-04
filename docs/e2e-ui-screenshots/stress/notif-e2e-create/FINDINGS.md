# NOTIF-E2E-CREATE Findings

> Generated 2026-08-03T03:43:46.944Z · BE `http://localhost:4000` · FE `http://localhost:3001` · tenant `acme-corp-001`  
> Mutation: priya submits **SL** 1 day (`2026-12-16`) → `leave_requested` to manager/HR/SA · then withdraw  
> Hostinger DB via local API (no Render · no migrate)

## Verdict

**PASS** — unread Δ(aman)=**1** · SSE `notification` event=**true** · Redis `ems:sse` PUBLISH=**true** · isolation OK=**true** · leave cleanup **WITHDRAWN**

## Actors

| Role | Email | userId | employeeId |
|------|-------|--------|------------|
| EMPLOYEE | priya@acme.test | `cmqjpydqn000wkpjd02gyqzd3` | `cmqjpyds7001kkpjdnlhjygrp` |
| MANAGER | aman@acme.test | `cmqjpydql000ukpjdbhesbmpi` | `cmqjpyds0001ikpjd5br3r2uh` |

## Before / After (API)

| Who | unread before | unread after create | list top types after create |
|-----|---------------|---------------------|-----------------------------|
| aman | 0 | **1** | `leave_requested` (new unread), then prior history |
| priya | 0 | **0** | `leave_approved`, attendance_*, info — **no** new `leave_requested` |

### Aman new `leave_requested` item

```json
{
  "id": "5733c09635b6e32d7e5487b3",
  "type": "leave_requested",
  "title": "New Leave Request",
  "body": "Priya Sharma requested 1 day(s) of Sick Leave",
  "isRead": false,
  "createdAt": "2026-08-03T03:43:52.153Z"
}
```

## Mutation

- leaveType: **SL** (Sick Leave) — avoided AL
- dates: `2026-12-16` → `2026-12-16` (1 chargeable day)
- HTTP: **201**
- leaveRequestId: `cmscopykg0114b9xjppnmaoo0`
- referenceNo: `LVR-0031`
- Hostinger impact:
  - +1 `LeaveRequest` (later WITHDRAWN)
  - +N `Notification` rows (`leave_requested` → manager + each HR_ADMIN + SUPER_ADMIN) — Redis fan-out showed **4** notification targets for create
  - withdraw adds `leave_withdrawn` rows; **does not delete** prior `leave_requested`

## SSE (aman)

- stream: `GET /notifications/stream?token=…` → **200** `text/event-stream`
- events captured on create: **1** `notification` (+ heartbeats)
- payload matched Prisma row id `5733c09635b6e32d7e5487b3` / type `leave_requested`

```json
{
  "event": "notification",
  "data": {
    "id": "5733c09635b6e32d7e5487b3",
    "type": "leave_requested",
    "title": "New Leave Request",
    "message": "Priya Sharma requested 1 day(s) of Sick Leave",
    "metadata": {
      "employeeId": "cmqjpyds7001kkpjdnlhjygrp",
      "leaveRequestId": "cmscopykg0114b9xjppnmaoo0"
    }
  }
}
```

Log: `sse-aman.log`

## Redis involvement

| Concern | Result |
|---------|--------|
| Notification **storage/cache** keys | **None** — rows are Prisma-only |
| SSE fan-out channel | **`ems:sse`** (`src/utils/sseClients.js`) |
| PING | `PONG` (`redis://127.0.0.1:16379`) |
| PUBSUB CHANNELS | `["ems:sse"]` |
| NUMSUB before | `["ems:sse", 2]` (app subscriber + peer) |
| NUMSUB during probe subscribe | `["ems:sse", 3]` |
| PUBLISH during leave create | **7–8** messages: 4× `notification` (aman/HR/SA targets) + 3× `analytics_update` (HR/SA) |
| `cache:*` sample | `cache:tenantcfg:cmqjpydkv0000kpjdelztyg88` (unrelated hot-config) |

Log: `redis-pubsub.log`

Observed create fan-out userIds (notification):
- `cmqjpydql000ukpjdbhesbmpi` (aman / manager)
- `cmqjpydqp000ykpjdzsb6zb8v`
- `cmqjpydqj000skpjdp2l6cvg5` (hr)
- `cmqjpydqe000qkpjd8q8idw1k` (superadmin)

**Not** published to priya (`cmqjpydqn000wkpjd02gyqzd3`) for `leave_requested`.

## Isolation (negative)

- priya unread Δ after own SL submit: **0**
- priya new `leave_requested` rows: **0**
- aman has `leave_requested` for `cmscopykg0114b9xjppnmaoo0`: **true**
- UI confirm: `008-priya-bell-drawer.png` shows Leave Approved / attendance — **no** “New Leave Request” about herself
- UI confirm: `006-aman-bell-drawer.png` shows “Priya Sharma requested 1 day(s) of Sick Leave” + withdraw

## Cleanup (withdraw)

| Step | Result |
|------|--------|
| Initial script withdraw (stale token after ~90s UI) | HTTP **401** |
| Re-login priya + `PATCH /leave/requests/cmscopykg0114b9xjppnmaoo0/withdraw` | HTTP **200** · status **WITHDRAWN** |
| Verify `GET /leave/requests` row | `{"id":"cmscopykg0114b9xjppnmaoo0","ref":"LVR-0031","status":"WITHDRAWN"}` (`cleanup-verify.log`) |
| aman `GET /notifications/unread-count` after | **`{"count":2}`** — unread rows: `leave_withdrawn` `d5066b0bb5469c12da79cfe5` + `leave_requested` `5733c09635b6e32d7e5487b3` |

Leave hold released; Notification leftovers remain until 12h TTL filter / mark-read (expected). FE bell badge may disagree with unread-count (see `## NOTIF-UI` ISSUE-NOTIF-UI-01); API count is authoritative here.

## Exact commands (evidence)

```bash
# Redis observe-only
redis-cli -u redis://127.0.0.1:16379 PING
# => PONG
redis-cli -u redis://127.0.0.1:16379 PUBSUB CHANNELS '*'
# => ems:sse
redis-cli -u redis://127.0.0.1:16379 PUBSUB NUMSUB ems:sse
# => ems:sse 2

# Create-path harness
node docs/e2e-ui-screenshots/stress/notif-e2e-create/_notif_e2e_create.mjs
# => CREATE status=201 id=cmscopykg0114b9xjppnmaoo0 ref=LVR-0031
# => AFTER unread aman=1(Δ1) priya=0(Δ0) sseEvents=1 redisPub=7

# Cleanup verify (post fresh-login withdraw)
# leave row {"status":"WITHDRAWN"} · aman unread-count {"count":2}
# see cleanup-verify.log
```

## Screenshots

| File | Notes |
|------|-------|
| `001`–`004` | Initial pass (bell selector miss — aria is `Notifications`) |
| `005-aman-dashboard-post-withdraw.png` | Aman after withdraw |
| `006-aman-bell-drawer.png` | Drawer: New Leave Request + Leave Request Withdrawn (badge 2) |
| `007-priya-login-attempt.png` / dashboard | Priya post-cleanup login |
| `008-priya-bell-drawer.png` | Priya drawer — no self `leave_requested` |

## Issues

### ISSUE-NOTIF-E2E-01 — LOW (script/token TTL)
- **Where:** Script withdraw after long Playwright session
- **Why:** Access token expired → withdraw **401**; cleanup succeeded on fresh login
- **Classification:** TEST HARNESS (not product defect for leave withdraw itself)
- **How to resolve:** Re-login before cleanup mutation in harness

_No product isolation defect on create path._

## Artifacts

- Dir: `docs/e2e-ui-screenshots/stress/notif-e2e-create/`
- `results.json`, `sse-aman.log`, `redis-pubsub.log`, `_notif_e2e_create.mjs`, `_run.log`
- Contracts: `## NOTIF-E2E-CREATE` in `docs/E2E_STRESS_BACKEND_CONTRACT.md` + `docs/E2E_STRESS_FRONTEND_CONTRACT.md`
