# EMS Backend API Specification

## Base URL
`http://localhost:3000/api/v1`

## Authentication
All protected endpoints require:
- Header: `Authorization: Bearer <access_token>`
- Header: `x-tenant-key: <tenant_key>`

## Authentication Endpoints

### POST /auth/login
Login with email and password. Creates a new session and returns access token and refresh token.

**Headers:**
- `x-tenant-key`: The tenant identifier (required)
- `Content-Type: application/json`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "memberType": "EMPLOYEE",
      "employee": { ... }
    },
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "sessionId.rawtoken",
    "sessionId": "session-id",
    "permissions": ["permission:read", "permission:write"]
  },
  "meta": {}
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid credentials",
    "details": {}
  },
  "requestId": "req-id"
}
```

### POST /auth/admin/login
Admin-only login. Same as /auth/login but restricted to HR_ADMIN and SUPER_ADMIN members.

**Error Response (403):**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only admins can use this endpoint",
    "details": {}
  }
}
```

### POST /auth/refresh
Refresh the access token using the refresh token from cookies.

**Cookies:** `refreshToken=sessionId.rawtoken`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token",
    "sessionId": "new-session-id"
  }
}
```

**Error Responses:**
- `401` - `REFRESH_TOKEN_MISSING`: No refresh token in cookies
- `401` - `INVALID_TOKEN_FORMAT`: Token format is invalid
- `401` - `TOKEN_REUSE`: Token reuse detected - all sessions revoked
- `401` - `SESSION_EXPIRED`: Session has expired
- `401` - `SESSION_NOT_FOUND`: Session not found

### POST /auth/logout
Logout and revoke the current session.

**Success Response (200):**
```json
{
  "success": true,
  "data": {}
}
```

### POST /auth/logout-all
Logout from all sessions for the current user.

**Success Response (200):**
```json
{
  "success": true,
  "data": {}
}
```

### GET /auth/me
Get current user profile with permissions.

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "email": "user@example.com",
    "memberType": "EMPLOYEE",
    "status": "ACTIVE",
    "permissions": ["leave:request", "attendance:write"],
    "lastLoginAt": "2024-01-15T10:30:00Z",
    "employee": { ... }
  }
}
```

### GET /auth/sessions
List all active sessions for the current user.

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "session-id",
      "deviceName": "Chrome on MacOS",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "loginAt": "2024-01-15T10:30:00Z",
      "lastSeenAt": "2024-01-15T10:35:00Z",
      "expiresAt": "2024-01-22T10:30:00Z",
      "isRevoked": false
    }
  ]
}
```

### DELETE /auth/sessions/:sessionId
Revoke a specific session.

**Success Response (200):**
```json
{
  "success": true,
  "data": {}
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session not found",
    "details": {}
  }
}
```

---

## Admin Logs Endpoints

### GET /admin/logs
List application logs. Admin-only.

**Query Parameters:**
- `level`: Filter by log level (error, warn, info, debug)
- `module`: Filter by module name
- `actorUserId`: Filter by actor user ID
- `startDate`: Filter logs after this date (ISO format)
- `endDate`: Filter logs before this date (ISO format)
- `limit`: Number of logs per page (default: 50, max: 1000)
- `offset`: Pagination offset (default: 0)

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-id",
      "level": "error",
      "levelLabel": "Error",
      "levelColor": "#FF0000",
      "module": "auth",
      "message": "Login failed",
      "requestId": "req-123",
      "actorUserId": "user-id",
      "tenantId": "tenant-id",
      "metadata": { "errorCode": "INVALID_CREDENTIALS" },
      "timestampUtc": "2024-01-15T10:30:00.000Z",
      "timestampIstDisplay": "15/01/2024 03:60:00 PM IST"
    }
  ],
  "meta": { "count": 1 }
}
```

**Error Response (403):**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Only HR administrators can access logs",
    "details": {}
  }
}
```

### GET /admin/logs/:id
Get a specific log entry. Admin-only.

**Success Response (200):**
```json
{
  "success": true,
  "data": { ...log object... }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": {
    "code": "LOG_NOT_FOUND",
    "message": "Log entry not found",
    "details": {}
  }
}
```

### GET /admin/logs/export
Export logs to CSV or JSON. Admin-only.

**Query Parameters:**
- `format`: Export format - `csv` or `json` (default: json)
- `level`: Optional level filter
- `module`: Optional module filter
- `startDate`: Optional start date filter
- `endDate`: Optional end date filter

**Success Response (200):**
- CSV format: `Content-Type: text/csv`
- JSON format: `Content-Type: application/json`

### GET /admin/logs/stream
Stream logs as NDJSON. Admin-only.

**Response (200):**
- `Content-Type: application/x-ndjson`
- Each line is a JSON log object

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { "additional": "context" }
  },
  "requestId": "unique-request-id"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_TENANT` | 400 | Missing x-tenant-key header |
| `UNAUTHORIZED` | 401 | Missing authorization token |
| `INVALID_TOKEN` | 401 | Invalid or expired token |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password |
| `ACCOUNT_LOCKED` | 401 | User account is locked |
| `ACCOUNT_DISABLED` | 401 | User account is disabled |
| `FORBIDDEN` | 403 | User lacks required permissions |
| `SESSION_NOT_FOUND` | 404 | Session does not exist |
| `LOG_NOT_FOUND` | 404 | Log entry not found |
| `TOKEN_REUSE` | 401 | Token reuse detected |
| `SESSION_EXPIRED` | 401 | Session has expired |

---

## Security Features

### Rate Limiting
- Login endpoint: 10 requests per minute per IP
- OTP endpoints: 5 requests per 10 minutes per IP

### Session Management
- Sessions expire after 7 days
- Refresh tokens are rotated on each refresh
- Token reuse detection automatically revokes entire session family
- Sessions can be revoked individually or all at once

### Password Security
- Passwords hashed with Argon2id
- Tokens signed with HS256 (HMAC-SHA256)
- Refresh tokens hashed with SHA-256 before storage

### Data Validation
- All inputs validated with Zod schemas
- Email format validation
- SQL injection prevention via Prisma ORM
