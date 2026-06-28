# Backend issues to file — from the full-app QA regression (2026-06-28)

> Ready-to-paste GitHub issues for the **backend** repo
> (`saeedafri/Employee-management-system`). Three backend-owned findings from the live regression.
> Each block = the **title** (first line) + **body** (paste below it). Frontend is innocent in all three.

---

## Issue 1 — 🔴 Leave request submission 404s on policy-pack tenants (LEAVE_TYPE_NOT_FOUND)

**Title:** `POST /leave/requests rejects policy-derived leave types (LEAVE_TYPE_NOT_FOUND) — employees can't submit leave on policy-pack tenants`

**Body:**

### Summary

On any tenant set up with leave **policy packs** (the recommended path — `POST /leave/policy-packs/seed`

- auto-assign, no legacy `LeaveType` rows), **every** leave-request submission fails with
  `404 LEAVE_TYPE_NOT_FOUND`. This also blocks the entire downstream leave-approval flow (no PENDING
  request can ever be created).

### Steps to reproduce (live)

1. Seed a tenant via `POST /leave/policy-packs/seed { country: 'IN' }` and `POST /leave/assignments/auto-assign`.
2. As an employee, `GET /leave/types` → returns `[{ id: "EL", code: "EL", ... }, ...]` (policy-derived, `id === code`).
3. `GET /leave/balance` → returns balances keyed by the same `leaveTypeId: "EL"` (e.g. SL/CL show 12/12).
4. `POST /leave/requests { leaveTypeId: "EL", startDate, endDate, reason }` → **`404 { error.code: "LEAVE_TYPE_NOT_FOUND" }`**.
   - `GET /leave/requests/preview?leaveTypeId=EL...` 404s the same way.

### Root cause (code)

`GET /leave/types` was migrated to serve **policy-derived** types with `id === code` (see the route's own
doc string in `src/modules/leave/leave.routes.js` — "returns types with id===code … derived from active
policies, so the self-service balance↔type join resolves").

But `POST /leave/requests` was **not** migrated alongside it:

- `src/modules/leave/leave.service.js:118` — `createLeaveRequest()` calls
  `leaveRepository.getLeaveType(tenantId, leaveTypeId)`; null → throws `LEAVE_TYPE_NOT_FOUND` (`:120`).
- `src/modules/leave/leave.repository.js:165` — `getLeaveType()` is
  `prisma.leaveType.findFirst({ where: { id: leaveTypeId, tenantId } })` — a lookup against the **legacy
  DB `LeaveType` table by id**. A policy tenant has no legacy row with id `"EL"`, so it returns null.

The two id-spaces are **disjoint when policies exist**: `POST /leave/types` (now deprecated) is the only
thing that creates legacy rows, and those "do NOT appear in `GET /leave/types` once policies exist." So
**no single `leaveTypeId` both appears in the dropdown and is accepted by create.**

### Expected

Submitting leave for a type that appears in `GET /leave/types` (and has a balance) should succeed.

### Suggested fix

Resolve policy-derived types in the **create** and **preview** paths the same way `GET /leave/types`
does (reuse `leaveEngineService.getLeaveTypesFromPolicies` / resolve by `code` against active policies),
falling back to the legacy `LeaveType` table only when no policy match exists. Apply to both
`createLeaveRequest` and the `/leave/requests/preview` handler.

### Impact

🔴 Blocks employee self-service leave entirely on policy-pack tenants, and transitively all
manager/HR leave approval. Frontend sends exactly what `GET /leave/types` offers — no FE change needed.

---

## Issue 2 — 🔴 Non-SUPER_ADMIN roles get `permissions: []` from `/auth/me` (HR/MANAGER/EMPLOYEE/AUDITOR)

**Title:** `/auth/me returns empty permissions for all non-SUPER_ADMIN roles — HR/Auditor functionally locked out of core features`

**Body:**

### Summary

Live `/auth/me` returns **`permissions: []` for every role except `SUPER_ADMIN`** — confirmed for
**HR_ADMIN, MANAGER, EMPLOYEE, and AUDITOR** (all empty). Only `SUPER_ADMIN` has a populated array
(14 entries: `employees:write/delete/export`, `departments:write`, `attendance:write`, `audit:read`,
`analytics:read`, …). The frontend gates permission-sensitive UI on this array, so **every
permission-gated feature becomes SUPER_ADMIN-only**, even where the role clearly should have access.

### Observed consequences (live)

- **HR_ADMIN** cannot create/edit employees or departments — `/employees/new` shows "Access restricted";
  the Add-Department control is hidden. (HR's entire job.)
- **AUDITOR** cannot open the audit-log viewer (it's gated on `audit:read`) even though
  `GET /audit-logs` returns **200** for them. (The auditor's entire job.)
- Reads that work for these roles do so via role-based server checks, not the permissions array.

### Steps to reproduce

1. Create a fresh tenant; invite an HR_ADMIN and an AUDITOR.
2. Log in as each → `GET /auth/me` → `data.permissions` is `[]`.
3. Compare with a SUPER_ADMIN → `data.permissions` has 14 entries.

### Question / suggested fix

Is this intended (permissions only populated once configured via the Permissions matrix), or should the
backend **seed sensible default permission sets per role** on tenant creation? Either way, the
out-of-box state makes HR_ADMIN and AUDITOR non-functional for their primary duties. Recommended:

- Seed default role→permission mappings on tenant/role creation, e.g.
  - `HR_ADMIN`: `employees:read/write/delete`, `departments:read/write`, `attendance:read/write`,
    `leave:*`, `analytics:read`, `audit:read` (per product intent).
  - `AUDITOR`: read scopes incl. **`audit:read`**.
  - `MANAGER` / `EMPLOYEE`: their read scopes.
- And/or ensure the Permissions matrix is the single source and document that it must be configured.

### Impact

🔴 Systemic — single highest-leverage backend fix; unblocks HR and Auditor at once and removes a large
share of the frontend's role-inappropriate-call console noise. (FE can also add a role-implied fallback
in `can()`, but the empty-permissions response is the root cause.)

---

## Issue 3 — 🟠 Semi-monthly payroll over-deducts flat (non-prorated) statutory each half-cycle

**Title:** `Semi-monthly payroll charges flat non-prorated statutory (e.g. Professional Tax) in both half-cycles — net pay off by one PT per month`

**Body:**

### Summary

On a **semi-monthly** pay schedule, a salary component that is **flat and non-prorated**
(`prorate: false`, e.g. Professional Tax) is deducted **in full in each half-cycle** (H1 and H2),
instead of once across the month. Net pay ends up short by **one extra flat statutory amount per
month**. (Follow-up to the earlier semi-monthly pay-doubling fix `de5e5a6`, which fixed earnings/%
components but left this residual on flat non-prorated deductions.)

### Steps to reproduce (live)

1. Configure a tenant with a semi-monthly pay calendar (two cycles/month) and a salary structure
   containing a flat, **non-prorated** deduction (e.g. `Professional Tax`, `prorate: false`, fixed amount).
2. Run both half-cycle runs (H1 then H2) for the same month.
3. Compare the sum of components across H1 + H2 to the equivalent **monthly** run:
   - Earnings and %/formula deductions: **H1 + H2 == monthly** ✅ (correct).
   - Flat non-prorated deduction: charged its **full amount in BOTH** H1 and H2 → **2× the monthly
     amount** ❌.

### Expected

A flat, non-prorated statutory item should total the **monthly** amount across the cycles — i.e. charged
once per month (in one cycle, or split), not in full per half.

### Suggested fix

In the semi-monthly cycle compute, treat `prorate: false` flat statutory components as **month-level**
(allocate once across the month's cycles) rather than re-applying the full flat amount per cycle. Keep
the configuration-driven approach — no `country ===` branches; key off the component's `prorate` flag and
`statutoryTag`.

### Impact

🟠 Incorrect net pay on every semi-monthly run that includes a flat non-prorated statutory deduction.
Config-driven engine fix; no per-country code.

---

_Reference: full findings + evidence in the frontend repo at `docs/testing/REGRESSION_REPORT.md`
(executive summary + master table). These three are the only backend-owned items; the rest are frontend._
