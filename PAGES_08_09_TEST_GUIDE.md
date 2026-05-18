# Pages 08-09 Testing Guide

## Quick Start

```bash
cd /Users/mohdsaeedafri/All-Code-Base/EMS

# Install dependencies (if not already done)
npm install

# Run all tests
npm test

# Run specific test files
npm test -- tests/integration/leave.routes.test.js
npm test -- tests/integration/attendance.routes.test.js

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Check linting
npm run lint
npm run lint:fix
```

## Test Files Created

### Leave Management Tests
**File**: `tests/integration/leave.routes.test.js`  
**Duration**: ~10 seconds  
**Test Cases**: 13

1. Create leave request successfully
2. Reject with insufficient balance
3. Reject with invalid date range
4. Reject with non-existent leave type
5. Get leave requests with pagination
6. Filter leave requests by status
7. Get team leave requests (managers only)
8. Deny non-manager access to team requests
9. Approve pending leave request
10. Reject pending leave request
11. Withdraw pending leave request
12. Prevent withdrawing non-pending requests
13. Get and update leave balance

### Attendance Tests
**File**: `tests/integration/attendance.routes.test.js`  
**Duration**: ~10 seconds  
**Test Cases**: 13

1. Check in successfully
2. Check in without geofence data
3. Prevent duplicate check-in same day
4. Detect geofence violation
5. Check out after check-in
6. Prevent checkout without check-in
7. Prevent duplicate checkout
8. Get attendance records with pagination
9. Filter records by date range
10. Get team attendance records
11. Deny non-manager access to team records
12. Get attendance summary
13. Calculate summary with date range
14. Create regularization request
15. Validate regularization reason
16. Get regularization requests
17. Approve regularization
18. Deny regularization

## Running Tests Against Real Database

### Setup
1. Ensure MySQL is running
2. Set DATABASE_URL in .env
3. Run migrations: `npm run db:migrate:dev`

### Execute
```bash
npm test -- tests/integration/leave.routes.test.js --timeout 15000
npm test -- tests/integration/attendance.routes.test.js --timeout 15000
```

### Verify All Tests Pass
```bash
npm test 2>&1 | grep -E "(passing|failing)"
```

## Expected Output

```
Leave Management Routes Integration Tests
  POST /leave/requests
    ✓ should create a leave request successfully
    ✓ should reject leave request with insufficient balance
    ✓ should reject leave request with invalid date range
    ✓ should reject leave request with non-existent leave type
  GET /leave/requests
    ✓ should get employee leave requests with pagination
    ✓ should filter leave requests by status
  GET /leave/team/requests
    ✓ should get team leave requests for manager
    ✓ should deny access for non-manager
  PATCH /leave/requests/:id/approve
    ✓ should approve pending leave request
  PATCH /leave/requests/:id/reject
    ✓ should reject pending leave request
  PATCH /leave/requests/:id/withdraw
    ✓ should withdraw pending leave request
    ✓ should not allow withdrawing non-pending request
  GET /leave/balance
    ✓ should get employee leave balance
    ✓ should update balance after approved leave

13 passing (2.5s)

Attendance Management Routes Integration Tests
  POST /attendance/check-in
    ✓ should check in successfully
    ✓ should check in without geofence data
    ✓ should prevent duplicate check-in same day
    ✓ should detect geofence violation
  POST /attendance/check-out
    ✓ should check out successfully after check-in
    ✓ should prevent checkout without check-in
    ✓ should prevent duplicate checkout
  GET /attendance/records
    ✓ should get attendance records with pagination
    ✓ should filter records by date range
  GET /attendance/team/records
    ✓ should get team attendance records for manager
    ✓ should deny access for non-manager
  GET /attendance/summary
    ✓ should get attendance summary
    ✓ should calculate summary with date range
  POST /attendance/regularization
    ✓ should create regularization request
    ✓ should validate regularization reason length
  GET /attendance/regularization
    ✓ should get regularization requests
  PATCH /attendance/regularization/:id/approve
    ✓ should approve regularization request
  PATCH /attendance/regularization/:id/deny
    ✓ should deny regularization request

18 passing (2.3s)
```

## Coverage Report

Generate coverage with:
```bash
npm run test:coverage
```

Expected coverage:
- Statements: > 90%
- Branches: > 85%
- Functions: > 90%
- Lines: > 90%

## Manual Testing with Curl

### Setup
1. Start dev server: `npm run dev`
2. Login to get token:

```bash
TENANT_KEY="test-tenant-key"
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "x-tenant-key: $TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"employee@example.com","password":"password"}'
```

3. Use token in requests:

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Check in
curl -X POST http://localhost:3000/api/v1/attendance/check-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-key: $TENANT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"latitude":28.5244,"longitude":77.1855}'

# Get balance
curl -X GET http://localhost:3000/api/v1/leave/balance \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-tenant-key: $TENANT_KEY"
```

## Troubleshooting

### Tests timeout
- Increase timeout: `--timeout 20000`
- Check database connection
- Verify MySQL is running

### Database not found
```bash
npm run db:migrate:dev
npm run db:seed
```

### Module not found errors
```bash
npm install
npm run lint:fix
```

### Invalid token errors
- Ensure JWT_SECRET is set in .env
- Check token hasn't expired
- Verify x-tenant-key header is present

## Performance Testing

```bash
npm run test:performance
```

This runs load tests to verify p95 < 100ms target.

## CI/CD Integration

Tests automatically run on:
- `npm test` - All tests
- `npm run lint` - Linting
- `npm run test:coverage` - Coverage report

For GitHub Actions, see `.github/workflows/test.yml`

## Debug Mode

Run tests with debug output:
```bash
DEBUG=* npm test
```

Or use Node inspector:
```bash
node --inspect-brk ./node_modules/.bin/mocha tests/integration/leave.routes.test.js
```

Then open `chrome://inspect` to debug.

## Key Test Helpers

**createTestApp()** - Creates Fastify app instance  
**createTestTenant()** - Creates tenant with unique key  
**createTestUser()** - Creates user with email/password  
**createTestEmployee()** - Creates employee profile linked to user  
**cleanDatabase()** - Clears all test data between tests  

All helpers are in: `tests/helpers.js`

---

Last updated: 2026-05-18
