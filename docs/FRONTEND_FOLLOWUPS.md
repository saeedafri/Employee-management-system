# Frontend Follow-ups (file back to the ems-frontend team)

> Issues discovered during backend end-to-end (MSW-off) verification that are **frontend-side**.
> The backend is correct and live-verified for each item below. These require changes in
> `/Users/mohdsaeedafri/All-Code-Base/ems-frontend`, not this repo. Backend work is unblocked.

| # | Date | Area | Issue | Backend status | FE action required |
|---|------|------|-------|----------------|--------------------|
| FE-1 | 2026-06-22 | Holidays (Phase 7.3) | FE Holidays screen calls `GET /api/holidays?year=2026` **without `countryCode`**. It still runs the client-side `resolveApplicableHolidays` workaround that 7.3 was meant to retire. | ✅ Done & live-verified — `?countryCode=` server-side scoping works (commit `fdce518`): `IN`→17, `US`/`JP`/`ID`→12, no substring false-match, AND-composes with legacy `country`. | Pass the employee's legal-entity country as `countryCode` to `GET /holidays`; remove/retire the client-side filter once swapped. |

## Notes
- Add new rows as backend phases are verified end-to-end with MSW off.
- "Backend status ✅" means the endpoint matches the contract wire shape and was verified against the live stack — the remaining work is purely in the frontend.
