# FINDINGS — SA-ATT-LEAVE (SUPER_ADMIN stress + deep SHORT)

- Role: `SUPER_ADMIN` · `superadmin@acme.test` · tenant `acme-corp-001`
- UI: http://localhost:3001 → API: http://localhost:4000/api/v1
- Menus: Attendance, Timesheets, Leave, Holidays
- Counts: menus=4 buttons=52 screenshots=64 layers=4 maxDepth=1
- Stress: refresh=0 filter/search=0 pagination=10
- Leave hits: balance=12 requests=14
- SA-10 Priya leak: **REPRODUCED** (API leak hits 10/10; employeeId=null; UI name string absent but EL **578.57/580.57** matches Priya-prefixed balance payload)
- Filter/Refresh note: no dedicated Refresh control on Attendance/Timesheets/Leave/Holidays in this pass; Filter labeled as All employees / All statuses comboboxes (pagination stress ×10 executed). Script updated to target comboboxes on future runs.
- Issues: BE=1 FE=0 BOTH=0 total=1

## Issues

### ISSUE-SA-10: Leave APIs return Priya Sharma data for SUPER_ADMIN (STRESS REPRO)
- Where: Leave → balances / My Requests (stress ×10)
- Why: employeeId=null; 10/10 API hits show Priya prefix/name (cmqjpyds7001kkpjdnlhjygrp). UI name "Priya" absent; UI balances EL 578.57/580.57 / SL 900/900 match leaked API payload. Sample balance: {"success":true,"data":{"balances":[{"id":"cmqjpyds7001kkpjdnlhjygrp-EL","leaveTypeId":"EL","leaveTypeName":"Earned Leave","leaveTypeCode":"EL","total":580.57,"used":2,"pending":0,
- Classification: BACKEND (**CRITICAL**)
- How: Never fall back to another employee when employeeId is null — return empty or NO_EMPLOYEE_RECORD
- Screenshot: 064-leave-landing-post-stress.png
- Network: GET /leave/balance 200; GET /leave/requests 200; GET /auth/me
- Expected: empty leave data / NO_EMPLOYEE_RECORD for SUPER_ADMIN with null employeeId
- Actual: Priya leak on 10/10 hits; UI shows her balances without name

## SA-10 stress detail (10×)

```json
[
  {
    "n": 1,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  },
  {
    "n": 2,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  },
  {
    "n": 3,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  },
  {
    "n": 4,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  },
  {
    "n": 5,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  },
  {
    "n": 6,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  },
  {
    "n": 7,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  },
  {
    "n": 8,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  },
  {
    "n": 9,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  },
  {
    "n": 10,
    "balanceStatus": 200,
    "requestsStatus": 200,
    "balanceHasPriyaPrefix": true,
    "balanceHasPriyaName": false,
    "requestsHasPriyaPrefix": false,
    "requestsHasPriyaName": false
  }
]
```

## Findings log (truncated)

- [PASS] Login · login · 002-login-success.png
- [PASS] Attendance · open · 003-attendance.png
- [PASS] Attendance · Request Regularization · 004-attendance-request-regularization.png
- [PASS] Attendance · Calendar · 007-attendance-calendar.png
- [PASS] Attendance · Table · 008-attendance-table.png
- [PASS] Attendance · All employees · 009-attendance-all-employees.png
- [PASS] Attendance · Previous month · 010-attendance-previous-month.png
- [PASS] Attendance · Next month · 011-attendance-next-month.png
- [PASS] Attendance · stress:pagination×5 · 012-attendance-stress-pagination-x5.png
- [PASS] Timesheets · open · 013-timesheets.png
- [PASS] Timesheets · tab:My Timesheet · 014-timesheets-tab-my-timesheet.png
- [PASS] Timesheets · tab:Approvals · 015-timesheets-tab-approvals.png
- [PASS] Timesheets · tab:Projects · 016-timesheets-tab-projects.png
- [PASS] Timesheets · tab:Rates · 017-timesheets-tab-rates.png
- [PASS] Timesheets · tab:Approval Flow · 018-timesheets-tab-approval-flow.png
- [PASS] Timesheets · tab:Locks · 019-timesheets-tab-locks.png
- [PASS] Timesheets · tab:Delegations · 020-timesheets-tab-delegations.png
- [PASS] Timesheets · My Timesheet · 021-timesheets-my-timesheet.png
- [PASS] Timesheets · Approvals · 022-timesheets-approvals.png
- [PASS] Timesheets · Approval Flow · 023-timesheets-approval-flow.png
- [PASS] Timesheets · Create delegation · 024-timesheets-create-delegation.png
- [PASS] Timesheets · Projects · 025-timesheets-projects.png
- [PASS] Timesheets · Rates · 026-timesheets-rates.png
- [PASS] Timesheets · Locks · 027-timesheets-locks.png
- [PASS] Leave · open · 028-leave.png
- [PASS] Leave · tab:My Requests · 029-leave-tab-my-requests.png
- [PASS] Leave · tab:Team Calendar · 030-leave-tab-team-calendar.png
- [PASS] Leave · tab:Comp-off · 031-leave-tab-comp-off.png
- [PASS] Leave · tab:Approvals · 032-leave-tab-approvals.png
- [PASS] Leave · New Request · 033-leave-new-request.png
- [PASS] Leave · My Requests · 037-leave-my-requests.png
- [PASS] Leave · Team Calendar · 038-leave-team-calendar.png
- [PASS] Leave · Approvals · 039-leave-approvals.png
- [PASS] Leave · Comp-off · 040-leave-comp-off.png
- [PASS] Leave · Pending · 041-leave-pending.png
- [PASS] Holidays · open · 042-holidays.png
- [PASS] Holidays · Import .ics · 043-holidays-import-ics.png
- [PASS] Holidays · Add Holiday · 044-holidays-add-holiday.png
- [PASS] Holidays · Holiday policy · 047-holidays-holiday-policy.png
- [PASS] Holidays · Previous year · 048-holidays-previous-year.png
- [PASS] Holidays · Next year · 049-holidays-next-year.png
- [PASS] Holidays · Actions for Republic Day · 050-holidays-actions-for-republic-day.png
- [PASS] Holidays · stress:pagination×5 · 053-holidays-stress-pagination-x5.png
- [FAIL] Leave · SA-10 stress ×10 · 064-leave-landing-post-stress.png