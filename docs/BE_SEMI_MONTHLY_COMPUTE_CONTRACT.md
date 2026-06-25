# Backend Contract — Semi-monthly payroll compute: earnings proration + statutory wage-base

> **Status: ✅ DONE — 2026-06-25.** Both 🔴 bugs fixed and live-verified on
> `https://ems-api.saqibsaeed.cloud/api/v1` (Priya Sharma, CTC 900k). For 2026-09:
> MONTHLY gross 71,600 / PF 1,800 / PF_ER 1,800; H1 gross 35,800 / PF 900; H2 same;
> **H1 + H2 == MONTHLY line-for-line (earnings, PF, PF_ER, net).**
>
> **Bug A root cause + fix:** the compute used the pay GROUP's schedule for proration
> (`empPaySchedule = payGroup.paySchedule ?? run.paySchedule`), so a SEMI_MONTHLY run on a
> MONTHLY group got `periodFactor=1`/`ppm=1` → full-month pay. Now the RUN's schedule wins
> (`run.paySchedule ?? payGroup.paySchedule`) — byte-identical for true MONTHLY runs.
> (`payroll.repository.js`.)
>
> **Bug B root cause + fix:** no component carried `statutoryTag` so the `IN_EPF` wage base
> (`PF_WAGE`) summed to 0 and PF silently vanished. Fixes: (1) **data** — tagged `BASIC`
> `statutoryTag=PF_WAGE` (live via `PATCH /payroll/components/:id` + `prisma/seed.js`);
> (2) **apportionment** — set `IN_EPF.apportionmentMode='MONTHLY_TOTAL'` so PF apportions per
> cycle (H1+H2==MONTHLY); no-op for MONTHLY (ppm=1); (3) **guardrail** — `computeStatutoryContributions`
> now returns a `STATUTORY_WAGE_BASE_EMPTY` warning (surfaced on the run) instead of a silent 0.
> Tests: `tests/payroll-statutory-wagebase.test.js` (3/3).
>
> **Note for FE:** the contract's §7 seed anchor (`seedPayrollPhase3.js`) was inaccurate — that
> file seeds reimbursements/garnishments, not the IN pack/components. The pack + BASIC live in
> `prisma/seed.js` (fixed) and a few other seed scripts.
>
> **Owner of this doc:** Frontend (EMS). **Implementer:** Backend. The frontend was not changed.

---

## 1. TL;DR — two fixes

1. **🔴 Sub-monthly runs do not prorate earnings.** A semi-monthly **H1** (1–15) payslip
   pays the **full month's** gross — identical to a MONTHLY run. Running H1 **and** H2 pays
   the employee **~2× salary**. Earnings must be prorated to the cycle.
2. **🔴 Statutory contributions resolve a zero wage base → PF/PF_ER never appear.** The
   contribution-scheme engine sums only earnings whose `component.statutoryTag` equals the
   scheme's `wageBaseTag` (`PF_WAGE`). **No seeded component carries that tag**, so the base
   is 0 and PF silently computes to 0 — monthly and semi-monthly, entity-linked or not.

Both reproduce on the seeded acme/India data; no exotic config required.

---

## 2. Exact reproduction (live, deployed API)

As `superadmin@acme.test`:

1. Ensure an employee has a salary on an INR pay group bound to the IN pack (Priya already
   does: CTC 900,000; BASIC 50,000; group "Standard Pay Group"; pack has scheme `IN_EPF`,
   `wageBaseTag: PF_WAGE`, employee 12% → `PF`, employer 12% → `PF_ER`).
2. Create a `SEMI_MONTHLY` pay calendar (note: **`code` is required** — the FE type omits it,
   tracked separately) and read its July cycles → `2026-07-H1` (1–15) / `2026-07-H2` (16–31).
3. `POST /payroll/runs` for `period:"2026-07-H1"` (paySchedule `SEMI_MONTHLY`, the cycle
   dates), `calculate`, then `GET /payroll/runs/:id/payslips/:id`.
4. Repeat with `period:"2026-07"` (MONTHLY).

**Observed — both runs, Priya's payslip is byte-identical:**

```jsonc
// SEMI_MONTHLY H1 (workingDays 11)  AND  MONTHLY (workingDays 23) — SAME:
gross 71600,  net 66048
earnings:    BASIC 50000 · HRA 20000 · CONVEYANCE 1600        // full month, NOT halved for H1
deductions:  TDS 5000 · WITHHOLDING_TAX 542 · GARN_… 10        // no PF
employerContributions: []                                      // no PF_ER
```

---

## 3. Bug A — sub-monthly runs must prorate earnings 🔴

### Gap

For `period: 2026-07-H1` the earnings lines are the **full monthly** component amounts
(BASIC 50,000, etc.), so H1 gross (71,600) equals the MONTHLY gross (71,600) even though H1
is half the month (11 of 23 working days). Paying both H1 + H2 therefore disburses ~2× the
monthly salary. The statutory engine **already** scales by periods-per-month
(`statutoryCalculation.js:105`, `monthlyEstimatedBase = rawBase * ppm`), but the **earnings
builder does not apply the complementary per-cycle factor**.

### What to build

In the run-compute path (the async calculate worker — `src/lib/payrollQueue.js` /
`src/modules/payroll/payroll.service.js`), when the run's schedule is sub-monthly, multiply
each **FLAT / PERCENTAGE earning** (and any non-statutory flat deduction that represents a
monthly figure) by a **cycle proration factor** before emitting the payslip line:

- The cycle's day span is already available — `payrollPeriod.js`
  `derivePeriodDates(run)` / `derivePeriodDatesFromString(period)` give `startDate`/`endDate`
  for `H1`/`H2`.
- Factor options (pick one, document it, keep it config-driven — see the pack's
  `proration.basis`, currently `CALENDAR_DAYS`):
  - `CALENDAR_DAYS`: `cycleDays / daysInMonth`
  - `WORKING_DAYS`: `cycleWorkingDays / monthWorkingDays`
  - simple split: `1 / periodsPerMonth` (2 for semi-monthly)
- Apply the **same** factor used to bring statutory back down per cycle, so
  `H1 + H2 == one MONTHLY run` for every line (earnings, deductions, employer cost, net).

> Do **not** hardcode the factor or the period count per country — derive both from the pay
> calendar / period (§ "configuration over code", CLAUDE.md §26).

### Acceptance (Bug A)

| Period | Expected |
|---|---|
| `2026-07` MONTHLY | gross = full month (e.g. 71,600) |
| `2026-07-H1` SEMI_MONTHLY | gross ≈ half (e.g. ~34,300 for an 11/23 or 15/31 factor) |
| `2026-07-H1` + `2026-07-H2` summed | **equals** the MONTHLY run, line-for-line |

---

## 4. Bug B — statutory wage base resolves to 0 → PF/PF_ER missing 🔴

### Gap (root cause pinned)

`computeStatutoryContributions` (`src/utils/statutoryCalculation.js:81`) resolves each
scheme's wage base as:

```js
const wageBaseTag = scheme?.wageBaseTag;          // "PF_WAGE"
if (!wageBaseTag) continue;
const rawBase = earnings
  .filter((e) => componentByCode.get(e.code)?.statutoryTag === wageBaseTag)  // L92–94
  .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
```

So the base = sum of earnings whose **`component.statutoryTag === scheme.wageBaseTag`**.
Live, **no pay-group component carries any `statutoryTag`** (all null — verified via
`GET /payroll/components`), while the IN pack's `IN_EPF` scheme expects `PF_WAGE`. Result:
`rawBase = 0` → PF = 0 → the line is dropped, **and there is no warning**. The employer
`PF_ER` contribution is likewise absent. This is a **seed/config inconsistency the backend
ships**: the pack demands a tag the seeded components never set.

### What to build

1. **Fix the seed** (`prisma/seedPayrollPhase3.js`): tag the wage-base earning(s) so the IN
   pack actually computes — e.g. `BASIC.statutoryTag = "PF_WAGE"` (whatever the IN_EPF wage
   definition is; Indian EPF wage = Basic + DA). Ship every pack's schemes with at least one
   correspondingly-tagged component, or the contribution is dead on arrival.
2. **Surface the silent zero** (engine guardrail, not a hardcode): when a scheme has a
   `wageBaseTag` but **no component matches it** (base resolves to 0 from an empty filter),
   push a **run warning** (e.g. `STATUTORY_WAGE_BASE_EMPTY: scheme IN_EPF found no component
   tagged PF_WAGE`). A contribution that should exist silently vanishing is the dangerous
   failure mode — make it visible in the run's warnings.
3. **Confirm the apportionment** once the base is non-zero: the existing `* ppm` monthly
   scaling + ceiling (`L105–124`) should then yield the correct per-cycle PF (≈ half of the
   monthly PF for H1). Re-check that `H1 + H2 == MONTHLY` for PF/PF_ER too (ties into Bug A).

### Acceptance (Bug B)

| Setup | Expected |
|---|---|
| MONTHLY run, BASIC tagged `PF_WAGE` | `PF` (employee) line present = 12% × wage base (capped at ceiling); `PF_ER` present in employerContributions |
| SEMI_MONTHLY H1 | `PF` ≈ half the monthly PF; `H1 + H2` PF total = MONTHLY PF |
| A scheme whose `wageBaseTag` matches no component | run completes **with a warning**, not a silent 0 |

---

## 5. Also observed (confirm — not in the two-bug scope)

- **Run employee-scoping is ignored.** `POST /payroll/runs` with `includeAllActiveEmployees:
  false` + `employeeIds:[<one>]` still computed **all** active employees. Either honor the
  subset or document that the field is advisory.
- **Components present on the salary are dropped from the run.** `MEDICAL` (earning) and the
  group's own `PF` 12% deduction appear in `salary.calculatedComponents` but **not** in the
  run payslip lines. Confirm whether this is intended (e.g. reimbursements excluded) or a
  second drop bug.

These are flagged for triage; this contract's acceptance gate is Bugs A + B only.

---

## 6. Out of scope / do NOT change

- The frontend. It sends `legalEntityId` + `currency` (verified live via Playwright wire
  capture) and renders payslip lines dynamically (no `TDS`-only assumption).
- The tax-regime engine — `WITHHOLDING_TAX` computes correctly; leave it.
- Response shapes for `/payroll/runs`, `/payslips` — only the **computed amounts** change.
- Do not hardcode any country's proration factor, period count, wage base, or rate (§26
  "configuration over code"). Everything stays pack/calendar-driven.

---

## 7. File anchors (deployed `upstream/main`)

- `src/utils/statutoryCalculation.js` — `computeStatutoryContributions` L81; **wage-base
  filter L89–94** (the Bug B root cause); monthly scaling + ceiling L105–124.
- `src/utils/payrollPeriod.js` — `parsePeriod` / `derivePeriodDatesFromString` L64,
  `RE_SEMI_MONTHLY` L10 (cycle dates available for the Bug A factor).
- `src/modules/payroll/payroll.service.js` + `src/lib/payrollQueue.js` — the run-compute /
  async calculate path where earnings lines are built (apply the Bug A factor here).
- `prisma/seedPayrollPhase3.js` — seeds the IN pack (`IN_EPF` / `PF_WAGE`) and "Standard Pay
  Group" components (which lack the matching `statutoryTag`) — fix the seed for Bug B.
- Existing tests to extend: `tests/payroll-subMonthly.test.js`,
  `tests/payroll-workingDays.test.js`.

---

## 8. Net

A semi-monthly payroll today pays **double** (earnings not prorated) and **omits statutory
PF/PF_ER** (wage base resolves to 0). Fix the earnings proration (Bug A) and the
statutoryTag/wage-base resolution + seed (Bug B); the gate is that **`H1 + H2 == one MONTHLY
run`, line-for-line, with PF/PF_ER present**.
