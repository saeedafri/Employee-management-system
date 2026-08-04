# Assets Export conflict re-probe — SUPER_ADMIN

| Field | Value |
|-------|-------|
| Date | 2026-08-03T03:42:08Z → 03:42:19Z |
| Role | `SUPER_ADMIN` — `superadmin@acme.test` / `Password123!` / `acme-corp-001` |
| UI | `http://localhost:3001` |
| BE | `http://localhost:4000` |
| Purpose | Resolve sa-exports `ok:true` vs sa-gap-menus GAP-03 `ok:false` |
| **Final verdict** | **flaky** |

## Procedure

1. Login SUPER_ADMIN
2. Open `/assets`
3. Click **Export** ×3
4. Capture Playwright download events + network

## Results

| Attempt | Download suggested | ok | Network export/CSV |
|--------:|--------------------|----|--------------------|
| 1 | `assets-inventory.csv` | false | none |
| 2 | `assets-inventory.csv` | false | none |
| 3 | `assets-inventory.csv` | false | none |

Page load APIs (not export): `GET /api/assets` 200, `GET /api/assets/summary` 200, `GET /api/assets/employees` 200.

## Root cause

FE `AssetsScreen.handleExport` builds a client-side CSV `Blob`, creates an object URL, clicks a temporary `<a download="assets-inventory.csv">`, then **immediately** calls `URL.revokeObjectURL(url)`. That race yields intermittent Playwright download success/failure and no BE export request.

## Historical notes (kept)

- `confirm/sa-exports` (2026-08-03T03:35Z): `assets-inventory.csv ok:true` (part of 16/16)
- `confirm/sa-gap-menus` GAP-03: `ok:false` ×2
- This re-probe: `ok:false` ×3

## Related FE issues (GAP-01..04 retained)

See `docs/E2E_GAP_CONFIRM_FINDINGS.md` and `docs/E2E_FRONTEND_ISSUES_CONTRACT.md` → `## SA-GAP-MENUS`.
