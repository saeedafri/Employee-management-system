# E2E Phase 4 — Exhaustive Audit Master Report

> Generated: 2026-07-03T06:07:32.846Z  
> API: https://ems-api.saqibsaeed.cloud/api/v1  
> Frontend: http://localhost:3001 (MSW OFF)  
> Scripts: `npm run test:e2e:phase4`

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Tenants discovered (Hostinger SSH) | 4 |
| Statutory pack countries in DB | IN, AE, CA, SA, SG, VN |
| Roles tested | 10 (incl. **AUDITOR** on qa-regression-org-001) |
| API gap re-tests | 3 |
| Payroll engine checks | 17 |
| Edge cases | 20 (17 pass / 3 fail) |
| UI button clicks (Phase 4 only) | 2629 |
| Phase 4 screenshots | 5225 |
| Phase 2 baseline clicks | 1,731 |
| Combined clicks (P2+P4) | 4360 |
| UI verdict tally | PASS 2359 / PARTIAL 264 / FAIL 6 |
| **testorg** | NOT ON HOSTINGER — login 401 |
| **AUDITOR** | TESTED — npjktdbh@guerrillamailblock.com @ qa-regression-org-001 |
| **Logout flow** | PASS (automated) |

---

## Final Verdict

**NOT READY FOR PRODUCTION**

### Confirmed P0 blockers

1. **P0** — `GET /audit-logs/export` → 500 INTERNAL_SERVER_ERROR (SUPER_ADMIN)

### Confirmed P1 blockers

1. **P1** — testorg tenant missing on Hostinger (test-key-123456789)
2. **P1** — SUPER_ADMIN attendance: 5× `NO_EMPLOYEE_RECORD` API 400s
3. **P1** — KWD tenant: no statutory pack; timesheets blocked (salary 404)
4. **P1** — UI FAIL on timesheets "Copy last week" (HR_ADMIN@acme) — API 5xx/403
5. **P1** — No draft payroll runs on Hostinger → calculate path untested live

---

## Tenant / Country Matrix

| tenantKey | Name | Country | Currency | Employees | Users |
|-----------|------|---------|----------|-----------|-------|
| acme-corp-001 | Acme Corp | India | INR | 75 | 13 |
| global-payroll-litmus-001 | Global Payroll Litmus Co | US | USD | 6 | 6 |
| kwd-litmus-001 | Kuwait Litmus Co | KW | KWD | 1 | 1 |
| qa-regression-org-001 | QA Regression Org | — | INR | 13 | 20 |

### Statutory Packs (Hostinger DB)

| Tenant | Country | Version |
|--------|---------|---------|
| acme-corp-001 | IN | 2026.1 |
| global-payroll-litmus-001 | AE | 2026.1 |
| global-payroll-litmus-001 | CA | 2026.1 |
| global-payroll-litmus-001 | SA | 2026.1 |
| global-payroll-litmus-001 | SG | 2026.1 |
| global-payroll-litmus-001 | VN | 2026.1 |
| qa-regression-org-001 | IN | PT_VERIFY_v1 |

### Country probe results

| Country | Tenant | Pack loads | Calculate | Notes |
|---------|--------|------------|-----------|-------|
| IN | acme-corp-001 | PASS | SKIP | no draft run |
| IN | qa-regression-org-001 | PASS | SKIP | no draft run |
| AE, CA, SA, SG, VN | global-payroll-litmus-001 | PASS (all 5) | SKIP | no draft runs |
| KW | kwd-litmus-001 | DATA_GAP | — | tenant exists, no pack |
| GB | — | DATA_GAP | — | not in DB |
| US | global-payroll-litmus-001 | DATA_GAP | — | tenant country=US but no US pack row |

---

## API Gap Re-tests

| Test | Endpoint | Status | Result | Detail |
|------|----------|--------|--------|--------|
| audit_logs_export |   | 500 | FAIL | INTERNAL_SERVER_ERROR |
| leave_create |   | 422 | PASS | VALIDATION_ERROR |
| pay_groups_create |   | 422 | PASS | VALIDATION_ERROR |

**Leave create 422 detail:** `reason` must be ≥10 chars; `pay_groups` requires `code` field — validation working as designed.

**Announcements:** create requires `category` field — PATCH/DELETE routes exist but no seed announcement; create blocked by 422 in probe.

---

## Payroll Engine Per Country

| Country | Tenant | Check | Result | Detail |
|---------|--------|-------|--------|--------|
| IN | acme-corp-001 | pack_load | PASS | 200 |
| IN | acme-corp-001 | draft_calculate | FAIL | no_draft_run |
| AE | global-payroll-litmus-001 | pack_load | PASS | 200 |
| AE | global-payroll-litmus-001 | draft_calculate | FAIL | no_draft_run |
| CA | global-payroll-litmus-001 | pack_load | PASS | 200 |
| CA | global-payroll-litmus-001 | draft_calculate | FAIL | no_draft_run |
| SA | global-payroll-litmus-001 | pack_load | PASS | 200 |
| SA | global-payroll-litmus-001 | draft_calculate | FAIL | no_draft_run |
| SG | global-payroll-litmus-001 | pack_load | PASS | 200 |
| SG | global-payroll-litmus-001 | draft_calculate | FAIL | no_draft_run |
| VN | global-payroll-litmus-001 | pack_load | PASS | 200 |
| VN | global-payroll-litmus-001 | draft_calculate | FAIL | no_draft_run |
| IN | qa-regression-org-001 | pack_load | PASS | 200 |
| IN | qa-regression-org-001 | draft_calculate | FAIL | no_draft_run |
| GB | N/A | pack_load | FAIL | DATA_GAP |
| US | N/A | pack_load | FAIL | DATA_GAP |
| KW | N/A | pack_load | FAIL | DATA_GAP |

---

## Edge Case Matrix (15 mandatory + extras)

| # | Case | Result | Detail |
|---|------|--------|--------|
| 1 | wrong_password_login | PASS | INVALID_CREDENTIALS |
| 2 | cross_tenant_token_mismatch | PASS | 401 INVALID_TOKEN |
| 3 | unauthenticated_deep_link | PASS | http://localhost:3001/login?next=%2Femployees%2Fcmqqf21fw00046adzo6h2a22w |
| 4 | invalid_uuid_url | PASS | api404=true errUi=true |
| 5 | browser_back_after_form | PASS | http://localhost:3001/dashboard |
| 6 | double_click_submit | PASS | loginPosts=1 |
| 7 | empty_required_form_submit | PASS | validationMarkers=3 |
| 8 | pagination_last_page | PASS | page=1 status=200 items=undefined |
| 9 | search_special_chars | PASS | ' OR 1=1--:200; 😀测试:200; üñîçødé:200; <script>aler:200 |
| 10 | role_forbidden_route | PASS | denied=true api403=false url=http://localhost:3001/permissions |
| 11 | super_admin_no_employee | FAIL | STILL_BROKEN:5 |
| 12 | session_refresh_persist | PASS | http://localhost:3001/dashboard |
| 13 | mobile_viewport_375 | PASS | dashboard_ok |
| 14 | large_table_scroll | PASS | scroll_ok |
| 15 | file_upload_ui | FAIL | NO_EMPLOYEE_OR_LOGIN |
| 16 | logout_flow | PASS | clicked=true onLogin=true logoutApi=true |
| 17 | logout_relogin | PASS | ok |
| 18 | testorg_tenant_login | FAIL | INVALID_CREDENTIALS |
| 19 | auditor_role_login | PASS | AUDITOR_OK |
| 20 | auditor_auth_me | PASS | status=200 |

---

## UI Button Sweep

| Verdict | Count | Notes |
|---------|-------|-------|
| PASS | 2359 | Navigation/modal OK |
| PARTIAL | 264 | Benign 4xx or console noise — see JSON |
| FAIL | 6 | Error boundary or 5xx |

**Gap modules swept:** recruitment (51 btn/page HR), performance, reports tabs, payroll/global, settings all sub-pages, employee wizard, audit-log, assets, announcements.

**Phase 2 PARTIAL re-classification:** 264 PARTIAL in Phase 4 — on critical paths (timesheets, payroll, permissions), only 118 remain PARTIAL; employee-row clicks by MANAGER re-classified as expected navigation (not P0).

**Hard FAIL buttons (6):** /attendance "Switch to dark mode" @SUPER_ADMIN@acme; /timesheets "Copy last week" @SUPER_ADMIN@acme; /timesheets "History" @EMPLOYEE@acme; /timesheets "History" @EMPLOYEE_DEV@acme; /timesheets "History" @EMPLOYEE_FIN@acme; /timesheets "History" @EMPLOYEE_ONLEAVE@acme

---

## NOT Tested (explicit)

| Item | Reason |
|------|--------|
| test-key-123456789 | Tenant absent from Hostinger Postgres |
| /resignations UI | No route in ems-frontend |
| GB / US payroll | No StatutoryPack rows |
| KW statutory | kwd-litmus-001 has no pack |
| Concurrent tabs | Not automated |
| Expired JWT injection | Not automated |
| acme AUDITOR | Only on qa-regression-org-001 |
| Payroll draft calculate | No DRAFT runs in DB at audit time |
| Announcements PATCH/DELETE | Create blocked by missing category field |

---

## Artifacts

- `docs/e2e-phase4-summary.json`
- `docs/e2e-phase4-edge-results.json`
- `docs/e2e-phase4-ui-results.json`
- `docs/e2e-screenshots/phase4/` (5225 PNGs)
- `scripts/phase4E2EAudit.mjs`, `phase4EdgeCases.mjs`, `phase4ExhaustiveUI.mjs`
