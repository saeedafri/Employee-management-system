# UI Team API Guide

## Quick Start

Base URL: `http://localhost:3000/api/v1`

### Authentication

All requests (except login) require:
```
Authorization: Bearer <access_token>
x-tenant-key: acme-corp-001
```

### Login

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@acme.test",
  "password": "password"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJh...",
    "sessionId": "abc123",
    "user": { "id": "...", "email": "...", "memberType": "..." }
  }
}
```

### Get Current User

```bash
GET /auth/me
Authorization: Bearer <token>
x-tenant-key: acme-corp-001
```

## Error Handling

All errors follow format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description",
    "details": {}
  }
}
```

Common codes:
- `INVALID_CREDENTIALS` (401)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)

## Rate Limiting

- 10 requests per minute per IP
- Returns: 429 Too Many Requests
