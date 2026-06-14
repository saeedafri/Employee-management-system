# UI Team Handoff — Sub-Monthly Payroll Fix (Backend)

> **Date:** 2026-06-14 · **Status:** Backend fixed & **live on Render** · **Acceptance:** 17/17 live, 15/15 engine unit
> **API base:** `https://employee-management-system-2b9q.onrender.com/api/v1`
> All example request/response bodies below are **real captures from the live API** (test runs cancelled afterward; no data mutated).

---

## 1. Status

| Item | Status |
|---|---|
| Backend fix merged to `main` | ✅ `1401977` |
| Render deploy | ✅ Live (`dep-d8n6q6u47okc73eqsmlg`) |
| Live acceptance tests | ✅ 17/17 |
| Swagger (`/docs`) + `API_MAPPING.md` | ✅ Updated |

---

## 2. What was fixed (backend)

| # | Defect | Severity | Fix |
|---|---|---|---|
| 1 | Sub-monthly **FLAT** base paid in full every cycle (₱100k/mo → ₱100k per H1+H2 = 2× overpay) | Critical | FLAT now pays the per-cycle share, data-driven: `monthly × 12 / periodsPerYear` (MONTHLY ×1, SEMI_MONTHLY ×½, BIWEEKLY ×12/26, WEEKLY ×12/52) |
| 2 | Statutory could mis-apportion depending on `legalEntityId` | Critical | Apportionment resolves from the **pay group / pay calendar**, independent of `legalEntityId`. No silent doubling |
| 3 | India `PF_ER`/`ESI_ER` leaked onto non-India payslips | Medium | Employer lines come **only** from the resolved pack's contribution schemes; no schemes → `employerContributions: []` |

**No request/response shapes changed.** These are behaviour/value corrections. Existing UI bindings keep working.

---

## 3. Verified API request/response (real captures)

### 3.1 Create a sub-monthly run — `POST /payroll/runs`
```jsonc
// REQUEST
{
  "period": "2057-01-H1",
  "type": "OFF_CYCLE",          // REGULAR for normal runs; OFF_CYCLE/FNF accept employeeIds
  "employeeIds": ["<id>"],
  "paySchedule": "SEMI_MONTHLY",
  "startDate": "2057-01-01",
  "endDate": "2057-01-15",
  "payDate": "2057-01-15"
}

// RESPONSE 201 → data
{
  "id": "cmqdkqhj80016f5kj38w5525y",
  "period": "2057-01-H1",
  "paySchedule": "SEMI_MONTHLY",
  "startDate": "2057-01-01",
  "endDate": "2057-01-15",
  "payDate": "2057-01-15",
  "type": "OFF_CYCLE",
  "status": "DRAFT",
  "currency": "MULTI"           // ⚠️ run-header sentinel — see §4
}
```

### 3.2 Calculate — `POST /payroll/runs/:id/calculate`
```jsonc
// REQUEST: {}  (empty JSON object is required — sending no body → 422 VALIDATION_ERROR)
// RESPONSE 202
{ "success": true, "data": { "status": "CALCULATING", "estimatedSeconds": 5 }, "meta": {} }
// Calculation is synchronous server-side; payslips are ready when this returns.
```

### 3.3 Payslip detail — `GET /payroll/runs/:runId/payslips/:payslipId`

**H1 (per-cycle share = ₱50,000, NOT ₱100,000):**
```jsonc
{
  "period": "2057-01-H1",
  "periodLabel": "1–15 Jan 2057",
  "currency": "PHP",                       // per-payslip currency is ALWAYS a real ISO code
  "grossEarnings": 50000,
  "totalDeductions": 9312,
  "netPay": 40688,
  "workingDays": 11,
  "earnings":   [ { "code": "BASIC",          "amount": 50000 } ],
  "deductions": [ { "code": "SSS_EE",         "amount": 875 },
                  { "code": "WITHHOLDING_TAX", "amount": 8437 } ],
  "employerContributions": [ { "code": "SSS_ER", "amount": 1750 } ]
}
```

**H2 (last cycle absorbs the tax rounding remainder → month tax is exact):**
```jsonc
{
  "grossEarnings": 50000,
  "deductions": [ { "code": "SSS_EE", "amount": 875 },
                  { "code": "WITHHOLDING_TAX", "amount": 8438 } ]
}
// Month totals: gross 100,000 · WITHHOLDING_TAX 8437+8438 = 16,875 · SSS_EE 875+875 = 1,750 · SSS_ER 3,500
```

**ZA employee, pack with no contribution schemes (Bug 3 — no India leak):**
```jsonc
{
  "currency": "ZAR",
  "grossEarnings": 50000,
  "deductions": [],
  "employerContributions": []              // was [{PF_ER,0},{ESI_ER,0}] before the fix
}
```

> `employerContributions[]` is now safe to render verbatim — only real pack-derived employer lines appear.

### 3.4 Pay-calendar cycles — `GET /payroll/pay-calendars/:id/cycles?from=YYYY-MM&to=YYYY-MM`
```jsonc
// RESPONSE 200 → data  (NESTED object — unwrap data.cycles, NOT a bare array)
{
  "payCalendarId": "cmqdkq2ck000tf5kj4jg01bdt",
  "paySchedule": "SEMI_MONTHLY",
  "cycles": [
    { "period": "2057-01-H1", "periodLabel": "1–15 Jan 2057",  "startDate": "2056-12-31", "endDate": "2057-01-14", "payDate": "2057-01-14", "cutoffDate": "2057-01-13", "paySchedule": "SEMI_MONTHLY" },
    { "period": "2057-01-H2", "periodLabel": "16–31 Jan 2057", "startDate": "2057-01-15", "endDate": "2057-01-30", "payDate": "2057-01-30", "cutoffDate": "2057-01-24", "paySchedule": "SEMI_MONTHLY" }
  ]
}
```

### 3.5 Runs list — `GET /payroll/runs` (currency can be `"MULTI"`)
```jsonc
[
  { "period": "2099-11",    "paySchedule": null,           "currency": "INR"   },
  { "period": "2057-03-H2", "paySchedule": "SEMI_MONTHLY", "currency": "MULTI" }   // ⚠️ non-ISO sentinel
]
```

---

## 4. ⚠️ Action item for the UI team — payroll page crash on `currency: "MULTI"`

During end-to-end testing the **entire payroll UI crashed** (both `/payroll` list and `/payroll/[runId]` → "Something went wrong"):

```
RangeError: Invalid currency code : MULTI
  at new Intl.NumberFormat (<anonymous>)
  at formatMajor (money.utils.ts)
  at fmtInr → cell (PayrollRunsTab / PayrollRunDetail)
```

**Root cause (contract, not a bug):** a run that spans multiple pay-group currencies returns the **non-ISO sentinel** `currency: "MULTI"` on the **run header** (see §3.1 and §3.5). This is intentional and now documented. The frontend passed it straight to `Intl.NumberFormat({ style: 'currency', currency })`, which throws on any non-ISO code.

**Contract to code against:**
- **Run-header `currency`** (run object, run list, run summary cards) → may be `"MULTI"`.
- **Per-payslip `currency`** (payslip detail, payslip rows) → always a valid ISO 4217 code.
- Never feed a run-header currency to `Intl.NumberFormat({style:'currency'})` without guarding.

**Suggested fix (frontend — `money.utils.ts`, guard once in the shared formatter):**
```ts
export function isFormattableCurrency(code?: string | null): boolean {
  const c = (code ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return false;          // 'MULTI' (5 chars) → false
  try { Intl.NumberFormat('en', { style: 'currency', currency: c }); return true; }
  catch { return false; }
}

export function formatMajor(major: number, currency: string, opts = {}) {
  const code = (currency ?? '').toUpperCase();
  const digits = opts.fractionDigits ?? currencyDecimals(code);
  const locale = opts.locale ?? localeForCurrency(code);
  if (!isFormattableCurrency(code)) {               // sentinel fallback
    const n = new Intl.NumberFormat(locale, { style: 'decimal', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(major);
    return code ? `${n} ${code}` : n;               // e.g. "50,000 MULTI"
  }
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(major);
}
```
Then route the per-component local `fmtCurrency`/`fmtMoney`/`fmtInr` helpers (`PayrollRunsTab`, `PayrollRunDetail`, `DisbursementPanel`, `JournalPanel`, `CompStatementCard`) through this guarded `formatMajor` so no component re-introduces the crash.

**Minor (non-blocking):** `/analytics` for MANAGER/EMPLOYEE renders the correct "restricted to HR/Super Admins" message but under the **"Something went wrong"** error heading + red icon — reads like a crash. Suggest an "Access restricted" state instead. (Backend is correct: analytics is HR/SA-only.)

---

## 5. API contract notes (confirmed during testing)

1. `GET /payroll/pay-calendars/:id/cycles` → `data: { payCalendarId, paySchedule, cycles: [...] }` — **unwrap `data.cycles`** (nested, not a bare array).
2. `POST /payroll/pay-calendars` **requires `code`** (string).
3. Statutory-pack create requires `rounding` and `proration` as **objects** (reads may return `null`).
4. Salary `legalEntityId` + `currency` are accepted on write and returned — stable to rely on.
5. **Run scoping:** `REGULAR` runs compute **all** active salaries; only `OFF_CYCLE`/`FNF` filter by `employeeIds`.
6. `POST /payroll/runs/:id/calculate` requires an **empty object `{}`** as the body.

---

## 6. Summary for the UI team

- ✅ Backend payroll math is correct and **live** — per-cycle gross, monthly-exact tax, capped statutory, no India leak.
- ✅ No payload **shapes** changed — only values.
- 🔧 **One change needed on the frontend:** guard the non-ISO `currency: "MULTI"` run-header sentinel before `Intl.NumberFormat` (see §4). Until then the payroll list/detail crashes on any multi-currency run.
- 🎨 Optional: friendlier `/analytics` access-restricted state for non-HR roles.
