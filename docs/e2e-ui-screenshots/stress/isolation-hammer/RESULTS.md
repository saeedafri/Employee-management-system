# Isolation Hammer Results

> Target: `http://localhost:4000` (API `http://localhost:4000/api/v1`) · Tenant: `acme-corp-001` · Rounds: **5** parallel login×4 + simultaneous sensitive GETs
> Started: 2026-08-03T03:40:42.593Z · Finished: 2026-08-03T03:41:00.298Z · Wall: **17704 ms**
> Hunt: wrong-employee (SA-10), notification cross-user, HTTP 500s, cookie/session confusion
> No Render · No migrations · No Playwright

## Method

1. For each of 5 rounds: login SUPER_ADMIN / HR_ADMIN / MANAGER / EMPLOYEE **in parallel**.
2. With all 4 tokens live, fire sensitive GETs **simultaneously** across all roles: `/auth/me`, `/employees`, `/leave/requests`, `/leave/balance`, `/notifications`, payroll payslips (own emp id; SA also probes Priya payslips + `/payroll/runs`), `/manager/dashboard|team|approvals` (EMPLOYEE expects **403**).
3. Compare identity surfaces to expected employeeIds; flag SA leave→Priya, foreign notif userIds, 5xx, cookie collisions.

## Login (5 rounds × 4 roles, parallel)

| Round | Wall (ms) | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE |
|---:|---:|---|---|---|---|
| 1 | 979 | 200/tok 889ms | 200/tok 855ms | 200/tok 819ms | 200/tok 954ms |
| 2 | 966 | 200/tok 870ms | 200/tok 870ms | 200/tok 860ms | 200/tok 965ms |
| 3 | 623 | 200/tok 621ms | 200/tok 623ms | 200/tok 623ms | 200/tok 622ms |
| 4 | 1214 | 200/tok 608ms | 200/tok 1213ms | 200/tok 652ms | 200/tok 902ms |
| 5 | 936 | 200/tok 936ms | 200/tok 839ms | 200/tok 840ms | 200/tok 889ms |

## Status matrix (5 concurrent rounds aggregated)

### SUPER_ADMIN

| Endpoint | Status mix | p50 (ms) | p95 (ms) | min | max |
|---|---|---:|---:|---:|---:|
| `/auth/me` | 200×5 | 1883 | 2167 | 1818 | 2167 |
| `/employees` | 200×5 | 1976 | 2211 | 1823 | 2211 |
| `/leave/requests` | 200×5 | 933 | 1092 | 784 | 1092 |
| `/leave/balance` | 200×5 | 2252 | 2625 | 2230 | 2625 |
| `/notifications` | 200×5 | 932 | 1102 | 846 | 1102 |
| `/manager/dashboard` | 403×5 | 481 | 487 | 439 | 487 |
| `/manager/team` | 403×5 | 441 | 487 | 434 | 487 |
| `/manager/approvals` | 200×5 | 1863 | 2165 | 1726 | 2165 |
| `/payroll/runs` | 200×5 | 1024 | 1201 | 908 | 1201 |
| `/payroll/employees/cmqjpyds7001kkpjdnlhjygrp/payslips` | 200×5 | 1125 | 1351 | 1000 | 1351 |

### HR_ADMIN

| Endpoint | Status mix | p50 (ms) | p95 (ms) | min | max |
|---|---|---:|---:|---:|---:|
| `/auth/me` | 200×5 | 1939 | 2257 | 1907 | 2257 |
| `/employees` | 200×5 | 2082 | 2541 | 2011 | 2541 |
| `/leave/requests` | 200×5 | 1136 | 1351 | 1043 | 1351 |
| `/leave/balance` | 200×5 | 2254 | 2660 | 2202 | 2660 |
| `/notifications` | 200×5 | 1154 | 1405 | 1099 | 1405 |
| `/manager/dashboard` | 403×5 | 582 | 595 | 533 | 595 |
| `/manager/team` | 403×5 | 586 | 597 | 530 | 597 |
| `/manager/approvals` | 200×5 | 1974 | 2214 | 1880 | 2214 |
| `/payroll/employees/cmqjpydsb001mkpjdxlgw74tv/payslips` | 200×5 | 1275 | 1666 | 1146 | 1666 |

### MANAGER

| Endpoint | Status mix | p50 (ms) | p95 (ms) | min | max |
|---|---|---:|---:|---:|---:|
| `/auth/me` | 200×5 | 2141 | 2471 | 1956 | 2471 |
| `/employees` | 200×5 | 2232 | 2455 | 2127 | 2455 |
| `/leave/requests` | 200×5 | 1430 | 1864 | 1409 | 1864 |
| `/leave/balance` | 200×5 | 2258 | 2637 | 2250 | 2637 |
| `/notifications` | 200×5 | 1421 | 1614 | 1286 | 1614 |
| `/manager/dashboard` | 200×5 | 2506 | 2951 | 2475 | 2951 |
| `/manager/team` | 200×5 | 1766 | 1914 | 1430 | 1914 |
| `/manager/approvals` | 200×5 | 2426 | 2857 | 2362 | 2857 |
| `/payroll/employees/cmqjpyds0001ikpjd5br3r2uh/payslips` | 200×5 | 1603 | 1816 | 1425 | 1816 |

### EMPLOYEE

| Endpoint | Status mix | p50 (ms) | p95 (ms) | min | max |
|---|---|---:|---:|---:|---:|
| `/auth/me` | 200×5 | 2200 | 2588 | 2115 | 2588 |
| `/employees` | 200×5 | 2446 | 2792 | 2266 | 2792 |
| `/leave/requests` | 200×5 | 1802 | 2064 | 1681 | 2064 |
| `/leave/balance` | 200×5 | 2308 | 2687 | 2292 | 2687 |
| `/notifications` | 200×5 | 1713 | 2020 | 1533 | 2020 |
| `/manager/dashboard` | 403×5 | 731 | 888 | 729 | 888 |
| `/manager/team` | 403×5 | 731 | 926 | 729 | 926 |
| `/manager/approvals` | 403×5 | 781 | 889 | 732 | 889 |
| `/payroll/employees/cmqjpyds7001kkpjdnlhjygrp/payslips` | 200×5 | 1823 | 2119 | 1718 | 2119 |

## Isolation verdicts

| Check | Result | Evidence |
|---|---|---|
| SA leave → Priya (ISSUE-SA-10) | **FAIL** ×10 | leave/balance resolves to Priya employeeId prefix cmqjpyds7001kkpjdnlhjygrp while auth/me.employeeId=null |
| HR/MGR/EMP own leave under concurrency | PASS | 5/5 rounds leave prefix === auth/me.employeeId for HR, Manager, Priya |
| Notification cross-user | PASS | distinct notif ids per role; EMP inbox titles differ from SA/HR/MGR approver fan-out; 0 id overlap |
| HTTP 500 / network under concurrency | PASS | 0 × 5xx/network across 185 sensitive GETs |
| Cookie / session confusion | PASS | auth/me matched login email every round; parallel login Set-Cookie values unique per role (20 observations) |
| EMPLOYEE → /manager/* | PASS (403) | dashboard/team/approvals all 403×5 |

**Note (observational, not isolation fail):** SUPER_ADMIN and HR_ADMIN get **403** on `/manager/dashboard` + `/manager/team` but **200** on `/manager/approvals` (5/5). MANAGER gets 200 on all three. EMPLOYEE stays 403 on all three.

## Spotlight: SA leave → Priya (ISSUE-SA-10)

| Round | SA auth/me.employeeId | SA leave prefix | SA leave refs | EMP leave prefix | Leak? |
|---:|---|---|---|---|---|
| 1 | `null` | `cmqjpyds7001kkpjdnlhjygrp` | LVR-0028, LVR-0027, LVR-0026 | `cmqjpyds7001kkpjdnlhjygrp` | **YES** |
| 2 | `null` | `cmqjpyds7001kkpjdnlhjygrp` | LVR-0028, LVR-0027, LVR-0026 | `cmqjpyds7001kkpjdnlhjygrp` | **YES** |
| 3 | `null` | `cmqjpyds7001kkpjdnlhjygrp` | LVR-0028, LVR-0027, LVR-0026 | `cmqjpyds7001kkpjdnlhjygrp` | **YES** |
| 4 | `null` | `cmqjpyds7001kkpjdnlhjygrp` | LVR-0028, LVR-0027, LVR-0026 | `cmqjpyds7001kkpjdnlhjygrp` | **YES** |
| 5 | `null` | `cmqjpyds7001kkpjdnlhjygrp` | LVR-0028, LVR-0027, LVR-0026 | `cmqjpyds7001kkpjdnlhjygrp` | **YES** |

**SA-10 under isolation hammer:** 5/5 rounds leaked Priya prefix `cmqjpyds7001kkpjdnlhjygrp` on SUPER_ADMIN leave/balance while `employeeId: null`.

## Spotlight: EMPLOYEE → /manager/* (expect 403)

| Round | /manager/dashboard | /manager/team | /manager/approvals |
|---:|---|---|---|
| 1 | 403 | 403 | 403 |
| 2 | 403 | 403 | 403 |
| 3 | 403 | 403 | 403 |
| 4 | 403 | 403 | 403 |
| 5 | 403 | 403 | 403 |

## Spotlight: notifications isolation

| Round | Role | /notifications | sample userIds / titles |
|---:|---|---|---|
| 1 | SUPER_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 1 | HR_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 1 | MANAGER | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 1 | EMPLOYEE | 200 (20 sampled) | ?::Leave Approved; ?::Check-Out Recorded; ?::Regularization Approved |
| 2 | SUPER_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 2 | HR_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 2 | MANAGER | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 2 | EMPLOYEE | 200 (20 sampled) | ?::Leave Approved; ?::Check-Out Recorded; ?::Regularization Approved |
| 3 | SUPER_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 3 | HR_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 3 | MANAGER | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 3 | EMPLOYEE | 200 (20 sampled) | ?::Leave Approved; ?::Check-Out Recorded; ?::Regularization Approved |
| 4 | SUPER_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 4 | HR_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 4 | MANAGER | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 4 | EMPLOYEE | 200 (20 sampled) | ?::Leave Approved; ?::Check-Out Recorded; ?::Regularization Approved |
| 5 | SUPER_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 5 | HR_ADMIN | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 5 | MANAGER | 200 (20 sampled) | ?::Leave Request Withdrawn; ?::New Leave Request; ?::New Leave Request |
| 5 | EMPLOYEE | 200 (20 sampled) | ?::Leave Approved; ?::Check-Out Recorded; ?::Regularization Approved |

## All findings

| Sev | Kind | Role | Rounds | Detail |
|---|---|---|---|---|
| CRITICAL | `SA10_LEAVE_LEAK` | SUPER_ADMIN | 1,2,3,4,5 | leave/balance resolves to Priya employeeId prefix cmqjpyds7001kkpjdnlhjygrp while auth/me.employeeId=null |
| CRITICAL | `SA10_LEAVE_REQUESTS_LEAK` | SUPER_ADMIN | 1,2,3,4,5 | leave/requests for SA (employeeId=null) returned refs=[LVR-0028,LVR-0027,LVR-0026,LVR-0025,LVR-0024] matching Priya-scoped personal list |

## Identity peeks (last round)

### SUPER_ADMIN

- **auth/me:** `{"success":true,"data":{"id":"cmqjpydqe000qkpjd8q8idw1k","email":"superadmin@acme.test","memberType":"SUPER_ADMIN","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":null,"status":"ACTIVE","employee":null,"permissions":["employees:read","employees:write","employees:delete","empl`
- **leave/balance:** `{"success":true,"data":{"balances":[{"id":"cmqjpyds7001kkpjdnlhjygrp-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":580.57,"used":2,"pending":0,"available":578.57},{"id":"cmqjpyds7001kkpjdnlhjygrp-SL","leaveTypeId":"SL","leaveTypeName":"Sick Le`
- **leave/requests:** `{"success":true,"data":{"requests":[{"id":"cmsclpj6700qab9xj6rbziuwr","referenceNo":"LVR-0028","leaveTypeId":"cmqx9cnfd001b3782zzr4haer","leaveTypeName":"Earned Leave","startDate":"2026-11-20T00:00:00.000Z","endDate":"2026-11-20T00:00:00.000Z","totalDays":1,"status":"WITHDRAWN","`
- **notifications:** `{"success":true,"data":{"notifications":[{"id":"9ba5b55aac98c2f5b52cfbcc","type":"leave_withdrawn","title":"Leave Request Withdrawn","body":"Priya Sharma has withdrawn their leave request","entityType":null,"entityId":null,"actionUrl":null,"isRead":true,"createdAt":"2026-08-03T02`
- **manager/dashboard:** `{"success":false,"error":{"code":"FORBIDDEN","message":"Only managers can access this","details":{},"requestId":"5fda9662-b42b-49e7-83fe-0d9a2da52427"}}`

### HR_ADMIN

- **auth/me:** `{"success":true,"data":{"id":"cmqjpydqj000skpjdp2l6cvg5","email":"hr@acme.test","memberType":"HR_ADMIN","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":"cmqjpydsb001mkpjdxlgw74tv","status":"ACTIVE","employee":{"id":"cmqjpydsb001mkpjdxlgw74tv","tenantId":"cmqjpydkv0000kpjdelzt`
- **leave/balance:** `{"success":true,"data":{"balances":[{"id":"cmqjpydsb001mkpjdxlgw74tv-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":9,"used":0,"pending":0,"available":9},{"id":"cmqjpydsb001mkpjdxlgw74tv-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leav`
- **leave/requests:** `{"success":true,"data":{"requests":[{"id":"cmqjpyfna006fdwadtwp9ooog","referenceNo":"LVR-0011","leaveTypeId":"cmqjpydsy001okpjdqd9sxmu5","leaveTypeName":"Annual Leave","startDate":"2026-04-29T00:00:00.000Z","endDate":"2026-05-02T00:00:00.000Z","totalDays":4,"status":"APPROVED","r`
- **notifications:** `{"success":true,"data":{"notifications":[{"id":"f8b5e88acf233340c3b52d9a","type":"leave_withdrawn","title":"Leave Request Withdrawn","body":"Priya Sharma has withdrawn their leave request","entityType":null,"entityId":null,"actionUrl":null,"isRead":false,"createdAt":"2026-08-03T0`
- **manager/dashboard:** `{"success":false,"error":{"code":"FORBIDDEN","message":"Only managers can access this","details":{},"requestId":"ecfe8c75-2f3f-481c-b964-edb6fa724407"}}`

### MANAGER

- **auth/me:** `{"success":true,"data":{"id":"cmqjpydql000ukpjdbhesbmpi","email":"aman@acme.test","memberType":"MANAGER","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":"cmqjpyds0001ikpjd5br3r2uh","status":"ACTIVE","employee":{"id":"cmqjpyds0001ikpjd5br3r2uh","tenantId":"cmqjpydkv0000kpjdelz`
- **leave/balance:** `{"success":true,"data":{"balances":[{"id":"cmqjpyds0001ikpjd5br3r2uh-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":9,"used":2,"pending":0,"available":7},{"id":"cmqjpyds0001ikpjd5br3r2uh-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leav`
- **leave/requests:** `{"success":true,"data":{"requests":[{"id":"cmrgtkj5a00105ij38spgd230","referenceNo":"LVR-0021","leaveTypeId":"cmqx9cnfd001b3782zzr4haer","leaveTypeName":"Earned Leave","startDate":"2026-07-20T00:00:00.000Z","endDate":"2026-07-21T00:00:00.000Z","totalDays":2,"status":"APPROVED","r`
- **notifications:** `{"success":true,"data":{"notifications":[{"id":"ebacb30d865cf8d7cadecae9","type":"leave_withdrawn","title":"Leave Request Withdrawn","body":"Priya Sharma has withdrawn their leave request","entityType":null,"entityId":null,"actionUrl":null,"isRead":false,"createdAt":"2026-08-03T0`
- **manager/dashboard:** `{"success":true,"data":{"managerName":"Aman Kumar","teamSize":22,"pendingApprovals":0,"approvalBreakdown":{"leave":0,"regularization":0},"presentToday":0,"avgAttendancePercent":0,"todayAttendance":{"p`

### EMPLOYEE

- **auth/me:** `{"success":true,"data":{"id":"cmqjpydqn000wkpjd02gyqzd3","email":"priya@acme.test","memberType":"EMPLOYEE","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":"cmqjpyds7001kkpjdnlhjygrp","status":"ACTIVE","employee":{"id":"cmqjpyds7001kkpjdnlhjygrp","tenantId":"cmqjpydkv0000kpjde`
- **leave/balance:** `{"success":true,"data":{"balances":[{"id":"cmqjpyds7001kkpjdnlhjygrp-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":9,"used":0,"pending":0,"available":9},{"id":"cmqjpyds7001kkpjdnlhjygrp-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leav`
- **leave/requests:** `{"success":true,"data":{"requests":[{"id":"cmsclpj6700qab9xj6rbziuwr","referenceNo":"LVR-0028","leaveTypeId":"cmqx9cnfd001b3782zzr4haer","leaveTypeName":"Earned Leave","startDate":"2026-11-20T00:00:00.000Z","endDate":"2026-11-20T00:00:00.000Z","totalDays":1,"status":"WITHDRAWN","`
- **notifications:** `{"success":true,"data":{"notifications":[{"id":"999e2a8eb1ae97280b27c982","type":"leave_approved","title":"Leave Approved","body":"Your leave request for 1 day(s) has been approved","entityType":null,"entityId":null,"actionUrl":null,"isRead":true,"createdAt":"2026-08-03T02:20:18.`
- **manager/dashboard:** `{"success":false,"error":{"code":"FORBIDDEN","message":"Only managers can access this","details":{},"requestId":"20d7dac9-59a2-4deb-9751-55718c0d31d2"}}`

## Summary

- Wall clock: **17704 ms**
- Login rounds: **5** × 4 parallel
- Sensitive GETs: **185**
- Findings total: **10** (SA-10=10, 5xx=0, session=0, notif=0, authz=0)
- Raw JSON: [`raw.json`](./raw.json)
