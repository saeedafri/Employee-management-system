# EMS Backend Architecture

## Overview

The Employee Management System (EMS) backend is built using Fastify with a modular architecture designed for scalability and maintainability.

## Technology Stack

- **Framework**: Fastify (Node.js)
- **Language**: JavaScript (ES Modules)
- **Database**: MySQL with Prisma ORM
- **Cache**: Redis via ioredis
- **Authentication**: JWT + Session Management
- **Logging**: Pino
- **Testing**: Mocha + Chai
- **Validation**: Zod

## Directory Structure

```
src/
├── server.js              # Entry point
├── app.js                 # Fastify factory
├── config/                # Configuration
├── plugins/               # Fastify plugins (Prisma, Redis, Swagger, etc.)
├── middleware/            # Request/response middleware
├── modules/               # Feature modules
│   ├── auth/             # Authentication module
│   ├── employees/        # Employee management
│   ├── attendance/       # Attendance tracking
│   ├── leave/            # Leave management
│   └── logs/             # Audit logging APIs
└── utils/                 # Shared utilities
```

## Module Structure

Each module follows a consistent pattern:

```
modules/moduleName/
├── moduleName.routes.js      # Route definitions
├── moduleName.controller.js   # Request handlers
├── moduleName.service.js      # Business logic
├── moduleName.repository.js   # Database access
└── moduleName.validator.js    # Input validation
```

## Authentication Flow

### Login Flow

1. Client sends email + password to `/auth/login`
2. Server validates credentials against Argon2 hash
3. Server creates session with:
   - `sessionFamilyId` = `sessionId` (for new logins)
   - Hashed refresh token stored in DB
4. Server returns:
   - JWT access token (15 min expiry)
   - Opaque refresh token (sessionId.rawRefreshToken) in HttpOnly cookie
5. Client stores access token in memory

### Token Refresh Flow

1. Client sends refresh token via cookie (no access token required)
2. Server parses sessionId and rawRefreshToken from opaque format
3. Server validates:
   - Session exists and not revoked
   - Tenant matches
   - Token hash matches (timing-safe comparison)
   - Session not expired
4. On reuse detection:
   - Entire session family revoked
   - Returns 401 Unauthorized
5. On success:
   - New session created with same `sessionFamilyId`
   - New refresh token generated and hashed
   - Old session marked as TOKEN_ROTATED
   - New access token returned

### Token Reuse Detection

The system prevents token reuse attacks by:
- Tracking `sessionFamilyId` per session family
- Detecting when old tokens are reused
- Revoking entire family on reuse
- Preventing attacker from using any token from the compromised family

## Tenant Resolution

All API requests must include `X-Tenant-Key` header. The system:
1. Extracts tenant key from header
2. Looks up tenant in database
3. Attaches `request.tenant` with tenant ID, name, timezone
4. Validates all operations are within tenant scope

## Database Schema

The schema includes 23 models covering:
- **Authentication**: Users, Sessions, PasswordResetTokens, OtpChallenges
- **Organization**: Tenants, Departments, Roles, Permissions
- **Employees**: Employees, EmployeeDocuments
- **Operations**: AttendanceRecords, LeaveRequests, Resignations, Holidays
- **System**: AuditLogs, Notifications, SavedViews, Settings

All tenant-scoped tables include `tenantId` with indexes for performance.

## Logging

### Request Context

Every request attaches:
- `requestId` - unique request identifier
- `tenantId` - tenant being accessed
- `userId` - authenticated user (if applicable)

### Sensitive Field Redaction

All logs automatically redact:
- password, passwordHash
- token, refreshToken, accessToken
- authorization, cookie
- otp, codeHash, tokenHash
- refreshTokenHash

### Admin APIs

- `GET /api/v1/admin/logs` - List logs with filtering
- `GET /api/v1/admin/logs/:id` - Get specific log
- `GET /api/v1/admin/logs/export` - Export as CSV/JSON
- `GET /api/v1/admin/logs/stream` - Stream logs as NDJSON

## Error Handling

The system uses standardized error responses:

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

## Security Measures

1. **Password Storage**: Argon2id hashing with secure parameters
2. **Token Storage**: Refresh tokens hashed with SHA-256 before storage
3. **Timing-Safe Comparison**: crypto.timingSafeEqual for token validation
4. **HttpOnly Cookies**: Refresh tokens in HttpOnly, Secure, SameSite=Strict cookies
5. **CORS**: Configurable origin whitelist
6. **Helmet**: Security headers via @fastify/helmet
7. **Rate Limiting**: Configurable per endpoint
8. **Session Tracking**: Full audit trail of logins, token refreshes, logouts
