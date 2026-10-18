# Frontend vs real local backend (2026-10-17)
Stack: Postgres16 :54330 (pgdata2, ems_fe_local), BE :3988 (REDIS_URL empty, RESEND unset), FE prod build `next start` :3918, mocks off, API_BASE_URL=http://127.0.0.1:3988/api/v1. Tenant Zen Corp: SA, HR, MGR, 2 EMP + 11 devs (16 employees), 3 holidays, 3 pay components, 1 group, salaries. Users created via Prisma (employee create makes no login user).
Browser: claude-in-chrome extension NOT connected (3 attempts) -> used playwright-core + system Chrome headless scripts (deep2/fe/*.mjs). Screenshots deep2/shots/fe_*.png.
Shared-dir hazard: another agent writes deep2/ and killed `node src/server.js` twice (my BE died; relaunched via `node -e import(...)`).

## Bugs (repro)
1. Leave preview 404: new-request dialog calls GET /leave/requests/preview?leaveTypeId&startDate&endDate on every change; BE has POST only.
2. Leave reason 5-9 chars and reject/deny reason <10 chars pass FE validation, BE 422; toast shows only "Request validation failed" (mgr dashboard Deny with "no").
3. Every page for a user without salary (HR/SA own employee) fires GET /payroll/employees/:id/salary -> 404 (console error on all 44 routes).
4. HR/SA dashboard: GET /manager/approvals 403 -> "Failed to load pending approvals".
5. Announcements: POST 422 NO_CHANNEL "Create a channel first"; no UI to create channels -> cannot post (dead end). Channels panel empty.
6. Employee dashboard: header "Hi, Eva | null . Engineering" (literal null); "No leave balance available" while /leave shows EL 11.5/13.5.
7. Employee detail Leave tab: "No leave policy assigned" banner above real balances.
8. Manager dashboard stat card "Pending Approvals 1" stays stale after approve until reload.
9. Recruitment KPIs show fabricated "Avg time to hire 28d, -4d vs Q1", "1 today" with zero data. Performance "Start a review" admits no API.
10. Timesheets: employee sees "Select a project" empty until HR creates project (only in Projects tab); project member checkboxes: create sent memberIds [] so project visible to all.
11. Sessions page: "Unknown browser on Unknown OS", IP 127.0.0.1 for all (BFF not forwarding UA/IP); 23 sessions after a few logins.
12. 375px /payroll: header actions overflow, title clipped, subtitle wraps 1 word/line, KPI amounts clipped (₹14,00,000.|). /employees/new, /leave tabs, /holidays also overflow inner flex.
13. Payroll: approve/publish run one click, no confirm; mark-paid accepts empty reference; "-₹0" total deductions; FY label "FY 2026" vs "2026-27".
14. Employee form: "Reports to" raw employee-ID text input; employment type shows enum FORM; Tax forms shows "FORM16". Login JSON returns accessToken in body via BFF.
15. Contrast: light amber 2.13:1, green 3.21:1 (12px); dark avatar initials 1.67:1, primary button 3.82:1, nav active 3.97:1.
16. Departments allows duplicate names (BE).
17. /payout-methods/approvals renders heading before "Access restricted" for employee (minor).

## Passed
Login/logout/refresh (access cookie removed -> /auth/refresh 200 silent), httpOnly cookies, route guards/"Access restricted" for EMP/MGR on admin pages, employee wizard create/edit, leave request->mgr approve->balance 11.5/13.5, attendance check-in/out + regularization approve, timesheet log/submit/approve, payroll run calculate->approve->publish->paid->employee payslip view, holidays/assets/job/department create, exports download CSV, MFA toggle (PATCH ok), search (/), notifications bell, dark mode (data-theme + localStorage, correct), RTL layout flips, keyboard (skip link, focus trap, focus return, rings).
Not covered: SSE stream, Email invite/OTP delivery, file upload, candidates/pipeline, performance (no API), asset assign, payout-method approvals.

## Perf (prod build, localhost, cold cache)
No throttle: FCP 32-48ms, LCP 76-140ms, TBT 0, load 37-48ms. 4xCPU + fast3G: FCP ~0.93s, LCP 3.9-5.3s (analytics 5.3s, TBT 282ms; dashboard 4.98s). JS per route 0.6-1.2MB over 38-71 requests (login 543KB/30 req); next start serves static chunks uncompressed (largest 468KB raw, 141KB gz). Shared bundle ~1.18MB raw on all HR routes.
