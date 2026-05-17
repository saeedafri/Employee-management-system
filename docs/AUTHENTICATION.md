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

## Multi-Factor Authentication (MFA) with OTP

### Overview
When a user has MFA enabled, the login flow returns a challenge instead of tokens, requiring email-based OTP verification.

### MFA Login Flow (4 Steps)

```
Client                          Server
  |                               |
  |------ POST /auth/login ------>|
  |     (email, password)          |
  |                                |
  |                        1. Validate credentials
  |                        2. Check mfaEnabled
  |                        3. Generate OTP challenge
  |                           - challengeId (UUID)
  |                           - code (6-digit)
  |                           - TTL: 10 minutes
  |                        4. Queue OTP email
  |                                |
  |<------ 202 Accepted ----------|
  |   {                            |
  |     mfaRequired: true,         |
  |     challengeId: "...",        |
  |     destinationMasked: "...",  |
  |     expiresIn: 600             |
  |   }                            |
```

### OTP Verification

```
POST /api/v1/auth/verify-otp
Content-Type: application/json
X-Tenant-Key: {tenantKey}

{
  "challengeId": "challenge_uuid",
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "memberType": "EMPLOYEE"
    },
    "permissions": ["read:profile", "write:leave"],
    "sessionId": "session_uuid"
  }
}
```

### OTP Resend

```
POST /api/v1/auth/resend-otp
Content-Type: application/json
X-Tenant-Key: {tenantKey}

{
  "challengeId": "challenge_uuid"
}
```

**Constraints:**
- 60-second cooldown between resends
- Maximum 3 resends per challenge
- Returns `OTP_RESEND_COOLDOWN` with `cooldownSeconds` if too soon
- Returns `OTP_RESEND_LIMIT_EXCEEDED` if max resends reached

### OTP Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| OTP_CHALLENGE_NOT_FOUND | 400 | Invalid challengeId |
| OTP_INVALID | 400 | Wrong code (5 attempts max) |
| OTP_LOCKED | 429 | Locked after 5 failed attempts (15 min) |
| OTP_EXPIRED | 400 | Challenge expired (10 min TTL) |
| OTP_ALREADY_USED | 400 | Challenge already consumed |
| OTP_RESEND_COOLDOWN | 429 | Too soon to resend (60 sec min) |
| OTP_RESEND_LIMIT_EXCEEDED | 429 | Max 3 resends reached |

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

## Email & User Identity Mapping

### Data Source of Truth

- **User.email** is the source of truth for all authentication operations
  - Login: Use User.email
  - Password Reset: Send to User.email
  - OTP Verification: Send OTP to User.email
  - MFA: Destination is User.email from database

- **Employee.workEmail** is synchronized with User.email
  - When User.email changes, Employee.workEmail must be updated
  - When Employee.workEmail changes, User.email must be synced
  - Keep them in sync during employee updates

- **Employee.personalEmail** is optional
  - Used for emergency contact only
  - Never used for login, password reset, or OTP

### Email Safety Rules

**DO NOT:**
- Send OTP to arbitrary email from API request
- Send password reset to email other than User.email (except forgot-password lookup)
- Accept email destination override in reset-token request
- Store raw tokens/codes in logs
- Log OTP destination email when it's not a standard field

**DO:**
- Always lookup User.email from database
- Verify User.email exists before sending OTP/reset
- Mask email in API responses (`u***@example.com`)
- Log only that email was sent (without address)
- Verify user status/account before sending email

### Onboarding Flow

When HR onboards an employee:
1. HR enters Employee.workEmail
2. If login access is enabled: create User with email=Employee.workEmail
3. Employee.personalEmail is optional
4. User.email is the source of truth (from now on)
5. Keep User.email and Employee.workEmail synced

### Testing

Create test user with specific email:

```bash
npm run seed:test-email-user -- --email test@example.com --mfa
```

Test email delivery (mock mode):

```bash
EMAIL_PROVIDER=mock npm run email:test -- --to test@example.com
```

## Security Best Practices for Clients

1. **Store access token in memory only** - Never in localStorage
2. **Refresh token automatically** - Before expiry or on 401
3. **Don't expose refresh token** - Keep in HttpOnly cookie (automatic)
4. **Handle token reuse gracefully** - Redirect to login on 401
5. **Clear sensitive data on logout** - Tokens, user state, etc.
6. **Use HTTPS only** - Prevent credential interception
