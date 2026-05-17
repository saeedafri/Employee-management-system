# ADR 004: Logging & Observability

## Status: ACCEPTED (Sprint 0)

## Context

Need to:
- Track all API requests (audit)
- Debug application issues
- Monitor production behavior
- Support compliance audits

## Decision

1. **Structured Logging (Pino)**:
   - JSON format (machine parseable)
   - Automatic request/response logging
   - Levels: error, warn, info, debug

2. **Application Logs (LogEntry model)**:
   - Every request writes LogEntry record
   - Includes: tenantId, userId, level, module, message
   - Indexed by: tenantId, level, module (for filtering)
   - Searchable via /admin/logs endpoint

3. **Audit Trail (AuditLog model)**:
   - Specific security events: LOGIN, LOGOUT, PASSWORD_RESET
   - Includes: actor (who), action (what), entity (where)
   - Includes: ipAddress, userAgent, timestamp
   - Immutable (no updates, only inserts)

4. **Request Tracking (X-Request-ID)**:
   - Every request gets unique ID
   - Included in all log lines
   - Useful for tracing request through system

## Queries Logged

- login (success/fail)
- token refresh
- logout
- unauthorized access attempts
- invalid credentials
- session revocation
- log exports

## Future Improvements

- [ ] Log retention policy (30 days default)
- [ ] Log archival to S3
- [ ] Alert on suspicious patterns
- [ ] Metrics/dashboards (Prometheus)
- [ ] Distributed tracing (OpenTelemetry)

## Consequences

- Observable: full request/response visibility
- Auditable: immutable audit trail
- Debuggable: structured logs searchable
- Compliant: tracks who accessed what when
