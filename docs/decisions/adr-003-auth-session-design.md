# ADR 003: Authentication & Session Design

## Status: ACCEPTED (Sprint 0)

## Context

Need to:
- Support multiple user roles (SUPER_ADMIN, HR_ADMIN, MANAGER, EMPLOYEE)
- Detect token reuse (security)
- Allow revoking individual sessions
- Track user activity (IP, browser)
- Rotate refresh tokens securely

## Decision

1. **Dual Token Strategy**:
   - **Access Token**: JWT (HS256), short-lived (15 min), stateless verification
   - **Refresh Token**: Opaque, random 32 bytes, long-lived (7 days), hashed in DB

2. **Session Family Tracking**:
   - Each refresh token chain gets a sessionFamilyId
   - If old refresh token reused: revoke entire family (ATTACK)
   - Prevents token theft + rotation

3. **Hash Refresh Tokens** (SHA-256):
   - Never store plain token in DB
   - Even if DB compromised, attacker can't use tokens
   - Hash before lookup on refresh

4. **JWT Payload**:
   - Include: userId, tenantId, memberType, sessionId
   - Include: permissions array (loaded at login)
   - Not include: password, sensitive data

5. **Session Table Tracks**:
   - User + Tenant (multi-tenant)
   - ipAddress + userAgent (suspicious login detection)
   - expiresAt (auto-cleanup via DB job)
   - revokedAt + revokeReason (audit trail)

## Alternatives Considered

- JWT-only (can't revoke, tokens valid until expiry)
- Opaque-only (every request requires DB call)
- Store refresh in Redis (no persistent audit trail)

## Consequences

- Secure: tokens hashed, not raw
- Auditable: every login/logout logged
- Detectable: reuse detection via sessionFamily
- Performant: JWT = no DB call for auth check
- Revocable: logout immediately effective
