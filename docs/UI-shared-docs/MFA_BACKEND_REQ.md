# Backend Request — expose `mfaEnabled` on read (unblocks self-service MFA toggle)

> **Status:** OPEN — backend work required (one small change).
> **Owner of this doc:** Frontend (EMS). **Implementer:** Backend.
> **Verified against:** deployed source `upstream/main` (saeedafri) + live API
> `https://ems-api.saqibsaeed.cloud/api/v1`, reversible authenticated probe on **2026-06-27**.
> **Relation:** follow-up to `docs/auth/MFA_POLICY_ENFORCEMENT_CONTRACT.md` (✅ resolved).
> The login-enforcement bug is fixed; this is the **last small gap** before the FE can ship
> the self-service "enable MFA for my account" toggle (`docs/auth/FUTURE_IMPLEMENTATION.md`
> §2A).

---

## 1. TL;DR — the one thing to build

**Expose the authenticated user's current `mfaEnabled` value on a read endpoint.**

The **write** already works (`PATCH /auth/me/mfa`), but there is **no way to read it back**,
so the FE cannot render the toggle in its correct on/off position when the page loads.

**Preferred fix (smallest):** add `mfaEnabled: boolean` to the `GET /auth/me` response
`data` object.
**Alternative:** ship a dedicated `GET /auth/me/mfa` → `{ success, data: { mfaEnabled } }`.

Either one unblocks the FE. The preferred fix is one field on an endpoint the app already
calls on every boot — no extra round-trip.

---

## 2. The gap — exactly what's wrong today (with live evidence)

| #   | Fact                                             | Evidence (live prod, 2026-06-27)                                                                                                                                |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The **write** endpoint works and is reversible.  | `PATCH /auth/me/mfa` `{ "enabled": true }` → `200 {"success":true,"data":{"mfaEnabled":true},"meta":{}}`; `{ "enabled": false }` → `200 {…"mfaEnabled":false}`. |
| 2   | `GET /auth/me` does **not** return `mfaEnabled`. | `data` keys are exactly: `id, email, memberType, tenantId, employeeId, status, employee, permissions, lastLoginAt`. No `mfaEnabled` anywhere in the payload.    |
| 3   | There is **no** `GET /auth/me/mfa` route.        | Only `fastify.patch('/auth/me/mfa', …)` exists (`auth.routes.js:100`). No GET counterpart.                                                                      |
| 4   | The login response also doesn't carry it.        | `POST /auth/login` `data.user` carries `id/email/memberType/employeeId/employee`; no `mfaEnabled`.                                                              |

**Net effect:** the FE can let a user turn MFA on/off, but on the next page load it cannot
tell whether it's currently on — so it cannot render a correct toggle. The feature is
write-blind without this read.

---

## 3. What to build

### Option A (preferred) — add one field to `GET /auth/me`

Include the authenticated user's `mfaEnabled` in the existing response `data`:

```jsonc
// GET /auth/me  →  200
{
  "success": true,
  "data": {
    "id": "…",
    "email": "…",
    "memberType": "HR_ADMIN",
    "tenantId": "…",
    "employeeId": "…",
    "status": "ACTIVE",
    "employee": {
      /* … unchanged … */
    },
    "permissions": ["…"],
    "lastLoginAt": "2026-06-27T…Z",
    "mfaEnabled": false, // ← NEW: the per-user opt-in flag (user.mfaEnabled)
  },
  "meta": {},
}
```

- Type: `boolean`, never null. Default `false` for users who have never opted in.
- This is the same field `PATCH /auth/me/mfa` already writes and echoes back — just surface
  it on read too.

### Option B (alternative) — dedicated read endpoint

```
GET /auth/me/mfa   →   200
{ "success": true, "data": { "mfaEnabled": false }, "meta": {} }
```

- Auth: same as `PATCH /auth/me/mfa` (authenticated user, reads own flag).
- `401` when unauthenticated (consistent with the existing PATCH).

**We prefer Option A** — `/auth/me` is already fetched on every app boot, so no new request
and no new hook are needed; the toggle reads the flag straight from the cached `me` query.

---

## 4. Acceptance criteria

- [ ] After `PATCH /auth/me/mfa { enabled: true }`, a subsequent read (`GET /auth/me`
      under Option A, or `GET /auth/me/mfa` under Option B) returns `mfaEnabled: true` for
      that same user.
- [ ] After `{ enabled: false }`, the read returns `mfaEnabled: false`.
- [ ] The value is **per-user** (reflects the caller's own `user.mfaEnabled`), not a tenant
      or policy value. It is independent of `mfa_policy` — a user under
      `mfa_policy: REQUIRED_ALL` may still have `mfaEnabled: false` (they're forced by policy,
      not by their own opt-in).
- [ ] `boolean`, never `null`/absent for an authenticated user; defaults `false`.
- [ ] No change to the existing `PATCH /auth/me/mfa` write contract.

---

## 5. Why the FE needs it (consuming surface)

`docs/auth/FUTURE_IMPLEMENTATION.md` §2A — the self-service MFA toggle. The FE will:

1. Read `mfaEnabled` (from the extended `/auth/me`, or `GET /auth/me/mfa`) to set the
   `Switch`'s initial position.
2. On toggle, call `PATCH /auth/me/mfa { enabled }` and invalidate the `auth/me` query.
3. Render the switch **on + disabled** ("Required by your organization") when the tenant
   `mfa_policy` already forces the user (`REQUIRED_ALL`, or `REQUIRED_ADMINS` for
   admin member types).

Until this read lands, the FE feature-detects on the presence of `mfaEnabled` and **hides**
the toggle when absent (never renders a write-blind switch), so shipping the backend field
is what turns the feature on — no FE redeploy gymnastics.

---

## 6. Notes

- **Verify on the deployed remote, not local.** The MFA enforcement fix lives only in
  `upstream/main` (`3800d42`); local/`origin` main of the backend repo is stale. Confirm any
  change against `upstream/main` + the live API.
- Field casing: `mfaEnabled` (camelCase) to match the existing `PATCH` echo and the rest of
  the `/auth/me` payload.
- **FE consuming surface is already built (2026-06-27)** and ships dark — adding `mfaEnabled`
  to `/auth/me` is all that's needed to light it up; no FE redeploy gymnastics.
- The optional **`mfaRequiredByPolicy`** follow-up (forced-state label) is now specified in
  full in **§7** below — build-ready, but **not** a blocker for the toggle.

---

## 7. Optional follow-up — `mfaRequiredByPolicy` on `/auth/me` (forced-state label)

> **Priority:** OPTIONAL / nice-to-have. **Not required** for the self-service toggle to
> work — ship §3 (`mfaEnabled`) first; this only improves presentation. Build it only when
> the forced-state UX is wanted.

### 7.1 Why

A user is challenged for MFA at login if **either** their personal opt-in (`mfaEnabled`) **or**
the tenant **policy** (`mfa_policy`) requires it. The toggle reflects only the _personal_
opt-in. When the **policy** already forces a user, the ideal UX renders the switch **on +
disabled** with "Required by your organization" instead of an editable control.

The FE **cannot compute this itself**: `mfa_policy` is readable only via the
**SUPER_ADMIN-only** `GET /settings/security/auth`, so a normal EMPLOYEE/MANAGER (the toggle's
main audience) gets `403` and has no way to know the policy. The backend already knows both
the policy and the caller's `memberType`, so it should compute the **effective** answer and
return it as one boolean.

### 7.2 What to build

Add `mfaRequiredByPolicy: boolean` to the **same** `GET /auth/me` `data` object (alongside
`mfaEnabled` from §3):

```jsonc
// GET /auth/me  →  200  (data, abbreviated)
{
  "data": {
    "memberType": "HR_ADMIN",
    "mfaEnabled": false, // §3 — the user's own opt-in
    "mfaRequiredByPolicy": true, // ← NEW: does the TENANT POLICY force MFA on THIS user?
  },
}
```

Server-side derivation (mirrors the login gate `policyRequiresMfa(mfa_policy, user)` already
in `auth.service.js`):

| `mfa_policy`      | `mfaRequiredByPolicy` for the caller                              |
| ----------------- | ----------------------------------------------------------------- |
| `REQUIRED_ALL`    | `true` for every user                                             |
| `REQUIRED_ADMINS` | `true` iff `memberType ∈ { SUPER_ADMIN, HR_ADMIN }`, else `false` |
| `OPTIONAL`        | `false` for everyone                                              |

> It is the **policy-only** verdict for this user — it does **not** fold in the personal
> `mfaEnabled`. (Effective "is the user challenged at login" = `mfaEnabled || mfaRequiredByPolicy`;
> the FE composes that itself.)

### 7.3 Acceptance criteria

- [ ] `GET /auth/me` `data.mfaRequiredByPolicy` is a `boolean`, never null/absent for an
      authenticated user.
- [ ] Reflects the **tenant policy applied to the caller's `memberType`** per the table above —
      independent of the caller's personal `mfaEnabled`.
- [ ] A non-admin caller never needs to read `GET /settings/security/auth` to learn this.
- [ ] Reuses the existing `policyRequiresMfa(mfa_policy, user)` logic (no second source of truth
      for the policy rule).
- [ ] No change to `mfaEnabled` (§3) or the `PATCH /auth/me/mfa` write (§1).

### 7.4 FE behavior once shipped

The toggle renders **on + disabled** with helper text "Required by your organization" when
`mfaRequiredByPolicy === true` (regardless of `mfaEnabled`); otherwise it stays the normal
editable per-user switch driven by `mfaEnabled`. Until this field ships, the toggle simply
shows the personal `mfaEnabled` state — correct behavior, just without the forced-state label.
