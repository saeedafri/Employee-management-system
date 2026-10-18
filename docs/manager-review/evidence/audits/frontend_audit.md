# EMS Frontend Audit (/Users/mohdsaeedafri/All-Code-Base/ems-frontend)

Scope: read-only. Backend cross-ref by static grep of /Users/mohdsaeedafri/All-Code-Base/EMS/src/modules/**/*routes*.js. No BE tests, no curl. Method caveat: FE API paths were extracted by regex from literal `apiClient.<verb>('/path')` calls (173 calls); non-literal/dynamic calls are not covered, so mismatch list is a lower bound.

## 1. Stack
- Next.js 16.2.6 (App Router, Turbopack), React 19.2.4, TypeScript 5, Tailwind 4, shadcn/base-ui, pnpm (package.json).
- Data: TanStack Query 5 (src/lib/query-client.ts, staleTime 30s), axios (src/lib/api-client.ts, silent 401 refresh queue), zustand (src/store/ui.store.ts, payroll.store.ts), react-hook-form + zod 4, TanStack Table, recharts 3, nuqs, dnd-kit, date-fns(-tz), sonner.
- BFF proxy: src/app/api/[...path]/route.ts forwards /api/* to API_BASE_URL; httpOnly cookie auth; no tenant header (JWT carries tenant). Only 1 dynamic route handler.
- MSW mock layer: src/mocks (11.1k lines handlers, ~324 handler routes, payroll-heavy); gated by NEXT_PUBLIC_USE_MOCKS (default false; .env.local = false). Mock mode off => pages hit real BE.
- Gating: permission-key based (src/lib/permissions.ts `can()`, SUPER_ADMIN bypass), NOT role based. Nav in src/shared/layouts/AppShell.tsx NAV_ITEMS. Page guards: RequirePermission (src/shared/guards). Auth = client-side AuthGuard only (no middleware.ts/proxy.ts) -> flash of spinner, no server-side redirect.
- Deploy: vercel.json (region bom1 only). No .github/ workflows in FE repo. Husky pre-commit/pre-push/commit-msg present.

## 2. Commands run and results
| Command | Result |
|---|---|
| pnpm lint | exit 0; 0 errors, 54 warnings (mostly react-hooks/incompatible-library: RHF `watch()` not memoizable, e.g. src/modules/timesheets/components/DelegationsTab.tsx:178) |
| pnpm typecheck (tsc --noEmit) | exit 0, clean |
| pnpm test:run (vitest) | exit 1: 148/149 files pass; 899/901 tests pass; 2 FAIL, both in src/modules/holidays/components/__tests__/OptionalHolidayPicker.test.tsx ("enforces the restrictedLimit cap", "toggling a checkbox ... flips state via the resolved query"; waitFor timeouts ~1s, likely timing/flaky under 9-way parallel load, or real regression in optional-holiday toggle; not investigated). Duration 86s. |
| pnpm build (next build) | exit 0; compiled 7.4s; 60 static pages; 3 dynamic (employees/[id], employees/[id]/edit, payroll/[runId]) + login (dynamic) + api proxy |
| Bundle | .next/static = 6.2 MB total, 104 chunk files. 7 chunks >150KB: 468KB, 361KB x3 (identical size, suspicious duplication), 326KB, 284KB, 228KB (uncompressed). Next 16 build output no longer prints per-route First Load JS; no gzip figures captured. |
Node modules already installed; no install needed. Test count: 149 test files, 901 tests.

## 3. Route/page inventory (59 pages) and per-role reachability
Role->permissions from src/lib/__fixtures__/live-role-permissions.ts (captured live 2026-08-17): SUPER_ADMIN 56 keys, HR_ADMIN 53, MANAGER 21, EMPLOYEE 12, AUDITOR 12. Nav gates in AppShell.tsx.

Auth (public): /login, /signup, /forgot-password, /reset-password, /set-password (invite), /otp-verification. All wired to real BE (/auth/login, /register, /forgot-password, /reset-password, /accept-invitation, /otp/initiate, /verify-otp; all exist in auth.routes.js).

| Page | SUPER_ADMIN | HR_ADMIN | MANAGER | EMPLOYEE | AUDITOR |
|---|---|---|---|---|---|
| /dashboard (role-aware: manager/employee dashboards) | Y | Y | Y | Y | Y |
| /employees, /employees/[id] (employees:read) | Y | Y | Y (team) | Y (self-scoped by BE) | Y |
| /employees/new, /[id]/edit (employees:write) | Y | Y | - | - | - |
| /departments (departments:read) | Y | Y | Y | Y | Y |
| /attendance (attendance:read) | Y | Y | Y | Y | Y |
| /timesheets (timesheets:write/approve/admin) | Y | Y | Y | Y | - (read only, no nav) |
| /leave (leave:read) | Y | Y | Y | Y | Y |
| /holidays | Y | Y | Y | Y | Y |
| /payroll (admin or self-read+employeeId), /payroll/[runId], /global, /migration | Y | Y | self view | self view | self view |
| /payroll/my-payslips | Y | Y | Y | Y | Y |
| /payout-methods (self/manage), /payout-methods/approvals (manage) | Y | Y | self | self | self |
| /reports (reports:read) | Y | Y | - | - | - |
| /analytics (analytics:read) | Y | Y | - (has team-read only) | - | Y |
| /permissions (permissions:manage) | Y | - | - | - | - |
| /recruitment (recruitment:read) | Y | Y | Y | - | - |
| /performance (performance:read) | Y | Y | Y | - | - |
| /assets (assets:manage) | Y | Y | - | - | - |
| /announcements (announcements:read) | Y | Y | Y | Y | Y |
| /settings + 29 sub-pages (attendance-rules, audit-log, authentication, billing-*, branding, company-profile, email-templates, integration-*, leave-*, locale, notifications, sessions, timesheets, working-hours, pay/*) | per-panel perms; /settings redirects to first openable panel | most | few (self profile/sessions) | self | audit-log read |

## 4. Feature inventory by domain and wiring status
Legend: REAL = calls an existing BE route (verified by static route match); MOCK = only exists in MSW (used only when USE_MOCKS=true); NONE = no FE or BE.

| Domain | FE module | Status |
|---|---|---|
| Auth/MFA | modules/auth; settings/authentication | REAL (login, refresh, logout-all, sessions, /auth/me/mfa toggle, OTP). MFA policy UI present. |
| Employees | modules/employees (list, create stepper, edit, detail, docs, photo, bulk export, next-code) | REAL. |
| Departments | modules/departments | REAL |
| Leave | modules/leave (requests, balances, types, policies, packs, assignments, engine preview) | REAL except preview verb bug (see 5) |
| Attendance | modules/attendance (check-in/out, calendar, regularization, rules) | REAL (FE has client-side "engine" dir computing statuses; verify parity) |
| Timesheets | modules/timesheets (22 calls: projects, delegations, approval chain, templates) | REAL |
| Payroll | modules/payroll (39 calls: runs, components, groups, payslips, loans, garnishments, claims, statutory, tax forms, accounting, migration, global) | REAL for paths matched; 28 MSW handler files, very large MOCK surface (payroll-*.ts); CLAUDE.md of BE says payroll has no model historically, now exists. Several `grep -i stub/placeholder` hits in LoansCard, GarnishmentsCard, ClaimsCard, PayslipDrawer, statutory.types -> check for client-side placeholder content. |
| Holidays | modules/holidays (optional holidays picker, country resolve) | REAL; 2 failing tests here |
| Onboarding | only set-password/accept-invitation + employee invite + EmployeeFormStepper | PARTIAL; no onboarding checklist/task module |
| Recruitment | modules/recruitment (7 calls) | REAL |
| Performance | modules/performance (6 calls) | REAL |
| Learning | none | NONE (no FE, no BE) |
| Expenses | payroll ClaimsCard (reimbursement claims under payroll) | REAL via payroll claims; no standalone expenses module |
| Documents | employees/services/documents.api.ts (upload/list/delete) | REAL; no org-wide documents library |
| Helpdesk | none | NONE |
| Assets | modules/assets (9 calls) | REAL |
| Announcements | modules/announcements | REAL |
| Analytics | modules/analytics (summary, attendance only: 2 calls) + reports (4) | REAL, thin: BE offers headcount-by-department, recent-activity, leave-summary not called from literal calls |
| Settings | modules/settings (10 + billing 4) | REAL; settings/components/PlaceholderPanel.tsx exists but is unused (dead) |
| Notifications | modules/notifications (bell, list, unread-count, mark read) | REAL; SSE stream /notifications/stream not used (polling) - verify |
| Search | modules/search (/search) | REAL |
| RBAC | modules/permissions (/permissions page) | REAL (BE publishes permission catalogue per recent commits) |

Hard-coded: no page found hard-coded in production path; mocks are isolated under src/mocks and gated by env. Static constants (e.g. src/modules/payroll/constants/iso-countries.ts, permissions.constants.ts) are legitimate reference data.

## 5. FE/BE contract mismatches
1. VERB MISMATCH (confirmed): FE `GET /leave/requests/preview` (src/modules/leave/services/leave.api.ts:116, doc comment line 107) vs BE `POST /leave/requests/preview` (EMS/src/modules/leave/leave.routes.js:92). The pre-submit leave engine dry-run will 404/405 against a real backend. Mock handlers likely hide this (MSW passes).
2. Potential template false-positive: `/timesheets/projects${qs}` (projects.api.ts:11) matches BE `GET /timesheets/projects`; not a real mismatch.
3. 21 other regex "misses" (employees, departments, holidays, manager/*, employee/dashboard) were verified as extraction artifacts of BE routes using multi-line `fastify.get(\n '/path'` registration; those paths exist (e.g. dashboard/manager.routes.js:67, employee.routes.js:13, employees.routes.js:281,332). Count of BE routes extracted statically (381) undercounts for same reason.
4. Field-name drift: not exhaustively diffed. FE uses camelCase and `{success,data}` envelope consistently (notifications.api.ts). Recommend a schema-diff (zod on FE vs BE JSON schema) pass; FE has docs for E2E contracts (docs/E2E_*_CONTRACT.md) indicating prior drift was tracked. Not verified here.
5. Error handling: central axios interceptor handles 401 refresh only; 140 TSX files reference isError; ErrorState component exists (src/components/feedback/ErrorState.tsx). 400/403/409/422 handling is per-feature, not centralized; no global request-id surfacing seen.
6. Dead mock-only risk: ~28 payroll MSW handler files mirror BE; any FE call path the BE lacks only shows up with USE_MOCKS=false. Run a contract check (e.g. extract MSW paths vs BE routes) before release; wiring beyond literals unverified.

## 6. Quality assessment
- UX: consistent design system (shadcn + tokens like bg-canvas, fg-muted), dark mode (next-themes), command-style GlobalSearch, notification bell, toasts, type-to-confirm dialogs for destructive actions, DynamicTable/DynamicForm/ChartEngine shared engines. Mature.
- States: 111 files use Skeleton, 68 use EmptyState, 140 handle isError; good coverage. NoEmployeeRecordState handles users without employee link (nice).
- Accessibility: html lang="en" (src/app/layout.tsx:32); focus-visible rings in nav; aria-* present in ~180 files; only ~15 sr-only/skip uses outside ui/. No skip-to-content link found, no automated a11y tests (no axe/jest-axe). Base-ui/shadcn primitives provide good defaults. No Lighthouse/axe run (not requested/available).
- i18n/RTL: NONE. No next-intl/i18next, all strings hard-coded English, lang fixed "en", no dir handling. Physical direction classes dominate: ~147 ml/mr/pl/pr-N usages vs few logical (ms/me/ps/pe); 300 text-left/right. RTL (Arabic/Hebrew, KWD tenant exists in BE) would break. Number/date formatting uses Intl with tenant locale (src/lib/format.ts) and a settings/locale page: partial L10n, no i18n.
- Responsive: AppShell has mobile Sheet drawer + collapsible sidebar; tables likely scroll; not visually verified (no browser run).
- Performance: TanStack Query 30s staleTime, Turbopack, code splitting by route (Next default). Zero next/dynamic or React.lazy usage (count 0) -> heavy libs (recharts ~, dnd-kit, react-table, expr-eval) load with their routes only; payroll pages very large. 6.2MB static output; largest chunk 468KB raw. Most dashboard routes are '○ static' shells but all data is client-side fetched behind a client AuthGuard (waterfall: /auth/me then data). No server components data prefetch, no streaming.
- State mgmt: server state in React Query; UI/payroll local state in zustand; auth via provider context (src/providers). Clean separation; modules follow components/hooks/services/types/validations.
- Tests: 149 files/901 tests (vitest + jsdom + RTL + MSW), unit-level incl. permissions, engines, handlers. 99.8% passing. No coverage tooling configured (no coverage script/provider). No CI in repo (.github missing) - only husky hooks.
- E2E: none. No Playwright/Cypress dependency, config or specs in the FE repo (package.json, root listing). docs/E2E_*.md exist (E2E_DEEP_AUDIT, STRICT_AUDIT, etc.) and a role-permission fixture was "captured live" 2026-08-17, implying E2E was performed out-of-repo or by tooling not checked in. Therefore cannot run e2e locally. Playwright MCP in this environment is also failing to connect (ENOENT /tmp/playwright-mcp).

## 7. Biggest gaps (ranked)
1. Leave preview GET vs POST mismatch (real defect).
2. No e2e suite or CI in repo; 2 failing unit tests (holidays optional picker) -> red suite.
3. No i18n/RTL; hard-coded English and physical CSS direction.
4. Client-only auth guard (no middleware) -> flash, and per-page security relies on BE.
5. Missing domains: learning, helpdesk, onboarding workflow, standalone expenses & documents library (no BE counterpart for learning/helpdesk either).
6. Large mock surface (28 payroll handler files) can mask contract drift; no automated FE<->BE contract test.
7. No bundle budget/analysis; no dynamic imports; recharts/payroll heavy chunks; duplicate 361KB chunks x3 worth inspecting.
8. 54 lint warnings (RHF watch memoization) = React Compiler skips those components.
