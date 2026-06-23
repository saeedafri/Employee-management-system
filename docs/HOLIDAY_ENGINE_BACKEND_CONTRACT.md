# Holiday Applicability Engine — Backend Ownership Contract & Acceptance Checklist

> **Audience:** backend team (separate repo).
> **Author:** frontend team.
> **Status:** **Request / acceptance criteria.** Defines what "the holiday-applicability
> engine exists server-side" means, so the frontend can consume the resolved result and
> retire its client-side engine (`resolveApplicableHolidays`).
> **Related:** [`HOLIDAYS_BACKEND_CONTRACT_GAP.md`](./HOLIDAYS_BACKEND_CONTRACT_GAP.md)
> (the structured-country gap that the H2 client workaround papered over) and
> [`HOLIDAYS_COMPETITIVE_ROADMAP.md`](./HOLIDAYS_COMPETITIVE_ROADMAP.md).

---

## 0. TL;DR — why this is a backend responsibility

The frontend's `resolveApplicableHolidays(holidays, country, opts)` was **scaffolding from
the MSW-first workflow** — it existed to *define the contract* and unblock the UI, not to be
the permanent system of record. Holiday applicability decides **leave chargeable days**,
**payroll working-day / LOP counts**, and **attendance classification** — all of which the
backend already computes. The component that owns the dependent math must own the input rule,
or they drift (calendar shows a holiday that payroll counted as a working day).

**"Country-filter-only" (`?countryCode=`, shipped in 7.3) is _partial_. It is not the engine.**
The engine also applies optional/restricted selections and observed-day shifting, and — most
importantly — is the **same** resolution that leave, payroll, and attendance consume.

This document is the acceptance bar. The frontend treats docs as a *claim* and verifies every
item against the **live API** (per our "verify live, not just docs" discipline).

---

## 1. The endpoint + wire contract

Confirm there is a **per-employee resolved** holiday endpoint (or that `GET /holidays`
resolves off the JWT's employee). Pin exactly:

- [ ] **Path + resolution subject** — e.g. `GET /me/holidays?year=YYYY` (resolves the JWT's
      own employee) and/or `GET /employees/:id/holidays?year=YYYY` (HR/admin viewing another
      employee). State which exists and the role rules for each.
- [ ] **Management vs employee view** — HR_ADMIN / SUPER_ADMIN must still be able to fetch the
      **unscoped, all-countries** list for the management screen (today's `GET /holidays`).
      Confirm both paths exist and which one each consumer should call.
- [ ] **Envelope + field casing** — exact success envelope and casing (camelCase expected for
      this domain), matching the documented `Holiday` shape.
- [ ] **Resolution metadata on each returned holiday** (load-bearing — the FE cannot render
      without it):
  - `holidayDate` = the **observed/effective** date the employee actually gets off.
  - `actualDate` (or equivalent) = the **original** date when shifted, so the UI can show
    "Observed Mon 6 Jan (falls Sat 4 Jan)".
  - `observed: boolean` (or a shift reason) — whether this row was shifted.
  - `isOptional: boolean` and `selected: boolean` — for the restricted/optional picker.
  - `countryCode` / source — which country (or tenant-wide) the row came from.

## 2. Rule-coverage checklist (the engine's actual responsibilities)

The server must apply **all** of the following, not just the country filter:

- [ ] **Country scoping** = the employee's legal-entity country **plus tenant-wide rows**
      (`location: null` / no country). Tenant-wide holidays apply to **every** country.
- [ ] **Optional / restricted selection** applied per employee, **and** the per-country
      **cap** enforced server-side (not just surfaced for the FE to enforce).
- [ ] **Observed-day / substitute-day shifting** computed against the employee's **work-week**
      (e.g. `SUN-THU`) and the country's observed-rule policy.
- [ ] **Effective-dated / versioned** holiday policy — config, not code (same model as the
      payroll statutory packs).

## 3. The consistency guarantee (the item that matters most)

- [ ] Holiday applicability is a **shared backend service** that **leave** (chargeable-day
      math), **payroll** (working-day / LOP), and **attendance** (day classification) all
      **call** — one code path, not re-derived per module.
- [ ] **Proof:** for the same employee + period, the holidays excluded by a **leave request
      preview**, counted by a **payroll run**, and shown on the **attendance calendar** are
      **identical**. If these can diverge, the engine is not done.

## 4. Config-over-code proof (truly global)

- [ ] A **never-seen country** (e.g. `BR`, `KE`) returns correct scoped holidays from
      **configuration only** — no code change, no deploy.
- [ ] Observed-day shifting works for a **non-Mon–Fri week** (e.g. KWD `SUN-THU`).
- [ ] No `if (country === '…')` branches in the holiday logic (litmus: could a tenant in a
      country we have never seen run correctly by entering configuration only?).

## 5. Live evidence required (not a Swagger entry)

Provide (or the FE will run) actual live responses demonstrating:

- [ ] **IN** employee and **US** employee → correct, disjoint country sets + shared
      tenant-wide rows.
- [ ] **KWD** (`SUN-THU`) employee whose holiday lands on a non-working day → the response
      carries the **shifted** observed date + the original `actualDate`.
- [ ] Employee with **no legal entity / unresolved country** → **tenant-wide only**
      (explicitly defined, not "all countries").
- [ ] **SUPER_ADMIN** (no employee profile) → defined behavior (all, or empty — but stated).
- [ ] The **same period** run through **leave preview** and a **payroll run** → holiday count
      **matches** the resolved calendar (the §3 proof, with numbers).

## 6. Edge / empty semantics (define each)

- [ ] Year with **no holidays** → shape returned (empty list + total 0).
- [ ] **Optional cap exceeded** → behavior (reject selection vs clamp) and error code.
- [ ] **Management (all-countries) view** for HR/SUPER_ADMIN → confirmed unscoped and editable.

---

## Definition of "engine confirmed on the backend"

Both must be true, verified with **live multi-country probes** (incl. a never-seen country):

1. A documented endpoint returns the **fully-resolved per-employee** holiday set **with
   observed/optional metadata** (§1–§2).
2. **Leave + payroll + attendance demonstrably consume that same resolution** server-side (§3).

Until both hold, the frontend keeps a **thin, explicitly non-authoritative** client mirror for
preview/UX only, and this document stays open.

## Frontend transition (once confirmed)

- FE consumers (`HolidayScreen` employee view, `UpcomingHolidaysCard`, `OptionalHolidayPicker`,
  and the attendance/timesheet/leave context hooks) switch to the resolved endpoint and
  **render what the server returns**.
- `resolveApplicableHolidays` is retired as an authority — kept, if at all, only as a labeled
  preview shim that mirrors this contract.
- The management `/holidays` screen continues to use the unscoped all-countries list.

## Sign-off

| # | Item | Backend confirms | Live-verified by FE |
|---|------|:---:|:---:|
| 1 | Resolved per-employee endpoint + metadata | ☐ | ☐ |
| 2 | Country + optional + observed + versioned rules | ☐ | ☐ |
| 3 | Shared resolution across leave/payroll/attendance | ☐ | ☐ |
| 4 | Config-over-code (never-seen country, SUN-THU) | ☐ | ☐ |
| 5 | Live multi-country evidence | ☐ | ☐ |
| 6 | Edge/empty semantics defined | ☐ | ☐ |
