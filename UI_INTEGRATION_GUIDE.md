# EMS Frontend - Backend API Integration Guide

**For**: UI/Frontend Team  
**Last Updated**: May 18, 2026  
**Backend Version**: 1.0.0  
**Framework**: React, Vue, or any modern JavaScript framework  

---

## Quick Reference

### Base URL & Headers

```javascript
const API_BASE = 'http://localhost:3000/api/v1';  // Development
const API_PROD = 'https://ems-api.render.com/api/v1';  // Production

// All requests require headers:
{
  'Content-Type': 'application/json',
  'x-tenant-key': 'acme',  // Your tenant identifier
  'Authorization': 'Bearer ' + accessToken  // Except login/signup
}
```

---

## 1. Authentication Integration

### Login with MFA/OTP

```javascript
// Step 1: User enters credentials
async function login(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-key': 'acme'
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (data.data.mfaRequired) {
    // Show OTP input screen
    return {
      mfaRequired: true,
      challengeId: data.data.challengeId,
      destinationMasked: data.data.destinationMasked,  // Show "m***@gmail.com"
      expiresIn: data.data.expiresIn  // 600 seconds (10 min)
    };
  }
  
  // Store tokens
  localStorage.setItem('accessToken', data.data.accessToken);
  document.cookie = `refreshToken=${data.data.refreshToken}; HttpOnly`;
  return { success: true, user: data.data.user };
}

// Step 2: User enters 6-digit OTP code from email
async function verifyOtp(challengeId, code) {
  const response = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-key': 'acme'
    },
    body: JSON.stringify({ challengeId, code })
  });
  
  const data = await response.json();
  if (response.ok) {
    localStorage.setItem('accessToken', data.data.accessToken);
    return { success: true, user: data.data.user };
  }
  return { success: false, error: data.error.message };
}

// Step 3: Resend OTP if user doesn't receive it
async function resendOtp(challengeId) {
  const response = await fetch(`${API_BASE}/auth/otp/resend`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tenant-key': 'acme'
    },
    body: JSON.stringify({ challengeId })
  });
  
  const data = await response.json();
  if (!response.ok) {
    if (data.error.code === 'OTP_RESEND_COOLDOWN') {
      // Show: "Please wait X seconds before requesting another code"
      console.log(`Wait ${data.error.details.cooldownSeconds}s`);
    }
  }
  return data;
}

// Step 4: Logout
async function logout() {
  const token = localStorage.getItem('accessToken');
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-tenant-key': 'acme'
    }
  });
  
  localStorage.removeItem('accessToken');
  document.cookie = 'refreshToken=; max-age=0';
}
```

---

## 2. Employee Management

### List Employees (with pagination & filters)

```javascript
async function getEmployees(filters = {}) {
  const params = new URLSearchParams({
    page: filters.page || 1,
    limit: filters.limit || 20,
    departmentId: filters.departmentId || '',
    status: filters.status || 'ACTIVE',
    sort: filters.sort || '-createdAt'
  });
  
  const response = await fetch(`${API_BASE}/employees?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    }
  });
  
  const data = await response.json();
  return {
    employees: data.data.employees,
    pagination: {
      page: data.data.page,
      pageSize: data.data.pageSize,
      total: data.data.total
    }
  };
}
```

**Table Display Template:**

```javascript
// Columns to display
const columns = [
  { key: 'employeeCode', label: 'Employee ID', width: '10%' },
  { key: 'firstName', label: 'Name', width: '20%', 
    render: (emp) => `${emp.firstName} ${emp.lastName}` },
  { key: 'email', label: 'Email', width: '25%' },
  { key: 'jobTitle', label: 'Job Title', width: '20%' },
  { key: 'department.name', label: 'Department', width: '15%' },
  { key: 'actions', label: '', width: '10%',
    render: (emp) => `<button onclick="viewProfile('${emp.id}')">View</button>` }
];
```

### Get Employee Profile (with leave balance)

```javascript
async function getEmployeeProfile(employeeId) {
  const response = await fetch(`${API_BASE}/employees/${employeeId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    }
  });
  
  const data = await response.json();
  return {
    id: data.data.id,
    firstName: data.data.firstName,
    lastName: data.data.lastName,
    email: data.data.email,
    jobTitle: data.data.jobTitle,
    department: data.data.department.name,
    reportingManager: data.data.reportingManager?.name,
    leaveBalance: data.data.leaveBalance,  // Array of leave types with balance
    joinedOn: data.data.joinedOn,
    // ... other fields
  };
}

// Display leave balance as progress bars
function displayLeaveBalance(leaveBalance) {
  return leaveBalance.map(balance => ({
    type: balance.leaveType,
    total: balance.total,
    used: balance.used,
    available: balance.available,
    percentage: (balance.used / balance.total) * 100
  }));
}
```

### Create/Edit Employee

```javascript
async function saveEmployee(employeeData) {
  const method = employeeData.id ? 'PATCH' : 'POST';
  const endpoint = employeeData.id 
    ? `/employees/${employeeData.id}`
    : '/employees';
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    },
    body: JSON.stringify({
      firstName: employeeData.firstName,
      lastName: employeeData.lastName,
      email: employeeData.email,
      phone: employeeData.phone,
      jobTitle: employeeData.jobTitle,
      departmentId: employeeData.departmentId,
      reportingManagerId: employeeData.reportingManagerId,
      employmentType: employeeData.employmentType,  // FULL_TIME, PART_TIME, CONTRACT
      workMode: employeeData.workMode  // OFFICE, REMOTE, HYBRID
    })
  });
  
  return await response.json();
}
```

---

## 3. Department Management

### Department Hierarchy/Tree View

```javascript
async function getDepartmentTree() {
  const response = await fetch(`${API_BASE}/departments?includeArchived=false`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    }
  });
  
  const data = await response.json();
  // Returns nested structure with children array
  return data.data;
}

// Example tree structure:
// [
//   {
//     id: "dept-1",
//     name: "Engineering",
//     employees: 25,
//     children: [
//       { id: "dept-2", name: "Backend", employees: 12, children: [] }
//     ]
//   }
// ]

// Render as org chart
function renderOrgChart(departments) {
  return departments.map(dept => `
    <div class="department">
      <h3>${dept.name}</h3>
      <p>${dept.employees} employees</p>
      ${dept.children.length > 0 ? 
        `<div class="children">${renderOrgChart(dept.children)}</div>` 
        : ''}
    </div>
  `).join('');
}
```

---

## 4. Leave Management

### Request Leave

```javascript
async function requestLeave(leaveData) {
  const response = await fetch(`${API_BASE}/leave/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    },
    body: JSON.stringify({
      leaveTypeId: leaveData.leaveTypeId,  // ID of leave type (Annual, Sick, etc.)
      startDate: leaveData.startDate,      // YYYY-MM-DD
      endDate: leaveData.endDate,
      reason: leaveData.reason,
      documentUrl: leaveData.documentUrl   // Optional: attachment URL
    })
  });
  
  const data = await response.json();
  if (response.ok) {
    return { success: true, requestId: data.data.id };
  }
  return { success: false, error: data.error.message };
}
```

### Get Leave Requests (for manager approval)

```javascript
async function getLeaveRequests(filters = {}) {
  const params = new URLSearchParams({
    status: filters.status || 'PENDING',  // PENDING, APPROVED, REJECTED
    page: filters.page || 1,
    limit: filters.limit || 20
  });
  
  const response = await fetch(`${API_BASE}/leave/requests?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    }
  });
  
  return await response.json();
}

// Approve/Reject leave
async function approveLeave(requestId, notes = '') {
  const response = await fetch(`${API_BASE}/leave/requests/${requestId}/approve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    },
    body: JSON.stringify({ notes })
  });
  return await response.json();
}

async function rejectLeave(requestId, notes = '') {
  const response = await fetch(`${API_BASE}/leave/requests/${requestId}/reject`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    },
    body: JSON.stringify({ notes })
  });
  return await response.json();
}
```

---

## 5. Attendance Management

### Check-In/Check-Out

```javascript
// Get user's geolocation
navigator.geolocation.getCurrentPosition((position) => {
  const { latitude, longitude } = position.coords;
  
  // Send check-in to backend
  fetch(`${API_BASE}/attendance/check-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    },
    body: JSON.stringify({
      latitude,
      longitude,
      deviceId: getDeviceId()  // Generate unique device ID
    })
  }).then(r => r.json()).then(data => {
    if (data.success) {
      showNotification(`Checked in at ${data.data.location}`);
    } else {
      showError(data.error.message);  // "You are too far from office"
    }
  });
});

// Check-out
fetch(`${API_BASE}/attendance/check-out`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'x-tenant-key': 'acme'
  },
  body: JSON.stringify({ deviceId: getDeviceId() })
}).then(r => r.json()).then(data => {
  if (data.success) {
    showNotification(`Checked out. Duration: ${data.data.duration}`);
  }
});
```

### Attendance Calendar

```javascript
async function getAttendanceRecords(startDate, endDate) {
  const params = new URLSearchParams({
    startDate,  // YYYY-MM-DD
    endDate,
    page: 1,
    limit: 31
  });
  
  const response = await fetch(`${API_BASE}/attendance/records?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    }
  });
  
  const data = await response.json();
  return data.data.records;  // Array of daily attendance records
}

// Display as calendar
// 2026-05-18: PRESENT (09:00-17:30)
// 2026-05-19: ABSENT
// 2026-05-20: HALF_DAY (09:00-12:00)
```

---

## 6. Holidays & Reports

### List Holidays (for calendar display)

```javascript
async function getHolidays(year, country = 'US') {
  const response = await fetch(`${API_BASE}/holidays?year=${year}&country=${country}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    }
  });
  
  const data = await response.json();
  return data.data.holidays;  // Array of holiday objects
}

// Example holiday:
// {
//   id: "hol-1",
//   name: "Independence Day",
//   date: "2026-07-04",
//   isOptional: false,
//   location: "US"
// }

// Highlight holidays in calendar
function markHolidaysOnCalendar(holidays) {
  holidays.forEach(holiday => {
    const dateEl = document.querySelector(`[data-date="${holiday.date}"]`);
    if (dateEl) {
      dateEl.classList.add('holiday');
      dateEl.title = holiday.name;
    }
  });
}
```

### Generate Reports

```javascript
// Attendance Report
async function getAttendanceReport(startDate, endDate, departmentId = null) {
  const params = new URLSearchParams({
    startDate, endDate,
    departmentId: departmentId || ''
  });
  
  const response = await fetch(`${API_BASE}/reports/attendance?${params}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    }
  });
  
  return await response.json();
}

// Export to CSV/Excel
async function exportEmployees(format = 'CSV') {
  const response = await fetch(`${API_BASE}/export/employees`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'x-tenant-key': 'acme'
    },
    body: JSON.stringify({
      format,  // CSV, EXCEL, JSON
      fields: ['email', 'firstName', 'lastName', 'department', 'joinDate']
    })
  });
  
  const data = await response.json();
  
  // Poll for job completion
  const jobId = data.data.jobId;
  const downloadUrl = await pollExportStatus(jobId);
  window.location.href = downloadUrl;  // Trigger download
}

async function pollExportStatus(jobId) {
  while (true) {
    const response = await fetch(`${API_BASE}/export/${jobId}/status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-tenant-key': 'acme'
      }
    });
    
    const data = await response.json();
    if (data.data.status === 'COMPLETED') {
      return data.data.downloadUrl;
    } else if (data.data.status === 'FAILED') {
      throw new Error('Export failed');
    }
    
    // Wait 2 seconds before polling again
    await new Promise(r => setTimeout(r, 2000));
  }
}
```

---

## 7. Error Handling

### Global Error Handler

```javascript
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'x-tenant-key': 'acme',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    // Handle specific error codes
    if (!response.ok) {
      switch (data.error.code) {
        case 'UNAUTHORIZED':
          // Redirect to login
          window.location.href = '/login';
          break;
        case 'FORBIDDEN':
          // Show "You don't have permission"
          showError('You do not have permission for this action');
          break;
        case 'NOT_FOUND':
          // Show "Resource not found"
          showError('Resource not found');
          break;
        case 'DUPLICATE_ENTRY':
          // Show "This already exists"
          showError(data.error.message);
          break;
        default:
          showError(data.error.message);
      }
      throw new Error(data.error.message);
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

---

## 8. Page-by-Page Integration

### Page 01: Login
- **Endpoint**: `POST /auth/login` → `POST /auth/verify-otp`
- **Fields**: Email, Password, OTP Code
- **Storage**: localStorage (accessToken), Cookie (refreshToken)

### Page 04: HR Admin Dashboard
- **Endpoints**: `GET /employees`, `GET /attendance/summary`, `GET /reports/attendance`
- **Widgets**: Employee count, attendance rate, pending approvals

### Page 07: Employees List
- **Endpoint**: `GET /employees` (paginated)
- **Columns**: ID, Name, Email, Job Title, Department
- **Actions**: View, Edit, Delete

### Page 08: Leave Requests
- **Endpoints**: `POST /leave/requests`, `GET /leave/requests`
- **UI**: Calendar for date selection, status filter

### Page 11: Attendance Calendar
- **Endpoints**: `GET /attendance/records`, `POST /attendance/check-in`
- **Display**: Month view with status indicators

### Page 13: Holidays
- **Endpoint**: `GET /holidays`
- **Display**: Calendar overlay

### Page 14: RBAC Settings
- **Endpoint**: `GET /settings/roles-permissions`, `PATCH /settings/roles-permissions`
- **UI**: Permission matrix grid

---

## 9. Helpful Utilities

### Request Interceptor (for token refresh)

```javascript
export async function apiRequest(url, options = {}) {
  let token = localStorage.getItem('accessToken');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-tenant-key': 'acme',
      ...options.headers
    }
  });
  
  if (response.status === 401) {
    // Token expired, refresh it
    const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'x-tenant-key': 'acme' }
    });
    
    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      token = data.data.accessToken;
      localStorage.setItem('accessToken', token);
      
      // Retry original request
      return apiRequest(url, options);
    } else {
      // Redirect to login
      window.location.href = '/login';
    }
  }
  
  return response.json();
}
```

### Loading & Error States

```javascript
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

async function fetchData() {
  setLoading(true);
  setError(null);
  try {
    const data = await apiCall('/employees');
    setEmployees(data.data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}
```

---

## Testing API Integration

### Using cURL

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "x-tenant-key: acme" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@company.com","password":"pass"}'

# List employees
curl http://localhost:3000/api/v1/employees \
  -H "Authorization: Bearer TOKEN" \
  -H "x-tenant-key: acme"
```

### Using Postman

Import the collection: [Link to Postman Collection](https://www.postman.com/collections/ems-backend-api)

---

## Support

- **API Docs**: http://localhost:3000/docs
- **Status Codes**: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Slack**: #backend-integration
- **Issues**: GitHub issues board

---

## Checklist for UI Team Integration

- ✅ Set up API base URL for dev/prod
- ✅ Implement auth flow (login → OTP → token)
- ✅ Create employee list table
- ✅ Implement leave request form
- ✅ Add attendance check-in/out
- ✅ Build dashboard with reports
- ✅ Set up error handling & loading states
- ✅ Test all endpoints before deployment
- ✅ Implement token refresh logic
- ✅ Add logout functionality
