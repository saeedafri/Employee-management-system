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

## ⚠️ Implementation status — 2026-06-23 (commit `24b27fb`, live on Hostinger) — NOT 100% COMPLETE

Verified item-by-item against source + the live API. **17 / 23 checklist items DONE; 3 genuine gaps + 3 live-evidence items blocked by gated seeding.** Per-item state is marked in the checklists below (`[x]` = verified done, `[ ]` = not yet). The contract's **Definition of done is NOT yet met** — part (2) (live multi-country proof + shared-consumption numeric proof) is incomplete.

**Engine core (DONE, verified):** shared resolver `src/modules/holidays/holidayResolver.service.js`; `GET /me/holidays` + `GET /employees/:id/holidays` (live 200, full metadata, camelCase); country scoping (live IN=15 / SUPER_ADMIN tenant-wide=12); optional + per-country cap (`LIMIT_REACHED` enforced); observed-day shift implemented (unit-tested); no country branches; shared service consumed by leave-preview + attendance + payslip `holidayBasis`; 8 pure unit tests green.

**OUTSTANDING (must close before this contract is "fully implemented"):**
1. **§2.4 — effective-dated / versioned holiday policy: NOT IMPLEMENTED.** `HolidayPolicy` has no `version`/`effectiveFrom`/`effectiveTo` (single row per tenant+country). Needs a schema migration (user-run) to match the StatutoryPack versioning model.
2. **§3.2 — numeric "identical across leave/payroll/attendance" proof: NOT FULLY VERIFIED.** One code path is shared, but (a) not demonstrated live with matching numbers across all three, and (b) the attendance **team grid** resolves tenant-wide (`employeeId:null`), which can diverge from per-employee resolution for a non-default-country employee.
3. **§5.1 / §5.2 / §5.5 — live multi-country evidence: BLOCKED (not done live).** US/KWD employees + a payroll run can't be created via API (no pay-group/salary-create endpoint; seeding gated). KWD SUN-THU shift + US-disjoint are proven by deterministic unit tests on the deployed code, NOT by a live probe.

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

- [x] **Path + resolution subject** — **DONE.** `GET /me/holidays?year=YYYY` (resolves JWT
      `employeeId`; any authenticated user) and `GET /employees/:id/holidays?year=YYYY`
      (HR_ADMIN/SUPER_ADMIN, or the employee themselves — 403 otherwise, 404 unknown). Live 200.
- [x] **Management vs employee view** — **DONE.** `GET /holidays` = unscoped all-countries
      management list (editable via POST/PATCH/DELETE); `GET /me/holidays` = resolved per-employee.
      Both live.
- [x] **Envelope + field casing** — **DONE.** `{ success, data, meta }`, camelCase
      (`holidayDate`, `actualDate`, `isOptional`, `countryCode`) — verified on live response.
- [x] **Resolution metadata on each returned holiday** — **DONE** (live row carries all of):
  - `holidayDate` = the **observed/effective** date the employee actually gets off.
  - `actualDate` (or equivalent) = the **original** date when shifted, so the UI can show
    "Observed Mon 6 Jan (falls Sat 4 Jan)".
  - `observed: boolean` (or a shift reason) — whether this row was shifted.
  - `isOptional: boolean` and `selected: boolean` — for the restricted/optional picker.
  - `countryCode` / source — which country (or tenant-wide) the row came from.

## 2. Rule-coverage checklist (the engine's actual responsibilities)

The server must apply **all** of the following, not just the country filter:

- [x] **Country scoping** — **DONE.** Resolves the employee's legal-entity country (salary→
      legalEntity, same chain as payroll) + keeps tenant-wide rows (`location: null`). Live:
      IN employee = 15 (12 tenant-wide + 3 IN); SUPER_ADMIN/no-country = 12 tenant-wide only.
- [x] **Optional / restricted selection + per-country cap** — **DONE.** Resolver reflects
      per-employee selections; `POST /holidays/optional-selections` enforces the cap server-side
      (`holidaysPolicy.service.js` → `422 LIMIT_REACHED` when `current.length >= restrictedLimit`).
- [x] **Observed-day / substitute-day shifting** — **DONE (code), unit-tested.** `observedDate()`
      wired into the resolver, computed against the resolved work-week + `HolidayPolicy.observedRule`.
      Live-exercised only for `NONE`/IN (no shift); the SUN-THU Fri→Sun shift is covered by a unit
      test on the deployed code — **not yet exercised on a live SUN-THU employee** (see §5.2).
- [ ] **Effective-dated / versioned** holiday policy — **GAP — NOT IMPLEMENTED.** `HolidayPolicy`
      is a single row per (tenant, country) with no `version`/`effectiveFrom`/`effectiveTo`. Needs a
      schema migration to match the StatutoryPack versioning model.

## 3. The consistency guarantee (the item that matters most)

- [x] Holiday applicability is a **shared backend service** — **DONE (code).** `resolveHolidayDateSet`
      is called by leave (`POST /leave/requests/preview`), attendance (team grid), and payroll
      (payslip-detail `holidayBasis`). One code path in `holidayResolver.service.js`.
- [ ] **Proof: identical across leave / payroll / attendance** — **NOT FULLY VERIFIED.** Leave
      preview live ✓; payroll consumes it but the count is **not yet shown live** (no payslip on box);
      the attendance **team grid resolves tenant-wide** (`employeeId:null`), which can diverge from a
      per-employee resolution for a non-default-country employee. Numeric "identical" proof across all
      three for the same employee+period is outstanding.

## 4. Config-over-code proof (truly global)

- [x] **Never-seen country (`BR`) from config only** — **DONE (code), unit-tested.** Proven by
      unit test on deployed code; **not exercised live** (no BR data on box).
- [x] **Observed-day shifting for a non-Mon–Fri week (SUN-THU)** — **DONE (code), unit-tested.**
      Fri→Sun shift with `actualDate` is a unit test; **not exercised on a live SUN-THU employee**
      (see §5.2 — blocked).
- [x] **No `if (country === '…')` branches** — **DONE.** Verified by inspection: resolver +
      `applicability.js` + `observedDates.js` have zero country branches; all per-country behaviour is
      data (`HolidayPolicy`, work-week). (The only `countryCode ===` is a default-seed lookup, not a
      behaviour branch.)

## 5. Live evidence required (not a Swagger entry)

Provide (or the FE will run) actual live responses demonstrating:

- [ ] **IN + US disjoint live** — **PARTIAL.** IN live ✓ (15 = 12 tenant-wide + 3 IN). US employee
      not on box → US-disjoint proven by unit test only, **not live**. (BLOCKED — no way to create a
      US employee via API.)
- [ ] **KWD `SUN-THU` shifted observed + `actualDate` live** — **NOT DONE LIVE (BLOCKED).** Proven by
      unit test on deployed code; a live KW employee needs a pay-group/salary seed (no API path).
- [x] **No legal entity / unresolved country → tenant-wide only** — **DONE (live).** SUPER_ADMIN
      (no employee profile): `context.resolvedBy="TENANT_WIDE"`, `countryCode=null`, 12 tenant-wide rows.
- [x] **SUPER_ADMIN (no employee profile) → defined behavior** — **DONE (live).** Tenant-wide only,
      explicitly stated in `context`.
- [ ] **Same period: leave preview ↔ payroll holiday count match** — **NOT DONE LIVE.** Leave preview
      live ✓; payroll `holidayBasis` not shown live (no payslip on box).

## 6. Edge / empty semantics (define each)

- [x] Year with **no holidays** → **DONE (live).** `GET /me/holidays?year=2099` → `{ holidays:[], total:0 }`.
- [x] **Optional cap exceeded** → **DONE.** Rejects the selection with `422 LIMIT_REACHED` (no clamp);
      enforced in `holidaysPolicy.service.js`.
- [x] **Management (all-countries) view** for HR/SUPER_ADMIN → **DONE.** `GET /holidays` unscoped +
      editable (POST/PATCH/DELETE) — live.

---

## Definition of "engine confirmed on the backend" — STATUS: ⚠️ NOT YET MET

Both must be true, verified with **live multi-country probes** (incl. a never-seen country):

1. A documented endpoint returns the **fully-resolved per-employee** holiday set **with
   observed/optional metadata** (§1–§2). — ✅ **MET** (less §2.4 versioning gap).
2. **Leave + payroll + attendance demonstrably consume that same resolution** server-side (§3).
   — ⚠️ **PARTIALLY MET.** Shared code path exists; the **live multi-country probe** (KWD SUN-THU,
   US, payroll holiday-count match) is **not yet done** (blocked by gated seeding), and the §3
   numeric "identical" proof is outstanding.

**Document stays OPEN.** The frontend keeps its thin, explicitly non-authoritative client mirror for
preview/UX until part 2 + §2.4 close. Remaining backend work to fully close: (a) version `HolidayPolicy`
(migration); (b) seed US/KWD employees + run payroll to produce the live §3/§5 numeric proof;
(c) decide whether the attendance team grid should resolve per-employee rather than tenant-wide.

## Frontend transition (once confirmed)

- FE consumers (`HolidayScreen` employee view, `UpcomingHolidaysCard`, `OptionalHolidayPicker`,
  and the attendance/timesheet/leave context hooks) switch to the resolved endpoint and
  **render what the server returns**.
- `resolveApplicableHolidays` is retired as an authority — kept, if at all, only as a labeled
  preview shim that mirrors this contract.
- The management `/holidays` screen continues to use the unscoped all-countries list.

## Sign-off

Backend status as of commit `24b27fb` (✅ = confirmed done, ⚠️ = partial, ☐ = not done). "Live-verified by FE" left for the FE team.

| # | Item | Backend confirms | Live-verified by FE |
|---|------|:---:|:---:|
| 1 | Resolved per-employee endpoint + metadata | ✅ | ☐ |
| 2 | Country + optional + observed + **versioned** rules | ⚠️ (versioning §2.4 missing) | ☐ |
| 3 | Shared resolution across leave/payroll/attendance | ⚠️ (shared code; numeric proof not done) | ☐ |
| 4 | Config-over-code (never-seen country, SUN-THU) | ✅ code / ⚠️ not live | ☐ |
| 5 | Live multi-country evidence | ☐ (IN+SUPER_ADMIN only; US/KWD/payroll blocked) | ☐ |
| 6 | Edge/empty semantics defined | ✅ | ☐ |

**Overall: NOT fully implemented.** Items 1 & 6 complete; 2, 3, 4 partial; 5 not done live. See the status banner at the top for the 3 outstanding work items.
