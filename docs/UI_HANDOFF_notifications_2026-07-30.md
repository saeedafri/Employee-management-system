# BE → FE — Notifications & real-time SSE: what works, and what blocks the UI

> **Date:** 2026-07-30
> **Backend status:** ✅ built, tested end to end, live on `https://ems-api.saqibsaeed.cloud`
> **Frontend status:** ❌ **not consuming it** — two blockers below, both FE-side
> **Verified:** 12/12 end-to-end checks against a real database (incl. Redis fan-out) + live production smoke

---

## 0. Headline

**The backend real-time pipeline works.** A domain event (e.g. an employee checking in)
writes a `Notification` row and pushes a live SSE frame to every recipient in the same
request. Verified with a real payload, not a mock.

**The frontend cannot currently receive any of it**, for two independent reasons:

1. There is **no `EventSource`** anywhere in `ems-frontend` — nothing ever opens
   `/notifications/stream`.
2. Even if it did, the **BFF proxy would hang**: `src/app/api/[...path]/route.ts` does
   `await backendResponse.arrayBuffer()`, which waits for the body to *finish*. An SSE
   stream never finishes. See §5 — this needs a small proxy change or a direct connection.

MSW is confirmed **off** (`NEXT_PUBLIC_USE_MOCKS=false`, and `MSWProvider` early-returns),
and `API_BASE_URL` points at the live backend — so nothing is being faked.

---

## 1. Architecture, accurately

```
domain event (leave / attendance / regularization / timesheet)
        │
        ▼
src/utils/notifier.js  ──▶ prisma.notification.create()   (persisted, 12h TTL)
        │
        └──────────────▶ src/utils/sseClients.js  emitToUser()
                                  │
                                  ▼
                         GET /notifications/stream   (text/event-stream)
```

### ✅ Redis fan-out — fixed, scale-safe

Originally `sseClients.js` was a plain in-process `Map`, so live push would have **broken
silently** the moment the backend ran more than one replica (REST would keep working, only
the push would vanish — the failure mode hardest to notice).

Every emit now publishes to the Redis channel `ems:sse`; each instance subscribes and
delivers to the sockets it holds. Publishing is the *only* path when fan-out is on, so no
client is double-sent.

- **`REDIS_URL` set** -> cross-instance delivery. Verified against the live Redis:
  `fanoutEnabled: true, published: 7, receivedFromRedis: 7`, with `emits: 4` matching the
  four genuine recipient deliveries — round-tripped, no duplicates.
- **`REDIS_URL` unset** -> silently direct in-process delivery, exactly as before.
- **Publish fails** -> falls back to local delivery rather than dropping the event.
- Fan-out failure at boot never blocks startup.

Diagnostics expose `fanoutEnabled`, `published`, `receivedFromRedis` alongside the
connection counters.

**Nothing for FE to do — this is resolved.**

---

## 2. Event catalogue — who receives what

Recipients are computed per event; **they are not the same for every type.** This surprised
us during testing, so build the UI against this table rather than assuming.

| Event type | Employee | Manager | HR_ADMIN | SUPER_ADMIN |
|---|:--:|:--:|:--:|:--:|
| `leave_requested` | — | ✅ | ✅ | ✅ |
| `leave_approved` | ✅ | — | — | — |
| `leave_denied` | ✅ | — | — | — |
| `leave_withdrawn` | — | ✅ | ✅ | ✅ |
| `attendance_checkin` | ✅ | ✅ | **—** | ✅ |
| `attendance_checkout` | ✅ | ✅ | **—** | ✅ |
| `regularization_requested` | — | ✅ | ✅ | ✅ |
| `regularization_approved` | ✅ | — | — | — |
| `regularization_denied` | ✅ | — | — | — |
| timesheet submit reminder | ✅ | — | — | — |
| `payslip_published` NEW | ✅ | — | — | — |
| `document_uploaded` NEW | ✅ | — | — | — |

**NEW** = added in this pass. `payslip_published` fires for every employee in a payroll run
the moment HR publishes it — the one event employees actively wait for.
`document_uploaded` fires when a document lands on someone's profile. Both are best-effort:
a notification failure can never roll back the publish or the upload.

> Note the two bold cells: **HR_ADMIN does not receive attendance check-in/out
> notifications.** They receive a separate `analytics_update` event instead (§3.2). This is
> deliberate — check-in noise would swamp an HR inbox — but don't build an HR bell that
> expects them.

**Approval outcomes go only to the employee.** A manager who approves leave gets no
notification of their own action.

---

## 3. The SSE stream

### 3.1 Connecting

```
GET /notifications/stream?token=<accessToken>
```

`EventSource` cannot set an `Authorization` header, so the token goes in the query string.
A `Bearer` header or the `accessToken` cookie also works if you connect another way.

Response headers:
```
HTTP/2 200
content-type: text/event-stream
cache-control: no-cache
```

First frame is a comment heartbeat confirming the connection:
```
: connected
```

### 3.2 Event frames

**`notification`** — a real captured frame:
```
event: notification
data: {"id":"0b8000c99811e1934403224f","type":"attendance_checkin",
       "title":"Check-In Recorded","message":"Priya Sharma checked in",
       "createdAt":"2026-07-30T…","metadata":{"attendanceId":"…","employeeId":"…"}}
```

**`analytics_update`** — a hint to refetch dashboard widgets, sent to HR_ADMIN +
SUPER_ADMIN on attendance events. Carries no notification payload:
```
event: analytics_update
data: {"tenantId":"…","ts":1785…}
```

➡️ Treat these as two different things: `notification` feeds the bell; `analytics_update`
should just invalidate an analytics query, not create a toast.

---

## 4. REST endpoints

All require `Authorization: Bearer <token>`. Scoped to the calling user — a user can only
ever see their own notifications.

### `GET /notifications?page=&limit=&unreadOnly=&since=`
```json
{
  "success": true,
  "data": {
    "notifications": [
      { "id": "…", "type": "attendance_checkin", "title": "Check-In Recorded",
        "message": "Priya Sharma checked in", "read": false,
        "metadata": { "attendanceId": "…", "employeeId": "…" },
        "createdAt": "2026-07-30T…", "expiresAt": "2026-07-30T…" }
    ],
    "unreadCount": 24,
    "pagination": { "page": 1, "limit": 20, "total": 25, "totalPages": 2 }
  }
}
```
`unreadCount` is included here, so the list call alone can drive the badge.

### `GET /notifications/unread-count`
```json
{ "success": true, "data": { "count": 24 } }
```

### `PATCH /notifications/:id/read` · `POST /notifications/:id/read`
### `PATCH /notifications/read-all` · `POST /notifications/read-all`
Both verbs exist for each (the `POST` forms are compatibility aliases). Marking another
user's notification is a no-op, not an error.

### ⏳ Notifications expire after 12 hours
`notifier.js` sets `expiresAt = now + 12h`. Anything older is swept and **will not appear**
in the list. Don't build a permanent activity feed on this — it is a transient bell, not an
audit log. (`/audit-logs` is the durable record.)

---

## 5. 🔴 The two FE blockers

### 5.1 Nothing opens the stream
No `EventSource` exists in `ems-frontend`. Minimum viable client:

```ts
const es = new EventSource(`/api/notifications/stream?token=${accessToken}`);

es.addEventListener('notification', (e) => {
  const n = JSON.parse(e.data);
  // push to bell, bump unread count
});

es.addEventListener('analytics_update', () => {
  queryClient.invalidateQueries({ queryKey: ['analytics'] });
});

es.onerror = () => { /* EventSource auto-reconnects; surface only if persistent */ };
return () => es.close();
```

### 5.2 The BFF proxy will hang on a stream

`src/app/api/[...path]/route.ts`:
```ts
const responseBody = await backendResponse.arrayBuffer();   // ← never resolves for SSE
```

`arrayBuffer()` waits for the body to complete. An SSE body is open-ended, so this call
hangs and the browser gets nothing.

Two options:

**(a) Stream it through the proxy** — pass the body through instead of buffering, for this
one content type:
```ts
if (backendResponse.headers.get('content-type')?.includes('text/event-stream')) {
  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
}
```

**(b) Connect straight to the backend**, bypassing the BFF, since the token is already in
the query string. Needs the backend origin exposed to the browser and CORS to allow it —
tell us and we'll confirm `CORS_ORIGIN`.

We'd suggest **(a)**: it keeps one origin, keeps the cookie model intact, and is ~8 lines.
Note the buffering exists deliberately (it protects binary payslip/PDF downloads), so
please special-case `text/event-stream` rather than removing `arrayBuffer()`.

---

## 6. Verification evidence

**End-to-end, against a real database** (`sse-e2e`, 9/9): subscribe two clients → employee
checks in via the real endpoint → assert the live frame arrives → assert the row persists →
mark it read.

```
✔ GET /notifications — status 200
✔ list response shape — keys: notifications,unreadCount,pagination
✔ GET /notifications/unread-count — {"count":24}
✔ SSE client registered — {"uniqueUsers":2,"connectionCount":2,…}
✔ POST /attendance/check-in (event trigger) — status 201
✔ real-time SSE push received by SUPER_ADMIN — event: notification … "attendance_checkin"
✔ real-time SSE push received by the employee
✔ notification persisted and listable — attendance_checkin: Check-In Recorded
✔ PATCH /notifications/:id/read — status 200
✔ document_uploaded reaches the employee
✔ diagnostics expose fan-out state — fanoutEnabled:true, published:7, receivedFromRedis:7
```

`payslip_published` is covered separately by `tests/notifier-payslip-published.test.js`
(5/5, no database needed): one notification per employee in the run, the exact payload the
bell renders (`payslipId` + `runId` for deep-linking, period in the message, 12h TTL),
employees with no linked user account skipped rather than throwing, an empty run writing
nothing, and no id collisions across 25 recipients.

**Live production smoke:** `/notifications/stream` → `HTTP/2 200`, `text/event-stream`,
`: connected`. `/notifications` and `/notifications/unread-count` → `200`.

Re-run any time with the committed script (set `REDIS_URL` to exercise fan-out).

**Not covered:** no browser-level test — blocked by §5, which is FE-side. Fan-out is proven
through Redis round-trip counters rather than two literally separate processes.

---

## 7. Summary of asks

| # | Owner | Item |
|---|---|---|
| 1 | **FE** | Add an `EventSource` client (§5.1) |
| 2 | **FE** | Special-case `text/event-stream` in the BFF proxy, or tell us to enable a direct connection (§5.2) |
| 3 | **FE** | Treat `analytics_update` as a cache-invalidation hint, not a toast (§3.2) |
| 4 | **FE** | Build the bell against the recipient matrix in §2 — especially: HR does **not** get check-in/out |
| 5 | **FE** | Remember the 12-hour TTL — this is a transient bell, not a feed (§4) |
| ~~6~~ | ~~BE~~ | ~~Redis pub/sub fan-out~~ — DONE, verified against live Redis (§1) |

**Everything fixable from the backend is done.** The remaining items (1-5) are all FE-side.

Two notes on what we did *not* add:
- **Resignations** emit nothing because `src/modules/resignations/` is empty — the Prisma
  model exists but there are no routes, so there is no event to hook. Tell us if that
  module is coming and we'll wire the notification with it.
- Tell us any other event you want surfaced; it is a small change now that the pipeline and
  the fan-out are both proven.
