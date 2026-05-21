# EMS — How the System Knows Which Employee

> **This is the most critical document for the UI team.**  
> Every API call either operates on "myself", "a specific person", or "my team". This document explains exactly how the backend resolves which employee is involved in every call.

---

## 1. What Is in the JWT

After every successful login, the server returns an `accessToken`. This token carries:

```json
{
  "sub": "cmpbjdqp90002wysvug0xd6t4",   ← User ID (login account)
  "tenantId": "clx1234tenant",            ← Which company this user belongs to
  "memberType": "HR_ADMIN",               ← Role: SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | AUDITOR
  "employeeId": "clx1234emp",             ← Employee profile ID (null if no employee row linked)
  "sessionId": "sess_xyz",                ← Current session
  "iat": 1716400000,
  "exp": 1716400900                       ← 15 minutes from login
}
```

**The critical field is `employeeId`.**

- `sub` (User ID) is the login account — used for auth and session management only.
- `employeeId` is the Employee record — used for all HR/attendance/leave operations.
- These are different IDs. A user can exist without an employee record (e.g., `superadmin@acme.test`).

### Who has an `employeeId` in the JWT?

| Email | memberType | Has employeeId? |
|---|---|---|
| `superadmin@acme.test` | SUPER_ADMIN | **No** — can't check in, can't view own dashboard |
| `hr@acme.test` | HR_ADMIN | **Yes** — is both an HR admin and an employee |
| `aman@acme.test` | MANAGER | **Yes** — is a manager and has their own employee record |
| `priya@acme.test` | EMPLOYEE | **Yes** — is a regular employee |

---

## 2. Three Modes of Employee Identity Resolution

### Mode 1 — "Me" (JWT Self)

Used by: personal/self-service endpoints  
How: server reads `request.user.employeeId` from the decoded JWT  
The UI does **nothing** — just send the Bearer token and the server knows who you are.

| Endpoint | What "me" means | Who can call it |
|---|---|---|
| `GET /employee/dashboard` | Logged-in user's employee record | Any role with `employeeId` |
| `GET /employee/documents` | My own documents | Same |
| `GET /employee/team` | My manager + my dept peers | Same |
| `POST /attendance/check-in` | Clock in myself | Same |
| `POST /attendance/check-out` | Clock out myself | Same |
| `GET /attendance/today` | My today's status | Same |
| `GET /attendance/records` | My own history | Same |
| `GET /attendance/summary` | My summary | Same |
| `GET /leave/requests` | My leave requests | Same |
| `GET /leave/balance` | My leave balance | Same |
| `POST /leave/requests` | Submit my leave | Same |
| `PATCH /leave/requests/:id/withdraw` | Withdraw my request | Same |
| `GET /attendance/regularization` | My regularization requests | Same |
| `POST /attendance/regularization` | Submit regularization for myself | Same |

**Code example (server side):**
```js
const employeeId = request.user.employeeId;  // from JWT — no param needed
const result = await getEmployeeDashboard(employeeId, tenantId);
```

**UI pattern:**
```js
// Just send the token. No employeeId param needed.
fetch('/api/v1/employee/dashboard', {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

### Mode 2 — "A Specific Employee" (URL / Query Param)

Used by: HR/Admin endpoints that operate on any employee  
How: UI passes employee ID in the URL (`:id`) or query param  
Access control: HR_ADMIN and SUPER_ADMIN can target any employee; MANAGER can only target their direct reports; EMPLOYEE can only target themselves.

| Endpoint | ID source | Who can use |
|---|---|---|
| `GET /employees/:id` | `:id` in URL | HR: any; Manager: own team; Employee: self only |
| `PATCH /employees/:id` | `:id` in URL | HR: any; Employee: self only |
| `DELETE /employees/:id` | `:id` in URL | HR only |
| `GET /attendance/records?employeeId=:id` | `?employeeId=` query param | HR only (others see their own via Mode 1) |
| `GET /leave/requests?employeeId=:id` | `?employeeId=` query param | HR only |
| `PATCH /leave/requests/:id/approve` | `:id` = leave request ID | MANAGER, HR |
| `PATCH /leave/requests/:id/reject` | `:id` = leave request ID | MANAGER, HR |

**Code example (server side):**
```js
const { id } = request.params;  // employee ID from URL
// guard: only HR_ADMIN / SUPER_ADMIN or own ID
if (user.employeeId !== id && !['SUPER_ADMIN', 'HR_ADMIN'].includes(user.memberType)) {
  return reply.code(403).send(/* FORBIDDEN */);
}
```

**UI pattern:**
```js
// HR viewing a specific employee's profile
fetch(`/api/v1/employees/${selectedEmployeeId}`, {
  headers: { Authorization: `Bearer ${token}` }
});
```

**Where do you get the employee ID?**
- From `GET /employees` list response → each row has `id` field
- From `GET /auth/me` response for the current user → `employee.id`
- From the login response → `data.user.employee.id` (if linked)

---

### Mode 3 — "My Team" (Manager Scope)

Used by: manager-scoped endpoints  
How: server uses JWT's `employeeId` as the manager ID, then queries `WHERE managerId = <that>` in the DB  
The UI sends the token and nothing else — the server resolves the team automatically.

| Endpoint | What it returns | Who can call it |
|---|---|---|
| `GET /manager/team` | Manager's direct reports | MANAGER, HR_ADMIN |
| `GET /manager/dashboard` | Team stats for the manager | MANAGER, HR_ADMIN |
| `GET /manager/approvals` | Pending leave requests from team | MANAGER, HR_ADMIN |
| `GET /attendance/team/records?month=YYYY-MM` | Team attendance grid | MANAGER, HR_ADMIN |
| `GET /leave/team/requests` | All leave requests from team | MANAGER, HR_ADMIN |
| `GET /attendance/team/regularization` | Team regularization queue | MANAGER, HR_ADMIN |

**Code example (server side):**
```js
const managerEmployeeId = request.user.employeeId;  // from JWT
// Prisma: WHERE employee.managerId = managerEmployeeId
```

**UI pattern:**
```js
// Manager views their team's attendance — no extra params
fetch('/api/v1/attendance/team/records?month=2026-05', {
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## 3. Dashboard Routing — Which Dashboard to Show

After login, the response includes `data.user.memberType`. Use this to route:

```
SUPER_ADMIN → /dashboard/analytics   (same as HR_ADMIN, full access)
HR_ADMIN    → /dashboard/analytics   (Page 04)
MANAGER     → /dashboard/manager     (Page 05)
EMPLOYEE    → /dashboard/employee    (Page 06)
AUDITOR     → /dashboard/employee    (limited view)
```

**Code:**
```js
const { data } = await loginResponse.json();
const { memberType, employeeId } = data.user;

switch (memberType) {
  case 'SUPER_ADMIN':
  case 'HR_ADMIN':
    navigate('/dashboard/analytics');
    break;
  case 'MANAGER':
    navigate('/dashboard/manager');
    break;
  case 'EMPLOYEE':
  case 'AUDITOR':
    navigate('/dashboard/employee');
    break;
}
```

---

## 4. The "HR Admin Who Is Also an Employee" Problem

`hr@acme.test` has `memberType: HR_ADMIN` AND has an `employeeId` in their JWT.

**They can do everything:**
- View analytics dashboard (HR_ADMIN privilege)
- View any employee's profile (`GET /employees/:id` with any ID)
- Also view their **own** personal dashboard (`GET /employee/dashboard` — uses their JWT employeeId)
- Also submit their **own** leave (`POST /leave/requests` — Mode 1)

**UI implication:** Show HR users a nav option for both the analytics view AND their personal employee view. The personal view is always loaded via Mode 1 (just send token, server uses their `employeeId`).

Same applies to MANAGER — they have both manager-scope views AND their own personal attendance/leave.

---

## 5. What Happens When There Is No `employeeId`

`superadmin@acme.test` has `memberType: SUPER_ADMIN` but **no linked Employee row**.

Calling any Mode 1 endpoint will return:
```json
{
  "success": false,
  "error": {
    "code": "NO_EMPLOYEE_RECORD",
    "message": "User has no employee record"
  }
}
```

**UI rule:** Check `data.user.employee` (or `data.user.employeeId`) in the login response. If null/undefined, **do not show** check-in, personal dashboard, leave request, or documents UI for that user. Show only the admin-scope views.

```js
const { memberType, employeeId } = data.user;
const hasEmployeeProfile = Boolean(employeeId);

// Only show personal employee tabs if they have an employee record
if (hasEmployeeProfile) {
  showTab('My Attendance');
  showTab('My Leave');
  showTab('My Documents');
}
```

---

## 6. Login Response — Everything You Need

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",          ← store in memory (15 min lifetime)
    "sessionId": "sess_xyz",          ← for session management only
    "user": {
      "id": "usr_abc",                ← user account ID (not employee ID)
      "email": "hr@acme.test",
      "memberType": "HR_ADMIN",       ← use for routing and UI visibility
      "employeeId": "emp_xyz",        ← use for all personal API calls
      "employee": {
        "firstName": "Jane",
        "lastName": "Smith",
        "employeeCode": "E0003",
        "designation": "HR Manager",
        "department": { "name": "HR" }
      }
    },
    "permissions": []
  }
}
```

**Store all of this in your auth context** on login. You will reference `memberType`, `employeeId`, and `employee` everywhere.

---

## 7. Complete Identity Matrix — Every Role, Every Endpoint

### Self-service (Mode 1 — always uses JWT employeeId)

| Endpoint | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|
| `GET /employee/dashboard` | ❌ no emp record | ✅ | ✅ | ✅ |
| `GET /employee/documents` | ❌ | ✅ | ✅ | ✅ |
| `GET /employee/team` | ❌ | ✅ | ✅ | ✅ |
| `POST /attendance/check-in` | ❌ | ✅ | ✅ | ✅ |
| `GET /attendance/records` (own) | ❌ | ✅ | ✅ | ✅ |
| `GET /leave/balance` (own) | ❌ | ✅ | ✅ | ✅ |
| `POST /leave/requests` | ❌ | ✅ | ✅ | ✅ |

### HR/Admin targeting any employee (Mode 2 — uses `:id` param)

| Endpoint | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|
| `GET /employees/:id` | ✅ any | ✅ any | ✅ team only | ✅ self only |
| `PATCH /employees/:id` | ✅ any | ✅ any | ❌ | ✅ self only |
| `DELETE /employees/:id` | ✅ | ✅ | ❌ | ❌ |
| `GET /employees` | ✅ all | ✅ all | ✅ team | ✅ self |
| `GET /employees/export/csv` | ✅ | ✅ | ❌ | ❌ |

### Manager team scope (Mode 3 — uses JWT employeeId as manager)

| Endpoint | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|
| `GET /manager/dashboard` | ✅ | ✅ | ✅ | ❌ |
| `GET /manager/team` | ✅ | ✅ | ✅ | ❌ |
| `GET /manager/approvals` | ✅ | ✅ | ✅ | ❌ |
| `GET /attendance/team/records` | ✅ | ✅ | ✅ | ❌ |
| `GET /leave/team/requests` | ✅ | ✅ | ✅ | ❌ |
| `PATCH /leave/requests/:id/approve` | ✅ | ✅ | ✅ | ❌ |
| `PATCH /leave/requests/:id/reject` | ✅ | ✅ | ✅ | ❌ |

### Analytics (HR/Admin only — no employee identity involved)

| Endpoint | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|---|:---:|:---:|:---:|:---:|
| `GET /analytics/summary` | ✅ | ✅ | ❌ | ❌ |
| `GET /analytics/attendance` | ✅ | ✅ | ❌ | ❌ |
| `GET /analytics/headcount-by-department` | ✅ | ✅ | ❌ | ❌ |
| `GET /analytics/recent-activity` | ✅ | ✅ | ❌ | ❌ |

---

## 8. Quick Decision Tree for the UI Team

```
Making an API call?
│
├── Am I fetching MY OWN data?
│     → Just send Bearer token. No employeeId param needed. (Mode 1)
│     → Examples: /employee/dashboard, /leave/balance, /attendance/records
│
├── Am I fetching SOMEONE ELSE's data?
│     → Add their employeeId to the URL or query param. (Mode 2)
│     → Examples: /employees/:id, /employees?page=1 (HR sees all)
│     → Will return 403 if you're not allowed to see that person.
│
└── Am I fetching MY TEAM's data?
      → Just send Bearer token. Server resolves team from JWT. (Mode 3)
      → Examples: /manager/team, /attendance/team/records, /leave/team/requests
```

---

## 9. Test Scenarios

### Scenario 1: Employee checks in
```
User: priya@acme.test (EMPLOYEE, employeeId: E0002)
Call: POST /attendance/check-in
Headers: Authorization: Bearer <priya_token>
Result: creates/updates attendance for E0002 ← server reads from JWT
```

### Scenario 2: Manager views team attendance
```
User: aman@acme.test (MANAGER, employeeId: E0001)
Call: GET /attendance/team/records?month=2026-05
Headers: Authorization: Bearer <aman_token>
Result: returns attendance for all employees WHERE managerId = E0001
```

### Scenario 3: HR views a specific employee profile
```
User: hr@acme.test (HR_ADMIN)
Call: GET /employees/E0002
Headers: Authorization: Bearer <hr_token>
Result: returns Priya Sharma's full profile ← E0002 is from the URL
```

### Scenario 4: HR Admin views THEIR OWN personal dashboard
```
User: hr@acme.test (HR_ADMIN, employeeId: E0003)
Call: GET /employee/dashboard
Headers: Authorization: Bearer <hr_token>
Result: returns HR's own employee data ← server reads E0003 from JWT
(This is different from the analytics dashboard they see by role)
```

### Scenario 5: Super Admin (no employee record)
```
User: superadmin@acme.test (SUPER_ADMIN, employeeId: null)
Call: GET /employee/dashboard
Result: 400 NO_EMPLOYEE_RECORD
UI should: not show this tab to SUPER_ADMIN at all
```
