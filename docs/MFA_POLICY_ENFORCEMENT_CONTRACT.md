# Backend Contract — MFA Policy enforcement at login

> **Status: ✅ DONE — 2026-06-25.** `login()` and `adminLogin()` now read the tenant
> `mfa_policy` and require MFA when policy OR the per-user opt-in says so. The §6 self-service
> toggle (`PATCH /auth/me/mfa`) is also shipped, so `OPTIONAL` is meaningful. All §9 acceptance
> cases verified (11/11) on a local backend against the live DB and re-verified on live Hostinger.
> **§7 decisions (resolved):** admin cohort for `REQUIRED_ADMINS` = `SUPER_ADMIN` + `HR_ADMIN`
> only (MANAGER/AUDITOR excluded); signal = `user.memberType`.
>
> **Implementation (contract → code):**
> - §3.1/§3.2 → `auth.service.js`: `policyRequiresMfa(policy, user)` (PURE, exported) + the gate
>   `user.mfaEnabled || policyRequiresMfa(mfaPolicy, user)` reading `getAuthSettings(tenantId)`.
> - §3.4 → same gate added to `adminLogin()`; `adminLoginController` now early-returns the `202`.
> - §4 → 202 shape unchanged `{ mfaRequired, challengeId, destinationMasked, expiresIn }`.
> - §6 → `setOwnMfa()` + `PATCH /auth/me/mfa { enabled }` (the only writer of `user.mfaEnabled`).
> - Test: `tests/mfa-policy.test.js` (predicate, 4/4). Swagger + API_MAPPING synced.
> - OTP/initiate/verify-otp untouched (§8).
>
> **Owner of this doc:** Frontend (EMS). **Implementer:** Backend.
> **Frontend is already done and correct** — the FE was not changed.

---

## 1. TL;DR — the one thing to build

`login()` must **read the tenant's `mfa_policy` and require MFA when the policy says so** —
not only when the per-user `mfaEnabled` flag is set. Right now the policy is stored but
**no code reads it**, so the Settings → Security → Authentication → **MFA Policy** dropdown
is a no-op: a SUPER_ADMIN can set "Required for everyone" and **nobody gets prompted**.

One small change in `src/modules/auth/auth.service.js` closes the gap. Everything else
(the OTP challenge flow, the `202` response, `otp/initiate`, `verify-otp`) already works.

---

## 2. The gap — exactly what's wrong today (with evidence)

| # | Fact | Evidence (deployed `upstream/main`) |
|---|------|-------------------------------------|
| 1 | The FE saves the policy and it **persists**. | `PATCH /settings/security/auth` → `settings.repository.js` `updateAuthSettings()` upserts the blob under `(tenantId,'security','auth')`. Live `GET /settings/security/auth` returns `"mfa_policy":"OPTIONAL"`. |
| 2 | Login gates MFA **only on the per-user flag**, never on the policy. | `auth.service.js:58` → `if (user.mfaEnabled) { … }`. There is **no** read of `mfa_policy` in the login path. |
| 3 | `mfa_policy` is **consumed by nothing**. | Repo-wide grep: `mfa_policy` appears in exactly **one** place — its own default in `settings.repository.js` (`DEFAULT_AUTH_SETTINGS.mfa_policy = 'OPTIONAL'`). Nothing else references it. |
| 4 | `user.mfaEnabled` is **never written by any code path**. | Repo-wide grep for any assignment to `mfaEnabled` across `src/**` returns **empty** (only `select:`/`include` reads exist). So no app action — including saving the policy — can ever make a user MFA-required. Only a manual DB edit can. |
| 5 | Saving the policy does **not** write-through to users. | `updateAuthSettings()` only upserts the settings blob; it does not touch any `user.mfaEnabled`. (Contrast: `updateAttendanceRules()` *does* write-through to `TenantConfig.workWeekDays` — that pattern exists, MFA just lacks it.) |

**Net effect:** the MFA Policy control looks functional (the save succeeds, the value comes
back on reload) but has **zero behavioral effect**. This is a false "done."

---

## 3. What to build

### 3.1 Read the policy in `login()` and compute one boolean

`src/modules/auth/auth.service.js`, function `login(db, tenantId, email, password, ipAddress, userAgent)`
(currently line ~56). Today:

```js
const user = await validateLogin(db, tenantId, email, password);

if (user.mfaEnabled) {                          // ← per-user flag ONLY
  const otpResult = await otpService.generateOtp(tenantId, user.id, user.email, 'LOGIN', 'EMAIL');
  // … audit … return { mfaRequired: true, challengeId, destinationMasked, expiresIn };
}
```

Change to: read the tenant policy, OR it with the per-user opt-in, and branch on the result.

```js
import { getAuthSettings } from '../settings/settings.repository.js'; // or the service equivalent

const user = await validateLogin(db, tenantId, email, password);

const { mfa_policy } = await getAuthSettings(tenantId);   // 'OPTIONAL' | 'REQUIRED_ADMINS' | 'REQUIRED_ALL'
const mfaRequired = user.mfaEnabled || policyRequiresMfa(mfa_policy, user);

if (mfaRequired) {
  const otpResult = await otpService.generateOtp(tenantId, user.id, user.email, 'LOGIN', 'EMAIL');
  // … existing audit + the SAME return shape, unchanged …
  return {
    mfaRequired: true,
    challengeId: otpResult.challengeId,
    destinationMasked: otpResult.destinationMasked,
    expiresIn: otpResult.expiresIn,
  };
}
```

### 3.2 The policy predicate

```js
// Admin = the cohort targeted by "Required for admins".
// Decision needed (see §7): default is SUPER_ADMIN + HR_ADMIN only.
const ADMIN_MEMBER_TYPES = new Set(['SUPER_ADMIN', 'HR_ADMIN']);

function policyRequiresMfa(policy, user) {
  switch (policy) {
    case 'REQUIRED_ALL':    return true;
    case 'REQUIRED_ADMINS': return ADMIN_MEMBER_TYPES.has(user.memberType);
    case 'OPTIONAL':        return false;   // per-user opt-in still applies via the OR above
    default:                return false;
  }
}
```

`user.memberType` is available — `findUserByEmail` (`auth.repository.js:5`) uses `include`,
so all `User` scalars (incl. `memberType` and `mfaEnabled`) are loaded. If you prefer
role-based over `memberType`, the roles are in `user.userRoles[].role.name`.

### 3.3 Policy semantics (must match the FE's three values exactly)

The FE sends one of these three strings (from `AuthSettingsPanel.tsx` `MFA_OPTIONS`):

| `mfa_policy` value | FE label | Required for… |
|--------------------|----------|---------------|
| `OPTIONAL`         | "Optional — users choose"     | only users with `mfaEnabled = true` (per-user opt-in) |
| `REQUIRED_ADMINS`  | "Required for admins"         | admins (default: `SUPER_ADMIN`, `HR_ADMIN`) **plus** any per-user opt-in |
| `REQUIRED_ALL`     | "Required for everyone"       | every user, regardless of role or per-user flag |

Use these literals verbatim. Do not invent new values or rename them.

### 3.4 Apply the same gate to admin login

`/auth/admin/login` → `adminLoginController` (`auth.controller.js:110`) → `authService.adminLogin(...)`
currently has **no MFA branch** — it sets cookies directly. Under `REQUIRED_ADMINS` /
`REQUIRED_ALL`, admins logging in there must also be challenged. Add the same
`mfaRequired` computation + `202` early-return to `adminLogin()`.

---

## 4. The `202` response — keep it EXACTLY as-is

When MFA is required, keep returning the current shape (the FE depends on `challengeId`):

```jsonc
// HTTP 202
{
  "mfaRequired": true,
  "challengeId": "…",
  "destinationMasked": "h*****r@acme.test",
  "expiresIn": 600
}
```

**Do not** add, rename, or remove fields here (e.g. do not add a `deliveryMethod` field).
The FE reads `challengeId` to route to the OTP screen; the rest is informational. The
downstream `POST /auth/otp/initiate` and `POST /auth/verify-otp` are already live and
shape-matched — **do not touch them.**

---

## 5. Why policy-driven (not write-through)

Computing `mfaRequired` at login from the policy is **stateless** and is the correct
design:

- **New users** are covered automatically — no backfill needed.
- **Turning the policy off** (`→ OPTIONAL`) takes effect immediately, with no per-user
  cleanup; only explicit per-user opt-ins keep MFA.
- No race between "create user" and "apply policy."

A write-through approach (stamp `mfaEnabled` on a cohort when the setting is saved) is
**not** wanted: it's racy, leaves stale flags, and misses users created after the save.

---

## 6. Secondary gap (optional, lower priority) — make "Optional — users choose" real

Under `OPTIONAL`, a user is supposed to be able to **turn MFA on for themselves** — but
there is **no endpoint that writes `user.mfaEnabled`** (see §2 fact 4). So today
`OPTIONAL` effectively means "off for everyone." If you want "Optional — users choose" to
be meaningful, add a self-service toggle, e.g.:

- `PATCH /auth/me/mfa` body `{ "enabled": true|false }` → sets `mfaEnabled` on the
  authenticated user; returns `{ success, data: { mfaEnabled }, meta }`.

This is independent of §3 and can ship later. §3 alone fully delivers
`REQUIRED_ADMINS` / `REQUIRED_ALL`, which is what the SUPER_ADMIN control is for.

---

## 7. Open decisions to confirm with us

1. **Who counts as "admin" for `REQUIRED_ADMINS`?** Default in this contract:
   `SUPER_ADMIN` + `HR_ADMIN`. Should `MANAGER` and/or `AUDITOR` be included? (We assume
   **no**.)
2. **`memberType` vs role-name** as the admin signal — either works; pick whichever is
   authoritative on your side and tell us.

---

## 8. Out of scope / do NOT change

- The FE — it already sends `mfa_policy` correctly and routes the `202` correctly.
- `POST /auth/otp/initiate`, `POST /auth/verify-otp`, `POST /auth/resend-otp` — live and
  shape-matched; leave them.
- The `202` response shape (§4).
- The OTP delivery mechanism itself. **Note:** MFA cannot *complete* unless the OTP email
  is actually delivered (the email-sender / job-queue config — the same standing
  dependency as the invitation flow). Enforcing the policy (§3) is necessary but a working
  end-to-end MFA login also needs OTP emails to send. Please confirm OTP email delivery is
  configured in the target environment (or provide a non-prod way to read the code).

---

## 9. Acceptance criteria (live-verifiable)

With a SUPER_ADMIN session, `PATCH /settings/security/auth` to set each `mfa_policy`, then
attempt logins and assert the HTTP status. (Restore `OPTIONAL` afterwards.)

| # | `mfa_policy` | Login as | Expected |
|---|--------------|----------|----------|
| 1 | `REQUIRED_ALL`    | any user (e.g. `priya@acme.test`, EMPLOYEE) | **202** `mfaRequired:true` |
| 2 | `REQUIRED_ADMINS` | `hr@acme.test` (HR_ADMIN)   | **202** |
| 3 | `REQUIRED_ADMINS` | `superadmin@acme.test`      | **202** |
| 4 | `REQUIRED_ADMINS` | `priya@acme.test` (EMPLOYEE)| **200** (cookies set, no MFA) |
| 5 | `OPTIONAL` + user `mfaEnabled=false` | any | **200** (current behavior preserved) |
| 6 | `OPTIONAL` + user `mfaEnabled=true`  | that user | **202** (per-user opt-in preserved) |
| 7 | any of the above `202` cases | — | response is exactly `{ mfaRequired, challengeId, destinationMasked, expiresIn }`, and the resulting `challengeId` works against `POST /auth/otp/initiate` + `POST /auth/verify-otp` |

> Today, **every one of cases 1–4 returns `200`** — that's the bug this contract fixes.

---

## 10. File anchors (so you don't have to dig)

- `src/modules/auth/auth.service.js` — `login()` ~L56, MFA branch L58; `adminLogin()` (add gate); `completeMfaLogin()` L224 (unchanged).
- `src/modules/auth/auth.controller.js` — `loginController` L61 (202 branch L82), `adminLoginController` L110.
- `src/modules/auth/auth.repository.js` — `findUserByEmail` L1 (uses `include`; all `User` scalars present).
- `src/modules/settings/settings.repository.js` — `DEFAULT_AUTH_SETTINGS` / `getAuthSettings` / `updateAuthSettings` (the `mfa_policy` store).
- `src/modules/auth/otp.service.js` — `generateOtp` (already sends OTP at login), `initiateOtp` L325, `verifyOtp` L95 — **all unchanged.**
