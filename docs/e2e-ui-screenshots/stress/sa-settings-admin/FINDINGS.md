# SA-SETTINGS-ADMIN — SUPER_ADMIN Settings/Admin Stress+Deep E2E

> Generated: 2026-08-03T02:14:51.983Z
> Role: `SUPER_ADMIN` (`superadmin@acme.test` / tenant `acme-corp-001`)
> UI: `http://localhost:3001` · API: `http://localhost:4000/api/v1`
> Tool: Playwright Chromium · SHORT deep + rapid settings stress
> Screenshots: `docs/e2e-ui-screenshots/stress/sa-settings-admin/`
> **No Render. No git commit.**

## Summary

| Metric | Value |
|--------|------:|
| Menus | **6** |
| Settings subroutes | **29** |
| Stress rapid navs | **5** |
| Controls clicked | **40** |
| Max depth | **2** |
| Layers | **41** |
| Screenshots | **82** |
| Issues BACKEND | **0** |
| Issues FRONTEND | **2** |
| Issues BOTH | **0** |
| Click log | **39** |

## Menus covered

- Permissions (`/permissions`)
- Settings (`/settings`)
- Recruitment (`/recruitment`)
- Performance (`/performance`)
- Assets (`/assets`)
- Announcements (`/announcements`)
- Settings subs (29): `company-profile`, `branding`, `locale`, `working-hours`, `leave-types`, `attendance-rules`, `timesheets`, `leave-policies`, `leave-packs`, `leave-assignments`, `pay/legal-entities`, `pay/statutory-packs`, `pay/components`, `pay/groups`, `pay/schedules`, `pay/payslip-template`, `pay/data-policy`, `pay/country-bank-schemas`, `authentication`, `sessions`, `audit-log`, `email-templates`, `notifications`, `integration-email`, `integration-storage`, `integration-webhooks`, `billing-plan`, `billing-invoices`, `roles-permissions`

## Stress: rapid 5 settings routes

Routes: `company-profile` → `branding` → `authentication` → `billing-plan` → `roles-permissions`

- **company-profile**: OK 294ms · netFails=0 · console=0
- **branding**: OK 333ms · netFails=0 · console=0
- **authentication**: OK 320ms · netFails=0 · console=0
- **billing-plan**: OK 463ms · netFails=0 · console=0
- **roles-permissions**: OK 299ms · netFails=1 · console=0
  - net: `404 GET http://localhost:3001/settings/roles-permissions`

## Issues

### ISSUE-SA-SET-01
- **Where:** Hard nav `/settings/roles-permissions`
- **Why:** Next.js App Router returns HTML **404** — no `src/app/(dashboard)/settings/roles-permissions/page.tsx`. SettingsNav does not list this slug; matrix UI lives at `/permissions` (API still `GET/PATCH /settings/roles-permissions`).
- **Classification:** FRONTEND
- **How to resolve:** Add page that redirects to `/permissions`, or remove dead deep-links; keep API path unchanged.
- **Screenshot:** `docs/e2e-ui-screenshots/stress/sa-settings-admin/072-settings-roles-permissions-land.png`
- **Network:** `GET http://localhost:3001/settings/roles-permissions 404`

### ISSUE-SA-SET-02
- **Where:** Stress rapid-5 (company-profile → branding → authentication → billing-plan → roles-permissions)
- **Why:** 4/5 routes clean (294–463ms, 0 console). Sole failure is same Next **404** on `roles-permissions` (reproduced under rapid nav). No console/pageerrors; no API ≥400 on the other four.
- **Classification:** FRONTEND
- **How to resolve:** Same as SET-01 (missing page). Rapid nav otherwise stable — no race/cancel bugs observed.
- **Screenshot:** `docs/e2e-ui-screenshots/stress/sa-settings-admin/078-stress-settings-end.png`
- **Network:** `GET http://localhost:3001/settings/roles-permissions 404`

## Mutations

_None (Cancel-preferred)._
