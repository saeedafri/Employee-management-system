# EMS API Reference

## Base URL

```
http://localhost:3000/api/v1
```

All requests require `X-Tenant-Key` header.

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {
    "count": 0,
    "limit": 50,
    "offset": 0
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "requestId": "req-xxx"
}
```

## Authentication Endpoints

### POST /auth/login

Universal login for all user types.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "sessionId": "clm4x...",
    "user": {
      "id": "userId",
      "email": "user@example.com",
      "memberType": "EMPLOYEE"
    },
    "permissions": ["auth:read", "profile:read"]
  }
}
```

**Headers Set:**
```
Set-Cookie: refreshToken=sessionId.token; HttpOnly; Secure; SameSite=Strict
```

### POST /auth/admin/login

Admin-only login endpoint.

**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password"
}
```

**Response (200):** Same as `/auth/login`

**Errors:**
- `403 FORBIDDEN` - User is not admin

### POST /auth/refresh

Refresh access token without requiring authorization header.

**Headers:**
```
X-Tenant-Key: tenant-key
Cookie: refreshToken=sessionId.token
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "sessionId": "clm4x..."
  }
}
```

**Headers Set:**
```
Set-Cookie: refreshToken=newSessionId.newToken; HttpOnly; Secure; SameSite=Strict
```

**Errors:**
- `400 TENANT_MISSING` - X-Tenant-Key header missing
- `400 INVALID_TENANT` - Tenant not found
- `401 REFRESH_TOKEN_MISSING` - Cookie not found
- `401 INVALID_TOKEN_FORMAT` - Token not sessionId.token format
- `401 TOKEN_REUSE` - Token reuse detected, family revoked

### POST /auth/logout

Logout from current session.

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Key: tenant-key
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Headers Set:**
```
Set-Cookie: refreshToken=; Max-Age=0
```

### POST /auth/logout-all

Logout from all sessions.

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Key: tenant-key
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out from all devices"
  }
}
```

### GET /auth/me

Get current user profile.

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Key: tenant-key
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "userId",
    "email": "user@example.com",
    "memberType": "EMPLOYEE",
    "status": "ACTIVE",
    "permissions": ["auth:read", "profile:read"]
  }
}
```

### GET /auth/sessions

List active user sessions.

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Key: tenant-key
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "sessionId",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "loginAt": "2026-05-17T10:30:00Z",
      "lastSeenAt": "2026-05-17T10:35:00Z"
    }
  ],
  "meta": {
    "count": 1
  }
}
```

### DELETE /auth/sessions/{sessionId}

Revoke specific session.

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Key: tenant-key
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Session revoked successfully"
  }
}
```

## Admin Log Endpoints

### GET /admin/logs

List audit logs with filtering.

**Query Parameters:**
- `action` - Filter by action (LOGIN, LOGOUT, CREATE, UPDATE, etc.)
- `entityType` - Filter by entity type (User, Employee, etc.)
- `actorUserId` - Filter by actor user ID
- `startDate` - ISO 8601 date (e.g., 2026-05-17T00:00:00Z)
- `endDate` - ISO 8601 date
- `limit` - Results per page (default: 50, max: 1000)
- `offset` - Pagination offset (default: 0)

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Key: tenant-key
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "logId",
      "action": "LOGIN",
      "entityType": "User",
      "entityId": "userId",
      "actorUserId": "userId",
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2026-05-17T10:30:00Z"
    }
  ],
  "meta": {
    "count": 1
  }
}
```

### GET /admin/logs/{id}

Get specific audit log.

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Key: tenant-key
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "logId",
    "action": "LOGIN",
    "entityType": "User",
    "entityId": "userId",
    "actorUserId": "userId",
    "oldValuesJson": null,
    "newValuesJson": null,
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "createdAt": "2026-05-17T10:30:00Z"
  }
}
```

### GET /admin/logs/export

Export audit logs.

**Query Parameters:**
- `format` - csv or json (default: json)
- `action` - Filter by action
- `entityType` - Filter by entity type
- `startDate` - Start date filter
- `endDate` - End date filter

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Key: tenant-key
```

**Response (200):**
- Content-Type: text/csv or application/json
- Content-Disposition: attachment; filename="audit-logs.csv"

### GET /admin/logs/stream

Stream audit logs as NDJSON.

**Query Parameters:**
- `action` - Filter by action
- `entityType` - Filter by entity type
- `startDate` - Start date filter
- `endDate` - End date filter

**Headers:**
```
Authorization: Bearer {accessToken}
X-Tenant-Key: tenant-key
```

**Response (200):**
- Content-Type: application/x-ndjson
- One JSON object per line

## Common Headers

All requests should include:

```
X-Tenant-Key: {tenantKey}
```

For authenticated endpoints:

```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

## Rate Limiting

- Login endpoints: 10 requests per minute per IP
- Other endpoints: 100 requests per minute per IP

Exceeding limits returns `429 Too Many Requests`.

## Status Codes

- `200 OK` - Successful request
- `400 Bad Request` - Invalid input or missing required field
- `401 Unauthorized` - Invalid or missing authentication
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
