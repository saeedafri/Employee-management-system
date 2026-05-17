# Foundation Hardening Sprint 0 - Status Report

**Status**: IN PROGRESS  
**Approval**: NOT APPROVED FOR PAGE 02  
**Last Updated**: 2026-05-17

---

## Completed Requirements ✅

### 1. Clean Repository ✅
- [x] Removed __MACOSX folders
- [x] Removed .DS_Store files
- [x] Added/Updated .gitignore with proper exclusions
- [x] Created .env.example
- [x] Project works from: `/Users/mohdsaeedafri/All-Code-Base/EMS`
- **Commit**: `8b46ef8` - chore: clean repository

### 2. Test Stack (Partially Complete) ⚠️
- [x] Replaced Vitest with Mocha/Chai
- [x] Installed: mocha, chai, sinon, c8, supertest
- [x] Added test scripts in package.json:
  - `npm run test` - Run all tests
  - `npm run test:unit` - Unit tests only
  - `npm run test:integration` - Integration tests only
  - `npm run test:e2e` - E2E tests only
  - `npm run test:watch` - Watch mode
  - `npm run test:coverage` - Coverage report
- [x] Created test directory structure: `tests/{unit,integration,e2e}`
- [x] Created Mocha config (.mocharc.json)
- [x] Created coverage config (.c8rc.json)
- [x] Created test helpers for:
  - App creation
  - Database cleanup
  - Test data fixtures
  - Auth tokens
- [x] Created example unit tests for auth.service
- [x] Created example integration tests for auth routes
- **Commit**: `6ac65fd` - feat(tests): add Mocha/Chai test stack
- **Status**: Ready for full test suite implementation
- **Missing**: 
  - Comprehensive test coverage for all requirements
  - Test fixtures for edge cases
  - E2E test examples

---

## Pending Requirements (High Priority First) 🔴

### 3. Fix Refresh Token Architecture 🔴 CRITICAL
**Impact**: Security/correctness  
**Status**: NOT STARTED

Current problems:
- /auth/refresh requires access token (should only need cookie)
- Refresh token format not opaque
- No session family tracking for reuse detection
- Missing secure token rotation

Required changes:
- [x] Analyze current architecture
- [ ] Update Session schema with sessionFamilyId, device info
- [ ] Implement opaque token format: `sessionId.rawToken`
- [ ] Implement timing-safe token comparison
- [ ] Implement session family revocation
- [ ] Update /auth/refresh to NOT require access token
- [ ] Add reuse detection and audit logging
- [ ] Update tests for refresh flow

### 4. Fix Tenant Resolution 🔴 CRITICAL
**Impact**: Multi-tenancy correctness  
**Status**: NOT STARTED

Current problems:
- Uses "first tenant from DB" (wrong)
- No tenant context in requests
- No middleware for tenant resolution

Required changes:
- [ ] Add tenantKey/slug to Tenant model
- [ ] Create tenant resolver middleware
- [ ] Support X-Tenant-Key header for local/dev
- [ ] Support subdomain-based tenant resolution
- [ ] Attach request.tenant context
- [ ] Update all queries to use resolved tenant

### 5. Fix Prisma Schema 🟡 HIGH
**Impact**: Data integrity/performance  
**Status**: NOT STARTED

Required changes:
- [ ] Use Prisma Json type instead of String for:
  - AuditLog.oldValuesJson
  - AuditLog.newValuesJson
  - SavedView.filtersJson
  - SavedView.columnsJson
- [ ] Make AuditLog.actorUserId nullable
- [ ] Add @@unique([tenantId, workEmail]) to Employee
- [ ] Fix User/Employee relation consistency
- [ ] Add composite indexes for:
  - User: status, memberType, deletedat, tenantId
  - Employee: employmentStatus, departmentId, managerId, joinedOn
  - Department: parentId, depth
  - AttendanceRecord: attendanceDate, status
  - LeaveRequest: status, employeeId, approverId
  - Holiday: holidayDate, location
  - AuditLog: entityType, action
  - Notification: userId, readAt
  - Setting: tenantId, groupKey, settingKey
- [ ] Test migration safety

### 6. Fix Logging System 🟡 HIGH
**Impact**: Observability/debugging  
**Status**: NOT STARTED

Required changes:
- [ ] Create logger module (wrapper around Pino)
- [ ] Remove all console.log/console.error from:
  - src/server.js
  - src/config/redis.js
  - src/config/index.js
  - All modules
- [ ] Add structured logging with:
  - requestId
  - tenantId
  - userId
  - sessionId
  - Field redaction (password, token, etc.)
  - Log levels: error, warn, info, debug, trace
- [ ] Add IST timezone display helper
- [ ] Create admin log APIs:
  - GET /api/v1/admin/logs
  - GET /api/v1/admin/logs/:id
  - GET /api/v1/admin/logs/export
  - GET /api/v1/admin/logs/stream
- [ ] Add log filtering/search
- [ ] Async log persistence (queue-based)
- [ ] Database schema for logs

### 7. Add Documentation 🟡 HIGH
**Impact**: Team onboarding/clarity  
**Status**: NOT STARTED

Required structure:
```
docs/
  api/
    ui-team-api-guide.md
    auth-api.md
    error-codes.md
    postman-guide.md
  backend/
    backend-design-document.md
    architecture.md
    module-structure.md
    auth-session-internals.md
    rbac-permissions.md
    database-design.md
    logging-design.md
    testing-strategy.md
    deployment-guide.md
  diagrams/
    erd.md
    system-architecture.md
    auth-flow.md
    refresh-token-flow.md
    (+ more flows)
  decisions/
    adr-*.md
```

### 8. Fix Swagger/OpenAPI 🟡 MEDIUM
**Impact**: API clarity/frontend integration  
**Status**: NOT STARTED

Required:
- [ ] Define request schemas for all routes
- [ ] Define response schemas
- [ ] Add error examples
- [ ] Add auth requirements
- [ ] Add permission requirements
- [ ] Add tags and descriptions
- [ ] Add Postman examples
- [ ] Ensure /docs is useful for frontend team

### 9. Update Postman Collection 🟡 MEDIUM
**Impact**: API testing/onboarding  
**Status**: NOT STARTED

Required:
- [ ] Add all auth endpoints
- [ ] Add edge case tests
- [ ] Add automated tests for:
  - Status codes
  - Response shapes
  - Token saving
  - Cookie-based refresh
- [ ] Create environment file with:
  - baseUrl
  - accessToken
  - sessionId
  - tenant variables
- [ ] Add pre-request scripts
- [ ] Add post-request tests
- [ ] Add Newman support

### 10. Add GitHub Actions CI 🟡 MEDIUM
**Impact**: Quality gates/automated testing  
**Status**: NOT STARTED

Required:
- [ ] Create .github/workflows/ci.yml
- [ ] Run: npm ci
- [ ] Run: npm run lint
- [ ] Run: npm run test:unit
- [ ] Run: npm run test:integration
- [ ] Run: npm run test:coverage
- [ ] Run: prisma validate
- [ ] Run: migrations against test DB
- [ ] Run: npm audit
- [ ] Report coverage results

### 11. Comprehensive Test Suite 🟡 MEDIUM
**Impact**: Code quality/confidence  
**Status**: NOT STARTED

Required test coverage minimum: 90% (statements, branches, functions, lines)

Auth endpoint tests needed:
- [x] Employee login success
- [ ] Admin login success
- [ ] Admin login rejects employee
- [ ] Invalid email
- [ ] Wrong password
- [ ] Missing password
- [ ] Disabled user
- [ ] Locked user
- [ ] Refresh token success (NEW BEHAVIOR)
- [ ] Refresh token missing cookie
- [ ] Refresh token rotation
- [ ] Refresh token reuse detection
- [ ] Logout current session
- [ ] Logout all sessions
- [ ] List sessions
- [ ] Revoke session
- [ ] Get current user
- [ ] Invalid access token
- [ ] Expired access token
- [ ] RBAC permission in token
- [ ] Audit log created for all actions
- [ ] No passwordHash in any response

---

## Known Blockers 🚫

1. **Refresh Token Architecture**: Requires database migration and API changes
2. **Tenant Resolution**: Requires middleware and Request context changes
3. **Prisma Schema**: Requires migration plan and data migration
4. **Logging**: Requires search for all console.log usage

---

## Recommended Order

1. **High Priority** (Blocking Page 02):
   - Fix refresh token architecture (security)
   - Fix tenant resolution (correctness)
   - Comprehensive test suite (confidence)

2. **Medium Priority** (Quality):
   - Fix Prisma schema (performance/data integrity)
   - Fix logging system (observability)
   - Add CI/GitHub Actions (automation)

3. **Lower Priority** (Usability):
   - Documentation
   - Swagger/OpenAPI improvements
   - Postman collection updates

---

## Next Steps

- [ ] Review this status with stakeholders
- [ ] Prioritize requirements
- [ ] Start with refresh token architecture
- [ ] Set up CI pipeline
- [ ] Implement comprehensive tests
- [ ] Final approval before Page 02

