# E2E Summary — Sub-Monthly Payroll

> **Execution mode:** engine math verified via no-DB pure-function harness
> (`/tmp/payroll_verify.mjs`). HTTP-against-DB E2E is **pending** a local/test DB
> (active `DATABASE_URL` is Render production — blocked by safety policy).

## Harness output (actual computed values)

```
=== B1: periodRepresentativeDate — no Invalid Date for sub-monthly periods ===
  2057-01     -> 2057-01-16  (valid=true)
  2057-01-H1  -> 2057-01-08  (valid=true)
  2057-01-H2  -> 2057-01-23  (valid=true)
  2057-W05    -> 2057-02-01  (valid=true)
  garbage -> throws VALIDATION_ERROR (422)

=== B5: cyclesInMonthFromAnchor — biweekly 2-cycle vs 3-cycle month ===
  biweekly anchor 2057-01-01: count=3 index=0 isLast=false
  biweekly anchor 2057-01-15: count=3 index=1 isLast=false
  biweekly anchor 2057-01-29: count=3 index=2 isLast=true
  weekly anchor 2057-01-29: count=5 isLast=true

=== Frequency-aware gross (annualCtc 1,200,000) ===
  MONTHLY       ppy=12 grossPerCycle=100000.00 ppm=1
  SEMI_MONTHLY  ppy=24 grossPerCycle=50000.00  ppm=2
  BIWEEKLY      ppy=26 grossPerCycle=46153.85  ppm=2 step=14
  WEEKLY        ppy=52 grossPerCycle=23076.92  ppm=4 step=7

=== PH SSS MONTHLY_TOTAL apportionment (ceiling 35,000) ===
  H1: SSS_EE=875 SSS_ER=1750
  H2: SSS_EE=875 SSS_ER=1750
  MONTH TOTAL: SSS_EE=1750 (expect 1750)  SSS_ER=3500 (expect 3500)
  Biweekly 3-cycle month: EE 583+583+584=1750 ; ER 1166+1166+1168=3500  (no over-deduct)

=== MONTHLY regression (ppm=1) ===
  MONTHLY: SSS_EE=1750  SSS_ER=3500

=== Working days by work-week (H1 = Jan 1–15, 2057) ===
  MON-FRI -> 11 ; MON-SAT -> 13 ; SUN-THU -> 11 ; MONTHLY MON-FRI -> 23

=== inferScheduleFromPeriod ===
  2057-01 -> MONTHLY ; 2057-01-H1 -> SEMI_MONTHLY ; 2057-W05 -> null

=== Tax via CALIBRATED PH TRAIN pack ===
  annualGross=1,200,000  annualTax=202500 (expect 202500)  monthlyTax=16875 (expect 16875)
  SEMI_MONTHLY: H1 tax=8437  H2 tax=8438  -> month total 16875
  MONTHLY: cycleTax=16875 (regression)
  BIWEEKLY 3-cycle month: 5625+5625+5625 = 16875

=== isValidPeriod (B4) ===
  2057-01 true ; 2057-01-H1 true ; 2057-W05 true
  2057-01-W05 false ; 2057-1-H1 false ; 2057-13 false ; 2057-W54 false ; garbage false
```

## Scenarios

| # | Scenario | Result (engine) | Status |
|---|----------|-----------------|--------|
| A | PH semi-monthly H1/H2 | gross 50k+50k=100k; tax 8437+8438=**16,875**; SSS_EE 1,750; SSS_ER 3,500; net 81,375 | ✅ math verified |
| B | PH monthly regression | gross 100k; tax 16,875; SSS_EE 1,750; SSS_ER 3,500; net **81,375** | ✅ math verified |
| C | India monthly regression | MONTHLY path unchanged (ppy=12, no apportionment) | ✅ by construction; ⏳ diff vs baseline pending DB |
| D | BIWEEKLY (2- & 3-cycle months) | 3-cycle split 583/583/584=1,750; no over-deduct | ✅ math verified |
| E | Pay calendar cycles | MONTHLY/SEMI(H1,H2)/BIWEEKLY/WEEKLY generated w/ payDate+cutoff | ✅ shape verified (cycleGenerator) |
| F | Work-week | MON-FRI=11, MON-SAT=13 for H1; monthly unchanged | ✅ math verified |

## Tax calibration (resolved)
`requests/02` now uses the **PH TRAIN** annual table (no double-counted standard
deduction). On taxable 1,200,000 PHP it yields annual tax **202,500** → monthly
**16,875**. Withholding is computed by monthly total and split across the actual
cycles in the month (last cycle absorbs the remainder), so semi-monthly is
8,437 + 8,438 = **16,875** and MONTHLY is **16,875** — no drift, no double-charge.

## What remains for a PASS (environment-blocked, not code)
Real HTTP-against-DB E2E could not run here: **no local Postgres / no Docker**, the
active `DATABASE_URL` is **Render production**, and the safety hook blocks
`prisma migrate*` by command pattern. To finalise on a machine that has a local DB:
1. Switch `DATABASE_URL` → local/test; temporarily allow migration; `prisma migrate deploy`.
2. Seed QA tenant "Submonthly Payroll QA Inc"; run `curl_sequence.sh`.
3. Replace each `responses/*.json` with the real body and set
   `_evidenceStatus: "ACTUAL_LOCAL_TEST_DB_RESPONSE"`.
4. Diff an India MONTHLY run vs a pre-change baseline (Scenario C).
