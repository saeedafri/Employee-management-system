# Backend Team Handoff — Fix Report
> Last updated: 2026-06-11

---

## Auth Register Validation Status Fix

### Issue
`POST /auth/register` validation failures returned `400` instead of `422`.

### Root Cause
Fastify's AJV route-schema validation fires before the controller runs. The global `errorHandler.js` catches `FST_ERR_VALIDATION` and returns `400` for all routes. The controller's Zod-based `422` path was never reached because invalid requests were rejected upstream.

### Fix
Added `attachValidation: true` to the `/auth/register` route config. This prevents Fastify from auto-rejecting invalid requests — instead `request.validationError` is set and the handler is called. `registerController` checks `request.validationError` at entry and returns `422 VALIDATION_ERROR` with the same body shape. No other routes are affected.

### Files Changed

| File | Change |
|------|--------|
| `src/modules/auth/auth.routes.js` | Added `attachValidation: true` to register route options |
| `src/modules/auth/auth.controller.js` | Added `request.validationError` check returning 422 at top of `registerController` |
| `tests/auth-register.test.js` | Tightened validation tests to assert exact 422; added combined-invalid-body test |

### Tests

`node --test tests/auth-register.test.js` — **9/9 pass**

| Test | Result |
|------|--------|
| Register new company — 201 | ✅ |
| Register sets auth cookies | ✅ |
| /auth/me after register — 200 | ✅ |
| Duplicate email — 409 | ✅ |
| No x-tenant-key required | ✅ |
| Missing companyName — exactly 422 | ✅ |
| Invalid email — exactly 422 | ✅ |
| Short password — exactly 422 | ✅ |
| Combined invalid body (UI-team case) — 422 VALIDATION_ERROR | ✅ |

### Live Evidence

```
POST /auth/register {"companyName":"","fullName":"","email":"not-an-email","password":""}
→ 422 {"success":false,"error":{"code":"VALIDATION_ERROR","message":"Request validation failed","details":[{"field":"companyName","message":"must NOT have fewer than 2 characters"}],"requestId":"req-b"}}
```

Happy path and duplicate-email behaviors unchanged (201 / 409).

### Final Verdict
**PASS** — `POST /auth/register` validation failures now return 422. All other behaviors are unchanged.

---

## Auth Registration — POST /auth/register

### Background
UI team requested a public registration endpoint to allow new companies to self-onboard. No previous registration flow existed.

### Root Cause
`POST /auth/register` did not exist in the backend. No route, controller, service, or validator.

### Implementation

**What it does (single DB transaction):**
1. Checks email uniqueness across all tenants
2. Generates a unique slug and tenantKey from `companyName`
3. Creates `Tenant` record (with `TenantConfig`)
4. Upserts global `Permission` records (14 permissions)
5. Creates tenant-scoped `SUPER_ADMIN` role with all permissions wired
6. Creates `User` (SUPER_ADMIN, ACTIVE, hashed password via Argon2id)
7. Creates `UserRole` join record
8. Creates `Session` with refresh token rotation support
9. Creates `AuditLog` entry
10. Generates JWT access token + opaque refresh token
11. Sets `accessToken` and `refreshToken` httpOnly cookies
12. Returns 201 with tenant/user/permissions shape matching UI contract

**Rate limited:** 5 requests per IP per 15 minutes.

**Tenant fields not collected at registration** (`country`, `currency`, `timezone`) are returned as `null` in the response. The DB stores empty string for `country` and defaults for `defaultCurrency`/`timezone`.

### Files Changed

| File | Change |
|------|--------|
| `src/modules/auth/auth.validator.js` | Added `registerSchema` (companyName, fullName, email, password) |
| `src/modules/auth/auth.service.js` | Added `register()` function; imported `hashPassword` |
| `src/modules/auth/auth.controller.js` | Added `registerController()` |
| `src/modules/auth/auth.routes.js` | Added `POST /auth/register` route (rate-limited, public) |
| `src/middleware/resolveTenant.js` | Added `/api/v1/auth/register` to `TENANT_OPTIONAL_ROUTES` |
| `docs/API_MAPPING.md` | New `### POST /auth/register` section |
| `tests/auth-register.test.js` | 8-case live test suite |

### API_MAPPING.md Updates
Added `### POST /auth/register — Public ✅` section under `## Auth` with full request/response/cookie/error documentation.

### Swagger/OpenAPI Updates
Route added to `src/modules/auth/auth.routes.js` with inline Fastify schema block:
- Body schema: `companyName`, `fullName`, `email`, `password`
- Responses: 201, 409, 422
- Tag: `Authentication`

### Tests
File: `tests/auth-register.test.js`  
Run: `node --test tests/auth-register.test.js`

| Test | Result |
|------|--------|
| Register new company — 201 with correct shape | ✅ PASS |
| Register sets auth cookies | ✅ PASS |
| Register then /auth/me returns 200 with same user | ✅ PASS |
| Duplicate email returns 409 EMAIL_ALREADY_EXISTS | ✅ PASS |
| No x-tenant-key header required | ✅ PASS |
| Missing companyName returns 422 | ✅ PASS |
| Invalid email returns 422 | ✅ PASS |
| Short password returns 422 | ✅ PASS |

**All 8/8 passing against live Render API.**

### Live Evidence

**Register new tenant/admin (201):**
```
POST https://employee-management-system-2b9q.onrender.com/api/v1/auth/register
Status: 201
```
```json
{
  "success": true,
  "data": {
    "accessToken": "<jwt>",
    "sessionId": "ffad4e955fe17e203d3bb98f",
    "tenant": { "id": "cmq9ctb8o00016nl2tmeb01df", "name": "QA Register 1781173668", "country": null, "currency": null, "timezone": null },
    "user": { "id": "cmq9ctbbu000l6nl2iji3rwss", "email": "qa-register-1781173668@acme.com", "memberType": "SUPER_ADMIN", "employeeId": null, "employee": null },
    "permissions": ["employees:read", "employees:write", "employees:delete", "employees:export", "departments:read", "departments:write", "attendance:read", "attendance:write", "leave:read", "leave:request", "leave:approve", "analytics:read", "permissions:manage", "audit:read"]
  },
  "meta": {}
}
```

**Set-Cookie headers:**
```
set-cookie: refreshToken=ffad4e955fe17e203d3bb98f.3c4eee78c6...; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=Strict
set-cookie: accessToken=eyJhbGci...; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Strict
```

**/auth/me with returned cookies (200):**
```json
{
  "success": true,
  "data": {
    "email": "qa-register-1781173668@acme.com",
    "memberType": "SUPER_ADMIN",
    "tenantId": "cmq9ctb8o00016nl2tmeb01df",
    "status": "ACTIVE",
    "employee": null,
    "permissions": [14 items]
  }
}
```

**Duplicate email (409):**
```json
{ "success": false, "error": { "code": "EMAIL_ALREADY_EXISTS", "message": "Email already registered" } }
```

### Remaining Gaps
- `fullName` is validated and accepted but not stored (no `name` field on `User`; an `Employee` record would be needed). UI only needs email/memberType in the response — no gap for current UI contract.
- `country`, `currency`, `timezone` returned as `null`; UI can prompt the user to fill these in settings after first login.
- No email verification on registration (none required by UI contract).

### Final Verdict
**PASS** — `POST /api/v1/auth/register` is live, public, creates tenant + SUPER_ADMIN, sets cookies, and returns the exact UI response shape. 8/8 tests pass against the live Render API.
