# Analytics API Documentation - Page 04 HR Admin Dashboard

## Overview

The Analytics API powers the HR Admin Dashboard, providing key metrics for organizational oversight.

**Access Control:** HR_ADMIN, SUPER_ADMIN only  
**Base URL:** `/api/v1/analytics`

---

## API Endpoints

### 1. GET /analytics/summary

**Wireframe:** Page 04 - Dashboard Summary Cards  
**Widget:** Total Employees, Active Today, On Leave Today, Open Requests

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEmployees": 1240,
    "activeToday": 1087,
    "onLeaveToday": 84,
    "openRequests": 23
  },
  "meta": {
    "cached": true,
    "generatedAt": "2026-05-18T10:30:00Z"
  }
}
```

**Tables/Models Read:**
- `Employee` (count where tenantId, deletedAt=null)
- `AttendanceRecord` (count where tenantId, attendanceDate=today, status=PRESENT)
- `LeaveRequest` (count where tenantId, status=APPROVED, dates overlap today)
- `AttendanceRegularizationRequest` (count where tenantId, status=PENDING)

**Cache:**
- Key: `analytics:summary:{tenantId}`
- TTL: 60 seconds

---

### 2. GET /analytics/attendance

**Wireframe:** Page 04 - Attendance Chart (last 30 days)  
**Widget:** Time-series attendance by day

**Query Parameters:**
- `range` (optional): `7d`, `30d`, `90d` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "range": "30d",
    "series": [
      {
        "date": "2026-04-18",
        "present": 1045,
        "absent": 12,
        "leave": 45,
        "wfh": 85,
        "halfDay": 53
      },
      {
        "date": "2026-04-19",
        "present": 1052,
        "absent": 8,
        "leave": 42,
        "wfh": 82,
        "halfDay": 56
      }
    ]
  },
  "meta": {
    "cached": true,
    "generatedAt": "2026-05-18T10:30:00Z"
  }
}
```

**Tables/Models Read:**
- `AttendanceRecord` (WHERE tenantId, attendanceDate between range)

**Implementation:**
- Query all records in range
- Group by attendanceDate and status
- Fill missing dates with zeros for stable chart rendering

**Cache:**
- Key: `analytics:attendance:{tenantId}:range={range}`
- TTL: 60 seconds

---

### 3. GET /analytics/headcount-by-department

**Wireframe:** Page 04 - Headcount by Department Table  
**Widget:** Department headcount distribution

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "departmentId": "dept-001",
      "departmentName": "Engineering",
      "employeeCount": 412,
      "activeCount": 390
    },
    {
      "departmentId": "dept-002",
      "departmentName": "Sales",
      "employeeCount": 285,
      "activeCount": 268
    }
  ],
  "meta": {
    "cached": true,
    "generatedAt": "2026-05-18T10:30:00Z"
  }
}
```

**Tables/Models Read:**
- `Department` (WHERE tenantId, deletedAt=null)
- `Employee` (grouped by departmentId)

**Implementation:**
- List all departments
- For each department, count total and active employees
- Return sorted by department name

**Cache:**
- Key: `analytics:headcount-by-department:{tenantId}`
- TTL: 300 seconds (5 minutes)

---

### 4. GET /analytics/recent-activity

**Wireframe:** Page 04 - Recent Activity Table  
**Widget:** Latest 10 system activities

**Query Parameters:**
- `limit` (optional): 1-50 (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-001",
      "actorName": "Priya S.",
      "action": "created",
      "entityType": "Employee",
      "entityId": "emp-001",
      "resourceLabel": "Employee #EMP-0",
      "createdAt": "2026-05-18T10:25:00Z",
      "createdAtIstDisplay": "18/05/2026 03:55:00 PM IST"
    }
  ],
  "meta": {
    "cached": false,
    "generatedAt": "2026-05-18T10:30:00Z"
  }
}
```

**Tables/Models Read:**
- `AuditLog` (WHERE tenantId, ORDER BY createdAt DESC, LIMIT)
- `User` (for actor email → name extraction)

**Implementation:**
- Extract first name from actor email
- Format name from email parts (e.g., "priya.sharma@" → "Priya Sharma")
- Format timestamp as DD/MM/YYYY HH:MM:SS AM/PM IST
- Resource label: `{entityType} #{first 5 chars of entityId}`

**Cache:**
- Key: `analytics:recent-activity:{tenantId}:limit={limit}`
- TTL: 30 seconds

---

### 5. GET /analytics/leave-summary

**Wireframe:** Page 04 - Leave Summary Cards  
**Widget:** Leave status breakdown

**Query Parameters:**
- `range` (optional): `7d`, `30d`, `90d` (default: `30d`)

**Response:**
```json
{
  "success": true,
  "data": {
    "pending": 12,
    "approved": 185,
    "rejected": 8,
    "withdrawn": 3
  },
  "meta": {
    "cached": true,
    "generatedAt": "2026-05-18T10:30:00Z"
  }
}
```

**Tables/Models Read:**
- `LeaveRequest` (WHERE tenantId, startDate within range)

**Implementation:**
- Query leaves with startDate >= (today - range_days)
- Group by status
- Map Prisma enum to API response:
  - PENDING → pending
  - APPROVED → approved
  - DENIED → rejected
  - WITHDRAWN → withdrawn

**Cache:**
- Key: `analytics:leave-summary:{tenantId}:range={range}`
- TTL: 60 seconds

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid range parameter"
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

### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Analytics access restricted to HR admins"
  }
}
```

---

## Access Control

| Endpoint | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | AUDITOR |
|----------|------------|---------|---------|----------|---------|
| /summary | ✅ | ✅ | ❌ | ❌ | ❌ |
| /attendance | ✅ | ✅ | ❌ | ❌ | ❌ |
| /headcount-by-department | ✅ | ✅ | ❌ | ❌ | ❌ |
| /recent-activity | ✅ | ✅ | ❌ | ❌ | ❌ |
| /leave-summary | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## Rate Limiting

All endpoints: 100 requests per minute per user

---

## Performance

Expected response times with Redis cache warm:
- summary: 1-2ms
- attendance: 1-2ms
- headcount-by-department: 1-2ms
- recent-activity: 1-2ms
- leave-summary: 1-2ms

Without cache (database queries): 15-50ms per endpoint

---

## Frontend Integration

These APIs power the following frontend components:

1. **Dashboard Summary Cards** → GET /analytics/summary
2. **Attendance Chart** → GET /analytics/attendance?range=30d
3. **Headcount by Department** → GET /analytics/headcount-by-department
4. **Recent Activity Table** → GET /analytics/recent-activity?limit=10
5. **Leave Summary** → GET /analytics/leave-summary?range=30d
