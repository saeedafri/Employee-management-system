# E2E_GAP_CONFIRM_FINDINGS

> SUPER_ADMIN gap-menus confirm · 2026-08-03T03:41:20.175Z
> Evidence: `docs/e2e-ui-screenshots/confirm/sa-gap-menus/` (**392** PNGs)
> **No Render. No git commit.**


> Generated: 2026-08-03T03:41:20.173Z (final merge)
> Role: `SUPER_ADMIN` (`superadmin@acme.test` / tenant `acme-corp-001`)
> UI: `http://localhost:3001` · API: `http://localhost:4000/api/v1`
> Tool: Playwright Chromium · gap-fill deep (tabs/row actions/modals/settings subs)
> Screenshots: `docs/e2e-ui-screenshots/confirm/sa-gap-menus/`
> **No Render. No git commit.**

## Assets Export conflict resolution (2026-08-03T03:42Z)

Conflict: `confirm/sa-exports` recorded `assets-inventory.csv ok:true` (part of 16/16); this gap pass recorded GAP-03 `ok:false` ×2.

| Re-probe | Result |
|----------|--------|
| Login | `superadmin@acme.test` / `Password123!` → `/dashboard` |
| Action | `/assets` → Export ×3 |
| Downloads | 3× `assets-inventory.csv` **ok:false** (no path; `failure:{}`) |
| Network | No export/CSV request on click (client-side Blob in `AssetsScreen.handleExport`) |
| Root cause | Immediate `URL.revokeObjectURL` after synthetic `<a download>` click — race |
| **Final verdict** | **flaky** (historical ok:true once + ok:false on gap×2 + reprobe×3). GAP-03 **stands** as FE issue. Not solid pass. |

Evidence: `docs/e2e-ui-screenshots/confirm/assets-export-reprobe/results.json`

## SA-GAP-MENUS FE issues (GAP-01..04) — retained

These FRONTEND issues remain open / historically filed (do not drop):

| ID | Summary | Class |
|----|---------|-------|
| ISSUE-SA-GAP-01 | Performance: React duplicate key console error | FRONTEND |
| ISSUE-SA-GAP-02 | Settings menu exploration crash (dialog locator timeout) | FRONTEND |
| ISSUE-SA-GAP-03 | Assets Export `assets-inventory.csv` download ok:false — **confirmed flaky** on re-probe | FRONTEND |
| ISSUE-SA-GAP-04 | Settings/roles-permissions FE route 404 | FRONTEND |

Also mirrored under `docs/E2E_FRONTEND_ISSUES_CONTRACT.md` → `## SA-GAP-MENUS`.

## Summary

| Metric | Value |
|--------|------:|
| Menus | **6** |
| Settings subroutes | **29** |
| Controls clicked | **397** |
| Max depth | **3** |
| Layers | **135** |
| Screenshots | **392** |
| Findings PASS | **280** |
| Findings FAIL/SKIP | **1** |
| Issues BACKEND | **0** |
| Issues FRONTEND | **4** |
| Issues BOTH | **0** |
| Click log | **348** |

## Menus covered

- Recruitment
- Performance
- Assets
- Announcements
- Permissions
- Settings
- Settings resume: `authentication`, `sessions`, `audit-log`, `email-templates`, `notifications`, `integration-email`, `integration-storage`, `integration-webhooks`, `billing-plan`, `billing-invoices`, `roles-permissions`

## Controls tested (PASS)

### Login (2)

- PASS `submit` — `002-login-success.png`
- PASS `resume` — `369-resume-login-ok.png`

### Recruitment (20)

- PASS `open` — `003-recruitment-land.png`
- PASS `d0/tab:Pipeline` — `004-recruitment-d0-tab-pipeline.png`
- PASS `d0/tab:Openings` — `005-recruitment-d0-tab-openings.png`
- PASS `d0/tab:Candidates` — `006-recruitment-d0-tab-candidates.png`
- PASS `d0/Export` — `007-recruitment-d0-export.png`
- PASS `d0/Openings` — `008-recruitment-d0-openings.png`
- PASS `d1/Cancel` — `025-recruitment-d1-cancel.png`
- PASS `d0/Set rating 1` — `026-recruitment-d0-set-rating-1.png`
- PASS `d0/Set rating 2` — `027-recruitment-d0-set-rating-2.png`
- PASS `d0/Set rating 3` — `028-recruitment-d0-set-rating-3.png`
- PASS `d2/tab:Pipeline` — `031-recruitment-d2-tab-pipeline.png`
- PASS `d2/tab:Openings` — `032-recruitment-d2-tab-openings.png`
- PASS `d2/tab:Candidates` — `033-recruitment-d2-tab-candidates.png`
- PASS `d2/Export` — `034-recruitment-d2-export.png`
- PASS `d2/Openings` — `035-recruitment-d2-openings.png`
- PASS `d3/Cancel` — `038-recruitment-d3-cancel.png`
- PASS `d2/Set rating 1` — `039-recruitment-d2-set-rating-1.png`
- PASS `d2/Set rating 2` — `040-recruitment-d2-set-rating-2.png`
- PASS `rowact:Openings` — `041-recruitment-row-openings-0.png`
- PASS `rowact:Actions for Solutions Architect` — `042-recruitment-row-actions-for-solutions-architect-1.png`

### Performance (38)

- PASS `open` — `043-performance-land.png`
- PASS `d0/tab:Reviews` — `044-performance-d0-tab-reviews.png`
- PASS `d0/tab:Goals` — `045-performance-d0-tab-goals.png`
- PASS `d0/tab:Calibration` — `046-performance-d0-tab-calibration.png`
- PASS `d0/Export` — `047-performance-d0-export.png`
- PASS `d1/tab:Reviews` — `049-performance-d1-tab-reviews.png`
- PASS `d1/tab:Goals` — `050-performance-d1-tab-goals.png`
- PASS `d1/tab:Calibration` — `051-performance-d1-tab-calibration.png`
- PASS `d1/Export` — `052-performance-d1-export.png`
- PASS `d2/tab:Reviews` — `054-performance-d2-tab-reviews.png`
- PASS `d2/tab:Goals` — `055-performance-d2-tab-goals.png`
- PASS `d2/tab:Calibration` — `056-performance-d2-tab-calibration.png`
- PASS `d2/Export` — `057-performance-d2-export.png`
- PASS `d3/tab:Reviews` — `059-performance-d3-tab-reviews.png`
- PASS `d3/tab:Goals` — `060-performance-d3-tab-goals.png`
- PASS `d3/tab:Calibration` — `061-performance-d3-tab-calibration.png`
- PASS `d3/Export` — `062-performance-d3-export.png`
- PASS `d3/Reviews` — `064-performance-d3-reviews.png`
- PASS `d3/Open calibration sheet` — `065-performance-d3-open-calibration-sheet.png`
- PASS `d3/Goals` — `066-performance-d3-goals.png`
- PASS `d3/Calibration` — `067-performance-d3-calibration.png`
- PASS `d2/Reviews` — `068-performance-d2-reviews.png`
- PASS `d2/Open calibration sheet` — `069-performance-d2-open-calibration-sheet.png`
- PASS `d2/Goals` — `070-performance-d2-goals.png`
- PASS `d2/Calibration` — `071-performance-d2-calibration.png`
- PASS `d1/Reviews` — `072-performance-d1-reviews.png`
- PASS `d1/Open calibration sheet` — `073-performance-d1-open-calibration-sheet.png`
- PASS `d1/Goals` — `074-performance-d1-goals.png`
- PASS `d1/Calibration` — `075-performance-d1-calibration.png`
- PASS `d0/Reviews` — `076-performance-d0-reviews.png`
- PASS `d0/Open calibration sheet` — `077-performance-d0-open-calibration-sheet.png`
- PASS `d0/Goals` — `078-performance-d0-goals.png`
- PASS `d0/Calibration` — `079-performance-d0-calibration.png`
- PASS `rowact:Start a Review` — `080-performance-row-start-a-review-0.png`
- PASS `rowact:Reviews` — `081-performance-row-reviews-1.png`
- PASS `rowact:View` — `082-performance-row-view-2.png`
- PASS `tabdeep:Goals` — `083-performance-tabdeep-goals.png`
- PASS `tabdeep:Calibration` — `089-performance-tabdeep-calibration.png`

### Performance/Goals (1)

- PASS `d0/All statuses` — `088-performance-goals-d0-all-statuses.png`

### Performance/Calibration (1)

- PASS `rowact:Open calibration sheet` — `090-performance-calibration-row-open-calibration-sheet-2.png`

### Assets (21)

- PASS `open` — `091-assets-land.png`
- PASS `d0/tab:Inventory` — `092-assets-d0-tab-inventory.png`
- PASS `d0/tab:Assigned` — `093-assets-d0-tab-assigned.png`
- PASS `d0/tab:Requests` — `094-assets-d0-tab-requests.png`
- PASS `d0/Export` — `095-assets-d0-export.png`
- PASS `d0/Assigned` — `100-assets-d0-assigned.png`
- PASS `d0/View` — `101-assets-d0-view.png`
- PASS `d0/All statuses` — `102-assets-d0-all-statuses.png`
- PASS `d0/Decline` — `103-assets-d0-decline.png`
- PASS `d0/Approve` — `104-assets-d0-approve.png`
- PASS `d0/Inventory` — `105-assets-d0-inventory.png`
- PASS `d0/Requests` — `106-assets-d0-requests.png`
- PASS `rowact:View` — `107-assets-row-view-0.png`
- PASS `rowact:View` — `108-assets-row-view-1.png`
- PASS `rowact:View` — `109-assets-row-view-2.png`
- PASS `rowact:View` — `110-assets-row-view-3.png`
- PASS `rowact:View` — `111-assets-row-view-4.png`
- PASS `rowact:View` — `112-assets-row-view-5.png`
- PASS `tabdeep:Inventory` — `113-assets-tabdeep-inventory.png`
- PASS `tabdeep:Assigned` — `143-assets-tabdeep-assigned.png`
- PASS `tabdeep:Requests` — `145-assets-tabdeep-requests.png`

### Assets/Inventory (16)

- PASS `d0/All types` — `118-assets-inventory-d0-all-types.png`
- PASS `d0/More options for E2E Laptop 1783046720209` — `119-assets-inventory-d0-more-options-for-e2e-laptop-1783.png`
- PASS `d1/tab:Inventory` — `120-assets-inventory-d1-tab-inventory.png`
- PASS `d1/tab:Assigned` — `121-assets-inventory-d1-tab-assigned.png`
- PASS `d1/tab:Requests` — `122-assets-inventory-d1-tab-requests.png`
- PASS `d1/Export` — `123-assets-inventory-d1-export.png`
- PASS `d1/Assigned` — `127-assets-inventory-d1-assigned.png`
- PASS `d1/View` — `128-assets-inventory-d1-view.png`
- PASS `d1/All statuses` — `129-assets-inventory-d1-all-statuses.png`
- PASS `d1/Decline` — `130-assets-inventory-d1-decline.png`
- PASS `d1/Approve` — `131-assets-inventory-d1-approve.png`
- PASS `d1/Inventory` — `132-assets-inventory-d1-inventory.png`
- PASS `d1/Requests` — `133-assets-inventory-d1-requests.png`
- PASS `d0/More options for Audit Laptop` — `134-assets-inventory-d0-more-options-for-audit-laptop.png`
- PASS `d1/Close` — `136-assets-inventory-d1-close.png`
- PASS `d0/More options for Philips 32" 4K` — `137-assets-inventory-d0-more-options-for-philips-32-4k.png`

### Assets/Assigned (1)

- PASS `d0/Recall` — `144-assets-assigned-d0-recall.png`

### Announcements (27)

- PASS `open` — `146-announcements-land.png`
- PASS `d1/Add event` — `152-announcements-d1-add-event.png`
- PASS `d1/Cancel` — `158-announcements-d1-cancel.png`
- PASS `d0/Announcement actions` — `159-announcements-d0-announcement-actions.png`
- PASS `d2/Cancel` — `161-announcements-d2-cancel.png`
- PASS `d2/Add event` — `163-announcements-d2-add-event.png`
- PASS `d2/Post announcement` — `165-announcements-d2-post-announcement.png`
- PASS `d2/Close` — `167-announcements-d2-close.png`
- PASS `d1/Announcement actions` — `168-announcements-d1-announcement-actions.png`
- PASS `d3/Cancel` — `170-announcements-d3-cancel.png`
- PASS `d3/Add event` — `172-announcements-d3-add-event.png`
- PASS `d3/Post announcement` — `174-announcements-d3-post-announcement.png`
- PASS `d3/Close` — `176-announcements-d3-close.png`
- PASS `d2/Announcement actions` — `177-announcements-d2-announcement-actions.png`
- PASS `d3/Announcement actions` — `182-announcements-d3-announcement-actions.png`
- PASS `rowact:Announcement actions` — `183-announcements-row-announcement-actions-0.png`
- PASS `menuitem:Unpin` — `184-announcements-menu-unpin.png`
- PASS `rowact:Announcement actions` — `185-announcements-row-announcement-actions-1.png`
- PASS `menuitem:Pin to top` — `186-announcements-menu-pin-to-top.png`
- PASS `rowact:Announcement actions` — `187-announcements-row-announcement-actions-2.png`
- PASS `menuitem:Pin to top` — `188-announcements-menu-pin-to-top.png`
- PASS `rowact:Announcement actions` — `189-announcements-row-announcement-actions-3.png`
- PASS `menuitem:Pin to top` — `190-announcements-menu-pin-to-top.png`
- PASS `rowact:Announcement actions` — `191-announcements-row-announcement-actions-4.png`
- PASS `menuitem:Pin to top` — `192-announcements-menu-pin-to-top.png`
- PASS `rowact:Announcement actions` — `193-announcements-row-announcement-actions-5.png`
- PASS `menuitem:Pin to top` — `194-announcements-menu-pin-to-top.png`

### Permissions (2)

- PASS `open` — `195-permissions-land.png`
- PASS `deep-reopen` — `392-permissions-deep-land.png`

### Settings (85)

- PASS `open` — `200-settings-land.png`
- PASS `d0/Assignments` — `201-settings-d0-assignments.png`
- PASS `d1/Assignments` — `202-settings-d1-assignments.png`
- PASS `d1/Auto-assign all` — `203-settings-d1-auto-assign-all.png`
- PASS `d1/Company Profile` — `204-settings-d1-company-profile.png`
- PASS `d2/Assignments` — `205-settings-d2-assignments.png`
- PASS `d3/Assignments` — `206-settings-d3-assignments.png`
- PASS `d3/Auto-assign all` — `207-settings-d3-auto-assign-all.png`
- PASS `d3/Company Profile` — `208-settings-d3-company-profile.png`
- PASS `d3/Branding` — `209-settings-d3-branding.png`
- PASS `d3/Locale & Timezone` — `210-settings-d3-locale-timezone.png`
- PASS `d3/Working Hours` — `211-settings-d3-working-hours.png`
- PASS `d3/Leave Types` — `212-settings-d3-leave-types.png`
- PASS `d3/Attendance Rules` — `213-settings-d3-attendance-rules.png`
- PASS `d3/Timesheets` — `214-settings-d3-timesheets.png`
- PASS `d3/Leave Policies` — `215-settings-d3-leave-policies.png`
- PASS `d3/Policy Packs` — `216-settings-d3-policy-packs.png`
- PASS `d3/Legal Entities` — `217-settings-d3-legal-entities.png`
- PASS `d3/Statutory Packs` — `218-settings-d3-statutory-packs.png`
- PASS `d3/Salary Components` — `219-settings-d3-salary-components.png`
- PASS `d3/Pay Groups` — `220-settings-d3-pay-groups.png`
- PASS `d3/Pay Schedules` — `221-settings-d3-pay-schedules.png`
- PASS `d3/Payslip Template` — `222-settings-d3-payslip-template.png`
- PASS `d3/Data Policy` — `223-settings-d3-data-policy.png`
- PASS `d3/Country Bank Schemas` — `224-settings-d3-country-bank-schemas.png`
- PASS `d3/Authentication` — `225-settings-d3-authentication.png`
- PASS `d3/Sessions & Devices` — `226-settings-d3-sessions-devices.png`
- PASS `d3/Audit Log` — `227-settings-d3-audit-log.png`
- PASS `d2/Company Profile` — `228-settings-d2-company-profile.png`
- PASS `d3/Assignments` — `229-settings-d3-assignments.png`
- PASS `d3/Company Profile` — `230-settings-d3-company-profile.png`
- PASS `d3/Branding` — `231-settings-d3-branding.png`
- PASS `d3/Locale & Timezone` — `232-settings-d3-locale-timezone.png`
- PASS `d3/Working Hours` — `233-settings-d3-working-hours.png`
- PASS `d3/Leave Types` — `234-settings-d3-leave-types.png`
- PASS `d3/Attendance Rules` — `235-settings-d3-attendance-rules.png`
- PASS `d3/Timesheets` — `236-settings-d3-timesheets.png`
- PASS `d3/Leave Policies` — `237-settings-d3-leave-policies.png`
- PASS `d3/Policy Packs` — `238-settings-d3-policy-packs.png`
- PASS `d3/Legal Entities` — `239-settings-d3-legal-entities.png`
- PASS `d3/Statutory Packs` — `240-settings-d3-statutory-packs.png`
- PASS `d3/Salary Components` — `241-settings-d3-salary-components.png`
- PASS `d3/Pay Groups` — `242-settings-d3-pay-groups.png`
- PASS `d3/Pay Schedules` — `243-settings-d3-pay-schedules.png`
- PASS `d3/Payslip Template` — `244-settings-d3-payslip-template.png`
- PASS `d3/Data Policy` — `245-settings-d3-data-policy.png`
- PASS `d3/Country Bank Schemas` — `246-settings-d3-country-bank-schemas.png`
- PASS `d3/Authentication` — `247-settings-d3-authentication.png`
- PASS `d3/Sessions & Devices` — `248-settings-d3-sessions-devices.png`
- PASS `d3/Audit Log` — `249-settings-d3-audit-log.png`
- PASS `d3/Email Templates` — `250-settings-d3-email-templates.png`
- PASS `d2/Branding` — `251-settings-d2-branding.png`
- PASS `d3/Assignments` — `252-settings-d3-assignments.png`
- PASS `d3/Upload` — `253-settings-d3-upload.png`
- PASS `d3/Company Profile` — `254-settings-d3-company-profile.png`
- PASS `d3/Branding` — `255-settings-d3-branding.png`
- PASS `sub:company-profile` — `256-settings-company-profile-land.png`
- PASS `sub:branding` — `257-settings-branding-land.png`
- PASS `sub:locale` — `258-settings-locale-land.png`
- PASS `sub:working-hours` — `260-settings-working-hours-land.png`
- PASS `sub:leave-types` — `262-settings-leave-types-land.png`
- PASS `sub:attendance-rules` — `274-settings-attendance-rules-land.png`
- PASS `sub:timesheets` — `276-settings-timesheets-land.png`
- PASS `sub:leave-policies` — `281-settings-leave-policies-land.png`
- PASS `sub:leave-packs` — `283-settings-leave-packs-land.png`
- PASS `sub:leave-assignments` — `287-settings-leave-assignments-land.png`
- PASS `sub:pay/legal-entities` — `290-settings-pay-legal-entities-land.png`
- PASS `sub:pay/statutory-packs` — `306-settings-pay-statutory-packs-land.png`
- PASS `sub:pay/components` — `325-settings-pay-components-land.png`
- PASS `sub:pay/groups` — `340-settings-pay-groups-land.png`
- PASS `sub:pay/schedules` — `342-settings-pay-schedules-land.png`
- PASS `sub:pay/payslip-template` — `344-settings-pay-payslip-template-land.png`
- PASS `sub:pay/data-policy` — `359-settings-pay-data-policy-land.png`
- PASS `sub:pay/country-bank-schemas` — `362-settings-pay-country-bank-schemas-land.png`
- PASS `sub:authentication` — `370-settings-authentication-land.png`
- PASS `sub:sessions` — `372-settings-sessions-land.png`
- PASS `sub:audit-log` — `373-settings-audit-log-land.png`
- PASS `sub:email-templates` — `376-settings-email-templates-land.png`
- PASS `sub:notifications` — `384-settings-notifications-land.png`
- PASS `sub:integration-email` — `385-settings-integration-email-land.png`
- PASS `sub:integration-storage` — `386-settings-integration-storage-land.png`
- PASS `sub:integration-webhooks` — `387-settings-integration-webhooks-land.png`
- PASS `sub:billing-plan` — `389-settings-billing-plan-land.png`
- PASS `sub:billing-invoices` — `390-settings-billing-invoices-land.png`
- PASS `sub:roles-permissions` — `391-settings-roles-permissions-land.png`

### Settings/locale (1)

- PASS `d0/Locale & Timezone` — `259-settings-locale-d0-locale-timezone.png`

### Settings/working-hours (1)

- PASS `d0/Working Hours` — `261-settings-working-hours-d0-working-hours.png`

### Settings/leave-types (2)

- PASS `d0/Leave Types` — `271-settings-leave-types-d0-leave-types.png`
- PASS `d1/Cancel` — `273-settings-leave-types-d1-cancel.png`

### Settings/attendance-rules (1)

- PASS `d0/Attendance Rules` — `275-settings-attendance-rules-d0-attendance-rules.png`

### Settings/timesheets (4)

- PASS `d0/Flag in review (default)` — `277-settings-timesheets-d0-flag-in-review-default.png`
- PASS `d0/Timesheets` — `278-settings-timesheets-d0-timesheets.png`
- PASS `d0/15 minutes` — `279-settings-timesheets-d0-15-minutes.png`
- PASS `d0/Off — no reminder` — `280-settings-timesheets-d0-off-no-reminder.png`

### Settings/leave-policies (1)

- PASS `d0/Leave Policies` — `282-settings-leave-policies-d0-leave-policies.png`

### Settings/leave-packs (3)

- PASS `d0/Policy Packs` — `284-settings-leave-packs-d0-policy-packs.png`
- PASS `d0/Seed for tenant` — `285-settings-leave-packs-d0-seed-for-tenant.png`
- PASS `d0/Seed & localize` — `286-settings-leave-packs-d0-seed-localize.png`

### Settings/leave-assignments (2)

- PASS `d0/Assignments` — `288-settings-leave-assignments-d0-assignments.png`
- PASS `d0/Auto-assign all` — `289-settings-leave-assignments-d0-auto-assign-all.png`

### Settings/pay/statutory-packs (15)

- PASS `d1/tab:General` — `308-settings-pay-statutory-packs-d1-tab-general.png`
- PASS `d1/tab:Tax Regimes` — `309-settings-pay-statutory-packs-d1-tab-tax-regimes.png`
- PASS `d1/tab:Contributions` — `310-settings-pay-statutory-packs-d1-tab-contributions.png`
- PASS `d1/tab:Local Taxes` — `311-settings-pay-statutory-packs-d1-tab-local-taxes.png`
- PASS `d1/tab:Min Wages` — `312-settings-pay-statutory-packs-d1-tab-min-wages.png`
- PASS `d1/tab:Components` — `313-settings-pay-statutory-packs-d1-tab-components.png`
- PASS `d2/tab:General` — `315-settings-pay-statutory-packs-d2-tab-general.png`
- PASS `d2/tab:Tax Regimes` — `316-settings-pay-statutory-packs-d2-tab-tax-regimes.png`
- PASS `d2/tab:Contributions` — `317-settings-pay-statutory-packs-d2-tab-contributions.png`
- PASS `d2/tab:Local Taxes` — `318-settings-pay-statutory-packs-d2-tab-local-taxes.png`
- PASS `d2/tab:Min Wages` — `319-settings-pay-statutory-packs-d2-tab-min-wages.png`
- PASS `d2/tab:Components` — `320-settings-pay-statutory-packs-d2-tab-components.png`
- PASS `d3/tab:General` — `322-settings-pay-statutory-packs-d3-tab-general.png`
- PASS `d3/tab:Tax Regimes` — `323-settings-pay-statutory-packs-d3-tab-tax-regimes.png`
- PASS `d3/tab:Contributions` — `324-settings-pay-statutory-packs-d3-tab-contributions.png`

### Settings/pay/components (7)

- PASS `d3/Close` — `333-settings-pay-components-d3-close.png`
- PASS `d0/Salary Components` — `334-settings-pay-components-d0-salary-components.png`
- PASS `d0/All Types` — `335-settings-pay-components-d0-all-types.png`
- PASS `d0/All Status` — `336-settings-pay-components-d0-all-status.png`
- PASS `d0/Actions for E2E Component` — `337-settings-pay-components-d0-actions-for-e2e-component.png`
- PASS `d1/Add Component` — `338-settings-pay-components-d1-add-component.png`
- PASS `d1/Salary Components` — `339-settings-pay-components-d1-salary-components.png`

### Settings/pay/groups (1)

- PASS `d0/Pay Groups` — `341-settings-pay-groups-d0-pay-groups.png`

### Settings/pay/schedules (1)

- PASS `d0/Pay Schedules` — `343-settings-pay-schedules-d0-pay-schedules.png`

### Settings/pay/payslip-template (14)

- PASS `d0/Payslip Template` — `345-settings-pay-payslip-template-d0-payslip-template.png`
- PASS `d0/en-IN` — `346-settings-pay-payslip-template-d0-en-in.png`
- PASS `d0/Move Earnings down` — `347-settings-pay-payslip-template-d0-move-earnings-down.png`
- PASS `d0/Move Deductions up` — `348-settings-pay-payslip-template-d0-move-deductions-up.png`
- PASS `d0/Move Deductions down` — `349-settings-pay-payslip-template-d0-move-deductions-dow.png`
- PASS `d0/Move Employer Contributions up` — `350-settings-pay-payslip-template-d0-move-employer-contr.png`
- PASS `d0/Move Employer Contributions down` — `351-settings-pay-payslip-template-d0-move-employer-contr.png`
- PASS `d0/Move One-Time Items up` — `352-settings-pay-payslip-template-d0-move-one-time-items.png`
- PASS `d0/Move One-Time Items down` — `353-settings-pay-payslip-template-d0-move-one-time-items.png`
- PASS `d0/Move Year to Date up` — `354-settings-pay-payslip-template-d0-move-year-to-date-u.png`
- PASS `d0/Move Year to Date down` — `355-settings-pay-payslip-template-d0-move-year-to-date-d.png`
- PASS `d0/Move Attendance up` — `356-settings-pay-payslip-template-d0-move-attendance-up.png`
- PASS `d0/Move Attendance down` — `357-settings-pay-payslip-template-d0-move-attendance-dow.png`
- PASS `d0/Move Payment Info up` — `358-settings-pay-payslip-template-d0-move-payment-info-u.png`

### Settings/pay/data-policy (2)

- PASS `d0/Save changes` — `360-settings-pay-data-policy-d0-save-changes.png`
- PASS `d0/Data Policy` — `361-settings-pay-data-policy-d0-data-policy.png`

### Settings/authentication (1)

- PASS `OPTIONAL` — `371-settings-authentication-optional.png`

### Settings/audit-log (2)

- PASS `All entities` — `374-settings-audit-log-all-entities.png`
- PASS `All actions` — `375-settings-audit-log-all-actions.png`

### Settings/email-templates (7)

- PASS `dlg:Edit` — `377-settings-email-templates-dlg-edit.png`
- PASS `dlg:Edit` — `378-settings-email-templates-dlg-edit.png`
- PASS `dlg:Edit` — `379-settings-email-templates-dlg-edit.png`
- PASS `dlg:Edit` — `380-settings-email-templates-dlg-edit.png`
- PASS `dlg:Edit` — `381-settings-email-templates-dlg-edit.png`
- PASS `dlg:Edit` — `382-settings-email-templates-dlg-edit.png`
- PASS `dlg:Edit` — `383-settings-email-templates-dlg-edit.png`

### Settings/integration-webhooks (1)

- PASS `dlg:Add webhook` — `388-settings-integration-webhooks-dlg-add-webhook.png`

## Controls failed / skipped

- **FAIL** Settings → `explore` — TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[role="dialog"], [role="alertdialog"]').last().locator('input:visible:not([type="checkbox"]):not([type= — `368-settings-crash.png`

## Issues (NEW this run)

### ISSUE-SA-GAP-01: Performance: console error
- **Where:** Performance / http://localhost:3001/performance
- **Why:** Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. cmqjpydv6002yk
- **Classification:** FRONTEND
- **How to resolve:** Fix React/runtime error in FE
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/sa-gap-menus/045-performance-d0-tab-goals.png`
- **Network:** `n/a (console)`

### ISSUE-SA-GAP-02: Menu exploration crashed: Settings
- **Where:** Settings / /settings
- **Why:** TimeoutError: locator.getAttribute: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('[role="dialog"], [role="alertdialog"]').last().locator('input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]), textarea:visible').nth(1)

- **Classification:** FRONTEND
- **How to resolve:** Stabilize page; re-run confirm gap shard
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/sa-gap-menus/368-settings-crash.png`
- **Network:** `n/a`

### ISSUE-SA-GAP-03: Download failed: assets-inventory.csv
- **Where:** http://localhost:3001/assets
- **Why:** Download event failure: {} (gap pass ×2). **Re-probe 2026-08-03T03:42Z ×3 also ok:false.** Conflicts with sa-exports historical ok:true → **final verdict flaky**. FE builds CSV Blob then `a.click()` + immediate `URL.revokeObjectURL(url)` (`AssetsScreen.tsx`); no BE export URL.
- **Classification:** FRONTEND
- **How to resolve:** Delay/revoke after download settles (or use `setTimeout`/`requestAnimationFrame`); prefer FileSaver pattern; optionally add BE CSV export with Content-Disposition
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/sa-gap-menus/n/a` · re-probe `docs/e2e-ui-screenshots/confirm/assets-export-reprobe/003-assets-export-attempt-1.png` (+2,+3)
- **Network:** `download event` (no `/api/**/export` on click)
- **Status:** OPEN — **flaky** (not solid pass; not solid fail)

### ISSUE-SA-GAP-04: Settings/roles-permissions: 404 GET …/settings/roles-permissions
- **Where:** Settings/roles-permissions / http://localhost:3001/settings/roles-permissions
- **Why:** GET http://localhost:3001/settings/roles-permissions → 404; <!DOCTYPE html><html lang="en" class="inter_8db6fa51-module__MMaAbG__variable jetbrains_mono_9a2f2d6c-module__wsyXyG__variable h-full antialiased"><head><meta charSet="utf-8"/><meta name="viewport" co
- **Classification:** FRONTEND
- **How to resolve:** Fix FE/BFF
- **Screenshot:** `docs/e2e-ui-screenshots/confirm/sa-gap-menus/391-settings-roles-permissions-land.png`
- **Network:** `GET http://localhost:3001/settings/roles-permissions 404`

## Click log (truncated)

- d0 Recruitment → tab:Pipeline
- d0 Recruitment → tab:Openings
- d0 Recruitment → tab:Candidates
- d0 Recruitment → Export
- d0 Recruitment → Openings
- d0 Recruitment → Filter
- d1 Recruitment → Open
- d2 Recruitment → Open
- d3 Recruitment → Open
- d3 Recruitment → Closing
- d3 Recruitment → On hold
- d3 Recruitment → Closed
- d2 Recruitment → Clear filter
- d2 Recruitment → Closing
- d3 Recruitment → Clear filter
- d2 Recruitment → On hold
- d2 Recruitment → Closed
- d1 Recruitment → Closing
- d1 Recruitment → On hold
- d1 Recruitment → Closed
- d0 Recruitment → Post a Job
- d1 Recruitment → Cancel
- d0 Recruitment → Set rating 1
- d0 Recruitment → Set rating 2
- d0 Recruitment → Set rating 3
- d0 Recruitment → Set rating 4
- d1 Recruitment → Save changes
- d2 Recruitment → tab:Pipeline
- d2 Recruitment → tab:Openings
- d2 Recruitment → tab:Candidates
- d2 Recruitment → Export
- d2 Recruitment → Openings
- d2 Recruitment → Filter
- d2 Recruitment → Post a Job
- d3 Recruitment → Cancel
- d2 Recruitment → Set rating 1
- d2 Recruitment → Set rating 2
- d0 Recruitment → rowact:Openings
- d0 Recruitment → rowact:Actions for Solutions Architect
- d0 Performance → tab:Reviews
- d0 Performance → tab:Goals
- d0 Performance → tab:Calibration
- d0 Performance → Export
- d0 Performance → Start a Review
- d1 Performance → tab:Reviews
- d1 Performance → tab:Goals
- d1 Performance → tab:Calibration
- d1 Performance → Export
- d1 Performance → Start a Review
- d2 Performance → tab:Reviews
- d2 Performance → tab:Goals
- d2 Performance → tab:Calibration
- d2 Performance → Export
- d2 Performance → Start a Review
- d3 Performance → tab:Reviews
- d3 Performance → tab:Goals
- d3 Performance → tab:Calibration
- d3 Performance → Export
- d3 Performance → Start a Review
- d3 Performance → Reviews
- d3 Performance → Open calibration sheet
- d3 Performance → Goals
- d3 Performance → Calibration
- d2 Performance → Reviews
- d2 Performance → Open calibration sheet
- d2 Performance → Goals
- d2 Performance → Calibration
- d1 Performance → Reviews
- d1 Performance → Open calibration sheet
- d1 Performance → Goals
- d1 Performance → Calibration
- d0 Performance → Reviews
- d0 Performance → Open calibration sheet
- d0 Performance → Goals
- d0 Performance → Calibration
- d0 Performance → rowact:Start a Review
- d0 Performance → rowact:Reviews
- d0 Performance → rowact:View
- d0 Performance/Goals → Add goal
- d1 Performance/Goals → Add goal
- d2 Performance/Goals → Add goal
- d3 Performance/Goals → Add goal
- d0 Performance/Goals → All statuses
- d0 Performance/Calibration → rowact:Open calibration sheet
- d0 Assets → tab:Inventory
- d0 Assets → tab:Assigned
- d0 Assets → tab:Requests
- d0 Assets → Export
- d0 Assets → Add Asset
- d1 Assets → Add asset
- d2 Assets → Add asset
- d3 Assets → Add asset
- d0 Assets → Assigned
- d0 Assets → View
- d0 Assets → All statuses
- d0 Assets → Decline
- d0 Assets → Approve
- d0 Assets → Inventory
- d0 Assets → Requests
- d0 Assets → rowact:View
- d0 Assets → rowact:View
- d0 Assets → rowact:View
- d0 Assets → rowact:View
- d0 Assets → rowact:View
- d0 Assets → rowact:View
- d0 Assets/Inventory → Filter
- d1 Assets/Inventory → Available only
- d2 Assets/Inventory → Clear all filters
- d3 Assets/Inventory → Available only
- d0 Assets/Inventory → All types
- d0 Assets/Inventory → More options for E2E Laptop 1783046720209
- d1 Assets/Inventory → tab:Inventory
- d1 Assets/Inventory → tab:Assigned
- d1 Assets/Inventory → tab:Requests
- d1 Assets/Inventory → Export
- d1 Assets/Inventory → Add Asset
- d2 Assets/Inventory → Laptop
- d3 Assets/Inventory → Laptop
- d1 Assets/Inventory → Assigned
- d1 Assets/Inventory → View
- d1 Assets/Inventory → All statuses
- d1 Assets/Inventory → Decline
- d1 Assets/Inventory → Approve
- d1 Assets/Inventory → Inventory
- d1 Assets/Inventory → Requests
- d0 Assets/Inventory → More options for Audit Laptop
- d0 Assets/Inventory → More options for iPad Pro 12.9"
- d1 Assets/Inventory → Close
- d0 Assets/Inventory → More options for Philips 32" 4K
- d0 Assets/Inventory → More options for HP ZBook Studio
- d0 Assets/Inventory → More options for OnePlus 12
- d0 Assets/Inventory → More options for Jabra Evolve2 Headset
- d0 Assets/Inventory → More options for ASUS ROG Zephyrus
- d0 Assets/Inventory → More options for Dell UltraSharp 24"
- d0 Assets/Assigned → Recall
- d0 Announcements → New Announcement
- d1 Announcements → Company
- d2 Announcements → Company
- d3 Announcements → Company
- d0 Announcements → Add
- d1 Announcements → Add event
- d0 Announcements → Share an update with the company…
- d1 Announcements → All employees
- d2 Announcements → All employees
- d3 Announcements → All employees
- d0 Announcements → Post
- d1 Announcements → Cancel
- d0 Announcements → Announcement actions
- d1 Announcements → New Announcement
- d2 Announcements → Cancel
- d1 Announcements → Add
- d2 Announcements → Add event
- d1 Announcements → Share an update with the company…
- d2 Announcements → Post announcement
- d1 Announcements → Post
- d2 Announcements → Close
- d1 Announcements → Announcement actions
- d2 Announcements → New Announcement
- d3 Announcements → Cancel
- d2 Announcements → Add
- d3 Announcements → Add event
- d2 Announcements → Share an update with the company…
- d3 Announcements → Post announcement
- d2 Announcements → Post
- d3 Announcements → Close
- d2 Announcements → Announcement actions
- d3 Announcements → New Announcement
- d3 Announcements → Add
- d3 Announcements → Share an update with the company…
- d3 Announcements → Post
- d3 Announcements → Announcement actions
- d0 Announcements → rowact:Announcement actions
- d1 Announcements → menuitem:Unpin
- d0 Announcements → rowact:Announcement actions
- d1 Announcements → menuitem:Pin to top
- d0 Announcements → rowact:Announcement actions
- d1 Announcements → menuitem:Pin to top
- d0 Announcements → rowact:Announcement actions
- d1 Announcements → menuitem:Pin to top
- d0 Announcements → rowact:Announcement actions
- d1 Announcements → menuitem:Pin to top
- d0 Announcements → rowact:Announcement actions
- d1 Announcements → menuitem:Pin to top
- d0 Permissions → Add Role
- d1 Permissions → Create Role
- d2 Permissions → Create Role
- d3 Permissions → Create Role
- d0 Settings → Assignments
- d1 Settings → Assignments
- d1 Settings → Auto-assign all
- d1 Settings → Company Profile
- d2 Settings → Assignments
- d3 Settings → Assignments
- d3 Settings → Auto-assign all
- d3 Settings → Company Profile
- d3 Settings → Branding
- d3 Settings → Locale & Timezone
- d3 Settings → Working Hours
- d3 Settings → Leave Types
- d3 Settings → Attendance Rules
- d3 Settings → Timesheets
- d3 Settings → Leave Policies
- d3 Settings → Policy Packs
- d3 Settings → Legal Entities
- d3 Settings → Statutory Packs
- d3 Settings → Salary Components
- d3 Settings → Pay Groups
- d3 Settings → Pay Schedules
- d3 Settings → Payslip Template
- d3 Settings → Data Policy
- d3 Settings → Country Bank Schemas
- d3 Settings → Authentication
- d3 Settings → Sessions & Devices
- d3 Settings → Audit Log
- d2 Settings → Company Profile
- d3 Settings → Assignments
- d3 Settings → Company Profile
- d3 Settings → Branding
- d3 Settings → Locale & Timezone
- d3 Settings → Working Hours
- d3 Settings → Leave Types
- d3 Settings → Attendance Rules
- d3 Settings → Timesheets
- d3 Settings → Leave Policies
- d3 Settings → Policy Packs
- d3 Settings → Legal Entities
- d3 Settings → Statutory Packs
- d3 Settings → Salary Components
- d3 Settings → Pay Groups
- d3 Settings → Pay Schedules
- d3 Settings → Payslip Template
- d3 Settings → Data Policy
- d3 Settings → Country Bank Schemas
- d3 Settings → Authentication
- d3 Settings → Sessions & Devices
- d3 Settings → Audit Log
- d3 Settings → Email Templates
- d2 Settings → Branding
- d3 Settings → Assignments
- d3 Settings → Upload
- d3 Settings → Company Profile
- d3 Settings → Branding
- d0 Settings/locale → Locale & Timezone
- d0 Settings/working-hours → Working Hours
- d0 Settings/leave-types → Add Type
- d1 Settings/leave-types → Create
- d2 Settings/leave-types → Create
- d3 Settings/leave-types → Create
- d0 Settings/leave-types → Edit
- d1 Settings/leave-types → Save Changes
- d2 Settings/leave-types → Save Changes
- d3 Settings/leave-types → Save Changes
- d0 Settings/leave-types → Leave Types
- d0 Settings/leave-types → Deactivate
- d1 Settings/leave-types → Cancel
- d0 Settings/attendance-rules → Attendance Rules
- d0 Settings/timesheets → Flag in review (default)
- d0 Settings/timesheets → Timesheets
- d0 Settings/timesheets → 15 minutes
- d0 Settings/timesheets → Off — no reminder
- d0 Settings/leave-policies → Leave Policies
- d0 Settings/leave-packs → Policy Packs
- d0 Settings/leave-packs → Seed for tenant
- d0 Settings/leave-packs → Seed & localize
- d0 Settings/leave-assignments → Assignments
- d0 Settings/leave-assignments → Auto-assign all
- d0 Settings/pay/legal-entities → Add Entity
- d1 Settings/pay/legal-entities → Create Entity
- d2 Settings/pay/legal-entities → Create Entity
- d3 Settings/pay/legal-entities → Create Entity
- d0 Settings/pay/legal-entities → Edit Acme India Pvt Ltd
- d1 Settings/pay/legal-entities → Save Changes
- d2 Settings/pay/legal-entities → Save Changes
- d3 Settings/pay/legal-entities → Save Changes
- d0 Settings/pay/legal-entities → Edit Acme Kuwait WLL (litmus)
- d1 Settings/pay/legal-entities → Kuwait
- d2 Settings/pay/legal-entities → Kuwait
- d3 Settings/pay/legal-entities → Kuwait
- d0 Settings/pay/legal-entities → Edit Acme USA Inc (litmus)
- d1 Settings/pay/legal-entities → United States
- d2 Settings/pay/legal-entities → United States
- d0 Settings/pay/statutory-packs → New pack
- d1 Settings/pay/statutory-packs → tab:General
- d1 Settings/pay/statutory-packs → tab:Tax Regimes
- d1 Settings/pay/statutory-packs → tab:Contributions
- d1 Settings/pay/statutory-packs → tab:Local Taxes
- d1 Settings/pay/statutory-packs → tab:Min Wages
- d1 Settings/pay/statutory-packs → tab:Components
- d1 Settings/pay/statutory-packs → Add
- d2 Settings/pay/statutory-packs → tab:General
- d2 Settings/pay/statutory-packs → tab:Tax Regimes
- d2 Settings/pay/statutory-packs → tab:Contributions
- d2 Settings/pay/statutory-packs → tab:Local Taxes
- d2 Settings/pay/statutory-packs → tab:Min Wages
- d2 Settings/pay/statutory-packs → tab:Components
- d2 Settings/pay/statutory-packs → Add
- d3 Settings/pay/statutory-packs → tab:General
- d3 Settings/pay/statutory-packs → tab:Tax Regimes
- d3 Settings/pay/statutory-packs → tab:Contributions
- d0 Settings/pay/components → Add Component
- d1 Settings/pay/components → Create Component
- d2 Settings/pay/components → Create Component
- d3 Settings/pay/components → Create Component
- d3 Settings/pay/components → Earning
- d3 Settings/pay/components → Allocate by department
- d3 Settings/pay/components → Cancel
- d3 Settings/pay/components → Close
- d0 Settings/pay/components → Salary Components
- d0 Settings/pay/components → All Types
- d0 Settings/pay/components → All Status
- d0 Settings/pay/components → Actions for E2E Component
- d1 Settings/pay/components → Add Component
- d1 Settings/pay/components → Salary Components
- d0 Settings/pay/groups → Pay Groups
- d0 Settings/pay/schedules → Pay Schedules
- d0 Settings/pay/payslip-template → Payslip Template
- d0 Settings/pay/payslip-template → en-IN
- d0 Settings/pay/payslip-template → Move Earnings down
- d0 Settings/pay/payslip-template → Move Deductions up
- d0 Settings/pay/payslip-template → Move Deductions down
- d0 Settings/pay/payslip-template → Move Employer Contributions up
- d0 Settings/pay/payslip-template → Move Employer Contributions down
- d0 Settings/pay/payslip-template → Move One-Time Items up
- d0 Settings/pay/payslip-template → Move One-Time Items down
- d0 Settings/pay/payslip-template → Move Year to Date up
- d0 Settings/pay/payslip-template → Move Year to Date down
- d0 Settings/pay/payslip-template → Move Attendance up
- d0 Settings/pay/payslip-template → Move Attendance down
- d0 Settings/pay/payslip-template → Move Payment Info up
- d0 Settings/pay/data-policy → Save changes
- d0 Settings/pay/data-policy → Data Policy
- d0 Settings/pay/country-bank-schemas → Add country
- d1 Settings/pay/country-bank-schemas → Add field
- d2 Settings/pay/country-bank-schemas → Add field
- d3 Settings/pay/country-bank-schemas → Add field
- d0 Settings/pay/country-bank-schemas → Edit Australia
- d1 Settings/pay/country-bank-schemas → Save changes
- d0 Settings/authentication → OPTIONAL
- d0 Settings/audit-log → All entities
- d0 Settings/audit-log → All actions
- d0 Settings/email-templates → Edit
- d0 Settings/email-templates → Edit
- d0 Settings/email-templates → Edit
- d0 Settings/email-templates → Edit
- d0 Settings/email-templates → Edit
- d0 Settings/email-templates → Edit
- d0 Settings/email-templates → Edit
- d0 Settings/integration-webhooks → Add webhook

## Downloads

- `{"suggested":"assets-inventory.csv","ok":false,"failure":{},"pageUrl":"http://localhost:3001/assets"}`
- `{"suggested":"assets-inventory.csv","ok":false,"failure":{},"pageUrl":"http://localhost:3001/assets"}`
