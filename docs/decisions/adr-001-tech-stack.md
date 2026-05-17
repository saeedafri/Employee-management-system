# ADR 001: Technology Stack Selection

## Status: ACCEPTED (Sprint 0)

## Context

EMS Backend requires:
- REST API for multi-page frontend
- Multi-tenant isolation (one codebase, multiple customers)
- MySQL database (legacy system integration)
- Session-based + JWT authentication
- Rapid development

## Decision

Selected stack:
- **Framework**: Fastify.js (lightweight, fast, modern)
- **Runtime**: Node.js 25.9 with ES Modules
- **ORM**: Prisma (type-safe, migrations, seed scripts)
- **Database**: MySQL 9.4 (required)
- **Auth**: JWT (access) + Opaque Refresh Tokens
- **Password**: Argon2id (OWASP approved)
- **Validation**: Zod (runtime schemas)
- **Testing**: Mocha + Chai (industry standard)
- **Logging**: Pino (structured JSON)
- **API Docs**: Swagger/OpenAPI

## Rationale

1. **Fastify**: Faster than Express, modern hooks, minimal overhead
2. **Prisma**: Type-safe DB access, automatic migrations, excellent DX
3. **ES Modules**: Future-proof, same syntax as frontend
4. **Argon2id**: Memory-hard, resistant to GPU attacks
5. **Opaque Tokens**: Refresh tokens revocable in DB (vs JWT which can't be revoked)
6. **Zod**: Runtime validation, integrates cleanly with Fastify
7. **Mocha**: Familiar to team, zero magic
8. **Pino**: JSON logs work with modern monitoring stacks

## Alternatives Considered

- Express (slower, less modern)
- TypeScript (adds complexity, Zod provides type safety)
- PostgreSQL (not required, MySQL sufficient)
- OAuth2 (overkill for internal app)
- GraphQL (REST simpler for current scope)

## Consequences

- Fast: Fastify ~30K ops/sec vs Express ~15K
- Scalable: Stateless design, horizontal load balancing ready
- Maintainable: Zod + Prisma reduce bugs
- Testable: ES Modules, dependency injection friendly
