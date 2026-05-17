# Analytics API Documentation

## Overview

The Analytics API provides HR admins and super admins with dashboard metrics and insights across the organization.

**Access Control:** HR_ADMIN, SUPER_ADMIN only  
**Base URL:** `/api/v1/analytics`

---

## API Endpoints

### 1. GET /analytics/summary

**Description:** Dashboard summary with key employee metrics

**Query Parameters:**
- `departmentId` (optional): Filter by specific department

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEmployees": 150,
    "activeEmployees": 142,
    "inactiveEmployees": 8,
    "onLeaveToday": 5
  },
  "meta": {
    "cached": false,
    "generatedAt": "2025-01-15T10:30:00Z"
  }
}
```

**Database Tables Used:**
| Table | Operation | Reason |
|-------|-----------|--------|
| `Employee` | COUNT (WHERE tenantId, deletedAt=null) | Total headcount |
| `Employee` | COUNT (WHERE employmentStatus=ACTIVE) | Active employees |
| `Employee` | COUNT (WHERE employmentStatus=INACTIVE) | Inactive count |
| `LeaveRequest` | COUNT (WHERE status=APPROVED, dates overlap today) | Today's leaves |

**Composite Indexes Used:**
- `(tenantId, employmentStatus)` - Fast filtering by status
- `(tenantId, departmentId, employmentStatus)` - Filtered department queries

**Cache TTL:** 60 seconds

---

### 2. GET /analytics/attendance

**Description:** Attendance rates by department with date range filtering

**Query Parameters:**
- `startDate` (optional): ISO 8601 datetime (default: 30 days ago)
- `endDate` (optional): ISO 8601 datetime (default: today)
- `departmentId` (optional): Filter by department

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-01-01T00:00:00Z",
      "end": "2025-01-31T23:59:59Z"
    },
    "totalRecords": 2850,
    "byDepartment": {
      "dept-engineering": "96.5",
      "dept-sales": "94.2",
      "dept-operations": "92.8"
    }
  },
  "meta": {
    "cached": false,
    "generatedAt": "2025-01-15T10:30:00Z"
  }
}
```

**Database Tables Used:**
| Table | Operation | Reason |
|-------|-----------|--------|
| `AttendanceRecord` | FIND (WHERE tenantId, date range) | Fetch records in range |
| `Employee` | RELATION select (departmentId) | Get department info |

**Composite Indexes Used:**
- `(tenantId, attendanceDate)` - Date range queries
- `(employeeId, attendanceDate)` - Employee lookups
- `(tenantId, status, attendanceDate)` - Status + date filtering

**Cache TTL:** 60 seconds

---

### 3. GET /analytics/headcount-by-department

**Description:** Employee headcount distribution across all departments

**Query Parameters:**
- `excludeInactive` (optional): "true" to exclude inactive employees (default: false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "departmentId": "dept-001",
      "departmentName": "Engineering",
      "headcount": 48
    },
    {
      "departmentId": "dept-002",
      "departmentName": "Sales",
      "headcount": 35
    },
    {
      "departmentId": "dept-003",
      "departmentName": "Operations",
      "headcount": 28
    }
  ],
  "meta": {
    "cached": false,
    "generatedAt": "2025-01-15T10:30:00Z"
  }
}
```

**Database Tables Used:**
| Table | Operation | Reason |
|-------|-----------|--------|
| `Department` | FIND + COUNT (relation) | All departments with employee counts |
| `Employee` | RELATION aggregate | Count per department |

**Composite Indexes Used:**
- `(tenantId, employmentStatus)` - Filter by status when excluding inactive

**Cache TTL:** 300 seconds (5 minutes)

---

### 4. GET /analytics/recent-activity

**Description:** Latest audit log entries (system activity)

**Query Parameters:**
- `action` (optional): Filter by action type (e.g., "LOGIN", "CREATE", "UPDATE")
- `limit` (optional): Number of records (1-100, default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-001",
      "action": "LOGIN",
      "entityType": "User",
      "entityId": "user-001",
      "actor": "john.doe@company.com",
      "timestamp": "2025-01-15T10:28:45Z"
    },
    {
      "id": "log-002",
      "action": "CREATE",
      "entityType": "LeaveRequest",
      "entityId": "leave-001",
      "actor": "jane.smith@company.com",
      "timestamp": "2025-01-15T10:25:12Z"
    }
  ],
  "meta": {
    "cached": false,
    "generatedAt": "2025-01-15T10:30:00Z"
  }
}
```

**Database Tables Used:**
| Table | Operation | Reason |
|-------|-----------|--------|
| `AuditLog` | FIND (WHERE tenantId, action) | Recent logs |
| `User` | RELATION select (email) | Get actor details |

**Composite Indexes Used:**
- `(tenantId, createdAt, action)` - Time + action filtering
- `(tenantId, createdAt)` - Latest entries first

**Cache TTL:** 30 seconds

---

### 5. GET /analytics/leave-summary

**Description:** Leave usage statistics and breakdown

**Query Parameters:**
- `year` (optional): YYYY format (default: current year)
- `status` (optional): PENDING, APPROVED, or DENIED

**Response:**
```json
{
  "success": true,
  "data": {
    "year": 2025,
    "totalLeaves": 215,
    "byStatus": {
      "APPROVED": 185,
      "PENDING": 20,
      "DENIED": 10
    },
    "byType": {
      "leave-type-001": {
        "count": 120,
        "totalDays": 240
      },
      "leave-type-002": {
        "count": 95,
        "totalDays": 95
      }
    }
  },
  "meta": {
    "cached": false,
    "generatedAt": "2025-01-15T10:30:00Z"
  }
}
```

**Database Tables Used:**
| Table | Operation | Reason |
|-------|-----------|--------|
| `LeaveRequest` | COUNT + GROUPBY (status) | Status breakdown |
| `LeaveRequest` | GROUPBY (leaveTypeId) | Type breakdown |

**Composite Indexes Used:**
- `(tenantId, status, startDate)` - Status + date filtering
- `(tenantId, status)` - Quick status counts

**Cache TTL:** 60 seconds

---

## Performance Characteristics

### Response Times (Expected)

| Endpoint | DB Time | Cache Hit | Typical Total |
|----------|---------|-----------|---------------|
| `/summary` | 15-25ms | 1-2ms | 16-27ms |
| `/attendance` | 20-40ms | 1-2ms | 21-42ms |
| `/headcount-by-department` | 25-50ms | 1-2ms | 26-52ms |
| `/recent-activity` | 10-15ms | 1-2ms | 11-17ms |
| `/leave-summary` | 20-35ms | 1-2ms | 21-37ms |

### Index Strategy

All analytics endpoints use **composite indexes** to ensure sub-millisecond lookups:

```sql
-- Employee queries
ALTER TABLE Employee ADD INDEX idx_tenant_status (tenantId, employmentStatus);
ALTER TABLE Employee ADD INDEX idx_tenant_dept_status (tenantId, departmentId, employmentStatus);

-- Attendance queries
ALTER TABLE AttendanceRecord ADD INDEX idx_tenant_status_date (tenantId, status, attendanceDate);

-- Leave queries
ALTER TABLE LeaveRequest ADD INDEX idx_tenant_status_startdate (tenantId, status, startDate);

-- Audit log queries
ALTER TABLE AuditLog ADD INDEX idx_tenant_created_action (tenantId, createdAt, action);
```

---

## Error Responses

### 403 Forbidden (RBAC)

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Analytics access restricted to HR admins"
  }
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}
```

### 400 Bad Request (Invalid Parameters)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid startDate format"
  }
}
```

---

## Caching Strategy

All endpoints use Redis caching with tenant-scoped keys:

```
Key Format: analytics:{endpoint}:{tenantId}[:{param1}={value1}|{param2}={value2}]
```

**Cache Invalidation:** Automatic invalidation happens when:
- LeaveRequest, Employee, AttendanceRecord, or AuditLog records change
- Custom invalidation endpoint (admin only)

**Manual Invalidation:**
```
POST /api/v1/analytics/invalidate-cache
Headers: Authorization: Bearer <token>
Body: { "tenantId": "tenant-001" }
```

---

## Rate Limiting

All analytics endpoints are rate limited to protect database:

- **Limit:** 100 requests per minute per user
- **Window:** 1 minute rolling
- **Response Header:** `RateLimit-Remaining`

---

## Access Control Matrix

| Role | /summary | /attendance | /headcount | /recent-activity | /leave-summary |
|------|----------|------------|-----------|------------------|----------------|
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| HR_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| MANAGER | ✗ | ✗ | ✗ | ✗ | ✗ |
| EMPLOYEE | ✗ | ✗ | ✗ | ✗ | ✗ |
| AUDITOR | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## Testing

Run tests with:

```bash
npm run test:unit -- analytics
npm run test:integration -- analytics
npm run test:e2e -- analytics
```

See `tests/unit/analytics.service.test.js` and `tests/integration/analytics.routes.test.js` for test cases.
