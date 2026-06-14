# Payroll Sub-Monthly — DEFECT REPORT & FIX CONTRACT (Backend)

> **Audience:** backend team (separate repo).
> **Status:** defect report against a feature marked `PASS_RENDER_E2E_VERIFIED`. The
> capability shipped; **end-to-end correctness on a normally-configured tenant did not.**
> **Supersedes for verification purposes:** the acceptance section of
> `SUBMONTHLY_PAYROLL_BACKEND_CONTRACT.md` (that feature spec is "built"; this is "it pays
> the wrong amount").
> **Found via:** live black-box E2E against the production API, **2026-06-14**, tenant
> `acme` (`superadmin@acme.test`), a real Philippines payroll built from scratch through
> the public API. All test runs were cancelled afterward; no existing data was mutated.

---

## 0. TL;DR

Sub-monthly (semi-monthly / bi-weekly) payroll **pays a full month in every cycle**. A
semi-monthly Philippines employee on ₱100,000/month is paid **₱200,000** across H1+H2, with
income tax and statutory contributions **doubled**. The prior QA pass passed because it was
run on a dedicated single-country tenant with a specific salary setup; on a normal
multi-country tenant driven through the documented API, the numbers are wrong.

Three defects, in priority order:

| #   | Defect                                                                                  | Severity     | Effect                                                      |
| --- | --------------------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------- |
| 1   | Per-cycle **base pay** is not prorated                                                  | **Critical** | Each cycle pays the full monthly earning → **overpay**      |
| 2   | Monthly-capped **statutory** silently doubles unless the salary carries `legalEntityId` | **Critical** | SSS/PF/etc. billed once per cycle instead of once per month |
| 3   | India `PF_ER`/`ESI_ER` employer lines **leak** onto non-India payslips                  | Medium       | Wrong/confusing line items on global payslips               |

Plus two minor API-contract issues (§5).

---

## 1. Environment & method

- **API:** production, `/api/v1`. Auth: cookie-based, `superadmin@acme.test`.
- **Config built via public API** (proving a tenant can reach this state normally):
  - Statutory pack `PH / QA-LITMUS-0614`: PH TRAIN tax (`taxCode WITHHOLDING_TAX`), SSS
    `wageBaseTag SSS_WAGE_BASE`, `wageCeiling 3500000` (minor), EE 5% → `SSS_EE`,
    ER 10% → `SSS_ER`, **`apportionmentMode: "MONTHLY_TOTAL"`** (accepted + echoed),
    `rounding {mode:NEAREST,precision:0}`, `proration {basis:WORKING_DAYS}`.
  - Legal entity: `PH`, `PHP`, `fiscalYearStartMonth 1`, `workWeekPattern MON-FRI`,
    `statutoryPackId` → the pack above.
  - Pay calendars: one `MONTHLY`, one `SEMI_MONTHLY`, both on that entity.
  - Pay groups: `QA PH Monthly` (MONTHLY, PHP) and `QA PH SemiMonthly` (SEMI_MONTHLY, PHP),
    each with one earning `BASIC_PH` = FLAT `100000` (major), `statutoryTag SSS_WAGE_BASE`.
  - Employee on `annualCtc 1200000` (→ ₱100,000/month), salary `country PH`.

**Control (monthly) — CORRECT.** The same employee on the monthly group, run `2029-07`:

```
gross 100000 | deductions SSS_EE 1750, WITHHOLDING_TAX 16875 | employer SSS_ER 3500
net 81375 | currency PHP | ytd.fiscalYear 2029 | workingDays 22 | no PF/ESI/TDS
```

This matches your own evidence exactly. Multi-country worked too: a single run produced
INR, PHP and ZAR payslips side-by-side. **Monthly multi-country is solid — do not touch it.**

---

## 2. Bug 1 — per-cycle base pay is not prorated (CRITICAL)

### Reproduction

Semi-monthly group, same employee (₱100,000/month), two cycles in Aug 2029:

```
POST /payroll/runs {period:"2029-08-H1", type:"REGULAR", payGroupIds:[<GS>],
                    paySchedule:"SEMI_MONTHLY", startDate:"2029-08-01", endDate:"2029-08-15", payDate:"2029-08-15"}
POST /payroll/runs/<id>/calculate
GET  /payroll/runs/<id>/payslips/<id>     → grossEarnings: 100000   ← should be ~50000
# identical for 2029-08-H2
```

### Observed vs expected (month = H1 + H2)

| Field           |      H1 |      H2 |   **Month** | Expected month |
| --------------- | ------: | ------: | ----------: | -------------: |
| grossEarnings   | 100,000 | 100,000 | **200,000** |        100,000 |
| WITHHOLDING_TAX |  21,771 |  21,771 |  **43,542** |        ~16,875 |

`workingDays` **was** cycle-correct (H1=11, H2=12) — so the engine knows the cycle, but it
does **not** apply the per-cycle base share. The earning (`BASIC_PH` = FLAT 100,000) is paid
in full every cycle; tax follows the inflated gross.

### Required fix

For sub-monthly runs, the per-cycle base earning must be the **per-cycle share** of the
monthly amount (monthly ÷ cycles-in-month, i.e. ÷2 semi-monthly, the appropriate split for
bi-weekly), then prorated by the cycle's working days — for **all** component
`calculationType`s, **including `FLAT`**. Today this works for whatever component type your
internal QA used but **not for `FLAT`**, which is the most common way HR defines pay.

- If the intended design is "sub-monthly requires CTC-derived components and `FLAT` is
  always paid in full," that must be **documented and validated** (reject/ warn on a `FLAT`
  earning in a sub-monthly group). Silent full-payment is an overpay defect.
- The split must be **data-driven** (periods-per-year from the pay calendar frequency), no
  `if (frequency)` branches. (Restates `SUBMONTHLY_PAYROLL_BACKEND_CONTRACT.md §2.3.)

---

## 3. Bug 2 — statutory apportionment silently doubles without `legalEntityId` (CRITICAL)

This is the subtle one. The **same run, same pack with `apportionmentMode: MONTHLY_TOTAL`**
behaves differently depending on whether the employee's salary carries a `legalEntityId`.

### Reproduction A — salary has NO `legalEntityId` (the state the current frontend produces)

```
SSS_EE: H1 1750 + H2 1750 = 3500   ← DOUBLED (monthly cap is 1750)
SSS_ER: H1 3500 + H2 3500 = 7000   ← DOUBLED (monthly 3500)
```

### Reproduction B — after `PATCH /payroll/employees/:id/salary {legalEntityId, currency:"PHP"}`

```
SSS_EE: H1 875  (→ 1750/month)  ← CORRECT, apportioned
SSS_ER: H1 1750 (→ 3500/month)  ← CORRECT
```

So `apportionmentMode` **works**, but only once the employee resolves to a legal entity (and
thus to a pay-calendar frequency / periods-per-year). When `legalEntityId` is null the engine
falls back to a per-cycle full charge and **double-bills statutory deductions** — silently.

### Required fix

Pick one, but **never silently double a capped statutory deduction**:

1. **Preferred:** resolve cycles-in-month / periods-per-year from the **run's pay
   group / pay calendar** (which already exist on the run) so apportionment is correct
   regardless of whether the salary carries `legalEntityId`; **or**
2. **Fail loud:** if the employee cannot be resolved to a pay calendar for a sub-monthly run,
   reject calculate with a clear error (e.g. `EMPLOYEE_NOT_RESOLVED_TO_CALENDAR`) instead of
   computing a doubled amount.

Frontend will start sending `legalEntityId` on the salary (we've made it required for
multi-frequency tenants) — but the engine should not depend on it to avoid double-charging.

---

## 4. Bug 3 — India employer-contribution lines leak onto non-India payslips (MEDIUM)

A South-Africa employee whose statutory pack defines **no** contribution schemes returns:

```
employerContributions: [ {code:"PF_ER", amount:0}, {code:"ESI_ER", amount:0} ]
```

`PF_ER` / `ESI_ER` are India codes. PH payslips (pack has SSS) correctly show only `SSS_ER`,
so the engine is injecting India employer lines as a **hardcoded default** when a pack
contributes nothing. The frontend renders `employerContributions[]` verbatim, so these India
lines will appear on a South-African payslip.

### Required fix

Employer contribution lines must come **only** from the resolved country pack's contribution
schemes. A pack with no schemes → **empty** `employerContributions` (not India defaults). No
`PF_ER`/`ESI_ER` literals anywhere outside the India pack.

---

## 5. Minor API-contract issues (please confirm / document)

1. **Pay-calendar cycles response shape.** `GET /payroll/pay-calendars/:id/cycles` returns
   `data: { payCalendarId, paySchedule, cycles: [...] }` (a **nested object**), but the UI
   handoff (`UI_CONTRACT.md §4.E`) documented a bare `data: [ ... ]` array. Please keep the
   live `data.cycles[]` shape and correct the handoff doc; the FE will unwrap `data.cycles`.
2. **`POST /payroll/pay-calendars` requires `code`.** The field isn't in the documented
   `PayCalendarInput`. Please document it (and any uniqueness rule).
3. **Statutory-pack create requires `rounding`/`proration` as objects** even though reads
   return `null`. Either accept `null` on write or document the object requirement.
4. **Salary `legalEntityId` + `currency` are accepted on write and returned** — good. Please
   confirm this is intended/stable; the FE will rely on it (§3, FE contract §4).
5. **Run scoping:** `payGroupIds` + `includeAllActiveEmployees:false` still computed **all**
   active workers, not just the named group's members. Confirm whether group-scoping is
   intended to filter the computed set.

---

## 6. Acceptance tests (the fix is done when ALL pass, live)

Semi-monthly PH employee, ₱100,000/month, cycles `2057-01-H1` / `2057-01-H2`, pack with
`apportionmentMode: MONTHLY_TOTAL`, **salary with AND without `legalEntityId`**:

- [ ] **Bug 1:** each cycle `grossEarnings ≈ 50,000` (per-cycle share + cycle proration), not
      100,000 — for a `FLAT` base component (or calculate is rejected with a documented
      reason if `FLAT` sub-monthly is unsupported).
- [ ] **Bug 1:** `WITHHOLDING_TAX` across H1+H2 sums to the correct **monthly** tax (~16,875),
      projected on a 24-period basis — not 2× the monthly figure.
- [ ] **Bug 2:** `SSS_EE` month total = **1,750** and `SSS_ER` = **3,500** — apportioned —
      **with `legalEntityId` null AND set** (no silent doubling), or calculate fails loud when
      unresolved.
- [ ] **Bug 3:** a ZA employee (pack, no contribution schemes) → `employerContributions: []`;
      **no `PF_ER`/`ESI_ER`** anywhere.
- [ ] **Bi-weekly (US), 26 periods:** monthly-capped contributions apportion so a calendar
      month's total matches the monthly cap (restates the original §2.5 trap).
- [ ] **Regression:** the **monthly** PH employee is byte-identical to today
      (gross 100,000 / SSS_EE 1,750 / tax 16,875 / net 81,375 / `PHP` / FY `2029`), and the
      monthly **India** employee is byte-identical to today.

## 7. Must-not-change

- Monthly payroll (any country) — identical to today; it is verified correct.
- Multi-country single-run behaviour (INR/PHP/ZAR side-by-side) — verified correct.
- No hardcoded country/frequency branches; periods-per-year, apportionment, and employer
  lines are all **data** from the resolved pack/calendar.
- `PAID` runs immutable; corrections via arrears/off-cycle.

---

## 8. RESOLUTION — 2026-06-14 (backend team)

**Verdict: FIXED.** Verified live against the Render DB (tenant `acme`, `superadmin@acme.test`) via
a black-box E2E that built PH/ZA/IN payroll from scratch through the public API as OFF_CYCLE runs
scoped to dedicated QA employees, plus a deterministic unit harness over the real engine utils. All
test runs were cancelled afterward; no existing data mutated. **17/17 live + 15/15 unit checks pass.**

### Fixes
- **Bug 1 (FLAT base not prorated) — FIXED.** `payroll.repository.js` calc loop: FLAT components are
  now paid as their per-cycle share, `amount = value × 12 / periodsPerYear` (`periodFactor`). MONTHLY
  ppy=12 → ×1 (byte-identical); SEMI_MONTHLY → ×½; BIWEEKLY → ×12/26; WEEKLY → ×12/52. PERCENTAGE/
  FORMULA were already per-cycle (basis `CTC = annualCtc/ppy`). Live: semi-monthly H1=H2=₱50,000
  (was ₱100,000); WITHHOLDING_TAX H1 8,437 + H2 8,438 = **16,875** (was 43,542).
- **Bug 2 (statutory doubling without `legalEntityId`) — FIXED/CONFIRMED.** Apportionment `ppm`
  resolves from the run's **pay group / pay calendar** frequency (BIWEEKLY/WEEKLY use the actual
  cycle-count-in-month from `startDate`), never from `legalEntityId`. Live: salary **with AND without**
  `legalEntityId` → SSS_EE month = **1,750**, SSS_ER = **3,500** (no double). Biweekly 3-cycle month
  honours the monthly cap (unit-proven).
- **Bug 3 (India `PF_ER`/`ESI_ER` leak) — FIXED.** Removed the `buildEmployerContributions()` India
  fallback in `fmtPayslipDetail`. Employer lines now come only from the resolved pack's contribution
  schemes; a pack with no schemes → `employerContributions: []`. Live: ZA employee → `[]`, no PF_ER/ESI_ER.

### §5 minor items (confirmed)
1. **Pay-calendar cycles shape:** live response is `data: { payCalendarId, paySchedule, cycles:[…] }`
   (nested) — kept as-is; clients unwrap `data.cycles`.
2. **`POST /payroll/pay-calendars` requires `code`** — confirmed; now documented in API_MAPPING/Swagger.
3. **Statutory-pack create requires `rounding`/`proration` objects** — confirmed; sent as objects.
4. **Salary `legalEntityId` + `currency`** accepted on write and returned — confirmed stable.
5. **Run scoping:** REGULAR runs compute **all** active salaries (`payGroupIds` is not a filter); only
   OFF_CYCLE/FNF filter by `employeeIds`. Confirmed intentional; documented.

### Bonus — payroll UI crash (the "backend issue" the UI team reported)
The entire payroll UI threw `RangeError: Invalid currency code : MULTI` (error boundary →
"Something went wrong"). Root cause: the backend's documented `currency: "MULTI"` sentinel on
multi-currency run **headers** was fed verbatim to `Intl.NumberFormat({style:'currency'})` by the
frontend. Fixed in the frontend money formatter (`isFormattableCurrency` guard + decimal fallback);
the backend sentinel is intentional and now documented. Payroll list + run-detail render again;
per-cycle ₱50,000 shows correctly in the UI.
