# Error Codes

## Authentication (401)
- `UNAUTHORIZED` - Missing or invalid token
- `INVALID_TOKEN` - Token verification failed
- `INVALID_CREDENTIALS` - Wrong email/password
- `TOKEN_EXPIRED` - Access token expired

## Authorization (403)
- `FORBIDDEN` - Insufficient permissions for resource

## Validation (400)
- `VALIDATION_ERROR` - Invalid request body
- `INVALID_TENANT` - Tenant not found or invalid

## Not Found (404)
- `SESSION_NOT_FOUND` - Session doesn't exist
- `LOG_NOT_FOUND` - Log entry not found
- `USER_NOT_FOUND` - User doesn't exist

## Server (500)
- `INTERNAL_SERVER_ERROR` - Unexpected server error
