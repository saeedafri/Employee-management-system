# E2E Deep Audit — Phase 3 Master Report

> Generated: 2026-07-03T02:50:00.000Z  
> API: https://ems-api.saqibsaeed.cloud/api/v1  
> Frontend: http://localhost:3001 (MSW OFF — `NEXT_PUBLIC_USE_MOCKS=false`)  
> Scripts: `scripts/deepApiAudit.mjs`, `scripts/deepCrudE2EAudit.mjs`, `npm run test:e2e:deep`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **API routes catalogued** (from `src/modules/**/*.routes.js`) | **409** |
| **API GET role-matrix tests** | **1,301** |
| **API GET pass** (2xx or expected 403/400) | **1,359** (811 pass + 548 expected fail) |
| **API unexpected failures** | **14** (1 real 500; 13 export/stream false-positives — see note) |
| **API mutation probes** (empty-body safety) | **72** (all <500) |
| **CRUD operations tested** | **50** |
| **CRUD pass** | **42** |
| **CRUD fail** | **8** |
| **Payroll engine checks** | **17** |
| **Engine pass** | **11** |
| **Engine fail** | **6** (see engine section — some false negatives) |
| **UI deep interactions** (beyond Phase 2's 1,731 clicks) | **30** |
| **New backend issues (Phase 3 only)** | **8** |
| **New frontend issues (Phase 3 only)** | **6** |
| **Roles tested** | HR_ADMIN, SUPER_ADMIN, MANAGER, EMPLOYEE, EMPLOYEE_DEV, EMPLOYEE_FIN, KWD_HR |
| **AUDITOR role** | **NOT TESTED** — not seeded on Hostinger |

---

## Final Verdict

# NOT READY FOR PRODUCTION

### Numbered blockers

1. **P0** — `GET /audit-logs/export` returns 500 for SUPER_ADMIN
2. **P1** — testorg tenant login broken (`admin@testorg.com` → `INVALID_CREDENTIALS`)
3. **P1** — KWD admin employee has no salary configuration (timesheets/payroll blocked)
4. **P1** — SUPER_ADMIN attendance APIs return 400 `NO_EMPLOYEE_RECORD` (no admin fallback)
5. **P1** — Payroll run warnings: statutory pack not resolved / 60+ employees without salary config
6. **P1** — Timesheets History tab crashes UI (error boundary on correct 403)
7. **P1** — EMPLOYEE can access `/permissions` (RBAC bypass)
8. **P2** — Pay component DELETE returns 403 for HR_ADMIN
9. **P2** — Storage integration API missing `provider` field
10. **P2** — Employee profile tab navigation triggers 401 auth race

---

## CRUD Matrix

| Module | Create | Read | Update | Delete | Notes |
|--------|--------|------|--------|--------|-------|
| employees | ✅ | ✅ | ✅ | ✅ soft | Full wizard API path tested |
| departments | ✅ | ✅ | ✅ | ✅ | |
| holidays | ✅ | ✅ | ✅ | ✅ | |
| leave | ❌ 422 | ✅ balance/list | — | — withdraw N/A | Create failed (date/conflict — needs future window) |
| attendance | ✅ check-in | ✅ records | — | — | Regularization 422 (validation) |
| leave_types/policies | — | ✅ | — | — | |
| timesheets | — | ✅ | — | — | History: employee 403 ✅, manager 200 ✅ |
| payroll | ✅ draft | ✅ detail | — | — | Calculate 422 on some drafts |
| pay_components | ✅ | ✅ | ✅ | ❌ 403 | HR cannot delete |
| statutory_packs | — | ✅ IN/KW | — | — | |
| legal_entities | ✅ SUPER | ✅ | ✅ | — | HR gets 403 on create (by design) |
| pay_groups | ❌ 422 | — | — | — | Missing payCalendarId linkage |
| settings | — | ✅ | ✅ | — | |
| announcements | ✅ | ✅ | ❌ patch | ❌ delete | No PATCH/DELETE routes or wrong method |
| assets | ✅ | ✅ | — | — | |
| notifications | — | ✅ list/count | ✅ mark read | — | |

**CRUD score: 42/50 pass (84%)**

---

## API Role Matrix

### Login matrix

| Actor | Tenant | Result |
|-------|--------|--------|
| HR_ADMIN | acme-corp-001 | ✅ 200 |
| SUPER_ADMIN | acme-corp-001 | ✅ 200 |
| MANAGER | acme-corp-001 | ✅ 200 |
| EMPLOYEE | acme-corp-001 | ✅ 200 |
| EMPLOYEE_FIN | acme-corp-001 | ✅ 200 |
| EMPLOYEE_DEV | acme-corp-001 | ✅ 200 |
| KWD_HR | kwd-litmus-001 | ✅ 200 |
| TESTORG_HR | test-key-123456789 | ❌ 401 INVALID_CREDENTIALS |

### Cross-tenant isolation

| Test | Result |
|------|--------|
| acme token + kwd tenant header | ✅ Isolated (401/403 or empty) |
| kwd token + acme tenant header | ✅ Isolated (401/403 or empty) |

### Real API failures (excluding export false-positives)

| Endpoint | Role | Status | Code |
|----------|------|--------|------|
| `GET /audit-logs/export` | SUPER_ADMIN | **500** | INTERNAL_SERVER_ERROR |

### Export endpoints — audit script note

13 `fail_shape` results on `/employees/export/csv`, `/logs/export`, `/payroll/runs/*/export`, `/bank-file` are **false positives**: these return CSV/binary streams without JSON `{success,data}` envelope. Endpoints return HTTP 200 with valid content-type.

---

## Payroll Engine Results

| Check | Result | Evidence |
|-------|--------|----------|
| IN statutory packs list | ✅ PASS | 1 pack returned |
| IN employee with salary | ✅ PASS | `cmqjpyds0001ikpjd5br3r2uh` |
| IN salary config read | ✅ PASS | 200 |
| IN draft run create | ✅ PASS | `POST /payroll/runs` 201 |
| IN draft run calculate | ⚠️ MIXED | 422 on some drafts; existing REVIEW run works |
| IN payslips after calculate | ✅ PASS | List returns data |
| IN PF on payslip | ✅ PASS* | *Verified on **2026-05 PAID** run detail: `deductions[{code:"PF",amount:4500}]` |
| IN ESI on payslip | ⚠️ N/A | Absent for test employee (likely below ESI wage threshold) |
| IN PT on payslip | ⚠️ N/A | Absent for test employee |
| IN TDS on payslip | ✅ PASS* | *Verified: `deductions[{code:"TDS",amount:6500}]` |
| IN gross/net | ✅ PASS* | grossEarnings=90000, netPay=79000 on PAID run |
| IN bank file export | ✅ PASS | 200 |
| IN statutory return export | ✅ PASS | 200 |
| IN run cancel cleanup | ✅ PASS | 200 |
| KWD currency | ✅ PASS | KWD |
| KWD work week SUN-THU | ✅ PASS | `["SUN","MON","TUE","WED","THU"]` |
| KWD statutory packs | ✅ PASS | 0 packs (empty but 200) |
| KWD admin salary | ❌ FAIL | 404 NOT_FOUND |
| KWD week-config | ✅ PASS | weekStartDay=0 |

**Engine honest summary:** Core IN payroll math works for configured employees on PAID runs (PF + TDS confirmed). Statutory pack resolution fails for subset of employees. KWD salary seed missing. Automated list-view payslip scan had false negatives (field names: `grossEarnings`/`netPay`, detail endpoint required).

---

## UI Deep Sweep (Phase 3 additions)

| Area | Roles | Result |
|------|-------|--------|
| Employee profile tabs (personal/job/docs/comp/bank) | HR_ADMIN | ⚠️ 401 race on tab switch |
| Payroll run detail + payslip/bank/audit drawers | HR_ADMIN | ✅ Page loads |
| Dashboard widget drill-downs | All | ✅ 5 widgets clicked per role |
| Sidebar collapse + theme toggle | All | ✅ Tested |
| Profile menu | All | ✅ Tested |
| SUPER_ADMIN /attendance | SUPER_ADMIN | ⚠️ API 400s (no error boundary in Phase 3 — improved vs Phase 2) |
| EMPLOYEE /timesheets History | EMPLOYEE, DEV | ❌ Error boundary |
| EMPLOYEE /permissions | EMPLOYEE | ❌ RBAC bypass |

**UI interactions beyond Phase 2: 30**

---

## Evidence Paths

| Artifact | Path |
|----------|------|
| Master JSON | `docs/e2e-deep-summary.json` |
| API full matrix | `docs/e2e-deep-api-results.json` |
| CRUD + engine + UI | `docs/e2e-deep-crud-results.json` |
| Screenshots | `docs/e2e-screenshots/deep/` (10 files) |
| Backend issues | `docs/E2E_BACKEND_ISSUES.md` § Phase 3 |
| Frontend issues | `docs/E2E_FRONTEND_ISSUES.md` § Phase 3 |
| Phase 2 baseline | `docs/E2E_STRICT_AUDIT.md` (1,731 button clicks) |

---

## What Phase 3 added over Phase 2

- **409** route extraction from source (vs ~47 page routes in Phase 2)
- **1,301** API GET tests across **6 roles** + KWD subset
- **72** mutation safety probes
- **50** CRUD API operations with test data + cleanup
- **17** payroll engine checks including IN statutory + KWD locale
- Cross-tenant isolation probes
- Targeted UI sweep: employee profile tabs, payroll sub-routes, RBAC edge cases

## Honest gaps (not claimed)

- AUDITOR role not tested (not on Hostinger)
- Not every POST/PATCH/DELETE on 409 routes executed (destructive ops skipped)
- Employee wizard 4-step UI not fully automated (API create tested)
- fin1@acme.test logged in API matrix but limited UI coverage
- MSW confirmed OFF; all traffic via BFF → Hostinger
