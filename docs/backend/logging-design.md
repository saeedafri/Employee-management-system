# Logging & Observability

## Application Logging (LogEntry model)

Every request writes structured log:
- tenantId, userId, level, module
- message, requestId
- ipAddress, userAgent
- metadata (JSON)

Levels:
- error (red #FF0000)
- warn (orange #FFA500)
- info (blue #0000FF)
- debug (gray #808080)

Modules: auth, user, employee, attendance, leave, etc.

## Pino Logger (Transport)

Structured JSON logs via Pino:
```json
{
  "level": 30,
  "time": 1779032152120,
  "pid": 64790,
  "reqId": "req-1",
  "req": { "method": "POST", "url": "/api/v1/auth/login" },
  "res": { "statusCode": 200 },
  "responseTime": 21.16,
  "msg": "request completed"
}
```

Log files:
- logs/app.log (INFO+)
- logs/error.log (ERROR only)

## Audit Logging

Captured events:
- LOGIN (success/fail)
- LOGOUT (single/all)
- TOKEN_REFRESH
- INVALID_CREDENTIALS
- UNAUTHORIZED_ACCESS
- SESSION_REVOKED

Stored in AuditLog table with:
- actor (who performed action)
- action (LOGIN, LOGOUT, etc.)
- entity (what was affected)
- timestamp, ipAddress, userAgent

## Metrics

No metrics yet. Future: add Prometheus/OpenTelemetry.
