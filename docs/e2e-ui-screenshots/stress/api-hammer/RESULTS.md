# API Hammer Results

> Target: `http://localhost:4000` (API `http://localhost:4000/api/v1`) · Tenant: `acme-corp-001` · Parallel: **20** GETs/endpoint/role  
> Started: 2026-08-03T02:14:19.645Z · Finished: 2026-08-03T02:15:23.941Z · Wall: **64295 ms**  
> DB: Hostinger via `127.0.0.1:15432` · No Render · No Playwright · No migrations

## Login

| Role | Email | Status | Token | Latency (ms) |
|---|---|---:|---|---:|
| SUPER_ADMIN | superadmin@acme.test | 200 | yes | 2176 |
| HR_ADMIN | hr@acme.test | 200 | yes | 1451 |
| MANAGER | aman@acme.test | 200 | yes | 2215 |
| EMPLOYEE | priya@acme.test | 200 | yes | 2307 |

## Per-role latency & status

### SUPER_ADMIN (superadmin@acme.test)

| Endpoint | Status mix | p50 (ms) | p95 (ms) | min | max | wall (ms) |
|---|---|---:|---:|---:|---:|---:|
| `health` | 200×20 | 4 | 4 | 3 | 4 | 6 |
| `auth/me` | 200×20 | 2419 | 2624 | 2271 | 2624 | 2626 |
| `employees` | 200×20 | 2174 | 2640 | 1647 | 2640 | 2644 |
| `leave/balance` | 200×20 | 2119 | 2272 | 1886 | 2293 | 2293 |
| `leave/requests` | 200×20 | 1625 | 2100 | 1138 | 2163 | 2165 |
| `attendance/today` | 400×20 | 789 | 926 | 515 | 926 | 927 |
| `attendance/summary` | 200×20 | 647 | 782 | 430 | 783 | 784 |
| `notifications` | 200×20 | 1360 | 1788 | 890 | 1855 | 1858 |

### HR_ADMIN (hr@acme.test)

| Endpoint | Status mix | p50 (ms) | p95 (ms) | min | max | wall (ms) |
|---|---|---:|---:|---:|---:|---:|
| `health` | 200×20 | 3 | 3 | 2 | 3 | 4 |
| `auth/me` | 200×20 | 3016 | 3289 | 2752 | 3289 | 3291 |
| `employees` | 200×20 | 2307 | 2898 | 1823 | 2989 | 2991 |
| `leave/balance` | 200×20 | 2236 | 2466 | 1901 | 2534 | 2537 |
| `leave/requests` | 200×20 | 1638 | 2027 | 1251 | 2077 | 2079 |
| `attendance/today` | 200×20 | 1016 | 1116 | 823 | 1161 | 1163 |
| `attendance/summary` | 200×20 | 944 | 1061 | 751 | 1063 | 1063 |
| `notifications` | 200×20 | 1209 | 1547 | 884 | 1657 | 1658 |

### MANAGER (aman@acme.test)

| Endpoint | Status mix | p50 (ms) | p95 (ms) | min | max | wall (ms) |
|---|---|---:|---:|---:|---:|---:|
| `health` | 200×20 | 1 | 1 | 1 | 1 | 2 |
| `auth/me` | 200×20 | 2387 | 2482 | 2284 | 2482 | 2483 |
| `employees` | 200×20 | 2068 | 2854 | 1370 | 2854 | 2855 |
| `leave/balance` | 200×20 | 2141 | 2300 | 2037 | 2354 | 2356 |
| `leave/requests` | 200×20 | 1840 | 2436 | 1226 | 2436 | 2437 |
| `attendance/today` | 200×20 | 810 | 925 | 707 | 925 | 926 |
| `attendance/summary` | 200×20 | 713 | 813 | 611 | 813 | 814 |
| `notifications` | 200×20 | 1025 | 1334 | 643 | 1371 | 1372 |

### EMPLOYEE (priya@acme.test)

| Endpoint | Status mix | p50 (ms) | p95 (ms) | min | max | wall (ms) |
|---|---|---:|---:|---:|---:|---:|
| `health` | 200×20 | 1 | 2 | 1 | 2 | 3 |
| `auth/me` | 200×20 | 1942 | 2046 | 1798 | 2046 | 2047 |
| `employees` | 200×20 | 1531 | 2063 | 1030 | 2064 | 2066 |
| `leave/balance` | 200×20 | 1526 | 1630 | 1422 | 1630 | 1631 |
| `leave/requests` | 200×20 | 1174 | 1522 | 827 | 1574 | 1575 |
| `attendance/today` | 200×20 | 765 | 878 | 664 | 928 | 929 |
| `attendance/summary` | 200×20 | 718 | 820 | 564 | 870 | 870 |
| `notifications` | 200×20 | 797 | 1092 | 479 | 1152 | 1153 |

## Error bodies (non-2xx / network)

| Role | Endpoint | Status | Count | p50/p95 (ms) | Body (canonical) |
|---|---|---:|---:|---|---|
| SUPER_ADMIN | `attendance/today` | 400 | 20/20 | 789 / 926 | `{"success":false,"error":{"code":"NO_EMPLOYEE_RECORD","message":"User has no employee record","details":{}}}` |

All other role×endpoint cells were **200×20**.

## Findings (contract-relevant)

1. **`GET /attendance/today` → 400 for SUPER_ADMIN only** — `NO_EMPLOYEE_RECORD` (auth/me confirms `employeeId: null`). HR / Manager / Priya all 200.
2. **`GET /leave/balance` + `/leave/requests` for SUPER_ADMIN return Priya’s employee scope** — SA has `employeeId: null`, yet leave balance ids are prefixed `cmqjpyds7001kkpjdnlhjygrp-*` (Priya’s employeeId) and leave requests include the same `LVR-0026` / `LVR-0025` as Priya’s own list. **Data leak / wrong employee resolution under null employeeId.**
3. **Leave balance totals diverge for the same id prefix** — SA peek shows EL `total:580.57` on `…kkpjdnlhjygrp-EL`; Priya peek shows EL `total:9` on the same id. Same employee key, inconsistent aggregates (investigate concurrent mutation vs SA aggregation path).
4. **Latency under Hostinger tunnel** — authenticated GETs typically p50 ≈ 0.7–3.0s with 20-way parallelism; `/health` stays ~1–4ms.

## Spotlight: leave (Priya vs SUPER_ADMIN) & attendance/today

### Parallel-hammer status

- **SUPER_ADMIN** `leave/balance`: statuses={"200": 20} p50=2119 p95=2272
- **SUPER_ADMIN** `leave/requests`: statuses={"200": 20} p50=1625 p95=2100
- **SUPER_ADMIN** `attendance/today`: statuses={"400": 20} p50=789 p95=926 · err: `{"success":false,"error":{"code":"NO_EMPLOYEE_RECORD","message":"User has no employee record","details":{},"requestId":"a5f93bf9-519a-4a78-a350-67af7d50802a"}}`
- **EMPLOYEE** `leave/balance`: statuses={"200": 20} p50=1526 p95=1630
- **EMPLOYEE** `leave/requests`: statuses={"200": 20} p50=1174 p95=1522
- **EMPLOYEE** `attendance/today`: statuses={"200": 20} p50=765 p95=878
- **HR_ADMIN** `leave/balance`: statuses={"200": 20} p50=2236 p95=2466
- **HR_ADMIN** `leave/requests`: statuses={"200": 20} p50=1638 p95=2027
- **HR_ADMIN** `attendance/today`: statuses={"200": 20} p50=1016 p95=1116
- **MANAGER** `leave/balance`: statuses={"200": 20} p50=2141 p95=2300
- **MANAGER** `leave/requests`: statuses={"200": 20} p50=1840 p95=2436
- **MANAGER** `attendance/today`: statuses={"200": 20} p50=810 p95=925

### leave → which employee?

| Actor | auth/me employeeId | leave/balance id prefix | leave/requests top refs | Verdict |
|---|---|---|---|---|
| SUPER_ADMIN | `null` | `cmqjpyds7001kkpjdnlhjygrp` (Priya) | `LVR-0026`, `LVR-0025` | **LEAK — Priya’s leave as SA** |
| EMPLOYEE (Priya) | `cmqjpyds7001kkpjdnlhjygrp` | `cmqjpyds7001kkpjdnlhjygrp` | `LVR-0026`, `LVR-0025` | Own data (expected) |

Evidence snippets:
- **SUPER_ADMIN** auth/me=`employeeId:null` / `employee:null`; leave/balance ids `cmqjpyds7001kkpjdnlhjygrp-EL` (EL total **580.57**); leave/requests `LVR-0026` WITHDRAWN Sick Leave.
- **EMPLOYEE** auth/me=`employeeId:cmqjpyds7001kkpjdnlhjygrp` (Priya Sharma); leave/balance same id prefix (EL total **9**); leave/requests same `LVR-0026`.

### Identity peek (single GET after hammer)

- **SUPER_ADMIN** `auth/me` → 200 (442ms): `{"success":true,"data":{"id":"cmqjpydqe000qkpjd8q8idw1k","email":"superadmin@acme.test","memberType":"SUPER_ADMIN","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":null,"status":"ACTIVE","employee":null,"permissions":["employees:read","employees:write","employees:delete","employees:export","departments:read","departments:write","attendance:read","attendance:write","leave:read","leave:request","leave:approve","analytics:read","permissions:manage","audit:read","announcements:admin","announcemen`
- **SUPER_ADMIN** `leave/balance` → 200 (246ms): `{"success":true,"data":{"balances":[{"id":"cmqjpyds7001kkpjdnlhjygrp-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":580.57,"used":2,"pending":0,"available":578.57},{"id":"cmqjpyds7001kkpjdnlhjygrp-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leaveTypeCode":"SL","total":900,"used":0,"pending":0,"available":900},{"id":"cmqjpyds7001kkpjdnlhjygrp-CL","leaveTypeId":"CL","leaveTypeName":"Casual Leave","leaveTypeCode":"CL","total":900,"used":0,"pending":0,"av`
- **SUPER_ADMIN** `leave/requests` → 200 (252ms): `{"success":true,"data":{"requests":[{"id":"cmsc6zss8007bb9xjpslcrb5n","referenceNo":"LVR-0026","leaveTypeId":"cmsc6zsbh0079b9xjds8qibrf","leaveTypeName":"Sick Leave","startDate":"2026-11-12T00:00:00.000Z","endDate":"2026-11-12T00:00:00.000Z","totalDays":1,"status":"WITHDRAWN","reason":"E2E deep leave type=Sick Leave date=2026-11-12","submittedAt":"2026-08-02T19:27:37.593Z","decidedAt":null,"approverComment":null},{"id":"cmsc6bfpf0040b9xj9i0ftkmm","referenceNo":"LVR-0025","leaveTypeId":"cmqx9cnfd`
- **SUPER_ADMIN** `attendance/today` → 400 (150ms): `{"success":false,"error":{"code":"NO_EMPLOYEE_RECORD","message":"User has no employee record","details":{},"requestId":"e96a5c8b-d1d6-41b5-a21f-bfa5d64a0a53"}}`
- **HR_ADMIN** `auth/me` → 200 (471ms): `{"success":true,"data":{"id":"cmqjpydqj000skpjdp2l6cvg5","email":"hr@acme.test","memberType":"HR_ADMIN","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":"cmqjpydsb001mkpjdxlgw74tv","status":"ACTIVE","employee":{"id":"cmqjpydsb001mkpjdxlgw74tv","tenantId":"cmqjpydkv0000kpjdelztyg88","userId":"cmqjpydqj000skpjdp2l6cvg5","employeeCode":"E0003","firstName":"HR","lastName":"Admin","workEmail":"hr@acme.test","personalEmail":"hr@acme.test","phone":"+91 98765 43212","dateOfBirth":null,"gender":null,"`
- **HR_ADMIN** `leave/balance` → 200 (250ms): `{"success":true,"data":{"balances":[{"id":"cmqjpydsb001mkpjdxlgw74tv-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":9,"used":0,"pending":0,"available":9},{"id":"cmqjpydsb001mkpjdxlgw74tv-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leaveTypeCode":"SL","total":12,"used":0,"pending":0,"available":12},{"id":"cmqjpydsb001mkpjdxlgw74tv-CL","leaveTypeId":"CL","leaveTypeName":"Casual Leave","leaveTypeCode":"CL","total":12,"used":0,"pending":0,"available":12},`
- **HR_ADMIN** `leave/requests` → 200 (240ms): `{"success":true,"data":{"requests":[{"id":"cmqjpyfna006fdwadtwp9ooog","referenceNo":"LVR-0011","leaveTypeId":"cmqjpydsy001okpjdqd9sxmu5","leaveTypeName":"Annual Leave","startDate":"2026-04-29T00:00:00.000Z","endDate":"2026-05-02T00:00:00.000Z","totalDays":4,"status":"APPROVED","reason":"Travel","submittedAt":"2026-04-27T00:00:00.000Z","decidedAt":"2026-04-28T00:00:00.000Z","approverComment":"Approved"}],"pagination":{"page":1,"limit":10,"total":1,"pages":1}},"meta":{}}`
- **HR_ADMIN** `attendance/today` → 200 (144ms): `{"success":true,"data":{"date":"2026-08-03T00:00:00.000Z","status":"PRESENT","checkInAt":"2026-08-02T19:05:47.312Z","checkOutAt":"2026-08-02T19:05:49.663Z","duration":0},"meta":{"cached":false}}`
- **MANAGER** `auth/me` → 200 (545ms): `{"success":true,"data":{"id":"cmqjpydql000ukpjdbhesbmpi","email":"aman@acme.test","memberType":"MANAGER","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":"cmqjpyds0001ikpjd5br3r2uh","status":"ACTIVE","employee":{"id":"cmqjpyds0001ikpjd5br3r2uh","tenantId":"cmqjpydkv0000kpjdelztyg88","userId":"cmqjpydql000ukpjdbhesbmpi","employeeCode":"E0001","firstName":"Aman","lastName":"Kumar","workEmail":"aman@acme.test","personalEmail":"aman.kumar@gmail.com","phone":"+91 98765 43210","dateOfBirth":"1990-0`
- **MANAGER** `leave/balance` → 200 (257ms): `{"success":true,"data":{"balances":[{"id":"cmqjpyds0001ikpjd5br3r2uh-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":9,"used":2,"pending":0,"available":7},{"id":"cmqjpyds0001ikpjd5br3r2uh-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leaveTypeCode":"SL","total":12,"used":0,"pending":0,"available":12},{"id":"cmqjpyds0001ikpjd5br3r2uh-CL","leaveTypeId":"CL","leaveTypeName":"Casual Leave","leaveTypeCode":"CL","total":12,"used":0,"pending":0,"available":12},`
- **MANAGER** `leave/requests` → 200 (253ms): `{"success":true,"data":{"requests":[{"id":"cmrgtkj5a00105ij38spgd230","referenceNo":"LVR-0021","leaveTypeId":"cmqx9cnfd001b3782zzr4haer","leaveTypeName":"Earned Leave","startDate":"2026-07-20T00:00:00.000Z","endDate":"2026-07-21T00:00:00.000Z","totalDays":2,"status":"APPROVED","reason":"Family function","submittedAt":"2026-07-11T20:30:58.796Z","decidedAt":"2026-08-02T18:49:30.714Z","approverComment":null},{"id":"cmqjpyfo0006rdwad4slculsi","referenceNo":"LVR-0017","leaveTypeId":"cmqjpydt6001skpjd`
- **MANAGER** `attendance/today` → 200 (154ms): `{"success":true,"data":{"date":"2026-08-03T00:00:00.000Z","status":"PRESENT","checkInAt":"2026-08-02T18:50:25.917Z","checkOutAt":"2026-08-02T19:27:48.859Z","duration":37},"meta":{"cached":false}}`
- **EMPLOYEE** `auth/me` → 200 (451ms): `{"success":true,"data":{"id":"cmqjpydqn000wkpjd02gyqzd3","email":"priya@acme.test","memberType":"EMPLOYEE","tenantId":"cmqjpydkv0000kpjdelztyg88","employeeId":"cmqjpyds7001kkpjdnlhjygrp","status":"ACTIVE","employee":{"id":"cmqjpyds7001kkpjdnlhjygrp","tenantId":"cmqjpydkv0000kpjdelztyg88","userId":"cmqjpydqn000wkpjd02gyqzd3","employeeCode":"E0002","firstName":"Priya","lastName":"Sharma","workEmail":"priya@acme.test","personalEmail":"priya.sharma@gmail.com","phone":"+91 98765 43211","dateOfBirth":`
- **EMPLOYEE** `leave/balance` → 200 (261ms): `{"success":true,"data":{"balances":[{"id":"cmqjpyds7001kkpjdnlhjygrp-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":9,"used":0,"pending":0,"available":9},{"id":"cmqjpyds7001kkpjdnlhjygrp-SL","leaveTypeId":"SL","leaveTypeName":"Sick Leave","leaveTypeCode":"SL","total":12,"used":0,"pending":0,"available":12},{"id":"cmqjpyds7001kkpjdnlhjygrp-CL","leaveTypeId":"CL","leaveTypeName":"Casual Leave","leaveTypeCode":"CL","total":12,"used":0,"pending":0,"available":12},`
- **EMPLOYEE** `leave/requests` → 200 (255ms): `{"success":true,"data":{"requests":[{"id":"cmsc6zss8007bb9xjpslcrb5n","referenceNo":"LVR-0026","leaveTypeId":"cmsc6zsbh0079b9xjds8qibrf","leaveTypeName":"Sick Leave","startDate":"2026-11-12T00:00:00.000Z","endDate":"2026-11-12T00:00:00.000Z","totalDays":1,"status":"WITHDRAWN","reason":"E2E deep leave type=Sick Leave date=2026-11-12","submittedAt":"2026-08-02T19:27:37.593Z","decidedAt":null,"approverComment":null},{"id":"cmsc6bfpf0040b9xj9i0ftkmm","referenceNo":"LVR-0025","leaveTypeId":"cmqx9cnfd`
- **EMPLOYEE** `attendance/today` → 200 (159ms): `{"success":true,"data":{"date":"2026-08-03T00:00:00.000Z","status":"PRESENT","checkInAt":"2026-08-02T19:04:47.372Z","checkOutAt":"2026-08-02T19:06:56.506Z","duration":2},"meta":{"cached":false}}`

### attendance/today 400 focus

- **SUPER_ADMIN**: hammer {"400": 20} p50=789 p95=926; peek=400 `{"success":false,"error":{"code":"NO_EMPLOYEE_RECORD","message":"User has no employee record","details":{},"requestId":"e96a5c8b-d1d6-41b5-a21f-bfa5d64a0a53"}}`
- **HR_ADMIN**: hammer {"200": 20} p50=1016 p95=1116; peek=200 `{"success":true,"data":{"date":"2026-08-03T00:00:00.000Z","status":"PRESENT","checkInAt":"2026-08-02T19:05:47.312Z","checkOutAt":"2026-08-02T19:05:49.663Z","duration":0},"meta":{"cached":false}}`
- **MANAGER**: hammer {"200": 20} p50=810 p95=925; peek=200 `{"success":true,"data":{"date":"2026-08-03T00:00:00.000Z","status":"PRESENT","checkInAt":"2026-08-02T18:50:25.917Z","checkOutAt":"2026-08-02T19:27:48.859Z","duration":37},"meta":{"cached":false}}`
- **EMPLOYEE**: hammer {"200": 20} p50=765 p95=878; peek=200 `{"success":true,"data":{"date":"2026-08-03T00:00:00.000Z","status":"PRESENT","checkInAt":"2026-08-02T19:04:47.372Z","checkOutAt":"2026-08-02T19:06:56.506Z","duration":2},"meta":{"cached":false}}`

## Summary

- Total wall clock: **64295 ms**
- Roles logged in: **4/4**
- Hammer requests: **640** (4 roles × 8 endpoints × 20)
- Distinct error signatures: **1** (`SUPER_ADMIN` × `attendance/today` × `NO_EMPLOYEE_RECORD`; 20/20 samples)
- Confirmed: SA leave endpoints resolve to **Priya** (`cmqjpyds7001kkpjdnlhjygrp`) despite `employeeId: null`
- Raw JSON: [`raw.json`](./raw.json)
