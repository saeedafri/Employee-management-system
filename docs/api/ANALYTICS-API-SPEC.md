# HR Admin Dashboard - Analytics API Specification

## Overview
Page 04 Analytics APIs provide HR Admins with real-time dashboard data. All endpoints require `analytics:read` permission and tenant context via `x-tenant-key` header.

## API Endpoints

### 1. GET /api/v1/analytics/summary
**Purpose:** Overview metrics for dashboard header

**Authorization:** Bearer token + analytics:read

**Response (200 OK):**
```json
{
  "data": {
    "totalEmployees": 150,
    "activeToday": 120,
    "onLeaveToday": 15,
    "openRequests": 17
  },
  "meta": {
    "cached": false,
    "generatedAt": "2026-05-18T10:30:00.000Z"
  }
}
```

**Data Types & Constraints:**
- `totalEmployees` (integer): count of all employees in tenant
- `activeToday` (integer): employees marked present today
- `onLeaveToday` (integer): employees on approved leave today
- `openRequests` (integer): sum of pending leaves + pending regularizations
- `cached` (boolean): indicates if data came from Redis cache
- `generatedAt` (ISO 8601): timestamp when data was computed

**Caching:** 60 seconds (Redis)

---

### 2. GET /api/v1/analytics/attendance
**Purpose:** Attendance trends over time

**Authorization:** Bearer token + analytics:read

**Query Parameters:**
- `range` (string): `7d`, `30d`, or `90d` (default: `30d`)

**Response (200 OK):**
```json
{
  "data": {
    "range": "30d",
    "series": [
      {
        "date": "2026-04-18",
        "present": 120,
        "absent": 15,
        "leave": 10,
        "wfh": 5,
        "halfDay": 0
      },
      {
        "date": "2026-04-19",
        "present": 125,
        "absent": 12,
        "leave": 8,
        "wfh": 5,
        "halfDay": 0
      }
    ]
  },
  "meta": {
    "cached": false,
    "generatedAt": "2026-05-18T10:30:00.000Z"
  }
}
```

**Data Types & Constraints:**
- `range` (string): echoes the request range
- `series` (array): one entry per day in range
  - `date` (YYYY-MM-DD): day of attendance record
  - `present` (integer): count of PRESENT status
  - `absent` (integer): count of ABSENT status
  - `leave` (integer): count of LEAVE status
  - `wfh` (integer): count of WFH status
  - `halfDay` (integer): count of HALF_DAY status

**Caching:** 60 seconds

---

### 3. GET /api/v1/analytics/headcount-by-department
**Purpose:** Employee distribution across departments

**Authorization:** Bearer token + analytics:read

**Response (200 OK):**
```json
{
  "data": [
    {
      "departmentId": "dept-123",
      "departmentName": "Engineering",
      "employeeCount": 100,
      "activeCount": 90
    },
    {
      "departmentId": "dept-456",
      "departmentName": "Sales",
      "employeeCount": 50,
      "activeCount": 45
    }
  ],
  "meta": {
    "cached": false,
    "generatedAt": "2026-05-18T10:30:00.000Z"
  }
}
```

**Data Types & Constraints:**
- `departmentId` (string): unique department identifier
- `departmentName` (string): human-readable department name
- `employeeCount` (integer): total employees in department
- `activeCount` (integer): employees with status=ACTIVE

**Caching:** 300 seconds (5 minutes)

---

### 4. GET /api/v1/analytics/recent-activity
**Purpose:** Audit log of recent system changes

**Authorization:** Bearer token + analytics:read

**Query Parameters:**
- `limit` (integer): number of records to return (default: 10, max: 100)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "log-123",
      "actorName": "Hr-admin",
      "action": "CREATE",
      "entityType": "Employee",
      "entityId": "emp-001",
      "resourceLabel": "John Doe (EMP-001)",
      "createdAt": "2026-05-18T10:30:00.000Z",
      "createdAtIstDisplay": "18 May 2026, 04:00 PM IST"
    }
  ],
  "meta": {
    "cached": false,
    "generatedAt": "2026-05-18T10:30:00.000Z"
  }
}
```

**Data Types & Constraints:**
- `id` (string): audit log primary key
- `actorName` (string): first part of actor's email (e.g., "Hr-admin" from "hr-admin@acme.com")
- `action` (string): CREATE, UPDATE, DELETE, etc.
- `entityType` (string): type of entity modified (Employee, Department, LeaveRequest, etc.)
- `entityId` (string): ID of the entity
- `resourceLabel` (string): human-readable resource description
- `createdAt` (ISO 8601): UTC timestamp
- `createdAtIstDisplay` (string): IST timezone formatted timestamp

**Caching:** 30 seconds

---

### 5. GET /api/v1/analytics/leave-summary
**Purpose:** Leave request statistics

**Authorization:** Bearer token + analytics:read

**Query Parameters:**
- `range` (string): `7d`, `30d`, or `90d` (default: `30d`)

**Response (200 OK):**
```json
{
  "data": {
    "pending": 12,
    "approved": 45,
    "rejected": 8,
    "withdrawn": 0
  },
  "meta": {
    "cached": false,
    "generatedAt": "2026-05-18T10:30:00.000Z"
  }
}
```

**Data Types & Constraints:**
- `pending` (integer): count of PENDING status leaves in range
- `approved` (integer): count of APPROVED status leaves in range
- `rejected` (integer): count of DENIED status leaves in range
- `withdrawn` (integer): count of WITHDRAWN status leaves in range

**Caching:** 60 seconds

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization token"
  }
}
```

### 403 Forbidden
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions: analytics:read required"
  }
}
```

### 400 Bad Request
```json
{
  "error": {
    "code": "INVALID_RANGE",
    "message": "Range must be 7d, 30d, or 90d"
  }
}
```

---

## Database Models & Indexes

### attendance_records Table
- Index: `(tenant_id, attendance_date DESC)`
- Index: `(employee_id, attendance_date DESC)`
- Columns used: `tenantId`, `attendanceDate`, `status`

### employee Table
- Index: `(tenant_id, employment_status)`
- Columns used: `tenantId`, `employmentStatus`, `departmentId`

### department Table
- Columns used: `tenantId`, `name`, `id`

### leave_requests Table
- Index: `(tenant_id, status, start_date DESC)`
- Columns used: `tenantId`, `status`, `startDate`, `endDate`

### attendance_regularization_requests Table
- Index: `(tenant_id, status)`
- Columns used: `tenantId`, `status`

### audit_logs Table
- Index: `(tenant_id, created_at DESC)`
- Columns used: `tenantId`, `createdAt`, `actorUserId`, `action`, `entityType`

---

## Caching Strategy

All endpoints cache in Redis with the following TTLs:
- **summary:** 60 seconds
- **attendance:** 60 seconds
- **headcount-by-department:** 300 seconds
- **recent-activity:** 30 seconds
- **leave-summary:** 60 seconds

Cache invalidation happens on:
- Employee create/update/delete
- Leave request create/update
- Attendance record create/update
- Department updates

Cache key format: `analytics:{endpoint}:{tenantId}:{params}`

---

## Performance Notes

All queries are optimized to run within 500ms:
- **summary:** Single aggregation query with 4 count operations
- **attendance:** Pivot table aggregation by date
- **headcount-by-department:** Group by with active count subquery
- **recent-activity:** Sorted query with limit
- **leave-summary:** Grouped count by status

---

## Access Control

All endpoints require:
1. Valid JWT in Authorization header
2. `analytics:read` permission
3. Matching `x-tenant-key` header for tenant isolation

Permissions assigned to roles:
- **HR_ADMIN:** analytics:read ✓
- **SUPER_ADMIN:** analytics:read ✓
- **MANAGER:** analytics:read (partial - might be restricted to their department in future)
- **EMPLOYEE:** analytics:read ✗

---

## API Contract Verification Checklist

- [x] All 5 endpoints return 200 OK for authorized HR_ADMIN
- [x] All 5 endpoints return 401 for missing authorization
- [x] All 5 endpoints return 403 for users without analytics:read
- [x] Summary endpoint has totalEmployees, activeToday, onLeaveToday, openRequests
- [x] Attendance endpoint series contains date and all 5 status counts
- [x] Headcount endpoint has departmentName, employeeCount, activeCount
- [x] Recent activity endpoint has createdAtIstDisplay in IST timezone
- [x] Leave summary has pending, approved, rejected, withdrawn counts
- [x] Cache metadata (cached=true/false) included in all responses
- [x] Range parameter accepted for attendance and leave-summary
- [x] Limit parameter accepted for recent-activity
- [x] All endpoints require x-tenant-key header for tenant isolation
- [x] Response timestamps in generatedAt field

