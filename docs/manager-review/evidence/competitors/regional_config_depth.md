# Regional competitor configuration depth vs EMS (public docs only)

Evidence caveat: help.keka.com and Odoo l10n pages partly 403/truncated; Jisr, Bayzat, ZenHR, Darwinbox, Talenta, Mudad have NO public configuration docs surfaced (marketing/third-party only). Cells marked (mkt) = marketing claim, not config doc. Nothing here is from logins.

## Matrix (concrete option names)

| Capability | Keka | greytHR | Zoho People/Payroll | RazorpayX | Odoo l10n | Gulf/ID vendors |
|---|---|---|---|---|---|---|
| Leave accrual | days or hours; monthly/quarterly/semi-annual/annual; yearly quota or unlimited; block accrual above balance cap; no accrual in probation; expiry rules (help.keka.com/hc/en-us/articles/39946786434961) | "grant based on previous year work days", grant by calendar month or attendance cycle (greythr.com/admin/answers/141462299) | - | - | Annual Leave Balance on Saudi payroll tab | Bayzat/ZenHR: tenure-based annual accrual (mkt) |
| Carry fwd / encashment | year-end carry fwd w/ limits+expiry; encashment into any of next 4 unfinalized payroll months; Carryover Import; Leave Balance Adjustment (help.keka.com/.../39946542986513) | encash/grant/apply workflows | - | - | - | ZenHR: unused leave paid at termination (mkt) |
| Sandwich | "Sandwich Policy" section per leave type (weekly offs counted when leave before/after) | - | - | - | "Sandwich leave and optional holidays" (odoo 19 India) | - |
| Comp-off | accrual/application/approval/year-end sections; half-day, prior notice, backdate limit; formula extra hrs / daily hrs x rate (help.keka.com/.../39946598356497, keka.com/compensatory-off-policy) | comp-off from OT policy hours; one OT/comp-off request per date; allowed attendance statuses/days | - | - | - | Darwinbox: comp-off/OT/absconding/optional-leave workflows, escalation on SLA breach (mkt) |
| Leave extras | - | age-based eligibility min/max; stand-in user; custom field on Apply Leave (e.g. salary advance); maternity auto end-date + advance-notice days | - | - | - | - |
| Attendance rules | - | attendance policy by shift; Session 1/2 criteria; In-time/Out-time criteria, session min hours, Late-In/Early-Out, consecutive-days penalty, Convert Weekly Off to Absent, penalty leave, regularization cut-off date, split shifts, shift roster + override + precedence flag (greythr.com/help-admin/attendance-settings..., /admin/answers/143354858) | - | - | Work Entry Source: Schedule/Attendances/Planning | Darwinbox: shifts at group/company level, daily/weekly/monthly roster, auto period rotation, shift swap request (mkt) |
| Payroll structure | - | - | formula/custom components, Variable Earning + Custom Formula, scheduled components, 30-day vs actual-day basis, pay schedule, per-employee PF rate override, EPS capped vs actual wage | fixed/variable/perquisite comps; scheduled revisions; default prorate on gross vs custom per component (razorpay.com/docs/payroll/run-payroll) | Basic/Gross/Net structures, rule params, contract templates | Odoo KSA: Housing/Transport/Other + annual Iqama/Medical/Work-permit |
| Arrears/hold/FnF | - | - | - | auto-arrears on back-dated revision, TDS on arrears same month, LOP reversal, Skip Salary, Stop Salary, run-for-one-employee, OTP execute, FnF from Dismiss + LWD | loans + salary advances w/ payslips | Bayzat FnF: gratuity+leave payout+loan (mkt) |
| Statutory | - | - | PF/ESI/PT/LWF, PT effective-date switch, challans PF/ESI 15th TDS 7th, Form 16+12BA | Form 16 in My Payslips after Q4 filing | India: PF/ESIC/PT/LWF; reports Salary Register, EPF, ESI, LWF; KSA: GOSI by nationality (3 rule params), EOS provision accrual | Mudad: basic must match Qiwa/GOSI; file due 1 business day pre-payday; IBAN 24 chars; Jisr: GOSI API (add/terminate/update wages) + Mudad auto-upload (mkt) |
| WPS/bank | - | - | - | - | WPS report per payslip/run, SARIE, MoL ID, Bank Establishment ID (odoo KSA docs) | Bayzat: UAE SIF, Lulu Exchange (mkt) |
| Accounting | - | - | Zoho Books native | - | *_hr_payroll_account journal entries, register payments | - |
| Indonesia | - | - | - | - | - | Talenta: marital status drives allowances, religion drives THR, prior-employer PPh21 field, BPJS, TER (help-center.talenta.co) |

Not found publicly: custom-form builders, workflow builder step types, roles granularity, import tools, biometric brand lists, SSO, mobile feature lists for any vendor (need account/docs behind login).

## Diff vs EMS (schema + src/modules)

EXCEEDS or at par: LeavePolicy versioned+country packs with sandwichRule, accrual freq/cap, carryForward cap/expiry, encashment basis/divisor/trigger, statutory floors, comp-off, ledger, year-end; formula SalaryComponent with GL code + cost-center rule; StatutoryPack versioned per country; payroll variance/audit/4-eyes approval levels, parallel-reconcile, payment batches, bank-file NACH/ACH/SEPA/BACS/CSV, ECR/24Q/RTI return, Form tax-form PDFs, loans, garnishment, contractor invoices, pay-calendar sub-monthly, opening balances/historical payslip migration, payslip templates, encrypted payout methods w/ maker-checker, country bank schemas, hold/release payslip, FnF endpoint.

PARTIAL: attendance (check-in/out, 100 m geofence, workMode, regularization, summary; no shift model, no grace/late/early rules, no OT policy); holidays (policy + optional selections, no restricted-quota rules seen); timesheets (overtime derived there, not an attendance OT policy); settings/integrations (webhook only); reports (saved views + scheduled reports, no builder); permissions (permission catalogue exists; custom roles not fully wired); resignation model without checklist workflow.

MISSING entirely: shift master/roster/rotation/swap; attendance policy engine (late-in/early-out/grace/penalty/consecutive-days, weekly-off-to-absent); selfie/face and biometric device integration; WPS/SIF/Mudad/GOSI file generators (no 'WPS','GOSI','SIF' in code); EOSB/gratuity computation for UAE/KSA beyond a packData slot; BPJS/PPh21/THR (Indonesia); onboarding/offboarding checklists; configurable approval-chain/workflow builder; custom fields/forms; accounting connectors (Tally/Zoho Books/QuickBooks/Xero) and GL journal export; SSO/SAML; data-import wizard for general HR master data (payroll input import exists); leave custom fields/stand-in/age eligibility; Form 16 Part A/B TRACES style import; challan generation.

## Top 15 missing, ranked by customer demand
1. Shift master + roster + rotation + swap
2. Attendance policy engine (grace, late/early, half-day thresholds, penalty-to-leave)
3. Overtime policy -> payroll and comp-off auto-credit
4. Biometric/device + selfie/face attendance integration
5. Configurable multi-level approval workflow builder (SLA escalation)
6. Onboarding/offboarding checklists with tasks, owners, documents
7. WPS/SIF (UAE) and Mudad/GOSI/Qiwa (KSA) file output
8. EOSB/gratuity engine per GCC law (21/30-day, resignation-vs-termination)
9. Accounting export (Tally, Zoho Books, QuickBooks, Xero) and GL journal
10. Custom fields / custom forms on employee, leave, expense
11. SSO (SAML/OIDC) + granular custom roles wired to authorize()
12. Statutory challan/payment sheets (PF, ESI, PT, TDS) and Form 16 / 12BA
13. Generic report builder (field select, filters, schedule) and bulk data import with validation
14. Leave extras: age eligibility, stand-in, apply-form custom fields, attendance-cycle grants, backdate/prior-notice limits, carryover import
15. Indonesia pack: BPJS, PPh21 TER, THR
