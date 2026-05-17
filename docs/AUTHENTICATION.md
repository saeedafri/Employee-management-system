# Authentication Documentation

## Overview

EMS uses a dual-token authentication system with session family tracking for enhanced security against token reuse attacks.

## Token Architecture

### Access Token (JWT)

- **Type**: JWT signed with HS256
- **Expiry**: 15 minutes
- **Storage**: Application memory (not persisted)
- **Payload**:
  ```json
  {
    "sub": "userId",
    "tenantId": "tenantId",
    "memberType": "EMPLOYEE|HR_ADMIN|SUPER_ADMIN|MANAGER|AUDITOR",
    "sessionId": "sessionId",
    "permissions": ["permission1", "permission2"],
    "iat": 1234567890,
    "exp": 1234569690
  }
  ```

### Refresh Token

- **Type**: Opaque (sessionId.rawRefreshToken)
- **Format**: 64 character hex string (32 bytes random)
- **Expiry**: 7 days
- **Storage**: HttpOnly, Secure, SameSite=Strict cookie
- **DB Storage**: SHA-256 hash of raw token

## Login Flow

```
Client                          Server
  |                               |
  |------ POST /auth/login ------>|
  |     (email, password)          |
  |                                |
  |                        1. Validate user
  |                        2. Verify password
  |                        3. Create session
  |                           - sessionId = UUID
  |                           - sessionFamilyId = sessionId
  |                           - refreshTokenHash = SHA256(token)
  |                        4. Generate tokens
  |                           - accessToken (JWT)
  |                           - rawRefreshToken (32 bytes)
  |                        5. Set cookie
  |                               |
  |<----- HTTP 200 OK ------------|
  |      accessToken             |
  |      sessionId               |
  |      user data               |
  |      Set-Cookie: refreshToken|
  |                               |
```

## Token Refresh Flow (16 Steps)

```
Client                          Server
  |                               |
  |---- POST /auth/refresh ------>|
  |  (Cookie: sessionId.token)    |
  |  (Header: X-Tenant-Key)       |
  |                                |
  |                    1. Extract sessionId & rawToken from cookie
  |                    2. Lookup session by sessionId
  |                    3. Verify session not revoked
  |                    4. Verify tenant matches
  |                    5. Check session not expired
  |                    6. Hash provided token
  |                    7. Timing-safe compare hashes
  |                       - If mismatch: REUSE DETECTED
  |                    8. Revoke entire session family
  |                    9. Fetch user data
  |                    10. Generate new refresh token
  |                    11. Create new session (same family)
  |                    12. Revoke old session
  |                    13. Generate new access token
  |                    14. Create audit log
  |                    15. Format new opaque token
  |                    16. Set new cookie
  |                               |
  |<----- HTTP 200/401 ----------|
  |      accessToken (if OK)     |
  |      sessionId (if OK)       |
  |      Set-Cookie (if OK)      |
  |                               |
```

## Token Reuse Detection

When a refresh request with an old token is detected:

1. Server identifies token has already been used
2. Server revokes **entire session family**
3. All tokens from same family become invalid
4. Client must re-authenticate
5. Audit log records TOKEN_REUSE_DETECTED

**Why Family Revocation?**
- If attacker has old token, they may have compromised client
- Revoke entire family to force re-auth and prevent attacker access
- Legitimate user can simply log in again

## Session Family Concept

```
Login 1
├─ sessionId: abc123
├─ sessionFamilyId: abc123
└─ refreshTokenHash: hash1

Refresh 1 (Creates new session, same family)
├─ sessionId: def456
├─ sessionFamilyId: abc123  <-- Same family
└─ refreshTokenHash: hash2

Refresh 2 (Continues rotation)
├─ sessionId: ghi789
├─ sessionFamilyId: abc123  <-- Same family
└─ refreshTokenHash: hash3

Reuse of hash1 detected →
├─ Revoke ghi789
├─ Revoke def456
├─ Revoke abc123
└─ All tokens invalid
```

## Logout

### Single Session Logout

```
POST /api/v1/auth/logout
Authorization: Bearer {accessToken}
```

- Revokes current session only
- User can login again
- Audit log: LOGOUT

### Logout All

```
POST /api/v1/auth/logout-all
Authorization: Bearer {accessToken}
```

- Revokes all sessions for user
- Logs out from all devices
- Audit log: LOGOUT_ALL

## Admin Login

```
POST /api/v1/auth/admin/login
```

- Restricted to SUPER_ADMIN and HR_ADMIN roles
- Non-admin users receive 403 Forbidden
- All other flows identical to regular login

## Current User

```
GET /api/v1/auth/me
Authorization: Bearer {accessToken}
```

Returns authenticated user profile with:
- id, email, memberType, status
- Employee information
- Assigned permissions

## Session Management

### List User Sessions

```
GET /api/v1/auth/sessions
Authorization: Bearer {accessToken}
```

Returns all active (non-revoked) sessions with:
- sessionId, ipAddress, userAgent, loginAt, lastSeenAt

### Revoke Specific Session

```
DELETE /api/v1/auth/sessions/{sessionId}
Authorization: Bearer {accessToken}
```

Revokes one session while keeping others active.

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| INVALID_CREDENTIALS | 401 | Email not found or password mismatch |
| ACCOUNT_LOCKED | 401 | User account is locked |
| ACCOUNT_DISABLED | 401 | User account is disabled |
| FORBIDDEN | 403 | Non-admin accessing admin endpoint |
| SESSION_EXPIRED | 401 | Session max age exceeded |
| SESSION_NOT_FOUND | 401 | Session was deleted |
| SESSION_REVOKED | 401 | Session was explicitly revoked |
| TOKEN_REUSE | 401 | Token reuse detected, family revoked |
| TENANT_MISMATCH | 401 | Tenant doesn't match session |
| REFRESH_TOKEN_MISSING | 401 | Cookie not found |
| INVALID_TOKEN_FORMAT | 401 | Token format not sessionId.token |

## Security Best Practices for Clients

1. **Store access token in memory only** - Never in localStorage
2. **Refresh token automatically** - Before expiry or on 401
3. **Don't expose refresh token** - Keep in HttpOnly cookie (automatic)
4. **Handle token reuse gracefully** - Redirect to login on 401
5. **Clear sensitive data on logout** - Tokens, user state, etc.
6. **Use HTTPS only** - Prevent credential interception
