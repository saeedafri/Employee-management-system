# Postman Collection Guide

## Import Collection

1. Open Postman
2. Import: `docs/postman/EMS-API.postman_collection.json`
3. Import Environment: `docs/postman/EMS.postman_environment.json`

## Environment Variables

- `base_url`: http://localhost:3000/api/v1
- `tenant_key`: acme-corp-001
- `access_token`: Auto-populated by login tests
- `admin_access_token`: Auto-populated by admin login
- `session_id`: Auto-captured from login response

## Test Flow

1. Login - Employee (captures access_token, session_id)
2. Get Current User
3. Get User Sessions
4. Revoke Specific Session
5. Login - HR Admin (captures admin_access_token)
6. Admin Login endpoint
7. Refresh Token
8. Logout
9. Logout All
10. Login Employee for Logs Test
11. Login Admin for Logs Test
12. List Logs (admin)
13. Employee Cannot Access Logs (403 expected)
14. Export CSV
15. Stream NDJSON
16-18. Error cases

Run All: `newman run collection.json -e environment.json`

## Test Coverage

30 assertions covering:
- Authentication flows
- Token management
- Session operations
- RBAC enforcement
- Error handling
