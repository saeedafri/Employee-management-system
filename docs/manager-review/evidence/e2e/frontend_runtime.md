# FE runtime audit (partial) - dev server :3917, NEXT_PUBLIC_USE_MOCKS=true, API_BASE_URL=http://127.0.0.1:9 (dead; no deployed backend touched)
## Harness limits
- MSW only mocks payroll/timesheets/leave-engine/holidays/reports/permissions; employees, departments, attendance, analytics, notifications, recruitment, performance, assets, announcements, settings pass through to BFF -> 502 UPSTREAM_UNREACHABLE (29 endpoints). No data pages renderable w/o backend.
- Mock auth: /auth/me needs ems_mock_session cookie header; browser MSW never sees it -> any hard load redirects to /login?next=. Worked around by patching XHR in-page for /auth/me,/auth/login. Only SUPER_ADMIN mockable; HR/manager/employee flows NOT walked.
- Window min width 500px (375/768 not reachable); screenshot CDP timed out -> no screenshots.
## Contract drift (field level, FE vs /EMS/src/modules)
1. Leave preview: FE GET /leave/requests/preview?leaveTypeId&startDate&endDate; BE POST /leave/requests/preview {startDate,endDate} (leaveTypeId ignored). Response FE {chargeableDays,balanceBefore,balanceAfter,errors[]} vs BE {calendarDays,weekendDays,holidayDays,chargeableDays,holidaysExcluded[]} -> 404 live; balance fields never returned.
2. Leave reason: FE min 5, BE min 10 (max 1000) -> 422 for 5-9 chars.
3. Leave reject: FE comment min 1; BE approverComment min 10 max 500.
4. Attendance deny: FE reviewerComment optional; BE required min 10.
5. Check-in/out: FE sends `notes`; BE field `note` (zod strips -> note silently lost). Also BE check-in `date` (BR-ATT-2) never sent.
6. Employees form: error text "Date must be MM-DD-YYYY" but regex enforces YYYY-MM-DD. Create fields otherwise match (departmentId string->array preprocessed).
7. Payroll: run create FE sends `periodLabel` not in BE schema (ignored); approve/cancel/mark-paid/approvals bodies match. LeaveStatus FE includes REJECTED, BE enum has CANCELLED/DENIED (no REJECTED/CANCELLED mapping).
## Runtime
- Dashboard w/ dead BE: every widget shows "Failed to load" + Retry (graceful). /departments shows "Something went wrong".
- GET /api/me/holidays -> 500 + unhandled MSW handler exception (attendance page): bug in holidays mock handler lookup.
- A11y (DOM scan, 11 routes): 0 unnamed buttons, 0 unlabeled inputs, skip link present, <main>/<header> present, one h1/page.
- 500px: no page-level horizontal scroll; /payroll table and /timesheets header overflow container (inside scroll areas); sidebar hidden (nav collapsed).
- RTL (dir=rtl via JS): sidebar flips to right edge correctly; 11 elements still use physical ml/mr/left/right classes vs 50 logical.
- Dark mode: toggling .dark class did not change body bg (theme likely via other mechanism); not verified.
- Console: only MSW/HMR info; errors = AxiosError 502s.
