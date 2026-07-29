# FE Contract — what's left to implement

> **Date:** 2026-07-30
> **From:** backend
> **Backend status:** ✅ all three contracts implemented, tested, deployed, live-verified
> **Companion docs:** `UI_HANDOFF_rbac_and_exports_2026-07-29.md` (API reference),
> `UI_HANDOFF_notifications_2026-07-30.md` (SSE reference)

Backend work is **finished**. This document is the FE side only: nine items, each with the
exact contract, acceptance criteria, and the reason it matters.

**Base URL:** `https://ems-api.saqibsaeed.cloud/api/v1`
**Test accounts** (tenant `acme-corp-001`, password `Password123!`):
`superadmin@acme.test` · `hr@acme.test` · `aman@acme.test` (MANAGER) · `priya@acme.test` (EMPLOYEE)

---

## Priority 0 — live bug

### FE-1 · Export button leaks to MANAGER and EMPLOYEE

`src/modules/employees/components/EmployeeTable.tsx:387`

```diff
- const canExport = can(user, 'employees:read');
+ const canExport = can(user, 'employees:export');
```

Every role holds `employees:read`, so the button renders for MANAGER and EMPLOYEE today.
Clicking it 403s — no data leaks, but it looks broken. This is Finding A from your own audit;
it went live when the real `permissions[]` started being minted.

**Accept:** log in as `priya@acme.test` → no Export button.

---

## Priority 1 — notifications (nothing works until both land)

### FE-2 · Unblock SSE through the BFF proxy

`src/app/api/[...path]/route.ts` does:

```ts
const responseBody = await backendResponse.arrayBuffer();   // never resolves for SSE
```

`arrayBuffer()` waits for the body to *finish*. An SSE body never finishes, so the request
hangs and the browser receives nothing. Add a stream passthrough **before** that line:

```ts
if (backendResponse.headers.get('content-type')?.includes('text/event-stream')) {
  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',   // stops intermediaries buffering the stream
    },
  });
}
```

⚠️ **Do not remove `arrayBuffer()`** — it is deliberately there to protect binary payslip
PDF and document downloads from UTF-8 corruption. Special-case the stream only.

**Accept:** `curl -N 'http://localhost:3001/api/notifications/stream?token=<jwt>'` emits
`: connected` and stays open.

### FE-3 · Add the EventSource client

Nothing in `ems-frontend` opens the stream today, so real-time is entirely absent.

```ts
// hooks/useNotificationStream.ts
useEffect(() => {
  if (!accessToken) return;
  const es = new EventSource(`/api/notifications/stream?token=${accessToken}`);

  es.addEventListener('notification', (e) => {
    const n = JSON.parse(e.data);          // {id,type,title,message,createdAt,metadata}
    pushToBell(n);
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  });

  // Not a toast — a cache-invalidation hint for dashboard widgets.
  es.addEventListener('analytics_update', () => {
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
  });

  es.onerror = () => { /* EventSource auto-reconnects; only surface if persistent */ };
  return () => es.close();
}, [accessToken]);
```

**Three things to get right:**

1. **`notification` and `analytics_update` are different.** The first feeds the bell; the
   second must only invalidate analytics queries. Toasting it will spam HR on every check-in.
2. **Reconnect on token refresh.** The token is in the URL, so a refreshed token needs the
   stream re-opened — otherwise it dies silently at expiry.
3. **12-hour TTL.** Notifications are swept after 12h. This is a transient bell, not an
   activity feed — use `/audit-logs` if you need a durable history.

**Accept:** two browsers, HR and employee. Employee checks in → the employee's bell updates
within a second (HR's does **not** — see FE-4).

### FE-4 · Build the bell against the real recipient matrix

Recipients differ per event — they are **not** uniform:

| Event | Employee | Manager | HR_ADMIN | SUPER_ADMIN |
|---|:--:|:--:|:--:|:--:|
| `leave_requested` | — | ✅ | ✅ | ✅ |
| `leave_approved` / `leave_denied` | ✅ | — | — | — |
| `leave_withdrawn` | — | ✅ | ✅ | ✅ |
| `attendance_checkin` / `checkout` | ✅ | ✅ | **—** | ✅ |
| `regularization_requested` | — | ✅ | ✅ | ✅ |
| `regularization_approved` / `denied` | ✅ | — | — | — |
| `timesheet_reminder` | ✅ | — | — | — |
| `payslip_published` | ✅ | — | — | — |
| `document_uploaded` | ✅ | — | — | — |

**HR_ADMIN does not receive attendance check-in/out** — they get `analytics_update` instead
(check-in noise would swamp an HR inbox). Don't build an HR bell that expects them.

**Approval outcomes go only to the employee** — a manager who approves leave gets nothing.

`payslip_published` carries `metadata: { payslipId, runId }` — deep-link the bell straight
to the payslip. It is the notification employees actually wait for.

---

## Priority 2 — server-side exports

### FE-5 · Swap client-built CSVs for the server endpoints

Delete the `new Blob([csv])` builders and call these. Columns, order, formatting and
filenames are **identical** — verified byte-for-byte, so nothing changes for users.

| Screen | Replace | With |
|---|---|---|
| Performance → Reviews | `PerformanceScreen.tsx: downloadCSV()` | `GET /performance/export?type=reviews` |
| Performance → Goals | same | `GET /performance/export?type=goals` |
| Assets → Inventory | `AssetsScreen.tsx: handleExport()` | `GET /assets/export` |
| Settings → Billing → Invoices | `BillingInvoicesPanel.tsx: exportCsv()` | `GET /billing/invoices/export` |

All return `text/csv; charset=utf-8` with a `Content-Disposition` filename. Gate the button
on `performance:export`, `assets:export`, `billing:export` respectively.

### FE-6 · Payslip PDF — replace `window.print()`

`PayslipDrawer.tsx` currently opens the browser print dialog. Two real endpoints now exist:

```
GET /payroll/employees/:employeeId/payslips/:payslipId/download?format=pdf
GET /payroll/runs/:runId/payslips/:payslipId/download?format=pdf
```

```ts
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) throw new Error((await res.json()).error.message);
const blob = await res.blob();          // ⚠️ NOT res.json()
```

Returns `application/pdf` with `filename="payslip-priya-sharma-2026-07.pdf"`. The server
honours the tenant's payslip template exactly as the drawer does — section enable + order,
header fields, locale. If a tenant disables Earnings, it's absent from the PDF too.

> **Known cosmetic difference:** amounts render `INR 50,000.00`, not `₹50,000.00`. PDFKit's
> built-in font can't draw `₹`. Tell us if symbol parity matters — we'll embed a Unicode font.

### FE-7 · Standardise employee export

`POST /export/employees` now accepts `ids[]` for bulk selection:

```json
{ "format": "csv", "ids": ["emp_1", "emp_2"] }
```

Omit `ids` for a full export. `GET /employees/export/csv` and `POST /employees/bulk/export`
are **deprecated** — please migrate off both.

---

## Priority 3 — permission-driven UI

### FE-8 · `PermissionsMatrix.tsx` must handle 55 rows

The catalogue grew 14 → 55. Confirm the component renders an arbitrary-length list.
Grouping by the `module:` prefix will read far better than one flat list.

**`PATCH /settings/roles-permissions` — get these right:**

```json
{ "role": "HR_ADMIN", "permissions": ["employees:read", "employees:write"] }
```

| Rule | Behaviour |
|---|---|
| Field is **`role`**, not `roleKey` | `roleKey` → `422 VALIDATION_ERROR` |
| `permissions` must be **non-empty** | `[]` → `422`. **Disable Save at zero selections** |
| `role: "SUPER_ADMIN"` | always `403 CANNOT_LOCK_OUT_SUPER_ADMIN` — hide/disable that row |
| Otherwise | `200`, replaces that role's set wholesale — send the **complete** desired set |

> Changes apply on the user's **next login/refresh** — existing sessions keep their old
> `permissions[]`. Say so in the UI ("applies when the user next signs in") or people will
> think Save didn't work.

### FE-9 · Filter nav by permission, not `memberType`

`AppShell.tsx`'s `NAV_ITEMS` has no role filter — every item renders for every role. Now
that keys are stable, gate on `can(user, key)`:

| Nav item | Key | | Nav item | Key |
|---|---|---|---|---|
| Reports | `reports:read` | | Timesheets | `timesheets:read` |
| Analytics | `analytics:read` | | Payroll (admin) | `payroll:admin` |
| Assets | `assets:manage` | | Payroll (self) | `payroll:self-read` |
| Performance | `performance:read` | | Permissions | `permissions:manage` |
| Recruitment | `recruitment:read` | | Audit logs | `audit:read` |

**Do not hardcode permission counts or key sets.** A live tenant mints fewer keys than the
defaults if an admin has customized anything — always read `permissions[]` from the token.

---

## Two error shapes to distinguish

A **permission** denial names the key:
```json
{ "error": { "code": "FORBIDDEN", "message": "Insufficient permissions for this action",
             "details": { "requiredPermission": "assets:export", "userRole": "EMPLOYEE" } } }
```

An **ownership** denial does not:
```json
{ "error": { "code": "FORBIDDEN", "message": "Access denied", "details": {} } }
```

Branch on `error.details.requiredPermission`: the first is "your role doesn't allow this",
the second is "this isn't your record."

---

## Corrections to your audit — do not build these

**Findings D and F are wrong.** `authorize()` has always had an unconditional SUPER_ADMIN
bypass, so SA was **never** 403'd on `PATCH /settings/tenant`, email-templates, or the
scheduled-reports routes. Verified live: SA gets `200`.

➡️ Do **not** hide the Save button for SUPER_ADMIN. Do **not** add a scheduled-reports
sub-gate. There is no bug to handle.

**Finding G stands** — Performance/Assets employee self-service still doesn't exist on
either side. Don't build against it without a backend ticket.

---

## Checklist

| # | Item | Priority | Est. |
|---|---|---|---|
| FE-1 | `employees:export` key fix | **P0** | 1 line |
| FE-2 | BFF proxy SSE passthrough | **P1** | ~10 lines |
| FE-3 | EventSource client | **P1** | small |
| FE-4 | Bell against recipient matrix | **P1** | small |
| FE-5 | Four CSV exports → server | P2 | small |
| FE-6 | Payslip PDF blob download | P2 | small |
| FE-7 | `ids[]` + drop deprecated pair | P2 | small |
| FE-8 | 55-row matrix + PATCH contract | P3 | medium |
| FE-9 | Permission-based nav filtering | P3 | medium |

FE-2 and FE-3 are a pair — neither delivers anything alone.

---

## Open questions for you

1. **Payslip currency symbol** — is `INR 50,000.00` fine, or embed a font for `₹`?
2. **AUDITOR analytics** — `analytics:read` is now genuinely enforced and AUDITOR holds it.
   Widen the `/analytics` RoleGate to include them?
3. **More notification events?** Payroll run published and document uploaded now exist.
   Resignations emit nothing because that module has no routes yet.
4. **Horizontal scaling planned?** Redis SSE fan-out is already in and verified, so you're
   covered either way — just confirms whether it gets exercised.

Ping us on anything ambiguous — every endpoint here is live and testable with the accounts
at the top.
