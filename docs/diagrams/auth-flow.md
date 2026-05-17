# Authentication Flow

## Login Sequence

```
Client                         Server
  │                              │
  ├─ POST /auth/login ──────────>│
  │  {email, password}           │
  │                              ├─ Find User
  │                              ├─ Verify password (Argon2id)
  │                              ├─ Generate Session
  │                              ├─ Generate JWT accessToken
  │                              ├─ Hash refresh token (SHA-256)
  │                              ├─ Set cookie refreshToken
  │                              │
  │<───────────── 200 OK ────────┤
  │  {accessToken, sessionId,    │
  │   user, permissions}         │
```

## Authenticated Request

```
Client                         Server
  │                              │
  ├─ GET /auth/me ──────────────>│
  │  Authorization: Bearer JWT    │
  │  x-tenant-key: acme-001      │
  │                              ├─ Verify JWT signature
  │                              ├─ Extract user claims
  │                              ├─ Resolve tenant
  │                              ├─ Check permissions
  │                              │
  │<────────── 200 OK ───────────┤
  │  {user profile}              │
```

## Refresh Token Rotation

```
Client                         Server
  │                              │
  ├─ POST /auth/refresh ────────>│
  │  (cookie: refreshToken)      │
  │                              ├─ Extract token from cookie
  │                              ├─ Hash token (SHA-256)
  │                              ├─ Find Session
  │                              ├─ Check: not expired, not revoked
  │                              ├─ Detect reuse: revoke family
  │                              ├─ Create new Session
  │                              ├─ Sign new JWT
  │                              ├─ Set new cookie
  │                              │
  │<─ Set-Cookie ─ 200 OK ───────┤
  │  {new accessToken}           │
```
