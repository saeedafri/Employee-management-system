# Page 04: HR Admin Dashboard Analytics APIs

## Overview
Five read-only analytics APIs with Redis caching (1-hour TTL) and RBAC enforcement (HR_ADMIN, SUPER_ADMIN only).

## API Endpoints

### 1. Dashboard Summary
**GET /api/v1/analytics/dashboard-summary**
- Total employees
- Active/inactive/on-leave count
- Department breakdown
- Last 7 days new hires

Cache: 1 hour
RBAC: HR_ADMIN, SUPER_ADMIN

Response:
```json
{
  "success": true,
  "data": {
    "totalEmployees": 125,
    "activeEmployees": 120,
    "inactiveEmployees": 5,
    "onLeaveToday": 8,
    "departmentBreakdown": {
      "Engineering": 45,
      "Sales": 30,
      "HR": 10,
      "Finance": 20,
      "Operations": 20
    },
    "newHiresLast7Days": 3
  },
  "meta": { "cachedAt": "2026-05-17T10:00:00Z" }
}
```

### 2. Attendance Analytics
**GET /api/v1/analytics/attendance**
- Query: startDate, endDate, department
- Attendance rate by employee/department
- Trends (daily, weekly)
- Absent/late patterns

Cache: 2 hours
RBAC: HR_ADMIN, SUPER_ADMIN

### 3. Leave Analytics
**GET /api/v1/analytics/leave**
- Query: year, department
- Leave balance by type
- Leave usage trends
- Pending approval count
- Leave reasons distribution

Cache: 2 hours
RBAC: HR_ADMIN, SUPER_ADMIN

### 4. Payroll Analytics
**GET /api/v1/analytics/payroll**
- Query: month, department
- Total salary cost
- Salary distribution
- Deduction breakdown
- Payroll processing status

Cache: 4 hours
RBAC: HR_ADMIN, SUPER_ADMIN

### 5. Department Analytics
**GET /api/v1/analytics/department/:id**
- Department metrics
- Team composition
- Performance indicators
- Headcount trends
- Budget vs actual

Cache: 2 hours
RBAC: HR_ADMIN, SUPER_ADMIN

## Implementation Details

### File Structure
```
src/modules/analytics/
├── analytics.service.js      (Business logic with caching)
├── analytics.controller.js   (Request handlers)
├── analytics.routes.js       (Route definitions)
├── analytics.validator.js    (Zod schemas)
└── analytics.cache.js        (Redis cache utilities)
```

### Cache Strategy
```javascript
const getCacheKey = (endpoint, params) => 
  `analytics:${endpoint}:${JSON.stringify(params)}`;

const getCachedOrFetch = async (key, fetchFn, ttl) => {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const result = await fetchFn();
  await redis.setex(key, ttl, JSON.stringify(result));
  return result;
};
```

### RBAC Enforcement
```javascript
const requireAnalyticsAccess = (req, res, next) => {
  const { memberType } = req.user;
  if (!['HR_ADMIN', 'SUPER_ADMIN'].includes(memberType)) {
    return res.status(403).send(
      errorResponse('FORBIDDEN', 'Analytics access restricted')
    );
  }
  next();
};
```

### Audit Logging
- Log all analytics queries
- Track cache hits/misses
- Monitor performance metrics
- Alert on slow queries (>1s)

## Testing

### Unit Tests
- Cache hit/miss scenarios
- Parameter validation
- RBAC permission checks
- Calculation accuracy

### Integration Tests
- End-to-end API flow
- Cache invalidation
- Date range handling
- Department filtering

### E2E Tests
- Full dashboard workflow
- Multi-user access
- Performance under load
- Cache expiry behavior

## Postman Collection
Add endpoints with:
- Parameterized requests
- Environment variables for dates
- Test assertions for response structure
- Performance benchmarks

## Migration Required
```sql
-- Add analytics tables (optional, for faster queries)
CREATE TABLE employee_analytics (
  id CHAR(24) PRIMARY KEY,
  date DATE,
  tenant_id CHAR(24),
  total_employees INT,
  active_employees INT,
  on_leave_count INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX idx_analytics_date ON employee_analytics(date, tenant_id);
```

## Performance Targets
- Dashboard summary: <200ms (cached: <10ms)
- Attendance analytics: <500ms (cached: <50ms)
- Leave analytics: <500ms (cached: <50ms)
- Payroll analytics: <800ms (cached: <100ms)
- Department analytics: <400ms (cached: <40ms)

## Security Considerations
- Sensitive data (salary) visible only to SUPER_ADMIN
- HR_ADMIN sees department-level data
- No employee-level salary visible to HR_ADMIN
- All queries logged for audit
- Rate limiting: 100 requests/minute/user
