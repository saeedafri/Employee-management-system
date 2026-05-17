# Authentication & Session Internals

## Login Flow

1. POST /auth/login with email + password
2. Find User by (tenantId, email)
3. Verify password with Argon2id
4. Check memberType (for admin routes)
5. Generate refresh token (32 random bytes)
6. Hash refresh token with SHA-256
7. Create Session record (hashed token, expires 7d)
8. Create JWT accessToken (expires 15m)
9. Set refreshToken in HttpOnly cookie
10. Return accessToken + sessionId + user

## Token Rotation (Refresh)

1. POST /auth/refresh
2. Extract refresh token from cookie
3. Hash token (SHA-256)
4. Find Session by hashed token
5. Check: not expired, not revoked, not reused
6. If reused: revoke entire sessionFamily (security)
7. Create new Session
8. Revoke old Session
9. Return new accessToken
10. Set new refreshToken in cookie

## Session Revocation

On logout:
1. POST /auth/logout
2. Find Session by sessionId
3. Mark revokedAt = now
4. Mark revokeReason = "LOGOUT"
5. Return 200 success

All sessions (logout-all):
1. Find all Sessions for user
2. Mark each with revokedAt = now
3. Mark revokeReason = "LOGOUT_ALL"

## JWT Payload

```json
{
  "sub": "userId",
  "tenantId": "tenantId",
  "memberType": "HR_ADMIN",
  "sessionId": "sessionId",
  "permissions": ["auth:read", "logs:read"],
  "iat": 1234567890,
  "exp": 1234571490
}
```

## Database Schema

### Session
- id: UUID
- userId: FK User
- tenantId: FK Tenant
- sessionFamilyId: UUID (track refresh chains)
- refreshTokenHash: SHA-256 (unique)
- ipAddress: string
- userAgent: string
- expiresAt: datetime (7 days)
- revokedAt: nullable datetime
- revokeReason: nullable string

### AuditLog
- tenantId, userId, action, entityType, entityId
- ipAddress, userAgent, timestamp
