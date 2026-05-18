# EMS Backend API Documentation

**Version**: 1.0.0  
**Base URL**: `http://localhost:3000/api/v1`  
**Production URL**: `https://ems-api.render.com/api/v1`

---

## Table of Contents
1. [Authentication](#authentication)
2. [Authorization](#authorization)
3. [API Endpoints](#api-endpoints)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)

---

## Authentication

### MFA Login Flow (OTP via Email)

**Endpoint**: `POST /auth/login`

```javascript
// Step 1: Initial login request
POST /api/v1/auth/login
Header: x-tenant-key: acme
Body: { "email": "user@company.com", "password": "SecurePass123!" }

Response (202 Accepted):
{
  "success": true,
  "data": {
    "mfaRequired": true,
    "challengeId": "uuid-here",
    "destinationMasked": "u***@company.com",
    "expiresIn": 600  // 10 minutes
  }
}

// Step 2: Verify OTP code (sent via email)
POST /api/v1/auth/verify-otp
Header: x-tenant-key: acme
Body: {
  "challengeId": "uuid-from-step1",
  "code": "123456"  // 6-digit code from email
}

Response (200 OK):
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "opaque-token",
    "sessionId": "session-id",
    "user": {
      "id": "user-id",
      "email": "user@company.com",
      "memberType": "EMPLOYEE"
    },
    "permissions": ["leave:read", "attendance:read"]
  }
}
```

### OTP Resend

**Endpoint**: `POST /auth/otp/resend`

- Cooldown: 60 seconds between requests
- Max resends: 3 per challenge
- OTP expires: 10 minutes

```javascript
POST /api/v1/auth/otp/resend
Body: { "challengeId": "uuid-here" }
```

### Refresh Token

**Endpoint**: `POST /auth/refresh`

```javascript
POST /api/v1/auth/refresh
Cookie: refreshToken=opaque-token
Header: x-tenant-key: acme

Response:
{
  "success": true,
  "data": { "accessToken": "new-jwt-token" }
}
```

### Logout

**Endpoint**: `POST /auth/logout`

```javascript
POST /api/v1/auth/logout
Authorization: Bearer access-token
Header: x-tenant-key: acme
```

---

## Authorization

All endpoints (except `/health` and login) require:

```javascript
Header: Authorization: Bearer <access_token>
Header: x-tenant-key: <tenant_key>
```

### Role-Based Access Control (RBAC)

| Role | Permissions | Endpoints |
|------|------------|-----------|
| **SUPER_ADMIN** | All | All endpoints |
| **HR_ADMIN** | Analytics, Employees, Leave, Attendance, Reports, Audit, Settings, Departments, Holidays | All except user/role management |
| **MANAGER** | Employees (team), Leave (team), Attendance (team), Analytics | Specific team endpoints |
| **EMPLOYEE** | Leave requests, Attendance check-in/out, Personal analytics, Attendance summary | Self-service only |
| **AUDITOR** | Read-only access to audit logs and reports | Audit endpoints only |

---

## API Endpoints

### 1. Authentication Endpoints (3 endpoints)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/auth/login` | No | - | Login with credentials (triggers MFA) |
| POST | `/auth/verify-otp` | No | - | Verify OTP code |
| POST | `/auth/otp/resend` | No | - | Resend OTP to email |
| POST | `/auth/refresh` | No | - | Refresh access token |
| POST | `/auth/logout` | Yes | All | Logout and invalidate session |
| POST | `/auth/password-reset` | No | - | Initiate password reset |
| POST | `/auth/password-reset/:token` | No | - | Complete password reset |

### 2. Employee Management Endpoints (3 endpoints)

#### List Employees

```javascript
GET /api/v1/employees
Query: page=1&limit=20&departmentId=dept-123&status=ACTIVE
Response:
{
  "success": true,
  "data": {
    "employees": [
      {
        "id": "emp-123",
        "email": "john@company.com",
        "firstName": "John",
        "lastName": "Doe",
        "employeeCode": "EMP001",
        "jobTitle": "Senior Developer",
        "department": { "id": "dept-123", "name": "Engineering" },
        "employmentStatus": "ACTIVE",
        "joinedOn": "2024-01-15"
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 20
  }
}
```

#### Get Employee Profile

```javascript
GET /api/v1/employees/:id
Response:
{
  "success": true,
  "data": {
    "id": "emp-123",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@company.com",
    "workEmail": "john@acme.com",
    "phone": "+1-555-0123",
    "employeeCode": "EMP001",
    "jobTitle": "Senior Developer",
    "department": { "id": "dept-123", "name": "Engineering" },
    "reportingManager": { "id": "mgr-456", "name": "Jane Smith" },
    "employmentType": "FULL_TIME",
    "employmentStatus": "ACTIVE",
    "workMode": "HYBRID",
    "joinedOn": "2024-01-15",
    "leaveBalance": [
      { "leaveType": "Annual", "total": 20, "used": 5, "available": 15 }
    ]
  }
}
```

#### Create/Update Employee

```javascript
POST /api/v1/employees
PATCH /api/v1/employees/:id
Auth: HR_ADMIN

Body:
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@company.com",
  "phone": "+1-555-0123",
  "jobTitle": "Senior Developer",
  "departmentId": "dept-123",
  "reportingManagerId": "mgr-456",
  "employmentType": "FULL_TIME",
  "workMode": "HYBRID"
}
```

#### Delete Employee

```javascript
DELETE /api/v1/employees/:id
Auth: HR_ADMIN
```

### 3. Department Management (4 endpoints)

#### List Departments (Hierarchical Tree)

```javascript
GET /api/v1/departments?includeArchived=false
Response:
{
  "success": true,
  "data": [
    {
      "id": "dept-1",
      "name": "Engineering",
      "code": "ENG",
      "parentId": null,
      "budget": 500000,
      "employees": 25,
      "children": [
        {
          "id": "dept-2",
          "name": "Backend",
          "parentId": "dept-1",
          "employees": 12,
          "children": []
        }
      ]
    }
  ]
}
```

#### Create Department

```javascript
POST /api/v1/departments
Auth: HR_ADMIN
Body:
{
  "name": "Engineering",
  "parentId": null,
  "departmentCode": "ENG",
  "budget": 500000
}
```

#### Update Department

```javascript
PATCH /api/v1/departments/:id
Auth: HR_ADMIN
Body: { "name": "Tech", "budget": 600000 }
```

#### Delete Department

```javascript
DELETE /api/v1/departments/:id
Auth: HR_ADMIN
```

### 4. Leave Management (6 endpoints)

#### Request Leave

```javascript
POST /api/v1/leave/requests
Body:
{
  "leaveTypeId": "lt-123",
  "startDate": "2026-05-20",
  "endDate": "2026-05-22",
  "reason": "Personal work",
  "documentUrl": "https://..."
}

Response:
{
  "success": true,
  "data": {
    "id": "req-123",
    "status": "PENDING",
    "daysRequested": 3,
    "approvedBy": null,
    "createdAt": "2026-05-18T10:00:00Z"
  }
}
```

#### List Leave Requests

```javascript
GET /api/v1/leave/requests?status=PENDING&page=1&limit=20
```

#### Approve/Reject Leave Request

```javascript
PATCH /api/v1/leave/requests/:id/approve
Auth: MANAGER or HR_ADMIN
Body: { "notes": "Approved" }

PATCH /api/v1/leave/requests/:id/reject
Body: { "notes": "Coverage not available" }
```

#### Withdraw Leave Request

```javascript
PATCH /api/v1/leave/requests/:id/withdraw
Body: { "notes": "Changed plans" }
```

#### Get Leave Balance

```javascript
GET /api/v1/leave/balance/:userId
Response:
{
  "success": true,
  "data": [
    {
      "leaveType": "Annual",
      "total": 20,
      "used": 5,
      "available": 15,
      "year": 2026
    }
  ]
}
```

### 5. Attendance Management (6 endpoints)

#### Check-In

```javascript
POST /api/v1/attendance/check-in
Body:
{
  "latitude": 37.7749,
  "longitude": -122.4194,
  "deviceId": "device-123"
}

Response:
{
  "success": true,
  "data": {
    "id": "att-123",
    "checkedInAt": "2026-05-18T09:00:00Z",
    "location": "Engineering Office",
    "distanceFromOffice": "0.5m"
  }
}
```

#### Check-Out

```javascript
POST /api/v1/attendance/check-out
Body: { "deviceId": "device-123" }

Response:
{
  "success": true,
  "data": {
    "duration": "PT8H30M",  // ISO 8601 duration
    "checkedOutAt": "2026-05-18T17:30:00Z"
  }
}
```

#### Get Attendance Records

```javascript
GET /api/v1/attendance/records?startDate=2026-05-01&endDate=2026-05-31&page=1
Response:
{
  "success": true,
  "data": {
    "records": [
      {
        "date": "2026-05-18",
        "checkedInAt": "09:00:00",
        "checkedOutAt": "17:30:00",
        "duration": "8.5 hours",
        "status": "PRESENT"
      }
    ],
    "summary": {
      "present": 18,
      "absent": 0,
      "halfDay": 0
    }
  }
}
```

#### Get Team Attendance

```javascript
GET /api/v1/attendance/team/records
Auth: MANAGER
Query: date=2026-05-18&departmentId=dept-123
```

#### Request Regularization

```javascript
POST /api/v1/attendance/regularization
Body:
{
  "date": "2026-05-15",
  "type": "LATE_ARRIVAL",
  "reason": "Traffic",
  "documentUrl": "https://..."
}
```

### 6. Holidays Management (4 endpoints)

#### List Holidays

```javascript
GET /api/v1/holidays?year=2026&country=US
Response:
{
  "success": true,
  "data": {
    "holidays": [
      {
        "id": "hol-1",
        "name": "Independence Day",
        "date": "2026-07-04",
        "isOptional": false,
        "location": "US"
      }
    ],
    "total": 12
  }
}
```

#### Create Holiday

```javascript
POST /api/v1/holidays
Auth: HR_ADMIN
Body:
{
  "name": "Company Anniversary",
  "holidayDate": "2026-06-15",
  "location": "IN",
  "isOptional": false
}
```

#### Update/Delete Holiday

```javascript
PATCH /api/v1/holidays/:id
DELETE /api/v1/holidays/:id
Auth: HR_ADMIN
```

### 7. Reports (8 endpoints)

#### Attendance Report

```javascript
GET /api/v1/reports/attendance
Query: startDate=2026-05-01&endDate=2026-05-31&departmentId=dept-123
```

#### Leave Report

```javascript
GET /api/v1/reports/leaves
Query: status=APPROVED&leaveType=ANNUAL&year=2026
```

#### Payroll Report

```javascript
GET /api/v1/reports/payroll
Query: month=5&year=2026
Auth: HR_ADMIN or MANAGER
```

#### Schedule Report

```javascript
POST /api/v1/reports/schedule
Body:
{
  "reportType": "ATTENDANCE",
  "schedule": "MONTHLY",
  "recipientEmails": ["hr@company.com"],
  "timezone": "UTC"
}
```

#### Export Report

```javascript
POST /api/v1/export/employees
Body: { "format": "CSV", "fields": ["email", "department", "joinDate"] }
```

### 8. Audit & Settings

#### Get Audit Logs

```javascript
GET /api/v1/audit-logs?action=USER_LOGIN&limit=50
Auth: HR_ADMIN or AUDITOR
```

#### Tenant Settings

```javascript
GET /api/v1/settings/tenant
PATCH /api/v1/settings/tenant
Auth: HR_ADMIN

Body:
{
  "name": "Company Name",
  "timezone": "America/New_York",
  "dateFormat": "MM/DD/YYYY",
  "attendanceGeofenceRadius": 100
}
```

#### Email Templates

```javascript
GET /api/v1/settings/email-templates
PATCH /api/v1/settings/email-templates/:type
Auth: HR_ADMIN

Example types: otp_verification, password_reset, leave_approval
```

---

## Error Handling

All errors follow this format:

```javascript
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "statusCode": 401
  },
  "meta": { "requestId": "req-123" }
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `UNAUTHORIZED` | 401 | Missing/invalid auth token |
| `FORBIDDEN` | 403 | User lacks required permissions |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `INVALID_REQUEST` | 400 | Bad request body/params |
| `DUPLICATE_ENTRY` | 409 | Resource already exists |
| `OTP_INVALID` | 400 | Wrong OTP code |
| `OTP_EXPIRED` | 400 | OTP code expired |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

---

## Rate Limiting

- **Global**: 100 requests/minute per IP
- **Auth endpoints**: 5 requests/minute for login, 3 requests/minute for OTP
- **Export endpoints**: 5 requests/hour per user

Response headers:
```javascript
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1652934015
```

---

## Pagination

List endpoints support pagination:

```javascript
Query: page=1&limit=20&sort=-createdAt

Response:
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 450,
    "totalPages": 23
  }
}
```

---

## Webhooks / Async Jobs

Export jobs are processed asynchronously:

```javascript
POST /api/v1/export/employees
Response: { "jobId": "job-123" }

// Poll for job status
GET /api/v1/export/:jobId/status
Response: {
  "status": "COMPLETED",
  "progress": 100,
  "downloadUrl": "/exports/job-123.csv"
}
```

---

## Examples

### Full Authentication Flow

```bash
#!/bin/bash
TENANT="acme"
EMAIL="user@company.com"
PASSWORD="SecurePass123!"

# Step 1: Login to get OTP challenge
CHALLENGE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "x-tenant-key: $TENANT" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.data.challengeId')

echo "Check email for OTP code, then run:"
echo "curl -X POST http://localhost:3000/api/v1/auth/verify-otp \\"
echo "  -H 'x-tenant-key: $TENANT' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"challengeId\":\"$CHALLENGE\",\"code\":\"XXXXXX\"}'"
```

---

## Support & Issues

- **Documentation**: https://ems.company.com/docs
- **API Status**: https://status.ems.company.com
- **Report Issues**: https://github.com/company/ems-backend/issues
