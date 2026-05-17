# Backend Design Document

## Architecture

```
Fastify.js (REST API)
├── Middleware
│   ├── authenticate (JWT validation)
│   ├── tenantResolution (X-Tenant-Key header)
│   └── errorHandler (centralized error handling)
├── Routes
│   ├── auth (login, refresh, logout)
│   └── logs (admin-only log access)
└── Services
    ├── authService (login logic, token generation)
    └── logsService (filtering, export)
```

## Tech Stack

- **Framework**: Fastify 4.26
- **ORM**: Prisma 5.22
- **Database**: MySQL 9.4
- **Auth**: JWT (access) + Opaque tokens (refresh)
- **Password**: Argon2id
- **Validation**: Zod
- **Logging**: Pino

## Key Decisions

1. **Opaque Refresh Tokens**: Hashed SHA-256, stored in DB, single-use
2. **Session Family**: Track token refresh chains, detect reuse
3. **Tenant Isolation**: Every query filters by tenantId
4. **Multi-tenancy**: Single app, multiple tenants via X-Tenant-Key header

## Data Flow

1. Client sends POST /auth/login with email + password
2. Service queries User by email + tenantId
3. Argon2id verify password hash
4. Generate session + refresh token (hashed)
5. Sign JWT access token (HS256)
6. Return accessToken + sessionId + user
7. Refresh token stored in HttpOnly cookie

## Security

- Argon2id: 2 passes, memory 19456
- JWT HS256 signature
- Refresh token: random 32 bytes, SHA-256 hashed
- Session reuse detection: revoke entire family
- Timing-safe token comparison
