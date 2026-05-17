# ADR 002: Fastify + Prisma + MySQL Architecture

## Status: ACCEPTED (Sprint 0)

## Context

Need to structure backend as:
- HTTP REST API (Fastify)
- Database layer abstraction (Prisma)
- Multi-tenant support
- Type safety where possible

## Decision

1. **Fastify Hooks**: Use preHandler middleware for cross-cutting concerns
   - Authentication (JWT validation)
   - Tenant resolution (X-Tenant-Key header)
   - Error handling

2. **Prisma**: Use for all DB queries
   - Models in schema.prisma
   - Auto-generated types
   - Migrations for schema changes
   - Seed script for test data

3. **Repository Pattern**: Separate data access from business logic
   - authRepository.js (DB queries)
   - authService.js (business logic)
   - authController.js (HTTP handlers)

4. **Error Handling**: Centralized via middleware
   - Catch all errors in preHandler
   - Return consistent error response format
   - Log errors to both console + database

## Structure

```
src/
├── plugins/        Fastify plugin registration
├── middleware/     Hooks + validation
├── utils/          Shared utilities
├── modules/        Feature modules
│   └── auth/
│       ├── routes.js
│       ├── controller.js
│       ├── service.js
│       ├── repository.js
│       └── validator.js
└── server.js       Fastify instance
```

## Consequences

- Separation of concerns (routes → controller → service → repository)
- Testable (can mock each layer)
- Type-safe (Prisma generates types)
- Scalable (stateless servers)
- Database-agnostic business logic
