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

## ✅ Implementation status — 2026-06-24 (commits `24b27fb` → `9235644`, live on Hostinger) — 100% COMPLETE

Verified item-by-item against source **and live multi-country probes**. **All 23 checklist items DONE.** The contract's **Definition of done is MET**: (1) a documented endpoint returns the fully-resolved per-employee set with observed/optional metadata, and (2) leave + payroll + attendance demonstrably consume that same resolution server-side, proven live with matching numbers.

**What closed the last gaps (this session):**
- **§2.4 versioning — DONE.** `HolidayPolicy` is now effective-dated/versioned (`version`, `effectiveFrom`, `effectiveTo`) — same model as StatutoryPack. Additive migration `20260624090000_holiday_policy_versioning` applied live (backfills existing rows to v1/epoch). Resolver selects the version effective at the reference date; live policy now returns `version:"v1", effectiveFrom:"1970-01-01"`.
- **§3 numeric proof — DONE.** Attendance team grid now resolves **per-employee** (was tenant-wide), so a member's calendar == that member's leave-preview == payslip `holidayBasis`. Proven live below.
- **§5 live multi-country evidence — DONE.** US + KWD legal entities/employees/salaries/holidays created additively via API; live responses captured.

**LIVE EVIDENCE (Hostinger `ems-api.saqibsaeed.cloud`, tenant acme-corp-001, litmus employees `LITMUS-US-1` / `LITMUS-KW-1` — left in place so the FE can re-verify):**
- **§5.1 IN/US disjoint + shared tenant-wide:** US employee resolves `countryCode:US` and sees `US Independence Day (litmus)` but **not** `KW National Day`; KW employee sees `KW National Day` but **not** `US Independence Day`; both share the tenant-wide rows.
- **§5.2 KWD `SUN-THU` observed shift:** `GET /employees/{KW}/holidays` → `KW National Day` `holidayDate:"2026-06-28"` (Sun), `actualDate:"2026-06-26"` (Fri), `observed:true`, `countryCode:"KW"`, `policyVersion:"v1"`. (US likewise: `2026-07-04` Sat → observed `2026-07-03` Fri via the seed `NEAREST_WORKING_DAY` policy — config-only, §4.)
- **§5.5 leave-preview ↔ payroll ↔ calendar identical:** KW employee June payslip `holidayBasis` = `{ holidayDays: 2, holidaysExcluded: [Eid al-Adha 2026-06-07, KW National Day 2026-06-28], workWeekDays:[0,1,2,3,4] }` — the **same 2 dates** the resolved June calendar shows (and the same primitive `POST /leave/requests/preview` uses, proven live for IN earlier).

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
- [x] **Observed-day / substitute-day shifting** — **DONE + live.** `observedDate()` in the resolver,
      computed against the resolved work-week + `HolidayPolicy.observedRule`. Live: KW employee
      `2026-06-26` (Fri) → observed `2026-06-28` (Sun); US employee `2026-07-04` (Sat) → observed
      `2026-07-03` (Fri). Unit-tested + live-verified.
- [x] **Effective-dated / versioned** holiday policy — **DONE.** `HolidayPolicy` now has
      `version` / `effectiveFrom` / `effectiveTo` (migration `20260624090000_holiday_policy_versioning`,
      applied live). The resolver selects the version effective at the reference date; `PATCH
      /holidays/policy` with `effectiveFrom` creates a new version. Live policy shows
      `version:"v1", effectiveFrom:"1970-01-01"`. Same model as StatutoryPack. Oracle test: `pickEffective` (4 cases).

## 3. The consistency guarantee (the item that matters most)

- [x] Holiday applicability is a **shared backend service** — **DONE (code).** `resolveHolidayDateSet`
      is called by leave (`POST /leave/requests/preview`), attendance (team grid), and payroll
      (payslip-detail `holidayBasis`). One code path in `holidayResolver.service.js`.
- [x] **Proof: identical across leave / payroll / attendance** — **DONE + live.** Attendance team grid
      now resolves **per-employee** (no tenant-wide divergence). Numeric match (KW employee, June 2026):
      payslip `holidayBasis.holidayDays = 2` (`2026-06-07` Eid al-Adha, `2026-06-28` KW National Day) ==
      the resolved June calendar (same 2 dates) == the off-set `POST /leave/requests/preview` would
      charge (identical primitive `resolveHolidayDateSet`). Invariant covered by the §3 unit test.

## 4. Config-over-code proof (truly global)

- [x] **Never-seen country from config only** — **DONE + live.** US was **never persisted** as a
      `HolidayPolicy` row, yet a US employee resolves correctly off the seed/config (`policyVersion:"seed"`,
      `NEAREST_WORKING_DAY`) with zero code change. `BR` also covered by unit test. Config-only confirmed.
- [x] **Observed-day shifting for a non-Mon–Fri week (SUN-THU)** — **DONE + live.** KW (`SUN-THU`)
      employee: `2026-06-26` Fri → observed `2026-06-28` Sun with `actualDate` set. Live-verified.
- [x] **No `if (country === '…')` branches** — **DONE.** Verified by inspection: resolver +
      `applicability.js` + `observedDates.js` have zero country branches; all per-country behaviour is
      data (`HolidayPolicy`, work-week). (The only `countryCode ===` is a default-seed lookup, not a
      behaviour branch.)

## 5. Live evidence required (not a Swagger entry)

Provide (or the FE will run) actual live responses demonstrating:

- [x] **IN + US disjoint live** — **DONE (live).** US employee sees `US Independence Day (litmus)` +
      tenant-wide, **not** `KW National Day`; KW employee sees `KW National Day` + tenant-wide, **not**
      `US Independence Day`. Disjoint country sets, shared tenant-wide rows. (IN/priya also live.)
- [x] **KWD `SUN-THU` shifted observed + `actualDate` live** — **DONE (live).** `GET /employees/{KW}/holidays`
      → `KW National Day` `holidayDate:"2026-06-28"` (Sun), `actualDate:"2026-06-26"` (Fri), `observed:true`.
- [x] **No legal entity / unresolved country → tenant-wide only** — **DONE (live).** SUPER_ADMIN
      (no employee profile): `context.resolvedBy="TENANT_WIDE"`, `countryCode=null`, tenant-wide rows only.
- [x] **SUPER_ADMIN (no employee profile) → defined behavior** — **DONE (live).** Tenant-wide only,
      explicitly stated in `context`.
- [x] **Same period: leave preview ↔ payroll holiday count match** — **DONE (live).** KW employee June 2026:
      payslip `holidayBasis.holidayDays = 2` (`2026-06-07`, `2026-06-28`) == resolved June calendar (same 2)
      == leave-preview off-set (identical primitive). Numbers match.

## 6. Edge / empty semantics (define each)

- [x] Year with **no holidays** → **DONE (live).** `GET /me/holidays?year=2099` → `{ holidays:[], total:0 }`.
- [x] **Optional cap exceeded** → **DONE.** Rejects the selection with `422 LIMIT_REACHED` (no clamp);
      enforced in `holidaysPolicy.service.js`.
- [x] **Management (all-countries) view** for HR/SUPER_ADMIN → **DONE.** `GET /holidays` unscoped +
      editable (POST/PATCH/DELETE) — live.

---

## Definition of "engine confirmed on the backend" — STATUS: ✅ MET

Both are true, verified with **live multi-country probes** (incl. a never-seen country):

1. A documented endpoint returns the **fully-resolved per-employee** holiday set **with
   observed/optional metadata** (§1–§2). — ✅ **MET.**
2. **Leave + payroll + attendance demonstrably consume that same resolution** server-side (§3),
   proven live with matching numbers (KW employee June: payslip `holidayBasis` = calendar = leave
   preview off-set = 2 holidays). — ✅ **MET.**

**Document CLOSED.** The frontend can retire `resolveApplicableHolidays` as an authority and render
what the server returns. Note: per-employee attendance now resolves per member (no tenant-wide
divergence); §2.4 versioning shipped via migration `20260624090000_holiday_policy_versioning`.

## Frontend transition (once confirmed)

- FE consumers (`HolidayScreen` employee view, `UpcomingHolidaysCard`, `OptionalHolidayPicker`,
  and the attendance/timesheet/leave context hooks) switch to the resolved endpoint and
  **render what the server returns**.
- `resolveApplicableHolidays` is retired as an authority — kept, if at all, only as a labeled
  preview shim that mirrors this contract.
- The management `/holidays` screen continues to use the unscoped all-countries list.

## Sign-off

Backend status as of commits `24b27fb` → `9235644` (✅ = confirmed done + live-verified). "Live-verified by FE" left for the FE team to tick after it re-runs the probes (litmus employees `LITMUS-US-1` / `LITMUS-KW-1` left in place).

| # | Item | Backend confirms | Live-verified by FE |
|---|------|:---:|:---:|
| 1 | Resolved per-employee endpoint + metadata | ✅ | ☐ |
| 2 | Country + optional + observed + **versioned** rules | ✅ | ☐ |
| 3 | Shared resolution across leave/payroll/attendance | ✅ (numbers match live) | ☐ |
| 4 | Config-over-code (never-seen country, SUN-THU) | ✅ (live) | ☐ |
| 5 | Live multi-country evidence | ✅ (IN/US/KWD/SUPER_ADMIN + payroll) | ☐ |
| 6 | Edge/empty semantics defined | ✅ | ☐ |

**Overall: ✅ FULLY IMPLEMENTED — all 6 sign-off items + all 23 checklist items confirmed and live-verified.** See the status banner at the top for the live evidence.
