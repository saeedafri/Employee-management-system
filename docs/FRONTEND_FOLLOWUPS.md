# Frontend Follow-ups (file back to the ems-frontend team)

> Issues discovered during backend end-to-end (MSW-off) verification that are **frontend-side**.
> The backend is correct and live-verified for each item below. These require changes in
> `/Users/mohdsaeedafri/All-Code-Base/ems-frontend`, not this repo. Backend work is unblocked.

| # | Date | Area | Issue | Backend status | FE action required |
|---|------|------|-------|----------------|--------------------|
| FE-1 | 2026-06-22 | Holidays (Phase 7.3) | FE Holidays screen calls `GET /api/holidays?year=2026` **without `countryCode`**. It still runs the client-side `resolveApplicableHolidays` workaround that 7.3 was meant to retire. | ✅ Done & live-verified — `?countryCode=` server-side scoping works (commit `fdce518`): `IN`→17, `US`/`JP`/`ID`→12, no substring false-match, AND-composes with legacy `country`. | Pass the employee's legal-entity country as `countryCode` to `GET /holidays`; remove/retire the client-side filter once swapped. |
| FE-2 | 2026-06-22 | Payroll run detail (`/payroll/[runId]`) | React console error "Encountered two children with the same key" on the run-detail screen (ids `cmqjm5db1…`, `cmqjm5c6u…`, `cmqjm5b05…`). | ✅ Backend clean — `GET /payroll/runs/:id/payslips` returns **3 unique payslips** (unique `id` + `employeeId`, nets ₹79k/₹88k/₹66k). The warning ids differ from the payslip ids, so it's a FE list (component/earnings breakdown) using a non-unique `key`. | Use a stable unique `key` (e.g. `component.id`+index) in the offending list on the run-detail page. Non-blocking (warning, not a crash). |
| FE-3 | 2026-06-22 | Payroll dashboard (`/payroll`) | Summary cards render **hardcoded ₹** — a KWD tenant (country KW, `defaultCurrency: KWD`) shows "Total Paid (This Year) ₹0" instead of "KD 0.000". Truly-global litmus violation (assumes rupee/2dp). | ✅ Backend correct — `/settings/tenant` returns `currency: KWD`; `/payroll/runs` returns no currency for the empty aggregate (FE computes the card). Backend run-currency hardcode was a separate bug, now fixed (commit below). | Format the payroll summary cards (Total Paid / Last Run Net) with the **tenant currency** from `/settings/tenant` via `Intl.NumberFormat(locale, {style:'currency', currency})` — never a hardcoded `₹`/2dp. Verified live with a KWD tenant (`admin@kwd.test`). |

## Notes
- Add new rows as backend phases are verified end-to-end with MSW off.
- "Backend status ✅" means the endpoint matches the contract wire shape and was verified against the live stack — the remaining work is purely in the frontend.
