# BE → FE — Notifications & real-time SSE: what works, and what blocks the UI

> **Date:** 2026-07-30
> **Backend status:** ✅ built, tested end to end, live on `https://ems-api.saqibsaeed.cloud`
> **Frontend status:** ❌ **not consuming it** — two blockers below, both FE-side
> **Verified:** 9/9 end-to-end checks against a real database + live production smoke

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

### ⚠️ Important: Redis is **not** in this path

There is a healthy `ems-redis` container, but **notifications do not use it**.
`sseClients.js` is a plain in-process `Map` (`userId → Set<reply>`).

**Consequence:** this is correct for the current single-container deployment, but it will
**silently break the moment the backend is scaled to 2+ replicas** — a notification created
on instance A will never reach a client connected to instance B. The REST endpoints keep
working (they read the DB); only the live push is lost, which is the failure mode hardest
to notice.

If horizontal scaling is on the roadmap, this needs a Redis pub/sub fan-out first. Flagging
now rather than after it breaks. Nothing for FE to do about it.

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
```

**Live production smoke:** `/notifications/stream` → `HTTP/2 200`, `text/event-stream`,
`: connected`. `/notifications` and `/notifications/unread-count` → `200`.

**Not covered:** no browser-level test (blocked by §5), and no multi-replica test — see the
Redis caveat in §1.

---

## 7. Summary of asks

| # | Owner | Item |
|---|---|---|
| 1 | **FE** | Add an `EventSource` client (§5.1) |
| 2 | **FE** | Special-case `text/event-stream` in the BFF proxy, or tell us to enable a direct connection (§5.2) |
| 3 | **FE** | Treat `analytics_update` as a cache-invalidation hint, not a toast (§3.2) |
| 4 | **FE** | Build the bell against the recipient matrix in §2 — especially: HR does **not** get check-in/out |
| 5 | **FE** | Remember the 12-hour TTL — this is a transient bell, not a feed (§4) |
| 6 | **BE** | Redis pub/sub fan-out **before** scaling past one replica (§1) |

Questions: is horizontal scaling planned soon (decides the urgency of #6), and do you want
notifications for any event we don't emit yet — payroll run published, document uploaded,
resignation submitted are the obvious candidates and none exist today.
