# Competitor public API analysis vs EMS

Sources (public, unauthenticated; saved in scratchpad/specs/): Remote OpenAPI (remote.json, 305 ops/650 schemas), llms.txt indexes for BambooHR, Factorial, Keka, HiBob, Lattice, Rippling, Gusto, Personio, Deel, plus convention pages (*.md/*.txt). Not reachable/not fetched: Workday, SAP SF, Darwinbox, greytHR, Razorpay Payroll, Bayzat, Jisr, ZenHR (login-walled/no public spec found); Zoho People = overview page only. Counts below come from public indexes, not live probing.

## Endpoint counts
- Factorial v2026-10-01: ~752 ops (Webhooks catalogue 137 event types; Performance 40+, Timeoff ~35, Attendance/Shift ~35, ProjectManagement ~45, Ats ~30, Contracts, Compensations, Finance>CostCenter, ItManagement>ItAsset, Teams, Trainings, Posts, Locations).
- BambooHR: ~333 (Locations 71, Scheduling 55, Comp Planning 28, Total Rewards 28, Goals 24, Pay Grades/Bands 16, Holidays 13, Custom Fields 12, Onboarding 12, Benchmarking 11, Datasets 8, Employees 8, Custom Tables 7, Benefits 10+, ATS 10, Change Tracking 2, Alerts 5, Dependents).
- Remote: 305 (Employments 70, Pay & Compensation 40, Contractors 29, Time&Attendance 26, Integrations 25, Companies 23, Sandbox 21, Offboarding 18, Contracts 15, Benefits 9).
- Keka: ~191 (Webhook Logs 17, JobBoards 14, PayGroups 11, ProjectPhases 10, ExpenseAttachments 10, HolidayCalendar 7, TaxDeclaration 7, SalaryStructure 5, Form16 2, Loans 2, FlexiBenefit 2, Helpdesk 7, Praise/RnR, Digital Signature, Skills).
- Rippling v2: ~180 doc entries (HRIS workers/users/compensations/draft hires, org, custom objects/fields/records, Functions, reports).
- EMS: 77 Prisma models, ~420 route handlers in 27 route files, 217 documented rows in API_MAPPING.md.

## Auth / scopes
- Remote: 5 schemes (partner basic, customer API token, OAuth2 auth-code + refresh, client-credentials, JWT-bearer employee assertion). ~90 fine-grained `resource:read|write` scopes (employment:write, payslip:read, timeoff:write, expense:read, custom_field_value:write, webhook:write, ...).
- Rippling: Bearer API tokens with permission profile; OAuth only for App Shop; `__meta.redacted_fields` marks fields token can't see.
- Keka: API-key -> access token (grant_type, scope, client_id/secret) + OAuth code (app portal) + refresh.
- Personio v2: client-credentials, scopes `personio:webhooks:read` etc. Factorial: API key, OAuth2, company token, user token, OAuth scopes. BambooHR: API key + OAuth scopes per endpoint. Gusto: OAuth scopes (`employees:read`, `companies:write`), token-info endpoint.
- EMS: JWT user sessions + role/permission catalogue only. No API keys, no machine OAuth (client credentials), no per-resource scopes, no SCIM.

## Conventions
- Pagination: Factorial cursor (`limit` max 100, `after_id/before_id`, meta has_next_page/start_cursor/end_cursor/total); Gusto page/per (25 default) + X-Total-* headers, plus cursor `starting_after_uuid` + X-Has-Next-Page; Keka page/size 100 with next/prev reference links; Rippling `limit` + `cursor`/`next_link`; Remote `cursor`/`page_size`. EMS: page/limit (max 100) + meta; offset only.
- Versioning: Gusto date header (X-Gusto-API-Version), Rippling `Rippling-Api-Version: YYYY-MM-DD`, Factorial path `/api/2026-10-01/`; Remote JSON-schema-versioned params (`*_json_schema_version`). EMS: `/api/v1` only.
- Filtering/shaping: Rippling `filter`, `expand`, `order_by`; Gusto `sort_by=field:dir` multi-field with 422 on invalid; Remote `include_*`, `except_statuses`, `external_id`. EMS: ad-hoc per route.
- Idempotency: Gusto idempotency key on POST + optimistic version field on PUT. Remote/Factorial/Keka: none documented (Factorial tells integrators to dedupe webhooks). EMS: only endpoint-level idempotent semantics; no Idempotency-Key header.
- Rate limits: Keka 50 req/min; BambooHR throttle with 429 + Retry-After; Rippling documented global+burst; EMS 100/min global and 5/15min on auth. No X-RateLimit headers anywhere common.
- Errors: Gusto `{errors:[{error_key, category, message, metadata{entity_uuid, entity_type}}]}` with documented categories; EMS `errorResponse()` with code string, single error.
- Bulk: Gusto async `people_batches` (create + poll), Rippling bulk draft hires, Factorial/Remote bulk via arrays and `async` flag. EMS: CSV import/auto-assign endpoints only.
- Sandbox: Remote has 21 `/sandbox/*` endpoints to simulate events (incl. webhook trigger); Factorial demo env; Gusto demo + partner notification tests; Keka sandbox activation; EMS none.
- Changes feed: BambooHR `changed employee IDs since timestamp` + changed table data; Rippling worker-changes guide. EMS lacks since-cursor sync.

## Webhooks
- Factorial: 137 events, subscription CRUD API (5 endpoints), retries 20x/48h then subscription auto-disabled, challenge header, permission-scoped to creating token.
- Gusto: 21 subscription types (BankAccount, Company, Contractor, ContractorPayment, Document, Employee, EmployeeBenefit, EmployeeJobCompensation, ExternalPayroll, Form, Location, Payroll, PaySchedule, Signatory...) each with created/updated/deleted + domain events.
- Remote: ~92 event types (employment.onboarding.completed, employment.user_status.*, expense.*, incentive.*, payslip.released, offboarding.*, contract_amendment.*, contractor_invoice.*, timeoff, probation.*), webhook-callbacks CRUD, `webhook-events` list + replay, sandbox trigger.
- BambooHR: global + permissioned (API-created), event- and field-based; HMAC-SHA256 `X-BambooHR-Signature` + `X-BambooHR-Timestamp`; HTTPS only.
- Personio v2: webhook CRUD + `/activity` delivery log + `/events` (last window).
- Keka: event-trigger based, form-encoded, retry logs API (17 endpoints).
- EMS: 12 event names in a tenant Setting JSON blob (`integrations.service.js:186`), CRUD + simulated test, https/SSRF guard. No persisted delivery log, retries, signature header contract, replay, or field-based events.

## Entity model gaps (EMS lacks; vendor has)
- Employee/person: custom fields + custom tables/objects with typed values (Rippling `__c`, BambooHR custom tables, Remote custom_field(+value)), effective-dated job/compensation history (BambooHR tables, Rippling compensations, Factorial contracts/contract versions), dependents/emergency contacts as records (EMS only has 2 flat emergency fields), work authorization, identity verification, personal-details vs employment split (Rippling User vs Worker), employee skills (Keka, HiBob), job catalog/pay grades/pay bands (BambooHR, HiBob), cost centers (Factorial Finance>CostCenter), teams + memberships, work locations/work areas, company structure nodes, employee external_id.
- Time off: allowance + incidence, blocked periods, policy assignments, accrual (EMS has LeavePolicy/Assignment/Ledger: comparable); EMS lacks blocked periods, carry-forward expiries as first-class, timeoff balance entitlement-type breakdown.
- Attendance/shift: shift templates, overtime requests, edit-timesheet requests, weekly-off policies, capture schemes (Keka), tracking policies. EMS has regularization + timesheets but no shift/roster/overtime-request object.
- Payroll: incentives (type, amount_tax_type, recurring_incentive_id, payout date), pay items, payroll calendar, pay-in details, payroll-run totals split (benefits/expenses/incentives/employer contributions), Form16 / tax declaration, salary structures, flexi-benefit, component claims, bank list, GL reports (Remote), payslip PDF events. EMS has most payroll core (PayrollRun, Payslip, TaxDeclaration, Loan, Garnishment, PayCalendar) so is on par; lacks form16, flexi-benefit, GL export, recurring incentives.
- Benefits: plans, coverages, deduction types, enrollments, member benefit events, renewals (BambooHR, Remote). EMS: none.
- Onboarding/offboarding: task templates, onboarding_task.completed, probation extension/completion letters, resignation letters, offboarding workflow (Remote 18 endpoints). EMS: Resignation model, no routes noted; onboarding tasks absent.
- Performance: review process targets, goals (24 ops BambooHR), comp planning cycles/budgets, benchmarking, 360/feedback, recognition/praise. EMS: PerformanceCycle/Review/Goal exist, no comp-planning/recognition.
- Other: ATS depth (applications, feedback, questions, job boards), training/LMS, helpdesk, posts/groups, IT assets (EMS has Asset), digital signature workflow, company files + categories, datasets/reports API, expenses with categories tree + attachments (EMS has Reimbursement).

## Where EMS is already richer / on par
- Multi-country statutory payroll engine (StatutoryPack, LegalEntity, KWD 3-dec litmus), semi-monthly proration, historical payslips/opening balances migration, payout methods with maker-checker and AES-GCM, Garnishment, ContractorInvoice+PaymentBatch.
- Holiday policy engine with optional selection; comp-off; leave ledger.
- RBAC permission catalogue + generated route manifest (most vendors expose only scopes).
- SSRF-guarded webhook URL validation, MFA policy enforcement, audit logs + DPIA report, announcements with events, timesheet templates.

## Conventions EMS should adopt (priority)
1. Public API keys + OAuth client-credentials with `resource:read|write` scopes mapped from existing permissionCatalogue; token-info endpoint (Gusto).
2. Webhooks v2: persisted subscriptions + delivery log + HMAC-SHA256 signature/timestamp headers (BambooHR), retries with backoff, auto-disable, replay (Remote), `<resource>.<action>` catalogue of 80+ events (employee.created/terminated, onboarding.completed, payslip.released, expense.*...).
3. Idempotency-Key on POST (payroll run create, claims, invites) + `version`/ETag optimistic locking.
4. Cursor pagination (`limit`, `cursor`, meta has_next/end_cursor) + `sort_by=field:dir` + `updated_since` / changed-since feed.
5. Date-pinned API version header; structured error array with `category` + `entity` metadata; X-RateLimit-* + Retry-After on 429.
6. Custom fields/objects (typed, tenant-defined) as first-class API.
7. Async bulk (`/employees/batches` create + poll) and sandbox event simulation endpoint.
8. Per-field redaction metadata (`__meta.redacted_fields`) for role-scoped responses.
