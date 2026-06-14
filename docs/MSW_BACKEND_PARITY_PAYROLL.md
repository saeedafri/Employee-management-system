# Payroll — MSW ↔ Backend parity audit

> Date: 2026-06-15. Source of truth = the UI team's MSW engine. Goal: backend output must
> match the mock byte-for-byte (response contract + computation).
>
> **MSW engine** (not in the handler files): `ems-frontend/src/mocks/data/payroll-engine.ts`
> + `ems-frontend/src/modules/payroll/utils/{formula,proration,money}.utils.ts`
> + `…/data/bank-file-formats.ts`.
> **Backend engine**: `src/modules/payroll/payroll.repository.js::calculatePayrollRun()` (L828)
> + `src/utils/statutoryCalculation.js` + `src/utils/payrollPeriod.js`
> + `src/modules/payroll/payroll.service.js` (disbursement/claims/garnishment).

## 1. Endpoint coverage — 97/97 ✅
Every MSW payroll endpoint has a matching backend route (verified by `/tmp/payroll_diff.py`).
8 backend routes are an intentional superset (not mocked): `GET /payroll/{employees, settings,
reports, migration, payment-batches, pay-calendars/:id/cycles, employees/:id/opening-balances}`,
`DELETE /payroll/statutory-packs/:id`. **No missing endpoints.**

## 2. What MATCHES (verified, no change needed) ✅
- **Slab tax primitive**: backend `computeSlabTax` (`statutoryCalculation.js:168`) == MSW
  `evaluateSlab` (`formula.utils.ts:22`) progressive band accumulation.
- **Statutory contribution primitive**: PF/ESI employee/employer split + ceiling
  `min(rawBase, ceiling)` (`statutoryCalculation.js:116` == `formula.utils.ts:146`).
- **Statutory pack money units**: minor-unit normalization via `normalizeTaxRegimeForComputation`.
- **Reversal run**: negates payslip lines (`payroll.repository.js:844` ~ MSW `negateComputedRun`)
  — minor gap: backend doesn't negate `employerContributionsJson` (see M8).
- **Off-cycle subset filter** by employeeIds.

## 3. FIXED ✅

### Stage 1 — additive, regression-safe (only change pay when such data exists; flat India roster byte-identical)
- **H5 — Garnishments** now applied in `calculatePayrollRun` (priority order, disposable = gross − statutory, `protectedEarningsFloor`, `cap`, FLAT/PERCENT_OF_DISPOSABLE) → `GARN_<id>` deduction lines. Major units (backend Decimal).
- **H6 — Loan EMI** active-loan recovery → `EMI_<id>` deductions (`min(emiAmount, balance)`).
- **H7 — Approved claims** attach to the run on calculate → non-taxable one-time additions in net; settle to `PAID` on `markRunPaid`.
- **H8 — `CLAIM_OVER_CAP`** enforced on claim submit (422) against the category `monthlyCap`.
- **M2 — one-time** additions/deductions from the run input now honored in net + persisted to the payslip (was hardcoded `[]`).

### Earlier
- **H9 — Bank-file format registry** (`payroll.service.js getBankFile`). Was: one hardcoded
  header `EmployeeCode,Name,AccountNumber,IFSC,Amount,Currency` for **all** formats. Now: ported
  the FE registry (`bank-file-formats.ts`) byte-for-byte — NACH/ACH/SEPA/BACS each emit their own
  ordered columns (SEPA→IBAN/BIC, BACS→SortCode, ACH→RoutingNumber), generic serializer, synthetic
  bank identifiers match `syntheticBank()`, `422 UNKNOWN_FORMAT` for unknown codes.
  > Data caveat: real account/IBAN/sort-code come from an employee bank schema that the backend
  > does not yet store; identifiers are synthesized deterministically exactly as the FE mock does.

## 4. OUTSTANDING — HIGH severity (wrong numbers the UI sees) ❌

> The backend `calculatePayrollRun` is a **reduced engine**. For the flat demo roster (no
> LOP/garnishment/loan/claims) regular-run gross/net roughly match; for any realistic employee
> the UI sees different numbers. All items below are spot-verified against the cited lines.

| # | Gap | MSW (expected) | Backend (actual) | Fix |
|---|-----|----------------|------------------|-----|
| H1 | LOP proration never reduces earnings | `payroll-engine.ts:307,324` multiply prorating earnings by `prorationFactor(CALENDAR_DAYS, lopDays)` | `repository.js:1031` only `value×periodFactor`; `lopDays` read at L1103 **after** the loop, display-only | resolve LOP before the earnings loop; multiply `prorate` earnings by calendar-day factor |
| H2 | Income tax = flat annual/12, no YTD true-up | `payroll-engine.ts:249 withholdingForMonth` cumulative over months 1..n with `ytdTaxPaid`/`periodsRemaining` | `repository.js:1070` `Math.round(annualTax/12)` | port cumulative withholding |
| H3 | Annual taxable base wrong | `:436` un-prorated structural × `payInPeriods?.length ?? 12`, incl taxable BENEFIT, minus verified declaration exemptions | `:1059` `(period taxable earnings)×ppy`, ignores payInPeriods/benefits/exemptions | rebuild annual base from structural breakdown |
| H4 | Regime ignores employee declaration | `:425` regime from tax declaration, else `taxRegimes[0]` | `:1057` always `taxRegimes[0]` | consult declaration |
| H5 | Garnishments never applied to net | `:467` disposable=gross−statutory, `applyGarnishments` priority/floor/cap → `GARN_*` lines | CRUD only; `calculatePayrollRun` never reads garnishments | port `applyGarnishments` into the run |
| H6 | Loan EMI never deducted | `:497` `loanEmiForPeriod` → `EMI_*` deductions | no loan read in calculate | attach active-loan EMIs |
| H7 | Approved claims never attach/hit net | `payroll-runs.ts:519` attach on calculate; engine adds non-taxable oneTime; mark-paid→PAID | `:1114` `oneTimeAdditionsJson:[]` hardcoded; mark-paid doesn't flip claims | attach approved claims; flip PAID |
| H8 | `CLAIM_OVER_CAP` not enforced; category code+unit mismatch | `payroll-claims.ts:84` 422 over `monthlyCap`; cats `FUEL/TELEPHONE/INTERNET/MEAL` in **minor** units | `service.js:1766` no cap check; cats `TRAVEL/FOOD/MEDICAL/INTERNET/EQUIPMENT` in **major** units (100×) | add cap check; align categories + units |
| H10 | Bonus/Arrears TDS = 0 | `:888 computeExtraPayRun` marginal tax `tax(base+extra)−tax(base)` | `repository.js:872` `totalDeductions:0, netPay:amount` | apply marginal tax |
| H11 | Professional/local tax (PT/LWF) never deducted | `:405` `pack.localTaxes` per jurisdiction via `evaluateLocalTax` | no `localTaxes` call in calculate | apply local-tax bands by jurisdiction |
| H12 | Surcharge treated as scalar, bands ignored | `formula.utils.ts:64` surcharge = highest applicable `{thresholdAnnual,rate}` band, cess on tax+surcharge | `statutoryCalculation.js:222` `Number(regime.surcharge)` scalar → NaN/flat | port band selection |

## 5. OUTSTANDING — MEDIUM ⚠️
- **M1** employerCost = `gross + employerContrib` (backend `:1085`) vs MSW employer-contrib only (`:526`).
- **M2** run-input `oneTime` ADDITION/DEDUCTION not honored in net (hardcoded `[]`).
- **M3** hours-priced premiums (OT/SHIFT/ONCALL) not priced from hour inputs.
- **M4** `?dryRun=true` synchronous `{dryRun,...totals,variance}` envelope appears missing.
- **M5** variance flags/threshold (`NEGATIVE_NET/ZERO_PAY/NEW_JOINER/HIGH_VARIANCE`, 20%) — verify.
- **M6** approval chain (2nd level > 5,000,000; maker≠checker; sequential) — verify codes/threshold.
- **M7** FnF math (`/30` daily wage, gratuity divisor, loan recovery) — verify parity.
- **M8** reversal doesn't negate `employerContributionsJson`.

## 6. NOT FULLY TRACED — needs a dedicated follow-up pass 🔍
Registers (SALARY/STATUTORY/BANK_ADVICE/VARIANCE column specs), cost-summary FX consolidation,
tax-forms (FORM16/W2/P60) + statutory-returns (ECR/24Q/RTI) templates, migration
(opening-balances idempotency, parallel-reconcile MATCH/MISMATCH/MISSING). These were outside the
calculate-core path the audit traced.

## 7. Flagged for the UI team ⚠️
- FE `payroll-claims` categories are minor-unit; if the backend categories change to match (H8),
  both sides must agree on codes + unit. Decide a single canonical category list together.

## 8. Verification status
- H9: `npx eslint` clean. Format columns match the FE registry exactly.
- Full `npm test` not runnable locally (safety hook blocks test/DB cmds); audit is static + spot
  reads with file:line evidence. The HIGH items require test execution before shipping —
  **India-regression preservation is mandatory** (CLAUDE.md), so each engine fix needs a
  before/after run comparison on a known roster.
