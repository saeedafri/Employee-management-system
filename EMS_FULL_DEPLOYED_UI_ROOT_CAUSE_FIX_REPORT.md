# EMS Full Deployed UI Root Cause Fix Report

## Background

The UI team deployed Phase 3 frontend to `https://ems-frontend-iota-ten.vercel.app`. Screens call the Vercel BFF (`/api/*`) which proxies to the live backend at `https://employee-management-system-2b9q.onrender.com/api/v1`. Contracts are defined in `docs/newreqphase3.md`. This agent re-audited the deployed UI with Playwright, captured network evidence, and implemented backend fixes locally. **Fixes are not yet live on Render** until commit + deploy.

## Previous Progress

Earlier agents fixed payroll run detail first-level crash, payment-batch null shape, partial timesheet SUPER_ADMIN handling, some seed data, and partial Playwright scripts. API_MAPPING/Swagger and full deep clickthrough remained incomplete; prior PASS claims were not verified end-to-end.

## Full Deployed UI Audit Summary

Playwright audit script: `node scripts/deployed-ui-full-audit.mjs`  
Evidence: `deployed-ui-full-audit-evidence/`

| Module | HR_ADMIN result (pre-fix, production backend) |
|--------|-----------------------------------------------|
| Dashboard | FAIL — `GET /manager/approvals` 403 |
| Payslip Template | FAIL — API 200 but UI crash (`reading 'color'`) |
| Pay Schedules | OK (may show empty if no calendars seeded) |
| Email Integration | FAIL — 404 routes missing |
| Storage Integration | FAIL — 404 routes missing |
| Webhooks | FAIL — 404 routes missing |
| Departments | OK |
| Payroll list | OK |
| Timesheets | OK |
| Employee Compensation | FAIL — APIs 200, UI crash (`reading 'color'`) |

## Failures Reproduced

### 1. Dashboard Pending Approvals

| Field | Value |
|-------|-------|
| URL | `/dashboard` |
| Role | HR_ADMIN |
| Endpoint | `GET /api/manager/approvals` |
| Status | **403** |
| Body | `{ "code": "FORBIDDEN", "message": "Only managers can access this" }` |
| Console | `[DashboardError] TypeError: Cannot read properties of undefined (reading 'color')` |
| Screenshot | `deployed-ui-full-audit-evidence/screenshots/dashboard_pending_approvals_error_before_fix.png` |
| Root cause | Controller restricted endpoint to MANAGER only; UI calls it for HR dashboard. Unified `items[].color` missing. |

### 2. Payslip Template

| Field | Value |
|-------|-------|
| URL | `/settings/pay/payslip-template` |
| Endpoint | `GET /api/payroll/payslip-templates` → **200** |
| Issue | Sections used `id`/`visible` (`employer` not `employerContributions`); no `color` field |
| Console | `TypeError: Cannot read properties of undefined (reading 'color')` |
| Screenshot | `deployed-ui-full-audit-evidence/screenshots/settings_payslip_template_error_before_fix.png` |

### 3–5. Integration Settings

| Page | Endpoint | Status |
|------|----------|--------|
| Email | `GET /settings/integrations/email`, `/stats` | **404** |
| Storage | `GET /settings/integrations/storage` | **404** |
| Webhooks | `GET /settings/webhooks` | **404** |

### 6. Employee Compensation

| Field | Value |
|-------|-------|
| Endpoints | All 200 (`/payroll/employees/:id/salary`, `/components`, etc.) |
| Console | `reading 'color'` on component type map (`BENEFIT` not in UI palette) |
| Screenshot | `employee_compensation_error_before_fix.png` |

### 7. Departments "Tenant not found"

Intermittent on first `/auth/me` before login completes (INVALID_TENANT). **Not reproduced** during this audit after login — departments returned 200. Likely race before JWT cookie is set.

## Root Causes

| Category | Issues |
|----------|--------|
| Missing routes | `/settings/integrations/*`, `/settings/webhooks` |
| Wrong response shape | Payslip template sections; salary `calculatedComponents` missing `color`; reimbursement categories missing `color` |
| Role gate | `/manager/approvals` blocked HR_ADMIN |
| Missing endpoint | `GET /employees/:id/activity` |
| Seed gaps | Pay calendars, integration settings, normalized payslip template in DB |

## Fixes Made

1. **Integration settings module** — `src/modules/settings/integrations.service.js` + routes for email/storage/webhooks (Resend + Cloudinary aware).
2. **Payslip template normalization** — `fmtPayslipTemplateForUi()` emits `key`, `enabled`, `order`, `color`.
3. **Dashboard approvals** — HR_ADMIN/SUPER_ADMIN tenant-wide queue; unified `items[]` with `color`, timesheets + assets included.
4. **Compensation colors** — `withComponentColor()` on salary components; reimbursement category colors.
5. **Employee activity** — `GET /employees/:id/activity` from audit logs + leave + documents.
6. **Pay schedules** — `getPaySchedules()` merges pay groups + pay calendars.
7. **Seed** — `prisma/seedPhase3Integrations.js` (idempotent calendars, template, integration defaults).
8. **Docs** — `docs/API_MAPPING.md` + Swagger schemas updated.
9. **Tests** — `scripts/deployed-ui-full-audit.mjs`, `tests/e2e/deployed-full-clickthrough.spec.ts`, `playwright.config.js`.

## Files Changed

### Backend
- `src/utils/payrollUiShapes.js` (new)
- `src/modules/settings/integrations.service.js` (new)
- `src/modules/settings/settings.controller.js`
- `src/modules/settings/settings.routes.js`
- `src/modules/payroll/payroll.service.js`
- `src/modules/payroll/payroll.repository.js`
- `src/modules/dashboard/manager.controller.js`
- `src/modules/dashboard/manager.service.js`
- `src/modules/employees/employees.service.js`
- `src/modules/employees/employees.controller.js`
- `src/modules/employees/employees.routes.js`
- `src/plugins/swagger.js`

### Seeds
- `prisma/seedPhase3Integrations.js` (new)

### Tests
- `scripts/deployed-ui-full-audit.mjs` (new)
- `tests/e2e/deployed-full-clickthrough.spec.ts` (new)
- `playwright.config.js` (new)
- `package.json` (scripts)

### Docs
- `docs/API_MAPPING.md`
- `EMS_FULL_DEPLOYED_UI_ROOT_CAUSE_FIX_REPORT.md` (this file)

## Seed Data

Seed script: `npm run db:seed:integrations`  
**Note:** Render DB was unreachable from local agent during seed run; run after deploy when DB is available.

Expected after seed:
- Pay calendars: +5 (IN monthly/biweekly, US monthly/biweekly, UK monthly)
- Integration settings: 3 rows (`email`, `storage`, `webhooks`)
- Payslip template: normalized sections with `employerContributions` + colors

## API_MAPPING.md Updates

- Payslip template UI contract (`key`, `enabled`, `color`)
- Settings integrations (email, storage, webhooks)
- Dashboard pending approvals (HR + manager, `items[].color`)
- Employee activity endpoint
- Compensation `color` on components
- Pay schedules merge behavior

## Swagger/OpenAPI Updates

- Routes: `/settings/integrations/email`, `/storage`, `/webhooks`, `/employees/{id}/activity`
- Schemas: `PayslipTemplate`, `PayslipTemplateSection`, `EmailIntegrationSettings`, `StorageIntegrationSettings`, `WebhookConfig`, `PendingApproval`, `EmployeeActivityItem`

## Playwright Evidence

**Pre-fix audit command:**
```bash
node scripts/deployed-ui-full-audit.mjs
```

**Post-deploy verification command:**
```bash
npm run test:playwright:deployed
# or
npx playwright test tests/e2e/deployed-full-clickthrough.spec.ts --project=chromium --workers=1
```

- **Deployed URL:** `https://ems-frontend-iota-ten.vercel.app`
- **Evidence folder:** `deployed-ui-full-audit-evidence/`
- **Account tested (audit):** `mohammadsaeedafri9@gmail.com` (HR_ADMIN)

## Settings Results (pre-fix production)

| Page | Endpoint | Status | Result |
|------|----------|--------|--------|
| Payslip Template | GET `/payroll/payslip-templates` | 200 | FAIL (UI crash) |
| Pay Schedules | GET `/payroll/schedules` | 200 | PASS |
| Email/Resend | GET `/settings/integrations/email` | 404 | FAIL |
| Storage | GET `/settings/integrations/storage` | 404 | FAIL |
| Webhooks | GET `/settings/webhooks` | 404 | FAIL |

## Dashboard Results

| Component | Endpoint | Pre-fix | Post-fix (local code) |
|-----------|----------|---------|------------------------|
| Pending Approvals | GET `/manager/approvals` | 403 | 200 + `items[].color` |

## Employee Profile Results

| Tab | Pre-fix | Fix |
|-----|---------|-----|
| Compensation | UI crash (color) | `color` on components |
| Activity | Not called / missing route | `GET /employees/:id/activity` added |
| Documents | Loads | Unchanged (download needs Cloudinary on Render) |

## Departments Results

Pre-fix audit: **PASS** (200). Intermittent tenant errors tied to pre-auth `/auth/me` race, not departments module.

## Payroll Results

List/detail previously partially working. Payslip drawer fix (`employerContributions`, `ytd`, `amount`) was in codebase from prior agent; **requires deploy** to verify on production UI.

## Timesheets Results

HR/MANAGER/EMPLOYEE pages loaded in audit (200 on core endpoints). Deep mutation tests deferred to post-deploy Playwright suite.

## Network Evidence

See `deployed-ui-full-audit-evidence/network-logs/*.json` — all captured with `fromServiceWorker: false`.

## Remaining Gaps

1. **Deploy to Render required** — production still returns 404 for new routes until push + deploy.
2. **Seed not run** — DB unreachable locally during this session.
3. **Cloudinary** — document download/upload still needs Render env vars.
4. **Full payroll inner clickthrough** — not re-verified post-fix on deployed UI (blocked by deploy).
5. **Multi-role Playwright suite** — MANAGER/EMPLOYEE/SUPER_ADMIN serial tests not completed.
6. **`@playwright/test`** — may need `npm i -D @playwright/test` if test runner package missing.

## Final Verdict

**PARTIAL**

Fixes are implemented and documented locally with reproduced root causes and before-fix evidence. Deployed UI **cannot PASS** until backend is deployed to Render, seed is run, and Playwright post-fix screenshots are captured.
