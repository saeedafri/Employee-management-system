# Testing Strategy - Sprint 0

## Overview

EMS Backend implements comprehensive testing: unit, integration, and E2E tests. All tests automated, 212+ passing.

## Coverage Requirements (Sprint 0)

| Metric | Required | Actual | Status |
|--------|----------|--------|--------|
| Statements | >= 90% | 92.12% | ✓ |
| Lines | >= 90% | 92.12% | ✓ |
| Functions | >= 90% | 92.31% | ✓ |
| Branches | >= 85% | 87.39% | ✓ (approved exception) |

## Branch Coverage Exception

**Approved**: Business exception for Sprint 0

**Current**: 87.39% (2.61% below 90%)

**Reason**: Rare logging/error fallback paths difficult to trigger in test scenarios

**Affected**: requestLogging (61.4%), auth.controller (82.79%), logs.controller (82.96%)

**Expiration**: Must reach 90% before production release

## Test Organization

| Type | Location | Count | Framework |
|------|----------|-------|-----------|
| Unit | tests/unit/ | 100+ | Mocha + Chai |
| Integration | tests/integration/ | 50+ | Mocha + Chai |
| E2E | tests/e2e/ | 30+ | Mocha + Chai |
| API | Postman | 30 assertions | Newman |

## Running Tests

```bash
npm run test              # All tests (212+)
npm run test:unit         # Unit only
npm run test:integration  # Integration only
npm run test:e2e          # E2E only
npm run test:coverage     # With coverage report
npm run lint              # ESLint check
```

## Postman/Newman Tests

30 assertions covering:
- Login (employee, HR admin, admin endpoint)
- Token refresh and rotation
- Session management (list, revoke)
- Admin logs (list, get, filter, export)
- RBAC enforcement (403 on employee access)
- Error cases (401, 400, 403)

Run:
```bash
npx newman run docs/postman/EMS-API.postman_collection.json \
  -e docs/postman/EMS.postman_environment.json
```

## Coverage Configuration

File: `.c8rc.json`
- Statements: 90%
- Functions: 90%
- Lines: 90%
- Branches: 85% (Sprint 0 exception)

View report:
```bash
npm run test:coverage
open coverage/index.html
```

## Test Requirements per Feature

1. Unit test (services/utils)
2. Integration test (API endpoint)
3. E2E test (complete flow)
4. Postman test (REST contract)
5. Coverage: >= 90% (statements/lines/functions)

## RBAC Testing Pattern

All protected endpoints verify:
- Correct role → 200
- Incorrect role → 403
- No auth → 401

## Known Limitations

1. **Branch Coverage**: 87.39% (approved exception at 85%)
2. **Session Revocation**: Token signature valid even when revoked
3. **Email Testing**: Not integrated until Page 02
4. **Rate Limiting**: Global config, per-route tests pending

## Future Improvements

- [ ] Increase branch coverage to 90%
- [ ] Add session status check to authenticate
- [ ] Email service integration tests
- [ ] Performance benchmarks
- [ ] Security scanning
