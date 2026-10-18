# EMS Backend Audit (read-only) — 2026-10-17

Scope: /Users/mohdsaeedafri/All-Code-Base/EMS. Static read only; no tests, DB, or network run. Evidence = path:line.
Scale: 27 route files, ~423 route registrations (payroll 110 + payout 16, settings 33, timesheets 25+16, auth 22, reports 21, leave 19+17, employees 19, holidays 15, attendance 14, ...). 77 Prisma models, 29 migrations, ~85 test files, Swagger is generated dynamically from route schemas (src/plugins/swagger.js:30 `mode: 'dynamic'`).

## 1. Feature inventory

| Domain | Status | Evidence / notes |
|---|---|---|
| Auth (login, refresh rotation, sessions, logout-all, forgot/reset, invite, register) | Implemented | src/modules/auth/auth.routes.js:11-363; Session table w/ family reuse detection; Argon2id |
| MFA/OTP | Implemented (email OTP only) | auth.service.js:80-101,190-204 (tenant `mfa_policy` + per-user `mfaEnabled`); PATCH /auth/me/mfa auth.routes.js:115. No TOTP/WebAuthn/backup codes |
| SSO (SAML/OIDC/Google/Microsoft) | Missing | grep saml/oidc/oauth only hits settings.repository/schema (settings stubs); no routes |
| RBAC | Implemented, strong | permission catalogue + `requirePermission` (auth.policy.js:57), `guardScope`, published route manifest (permissionManifest.js), custom roles via /settings/roles; tests rbac-*.test.js (7 files) |
| Employees/org/departments | Implemented | employees.routes.js (19), departments.routes.js (8, tree + members + rollups), documents on Cloudinary, soft delete, manager hierarchy. Org chart / position / grade / job-history entities: missing |
| Leave | Implemented, deep | leave.routes.js (19) + leaveEngine.routes.js (17): policies w/ versioning/publish, policy packs, accrual/proration/year-end, ledger, comp-off, encashment, auto-assign. Models LeavePolicy/LeaveAssignment/LeaveLedgerTxn/CompOffRequest |
| Attendance | Implemented | check-in/out, geofence (attendance.service.js:42-55 100 m hard-coded), regularization, monthly calendar (BE1), team views. Shifts/rosters/overtime rules/biometric import: missing (no Shift model). `/payroll/roster` is payroll-only |
| Timesheets | Implemented, deep | 41 routes: projects/tasks/entries/timer/templates, submit/approve/recall, locks, budgets, cost rates, delegations, approval chain, reminders (src/jobs/submitReminderJob.js, VPS systemd timer) |
| Payroll engine | Implemented, very deep | payroll.service.js 2484 lines; runs DRAFT→CALCULATING→REVIEW→APPROVED→PAID, multi-level approvals, variance, parallel-reconcile, FnF, off-cycle (BONUS/ARREARS/REVERSAL), holds, input import / from-timesheets/leave/attendance, payment batch + bank file, GL journal export, statutory return, register, pay-equity + audit-pack reports |
| Statutory packs / multi-country / currencies | Implemented (data-driven) | StatutoryPack, LegalEntity, PayCalendar; money decimal precision migration 20260623100000; KWD(3dp)/JPY(0dp) tests (payroll-minor-units, payroll-global-readiness, payroll-fx-config, payroll-rounding-config) |
| Semi-monthly / sub-monthly | Implemented | tests payroll-subMonthly, payroll-statutory-wagebase; docs/BE_SEMI_MONTHLY_COMPUTE_CONTRACT.md |
| Payslips | Implemented | PDF (payslipPdf.js), templates, publish, hold/release, recalc, tax-form PDFs (taxFormPdf.js), historical payslip migration |
| Loans, garnishments, tax declarations, opening balances, contractor invoices, reimbursements | Implemented (reimbursement/contractor basic) | payroll.routes.js `/employees/:id/loans|garnishments|tax-declaration`, `/payroll/reimbursement-claims` (3), `/payroll/contractor-invoices` (3) |
| Payouts / bank accounts | Implemented | payout.routes.js (16): AES-256-GCM (payoutCrypto.js), maker-checker (PayoutApproval), country bank schemas + IBAN/checksum validators, backfill script. Actual disbursement to a bank/PSP API: missing (bank-file export only) |
| Holidays | Implemented | per-country policy, observed dates, optional selection, versioning, resolver (holidays/*); 15 routes |
| Onboarding | Partial | UserInvitation + accept-invitation flow (invitation.service.js). No onboarding checklist/tasks/templates/document collection workflow |
| Offboarding / resignation | Partial | `Resignation` model exists (schema) but no module/routes; FnF run type exists in payroll (`/runs/:id/fnf`). Exit checklist/clearance missing |
| Recruitment/ATS | Partial (thin) | recruitment.routes.js 9 routes; only JobOpening + Candidate (schema:1436-1478, stage is free string). No interviews, scorecards, offers, careers page, resume storage, candidate→employee conversion. `applicantCount`/`daysInStage` denormalised counters |
| Performance | Partial (thin) | PerformanceCycle/Review/Goal (9 routes). No 360, competencies, OKR trees, calibration write path, review forms, PIPs |
| Learning/LMS | Missing | no model/routes |
| Expenses | Partial | only payroll ReimbursementClaim/Category (payroll.service.js ~2320); no standalone expense reports, receipts OCR, per-diem, cards |
| Benefits | Missing (as module) | only PayGroupComponent-type "benefit" earnings/deductions; no plans/enrolment/life events |
| Documents / e-sign | Partial | EmployeeDocument upload/verify (Cloudinary, WebP photos). E-sign / templates / letters generation: missing |
| Helpdesk/tickets | Missing | no hits |
| Assets | Implemented (basic) | assets.routes.js 11: inventory, assign/recall, requests approve/decline. No maintenance/depreciation/returns checklist |
| Announcements | Implemented | 9 routes, channels, pin, events |
| Analytics / reports / exports | Implemented | analytics 9, reports 21 (scheduled reports model), export 5 (csv/xlsx/json via ExcelJS), audit export. Export files written to local disk `/tmp/exports` (export.controller.js:149) — lost on container rebuild, not shared across instances |
| Notifications | Implemented | in-app + SSE (`?token=` in URL), unread count, timesheet reminders. Email via Resend/Brevo/SMTP. No push/SMS/Slack |
| Audit logs | Partial | AuditLog model, query/export/DPIA report. Writes only from auth, invitation, employees, departments, manager decisions (grep `auditLog.create`). Leave, attendance, settings, roles, holidays mutations NOT audited; payroll has its own `/runs/:id/audit` + PayrollEvent |
| Settings | Implemented | tenant, branding, email templates, roles, security/auth, attendance rules, integrations (email/storage), webhooks, notifications prefs |
| Integrations / webhooks / public API | Partial / Missing | Webhook CRUD + test ping (settings.routes.js:162-166, integrations.service.js:186-225 with SSRF guard utils/ssrfGuard.js). NO event dispatch found (no emit/deliver code) — webhooks are config-only. No API keys / PAT / OAuth app / public API versioning |
| i18n / multi-country | Partial | Multi-country is data-driven for payroll, holidays, bank schemas, currency, timezone. API messages are English-only; no locale-based templates/number formatting; email templates per tenant editable (EmailTemplate) |
| Data privacy GDPR/DPDP | Partial / thin | DPIA report endpoint (auditLogs.service.js:89), retention-days config stub (integrations.service.js:11-13) not enforced by any job; no data-subject export/erasure/anonymisation, consent records, or right-to-access endpoint; soft delete only (`deletedAt`) |
| Billing | Stub | billing.routes.js 4 read-only routes |

## 2. Security findings (ranked)

1. **HIGH — per-route rate limits are not active.** `@fastify/rate-limit` reads `config.rateLimit`; code puts `rateLimit:` as a top-level route option (auth.routes.js:32,170,239,278,299,343,374 — register, forgot-password, reset, OTP verify/resend, accept-invitation) or inside `schema` (analytics.routes.js:29…). Result: only the global 100 req / 15 min / IP (plugins/rateLimit.js) applies. `/auth/login` and `/auth/admin/login` have no limit config at all. Also no `trustProxy` in Fastify() (app.js:44-55): behind nginx every client likely shares one IP bucket (either everyone throttled together, or limit ineffective if keyed on X-Forwarded-For spoof). Verify with a runtime test (not run here).
2. **HIGH — /ops/logs is cross-tenant.** ops.routes.js:153-176 `prisma.logEntry.findMany({ where })` has no tenantId filter; access = any SUPER_ADMIN (ops.routes.js:16-30) or a shared `OPS_LOGS_TOKEN`. `/auth/register` is public and mints a SUPER_ADMIN per new tenant, so any self-registered tenant owner can read all tenants' logs (messages/metadata).
3. **MED — `.env.ethereal` and `.env.test` are tracked in git** (`git ls-files`). Ethereal creds are disposable and .env.test is local-only, but tracked env files invite real secrets; add to .gitignore and rotate if any non-throwaway value was ever committed. `backups/` is git-ignored (good), but a prod dump `backups/render-prod.dump` lives in the working dir.
4. **MED — public tenant self-registration** (/auth/register) with ineffective rate limit (see 1): tenant/user spam and storage abuse.
5. **MED — JWT in query string** (`resolveTenant.js` `request.query?.token`, SSE): tokens land in access logs/proxies. Short-lived tokens or a one-time SSE ticket are better. resolveTenant also decodes JWT without verify for routing (acceptable since authenticate re-checks session and tenant match, authenticate.js:25-37).
6. **MED — CORS/cookies/helmet present; fail-closed JWT secret in prod** (config/index.js:5-10) — good. Default `DEFAULT_TENANT_KEY` fallback exists; ensure unset in prod.
7. LOW — SUPER_ADMIN bypass hard-coded (authenticate.js `authorize`), permission system otherwise used. CLAUDE.md says authorize() unwired to DB roles; code has moved on (requirePermission) — CLAUDE.md stale.
8. LOW — `0` guards in dashboard/analytics route files are intentional (`guardScope`), verified.
9. Positive: tenant isolation via tenantId on queries + session.tenantId check; SSRF guard on webhooks; payout bank data encrypted at rest; test suite includes access-scoping, rbac-full-sweep, no-employee-record-reads.

## 3. Reliability

- **No DB transactions in the hot financial paths.** `$transaction` appears only 5 times (invitation.service.js:240, auth.service.js:821, departments.repository.js:212, payroll.service.js:2320 (read-only count), employees.service.js:143). `calculatePayrollRun` (payroll.repository.js:863-935) sets status CALCULATING, `deleteMany`s payslips, then creates payslips one by one — a crash/timeout mid-run leaves the run in CALCULATING with partial/no payslips and no rollback. Approve/mark-paid/payment-batch/publish are likewise multi-step non-atomic.
- Queue: BullMQ+Redis payroll queue (src/lib/payrollQueue.js) exists with sync fallback; CLAUDE.md still says "REMOVED" (stale). Notification/webhook/export fan-out still synchronous; email send inline.
- Idempotency: payroll calc jobId dedupe, timesheet reminders unique index, notifier dedupe. No `Idempotency-Key` support on POST (payments, batch creation, claims, leave requests) → double-click duplicates possible.
- Backups: deploy workflow runs pg_dump pre-deploy keeping 14 (deploy-hostinger.yml:49-51) — same host as DB, no off-site copy, no restore drill evidence, no PITR. VPS single box (2 CPU/8GB), single backend container 512 MB.
- Error handling: global error handler + envelope tests (response-envelope, http-status-contract). Several swallow-all `catch {}` in payroll repository (lines 309, 606, 946, 1132) silently fall back to zero bonusTax / null payIn — money-relevant silent failures.
- Exports on local disk `/tmp/exports`; ephemeral.
- Prisma pool: past incidents of `connection_limit=5` timeouts (BACKEND_STATUS.md). Verify DATABASE_URL pool on Hostinger.
- Scheduled jobs: only timesheet reminders (systemd timer); scheduled reports model exists with no visible scheduler; retention/cleanup of expired sessions/OTPs/exports has no job.

## 4. Performance risks

- N+1 in payroll: per-input `employee.findFirst` + `employeeSalary.findFirst` + `payslip.findFirst` inside loops (payroll.repository.js:914-935 for BONUS/ARREARS; regular path similar, 14 `for…of` loops in repo). With 3,000-employee tenant (live dataset) calc cost is O(N) round trips and runs on the request thread (sync fallback) or in-process worker sharing the API's 512 MB.
- Unbounded reads: 225 `findMany` calls, only ~36 followed by `take:` within 6 lines. Previously caused an OOM (reports/attendance, fixed 9e4d1f0). Exports (export.repository.js:12,44,83) load full result sets in memory then build XLSX with ExcelJS (non-streaming) — OOM risk for large tenants at 512 MB. Spot-check list endpoints for `take` cap/max limit enforcement.
- Analytics/summary aggregations are computed per request with no caching (Redis cache only on statutory packs/tenant config).
- Indexes: 214 `@@index/@@unique` declared; AuditLog (9), Notification (6) well indexed. Thin on Candidate/Review text searches; `/search` (search.controller) uses `contains` ILIKE across employees/departments/leave — needs pg_trgm indexes at scale.
- Money in denormalised JSON (`linesJson`, `summaryJson`) limits SQL reporting.
- Global rate limit store is in-memory (`cache: 10000`) — not shared across instances.

## 5. Test coverage (tests/ ~85 files, node --test; runner scripts/runTests.mjs buckets offline/db/network)

Covered: RBAC (policy, catalogue, manifest, enforcement e2e, customization, full-sweep), auth (login, refresh, me, logout, register, sessions, MFA policy, invitation, extras), leave engine (accrual, proration, encashment, ledger, year-end, applicability, chargeable days), holidays (resolver, applicability, observed, versioning), payroll maths (rounding, minor units, subMonthly, working days, statutory wage base, FX, loans, global readiness, recalc), payout (crypto, checksums, field validation, disbursement, integration), payslip + tax-form PDF, timesheets (budget/rate math, derivations, entry guards), attendance (calendar, timezone, phase3), exports/audit export, access scoping, SSRF guard, response envelope/status contract, notifier.
Not covered (no test file): recruitment, performance, assets, announcements, billing, search, notifications routes/SSE, settings (except roles), webhooks, departments CRUD (only members/rollup), employees CRUD (only profile/team access), analytics, reports content (only authz), rate limiting (which is how finding 1 went undetected), payroll run lifecycle transactions/failure recovery, concurrency/idempotency, GDPR flows, tenant-isolation negative tests per module, load/perf tests, Redis/BullMQ path.
CI: ci.yml has lint, build-check, npm audit, and a test job with postgres:16 service (needs only lint; not gating deploy-hostinger? — deploy workflow does lint + app-load build-check only, so a red test job does not block production deploy; verify in deploy-hostinger.yml). tests/e2e uses Playwright against deployed envs.

## 6. Docs sync

- Swagger: dynamic from route schemas → structurally in sync; many responses are `additionalProperties: true` (weak typing; swagger.js has large hand-written `op()` helper too at ~1958 lines).
- docs/API_MAPPING.md (5816 lines): every unique route path (385 METHOD+path tuples checked by substring on path) appears; no missing path found. Substring check does not validate fields/roles.
- Stale docs: CLAUDE.md (says Render prod, Redis removed, authorize() memberType only, 25 models, "Notifications not built"); docs/BACKEND_STATUS.md says ~354 routes / 26 migrations (now ~423 / 29), IMPLEMENTATION_STATUS.md self-declared stale; many root-level report .md files (clutter). Memory says Render is discontinued, yet CLAUDE.md/DEPLOYMENT docs still describe Render as primary.

## 7. Roadmap hints

docs/BACKEND_STATUS.md (all 12 phases "done" vs frontend contract; BullMQ/Redis later reintroduced), docs/ACCOUNTING_REIMBURSEMENT_ROADMAP.md, docs/BACKEND_IMPLEMENTATION_SPEC_2026-08-13.md, FE_CONTRACT_outstanding_work_2026-07-30.md, FRONTEND_FOLLOWUPS.md, dormant models: Resignation, Permission/RolePermission/UserRole (partly superseded), SavedView, ScheduledReport (scheduler not found).
