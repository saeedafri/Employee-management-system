# Payroll — Employee Tax Backend Contract (tax declaration + tax forms, global)

> **Audience:** the backend developer fixing the **employee-facing** tax surfaces under
> _My Pay → Tax Declaration_ and _My Pay → Tax Forms_ (`src/modules/payroll/components/`
> `TaxDeclarationCard.tsx`, `TaxFormsCard.tsx`, `TaxFormDrawer.tsx`).
>
> **Why this doc exists.** Two employee tax features are broken against the **live** backend:
>
> 1. **Tax Declaration** can't load for an EMPLOYEE because the FE has to read tax regimes from
>    `GET /payroll/statutory-packs`, which is `authorize(['HR_ADMIN','SUPER_ADMIN'])` → **403** for
>    employees. The tab is stuck with no regimes and logs a console 403.
> 2. **Tax Forms → "Generate form"** crashes: the live `GET …/tax-form` returns a flat payload
>    (`{formType, employee, employer:{name,tan}, incomeDetails, downloadUrl}`) that does **not**
>    match the `TaxFormDocument` shape the FE renders (`sections[]`, `identifiers[]`, `authority`,
>    `jurisdiction`), so the drawer dereferences `undefined.map(...)` and throws.
>
> Both also violate **§26 "config over code"**: the FE hardcodes `country='IN'`, an India Apr–Mar
> fiscal year, and India exemption labels; the backend hardcodes `Acme Corp / MUMB00000B / PAN`
> and `regime: 'IN_NEW_REGIME'`. The two changes below fix the breakage **and** make the surfaces
> country-driven.
>
> **Status:** ⚠️ **LIVE-defect** — both routes exist and are `authorize(allAuth)` (employee-readable),
> but their **response shapes are wrong** for the FE. When the backend ships the shapes below, the FE
> drops its hardcoded `'IN'` packs call (B1) and renders the live form unchanged (B2).

---

## §0 — Conventions

- **Money is integer minor units + ISO 4217 currency code**, zero-decimal-currency aware
  (`money.utils.ts`). Percentages/rates are plain numbers. Never assume rupees / two decimals.
- **Field casing:** `camelCase` (payroll domain). **Dates on writes** are `YYYY-MM-DD`.
- **Fiscal year** is a string whose format is **country-defined**: `"2026-27"` (IN, Apr–Mar),
  `"2026"` (US, calendar). Never assume Apr–Mar. The server is the source of valid FY values.
- **Envelope (consistent):** `{ "success": true, "data": <payload> }` /
  `{ "success": false, "error": { code, message, details? } }`. Single objects at `data`.
- **Status codes:** `200` ok, `404 NOT_FOUND`, `422` validation/business rule.
- **Roles:** these are **employee-scoped reads** — `authorize(allAuth)` (`HR_ADMIN, SUPER_ADMIN,
  MANAGER, EMPLOYEE`); the server scopes the row to the path `:id` (an employee reads only self;
  HR reads anyone). **Both routes already have this authz — keep it.**
- **Config over code (§26):** country, currency, fiscal-year format, regimes, exemption labels,
  statutory identifiers (PAN/TAN/SSN/EIN…), form title, authority, and every section/row below are
  **resolved from the employee's legal entity + the country's statutory pack / form template** —
  never a hardcoded `if (country === 'IN')` branch, and never a literal employer/identifier.
- **Country resolution:** the employee's country comes from their `LegalEntity` (via the
  `EmployeeSalary.legalEntityId`); the matching `StatutoryPack` (effective-dated) supplies the
  regimes. The FE must **not** pass a country — the server derives it.
- **Ground truth:** TS type names below are defined in `payroll.types.ts` /
  `statutory.types.ts` and are the authoritative field lists. When this doc and a type disagree,
  the **type wins** (it is what the FE renders).

---

## B1 — `GET /payroll/employees/:id/tax-declaration` — return regimes + locale inline

**Consumed by:** `TaxDeclarationCard.tsx` (employee + HR mode), via
`useTaxDeclaration` → `employeeSalaryApi.getTaxDeclaration`.

### The problem

The FE needs the **applicable tax regimes** (codes, labels, `allowedExemptions`, slabs) to render
the declaration editor and the per-regime projected-tax table. Today it gets them from
`GET /payroll/statutory-packs?country=IN`, which:

- is **`authorize(adminRoles)`** → **403** for the EMPLOYEE who owns the declaration, and
- is called with a **hardcoded `'IN'`** (`TaxDeclarationCard.tsx:310`).

Result: an employee opening _My Pay → Tax Declaration_ gets no regimes (tab stuck) + a console 403.

### The fix

Enrich the response the employee is **already allowed to read** (this route is `allAuth`) so it
carries everything the editor needs. The FE then stops calling `statutory-packs` and stops
passing a country.

```
GET /payroll/employees/:id/tax-declaration?fy=<fiscalYear?>      authorize(allAuth)
```

- `fy` optional; when omitted the server uses the employee's **current** fiscal year for their
  country (NOT a hardcoded Apr–Mar boundary).
- Still **never 404s** — when no declaration exists, return the default (empty `items`, the
  country's **default** regime) merged with the resolved config below.

**200 response** (`data`):

```jsonc
{
  "employeeId": "string",
  "fiscalYear": "2026-27",          // country-formatted; echoes the resolved FY
  "country": "IN",                  // ISO 3166-1 alpha-2, resolved from the employee's legal entity
  "currency": "INR",                // ISO 4217, from the pay group / entity
  "annualTaxableMinor": 1450000,    // integer minor units — server-computed taxable earnings base
  "regime": "IN_NEW_REGIME",        // current selection; default = country's default regime
  "regimes": [ /* TaxRegime[] — see below */ ],
  "items": [
    { "code": "80C", "amount": 150000, "meta": null, "proofStatus": "PENDING" }
  ],
  "updatedAt": "2026-06-01T10:00:00.000Z"  // null/omitted for a not-yet-saved default
}
```

**`regimes[]` element = `TaxRegime`** (already defined in `statutory.types.ts`, the same objects
`statutory-packs` returns — just delivered inline here, scoped to this employee's country):

| Field               | Type                       | Notes                                                        |
| ------------------- | -------------------------- | ------------------------------------------------------------ |
| `code`              | string                     | e.g. `IN_NEW_REGIME`, `US_FEDERAL`. Used as the select value |
| `name`              | string (optional)          | Human label, e.g. "New Regime"; FE falls back to `code`      |
| `fiscalYear`        | string                     | Country-formatted FY                                         |
| `currency`          | string (ISO 4217)          |                                                              |
| `standardDeduction` | integer (minor units)      |                                                              |
| `slabs`             | `TaxSlab[]`                | Drives the FE's client-side projected-tax preview            |
| `surcharge`         | `TaxSurcharge[]` (opt)     |                                                              |
| `cess`              | `{ rate } \| null` (opt)   |                                                              |
| `allowedExemptions` | string[] (opt)             | Exemption **codes** the FE renders as declarable rows        |

**`items[]` element = `TaxDeclarationItem`:** `{ code, amount (minor units), meta?, proofStatus }`,
`proofStatus ∈ PENDING|VERIFIED|REJECTED`.

### Exemption labels (global, optional but preferred)

The FE currently hardcodes labels (`80C → "Section 80C (investments)"`, `HRA → …`). To keep labels
country-driven, **either** include a label with each allowed exemption — change `allowedExemptions`
to (or add) `exemptions: [{ code, label }]` on the regime — **or** accept that the FE shows the raw
code when no label is supplied. Preferred: `exemptions: [{ code, label }]`. If you keep
`allowedExemptions: string[]`, say so and the FE will display codes.

### Writes (unchanged shape, note the regime)

`POST /payroll/employees/:id/tax-declaration` body = `TaxDeclarationInput`
(`{ fiscalYear, regime, items: TaxDeclarationItem[] }`); `PATCH` updates `proofStatus` (HR).
The default `regime` on create must be the **country's** default, not a literal `IN_NEW_REGIME`.

### Acceptance

- An EMPLOYEE calling `GET …/tax-declaration` (self) gets **200** with non-empty `regimes[]` for
  their country — **no dependency on `/statutory-packs`**.
- `country`/`currency`/`fiscalYear` reflect the employee's legal entity, not a hardcoded `IN`.
- A US (or any non-IN) employee gets US regimes/FY — proven by config only, no code branch.

---

## B2 — `GET /payroll/employees/:id/tax-form` — return the `TaxFormDocument` shape

**Consumed by:** `TaxFormDrawer.tsx` → `TaxFormContent`, via `useTaxForm` →
`taxFormsApi.get` (the FE casts `data.data` directly to `TaxFormDocument` — **no mapping layer**).

### The problem (the crash)

Live response today:

```jsonc
{ "formType": "FORM16", "fiscalYear": "2025-26",
  "employee": { "id": "...", "name": "...", "employeeCode": "...", "pan": "XXXXX0000X" },
  "employer": { "name": "Acme Corp", "tan": "MUMB00000B" },
  "incomeDetails": { "grossIncome": 0, "netTaxableIncome": 0, "taxDeducted": 0 },
  "downloadUrl": null }
```

The FE renders `document.sections.map(...)`, `document.authority`, `document.jurisdiction`, and
`party.identifiers.map(...)` — **none of which exist** in the payload above → `undefined.map` →
render crash → "Failed to generate tax form". The employer/identifiers are also hardcoded India.

### The fix

Return the localized document the FE already types as **`TaxFormDocument`** (built generically from
a per-country **form template** + YTD payroll + the statutory pack — §26 pillar 4):

```
GET /payroll/employees/:id/tax-form?type=<FORM16|W2|P60>&fy=<fiscalYear?>     authorize(allAuth)
```

**200 response** (`data`) — **exact field names the FE renders:**

```jsonc
{
  "type": "FORM16",                 // TaxFormType: FORM16 | W2 | P60 (echoes the requested type)
  "title": "Form 16",               // template title for the type/country
  "fiscalYear": "2025-26",          // country-formatted
  "jurisdiction": "IN",             // ISO 3166-1 alpha-2 the form is filed in
  "authority": "Income Tax Department",   // issuing authority (IRS, HMRC, …) — from template
  "currency": "INR",                // ISO 4217
  "employer": {
    "name": "Acme Corp",
    "subtitle": "Mumbai, India",        // optional
    "identifiers": [                    // template-defined statutory ids — NOT hardcoded keys
      { "label": "TAN", "value": "MUMB00000B" },
      { "label": "PAN", "value": "AAAAA0000A" }
    ]
  },
  "employee": {
    "name": "Priya Sharma",
    "subtitle": "Software Engineer",    // optional
    "identifiers": [
      { "label": "PAN", "value": "ABCDE1234F" },
      { "label": "Employee Code", "value": "EMP-0007" }
    ]
  },
  "sections": [                         // ordered; each row is a pre-formatted label/value line
    { "title": "Gross Salary", "rows": [
      { "label": "Salary as per section 17(1)", "value": "₹14,50,000" },
      { "label": "Total", "value": "₹14,50,000" }
    ]},
    { "title": "Tax Deducted at Source", "rows": [
      { "label": "Total TDS", "value": "₹1,20,000" }
    ]}
  ],
  "generatedAt": "2026-06-25T10:00:00.000Z"
}
```

**Type map (authoritative — `payroll.types.ts`):**

| Type             | Fields                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------- |
| `TaxFormDocument`| `type, title, fiscalYear, jurisdiction, authority, currency, employer, employee, sections[], generatedAt` |
| `TaxFormParty`   | `name, subtitle?, identifiers: { label, value }[]`                                       |
| `TaxFormSection` | `title, rows: TaxFormRow[]`                                                              |
| `TaxFormRow`     | `label, value` (value is **pre-formatted by the server** — currency/locale applied)     |

Notes:

- **No `downloadUrl`** — the FE prints the rendered document via the browser (`window.print()`),
  so a download URL is not consumed. You may omit it.
- `value` strings are **server-formatted** (the server knows the currency/locale); the FE prints
  them verbatim. Keep money in the document as formatted strings here (this is a presentation
  document, distinct from the minor-unit money used elsewhere).
- `sections`, `authority`, `jurisdiction`, `title`, and both parties' `identifiers` must come from
  a **country/form-type template** (Form 16 → IN sections + PAN/TAN; W-2 → US boxes + SSN/EIN;
  P60 → UK rows + NI number). The current literal `Acme Corp / MUMB00000B / PAN: XXXXX0000X` must
  be replaced with template + real employee/employer data.
- `404 NOT_FOUND` only when the employee `:id` doesn't exist. No payroll data yet → return a valid
  document with zeroed rows (don't 404).

### Acceptance

- `GET …/tax-form?type=FORM16` returns a `TaxFormDocument` with non-empty `sections[]` and parties
  with `identifiers[]` → the FE drawer renders without crashing.
- Requesting `type=W2` for a US employee yields a W-2 document (US sections/identifiers/authority)
  from the template — proven by config, no `country===` branch.

---

## Summary for the backend team

| Item | Route                                          | Change                                                                                                 |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| B1   | `GET /payroll/employees/:id/tax-declaration`   | Add `country, currency, annualTaxableMinor, regimes: TaxRegime[]` (country-resolved) to the response.  |
| B2   | `GET /payroll/employees/:id/tax-form`          | Replace the flat payload with the `TaxFormDocument` shape (template-driven, per country/form type).    |

Both routes keep `authorize(allAuth)`. Neither needs a new endpoint — they are **shape fixes** on
existing live routes. After they ship, the FE applies the cleanup in the next section.

---

## Frontend follow-up — exact changes once B1 + B2 ship

> Do these **after** the backend deploys B1/B2 (or behind `NEXT_PUBLIC_USE_MOCKS` against a mock
> matching these shapes). Each item lists the file, the current code, and the precise change.
> Ordered so the app type-checks at each step.

### FE-1. Extend the `TaxDeclaration` type (B1 fields)

**File:** `src/modules/payroll/types/payroll.types.ts` (the `TaxDeclaration` interface, ~line 600).

Add the inline-config fields the enriched B1 response now carries:

```ts
import type { TaxRegime } from './statutory.types';

export interface TaxDeclaration {
  employeeId: string;
  fiscalYear: string;
  regime: string;
  items: TaxDeclarationItem[];
  updatedAt: string;
  // ── B1 additions (server-resolved, country-driven) ──
  country: string;            // ISO 3166-1 alpha-2
  currency: string;           // ISO 4217
  annualTaxableMinor: number; // integer minor units
  regimes: TaxRegime[];       // applicable regimes for the employee's country
}
```

If B1 ships exemption labels as `exemptions: [{ code, label }]` on the regime, add that to
`TaxRegime` in `statutory.types.ts`; otherwise leave `allowedExemptions: string[]` as-is.

### FE-2. `TaxDeclarationCard.tsx` — drop the hardcoded `'IN'` packs + salary reads

**File:** `src/modules/payroll/components/TaxDeclarationCard.tsx`.

In the `TaxDeclarationCard` component (~lines 300–322), **remove**:

```ts
const { data: packs = [] } = useStatutoryPacks('IN');   // ← delete (was the 403 + hardcoded IN)
const { data: salary } = useEmployeeSalary(employeeId);  // ← delete (B1 now returns currency + taxable)

const activePack: StatutoryPack | undefined =
  packs.find((p) => p.effectiveTo === null) ?? packs[0]; // ← delete
const regimes = activePack?.taxRegimes ?? [];            // ← delete

const annualTaxable = salary
  ? salary.calculatedComponents
      .filter((c) => c.type === 'EARNING' && c.taxable)
      .reduce((s, c) => s + c.monthlyAmount, 0) * 12
  : 0;                                                    // ← delete
const currency = salary?.payGroup.currency ?? 'INR';      // ← delete
```

**Replace with** reads off the declaration response (`declQuery.data`):

```ts
const decl = declQuery.data;
const regimes = decl?.regimes ?? [];
const currency = decl?.currency ?? 'INR';        // fallback only for the loading frame
const annualTaxable = decl?.annualTaxableMinor ?? 0;   // already minor units — same unit the editor expects
```

Then **remove the now-unused imports**: `useStatutoryPacks` (from `../hooks/useLocalization`),
`useEmployeeSalary` (from `../hooks/useEmployeeSalary`), and the `StatutoryPack` /
`TaxRegime`-from-pack type import if it becomes unused.

> Note: `annualTaxable` stays in **minor units** — the editor already feeds it to `computeRegimeTax`
> alongside `amountMinor(...)` exemptions, so no unit conversion changes. The loading guard
> `declQuery.isLoading || regimes.length === 0` keeps working (regimes now come from `decl`).
>
> This fixes **both** modes: HR mode (`mode="hr"`) also reads `regimes` from the same response, so
> the HR proof-verification view stops needing the admin packs endpoint too.

### FE-3. `TaxDeclarationCard.tsx` — exemption labels from config, not the hardcoded map

**File:** same. The `EXEMPTION_LABELS` constant (~lines 33–39) hardcodes India sections
(`80C/80D/HRA/LTA`). Resolve the label per regime instead:

- **If B1 sends `exemptions: [{ code, label }]`:** build a `code → label` map from the selected
  regime and render `map[code] ?? code`. Delete `EXEMPTION_LABELS`.
- **If B1 keeps `allowedExemptions: string[]` (codes only):** keep `EXEMPTION_LABELS` strictly as a
  **display fallback** (`EXEMPTION_LABELS[code] ?? code`) and add a code comment that real labels
  are expected from the pack. (Current behaviour already falls back to the code, so this is a
  no-op until labels arrive.)

### FE-4. `TaxFormsCard.tsx` — fiscal-year list from the entity, not hardcoded Apr–Mar

**File:** `src/modules/payroll/components/TaxFormsCard.tsx` (the `fiscalYearOptions()` helper,
~lines 19–27). It hardcodes the India Apr–Mar boundary (`now.getMonth() + 1 >= 4`) and `YYYY-YY`
formatting.

- Derive the fiscal-year-start month from resolved settings —
  `useResolvedSettings().settings.fiscalYearStartMonth` (already country-driven) — and compute the
  last 4 FY labels from that boundary, formatting `YYYY-YY` only when the FY spans two calendar
  years (IN) and `YYYY` when it doesn't (US/calendar).
- Simpler alternative if you'd rather not format client-side: have B1/B2 return an accepted-FY list
  and populate the dropdown from it. (Not in the contract above — add a `validFiscalYears: string[]`
  field to B1 if you take this route.)

### FE-5. (Optional) filter the Form dropdown by country

**File:** `src/modules/payroll/components/TaxFormsCard.tsx` + `constants/index.ts` (`TAX_FORM_OPTIONS`).
Today every employee sees `Form 16 / W-2 / P60`. Once `country` is available (from the B1
declaration response, or pass it into the card), filter `TAX_FORM_OPTIONS` to the form types valid
for that country (IN → FORM16, US → W2, UK → P60). Tag each option with a `country` (or
`countries: string[]`) in `TAX_FORM_OPTIONS` and filter. Enhancement, not required to fix the crash.

### FE-6. `TaxFormDrawer.tsx` / `tax-forms.api.ts` — no change

Once B2 returns the `TaxFormDocument` shape, `taxFormsApi.get` (which already casts `data.data` to
`TaxFormDocument`) and `TaxFormDrawer` render it as-is. **Do not** add an FE mapper — the contract
shape is the FE shape on purpose. If you add an FE mapper, you re-introduce the India hardcoding the
backend is meant to own.

### FE-7. Tests + verification gate

- Update `src/modules/payroll/components/__tests__/TaxDeclarationCard.fy.test.tsx` if it stubs
  `useStatutoryPacks` / `useEmployeeSalary` — switch those stubs to `useTaxDeclaration` returning the
  enriched shape (`regimes`, `currency`, `annualTaxableMinor`).
- Add a `TaxFormDrawer` test that renders the `TaxFormDocument` shape and asserts a section/identifier
  is shown (guards against a future shape regression).
- Run the gate: `pnpm typecheck` (clean) → `pnpm lint` (clean) → `pnpm test src/modules/payroll`.
- **Live verify** as an EMPLOYEE: _My Pay → Tax Declaration_ loads regimes with **no** 403, and
  _Tax Forms → Generate form_ opens a populated document with no crash. Confirm a non-IN employee
  (if seedable) shows their country's regimes/form — the global-config proof.

### Files touched (FE side, after backend ships)

| File                                                                     | Change                                                          |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `src/modules/payroll/types/payroll.types.ts`                             | FE-1: extend `TaxDeclaration` with `country/currency/annualTaxableMinor/regimes` |
| `src/modules/payroll/components/TaxDeclarationCard.tsx`                   | FE-2/FE-3: drop `useStatutoryPacks('IN')` + salary reads; read regimes/currency/taxable from `declQuery.data`; labels from config |
| `src/modules/payroll/components/TaxFormsCard.tsx`                         | FE-4 (+FE-5 optional): FY list from entity fiscal-year-start; optional country-filtered form types |
| `src/modules/payroll/components/TaxFormDrawer.tsx` · `services/tax-forms.api.ts` | FE-6: **no change** (renders `TaxFormDocument` directly)         |
| `src/modules/payroll/components/__tests__/TaxDeclarationCard.fy.test.tsx` + new drawer test | FE-7: restub to enriched shape; add drawer render test |

These FE edits are small and isolated; none change the contract — they only consume it.
