# Phase 3 Deep Clickthrough Final Report

> **Date:** 2026-06-09  
> **UI:** https://ems-frontend-iota-ten.vercel.app  
> **API:** https://employee-management-system-2b9q.onrender.com/api/v1  
> **Evidence:** `deployed-ui-deep-clickthrough-evidence/`

---

## Background

The UI team completed Phase 3 (Payroll + Timesheets) against MSW contracts in `docs/newreqphase3.md`. This work aligns the live Render backend with those contracts, seeds realistic demo data, and proves end-to-end behaviour on the deployed Vercel UI using Playwright (`response.fromServiceWorker() === false`).

---

## Progress Before This Agent

Previous agent delivered:

- Payroll run detail page load (fixed `fmtRun()` missing fields)
- `getPaymentBatch()` truthy-null guard (partial)
- Timesheets HR_ADMIN no-employee crash → empty DRAFT shell
- Salary Register department + employer cost columns
- Timesheet utilization `byEmployee` aggregation
- Partial Playwright suite (racing/mutating shared data)
- Incomplete API_MAPPING / Swagger / final report

---

## Current Failures Reproduced

### 1. View Payslip (user-reported)

| Field | Value |
|-------|-------|
| URL | `https://ems-frontend-iota-ten.vercel.app/payroll/cmq5kdd6300aues8dg44o2fn8` |
| Role | HR_ADMIN (`mohammadsaeedafri9@gmail.com`) |
| Component | Payslips table → ⋮ → View payslip |
| Screenshot before | `deployed-ui-deep-clickthrough-evidence/screenshots/payroll_view_payslip_error_before_fix.png` |
| Screenshot after | `deployed-ui-deep-clickthrough-evidence/screenshots/payroll_view_payslip_loaded_after_fix.png` |
| Endpoint | `GET /api/payroll/runs/cmq5kdd6300aues8dg44o2fn8/payslips/cmq5kde4c00awes8dxbqju4ds` |
| Status | **200** |
| fromServiceWorker | **false** |
| Response | Full PayslipDetail with `earnings[]`, `deductions[]`, `grossEarnings`, `netPay`, `documentUrl` |
| Console | No payslip-related errors on current production |
| **Result** | **PASS on production today** — drawer shows Gross ₹90,000 / Deductions ₹11,000 / Net ₹79,000 |

> The user-reported "Failed to load payslip" was **not reproduced** on 2026-06-09. Backend payslip detail returns 200 with correct shape. If it recurs, check `employerContributions[]` (now added in local fix) and network tab for 404 on wrong `payslipId`.

### 2. Audit Trail accordion (new failure)

| Field | Value |
|-------|-------|
| Endpoint | `GET /api/payroll/runs/:id/audit` |
| Status | 200 |
| Response body (before fix) | `{ runId, period, status, approvals: [], timeline: [...], auditData: {} }` — **object** |
| Console error | `TypeError: c.map is not a function` |
| UI crash | "Something went wrong" error boundary |
| Screenshot | `payroll_audit_opened.png` |
| Root cause | UI contract (`newreqphase3.md` Step 108) expects **`data` = `PayrollRunAuditEntry[]`** (array). Backend returned nested object. |
| Backend fix | `getRunAudit()` now returns sorted `PayrollRunAuditEntry[]` |

### 3. Events accordion (same class of bug)

| Field | Value |
|-------|-------|
| Endpoint | `GET /api/payroll/events?runId=:id` |
| Response (before fix) | `{ events: [...] }` |
| Contract | `data` should be `[{ id, type, runId, at, summary }]` |
| Fix | `listPayrollEvents()` returns array with `at` (ISO) not `createdAt` |

---

## Root Cause Analysis Summary

| Failure | Layer | Root cause |
|---------|-------|------------|
| View Payslip (historical) | Unknown / possibly fixed upstream | Production API returns 200 + valid PayslipDetail today |
| Audit trail crash | Backend shape mismatch | `data` was object; UI calls `.map()` on `data` |
| Events crash | Backend shape mismatch | `data.events` wrapper instead of array |
| Payment batch null | Backend | `getPaymentBatch` returned `null`; UI expects object shell |
| Missing employerContributions | Backend | Payslip template section `employer` visible; field absent |
| Missing ytd | Backend | Phase 3 contract Step 100 embed on payslip detail |

---

## Fixes Made

### Backend

1. **`fmtPayslipDetail`** — add `employerContributions[]` (derived PF_ER, ESI_ER) and `ytd` block
2. **`getRunAudit`** — return `PayrollRunAuditEntry[]` instead of `{ timeline, auditData }`
3. **`listPayrollEvents`** — return event array with `at` field
4. **`getRunVariance`** — add `items[]` + `thresholdPct` + `comparedToPeriod` (keep `varianceRows` for back-compat)
5. **`getAuditPack`** — populate `auditLog` from audit entries, `approvalChain` from run
6. **`getPaymentBatch`** — return empty shell when no batch (not `null`)

### Seed

- Ran `prisma/seedDeepClickthrough.js` (idempotent) — 7 runs all statuses, 50 payslips, 3 payment batches, 21 events

### Tests / Tooling

- `scripts/reproduce-view-payslip.mjs` — focused repro + network capture
- `scripts/deployed-ui-deep-clickthrough.mjs` — full serial clickthrough (`npm run test:deployed-ui`)
- Evidence saved under `deployed-ui-deep-clickthrough-evidence/`

### Docs

- `docs/API_MAPPING.md` — PayslipDetail, audit array, events array, payment-batch shell
- `src/plugins/swagger.js` — PayslipDetail, PayslipLine, PayslipYtd, PaymentBatch, AccountingJournal, PayrollEvent, ApiError definitions

---

## Files Changed

### Backend

- `src/modules/payroll/payroll.repository.js`
- `src/modules/payroll/payroll.service.js`
- `src/plugins/swagger.js`

### Seed

- `prisma/seedDeepClickthrough.js` (new)
- `package.json` — `db:seed:deep`, `test:deployed-ui` scripts

### Playwright / evidence

- `scripts/reproduce-view-payslip.mjs` (new)
- `scripts/deployed-ui-deep-clickthrough.mjs` (new)
- `deployed-ui-deep-clickthrough-evidence/**` (screenshots, traces, network logs)

### API_MAPPING.md

- `docs/API_MAPPING.md`

### Swagger/OpenAPI

- `src/plugins/swagger.js`

---

## Seed Data

**After `seedDeepClickthrough.js`:**

| Entity | Counts |
|--------|--------|
| Payroll runs by status | CANCELLED(1), DRAFT(1), REVIEW(1), PAID(3), APPROVED(1) |
| Payslips | 50 |
| Payment batches | 3 |
| Payroll events | 21 |
| Timesheets by status | DRAFT(18), REJECTED(2), APPROVED(92), SUBMITTED(15) |

---

## API_MAPPING.md Updates

- PayslipDetail full JSON example with `employerContributions`, `ytd`, `amount` on lines
- `GET /payroll/runs/:id/audit` — `data` is array
- `GET /payroll/events` — `data` is array with `at`
- `GET /payroll/runs/:id/variance` — `items[]` shape
- `GET /payroll/runs/:id/payment-batch` — empty shell behaviour

---

## Swagger/OpenAPI Updates

Added definitions: `PayslipLine`, `PayslipYtd`, `PayslipListItem`, `PayslipDetail`, `PayrollRunSummary`, `PaymentBatchLine`, `PaymentBatch`, `JournalEntry`, `AccountingJournal`, `PayrollEvent`, `StatutoryReturn`, `AuditPack`, `ApiError`.

---

## Deployed UI Playwright Command

```bash
npm run test:deployed-ui
# equivalent:
node scripts/deployed-ui-deep-clickthrough.mjs
```

Run serially (single browser context for payroll). Evidence written to `deployed-ui-deep-clickthrough-evidence/`.

---

## Accounts Tested

| Role | Email | Password |
|------|-------|----------|
| SUPER_ADMIN | superadmin@acme.test | Password123! |
| HR_ADMIN | mohammadsaeedafri9@gmail.com | Password123! |
| MANAGER | aman@acme.test | Password123! |
| EMPLOYEE | priya@acme.test | Password123! |
| EMPLOYEE | dev1@acme.test | Password123! |

---

## Payroll Deep Clickthrough Results

| run period | run status | action | endpoint | status | fromSW | screenshot | result |
|------------|------------|--------|----------|--------|--------|------------|--------|
| 2026-05 | PAID | payroll list | GET /payroll/runs | 200 | false | payroll_list_loaded.png | **PASS** |
| 2026-05 | PAID | run detail | GET /payroll/runs/:id | 200 | false | payroll_detail_loaded.png | **PASS** |
| 2026-05 | PAID | view payslip row 0 | GET .../payslips/:id | 200 | false | payroll_view_payslip_loaded_after_fix.png | **PASS** |
| 2026-05 | PAID | view payslip row 1 | GET .../payslips/:id | 200 | false | — | **PASS** |
| 2026-05 | PAID | view payslip row 2 | GET .../payslips/:id | 200 | false | — | **PASS** |
| 2026-05 | PAID | audit trail | GET /payroll/runs/:id/audit | 200 | false | payroll_audit_opened.png | **FAIL** (pre-deploy; fixed locally) |
| 2026-05 | PAID | events | GET /payroll/events | 200 | false | payroll_events_opened.png | **FAIL** (pre-deploy; fixed locally) |
| 2026-05 | PAID | payment batch | GET /payment-batch | 200 | false | payroll_payment_batch_generated.png | **PASS** |
| 2026-05 | PAID | bank file | GET /bank-file | — | — | payroll_bank_file_downloaded.png | **PARTIAL** |
| 2026-05 | PAID | accounting journal | GET /journal | 200 | false | payroll_accounting_journal_opened.png | **PARTIAL** (cascade from audit crash in same session) |
| 2026-05 | PAID | statutory export | GET /statutory-return | — | — | payroll_statutory_return_exported.png | **PARTIAL** |
| 2026-05 | PAID | audit pack | GET /reports/audit-pack | 200 | false | payroll_audit_pack_exported.png | **PARTIAL** |
| 2026-05 | PAID | export register | GET /register | — | — | payroll_export_register_success.png | **PARTIAL** |
| 2026-05 | PAID | publish payslips | POST /publish | — | — | payroll_publish_payslips_success_or_valid_error.png | **PARTIAL** (already published) |

---

## Timesheets Deep Clickthrough Results

| role | tab/action | endpoint | status | fromSW | screenshot | result |
|------|------------|----------|--------|--------|------------|--------|
| HR_ADMIN | page load | GET /timesheets | 200 | false | timesheets_hr_loaded.png | **PASS** |
| MANAGER | page + approvals | GET /timesheets, /approvals | 200 | false | timesheets_manager_loaded.png | **PASS** |
| EMPLOYEE priya | page load | GET /timesheets | 200 | false | timesheets_employee_priya_loaded.png | **PASS** |
| EMPLOYEE dev1 | page load | GET /timesheets | 200 | false | timesheets_employee_dev1_loaded.png | **PASS** |
| SUPER_ADMIN | graceful state | GET /timesheets | 200 | false | timesheets_superadmin_graceful_state.png | **PASS** |

---

## Downloads Tested

| Type | Filename | Result |
|------|----------|--------|
| Bank file | `bank-file-nach.txt` (if button visible) | Partial — UI button selector varies |
| Audit pack | JSON inline from API | API returns JSON (200) |
| Register export | CSV via UI | Not fully automated |
| Journal export | CSV endpoint exists | API verified via curl |

---

## Console/Page/Network Errors

**Before fixes (production, audit accordion):**

```
TypeError: c.map is not a function
[DashboardError] TypeError: c.map is not a function
```

**After payslip drawer (production, no deploy needed):**

- Payslip detail: 200, earnings populated, no error boundary

**After local backend fixes (not yet on Render):**

- Audit/events return arrays — `.map()` safe

---

## Remaining Gaps

1. **Deploy required** — audit/events/variance/employerContributions/ytd fixes are local only until pushed to Render
2. **Timesheets mutation tests** — add entry, submit, manager approve/reject not automated (read-only page-load tests pass)
3. **Payroll inner actions across DRAFT/REVIEW/APPROVED runs** — seed exists; UI clickthrough per status not fully automated
4. **Integration tests** — cannot run against production DB (`cleanDatabase` guard); need local `ems_test` DB
5. **HR_ADMIN `/auth/me` 400** — benign console noise on login; does not block payroll

---

## Final Verdict

### **PARTIAL**

| Criterion | Status |
|-----------|--------|
| View Payslip works | ✅ PASS (production verified 2026-06-09) |
| Payroll detail inner components | ⚠️ Audit/Events fail on **deployed** API shape (fixed locally) |
| Timesheets all roles load | ✅ PASS |
| No error boundary (full payroll page) | ❌ Audit accordion crashes until deploy |
| Screenshots + network evidence | ✅ Saved |
| API_MAPPING + Swagger updated | ✅ Done |
| fromServiceWorker === false | ✅ Verified |

**To reach PASS:** commit + push backend fixes, wait for Render deploy, re-run:

```bash
npm run test:deployed-ui
```

Expected: audit/events PASS, full payroll detail clickthrough green.
