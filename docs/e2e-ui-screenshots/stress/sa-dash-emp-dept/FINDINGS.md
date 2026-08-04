# SUPER_ADMIN Stress+Deep E2E — SA-DASH-EMP-DEPT

- Generated: 2026-08-03T02:23:36.508Z
- Role: SUPER_ADMIN (`superadmin@acme.test`)
- UI: http://localhost:3001 → API: http://localhost:4000/api/v1 → Hostinger tunnel
- Tenant: acme-corp-001
- Tool: Playwright Chromium
- Screenshots: `docs/e2e-ui-screenshots/stress/sa-dash-emp-dept/` (44 PNGs)
- **No Render deploy. No git commit.**

## Depth + stress stats

| Metric | Value |
|--------|------:|
| Menus tested | **3** |
| Controls clicked | **27** |
| Max nest depth | **1** |
| Layers explored | **6** |
| Screenshots (runner) | **44** |
| Screenshots (disk) | **44** |
| Stress bursts (5x) | **7** |
| Stress races/errors | **1** |
| Issues BACKEND | **0** |
| Issues FRONTEND | **2** |
| Issues BOTH | **0** |
| Mutations | **3** |

### Menus
- Dashboard (Add Employee, Approve, Deny/Reject, range toggles, nested layers)
- Employees (list/filter/columns/export/detail nest + `/employees/new`)
- Departments (list/add/filter nest)

## Stress notes

- **Dashboard / 7d**: OK (x5)
- **Dashboard / 30d**: OK (x5)
- **Dashboard / Refresh**: MISS (x5)
- **Dashboard / Add Employee**: OK (x5)
- **Employees / Filter**: MISS (x5)
- **Employees / Columns**: OK (x5)
- **Employees / Refresh**: MISS (x5)
- **Employees / Export**: OK (x5)
- **Employees / Add Employee**: RACE_OR_ERROR (x5)
- **Departments / Add**: OK (x5)
- **Departments / Refresh**: MISS (x5)
- **Departments / Filter**: MISS (x5)

## Mutations

- Dashboard: Add Employee opened (no create) (confirmed=false)
- Dashboard: Approve clicked (confirmed=false)
- Dashboard: Deny clicked (confirmed=false)

## Issues

### ISSUE-STRESS-SA-DED-01: Login bootstrap 401s (me/refresh)
- Where: Login /login
- Why: Anonymous GET http://localhost:3001/api/auth/me, POST http://localhost:3001/api/auth/refresh → 401
- Classification: **FRONTEND**
- How to resolve: Skip me/refresh probes on public auth routes (cosmetic)
- Screenshot: `002-login-success.png`
- Network: `GET http://localhost:3001/api/auth/me 401`

### ISSUE-STRESS-SA-DED-02: Employees Add Employee not resilient to 5× rapid click
- Where: Employees list → Add Employee (stress ×5)
- Why: Click 1 succeeded (59ms); clicks 2–5 failed (3.5–4.3s each, locator detached / not clickable after nav/wizard). No network 4xx/5xx, no console errors — UI race under burst open.
- Classification: **FRONTEND**
- How to resolve: Disable/hide Add Employee while navigation or create wizard is in-flight; debounce primary CTA
- Screenshot: `035-employees-stress-add-employee.png`
- Network: `n/a (click race; 0 failed API)`

### Coverage notes
- Dashboard: Add Employee wizard through step 3 then leave (no create); Approve + Deny clicked (pending queue often empty → no Confirm dialog); 7d/30d stress OK; Dashboard Add Employee stress OK.
- Employees: nested density/columns/export; `/employees/new` filled; Filter/Refresh controls absent (MISS).
- Departments: kebab/actions nest + Add stress OK; Filter/Refresh MISS.
- First pass under heavy concurrent shards captured only spinners (recorded as load risk); successful pass waited for shell ready.
