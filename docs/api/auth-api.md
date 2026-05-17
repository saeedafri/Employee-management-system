# Authentication API

## Endpoints

### POST /auth/login
Universal login for all user types.

Response (200):
```json
{
  "accessToken": "JWT",
  "sessionId": "uuid",
  "user": {}
}
```

### POST /auth/admin/login
Admin-only login (checks memberType).

Returns (403) if user is not HR_ADMIN or SUPER_ADMIN.

### POST /auth/refresh
Rotate access token using refresh token (in cookie).

Returns new accessToken (200).

### GET /auth/me
Get current user profile.

### POST /auth/logout
Revoke current session.

### POST /auth/logout-all
Revoke all user sessions.

### GET /auth/sessions
List user's active sessions.

Returns array of sessions with createdAt, lastActivityAt, ipAddress, userAgent.

### DELETE /auth/sessions/:sessionId
Revoke specific session.
